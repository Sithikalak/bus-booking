import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowLeftRight, MapPin, CalendarDays, Clock } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { query } from "../api/client";
import type { Route } from "../types";
import { today } from "./UI";
import SearchableSelect from "./SearchableSelect";

export default function SearchForm({ compact = false }: { compact?: boolean }) {
  const [params] = useSearchParams();
  const [origin, setOrigin] = useState(params.get("origin") || "");
  const [destination, setDestination] = useState(
    params.get("destination") || "",
  );
  const [date, setDate] = useState(params.get("date") || "");
  const [time, setTime] = useState(params.get("time") || "");
  const { data: routes } = useApi<Route[]>("/routes");
  const navigate = useNavigate();

  const cities = [
    ...new Set(routes?.flatMap((r) => [r.origin, r.destination])),
  ].filter(Boolean) as string[];

  return (
    <form
      className={"search-form " + (compact ? "compact" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        navigate("/search?" + query({ origin, destination, date, time }));
      }}
      style={{ alignItems: "flex-end" }}
    >
      <div style={{ flex: "1.2 1 210px", minWidth: "200px" }}>
        <SearchableSelect
          label="FROM"
          placeholder="Choose origin (type to search)..."
          icon={<MapPin size={13} />}
          value={origin}
          onChange={setOrigin}
          options={cities.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <button
        className="swap"
        type="button"
        aria-label="Swap origin and destination"
        onClick={() => {
          setOrigin(destination);
          setDestination(origin);
        }}
        style={{ marginBottom: "6px" }}
      >
        <ArrowLeftRight size={17} />
      </button>

      <div style={{ flex: "1.2 1 210px", minWidth: "200px" }}>
        <SearchableSelect
          label="TO"
          placeholder="Choose destination (type to search)..."
          icon={<MapPin size={13} />}
          value={destination}
          onChange={setDestination}
          options={cities
            .filter((c) => c !== origin)
            .map((c) => ({ value: c, label: c }))}
        />
      </div>

      <label style={{ flex: "1 1 170px", minWidth: "165px" }}>
        <span>
          <CalendarDays size={13} /> DEPARTURE DATE
        </span>
        <input
          aria-label="Departure date"
          type="date"
          min={today()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label style={{ flex: "1 1 150px", minWidth: "145px" }}>
        <span>
          <Clock size={13} /> DEPARTURE TIME
        </span>
        <input
          aria-label="Earliest departure time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>

      <button className="btn search-btn-premium" type="submit" style={{ height: "52px", minHeight: "52px", marginBottom: "0" }}>
        Find my journey
        <ArrowRight size={19} />
      </button>
    </form>
  );
}
