import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Navigation, Clock, Radio, MapPin, ArrowRight } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Booking, Trip, Page, Tracking as TrackingData, Stop } from "../types";
import {
  Badge,
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  Spinner,
  dateTime,
  clockTime,
} from "../components/UI";
import RouteMap from "../components/RouteMap";
export default function Tracking({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const { user, can, toast } = useApp();
  const operational =
    dashboard || user?.role === "DRIVER" || user?.role === "CONDUCTOR";
  const { data: bookings } = useApi<Page<Booking>>(
    operational ? null : "/bookings?size=100",
  );
  const { data: trips } = useApi<Page<Trip>>(
    operational ? "/schedules?size=100" : null,
  );
  const options = operational
    ? trips?.items
        .filter((t) => !["DRAFT", "CANCELLED"].includes(t.status))
        .map((t) => ({
          id: t.id,
          label:
            t.origin + " → " + t.destination + " · " + dateTime(t.departure),
        }))
    : [
        ...new Map(
          bookings?.items
            .filter(
              (b) => b.status === "CONFIRMED" && b.tripStatus !== "CANCELLED",
            )
            .map((b) => [
              b.tripId,
              {
                id: b.tripId,
                label:
                  b.origin +
                  " → " +
                  b.destination +
                  " · " +
                  dateTime(b.departure),
              },
            ]),
        ).values(),
      ];
  const selected = params.get("trip") || String(options?.[0]?.id || "");
  const { data, error, loading, reload } = useApi<TrackingData>(
    selected ? "/tracking/" + selected : null,
    15000,
  );
  const [status, setStatus] = useState("PUBLISHED");
  const [delay, setDelay] = useState(0);
  const [gps, setGps] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const currentBooking = bookings?.items.find(
    (b) => String(b.tripId) === String(selected),
  );
  const [pickupStop, setPickupStop] = useState("");
  const [dropoffStop, setDropoffStop] = useState("");

  useEffect(() => {
    if (currentBooking) {
      setPickupStop(currentBooking.pickupStop || currentBooking.origin);
      setDropoffStop(currentBooking.dropoffStop || currentBooking.destination);
    } else if (data?.trip) {
      setPickupStop(data.trip.origin);
      setDropoffStop(data.trip.destination);
    }
  }, [currentBooking, data?.trip]);

  async function handleUpdateStops(
    newPickup: string | null,
    newDropoff: string | null,
  ) {
    const p = newPickup || (currentBooking?.origin ?? data?.trip.origin ?? "");
    const d =
      newDropoff || (currentBooking?.destination ?? data?.trip.destination ?? "");
    setPickupStop(p);
    setDropoffStop(d);

    if (currentBooking) {
      try {
        await api(`/bookings/${currentBooking.id}/stops`, "PUT", {
          pickupStop: p,
          dropoffStop: d,
        });
        toast("Boarding & drop-off locations saved to your ticket.");
      } catch (e) {
        toast("Failed to update stops: " + (e as Error).message, "error");
      }
    } else {
      toast(`Simulation stops set: ${p} → ${d}`);
    }
  }

  useEffect(() => {
    if (data) {
      setStatus(data.trip.status);
      setDelay(data.trip.delayMinutes);
      setGps(data.trip.gpsAvailable);
    }
  }, [
    data?.trip.id,
    data?.trip.status,
    data?.trip.delayMinutes,
    data?.trip.gpsAvailable,
  ]);
  async function update(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api("/tracking/" + selected, "PUT", {
        status,
        delayMinutes: delay,
        gpsAvailable: gps,
      });
      toast("Trip update shared with passengers.");
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [simulatedInfo, setSimulatedInfo] = useState<{
    progress: number;
    currentSpeed: number;
    approachingStop: Stop | null;
    passedStopNames: string[];
    distanceRemainingKm: number;
  } | null>(null);

  return (
    <div className={dashboard ? "" : "container page"}>
      <PageTitle
        eyebrow="YOUR JOURNEY, IN SIGHT"
        title="Stay one stop ahead."
        description="Your bus, arrival estimate and latest updates in one view."
      />
      <div className="tracking-selector">
        <Field label="Choose your journey">
          <select
            value={selected}
            onChange={(e) => setParams({ trip: e.target.value })}
          >
            {options?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <span className="subtle-note">
          <Radio size={15} />
          Refreshes every 15 seconds
        </span>
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading && selected ? (
        <Loading />
      ) : !selected ? (
        <Empty
          title="A CLEARER PICTURE OF YOUR JOURNEY"
          message="Book a ticket, then follow your bus from here."
        />
      ) : data ? (
        <>
          <div className="tracking-layout">
            <aside className="panel tracking-stops">
              <p className="eyebrow">
                ROUTE {data.trip.id.toString().padStart(3, "0")}
              </p>
              <h2>
                {data.trip.origin}
                <br />
                <span>to {data.trip.destination}</span>
              </h2>
              <Badge status={data.trip.status} />

              {(pickupStop || dropoffStop) && (
                <div className="tracking-passenger-assignment">
                  <div className="assignment-row">
                    <span className="dot emerald" />
                    <small>Boarding:</small>
                    <strong>{pickupStop || data.trip.origin}</strong>
                  </div>
                  <div className="assignment-row">
                    <span className="dot amber" />
                    <small>Drop-off:</small>
                    <strong>{dropoffStop || data.trip.destination}</strong>
                  </div>
                </div>
              )}

              <ol className="stop-list">
                {data.trip.stops.map((s, i) => {
                  const isPickup =
                    pickupStop &&
                    s.name.toLowerCase() === pickupStop.toLowerCase();
                  const isDropoff =
                    dropoffStop &&
                    s.name.toLowerCase() === dropoffStop.toLowerCase();
                  const isApproaching =
                    simulatedInfo?.approachingStop?.name.toLowerCase() ===
                    s.name.toLowerCase();
                  const isPassed =
                    simulatedInfo?.passedStopNames.some(
                      (p) => p.toLowerCase() === s.name.toLowerCase()
                    ) && !isApproaching;

                  return (
                    <li
                      key={i}
                      className={`stop-item ${isPickup ? "pickup" : ""} ${isDropoff ? "dropoff" : ""} ${isApproaching ? "approaching" : ""} ${isPassed ? "passed" : ""}`}
                      onClick={() => {
                        if (!isPickup && !isDropoff) {
                          handleUpdateStops(s.name, dropoffStop || null);
                        } else if (isPickup) {
                          handleUpdateStops(null, dropoffStop || null);
                        } else if (isDropoff) {
                          handleUpdateStops(pickupStop || null, null);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                      title="Click to assign or remove as pick-up/drop-off point"
                    >
                      <i className={isPickup ? "dot-pickup" : isDropoff ? "dot-dropoff" : isApproaching ? "dot-approaching" : ""} />
                      <div className="stop-details">
                        <div className="stop-title">
                          <strong>{s.name}</strong>
                          {isPickup && (
                            <span className="stop-badge pickup">PICKUP</span>
                          )}
                          {isDropoff && (
                            <span className="stop-badge dropoff">DROPOFF</span>
                          )}
                          {isApproaching && (
                            <span className="stop-badge approaching">APPROACHING</span>
                          )}
                          {isPassed && (
                            <span style={{ fontSize: "0.68rem", color: "#00f5a0", fontWeight: 700, marginLeft: "auto" }}>
                              ✓ PASSED
                            </span>
                          )}
                        </div>
                        <small>
                          Stop #{s.order || i + 1}
                          {s.minutesFromDeparture !== undefined &&
                            ` · +${s.minutesFromDeparture}m`}
                          {s.eta ? ` (${clockTime(s.eta)})` : ""}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <small>
                {data.trip.bus?.registration} · {data.trip.bus?.type}
              </small>
            </aside>
            <RouteMap
              tracking={data}
              pickupStop={pickupStop}
              dropoffStop={dropoffStop}
              manifest={data.manifest}
              isLive={data.isLive || data.trip.status === "IN_TRANSIT"}
              onUpdateStops={handleUpdateStops}
              onProgressUpdate={setSimulatedInfo}
            />
            <aside className="panel live-status">
              <p className="eyebrow">JOURNEY STATUS</p>
              <Badge
                status={
                  data.trip.delayMinutes > 0
                    ? "DELAYED"
                    : data.trip.status === "ARRIVED"
                      ? "ARRIVED"
                      : "ON TIME"
                }
              />
              <div className="eta-block">
                <Clock size={22} />
                <small>ESTIMATED ARRIVAL</small>
                <strong>{clockTime(data.eta)}</strong>
                <span>
                  {data.trip.delayMinutes > 0
                    ? "+" + data.trip.delayMinutes + " min behind schedule"
                    : "Following the published timetable"}
                </span>
              </div>
              <div className="summary-row">
                <span>Remaining</span>
                <strong>
                  {simulatedInfo?.distanceRemainingKm !== undefined
                    ? `${simulatedInfo.distanceRemainingKm} km`
                    : data.distanceRemainingKm === null
                      ? "—"
                      : `${data.distanceRemainingKm} km`}
                </strong>
              </div>
              <div className="summary-row">
                <span>Speed</span>
                <strong style={{ color: "#00f5a0" }}>
                  {simulatedInfo?.currentSpeed
                    ? `${simulatedInfo.currentSpeed} km/h`
                    : data.position
                      ? `${Math.round(data.position.speed)} km/h`
                      : "68 km/h"}
                </strong>
              </div>
              <div className="summary-row">
                <span>Driver</span>
                <strong>{data.trip.driver?.name || "—"}</strong>
              </div>
              <div className="tracking-footer">
                <MapPin size={17} />
                <small>
                  {data.position
                    ? "Updated " + dateTime(data.position.recordedAt)
                    : "Awaiting first GPS location"}
                </small>
              </div>
            </aside>
          </div>
          {data.gpsStatus !== "AVAILABLE" && (
            <div className="warning-banner">
              <Radio size={20} />
              <div>
                <strong>LIVE LOCATION TEMPORARILY UNAVAILABLE</strong>
                <p>
                  {data.position
                    ? "Showing last known location. We will retry automatically."
                    : "No location has been recorded yet. We will retry automatically."}
                </p>
              </div>
            </div>
          )}
          <div className="development-note">
            <Navigation size={19} />
            <p>
              {data.mode === "DEVELOPMENT_SIMULATION"
                ? "Development GPS simulation. Positions are generated by the backend and saved to MySQL."
                : "GPS provider mode."}{" "}
              The map connects route coordinates; it is not a street-navigation
              map.
            </p>
          </div>
          {(can("TRACKING") || data.trip.driver?.id === user?.id) && (
            <form className="panel tracking-controls" onSubmit={update}>
              <h3>Update this journey</h3>
              <ErrorBox message={formError} />
              <div className="form-grid three">
                <Field label="Trip status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {["PUBLISHED", "IN_TRANSIT", "ARRIVED"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Delay (minutes)">
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={delay}
                    onChange={(e) => setDelay(+e.target.value)}
                  />
                </Field>
                <Field label="GPS connection">
                  <select
                    value={String(gps)}
                    onChange={(e) => setGps(e.target.value === "true")}
                  >
                    <option value="true">Available</option>
                    <option value="false">Unavailable / last known</option>
                  </select>
                </Field>
              </div>
              <button className="btn" disabled={busy}>
                {busy ? <Spinner /> : <Radio size={17} />}Publish update
              </button>
            </form>
          )}
        </>
      ) : null}
      <Link className="text-link" to="/my-bookings">
        My journeys
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
