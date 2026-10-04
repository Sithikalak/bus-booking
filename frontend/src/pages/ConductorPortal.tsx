import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApi, api } from '../api/client';
import { RoleLoginCard } from '../components/RoleLoginCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Trip, Booking, StaffMember } from '../types';
import {
  QrCode,
  Users,
  Ticket,
  BusFront,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  Clock,
  RefreshCw,
  LogOut,
  Globe,
  ArrowRight,
  Check,
  XCircle,
  Plus,
  DollarSign,
  ShieldCheck,
  User,
  ChevronRight,
  Home,
  ScanLine,
  Camera,
  CameraOff,
  MapPin,
  Phone,
  Armchair
} from 'lucide-react';

export function ConductorPortal() {
  const { user, logout } = useApp();
  const [section, setSection] = useState<'verify' | 'manifest' | 'issue' | 'schedule' | 'scan-qr'>('scan-qr');

  // Load trips & staff availability
  const { data: tripsPage, reload: reloadTrips } = useApi<{ items: Trip[] }>('/schedules?size=100', 8000);
  const { data: staffList, reload: reloadStaff } = useApi<StaffMember[]>('/staff', 8000);

  const myStaffRecord = staffList?.find((s) => s.id === user?.id || s.email?.toLowerCase() === user?.email?.toLowerCase());
  const [conductorOnlineOverride, setConductorOnlineOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (myStaffRecord && typeof myStaffRecord.available === 'boolean') {
      setConductorOnlineOverride(myStaffRecord.available);
    }
  }, [myStaffRecord?.available]);

  const isConductorOnline = conductorOnlineOverride !== null
    ? conductorOnlineOverride
    : (myStaffRecord ? myStaffRecord.available : true);

  const [togglingOnline, setTogglingOnline] = useState(false);

  const toggleOnlineStatus = async () => {
    if (!user) return;
    const nextStatus = !isConductorOnline;
    // Immediate optimistic state flip so user sees instant reaction on click
    setConductorOnlineOverride(nextStatus);
    setTogglingOnline(true);
    try {
      const targetId = myStaffRecord?.id || user.id;
      const res: any = await api.put(`/staff/${targetId}`, {
        available: nextStatus,
        licenseNumber: myStaffRecord?.licenseNumber || 'LK-CND'
      });
      if (res && typeof res.available === 'boolean') {
        setConductorOnlineOverride(res.available);
      }
      flashSuccess(`Duty status switched to ${nextStatus ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)'}. ${nextStatus ? 'Assigned schedules are now live for passenger booking.' : 'Assigned schedules are now hidden from passenger search.'}`);
      reloadStaff();
      reloadTrips();
    } catch (err: any) {
      // Revert if API failed
      setConductorOnlineOverride(!nextStatus);
      flashError(err.message || 'Failed to toggle online status');
    } finally {
      setTogglingOnline(false);
    }
  };

  // Status feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Verification state
  const [verifyRef, setVerifyRef] = useState('');
  const [verifiedBooking, setVerifiedBooking] = useState<Booking | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // QR Scanner state
  const [qrScanning, setQrScanning] = useState(false);
  const [qrResult, setQrResult] = useState<Booking | null>(null);
  const [qrError, setQrError] = useState<{ code: string; message: string } | null>(null);
  const [qrManual, setQrManual] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const qrDivRef = useRef<HTMLDivElement>(null);
  const qrScannerRef = useRef<any>(null);

  // Manifest search & filter
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestFilter, setManifestFilter] = useState<'ALL' | 'PENDING' | 'BOARDED'>('ALL');

  // Selected trip ID (if multiple assigned)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  // Walk-in Ticket Form
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('+94');
  const [walkinSeat, setWalkinSeat] = useState('1A');
  const [walkinAmount, setWalkinAmount] = useState<number>(1850);

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

  if (!user || user.role !== 'CONDUCTOR') {
    return (
      <RoleLoginCard
        role="CONDUCTOR"
        roleTitle="Conductor Portal"
        description="Verify passenger QR tickets, manage live passenger boarding check-ins, issue on-board cash tickets, and view passenger manifests."
        demoEmail="conductor@citylink.com"
        badgeColor="#00d2ff"
      />
    );
  }

  // Filter trips for this conductor
  const myTrips = (tripsPage?.items || []).filter(
    (t) => !user.id || t.conductor?.id === user.id || t.conductor?.name?.toLowerCase().includes(user.firstName.toLowerCase())
  );

  const pendingDutyTrip = myTrips.find((t) => !t.conductorAcknowledged && t.status !== 'CANCELLED');

  // Selected or active trip — ARRIVED trips are done and must never be shown as active
  const nonArrivedTrips = myTrips.filter((t) => t.status !== 'ARRIVED');
  const activeTrip: Trip | undefined =
    (selectedTripId ? myTrips.find((t) => t.id === selectedTripId && t.status !== 'ARRIVED') : null) ||
    nonArrivedTrips.find((t) => t.status === 'BOARDING') ||
    nonArrivedTrips.find((t) => t.status === 'IN_TRANSIT') ||
    nonArrivedTrips.find((t) => t.status === 'PUBLISHED' || t.status === 'CONFIRMED') ||
    nonArrivedTrips[0];

  // Manifest hook for the active trip
  const { data: manifest, reload: reloadManifest } = useApi<Booking[]>(
    activeTrip ? `/trips/${activeTrip.id}/manifest` : null,
    5000
  );

  const handleRefresh = () => {
    setRefreshing(true);
    reloadTrips();
    if (reloadManifest) reloadManifest();
    setTimeout(() => setRefreshing(false), 700);
  };

  // Duty acknowledgment
  const handleAcknowledge = async (tripId: number) => {
    try {
      await api.post(`/trips/${tripId}/acknowledge`, {});
      flashSuccess(`Duty confirmed for Trip #${tripId}. Ready for passenger boarding!`);
      reloadTrips();
    } catch (err: any) {
      flashError(err.message || 'Failed to confirm duty assignment');
    }
  };

  // Verify ticket
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verifyRef.trim()) return;
    setLoading(true);
    setVerifyError(null);
    setVerifiedBooking(null);
    try {
      const res = await api.get<Booking>(`/bookings/verify?reference=${encodeURIComponent(verifyRef.trim().toUpperCase())}`);
      setVerifiedBooking(res);
    } catch (err: any) {
      setVerifyError(err.message || 'Ticket reference not found. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Update boarding status
  const handleUpdateBoarding = async (bookingId: number, status: string) => {
    setLoading(true);
    try {
      await api.put(`/bookings/${bookingId}/board`, { status });
      flashSuccess(`Passenger status updated to ${status}.`);
      if (verifiedBooking && verifiedBooking.id === bookingId) {
        setVerifiedBooking({ ...verifiedBooking, status });
      }
      if (reloadManifest) reloadManifest();
    } catch (err: any) {
      flashError(err.message || 'Failed to update boarding status');
    } finally {
      setLoading(false);
    }
  };

  // Issue walk-in ticket
  const handleIssueWalkinTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) {
      flashError('No active trip selected to issue a ticket for.');
      return;
    }
    if (!walkinName.trim()) {
      flashError('Please enter passenger full name.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<Booking>(`/trips/${activeTrip.id}/onboard-ticket`, {
        passengerName: walkinName.trim(),
        passengerPhone: walkinPhone.trim(),
        seatNumber: walkinSeat.trim().toUpperCase(),
        paymentMethod: 'CASH',
        amount: walkinAmount || activeTrip.fare || 1850
      });
      flashSuccess(`Walk-in Ticket #${res.reference || 'ISSUED'} created for ${walkinName} (Seat ${walkinSeat}).`);
      setWalkinName('');
      setWalkinPhone('+94');
      if (reloadManifest) reloadManifest();
      setSection('manifest');
    } catch (err: any) {
      flashError(err.message || 'Failed to issue ticket');
    } finally {
      setLoading(false);
    }
  };

  // Manifest filtering & counts
  const manifestItems = manifest || [];
  const boardedCount = manifestItems.filter((b) => b.status === 'BOARDED').length;
  const totalBooked = manifestItems.length;
  const pendingCount = totalBooked - boardedCount;

  const filteredManifest = manifestItems.filter((b) => {
    const matchesFilter =
      manifestFilter === 'ALL' ||
      (manifestFilter === 'BOARDED' && b.status === 'BOARDED') ||
      (manifestFilter === 'PENDING' && b.status !== 'BOARDED');
    const q = manifestSearch.toLowerCase();
    const matchesSearch =
      !q ||
      b.reference.toLowerCase().includes(q) ||
      (b.seat || b.seatNumber || '').toLowerCase().includes(q) ||
      (b.passengerName || '').toLowerCase().includes(q) ||
      (b.passengerPhone || '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // QR Scanner functions
  const submitQrCode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setQrLoading(true);
    setQrResult(null);
    setQrError(null);
    try {
      const res = await api.post<Booking>('/bookings/scan-qr', { qr: code });
      setQrResult(res);
      if (reloadManifest) reloadManifest();
    } catch (err: any) {
      setQrError({ code: err.code || 'ERROR', message: err.message || 'Failed to scan QR code.' });
    } finally {
      setQrLoading(false);
    }
  };

  const startQrCamera = async () => {
    setQrResult(null);
    setQrError(null);
    setQrScanning(true);
    // Small delay to ensure DOM element is rendered
    await new Promise(r => setTimeout(r, 150));
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (qrScannerRef.current) {
        try { await qrScannerRef.current.stop(); } catch {}
      }
      const scanner = new Html5Qrcode('qr-reader');
      qrScannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText: string) => {
          await scanner.stop().catch(() => {});
          setQrScanning(false);
          await submitQrCode(decodedText);
        },
        () => {} // ignore scan errors
      );
    } catch (err: any) {
      setQrScanning(false);
      setQrError({ code: 'CAMERA_ERROR', message: 'Camera not available or permission denied. Use manual input below.' });
    }
  };

  const stopQrCamera = async () => {
    if (qrScannerRef.current) {
      try { await qrScannerRef.current.stop(); } catch {}
      qrScannerRef.current = null;
    }
    setQrScanning(false);
  };

  const resetQrScan = () => {
    stopQrCamera();
    setQrResult(null);
    setQrError(null);
    setQrManual('');
  };

  return (
    <div className="capital-layout">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="capital-sidebar">
        {/* Brand */}
        <div className="capital-brand">
          <div className="capital-brand-icon" style={{ background: 'linear-gradient(135deg, #00d2ff, #0284c7)' }}>
            <Ticket size={18} color="#090d14" />
          </div>
          <div className="capital-brand-text">
            <span>Conductor Portal</span>
            <small style={{ color: '#00d2ff' }}>Passenger Check-in</small>
          </div>
          <Link to="/" style={{ marginLeft: 'auto', color: '#64748b' }} title="Public Site">
            <Home size={15} />
          </Link>
        </div>

        {/* Navigation Group 1: PASSENGER OPS */}
        <div className="capital-nav-group">
          <span className="capital-nav-title">PASSENGER OPS</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'scan-qr' ? 'active' : ''}`}
            onClick={() => { resetQrScan(); setSection('scan-qr'); }}
          >
            <ScanLine size={16} />
            <span>QR Scan &amp; Board</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'verify' ? 'active' : ''}`}
            onClick={() => setSection('verify')}
          >
            <QrCode size={16} />
            <span>Ticket Verifier</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'manifest' ? 'active' : ''}`}
            onClick={() => setSection('manifest')}
          >
            <Users size={16} />
            <span>Passenger Manifest</span>
            <span className="capital-nav-badge">{totalBooked}</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'issue' ? 'active' : ''}`}
            onClick={() => setSection('issue')}
          >
            <Plus size={16} />
            <span>Issue Cash Ticket</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
        </div>

        {/* Navigation Group 2: SCHEDULE */}
        <div className="capital-nav-group">
          <span className="capital-nav-title">SCHEDULE</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'schedule' ? 'active' : ''}`}
            onClick={() => setSection('schedule')}
          >
            <Calendar size={16} />
            <span>My Schedule</span>
            <span className="capital-nav-badge">{myTrips.length}</span>
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
              <div className="capital-user-avatar" style={{ background: 'linear-gradient(135deg, #00d2ff, #0284c7)', color: '#090d14', fontWeight: 800 }}>
                {user.firstName ? user.firstName[0] : 'C'}{user.lastName ? user.lastName[0] : ''}
              </div>
              <div
                className="capital-user-meta"
                onClick={toggleOnlineStatus}
                style={{ cursor: 'pointer' }}
                title="Click to toggle Online/Offline duty status"
              >
                <strong>{user.firstName} {user.lastName}</strong>
                <small style={{ color: isConductorOnline ? '#00d2ff' : '#ef4444', fontWeight: 600 }}>
                  CONDUCTOR ({isConductorOnline ? 'ONLINE' : 'OFFLINE'})
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
              {section === 'scan-qr' && 'QR Scan & Boarding'}
              {section === 'verify' && 'Ticket Scanner & Verification'}
              {section === 'manifest' && 'Passenger Manifest & Boarding'}
              {section === 'issue' && 'Issue On-Board Walk-in Ticket'}
              {section === 'schedule' && 'My Duty Schedule'}
            </h1>
            <p>
              <span className="capital-status-dot" style={{ background: '#00d2ff', boxShadow: '0 0 8px #00d2ff' }} />
              <span>Officer {user.firstName} {user.lastName} • Conductor ID LK-CND-{user.id || '004'}</span>
            </p>
          </div>

          <div className="capital-header-controls">
            {/* Online / Offline Toggle Pill */}
            <button
              type="button"
              onClick={toggleOnlineStatus}
              disabled={togglingOnline}
              title={isConductorOnline ? 'Click to switch to OFFLINE (off duty)' : 'Click to switch to ONLINE (on duty)'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '24px',
                border: isConductorOnline ? '1.5px solid #10b981' : '1.5px solid #ef4444',
                background: isConductorOnline ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.16)',
                color: isConductorOnline ? '#10b981' : '#f87171',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: isConductorOnline ? '0 0 14px rgba(16, 185, 129, 0.25)' : '0 0 14px rgba(239, 68, 68, 0.25)',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: isConductorOnline ? '#10b981' : '#ef4444',
                  boxShadow: isConductorOnline ? '0 0 10px #10b981' : '0 0 10px #ef4444',
                  transition: 'all 0.25s ease',
                }}
              />
              <span>{togglingOnline ? 'Updating...' : (isConductorOnline ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)')}</span>
            </button>

            <button
              type="button"
              className={`capital-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh manifest & trip data"
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
          {!isConductorOnline && (
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
                  Your assigned schedules are hidden from passenger searches and booking. Switch to ONLINE when you are ready on duty.
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

          {/* Flash Alerts */}
          {actionSuccess && (
            <div style={{
              background: 'rgba(0, 210, 255, 0.12)',
              border: '1px solid #00d2ff',
              color: '#00d2ff',
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
                  <Ticket size={22} />
                </div>
                <div>
                  <strong style={{ color: '#f59e0b', fontSize: '1rem', display: 'block' }}>
                    Duty Assignment Confirmation Required
                  </strong>
                  <span style={{ fontSize: '0.86rem', color: '#e2e8f0' }}>
                    You are assigned as Conductor for <strong>Trip #{pendingDutyTrip.id}</strong>: {pendingDutyTrip.origin} ➔ {pendingDutyTrip.destination} (Departure: {new Date(pendingDutyTrip.departure).toLocaleDateString()} at {new Date(pendingDutyTrip.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAcknowledge(pendingDutyTrip.id)}
                style={{
                  background: 'linear-gradient(135deg, #00d2ff, #0284c7)',
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
                <span>Confirm Duty Assignment</span>
              </button>
            </div>
          )}

          {/* Active Trip Hero Banner */}
          {activeTrip ? (
            <div style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Active Duty • Trip #{activeTrip.id}
                  </span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{activeTrip.origin}</span>
                    <ArrowRight size={20} color="#00d2ff" />
                    <span>{activeTrip.destination}</span>
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <BusFront size={14} color="#00d2ff" />
                      <strong>{activeTrip.bus?.registration || activeTrip.bus?.model || 'Coach #101'}</strong>
                      <span style={{ color: '#64748b' }}>({activeTrip.bus?.type || 'Super Luxury'})</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <User size={14} color="#00d2ff" />
                      Captain: <strong>{activeTrip.driver?.name || 'Assigned Driver'}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={14} color="#00d2ff" />
                      Departs: {new Date(activeTrip.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Boarding Badge / Progress Pill */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  minWidth: '200px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>BOARDING STATUS</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#00d2ff' }}>
                      {boardedCount} / {totalBooked} Boarded
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${totalBooked > 0 ? Math.round((boardedCount / totalBooked) * 100) : 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #00d2ff, #0284c7)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
                    <span>{pendingCount} Pending Check-in</span>
                    <span>{totalBooked > 0 ? Math.round((boardedCount / totalBooked) * 100) : 0}% Complete</span>
                  </div>
                </div>
              </div>

              {/* Quick Trip Switcher if conductor has more than 1 trip */}
              {myTrips.length > 1 && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Switch assigned trip:</span>
                  {myTrips.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTripId(t.id)}
                      style={{
                        background: t.id === activeTrip.id ? 'rgba(0, 210, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                        border: t.id === activeTrip.id ? '1px solid #00d2ff' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: t.id === activeTrip.id ? '#00d2ff' : '#cbd5e1',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Trip #{t.id} ({t.origin} ➔ {t.destination})
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '2.5rem',
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              <BusFront size={40} style={{ color: '#64748b', margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: '#e2e8f0' }}>No Active Trips Assigned</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                You currently have no scheduled trips. New dispatch assignments will appear here automatically.
              </p>
            </div>
          )}

          {/* TAB 1: TICKET VERIFIER */}
          {section === 'verify' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* Left: Input Form */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={18} color="#00d2ff" />
                  Scan or Enter Ticket Reference
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: 0, marginBottom: '1.25rem' }}>
                  Enter the booking code or passenger reference (e.g. <code>CL-2026-XXXX</code>) from the passenger’s e-ticket or mobile pass.
                </p>

                <form onSubmit={handleVerify}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="e.g. CL-2026-0042"
                      value={verifyRef}
                      onChange={(e) => setVerifyRef(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#f8fafc',
                        fontSize: '1rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={loading || !verifyRef.trim()}
                      style={{
                        background: 'linear-gradient(135deg, #00d2ff, #0284c7)',
                        color: '#090d14',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        cursor: loading || !verifyRef.trim() ? 'not-allowed' : 'pointer',
                        opacity: loading || !verifyRef.trim() ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Search size={16} />
                      <span>Verify</span>
                    </button>
                  </div>
                </form>

                {/* Quick sample chips from manifest if available */}
                {manifestItems.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      Quick-pick booked tickets on this trip:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {manifestItems.slice(0, 6).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setVerifyRef(b.reference);
                            setVerifiedBooking(b);
                            setVerifyError(null);
                          }}
                          style={{
                            background: b.status === 'BOARDED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                            border: b.status === 'BOARDED' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #334155',
                            color: b.status === 'BOARDED' ? '#34d399' : '#cbd5e1',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            cursor: 'pointer'
                          }}
                        >
                          {b.reference} (Seat {b.seat || b.seatNumber})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Verification Result */}
              <div>
                {verifyError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid #ef4444',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    textAlign: 'center'
                  }}>
                    <XCircle size={36} color="#ef4444" style={{ margin: '0 auto 10px auto' }} />
                    <h4 style={{ color: '#ef4444', margin: '0 0 6px 0', fontSize: '1.05rem' }}>Ticket Not Found</h4>
                    <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: 0 }}>{verifyError}</p>
                  </div>
                )}

                {verifiedBooking && (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: verifiedBooking.status === 'BOARDED' ? '1px solid #10b981' : '1px solid #00d2ff',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={20} color={verifiedBooking.status === 'BOARDED' ? '#10b981' : '#00d2ff'} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.06em', color: verifiedBooking.status === 'BOARDED' ? '#10b981' : '#00d2ff' }}>
                          {verifiedBooking.status === 'BOARDED' ? 'PASSENGER ALREADY BOARDED' : 'VALID TICKET DETECTED'}
                        </span>
                      </div>
                      <span style={{
                        background: verifiedBooking.status === 'BOARDED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: verifiedBooking.status === 'BOARDED' ? '#34d399' : '#fbbf24',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 800
                      }}>
                        {verifiedBooking.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Passenger Name</span>
                        <strong style={{ display: 'block', fontSize: '1.05rem', color: '#f8fafc', marginTop: '2px' }}>
                          {verifiedBooking.passengerName || 'Passenger'}
                        </strong>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Seat Allocated</span>
                        <strong style={{ display: 'block', fontSize: '1.2rem', color: '#00d2ff', marginTop: '2px' }}>
                          {verifiedBooking.seat || verifiedBooking.seatNumber || 'Unassigned'}
                        </strong>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Ticket Reference</span>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600, marginTop: '2px' }}>
                          {verifiedBooking.reference}
                        </span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Contact Phone</span>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginTop: '2px' }}>
                          {verifiedBooking.passengerPhone || 'N/A'}
                        </span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Fare Paid</span>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: '#34d399', fontWeight: 700, marginTop: '2px' }}>
                          Rs. {(verifiedBooking.totalAmount || 1850).toLocaleString()}
                        </span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Boarding Stop</span>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginTop: '2px' }}>
                          {verifiedBooking.pickupStop || activeTrip?.origin || 'Origin Terminal'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {verifiedBooking.status !== 'BOARDED' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateBoarding(verifiedBooking.id, 'BOARDED')}
                          disabled={loading}
                          style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          <Check size={18} />
                          <span>Confirm & Board Passenger</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateBoarding(verifiedBooking.id, 'CONFIRMED')}
                          disabled={loading}
                          style={{
                            flex: 1,
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#f87171',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            padding: '10px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          Undo Boarding (Set to Confirmed)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!verifyError && !verifiedBooking && (
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.3)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                    borderRadius: '14px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    color: '#64748b'
                  }}>
                    <QrCode size={40} style={{ opacity: 0.35, margin: '0 auto 10px auto' }} />
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>
                      Awaiting ticket verification. Search a reference code to see passenger boarding details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PASSENGER MANIFEST */}
          {section === 'manifest' && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#00d2ff" />
                    Passenger Manifest
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    Trip #{activeTrip?.id || '—'}: {boardedCount} Boarded • {pendingCount} Pending • {totalBooked} Total Booked
                  </span>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['ALL', 'PENDING', 'BOARDED'] as const).map((filterMode) => (
                    <button
                      key={filterMode}
                      type="button"
                      onClick={() => setManifestFilter(filterMode)}
                      style={{
                        background: manifestFilter === filterMode ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: manifestFilter === filterMode ? '1px solid #00d2ff' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: manifestFilter === filterMode ? '#00d2ff' : '#cbd5e1',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {filterMode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search by passenger name, seat number (e.g. 4A), or reference..."
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '9px 12px 9px 36px',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Passenger List */}
              {filteredManifest.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 12px' }}>Seat</th>
                        <th style={{ padding: '8px 12px' }}>Passenger</th>
                        <th style={{ padding: '8px 12px' }}>Reference</th>
                        <th style={{ padding: '8px 12px' }}>Phone</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Boarding Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredManifest.map((b) => {
                        const isBoarded = b.status === 'BOARDED';
                        return (
                          <tr key={b.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                background: 'rgba(0, 210, 255, 0.15)',
                                color: '#00d2ff',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.82rem'
                              }}>
                                {b.seat || b.seatNumber || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f8fafc' }}>
                              {b.passengerName || 'Passenger'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                              {b.reference}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                              {b.passengerPhone || '—'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                background: isBoarded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: isBoarded ? '#34d399' : '#fbbf24',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}>
                                {isBoarded ? 'BOARDED' : 'PENDING'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              {!isBoarded ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBoarding(b.id, 'BOARDED')}
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '5px 12px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Check size={13} />
                                  <span>Check In</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBoarding(b.id, 'CONFIRMED')}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#94a3b8',
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                  title="Undo check-in"
                                >
                                  Boarded ✓
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <Users size={32} style={{ opacity: 0.4, margin: '0 auto 8px auto' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    {manifestSearch ? 'No passengers match your search.' : 'No passenger bookings found on this trip.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ISSUE CASH TICKET */}
          {section === 'issue' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '1.75rem'
              }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={20} color="#00d2ff" />
                  Issue On-Board Walk-in Ticket
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginTop: 0, marginBottom: '1.5rem' }}>
                  Create a quick ticket for walk-in passengers paying cash at the coach door.
                </p>

                <form onSubmit={handleIssueWalkinTicket}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Passenger Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kasun Perera"
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#f8fafc',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="+94 77 123 4567"
                        value={walkinPhone}
                        onChange={(e) => setWalkinPhone(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          color: '#f8fafc',
                          fontSize: '0.88rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Seat Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 5A"
                        value={walkinSeat}
                        onChange={(e) => setWalkinSeat(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          color: '#f8fafc',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                      Cash Amount (LKR)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.88rem', fontWeight: 700 }}>
                        Rs.
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={walkinAmount}
                        onChange={(e) => setWalkinAmount(Number(e.target.value))}
                        style={{
                          width: '100%',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '10px 12px 10px 42px',
                          color: '#f8fafc',
                          fontSize: '0.95rem',
                          fontWeight: 700
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !activeTrip}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00d2ff, #0284c7)',
                      color: '#090d14',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: loading || !activeTrip ? 'not-allowed' : 'pointer',
                      opacity: loading || !activeTrip ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Ticket size={18} />
                    <span>Issue Walk-in Ticket & Mark Boarded</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: QR SCAN & BOARDING */}
          {section === 'scan-qr' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              {/* Scanner Card */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(0, 210, 255, 0.2)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                  <ScanLine size={22} color="#00d2ff" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>QR Scan & Board</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Scan passenger QR code to verify & mark as boarded instantly</p>
                  </div>
                </div>

                {/* Camera viewfinder */}
                {qrScanning && (
                  <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <div
                      id="qr-reader"
                      ref={qrDivRef}
                      style={{
                        width: '100%',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '2px solid #00d2ff',
                        boxShadow: '0 0 20px rgba(0,210,255,0.3)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={stopQrCamera}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(15,23,42,0.85)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <CameraOff size={13} /> Stop Camera
                    </button>
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(15,23,42,0.85)',
                      color: '#00d2ff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '5px 14px',
                      borderRadius: '20px',
                      letterSpacing: '0.04em'
                    }}>
                      Point camera at passenger QR code
                    </div>
                  </div>
                )}

                {/* Start camera button */}
                {!qrScanning && !qrResult && (
                  <button
                    type="button"
                    onClick={startQrCamera}
                    disabled={qrLoading}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, rgba(0,210,255,0.15), rgba(2,132,199,0.15))',
                      border: '2px dashed rgba(0,210,255,0.4)',
                      color: '#00d2ff',
                      borderRadius: '12px',
                      padding: '2rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '1rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Camera size={36} />
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Open Camera Scanner</span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>Tap to activate your device camera and scan a passenger's QR code</span>
                  </button>
                )}

                {/* Manual input fallback */}
                <form onSubmit={(e) => { e.preventDefault(); submitQrCode(qrManual); }} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={qrManual}
                    onChange={(e) => setQrManual(e.target.value.toUpperCase())}
                    placeholder="Or type reference: CLX-XXXX-XXXXXXXX"
                    style={{
                      flex: 1,
                      background: 'rgba(15,23,42,0.7)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#f8fafc',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '0.88rem',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={qrLoading || !qrManual.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #00d2ff, #0284c7)',
                      color: '#090d14',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: qrLoading || !qrManual.trim() ? 'not-allowed' : 'pointer',
                      opacity: qrLoading || !qrManual.trim() ? 0.6 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {qrLoading ? 'Scanning...' : 'Check In'}
                  </button>
                </form>
              </div>

              {/* Loading state */}
              {qrLoading && (
                <div style={{
                  background: 'rgba(0,210,255,0.08)',
                  border: '1px solid rgba(0,210,255,0.25)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#00d2ff'
                }}>
                  <ScanLine size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.8 }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Verifying ticket...</p>
                </div>
              )}

              {/* ✅ SUCCESS — Passenger boarded */}
              {!qrLoading && qrResult && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(0,245,160,0.08))',
                  border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: 'rgba(16,185,129,0.2)',
                      border: '1px solid #10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#34d399', flexShrink: 0
                    }}>
                      <Check size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.06em' }}>✓ BOARDED SUCCESSFULLY</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{qrResult.passengerName}</div>
                    </div>
                    <div style={{
                      marginLeft: 'auto',
                      background: 'rgba(16,185,129,0.2)',
                      border: '1px solid rgba(16,185,129,0.4)',
                      color: '#34d399',
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px'
                    }}>
                      {qrResult.reference}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                    {[
                      { icon: <Armchair size={15} />, label: 'Seat', value: qrResult.seat || qrResult.seatNumber || '—' },
                      { icon: <Phone size={15} />, label: 'Phone', value: qrResult.passengerPhone || '—' },
                      { icon: <MapPin size={15} color="#00f5a0" />, label: 'Pickup Stop', value: qrResult.pickupStop || qrResult.origin || '—' },
                      { icon: <MapPin size={15} color="#f87171" />, label: 'Drop-off Stop', value: qrResult.dropoffStop || qrResult.destination || '—' },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{
                        background: 'rgba(15,23,42,0.5)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '10px',
                        padding: '10px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, marginBottom: '3px' }}>
                          {icon} {label.toUpperCase()}
                        </div>
                        <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trip info */}
                  <div style={{
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '1rem'
                  }}>
                    <BusFront size={15} color="#00d2ff" />
                    <span>Trip #{qrResult.tripId} • {qrResult.origin} → {qrResult.destination} • {qrResult.bus || 'Coach'}</span>
                  </div>

                  {/* Scan next button */}
                  <button
                    type="button"
                    onClick={resetQrScan}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00d2ff, #0284c7)',
                      color: '#090d14',
                      fontWeight: 800,
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <ScanLine size={16} /> Scan Next Passenger
                  </button>
                </div>
              )}

              {/* ❌ ERROR state */}
              {!qrLoading && qrError && (
                <div style={{
                  background: qrError.code === 'ALREADY_BOARDED'
                    ? 'rgba(245,158,11,0.1)'
                    : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${qrError.code === 'ALREADY_BOARDED' ? 'rgba(245,158,11,0.5)' : '#ef4444'}`,
                  borderRadius: '14px',
                  padding: '1.25rem 1.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '1rem' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: qrError.code === 'ALREADY_BOARDED' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                      border: `1px solid ${qrError.code === 'ALREADY_BOARDED' ? '#f59e0b' : '#ef4444'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: qrError.code === 'ALREADY_BOARDED' ? '#f59e0b' : '#f87171',
                      flexShrink: 0
                    }}>
                      {qrError.code === 'ALREADY_BOARDED' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '0.72rem', fontWeight: 800,
                        color: qrError.code === 'ALREADY_BOARDED' ? '#f59e0b' : '#f87171',
                        letterSpacing: '0.06em', marginBottom: '3px'
                      }}>
                        {qrError.code === 'ALREADY_BOARDED' ? '⚠ ALREADY BOARDED' : '✗ ' + qrError.code}
                      </div>
                      <div style={{ color: '#e2e8f0', fontSize: '0.88rem', fontWeight: 600 }}>{qrError.message}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetQrScan}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: `1px solid ${qrError.code === 'ALREADY_BOARDED' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      color: qrError.code === 'ALREADY_BOARDED' ? '#f59e0b' : '#f87171',
                      borderRadius: '8px',
                      padding: '9px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px'
                    }}
                  >
                    <ScanLine size={15} /> Scan Another
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY SCHEDULE */}
          {section === 'schedule' && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#00d2ff" />
                Assigned Duty Roster ({myTrips.length})
              </h3>

              {myTrips.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {myTrips.map((trip) => {
                    const isCurrent = activeTrip?.id === trip.id;
                    const isAck = trip.conductorAcknowledged;
                    const isDone = trip.status === 'ARRIVED';
                    return (
                      <div
                        key={trip.id}
                        style={{
                          background: isDone
                            ? 'rgba(16, 185, 129, 0.06)'
                            : isCurrent
                              ? 'rgba(0, 210, 255, 0.08)'
                              : 'rgba(15, 23, 42, 0.6)',
                          border: isDone
                            ? '1px solid rgba(16, 185, 129, 0.25)'
                            : isCurrent
                              ? '1px solid #00d2ff'
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
                                : trip.status === 'IN_TRANSIT'
                                  ? 'rgba(0, 245, 160, 0.15)'
                                  : 'rgba(255, 255, 255, 0.08)',
                              color: isDone ? '#34d399' : trip.status === 'IN_TRANSIT' ? '#00f5a0' : '#cbd5e1',
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
                            {trip.origin} <ArrowRight size={14} color={isDone ? '#34d399' : '#00d2ff'} /> {trip.destination}
                          </strong>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>
                            <span>Coach: {trip.bus?.registration || trip.bus?.model || 'Coach #101'}</span>
                            <span>Captain: {trip.driver?.name || 'Assigned Driver'}</span>
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
                                background: 'linear-gradient(135deg, #00d2ff, #0284c7)',
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
                              setSection('manifest');
                            }}
                            style={{
                              background: isCurrent ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
                              border: '1px solid #334155',
                              color: isCurrent ? '#00d2ff' : '#cbd5e1',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {isCurrent ? 'Active Manifest' : 'View Manifest'}
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
        </div>
      </main>
    </div>
  );
}

export default ConductorPortal;
