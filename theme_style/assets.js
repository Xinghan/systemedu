/* ========================================================
   Icons, props, mascots — compact SVGs, use currentColor
======================================================== */

// Universal icons (same set per theme, but colored with the accent)
const ICONS = {
  cs: [
    // terminal
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 10l2 2-2 2M11 14h4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3L5 12l4 9M15 3l4 9-4 9"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v8M18 8v8M8 6h8M8 18h8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M9 4v16"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h10M4 18h16"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><circle cx="7" cy="7" r="0.5" fill="currentColor"/><circle cx="7" cy="17" r="0.5" fill="currentColor"/></svg>',
  ],
  bio: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3c4 4 4 14 8 18M16 3c-4 4-4 14-8 18M8 7h8M8 12h8M8 17h8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3v6l-4 8a4 4 0 004 4h6a4 4 0 004-4l-4-8V3M9 3h6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c3 3 6 5 6 10a6 6 0 01-12 0c0-5 3-7 6-10z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20L20 4M8 4h4v4M16 20h-4v-4"/></svg>',
  ],
  space: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l4 10v6l-4 4-4-4v-6z"/><circle cx="12" cy="10" r="2"/><path d="M8 18l-3 3M16 18l3 3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M6 6l-3 3 3 3M18 18l3-3-3-3"/><rect x="11" y="11" width="2" height="2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="11" ry="3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 20c4-8 14-8 18 0M5 16l2 2M19 16l-2 2"/><circle cx="12" cy="10" r="2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l2 5 5 1-4 4 1 5-4-3-4 3 1-5-4-4 5-1z"/></svg>',
  ],
  mech: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3l-2 2 4 4 2-2a3 3 0 00-4-4zM12 5l-9 9v5h5l9-9"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="3" width="8" height="8"/><rect x="6" y="11" width="12" height="4"/><rect x="9" y="15" width="6" height="6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v6H4zM4 14h16v6H4zM8 7h1M8 17h1"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l5 3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  ],
  ai: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M7.5 7.5L10.5 10.5M16.5 7.5L13.5 10.5M7.5 16.5L10.5 13.5M16.5 16.5L13.5 13.5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="14" height="14" rx="1"/><rect x="9" y="9" width="6" height="6"/><path d="M3 9h2M3 15h2M19 9h2M19 15h2M9 3v2M15 3v2M9 19v2M15 19v2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c4 0 7 3 7 7 0 4-3 6-3 9H8c0-3-3-5-3-9 0-4 3-7 7-7zM10 22h4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 17l6-6 4 4 8-8"/><circle cx="3" cy="17" r="1.5"/><circle cx="21" cy="7" r="1.5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l2-4 4 8 2-4h6"/></svg>',
  ],
  math: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="2"/><path d="M12 10v10M8 20l4-8 4 8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L3 9v12h18V9L12 3zM3 9h18M12 3v18"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20h16M6 4v12M10 8v8M14 6v10M18 10v6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20L20 4M4 4h6v6M20 20h-6v-6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20Q8 4 12 12T20 4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><text x="12" y="17" text-anchor="middle" font-family="JetBrains Mono" font-size="14" fill="currentColor" stroke="none">π</text><circle cx="12" cy="12" r="9"/></svg>',
  ],
  med: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5c-3-4-9 0-6 6l6 8 6-8c3-6-3-10-6-6z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12h4l3-6 4 12 3-6h6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 14l6-6 10 10-6 6zM10 8l4-4 6 6-4 4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12a4 4 0 018 0"/></svg>',
  ],
  chem: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3v6l-5 10a3 3 0 003 3h10a3 3 0 003-3l-5-10V3M9 3h6M7 15h10"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="8" r="2"/><circle cx="19" cy="8" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M7 9l3 2M17 9l-3 2M10 14l-1 3M14 14l1 3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l9 16H3z"/><path d="M12 3v16"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="4" width="12" height="16"/><path d="M6 10h12M6 14h12"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 20l4-16M18 20l-4-16M4 12h16"/></svg>',
  ],
  phys: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3v4M6 7l-3 13M6 7l3 13"/><circle cx="6" cy="20" r="3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L3 20h18z"/><path d="M3 14h18"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="8" width="12" height="8"/><path d="M6 10h-3M6 14h-3M18 10h3M18 14h3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12c3-8 15-8 18 0M3 12c3 8 15 8 18 0"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
  ],
  env: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c4 4 5 8 3 12h-6c-2-4-1-8 3-12zM12 15v6M9 18h6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3C9 8 5 11 5 15a7 7 0 0014 0c0-4-4-7-7-12z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 18c2 2 4 2 6 0s4-2 6 0 2 2 4 0M4 14c2 2 4 2 6 0s4-2 6 0 2 2 4 0"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 20L8 10l4 6 4-10 5 14z"/></svg>',
  ],
  robo: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="12" height="10" rx="1"/><circle cx="10" cy="11" r="1.5"/><circle cx="14" cy="11" r="1.5"/><path d="M12 3v3M9 16v4M15 16v4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="6" r="3"/><path d="M12 9l-4 8M12 9l4 8M4 20h4l4-3 4 3h4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="10" width="18" height="10" rx="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/><path d="M8 10V5h8v5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="16" height="8" rx="1"/><rect x="8" y="2" width="8" height="4"/><rect x="8" y="18" width="8" height="4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20V8l4-3 4 3v12M12 20v-8l4-3 4 3v8M4 20h20"/></svg>',
  ],
  elec: [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="16" height="8" rx="1"/><path d="M8 8V5M12 8V4M16 8V5M8 16v3M12 16v4M16 16v3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l1-3 2 6 2-6 2 6 1-3h6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="12" height="12"/><path d="M10 2v4M14 2v4M10 18v4M14 18v4M2 10h4M2 14h4M18 10h4M18 14h4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="14" height="12" rx="1"/><rect x="18" y="10" width="2" height="4"/><path d="M8 12h2M14 12h2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/></svg>',
  ],
};

// Mascots (one per theme, geometric sci-fi creatures)
const MASCOTS = {
  cs: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <rect x="-45" y="-45" width="90" height="90" rx="8" fill="oklch(0.22 0.08 210)" stroke="oklch(0.75 0.17 200)" stroke-width="2"/>
      <rect x="-30" y="-30" width="18" height="18" rx="2" fill="oklch(0.75 0.17 200 / 0.5)"/>
      <rect x="-6" y="-30" width="18" height="18" rx="2" fill="oklch(0.85 0.14 85 / 0.5)"/>
      <rect x="18" y="-30" width="12" height="12" rx="2" fill="oklch(0.75 0.17 200 / 0.3)"/>
      <rect x="-30" y="-6" width="12" height="12" rx="2" fill="oklch(0.75 0.17 200 / 0.3)"/>
      <rect x="-6" y="-6" width="12" height="12" rx="2" fill="oklch(0.75 0.17 200)"/>
      <rect x="18" y="-6" width="12" height="12" rx="2" fill="oklch(0.75 0.17 200 / 0.5)"/>
      <!-- eyes -->
      <circle cx="-15" cy="18" r="4" fill="oklch(0.18 0.04 265)"/>
      <circle cx="-14" cy="17" r="1.5" fill="oklch(0.92 0.08 190)"/>
      <circle cx="15" cy="18" r="4" fill="oklch(0.18 0.04 265)"/>
      <circle cx="16" cy="17" r="1.5" fill="oklch(0.92 0.08 190)"/>
      <!-- antenna -->
      <line x1="0" y1="-45" x2="0" y2="-60" stroke="oklch(0.75 0.17 200)" stroke-width="1.5"/>
      <circle cx="0" cy="-62" r="4" fill="oklch(0.85 0.14 85)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.75 0.17 200)" letter-spacing="0.2em">BIT</text>
  </svg>`,
  bio: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <ellipse rx="40" ry="50" fill="oklch(0.28 0.08 155 / 0.4)" stroke="oklch(0.75 0.17 155)" stroke-width="2"/>
      <path d="M-8 -30 Q-8 0 -12 20 Q-8 35 0 40 Q8 35 12 20 Q8 0 8 -30" fill="oklch(0.85 0.14 85)" opacity="0.8"/>
      <circle cx="-10" cy="-10" r="5" fill="oklch(0.18 0.04 265)"/>
      <circle cx="-9" cy="-11" r="2" fill="oklch(0.92 0.08 150)"/>
      <circle cx="10" cy="-10" r="5" fill="oklch(0.18 0.04 265)"/>
      <circle cx="11" cy="-11" r="2" fill="oklch(0.92 0.08 150)"/>
      <path d="M-6 10 Q0 15 6 10" stroke="oklch(0.18 0.04 265)" stroke-width="1.5" fill="none"/>
      <!-- leaf sprout -->
      <path d="M0 -50 Q-8 -60 -15 -55 Q-8 -50 0 -50 M0 -50 Q8 -60 15 -55 Q8 -50 0 -50" fill="oklch(0.75 0.17 155)"/>
      <line x1="0" y1="-50" x2="0" y2="-40" stroke="oklch(0.75 0.17 155)" stroke-width="1.5"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.75 0.17 155)" letter-spacing="0.2em">SPROUT</text>
  </svg>`,
  space: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- chevron body -->
      <path d="M0 -40 L40 20 L20 30 L0 20 L-20 30 L-40 20 Z" fill="oklch(0.28 0.08 295 / 0.6)" stroke="oklch(0.72 0.17 295)" stroke-width="2"/>
      <path d="M-15 0 L15 0 L0 -20 Z" fill="oklch(0.85 0.14 85)"/>
      <circle cx="0" cy="-5" r="4" fill="oklch(0.18 0.04 265)"/>
      <circle cx="0" cy="-5" r="1.5" fill="oklch(0.92 0.08 295)"/>
      <!-- thrusters -->
      <circle cx="-30" cy="22" r="3" fill="oklch(0.85 0.14 85)"/>
      <circle cx="30" cy="22" r="3" fill="oklch(0.85 0.14 85)"/>
      <!-- comet trail -->
      <path d="M0 30 L-8 50 L8 45 L-4 65 L6 60 L0 80" stroke="oklch(0.85 0.14 85)" stroke-width="1.5" fill="none" opacity="0.6"/>
      <circle cx="-8" cy="50" r="2" fill="oklch(0.92 0.08 295)"/>
      <circle cx="8" cy="45" r="1.5" fill="oklch(0.92 0.08 295)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.72 0.17 295)" letter-spacing="0.2em">PILOT</text>
  </svg>`,
  mech: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      ${Array.from({length:10},(_,i)=>`<rect x="-5" y="-55" width="10" height="14" fill="oklch(0.75 0.17 55)" transform="rotate(${i*36})"/>`).join('')}
      <circle r="40" fill="oklch(0.28 0.10 55)" stroke="oklch(0.75 0.17 55)" stroke-width="2"/>
      <!-- wings -->
      <path d="M-50 0 Q-70 -15 -55 -25" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1.5"/>
      <path d="M50 0 Q70 -15 55 -25" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1.5"/>
      <ellipse cx="-55" cy="-12" rx="18" ry="6" fill="oklch(0.85 0.14 85 / 0.3)" transform="rotate(-20 -55 -12)"/>
      <ellipse cx="55" cy="-12" rx="18" ry="6" fill="oklch(0.85 0.14 85 / 0.3)" transform="rotate(20 55 -12)"/>
      <!-- face -->
      <circle cx="-10" cy="-5" r="4" fill="oklch(0.18 0.04 265)"/>
      <circle cx="-9" cy="-6" r="1.5" fill="oklch(0.92 0.08 60)"/>
      <circle cx="10" cy="-5" r="4" fill="oklch(0.18 0.04 265)"/>
      <circle cx="11" cy="-6" r="1.5" fill="oklch(0.92 0.08 60)"/>
      <circle r="8" cy="20" fill="none" stroke="oklch(0.18 0.04 265)" stroke-width="1.5" stroke-dasharray="2 2"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.75 0.17 55)" letter-spacing="0.2em">COG</text>
  </svg>`,
  ai: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <path d="M0 -50 L43 -25 L43 25 L0 50 L-43 25 L-43 -25 Z" fill="oklch(0.28 0.08 335 / 0.4)" stroke="oklch(0.72 0.17 335)" stroke-width="2"/>
      <!-- inner nodes -->
      <circle cx="-20" cy="-10" r="4" fill="oklch(0.92 0.08 335)"/>
      <circle cx="20" cy="-10" r="4" fill="oklch(0.92 0.08 335)"/>
      <circle cx="0" cy="5" r="5" fill="oklch(0.85 0.14 85)"/>
      <circle cx="-15" cy="20" r="3" fill="oklch(0.72 0.17 335)"/>
      <circle cx="15" cy="20" r="3" fill="oklch(0.72 0.17 335)"/>
      <line x1="-20" y1="-10" x2="0" y2="5" stroke="oklch(0.72 0.17 335 / 0.7)" stroke-width="1"/>
      <line x1="20" y1="-10" x2="0" y2="5" stroke="oklch(0.72 0.17 335 / 0.7)" stroke-width="1"/>
      <line x1="0" y1="5" x2="-15" y2="20" stroke="oklch(0.72 0.17 335 / 0.7)" stroke-width="1"/>
      <line x1="0" y1="5" x2="15" y2="20" stroke="oklch(0.72 0.17 335 / 0.7)" stroke-width="1"/>
      <line x1="-20" y1="-10" x2="20" y2="-10" stroke="oklch(0.72 0.17 335 / 0.4)" stroke-width="1"/>
      <!-- halo -->
      <circle r="60" fill="none" stroke="oklch(0.72 0.17 335 / 0.3)" stroke-width="1" stroke-dasharray="2 4"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.72 0.17 335)" letter-spacing="0.2em">NOVA</text>
  </svg>`,
  math: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- tetrahedron -->
      <path d="M0 -45 L40 25 L-40 25 Z" fill="oklch(0.28 0.08 245 / 0.3)" stroke="oklch(0.72 0.17 245)" stroke-width="2"/>
      <path d="M0 -45 L0 10 L-40 25" fill="oklch(0.28 0.08 245 / 0.5)" stroke="oklch(0.72 0.17 245)" stroke-width="2"/>
      <path d="M0 -45 L0 10 L40 25" fill="oklch(0.22 0.06 245 / 0.5)" stroke="oklch(0.72 0.17 245)" stroke-width="2"/>
      <!-- face symbol -->
      <text x="-15" y="0" font-family="JetBrains Mono" font-size="14" fill="oklch(0.85 0.14 85)" font-weight="600">π</text>
      <text x="8" y="10" font-family="JetBrains Mono" font-size="12" fill="oklch(0.92 0.08 240)">∞</text>
      <!-- eyes -->
      <circle cx="-16" cy="-14" r="2" fill="oklch(0.92 0.08 240)"/>
      <circle cx="10" cy="-14" r="2" fill="oklch(0.92 0.08 240)"/>
      <!-- sparkles -->
      <circle cx="-55" cy="-30" r="2" fill="oklch(0.85 0.14 85)"/>
      <circle cx="55" cy="-20" r="2" fill="oklch(0.85 0.14 85)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.72 0.17 245)" letter-spacing="0.2em">PI</text>
  </svg>`,
  med: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- pill body -->
      <rect x="-30" y="-45" width="60" height="90" rx="30" fill="oklch(0.75 0.16 15 / 0.5)" stroke="oklch(0.75 0.16 15)" stroke-width="2"/>
      <line x1="-30" y1="0" x2="30" y2="0" stroke="oklch(0.75 0.16 15)" stroke-width="2"/>
      <!-- heart -->
      <path d="M0 -15 C-10 -25 -20 -20 -15 -10 C-10 0 0 5 0 10 C0 5 10 0 15 -10 C20 -20 10 -25 0 -15 Z" fill="oklch(0.85 0.14 85)"/>
      <!-- eyes on lower half -->
      <circle cx="-10" cy="20" r="3" fill="oklch(0.18 0.04 265)"/>
      <circle cx="10" cy="20" r="3" fill="oklch(0.18 0.04 265)"/>
      <path d="M-6 28 Q0 32 6 28" stroke="oklch(0.18 0.04 265)" stroke-width="1.5" fill="none"/>
      <!-- pulse ring -->
      <circle r="55" fill="none" stroke="oklch(0.75 0.16 15 / 0.3)" stroke-width="1"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.75 0.16 15)" letter-spacing="0.2em">CURA</text>
  </svg>`,
  chem: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <circle r="16" fill="oklch(0.85 0.14 85)" stroke="oklch(0.82 0.17 125)" stroke-width="2"/>
      <circle cx="-35" cy="-15" r="10" fill="oklch(0.82 0.17 125)"/>
      <circle cx="35" cy="-15" r="10" fill="oklch(0.82 0.17 125)"/>
      <circle cx="0" cy="35" r="12" fill="oklch(0.95 0.08 120)" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
      <line x1="-25" y1="-12" x2="-6" y2="-5" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
      <line x1="25" y1="-12" x2="6" y2="-5" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
      <line x1="0" y1="15" x2="0" y2="25" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
      <!-- orbital rings -->
      <ellipse rx="50" ry="18" fill="none" stroke="oklch(0.82 0.17 125 / 0.4)" stroke-width="1" transform="rotate(-15)"/>
      <!-- eyes on big node -->
      <circle cx="-4" cy="-2" r="2" fill="oklch(0.18 0.04 265)"/>
      <circle cx="4" cy="-2" r="2" fill="oklch(0.18 0.04 265)"/>
      <path d="M-4 4 Q0 7 4 4" stroke="oklch(0.18 0.04 265)" stroke-width="1" fill="none"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.82 0.17 125)" letter-spacing="0.2em">ION</text>
  </svg>`,
  phys: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- tuning fork shape -->
      <path d="M-20 -30 L-20 20 L-10 30 L-10 50 M20 -30 L20 20 L10 30 L10 50 M-20 -30 L20 -30" stroke="oklch(0.78 0.13 215)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="-4" y="-15" width="8" height="60" rx="4" fill="oklch(0.78 0.13 215)"/>
      <!-- waveform halo -->
      <path d="M-60 -10 Q-40 -25 -20 -10" fill="none" stroke="oklch(0.78 0.13 215 / 0.6)" stroke-width="1.2"/>
      <path d="M20 -10 Q40 -25 60 -10" fill="none" stroke="oklch(0.78 0.13 215 / 0.6)" stroke-width="1.2"/>
      <path d="M-70 0 Q-45 -20 -20 0" fill="none" stroke="oklch(0.78 0.13 215 / 0.3)" stroke-width="1"/>
      <path d="M20 0 Q45 -20 70 0" fill="none" stroke="oklch(0.78 0.13 215 / 0.3)" stroke-width="1"/>
      <!-- glowing core -->
      <circle cy="30" r="8" fill="oklch(0.85 0.14 85)"/>
      <circle cy="30" r="14" fill="none" stroke="oklch(0.85 0.14 85 / 0.5)" stroke-width="1"/>
      <circle cx="-4" cy="28" r="1.5" fill="oklch(0.18 0.04 265)"/>
      <circle cx="4" cy="28" r="1.5" fill="oklch(0.18 0.04 265)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.78 0.13 215)" letter-spacing="0.2em">ECHO</text>
  </svg>`,
  env: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- leaf body -->
      <path d="M0 -55 Q-40 -30 -40 10 Q-40 50 0 50 Q40 50 40 10 Q40 -30 0 -55 Z" fill="oklch(0.28 0.10 140 / 0.6)" stroke="oklch(0.72 0.15 140)" stroke-width="2"/>
      <path d="M0 -50 L0 45" stroke="oklch(0.72 0.15 140)" stroke-width="1.5"/>
      <path d="M0 -30 Q-18 -20 -28 0 M0 -10 Q-18 0 -30 20 M0 10 Q-16 20 -26 34 M0 -30 Q18 -20 28 0 M0 -10 Q18 0 30 20 M0 10 Q16 20 26 34" stroke="oklch(0.72 0.15 140 / 0.6)" stroke-width="0.8" fill="none"/>
      <!-- eyes -->
      <circle cx="-8" cy="0" r="3" fill="oklch(0.18 0.04 265)"/>
      <circle cx="8" cy="0" r="3" fill="oklch(0.18 0.04 265)"/>
      <circle cx="-7" cy="-1" r="1" fill="oklch(0.92 0.08 140)"/>
      <circle cx="9" cy="-1" r="1" fill="oklch(0.92 0.08 140)"/>
      <path d="M-5 10 Q0 13 5 10" stroke="oklch(0.18 0.04 265)" stroke-width="1" fill="none"/>
      <!-- pollen sparks -->
      <circle cx="-50" cy="-20" r="2" fill="oklch(0.85 0.14 85)"/>
      <circle cx="50" cy="0" r="2" fill="oklch(0.85 0.14 85)"/>
      <circle cx="45" cy="-35" r="1.5" fill="oklch(0.85 0.14 85)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.72 0.15 140)" letter-spacing="0.2em">FERN</text>
  </svg>`,
  robo: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- body -->
      <rect x="-35" y="-30" width="70" height="50" rx="8" fill="oklch(0.28 0.08 95 / 0.7)" stroke="oklch(0.82 0.15 95)" stroke-width="2"/>
      <!-- single eye -->
      <circle r="14" fill="oklch(0.18 0.04 265)" stroke="oklch(0.82 0.15 95)" stroke-width="2"/>
      <circle r="8" fill="oklch(0.85 0.14 85)"/>
      <circle cx="-2" cy="-2" r="2.5" fill="oklch(0.18 0.04 265)"/>
      <!-- antenna -->
      <line x1="0" y1="-30" x2="0" y2="-48" stroke="oklch(0.82 0.15 95)" stroke-width="2"/>
      <circle cx="0" cy="-52" r="3" fill="oklch(0.85 0.14 85)"/>
      <!-- tracks -->
      <rect x="-42" y="22" width="84" height="18" rx="9" fill="oklch(0.22 0.06 95)" stroke="oklch(0.82 0.15 95)" stroke-width="1.5"/>
      <circle cx="-28" cy="31" r="5" fill="oklch(0.28 0.08 95)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
      <circle cx="0" cy="31" r="5" fill="oklch(0.28 0.08 95)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
      <circle cx="28" cy="31" r="5" fill="oklch(0.28 0.08 95)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
      <!-- side details -->
      <rect x="-32" y="-20" width="6" height="14" fill="oklch(0.82 0.15 95 / 0.6)"/>
      <rect x="26" y="-20" width="6" height="14" fill="oklch(0.82 0.15 95 / 0.6)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.82 0.15 95)" letter-spacing="0.2em">WIDGET</text>
  </svg>`,
  elec: `<svg viewBox="0 0 200 220" fill="none">
    <g transform="translate(100 110)">
      <!-- lightning body -->
      <path d="M10 -55 L-25 -5 L-5 -5 L-15 45 L30 -5 L10 -5 Z" fill="oklch(0.28 0.08 275 / 0.5)" stroke="oklch(0.72 0.17 275)" stroke-width="2" stroke-linejoin="round"/>
      <path d="M10 -55 L-25 -5 L-5 -5 L-15 45 L30 -5 L10 -5 Z" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="0.8" stroke-linejoin="round"/>
      <!-- face -->
      <circle cx="-8" cy="-8" r="2.5" fill="oklch(0.92 0.08 275)"/>
      <circle cx="8" cy="-12" r="2.5" fill="oklch(0.92 0.08 275)"/>
      <path d="M-3 0 Q2 2 7 -2" stroke="oklch(0.18 0.04 265)" stroke-width="1" fill="none"/>
      <!-- sparks -->
      <circle cx="-45" cy="-30" r="2" fill="oklch(0.85 0.14 85)"/>
      <circle cx="45" cy="-20" r="2" fill="oklch(0.85 0.14 85)"/>
      <circle cx="-35" cy="30" r="1.5" fill="oklch(0.92 0.08 275)"/>
      <circle cx="50" cy="40" r="1.5" fill="oklch(0.92 0.08 275)"/>
    </g>
    <text x="100" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="oklch(0.72 0.17 275)" letter-spacing="0.2em">VOLT</text>
  </svg>`,
};

// Props — one detailed icon per named prop per theme
const PROPS = {
  cs: [
    '<svg viewBox="0 0 80 80" fill="none"><rect x="10" y="15" width="60" height="44" rx="3" fill="oklch(0.22 0.08 210)" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="15" width="60" height="8" rx="3" fill="currentColor" opacity="0.3"/><path d="M20 36l6 6-6 6M32 48h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="30" y="63" width="20" height="3" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="28" cy="40" r="14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="40" r="5" fill="currentColor"/><path d="M42 40h24l-4-4M62 40l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="56" y="34" width="10" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><rect x="20" y="20" width="40" height="40" rx="4" fill="oklch(0.22 0.08 210)" stroke="currentColor" stroke-width="1.5"/><rect x="28" y="28" width="10" height="10" fill="currentColor" opacity="0.6"/><rect x="42" y="28" width="10" height="10" fill="currentColor"/><rect x="28" y="42" width="10" height="10" fill="currentColor"/><rect x="42" y="42" width="10" height="10" fill="currentColor" opacity="0.4"/></svg>',
  ],
  bio: [
    '<svg viewBox="0 0 80 80" fill="none"><path d="M28 10c12 14 12 46 24 60M52 10c-12 14-12 46-24 60" stroke="currentColor" stroke-width="2" fill="none"/><line x1="28" y1="22" x2="52" y2="22" stroke="currentColor" stroke-width="1.5"/><line x1="28" y1="36" x2="52" y2="36" stroke="currentColor" stroke-width="1.5"/><line x1="28" y1="50" x2="52" y2="50" stroke="currentColor" stroke-width="1.5"/><line x1="28" y1="64" x2="52" y2="64" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M30 10v20l-12 30a6 6 0 006 8h32a6 6 0 006-8L50 30V10M30 10h20" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M22 50h36" stroke="currentColor" stroke-width="1"/><circle cx="32" cy="58" r="2" fill="currentColor"/><circle cx="44" cy="62" r="1.5" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="24" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="3" fill="currentColor"/><circle cx="24" cy="30" r="2" fill="currentColor"/><circle cx="56" cy="50" r="2" fill="currentColor"/></svg>',
  ],
  space: [
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 8l10 24v18l-10 12-10-12V32z" stroke="currentColor" stroke-width="1.5" fill="oklch(0.28 0.08 295 / 0.3)"/><circle cx="40" cy="28" r="4" fill="currentColor"/><path d="M30 56l-8 8M50 56l8 8" stroke="currentColor" stroke-width="1.5"/><path d="M36 66l4 10 4-10" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="36" width="14" height="8" fill="currentColor" opacity="0.6"/><rect x="62" y="36" width="14" height="8" fill="currentColor" opacity="0.6"/><path d="M30 30l-6-6M50 30l6-6M50 50l6 6M30 50l-6 6" stroke="currentColor" stroke-width="1"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="22" fill="oklch(0.28 0.08 295 / 0.4)" stroke="currentColor" stroke-width="1.5"/><ellipse cx="40" cy="40" rx="32" ry="6" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.6"/><circle cx="50" cy="44" r="2" fill="currentColor" opacity="0.4"/></svg>',
  ],
  mech: [
    '<svg viewBox="0 0 80 80" fill="none"><g transform="translate(40 40)">' + Array.from({length:10},(_,i)=>`<rect x="-4" y="-32" width="8" height="12" fill="currentColor" transform="rotate(${i*36})"/>`).join('') + '<circle r="22" fill="oklch(0.28 0.10 55)" stroke="currentColor" stroke-width="1.5"/><circle r="6" fill="currentColor"/></g></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M56 12l-4 4 10 10 4-4a5 5 0 00-10-10zM50 18l-30 30v12h12l30-30" stroke="currentColor" stroke-width="1.5" fill="oklch(0.28 0.10 55 / 0.4)"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><rect x="28" y="12" width="24" height="20" fill="oklch(0.28 0.10 55)" stroke="currentColor" stroke-width="1.5"/><rect x="22" y="32" width="36" height="12" fill="currentColor" opacity="0.6"/><rect x="30" y="44" width="20" height="24" fill="oklch(0.28 0.10 55)" stroke="currentColor" stroke-width="1.5"/></svg>',
  ],
  ai: [
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="20" cy="40" r="4" fill="currentColor"/><circle cx="40" cy="22" r="4" fill="currentColor"/><circle cx="40" cy="58" r="4" fill="currentColor"/><circle cx="60" cy="40" r="4" fill="currentColor"/><path d="M24 40l12-16M24 40l12 16M44 22l12 16M44 58l12-16" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><rect x="18" y="18" width="44" height="44" rx="2" fill="oklch(0.28 0.08 335 / 0.4)" stroke="currentColor" stroke-width="1.5"/><rect x="30" y="30" width="20" height="20" fill="currentColor" opacity="0.6"/><path d="M8 28h10M8 40h10M8 52h10M62 28h10M62 40h10M62 52h10M28 8v10M40 8v10M52 8v10M28 62v10M40 62v10M52 62v10" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M12 60l12-16 10 10 16-20 14 6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="60" r="3" fill="currentColor"/><circle cx="64" cy="40" r="3" fill="currentColor"/><path d="M12 64h56" stroke="currentColor" stroke-width="0.5" opacity="0.5"/></svg>',
  ],
  math: [
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="22" r="5" fill="currentColor"/><path d="M40 27v40M22 67l18-32 18 32" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="40" cy="22" r="12" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 10L16 26v28h48V26zM16 26h48M40 10v44" stroke="currentColor" stroke-width="1.5" fill="oklch(0.28 0.08 245 / 0.3)"/><path d="M40 10L16 54M40 10l24 44M16 26l48 28M64 26L16 54" stroke="currentColor" stroke-width="0.8" opacity="0.6"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M10 60h60M14 68v-44M22 50v-20M34 56v-30M46 40v-18M58 48v-24M68 58v-30" stroke="currentColor" stroke-width="1.5"/></svg>',
  ],
  med: [
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 18c-10-14-30 0-20 20l20 26 20-26c10-20-10-34-20-20z" fill="oklch(0.28 0.08 15 / 0.4)" stroke="currentColor" stroke-width="1.5"/><path d="M30 36h6l4-8 4 16 4-8h6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M18 14l14 14M28 18l4-4 32 32-4 4zM60 46l6 6M44 30l14 14M48 26l4-4" stroke="currentColor" stroke-width="1.5" fill="oklch(0.28 0.08 15 / 0.3)" stroke-linejoin="round"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 40h8l4-8 4 16 4-16 4 16 4-8h24" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  ],
  chem: [
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="8" fill="currentColor"/><circle cx="18" cy="28" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="62" cy="28" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="22" cy="62" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="58" cy="62" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="24" y1="28" x2="32" y2="36" stroke="currentColor" stroke-width="1.5"/><line x1="56" y1="28" x2="48" y2="36" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="58" x2="34" y2="46" stroke="currentColor" stroke-width="1.5"/><line x1="54" y1="58" x2="46" y2="46" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M30 10v18l-14 34a4 4 0 004 4h40a4 4 0 004-4L50 28V10M30 10h20" stroke="currentColor" stroke-width="1.5" fill="oklch(0.28 0.08 125 / 0.3)"/><path d="M22 50h36" stroke="currentColor" stroke-width="1"/><circle cx="32" cy="58" r="2" fill="currentColor"/><circle cx="46" cy="62" r="1.5" fill="currentColor"/><circle cx="40" cy="54" r="1.5" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 10L64 56H16z" fill="oklch(0.28 0.08 125 / 0.4)" stroke="currentColor" stroke-width="1.5"/><path d="M40 10L40 56M28 32L52 32" stroke="currentColor" stroke-width="1"/></svg>',
  ],
  phys: [
    '<svg viewBox="0 0 80 80" fill="none"><line x1="20" y1="10" x2="20" y2="18" stroke="currentColor" stroke-width="1.5"/><path d="M20 18L44 66" stroke="currentColor" stroke-width="1.5"/><circle cx="44" cy="66" r="6" fill="currentColor"/><path d="M8 66 Q32 52 56 66" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3" fill="none"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 14L16 62h48z" stroke="currentColor" stroke-width="1.5" fill="oklch(0.28 0.08 215 / 0.3)"/><line x1="8" y1="44" x2="26" y2="44" stroke="oklch(0.92 0.08 215)" stroke-width="1.5"/><line x1="52" y1="40" x2="72" y2="30" stroke="oklch(0.85 0.14 85)" stroke-width="1"/><line x1="52" y1="44" x2="72" y2="44" stroke="oklch(0.75 0.16 15)" stroke-width="1"/><line x1="52" y1="48" x2="72" y2="58" stroke="oklch(0.72 0.17 295)" stroke-width="1"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><rect x="18" y="28" width="44" height="24" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M18 32H8M18 40H8M18 48H8M62 32h10M62 40h10M62 48h10" stroke="currentColor" stroke-width="1.5"/><text x="40" y="46" text-anchor="middle" font-family="Space Grotesk" font-size="10" fill="currentColor" stroke="none">N S</text></svg>',
  ],
  env: [
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 10c6 6 9 14 9 22a9 9 0 01-18 0c0-8 3-16 9-22z" fill="oklch(0.28 0.08 140 / 0.4)" stroke="currentColor" stroke-width="1.5"/><line x1="40" y1="32" x2="40" y2="70" stroke="currentColor" stroke-width="1.5"/><line x1="28" y1="62" x2="52" y2="62" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M40 10C30 24 18 36 18 50a22 22 0 0044 0c0-14-12-26-22-40z" fill="oklch(0.28 0.08 215 / 0.4)" stroke="currentColor" stroke-width="1.5"/><path d="M28 46c-2 6 4 12 10 12" stroke="oklch(0.92 0.08 215)" stroke-width="1.5" fill="none"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><path d="M14 40 Q40 6 66 40 Q40 74 14 40Z" fill="oklch(0.28 0.08 140 / 0.4)" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="40" x2="66" y2="40" stroke="currentColor" stroke-width="1"/></svg>',
  ],
  robo: [
    '<svg viewBox="0 0 80 80" fill="none"><rect x="32" y="54" width="16" height="10" fill="currentColor"/><rect x="28" y="60" width="24" height="6" fill="oklch(0.28 0.08 95)" stroke="currentColor" stroke-width="1"/><rect x="36" y="10" width="8" height="50" fill="oklch(0.28 0.08 95)" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="10" r="6" fill="currentColor"/><path d="M38 16l-6 6 6 6M42 16l6 6-6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="18" fill="oklch(0.28 0.08 95 / 0.4)" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="10" fill="currentColor"/><circle cx="37" cy="38" r="3" fill="oklch(0.18 0.04 265)"/><path d="M40 22V14M40 58v8M22 40H14M58 40h8" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><rect x="10" y="42" width="60" height="18" rx="9" fill="oklch(0.28 0.08 95)" stroke="currentColor" stroke-width="1.5"/><circle cx="22" cy="51" r="5" fill="oklch(0.18 0.04 265)" stroke="currentColor" stroke-width="1"/><circle cx="40" cy="51" r="5" fill="oklch(0.18 0.04 265)" stroke="currentColor" stroke-width="1"/><circle cx="58" cy="51" r="5" fill="oklch(0.18 0.04 265)" stroke="currentColor" stroke-width="1"/></svg>',
  ],
  elec: [
    '<svg viewBox="0 0 80 80" fill="none"><rect x="22" y="34" width="36" height="12" fill="oklch(0.28 0.08 275)" stroke="currentColor" stroke-width="1.5"/><rect x="26" y="38" width="4" height="4" fill="oklch(0.85 0.14 85)"/><rect x="32" y="38" width="4" height="4" fill="currentColor"/><rect x="38" y="38" width="4" height="4" fill="oklch(0.85 0.14 85)"/><rect x="44" y="38" width="4" height="4" fill="currentColor"/><path d="M8 40h14M58 40h14" stroke="currentColor" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><rect x="20" y="24" width="36" height="32" fill="oklch(0.28 0.08 275)" stroke="currentColor" stroke-width="1.5"/><rect x="56" y="32" width="4" height="16" fill="currentColor"/><text x="38" y="44" text-anchor="middle" font-family="Space Grotesk" font-size="14" fill="currentColor" stroke="none" font-weight="600">+</text></svg>',
    '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="6" fill="currentColor"/><circle cx="20" cy="20" r="4" fill="currentColor" opacity="0.7"/><circle cx="60" cy="20" r="4" fill="currentColor" opacity="0.7"/><circle cx="20" cy="60" r="4" fill="currentColor" opacity="0.7"/><circle cx="60" cy="60" r="4" fill="currentColor" opacity="0.7"/><path d="M40 40l-18-18M40 40l18-18M40 40l-18 18M40 40l18 18" stroke="currentColor" stroke-width="1"/></svg>',
  ],
};

window.ICONS = ICONS;
window.MASCOTS = MASCOTS;
window.PROPS = PROPS;
