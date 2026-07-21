import React from "react";

export const LOGO_SVG = `<svg width="1080" height="1080" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="white"/>
  <g transform="translate(140, 360)">
    <g transform="translate(0, 0) scale(3.5)">
      <defs>
        <linearGradient id="logo-grad-s-asset" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#11356a" />
          <stop offset="50%" stopColor="#0b7580" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <g stroke="url(#logo-grad-s-asset)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
        <line x1="22" y1="28" x2="42" y2="20" />
        <line x1="22" y1="28" x2="30" y2="48" />
        <line x1="42" y1="20" x2="30" y2="48" />
        <line x1="42" y1="20" x2="58" y2="25" />
        <line x1="58" y1="25" x2="55" y2="56" />
        <line x1="30" y1="48" x2="55" y2="56" />
        <line x1="30" y1="48" x2="18" y2="65" />
        <line x1="55" y1="56" x2="18" y2="65" />
        <line x1="55" y1="56" x2="45" y2="80" />
        <line x1="18" y1="65" x2="25" y2="75" />
        <line x1="18" y1="65" x2="45" y2="80" />
        <line x1="25" y1="75" x2="45" y2="80" />
      </g>
      <circle cx="22" cy="28" r="5" fill="#11356a" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="42" cy="20" r="4.5" fill="#144d85" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="58" cy="25" r="5.5" fill="#0b7580" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="30" cy="48" r="4.5" fill="#0b7580" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="55" cy="56" r="5" fill="#0c8a96" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="18" cy="65" r="4.5" fill="#0ea676" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="25" cy="75" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="45" cy="80" r="4.5" fill="#0c8a96" stroke="#ffffff" strokeWidth="1.5" />
    </g>
    <g transform="translate(240, 205)">
      <text x="0" y="0" font-family="'Inter', system-ui, -apple-system, sans-serif" font-weight="800" font-size="140" fill="#11356a" letter-spacing="-4">Sync</text>
      <text x="345" y="0" font-family="'Inter', system-ui, -apple-system, sans-serif" font-weight="900" font-size="140" fill="#0b7580" letter-spacing="-3">AI</text>
      <g transform="translate(485, -120) scale(3)">
        <circle cx="16" cy="16" r="4.5" stroke="#0ea676" strokeWidth="2.5" fill="#ffffff" />
        <path d="M16 8V12 M16 20V24 M8 16H12 M20 16H24 M10.34 10.34L13.17 13.17 M18.83 18.83L21.66 21.66 M10.34 21.66L13.17 18.83 M18.83 13.17L21.66 10.34" stroke="#0ea676" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="6.5" r="2" fill="#0ea676" />
        <circle cx="16" cy="25.5" r="2" fill="#0b7580" />
        <circle cx="6.5" cy="16" r="2" fill="#0b7580" />
        <circle cx="25.5" cy="16" r="2" fill="#0ea676" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="#11356a" />
        <circle cx="23.5" cy="23.5" r="1.5" fill="#10b981" />
        <circle cx="8.5" cy="23.5" r="1.5" fill="#11356a" />
        <circle cx="23.5" cy="8.5" r="1.5" fill="#10b981" />
      </g>
    </g>
    <text x="250" y="320" font-family="'Inter', system-ui, -apple-system, sans-serif" font-weight="700" font-size="44" fill="#18181b" letter-spacing="2">Consultancy Pvt. Ltd.</text>
  </g>
</svg>`;

export const LOGO_BASE64 = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTA4MCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxyZWN0IHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEwODAiIGZpbGw9IndoaXRlIi8+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTQwLCAzNjApIj4KICAgIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAsIDApIHNjYWxlKDMuNSkiPgogICAgICA8ZGVmcz4KICAgICAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImxvZ28tZ3JhZC1zLWFzc2V0IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3BDb2xvcj0iIzExMzU2YSIgLz4KICAgICAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wQ29sb3I9IiMwYjc1ODAiIC8+CiAgICAgICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3BDb2xvcj0iIzEwYjk4MSIgLz4KICAgICAgICA8L2xpbmVhckdyYWRpZW50PgogICAgICA8L2RlZnM+CiAgICAgIDxnIHN0cm9rZT0idXJsKCNsb2dvLWdyYWQtcy1hc3NldCkiIHN0cm9rZVdpZHRoPSIyLjUiIHN0cm9rZVxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjkiPgogICAgICAgIDxsaW5lIHgxPSIyMiIgeTE9IjI4IiB4Mj0iNDIiIHkyPSIyMCIgLz4KICAgICAgICA8bGluZSB4MT0iMjIiIHkxPSIyOCIgeDI9IjMwIiB5Mj0iNDgiIC8+CiAgICAgICAgPGxpbmUgeDE9IjQyIiB5MT0iMjAiIHgyPSIzMCIgeTI9IjQ4IiAvPgogICAgICAgIDxsaW5lIHgxPSI0MiIgeTE9IjIwIiB4Mj0iNTgiIHkyPSIyNSIgLz4KICAgICAgICA8bGluZSB4MT0iNTgiIHkxPSIyNSIgeDI9IjU1IiB5Mj0iNTYiIC8+CiAgICAgICAgPGxpbmUgeDE9IjMwIiB5MT0iNDgiIHgyPSI1NSIgeTI9IjU2IiAvPgogICAgICAgIDxsaW5lIHgxPSIzMCIgeTE9IjQ4IiB4Mj0iMTgiIHkyPSI2NSIgLz4KICAgICAgICA8bGluZSB4MT0iNTUiIHkxPSI1NiIgeDI9IjE4IiB5Mj0iNjUiIC8+CiAgICAgICAgPGxpbmUgeDE9IjU1IiB5MT0iNTYiIHgyPSI0NSIgeTI9IjgwIiAvPgogICAgICAgIDxsaW5lIHgxPSIxOCIgeTE9IjY1IiB4Mj0iMjUiIHkyPSI3NSIgLz4KICAgICAgICA8bGluZSB4MT0iMTgiIHkxPSI2NSIgeDI9IjQ1IiB5Mj0iODAiIC8+CiAgICAgICAgPGxpbmUgeDE9IjI1IiB5MT0iNzUiIHgyPSI0NSIgeTI9IjgwIiAvPgogICAgICA8L2c+CiAgICAgIDxjaXJjbGUgY3g9IjIyIiBjeT0iMjgiIHI9IjUiIGZpbGw9IiMxMTM1NmEiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlV2lkdGg9IjEuNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iNDIiIGN5PSIyMCIgcj0iNC41IiBmaWxsPSIjMTQ0ZDg1IiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZVdpZHRoPSIxLjUiIC8+CiAgICAgIDxjaXJjbGUgY3g9IjU4IiBjeT0iMjUiIHI9IjUuNSIgZmlsbD0iIzBiNzU4MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2VXaWR0aD0iMS41IiAvPgogICAgICA8Y2lyY2xlIGN4PSIzMCIgY3k9IjQ4IiByPSI0LjUiIGZpbGw9IiMwYjc1ODAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlV2lkdGg9IjEuNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iNTUiIGN5PSI1NiIgcj0iNSIgZmlsbD0iIzBjOGE5NiIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2VXaWR0aD0iMS41IiAvPgogICAgICA8Y2lyY2xlIGN4PSIxOCIgY3k9IjY1IiByPSI0LjUiIGZpbGw9IiMwZWE2NzYiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlV2lkdGg9IjEuNSIgLz4KICAgICAgPGNpcmNsZSBjeD0iMjUiIGN5PSI3NSIgcj0iNSIgZmlsbD0iIzEwYjk4MSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2VXaWR0aD0iMS41IiAvPgogICAgICA8Y2lyY2xlIGN4PSI0NSIgY3k9IjgwIiByPSI0LjUiIGZpbGw9IiMwYzhhOTYiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlV2lkdGg9IjEuNSIgLz4KICAgIDwvZz4KICAgIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI0MCwgMjA1KSI+CiAgICAgIDx0ZXh0IHg9IjAiIHk9IjAiIGZvbnQtZmFtaWx5PSInSW50ZXInLCBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI4MDAiIGZvbnQtc2l6ZT0iMTQwIiBmaWxsPSIjMTEzNTZhIiBsZXR0ZXItc3BhY2luZz0iLTQiPlN5bmM8L3RleHQ+CiAgICAgIDx0ZXh0IHg9IjM0NSIgeT0iMCIgZm9udC1mYW1pbHk9IidJbnRlcicsIHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSIxNDAiIGZpbGw9IiMwYjc1ODAiIGxldHRlci1zcGFjaW5nPSItMyI+QUk8L3RleHQ+CiAgICAgIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQ4NSwgLTEyMCkgc2NhbGUoMykiPgogICAgICAgIDxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjQuNSIgc3Ryb2tlPSIjMGVhNjc2IiBzdHJva2VXaWR0aD0iMi41IiBmaWxsPSIjZmZmZmZmIiAvPgogICAgICAgIDxwYXRoIGQ9Ik0xNiA4VjEyIE0xNiAyMFYyNCBNOCAxNkgxMiBNMjAgMTZIMjQgTTEwLjM0IDEwLjM0TDEzLjE3IDEzLjE3IE0xOC44MyAxOC44M0wyMS42NiAyMS42NiBNMTAuMzQgMjEuNjZMMTMuMTcgMTguODMgTTE4LjgzIDEzLjE3TDIxLjY2IDEwLjM0IiBzdHJva2U9IiMwZWE2NzYiIHN0cm9rZVdpZHRoPSIxLjUiIHN0cm9rZUxpbmVjYXA9InJvdW5kIiAvPgogICAgICAgIDxjaXJjbGUgY3g9IjE2IiBjeT0iNi41IiByPSIyIiBmaWxsPSIjMGVhNjc2IiAvPgogICAgICAgIDxjaXJjbGUgY3g9IjE2IiBjeT0iMjUuNSIgcj0iMiIgZmlsbD0iIzBiNzU4MCIgLz4KICAgICAgICA8Y2lyY2xlIGN4PSI2LjUiIGN5PSIxNiIgcj0iMiIgZmlsbD0iIzBiNzU4MCIgLz4KICAgICAgICA8Y2lyY2xlIGN4PSIyNS41IiBjeT0iMTYiIHI9IjIiIGZpbGw9IiMwZWE2NzYiIC8+CiAgICAgICAgPGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiIGZpbGw9IiMxMTM1NmEiIC8+CiAgICAgICAgPGNpcmNsZSBjeD0iMjMuNSIgY3k9IjIzLjUiIHI9IjEuNSIgZmlsbD0iIzEwYjk4MSIgLz4KICAgICAgICA8Y2lyY2xlIGN4PSI4LjUiIGN5PSIyMy41IiByPSIxLjUiIGZpbGw9IiMxMTM1NmEiIC8+CiAgICAgICAgPGNpcmNsZSBjeD0iMjMuNSIgY3k9IjguNSIgcj0iMS41IiBmaWxsPSIjMTBiOTgxIiAvPgogICAgICA8L2c+CiAgICA8L2c+CiAgICA8dGV4dCB4PSIyNTAiIHk9IjMyMCIgZm9udC1mYW1pbHk9IidJbnRlcicsIHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjcwMCIgZm9udC1zaXplPSI0NCIgZmlsbD0iIzE4MTgxYiIgbGV0dGVyLXNwYWNpbmc9IjIiPkNvbnN1bHRhbmN5IFB2dC4gTHRkLjwvdGV4dD4KICA8L2c+Cjwvc3ZnPg==";

export default function Logo(props: React.SVGProps<SVGSVGElement>) {
  return React.createElement("svg", {
    width: "100%",
    height: "100%",
    viewBox: "0 0 1080 1080",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ...props
  },
    React.createElement("rect", { width: "1080", height: "1080", fill: "white" }),
    React.createElement("g", { transform: "translate(140, 360)" },
      React.createElement("g", { transform: "translate(0, 0) scale(3.5)" },
        React.createElement("defs", null,
          React.createElement("linearGradient", { id: "logo-grad-s-comp", x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
            React.createElement("stop", { offset: "0%", stopColor: "#11356a" }),
            React.createElement("stop", { offset: "50%", stopColor: "#0b7580" }),
            React.createElement("stop", { offset: "100%", stopColor: "#10b981" })
          )
        ),
        React.createElement("g", { stroke: "url(#logo-grad-s-comp)", strokeWidth: "2.5", strokeLinecap: "round", opacity: "0.9" },
          React.createElement("line", { x1: "22", y1: "28", x2: "42", y2: "20" }),
          React.createElement("line", { x1: "22", y1: "28", x2: "30", y2: "48" }),
          React.createElement("line", { x1: "42", y1: "20", x2: "30", y2: "48" }),
          React.createElement("line", { x1: "42", y1: "20", x2: "58", y2: "25" }),
          React.createElement("line", { x1: "58", y1: "25", x2: "55", y2: "56" }),
          React.createElement("line", { x1: "30", y1: "48", x2: "55", y2: "56" }),
          React.createElement("line", { x1: "30", y1: "48", x2: "18", y2: "65" }),
          React.createElement("line", { x1: "55", y1: "56", x2: "18", y2: "65" }),
          React.createElement("line", { x1: "55", y1: "56", x2: "45", y2: "80" }),
          React.createElement("line", { x1: "18", y1: "65", x2: "25", y2: "75" }),
          React.createElement("line", { x1: "18", y1: "65", x2: "45", y2: "80" }),
          React.createElement("line", { x1: "25", y1: "75", x2: "45", y2: "80" })
        ),
        React.createElement("circle", { cx: "22", cy: "28", r: "5", fill: "#11356a", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "42", cy: "20", r: "4.5", fill: "#144d85", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "58", cy: "25", r: "5.5", fill: "#0b7580", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "30", cy: "48", r: "4.5", fill: "#0b7580", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "55", cy: "56", r: "5", fill: "#0c8a96", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "18", cy: "65", r: "4.5", fill: "#0ea676", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "25", cy: "75", r: "5", fill: "#10b981", stroke: "#ffffff", strokeWidth: "1.5" }),
        React.createElement("circle", { cx: "45", cy: "80", r: "4.5", fill: "#0c8a96", stroke: "#ffffff", strokeWidth: "1.5" })
      ),
      React.createElement("g", { transform: "translate(240, 205)" },
        React.createElement("text", { x: "0", y: "0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: "800", fontSize: "140", fill: "#11356a", letterSpacing: "-4" }, "Sync"),
        React.createElement("text", { x: "345", y: "0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: "900", fontSize: "140", fill: "#0b7580", letterSpacing: "-3" }, "AI"),
        React.createElement("g", { transform: "translate(485, -120) scale(3)" },
          React.createElement("circle", { cx: "16", cy: "16", r: "4.5", stroke: "#0ea676", strokeWidth: "2.5", fill: "#ffffff" }),
          React.createElement("path", { d: "M16 8V12 M16 20V24 M8 16H12 M20 16H24 M10.34 10.34L13.17 13.17 M18.83 18.83L21.66 21.66 M10.34 21.66L13.17 18.83 M18.83 13.17L21.66 10.34", stroke: "#0ea676", strokeWidth: "1.5", strokeLinecap: "round" }),
          React.createElement("circle", { cx: "16", cy: "6.5", r: "2", fill: "#0ea676" }),
          React.createElement("circle", { cx: "16", cy: "25.5", r: "2", fill: "#0b7580" }),
          React.createElement("circle", { cx: "6.5", cy: "16", r: "2", fill: "#0b7580" }),
          React.createElement("circle", { cx: "25.5", cy: "16", r: "2", fill: "#0ea676" }),
          React.createElement("circle", { cx: "8.5", cy: "8.5", r: "1.5", fill: "#11356a" }),
          React.createElement("circle", { cx: "23.5", cy: "23.5", r: "1.5", fill: "#10b981" }),
          React.createElement("circle", { cx: "8.5", cy: "23.5", r: "1.5", fill: "#11356a" }),
          React.createElement("circle", { cx: "23.5", cy: "8.5", r: "1.5", fill: "#10b981" })
        )
      ),
      React.createElement("text", { x: "250", y: "320", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontWeight: "700", fontSize: "44", fill: "#18181b", letterSpacing: "2" }, "Consultancy Pvt. Ltd.")
    )
  );
}
