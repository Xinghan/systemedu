"use client";

import { useState, useEffect } from "react";

interface AlienTeacherProps {
  message?: string;
  speaking?: boolean;
  size?: number;
  showBubble?: boolean;
}

export default function AlienTeacher({
  message,
  speaking = false,
  size = 200,
  showBubble = true,
}: AlienTeacherProps) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (!message) { setCurrentMessage(""); setCharIndex(0); return; }
    setCurrentMessage(""); setCharIndex(0);
  }, [message]);

  useEffect(() => {
    if (!message || charIndex >= message.length) return;
    const timer = setTimeout(() => {
      setCurrentMessage(message.slice(0, charIndex + 1));
      setCharIndex(charIndex + 1);
    }, 30);
    return () => clearTimeout(timer);
  }, [message, charIndex]);

  const isTalking = speaking || (message !== undefined && charIndex < (message?.length ?? 0));

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ width: size, height: size * 1.15 }} className="turtle-idle">
        <svg viewBox="0 0 300 345" width={size} height={size * 1.15} xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Turtle skin - soft olive green */}
            <radialGradient id="tSkin" cx="40%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#c8e0a8" />
              <stop offset="30%" stopColor="#a8cc88" />
              <stop offset="65%" stopColor="#88b470" />
              <stop offset="100%" stopColor="#68985a" />
            </radialGradient>
            <radialGradient id="tSkinHi" cx="35%" cy="20%" r="40%">
              <stop offset="0%" stopColor="rgba(230,255,210,0.5)" />
              <stop offset="100%" stopColor="rgba(230,255,210,0)" />
            </radialGradient>
            <radialGradient id="tSkinSh" cx="58%" cy="72%" r="45%">
              <stop offset="0%" stopColor="rgba(30,60,20,0)" />
              <stop offset="100%" stopColor="rgba(30,60,20,0.22)" />
            </radialGradient>

            {/* Shell - warm brown */}
            <radialGradient id="shellBase" cx="45%" cy="35%" r="58%">
              <stop offset="0%" stopColor="#c8a878" />
              <stop offset="35%" stopColor="#b09060" />
              <stop offset="70%" stopColor="#987848" />
              <stop offset="100%" stopColor="#806038" />
            </radialGradient>
            <radialGradient id="shellHi" cx="35%" cy="25%" r="40%">
              <stop offset="0%" stopColor="rgba(255,230,190,0.4)" />
              <stop offset="100%" stopColor="rgba(255,230,190,0)" />
            </radialGradient>
            <radialGradient id="shellRim" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#c8a878" />
              <stop offset="100%" stopColor="#6a5030" />
            </radialGradient>

            {/* Shell pattern cell */}
            <radialGradient id="shellCell" cx="45%" cy="40%" r="50%">
              <stop offset="0%" stopColor="rgba(180,150,100,0.3)" />
              <stop offset="100%" stopColor="rgba(120,90,50,0.15)" />
            </radialGradient>

            {/* Hat - safari/explorer */}
            <linearGradient id="hatBase" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f0e8c8" />
              <stop offset="40%" stopColor="#e0d4a8" />
              <stop offset="100%" stopColor="#c8bc90" />
            </linearGradient>
            <linearGradient id="hatBand" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8a6a40" />
              <stop offset="100%" stopColor="#6a4a28" />
            </linearGradient>

            {/* Eyes */}
            <radialGradient id="eyeW" cx="46%" cy="42%" r="54%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="100%" stopColor="#eae6f0" />
            </radialGradient>
            <radialGradient id="tIris" cx="42%" cy="36%" r="55%">
              <stop offset="0%" stopColor="#6a9050" />
              <stop offset="50%" stopColor="#4a7038" />
              <stop offset="100%" stopColor="#2a4a20" />
            </radialGradient>

            {/* Glasses */}
            <linearGradient id="glassF" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e0c460" />
              <stop offset="50%" stopColor="#c0a040" />
              <stop offset="100%" stopColor="#9a8030" />
            </linearGradient>

            {/* Belly - lighter */}
            <radialGradient id="belly" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#e8e0c0" />
              <stop offset="50%" stopColor="#d8d0a8" />
              <stop offset="100%" stopColor="#c0b890" />
            </radialGradient>

            {/* Filters */}
            <filter id="shd" x="-15%" y="-10%" width="130%" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="2" dy="4" />
              <feComponentTransfer><feFuncA type="linear" slope="0.15" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glo" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id="skTex" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="3" stitchTiles="stitch" result="n" />
              <feColorMatrix type="saturate" values="0" in="n" result="gn" />
              <feComponentTransfer in="gn" result="sn"><feFuncA type="linear" slope="0.03" /></feComponentTransfer>
              <feBlend in="SourceGraphic" in2="sn" mode="overlay" />
            </filter>

            <clipPath id="headC"><ellipse cx="150" cy="118" rx="80" ry="75" /></clipPath>
            <clipPath id="shellC">
              <ellipse cx="150" cy="268" rx="68" ry="52" />
            </clipPath>
          </defs>

          {/* ================================ */}
          {/* ========= SHELL (behind) ======= */}
          {/* ================================ */}
          {/* Shell dome peeks above body */}
          <ellipse cx="150" cy="240" rx="72" ry="55" fill="url(#shellBase)" filter="url(#shd)" />
          <ellipse cx="150" cy="240" rx="72" ry="55" fill="url(#shellHi)" />
          {/* Shell scute pattern */}
          <g clipPath="url(#shellC)">
            {/* Center column */}
            <ellipse cx="150" cy="228" rx="22" ry="18" fill="none" stroke="rgba(100,70,35,0.3)" strokeWidth="2" />
            <ellipse cx="150" cy="228" rx="18" ry="14" fill="url(#shellCell)" />
            <ellipse cx="150" cy="258" rx="22" ry="16" fill="none" stroke="rgba(100,70,35,0.3)" strokeWidth="2" />
            <ellipse cx="150" cy="258" rx="18" ry="12" fill="url(#shellCell)" />
            <ellipse cx="150" cy="284" rx="20" ry="14" fill="none" stroke="rgba(100,70,35,0.3)" strokeWidth="2" />
            <ellipse cx="150" cy="284" rx="16" ry="10" fill="url(#shellCell)" />
            {/* Left column */}
            <ellipse cx="112" cy="238" rx="20" ry="16" fill="none" stroke="rgba(100,70,35,0.25)" strokeWidth="1.8" />
            <ellipse cx="112" cy="238" rx="16" ry="12" fill="url(#shellCell)" />
            <ellipse cx="108" cy="268" rx="18" ry="14" fill="none" stroke="rgba(100,70,35,0.25)" strokeWidth="1.8" />
            <ellipse cx="108" cy="268" rx="14" ry="10" fill="url(#shellCell)" />
            {/* Right column */}
            <ellipse cx="188" cy="238" rx="20" ry="16" fill="none" stroke="rgba(100,70,35,0.25)" strokeWidth="1.8" />
            <ellipse cx="188" cy="238" rx="16" ry="12" fill="url(#shellCell)" />
            <ellipse cx="192" cy="268" rx="18" ry="14" fill="none" stroke="rgba(100,70,35,0.25)" strokeWidth="1.8" />
            <ellipse cx="192" cy="268" rx="14" ry="10" fill="url(#shellCell)" />
          </g>
          {/* Shell rim */}
          <ellipse cx="150" cy="240" rx="72" ry="55" fill="none" stroke="url(#shellRim)" strokeWidth="3" />
          <ellipse cx="150" cy="240" rx="72" ry="55" fill="none" stroke="rgba(255,230,180,0.12)" strokeWidth="1" />

          {/* ================================ */}
          {/* ======= HEAD =================== */}
          {/* ================================ */}
          <g filter="url(#skTex)">
            <ellipse cx="150" cy="118" rx="80" ry="75" fill="url(#tSkin)" filter="url(#shd)" />
          </g>
          <ellipse cx="150" cy="118" rx="80" ry="75" fill="url(#tSkinHi)" />
          <ellipse cx="150" cy="118" rx="80" ry="75" fill="url(#tSkinSh)" />
          <ellipse cx="150" cy="118" rx="80" ry="75" fill="none" stroke="rgba(60,90,40,0.12)" strokeWidth="1.5" />

          {/* Subtle wrinkle lines around eyes (turtle-like) */}
          <g clipPath="url(#headC)" opacity="0.08">
            <path d="M 78 110 Q 85 105 95 108" stroke="#4a6a30" strokeWidth="1.2" fill="none" />
            <path d="M 80 118 Q 88 114 96 116" stroke="#4a6a30" strokeWidth="1" fill="none" />
            <path d="M 205 108 Q 215 105 222 110" stroke="#4a6a30" strokeWidth="1.2" fill="none" />
            <path d="M 204 116 Q 212 114 220 118" stroke="#4a6a30" strokeWidth="1" fill="none" />
          </g>

          {/* Cheek scales (cute turtle detail) */}
          <g opacity="0.12">
            <circle cx="88" cy="135" r="3" fill="#5a8a40" />
            <circle cx="96" cy="140" r="2.5" fill="#5a8a40" />
            <circle cx="84" cy="142" r="2" fill="#5a8a40" />
            <circle cx="212" cy="135" r="3" fill="#5a8a40" />
            <circle cx="204" cy="140" r="2.5" fill="#5a8a40" />
            <circle cx="216" cy="142" r="2" fill="#5a8a40" />
          </g>

          {/* ================================ */}
          {/* ====== GLASSES ================= */}
          {/* ================================ */}
          <path d="M 127 112 Q 150 120 173 112" stroke="url(#glassF)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {/* Left lens */}
          <circle cx="112" cy="112" r="30" fill="none" stroke="url(#glassF)" strokeWidth="4.5" />
          <circle cx="112" cy="112" r="30" fill="rgba(200,220,240,0.04)" />
          <circle cx="112" cy="112" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <path d="M 90 98 Q 96 94 104 93" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          {/* Right lens */}
          <circle cx="188" cy="112" r="30" fill="none" stroke="url(#glassF)" strokeWidth="4.5" />
          <circle cx="188" cy="112" r="30" fill="rgba(200,220,240,0.04)" />
          <circle cx="188" cy="112" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <path d="M 176 93 Q 184 94 192 98" stroke="rgba(255,255,255,0.15)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          {/* Temple arms */}
          <path d="M 82 106 L 72 108" stroke="url(#glassF)" strokeWidth="3" strokeLinecap="round" />
          <path d="M 218 106 L 228 108" stroke="url(#glassF)" strokeWidth="3" strokeLinecap="round" />

          {/* ================================ */}
          {/* ========= EYES ================= */}
          {/* ================================ */}
          <g>
            {/* LEFT EYE */}
            <ellipse cx="112" cy="115" rx="22" ry="24" fill="url(#eyeW)" />
            <circle cx="112" cy="118" r="15" fill="url(#tIris)" />
            <circle cx="112" cy="118" r="11" fill="none" stroke="rgba(80,120,50,0.15)" strokeWidth="0.5" />
            <circle cx="112" cy="118" r="8" fill="#1a2a12" />
            <circle cx="112" cy="118" r="6" fill="#0a1a08" />
            {/* Big catchlight */}
            <ellipse cx="105" cy="108" rx="7" ry="6" fill="white" opacity="0.9" />
            {/* Small catchlight */}
            <circle cx="119" cy="124" r="4" fill="white" opacity="0.5" />
            {/* Sparkle */}
            <circle cx="108" cy="113" r="1.2" fill="white" opacity="0.6" />
            <g opacity="0.25">
              <line x1="103" y1="109" x2="107" y2="109" stroke="white" strokeWidth="0.7" />
              <line x1="105" y1="107" x2="105" y2="111" stroke="white" strokeWidth="0.7" />
            </g>

            {/* RIGHT EYE */}
            <ellipse cx="188" cy="115" rx="22" ry="24" fill="url(#eyeW)" />
            <circle cx="188" cy="118" r="15" fill="url(#tIris)" />
            <circle cx="188" cy="118" r="11" fill="none" stroke="rgba(80,120,50,0.15)" strokeWidth="0.5" />
            <circle cx="188" cy="118" r="8" fill="#1a2a12" />
            <circle cx="188" cy="118" r="6" fill="#0a1a08" />
            <ellipse cx="181" cy="108" rx="7" ry="6" fill="white" opacity="0.9" />
            <circle cx="195" cy="124" r="4" fill="white" opacity="0.5" />
            <circle cx="184" cy="113" r="1.2" fill="white" opacity="0.6" />
            <g opacity="0.25">
              <line x1="179" y1="109" x2="183" y2="109" stroke="white" strokeWidth="0.7" />
              <line x1="181" y1="107" x2="181" y2="111" stroke="white" strokeWidth="0.7" />
            </g>

            {/* Blink */}
            <ellipse cx="112" cy="115" rx="23" ry="25" fill="url(#tSkin)">
              <animate attributeName="ry" values="0;0;0;0;0;0;0;25;0;0;0;0;0" dur="4.5s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="188" cy="115" rx="23" ry="25" fill="url(#tSkin)">
              <animate attributeName="ry" values="0;0;0;0;0;0;0;25;0;0;0;0;0" dur="4.5s" repeatCount="indefinite" />
            </ellipse>
          </g>

          {/* Blush */}
          <circle cx="82" cy="138" r="12" fill="#e0a088" opacity="0.18" filter="url(#glo)" />
          <circle cx="218" cy="138" r="12" fill="#e0a088" opacity="0.18" filter="url(#glo)" />

          {/* ================================ */}
          {/* ====== NOSE (turtle beak) ====== */}
          {/* ================================ */}
          <ellipse cx="150" cy="142" rx="6" ry="4" fill="rgba(80,110,55,0.15)" />
          <circle cx="146" cy="142" r="2" fill="rgba(60,80,40,0.2)" />
          <circle cx="154" cy="142" r="2" fill="rgba(60,80,40,0.2)" />

          {/* ================================ */}
          {/* ======== MOUTH ================= */}
          {/* ================================ */}
          {isTalking ? (
            <g>
              <ellipse cx="150" cy="158" rx="10" ry="8" fill="#2a3a20" />
              <ellipse cx="150" cy="161" rx="5" ry="3" fill="#6a9a58" opacity="0.5" />
              <ellipse cx="150" cy="158" rx="10" ry="8" fill="none" stroke="#3a5a28" strokeWidth="1.5" />
              <animateTransform attributeName="transform" type="scale"
                values="1 1;1 0.85;1 1.15;1 0.9;1 1"
                dur="0.45s" repeatCount="indefinite" additive="sum" />
            </g>
          ) : (
            <g>
              {/* Wide happy turtle smile */}
              <path d="M 128 154 Q 138 168 150 170 Q 162 168 172 154"
                stroke="#3a5a28" strokeWidth="2.8" fill="none" strokeLinecap="round" />
              <path d="M 132 155 Q 140 165 150 166 Q 160 165 168 155"
                stroke="rgba(80,130,60,0.15)" strokeWidth="1" fill="none" strokeLinecap="round" />
              {/* Dimples */}
              <circle cx="126" cy="154" r="1.8" fill="rgba(60,90,40,0.12)" />
              <circle cx="174" cy="154" r="1.8" fill="rgba(60,90,40,0.12)" />
            </g>
          )}

          {/* ================================ */}
          {/* ========= HAT ================== */}
          {/* ================================ */}
          {/* Hat brim - wide floppy safari hat */}
          <ellipse cx="150" cy="62" rx="100" ry="16" fill="url(#hatBase)" filter="url(#shd)" />
          <ellipse cx="150" cy="62" rx="100" ry="16" fill="none" stroke="rgba(160,140,100,0.2)" strokeWidth="1.5" />
          {/* Brim top highlight */}
          <ellipse cx="140" cy="58" rx="50" ry="6" fill="rgba(255,250,230,0.2)" />

          {/* Hat dome */}
          <path d="M 100 64 Q 100 20 150 16 Q 200 20 200 64 Z" fill="url(#hatBase)" />
          <path d="M 100 64 Q 100 20 150 16 Q 200 20 200 64 Z" fill="none" stroke="rgba(160,140,100,0.15)" strokeWidth="1" />
          {/* Hat highlight */}
          <path d="M 120 40 Q 140 22 160 28" stroke="rgba(255,250,230,0.25)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 125 48 Q 142 35 158 38" stroke="rgba(255,250,230,0.12)" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Hat dome shadow */}
          <path d="M 110 58 Q 150 52 190 58" fill="rgba(160,130,80,0.1)" />

          {/* Hat band */}
          <path d="M 100 60 Q 150 52 200 60 Q 200 68 150 62 Q 100 68 100 60 Z" fill="url(#hatBand)" />
          <path d="M 102 61 Q 150 54 198 61" stroke="rgba(255,220,150,0.15)" strokeWidth="1" fill="none" />
          {/* Band stitching */}
          <g opacity="0.2">
            <line x1="110" y1="62" x2="112" y2="60" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="120" y1="60" x2="122" y2="58" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="130" y1="58" x2="132" y2="56" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="140" y1="57" x2="142" y2="55" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="150" y1="56" x2="152" y2="54" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="160" y1="57" x2="162" y2="55" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="170" y1="58" x2="172" y2="56" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="180" y1="60" x2="182" y2="58" stroke="#4a3a20" strokeWidth="0.8" />
            <line x1="190" y1="62" x2="192" y2="60" stroke="#4a3a20" strokeWidth="0.8" />
          </g>

          {/* ================================ */}
          {/* ====== BODY (belly) ============ */}
          {/* ================================ */}
          {/* Belly - lighter, round, in front of shell */}
          <ellipse cx="150" cy="262" rx="45" ry="40" fill="url(#belly)" />
          <ellipse cx="150" cy="262" rx="45" ry="40" fill="none" stroke="rgba(160,140,100,0.12)" strokeWidth="1" />
          {/* Belly segment lines (turtle pattern) */}
          <path d="M 150 224 L 150 300" stroke="rgba(160,140,100,0.08)" strokeWidth="1" />
          <path d="M 118 240 Q 150 248 182 240" stroke="rgba(160,140,100,0.08)" strokeWidth="1" fill="none" />
          <path d="M 112 262 Q 150 270 188 262" stroke="rgba(160,140,100,0.08)" strokeWidth="1" fill="none" />
          <path d="M 118 282 Q 150 290 182 282" stroke="rgba(160,140,100,0.08)" strokeWidth="1" fill="none" />
          {/* Belly highlight */}
          <ellipse cx="142" cy="248" rx="18" ry="12" fill="rgba(255,250,230,0.12)" transform="rotate(-8,142,248)" />

          {/* ================================ */}
          {/* ======= ARMS =================== */}
          {/* ================================ */}
          {/* Left arm - waving (stubby green flipper) */}
          <g className="turtle-wave-arm">
            <path d="M 106 248 Q 78 235 58 210"
              stroke="url(#tSkin)" strokeWidth="24" fill="none" strokeLinecap="round" />
            <path d="M 106 248 Q 78 235 58 210"
              stroke="url(#tSkinHi)" strokeWidth="24" fill="none" strokeLinecap="round" />
            {/* Flipper rounded tip */}
            <circle cx="56" cy="206" r="14" fill="#88b470" />
            <circle cx="56" cy="206" r="14" fill="url(#tSkinHi)" />
            {/* Tiny claw nubs */}
            <circle cx="47" cy="196" r="4" fill="#7aa462" />
            <circle cx="47" cy="196" r="2" fill="rgba(200,240,180,0.2)" />
            <circle cx="55" cy="192" r="4" fill="#7aa462" />
            <circle cx="55" cy="192" r="2" fill="rgba(200,240,180,0.2)" />
            <circle cx="64" cy="194" r="4" fill="#7aa462" />
            <circle cx="64" cy="194" r="2" fill="rgba(200,240,180,0.2)" />
          </g>

          {/* Right arm - resting */}
          <path d="M 194 248 Q 222 258 240 278"
            stroke="url(#tSkin)" strokeWidth="24" fill="none" strokeLinecap="round" />
          <path d="M 194 248 Q 222 258 240 278"
            stroke="url(#tSkinHi)" strokeWidth="24" fill="none" strokeLinecap="round" />
          <circle cx="244" cy="282" r="14" fill="#88b470" />
          <circle cx="244" cy="282" r="14" fill="url(#tSkinHi)" />
          <circle cx="252" cy="274" r="4" fill="#7aa462" />
          <circle cx="252" cy="274" r="2" fill="rgba(200,240,180,0.2)" />
          <circle cx="248" cy="270" r="4" fill="#7aa462" />
          <circle cx="248" cy="270" r="2" fill="rgba(200,240,180,0.2)" />
          <circle cx="240" cy="272" r="4" fill="#7aa462" />
          <circle cx="240" cy="272" r="2" fill="rgba(200,240,180,0.2)" />

          {/* ================================ */}
          {/* ====== TAIL ==================== */}
          {/* ================================ */}
          <path d="M 150 295 Q 155 308 148 318 Q 144 322 140 318"
            stroke="url(#tSkin)" strokeWidth="8" fill="none" strokeLinecap="round" />

          {/* ================================ */}
          {/* ====== FEET ==================== */}
          {/* ================================ */}
          {/* Left foot */}
          <ellipse cx="122" cy="310" rx="24" ry="12" fill="#7aa462" filter="url(#shd)" />
          <ellipse cx="122" cy="308" rx="22" ry="10" fill="#88b470" />
          <ellipse cx="118" cy="306" rx="12" ry="5" fill="rgba(200,240,180,0.1)" />
          {/* Toe nubs */}
          <circle cx="104" cy="308" r="4" fill="#7aa462" />
          <circle cx="112" cy="304" r="3.5" fill="#7aa462" />
          <circle cx="120" cy="302" r="3" fill="#7aa462" />

          {/* Right foot */}
          <ellipse cx="178" cy="310" rx="24" ry="12" fill="#7aa462" filter="url(#shd)" />
          <ellipse cx="178" cy="308" rx="22" ry="10" fill="#88b470" />
          <ellipse cx="174" cy="306" rx="12" ry="5" fill="rgba(200,240,180,0.1)" />
          <circle cx="196" cy="308" r="4" fill="#7aa462" />
          <circle cx="188" cy="304" r="3.5" fill="#7aa462" />
          <circle cx="180" cy="302" r="3" fill="#7aa462" />
        </svg>
      </div>

      {/* Speech bubble */}
      {showBubble && currentMessage && (
        <div className="speech-bubble relative max-w-md mx-auto bg-gradient-to-br from-[#2a2540]/90 to-[#1e2a3a]/90 border border-[#8b6baf]/30 rounded-2xl px-6 py-4 backdrop-blur-sm">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#2a2540]/90 border-l border-t border-[#8b6baf]/30 rotate-45" />
          <p className="text-[#e0d8f0] text-lg leading-relaxed relative z-10">
            {currentMessage}
            {charIndex < (message?.length ?? 0) && (
              <span className="inline-block w-2 h-5 bg-[#c9a0e0] ml-1 animate-pulse" />
            )}
          </p>
        </div>
      )}

      <style jsx>{`
        .turtle-idle {
          animation: turtleIdle 3.5s ease-in-out infinite;
        }
        .turtle-wave-arm {
          transform-origin: 106px 248px;
          animation: flipperWave 2s ease-in-out infinite;
        }
        @keyframes turtleIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes flipperWave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-14deg); }
          55% { transform: rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
