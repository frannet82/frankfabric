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
// HAND / ARM MOTION: the SAME `speaking` window that drives the jaw also drives
// subtle arm/hand gesturing. We resolve the Biped arm-chain bones
// (Bip001_{L,R}_UpperArm / _Forearm / _Hand) by name on the cloned model and
// capture each bone's rest rotation once. In useFrame a single smoothed 0..1
// "gesture amount" eases toward 1 while speaking and back to 0 when silent; it
// multiplies small, per-bone time-based oscillations (offset in frequency and
// phase between bones and between the two sides) added ON TOP OF each captured
// rest rotation, so the chef gesticulates naturally while talking and eases
// back to its exact rest pose when done. Amplitudes are kept small (a few
// degrees to ~0.3 rad) so it reads within the fixed head-and-torso framing and
// never flails. Any missing arm bone is skipped gracefully, like the jaw.
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

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useLoader, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor } from "@react-three/drei";
import { damp, damp3 } from "maath/easing";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "@/lib/asset";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";
import type { ChefFocus } from "@/lib/chef/chefEngine";

type SceneProps = {
  // True while the chef's reply is "playing"; opens the mouth-motion window.
  speaking?: boolean;
  // Returns a live 0..1 audio loudness (Web Audio AnalyserNode RMS). When it
  // returns 0 while speaking (e.g. muted), the jaw falls back to a sine wobble.
  getLoudness?: () => number;
  // Shared High/Fast render-quality tier (components/three/quality.ts). Gates
  // Canvas shadows, dpr, shadow-map resolution, soft shadows and the heavier
  // fill/bounce lights + ground backdrop. Defaults to High.
  quality?: Quality;
  // The engine's branch read-out for the latest reply (see ChefFocus). The
  // camera reacts ONLY to this value the engine returned — it never re-derives
  // intent from keywords. null when there has been no reply yet.
  focus?: ChefFocus | null;
  // Monotonic counter bumped by ChefChatbot on every send so the SAME focus
  // still re-fires the camera nudge (mirrors VirtualPet's action + actionNonce).
  focusNonce?: number;
  // Called on pointer-down on the clickable "sample dish" prop. ChefChatbot
  // wires this to its EXISTING send() with a real query string, so the answer
  // is produced by the engine exactly as if the user typed it. This scene never
  // constructs any recipe text itself.
  onSampleDishClick?: () => void;
  // When true (user prefers reduced motion), all AMBIENT/IDLE motion is gated:
  // the camera nudge holds the pinned framing, the steam wisp is skipped, the
  // dish prop's idle wobble/spin is frozen, and the avatar's talking arm
  // gestures are damped to their captured rest pose. Speech-driven jaw motion
  // (lip-sync) still tracks the reply, and interactions still route through the
  // engine — only the MOTION response is damped. Defaults to false so behaviour
  // is identical to today when the preference is off.
  reducedMotion?: boolean;
};

// Name of the jaw bone in the Swedish Chef Biped rig. Verified in FEAT-001.
const JAW_BONE = "Bip001_Jaw";
// Max additional rotation (radians) applied to open the jaw fully.
const JAW_OPEN = 0.32;

// HAND/ARM MOTION: bone names of the Biped arm chain (verified headlessly by
// name against the FBX). While `speaking` is true the chef gesticulates with
// subtle, natural arm/hand gestures driven by the SAME speaking window as the
// jaw; when it stops we ease the arms back to their captured rest rotation.
const ARM_BONES = {
  rUpperArm: "Bip001_R_UpperArm",
  rForearm: "Bip001_R_Forearm",
  rHand: "Bip001_R_Hand",
  lUpperArm: "Bip001_L_UpperArm",
  lForearm: "Bip001_L_Forearm",
  lHand: "Bip001_L_Hand",
} as const;
type ArmBoneKey = keyof typeof ARM_BONES;

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
  reducedMotion = false,
}: {
  speaking?: boolean;
  getLoudness?: () => number;
  reducedMotion?: boolean;
}) {
  const fbx = useLoader(FBXLoader, MODEL_URL);
  const loadedTexture = useLoader(THREE.TextureLoader, TEXTURE_URL);

  // The jaw bone and its captured rest X-rotation. Resolved once the model is
  // built; null when the bone is absent (mouth motion then degrades gracefully).
  const jawRef = useRef<THREE.Object3D | null>(null);
  const jawRestX = useRef(0);
  // Smoothed 0..1 "openness" so the jaw eases between frames.
  const openRef = useRef(0);

  // The arm-chain bones and each bone's captured rest rotation (x/y/z). Bones
  // absent at runtime are skipped gracefully (like the jaw's missing guard).
  const armBonesRef = useRef<Partial<Record<ArmBoneKey, THREE.Object3D>>>({});
  const armRestRef = useRef<Partial<Record<ArmBoneKey, THREE.Euler>>>({});
  // Smoothed 0..1 "gesture amount" easing toward 1 while speaking, 0 otherwise.
  // Multiplies every arm oscillation so the gesture fades in/out with no snap.
  const gestureRef = useRef(0);

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

  // Resolve the arm-chain bones on the cloned root and capture each bone's rest
  // rotation once, mirroring the jaw approach. Any missing bone is skipped
  // gracefully (we simply never animate it) so a rig change can't throw.
  useEffect(() => {
    const bones: Partial<Record<ArmBoneKey, THREE.Object3D>> = {};
    const rests: Partial<Record<ArmBoneKey, THREE.Euler>> = {};
    (Object.keys(ARM_BONES) as ArmBoneKey[]).forEach((key) => {
      const bone = model.getObjectByName(ARM_BONES[key]) ?? null;
      if (bone) {
        bones[key] = bone;
        // Capture rest rotation as a fresh Euler so runtime writes never lose it.
        rests[key] = bone.rotation.clone();
      } else {
        console.warn(
          `[ChefScene] arm bone "${ARM_BONES[key]}" not found; skipping its gesture.`
        );
      }
    });
    armBonesRef.current = bones;
    armRestRef.current = rests;
    return () => {
      armBonesRef.current = {};
      armRestRef.current = {};
    };
  }, [model]);

  // Drive the jaw open/closed each frame. While speaking, use live audio
  // loudness (0..1) when available, else a smooth sine wobble; ease back to
  // rest when not speaking.
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // --- Mouth (jaw) motion --------------------------------------------------
    const jaw = jawRef.current;
    if (jaw) {
      let target = 0;
      if (speaking) {
        const loud = getLoudness ? getLoudness() : 0;
        if (loud > 0.01) {
          target = Math.min(1, loud);
        } else {
          // Fallback oscillation (e.g. muted-but-speaking): 0..1 sine.
          target = 0.5 + 0.5 * Math.sin(t * 13);
        }
      }
      // Exponential smoothing toward target, framerate-independent.
      const kJaw = 1 - Math.exp(-delta * 18);
      openRef.current += (target - openRef.current) * kJaw;
      jaw.rotation.x = jawRestX.current + openRef.current * JAW_OPEN;
    }

    // --- Hand / arm gesturing ------------------------------------------------
    // A single smoothed 0..1 amount eases toward 1 while speaking and 0 when
    // silent, framerate-independent, so gestures fade in/out with no snap. It
    // multiplies every oscillation, so at rest the arms sit at their captured
    // rest rotation exactly (amount == 0 -> zero offset).
    // Under reduced motion, damp the talking arm gestures to rest (target 0),
    // so the arms ease to their captured rest rotation and hold. The gesture
    // amount multiplies every arm oscillation, so a 0 amount = exact rest pose
    // (no pinned pose constant is touched). Lip-sync jaw motion above still
    // tracks speech.
    const gTarget = reducedMotion ? 0 : speaking ? 1 : 0;
    const kGesture = 1 - Math.exp(-delta * 6);
    gestureRef.current += (gTarget - gestureRef.current) * kGesture;
    const amt = gestureRef.current;

    const bones = armBonesRef.current;
    const rests = armRestRef.current;
    // Small, tasteful talking gestures. Amplitudes stay a few degrees to
    // ~0.3 rad so the chef reads as gesticulating, never flailing. Frequencies
    // and phases differ per bone and between sides so it looks lively, not
    // robotic. Offsets are ADDED on top of each bone's captured rest rotation.
    const setBone = (
      key: ArmBoneKey,
      dx: number,
      dy: number,
      dz: number
    ) => {
      const bone = bones[key];
      const rest = rests[key];
      if (!bone || !rest) return;
      bone.rotation.set(
        rest.x + dx * amt,
        rest.y + dy * amt,
        rest.z + dz * amt
      );
    };

    // Right arm: gentle forearm raise/rotate + a little upper-arm sway.
    setBone(
      "rUpperArm",
      0.10 * Math.sin(t * 2.1),
      0.08 * Math.sin(t * 1.7 + 0.5),
      0.06 * Math.sin(t * 2.4)
    );
    setBone(
      "rForearm",
      0.22 * (0.5 + 0.5 * Math.sin(t * 3.1)),
      0.10 * Math.sin(t * 2.6 + 0.9),
      0.08 * Math.sin(t * 3.4)
    );
    setBone(
      "rHand",
      0.14 * Math.sin(t * 4.2),
      0.10 * Math.sin(t * 3.7 + 1.2),
      0.08 * Math.sin(t * 4.6)
    );

    // Left arm: same motif, out of phase (offset frequencies/phases) so the two
    // sides never mirror each other exactly.
    setBone(
      "lUpperArm",
      0.10 * Math.sin(t * 1.9 + 1.6),
      0.08 * Math.sin(t * 1.5 + 2.1),
      0.06 * Math.sin(t * 2.2 + 1.1)
    );
    setBone(
      "lForearm",
      0.22 * (0.5 + 0.5 * Math.sin(t * 2.8 + 1.3)),
      0.10 * Math.sin(t * 2.3 + 2.4),
      0.08 * Math.sin(t * 3.1 + 0.7)
    );
    setBone(
      "lHand",
      0.14 * Math.sin(t * 3.9 + 2.0),
      0.10 * Math.sin(t * 3.4 + 0.4),
      0.08 * Math.sin(t * 4.3 + 1.8)
    );
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

// A subtle procedural ground plane so the chef reads as standing ON something
// rather than floating over only the ContactShadows. A matte disc at y=0 with a
// soft radial vignette baked into a small in-memory canvas texture (no external
// asset, nothing added to the cold-load budget), fading out at the rim. Gated
// to High; on Fast the chef keeps only its ContactShadows, exactly like today.
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
      // Warm cozy-kitchen wood/cream tone, fading to transparent at the edge so
      // the disc dissolves into the scene background rather than ending hard.
      grad.addColorStop(0, "rgba(226,210,186,1)");
      grad.addColorStop(0.62, "rgba(210,190,160,1)");
      grad.addColorStop(1, "rgba(210,190,160,0)");
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

// ENGINE-DRIVEN CAMERA NUDGE. This is LAYERED on top of the pinned framing: the
// camera still starts at [0, AIM_HEIGHT, CAMERA_DISTANCE] and always looks at
// [0, AIM_HEIGHT, 0] (those constants are untouched). Each frame we ease a small
// ADDITIVE offset toward a per-focus rest pose with drei's maath `damp3`, then
// write camera.position = pinnedRest + offset and re-aim at a slightly nudged
// look target. The move is deliberately tiny (a few cm of push-in, a few degrees
// of tilt) so it reads as a reaction, never a re-frame that fights the shot.
//
// CRITICAL: the rig reacts ONLY to the `focus` value the ENGINE returned; it
// never inspects the user's words. `focusNonce` lets the same focus re-arm the
// move (a brief pulse) so clicking the sample dish twice still reads.
const PINNED_CAM = new THREE.Vector3(0, AIM_HEIGHT, CAMERA_DISTANCE);
const PINNED_LOOK = new THREE.Vector3(0, AIM_HEIGHT, 0);

// Per-focus additive camera offset (metres) + look-target offset (metres),
// applied ON TOP of the pinned rest. Kept small so the locked shot stays locked.
// When the chef is "presenting" something (ingredients/recipe) we push in a few
// cm and tip the aim down a touch to "look at what the chef is showing".
function chefFocusPose(focus: ChefFocus | null | undefined): {
  posOffset: THREE.Vector3;
  lookOffset: THREE.Vector3;
} {
  switch (focus) {
    case "ingredients":
    case "recipe":
      // Small push-in (−Z toward the chef) + a slight downward look tilt.
      return {
        posOffset: new THREE.Vector3(0, -0.03, -0.16),
        lookOffset: new THREE.Vector3(0, -0.05, 0),
      };
    case "suggest":
      // A gentle lift/settle-back as the chef offers options.
      return {
        posOffset: new THREE.Vector3(0, 0.04, 0.06),
        lookOffset: new THREE.Vector3(0, 0.02, 0),
      };
    default:
      // greeting / chat / none: rest at the pinned framing.
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
  focus?: ChefFocus | null;
  focusNonce?: number;
  reducedMotion?: boolean;
}) {
  // Current eased offsets (mutated in place by damp3 each frame).
  const posOffset = useRef(new THREE.Vector3());
  const lookOffset = useRef(new THREE.Vector3());
  // A short 0..1 "pulse" re-armed on every nonce so the same focus reads again:
  // it scales the nudge up briefly, then relaxes so we always ease back to the
  // pinned rest even while a focus lingers.
  const pulse = useRef(0);
  useEffect(() => {
    pulse.current = 1;
  }, [focusNonce]);

  useFrame((state, delta) => {
    const { posOffset: targetPos, lookOffset: targetLook } = chefFocusPose(focus);
    // Reduced motion: hold the pinned framing exactly. We drive the pulse to 0
    // so the nudge target is zero — the camera settles to the pinned rest and
    // stays there (the PINNED_CAM/PINNED_LOOK constants below are untouched).
    if (reducedMotion) {
      pulse.current = 0;
    } else {
      // Relax the pulse toward 0 (~1.2s), framerate-independent, so the reaction
      // eases back to the locked shot even if `focus` stays the same.
      pulse.current = Math.max(0, pulse.current - delta / 1.2);
    }
    const scale = pulse.current;

    // Ease the live offsets toward (target * pulse) with drei's maath damp3.
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

    // Compose: pinned rest + eased additive offset. The pinned constants above
    // are never mutated — we only add to a fresh copy.
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

// AMBIENT LIFE: a cheap drifting "steam wisp" so the kitchen feels alive even
// when the chef is idle. A handful of soft round points rise, drift sideways on
// a sine, fade as they climb, and recycle at the bottom — all procedural, no
// external asset. The heavier version (more, larger points) is gated to High;
// on Fast we keep a tiny always-on wisp so the scene is never dead but the Fast
// frame budget does not regress.
function SteamWisps({ high }: { high: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = high ? 26 : 10;

  // Per-particle base position, drift phase/speed and rise speed. Seeded once
  // (deterministic-ish spread) so the wisp reads organic without any RNG churn.
  const seeds = useMemo(() => {
    const arr: { x: number; z: number; phase: number; freq: number; rise: number; y0: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      arr.push({
        x: Math.cos(a) * (0.18 + 0.12 * ((i * 7) % 5) / 5),
        z: -0.1 + Math.sin(a) * 0.16,
        phase: (i * 1.37) % (Math.PI * 2),
        freq: 0.5 + ((i * 3) % 5) / 6,
        rise: 0.18 + ((i * 5) % 4) / 18,
        y0: ((i * 11) % 10) / 10,
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

  // A soft round sprite baked into a tiny in-memory canvas (no external asset).
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
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
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

  // Rise + drift each frame. The chef's aim point is ~AIM_HEIGHT, so wisps
  // travel from just above the (recentered) chef upward and recycle. Cheap: a
  // few dozen point writes, no per-frame allocation.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      // Cycle 0..1 over the particle's lifetime, offset per particle.
      const life = (s.y0 + t * s.rise) % 1;
      const y = AIM_HEIGHT + 0.15 + life * 0.6;
      const x = s.x + Math.sin(t * s.freq + s.phase) * 0.05;
      pos.setXYZ(i, x, y, s.z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={sprite}
        size={high ? 0.16 : 0.12}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={high ? 0.22 : 0.16}
        color="#ffffff"
      />
    </points>
  );
}

// The clickable "sample dish" prop: a small procedural plate + dome placed low
// and to the side, within the fixed frame. On pointer-down it calls the
// callback ChefChatbot wired to its EXISTING send() — it holds NO recipe text.
// drei useCursor gives a pointer affordance on hover.
function SampleDishProp({
  onClick,
  reducedMotion = false,
}: {
  onClick?: () => void;
  reducedMotion?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const groupRef = useRef<THREE.Group>(null);

  // A tiny idle wobble + a hover lift so it reads as interactive. Eased so it
  // never snaps. Purely visual; the click routes through the engine. Under
  // reduced motion the idle sine-wobble and the continuous spin are dropped so
  // the prop rests still (only the discrete hover lift remains as an
  // interaction affordance); the click behaviour is unchanged.
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const idleBob = reducedMotion ? 0 : Math.sin(t * 1.8) * 0.006;
    const targetY = 0.02 + (hovered ? 0.03 : 0) + idleBob;
    damp(g.position, "y", targetY, 0.18, delta);
    if (!reducedMotion) g.rotation.y += delta * 0.3;
  });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <group
      ref={groupRef}
      position={[0.55, 0.02, 0.35]}
      onPointerDown={handleDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* plate */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.11, 0.02, 32]} />
        <meshStandardMaterial color="#f4efe6" roughness={0.6} metalness={0.05} />
      </mesh>
      {/* domed cloche (a friendly "what's cooking?" cue — no text) */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <sphereGeometry args={[0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={hovered ? "#ffd27a" : "#d7c4a3"}
          roughness={0.35}
          metalness={0.35}
        />
      </mesh>
      {/* knob */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial color="#b9a074" roughness={0.4} metalness={0.4} />
      </mesh>
    </group>
  );
}

// `speaking` + `getLoudness` drive the bone-based mouth motion in <Avatar />.
// The FBX ships no baked body clips, so there is no body-animation prop.
export default function ChefScene({
  speaking = false,
  getLoudness,
  quality = DEFAULT_QUALITY,
  focus = null,
  focusNonce = 0,
  onSampleDishClick,
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
      aria-label="Animated 3D chef avatar in chef whites that gestures and speaks while giving cooking answers"
      onCreated={({ gl, camera }) => {
        // Tone mapping unchanged (ACESFilmic): the chef's matte
        // MeshStandardMaterial renders its skin/face texture fine under the
        // near-neutral rig below, so per CONSTRAINT #2 we leave it as-is.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim the camera straight at the aim point
        // the model was recentered onto (its upper chest). No OrbitControls,
        // no zoom — the shot is intentionally locked.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* NOTE: drei <SoftShadows> is intentionally NOT used (see WardrobeScene):
          it rewrites the global shadow shader chunk and can collide with the
          VRM MToon shader; we keep ONE consistent soft approach across all four
          scenes — higher shadow-map res on High + tuned ContactShadows blur. */}

      {/* Cozy Animal-Crossing lighting: soft and evenly lit, but kept NEAR
          NEUTRAL so the chef's diffuse texture shows its true colors. Now a
          proper key/fill/bounce rig (only the key casts shadows). Colors stay
          white / only very subtly warm (#fff6ec) so the chef is never
          recolored and skin never picks up a colored blow-out. */}
      <ambientLight intensity={0.8} color="#ffffff" />
      {/* KEY: front-right, high; the only shadow caster. Shadow-map res scales
          with quality (High above today's 1024). */}
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.1}
        color="#fff6ec"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0009}
      />
      {/* FILL: softer, from the opposite side, to open up the shadow side. */}
      <directionalLight position={[-4, 3, -3]} intensity={0.45} color="#ffffff" />
      {/* Sky-to-ground bounce, near-neutral so it never tints. */}
      <hemisphereLight args={["#eef4ff", "#f3efe6", 0.45]} />
      {/* RIM / back-bounce (High only): subtle separation from the backdrop. */}
      {isHigh ? (
        <pointLight
          position={[-1.6, 3.0, -2.6]}
          intensity={0.5}
          color="#fff3e6"
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
        {/* ONE clickable prop. Its handler calls ChefChatbot's EXISTING send()
            with a real query, so the answer comes from the engine — the scene
            holds no recipe text. */}
        <SampleDishProp
          onClick={onSampleDishClick}
          reducedMotion={reducedMotion}
        />
        {/* Ambient life: a cheap procedural steam wisp, always on (tiny on Fast,
            heavier only on High so the Fast frame budget never regresses).
            Skipped entirely under reduced motion so nothing drifts. */}
        {reducedMotion ? null : <SteamWisps high={isHigh} />}
        {/* Ground backdrop for depth — High only. */}
        {isHigh ? <GroundBackdrop /> : null}
      </Suspense>

      {/* Kept ContactShadows so the chef never floats; softened blur on High. */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.28}
        scale={4}
        blur={isHigh ? 3.0 : 2.6}
        far={2}
        color="#6b4f2a"
      />
    </Canvas>
  );
}
