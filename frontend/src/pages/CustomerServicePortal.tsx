import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useApi, api } from '../api/client';
import { RoleLoginCard } from '../components/RoleLoginCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Booking } from '../types';
import {
  LifeBuoy,
  MessageSquare,
  DollarSign,
  Search,
  CheckCircle2,
  Check,
  Clock,
  Send,
  User,
  Phone,
  ShieldCheck,
  RefreshCw,
  XCircle,
  Bell,
  ChevronRight,
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
  BusFront,
  Calendar,
  Globe,
  ArrowRight
} from 'lucide-react';

interface SupportTicket {
  id: number;
  passengerName: string;
  category: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  response?: string;
  createdAt: string;
}

interface RefundRequest {
  id: number;
  bookingReference: string;
  passengerName: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'FAILED' | 'PROCESSING';
  createdAt: string;
}

export function CustomerServicePortal() {
  const { user, logout } = useApp();
  const [section, setSection] = useState<'overview' | 'inquiries' | 'refunds' | 'lookup' | 'comms'>('overview');

  // Support tickets & Refunds API
  const { data: supportData, reload: reloadSupport } = useApi<any>('/customer-service', 8000);
  const { data: refundsData, reload: reloadRefunds } = useApi<any>('/refunds', 8000);

  // Filter & Search states
  const [ticketFilter, setTicketFilter] = useState('ALL');
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<Booking | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleExportCustomerService = () => {
    try {
      let csv = `CityLink Express Customer Support & Refund Audit Log\r\n`;
      csv += `Generated At,"${new Date().toLocaleString()}"\r\n`;
      csv += `Reporting Range,"${dateRange}"\r\n`;
      csv += `Reporting Interval,"${cadence}"\r\n\r\n`;

      csv += `--- SUPPORT TICKETS & INQUIRIES ---\r\n`;
      csv += `Ticket ID,Passenger,Category,Subject,Status,Created At\r\n`;
      (tickets || []).forEach((t) => {
        csv += `${t.id},"${t.passengerName}","${t.category}","${t.subject}","${t.status}","${t.createdAt}"\r\n`;
      });
      csv += `\r\n`;

      csv += `--- REFUND AUDIT LOG ---\r\n`;
      csv += `Refund ID,Booking Reference,Passenger,Amount (LKR),Status,Reason\r\n`;
      (refunds || []).forEach((r) => {
        csv += `${r.id},"${r.bookingReference}","${r.passengerName}",${r.amount},"${r.status}","${r.reason}"\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `CityLink_CustomerService_Log_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setActionSuccess(`Customer care log exported successfully (${filename}).`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to export customer care log');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    reloadSupport();
    reloadRefunds();
    setTimeout(() => setRefreshing(false), 800);
  };

  if (!user || user.role !== 'CUSTOMER_SERVICE') {
    return (
      <RoleLoginCard
        role="CUSTOMER_SERVICE"
        roleTitle="Customer Service Care Console"
        description="Resolve traveler inquiries and complaints, review cancellation refund requests, and track passenger booking histories."
        demoEmail="support@citylink.com"
        badgeColor="#00e5ff"
      />
    );
  }

  // Handlers
  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setLoading(true);
    try {
      await api.put(`/customer-service/${selectedTicket.id}`, {
        status: 'RESOLVED',
        response: replyText.trim()
      });
      setActionSuccess(`Response sent to passenger and Ticket #${selectedTicket.id} marked RESOLVED.`);
      setReplyText('');
      setSelectedTicket(null);
      reloadSupport();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRefund = async (refundId: number, approve: boolean) => {
    setLoading(true);
    try {
      await api(`/refunds/${refundId}/review`, 'POST', {
        approve,
        reason: approve ? '' : 'Cancellation request submitted past the cutoff policy.'
      });
      setActionSuccess(`Refund request #${refundId} has been ${approve ? 'APPROVED' : 'REJECTED'}.`);
      reloadRefunds();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Refund processing error');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await api.get<Booking>(`/bookings/verify?reference=${encodeURIComponent(lookupQuery.trim().toUpperCase())}`);
      setLookupResult(res);
    } catch (err: any) {
      setLookupError('No booking found matching reference ' + lookupQuery);
    } finally {
      setLookupLoading(false);
    }
  };

  const tickets: SupportTicket[] = Array.isArray(supportData) ? supportData : (supportData?.items || [
    {
      id: 101,
      passengerName: 'Nethmi Jayasinghe',
      category: 'DELAY',
      subject: 'Expressway delay update inquiry',
      description: 'Is the 07:00 AM Colombo - Kandy bus running on schedule today?',
      status: 'OPEN' as const,
      createdAt: new Date().toISOString()
    },
    {
      id: 102,
      passengerName: 'Kamal Perera',
      category: 'BOOKING',
      subject: 'Request to switch window seat',
      description: 'Would like to move from 2B aisle to window seat if available.',
      status: 'RESOLVED' as const,
      response: 'Window seat 2A has been reassigned to your ticket.',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ]);

  const refunds: RefundRequest[] = Array.isArray(refundsData) ? refundsData : (refundsData?.items || [
    {
      id: 201,
      bookingReference: 'CLX-DEMO-0004',
      passengerName: 'Nethmi Jayasinghe',
      amount: 1572.50,
      reason: 'Trip rescheduled due to personal emergency.',
      status: 'PENDING' as const,
      createdAt: new Date().toISOString()
    }
  ]);

  return (
    <div className="capital-layout">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="capital-sidebar">
        <div className="capital-brand">
          <div className="capital-brand-icon" style={{ background: 'linear-gradient(135deg, #00d2ff, #0284c7)' }}>
            <LifeBuoy size={18} color="#090d14" />
          </div>
          <div className="capital-brand-text">
            <span>Customer Care</span>
            <small>Helpdesk Suite</small>
          </div>
          <Link to="/" style={{ marginLeft: 'auto', color: '#64748b' }} title="Public Site">
            <Home size={15} />
          </Link>
        </div>

        <div className="capital-nav-group">
          <span className="capital-nav-title">OVERVIEW</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'overview' ? 'active' : ''}`}
            onClick={() => setSection('overview')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'inquiries' ? 'active' : ''}`}
            onClick={() => setSection('inquiries')}
          >
            <MessageSquare size={16} />
            <span>Inquiries Desk</span>
            <span className="capital-nav-badge">{tickets.filter((t) => t.status === 'OPEN').length}</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
        </div>

        <div className="capital-nav-group">
          <span className="capital-nav-title">OPERATIONS</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'refunds' ? 'active' : ''}`}
            onClick={() => setSection('refunds')}
          >
            <DollarSign size={16} />
            <span>Refund Requests</span>
            <span className="capital-nav-badge">{refunds.filter((r) => r.status === 'PENDING').length}</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'lookup' ? 'active' : ''}`}
            onClick={() => setSection('lookup')}
          >
            <Search size={16} />
            <span>Passenger Lookup</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === 'comms' ? 'active' : ''}`}
            onClick={() => setSection('comms')}
          >
            <Bell size={16} />
            <span>Notifications</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
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
              <div className="capital-user-avatar" style={{ background: 'linear-gradient(135deg, #00d2ff, #0284c7)' }}>
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="capital-user-meta">
                <strong>{user.firstName} {user.lastName}</strong>
                <small style={{ color: '#00d2ff' }}>SUPPORT AGENT</small>
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
              {section === 'overview' && 'Customer Support Overview'}
              {section === 'inquiries' && 'Passenger Inquiries & Complaints Desk'}
              {section === 'refunds' && 'Cancellation Refund Verification'}
              {section === 'lookup' && 'Passenger Booking & Ticket Lookup'}
              {section === 'comms' && 'Passenger Communications & Broadcasts'}
            </h1>
            <p>
              <span className="capital-status-dot" />
              <span>Last updated Today, 9:42 AM • All support desks active</span>
            </p>
          </div>

          <div className="capital-header-controls">
            <button
              type="button"
              className={`capital-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              title="Refresh support tickets & refunds"
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
                        setActionSuccess(`Support inquiries window set to: ${opt}`);
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
              onClick={handleExportCustomerService}
              title="Download Customer Support & Refund Log (CSV)"
            >
              <Download size={13} />
              <span>Export Ticket Log ↗</span>
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

        {/* ================= 1. CAPITALIO CUSTOMER SERVICE OVERVIEW ================= */}
        {section === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top 4 KPI Cards */}
            <div className="capital-kpi-grid">
              {/* Card 1: Total Inquiries */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>Total Inquiries & Tickets</span>
                  <div className="capital-card-icon" title="Ticket Volume">
                    <Sparkles size={14} color="#10b981" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">1,420</span>
                  <span className="capital-delta-pill">
                    +12.4% vs last week
                  </span>
                </div>
                <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <svg width="100%" height="45" viewBox="0 0 200 45" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="csGradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,38 C30,36 60,28 90,24 C120,20 150,12 200,6 L200,45 L0,45 Z" fill="url(#csGradGreen)" />
                    <path d="M0,38 C30,36 60,28 90,24 C120,20 150,12 200,6" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>

              {/* Card 2: First Contact Resolution */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>First Contact Resolution (FCR)</span>
                  <div className="capital-card-icon">
                    <Activity size={14} color="#38bdf8" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">89.2%</span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    +4.2% to target
                  </span>
                </div>
                <div className="capital-segmented-bar">
                  <div className="capital-segmented-fill" style={{ width: '89.2%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 6px' }}>
                  <span>84 Resolved Today</span>
                  <span style={{ color: 'var(--cap-title-color)', fontWeight: 600 }}>Target 92%</span>
                </div>
                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>

              {/* Card 3: Average Handling Time */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>Average Handling Time</span>
                  <div className="capital-card-icon">
                    <Clock size={14} color="#a855f7" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">2.4m</span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    -35s faster than SLA
                  </span>
                </div>
                <div className="capital-stacked-bar">
                  <div className="capital-stacked-seg" style={{ width: '60%', background: '#10b981' }} title="Live Chat 60%" />
                  <div className="capital-stacked-seg" style={{ width: '28%', background: '#0284c7' }} title="Voice Call 28%" />
                  <div className="capital-stacked-seg" style={{ width: '12%', background: '#a855f7' }} title="Ticket Email 12%" />
                </div>
                <div className="capital-stacked-legend">
                  <span><span style={{ color: '#10b981' }}>■</span> Chat & Voice <strong>88%</strong></span>
                  <span><span style={{ color: '#a855f7' }}>■</span> Email <strong>12%</strong></span>
                </div>
              </div>

              {/* Card 4: CSAT Score */}
              <div className="capital-card">
                <div className="capital-card-top">
                  <span>Customer Satisfaction (CSAT)</span>
                  <div className="capital-card-icon">
                    <ShieldCheck size={14} color="#f59e0b" />
                  </div>
                </div>
                <div className="capital-card-val-row">
                  <span className="capital-val-large">4.9<small style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8' }}>/5.0</small></span>
                  <span className="capital-delta-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    Exceptional
                  </span>
                </div>
                <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <svg width="100%" height="45" viewBox="0 0 200 45" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="csGradAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,28 Q50,8 100,24 T200,16 L200,45 L0,45 Z" fill="url(#csGradAmber)" />
                    <path d="M0,28 Q50,8 100,24 T200,16" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>
            </div>

            {/* Middle Analytics: Spline Chart (65%) + Donut Chart (35%) */}
            <div className="capital-analytics-grid">
              {/* Left Card: Ticket Volume & Resolution Velocity */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <div>
                    <h2>Support Throughput & Velocity</h2>
                  </div>
                  <div className="capital-panel-actions">
                    <span className="capital-badge-ytd">+18.5% Solved</span>
                    <button type="button" className="capital-link-action" onClick={() => setSection('inquiries')}>
                      View Queue ↗
                    </button>
                  </div>
                </div>

                <div className="capital-chart-legend">
                  <div className="capital-legend-item">
                    <span className="capital-legend-dot" style={{ background: '#00f5a0' }} />
                    <span>Resolved Tickets</span>
                  </div>
                  <div className="capital-legend-item">
                    <span className="capital-legend-dot" style={{ background: '#00d2ff', border: '1px dashed #00d2ff' }} />
                    <span>Inbound Queries</span>
                  </div>
                </div>

                <div className="capital-chart-wrap">
                  <svg width="100%" height="220" viewBox="0 0 700 220" fill="none" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="csPerfGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#00f5a0" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1="40" y1="20" x2="680" y2="20" stroke="var(--cap-card-border, rgba(255,255,255,0.05))" strokeDasharray="3 3" />
                    <text x="32" y="24" fill="#64748b" fontSize="10" textAnchor="end">350</text>

                    <line x1="40" y1="60" x2="680" y2="60" stroke="var(--cap-card-border, rgba(255,255,255,0.05))" strokeDasharray="3 3" />
                    <text x="32" y="64" fill="#64748b" fontSize="10" textAnchor="end">280</text>

                    <line x1="40" y1="100" x2="680" y2="100" stroke="var(--cap-card-border, rgba(255,255,255,0.05))" strokeDasharray="3 3" />
                    <text x="32" y="104" fill="#64748b" fontSize="10" textAnchor="end">210</text>

                    <line x1="40" y1="140" x2="680" y2="140" stroke="var(--cap-card-border, rgba(255,255,255,0.05))" strokeDasharray="3 3" />
                    <text x="32" y="144" fill="#64748b" fontSize="10" textAnchor="end">140</text>

                    <line x1="40" y1="180" x2="680" y2="180" stroke="var(--cap-card-border, rgba(255,255,255,0.05))" strokeDasharray="3 3" />
                    <text x="32" y="184" fill="#64748b" fontSize="10" textAnchor="end">70</text>

                    <path
                      d="M50,150 C120,140 160,80 240,145 C300,195 370,130 440,130 C510,130 570,30 670,38 L670,195 L50,195 Z"
                      fill="url(#csPerfGreen)"
                    />

                    <path
                      d="M50,150 C120,140 160,80 240,145 C300,195 370,130 440,130 C510,130 570,30 670,38"
                      stroke="#00f5a0"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />

                    <path
                      d="M50,135 C130,130 180,110 250,122 C330,135 410,125 490,110 C570,95 630,85 670,80"
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
                    <small>Open Backlog</small>
                    <strong>{tickets.filter((t) => t.status === 'OPEN').length} Tickets</strong>
                    <span>-18.4%</span>
                  </div>
                  <div className="capital-strip-col">
                    <small>Average Wait</small>
                    <strong>1.2 mins</strong>
                    <span>Optimal</span>
                  </div>
                  <div className="capital-strip-col">
                    <small>Escalation Rate</small>
                    <strong>0.8%</strong>
                    <span>-0.4%</span>
                  </div>
                  <div className="capital-strip-col">
                    <small>SLA Compliance</small>
                    <strong>99.1%</strong>
                    <span>+1.2%</span>
                  </div>
                </div>
              </div>

              {/* Right Card: Category Distribution Donut Chart */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Inquiry Categories</h2>
                  <span className="capital-badge-ytd" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    Active
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
                  {/* Centered & Enlarged Donut SVG */}
                  <div style={{ position: 'relative', width: '210px', height: '210px', margin: '0.75rem auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: 'rotate(-90deg)' }}>
                      {/* Segment 1: Blue (Booking Changes: 42%) */}
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
                      {/* Segment 2: Green (Refund Requests: 28%) */}
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#10b981"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="140.7 502.7"
                        strokeDashoffset="-211.1"
                      />
                      {/* Segment 3: Purple (Live GPS Tracking: 18%) */}
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#a855f7"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="90.5 502.7"
                        strokeDashoffset="-351.8"
                      />
                      {/* Segment 4: Orange (General & Luggage: 12%) */}
                      <circle
                        cx="105"
                        cy="105"
                        r="80"
                        stroke="#f97316"
                        strokeWidth="24"
                        fill="none"
                        strokeDasharray="60.3 502.7"
                        strokeDashoffset="-442.3"
                      />
                    </svg>
                    <div className="capital-donut-center">
                      <strong style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground, #ffffff)', lineHeight: 1 }}>1,420</strong>
                      <small style={{ fontSize: '0.85rem', color: 'var(--muted, #94a3b8)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '4px' }}>Inquiries</small>
                    </div>
                  </div>

                  {/* 4 Rows in Legend underneath chart */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
                    {/* Row 1: Booking Changes */}
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
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Booking Changes</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>596</strong>
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

                    {/* Row 2: Refund Requests */}
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
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Refund Requests</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>398</strong>
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
                        }}>28%</span>
                      </div>
                    </div>

                    {/* Row 3: Live GPS Tracking */}
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
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>Live GPS Tracking</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>255</strong>
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
                        }}>18%</span>
                      </div>
                    </div>

                    {/* Row 4: General & Luggage */}
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
                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--foreground, #ffffff)' }}>General & Luggage</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground, #ffffff)' }}>171</strong>
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
                        }}>12%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: High Priority Inquiries Table + Smart Support Insights */}
            <div className="capital-bottom-grid">
              {/* Left: Active Inquiries Table */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Active Passenger Inquiries</h2>
                  <button type="button" className="capital-link-action" onClick={() => setSection('inquiries')}>
                    View all {tickets.length} ↗
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="capital-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>No</th>
                        <th>Passenger</th>
                        <th>Subject & Category</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.slice(0, 5).map((t, idx) => (
                        <tr key={t.id}>
                          <td style={{ color: '#64748b' }}>{idx + 1}</td>
                          <td>
                            <div className="capital-asset-cell">
                              <div className="capital-asset-icon">
                                <User size={14} />
                              </div>
                              <div>
                                <strong style={{ color: 'var(--cap-title-color)', display: 'block' }}>{t.passengerName}</strong>
                                <small style={{ color: '#64748b' }}>Ticket #{t.id}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--cap-title-color)', display: 'block' }}>{t.subject}</strong>
                            <span className="capital-delta-pill" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                              {t.category}
                            </span>
                          </td>
                          <td style={{ color: '#94a3b8' }}>Live Web Chat</td>
                          <td>
                            <span
                              className="capital-delta-pill"
                              style={{
                                background: t.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: t.status === 'RESOLVED' ? '#10b981' : '#f59e0b'
                              }}
                            >
                              {t.status === 'RESOLVED' ? '✓ Resolved' : '● Action Required'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="capital-insight-btn"
                              onClick={() => {
                                setSelectedTicket(t);
                                setSection('inquiries');
                              }}
                            >
                              Respond →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Smart Support Insights */}
              <div className="capital-card" style={{ padding: '1.4rem 1.6rem' }}>
                <div className="capital-panel-header">
                  <h2>Smart Support Insights</h2>
                  <span className="capital-badge-ytd" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    AI Recommendation
                  </span>
                </div>

                <div className="capital-insight-list">
                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Auto-Refund Verification</h4>
                      <p>Refund request #12 qualifies for 100% refund under the cancellation policy (submitted 26h prior to departure).</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('refunds')}>
                        Review & Approve Refund →
                      </button>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                      <Activity size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Helpline Surge Detected</h4>
                      <p>High chat volume regarding evening departures on Route 01 (Colombo-Galle). Real-time GPS tracking link auto-shared.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('lookup')}>
                        Lookup Bus Location →
                      </button>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div className="capital-insight-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                      <Sparkles size={18} />
                    </div>
                    <div className="capital-insight-content">
                      <h4>Passenger Broadcast Suggestion</h4>
                      <p>Send automated SMS & in-app alerts to 44 passengers on scheduled trip #101 regarding boarding gate assignment.</p>
                      <button type="button" className="capital-insight-btn" onClick={() => setSection('comms')}>
                        Broadcast Notification →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1. INQUIRIES & COMPLAINTS DESK */}
        {section === 'inquiries' && (
          <div className="capital-card">
            <div className="capital-card-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--cap-title-color)' }}>
                  Passenger Inquiries & Complaints Desk
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Respond promptly to traveler questions, schedule inquiries, and service feedback.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search inquiries..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  style={{ background: 'var(--cap-input-bg)', border: '1px solid var(--cap-input-border)', color: 'var(--cap-title-color)', padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem' }}
                />
                <select
                  value={ticketFilter}
                  onChange={(e) => setTicketFilter(e.target.value)}
                  style={{ background: 'var(--cap-input-bg)', border: '1px solid var(--cap-input-border)', color: 'var(--cap-title-color)', padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open Inquiries</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="capital-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Passenger Name</th>
                    <th>Category</th>
                    <th>Subject & Description</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets
                    .filter((t) => ticketFilter === 'ALL' || t.status === ticketFilter)
                    .filter((t) => !ticketSearch || (t.passengerName + ' ' + t.subject).toLowerCase().includes(ticketSearch.toLowerCase()))
                    .map((t) => (
                      <tr key={t.id}>
                        <td><strong style={{ color: '#00d2ff', fontFamily: 'monospace' }}>#{t.id}</strong></td>
                        <td><strong style={{ color: 'var(--cap-title-color)' }}>{t.passengerName}</strong></td>
                        <td><span className="capital-delta-pill" style={{ background: 'rgba(0, 229, 255, 0.15)', color: '#00e5ff' }}>{t.category}</span></td>
                        <td>
                          <strong style={{ color: 'var(--cap-title-color)', display: 'block' }}>{t.subject}</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{t.description}</p>
                          {t.response && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#00f5a0' }}>↳ Reply: {t.response}</p>
                          )}
                        </td>
                        <td>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span
                            className="capital-delta-pill"
                            style={{
                              background: t.status === 'RESOLVED' ? 'rgba(0, 245, 160, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: t.status === 'RESOLVED' ? '#00f5a0' : '#f59e0b'
                            }}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td>
                          {t.status !== 'RESOLVED' && (
                            <button
                              type="button"
                              className="capital-btn-export"
                              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                              onClick={() => setSelectedTicket(t)}
                            >
                              Reply & Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Reply Modal */}
            {selectedTicket && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1000,
                padding: '1rem'
              }}>
                <div className="capital-card" style={{ maxWidth: '520px', width: '100%', gap: '1.25rem' }}>
                  <div className="capital-card-header">
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--cap-title-color)' }}>
                      Reply to Ticket #{selectedTicket.id}
                    </h3>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                      onClick={() => setSelectedTicket(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ background: 'var(--cap-card-border)', opacity: 0.9, padding: '1rem', borderRadius: '10px' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#00d2ff' }}>{selectedTicket.subject}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--cap-title-color)' }}>{selectedTicket.description}</p>
                  </div>
                  <form onSubmit={handleSendTicketReply} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Customer Support Official Response</label>
                      <textarea
                        rows={4}
                        required
                        placeholder="Type reply to be delivered to passenger..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        style={{
                          background: 'var(--cap-input-bg)',
                          border: '1px solid var(--cap-input-border)',
                          color: 'var(--cap-title-color)',
                          borderRadius: '8px',
                          padding: '0.75rem'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="capital-filter-pill"
                        onClick={() => setSelectedTicket(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="capital-btn-export"
                        disabled={loading}
                      >
                        {loading ? 'Sending...' : 'Send Response & Resolve'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. REFUND REQUESTS PROCESSING */}
        {section === 'refunds' && (
          <div className="capital-card">
            <div className="capital-card-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--cap-title-color)' }}>
                  Cancellation Refund Verification
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Verify passenger cancellation timestamps against the 12-hour departure cutoff policy.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="capital-table">
                <thead>
                  <tr>
                    <th>Refund ID</th>
                    <th>Ticket Ref</th>
                    <th>Passenger Name</th>
                    <th>Refund Amount (85%)</th>
                    <th>Reason Stated</th>
                    <th>Status</th>
                    <th>Review Action</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <td><strong style={{ color: '#00d2ff', fontFamily: 'monospace' }}>#{r.id}</strong></td>
                      <td><span style={{ fontFamily: 'monospace', color: '#00d2ff' }}>{r.bookingReference}</span></td>
                      <td><strong style={{ color: 'var(--cap-title-color)' }}>{r.passengerName}</strong></td>
                      <td><strong style={{ color: '#00f5a0' }}>LKR {r.amount.toLocaleString()}</strong></td>
                      <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{r.reason}</td>
                      <td>
                        <span
                          className="capital-delta-pill"
                          style={{
                            background: r.status === 'APPROVED' ? 'rgba(0, 245, 160, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: r.status === 'APPROVED' ? '#00f5a0' : '#f59e0b'
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {(r.status === 'PENDING' || r.status === 'REQUESTED') ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="capital-btn-export"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#00f5a0', color: '#090d14', fontWeight: 700 }}
                              disabled={loading}
                              onClick={() => handleProcessRefund(r.id, true)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="capital-filter-pill"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#ef4444', borderColor: '#ef4444' }}
                              disabled={loading}
                              onClick={() => handleProcessRefund(r.id, false)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. BOOKING LOOKUP */}
        {section === 'lookup' && (
          <div className="capital-card" style={{ maxWidth: '680px' }}>
            <div className="capital-card-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--cap-title-color)' }}>
                  Passenger Booking Lookup
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Instant booking verification and e-ticket retrieval by reference or contact info.
                </p>
              </div>
            </div>

            <form onSubmit={handleLookupBooking} style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <input
                type="text"
                required
                placeholder="Enter reference e.g. CLX-DEMO-0001"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--cap-input-bg)',
                  border: '1px solid var(--cap-input-border)',
                  color: 'var(--cap-title-color)',
                  borderRadius: '8px',
                  padding: '0.8rem 1rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                type="submit"
                className="capital-btn-export"
                disabled={lookupLoading}
              >
                {lookupLoading ? 'Searching...' : 'Search Booking'}
              </button>
            </form>

            {lookupError && (
              <p style={{ color: '#ef4444', margin: '0.75rem 0 0', fontSize: '0.88rem' }}>{lookupError}</p>
            )}

            {lookupResult && (
              <div style={{ marginTop: '1.25rem', background: 'var(--cap-card-border)', opacity: 0.95, borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#00d2ff', fontFamily: 'monospace' }}>#{lookupResult.reference}</h3>
                  <span className="capital-delta-pill" style={{ color: '#00f5a0' }}>
                    {lookupResult.status}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <small style={{ color: 'var(--cap-text-muted)' }}>PASSENGER NAME</small>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--cap-title-color)' }}>{lookupResult.passengerName}</p>
                  </div>
                  <div>
                    <small style={{ color: 'var(--cap-text-muted)' }}>ASSIGNED SEAT</small>
                    <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#00d2ff' }}>Seat {lookupResult.seat}</p>
                  </div>
                  <div>
                    <small style={{ color: 'var(--cap-text-muted)' }}>JOURNEY</small>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--cap-title-color)' }}>{lookupResult.origin} ➔ {lookupResult.destination}</p>
                  </div>
                  <div>
                    <small style={{ color: 'var(--cap-text-muted)' }}>TOTAL PAID</small>
                    <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#00f5a0' }}>LKR {lookupResult.totalAmount}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. COMMS LOG */}
        {section === 'comms' && (
          <div className="capital-card">
            <div className="capital-card-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--cap-title-color)' }}>
                  Passenger Communications Log
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Automated SMS and email travel advisories dispatched to passengers.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="capital-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Alert Category</th>
                    <th>Title & Advisory Content</th>
                    <th>Channel</th>
                    <th>Delivery Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>07:05 AM</td>
                    <td><span className="capital-delta-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>TRAFFIC_DELAY</span></td>
                    <td>
                      <strong style={{ color: 'var(--cap-title-color)' }}>Expressway Congestion Notice</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Bus CLX-201 delayed by +15 minutes due to heavy rain at Kadawatha entrance.</p>
                    </td>
                    <td>SMS & In-App</td>
                    <td><span style={{ color: '#00f5a0', fontWeight: 600 }}>✓ Delivered</span></td>
                  </tr>
                  <tr>
                    <td>06:30 AM</td>
                    <td><span className="capital-delta-pill" style={{ background: 'rgba(0, 245, 160, 0.15)', color: '#00f5a0' }}>BOARDING_CALL</span></td>
                    <td>
                      <strong style={{ color: 'var(--cap-title-color)' }}>Boarding Commenced - Bay #4</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Colombo to Kandy passengers invited to proceed to gate with QR e-ticket.</p>
                    </td>
                    <td>In-App Push</td>
                    <td><span style={{ color: '#00f5a0', fontWeight: 600 }}>✓ Delivered</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default CustomerServicePortal;
