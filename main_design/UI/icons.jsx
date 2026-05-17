/* Icon set — Lucide-inspired, 1.5px stroke. No emoji anywhere. */
const Icon = ({ name, size = 16, stroke = 1.5, className = "", style = {} }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
    className, style,
  };
  const P = (children) => <svg {...props}>{children}</svg>;

  switch (name) {
    case "home":           return P(<><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></>);
    case "library":        return P(<><rect x="3" y="4" width="4" height="16" rx="1"/><rect x="9" y="4" width="4" height="16" rx="1"/><path d="m15.5 5.5 3 .8L15 20"/></>);
    case "compass":        return P(<><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z"/></>);
    case "grid":           return P(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>);
    case "search":         return P(<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>);
    case "chevron-right":  return P(<path d="m9 6 6 6-6 6"/>);
    case "chevron-left":   return P(<path d="m15 6-6 6 6 6"/>);
    case "chevron-down":   return P(<path d="m6 9 6 6 6-6"/>);
    case "arrow-right":    return P(<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>);
    case "arrow-up-right": return P(<><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>);
    case "plus":           return P(<><path d="M12 5v14"/><path d="M5 12h14"/></>);
    case "play":           return P(<path d="M7 5v14l12-7z"/>);
    case "circle-play":    return P(<><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/></>);
    case "circle-check":   return P(<><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L16 9.5"/></>);
    case "circle":         return P(<circle cx="12" cy="12" r="9"/>);
    case "circle-dot":     return P(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></>);
    case "check":          return P(<path d="m5 12 5 5 9-11"/>);
    case "lock":           return P(<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>);
    case "unlock":         return P(<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-2.6"/></>);
    case "clock":          return P(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
    case "calendar":       return P(<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></>);
    case "users":          return P(<><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M21 20a5 5 0 0 0-4-4.9"/></>);
    case "user":           return P(<><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></>);
    case "layers":         return P(<><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>);
    case "git-branch":     return P(<><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10"/><path d="M18 11c0 4-6 4-6 8"/></>);
    case "git-fork":       return P(<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v2a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V8"/><path d="M12 14v2"/></>);
    case "copy":           return P(<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>);
    case "download":       return P(<><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>);
    case "settings":       return P(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9A1.7 1.7 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>);
    case "sparkles":       return P(<><path d="M12 3v3M12 18v3M21 12h-3M6 12H3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="2.5"/></>);
    case "bot":            return P(<><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 8V5"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><path d="M9 17h6"/><path d="M2 13v2M22 13v2"/></>);
    case "message-square": return P(<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4V6a2 2 0 0 1 2-2z"/>);
    case "book":           return P(<><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/></>);
    case "book-open":      return P(<><path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/></>);
    case "code":           return P(<><path d="m8 8-5 4 5 4"/><path d="m16 8 5 4-5 4"/><path d="m14 4-4 16"/></>);
    case "terminal":       return P(<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/></>);
    case "cpu":            return P(<><rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></>);
    case "circuit":        return P(<><path d="M3 12h4l2-3 6 6 2-3h4"/><circle cx="7" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/></>);
    case "antenna":        return P(<><path d="M5 16 12 4l7 12"/><path d="M7.5 12h9"/><path d="M12 20v-4"/></>);
    case "wave":           return P(<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>);
    case "wifi":           return P(<><path d="M2 9a14 14 0 0 1 20 0"/><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></>);
    case "flask":          return P(<><path d="M9 3h6"/><path d="M10 3v6.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3"/><path d="M7.5 14h9"/></>);
    case "atom":           return P(<><circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-60 12 12)"/></>);
    case "wind":           return P(<><path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h17a3 3 0 1 1-3 3"/><path d="M3 19h5a3 3 0 1 1-3 3"/></>);
    case "leaf":           return P(<><path d="M4 20s2-10 10-14 6 12 0 14-10 0-10 0z"/><path d="M4 20 14 10"/></>);
    case "globe":          return P(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></>);
    case "map":            return P(<><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></>);
    case "trending":       return P(<><path d="m3 17 7-7 4 4 7-7"/><path d="M14 7h7v7"/></>);
    case "target":         return P(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></>);
    case "rocket":         return P(<><path d="M14 5c3-2 7-2 7-2s0 4-2 7c-2 3-7 5-7 5l-3-3s2-5 5-7z"/><path d="M9 12 5 16l3 3 4-4"/><path d="M5 19c-1 1-3 1-3 1s0-2 1-3"/></>);
    case "flag":           return P(<><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></>);
    case "star":           return P(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>);
    case "bookmark":       return P(<path d="M6 4h12v17l-6-4-6 4z"/>);
    case "more":           return P(<><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></>);
    case "filter":         return P(<path d="M3 5h18l-7 9v6l-4-2v-4z"/>);
    case "external":       return P(<><path d="M9 5h10v10"/><path d="m19 5-9 9"/><path d="M14 14v5H5V10h5"/></>);
    case "menu":           return P(<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></>);
    case "x":              return P(<><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>);
    case "pin":            return P(<><path d="M12 21v-7"/><path d="M9 3h6l-1 5 3 3v3H7v-3l3-3z"/></>);
    case "spark":          return P(<path d="M12 3v6m0 6v6M3 12h6m6 0h6M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>);
    case "node":           return P(<><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="12" r="1.5"/><path d="M5.3 7 9.5 11M5.3 17 9.5 13M14.5 12h4"/></>);
    case "battery":        return P(<><rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2"/><path d="M6 10v4M9 10v4"/></>);
    case "shield":         return P(<path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z"/>);
    case "logout":         return P(<><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m10 8-4 4 4 4"/><path d="M6 12h12"/></>);
    case "edit":           return P(<><path d="M14 5l4 4"/><path d="M5 19h4l11-11-4-4L5 15z"/></>);
    case "command":        return P(<path d="M9 6H6a3 3 0 1 0 3 3v6a3 3 0 1 0-3 3h12a3 3 0 1 1-3-3V9a3 3 0 1 1 3-3h-3z"/>);
    default: return null;
  }
};

window.Icon = Icon;
