"use client";

// ---------------------------------------------------------------------------
// Coach trainer — interactive 3D astronaut coach avatar (RIGGED GLB +
// procedural bone gesturing).
//
// This renders the "Ed Stronaut" astronaut coach loaded from a single,
// SELF-CONTAINED GLB (public/models/characters/astronaut/astronaut.glb). Unlike
// the old, UNRIGGED coach.obj, this model ships a real humanoid skeleton
// (1 skin, 52 joints/bones across 57 nodes, 4 skinned meshes) with its 14
// textures EMBEDDED in the container. GLTFLoader decodes those embedded
// textures automatically, so we do NOT hand-wire the loose extracted textures
// under _assetwork/ed/textures/.
//
// KEY DIFFERENCE from the old OBJ coach: the GLB HAS a skeleton but ships ZERO
// baked animation clips, so real limb motion is PROCEDURAL. Modeled on
// components/chef/ChefScene.tsx's ARM_BONES gesturing: we resolve the arm chain
// (Left/Right Arm/ForeArm/Hand) plus the spine (Spine/Spine1/Spine2) and
// Neck/Head bones BY NAME on the cloned model and capture each bone's rest
// rotation once. In useFrame a single smoothed 0..1 "gesture amount" eases
// toward 1 while `speaking` and back to 0 when silent; it multiplies small,
// per-bone time-based sin offsets (differing frequency/phase per bone and per
// side) ADDED ON TOP OF each captured rest rotation, so the astronaut clearly
// gestures with its arms plus a little spine/head motion while the reply plays
// and eases back to its exact rest pose when done. Amplitudes are bounded so
// the limbs read clearly but never clip through the torso/head. A very subtle
// always-on idle sway keeps the figure from being perfectly static.
//
// CLONING: the GLB contains SkinnedMeshes bound to the skeleton. A plain
// Object3D.clone(true) does NOT rebind the cloned skin to the cloned bones, so
// the skinned mesh renders collapsed/invisible (the "empty container" bug). We
// clone with SkeletonUtils.clone (same pattern as ChefScene / PetScene), which
// duplicates skinned meshes and rebinds their skeletons.
//
// This is a rigged glTF binary, NOT a VRM: it is loaded with GLTFLoader and does
// not go through the VRMLoaderPlugin or the lib/vrm helpers (those remain in use
// by the wardrobe scene only).
//
// All asset URLs are routed through lib/asset.ts so they resolve under the
// /frankfabric/ base path in production. This whole component touches WebGL/DOM
// (react-three-fiber <Canvas />), so it is imported via next/dynamic
// { ssr:false } by its consumer and never runs during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useLoader, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor } from "@react-three/drei";
import { damp, damp3 } from "maath/easing";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "@/lib/asset";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";
import type { CoachFocus } from "@/lib/coach/coachEngine";

type SceneProps = {
  // True while the coach's reply is "playing"; opens the talking-motion window.
  speaking?: boolean;
  // Returns a live 0..1 audio loudness (Web Audio AnalyserNode RMS). When it
  // returns 0 while speaking (e.g. muted), the bob falls back to a sine wobble.
  getLoudness?: () => number;
  // Shared High/Fast render-quality tier (components/three/quality.ts). Gates
  // Canvas shadows, dpr, shadow-map resolution, soft shadows and the heavier
  // fill/bounce lights + ground backdrop. Defaults to High so the standalone
  // look is unchanged from before this feature.
  quality?: Quality;
  // The engine's branch read-out for the latest reply (see CoachFocus). The
  // camera reacts ONLY to this value the engine returned — it never re-derives
  // intent from keywords. null when there has been no reply yet.
  focus?: CoachFocus | null;
  // Monotonic counter bumped by CoachChatbot on every send so the SAME focus
  // still re-fires the camera nudge (mirrors VirtualPet's action + actionNonce).
  focusNonce?: number;
  // Called on pointer-down on the clickable kettlebell prop. CoachChatbot wires
  // this to its EXISTING send() with a real query string, so the answer is
  // produced by the engine exactly as if the user typed it. This scene never
  // constructs any workout text itself.
  onKettlebellClick?: () => void;
  // When true (user prefers reduced motion), all AMBIENT/IDLE motion is gated:
  // the camera nudge holds the pinned framing, the astronaut's talking arm /
  // spine / head gestures and the idle sway are damped to the captured rest
  // pose (gesture amount -> 0 = exact rest), the floor shimmer is skipped, and
  // the kettlebell prop's idle bob is frozen. Interactions still route through
  // the engine — only the MOTION response is damped. Defaults to false so
  // behaviour is identical to today when the preference is off.
  reducedMotion?: boolean;
};

// The rigged astronaut GLB (Ed Stronaut). It is SELF-CONTAINED: its 14 textures
// are embedded in the container, so GLTFLoader decodes them automatically — do
// NOT hand-wire the loose extracted textures. The path is base-path-prefixed via
// asset() so it resolves to /frankfabric/models/... in production. Never
// hardcode a bare "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/astronaut/astronaut.glb");

// GESTURE BONES: the astronaut rig's arm chain + spine + head/neck, resolved BY
// NAME against the GLB (verified at build time: NO mixamorig prefix — the rig
// uses plain humanoid names). While `speaking` is true the astronaut gestures
// with its arms plus a little spine/head motion driven by the `speaking`
// window; when it stops we ease every bone back to its captured rest rotation.
// Any bone missing at runtime is skipped gracefully (never throws).
const GESTURE_BONES = {
  rArm: "RightArm",
  rForearm: "RightForeArm",
  rHand: "RightHand",
  lArm: "LeftArm",
  lForearm: "LeftForeArm",
  lHand: "LeftHand",
  spine: "Spine1",
  chest: "Spine2",
  neck: "Neck",
  head: "Head",
} as const;
type GestureBoneKey = keyof typeof GESTURE_BONES;

// The astronaut GLB stands upright. We scale it off its TALLEST bound to a
// ~1.7-unit-tall figure so the fixed camera frames a cozy, front-facing
// head-and-torso shot, the same read the chef gets, regardless of authoring
// units.
const MODEL_TARGET_HEIGHT = 1.7;

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

// Loads the rigged astronaut GLB (embedded textures decoded by GLTFLoader),
// clones it with SkeletonUtils so the 4 skinned meshes rebind, and drives
// PROCEDURAL bone gesturing — the GLB ships a 52-joint skeleton but ZERO baked
// clips, so all limb motion is authored here in useFrame.
function Avatar({
  speaking = false,
  reducedMotion = false,
}: {
  speaking?: boolean;
  getLoudness?: () => number;
  reducedMotion?: boolean;
}) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);

  // The gesture bones and each bone's captured rest rotation. Bones absent at
  // runtime are skipped gracefully (we simply never animate them).
  const boneRef = useRef<Partial<Record<GestureBoneKey, THREE.Object3D>>>({});
  const restRef = useRef<Partial<Record<GestureBoneKey, THREE.Euler>>>({});
  // Smoothed 0..1 "gesture amount" easing toward 1 while speaking, 0 otherwise.
  // Multiplies every bone oscillation so the gesture fades in/out with no snap;
  // at amount == 0 the bones sit at their captured rest rotation exactly.
  const gestureRef = useRef(0);

  // Clone the GLB scene with SkeletonUtils so each SkinnedMesh's skeleton is
  // correctly rebound to the cloned bones (a plain Object3D.clone would collapse
  // /hide the skinned meshes — the "empty container" bug). GLTFLoader already
  // decoded the 14 embedded textures onto the materials; we only ensure the
  // color/diffuse maps sample in sRGB. Then scale off the tallest bound and
  // recenter with a fresh Box3 so the fixed camera frames a cozy head-and-torso.
  const model = useMemo(() => {
    const root = cloneSkeleton(gltf.scene);

    root.traverse((node) => {
      node.frustumCulled = false;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // GLTFLoader already sets the correct color space on decoded textures, but
      // make the intent explicit: the base-color/diffuse (.map) and emissive
      // maps are sRGB; the data maps (normal/roughness/metalness/ao) stay
      // linear. This keeps the suit reading its true colors with no blow-out
      // under the near-neutral rig (WS2). We do NOT swap the GLB's PBR
      // materials — they are correct MeshStandardMaterials already.
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((raw) => {
        const mat = raw as THREE.MeshStandardMaterial | undefined;
        if (!mat) return;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        mat.needsUpdate = true;
      });
    });

    // Scale to a consistent on-screen height off the model's TALLEST bound so
    // the fixed camera frames the whole upper body regardless of authoring
    // units. The astronaut stands upright, so Y is its tallest axis.
    root.updateMatrixWorld(true);
    const preBox = new THREE.Box3().setFromObject(root);
    if (!preBox.isEmpty()) {
      const preSize = new THREE.Vector3();
      preBox.getSize(preSize);
      const tallest = Math.max(preSize.x, preSize.y, preSize.z);
      if (tallest > 0) root.scale.setScalar(MODEL_TARGET_HEIGHT / tallest);
    }

    // Recenter deterministically off a fresh Box3 of the SCALED model so the
    // fixed camera reliably frames the astronaut (never a speck, never clipped).
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
  }, [gltf]);

  // Resolve the gesture bones on the cloned root we actually add to the scene
  // and capture each bone's rest rotation once, mirroring ChefScene's ARM_BONES
  // approach. Any missing bone is skipped gracefully (we simply never animate
  // it) so a rig change can't throw. Done in an effect so we never touch refs
  // during render.
  useEffect(() => {
    const bones: Partial<Record<GestureBoneKey, THREE.Object3D>> = {};
    const rests: Partial<Record<GestureBoneKey, THREE.Euler>> = {};
    (Object.keys(GESTURE_BONES) as GestureBoneKey[]).forEach((key) => {
      const bone = model.getObjectByName(GESTURE_BONES[key]) ?? null;
      if (bone) {
        bones[key] = bone;
        // Capture rest rotation as a fresh Euler so runtime writes never lose it.
        rests[key] = bone.rotation.clone();
      } else {
        console.warn(
          `[CoachScene] gesture bone "${GESTURE_BONES[key]}" not found; skipping its motion.`
        );
      }
    });
    boneRef.current = bones;
    restRef.current = rests;
    return () => {
      boneRef.current = {};
      restRef.current = {};
    };
  }, [model]);

  // Drive the procedural bone gesturing each frame. A single smoothed 0..1
  // amount eases toward 1 while speaking and 0 when silent, framerate-
  // independent, so gestures fade in/out with no snap. It multiplies every
  // per-bone oscillation, so at rest (amount == 0) the bones sit at their
  // captured rest rotation exactly. Under reduced motion the target is 0, so
  // the astronaut eases to its rest pose and holds (no pinned-pose constant is
  // touched — the captured rest rotations ARE the pose).
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    const gTarget = reducedMotion ? 0 : speaking ? 1 : 0;
    const kGesture = 1 - Math.exp(-delta * 6);
    gestureRef.current += (gTarget - gestureRef.current) * kGesture;
    const amt = gestureRef.current;

    // A very subtle always-on idle sway so the astronaut is never perfectly
    // static even when silent. It is gated by reduced motion (idle == 0 then)
    // and is an order of magnitude smaller than the talking gestures.
    const idle = reducedMotion ? 0 : 1;

    const bones = boneRef.current;
    const rests = restRef.current;

    // Add a bounded per-bone offset ON TOP of the captured rest rotation. The
    // `amt` term is the speaking-gated gesture; the `idleTerm` is the tiny
    // always-on sway. Amplitudes are bounded so the limbs read clearly as
    // gesturing yet never clip through the torso/head within the fixed
    // head-and-torso framing (arms peak ~0.26 rad, forearm raise ~0.5 rad,
    // hands ~0.3 rad; spine/neck/head stay under ~0.1 rad).
    const setBone = (
      key: GestureBoneKey,
      dx: number,
      dy: number,
      dz: number,
      idleTerm = 0
    ) => {
      const bone = bones[key];
      const rest = rests[key];
      if (!bone || !rest) return;
      bone.rotation.set(
        rest.x + dx * amt + idleTerm * idle,
        rest.y + dy * amt,
        rest.z + dz * amt
      );
    };

    // Right arm: a clear upper-arm swing + pronounced forearm raise/rotate + a
    // wrist flick. Frequencies/phases differ per bone so it reads lively.
    setBone(
      "rArm",
      0.26 * Math.sin(t * 2.1),
      0.18 * Math.sin(t * 1.7 + 0.5),
      0.16 * Math.sin(t * 2.4)
    );
    setBone(
      "rForearm",
      0.50 * (0.5 + 0.5 * Math.sin(t * 3.1)),
      0.22 * Math.sin(t * 2.6 + 0.9),
      0.18 * Math.sin(t * 3.4)
    );
    setBone(
      "rHand",
      0.30 * Math.sin(t * 4.2),
      0.20 * Math.sin(t * 3.7 + 1.2),
      0.18 * Math.sin(t * 4.6)
    );

    // Left arm: same motif, out of phase (offset frequencies/phases) so the two
    // sides never mirror each other exactly.
    setBone(
      "lArm",
      0.26 * Math.sin(t * 1.9 + 1.6),
      0.18 * Math.sin(t * 1.5 + 2.1),
      0.16 * Math.sin(t * 2.2 + 1.1)
    );
    setBone(
      "lForearm",
      0.50 * (0.5 + 0.5 * Math.sin(t * 2.8 + 1.3)),
      0.22 * Math.sin(t * 2.3 + 2.4),
      0.18 * Math.sin(t * 3.1 + 0.7)
    );
    setBone(
      "lHand",
      0.30 * Math.sin(t * 3.9 + 2.0),
      0.20 * Math.sin(t * 3.4 + 0.4),
      0.18 * Math.sin(t * 4.3 + 1.8)
    );

    // Spine + chest: a small twist/lean so the whole torso engages while
    // talking. Bounded well under a tenth of a radian so the framing holds. A
    // tiny idle sway (last arg) keeps the torso alive when silent.
    setBone(
      "spine",
      0.04 * Math.sin(t * 1.5),
      0.06 * Math.sin(t * 1.1 + 0.3),
      0.03 * Math.sin(t * 1.8),
      0.012 * Math.sin(t * 0.9)
    );
    setBone(
      "chest",
      0.03 * Math.sin(t * 1.9 + 0.6),
      0.05 * Math.sin(t * 1.4 + 1.0),
      0.03 * Math.sin(t * 2.2),
      0.010 * Math.sin(t * 1.1 + 0.5)
    );

    // Neck + head: a gentle nod/turn so the coach "addresses" you while
    // speaking, plus a barely-there idle bob so the head is never frozen.
    setBone(
      "neck",
      0.05 * Math.sin(t * 2.0 + 0.4),
      0.06 * Math.sin(t * 1.6),
      0.02 * Math.sin(t * 2.3),
      0.010 * Math.sin(t * 1.3)
    );
    setBone(
      "head",
      0.06 * Math.sin(t * 2.4 + 0.8),
      0.07 * Math.sin(t * 1.9 + 0.5),
      0.03 * Math.sin(t * 2.7),
      0.012 * Math.sin(t * 1.5 + 0.2)
    );
  });

  // On unmount, dispose ONLY the resources this component owns. SkeletonUtils
  // .clone reuses geometries AND materials by reference from the loader-cached
  // gltf.scene (we did not create new materials — we only tweaked color space on
  // the shared ones), and useLoader keeps the GLTF cached for reuse across
  // strict-mode remounts. So we deliberately do NOT dispose the geometries,
  // materials, or embedded textures here — they are owned by the loader cache,
  // not by this clone. Disposing them would corrupt a subsequent remount. We
  // only drop our bone references.
  useEffect(() => {
    return () => {
      boneRef.current = {};
      restRef.current = {};
    };
  }, [model]);

  return <primitive object={model} />;
}

// A subtle procedural ground plane so the coach reads as standing ON something
// rather than floating over only the ContactShadows. It is a plain-color matte
// disc placed at y=0 (the same plane ContactShadows uses) with a soft radial
// vignette baked into a tiny canvas texture, so it fades out at the edges and
// never shows a hard rim in the fixed shot. No external image asset — the
// texture is generated in-memory, so it adds nothing to the cold-load budget.
// Gated to High (it costs an extra draw + a receiveShadow surface); on Fast the
// figure keeps only its ContactShadows, exactly like today.
function GroundBackdrop() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.08,
        size / 2,
        size / 2,
        size / 2
      );
      // Cool neutral gym-floor grey, fading to transparent at the rim so the
      // disc dissolves into the scene background instead of ending on a line.
      grad.addColorStop(0, "rgba(210,212,216,1)");
      grad.addColorStop(0.62, "rgba(196,198,203,1)");
      grad.addColorStop(1, "rgba(196,198,203,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
      <circleGeometry args={[4.2, 64]} />
      <meshStandardMaterial
        map={texture}
        transparent
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

// ENGINE-DRIVEN CAMERA NUDGE. LAYERED on the pinned framing: the camera still
// starts at [0, AIM_HEIGHT, CAMERA_DISTANCE] and always looks at [0, AIM_HEIGHT,
// 0] (those constants are untouched). Each frame we ease a small ADDITIVE offset
// toward a per-focus rest pose with drei's maath `damp3`, then write
// camera.position = pinnedRest + offset and re-aim at a slightly nudged look
// target. The move is tiny (a few cm / a few degrees) so the locked shot holds.
//
// CRITICAL: the rig reacts ONLY to the `focus` value the ENGINE returned; it
// never inspects the user's words. `focusNonce` lets the same focus re-arm the
// move (a brief pulse) so clicking the kettlebell twice still reads.
const PINNED_CAM = new THREE.Vector3(0, AIM_HEIGHT, CAMERA_DISTANCE);
const PINNED_LOOK = new THREE.Vector3(0, AIM_HEIGHT, 0);

// Per-focus additive camera offset (metres) + look-target offset (metres),
// applied ON TOP of the pinned rest. When the coach is demonstrating a routine
// (exercises/walkthrough) we push in a touch to lock onto the demo; when
// offering options (suggest) we settle back a hair.
function coachFocusPose(focus: CoachFocus | null | undefined): {
  posOffset: THREE.Vector3;
  lookOffset: THREE.Vector3;
} {
  switch (focus) {
    case "exercises":
    case "walkthrough":
      return {
        posOffset: new THREE.Vector3(0, -0.02, -0.18),
        lookOffset: new THREE.Vector3(0, -0.04, 0),
      };
    case "suggest":
      return {
        posOffset: new THREE.Vector3(0, 0.05, 0.08),
        lookOffset: new THREE.Vector3(0, 0.03, 0),
      };
    default:
      return {
        posOffset: new THREE.Vector3(0, 0, 0),
        lookOffset: new THREE.Vector3(0, 0, 0),
      };
  }
}

function CameraRig({
  focus,
  focusNonce = 0,
  reducedMotion = false,
}: {
  focus?: CoachFocus | null;
  focusNonce?: number;
  reducedMotion?: boolean;
}) {
  const posOffset = useRef(new THREE.Vector3());
  const lookOffset = useRef(new THREE.Vector3());
  // Short 0..1 pulse re-armed on every nonce so the same focus reads again and
  // we always ease back to the pinned rest even while a focus lingers.
  const pulse = useRef(0);
  useEffect(() => {
    pulse.current = 1;
  }, [focusNonce]);

  useFrame((state, delta) => {
    const { posOffset: targetPos, lookOffset: targetLook } = coachFocusPose(focus);
    // Reduced motion: hold the pinned framing (drive the nudge target to 0).
    if (reducedMotion) {
      pulse.current = 0;
    } else {
      pulse.current = Math.max(0, pulse.current - delta / 1.2);
    }
    const scale = pulse.current;

    damp3(
      posOffset.current,
      [targetPos.x * scale, targetPos.y * scale, targetPos.z * scale],
      0.5,
      delta
    );
    damp3(
      lookOffset.current,
      [targetLook.x * scale, targetLook.y * scale, targetLook.z * scale],
      0.5,
      delta
    );

    state.camera.position.set(
      PINNED_CAM.x + posOffset.current.x,
      PINNED_CAM.y + posOffset.current.y,
      PINNED_CAM.z + posOffset.current.z
    );
    state.camera.lookAt(
      PINNED_LOOK.x + lookOffset.current.x,
      PINNED_LOOK.y + lookOffset.current.y,
      PINNED_LOOK.z + lookOffset.current.z
    );
  });

  return null;
}

// AMBIENT LIFE: a subtle gym "floor shimmer" — a few soft points low near the
// floor that drift and pulse gently, so the stage isn't dead when idle. All
// procedural (no external asset). The heavier version (more, larger points) is
// gated to High; on Fast we keep a tiny always-on shimmer so the scene lives
// without regressing the Fast frame budget.
function FloorShimmer({ high }: { high: boolean }) {
  const count = high ? 22 : 8;

  const seeds = useMemo(() => {
    const arr: { x: number; z: number; phase: number; freq: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 0.35 + 0.4 * (((i * 7) % 5) / 5);
      arr.push({
        x: Math.cos(a) * r,
        z: -0.1 + Math.sin(a) * r * 0.7,
        phase: (i * 1.19) % (Math.PI * 2),
        freq: 0.6 + ((i * 3) % 5) / 5,
      });
    }
    return arr;
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    );
    return g;
  }, [count]);

  const sprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      grad.addColorStop(0, "rgba(255,242,0,0.55)");
      grad.addColorStop(1, "rgba(255,242,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      sprite.dispose();
    };
  }, [geometry, sprite]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      // Hover just above the floor with a gentle vertical bob + tiny drift.
      const y = 0.03 + 0.02 * (0.5 + 0.5 * Math.sin(t * s.freq + s.phase));
      const x = s.x + Math.sin(t * s.freq * 0.5 + s.phase) * 0.03;
      pos.setXYZ(i, x, y, s.z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={sprite}
        size={high ? 0.14 : 0.1}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={high ? 0.35 : 0.25}
        color="#ffffff"
      />
    </points>
  );
}

// The clickable kettlebell prop: a procedural ball + handle placed low and to
// the side, within the fixed frame. On pointer-down it calls the callback
// CoachChatbot wired to its EXISTING send() — it holds NO workout text. drei
// useCursor gives a pointer affordance on hover.
function KettlebellProp({
  onClick,
  reducedMotion = false,
}: {
  onClick?: () => void;
  reducedMotion?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const groupRef = useRef<THREE.Group>(null);

  // A tiny idle bob + a hover lift so it reads as interactive. Eased so it never
  // snaps. Purely visual; the click routes through the engine. Under reduced
  // motion the idle sine-bob is dropped (only the discrete hover lift remains);
  // the click behaviour is unchanged.
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const idleBob = reducedMotion ? 0 : Math.sin(t * 1.6) * 0.006;
    const targetY = 0.09 + (hovered ? 0.03 : 0) + idleBob;
    damp(g.position, "y", targetY, 0.18, delta);
  });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <group
      ref={groupRef}
      position={[0.6, 0.09, 0.4]}
      onPointerDown={handleDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* bell body */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.09, 24, 20]} />
        <meshStandardMaterial
          color={hovered ? "#ff2fa3" : "#2b2b2b"}
          roughness={0.5}
          metalness={0.4}
        />
      </mesh>
      {/* handle: a partial torus arching over the top */}
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.05, 0.014, 12, 24, Math.PI]} />
        <meshStandardMaterial
          color={hovered ? "#ffd27a" : "#3a3a3a"}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
    </group>
  );
}

// `speaking` drives the procedural bone gesturing in <Avatar />. The GLB is
// rigged (52 joints) but ships no baked clips, so the arm/spine/head motion is
// authored procedurally and gated to the speaking window.
export default function CoachScene({
  speaking = false,
  getLoudness,
  quality = DEFAULT_QUALITY,
  focus = null,
  focusNonce = 0,
  onKettlebellClick,
  reducedMotion = false,
}: SceneProps) {
  const q = qualitySettings(quality);
  const isHigh = quality === "high";
  return (
    <Canvas
      shadows={q.shadows}
      dpr={q.dpr}
      camera={{ position: [0, AIM_HEIGHT, CAMERA_DISTANCE], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the avatar stage.
      role="img"
      aria-label="Animated 3D astronaut gym coach that gestures with its arms while giving workout advice"
      onCreated={({ gl, camera }) => {
        // Tone mapping unchanged (ACESFilmic): the astronaut GLB's suit renders
        // fine under the near-neutral rig below with no blow-out, so per
        // CONSTRAINT #2 we leave the tone mapping as-is.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim the camera straight at the aim point
        // the model was recentered onto (its upper chest). No OrbitControls,
        // no zoom — the shot is intentionally locked.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* NOTE: drei <SoftShadows> is intentionally NOT used. It rewrites the
          global shadow-map shader chunk, which collides with the VRM's MToon
          Face ShaderMaterial in the wardrobe scene; to keep ONE consistent soft
          approach across all four scenes we soften edges the plan's alternative
          way instead — higher shadow-map res on High + tuned ContactShadows
          blur. */}

      {/* Proper key/fill/bounce rig, kept NEAR-NEUTRAL so the coach's textures
          keep their true color (no colored blow-out under the stronger key). */}
      {/* Base ambient so shaded sides never go black. */}
      <ambientLight intensity={0.62} color="#ffffff" />
      {/* KEY: the shaping light, front-right and high; only it casts shadows.
          Shadow-map resolution scales with quality (High > today's 1024). */}
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.15}
        color="#fffdf2"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0009}
      />
      {/* FILL: softer, from the opposite (left) side to open up the shadow. */}
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#ffffff" />
      {/* Sky-to-ground bounce, near-neutral so it never tints the textures. */}
      <hemisphereLight args={["#eef4ff", "#f3f0e6", 0.45]} />
      {/* RIM / back-bounce (High only): a subtle behind-and-above point light
          that separates the figure from the backdrop. Skipped on Fast. */}
      {isHigh ? (
        <pointLight
          position={[-1.6, 3.2, -2.6]}
          intensity={0.55}
          color="#ffffff"
          distance={9}
          decay={1.6}
        />
      ) : null}

      {/* Engine-driven camera nudge, layered on the pinned framing. Reacts ONLY
          to the `focus` the engine returned; eases back to the locked shot. */}
      <CameraRig
        focus={focus}
        focusNonce={focusNonce}
        reducedMotion={reducedMotion}
      />

      <Suspense fallback={<SceneLoader />}>
        <group position={[0, 0, 0]}>
          <Avatar
            speaking={speaking}
            getLoudness={getLoudness}
            reducedMotion={reducedMotion}
          />
        </group>
        {/* ONE clickable prop. Its handler calls CoachChatbot's EXISTING send()
            with a real query, so the answer comes from the engine — the scene
            holds no workout text. */}
        <KettlebellProp
          onClick={onKettlebellClick}
          reducedMotion={reducedMotion}
        />
        {/* Ambient life: a cheap procedural floor shimmer, always on (tiny on
            Fast, heavier only on High so the Fast frame budget never regresses).
            Skipped entirely under reduced motion so nothing drifts. */}
        {reducedMotion ? null : <FloorShimmer high={isHigh} />}
        {/* Ground backdrop for depth — High only (extra draw + shadow catcher). */}
        {isHigh ? <GroundBackdrop /> : null}
      </Suspense>

      {/* Kept ContactShadows so the figure never floats; softened blur a touch
          for a gentler edge that reads with the new rig. */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.3}
        scale={4}
        blur={isHigh ? 3.0 : 2.6}
        far={2}
        color="#111111"
      />
    </Canvas>
  );
}
