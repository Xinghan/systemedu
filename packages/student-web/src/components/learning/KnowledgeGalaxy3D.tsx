"use client"

/**
 * 知识宇宙 3D 视图 (裸 three.js) — 学科星系, 可拾取节点。
 *
 * - 节点用 InstancedMesh 球体 (圆形 + 可 raycaster 拾取 + 发光), 替代方形 Points
 * - 点亮概念叶发光 (学科色), 未点亮暗淡小球
 * - hover: 节点放大高亮; click: 弹出信息面板 (节点名 + 学科 + 溯源)
 * - 学科名标签 (SVG overlay, 跟随 3D 投影)
 * - 暖深空渐变背景 (非死黑) + 远景星尘 + 自动自转
 *
 * 必须经 next/dynamic ssr:false 加载。节点位置用 id hash 确定性布局。
 */

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { PlatformTree } from "@/lib/api"

interface LitInfo {
  sources: string[]
  detail: string
}

type GrownChild = { node_id: string; name_zh: string; depth: number; lit: boolean }

interface Props {
  platformTree: PlatformTree
  litByNodeId: Map<string, LitInfo>
  grownByParent?: Map<string, GrownChild[]>
  height?: number
  onNodeClick?: (knodeId: string, slug?: string) => void
}

interface NodeMeta {
  id: string
  name: string
  subjectName: string
  color: string
  lit: boolean
  detail: string
  sources: string[]
}

function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

interface SelInfo {
  meta: NodeMeta
  x: number
  y: number
}

export default function KnowledgeGalaxy3D({ platformTree, litByNodeId, grownByParent, height = 560, onNodeClick }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<SelInfo | null>(null)
  const onClickRef = useRef(onNodeClick)
  onClickRef.current = onNodeClick

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = mount.clientWidth
    const H = height

    const scene = new THREE.Scene()
    // 暖深空: 顶部深棕、底部更深, 渐变背景 (CanvasTexture)
    const bgCanvas = document.createElement("canvas")
    bgCanvas.width = 2
    bgCanvas.height = 256
    const bgctx = bgCanvas.getContext("2d")!
    const grad = bgctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, "#202a4d")   // 深空蓝紫 — 衬托发光线/节点对比更好
    grad.addColorStop(0.5, "#151b35")
    grad.addColorStop(1, "#0c0f22")
    bgctx.fillStyle = grad
    bgctx.fillRect(0, 0, 2, 256)
    scene.background = new THREE.CanvasTexture(bgCanvas)
    scene.fog = new THREE.FogExp2(0x0c0f22, 0.010)

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000)
    camera.position.set(0, 8, 48)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.minDistance = 16
    controls.maxDistance = 95

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const pl = new THREE.PointLight(0xffe6c0, 1.2, 200)
    pl.position.set(0, 30, 20)
    scene.add(pl)

    // ── 节点布局 + meta ──
    const subjects = platformTree.subjects
    const nSub = subjects.length
    const RING = 23
    const metas: NodeMeta[] = []
    const positions: THREE.Vector3[] = []
    const subjectCenters: { name: string; pos: THREE.Vector3; color: string }[] = []
    // id → {位置, 学科名, 色} — 供生长节点挂在父附近
    const posById = new Map<string, { pos: THREE.Vector3; subjectName: string; color: string }>()

    subjects.forEach((s, si) => {
      const ang = (si / nSub) * Math.PI * 2
      const cx = Math.cos(ang) * RING
      const cz = Math.sin(ang) * RING
      const cy = (hash01(s.id, 7) - 0.5) * 12
      const center = new THREE.Vector3(cx, cy + 8, cz)
      subjectCenters.push({ name: s.name_zh, pos: center, color: s.color || "#cccccc" })
      s.nodes.forEach((n) => {
        const u = hash01(n.id, 1), v = hash01(n.id, 2)
        const rad = 3 + hash01(n.id, 3) * 4.5
        const theta = u * Math.PI * 2
        const phi = Math.acos(2 * v - 1)
        const pos = new THREE.Vector3(
          cx + rad * Math.sin(phi) * Math.cos(theta),
          cy + rad * Math.sin(phi) * Math.sin(theta),
          cz + rad * Math.cos(phi),
        )
        positions.push(pos)
        const li = litByNodeId.get(n.id)
        metas.push({
          id: n.id, name: n.name_zh, subjectName: s.name_zh,
          color: s.color || "#cccccc", lit: !!li,
          detail: li?.detail || "", sources: li?.sources || [],
        })
        posById.set(n.id, { pos, subjectName: s.name_zh, color: s.color || "#cccccc" })
      })
    })

    // spec 039: 挂生长节点 — 位置在父节点附近 (id hash 偏移), 递归任意深度
    if (grownByParent) {
      const mountGrown = (parentId: string) => {
        const kids = grownByParent.get(parentId) || []
        const pinfo = posById.get(parentId)
        if (!pinfo) return
        kids.forEach((c) => {
          const off = 1.6
          const pos = new THREE.Vector3(
            pinfo.pos.x + (hash01(c.node_id, 1) - 0.5) * off * 2,
            pinfo.pos.y + (hash01(c.node_id, 2) - 0.5) * off * 2,
            pinfo.pos.z + (hash01(c.node_id, 3) - 0.5) * off * 2,
          )
          positions.push(pos)
          metas.push({
            id: c.node_id, name: c.name_zh, subjectName: pinfo.subjectName,
            color: pinfo.color, lit: c.lit,
            detail: c.lit ? "你深入学到的知识点 (个人生长)" : "待点亮 (个人生长)",
            sources: [],
          })
          posById.set(c.node_id, { pos, subjectName: pinfo.subjectName, color: pinfo.color })
          mountGrown(c.node_id)  // 递归更深
        })
      }
      // 从平台节点启动 (递归覆盖深层生长; 不直接遍历 keys 以保证父先于子挂载)
      const platformIds = [...posById.keys()]
      for (const pid of platformIds) mountGrown(pid)
    }

    // ── 关系连线 (前置依赖 + 树骨架) ──
    const litIds = new Set(metas.filter((m) => m.lit).map((m) => m.id))
    const dimEdge: number[] = []   // 普通边
    const litEdge: number[] = []   // 两端都点亮的边 (高亮)
    const litEdgeCol: number[] = []
    const pushEdge = (aId: string, bId: string, color: string) => {
      const a = posById.get(aId), b = posById.get(bId)
      if (!a || !b) return
      if (litIds.has(aId) && litIds.has(bId)) {
        litEdge.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z)
        const c = new THREE.Color(color)
        litEdgeCol.push(c.r, c.g, c.b, c.r, c.g, c.b)
      } else {
        dimEdge.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z)
      }
    }
    // 1) 前置依赖边 (node ← prerequisites)
    subjects.forEach((s) => {
      s.nodes.forEach((n) => {
        let pr = (n as { prerequisites?: string[] }).prerequisites || []
        if (typeof pr === "string") { try { pr = JSON.parse(pr) } catch { pr = [] } }
        for (const p of pr) pushEdge(p, n.id, s.color || "#888")
      })
    })
    // 2) 树骨架边: 学科中心 → 该学科每个节点 (学科归属辐射)
    subjects.forEach((s, si) => {
      const ang = (si / nSub) * Math.PI * 2
      const center = new THREE.Vector3(Math.cos(ang) * RING, (hash01(s.id, 7) - 0.5) * 12 + 8, Math.sin(ang) * RING)
      s.nodes.forEach((n) => {
        const a = posById.get(n.id)
        if (a) dimEdge.push(center.x, center.y, center.z, a.pos.x, a.pos.y, a.pos.z)
      })
    })
    // 3) 生长节点 parent→child 边
    if (grownByParent) {
      for (const [pid, kids] of grownByParent) for (const c of kids) pushEdge(pid, c.node_id, "#D97757")
    }
    // 渲染线
    if (dimEdge.length) {
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(dimEdge, 3))
      scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        color: 0x6c7cb0, transparent: true, opacity: 0.32,  /* 冷蓝, 深空底上可见 */
      })))
    }
    if (litEdge.length) {
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(litEdge, 3))
      g.setAttribute("color", new THREE.Float32BufferAttribute(litEdgeCol, 3))
      scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
      })))
    }

    const N = metas.length

    // ── InstancedMesh 球 ──
    const geo = new THREE.SphereGeometry(1, 12, 12)
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: false, emissiveIntensity: 1.0, roughness: 0.4, metalness: 0.1,
    })
    // 用 instanceColor + 自发光近似: 点亮球颜色亮+大, 未亮暗+小
    const mesh = new THREE.InstancedMesh(geo, mat, N)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    const baseScale: number[] = []
    for (let i = 0; i < N; i++) {
      const m = metas[i]
      const sc = m.lit ? 0.62 : 0.28
      baseScale.push(sc)
      dummy.position.copy(positions[i])
      dummy.scale.setScalar(sc)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (m.lit) col.set(m.color)
      else col.setRGB(0.42, 0.46, 0.62)  /* 未亮球: 蓝灰, 深空底上能看见 */
      mesh.setColorAt(i, col)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)

    // 点亮节点叠一层发光精灵 (additive 光晕)
    const litIdx = metas.map((m, i) => (m.lit ? i : -1)).filter((i) => i >= 0)
    if (litIdx.length) {
      const gp: number[] = [], gc: number[] = []
      litIdx.forEach((i) => {
        gp.push(positions[i].x, positions[i].y, positions[i].z)
        col.set(metas[i].color)
        gc.push(col.r, col.g, col.b)
      })
      const ggeo = new THREE.BufferGeometry()
      ggeo.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3))
      ggeo.setAttribute("color", new THREE.Float32BufferAttribute(gc, 3))
      const glow = new THREE.Points(ggeo, new THREE.PointsMaterial({
        size: 3.4, vertexColors: true, transparent: true, opacity: 0.5,
        sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
        map: makeGlowTexture(),
      }))
      scene.add(glow)
    }

    // 远景星尘
    const dust: number[] = []
    for (let i = 0; i < 350; i++)
      dust.push((hash01("d" + i, 1) - 0.5) * 170, (hash01("d" + i, 2) - 0.5) * 170, (hash01("d" + i, 3) - 0.5) * 170)
    const dgeo = new THREE.BufferGeometry()
    dgeo.setAttribute("position", new THREE.Float32BufferAttribute(dust, 3))
    scene.add(new THREE.Points(dgeo, new THREE.PointsMaterial({
      color: 0x9aa6d4, size: 0.5, transparent: true, opacity: 0.4, map: makeGlowTexture(),
    })))

    // ── raycaster 拾取 ──
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoverIdx = -1

    function setPointer(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
    }
    function pick(): number {
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(mesh)
      return hit.length ? (hit[0].instanceId ?? -1) : -1
    }
    function applyScale(i: number, factor: number) {
      if (i < 0) return
      dummy.position.copy(positions[i])
      dummy.scale.setScalar(baseScale[i] * factor)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.instanceMatrix.needsUpdate = true
    }
    function onMove(ev: PointerEvent) {
      setPointer(ev)
      const idx = pick()
      if (idx !== hoverIdx) {
        applyScale(hoverIdx, 1)
        if (idx >= 0) applyScale(idx, 1.8)
        hoverIdx = idx
        renderer.domElement.style.cursor = idx >= 0 ? "pointer" : "grab"
      }
    }
    function onClick(ev: PointerEvent) {
      setPointer(ev)
      const idx = pick()
      if (idx >= 0) {
        const rect = renderer.domElement.getBoundingClientRect()
        setSel({ meta: metas[idx], x: ev.clientX - rect.left, y: ev.clientY - rect.top })
        // 点亮节点 → 可跳转
        const m = metas[idx]
        if (m.lit && m.sources[0] && onClickRef.current) {
          // 双击才跳, 单击只看信息; 这里单击只显示面板
        }
      } else {
        setSel(null)
      }
    }
    renderer.domElement.addEventListener("pointermove", onMove)
    renderer.domElement.addEventListener("pointerdown", onClick)

    // 投影学科标签
    const labelEls: HTMLDivElement[] = []
    subjectCenters.forEach((sc) => {
      const el = document.createElement("div")
      el.textContent = sc.name
      el.style.cssText = `position:absolute;transform:translate(-50%,-50%);font-size:12px;font-weight:600;color:${sc.color};text-shadow:0 1px 4px #000;pointer-events:none;white-space:nowrap;opacity:.9;`
      mount.appendChild(el)
      labelEls.push(el)
    })

    let raf = 0
    const tmp = new THREE.Vector3()
    const tick = () => {
      controls.update()
      // 更新标签位置
      subjectCenters.forEach((sc, i) => {
        tmp.copy(sc.pos).project(camera)
        const el = labelEls[i]
        if (tmp.z > 1) { el.style.display = "none"; return }
        el.style.display = "block"
        el.style.left = `${(tmp.x * 0.5 + 0.5) * W}px`
        el.style.top = `${(-tmp.y * 0.5 + 0.5) * H}px`
      })
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    const onResize = () => {
      const w = mount.clientWidth
      camera.aspect = w / H
      camera.updateProjectionMatrix()
      renderer.setSize(w, H)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      renderer.domElement.removeEventListener("pointermove", onMove)
      renderer.domElement.removeEventListener("pointerdown", onClick)
      labelEls.forEach((el) => el.remove())
      controls.dispose()
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [platformTree, litByNodeId, grownByParent, height])

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={mountRef}
        style={{
          width: "100%", height, borderRadius: 16, overflow: "hidden",
          border: "1px solid var(--border)", background: "#151b35", cursor: "grab",
          position: "relative",
        }}
      />
      {sel && (
        <div
          style={{
            position: "absolute", left: Math.min(sel.x + 12, 1000), top: sel.y + 12,
            maxWidth: 280, background: "var(--card)", border: "1px solid var(--border-2)",
            borderRadius: 10, boxShadow: "var(--shadow-lg)", padding: "12px 14px", zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: sel.meta.lit ? sel.meta.color : "var(--border-2)" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{sel.meta.name}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--sub-2)", marginBottom: 6 }}>
            {sel.meta.subjectName} · {sel.meta.lit ? "已点亮" : "未学"}
          </div>
          {sel.meta.lit ? (
            <p style={{ fontSize: 12.5, color: "var(--sub)", lineHeight: 1.5, margin: 0 }}>
              {sel.meta.detail || "你已学过这个知识点。"}
            </p>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--sub-2)", margin: 0 }}>
              还没点亮 — 学相关项目就会亮起来。
            </p>
          )}
          <button
            type="button"
            onClick={() => setSel(null)}
            style={{ marginTop: 8, fontSize: 11.5, color: "var(--primary)", background: "none", border: 0, cursor: "pointer", padding: 0 }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  )
}

// 圆形径向渐变发光贴图 (让点/球呈圆形光斑, 非方形)
let _glowTex: THREE.Texture | null = null
function makeGlowTexture(): THREE.Texture {
  if (_glowTex) return _glowTex
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.4, "rgba(255,255,255,0.6)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  _glowTex = new THREE.CanvasTexture(c)
  return _glowTex
}
