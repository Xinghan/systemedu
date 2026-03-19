/**
 * Cartoon-style SVG icons for the learning interface.
 * Rounded, chunky, playful — kid-friendly but no emoji.
 * All icons accept className for sizing (default viewBox 24x24).
 */

import { type SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

/** Cartoon pickaxe — mining knowledge */
export function IconPickaxe({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M5 5L12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 12L19 19" stroke="#8B6914" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 3L7 3L7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#808080" />
      <circle cx="5" cy="5" r="1" fill="#4682B4" />
    </svg>
  )
}

/** Cartoon flame — smelting concepts */
export function IconFlame({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M12 2C12 2 7 8 7 13C7 16.3 9.2 19 12 19C14.8 19 17 16.3 17 13C17 8 12 2 12 2Z" fill="#FF6B35" stroke="#E8530E" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10C12 10 10 13 10 15C10 16.7 10.9 18 12 18C13.1 18 14 16.7 14 15C14 13 12 10 12 10Z" fill="#FFD700" />
      <ellipse cx="12" cy="21" rx="5" ry="1.5" fill="currentColor" opacity="0.1" />
    </svg>
  )
}

/** Cartoon flask — synthesizing examples */
export function IconFlask({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M9 3H15V8L19 16C19.6 17.2 18.7 19 17.3 19H6.7C5.3 19 4.4 17.2 5 16L9 8V3Z" fill="#E8F5E9" stroke="#4CAF50" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 16H19" stroke="#4CAF50" strokeWidth="1.5" />
      <rect x="8" y="2" width="8" height="2" rx="1" fill="#4CAF50" />
      <circle cx="10" cy="15" r="1" fill="#4CAF50" />
      <circle cx="14" cy="14" r="1.5" fill="#81C784" />
      <circle cx="12" cy="17" r="0.8" fill="#4CAF50" />
      <ellipse cx="12" cy="21" rx="5" ry="1.5" fill="currentColor" opacity="0.1" />
    </svg>
  )
}

/** Cartoon hammer — forging tools */
export function IconHammer({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="3" y="4" width="12" height="7" rx="2" fill="#808080" stroke="#666" strokeWidth="1.5" />
      <rect x="6" y="4" width="3" height="7" fill="#4682B4" opacity="0.5" />
      <rect x="13" y="6.5" width="8" height="3" rx="1.5" fill="#8B6914" stroke="#6B4E14" strokeWidth="1" />
      <ellipse cx="12" cy="21" rx="5" ry="1.5" fill="currentColor" opacity="0.1" />
    </svg>
  )
}

/** Cartoon sparkle stars — enchanting */
export function IconSparkles({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#FFD700" stroke="#DAA520" strokeWidth="1" strokeLinejoin="round" />
      <path d="M19 2L19.8 5L23 5.8L19.8 6.6L19 10L18.2 6.6L15 5.8L18.2 5L19 2Z" fill="#FFA000" strokeWidth="0.5" />
      <path d="M5 14L5.6 16L8 16.6L5.6 17.2L5 20L4.4 17.2L2 16.6L4.4 16L5 14Z" fill="#FFC107" strokeWidth="0.5" />
    </svg>
  )
}

/** Cartoon treasure chest / package */
export function IconChest({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="3" y="10" width="18" height="9" rx="2" fill="#8B6914" stroke="#6B4E14" strokeWidth="1.5" />
      <path d="M3 12C3 10.3 4.3 7 12 7C19.7 7 21 10.3 21 12" fill="#A0782C" stroke="#6B4E14" strokeWidth="1.5" />
      <rect x="10" y="12" width="4" height="4" rx="1" fill="#FFD700" stroke="#DAA520" strokeWidth="1" />
      <circle cx="12" cy="14" r="0.8" fill="#6B4E14" />
      <ellipse cx="12" cy="21" rx="6" ry="1.5" fill="currentColor" opacity="0.1" />
    </svg>
  )
}

/** Cartoon castle / building */
export function IconCastle({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="6" y="8" width="12" height="12" fill="#B0BEC5" stroke="#78909C" strokeWidth="1.5" />
      <rect x="4" y="4" width="4" height="6" fill="#90A4AE" stroke="#78909C" strokeWidth="1" />
      <rect x="16" y="4" width="4" height="6" fill="#90A4AE" stroke="#78909C" strokeWidth="1" />
      <rect x="10" y="14" width="4" height="6" rx="2" fill="#5D4037" />
      <rect x="5" y="3" width="2" height="2" fill="#78909C" />
      <rect x="17" y="3" width="2" height="2" fill="#78909C" />
      <rect x="8" y="10" width="2" height="2" fill="#64B5F6" rx="0.5" />
      <rect x="14" y="10" width="2" height="2" fill="#64B5F6" rx="0.5" />
    </svg>
  )
}

/** Cartoon explosion / TNT — demolishing */
export function IconBoom({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M12 4L14 8L18 6L16 10L21 12L16 14L18 18L14 16L12 21L10 16L6 18L8 14L3 12L8 10L6 6L10 8L12 4Z" fill="#FF5722" stroke="#D84315" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="#FFAB91" />
      <circle cx="12" cy="12" r="1.5" fill="#FFD700" />
    </svg>
  )
}

/** Cartoon blueprint / ruler */
export function IconBlueprint({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#E3F2FD" stroke="#1E88E5" strokeWidth="1.5" />
      <line x1="7" y1="8" x2="17" y2="8" stroke="#1E88E5" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="12" x2="14" y2="12" stroke="#64B5F6" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="16" x2="11" y2="16" stroke="#64B5F6" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="13" width="4" height="4" rx="0.5" stroke="#1E88E5" strokeWidth="1" strokeDasharray="2 1" />
    </svg>
  )
}

/** Cartoon bricks — building materials */
export function IconBricks({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="2" y="5" width="9" height="5" rx="1" fill="#E57373" stroke="#C62828" strokeWidth="1" />
      <rect x="13" y="5" width="9" height="5" rx="1" fill="#EF9A9A" stroke="#C62828" strokeWidth="1" />
      <rect x="2" y="12" width="6" height="5" rx="1" fill="#EF9A9A" stroke="#C62828" strokeWidth="1" />
      <rect x="10" y="12" width="6" height="5" rx="1" fill="#E57373" stroke="#C62828" strokeWidth="1" />
      <rect x="18" y="12" width="4" height="5" rx="1" fill="#EF9A9A" stroke="#C62828" strokeWidth="1" />
    </svg>
  )
}

/** Cartoon paint roller / brush */
export function IconPaint({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect x="4" y="3" width="14" height="8" rx="2" fill="#7C4DFF" stroke="#651FFF" strokeWidth="1.5" />
      <rect x="18" y="5" width="3" height="4" rx="1" fill="#8B6914" />
      <rect x="11" y="11" width="2" height="5" fill="#8B6914" />
      <rect x="8" y="15" width="8" height="4" rx="1.5" fill="#B388FF" stroke="#7C4DFF" strokeWidth="1" />
      <ellipse cx="12" cy="21" rx="5" ry="1.5" fill="currentColor" opacity="0.1" />
    </svg>
  )
}

/** Cartoon magnifying glass — inspection */
export function IconMagnify({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <circle cx="10" cy="10" r="7" fill="#E3F2FD" stroke="#1565C0" strokeWidth="2.5" />
      <circle cx="10" cy="10" r="4" fill="#BBDEFB" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="#8B6914" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 8C8 6.5 9.5 6 11 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

/** Cartoon lightbulb — tip / idea */
export function IconBulb({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M12 2C8 2 5 5 5 9C5 12 7 13.5 8 15H16C17 13.5 19 12 19 9C19 5 16 2 12 2Z" fill="#FFF9C4" stroke="#F9A825" strokeWidth="2" strokeLinejoin="round" />
      <rect x="9" y="16" width="6" height="3" rx="1" fill="#FFD54F" stroke="#F9A825" strokeWidth="1" />
      <path d="M10 21H14" stroke="#F9A825" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 7C11 5.5 13 5.5 14 7" stroke="#FFE082" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Cartoon book — learning / lesson */
export function IconBook({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M4 4C4 3 5 2 6 2H18C19 2 20 3 20 4V19C20 20 19 21 18 21H6C5 21 4 20 4 19V4Z" fill="#4FC3F7" stroke="#0288D1" strokeWidth="1.5" />
      <path d="M4 4H7V21H4" fill="#0288D1" />
      <line x1="10" y1="7" x2="17" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="11" x2="16" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="10" y1="15" x2="14" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

/** Cartoon scroll / document */
export function IconScroll({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M7 3C5.5 3 4 4 4 5.5C4 7 5.5 7 5.5 7H19V18.5C19 20 17.5 21 16 21H8C6.5 21 5 20 5 18.5V7" fill="#FFF8E1" stroke="#F9A825" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 5.5C4 4 5.5 3 7 3H20V5.5C20 7 18.5 7 18.5 7H5.5" stroke="#F9A825" strokeWidth="1.5" />
      <line x1="8" y1="11" x2="16" y2="11" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="14.5" x2="14" y2="14.5" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="18" x2="11" y2="18" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Hierarchical node tree — knowledge tree / DAG */
export function IconTree({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      {/* root node */}
      <circle cx="12" cy="3.5" r="2.5" fill="#4CAF50" stroke="#2E7D32" strokeWidth="1" />
      {/* edges root -> mid-left, mid-right */}
      <line x1="10" y1="5.5" x2="6.5" y2="10.5" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="5.5" x2="17.5" y2="10.5" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round" />
      {/* mid-left node */}
      <circle cx="6" cy="12" r="2.5" fill="#66BB6A" stroke="#2E7D32" strokeWidth="1" />
      {/* mid-right node */}
      <circle cx="18" cy="12" r="2.5" fill="#66BB6A" stroke="#2E7D32" strokeWidth="1" />
      {/* edges mid-left -> leaf-left, leaf-mid */}
      <line x1="4.5" y1="14" x2="3.5" y2="18.5" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7.5" y1="14" x2="10.5" y2="18.5" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round" />
      {/* edges mid-right -> leaf-mid2, leaf-right */}
      <line x1="16.5" y1="14" x2="13.5" y2="18.5" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19.5" y1="14" x2="20.5" y2="18.5" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round" />
      {/* leaf nodes */}
      <circle cx="3" cy="20" r="2" fill="#A5D6A7" stroke="#388E3C" strokeWidth="1" />
      <circle cx="11" cy="20" r="2" fill="#A5D6A7" stroke="#388E3C" strokeWidth="1" />
      <circle cx="13" cy="20" r="2" fill="#A5D6A7" stroke="#388E3C" strokeWidth="1" />
      <circle cx="21" cy="20" r="2" fill="#A5D6A7" stroke="#388E3C" strokeWidth="1" />
    </svg>
  )
}

/** Cartoon star — XP / reward */
export function IconStar({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M12 2L14.9 8.6L22 9.5L17 14.3L18.2 21.3L12 17.8L5.8 21.3L7 14.3L2 9.5L9.1 8.6L12 2Z" fill="#FFD700" stroke="#F9A825" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** Cartoon clock — time */
export function IconClock({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <circle cx="12" cy="12" r="10" fill="#E3F2FD" stroke="#1E88E5" strokeWidth="2" />
      <circle cx="12" cy="12" r="7.5" fill="#BBDEFB" />
      <line x1="12" y1="7" x2="12" y2="12" stroke="#1565C0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="16" y2="14" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="#1565C0" />
      <circle cx="12" cy="4" r="1" fill="#1E88E5" />
      <circle cx="12" cy="20" r="1" fill="#1E88E5" />
      <circle cx="4" cy="12" r="1" fill="#1E88E5" />
      <circle cx="20" cy="12" r="1" fill="#1E88E5" />
    </svg>
  )
}

/** Cartoon check badge — completed */
export function IconCheck({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <circle cx="12" cy="12" r="10" fill="#C8E6C9" stroke="#2E7D32" strokeWidth="2" />
      <path d="M7 12L10.5 15.5L17 9" stroke="#2E7D32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Cartoon lightning — difficulty / energy */
export function IconLightning({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" fill="#FFD700" stroke="#F9A825" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** Cartoon notepad / sticky note */
export function IconNote({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M5 3H19C19.6 3 20 3.4 20 4V17L15 22H5C4.4 22 4 21.6 4 21V4C4 3.4 4.4 3 5 3Z" fill="#FFF59D" stroke="#F9A825" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 17V22L20 17H15Z" fill="#FBC02D" />
      <line x1="8" y1="8" x2="16" y2="8" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="12" x2="14" y2="12" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="16" x2="12" y2="16" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
