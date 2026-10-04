import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import {
  ArrowRight,
  Check,
  Download,
  Printer,
  Navigation,
  ShieldCheck,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import type { Booking } from "../types";
import {
  Badge,
  ErrorBox,
  Loading,
  money,
  dateTime,
  clockTime,
} from "../components/UI";
const escape = (s: unknown) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export default function Ticket() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data: b, error } = useApi<Booking>("/bookings/" + id);
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (b)
      QRCode.toDataURL("CITYLINK:" + b.reference, {
        width: 220,
        margin: 1,
        color: { dark: "#05070a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }).then(setQr);
  }, [b]);
  function download() {
    if (!b || !qr) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(b.reference)} — CityLink ticket</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#152430}article{max-width:700px;margin:auto;border:1px solid #b7c3ca;padding:36px;border-radius:20px}h1{font-size:30px}table{width:100%;border-collapse:collapse}td{padding:13px;border-bottom:1px solid #ddd}img{display:block;margin:25px auto}small{color:#52616b}@media print{button{display:none}}</style></head><body><article><small>CITYLINK EXPRESS / DIGITAL BOARDING PASS</small><h1>${escape(b.origin)} → ${escape(b.destination)}</h1><p>${escape(b.reference)}</p><table>${[
      ["Passenger", b.passengerName],
      ["Boarding Point", b.pickupStop || b.origin],
      ["Drop-off Point", b.dropoffStop || b.destination],
      ["Departure (Sri Lanka)", dateTime(b.departure)],
      ["Arrival (Sri Lanka)", dateTime(b.arrival)],
      ["Coach", b.bus],
      ["Seat", b.seat],
      ["Booking status", b.status],
      ["Trip status", b.tripStatus],
      ["Fare", money(b.totalAmount)],
      ["Payment", b.paymentStatus],
      ["Transaction reference", b.paymentReference],
    ]
      .map(
        ([k, v]) =>
          `<tr><td>${escape(k)}</td><td><b>${escape(v)}</b></td></tr>`,
      )
      .join(
        "",
      )}</table><img src="${qr}" alt="Booking reference QR code" width="180"><p>Present this ticket when boarding. Arrive 15 minutes before departure.</p><small>Development ticket. Payments are simulated. QR encodes the booking reference.</small></article></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = b.reference + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!b)
    return (
      <div className="container page">
        <ErrorBox message={error} />
        {!error && <Loading />}
      </div>
    );
  return (
    <div className="container page ticket-page">
      {params.has("confirmed") && b.status === "CONFIRMED" ? (
        <header className="confirmation">
          <span>
            <Check size={35} />
          </span>
          <p className="eyebrow">BOOKING CONFIRMED</p>
          <h1>Your journey is ready.</h1>
          <p>A new destination. A little more possibility.</p>
        </header>
      ) : (
        <header className="confirmation">
          <p className="eyebrow">YOUR DIGITAL BOARDING PASS</p>
          <h1>All set for the journey.</h1>
        </header>
      )}
      <article className="ticket">
        <div className="ticket-main">
          <div className="ticket-brand">
            <strong>
              CITYLINK <small>EXPRESS</small>
            </strong>
            <Badge
              status={
                b.tripStatus === "CANCELLED" ? "TRIP CANCELLED" : b.status
              }
            />
          </div>
          <div className="ticket-route">
            <div>
              <small>BOARDING ({b.origin})</small>
              <h2>{b.pickupStop || b.origin}</h2>
              <strong>{clockTime(b.departure)}</strong>
            </div>
            <ArrowRight size={30} />
            <div>
              <small>DROP-OFF ({b.destination})</small>
              <h2>{b.dropoffStop || b.destination}</h2>
              <strong>{clockTime(b.arrival)}</strong>
            </div>
          </div>
          <div className="ticket-info">
            <span>
              PASSENGER<strong>{b.passengerName}</strong>
            </span>
            <span>
              DATE<strong>{dateTime(b.departure).split(",")[0]}</strong>
            </span>
            <span>
              COACH<strong>{b.bus}</strong>
            </span>
            <span>
              SEAT<strong>{b.seat}</strong>
            </span>
            <span>
              PICKUP<strong>{b.pickupStop || b.origin}</strong>
            </span>
            <span>
              DROPOFF<strong>{b.dropoffStop || b.destination}</strong>
            </span>
          </div>
          <div className="ticket-payment">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {b.paymentStatus} · {money(b.totalAmount)}
              </strong>
              <small>{b.paymentReference}</small>
            </div>
          </div>
        </div>
        <div className="ticket-stub">
          <span className="eyebrow">BOARDING PASS</span>
          {qr && (
            <img
              src={qr}
              alt={"QR code for " + b.reference}
              width="145"
              height="145"
            />
          )}
          <strong>{b.reference}</strong>
          <small>
            Please arrive 15 minutes
            <br />
            before your departure.
          </small>
          <span className="seat-stub">{b.seat}</span>
        </div>
      </article>
      <div className="ticket-actions">
        <button className="btn" onClick={download} disabled={!qr}>
          <Download size={18} />
          Download ticket
        </button>
        <button className="btn secondary" onClick={() => window.print()}>
          <Printer size={18} />
          Print / Save PDF
        </button>
        {b.status === "CONFIRMED" && b.tripStatus !== "CANCELLED" && (
          <Link className="btn secondary" to={"/track?trip=" + b.tripId}>
            <Navigation size={18} />
            Track my bus
          </Link>
        )}
      </div>
      <p className="subtle-note">
        The download is a portable HTML boarding pass. Open it in any browser to
        print or save as PDF.
      </p>
      <Link className="text-link" to="/my-bookings">
        Back to my journeys
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
