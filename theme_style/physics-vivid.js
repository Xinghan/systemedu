/* ========================================================
   Physics Sub-Disciplines — Professional + Sci-Fi
   Two style explorations:
     A · TECHNICAL (CAD blueprint — precise, professional)
     B · HOLOGRAM  (sci-fi glass HUD — layered, advanced)
======================================================== */

const PHYS_SUBS = [
  {id:'mech',  title:'Classical Mechanics',  chinese:'经典力学',    code:'PHY-M1', hue:'#f97316', hueSoft:'rgba(249,115,22,0.15)',  tagline:'Forces, motion, and Newton\'s three laws.', formula:'F = ma · p = mv · E = ½mv²'},
  {id:'em',    title:'Electromagnetism',     chinese:'电磁学',       code:'PHY-M2', hue:'#8b5cf6', hueSoft:'rgba(139,92,246,0.15)', tagline:'Maxwell\'s unified field — electricity coupled to magnetism.', formula:'∇×B = μ₀J + μ₀ε₀ ∂E/∂t'},
  {id:'opt',   title:'Optics',               chinese:'光学',         code:'PHY-M3', hue:'#eab308', hueSoft:'rgba(234,179,8,0.15)',  tagline:'Light refracted, reflected, diffracted.', formula:'1/f = 1/u + 1/v'},
  {id:'thermo',title:'Thermodynamics',       chinese:'热力学',       code:'PHY-M4', hue:'#ef4444', hueSoft:'rgba(239,68,68,0.15)',  tagline:'Heat, work, and the arrow of time.', formula:'dS ≥ dQ/T · PV = nRT'},
  {id:'rel',   title:'Relativity',           chinese:'相对论',       code:'PHY-M5', hue:'#a855f7', hueSoft:'rgba(168,85,247,0.15)', tagline:'Spacetime bends. Clocks slow near c.', formula:'E = mc² · ds² = −c²dt² + dx²'},
  {id:'qm',    title:'Quantum Mechanics',    chinese:'量子力学',     code:'PHY-M6', hue:'#d946ef', hueSoft:'rgba(217,70,239,0.15)', tagline:'Particles that are waves — welcome to the small.', formula:'iℏ ∂ψ/∂t = Ĥψ · ΔxΔp ≥ ℏ/2'},
  {id:'aco',   title:'Acoustics',            chinese:'声学',         code:'PHY-M7', hue:'#06b6d4', hueSoft:'rgba(6,182,212,0.15)',  tagline:'Pressure waves through matter.', formula:'v = fλ · I = P/4πr²'},
];

/* =================================================================
   STYLE A — TECHNICAL BLUEPRINT
   CAD drafting aesthetic. Light off-white paper, precise linework,
   construction lines, dimensions, callouts with ISO-style tick marks.
   Feels like engineering documentation — authoritative, professional.
================================================================= */

// Shared utility: a tech icon in blueprint style
const tek = (hue, inner) => `<svg viewBox="0 0 100 100"><defs><pattern id="tg${hue.replace('#','')}" patternUnits="userSpaceOnUse" width="10" height="10"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" stroke-width="0.3" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(#tg${hue.replace('#','')})"/><g stroke="#0f172a" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

// Shared utility: a tech diagram (full plate, with title block + dims)
const tekObj = (hue, title, code, inner) => `<svg viewBox="0 0 200 200">
  <defs>
    <pattern id="tp${code}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#475569" stroke-width="0.25" opacity="0.15"/></pattern>
  </defs>
  <rect width="200" height="200" fill="url(#tp${code})"/>
  <rect x="4" y="4" width="192" height="192" fill="none" stroke="#0f172a" stroke-width="0.8"/>
  <rect x="4" y="168" width="192" height="28" fill="none" stroke="#0f172a" stroke-width="0.8"/>
  <line x1="100" y1="168" x2="100" y2="196" stroke="#0f172a" stroke-width="0.6"/>
  <line x1="160" y1="168" x2="160" y2="196" stroke="#0f172a" stroke-width="0.6"/>
  <g font-family="JetBrains Mono, monospace" font-size="7" fill="#0f172a" letter-spacing="0.1em">
    <text x="10" y="179">${title}</text>
    <text x="10" y="191" opacity="0.6">SCALE 1:1 · ISO-A</text>
    <text x="107" y="179" opacity="0.7">${code}</text>
    <text x="107" y="191" opacity="0.5">REV 01</text>
    <text x="166" y="179" opacity="0.7">SHT 1/1</text>
    <text x="166" y="191" fill="${hue}">●</text><text x="175" y="191" opacity="0.5">PHY</text>
  </g>
  <g stroke="#0f172a" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

const TECHNICAL = {
  mech: {
    icons: [
      tek('#f97316', `
        <circle cx="50" cy="28" r="9" stroke-width="1.4"/>
        <line x1="50" y1="37" x2="50" y2="72" stroke-width="1.4"/>
        <path d="M45 68 L50 75 L55 68" stroke-width="1.4"/>
        <line x1="20" y1="84" x2="80" y2="84" stroke="#f97316" stroke-width="1.6"/>
        <line x1="20" y1="82" x2="20" y2="86"/><line x1="80" y1="82" x2="80" y2="86"/>
      `),
      tek('#f97316', `
        <line x1="10" y1="84" x2="90" y2="84" stroke-width="1.4"/>
        <path d="M10 84 Q 50 8 90 84" stroke-dasharray="2 2" stroke="#f97316" stroke-width="1.2"/>
        <circle cx="10" cy="84" r="3" fill="#0f172a"/>
        <g transform="translate(10 84)"><line x1="0" y1="0" x2="18" y2="-18" stroke="#f97316" stroke-width="1.4"/><path d="M13 -18 L18 -18 L18 -13" stroke="#f97316"/></g>
        <text x="30" y="18" font-family="JetBrains Mono" font-size="6" fill="#f97316" stroke="none">v₀ = 40 m/s</text>
      `),
      tek('#f97316', `
        <line x1="12" y1="55" x2="88" y2="55" stroke-width="1.6"/>
        <path d="M50 55 L44 72 L56 72 Z" fill="#f97316" fill-opacity="0.2" stroke-width="1.2"/>
        <rect x="14" y="42" width="14" height="13" stroke-width="1.3"/>
        <line x1="14" y1="42" x2="28" y2="55" stroke-width="0.6" opacity="0.5"/>
        <rect x="72" y="48" width="12" height="7" stroke-width="1.2"/>
        <g stroke="#f97316" stroke-width="1"><line x1="14" y1="38" x2="28" y2="38"/><line x1="14" y1="36" x2="14" y2="40"/><line x1="28" y1="36" x2="28" y2="40"/></g>
        <text x="15" y="32" font-family="JetBrains Mono" font-size="5" fill="#f97316" stroke="none">W</text>
      `),
      tek('#f97316', `
        <circle cx="38" cy="55" r="14" stroke-width="1.3"/>
        <circle cx="38" cy="55" r="4" fill="#0f172a"/>
        ${Array.from({length:10},(_,i)=>{const a=i*36*Math.PI/180;return `<line x1="${38+Math.cos(a)*14}" y1="${55+Math.sin(a)*14}" x2="${38+Math.cos(a)*17}" y2="${55+Math.sin(a)*17}" stroke-width="1"/>`}).join('')}
        <circle cx="68" cy="55" r="9" stroke-width="1.3"/>
        <circle cx="68" cy="55" r="2.5" fill="#0f172a"/>
        ${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180;return `<line x1="${68+Math.cos(a)*9}" y1="${55+Math.sin(a)*9}" x2="${68+Math.cos(a)*11.5}" y2="${55+Math.sin(a)*11.5}" stroke-width="1"/>`}).join('')}
        <path d="M 24 42 Q 20 30 34 26" stroke="#f97316" stroke-width="0.8" stroke-dasharray="1 1.5" fill="none"/>
      `),
    ],
    objects: [
      { name:'SIMPLE PENDULUM', svg:tekObj('#f97316','PENDULUM ASSY','P-M1-A01',`
        <line x1="30" y1="28" x2="170" y2="28" stroke-width="1.6"/>
        <g stroke-width="0.6" opacity="0.5">${Array.from({length:10},(_,i)=>`<line x1="${32+i*15}" y1="28" x2="${38+i*15}" y2="22"/>`).join('')}</g>
        <rect x="88" y="28" width="24" height="6" stroke-width="1.2"/>
        <circle cx="100" cy="31" r="1.3" fill="#0f172a"/>
        <line x1="100" y1="34" x2="148" y2="115" stroke-width="1.2"/>
        <line x1="100" y1="34" x2="100" y2="145" stroke-dasharray="2 2" stroke-width="0.6" opacity="0.6"/>
        <circle cx="148" cy="115" r="13" stroke-width="1.4" fill="#fff"/>
        <line x1="135" y1="115" x2="161" y2="115" stroke-width="0.4"/>
        <line x1="148" y1="102" x2="148" y2="128" stroke-width="0.4"/>
        <path d="M 100 70 A 45 45 0 0 0 128 54" stroke="#f97316" stroke-width="0.8" fill="none"/>
        <text x="108" y="58" font-family="JetBrains Mono" font-size="7" fill="#f97316" stroke="none">θ</text>
        <g stroke="#f97316" stroke-width="0.6">
          <line x1="170" y1="34" x2="170" y2="115"/>
          <line x1="167" y1="34" x2="173" y2="34"/>
          <line x1="167" y1="115" x2="173" y2="115"/>
          <text x="174" y="78" font-family="JetBrains Mono" font-size="6" stroke="none">L=1.20m</text>
        </g>
        <g stroke="#0f172a" stroke-width="0.6">
          <circle cx="100" cy="34" r="2" fill="none"/>
          <text x="78" y="20" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">PIVOT ⊕</text>
          <text x="134" y="142" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">M=0.50kg</text>
        </g>
        <line x1="132" y1="120" x2="138" y2="125" stroke-width="0.5"/>
      `)},
      { name:'INCLINED PLANE FBD', svg:tekObj('#f97316','INCLINE · FBD','P-M1-A02',`
        <path d="M30 145 L170 145 L170 58 Z" stroke-width="1.4"/>
        <g stroke-width="0.5" opacity="0.4">${Array.from({length:8},(_,i)=>`<line x1="${40+i*15}" y1="145" x2="${55+i*15}" y2="145" transform="translate(0 3)"/>`).join('')}</g>
        <g transform="translate(115 92) rotate(-38.7)">
          <rect x="-16" y="-16" width="32" height="32" stroke-width="1.4" fill="#fff"/>
          <line x1="-16" y1="0" x2="16" y2="0" stroke-width="0.4" opacity="0.3"/>
          <line x1="0" y1="-16" x2="0" y2="16" stroke-width="0.4" opacity="0.3"/>
        </g>
        <g stroke="#f97316" stroke-width="1.4">
          <line x1="115" y1="92" x2="160" y2="92"/><path d="M156 88 L162 92 L156 96"/>
          <text x="138" y="88" font-family="JetBrains Mono" font-size="6" stroke="none">F∥</text>
        </g>
        <g stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2 2">
          <line x1="115" y1="92" x2="115" y2="135"/><path d="M111 131 L115 139 L119 131" stroke-dasharray="0"/>
          <text x="118" y="125" font-family="JetBrains Mono" font-size="6" stroke="none">mg</text>
        </g>
        <path d="M 55 145 A 22 22 0 0 0 63 128" stroke="#f97316" stroke-width="0.8" fill="none"/>
        <text x="52" y="138" font-family="JetBrains Mono" font-size="6" fill="#f97316" stroke="none">θ=38°</text>
        <g stroke="#f97316" stroke-width="0.5">
          <line x1="30" y1="152" x2="170" y2="152"/><line x1="30" y1="150" x2="30" y2="154"/><line x1="170" y1="150" x2="170" y2="154"/>
          <text x="88" y="162" font-family="JetBrains Mono" font-size="6" stroke="none">d=1.75m</text>
        </g>
      `)},
    ],
  },
  em: {
    icons: [
      tek('#8b5cf6', `<path d="M55 12 L40 48 L52 48 L35 88 L70 42 L58 42 L72 12 Z" stroke-width="1.4"/><line x1="10" y1="55" x2="30" y2="55" stroke="#8b5cf6" stroke-width="0.8"/><text x="5" y="65" font-family="JetBrains Mono" font-size="5" fill="#8b5cf6" stroke="none">E</text>`),
      tek('#8b5cf6', `<path d="M25 15 L25 65 Q25 75 40 75 L55 75 L55 45 Q55 35 45 35 L35 35 L35 55 L45 55" stroke-width="1.4"/><path d="M75 15 L75 65 Q75 75 60 75 L55 75" stroke-width="1.4"/><rect x="20" y="8" width="15" height="10" stroke-width="1"/><rect x="65" y="8" width="15" height="10" stroke-width="1"/><text x="23" y="16" font-family="JetBrains Mono" font-size="5" fill="#8b5cf6" stroke="none">N</text><text x="68" y="16" font-family="JetBrains Mono" font-size="5" fill="#8b5cf6" stroke="none">S</text>`),
      tek('#8b5cf6', `<line x1="8" y1="50" x2="22" y2="50" stroke-width="1.4"/>${Array.from({length:6},(_,i)=>`<path d="M ${22+i*10} 50 A 5 10 0 1 1 ${32+i*10} 50" stroke-width="1.4"/>`).join('')}<line x1="82" y1="50" x2="94" y2="50" stroke-width="1.4"/><text x="40" y="30" font-family="JetBrains Mono" font-size="5" fill="#8b5cf6" stroke="none">L = 5mH</text>`),
      tek('#8b5cf6', `<circle cx="50" cy="50" r="4" fill="#8b5cf6"/><circle cx="50" cy="50" r="15" stroke-width="1.2"/><circle cx="50" cy="50" r="26" stroke-width="1" stroke-dasharray="2 2"/><circle cx="50" cy="50" r="37" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.6"/><line x1="50" y1="50" x2="72" y2="28" stroke="#8b5cf6" stroke-width="1.2"/><path d="M67 28 L72 28 L72 33" stroke="#8b5cf6" stroke-width="1.2"/>`),
    ],
    objects: [
      { name:'SOLENOID', svg:tekObj('#8b5cf6','SOLENOID COIL','P-M2-A01',`
        <rect x="30" y="82" width="140" height="40" stroke-width="1.4" fill="#fff"/>
        <g stroke-width="0.5" opacity="0.3">${Array.from({length:7},(_,i)=>`<line x1="30" y1="${86+i*5}" x2="170" y2="${86+i*5}"/>`).join('')}</g>
        ${Array.from({length:13},(_,i)=>`<ellipse cx="${40+i*10}" cy="102" rx="5" ry="18" stroke="#8b5cf6" stroke-width="1.4" fill="none"/>`).join('')}
        <line x1="12" y1="102" x2="32" y2="102" stroke-width="1.6"/><line x1="168" y1="102" x2="188" y2="102" stroke-width="1.6"/>
        <circle cx="10" cy="102" r="2.5" fill="#0f172a"/><circle cx="190" cy="102" r="2.5" fill="#0f172a"/>
        <g stroke="#8b5cf6" stroke-width="1" fill="none" stroke-dasharray="3 2"><path d="M 40 56 Q 100 38 160 56"/><path d="M 40 148 Q 100 166 160 148"/><path d="M 154 54 L 162 56 L 157 62"/></g>
        <text x="86" y="50" font-family="JetBrains Mono" font-size="6" fill="#8b5cf6" stroke="none">B field</text>
        <g stroke="#8b5cf6" stroke-width="0.5">
          <line x1="30" y1="130" x2="170" y2="130"/><line x1="30" y1="128" x2="30" y2="132"/><line x1="170" y1="128" x2="170" y2="132"/>
          <text x="82" y="140" font-family="JetBrains Mono" font-size="6" stroke="none">L=140mm</text>
        </g>
        <text x="12" y="96" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">+</text>
        <text x="186" y="96" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">−</text>
      `)},
      { name:'PARALLEL-PLATE CAP', svg:tekObj('#8b5cf6','CAPACITOR','P-M2-A02',`
        <line x1="20" y1="100" x2="85" y2="100" stroke-width="1.4"/>
        <line x1="85" y1="40" x2="85" y2="155" stroke-width="2" stroke="#8b5cf6"/>
        <line x1="115" y1="40" x2="115" y2="155" stroke-width="2" stroke="#0f172a"/>
        <line x1="115" y1="100" x2="180" y2="100" stroke-width="1.4"/>
        <g stroke="#8b5cf6" stroke-width="0.9">${Array.from({length:8},(_,i)=>`<line x1="89" y1="${50+i*14}" x2="111" y2="${50+i*14}"/><path d="M 108 ${48+i*14} L 112 ${50+i*14} L 108 ${52+i*14}" fill="none"/>`).join('')}</g>
        <g stroke="#8b5cf6" stroke-width="0.5">
          <line x1="85" y1="160" x2="115" y2="160"/><line x1="85" y1="158" x2="85" y2="162"/><line x1="115" y1="158" x2="115" y2="162"/>
          <text x="94" y="151" font-family="JetBrains Mono" font-size="6" stroke="none">d</text>
        </g>
        <text x="70" y="36" font-family="JetBrains Mono" font-size="7" fill="#8b5cf6" stroke="none">+Q</text>
        <text x="118" y="36" font-family="JetBrains Mono" font-size="7" fill="#0f172a" stroke="none">−Q</text>
        <g fill="none" stroke="#0f172a" stroke-width="0.5" opacity="0.5">
          <circle cx="20" cy="100" r="2"/><circle cx="180" cy="100" r="2"/>
        </g>
      `)},
    ],
  },
  opt: {
    icons: [
      tek('#eab308',`<path d="M50 20 L80 75 L20 75 Z" stroke-width="1.4"/><line x1="5" y1="45" x2="38" y2="58" stroke="#eab308" stroke-width="1.4"/><line x1="62" y1="58" x2="92" y2="40" stroke="#ef4444" stroke-width="1"/><line x1="62" y1="58" x2="93" y2="50" stroke="#f59e0b" stroke-width="1"/><line x1="62" y1="58" x2="94" y2="60" stroke="#eab308" stroke-width="1"/><line x1="62" y1="58" x2="93" y2="70" stroke="#22c55e" stroke-width="1"/><line x1="62" y1="58" x2="90" y2="80" stroke="#3b82f6" stroke-width="1"/>`),
      tek('#eab308',`<path d="M10 50 Q50 18 90 50 Q50 82 10 50 Z" stroke-width="1.4"/><circle cx="50" cy="50" r="15" stroke-width="1"/><circle cx="50" cy="50" r="7" stroke-width="1" fill="#0f172a"/><line x1="10" y1="50" x2="90" y2="50" stroke-width="0.4" stroke-dasharray="2 2" opacity="0.5"/>`),
      tek('#eab308',`<circle cx="40" cy="40" r="22" stroke-width="1.4"/><line x1="56" y1="56" x2="85" y2="85" stroke-width="2.5"/><line x1="40" y1="18" x2="40" y2="62" stroke-width="0.4" opacity="0.3"/><line x1="18" y1="40" x2="62" y2="40" stroke-width="0.4" opacity="0.3"/>`),
      tek('#eab308',`<path d="M5 50 Q15 22 25 50 T45 50 T65 50 T85 50 T95 50" stroke-width="1.4"/><line x1="5" y1="50" x2="95" y2="50" stroke-width="0.3" stroke-dasharray="2 2" opacity="0.5"/><line x1="25" y1="30" x2="45" y2="30" stroke="#eab308" stroke-width="0.8"/><text x="30" y="26" font-family="JetBrains Mono" font-size="5" fill="#eab308" stroke="none">λ</text>`),
    ],
    objects: [
      { name:'DISPERSION PRISM', svg:tekObj('#eab308','PRISM · DISP','P-M3-A01',`
        <path d="M100 40 L165 140 L35 140 Z" stroke-width="1.4" fill="#fff"/>
        <line x1="10" y1="78" x2="72" y2="105" stroke="#eab308" stroke-width="1.6"/>
        <text x="14" y="72" font-family="JetBrains Mono" font-size="6" fill="#eab308" stroke="none">white</text>
        <g stroke-width="1.2">
          <line x1="128" y1="105" x2="190" y2="82" stroke="#dc2626"/>
          <line x1="128" y1="105" x2="192" y2="94" stroke="#f59e0b"/>
          <line x1="128" y1="105" x2="193" y2="108" stroke="#eab308"/>
          <line x1="128" y1="105" x2="192" y2="122" stroke="#22c55e"/>
          <line x1="128" y1="105" x2="190" y2="136" stroke="#0ea5e9"/>
          <line x1="128" y1="105" x2="186" y2="150" stroke="#8b5cf6"/>
        </g>
        <line x1="72" y1="105" x2="128" y2="105" stroke="#eab308" stroke-width="0.5" stroke-dasharray="2 2"/>
        <path d="M 72 105 A 12 12 0 0 0 80 95" stroke="#0f172a" stroke-width="0.4" fill="none"/>
        <text x="75" y="100" font-family="JetBrains Mono" font-size="5" fill="#0f172a" stroke="none">θ₁</text>
        <text x="170" y="78" font-family="JetBrains Mono" font-size="5" fill="#dc2626" stroke="none">R 700</text>
        <text x="170" y="154" font-family="JetBrains Mono" font-size="5" fill="#8b5cf6" stroke="none">V 400</text>
        <g stroke="#eab308" stroke-width="0.5">
          <line x1="35" y1="150" x2="165" y2="150"/><line x1="35" y1="148" x2="35" y2="152"/><line x1="165" y1="148" x2="165" y2="152"/>
          <text x="78" y="160" font-family="JetBrains Mono" font-size="6" stroke="none">n=1.52</text>
        </g>
      `)},
      { name:'CONVEX LENS', svg:tekObj('#eab308','LENS · BICONVEX','P-M3-A02',`
        <path d="M100 35 Q70 100 100 165 Q130 100 100 35 Z" stroke-width="1.4" fill="#fff"/>
        <line x1="10" y1="100" x2="190" y2="100" stroke="#0f172a" stroke-width="0.5" stroke-dasharray="2 2"/>
        <g stroke="#eab308" stroke-width="1.2">
          <line x1="15" y1="72" x2="92" y2="72"/><line x1="92" y1="72" x2="165" y2="100"/>
          <line x1="15" y1="100" x2="108" y2="100"/><line x1="108" y1="100" x2="165" y2="100"/>
          <line x1="15" y1="128" x2="92" y2="128"/><line x1="92" y1="128" x2="165" y2="100"/>
        </g>
        <circle cx="165" cy="100" r="3" fill="#dc2626"/>
        <g stroke="#0f172a" stroke-width="0.4">
          <line x1="60" y1="100" x2="60" y2="96"/><circle cx="60" cy="100" r="1.5"/>
          <line x1="140" y1="100" x2="140" y2="96"/><circle cx="140" cy="100" r="1.5"/>
        </g>
        <text x="53" y="115" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">F₁</text>
        <text x="134" y="115" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">F₂</text>
        <g stroke="#eab308" stroke-width="0.5">
          <line x1="100" y1="30" x2="140" y2="30"/><line x1="100" y1="28" x2="100" y2="32"/><line x1="140" y1="28" x2="140" y2="32"/>
          <text x="108" y="26" font-family="JetBrains Mono" font-size="6" stroke="none">f=40mm</text>
        </g>
        <text x="18" y="64" font-family="JetBrains Mono" font-size="5" fill="#eab308" stroke="none">parallel rays</text>
      `)},
    ],
  },
  thermo: {
    icons: [
      tek('#ef4444',`<rect x="42" y="16" width="16" height="55" rx="3" stroke-width="1.3"/><circle cx="50" cy="78" r="12" stroke-width="1.3" fill="#ef4444" fill-opacity="0.3"/><line x1="50" y1="28" x2="50" y2="78" stroke="#ef4444" stroke-width="2.5"/><line x1="58" y1="28" x2="64" y2="28" stroke-width="0.8"/><line x1="58" y1="40" x2="62" y2="40" stroke-width="0.8"/><line x1="58" y1="52" x2="64" y2="52" stroke-width="0.8"/>`),
      tek('#ef4444',`<path d="M40 85 Q25 65 45 55 Q60 45 50 30 Q38 15 48 5" stroke="#ef4444" stroke-width="1.3"/><path d="M55 85 Q40 60 60 50 Q75 40 65 25 Q53 10 63 0" stroke="#ef4444" stroke-width="1.3" opacity="0.6"/><line x1="10" y1="90" x2="90" y2="90" stroke-width="0.8"/><line x1="30" y1="90" x2="30" y2="94" stroke-width="0.5"/><line x1="70" y1="90" x2="70" y2="94" stroke-width="0.5"/>`),
      tek('#ef4444',`<rect x="10" y="10" width="80" height="80" stroke-width="1.3"/>${Array.from({length:10},(_,i)=>{const x=18+(i*8)%64;const y=18+Math.floor(i/5)*28;return `<circle cx="${x+Math.random()*10}" cy="${y+Math.random()*20}" r="2" fill="#ef4444"/>`}).join('')}<text x="14" y="22" font-family="JetBrains Mono" font-size="5" fill="#ef4444" stroke="none">n·kB·T</text>`),
      tek('#ef4444',`<rect x="15" y="42" width="70" height="32" stroke-width="1.3"/><rect x="30" y="18" width="40" height="24" stroke-width="1.3"/><line x1="30" y1="42" x2="30" y2="18" stroke-width="0.5" opacity="0.4"/><circle cx="38" cy="56" r="2" fill="#ef4444"/><circle cx="50" cy="56" r="2" fill="#ef4444"/><circle cx="62" cy="56" r="2" fill="#ef4444"/><text x="18" y="88" font-family="JetBrains Mono" font-size="5" fill="#ef4444" stroke="none">HOT · Tₕ</text>`),
    ],
    objects: [
      { name:'CARNOT CYCLE', svg:tekObj('#ef4444','P-V DIAGRAM','P-M4-A01',`
        <line x1="30" y1="148" x2="170" y2="148" stroke-width="1.4"/>
        <line x1="30" y1="20" x2="30" y2="148" stroke-width="1.4"/>
        <path d="M140 148 L144 144 M140 148 L144 152" stroke-width="1"/>
        <path d="M26 24 L30 20 L34 24" stroke-width="1"/>
        <text x="16" y="22" font-family="JetBrains Mono" font-size="7" stroke="none">P</text>
        <text x="170" y="158" font-family="JetBrains Mono" font-size="7" stroke="none">V</text>
        <g stroke-width="0.4" opacity="0.4">${Array.from({length:5},(_,i)=>`<line x1="30" y1="${40+i*22}" x2="32" y2="${40+i*22}"/>`).join('')}${Array.from({length:5},(_,i)=>`<line x1="${60+i*22}" y1="146" x2="${60+i*22}" y2="148"/>`).join('')}</g>
        <path d="M55 52 Q95 44 145 50 L158 98 Q100 118 58 102 Z" stroke="#ef4444" stroke-width="1.4" fill="#ef4444" fill-opacity="0.1"/>
        <path d="M55 52 Q95 44 145 50" stroke="#dc2626" stroke-width="1.6" fill="none"/>
        <path d="M145 50 L158 98" stroke="#f59e0b" stroke-width="1.4" fill="none" stroke-dasharray="2 2"/>
        <path d="M158 98 Q100 118 58 102" stroke="#3b82f6" stroke-width="1.6" fill="none"/>
        <path d="M58 102 L55 52" stroke="#f59e0b" stroke-width="1.4" fill="none" stroke-dasharray="2 2"/>
        <g fill="#0f172a">
          <circle cx="55" cy="52" r="2.2"/><circle cx="145" cy="50" r="2.2"/>
          <circle cx="158" cy="98" r="2.2"/><circle cx="58" cy="102" r="2.2"/>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="42" y="50">A</text><text x="148" y="46">B</text>
          <text x="162" y="102">C</text><text x="44" y="106">D</text>
        </g>
        <text x="78" y="82" font-family="JetBrains Mono" font-size="6" fill="#dc2626" stroke="none">η = 1 − Tc/Th</text>
      `)},
      { name:'HEAT ENGINE', svg:tekObj('#ef4444','ENGINE · CARNOT','P-M4-A02',`
        <rect x="35" y="22" width="130" height="26" stroke-width="1.4" fill="#ef4444" fill-opacity="0.15"/>
        <rect x="35" y="120" width="130" height="26" stroke-width="1.4" fill="#3b82f6" fill-opacity="0.15"/>
        <circle cx="100" cy="84" r="24" stroke-width="1.4" fill="#fff"/>
        <circle cx="100" cy="84" r="18" stroke-width="0.6" stroke-dasharray="2 2"/>
        ${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180;return `<line x1="${100+Math.cos(a)*18}" y1="${84+Math.sin(a)*18}" x2="${100+Math.cos(a)*24}" y2="${84+Math.sin(a)*24}" stroke-width="1"/>`}).join('')}
        <circle cx="100" cy="84" r="3" fill="#0f172a"/>
        <g stroke="#dc2626" stroke-width="1.4" fill="#dc2626">
          <line x1="100" y1="50" x2="100" y2="58"/><path d="M96 58 L100 64 L104 58"/>
        </g>
        <g stroke="#3b82f6" stroke-width="1.4" fill="#3b82f6">
          <line x1="100" y1="110" x2="100" y2="118"/><path d="M96 110 L100 104 L104 110"/>
        </g>
        <g stroke="#22c55e" stroke-width="1.4" fill="#22c55e">
          <line x1="126" y1="84" x2="168" y2="84"/><path d="M164 80 L172 84 L164 88"/>
        </g>
        <g font-family="JetBrains Mono" font-size="7" fill="#0f172a" stroke="none">
          <text x="78" y="40">Tₕ = 600K</text>
          <text x="78" y="140">Tc = 300K</text>
          <text x="82" y="72">Qh</text>
          <text x="82" y="100">Qc</text>
          <text x="140" y="80">W</text>
        </g>
      `)},
    ],
  },
  rel: {
    icons: [
      tek('#a855f7',`${Array.from({length:6},(_,i)=>{const y=16+i*13;return `<path d="M 8 ${y} Q 50 ${y+12-Math.abs(i-2.5)*3.2} 92 ${y}" stroke="#a855f7" stroke-width="0.9"/>`}).join('')}<circle cx="50" cy="55" r="8" fill="#0f172a"/><circle cx="50" cy="55" r="8" stroke="#a855f7" stroke-width="0.8" fill="none" opacity="0.5" transform="translate(4 4)"/>`),
      tek('#a855f7',`<circle cx="28" cy="50" r="18" stroke-width="1.3"/><line x1="28" y1="50" x2="28" y2="36" stroke-width="1.2"/><line x1="28" y1="50" x2="38" y2="50" stroke-width="0.9"/><circle cx="28" cy="50" r="1.5" fill="#0f172a"/><circle cx="72" cy="52" r="13" stroke-width="1.3"/><line x1="72" y1="52" x2="72" y2="42" stroke-width="1"/><path d="M 48 52 L 58 52" stroke="#a855f7" stroke-width="0.8" stroke-dasharray="2 2"/><text x="45" y="80" font-family="JetBrains Mono" font-size="5" fill="#a855f7" stroke="none">Δt'=γΔt</text>`),
      tek('#a855f7',`<circle cx="50" cy="50" r="32" stroke-width="1.3" fill="#0f172a"/><circle cx="50" cy="50" r="32" stroke="#a855f7" stroke-width="0.6" stroke-dasharray="2 2" fill="none" transform="translate(1 -1)"/><ellipse cx="50" cy="50" rx="32" ry="9" stroke="#eab308" stroke-width="1" fill="none"/><circle cx="50" cy="50" r="16" fill="#000" stroke="#a855f7" stroke-width="0.6"/>`),
      tek('#a855f7',`<rect x="15" y="35" width="70" height="30" stroke-width="1.3"/><text x="50" y="57" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="16" fill="#0f172a" stroke="none">E=mc²</text><text x="17" y="32" font-family="JetBrains Mono" font-size="5" fill="#a855f7" stroke="none">EINSTEIN · 1905</text>`),
    ],
    objects: [
      { name:'LIGHT CONE', svg:tekObj('#a855f7','MINKOWSKI','P-M5-A01',`
        <line x1="20" y1="90" x2="180" y2="90" stroke-width="0.5" stroke-dasharray="2 2"/>
        <line x1="100" y1="18" x2="100" y2="162" stroke-width="0.5" stroke-dasharray="2 2"/>
        <path d="M100 90 L35 20 L165 20 Z" stroke-width="1.4" fill="#a855f7" fill-opacity="0.1"/>
        <path d="M100 90 L35 160 L165 160 Z" stroke-width="1.4" fill="#a855f7" fill-opacity="0.1"/>
        <ellipse cx="100" cy="20" rx="65" ry="5" stroke="#a855f7" stroke-width="0.8" stroke-dasharray="2 1" fill="none"/>
        <ellipse cx="100" cy="160" rx="65" ry="5" stroke="#a855f7" stroke-width="0.8" stroke-dasharray="2 1" fill="none"/>
        <circle cx="100" cy="90" r="3" fill="#dc2626"/>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="106" y="22">t (FUTURE)</text>
          <text x="106" y="156">(PAST)</text>
          <text x="164" y="86">x</text>
          <text x="62" y="86">NOW</text>
          <text x="106" y="50">timelike</text>
          <text x="140" y="48">ds²&lt;0</text>
        </g>
        <g stroke="#a855f7" stroke-width="1" fill="none">
          <line x1="100" y1="90" x2="60" y2="50"/><path d="M64 46 L58 52 L64 54"/>
        </g>
      `)},
      { name:'GRAVITY WELL', svg:tekObj('#a855f7','SPACETIME CURVE','P-M5-A02',`
        <g stroke-width="0.7">${Array.from({length:9},(_,i)=>{const y=25+i*13;const dip=18-Math.abs(i-4)*3.3;return `<path d="M 15 ${y} Q 65 ${y+dip*0.3} 100 ${y+dip} Q 135 ${y+dip*0.3} 185 ${y}" stroke="#a855f7" fill="none"/>`}).join('')}</g>
        <g stroke-width="0.5" opacity="0.5">${Array.from({length:8},(_,i)=>{const x=20+i*20;return `<path d="M ${x} 20 Q ${x+(100-x)*0.3} 108 100 118 Q ${100+(x-100)*0.3} ${108+(x-100)*0.08} ${200-x} 155" stroke="#a855f7" fill="none"/>`}).join('')}</g>
        <circle cx="100" cy="118" r="12" fill="#0f172a" stroke="#a855f7" stroke-width="1"/>
        <circle cx="96" cy="113" r="3" fill="#a855f7" opacity="0.6"/>
        <ellipse cx="150" cy="104" rx="28" ry="7" stroke="#eab308" stroke-width="1" stroke-dasharray="2 2" fill="none"/>
        <circle cx="165" cy="100" r="3" fill="#eab308"/>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="104" y="122">M</text>
          <text x="155" y="95">m · orbit</text>
        </g>
        <g stroke="#a855f7" stroke-width="0.5">
          <line x1="100" y1="118" x2="138" y2="118"/>
          <line x1="100" y1="115" x2="100" y2="121"/>
          <line x1="138" y1="115" x2="138" y2="121"/>
          <text x="108" y="131" font-family="JetBrains Mono" font-size="5" stroke="none">r_s = 2GM/c²</text>
        </g>
      `)},
    ],
  },
  qm: {
    icons: [
      tek('#d946ef',`<circle cx="50" cy="50" r="4" fill="#d946ef"/>${[0,60,120].map(r=>`<ellipse cx="50" cy="50" rx="28" ry="9" stroke="#d946ef" stroke-width="1.1" fill="none" transform="rotate(${r} 50 50)"/>`).join('')}<circle cx="77" cy="52" r="2.5" fill="#0f172a"/><circle cx="36" cy="70" r="2.5" fill="#0f172a"/><circle cx="36" cy="30" r="2.5" fill="#0f172a"/>`),
      tek('#d946ef',`<rect x="15" y="28" width="70" height="55" stroke-width="1.3"/><path d="M15 28 L50 15 L85 28" stroke-width="1.3" fill="none"/><path d="M50 15 L50 83" stroke-width="0.4" stroke-dasharray="2 2" opacity="0.4"/><circle cx="36" cy="55" r="3" stroke="#d946ef" stroke-width="0.8" fill="none"/><circle cx="64" cy="55" r="3" stroke="#d946ef" stroke-width="0.8" fill="none"/><text x="42" y="75" font-family="JetBrains Mono" font-size="8" fill="#d946ef" stroke="none">?</text>`),
      tek('#d946ef',`<path d="M5 50 Q15 25 25 50 T45 50" stroke="#d946ef" stroke-width="1.4" fill="none"/><circle cx="62" cy="50" r="5" stroke-width="1.2"/><circle cx="80" cy="50" r="5" stroke-width="1.2"/><line x1="48" y1="50" x2="55" y2="50" stroke="#d946ef" stroke-width="0.6" stroke-dasharray="1.5 1.5"/><text x="20" y="30" font-family="JetBrains Mono" font-size="5" fill="#d946ef" stroke="none">wave</text><text x="68" y="30" font-family="JetBrains Mono" font-size="5" fill="#d946ef" stroke="none">particle</text>`),
      tek('#d946ef',`<rect x="15" y="32" width="70" height="36" stroke-width="1.3"/><text x="50" y="60" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="24" fill="#0f172a" stroke="none">ψ</text><text x="17" y="28" font-family="JetBrains Mono" font-size="5" fill="#d946ef" stroke="none">SCHRÖDINGER</text>`),
    ],
    objects: [
      { name:'DOUBLE SLIT', svg:tekObj('#d946ef','YOUNG · 1801','P-M6-A01',`
        <circle cx="22" cy="85" r="4" fill="#eab308"/>
        <text x="6" y="78" font-family="JetBrains Mono" font-size="5" fill="#0f172a" stroke="none">source</text>
        <line x1="65" y1="22" x2="65" y2="150" stroke-width="1.6"/>
        <line x1="65" y1="68" x2="65" y2="76" stroke="#fff" stroke-width="3"/>
        <line x1="65" y1="94" x2="65" y2="102" stroke="#fff" stroke-width="3"/>
        <text x="40" y="18" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">barrier</text>
        <line x1="155" y1="22" x2="155" y2="150" stroke-width="1.6"/>
        ${Array.from({length:11},(_,i)=>{const y=30+i*11;const w=22+18*Math.abs(Math.sin(i*0.65));return `<rect x="156" y="${y}" width="${w}" height="6" fill="#d946ef" fill-opacity="${0.3+0.5*Math.abs(Math.sin(i*0.65))}" stroke="none"/>`}).join('')}
        <text x="157" y="18" font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">screen</text>
        <g stroke="#eab308" stroke-width="0.6" fill="none" opacity="0.5">
          <path d="M 26 85 Q 45 85 65 72"/><path d="M 26 85 Q 45 85 65 98"/>
          <path d="M 65 72 Q 110 60 154 50"/><path d="M 65 72 Q 110 80 154 80"/>
          <path d="M 65 98 Q 110 90 154 110"/><path d="M 65 98 Q 110 125 154 140"/>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="65" y1="156" x2="155" y2="156"/><line x1="65" y1="154" x2="65" y2="158"/><line x1="155" y1="154" x2="155" y2="158"/>
          <text x="98" y="152" font-family="JetBrains Mono" font-size="6" stroke="none">d=0.5m</text>
        </g>
      `)},
      { name:'BLOCH SPHERE', svg:tekObj('#d946ef','QUBIT STATE','P-M6-A02',`
        <circle cx="100" cy="85" r="55" stroke-width="1.3" fill="#fff"/>
        <ellipse cx="100" cy="85" rx="55" ry="18" stroke-width="0.6" stroke-dasharray="2 2" fill="none"/>
        <ellipse cx="100" cy="85" rx="18" ry="55" stroke-width="0.6" stroke-dasharray="2 2" fill="none"/>
        <line x1="100" y1="24" x2="100" y2="146" stroke-width="0.5" stroke-dasharray="2 2"/>
        <line x1="39" y1="85" x2="161" y2="85" stroke-width="0.5" stroke-dasharray="2 2"/>
        <line x1="100" y1="85" x2="140" y2="48" stroke="#d946ef" stroke-width="2"/>
        <polygon points="135,43 144,46 141,55" fill="#d946ef"/>
        <circle cx="100" cy="85" r="2.5" fill="#0f172a"/>
        <circle cx="140" cy="48" r="2.5" fill="#d946ef"/>
        <g font-family="JetBrains Mono" font-size="7" fill="#0f172a" stroke="none">
          <text x="88" y="22">|0⟩</text>
          <text x="88" y="156">|1⟩</text>
          <text x="164" y="88">x̂</text>
          <text x="143" y="44">|ψ⟩</text>
        </g>
        <path d="M 100 70 A 15 15 0 0 0 114 64" stroke="#d946ef" stroke-width="0.7" fill="none"/>
        <text x="106" y="72" font-family="JetBrains Mono" font-size="5" fill="#d946ef" stroke="none">θ</text>
      `)},
    ],
  },
  aco: {
    icons: [
      tek('#06b6d4',`<path d="M15 40 L15 60 L35 60 L55 80 L55 20 L35 40 Z" stroke-width="1.3" fill="#06b6d4" fill-opacity="0.15"/><path d="M65 32 Q78 50 65 68" stroke="#06b6d4" stroke-width="1.2"/><path d="M74 22 Q94 50 74 78" stroke="#06b6d4" stroke-width="1.2"/><text x="10" y="94" font-family="JetBrains Mono" font-size="5" fill="#06b6d4" stroke="none">85 dB</text>`),
      tek('#06b6d4',`<path d="M5 50 Q12 22 20 50 T35 50 T50 50 T65 50 T80 50 T95 50" stroke="#06b6d4" stroke-width="1.3"/><line x1="5" y1="50" x2="95" y2="50" stroke-width="0.3" stroke-dasharray="2 2"/>`),
      tek('#06b6d4',`${[12,25,38,46,58,70,82].map((h,i)=>`<rect x="${12+i*12}" y="${85-h}" width="7" height="${h}" stroke="#06b6d4" stroke-width="0.8" fill="#06b6d4" fill-opacity="${0.2+i*0.08}"/>`).join('')}`),
      tek('#06b6d4',`<circle cx="50" cy="50" r="4" fill="#06b6d4"/><circle cx="50" cy="50" r="14" stroke="#06b6d4" stroke-width="1.1" fill="none"/><circle cx="50" cy="50" r="24" stroke="#06b6d4" stroke-width="0.9" fill="none"/><circle cx="50" cy="50" r="34" stroke="#06b6d4" stroke-width="0.7" fill="none" opacity="0.6"/>`),
    ],
    objects: [
      { name:'TUNING FORK 440Hz', svg:tekObj('#06b6d4','A4 FORK','P-M7-A01',`
        <rect x="70" y="22" width="10" height="120" stroke-width="1.3" fill="#fff"/>
        <rect x="120" y="22" width="10" height="120" stroke-width="1.3" fill="#fff"/>
        <path d="M70 142 L58 154 L58 164 L142 164 L142 154 L130 142" stroke-width="1.3" fill="#06b6d4" fill-opacity="0.15"/>
        <g stroke="#06b6d4" stroke-width="0.8" fill="none" stroke-dasharray="2 2">
          <path d="M70 62 Q55 62 55 46"/><path d="M70 78 Q42 78 42 54"/>
          <path d="M130 62 Q145 62 145 46"/><path d="M130 78 Q158 78 158 54"/>
        </g>
        <g stroke="#06b6d4" stroke-width="1.2" fill="none">
          <path d="M 15 100 Q 22 92 28 100 T 40 100"/>
          <path d="M 160 100 Q 168 92 174 100 T 186 100"/>
        </g>
        <g stroke="#0f172a" stroke-width="0.5">
          <line x1="70" y1="16" x2="130" y2="16"/><line x1="70" y1="14" x2="70" y2="18"/><line x1="130" y1="14" x2="130" y2="18"/>
          <text x="85" y="12" font-family="JetBrains Mono" font-size="6" stroke="none">60mm</text>
        </g>
        <text x="80" y="30" font-family="JetBrains Mono" font-size="7" fill="#0f172a" stroke="none">440 Hz</text>
      `)},
      { name:'STANDING WAVE n=2', svg:tekObj('#06b6d4','STANDING','P-M7-A02',`
        <line x1="20" y1="85" x2="180" y2="85" stroke-width="0.5" stroke-dasharray="2 2"/>
        <line x1="20" y1="30" x2="20" y2="140" stroke-width="2"/>
        <line x1="180" y1="30" x2="180" y2="140" stroke-width="2"/>
        <path d="M20 85 Q60 28 100 85 T 180 85" stroke="#06b6d4" stroke-width="1.6" fill="none"/>
        <path d="M20 85 Q60 142 100 85 T 180 85" stroke="#06b6d4" stroke-width="1.6" fill="none" opacity="0.4"/>
        <path d="M20 85 Q60 60 100 85 T 180 85" stroke="#06b6d4" stroke-width="1" fill="none" opacity="0.6" stroke-dasharray="2 2"/>
        <g fill="#0f172a">
          <circle cx="20" cy="85" r="2.5"/><circle cx="100" cy="85" r="2.5"/><circle cx="180" cy="85" r="2.5"/>
        </g>
        <g fill="#06b6d4">
          <circle cx="60" cy="28" r="2.5"/><circle cx="140" cy="28" r="2.5"/>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#0f172a" stroke="none">
          <text x="12" y="22">node</text>
          <text x="50" y="20">antinode</text>
          <text x="94" y="100">N</text>
          <text x="170" y="22">node</text>
        </g>
        <g stroke="#06b6d4" stroke-width="0.5">
          <line x1="20" y1="150" x2="180" y2="150"/><line x1="20" y1="148" x2="20" y2="152"/><line x1="180" y1="148" x2="180" y2="152"/>
          <text x="78" y="160" font-family="JetBrains Mono" font-size="6" stroke="none">λ = L</text>
        </g>
      `)},
    ],
  },
};

/* =================================================================
   STYLE B — SCI-FI HOLOGRAM
   Layered holographic panels on obsidian. Per-subject glow hue,
   cyan accents, floating HUD chrome, targeting reticles, signal
   waveforms, data readouts. Feels like advanced tech interfaces.
================================================================= */

const holo = (hue, inner, extra='') => `<svg viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#05060f"/>
  <g opacity="0.5">${Array.from({length:10},(_,i)=>`<line x1="0" y1="${i*10}" x2="100" y2="${i*10}" stroke="${hue}" stroke-width="0.3" opacity="0.12"/>`).join('')}${Array.from({length:10},(_,i)=>`<line x1="${i*10}" y1="0" x2="${i*10}" y2="100" stroke="${hue}" stroke-width="0.3" opacity="0.12"/>`).join('')}</g>
  <defs>
    <radialGradient id="hg${hue.replace('#','')}" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="${hue}" stop-opacity="0.35"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>
    <filter id="hf${hue.replace('#','')}"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <rect width="100" height="100" fill="url(#hg${hue.replace('#','')})"/>
  <g stroke="${hue}" fill="none" stroke-width="2" opacity="0.55" filter="url(#hf${hue.replace('#','')})">${inner}</g>
  <g stroke="${hue}" fill="none" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  ${extra}
  <g stroke="${hue}" fill="none" stroke-width="0.8" opacity="0.7">
    <path d="M 4 4 L 4 14 M 4 4 L 14 4"/>
    <path d="M 96 4 L 96 14 M 96 4 L 86 4"/>
    <path d="M 4 96 L 4 86 M 4 96 L 14 96"/>
    <path d="M 96 96 L 96 86 M 96 96 L 86 96"/>
  </g>
</svg>`;

const holoObj = (hue, label, value, inner) => `<svg viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#05060f"/>
  <defs>
    <radialGradient id="hob${label.replace(/\s/g,'')}" cx="0.5" cy="0.55" r="0.65"><stop offset="0" stop-color="${hue}" stop-opacity="0.28"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>
    <filter id="hof${label.replace(/\s/g,'')}"><feGaussianBlur stdDeviation="2.2"/></filter>
    <linearGradient id="hol${label.replace(/\s/g,'')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hue}" stop-opacity="0.35"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#hob${label.replace(/\s/g,'')})"/>
  <g opacity="0.35">${Array.from({length:20},(_,i)=>`<line x1="0" y1="${i*10}" x2="200" y2="${i*10}" stroke="${hue}" stroke-width="0.3" opacity="0.15"/>`).join('')}${Array.from({length:20},(_,i)=>`<line x1="${i*10}" y1="0" x2="${i*10}" y2="200" stroke="${hue}" stroke-width="0.3" opacity="0.15"/>`).join('')}</g>
  <g opacity="0.5">${Array.from({length:50},()=>`<rect x="0" y="0" width="200" height="0.5" fill="${hue}" fill-opacity="0.04" transform="translate(0 ${Math.floor(Math.random()*200)})"/>`).join('')}</g>

  <rect x="8" y="8" width="184" height="14" fill="url(#hol${label.replace(/\s/g,'')})" opacity="0.5"/>
  <g stroke="${hue}" stroke-width="0.8" fill="none">
    <line x1="8" y1="22" x2="192" y2="22" opacity="0.5"/>
  </g>
  <g font-family="JetBrains Mono, monospace" font-size="7" fill="${hue}" letter-spacing="0.2em">
    <text x="12" y="18">▸ ${label}</text>
    <text x="150" y="18" opacity="0.7">● LIVE</text>
  </g>

  <rect x="8" y="178" width="184" height="14" fill="url(#hol${label.replace(/\s/g,'')})" opacity="0.5" transform="scale(1 -1) translate(0 -370)"/>
  <g stroke="${hue}" stroke-width="0.8" fill="none">
    <line x1="8" y1="178" x2="192" y2="178" opacity="0.5"/>
  </g>
  <g font-family="JetBrains Mono, monospace" font-size="7" fill="${hue}" letter-spacing="0.15em">
    <text x="12" y="189">READOUT · ${value}</text>
    <text x="140" y="189" opacity="0.6">◇ SIM-07</text>
  </g>

  <g filter="url(#hof${label.replace(/\s/g,'')})" stroke="${hue}" fill="none" stroke-width="2.5" opacity="0.55">${inner}</g>
  <g stroke="${hue}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</g>

  <g stroke="${hue}" fill="none" stroke-width="0.8" opacity="0.8">
    <path d="M 8 30 L 8 42 M 8 30 L 20 30"/>
    <path d="M 192 30 L 192 42 M 192 30 L 180 30"/>
    <path d="M 8 170 L 8 158 M 8 170 L 20 170"/>
    <path d="M 192 170 L 192 158 M 192 170 L 180 170"/>
  </g>
</svg>`;

const HOLOGRAM = {
  mech: {
    icons: [
      holo('#f97316', `<circle cx="50" cy="30" r="8"/><line x1="50" y1="38" x2="50" y2="72"/><path d="M44 68 L50 76 L56 68"/><circle cx="50" cy="30" r="12" opacity="0.5"/>`),
      holo('#f97316', `<path d="M10 82 L 90 82"/><path d="M10 82 Q 50 10 90 82" stroke-dasharray="3 2"/><circle cx="10" cy="82" r="3.5"/><circle cx="90" cy="82" r="3.5"/><circle cx="50" cy="26" r="2" fill="#f97316"/>`),
      holo('#f97316', `<line x1="12" y1="55" x2="88" y2="55" stroke-width="2"/><path d="M50 55 L43 72 L57 72 Z"/><rect x="14" y="42" width="14" height="13"/><rect x="72" y="48" width="12" height="7"/>`),
      holo('#f97316', `<circle cx="38" cy="55" r="16"/><circle cx="38" cy="55" r="3" fill="#f97316"/>${Array.from({length:10},(_,i)=>{const a=i*36*Math.PI/180;return `<line x1="${38+Math.cos(a)*16}" y1="${55+Math.sin(a)*16}" x2="${38+Math.cos(a)*20}" y2="${55+Math.sin(a)*20}"/>`}).join('')}<circle cx="68" cy="55" r="9"/>`),
    ],
    objects: [
      { name:'PENDULUM', svg:holoObj('#f97316','PENDULUM SIM','T=2.2s · L=1.20m',`
        <line x1="28" y1="38" x2="172" y2="38"/>
        <rect x="88" y="38" width="24" height="5"/>
        <line x1="100" y1="43" x2="148" y2="120"/>
        <line x1="100" y1="43" x2="100" y2="155" stroke-dasharray="3 3" opacity="0.6"/>
        <circle cx="148" cy="120" r="14"/>
        <circle cx="148" cy="120" r="18" stroke-dasharray="2 3" opacity="0.6"/>
        <circle cx="148" cy="120" r="3" fill="#f97316"/>
        <path d="M 100 90 A 48 48 0 0 0 132 70" stroke-dasharray="3 2"/>
        <path d="M 100 155 L 148 155" stroke-dasharray="2 2" opacity="0.5"/>
        <circle cx="100" cy="43" r="5" opacity="0.6"/>
        <g font-family="JetBrains Mono" font-size="6" fill="#f97316" stroke="none" letter-spacing="0.15em">
          <text x="108" y="78">θ=28°</text>
          <text x="134" y="154">+0.55m</text>
        </g>
      `)},
      { name:'INCLINE', svg:holoObj('#f97316','INCLINE FBD','θ=38° · μ=0.12',`
        <path d="M30 148 L170 148 L170 55 Z"/>
        <g transform="translate(115 92) rotate(-38.7)">
          <rect x="-16" y="-16" width="32" height="32"/>
          <rect x="-19" y="-19" width="38" height="38" stroke-dasharray="2 3" opacity="0.6"/>
        </g>
        <line x1="115" y1="92" x2="162" y2="92" stroke-width="2.5"/>
        <path d="M158 88 L164 92 L158 96"/>
        <line x1="115" y1="92" x2="115" y2="135" stroke-dasharray="3 3" opacity="0.6"/>
        <path d="M 55 148 A 22 22 0 0 0 63 130" stroke-dasharray="2 2"/>
        <g stroke="#f97316" stroke-width="0.8" opacity="0.5">
          <line x1="115" y1="70" x2="175" y2="70"/>
          <line x1="115" y1="70" x2="118" y2="66"/>
          <line x1="115" y1="70" x2="118" y2="74"/>
        </g>
        <g font-family="JetBrains Mono" font-size="6" fill="#f97316" stroke="none" letter-spacing="0.15em">
          <text x="138" y="85">F∥ 6.0N</text>
          <text x="119" y="128">mg 9.8N</text>
        </g>
      `)},
    ],
  },
  em: {
    icons: [
      holo('#8b5cf6', `<path d="M55 12 L40 48 L52 48 L35 88 L70 42 L58 42 L72 12 Z"/>`),
      holo('#8b5cf6', `<path d="M25 15 L25 65 Q25 75 40 75 L55 75 L55 45 Q55 35 45 35 L35 35 L35 55 L45 55"/><path d="M75 15 L75 65 Q75 75 60 75 L55 75"/>`),
      holo('#8b5cf6', `<line x1="8" y1="50" x2="22" y2="50"/>${Array.from({length:6},(_,i)=>`<path d="M ${22+i*10} 50 A 5 10 0 1 1 ${32+i*10} 50"/>`).join('')}<line x1="82" y1="50" x2="94" y2="50"/>`),
      holo('#8b5cf6', `<circle cx="50" cy="50" r="5" fill="#8b5cf6"/><circle cx="50" cy="50" r="15"/><circle cx="50" cy="50" r="25" stroke-dasharray="2 2"/><circle cx="50" cy="50" r="35" stroke-dasharray="2 2" opacity="0.6"/>`),
    ],
    objects: [
      { name:'SOLENOID', svg:holoObj('#8b5cf6','SOLENOID','B=μ₀nI · 2.4T',`
        <rect x="30" y="82" width="140" height="40"/>
        ${Array.from({length:13},(_,i)=>`<ellipse cx="${40+i*10}" cy="102" rx="5" ry="18"/>`).join('')}
        <line x1="12" y1="102" x2="32" y2="102" stroke-width="2"/>
        <line x1="168" y1="102" x2="188" y2="102" stroke-width="2"/>
        <g stroke-dasharray="3 2" opacity="0.7"><path d="M 40 56 Q 100 38 160 56"/><path d="M 40 148 Q 100 166 160 148"/></g>
        <circle cx="100" cy="102" r="30" stroke-dasharray="2 3" opacity="0.5"/>
        <g font-family="JetBrains Mono" font-size="6" fill="#8b5cf6" stroke="none" letter-spacing="0.15em">
          <text x="84" y="48">B field</text>
        </g>
      `)},
      { name:'CAPACITOR', svg:holoObj('#8b5cf6','CAPACITOR','C=εA/d · 47pF',`
        <line x1="20" y1="100" x2="85" y2="100"/>
        <line x1="85" y1="40" x2="85" y2="160" stroke-width="3"/>
        <line x1="115" y1="40" x2="115" y2="160" stroke-width="3"/>
        <line x1="115" y1="100" x2="180" y2="100"/>
        ${Array.from({length:7},(_,i)=>`<line x1="89" y1="${50+i*16}" x2="111" y2="${50+i*16}" stroke-width="1"/><path d="M108 ${48+i*16} L112 ${50+i*16} L108 ${52+i*16}"/>`).join('')}
        <g font-family="JetBrains Mono" font-size="6" fill="#8b5cf6" stroke="none" letter-spacing="0.15em">
          <text x="72" y="36">+Q</text><text x="118" y="36">−Q</text>
          <text x="92" y="175">d</text>
        </g>
      `)},
    ],
  },
  opt: {
    icons: [
      holo('#eab308',`<path d="M50 18 L82 75 L18 75 Z"/><line x1="5" y1="42" x2="38" y2="55"/><line x1="62" y1="55" x2="92" y2="38" stroke="#ef4444"/><line x1="62" y1="55" x2="93" y2="50" stroke="#f59e0b"/><line x1="62" y1="55" x2="95" y2="58"/><line x1="62" y1="55" x2="93" y2="68" stroke="#22c55e"/><line x1="62" y1="55" x2="90" y2="78" stroke="#3b82f6"/>`),
      holo('#eab308',`<path d="M10 50 Q50 18 90 50 Q50 82 10 50 Z"/><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="6" fill="#eab308"/>`),
      holo('#eab308',`<circle cx="40" cy="40" r="22"/><line x1="56" y1="56" x2="85" y2="85" stroke-width="4"/>`),
      holo('#eab308',`<path d="M5 50 Q15 22 25 50 T45 50 T65 50 T85 50 T95 50"/>`),
    ],
    objects: [
      { name:'PRISM', svg:holoObj('#eab308','PRISM DISP','n=1.52 · λ 400-700',`
        <path d="M100 35 L165 145 L35 145 Z"/>
        <line x1="10" y1="80" x2="72" y2="108" stroke-width="2"/>
        <line x1="128" y1="108" x2="190" y2="80" stroke="#ef4444" stroke-width="1.4"/>
        <line x1="128" y1="108" x2="192" y2="96" stroke="#f59e0b" stroke-width="1.4"/>
        <line x1="128" y1="108" x2="194" y2="112" stroke="#eab308" stroke-width="1.4"/>
        <line x1="128" y1="108" x2="192" y2="128" stroke="#22c55e" stroke-width="1.4"/>
        <line x1="128" y1="108" x2="188" y2="148" stroke="#3b82f6" stroke-width="1.4"/>
        <line x1="128" y1="108" x2="182" y2="162" stroke="#8b5cf6" stroke-width="1.4"/>
        <circle cx="100" cy="108" r="38" stroke-dasharray="2 3" opacity="0.3"/>
      `)},
      { name:'LENS', svg:holoObj('#eab308','LENS FOCUS','f=50mm · biconvex',`
        <path d="M100 35 Q72 100 100 165 Q128 100 100 35"/>
        <line x1="15" y1="100" x2="185" y2="100" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="15" y1="70" x2="93" y2="70"/><line x1="93" y1="70" x2="165" y2="100"/>
        <line x1="15" y1="100" x2="165" y2="100"/>
        <line x1="15" y1="130" x2="93" y2="130"/><line x1="93" y1="130" x2="165" y2="100"/>
        <circle cx="165" cy="100" r="5" fill="#eab308"/>
        <circle cx="165" cy="100" r="10" stroke-dasharray="1 2" opacity="0.7"/>
      `)},
    ],
  },
  thermo: {
    icons: [
      holo('#ef4444',`<rect x="42" y="15" width="16" height="55" rx="4"/><circle cx="50" cy="78" r="13" fill="#ef4444" fill-opacity="0.3"/><line x1="50" y1="28" x2="50" y2="78" stroke-width="2"/>`),
      holo('#ef4444',`<path d="M40 85 Q25 65 45 55 Q60 45 50 30 Q38 15 48 5"/><path d="M55 85 Q40 60 60 50 Q75 40 65 25 Q53 10 63 0" opacity="0.7"/>`),
      holo('#ef4444',`<rect x="10" y="10" width="80" height="80"/>${Array.from({length:10},()=>{const x=15+Math.random()*70;const y=15+Math.random()*70;return `<circle cx="${x}" cy="${y}" r="2.5"/>`}).join('')}`),
      holo('#ef4444',`<rect x="15" y="42" width="70" height="32"/><rect x="30" y="18" width="40" height="24"/><circle cx="38" cy="56" r="2" fill="#ef4444"/><circle cx="50" cy="56" r="2" fill="#ef4444"/><circle cx="62" cy="56" r="2" fill="#ef4444"/>`),
    ],
    objects: [
      { name:'CARNOT', svg:holoObj('#ef4444','P-V CYCLE','η = 0.50',`
        <line x1="30" y1="148" x2="170" y2="148" stroke-width="1.6"/>
        <line x1="30" y1="30" x2="30" y2="148" stroke-width="1.6"/>
        <path d="M55 52 Q95 44 145 50 L158 98 Q100 118 58 102 Z"/>
        <path d="M55 52 Q95 44 145 50" stroke-width="2"/>
        <path d="M158 98 Q100 118 58 102" stroke-width="2"/>
        <g fill="#ef4444"><circle cx="55" cy="52" r="3"/><circle cx="145" cy="50" r="3"/><circle cx="158" cy="98" r="3"/><circle cx="58" cy="102" r="3"/></g>
        <g font-family="JetBrains Mono" font-size="6" fill="#ef4444" stroke="none" letter-spacing="0.15em">
          <text x="16" y="26">P</text><text x="170" y="160">V</text>
          <text x="44" y="48">A</text><text x="148" y="46">B</text>
          <text x="162" y="102">C</text><text x="44" y="106">D</text>
        </g>
      `)},
      { name:'HEAT ENGINE', svg:holoObj('#ef4444','ENGINE','Tₕ 600K · Tc 300K',`
        <rect x="35" y="32" width="130" height="26" stroke="#ef4444"/>
        <rect x="35" y="118" width="130" height="26" stroke="#3b82f6"/>
        <circle cx="100" cy="86" r="26"/>
        <circle cx="100" cy="86" r="32" stroke-dasharray="2 3" opacity="0.6"/>
        ${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180;return `<line x1="${100+Math.cos(a)*20}" y1="${86+Math.sin(a)*20}" x2="${100+Math.cos(a)*26}" y2="${86+Math.sin(a)*26}"/>`}).join('')}
        <circle cx="100" cy="86" r="4" fill="#ef4444"/>
        <line x1="100" y1="58" x2="100" y2="66" stroke="#ef4444"/>
        <line x1="100" y1="106" x2="100" y2="118" stroke="#3b82f6"/>
        <line x1="126" y1="86" x2="170" y2="86" stroke="#22c55e" stroke-width="2"/>
      `)},
    ],
  },
  rel: {
    icons: [
      holo('#a855f7',`${Array.from({length:6},(_,i)=>{const y=16+i*13;return `<path d="M 8 ${y} Q 50 ${y+12-Math.abs(i-2.5)*3.2} 92 ${y}"/>`}).join('')}<circle cx="50" cy="55" r="8" fill="#a855f7"/>`),
      holo('#a855f7',`<circle cx="28" cy="50" r="18"/><line x1="28" y1="50" x2="28" y2="36"/><line x1="28" y1="50" x2="38" y2="50"/><circle cx="72" cy="52" r="13"/><line x1="72" y1="52" x2="72" y2="42"/>`),
      holo('#a855f7',`<circle cx="50" cy="50" r="32"/><ellipse cx="50" cy="50" rx="32" ry="9"/><circle cx="50" cy="50" r="16" fill="#05060f"/>`),
      holo('#a855f7',`<rect x="15" y="35" width="70" height="30"/><text x="50" y="57" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="16" fill="#a855f7" stroke="none">E=mc²</text>`),
    ],
    objects: [
      { name:'LIGHT CONE', svg:holoObj('#a855f7','MINKOWSKI','ds²=−c²dt²+dx²',`
        <line x1="20" y1="88" x2="180" y2="88" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="100" y1="28" x2="100" y2="160" stroke-dasharray="3 3" opacity="0.6"/>
        <path d="M100 88 L35 28 L165 28 Z"/>
        <path d="M100 88 L35 160 L165 160 Z"/>
        <ellipse cx="100" cy="28" rx="65" ry="6" stroke-dasharray="2 2" opacity="0.5"/>
        <ellipse cx="100" cy="160" rx="65" ry="6" stroke-dasharray="2 2" opacity="0.5"/>
        <circle cx="100" cy="88" r="5" fill="#a855f7"/>
        <circle cx="100" cy="88" r="10" stroke-dasharray="1 2"/>
      `)},
      { name:'GRAVITY WELL', svg:holoObj('#a855f7','SPACETIME','Gμν=8πTμν',`
        ${Array.from({length:10},(_,i)=>{const y=30+i*13;const dip=18-Math.abs(i-4.5)*3.2;return `<path d="M 15 ${y} Q 65 ${y+dip*0.3} 100 ${y+dip} Q 135 ${y+dip*0.3} 185 ${y}"/>`}).join('')}
        ${Array.from({length:8},(_,i)=>{const x=20+i*20;return `<path d="M ${x} 28 Q ${x+(100-x)*0.3} 118 100 130 Q ${100+(x-100)*0.3} ${118+(x-100)*0.08} ${200-x} 158" opacity="0.4"/>`}).join('')}
        <circle cx="100" cy="130" r="14" fill="#a855f7"/>
        <ellipse cx="155" cy="108" rx="28" ry="8" stroke-dasharray="3 2"/>
        <circle cx="170" cy="104" r="3" fill="#a855f7"/>
      `)},
    ],
  },
  qm: {
    icons: [
      holo('#d946ef',`<circle cx="50" cy="50" r="4" fill="#d946ef"/>${[0,60,120].map(r=>`<ellipse cx="50" cy="50" rx="28" ry="9" transform="rotate(${r} 50 50)"/>`).join('')}<circle cx="77" cy="52" r="3" fill="#d946ef"/>`),
      holo('#d946ef',`<rect x="15" y="28" width="70" height="55"/><path d="M15 28 L50 15 L85 28"/><circle cx="36" cy="55" r="3"/><circle cx="64" cy="55" r="3"/>`),
      holo('#d946ef',`<path d="M5 50 Q15 25 25 50 T45 50" stroke-width="2"/><circle cx="62" cy="50" r="5"/><circle cx="80" cy="50" r="5"/>`),
      holo('#d946ef',`<rect x="15" y="32" width="70" height="36"/><text x="50" y="60" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="22" fill="#d946ef" stroke="none">ψ</text>`),
    ],
    objects: [
      { name:'DOUBLE SLIT', svg:holoObj('#d946ef','DOUBLE SLIT','λ=500nm',`
        <circle cx="22" cy="88" r="4" fill="#eab308"/>
        <circle cx="22" cy="88" r="8" stroke-dasharray="2 2" opacity="0.6"/>
        <line x1="65" y1="30" x2="65" y2="148" stroke-width="2"/>
        <line x1="155" y1="30" x2="155" y2="148" stroke-width="2"/>
        ${Array.from({length:11},(_,i)=>{const y=32+i*11;const w=22+18*Math.abs(Math.sin(i*0.65));return `<rect x="156" y="${y}" width="${w}" height="6" fill="#d946ef" fill-opacity="${0.3+0.55*Math.abs(Math.sin(i*0.65))}" stroke="none"/>`}).join('')}
        <g stroke-width="1" opacity="0.55">
          <path d="M 26 88 Q 45 88 65 74"/><path d="M 26 88 Q 45 88 65 102"/>
          <path d="M 65 74 Q 110 62 154 52"/><path d="M 65 74 Q 110 82 154 82"/>
          <path d="M 65 102 Q 110 92 154 110"/><path d="M 65 102 Q 110 125 154 138"/>
        </g>
      `)},
      { name:'BLOCH', svg:holoObj('#d946ef','QUBIT','|ψ⟩=α|0⟩+β|1⟩',`
        <circle cx="100" cy="88" r="55"/>
        <ellipse cx="100" cy="88" rx="55" ry="18" stroke-dasharray="2 3"/>
        <ellipse cx="100" cy="88" rx="18" ry="55" stroke-dasharray="2 3"/>
        <line x1="100" y1="28" x2="100" y2="148" stroke-dasharray="2 3" opacity="0.6"/>
        <line x1="40" y1="88" x2="160" y2="88" stroke-dasharray="2 3" opacity="0.6"/>
        <line x1="100" y1="88" x2="140" y2="52" stroke-width="2.5"/>
        <circle cx="100" cy="88" r="3" fill="#d946ef"/>
        <circle cx="140" cy="52" r="4" fill="#d946ef"/>
        <circle cx="140" cy="52" r="8" stroke-dasharray="1 2"/>
      `)},
    ],
  },
  aco: {
    icons: [
      holo('#06b6d4',`<path d="M15 40 L15 60 L35 60 L55 80 L55 20 L35 40 Z"/><path d="M65 32 Q78 50 65 68"/><path d="M74 22 Q94 50 74 78"/>`),
      holo('#06b6d4',`<path d="M5 50 Q12 22 20 50 T35 50 T50 50 T65 50 T80 50 T95 50" stroke-width="2"/>`),
      holo('#06b6d4',`${[12,25,38,46,58,70,82].map((h,i)=>`<line x1="${16+i*12}" y1="${85-h}" x2="${16+i*12}" y2="85" stroke-width="4"/>`).join('')}`),
      holo('#06b6d4',`<circle cx="50" cy="50" r="5" fill="#06b6d4"/><circle cx="50" cy="50" r="15"/><circle cx="50" cy="50" r="25"/><circle cx="50" cy="50" r="35" opacity="0.5"/>`),
    ],
    objects: [
      { name:'TUNING FORK', svg:holoObj('#06b6d4','FORK A4','440 Hz · 60mm',`
        <rect x="70" y="32" width="10" height="110"/>
        <rect x="120" y="32" width="10" height="110"/>
        <path d="M70 142 L58 154 L58 164 L142 164 L142 154 L130 142"/>
        <g stroke-dasharray="2 2" opacity="0.7">
          <path d="M70 62 Q55 62 55 46"/><path d="M70 78 Q42 78 42 54"/>
          <path d="M130 62 Q145 62 145 46"/><path d="M130 78 Q158 78 158 54"/>
        </g>
        <path d="M 15 100 Q 22 90 28 100 T 40 100"/>
        <path d="M 160 100 Q 168 90 174 100 T 186 100"/>
      `)},
      { name:'STANDING WAVE', svg:holoObj('#06b6d4','STANDING','n=2 · λ=L',`
        <line x1="20" y1="88" x2="180" y2="88" stroke-dasharray="2 3" opacity="0.6"/>
        <line x1="20" y1="35" x2="20" y2="140" stroke-width="3"/>
        <line x1="180" y1="35" x2="180" y2="140" stroke-width="3"/>
        <path d="M20 88 Q60 32 100 88 T 180 88" stroke-width="2"/>
        <path d="M20 88 Q60 144 100 88 T 180 88" stroke-width="2" opacity="0.5"/>
        <path d="M20 88 Q60 60 100 88 T 180 88" stroke-width="1.2" opacity="0.6" stroke-dasharray="2 2"/>
        <g fill="#06b6d4"><circle cx="20" cy="88" r="3"/><circle cx="100" cy="88" r="3"/><circle cx="180" cy="88" r="3"/></g>
      `)},
    ],
  },
};

/* =================================================================
   STYLE C — DARK EDITORIAL
   Refined, near-black cards with the subject hue as a single accent.
   Not sci-fi — think premium magazine or high-end product on dark.
   Clean type, confident whitespace, hairline dividers.
================================================================= */

// Dark editorial icon: near-black tile, hue strokes, whisper of glow
const drk = (hue, inner) => `<svg viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0a0a0a"/>
  <rect width="100" height="100" fill="${hue}" fill-opacity="0.05"/>
  <g stroke="${hue}" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

const drkObj = (hue, label, value, inner) => `<svg viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#0a0a0a"/>
  <rect width="200" height="200" fill="${hue}" fill-opacity="0.03"/>
  <line x1="20" y1="24" x2="180" y2="24" stroke="${hue}" stroke-width="0.5" opacity="0.4"/>
  <line x1="20" y1="176" x2="180" y2="176" stroke="${hue}" stroke-width="0.5" opacity="0.4"/>
  <g font-family="'JetBrains Mono', monospace" font-size="7" letter-spacing="0.24em" fill="${hue}">
    <text x="20" y="18">${label}</text>
    <text x="20" y="192" opacity="0.7">${value}</text>
  </g>
  <circle cx="180" cy="15" r="2.5" fill="${hue}"/>
  <g stroke="${hue}" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;

// Build DARK data by reusing geometries (reuse the same inner paths from TECHNICAL)
// but swap for single-hue strokes on near-black. This keeps the file small.
const DARK = {};
Object.keys(TECHNICAL).forEach(k => {
  const sub = PHYS_SUBS.find(s => s.id === k);
  const t = TECHNICAL[k];
  // Extract the inner geometry by re-rendering each icon/object with drk/drkObj.
  // Simpler: copy from HOLOGRAM inner payloads (they are already simplified).
  const h = HOLOGRAM[k];
  DARK[k] = {
    icons: [
      drk(sub.hue, extractInner(h.icons[0])),
      drk(sub.hue, extractInner(h.icons[1])),
      drk(sub.hue, extractInner(h.icons[2])),
      drk(sub.hue, extractInner(h.icons[3])),
    ],
    objects: h.objects.map((o, i) => {
      const t_obj = t.objects[i];
      return {
        name: t_obj.name,
        svg: drkObj(sub.hue, t_obj.name, sub.formula.split('·')[0].trim(), extractInner(o.svg))
      };
    }),
  };
});

// Helper: pull the <g stroke=... fill="none" stroke-width="1.2 or 1.3"> inner from a holo svg.
// Works because holoObj / holo put their sharp line layer last as a <g> group.
function extractInner(svgString) {
  // Find the LAST <g stroke="..." fill="none" stroke-width="1.2|1.3" ...> ... </g>
  const regex = /<g\s+stroke="[^"]+"\s+fill="none"\s+stroke-width="1\.[23]"[^>]*>([\s\S]*?)<\/g>(?=\s*<g[^>]*stroke-width="0\.8"|\s*<\/svg>|\s*$)/g;
  const matches = [...svgString.matchAll(regex)];
  if (matches.length) return matches[matches.length - 1][1];
  // fallback: grab everything between <rect ... fill="url(#hg...)"/> and closing </svg>
  return svgString.match(/<g[^>]*stroke-linecap="round"[^>]*>([\s\S]*?)<\/g>(?=[^<]*(?:<g[^>]*stroke-width="0\.8"|<\/svg>))/)?.[1] || '';
}

// =====================================================================
window.PHYS_VIVID = {
  subs: PHYS_SUBS,
  styles: {
    tech: { name:'Technical Blueprint', data: TECHNICAL },
    dark: { name:'Dark Editorial',      data: DARK     },
    holo: { name:'Sci-Fi Hologram',     data: HOLOGRAM },
  },
};
