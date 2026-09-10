# Art implementation and resume

Original landmark: a compact ivory observatory with aged-brass meridians, a blue slate dome, carved portal, cedar door, warm low wings, and terracotta planters. A silhouette visible above courtyard roofs gives the short route a destination. Materials use packed low-frequency brushed color variation; simple glTF PBR surfaces, no Blender procedural shader dependency.

Mage: readable human face, short jacket/capelet, trousers, gloves, boots, personal book and bent brim hat. CC0 Quaternius components are credited in the manifest. Identity material is named `Identity`; its packed texture is neutral grayscale with a teal base-color factor. Runtime material.color.set can directly choose teal or coral. The post-export art-tint script enforces this contract. Character faces +Z in exported glTF. Ground is Y=0; body is approximately 1.78m and hat reaches 2.12m. Landmark front faces +Z; height 9.52m, main radius 4.8m, low wing extents about ±5.5m. Origin sits at world ground.

AnimationMixer clips are `Idle` (2.5s), `Walk` (~1.333s), `Cast` (0.5s). Cast is suitable for a short gesture inside a longer effect sequence. They are in-place deformation-bone clips. Movement distance remains the exploration controller's responsibility; adjust walk playback speed to gait. Staff is bone-bound to the carry hand, with the carry arm preserved during the modified cast. Clone skinned wizard instances with SkeletonUtils.clone, not Object3D.clone.

Runtime GLB optimization uses glTF Transform resize (wizard source image maximum 512px), dedup, prune. Observatory about 999 KB; wizard about 3.5 MB before HTTP compression. These are file measurements, not GPU-performance claims. Packed wash textures are 128px. No Draco/KTX decoder added without a measured need. glTF color textures are sRGB; Three GLTFLoader handles them. Do not double-linearize them. Current asset viewer uses ACES, exposure 1.25, hemisphere plus warm directional light.

Blender 5.2.1 LTS, official glTF exporter v5.2.40, glTF Transform 4.5.0. Rebuild from project root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/art-build.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/art-wizard.py
& scripts/art-optimize.ps1
```

The wizard script requires the acquired Standard archives extracted under ignored `art/vendor/base-standard`, `outfits-standard`, and `animations-standard`, retaining archive folder names. Copies already exist locally. On a clean machine, use each official source page's free Standard download and extract in those locations; never buy the Source edition for this build.

Asset-only visual inspection (separate from lead's integrated-game QA): `public/assets/art-preview.html`, `scripts/art-preview.mjs`; start Vite on 5182, run `node scripts/art-preview.mjs`. This inspects Idle/Walk/Cast and landmark in real Chromium WebGL, with screenshots under ignored `art/preview-*.png`. No network mocking. Image-based inspection corrected a capelet intersection and a staff/cast attachment problem. It does not establish human enjoyment, 60 FPS, weak-device suitability, or full-game transitions.

Known art limits: face is stylized but retains the source superhero proportions; no facial performance. Cloth is skinned/rigid with no simulation. The half-second cast needs runtime crossfades and can be slowed modestly. Coarse sleeve/cape intersections may remain at extreme frames. Motion should be revisited at final movement speed and camera distance in the integrated game. Landmark is an exterior; doors and windows are architectural scenery, with a separately implemented shared quest change.

