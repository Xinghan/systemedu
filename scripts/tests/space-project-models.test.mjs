import test from "node:test";
import assert from "node:assert/strict";
import { LANDER, newLander, stepLander, GRID, moveRover, photoReady, DEFAULT_RULES, runRules, rulesCanFinish } from "../../packages/student-web/public/project-lines/space-exploration/_shared/models.mjs";

test("自由落体符合恒加速度公式，落地不穿透；无制动不会自动成功", () => {
  let s = newLander();
  for (let i = 0; i < 60; i++) s = stepLander(s, false);
  assert.ok(Math.abs(s.height - (60 - 4 - .5 * LANDER.gravity)) < 1e-8);
  while (s.status === "flying") s = stepLander(s, false);
  assert.equal(s.height, 0); assert.equal(s.status, "hard");
  assert.ok(Math.abs(s.impact - Math.sqrt(16 + 2 * LANDER.gravity * 60)) < 1e-7);
});
test("制动消耗燃料，耗尽后继续受到重力，适当控制能够柔和着陆", () => {
  const empty = stepLander({ ...newLander(), fuel: 0 }, true);
  assert.ok(empty.velocity < -4); assert.equal(empty.fuel, 0);
  let s = newLander(), braking = false;
  for (let i = 0; i < 6000 && s.status === "flying"; i++) {
    braking = s.velocity < -1.7 && (s.height < s.velocity ** 2 / (2 * (LANDER.thrust - LANDER.gravity)) + 4 || s.height < 6);
    s = stepLander(s, braking);
  }
  assert.equal(s.status, "landed"); assert.ok(s.fuel < LANDER.fuelSeconds); assert.ok(s.impact <= LANDER.safeSpeed);
});
test("地图障碍不能穿过；到达目标、朝向和亲手移动共同决定是否能拍照", () => {
  let p = { ...GRID.start, yaw: 0 }; p = moveRover(p, "east");
  assert.equal(moveRover(p, "east").blocked, true); assert.equal(moveRover(p, "east").x, 2);
  for (let i = 0; i < 3; i++) p = moveRover(p, "north");
  for (let i = 0; i < 3; i++) p = moveRover(p, "east");
  assert.equal(photoReady(p, "ridge", 7), true);
  assert.equal(photoReady({ ...p, yaw: -Math.PI / 2 }, "ridge", 7), false);
  assert.equal(photoReady(p, "ridge", 0), false);
  assert.equal(photoReady({ x: 2, z: 4, yaw: Math.PI / 2 }, "ridge", 5), false);
});
test("规则真实改变轨迹，岩石、软沙和 unknown 不会假成功", () => {
  assert.equal(runRules(DEFAULT_RULES, "training").status, "stuck");
  assert.equal(runRules(DEFAULT_RULES, "transfer").status, "collision");
  const rules = { clear: "forward", sand: "slow", rock: "detour", unknown: "stop" };
  const a = runRules(rules, "training"), b = runRules(rules, "transfer");
  assert.ok(a.passed && b.passed); assert.ok(b.trace.some(p => p.z === 1));
  assert.equal(runRules({ ...rules, unknown: "forward" }, "training").status, "unsafe");
  assert.equal(runRules({ ...rules, clear: "stop" }, "training").status, "stopped-early");
});
test("成品须由当前版本通过两条路线；修改或导入后不会继承旧的通过声明", () => {
  const rules = { clear: "forward", sand: "slow", rock: "detour", unknown: "stop" };
  const history = [runRules(DEFAULT_RULES, "training"), runRules(rules, "training"), runRules(rules, "transfer")];
  assert.equal(rulesCanFinish(rules, history, 3), true);
  assert.equal(rulesCanFinish({ ...rules, clear: "slow" }, history, 4), false);
  assert.equal(rulesCanFinish(rules, [], 0, true), false);
  assert.equal(rulesCanFinish(rules, history.slice(1), 0, true), true);
  const exported = JSON.parse(JSON.stringify({ rules }));
  assert.deepEqual(runRules(exported.rules, "transfer"), runRules(rules, "transfer"));
});
