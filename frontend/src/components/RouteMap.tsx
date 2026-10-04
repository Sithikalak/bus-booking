import { useState, useRef, useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  MapPin,
  Navigation,
  Check,
  X,
  Compass,
  Layers
} from "lucide-react";
import type { Tracking as TrackingData, Stop, ManifestStop } from "../types";

export interface RouteMapProps {
  tracking: TrackingData;
  pickupStop?: string;
  dropoffStop?: string;
  manifest?: ManifestStop[];
  isLive?: boolean;
  onUpdateStops?: (
    pickup: string | null,
    dropoff: string | null,
  ) => Promise<void> | void;
  onProgressUpdate?: (info: {
    progress: number;
    currentSpeed: number;
    approachingStop: Stop | null;
    passedStopNames: string[];
    distanceRemainingKm: number;
  }) => void;
}

export type MapLayerType = "streets" | "satellite" | "dark" | "topo";

const LAYER_CONFIGS: Record<MapLayerType, { url: string; options: L.TileLayerOptions; name: string }> = {
  streets: {
    name: "Sri Lanka Roads",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  satellite: {
    name: "Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 18,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, USGS",
    },
  },
  dark: {
    name: "Night Cockpit",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    options: {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; CARTO',
    },
  },
  topo: {
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap',
    },
  },
};

// Great-circle Haversine distance in kilometers
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing in degrees (0-360)
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function RouteMap({
  tracking,
  pickupStop,
  dropoffStop,
  manifest,
  isLive,
  onUpdateStops,
  onProgressUpdate,
}: RouteMapProps) {
  const activeManifest = manifest || tracking.manifest || [];
  const trackingLive = isLive !== undefined ? isLive : (tracking.isLive ?? tracking.trip.status === "IN_TRANSIT");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeCasingPolylineRef = useRef<L.Polyline | null>(null);
  const bookedPolylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersGroupRef = useRef<L.LayerGroup | null>(null);

  // Map layer toggle: defaults to standard Sri Lanka Roads (OpenStreetMap)
  const [mapLayer, setMapLayer] = useState<MapLayerType>("streets");

  // Real Sri Lanka road geometry fetched from OSRM
  const [realRoadCoords, setRealRoadCoords] = useState<[number, number][]>([]);
  const [loadingRoad, setLoadingRoad] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Simulation controls state: strictly disabled in standby until trip is live (started)
  const [isPlaying, setIsPlaying] = useState<boolean>(Boolean(trackingLive));
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [progress, setProgress] = useState<number>(trackingLive ? (tracking.position?.progress ?? 0) : 0);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsPlaying(Boolean(trackingLive));
    if (!trackingLive) {
      setProgress(0);
    }
  }, [trackingLive]);

  // Interactive stop card popover state
  const [activeStopCard, setActiveStopCard] = useState<{
    stop: Stop;
    index: number;
    lat: number;
    lng: number;
  } | null>(null);

  const stops = useMemo(() => tracking.trip.stops || [], [tracking.trip.stops]);

  // Fetch real road geometry from Open Source Routing Machine (OSRM)
  useEffect(() => {
    if (stops.length < 2) {
      setRealRoadCoords(stops.map((s) => [s.latitude, s.longitude]));
      return;
    }

    let active = true;
    setLoadingRoad(true);

    // Limit to at most 25 evenly spaced waypoints if there are many stops
    const sampledStops = stops.length > 25
      ? stops.filter((_, idx) => idx === 0 || idx === stops.length - 1 || idx % Math.ceil(stops.length / 25) === 0)
      : stops;

    const coordsStr = sampledStops.map((s) => `${s.longitude},${s.latitude}`).join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then((res) => {
        if (!res.ok) throw new Error("OSRM error");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length) {
          const rawCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
          );
          setRealRoadCoords(rawCoords);
        } else {
          // Fallback to stop sequence
          setRealRoadCoords(stops.map((s) => [s.latitude, s.longitude]));
        }
      })
      .catch(() => {
        if (!active) return;
        setRealRoadCoords(stops.map((s) => [s.latitude, s.longitude]));
      })
      .finally(() => {
        if (active) setLoadingRoad(false);
      });

    return () => {
      active = false;
    };
  }, [stops]);

  // Effective road coordinates (real road from OSRM, or stops fallback)
  const effectiveRoadPoints = useMemo(() => {
    if (realRoadCoords.length >= 2) return realRoadCoords;
    return stops.map((s) => [s.latitude, s.longitude] as [number, number]);
  }, [realRoadCoords, stops]);

  // Calculate cumulative distances along the REAL road
  const { totalDistanceKm, cumulativeDistances, segmentDistances } = useMemo(() => {
    if (effectiveRoadPoints.length < 2) {
      return { totalDistanceKm: 1, cumulativeDistances: [0], segmentDistances: [] };
    }
    const segs: number[] = [];
    const cum: number[] = [0];
    let total = 0;
    for (let i = 0; i < effectiveRoadPoints.length - 1; i++) {
      const d = getHaversineDistance(
        effectiveRoadPoints[i][0],
        effectiveRoadPoints[i][1],
        effectiveRoadPoints[i + 1][0],
        effectiveRoadPoints[i + 1][1]
      );
      segs.push(d);
      total += d;
      cum.push(total);
    }
    return {
      totalDistanceKm: total || 1,
      cumulativeDistances: cum,
      segmentDistances: segs,
    };
  }, [effectiveRoadPoints]);

  // Interpolate bus position, bearing, speed, and approaching stop along the REAL road
  const currentBusTelemetry = useMemo(() => {
    if (effectiveRoadPoints.length < 2) return null;

    if (!trackingLive) {
      // In Standby mode: park coach at the origin/start place
      const originCoord = effectiveRoadPoints[0];
      const startStop = stops[0] || null;
      return {
        lat: originCoord[0],
        lng: originCoord[1],
        bearing: effectiveRoadPoints.length > 1
          ? calculateBearing(effectiveRoadPoints[0][0], effectiveRoadPoints[0][1], effectiveRoadPoints[1][0], effectiveRoadPoints[1][1])
          : 0,
        segIdx: 0,
        ratio: 0,
        computedSpeed: 0,
        distToNext: segmentDistances[0] || 0,
        remainingKm: totalDistanceKm,
        passedStops: [],
        approachingStop: startStop,
      };
    }

    const currentDist = Math.max(0, Math.min(1, progress)) * totalDistanceKm;

    let segIdx = 0;
    for (let i = 0; i < cumulativeDistances.length - 1; i++) {
      if (currentDist >= cumulativeDistances[i] && currentDist <= cumulativeDistances[i + 1]) {
        segIdx = i;
        break;
      }
    }
    if (segIdx >= effectiveRoadPoints.length - 1) segIdx = effectiveRoadPoints.length - 2;

    const segStart = cumulativeDistances[segIdx];
    const segLen = segmentDistances[segIdx] || 0.001;
    const ratio = Math.max(0, Math.min(1, (currentDist - segStart) / segLen));

    const p1 = effectiveRoadPoints[segIdx];
    const p2 = effectiveRoadPoints[segIdx + 1];

    const lat = p1[0] + (p2[0] - p1[0]) * ratio;
    const lng = p1[1] + (p2[1] - p1[1]) * ratio;
    const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

    // Dynamic speed based on curves and open highway
    const distToNext = (1 - ratio) * segLen;
    let computedSpeed = 58;
    if (distToNext < 0.8 || ratio < 0.1) {
      computedSpeed = 35 + Math.round(distToNext * 25);
    } else {
      computedSpeed = 60 + Math.round(Math.sin(progress * 30) * 8);
    }

    const remainingKm = Math.max(0, totalDistanceKm - currentDist);

    // Stop index along route
    const currentStopIdx = Math.min(
      stops.length - 1,
      Math.floor(progress * stops.length)
    );
    const approachingStop = stops[Math.min(stops.length - 1, currentStopIdx + 1)] || stops[stops.length - 1] || null;

    return {
      lat,
      lng,
      bearing,
      segIdx,
      ratio,
      computedSpeed,
      distToNext,
      remainingKm,
      passedStops: stops.slice(0, currentStopIdx + 1),
      approachingStop,
    };
  }, [trackingLive, progress, effectiveRoadPoints, totalDistanceKm, cumulativeDistances, segmentDistances, stops]);

  // Forward updates to parent Tracking view
  useEffect(() => {
    if (onProgressUpdate && currentBusTelemetry) {
      onProgressUpdate({
        progress: trackingLive ? progress : 0,
        currentSpeed: currentBusTelemetry.computedSpeed,
        approachingStop: currentBusTelemetry.approachingStop,
        passedStopNames: currentBusTelemetry.passedStops.map((s) => s.name),
        distanceRemainingKm: Math.round(currentBusTelemetry.remainingKm),
      });
    }
  }, [trackingLive, progress, currentBusTelemetry, onProgressUpdate]);

  // Continuous animation loop along the road (only active when trip is started & live)
  useEffect(() => {
    if (!isPlaying || !trackingLive) {
      lastTimeRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = (time - lastTimeRef.current) / 1000;
        // 720 seconds (12 mins) traversal at 1x speed ensures smooth, calm, realistic cruising
        const increment = (delta * speedMultiplier) / 720;
        setProgress((prev) => {
          const next = prev + increment;
          if (next >= 1) return 0; // seamless continuous loop
          return next;
        });
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, trackingLive, speedMultiplier]);

  // Identify pickup & dropoff indexes
  const pickupIdx = stops.findIndex(
    (s) => s.name.toLowerCase() === (pickupStop || "").toLowerCase()
  );
  const dropoffIdx = stops.findIndex(
    (s) => s.name.toLowerCase() === (dropoffStop || "").toLowerCase()
  );

  // Status note text
  const statusNote = useMemo(() => {
    if (!currentBusTelemetry) return "Bus tracking initialized.";
    if (pickupStop && pickupIdx >= 0) {
      return `Passenger assignment: Pick-up at ${pickupStop} · Heading to ${dropoffStop || tracking.trip.destination} · ${currentBusTelemetry.computedSpeed} km/h`;
    }
    return `Express Highway Transit Active · Approaching ${currentBusTelemetry.approachingStop?.name || tracking.trip.destination} · ${currentBusTelemetry.computedSpeed} km/h`;
  }, [currentBusTelemetry, pickupStop, dropoffStop, pickupIdx, tracking.trip.destination]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Leaflet Map centered on Sri Lanka
    const map = L.map(mapContainerRef.current, {
      center: [7.8731, 80.7718],
      zoom: 8,
      zoomControl: true,
      attributionControl: false,
    });

    // Default to OpenStreetMap Roads (Shows real Sri Lanka road network, highway numbers & towns)
    const initialCfg = LAYER_CONFIGS[mapLayer] || LAYER_CONFIGS.streets;
    const tile = L.tileLayer(initialCfg.url, initialCfg.options);
    tile.addTo(map);
    activeTileLayerRef.current = tile;

    const stopGroup = L.layerGroup().addTo(map);
    stopMarkersGroupRef.current = stopGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Map Layer Switching (Streets / Satellite / Night)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    const cfg = LAYER_CONFIGS[mapLayer] || LAYER_CONFIGS.streets;
    const tile = L.tileLayer(cfg.url, cfg.options);
    tile.addTo(map);
    activeTileLayerRef.current = tile;
  }, [mapLayer]);

  // Update Route Polylines and Fit Bounds on the REAL ROAD
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || effectiveRoadPoints.length < 2) return;

    // Remove old polylines
    if (routeCasingPolylineRef.current) {
      routeCasingPolylineRef.current.remove();
      routeCasingPolylineRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (bookedPolylineRef.current) {
      bookedPolylineRef.current.remove();
      bookedPolylineRef.current = null;
    }

    // Outer Highway Road Casing (Shows the real road corridor in vivid color)
    const casingColor = mapLayer === "dark" ? "#0369a1" : "#0284c7";
    const coreColor = mapLayer === "dark" ? "#00f5a0" : "#0284c7";

    const casingLine = L.polyline(effectiveRoadPoints, {
      color: casingColor,
      weight: 7,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    routeCasingPolylineRef.current = casingLine;

    const coreLine = L.polyline(effectiveRoadPoints, {
      color: coreColor,
      weight: 3.5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    routePolylineRef.current = coreLine;

    // Booked segment highlight line (between pickup and dropoff)
    if (pickupIdx >= 0 && dropoffIdx > pickupIdx) {
      const sPickup = stops[pickupIdx];
      const sDropoff = stops[dropoffIdx];

      let startRoadIdx = 0;
      let endRoadIdx = effectiveRoadPoints.length - 1;
      let minStartDist = Infinity;
      let minEndDist = Infinity;

      effectiveRoadPoints.forEach((pt, i) => {
        const d1 = getHaversineDistance(pt[0], pt[1], sPickup.latitude, sPickup.longitude);
        const d2 = getHaversineDistance(pt[0], pt[1], sDropoff.latitude, sDropoff.longitude);
        if (d1 < minStartDist) {
          minStartDist = d1;
          startRoadIdx = i;
        }
        if (d2 < minEndDist) {
          minEndDist = d2;
          endRoadIdx = i;
        }
      });

      if (startRoadIdx < endRoadIdx) {
        const bookedSlice = effectiveRoadPoints.slice(startRoadIdx, endRoadIdx + 1);
        bookedPolylineRef.current = L.polyline(bookedSlice, {
          color: "#00f5a0",
          weight: 7,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }
    }

    // Auto fit map view to show entire route with padding
    try {
      const bounds = L.latLngBounds(effectiveRoadPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } catch (e) {
      // ignore
    }
  }, [effectiveRoadPoints, pickupIdx, dropoffIdx, mapLayer, stops]);

  // Update Stop Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = stopMarkersGroupRef.current;
    if (!map || !group || stops.length === 0) return;

    group.clearLayers();

    stops.forEach((stop, idx) => {
      const isPickup =
        pickupStop && stop.name.toLowerCase() === pickupStop.toLowerCase();
      const isDropoff =
        dropoffStop && stop.name.toLowerCase() === dropoffStop.toLowerCase();
      const isApproaching =
        currentBusTelemetry?.approachingStop?.name.toLowerCase() ===
        stop.name.toLowerCase();

      const manifestItem = activeManifest.find(
        (m) => (stop.id && m.stopId === stop.id) || m.name.toLowerCase() === stop.name.toLowerCase()
      );

      const hasPickups = (manifestItem?.pickups && manifestItem.pickups.length > 0) || isPickup;
      const hasDropoffs = (manifestItem?.dropoffs && manifestItem.dropoffs.length > 0) || isDropoff;
      const pickupCount = manifestItem?.pickupCount || (isPickup ? 1 : 0);
      const dropoffCount = manifestItem?.dropoffCount || (isDropoff ? 1 : 0);
      const pickupNames = manifestItem?.pickups?.map((p) => p.passengerName).join(", ");
      const dropoffNames = manifestItem?.dropoffs?.map((p) => p.passengerName).join(", ");

      const isPassed = trackingLive && currentBusTelemetry
        ? idx < Math.floor(progress * stops.length)
        : false;

      const hasPassengers = (pickupCount > 0 || dropoffCount > 0) || Boolean(isPickup || isDropoff);

      const pinColor = hasPassengers ? "#10b981" : "#ef4444";
      const pinStroke = hasPassengers ? "#00f5a0" : "#f87171";
      const glow = hasPassengers
        ? "drop-shadow(0 0 8px rgba(0, 245, 160, 0.6))"
        : "drop-shadow(0 0 6px rgba(239, 68, 68, 0.45))";

      let badgeHtml = "";
      if (hasPickups && hasDropoffs) {
        badgeHtml = `<div style="background:#00f5a0; color:#090d14; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; box-shadow:0 0 8px rgba(0,245,160,0.6); white-space:nowrap; margin-bottom:2px;">🟢 +${pickupCount} Pick • -${dropoffCount} Drop</div>`;
      } else if (hasPickups) {
        badgeHtml = `<div style="background:#00f5a0; color:#090d14; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; box-shadow:0 0 8px rgba(0,245,160,0.6); white-space:nowrap; margin-bottom:2px;">🟢 PICKUP (${pickupCount})</div>`;
      } else if (hasDropoffs) {
        badgeHtml = `<div style="background:#00f5a0; color:#090d14; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; box-shadow:0 0 8px rgba(0,245,160,0.6); white-space:nowrap; margin-bottom:2px;">🟢 DROP-OFF (${dropoffCount})</div>`;
      } else if (hasPassengers) {
        badgeHtml = `<div style="background:#00f5a0; color:#090d14; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; box-shadow:0 0 8px rgba(0,245,160,0.6); white-space:nowrap; margin-bottom:2px;">🟢 SELECTED STOP</div>`;
      } else {
        badgeHtml = `<div style="background:#ef4444; color:#ffffff; font-size:9.5px; font-weight:700; padding:1px 5px; border-radius:4px; box-shadow:0 0 6px rgba(239,68,68,0.5); white-space:nowrap; margin-bottom:2px;">🔴 PASS (0 PAX)</div>`;
      }

      const iconSize: [number, number] = [130, 64];
      const iconAnchor: [number, number] = [65, 40];

      const markerHtml = `
        <div class="leaflet-location-stop-pin ${hasPassengers ? 'pin-green' : 'pin-red'} ${isApproaching ? 'pin-approaching' : ''}" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; filter:${glow}; opacity:${isPassed ? '0.65' : '1'}; transition:all 0.2s ease;">
          ${badgeHtml}
          <div style="position:relative; width:26px; height:30px; display:flex; align-items:center; justify-content:center;">
            ${isApproaching ? `
              <div class="leaflet-approaching-ping" style="position:absolute; top:-4px; left:50%; transform:translateX(-50%); pointer-events:none; z-index:0;">
                <span class="ping-ring" style="border-color:${pinStroke};"></span>
              </div>
            ` : ''}
            <svg viewBox="0 0 24 24" width="26" height="30" fill="${pinColor}" stroke="${pinStroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="position:relative; z-index:1;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.8" fill="#ffffff" stroke="${pinColor}" stroke-width="1"/>
            </svg>
          </div>
          <span class="pin-label" style="background:#090d14; color:${hasPassengers ? '#f8fafc' : '#94a3b8'}; font-size:10.5px; font-weight:700; padding:2px 6px; border-radius:4px; border:1px solid ${hasPassengers ? 'rgba(0,245,160,0.5)' : 'rgba(239,68,68,0.35)'}; white-space:nowrap; max-width:125px; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">
            ${stop.name}
          </span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: markerHtml,
        iconSize,
        iconAnchor,
      });

      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: customIcon,
      });

      // Click handler to open interactive stop assignment popover
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setActiveStopCard({
          stop,
          index: idx,
          lat: stop.latitude,
          lng: stop.longitude,
        });
      });

      group.addLayer(marker);
    });
  }, [stops, pickupStop, dropoffStop, activeManifest, currentBusTelemetry?.approachingStop]);

  // Update Animated Bus Marker Position & Rotation along the real highway
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentBusTelemetry) return;

    const { lat, lng, bearing, computedSpeed } = currentBusTelemetry;

    const busHtml = `
      <div class="leaflet-bus-wrapper" style="transform: rotate(${Math.round(bearing)}deg);">
        <div class="leaflet-bus-beam"></div>
        <div class="leaflet-bus-body" style="background: #090d14; border: 2px solid #00f5a0; box-shadow: 0 0 14px rgba(0,245,160,0.6);">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#00f5a0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"/>
            <path d="M15 6v6"/>
            <path d="M2 12h19.6"/>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4C2.9 6 1.9 6.8 1.6 7.8L.2 12.8c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
            <circle cx="7" cy="18" r="2"/>
            <path d="M9 18h5"/>
            <circle cx="16" cy="18" r="2"/>
          </svg>
        </div>
        <div class="leaflet-bus-badge" style="transform: rotate(${-Math.round(bearing)}deg);">
          <span>${computedSpeed} km/h</span>
        </div>
      </div>
    `;

    const busIcon = L.divIcon({
      className: "custom-bus-marker-container",
      html: busHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (!busMarkerRef.current) {
      busMarkerRef.current = L.marker([lat, lng], {
        icon: busIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      busMarkerRef.current.setLatLng([lat, lng]);
      busMarkerRef.current.setIcon(busIcon);
    }
  }, [currentBusTelemetry]);

  // Invalidate map size on fullscreen toggle
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
    }
  }, [isFullscreen]);

  // Action Handlers for Stop Editing
  const handleSetPickup = (stopName: string) => {
    if (onUpdateStops) {
      onUpdateStops(stopName, dropoffStop || null);
    }
    setActiveStopCard(null);
  };

  const handleRemovePickup = () => {
    if (onUpdateStops) {
      onUpdateStops(null, dropoffStop || null);
    }
    setActiveStopCard(null);
  };

  const handleSetDropoff = (stopName: string) => {
    if (onUpdateStops) {
      onUpdateStops(pickupStop || null, stopName);
    }
    setActiveStopCard(null);
  };

  const handleRemoveDropoff = () => {
    if (onUpdateStops) {
      onUpdateStops(pickupStop || null, null);
    }
    setActiveStopCard(null);
  };

  // Recenter map on route bounds
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || effectiveRoadPoints.length < 2) return;
    map.fitBounds(L.latLngBounds(effectiveRoadPoints), { padding: [50, 50] });
  };

  return (
    <div className={`route-map-shell ${isFullscreen ? "map-fullscreen-active" : ""}`}>
      {/* Simulation Top Header Bar */}
      <div className="map-simulation-header">
        <div className="simulation-status">
          <span className="live-dot-pulse" />
          <div>
            <strong>REAL-TIME SRI LANKA HIGHWAY TELEMETRY</strong>
            <small>{statusNote}</small>
          </div>
        </div>

        {/* Playback Controls & Speed Multipliers */}
        <div className="simulation-toolbar">
          <button
            type="button"
            className={`btn-sim ${isPlaying && trackingLive ? "active" : ""}`}
            onClick={() => {
              if (trackingLive) {
                setIsPlaying((p) => !p);
              }
            }}
            disabled={!trackingLive}
            title={!trackingLive ? "Trip is in standby. Click 'Start Trip & Activate GPS' above to start journey." : isPlaying ? "Pause tracking simulation" : "Resume tracking simulation"}
            style={{ opacity: !trackingLive ? 0.6 : 1, cursor: !trackingLive ? "not-allowed" : "pointer" }}
          >
            {isPlaying && trackingLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{!trackingLive ? "Standby" : isPlaying ? "Pause" : "Resume"}</span>
          </button>

          <button
            type="button"
            className="btn-sim"
            disabled={!trackingLive}
            onClick={() => {
              if (trackingLive) {
                setProgress(0);
                setIsPlaying(true);
              }
            }}
            title="Reset to route origin"
            style={{ opacity: !trackingLive ? 0.6 : 1, cursor: !trackingLive ? "not-allowed" : "pointer" }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {/* Speed Presets including 0.5x, 1x, 2x, 4x, 5x, 8x, 10x */}
          <div className="speed-selector" title="Simulation Speed Multiplier">
            {[
              { val: 0.5, label: "0.5x" },
              { val: 1, label: "1x" },
              { val: 2, label: "2x" },
              { val: 4, label: "4x" },
              { val: 5, label: "5x" },
              { val: 8, label: "8x" },
              { val: 10, label: "10x" },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                className={`speed-chip ${speedMultiplier === val ? "active" : ""}`}
                onClick={() => setSpeedMultiplier(val)}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-sim"
            onClick={handleRecenter}
            title="Center route bounds"
          >
            <Compass size={14} />
            <span>Center</span>
          </button>

          <button
            type="button"
            className={`btn-sim ${isFullscreen ? "active" : ""}`}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Full Screen Map"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? "Exit" : "Full Screen"}</span>
          </button>
        </div>
      </div>

      {/* Main Real Map Container */}
      <div className="real-map-wrapper" style={{ position: "relative", minHeight: isFullscreen ? "100%" : "540px" }}>
        <div
          ref={mapContainerRef}
          id="leaflet-route-map"
          style={{
            width: "100%",
            height: isFullscreen ? "100%" : "540px",
            background: "#e2e8f0",
            borderRadius: isFullscreen ? "0" : "14px",
            zIndex: 1,
          }}
        />

        {/* Live GPS Telemetry Status Strip at top-left of map */}
        <div style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(9, 13, 20, 0.9)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${trackingLive ? "rgba(0, 245, 160, 0.4)" : "#334155"}`,
          padding: "6px 12px",
          borderRadius: "20px",
          boxShadow: trackingLive ? "0 0 16px rgba(0, 245, 160, 0.25)" : "none",
          pointerEvents: "none"
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: trackingLive ? "#00f5a0" : "#f59e0b",
            boxShadow: trackingLive ? "0 0 8px #00f5a0" : "none"
          }} />
          <span style={{
            color: trackingLive ? "#00f5a0" : "#94a3b8",
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em"
          }}>
            {trackingLive ? "LIVE GPS TELEMETRY BROADCASTING" : "STANDBY — Awaiting Departure"}
          </span>
        </div>

        {/* Real Sri Lanka Map Layer Switcher at top-right */}
        <div style={{
          position: "absolute",
          top: "14px",
          right: "14px",
          zIndex: 500,
          display: "flex",
          background: "rgba(9, 13, 20, 0.92)",
          backdropFilter: "blur(10px)",
          border: "1px solid #334155",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.45)"
        }}>
          <button
            type="button"
            onClick={() => setMapLayer("streets")}
            title="Real Sri Lankan Roads & Highways (OpenStreetMap)"
            style={{
              background: mapLayer === "streets" ? "#0284c7" : "transparent",
              color: mapLayer === "streets" ? "#ffffff" : "#94a3b8",
              border: "none",
              padding: "7px 12px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease"
            }}
          >
            🛣️ Real Road Map
          </button>
          <button
            type="button"
            onClick={() => setMapLayer("satellite")}
            title="Satellite Aerial View"
            style={{
              background: mapLayer === "satellite" ? "#0284c7" : "transparent",
              color: mapLayer === "satellite" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderLeft: "1px solid #334155",
              padding: "7px 12px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease"
            }}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapLayer("dark")}
            title="Night Operations Dark Mode"
            style={{
              background: mapLayer === "dark" ? "#0284c7" : "transparent",
              color: mapLayer === "dark" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderLeft: "1px solid #334155",
              padding: "7px 12px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease"
            }}
          >
            🌙 Night
          </button>
        </div>

        {/* Road Routing Status Badge at bottom-left */}
        <div style={{
          position: "absolute",
          bottom: "14px",
          left: "14px",
          zIndex: 500,
          background: "rgba(9, 13, 20, 0.88)",
          backdropFilter: "blur(8px)",
          border: "1px solid #1a2436",
          padding: "5px 10px",
          borderRadius: "8px",
          fontSize: "0.74rem",
          fontWeight: 600,
          color: loadingRoad ? "#38bdf8" : "#94a3b8",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <span>{loadingRoad ? "⏳ Snapping to Sri Lankan Road Network..." : `🛣️ Real Highway Geometry (${effectiveRoadPoints.length} GPS road waypoints)`}</span>
        </div>

        {/* Floating Interactive Stop Editing Popover Card */}
        {activeStopCard && (
          <div
            className="leaflet-stop-card-modal"
            style={{
              position: "absolute",
              top: "60px",
              left: "20px",
              zIndex: 1000,
              background: "#0d131f",
              border: "1px solid #1a2436",
              borderRadius: "14px",
              padding: "1.25rem",
              boxShadow: "0 16px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)",
              maxWidth: "340px",
              width: "calc(100% - 40px)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#00d2ff", fontWeight: 700 }}>
                  STOP #{activeStopCard.index + 1} OF {stops.length}
                </span>
                <h3 style={{ margin: "2px 0 0", color: "#f8fafc", fontSize: "1.15rem" }}>
                  {activeStopCard.stop.name}
                </h3>
                {activeStopCard.stop.minutesFromDeparture !== undefined && (
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
                    +{activeStopCard.stop.minutesFromDeparture} mins from departure
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveStopCard(null)}
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Current Assignment Status Pill */}
            <div style={{ marginBottom: "0.75rem" }}>
              {activeStopCard.stop.name.toLowerCase() === (pickupStop || "").toLowerCase() && (
                <div style={{ padding: "6px 10px", borderRadius: "6px", background: "rgba(0, 245, 160, 0.15)", color: "#00f5a0", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} /> Currently Assigned Pick-up Spot
                </div>
              )}
              {activeStopCard.stop.name.toLowerCase() === (dropoffStop || "").toLowerCase() && (
                <div style={{ padding: "6px 10px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} /> Currently Assigned Drop-off Spot
                </div>
              )}
            </div>

            {/* Passenger Boarding and Alighting details for this stop */}
            {(() => {
              const mItem = activeManifest.find(
                (m) =>
                  (activeStopCard.stop.id && m.stopId === activeStopCard.stop.id) ||
                  m.name.toLowerCase() === activeStopCard.stop.name.toLowerCase()
              );
              if (!mItem || (mItem.pickups.length === 0 && mItem.dropoffs.length === 0)) return null;
              return (
                <div style={{ marginBottom: "1rem", borderTop: "1px solid #1e293b", paddingTop: "0.75rem" }}>
                  {mItem.pickups.length > 0 && (
                    <div style={{ marginBottom: "0.6rem" }}>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#00f5a0", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                        🟢 Passengers Boarding Here ({mItem.pickups.length})
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px", maxHeight: "120px", overflowY: "auto" }}>
                        {mItem.pickups.map((p, pIdx) => (
                          <div key={pIdx} style={{ background: "rgba(0, 245, 160, 0.08)", border: "1px solid rgba(0, 245, 160, 0.25)", padding: "5px 8px", borderRadius: "6px", fontSize: "0.78rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <strong style={{ color: "#f8fafc" }}>{p.passengerName}</strong>
                              <span style={{ color: "#00f5a0", fontWeight: 600 }}>Seat {p.seatNumber}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "0.72rem", marginTop: "2px" }}>
                              <span>{p.phone}</span>
                              <span style={{ fontFamily: "monospace" }}>{p.reference}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mItem.dropoffs.length > 0 && (
                    <div>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                        🔴 Passengers Alighting Here ({mItem.dropoffs.length})
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px", maxHeight: "120px", overflowY: "auto" }}>
                        {mItem.dropoffs.map((p, pIdx) => (
                          <div key={pIdx} style={{ background: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.25)", padding: "5px 8px", borderRadius: "6px", fontSize: "0.78rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <strong style={{ color: "#f8fafc" }}>{p.passengerName}</strong>
                              <span style={{ color: "#f43f5e", fontWeight: 600 }}>Seat {p.seatNumber}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "0.72rem", marginTop: "2px" }}>
                              <span>{p.phone}</span>
                              <span style={{ fontFamily: "monospace" }}>{p.reference}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Action Buttons for Pick-up and Drop-off */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeStopCard.stop.name.toLowerCase() === (pickupStop || "").toLowerCase() ? (
                <button
                  type="button"
                  onClick={handleRemovePickup}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#ef4444",
                    border: "1px solid #ef4444",
                    borderRadius: "8px",
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.84rem",
                  }}
                >
                  ✕ Remove Pick-up Spot
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetPickup(activeStopCard.stop.name)}
                  style={{
                    background: "#00f5a0",
                    color: "#090d14",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <MapPin size={14} /> Set as Pick-up Spot
                </button>
              )}

              {activeStopCard.stop.name.toLowerCase() === (dropoffStop || "").toLowerCase() ? (
                <button
                  type="button"
                  onClick={handleRemoveDropoff}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#ef4444",
                    border: "1px solid #ef4444",
                    borderRadius: "8px",
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.84rem",
                  }}
                >
                  ✕ Remove Drop-off Spot
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetDropoff(activeStopCard.stop.name)}
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#f59e0b",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Navigation size={14} /> Set as Drop-off Spot
                </button>
              )}
            </div>

            <p style={{ margin: "0.85rem 0 0", fontSize: "0.74rem", color: "#64748b", textAlign: "center" }}>
              Selecting a new stop automatically rebalances your ticket and updates your live ETA.
            </p>
          </div>
        )}

        {/* Floating Telemetry HUD */}
        {currentBusTelemetry && (() => {
          const appStop = currentBusTelemetry.approachingStop;
          const mStop = activeManifest.find(
            (m) => (appStop?.id && m.stopId === appStop.id) || m.name.toLowerCase() === (appStop?.name || "").toLowerCase()
          );
          const pCount = mStop?.pickupCount || 0;
          const dCount = mStop?.dropoffCount || 0;
          const requiresStop = pCount + dCount > 0;

          return (
            <div
              className="map-telemetry-hud"
              style={{
                position: "absolute",
                bottom: "75px",
                left: "20px",
                zIndex: 990,
                background: "rgba(9, 13, 20, 0.92)",
                border: "1px solid #1a2436",
                borderRadius: "10px",
                padding: "0.6rem 0.9rem",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                fontSize: "0.82rem",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
              }}
            >
              <div>
                <span style={{ color: "#64748b", fontSize: "0.68rem", textTransform: "uppercase", display: "block" }}>GPS SPEED</span>
                <strong style={{ color: "#00f5a0", fontSize: "1.05rem" }}>{currentBusTelemetry.computedSpeed} km/h</strong>
              </div>
              <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: "1rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.68rem", textTransform: "uppercase", display: "block" }}>
                  {!trackingLive ? "START PLACE" : "APPROACHING"}
                </span>
                <strong style={{ color: "#00d2ff" }}>{appStop?.name || "Terminus"}</strong>
              </div>
              <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: "1rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.68rem", textTransform: "uppercase", display: "block" }}>PASSENGERS</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#00f5a0", fontWeight: 700 }}>+{pCount} Pick</span>
                  <span style={{ color: "#64748b" }}>•</span>
                  <span style={{ color: "#f43f5e", fontWeight: 700 }}>-{dCount} Drop</span>
                </div>
              </div>
              <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: "1rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.68rem", textTransform: "uppercase", display: "block" }}>DIRECTIVE</span>
                <span style={{
                  background: requiresStop ? "rgba(0, 245, 160, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: requiresStop ? "#00f5a0" : "#f87171",
                  border: `1px solid ${requiresStop ? "#00f5a0" : "#ef4444"}`,
                  padding: "2px 8px",
                  borderRadius: "5px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap"
                }}>
                  {requiresStop ? "🛑 STOP REQUIRED" : "⚡ EXPRESS PASS"}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Floating Map Pin Legend */}
        <div style={{
          position: "absolute",
          bottom: "75px",
          right: "20px",
          zIndex: 990,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "rgba(9, 13, 20, 0.9)",
          backdropFilter: "blur(8px)",
          border: "1px solid #1e293b",
          padding: "6px 12px",
          borderRadius: "8px",
          fontSize: "0.74rem",
          color: "#cbd5e1"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#00f5a0", boxShadow: "0 0 6px #00f5a0" }} />
            <strong style={{ color: "#00f5a0" }}>Green Pin:</strong> Stop Required (Pax)
          </span>
          <span style={{ color: "#475569" }}>•</span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
            <strong style={{ color: "#f87171" }}>Red Pin:</strong> Express Pass (0 Pax)
          </span>
        </div>
      </div>

      {/* Route Completion Progress Scrubber */}
      <div className="map-scrubber-footer" style={{ padding: "0.85rem 1rem", background: "#0d131f", borderTop: "1px solid #1a2436", borderRadius: "0 0 14px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>
          <span>{tracking.trip.origin}</span>
          <span style={{ color: "#00f5a0", fontWeight: 700 }}>
            {Math.round(progress * 100)}% route completed
          </span>
          <span>{tracking.trip.destination}</span>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(e) => setProgress(parseFloat(e.target.value))}
          style={{
            width: "100%",
            cursor: "pointer",
            accentColor: "#00f5a0",
          }}
        />

        <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#64748b", textAlign: "center" }}>
          Click any stop on the real map above to view passenger manifests or assign pick-up/drop-off points. Drag slider to advance the coach.
        </p>
      </div>
    </div>
  );
}
