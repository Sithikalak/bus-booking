import {
  Armchair,
  Check,
  Lock,
  Clock,
  CircleGauge as SteeringWheel,
} from "lucide-react";
import type { Seat } from "../types";
export default function SeatCabin({
  seats,
  selected,
  onSelect,
  busy = false,
}: {
  seats: Seat[];
  selected?: number | number[];
  onSelect: (s: Seat) => void;
  busy?: boolean;
}) {
  const isSelected = (id: number) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id;

  return (
    <div className="cabin">
      <div className="windshield">
        <span>CITYLINK EXPRESS</span>
        <div />
      </div>
      <div className="driver-deck">
        <SteeringWheel size={34} />
        <span>FRONT</span>
        <span className="cabin-door">ENTRY ↙</span>
      </div>
      <div className="cabin-seats">
        {[...seats]
          .sort((a, b) => a.row - b.row || a.column - b.column)
          .map((s) => (
            <button
              key={s.id}
              type="button"
              title={`Seat ${s.number} · ${s.position.toLowerCase()} · ${s.type.toLowerCase()} · ${isSelected(s.id) ? "selected" : s.status.toLowerCase()}`}
              className={
                "seat " +
                (isSelected(s.id) ? "selected" : s.status.toLowerCase())
              }
              style={{
                gridColumn: s.column > 2 ? s.column + 1 : s.column,
                gridRow: s.row,
              }}
              disabled={busy || (!isSelected(s.id) && s.status !== "AVAILABLE")}
              onClick={() => onSelect(s)}
              aria-label={`Seat ${s.number}, ${s.position}, ${isSelected(s.id) ? "selected" : s.status}`}
              aria-pressed={isSelected(s.id)}
            >
              <span className="seat-back" />
              <span className="seat-cushion">
                {isSelected(s.id) ? (
                  <Check size={16} />
                ) : s.status === "BOOKED" ? (
                  <Lock size={12} />
                ) : s.status === "HELD" ? (
                  <Clock size={12} />
                ) : (
                  s.number
                )}
              </span>
              <span className="seat-number">{s.number}</span>
            </button>
          ))}
        <span
          className="aisle-text"
          style={{
            gridRow: `1 / span ${Math.max(1, ...seats.map((s) => s.row))}`,
          }}
        >
          AISLE
        </span>
      </div>
      <div className="rear-deck">
        <span>↖ EMERGENCY EXIT</span>
        <Armchair size={17} />
        <span>REAR</span>
      </div>
    </div>
  );
}
