import { useState } from "react";
import { Plus, ArrowRight, Trash2, PenLine } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { useApp } from "../context/AppContext";
import type { Route, Stop } from "../types";
import {
  PageTitle,
  ErrorBox,
  Loading,
  Modal,
  Field,
  Spinner,
  Badge,
} from "../components/UI";
import { getRouteImage } from "../utils/routeImage";
import { RouteImageUploader } from "../components/RouteImageUploader";
export default function RoutesAdmin() {
  const { data, error, loading, reload } = useApi<Route[]>("/routes");
  const [editing, setEditing] = useState<Route | "new" | null>(null);
  const { toast } = useApp();
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS / NETWORK"
        title="Make the connection."
        description="Define routes, stop coordinates and the expected time at every stop."
      >
        <button className="btn" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Create route
        </button>
      </PageTitle>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="route-page-grid">
          {data?.map((r) => {
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
                  <div className="panel-heading">
                    <Badge status={r.active ? "ACTIVE" : "INACTIVE"} />
                    <button
                      className="icon-button"
                      onClick={() => setEditing(r)}
                      aria-label={"Edit " + r.name}
                    >
                      <PenLine size={17} />
                    </button>
                  </div>
                  <h2>
                    {r.origin}
                    <ArrowRight size={20} />
                    {r.destination}
                  </h2>
                  <p>
                    {r.name} · {r.distanceKm} km
                  </p>
                  <ol className="stop-list">
                    {r.stops.map((s, i) => (
                      <li key={i}>
                        <i />
                        <div>
                          <strong>{s.name}</strong>
                          <small>
                            +{s.minutesFromDeparture} min · {s.latitude.toFixed(3)},{" "}
                            {s.longitude.toFixed(3)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editing && (
        <RouteEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            toast("Route saved with its ordered stops.");
          }}
        />
      )}
    </>
  );
}
function RouteEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Route | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const r = value === "new" ? null : value;
  const [name, setName] = useState(r?.name || "");
  const [origin, setOrigin] = useState(r?.origin || "");
  const [destination, setDestination] = useState(r?.destination || "");
  const [distanceKm, setDistance] = useState(r?.distanceKm || 100);
  const [active, setActive] = useState(r?.active ?? true);
  const [stops, setStops] = useState<Stop[]>(
    r?.stops || [
      {
        name: "",
        latitude: 6.9271,
        longitude: 79.8612,
        minutesFromDeparture: 0,
      },
      {
        name: "",
        latitude: 7.2906,
        longitude: 80.6337,
        minutesFromDeparture: 180,
      },
    ],
  );
  const [imageUrl, setImageUrl] = useState(r && typeof r === "object" ? r.imageUrl || "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function change(i: number, k: keyof Stop, v: string | number) {
    setStops((s) => s.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/routes" + (r && typeof r === "object" ? "/" + r.id : ""), r && typeof r === "object" ? "PUT" : "POST", {
        name,
        origin,
        destination,
        distanceKm,
        active,
        imageUrl: imageUrl || undefined,
        stops,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={r ? "Edit route" : "Create route"} onClose={onClose} wide>
      <form onSubmit={save}>
        <ErrorBox message={error} />
        {r && (
          <p className="subtle-note">
            Routes already used by trips are protected. Create a new route
            version to change them.
          </p>
        )}
        <Field label="Route name">
          <input
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Origin">
            <input
              required
              value={origin}
              onChange={(e) => {
                setOrigin(e.target.value);
                change(0, "name", e.target.value);
              }}
            />
          </Field>
          <Field label="Destination">
            <input
              required
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                change(stops.length - 1, "name", e.target.value);
              }}
            />
          </Field>
          <Field label="Distance (km)">
            <input
              type="number"
              required
              min={1}
              step="0.1"
              value={distanceKm}
              onChange={(e) => setDistance(+e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select
              value={String(active)}
              onChange={(e) => setActive(e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </div>
        <div style={{ margin: "16px 0 20px" }}>
          <RouteImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            label="Route Background Photo (Auto-Optimized WebP)"
          />
        </div>
        <h3>Stops in travel order</h3>
        <div className="stop-editor">
          {stops.map((s, i) => (
            <div key={i}>
              <span className="stop-number">{i + 1}</span>
              <Field label="Stop name">
                <input
                  required
                  value={s.name}
                  onChange={(e) => change(i, "name", e.target.value)}
                />
              </Field>
              <Field label="Latitude">
                <input
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  required
                  value={s.latitude}
                  onChange={(e) => change(i, "latitude", +e.target.value)}
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  required
                  value={s.longitude}
                  onChange={(e) => change(i, "longitude", +e.target.value)}
                />
              </Field>
              <Field label="Minutes from start">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  required
                  value={s.minutesFromDeparture}
                  onChange={(e) =>
                    change(i, "minutesFromDeparture", +e.target.value)
                  }
                />
              </Field>
              <button
                type="button"
                className="icon-button"
                disabled={
                  stops.length <= 2 || i === 0 || i === stops.length - 1
                }
                onClick={() => setStops((x) => x.filter((_, n) => n !== i))}
                aria-label={"Remove stop " + (i + 1)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setStops((x) => [
              ...x.slice(0, -1),
              {
                name: "",
                latitude: 0,
                longitude: 0,
                minutesFromDeparture: Math.max(
                  1,
                  (x.at(-1)?.minutesFromDeparture || 120) - 30,
                ),
              },
              x.at(-1)!,
            ])
          }
        >
          <Plus size={17} />
          Add intermediate stop
        </button>
        <div className="form-actions">
          <button className="btn" disabled={busy}>
            {busy ? <Spinner /> : null}Save route
          </button>
        </div>
      </form>
    </Modal>
  );
}
