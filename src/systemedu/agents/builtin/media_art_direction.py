"""Shared art direction helpers for animation/game/story generation."""

from __future__ import annotations

import re

# KaTeX auto-render injection snippet (CDN, MIT licensed)
_KATEX_INJECT = """<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}]})"></script>"""

# Markers that indicate LaTeX content in generated HTML
_LATEX_MARKERS = (r"\(", r"\[", "$$", r"\begin{", r"\frac", r"\int", r"\sum", r"\sqrt")


def inject_katex_if_needed(html: str) -> str:
    """Inject KaTeX CDN into HTML if LaTeX syntax is detected.

    Checks for common LaTeX markers. If found and KaTeX is not already
    present, inserts the CDN scripts before </head>.
    """
    if "katex" in html.lower():
        return html  # already has KaTeX
    if not any(m in html for m in _LATEX_MARKERS):
        return html  # no LaTeX detected
    if "</head>" in html:
        return html.replace("</head>", f"{_KATEX_INJECT}\n</head>", 1)
    # No </head> tag — prepend to document
    return f"<head>{_KATEX_INJECT}\n</head>\n" + html


# Prompt hint telling LLM it can use KaTeX syntax
KATEX_PROMPT_HINT = """数学公式渲染：页面已自动加载 KaTeX，可直接在 HTML 文本节点中使用 LaTeX 语法：
- 行内公式：\\(E = mc^2\\)
- 块级公式：$$\\int_0^\\infty e^{-x}\\,dx = 1$$
- 支持：分数 \\frac{{a}}{{b}}、根号 \\sqrt{{x}}、求和 \\sum_{{i=1}}^n、积分 \\int、希腊字母 \\alpha \\beta \\theta 等
- 公式写在普通 <div> 或 <p> 标签内即可，KaTeX 会自动渲染
- 禁止用 SVG <text> 元素手写公式，应全部改用 KaTeX 语法"""


STYLE_KITS: dict[str, dict] = {
    # -- 1. Aether Clinic: 医疗诊断 HUD --
    # 基于 animation_game_design/aether_clinic + medicine_neural_sync_hud
    "aether_clinic": {
        "background_family": "dark-hud",
        "description": "医疗诊断 HUD -- 适合医学、神经科学、人体解剖、生理学、健康科学",
        "palette": {
            "bg": "#111318",
            "surface": "rgba(26,28,32,0.92)",
            "surface_high": "#282a2e",
            "primary": "#98cbff",
            "primary_container": "#00a3ff",
            "secondary": "#b9f1ff",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#e2e2e2",
            "muted": "#6b6d72",
            "outline_variant": "rgba(107,109,114,0.15)",
        },
        "radius": {"sm": 0, "md": 0, "lg": 0},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 32px rgba(152,203,255,0.08)",
            "focus": "0 0 20px rgba(0,163,255,0.15)",
        },
        "font_pairing": "Space Grotesk + Inter",
        "glassmorphism": "backdrop-filter: blur(12px); background: rgba(26,28,32,0.4)",
        "gradient_cta": "linear-gradient(135deg, #98cbff, #00a3ff)",
        "special_effects": [
            "Diagnostic Glow: primary (#98cbff) at 8% opacity with 32px blur",
            "Pulse-monitoring animation: opacity 0.6 to 1.0 on critical states",
            "Holographic panel: rgba(51,53,57,0.4) + backdrop-blur(12px)",
            "Scanner line: 2px linear-gradient(90deg, transparent, #00A3FF, transparent)",
            "Grid pattern: radial-gradient(#98cbff 0.5px, transparent 0.5px), size 24px",
            "Ghost Border: outline_variant at 15% opacity (no traditional borders)",
        ],
        "css_rules": [
            "border-radius: 0px (sharp 90-degree angles, no rounded corners)",
            "No traditional drop shadows, only ambient glow",
            "Label-SM: 0.6875rem for metadata, ALL CAPS optional",
            "Display-LG: 3.5rem for critical metrics",
        ],
    },
    # -- 2. Ares Mission Control: 火星任务控制 --
    # 基于 animation_game_design/ares_mission_control + mars_rover_mission_control
    "ares_mission": {
        "background_family": "dark-brutalist",
        "description": "火星任务控制 -- 适合航天、火箭、天文、物理、行星科学、地质",
        "palette": {
            "bg": "#131313",
            "surface": "rgba(28,27,27,0.92)",
            "surface_high": "#353534",
            "primary": "#ffb59c",
            "primary_container": "#ff7f50",
            "secondary": "#c6c6c6",
            "tertiary": "#00daf3",
            "signal": "#ff5f1f",
            "success": "#10b981",
            "text": "#e5e2e1",
            "muted": "#8a8886",
            "outline_variant": "rgba(138,136,134,0.15)",
        },
        "radius": {"sm": 0, "md": 0, "lg": 0},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 16px rgba(229,226,225,0.08)",
            "focus": "0 0 30px rgba(255,127,80,0.4)",
        },
        "font_pairing": "Space Grotesk + Inter",
        "glassmorphism": "backdrop-filter: blur(12px); background: rgba(53,53,52,0.4)",
        "gradient_cta": "linear-gradient(45deg, #ffb59c, #ff7f50)",
        "special_effects": [
            "Kinetic Brutalism: hard industrial edges, 0px radius globally",
            "Wireframe grid: linear-gradient with rgba(0,218,243,0.1), size 20px",
            "Martian Crust: radial-gradient(circle at center, #1c1b1b, #131313)",
            "Scanline overlay: rgba(255,127,80,0.1) repeating horizontal lines",
            "LIDAR cyan overlays: #00daf3 for data visualization elements",
            "Label-SM: ALL CAPS for telemetry labels (LATITUDE, BATTERY)",
            "Ghost Border: outline_variant at 15% opacity",
        ],
        "css_rules": [
            "border-radius: 0px (sharp industrial 90-degree angles)",
            "No traditional drop shadows, only ambient tint",
            "Spacing-8 or spacing-10 for mission-critical layouts",
            "Display-LG for mission clocks and critical data",
        ],
    },
    # -- 3. Celestial Observatory: 星空天文台 --
    # 基于 animation_game_design/celestial_observatory + astronomy_cosmos_lens
    "celestial_observatory": {
        "background_family": "dark-cosmic",
        "description": "星空天文台 -- 适合天文、宇宙、恒星、黑洞、引力、光学",
        "palette": {
            "bg": "#111220",
            "surface": "rgba(30,30,45,0.92)",
            "surface_high": "#1e1e2d",
            "primary": "#c9bfff",
            "primary_container": "#1e006e",
            "secondary": "#fff9ef",
            "secondary_container": "#ffdb3c",
            "tertiary": "#85ecff",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#e8e4f0",
            "muted": "#7a7590",
            "outline_variant": "rgba(122,117,144,0.15)",
        },
        "radius": {"sm": 4, "md": 12, "lg": 24},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 40px rgba(30,0,110,0.2)",
            "focus": "0 0 60px rgba(201,191,255,0.25)",
        },
        "font_pairing": "Space Grotesk + Manrope",
        "glassmorphism": "backdrop-filter: blur(20px); background: rgba(30,30,45,0.4)",
        "gradient_cta": "linear-gradient(135deg, #c9bfff, #8771ff)",
        "special_effects": [
            "Nebular Glass: surface_variant at 40% opacity + backdrop-blur(20px)",
            "Noise texture: feTurbulence SVG filter, fractalNoise, opacity 0.02-0.03",
            "Ambient Shadow: primary_container (#1e006e) at 20% opacity, 40px blur",
            "Radial gradients: primary_container at 10-15% opacity for soft boundaries",
            "Scale hover: 1.02x with fade transitions 95% to 100%",
            "Letter-spacing: 0.05em for expansive cosmic feel",
            "Gravitational lens: radial-gradient(circle, transparent 30%, primary 0.05, transparent 70%)",
            "Buttons: pill-shaped (rounded-full), Cards: xl radius (1.5rem)",
        ],
        "css_rules": [
            "Buttons use full/pill radius, cards use xl (1.5rem) radius",
            "No traditional drop shadows, only glow from primary_container",
            "Display-LG: 3.5rem, Headline-LG: 2rem",
            "Generous negative space (spacing-16/20)",
        ],
    },
    # -- 4. Helix Lab: 生物发光实验室 --
    # 基于 animation_game_design/helix_lab_hud + genetic_mapping_dna_sequence
    "helix_lab": {
        "background_family": "dark-bioluminescent",
        "description": "生物发光实验室 -- 适合基因、DNA、细胞、微生物、生物化学、遗传学",
        "palette": {
            "bg": "#0c0e12",
            "surface": "rgba(17,19,24,0.92)",
            "surface_high": "#1a1d22",
            "primary": "#50ffb0",
            "primary_container": "#17df93",
            "secondary": "#acf900",
            "tertiary": "#85ecff",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#f6f6fc",
            "muted": "#aaabb0",
            "outline_variant": "rgba(70,72,77,0.15)",
        },
        "radius": {"sm": 16, "md": 24, "lg": 9999},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 40px rgba(80,255,176,0.08)",
            "focus": "0 0 60px rgba(80,255,176,0.15)",
        },
        "font_pairing": "Space Grotesk",
        "glassmorphism": "backdrop-filter: blur(20px); background: rgba(23,26,31,0.6)",
        "gradient_cta": "linear-gradient(135deg, #50ffb0, #17df93)",
        "special_effects": [
            "Emerald Ambient Shadow: primary at 8% opacity, 40-60px blur",
            "Bioluminescent pulse: opacity 1.0 to 0.6 on live monitoring chips",
            "DNA helix gradient: linear-gradient from #50ffb0 to #acf900",
            "Glass panel: backdrop-blur(20px), border 1px solid rgba(70,72,77,0.15)",
            "Sequence probe: thin primary line (0.5px) connecting data points",
            "Drop shadow glow: 0 0 15px rgba(80,255,176,0.3)",
            "Tight letter-spacing: -0.02em for dense data blocks",
            "Primary buttons: rounded-full (pill shape)",
        ],
        "css_rules": [
            "Primary buttons: rounded-full, secondary: ghost style",
            "No borders on components, use ghost borders as fallback",
            "Label-SM: ALL CAPS with +0.1em letter-spacing for telemetry",
            "Spacing-8: 1.75rem between data clusters",
        ],
    },
    # -- 5. Neural Circuit: 电路神经网络 --
    # 基于 animation_game_design/neural_circuit + computer_science + bio_tech
    "neural_circuit": {
        "background_family": "dark-circuit",
        "description": "电路神经网络 -- 适合计算机科学、AI、机器人、电路、编程、数据结构",
        "palette": {
            "bg": "#121318",
            "surface": "rgba(26,27,33,0.92)",
            "surface_high": "#34343a",
            "primary": "#dbfcff",
            "primary_container": "#00F0FF",
            "secondary": "#2ff801",
            "secondary_dim": "#2ae500",
            "tertiary": "#ebb2ff",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#e8e8ec",
            "muted": "#8a8a90",
            "outline_variant": "rgba(138,138,144,0.15)",
        },
        "radius": {"sm": 0, "md": 0, "lg": 0},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 15px rgba(0,240,255,0.08)",
            "focus": "0 0 30px rgba(0,219,233,0.15)",
        },
        "font_pairing": "Space Grotesk + Manrope",
        "glassmorphism": "backdrop-filter: blur(12px); background: rgba(26,27,33,0.4)",
        "gradient_cta": "linear-gradient(45deg, #dbfcff, #006970)",
        "special_effects": [
            "Circuit Header: 2px top-border in primary, extending only 20% of card width",
            "Circuit grid: radial-gradient(#00F0FF 0.05px, transparent), size 24px, opacity 0.05",
            "Scanning overlay: linear-gradient primary to #006970 at 45deg, 15% opacity",
            "Ultra-thin circuit lines: 1px using secondary or tertiary colors",
            "Neon phosphor accents: high-contrast primary against dark background",
            "Scanline effect: rgba(0,240,255,0.1) repeating 2px horizontal lines",
            "SVG glow filter: feGaussianBlur stdDeviation 2.5 with feMerge",
            "Ghost Border: outline_variant at 15% (circuit trace feel)",
        ],
        "css_rules": [
            "border-radius: 0px (absolute rule, hard edges only)",
            "No rounded corners permitted anywhere",
            "Label-MD/SM: ALL CAPS with 0.1rem letter-spacing",
            "Display-LG: 3.5rem for heroic data points",
        ],
    },
    # -- 6. Subatomic Matrix: 亚原子量子场 --
    # 基于 animation_game_design/subatomic_matrix + quantum_matrix_field
    "subatomic_matrix": {
        "background_family": "dark-quantum",
        "description": "亚原子量子场 -- 适合量子物理、粒子物理、原子结构、波动力学、化学键",
        "palette": {
            "bg": "#0c0e17",
            "surface": "rgba(23,25,36,0.92)",
            "surface_high": "#282b3a",
            "primary": "#ff7cf5",
            "primary_container": "#ff5af9",
            "secondary": "#00fbfb",
            "secondary_container": "#006a6a",
            "tertiary": "#ac89ff",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#e8e8f0",
            "muted": "#aaaab7",
            "outline_variant": "rgba(70,71,82,0.2)",
        },
        "radius": {"sm": 0, "md": 0, "lg": 0},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 40px rgba(0,251,251,0.05)",
            "focus": "0 0 60px rgba(255,124,245,0.12)",
        },
        "font_pairing": "Space Grotesk",
        "glassmorphism": "backdrop-filter: blur(12px); background: rgba(34,37,50,0.6)",
        "gradient_cta": "linear-gradient(135deg, #ff7cf5, #ff5af9)",
        "special_effects": [
            "Quantum Glow: secondary (#00fbfb) at 5% opacity, 40px+ blur",
            "Quantum field: radial-gradient circles with magenta(0.03) and cyan(0.05)",
            "Wavefunction: SVG opacity 0.15, filter blur(1px)",
            "Particle drift animation: custom duration, opacity 0.3 to 0.8",
            "Pulse wave: stroke-dasharray 50 150, 10s linear infinite",
            "Glitch hover: background shifts to primary on chips",
            "Faint shifting 10% opacity grid overlay (Matrix feel)",
            "Ghost Border: outline_variant at 20% opacity (blueprint grid feel)",
        ],
        "css_rules": [
            "border-radius: 0px (sharp technical geometry)",
            "No rounded corners ever",
            "Display-LG: 3.5rem with 0.1em letter-spacing",
            "Label-SM: ALL CAPS for scientific metadata",
        ],
    },
    # -- 7. Rocketry Control: 工业火箭控制台 --
    # 基于 animation_game_design/rocketry_mission_control_v2
    "rocketry_control": {
        "background_family": "dark-industrial",
        "description": "工业火箭控制台 -- 适合火箭工程、推进系统、轨道力学、工程力学",
        "palette": {
            "bg": "#05070A",
            "surface": "rgba(13,17,31,0.92)",
            "surface_high": "#0B1026",
            "primary": "#FFB000",
            "primary_container": "#FF5F1F",
            "secondary": "#FFB08E",
            "signal": "#FF5F1F",
            "success": "#10b981",
            "text": "#e0dfe6",
            "muted": "#8e90a6",
            "outline_variant": "rgba(142,144,166,0.2)",
        },
        "radius": {"sm": 4, "md": 8, "lg": 12},
        "stroke_width": {"base": 1, "focus": 2},
        "shadow": {
            "soft": "0 0 15px rgba(255,176,0,0.15)",
            "focus": "inset 0 0 15px rgba(0,0,0,0.5)",
        },
        "font_pairing": "Space Grotesk + Manrope",
        "glassmorphism": "backdrop-filter: blur(12px); background: rgba(13,17,31,0.6)",
        "gradient_cta": "linear-gradient(135deg, #FFB000, #FF5F1F)",
        "special_effects": [
            "Industrial bezel: border 1px solid rgba(142,144,166,0.2), border-top 3px solid #FFB000",
            "Radar sweep: conic-gradient animation 4s linear infinite",
            "Scanning overlay: repeating-linear-gradient rgba(255,176,0,0.03) 1px",
            "Amber glow: box-shadow 0 0 15px rgba(255,176,0,0.15)",
            "Grid pattern: radial-gradient(#FFB000 0.1 1px, transparent), size 20px",
            "Radar SVG: circles with stroke #FFB000, dashed orbital paths",
            "Body gradient: radial-gradient + scanlines + RGB noise layers",
        ],
        "css_rules": [
            "border-radius: 4-12px (slightly softened industrial)",
            "Industrial bezel: border-top 3px accent, radius 8px 8px 2px 2px",
            "Radar/gauge aesthetic for data visualization",
            "Deep dark base (#05070A) with amber instrumentation",
        ],
    },
    # -- 8. Aqua Flow: 水流海洋 --
    # 基于 animation_game_design/aqua_flow 概念 + ocean_deep 设计语言
    "aqua_flow": {
        "background_family": "dark-ocean",
        "description": "水流海洋 -- 适合海洋科学、水文、流体力学、化学溶液、环境科学",
        "palette": {
            "bg": "#040d1a",
            "surface": "rgba(8,22,42,0.92)",
            "surface_high": "#0f1d30",
            "primary": "#06b6d4",
            "primary_container": "#0891b2",
            "secondary": "#22d3ee",
            "tertiary": "#34d399",
            "signal": "#f59e0b",
            "success": "#34d399",
            "text": "#c8dce8",
            "muted": "#4a6a80",
            "outline_variant": "rgba(74,106,128,0.15)",
        },
        "radius": {"sm": 8, "md": 14, "lg": 22},
        "stroke_width": {"base": 1.5, "focus": 2.5},
        "shadow": {
            "soft": "0 0 30px rgba(6,182,212,0.12)",
            "focus": "0 0 40px rgba(6,182,212,0.25)",
        },
        "font_pairing": "Space Grotesk + Inter",
        "glassmorphism": "backdrop-filter: blur(16px); background: rgba(8,22,42,0.5)",
        "gradient_cta": "linear-gradient(135deg, #06b6d4, #22d3ee)",
        "special_effects": [
            "Water caustic: animated radial-gradient light patterns",
            "Bubble particles: floating upward, blue-cyan, varying sizes",
            "Depth gradient: darker at bottom, lighter at top",
            "Glass-morphism cards with blue tint and subtle borders",
            "Wave animation: gentle sine-wave motion on surface elements",
            "Bioluminescent dots: small glowing particles, opacity pulse",
        ],
        "css_rules": [
            "Rounded corners (8-22px) for organic feel",
            "Depth-pressure color gradient on background",
            "Gentle, flowing animations (no sharp movements)",
            "Blue-cyan dominant palette with warm accent signals",
        ],
    },
    # -- 9. Ember Forge: 熔炉火焰 --
    # 基于 animation_game_design/ember_forge 概念 + geo_stratum/terra_nova 设计语言
    "ember_forge": {
        "background_family": "dark-volcanic",
        "description": "熔炉火焰 -- 适合地质学、火山、地球内部结构、冶金、热力学、化学反应",
        "palette": {
            "bg": "#0a0604",
            "surface": "rgba(18,12,8,0.92)",
            "surface_high": "#1a1210",
            "primary": "#ff6b35",
            "primary_container": "#cc4400",
            "secondary": "#fbbf24",
            "tertiary": "#ef4444",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#e8d8c8",
            "muted": "#8a7060",
            "outline_variant": "rgba(138,112,96,0.15)",
        },
        "radius": {"sm": 4, "md": 8, "lg": 16},
        "stroke_width": {"base": 1.5, "focus": 2.5},
        "shadow": {
            "soft": "0 0 30px rgba(255,107,53,0.12)",
            "focus": "0 0 50px rgba(255,107,53,0.25)",
        },
        "font_pairing": "Space Grotesk + Inter",
        "glassmorphism": "backdrop-filter: blur(12px); background: rgba(18,12,8,0.5)",
        "gradient_cta": "linear-gradient(135deg, #ff6b35, #cc4400)",
        "special_effects": [
            "Magma glow: radial-gradient from #ff6b35 core to transparent",
            "Ember particles: floating upward, orange-red, with blur trail",
            "Heat distortion: subtle CSS transform skew animation",
            "Stratum layers: horizontal gradient bands for geological layers",
            "Warm ambient: primary at 8% opacity, 30px blur background glow",
            "Crack patterns: thin lines (#fbbf24 at 10% opacity) on surfaces",
        ],
        "css_rules": [
            "Slightly rounded corners (4-16px) for geological feel",
            "Warm color temperature throughout (no cool blues)",
            "Upward-moving particle effects (heat rises)",
            "Red-orange-amber gradient palette",
        ],
    },
    # -- 10. Flora Pulse: 植物脉动 --
    # 基于 animation_game_design/flora_pulse 概念
    "flora_pulse": {
        "background_family": "dark-botanical",
        "description": "植物脉动 -- 适合植物学、光合作用、生态系统、农业、食物链、进化论",
        "palette": {
            "bg": "#080e08",
            "surface": "rgba(12,20,12,0.92)",
            "surface_high": "#142014",
            "primary": "#4ade80",
            "primary_container": "#16a34a",
            "secondary": "#a3e635",
            "tertiary": "#fbbf24",
            "signal": "#ef4444",
            "success": "#10b981",
            "text": "#d8e8d8",
            "muted": "#5a7a5a",
            "outline_variant": "rgba(90,122,90,0.15)",
        },
        "radius": {"sm": 12, "md": 20, "lg": 9999},
        "stroke_width": {"base": 1.5, "focus": 2.5},
        "shadow": {
            "soft": "0 0 30px rgba(74,222,128,0.1)",
            "focus": "0 0 50px rgba(74,222,128,0.2)",
        },
        "font_pairing": "Space Grotesk + Manrope",
        "glassmorphism": "backdrop-filter: blur(16px); background: rgba(12,20,12,0.5)",
        "gradient_cta": "linear-gradient(135deg, #4ade80, #16a34a)",
        "special_effects": [
            "Chlorophyll glow: primary at 8% opacity, 30px blur",
            "Pollen/spore particles: gentle floating, green-yellow, varying sizes",
            "Growth pulse: scale 1.0 to 1.02 animation on living elements",
            "Vine pattern: thin organic curves connecting nodes",
            "Photosynthesis gradient: green to yellow directional light",
            "Leaf vein: thin secondary lines radiating from center",
        ],
        "css_rules": [
            "Organic rounded corners (12px-full) for natural feel",
            "Pill-shaped buttons (rounded-full)",
            "Green dominant palette with yellow/amber accents",
            "Gentle, breathing animations (no sharp movements)",
        ],
    },
}

DEFAULT_STYLE_KEY_BY_MODE = {
    "animation": "neural_circuit",
    "game": "neural_circuit",
    "story": "celestial_observatory",
}

# All available style_key values (for prompt injection)
ALL_STYLE_KEYS = "|".join(STYLE_KITS.keys())

ANIMATION_COMPONENT_LIBRARY = [
    "device_frame",
    "remote_controller",
    "signal_pulse_ring",
    "focus_highlight",
    "caption_plate",
    "state_chip",
    "arrow_flow",
    "mask_reveal_strip",
    "progress_dots",
    "mini_legend",
]

MOTION_PRESETS = {
    "enter": "opacity + translateY(12->0), ease-out, 240-320ms",
    "anticipation": "main action 前 120-180ms 反向轻微位移或缩放",
    "main_action": "动作主体 280-420ms，ease-in-out，焦点元素占主导",
    "secondary_overlap": "次级元素延后 80-140ms 跟随",
    "settle": "回弹或阻尼收敛 200-320ms",
}


def get_style_kit(mode: str, preferred_key: str | None = None) -> tuple[str, dict]:
    """Return (style_key, style_kit) with safe fallback."""
    style_key = preferred_key if preferred_key in STYLE_KITS else None
    if not style_key:
        style_key = DEFAULT_STYLE_KEY_BY_MODE.get(mode, "neural_circuit")
    return style_key, STYLE_KITS[style_key]


def style_kit_prompt_block(mode: str, preferred_key: str | None = None) -> str:
    """Return a compact text block used in detail planner prompts."""
    style_key, kit = get_style_kit(mode=mode, preferred_key=preferred_key)
    palette = kit["palette"]
    radius = kit["radius"]
    desc = kit.get("description", "")
    return (
        f"固定风格系统（必须严格遵守，不可自由发挥）：\n"
        f"- style_key: {style_key}\n"
        f"- 风格说明: {desc}\n"
        f"- 背景: {palette['bg']}，面板: {palette['surface']}\n"
        f"- 主色: {palette['primary']}，辅助色: {palette['secondary']}，信号色: {palette['signal']}\n"
        f"- 文本色: {palette['text']}，弱化文本: {palette['muted']}\n"
        f"- 圆角: sm={radius['sm']}px, md={radius['md']}px, lg={radius['lg']}px\n"
        f"- 字体: {kit['font_pairing']}\n"
    )


def animation_component_library_block() -> str:
    """Return component-library rules for animation prompts."""
    return (
        "可复用组件库（优先组合，不要每次重造形状）：\n"
        + "\n".join(f"- {name}" for name in ANIMATION_COMPONENT_LIBRARY)
        + "\n"
        + "构图要求：主体元素至少占画面宽或高的 60%，避免空旷背景。\n"
        + "布局要求：使用明确焦点（focal object）+ 次焦点（secondary object）。\n"
    )


def motion_preset_block() -> str:
    """Return motion grammar rules for animation prompts."""
    return (
        "动效语法（必须包含以下阶段）：\n"
        + "\n".join(f"- {k}: {v}" for k, v in MOTION_PRESETS.items())
        + "\n"
        + "性能要求：优先 transform / opacity；避免重度 filter 与 box-shadow 动画。\n"
    )


def evaluate_animation_html_quality(html: str) -> dict:
    """Heuristic quality scoring for generated animation HTML.

    Two dimensions:
    - Technical (60 pts): SVG structure, animation primitives, completion signal
    - Pedagogical (40 pts): teaching rhythm, visual evidence, knowledge focus
    """
    lower = html.lower()

    # --- Technical dimension (60 pts) ---
    tech_checks: list[tuple[bool, int, str]] = [
        ("<svg" in lower, 15, "缺少 SVG 场景"),
        (("@keyframes" in lower) or ("animation" in lower), 12, "缺少明确动画定义"),
        (("transform" in lower) or ("translate(" in lower), 8, "缺少 transform 动画"),
        ("opacity" in lower, 5, "缺少透明度层次与过渡"),
        (("lineargradient" in lower) or ("radialgradient" in lower), 8, "缺少渐变层次"),
        ("<defs" in lower, 5, "缺少可复用 SVG 定义"),
        (("step_complete" in lower) and ("postmessage" in lower), 7, "缺少完成信号上报"),
    ]
    tech_score = 0
    issues: list[str] = []
    for ok, weight, issue in tech_checks:
        if ok:
            tech_score += weight
        else:
            issues.append(issue)

    # Composition proxy: large focal element
    has_large_shape = False
    for w, h in re.findall(r'width=["\']?(\d{2,4})["\']?[^>]*height=["\']?(\d{2,4})["\']?', html):
        try:
            if int(w) >= 220 and int(h) >= 120:
                has_large_shape = True
                break
        except ValueError:
            continue
    if has_large_shape:
        tech_score += 8  # max tech = 68, capped to 60
    else:
        issues.append("主体构图可能偏小，缺少足够大的焦点元素")

    tech_score = min(tech_score, 60)

    # --- Pedagogical dimension (40 pts) ---
    # Teaching rhythm: anticipation + settle pattern signals staged learning
    has_teaching_rhythm = (
        ("anticipation" in lower or "ease-in" in lower or "ease-out" in lower)
        and ("settl" in lower or "ease-in-out" in lower or "step" in lower)
    )
    # Visual evidence: frame captions / text labels / narration present
    text_count = lower.count("<text")
    has_visual_evidence = text_count >= 2
    # Knowledge focus: label or caption content present (not just decorative)
    has_knowledge_focus = (
        "caption" in lower or "narration" in lower
        or "frame-caption" in lower or "label" in lower
    )
    # Multi-frame progression: JS array or multiple keyframe stops
    has_progression = (
        "frames" in lower and ("[" in html and "]" in html)
        or lower.count("keyframe") >= 2
        or lower.count("@keyframes") >= 2
    )

    ped_checks: list[tuple[bool, int, str]] = [
        (has_teaching_rhythm, 12, "缺少教学节奏（anticipation/settle 阶段）"),
        (has_visual_evidence, 10, "视觉证据不足（标注文字少于 2 处）"),
        (has_knowledge_focus, 10, "缺少知识焦点标注（caption/label）"),
        (has_progression, 8, "缺少多帧递进（学习进程不清晰）"),
    ]
    ped_score = 0
    for ok, weight, issue in ped_checks:
        if ok:
            ped_score += weight
        else:
            issues.append(issue)

    total = tech_score + ped_score

    return {
        "score": min(total, 100),
        "tech_score": tech_score,
        "ped_score": ped_score,
        "issues": issues,
        "pass": total >= 72,
    }


def format_animation_quality_feedback(report: dict) -> str:
    """Convert quality report to terse, prompt-friendly feedback."""
    issues = report.get("issues") or []
    tech = report.get("tech_score", 0)
    ped = report.get("ped_score", 0)
    if not issues:
        return "当前质量检查通过。请保持构图焦点、风格一致性与动效层次。"
    top = issues[:6]
    header = f"技术分={tech}/60，教学分={ped}/40，需要修复：\n"
    return header + "\n".join(f"- {item}" for item in top)


def normalize_story_image_prompt(
    prompt: str,
    *,
    style_key: str | None = None,
    paragraph_text: str = "",
) -> str:
    """Harden story image prompts with stable style constraints."""
    resolved_key, kit = get_style_kit("story", preferred_key=style_key)
    palette = kit["palette"]
    style_suffix = (
        f"children's educational illustration, style_key={resolved_key}, "
        f"primary color {palette['primary']}, secondary color {palette['secondary']}, "
        "clear focal subject, cinematic composition, no text, no watermark."
    )
    base = (prompt or "").strip()
    if paragraph_text:
        base = f"{base} Scene context: {paragraph_text[:120]}".strip()
    if not base:
        base = "Educational children's story scene"
    if "no text" not in base.lower():
        base = f"{base}. {style_suffix}"
    return base[:560]


def inject_game_style_overrides(html: str, style_key: str | None = None) -> str:
    """Inject shared game CSS tokens to keep output style consistent across mechanics."""
    resolved_key, kit = get_style_kit("game", preferred_key=style_key)
    palette = kit["palette"]
    font = kit.get("font_pairing", "Space Grotesk").split("+")[0].strip()
    style_block = f"""
<style id="edu-game-style-kit">
:root {{
  --bg1: {palette['bg']} !important;
  --bg2: {palette['surface']} !important;
  --accent: {palette['primary']} !important;
  --accent2: {palette['secondary']} !important;
  --green: {palette['success']} !important;
  --red: {palette['signal']} !important;
  --text: {palette['text']} !important;
  --dim: {palette['muted']} !important;
}}
html, body {{
  font-family: "{font}", "Noto Sans SC", "PingFang SC", system-ui, sans-serif !important;
}}
</style>
""".strip()
    if "edu-game-style-kit" in html:
        return html
    if "</head>" in html:
        return html.replace("</head>", f"{style_block}\n</head>", 1)
    return style_block + "\n" + html


def evaluate_detail_plan(mode: str, detail_plan: dict) -> dict:
    """Evaluate complexity + persuasion for detail plans."""
    issues: list[str] = []
    complexity_score = 100
    persuasion_score = 100

    if mode == "animation":
        frames = detail_plan.get("frames") or []
        frame_count = int(detail_plan.get("frame_count") or len(frames) or 0)
        if frame_count > 6:
            complexity_score -= 20
            issues.append("动画帧数过多（建议 4-6 帧）")
        total_elements = 0
        for frame in frames:
            total_elements += len(frame.get("visual_elements") or []) if isinstance(frame, dict) else 0
        if total_elements > 20:
            complexity_score -= 20
            issues.append("视觉元素总数过多，建议聚焦 1 个主场景")
        if len(detail_plan.get("beats") or []) > 6:
            complexity_score -= 15
            issues.append("动作节拍过多，建议减少到 4-6 个关键 beat")
        layout = detail_plan.get("layout") or {}
        safe_fill = layout.get("safe_area_fill")
        try:
            if safe_fill is None or float(safe_fill) < 0.55:
                complexity_score -= 8
                issues.append("构图占比偏低，主体可能太小（safe_area_fill 建议 >= 0.55）")
        except (TypeError, ValueError):
            complexity_score -= 8
            issues.append("layout.safe_area_fill 无效")

    elif mode == "game":
        params = detail_plan.get("simulation_params") or []
        flow = detail_plan.get("interaction_flow") or []
        storyboard = detail_plan.get("visual_storyboard") or []
        if len(params) > 3:
            complexity_score -= 25
            issues.append("模拟参数过多（建议 2-3 个）")
        if len(flow) > 4:
            complexity_score -= 15
            issues.append("交互步骤过多（建议 3-4 步）")
        if len(storyboard) > 3:
            complexity_score -= 10
            issues.append("分镜阶段过多（建议 3 段）")
        scene_desc = str(detail_plan.get("scene_description") or "")
        if len(scene_desc) > 90:
            complexity_score -= 8
            issues.append("场景描述过长，可能导致执行时发散")

    elif mode == "story":
        paragraphs = detail_plan.get("paragraphs") or []
        if len(paragraphs) > 4:
            complexity_score -= 15
            issues.append("故事段落偏多（建议 3-4 段）")
        for idx, para in enumerate(paragraphs, start=1):
            text = str((para or {}).get("text") or "")
            if len(text) > 180:
                complexity_score -= 6
                issues.append(f"第 {idx} 段文字偏长，影响节奏")

    persuasion = detail_plan.get("persuasion") if isinstance(detail_plan, dict) else None
    if not isinstance(persuasion, dict):
        persuasion_score -= 35
        issues.append("缺少 persuasion 说服力设计（学习主张/证据/结论）")
    else:
        filled = sum(1 for k in ("learning_claim", "evidence", "takeaway") if str(persuasion.get(k) or "").strip())
        if filled < 2:
            persuasion_score -= 20
            issues.append("persuasion 字段信息不足")

    return {
        "complexity_score": max(complexity_score, 0),
        "persuasion_score": max(persuasion_score, 0),
        "pass": complexity_score >= 72 and persuasion_score >= 65,
        "issues": issues,
    }


def format_detail_plan_feedback(report: dict) -> str:
    """Format detail-plan evaluation issues for revision prompts."""
    issues = report.get("issues") or []
    if not issues:
        return "当前方案通过。请保持简洁单场景与高说服力。"
    return "\n".join(f"- {item}" for item in issues[:8])


def simplify_detail_plan(mode: str, detail_plan: dict) -> dict:
    """Deterministically simplify detail plans while preserving core intent."""
    plan = dict(detail_plan or {})

    if mode == "animation":
        original_frame_count = plan.get("frame_count")
        frames = []
        for i, frame in enumerate((plan.get("frames") or [])[:5]):
            if not isinstance(frame, dict):
                continue
            frames.append({
                "frame_index": i,
                "description": str(frame.get("description") or f"关键步骤{i + 1}")[:60],
                "visual_elements": [str(v) for v in (frame.get("visual_elements") or [])[:3]],
                "narration": str(frame.get("narration") or "")[:40],
            })
        if not frames:
            frames = [{
                "frame_index": 0,
                "description": str(plan.get("title") or "核心概念展示"),
                "visual_elements": ["核心对象", "变化信号", "结论标记"],
                "narration": "",
            }]
        plan["frames"] = frames
        try:
            raw_count = int(original_frame_count)
            plan["frame_count"] = max(4, min(raw_count, 6))
        except (TypeError, ValueError):
            plan["frame_count"] = max(4, min(len(frames), 6))
        plan["layout"] = {
            "focal_object": (plan.get("layout") or {}).get("focal_object", "核心对象"),
            "secondary_object": (plan.get("layout") or {}).get("secondary_object", "辅助对象"),
            "safe_area_fill": 0.62,
        }
        beats = [b for b in (plan.get("beats") or []) if isinstance(b, dict)][:5]
        if not beats:
            beats = [
                {"t": 0.0, "action": "enter", "focus": "核心对象"},
                {"t": 0.2, "action": "anticipation", "focus": "触发点"},
                {"t": 0.55, "action": "main_action", "focus": "关键变化"},
                {"t": 0.8, "action": "secondary_overlap", "focus": "辅助反馈"},
                {"t": 1.0, "action": "settle", "focus": "结论"},
            ]
        plan["beats"] = beats

    elif mode == "game":
        params = []
        for i, p in enumerate((plan.get("simulation_params") or [])[:3]):
            if not isinstance(p, dict):
                continue
            pmin = p.get("min", 0)
            pmax = p.get("max", 100)
            try:
                pmin_f = float(pmin)
                pmax_f = float(pmax)
                if pmax_f <= pmin_f:
                    pmax_f = pmin_f + 1
                pmin, pmax = int(pmin_f), int(pmax_f)
            except (TypeError, ValueError):
                pmin, pmax = 0, 100
            default = p.get("default", int((pmin + pmax) / 2))
            params.append({
                "param_name": str(p.get("param_name") or f"param_{i + 1}"),
                "label": str(p.get("label") or f"参数{i + 1}"),
                "min": pmin,
                "max": pmax,
                "default": int(default) if isinstance(default, (int, float)) else int((pmin + pmax) / 2),
                "unit": str(p.get("unit") or ""),
            })
        plan["simulation_params"] = params
        plan["interaction_flow"] = [str(s) for s in (plan.get("interaction_flow") or [])[:4]]
        plan["visual_storyboard"] = [str(s) for s in (plan.get("visual_storyboard") or [])[:3]]

    elif mode == "story":
        paragraphs = []
        for para in (plan.get("paragraphs") or [])[:4]:
            if not isinstance(para, dict):
                continue
            paragraphs.append({
                "text": str(para.get("text") or "")[:180],
                "image_prompt": str(para.get("image_prompt") or "")[:320],
            })
        plan["paragraphs"] = paragraphs

    persuasion = plan.get("persuasion")
    if not isinstance(persuasion, dict):
        plan["persuasion"] = {
            "learning_claim": "本场景聚焦一个关键概念，确保学生能解释“为什么”。",
            "evidence": "通过可见变化证明概念成立，减少抽象记忆负担。",
            "takeaway": "学生能用自己的话复述规律并举一个生活例子。",
        }
    return plan
