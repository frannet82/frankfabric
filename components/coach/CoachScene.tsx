"use client";

// ---------------------------------------------------------------------------
// Coach trainer — interactive 3D coach avatar.
//
// This renders a "Coach" avatar loaded from a STATIC, UNRIGGED OBJ mesh
// (public/models/characters/coach/coach.obj) with its two diffuse textures
// applied via a companion MTL (coach.mtl -> Material.001 uses the 256x256 png,
// Material.002 uses the 32x32 png). Both map_Kd lines in the committed MTL were
// rewritten to reference the bare local filenames so they resolve against the
// MTLLoader resource path set below.
//
// KEY DIFFERENCE from components/chef/ChefScene.tsx: the coach OBJ has NO bones,
// no skeleton, no skin (verified). So there is NO bone-driven jaw/arm motion
// here. Instead the whole model GROUP is transformed to convey a lively
// "talking" coach: while `speaking`, a smoothed 0..1 energy eases toward 1 and
// drives a gentle vertical bob, a small side-to-side sway/rotation about Y, and
// a slight forward lean applied ON TOP of the model's rest transform. When
// idle, energy eases back to 0 but a very small always-on breathing bob keeps
// the figure from being perfectly static.
//
// This is a plain OBJ, NOT an FBX or VRM: it is loaded with OBJLoader +
// MTLLoader and does not go through SkeletonUtils, the VRMLoaderPlugin, or the
// lib/vrm helpers (those remain in use by the chef / wardrobe scenes only).
//
// All asset URLs are routed through lib/asset.ts so they resolve under the
// /frankfabric/ base path in production. This whole component touches WebGL/DOM
// (react-three-fiber <Canvas />), so it is imported via next/dynamic
// { ssr:false } by its consumer and never runs during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { asset } from "@/lib/asset";

type SceneProps = {
  // True while the coach's reply is "playing"; opens the talking-motion window.
  speaking?: boolean;
  // Returns a live 0..1 audio loudness (Web Audio AnalyserNode RMS). When it
  // returns 0 while speaking (e.g. muted), the bob falls back to a sine wobble.
  getLoudness?: () => number;
};

// Coach OBJ + its companion MTL. Every path is base-path-prefixed via asset()
// so it resolves to /frankfabric/models/... in production. Never hardcode a
// bare "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/coach/coach.obj");
const MTL_URL = asset("/models/characters/coach/coach.mtl");
// Resource base the MTLLoader uses to resolve the two map_Kd PNG filenames.
const RESOURCE_PATH = asset("/models/characters/coach/");

// The OBJ is authored ~2.1 units tall (Y[-0.0016, 2.101]) and roughly centered
// in X/Z. Scale it to a ~1.6-unit-tall figure that fits the fixed camera, the
// same target height the chef reads at.
const MODEL_TARGET_HEIGHT = 1.6;

// World-space height the aim point sits at (coach's upper chest / lower face).
// The camera is aimed here and the model is recentered so this point is where
// the head-and-torso reads best in the fixed shot.
const AIM_HEIGHT = 1.3;
// Vertical fraction of the (scaled) model height that we place at AIM_HEIGHT.
// ~0.82 puts the upper chest/neck at the aim point so the face sits just above
// center — a cozy, front-facing framing that mirrors the chef.
const AIM_MODEL_FRACTION = 0.82;
// How far back the fixed camera sits from the aim point.
const CAMERA_DISTANCE = 2.4;

// Loads the OBJ (materials from the MTL) and drives the whole-group talking /
// idle motion. The model is unrigged, so ALL motion is applied to the group's
// transform in useFrame — never to bones.
function Avatar({
  speaking = false,
  getLoudness,
}: {
  speaking?: boolean;
  getLoudness?: () => number;
}) {
  // Load materials first, then feed them to the OBJLoader. useLoader memoizes
  // by loader+url and applies the extend callback synchronously per load.
  const materials = useLoader(MTLLoader, MTL_URL, (loader) => {
    // Resolve the two map_Kd PNGs relative to the committed coach/ folder.
    loader.setResourcePath(RESOURCE_PATH);
    loader.setMaterialOptions({ side: THREE.DoubleSide });
  });
  const obj = useLoader(OBJLoader, MODEL_URL, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  // The group whose transform we animate. We capture its rest transform once so
  // every frame's motion is applied ON TOP of rest (never accumulating).
  const groupRef = useRef<THREE.Group | null>(null);
  const restY = useRef(0);
  // Smoothed 0..1 "energy" easing toward 1 while speaking, 0 otherwise; it
  // scales every talking transform so motion fades in/out with no snap.
  const energyRef = useRef(0);

  // Clone the loaded OBJ so we never mutate the loader-cached object across
  // React strict-mode remounts, and clone each material + its color map so the
  // textures we mark sRGB and later dispose are uniquely owned by this
  // component. Then recenter/scale with a fresh Box3 so the fixed camera
  // reliably frames a cozy, front-facing head-and-torso shot.
  const model = useMemo(() => {
    const root = obj.clone(true);

    root.traverse((node) => {
      node.frustumCulled = false;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = src.map((raw) => {
        const mat = (raw as THREE.Material).clone() as THREE.MeshPhongMaterial;
        // Color/diffuse maps must be sampled in sRGB so the textures read with
        // their true colors. Clone the map too so disposal is safe.
        const withMap = mat as unknown as { map?: THREE.Texture | null };
        if (withMap.map) {
          const tex = withMap.map.clone();
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          withMap.map = tex;
        }
        mat.needsUpdate = true;
        return mat;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });

    // Scale to a consistent on-screen height off the model's true bounds.
    root.updateMatrixWorld(true);
    const preBox = new THREE.Box3().setFromObject(root);
    if (!preBox.isEmpty()) {
      const preSize = new THREE.Vector3();
      preBox.getSize(preSize);
      if (preSize.y > 0) root.scale.setScalar(MODEL_TARGET_HEIGHT / preSize.y);
    }

    // Recenter deterministically off a fresh Box3 of the SCALED model so the
    // fixed camera reliably frames the coach (never a speck, never clipped).
    // Center horizontally/in depth on the aim axis, and lift it so a point
    // AIM_MODEL_FRACTION up its height sits at AIM_HEIGHT (upper chest).
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const aimWorldY = box.min.y + size.y * AIM_MODEL_FRACTION;
      root.position.set(
        root.position.x - center.x,
        root.position.y - aimWorldY + AIM_HEIGHT,
        root.position.z - center.z
      );
    }
    return root;
  }, [obj]);

  // Capture the model's rest Y once so the bob is applied on top of it.
  useEffect(() => {
    restY.current = model.position.y;
  }, [model]);

  // Drive the whole-group talking / idle motion each frame. Unrigged model, so
  // NO bone lookups: we transform the group itself. While speaking, an energy
  // 0..1 eases toward 1 and scales a bob + sway + forward lean; loudness (when
  // >0) scales the bob amplitude, else we fall back to a sine wobble. When idle
  // energy eases to 0 but a tiny always-on breathing bob keeps the coach alive.
  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;

    // Energy easing toward 1 (speaking) / 0 (idle), framerate-independent.
    const eTarget = speaking ? 1 : 0;
    const kEnergy = 1 - Math.exp(-delta * 6);
    energyRef.current += (eTarget - energyRef.current) * kEnergy;
    const energy = energyRef.current;

    // Active bob magnitude: prefer live loudness (0..1), else a sine wobble.
    let bobDrive = 0;
    if (speaking) {
      const loud = getLoudness ? getLoudness() : 0;
      bobDrive = loud > 0.01 ? Math.min(1, loud) : 0.5 + 0.5 * Math.sin(t * 12);
    }

    // Always-on gentle breathing bob so the coach is never perfectly static.
    const breathe = 0.012 * Math.sin(t * 1.6);

    // Vertical bob: breathing baseline plus an energetic talking bob.
    const bob = breathe + energy * bobDrive * 0.06 * (0.5 + 0.5 * Math.sin(t * 5.5));
    group.position.y = restY.current + bob;

    // Side-to-side sway + slight rotation about Y (a coach shifting weight and
    // turning to address you). Small offsets, eased by energy.
    group.position.x = energy * 0.05 * Math.sin(t * 2.3);
    group.rotation.y = energy * 0.09 * Math.sin(t * 1.9);

    // Slight forward lean (rotate about X) while talking, easing back to 0.
    group.rotation.x = energy * 0.04 * (0.5 + 0.5 * Math.sin(t * 3.1));
  });

  // On unmount, dispose ONLY the resources this component owns. obj.clone(true)
  // reuses geometry by reference from the loader-cached OBJ, so we do NOT
  // dispose geometry here. The materials and their color maps, however, were
  // freshly cloned above and are uniquely owned, so dispose both.
  useEffect(() => {
    return () => {
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((raw) => {
          const mat = raw as THREE.Material & { map?: THREE.Texture | null };
          mat?.map?.dispose();
          mat?.dispose();
        });
      });
    };
  }, [model]);

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}

// `speaking` + `getLoudness` drive the whole-group talking motion in <Avatar />.
// The OBJ is unrigged, so there is no body-animation prop.
export default function CoachScene({ speaking = false, getLoudness }: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, AIM_HEIGHT, CAMERA_DISTANCE], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the avatar stage.
      role="img"
      aria-label="3D coach avatar"
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim the camera straight at the aim point
        // the model was recentered onto (its upper chest). No OrbitControls,
        // no zoom — the shot is intentionally locked.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* Bright, energetic gym lighting kept near-neutral so the coach's
          textures show their true colors. */}
      <ambientLight intensity={0.9} color="#ffffff" />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.1}
        color="#fffdf2"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Soft neutral fill from the opposite side. */}
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#ffffff" />
      {/* Very gentle sky-to-ground bounce, near-neutral so it never tints. */}
      <hemisphereLight args={["#eef4ff", "#f3f0e6", 0.45]} />

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Avatar speaking={speaking} getLoudness={getLoudness} />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.3}
        scale={4}
        blur={2.6}
        far={2}
        color="#111111"
      />
    </Canvas>
  );
}
