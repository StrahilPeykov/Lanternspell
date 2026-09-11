/** Kinematic presentation controls. No battle rules, physics engine or wall-clock authority. */
export const movementProfiles = {
  baseline: {
    acceleration: Infinity,
    braking: Infinity,
    turn: Infinity,
    speed: 3.8,
    sprint: 3.8,
  },
  snappy: { acceleration: 30, braking: 38, turn: 18, speed: 3.8, sprint: 6 },
  weighty: { acceleration: 13, braking: 18, turn: 8, speed: 3.8, sprint: 6 },
};
export const cameraProfiles = {
  manual: { delay: Infinity, follow: 0, sprint: 0 },
  gentle: { delay: 0.8, follow: 1.35, sprint: 2.4 },
  adventure: { delay: 0.35, follow: 2.8, sprint: 4 },
};
export type MovementProfile = keyof typeof movementProfiles;
export type CameraProfile = keyof typeof cameraProfiles;
export const angleDelta = (from: number, to: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const turnToward = (
  from: number,
  to: number,
  rate: number,
  dt: number,
) => from + angleDelta(from, to) * (1 - Math.exp(-rate * dt));

export class Traversal {
  movement: MovementProfile = "snappy";
  camera: CameraProfile = "gentle";
  vx = 0;
  vz = 0;
  speed = 0;
  sustained = 0;
  manualGrace = 0;
  private input = "";
  private basis = 0;
  private recenterYaw: number | null = null;
  manual(yaw: number) {
    this.manualGrace = 2.2;
    this.basis = yaw;
    this.recenterYaw = null;
  }
  recenter(facing: number) {
    this.recenterYaw = facing - Math.PI;
    this.manualGrace = 2.2;
  }
  stop() {
    this.vx = this.vz = this.speed = this.sustained = 0;
    this.input = "";
  }
  update(
    dt: number,
    dx: number,
    dz: number,
    sprint: boolean,
    yaw: number,
    facing: number,
    reduced: boolean,
    dragging: boolean,
  ) {
    const profile = movementProfiles[this.movement];
    const key = `${dx},${dz}`;
    if (key !== this.input) {
      this.input = key;
      this.basis = yaw;
      this.sustained = 0;
    }
    if (dragging) this.manual(yaw);
    this.manualGrace = Math.max(0, this.manualGrace - dt);
    const n = Math.hypot(dx, dz);
    this.sustained = n ? this.sustained + dt : 0;
    const speed = sprint ? profile.sprint : profile.speed;
    // Hold the world-space heading while keys remain held. Auto-yaw must not
    // feed back into camera-relative input and turn a straight strafe into a spiral.
    const reference = this.camera === "manual" ? yaw : this.basis;
    const tx = n
      ? ((dx * Math.cos(reference) + dz * Math.sin(reference)) / n) * speed
      : 0;
    const tz = n
      ? ((-dx * Math.sin(reference) + dz * Math.cos(reference)) / n) * speed
      : 0;
    const delta = Math.hypot(tx - this.vx, tz - this.vz);
    const amount = Math.min(
      1,
      ((n ? profile.acceleration : profile.braking) * dt) / (delta || 1),
    );
    this.vx += (tx - this.vx) * amount;
    this.vz += (tz - this.vz) * amount;
    this.speed = Math.hypot(this.vx, this.vz);
    if (n) facing = turnToward(facing, Math.atan2(tx, tz), profile.turn, dt);
    if (this.recenterYaw !== null && !dragging) {
      yaw = turnToward(yaw, this.recenterYaw, 11, dt);
      if (Math.abs(angleDelta(yaw, this.recenterYaw)) < 0.005)
        this.recenterYaw = null;
    } else if (!reduced && !dragging && !this.manualGrace && n) {
      const follow = cameraProfiles[this.camera];
      const delay =
        dz > 0 ? 2.5 : dx && !dz ? Math.max(1.25, follow.delay) : follow.delay;
      if (this.sustained > delay)
        yaw = turnToward(
          yaw,
          Math.atan2(tx, tz) - Math.PI,
          sprint ? follow.sprint : follow.follow,
          dt,
        );
    }
    return { x: this.vx * dt, z: this.vz * dt, yaw, facing };
  }
}
