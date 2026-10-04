import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Ticket, Navigation, RotateCcw } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Page, Booking, Refund } from "../types";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
  Modal,
  Field,
  Spinner,
  money,
  dateTime,
} from "../components/UI";
export default function Journeys({ admin = false }: { admin?: boolean }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const { data, error, loading, reload } = useApi<Page<Booking>>(
    "/bookings?page=" + page + "&size=12",
  );
  const { data: refunds, reload: refreshRefunds } =
    useApi<Refund[]>("/refunds");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const { toast } = useApp();
  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api("/refunds", "POST", { bookingId: selected?.id, reason });
      setSelected(null);
      setReason("");
      refreshRefunds();
      toast("Refund request sent for review.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const items = data?.items.filter(
    (b) => filter === "ALL" || b.status === filter,
  );
  return (
    <div className={admin ? "" : "container page"}>
      <PageTitle
        eyebrow={admin ? "RESERVATIONS" : "YOUR CITYLINK"}
        title={admin ? "Every journey, connected." : "My Bookings & Trips."}
        description={
          admin
            ? "Bookings and receipts, directly from your reservation records."
            : "View your booked journeys, access digital e-tickets, and track your coaches in real time."
        }
      >
        <Link to="/search" className="btn">
          Book a journey
          <ArrowRight size={18} />
        </Link>
      </PageTitle>
      <div className="tabs" role="group" aria-label="Filter bookings">
        {["ALL", "CONFIRMED", "REFUNDED", "FAILED"].map((s) => (
          <button
            key={s}
            className={filter === s ? "active" : ""}
            onClick={() => {
              setFilter(s);
            }}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : !items?.length ? (
        <Empty />
      ) : (
        <div className="journey-cards">
          {items.map((b) => {
            const refund = refunds?.find((r) => r.bookingId === b.id);
            return (
              <article className="panel journey-card" key={b.id}>
                <div className="journey-card-top">
                  <span className="eyebrow">
                    <Ticket size={15} />
                    {b.reference}
                  </span>
                  <Badge
                    status={
                      b.tripStatus === "CANCELLED" ? "TRIP CANCELLED" : b.status
                    }
                  />
                </div>
                <h2>
                  {b.origin}
                  <ArrowRight size={22} />
                  {b.destination}
                </h2>
                <p>{dateTime(b.departure)}</p>
                {(b.pickupStop || b.dropoffStop) && (
                  <div className="journey-stops-badge">
                    <span>
                      <small>Boarding: </small>
                      <strong>{b.pickupStop || b.origin}</strong>
                    </span>
                    <span>
                      <small>Drop-off: </small>
                      <strong>{b.dropoffStop || b.destination}</strong>
                    </span>
                  </div>
                )}
                <div className="journey-meta">
                  <span>
                    PASSENGER<strong>{b.passengerName}</strong>
                  </span>
                  <span>
                    COACH<strong>{b.bus}</strong>
                  </span>
                  <span>
                    SEAT<strong>{b.seat}</strong>
                  </span>
                  <span>
                    FARE<strong>{money(b.totalAmount)}</strong>
                  </span>
                </div>
                {refund && (
                  <div className="refund-status">
                    <Badge status={refund.status} />
                    <span>
                      {refund.rejectionReason ||
                        "Refund: " + money(refund.amount)}
                    </span>
                  </div>
                )}
                <div className="journey-actions">
                  <Link className="btn secondary small" to={"/ticket/" + b.id}>
                    View ticket
                    <ArrowRight size={16} />
                  </Link>
                  {b.status === "CONFIRMED" && b.tripStatus !== "CANCELLED" && (
                    <Link className="text-link" to={"/track?trip=" + b.tripId}>
                      <Navigation size={16} />
                      Track bus
                    </Link>
                  )}
                  {!admin &&
                    b.status === "CONFIRMED" &&
                    b.tripStatus === "CANCELLED" &&
                    !refund && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelected(b);
                          setFormError("");
                        }}
                      >
                        <RotateCcw size={16} />
                        Request refund
                      </button>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {data && (
        <Pagination
          page={page}
          size={12}
          total={data.total}
          onChange={setPage}
        />
      )}
      <Link className="text-link" to="/support">
        Need a hand with a journey? Contact support
        <ArrowRight size={16} />
      </Link>
      {selected && (
        <Modal title="Request a refund" onClose={() => setSelected(null)}>
          <form onSubmit={request}>
            <p>
              Your cancelled trip is eligible for a full fare refund of{" "}
              <strong>{money(selected.totalAmount)}</strong>. Customer service
              will review your request.
            </p>
            <ErrorBox message={formError} />
            <Field label="Reason">
              <textarea
                required
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us about your request."
              />
            </Field>
            <button className="btn full" disabled={busy}>
              {busy ? <Spinner /> : <RotateCcw size={17} />}Submit refund
              request
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
