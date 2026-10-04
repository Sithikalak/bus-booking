import { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, X, CheckCircle2, Sparkles, RefreshCw } from "lucide-react";
import { optimizeImageToWebP } from "../utils/routeImage";
import { api } from "../api/client";

interface RouteImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  presetDest?: string;
}

export function RouteImageUploader({
  value,
  onChange,
  label = "Route Background Image (Auto-Optimized WebP)",
}: RouteImageUploaderProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [stats, setStats] = useState<{ originalKb: number; optimizedKb: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = [
    { name: "Kandy (Hill Country)", url: "/images/routes/kandy.webp" },
    { name: "Galle (Southern Coast)", url: "/images/routes/galle.webp" },
    { name: "Colombo (Metropolis)", url: "/images/routes/colombo.webp" },
    { name: "Jaffna (Northern)", url: "/images/routes/jaffna.webp" },
    { name: "Ella (Tea Trails)", url: "/images/routes/ella.webp" },
    { name: "Cultural Triangle", url: "/images/routes/cultural-triangle.webp" },
    { name: "Trincomalee (East)", url: "/images/routes/trincomalee.webp" },
    { name: "Night Expressway", url: "/images/routes/expressway.webp" },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setOptimizing(true);
    setStats(null);

    try {
      // 1. High-fidelity client-side WebP optimization without dropping visible quality (0.90 quality, Lanczos downscale to max 1920)
      const optimized = await optimizeImageToWebP(file, 1920, 0.90);
      setStats({
        originalKb: Math.round(optimized.originalSize / 1024),
        optimizedKb: Math.round(optimized.optimizedSize / 1024),
      });

      // 2. Upload optimized WebP to server
      try {
        const formData = new FormData();
        formData.append("file", optimized.file);

        const res = await api<{ url: string }>("/routes/upload-image", "POST", formData);
        onChange(res.url);
      } catch (uploadErr) {
        // Fallback to base64 payload if multipart upload is rejected by proxy
        try {
          const res = await api<{ url: string }>("/routes/upload-image-data", "POST", {
            data: optimized.dataUrl,
            name: optimized.file.name,
          });
          onChange(res.url);
        } catch {
          // Final fallback to client-optimized DataURL so user never loses their image
          onChange(optimized.dataUrl);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to process image file.");
    } finally {
      setOptimizing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="route-image-uploader" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-heading, #e2e8f0)" }}>
          {label}
        </label>
        {stats && (
          <span
            style={{
              fontSize: "0.72rem",
              color: "#00f5a0",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(0, 245, 160, 0.1)",
              padding: "2px 8px",
              borderRadius: "6px",
            }}
          >
            <Sparkles size={11} />
            Optimized: {stats.originalKb} KB ➔ {stats.optimizedKb} KB WebP
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {value ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "120px",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid rgba(0, 210, 255, 0.3)",
            background: "#080d16",
          }}
        >
          <img
            src={value}
            alt="Route background preview"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 40%",
              display: "block",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(8,13,22,0.2) 0%, rgba(8,13,22,0.85) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "12px",
              right: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                color: "#00d2ff",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              <CheckCircle2 size={13} color="#00f5a0" />
              WebP Background Active
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={optimizing}
                style={{
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                }}
              >
                Change Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setStats(null);
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  borderRadius: "6px",
                  background: "rgba(239, 68, 68, 0.25)",
                  color: "#fca5a5",
                  border: "none",
                  cursor: "pointer",
                }}
                title="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !optimizing && fileInputRef.current?.click()}
          style={{
            border: "2px dashed rgba(80, 140, 180, 0.35)",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
            cursor: optimizing ? "wait" : "pointer",
            background: "rgba(15, 23, 42, 0.4)",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {optimizing ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#00d2ff" }}>
              <RefreshCw size={18} className="spin-icon" />
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                Optimizing & converting to WebP...
              </span>
            </div>
          ) : (
            <>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgba(0, 210, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00d2ff",
                }}
              >
                <UploadCloud size={20} />
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "var(--text-heading, #fff)" }}>
                Click to upload route background photo
              </p>
              <small style={{ color: "var(--muted, #94a3b8)", fontSize: "0.72rem" }}>
                Auto-optimized into high-quality WebP format (JPG, PNG, WebP supported)
              </small>
            </>
          )}
        </div>
      )}

      {error && (
        <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{error}</span>
      )}

      {/* Corridor Visual Presets */}
      <div style={{ marginTop: "4px" }}>
        <small style={{ fontSize: "0.7rem", color: "#64748b", display: "block", marginBottom: "4px" }}>
          Or select from Sri Lanka corridor photography:
        </small>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {presets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                onChange(p.url);
                setStats(null);
              }}
              style={{
                fontSize: "0.7rem",
                padding: "3px 8px",
                borderRadius: "6px",
                background: value === p.url ? "rgba(0, 210, 255, 0.25)" : "rgba(255, 255, 255, 0.05)",
                color: value === p.url ? "#00e5ff" : "#94a3b8",
                border: value === p.url ? "1px solid #00d2ff" : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
