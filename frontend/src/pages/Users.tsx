import { useState } from "react";
import { Plus, Search, PenLine, Check, UserX, UserCheck, Trash2 } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { User, Page } from "../types";
import {
  PageTitle,
  Badge,
  ErrorBox,
  Loading,
  Pagination,
  Modal,
  Field,
  Spinner,
} from "../components/UI";
const ROLES = [
  "PASSENGER",
  "DRIVER",
  "CONDUCTOR",
  "OPERATOR",
  "ADMIN",
  "CUSTOMER_SERVICE",
];
const ALL = [
  "SCHEDULES",
  "FLEET",
  "BOOKINGS",
  "TRACKING",
  "SUPPORT",
  "REPORTS",
  "USERS",
];
const allowed = (role: string) =>
  role === "ADMIN"
    ? ALL
    : role === "OPERATOR"
      ? ["SCHEDULES", "FLEET", "BOOKINGS", "TRACKING", "REPORTS"]
      : role === "CUSTOMER_SERVICE"
        ? ["SUPPORT", "BOOKINGS"]
        : [];
export default function Users() {
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useApi<Page<User>>(
    "/users?q=" + encodeURIComponent(q) + "&page=" + page + "&size=15",
  );
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const { user: currentUser, toast } = useApp();

  const handleToggleStatus = async (targetUser: User) => {
    if (currentUser && targetUser.id === currentUser.id) {
      toast("You cannot deactivate your own account.", "error");
      return;
    }
    const isActivating = targetUser.status === "DISABLED";
    try {
      await api.put(`/users/${targetUser.id}/toggle-status`);
      toast(`User ${targetUser.email} has been ${isActivating ? "activated" : "deactivated"}.`);
      reload();
    } catch (err: any) {
      toast(err.message || "Failed to update user status", "error");
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (currentUser && targetUser.id === currentUser.id) {
      toast("You cannot remove your own administrator account.", "error");
      return;
    }
    const confirmed = window.confirm(
      `Permanently remove user "${targetUser.firstName} ${targetUser.lastName}" (${targetUser.email})?\n\nThis will revoke all active sessions, detach past records, and remove the account permanently.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/users/${targetUser.id}`);
      toast(`User ${targetUser.email} removed successfully.`);
      reload();
    } catch (err: any) {
      toast(err.message || "Failed to delete user", "error");
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION / ACCESS"
        title="The right people. The right access."
        description="Manage verified accounts, role permissions and employee approvals."
      >
        <button className="btn" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Create account
        </button>
      </PageTitle>
      <form
        className="table-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQ(term);
        }}
      >
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Search users"
            placeholder="Search name, email or role…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <button className="btn secondary small">Search</button>
      </form>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Permissions</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>
                        {u.firstName} {u.lastName}
                      </strong>
                      <small>{u.email}</small>
                    </td>
                    <td>
                      <Badge status={u.role} />
                    </td>
                    <td>
                      <Badge status={u.status} />
                    </td>
                    <td>{u.verified ? "✓ Yes" : "No"}</td>
                    <td>
                      <small>
                        {u.permissions.join(", ") || "Passenger / crew access"}
                      </small>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                        <button
                          className="icon-button"
                          aria-label={"Edit " + u.email}
                          title="Edit details"
                          onClick={() => setEditing(u)}
                        >
                          <PenLine size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          title={u.status === "ACTIVE" ? "Deactivate user" : "Activate user"}
                          style={{
                            color: u.status === "ACTIVE" ? "#f59e0b" : "#10b981",
                          }}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.status === "ACTIVE" ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Delete " + u.email}
                          title="Permanently remove user"
                          style={{ color: "#ef4444" }}
                          onClick={() => handleDeleteUser(u)}
                        >
                          <Trash2 size={16} />
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
      {data && (
        <Pagination
          page={page}
          size={15}
          total={data.total}
          onChange={setPage}
        />
      )}
      <p className="subtle-note">
        Role, permission and access changes end the affected user’s existing
        sessions.
      </p>
      {editing && (
        <UserEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            toast("Account and permissions saved.");
          }}
        />
      )}
    </>
  );
}
function UserEditor({
  value,
  onClose,
  onSaved,
}: {
  value: User | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const u = value === "new" ? null : value;
  const { user: currentUser, toast } = useApp();
  const [form, setForm] = useState({
    firstName: u?.firstName || "",
    lastName: u?.lastName || "",
    email: u?.email || "",
    phone: u?.phone || "",
    password: "",
    role: u?.role || "PASSENGER",
    status: u?.status || "ACTIVE",
    verified: u?.verified ?? true,
    permissions: u?.permissions || ([] as string[]),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/users" + (u ? "/" + u.id : ""), u ? "PUT" : "POST", form);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={u ? "Edit account" : "Create an account"}
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <ErrorBox message={error} />
        <div className="form-grid">
          <Field label="First name">
            <input
              required
              maxLength={80}
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <input
              required
              maxLength={80}
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              required
              type="tel"
              pattern="[+0-9 ()\-]{8,24}"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label={u ? "New password (optional)" : "Password"}>
            <input
              required={!u}
              type="password"
              minLength={10}
              maxLength={72}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value,
                  permissions: allowed(e.target.value),
                }))
              }
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Account status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {["ACTIVE", "DISABLED", "PENDING_APPROVAL"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.verified}
            onChange={(e) => set("verified", e.target.checked)}
          />
          Identity verified
        </label>
        <div className="permissions">
          <p className="eyebrow">ROLE PERMISSIONS</p>
          {allowed(form.role).length ? (
            allowed(form.role).map((p) => (
              <label key={p} className="check-field">
                <input
                  type="checkbox"
                  disabled={form.role === "ADMIN"}
                  checked={form.permissions.includes(p)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      permissions: e.target.checked
                        ? [...f.permissions, p]
                        : f.permissions.filter((x) => x !== p),
                    }))
                  }
                />
                {p.toLowerCase()}
              </label>
            ))
          ) : (
            <p>
              Access is limited to the role’s personal booking or duty features.
            </p>
          )}
        </div>
        <button className="btn full" disabled={busy}>
          {busy ? <Spinner /> : <Check size={17} />}Save account
        </button>

        {u && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border, #e5e7eb)" }}>
            <button
              type="button"
              className="btn secondary"
              style={{ flex: 1, borderColor: form.status === "ACTIVE" ? "#f59e0b" : "#10b981", color: form.status === "ACTIVE" ? "#f59e0b" : "#10b981" }}
              disabled={busy}
              onClick={async () => {
                if (currentUser && u.id === currentUser.id) {
                  setError("You cannot deactivate your own account.");
                  return;
                }
                setBusy(true);
                try {
                  await api.put(`/users/${u.id}/toggle-status`);
                  toast(`Account ${u.email} status updated.`);
                  onSaved();
                } catch (e: any) {
                  setError(e.message || "Failed to toggle status");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {form.status === "ACTIVE" ? <UserX size={15} /> : <UserCheck size={15} />}
              {form.status === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444" }}
              disabled={busy}
              onClick={async () => {
                if (currentUser && u.id === currentUser.id) {
                  setError("You cannot remove your own administrator account.");
                  return;
                }
                if (!window.confirm(`Permanently remove ${u.firstName} ${u.lastName} (${u.email})?\n\nThis action cannot be undone.`)) return;
                setBusy(true);
                try {
                  await api.delete(`/users/${u.id}`);
                  toast(`User ${u.email} has been permanently removed.`);
                  onSaved();
                } catch (e: any) {
                  setError(e.message || "Failed to remove user");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={15} />
              Remove User
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
