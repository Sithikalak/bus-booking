import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Layers,
  Maximize2,
  Minimize2,
  Navigation,
  Compass,
  PlusCircle,
  Flag,
  RotateCcw
} from 'lucide-react';

export interface RouteStopPoint {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  stopOrder?: number;
  minutesFromDeparture?: number;
}

export interface RouteBuilderMapProps {
  mode: 'route' | 'stops' | 'live';
  originName?: string;
  originLat?: number;
  originLng?: number;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  stops?: RouteStopPoint[];
  busPosition?: { latitude: number; longitude: number; speed?: number; heading?: number };
  isLive?: boolean;
  onMapClick?: (lat: number, lng: number, suggestedName?: string) => void;
  onStopClick?: (stop: RouteStopPoint, index: number) => void;
  className?: string;
  height?: string | number;
}

// Major Sri Lanka Transit Nodes & Interchanges for snap / suggestions
const SRI_LANKA_PRESETS = [
  { name: 'Colombo Fort', lat: 6.9344, lng: 79.8500 },
  { name: 'Makumbura Multimodal Hub', lat: 6.8407, lng: 80.0034 },
  { name: 'Kadawatha Interchange', lat: 7.0016, lng: 79.9542 },
  { name: 'Negombo City', lat: 7.2008, lng: 79.8736 },
  { name: 'Katunayake BIA Airport', lat: 7.1808, lng: 79.8841 },
  { name: 'Ambepussa', lat: 7.2536, lng: 80.1873 },
  { name: 'Kegalle Central', lat: 7.2523, lng: 80.3464 },
  { name: 'Mawanella Town', lat: 7.2532, lng: 80.4485 },
  { name: 'Peradeniya Junction', lat: 7.2690, lng: 80.5971 },
  { name: 'Kandy Goods Shed', lat: 7.2906, lng: 80.6337 },
  { name: 'Gelanigama Interchange', lat: 6.7118, lng: 80.0526 },
  { name: 'Dodangoda Interchange', lat: 6.6022, lng: 80.0763 },
  { name: 'Welipenna Interchange', lat: 6.4522, lng: 80.1118 },
  { name: 'Kurundugahahetekma', lat: 6.3142, lng: 80.1258 },
  { name: 'Pinnaduwa (Galle)', lat: 6.0772, lng: 80.2520 },
  { name: 'Galle Central Station', lat: 6.0535, lng: 80.2210 },
  { name: 'Godagama (Matara)', lat: 5.9754, lng: 80.5284 },
  { name: 'Matara Nupe Terminal', lat: 5.9549, lng: 80.5550 },
  { name: 'Hambantota Harbor', lat: 6.1429, lng: 81.1212 },
  { name: 'Kurunegala Town', lat: 7.4863, lng: 80.3623 },
  { name: 'Dambulla Junction', lat: 7.8731, lng: 80.6517 },
  { name: 'Anuradhapura New Town', lat: 8.3114, lng: 80.4037 },
  { name: 'Vavuniya Station', lat: 8.7514, lng: 80.4971 },
  { name: 'Jaffna Main Station', lat: 9.6615, lng: 80.0255 },
  { name: 'Trincomalee Clock Tower', lat: 8.5874, lng: 81.2152 },
  { name: 'Batticaloa Town', lat: 7.7310, lng: 81.6747 },
  { name: 'Badulla Main Terminal', lat: 6.9934, lng: 81.0550 },
  { name: 'Nuwara Eliya Post Office', lat: 6.9497, lng: 80.7891 },
  { name: 'Ella Gap Viewpoint', lat: 6.8667, lng: 81.0466 }
];

function findClosestCity(lat: number, lng: number): string {
  let closest = SRI_LANKA_PRESETS[0];
  let minDistance = Number.MAX_VALUE;

  for (const preset of SRI_LANKA_PRESETS) {
    const dLat = preset.lat - lat;
    const dLng = preset.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      closest = preset;
    }
  }

  // If within ~15km, use preset name + Stop
  if (Math.sqrt(minDistance) < 0.15) {
    return closest.name;
  }
  return `Stop near ${closest.name.split(' ')[0]}`;
}

export function RouteBuilderMap({
  mode,
  originName = 'Origin',
  originLat,
  originLng,
  destinationName = 'Destination',
  destinationLat,
  destinationLng,
  stops = [],
  busPosition,
  isLive = false,
  onMapClick,
  onStopClick,
  className = '',
  height = '100%'
}: RouteBuilderMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [7.8731, 80.7718], // Sri Lanka center
        zoom: 8,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      polylineLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Handle map clicks
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const suggested = findClosestCity(lat, lng);
      if (onMapClick) {
        onMapClick(Number(lat.toFixed(5)), Number(lng.toFixed(5)), suggested);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [onMapClick]);

  // Update Base Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing tile layer if any
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;

    if (mapLayer === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
    } else if (mapLayer === 'dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      maxZoom = 19;
    }

    L.tileLayer(tileUrl, { maxZoom }).addTo(map);
  }, [mapLayer]);

  // Draw Route Polyline & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !polylineLayerRef.current) return;

    const markersLayer = markersLayerRef.current;
    const polylineLayer = polylineLayerRef.current;

    markersLayer.clearLayers();
    polylineLayer.clearLayers();

    const points: [number, number][] = [];
    const allBounds: [number, number][] = [];

    // 1. Origin Marker
    const effectiveOriginLat = originLat || (stops.length > 0 ? stops[0].latitude : undefined);
    const effectiveOriginLng = originLng || (stops.length > 0 ? stops[0].longitude : undefined);

    if (effectiveOriginLat && effectiveOriginLng) {
      points.push([effectiveOriginLat, effectiveOriginLng]);
      allBounds.push([effectiveOriginLat, effectiveOriginLng]);

      const originIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div style="
            background: #10b981;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5), 0 0 0 2px #ffffff;
          ">
            <span style="transform: rotate(45deg); font-size: 14px; font-weight: 800;">A</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      L.marker([effectiveOriginLat, effectiveOriginLng], { icon: originIcon })
        .addTo(markersLayer)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
            <b style="color: #10b981; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Start / Origin</b><br/>
            <strong>${originName || 'Origin'}</strong><br/>
            <span style="color: #64748b; font-size: 11px;">${effectiveOriginLat.toFixed(4)}, ${effectiveOriginLng.toFixed(4)}</span>
          </div>
        `);
    }

    // 2. Intermediate Stops
    stops.forEach((stop, index) => {
      // Don't duplicate if first or last is same coordinate
      const isFirst = index === 0;
      const isLast = index === stops.length - 1;

      if (!isFirst && !isLast && stop.latitude && stop.longitude) {
        points.push([stop.latitude, stop.longitude]);
        allBounds.push([stop.latitude, stop.longitude]);

        const stopIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `
            <div style="
              background: #0284c7;
              color: #ffffff;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 700;
              box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4), 0 0 0 2px #ffffff;
              cursor: pointer;
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12]
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .addTo(markersLayer)
          .bindPopup(`
            <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
              <b style="color: #0284c7; font-size: 10px;">Stop #${index + 1}</b><br/>
              <strong>${stop.name}</strong><br/>
              <span style="color: #64748b; font-size: 11px;">+${stop.minutesFromDeparture || 0} mins from start</span>
            </div>
          `);

        if (onStopClick) {
          marker.on('click', () => onStopClick(stop, index));
        }
      }
    });

    // 3. Destination Marker
    const effectiveDestLat = destinationLat || (stops.length > 1 ? stops[stops.length - 1].latitude : undefined);
    const effectiveDestLng = destinationLng || (stops.length > 1 ? stops[stops.length - 1].longitude : undefined);

    if (effectiveDestLat && effectiveDestLng) {
      points.push([effectiveDestLat, effectiveDestLng]);
      allBounds.push([effectiveDestLat, effectiveDestLng]);

      const destIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div style="
            background: #ef4444;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5), 0 0 0 2px #ffffff;
          ">
            <span style="transform: rotate(45deg); font-size: 14px; font-weight: 800;">B</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      L.marker([effectiveDestLat, effectiveDestLng], { icon: destIcon })
        .addTo(markersLayer)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
            <b style="color: #ef4444; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Destination / Terminus</b><br/>
            <strong>${destinationName || 'Destination'}</strong><br/>
            <span style="color: #64748b; font-size: 11px;">${effectiveDestLat.toFixed(4)}, ${effectiveDestLng.toFixed(4)}</span>
          </div>
        `);
    }

    // 4. Draw Polyline connecting all points (Vibrant Electric Cyan & Blue Polyline)
    if (points.length >= 2) {
      // Glow underlay
      L.polyline(points, {
        color: '#00d2ff',
        weight: 8,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(polylineLayer);

      // Main Route Line
      L.polyline(points, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: mode === 'stops' ? '6, 8' : undefined
      }).addTo(polylineLayer);
    }

    // 5. Live Bus Marker (if in live mode or busPosition available)
    if (busPosition && busPosition.latitude && busPosition.longitude) {
      allBounds.push([busPosition.latitude, busPosition.longitude]);

      const busIcon = L.divIcon({
        className: 'custom-bus-icon',
        html: `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              inset: 0;
              border-radius: 50%;
              background: rgba(0, 245, 160, 0.3);
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              width: 34px;
              height: 34px;
              border-radius: 50%;
              background: linear-gradient(135deg, #00f5a0, #00d2ff);
              box-shadow: 0 4px 14px rgba(0, 245, 160, 0.6), 0 0 0 3px #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #090d14;
              transform: rotate(${busPosition.heading || 0}deg);
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 2 7 19-7-4-7 4 7-19z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      L.marker([busPosition.latitude, busPosition.longitude], { icon: busIcon, zIndexOffset: 1000 })
        .addTo(markersLayer)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px;">
            <b style="color: #00f5a0;">LIVE TELEMETRY BUS</b><br/>
            Speed: <strong>${busPosition.speed || 68} km/h</strong><br/>
            Heading: ${busPosition.heading || 0}°
          </div>
        `);
    }

    // Auto-fit Bounds
    if (allBounds.length >= 2) {
      map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 14 });
    } else if (allBounds.length === 1) {
      map.setView(allBounds[0], 12);
    }
  }, [originLat, originLng, originName, destinationLat, destinationLng, destinationName, stops, busPosition, mode]);

  const handleCenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([7.8731, 80.7718], 8);
    }
  };

  return (
    <div
      className={`route-builder-map-wrap ${isFullscreen ? 'fullscreen-map' : ''} ${className}`}
      style={{ height, position: 'relative', width: '100%', minHeight: '380px' }}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: isFullscreen ? 0 : '14px', zIndex: 1 }} />

      {/* Floating Map Controls Toolbar */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        padding: '6px 10px',
        borderRadius: '30px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Layer Selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setMapLayer('streets')}
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              background: mapLayer === 'streets' ? '#0284c7' : 'transparent',
              color: mapLayer === 'streets' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Roads
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('satellite')}
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              background: mapLayer === 'satellite' ? '#0284c7' : 'transparent',
              color: mapLayer === 'satellite' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('dark')}
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              background: mapLayer === 'dark' ? '#0284c7' : 'transparent',
              color: mapLayer === 'dark' ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Cockpit
          </button>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.15)' }} />

        {/* Center reset */}
        <button
          type="button"
          onClick={handleCenter}
          title="Reset View to Sri Lanka"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex'
          }}
        >
          <RotateCcw size={15} />
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex'
          }}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Mode Instructions Tag at Top Left */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 500,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
        padding: '6px 14px',
        borderRadius: '20px',
        border: '1px solid rgba(0, 210, 255, 0.3)',
        color: '#f8fafc',
        fontSize: '12px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)'
      }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d2ff', boxShadow: '0 0 8px #00d2ff' }} />
        {mode === 'route' && 'Click anywhere on map to set Start or Destination points'}
        {mode === 'stops' && 'Click along the blue highway to assign intermediate transit stops'}
        {mode === 'live' && (isLive ? 'Real-Time Telemetry Broadcasting Live' : 'Live Highway Tracking Standby')}
      </div>
    </div>
  );
}

export default RouteBuilderMap;
