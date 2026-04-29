/* ========================================================
   SVG factory — environments, icons, props, mascots per subject
   Each function returns an SVG string styled via currentColor
======================================================== */

/* ------- ENVIRONMENTS (360×360 hero scene per theme) ------- */
const ENVIRONMENTS = {
  cs: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.18 0.04 265)"/>
          <stop offset="1" stop-color="oklch(0.25 0.12 210)"/>
        </linearGradient>
        <pattern id="cs-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" fill="none" stroke="oklch(0.75 0.17 200 / 0.15)" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="600" height="360" fill="url(#cs-sky)"/>
      <rect width="600" height="360" fill="url(#cs-grid)"/>
      <!-- floor grid isometric -->
      <g transform="translate(300 270)" stroke="oklch(0.75 0.17 200 / 0.4)" fill="none" stroke-width="0.7">
        ${Array.from({length:12},(_,i)=>`<path d="M${-300+i*50} 0 L${-150+i*50} 70 L${150+i*50} 70 L${i*50} 0 Z"/>`).join('')}
      </g>
      <!-- data towers -->
      <g>
        <rect x="120" y="130" width="50" height="150" fill="oklch(0.22 0.08 210)" stroke="oklch(0.75 0.17 200)" stroke-width="1"/>
        <rect x="128" y="140" width="34" height="4" fill="oklch(0.75 0.17 200 / 0.8)"/>
        <rect x="128" y="150" width="20" height="4" fill="oklch(0.75 0.17 200 / 0.6)"/>
        <rect x="128" y="160" width="28" height="4" fill="oklch(0.75 0.17 200 / 0.7)"/>
        <rect x="128" y="200" width="34" height="2" fill="oklch(0.85 0.14 85)"/>
        <rect x="128" y="230" width="16" height="4" fill="oklch(0.75 0.17 200 / 0.6)"/>
      </g>
      <g>
        <rect x="200" y="80" width="60" height="200" fill="oklch(0.24 0.09 210)" stroke="oklch(0.75 0.17 200)" stroke-width="1"/>
        <rect x="210" y="92" width="40" height="3" fill="oklch(0.75 0.17 200 / 0.9)"/>
        <rect x="210" y="100" width="26" height="3" fill="oklch(0.75 0.17 200 / 0.6)"/>
        <circle cx="230" cy="130" r="14" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <circle cx="230" cy="130" r="4" fill="oklch(0.85 0.14 85)"/>
        <rect x="210" y="160" width="40" height="2" fill="oklch(0.75 0.17 200 / 0.7)"/>
        <rect x="210" y="180" width="30" height="2" fill="oklch(0.75 0.17 200 / 0.7)"/>
        <rect x="210" y="200" width="40" height="2" fill="oklch(0.75 0.17 200 / 0.7)"/>
      </g>
      <g>
        <rect x="290" y="110" width="70" height="170" fill="oklch(0.22 0.08 210)" stroke="oklch(0.75 0.17 200)" stroke-width="1"/>
        ${Array.from({length:8},(_,i)=>`<rect x="300" y="${122+i*18}" width="${30+Math.random()*20}" height="3" fill="oklch(0.75 0.17 200 / ${0.5+Math.random()*0.4})"/>`).join('')}
      </g>
      <g>
        <rect x="390" y="150" width="50" height="130" fill="oklch(0.24 0.09 210)" stroke="oklch(0.75 0.17 200)" stroke-width="1"/>
        <rect x="398" y="162" width="34" height="3" fill="oklch(0.85 0.14 85)"/>
        <rect x="398" y="175" width="24" height="3" fill="oklch(0.75 0.17 200 / 0.7)"/>
        <rect x="398" y="220" width="34" height="3" fill="oklch(0.75 0.17 200 / 0.7)"/>
      </g>
      <!-- floating packet -->
      <g transform="translate(480 100)">
        <rect x="-10" y="-10" width="20" height="20" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1.2"/>
        <rect x="-6" y="-6" width="12" height="12" fill="oklch(0.85 0.14 85)" opacity="0.4"/>
      </g>
      <!-- flying binary -->
      <text x="70" y="60" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.17 200 / 0.6)">01001000 01101001</text>
      <text x="420" y="40" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.17 200 / 0.5)">fn() => {}</text>
    </svg>`,

  bio: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="bio-glow" cx="0.5" cy="0.6" r="0.7">
          <stop offset="0" stop-color="oklch(0.35 0.14 155 / 0.6)"/>
          <stop offset="1" stop-color="oklch(0.16 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.16 0.04 265)"/>
      <rect width="600" height="360" fill="url(#bio-glow)"/>
      <!-- glass dome -->
      <path d="M80 320 Q80 130 300 120 Q520 130 520 320 Z" fill="oklch(0.75 0.17 155 / 0.05)" stroke="oklch(0.75 0.17 155)" stroke-width="1"/>
      <path d="M80 320 Q80 130 300 120" fill="none" stroke="oklch(0.75 0.17 155 / 0.5)" stroke-width="0.5"/>
      <!-- floor -->
      <line x1="80" y1="320" x2="520" y2="320" stroke="oklch(0.75 0.17 155)" stroke-width="1.5"/>
      <!-- double helix center -->
      <g transform="translate(300 220)">
        ${Array.from({length:14},(_,i)=>{
          const y = -90 + i*13;
          const phase = i * 0.5;
          const x1 = Math.cos(phase) * 35;
          const x2 = Math.cos(phase + Math.PI) * 35;
          return `
            <circle cx="${x1}" cy="${y}" r="4" fill="oklch(0.75 0.17 155)"/>
            <circle cx="${x2}" cy="${y}" r="4" fill="oklch(0.85 0.14 85)"/>
            <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="oklch(0.75 0.17 155 / 0.5)" stroke-width="1"/>`;
        }).join('')}
      </g>
      <!-- flasks -->
      <g transform="translate(140 250)">
        <path d="M-15 -40 L-15 -10 L-25 20 L25 20 L15 -10 L15 -40 Z" fill="oklch(0.75 0.17 155 / 0.15)" stroke="oklch(0.75 0.17 155)" stroke-width="1"/>
        <path d="M-25 20 L25 20 L20 5 L-20 5 Z" fill="oklch(0.75 0.17 155 / 0.6)"/>
        <circle cx="-5" cy="12" r="2" fill="oklch(0.92 0.08 150)"/>
        <circle cx="8" cy="8" r="1.5" fill="oklch(0.92 0.08 150)"/>
      </g>
      <g transform="translate(460 250)">
        <path d="M-12 -30 L-12 -8 L-22 18 L22 18 L12 -8 L12 -30 Z" fill="oklch(0.85 0.14 85 / 0.15)" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <path d="M-22 18 L22 18 L18 4 L-18 4 Z" fill="oklch(0.85 0.14 85 / 0.5)"/>
      </g>
      <!-- floating pollen -->
      ${Array.from({length:18},()=>`<circle cx="${80+Math.random()*440}" cy="${140+Math.random()*170}" r="${1+Math.random()*1.5}" fill="oklch(0.92 0.08 150 / ${0.4+Math.random()*0.4})"/>`).join('')}
      <text x="90" y="150" font-family="JetBrains Mono" font-size="9" fill="oklch(0.75 0.17 155 / 0.7)">SEQUENCE 3A-7F</text>
    </svg>`,

  space: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.10 0.04 280)"/>
          <stop offset="1" stop-color="oklch(0.20 0.10 290)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#sp-sky)"/>
      <!-- distant planet -->
      <circle cx="110" cy="110" r="50" fill="oklch(0.32 0.10 295 / 0.6)" stroke="oklch(0.72 0.17 295 / 0.6)" stroke-width="0.6"/>
      <ellipse cx="110" cy="110" rx="80" ry="12" fill="none" stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="0.8"/>
      <!-- stars -->
      ${Array.from({length:40},()=>`<circle cx="${Math.random()*600}" cy="${Math.random()*250}" r="${Math.random()*1.2}" fill="oklch(0.95 0.02 295)" opacity="${0.3+Math.random()*0.7}"/>`).join('')}
      <!-- horizon -->
      <path d="M0 280 Q300 260 600 285 L600 360 L0 360 Z" fill="oklch(0.20 0.08 290)"/>
      <line x1="0" y1="280" x2="600" y2="285" stroke="oklch(0.72 0.17 295)" stroke-width="1"/>
      <!-- launch gantry -->
      <g transform="translate(300 280)">
        <!-- rocket -->
        <path d="M-14 -120 Q-14 -140 0 -160 Q14 -140 14 -120 L14 -20 L-14 -20 Z" fill="oklch(0.95 0.02 295)" stroke="oklch(0.72 0.17 295)" stroke-width="1"/>
        <circle cx="0" cy="-130" r="4" fill="oklch(0.72 0.17 295)"/>
        <rect x="-14" y="-80" width="28" height="3" fill="oklch(0.85 0.14 85)"/>
        <path d="M-14 -20 L-24 0 L-14 0 Z" fill="oklch(0.72 0.17 295)"/>
        <path d="M14 -20 L24 0 L14 0 Z" fill="oklch(0.72 0.17 295)"/>
        <!-- flames -->
        <path d="M-10 0 L0 30 L10 0 Z" fill="oklch(0.85 0.14 85)"/>
        <path d="M-6 0 L0 18 L6 0 Z" fill="oklch(0.95 0.08 120)"/>
        <!-- gantry tower -->
        <g stroke="oklch(0.72 0.17 295)" fill="none" stroke-width="1">
          <line x1="-60" y1="-140" x2="-60" y2="0"/>
          <line x1="-50" y1="-130" x2="-50" y2="-10"/>
          <line x1="-60" y1="-130" x2="-50" y2="-140"/>
          <line x1="-60" y1="-100" x2="-50" y2="-110"/>
          <line x1="-60" y1="-70" x2="-50" y2="-80"/>
          <line x1="-60" y1="-40" x2="-50" y2="-50"/>
          <line x1="-60" y1="-130" x2="-50" y2="-120"/>
          <line x1="-60" y1="-100" x2="-50" y2="-90"/>
          <line x1="-60" y1="-70" x2="-50" y2="-60"/>
          <line x1="-50" y1="-120" x2="-18" y2="-120"/>
          <line x1="-50" y1="-80" x2="-18" y2="-80"/>
        </g>
        <!-- trajectory arc -->
        <path d="M0 -160 Q80 -220 200 -180" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1" stroke-dasharray="3 3"/>
        <circle cx="200" cy="-180" r="3" fill="oklch(0.85 0.14 85)"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.17 295 / 0.7)">T-MINUS 00:03</text>
      <text x="480" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.85 0.14 85 / 0.7)">PAD 01 · GO</text>
    </svg>`,

  mech: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="m-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.18 0.04 265)"/>
          <stop offset="1" stop-color="oklch(0.26 0.10 55)"/>
        </linearGradient>
        <pattern id="blueprint" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="oklch(0.75 0.17 55 / 0.15)" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="600" height="360" fill="url(#m-bg)"/>
      <rect width="600" height="360" fill="url(#blueprint)"/>
      <!-- huge gear center -->
      <g transform="translate(300 200)">
        ${(() => { let s=''; const teeth=16; for(let i=0;i<teeth;i++){const a=i*360/teeth; s+=`<rect x="-8" y="-100" width="16" height="22" fill="oklch(0.75 0.17 55)" transform="rotate(${a})"/>`} return s; })()}
        <circle r="80" fill="oklch(0.28 0.10 55)" stroke="oklch(0.75 0.17 55)" stroke-width="2"/>
        <circle r="60" fill="none" stroke="oklch(0.75 0.17 55 / 0.5)" stroke-width="1"/>
        <circle r="16" fill="oklch(0.85 0.14 85)"/>
        <circle r="10" fill="oklch(0.18 0.04 265)"/>
        <circle r="4" fill="oklch(0.85 0.14 85)"/>
        ${Array.from({length:6},(_,i)=>{const a=i*60*Math.PI/180; return `<circle cx="${Math.cos(a)*40}" cy="${Math.sin(a)*40}" r="3" fill="oklch(0.75 0.17 55)"/>`}).join('')}
      </g>
      <!-- side gears -->
      <g transform="translate(130 130)">
        ${(() => { let s=''; const teeth=10; for(let i=0;i<teeth;i++){const a=i*360/teeth; s+=`<rect x="-4" y="-42" width="8" height="10" fill="oklch(0.85 0.14 85 / 0.8)" transform="rotate(${a})"/>`} return s; })()}
        <circle r="32" fill="oklch(0.30 0.10 55)" stroke="oklch(0.85 0.14 85)" stroke-width="1.2"/>
        <circle r="6" fill="oklch(0.85 0.14 85)"/>
      </g>
      <g transform="translate(480 280)">
        ${(() => { let s=''; const teeth=12; for(let i=0;i<teeth;i++){const a=i*360/teeth; s+=`<rect x="-5" y="-52" width="10" height="12" fill="oklch(0.75 0.17 55 / 0.8)" transform="rotate(${a})"/>`} return s; })()}
        <circle r="38" fill="oklch(0.26 0.10 55)" stroke="oklch(0.75 0.17 55)" stroke-width="1.2"/>
        <circle r="8" fill="oklch(0.75 0.17 55)"/>
      </g>
      <!-- steam puffs -->
      <circle cx="60" cy="80" r="18" fill="oklch(0.75 0.17 55 / 0.1)"/>
      <circle cx="80" cy="60" r="12" fill="oklch(0.75 0.17 55 / 0.15)"/>
      <circle cx="540" cy="100" r="15" fill="oklch(0.85 0.14 85 / 0.1)"/>
      <!-- floor line -->
      <line x1="0" y1="340" x2="600" y2="340" stroke="oklch(0.75 0.17 55)" stroke-width="1"/>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.17 55 / 0.7)">RPM 1,240 · TORQUE 88Nm</text>
    </svg>`,

  ai: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ai-aurora" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.18 0.04 265)"/>
          <stop offset="0.5" stop-color="oklch(0.28 0.12 335)"/>
          <stop offset="1" stop-color="oklch(0.22 0.08 275)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#ai-aurora)"/>
      <!-- aurora waves -->
      <path d="M0 120 Q150 80 300 130 T600 110" fill="none" stroke="oklch(0.72 0.17 335 / 0.6)" stroke-width="2"/>
      <path d="M0 150 Q150 110 300 160 T600 140" fill="none" stroke="oklch(0.72 0.17 335 / 0.4)" stroke-width="1.5"/>
      <path d="M0 180 Q150 140 300 190 T600 170" fill="none" stroke="oklch(0.72 0.17 335 / 0.3)" stroke-width="1"/>
      <!-- neural net -->
      <g transform="translate(300 230)">
        ${(() => {
          const cols = [[-150,-40,0,40],[-60,-70,-20,30,80],[30,-60,-10,40],[120,-20,20]];
          let s='';
          // lines first
          for(let i=0;i<cols.length-1;i++){
            for(const y1 of cols[i].slice(1)){
              for(const y2 of cols[i+1].slice(1)){
                s += `<line x1="${cols[i][0]}" y1="${y1}" x2="${cols[i+1][0]}" y2="${y2}" stroke="oklch(0.72 0.17 335 / 0.2)" stroke-width="0.6"/>`;
              }
            }
          }
          // nodes
          for(const col of cols){
            const x = col[0];
            for(const y of col.slice(1)){
              s += `<circle cx="${x}" cy="${y}" r="6" fill="oklch(0.18 0.04 265)" stroke="oklch(0.72 0.17 335)" stroke-width="1.2"/>`;
              s += `<circle cx="${x}" cy="${y}" r="2.5" fill="oklch(0.92 0.08 335)"/>`;
            }
          }
          // highlight path
          s += `<path d="M-150 0 L-60 30 L30 -10 L120 20" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1.4"/>`;
          return s;
        })()}
      </g>
      <!-- floor grid -->
      <path d="M0 330 L600 330" stroke="oklch(0.72 0.17 335 / 0.4)" stroke-width="1"/>
      <path d="M0 350 L600 350" stroke="oklch(0.72 0.17 335 / 0.2)" stroke-width="0.5"/>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.17 335 / 0.7)">MODEL 4.2B · LOSS 0.0042</text>
      <text x="450" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.85 0.14 85 / 0.7)">EPOCH 0128</text>
    </svg>`,

  math: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="360" fill="oklch(0.16 0.04 265)"/>
      <!-- floor perspective -->
      <g stroke="oklch(0.72 0.17 245 / 0.3)" fill="none" stroke-width="0.6">
        ${Array.from({length:8},(_,i)=>`<path d="M${-200+i*120} 360 L300 220"/>`).join('')}
        ${Array.from({length:6},(_,i)=>`<path d="M0 ${260+i*18} L600 ${260+i*18}" opacity="${1-i*0.13}"/>`).join('')}
      </g>
      <!-- polyhedron floating -->
      <g transform="translate(420 170)" stroke="oklch(0.72 0.17 245)" fill="none" stroke-width="1.2">
        <path d="M0 -60 L50 -20 L40 40 L-40 40 L-50 -20 Z"/>
        <path d="M0 -60 L0 30 L50 -20"/>
        <path d="M0 -60 L-50 -20 L0 30"/>
        <path d="M50 -20 L40 40 L0 30"/>
        <path d="M-50 -20 L-40 40 L0 30"/>
        <circle cx="0" cy="-60" r="2" fill="oklch(0.85 0.14 85)"/>
        <circle cx="50" cy="-20" r="2" fill="oklch(0.85 0.14 85)"/>
        <circle cx="-50" cy="-20" r="2" fill="oklch(0.85 0.14 85)"/>
        <circle cx="40" cy="40" r="2" fill="oklch(0.85 0.14 85)"/>
        <circle cx="-40" cy="40" r="2" fill="oklch(0.85 0.14 85)"/>
        <circle cx="0" cy="30" r="2" fill="oklch(0.85 0.14 85)"/>
      </g>
      <!-- parabola curve -->
      <g transform="translate(120 200)">
        <line x1="0" y1="0" x2="150" y2="0" stroke="oklch(0.72 0.17 245)" stroke-width="1"/>
        <line x1="0" y1="-80" x2="0" y2="40" stroke="oklch(0.72 0.17 245)" stroke-width="1"/>
        <path d="M-50 40 Q0 -100 100 40" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1.4"/>
        <circle r="3" fill="oklch(0.85 0.14 85)"/>
        <text x="140" y="-4" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.17 245)">x</text>
        <text x="6" y="-75" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.17 245)">y</text>
      </g>
      <!-- floating formulas -->
      <text x="280" y="110" font-family="JetBrains Mono" font-size="14" fill="oklch(0.72 0.17 245 / 0.8)">e^(iπ) + 1 = 0</text>
      <text x="60" y="100" font-family="JetBrains Mono" font-size="11" fill="oklch(0.72 0.17 245 / 0.6)">∑ n(n+1)/2</text>
      <text x="440" y="310" font-family="JetBrains Mono" font-size="11" fill="oklch(0.85 0.14 85 / 0.7)">∃ x ∈ ℝ</text>
      <!-- dotted construction -->
      <circle cx="300" cy="300" r="1.5" fill="oklch(0.72 0.17 245)"/>
      <circle cx="340" cy="290" r="1.5" fill="oklch(0.72 0.17 245)"/>
      <circle cx="370" cy="300" r="1.5" fill="oklch(0.72 0.17 245)"/>
    </svg>`,

  med: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="m-glow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="oklch(0.35 0.15 15 / 0.5)"/>
          <stop offset="1" stop-color="oklch(0.16 0.04 265 / 0)"/>
        </radialGradient>
      </defs>
      <rect width="600" height="360" fill="oklch(0.17 0.04 265)"/>
      <rect width="600" height="360" fill="url(#m-glow)"/>
      <!-- pod glass -->
      <rect x="200" y="80" width="200" height="220" rx="100" fill="oklch(0.75 0.16 15 / 0.05)" stroke="oklch(0.75 0.16 15 / 0.7)" stroke-width="1.2"/>
      <rect x="200" y="80" width="200" height="220" rx="100" fill="none" stroke="oklch(0.92 0.08 15 / 0.2)" stroke-width="0.5"/>
      <!-- heart center -->
      <g transform="translate(300 190)">
        <path d="M0 20 C-30 -10 -50 -10 -30 -30 C-20 -40 -10 -30 0 -20 C10 -30 20 -40 30 -30 C50 -10 30 -10 0 20 Z" fill="oklch(0.75 0.16 15 / 0.25)" stroke="oklch(0.75 0.16 15)" stroke-width="1.4"/>
        <path d="M-40 0 L-20 0 L-12 -15 L0 15 L8 -10 L16 0 L40 0" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1.4"/>
      </g>
      <!-- pulse waves around pod -->
      <circle cx="300" cy="190" r="120" fill="none" stroke="oklch(0.75 0.16 15 / 0.3)" stroke-width="0.5"/>
      <circle cx="300" cy="190" r="145" fill="none" stroke="oklch(0.75 0.16 15 / 0.15)" stroke-width="0.5" stroke-dasharray="4 4"/>
      <!-- monitors -->
      <g transform="translate(80 150)">
        <rect width="80" height="90" rx="6" fill="oklch(0.20 0.05 265)" stroke="oklch(0.75 0.16 15)" stroke-width="1"/>
        <text x="8" y="18" font-family="JetBrains Mono" font-size="9" fill="oklch(0.75 0.16 15)">BPM</text>
        <text x="8" y="50" font-family="Space Grotesk" font-size="26" font-weight="500" fill="oklch(0.92 0.08 15)">72</text>
        <path d="M8 72 L24 72 L32 60 L40 84 L48 72 L72 72" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
      </g>
      <g transform="translate(440 150)">
        <rect width="80" height="90" rx="6" fill="oklch(0.20 0.05 265)" stroke="oklch(0.75 0.16 15)" stroke-width="1"/>
        <text x="8" y="18" font-family="JetBrains Mono" font-size="9" fill="oklch(0.75 0.16 15)">O₂ SAT</text>
        <text x="8" y="50" font-family="Space Grotesk" font-size="26" font-weight="500" fill="oklch(0.92 0.08 15)">98%</text>
        <circle cx="50" cy="72" r="8" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <circle cx="50" cy="72" r="3" fill="oklch(0.85 0.14 85)"/>
      </g>
      <line x1="0" y1="330" x2="600" y2="330" stroke="oklch(0.75 0.16 15)" stroke-width="1"/>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.75 0.16 15 / 0.7)">WARD A · CASE #0042</text>
    </svg>`,

  chem: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="c-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.18 0.04 265)"/>
          <stop offset="1" stop-color="oklch(0.24 0.10 125)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#c-bg)"/>
      <!-- atrium arches -->
      <path d="M60 340 Q60 120 300 100 Q540 120 540 340" fill="none" stroke="oklch(0.82 0.17 125 / 0.4)" stroke-width="0.8"/>
      <path d="M100 340 Q100 150 300 130 Q500 150 500 340" fill="none" stroke="oklch(0.82 0.17 125 / 0.3)" stroke-width="0.6"/>
      <!-- molecule center -->
      <g transform="translate(300 210)">
        <line x1="0" y1="0" x2="60" y2="-30" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
        <line x1="0" y1="0" x2="-60" y2="-30" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
        <line x1="0" y1="0" x2="40" y2="50" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
        <line x1="0" y1="0" x2="-40" y2="50" stroke="oklch(0.82 0.17 125)" stroke-width="1.5"/>
        <line x1="60" y1="-30" x2="80" y2="-75" stroke="oklch(0.82 0.17 125)" stroke-width="1"/>
        <line x1="-60" y1="-30" x2="-80" y2="-75" stroke="oklch(0.82 0.17 125)" stroke-width="1"/>
        <circle r="14" fill="oklch(0.85 0.14 85)"/>
        <text y="4" text-anchor="middle" font-family="Space Grotesk" font-size="10" font-weight="600" fill="oklch(0.18 0.04 265)">C</text>
        <g transform="translate(60 -30)"><circle r="10" fill="oklch(0.82 0.17 125)"/><text y="3" text-anchor="middle" font-family="Space Grotesk" font-size="9" font-weight="600" fill="oklch(0.18 0.04 265)">O</text></g>
        <g transform="translate(-60 -30)"><circle r="10" fill="oklch(0.82 0.17 125)"/><text y="3" text-anchor="middle" font-family="Space Grotesk" font-size="9" font-weight="600" fill="oklch(0.18 0.04 265)">O</text></g>
        <g transform="translate(40 50)"><circle r="8" fill="oklch(0.75 0.17 200)"/><text y="3" text-anchor="middle" font-family="Space Grotesk" font-size="8" font-weight="600" fill="oklch(0.18 0.04 265)">H</text></g>
        <g transform="translate(-40 50)"><circle r="8" fill="oklch(0.75 0.17 200)"/><text y="3" text-anchor="middle" font-family="Space Grotesk" font-size="8" font-weight="600" fill="oklch(0.18 0.04 265)">H</text></g>
        <g transform="translate(80 -75)"><circle r="7" fill="oklch(0.82 0.17 125)" opacity="0.7"/></g>
        <g transform="translate(-80 -75)"><circle r="7" fill="oklch(0.82 0.17 125)" opacity="0.7"/></g>
      </g>
      <!-- beakers -->
      <g transform="translate(120 260)">
        <path d="M-18 -40 L-18 -20 L-26 20 L26 20 L18 -20 L18 -40 Z" fill="oklch(0.82 0.17 125 / 0.15)" stroke="oklch(0.82 0.17 125)" stroke-width="1"/>
        <path d="M-24 10 L24 10 L20 -5 L-20 -5 Z" fill="oklch(0.82 0.17 125 / 0.7)"/>
        <circle cx="-8" cy="2" r="2" fill="oklch(0.95 0.08 120)"/>
        <circle cx="10" cy="-1" r="1.5" fill="oklch(0.95 0.08 120)"/>
      </g>
      <g transform="translate(480 270)">
        <rect x="-20" y="-30" width="40" height="50" rx="2" fill="oklch(0.85 0.14 85 / 0.15)" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <rect x="-18" y="0" width="36" height="18" fill="oklch(0.85 0.14 85 / 0.5)"/>
        <circle cx="0" cy="8" r="2" fill="oklch(0.95 0.08 120)"/>
      </g>
      <!-- floating atoms -->
      ${Array.from({length:12},()=>`<circle cx="${60+Math.random()*480}" cy="${90+Math.random()*220}" r="${1+Math.random()*2}" fill="oklch(0.95 0.08 120 / ${0.3+Math.random()*0.5})"/>`).join('')}
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.82 0.17 125 / 0.7)">H₂O · pH 7.4</text>
    </svg>`,

  phys: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="p-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.16 0.04 265)"/>
          <stop offset="1" stop-color="oklch(0.22 0.08 215)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#p-bg)"/>
      <!-- field lines -->
      <g fill="none" stroke="oklch(0.78 0.13 215 / 0.3)" stroke-width="0.6">
        <path d="M0 180 Q150 60 300 180 T600 180"/>
        <path d="M0 200 Q150 100 300 200 T600 200"/>
        <path d="M0 220 Q150 140 300 220 T600 220"/>
        <path d="M0 240 Q150 180 300 240 T600 240"/>
      </g>
      <!-- pendulum -->
      <g transform="translate(200 80)">
        <line x1="0" y1="0" x2="-40" y2="180" stroke="oklch(0.78 0.13 215)" stroke-width="1"/>
        <circle cx="-40" cy="180" r="14" fill="oklch(0.78 0.13 215)"/>
        <circle cx="-40" cy="180" r="6" fill="oklch(0.85 0.14 85)"/>
        <path d="M-80 180 Q-40 150 0 180" fill="none" stroke="oklch(0.78 0.13 215 / 0.4)" stroke-width="0.8" stroke-dasharray="2 3"/>
      </g>
      <!-- prism / light cone -->
      <g transform="translate(400 190)">
        <path d="M0 -40 L-30 30 L30 30 Z" fill="oklch(0.78 0.13 215 / 0.15)" stroke="oklch(0.78 0.13 215)" stroke-width="1.2"/>
        <line x1="-60" y1="0" x2="0" y2="0" stroke="oklch(0.92 0.08 215)" stroke-width="1.2"/>
        <line x1="0" y1="0" x2="80" y2="-20" stroke="oklch(0.75 0.17 155)" stroke-width="1"/>
        <line x1="0" y1="0" x2="80" y2="-10" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <line x1="0" y1="0" x2="80" y2="0" stroke="oklch(0.75 0.16 15)" stroke-width="1"/>
        <line x1="0" y1="0" x2="80" y2="10" stroke="oklch(0.72 0.17 295)" stroke-width="1"/>
        <line x1="0" y1="0" x2="80" y2="20" stroke="oklch(0.75 0.17 200)" stroke-width="1"/>
      </g>
      <!-- ground -->
      <line x1="0" y1="320" x2="600" y2="320" stroke="oklch(0.78 0.13 215)" stroke-width="1"/>
      <!-- equations floating -->
      <text x="40" y="40" font-family="JetBrains Mono" font-size="11" fill="oklch(0.78 0.13 215 / 0.7)">F = ma</text>
      <text x="280" y="60" font-family="JetBrains Mono" font-size="11" fill="oklch(0.78 0.13 215 / 0.6)">E = mc²</text>
      <text x="460" y="330" font-family="JetBrains Mono" font-size="10" fill="oklch(0.85 0.14 85 / 0.7)">c = 3×10⁸ m/s</text>
      <!-- particles -->
      ${Array.from({length:10},()=>`<circle cx="${Math.random()*600}" cy="${100+Math.random()*200}" r="${Math.random()*1.5}" fill="oklch(0.92 0.08 215)" opacity="${0.3+Math.random()*0.5}"/>`).join('')}
    </svg>`,

  env: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="e-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="oklch(0.22 0.10 250)"/>
          <stop offset="1" stop-color="oklch(0.30 0.10 140)"/>
        </linearGradient>
      </defs>
      <rect width="600" height="360" fill="url(#e-sky)"/>
      <!-- dome -->
      <path d="M60 320 Q60 120 300 100 Q540 120 540 320 Z" fill="oklch(0.72 0.15 140 / 0.08)" stroke="oklch(0.72 0.15 140 / 0.6)" stroke-width="1"/>
      <!-- stars outside dome top -->
      ${Array.from({length:14},()=>`<circle cx="${Math.random()*600}" cy="${Math.random()*80}" r="${Math.random()*1}" fill="oklch(0.95 0.02 140)" opacity="0.7"/>`).join('')}
      <!-- mountains -->
      <path d="M80 320 L150 200 L220 280 L290 180 L360 260 L430 210 L520 320 Z" fill="oklch(0.28 0.10 140)" stroke="oklch(0.72 0.15 140)" stroke-width="1"/>
      <!-- trees -->
      <g fill="oklch(0.72 0.15 140)">
        <path d="M180 320 L195 280 L210 320 Z"/>
        <path d="M180 310 L195 270 L210 310 Z"/>
        <path d="M250 320 L260 290 L270 320 Z"/>
        <path d="M400 320 L412 286 L424 320 Z"/>
        <path d="M460 320 L472 288 L484 320 Z"/>
      </g>
      <!-- river -->
      <path d="M100 320 Q200 310 300 315 Q400 320 500 310" fill="none" stroke="oklch(0.75 0.13 215)" stroke-width="3"/>
      <path d="M100 325 Q200 315 300 320 Q400 325 500 315" fill="none" stroke="oklch(0.92 0.08 215 / 0.5)" stroke-width="1"/>
      <!-- sun -->
      <circle cx="420" cy="140" r="22" fill="oklch(0.85 0.14 85)"/>
      <circle cx="420" cy="140" r="32" fill="none" stroke="oklch(0.85 0.14 85 / 0.4)" stroke-width="1"/>
      <!-- clouds -->
      <ellipse cx="150" cy="160" rx="40" ry="8" fill="oklch(0.95 0.03 140 / 0.3)"/>
      <ellipse cx="170" cy="165" rx="25" ry="5" fill="oklch(0.95 0.03 140 / 0.4)"/>
      <!-- pollen / particles -->
      ${Array.from({length:18},()=>`<circle cx="${Math.random()*600}" cy="${150+Math.random()*150}" r="${Math.random()*1.2}" fill="oklch(0.85 0.14 85 / ${0.4+Math.random()*0.4})"/>`).join('')}
      <!-- leaf drones -->
      <path d="M90 240 Q100 230 110 240 Q100 250 90 240 Z" fill="oklch(0.72 0.15 140)"/>
      <path d="M500 200 Q510 190 520 200 Q510 210 500 200 Z" fill="oklch(0.72 0.15 140)"/>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.15 140 / 0.8)">CO₂ 412 ppm · TEMP 18°C</text>
    </svg>`,

  robo: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="hex-floor" width="40" height="34" patternUnits="userSpaceOnUse">
          <path d="M10 0 L30 0 L40 17 L30 34 L10 34 L0 17 Z" fill="none" stroke="oklch(0.82 0.15 95 / 0.2)" stroke-width="0.6"/>
        </pattern>
      </defs>
      <rect width="600" height="360" fill="oklch(0.17 0.04 265)"/>
      <rect y="240" width="600" height="120" fill="url(#hex-floor)"/>
      <line x1="0" y1="240" x2="600" y2="240" stroke="oklch(0.82 0.15 95 / 0.5)" stroke-width="1"/>
      <!-- robotic arm -->
      <g transform="translate(300 240)">
        <!-- base -->
        <rect x="-40" y="0" width="80" height="14" fill="oklch(0.82 0.15 95)"/>
        <rect x="-30" y="-6" width="60" height="6" fill="oklch(0.28 0.08 95)" stroke="oklch(0.82 0.15 95)" stroke-width="0.8"/>
        <!-- segment 1 -->
        <g transform="rotate(-30)">
          <rect x="-8" y="-100" width="16" height="100" fill="oklch(0.28 0.08 95)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
          <circle r="10" fill="oklch(0.82 0.15 95)"/>
          <circle r="4" fill="oklch(0.18 0.04 265)"/>
          <!-- segment 2 -->
          <g transform="translate(0 -100) rotate(60)">
            <rect x="-7" y="-85" width="14" height="85" fill="oklch(0.28 0.08 95)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
            <circle r="9" fill="oklch(0.82 0.15 95)"/>
            <circle r="3" fill="oklch(0.18 0.04 265)"/>
            <!-- gripper -->
            <g transform="translate(0 -85)">
              <path d="M-14 0 L-14 -14 L-6 -8 L6 -8 L14 -14 L14 0 Z" fill="oklch(0.85 0.14 85)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
              <circle cx="0" cy="-4" r="3" fill="oklch(0.18 0.04 265)"/>
            </g>
          </g>
        </g>
      </g>
      <!-- target box -->
      <g transform="translate(140 216)">
        <rect width="50" height="34" fill="oklch(0.82 0.15 95 / 0.3)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
        <circle cx="25" cy="17" r="8" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1"/>
        <circle cx="25" cy="17" r="2" fill="oklch(0.85 0.14 85)"/>
      </g>
      <!-- motion path -->
      <path d="M165 216 Q240 80 340 100" fill="none" stroke="oklch(0.85 0.14 85)" stroke-width="1" stroke-dasharray="3 4"/>
      <circle cx="340" cy="100" r="3" fill="oklch(0.85 0.14 85)"/>
      <!-- second bot silhouette -->
      <g transform="translate(480 210)">
        <rect width="30" height="20" fill="oklch(0.82 0.15 95 / 0.5)" stroke="oklch(0.82 0.15 95)" stroke-width="1"/>
        <rect x="4" y="4" width="22" height="8" fill="oklch(0.28 0.08 95)"/>
        <circle cx="9" cy="8" r="2" fill="oklch(0.95 0.08 95)"/>
        <circle cx="21" cy="8" r="2" fill="oklch(0.95 0.08 95)"/>
        <rect x="-2" y="20" width="34" height="4" fill="oklch(0.28 0.08 95)"/>
      </g>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.82 0.15 95 / 0.8)">ARM-01 · TARGET LOCKED</text>
    </svg>`,

  elec: () => `
    <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="el-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="oklch(0.72 0.17 275 / 0.15)" stroke-width="0.4"/>
        </pattern>
      </defs>
      <rect width="600" height="360" fill="oklch(0.14 0.04 265)"/>
      <rect width="600" height="360" fill="url(#el-grid)"/>
      <!-- circuit traces -->
      <g fill="none" stroke="oklch(0.72 0.17 275)" stroke-width="1.2">
        <path d="M40 180 L160 180 L160 100 L280 100"/>
        <path d="M280 100 L280 180 L400 180 L400 260 L520 260"/>
        <path d="M40 280 L120 280 L120 220 L240 220 L240 280 L360 280"/>
        <path d="M160 180 L160 260 L260 260"/>
      </g>
      <!-- pulse glow traces -->
      <g fill="none" stroke="oklch(0.92 0.08 275)" stroke-width="0.5" opacity="0.7">
        <path d="M40 180 L160 180 L160 100 L280 100"/>
      </g>
      <!-- nodes -->
      <g fill="oklch(0.72 0.17 275)">
        <circle cx="160" cy="180" r="4"/>
        <circle cx="280" cy="100" r="4"/>
        <circle cx="280" cy="180" r="4"/>
        <circle cx="400" cy="180" r="4"/>
        <circle cx="400" cy="260" r="4"/>
        <circle cx="120" cy="280" r="4"/>
        <circle cx="240" cy="220" r="4"/>
        <circle cx="240" cy="280" r="4"/>
        <circle cx="160" cy="260" r="4"/>
      </g>
      <!-- resistor -->
      <g transform="translate(200 100)">
        <rect x="-20" y="-8" width="40" height="16" fill="oklch(0.28 0.08 275)" stroke="oklch(0.72 0.17 275)" stroke-width="1"/>
        <rect x="-15" y="-4" width="3" height="8" fill="oklch(0.85 0.14 85)"/>
        <rect x="-8" y="-4" width="3" height="8" fill="oklch(0.72 0.17 275)"/>
        <rect x="-1" y="-4" width="3" height="8" fill="oklch(0.85 0.14 85)"/>
        <rect x="6" y="-4" width="3" height="8" fill="oklch(0.72 0.17 275)"/>
      </g>
      <!-- capacitor -->
      <g transform="translate(340 180)">
        <line x1="-8" y1="-12" x2="-8" y2="12" stroke="oklch(0.72 0.17 275)" stroke-width="2"/>
        <line x1="8" y1="-12" x2="8" y2="12" stroke="oklch(0.72 0.17 275)" stroke-width="2"/>
        <path d="M-20 0 L-8 0 M8 0 L20 0" stroke="oklch(0.72 0.17 275)" stroke-width="1"/>
      </g>
      <!-- chip -->
      <g transform="translate(460 260)">
        <rect x="-24" y="-20" width="48" height="40" fill="oklch(0.24 0.08 275)" stroke="oklch(0.72 0.17 275)" stroke-width="1.2"/>
        ${Array.from({length:5},(_,i)=>`<rect x="${-22+i*10}" y="-26" width="3" height="6" fill="oklch(0.72 0.17 275)"/><rect x="${-22+i*10}" y="20" width="3" height="6" fill="oklch(0.72 0.17 275)"/>`).join('')}
        <circle cx="-14" cy="-10" r="2" fill="oklch(0.85 0.14 85)"/>
      </g>
      <!-- battery -->
      <g transform="translate(80 280)">
        <rect x="-20" y="-12" width="36" height="24" fill="oklch(0.28 0.08 275)" stroke="oklch(0.72 0.17 275)" stroke-width="1"/>
        <rect x="16" y="-6" width="4" height="12" fill="oklch(0.72 0.17 275)"/>
        <text x="-2" y="4" text-anchor="middle" font-family="Space Grotesk" font-size="11" font-weight="600" fill="oklch(0.85 0.14 85)">+</text>
      </g>
      <!-- pulse dots moving along traces -->
      <circle cx="100" cy="180" r="3" fill="oklch(0.92 0.08 275)"/>
      <circle cx="260" cy="100" r="3" fill="oklch(0.85 0.14 85)"/>
      <text x="20" y="30" font-family="JetBrains Mono" font-size="10" fill="oklch(0.72 0.17 275 / 0.8)">5V · 120mA · STABLE</text>
    </svg>`,
};

window.ENVIRONMENTS = ENVIRONMENTS;
