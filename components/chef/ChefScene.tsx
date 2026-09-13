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
// This is a plain FBX, NOT a VRM: it is loaded with FBXLoader and does not go
// through the VRMLoaderPlugin or the lib/vrm transplant/retarget helpers (those
// remain in use by components/wardrobe/WardrobeScene.tsx only).
//
// The parent passes an `animation` prop ('idle' | 'waving'). The FBX has no
// baked body-animation clips, so this prop currently has no visible body
// effect; it is retained for API compatibility with ChefChatbot.tsx.
//
// MOUTH MOTION: the parent also passes `speaking` (true while the chef's reply
// audio plays) and an optional `getLoudness` callback that returns a live 0..1
// amplitude from the Web Audio AnalyserNode. While speaking we rotate the
// 'Bip001_Jaw' bone open/closed — driven by that live loudness when available,
// with a smooth sine oscillation as a fallback (e.g. when muted) — and ease it
// back to its captured rest rotation when the chef stops talking. The FBX has
// no morph/blendshape targets, so the mouth MUST be bone-driven. If the jaw
// bone is missing at runtime we skip mouth motion gracefully.
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
import { asset } from "@/lib/asset";

// Which chef animation state the parent requests. "idle" is the resting state;
// "waving" is set briefly by the parent when the chef replies. The current FBX
// has no baked body clips, so this has no visible body effect yet, but the type
// and prop are kept so ChefChatbot.tsx compiles unchanged.
export type ChefAnimation = "idle" | "waving";

type SceneProps = {
  animation: ChefAnimation;
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

  // Clone the FBX and texture so we never mutate the loader-cached values
  // returned from the hooks (also keeps React strict-mode remounts clean).
  const model = useMemo(() => {
    const root = fbx.clone(true);

    // FBX diffuse textures are authored top-left origin and in sRGB.
    const texture = loadedTexture.clone();
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    root.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((raw) => {
          const mat = raw as THREE.MeshPhongMaterial;
          if (!mat) return;
          mat.map = texture;
          mat.needsUpdate = true;
        });
      }
    });

    root.scale.setScalar(MODEL_SCALE);
    // Feet sit at the rig origin (y≈0), so no vertical offset is needed to
    // stand on the ground plane.
    root.position.set(0, 0, 0);
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

  useEffect(() => {
    return () => {
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    };
  }, [model]);

  return <primitive object={model} />;
}

// The `animation` prop is part of the public API (ChefChatbot.tsx passes it)
// but has no visible body effect yet, since the FBX ships no baked body clips.
// `speaking` + `getLoudness` drive the bone-based mouth motion in <Avatar />.
export default function ChefScene({
  animation: _animation,
  speaking = false,
  getLoudness,
}: SceneProps) {
  void _animation;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.4, 2.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the avatar stage.
      role="img"
      aria-label="3D chef avatar"
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim the camera at the chef's upper body.
        camera.lookAt(0, 1.3, 0);
      }}
    >
      {/* Cozy Animal-Crossing lighting: warm, soft, evenly lit — no neon rim. */}
      <ambientLight intensity={0.95} color="#fff4dc" />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.15}
        color="#fff1cf"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Soft warm fill from the opposite side (replaces the violet rim). */}
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#ffe3a8" />
      {/* Sky-to-ground bounce in gentle pastel sky/leaf tones. */}
      <hemisphereLight args={["#bfe8ff", "#dff3cf", 0.6]} />

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
