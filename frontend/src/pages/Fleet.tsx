import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  PenLine,
  BusFront,
  Users,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Bus, Staff } from "../types";
import {
  Badge,
  ErrorBox,
  Loading,
  PageTitle,
  Modal,
  Field,
  Spinner,
  Empty,
  dateTime,
} from "../components/UI";
export default function Fleet() {
  const { data, error, loading, reload } = useApi<Bus[]>("/buses");
  const [editing, setEditing] = useState<Bus | "new" | null>(null);
  const { toast } = useApp();
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS / FLEET"
        title="A fleet that goes further."
        description="Your coaches, their condition and the people behind each journey."
      >
        <button className="btn" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Add coach
        </button>
      </PageTitle>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="fleet-grid">
          {data?.map((b) => (
            <article className="panel fleet-card" key={b.id}>
              <div className="panel-heading">
                <Badge status={b.status} />
                <button
                  className="icon-button"
                  aria-label={"Edit " + b.registration}
                  onClick={() => setEditing(b)}
                >
                  <PenLine size={17} />
                </button>
              </div>
              <div className="fleet-bus-art" aria-hidden="true">
                <div className="illustrated-bus">
                  <div className="illustrated-windows" />
                  <span>CITYLINK EXPRESS</span>
                  <i />
                  <i />
                </div>
                <div className="bus-art-floor" />
              </div>
              <div className="fleet-card-title">
                <h2>{b.registration}</h2>
                <span>
                  {b.capacity}
                  <small>SEATS</small>
                </span>
              </div>
              <p>
                {b.model} · {b.type}
              </p>
              <div className="feature-tags">
                {b.features.split(",").map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
              <div className="fleet-assignment">
                <small>NEXT ASSIGNMENT</small>
                {b.nextTrip ? (
                  <>
                    <strong>{b.nextTrip.route}</strong>
                    <span>{dateTime(b.nextTrip.departure)}</span>
                    <div>
                      <Users size={15} />
                      {b.nextTrip.driver || "No driver"} ·{" "}
                      {b.nextTrip.conductor || "No conductor"}
                    </div>
                  </>
                ) : (
                  <span>Available for assignment</span>
                )}
              </div>
              <div className="fleet-card-bottom">
                {b.openIncidents ? (
                  <Link to="/dashboard/incidents" className="warning-text">
                    <AlertTriangle size={15} />
                    {b.openIncidents} open issue(s)
                  </Link>
                ) : (
                  <span className="live-label">
                    <i />
                    No open incidents
                  </span>
                )}
                <Link className="text-link" to="/dashboard/schedules">
                  Assign
                  <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <BusEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            toast("Fleet record updated.");
          }}
        />
      )}
    </>
  );
}
function BusEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Bus | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const b = value === "new" ? null : value;
  const [form, setForm] = useState({
    registration: b?.registration || "",
    model: b?.model || "",
    capacity: b?.capacity || 40,
    type: b?.type || "Premium AC",
    features: b?.features || "Wi-Fi,USB charging,Air conditioning",
    status: b?.status || "AVAILABLE",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/buses" + (b ? "/" + b.id : ""), b ? "PUT" : "POST", form);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={b ? "Edit coach" : "Add a coach"} onClose={onClose}>
      <form onSubmit={save}>
        <ErrorBox message={error} />
        <div className="form-grid">
          <Field label="Registration">
            <input
              required
              maxLength={40}
              value={form.registration}
              onChange={(e) => set("registration", e.target.value)}
            />
          </Field>
          <Field
            label="Capacity"
            hint={
              b
                ? "Seat layout is fixed after creation."
                : "A 2+2 cabin layout will be created."
            }
          >
            <input
              required
              type="number"
              min={8}
              max={60}
              value={form.capacity}
              disabled={!!b}
              onChange={(e) => set("capacity", +e.target.value)}
            />
          </Field>
        </div>
        <Field label="Model">
          <input
            required
            maxLength={120}
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
          />
        </Field>
        <Field label="Coach type">
          <input
            required
            maxLength={60}
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          />
        </Field>
        <Field label="Features (comma separated)">
          <input
            maxLength={500}
            value={form.features}
            onChange={(e) => set("features", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {[
              "AVAILABLE",
              "ACTIVE",
              "ON_TRIP",
              "MAINTENANCE",
              "OUT_OF_SERVICE",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <button className="btn full" disabled={busy}>
          {busy ? <Spinner /> : <BusFront size={17} />}Save coach
        </button>
      </form>
    </Modal>
  );
}
export function StaffPage() {
  const { data, error, loading, reload } = useApi<Staff[]>("/staff");
  const [editing, setEditing] = useState<Staff | null>(null);
  const [license, setLicense] = useState("");
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const { toast } = useApp();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api("/staff/" + editing?.id, "PUT", {
        licenseNumber: license,
        available,
      });
      setEditing(null);
      reload();
      toast("Staff availability updated.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS / PEOPLE"
        title="The people who move us."
        description="Driver and conductor availability, duty schedules and acknowledgements."
      >
        <Link className="btn secondary" to="/dashboard/schedules">
          Assign a duty
          <ArrowRight size={17} />
        </Link>
      </PageTitle>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="NO STAFF PROFILES" action="" />
      ) : (
        <div className="staff-grid">
          {data.map((s) => (
            <article className="panel staff-card" key={s.id}>
              <div className="staff-heading">
                <div className="avatar">
                  {s.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <h3>{s.name}</h3>
                  <Badge status={s.role} />
                </div>
                <button
                  className="icon-button"
                  aria-label={"Edit " + s.name}
                  onClick={() => {
                    setEditing(s);
                    setLicense(s.licenseNumber || "");
                    setAvailable(s.available);
                    setFormError("");
                  }}
                >
                  <PenLine size={16} />
                </button>
              </div>
              <div className="staff-details">
                <span>{s.email}</span>
                <span>{s.phone}</span>
                <small>{s.licenseNumber || "No licence recorded"}</small>
              </div>
              <div className="summary-row">
                <span>Availability</span>
                <Badge
                  status={
                    s.available && s.status === "ACTIVE"
                      ? "AVAILABLE"
                      : "UNAVAILABLE"
                  }
                />
              </div>
              <details className="duty-details">
                <summary>{s.duties.length} assigned duties</summary>
                {s.duties.map((d) => (
                  <div key={d.id}>
                    <strong>{d.route}</strong>
                    <small>
                      {dateTime(d.departure)} → {dateTime(d.arrival)}
                    </small>
                    <span>
                      {d.status} ·{" "}
                      {d.acknowledged
                        ? "Acknowledged"
                        : "Awaiting acknowledgement"}
                    </span>
                  </div>
                ))}
              </details>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={"Update " + editing.name}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <ErrorBox message={formError} />
            <Field label="Licence / staff reference">
              <input
                maxLength={60}
                value={license}
                onChange={(e) => setLicense(e.target.value)}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
              />
              Available for new assignments
            </label>
            <p className="subtle-note">
              Existing upcoming duties must be reassigned before making someone
              unavailable.
            </p>
            <button className="btn full" disabled={busy}>
              {busy ? <Spinner /> : null}Save availability
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
