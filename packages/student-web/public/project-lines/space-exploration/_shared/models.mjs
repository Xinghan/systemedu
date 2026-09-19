// 所有阈值和训练路线均为教学设定；模型不控制真实设备。
export const SCENE_VERSION = "mars-training/1";
export const LANDER = { gravity: 3.7, thrust: 9, fuelSeconds: 9, safeSpeed: 3, dt: 1 / 60 };
export function newLander() { return { t: 0, height: 60, velocity: -4, fuel: LANDER.fuelSeconds, status: "flying", impact: null }; }
export function stepLander(state, braking, dt = LANDER.dt) {
  if (state.status !== "flying") return { ...state };
  const burn = braking ? Math.min(dt, state.fuel) : 0;
  const acceleration = -LANDER.gravity + LANDER.thrust * burn / dt;
  const velocity = state.velocity + acceleration * dt;
  const height = state.height + state.velocity * dt + .5 * acceleration * dt * dt;
  const next = { t: state.t + dt, height, velocity, fuel: Math.max(0, state.fuel - burn), status: "flying", impact: null };
  if (height <= 0) {
    const hitTime = Math.abs(acceleration) < 1e-9 ? -state.height / state.velocity
      : (-state.velocity - Math.sqrt(Math.max(0, state.velocity ** 2 - 2 * acceleration * state.height))) / acceleration;
    const t = Math.max(0, Math.min(dt, hitTime));
    next.t = state.t + t; next.height = 0; next.velocity = state.velocity + acceleration * t;
    next.impact = Math.abs(next.velocity); next.status = next.impact <= LANDER.safeSpeed ? "landed" : "hard";
  } else if (height > 160 || next.t > 90) next.status = "outside";
  return next;
}
export const GRID = { width: 9, height: 7, start: { x: 1, z: 4 }, blocks: [[3, 2], [3, 3], [3, 4], [3, 5], [5, 0], [7, 3]] };
export const TARGETS = {
  ridge: { x: 6, z: 1, label: "层状岩石", color: "#d0a485" },
  dune: { x: 6, z: 5, label: "柔软沙丘", color: "#e9c689" },
};
export const DIRECTIONS = { north: { x: 0, z: -1, yaw: 0 }, east: { x: 1, z: 0, yaw: Math.PI / 2 }, south: { x: 0, z: 1, yaw: Math.PI }, west: { x: -1, z: 0, yaw: -Math.PI / 2 } };
export const isBlocked = (x, z) => x < 0 || z < 0 || x >= GRID.width || z >= GRID.height || GRID.blocks.some(p => p[0] === x && p[1] === z) || Object.values(TARGETS).some(p => p.x === x && p.z === z);
export function moveRover(pose, direction) {
  const d = DIRECTIONS[direction];
  if (!d) return { ...pose, blocked: true };
  const x = pose.x + d.x, z = pose.z + d.z;
  return isBlocked(x, z) ? { ...pose, yaw: d.yaw, blocked: true } : { x, z, yaw: d.yaw, blocked: false };
}
export function photoReady(pose, targetId, moves) {
  const target = TARGETS[targetId]; if (!target) return false;
  const dx = target.x - pose.x, dz = target.z - pose.z;
  const distance = Math.hypot(dx, dz), angle = Math.atan2(dx, -dz) - pose.yaw;
  if (moves < 3 || distance > 2.25 || Math.cos(angle) < Math.cos(Math.PI / 5)) return false;
  for (let t = .1; t < .95; t += .05) {
    const x = Math.round(pose.x + dx * t), z = Math.round(pose.z + dz * t);
    if (GRID.blocks.some(p => p[0] === x && p[1] === z)) return false;
  }
  return true;
}
export const TERRAINS = ["clear", "sand", "rock", "unknown"];
export const ACTIONS = ["forward", "slow", "detour", "stop"];
export const DEFAULT_RULES = { clear: "forward", sand: "forward", rock: "forward", unknown: "forward" };
export const ROUTES = {
  training: ["clear", "sand", "clear", "rock", "clear", "unknown"],
  transfer: ["rock", "clear", "sand", "rock", "sand", "unknown"],
};
export function validRules(rules) { return rules && Object.keys(rules).length === 4 && TERRAINS.every(t => ACTIONS.includes(rules[t])); }
export function rulesSignature(rules) { return TERRAINS.map(t => t + ":" + rules[t]).join("|"); }
export function runRules(rules, routeId) {
  if (!validRules(rules) || !ROUTES[routeId]) throw new Error("不支持的规则或路线");
  const trace = [{ x: 0, z: 0, t: 0 }], steps = [];
  let x = 0, time = 0, passed = false, status = "incomplete";
  for (const [index, terrain] of ROUTES[routeId].entries()) {
    const action = rules[terrain], step = { index, terrain, action, from: x, to: x, outcome: "", time };
    if (action === "stop") {
      passed = terrain === "unknown"; status = passed ? "safe-stop" : "stopped-early";
      step.outcome = passed ? "未知地形前停下求助" : "提前停车，尚未到达检查点"; steps.push(step); break;
    }
    if (terrain === "unknown") { status = "unsafe"; step.outcome = "没有看清地面，却继续移动"; steps.push(step); break; }
    if (terrain === "rock" && action !== "detour") { status = "collision"; step.outcome = "路线被岩石挡住"; steps.push(step); break; }
    if (terrain === "sand" && action === "forward") { status = "stuck"; step.outcome = "快速驶入软沙，车轮打滑"; steps.push(step); break; }
    if (action === "detour") {
      // 绕行确实经过侧方的预置平整通道，这是平台提供的路径动作。
      time += 1; trace.push({ x, z: 1, t: time }); time += 1; trace.push({ x: x + 1, z: 1, t: time }); time += 1; trace.push({ x: x + 1, z: 0, t: time });
    } else { time += action === "slow" ? 2 : 1; trace.push({ x: x + 1, z: 0, t: time }); }
    x += 1; step.to = x; step.time = time; step.outcome = action === "detour" ? "沿旁边的平地绕过" : action === "slow" ? "低速通过" : "向前通过"; steps.push(step);
  }
  return { route_id: routeId, rules: { ...rules }, signature: rulesSignature(rules), trace, steps, passed, status, time };
}
export function rulesCanFinish(rules, runs, edits, imported = false) {
  const signature = rulesSignature(rules);
  return (imported || (edits > 0 && runs.some(r => !r.passed))) && rules.unknown === "stop"
    && Object.keys(ROUTES).every(id => runs.some(r => r.route_id === id && r.signature === signature && r.passed));
}
