import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  BusFront,
  Ticket,
  Clock,
  Download,
  TrendingUp,
  Sparkles,
  ChevronDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Shield,
  RefreshCw
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useApp } from "../context/AppContext";
import { Loading, ErrorBox, money, dateTime } from "../components/UI";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Dashboard as Data, Trip, Page } from "../types";

export default function Dashboard({ reports = false }: { reports?: boolean }) {
  const { user } = useApp();
  const { data, error, loading, reload } = useApi<Data>("/dashboard", 30000);
  const { data: trips } = useApi<Page<Trip>>("/schedules?size=100", 30000);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 800);
  };

  function download() {
    if (!data) return;
    const rows = [
      "Date,Bookings,Revenue_LKR",
      ...data.daily.map((d) => `${d.date},${d.bookings},${d.revenue}`),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "citylink-weekly-report.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={{ padding: "0 0 2rem" }}>
      {/* Capitalio Topbar Header */}
      <div className="capital-header">
        <div className="capital-header-title">
          <h1>
            {reports ? "Insights & Performance Analytics" : `Operations Overview`}
          </h1>
          <p>
            <span className="capital-status-dot" />
            <span>
              Last updated Today, 9:42 AM • All Sri Lanka intercity corridors live
            </span>
          </p>
        </div>

        <div className="capital-header-controls">
          <button
            type="button"
            className={`capital-refresh-btn ${refreshing ? "spinning" : ""}`}
            onClick={handleRefresh}
            title="Refresh operations metrics"
          >
            <RefreshCw size={13} className={refreshing ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>

          <div className="capital-filter-pill">
            <Calendar size={13} color="#94a3b8" />
            <span>Last 7 Days</span>
            <ChevronDown size={13} color="#64748b" />
          </div>

          <div className="capital-filter-pill">
            <span>Weekly</span>
            <ChevronDown size={13} color="#64748b" />
          </div>

          <button
            type="button"
            className="capital-btn-export"
            onClick={download}
            disabled={!data}
          >
            <Download size={13} />
            <span>Export Report</span>
          </button>

          <ThemeToggle />
        </div>
      </div>

      <ErrorBox message={error} retry={reload} />

      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            {/* 4 Top KPI Stat Cards */}
            <div className="capital-kpi-grid">
              {/* Card 1: Net Revenue */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <span className="capital-card-title">Net Network Revenue</span>
                  <div className="capital-icon-pill">
                    <TrendingUp size={14} color="#00f5a0" />
                  </div>
                </div>

                <div className="capital-card-val-row">
                  <span className="capital-val-large">{money(data.revenue)}</span>
                  <div className="capital-delta-pill">
                    <TrendingUp size={11} />
                    <span>+15% vs last month</span>
                  </div>
                </div>

                {/* Spline Sparkline */}
                <svg
                  className="capital-sparkline-svg"
                  viewBox="0 0 280 40"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#00f5a0" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 35 Q 60 30, 110 20 T 200 12 T 280 4 L 280 40 L 0 40 Z"
                    fill="url(#dashRevGrad)"
                  />
                  <path
                    d="M 0 35 Q 60 30, 110 20 T 200 12 T 280 4"
                    fill="none"
                    stroke="#00f5a0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="capital-timeline-labels">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>

              {/* Card 2: Today's Trips & Fleet Readiness */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <span className="capital-card-title">Today’s Schedule</span>
                  <div className="capital-icon-pill">
                    <CalendarDays size={14} color="#00d2ff" />
                  </div>
                </div>

                <div className="capital-card-val-row">
                  <span className="capital-val-large">
                    {data.todayTrips}{" "}
                    <span style={{ fontSize: "1rem", color: "#64748b" }}>
                      Trips
                    </span>
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    {data.activeBuses} Active Buses
                  </span>
                </div>

                <div className="capital-segmented-bar" style={{ marginTop: "1rem" }}>
                  <div
                    className="capital-segment-fill"
                    style={{ width: "94%" }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "0.85rem",
                    fontSize: "0.75rem",
                    color: "#64748b",
                  }}
                >
                  <span>94% on-time departure</span>
                  <span style={{ color: "#00d2ff" }}>All terminals open</span>
                </div>
              </div>

              {/* Card 3: Seat Inventory */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <span className="capital-card-title">Seat Inventory & Bookings</span>
                  <div className="capital-icon-pill">
                    <Ticket size={14} color="#38bdf8" />
                  </div>
                </div>

                <div className="capital-card-val-row">
                  <span className="capital-val-large">
                    {data.totalBookings}{" "}
                    <span style={{ fontSize: "1rem", color: "#64748b" }}>
                      Booked
                    </span>
                  </span>
                </div>

                {/* Stacked multi-color progress bar */}
                <div className="capital-stacked-bar" style={{ marginTop: "0.85rem" }}>
                  <div
                    className="capital-stacked-seg"
                    style={{ width: "65%", background: "#00f5a0" }}
                  />
                  <div
                    className="capital-stacked-seg"
                    style={{ width: "25%", background: "#00d2ff" }}
                  />
                  <div
                    className="capital-stacked-seg"
                    style={{ width: "10%", background: "#a855f7" }}
                  />
                </div>

                <div className="capital-stacked-legend">
                  <div className="capital-stacked-leg-item">
                    <span
                      className="capital-leg-dot"
                      style={{ background: "#00f5a0" }}
                    />
                    <span>Available Seats</span>
                    <strong style={{ marginLeft: "auto", color: "#f1f5f9" }}>
                      {data.availableSeats}
                    </strong>
                  </div>
                  <div className="capital-stacked-leg-item">
                    <span
                      className="capital-leg-dot"
                      style={{ background: "#00d2ff" }}
                    />
                    <span>Confirmed Bookings</span>
                    <strong style={{ marginLeft: "auto", color: "#f1f5f9" }}>
                      {data.totalBookings}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 4: Network Reliability & Delays */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <span className="capital-card-title">Network Reliability</span>
                  <div className="capital-icon-pill">
                    <Shield size={14} color="#f59e0b" />
                  </div>
                </div>

                <div className="capital-card-val-row">
                  <span className="capital-val-large">
                    {data.delayedTrips > 0 ? "96" : "99"}
                    <span style={{ fontSize: "1rem", color: "#64748b" }}>
                      /100
                    </span>
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#f59e0b" }}>
                    {data.delayedTrips === 0
                      ? "Zero highway delays"
                      : `${data.delayedTrips} Delayed Trips`}
                  </span>
                </div>

                {/* Glowing Amber Sine Curve */}
                <svg
                  className="capital-sparkline-svg"
                  viewBox="0 0 280 40"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="dashRelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 26 C 50 14, 90 32, 140 20 C 190 10, 230 24, 280 14 L 280 40 L 0 40 Z"
                    fill="url(#dashRelGrad)"
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
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                </div>
              </div>
            </div>

            {/* Middle Analytics Grid */}
            <div className="capital-analytics-grid">
              {/* Left (65%): Demand & Booking Velocity */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <div>
                    <h3
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        margin: 0,
                        color: "#f8fafc",
                      }}
                    >
                      {reports
                        ? "Revenue Performance (7 Days)"
                        : "Booking Activity & Reservation Velocity"}
                    </h3>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "0.8rem",
                        color: "#64748b",
                      }}
                    >
                      Daily ticket conversions vs benchmark target curve
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <div className="capital-delta-pill">
                      <TrendingUp size={11} />
                      <span>+14.7% YTD</span>
                    </div>
                    <Link
                      to="/dashboard/schedules"
                      className="capital-filter-pill"
                      style={{
                        border: "none",
                        background: "rgba(255,255,255,0.05)",
                        color: "#94a3b8",
                        textDecoration: "none",
                      }}
                    >
                      <span>Full Analysis ↗</span>
                    </Link>
                  </div>
                </div>

                <div className="capital-chart-wrap">
                  <svg viewBox="0 0 800 240" className="capital-chart-svg">
                    <defs>
                      <linearGradient id="dashSplineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f5a0" stopOpacity="0.4" />
                        <stop offset="60%" stopColor="#00f5a0" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="#00f5a0" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Dotted horizontal grid lines */}
                    <line
                      x1="40"
                      y1="40"
                      x2="780"
                      y2="40"
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="40"
                      y1="90"
                      x2="780"
                      y2="90"
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="40"
                      y1="140"
                      x2="780"
                      y2="140"
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1="40"
                      y1="190"
                      x2="780"
                      y2="190"
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />

                    {/* Y-axis labels */}
                    <text x="30" y="44" fill="#475569" fontSize="10" textAnchor="end">
                      700
                    </text>
                    <text x="30" y="94" fill="#475569" fontSize="10" textAnchor="end">
                      500
                    </text>
                    <text x="30" y="144" fill="#475569" fontSize="10" textAnchor="end">
                      300
                    </text>
                    <text x="30" y="194" fill="#475569" fontSize="10" textAnchor="end">
                      100
                    </text>

                    {/* Dashed Benchmark Curve */}
                    <path
                      d="M 50 170 Q 200 140, 360 170 T 600 130 T 770 125"
                      fill="none"
                      stroke="#00d2ff"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />

                    {/* Actual Spline Curve with Area Fill */}
                    <path
                      d="M 50 160 C 130 155, 170 100, 240 100 C 310 100, 320 180, 380 150 C 440 120, 520 155, 590 140 C 660 125, 680 50, 770 55 L 770 200 L 50 200 Z"
                      fill="url(#dashSplineGrad)"
                    />
                    <path
                      d="M 50 160 C 130 155, 170 100, 240 100 C 310 100, 320 180, 380 150 C 440 120, 520 155, 590 140 C 660 125, 680 50, 770 55"
                      fill="none"
                      stroke="#00f5a0"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="capital-chart-legend">
                  <div className="capital-legend-item">
                    <span
                      className="capital-legend-marker"
                      style={{ background: "#00f5a0" }}
                    />
                    <span>Actual Velocity</span>
                  </div>
                  <div className="capital-legend-item">
                    <span
                      className="capital-legend-marker"
                      style={{
                        background: "#00d2ff",
                        borderTop: "2px dashed #00d2ff",
                      }}
                    />
                    <span>Target Benchmark</span>
                  </div>
                </div>

                {/* 4 Bottom metric columns */}
                <div className="capital-metric-strip">
                  <div className="capital-strip-col">
                    <span className="capital-strip-label">Southern Express</span>
                    <strong className="capital-strip-val">LKR 1.20M</strong>
                    <span className="capital-strip-delta" style={{ color: "#00f5a0" }}>
                      +11.2%
                    </span>
                  </div>
                  <div className="capital-strip-col">
                    <span className="capital-strip-label">Central Highlands</span>
                    <strong className="capital-strip-val">LKR 840K</strong>
                    <span className="capital-strip-delta" style={{ color: "#00f5a0" }}>
                      +6.0%
                    </span>
                  </div>
                  <div className="capital-strip-col">
                    <span className="capital-strip-label">Northern Corridors</span>
                    <strong className="capital-strip-val">LKR 380K</strong>
                    <span className="capital-strip-delta" style={{ color: "#00f5a0" }}>
                      +35.8%
                    </span>
                  </div>
                  <div className="capital-strip-col">
                    <span className="capital-strip-label">Eastern Coastal</span>
                    <strong className="capital-strip-val">LKR 427K</strong>
                    <span className="capital-strip-delta" style={{ color: "#00d2ff" }}>
                      +1.1%
                    </span>
                  </div>
                </div>
              </div>

              {/* Right (35%): Trip Status Distribution Donut */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 600,
                      margin: 0,
                      color: "#f8fafc",
                    }}
                  >
                    Journey Status Distribution
                  </h3>
                  <div
                    className="capital-filter-pill"
                    style={{ padding: "3px 10px" }}
                  >
                    <span
                      style={{
                        color: "#00f5a0",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      Active
                    </span>
                  </div>
                </div>

                <div className="capital-donut-layout">
                  <div className="capital-donut-svg-box">
                    <svg viewBox="0 0 160 160" width="130" height="130">
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        fill="none"
                        stroke="#00d2ff"
                        strokeWidth="16"
                        strokeDasharray="180 159"
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        fill="none"
                        stroke="#00f5a0"
                        strokeWidth="16"
                        strokeDasharray="90 249"
                        strokeDashoffset="-180"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="16"
                        strokeDasharray="50 289"
                        strokeDashoffset="-270"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="54"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="16"
                        strokeDasharray="19 320"
                        strokeDashoffset="-320"
                      />
                    </svg>
                    <div className="capital-donut-center">
                      <span className="capital-donut-number">
                        {Object.values(data.tripStatus).reduce(
                          (a, b) => a + b,
                          0,
                        )}
                      </span>
                      <span className="capital-donut-sub">Total Trips</span>
                    </div>
                  </div>

                  <div className="capital-donut-legend">
                    {Object.entries(data.tripStatus).map(([status, count]) => {
                      const colors: Record<string, string> = {
                        PUBLISHED: "#00d2ff",
                        BOARDING: "#00f5a0",
                        IN_TRANSIT: "#a855f7",
                        COMPLETED: "#f59e0b",
                        CANCELLED: "#ef4444",
                      };
                      return (
                        <div key={status} className="capital-donut-leg-row">
                          <span
                            className="capital-leg-dot"
                            style={{ background: colors[status] || "#64748b" }}
                          />
                          <span className="capital-donut-leg-name">
                            {status}
                          </span>
                          <span className="capital-donut-leg-val">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Upcoming Departures & Smart Operations Insights */}
            <div className="capital-bottom-grid">
              {/* Left (65%): Upcoming Departures Table */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <div>
                    <h3
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        margin: 0,
                        color: "#f8fafc",
                      }}
                    >
                      Upcoming Scheduled Departures
                    </h3>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "0.8rem",
                        color: "#64748b",
                      }}
                    >
                      Real-time timetable departures from Colombo, Kandy, Galle, and Jaffna
                    </p>
                  </div>
                  <Link
                    to="/dashboard/schedules"
                    className="capital-filter-pill"
                    style={{
                      border: "none",
                      background: "rgba(255,255,255,0.05)",
                      color: "#00f5a0",
                      textDecoration: "none",
                    }}
                  >
                    <span>View all ↗</span>
                  </Link>
                </div>

                <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                  <table className="capital-table">
                    <thead>
                      <tr>
                        <th>Corridor Journey</th>
                        <th>Departure</th>
                        <th>Assigned Coach</th>
                        <th>Crew Driver</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(trips?.items || [])
                        .filter((t) => t.status === "PUBLISHED" || t.status === "BOARDING" || t.status === "IN_TRANSIT")
                        .slice(0, 5)
                        .map((t) => (
                          <tr key={t.id}>
                            <td>
                              <strong style={{ color: "#00d2ff" }}>
                                {t.origin} → {t.destination}
                              </strong>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: "0.75rem",
                                  color: "#64748b",
                                }}
                              >
                                Trip #{t.id}
                              </p>
                            </td>
                            <td>{dateTime(t.departure)}</td>
                            <td>{t.bus?.registration || "CLX-201"}</td>
                            <td>{t.driver?.name || "Saman Kumara"}</td>
                            <td>
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background:
                                    t.status === "IN_TRANSIT"
                                      ? "rgba(0, 245, 160, 0.15)"
                                      : t.status === "BOARDING"
                                      ? "rgba(0, 210, 255, 0.15)"
                                      : "rgba(255, 255, 255, 0.05)",
                                  color:
                                    t.status === "IN_TRANSIT"
                                      ? "#00f5a0"
                                      : t.status === "BOARDING"
                                      ? "#00d2ff"
                                      : "#94a3b8",
                                }}
                              >
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right (35%): Smart Operations Insights */}
              <div className="capital-card">
                <div className="capital-card-header">
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 600,
                      margin: 0,
                      color: "#f8fafc",
                    }}
                  >
                    Smart Operations Insights
                  </h3>
                  <div className="capital-pill-ai">
                    <Sparkles size={11} />
                    <span>AI Dispatch</span>
                  </div>
                </div>

                <div className="capital-insight-list">
                  <div className="capital-insight-item">
                    <div
                      className="capital-insight-icon"
                      style={{
                        background: "rgba(0, 245, 160, 0.15)",
                        color: "#00f5a0",
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="capital-insight-content">
                      <span className="capital-insight-title">
                        Demand Spike: Southern E01
                      </span>
                      <p className="capital-insight-desc">
                        Galle & Matara bookings up 28% for upcoming weekend. Recommend adding 2 standby express coaches.
                      </p>
                      <Link
                        to="/dashboard/schedules"
                        className="capital-insight-btn"
                        style={{ textDecoration: "none" }}
                      >
                        Adjust Schedules ↗
                      </Link>
                    </div>
                  </div>

                  <div className="capital-insight-item">
                    <div
                      className="capital-insight-icon"
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "#f59e0b",
                      }}
                    >
                      <AlertTriangle size={16} />
                    </div>
                    <div className="capital-insight-content">
                      <span className="capital-insight-title">
                        Fleet Utilization Target
                      </span>
                      <p className="capital-insight-desc">
                        Active bus utilization is 91.2%, exceeding the 85% efficiency benchmark. Zero depot bottlenecks.
                      </p>
                      <Link
                        to="/dashboard/fleet"
                        className="capital-insight-btn"
                        style={{ textDecoration: "none" }}
                      >
                        Inspect Fleet Roster ↗
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
