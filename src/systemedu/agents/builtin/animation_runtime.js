/**
 * AnimationRuntime v1 — 接收 AnimationSpec JSON，渲染为 SVG 动画
 *
 * 使用方式：将此文件内容内联到 HTML 中，然后调用：
 *   const runtime = new AnimationRuntime(spec, document.getElementById('scene'));
 *   runtime.play();
 *
 * AnimationSpec 格式见 animation_spec_schema.py
 */
(function (global) {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  // 常量
  // ─────────────────────────────────────────────────────────────
  var SVG_NS = "http://www.w3.org/2000/svg";
  var VIEWBOX_W = 600;
  var VIEWBOX_H = 420;
  var STAGE_H = 360;      // 主内容区高度（底部留 60px 给 HUD）
  var HUD_Y = 368;        // 进度指示器 Y

  // ─────────────────────────────────────────────────────────────
  // 缓动函数
  // ─────────────────────────────────────────────────────────────
  var Easing = {
    linear: function (t) { return t; },
    easeIn: function (t) { return t * t; },
    easeOut: function (t) { return t * (2 - t); },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    spring: function (t) {
      var c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    bounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
  };

  // ─────────────────────────────────────────────────────────────
  // 补间引擎
  // ─────────────────────────────────────────────────────────────
  function Tween(opts) {
    // opts: { from, to, duration, easing, onUpdate, onComplete }
    this.from = opts.from;
    this.to = opts.to;
    this.duration = opts.duration || 600;
    this.easing = Easing[opts.easing] || Easing.easeInOut;
    this.onUpdate = opts.onUpdate || function () {};
    this.onComplete = opts.onComplete || function () {};
    this.startTime = null;
    this.done = false;
  }

  Tween.prototype.tick = function (now) {
    if (this.done) return;
    if (!this.startTime) this.startTime = now;
    var elapsed = now - this.startTime;
    var progress = Math.min(elapsed / this.duration, 1);
    var eased = this.easing(progress);
    // 插值（支持数字或对象）
    var value = this._interpolate(this.from, this.to, eased);
    this.onUpdate(value, eased);
    if (progress >= 1) {
      this.done = true;
      this.onComplete();
    }
  };

  Tween.prototype._interpolate = function (from, to, t) {
    if (typeof from === "number") return from + (to - from) * t;
    if (typeof from === "object" && from !== null) {
      var out = {};
      for (var k in from) {
        if (Object.prototype.hasOwnProperty.call(from, k)) {
          out[k] = typeof from[k] === "number" ? from[k] + (to[k] - from[k]) * t : (t < 1 ? from[k] : to[k]);
        }
      }
      return out;
    }
    return t < 1 ? from : to;
  };

  // ─────────────────────────────────────────────────────────────
  // 元素工厂（根据 element type 创建 SVG 元素）
  // ─────────────────────────────────────────────────────────────
  var ElementFactory = {
    _gradCount: 0,

    _mkGradId: function () {
      return "grad_" + (++this._gradCount);
    },

    // 通用属性应用
    _applyBase: function (el, spec, defs) {
      if (spec.fill) {
        if (spec.fill.type === "linear") {
          var gid = this._mkGradId();
          var grad = _svgEl("linearGradient", { id: gid, x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
          (spec.fill.stops || []).forEach(function (s) {
            grad.appendChild(_svgEl("stop", { offset: s.offset, "stop-color": s.color, "stop-opacity": s.opacity || 1 }));
          });
          defs.appendChild(grad);
          el.setAttribute("fill", "url(#" + gid + ")");
        } else if (spec.fill.type === "radial") {
          var gid2 = this._mkGradId();
          var rgrad = _svgEl("radialGradient", { id: gid2, cx: "50%", cy: "50%", r: "50%" });
          (spec.fill.stops || []).forEach(function (s) {
            rgrad.appendChild(_svgEl("stop", { offset: s.offset, "stop-color": s.color, "stop-opacity": s.opacity || 1 }));
          });
          defs.appendChild(rgrad);
          el.setAttribute("fill", "url(#" + gid2 + ")");
        } else {
          el.setAttribute("fill", spec.fill.color || spec.fill);
        }
      }
      if (spec.stroke) el.setAttribute("stroke", spec.stroke);
      if (spec.stroke_width != null) el.setAttribute("stroke-width", spec.stroke_width);
      if (spec.opacity != null) el.setAttribute("opacity", spec.opacity);
      if (spec.rx != null) el.setAttribute("rx", spec.rx);
      return el;
    },

    create: function (spec, defs) {
      var el, type = spec.type;
      if (type === "rect") {
        el = _svgEl("rect", { x: spec.x, y: spec.y, width: spec.w, height: spec.h });
      } else if (type === "circle") {
        el = _svgEl("circle", { cx: spec.cx, cy: spec.cy, r: spec.r });
      } else if (type === "ellipse") {
        el = _svgEl("ellipse", { cx: spec.cx, cy: spec.cy, rx: spec.rx, ry: spec.ry });
      } else if (type === "text") {
        el = _svgEl("text", { x: spec.x, y: spec.y, "text-anchor": spec.anchor || "middle", "font-size": spec.font_size || 16, "font-weight": spec.bold ? "700" : "400", fill: spec.color || "#0f172a" });
        el.textContent = spec.text || "";
      } else if (type === "line") {
        el = _svgEl("line", { x1: spec.x1, y1: spec.y1, x2: spec.x2, y2: spec.y2, stroke: spec.stroke || "#334155", "stroke-width": spec.stroke_width || 2 });
      } else if (type === "arrow") {
        // 带箭头的线
        var markId = "arrowMark_" + Math.random().toString(36).slice(2, 7);
        var marker = _svgEl("marker", { id: markId, markerWidth: "8", markerHeight: "8", refX: "6", refY: "3", orient: "auto" });
        marker.appendChild(_svgEl("path", { d: "M0,0 L0,6 L9,3 z", fill: spec.stroke || "#1d4ed8" }));
        defs.appendChild(marker);
        el = _svgEl("line", { x1: spec.x1, y1: spec.y1, x2: spec.x2, y2: spec.y2, stroke: spec.stroke || "#1d4ed8", "stroke-width": spec.stroke_width || 2.5, "marker-end": "url(#" + markId + ")" });
      } else if (type === "path") {
        el = _svgEl("path", { d: spec.d });
      } else if (type === "group") {
        el = _svgEl("g", {});
        var self = this;
        (spec.children || []).forEach(function (child) {
          el.appendChild(self.create(child, defs));
        });
      } else if (type === "label_bubble") {
        // 文字气泡标注（带背景）
        el = _svgEl("g", {});
        var bw = (spec.text || "").length * (spec.font_size || 13) * 0.65 + 24;
        var bh = (spec.font_size || 13) + 14;
        el.appendChild(_svgEl("rect", { x: spec.x - bw / 2, y: spec.y - bh + 2, width: bw, height: bh, rx: 8, fill: spec.bg || "#1d4ed8", opacity: 0.92 }));
        var t = _svgEl("text", { x: spec.x, y: spec.y - 4, "text-anchor": "middle", "font-size": spec.font_size || 13, fill: "#ffffff", "font-weight": "600" });
        t.textContent = spec.text || "";
        el.appendChild(t);
      } else if (type === "formula") {
        // 公式文本（使用 KaTeX 渲染时会被替换）
        el = _svgEl("foreignObject", { x: spec.x - spec.w / 2, y: spec.y - spec.h / 2, width: spec.w || 200, height: spec.h || 60 });
        var div = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
        div.style.cssText = "text-align:center;font-size:" + (spec.font_size || 20) + "px;color:" + (spec.color || "#1d4ed8") + ";line-height:" + (spec.h || 60) + "px;";
        div.textContent = spec.text || "";
        el.appendChild(div);
      } else {
        // 未知类型 fallback 为矩形占位
        el = _svgEl("rect", { x: spec.x || 0, y: spec.y || 0, width: spec.w || 60, height: spec.h || 40, fill: "#e2e8f0" });
      }
      if (type !== "group" && type !== "text" && type !== "formula" && type !== "label_bubble" && type !== "arrow" && type !== "line") {
        this._applyBase(el, spec, defs);
      }
      if (spec.id) el.setAttribute("id", spec.id);
      if (spec.transform) el.setAttribute("transform", spec.transform);
      return el;
    },
  };

  function _svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] != null) el.setAttribute(k, attrs[k]);
      });
    }
    return el;
  }

  // ─────────────────────────────────────────────────────────────
  // AnimationRuntime
  // ─────────────────────────────────────────────────────────────
  function AnimationRuntime(spec, container) {
    this.spec = spec;
    this.container = container;
    this.tweens = [];
    this.frameIndex = 0;
    this.rafId = null;
    this.svgEl = null;
    this.defsEl = null;
    this.stageEl = null;
    this.hudCaptionEl = null;
    this.hudDotsEl = null;
    this._elementMap = {};   // id -> SVG element
    this._frameTimers = [];
  }

  AnimationRuntime.prototype._buildSVG = function () {
    var svg = _svgEl("svg", {
      width: "100%",
      height: "100%",
      viewBox: "0 0 " + VIEWBOX_W + " " + VIEWBOX_H,
      xmlns: SVG_NS,
    });

    // defs
    var defs = _svgEl("defs", {});
    // 背景渐变
    var bgGrad = _svgEl("linearGradient", { id: "rt_bg", x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
    var palette = this._palette();
    bgGrad.appendChild(_svgEl("stop", { offset: "0%", "stop-color": palette.bg }));
    bgGrad.appendChild(_svgEl("stop", { offset: "100%", "stop-color": palette.bg2 || palette.bg }));
    defs.appendChild(bgGrad);
    // 阴影滤镜
    var filter = _svgEl("filter", { id: "rt_shadow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    var blur = _svgEl("feDropShadow", { dx: "0", dy: "6", stdDeviation: "8", "flood-color": "#1e3a8a", "flood-opacity": "0.14" });
    filter.appendChild(blur);
    defs.appendChild(filter);
    svg.appendChild(defs);

    // 背景
    svg.appendChild(_svgEl("rect", { x: 0, y: 0, width: VIEWBOX_W, height: VIEWBOX_H, fill: "url(#rt_bg)" }));

    // 主画布卡片
    var card = _svgEl("rect", { x: 16, y: 12, width: VIEWBOX_W - 32, height: STAGE_H - 12, rx: 20, fill: "#ffffff", "filter": "url(#rt_shadow)" });
    svg.appendChild(card);

    // 舞台组
    var stage = _svgEl("g", { id: "rt_stage" });
    svg.appendChild(stage);

    // HUD — 帧标题
    var caption = _svgEl("text", {
      id: "rt_caption",
      x: 24, y: HUD_Y + 6,
      "font-size": 11,
      fill: "#64748b",
      "font-family": '"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    });
    caption.textContent = "";
    svg.appendChild(caption);

    // HUD — 进度点
    var dots = _svgEl("g", { id: "rt_dots", transform: "translate(" + (VIEWBOX_W - 24) + "," + (HUD_Y + 6) + ")" });
    svg.appendChild(dots);

    this.svgEl = svg;
    this.defsEl = defs;
    this.stageEl = stage;
    this.hudCaptionEl = caption;
    this.hudDotsEl = dots;
    this.container.appendChild(svg);
  };

  AnimationRuntime.prototype._palette = function () {
    var sk = (this.spec.style_key || "edu_soft_tech");
    var palettes = {
      edu_soft_tech:    { bg: "#f2f7fb", bg2: "#e8f3ff", primary: "#1d4ed8", secondary: "#0ea5e9", accent: "#7c3aed" },
      concept_lab_clean:{ bg: "#f0fdfa", bg2: "#e0f7f4", primary: "#0891b2", secondary: "#22c55e", accent: "#0284c7" },
      storybook_vivid:  { bg: "#fffbeb", bg2: "#fef3c7", primary: "#d97706", secondary: "#0ea5e9", accent: "#dc2626" },
    };
    return palettes[sk] || palettes["edu_soft_tech"];
  };

  AnimationRuntime.prototype._buildHUD = function () {
    var frames = this.spec.frames || [];
    var dots = this.hudDotsEl;
    dots.innerHTML = "";
    var n = frames.length;
    var spacing = 16;
    var startX = -(n - 1) * spacing / 2;
    var palette = this._palette();
    for (var i = 0; i < n; i++) {
      var active = i === this.frameIndex;
      var cx = startX + i * spacing;
      var dot = _svgEl("circle", {
        cx: cx, cy: 0,
        r: active ? 5.5 : 3.5,
        fill: active ? palette.primary : "#cbd5e1",
        opacity: active ? 1 : 0.5,
      });
      dots.appendChild(dot);
    }
    var frameSpec = frames[this.frameIndex] || {};
    this.hudCaptionEl.textContent = frameSpec.caption || frameSpec.narration || "";
  };

  AnimationRuntime.prototype._clearStage = function () {
    while (this.stageEl.firstChild) {
      this.stageEl.removeChild(this.stageEl.firstChild);
    }
    this._elementMap = {};
    this.tweens = [];
  };

  AnimationRuntime.prototype._renderFrame = function (frameSpec) {
    var self = this;
    this._clearStage();
    var elements = frameSpec.elements || [];
    elements.forEach(function (spec) {
      var el = ElementFactory.create(spec, self.defsEl);
      if (spec.id) self._elementMap[spec.id] = el;
      // 初始状态：如果有入场动画，先设为不可见
      if (spec.enter) {
        el.setAttribute("opacity", 0);
        if (spec.enter.from_x != null) {
          el.setAttribute("transform", "translate(" + spec.enter.from_x + "," + (spec.enter.from_y || 0) + ")");
        } else if (spec.enter.from_scale != null) {
          var cx = spec.cx || (spec.x + (spec.w || 0) / 2) || 300;
          var cy = spec.cy || (spec.y + (spec.h || 0) / 2) || 180;
          el.setAttribute("transform", "translate(" + cx + "," + cy + ") scale(" + spec.enter.from_scale + ") translate(-" + cx + ",-" + cy + ")");
        }
      }
      self.stageEl.appendChild(el);
    });

    // 触发入场动画
    var delay = 0;
    elements.forEach(function (spec, idx) {
      if (!spec.enter) return;
      var el = spec.id ? self._elementMap[spec.id] : self.stageEl.children[idx];
      if (!el) return;
      var enterDelay = (spec.enter.delay || 0) * 1000 + delay;
      var dur = (spec.enter.duration || 0.5) * 1000;
      var easingName = spec.enter.easing || "easeOut";

      setTimeout(function () {
        // opacity 入场
        var opacityTween = new Tween({
          from: 0, to: spec.opacity != null ? spec.opacity : 1,
          duration: dur, easing: easingName,
          onUpdate: function (v) { el.setAttribute("opacity", v); },
        });
        self.tweens.push(opacityTween);

        // 位移入场
        if (spec.enter.from_x != null) {
          var tx = new Tween({
            from: { x: spec.enter.from_x, y: spec.enter.from_y || 0 },
            to: { x: 0, y: 0 },
            duration: dur, easing: easingName,
            onUpdate: function (v) {
              el.setAttribute("transform", "translate(" + v.x + "," + v.y + ")");
            },
            onComplete: function () { el.removeAttribute("transform"); },
          });
          self.tweens.push(tx);
        }

        // 缩放入场
        if (spec.enter.from_scale != null) {
          var cx2 = spec.cx || (spec.x + (spec.w || 0) / 2) || 300;
          var cy2 = spec.cy || (spec.y + (spec.h || 0) / 2) || 180;
          var scaleTween = new Tween({
            from: spec.enter.from_scale, to: 1,
            duration: dur, easing: easingName,
            onUpdate: function (v) {
              el.setAttribute("transform", "translate(" + cx2 + "," + cy2 + ") scale(" + v + ") translate(-" + cx2 + ",-" + cy2 + ")");
            },
            onComplete: function () { el.removeAttribute("transform"); },
          });
          self.tweens.push(scaleTween);
        }
      }, enterDelay);
    });
  };

  AnimationRuntime.prototype._tick = function (now) {
    this.tweens = this.tweens.filter(function (t) { return !t.done; });
    this.tweens.forEach(function (t) { t.tick(now); });
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  };

  AnimationRuntime.prototype._scheduleFrames = function () {
    var self = this;
    var frames = this.spec.frames || [];
    var frameDuration = (this.spec.frame_duration || 3) * 1000;

    this._renderFrame(frames[0] || {});
    this._buildHUD();

    frames.forEach(function (frame, i) {
      if (i === 0) return;
      var timer = setTimeout(function () {
        self.frameIndex = i;
        self._renderFrame(frame);
        self._buildHUD();

        // 最后一帧结束后发送完成信号
        if (i === frames.length - 1) {
          setTimeout(function () {
            try {
              window.parent.postMessage({ type: "STEP_COMPLETE" }, "*");
            } catch (e) {}
          }, frameDuration);
        }
      }, i * frameDuration);
      self._frameTimers.push(timer);
    });

    // 仅一帧也要发完成信号
    if (frames.length <= 1) {
      var timer2 = setTimeout(function () {
        try { window.parent.postMessage({ type: "STEP_COMPLETE" }, "*"); } catch (e) {}
      }, frameDuration);
      self._frameTimers.push(timer2);
    }
  };

  AnimationRuntime.prototype.play = function () {
    this._buildSVG();
    this._scheduleFrames();
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  };

  AnimationRuntime.prototype.destroy = function () {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this._frameTimers.forEach(function (t) { clearTimeout(t); });
    this._frameTimers = [];
    this.tweens = [];
  };

  global.AnimationRuntime = AnimationRuntime;
})(typeof window !== "undefined" ? window : this);
