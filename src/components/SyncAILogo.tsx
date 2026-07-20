import React from "react";

interface SyncAILogoProps {
  className?: string;
  variant?: "full" | "icon" | "stacked";
  height?: number | string;
  width?: number | string;
}

export default function SyncAILogo({
  className = "",
  variant = "full",
  height,
  width,
}: SyncAILogoProps) {
  // SVG gradients and paths for the molecular S-shape on the left
  const renderIcon = (scale: number = 1) => {
    const size = 100 * scale;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="logo-grad-s" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a3a6e" />
            <stop offset="50%" stopColor="#0f9b8e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="logo-grad-nodes" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#11356a" />
            <stop offset="50%" stopColor="#0b7580" />
            <stop offset="100%" stopColor="#0ea676" />
          </linearGradient>
        </defs>

        {/* Connection lattice lines */}
        <g stroke="url(#logo-grad-s)" strokeWidth="2" strokeLinecap="round" opacity="0.85">
          {/* Top curve connections */}
          <line x1="22" y1="28" x2="42" y2="20" />
          <line x1="22" y1="28" x2="30" y2="48" />
          <line x1="42" y1="20" x2="30" y2="48" />
          <line x1="42" y1="20" x2="58" y2="25" />
          <line x1="58" y1="25" x2="55" y2="56" />

          {/* Middle connection */}
          <line x1="30" y1="48" x2="55" y2="56" />
          <line x1="30" y1="48" x2="18" y2="65" />
          <line x1="55" y1="56" x2="18" y2="65" />

          {/* Bottom curve connections */}
          <line x1="55" y1="56" x2="45" y2="80" />
          <line x1="18" y1="65" x2="25" y2="75" />
          <line x1="18" y1="65" x2="45" y2="80" />
          <line x1="25" y1="75" x2="45" y2="80" />
        </g>

        {/* Molecular Nodes */}
        {/* Node A (Top-left) */}
        <circle cx="22" cy="28" r="5" fill="#11356a" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node B (Top-middle) */}
        <circle cx="42" cy="20" r="4.5" fill="#144d85" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node C (Top-right) */}
        <circle cx="58" cy="25" r="5.5" fill="#0b7580" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node D (Mid-left) */}
        <circle cx="30" cy="48" r="4.5" fill="#0b7580" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node E (Mid-right) */}
        <circle cx="55" cy="56" r="5" fill="#0c8a96" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node H (Lower-left) */}
        <circle cx="18" cy="65" r="4.5" fill="#0ea676" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node F (Bottom-left-most) */}
        <circle cx="25" cy="75" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
        {/* Node G (Bottom-right) */}
        <circle cx="45" cy="80" r="4.5" fill="#0c8a96" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  };

  // Render the tech circular circuit pattern for the 'AI' dot
  const renderAiDot = (scale: number = 1) => {
    const size = 32 * scale;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute top-[-8px] right-[-14px]"
      >
        <circle cx="16" cy="16" r="4" stroke="#0ea676" strokeWidth="1.5" fill="#ffffff" />
        {/* Radiating lines with dots */}
        <path
          d="M16 8V12 M16 20V24 M8 16H12 M20 16H24 M10.34 10.34L13.17 13.17 M18.83 18.83L21.66 21.66 M10.34 21.66L13.17 18.83 M18.83 13.17L21.66 10.34"
          stroke="#0ea676"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle cx="16" cy="7" r="1.5" fill="#0ea676" />
        <circle cx="16" cy="25" r="1.5" fill="#0b7580" />
        <circle cx="7" cy="16" r="1.5" fill="#0b7580" />
        <circle cx="25" cy="16" r="1.5" fill="#0ea676" />
        <circle cx="9" cy="9" r="1" fill="#11356a" />
        <circle cx="23" cy="23" r="1" fill="#10b981" />
        <circle cx="9" cy="23" r="1" fill="#11356a" />
        <circle cx="23" cy="9" r="1" fill="#10b981" />
      </svg>
    );
  };

  if (variant === "icon") {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderIcon(0.4)}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center justify-center text-center p-4 bg-white rounded-2xl ${className}`}>
        {renderIcon(1.1)}
        <div className="relative mt-2 select-none">
          <div className="flex items-baseline font-sans">
            <span className="text-3xl font-extrabold text-[#11356a] tracking-tight">Sync</span>
            <span className="text-3xl font-black text-[#0b7580] tracking-tight relative pr-2">
              AI
              {renderAiDot(1)}
            </span>
          </div>
        </div>
        <div className="mt-1.5 text-xs font-bold text-gray-700 tracking-wider uppercase font-sans">
          Consultancy Pvt. Ltd.
        </div>
      </div>
    );
  }

  // Default "full" horizontal variant
  const parsedHeight = typeof height === "number" ? height : 40;

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      style={{ height: parsedHeight }}
    >
      {renderIcon((parsedHeight as number) / 100 * 1.5)}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline font-sans">
          <span
            className="font-extrabold text-[#11356a] tracking-tight"
            style={{ fontSize: (parsedHeight as number) * 0.55 }}
          >
            Sync
          </span>
          <div className="relative inline-block leading-none">
            <span
              className="font-black text-[#0b7580] tracking-tight"
              style={{ fontSize: (parsedHeight as number) * 0.55 }}
            >
              AI
            </span>
            {/* Tech AI dot with circuit */}
            <div className="absolute top-[-30%] right-[-140%] transform scale-75">
              {renderAiDot((parsedHeight as number) / 40)}
            </div>
          </div>
        </div>
        <div
          className="font-bold text-gray-500 uppercase tracking-widest mt-0.5 font-sans"
          style={{ fontSize: (parsedHeight as number) * 0.18 }}
        >
          Consultancy Pvt. Ltd.
        </div>
      </div>
    </div>
  );
}
