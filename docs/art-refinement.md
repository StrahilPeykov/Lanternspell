# Courtyard inhabitation refinement — 2026-09-11

The prior runtime capture made the twelve tall study openings read as black voids. The generated concept instead used warm windows, visible books and broad architectural detail to suggest people working nearby. The refinement keeps the current Bellweather architecture and circulation, but gives those openings an understandable use.

`scripts/benchmark-art.py` now places opaque parchment-wash glazing behind the existing fanlights and mullions. Alternate openings contain lower bookcases or gathered terracotta curtains with books left on the sill. These are shallow facade treatments, not new accessible interiors. They share the existing ten materials and 128px packed wash textures; they add no transparent surfaces, lights, interaction markers or runtime animation. Broad brass rays in the book-dial basin improve its reading as an instrument from the follow camera.

Small architectural bevels use one segment instead of two. Thin decorative curve tubes use four sides, rings use 32×6 segments and hour studs use 12×6 segments. The larger silhouettes, arch voussoirs, facade footprint, archive and reading-pocket positions are preserved. These settings apply only to courtyard generation, leaving the Atlas and accessory authoring quality unchanged.

## Scoped rebuild

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/benchmark-art.py -- courtyard
node scripts/benchmark-art-optimize.mjs courtyard
```

The script is authoritative; no new `.blend`, external source, vendor download or license dependency was introduced. All new facade geometry is original project-authored work. Resource counts alone do not establish frame-rate performance or artistic success.

## Export evidence

Blender 5.2.1 export and glTF Transform dedup/prune completed successfully. Courtyard triangles fell from 50,991 to **26,815** (47.4% fewer) while keeping **10 primitives, 10 materials and 10 packed 128px textures**. The optimized GLB is **1,990,116 bytes**, previously approximately 3.43 MB. Named material batches, unit scale and ground-origin Y-up convention remain unchanged. Neither `guardian.glb` nor `mage-accessories.glb` was regenerated. Integrated runtime screenshots, motion and hardware measurements belong to the lead's final inspection; this export check alone is not visual acceptance.

## Runtime surroundings

The integrated environment uses quieter broad-wash paving with narrower joints and subdued mortar. Flower heads vary in height above paired folded leaves. Low overlapping hills leave clear sky behind the orrery. Distant trees/hills and tiny flowers neither cast nor receive shadows; nearby cypresses keep their shadow contribution. Leaf position/normal/UV attributes match the other static geometry so the shared material batch remains valid. The current High and Low browser captures show the warm glazing, books and curtains correctly; no scene warnings were recorded.
