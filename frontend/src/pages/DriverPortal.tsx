import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApi, api } from '../api/client';
import { RoleLoginCard } from '../components/RoleLoginCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Trip, Incident, Tracking as TrackingData, Stop, ManifestStop, StaffMember } from '../types';
import RouteMap from '../components/RouteMap';
import {
  Navigation,
  Clock,
  BusFront,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  RefreshCw,
  LogOut,
  Globe,
  ArrowRight,
  User,
  ShieldAlert,
  Send,
  Check,
  ChevronRight,
  Home,
  CheckCircle,
  Radio,
  MapPin,
  Gauge,
  Compass,
  AlertCircle,
  Users
} from 'lucide-react';

export function DriverPortal() {
  const { user, logout } = useApp();
  const [section, setSection] = useState<'current' | 'live-map' | 'roster' | 'delay' | 'defect'>('current');
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  const { data: tripsPage, reload: reloadTrips } = useApi<{ items: Trip[] }>('/schedules?size=100', 8000);
  const { data: incidents, reload: reloadIncidents } = useApi<Incident[]>('/incidents', 15000);
  const { data: staffList, reload: reloadStaff } = useApi<StaffMember[]>('/staff', 8000);

  const myStaffRecord = staffList?.find((s) => s.id === user?.id || s.email?.toLowerCase() === user?.email?.toLowerCase());
  const [driverOnlineOverride, setDriverOnlineOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (myStaffRecord && typeof myStaffRecord.available === 'boolean') {
      setDriverOnlineOverride(myStaffRecord.available);
    }
  }, [myStaffRecord?.available]);

  const isDriverOnline = driverOnlineOverride !== null
    ? driverOnlineOverride
    : (myStaffRecord ? myStaffRecord.available : true);

  const [togglingOnline, setTogglingOnline] = useState(false);

  const toggleOnlineStatus = async () => {
    if (!user) return;
    const nextStatus = !isDriverOnline;
    // Immediate optimistic state flip so user sees instant reaction on click
    setDriverOnlineOverride(nextStatus);
    setTogglingOnline(true);
    try {
      const targetId = myStaffRecord?.id || user.id;
      const res: any = await api.put(`/staff/${targetId}`, {
        available: nextStatus,
        licenseNumber: myStaffRecord?.licenseNumber || 'LK-DRV'
      });
      if (res && typeof res.available === 'boolean') {
        setDriverOnlineOverride(res.available);
      }
      flashSuccess(`Duty status switched to ${nextStatus ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)'}. ${nextStatus ? 'Assigned schedules are now live for passenger booking.' : 'Assigned schedules are now hidden from passenger search.'}`);
      reloadStaff();
      reloadTrips();
    } catch (err: any) {
      // Revert if API failed
      setDriverOnlineOverride(!nextStatus);
      flashError(err.message || 'Failed to toggle online status');
    } finally {
      setTogglingOnline(false);
    }
  };

  // Status feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Delay form
  const [delayMins, setDelayMins] = useState(15);
  const [delayReason, setDelayReason] = useState('Heavy Highway Traffic Congestion');
  const [customDelayReason, setCustomDelayReason] = useState('');

  // Defect form
  const [defectCategory, setDefectCategory] = useState('MECHANICAL');
  const [defectSeverity, setDefectSeverity] = useState('MEDIUM');
  const [defectDescription, setDefectDescription] = useState('');

  // Live telemetry and progress updates from RouteMap
  const [simulatedInfo, setSimulatedInfo] = useState<{
    progress: number;
    currentSpeed: number;
    approachingStop: Stop | null;
    passedStopNames: string[];
    distanceRemainingKm: number;
  } | null>(null);

  // Filter trips for this driver
  const myTrips = (tripsPage?.items || []).filter(
    (t) => !user?.id || t.driver?.id === user.id || t.driver?.name?.toLowerCase().includes(user?.firstName?.toLowerCase() || '')
  );

  const pendingDutyTrip = myTrips.find((t) => !t.driverAcknowledged && t.status !== 'CANCELLED');

  // Find active or selected trip — ARRIVED trips are done and must never be shown as active
  const nonArrivedTrips = myTrips.filter((t) => t.status !== 'ARRIVED');
  const activeTrip: Trip | undefined =
    (selectedTripId ? myTrips.find((t) => t.id === selectedTripId && t.status !== 'ARRIVED') : null) ||
    nonArrivedTrips.find((t) => t.status === 'IN_TRANSIT') ||
    nonArrivedTrips.find((t) => t.status === 'BOARDING') ||
    nonArrivedTrips.find((t) => t.status === 'PUBLISHED' || t.status === 'CONFIRMED') ||
    nonArrivedTrips[0];

  // Fetch live tracking data for active trip
  const { data: trackingData, reload: reloadTracking } = useApi<TrackingData>(
    activeTrip ? `/tracking/${activeTrip.id}` : null,
    5000
  );

  const isTripLive = activeTrip ? (
    activeTrip.status === 'IN_TRANSIT' ||
    trackingData?.isLive === true
  ) : false;

  const effectiveTracking: TrackingData | null = trackingData || (activeTrip ? {
    trip: activeTrip,
    mode: 'GPS',
    gpsStatus: isTripLive ? 'LIVE' : 'UNAVAILABLE',
    isLive: isTripLive,
    position: null,
    eta: activeTrip.arrival,
    distanceRemainingKm: activeTrip.distanceKm || 120,
    message: isTripLive ? 'Live Telemetry Active' : 'Standby'
  } : null);

  // Passenger Manifest Stops & Approaching Stop Info
  const manifestStops = useMemo<ManifestStop[]>(() => {
    return effectiveTracking?.manifest || [];
  }, [effectiveTracking?.manifest]);

  const getStopId = (s: any): number | null => {
    if (!s) return null;
    return typeof s.stopId === 'number' ? s.stopId : typeof s.id === 'number' ? s.id : null;
  };

  const currentApproachingStop = useMemo(() => {
    if (!isTripLive) {
      // In standby, current stop is origin
      return manifestStops[0] || (activeTrip?.stops ? activeTrip.stops[0] : null) || (activeTrip ? { id: 1, name: activeTrip.origin, latitude: 6.9271, longitude: 79.8612 } as any : null);
    }
    return simulatedInfo?.approachingStop || (manifestStops.length > 1 ? manifestStops[1] : manifestStops[0]) || null;
  }, [isTripLive, simulatedInfo?.approachingStop, manifestStops, activeTrip]);

  const approachingManifest = useMemo(() => {
    if (!currentApproachingStop) return null;
    const curId = getStopId(currentApproachingStop);
    return manifestStops.find(
      (m) =>
        (curId !== null && m.stopId === curId) ||
        m.name.toLowerCase() === (currentApproachingStop.name || '').toLowerCase()
    ) || null;
  }, [manifestStops, currentApproachingStop]);

  const approachingPickups = approachingManifest?.pickupCount || 0;
  const approachingDropoffs = approachingManifest?.dropoffCount || 0;
  const isStopRequired = approachingPickups + approachingDropoffs > 0;

  // Real-time telemetry sync back to backend (updates trip_tracking approaching_stop_id in DB)
  const lastSyncRef = useRef<number>(0);
  const lastStopIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTripLive || !activeTrip || !simulatedInfo) return;
    const now = Date.now();
    const stopId = simulatedInfo.approachingStop?.id || null;
    const stopChanged = stopId !== lastStopIdRef.current;
    if (stopChanged || now - lastSyncRef.current > 6000) {
      lastSyncRef.current = now;
      lastStopIdRef.current = stopId;
      api.post(`/trips/${activeTrip.id}/telemetry`, {
        progress: simulatedInfo.progress,
        speed: simulatedInfo.currentSpeed,
        distanceRemainingKm: simulatedInfo.distanceRemainingKm,
        approachingStopId: stopId
      }).catch(() => {});
    }
  }, [isTripLive, activeTrip, simulatedInfo]);

  const handleRefresh = () => {
    setRefreshing(true);
    reloadTrips();
    if (reloadTracking) reloadTracking();
    reloadIncidents();
    setTimeout(() => setRefreshing(false), 700);
  };

  const flashSuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError(null);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const flashError = (msg: string) => {
    setActionError(msg);
    setActionSuccess(null);
    setTimeout(() => setActionError(null), 4000);
  };

  if (!user || user.role !== 'DRIVER') {
    return (
      <RoleLoginCard
        role="DRIVER"
        roleTitle="Driver Portal"
        description="View your assigned bus, trip schedules, assigned conductor details, and update live journey status."
        demoEmail="driver@citylink.com"
        badgeColor="#00f5a0"
      />
    );
  }

  const handleAcknowledge = async (tripId: number) => {
    try {
      await api.post(`/trips/${tripId}/acknowledge`, {});
      flashSuccess(`Duty confirmed for trip #${tripId}. Have a safe journey!`);
      reloadTrips();
    } catch (err: any) {
      flashError(err.message || 'Failed to acknowledge duty');
    }
  };

  const handleStartTrip = async (tripId: number) => {
    setUpdating(true);
    try {
      await api.post(`/trips/${tripId}/start`, {});
      flashSuccess('Journey started! GPS live tracking is now active.');
      reloadTrips();
      if (reloadTracking) reloadTracking();
    } catch (err: any) {
      flashError(err.message || 'Failed to start trip');
    } finally {
      setUpdating(false);
    }
  };

  const handleStopTrip = async (tripId: number) => {
    setUpdating(true);
    try {
      await api.post(`/trips/${tripId}/stop`, {});
      flashSuccess('Journey completed! Trip marked as Arrived.');
      reloadTrips();
      if (reloadTracking) reloadTracking();
    } catch (err: any) {
      flashError(err.message || 'Failed to complete trip');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendDelay = async (e?: React.FormEvent, overrideMins?: number, overrideReason?: string) => {
    if (e) e.preventDefault();
    if (!activeTrip) {
      flashError('No active trip selected to report a delay for.');
      return;
    }
    const finalMins = overrideMins !== undefined ? overrideMins : delayMins;
    const finalReason = overrideReason !== undefined
      ? overrideReason
      : (customDelayReason.trim() ? customDelayReason.trim() : delayReason);

    setUpdating(true);
    try {
      await api.post(`/trips/${activeTrip.id}/delay`, {
        delayMinutes: Number(finalMins),
        reason: finalReason
      });
      if (finalMins === 0) {
        flashSuccess('Trip delay cleared! Timetable status restored to On Time.');
      } else {
        flashSuccess(`Delay of ${finalMins} min broadcasted successfully to operations & passengers.`);
      }
      reloadTrips();
      if (reloadTracking) reloadTracking();
    } catch (err: any) {
      flashError(err.message || 'Failed to broadcast delay');
    } finally {
      setUpdating(false);
    }
  };

  const handleReportDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defectDescription.trim()) {
      flashError('Please describe the defect or issue.');
      return;
    }
    setUpdating(true);
    try {
      await api.post('/incidents', {
        busId: activeTrip?.bus?.id || 1,
        type: defectCategory,
        priority: defectSeverity,
        description: defectDescription
      });
      flashSuccess('Vehicle defect report submitted to maintenance dispatch.');
      setDefectDescription('');
      reloadIncidents();
    } catch (err: any) {
      flashError(err.message || 'Failed to submit report');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="capital-layout">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="capital-sidebar">
        {/* Brand */}
        <div className="capital-brand">
          <div className="capital-brand-icon" style={{ background: 'linear-gradient(135deg, #00f5a0, #00b4d8)' }}>
            <Navigation size={18} color="#090d14" />
          </div>
          <div className="capital-brand-text">
            <span>Driver Portal</span>
            <small style={{ color: '#00f5a0' }}>Fleet Operations</small>
          </div>
          <Link to="/" style={{ marginLeft: 'auto', color: '#64748b' }} title="Public Site">
            <Home size={15} />
          </Link>
        </div>

        {/* Navigation Group 1: DUTY OPERATIONS */}
        <div className="capital-nav-group">
          <span className="capital-nav-title">DUTY OPERATIONS</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'current' ? 'active' : ''}`}
            onClick={() => setSection('current')}
          >
            <Navigation size={16} />
            <span>Current Trip</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'live-map' ? 'active' : ''}`}
            onClick={() => setSection('live-map')}
          >
            <Radio size={16} style={{ color: isTripLive ? '#00f5a0' : undefined }} />
            <span>Live Map</span>
            {isTripLive ? (
              <span
                style={{
                  marginLeft: 'auto',
                  marginRight: '6px',
                  background: 'rgba(0, 245, 160, 0.2)',
                  color: '#00f5a0',
                  border: '1px solid rgba(0, 245, 160, 0.4)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00f5a0', display: 'inline-block' }} />
                LIVE
              </span>
            ) : null}
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'roster' ? 'active' : ''}`}
            onClick={() => setSection('roster')}
          >
            <Calendar size={16} />
            <span>My Schedule</span>
            <span className="capital-nav-badge">{myTrips.length}</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
        </div>

        {/* Navigation Group 2: SAFETY & REPORTING */}
        <div className="capital-nav-group">
          <span className="capital-nav-title">SAFETY & REPORTING</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'delay' ? 'active' : ''}`}
            onClick={() => setSection('delay')}
          >
            <Clock size={16} />
            <span>Report Delay</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'defect' ? 'active' : ''}`}
            onClick={() => setSection('defect')}
          >
            <ShieldAlert size={16} />
            <span>Report Defect</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
        </div>

        {/* Go to Site Button */}
        <Link to="/" className="capital-goto-site" title="Return to Public Site">
          <Globe size={16} />
          <span>Public Site</span>
          <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.7 }} />
        </Link>

        {/* Bottom Profile Capsule */}
        <div className="capital-sidebar-bottom">
          <div className="capital-user-card">
            <div className="capital-user-left">
              <div className="capital-user-avatar" style={{ background: 'linear-gradient(135deg, #00f5a0, #00b4d8)', color: '#090d14', fontWeight: 800 }}>
                {user.firstName ? user.firstName[0] : 'D'}{user.lastName ? user.lastName[0] : ''}
              </div>
              <div
                className="capital-user-meta"
                onClick={toggleOnlineStatus}
                style={{ cursor: 'pointer' }}
                title="Click to toggle Online/Offline duty status"
              >
                <strong>{user.firstName} {user.lastName}</strong>
                <small style={{ color: isDriverOnline ? '#00f5a0' : '#ef4444', fontWeight: 600 }}>
                  DRIVER ({isDriverOnline ? 'ONLINE' : 'OFFLINE'})
                </small>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ----------------- RIGHT MAIN CONTENT AREA ----------------- */}
      <main className="capital-main">
        {/* Topbar Header */}
        <div className="capital-header">
          <div className="capital-header-title">
            <h1>
              {section === 'current' && 'Current Journey & Duty'}
              {section === 'live-map' && 'Live GPS Cockpit & Route Map'}
              {section === 'roster' && 'My Duty Schedule'}
              {section === 'delay' && 'Report Traffic Delay'}
              {section === 'defect' && 'Report Vehicle Defect'}
            </h1>
            <p>
              <span className="capital-status-dot" style={{ background: isTripLive ? '#00f5a0' : '#38bdf8', boxShadow: isTripLive ? '0 0 10px #00f5a0' : '0 0 6px #38bdf8' }} />
              <span>Captain {user.firstName} {user.lastName} • Driver ID LK-DRV-{user.id || '003'} {isTripLive ? '• Journey In Transit' : '• Ready On Standby'}</span>
            </p>
          </div>

          <div className="capital-header-controls">
            {/* Online / Offline Toggle Pill */}
            <button
              type="button"
              onClick={toggleOnlineStatus}
              disabled={togglingOnline}
              title={isDriverOnline ? 'Click to switch to OFFLINE (off duty)' : 'Click to switch to ONLINE (on duty)'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '24px',
                border: isDriverOnline ? '1.5px solid #10b981' : '1.5px solid #ef4444',
                background: isDriverOnline ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.16)',
                color: isDriverOnline ? '#10b981' : '#f87171',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: isDriverOnline ? '0 0 14px rgba(16, 185, 129, 0.25)' : '0 0 14px rgba(239, 68, 68, 0.25)',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: isDriverOnline ? '#10b981' : '#ef4444',
                  boxShadow: isDriverOnline ? '0 0 10px #10b981' : '0 0 10px #ef4444',
                  transition: 'all 0.25s ease',
                }}
              />
              <span>{togglingOnline ? 'Updating...' : (isDriverOnline ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)')}</span>
            </button>

            <button
              type="button"
              className={`capital-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh trip data"
            >
              <RefreshCw size={13} className={refreshing ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Content Area */}
        <div className="capital-content">
          {/* Offline Notice Banner */}
          {!isDriverOnline && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              padding: '0.9rem 1.25rem',
              borderRadius: '10px',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.86rem'
            }}>
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.92rem' }}>You are currently OFFLINE.</strong>
                <span style={{ fontSize: '0.82rem', opacity: 0.9 }}>
                  Your assigned schedules are hidden from passenger searches and booking. Switch to ONLINE when you are ready to accept passengers and drive.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={toggleOnlineStatus}
                disabled={togglingOnline}
              >
                Go Online Now
              </button>
            </div>
          )}
          {/* Action Alerts */}
          {actionSuccess && (
            <div style={{
              background: 'rgba(0, 245, 160, 0.12)',
              border: '1px solid #00f5a0',
              color: '#00f5a0',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1.25rem'
            }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#f87171',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1.25rem'
            }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{actionError}</span>
            </div>
          )}

          {/* Pending Duty Banner */}
          {pendingDutyTrip && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(2, 132, 199, 0.15))',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: '12px',
              padding: '1.1rem 1.4rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Calendar size={22} />
                </div>
                <div>
                  <strong style={{ color: '#f59e0b', fontSize: '1rem', display: 'block' }}>
                    Duty Assignment Confirmation Required
                  </strong>
                  <span style={{ fontSize: '0.86rem', color: '#e2e8f0' }}>
                    You have been assigned to <strong>Trip #{pendingDutyTrip.id}</strong>: {pendingDutyTrip.origin} ➔ {pendingDutyTrip.destination} (Departure: {new Date(pendingDutyTrip.departure).toLocaleDateString()} at {new Date(pendingDutyTrip.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAcknowledge(pendingDutyTrip.id)}
                style={{
                  background: 'linear-gradient(135deg, #00f5a0, #00b4d8)',
                  color: '#090d14',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  padding: '0.65rem 1.4rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Check size={16} />
                <span>Confirm Assignment</span>
              </button>
            </div>
          )}

          {/* SECTION 1: CURRENT JOURNEY */}
          {section === 'current' && (
            <div>
              {activeTrip ? (
                <div style={{
                  background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '1.75rem',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                        Active Assignment • Trip #{activeTrip.id}
                      </span>
                      <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>{activeTrip.origin}</span>
                        <ArrowRight size={22} color="#00f5a0" />
                        <span>{activeTrip.destination}</span>
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                        <span>Expressway Route: <strong>{activeTrip.routeName || `${activeTrip.origin} - ${activeTrip.destination}`}</strong></span>
                        <span>•</span>
                        <span>Distance: <strong>{activeTrip.distanceKm || 120} km</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: activeTrip.status === 'IN_TRANSIT' ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: activeTrip.status === 'IN_TRANSIT' ? '#00f5a0' : '#e2e8f0',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: activeTrip.status === 'IN_TRANSIT' ? '1px solid #00f5a0' : '1px solid rgba(255, 255, 255, 0.15)'
                      }}>
                        {activeTrip.status}
                      </span>
                    </div>
                  </div>

                  {/* 4 Info Blocks */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>
                        <Clock size={14} />
                        <span>Departure Time</span>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#f8fafc' }}>
                        {new Date(activeTrip.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {new Date(activeTrip.departure).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>
                        <Clock size={14} />
                        <span>Scheduled Arrival</span>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#f8fafc' }}>
                        {new Date(activeTrip.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Est. Duration: {activeTrip.durationMinutes || 120} min
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>
                        <BusFront size={14} />
                        <span>Assigned Coach</span>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#00f5a0' }}>
                        {activeTrip.bus?.registration || activeTrip.bus?.model || 'Coach #101'}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {activeTrip.bus?.model || 'Luxury AC Express'}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>
                        <User size={14} />
                        <span>Senior Conductor</span>
                      </div>
                      <strong style={{ fontSize: '1.15rem', color: '#f8fafc' }}>
                        {activeTrip.conductor?.name || 'Onboard Conductor'}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Duty Conductor
                      </div>
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {activeTrip.status !== 'IN_TRANSIT' && activeTrip.status !== 'ARRIVED' && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => handleStartTrip(activeTrip.id)}
                        style={{
                          background: 'linear-gradient(135deg, #00f5a0, #00b4d8)',
                          color: '#090d14',
                          fontWeight: 800,
                          fontSize: '1rem',
                          padding: '0.85rem 1.8rem',
                          borderRadius: '10px',
                          border: 'none',
                          cursor: updating ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Navigation size={18} />
                        <span>Start Trip & Activate GPS</span>
                      </button>
                    )}

                    {activeTrip.status === 'IN_TRANSIT' && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => handleStopTrip(activeTrip.id)}
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '1rem',
                          padding: '0.85rem 1.8rem',
                          borderRadius: '10px',
                          border: 'none',
                          cursor: updating ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <CheckCircle size={18} />
                        <span>Complete Journey (Arrived)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSection('live-map')}
                      style={{
                        background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.18), rgba(0, 180, 216, 0.18))',
                        color: '#00f5a0',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        padding: '0.85rem 1.4rem',
                        borderRadius: '10px',
                        border: '1px solid #00f5a0',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Radio size={16} />
                      <span>Live Cockpit & Map ↗</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSection('delay')}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#f8fafc',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        padding: '0.85rem 1.4rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Clock size={16} />
                      <span>Report Delay</span>
                    </button>
                  </div>

                  {/* NEXT STOP & PASSENGER DIRECTIVE CARD */}
                  <div style={{
                    marginTop: '1.75rem',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
                    border: isStopRequired ? '1px solid rgba(0, 245, 160, 0.45)' : '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: isStopRequired ? '0 10px 30px rgba(0, 245, 160, 0.12)' : '0 10px 30px rgba(0, 0, 0, 0.3)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: isStopRequired ? 'rgba(0, 245, 160, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${isStopRequired ? '#00f5a0' : '#ef4444'}`,
                          color: isStopRequired ? '#00f5a0' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <MapPin size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {!isTripLive ? 'CURRENT DEPARTURE TERMINAL' : 'NEXT SCHEDULED STOP'}
                          </span>
                          <h3 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '2px 0 0', color: '#f8fafc' }}>
                            {currentApproachingStop?.name || activeTrip.origin}
                          </h3>
                        </div>
                      </div>

                      {/* Driver Action Directive Badge */}
                      <div>
                        {isStopRequired ? (
                          <div style={{
                            background: 'rgba(0, 245, 160, 0.18)',
                            border: '1.5px solid #00f5a0',
                            color: '#00f5a0',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 0 16px rgba(0, 245, 160, 0.25)'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>🛑</span>
                            <div>
                              <strong style={{ fontSize: '0.88rem', display: 'block', letterSpacing: '0.03em' }}>STOP REQUIRED</strong>
                              <small style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Halt coach & open passenger doors</small>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1.5px solid #ef4444',
                            color: '#f87171',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>⚡</span>
                            <div>
                              <strong style={{ fontSize: '0.88rem', display: 'block', letterSpacing: '0.03em' }}>EXPRESS TRANSIT / NO STOP NEEDED</strong>
                              <small style={{ fontSize: '0.72rem', color: '#94a3b8' }}>0 passengers booked • Safe to pass</small>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Passenger Activity for Next Stop */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                      {/* Pickups */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(0, 245, 160, 0.25)',
                        borderRadius: '12px',
                        padding: '1rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                            Passengers Set as Pick-up Spot
                          </span>
                          <span style={{
                            background: approachingPickups > 0 ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: approachingPickups > 0 ? '#00f5a0' : '#94a3b8',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {approachingPickups} {approachingPickups === 1 ? 'passenger' : 'passengers'}
                          </span>
                        </div>
                        <strong style={{ fontSize: '1.6rem', color: approachingPickups > 0 ? '#00f5a0' : '#64748b' }}>
                          {approachingPickups}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                          {approachingPickups > 0
                            ? `${approachingPickups} passenger(s) boarding coach at this stop.`
                            : 'No passengers waiting to board at this stop.'}
                        </div>
                        {approachingManifest?.pickups && approachingManifest.pickups.length > 0 && (
                          <div style={{ marginTop: '8px', maxHeight: '90px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {approachingManifest.pickups.map((p, pIdx) => (
                              <div key={pIdx} style={{ fontSize: '0.74rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '3px 6px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{p.passengerName}</span>
                                <span style={{ color: '#00f5a0', fontWeight: 600 }}>Seat {p.seatNumber}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dropoffs */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '12px',
                        padding: '1rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                            Passengers Set as Drop-off Spot
                          </span>
                          <span style={{
                            background: approachingDropoffs > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: approachingDropoffs > 0 ? '#f87171' : '#94a3b8',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {approachingDropoffs} {approachingDropoffs === 1 ? 'passenger' : 'passengers'}
                          </span>
                        </div>
                        <strong style={{ fontSize: '1.6rem', color: approachingDropoffs > 0 ? '#f87171' : '#64748b' }}>
                          {approachingDropoffs}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                          {approachingDropoffs > 0
                            ? `${approachingDropoffs} passenger(s) scheduled to alight here.`
                            : 'No passengers getting off at this stop.'}
                        </div>
                        {approachingManifest?.dropoffs && approachingManifest.dropoffs.length > 0 && (
                          <div style={{ marginTop: '8px', maxHeight: '90px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {approachingManifest.dropoffs.map((p, pIdx) => (
                              <div key={pIdx} style={{ fontSize: '0.74rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '3px 6px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{p.passengerName}</span>
                                <span style={{ color: '#f87171', fontWeight: 600 }}>Seat {p.seatNumber}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Operational Instruction Banner */}
                    <div style={{
                      background: isStopRequired ? 'rgba(0, 245, 160, 0.08)' : 'rgba(239, 68, 68, 0.06)',
                      border: `1px solid ${isStopRequired ? 'rgba(0, 245, 160, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.85rem'
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>{isStopRequired ? '📢' : '⏩'}</span>
                      <span style={{ color: isStopRequired ? '#e2e8f0' : '#94a3b8' }}>
                        {isStopRequired
                          ? `Captain Directive: ${approachingPickups + approachingDropoffs} passenger movement(s) detected. Please bring coach to a safe stop at ${currentApproachingStop?.name || 'this station'} and wait for conductor's boarding clearance.`
                          : `Captain Directive: 0 bookings for ${currentApproachingStop?.name || 'this station'}. You may maintain highway cruising speed and proceed through without stopping.`
                        }
                      </span>
                    </div>
                  </div>

                  {/* ROUTE STATIONS & PASSENGER MANIFEST TIMELINE */}
                  {manifestStops.length > 0 && (
                    <div style={{
                      marginTop: '1.5rem',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                            Full Route Station Manifest ({manifestStops.length} Stops)
                          </h4>
                          <small style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                            🟢 Green = Passengers Booked (Stop Required) • 🔴 Red = No Passengers (Express Pass)
                          </small>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Total Bookings: {effectiveTracking?.tripTracking?.totalPickups ?? manifestStops.reduce((acc, s) => acc + s.pickupCount, 0)} pax
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {manifestStops.map((st, sIdx) => {
                          const hasPax = st.pickupCount + st.dropoffCount > 0;
                          const appStopId = getStopId(currentApproachingStop);
                          const isCurrent = currentApproachingStop && (
                            (appStopId !== null && st.stopId === appStopId) ||
                            st.name.toLowerCase() === (currentApproachingStop.name || '').toLowerCase()
                          );

                          return (
                            <div
                              key={st.stopId || sIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isCurrent
                                  ? 'rgba(0, 210, 255, 0.12)'
                                  : 'rgba(30, 41, 59, 0.45)',
                                border: isCurrent
                                  ? '1px solid #00d2ff'
                                  : hasPax
                                  ? '1px solid rgba(0, 245, 160, 0.25)'
                                  : '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '10px',
                                padding: '0.75rem 1rem',
                                flexWrap: 'wrap',
                                gap: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: hasPax ? 'rgba(0, 245, 160, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                  border: `1.5px solid ${hasPax ? '#00f5a0' : '#ef4444'}`,
                                  color: hasPax ? '#00f5a0' : '#f87171',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 800
                                }}>
                                  {sIdx + 1}
                                </span>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>{st.name}</strong>
                                    {isCurrent && (
                                      <span style={{ background: '#00d2ff', color: '#090d14', fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>
                                        {!isTripLive ? 'ORIGIN' : 'NEXT STOP'}
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                    +{st.minutesFromDeparture} mins from departure
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '6px', fontSize: '0.76rem' }}>
                                  <span style={{
                                    background: st.pickupCount > 0 ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                    color: st.pickupCount > 0 ? '#00f5a0' : '#64748b',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    fontWeight: 700
                                  }}>
                                    +{st.pickupCount} Pick
                                  </span>
                                  <span style={{
                                    background: st.dropoffCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                    color: st.dropoffCount > 0 ? '#f87171' : '#64748b',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    fontWeight: 700
                                  }}>
                                    -{st.dropoffCount} Drop
                                  </span>
                                </div>

                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  background: hasPax ? 'rgba(0, 245, 160, 0.2)' : 'rgba(239, 68, 68, 0.12)',
                                  color: hasPax ? '#00f5a0' : '#f87171',
                                  border: `1px solid ${hasPax ? 'rgba(0, 245, 160, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`
                                }}>
                                  {hasPax ? '🛑 STOP REQUIRED' : '⚡ EXPRESS PASS'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '3rem 2rem',
                  textAlign: 'center'
                }}>
                  <BusFront size={48} style={{ color: '#64748b', margin: '0 auto 16px auto' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#e2e8f0' }}>No Active Journey Running</h3>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 1.5rem 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    You currently have no bus trip in transit. Check your upcoming scheduled duties in the roster tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSection('roster')}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #00d2ff)',
                      color: '#090d14',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    View My Schedule
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: LIVE GPS COCKPIT & ROUTE MAP */}
          {section === 'live-map' && (
            <div>
              {activeTrip ? (
                <div>
                  {/* Top Cockpit Header Bar */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85))',
                    border: '1px solid rgba(0, 245, 160, 0.25)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.25rem',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: isTripLive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        border: isTripLive ? '1px solid #00f5a0' : '1px solid #38bdf8',
                        color: isTripLive ? '#00f5a0' : '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Radio size={22} className={isTripLive ? 'spin-icon' : ''} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>
                            TRIP #{activeTrip.id} • {activeTrip.bus?.registration || activeTrip.bus?.model || 'Express Coach'}
                          </span>
                          <span style={{
                            background: activeTrip.status === 'IN_TRANSIT' ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: activeTrip.status === 'IN_TRANSIT' ? '#00f5a0' : '#cbd5e1',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: activeTrip.status === 'IN_TRANSIT' ? '1px solid rgba(0, 245, 160, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)'
                          }}>
                            {activeTrip.status}
                          </span>
                          {activeTrip.delayMinutes > 0 && (
                            <span style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.4)'
                            }}>
                              +{activeTrip.delayMinutes} MIN DELAY
                            </span>
                          )}
                        </div>

                        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc' }}>
                          <span>{activeTrip.origin}</span>
                          <ArrowRight size={18} color="#00f5a0" />
                          <span>{activeTrip.destination}</span>
                        </h2>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {myTrips.length > 1 && (
                        <select
                          value={activeTrip.id}
                          onChange={(e) => setSelectedTripId(Number(e.target.value))}
                          style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#f8fafc',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            padding: '8px 12px',
                            borderRadius: '8px'
                          }}
                        >
                          {myTrips.map((t) => (
                            <option key={t.id} value={t.id}>
                              #{t.id} {t.origin} ➔ {t.destination} ({new Date(t.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Start / Stop Trip buttons right in Live Map toolbar */}
                      {activeTrip.status !== 'IN_TRANSIT' && activeTrip.status !== 'ARRIVED' && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleStartTrip(activeTrip.id)}
                          style={{
                            background: 'linear-gradient(135deg, #00f5a0, #00b4d8)',
                            color: '#090d14',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 14px rgba(0, 245, 160, 0.35)'
                          }}
                        >
                          <Navigation size={16} />
                          <span>Start Trip & Activate GPS</span>
                        </button>
                      )}

                      {activeTrip.status === 'IN_TRANSIT' && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleStopTrip(activeTrip.id)}
                          style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                          }}
                        >
                          <CheckCircle size={16} />
                          <span>Complete Journey (Arrived)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cockpit Grid: Map on Left (approx 65%), Controls & Delays on Right (approx 35%) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'start'
                  }}>
                    {/* LEFT: THE INTERACTIVE LIVE ROUTE MAP */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
                    }}>
                      {effectiveTracking && (
                        <RouteMap
                          tracking={effectiveTracking}
                          pickupStop={activeTrip.origin}
                          dropoffStop={activeTrip.destination}
                          manifest={effectiveTracking.manifest}
                          isLive={isTripLive}
                          onProgressUpdate={setSimulatedInfo}
                        />
                      )}
                    </div>

                    {/* RIGHT: DRIVER COCKPIT CONTROLS & DELAY DISPATCH */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Cockpit Card 1: Live Telemetry Gauges */}
                      <div style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        padding: '1.25rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Gauge size={16} color="#00f5a0" />
                            Live Telemetry HUD
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            color: isTripLive ? '#00f5a0' : '#94a3b8',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isTripLive ? '#00f5a0' : '#64748b' }} />
                            {isTripLive ? 'GPS Synced' : 'Ready'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                          {/* Speed Gauge */}
                          <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Current Speed</span>
                            <strong style={{ fontSize: '1.4rem', color: '#00f5a0', display: 'block', margin: '2px 0' }}>
                              {simulatedInfo?.currentSpeed || (isTripLive ? 68 : 0)} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>km/h</span>
                            </strong>
                            <small style={{ fontSize: '0.72rem', color: '#64748b' }}>Highway limit: 100 km/h</small>
                          </div>

                          {/* Approaching stop */}
                          <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                                {!isTripLive ? 'Start Terminal' : 'Approaching'}
                              </span>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: isStopRequired ? 'rgba(0, 245, 160, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                                color: isStopRequired ? '#00f5a0' : '#f87171',
                                border: `1px solid ${isStopRequired ? '#00f5a0' : '#ef4444'}`
                              }}>
                                {isStopRequired ? '🛑 STOP' : '⚡ PASS'}
                              </span>
                            </div>
                            <strong style={{ fontSize: '1.05rem', color: '#00d2ff', display: 'block', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {currentApproachingStop?.name || activeTrip.destination}
                            </strong>
                            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', gap: '6px', marginTop: '2px' }}>
                              <span style={{ color: '#00f5a0', fontWeight: 700 }}>+{approachingPickups} Pick</span>
                              <span style={{ color: '#64748b' }}>•</span>
                              <span style={{ color: '#f43f5e', fontWeight: 700 }}>-{approachingDropoffs} Drop</span>
                            </div>
                          </div>
                        </div>

                        {/* Progress & Distance */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>
                            <span>Route Progress</span>
                            <strong style={{ color: '#00f5a0' }}>{Math.round((simulatedInfo?.progress || (isTripLive ? 0.25 : 0)) * 100)}%</strong>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.round((simulatedInfo?.progress || (isTripLive ? 0.25 : 0)) * 100)}%`,
                              background: 'linear-gradient(90deg, #00f5a0, #00d2ff)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8' }}>
                            <span>Remaining: <strong>{simulatedInfo?.distanceRemainingKm ?? activeTrip.distanceKm ?? 120} km</strong></span>
                            <span>ETA: <strong>{new Date(activeTrip.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Cockpit Card 2: Delays & Delay Reasons */}
                      <div style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        padding: '1.25rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={16} color="#f59e0b" />
                            Live Delay Dispatch Station
                          </span>
                          {activeTrip.delayMinutes > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSendDelay(undefined, 0, 'Back on schedule')}
                              disabled={updating}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid #10b981',
                                color: '#10b981',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title="Reset delay to 0"
                            >
                              Clear Delay (On Time)
                            </button>
                          )}
                        </div>

                        {/* Current Delay Notice if any */}
                        {activeTrip.delayMinutes > 0 ? (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            fontSize: '0.82rem'
                          }}>
                            <strong style={{ color: '#f87171', display: 'block', marginBottom: '2px' }}>
                              ⚠️ Active Broadcast: +{activeTrip.delayMinutes} min behind timetable
                            </strong>
                            <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>
                              Reason: {trackingData?.tripTracking?.delayReason || delayReason}
                            </span>
                          </div>
                        ) : (
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            marginBottom: '1rem',
                            fontSize: '0.8rem',
                            color: '#6ee7b7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <CheckCircle size={14} />
                            <span>Trip is running strictly on schedule.</span>
                          </div>
                        )}

                        {/* Quick Delay Presets */}
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Select Delay Duration
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            {[10, 15, 25, 35, 45, 60].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setDelayMins(mins)}
                                style={{
                                  background: delayMins === mins ? 'rgba(0, 245, 160, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                                  border: delayMins === mins ? '1px solid #00f5a0' : '1px solid rgba(255, 255, 255, 0.08)',
                                  color: delayMins === mins ? '#00f5a0' : '#cbd5e1',
                                  fontWeight: 700,
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  textAlign: 'center'
                                }}
                              >
                                +{mins} min
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Delay Reason Selector & Custom */}
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Delay Reason
                          </label>
                          <select
                            value={delayReason}
                            onChange={(e) => setDelayReason(e.target.value)}
                            style={{
                              width: '100%',
                              background: 'rgba(15, 23, 42, 0.8)',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              padding: '8px 10px',
                              color: '#f8fafc',
                              fontSize: '0.82rem',
                              marginBottom: '8px'
                            }}
                          >
                            <option value="Heavy Highway Traffic Congestion">Heavy Highway Traffic Congestion</option>
                            <option value="Adverse Weather & Heavy Rain">Adverse Weather & Heavy Rain</option>
                            <option value="Toll Booth Queue Congestion">Toll Booth Queue Congestion</option>
                            <option value="Minor Engine Inspection">Minor Engine Inspection</option>
                            <option value="Passenger Boarding Hold">Passenger Boarding Hold</option>
                            <option value="Road Maintenance / Lane Closure">Road Maintenance / Lane Closure</option>
                            <option value="CUSTOM">Other (Write Custom Reason below)</option>
                          </select>

                          {delayReason === 'CUSTOM' && (
                            <input
                              type="text"
                              placeholder="Specify delay reason..."
                              value={customDelayReason}
                              onChange={(e) => setCustomDelayReason(e.target.value)}
                              style={{
                                width: '100%',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                padding: '7px 10px',
                                color: '#f8fafc',
                                fontSize: '0.82rem'
                              }}
                            />
                          )}
                        </div>

                        {/* Broadcast Delay Action Button */}
                        <button
                          type="button"
                          disabled={updating || !activeTrip}
                          onClick={() => handleSendDelay()}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#090d14',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: updating || !activeTrip ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                          }}
                        >
                          <Send size={15} />
                          <span>Broadcast Delay (+{delayMins} min)</span>
                        </button>
                      </div>

                      {/* Cockpit Card 3: Route Stops & Crew Overview */}
                      <div style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        padding: '1.25rem'
                      }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.85rem' }}>
                          <MapPin size={16} color="#00d2ff" />
                          Route Stops & Waypoints ({activeTrip.stops?.length || 0})
                        </span>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                          {(activeTrip.stops || []).map((stop, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === (activeTrip.stops?.length || 1) - 1;
                            const isPassed = simulatedInfo?.passedStopNames?.includes(stop.name);
                            const isApproaching = simulatedInfo?.approachingStop?.name === stop.name;

                            return (
                              <div
                                key={stop.id || idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  background: isApproaching ? 'rgba(0, 210, 255, 0.15)' : (isPassed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)'),
                                  border: isApproaching ? '1px solid #00d2ff' : '1px solid rgba(255, 255, 255, 0.04)',
                                  fontSize: '0.78rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: isPassed ? '#10b981' : (isApproaching ? '#00d2ff' : (isFirst || isLast ? '#00f5a0' : '#475569')),
                                    color: '#090d14',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 800
                                  }}>
                                    {isPassed ? '✓' : (idx + 1)}
                                  </div>
                                  <strong style={{ color: isPassed ? '#94a3b8' : '#f8fafc' }}>
                                    {stop.name}
                                  </strong>
                                </div>

                                <span style={{ fontSize: '0.7rem', color: isApproaching ? '#00d2ff' : '#64748b' }}>
                                  {isApproaching ? 'APPROACHING' : (isPassed ? 'Passed' : `+${stop.minutesFromDeparture || 0}m`)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Coach & Conductor Info */}
                        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#94a3b8' }}>
                          <div>
                            <span>Coach: </span>
                            <strong style={{ color: '#00f5a0' }}>{activeTrip.bus?.registration || 'Coach #101'}</strong>
                          </div>
                          <div>
                            <span>Conductor: </span>
                            <strong style={{ color: '#f8fafc' }}>{activeTrip.conductor?.name || 'Assigned'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '3rem 2rem',
                  textAlign: 'center'
                }}>
                  <Radio size={48} style={{ color: '#64748b', margin: '0 auto 16px auto' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#e2e8f0' }}>No Active Journey Selected</h3>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 1.5rem 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Select an assigned trip from your roster to engage live GPS cockpit tracking and navigation.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSection('roster')}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #00d2ff)',
                      color: '#090d14',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    View My Schedule
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: MY SCHEDULE */}
          {section === 'roster' && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#00f5a0" />
                Assigned Duty Roster ({myTrips.length})
              </h3>

              {myTrips.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {myTrips.map((trip) => {
                    const isAck = trip.driverAcknowledged;
                    const isRunning = trip.status === 'IN_TRANSIT';
                    const isDone = trip.status === 'ARRIVED';
                    return (
                      <div
                        key={trip.id}
                        style={{
                          background: isDone
                            ? 'rgba(16, 185, 129, 0.06)'
                            : isRunning
                              ? 'rgba(0, 245, 160, 0.08)'
                              : 'rgba(15, 23, 42, 0.6)',
                          border: isDone
                            ? '1px solid rgba(16, 185, 129, 0.25)'
                            : isRunning
                              ? '1px solid #00f5a0'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          opacity: isDone ? 0.75 : 1
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isDone ? '#10b981' : '#94a3b8' }}>TRIP #{trip.id}</span>
                            <span style={{
                              background: isDone
                                ? 'rgba(16, 185, 129, 0.18)'
                                : isRunning
                                  ? 'rgba(0, 245, 160, 0.15)'
                                  : 'rgba(255, 255, 255, 0.08)',
                              color: isDone ? '#34d399' : isRunning ? '#00f5a0' : '#cbd5e1',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {isDone && <Check size={11} />}
                              {isDone ? 'COMPLETED' : trip.status}
                            </span>
                            {!isDone && !isAck && (
                              <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                                CONFIRMATION NEEDED
                              </span>
                            )}
                          </div>

                          <strong style={{ fontSize: '1.1rem', color: isDone ? '#94a3b8' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {trip.origin} <ArrowRight size={14} color={isDone ? '#34d399' : '#00f5a0'} /> {trip.destination}
                          </strong>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
                            <span>Coach: {trip.bus?.registration || trip.bus?.model || 'Coach #101'}</span>
                            <span>Conductor: {trip.conductor?.name || 'Onboard Conductor'}</span>
                            <span>{isDone ? 'Arrived' : 'Departs'}: {new Date(isDone ? trip.arrival : trip.departure).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        {isDone ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            color: '#34d399',
                            fontSize: '0.78rem',
                            fontWeight: 700
                          }}>
                            <Check size={15} />
                            <span>Journey Complete</span>
                          </div>
                        ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!isAck && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(trip.id)}
                              style={{
                                background: 'linear-gradient(135deg, #00f5a0, #00b4d8)',
                                color: '#090d14',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                padding: '8px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Check size={14} />
                              <span>Confirm Duty</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTripId(trip.id);
                              setSection('live-map');
                            }}
                            style={{
                              background: 'rgba(0, 245, 160, 0.1)',
                              border: '1px solid rgba(0, 245, 160, 0.35)',
                              color: '#00f5a0',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Radio size={13} />
                            <span>Live Map</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTripId(trip.id);
                              setSection('current');
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid #334155',
                              color: '#cbd5e1',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Open Controls
                          </button>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <Calendar size={32} style={{ opacity: 0.4, margin: '0 auto 8px auto' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No trips currently on your duty schedule.</p>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: REPORT DELAY */}
          {section === 'delay' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '1.75rem'
              }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="#00f5a0" />
                  Broadcast Traffic Delay
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: 0, marginBottom: '1.5rem' }}>
                  Inform operations dispatch and waiting passengers along the route corridor of any unexpected delays.
                </p>

                <form onSubmit={handleSendDelay}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                      Estimated Delay Duration
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[10, 15, 25, 35, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setDelayMins(mins)}
                          style={{
                            background: delayMins === mins ? 'rgba(0, 245, 160, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                            border: delayMins === mins ? '1px solid #00f5a0' : '1px solid #334155',
                            color: delayMins === mins ? '#00f5a0' : '#cbd5e1',
                            fontWeight: 700,
                            padding: '8px 14px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          +{mins} min
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                      Reason for Delay
                    </label>
                    <select
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#f8fafc',
                        fontSize: '0.88rem'
                      }}
                    >
                      <option value="Heavy Highway Traffic Congestion">Heavy Highway Traffic Congestion</option>
                      <option value="Adverse Weather & Heavy Rain">Adverse Weather & Heavy Rain</option>
                      <option value="Toll Booth Queue Congestion">Toll Booth Queue Congestion</option>
                      <option value="Minor Engine Inspection">Minor Engine Inspection</option>
                      <option value="Passenger Boarding Hold">Passenger Boarding Hold</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={updating || !activeTrip}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00f5a0, #00b4d8)',
                      color: '#090d14',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: updating || !activeTrip ? 'not-allowed' : 'pointer',
                      opacity: updating || !activeTrip ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Send size={16} />
                    <span>Broadcast Delay to Dispatch & Live Trackers</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 4: REPORT DEFECT */}
          {section === 'defect' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '1.75rem',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={20} color="#f87171" />
                  Report Vehicle Defect
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: 0, marginBottom: '1.5rem' }}>
                  Notify fleet workshop & mechanical dispatch of coach defects or maintenance needs.
                </p>

                <form onSubmit={handleReportDefect}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Defect Type
                      </label>
                      <select
                        value={defectCategory}
                        onChange={(e) => setDefectCategory(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '9px 12px',
                          color: '#f8fafc',
                          fontSize: '0.85rem'
                        }}
                      >
                        <option value="MECHANICAL">Mechanical (Brakes/Engine)</option>
                        <option value="ELECTRICAL">Electrical / Lighting</option>
                        <option value="HVAC">Air Conditioning (HVAC)</option>
                        <option value="TIRE">Tire Pressure / Tread</option>
                        <option value="BODY">Interior / Seats / Doors</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Severity
                      </label>
                      <select
                        value={defectSeverity}
                        onChange={(e) => setDefectSeverity(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '9px 12px',
                          color: '#f8fafc',
                          fontSize: '0.85rem'
                        }}
                      >
                        <option value="LOW">Low (Driveable)</option>
                        <option value="MEDIUM">Medium (Service Soon)</option>
                        <option value="HIGH">High (Immediate Action)</option>
                        <option value="CRITICAL">Critical (Stop Vehicle)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Defect Description *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describe what you observed (e.g., AC cooling low in passenger cabin, brake squeal at high speed)..."
                      value={defectDescription}
                      onChange={(e) => setDefectDescription(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updating}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      padding: '11px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: updating ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Send size={16} />
                    <span>Submit Report to Maintenance Dispatch</span>
                  </button>
                </form>
              </div>

              {/* Recent Incident Log */}
              {(incidents || []).length > 0 && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                    Recent Vehicle Incident Log
                  </span>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(incidents || []).slice(0, 4).map((inc) => (
                      <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.8rem' }}>
                        <div>
                          <strong style={{ color: '#f8fafc' }}>{inc.type}</strong>
                          <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{inc.description}</span>
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: inc.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: inc.status === 'RESOLVED' ? '#10b981' : '#f87171'
                        }}>
                          {inc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DriverPortal;
