import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { ASSET, DURATION, type Part, stageAt } from "./content"

export type SceneController = {
  seek: (time: number) => void
  select: (part: Part | null) => void
  shell: (hidden: boolean) => void
  view: (preset: "follow" | "side" | "top") => void
  dispose: () => void
}
export async function createLandingScene(host: HTMLElement, onSelect: (part: Part) => void, onFailure: () => void, signal: AbortSignal): Promise<SceneController> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
  renderer.setClearColor(0xeee7db)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute("aria-label", "火星车着陆三维模型，可拖动旋转，滚轮缩放，点击部件查看说明")
  renderer.domElement.setAttribute("role", "img")
  renderer.domElement.dataset.marsCanvas = "true"
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xeee7db, 48, 90)
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 150)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.minDistance = 4; controls.maxDistance = 60
  controls.maxPolarAngle = Math.PI * .49
  controls.enablePan = false
  const sky = new THREE.HemisphereLight(0xfff4dc, 0x8e6652, 2.5); scene.add(sky)
  const sun = new THREE.DirectionalLight(0xfff1d7, 3.3)
  sun.position.set(-10, 22, 12); sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -22; sun.shadow.camera.right = 22
  sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -18; sun.shadow.camera.far = 70
  sun.shadow.normalBias = .03; scene.add(sun)
  const fill = new THREE.DirectionalLight(0xd9e7ed, 1.5); fill.position.set(10, 12, -12); scene.add(fill)
  let root: THREE.Group | null = null, mixer: THREE.AnimationMixer | null = null
  let disposed = false, visible = true, time = 25, follow = true, currentPhase = -1
  let selected: Part | null = null, shellHidden = false
  const draw = () => { if (!disposed && visible && !document.hidden) renderer.render(scene, camera) }
  const resize = () => {
    if (!host.clientWidth || !host.clientHeight) return
    renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight
    camera.updateProjectionMatrix(); if (follow) positionCamera("follow"); else draw()
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host)
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) draw() }); intersection.observe(host)
  const loss = (event: Event) => { event.preventDefault(); onFailure() }
  const visibility = () => { if (!document.hidden) draw() }
  renderer.domElement.addEventListener("webglcontextlost", loss)
  document.addEventListener("visibilitychange", visibility)
  controls.addEventListener("change", draw)
  const manual = () => { follow = false }; controls.addEventListener("start", manual)
  const partOf = (object: THREE.Object3D | null): Part | null => {
    while (object) { if (object.userData.part) return object.userData.part as Part; object = object.parent }
    return null
  }
  const pointerStart = new THREE.Vector2()
  const down = (event: PointerEvent) => { pointerStart.set(event.clientX, event.clientY) }
  const up = (event: PointerEvent) => {
    if (!root || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return
    const rect = renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
    const hit = ray.intersectObject(root).find(hit => {
      let obj: THREE.Object3D | null = hit.object
      while (obj) { if (!obj.visible) return false; obj = obj.parent }
      return partOf(hit.object)
    })
    if (hit) { const part = partOf(hit.object); if (part) onSelect(part) }
  }
  renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointerup", up)
  function positionCamera(preset: "follow" | "side" | "top") {
    follow = preset === "follow"
    const phase = stageAt(time)
    const narrow = camera.aspect < 1
    const target = phase < 2 ? new THREE.Vector3(-2, narrow ? 14.5 : 11, 0) : phase === 2 ? new THREE.Vector3(-.5, narrow ? 9 : 8, 0) : new THREE.Vector3(0, narrow ? 6.2 : 4.9, 0)
    const distance = phase < 2 ? (narrow ? 44 : 40) : phase === 2 ? (narrow ? 28 : 23) : (narrow ? 25 : 20)
    controls.target.copy(target)
    const direction = preset === "side" ? new THREE.Vector3(1, .12, 1.1) : preset === "top" ? new THREE.Vector3(.01, 1, .03) : new THREE.Vector3(1.1, .5, 1.5)
    camera.position.copy(target).add(direction.normalize().multiplyScalar(distance))
    controls.update(); draw()
  }
  function visibleAssemblies() {
    if (!root) return
    const back = root.getObjectByName("Backshell"), shield = root.getObjectByName("HeatShield"), parachute = root.getObjectByName("Parachute")
    // Discarded assemblies leave this local camera scene; avoid shadows from the compressed far-away trajectory.
    if (back) back.visible = time < 18 && !shellHidden
    if (shield) shield.visible = time < 10 && !shellHidden
    if (parachute) parachute.visible = time < 18
  }
  function appearance() {
    if (!root) return
    visibleAssemblies()
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const part = partOf(object)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const mat of materials) if (mat instanceof THREE.MeshStandardMaterial && !mat.name.includes("exhaust")) {
        mat.emissive.setHex(part && part === selected ? 0x4f3020 : 0x000000)
        mat.emissiveIntensity = part === selected ? .55 : 0
      }
    }); draw()
  }
  const cleanupObject = (object: THREE.Object3D) => {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    object.traverse(child => { if (child instanceof THREE.Mesh) { geometries.add(child.geometry); (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => materials.add(m)) } })
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
  }
  function dispose() {
    if (disposed) return; disposed = true
    resizeObserver.disconnect(); intersection.disconnect(); controls.dispose()
    document.removeEventListener("visibilitychange", visibility)
    renderer.domElement.removeEventListener("webglcontextlost", loss)
    renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointerup", up)
    if (root) { mixer?.stopAllAction(); mixer?.uncacheRoot(root); cleanupObject(root) }
    sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove()
  }
  signal.addEventListener("abort", dispose, { once: true })
  try {
    const response = await fetch(ASSET, { signal }); if (!response.ok) throw new Error("模型文件暂时不可用")
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "/mars-landing/")
    if (signal.aborted) { cleanupObject(gltf.scene); throw new DOMException("Aborted", "AbortError") }
    root = gltf.scene
    // Clone shared materials once per mesh so highlighting one part cannot tint other parts.
    const originalMaterials = new Set<THREE.Material>()
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => originalMaterials.add(material))
        object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone()
        object.castShadow = true; object.receiveShadow = true
        for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.side = THREE.DoubleSide
      }
    })
    originalMaterials.forEach(material => material.dispose())
    scene.add(root)
    if (!gltf.animations.length) throw new Error("模型缺少着陆动画")
    mixer = new THREE.AnimationMixer(root)
    for (const clip of gltf.animations) { const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play() }
    const seek = (value: number) => {
      time = THREE.MathUtils.clamp(value, 0, DURATION)
      // Restore paused actions when seeking backwards after the final frame.
      for (const clip of gltf.animations) mixer!.clipAction(clip).paused = false
      mixer!.setTime(time)
      visibleAssemblies()
      host.dataset.time = time.toFixed(2); host.dataset.phase = String(stageAt(time))
      const phase = stageAt(time)
      if (follow && phase !== currentPhase) positionCamera("follow")
      currentPhase = phase; draw()
    }
    seek(time); appearance(); resize(); positionCamera("follow")
    host.dataset.model = "blender-glb"; host.dataset.animations = String(gltf.animations.length)
    return { seek, select(part) { selected = part; appearance() }, shell(hidden) { shellHidden = hidden; appearance() }, view: positionCamera, dispose }
  } catch (error) { dispose(); throw error }
}
