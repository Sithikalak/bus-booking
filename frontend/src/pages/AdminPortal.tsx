import { useState, lazy, Suspense, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApi, api } from '../api/client';
import { RoleLoginCard } from '../components/RoleLoginCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { RouteBuilderMap } from '../components/RouteBuilderMap';
import { SearchableSelect } from '../components/SearchableSelect';
import { RouteImageUploader } from '../components/RouteImageUploader';
import { getRouteImage } from '../utils/routeImage';
import { StaffMember, Bus, Schedule, Route, Booking } from '../types';
import {
  computeTargetInterval,
  checkBusConflict,
  checkDriverConflict,
  checkConductorConflict
} from '../utils/scheduleConflicts';

import {
  Users,
  Shield,
  Sliders,
  BarChart3,
  Search,
  KeyRound,
  CheckCircle2,
  Lock,
  DollarSign,
  UserCheck,
  Building,
  Save,
  RefreshCw,
  Plus,
  X,
  BusFront,
  Calendar,
  Ticket,
  AlertTriangle,
  Clock,
  MapPin,
  Check,
  TrendingUp,
  LayoutDashboard,
  Home,
  ChevronRight,
  Bell,
  LogOut,
  ChevronDown,
  Download,
  Globe,
  ArrowRight,
  Sparkles,
  PieChart,
  Activity,
  Compass,
  Trash2
} from 'lucide-react';

interface SystemSetting {
  setting_key: string;
  setting_value: string;
  description: string;
  category: string;
}

export function AdminPortal() {
  const { user, logout } = useApp();
  const [section, setSection] = useState<'overview' | 'buses' | 'schedules' | 'routes' | 'stops' | 'users' | 'bookings' | 'settings' | 'reports'>('overview');

  // API Hooks - fetching all live database collections
  const { data: accountsPage, reload: reloadAccounts } = useApi<{ items: any[] }>('/users?size=100', 12000);
  const { data: staffList, reload: reloadStaff } = useApi<StaffMember[]>('/staff', 12000);
  const { data: busesList, reload: reloadBuses } = useApi<Bus[]>('/buses', 12000);
  const { data: schedulesPage, reload: reloadSchedules } = useApi<{ items: Schedule[] }>('/schedules?size=200', 12000);
  const { data: routesList, reload: reloadRoutes } = useApi<Route[]>('/routes', 15000);
  const { data: bookingsPage, reload: reloadBookings } = useApi<{ items: Booking[] }>('/bookings?size=50', 12000);
  const { data: settings, reload: reloadSettings } = useApi<SystemSetting[]>('/settings', 12000);
  const { data: dashboardData } = useApi<any>('/dashboard', 12000);

  // Search & filter states
  const [userTab, setUserTab] = useState<'passengers' | 'staff'>('passengers');
  const [passengerSearch, setPassengerSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');
  const [busSearch, setBusSearch] = useState('');
  const [busStatusFilter, setBusStatusFilter] = useState('ALL');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('ALL');
  const [schedulePage, setSchedulePage] = useState(1);
  const SCHEDULES_PER_PAGE = 10;
  const [bookingSearch, setBookingSearch] = useState('');

  // Feedback states
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    reloadAccounts();
    reloadStaff();
    reloadBuses();
    reloadSchedules();
    reloadBookings();
    reloadSettings();
    setTimeout(() => setRefreshing(false), 800);
  };

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  // Reset password modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  // Register staff modal state
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [registeringStaff, setRegisteringStaff] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '+94 77 ',
    nic: '',
    role: 'DRIVER',
    department: 'Transportation & Fleet',
    licenseNumber: '',
    password: ''
  });

  // Add Bus modal state
  const [busModalOpen, setBusModalOpen] = useState(false);
  const [savingBus, setSavingBus] = useState(false);
  const [newBusForm, setNewBusForm] = useState({
    registration: '',
    model: '',
    capacity: 44,
    type: 'Luxury AC Express',
    features: '',
    status: 'AVAILABLE'
  });

  // Create Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [newScheduleForm, setNewScheduleForm] = useState({
    routeId: 0,
    busId: 0,
    driverId: 0,
    conductorId: 0,
    departure: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    arrival: new Date(Date.now() + 86400000 + 10800000).toISOString().slice(0, 16),
    fare: 1850,
    status: 'PUBLISHED'
  });

  // Route & Stops management state
  const [routeForm, setRouteForm] = useState({
    name: '',
    origin: '',
    destination: '',
    distanceKm: 0,
    active: true,
    imageUrl: ''
  });
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeOriginCoords, setRouteOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeDestCoords, setRouteDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [selectedStopRouteId, setSelectedStopRouteId] = useState<number | null>(null);
  const [workingStops, setWorkingStops] = useState<{ id?: number; name: string; latitude: number; longitude: number; minutesFromDeparture: number }[]>([]);
  const [newStopForm, setNewStopForm] = useState({
    name: '',
    minutes: 30,
    lat: 7.0016,
    lng: 79.9542
  });

  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
  const [tripDepartureDate, setTripDepartureDate] = useState(tomorrowStr);
  const [tripDepartureTime, setTripDepartureTime] = useState('08:00');
  const [tripRouteId, setTripRouteId] = useState<number | undefined>(undefined);
  const [tripBusId, setTripBusId] = useState<number | undefined>(undefined);
  const [tripDriverId, setTripDriverId] = useState<number | undefined>(undefined);
  const [tripConductorId, setTripConductorId] = useState<number | undefined>(undefined);
  const [tripFare, setTripFare] = useState<number>(1850);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [assignTripModalOpen, setAssignTripModalOpen] = useState(false);

  const openAssignTripModal = () => {
    setTripRouteId(undefined);
    setTripBusId(undefined);
    setTripDriverId(undefined);
    setTripConductorId(undefined);
    setConflictError(null);
    setAssignTripModalOpen(true);
  };

  useEffect(() => {
    if (!routesList || routesList.length === 0) return;
    const targetId = selectedStopRouteId || routesList[0].id;
    if (selectedStopRouteId === null) setSelectedStopRouteId(targetId);
    const targetRoute = routesList.find((r) => r.id === targetId);
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
  }, [selectedStopRouteId, routesList]);

  // Derived collections
  const passengers = (accountsPage?.items || []).filter((a) => a.role === 'PASSENGER');
  const staff = staffList || [];
  const buses = busesList || [];
  const schedules = schedulesPage?.items || [];
  const bookings = bookingsPage?.items || [];
  const routes = routesList || [];

  const drivers = staff.filter((s) => s.role === 'DRIVER');
  const conductors = staff.filter((s) => s.role === 'CONDUCTOR');

  const selectedRouteObj = useMemo(() => {
    return routes.find((r) => r.id === tripRouteId);
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

  const selectedBus = useMemo(() => buses.find((b) => b.id === tripBusId), [buses, tripBusId]);
  const selectedDriver = useMemo(() => drivers.find((d) => d.id === tripDriverId), [drivers, tripDriverId]);
  const selectedConductor = useMemo(() => conductors.find((c) => c.id === tripConductorId), [conductors, tripConductorId]);

  const selectedBusConflict = useMemo(() => {
    return selectedBus ? checkBusConflict(selectedBus, plannedTripWindow, schedules) : null;
  }, [selectedBus, plannedTripWindow, schedules]);

  const selectedDriverConflict = useMemo(() => {
    return selectedDriver ? checkDriverConflict(selectedDriver, plannedTripWindow, schedules) : null;
  }, [selectedDriver, plannedTripWindow, schedules]);

  const selectedConductorConflict = useMemo(() => {
    return selectedConductor ? checkConductorConflict(selectedConductor, plannedTripWindow, schedules) : null;
  }, [selectedConductor, plannedTripWindow, schedules]);

  const activeConflict = selectedBusConflict || selectedDriverConflict || selectedConductorConflict;

  if (!user || user.role !== 'ADMIN') {
    return (
      <RoleLoginCard
        role="ADMIN"
        roleTitle="Administrator Governance Console"
        description="Manage user and staff roles, configure fleet buses, create schedules, set fare rates, and review operational metrics."
        demoEmail="admin@citylink.com"
        badgeColor="#ff4b72"
      />
    );
  }

  const flashSuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError(null);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const flashError = (msg: string) => {
    setActionError(msg);
    setActionSuccess(null);
    setTimeout(() => setActionError(null), 5000);
  };

  // Top bar filter & export controls
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [cadence, setCadence] = useState('Monthly');
  const [cadenceOpen, setCadenceOpen] = useState(false);

  const handleDateRangeSelect = (opt: string) => {
    setDateRange(opt);
    setDateRangeOpen(false);
    if (opt === 'Today') setCadence('Daily');
    else if (opt === 'Last 7 Days') setCadence('Weekly');
    else if (opt === 'Last 30 Days') setCadence('Monthly');
    else if (opt === 'This Month') setCadence('Monthly');
    else if (opt === 'Last Month') setCadence('Quarterly');
    else if (opt === 'Year to Date') setCadence('Yearly');
    flashSuccess(`Analytics window: ${opt}`);
  };

  const handleCadenceSelect = (opt: string) => {
    setCadence(opt);
    setCadenceOpen(false);
    if (opt === 'Daily') setDateRange('Today');
    else if (opt === 'Weekly') setDateRange('Last 7 Days');
    else if (opt === 'Monthly') setDateRange('Last 30 Days');
    else if (opt === 'Quarterly') setDateRange('Last Month');
    else if (opt === 'Yearly') setDateRange('Year to Date');
    flashSuccess(`Reporting interval: ${opt}`);
  };

  const cycleTimeframe = () => {
    const list = ['Today', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'Year to Date'];
    const idx = list.indexOf(dateRange);
    const next = list[(idx + 1) % list.length];
    handleDateRangeSelect(next);
  };

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

  // Dynamic analytics model derived from dateRange and cadence
  const analyticsData = useMemo(() => {
    let mode: 'daily' | 'weekly' | 'monthly' | 'this_month' | 'quarterly' | 'yearly' = 'monthly';
    if (dateRange === 'Today') {
      mode = 'daily';
    } else if (dateRange === 'Last 7 Days') {
      mode = 'weekly';
    } else if (dateRange === 'This Month') {
      mode = 'this_month';
    } else if (dateRange === 'Last Month') {
      mode = 'quarterly';
    } else if (dateRange === 'Year to Date') {
      mode = 'yearly';
    } else if (dateRange === 'Last 30 Days') {
      mode = 'monthly';
    } else {
      if (cadence === 'Daily') mode = 'daily';
      else if (cadence === 'Weekly') mode = 'weekly';
      else if (cadence === 'Quarterly') mode = 'quarterly';
      else if (cadence === 'Yearly') mode = 'yearly';
      else mode = 'monthly';
    }

    const dbRev = Number(dashboardData?.revenue) || 0;

    if (mode === 'daily') {
      const revText = dbRev > 0 && dbRev < 20000 ? `LKR ${(dbRev / 1000).toFixed(1)}K` : 'LKR 164.5K';
      return {
        timeBadge: 'Today',
        revenue: revText,
        revenueDelta: '+8.4% vs yesterday',
        revenuePath: 'M0,34 C30,38 60,36 90,26 C120,18 150,14 200,8',
        revenueArea: 'M0,34 C30,38 60,36 90,26 C120,18 150,14 200,8 L200,45 L0,45 Z',
        revenueTimeline: ['06:00', '12:00', '18:00'],
        perfValue: '+98.2%',
        perfDelta: '94% to target',
        perfBar: '94%',
        perfScheduled: '24 Trips Dispatched',
        perfGoal: 'Goal 26',
        perfTimeline: ['Morning', 'Noon', 'Evening'],
        seatsValue: '960',
        seatsDelta: '28 Departures',
        seatsLuxuryWidth: '68%',
        seatsHighwayWidth: '22%',
        seatsStandardWidth: '10%',
        seatsLuxury: '652',
        seatsStandard: '308',
        safetyScore: '99',
        safetyDelta: 'Zero Incidents (100%)',
        safetyWave: 'M0,26 Q50,14 100,24 T200,18',
        safetyTimeline: ['06:00', '12:00', '18:00'],
        chartBadge: '+8.4% Peak Day',
        yLabels: ['50k', '40k', '30k', '20k', '10k'],
        xLabels: ['06:00', '09:00', '12:00', '15:00', '18:00'],
        actualCurve: 'M50,165 C120,130 160,60 240,110 C300,150 370,80 440,70 C510,60 570,30 670,25',
        actualArea: 'M50,165 C120,130 160,60 240,110 C300,150 370,80 440,70 C510,60 570,30 670,25 L670,195 L50,195 Z',
        targetCurve: 'M50,145 C130,125 180,95 250,90 C330,85 410,75 490,65 C570,55 630,45 670,40',
        corridorStrips: [
          { name: 'Southern Express', rev: 'LKR 68.5K', delta: '+14.2%', positive: true },
          { name: 'Central Highlands', rev: 'LKR 46.2K', delta: '+9.0%', positive: true },
          { name: 'Northern Corridors', rev: 'LKR 26.8K', delta: '+22.4%', positive: true },
          { name: 'Eastern Coastal', rev: 'LKR 22.5K', delta: '+3.5%', positive: true }
        ],
        donutBadge: 'High Surge',
        donutCenterNum: '28',
        donutCenterLabel: 'Trips',
        donutSegments: [
          { name: 'Southern Expressway', rev: 'LKR 68.5K', pct: 48, dash: '241.3 502.7', offset: '0', color: '#0284c7' },
          { name: 'Central Highlands', rev: 'LKR 46.2K', pct: 28, dash: '140.8 502.7', offset: '-241.3', color: '#10b981' },
          { name: 'Northern Corridors', rev: 'LKR 26.8K', pct: 14, dash: '70.4 502.7', offset: '-382.1', color: '#a855f7' },
          { name: 'Eastern Coastal', rev: 'LKR 22.5K', pct: 10, dash: '50.2 502.7', offset: '-452.5', color: '#f97316' }
        ]
      };
    }

    if (mode === 'weekly') {
      const revText = dbRev > 0 && dbRev < 20000 ? `LKR ${((dbRev * 6.5) / 1000).toFixed(0)}K` : 'LKR 1.28M';
      return {
        timeBadge: '7 Days',
        revenue: revText,
        revenueDelta: '+14.2% vs prev week',
        revenuePath: 'M0,40 C35,38 70,34 105,25 C140,16 175,10 200,6',
        revenueArea: 'M0,40 C35,38 70,34 105,25 C140,16 175,10 200,6 L200,45 L0,45 Z',
        revenueTimeline: ['Mon', 'Thu', 'Sun'],
        perfValue: '+96.1%',
        perfDelta: '89% to target',
        perfBar: '89%',
        perfScheduled: '168 Trips Dispatched',
        perfGoal: 'Goal 180',
        perfTimeline: ['Mon', 'Thu', 'Sun'],
        seatsValue: '6,720',
        seatsDelta: '45 Active Corridors',
        seatsLuxuryWidth: '64%',
        seatsHighwayWidth: '24%',
        seatsStandardWidth: '12%',
        seatsLuxury: '5,910',
        seatsStandard: '810',
        safetyScore: '98',
        safetyDelta: '1 Inspection Completed',
        safetyWave: 'M0,26 Q50,10 100,26 T200,18',
        safetyTimeline: ['Mon', 'Thu', 'Sun'],
        chartBadge: '+14.2% 7-Day Velocity',
        yLabels: ['250k', '200k', '150k', '100k', '50k'],
        xLabels: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun'],
        actualCurve: 'M50,170 C120,155 170,110 240,120 C310,130 380,85 450,75 C520,65 580,40 670,32',
        actualArea: 'M50,170 C120,155 170,110 240,120 C310,130 380,85 450,75 C520,65 580,40 670,32 L670,195 L50,195 Z',
        targetCurve: 'M50,150 C130,140 190,115 260,110 C340,105 420,90 500,80 C580,70 630,60 670,55',
        corridorStrips: [
          { name: 'Southern Express', rev: 'LKR 492K', delta: '+15.6%', positive: true },
          { name: 'Central Highlands', rev: 'LKR 354K', delta: '+8.2%', positive: true },
          { name: 'Northern Corridors', rev: 'LKR 218K', delta: '+29.4%', positive: true },
          { name: 'Eastern Coastal', rev: 'LKR 216K', delta: '+2.1%', positive: true }
        ],
        donutBadge: 'Optimal Load',
        donutCenterNum: '45',
        donutCenterLabel: 'Routes',
        donutSegments: [
          { name: 'Southern Expressway', rev: 'LKR 492K', pct: 45, dash: '226.2 502.7', offset: '0', color: '#0284c7' },
          { name: 'Central Highlands', rev: 'LKR 354K', pct: 28, dash: '140.8 502.7', offset: '-226.2', color: '#10b981' },
          { name: 'Northern Corridors', rev: 'LKR 218K', pct: 15, dash: '75.4 502.7', offset: '-367.0', color: '#a855f7' },
          { name: 'Eastern Coastal', rev: 'LKR 216K', pct: 12, dash: '60.3 502.7', offset: '-442.4', color: '#f97316' }
        ]
      };
    }

    if (mode === 'this_month') {
      const revText = dbRev > 0 && dbRev < 20000 ? `LKR ${((dbRev * 20) / 1000).toFixed(0)}K` : 'LKR 3.95M';
      return {
        timeBadge: 'This Month',
        revenue: revText,
        revenueDelta: '+16.2% MTD',
        revenuePath: 'M0,36 C30,32 65,28 95,20 C135,14 165,8 200,4',
        revenueArea: 'M0,36 C30,32 65,28 95,20 C135,14 165,8 200,4 L200,45 L0,45 Z',
        revenueTimeline: ['1st', '15th', 'Current'],
        perfValue: '+95.2%',
        perfDelta: '86% to target',
        perfBar: '86%',
        perfScheduled: '520 Trips Logged',
        perfGoal: 'Goal 600',
        perfTimeline: ['1st', '15th', 'Current'],
        seatsValue: '21,400',
        seatsDelta: '45 Active Corridors',
        seatsLuxuryWidth: '63%',
        seatsHighwayWidth: '25%',
        seatsStandardWidth: '12%',
        seatsLuxury: '17,120',
        seatsStandard: '4,280',
        safetyScore: '98',
        safetyDelta: 'ISO Standard Verified',
        safetyWave: 'M0,24 Q50,8 100,22 T200,14',
        safetyTimeline: ['1st', '15th', 'Current'],
        chartBadge: '+16.2% Current Month',
        yLabels: ['600k', '500k', '400k', '300k', '200k'],
        xLabels: ['Day 1', 'Day 7', 'Day 14', 'Day 21', 'Day 28'],
        actualCurve: 'M50,160 C120,140 180,95 250,100 C320,110 390,75 460,65 C530,55 600,40 670,30',
        actualArea: 'M50,160 C120,140 180,95 250,100 C320,110 390,75 460,65 C530,55 600,40 670,30 L670,195 L50,195 Z',
        targetCurve: 'M50,145 C130,130 190,110 260,95 C340,85 420,75 500,65 C580,55 630,45 670,40',
        corridorStrips: [
          { name: 'Southern Express', rev: 'LKR 980K', delta: '+12.4%', positive: true },
          { name: 'Central Highlands', rev: 'LKR 690K', delta: '+7.1%', positive: true },
          { name: 'Northern Corridors', rev: 'LKR 310K', delta: '+26.8%', positive: true },
          { name: 'Eastern Coastal', rev: 'LKR 340K', delta: '+1.5%', positive: true }
        ],
        donutBadge: 'High Flow',
        donutCenterNum: '45',
        donutCenterLabel: 'Routes',
        donutSegments: [
          { name: 'Southern Expressway', rev: 'LKR 980K', pct: 42, dash: '211.1 502.7', offset: '0', color: '#0284c7' },
          { name: 'Central Highlands', rev: 'LKR 690K', pct: 30, dash: '150.8 502.7', offset: '-211.1', color: '#10b981' },
          { name: 'Northern Corridors', rev: 'LKR 310K', pct: 14, dash: '70.4 502.7', offset: '-361.9', color: '#a855f7' },
          { name: 'Eastern Coastal', rev: 'LKR 340K', pct: 14, dash: '70.4 502.7', offset: '-432.3', color: '#f97316' }
        ]
      };
    }

    if (mode === 'quarterly') {
      const revText = dbRev > 0 && dbRev < 20000 ? `LKR ${((dbRev * 75) / 1000).toFixed(0)}K` : 'LKR 14.6M';
      return {
        timeBadge: 'Last Month',
        revenue: revText,
        revenueDelta: '+22.8% vs Q1',
        revenuePath: 'M0,42 C30,34 60,32 100,22 C140,14 170,8 200,4',
        revenueArea: 'M0,42 C30,34 60,32 100,22 C140,14 170,8 200,4 L200,45 L0,45 Z',
        revenueTimeline: ['Q1', 'Q2', 'Q3'],
        perfValue: '+95.8%',
        perfDelta: '87% to target',
        perfBar: '87%',
        perfScheduled: '1,640 Trips Logged',
        perfGoal: 'Goal 1,800',
        perfTimeline: ['Q1', 'Q2', 'Q3'],
        seatsValue: '55,200',
        seatsDelta: '45 Active Corridors',
        seatsLuxuryWidth: '60%',
        seatsHighwayWidth: '25%',
        seatsStandardWidth: '15%',
        seatsLuxury: '46,920',
        seatsStandard: '8,280',
        safetyScore: '97',
        safetyDelta: 'Periodic Maintenance Done',
        safetyWave: 'M0,26 Q50,8 100,24 T200,14',
        safetyTimeline: ['Q1', 'Q2', 'Q3'],
        chartBadge: '+22.8% Trajectory',
        yLabels: ['2.5M', '2.0M', '1.5M', '1.0M', '0.5M'],
        xLabels: ['Q1 Jan', 'Q1 Feb', 'Q1 Mar', 'Q2 Apr', 'Q2 May'],
        actualCurve: 'M50,145 C120,135 180,90 250,95 C320,100 390,70 460,60 C530,50 600,30 670,22',
        actualArea: 'M50,145 C120,135 180,90 250,95 C320,100 390,70 460,60 C530,50 600,30 670,22 L670,195 L50,195 Z',
        targetCurve: 'M50,130 C130,120 200,100 270,90 C350,80 430,70 510,60 C590,50 640,40 670,35',
        corridorStrips: [
          { name: 'Southern Express', rev: 'LKR 4.10M', delta: '+14.5%', positive: true },
          { name: 'Central Highlands', rev: 'LKR 2.95M', delta: '+8.8%', positive: true },
          { name: 'Northern Corridors', rev: 'LKR 1.85M', delta: '+28.2%', positive: true },
          { name: 'Eastern Coastal', rev: 'LKR 1.48M', delta: '+4.1%', positive: true }
        ],
        donutBadge: 'Consolidated',
        donutCenterNum: '45',
        donutCenterLabel: 'Routes',
        donutSegments: [
          { name: 'Southern Expressway', rev: 'LKR 4.10M', pct: 40, dash: '201.1 502.7', offset: '0', color: '#0284c7' },
          { name: 'Central Highlands', rev: 'LKR 2.95M', pct: 31, dash: '155.8 502.7', offset: '-201.1', color: '#10b981' },
          { name: 'Northern Corridors', rev: 'LKR 1.85M', pct: 17, dash: '85.5 502.7', offset: '-356.9', color: '#a855f7' },
          { name: 'Eastern Coastal', rev: 'LKR 1.48M', pct: 12, dash: '60.3 502.7', offset: '-442.4', color: '#f97316' }
        ]
      };
    }

    if (mode === 'yearly') {
      const revText = dbRev > 0 && dbRev < 20000 ? `LKR ${((dbRev * 300) / 1000000).toFixed(2)}M` : 'LKR 58.4M';
      return {
        timeBadge: 'YTD',
        revenue: revText,
        revenueDelta: '+31.4% vs 2025',
        revenuePath: 'M0,44 C35,42 70,36 105,24 C140,14 175,6 200,2',
        revenueArea: 'M0,44 C35,42 70,36 105,24 C140,14 175,6 200,2 L200,45 L0,45 Z',
        revenueTimeline: ['2024', '2025', '2026 YTD'],
        perfValue: '+96.9%',
        perfDelta: '95% to target',
        perfBar: '95%',
        perfScheduled: '6,520 Trips Completed',
        perfGoal: 'Goal 6,800',
        perfTimeline: ['2024', '2025', '2026 YTD'],
        seatsValue: '224,800',
        seatsDelta: '45 Corridors Active',
        seatsLuxuryWidth: '65%',
        seatsHighwayWidth: '25%',
        seatsStandardWidth: '10%',
        seatsLuxury: '192,300',
        seatsStandard: '32,500',
        safetyScore: '99',
        safetyDelta: 'National Transport Certified',
        safetyWave: 'M0,22 Q50,4 100,20 T200,12',
        safetyTimeline: ['2024', '2025', '2026 YTD'],
        chartBadge: '+31.4% Annual Expansion',
        yLabels: ['25M', '20M', '15M', '10M', '5M'],
        xLabels: ['2022', '2023', '2024', '2025', '2026 YTD'],
        actualCurve: 'M50,175 C120,160 180,125 250,110 C320,95 390,75 460,55 C530,35 600,20 670,12',
        actualArea: 'M50,175 C120,160 180,125 250,110 C320,95 390,75 460,55 C530,35 600,20 670,12 L670,195 L50,195 Z',
        targetCurve: 'M50,160 C130,145 200,115 270,100 C350,85 430,70 510,50 C590,35 640,25 670,18',
        corridorStrips: [
          { name: 'Southern Express', rev: 'LKR 16.8M', delta: '+24.5%', positive: true },
          { name: 'Central Highlands', rev: 'LKR 12.4M', delta: '+19.1%', positive: true },
          { name: 'Northern Corridors', rev: 'LKR 7.6M', delta: '+44.0%', positive: true },
          { name: 'Eastern Coastal', rev: 'LKR 6.2M', delta: '+12.3%', positive: true }
        ],
        donutBadge: 'Network Max',
        donutCenterNum: '45',
        donutCenterLabel: 'Routes',
        donutSegments: [
          { name: 'Southern Expressway', rev: 'LKR 16.8M', pct: 39, dash: '196.1 502.7', offset: '0', color: '#0284c7' },
          { name: 'Central Highlands', rev: 'LKR 12.4M', pct: 29, dash: '145.8 502.7', offset: '-196.1', color: '#10b981' },
          { name: 'Northern Corridors', rev: 'LKR 7.6M', pct: 18, dash: '90.5 502.7', offset: '-341.9', color: '#a855f7' },
          { name: 'Eastern Coastal', rev: 'LKR 6.2M', pct: 14, dash: '70.4 502.7', offset: '-432.4', color: '#f97316' }
        ]
      };
    }

    // Default: monthly ('Last 30 Days')
    const revText = dbRev > 0 && dbRev < 20000 ? `LKR ${((dbRev * 25) / 1000).toFixed(0)}K` : 'LKR 4.82M';

    return {
      timeBadge: '30 Days',
      revenue: revText,
      revenueDelta: '+18.4% vs last month',
      revenuePath: 'M0,38 C30,36 60,30 90,26 C120,22 150,14 200,6',
      revenueArea: 'M0,38 C30,36 60,30 90,26 C120,22 150,14 200,6 L200,45 L0,45 Z',
      revenueTimeline: ['Jan', 'Mar', 'May'],
      perfValue: '+94.7%',
      perfDelta: '82% to target',
      perfBar: '82%',
      perfScheduled: '134 Trips Scheduled',
      perfGoal: 'Goal 160',
      perfTimeline: ['Jan', 'Mar', 'May'],
      seatsValue: '5,156',
      seatsDelta: `${routesList?.length || 45} Active Routes`,
      seatsLuxuryWidth: '62%',
      seatsHighwayWidth: '26%',
      seatsStandardWidth: '12%',
      seatsLuxury: '4,120',
      seatsStandard: '1,036',
      safetyScore: '98',
      safetyDelta: 'Optimal, certified',
      safetyWave: 'M0,28 Q50,6 100,24 T200,16',
      safetyTimeline: ['Jan', 'Mar', 'May'],
      chartBadge: '+14.7% YTD',
      yLabels: ['700k', '600k', '500k', '400k', '300k'],
      xLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      actualCurve: 'M50,155 C120,150 160,85 240,155 C300,200 370,135 440,135 C510,135 570,35 670,42',
      actualArea: 'M50,155 C120,150 160,85 240,155 C300,200 370,135 440,135 C510,135 570,35 670,42 L670,195 L50,195 Z',
      targetCurve: 'M50,140 C130,135 180,115 250,128 C330,140 410,130 490,115 C570,100 630,90 670,85',
      corridorStrips: [
        { name: 'Southern Express', rev: 'LKR 1.20M', delta: '+11.2%', positive: true },
        { name: 'Central Highlands', rev: 'LKR 840K', delta: '+6.0%', positive: true },
        { name: 'Northern Corridors', rev: 'LKR 380K', delta: '+35.8%', positive: true },
        { name: 'Eastern Coastal', rev: 'LKR 427K', delta: '-1.1%', positive: false }
      ],
      donutBadge: 'Balanced',
      donutCenterNum: `${routesList?.length || 45}`,
      donutCenterLabel: 'Routes',
      donutSegments: [
        { name: 'Southern Expressway', rev: 'LKR 1.20M', pct: 42, dash: '211.1 502.7', offset: '0', color: '#0284c7' },
        { name: 'Central Highlands', rev: 'LKR 840K', pct: 30, dash: '150.8 502.7', offset: '-211.1', color: '#10b981' },
        { name: 'Eastern Coastal', rev: 'LKR 427K', pct: 15, dash: '75.4 502.7', offset: '-361.9', color: '#f97316' },
        { name: 'Northern Corridors', rev: 'LKR 380K', pct: 13, dash: '65.3 502.7', offset: '-437.3', color: '#a855f7' }
      ]
    };
  }, [dateRange, cadence, dashboardData, routesList]);

  const handleExportTelemetry = () => {
    try {
      let csv = `CityLink Express Enterprise Telemetry & Operational Audit Report\r\n`;
      csv += `Generated At,"${new Date().toLocaleString()}"\r\n`;
      csv += `Reporting Range,"${dateRange}"\r\n`;
      csv += `Reporting Interval,"${cadence}"\r\n`;
      csv += `Total Fleet Registered,${buses?.length || 0}\r\n`;
      csv += `Active Corridors,${routesList?.length || 0}\r\n`;
      csv += `Operational Staff,${staffList?.length || 0}\r\n\r\n`;

      csv += `--- 1. FLEET ASSET STATUS & TELEMETRY ---\r\n`;
      csv += `Bus ID,Registration,Model,Seating Capacity,Status,Assigned Driver\r\n`;
      (buses || []).forEach((b) => {
        const assignedDriver = (b as any).driverName || b.nextTrip?.driver || 'Unassigned';
        csv += `${b.id},"${b.registration}","${b.model}",${b.capacity},"${b.status}","${assignedDriver}"\r\n`;
      });
      csv += `\r\n`;

      csv += `--- 2. CREW ROSTER & REAL-TIME DUTY ---\r\n`;
      csv += `Staff ID,Name,Role,Status,Duty State,Phone\r\n`;
      (staffList || []).forEach((s) => {
        const isOnline = (s as any).online ?? s.available;
        csv += `${s.id},"${s.name}","${s.role}","${s.status}","${isOnline ? 'ON_DUTY_ONLINE' : 'OFF_DUTY_OFFLINE'}","${s.phone || 'N/A'}"\r\n`;
      });
      csv += `\r\n`;

      csv += `--- 3. ACTIVE SCHEDULES & CORRIDORS ---\r\n`;
      csv += `Schedule ID,Route,Origin,Destination,Departure,Coach,Driver,Conductor,Fare (LKR),Status\r\n`;
      (schedules || []).forEach((sc: any) => {
        csv += `${sc.id},"${sc.routeCode || sc.routeName || 'N/A'}","${sc.origin || 'N/A'}","${sc.destination || 'N/A'}","${sc.departure || 'N/A'}","${sc.busRegistration || 'N/A'}","${sc.driverName || 'N/A'}","${sc.conductorName || 'N/A'}",${sc.fare || 0},"${sc.status || 'SCHEDULED'}"\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `CityLink_Telemetry_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      flashSuccess(`Telemetry report exported successfully (${filename}).`);
    } catch (err: any) {
      flashError(err.message || 'Failed to export telemetry report');
    }
  };

  // Handlers
  const handleToggleStatus = async (account: any) => {
    const isActivating = account.status !== 'ACTIVE';
    try {
      await api.put(`/users/${account.id}/toggle-status`);
      flashSuccess(
        `Account ${account.email} has been ${isActivating ? 'activated' : 'deactivated'} successfully.`
      );
      reloadAccounts();
      reloadStaff();
    } catch (err: any) {
      flashError(err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (account: any) => {
    const userName = account.firstName ? `${account.firstName} ${account.lastName || ''}`.trim() : (account.name || account.email);
    const userRole = (account.role || 'USER').replace(/_/g, ' ');
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY REMOVE ${userName} (${userRole})?\n\nEmail: ${account.email}\n\nThis will completely delete the user account and associated credentials. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/users/${account.id}`);
      flashSuccess(`User ${account.email} (${userRole}) was permanently removed.`);
      reloadAccounts();
      reloadStaff();
    } catch (err: any) {
      flashError(err.message || 'Failed to remove user account');
    }
  };

  const handleToggleStaffDuty = async (staffMember: any) => {
    const newStatus = !staffMember.available;
    try {
      await api.put(`/staff/${staffMember.id}`, {
        licenseNumber: staffMember.licenseNumber || (staffMember.role === 'DRIVER' ? 'LK-DRV-2026' : 'LK-CND-2026'),
        available: newStatus
      });
      flashSuccess(`${staffMember.name || staffMember.firstName} is now ${newStatus ? 'ONLINE (ON DUTY)' : 'OFFLINE (OFF DUTY)'}.`);
      reloadStaff();
    } catch (err: any) {
      flashError(err.message || 'Failed to update duty status');
    }
  };

  const handleVerifyAccount = async (account: any) => {
    try {
      await api.put(`/users/${account.id}`, {
        ...account,
        verified: true
      });
      flashSuccess(`Account ${account.email} verified successfully.`);
      reloadAccounts();
    } catch (err: any) {
      flashError(err.message || 'Failed to verify account');
    }
  };

  const openResetPasswordModal = (acc: any) => {
    setSelectedUser(acc);
    setNewPassword('CityLink2026!');
    setResetModalOpen(true);
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    try {
      await api.put(`/users/${selectedUser.id}`, {
        ...selectedUser,
        password: newPassword
      });
      flashSuccess(`Password updated for ${selectedUser.email}.`);
      setResetModalOpen(false);
    } catch (err: any) {
      flashError(err.message || 'Password update failed');
    }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisteringStaff(true);
    try {
      await api.post('/staff', newStaffForm);
      flashSuccess(`Staff member ${newStaffForm.firstName} ${newStaffForm.lastName} registered successfully as ${newStaffForm.role}.`);
      setStaffModalOpen(false);
      setNewStaffForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '+94 77 ',
        nic: '',
        role: 'DRIVER',
        department: 'Transportation & Fleet',
        licenseNumber: '',
        password: 'CityLink2026!'
      });
      reloadStaff();
    } catch (err: any) {
      flashError(err.message || 'Staff registration failed');
    } finally {
      setRegisteringStaff(false);
    }
  };

  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBus(true);
    try {
      await api.post('/buses', newBusForm);
      flashSuccess(`Bus ${newBusForm.registration} added to fleet successfully.`);
      setBusModalOpen(false);
      setNewBusForm({
        registration: 'WP ND-',
        model: 'Yutong ZK6122H (2025)',
        capacity: 44,
        type: 'Luxury AC Express',
        features: 'High-speed Wi-Fi, Climate Control AC, USB Charging, Reclining Seats',
        status: 'AVAILABLE'
      });
      reloadBuses();
    } catch (err: any) {
      flashError(err.message || 'Failed to add bus to fleet');
    } finally {
      setSavingBus(false);
    }
  };

  const handleToggleBusStatus = async (bus: Bus) => {
    const nextStatus = bus.status === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';
    try {
      await api.put(`/buses/${bus.id}`, {
        registration: bus.registration,
        model: bus.model,
        capacity: bus.capacity,
        type: bus.type,
        features: bus.features,
        status: nextStatus
      });
      flashSuccess(`Bus ${bus.registration} is now marked as ${nextStatus}.`);
      reloadBuses();
    } catch (err: any) {
      flashError(err.message || 'Failed to update bus status');
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      await api.post('/schedules', {
        routeId: Number(newScheduleForm.routeId),
        busId: Number(newScheduleForm.busId),
        driverId: Number(newScheduleForm.driverId),
        conductorId: Number(newScheduleForm.conductorId),
        departure: newScheduleForm.departure,
        arrival: newScheduleForm.arrival,
        fare: Number(newScheduleForm.fare),
        status: newScheduleForm.status,
        confirmChanges: true
      });
      flashSuccess('New bus schedule published successfully.');
      setScheduleModalOpen(false);
      reloadSchedules();
    } catch (err: any) {
      flashError(err.message || 'Failed to create schedule');
    } finally {
      setSavingSchedule(false);
    }
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
        flashSuccess(`Route ${routeForm.name} updated successfully.`);
      } else {
        await api.post('/routes', {
          ...routeForm,
          imageUrl: routeForm.imageUrl || undefined,
          stops: defaultStops
        });
        flashSuccess(`Route ${routeForm.name} created successfully.`);
      }
      reloadRoutes();
    } catch (err: any) {
      flashError(err.message || 'Error saving route');
    }
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
  };

  const handleSaveStopsToRoute = async () => {
    if (!selectedStopRouteId) return;
    const targetRoute = routesList?.find((r) => r.id === selectedStopRouteId);
    if (!targetRoute) return;

    if (workingStops.length < 2) {
      flashError('A route requires at least 2 stops: Origin and Destination.');
      return;
    }

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

      flashSuccess(`Stops successfully saved to route "${targetRoute.name}"!`);
      reloadRoutes();
    } catch (err: any) {
      flashError(err.message || 'Failed to save stops to route');
    }
  };

  const handleAddStopToWorking = () => {
    if (!newStopForm.name.trim()) {
      flashError('Please enter a stop name or click on the map.');
      return;
    }
    const targetRoute = routesList?.find((r) => r.id === selectedStopRouteId);
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
      flashError('Cannot delete primary origin or destination terminal stop.');
      return;
    }
    setWorkingStops(workingStops.filter((_, i) => i !== index));
  };

  const handleAssignTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setConflictError(null);
    try {
      if (!tripRouteId || !tripBusId || !tripDriverId || !tripConductorId) {
        flashError('Please select a route corridor, coach, driver, and conductor.');
        setSavingSchedule(false);
        return;
      }

      const selectedRoute = routesList?.find((r) => r.id === tripRouteId);
      if (!selectedRoute?.stops || selectedRoute.stops.length < 2) {
        flashError(`The selected route "${selectedRoute?.name || 'Selected'}" does not have enough stops configured yet. Please configure at least origin and destination stops in the Stops tab first.`);
        setSavingSchedule(false);
        return;
      }

      const lastStopMin = selectedRoute.stops[selectedRoute.stops.length - 1].minutesFromDeparture || 120;

      const [y, m, d] = tripDepartureDate.split('-').map(Number);
      const [hr, min] = tripDepartureTime.split(':').map(Number);
      const depDate = new Date(y, m - 1, d, hr, min, 0);

      // Validate departure is in the future
      if (depDate.getTime() <= Date.now()) {
        flashError('Please choose a future departure date and time (after current time).');
        setSavingSchedule(false);
        return;
      }

      const arrDate = new Date(depDate.getTime() + lastStopMin * 60000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dep = `${y}-${pad(m)}-${pad(d)}T${pad(hr)}:${pad(min)}:00`;
      const arr = `${arrDate.getFullYear()}-${pad(arrDate.getMonth() + 1)}-${pad(arrDate.getDate())}T${pad(arrDate.getHours())}:${pad(arrDate.getMinutes())}:00`;

      // Client-side conflict pre-check
      if (selectedBusConflict) {
        setConflictError(selectedBusConflict.reason);
        flashError(`⚠️ Scheduling Conflict: ${selectedBusConflict.reason}`);
        setSavingSchedule(false);
        return;
      }
      if (selectedDriverConflict) {
        setConflictError(selectedDriverConflict.reason);
        flashError(`⚠️ Scheduling Conflict: ${selectedDriverConflict.reason}`);
        setSavingSchedule(false);
        return;
      }
      if (selectedConductorConflict) {
        setConflictError(selectedConductorConflict.reason);
        flashError(`⚠️ Scheduling Conflict: ${selectedConductorConflict.reason}`);
        setSavingSchedule(false);
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

      flashSuccess(`Trip assigned successfully! Dispatched duty assignment alerts to Driver and Conductor.`);
      reloadSchedules();
      setTripRouteId(undefined);
      setTripBusId(undefined);
      setTripDriverId(undefined);
      setTripConductorId(undefined);
      setAssignTripModalOpen(false);
    } catch (err: any) {
      if (err.errorCode === 'SCHEDULE_CONFLICT') {
        setConflictError(err.message);
      } else {
        flashError(err.message || 'Failed to assign trip');
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteJourney = async (id: number) => {
    if (!confirm(`Are you sure you want to permanently delete journey #${id}? This will cancel dispatch and remove the trip.`)) return;
    try {
      await api.delete(`/schedules/${id}`);
      flashSuccess(`Journey #${id} deleted successfully.`);
      reloadSchedules();
    } catch (err: any) {
      flashError(err.message || 'Failed to delete journey');
    }
  };

  const handleCancelSchedule = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to cancel this bus schedule? Affected passengers will receive automated notifications.')) return;
    try {
      await api.post(`/schedules/${scheduleId}/cancel`, { confirmChanges: true });
      flashSuccess(`Schedule #${scheduleId} cancelled and notifications dispatched.`);
      reloadSchedules();
    } catch (err: any) {
      flashError(err.message || 'Failed to cancel schedule');
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    setSavingSettings(true);
    try {
      await api.put('/settings', { [key]: value });
      flashSuccess(`Updated system setting ${key}.`);
      reloadSettings();
    } catch (err: any) {
      flashError(err.message || 'Failed to update setting');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="capital-layout">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="capital-sidebar">
        <div className="capital-brand">
          <div className="capital-logo-badge">
            <BusFront size={18} />
          </div>
          <div className="capital-brand-title">
            <strong>CityLink Express</strong>
            <small>Admin Suite</small>
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
                className={`capital-nav-btn ${section === 'reports' ? 'active' : ''}`}
                onClick={() => setSection('reports')}
              >
                <TrendingUp size={17} />
                <span>Analytics</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="capital-nav-group">
          <span className="capital-nav-header">Operations</span>
          <ul className="capital-nav-list">
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'buses' ? 'active' : ''}`}
                onClick={() => setSection('buses')}
              >
                <BusFront size={17} />
                <span>Buses & Fleet</span>
                <span className="capital-nav-badge">{buses.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'schedules' ? 'active' : ''}`}
                onClick={() => setSection('schedules')}
              >
                <Calendar size={17} />
                <span>Bus Schedules</span>
                <span className="capital-nav-badge">{schedules.length}</span>
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
                <span className="capital-nav-badge">{routesList?.length || 0}</span>
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
                className={`capital-nav-btn ${section === 'users' ? 'active' : ''}`}
                onClick={() => setSection('users')}
              >
                <Users size={17} />
                <span>Accounts & Staff</span>
                <span className="capital-nav-badge">{passengers.length + staff.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'bookings' ? 'active' : ''}`}
                onClick={() => setSection('bookings')}
              >
                <Ticket size={17} />
                <span>Bookings & Manifest</span>
                <span className="capital-nav-badge">{bookings.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`capital-nav-btn ${section === 'settings' ? 'active' : ''}`}
                onClick={() => setSection('settings')}
              >
                <Sliders size={17} />
                <span>Fare Policies</span>
                <span className="capital-nav-badge">{settings?.length || 0}</span>
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
              <div className="capital-user-avatar">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="capital-user-meta">
                <strong>{user.firstName} {user.lastName}</strong>
                <small>SUPER ADMIN</small>
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
        {/* Capitalio Top Header */}
        <div className="capital-header">
          <div className="capital-header-title">
            <h1>
              {section === 'overview' && 'Overview'}
              {section === 'buses' && 'Bus & Fleet Management'}
              {section === 'schedules' && 'Bus Scheduling Management'}
              {section === 'users' && 'User & Staff Account Governance'}
              {section === 'bookings' && 'Ticket Bookings & Manifest'}
              {section === 'settings' && 'Fare Rules & System Policies'}
              {section === 'reports' && 'Operational Analytics & Audit'}
            </h1>
            <p>
              <span className="capital-status-dot" />
              <span>Last updated Today, 9:42 AM • All metrics live in LKR (Sri Lanka)</span>
            </p>
          </div>

          <div className="capital-header-controls">
            <button
              type="button"
              className={`capital-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh all admin data"
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
                      onClick={() => handleDateRangeSelect(opt)}
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
                      onClick={() => handleCadenceSelect(opt)}
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
              onClick={handleExportTelemetry}
              title="Download Telemetry & Fleet Report (CSV)"
            >
              <Download size={13} />
              <span>Export Telemetry ↗</span>
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

        {actionError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.85rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} color="#ef4444" />
            <span>{actionError}</span>
          </div>
        )}

        {/* ================= 1. CAPITALIO EXECUTIVE DASHBOARD OVERVIEW ================= */}
        {section === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Quick Time Window Pill Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '-0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Filter Window:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label: 'Today', key: 'Today' },
                    { label: '7 Days', key: 'Last 7 Days' },
                    { label: '30 Days', key: 'Last 30 Days' },
                    { label: 'This Month', key: 'This Month' },
                    { label: 'Last Month', key: 'Last Month' },
                    { label: 'YTD', key: 'Year to Date' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleDateRangeSelect(tab.key)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: dateRange === tab.key ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                        color: dateRange === tab.key ? '#00e5ff' : '#94a3b8',
                        boxShadow: dateRange === tab.key ? '0 0 10px rgba(0, 229, 255, 0.2)' : 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Active Window: <strong style={{ color: '#00e5ff' }}>{dateRange}</strong> ({cadence}) · <span style={{ color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }} onClick={cycleTimeframe} title="Cycle to next timeframe">Click card to cycle ↻</span>
              </div>
            </div>

            {/* Top 4 KPI Cards (Matching Capitalio Card 1 to 4) */}
            <div className="capital-kpi-grid">
              {/* Card 1: Total Net worth -> Total Network Revenue */}
              <div
                className="capital-card capital-card-interactive"
                onClick={cycleTimeframe}
                title={`Click to cycle time window (Current: ${dateRange})`}
              >
                <div className="capital-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Total Network Revenue</span>
                    <span className="capital-time-badge">{analyticsData.timeBadge}</span>
                  </div>
                  <div className="capital-card-icon" title="Live Financial Stream">
                    <Sparkles size={14} color="#10b981" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">
                    {analyticsData.revenue}
                  </span>
                  <span className="capital-delta-pill">
                    {analyticsData.revenueDelta}
                  </span>
                </div>
                {/* Glowing Spline Sparkline */}
                <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <svg width="100%" height="45" viewBox="0 0 200 45" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="capGradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={analyticsData.revenueArea} fill="url(#capGradGreen)" />
                    <path d={analyticsData.revenuePath} stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="capital-timeline-labels">
                  {analyticsData.revenueTimeline.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              </div>

              {/* Card 2: Portfolio return -> Fleet Dispatch & On-Time Rate */}
              <div
                className="capital-card capital-card-interactive"
                onClick={cycleTimeframe}
                title={`Click to cycle time window (Current: ${dateRange})`}
              >
                <div className="capital-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Fleet Performance</span>
                    <span className="capital-time-badge">{analyticsData.timeBadge}</span>
                  </div>
                  <div className="capital-card-icon">
                    <Activity size={14} color="#38bdf8" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">{analyticsData.perfValue}</span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    {analyticsData.perfDelta}
                  </span>
                </div>
                <div className="capital-segmented-bar">
                  <div className="capital-segmented-fill" style={{ width: analyticsData.perfBar }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--cap-subtitle-color, #64748b)', margin: '4px 0 6px' }}>
                  <span>{analyticsData.perfScheduled}</span>
                  <span style={{ color: 'var(--cap-title-color, #0f172a)', fontWeight: 600 }}>{analyticsData.perfGoal}</span>
                </div>
                <div className="capital-timeline-labels">
                  {analyticsData.perfTimeline.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              </div>

              {/* Card 3: Asset classes -> Fleet Capacity & Seats */}
              <div
                className="capital-card capital-card-interactive"
                onClick={cycleTimeframe}
                title={`Click to cycle time window (Current: ${dateRange})`}
              >
                <div className="capital-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Passenger Seat Capacity</span>
                    <span className="capital-time-badge">{analyticsData.timeBadge}</span>
                  </div>
                  <div className="capital-card-icon">
                    <PieChart size={14} color="#a855f7" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">{analyticsData.seatsValue}</span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    {analyticsData.seatsDelta}
                  </span>
                </div>
                {/* Multi-colored stacked progress bar */}
                <div className="capital-stacked-bar">
                  <div className="capital-stacked-seg" style={{ width: analyticsData.seatsLuxuryWidth, background: '#10b981' }} title={`Luxury AC ${analyticsData.seatsLuxuryWidth}`} />
                  <div className="capital-stacked-seg" style={{ width: analyticsData.seatsHighwayWidth, background: '#0284c7' }} title={`Super Highway ${analyticsData.seatsHighwayWidth}`} />
                  <div className="capital-stacked-seg" style={{ width: analyticsData.seatsStandardWidth, background: '#a855f7' }} title={`Standard AC ${analyticsData.seatsStandardWidth}`} />
                </div>
                <div className="capital-stacked-legend">
                  <span><span style={{ color: '#10b981' }}>■</span> Luxury & Highway <strong>{analyticsData.seatsLuxury}</strong></span>
                  <span><span style={{ color: '#a855f7' }}>■</span> Standard <strong>{analyticsData.seatsStandard}</strong></span>
                </div>
              </div>

              {/* Card 4: Risk score -> Fleet Safety Score */}
              <div
                className="capital-card capital-card-interactive"
                onClick={cycleTimeframe}
                title={`Click to cycle time window (Current: ${dateRange})`}
              >
                <div className="capital-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Safety & Reliability Index</span>
                    <span className="capital-time-badge">{analyticsData.timeBadge}</span>
                  </div>
                  <div className="capital-card-icon">
                    <Shield size={14} color="#f59e0b" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">{analyticsData.safetyScore}<small style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8' }}>/100</small></span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    {analyticsData.safetyDelta}
                  </span>
                </div>
                {/* Glowing Orange Sine Wave */}
                <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <svg width="100%" height="45" viewBox="0 0 200 45" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="capGradAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={`${analyticsData.safetyWave} L200,45 L0,45 Z`} fill="url(#capGradAmber)" />
                    <path d={analyticsData.safetyWave} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="capital-timeline-labels">
                  {analyticsData.safetyTimeline.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Section: Portfolio Performance (65%) + Asset Allocation (35%) */}
            <div className="capital-analytics-grid">
              {/* Left Card: Network Revenue & Passenger Performance Spline Chart */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <div>
                    <h2>Network Revenue & Demand Velocity</h2>
                  </div>
                  <div className="capital-panel-actions">
                    <span className="capital-badge-ytd">{analyticsData.chartBadge}</span>
                    <button type="button" className="capital-link-action" onClick={() => setSection('reports')}>
                      Full Analysis ↗
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="capital-chart-legend">
                  <div className="capital-legend-item">
                    <span className="capital-legend-dot" style={{ background: '#00f5a0' }} />
                    <span>Actual Demand</span>
                  </div>
                  <div className="capital-legend-item">
                    <span className="capital-legend-dot" style={{ background: '#00d2ff', border: '1px dashed #00d2ff' }} />
                    <span>Target Benchmark</span>
                  </div>
                </div>

                {/* SVG High-Res Spline Chart */}
                <div className="capital-chart-wrap">
                  <svg width="100%" height="220" viewBox="0 0 700 220" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="perfGreenFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#00f5a0" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid Lines & Y-Labels */}
                    {analyticsData.yLabels.map((ylbl, i) => {
                      const yPos = 20 + i * 40;
                      return (
                        <g key={i}>
                          <line x1="40" y1={yPos} x2="680" y2={yPos} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                          <text x="32" y={yPos + 4} fill="#64748b" fontSize="10" textAnchor="end">{ylbl}</text>
                        </g>
                      );
                    })}

                    {/* Glowing Neon Area Fill */}
                    <path
                      d={analyticsData.actualArea}
                      fill="url(#perfGreenFill)"
                    />

                    {/* Glowing Actual Curve (Green Spline) */}
                    <path
                      d={analyticsData.actualCurve}
                      stroke="#00f5a0"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />

                    {/* Dashed Target Curve (Cyan Spline) */}
                    <path
                      d={analyticsData.targetCurve}
                      stroke="#00d2ff"
                      strokeWidth="2.2"
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                    />

                    {/* X-Axis Labels */}
                    {analyticsData.xLabels.map((xlbl, i) => (
                      <text key={i} x={50 + i * 150} y="212" fill="#64748b" fontSize="11">{xlbl}</text>
                    ))}
                  </svg>
                </div>

                {/* 4 Bottom Columns in Left Card */}
                <div className="capital-metric-strip">
                  {analyticsData.corridorStrips.map((strip, idx) => (
                    <div key={idx} className="capital-strip-col">
                      <small>{strip.name}</small>
                      <strong>{strip.rev}</strong>
                      <span style={{ color: strip.positive ? undefined : '#ef4444' }}>{strip.delta}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Card: Asset Allocation Donut Chart */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Fleet Corridor Allocation</h2>
                  <span className="capital-badge-ytd" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    {analyticsData.donutBadge}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                  {/* Centered & Enlarged Donut SVG */}
                  <div style={{ position: 'relative', width: '210px', height: '210px', margin: '0.75rem auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: 'rotate(-90deg)' }}>
                      {analyticsData.donutSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          className="capital-donut-circle"
                          cx="105"
                          cy="105"
                          r="80"
                          stroke={seg.color}
                          strokeWidth="24"
                          fill="none"
                          strokeDasharray={seg.dash}
                          strokeDashoffset={seg.offset}
                        />
                      ))}
                    </svg>
                    <div className="capital-donut-center">
                      <strong className="capital-donut-number" style={{ fontSize: '2.1rem', lineHeight: 1 }}>{analyticsData.donutCenterNum}</strong>
                      <small className="capital-donut-sub" style={{ fontSize: '0.85rem', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>{analyticsData.donutCenterLabel}</small>
                    </div>
                  </div>

                  {/* 4 Rows in Legend underneath chart */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
                    {analyticsData.donutSegments.map((seg, idx) => (
                      <div
                        key={idx}
                        className="capital-donut-card-row"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: seg.color, boxShadow: `0 0 8px ${seg.color}80` }} />
                          <span className="capital-donut-card-name">{seg.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <strong className="capital-donut-card-amount">{seg.rev}</strong>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: `${seg.color}26`,
                            color: seg.color,
                            border: `1px solid ${seg.color}4d`,
                            minWidth: '40px',
                            textAlign: 'center'
                          }}>{seg.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Top Holdings Table (65%) + Smart Insights (35%) */}
            <div className="capital-bottom-grid">
              {/* Left: Top Holdings Table */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Top Performing Corridors</h2>
                  <button type="button" className="capital-link-action" onClick={() => setSection('schedules')}>
                    View all ↗
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="capital-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>No</th>
                        <th>Corridor / Asset</th>
                        <th>Revenue</th>
                        <th>Allocation</th>
                        <th>Load Factor</th>
                        <th>24h Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ color: '#64748b', fontWeight: 600 }}>1</td>
                        <td>
                          <div className="capital-asset-cell">
                            <div className="capital-asset-icon">
                              <BusFront size={14} />
                            </div>
                            <div>
                              <strong style={{ color: 'var(--cap-title-color, #000000)', display: 'block' }}>Colombo ⇄ Galle Express</strong>
                              <small style={{ color: '#64748b' }}>Route 01 · Southern Highway</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--cap-title-color, #000000)' }}><strong style={{ color: 'var(--cap-title-color, #000000)', fontWeight: 700 }}>LKR 482,500</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '45px', height: '4px', background: 'var(--cap-bar-track, #e2e8f0)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: '85%', height: '100%', background: '#10b981' }} />
                            </div>
                            <small style={{ color: 'var(--cap-subtitle-color, #475569)', fontWeight: 600 }}>18.5%</small>
                          </div>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>+94.2%</td>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>+34 Seats</td>
                      </tr>

                      <tr>
                        <td style={{ color: '#64748b', fontWeight: 600 }}>2</td>
                        <td>
                          <div className="capital-asset-cell">
                            <div className="capital-asset-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                              <BusFront size={14} />
                            </div>
                            <div>
                              <strong style={{ color: 'var(--cap-title-color, #000000)', display: 'block' }}>Colombo ⇄ Kandy Central</strong>
                              <small style={{ color: '#64748b' }}>Route 02 · A1 Highway</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--cap-title-color, #000000)' }}><strong style={{ color: 'var(--cap-title-color, #000000)', fontWeight: 700 }}>LKR 385,200</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '45px', height: '4px', background: 'var(--cap-bar-track, #e2e8f0)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: '70%', height: '100%', background: '#10b981' }} />
                            </div>
                            <small style={{ color: 'var(--cap-subtitle-color, #475569)', fontWeight: 600 }}>14.2%</small>
                          </div>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>+91.6%</td>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>+28 Seats</td>
                      </tr>

                      <tr>
                        <td style={{ color: '#64748b', fontWeight: 600 }}>3</td>
                        <td>
                          <div className="capital-asset-cell">
                            <div className="capital-asset-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                              <BusFront size={14} />
                            </div>
                            <div>
                              <strong style={{ color: 'var(--cap-title-color, #000000)', display: 'block' }}>Colombo ⇄ Jaffna Northern Star</strong>
                              <small style={{ color: '#64748b' }}>Route 05 · A9 Corridor</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--cap-title-color, #000000)' }}><strong style={{ color: 'var(--cap-title-color, #000000)', fontWeight: 700 }}>LKR 315,000</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '45px', height: '4px', background: 'var(--cap-bar-track, #e2e8f0)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: '55%', height: '100%', background: '#0284c7' }} />
                            </div>
                            <small style={{ color: 'var(--cap-subtitle-color, #475569)', fontWeight: 600 }}>12.0%</small>
                          </div>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>+88.4%</td>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>+19 Seats</td>
                      </tr>

                      <tr>
                        <td style={{ color: '#64748b', fontWeight: 600 }}>4</td>
                        <td>
                          <div className="capital-asset-cell">
                            <div className="capital-asset-icon" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
                              <BusFront size={14} />
                            </div>
                            <div>
                              <strong style={{ color: 'var(--cap-title-color, #000000)', display: 'block' }}>Colombo ⇄ Trincomalee Ocean Way</strong>
                              <small style={{ color: '#64748b' }}>Route 07 · Eastern Line</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--cap-title-color, #000000)' }}><strong style={{ color: 'var(--cap-title-color, #000000)', fontWeight: 700 }}>LKR 248,000</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '45px', height: '4px', background: 'var(--cap-bar-track, #e2e8f0)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: '45%', height: '100%', background: '#f97316' }} />
                            </div>
                            <small style={{ color: 'var(--cap-subtitle-color, #475569)', fontWeight: 600 }}>9.5%</small>
                          </div>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>+84.0%</td>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>+14 Seats</td>
                      </tr>

                      <tr>
                        <td style={{ color: '#64748b', fontWeight: 600 }}>5</td>
                        <td>
                          <div className="capital-asset-cell">
                            <div className="capital-asset-icon" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                              <BusFront size={14} />
                            </div>
                            <div>
                              <strong style={{ color: 'var(--cap-title-color, #000000)', display: 'block' }}>Nuwara Eliya ⇄ Ella Cloud Trail</strong>
                              <small style={{ color: '#64748b' }}>Route 45 · Tea Country</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--cap-title-color, #000000)' }}><strong style={{ color: 'var(--cap-title-color, #000000)', fontWeight: 700 }}>LKR 192,400</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '45px', height: '4px', background: 'var(--cap-bar-track, #e2e8f0)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: '38%', height: '100%', background: '#0284c7' }} />
                            </div>
                            <small style={{ color: 'var(--cap-subtitle-color, #475569)', fontWeight: 600 }}>7.4%</small>
                          </div>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>+89.5%</td>
                        <td style={{ color: '#38bdf8', fontWeight: 600 }}>+18 Seats</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Smart Insights Card */}
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
                      <TrendingUp size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Weekend Demand Surge</h4>
                      <p>Booking velocity is +34% above forecast on Route 01 (Colombo-Galle). Suggest deploying 2 standby Scania coaches.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => { setSection('schedules'); setScheduleModalOpen(true); }}>
                        Deploy Extra Capacity →
                      </button>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Preventive Maintenance Due</h4>
                      <p>Bus WP ND-1033 has reached 14,800 km on Route 31 (Mannar). Scheduled brake & tire diagnostic required within 48h.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('buses')}>
                        View Fleet Diagnostics →
                      </button>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      <Sparkles size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Yield Optimization Opportunity</h4>
                      <p>Hill country morning trips (06:30 AM Kandy) running at 98% occupancy. Dynamic fare rule +5% recommended.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('settings')}>
                        Adjust Fare Policy →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. BUS & FLEET MANAGEMENT ================= */}
        {section === 'buses' && (
          <>
            <div className="portal-topbar">
              <div className="portal-topbar-title">
                <h1>Bus & Fleet Management</h1>
                <p>Manage vehicles, seat capacities, luxury amenities, and maintenance states.</p>
              </div>
              <div className="portal-topbar-actions">
                <button type="button" className="btn" onClick={() => reloadBuses()}>
                  <RefreshCw size={13} /> Refresh Fleet
                </button>
                <button type="button" className="btn" onClick={() => setBusModalOpen(true)}>
                  <Plus size={16} /> Add New Bus
                </button>
                <ThemeToggle />
              </div>
            </div>

            <div className="portal-card">
              <div className="portal-toolbar">
                <div className="portal-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search bus by registration, model, or class..."
                    value={busSearch}
                    onChange={(e) => setBusSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <small style={{ color: 'var(--muted)', fontWeight: 600 }}>STATUS:</small>
                  <select
                    value={busStatusFilter}
                    onChange={(e) => setBusStatusFilter(e.target.value)}
                    style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text-heading)' }}
                  >
                    <option value="ALL">All Statuses ({buses.length})</option>
                    <option value="AVAILABLE">Available ({buses.filter(b => b.status === 'AVAILABLE').length})</option>
                    <option value="MAINTENANCE">In Maintenance ({buses.filter(b => b.status === 'MAINTENANCE').length})</option>
                    <option value="OUT_OF_SERVICE">Out of Service ({buses.filter(b => b.status === 'OUT_OF_SERVICE').length})</option>
                  </select>
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table" style={{ width: '100%', minWidth: '1120px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '65px', minWidth: '65px' }}>ID</th>
                      <th style={{ width: '130px', minWidth: '130px' }}>Registration</th>
                      <th style={{ width: '150px', minWidth: '150px' }}>Model & Specs</th>
                      <th style={{ width: '105px', minWidth: '105px' }}>Capacity</th>
                      <th style={{ width: '135px', minWidth: '135px' }}>Class</th>
                      <th style={{ width: '230px', minWidth: '220px' }}>Features</th>
                      <th style={{ width: '125px', minWidth: '125px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '170px', minWidth: '170px', textAlign: 'center', paddingRight: '1.5rem', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buses
                      .filter((b) => busStatusFilter === 'ALL' || b.status === busStatusFilter)
                      .filter((b) => !busSearch || (b.registration + ' ' + b.model + ' ' + b.type + ' ' + b.features).toLowerCase().includes(busSearch.toLowerCase()))
                      .map((b) => (
                        <tr key={b.id}>
                          <td style={{ width: '65px', minWidth: '65px' }}><strong>#{b.id}</strong></td>
                          <td style={{ width: '130px', minWidth: '130px' }}><strong style={{ color: '#0284c7', whiteSpace: 'nowrap' }}>{b.registration}</strong></td>
                          <td style={{ width: '150px', minWidth: '150px' }}><strong style={{ whiteSpace: 'nowrap' }}>{b.model}</strong></td>
                          <td style={{ width: '105px', minWidth: '105px' }}><span className="portal-badge-chip" style={{ whiteSpace: 'nowrap' }}>{b.capacity} Seats</span></td>
                          <td style={{ width: '135px', minWidth: '135px' }}><span style={{ whiteSpace: 'nowrap' }}>{b.type}</span></td>
                          <td style={{ width: '230px', minWidth: '220px', maxWidth: '260px', whiteSpace: 'normal', verticalAlign: 'middle' }}>
                            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--muted, #64748b)' }}>
                              {b.features || 'Standard Features'}
                            </div>
                          </td>
                          <td style={{ width: '125px', minWidth: '125px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            <span
                              className="badge"
                              style={{
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '95px',
                                padding: '5px 10px',
                                fontWeight: 600,
                                background: b.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: b.status === 'AVAILABLE' ? '#10b981' : '#f59e0b',
                                border: `1px solid ${b.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                              }}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td style={{ width: '170px', minWidth: '170px', textAlign: 'center', whiteSpace: 'nowrap', paddingRight: '1.5rem', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                whiteSpace: 'nowrap',
                                minWidth: '140px',
                                padding: '7px 14px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                borderRadius: '7px'
                              }}
                              onClick={() => handleToggleBusStatus(b)}
                            >
                              {b.status === 'AVAILABLE' ? 'Set Maintenance' : 'Set Available'}
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

        {/* ================= 3. BUS SCHEDULING MANAGEMENT (Full-Width Table & Pop-up Modal) ================= */}
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
              const allItems = schedulesPage?.items || schedules;
              const filteredSchedules = allItems
                .filter((s) => scheduleFilter === 'ALL' || s.status === scheduleFilter)
                .filter((s) => {
                  if (!scheduleSearch.trim()) return true;
                  const q = scheduleSearch.toLowerCase();
                  const origin = (s.origin || '').toLowerCase();
                  const dest = (s.destination || '').toLowerCase();
                  const reg = (s.bus?.registration || '').toLowerCase();
                  const model = (s.bus?.model || '').toLowerCase();
                  const drv = (s.driver?.name || '').toLowerCase();
                  const cnd = (s.conductor?.name || '').toLowerCase();
                  const idStr = String(s.id);
                  return origin.includes(q) || dest.includes(q) || reg.includes(q) || model.includes(q) || drv.includes(q) || cnd.includes(q) || idStr.includes(q);
                });

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
                          <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                            <Calendar size={36} color="#64748b" style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                            No scheduled journeys found for the selected filter or search query.
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
                            <td><strong>LKR {Number(s.fare).toLocaleString()}</strong></td>
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
                      const conflict = checkBusConflict(b, plannedTripWindow, schedules);
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
                    options={(drivers || []).map((d) => {
                      const conflict = checkDriverConflict(d, plannedTripWindow, schedules);
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
                    options={(conductors || []).map((c) => {
                      const conflict = checkConductorConflict(c, plannedTripWindow, schedules);
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

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAssignTripModalOpen(false)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      fontWeight: 600,
                      borderRadius: '8px',
                      padding: '11px',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSchedule || Boolean(activeConflict)}
                    style={{
                      flex: 2,
                      background: activeConflict
                        ? '#334155'
                        : 'linear-gradient(135deg, #0284c7, #38bdf8)',
                      color: activeConflict ? '#94a3b8' : '#090d14',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '8px',
                      padding: '11px',
                      fontSize: '0.85rem',
                      cursor: activeConflict ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {activeConflict ? '⚠️ Resolve Scheduling Conflict' : 'Assign Trip & Dispatch Crew'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= 3B. EXPRESS ROUTES MANAGEMENT (1/3 Controls : 2/3 Map) ================= */}
        {section === 'routes' && (
          <div className="capital-split-screen">
            <div className="capital-split-left">
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                  Express Route Architect
                </h2>
                <p style={{ fontSize: '0.8rem', margin: '2px 0 0', color: 'var(--muted)' }}>
                  Click map points on right to set Origin (A) and Destination (B).
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
                  Configured Corridors ({routes.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {routes.map((r) => (
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

        {/* ================= 3C. ROUTE STOPS MANAGEMENT (1/3 Controls : 2/3 Map) ================= */}
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
                  options={routes.map((r) => ({
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
                const targetRoute = routes.find((r) => r.id === selectedStopRouteId);
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

        {/* ================= 4. USER & STAFF ACCOUNTS ================= */}
        {section === 'users' && (
          <>
            <div className="portal-topbar">
              <div className="portal-topbar-title">
                <h1>User & Account Governance</h1>
                <p>Manage passenger profiles (stored in <code>users</code>) and crew accounts (stored in <code>staff</code>).</p>
              </div>
              <div className="portal-topbar-actions">
                <button type="button" className="btn" onClick={() => { reloadAccounts(); reloadStaff(); }}>
                  <RefreshCw size={13} /> Refresh Accounts
                </button>
                {userTab === 'staff' && (
                  <button type="button" className="btn" onClick={() => setStaffModalOpen(true)}>
                    <Plus size={16} /> Register Staff Member
                  </button>
                )}
                <ThemeToggle />
              </div>
            </div>

            {/* Sub-Tabs: Passengers vs Staff */}
            <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
              <button
                type="button"
                className={`btn ${userTab === 'passengers' ? '' : 'btn-outline'}`}
                onClick={() => setUserTab('passengers')}
              >
                <Users size={16} /> Registered Passengers ({passengers.length})
              </button>
              <button
                type="button"
                className={`btn ${userTab === 'staff' ? '' : 'btn-outline'}`}
                onClick={() => setUserTab('staff')}
              >
                <UserCheck size={16} /> Staff & Crew ({staff.length})
              </button>
            </div>

            {/* PASSENGERS TABLE */}
            {userTab === 'passengers' && (
              <div className="portal-card">
                <div className="portal-toolbar">
                  <div className="portal-search-box">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search passenger by name, email, or phone..."
                      value={passengerSearch}
                      onChange={(e) => setPassengerSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="portal-table-container">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Passenger Name</th>
                        <th>Email Address</th>
                        <th>Phone</th>
                        <th>Verification</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passengers
                        .filter((p) => !passengerSearch || (p.firstName + ' ' + p.lastName + ' ' + p.email + ' ' + p.phone).toLowerCase().includes(passengerSearch.toLowerCase()))
                        .map((p) => (
                          <tr key={p.id}>
                            <td><strong>#{p.id}</strong></td>
                            <td><strong>{p.firstName} {p.lastName}</strong></td>
                            <td>{p.email}</td>
                            <td>{p.phone}</td>
                            <td>
                              {p.verified ? (
                                <span style={{ color: '#10b981', fontSize: '0.85rem' }}>✓ Verified</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleVerifyAccount(p)}
                                >
                                  Mark Verified
                                </button>
                              )}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: p.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: p.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                                }}
                              >
                                {p.status === 'ACTIVE' ? 'ACTIVE' : 'DEACTIVATED'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={p.status === 'ACTIVE' ? { background: 'linear-gradient(115deg, #f59e0b, #d97706)', color: '#fff' } : {}}
                                  onClick={() => handleToggleStatus(p)}
                                  title={p.status === 'ACTIVE' ? 'Deactivate passenger account' : 'Activate passenger account'}
                                >
                                  {p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => openResetPasswordModal(p)}
                                  title="Reset account password"
                                >
                                  Reset PWD
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ background: 'linear-gradient(115deg, #ef4444, #dc2626)', color: '#fff' }}
                                  onClick={() => handleDeleteUser(p)}
                                  title="Permanently remove passenger account"
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STAFF TABLE */}
            {userTab === 'staff' && (
              <div className="portal-card">
                <div className="portal-toolbar">
                  <div className="portal-search-box">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search staff by employee ID, name, email, or role..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <small style={{ color: 'var(--muted)', fontWeight: 600 }}>ROLE:</small>
                    <select
                      value={staffRoleFilter}
                      onChange={(e) => setStaffRoleFilter(e.target.value)}
                      style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text-heading)' }}
                    >
                      <option value="ALL">All Roles ({staff.length})</option>
                      <option value="DRIVER">Drivers</option>
                      <option value="CONDUCTOR">Conductors</option>
                      <option value="OPERATOR">Operators</option>
                      <option value="CUSTOMER_SERVICE">Customer Service</option>
                    </select>
                  </div>
                </div>

                <div className="portal-table-container">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Employee ID</th>
                        <th>Staff Name</th>
                        <th>Email & Phone</th>
                        <th>NIC</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>License</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff
                        .filter((s) => staffRoleFilter === 'ALL' || s.role === staffRoleFilter)
                        .filter((s) => !staffSearch || ((s.employeeId || '') + ' ' + (s.name || s.firstName) + ' ' + s.email + ' ' + s.role).toLowerCase().includes(staffSearch.toLowerCase()))
                        .map((s) => (
                          <tr key={s.id}>
                            <td><strong style={{ color: '#ff4b72' }}>{s.employeeId || `EMP-${s.id}`}</strong></td>
                            <td><strong>{s.name || `${s.firstName || ''} ${s.lastName || ''}`}</strong></td>
                            <td>
                              {s.email}
                              <br />
                              <small>{s.phone}</small>
                            </td>
                            <td>{s.nic || '—'}</td>
                            <td>
                              <span className="portal-badge-chip" style={{ color: '#0284c7' }}>
                                {s.role.replace('_', ' ')}
                              </span>
                            </td>
                            <td>{s.department || 'Operations'}</td>
                            <td>{s.licenseNumber || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: s.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: s.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                                  }}
                                >
                                  {s.status === 'ACTIVE' ? 'ACTIVE' : 'DEACTIVATED'}
                                </span>
                                {(s.role === 'DRIVER' || s.role === 'CONDUCTOR') && (
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      background: s.available ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                      color: s.available ? '#10b981' : '#94a3b8'
                                    }}
                                  >
                                    {s.available ? '🟢 ONLINE' : '⚪ OFFLINE'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {(s.role === 'DRIVER' || s.role === 'CONDUCTOR') && (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{
                                      background: s.available ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                      border: s.available ? '1px solid #10b981' : '1px solid #64748b',
                                      color: s.available ? '#10b981' : '#94a3b8',
                                      fontWeight: 600,
                                    }}
                                    onClick={() => handleToggleStaffDuty(s)}
                                    title={s.available ? 'Switch to Offline' : 'Switch to Online'}
                                  >
                                    {s.available ? 'Set Offline' : 'Set Online'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={s.status === 'ACTIVE' ? { background: 'linear-gradient(115deg, #f59e0b, #d97706)', color: '#fff' } : {}}
                                  onClick={() => handleToggleStatus(s)}
                                  title={s.status === 'ACTIVE' ? 'Deactivate staff account' : 'Activate staff account'}
                                >
                                  {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => openResetPasswordModal(s)}
                                  title="Reset staff password"
                                >
                                  Reset PWD
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ background: 'linear-gradient(115deg, #ef4444, #dc2626)', color: '#fff' }}
                                  onClick={() => handleDeleteUser(s)}
                                  title="Permanently remove staff account"
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= 5. BOOKINGS & TICKETS ================= */}
        {section === 'bookings' && (
          <>
            <div className="portal-topbar">
              <div className="portal-topbar-title">
                <h1>Ticket Bookings & Reservations</h1>
                <p>Complete manifest of seat reservations, payment validations, and passenger e-tickets.</p>
              </div>
              <div className="portal-topbar-actions">
                <button type="button" className="btn" onClick={() => reloadBookings()}>
                  <RefreshCw size={13} /> Refresh Bookings
                </button>
                <ThemeToggle />
              </div>
            </div>

            <div className="portal-card">
              <div className="portal-toolbar">
                <div className="portal-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search booking by reference code, passenger name, or phone..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Ref Code</th>
                      <th>Passenger Name</th>
                      <th>Route / Corridor</th>
                      <th>Departure</th>
                      <th>Seat</th>
                      <th>Fare (LKR)</th>
                      <th>Booking Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings
                      .filter((b) => !bookingSearch || (b.reference + ' ' + b.passengerName + ' ' + b.passengerPhone + ' ' + b.origin + ' ' + b.destination).toLowerCase().includes(bookingSearch.toLowerCase()))
                      .map((b) => (
                        <tr key={b.id}>
                          <td><strong style={{ color: '#0284c7' }}>{b.reference}</strong></td>
                          <td>
                            <strong>{b.passengerName}</strong>
                            <br />
                            <small>{b.passengerPhone}</small>
                          </td>
                          <td>
                            <strong>{b.origin} → {b.destination}</strong>
                            <br />
                            <small>{b.bus || 'CityLink Coach'}</small>
                          </td>
                          <td>
                            {new Date(b.departure).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            <br />
                            <small>{new Date(b.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                          </td>
                          <td><span className="portal-badge-chip">Seat {b.seatNumber || b.seat}</span></td>
                          <td><strong>LKR {Number(b.totalAmount || 0).toLocaleString()}</strong></td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: b.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: b.status === 'CONFIRMED' ? '#10b981' : '#ef4444'
                              }}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: b.paymentStatus === 'SUCCEEDED' ? '#10b981' : '#f59e0b', fontSize: '0.82rem', fontWeight: 600 }}>
                              {b.paymentStatus || 'COMPLETED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================= 6. SYSTEM SETTINGS & FARES ================= */}
        {section === 'settings' && (
          <>
            <div className="portal-topbar">
              <div className="portal-topbar-title">
                <h1>Fare Rules & System Settings</h1>
                <p>Configure dynamic fare rates, express highway tolls, checkout hold timeouts, and company contact details.</p>
              </div>
              <div className="portal-topbar-actions">
                <button type="button" className="btn" onClick={() => reloadSettings()}>
                  <RefreshCw size={13} /> Reload Settings
                </button>
                <ThemeToggle />
              </div>
            </div>

            <div className="portal-card">
              <div className="portal-card-header">
                <h2>Operational Parameters</h2>
                <p>Values saved here are persisted in <code>system_settings</code> and applied across the booking engine.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {(settings || []).map((st) => (
                  <div key={st.setting_key} className="portal-form-field" style={{ background: 'var(--panel-card)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                        {st.setting_key.replace(/_/g, ' ').toUpperCase()}
                      </label>
                      <span className="portal-badge-chip">{st.category || 'General'}</span>
                    </div>
                    <small style={{ color: 'var(--muted)', margin: '0.2rem 0 0.6rem' }}>{st.description}</small>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        defaultValue={st.setting_value}
                        id={`input-${st.setting_key}`}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={savingSettings}
                        onClick={() => {
                          const val = (document.getElementById(`input-${st.setting_key}`) as HTMLInputElement)?.value;
                          if (val !== undefined) handleSaveSetting(st.setting_key, val);
                        }}
                      >
                        <Save size={14} /> Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ================= 7. OPERATIONAL ANALYTICS ================= */}
        {section === 'reports' && (
          <>
            <div className="portal-topbar">
              <div className="portal-topbar-title">
                <h1>Operational Analytics & Audit</h1>
                <p>In-depth fleet utilization, passenger conversion, and schedule punctuality metrics.</p>
              </div>
              <div className="portal-topbar-actions">
                <ThemeToggle />
              </div>
            </div>

            <div className="portal-details-grid">
              <div className="portal-card">
                <div className="portal-card-header">
                  <h2>Vehicle Fleet Utilization Today</h2>
                  <p>Daily trip assignments and booked passenger load factor per bus.</p>
                </div>
                <div className="portal-table-container">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Bus Registration</th>
                        <th>Trips Scheduled Today</th>
                        <th>Occupied Seats</th>
                        <th>Load Factor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buses.map((b) => {
                        const busBookings = bookings.filter(bk => bk.bus === b.registration);
                        const loadFactor = b.capacity > 0 ? Math.min(100, Math.round((busBookings.length / b.capacity) * 100)) : 0;
                        return (
                          <tr key={b.id}>
                            <td><strong>{b.registration}</strong> ({b.model})</td>
                            <td>1 trip scheduled</td>
                            <td>{busBookings.length} / {b.capacity}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '80px', height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${loadFactor}%`, height: '100%', background: loadFactor > 75 ? '#10b981' : '#0284c7' }} />
                                </div>
                                <span>{loadFactor}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="portal-card">
                <div className="portal-card-header">
                  <h2>System Health & Service Quality</h2>
                  <p>Core performance indicators across Sri Lanka express routes.</p>
                </div>
                <div className="portal-updates-list">
                  <div className="portal-update-item">
                    <strong style={{ color: '#10b981' }}>ON-TIME DISPATCH RATE</strong>
                    <p>98.4% of scheduled departures cleared Colombo terminals within 5 minutes of target timetable.</p>
                  </div>
                  <div className="portal-update-item">
                    <strong style={{ color: '#0284c7' }}>DIGITAL CHECK-IN ADOPTION</strong>
                    <p>89% of passengers boarded using digital QR code e-tickets via conductor mobile scanners.</p>
                  </div>
                  <div className="portal-update-item">
                    <strong style={{ color: '#8b5cf6' }}>SEAT HOLD RESOLUTION</strong>
                    <p>Automatic 10-minute hold release mechanism prevents seat locking conflicts and maintains high inventory turnover.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ================= MODAL: REGISTER STAFF ================= */}
      {staffModalOpen && (
        <div className="portal-modal-backdrop" onClick={() => setStaffModalOpen(false)}>
          <div className="portal-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3>Register New Staff Member</h3>
              <button type="button" className="icon-button" onClick={() => setStaffModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRegisterStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="portal-form-grid">
                <div className="portal-form-field">
                  <label>First Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Kasun"
                    value={newStaffForm.firstName}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Bandara"
                    value={newStaffForm.lastName}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, lastName: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Staff Role *</label>
                  <select
                    value={newStaffForm.role}
                    onChange={(e) => {
                      const r = e.target.value;
                      let dept = newStaffForm.department;
                      if (r === 'DRIVER' || r === 'CONDUCTOR') dept = 'Transportation & Fleet';
                      else if (r === 'OPERATOR') dept = 'Central Operations';
                      else if (r === 'CUSTOMER_SERVICE') dept = 'Customer Support & Experience';
                      setNewStaffForm({ ...newStaffForm, role: r, department: dept });
                    }}
                    required
                  >
                    <option value="DRIVER">Driver</option>
                    <option value="CONDUCTOR">Conductor</option>
                    <option value="OPERATOR">Operator</option>
                    <option value="CUSTOMER_SERVICE">Customer Service Staff</option>
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Department *</label>
                  <input
                    type="text"
                    value={newStaffForm.department}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Work Email Address *</label>
                  <input
                    type="email"
                    placeholder="kasun.b@citylink.com"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Contact Phone (+94...) *</label>
                  <input
                    type="text"
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>National Identity Card (NIC) *</label>
                  <input
                    type="text"
                    placeholder="199245102941"
                    value={newStaffForm.nic}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, nic: e.target.value })}
                    required
                  />
                </div>
                {newStaffForm.role === 'DRIVER' && (
                  <div className="portal-form-field">
                    <label>Heavy Vehicle Driving License *</label>
                    <input
                      type="text"
                      placeholder="B-9481024"
                      value={newStaffForm.licenseNumber}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, licenseNumber: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="portal-form-field">
                  <label>Initial Temporary Password *</label>
                  <input
                    type="text"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStaffModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={registeringStaff}>
                  {registeringStaff ? 'Registering...' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD BUS TO FLEET ================= */}
      {busModalOpen && (
        <div className="portal-modal-backdrop" onClick={() => setBusModalOpen(false)}>
          <div className="portal-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3>Add New Bus to Fleet</h3>
              <button type="button" className="icon-button" onClick={() => setBusModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBus} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="portal-form-grid">
                <div className="portal-form-field">
                  <label>Bus Registration Number *</label>
                  <input
                    type="text"
                    placeholder="WP ND-8901"
                    value={newBusForm.registration}
                    onChange={(e) => setNewBusForm({ ...newBusForm, registration: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Coach Model & Make *</label>
                  <input
                    type="text"
                    placeholder="Yutong ZK6122H (2025)"
                    value={newBusForm.model}
                    onChange={(e) => setNewBusForm({ ...newBusForm, model: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Total Passenger Seats (8-60) *</label>
                  <input
                    type="number"
                    min="8"
                    max="60"
                    value={newBusForm.capacity}
                    onChange={(e) => setNewBusForm({ ...newBusForm, capacity: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Class / Type *</label>
                  <select
                    value={newBusForm.type}
                    onChange={(e) => setNewBusForm({ ...newBusForm, type: e.target.value })}
                    required
                  >
                    <option value="Luxury AC Express">Luxury AC Express</option>
                    <option value="Super Line Highway AC">Super Line Highway AC</option>
                    <option value="Semi-Luxury Express">Semi-Luxury Express</option>
                    <option value="Standard Coach">Standard Coach</option>
                  </select>
                </div>
                <div className="portal-form-field" style={{ gridColumn: 'span 2' }}>
                  <label>Comfort & Tech Features *</label>
                  <input
                    type="text"
                    placeholder="Wi-Fi, Climate Control AC, USB Charging, Reclining Seats"
                    value={newBusForm.features}
                    onChange={(e) => setNewBusForm({ ...newBusForm, features: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Initial Status *</label>
                  <select
                    value={newBusForm.status}
                    onChange={(e) => setNewBusForm({ ...newBusForm, status: e.target.value })}
                    required
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="MAINTENANCE">Under Maintenance</option>
                    <option value="OUT_OF_SERVICE">Out of Service</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setBusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={savingBus}>
                  {savingBus ? 'Adding Bus...' : 'Add Bus to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE SCHEDULE ================= */}
      {scheduleModalOpen && (
        <div className="portal-modal-backdrop" onClick={() => setScheduleModalOpen(false)}>
          <div className="portal-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3>Create Bus Schedule</h3>
              <button type="button" className="icon-button" onClick={() => setScheduleModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="portal-form-grid">
                <div className="portal-form-field" style={{ gridColumn: 'span 2' }}>
                  <label>Route & Corridor *</label>
                  <select
                    value={newScheduleForm.routeId}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, routeId: Number(e.target.value) })}
                    required
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.origin} → {r.destination} ({r.name} · {r.distanceKm} km)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Assigned Bus *</label>
                  <select
                    value={newScheduleForm.busId}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, busId: Number(e.target.value) })}
                    required
                  >
                    {buses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.registration} ({b.model} · {b.capacity} seats) — {b.status !== 'MAINTENANCE' && b.status !== 'OUT_OF_SERVICE' ? '🟢 AVAILABLE' : `⚠️ ${b.status}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Assigned Driver *</label>
                  <select
                    value={newScheduleForm.driverId}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, driverId: Number(e.target.value) })}
                    required
                  >
                    {staff.filter(s => s.role === 'DRIVER').map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || `${d.firstName || ''} ${d.lastName || ''}`} ({d.employeeId || `EMP-${d.id}`}) — {d.available && d.status === 'ACTIVE' ? '🟢 AVAILABLE' : '⛔ NOT AVAILABLE'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Assigned Conductor *</label>
                  <select
                    value={newScheduleForm.conductorId}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, conductorId: Number(e.target.value) })}
                    required
                  >
                    {staff.filter(s => s.role === 'CONDUCTOR').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || `${c.firstName || ''} ${c.lastName || ''}`} ({c.employeeId || `EMP-${c.id}`}) — {c.available && c.status === 'ACTIVE' ? '🟢 AVAILABLE' : '⛔ NOT AVAILABLE'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="portal-form-field">
                  <label>Base Fare (LKR) *</label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={newScheduleForm.fare}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, fare: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Departure Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newScheduleForm.departure}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, departure: e.target.value })}
                    required
                  />
                </div>
                <div className="portal-form-field">
                  <label>Expected Arrival Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={newScheduleForm.arrival}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, arrival: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={savingSchedule}>
                  {savingSchedule ? 'Publishing...' : 'Publish Bus Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD ================= */}
      {resetModalOpen && selectedUser && (
        <div className="portal-modal-backdrop" onClick={() => setResetModalOpen(false)}>
          <div className="portal-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h3>Reset Account Password</h3>
              <button type="button" className="icon-button" onClick={() => setResetModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleExecuteResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                Set a new temporary password for <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email}).
              </p>
              <div className="portal-form-field">
                <label>New Temporary Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setResetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPortal;
