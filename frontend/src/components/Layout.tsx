import { useState, useEffect, useRef, useMemo } from "react";
import { NavLink, Link, Outlet, useLocation, Navigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  CalendarDays,
  Calendar,
  BusFront,
  Users,
  Ticket,
  MapPin,
  Headphones,
  BarChart3,
  Settings,
  ShieldCheck,
  Route,
  AlertTriangle,
  ChevronDown,
  UserRound,
  Globe,
  CheckCheck,
  CheckCircle2,
  DollarSign,
  Radio,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { Brand, Badge, Loading } from "./UI";
import type { Notification, Page } from "../types";
export function Protected({
  permission,
  staff = false,
}: {
  permission?: string;
  staff?: boolean;
}) {
  const { user, ready, can } = useApp();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user)
    return (
      <Navigate
        to={
          "/login?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  if ((permission && !can(permission)) || (staff && user.role === "PASSENGER"))
    return <Navigate to="/my-bookings" replace />;
  return <Outlet />;
}
const getNotificationRole = (n: Notification): string => {
  if (n.role) return n.role.toUpperCase();
  const t = (n.type || "").toUpperCase();
  const text = ((n.title || "") + " " + (n.message || "")).toLowerCase();
  if (
    t === "SAFETY" ||
    t === "VEHICLE" ||
    t === "DUTY" ||
    text.includes("driver") ||
    text.includes("weather") ||
    text.includes("inspection")
  ) {
    return "DRIVER";
  }
  if (
    t === "BOARDING" ||
    t === "MANIFEST" ||
    t === "FINANCE" ||
    text.includes("conductor") ||
    text.includes("gate call") ||
    text.includes("cash ticket")
  ) {
    return "CONDUCTOR";
  }
  if (
    t === "SUPPORT" ||
    t === "REFUND" ||
    t === "FEEDBACK" ||
    text.includes("support") ||
    text.includes("ticket #sr") ||
    text.includes("refund request")
  ) {
    return "CUSTOMER_SERVICE";
  }
  if (
    t === "FLEET" ||
    t === "INCIDENT" ||
    t === "DISPATCH" ||
    text.includes("dispatch") ||
    text.includes("readiness") ||
    text.includes("congestion")
  ) {
    return "OPERATOR";
  }
  if (
    t === "AUDIT" ||
    t === "COMPLIANCE" ||
    t === "USER" ||
    text.includes("audit") ||
    text.includes("revenue settlement") ||
    text.includes("compliance")
  ) {
    return "ADMIN";
  }
  return "PASSENGER";
};

const getRoleMeta = (role: string) => {
  switch (role) {
    case "DRIVER":
      return {
        label: "Driver",
        color: "#00f5a0",
        bg: "rgba(0, 245, 160, 0.12)",
        border: "rgba(0, 245, 160, 0.3)",
        icon: <BusFront size={11} />,
      };
    case "CONDUCTOR":
      return {
        label: "Conductor",
        color: "#00d2ff",
        bg: "rgba(0, 210, 255, 0.12)",
        border: "rgba(0, 210, 255, 0.3)",
        icon: <Ticket size={11} />,
      };
    case "CUSTOMER_SERVICE":
      return {
        label: "Support",
        color: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.12)",
        border: "rgba(251, 191, 36, 0.3)",
        icon: <Headphones size={11} />,
      };
    case "OPERATOR":
      return {
        label: "Operator",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.3)",
        icon: <Radio size={11} />,
      };
    case "ADMIN":
      return {
        label: "Admin",
        color: "#f87171",
        bg: "rgba(248, 113, 113, 0.12)",
        border: "rgba(248, 113, 113, 0.3)",
        icon: <ShieldCheck size={11} />,
      };
    default:
      return {
        label: "Passenger",
        color: "#a78bfa",
        bg: "rgba(167, 139, 250, 0.12)",
        border: "rgba(167, 139, 250, 0.3)",
        icon: <UserRound size={11} />,
      };
  }
};

const getTypeMeta = (type?: string, role?: string) => {
  const t = (type || "").toUpperCase();
  switch (t) {
    case "SAFETY":
      return { label: "Safety", color: "#f87171", bg: "rgba(248, 113, 113, 0.12)", border: "rgba(248, 113, 113, 0.3)", icon: <AlertTriangle size={11} /> };
    case "VEHICLE":
    case "FLEET":
      return { label: t === "FLEET" ? "Fleet" : "Vehicle", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)", icon: <BusFront size={11} /> };
    case "DUTY":
      return { label: "Duty", color: "#00f5a0", bg: "rgba(0, 245, 160, 0.12)", border: "rgba(0, 245, 160, 0.3)", icon: <CheckCircle2 size={11} /> };
    case "ASSIGNMENT_CONFIRMED":
      return { label: "Assignment", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)", icon: <CheckCircle2 size={11} /> };
    case "DISPATCH":
      return { label: "Dispatch", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)", icon: <Radio size={11} /> };
    case "INCIDENT":
      return { label: "Incident", color: "#fb923c", bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.3)", icon: <AlertTriangle size={11} /> };
    case "BOARDING":
      return { label: "Boarding", color: "#00d2ff", bg: "rgba(0, 210, 255, 0.12)", border: "rgba(0, 210, 255, 0.3)", icon: <Ticket size={11} /> };
    case "MANIFEST":
      return { label: "Manifest", color: "#00d2ff", bg: "rgba(0, 210, 255, 0.12)", border: "rgba(0, 210, 255, 0.3)", icon: <Ticket size={11} /> };
    case "FINANCE":
      return { label: "Finance", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.3)", icon: <DollarSign size={11} /> };
    case "TRACKING":
      return { label: "Tracking", color: "#00e5ff", bg: "rgba(0, 229, 255, 0.12)", border: "rgba(0, 229, 255, 0.3)", icon: <MapPin size={11} /> };
    case "DELAY":
      return { label: "Delay", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)", icon: <Clock size={11} /> };
    case "BOOKING":
      return { label: "Booking", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.12)", border: "rgba(167, 139, 250, 0.3)", icon: <Calendar size={11} /> };
    case "SUPPORT":
      return { label: "Support", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.3)", icon: <Headphones size={11} /> };
    case "REFUND":
      return { label: "Refund", color: "#f87171", bg: "rgba(248, 113, 113, 0.12)", border: "rgba(248, 113, 113, 0.3)", icon: <DollarSign size={11} /> };
    case "FEEDBACK":
      return { label: "Feedback", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", border: "rgba(244, 63, 94, 0.3)", icon: <Headphones size={11} /> };
    case "AUDIT":
    case "COMPLIANCE":
      return { label: t === "AUDIT" ? "Audit" : "Compliance", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", border: "rgba(244, 63, 94, 0.3)", icon: <ShieldCheck size={11} /> };
    case "USER":
      return { label: "Staff", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.3)", icon: <Users size={11} /> };
    default:
      return getRoleMeta(role || "PASSENGER");
  }
};

export function Layout() {
  const { user, logout } = useApp();
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [popoverFilter, setPopoverFilter] = useState<string>("ALL");
  const [profileDropdown, setProfileDropdown] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { data, reload: reloadNotifications } = useApi<Page<Notification>>(
    user ? "/notifications?size=100" : null,
    10000,
  );
  const allNotifications = data?.items || [];

  // Strictly filter notifications that are relevant to this user & role
  const userRelevantNotifications = useMemo(() => {
    if (!user) return [];
    const userRole = (user.role || "").toUpperCase();
    return allNotifications.filter((n) => {
      // 1. Direct recipient user ID match
      if (n.recipientId && n.recipientId === user.id) return true;
      // 2. Target role match
      const notifRole = (n.role || getNotificationRole(n)).toUpperCase();
      return notifRole === userRole;
    });
  }, [allNotifications, user]);

  const unread = userRelevantNotifications.filter((n) => !n.read);
  useEffect(() => {
    setMobile(false);
    setDropdown(false);
    setProfileDropdown(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const run = () => {
      const threshold = location.pathname === "/" ? 50 : 15;
      setScrolled(window.scrollY > threshold);
    };
    run();
    window.addEventListener("scroll", run, { passive: true });
    return () => window.removeEventListener("scroll", run);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileDropdown(false);
      }
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(e.target as Node)
      ) {
        setDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const portalUrl = user
    ? user.role === "DRIVER"
      ? "/driver"
      : user.role === "CONDUCTOR"
        ? "/conductor"
        : user.role === "OPERATOR"
          ? "/operator"
          : user.role === "ADMIN"
            ? "/admin"
            : user.role === "CUSTOMER_SERVICE"
              ? "/customerservice"
              : "/my-bookings"
    : "/login";
  const isPortalRoute = Boolean(
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/operator") ||
    location.pathname.startsWith("/driver") ||
    location.pathname.startsWith("/conductor") ||
    location.pathname.startsWith("/customer-service") ||
    location.pathname.startsWith("/customerservice")
  );

  const getInitials = (firstName?: string, lastName?: string) => {
    const f = firstName?.trim() || "";
    const l = lastName?.trim() || "";
    if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
    if (f.length >= 2) return f.slice(0, 2).toUpperCase();
    if (f) return f[0].toUpperCase();
    return "U";
  };

  const portalLabel = user
    ? user.role === "DRIVER"
      ? "Driver Portal"
      : user.role === "CONDUCTOR"
        ? "Conductor Portal"
        : user.role === "ADMIN"
          ? "Admin Portal"
          : user.role === "CUSTOMER_SERVICE"
            ? "Customer Service"
            : user.role === "OPERATOR"
              ? "Operator Hub"
              : ""
    : "";

  const roleDisplay = user
    ? user.role === "CUSTOMER_SERVICE"
      ? "CUSTOMER SERVICE"
      : user.role.replace("_", " ")
    : "";


  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);
      if (diffMin < 1) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDay < 7) return `${diffDay}d ago`;
      return new Date(dateStr).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api("/notifications/read-all", "PUT", {});
      reloadNotifications();
    } catch {
      // fallback
    }
  };

  const handleToggleRead = async (e: React.MouseEvent, n: Notification) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api(`/notifications/${n.id}`, "PUT", { read: !n.read });
      reloadNotifications();
    } catch {
      // fallback
    }
  };

  const userNotifTabs = useMemo(() => {
    if (!user) return [];
    const tabs: { key: string; label: string; count: number; color?: string }[] = [
      { key: "ALL", label: "All", count: userRelevantNotifications.length },
    ];
    if (unread.length > 0) {
      tabs.push({ key: "UNREAD", label: "Unread", count: unread.length, color: "#00d2ff" });
    }

    const typeCounts = new Map<string, number>();
    userRelevantNotifications.forEach((n) => {
      const t = (n.type || "").toUpperCase();
      if (t) {
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      }
    });

    typeCounts.forEach((count, type) => {
      const meta = getTypeMeta(type);
      tabs.push({
        key: type,
        label: meta.label,
        count,
        color: meta.color,
      });
    });

    return tabs;
  }, [user, userRelevantNotifications, unread]);

  const filteredNotifications = useMemo(() => {
    return userRelevantNotifications.filter((n) => {
      if (popoverFilter === "ALL") return true;
      if (popoverFilter === "UNREAD") return !n.read;
      return (n.type || "").toUpperCase() === popoverFilter;
    });
  }, [userRelevantNotifications, popoverFilter]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={"navbar " + (scrolled ? "scrolled" : "")}>
        <div className="nav-inner">
          <Brand />
          <nav className={mobile ? "open" : ""} aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/routes">Routes</NavLink>
            <NavLink to="/track">Track</NavLink>
            <NavLink to="/search">Book</NavLink>
            <Link to="/#about">About</Link>
            {user && user.role !== "PASSENGER" && Boolean(portalLabel) && (
              <NavLink to={portalUrl}>
                {portalLabel}
              </NavLink>
            )}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <div className="notification-menu" ref={notificationMenuRef}>
                  <button
                    className="header-bell-btn"
                    aria-label={`Notifications, ${unread.length} unread`}
                    aria-expanded={dropdown}
                    onClick={() => setDropdown(!dropdown)}
                  >
                    <Bell size={18} />
                    {unread.length > 0 && <span className="header-unread-dot" />}
                  </button>
                  {dropdown && (
                    <div className="notification-popover">
                      <div className="notif-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "0.95rem" }}>Notifications</strong>
                          {unread.length > 0 ? (
                            <span className="notif-unread-count">
                              {unread.length} new
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              All read
                            </span>
                          )}
                        </div>
                        {unread.length > 0 && (
                          <button
                            type="button"
                            className="notif-mark-all-btn"
                            onClick={handleMarkAllRead}
                            title="Mark all notifications as read"
                          >
                            <CheckCheck size={14} />
                            <span>Mark all read</span>
                          </button>
                        )}
                      </div>

                      {/* Scoped Filter Tabs */}
                      <div className="notif-role-tabs">
                        {userNotifTabs.map((tab) => {
                          const isSel = popoverFilter === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              className={`notif-role-chip ${isSel ? "active" : ""}`}
                              onClick={() => setPopoverFilter(tab.key)}
                              style={
                                isSel && tab.color
                                  ? {
                                      borderColor: tab.color,
                                      color: tab.color,
                                      background: `${tab.color}1c`,
                                    }
                                  : {}
                              }
                            >
                              <span>{tab.label}</span>
                              {tab.count > 0 && <small>{tab.count}</small>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Notifications List */}
                      <div className="notif-scroll-list">
                        {filteredNotifications.length > 0 ? (
                          filteredNotifications.slice(0, 10).map((n) => {
                            const notifRole = getNotificationRole(n);
                            const meta = getTypeMeta(n.type, notifRole);
                            return (
                              <div
                                key={n.id}
                                className={`notif-card-item ${n.read ? "read" : "unread"}`}
                                onClick={(e) => handleToggleRead(e, n)}
                                title={n.read ? "Click to mark as unread" : "Click to mark as read"}
                              >
                                <div className="notif-card-header">
                                  <span
                                    className="notif-role-badge"
                                    style={{
                                      background: meta.bg,
                                      color: meta.color,
                                      borderColor: meta.border,
                                    }}
                                  >
                                    {meta.icon}
                                    <span>{meta.label}</span>
                                  </span>
                                  <span className="notif-timestamp">
                                    {formatRelativeTime(n.createdAt)}
                                  </span>
                                </div>
                                <b className="notif-card-title">{n.title}</b>
                                <p className="notif-card-message">{n.message}</p>
                              </div>
                            );
                          })
                        ) : (
                          <div className="notif-empty-state">
                            <Bell size={24} style={{ opacity: 0.35, margin: "0 auto 6px auto" }} />
                            <p style={{ margin: 0 }}>
                              {popoverFilter === "UNREAD" ? "No unread notifications." : "No notifications for your account."}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="notif-popover-footer">
                        <Link
                          to="/notifications"
                          onClick={() => setDropdown(false)}
                          className="notif-view-all-link"
                        >
                          <span>View notification center</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                <div className="profile-menu-container" ref={profileMenuRef}>
                  <button
                    type="button"
                    className="header-profile-btn"
                    onClick={() => setProfileDropdown(!profileDropdown)}
                    aria-expanded={profileDropdown}
                    aria-haspopup="true"
                    aria-label="User account menu"
                  >
                    <div className="header-avatar-circle">
                      <span>{getInitials(user.firstName, user.lastName)}</span>
                    </div>
                    <div className="header-profile-meta">
                      <div className="header-profile-name-row">
                        <span className="header-profile-name">{user.firstName || "Account"}</span>
                        <ChevronDown
                          size={13}
                          className={`header-profile-chevron ${profileDropdown ? "open" : ""}`}
                        />
                      </div>
                      <span className="header-profile-role">{roleDisplay}</span>
                    </div>
                  </button>
                  {profileDropdown && (
                    <div className="profile-dropdown-popover">
                      <div className="profile-dropdown-header">
                        <strong>
                          {user.firstName} {user.lastName}
                        </strong>
                        <small>{user.email}</small>
                      </div>
                      <div className="profile-dropdown-divider" />
                      <Link
                        to="/profile"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdown(false)}
                      >
                        <UserRound size={16} />
                        <span>My Profile</span>
                      </Link>
                      <Link
                        to="/my-bookings"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdown(false)}
                      >
                        <Ticket size={16} />
                        <span>My Bookings</span>
                      </Link>
                      {user.role !== "PASSENGER" && (
                        <Link
                          to={portalUrl}
                          className="profile-dropdown-item"
                          onClick={() => setProfileDropdown(false)}
                        >
                          <LayoutDashboard size={16} />
                          <span>Staff Console</span>
                        </Link>
                      )}
                      <div className="profile-dropdown-divider" />
                      <button
                        type="button"
                        className="profile-dropdown-item logout-item"
                        onClick={() => {
                          setProfileDropdown(false);
                          logout();
                        }}
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="nav-auth-group">
                <Link className="nav-sign-in-btn" to="/login">
                  Sign in
                </Link>
                <Link className="nav-cta-btn" to="/search">
                  <span>Book a journey</span>
                  <ArrowUpRight size={15} className="nav-cta-arrow" />
                </Link>
              </div>
            )}
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
            >
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      {!isPortalRoute && (
        <footer>
          <div className="footer-top">
            <div>
              <Brand />
              <p>
                A smarter connection.
                <br />A better journey.
              </p>
            </div>
            <div>
              <span>EXPLORE</span>
              <Link to="/routes">Our routes</Link>
              <Link to="/search">Book a journey</Link>
              <Link to="/track">Track your bus</Link>
            </div>
            <div>
              <span>YOUR CITYLINK</span>
              <Link to="/my-bookings">My Bookings</Link>
              <Link to="/profile">My Profile</Link>
              <Link to="/support">Help & support</Link>
            </div>
            <div>
              <span>STAFF & CREW PORTALS</span>
              <Link to="/driver">Driver Portal</Link>
              <Link to="/conductor">Conductor Portal</Link>
              <Link to="/operator">Operator Command</Link>
              <Link to="/admin">Administrator Console</Link>
              <Link to="/customerservice">Customer Service</Link>
            </div>
            <div>
              <span>BUILT FOR SRI LANKA</span>
              <p>
                CityLink Express
                <br />
                Metro Travel Lanka (Pvt) Ltd.
              </p>
              <span className="live-label">
                <i />
                Connected journeys
              </span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} CityLink Express</span>
            <span>Move thoughtfully. Travel brilliantly.</span>
            <span>Development edition</span>
          </div>
        </footer>
      )}
    </>
  );
}
const links = [
  ["", "Overview", LayoutDashboard, "REPORTS"],
  ["schedules", "Schedules", CalendarDays, "SCHEDULES"],
  ["routes", "Routes & stops", Route, "SCHEDULES"],
  ["fleet", "Fleet", BusFront, "FLEET"],
  ["staff", "Staff", Users, "FLEET"],
  ["bookings", "Bookings", Ticket, "BOOKINGS"],
  ["tracking", "Tracking", MapPin, "TRACKING"],
  ["incidents", "Vehicle incidents", AlertTriangle, "STAFF"],
  ["customer-service", "Customer service", Headphones, "SUPPORT"],
  ["reports", "Reports", BarChart3, "REPORTS"],
  ["users", "User accounts", ShieldCheck, "USERS"],
  ["settings", "Settings", Settings, "STAFF"],
] as const;
export function DashboardLayout() {
  const { user, can } = useApp();
  const crew = user?.role === "DRIVER" || user?.role === "CONDUCTOR";
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <p className="eyebrow">OPERATIONS</p>
        <div className="workspace-badge">
          <span className="live-dot" />
          <div>
            CityLink command<small>Sri Lanka · Colombo</small>
          </div>
        </div>
        <nav aria-label="Dashboard">
          {crew && (
            <NavLink to={user?.role === "CONDUCTOR" ? "/conductor" : "/driver"}>
              <CalendarDays size={18} />
              My duties
            </NavLink>
          )}
          {links
            .filter((l) => l[3] === "STAFF" || can(l[3]))
            .map(([path, label, Icon]) => (
              <NavLink
                key={path}
                end={!path}
                to={"/dashboard" + (path ? "/" + path : "")}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
        </nav>
        <div style={{ padding: "0 10px 10px" }}>
          <Link to="/" className="capital-goto-site" style={{ margin: 0 }}>
            <Globe size={16} />
            <span>Go to Site</span>
            <ArrowUpRight size={14} style={{ marginLeft: "auto", opacity: 0.7 }} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Badge status={user?.role || ""} />
          <Link to="/profile">Manage your account →</Link>
        </div>
      </aside>
      <div className="dashboard-content">
        <Outlet />
      </div>
    </div>
  );
}
export function DashboardIndex() {
  const { user } = useApp();
  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;
  if (user?.role === "OPERATOR") return <Navigate to="/operator" replace />;
  if (user?.role === "DRIVER") return <Navigate to="/driver" replace />;
  if (user?.role === "CONDUCTOR") return <Navigate to="/conductor" replace />;
  if (user?.role === "CUSTOMER_SERVICE") return <Navigate to="/customerservice" replace />;
  return <Navigate to="/my-bookings" replace />;
}
