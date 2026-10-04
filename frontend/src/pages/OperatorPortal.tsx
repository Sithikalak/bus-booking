import { useState, useId, lazy, Suspense, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApi, api } from '../api/client';
import { RoleLoginCard } from '../components/RoleLoginCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { RouteBuilderMap } from '../components/RouteBuilderMap';
import { SearchableSelect } from '../components/SearchableSelect';
import { RouteImageUploader } from '../components/RouteImageUploader';
import { getRouteImage } from '../utils/routeImage';
import { Bus, Schedule, Route, Trip, StaffMember, Stop } from '../types';
import {
  computeTargetInterval,
  checkBusConflict,
  checkDriverConflict,
  checkConductorConflict
} from '../utils/scheduleConflicts';

const BusScene = lazy(() => import('../three/BusScene'));
import {
  BusFront,
  Users,
  Compass,
  Calendar,
  Check,
  Radio,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Edit2,
  X,
  RefreshCw,
  UserCheck,
  ChevronRight,
  Bell,
  LogOut,
  Home,
  LayoutDashboard,
  TrendingUp,
  ChevronDown,
  Download,
  Sparkles,
  PieChart,
  Activity,
  Shield,
  Globe,
  ArrowRight,
  Trash2
} from 'lucide-react';

export function OperatorPortal() {
  const { user, logout } = useApp();
  const [section, setSection] = useState<'overview' | 'fleet' | 'drivers' | 'conductors' | 'routes' | 'stops' | 'schedules' | 'dispatch'>('overview');
  
  // Data hooks
  const { data: buses, reload: reloadBuses } = useApi<Bus[]>('/buses', 15000);
  const { data: staffList, reload: reloadStaff } = useApi<StaffMember[]>('/staff', 15000);
  const { data: routes, reload: reloadRoutes } = useApi<Route[]>('/routes', 15000);
  const { data: schedulesPage, reload: reloadSchedules } = useApi<{ items: Schedule[] }>('/schedules?size=200', 10000);
  const { data: activeTrips, reload: reloadTrips } = useApi<{ items: Trip[] }>('/trips?size=50', 8000);

  // Filter & Search states
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    reloadBuses();
    reloadStaff();
    reloadRoutes();
    reloadSchedules();
    reloadTrips();
    setTimeout(() => setRefreshing(false), 800);
  };

  const [busSearch, setBusSearch] = useState('');
  const [busFilter, setBusFilter] = useState('ALL');
  const [driverSearch, setDriverSearch] = useState('');
  const [conductorSearch, setConductorSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('ALL');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [schedulePage, setSchedulePage] = useState(1);
  const [assignTripModalOpen, setAssignTripModalOpen] = useState(false);
  const SCHEDULES_PER_PAGE = 10;

  // Modals for CRUD
  const [busModalOpen, setBusModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [busForm, setBusForm] = useState({
    registration: '',
    model: '',
    capacity: 40,
    type: 'Luxury AC',
    features: '',
    status: 'AVAILABLE'
  });

  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeForm, setRouteForm] = useState({
    name: '',
    origin: '',
    destination: '',
    distanceKm: 0,
    active: true,
    imageUrl: ''
  });

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    routeId: 0,
    busId: 0,
    driverId: 0,
    conductorId: 0,
    departure: '',
    arrival: '',
    fare: 1850,
    status: 'PUBLISHED'
  });

  const [conflictError, setConflictError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Stops assignment state
  const [selectedStopRouteId, setSelectedStopRouteId] = useState<number | null>(null);
  const [workingStops, setWorkingStops] = useState<{ id?: number; name: string; latitude: number; longitude: number; minutesFromDeparture: number }[]>([]);
  const [newStopForm, setNewStopForm] = useState({
    name: '',
    minutes: 30,
    lat: 7.0016,
    lng: 79.9542
  });

  // Map route creation coordinates
  const [routeOriginCoords, setRouteOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeDestCoords, setRouteDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Trip assignment form state (1/3 left panel)
  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
  const [tripDepartureDate, setTripDepartureDate] = useState(tomorrowStr);
  const [tripDepartureTime, setTripDepartureTime] = useState('08:00');
  const [tripRouteId, setTripRouteId] = useState<number | undefined>(undefined);
  const [tripBusId, setTripBusId] = useState<number | undefined>(undefined);
  const [tripDriverId, setTripDriverId] = useState<number | undefined>(undefined);
  const [tripConductorId, setTripConductorId] = useState<number | undefined>(undefined);
  const [tripFare, setTripFare] = useState<number>(1850);
  // Top bar filter & export controls
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [cadence, setCadence] = useState('Monthly');
  const [cadenceOpen, setCadenceOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.capital-dropdown-container')) {
        setDateRangeOpen(false);
        setCadenceOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleExportOperations = () => {
    try {
      let csv = `CityLink Express Operations & Dispatch Audit Log\r\n`;
      csv += `Generated At,"${new Date().toLocaleString()}"\r\n`;
      csv += `Reporting Range,"${dateRange}"\r\n`;
      csv += `Reporting Interval,"${cadence}"\r\n`;
      csv += `Available Buses,${buses?.filter(b => b.status === 'AVAILABLE').length || 0}\r\n`;
      csv += `Active Routes,${routes?.length || 0}\r\n\r\n`;

      csv += `--- FLEET DISPATCH STATUS ---\r\n`;
      csv += `Bus ID,Registration,Model,Status,Capacity\r\n`;
      (buses || []).forEach((b) => {
        csv += `${b.id},"${b.registration}","${b.model}","${b.status}",${b.capacity}\r\n`;
      });
      csv += `\r\n`;

      csv += `--- OPERATIONAL CREW ROSTER ---\r\n`;
      csv += `Staff ID,Name,Role,Status,Duty State\r\n`;
      (staffList || []).forEach((s) => {
        const isOnline = (s as any).online ?? s.available;
        csv += `${s.id},"${s.name}","${s.role}","${s.status}","${isOnline ? 'ONLINE' : 'OFFLINE'}"\r\n`;
      });
      csv += `\r\n`;

      csv += `--- SCHEDULED CORRIDORS ---\r\n`;
      csv += `Schedule ID,Route,Origin,Destination,Departure,Coach,Driver,Conductor,Status\r\n`;
      (schedulesPage?.items || []).forEach((sc: any) => {
        csv += `${sc.id},"${sc.routeCode || sc.routeName || 'N/A'}","${sc.origin || 'N/A'}","${sc.destination || 'N/A'}","${sc.departure || 'N/A'}","${sc.busRegistration || 'N/A'}","${sc.driverName || 'N/A'}","${sc.conductorName || 'N/A'}","${sc.status || 'SCHEDULED'}"\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `CityLink_Operations_Log_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setActionSuccess(`Operations log exported successfully (${filename}).`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to export operations log');
    }
  };

  const openAssignTripModal = () => {
    setTripRouteId(undefined);
    setTripBusId(undefined);
    setTripDriverId(undefined);
    setTripConductorId(undefined);
    setConflictError(null);
    setAssignTripModalOpen(true);
  };

  // Sync working stops when selected route changes
  useEffect(() => {
    if (!routes || routes.length === 0) return;
    const targetId = selectedStopRouteId || routes[0].id;
    if (selectedStopRouteId === null) setSelectedStopRouteId(targetId);
    const targetRoute = routes.find((r) => r.id === targetId);
    if (targetRoute && targetRoute.stops) {
      setWorkingStops(
        targetRoute.stops.map((s, idx) => ({
          id: s.id,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          minutesFromDeparture: s.minutesFromDeparture !== undefined ? s.minutesFromDeparture : idx * 25
        }))
      );
    }
  }, [selectedStopRouteId, routes]);

  const drivers = (staffList || []).filter((s) => s.role === 'DRIVER');
  const conductors = (staffList || []).filter((s) => s.role === 'CONDUCTOR');

  // Conflict interval & active trip checking
  const allTripsForConflict = useMemo(() => {
    const list: Trip[] = [];
    const seen = new Set<number>();
    (schedulesPage?.items || []).forEach((t) => {
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    });
    (activeTrips?.items || []).forEach((t) => {
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    });
    return list;
  }, [schedulesPage, activeTrips]);

  const selectedRouteObj = useMemo(() => {
    return (routes || []).find((r) => r.id === tripRouteId);
  }, [routes, tripRouteId]);

  const routeDurationMinutes = useMemo(() => {
    if (selectedRouteObj?.stops && selectedRouteObj.stops.length > 0) {
      const lastStop = selectedRouteObj.stops[selectedRouteObj.stops.length - 1];
      if (lastStop.minutesFromDeparture) return lastStop.minutesFromDeparture;
    }
    return selectedRouteObj ? Math.round(selectedRouteObj.distanceKm * 0.85) : 120;
  }, [selectedRouteObj]);

  const plannedTripWindow = useMemo(() => {
    return computeTargetInterval(tripDepartureDate, tripDepartureTime, routeDurationMinutes);
  }, [tripDepartureDate, tripDepartureTime, routeDurationMinutes]);

  const selectedBus = useMemo(() => (buses || []).find((b) => b.id === tripBusId), [buses, tripBusId]);
  const selectedDriver = useMemo(() => drivers.find((d) => d.id === tripDriverId), [drivers, tripDriverId]);
  const selectedConductor = useMemo(() => conductors.find((c) => c.id === tripConductorId), [conductors, tripConductorId]);

  const selectedBusConflict = useMemo(() => {
    return selectedBus ? checkBusConflict(selectedBus, plannedTripWindow, allTripsForConflict) : null;
  }, [selectedBus, plannedTripWindow, allTripsForConflict]);

  const selectedDriverConflict = useMemo(() => {
    return selectedDriver ? checkDriverConflict(selectedDriver, plannedTripWindow, allTripsForConflict) : null;
  }, [selectedDriver, plannedTripWindow, allTripsForConflict]);

  const selectedConductorConflict = useMemo(() => {
    return selectedConductor ? checkConductorConflict(selectedConductor, plannedTripWindow, allTripsForConflict) : null;
  }, [selectedConductor, plannedTripWindow, allTripsForConflict]);

  const activeConflict = selectedBusConflict || selectedDriverConflict || selectedConductorConflict;

  // If not logged in as OPERATOR
  if (!user || user.role !== 'OPERATOR') {
    return (
      <RoleLoginCard
        role="OPERATOR"
        roleTitle="Operations Command Hub"
        description="Manage routes, vehicle fleet readiness, crew dispatching, and dynamic conflict-free bus scheduling."
        demoEmail="operator@citylink.com"
        badgeColor="#00e5ff"
      />
    );
  }

  // ------------------ CRUD HANDLERS ------------------
  // Bus CRUD
  const openNewBusModal = () => {
    setEditingBus(null);
    setBusForm({
      registration: '',
      model: '',
      capacity: 40,
      type: 'Premium AC',
      features: '',
      status: 'AVAILABLE'
    });
    setBusModalOpen(true);
  };

  const openEditBusModal = (b: Bus) => {
    setEditingBus(b);
    setBusForm({
      registration: b.registration,
      model: b.model,
      capacity: b.capacity,
      type: b.type,
      features: b.features,
      status: b.status
    });
    setBusModalOpen(true);
  };

  const handleSaveBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingBus) {
        await api.put(`/buses/${editingBus.id}`, busForm);
        setActionSuccess(`Bus ${busForm.registration} updated successfully.`);
      } else {
        await api.post('/buses', busForm);
        setActionSuccess(`Bus ${busForm.registration} added to fleet with 40 seats.`);
      }
      setBusModalOpen(false);
      reloadBuses();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error saving bus');
    } finally {
      setSaving(false);
    }
  };

  // Staff Availability Toggle
  const toggleStaffAvailability = async (s: StaffMember) => {
    try {
      await api.put(`/staff/${s.id}`, {
        licenseNumber: s.licenseNumber || (s.role === 'DRIVER' ? 'LK-DRV-2026' : 'LK-CND-2026'),
        available: !s.available
      });
      setActionSuccess(`${s.name} is now marked ${!s.available ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)'}.`);
      reloadStaff();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update staff status');
    }
  };

  // Route CRUD
  const openNewRouteModal = () => {
    setEditingRoute(null);
    setRouteForm({
      name: 'Southern Super Highway Link',
      origin: 'Colombo Fort',
      destination: 'Matara Central',
      distanceKm: 160,
      active: true,
      imageUrl: ''
    });
    setRouteModalOpen(true);
  };

  const openEditRouteModal = (r: Route) => {
    setEditingRoute(r);
    setRouteForm({
      name: r.name,
      origin: r.origin,
      destination: r.destination,
      distanceKm: r.distanceKm,
      active: r.active,
      imageUrl: r.imageUrl || ''
    });
    setRouteModalOpen(true);
  };

  const handleMapClickForRoute = (lat: number, lng: number, suggestedName?: string) => {
    if (!routeOriginCoords) {
      setRouteOriginCoords({ lat, lng });
      if (suggestedName) setRouteForm((prev) => ({ ...prev, origin: suggestedName }));
    } else {
      setRouteDestCoords({ lat, lng });
      if (suggestedName) setRouteForm((prev) => ({ ...prev, destination: suggestedName }));
      const dLat = (lat - routeOriginCoords.lat) * 111;
      const dLng = (lng - routeOriginCoords.lng) * 111 * Math.cos((lat * Math.PI) / 180);
      const estDistance = Math.max(15, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 1.25));
      setRouteForm((prev) => ({
        ...prev,
        distanceKm: estDistance,
        name: `${routeForm.origin || 'Origin'} ➔ ${suggestedName || 'Destination'} Express`
      }));
    }
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const originLat = routeOriginCoords?.lat || 6.9344;
      const originLng = routeOriginCoords?.lng || 79.8500;
      const destLat = routeDestCoords?.lat || 5.9549;
      const destLng = routeDestCoords?.lng || 80.5550;
      const durationMins = Math.round(routeForm.distanceKm * 0.85);

      const defaultStops = [
        { name: routeForm.origin, latitude: originLat, longitude: originLng, minutesFromDeparture: 0 },
        { name: routeForm.destination, latitude: destLat, longitude: destLng, minutesFromDeparture: durationMins }
      ];

      if (editingRoute) {
        await api.put(`/routes/${editingRoute.id}`, {
          ...routeForm,
          imageUrl: routeForm.imageUrl || undefined,
          stops: editingRoute.stops && editingRoute.stops.length >= 2 ? editingRoute.stops : defaultStops
        });
        setActionSuccess(`Route ${routeForm.name} updated successfully.`);
      } else {
        await api.post('/routes', {
          ...routeForm,
          imageUrl: routeForm.imageUrl || undefined,
          stops: defaultStops
        });
        setActionSuccess(`Route ${routeForm.name} created successfully.`);
      }
      setRouteModalOpen(false);
      reloadRoutes();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error saving route');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStopsToRoute = async () => {
    if (!selectedStopRouteId) return;
    const targetRoute = routes?.find((r) => r.id === selectedStopRouteId);
    if (!targetRoute) return;

    if (workingStops.length < 2) {
      alert('A route requires at least 2 stops: Origin and Destination.');
      return;
    }

    setSaving(true);
    try {
      const formattedStops = workingStops.map((s, idx) => ({
        name: idx === 0 ? targetRoute.origin : (idx === workingStops.length - 1 ? targetRoute.destination : s.name),
        latitude: s.latitude,
        longitude: s.longitude,
        minutesFromDeparture: idx === 0 ? 0 : Math.max(idx * 15, s.minutesFromDeparture)
      }));

      await api.put(`/routes/${targetRoute.id}`, {
        name: targetRoute.name,
        origin: targetRoute.origin,
        destination: targetRoute.destination,
        distanceKm: targetRoute.distanceKm,
        active: targetRoute.active,
        stops: formattedStops
      });

      setActionSuccess(`Stops successfully saved to route "${targetRoute.name}"!`);
      reloadRoutes();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save stops to route');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStopToWorking = () => {
    if (!newStopForm.name.trim()) {
      alert('Please enter a stop name or click on the map.');
      return;
    }
    const targetRoute = routes?.find((r) => r.id === selectedStopRouteId);
    if (!targetRoute) return;

    const newStop = {
      name: newStopForm.name.trim(),
      latitude: newStopForm.lat,
      longitude: newStopForm.lng,
      minutesFromDeparture: newStopForm.minutes
    };

    if (workingStops.length <= 1) {
      setWorkingStops([...workingStops, newStop]);
    } else {
      const dest = workingStops[workingStops.length - 1];
      const middle = workingStops.slice(0, workingStops.length - 1);
      setWorkingStops([...middle, newStop, dest]);
    }

    setNewStopForm({
      name: '',
      minutes: (workingStops.length + 1) * 20,
      lat: 7.0016,
      lng: 79.9542
    });
  };

  const handleRemoveWorkingStop = (index: number) => {
    if (index === 0 || index === workingStops.length - 1) {
      alert('Cannot delete primary origin or destination terminal stop.');
      return;
    }
    setWorkingStops(workingStops.filter((_, i) => i !== index));
  };

  const handleAssignTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setConflictError(null);
    try {
      if (!tripRouteId || !tripBusId || !tripDriverId || !tripConductorId) {
        alert('Please select a route corridor, coach, driver, and conductor.');
        setSaving(false);
        return;
      }

      const selectedRoute = routes?.find((r) => r.id === tripRouteId);
      if (!selectedRoute?.stops || selectedRoute.stops.length < 2) {
        alert(`The selected route "${selectedRoute?.name || 'Selected'}" does not have enough stops configured yet. Please configure at least origin and destination stops in the Stops tab first.`);
        setSaving(false);
        return;
      }

      const lastStopMin = selectedRoute.stops[selectedRoute.stops.length - 1].minutesFromDeparture || 120;

      const [y, m, d] = tripDepartureDate.split('-').map(Number);
      const [hr, min] = tripDepartureTime.split(':').map(Number);
      const depDate = new Date(y, m - 1, d, hr, min, 0);

      // Validate departure is in the future
      if (depDate.getTime() <= Date.now()) {
        alert('Please choose a future departure date and time (after current time).');
        setSaving(false);
        return;
      }

      const arrDate = new Date(depDate.getTime() + lastStopMin * 60000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dep = `${y}-${pad(m)}-${pad(d)}T${pad(hr)}:${pad(min)}:00`;
      const arr = `${arrDate.getFullYear()}-${pad(arrDate.getMonth() + 1)}-${pad(arrDate.getDate())}T${pad(arrDate.getHours())}:${pad(arrDate.getMinutes())}:00`;

      // Client-side conflict pre-check
      if (selectedBusConflict) {
        setConflictError(selectedBusConflict.reason);
        alert(`⚠️ Scheduling Conflict: ${selectedBusConflict.reason}`);
        setSaving(false);
        return;
      }
      if (selectedDriverConflict) {
        setConflictError(selectedDriverConflict.reason);
        alert(`⚠️ Scheduling Conflict: ${selectedDriverConflict.reason}`);
        setSaving(false);
        return;
      }
      if (selectedConductorConflict) {
        setConflictError(selectedConductorConflict.reason);
        alert(`⚠️ Scheduling Conflict: ${selectedConductorConflict.reason}`);
        setSaving(false);
        return;
      }

      await api.post('/schedules', {
        routeId: tripRouteId,
        busId: tripBusId,
        driverId: tripDriverId,
        conductorId: tripConductorId,
        departure: dep,
        arrival: arr,
        fare: tripFare,
        status: 'PUBLISHED'
      });

      setActionSuccess(`Trip assigned successfully! Dispatched duty assignment alerts to Driver and Conductor.`);
      setTripRouteId(undefined);
      setTripBusId(undefined);
      setTripDriverId(undefined);
      setTripConductorId(undefined);
      setAssignTripModalOpen(false);
      reloadSchedules();
      reloadTrips();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      if (err.errorCode === 'SCHEDULE_CONFLICT') {
        setConflictError(err.message);
      } else {
        alert(err.message || 'Failed to assign trip');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setConflictError(null);
    try {
      await api.post('/schedules', scheduleForm);
      setActionSuccess('Trip schedule created without conflicts.');
      setScheduleModalOpen(false);
      reloadSchedules();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      if (err.errorCode === 'SCHEDULE_CONFLICT') {
        setConflictError(err.message);
      } else {
        alert(err.message || 'Failed to save schedule');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJourney = async (id: number) => {
    if (!window.confirm(`Are you sure you want to permanently delete journey #${id}? This will cancel dispatch and remove the trip.`)) return;
    try {
      await api.delete(`/schedules/${id}`);
      setActionSuccess(`Journey #${id} deleted successfully.`);
      reloadSchedules();
      reloadTrips();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete journey');
    }
  };

  const handleCancelTrip = async (id: number) => {
    if (!window.confirm('Cancel this scheduled trip? Passengers with confirmed bookings will be notified.')) return;
    try {
      await api.post(`/schedules/${id}/cancel`, { confirmChanges: true });
      setActionSuccess(`Trip #${id} cancelled and alerts dispatched.`);
      reloadSchedules();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  return (
    <div className="capital-layout">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="capital-sidebar">
        <div className="capital-brand">
          <div className="capital-logo-badge" style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}>
            <Radio size={18} />
          </div>
          <div className="capital-brand-title">
            <strong>Operations Hub</strong>
            <small>Dispatch Suite</small>
          </div>
          <Link to="/" className="capital-filter-pill" style={{ marginLeft: 'auto', padding: '4px 8px' }} title="Back to Public Site">
            <Home size={13} />
          </Link>
        </div>

        <div className="capital-nav-group">
          <span className="capital-nav-header">Overview</span>
          <ul className="capital-nav-list">
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'overview' ? 'active' : ''}`}
                onClick={() => setSection('overview')}
              >
                <LayoutDashboard size={17} />
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'fleet' ? 'active' : ''}`}
                onClick={() => setSection('fleet')}
              >
                <BusFront size={17} />
                <span>Fleet & Vehicles</span>
                <span className="capital-nav-badge">{buses?.length || 0}</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="capital-nav-group">
          <span className="capital-nav-header">Dispatch & Crew</span>
          <ul className="capital-nav-list">
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'drivers' ? 'active' : ''}`}
                onClick={() => setSection('drivers')}
              >
                <Users size={17} />
                <span>Driver Roster</span>
                <span className="capital-nav-badge">{drivers.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'conductors' ? 'active' : ''}`}
                onClick={() => setSection('conductors')}
              >
                <UserCheck size={17} />
                <span>Conductor Roster</span>
                <span className="capital-nav-badge">{conductors.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'routes' ? 'active' : ''}`}
                onClick={() => setSection('routes')}
              >
                <Compass size={17} />
                <span>Express Routes</span>
                <span className="capital-nav-badge">{routes?.length || 0}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'stops' ? 'active' : ''}`}
                onClick={() => setSection('stops')}
              >
                <MapPin size={17} />
                <span>Route Stops</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'schedules' ? 'active' : ''}`}
                onClick={() => setSection('schedules')}
              >
                <Calendar size={17} />
                <span>Trip Schedules</span>
                <span className="capital-nav-badge">{schedulesPage?.items.length || 0}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'dispatch' ? 'active' : ''}`}
                onClick={() => setSection('dispatch')}
              >
                <Radio size={17} />
                <span>Live Dispatch</span>
                <span className="capital-nav-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Live</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Go to Site Button */}
        <Link to="/" className="capital-goto-site" title="Return to Public Site">
          <Globe size={16} />
          <span>Go to Site</span>
          <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.7 }} />
        </Link>

        <div className="capital-sidebar-bottom">
          <div className="capital-user-card">
            <div className="capital-user-left">
              <div className="capital-user-avatar" style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}>
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="capital-user-meta">
                <strong>{user.firstName} {user.lastName}</strong>
                <small style={{ color: '#38bdf8' }}>OPERATIONS MGR</small>
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
              {section === 'overview' && 'Operations Command Overview'}
              {section === 'fleet' && 'Fleet Management & Vehicle Health'}
              {section === 'drivers' && 'Driver Roster & Shift Assignments'}
              {section === 'conductors' && 'Conductor Roster & Availability'}
              {section === 'routes' && 'Express Highway Routes & Halts'}
              {section === 'schedules' && 'Conflict-Free Trip Scheduling'}
              {section === 'dispatch' && 'Live Highway Dispatch & Telemetry'}
            </h1>
            <p>
              <span className="capital-status-dot" />
              <span>Last updated Today, 9:42 AM • Expressway dispatch telemetry live</span>
            </p>
          </div>

          <div className="capital-header-controls">
            <button
              type="button"
              className={`capital-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh operational telemetry"
            >
              <RefreshCw size={13} className={refreshing ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>

            {/* Date Range Dropdown */}
            <div className="capital-dropdown-container">
              <button
                type="button"
                className="capital-filter-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  setDateRangeOpen((prev) => !prev);
                  setCadenceOpen(false);
                }}
                title="Select date range"
              >
                <Calendar size={13} color="#00e5ff" />
                <span>{dateRange}</span>
                <ChevronDown
                  size={13}
                  color="#64748b"
                  style={{
                    transform: dateRangeOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }}
                />
              </button>

              {dateRangeOpen && (
                <div className="capital-dropdown-menu">
                  {['Today', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'Year to Date'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`capital-dropdown-item ${dateRange === opt ? 'active' : ''}`}
                      onClick={() => {
                        setDateRange(opt);
                        setDateRangeOpen(false);
                        setActionSuccess(`Operations window set to: ${opt}`);
                        setTimeout(() => setActionSuccess(null), 3000);
                      }}
                    >
                      <span>{opt}</span>
                      {dateRange === opt && <Check size={13} color="#00e5ff" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cadence Dropdown */}
            <div className="capital-dropdown-container">
              <button
                type="button"
                className="capital-filter-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  setCadenceOpen((prev) => !prev);
                  setDateRangeOpen(false);
                }}
                title="Select reporting cadence"
              >
                <span>{cadence}</span>
                <ChevronDown
                  size={13}
                  color="#64748b"
                  style={{
                    transform: cadenceOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }}
                />
              </button>

              {cadenceOpen && (
                <div className="capital-dropdown-menu">
                  {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`capital-dropdown-item ${cadence === opt ? 'active' : ''}`}
                      onClick={() => {
                        setCadence(opt);
                        setCadenceOpen(false);
                        setActionSuccess(`Reporting cadence set to: ${opt}`);
                        setTimeout(() => setActionSuccess(null), 3000);
                      }}
                    >
                      <span>{opt}</span>
                      {cadence === opt && <Check size={13} color="#00e5ff" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="capital-btn-export"
              onClick={handleExportOperations}
              title="Download Operations & Dispatch Log (CSV)"
            >
              <Download size={13} />
              <span>Export Operations Log ↗</span>
            </button>

            <ThemeToggle />
          </div>
        </div>

        {/* Feedback alerts */}
        {actionSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#10b981', padding: '0.85rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* ================= 1. CAPITALIO OPERATOR DASHBOARD OVERVIEW ================= */}
        {section === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top 4 KPI Cards */}
            <div className="capital-kpi-grid">
              {/* Card 1: Fleet Readiness */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>Operational Fleet Readiness</span>
                  <div className="capital-card-icon" title="Vehicle Availability">
                    <Sparkles size={14} color="#10b981" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">98.4%</span>
                  <span className="capital-delta-pill">
                    19/19 Coaches Ready
                  </span>
                </div>
                <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <svg width="100%" height="45" viewBox="0 0 200 45" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="opGradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,38 C30,36 60,30 90,26 C120,22 150,14 200,6 L200,45 L0,45 Z" fill="url(#opGradGreen)" />
                    <path d="M0,38 C30,36 60,30 90,26 C120,22 150,14 200,6" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>

              {/* Card 2: On-Time Dispatch Rate */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>On-Time Dispatch Rate</span>
                  <div className="capital-card-icon">
                    <Activity size={14} color="#38bdf8" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">96.5%</span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    +1.5% to target
                  </span>
                </div>
                <div className="capital-segmented-bar">
                  <div className="capital-segmented-fill" style={{ width: '96.5%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 6px' }}>
                  <span>134 Trips On-Schedule</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>Goal 95%</span>
                </div>
                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>

              {/* Card 3: Crew Deployment */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>Crew Deployment & Roster</span>
                  <div className="capital-card-icon">
                    <Users size={14} color="#a855f7" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">{drivers.length + conductors.length} Crew</span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    100% Rostered
                  </span>
                </div>
                <div className="capital-stacked-bar">
                  <div className="capital-stacked-seg" style={{ width: '50%', background: '#10b981' }} title="Drivers 50%" />
                  <div className="capital-stacked-seg" style={{ width: '50%', background: '#0284c7' }} title="Conductors 50%" />
                </div>
                <div className="capital-stacked-legend">
                  <span><span style={{ color: '#10b981' }}>■</span> Drivers <strong>{drivers.length}</strong></span>
                  <span><span style={{ color: '#0284c7' }}>■</span> Conductors <strong>{conductors.length}</strong></span>
                </div>
              </div>

              {/* Card 4: Fleet Safety Score */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>Highway Safety & Reliability</span>
                  <div className="capital-card-icon">
                    <Shield size={14} color="#f59e0b" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">99<small style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8' }}>/100</small></span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    Zero Defect Lock
                  </span>
                </div>
                <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <svg width="100%" height="45" viewBox="0 0 200 45" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="opGradAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,28 Q50,6 100,24 T200,16 L200,45 L0,45 Z" fill="url(#opGradAmber)" />
                    <path d="M0,28 Q50,6 100,24 T200,16" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>
            </div>

            {/* 3D Fleet Visualizer & Real-time Command Display */}
            <div className="dashboard-hero-visualizer" style={{ margin: 0 }}>
              <div className="visualizer-info">
                <div className="live-telemetry-badge">
                  <span className="pulse-radar-dot" />
                  <span>EXPRESSWAY HIGHWAY DISPATCH 3D TWIN</span>
                </div>
                <h2>Operations Command Center</h2>
                <p>
                  Live spatial telemetry and real-time vehicle monitoring. Inspect 3D coach models, passenger cabin load, and scheduled dispatch readiness.
                </p>
                <div className="visualizer-telemetry-grid">
                  <div className="telemetry-card">
                    <small>OPERATIONAL FLEET</small>
                    <strong>{buses?.filter((b) => b.status === 'AVAILABLE').length || 0} Ready</strong>
                  </div>
                  <div className="telemetry-card">
                    <small>DRIVERS ON ROSTER</small>
                    <strong>{staffList?.filter((s) => s.role === 'DRIVER').length || 0} Drivers</strong>
                  </div>
                  <div className="telemetry-card">
                    <small>NETWORK DISPATCH</small>
                    <strong style={{ color: '#10b981' }}>Active Sync</strong>
                  </div>
                </div>
              </div>

              <div className="visualizer-3d-canvas-box">
                <span className="visualizer-3d-badge">
                  <BusFront size={13} />
                  <span>3D FLEET TWIN</span>
                </span>
                <Suspense fallback={<div className="loading" style={{ height: '100%' }} />}>
                  <BusScene />
                </Suspense>
              </div>
            </div>

            {/* Middle Section: Spline Chart + Donut Chart */}
            <div className="capital-analytics-grid">
              {/* Left Card: Fleet Dispatch Velocity & Highway Load */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <div>
                    <h2>Fleet Dispatch Velocity & Highway Load</h2>
                  </div>
                  <div className="capital-panel-actions">
                    <span className="capital-badge-ytd">+94.8% Capacity</span>
                    <button type="button" className="capital-link-action" onClick={() => setSection('dispatch')}>
                      Live Map ↗
                    </button>
                  </div>
                </div>

                <div className="capital-chart-legend">
                  <div className="capital-legend-item">
                    <span className="capital-legend-dot" style={{ background: '#00f5a0' }} />
                    <span>Actual Passenger Flow</span>
                  </div>
                  <div className="capital-legend-item">
                    <span className="capital-legend-dot" style={{ background: '#00d2ff', border: '1px dashed #00d2ff' }} />
                    <span>Seat Capacity Benchmark</span>
                  </div>
                </div>

                <div className="capital-chart-wrap">
                  <svg width="100%" height="220" viewBox="0 0 700 220" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="opPerfGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#00f5a0" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1="40" y1="20" x2="680" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <text x="32" y="24" fill="#64748b" fontSize="10" textAnchor="end">5k</text>

                    <line x1="40" y1="60" x2="680" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <text x="32" y="64" fill="#64748b" fontSize="10" textAnchor="end">4k</text>

                    <line x1="40" y1="100" x2="680" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <text x="32" y="104" fill="#64748b" fontSize="10" textAnchor="end">3k</text>

                    <line x1="40" y1="140" x2="680" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <text x="32" y="144" fill="#64748b" fontSize="10" textAnchor="end">2k</text>

                    <line x1="40" y1="180" x2="680" y2="180" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                    <text x="32" y="184" fill="#64748b" fontSize="10" textAnchor="end">1k</text>

                    <path
                      d="M50,155 C120,150 160,85 240,155 C300,200 370,135 440,135 C510,135 570,35 670,42 L670,195 L50,195 Z"
                      fill="url(#opPerfGreen)"
                    />

                    <path
                      d="M50,155 C120,150 160,85 240,155 C300,200 370,135 440,135 C510,135 570,35 670,42"
                      stroke="#00f5a0"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />

                    <path
                      d="M50,140 C130,135 180,115 250,128 C330,140 410,130 490,115 C570,100 630,90 670,85"
                      stroke="#00d2ff"
                      strokeWidth="2.2"
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                    />

                    <text x="50" y="212" fill="#64748b" fontSize="11">Week 1</text>
                    <text x="200" y="212" fill="#64748b" fontSize="11">Week 2</text>
                    <text x="350" y="212" fill="#64748b" fontSize="11">Week 3</text>
                    <text x="500" y="212" fill="#64748b" fontSize="11">Week 4</text>
                    <text x="650" y="212" fill="#64748b" fontSize="11">Week 5</text>
                  </svg>
                </div>

                <div className="capital-metric-strip">
                  <div className="capital-strip-col">
                    <small>Scheduled Trips</small>
                    <strong>134 Active</strong>
                    <span>+100%</span>
                  </div>
                  <div className="capital-strip-col">
                    <small>Average Delay</small>
                    <strong>0.0 mins</strong>
                    <span>On Schedule</span>
                  </div>
                  <div className="capital-strip-col">
                    <small>Fuel Efficiency</small>
                    <strong>4.8 km/L</strong>
                    <span>+0.3 km/L</span>
                  </div>
                  <div className="capital-strip-col">
                    <small>Chassis Telemetry</small>
                    <strong>99.4%</strong>
                    <span>Optimal</span>
                  </div>
                </div>
              </div>

              {/* Right Card: Fleet Corridor Allocation Donut */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Corridor Allocation</h2>
                  <span className="capital-badge-ytd" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    Balanced
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                  {/* Centered & Enlarged Donut SVG */}
                  <div style={{ position: 'relative', width: '210px', height: '210px', margin: '0.75rem auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#0284c7"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="211.1 502.7"
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#10b981"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="150.8 502.7"
                        strokeDashoffset="-211.1"
                      />
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#a855f7"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="75.4 502.7"
                        strokeDashoffset="-361.9"
                      />
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#f97316"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="65.3 502.7"
                        strokeDashoffset="-437.3"
                      />
                    </svg>
                    <div className="capital-donut-center">
                      <strong style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground, #ffffff)', lineHeight: 1 }}>45</strong>
                      <small style={{ fontSize: '0.85rem', color: 'var(--muted, #94a3b8)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '4px' }}>Corridors</small>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7', boxShadow: '0 0 8px rgba(2, 132, 199, 0.5)' }} />
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Southern Expressway</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>8 Buses</strong>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(2, 132, 199, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(2, 132, 199, 0.3)',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>42%</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)' }} />
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Central Highlands</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>6 Buses</strong>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>30%</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#a855f7', boxShadow: '0 0 8px rgba(168, 85, 247, 0.5)' }} />
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Northern Great Highway</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>3 Buses</strong>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>15%</span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#f97316', boxShadow: '0 0 8px rgba(249, 115, 22, 0.5)' }} />
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Eastern Coastal Line</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>2 Buses</strong>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(249, 115, 22, 0.15)',
                          color: '#fb923c',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>13%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Active Fleet Roster + Smart Dispatch AI Insights */}
            <div className="capital-bottom-grid">
              {/* Left: Active Fleet Roster */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Active Vehicle Roster & Telemetry</h2>
                  <button type="button" className="capital-link-action" onClick={() => setSection('fleet')}>
                    Manage fleet ↗
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="capital-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>No</th>
                        <th>Coach / Reg</th>
                        <th>Model & Type</th>
                        <th>Capacity</th>
                        <th>Status</th>
                        <th>Telemetry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(buses || []).slice(0, 5).map((b, idx) => (
                        <tr key={b.id}>
                          <td style={{ color: '#64748b' }}>{idx + 1}</td>
                          <td>
                            <div className="capital-asset-cell">
                              <div className="capital-asset-icon">
                                <BusFront size={14} />
                              </div>
                              <div>
                                <strong style={{ color: '#ffffff', display: 'block' }}>{b.registration}</strong>
                                <small style={{ color: '#64748b' }}>Coach #{b.id}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: '#cbd5e1', display: 'block' }}>{b.model}</strong>
                            <span className="capital-delta-pill" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                              {b.type}
                            </span>
                          </td>
                          <td style={{ color: '#94a3b8' }}>{b.capacity} Seats</td>
                          <td>
                            <span
                              className="capital-delta-pill"
                              style={{
                                background: b.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: b.status === 'AVAILABLE' ? '#10b981' : '#f59e0b'
                              }}
                            >
                              {b.status === 'AVAILABLE' ? '● In Service' : b.status}
                            </span>
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>GNSS Synced</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Smart Dispatch AI Insights */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Smart Dispatch Insights</h2>
                  <span className="capital-badge-ytd" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    AI Recommendation
                  </span>
                </div>

                <div className="capital-insight-list">
                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                      <Radio size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Expressway Fog Caution</h4>
                      <p>Light mist on Kadawatha-Mirigama expressway stretch. Automated speed advisory (80 km/h) dispatched to coaches.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('dispatch')}>
                        View Telemetry Stream →
                      </button>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      <Calendar size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Conflict-Free Crew Assignment</h4>
                      <p>Automated roster audit completed for all 45 routes. Zero overlapping shift constraints detected for October.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('schedules')}>
                        Review Shift Roster →
                      </button>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Preventive Wheel Balancing</h4>
                      <p>Bus WP ND-1035 reported minor tire pressure variance (112 PSI). Calibration scheduled at Colombo Central depot.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('fleet')}>
                        Check Maintenance Logs →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* 1. FLEET MANAGEMENT */}
          {section === 'fleet' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Fleet Management & Vehicles</h2>
                  <p style={{ fontSize: '0.85rem', margin: '0.2rem 0 0', color: 'var(--muted)' }}>Register coaches, inspect vehicle roadworthiness, and monitor maintenance records.</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={openNewBusModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Add New Bus
                </button>
              </div>

            <div className="portal-card">
              <div className="portal-toolbar">
                <div className="portal-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by registration (e.g. CLX-201) or model..."
                    value={busSearch}
                    onChange={(e) => setBusSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['ALL', 'AVAILABLE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`btn btn-sm ${busFilter === status ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setBusFilter(status)}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table" style={{ width: '100%', minWidth: '1050px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '130px', minWidth: '130px' }}>Registration</th>
                      <th style={{ width: '160px', minWidth: '160px' }}>Model & Specifications</th>
                      <th style={{ width: '105px', minWidth: '105px' }}>Capacity</th>
                      <th style={{ width: '135px', minWidth: '135px' }}>Class</th>
                      <th style={{ width: '230px', minWidth: '220px' }}>Features</th>
                      <th style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(buses || [])
                      .filter((b) => busFilter === 'ALL' || b.status === busFilter)
                      .filter((b) => !busSearch || (b.registration + ' ' + b.model).toLowerCase().includes(busSearch.toLowerCase()))
                      .map((b) => (
                        <tr key={b.id}>
                          <td style={{ width: '130px', minWidth: '130px' }}>
                            <strong style={{ color: '#00e5ff' }}>{b.registration}</strong>
                          </td>
                          <td style={{ width: '160px', minWidth: '160px' }}>{b.model}</td>
                          <td style={{ width: '105px', minWidth: '105px' }}>{b.capacity} Seats</td>
                          <td style={{ width: '135px', minWidth: '135px' }}>{b.type}</td>
                          <td style={{ width: '230px', minWidth: '220px', maxWidth: '260px', whiteSpace: 'normal', verticalAlign: 'middle' }}>
                            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.8rem', lineHeight: 1.45, color: '#94a3b8' }}>
                              {b.features || 'Standard Features'}
                            </div>
                          </td>
                          <td style={{ width: '140px', minWidth: '140px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            <span
                              className="badge"
                              style={{
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '105px',
                                padding: '5px 10px',
                                background:
                                  b.status === 'AVAILABLE'
                                    ? 'rgba(56, 239, 125, 0.15)'
                                    : b.status === 'UNDER_MAINTENANCE'
                                    ? 'rgba(255, 179, 0, 0.15)'
                                    : 'rgba(255, 75, 75, 0.15)',
                                color:
                                  b.status === 'AVAILABLE'
                                    ? '#38ef7d'
                                    : b.status === 'UNDER_MAINTENANCE'
                                    ? '#ffb300'
                                    : '#ff5252'
                              }}
                            >
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ width: '120px', minWidth: '120px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            <button type="button" className="btn btn-sm" onClick={() => openEditBusModal(b)}>
                              <Edit2 size={13} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 2. DRIVER MANAGEMENT */}
        {section === 'drivers' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Driver Management & Rosters</h2>
                <p style={{ fontSize: '0.85rem', margin: '0.2rem 0 0', color: 'var(--muted)' }}>Manage licensed bus captains, check active rosters, and control availability.</p>
              </div>
              <button type="button" className="btn" onClick={() => reloadStaff()}>
                <RefreshCw size={13} /> Refresh Roster
              </button>
            </div>

            <div className="portal-card">
              <div className="portal-toolbar">
                <div className="portal-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search driver by name, phone, or license..."
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Driver Name</th>
                      <th>Phone</th>
                      <th>License Number</th>
                      <th>Duty Status</th>
                      <th>Upcoming Assigned Duties</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers
                      .filter((d) => !driverSearch || (d.name + ' ' + d.phone + ' ' + (d.licenseNumber || '')).toLowerCase().includes(driverSearch.toLowerCase()))
                      .map((d) => (
                        <tr key={d.id}>
                          <td><strong>{d.employeeId || `EMP-DRV-${d.id}`}</strong></td>
                          <td>
                            <strong>{d.name}</strong>
                            <br /><small style={{ color: '#94a3b8' }}>{d.email}</small>
                          </td>
                          <td>{d.phone}</td>
                          <td><span style={{ fontFamily: 'monospace', color: '#00e5ff' }}>{d.licenseNumber || 'LK-DRV-PENDING'}</span></td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: d.available ? 'rgba(56, 239, 125, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                color: d.available ? '#38ef7d' : '#94a3b8',
                                fontWeight: 700
                              }}
                            >
                              {d.available ? '🟢 ONLINE (ON DUTY)' : '⚪ OFFLINE (OFF DUTY)'}
                            </span>
                          </td>
                          <td>
                            {d.duties && d.duties.length > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#38ef7d' }}>
                                #{d.duties[0].id} {d.duties[0].route} ({new Date(d.duties[0].departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No pending assignments</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => toggleStaffAvailability(d)}
                            >
                              {d.available ? 'Set Offline' : 'Set Online'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 3. CONDUCTOR MANAGEMENT */}
        {section === 'conductors' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Conductor Management & Rosters</h2>
                <p style={{ fontSize: '0.85rem', margin: '0.2rem 0 0', color: 'var(--muted)' }}>Manage passenger service staff, verified conductors, and operational rosters.</p>
              </div>
              <button type="button" className="btn" onClick={() => reloadStaff()}>
                <RefreshCw size={13} /> Refresh Roster
              </button>
            </div>

            <div className="portal-card">
              <div className="portal-toolbar">
                <div className="portal-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search conductor by name or license..."
                    value={conductorSearch}
                    onChange={(e) => setConductorSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Conductor Name</th>
                      <th>Phone</th>
                      <th>License Number</th>
                      <th>Duty Status</th>
                      <th>Upcoming Assigned Duties</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conductors
                      .filter((c) => !conductorSearch || (c.name + ' ' + c.phone + ' ' + (c.licenseNumber || '')).toLowerCase().includes(conductorSearch.toLowerCase()))
                      .map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.employeeId || `EMP-CND-${c.id}`}</strong></td>
                          <td>
                            <strong>{c.name}</strong>
                            <br /><small style={{ color: '#94a3b8' }}>{c.email}</small>
                          </td>
                          <td>{c.phone}</td>
                          <td><span style={{ fontFamily: 'monospace', color: '#00e5ff' }}>{c.licenseNumber || 'LK-CND-PENDING'}</span></td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: c.available ? 'rgba(56, 239, 125, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                color: c.available ? '#38ef7d' : '#94a3b8',
                                fontWeight: 700
                              }}
                            >
                              {c.available ? '🟢 ONLINE (ON DUTY)' : '⚪ OFFLINE (OFF DUTY)'}
                            </span>
                          </td>
                          <td>
                            {c.duties && c.duties.length > 0 ? (
                              <span style={{ fontSize: '0.82rem', color: '#38ef7d' }}>
                                #{c.duties[0].id} {c.duties[0].route}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No pending assignments</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => toggleStaffAvailability(c)}
                            >
                              {c.available ? 'Set Offline' : 'Set Online'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 4. ROUTE MANAGEMENT (1/3 Controls : 2/3 Map) */}
        {section === 'routes' && (
          <div className="capital-split-screen">
            <div className="capital-split-left">
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                  Express Route Architect
                </h2>
                <p style={{ fontSize: '0.8rem', margin: '2px 0 0', color: 'var(--muted)' }}>
                  Click map on right to set Origin (A) and Destination (B).
                </p>
              </div>

              {/* Route Builder Form */}
              <form onSubmit={handleSaveRoute} className="capital-card" style={{ padding: '1rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Route Corridor Name</label>
                  <input
                    type="text"
                    required
                    value={routeForm.name}
                    onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                    placeholder="e.g. Southern Expressway Link (E01)"
                    style={{ width: '100%', padding: '8px 10px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Origin Terminal (A)</label>
                    <input
                      type="text"
                      required
                      value={routeForm.origin}
                      onChange={(e) => setRouteForm({ ...routeForm, origin: e.target.value })}
                      placeholder="e.g. Colombo Fort"
                      style={{ width: '100%', padding: '8px 10px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#f43f5e', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Destination Hub (B)</label>
                    <input
                      type="text"
                      required
                      value={routeForm.destination}
                      onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })}
                      placeholder="e.g. Matara Nupe"
                      style={{ width: '100%', padding: '8px 10px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', color: '#f43f5e', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Distance (km)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={routeForm.distanceKm}
                      onChange={(e) => setRouteForm({ ...routeForm, distanceKm: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px 10px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Route Status</label>
                    <button
                      type="button"
                      onClick={() => setRouteForm({ ...routeForm, active: !routeForm.active })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: routeForm.active ? '#10b981' : '#64748b',
                        background: routeForm.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: routeForm.active ? '#10b981' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {routeForm.active ? '● OPERATIONAL' : '○ INACTIVE'}
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Quick Transit Presets:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {[
                      { name: 'Colombo - Kandy', orig: 'Colombo Fort', dest: 'Kandy Goods Shed', dist: 115, img: '/images/routes/kandy.webp' },
                      { name: 'Colombo - Galle', orig: 'Colombo Fort', dest: 'Galle Central Station', dist: 118, img: '/images/routes/galle.webp' },
                      { name: 'Colombo - Matara', orig: 'Makumbura Hub', dest: 'Matara Nupe Terminal', dist: 145, img: '/images/routes/galle.webp' },
                      { name: 'Colombo - Jaffna', orig: 'Colombo Fort', dest: 'Jaffna Main Station', dist: 395, img: '/images/routes/jaffna.webp' },
                      { name: 'Kandy - Badulla', orig: 'Kandy Goods Shed', dest: 'Badulla Main Terminal', dist: 112, img: '/images/routes/ella.webp' }
                    ].map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setRouteForm({
                            name: `${p.orig} ➔ ${p.dest} Express`,
                            origin: p.orig,
                            destination: p.dest,
                            distanceKm: p.dist,
                            active: true,
                            imageUrl: p.img
                          });
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: '#cbd5e1',
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                  <RouteImageUploader
                    value={routeForm.imageUrl}
                    onChange={(url) => setRouteForm({ ...routeForm, imageUrl: url })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                      color: '#090d14',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '8px',
                      padding: '9px',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    {editingRoute ? 'Update Route Corridor' : 'Save & Publish Route'}
                  </button>
                  {editingRoute && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoute(null);
                        setRouteForm({ name: '', origin: '', destination: '', distanceKm: 120, active: true, imageUrl: '' });
                      }}
                      style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '9px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Existing Routes Quick Selector */}
              <div className="capital-card" style={{ padding: '0.85rem', marginTop: '0.85rem' }}>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                  Configured Corridors ({routes?.length || 0})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {(routes || []).map((r) => (
                    <div
                      key={r.id}
                      onClick={() => openEditRouteModal(r)}
                      style={{
                        padding: '8px 10px',
                        background: editingRoute?.id === r.id ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${editingRoute?.id === r.id ? '#0284c7' : '#1e293b'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <img
                          src={getRouteImage(r)}
                          alt=""
                          style={{
                            width: '44px',
                            height: '32px',
                            borderRadius: '6px',
                            objectFit: 'cover',
                            border: '1px solid rgba(255,255,255,0.12)',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <strong style={{ fontSize: '0.82rem', color: '#f1f5f9', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</strong>
                          <small style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.origin} ➔ {r.destination} ({r.distanceKm} km)</small>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: r.active ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', color: r.active ? '#10b981' : '#f43f5e', fontWeight: 700, flexShrink: 0 }}>
                        {r.active ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 2/3: Route Builder Map */}
            <div className="capital-split-right">
              <RouteBuilderMap
                mode="route"
                originName={routeForm.origin || 'Origin'}
                originLat={routeOriginCoords?.lat}
                originLng={routeOriginCoords?.lng}
                destinationName={routeForm.destination || 'Destination'}
                destinationLat={routeDestCoords?.lat}
                destinationLng={routeDestCoords?.lng}
                onMapClick={handleMapClickForRoute}
              />
            </div>
          </div>
        )}

        {/* 5. ROUTE STOPS MANAGEMENT (1/3 Controls : 2/3 Map) */}
        {section === 'stops' && (
          <div className="capital-split-screen">
            <div className="capital-split-left">
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                  Interchange & Stop Configuration
                </h2>
                <p style={{ fontSize: '0.8rem', margin: '2px 0 0', color: 'var(--muted)' }}>
                  Select route corridor below. Click anywhere along the blue route line on right to drop a stop pin.
                </p>
              </div>

              {/* Route Selector */}
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Active Route Corridor</label>
                <SearchableSelect
                  value={selectedStopRouteId || undefined}
                  onChange={(val) => setSelectedStopRouteId(Number(val))}
                  options={(routes || []).map((r) => ({
                    value: r.id,
                    label: r.name,
                    sublabel: `${r.origin} ➔ ${r.destination}`,
                    badge: `${r.distanceKm} km`
                  }))}
                  placeholder="Select route corridor..."
                />
              </div>

              {/* Add Stop Form */}
              <div className="capital-card" style={{ padding: '0.85rem', marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  + Add Intermediate Stop
                </span>
                <div>
                  <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Stop / Interchange Name</label>
                  <input
                    type="text"
                    value={newStopForm.name}
                    onChange={(e) => setNewStopForm({ ...newStopForm, name: e.target.value })}
                    placeholder="e.g. Kadawatha Interchange"
                    style={{ width: '100%', padding: '7px 9px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Minutes from Start</label>
                    <input
                      type="number"
                      min={1}
                      value={newStopForm.minutes}
                      onChange={(e) => setNewStopForm({ ...newStopForm, minutes: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: '100%', padding: '7px 9px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>GPS Lat / Lng</label>
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', padding: '7px 8px', background: '#090d14', border: '1px solid #334155', borderRadius: '8px', fontFamily: 'monospace' }}>
                      {newStopForm.lat.toFixed(4)}, {newStopForm.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddStopToWorking}
                  style={{
                    background: 'rgba(0, 229, 255, 0.15)',
                    color: '#00e5ff',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: '8px',
                    padding: '8px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  + Add Stop to Sequence
                </button>
              </div>

              {/* Current Stops List */}
              <div className="capital-card" style={{ padding: '0.85rem', marginTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>
                    Sequence of Stops ({workingStops.length})
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#00f5a0' }}>Order locked</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {workingStops.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: idx === 0 ? 'rgba(56, 189, 248, 0.1)' : idx === workingStops.length - 1 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid #1e293b',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: idx === 0 ? '#0284c7' : idx === workingStops.length - 1 ? '#e11d48' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>
                          {idx + 1}
                        </span>
                        <div>
                          <strong style={{ color: '#fff', display: 'block', fontSize: '0.82rem' }}>{s.name}</strong>
                          <small style={{ color: '#64748b' }}>+{s.minutesFromDeparture} mins</small>
                        </div>
                      </div>
                      {idx > 0 && idx < workingStops.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkingStop(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}
                          title="Remove stop"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveStopsToRoute}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Save All Stops to Route
                </button>
              </div>
            </div>

            {/* Right 2/3: Route Stops Interactive Map with Blue Line */}
            <div className="capital-split-right">
              {(() => {
                const targetRoute = routes?.find((r) => r.id === selectedStopRouteId);
                return (
                  <RouteBuilderMap
                    mode="stops"
                    originName={targetRoute?.origin || 'Origin'}
                    destinationName={targetRoute?.destination || 'Destination'}
                    stops={workingStops}
                    onMapClick={(lat, lng, suggested) => {
                      setNewStopForm({
                        name: suggested || `Stop at ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
                        minutes: (workingStops.length) * 20,
                        lat,
                        lng
                      });
                    }}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* 6. TRIP ASSIGNMENT & JOURNEYS (1/3 Controls : 2/3 Table/Map) */}
        {section === 'schedules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {/* Top Toolbar: Heading, Status Filters, Search, Add Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-heading, #fff)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={22} color="#38bdf8" /> Commercial Trip Schedules
                </h2>
                <p style={{ fontSize: '0.82rem', margin: '3px 0 0', color: 'var(--muted, #94a3b8)' }}>
                  Monitor scheduled journeys, departure timetables, assigned coaches, and driver/conductor crew dispatch.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleRefresh}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                >
                  <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh
                </button>

                <button
                  type="button"
                  onClick={openAssignTripModal}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                    color: '#090d14',
                    fontWeight: 800,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  <Plus size={16} /> Add Trip Schedule
                </button>
              </div>
            </div>

            {/* Filter toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['ALL', 'PUBLISHED', 'CONFIRMED', 'IN_TRANSIT', 'ARRIVED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setScheduleFilter(st);
                      setSchedulePage(1);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: scheduleFilter === st ? '#0284c7' : '#334155',
                      background: scheduleFilter === st ? '#0284c7' : 'rgba(255, 255, 255, 0.03)',
                      color: scheduleFilter === st ? '#fff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Quick Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid #334155', borderRadius: '8px', padding: '5px 10px', minWidth: '220px' }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Filter journeys, bus or crew..."
                  value={scheduleSearch}
                  onChange={(e) => {
                    setScheduleSearch(e.target.value);
                    setSchedulePage(1);
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', outline: 'none', width: '100%' }}
                />
              </div>
            </div>

              {(() => {
                const allItems = schedulesPage?.items || [];
                const filteredSchedules = allItems.filter((s) => scheduleFilter === 'ALL' || s.status === scheduleFilter);
                const totalSchedulePages = Math.max(1, Math.ceil(filteredSchedules.length / SCHEDULES_PER_PAGE));
                const safeCurrentPage = Math.min(schedulePage, totalSchedulePages);
                const displayedSchedules = filteredSchedules.slice(
                  (safeCurrentPage - 1) * SCHEDULES_PER_PAGE,
                  safeCurrentPage * SCHEDULES_PER_PAGE
                );

                return (
                  <div className="capital-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}>
                    <table className="capital-table" style={{ minWidth: '840px', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '85px' }}>Trip ID</th>
                          <th>Route Corridor</th>
                          <th>Departure & Arrival</th>
                          <th>Assigned Bus</th>
                          <th>Driver & Conductor</th>
                          <th>Fare</th>
                          <th>Trip Status</th>
                          <th style={{ textAlign: 'right', paddingRight: '1.25rem', minWidth: '130px', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedSchedules.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                              No scheduled journeys found for status "{scheduleFilter}". Assign a trip using the form on the left.
                            </td>
                          </tr>
                        ) : (
                          displayedSchedules.map((s) => (
                            <tr key={s.id}>
                              <td><strong>#{s.id}</strong></td>
                              <td>
                                <strong style={{ color: '#00e5ff', display: 'block' }}>{s.origin} ➔ {s.destination}</strong>
                                <small style={{ color: '#64748b' }}>Route #{s.routeId}</small>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>
                                  {new Date(s.departure).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                  <strong>{new Date(s.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                                </div>
                                <small style={{ color: '#64748b' }}>Arr: {new Date(s.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                              </td>
                              <td>
                                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{s.bus?.registration || 'Assigned'}</span>
                                <br /><small style={{ color: '#64748b' }}>{s.bus?.model}</small>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.8rem' }}>
                                  <span style={{ color: '#cbd5e1' }}>Dr: {s.driver?.name || 'Driver'}</span>
                                  {s.driver?.online !== undefined && (
                                    <span style={{ marginLeft: '4px', fontSize: '0.72rem', color: s.driver.online ? '#10b981' : '#94a3b8' }}>
                                      ({s.driver.online ? 'Online' : 'Offline'})
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.78rem' }}>
                                  <span style={{ color: '#94a3b8' }}>Cn: {s.conductor?.name || 'Conductor'}</span>
                                  {s.conductor?.online !== undefined && (
                                    <span style={{ marginLeft: '4px', fontSize: '0.72rem', color: s.conductor.online ? '#10b981' : '#94a3b8' }}>
                                      ({s.conductor.online ? 'Online' : 'Offline'})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td><strong>LKR {s.fare.toLocaleString()}</strong></td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background:
                                      s.status === 'CONFIRMED'
                                        ? 'rgba(16, 185, 129, 0.2)'
                                        : s.status === 'IN_TRANSIT'
                                        ? 'rgba(0, 229, 255, 0.2)'
                                        : s.status === 'ARRIVED'
                                        ? 'rgba(168, 85, 247, 0.2)'
                                        : s.status === 'CANCELLED'
                                        ? 'rgba(244, 63, 94, 0.2)'
                                        : 'rgba(245, 158, 11, 0.2)',
                                    color:
                                      s.status === 'CONFIRMED'
                                        ? '#10b981'
                                        : s.status === 'IN_TRANSIT'
                                        ? '#00e5ff'
                                        : s.status === 'ARRIVED'
                                        ? '#c084fc'
                                        : s.status === 'CANCELLED'
                                        ? '#f43f5e'
                                        : '#f59e0b'
                                  }}
                                >
                                  {s.status === 'PUBLISHED' ? 'ASSIGNED' : s.status}
                                </span>
                                {s.crewOnline === false && (
                                  <div style={{ marginTop: '4px' }}>
                                    <span
                                      className="badge"
                                      style={{
                                        background: 'rgba(148, 163, 184, 0.15)',
                                        color: '#94a3b8',
                                        fontSize: '0.68rem',
                                        padding: '2px 6px',
                                        border: '1px solid rgba(148, 163, 184, 0.3)',
                                      }}
                                      title="Hidden from passenger searches because Driver or Conductor is offline"
                                    >
                                      ⚪ Crew Offline (Hidden)
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: '1.25rem', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteJourney(s.id)}
                                    style={{
                                      background: 'rgba(244, 63, 94, 0.12)',
                                      color: '#fb7185',
                                      border: '1px solid rgba(244, 63, 94, 0.35)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`Delete Journey #${s.id}`}
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination Bar (10 per page) */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1.25rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(15, 23, 42, 0.6)',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Showing{' '}
                        <strong style={{ color: '#f8fafc' }}>
                          {filteredSchedules.length === 0 ? 0 : (safeCurrentPage - 1) * SCHEDULES_PER_PAGE + 1}
                        </strong>
                        {' '}to{' '}
                        <strong style={{ color: '#f8fafc' }}>
                          {Math.min(safeCurrentPage * SCHEDULES_PER_PAGE, filteredSchedules.length)}
                        </strong>
                        {' '}of{' '}
                        <strong style={{ color: '#00e5ff' }}>{filteredSchedules.length}</strong> journeys (10 per page)
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={safeCurrentPage <= 1}
                          onClick={() => setSchedulePage(Math.max(1, safeCurrentPage - 1))}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #334155',
                            background: safeCurrentPage <= 1 ? 'rgba(51, 65, 85, 0.2)' : 'rgba(51, 65, 85, 0.6)',
                            color: safeCurrentPage <= 1 ? '#64748b' : '#f1f5f9',
                            cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Previous
                        </button>

                        {Array.from({ length: totalSchedulePages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalSchedulePages || Math.abs(p - safeCurrentPage) <= 1)
                          .map((p, idx, arr) => (
                            <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span style={{ color: '#64748b', padding: '0 4px', fontSize: '0.75rem' }}>…</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSchedulePage(p)}
                                style={{
                                  padding: '4px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: p === safeCurrentPage ? 700 : 500,
                                  borderRadius: '6px',
                                  border: '1px solid',
                                  borderColor: p === safeCurrentPage ? '#00e5ff' : '#334155',
                                  background: p === safeCurrentPage ? '#00e5ff' : 'transparent',
                                  color: p === safeCurrentPage ? '#090d14' : '#94a3b8',
                                  cursor: 'pointer',
                                  minWidth: '28px'
                                }}
                              >
                                {p}
                              </button>
                            </span>
                          ))}

                        <button
                          type="button"
                          disabled={safeCurrentPage >= totalSchedulePages}
                          onClick={() => setSchedulePage(Math.min(totalSchedulePages, safeCurrentPage + 1))}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #334155',
                            background: safeCurrentPage >= totalSchedulePages ? 'rgba(51, 65, 85, 0.2)' : 'rgba(51, 65, 85, 0.6)',
                            color: safeCurrentPage >= totalSchedulePages ? '#64748b' : '#f1f5f9',
                            cursor: safeCurrentPage >= totalSchedulePages ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* Add Commercial Trip Schedule Modal */}
        {assignTripModalOpen && (
          <div
            className="portal-modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={() => setAssignTripModalOpen(false)}
          >
            <div
              className="portal-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '560px',
                width: '100%',
                maxHeight: '92vh',
                overflowY: 'auto',
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} color="#38bdf8" /> Add Trip Schedule
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Select corridor, coach bus, and crew. Dispatches immediate duty notifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignTripModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              {(conflictError || activeConflict) && (
                <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#ef4444', display: 'block' }}>Resource Scheduling Conflict Detected</strong>
                    <span>{conflictError || activeConflict?.reason}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleAssignTripSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Route Corridor</label>
                  <SearchableSelect
                    value={tripRouteId}
                    onChange={(val) => setTripRouteId(val ? Number(val) : undefined)}
                    options={(routes || []).map((r) => ({
                      value: r.id,
                      label: r.name,
                      sublabel: `${r.origin} ➔ ${r.destination}`,
                      badge: `${r.distanceKm} km`
                    }))}
                    placeholder="Search corridor..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Departure Date</label>
                    <input
                      type="date"
                      required
                      value={tripDepartureDate}
                      onChange={(e) => setTripDepartureDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.84rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Departure Time</label>
                    <input
                      type="time"
                      required
                      value={tripDepartureTime}
                      onChange={(e) => setTripDepartureTime(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.84rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Assign Coach (Bus)</label>
                  <SearchableSelect
                    value={tripBusId}
                    onChange={(val) => {
                      setTripBusId(val ? Number(val) : undefined);
                      setConflictError(null);
                    }}
                    error={selectedBusConflict ? selectedBusConflict.reason : null}
                    onSelectDisabled={(opt) => {
                      const msg = opt.disabledReason || "This coach is already assigned to another journey at this time and cannot be in two places at the same time.";
                      setConflictError(msg);
                      alert(`⚠️ Assignment Error: ${msg}`);
                    }}
                    options={(buses || []).map((b) => {
                      const conflict = checkBusConflict(b, plannedTripWindow, allTripsForConflict);
                      const isOperational = b.status !== 'MAINTENANCE' && b.status !== 'OUT_OF_SERVICE';
                      return {
                        value: b.id,
                        label: b.registration,
                        sublabel: conflict
                          ? `🔴 Assigned to Trip #${conflict.tripId} (${conflict.timeWindow}) • In Use`
                          : (!isOperational
                            ? `⚠️ ${b.status === 'MAINTENANCE' ? 'Maintenance In Progress' : 'Out of Service'} • ${b.model}`
                            : `🟢 Available & Ready • ${b.model} • ${b.capacity} seats`),
                        badge: conflict ? 'ASSIGNED' : (isOperational ? 'AVAILABLE' : (b.status || 'UNAVAILABLE')),
                        badgeColor: conflict ? '#ef4444' : (isOperational ? '#10b981' : '#f59e0b'),
                        disabled: Boolean(conflict || !isOperational),
                        disabledReason: conflict
                          ? conflict.reason
                          : (!isOperational ? `Coach ${b.registration} status is currently ${b.status}. Only operational coaches can be assigned.` : undefined)
                      };
                    })}
                    placeholder="Search fleet buses..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Assign Bus Driver (Captain)</label>
                  <SearchableSelect
                    value={tripDriverId}
                    onChange={(val) => {
                      setTripDriverId(val ? Number(val) : undefined);
                      setConflictError(null);
                    }}
                    error={selectedDriverConflict ? selectedDriverConflict.reason : null}
                    onSelectDisabled={(opt) => {
                      const msg = opt.disabledReason || "This driver is already assigned to another journey at this time and cannot be in two places at the same time.";
                      setConflictError(msg);
                      alert(`⚠️ Assignment Error: ${msg}`);
                    }}
                    options={drivers.map((d) => {
                      const conflict = checkDriverConflict(d, plannedTripWindow, allTripsForConflict);
                      const isAvail = Boolean(d.available && (!d.status || d.status === 'ACTIVE'));
                      return {
                        value: d.id,
                        label: d.name,
                        sublabel: conflict
                          ? `🔴 Assigned to Trip #${conflict.tripId} (${conflict.timeWindow}) • In Service`
                          : (!isAvail
                            ? `⚪ Offline (Off-duty) • Lic: ${d.licenseNumber || 'LK-DRV'} • ${d.phone}`
                            : `🟢 Online & Ready • Lic: ${d.licenseNumber || 'LK-DRV'} • ${d.phone}`),
                        badge: conflict ? 'ASSIGNED' : (isAvail ? 'ONLINE' : 'OFFLINE'),
                        badgeColor: conflict ? '#ef4444' : (isAvail ? '#10b981' : '#64748b'),
                        disabled: Boolean(conflict || !isAvail),
                        disabledReason: conflict
                          ? conflict.reason
                          : (!isAvail ? `Driver ${d.name} is currently Offline (Off-duty).` : undefined)
                      };
                    })}
                    placeholder="Search licensed drivers..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Assign Conductor</label>
                  <SearchableSelect
                    value={tripConductorId}
                    onChange={(val) => {
                      setTripConductorId(val ? Number(val) : undefined);
                      setConflictError(null);
                    }}
                    error={selectedConductorConflict ? selectedConductorConflict.reason : null}
                    onSelectDisabled={(opt) => {
                      const msg = opt.disabledReason || "This conductor is already assigned to another journey at this time and cannot be in two places at the same time.";
                      setConflictError(msg);
                      alert(`⚠️ Assignment Error: ${msg}`);
                    }}
                    options={conductors.map((c) => {
                      const conflict = checkConductorConflict(c, plannedTripWindow, allTripsForConflict);
                      const isAvail = Boolean(c.available && (!c.status || c.status === 'ACTIVE'));
                      return {
                        value: c.id,
                        label: c.name,
                        sublabel: conflict
                          ? `🔴 Assigned to Trip #${conflict.tripId} (${conflict.timeWindow}) • In Service`
                          : (!isAvail
                            ? `⚪ Offline (Off-duty) • Lic: ${c.licenseNumber || 'LK-CND'} • ${c.phone}`
                            : `🟢 Online & Ready • Lic: ${c.licenseNumber || 'LK-CND'} • ${c.phone}`),
                        badge: conflict ? 'ASSIGNED' : (isAvail ? 'ONLINE' : 'OFFLINE'),
                        badgeColor: conflict ? '#ef4444' : (isAvail ? '#10b981' : '#64748b'),
                        disabled: Boolean(conflict || !isAvail),
                        disabledReason: conflict
                          ? conflict.reason
                          : (!isAvail ? `Conductor ${c.name} is currently Offline (Off-duty).` : undefined)
                      };
                    })}
                    placeholder="Search verified conductors..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Base Ticket Fare (LKR)</label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    value={tripFare}
                    onChange={(e) => setTripFare(parseInt(e.target.value, 10) || 1850)}
                    style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setAssignTripModalOpen(false)}
                    style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || Boolean(activeConflict)}
                    style={{
                      background: activeConflict ? '#334155' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
                      color: activeConflict ? '#94a3b8' : '#090d14',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '0.84rem',
                      cursor: activeConflict ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving ? 'Assigning...' : (activeConflict ? '⚠️ Resolve Scheduling Conflict' : 'Assign Trip & Dispatch Crew')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. LIVE DISPATCH & DELAYS */}
        {section === 'dispatch' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>Live Highway Dispatch & Telemetry</h2>
                <p style={{ fontSize: '0.85rem', margin: '0.2rem 0 0', color: 'var(--muted)' }}>Real-time vehicle telemetry, delay broadcasts, and GPS status for all operational routes.</p>
              </div>
              <button type="button" className="btn" onClick={() => reloadTrips()}>
                <RefreshCw size={13} /> Refresh Telemetry
              </button>
            </div>

            <div className="portal-card">
              <div className="portal-card-header">
                <h2><Radio size={20} color="#38ef7d" /> Active Commercial Trips</h2>
              </div>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Route</th>
                      <th>Bus</th>
                      <th>Driver / Conductor</th>
                      <th>Progress</th>
                      <th>Delay Status</th>
                      <th>Dispatch Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTrips?.items || [])
                      .filter((t) => t.status === 'PUBLISHED' || t.status === 'IN_TRANSIT' || t.status === 'BOARDING')
                      .map((t) => (
                        <tr key={t.id}>
                          <td><strong>#{t.id}</strong></td>
                          <td>
                            <strong>{t.origin} → {t.destination}</strong>
                            <br /><small style={{ color: '#94a3b8' }}>Dep: {new Date(t.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                          </td>
                          <td><span style={{ color: '#00e5ff' }}>{t.bus?.registration || 'Assigned'}</span></td>
                          <td>
                            {t.driver?.name || 'Driver'}<br />
                            <small style={{ color: '#94a3b8' }}>Cond: {t.conductor?.name || 'Conductor'}</small>
                          </td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(56, 239, 125, 0.15)', color: '#38ef7d' }}>
                              {t.status}
                            </span>
                          </td>
                          <td>
                            {t.delayMinutes > 0 ? (
                              <span style={{ color: '#ff5252', fontWeight: 600 }}>+{t.delayMinutes} mins delay</span>
                            ) : (
                              <span style={{ color: '#38ef7d' }}>On Schedule</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={async () => {
                                const mins = prompt('Enter delay minutes to broadcast to passengers:', '15');
                                if (mins) {
                                  await api.put(`/trips/${t.id}/delay`, { delayMinutes: parseInt(mins, 10) });
                                  reloadTrips();
                                }
                              }}
                            >
                              Broadcast Delay
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ----------------- MODALS ----------------- */}
      {/* Bus Modal */}
      {busModalOpen && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal-content">
            <div className="portal-modal-header">
              <h3>{editingBus ? 'Edit Vehicle Profile' : 'Register New Fleet Bus'}</h3>
              <button type="button" className="icon-button" onClick={() => setBusModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveBus} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="portal-form-grid">
                <div className="portal-form-field">
                  <label>Registration Number</label>
                  <input
                    type="text"
                    required
                    value={busForm.registration}
                    onChange={(e) => setBusForm({ ...busForm, registration: e.target.value })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Model & Chassis</label>
                  <input
                    type="text"
                    required
                    value={busForm.model}
                    onChange={(e) => setBusForm({ ...busForm, model: e.target.value })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Seating Capacity</label>
                  <input
                    type="number"
                    min="10"
                    max="60"
                    required
                    value={busForm.capacity}
                    onChange={(e) => setBusForm({ ...busForm, capacity: parseInt(e.target.value, 10) })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Comfort Tier</label>
                  <select
                    value={busForm.type}
                    onChange={(e) => setBusForm({ ...busForm, type: e.target.value })}
                  >
                    <option value="Premium AC">Premium AC</option>
                    <option value="Luxury Express">Luxury Express</option>
                    <option value="Semi-Luxury">Semi-Luxury</option>
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Operational Status</label>
                  <select
                    value={busForm.status}
                    onChange={(e) => setBusForm({ ...busForm, status: e.target.value })}
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                  </select>
                </div>
              </div>
              <div className="portal-form-field">
                <label>Passenger Amenities & Features</label>
                <input
                  type="text"
                  value={busForm.features}
                  onChange={(e) => setBusForm({ ...busForm, features: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setBusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Bus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Route Modal */}
      {routeModalOpen && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal-content">
            <div className="portal-modal-header">
              <h3>{editingRoute ? 'Edit Route' : 'Create New Route'}</h3>
              <button type="button" className="icon-button" onClick={() => setRouteModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="portal-form-field">
                <label>Route Title</label>
                <input
                  type="text"
                  required
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                />
              </div>
              <div className="portal-form-grid">
                <div className="portal-form-field">
                  <label>Origin Terminal</label>
                  <input
                    type="text"
                    required
                    value={routeForm.origin}
                    onChange={(e) => setRouteForm({ ...routeForm, origin: e.target.value })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Destination Terminal</label>
                  <input
                    type="text"
                    required
                    value={routeForm.destination}
                    onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={routeForm.distanceKm}
                    onChange={(e) => setRouteForm({ ...routeForm, distanceKm: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Operational Status</label>
                  <select
                    value={routeForm.active ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setRouteForm({ ...routeForm, active: e.target.value === 'ACTIVE' })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
              <RouteImageUploader
                value={routeForm.imageUrl}
                onChange={(url) => setRouteForm({ ...routeForm, imageUrl: url })}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setRouteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal with Conflict Detection */}
      {scheduleModalOpen && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal-content">
            <div className="portal-modal-header">
              <h3>Create Scheduled Trip</h3>
              <button type="button" className="icon-button" onClick={() => setScheduleModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            {conflictError && (
              <div style={{ background: 'rgba(255, 75, 75, 0.15)', border: '1px solid #ff5252', color: '#fff', padding: '0.9rem', borderRadius: '12px', display: 'flex', gap: '0.6rem' }}>
                <AlertTriangle size={20} color="#ff5252" />
                <div>
                  <strong style={{ display: 'block', color: '#ff5252' }}>Scheduling Conflict Detected</strong>
                  <span style={{ fontSize: '0.85rem' }}>{conflictError}</span>
                </div>
              </div>
            )}
            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="portal-form-grid">
                <div className="portal-form-field">
                  <label>Select Route</label>
                  <select
                    value={scheduleForm.routeId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, routeId: parseInt(e.target.value, 10) })}
                  >
                    {routes?.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.origin} → {r.destination})</option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Assign Bus (Available Fleet)</label>
                  <select
                    value={scheduleForm.busId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, busId: parseInt(e.target.value, 10) })}
                  >
                    {buses?.filter((b) => b.status === 'AVAILABLE').map((b) => (
                      <option key={b.id} value={b.id}>{b.registration} ({b.model} - {b.type})</option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Assign Driver</label>
                  <select
                    value={scheduleForm.driverId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, driverId: parseInt(e.target.value, 10) })}
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.licenseNumber || 'Verified'})</option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Assign Conductor</label>
                  <select
                    value={scheduleForm.conductorId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, conductorId: parseInt(e.target.value, 10) })}
                  >
                    {conductors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.licenseNumber || 'Verified'})</option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Departure Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleForm.departure}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, departure: e.target.value })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Arrival Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleForm.arrival}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, arrival: e.target.value })}
                  />
                </div>
                <div className="portal-form-field">
                  <label>Fare Per Seat (LKR)</label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    required
                    value={scheduleForm.fare}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, fare: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Validating Conflicts...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default OperatorPortal;
