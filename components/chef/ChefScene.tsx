"use client";

// ---------------------------------------------------------------------------
// Chef chatbot — interactive 3D chef avatar.
//
// This renders the "Swedish Chef" avatar loaded from a single textured Biped
// FBX (public/models/characters/swedish-chef/swedish-chef.fbx) with its diffuse
// texture (swedish_chef_diff.jpg) applied to the mesh material. The FBX ships
// its own hat (Biped Bip001_Cap* bones), so no procedural toque or garment
// assembly is needed here.
//
// COLORS: the FBX's material is a MeshPhongMaterial with a white specular and
// mid shininess, which under warm lights washes the diffuse texture out to a
// shiny white. We therefore swap it for a matte MeshStandardMaterial (roughness
// 0.9, metalness 0, white color) carrying the same sRGB diffuse map so the
// texture's real colors read faithfully, and we keep the scene lights near
// neutral (white / faintly warm) so nothing recolors the chef while still
// feeling cozy.
//
// This is a plain FBX, NOT a VRM: it is loaded with FBXLoader and does not go
// through the VRMLoaderPlugin or the lib/vrm transplant/retarget helpers (those
// remain in use by components/wardrobe/WardrobeScene.tsx only).
//
// MOUTH MOTION: the parent passes `speaking` (true while the chef's reply is
// spoken by the browser SpeechSynthesis voice) and an optional `getLoudness`
// callback. SpeechSynthesis exposes no audio-amplitude stream, so getLoudness
// returns 0 and the jaw uses a smooth sine oscillation while speaking. We
// rotate the 'Bip001_Jaw' bone open/closed while speaking and ease it back to
// its captured rest rotation when the chef stops talking. The FBX has no
// morph/blendshape targets, so the mouth MUST be bone-driven. If the jaw bone
// is missing at runtime we skip mouth motion gracefully.
//
// CLONING: the FBX contains a SkinnedMesh + 57-bone Biped skeleton. A plain
// Object3D.clone(true) does NOT rebind the cloned skin to the cloned bones, so
// the skinned mesh renders collapsed/invisible (an empty container). We clone
// with SkeletonUtils.clone, which correctly duplicates skinned meshes and
// rebinds their skeletons. We then recenter the built model with a Box3 so the
// fixed camera reliably frames a cozy, front-facing head-and-torso shot.
//
// All asset URLs are routed through lib/asset.ts so they resolve
// under the /frankfabric/ base path in production. This whole component touches
// WebGL/DOM (react-three-fiber <Canvas />), so it is imported via next/dynamic
// { ssr:false } in ChefChatbot.tsx and never runs during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "@/lib/asset";

type SceneProps = {
  // True while the chef's reply is "playing"; opens the mouth-motion window.
  speaking?: boolean;
  // Returns a live 0..1 audio loudness (Web Audio AnalyserNode RMS). When it
  // returns 0 while speaking (e.g. muted), the jaw falls back to a sine wobble.
  getLoudness?: () => number;
};

// Name of the jaw bone in the Swedish Chef Biped rig. Verified in FEAT-001.
const JAW_BONE = "Bip001_Jaw";
// Max additional rotation (radians) applied to open the jaw fully.
const JAW_OPEN = 0.32;

// Swedish Chef FBX + its diffuse texture. Every path is base-path-prefixed via
// asset() so it resolves to /frankfabric/models/... in production. Never
// hardcode a bare "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/swedish-chef/swedish-chef.fbx");
const TEXTURE_URL = asset(
  "/models/characters/swedish-chef/swedish_chef_diff.jpg"
);

// The FBX is authored in Biped units: the rig stands ~1632 units tall in world
// space, so scale it down to a ~1.6-unit-tall figure that fits the camera.
const MODEL_SCALE = 0.001;

// World-space height the aim point sits at (chef's upper chest / lower face).
// The camera is aimed here and the model is recentered so this point is where
// the head-and-torso reads best in the fixed shot.
const AIM_HEIGHT = 1.3;
// Vertical fraction of the (scaled) model height that we place at AIM_HEIGHT.
// ~0.82 puts the upper chest/neck at the aim point so the face sits just above
// center — a cozy, front-facing chatbot framing.
const AIM_MODEL_FRACTION = 0.82;
// How far back the fixed camera sits from the aim point.
const CAMERA_DISTANCE = 2.2;

// Loads the FBX + texture and drives the bone-based mouth motion. The FBX has
// no baked body clips, so `animation` has no body effect; mouth motion is
// driven entirely by `speaking` + `getLoudness` here.
function Avatar({
  speaking = false,
  getLoudness,
}: {
  speaking?: boolean;
  getLoudness?: () => number;
}) {
  const fbx = useLoader(FBXLoader, MODEL_URL);
  const loadedTexture = useLoader(THREE.TextureLoader, TEXTURE_URL);

  // The jaw bone and its captured rest X-rotation. Resolved once the model is
  // built; null when the bone is absent (mouth motion then degrades gracefully).
  const jawRef = useRef<THREE.Object3D | null>(null);
  const jawRestX = useRef(0);
  // Smoothed 0..1 "openness" so the jaw eases between frames.
  const openRef = useRef(0);

  // Clone the FBX with SkeletonUtils so the SkinnedMesh's skeleton is correctly
  // rebound to the cloned bones (a plain Object3D.clone would collapse/hide the
  // skinned mesh — the "empty container" bug). We also clone the texture so we
  // never mutate the loader-cached values returned from the hooks (keeps React
  // strict-mode remounts clean).
  const model = useMemo(() => {
    const root = cloneSkeleton(fbx);

    // This diffuse JPEG is loaded independently via THREE.TextureLoader (it is
    // NOT embedded in the FBX), so it uses TextureLoader's default flipY=true.
    // That is the correct orientation for a standalone image sampled against
    // the mesh's channel-0 UVs (u,v within [0,1]). We keep sRGB color space for
    // the color/diffuse map.
    const texture = loadedTexture.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    root.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // COLOR FIX: the FBX ships a MeshPhongMaterial with a WHITE specular
        // (#ffffff) and shininess ~52. Under any warm light that produces harsh
        // shiny/plasticky highlights that wash the diffuse texture out to white.
        // Replace it with a matte MeshStandardMaterial (roughness 0.9,
        // metalness 0) carrying the same diffuse map so the texture's true
        // colors read faithfully with no blown-out specular. color stays white
        // (#ffffff) so the material never tints the map.
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        const replaced = materials.map((raw) => {
          const matte = new THREE.MeshStandardMaterial({
            map: texture,
            color: new THREE.Color(0xffffff),
            roughness: 0.9,
            metalness: 0,
          });
          matte.needsUpdate = true;
          const src = raw as THREE.Material | undefined;
          if (src && "name" in src && src.name) matte.name = src.name;
          return matte;
        });
        mesh.material = Array.isArray(mesh.material)
          ? replaced
          : replaced[0];
      }
    });

    root.scale.setScalar(MODEL_SCALE);

    // Recenter deterministically off a fresh Box3 of the SCALED model so the
    // fixed camera reliably frames the chef (never a speck, never clipped away).
    // Center the model horizontally/in depth on the aim axis, and lift it so a
    // point AIM_MODEL_FRACTION up its height sits at AIM_HEIGHT (upper chest).
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
  }, [fbx, loadedTexture]);

  // Look up the jaw bone on the cloned root we actually add to the scene and
  // capture its rest rotation once. Guard for a missing bone (mouth motion then
  // degrades gracefully). Done in an effect so we never touch refs during render.
  useEffect(() => {
    const jaw = model.getObjectByName(JAW_BONE) ?? null;
    jawRef.current = jaw;
    if (jaw) {
      jawRestX.current = jaw.rotation.x;
    } else {
      console.warn(
        `[ChefScene] jaw bone "${JAW_BONE}" not found; mouth motion disabled.`
      );
    }
    return () => {
      jawRef.current = null;
    };
  }, [model]);

  // Drive the jaw open/closed each frame. While speaking, use live audio
  // loudness (0..1) when available, else a smooth sine wobble; ease back to
  // rest when not speaking.
  useFrame((state, delta) => {
    const jaw = jawRef.current;
    if (!jaw) return;

    let target = 0;
    if (speaking) {
      const loud = getLoudness ? getLoudness() : 0;
      if (loud > 0.01) {
        target = Math.min(1, loud);
      } else {
        // Fallback oscillation (e.g. muted-but-speaking): 0..1 sine.
        target = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 13);
      }
    }

    // Exponential smoothing toward target, framerate-independent.
    const k = 1 - Math.exp(-delta * 18);
    openRef.current += (target - openRef.current) * k;
    jaw.rotation.x = jawRestX.current + openRef.current * JAW_OPEN;
  });

  // On unmount, dispose ONLY the resources this component owns. SkeletonUtils
  // .clone reuses geometries by reference from the loader-cached fbx, so we do
  // NOT dispose geometry here. The materials, however, are freshly created
  // MeshStandardMaterials (see the color fix above) and each carries the cloned
  // diffuse texture we uniquely created, so dispose both the material and its
  // map.
  useEffect(() => {
    return () => {
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((raw) => {
          const mat = raw as THREE.MeshStandardMaterial | undefined;
          mat?.map?.dispose();
          mat?.dispose();
        });
      });
    };
  }, [model]);

  return <primitive object={model} />;
}

// `speaking` + `getLoudness` drive the bone-based mouth motion in <Avatar />.
// The FBX ships no baked body clips, so there is no body-animation prop.
export default function ChefScene({ speaking = false, getLoudness }: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, AIM_HEIGHT, CAMERA_DISTANCE], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the avatar stage.
      role="img"
      aria-label="3D chef avatar"
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim the camera straight at the aim point
        // the model was recentered onto (its upper chest). No OrbitControls,
        // no zoom — the shot is intentionally locked.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* Cozy Animal-Crossing lighting: soft and evenly lit, but kept NEAR
          NEUTRAL so the chef's diffuse texture shows its true colors. The
          previous strongly warm casts (#fff4dc / #fff1cf / #ffe3a8) pushed the
          whole model yellow/orange and hid the texture; these are now white or
          only very subtly warm (#fff6ec) at modest intensity so the vibe stays
          cozy without recoloring the chef. */}
      <ambientLight intensity={0.85} color="#ffffff" />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.05}
        color="#fff6ec"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Soft neutral fill from the opposite side. */}
      <directionalLight position={[-4, 3, -3]} intensity={0.45} color="#ffffff" />
      {/* Very gentle sky-to-ground bounce, near-neutral so it never tints. */}
      <hemisphereLight args={["#eef4ff", "#f3efe6", 0.45]} />

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Avatar speaking={speaking} getLoudness={getLoudness} />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.28}
        scale={4}
        blur={2.6}
        far={2}
        color="#6b4f2a"
      />
    </Canvas>
  );
}
