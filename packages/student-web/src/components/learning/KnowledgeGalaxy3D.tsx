"use client"

/**
 * 知识宇宙 3D 视图 (裸 three.js) — 学科星系 / 力导向球。
 *
 * 每个学科是一团节点星群, 围绕中心按角度扇区分布; 点亮的概念叶发光 (学科色),
 * 未点亮的暗淡。可拖拽旋转 + 滚轮缩放 + 自动缓慢自转 ("知识宇宙"感)。
 *
 * 必须经 next/dynamic ssr:false 加载 (three 依赖 window)。节点位置用 id hash
 * 确定性生成 (不用 Math.random, 避免重渲抖动)。
 */

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { PlatformTree } from "@/lib/api"

interface LitInfo {
  sources: string[]
  detail: string
}

interface Props {
  platformTree: PlatformTree
  litByNodeId: Map<string, LitInfo>
  height?: number
}

// 确定性 hash → [0,1)
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "")
  const v = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

export default function KnowledgeGalaxy3D({ platformTree, litByNodeId, height = 540 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = mount.clientWidth
    const H = height

    // ── scene / camera / renderer ──
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#15110d")

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000)
    camera.position.set(0, 8, 46)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controls.minDistance = 18
    controls.maxDistance = 90

    // 微光环境
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    // ── 节点星系 ──
    const subjects = platformTree.subjects
    const nSub = subjects.length
    const RING = 22 // 学科团中心距原点

    const litPositions: number[] = []
    const litColors: number[] = []
    const dimPositions: number[] = []

    subjects.forEach((s, si) => {
      // 学科团中心: 围圆周分布 + 上下错落
      const ang = (si / nSub) * Math.PI * 2
      const cx = Math.cos(ang) * RING
      const cz = Math.sin(ang) * RING
      const cy = (hash01(s.id, 7) - 0.5) * 14
      const [r, g, b] = hexToRgb(s.color || "#888888")

      s.nodes.forEach((n) => {
        // 团内位置: id hash → 球面随机散布, 半径 3~7
        const u = hash01(n.id, 1)
        const v = hash01(n.id, 2)
        const rad = 3 + hash01(n.id, 3) * 4.5
        const theta = u * Math.PI * 2
        const phi = Math.acos(2 * v - 1)
        const x = cx + rad * Math.sin(phi) * Math.cos(theta)
        const y = cy + rad * Math.sin(phi) * Math.sin(theta)
        const z = cz + rad * Math.cos(phi)
        if (litByNodeId.has(n.id)) {
          litPositions.push(x, y, z)
          litColors.push(r, g, b)
        } else {
          dimPositions.push(x, y, z)
        }
      })
    })

    // 未点亮: 暗灰小点
    if (dimPositions.length) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(dimPositions, 3))
      const mat = new THREE.PointsMaterial({
        color: 0x4a4136, size: 0.45, transparent: true, opacity: 0.5, sizeAttenuation: true,
      })
      scene.add(new THREE.Points(geo, mat))
    }

    // 点亮: 学科色发光大点
    if (litPositions.length) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(litPositions, 3))
      geo.setAttribute("color", new THREE.Float32BufferAttribute(litColors, 3))
      const mat = new THREE.PointsMaterial({
        size: 1.4, vertexColors: true, transparent: true, opacity: 0.95,
        sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      scene.add(new THREE.Points(geo, mat))
    }

    // 远景星尘 (氛围)
    const dust: number[] = []
    for (let i = 0; i < 400; i++) {
      dust.push((hash01("d" + i, 1) - 0.5) * 160, (hash01("d" + i, 2) - 0.5) * 160, (hash01("d" + i, 3) - 0.5) * 160)
    }
    const dgeo = new THREE.BufferGeometry()
    dgeo.setAttribute("position", new THREE.Float32BufferAttribute(dust, 3))
    scene.add(new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0x6b6557, size: 0.25, transparent: true, opacity: 0.3 })))

    // ── 动画循环 ──
    let raf = 0
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    // resize
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
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [platformTree, litByNodeId, height])

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "#15110d",
        cursor: "grab",
      }}
    />
  )
}
