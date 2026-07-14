"use client"

/**
 * 全学科知识星图 3D 画布 (裸 three.js + OrbitControls) — spec 044 后续。
 * 消费 concept-galaxy.json 的 2D 布局 (x=学科聚类, y=学段分层), 加确定性 hash 的 z 轴散开;
 * 暖纸场景 (Industrial Atelier), 可旋转/缩放/平移, raycaster 拾取, 筛选高亮不重建场景。
 * 必须经 next/dynamic ssr:false 加载 (three 不可 SSR)。
 */

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { GalaxyPayload, GradeBand } from "@/lib/galaxy/types"
import type { Expansion, NeighborItem } from "./ConceptGalaxy"

interface Props {
  payload: GalaxyPayload
  highlightSet: Set<string>
  dimOthers: boolean
  /** 筛选时未选中节点的处理: dim=淡化, hide=完全隐藏 */
  filterMode: "dim" | "hide"
  /** 节点散开系数 (水平向), 缓解 3D 星团内部遮挡 */
  spread: number
  litByConcept: Set<string>
  selId: string | null
  onSelect: (id: string | null) => void
  /** spec 045: 图外扩展 (暗物质节点) */
  expansion: Expansion | null
  expSelQ: string | null
  onExpSelect: (item: NeighborItem | null) => void
}

const PAPER = new THREE.Color("#FAF9F5")
const BANDS: GradeBand[] = ["university", "high", "middle", "elementary"]

function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

// 2D emit 布局 → 3D 坐标: x 保留学科聚类, y 学段翻转向上, z hash 散开
function to3D(c: { id: string; x: number; y: number }, L: GalaxyPayload["layout"]) {
  return new THREE.Vector3(
    (c.x - L.VW * 0.63) * 0.062,
    (L.VH * 0.5 - c.y) * 0.055,
    (hash01(c.id, 5) - 0.5) * 26,
  )
}

interface SceneRefs {
  scene: THREE.Scene
  litGroup: THREE.Group
  metas: { id: string; color: string; baseScale: number }[]
  basePositions: THREE.Vector3[]
  positions: THREE.Vector3[]
  idxById: Map<string, number>
  mesh: THREE.InstancedMesh
  hotLines: THREE.LineSegments
  hotGeo: THREE.BufferGeometry
  dimGeo: THREE.BufferGeometry
  edgeIdx: [number, number][]
  dimLineMat: THREE.LineBasicMaterial
  selHalo: THREE.Sprite
  labelWrap: HTMLDivElement
  expLabelWrap: HTMLDivElement
  // 扩展组 (spec 045): sprites 供 raycast, 由扩展 effect 填充
  expGroup: THREE.Group
  expSprites: THREE.Sprite[]
  expItems: NeighborItem[]
  expPositions: THREE.Vector3[]
}

export default function ConceptGalaxyCanvas3D({ payload, highlightSet, dimOthers, filterMode, spread, litByConcept, selId, onSelect, expansion, expSelQ, onExpSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const refs = useRef<SceneRefs | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onExpSelectRef = useRef(onExpSelect)
  onExpSelectRef.current = onExpSelect
  // 高亮状态给场景 effect 里的闭包读 (label 投影)
  const hiRef = useRef({ highlightSet, dimOthers })
  hiRef.current = { highlightSet, dimOthers }

  // ── 场景构建 (payload 变才重建) ──
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const L = payload.layout
    let W = mount.clientWidth || 800
    let H = mount.clientHeight || 640

    const scene = new THREE.Scene()
    // 暖纸渐变背景 (上白下暖纸), 融入站点主题
    const bgCanvas = document.createElement("canvas")
    bgCanvas.width = 2
    bgCanvas.height = 256
    const bgctx = bgCanvas.getContext("2d")!
    const grad = bgctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, "#FFFFFF")
    grad.addColorStop(0.55, "#FAF9F5")
    grad.addColorStop(1, "#F1EDDF")
    bgctx.fillStyle = grad
    bgctx.fillRect(0, 0, 2, 256)
    scene.background = new THREE.CanvasTexture(bgCanvas)
    scene.fog = new THREE.FogExp2(0xfaf9f5, 0.006)

    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 1000)
    camera.position.set(0, 6, 62)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3
    controls.minDistance = 14
    controls.maxDistance = 130

    // 无光照材质 (MeshBasicMaterial) 直接显示标称浅色, 深度感靠 fog; 光源仅备而不用
    scene.add(new THREE.AmbientLight(0xffffff, 1.0))

    // ── 节点 ──
    const concepts = payload.concepts
    const N = concepts.length
    const metas: SceneRefs["metas"] = []
    const basePositions: THREE.Vector3[] = []
    const positions: THREE.Vector3[] = []
    const idxById = new Map<string, number>()
    concepts.forEach((c, i) => {
      const p = to3D(c, L)
      basePositions.push(p)
      positions.push(p.clone())
      metas.push({
        id: c.id,
        color: payload.subj_color[c.subj] || "#888",
        baseScale: 0.42 + Math.min(1.0, (c.p.length - 1) * 0.22),
      })
      idxById.set(c.id, i)
    })

    const geo = new THREE.SphereGeometry(1, 14, 14)
    // Basic 材质无光照: 浅色系标称色原样呈现, 不被阴影压深
    const mat = new THREE.MeshBasicMaterial()
    const mesh = new THREE.InstancedMesh(geo, mat, N)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
    scene.add(mesh)

    // ── 边: 常规淡线 (spread 变化时重填) + hot 高亮线 (筛选时动态填充) ──
    const edgeIdx: [number, number][] = []
    for (const [a, b] of payload.edges) {
      const ia = idxById.get(a), ib = idxById.get(b)
      if (ia === undefined || ib === undefined) continue
      edgeIdx.push([ia, ib])
    }
    const dimPos: number[] = []
    for (const [ia, ib] of edgeIdx) {
      const pa = positions[ia], pb = positions[ib]
      dimPos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
    }
    const dimGeo = new THREE.BufferGeometry()
    dimGeo.setAttribute("position", new THREE.Float32BufferAttribute(dimPos, 3))
    const dimLineMat = new THREE.LineBasicMaterial({ color: 0x9d978a, transparent: true, opacity: 0.14 })
    scene.add(new THREE.LineSegments(dimGeo, dimLineMat))

    const hotGeo = new THREE.BufferGeometry()
    hotGeo.setAttribute("position", new THREE.Float32BufferAttribute([], 3))
    const hotLines = new THREE.LineSegments(
      hotGeo,
      new THREE.LineBasicMaterial({ color: 0xd97757, transparent: true, opacity: 0.5 }),
    )
    scene.add(hotLines)

    // ── 学段参考环 + 标签 ──
    const bandLabelEls: { el: HTMLDivElement; pos: THREE.Vector3 }[] = []
    BANDS.forEach((b) => {
      const y = (L.VH * 0.5 - L.bandY[b]) * 0.055
      const ringPts: THREE.Vector3[] = []
      const R = 42
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * Math.PI * 2
        ringPts.push(new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R))
      }
      const rg = new THREE.BufferGeometry().setFromPoints(ringPts)
      scene.add(new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0xd9d1bd, transparent: true, opacity: 0.5 })))
      const el = document.createElement("div")
      el.textContent = L.band_label[b]
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-50%);font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--sub-2);pointer-events:none;white-space:nowrap;"
      mount.appendChild(el)
      bandLabelEls.push({ el, pos: new THREE.Vector3(R, y, 0) })
    })

    // ── 选中光环 ──
    const selHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeRingTexture(), color: 0x191814, transparent: true, opacity: 0.9, depthTest: false }),
    )
    selHalo.visible = false
    scene.add(selHalo)

    // ── 我点亮的知识光环组 (coral ring, 无筛选时显示) ──
    const litGroup = new THREE.Group()
    scene.add(litGroup)

    // ── 高亮概念标签容器 (筛选时投影显示) ──
    const labelWrap = document.createElement("div")
    labelWrap.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;"
    mount.appendChild(labelWrap)

    // ── 图外扩展组 (spec 045): 由扩展 effect 填充 ──
    const expGroup = new THREE.Group()
    scene.add(expGroup)
    const expLabelWrap = document.createElement("div")
    expLabelWrap.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;"
    mount.appendChild(expLabelWrap)

    refs.current = {
      scene, litGroup, metas, basePositions, positions, idxById, mesh, hotLines, hotGeo, dimGeo, edgeIdx,
      dimLineMat, selHalo, labelWrap, expLabelWrap, expGroup, expSprites: [], expItems: [], expPositions: [],
    }

    // ── 拾取 ──
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoverIdx = -1
    let downXY: [number, number] | null = null
    const dummy = new THREE.Object3D()

    const scaleOf = (i: number) => {
      const { highlightSet: hs, dimOthers: dim } = hiRef.current
      let s = metas[i].baseScale
      if (dim && hs.has(metas[i].id)) s *= 1.25
      return s
    }
    function applyScale(i: number, factor: number) {
      if (i < 0) return
      dummy.position.copy(positions[i])
      dummy.scale.setScalar(scaleOf(i) * factor)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.instanceMatrix.needsUpdate = true
    }
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
    function onMove(ev: PointerEvent) {
      setPointer(ev)
      const idx = pick()
      if (idx !== hoverIdx) {
        applyScale(hoverIdx, 1)
        if (idx >= 0) applyScale(idx, 1.5)
        hoverIdx = idx
        renderer.domElement.style.cursor = idx >= 0 ? "pointer" : "grab"
      }
    }
    function onDown(ev: PointerEvent) {
      downXY = [ev.clientX, ev.clientY]
    }
    function onUp(ev: PointerEvent) {
      // 拖拽旋转不算点击 (位移 > 5px 忽略)
      if (!downXY) return
      const moved = Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1])
      downXY = null
      if (moved > 5) return
      setPointer(ev)
      raycaster.setFromCamera(pointer, camera)
      // 扩展点 (暗物质 sprite) 优先拾取
      const r = refs.current
      if (r && r.expSprites.length) {
        const hit = raycaster.intersectObjects(r.expSprites)
        if (hit.length) {
          const i = r.expSprites.indexOf(hit[0].object as THREE.Sprite)
          if (i >= 0) { onExpSelectRef.current(r.expItems[i]); return }
        }
      }
      const idx = pick()
      onSelectRef.current(idx >= 0 ? metas[idx].id : null)
    }
    renderer.domElement.addEventListener("pointermove", onMove)
    renderer.domElement.addEventListener("pointerdown", onDown)
    renderer.domElement.addEventListener("pointerup", onUp)

    // ── 渲染循环 (含 overlay 投影) ──
    let raf = 0
    const tmp = new THREE.Vector3()
    const tick = () => {
      controls.update()
      for (const { el, pos } of bandLabelEls) {
        tmp.copy(pos).project(camera)
        const sx = (tmp.x * 0.5 + 0.5) * W
        // 转到左侧 hero 文案区时隐藏, 避免压字
        if (tmp.z > 1 || sx < W * 0.42) { el.style.display = "none"; continue }
        el.style.display = "block"
        el.style.left = `${sx}px`
        el.style.top = `${(-tmp.y * 0.5 + 0.5) * H}px`
      }
      // 高亮概念标签投影
      const kids = labelWrap.children
      for (let k = 0; k < kids.length; k++) {
        const el = kids[k] as HTMLDivElement
        const i = Number(el.dataset.idx)
        tmp.copy(positions[i]).project(camera)
        if (tmp.z > 1) { el.style.display = "none"; continue }
        el.style.display = "block"
        el.style.left = `${(tmp.x * 0.5 + 0.5) * W}px`
        el.style.top = `${(-tmp.y * 0.5 + 0.5) * H - 12}px`
      }
      // 扩展点标签投影
      const r2 = refs.current
      if (r2) {
        const eKids = expLabelWrap.children
        for (let k = 0; k < eKids.length; k++) {
          const el = eKids[k] as HTMLDivElement
          const i = Number(el.dataset.idx)
          if (!r2.expPositions[i]) { el.style.display = "none"; continue }
          tmp.copy(r2.expPositions[i]).project(camera)
          if (tmp.z > 1) { el.style.display = "none"; continue }
          el.style.display = "block"
          el.style.left = `${(tmp.x * 0.5 + 0.5) * W}px`
          el.style.top = `${(-tmp.y * 0.5 + 0.5) * H - 13}px`
        }
      }
      if (selHalo.visible) selHalo.quaternion.copy(camera.quaternion)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    const ro = new ResizeObserver(() => {
      W = mount.clientWidth || W
      H = mount.clientHeight || H
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener("pointermove", onMove)
      renderer.domElement.removeEventListener("pointerdown", onDown)
      renderer.domElement.removeEventListener("pointerup", onUp)
      bandLabelEls.forEach(({ el }) => el.remove())
      labelWrap.remove()
      expLabelWrap.remove()
      controls.dispose()
      geo.dispose()
      mat.dispose()
      dimGeo.dispose()
      hotGeo.dispose()
      renderer.dispose()
      refs.current = null
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  // ── 散开系数变化: 重算节点位置 + 常规边几何 (声明在高亮 effect 之前, 保证其读到新 positions) ──
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const { basePositions, positions, dimGeo, edgeIdx } = r
    for (let i = 0; i < positions.length; i++) {
      const b = basePositions[i]
      positions[i].set(b.x * spread, b.y, b.z * spread) // 只水平散开, y 保学段语义
    }
    const dimPos = new Float32Array(edgeIdx.length * 6)
    edgeIdx.forEach(([ia, ib], k) => {
      const pa = positions[ia], pb = positions[ib]
      dimPos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], k * 6)
    })
    dimGeo.setAttribute("position", new THREE.BufferAttribute(dimPos, 3))
    dimGeo.attributes.position.needsUpdate = true
  }, [payload, spread])

  // ── 高亮/点亮/选中/散开 变化: 更新颜色、缩放、hot 边、标签 (不重建场景) ──
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const { litGroup, metas, positions, idxById, mesh, hotGeo, hotLines, dimLineMat, selHalo, labelWrap } = r
    const hide = dimOthers && filterMode === "hide"
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < metas.length; i++) {
      const m = metas[i]
      const on = highlightSet.has(m.id)
      col.set(m.color)
      if (dimOthers && !on) col.lerp(PAPER, 0.86)
      // 登录且有点亮数据时: 未点亮的明显淡化, 点亮的保持本色 (配合 coral 光环)
      else if (!dimOthers && litByConcept.size && !litByConcept.has(m.id)) col.lerp(PAPER, 0.55)
      mesh.setColorAt(i, col)
      // hide 模式: 未选中节点缩放归零 (不渲染也不可拾取)
      const s = hide && !on ? 0 : m.baseScale * (dimOthers && on ? 1.25 : 1) * (selId === m.id ? 1.5 : 1)
      dummy.position.copy(positions[i])
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
    // InstancedMesh 的 boundingSphere 在首次 raycast 时缓存; 矩阵更新后必须重算,
    // 否则 raycast 预筛用的还是"全部球在原点"的半径 1 小球 → 拾取永远 miss
    mesh.computeBoundingSphere()

    // hot 边: 两端都在高亮集合
    const hot: number[] = []
    if (dimOthers) {
      for (const [a, b] of payload.edges) {
        if (!highlightSet.has(a) || !highlightSet.has(b)) continue
        const ia = idxById.get(a), ib = idxById.get(b)
        if (ia === undefined || ib === undefined) continue
        const pa = positions[ia], pb = positions[ib]
        hot.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
      }
    }
    hotGeo.setAttribute("position", new THREE.Float32BufferAttribute(hot, 3))
    hotGeo.attributes.position.needsUpdate = true
    hotLines.visible = hot.length > 0
    dimLineMat.opacity = hide ? 0 : dimOthers ? 0.05 : 0.14

    // 选中光环
    const si = selId ? idxById.get(selId) : undefined
    if (si !== undefined && selId) {
      selHalo.position.copy(positions[si])
      const m = metas[si]
      selHalo.scale.setScalar(m.baseScale * 4.2)
      selHalo.visible = true
    } else {
      selHalo.visible = false
    }

    // 我点亮的知识: coral 光环 (无筛选时显示; 筛选态由高亮机制表达, 光环撤下防混淆)
    while (litGroup.children.length) {
      const child = litGroup.children[0] as THREE.Sprite
      litGroup.remove(child)
      child.material.dispose()
    }
    if (!dimOthers && litByConcept.size) {
      for (let i = 0; i < metas.length; i++) {
        if (!litByConcept.has(metas[i].id)) continue
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: makeRingTexture(), color: 0xd97757, transparent: true, opacity: 0.9, depthTest: false,
        }))
        halo.position.copy(positions[i])
        halo.scale.setScalar(metas[i].baseScale * 3.4)
        litGroup.add(halo)
      }
    }

    // 高亮标签 (只给被 >=2 项目共享的点, 上限 70 防挤爆)
    labelWrap.innerHTML = ""
    if (dimOthers) {
      let n = 0
      for (const c of payload.concepts) {
        if (n >= 70) break
        if (!highlightSet.has(c.id) || c.p.length < 2) continue
        const el = document.createElement("div")
        el.dataset.idx = String(idxById.get(c.id))
        const zh = c.zh.replace(/（[^）]*）|\([^)]*\)/g, "")
        el.textContent = zh.length > 7 ? zh.slice(0, 6) + "…" : zh
        el.style.cssText =
          "position:absolute;transform:translate(-50%,-100%);font-size:10px;color:#191814;text-shadow:0 0 3px #FAF9F5,0 0 3px #FAF9F5,0 0 4px #FAF9F5;pointer-events:none;white-space:nowrap;"
        labelWrap.appendChild(el)
        n++
      }
    }
  }, [payload, highlightSet, dimOthers, filterMode, spread, litByConcept, selId])

  // ── 图外扩展变化: 重建暗物质组 (空心 sprite + 虚线放射 + 标签) ──
  useEffect(() => {
    const r = refs.current
    if (!r) return
    const { expGroup, expLabelWrap, idxById, positions } = r
    // 清旧
    while (expGroup.children.length) {
      const child = expGroup.children[0] as THREE.Sprite | THREE.Line
      expGroup.remove(child)
      if ((child as THREE.Line).geometry) (child as THREE.Line).geometry.dispose()
      const m = (child as THREE.Sprite).material as THREE.Material | undefined
      if (m) m.dispose()
    }
    expLabelWrap.innerHTML = ""
    r.expSprites = []
    r.expItems = []
    r.expPositions = []
    if (!expansion) return
    const ci = idxById.get(expansion.centerId)
    if (ci === undefined) return
    const center = positions[ci]
    const n = expansion.items.length
    expansion.items.forEach((it, i) => {
      // 黄金角球面放射, 半径分两圈
      const ang = i * 2.399963 // golden angle
      const rad = 6.5 + (i % 2) * 2.5
      const elev = ((i % 5) - 2) * 0.35
      const pos = new THREE.Vector3(
        center.x + Math.cos(ang) * rad,
        center.y + elev * 2.2,
        center.z + Math.sin(ang) * rad,
      )
      const on = expSelQ === it.q
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeRingTexture(),
        color: on ? 0xd97757 : 0x8a857a,
        transparent: true,
        opacity: on ? 1 : 0.85,
        depthTest: false,
      }))
      sp.position.copy(pos)
      sp.scale.setScalar(on ? 1.7 : 1.2)
      expGroup.add(sp)
      // 虚线边
      const g = new THREE.BufferGeometry().setFromPoints([center, pos])
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({
        color: 0x8a857a, transparent: true, opacity: 0.55, dashSize: 0.5, gapSize: 0.4,
      }))
      line.computeLineDistances()
      expGroup.add(line)
      r.expSprites.push(sp)
      r.expItems.push(it)
      r.expPositions.push(pos)
      // 标签
      const el = document.createElement("div")
      el.dataset.idx = String(i)
      const name = it.zh || it.en
      el.textContent = name.length > 8 ? name.slice(0, 7) + "…" : name
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);font-size:10px;color:#6B6557;text-shadow:0 0 3px #FAF9F5,0 0 3px #FAF9F5;pointer-events:none;white-space:nowrap;"
      expLabelWrap.appendChild(el)
    })
    void n
  }, [expansion, expSelQ, payload, spread])

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, cursor: "grab" }} />
}

// 圆环贴图 (选中光环)
let _ringTex: THREE.Texture | null = null
function makeRingTexture(): THREE.Texture {
  if (_ringTex) return _ringTex
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const ctx = c.getContext("2d")!
  ctx.strokeStyle = "rgba(255,255,255,1)"
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(32, 32, 26, 0, Math.PI * 2)
  ctx.stroke()
  _ringTex = new THREE.CanvasTexture(c)
  return _ringTex
}
