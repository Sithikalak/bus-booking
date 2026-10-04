import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Check,
  CreditCard,
  Armchair,
  MapPin,
  Clock,
  Sparkles,
  Navigation,
  Compass,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api, ApiError } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Trip, Seat, Hold, Booking as BookingType, Stop } from "../types";
import {
  Badge,
  ErrorBox,
  Field,
  Loading,
  Spinner,
  money,
  dateTime,
  clockTime,
} from "../components/UI";
import SeatCabin from "../components/SeatCabin";
import BusInteriorScene from "../three/BusInteriorScene";
import { validCard, validExpiry, mockCardToken } from "../services/payment";
import SearchableSelect from "../components/SearchableSelect";

function calculateSegmentFare(
  baseFare: number,
  stops: Stop[],
  pickup: string,
  dropoff: string,
): number {
  if (!stops || stops.length < 2) return baseFare;
  const pIdx = stops.findIndex(
    (s) => s.name.toLowerCase() === (pickup || "").trim().toLowerCase(),
  );
  const dIdx = stops.findIndex(
    (s) => s.name.toLowerCase() === (dropoff || "").trim().toLowerCase(),
  );
  if (pIdx === -1 || dIdx === -1 || pIdx >= dIdx) return baseFare;
  if (pIdx === 0 && dIdx === stops.length - 1) return baseFare;

  const pMin = stops[pIdx].minutesFromDeparture ?? pIdx * 8;
  const dMin = stops[dIdx].minutesFromDeparture ?? dIdx * 8;
  const totalMin =
    (stops[stops.length - 1].minutesFromDeparture ?? (stops.length - 1) * 8) -
    (stops[0].minutesFromDeparture ?? 0);

  const ratio = Math.max(
    0.15,
    Math.min(1.0, (dMin - pMin) / Math.max(1, totalMin)),
  );
  const rounded = Math.round((baseFare * ratio) / 50) * 50;
  return Math.max(300, Math.min(baseFare, rounded));
}

export default function Booking() {
  const { tripId } = useParams();
  const { user, toast } = useApp();
  const navigate = useNavigate();
  const { data: trip, error: tripError } = useApi<Trip>("/trips/" + tripId);
  const {
    data: inventory,
    error: seatError,
    reload,
  } = useApi<{ seats: Seat[]; serverTime: string }>(
    "/trips/" + tripId + "/seats",
    5000,
  );
  const [holds, setHolds] = useState<Hold[]>([]);
  const [viewMode, setViewMode] = useState<"3D" | "2D">("3D");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(600);
  const [passengerName, setName] = useState(
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
  );
  const [passengerPhone, setPhone] = useState(user?.phone || "");
  const [pickupStop, setPickupStop] = useState("");
  const [dropoffStop, setDropoffStop] = useState("");

  const [method, setMethod] = useState("CARD");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const warned = useRef(false);
  const expired = useRef(false);

  const selectedSeatIds = useMemo(() => holds.map((h) => h.seatId), [holds]);
  const selectedSeatNumbers = useMemo(
    () => holds.map((h) => h.seatNumber).join(", "),
    [holds],
  );

  useEffect(() => {
    const savedList = sessionStorage.getItem("citylink-holds-" + tripId);
    const single = sessionStorage.getItem("citylink-hold-" + tripId);
    const tokens: string[] = [];
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        if (Array.isArray(parsed)) tokens.push(...parsed);
      } catch {}
    }
    if (single && !tokens.includes(single)) tokens.push(single);

    if (tokens.length > 0) {
      Promise.all(tokens.map((tok) => api<Hold>("/holds/" + tok).catch(() => null)))
        .then((results) => {
          const valid = results.filter(Boolean) as Hold[];
          setHolds(valid);
          if (valid.length === 0) {
            sessionStorage.removeItem("citylink-holds-" + tripId);
            sessionStorage.removeItem("citylink-hold-" + tripId);
          }
        });
    }
  }, [tripId]);

  useEffect(() => {
    if (trip?.stops && trip.stops.length > 0) {
      if (!pickupStop) setPickupStop(trip.stops[0].name);
      if (!dropoffStop) setDropoffStop(trip.stops[trip.stops.length - 1].name);
    }
  }, [trip, pickupStop, dropoffStop]);

  const dynamicFare = useMemo(() => {
    if (!trip) return 0;
    return calculateSegmentFare(
      trip.fare,
      trip.stops || [],
      pickupStop || trip.origin,
      dropoffStop || trip.destination,
    );
  }, [trip, pickupStop, dropoffStop]);

  const seatCount = Math.max(1, holds.length);
  const totalFare = dynamicFare * seatCount;

  useEffect(() => {
    if (holds.length === 0) return;
    const earliestHold = holds.reduce((prev, curr) =>
      new Date(curr.expiresAt).getTime() < new Date(prev.expiresAt).getTime()
        ? curr
        : prev,
    );
    const offset = new Date(earliestHold.serverTime).getTime() - Date.now();
    warned.current = false;
    expired.current = false;
    const tick = () => {
      const value = Math.max(
        0,
        Math.ceil(
          (new Date(earliestHold.expiresAt).getTime() - (Date.now() + offset)) / 1000,
        ),
      );
      setSeconds(value);
      if (value <= 60 && value > 0 && !warned.current) {
        warned.current = true;
        toast("Your seat hold expires in less than one minute.", "info");
      }
      if (value === 0 && !expired.current) {
        expired.current = true;
        setHolds([]);
        setStep(1);
        sessionStorage.removeItem("citylink-holds-" + tripId);
        sessionStorage.removeItem("citylink-hold-" + tripId);
        reload();
        toast("Your seat holds expired. Please choose seats again.", "info");
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [holds, tripId, reload, toast]);

  async function select(seat: Seat) {
    if (user?.role !== "PASSENGER") {
      setError("Use a passenger account to reserve a seat.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const existing = holds.find((h) => h.seatId === seat.id);
      if (existing) {
        await api("/holds/" + existing.holdToken, "DELETE");
        const remaining = holds.filter((h) => h.seatId !== seat.id);
        setHolds(remaining);
        const tokens = remaining.map((h) => h.holdToken);
        if (tokens.length > 0) {
          sessionStorage.setItem("citylink-holds-" + tripId, JSON.stringify(tokens));
        } else {
          sessionStorage.removeItem("citylink-holds-" + tripId);
          sessionStorage.removeItem("citylink-hold-" + tripId);
        }
      } else {
        const h = await api<Hold>("/trips/" + tripId + "/holds", "POST", {
          seatId: seat.id,
        });
        const updated = [...holds, h];
        setHolds(updated);
        setKey(crypto.randomUUID());
        const tokens = updated.map((item) => item.holdToken);
        sessionStorage.setItem("citylink-holds-" + tripId, JSON.stringify(tokens));
      }
      reload();
    } catch (e) {
      setError((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    if (holds.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(
        holds.map((h) => api("/holds/" + h.holdToken, "DELETE").catch(() => {})),
      );
      setHolds([]);
      setStep(1);
      sessionStorage.removeItem("citylink-holds-" + tripId);
      sessionStorage.removeItem("citylink-hold-" + tripId);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (holds.length === 0 || !trip) return;
    setError("");
    setBusy(true);
    try {
      let paymentToken = "mock_success";
      if (method === "CARD") {
        if (!validCard(card))
          throw new Error("Enter a valid test-card number.");
        if (!validExpiry(expiry))
          throw new Error("Use a valid future expiry in MM/YY format.");
        if (!/^\d{3,4}$/.test(cvv) || !holder.trim())
          throw new Error(
            "Enter the test-card holder and a 3–4 digit security code.",
          );
        paymentToken = mockCardToken(card);
      }
      const result = await api<{
        status: string;
        booking: BookingType | null;
        message: string;
      }>("/payments/checkout", "POST", {
        holdToken: holds[0]?.holdToken || "",
        holdTokens: holds.map((h) => h.holdToken),
        passengerName,
        passengerPhone,
        method,
        paymentToken,
        pickupStop: pickupStop || trip.origin,
        dropoffStop: dropoffStop || trip.destination,
        fare: dynamicFare,
        idempotencyKey: key,
      });
      if (result.status === "SUCCEEDED" && result.booking) {
        sessionStorage.removeItem("citylink-holds-" + tripId);
        sessionStorage.removeItem("citylink-hold-" + tripId);
        toast("Booking confirmed. Your journey is ready.");
        navigate("/ticket/" + result.booking.id + "?confirmed=1");
      } else {
        setError(result.message);
        setKey(crypto.randomUUID());
      }
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof ApiError &&
        ["HOLD_EXPIRED", "NOT_FOUND", "TRIP_UNAVAILABLE"].includes(e.code)
      ) {
        setHolds([]);
        setStep(1);
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!trip)
    return (
      <div className="container page">
        <ErrorBox message={tripError} />
        {!tripError && <Loading />}
      </div>
    );

  const stops = trip.stops || [];
  const currentPickupIndex = stops.findIndex((s) => s.name === pickupStop);
  const availableDropoffs = stops.filter((_, idx) =>
    currentPickupIndex >= 0 ? idx > currentPickupIndex : idx > 0,
  );

  return (
    <div className="container page booking-page">
      <Link className="back-link" to="/search">
        <ArrowLeft size={16} />
        Back to journeys
      </Link>
      <div className="booking-heading">
        <div>
          <p className="eyebrow">MAKE THIS JOURNEY YOURS</p>
          <h1>
            {pickupStop || trip.origin}
            <span> → </span>
            {dropoffStop || trip.destination}
          </h1>
          <p>
            {trip.origin} to {trip.destination} · {dateTime(trip.departure)} ·{" "}
            {trip.bus?.model} · {trip.bus?.registration}
          </p>
        </div>
        <Badge status={trip.status} />
      </div>

      {trip && (trip.crewOnline === false || (trip.driver && trip.driver.online === false) || (trip.conductor && trip.conductor.online === false)) && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          color: '#fca5a5',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <strong style={{ color: '#ef4444', fontSize: '0.95rem', display: 'block' }}>
              Schedule Unavailable: Assigned Crew is Offline
            </strong>
            <span style={{ fontSize: '0.85rem' }}>
              The assigned driver or conductor for this journey is currently marked offline. Online seat booking is disabled until the crew switches to Online status.
            </span>
          </div>
        </div>
      )}

      <ol className="checkout-steps">
        {["Seat", "Stops", "Passenger", "Payment"].map((s, i) => (
          <li
            className={i + 1 < step ? "complete" : i + 1 === step ? "active" : ""}
            key={s}
          >
            <span>{i + 1 < step ? <Check size={14} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <ErrorBox message={error || seatError} />

      <div className="booking-layout">
        <section className="booking-workspace">
          {step === 1 ? (
            <>
              <div
                className="workspace-heading"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div>
                  <h2>Select your seats.</h2>
                  <p>
                    {holds.length > 0
                      ? `${holds.length} ${
                          holds.length === 1 ? "seat" : "seats"
                        } selected (${selectedSeatNumbers}). Click any seat to add or remove.`
                      : "Choose one or more seats. We'll hold them for 10 minutes while you check out."}
                  </p>
                </div>
                <div className="cabin-view-toggle">
                  <button
                    type="button"
                    className={`toggle-tab ${viewMode === "3D" ? "active" : ""}`}
                    onClick={() => setViewMode("3D")}
                    aria-label="3D Interactive Cabin View"
                  >
                    <Compass size={14} />
                    3D Interactive Cabin
                  </button>
                  <button
                    type="button"
                    className={`toggle-tab ${viewMode === "2D" ? "active" : ""}`}
                    onClick={() => setViewMode("2D")}
                    aria-label="2D Plan View"
                  >
                    <Armchair size={14} />
                    2D Plan View
                  </button>
                </div>
              </div>

              <div className="seat-legend">
                <span>
                  <i />
                  Available
                </span>
                <span>
                  <i className="selected" />
                  Selected ({holds.length})
                </span>
                <span>
                  <i className="held" />
                  Held
                </span>
                <span>
                  <i className="booked" />
                  Booked
                </span>
              </div>

              {inventory ? (
                viewMode === "3D" ? (
                  <BusInteriorScene
                    seats={inventory.seats}
                    selectedSeatIds={selectedSeatIds}
                    onToggleSeat={select}
                    busy={busy}
                  />
                ) : (
                  <SeatCabin
                    seats={inventory.seats}
                    selected={selectedSeatIds}
                    busy={busy}
                    onSelect={select}
                  />
                )
              ) : (
                <Loading />
              )}
            </>
          ) : step === 2 ? (
            <div className="panel stops-selection-panel">
              <p className="eyebrow">CUSTOMIZE YOUR BOARDING & DROP-OFF</p>
              <h2>Select your stops.</h2>
              <p>
                CityLink buses stop at key locations along the route. Select
                your exact pickup and drop-off points to calculate your fare.
              </p>

              <div className="stops-select-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>
                <SearchableSelect
                  label="Boarding / Pickup Stop"
                  hint="Where you will get on the bus"
                  placeholder="Type to search pickup stop..."
                  icon={<MapPin size={13} color="#00f5a0" />}
                  value={pickupStop}
                  onChange={(newPickup) => {
                    setPickupStop(newPickup);
                    const pIdx = stops.findIndex((s) => s.name === newPickup);
                    const dIdx = stops.findIndex((s) => s.name === dropoffStop);
                    if (pIdx >= dIdx && stops.length > pIdx + 1) {
                      setDropoffStop(stops[stops.length - 1].name);
                    }
                  }}
                  options={stops.slice(0, stops.length - 1).map((s, idx) => ({
                    value: s.name,
                    label: `${idx + 1}. ${s.name}`,
                    sublabel: s.minutesFromDeparture !== undefined ? `+${s.minutesFromDeparture}m` : undefined,
                  }))}
                />

                <SearchableSelect
                  label="Drop-off / Destination Stop"
                  hint="Where you will get off"
                  placeholder="Type to search drop-off stop..."
                  icon={<Navigation size={13} color="#f59e0b" />}
                  value={dropoffStop}
                  onChange={(newDropoff) => setDropoffStop(newDropoff)}
                  options={availableDropoffs.map((s) => ({
                    value: s.name,
                    label: s.name,
                    sublabel: s.minutesFromDeparture !== undefined ? `+${s.minutesFromDeparture}m` : undefined,
                  }))}
                />
              </div>

              <div className="segment-fare-card">
                <div className="segment-fare-info">
                  <div className="fare-tag">
                    <Sparkles size={16} />
                    <span>Calculated Segment Fare</span>
                  </div>
                  <h3>{money(dynamicFare)}</h3>
                  <p>
                    {pickupStop} to {dropoffStop} · Full route is {money(trip.fare)}
                  </p>
                </div>
                <div className="segment-fare-route">
                  <div className="route-point">
                    <MapPin size={16} className="text-emerald" />
                    <strong>{pickupStop}</strong>
                  </div>
                  <div className="route-connector">
                    <span />
                  </div>
                  <div className="route-point">
                    <Navigation size={16} className="text-amber" />
                    <strong>{dropoffStop}</strong>
                  </div>
                </div>
              </div>



              <div className="form-actions">
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} />
                  Back to seats
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setStep(3)}
                >
                  Continue to passenger
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : step === 3 ? (
            <form
              className="panel passenger-form"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(4);
              }}
            >
              <p className="eyebrow">THE PERSON BEHIND THE JOURNEY</p>
              <h2>Passenger details.</h2>
              <p>These details appear on your boarding pass.</p>
              <Field label="Full name">
                <input
                  required
                  maxLength={160}
                  autoComplete="name"
                  value={passengerName}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Mobile number">
                <input
                  required
                  type="tel"
                  pattern="[+0-9 ()\-]{8,24}"
                  value={passengerPhone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <div className="form-actions">
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft size={16} />
                  Back to stops
                </button>
                <button className="btn" disabled={holds.length === 0}>
                  Continue to payment
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          ) : (
            <form className="panel payment-form" onSubmit={pay}>
              <p className="eyebrow">ONE LAST STEP</p>
              <h2>Ready when you are.</h2>
              <div className="development-note">
                <ShieldCheck size={20} />
                <div>
                  <strong>Development payment gateway</strong>
                  <p>No real money is charged. Use test details only.</p>
                </div>
              </div>
              <div className="payment-methods">
                <button
                  type="button"
                  className={method === "CARD" ? "selected" : ""}
                  onClick={() => {
                    setMethod("CARD");
                    setKey(crypto.randomUUID());
                  }}
                >
                  <CreditCard size={22} />
                  Test card
                </button>
                <button
                  type="button"
                  className={method === "MOCK_ONLINE" ? "selected" : ""}
                  onClick={() => {
                    setMethod("MOCK_ONLINE");
                    setKey(crypto.randomUUID());
                  }}
                >
                  <ShieldCheck size={22} />
                  Mock online
                </button>
              </div>
              {method === "CARD" && (
                <>
                  <Field label="Cardholder name">
                    <input
                      required
                      value={holder}
                      onChange={(e) => setHolder(e.target.value)}
                      placeholder="TEST PASSENGER"
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    label="Test card number"
                    hint="Success: 4242 4242 4242 4242 · Decline: 4000 0000 0000 0002"
                  >
                    <input
                      required
                      inputMode="numeric"
                      value={card}
                      maxLength={23}
                      onChange={(e) => {
                        setCard(e.target.value);
                        setKey(crypto.randomUUID());
                      }}
                      placeholder="4242 4242 4242 4242"
                      autoComplete="off"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Expiry (MM/YY)">
                      <input
                        required
                        maxLength={5}
                        placeholder="12/30"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Test CVV">
                      <input
                        required
                        inputMode="numeric"
                        type="password"
                        maxLength={4}
                        placeholder="123"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                </>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setStep(3)}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button className="btn" disabled={busy || holds.length === 0}>
                  {busy ? <Spinner /> : <ShieldCheck size={18} />}Pay{" "}
                  {money(totalFare)}
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="booking-summary panel">
          <p className="eyebrow">YOUR JOURNEY AT A GLANCE</p>
          <div className="summary-route">
            <div>
              <i style={{ background: "var(--color-emerald, #10b981)" }} />
              <strong>{pickupStop || trip.origin}</strong>
              <small>Pickup Stop</small>
            </div>
            <div>
              <i style={{ background: "var(--color-amber, #f59e0b)" }} />
              <strong>{dropoffStop || trip.destination}</strong>
              <small>Drop-off Stop</small>
            </div>
          </div>
          <div className="summary-row">
            <span>Route</span>
            <strong>
              {trip.origin} → {trip.destination}
            </strong>
          </div>
          <div className="summary-row">
            <span>Departure Time</span>
            <strong style={{ color: "var(--accent, #00d2ff)" }}>
              {clockTime(trip.departure)}
            </strong>
          </div>
          <div className="summary-row">
            <span>Departure Date</span>
            <strong>{dateTime(trip.departure).split(",")[0]}</strong>
          </div>
          <div className="summary-row">
            <span>Coach</span>
            <strong>{trip.bus?.registration}</strong>
          </div>
          <div className="summary-row">
            <span>Seat</span>
            <strong>
              {holds.length > 0 ? selectedSeatNumbers : "Choose your seat(s)"}
            </strong>
          </div>
          <div className="summary-row">
            <span>Passengers</span>
            <strong>
              {seatCount} {seatCount === 1 ? "adult" : "adults"}
            </strong>
          </div>
          <div className="summary-total">
            <span>
              Total fare
              <small>
                {holds.length > 1
                  ? `${holds.length} seats × ${money(dynamicFare)}`
                  : pickupStop &&
                    dropoffStop &&
                    (pickupStop !== trip.origin || dropoffStop !== trip.destination)
                  ? "Segment rate"
                  : "Standard fare"}
              </small>
            </span>
            <strong>{money(totalFare)}</strong>
          </div>
          {holds.length > 0 ? (
            <>
              <div className={"hold-timer " + (seconds <= 60 ? "urgent" : "")}>
                <div
                  className="timer-ring"
                  style={
                    {
                      "--progress": (seconds / 600) * 360 + "deg",
                    } as React.CSSProperties
                  }
                >
                  <span>
                    {Math.floor(seconds / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(seconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <strong>{holds.length > 1 ? `${holds.length} seats held.` : "Your seat is held."}</strong>
                  <small>
                    Complete checkout before
                    <br />
                    the timer runs out.
                  </small>
                </div>
              </div>
              {step === 1 && (
                <button
                  className="btn full"
                  disabled={busy}
                  onClick={() => setStep(2)}
                >
                  Continue to stops
                  <ArrowRight size={18} />
                </button>
              )}
              <button
                className="text-button full"
                disabled={busy}
                onClick={release}
              >
                Release {holds.length > 1 ? "seats" : "seat"} & start again
              </button>
            </>
          ) : (
            <div className="seat-prompt">
              <Armchair size={25} />
              <p>
                A little space for your next adventure.
                <br />
                Select one or more available seats to continue.
              </p>
            </div>
          )}
          <span className="subtle-note">
            <ShieldCheck size={14} />
            Protected checkout · server-verified holds
          </span>
        </aside>
      </div>
    </div>
  );
}
