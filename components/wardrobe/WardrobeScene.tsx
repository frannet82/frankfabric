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

function Trousers({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.6} />;
  if (option === 3) {
    // Skirt — a flared cone dropping from the hips.
    return (
      <mesh position={[0, -0.18, 0]} castShadow>
        <coneGeometry args={[0.22, 0.34, 20, 1, true]} />
        {mat}
      </mesh>
    );
  }
  const legLength = option === 2 ? 0.16 : 0.34; // Shorts vs Trousers
  const legY = -0.05 - legLength / 2;
  return (
    <group>
      <mesh position={[0, -0.02, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.13, 0.14, 18]} />
        {mat}
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, legY, 0]} castShadow>
          <capsuleGeometry args={[0.055, legLength, 6, 12]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}

function Shoe({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.5} />;
  const boot = option === 2; // Boots rise higher over the ankle.
  const height = boot ? 0.14 : 0.06;
  return (
    <group>
      <mesh position={[0, -0.02 - height / 2, 0.02]} castShadow>
        <boxGeometry args={[0.09, height, 0.14]} />
        {mat}
      </mesh>
      {/* toe box */}
      <mesh position={[0, -0.02, 0.09]} castShadow>
        <boxGeometry args={[0.09, 0.05, 0.08]} />
        {mat}
      </mesh>
    </group>
  );
}

function Hat({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.55} />;
  if (option === 2) {
    // Beanie — a snug rounded cap.
    return (
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[0.18, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        {mat}
      </mesh>
    );
  }
  // Cap — dome plus a forward brim.
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[0.18, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.15, 0.18]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.2, 0.025, 0.14]} />
        {mat}
      </mesh>
    </group>
  );
}

// The "Jacket"/"Vest" outfit overlay sits over the chest, anchored to the
// spine bone so it moves with the torso.
function OutfitLayer({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />;
  const withSleeves = option === 1; // Jacket has short sleeves; Vest does not.
  return (
    <group position={[0, 0.02, 0]}>
      <mesh position={[0, 0, 0.01]} castShadow>
        <capsuleGeometry args={[0.16, 0.16, 6, 16]} />
        {mat}
      </mesh>
      {withSleeves &&
        [-0.16, 0.16].map((x) => (
          <mesh key={x} position={[x, 0.02, 0]} rotation={[0, 0, x < 0 ? 0.3 : -0.3]} castShadow>
            <capsuleGeometry args={[0.05, 0.14, 6, 12]} />
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
        <OutfitLayer option={selection.outfit} color={colors.outfit} />
      </GarmentOnBone>

      {/* Trousers/skirt anchored to the hips. */}
      <GarmentOnBone vrm={vrm} bone={"hips" as VRMHumanBoneName}>
        <Trousers option={selection.bottom} color={colors.bottom} />
      </GarmentOnBone>

      {/* A shoe on each foot. */}
      <GarmentOnBone vrm={vrm} bone={"leftFoot" as VRMHumanBoneName}>
        <Shoe option={selection.shoes} color={colors.shoes} />
      </GarmentOnBone>
      <GarmentOnBone vrm={vrm} bone={"rightFoot" as VRMHumanBoneName}>
        <Shoe option={selection.shoes} color={colors.shoes} />
      </GarmentOnBone>

      {/* Hat anchored to the head. */}
      <GarmentOnBone vrm={vrm} bone={"head" as VRMHumanBoneName}>
        <Hat option={selection.hat} color={colors.hat} />
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
