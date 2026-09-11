# Exploration response

`src/render/traversal.ts` owns three small movement profiles and three camera profiles. It is presentation/controller code, independent of battle rules and server state. No new physics dependency or jump system.

Development URL parameters: `?movement=baseline|snappy|weighty&camera=manual|gentle|adventure`. Production ignores these parameters. Normal defaults are snappy/gentle after the recorded comparison.

All profiles retain normalized diagonals and existing static collision. Snappy: 3.8 m/s walk, 6 m/s sprint, acceleration 30 m/s², braking 38 m/s², short facing interpolation. Weighty: acceleration 13, braking 18, slower turns. Baseline retains immediate velocity/facing and 3.8 m/s without a sprint increase. Shift is remappable and held; no stamina. Gates/blur stop input; closed menus cannot preserve residual velocity.

Manual drag wins immediately and grants 2.2 seconds of automatic-yaw grace after release. Gentle starts following after 0.8 seconds of forward travel, 1.25 seconds sideways and 2.5 seconds backward. Adventure follows faster. Brief backward motion retains the current view. Reduced motion disables automatic yaw. Recenter smoothly moves behind the mage's current facing; battle framing is unchanged.

While a direction remains held, its world heading is retained during automatic yaw. New directional input uses the current camera, and manual orbit updates the input basis. This prevents feedback where camera-relative strafing and automatic yaw form an unintended circle.

The existing server permits 7 m/s sustained movement with bounded credit, above the 6 m/s sprint maximum. No faster server loop, movement persistence, new message field or packet-per-frame behavior. Remote gait derives from interpolated displacement; no remote animation acknowledgement controls movement.

## Animation source

Re-inspected the exact locally acquired `animations-standard.zip` and extracted Standard bundle, 11 September 2026. Bundled `License.txt` says CC0 1.0 Universal. README distinguishes `UAL1_Standard.glb` (root motion disabled) from `_RM`. Available clips include `Jog_Fwd_Loop`, `Sprint_Loop`, and jump start/loop/land. Incorporated only `Sprint_Loop` as `Sprint`, using the existing compatible rig and export pipeline. Creator Quaternius; source-page collaboration credit Gonzalo Furnier; archive originally acquired 10 September (see asset manifest). No new download, purchase, Source edition or additional source asset distribution.

`scripts/art-wizard.py` now exports Sprint; its existing editable `.blend` is written only with `--save-source`. Run the existing resize/dedup/prune/tint steps after export. The missing source eye-normal warning is historical; the authoring script removes that normal mapping. Runtime must have no missing texture requests.

## Jump decision

Not justified yet. The courtyard has no traversable ledges or platforming purpose. Free jump clips alone do not justify gravity, grounded collision, extra authority or a normal-play jump button. No jump toy was added.

## Comparison

`node tests/traversal-compare.mjs` records the same real input sequence for baseline/manual, snappy/manual, weighty/manual, snappy/gentle and snappy/adventure. Videos, screenshots and read-only position/yaw samples live in ignored `evidence/local/traversal-final`. Record selection and limitations in the final refinement report; do not infer human feel from unit tests.

### Inspected result

Provisional choice: **Snappy + Gentle Follow**. Sequential frames from the five videos show the weightier profile carrying more motion through the brief reverse; Snappy offers a quicker correction. Adventure reorients the courtyard more aggressively after sustained reverse and gives less opportunity to retain the previous view. Gentle keeps the brief reverse view and visibly recovers behind sustained sideways travel after manual grace. This is an agent motion inspection, not a human feel verdict.

On the final real-input route, both automatic profiles held the manual yaw unchanged for the 1.1-second grace sample. After 2.4 more seconds, Gentle recovered about 1.34 radians and Adventure about 1.54 radians toward travel. Snappy/weighty reached 6 m/s sprint; baseline stayed at 3.8. All stopped by the 350 ms post-release sample. Input routes diverge spatially as camera behavior differs and encounter some garden/boundary collision; these are not identical camera-space trajectories or precise latency measurements.

An initial capture driver accidentally held movement keys during screenshot encoding. Those recordings are retained locally as diagnostic failures, excluded from the final comparison. The corrected driver uses video and quick read-only samples, then takes a screenshot after releasing movement. A facade pull-in was added after reproducing a through-wall view. It handles the two existing study strips, not arbitrary geometry; trees can still briefly obscure the player.

Verified: fresh skimming journey with default traversal; typecheck/build; focused movement/disclosure tests; complete mixed-tradition book duo through real local DO/UI (lesson 2 rounds, guardian 6), including actual sprint relay and no authority correction. Final aggregate evidence belongs in the refinement report.
