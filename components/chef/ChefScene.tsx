"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor } from "@react-three/drei";
import { damp, damp3 } from "maath/easing";
import * as THREE from "three";
import ChefAvatar from "./ChefAvatar";
import StudioEnvironment from "@/components/three/StudioEnvironment";
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
  // Estimated articulation envelope from browser speech word boundaries.
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

const AIM_HEIGHT = 1.3;
const CAMERA_DISTANCE = 2.7;

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

// `speaking` + `getLoudness` drive the bone-based mouth motion in <ChefAvatar />.
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

      <StudioEnvironment kind="chef" />
      <Suspense fallback={<SceneLoader />}>
        <group position={[0, 0, 0]}>
          <ChefAvatar
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
