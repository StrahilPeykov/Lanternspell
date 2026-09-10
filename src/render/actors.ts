import * as T from "three";
/** Compatible deformation rig plus original light accessory sidecars; no duplicate animation pipeline. */
export function dressActor(
  actor: T.Object3D,
  accessories: T.Object3D,
  role: "player" | "partner" | "iona",
) {
  if (role === "player") return;
  const hide = [
    "Bent tailored crown",
    "Traveler brim",
    "Hat band",
    "Hat enamel pin",
    ...(role === "iona"
      ? [
          "Rowan staff",
          "Staff lantern",
          "Staff open circle",
          "Short scholar capelet",
        ]
      : []),
  ].map((n) => n.replaceAll(" ", "_"));
  actor.traverse((o) => {
    if (hide.some((n) => o.name === n || o.name.startsWith(n + "_")))
      o.visible = false;
  });
  actor.updateMatrixWorld(true);
  for (const [name, bone] of role === "iona"
    ? [
        ["IonaHead", "Head"],
        ["IonaApron", "spine_03"],
      ]
    : [
        ["PartnerHead", "Head"],
        ["PartnerMantle", "spine_03"],
      ]) {
    const source = accessories.getObjectByName(name),
      joint = actor.getObjectByName(bone);
    if (!source || !joint) continue;
    const added = source.clone(true);
    added.traverse((o) => {
      if (o instanceof T.Mesh) o.castShadow = true;
    });
    actor.add(added);
    actor.updateMatrixWorld(true);
    joint.attach(added);
  }
}
