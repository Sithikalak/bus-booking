import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import { ErrorBox, Field, Spinner } from "./UI";
import type { User } from "../types";

export type RoleConfig = {
  role: "DRIVER" | "CONDUCTOR" | "OPERATOR" | "ADMIN" | "CUSTOMER_SERVICE" | string;
  title: string;
  roleName: string;
  eyebrow: string;
  description: string;
  demoEmail: string;
  demoName: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  portalPath: string;
};

export type RoleLoginCardProps = {
  config?: RoleConfig;
  role?: string;
  roleTitle?: string;
  description?: string;
  demoEmail?: string;
  demoName?: string;
  badgeColor?: string;
  accentColor?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

export function RoleLoginCard(props: RoleLoginCardProps) {
  const { user, accept, logout, toast } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const {
    config: passedConfig,
    role,
    roleTitle,
    description,
    demoEmail,
    demoName,
    badgeColor,
    accentColor,
    icon,
  } = props;

  const roleStr = passedConfig?.role || role || "STAFF";
  const title = passedConfig?.title || roleTitle || `${roleStr} Operations Portal`;
  const roleName = passedConfig?.roleName || roleTitle || roleStr;
  const eyebrow = passedConfig?.eyebrow || `${roleStr.replace("_", " ")} ACCESS`;
  const desc = passedConfig?.description || description || "Enterprise Operations Access";
  const dEmail = passedConfig?.demoEmail || demoEmail || `${roleStr.toLowerCase()}@citylink.com`;
  const dName = passedConfig?.demoName || demoName || `${roleStr.replace("_", " ")} Demo Account`;
  const color = passedConfig?.accentColor || accentColor || badgeColor || "#00d2ff";
  const Icon = passedConfig?.icon || icon || Shield;

  const handleSignIn = async (targetEmail: string, targetPass: string) => {
    setBusy(true);
    setError("");
    try {
      const s = await api<{ token: string; user: User }>(
        "/auth/login",
        "POST",
        { email: targetEmail, password: targetPass }
      );
      accept(s);
      toast(`Signed in as ${s.user.firstName} (${s.user.role.replace("_", " ")}).`);
      navigate("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSignIn(email, password);
  };

  const quickDemoLogin = () => {
    handleSignIn(dEmail, "CityLink2026!");
  };

  const words = title.split(" ");
  const half = Math.ceil(words.length / 2);
  const titleLine1 = words.slice(0, half).join(" ");
  const titleLine2 = words.slice(half).join(" ");

  return (
    <div className="auth-page">
      {/* ── Left: story / branding ── */}
      <div className="auth-story">
        <Link to="/" className="back-link role-back-link">
          <ArrowLeft size={15} />
          Back to home
        </Link>

        <p className="eyebrow" style={{ color, marginTop: "1.5rem" }}>
          {eyebrow}
        </p>

        <h1>
          {titleLine1}
          <br />
          <span style={{ color }}>{titleLine2}</span>
        </h1>

        <div className="auth-route" style={{ marginTop: "2.5rem" }}>
          <i style={{ borderColor: color }} />
          <span>Secure staff access</span>
          <div style={{ background: color + "40" }} />
          <i style={{ borderColor: color }} />
          <span>Enterprise portal</span>
        </div>

        <p style={{ marginTop: "2rem" }}>
          {desc}
        </p>

        <div className="role-story-demo" style={{ borderColor: color + "40" }}>
          <UserCheck size={16} style={{ color, flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>Quick Demo: {dName}</strong>
            <small>{dEmail} &middot; CityLink2026!</small>
          </div>
          <button
            type="button"
            className="btn small"
            style={{ backgroundColor: color, color: "#05070a", flexShrink: 0 }}
            onClick={quickDemoLogin}
            disabled={busy}
          >
            {busy ? <Spinner /> : <CheckCircle2 size={14} />}
            1-Click
          </button>
        </div>
      </div>

      {/* ── Right: login panel ── */}
      <section className="auth-panel">
        {user && user.role !== roleStr && (
          <div className="role-switch-notice">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <span>
                Signed in as <b>{user.firstName} {user.lastName}</b> ({user.role.replace("_", " ")})
              </span>
              <p>
                Sign in below for {roleName} access, or{" "}
                <button type="button" className="text-button" style={{ padding: 0, display: "inline", fontSize: "inherit" }} onClick={logout}>
                  sign out first
                </button>.
              </p>
            </div>
          </div>
        )}

        <span className="auth-icon" style={{ borderColor: color + "55", color }}>
          <Lock size={20} />
        </span>

        <p className="eyebrow">CITYLINK STAFF PORTAL</p>
        <h2>{roleName} Sign In</h2>
        <p>Access your {roleName.toLowerCase()} dashboard.</p>

        <form onSubmit={submitForm} style={{ marginTop: "28px" }}>
          <ErrorBox message={error} />

          <Field label="Email Address">
            <input
              type="email"
              autoComplete="email"
              required
              placeholder={dEmail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password">
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <Link to="/recover" className="text-button forgot">
            Forgot password?
          </Link>

          <button className="btn full" disabled={busy} type="submit">
            {busy ? <Spinner /> : null}
            Sign into {roleName}
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="auth-switch">
          Not staff? <Link to="/login">Passenger sign in</Link>
        </p>

        <details className="demo-accounts">
          <summary>Explore the development accounts</summary>
          <p>All demo passwords: <code>CityLink2026!</code></p>
          <div>
            {["admin", "operator", "driver", "conductor", "support"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setEmail(r + "@citylink.com");
                  setPassword("CityLink2026!");
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <small>Development records only. Do not enter real credentials.</small>
        </details>
      </section>
    </div>
  );
}

export default RoleLoginCard;
