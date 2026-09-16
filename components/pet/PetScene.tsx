"use client";

// ---------------------------------------------------------------------------
// Virtual pet — interactive 3D chicken scene (RIGGED FBX + AnimationMixer).
//
// This renders a RIGGED chicken loaded from an FBX
// (public/models/characters/chicken/chicken.fbx). Unlike the old, unrigged
// schnauzer .glb, this model ships a 50-bone skeleton, three skinned meshes and
// ONE baked skeletal animation clip ("Take 001", ~2.67s) — a real idle. We
// drive that clip with a THREE.AnimationMixer so the pet has genuine skeletal
// motion (a breathing/settling idle), advanced each frame with
// mixer.update(delta) in useFrame.
//
// CLONING: the FBX contains SkinnedMeshes bound to the skeleton. A plain
// Object3D.clone(true) does NOT rebind the cloned skin to the cloned bones, so
// the skinned mesh renders collapsed/invisible (the "empty container" bug). We
// clone with SkeletonUtils.clone (same pattern as components/chef/ChefScene.tsx),
// which duplicates skinned meshes and rebinds their skeletons.
//
// TEXTURES: three's FBXLoader does NOT auto-load this model's maps (they are
// authored as 3dsMax map slots FBXLoader skips), and the four textures ship as
// SEPARATE PNGs beside the FBX. We therefore load them manually with
// THREE.TextureLoader and build a fresh matte MeshStandardMaterial per skinned
// mesh carrying them: Base_color as .map (sRGB), Normal_DirectX as .normalMap,
// Roughness as .roughnessMap (linear), Mixed_AO as .aoMap (linear). The aoMap
// needs a uv2 channel; the FBX meshes only carry uv0, so we copy geometry.uv
// into uv2. Lights stay near-neutral (WS2) and tone mapping stays ACESFilmic so
// nothing blows out.
//
// ORIENTATION / FRAMING: probed FBX bounds are X[-2.06,2.15] Y[-0.27,9.47]
// Z[-3.63,3.04], so Y is up and the chicken stands UPRIGHT (Y is the tallest
// axis at ~9.75, depth Z ~6.68 > width X ~4.21). We scale off the TALLEST bound
// (very different from the wide/low dog), yaw the body to face front/three-
// quarter toward the fixed camera (which looks down -Z), then recenter with a
// fresh Box3 AFTER the yaw so the whole body + head read centered.
//
// The Tamagotchi contract is preserved verbatim: mood drives an always-on
// liveliness (mixer timeScale + a subtle whole-group ambience), a transient
// `action` (re-armed via `actionNonce`) fires a ~1s one-shot reaction, and
// interactions still route ONLY through lib/pet state via VirtualPet.doAction.
// There is NO parallel state machine here. When reducedMotion is true the mixer
// is frozen at frame 0 and all ambient/camera motion is gated, exactly as
// before.
//
// Every asset URL is routed through lib/asset.ts so it resolves under the
// /frankfabric/ base path in production. This component touches WebGL/DOM, so
// it is imported via next/dynamic { ssr:false } by VirtualPet and never runs
// during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor } from "@react-three/drei";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "@/lib/asset";
import type { PetAction } from "@/lib/pet/petState";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";

// The rigged chicken FBX and its four SEPARATE textures. Every path is
// base-path-prefixed via asset() so it resolves to /frankfabric/models/... in
// production. Never hardcode a bare "/models/..." path — it would 404 on
// GitHub Pages.
const MODEL_URL = asset("/models/characters/chicken/chicken.fbx");
const TEX_BASE_COLOR = asset(
  "/models/characters/chicken/DefaultMaterial_Base_color.png"
);
const TEX_NORMAL = asset(
  "/models/characters/chicken/DefaultMaterial_Normal_DirectX.png"
);
const TEX_ROUGHNESS = asset(
  "/models/characters/chicken/DefaultMaterial_Roughness.png"
);
const TEX_AO = asset("/models/characters/chicken/DefaultMaterial_Mixed_AO.png");

// The chicken is UPRIGHT (Y is its tallest axis), so we scale off the TALLEST
// bound to a consistent on-screen size that frames the whole bird head-to-foot.
const MODEL_TARGET_SIZE = 1.9;

// World-space height the camera aims at (roughly the chicken's mid-body so the
// whole standing bird — feet through head/comb — reads centered). The model is
// recentered so this point sits at frame center.
const AIM_HEIGHT = 0.95;
// How far back the fixed camera sits from the aim point. An upright bird needs
// a touch more distance than the low dog so its full height fits the frame.
const CAMERA_DISTANCE = 3.15;

// ORIENTATION FIX: the fixed camera looks down -Z (from +Z toward the origin).
// The FBX's raw front axis does not face +Z by default, so we yaw the INNER
// recenter root about Y to turn the chicken toward the camera in a friendly
// three-quarter view, then recompute the recenter Box3 AFTER the yaw so the
// rotated model stays centered on the aim point. The value was chosen so the
// bird's chest/head face the camera (verified empirically with an after-pet
// screenshot); the small extra offset gives a lively three-quarter angle rather
// than a flat dead-on pose.
const BODY_YAW = THREE.MathUtils.degToRad(35);

type SceneProps = {
  // Current discrete mood (from moodFor): 'happy'|'content'|'hungry'|'tired'|
  // 'dirty'|'sad'. Drives the always-on ambient motion + idle playback speed.
  mood: string;
  // Transient one-shot trigger set for ~1s when the visitor takes an action.
  action?: PetAction | null;
  // Monotonic counter bumped on every action click. The one-shot re-arms on
  // this value (not just `action`), so repeating the SAME action still fires.
  actionNonce?: number;
  // Overall wellbeing 0..100; gently scales liveliness.
  wellbeing: number;
  // Shared High/Fast render-quality tier (components/three/quality.ts). Gates
  // Canvas shadows, dpr, shadow-map resolution, soft shadows and the heavier
  // fill/bounce lights + ground backdrop. Defaults to High.
  quality?: Quality;
  // Called on pointer-down on the clickable chicken mesh. VirtualPet wires this
  // to its EXISTING doAction(action) (decayForElapsed + applyAction from
  // lib/pet/petState.ts, then persist), so the click raises a REAL PetAction
  // exactly like the on-screen action buttons. This scene NEVER mutates stats.
  onPetClick?: () => void;
  // When true (user prefers reduced motion), all AMBIENT/IDLE + one-shot
  // reaction motion is gated: the baked idle mixer is frozen at frame 0, the
  // camera nudge holds the pinned framing, the whole-group breathing/bob and
  // the feed/play/sleep/clean hop are frozen to rest, and the dust motes are
  // skipped. The click still raises a REAL PetAction through lib/pet state —
  // only the MOTION response is damped. Defaults to false so behaviour is
  // identical to today.
  reducedMotion?: boolean;
};

// Loads the rigged chicken FBX + its four textures, drives the baked idle via a
// THREE.AnimationMixer, and layers the whole-group mood/action reaction on top.
function Pet({
  mood,
  action,
  actionNonce,
  wellbeing,
  onPetClick,
  reducedMotion = false,
}: SceneProps) {
  const fbx = useLoader(FBXLoader, MODEL_URL);
  const baseColorTex = useLoader(THREE.TextureLoader, TEX_BASE_COLOR);
  const normalTex = useLoader(THREE.TextureLoader, TEX_NORMAL);
  const roughnessTex = useLoader(THREE.TextureLoader, TEX_ROUGHNESS);
  const aoTex = useLoader(THREE.TextureLoader, TEX_AO);

  // Hover affordance on the clickable chicken mesh (drei useCursor sets the CSS
  // cursor to pointer while hovered). The click raises a REAL action through
  // VirtualPet.doAction — the scene never mutates stats itself.
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // The group we animate. Its rest is identity (position 0 / rotation 0); every
  // frame writes ABSOLUTE offsets to it (see useFrame), so nothing accumulates.
  const groupRef = useRef<THREE.Group | null>(null);

  // The AnimationMixer + its idle action, resolved once the model is built.
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);

  // Smoothed 0..1 "energy" for the always-on liveliness (eased toward a mood
  // target) and a separate 0..1 envelope for the one-shot action reaction.
  const energyRef = useRef(0);
  const actionEnvRef = useRef(0);
  // Which action is currently being played out, and a small time accumulator
  // so the one-shot has its own phase independent of the global clock.
  const activeActionRef = useRef<SceneProps["action"]>(null);
  const actionTimeRef = useRef(0);

  // Clone the FBX with SkeletonUtils so each SkinnedMesh's skeleton is correctly
  // rebound to the cloned bones (a plain Object3D.clone collapses/hides the
  // skinned mesh — the "empty container" bug). We then wire the four textures
  // onto a fresh matte MeshStandardMaterial per mesh, scale off the tallest
  // bound, yaw to face the camera, and recenter with a fresh Box3.
  const model = useMemo(() => {
    const root = cloneSkeleton(fbx);

    // --- Prepare the four maps (cloned so we uniquely own + can dispose them).
    // Base color / albedo is the only sRGB map; roughness / normal / AO are
    // linear data maps.
    const map = baseColorTex.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;

    const normalMap = normalTex.clone();
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;
    normalMap.needsUpdate = true;

    const roughnessMap = roughnessTex.clone();
    roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
    roughnessMap.needsUpdate = true;

    const aoMap = aoTex.clone();
    aoMap.colorSpace = THREE.LinearSRGBColorSpace;
    aoMap.needsUpdate = true;

    root.traverse((node) => {
      node.frustumCulled = false;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // aoMap samples uv channel 1 (uv2). These FBX meshes carry only uv0, so
      // reuse it: copy geometry.attributes.uv into a uv2 attribute. Without a
      // uv2 the aoMap would be ignored by three; reusing uv0 gives correct AO
      // since the maps share the same UV layout.
      const geom = mesh.geometry as THREE.BufferGeometry;
      if (geom && geom.attributes.uv && !geom.attributes.uv2) {
        geom.setAttribute("uv2", geom.attributes.uv);
      }
      const hasUv2 = !!(geom && geom.attributes.uv2);

      // Swap to a matte MeshStandardMaterial carrying the four maps so the
      // chicken reads with true PBR color and no blow-out under the near-neutral
      // warm rig (WS2). color stays white so the material never tints the map.
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const replaced = materials.map((raw) => {
        const std = new THREE.MeshStandardMaterial({
          map,
          normalMap,
          roughnessMap,
          aoMap: hasUv2 ? aoMap : null,
          aoMapIntensity: hasUv2 ? 1 : 0,
          color: new THREE.Color(0xffffff),
          roughness: 1,
          metalness: 0,
        });
        std.needsUpdate = true;
        const src = raw as THREE.Material | undefined;
        if (src && "name" in src && src.name) std.name = src.name;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0];
    });

    // Scale to a consistent on-screen size off the model's TALLEST bound (the
    // chicken is upright, so its Y extent is what we frame head-to-foot).
    root.updateMatrixWorld(true);
    const preBox = new THREE.Box3().setFromObject(root);
    if (!preBox.isEmpty()) {
      const preSize = new THREE.Vector3();
      preBox.getSize(preSize);
      const tallest = Math.max(preSize.x, preSize.y, preSize.z);
      if (tallest > 0) root.scale.setScalar(MODEL_TARGET_SIZE / tallest);
    }

    // Turn the chicken to face the camera (camera looks down -Z). Applied to
    // this INNER recenter root ONLY — the animated groupRef stays at identity
    // rest so the useFrame ABSOLUTE-offset math and the CameraRig
    // PINNED_CAM/PINNED_LOOK additive math remain valid. We recompute the
    // recenter Box3 BELOW, AFTER this yaw, so the rotated model stays centered.
    root.rotation.y = BODY_YAW;

    // Recenter deterministically off a fresh Box3 of the SCALED + ROTATED model
    // so the fixed camera reliably frames the whole bird. Center it
    // horizontally/in depth and lift it so its vertical center sits at
    // AIM_HEIGHT (mid-body).
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
  }, [fbx, baseColorTex, normalTex, roughnessTex, aoTex]);

  // Build the AnimationMixer on the cloned model and start the baked idle clip
  // ("Take 001") looping. Done in an effect so we never touch refs during
  // render. If the FBX ships no clip we degrade gracefully (no idle, ambience
  // still runs).
  useEffect(() => {
    const clips = fbx.animations ?? [];
    if (!clips.length) {
      console.warn("[PetScene] chicken FBX has no baked clip; idle disabled.");
      return;
    }
    const mixer = new THREE.AnimationMixer(model);
    const clipAction = mixer.clipAction(clips[0]);
    clipAction.setLoop(THREE.LoopRepeat, Infinity);
    clipAction.play();
    mixerRef.current = mixer;
    idleActionRef.current = clipAction;
    return () => {
      clipAction.stop();
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      mixerRef.current = null;
      idleActionRef.current = null;
    };
  }, [fbx, model]);

  // On unmount, dispose ONLY the resources this component owns. SkeletonUtils
  // .clone reuses geometry by reference from the loader-cached fbx, so we do
  // NOT dispose geometry. The materials + their four maps WERE freshly created
  // above and are uniquely owned, so dispose them.
  useEffect(() => {
    return () => {
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        mats.forEach((raw) => {
          const mat = raw as THREE.MeshStandardMaterial | undefined;
          mat?.map?.dispose();
          mat?.normalMap?.dispose();
          mat?.roughnessMap?.dispose();
          mat?.aoMap?.dispose();
          mat?.dispose();
        });
      });
    };
  }, [model]);

  // Latch a new action into the one-shot envelope. Re-arming is keyed on
  // `actionNonce` (bumped by VirtualPet on every click) as well as `action`, so
  // clicking the SAME action twice inside the ~1s hold window still resets the
  // envelope + phase and re-fires the reaction cleanly.
  useEffect(() => {
    if (action) {
      activeActionRef.current = action;
      actionEnvRef.current = 1; // impulse; useFrame decays it over ~1s.
      actionTimeRef.current = 0;
    }
  }, [action, actionNonce]);

  // Drive the baked idle mixer + the whole-group mood/action reaction each
  // frame. The mixer plays the REAL skeletal idle; the group transform adds a
  // subtle whole-body ambience + one-shot reaction on top. Each frame writes
  // ABSOLUTE values to group.position / group.rotation (the group's rest is
  // identity), so nothing accumulates frame-to-frame.
  useFrame((state, delta) => {
    const group = groupRef.current;
    const mixer = mixerRef.current;
    const idle = idleActionRef.current;
    if (!group) return;

    // Reduced motion: freeze the baked idle at frame 0 and hold the pet at its
    // rest transform (identity). We pause the action and reset its time to 0 so
    // the skeleton holds a still pose, and zero every whole-group offset.
    if (reducedMotion) {
      if (idle) {
        idle.paused = true;
        idle.time = 0;
      }
      if (mixer) mixer.update(0); // flush the frame-0 pose to the skeleton.
      energyRef.current = 0;
      actionEnvRef.current = 0;
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      return;
    }

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

    // Advance the baked idle. Its playback speed (timeScale) tracks liveliness:
    // a happy/lively chicken idles a touch faster, a tired one slower, and a
    // feed/play/clean impulse briefly speeds it up so the reaction reads on the
    // skeleton too. ALL of this is driven by mood/action props (lib/pet state),
    // never a parallel state machine.
    if (idle) idle.paused = false;
    let timeScale = 0.7 + 0.6 * energy; // ~0.7..1.3 by mood/wellbeing.
    if (env > 0.001 && activeAction && activeAction !== "sleep") {
      timeScale += 0.9 * env; // livelier idle during feed/play/clean.
    } else if (env > 0.001 && activeAction === "sleep") {
      timeScale *= 1 - 0.6 * env; // settle: slow the idle right down.
    }
    if (idle) idle.setEffectiveTimeScale(timeScale);
    if (mixer) mixer.update(dt);

    // --- Always-on ambience (whole group) ----------------------------------
    // Gentle breathing bob so the pet is never perfectly static.
    const breathe = 0.008 * Math.sin(t * 1.5);
    // Livelier bob scaled by energy (a happy chicken bounces a bit more).
    const liveBob = energy * 0.03 * (0.5 + 0.5 * Math.sin(t * 3.4));
    // Small side-to-side sway (reads as a happy waddle).
    const wiggleX = energy * 0.02 * Math.sin(t * 2.6);
    const wiggleRotY = energy * 0.05 * Math.sin(t * 2.1);

    // Tired/sad/hungry/dirty moods droop: a slight downward offset and a small
    // forward lean, scaled by how LOW the energy is.
    const droop = 1 - energy; // ~0 when lively, ~0.9 when slumped.
    const droopY = -0.03 * droop;
    const droopLean = 0.06 * droop;

    // --- One-shot action reaction (whole group) ----------------------------
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

  // Pointer-down on the chicken raises the action through the callback (which
  // calls VirtualPet.doAction). stopPropagation so the whole mesh reads as one
  // target.
  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPetClick?.();
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={handleDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={model} />
    </group>
  );
}

// A subtle procedural ground plane so the chicken reads as standing ON
// something rather than floating over only the ContactShadows. A matte disc at
// y=0 with a soft radial vignette baked into a small in-memory canvas texture
// (no external asset, nothing added to the cold-load budget), fading out at the
// rim. Gated to High; on Fast the chicken keeps only its ContactShadows,
// exactly like today.
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
      // Warm rug/floor tone matching the cozy Tamagotchi vibe, fading to
      // transparent at the rim so the disc dissolves into the background.
      grad.addColorStop(0, "rgba(228,212,190,1)");
      grad.addColorStop(0.62, "rgba(214,196,170,1)");
      grad.addColorStop(1, "rgba(214,196,170,0)");
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
      <circleGeometry args={[3.6, 64]} />
      <meshStandardMaterial
        map={texture}
        transparent
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

// INTERACTION-RESPONSIVE CAMERA NUDGE. LAYERED on the pinned framing: the
// camera still starts at [0, AIM_HEIGHT + 0.35, CAMERA_DISTANCE] and always
// looks at [0, AIM_HEIGHT, 0] (those constants are untouched). Each frame we
// ease a small ADDITIVE offset toward a per-action rest pose with drei's maath
// `damp3`, then write camera.position = pinnedRest + offset and re-aim at a
// slightly nudged look target. The move is tiny (a few cm) so the locked shot
// holds and eases back to rest as the pulse decays.
//
// CRITICAL: the rig reacts ONLY to the transient `action` the state engine
// surfaced (VirtualPet's doAction output) — it never derives anything itself.
// `actionNonce` re-arms the pulse so repeating the SAME action still reads.
const PINNED_CAM = new THREE.Vector3(0, AIM_HEIGHT + 0.35, CAMERA_DISTANCE);
const PINNED_LOOK = new THREE.Vector3(0, AIM_HEIGHT, 0);

// Per-action additive camera offset (metres) + look-target offset (metres),
// applied ON TOP of the pinned rest. A playful push-in on feed/play; a gentle
// settle/pull-back on sleep; a small steady framing on clean.
function petActionPose(action: PetAction | null | undefined): {
  posOffset: THREE.Vector3;
  lookOffset: THREE.Vector3;
} {
  switch (action) {
    case "feed":
    case "play":
      // Quick playful push-in toward the chicken.
      return {
        posOffset: new THREE.Vector3(0, -0.03, -0.2),
        lookOffset: new THREE.Vector3(0, -0.03, 0),
      };
    case "sleep":
      // Gentle pull-back + settle down.
      return {
        posOffset: new THREE.Vector3(0, 0.06, 0.14),
        lookOffset: new THREE.Vector3(0, -0.04, 0),
      };
    case "clean":
      // Small steady framing hold.
      return {
        posOffset: new THREE.Vector3(0.05, 0.02, 0.02),
        lookOffset: new THREE.Vector3(0, 0, 0),
      };
    default:
      return {
        posOffset: new THREE.Vector3(0, 0, 0),
        lookOffset: new THREE.Vector3(0, 0, 0),
      };
  }
}

function CameraRig({
  action,
  actionNonce = 0,
  reducedMotion = false,
}: {
  action?: PetAction | null;
  actionNonce?: number;
  reducedMotion?: boolean;
}) {
  const posOffset = useRef(new THREE.Vector3());
  const lookOffset = useRef(new THREE.Vector3());
  // Short 0..1 pulse re-armed on every nonce so the same action reads again and
  // we always ease back to the pinned rest even while an action lingers.
  const pulse = useRef(0);
  useEffect(() => {
    pulse.current = 1;
  }, [actionNonce]);

  useFrame((state, delta) => {
    const { posOffset: targetPos, lookOffset: targetLook } = petActionPose(action);
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

// AMBIENT LIFE: a few soft "dust motes" drifting low over the rug so the stage
// isn't dead when idle. All procedural (no external asset). The heavier version
// (more, larger motes with more drift) is gated to High; on Fast we keep a tiny
// always-on shimmer so the scene still lives without regressing the Fast frame
// budget.
function DustMotes({ high }: { high: boolean }) {
  const count = high ? 20 : 7;

  const seeds = useMemo(() => {
    const arr: { x: number; z: number; base: number; phase: number; freq: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 0.35 + 0.55 * (((i * 7) % 5) / 5);
      arr.push({
        x: Math.cos(a) * r,
        z: -0.05 + Math.sin(a) * r * 0.7,
        base: 0.1 + 0.35 * (((i * 3) % 5) / 5),
        phase: (i * 1.27) % (Math.PI * 2),
        freq: 0.4 + ((i * 3) % 5) / 6,
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
      // Warm, soft mote matching the cozy Tamagotchi palette.
      grad.addColorStop(0, "rgba(255,238,205,0.6)");
      grad.addColorStop(1, "rgba(255,238,205,0)");
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
    // Heavier drift on High, a gentler float on Fast so the frame budget holds.
    const driftY = high ? 0.14 : 0.06;
    const driftX = high ? 0.05 : 0.02;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const y = s.base + driftY * (0.5 + 0.5 * Math.sin(t * s.freq + s.phase));
      const x = s.x + Math.sin(t * s.freq * 0.6 + s.phase) * driftX;
      pos.setXYZ(i, x, y, s.z);
    }
    pos.needsUpdate = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={sprite}
        size={high ? 0.09 : 0.06}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={high ? 0.4 : 0.28}
        color="#ffffff"
      />
    </points>
  );
}

// Mood + transient action + wellbeing drive the baked idle timeScale and the
// whole-group reaction in <Pet />.
export default function PetScene({
  mood,
  action,
  actionNonce,
  wellbeing,
  quality = DEFAULT_QUALITY,
  onPetClick,
  reducedMotion = false,
}: SceneProps) {
  const q = qualitySettings(quality);
  const isHigh = quality === "high";
  return (
    <Canvas
      shadows={q.shadows}
      dpr={q.dpr}
      camera={{ position: [0, AIM_HEIGHT + 0.35, CAMERA_DISTANCE], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the pet stage.
      role="img"
      aria-label="Animated 3D chicken that reacts to feeding, play, sleep and cleaning"
      onCreated={({ gl, camera }) => {
        // Tone mapping unchanged (ACESFilmic): the chicken's PBR maps read fine
        // under the near-neutral warm rig below, so per CONSTRAINT #2 we leave
        // it.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim at the upright chicken's mid-body so
        // the whole bird (feet through head/comb) reads centered. No
        // OrbitControls, no zoom.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* NOTE: drei <SoftShadows> is intentionally NOT used (see WardrobeScene);
          we keep ONE consistent soft approach across all four scenes — higher
          shadow-map res on High + tuned ContactShadows blur. */}

      {/* Warm, cozy lighting kept near-neutral so the chicken's PBR maps show
          their true colors — a proper key/fill/bounce rig (only the key casts
          shadows). */}
      <ambientLight intensity={0.8} color="#fff6ea" />
      {/* KEY: front-right; the only shadow caster. Shadow-map res scales with
          quality (High above today's 1024). */}
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.15}
        color="#fff3e0"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0009}
      />
      {/* FILL: softer, from the opposite side. */}
      <directionalLight position={[-4, 3, -3]} intensity={0.45} color="#ffffff" />
      {/* Sky-to-ground bounce. */}
      <hemisphereLight args={["#fff2dd", "#efe2c9", 0.5]} />
      {/* RIM / back-bounce (High only): subtle separation from the backdrop. */}
      {isHigh ? (
        <pointLight
          position={[-1.8, 2.4, -2.4]}
          intensity={0.5}
          color="#fff2dd"
          distance={9}
          decay={1.6}
        />
      ) : null}

      {/* Interaction-responsive camera nudge, layered on the pinned framing.
          Reacts ONLY to the transient action the state engine surfaced; eases
          back to the locked shot. */}
      <CameraRig
        action={action}
        actionNonce={actionNonce}
        reducedMotion={reducedMotion}
      />

      <Suspense fallback={<SceneLoader />}>
        <group position={[0, 0, 0]}>
          <Pet
            mood={mood}
            action={action}
            actionNonce={actionNonce}
            wellbeing={wellbeing}
            onPetClick={onPetClick}
            reducedMotion={reducedMotion}
          />
        </group>
        {/* Ambient life: cheap warm dust motes, always on (tiny on Fast, heavier
            only on High so the Fast frame budget never regresses). Skipped
            entirely under reduced motion so nothing drifts. */}
        {reducedMotion ? null : <DustMotes high={isHigh} />}
        {/* Ground backdrop for depth — High only. */}
        {isHigh ? <GroundBackdrop /> : null}
      </Suspense>

      {/* Kept ContactShadows so the chicken never floats; softened blur on
          High. */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.32}
        scale={4}
        blur={isHigh ? 3.0 : 2.6}
        far={2}
        color="#3a2c1a"
      />
    </Canvas>
  );
}
