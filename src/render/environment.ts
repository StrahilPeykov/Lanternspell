import * as T from "three";
import type { World } from "./world";
const rand = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export function buildEnvironment(w: World) {
  const grass = w.material("#8ca978", "leaf"),
    path = w.material("#d8c59e"),
    roof = w.material("#426875", "stone"),
    wood = w.material("#795d43", "stone"),
    dark = w.material("#254958"),
    pink = w.material("#df8e89");
  w.box(180, 0.6, 180, grass, 0, -0.4, -15);
  w.box(26, 0.12, 39, w.material("#a79b83"), 0, -0.05, -3.5);
  // Broad, irregular paving with quiet variation, instanced to keep draw calls bounded.
  const tiles = new T.InstancedMesh(
    new T.BoxGeometry(1.26, 0.035, 1.26),
    path,
    600,
  );
  const mat = new T.Matrix4();
  let count = 0;
  for (let z = -21; z < 16; z += 1.3)
    for (let x = -12.4; x < 13; x += 1.3) {
      mat.compose(
        new T.Vector3(x + (Math.round(z * 10) % 2) * 0.15, 0.036, z),
        new T.Quaternion().setFromAxisAngle(
          new T.Vector3(0, 1, 0),
          (rand(count) - 0.5) * 0.025,
        ),
        new T.Vector3(0.985 + rand(count + 2) * 0.015, 1, 0.99),
      );
      tiles.setMatrixAt(count, mat);
      tiles.setColorAt(
        count,
        new T.Color().setHSL(0.11, 0.16, 0.78 + rand(count) * 0.09),
      );
      count++;
    }
  tiles.count = count;
  tiles.receiveShadow = true;
  w.environment.add(tiles);
  for (const x of [-14, 14]) {
    w.box(0.65, 1.4, 43, w.stone, x, 0.7, -4);
    w.box(0.85, 0.18, 43, w.gold, x, 1.43, -4);
    for (let z = -24; z < 18; z += 5) {
      w.box(1, 1.8, 1, w.stone, x, 0.9, z);
      w.sphere(0.28, w.gold, x, 1.98, z);
    }
  }
  // Hero facades and social anchor arrive from the authored courtyard GLB.
  // Garden borders leave a clear central route and little pockets to explore.
  // Folded opaque leaves replace smooth horizontal discs; six triangles per
  // leaf keep readable paired growth cheaper than the previous small spheres.
  const leafShape = new T.BufferGeometry();
  leafShape.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        0, 0, 0, 0.12, 0.04, -0.07, 0.3, 0.1, 0, 0.12, 0.04, 0.07, 0.12, 0.085,
        0,
      ],
      3,
    ),
  );
  leafShape.setIndex([0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3]);
  // Match primitive attributes so leaves and stems retain their shared batch.
  leafShape.setAttribute(
    "uv",
    new T.Float32BufferAttribute([0, 0.5, 0.4, 0, 1, 0.5, 0.4, 1, 0.4, 0.5], 2),
  );
  leafShape.computeVertexNormals();
  for (const x of [-6.6, 6.6])
    for (const z of [9, 2, -6, -13]) {
      w.box(2.5, 0.27, 3.8, w.stone, x, 0.15, z);
      w.box(2.25, 0.1, 3.55, grass, x, 0.33, z);
      for (let i = 0; i < 16; i++) {
        const px = x + (rand(i + z * 4) - 0.5) * 2,
          pz = z + (rand(i + 100 + z * 4) - 0.5) * 3,
          height = 0.27 + rand(i + z * 7) * 0.27,
          bloomY = 0.39 + height;
        const stem = w.mesh(
          new T.CylinderGeometry(0.018, 0.025, height, 5, 1, true),
          w.green,
          px,
          0.39 + height / 2,
          pz,
        );
        stem.castShadow = false;
        stem.receiveShadow = false;
        for (let petal = 0; petal < 5; petal++) {
          const a = (petal * Math.PI * 2) / 5;
          const fl = w.mesh(
            new T.SphereGeometry(0.074, 6, 3),
            pink,
            px + Math.cos(a) * 0.09,
            bloomY + Math.sin(a) * 0.035,
            pz + Math.sin(a) * 0.09,
          );
          fl.scale.set(1.4, 0.7, 0.9);
          fl.castShadow = false;
          fl.receiveShadow = false;
        }
        const center = w.mesh(
          new T.SphereGeometry(0.043, 5, 3),
          w.gold,
          px,
          bloomY + 0.045,
          pz,
        );
        center.castShadow = false;
        center.receiveShadow = false;
        for (let side = 0; side < 2; side++) {
          const leaf = w.mesh(leafShape, w.green, px, 0.41 + side * 0.055, pz);
          leaf.rotation.y = rand(i + z) * Math.PI * 2 + side * Math.PI;
          leaf.scale.setScalar(0.85 + rand(i + side * 10) * 0.5);
          leaf.castShadow = false;
          leaf.receiveShadow = false;
        }
      }
    }
  for (const x of [-7.3, 7.3])
    for (const z of [13, -1, -10, -19])
      tree(w, x, z, 3.7 + rand(z) * 1.5, wood, grass);
  for (let i = 0; i < 36; i++) {
    const side = i % 2 ? 1 : -1;
    tree(
      w,
      side * (19 + rand(i) * 20),
      -45 + rand(i + 90) * 76,
      4 + rand(i + 25) * 7,
      wood,
      grass,
    );
  }
  // Two low overlapping ridgelines preserve a sky opening around the orrery.
  // Distant landscape silhouettes need neither shadow-map submission nor lookup.
  for (let i = 0; i < 12; i++) {
    const far = i < 6,
      radius = 17 + rand(i) * 10;
    const m = w.mesh(
      new T.SphereGeometry(1, 12, 7),
      w.material(far ? "#9fb9b2" : "#779b91"),
      -68 + (i % 6) * 27 + (far ? 0 : 10),
      -5,
      (far ? -87 : -65) - rand(i + 25) * 9,
    );
    m.scale.set(radius * 1.5, radius * (far ? 0.57 : 0.39), radius);
    m.castShadow = false;
    m.receiveShadow = false;
  }
  // Human touches: benches, cups, books, pots and pennants.
  for (const x of [-4.8, 4.8]) {
    w.box(1.7, 0.13, 0.6, wood, x, 0.55, 11);
    w.box(1.7, 0.65, 0.12, wood, x, 0.95, 11.3);
    for (const dx of [-0.65, 0.65])
      w.box(0.12, 0.6, 0.5, dark, x + dx, 0.28, 11);
    w.box(0.4, 0.08, 0.27, pink, x + 0.2, 0.66, 11);
    w.box(0.32, 0.08, 0.3, roof, x + 0.1, 0.75, 11);
  }
  for (const [x, z] of [
    [4, 1],
    [-5, -9],
  ]) {
    w.mesh(new T.CylinderGeometry(0.42, 0.58, 0.65, 10), wood, x, 0.33, z);
    w.ring(0.4, 0.035, w.gold, x, 0.69, z);
  }
  w.sphere(0.23, w.lamp, 4, 1.25, 1);
  w.ring(0.38, 0.028, w.gold, 4, 1.25, 1).rotation.x = 0.2;
  w.box(0.68, 0.1, 0.46, roof, -5, 0.85, -9).rotation.z = 0.15;
  for (const x of [-4.5, 4.5])
    for (const z of [6, -4, -15]) {
      w.mesh(new T.CylinderGeometry(0.05, 0.09, 2.4, 8), dark, x, 1.2, z);
      w.box(0.35, 0.5, 0.35, w.lamp, x, 2.5, z);
      w.mesh(new T.ConeGeometry(0.32, 0.3, 4), roof, x, 2.9, z);
    }
  const arch = new T.Shape();
  arch.absarc(0, 0, 2.5, 0, Math.PI, false);
  arch.absarc(0, 0, 2.18, Math.PI, 0, true);
  const a = w.mesh(
    new T.ExtrudeGeometry(arch, { depth: 0.5, bevelEnabled: false }),
    w.stone,
    0,
    3.0,
    18.8,
  );
  a.castShadow = true;
  for (const x of [-2.35, 2.35]) w.box(0.35, 3, 0.55, w.stone, x, 1.5, 19);
  w.ring(3.6, 0.045, w.gold, 0, 0.11, -14);
  w.makeEnemies();
  w.awakened.position.set(0, 9.3, -23);
  w.scene.add(w.awakened);
  for (let i = 0; i < 3; i++) {
    const ring = w.ring(2.0 + i * 0.2, 0.035, w.gold, 0, 0, 0, w.awakened);
    ring.rotation.set(i * 0.8, 0.3, i * 0.7);
  }
  w.sphere(0.5, w.lamp, 0, 0, 0, w.awakened);
  for (let i = 0; i < 14; i++)
    w.sphere(
      0.06,
      w.lamp,
      Math.cos(i) * 2.7,
      Math.sin(i * 2) * 1.5,
      Math.sin(i) * 2.7,
      w.awakened,
    );
  w.awakened.visible = false;
  w.doorwayLight.position.set(0, 0, -18.9);
  w.scene.add(w.doorwayLight);
  const aura = new T.MeshBasicMaterial({
    color: "#ffdb82",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const glow = w.sphere(1.35, aura, 0, 1.9, 0, w.doorwayLight);
  glow.scale.set(1, 1.45, 0.2);
  const hoop = w.ring(1.4, 0.035, w.lamp, 0, 1.9, 0.1, w.doorwayLight);
  hoop.rotation.x = Math.PI / 2;
  hoop.scale.y = 1.3;
  for (let i = 0; i < 16; i++)
    w.sphere(
      0.07,
      w.lamp,
      Math.cos(i) * 1.7,
      1.8 + Math.sin(i) * 1.6,
      0.3 + Math.sin(i * 3) * 0.4,
      w.doorwayLight,
    );
  w.doorwayLight.add(new T.PointLight("#ffd899", 18, 14, 2));
  w.doorwayLight.visible = false;
}
function tree(
  w: World,
  x: number,
  z: number,
  h: number,
  wood: T.Material,
  leaf: T.Material,
) {
  const group = new T.Group();
  group.position.set(x, 0, z);
  w.environment.add(group);
  w.mesh(
    new T.CylinderGeometry(0.1, 0.22, h * 0.7, 7),
    wood,
    0,
    h * 0.35,
    0,
    group,
  );
  const cypress = Math.abs(x) < 9;
  for (let i = 0; i < (cypress ? 3 : 4); i++) {
    const m = w.mesh(
      new T.SphereGeometry(1, 12, 10),
      w.material(cypress ? "#537e61" : "#658673", "leaf"),
      (rand(i + x) - 0.5) * h * 0.1,
      h * (cypress ? 0.43 + i * 0.15 : 0.5 + i * 0.09),
      (rand(i + z) - 0.5) * h * 0.1,
      group,
    );
    m.scale.set(
      h * (cypress ? 0.17 - i * 0.035 : 0.26),
      h * (cypress ? 0.27 : 0.22),
      h * (cypress ? 0.15 - i * 0.029 : 0.22),
    );
    m.rotation.z = (rand(i + x) - 0.5) * 0.14;
  }
  if (!cypress)
    group.traverse((object) => {
      if (object instanceof T.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
}
