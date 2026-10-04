import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import { ErrorBox, Field, Spinner } from "../components/UI";
import type { User } from "../types";
type Challenge = {
  challengeId: string;
  devCode: string | null;
  expiresAt?: string;
};
export default function Auth({
  mode,
}: {
  mode: "login" | "register" | "recover";
}) {
  const { accept, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("PASSENGER");
  const next = () => {
    const path = params.get("next");
    return path?.startsWith("/") && !path.startsWith("//") ? path : null;
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        const s = await api<{ token: string; user: User }>(
          "/auth/login",
          "POST",
          { email, password },
        );
        accept(s);
        const defaultPortal =
          s.user.role === "ADMIN"
            ? "/admin"
            : s.user.role === "DRIVER"
              ? "/driver"
              : s.user.role === "CONDUCTOR"
                ? "/conductor"
                : s.user.role === "CUSTOMER_SERVICE"
                  ? "/customerservice"
                  : s.user.role === "OPERATOR"
                    ? "/operator"
                    : "/";
        navigate(next() || defaultPortal);
        toast("Welcome back, " + s.user.firstName + ".");
      } else if (mode === "register") {
        if (!challenge)
          setChallenge(
            await api<Challenge>("/auth/register", "POST", {
              firstName,
              lastName,
              email,
              phone,
              password,
              role,
            }),
          );
        else {
          const s = await api<{
            token: string | null;
            user: User;
            pendingApproval: boolean;
          }>("/auth/verify", "POST", {
            challengeId: challenge.challengeId,
            code,
          });
          if (s.pendingApproval) setPending(true);
          else {
            accept(s);
            navigate(next() || "/");
            toast("Your account is ready. Welcome aboard.");
          }
        }
      } else {
        if (!challenge)
          setChallenge(
            await api<Challenge>("/auth/recover", "POST", { email }),
          );
        else {
          await api("/auth/reset", "POST", {
            challengeId: challenge.challengeId,
            code,
            password,
          });
          toast("Password updated. Sign in with your new password.");
          navigate("/login");
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      setChallenge(
        await api<Challenge>("/auth/resend", "POST", {
          challengeId: challenge.challengeId,
        }),
      );
      toast("A new verification code is ready.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <p className="eyebrow">YOUR WORLD, BETTER CONNECTED</p>
        <h1>
          The journey
          <br />
          starts <span>with you.</span>
        </h1>
        <div className="auth-route">
          <i />
          <span>Where you are</span>
          <div />
          <i />
          <span>Where you're going</span>
        </div>
        <p>
          One account. Every connection.
          <br />
          Welcome to a better way to move.
        </p>
      </div>
      <section className="auth-panel">
        <span className="auth-icon">
          {challenge ? (
            <Mail />
          ) : mode === "recover" ? (
            <KeyRound />
          ) : (
            <ShieldCheck />
          )}
        </span>
        <p className="eyebrow">CITYLINK ACCOUNT</p>
        <h2>
          {pending
            ? "Identity verified."
            : challenge
              ? "Check your code."
              : mode === "login"
                ? "Welcome back."
                : mode === "register"
                  ? "Come on board."
                  : "A fresh start."}
        </h2>
        <p>
          {pending
            ? "An administrator will review your staff account. You can sign in once it is activated."
            : challenge
              ? "Enter your six-digit verification code."
              : mode === "login"
                ? "Sign in to your next journey."
                : mode === "register"
                  ? "A few details, and you’re on your way."
                  : "Verify your identity to reset your password."}
        </p>
        {pending ? (
          <Link to="/login" className="btn">
            Back to sign in
            <ArrowRight size={18} />
          </Link>
        ) : (
          <form onSubmit={submit}>
            <ErrorBox message={error} />
            {challenge ? (
              <>
                <Field label="Verification code">
                  <input
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    className="code-input"
                  />
                </Field>
                {challenge.devCode && (
                  <div className="development-note">
                    <strong>Development verification</strong>
                    <span>
                      Use code <b>{challenge.devCode}</b>. Email/SMS delivery is
                      simulated.
                    </span>
                  </div>
                )}
                {mode === "recover" && (
                  <Field label="New password">
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={72}
                      pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,72}"
                      title="At least 10 characters with a letter and number"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                )}
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={resend}
                >
                  Resend code
                </button>
              </>
            ) : (
              <>
                {mode === "register" && (
                  <div className="form-grid">
                    <Field label="First name">
                      <input
                        autoComplete="given-name"
                        required
                        maxLength={80}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </Field>
                    <Field label="Last name">
                      <input
                        autoComplete="family-name"
                        required
                        maxLength={80}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                <Field label="Email address">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                {mode === "register" && (
                  <>
                    <Field label="Phone number">
                      <input
                        type="tel"
                        autoComplete="tel"
                        pattern="[+0-9 ()\-]{8,24}"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+94 77 123 4567"
                      />
                    </Field>
                    <div
                      style={{
                        background: "var(--line-subtle, rgba(255, 255, 255, 0.03))",
                        border: "1px solid var(--line, rgba(255, 255, 255, 0.08))",
                        borderRadius: "10px",
                        padding: "0.85rem 1rem",
                        fontSize: "0.84rem",
                        color: "var(--muted, #9aa4b2)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <strong
                        style={{
                          color: "var(--text-heading, #fff)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <ShieldCheck size={16} color="var(--green, #20e080)" />
                        Passenger Self-Registration
                      </strong>
                      <span>
                        Public self-registration is strictly for passengers. Drivers, Conductors, Operators, and Customer Service staff accounts must be registered directly by the System Administrator.
                      </span>
                    </div>
                  </>
                )}
                {mode !== "recover" && (
                  <Field
                    label="Password"
                    hint={
                      mode === "register"
                        ? "At least 10 characters with a letter and number."
                        : undefined
                    }
                  >
                    <input
                      type="password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      minLength={mode === "register" ? 10 : undefined}
                      maxLength={72}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                )}
                {mode === "login" && (
                  <Link className="text-button forgot" to="/recover">
                    Forgot password?
                  </Link>
                )}
              </>
            )}
            <button className="btn full" disabled={busy}>
              {busy ? <Spinner /> : null}
              {challenge
                ? "Verify & continue"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : "Send verification code"}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
        <p className="auth-switch">
          {mode === "login" ? (
            <>
              New to CityLink? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already on board? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
        {mode === "login" && (
          <details className="demo-accounts">
            <summary>Explore the development accounts</summary>
            <p>
              All demo passwords: <code>CityLink2026!</code>
            </p>
            <div>
              {[
                "passenger",
                "operator",
                "admin",
                "driver",
                "conductor",
                "support",
              ].map((r) => (
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
            <small>
              Development records and simulated payments. Do not enter real
              payment details.
            </small>
          </details>
        )}
      </section>
    </div>
  );
}
