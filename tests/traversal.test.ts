import { expect, it } from "vitest";
import { Traversal, angleDelta } from "../src/render/traversal";

it("caps diagonal sprint and stops promptly without losing a held world heading to camera feedback", () => {
  const t = new Traversal();
  let yaw = 0,
    facing = Math.PI;
  for (let i = 0; i < 240; i++) {
    const s = t.update(1 / 60, 1, -1, true, yaw, facing, false, false);
    yaw = s.yaw;
    facing = s.facing;
    expect(t.speed).toBeLessThanOrEqual(6.000001);
  }
  expect(Math.abs(t.vx + t.vz)).toBeLessThan(0.0001);
  for (let i = 0; i < 12; i++)
    t.update(1 / 60, 0, 0, false, yaw, facing, false, false);
  expect(t.speed).toBe(0);
});
it("preserves brief backward views, manual grace and reduced motion", () => {
  const t = new Traversal();
  let yaw = 0;
  for (let i = 0; i < 60; i++)
    yaw = t.update(1 / 60, 0, 1, false, yaw, 0, false, false).yaw;
  expect(yaw).toBe(0);
  t.manual(1);
  for (let i = 0; i < 90; i++)
    yaw = t.update(1 / 60, 1, 0, true, 1, 0, false, false).yaw;
  expect(yaw).toBe(1);
  for (let i = 0; i < 300; i++)
    yaw = t.update(1 / 60, 0, -1, true, 1, 0, true, false).yaw;
  expect(yaw).toBe(1);
  expect(
    Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2),
  ).toBeLessThan(0.0001);
});
