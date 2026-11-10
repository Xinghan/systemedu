import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { rig, solveHand, type Commands, type FingerId } from "./kinematics"

export type HandState = { commands: Commands; opposition: number; ball: boolean; shells: boolean; tendons: boolean; selected: FingerId }
export type HandController = { update: (state: HandState) => void; view: (preset: "perspective" | "palm" | "side") => void; dispose: () => void }

export async function createHandScene(host: HTMLElement, onSelect: (id: FingerId) => void, onFailure: () => void, signal: AbortSignal): Promise<HandController> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setClearColor(0xe9eeeb)
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.dataset.handCanvas = "true"; renderer.domElement.setAttribute("role", "img")
  renderer.domElement.setAttribute("aria-label", "五指机械手三维模型，拖动旋转，点击手指选择，滚轮缩放")
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-20, 20, 15, -15, .1, 180)
  const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.minZoom = .65; controls.maxZoom = 2.5
  controls.maxPolarAngle = Math.PI * .92; controls.enableDamping = false
  scene.add(new THREE.HemisphereLight(0xfafff2, 0x758f86, 2.5))
  const sun = new THREE.DirectionalLight(0xfff3dc, 3.2); sun.position.set(-12, 28, 25); sun.castShadow = true
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 30, bottom: -10, near: .1, far: 80 })
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .025; scene.add(sun)
  const fill = new THREE.DirectionalLight(0xd8eeff, 2); fill.position.set(18, 20, -15); scene.add(fill)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xe0e6e1, roughness: .95 }))
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = .72; scene.add(ground)
  const ball = new THREE.Mesh(new THREE.SphereGeometry(rig.ball.radius, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0x268c83, transparent: true, opacity: .3, roughness: .22, metalness: .15, depthWrite: false }))
  ball.position.fromArray(rig.ball.center); ball.visible = false; scene.add(ball)
  const ballWire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(rig.ball.radius + .01, 20, 12)), new THREE.LineBasicMaterial({ color: 0x23857c, transparent: true, opacity: .22 }))
  ball.add(ballWire)
  let root: THREE.Group | null = null, disposed = false, visible = true
  let state: HandState | null = null
  const rest = new Map<string, THREE.Quaternion>(), cables = new Map<string, THREE.Mesh>()
  const draw = () => { if (!disposed && visible && !document.hidden) renderer.render(scene, camera) }
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return
    const half = width < 600 ? 17 : 14.5, aspect = width / height
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half
    camera.updateProjectionMatrix(); renderer.setSize(width, height); draw()
  }
  const view = (preset: "perspective" | "palm" | "side") => {
    camera.zoom = 1; controls.target.set(-.8, 11.8, 1)
    const direction = preset === "palm" ? new THREE.Vector3(0, 0, 45) : preset === "side" ? new THREE.Vector3(43, 5, 8) : new THREE.Vector3(18, 7, 43)
    camera.position.copy(controls.target).add(direction); camera.updateProjectionMatrix(); controls.update(); draw()
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host)
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) draw() }); intersection.observe(host)
  controls.addEventListener("change", draw)
  const visibility = () => { if (!document.hidden) draw() }; document.addEventListener("visibilitychange", visibility)
  const lost = (event: Event) => { event.preventDefault(); onFailure() }; renderer.domElement.addEventListener("webglcontextlost", lost)
  const downAt = new THREE.Vector2()
  const down = (event: PointerEvent) => downAt.set(event.clientX, event.clientY)
  const up = (event: PointerEvent) => {
    if (!root || downAt.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return
    const rect = renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
    for (const hit of ray.intersectObject(root)) {
      let finger: FingerId | undefined, hidden = false, object: THREE.Object3D | null = hit.object
      while (object) { if (!object.visible) hidden = true; if (object.userData.finger) finger = object.userData.finger; object = object.parent }
      if (!hidden && finger) { onSelect(finger); break }
    }
  }
  renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointerup", up)
  function update(next: HandState) {
    state = next; if (!root) return
    const poses = solveHand(next.commands, next.opposition, next.ball)
    ball.visible = next.ball
    for (const finger of rig.fingers) {
      const id = finger.id as FingerId, pose = poses[id], base = root.getObjectByName("Finger_" + id)!
      base.quaternion.copy(rest.get(base.name)!)
      if (id === "thumb") base.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), next.opposition * 85 * Math.PI / 180))
      pose.angles.forEach((angle, i) => {
        const joint = root!.getObjectByName(`Joint_${id}_${i}`)!
        joint.quaternion.copy(rest.get(joint.name)!).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle * Math.PI / 180))
      })
      const drum = root.getObjectByName("Drum_" + id)!
      drum.quaternion.copy(rest.get(drum.name)!).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), pose.drumAngle * Math.PI / 180))
    }
    root.updateMatrixWorld(true)
    root.traverse(object => {
      if (object.userData.shell) object.visible = next.shells
      if (object.userData.source_tendon) object.visible = false
      if (!(object instanceof THREE.Mesh)) return
      let parent: THREE.Object3D | null = object, finger: string | undefined
      while (parent) { if (parent.userData.finger) finger = parent.userData.finger; parent = parent.parent }
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) if (mat instanceof THREE.MeshStandardMaterial) {
        mat.emissive.setHex(finger === next.selected ? 0x164c42 : 0); mat.emissiveIntensity = .23
      }
    })
    for (const finger of rig.fingers) {
      const id = finger.id, start = new THREE.Vector3(...finger.drum as [number, number, number]).add(new THREE.Vector3(0, .8, .6))
      const points = [start, new THREE.Vector3(finger.drum[0], 7, .8), new THREE.Vector3(finger.base[0], finger.base[1] - .8, .85)]
      finger.lengths.forEach((_, i) => { for (const suffix of ["in", "out"]) points.push(root!.getObjectByName(`Guide_${id}_${i}_${suffix}`)!.getWorldPosition(new THREE.Vector3())) })
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, "centripetal"), 64, id === next.selected ? .055 : .035, 6, false)
      let cable = cables.get(id)
      if (!cable) { cable = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xde5b22, roughness: .4, emissive: 0x632405, emissiveIntensity: .18 })); cables.set(id, cable); scene.add(cable) }
      else { cable.geometry.dispose(); cable.geometry = geometry }
      cable.visible = next.tendons
    }
    host.dataset.model = "blender-hand"; host.dataset.selected = next.selected
    host.dataset.pose = JSON.stringify(Object.fromEntries(Object.entries(poses).map(([key, value]) => [key, Number(value.amount.toFixed(4))])))
    host.dataset.contacts = String(Object.values(poses).filter(p => p.contact).length)
    host.dataset.shells = String(next.shells); host.dataset.tendons = String(next.tendons)
    draw()
  }
  function disposeObject(object: THREE.Object3D) {
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    object.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) { geometry.add(child.geometry); (Array.isArray(child.material) ? child.material : [child.material]).forEach(mat => materials.add(mat)) } })
    geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
  }
  function dispose() {
    if (disposed) return; disposed = true
    resizeObserver.disconnect(); intersection.disconnect(); controls.dispose(); document.removeEventListener("visibilitychange", visibility)
    renderer.domElement.removeEventListener("webglcontextlost", lost); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointerup", up)
    disposeObject(scene); sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove()
  }
  signal.addEventListener("abort", dispose, { once: true })
  try {
    const response = await fetch("/mechanical-hand/mechanical-hand.glb", { signal }); if (!response.ok) throw Error("模型文件无法加载")
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "/mechanical-hand/")
    if (signal.aborted) { disposeObject(gltf.scene); throw new DOMException("Aborted", "AbortError") }
    root = gltf.scene
    const originals = new Set<THREE.Material>()
    root.traverse(object => {
      if (object.name.startsWith("Joint_") || object.name.startsWith("Finger_") || object.name.startsWith("Drum_")) rest.set(object.name, object.quaternion.clone())
      if (object instanceof THREE.Mesh) {
        const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach(mat => originals.add(mat))
        object.material = Array.isArray(object.material) ? mats.map(mat => mat.clone()) : mats[0].clone()
        object.castShadow = true; object.receiveShadow = true
      }
    })
    originals.forEach(material => material.dispose()); scene.add(root); resize(); view("perspective")
    if (state) update(state)
    return { update, view, dispose }
  } catch (error) { dispose(); throw error }
}
