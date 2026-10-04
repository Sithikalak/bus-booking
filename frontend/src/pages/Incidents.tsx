import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Incident, Bus } from "../types";
import {
  Badge,
  ErrorBox,
  Empty,
  Loading,
  PageTitle,
  Modal,
  Field,
  Spinner,
  dateTime,
} from "../components/UI";
export default function Incidents() {
  const { data, error, loading, reload } = useApi<Incident[]>("/incidents");
  const { data: buses } = useApi<Bus[]>("/buses");
  const { can, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [busId, setBus] = useState("");
  const [type, setType] = useState("MECHANICAL");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);
  const [formError, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/incidents", "POST", {
        busId: +busId,
        type,
        description,
        priority,
      });
      setOpen(false);
      setDescription("");
      reload();
      toast("Incident recorded. Operations has been notified.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(i: Incident, status: string) {
    try {
      await api("/incidents/" + i.id, "PUT", { status });
      reload();
      toast("Incident status updated.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS / VEHICLE HEALTH"
        title="A safer road ahead."
        description="Report, review and resolve issues with your coaches."
      >
        <button
          className="btn"
          onClick={() => {
            setOpen(true);
            setError("");
          }}
        >
          <Plus size={18} />
          Report an issue
        </button>
      </PageTitle>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title="ALL CLEAR"
          message="No reported vehicle incidents."
          action=""
        />
      ) : (
        <div className="request-list">
          {data.map((i) => (
            <article
              className={
                "panel request-card " +
                (["HIGH", "URGENT"].includes(i.priority)
                  ? "urgent-incident"
                  : "")
              }
              key={i.id}
            >
              <div className="panel-heading">
                <div className="inline">
                  <AlertTriangle size={19} />
                  <Badge status={i.priority} />
                  <Badge status={i.status} />
                </div>
                <small>{dateTime(i.createdAt)}</small>
              </div>
              <h3>
                {i.bus} · {i.type.replaceAll("_", " ")}
              </h3>
              <p>{i.description}</p>
              <div className="request-bottom">
                <small>Reported by {i.reportedBy}</small>
                {can("FLEET") && (
                  <label className="inline">
                    Status
                    <select
                      aria-label={"Status of incident " + i.id}
                      value={i.status}
                      onChange={(e) => update(i, e.target.value)}
                    >
                      {["OPEN", "IN_REVIEW", "RESOLVED"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {open && (
        <Modal title="Report a vehicle issue" onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <ErrorBox message={formError} />
            <Field label="Coach">
              <select
                required
                value={busId}
                onChange={(e) => setBus(e.target.value)}
              >
                <option value="">Select a coach</option>
                {buses?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.registration} · {b.model}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Issue type">
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {["MECHANICAL", "ELECTRICAL", "CABIN", "SAFETY", "OTHER"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Describe the issue">
              <textarea
                required
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <button className="btn full" disabled={busy}>
              {busy ? <Spinner /> : <AlertTriangle size={17} />}Submit report
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
