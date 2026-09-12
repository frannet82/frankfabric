"use client";

// ---------------------------------------------------------------------------
// Digital Wardrobe — interactive 3D scene (real rigged VRM avatar).
//
// The avatar is a real rigged VRM humanoid ("Seed-san") loaded with
// @pixiv/three-vrm. We adopt the loading/animation approach used by
// CharacterStudio (https://github.com/M3-org/CharacterStudio, MIT): create a
// three GLTFLoader, register the VRMLoaderPlugin, read the parsed avatar from
// `gltf.userData.vrm`, and call `vrm.update(delta)` every frame so the rig's
// SpringBones and lookAt animate. We adopt the APPROACH, not the editor code.
//
// Interactivity is driven directly on the loaded VRM:
//   * "outfit" recolors the avatar's built-in clothing materials live, and
//   * bottom / shoes / hat overlay lightweight procedural garment meshes that
//     are parented to the VRM's humanoid bones (via
//     vrm.humanoid.getNormalizedBoneNode(...)) so they track the rig.
//
// The bundled .vrm is loaded through lib/asset.ts's asset() helper so its URL
// carries the deployment base path (/frankfabric/ in production).
//
// This component touches the DOM/WebGL (react-three-fiber <Canvas />) and is
// therefore imported by WardrobeBuilder.tsx via next/dynamic with
// { ssr: false } so it never runs during Next.js static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  MToonMaterial,
  type VRM,
  type VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { asset } from "@/lib/asset";

export type Category = "outfit" | "bottom" | "shoes" | "hat";

// Which humanoid animation the avatar plays. "rest" means no clip is playing
// (the avatar stays in its idle rest pose while the scene auto-rotates); the
// others map to the retargeted FBX clips bundled in public/animations/.
export type WardrobeAnimation = "rest" | "idle" | "walking" | "waving";

// FBX animation clips (Mixamo-style humanoid rigs, sourced from
// frannet82/assets loot/animations). Loaded client-side only via FBXLoader and
// retargeted onto the VRM humanoid — see loadRetargetedClip below. URLs are
// base-path-prefixed so they resolve under /frankfabric/ in production.
const ANIMATION_URLS: Record<Exclude<WardrobeAnimation, "rest">, string> = {
  idle: asset("/animations/idle.fbx"),
  walking: asset("/animations/walking.fbx"),
  waving: asset("/animations/waving.fbx"),
};

export type WardrobeSelection = Record<Category, number>;
export type WardrobeColors = Record<Category, string>;

// Option 0 is always "None" (or the avatar's default) for each category.
//
// "outfit" recolors the avatar's built-in clothing (the VRM `wear` mesh) and,
// beyond "Default", toggles a bone-anchored procedural layer over it. The
// bottom / shoes / hat categories overlay procedural garments parented to the
// rig, so every option shown below has a visible effect.
export const OPTIONS: Record<Category, string[]> = {
  outfit: ["Default", "Jacket", "Vest"],
  bottom: ["None", "Trousers", "Shorts", "Skirt"],
  shoes: ["None", "Sneakers", "Boots"],
  hat: ["None", "Cap", "Beanie"],
};

// Model path is base-path-prefixed so it resolves to
// /frankfabric/models/seed-san.vrm in production and /models/seed-san.vrm in
// dev. NEVER hardcode a bare "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/seed-san.vrm");

// The VRM `wear` mesh materials make up the avatar's clothing; recoloring these
// (and nothing on skin/face/hair) is what the "outfit colour" control drives.
const CLOTHING_MATERIAL_NAMES = new Set([
  "huku_bake",
  "wear_metal",
  "armgear_plastic",
  "backpack_metal",
  "backpack_nm",
  "backpack_plastic",
]);

type SceneProps = {
  selection: WardrobeSelection;
  colors: WardrobeColors;
  animation: WardrobeAnimation;
};

// Real-world garment measurements derived from the loaded VRM at runtime.
// Every value is expressed in the LOCAL space of the bone the garment is
// parented to, so garments fit regardless of the VRM's overall scale.
type Measurements = {
  // Torso (chest-bone local space).
  torsoRadius: number; // half of the shoulder/chest width
  torsoHeight: number; // chest → hips vertical span
  shoulderX: number; // horizontal offset for a sleeve at the shoulder
  // Hips / legs (hips-bone local space).
  hipRadius: number; // half of the hip width
  legLength: number; // hip → ankle vertical span
  legSpacingX: number; // horizontal offset from hip centre to each leg
  legRadius: number; // radius of a single leg
  // Feet (foot-bone local space).
  footLength: number; // heel → toe
  footWidth: number; // side-to-side
  ankleHeight: number; // foot → lower-leg (for boot shafts)
  soleY: number; // foot-node height above the ground (sole offset)
  // Head (head-bone local space).
  headRadius: number; // half of the head width
  crownY: number; // head-node → top-of-skull vertical offset
};

// Sensible fallbacks (roughly a 1.0-scale humanoid) used only if a bone or a
// bounding box is somehow unavailable, so the scene never renders empty.
const DEFAULT_MEASUREMENTS: Measurements = {
  torsoRadius: 0.16,
  torsoHeight: 0.26,
  shoulderX: 0.17,
  hipRadius: 0.15,
  legLength: 0.7,
  legSpacingX: 0.09,
  legRadius: 0.07,
  footLength: 0.22,
  footWidth: 0.09,
  ankleHeight: 0.12,
  soleY: 0.08,
  headRadius: 0.09,
  crownY: 0.12,
};

// Derive garment measurements from the loaded VRM. We read world-space bone
// positions from the humanoid rig and world-space extents from THREE.Box3
// bounding boxes, then convert everything into each anchor bone's LOCAL space
// by dividing world distances by that bone node's world scale. This keeps
// garments correctly sized even if the VRM is uniformly scaled.
function deriveMeasurements(vrm: VRM): Measurements {
  const humanoid = vrm.humanoid;
  if (!humanoid) return DEFAULT_MEASUREMENTS;

  const boneWorld = (name: VRMHumanBoneName): THREE.Vector3 | null => {
    const node = humanoid.getNormalizedBoneNode(name);
    if (!node) return null;
    return node.getWorldPosition(new THREE.Vector3());
  };

  // World scale of a bone node (garments are its children, so their local
  // units are magnified by this scale — divide world distances by it).
  const boneScale = (name: VRMHumanBoneName): number => {
    const node = humanoid.getNormalizedBoneNode(name);
    if (!node) return 1;
    const s = node.getWorldScale(new THREE.Vector3());
    return (s.x + s.y + s.z) / 3 || 1;
  };

  const hips = boneWorld("hips" as VRMHumanBoneName);
  const chest =
    boneWorld("chest" as VRMHumanBoneName) ??
    boneWorld("spine" as VRMHumanBoneName);
  const neck = boneWorld("neck" as VRMHumanBoneName);
  const head = boneWorld("head" as VRMHumanBoneName);
  const leftUpperLeg = boneWorld("leftUpperLeg" as VRMHumanBoneName);
  const leftFoot = boneWorld("leftFoot" as VRMHumanBoneName);
  const leftUpperArm = boneWorld("leftUpperArm" as VRMHumanBoneName);
  const rightUpperArm = boneWorld("rightUpperArm" as VRMHumanBoneName);

  // Whole-body bounding box (world space) for width/height fallbacks.
  const bodyBox = new THREE.Box3().setFromObject(vrm.scene);
  const bodySize = bodyBox.getSize(new THREE.Vector3());
  const bodyHeight = bodySize.y || 1.5;

  const m: Measurements = { ...DEFAULT_MEASUREMENTS };

  // --- Torso (chest-bone local space) ------------------------------------
  const chestScale = boneScale("chest" as VRMHumanBoneName);
  // Shoulder width from the two upper-arm bones, else a fraction of body width.
  const shoulderWorld =
    leftUpperArm && rightUpperArm
      ? leftUpperArm.distanceTo(rightUpperArm)
      : bodySize.x * 0.55;
  m.torsoRadius = (shoulderWorld * 0.62) / chestScale;
  m.shoulderX = (shoulderWorld * 0.55) / chestScale;
  if (chest && hips) {
    m.torsoHeight = (chest.distanceTo(hips) * 1.35) / chestScale;
  }

  // --- Hips / legs (hips-bone local space) -------------------------------
  const hipScale = boneScale("hips" as VRMHumanBoneName);
  const hipWorld = shoulderWorld * 0.9; // hips a touch narrower than shoulders
  m.hipRadius = (hipWorld * 0.55) / hipScale;
  if (leftUpperLeg && hips) {
    m.legSpacingX = (Math.abs(leftUpperLeg.x - hips.x)) / hipScale;
  } else {
    m.legSpacingX = m.hipRadius * 0.55;
  }
  if (hips && leftFoot) {
    m.legLength = (Math.abs(hips.y - leftFoot.y)) / hipScale;
  } else {
    m.legLength = (bodyHeight * 0.48) / hipScale;
  }
  m.legRadius = m.legSpacingX * 0.72;

  // --- Feet (foot-bone local space) --------------------------------------
  const footScale = boneScale("leftFoot" as VRMHumanBoneName);
  // Approximate foot length from body height (~15%); width ~40% of length.
  m.footLength = (bodyHeight * 0.15) / footScale;
  m.footWidth = m.footLength * 0.42;
  // Ankle → ground drop. Use a scale-invariant DIFFERENCE (foot node down to
  // the scene's floor plane, bodyBox.min.y) rather than the foot node's raw
  // world Y, so the shoe underside lands at ground level regardless of where
  // the model's origin sits. Fall back to a proportional guess if the foot
  // bone or a sane bounding box is unavailable, and clamp to a positive drop.
  const footToFloor =
    leftFoot && Number.isFinite(bodyBox.min.y)
      ? leftFoot.y - bodyBox.min.y
      : null;
  m.soleY =
    footToFloor != null && footToFloor > 1e-4
      ? footToFloor / footScale
      : m.footLength * 0.4;
  // Ankle/lower-leg height for a boot shaft.
  if (leftFoot && leftUpperLeg) {
    m.ankleHeight = (Math.abs(leftFoot.y - leftUpperLeg.y) * 0.32) / footScale;
  } else {
    m.ankleHeight = m.footLength * 0.7;
  }

  // --- Head (head-bone local space) --------------------------------------
  const headScale = boneScale("head" as VRMHumanBoneName);
  // Head radius from the head → crown span, else a fraction of body height.
  let headSpanWorld = bodyHeight * 0.09;
  if (head) {
    headSpanWorld = Math.max(bodyBox.max.y - head.y, headSpanWorld);
  } else if (neck && head) {
    headSpanWorld = neck.distanceTo(head as THREE.Vector3);
  }
  m.headRadius = (headSpanWorld * 0.62) / headScale;
  m.crownY = (headSpanWorld * 0.55) / headScale;

  return m;
}

// ---------------------------------------------------------------------------
// Mixamo -> VRM animation retargeting.
//
// The bundled FBX clips are authored on a Mixamo-style humanoid whose bones are
// named "mixamorigHips", "mixamorigSpine", "mixamorigLeftUpLeg", etc. To play
// them on the VRM we follow the well-known three-vrm Mixamo remap pattern
// (https://github.com/pixiv/three-vrm examples): for each Mixamo bone we look
// up the corresponding VRM humanoid bone via
// vrm.humanoid.getNormalizedBoneNode(<VRMHumanBoneName>), rebuild the clip's
// rotation (quaternion) tracks so they target the normalized bone node names,
// scale the hips position track to the VRM's hip height, and drop any track
// whose bone doesn't map. The resulting clip drives a THREE.AnimationMixer.
// ---------------------------------------------------------------------------
const MIXAMO_TO_VRM_BONE: Record<string, VRMHumanBoneName> = {
  mixamorigHips: "hips" as VRMHumanBoneName,
  mixamorigSpine: "spine" as VRMHumanBoneName,
  mixamorigSpine1: "chest" as VRMHumanBoneName,
  mixamorigSpine2: "upperChest" as VRMHumanBoneName,
  mixamorigNeck: "neck" as VRMHumanBoneName,
  mixamorigHead: "head" as VRMHumanBoneName,
  mixamorigLeftShoulder: "leftShoulder" as VRMHumanBoneName,
  mixamorigLeftArm: "leftUpperArm" as VRMHumanBoneName,
  mixamorigLeftForeArm: "leftLowerArm" as VRMHumanBoneName,
  mixamorigLeftHand: "leftHand" as VRMHumanBoneName,
  mixamorigRightShoulder: "rightShoulder" as VRMHumanBoneName,
  mixamorigRightArm: "rightUpperArm" as VRMHumanBoneName,
  mixamorigRightForeArm: "rightLowerArm" as VRMHumanBoneName,
  mixamorigRightHand: "rightHand" as VRMHumanBoneName,
  mixamorigLeftUpLeg: "leftUpperLeg" as VRMHumanBoneName,
  mixamorigLeftLeg: "leftLowerLeg" as VRMHumanBoneName,
  mixamorigLeftFoot: "leftFoot" as VRMHumanBoneName,
  mixamorigLeftToeBase: "leftToes" as VRMHumanBoneName,
  mixamorigRightUpLeg: "rightUpperLeg" as VRMHumanBoneName,
  mixamorigRightLeg: "rightLowerLeg" as VRMHumanBoneName,
  mixamorigRightFoot: "rightFoot" as VRMHumanBoneName,
  mixamorigRightToeBase: "rightToes" as VRMHumanBoneName,
};

// Build a VRM-compatible AnimationClip from a raw Mixamo FBX clip. Returns null
// if no tracks could be mapped (e.g. an unexpected rig), so callers can skip.
function retargetMixamoClip(
  asset3d: THREE.Group,
  clip: THREE.AnimationClip,
  vrm: VRM
): THREE.AnimationClip | null {
  const humanoid = vrm.humanoid;
  if (!humanoid) return null;

  const tracks: THREE.KeyframeTrack[] = [];

  // Restspace correction: Mixamo hips vs VRM hips height, so the root motion of
  // the hips position track is scaled into the VRM's proportions.
  const motionHipsNode = asset3d.getObjectByName("mixamorigHips");
  const vrmHipsNode = humanoid.getNormalizedBoneNode(
    "hips" as VRMHumanBoneName
  );
  const motionHipsHeight = motionHipsNode
    ? motionHipsNode.getWorldPosition(new THREE.Vector3()).y
    : 1;
  const vrmHipsHeight = vrmHipsNode
    ? vrmHipsNode.getWorldPosition(new THREE.Vector3()).y
    : 1;
  const hipsScale =
    motionHipsHeight > 1e-6 ? vrmHipsHeight / motionHipsHeight : 1;

  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();

  for (const track of clip.tracks) {
    // Track names look like "mixamorigLeftArm.quaternion".
    const trackSplit = track.name.split(".");
    const mixamoBoneName = trackSplit[0];
    const propertyName = trackSplit[1];
    const vrmBoneName = MIXAMO_TO_VRM_BONE[mixamoBoneName];
    if (!vrmBoneName) continue;

    const vrmNode = humanoid.getNormalizedBoneNode(vrmBoneName);
    if (!vrmNode) continue;
    const vrmNodeName = vrmNode.name;

    const mixamoNode = asset3d.getObjectByName(mixamoBoneName);
    if (!mixamoNode) continue;

    if (propertyName === "quaternion") {
      // Rebuild rotation into the VRM bone's rest frame.
      mixamoNode.getWorldQuaternion(restRotationInverse).invert();
      mixamoNode.parent?.getWorldQuaternion(parentRestWorldRotation);

      const quatTrack = track as THREE.QuaternionKeyframeTrack;
      const values = Array.from(quatTrack.values);
      for (let i = 0; i < values.length; i += 4) {
        _quatA.fromArray(values, i);
        _quatA
          .premultiply(parentRestWorldRotation)
          .multiply(restRotationInverse);
        _quatA.toArray(values, i);
      }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.quaternion`,
          Array.from(quatTrack.times),
          values
        )
      );
    } else if (propertyName === "position" && vrmBoneName === "hips") {
      // Only the hips carry meaningful translation; scale it to the VRM rig.
      const posTrack = track as THREE.VectorKeyframeTrack;
      const values = Array.from(posTrack.values).map((v) => v * hipsScale);
      // VRM 1.0 avatars face +Z like Mixamo, so no axis flip is needed here.
      void _vec3;
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.position`,
          Array.from(posTrack.times),
          values
        )
      );
    }
  }

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip(clip.name || "mixamo", clip.duration, tracks);
}

// Apply a hex color to a material, covering both standard three materials and
// @pixiv/three-vrm's MToon materials (which expose their own `color` uniform).
function applyColor(material: THREE.Material, hex: string) {
  const color = new THREE.Color(hex);
  if (material instanceof MToonMaterial) {
    material.color.copy(color);
    material.needsUpdate = true;
    return;
  }
  const std = material as THREE.MeshStandardMaterial;
  if (std.color) {
    std.color.copy(color);
    std.needsUpdate = true;
  }
}

// Parent a procedural garment to a VRM humanoid bone so it tracks the rig.
function GarmentOnBone({
  vrm,
  bone,
  children,
}: {
  vrm: VRM;
  bone: VRMHumanBoneName;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const node = vrm.humanoid?.getNormalizedBoneNode(bone);
    const group = groupRef.current;
    if (!node || !group) return;
    node.add(group);
    return () => {
      node.remove(group);
    };
  }, [vrm, bone]);

  return <group ref={groupRef}>{children}</group>;
}

// Trousers / Shorts / Skirt — anchored to the hips bone, sized from the rig's
// real hip width and leg length (all in hips-bone local space).
function Trousers({
  option,
  color,
  m,
}: {
  option: number;
  color: string;
  m: Measurements;
}) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.6} />;
  // The hips bone sits mid-pelvis; garments hang downward from there.
  if (option === 3) {
    // Skirt — a flared cone that starts at the real hip radius and drops to
    // roughly knee height (~55% of the full leg length).
    const skirtLength = m.legLength * 0.55;
    return (
      <mesh position={[0, -skirtLength / 2, 0]} castShadow>
        <coneGeometry args={[m.hipRadius * 1.45, skirtLength, 24, 1, true]} />
        {mat}
      </mesh>
    );
  }
  // Trousers span hip → ankle; shorts stop at mid-thigh (~45% of leg length).
  const legLength = option === 2 ? m.legLength * 0.45 : m.legLength * 0.92;
  const legY = -legLength / 2;
  return (
    <group>
      {/* Waistband/pelvis wrap sized to the real hip radius. */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry
          args={[m.hipRadius, m.hipRadius * 0.94, m.hipRadius * 0.9, 20]}
        />
        {mat}
      </mesh>
      {[-m.legSpacingX, m.legSpacingX].map((x) => (
        <mesh key={x} position={[x, legY, 0]} castShadow>
          <capsuleGeometry args={[m.legRadius, legLength, 6, 12]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}

// Shoe / Boot — anchored to a foot bone. The foot node sits at ankle height
// above the sole (m.soleY), so the shoe body drops to the ground and extends
// forward along +Z by the real foot length.
//
// AXIS ASSUMPTION: the toe box extends along +Z and the sole drops along -Y in
// the foot bone's LOCAL frame. @pixiv/three-vrm's *normalized* humanoid rig
// (which we anchor to via getNormalizedBoneNode) rebuilds every bone with a
// canonical rest-pose orientation — identity-aligned to the model's world axes
// with +Z forward and +Y up — so this holds for Seed-san and any spec-conformant
// VRM. A non-standard rig whose normalized foot bone was rotated would push the
// toe off-axis; if that ever surfaces, orient this group from the bone's world
// quaternion instead. Kept assumption-only here to avoid extra per-frame math.
function Shoe({
  option,
  color,
  m,
}: {
  option: number;
  color: string;
  m: Measurements;
}) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.5} />;
  const boot = option === 2; // Boots rise over the ankle.
  const soleThickness = m.footLength * 0.32;
  // Drop the shoe so its underside sits at ground level under the ankle node.
  const soleTopY = -m.soleY + soleThickness / 2;
  return (
    <group>
      {/* Main shoe body: heel-to-arch, forward along +Z. */}
      <mesh position={[0, soleTopY, m.footLength * 0.12]} castShadow>
        <boxGeometry args={[m.footWidth, soleThickness, m.footLength * 0.7]} />
        {mat}
      </mesh>
      {/* Toe box, extending toward the toes (+Z). */}
      <mesh
        position={[0, soleTopY + soleThickness * 0.1, m.footLength * 0.5]}
        castShadow
      >
        <boxGeometry
          args={[m.footWidth, soleThickness * 0.85, m.footLength * 0.42]}
        />
        {mat}
      </mesh>
      {boot && (
        // Boot shaft rising from the ankle node up the lower leg.
        <mesh position={[0, m.ankleHeight / 2, 0]} castShadow>
          <cylinderGeometry
            args={[m.footWidth * 0.55, m.footWidth * 0.6, m.ankleHeight, 16]}
          />
          {mat}
        </mesh>
      )}
    </group>
  );
}

// Cap / Beanie — anchored to the head bone, sized from the real head radius
// and sitting on the crown (m.crownY above the head node).
//
// AXIS ASSUMPTION: the crown offset is applied along +Y and the cap brim along
// +Z in the head bone's LOCAL frame. As with the shoe above, three-vrm's
// normalized humanoid gives every bone a canonical rest orientation (+Y up,
// +Z forward) aligned to the model, so the cap sits on top of the skull and the
// brim points forward for Seed-san and any spec-conformant VRM.
function Hat({
  option,
  color,
  m,
}: {
  option: number;
  color: string;
  m: Measurements;
}) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.55} />;
  const r = m.headRadius * 1.06; // hug the skull with a hair of clearance
  if (option === 2) {
    // Beanie — a snug rounded cap covering the crown and ears.
    return (
      <mesh position={[0, m.crownY * 0.72, 0]} castShadow>
        <sphereGeometry args={[r, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
        {mat}
      </mesh>
    );
  }
  // Cap — dome plus a forward brim, both scaled to the head radius.
  return (
    <group>
      <mesh position={[0, m.crownY * 0.8, 0]} castShadow>
        <sphereGeometry args={[r, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh
        position={[0, m.crownY * 0.8 - r * 0.02, r * 1.05]}
        rotation={[0.08, 0, 0]}
        castShadow
      >
        <boxGeometry args={[r * 1.1, r * 0.14, r * 0.8]} />
        {mat}
      </mesh>
    </group>
  );
}

// The "Jacket"/"Vest" outfit overlay wraps the torso, anchored to the chest
// bone and sized from the real torso radius/height.
function OutfitLayer({
  option,
  color,
  m,
}: {
  option: number;
  color: string;
  m: Measurements;
}) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />;
  const withSleeves = option === 1; // Jacket has short sleeves; Vest does not.
  // Capsule body: cylindrical section = torso height, capped by the radius.
  const bodyHeight = Math.max(m.torsoHeight - m.torsoRadius, m.torsoRadius);
  return (
    <group position={[0, -m.torsoHeight * 0.12, 0.005]}>
      <mesh position={[0, 0, 0.01]} castShadow>
        <capsuleGeometry args={[m.torsoRadius, bodyHeight, 6, 20]} />
        {mat}
      </mesh>
      {withSleeves &&
        [-m.shoulderX, m.shoulderX].map((x) => (
          <mesh
            key={x}
            position={[x, m.torsoHeight * 0.32, 0]}
            rotation={[0, 0, x < 0 ? 0.35 : -0.35]}
            castShadow
          >
            <capsuleGeometry
              args={[m.torsoRadius * 0.34, m.torsoHeight * 0.55, 6, 12]}
            />
            {mat}
          </mesh>
        ))}
    </group>
  );
}

function Avatar({ selection, colors, animation }: SceneProps) {
  const gltf = useLoader(
    GLTFLoader,
    MODEL_URL,
    (loader) => {
      loader.register(
        (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
      );
    }
  );

  const vrm = gltf.userData.vrm as VRM;

  // One-time rig prep: optimise the scene, drop unneeded joints, orient the
  // avatar to face the camera. Seed-san is VRM 1.0 (already faces +Z), so no
  // 180° flip is needed — but we frustum-cull-disable for reliable draws.
  useMemo(() => {
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return vrm;
  }, [vrm]);

  // Clone the clothing materials once so recoloring the outfit never bleeds
  // into skin/face/hair (which may share a source material instance).
  const clothingMaterials = useMemo(() => {
    const mats: THREE.Material[] = [];
    vrm.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((mat, i) => {
        if (!mat || !CLOTHING_MATERIAL_NAMES.has(mat.name)) return;
        const cloned = mat.clone();
        cloned.name = mat.name;
        if (Array.isArray(mesh.material)) {
          mesh.material[i] = cloned;
        } else {
          mesh.material = cloned;
        }
        mats.push(cloned);
      });
    });
    return mats;
  }, [vrm]);

  // Recolor the avatar's built-in clothing live from the outfit colour control.
  useEffect(() => {
    clothingMaterials.forEach((mat) => applyColor(mat, colors.outfit));
  }, [clothingMaterials, colors.outfit]);

  // Dispose GPU resources when the avatar unmounts (route changes) to avoid
  // leaks — VRMUtils.deepDispose walks the whole scene graph.
  useEffect(() => {
    return () => {
      VRMUtils.deepDispose(vrm.scene);
    };
  }, [vrm]);

  // Derive Seed-san's real proportions from the loaded VRM once (bone world
  // positions + bounding boxes, converted into each anchor bone's local
  // space). Garment components size/offset themselves from these values so
  // clothing fits the actual body instead of relying on magic numbers.
  const measurements = useMemo(() => deriveMeasurements(vrm), [vrm]);

  // --- Animation: load + retarget the Mixamo FBX clips -------------------
  //
  // useLoader with FBXLoader runs entirely client-side (this whole component
  // is loaded via next/dynamic { ssr:false }, so FBXLoader never executes
  // during static generation). Each raw FBX is retargeted onto the VRM
  // humanoid via retargetMixamoClip and driven by a single AnimationMixer.
  const idleFbx = useLoader(FBXLoader, ANIMATION_URLS.idle);
  const walkingFbx = useLoader(FBXLoader, ANIMATION_URLS.walking);
  const wavingFbx = useLoader(FBXLoader, ANIMATION_URLS.waving);

  // All mutable playback state (mixer + per-clip actions + the action that is
  // currently faded in) lives in a single ref that this component owns and
  // mutates. Keeping it in a ref — rather than in useMemo return values — keeps
  // the AnimationAction mutations (reset/fadeIn/play) off React-tracked values.
  const playback = useRef<{
    mixer: THREE.AnimationMixer;
    actions: Record<Exclude<WardrobeAnimation, "rest">, THREE.AnimationAction | null>;
  } | null>(null);
  // The action currently faded in (null at rest). Its own ref so the crossfade
  // effect only mutates `ref.current`, which is a permitted ref write.
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // (Re)build the mixer and retargeted actions whenever the avatar or a loaded
  // FBX changes. Retargeting maps each Mixamo clip onto the VRM humanoid bones.
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const build = (fbx: THREE.Group): THREE.AnimationAction | null => {
      const raw = fbx.animations?.[0];
      if (!raw) return null;
      const clip = retargetMixamoClip(fbx, raw, vrm);
      return clip ? mixer.clipAction(clip) : null;
    };
    playback.current = {
      mixer,
      actions: {
        idle: build(idleFbx),
        walking: build(walkingFbx),
        waving: build(wavingFbx),
      },
    };
    currentAction.current = null;
    return () => {
      mixer.stopAllAction();
      playback.current = null;
      currentAction.current = null;
    };
  }, [vrm, idleFbx, walkingFbx, wavingFbx]);

  // Crossfade to the requested clip when `animation` changes; "rest" fades all
  // actions out so the avatar returns to its rest pose.
  useEffect(() => {
    const state = playback.current;
    if (!state) return;
    const next = animation === "rest" ? null : state.actions[animation];
    const prev = currentAction.current;
    if (next === prev) return;

    const FADE = 0.35;
    if (next) {
      // reset() re-enables the action and zeroes its time/weight; fadeIn then
      // ramps its weight to 1 over FADE seconds as we play it.
      next.reset();
      next.setEffectiveWeight(1);
      next.fadeIn(FADE);
      next.play();
    }
    if (prev) {
      prev.fadeOut(FADE);
    }
    currentAction.current = next;
  }, [animation, idleFbx, walkingFbx, wavingFbx, vrm]);

  // CharacterStudio's per-frame update contract: advance the animation mixer
  // first (which poses the normalized humanoid bones), then vrm.update(delta)
  // so SpringBones/lookAt and the retargeted pose are both applied. Garments
  // parented to the bone nodes follow automatically.
  useFrame((_, delta) => {
    playback.current?.mixer.update(delta);
    vrm.update(delta);
  });

  return (
    <group>
      <primitive object={vrm.scene} />

      {/* Outfit overlay anchored to the chest/spine. */}
      <GarmentOnBone vrm={vrm} bone={"chest" as VRMHumanBoneName}>
        <OutfitLayer option={selection.outfit} color={colors.outfit} m={measurements} />
      </GarmentOnBone>

      {/* Trousers/skirt anchored to the hips. */}
      <GarmentOnBone vrm={vrm} bone={"hips" as VRMHumanBoneName}>
        <Trousers option={selection.bottom} color={colors.bottom} m={measurements} />
      </GarmentOnBone>

      {/* A shoe on each foot. */}
      <GarmentOnBone vrm={vrm} bone={"leftFoot" as VRMHumanBoneName}>
        <Shoe option={selection.shoes} color={colors.shoes} m={measurements} />
      </GarmentOnBone>
      <GarmentOnBone vrm={vrm} bone={"rightFoot" as VRMHumanBoneName}>
        <Shoe option={selection.shoes} color={colors.shoes} m={measurements} />
      </GarmentOnBone>

      {/* Hat anchored to the head. */}
      <GarmentOnBone vrm={vrm} bone={"head" as VRMHumanBoneName}>
        <Hat option={selection.hat} color={colors.hat} m={measurements} />
      </GarmentOnBone>
    </group>
  );
}

export default function WardrobeScene({
  selection,
  colors,
  animation,
}: SceneProps) {
  // Keep the showroom turntable spinning at rest; hold still while a clip
  // plays so the motion reads clearly.
  const autoRotate = animation === "rest";
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 2.6], fov: 40 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <color attach="background" args={["#efede8"]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      <hemisphereLight args={["#ffffff", "#cbc7bd", 0.5]} />

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Avatar selection={selection} colors={colors} animation={animation} />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={4}
        blur={2.2}
        far={2}
        color="#2c2a26"
      />

      <OrbitControls
        enablePan={false}
        minDistance={1.4}
        maxDistance={5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, 1.1, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
