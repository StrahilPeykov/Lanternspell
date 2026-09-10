$ErrorActionPreference='Stop'
& node_modules/.bin/gltf-transform.cmd resize public/assets/wizard.glb art/wizard-sized.glb --width 512 --height 512
& node_modules/.bin/gltf-transform.cmd dedup art/wizard-sized.glb art/wizard-dedup.glb
& node_modules/.bin/gltf-transform.cmd prune art/wizard-dedup.glb art/wizard-pruned.glb
node scripts/art-tint.mjs
Copy-Item -LiteralPath art/wizard-final.glb -Destination public/assets/wizard.glb -Force
& node_modules/.bin/gltf-transform.cmd dedup public/assets/observatory.glb art/observatory-dedup.glb
& node_modules/.bin/gltf-transform.cmd prune art/observatory-dedup.glb public/assets/observatory.glb
