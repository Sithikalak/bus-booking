import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Send, Check, X, RotateCcw, Headphones } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { SupportRequest, Refund } from "../types";
import {
  Badge,
  ErrorBox,
  Empty,
  Loading,
  PageTitle,
  Modal,
  Field,
  Spinner,
  money,
  dateTime,
} from "../components/UI";
export default function Support({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  const { can, toast } = useApp();
  const {
    data: requests,
    error,
    loading,
    reload,
  } = useApi<SupportRequest[]>("/customer-service");
  const {
    data: refunds,
    error: refundError,
    reload: refreshRefunds,
  } = useApi<Refund[]>("/refunds");
  const [tab, setTab] = useState("requests");
  const [editing, setEditing] = useState<SupportRequest | "new" | null>(null);
  const [category, setCategory] = useState("INQUIRY");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("IN_REVIEW");
  const [review, setReview] = useState<{
    refund: Refund;
    approve: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setError] = useState("");
  const manager = can("SUPPORT");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing === "new")
        await api("/customer-service", "POST", {
          category,
          subject,
          description,
        });
      else
        await api("/customer-service/" + editing?.id, "PUT", {
          status,
          response,
        });
      setEditing(null);
      reload();
      toast(
        editing === "new"
          ? "Your request has been received."
          : "Response sent and saved to the passenger account.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function decide(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<Refund>(
        "/refunds/" + review?.refund.id + "/review",
        "POST",
        { approve: review?.approve, reason },
      );
      setReview(null);
      refreshRefunds();
      toast(
        r.status === "FAILED"
          ? "Gateway retries failed. The refund was escalated to an administrator."
          : "Refund " + r.status.toLowerCase() + ".",
        r.status === "FAILED" ? "info" : "success",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retry(r: Refund) {
    try {
      await api("/refunds/" + r.id + "/retry", "POST");
      refreshRefunds();
      toast("Refund retry completed. Check its updated status.", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <div className={dashboard ? "" : "container page"}>
      <PageTitle
        eyebrow={
          manager ? "OPERATIONS / CUSTOMER CARE" : "WE’RE HERE FOR YOUR JOURNEY"
        }
        title={
          manager ? "Care at every connection." : "A little help along the way."
        }
        description={
          manager
            ? "Review inquiries, resolve complaints and process eligible refunds."
            : "Ask a question, share a concern or follow up on a refund."
        }
      >
        {!manager && (
          <button
            className="btn"
            onClick={() => {
              setEditing("new");
              setSubject("");
              setDescription("");
              setError("");
            }}
          >
            <Plus size={18} />
            New request
          </button>
        )}
      </PageTitle>
      <div className="tabs">
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          Inquiries & complaints <small>{requests?.length || 0}</small>
        </button>
        <button
          className={tab === "refunds" ? "active" : ""}
          onClick={() => setTab("refunds")}
        >
          Refunds <small>{refunds?.length || 0}</small>
        </button>
      </div>
      <ErrorBox
        message={error || refundError}
        retry={() => {
          reload();
          refreshRefunds();
        }}
      />
      {loading ? (
        <Loading />
      ) : tab === "requests" ? (
        requests?.length ? (
          <div className="request-list">
            {requests.map((r) => (
              <article className="panel request-card" key={r.id}>
                <div className="panel-heading">
                  <div className="inline">
                    <Badge status={r.category} />
                    <Badge status={r.status} />
                  </div>
                  <small>{dateTime(r.createdAt)}</small>
                </div>
                <h3>{r.subject}</h3>
                <p>{r.description}</p>
                {r.response && (
                  <div className="staff-response">
                    <Headphones size={18} />
                    <div>
                      <strong>CityLink support</strong>
                      <p>{r.response}</p>
                    </div>
                  </div>
                )}
                <div className="request-bottom">
                  <small>
                    #{r.id} · {r.passengerName}
                  </small>
                  {manager && (
                    <button
                      className="btn secondary small"
                      onClick={() => {
                        setEditing(r);
                        setResponse(r.response || "");
                        setStatus(r.status === "OPEN" ? "IN_REVIEW" : r.status);
                        setError("");
                      }}
                    >
                      Respond
                      <Send size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="YOU’RE ALL CAUGHT UP"
            message="Your customer service conversations will appear here."
            action=""
          />
        )
      ) : refunds?.length ? (
        <div className="request-list">
          {refunds.map((r) => (
            <article className="panel request-card" key={r.id}>
              <div className="panel-heading">
                <div className="inline">
                  <Badge status={r.status} />
                  <strong>{r.bookingReference}</strong>
                </div>
                <strong>{money(r.amount)}</strong>
              </div>
              <p>{r.reason}</p>
              <small>
                {r.passengerName} · {dateTime(r.createdAt)}
              </small>
              {r.rejectionReason && (
                <div className="error-box">
                  Refund request rejected: {r.rejectionReason}
                </div>
              )}
              {r.status === "FAILED" && (
                <div className="warning-banner">
                  Gateway failed after {r.attempts} attempts. Administrator
                  attention required.
                </div>
              )}
              <div className="request-bottom">
                <small>
                  {r.gatewayReference || "Full fare policy for cancelled trips"}
                </small>
                <div className="inline">
                  {manager && r.status === "REQUESTED" && (
                    <>
                      <button
                        className="btn small"
                        onClick={() => {
                          setReview({ refund: r, approve: true });
                          setReason("");
                          setError("");
                        }}
                      >
                        <Check size={15} />
                        Approve
                      </button>
                      <button
                        className="btn secondary small"
                        onClick={() => {
                          setReview({ refund: r, approve: false });
                          setReason("");
                          setError("");
                        }}
                      >
                        <X size={15} />
                        Reject
                      </button>
                    </>
                  )}
                  {can("USERS") && r.status === "FAILED" && (
                    <button
                      className="btn secondary small"
                      onClick={() => retry(r)}
                    >
                      <RotateCcw size={15} />
                      Retry gateway
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="NO REFUND REQUESTS"
          message="Cancelled trip? Request your refund from the relevant ticket in My journeys."
          to="/my-bookings"
          action="View my journeys"
        />
      )}
      {editing && (
        <Modal
          title={
            editing === "new"
              ? "How can we help?"
              : "Respond to request #" + editing.id
          }
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <ErrorBox message={formError} />
            {editing === "new" ? (
              <>
                <Field label="Category">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="INQUIRY">Inquiry</option>
                    <option value="COMPLAINT">Complaint</option>
                  </select>
                </Field>
                <Field label="Subject">
                  <input
                    required
                    maxLength={160}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Field>
                <Field label="Your message">
                  <textarea
                    required
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <p className="subtle-note">
                  For refunds, use the cancelled ticket in{" "}
                  <Link to="/my-bookings">My journeys</Link>.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>{editing.subject}</strong>
                  <br />
                  {editing.description}
                </p>
                <Field label="Status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Response to passenger">
                  <textarea
                    required
                    maxLength={2000}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  />
                </Field>
              </>
            )}
            <button className="btn full" disabled={busy}>
              {busy ? <Spinner /> : <Send size={17} />}Send{" "}
              {editing === "new" ? "request" : "response"}
            </button>
          </form>
        </Modal>
      )}
      {review && (
        <Modal
          title={
            review.approve
              ? "Approve and process refund"
              : "Reject refund request"
          }
          onClose={() => setReview(null)}
        >
          <form onSubmit={decide}>
            <p>
              {review.refund.bookingReference} · {money(review.refund.amount)}
            </p>
            <p>
              {review.approve
                ? "This sends the full fare to the development gateway. Failed transactions retry once before escalation."
                : "The passenger will receive your rejection reason in their account."}
            </p>
            <ErrorBox message={formError} />
            {!review.approve && (
              <Field label="Rejection reason">
                <textarea
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            <button className="btn full" disabled={busy}>
              {busy ? <Spinner /> : null}
              {review.approve ? "Approve refund" : "Reject with reason"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
