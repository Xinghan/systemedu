/* Environments for expansion set (14 new themes) */

const ENVIRONMENTS_EXT = {
  astro: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="as-neb" cx="0.7" cy="0.4" r="0.6">
          <stop offset="0" stop-color="oklch(0.40 0.16 310 / 0.5)"/>
          <stop offset="1" stop-color="oklch(0.14 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.12 0.04 265)"/>
      <rect width="600" height="360" fill="url(#as-neb)"/>
      ${Array.from({length:80},()=>`<circle cx="${Math.random()*600}" cy="${Math.random()*300}" r="${Math.random()*1.4}" fill="oklch(0.95 0.02 260)" opacity="${0.3+Math.random()*0.7}"/>`).join('')}
      <!-- spiral galaxy -->
      <g transform="translate(430 120)">
        <ellipse rx="60" ry="14" fill="none" stroke="oklch(0.78 0.13 260 / 0.5)" stroke-width="0.8" transform="rotate(25)"/>
        <ellipse rx="45" ry="10" fill="none" stroke="oklch(0.78 0.13 260 / 0.7)" stroke-width="0.8" transform="rotate(45)"/>
        <ellipse rx="30" ry="7" fill="none" stroke="oklch(0.92 0.08 260 / 0.8)" stroke-width="0.8" transform="rotate(65)"/>
        <circle r="6" fill="oklch(0.95 0.05 260)"/>
        <circle r="14" fill="oklch(0.78 0.13 260 / 0.3)"/>
      </g>
      <!-- telescope observatory -->
      <g transform="translate(140 260)">
        <path d="M-70 60 L-70 10 Q-70 -30 -30 -40 L30 -40 Q70 -30 70 10 L70 60 Z" fill="oklch(0.20 0.06 260)" stroke="oklch(0.78 0.13 260)" stroke-width="1"/>
        <path d="M-70 10 Q-70 -30 -30 -40 L30 -40 Q70 -30 70 10 Z" fill="oklch(0.25 0.08 260)" stroke="oklch(0.78 0.13 260)" stroke-width="1.5"/>
        <!-- slit showing scope -->
        <rect x="-6" y="-48" width="12" height="44" fill="oklch(0.10 0.02 265)"/>
        <rect x="-4" y="-60" width="8" height="30" fill="oklch(0.78 0.13 260)" transform="rotate(-20)"/>
        <rect x="-5" y="60" width="10" height="4" fill="oklch(0.85 0.14 85)"/>
        <line x1="-70" y1="60" x2="70" y2="60" stroke="oklch(0.78 0.13 260)" stroke-width="1"/>
      </g>
      <!-- comet -->
      <g transform="translate(280 80)">
        <circle r="3" fill="oklch(0.85 0.14 85)"/>
        <path d="M0 0 L-60 20 L-80 18 L-40 8 Z" fill="oklch(0.85 0.14 85 / 0.4)"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.78 0.13 260 / 0.7)">RA 14h 03m · DEC -05°</text>
    </svg>`,

  geo: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="360" fill="oklch(0.17 0.04 265)"/>
      <!-- stars -->
      ${Array.from({length:20},()=>`<circle cx="${Math.random()*600}" cy="${Math.random()*100}" r="${Math.random()*1}" fill="oklch(0.95 0.02 40)" opacity="0.6"/>`).join('')}
      <!-- moon -->
      <circle cx="480" cy="70" r="24" fill="oklch(0.88 0.06 60)"/>
      <circle cx="475" cy="65" r="3" fill="oklch(0.70 0.06 60 / 0.5)"/>
      <!-- strata layers -->
      <rect x="0" y="120" width="600" height="40" fill="oklch(0.55 0.14 40)"/>
      <rect x="0" y="160" width="600" height="50" fill="oklch(0.45 0.13 40)"/>
      <rect x="0" y="210" width="600" height="50" fill="oklch(0.35 0.10 40)"/>
      <rect x="0" y="260" width="600" height="60" fill="oklch(0.28 0.08 40)"/>
      <rect x="0" y="320" width="600" height="40" fill="oklch(0.22 0.06 40)"/>
      <!-- strata lines -->
      <g stroke="oklch(0.72 0.15 40 / 0.4)" stroke-width="0.6">
        <line x1="0" y1="140" x2="600" y2="145"/>
        <line x1="0" y1="180" x2="600" y2="175"/>
        <line x1="0" y1="230" x2="600" y2="235"/>
        <line x1="0" y1="280" x2="600" y2="282"/>
      </g>
      <!-- canyon cut -->
      <path d="M220 120 L240 200 L250 260 L240 320 L360 320 L350 260 L360 200 L380 120 Z" fill="oklch(0.17 0.04 265)"/>
      <!-- tectonic plates indication -->
      <path d="M200 120 L220 120 L240 200 L250 260" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M400 120 L380 120 L360 200 L350 260" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1" stroke-dasharray="3 3"/>
      <!-- magma glow at bottom -->
      <rect x="240" y="316" width="120" height="4" fill="oklch(0.85 0.14 85)"/>
      <!-- crystals -->
      <g transform="translate(110 240)">
        <path d="M0 -18 L10 -6 L6 12 L-6 12 L-10 -6 Z" fill="oklch(0.72 0.15 40)" stroke="oklch(0.92 0.08 50)" stroke-width="0.8"/>
        <path d="M0 -18 L0 12" stroke="oklch(0.92 0.08 50)" stroke-width="0.5"/>
      </g>
      <g transform="translate(510 240)">
        <path d="M0 -14 L8 -4 L5 10 L-5 10 L-8 -4 Z" fill="oklch(0.85 0.14 85)" opacity="0.7"/>
      </g>
      <!-- compass -->
      <g transform="translate(80 90)">
        <circle r="14" fill="none" stroke="oklch(0.72 0.15 40)" stroke-width="1"/>
        <path d="M0 -10 L3 0 L0 10 L-3 0 Z" fill="oklch(0.85 0.14 85)"/>
        <text y="-18" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="oklch(0.72 0.15 40)">N</text>
      </g>
      <text x="420" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.15 40 / 0.7)">STRATA 04 · 1.8 GYR</text>
    </svg>`,

  ocean: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="oc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.28 0.10 240)"/>
          <stop offset="1" stop-color="oklch(0.12 0.06 250)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#oc-bg)"/>
      <!-- shimmering surface light rays -->
      ${Array.from({length:6},(_,i)=>`<path d="M${100+i*80} 0 L${120+i*80} 200 L${90+i*80} 200 Z" fill="oklch(0.72 0.15 230 / 0.1)"/>`).join('')}
      <!-- bubbles -->
      ${Array.from({length:20},()=>`<circle cx="${Math.random()*600}" cy="${Math.random()*360}" r="${1+Math.random()*3}" fill="none" stroke="oklch(0.92 0.08 220 / 0.5)" stroke-width="0.6"/>`).join('')}
      <!-- seafloor -->
      <path d="M0 340 Q150 300 300 320 Q450 340 600 310 L600 360 L0 360 Z" fill="oklch(0.18 0.06 250)"/>
      <!-- kelp -->
      <g stroke="oklch(0.72 0.15 230)" stroke-width="2" fill="none">
        <path d="M60 340 Q70 280 60 220 Q55 180 65 130"/>
        <path d="M80 340 Q90 280 85 220"/>
        <path d="M540 340 Q530 290 540 240 Q550 200 540 150"/>
      </g>
      <!-- jellyfish center -->
      <g transform="translate(300 170)">
        <path d="M-36 0 Q-36 -40 0 -40 Q36 -40 36 0 L34 8 L24 0 L12 8 L0 0 L-12 8 L-24 0 L-34 8 Z" fill="oklch(0.72 0.15 230 / 0.3)" stroke="oklch(0.92 0.08 220)" stroke-width="1.2"/>
        <path d="M-16 0 Q-18 30 -20 60 M-8 8 Q-10 40 -8 70 M0 8 Q0 40 2 75 M8 8 Q10 40 12 70 M16 0 Q18 30 20 60" stroke="oklch(0.92 0.08 220 / 0.6)" stroke-width="1" fill="none"/>
        <circle r="8" fill="oklch(0.85 0.14 85)" opacity="0.7"/>
      </g>
      <!-- anglerfish silhouette -->
      <g transform="translate(130 280)">
        <path d="M0 0 Q-20 -14 -40 0 Q-20 14 0 0 M0 0 L14 -6 L14 6 Z" fill="oklch(0.18 0.06 250)" stroke="oklch(0.72 0.15 230)" stroke-width="1"/>
        <line x1="-20" y1="-8" x2="-20" y2="-20" stroke="oklch(0.72 0.15 230)" stroke-width="1"/>
        <circle cx="-20" cy="-22" r="3" fill="oklch(0.85 0.14 85)"/>
        <circle cx="-6" cy="-2" r="1.5" fill="oklch(0.92 0.08 220)"/>
      </g>
      <!-- coral -->
      <g transform="translate(460 330)" fill="oklch(0.45 0.13 230)">
        <circle cx="-10" cy="-8" r="6"/><circle cx="0" cy="-14" r="5"/><circle cx="10" cy="-6" r="7"/>
        <circle cx="-5" cy="-20" r="4"/><circle cx="8" cy="-18" r="4"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.15 230 / 0.8)">DEPTH -820m · 3°C</text>
    </svg>`,

  meteo: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="me-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.22 0.06 245)"/>
          <stop offset="0.5" stop-color="oklch(0.55 0.09 245)"/>
          <stop offset="1" stop-color="oklch(0.35 0.08 245)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#me-sky)"/>
      <!-- layer labels lines -->
      <line x1="0" y1="80" x2="600" y2="80" stroke="oklch(0.82 0.10 245 / 0.5)" stroke-width="0.6" stroke-dasharray="2 4"/>
      <line x1="0" y1="180" x2="600" y2="180" stroke="oklch(0.82 0.10 245 / 0.5)" stroke-width="0.6" stroke-dasharray="2 4"/>
      <line x1="0" y1="280" x2="600" y2="280" stroke="oklch(0.82 0.10 245 / 0.5)" stroke-width="0.6" stroke-dasharray="2 4"/>
      <text x="20" y="76" font-family="JetBrains Mono" font-size="9" fill="oklch(0.82 0.10 245 / 0.7)">STRATOSPHERE</text>
      <text x="20" y="176" font-family="JetBrains Mono" font-size="9" fill="oklch(0.82 0.10 245 / 0.7)">TROPOSPHERE</text>
      <text x="20" y="276" font-family="JetBrains Mono" font-size="9" fill="oklch(0.82 0.10 245 / 0.7)">SURFACE</text>
      <!-- clouds -->
      <g fill="oklch(0.95 0.05 245 / 0.5)">
        <ellipse cx="160" cy="130" rx="60" ry="14"/>
        <ellipse cx="180" cy="140" rx="40" ry="8"/>
        <ellipse cx="440" cy="150" rx="70" ry="16"/>
        <ellipse cx="420" cy="162" rx="50" ry="10"/>
      </g>
      <!-- weather balloon -->
      <g transform="translate(300 120)">
        <circle r="24" fill="oklch(0.95 0.05 245 / 0.4)" stroke="oklch(0.82 0.10 245)" stroke-width="1"/>
        <path d="M0 24 L-4 40 L4 40 Z" fill="oklch(0.82 0.10 245)"/>
        <rect x="-8" y="40" width="16" height="16" fill="oklch(0.22 0.06 245)" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <circle cx="0" cy="48" r="2" fill="oklch(0.85 0.14 85)"/>
      </g>
      <!-- sun -->
      <circle cx="520" cy="70" r="18" fill="oklch(0.85 0.14 85)"/>
      <circle cx="520" cy="70" r="26" fill="none" stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="1"/>
      <!-- rain -->
      ${Array.from({length:14},(_,i)=>`<line x1="${100+i*30}" y1="220" x2="${98+i*30}" y2="240" stroke="oklch(0.92 0.08 220)" stroke-width="1"/>`).join('')}
      <!-- mountain horizon -->
      <path d="M0 320 L120 280 L200 310 L300 270 L400 295 L500 265 L600 300 L600 360 L0 360 Z" fill="oklch(0.25 0.08 245)"/>
      <!-- weather vane on ground -->
      <g transform="translate(100 300)">
        <line x1="0" y1="0" x2="0" y2="-40" stroke="oklch(0.82 0.10 245)" stroke-width="1.5"/>
        <path d="M0 -40 L14 -36 L0 -32 Z" fill="oklch(0.85 0.14 85)"/>
        <path d="M0 -40 L-6 -38 L0 -36 Z" fill="oklch(0.82 0.10 245)"/>
      </g>
      <text x="420" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.82 0.10 245 / 0.8)">1013hPa · RH 74%</text>
    </svg>`,

  paleo: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="pa-lamp" cx="0.5" cy="0.4" r="0.5">
          <stop offset="0" stop-color="oklch(0.85 0.14 85 / 0.3)"/>
          <stop offset="1" stop-color="oklch(0.14 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.17 0.04 265)"/>
      <rect width="600" height="360" fill="url(#pa-lamp)"/>
      <!-- rock wall strata -->
      <g>
        <rect x="0" y="280" width="600" height="80" fill="oklch(0.30 0.08 70)"/>
        <line x1="0" y1="290" x2="600" y2="292" stroke="oklch(0.72 0.13 70 / 0.4)" stroke-width="0.6"/>
        <line x1="0" y1="310" x2="600" y2="308" stroke="oklch(0.72 0.13 70 / 0.4)" stroke-width="0.6"/>
        <line x1="0" y1="330" x2="600" y2="333" stroke="oklch(0.72 0.13 70 / 0.4)" stroke-width="0.6"/>
      </g>
      <!-- T-rex skeleton silhouette center -->
      <g transform="translate(300 200)" stroke="oklch(0.92 0.06 75)" stroke-width="1.8" fill="none">
        <!-- spine -->
        <path d="M-80 0 Q-60 -20 -30 -15 Q0 -10 30 -20 Q60 -30 80 -10"/>
        <!-- head -->
        <path d="M80 -10 L110 -14 L120 -6 L105 0 L90 -4 Z" fill="oklch(0.22 0.06 70)"/>
        <circle cx="108" cy="-10" r="1.5" fill="oklch(0.85 0.14 85)"/>
        <!-- tail -->
        <path d="M-80 0 Q-120 10 -150 30"/>
        <!-- ribs -->
        <line x1="-40" y1="-12" x2="-40" y2="40"/>
        <line x1="-20" y1="-14" x2="-20" y2="38"/>
        <line x1="0" y1="-12" x2="0" y2="40"/>
        <line x1="20" y1="-14" x2="20" y2="38"/>
        <line x1="40" y1="-20" x2="40" y2="30"/>
        <!-- legs -->
        <path d="M-20 38 L-30 60 L-20 80 L-10 80"/>
        <path d="M30 30 L40 60 L30 80 L20 80"/>
      </g>
      <!-- amber blob with insect -->
      <g transform="translate(100 250)">
        <ellipse rx="22" ry="26" fill="oklch(0.72 0.13 70 / 0.6)" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <circle r="3" fill="oklch(0.22 0.06 70)"/>
        <path d="M-6 -2 L-10 -6 M6 -2 L10 -6 M-4 3 L-8 6 M4 3 L8 6" stroke="oklch(0.22 0.06 70)" stroke-width="1"/>
      </g>
      <!-- ammonite fossil -->
      <g transform="translate(500 250)">
        ${(()=>{let s='';for(let i=0;i<20;i++){const r=20-i*0.9;const a=i*0.4;s+=`<circle cx="${Math.cos(a)*r*0.3}" cy="${Math.sin(a)*r*0.3}" r="${r*0.4}" fill="none" stroke="oklch(0.72 0.13 70)" stroke-width="0.8"/>`}return s})()}
      </g>
      <!-- footprint glow -->
      <g transform="translate(420 320)" fill="oklch(0.85 0.14 85 / 0.6)">
        <ellipse cx="0" cy="0" rx="14" ry="8"/>
        <circle cx="-10" cy="-8" r="3"/>
        <circle cx="0" cy="-10" r="3"/>
        <circle cx="10" cy="-8" r="3"/>
      </g>
      <!-- grid strings -->
      <g stroke="oklch(0.85 0.14 85 / 0.3)" stroke-width="0.5" stroke-dasharray="2 3">
        <line x1="0" y1="150" x2="600" y2="150"/>
        <line x1="0" y1="210" x2="600" y2="210"/>
        <line x1="200" y1="0" x2="200" y2="360"/>
        <line x1="400" y1="0" x2="400" y2="360"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.13 70 / 0.8)">CRETACEOUS · GRID D7</text>
    </svg>`,

  quant: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="qu-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="oklch(0.40 0.17 310 / 0.5)"/>
          <stop offset="1" stop-color="oklch(0.14 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.16 0.04 265)"/>
      <rect width="600" height="360" fill="url(#qu-glow)"/>
      <!-- probability wave overlay -->
      <g fill="none" stroke="oklch(0.72 0.17 310 / 0.4)" stroke-width="0.8">
        <path d="M0 180 Q60 100 120 180 T240 180 T360 180 T480 180 T600 180"/>
        <path d="M0 190 Q60 110 120 190 T240 190 T360 190 T480 190 T600 190" opacity="0.6"/>
        <path d="M0 170 Q60 250 120 170 T240 170 T360 170 T480 170 T600 170"/>
      </g>
      <!-- double slit -->
      <g transform="translate(200 60)">
        <rect x="-50" y="0" width="100" height="6" fill="oklch(0.28 0.10 310)"/>
        <rect x="-48" y="0" width="96" height="6" fill="none"/>
        <rect x="-10" y="0" width="4" height="6" fill="oklch(0.16 0.04 265)"/>
        <rect x="6" y="0" width="4" height="6" fill="oklch(0.16 0.04 265)"/>
      </g>
      <!-- interference pattern rays -->
      <g stroke="oklch(0.92 0.08 310 / 0.5)" stroke-width="0.6" fill="none">
        ${Array.from({length:10},(_,i)=>`<path d="M192 66 Q${250+i*20} ${180+Math.sin(i)*30} ${350+i*20} 300"/>`).join('')}
        ${Array.from({length:10},(_,i)=>`<path d="M208 66 Q${250+i*20} ${180+Math.cos(i)*30} ${350+i*20} 300"/>`).join('')}
      </g>
      <!-- pattern strip -->
      <rect x="80" y="300" width="440" height="12" fill="oklch(0.18 0.04 265)" stroke="oklch(0.72 0.17 310)" stroke-width="1"/>
      ${Array.from({length:20},(_,i)=>`<rect x="${90+i*22}" y="302" width="6" height="8" fill="oklch(0.92 0.08 310)" opacity="${0.3+0.6*Math.abs(Math.sin(i*0.8))}"/>`).join('')}
      <!-- qubit sphere -->
      <g transform="translate(470 140)">
        <circle r="40" fill="none" stroke="oklch(0.72 0.17 310)" stroke-width="1"/>
        <ellipse rx="40" ry="14" fill="none" stroke="oklch(0.72 0.17 310 / 0.6)" stroke-width="0.6"/>
        <ellipse rx="14" ry="40" fill="none" stroke="oklch(0.72 0.17 310 / 0.6)" stroke-width="0.6"/>
        <line x1="0" y1="-40" x2="0" y2="40" stroke="oklch(0.72 0.17 310 / 0.3)"/>
        <line x1="-40" y1="0" x2="40" y2="0" stroke="oklch(0.72 0.17 310 / 0.3)"/>
        <line x1="0" y1="0" x2="24" y2="-28" stroke="oklch(0.85 0.14 85)" stroke-width="1.5"/>
        <circle cx="24" cy="-28" r="4" fill="oklch(0.85 0.14 85)"/>
        <text x="0" y="-46" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="oklch(0.72 0.17 310)">|0⟩</text>
        <text x="0" y="52" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="oklch(0.72 0.17 310)">|1⟩</text>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.17 310 / 0.8)">|ψ⟩ = α|0⟩ + β|1⟩</text>
    </svg>`,

  nuke: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="nu-core" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="oklch(0.95 0.08 130 / 0.8)"/>
          <stop offset="0.3" stop-color="oklch(0.62 0.16 135 / 0.6)"/>
          <stop offset="1" stop-color="oklch(0.14 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.14 0.04 265)"/>
      <!-- containment ring -->
      <circle cx="300" cy="200" r="140" fill="none" stroke="oklch(0.82 0.17 135 / 0.4)" stroke-width="1"/>
      <circle cx="300" cy="200" r="120" fill="url(#nu-core)"/>
      <circle cx="300" cy="200" r="100" fill="none" stroke="oklch(0.82 0.17 135)" stroke-width="1.2"/>
      <!-- fuel rods pattern -->
      <g>
        ${(()=>{let s='';for(let r=0;r<3;r++){for(let a=0;a<12;a++){const ang=a*30*Math.PI/180;const rad=20+r*20;const x=300+Math.cos(ang)*rad;const y=200+Math.sin(ang)*rad;s+=`<rect x="${x-3}" y="${y-14}" width="6" height="28" fill="oklch(0.95 0.08 130 / 0.8)" stroke="oklch(0.82 0.17 135)" stroke-width="0.5"/>`}}return s})()}
        <circle cx="300" cy="200" r="8" fill="oklch(0.85 0.14 85)"/>
      </g>
      <!-- hazard triangles -->
      <g transform="translate(100 80)">
        <path d="M0 -16 L14 10 L-14 10 Z" fill="oklch(0.82 0.17 135 / 0.6)" stroke="oklch(0.82 0.17 135)" stroke-width="1.5"/>
        <circle r="3" fill="oklch(0.18 0.04 265)"/>
        <path d="M0 -6 a6 6 0 0 1 5.2 9" fill="none" stroke="oklch(0.18 0.04 265)" stroke-width="1.5"/>
        <path d="M0 -6 a6 6 0 0 0 -5.2 9" fill="none" stroke="oklch(0.18 0.04 265)" stroke-width="1.5"/>
      </g>
      <g transform="translate(500 80)">
        <path d="M0 -16 L14 10 L-14 10 Z" fill="none" stroke="oklch(0.82 0.17 135)" stroke-width="1.5"/>
      </g>
      <!-- control panels -->
      <g transform="translate(80 280)">
        <rect width="100" height="60" fill="oklch(0.20 0.06 135)" stroke="oklch(0.82 0.17 135)" stroke-width="1"/>
        <rect x="8" y="8" width="20" height="10" fill="oklch(0.95 0.08 130)"/>
        <rect x="32" y="8" width="20" height="10" fill="oklch(0.82 0.17 135 / 0.5)"/>
        <rect x="56" y="8" width="20" height="10" fill="oklch(0.82 0.17 135 / 0.5)"/>
        <rect x="80" y="8" width="12" height="10" fill="oklch(0.85 0.14 85)"/>
        <rect x="8" y="28" width="84" height="4" fill="oklch(0.82 0.17 135 / 0.3)"/>
        <rect x="8" y="28" width="48" height="4" fill="oklch(0.95 0.08 130)"/>
        <rect x="8" y="40" width="84" height="4" fill="oklch(0.82 0.17 135 / 0.3)"/>
        <rect x="8" y="40" width="28" height="4" fill="oklch(0.85 0.14 85)"/>
      </g>
      <g transform="translate(420 280)">
        <rect width="100" height="60" fill="oklch(0.20 0.06 135)" stroke="oklch(0.82 0.17 135)" stroke-width="1"/>
        <text x="50" y="26" text-anchor="middle" font-family="Space Grotesk" font-size="20" font-weight="500" fill="oklch(0.95 0.08 130)">74%</text>
        <text x="50" y="44" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="oklch(0.82 0.17 135)">CORE OUTPUT</text>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.82 0.17 135 / 0.8)">REACTOR 01 · STABLE</text>
    </svg>`,

  neuro: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="ne-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="oklch(0.40 0.17 25 / 0.5)"/>
          <stop offset="1" stop-color="oklch(0.14 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.16 0.04 265)"/>
      <rect width="600" height="360" fill="url(#ne-glow)"/>
      <!-- brain silhouette -->
      <g transform="translate(300 200)">
        <path d="M-120 -20 Q-130 -70 -80 -90 Q-60 -110 -20 -100 Q20 -110 60 -100 Q100 -110 130 -80 Q140 -30 120 10 Q130 50 100 80 Q60 110 0 100 Q-60 110 -100 80 Q-130 50 -120 -20 Z" fill="oklch(0.22 0.06 25 / 0.6)" stroke="oklch(0.75 0.17 25)" stroke-width="1.5"/>
        <!-- fissures -->
        <path d="M-80 -60 Q-40 -40 0 -60 Q40 -40 80 -60" stroke="oklch(0.75 0.17 25 / 0.6)" stroke-width="1" fill="none"/>
        <path d="M-90 -20 Q-60 0 -20 -10 Q20 0 60 -10 Q90 0 100 -20" stroke="oklch(0.75 0.17 25 / 0.6)" stroke-width="1" fill="none"/>
        <path d="M-100 30 Q-60 50 -20 30 Q20 50 60 30 Q100 50 110 30" stroke="oklch(0.75 0.17 25 / 0.6)" stroke-width="1" fill="none"/>
        <path d="M0 -90 Q0 0 0 90" stroke="oklch(0.75 0.17 25 / 0.8)" stroke-width="1" fill="none"/>
        <!-- firing nodes -->
        ${Array.from({length:12},()=>{const x=(Math.random()-0.5)*220;const y=(Math.random()-0.5)*180;return `<circle cx="${x}" cy="${y}" r="${2+Math.random()*2}" fill="oklch(0.92 0.08 25)"/><circle cx="${x}" cy="${y}" r="${5+Math.random()*3}" fill="oklch(0.92 0.08 25 / 0.3)"/>`}).join('')}
        <!-- highlight node -->
        <circle cx="-30" cy="-20" r="5" fill="oklch(0.85 0.14 85)"/>
        <circle cx="-30" cy="-20" r="12" fill="oklch(0.85 0.14 85 / 0.3)"/>
      </g>
      <!-- EEG waveforms  -->
      <g transform="translate(0 310)" fill="none" stroke="oklch(0.75 0.17 25)" stroke-width="1">
        <path d="M0 0 L40 0 Q48 -10 56 0 Q64 10 72 0 L120 0 Q128 -14 136 0 Q144 14 152 0 L200 0"/>
        <path d="M200 0 L240 0 Q248 -6 256 0 Q264 6 272 0 L320 0 Q328 -12 336 0 Q344 12 352 0 L400 0" opacity="0.7"/>
        <path d="M400 0 L440 0 Q448 -20 456 0 Q464 20 472 0 L520 0 Q528 -10 536 0 Q544 10 552 0 L600 0" opacity="0.5"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.17 25 / 0.8)">ALPHA 10Hz · ACTIVE</text>
    </svg>`,

  mat: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="mt-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" fill="none" stroke="oklch(0.78 0.12 190 / 0.15)" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="600" height="360" fill="oklch(0.17 0.04 265)"/>
      <rect width="600" height="360" fill="url(#mt-grid)"/>
      <!-- lattice -->
      <g transform="translate(300 200)">
        ${(()=>{let s='';const n=4;for(let i=-n;i<=n;i++){for(let j=-n;j<=n;j++){const x=i*40+j*20;const y=j*32-i*10;s+=`<circle cx="${x}" cy="${y}" r="6" fill="oklch(0.78 0.12 190)" stroke="oklch(0.92 0.06 190)" stroke-width="0.6"/>`;if(j<n){s+=`<line x1="${x}" y1="${y}" x2="${x+20}" y2="${y+32}" stroke="oklch(0.78 0.12 190 / 0.4)" stroke-width="0.5"/>`}if(i<n){s+=`<line x1="${x}" y1="${y}" x2="${(i+1)*40+j*20}" y2="${j*32-(i+1)*10}" stroke="oklch(0.78 0.12 190 / 0.4)" stroke-width="0.5"/>`}}}return s})()}
        <!-- highlight atom -->
        <circle cx="0" cy="0" r="8" fill="oklch(0.85 0.14 85)"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="oklch(0.85 0.14 85 / 0.5)"/>
      </g>
      <!-- sample chip -->
      <g transform="translate(80 70)">
        <rect x="-30" y="-20" width="60" height="40" fill="oklch(0.28 0.08 190 / 0.7)" stroke="oklch(0.78 0.12 190)" stroke-width="1"/>
        <rect x="-20" y="-10" width="40" height="20" fill="none" stroke="oklch(0.92 0.06 190)" stroke-width="0.6"/>
        <circle cx="-14" cy="-4" r="2" fill="oklch(0.85 0.14 85)"/>
      </g>
      <!-- specimen -->
      <g transform="translate(510 90)">
        <path d="M0 -30 L22 -10 L18 20 L-18 20 L-22 -10 Z" fill="oklch(0.78 0.12 190 / 0.4)" stroke="oklch(0.78 0.12 190)" stroke-width="1"/>
        <path d="M0 -30 L0 20 M-22 -10 L22 -10" stroke="oklch(0.92 0.06 190 / 0.8)" stroke-width="0.6"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.78 0.12 190 / 0.8)">BCC IRON · 1200°C</text>
    </svg>`,

  micro: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="mi-dish" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="oklch(0.35 0.14 110 / 0.5)"/>
          <stop offset="0.7" stop-color="oklch(0.22 0.08 110 / 0.3)"/>
          <stop offset="1" stop-color="oklch(0.14 0.04 265)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.15 0.04 265)"/>
      <!-- microscope view circle -->
      <circle cx="300" cy="180" r="150" fill="url(#mi-dish)" stroke="oklch(0.82 0.17 110)" stroke-width="2"/>
      <circle cx="300" cy="180" r="150" fill="none" stroke="oklch(0.82 0.17 110 / 0.3)" stroke-width="6"/>
      <!-- ring marks -->
      ${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return `<line x1="${300+Math.cos(a)*148}" y1="${180+Math.sin(a)*148}" x2="${300+Math.cos(a)*156}" y2="${180+Math.sin(a)*156}" stroke="oklch(0.82 0.17 110)" stroke-width="1"/>`}).join('')}
      <!-- bacteria -->
      <g clip-path="url(#micro-clip)">
        <defs><clipPath id="micro-clip"><circle cx="300" cy="180" r="148"/></clipPath></defs>
        ${Array.from({length:20},()=>{const x=300+(Math.random()-0.5)*260;const y=180+(Math.random()-0.5)*260;const rx=8+Math.random()*16;return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx*0.4}" fill="oklch(0.82 0.17 110 / 0.7)" stroke="oklch(0.95 0.08 110)" stroke-width="0.6" transform="rotate(${Math.random()*360} ${x} ${y})"/>`}).join('')}
        <!-- virus particles -->
        ${Array.from({length:6},()=>{const x=300+(Math.random()-0.5)*220;const y=180+(Math.random()-0.5)*220;return `<g transform="translate(${x} ${y})"><circle r="6" fill="oklch(0.85 0.14 85)"/>${Array.from({length:8},(_,k)=>{const a=k*45*Math.PI/180;return `<line x1="${Math.cos(a)*6}" y1="${Math.sin(a)*6}" x2="${Math.cos(a)*12}" y2="${Math.sin(a)*12}" stroke="oklch(0.85 0.14 85)" stroke-width="1.2"/><circle cx="${Math.cos(a)*13}" cy="${Math.sin(a)*13}" r="1.5" fill="oklch(0.85 0.14 85)"/>`}).join('')}</g>`}).join('')}
      </g>
      <!-- crosshair -->
      <line x1="300" y1="40" x2="300" y2="320" stroke="oklch(0.92 0.08 110 / 0.3)" stroke-width="0.5"/>
      <line x1="150" y1="180" x2="450" y2="180" stroke="oklch(0.92 0.08 110 / 0.3)" stroke-width="0.5"/>
      <circle cx="300" cy="180" r="20" fill="none" stroke="oklch(0.92 0.08 110 / 0.5)" stroke-width="0.5"/>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.82 0.17 110 / 0.8)">1000× · SLIDE 04</text>
    </svg>`,

  zoo: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="zo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.35 0.12 40)"/>
          <stop offset="0.6" stop-color="oklch(0.55 0.14 70)"/>
          <stop offset="1" stop-color="oklch(0.40 0.12 90)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#zo-sky)"/>
      <!-- sun -->
      <circle cx="450" cy="150" r="34" fill="oklch(0.85 0.14 85)"/>
      <circle cx="450" cy="150" r="46" fill="none" stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="1"/>
      <!-- distant hills -->
      <path d="M0 260 Q100 240 200 255 Q300 270 400 250 Q500 240 600 255 L600 360 L0 360 Z" fill="oklch(0.35 0.10 75)"/>
      <path d="M0 290 Q150 280 300 290 Q450 300 600 285 L600 360 L0 360 Z" fill="oklch(0.45 0.12 75)"/>
      <!-- savanna ground -->
      <rect x="0" y="320" width="600" height="40" fill="oklch(0.55 0.13 75)"/>
      <!-- acacia trees (silhouette) -->
      <g fill="oklch(0.22 0.06 75)">
        <path d="M90 320 L90 270 L85 260 L95 258 L105 265 L110 270 L105 320 Z"/>
        <ellipse cx="92" cy="252" rx="34" ry="10"/>
        <path d="M520 320 L520 280 L515 270 L525 268 L535 275 L530 320 Z"/>
        <ellipse cx="524" cy="262" rx="28" ry="8"/>
      </g>
      <!-- animals silhouettes -->
      <!-- giraffe -->
      <g fill="oklch(0.22 0.06 75)" transform="translate(200 320)">
        <path d="M0 0 L0 -50 L-4 -60 L-4 -75 L0 -78 L6 -75 L6 -60 L2 -50 L6 -10 L10 0 Z"/>
        <rect x="-2" y="-22" width="2" height="22" fill="oklch(0.22 0.06 75)"/>
      </g>
      <!-- zebra -->
      <g fill="oklch(0.22 0.06 75)" transform="translate(300 320)">
        <path d="M0 0 L0 -18 L4 -22 L16 -22 L20 -26 L24 -18 L24 0 L22 0 L22 -5 L18 -5 L18 0 L6 0 L6 -5 L2 -5 L2 0 Z"/>
      </g>
      <!-- elephant -->
      <g fill="oklch(0.22 0.06 75)" transform="translate(400 320)">
        <path d="M0 0 L0 -22 L4 -28 L20 -28 L24 -22 L30 -22 L32 -16 L30 -10 L28 -22 L24 -22 L24 0 L20 0 L20 -10 L8 -10 L8 0 Z"/>
      </g>
      <!-- flying birds (V-shapes) -->
      <g stroke="oklch(0.22 0.06 75)" stroke-width="1.5" fill="none">
        <path d="M140 90 L150 84 L160 90"/>
        <path d="M250 70 L258 65 L266 70"/>
        <path d="M350 110 L356 106 L362 110"/>
      </g>
      <!-- footprints -->
      <g fill="oklch(0.22 0.06 75 / 0.5)" transform="translate(80 340)">
        <ellipse rx="4" ry="2.5"/><ellipse cx="24" rx="4" ry="2.5"/><ellipse cx="48" rx="4" ry="2.5"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.15 75 / 0.9)">BIOME · SAVANNA 04</text>
    </svg>`,

  bot: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.22 0.08 140)"/>
          <stop offset="1" stop-color="oklch(0.32 0.12 120)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#bo-bg)"/>
      <!-- glass atrium arches -->
      <g fill="none" stroke="oklch(0.78 0.15 120 / 0.5)" stroke-width="0.8">
        <path d="M60 340 Q60 80 300 80 Q540 80 540 340"/>
        <path d="M120 340 Q120 120 300 120 Q480 120 480 340"/>
        <line x1="300" y1="80" x2="300" y2="340"/>
        <line x1="60" y1="220" x2="540" y2="220"/>
      </g>
      <!-- central tree -->
      <g transform="translate(300 340)">
        <rect x="-8" y="-100" width="16" height="100" fill="oklch(0.45 0.12 60)"/>
        <circle cx="0" cy="-120" r="50" fill="oklch(0.55 0.15 120)" stroke="oklch(0.78 0.15 120)" stroke-width="1"/>
        <circle cx="-20" cy="-140" r="30" fill="oklch(0.65 0.14 120)" stroke="oklch(0.78 0.15 120)" stroke-width="1"/>
        <circle cx="24" cy="-134" r="32" fill="oklch(0.60 0.14 120)" stroke="oklch(0.78 0.15 120)" stroke-width="1"/>
      </g>
      <!-- potted plants -->
      <g transform="translate(140 320)">
        <rect x="-18" y="0" width="36" height="20" fill="oklch(0.45 0.12 60)"/>
        <path d="M0 0 Q-14 -20 -20 -40 M0 0 Q14 -20 20 -40 M0 0 Q-6 -26 -4 -50 M0 0 Q6 -26 4 -50" stroke="oklch(0.78 0.15 120)" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="-20" cy="-40" r="6" fill="oklch(0.85 0.14 85)"/>
        <circle cx="20" cy="-40" r="6" fill="oklch(0.78 0.15 120)"/>
        <circle cx="-4" cy="-50" r="5" fill="oklch(0.92 0.08 120)"/>
        <circle cx="4" cy="-50" r="5" fill="oklch(0.78 0.15 120)"/>
      </g>
      <g transform="translate(460 320)">
        <rect x="-16" y="0" width="32" height="18" fill="oklch(0.45 0.12 60)"/>
        <path d="M0 0 Q-16 -16 -22 -34 M0 0 Q16 -16 22 -34" stroke="oklch(0.78 0.15 120)" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M-22 -34 Q-28 -40 -22 -46 Q-16 -40 -22 -34 M22 -34 Q28 -40 22 -46 Q16 -40 22 -34" fill="oklch(0.78 0.15 120)"/>
      </g>
      <!-- floating pollen / spores -->
      ${Array.from({length:20},()=>`<circle cx="${60+Math.random()*480}" cy="${100+Math.random()*200}" r="${1+Math.random()*1.5}" fill="oklch(0.85 0.14 85 / ${0.3+Math.random()*0.5})"/>`).join('')}
      <!-- leaf -->
      <g transform="translate(90 180)">
        <path d="M0 0 Q-20 -10 -30 -30 Q-10 -20 0 0 Z" fill="oklch(0.78 0.15 120)"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.78 0.15 120 / 0.8)">SPECIES · ACER PALMATUM</text>
    </svg>`,

  arch: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ar-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.22 0.08 265)"/>
          <stop offset="1" stop-color="oklch(0.32 0.10 40)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#ar-sky)"/>
      <!-- moon -->
      <circle cx="80" cy="80" r="20" fill="oklch(0.90 0.06 60)"/>
      <circle cx="76" cy="76" r="3" fill="oklch(0.75 0.08 60 / 0.5)"/>
      <!-- stars -->
      ${Array.from({length:14},()=>`<circle cx="${Math.random()*600}" cy="${Math.random()*100}" r="${Math.random()*1}" fill="oklch(0.95 0.02 60)" opacity="0.6"/>`).join('')}
      <!-- distant ruins silhouette -->
      <path d="M0 200 L80 200 L80 180 L100 180 L100 200 L160 200 L160 160 L200 160 L200 200 L260 200 L260 170 L300 170 L300 200 L360 200 L360 180 L400 180 L400 200 L460 200 L460 170 L520 170 L520 200 L600 200 L600 240 L0 240 Z" fill="oklch(0.32 0.10 55)"/>
      <!-- ground -->
      <rect x="0" y="240" width="600" height="120" fill="oklch(0.38 0.10 55)"/>
      <!-- grid strings -->
      <g stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="0.6" stroke-dasharray="2 3">
        <line x1="0" y1="280" x2="600" y2="280"/>
        <line x1="0" y1="320" x2="600" y2="320"/>
        <line x1="150" y1="240" x2="150" y2="360"/>
        <line x1="300" y1="240" x2="300" y2="360"/>
        <line x1="450" y1="240" x2="450" y2="360"/>
      </g>
      <!-- grid markers -->
      <g fill="oklch(0.85 0.14 85)">
        <rect x="148" y="278" width="4" height="4"/>
        <rect x="298" y="278" width="4" height="4"/>
        <rect x="448" y="278" width="4" height="4"/>
        <rect x="148" y="318" width="4" height="4"/>
        <rect x="298" y="318" width="4" height="4"/>
      </g>
      <!-- amphora partially buried -->
      <g transform="translate(220 310)">
        <path d="M-14 -20 Q-20 -10 -14 20 L14 20 Q20 -10 14 -20 Q14 -26 10 -28 L-10 -28 Q-14 -26 -14 -20 Z" fill="oklch(0.72 0.13 55)" stroke="oklch(0.75 0.13 55)" stroke-width="1"/>
        <path d="M-8 -28 L-14 -36 M8 -28 L14 -36" stroke="oklch(0.75 0.13 55)" stroke-width="2" fill="none"/>
        <line x1="-14" y1="-5" x2="14" y2="-5" stroke="oklch(0.92 0.06 60 / 0.5)"/>
        <line x1="-14" y1="5" x2="14" y2="5" stroke="oklch(0.92 0.06 60 / 0.5)"/>
        <!-- crack -->
        <path d="M0 -20 L-4 -5 L2 10" stroke="oklch(0.22 0.06 55)" stroke-width="0.8" fill="none"/>
      </g>
      <!-- glyph stone -->
      <g transform="translate(420 320)">
        <rect x="-20" y="-10" width="40" height="20" fill="oklch(0.55 0.12 55)" stroke="oklch(0.75 0.13 55)" stroke-width="1"/>
        <text x="0" y="4" text-anchor="middle" font-family="Space Grotesk" font-size="11" font-weight="600" fill="oklch(0.85 0.14 85)">◊△□</text>
      </g>
      <!-- shovel / brush  -->
      <g transform="translate(100 300)">
        <line x1="0" y1="0" x2="20" y2="-30" stroke="oklch(0.92 0.06 60)" stroke-width="2"/>
        <path d="M20 -30 L30 -40 L26 -46 L16 -36 Z" fill="oklch(0.75 0.13 55)"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.13 55 / 0.9)">SITE -2400 BCE · E4</text>
    </svg>`,

  agri: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ag-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.42 0.10 245)"/>
          <stop offset="1" stop-color="oklch(0.55 0.13 100)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#ag-sky)"/>
      <!-- sun -->
      <circle cx="100" cy="80" r="24" fill="oklch(0.85 0.14 85)"/>
      <circle cx="100" cy="80" r="34" fill="none" stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="1"/>
      <!-- cloud -->
      <ellipse cx="430" cy="80" rx="50" ry="10" fill="oklch(0.95 0.05 245 / 0.5)"/>
      <ellipse cx="450" cy="90" rx="36" ry="6" fill="oklch(0.95 0.05 245 / 0.6)"/>
      <!-- rolling hills -->
      <path d="M0 180 Q150 160 300 175 Q450 190 600 170 L600 360 L0 360 Z" fill="oklch(0.62 0.13 100)"/>
      <!-- field rows isometric -->
      <g>
        ${Array.from({length:8},(_,i)=>{
          const y=200+i*22;
          return `<path d="M${60+i*12} ${y} L${540-i*12} ${y+3} L${560-i*14} ${y+14} L${40+i*14} ${y+11} Z" fill="oklch(${0.55+i*0.02} 0.13 ${95+i*2})" stroke="oklch(0.82 0.14 100 / 0.5)" stroke-width="0.5"/>`;
        }).join('')}
      </g>
      <!-- crop icons -->
      ${Array.from({length:5},(_,i)=>{const x=120+i*90;const y=210;return `<g transform="translate(${x} ${y})"><line x1="0" y1="0" x2="0" y2="-18" stroke="oklch(0.85 0.14 85)" stroke-width="1.5"/><ellipse cy="-18" rx="4" ry="6" fill="oklch(0.85 0.14 85)"/><path d="M-3 -12 L-6 -16 M3 -12 L6 -16" stroke="oklch(0.85 0.14 85)" stroke-width="1"/></g>`}).join('')}
      <!-- drone -->
      <g transform="translate(400 130)">
        <rect x="-16" y="-4" width="32" height="8" rx="2" fill="oklch(0.28 0.08 100)" stroke="oklch(0.82 0.14 100)" stroke-width="1"/>
        <line x1="-24" y1="-6" x2="-8" y2="-6" stroke="oklch(0.82 0.14 100)" stroke-width="1.2"/>
        <line x1="8" y1="-6" x2="24" y2="-6" stroke="oklch(0.82 0.14 100)" stroke-width="1.2"/>
        <circle cx="-24" cy="-6" r="5" fill="none" stroke="oklch(0.82 0.14 100 / 0.6)" stroke-width="1"/>
        <circle cx="24" cy="-6" r="5" fill="none" stroke="oklch(0.82 0.14 100 / 0.6)" stroke-width="1"/>
        <circle cx="0" cy="2" r="2" fill="oklch(0.85 0.14 85)"/>
        <!-- scanning beam -->
        <path d="M-14 6 L-22 50 L22 50 L14 6 Z" fill="oklch(0.85 0.14 85 / 0.15)"/>
      </g>
      <!-- sensor stake -->
      <g transform="translate(180 220)">
        <line x1="0" y1="0" x2="0" y2="-40" stroke="oklch(0.82 0.14 100)" stroke-width="1.2"/>
        <rect x="-6" y="-48" width="12" height="10" fill="oklch(0.28 0.08 100)" stroke="oklch(0.82 0.14 100)" stroke-width="0.8"/>
        <circle cx="0" cy="-43" r="2" fill="oklch(0.85 0.14 85)"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.82 0.14 100 / 0.9)">FIELD 03 · SOIL pH 6.5</text>
    </svg>`,
};

// merge into global ENVIRONMENTS
Object.assign(window.ENVIRONMENTS, ENVIRONMENTS_EXT);
