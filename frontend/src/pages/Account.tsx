import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Check,
  Mail,
  UserRound,
  ShieldCheck,
  ArrowRight,
  BusFront,
  Ticket,
  Headphones,
  Radio,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Notification, Page } from "../types";
import {
  PageTitle,
  Badge,
  Field,
  Spinner,
  ErrorBox,
  Loading,
  Empty,
  Pagination,
  dateTime,
} from "../components/UI";
export default function Account({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  const { user, refresh, toast } = useApp();
  const [firstName, setFirst] = useState(user?.firstName || "");
  const [lastName, setLast] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setFirst(user.firstName || "");
      setLast(user.lastName || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
    }
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 10) {
        setError("Password must be at least 10 characters with letters and numbers.");
        return;
      }
    }

    setBusy(true);
    try {
      await api("/users/me", "PUT", {
        firstName,
        lastName,
        phone,
        email,
        password: password || undefined,
      });
      await refresh();
      setPassword("");
      setConfirmPassword("");
      toast("Your profile has been successfully updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={dashboard ? "" : "container page"}>
      <PageTitle
        eyebrow="YOUR CITYLINK"
        title={
          dashboard
            ? "Your workspace settings."
            : "My Profile."
        }
        description="Manage and update your personal details, contact information, and security credentials."
      />
      <div className="account-layout">
        <section className="panel account-card">
          <div className="large-avatar">
            {user?.firstName ? user.firstName[0] : "P"}
            {user?.lastName ? user.lastName[0] : ""}
          </div>
          <h2>
            {user?.firstName} {user?.lastName}
          </h2>
          <p>{user?.email}</p>
          <Badge status={user?.role || ""} />
          <div className="summary-row">
            <span>Account</span>
            <Badge status={user?.status || ""} />
          </div>
          <div className="summary-row">
            <span>Identity</span>
            <span className="inline">
              <ShieldCheck size={15} />
              {user?.verified ? "Verified" : "Unverified"}
            </span>
          </div>
          {!!user?.permissions.length && (
            <div className="feature-tags">
              {user.permissions.map((p) => (
                <span key={p}>{p.toLowerCase()}</span>
              ))}
            </div>
          )}
        </section>
        <form className="panel profile-form" onSubmit={save}>
          <h2>Your details.</h2>
          <p>Keep your passenger and contact information current.</p>
          <ErrorBox message={error} />
          <div className="form-grid">
            <Field label="First name">
              <input
                required
                maxLength={80}
                value={firstName}
                onChange={(e) => setFirst(e.target.value)}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Last name">
              <input
                required
                maxLength={80}
                value={lastName}
                onChange={(e) => setLast(e.target.value)}
                autoComplete="family-name"
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Email address">
              <input
                required
                type="email"
                maxLength={190}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Phone number">
              <input
                required
                type="tel"
                pattern="[+0-9 ()\-]{8,24}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </Field>
          </div>

          <div className="form-grid">
            <Field
              label="New password"
              hint="Leave blank to keep current password. Minimum 10 characters."
            >
              <input
                type="password"
                minLength={10}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••••••"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                minLength={10}
                maxLength={72}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••••••"
              />
            </Field>
          </div>

          <div className="form-actions">
            <Link className="text-link" to="/recover">
              Forgot password?
              <ArrowRight size={15} />
            </Link>
            <button className="btn" disabled={busy}>
              {busy ? <Spinner /> : <Check size={17} />}Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export function Notifications() {
  const [page, setPage] = useState(0);
  const [filterKey, setFilterKey] = useState("ALL");
  const { user, toast } = useApp();
  const { data, error, loading, reload } = useApi<Page<Notification>>(
    "/notifications?page=" + page + "&size=30",
    15000,
  );

  const getNotificationRole = (n: Notification): string => {
    if (n.role) return n.role.toUpperCase();
    const t = (n.type || "").toUpperCase();
    const text = ((n.title || "") + " " + (n.message || "")).toLowerCase();
    if (t === "SAFETY" || t === "VEHICLE" || t === "DUTY" || text.includes("driver") || text.includes("weather") || text.includes("inspection")) {
      return "DRIVER";
    }
    if (t === "BOARDING" || t === "MANIFEST" || t === "FINANCE" || text.includes("conductor") || text.includes("gate call") || text.includes("cash ticket")) {
      return "CONDUCTOR";
    }
    if (t === "SUPPORT" || t === "REFUND" || t === "FEEDBACK" || text.includes("support") || text.includes("ticket #sr") || text.includes("refund request")) {
      return "CUSTOMER_SERVICE";
    }
    if (t === "FLEET" || t === "INCIDENT" || t === "DISPATCH" || text.includes("dispatch") || text.includes("readiness") || text.includes("congestion")) {
      return "OPERATOR";
    }
    if (t === "AUDIT" || t === "COMPLIANCE" || t === "USER" || text.includes("audit") || text.includes("revenue settlement") || text.includes("compliance")) {
      return "ADMIN";
    }
    return "PASSENGER";
  };

  const getRoleMeta = (role: string) => {
    switch (role) {
      case "DRIVER":
        return { label: "Driver", color: "#00f5a0", bg: "rgba(0, 245, 160, 0.12)", icon: <BusFront size={18} /> };
      case "CONDUCTOR":
        return { label: "Conductor", color: "#00d2ff", bg: "rgba(0, 210, 255, 0.12)", icon: <Ticket size={18} /> };
      case "CUSTOMER_SERVICE":
        return { label: "Support", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", icon: <Headphones size={18} /> };
      case "OPERATOR":
        return { label: "Operator", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", icon: <Radio size={18} /> };
      case "ADMIN":
        return { label: "Admin", color: "#f87171", bg: "rgba(248, 113, 113, 0.12)", icon: <ShieldCheck size={18} /> };
      default:
        return { label: "Passenger", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.12)", icon: <UserRound size={18} /> };
    }
  };

  const getTypeMeta = (type?: string, role?: string) => {
    const t = (type || "").toUpperCase();
    switch (t) {
      case "SAFETY":
        return { label: "Safety", color: "#f87171", bg: "rgba(248, 113, 113, 0.12)", icon: <AlertTriangle size={18} /> };
      case "VEHICLE":
      case "FLEET":
        return { label: t === "FLEET" ? "Fleet" : "Vehicle", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", icon: <BusFront size={18} /> };
      case "DUTY":
        return { label: "Duty", color: "#00f5a0", bg: "rgba(0, 245, 160, 0.12)", icon: <CheckCircle2 size={18} /> };
      case "ASSIGNMENT_CONFIRMED":
        return { label: "Assignment", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", icon: <CheckCircle2 size={18} /> };
      case "DISPATCH":
        return { label: "Dispatch", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", icon: <Radio size={18} /> };
      case "INCIDENT":
        return { label: "Incident", color: "#fb923c", bg: "rgba(251, 146, 60, 0.12)", icon: <AlertTriangle size={18} /> };
      case "BOARDING":
      case "MANIFEST":
        return { label: t === "BOARDING" ? "Boarding" : "Manifest", color: "#00d2ff", bg: "rgba(0, 210, 255, 0.12)", icon: <Ticket size={18} /> };
      case "FINANCE":
        return { label: "Finance", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)", icon: <DollarSign size={18} /> };
      case "TRACKING":
        return { label: "Tracking", color: "#00e5ff", bg: "rgba(0, 229, 255, 0.12)", border: "rgba(0, 229, 255, 0.3)", icon: <MapPin size={18} /> };
      case "DELAY":
        return { label: "Delay", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", icon: <Clock size={18} /> };
      case "BOOKING":
        return { label: "Booking", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.12)", icon: <Calendar size={18} /> };
      case "SUPPORT":
        return { label: "Support", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", icon: <Headphones size={18} /> };
      case "REFUND":
        return { label: "Refund", color: "#f87171", bg: "rgba(248, 113, 113, 0.12)", icon: <DollarSign size={18} /> };
      case "FEEDBACK":
        return { label: "Feedback", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", icon: <Headphones size={18} /> };
      case "AUDIT":
      case "COMPLIANCE":
        return { label: t === "AUDIT" ? "Audit" : "Compliance", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", icon: <ShieldCheck size={18} /> };
      default:
        return getRoleMeta(role || "PASSENGER");
    }
  };

  async function mark(n: Notification) {
    try {
      await api("/notifications/" + n.id, "PUT", { read: !n.read });
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function markAllRead() {
    try {
      await api("/notifications/read-all", "PUT", {});
      reload();
      toast("All notifications marked as read.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const items = data?.items || [];

  // Strictly filter items relevant to this user
  const userRelevantItems = useMemo(() => {
    if (!user) return [];
    const userRole = (user.role || "").toUpperCase();
    return items.filter((n) => {
      // Direct recipient user ID match
      if (n.recipientId && n.recipientId === user.id) return true;
      // Target role match
      const notifRole = (n.role || getNotificationRole(n)).toUpperCase();
      return notifRole === userRole;
    });
  }, [items, user]);

  const tabs = useMemo(() => {
    if (!user) return [];
    if (user.role === "ADMIN") {
      // Admin gets role audit tabs
      return [
        { key: "ALL", label: "All Roles" },
        { key: "ADMIN", label: "Admin", color: "#f87171" },
        { key: "OPERATOR", label: "Operator", color: "#38bdf8" },
        { key: "DRIVER", label: "Driver", color: "#00f5a0" },
        { key: "CONDUCTOR", label: "Conductor", color: "#00d2ff" },
        { key: "PASSENGER", label: "Passengers", color: "#a78bfa" },
        { key: "CUSTOMER_SERVICE", label: "Support", color: "#fbbf24" },
      ];
    }

    // Scoped category tabs for the authenticated role
    const tabList: { key: string; label: string; count?: number; color?: string }[] = [
      { key: "ALL", label: "All", count: userRelevantItems.length },
      { key: "UNREAD", label: "Unread", count: userRelevantItems.filter((n) => !n.read).length, color: "#00d2ff" },
    ];

    const typeCounts = new Map<string, number>();
    userRelevantItems.forEach((n) => {
      const t = (n.type || "").toUpperCase();
      if (t) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    });

    typeCounts.forEach((count, type) => {
      const meta = getTypeMeta(type);
      tabList.push({ key: type, label: meta.label, count, color: meta.color });
    });

    return tabList;
  }, [user, userRelevantItems, items]);

  const filteredItems = useMemo(() => {
    if (user?.role === "ADMIN") {
      if (filterKey === "ALL") return items;
      return items.filter((n) => getNotificationRole(n) === filterKey);
    }
    return userRelevantItems.filter((n) => {
      if (filterKey === "ALL") return true;
      if (filterKey === "UNREAD") return !n.read;
      return (n.type || "").toUpperCase() === filterKey;
    });
  }, [user, items, userRelevantItems, filterKey]);

  return (
    <div className="container page notifications-page">
      <PageTitle
        eyebrow="EVERY UPDATE, IN ONE PLACE"
        title="In the loop."
        description={`Operational alerts, duty assignments, and notifications tailored for your ${user?.role ? user.role.replace("_", " ").toLowerCase() : "account"} profile.`}
      />

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "1.5rem" }}>
        {tabs.map((tab) => {
          const isSel = filterKey === tab.key;
          const count = tab.count !== undefined
            ? tab.count
            : tab.key === "ALL"
            ? items.length
            : items.filter((n) => getNotificationRole(n) === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterKey(tab.key)}
              style={{
                background: isSel ? "rgba(0, 210, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                border: isSel ? "1px solid #00d2ff" : "1px solid rgba(255, 255, 255, 0.1)",
                color: isSel ? "#00d2ff" : "#cbd5e1",
                padding: "6px 14px",
                borderRadius: "999px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span style={{ fontSize: "0.72rem", opacity: 0.8, background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: "10px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={markAllRead}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid #334155",
            color: "#94a3b8",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Mark all as read
        </button>
      </div>

      <ErrorBox message={error} retry={reload} />
      {loading && !data ? (
        <Loading />
      ) : !filteredItems.length ? (
        <Empty
          title="YOU’RE ALL CAUGHT UP"
          message={`No ${filterKey !== "ALL" ? filterKey.replace("_", " ").toLowerCase() : ""} notifications found.`}
          action=""
        />
      ) : (
        <div className="notifications-list">
          {filteredItems.map((n) => {
            const notifRole = getNotificationRole(n);
            const meta = getTypeMeta(n.type, notifRole);
            return (
              <article
                className={"notification-row " + (n.read ? "read" : "unread")}
                key={n.id}
              >
                <span
                  className="notification-icon"
                  style={{ color: meta.color, background: meta.bg }}
                >
                  {meta.icon}
                </span>
                <div>
                  <div className="inline" style={{ gap: "8px", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        color: meta.color,
                        background: meta.bg,
                        padding: "2px 7px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      {meta.label}
                    </span>
                    <h3 style={{ margin: 0 }}>{n.title}</h3>
                    {!n.read && <span className="new-tag">NEW</span>}
                  </div>
                  <p style={{ marginTop: "4px" }}>{n.message}</p>
                  <small>
                    {dateTime(n.createdAt)} · {n.type.replaceAll("_", " ")}
                  </small>
                </div>
                <button className="text-button" onClick={() => mark(n)}>
                  {n.read ? "Mark unread" : "Mark read"}
                </button>
              </article>
            );
          })}
        </div>
      )}
      {data && (
        <Pagination
          page={page}
          size={30}
          total={data.total}
          onChange={setPage}
        />
      )}
    </div>
  );
}
