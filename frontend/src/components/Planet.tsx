"use client";

export default function Planet({ size = 600 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="relative">
      <svg
        viewBox="0 0 600 600"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Planet main gradient */}
          <radialGradient id="planetBase" cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#7ec8e3" />
            <stop offset="40%" stopColor="#4da8d4" />
            <stop offset="100%" stopColor="#2a6f97" />
          </radialGradient>
          {/* Atmosphere glow */}
          <radialGradient id="atmosphere" cx="50%" cy="50%" r="52%">
            <stop offset="85%" stopColor="transparent" />
            <stop offset="95%" stopColor="rgba(120,180,220,0.15)" />
            <stop offset="100%" stopColor="rgba(120,180,220,0.05)" />
          </radialGradient>
          {/* Shadow on planet */}
          <radialGradient id="planetShadow" cx="65%" cy="65%" r="50%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="70%" stopColor="rgba(10,20,40,0.3)" />
            <stop offset="100%" stopColor="rgba(10,20,40,0.6)" />
          </radialGradient>
          <clipPath id="planetClip">
            <circle cx="280" cy="320" r="240" />
          </clipPath>
        </defs>

        {/* Floating rocks - behind planet */}
        <g className="floating-rocks">
          {/* Rock cluster right side */}
          <polygon
            points="510,280 530,260 545,275 535,295 515,290"
            fill="#4a5568"
            stroke="#2d3748"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 3,-5; 0,0"
              dur="6s"
              repeatCount="indefinite"
            />
          </polygon>
          <polygon
            points="530,310 550,295 560,310 548,325 530,320"
            fill="#3d4a5c"
            stroke="#2d3748"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -2,4; 0,0"
              dur="5s"
              repeatCount="indefinite"
            />
          </polygon>
          <polygon
            points="500,320 512,308 522,318 515,332 502,330"
            fill="#556677"
            stroke="#3d4a5c"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 4,2; 0,0"
              dur="7s"
              repeatCount="indefinite"
            />
          </polygon>
          <polygon
            points="540,340 555,332 562,348 550,355"
            fill="#4a5568"
            stroke="#2d3748"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -3,-3; 0,0"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </polygon>
          {/* Small rock bits */}
          <circle cx="525" cy="300" r="4" fill="#4a5568">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 2,-2; 0,0"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="550" cy="355" r="3" fill="#3d4a5c">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -1,3; 0,0"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Planet base sphere */}
        <circle
          cx="280"
          cy="320"
          r="240"
          fill="url(#planetBase)"
        />

        {/* Continents clipped to planet */}
        <g clipPath="url(#planetClip)">
          {/* Large continent - top left (like Eurasia) */}
          <path
            d="M 120,180 Q 140,150 180,155 Q 210,140 250,150 Q 280,140 300,155
               Q 310,170 320,165 Q 340,175 350,190 Q 360,210 340,230
               Q 330,250 310,240 Q 290,250 270,240 Q 250,255 230,245
               Q 210,260 190,245 Q 170,250 150,235 Q 130,220 120,200 Z"
            fill="#2d8a56"
            opacity="0.9"
          />
          {/* Snow/ice cap top */}
          <path
            d="M 140,160 Q 170,140 220,145 Q 260,135 280,145 Q 290,140 300,148
               Q 295,160 270,155 Q 240,160 210,155 Q 180,160 155,165 Z"
            fill="#e8e8e0"
            opacity="0.85"
          />
          {/* Medium continent - center right */}
          <path
            d="M 320,270 Q 350,260 380,270 Q 410,265 430,280
               Q 440,300 435,320 Q 440,340 425,355 Q 410,365 390,360
               Q 370,370 350,355 Q 335,365 320,350 Q 310,330 315,310
               Q 305,290 320,270 Z"
            fill="#3a9e65"
            opacity="0.85"
          />
          {/* Small island cluster - bottom center */}
          <path
            d="M 230,380 Q 250,370 270,378 Q 285,370 300,380
               Q 310,395 295,405 Q 280,415 260,408 Q 240,415 228,400 Z"
            fill="#2d8a56"
            opacity="0.8"
          />
          {/* Small island - left */}
          <path
            d="M 100,310 Q 120,295 145,305 Q 155,315 148,330
               Q 135,340 115,335 Q 100,325 100,310 Z"
            fill="#3a9e65"
            opacity="0.85"
          />
          {/* Light green patches (shallow/plains) */}
          <path
            d="M 160,200 Q 180,190 200,200 Q 210,215 195,225 Q 175,230 160,215 Z"
            fill="#8cc98c"
            opacity="0.6"
          />
          <path
            d="M 350,290 Q 370,285 385,295 Q 390,310 375,315 Q 360,310 350,300 Z"
            fill="#8cc98c"
            opacity="0.5"
          />
          {/* Ice/snow patches on continents */}
          <path
            d="M 330,270 Q 345,262 360,272 Q 355,282 340,280 Z"
            fill="#e8e8e0"
            opacity="0.7"
          />
          {/* Bottom ice cap */}
          <path
            d="M 180,480 Q 220,460 280,465 Q 340,458 380,470
               Q 400,490 380,510 Q 340,530 280,525 Q 220,530 190,510
               Q 170,500 180,480 Z"
            fill="#e8e8e0"
            opacity="0.8"
          />
          {/* Water highlights */}
          <ellipse
            cx="200"
            cy="350"
            rx="30"
            ry="15"
            fill="rgba(255,255,255,0.08)"
          />
          <ellipse
            cx="380"
            cy="220"
            rx="25"
            ry="12"
            fill="rgba(255,255,255,0.06)"
          />
        </g>

        {/* Atmospheric shadow overlay */}
        <circle
          cx="280"
          cy="320"
          r="240"
          fill="url(#planetShadow)"
        />

        {/* Atmosphere rim light */}
        <circle
          cx="280"
          cy="320"
          r="242"
          fill="none"
          stroke="rgba(160,210,240,0.2)"
          strokeWidth="4"
        />

        {/* Specular highlight */}
        <ellipse
          cx="200"
          cy="220"
          rx="60"
          ry="40"
          fill="rgba(255,255,255,0.08)"
          transform="rotate(-20, 200, 220)"
        />

        {/* Floating cloud wisps on planet surface */}
        <g clipPath="url(#planetClip)" opacity="0.4">
          <ellipse cx="220" cy="280" rx="50" ry="8" fill="white">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 15,0; 0,0"
              dur="20s"
              repeatCount="indefinite"
            />
          </ellipse>
          <ellipse cx="350" cy="340" rx="35" ry="6" fill="white">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -10,0; 0,0"
              dur="15s"
              repeatCount="indefinite"
            />
          </ellipse>
        </g>
      </svg>

      {/* Slow rotation feel via CSS */}
      <style jsx>{`
        .floating-rocks {
          animation: rocksDrift 8s ease-in-out infinite;
        }
        @keyframes rocksDrift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(3px, -4px); }
        }
      `}</style>
    </div>
  );
}
