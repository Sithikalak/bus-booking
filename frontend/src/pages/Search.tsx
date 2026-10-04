import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Wifi,
  Plug,
  Armchair,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import SearchForm from "../components/SearchForm";
import { getRouteImage } from "../utils/routeImage";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
  money,
  clockTime,
  dateTime,
} from "../components/UI";
import type { Page, Trip, Route } from "../types";
export default function Search() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("departure");
  const query = params.toString();
  useEffect(() => setPage(0), [query]);
  const { data, error, loading, reload } = useApi<Page<Trip>>(
    "/trips?" + params.toString() + "&page=" + page + "&size=8",
  );
  const items = data?.items
    ?.filter((t) => {
      // Driver and Conductor offline nam Schedule penna epa
      if (t.crewOnline === false) return false;
      if (t.driver && t.driver.online === false) return false;
      if (t.conductor && t.conductor.online === false) return false;
      return true;
    })
    .slice()
    .sort((a, b) =>
      sort === "fare"
        ? a.fare - b.fare
        : a.departure.localeCompare(b.departure),
    );
  return (
    <div className="container page">
      <PageTitle
        eyebrow="FIND YOUR CONNECTION"
        title="Where to next?"
        description="A better journey begins with a little choice."
      />
      <SearchForm key={params.toString()} compact />
      <div className="results-toolbar">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <strong>{items?.length ?? 0}</strong> {items?.length === 1 ? "journey" : "journeys"} available
          {params.get("date") ? ` on ${params.get("date")}` : ""}
          {params.get("time") ? (
            <span style={{ color: "var(--accent, #00d2ff)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              • <Clock size={13} /> Departs after {params.get("time")}
            </span>
          ) : ""}
        </span>
        <label>
          <SlidersHorizontal size={16} />
          <select
            aria-label="Sort this page"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="departure">Departure time</option>
            <option value="fare">Lowest fare on this page</option>
          </select>
        </label>
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : !items?.length && !error ? (
        <Empty
          title="NO JOURNEYS FOUND"
          message="No active journeys with online crew found. Please try another date or corridor."
          to="/search"
          action="Clear search"
        />
      ) : (
        <div className="trip-list">
          {items?.map((t) => (
            <article className="trip-card" key={t.id}>
              <div className="trip-brand">
                <span className="tiny">CITYLINK EXPRESS</span>
                <Badge status={t.bus?.type || "PREMIUM"} />
                <Badge status={t.status} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                  🟢 Crew Online
                </span>
                <span className="departure-time-badge">
                  <Clock size={12} />
                  Departs at {clockTime(t.departure)}
                </span>
                <small>
                  {t.bus?.registration} · {dateTime(t.departure).split(",")[0]}
                </small>
              </div>
              <div className="trip-times">
                <div className="trip-time-block departure-block">
                  <span className="time-sublabel departure">
                    <Clock size={11} /> DEPARTURE TIME
                  </span>
                  <strong>{clockTime(t.departure)}</strong>
                  <span>{t.origin}</span>
                </div>
                <div className="journey-line">
                  <span>
                    {Math.floor(t.durationMinutes / 60)}h{" "}
                    {t.durationMinutes % 60}m
                  </span>
                  <div>
                    <i />
                    <b />
                    <ArrowRight size={14} />
                  </div>
                  <small>{t.stops.length} stops</small>
                </div>
                <div className="trip-time-block arrival-block">
                  <span className="time-sublabel arrival">
                    <Clock size={11} /> ARRIVAL TIME
                  </span>
                  <strong>{clockTime(t.arrival)}</strong>
                  <span>{t.destination}</span>
                </div>
              </div>
              <div className="trip-features">
                {/wi[ -]?fi/i.test(t.bus?.features || "") && (
                  <span>
                    <Wifi size={15} />
                    Wi-Fi
                  </span>
                )}
                {/usb/i.test(t.bus?.features || "") && (
                  <span>
                    <Plug size={15} />
                    USB
                  </span>
                )}
                <span>
                  <Armchair size={15} />
                  {t.availableSeats} seats left
                </span>
              </div>
              <div className="trip-price">
                <div className="trip-price-departure-hint">
                  <Clock size={12} />
                  <span>Departs: <strong>{clockTime(t.departure)}</strong></span>
                </div>
                <small>PER PASSENGER</small>
                <strong>{money(t.fare)}</strong>
                <Link
                  className={"btn " + (!t.availableSeats ? "disabled" : "")}
                  to={"/booking/" + t.id}
                >
                  Choose seats
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && (
        <Pagination
          page={page}
          size={8}
          total={data.total}
          onChange={setPage}
        />
      )}
      <p className="subtle-note">
        <Clock size={15} />
        Timetables are shown in Sri Lanka time. Fares include the full journey.
      </p>
    </div>
  );
}
export function RoutesPage() {
  const { data, error, loading, reload } = useApi<Route[]>("/routes");
  return (
    <div className="container page">
      <PageTitle
        eyebrow="A NETWORK OF POSSIBILITIES"
        title="Find your connection."
        description="From the coast to the hill country. See every stop along the way."
      />
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="route-page-grid">
          {data
            ?.filter((r) => r.active)
            .map((r) => {
              const bgImg = getRouteImage(r);
              return (
                <article className="panel route-panel route-panel-with-bg" key={r.id}>
                  <div className="route-panel-bg-wrap" aria-hidden="true">
                    <img
                      src={bgImg}
                      alt={`${r.origin} to ${r.destination}`}
                      className="route-panel-bg-img"
                      loading="lazy"
                    />
                    <div className="route-panel-scrim" />
                  </div>
                  <div className="route-panel-content">
                    <span className="eyebrow">
                      {r.distanceKm} KM / {r.stops.length} STOPS
                    </span>
                    <h2>
                      {r.origin}
                      <ArrowRight size={24} />
                      {r.destination}
                    </h2>
                    <p>{r.name}</p>
                    <div className="route-terminals-preview">
                      <div className="terminal-node origin">
                        <span className="terminal-dot origin" />
                        <div>
                          <small>ORIGIN TERMINUS</small>
                          <strong>{r.origin}</strong>
                        </div>
                      </div>
                      <div className="terminal-connector">
                        <span className="connector-line" />
                        <span className="route-stops-tag">{r.stops.length} stops along corridor</span>
                      </div>
                      <div className="terminal-node destination">
                        <span className="terminal-dot destination" />
                        <div>
                          <small>DESTINATION TERMINUS</small>
                          <strong>{r.destination}</strong>
                        </div>
                      </div>
                    </div>
                    <Link
                      className="btn secondary full"
                      to={
                        "/search?origin=" +
                        encodeURIComponent(r.origin) +
                        "&destination=" +
                        encodeURIComponent(r.destination)
                      }
                    >
                      Explore journeys
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </article>
              );
            })}
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={17} />;
}
