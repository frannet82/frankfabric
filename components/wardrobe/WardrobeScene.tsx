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
import {
  VRMLoaderPlugin,
  VRMUtils,
  MToonMaterial,
  type VRM,
  type VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { asset } from "@/lib/asset";

export type Category = "outfit" | "bottom" | "shoes" | "hat";

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
  const rightFoot = boneWorld("rightFoot" as VRMHumanBoneName);
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

function Avatar({ selection, colors }: SceneProps) {
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

  // CharacterStudio's per-frame update contract: vrm.update(delta) advances
  // SpringBones and lookAt every frame so the rig animates.
  useFrame((_, delta) => {
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

export default function WardrobeScene({ selection, colors }: SceneProps) {
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
          <Avatar selection={selection} colors={colors} />
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
        autoRotate
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
