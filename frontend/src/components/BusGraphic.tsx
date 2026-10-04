import React from "react";

export function BusGraphic({ className = "" }: { className?: string }) {
  return (
    <div className={`bus-graphic-wrapper ${className}`} style={{ textAlign: "center" }}>
      <svg
        width="290"
        height="130"
        viewBox="0 0 290 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="coachBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f2b48" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="coachRoofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id="aeroStreak" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="145" cy="118" rx="115" ry="7" fill="rgba(0, 0, 0, 0.22)" />

        {/* Coach aerodynamic body */}
        <rect x="25" y="24" width="235" height="74" rx="16" fill="url(#coachBodyGrad)" />

        {/* Aerodynamic roof spoiler / aerodynamic cap */}
        <path
          d="M 38 24 Q 145 15 250 24 L 244 28 Q 145 20 44 28 Z"
          fill="url(#coachRoofGrad)"
        />

        {/* Continuous panoramic tinted privacy windows */}
        <rect x="34" y="34" width="220" height="27" rx="6" fill="#0b1320" />

        {/* Passenger tinted windows */}
        <rect x="40" y="37" width="34" height="21" rx="3" fill="url(#glassGrad)" opacity="0.85" />
        <rect x="78" y="37" width="34" height="21" rx="3" fill="url(#glassGrad)" opacity="0.85" />
        <rect x="116" y="37" width="34" height="21" rx="3" fill="url(#glassGrad)" opacity="0.85" />
        <rect x="154" y="37" width="34" height="21" rx="3" fill="url(#glassGrad)" opacity="0.85" />
        {/* Driver / front panoramic windshield */}
        <path d="M 192 37 L 246 37 Q 252 46 248 58 L 192 58 Z" fill="url(#glassGrad)" opacity="0.95" />

        {/* Windshield glare reflection */}
        <path d="M 215 37 L 228 37 L 208 58 L 196 58 Z" fill="rgba(255, 255, 255, 0.45)" />

        {/* Express speed aero stripe */}
        <path d="M 25 68 L 260 68 L 245 74 L 25 74 Z" fill="#00e5ff" opacity="0.85" />
        <path d="M 25 75 L 243 75 L 235 79 L 25 79 Z" fill="#ffffff" opacity="0.6" />

        {/* Brand emblem badge */}
        <text
          x="120"
          y="89"
          fill="#ffffff"
          fontSize="8"
          fontWeight="800"
          letterSpacing="0.16em"
          fontFamily="system-ui, sans-serif"
        >
          CITYLINK EXPRESS
        </text>

        {/* Subtitle brand badge */}
        <text
          x="215"
          y="89"
          fill="#7dd3fc"
          fontSize="6"
          fontWeight="700"
          letterSpacing="0.08em"
          fontFamily="system-ui, sans-serif"
        >
          INTERCITY LUXURY
        </text>

        {/* Front projector LED headlights */}
        <rect x="254" y="78" width="5" height="12" rx="2" fill="#e0f2fe" />
        <circle cx="256" cy="84" r="2.5" fill="#38bdf8" />

        {/* Rear LED taillight */}
        <rect x="24" y="78" width="4" height="11" rx="2" fill="#ef4444" />

        {/* Front Wheel */}
        <circle cx="206" cy="98" r="16" fill="#0f172a" />
        <circle cx="206" cy="98" r="10" fill="#64748b" />
        <circle cx="206" cy="98" r="5" fill="#0284c7" />

        {/* Rear Wheel */}
        <circle cx="78" cy="98" r="16" fill="#0f172a" />
        <circle cx="78" cy="98" r="10" fill="#64748b" />
        <circle cx="78" cy="98" r="5" fill="#0284c7" />

        {/* Wheel arch trims */}
        <path d="M 58 98 A 20 20 0 0 1 98 98" stroke="#0369a1" strokeWidth="2.5" fill="none" />
        <path d="M 186 98 A 20 20 0 0 1 226 98" stroke="#0369a1" strokeWidth="2.5" fill="none" />
      </svg>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em", marginTop: "2px" }}>
        CITYLINK EXPRESS · METRO TRAVEL LANKA
      </div>
    </div>
  );
}

export default BusGraphic;
