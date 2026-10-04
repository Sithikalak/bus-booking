import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  PenLine,
  Check,
  Navigation,
  CalendarDays,
  Search,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api, query } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Trip, Route, Bus, Staff, Page, User } from "../types";
import {
  Badge,
  ErrorBox,
  Empty,
  Loading,
  PageTitle,
  Pagination,
  Modal,
  Field,
  Spinner,
  dateTime,
  money,
  today,
} from "../components/UI";
type Form = {
  routeId: string;
  busId: string;
  driverId: string;
  conductorId: string;
  departure: string;
  arrival: string;
  fare: number;
  status: string;
  confirmChanges: boolean;
};
export default function Schedules({ duties = false }: { duties?: boolean }) {
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState("");
  const { data, error, loading, reload } = useApi<Page<Trip>>(
    "/schedules?page=" + page + "&size=15",
  );
  const [editing, setEditing] = useState<Trip | "new" | null>(null);
  const [cancel, setCancel] = useState<Trip | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, user } = useApp();
  async function cancelTrip(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api("/schedules/" + cancel?.id + "/cancel", "POST", {
        confirmChanges: confirm,
      });
      setCancel(null);
      toast("Trip cancelled. Affected passengers were notified.");
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function acknowledge(t: Trip) {
    try {
      await api("/trips/" + t.id + "/acknowledge", "POST");
      toast("Assignment acknowledged.");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  const isStaffUser = user && ['ADMIN', 'OPERATOR', 'DRIVER', 'CONDUCTOR'].includes(user.role);
  const list = (data?.items || []).filter((t) => {
    // Driver and Conductor offline nam Schedule penna epa
    if (!isStaffUser && !duties) {
      if (t.crewOnline === false) return false;
      if (t.driver && t.driver.online === false) return false;
      if (t.conductor && t.conductor.online === false) return false;
    }
    return (t.origin + " " + t.destination + " " + t.id + " " + t.bus?.registration)
      .toLowerCase()
      .includes(term.toLowerCase());
  });
  return (
    <>
      <PageTitle
        eyebrow={duties ? "YOUR WORKSPACE" : "OPERATIONS / SCHEDULES"}
        title={duties ? "Your road ahead." : "Keep the city moving."}
        description={
          duties
            ? "Review and acknowledge your assigned journeys."
            : "Plan routes, assign your crew and publish a conflict-free timetable."
        }
      >
        {!duties && (
          <button className="btn" onClick={() => setEditing("new")}>
            <Plus size={18} />
            Create schedule
          </button>
        )}
      </PageTitle>
      <div className="table-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Filter schedules on this page"
            placeholder="Search route, coach or trip…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <span className="tiny">{data?.total || 0} SCHEDULES</span>
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : !list?.length ? (
        <Empty
          title="NO SCHEDULES HERE"
          message="Your schedules will appear here once they are assigned."
          action=""
        />
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Route / trip</th>
                  <th>Timetable</th>
                  <th>Resources</th>
                  <th>Fare</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>
                        {t.origin} → {t.destination}
                      </strong>
                      <small>
                        Trip #{t.id} · {t.stops.length} stops
                      </small>
                    </td>
                    <td>
                      {dateTime(t.departure)}
                      <small>Arrives {dateTime(t.arrival)}</small>
                    </td>
                    <td>
                      {t.bus?.registration || "Unassigned"}
                      <small style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Dr: {t.driver?.name || "No driver"}</span>
                        {t.driver && (
                          <span style={{ fontSize: '9.5px', fontWeight: 800, color: t.driver.online !== false ? '#10b981' : '#f59e0b' }}>
                            ({t.driver.online !== false ? 'Online' : 'Offline'})
                          </span>
                        )}
                        {t.driverAcknowledged ? "✓" : ""}
                      </small>
                      <small style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Cd: {t.conductor?.name || "No conductor"}</span>
                        {t.conductor && (
                          <span style={{ fontSize: '9.5px', fontWeight: 800, color: t.conductor.online !== false ? '#10b981' : '#f59e0b' }}>
                            ({t.conductor.online !== false ? 'Online' : 'Offline'})
                          </span>
                        )}
                        {t.conductorAcknowledged ? "✓" : ""}
                      </small>
                    </td>
                    <td>{money(t.fare)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Badge status={t.status} />
                        {t.crewOnline === false || (t.driver && t.driver.online === false) || (t.conductor && t.conductor.online === false) ? (
                          <span style={{ fontSize: '9.5px', color: '#f59e0b', fontWeight: 800, background: 'rgba(245, 158, 11, 0.15)', padding: '2px 5px', borderRadius: '4px' }}>
                            ⚪ Crew Offline
                          </span>
                        ) : (
                          <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 5px', borderRadius: '4px' }}>
                            🟢 Crew Online
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="table-actions">
                        {duties ? (
                          <>
                            {!["CANCELLED", "DRAFT"].includes(t.status) && (
                              <Link
                                className="icon-button"
                                to={"/track?trip=" + t.id}
                                aria-label={"Track trip " + t.id}
                              >
                                <Navigation size={17} />
                              </Link>
                            )}
                            {((t.driver?.id === user?.id &&
                              !t.driverAcknowledged) ||
                              (t.conductor?.id === user?.id &&
                                !t.conductorAcknowledged)) && (
                              <button
                                className="btn secondary small"
                                onClick={() => acknowledge(t)}
                              >
                                <Check size={15} />
                                Acknowledge
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {["DRAFT", "PUBLISHED"].includes(t.status) && (
                              <button
                                className="icon-button"
                                onClick={() => setEditing(t)}
                                aria-label={"Edit trip " + t.id}
                              >
                                <PenLine size={17} />
                              </button>
                            )}
                            {!["CANCELLED", "ARRIVED"].includes(t.status) && (
                              <button
                                className="text-button danger"
                                onClick={() => {
                                  setCancel(t);
                                  setConfirm(false);
                                  setFormError("");
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
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
        <CalendarDays size={15} />
        All schedule times are Sri Lanka time (UTC+05:30).
      </p>
      {editing && (
        <ScheduleEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            toast("Schedule saved. Resources checked and staff notified.");
          }}
        />
      )}
      {cancel && (
        <Modal title="Cancel this journey?" onClose={() => setCancel(null)}>
          <form onSubmit={cancelTrip}>
            <p>
              {cancel.origin} → {cancel.destination}
              <br />
              {dateTime(cancel.departure)}
            </p>
            <p>
              Passengers with paid tickets will be notified and can request full
              refunds.
            </p>
            <ErrorBox message={formError} />
            <label className="check-field">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              I confirm cancellation and notification of any affected
              passengers.
            </label>
            <button className="btn danger-btn full" disabled={busy || !confirm}>
              {busy ? <Spinner /> : null}Cancel journey
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function ScheduleEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Trip | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = value === "new" ? null : value;
  const { data: routes } = useApi<Route[]>("/routes");
  const { data: buses } = useApi<Bus[]>("/buses");
  const { data: staff } = useApi<Staff[]>("/staff");
  const [form, setForm] = useState<Form>({
    routeId: t ? String(t.routeId) : "",
    busId: t?.bus ? String(t.bus.id) : "",
    driverId: t?.driver ? String(t.driver.id) : "",
    conductorId: t?.conductor ? String(t.conductor.id) : "",
    departure: t?.departure.slice(0, 16) || today() + "T08:00",
    arrival: t?.arrival.slice(0, 16) || "",
    fare: t?.fare || 1850,
    status: t?.status || "DRAFT",
    confirmChanges: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form, v: string | number | boolean) =>
    setForm((s) => ({ ...s, [k]: v }));
  const route = routes?.find((r) => String(r.id) === form.routeId);
  useEffect(() => {
    if (route && form.departure) {
      const start = new Date(form.departure + "+05:30").getTime();
      const duration = route.stops.at(-1)?.minutesFromDeparture || 0;
      const d = new Date(start + duration * 60000 + 330 * 60000)
        .toISOString()
        .slice(0, 16);
      setForm((s) => ({ ...s, arrival: d }));
    }
  }, [route, form.departure]);
  const { data: availability } = useApi<{ buses: Bus[]; staff: User[] }>(
    form.departure && form.arrival && form.arrival > form.departure
      ? "/staff/availability?" +
          query({
            departure: form.departure,
            arrival: form.arrival,
            excludeTripId: t?.id,
          })
      : null,
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/schedules" + (t ? "/" + t.id : ""), t ? "PUT" : "POST", {
        ...form,
        routeId: +form.routeId,
        busId: form.busId ? +form.busId : null,
        driverId: form.driverId ? +form.driverId : null,
        conductorId: form.conductorId ? +form.conductorId : null,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t ? "Edit journey #" + t.id : "Create a new schedule"}
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <ErrorBox message={error} />
        <Field label="Route">
          <select
            required
            value={form.routeId}
            onChange={(e) => set("routeId", e.target.value)}
          >
            <option value="">Choose a route</option>
            {routes
              ?.filter((r) => r.active)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {r.origin} → {r.destination} · {r.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Departure (Sri Lanka time)">
            <input
              type="datetime-local"
              required
              value={form.departure}
              onChange={(e) => set("departure", e.target.value)}
            />
          </Field>
          <Field label="Calculated arrival">
            <input type="datetime-local" readOnly value={form.arrival} />
          </Field>
        </div>
        {route && (
          <div className="stop-chips">
            {route.stops.map((s, i) => (
              <span key={i}>
                {s.name}
                <small>+{s.minutesFromDeparture}m</small>
              </span>
            ))}
          </div>
        )}
        <Field label="Coach">
          <select
            value={form.busId}
            onChange={(e) => set("busId", e.target.value)}
          >
            <option value="">Assign later (draft only)</option>
            {buses?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.registration} · {b.capacity} seats{" "}
                {availability && !availability.buses.some((x) => x.id === b.id)
                  ? "— UNAVAILABLE"
                  : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          {(["DRIVER", "CONDUCTOR"] as const).map((role) => (
            <Field
              key={role}
              label={role === "DRIVER" ? "Driver" : "Conductor"}
            >
              <select
                value={role === "DRIVER" ? form.driverId : form.conductorId}
                onChange={(e) =>
                  set(
                    role === "DRIVER" ? "driverId" : "conductorId",
                    e.target.value,
                  )
                }
              >
                <option value="">Assign later</option>
                {staff
                  ?.filter((s) => s.role === role)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{" "}
                      {availability &&
                      !availability.staff.some((x) => x.id === s.id)
                        ? "— UNAVAILABLE"
                        : ""}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Fare (LKR)">
            <input
              type="number"
              required
              min="1"
              max="1000000"
              step="0.01"
              value={form.fare}
              onChange={(e) => set("fare", +e.target.value)}
            />
          </Field>
          <Field label="Publishing">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="DRAFT">Save as draft</option>
              <option value="PUBLISHED">Publish for passengers</option>
            </select>
          </Field>
        </div>
        {t && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.confirmChanges}
              onChange={(e) => set("confirmChanges", e.target.checked)}
            />
            I confirm these changes and notification of affected passengers.
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn" disabled={busy}>
            {busy ? <Spinner /> : <Check size={17} />}Save schedule
          </button>
        </div>
      </form>
    </Modal>
  );
}
