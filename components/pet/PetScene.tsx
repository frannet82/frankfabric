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
// reactions are whole-group transforms in useFrame, similar to
// components/coach/CoachScene.tsx. The animated group's rest is identity, so
// each frame writes ABSOLUTE bob / sway / lean offsets to group.position /
// group.rotation (nothing accumulates); the recenter offset lives on the inner
// <primitive>, not the animated group. Offsets are scaled by a
// framerate-independent smoothed energy (1 - Math.exp(-delta*k)). Mood drives
// the always-on ambience; a transient `action` (re-armed via `actionNonce` so
// repeats still fire) triggers a ~1s one-shot reaction.
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

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor, useGLTF } from "@react-three/drei";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import { asset } from "@/lib/asset";
import type { PetAction } from "@/lib/pet/petState";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";

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
  // Called on pointer-down on the clickable dog mesh. VirtualPet wires this to
  // its EXISTING doAction(action) (decayForElapsed + applyAction from
  // lib/pet/petState.ts, then persist), so the click raises a REAL PetAction
  // exactly like the on-screen action buttons. This scene NEVER mutates stats.
  onPetClick?: () => void;
};

// Loads the schnauzer and drives the whole-group mood/action motion. The model
// is unrigged, so ALL motion is applied to the group transform in useFrame —
// never to bones.
function Pet({ mood, action, actionNonce, wellbeing, onPetClick }: SceneProps) {
  const { scene } = useGLTF(MODEL_URL);

  // Hover affordance on the clickable dog mesh (drei useCursor sets the CSS
  // cursor to pointer while hovered). The click raises a REAL action through
  // VirtualPet.doAction — the scene never mutates stats itself.
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // The group we animate. Its rest is identity (position 0 / rotation 0); every
  // frame writes ABSOLUTE offsets to it (see useFrame), so nothing accumulates.
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

  // Drive the whole-group mood/action motion each frame. Unrigged model, so NO
  // bone lookups — we transform the group itself. Each frame writes ABSOLUTE
  // values to group.position / group.rotation (the group's rest is identity),
  // so nothing accumulates frame-to-frame; the inner <primitive> alone carries
  // the recenter offset.
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

  // Pointer-down on the dog raises the action through the callback (which calls
  // VirtualPet.doAction). stopPropagation so the whole mesh reads as one target.
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

// A subtle procedural ground plane so the dog reads as sitting ON something
// rather than floating over only the ContactShadows. A matte disc at y=0 with a
// soft radial vignette baked into a small in-memory canvas texture (no external
// asset, nothing added to the cold-load budget), fading out at the rim. Gated
// to High; on Fast the dog keeps only its ContactShadows, exactly like today.
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
      // Quick playful push-in toward the pup.
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
}: {
  action?: PetAction | null;
  actionNonce?: number;
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
    pulse.current = Math.max(0, pulse.current - delta / 1.2);
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

// Mood + transient action + wellbeing drive the whole-group motion in <Pet />.
// The mesh is unrigged, so there is no bone-animation prop.
export default function PetScene({
  mood,
  action,
  actionNonce,
  wellbeing,
  quality = DEFAULT_QUALITY,
  onPetClick,
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
      aria-label="3D virtual pet dog"
      onCreated={({ gl, camera }) => {
        // Tone mapping unchanged (ACESFilmic): the scan renders fine under the
        // near-neutral warm rig below, so per CONSTRAINT #2 we leave it.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim slightly down at the dog's mid-body
        // so it reads centered on all fours. No OrbitControls, no zoom.
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      {/* NOTE: drei <SoftShadows> is intentionally NOT used (see WardrobeScene);
          we keep ONE consistent soft approach across all four scenes — higher
          shadow-map res on High + tuned ContactShadows blur. */}

      {/* Warm, cozy lighting kept near-neutral so the scan's texture shows its
          true colors — now a proper key/fill/bounce rig (only the key casts
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
      <CameraRig action={action} actionNonce={actionNonce} />

      <Suspense fallback={<SceneLoader />}>
        <group position={[0, 0, 0]}>
          <Pet
            mood={mood}
            action={action}
            actionNonce={actionNonce}
            wellbeing={wellbeing}
            onPetClick={onPetClick}
          />
        </group>
        {/* Ambient life: cheap warm dust motes, always on (tiny on Fast, heavier
            only on High so the Fast frame budget never regresses). */}
        <DustMotes high={isHigh} />
        {/* Ground backdrop for depth — High only. */}
        {isHigh ? <GroundBackdrop /> : null}
      </Suspense>

      {/* Kept ContactShadows so the dog never floats; softened blur on High. */}
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
