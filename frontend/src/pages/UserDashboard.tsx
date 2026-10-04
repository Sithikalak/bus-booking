import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Ticket,
  Navigation,
  Calendar,
  LogOut,
  Clock,
  BusFront,
  Compass,
  ChevronRight,
  Home,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  TrendingUp,
  Shield,
  Download,
  Globe,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useApi } from "../hooks/useApi";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Booking, Page } from "../types";

export function UserDashboard() {
  const { user, logout } = useApp();
  const [section, setSection] = useState<"overview" | "bookings" | "loyalty" | "alerts">("overview");

  // Fetch real user bookings from database
  const { data: bookingsPage, reload: reloadBookings } = useApi<Page<Booking>>(
    user ? "/bookings?size=20" : null,
    15000
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    reloadBookings();
    setTimeout(() => setRefreshing(false), 800);
  };

  const bookings = bookingsPage?.items || [];
  const activeBooking = bookings.find((b) => b.status === "CONFIRMED") || bookings[0];

  // If user is not logged in, prompt to sign in
  if (!user) {
    return (
      <div className="container" style={{ padding: "4rem 1.5rem", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <div className="capital-card" style={{ padding: "3rem 2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "rgba(0, 210, 255, 0.12)", color: "#00d2ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BusFront size={32} />
          </div>
          <h2 style={{ color: "var(--cap-title-color)" }}>Passenger Portal Sign In</h2>
          <p style={{ color: "var(--cap-text-muted)", maxWidth: "420px" }}>
            Please sign in to your passenger account to view your confirmed bookings, access digital e-tickets, and follow your live bus location.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <Link to="/login?next=/user-dashboard" className="capital-btn-export" style={{ background: "#00f5a0", color: "#090d14", fontWeight: 700, padding: "0.75rem 1.75rem", textDecoration: "none" }}>
              Sign In
            </Link>
            <Link to="/register" className="capital-filter-pill" style={{ padding: "0.75rem 1.5rem", textDecoration: "none", color: "var(--cap-title-color)" }}>
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="capital-layout">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="capital-sidebar">
        {/* Brand */}
        <div className="capital-brand">
          <div className="capital-brand-icon" style={{ background: "linear-gradient(135deg, #00d2ff, #00f5a0)" }}>
            <BusFront size={18} color="#090d14" />
          </div>
          <div className="capital-brand-text">
            <span>CityLink Express</span>
            <small>Passenger Suite</small>
          </div>
          <Link to="/" style={{ marginLeft: "auto", color: "#64748b" }} title="Public Site">
            <Home size={15} />
          </Link>
        </div>

        {/* Navigation Group 1: OVERVIEW */}
        <div className="capital-nav-group">
          <span className="capital-nav-title">OVERVIEW</span>
          <button
            type="button"
            className={`capital-nav-btn ${section === "overview" ? "active" : ""}`}
            onClick={() => setSection("overview")}
          >
            <Compass size={16} />
            <span>Dashboard</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
          <button
            type="button"
            className={`capital-nav-btn ${section === "bookings" ? "active" : ""}`}
            onClick={() => setSection("bookings")}
          >
            <Ticket size={16} />
            <span>My Journeys</span>
            <span className="capital-nav-badge">{bookings.length}</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </button>
        </div>

        {/* Navigation Group 2: TRAVEL SERVICES */}
        <div className="capital-nav-group">
          <span className="capital-nav-title">TRAVEL SERVICES</span>
          <Link to="/search" className="capital-nav-btn">
            <Compass size={16} />
            <span>Book New Ticket</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </Link>
          <Link to="/track" className="capital-nav-btn">
            <Navigation size={16} />
            <span>Live GPS Bus Tracking</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </Link>
          <Link to="/routes" className="capital-nav-btn">
            <Calendar size={16} />
            <span>Expressway Schedules</span>
            <ChevronRight size={13} className="capital-nav-arrow" />
          </Link>
        </div>

        {/* Go to Site Button */}
        <Link to="/" className="capital-goto-site" title="Return to Public Site">
          <Globe size={16} />
          <span>Go to Site</span>
          <ArrowRight size={14} style={{ marginLeft: "auto", opacity: 0.7 }} />
        </Link>

        {/* Bottom Profile Capsule */}
        <div style={{ marginTop: "auto", padding: "0.5rem 0 1rem" }}>
          <div className="capital-user-card">
            <div className="capital-user-avatar" style={{ background: "linear-gradient(135deg, #00d2ff, #00f5a0)" }}>
              {user.firstName ? user.firstName[0] : "P"}{user.lastName ? user.lastName[0] : ""}
            </div>
            <div className="capital-user-info">
              <div className="capital-user-meta">
                <strong>{user.firstName} {user.lastName}</strong>
                <small style={{ color: "#00d2ff" }}>GOLD PASSENGER</small>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
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
            <h1>Passenger Travel Suite</h1>
            <p>
              <span className="capital-status-dot" />
              <span>Last updated Today, 9:42 AM • Digital tickets synced with GPS tracker</span>
            </p>
          </div>

          <div className="capital-header-controls">
            <button
              type="button"
              className={`capital-refresh-btn ${refreshing ? "spinning" : ""}`}
              onClick={handleRefresh}
              title="Refresh my journeys"
            >
              <RefreshCw size={13} className={refreshing ? "spin-icon" : ""} />
              <span>Refresh</span>
            </button>

            <div className="capital-filter-pill">
              <Calendar size={13} color="#94a3b8" />
              <span>Feb 18 - Mar 18</span>
              <ChevronDown size={13} color="#64748b" />
            </div>

            <Link
              to="/search"
              className="capital-btn-export"
              style={{ textDecoration: "none" }}
            >
              <Compass size={13} />
              <span>Book Journey</span>
            </Link>

            <ThemeToggle />
          </div>
        </div>

        {/* 4 Top KPI Stat Cards */}
        <div className="capital-kpi-grid">
          {/* Card 1: Journey Status */}
          <div className="capital-card">
            <div className="capital-card-header">
              <span className="capital-card-title">Next Journey Status</span>
              <div className="capital-icon-pill">
                <Ticket size={14} color="#00f5a0" />
              </div>
            </div>

            <div className="capital-card-val-row">
              <span className="capital-val-large" style={{ fontSize: "1.3rem" }}>
                {activeBooking ? activeBooking.status : "READY TO BOOK"}
              </span>
              <div className="capital-delta-pill">
                <CheckCircle2 size={11} />
                <span>Confirmed Seat</span>
              </div>
            </div>

            {/* Spline Sparkline */}
            <svg className="capital-sparkline-svg" viewBox="0 0 280 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="paxSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00f5a0" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 35 Q 60 28, 120 18 T 200 12 T 280 5 L 280 40 L 0 40 Z"
                fill="url(#paxSparkGrad)"
              />
              <path
                d="M 0 35 Q 60 28, 120 18 T 200 12 T 280 5"
                fill="none"
                stroke="#00f5a0"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="capital-timeline-labels">
              <span>Terminal</span>
              <span>En Route</span>
              <span>Destination</span>
            </div>
          </div>

          {/* Card 2: Departure Time */}
          <div className="capital-card">
            <div className="capital-card-header">
              <span className="capital-card-title">Departure Countdown</span>
              <div className="capital-icon-pill">
                <Clock size={14} color="#00d2ff" />
              </div>
            </div>

            <div className="capital-card-val-row">
              <span className="capital-val-large">
                {activeBooking
                  ? new Date(activeBooking.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "08:30 AM"}
              </span>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Gate 4 Departure</span>
            </div>

            <div className="capital-segmented-bar" style={{ marginTop: "1rem" }}>
              <div className="capital-segment-fill" style={{ width: "75%" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.85rem", fontSize: "0.75rem", color: "#64748b" }}>
              <span>Boarding starts 15m prior</span>
              <span style={{ color: "#00d2ff" }}>Bastian Terminal</span>
            </div>
          </div>

          {/* Card 3: Loyalty & Travel Miles */}
          <div className="capital-card">
            <div className="capital-card-header">
              <span className="capital-card-title">CityLink Club Points</span>
              <div className="capital-icon-pill">
                <Sparkles size={14} color="#38bdf8" />
              </div>
            </div>

            <div className="capital-card-val-row">
              <span className="capital-val-large">1,840 <span style={{ fontSize: "1rem", color: "#64748b" }}>Pts</span></span>
            </div>

            {/* Stacked multi-color progress bar */}
            <div className="capital-stacked-bar" style={{ marginTop: "0.85rem" }}>
              <div className="capital-stacked-seg" style={{ width: "74%", background: "#00f5a0" }} />
              <div className="capital-stacked-seg" style={{ width: "26%", background: "#00d2ff" }} />
            </div>

            <div className="capital-stacked-legend">
              <div className="capital-stacked-leg-item">
                <span className="capital-leg-dot" style={{ background: "#00f5a0" }} />
                <span>Gold Member Tier</span>
                <strong style={{ marginLeft: "auto", color: "var(--cap-title-color)" }}>74% to Platinum</strong>
              </div>
            </div>
          </div>

          {/* Card 4: Service Safety & Reliability */}
          <div className="capital-card">
            <div className="capital-card-header">
              <span className="capital-card-title">Expressway Safety Score</span>
              <div className="capital-icon-pill">
                <Shield size={14} color="#f59e0b" />
              </div>
            </div>

            <div className="capital-card-val-row">
              <span className="capital-val-large">99<span style={{ fontSize: "1rem", color: "#64748b" }}>/100</span></span>
              <span style={{ fontSize: "0.78rem", color: "#f59e0b" }}>Zero highway alerts</span>
            </div>

            {/* Glowing Amber Sine Curve */}
            <svg className="capital-sparkline-svg" viewBox="0 0 280 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="paxSafetyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 26 C 50 14, 90 32, 140 20 C 190 10, 230 24, 280 14 L 280 40 L 0 40 Z"
                fill="url(#paxSafetyGrad)"
              />
              <path
                d="M 0 26 C 50 14, 90 32, 140 20 C 190 10, 230 24, 280 14"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="capital-timeline-labels">
              <span>Safety</span>
              <span>Comfort</span>
              <span>Punctuality</span>
            </div>
          </div>
        </div>

        {/* Middle Analytics Grid */}
        <div className="capital-analytics-grid">
          {/* Left (65%): Transit Velocity & Journey Progress */}
          <div className="capital-card">
            <div className="capital-card-header">
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0, color: "var(--cap-title-color)" }}>
                  Expressway Journey Velocity & Live Progress
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--cap-text-muted)" }}>
                  Real-time coach telemetry along Southern Expressway E01
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="capital-delta-pill">
                  <TrendingUp size={11} />
                  <span>On Schedule</span>
                </div>
                <Link
                  to="/track"
                  className="capital-filter-pill"
                  style={{ border: "none", background: "rgba(255,255,255,0.05)", color: "#00d2ff", textDecoration: "none" }}
                >
                  <span>Live Bus Map ↗</span>
                </Link>
              </div>
            </div>

            <div className="capital-chart-wrap">
              <svg viewBox="0 0 800 240" className="capital-chart-svg">
                <defs>
                  <linearGradient id="paxCruiseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#00f5a0" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#00f5a0" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <line x1="40" y1="40" x2="780" y2="40" stroke="var(--cap-card-border, #1e293b)" strokeDasharray="3 3" />
                <line x1="40" y1="90" x2="780" y2="90" stroke="var(--cap-card-border, #1e293b)" strokeDasharray="3 3" />
                <line x1="40" y1="140" x2="780" y2="140" stroke="var(--cap-card-border, #1e293b)" strokeDasharray="3 3" />
                <line x1="40" y1="190" x2="780" y2="190" stroke="var(--cap-card-border, #1e293b)" strokeDasharray="3 3" />

                <text x="30" y="44" fill="#475569" fontSize="10" textAnchor="end">100 km/h</text>
                <text x="30" y="94" fill="#475569" fontSize="10" textAnchor="end">80 km/h</text>
                <text x="30" y="144" fill="#475569" fontSize="10" textAnchor="end">60 km/h</text>
                <text x="30" y="194" fill="#475569" fontSize="10" textAnchor="end">40 km/h</text>

                <path
                  d="M 50 90 Q 200 90, 400 90 T 770 90"
                  fill="none"
                  stroke="#00d2ff"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                <path
                  d="M 50 170 C 120 160, 160 110, 220 98 C 280 86, 330 145, 410 130 C 490 115, 540 100, 620 95 C 690 90, 720 92, 770 88 L 770 200 L 50 200 Z"
                  fill="url(#paxCruiseGrad)"
                />
                <path
                  d="M 50 170 C 120 160, 160 110, 220 98 C 280 86, 330 145, 410 130 C 490 115, 540 100, 620 95 C 690 90, 720 92, 770 88"
                  fill="none"
                  stroke="#00f5a0"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="capital-chart-legend">
              <div className="capital-legend-item">
                <span className="capital-legend-marker" style={{ background: "#00f5a0" }} />
                <span>Coach Travel Speed</span>
              </div>
              <div className="capital-legend-item">
                <span className="capital-legend-marker" style={{ background: "#00d2ff", borderTop: "2px dashed #00d2ff" }} />
                <span>Expressway Benchmark (80 km/h)</span>
              </div>
            </div>

            <div className="capital-metric-strip">
              <div className="capital-strip-col">
                <span className="capital-strip-label">Departure Terminal</span>
                <strong className="capital-strip-val">Colombo Bastian</strong>
                <span className="capital-strip-delta" style={{ color: "#00f5a0" }}>Departed on time</span>
              </div>
              <div className="capital-strip-col">
                <span className="capital-strip-label">Next Stop</span>
                <strong className="capital-strip-val">Galle Port</strong>
                <span className="capital-strip-delta" style={{ color: "#00d2ff" }}>ETA: 35 mins</span>
              </div>
              <div className="capital-strip-col">
                <span className="capital-strip-label">Coach Model</span>
                <strong className="capital-strip-val">Volvo 9700</strong>
                <span className="capital-strip-delta" style={{ color: "#00f5a0" }}>AC & WiFi Active</span>
              </div>
              <div className="capital-strip-col">
                <span className="capital-strip-label">Seat Assignment</span>
                <strong className="capital-strip-val">{activeBooking?.seatNumber || activeBooking?.seat || "4A"}</strong>
                <span className="capital-strip-delta" style={{ color: "#00f5a0" }}>Window seat</span>
              </div>
            </div>
          </div>

          {/* Right (35%): Travel History Donut */}
          <div className="capital-card">
            <div className="capital-card-header">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0, color: "var(--cap-title-color)" }}>
                Travel History by Corridor
              </h3>
              <div className="capital-filter-pill" style={{ padding: "3px 10px" }}>
                <span style={{ color: "#00f5a0", fontSize: "0.75rem", fontWeight: 600 }}>Frequent</span>
              </div>
            </div>

            <div className="capital-donut-layout">
              <div className="capital-donut-svg-box">
                <svg viewBox="0 0 160 160" width="130" height="130">
                  <circle
                    cx="80" cy="80" r="54"
                    fill="none"
                    stroke="#00d2ff"
                    strokeWidth="16"
                    strokeDasharray="217 122"
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="80" cy="80" r="54"
                    fill="none"
                    stroke="#00f5a0"
                    strokeWidth="16"
                    strokeDasharray="88 251"
                    strokeDashoffset="-217"
                  />
                  <circle
                    cx="80" cy="80" r="54"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="16"
                    strokeDasharray="34 305"
                    strokeDashoffset="-305"
                  />
                </svg>
                <div className="capital-donut-center">
                  <span className="capital-donut-number">{Math.max(bookings.length, 12)}</span>
                  <span className="capital-donut-sub">Total Trips</span>
                </div>
              </div>

              <div className="capital-donut-legend">
                <div className="capital-donut-leg-row">
                  <span className="capital-leg-dot" style={{ background: "#00d2ff" }} />
                  <span className="capital-donut-leg-name">Southern Expressway</span>
                  <span className="capital-donut-leg-val">8 Trips</span>
                  <span className="capital-donut-leg-pct">65%</span>
                </div>
                <div className="capital-donut-leg-row">
                  <span className="capital-leg-dot" style={{ background: "#00f5a0" }} />
                  <span className="capital-donut-leg-name">Kandy Central</span>
                  <span className="capital-donut-leg-val">3 Trips</span>
                  <span className="capital-donut-leg-pct">25%</span>
                </div>
                <div className="capital-donut-leg-row">
                  <span className="capital-leg-dot" style={{ background: "#a855f7" }} />
                  <span className="capital-donut-leg-name">Northern Corridors</span>
                  <span className="capital-donut-leg-val">1 Trip</span>
                  <span className="capital-donut-leg-pct">10%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Bookings Table & Smart Passenger Assist */}
        <div className="capital-bottom-grid">
          {/* Left (65%): Confirmed Bookings Table */}
          <div className="capital-card">
            <div className="capital-card-header">
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0, color: "var(--cap-title-color)" }}>
                  My Booked Journeys & E-Tickets
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Access digital tickets and QR codes for boarding verification
                </p>
              </div>
              <Link
                to="/search"
                className="capital-filter-pill"
                style={{ border: "none", background: "rgba(255,255,255,0.05)", color: "#00f5a0", textDecoration: "none" }}
              >
                <span>Book New Journey ↗</span>
              </Link>
            </div>

            <div style={{ overflowX: "auto", marginTop: "1rem" }}>
              <table className="capital-table">
                <thead>
                  <tr>
                    <th>Ticket Ref</th>
                    <th>Corridor Route</th>
                    <th>Departure</th>
                    <th>Seat(s)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td><strong style={{ color: "#00d2ff", fontFamily: "monospace" }}>{b.reference}</strong></td>
                      <td>
                        <strong>{b.origin} ➔ {b.destination}</strong>
                        <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>{b.bus || "Volvo Luxury AC"}</p>
                      </td>
                      <td>{new Date(b.departure).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td><span style={{ color: "#00f5a0", fontWeight: 600 }}>{b.seat || b.seatNumber || "Assigned"}</span></td>
                      <td>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: b.status === "CONFIRMED" ? "rgba(0, 245, 160, 0.15)" : "rgba(255,255,255,0.05)",
                          color: b.status === "CONFIRMED" ? "#00f5a0" : "#94a3b8"
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <Link
                            to={`/ticket/${b.id}`}
                            className="capital-btn-export"
                            style={{ padding: "3px 8px", fontSize: "0.75rem", textDecoration: "none" }}
                          >
                            E-Ticket
                          </Link>
                          <Link
                            to={`/track?ref=${b.reference}`}
                            className="capital-btn-export"
                            style={{ padding: "3px 8px", fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", color: "#00d2ff", textDecoration: "none" }}
                          >
                            Track
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No bookings found. <Link to="/search" style={{ color: "#00d2ff" }}>Book your first intercity journey</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right (35%): Smart Passenger Assist */}
          <div className="capital-card">
            <div className="capital-card-header">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0, color: "var(--cap-title-color)" }}>
                Smart Passenger Assist
              </h3>
              <div className="capital-pill-ai">
                <Sparkles size={11} />
                <span>Trip AI</span>
              </div>
            </div>

            <div className="capital-insight-list">
              <div className="capital-insight-item">
                <div className="capital-insight-icon" style={{ background: "rgba(0, 245, 160, 0.15)", color: "#00f5a0" }}>
                  <Ticket size={16} />
                </div>
                <div className="capital-insight-content">
                  <span className="capital-insight-title">Offline E-Ticket Ready</span>
                  <p className="capital-insight-desc">
                    Your QR boarding pass is saved to device storage and can be scanned by conductors without active mobile data.
                  </p>
                  {activeBooking && (
                    <Link
                      to={`/ticket/${activeBooking.id}`}
                      className="capital-insight-btn"
                      style={{ textDecoration: "none" }}
                    >
                      Open Digital Ticket ↗
                    </Link>
                  )}
                </div>
              </div>

              <div className="capital-insight-item">
                <div className="capital-insight-icon" style={{ background: "rgba(0, 210, 255, 0.15)", color: "#00d2ff" }}>
                  <Navigation size={16} />
                </div>
                <div className="capital-insight-content">
                  <span className="capital-insight-title">Expressway Service Stop</span>
                  <p className="capital-insight-desc">
                    Welipenna rest area has a scheduled 10-minute refreshment stop. Clean restrooms and food court available.
                  </p>
                  <Link
                    to="/track"
                    className="capital-insight-btn"
                    style={{ textDecoration: "none" }}
                  >
                    View Route Stops ↗
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UserDashboard;
