import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { dressActor } from "./actors";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { SpellEffects, type SignatureTreatment } from "./effects";
import { SurfaceLibrary } from "./materials";
import { buildEnvironment } from "./environment";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Position = { x: number; z: number; yaw: number };
const rand = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export class World {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(49, 1, 0.1, 150);
  renderer: T.WebGLRenderer;
  player = new T.Group();
  partner = new T.Group();
  npc = new T.Group();
  environment = new T.Group();
  enemyGroup = new T.Group();
  effects = new SpellEffects();
  fx = this.effects.group;
  position: Position = { x: 0, z: 10, yaw: Math.PI };
  remote: Position = { x: 1, z: 10, yaw: Math.PI };
  yaw = 0;
  pitch = 0.27;
  distance = 9;
  sensitivity = 1;
  reduced = false;
  low = false;
  stage = 0;
  battle = false;
  active = true;
  moving = false;
  target = new T.Vector3(0, 1.8, 10);
  keys = new Set<string>();
  bindings = {
    forward: "KeyW",
    back: "KeyS",
    left: "KeyA",
    right: "KeyD",
    interact: "KeyE",
    recenter: "KeyR",
    journal: "KeyJ",
    confirm: "Enter",
  };
  frames: number[] = [];
  loadedAt = 0;
  loadingErrors: string[] = [];
  mixers: T.AnimationMixer[] = [];
  actions: T.AnimationAction[][] = [];
  actorMeshes = new Map<string, T.Object3D>();
  private drag: { x: number; y: number } | null = null;
  private clock = 0;
  private last = performance.now();
  private effectTime = 0;
  private effectDuration = 0;
  private effectKind = "";
  private effectTarget = new T.Vector3();
  private orrery?: T.Object3D;
  private echo = false;
  private echoNotes = new T.Group();
  private guardianIntention = "strike";
  awakened = new T.Group();
  doorwayLight = new T.Group();
  private casting = "";
  identityColor = "#2b7f88";
  partnerColor = "#bc745e";
  surfaces = new SurfaceLibrary();
  sun!: T.DirectionalLight;
  stone: T.MeshStandardMaterial;
  gold: T.MeshStandardMaterial;
  green: T.MeshStandardMaterial;
  lamp: T.MeshStandardMaterial;
  constructor(
    public canvas: HTMLCanvasElement,
    public onMove: (p: Position) => void,
  ) {
    const renderProbe = import.meta.env.DEV
      ? new URLSearchParams(location.search).get("renderProbe")
      : null;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: renderProbe !== "no-aa",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = renderProbe !== "no-shadows";
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.scene.background = new T.Color("#b9d7d6");
    this.scene.fog = new T.Fog("#b9d7d6", 35, 110);
    this.stone = this.material("#eee0bd", "stone");
    this.gold = this.material("#caa760", "metal");
    this.green = this.material("#739775", "leaf");
    this.lamp = new T.MeshStandardMaterial({
      color: "#ffd99a",
      emissive: "#ffbe64",
      emissiveIntensity: 0.8,
      roughness: 0.6,
    });
    this.scene.add(new T.HemisphereLight("#e6f2ff", "#8d845d", 1.8));
    const sun = (this.sun = new T.DirectionalLight("#fff1cf", 2.8));
    sun.position.set(-15, 24, 13);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 30,
      bottom: -30,
      near: 0.5,
      far: 80,
    });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    sun.target.position.set(0, 0, -8);
    this.scene.add(sun.target);
    this.scene.add(
      this.environment,
      this.player,
      this.partner,
      this.npc,
      this.enemyGroup,
      this.fx,
    );
    this.partner.visible = false;
    this.npc.position.set(-3, 0, 6);
    buildEnvironment(this);
    this.batchStatic();
    this.player.position.set(0, 0, 10);
    this.player.rotation.y = Math.PI;
    this.camera.position.set(0, 4.2, 18);
    this.camera.lookAt(this.target);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active || this.battle) return;
      this.drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drag || !this.active) return;
      this.yaw -= (e.clientX - this.drag.x) * 0.006 * this.sensitivity;
      this.pitch = T.MathUtils.clamp(
        this.pitch + (e.clientY - this.drag.y) * 0.004 * this.sensitivity,
        0.18,
        0.85,
      );
      this.drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener("pointerup", () => (this.drag = null));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.active)
          this.distance = T.MathUtils.clamp(
            this.distance + e.deltaY * 0.012,
            5,
            13,
          );
      },
      { passive: false },
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.drag = null;
    });
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.active = false;
      document.getElementById("toast")!.textContent =
        "Graphics paused. Reload to restore your last saved state.";
    });
    this.echoNotes.position.set(-10, 1.3, 10);
    this.scene.add(this.echoNotes);
    for (let i = 0; i < 4; i++) {
      const note = this.sphere(
        0.05,
        this.lamp,
        Math.cos(i) * 0.3,
        i * 0.23,
        Math.sin(i) * 0.2,
        this.echoNotes,
      );
      note.castShadow = false;
    }
    this.echoNotes.visible = false;
    this.loadAssets();
    requestAnimationFrame(this.frame);
  }
  material(color: string, kind = "plain") {
    return this.surfaces.material(color, kind);
  }
  mesh(
    geo: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.environment,
  ) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    p?: T.Object3D,
  ) {
    return this.mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, p);
  }
  sphere(
    r: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    p?: T.Object3D,
  ) {
    return this.mesh(new T.SphereGeometry(r, 12, 8), mat, x, y, z, p);
  }
  ring(
    r: number,
    t: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    p?: T.Object3D,
  ) {
    const m = this.mesh(new T.TorusGeometry(r, t, 6, 48), mat, x, y, z, p);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  private batchStatic() {
    this.environment.updateMatrixWorld(true);
    const batches = new Map<
      string,
      {
        material: T.Material;
        cast: boolean;
        receive: boolean;
        geos: T.BufferGeometry[];
        meshes: T.Mesh[];
      }
    >();
    this.environment.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        !(o instanceof T.InstancedMesh) &&
        !Array.isArray(o.material)
      ) {
        const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = {
            material: o.material,
            cast: o.castShadow,
            receive: o.receiveShadow,
            geos: [],
            meshes: [],
          };
          batches.set(key, batch);
        }
        batch.geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
        batch.meshes.push(o);
      }
    });
    for (const batch of batches.values()) {
      // Extruded arches have no index; boxes do. Normalize only mixed batches.
      // Otherwise mergeGeometries rejects the whole stone batch and leaves every prop drawing separately.
      if (batch.geos.some((g) => !!g.index !== !!batch.geos[0].index)) {
        batch.geos = batch.geos.map((g) => {
          if (!g.index) return g;
          const normalized = g.toNonIndexed();
          g.dispose();
          return normalized;
        });
      }
      const geo = mergeGeometries(batch.geos);
      if (geo) {
        const mesh = new T.Mesh(geo, batch.material);
        mesh.castShadow = batch.cast;
        mesh.receiveShadow = batch.receive;
        this.environment.add(mesh);
        for (const source of batch.meshes) {
          source.removeFromParent();
          source.geometry.dispose();
        }
      }
      for (const g of batch.geos) g.dispose();
    }
  }
  private buildProxyWizard(group: T.Group, color: string) {
    const cloth = this.material(color),
      skin = this.material("#d7a580"),
      boots = this.material("#57433e");
    this.box(0.56, 0.68, 0.33, cloth, 0, 1.07, 0, group);
    for (const x of [-0.17, 0.17]) {
      this.box(0.2, 0.55, 0.22, boots, x, 0.37, 0, group);
      this.box(0.24, 0.18, 0.4, boots, x, 0.09, 0.07, group);
      this.box(0.17, 0.58, 0.2, cloth, x * 2.1, 1, 0, group);
    }
    this.sphere(0.24, skin, 0, 1.63, 0, group);
    for (const x of [-0.085, 0.085])
      this.sphere(0.026, boots, x, 1.66, 0.223, group);
    const brim = this.mesh(
      new T.CylinderGeometry(0.5, 0.5, 0.06, 24),
      cloth,
      0,
      1.85,
      0,
      group,
    );
    brim.rotation.z = 0.09;
    this.mesh(new T.ConeGeometry(0.31, 0.65, 12), cloth, 0.03, 2.14, 0, group);
    this.box(0.1, 1.8, 0.1, this.gold, 0.48, 0.93, 0.1, group);
    this.sphere(0.12, this.lamp, 0.48, 1.88, 0.1, group);
  }
  private async loadAssets() {
    const loader = new GLTFLoader();
    try {
      const [gltf, accessories] = await Promise.all([
        loader.loadAsync("/assets/wizard.glb"),
        loader.loadAsync("/assets/mage-accessories.glb"),
      ]);
      for (const [i, group] of [
        this.player,
        this.npc,
        this.partner,
      ].entries()) {
        group.clear();
        const obj = clone(gltf.scene);
        obj.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            {
              const materials = Array.isArray(o.material)
                ? o.material
                : [o.material];
              o.material = materials.map((m) => {
                const n = m.name.toLowerCase().includes("identity")
                  ? m.clone()
                  : m;
                if (n.name.toLowerCase().includes("identity") && "color" in n)
                  (n as T.MeshStandardMaterial).color.set(
                    i === 1
                      ? "#bc745e"
                      : i === 2
                        ? this.partnerColor
                        : this.identityColor,
                  );
                return n;
              });
              if (o.material.length === 1) o.material = o.material[0];
            }
          }
        });
        group.add(obj);
        dressActor(
          obj,
          accessories.scene,
          i === 1 ? "iona" : i === 2 ? "partner" : "player",
        );
        const mixer = new T.AnimationMixer(obj);
        this.mixers.push(mixer);
        const clips = gltf.animations;
        const idle = clips.find((c) => /idle/i.test(c.name)),
          walk = clips.find((c) => /walk/i.test(c.name)),
          cast = clips.find((c) => /cast/i.test(c.name));
        this.actions.push(
          [
            idle ? mixer.clipAction(idle) : null,
            walk ? mixer.clipAction(walk) : null,
            cast ? mixer.clipAction(cast) : null,
          ].filter(Boolean) as T.AnimationAction[],
        );
        this.actions[i][0]?.play();
      }
    } catch (e) {
      this.loadingErrors.push("Wizard: " + String(e));
      this.buildProxyWizard(this.player, "#286d76");
      this.buildProxyWizard(this.npc, "#b26655");
      this.buildProxyWizard(this.partner, "#b26655");
    }
    try {
      const [courtyard, guardian, moth] = await Promise.all([
        loader.loadAsync("/assets/courtyard.glb"),
        loader.loadAsync("/assets/guardian.glb"),
        loader.loadAsync("/assets/paper-moth.glb"),
      ]);
      for (const id of ["moth1", "moth2"]) {
        const h = this.actorMeshes.get(id)!;
        h.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
        });
        h.clear();
        h.add(moth.scene.clone(true));
      }
      courtyard.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.environment.add(courtyard.scene);
      const holder = this.actorMeshes.get("guardian")!;
      holder.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      holder.clear();
      guardian.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      holder.add(guardian.scene);
    } catch (e) {
      this.loadingErrors.push("Benchmark art: " + String(e));
    }
    try {
      const gltf = await loader.loadAsync("/assets/observatory.glb");
      gltf.scene.position.set(0, 0, -23);
      gltf.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
        if (o.name.toLowerCase().includes("orrery")) this.orrery = o;
      });
      this.environment.add(gltf.scene);
    } catch (e) {
      this.loadingErrors.push("Observatory: " + String(e));
      this.mesh(new T.CylinderGeometry(4.4, 4.7, 6, 32), this.stone, 0, 3, -23);
      const dome = this.sphere(4.6, this.material("#446b7b"), 0, 6, -23);
      dome.scale.y = 0.7;
      for (let i = 0; i < 3; i++) {
        const r = this.ring(2, 0.045, this.gold, 0, 10, -23);
        r.rotation.set(i, 0, i * 0.8);
      }
    }
    this.setQuality(this.low);
    this.loadedAt = performance.now();
  }
  makeEnemies() {
    const paper = this.material("#e9d4a6");
    for (let j = 0; j < 2; j++) {
      const g = new T.Group();
      g.name = "moth" + (j + 1);
      this.sphere(0.22, this.gold, 0, 1.2, 0, g);
      for (const side of [-1, 1]) {
        const s = new T.Shape();
        s.moveTo(0, 0);
        s.lineTo(side * 0.85, 0.55);
        s.lineTo(side * 0.68, -0.38);
        s.lineTo(0, -0.1);
        const wing = this.mesh(new T.ShapeGeometry(s), paper, 0, 1.2, 0, g);
        (wing.material as T.MeshStandardMaterial).side = T.DoubleSide;
        wing.name = "wing" + side;
      }
      g.position.set(j === 0 ? -1.2 : 2.2, 0, -5);
      this.enemyGroup.add(g);
      this.actorMeshes.set(g.name, g);
    }
    const g = new T.Group();
    g.name = "guardian";
    this.mesh(
      new T.CylinderGeometry(0.5, 0.7, 1.2, 8),
      this.gold,
      0,
      1.3,
      0,
      g,
    );
    this.sphere(0.45, this.stone, 0, 2.18, 0, g);
    for (const x of [-0.18, 0.18])
      this.sphere(0.08, this.lamp, x, 2.22, 0.38, g);
    for (const x of [-0.7, 0.7]) {
      this.box(0.32, 1.1, 0.35, this.gold, x, 1.2, 0, g);
      this.box(0.35, 0.65, 0.5, this.stone, x * 0.55, 0.4, 0, g);
    }
    for (let i = 0; i < 3; i++) {
      const r = this.ring(1.15, 0.032, this.gold, 0, 1.6, 0, g);
      r.rotation.set(i * 0.7, 0.4, i * 0.4);
    }
    g.position.set(0, 0, -15);
    this.enemyGroup.add(g);
    this.actorMeshes.set("guardian", g);
    this.actorMeshes.set("mage1", this.player);
    this.actorMeshes.set("mage2", this.partner);
  }
  setStage(stage: number) {
    this.stage = stage;
    this.actorMeshes.get("moth1")!.visible = stage === 2;
    this.actorMeshes.get("moth2")!.visible = false;
    this.actorMeshes.get("guardian")!.visible = stage === 4;
    this.lamp.emissiveIntensity = stage >= 5 ? 2 : stage >= 2 ? 1.2 : 0.45;
    this.awakened.visible = this.doorwayLight.visible = stage === 5;
  }
  setBattle(
    battle: { actors: { id: string; hp: number; team: string }[] } | null,
    seat = "mage1",
  ) {
    this.actorMeshes.set(seat, this.player);
    this.actorMeshes.set(seat === "mage1" ? "mage2" : "mage1", this.partner);
    this.battle = !!battle;
    this.frameCamera();
    if (battle) {
      const base = this.stage >= 4 ? -14 : -4;
      this.player.position.set(-1, 0, base + 4);
      this.player.rotation.y = Math.PI;
      this.partner.position.set(1, 0, base + 4);
      for (const a of battle.actors) {
        const m = this.actorMeshes.get(a.id);
        if (m) {
          m.visible = a.hp > 0;
          if (a.id.startsWith("moth"))
            m.position.set(this.stage >= 4 ? 2.4 : -1.2, 0, base - 1.4);
        }
      }
      this.target.set(0, 1.1, base + 1.4);
      this.partner.visible = battle.actors.some((a) => a.id === "mage2");
      if (seat === "mage2") {
        this.actorMeshes.set("mage2", this.player);
        this.actorMeshes.set("mage1", this.partner);
      }
    }
  }
  effect(spell: string, actor: string, target: string, duration: number) {
    this.clearEffect();
    this.casting = actor;
    this.effectDuration = duration;
    const caster = this.actorMeshes.get(actor);
    const at = this.actorMeshes.get(target)?.position ?? this.player.position;
    this.effects.low = this.low;
    this.effects.begin(
      spell,
      caster?.position ?? at,
      at,
      duration,
      this.actorTraditions[actor] === "hearth",
    );
    if (caster) {
      const index = [this.player, this.npc, this.partner].indexOf(
        caster as T.Group,
      );
      const cast = this.actions[index]?.[2];
      if (cast) {
        cast.reset().setLoop(T.LoopOnce, 1);
        cast.clampWhenFinished = true;
        cast.timeScale = spell === "unfold" ? 0.32 : 0.8;
        cast.play();
      }
    }
  }
  clearEffect() {
    this.effects.clear();
    this.effectDuration = 0;
    this.casting = "";
    this.player.rotation.z = this.partner.rotation.z = 0;
  }
  setSignature(value: SignatureTreatment) {
    this.effects.treatment = value;
  }
  actorTraditions: Record<string, string> = {
    mage1: "margin",
    mage2: "hearth",
  };

  setEcho(value: boolean) {
    this.echo = value;
    this.echoNotes.visible = value;
  }
  setIntentions(intentions: { actorId: string; spellId: string }[]) {
    this.guardianIntention =
      intentions.find((i) => i.actorId === "guardian")?.spellId ?? "strike";
  }
  recenter() {
    this.yaw = 0;
    this.pitch = 0.27;
    this.distance = 9;
  }
  private frameCamera() {
    if (this.battle)
      this.camera.setViewOffset(
        innerWidth,
        innerHeight,
        0,
        innerHeight * 0.23,
        innerWidth,
        innerHeight,
      );
    else this.camera.clearViewOffset();
  }
  setQuality(low: boolean) {
    this.low = low;
    const size = low ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(size, size);
    }
    this.environment.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.userData.highShadow ??= o.castShadow;
        o.castShadow = low ? false : o.userData.highShadow;
      }
    });
    this.doorwayLight.children.forEach((o) => {
      if (o instanceof T.PointLight) o.visible = !low;
    });
    this.resize();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setPixelRatio(
      this.low
        ? Math.min(devicePixelRatio, 0.85)
        : Math.min(devicePixelRatio, 1.5),
    );
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private blocked(x: number, z: number) {
    if (Math.hypot(x, z - 3) < 1.35) return true;
    if (Math.abs(x) > 12.8 || z > 15.5 || z < -19) return true;
    if (Math.abs(x) > 8.25 && z < 7) return true;
    for (const gx of [-6.6, 6.6])
      for (const gz of [9, 2, -6, -13])
        if (Math.abs(x - gx) < 1.55 && Math.abs(z - gz) < 2.13) return true;
    return false;
  }
  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const elapsed = now - this.last;
    const dt = Math.min(elapsed / 1000, 0.05);
    this.last = now;
    this.frames.push(elapsed);
    if (this.frames.length > 1800) this.frames.shift();
    this.clock += dt;
    this.moving = false;
    if (this.active && !this.battle) {
      const b = this.bindings;
      let dx = Number(this.keys.has(b.right)) - Number(this.keys.has(b.left)),
        dz = Number(this.keys.has(b.back)) - Number(this.keys.has(b.forward));
      if (dx || dz) {
        const n = Math.hypot(dx, dz);
        dx /= n;
        dz /= n;
        const xx =
            (dx * Math.cos(this.yaw) + dz * Math.sin(this.yaw)) * dt * 3.8,
          zz = (-dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) * dt * 3.8;
        if (!this.blocked(this.position.x + xx, this.position.z))
          this.position.x += xx;
        if (!this.blocked(this.position.x, this.position.z + zz))
          this.position.z += zz;
        this.position.yaw = Math.atan2(xx, zz);
        this.moving = true;
        this.onMove({ ...this.position });
      }
      this.player.position.set(this.position.x, 0, this.position.z);
      this.player.rotation.y = this.position.yaw;
      this.target.lerp(
        new T.Vector3(this.position.x, 1.8, this.position.z),
        1 - Math.exp(-dt * 7),
      );
    }
    for (let i = 0; i < this.mixers.length; i++) {
      if (![this.player, this.npc, this.partner][i].visible) continue;
      const walk = i === 0 && this.moving;
      const acts = this.actions[i];
      if (acts.length > 1) {
        const casting =
          this.effectDuration > 0 &&
          this.actorMeshes.get(this.casting) ===
            [this.player, this.npc, this.partner][i];
        for (let j = 0; j < acts.length; j++) {
          const desired = j === (casting ? 2 : walk ? 1 : 0) ? 1 : 0;
          acts[j].enabled = true;
          acts[j].setEffectiveWeight(
            T.MathUtils.lerp(
              acts[j].getEffectiveWeight(),
              desired,
              1 - Math.exp(-dt * 12),
            ),
          );
          if (j < 2 && !acts[j].isRunning()) acts[j].play();
        }
      }
      this.mixers[i].update(dt);
    }
    if (!this.battle) {
      this.partner.position.lerp(
        new T.Vector3(this.remote.x, 0, this.remote.z),
        1 - Math.exp(-dt * 12),
      );
      this.partner.rotation.y = this.remote.yaw;
    }
    const d = this.battle ? 15 : this.distance,
      angle = this.battle ? 0.2 : this.yaw,
      pitch = this.battle ? 0.56 : this.pitch;
    const desired = new T.Vector3(
      this.target.x + Math.sin(angle) * d * Math.cos(pitch),
      this.target.y + Math.sin(pitch) * d,
      this.target.z + Math.cos(angle) * d * Math.cos(pitch),
    );
    this.camera.position.lerp(
      desired,
      1 - Math.exp(-dt * (this.reduced ? 20 : 5)),
    );
    this.camera.lookAt(this.target);
    for (const id of ["moth1", "moth2"]) {
      const moth = this.actorMeshes.get(id)!;
      moth.position.y = 0.18 + Math.sin(this.clock * 2) * 0.15;
      for (const name of ["WingLeft", "WingRight"]) {
        const wing = moth.getObjectByName(name);
        if (wing)
          wing.rotation.y =
            Math.sin(this.clock * 5) * 0.4 * (name === "WingLeft" ? 1 : -1);
      }
    }
    if (this.echo) {
      this.echoNotes.rotation.y += dt * 0.5;
      this.echoNotes.children.forEach(
        (n, i) =>
          (n.position.y = i * 0.23 + Math.sin(this.clock * 1.5 + i) * 0.08),
      );
    }
    const atlas = this.actorMeshes.get("guardian");
    if (atlas?.visible) {
      for (const side of ["ArmLeft", "ArmRight"]) {
        const arm = atlas.getObjectByName(side);
        if (arm)
          arm.rotation.x = T.MathUtils.lerp(
            arm.rotation.x,
            this.guardianIntention === "heavy"
              ? -1.1
              : this.guardianIntention === "rebind"
                ? 0.35
                : 0,
            1 - Math.exp(-dt * 4),
          );
      }
      const ring = atlas.getObjectByName("Ring");
      if (ring)
        ring.rotation.y +=
          dt * (this.guardianIntention === "heavy" ? 0.65 : 0.16);
    }
    if (this.stage === 5) {
      if (this.orrery) this.orrery.rotation.y += dt * 0.12;
      this.awakened.rotation.y += dt * 0.25;
    }
    if (this.effectDuration) {
      this.effectDuration = Math.max(0, this.effectDuration - dt);
      this.effects.update(dt);
      if (!this.effectDuration) this.clearEffect();
    }
    this.renderer.render(this.scene, this.camera);
  };
  diagnostics() {
    const sorted = this.frames.slice().sort((a, b) => a - b),
      q = (v: number) => sorted[Math.floor((sorted.length - 1) * v)] ?? 0;
    const gl = this.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      viewport: [innerWidth, innerHeight],
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      frameMs: {
        p50: q(0.5),
        p95: q(0.95),
        p99: q(0.99),
        samples: sorted.length,
      },
      questPresentation: { echo: this.echo },
      quality: {
        low: this.low,
        shadowSize: this.sun.shadow.mapSize.x,
        surfaceMaterials: this.surfaces.size,
      },
      resources: {
        ...this.renderer.info.memory,
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      },
      loadedAtMs: this.loadedAt,
      loadingErrors: this.loadingErrors,
      position: { ...this.position },
      camera: { yaw: this.yaw, pitch: this.pitch, distance: this.distance },
      effectChildren: this.fx.children.length,
    };
  }
}
