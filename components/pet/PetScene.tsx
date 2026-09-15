"use client";

// ---------------------------------------------------------------------------
// Virtual pet — interactive 3D schnauzer scene.
//
// This renders the scanned schnauzer as a STATIC, UNRIGGED mesh loaded from a
// self-contained glTF-binary (public/models/characters/schnauzer/schnauzer.glb).
// FEAT-001 confirmed the .glb EMBEDS its albedo texture inside the binary
// buffer (images[0] has no uri; single material 'MAT_RETOPO'), so useGLTF /
// GLTFLoader loads the texture automatically — we do NOT manually wire
// RETOPO_COL_2k_0.png. We only ensure any color map is sampled in sRGB.
//
// Because the mesh has NO skeleton (a dog scanned on all fours), ALL pet
// reactions are whole-group transforms in useFrame, exactly like
// components/coach/CoachScene.tsx: we capture the model's rest transform once
// and apply subtle bob / sway / lean deltas ON TOP of it, scaled by a
// framerate-independent smoothed energy (1 - Math.exp(-delta*k)). Mood drives
// the always-on ambience; a transient `action` fires a ~1s one-shot reaction.
//
// A dog is WIDE and LOW (not tall like the coach), so we scale off the model's
// LARGEST bound and aim the camera at roughly its mid-body height so it reads
// centered on all fours.
//
// Every asset URL is routed through lib/asset.ts so it resolves under the
// /frankfabric/ base path in production. This component touches WebGL/DOM, so
// it is imported via next/dynamic { ssr:false } by VirtualPet and never runs
// during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/lib/asset";

// The self-contained schnauzer .glb. Base-path-prefixed via asset() so it
// resolves to /frankfabric/models/... in production. Never hardcode a bare
// "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/schnauzer/schnauzer.glb");

// Preload at module scope so the model starts fetching as soon as the scene
// chunk is imported (through the ssr:false dynamic import).
useGLTF.preload(MODEL_URL);

// A dog is wide/low, so we scale off the LARGEST bound to a consistent
// on-screen size that frames the whole animal in an aspect-video-ish stage.
const MODEL_TARGET_SIZE = 1.8;

// World-space height the camera aims at (roughly the dog's mid-body while it
// stands on all fours). The model is recentered so this point reads centered.
const AIM_HEIGHT = 0.55;
// How far back the fixed camera sits from the aim point.
const CAMERA_DISTANCE = 2.9;

type SceneProps = {
  // Current discrete mood (from moodFor): 'happy'|'content'|'hungry'|'tired'|
  // 'dirty'|'sad'. Drives the always-on ambient motion.
  mood: string;
  // Transient one-shot trigger set for ~1s when the visitor takes an action.
  action?: "feed" | "play" | "sleep" | "clean" | null;
  // Overall wellbeing 0..100; gently scales liveliness.
  wellbeing: number;
};

// Loads the schnauzer and drives the whole-group mood/action motion. The model
// is unrigged, so ALL motion is applied to the group transform in useFrame —
// never to bones.
function Pet({ mood, action, wellbeing }: SceneProps) {
  const { scene } = useGLTF(MODEL_URL);

  // The group we animate. We capture its rest transform once so every frame's
  // motion is applied ON TOP of rest (never accumulating).
  const groupRef = useRef<THREE.Group | null>(null);

  // Smoothed 0..1 "energy" for the always-on liveliness (eased toward a mood
  // target) and a separate 0..1 envelope for the one-shot action reaction.
  const energyRef = useRef(0);
  const actionEnvRef = useRef(0);
  // Which action is currently being played out, and a small time accumulator
  // so the one-shot has its own phase independent of the global clock.
  const activeActionRef = useRef<SceneProps["action"]>(null);
  const actionTimeRef = useRef(0);

  // Clone the loaded scene so we never mutate the loader-cached object across
  // React strict-mode remounts, and clone each material + its color map so the
  // textures we mark sRGB and later dispose are uniquely owned. Then
  // recenter/scale with a fresh Box3 so the fixed camera reliably frames the
  // dog on all fours.
  const model = useMemo(() => {
    const root = scene.clone(true);

    root.traverse((node) => {
      node.frustumCulled = false;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = src.map((raw) => {
        const mat = (raw as THREE.Material).clone() as THREE.MeshStandardMaterial;
        // The embedded baseColor/albedo map must be sampled in sRGB so the
        // scan reads with its true colors. Clone the map too so disposal is
        // safe (uniquely owned by this component).
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

    // Scale to a consistent on-screen size off the model's LARGEST bound (a dog
    // is wide/low, so height alone would make it tiny in frame).
    root.updateMatrixWorld(true);
    const preBox = new THREE.Box3().setFromObject(root);
    if (!preBox.isEmpty()) {
      const preSize = new THREE.Vector3();
      preBox.getSize(preSize);
      const largest = Math.max(preSize.x, preSize.y, preSize.z);
      if (largest > 0) root.scale.setScalar(MODEL_TARGET_SIZE / largest);
    }

    // Recenter deterministically off a fresh Box3 of the SCALED model so the
    // fixed camera reliably frames the dog. Center it horizontally/in depth and
    // lift it so its vertical center sits at AIM_HEIGHT (mid-body).
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      root.position.set(
        root.position.x - center.x,
        root.position.y - center.y + AIM_HEIGHT,
        root.position.z - center.z
      );
    }
    return root;
  }, [scene]);

  // On unmount, dispose ONLY the resources this component owns. scene.clone(true)
  // reuses geometry by reference from the loader-cached glTF, so we do NOT
  // dispose geometry (useGLTF manages it). The materials and their color maps
  // WERE freshly cloned above and are uniquely owned, so dispose both.
  useEffect(() => {
    return () => {
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        mats.forEach((raw) => {
          const mat = raw as THREE.Material & { map?: THREE.Texture | null };
          mat?.map?.dispose();
          mat?.dispose();
        });
      });
    };
  }, [model]);

  // Latch a new action into the one-shot envelope. Re-arming whenever `action`
  // changes to a non-null value resets the envelope + phase so the reaction
  // fires cleanly once (VirtualPet clears the prop after ~1s).
  useEffect(() => {
    if (action) {
      activeActionRef.current = action;
      actionEnvRef.current = 1; // impulse; useFrame decays it over ~1s.
      actionTimeRef.current = 0;
    }
  }, [action]);

  // Drive the whole-group mood/action motion each frame. Unrigged model, so NO
  // bone lookups — we transform the group itself. Everything is applied ON TOP
  // of the group's rest (position 0 / rotation 0); the inner model already
  // carries the recenter offset.
  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05); // clamp huge frames (tab refocus).

    // Map mood -> a target liveliness 0..1, blended with overall wellbeing so a
    // thriving pet is a touch livelier. Low-energy moods sit near the floor.
    let moodTarget: number;
    switch (mood) {
      case "happy":
        moodTarget = 1;
        break;
      case "content":
        moodTarget = 0.6;
        break;
      case "tired":
        moodTarget = 0.15;
        break;
      case "hungry":
      case "dirty":
      case "sad":
        moodTarget = 0.25;
        break;
      default:
        moodTarget = 0.5;
    }
    const wb = Math.max(0, Math.min(1, wellbeing / 100));
    const target = Math.max(0.1, moodTarget * (0.6 + 0.4 * wb));

    // Ease energy toward target, framerate-independent.
    const kEnergy = 1 - Math.exp(-dt * 3);
    energyRef.current += (target - energyRef.current) * kEnergy;
    const energy = energyRef.current;

    // Decay the one-shot action envelope toward 0 over ~1s.
    const kAction = 1 - Math.exp(-dt * 4.5);
    actionEnvRef.current += (0 - actionEnvRef.current) * kAction;
    const env = actionEnvRef.current;
    actionTimeRef.current += dt;
    const at = actionTimeRef.current;
    const activeAction = activeActionRef.current;

    // --- Always-on ambience ------------------------------------------------
    // Gentle breathing bob so the pet is never perfectly static.
    const breathe = 0.008 * Math.sin(t * 1.5);
    // Livelier bob scaled by energy (a happy dog bounces a bit more).
    const liveBob = energy * 0.03 * (0.5 + 0.5 * Math.sin(t * 3.4));
    // Small side-to-side wiggle / sway (reads as a tail-end wiggle).
    const wiggleX = energy * 0.02 * Math.sin(t * 2.6);
    const wiggleRotY = energy * 0.05 * Math.sin(t * 2.1);

    // Tired/sad/hungry/dirty moods droop: a slight downward offset and a small
    // forward lean, scaled by how LOW the energy is.
    const droop = 1 - energy; // ~0 when lively, ~0.9 when slumped.
    const droopY = -0.03 * droop;
    const droopLean = 0.06 * droop;

    // --- One-shot action reaction -----------------------------------------
    // feed/play => an excited hop + quick wiggle. clean => a shimmy. sleep =>
    // a settle-down (sink + gentle nod), no hop. Enveloped so it eases out.
    let hopY = 0;
    let actionRotY = 0;
    let actionRotX = 0;
    if (env > 0.001 && activeAction) {
      if (activeAction === "sleep") {
        // Settle: sink slightly and give a slow nod down.
        hopY = -0.05 * env;
        actionRotX = 0.05 * env * (0.5 + 0.5 * Math.sin(at * 4));
      } else if (activeAction === "clean") {
        // Shimmy: quick side-to-side shake.
        actionRotY = 0.12 * env * Math.sin(at * 22);
        hopY = 0.02 * env * Math.abs(Math.sin(at * 11));
      } else {
        // feed / play: an excited little hop + happy wiggle.
        hopY = 0.12 * env * Math.abs(Math.sin(at * 8));
        actionRotY = 0.1 * env * Math.sin(at * 14);
      }
    }

    // Compose. Keep all offsets subtle so it reads lively, never glitchy.
    group.position.y = breathe + liveBob + droopY + hopY;
    group.position.x = wiggleX;
    group.rotation.y = wiggleRotY + actionRotY;
    group.rotation.x = droopLean + actionRotX;
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}

// Mood + transient action + wellbeing drive the whole-group motion in <Pet />.
// The mesh is unrigged, so there is no bone-animation prop.
export default function PetScene({ mood, action, wellbeing }: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, AIM_HEIGHT + 0.35, CAMERA_DISTANCE], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the pet stage.
      role="img"
      aria-label="3D virtual pet dog"
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim slightly down at the dog's mid-body
        // so it reads centered on all fours. No OrbitControls, no zoom.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* Warm, cozy lighting kept near-neutral so the scan's texture shows its
          true colors. */}
      <ambientLight intensity={0.85} color="#fff6ea" />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.15}
        color="#fff3e0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Soft fill from the opposite side. */}
      <directionalLight position={[-4, 3, -3]} intensity={0.45} color="#ffffff" />
      {/* Gentle sky-to-ground bounce. */}
      <hemisphereLight args={["#fff2dd", "#efe2c9", 0.5]} />

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Pet mood={mood} action={action} wellbeing={wellbeing} />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.32}
        scale={4}
        blur={2.6}
        far={2}
        color="#3a2c1a"
      />
    </Canvas>
  );
}
