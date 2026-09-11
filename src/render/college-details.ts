import * as T from "three";
import type { World } from "./world";

/** Ordinary institutional details, batched with the existing static environment. */
export function collegeDetails(w: World) {
  const wood = w.material("#795d43", "stone"),
    metal = w.material("#254958");
  // One small atlas for practical signs. No per-sign texture/material allocation.
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const signs = [
    ["EQUIPMENT LOANS", "Return by 17:00"],
    ["04  OPTICS", "Practical room"],
    ["06  CARTOGRAPHY", "Keep wet coats outside"],
    ["LAMP TEST", "Gloves on the trolley"],
  ];
  c.fillStyle = "#e4d8b8";
  c.fillRect(0, 0, 512, 512);
  signs.forEach(([title, line], i) => {
    c.fillStyle = "#344947";
    c.font = "bold 30px Georgia";
    c.fillText(title, 22, i * 128 + 48);
    c.font = "24px Georgia";
    c.fillText(line, 22, i * 128 + 88);
    c.strokeStyle = "#9f977e";
    c.strokeRect(8, i * 128 + 8, 496, 112);
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshStandardMaterial({ map: texture, roughness: 1 });
  function sign(
    index: number,
    x: number,
    y: number,
    z: number,
    yaw = 0,
    width = 1.5,
  ) {
    const geo = new T.PlaneGeometry(width, width / 4);
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 3 - index) / 4);
    const m = w.mesh(geo, material, x, y, z);
    m.rotation.y = yaw;
    m.castShadow = false;
    return m;
  }
  // Iona's loan trolley: trays, worn wheels, gloves and a repair kit.
  const x = -4.05,
    z = 6.65;
  for (const y of [0.36, 0.92]) w.box(1.1, 0.09, 0.62, wood, x, y, z);
  for (const dx of [-0.46, 0.46])
    for (const dz of [-0.23, 0.23]) {
      w.box(0.045, 0.75, 0.045, metal, x + dx, 0.56, z + dz);
      const wheel = w.mesh(
        new T.CylinderGeometry(0.11, 0.11, 0.06, 10),
        metal,
        x + dx,
        0.12,
        z + dz,
      );
      wheel.rotation.z = Math.PI / 2;
    }
  w.box(0.34, 0.18, 0.28, wood, x - 0.25, 1.055, z);
  for (const offset of [0, 0.15]) {
    const glove = w.box(
      0.11,
      0.04,
      0.24,
      w.stone,
      x + 0.14 + offset,
      1,
      z + 0.07,
    );
    glove.rotation.y = 0.25;
  }
  w.box(1.55, 0.45, 0.06, wood, x, 1.45, z - 0.12);
  sign(0, x, 1.45, z - 0.081, 0, 1.45);
  sign(1, 8.27, 2.05, 4.25, -Math.PI / 2, 1.5);
  sign(2, -8.27, 2.05, -3.65, Math.PI / 2, 1.7);
  sign(3, 4, 0.5, 1.6, 0, 1.05);
  // A replaced bench slat and three unfinished plaster patches are enough history.
  w.box(0.19, 0.65, 0.035, w.stone, 4.25, 0.95, 11.38);
  for (let i = 0; i < 3; i++)
    w.box(
      0.025,
      0.3 + i * 0.06,
      0.55,
      w.stone,
      8.29,
      0.65 + i * 0.34,
      3.35 + i * 0.15,
    );
  // The optional discovery has a tangible, ordinary source on the reading table.
  const kettle = w.sphere(0.18, metal, -10.35, 1.02, 10.55);
  kettle.scale.y = 0.8;
  w.mesh(
    new T.CylinderGeometry(0.14, 0.14, 0.025, 12),
    metal,
    -10.35,
    1.17,
    10.55,
  );
  w.sphere(0.035, wood, -10.35, 1.205, 10.55);
  const handle = w.ring(0.15, 0.018, metal, -10.35, 1.19, 10.55);
  handle.rotation.x = 0;
  const spout = w.mesh(
    new T.CylinderGeometry(0.035, 0.055, 0.22, 8),
    metal,
    -10.15,
    1.06,
    10.55,
  );
  spout.rotation.z = -0.8;
}
