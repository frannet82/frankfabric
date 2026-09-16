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

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useLoader, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor } from "@react-three/drei";
import { damp, damp3 } from "maath/easing";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
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
  // the camera nudge holds the pinned framing, the whole-group talking/idle
  // bob + sway + lean + breathing baseline are frozen to rest, the floor
  // shimmer is skipped, and the kettlebell prop's idle bob is frozen.
  // Interactions still route through the engine — only the MOTION response is
  // damped. Defaults to false so behaviour is identical to today.
  reducedMotion?: boolean;
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
  reducedMotion = false,
}: {
  speaking?: boolean;
  getLoudness?: () => number;
  reducedMotion?: boolean;
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

  // The OUTER group rests at Y=0 and carries ONLY the animated bob/sway/lean
  // deltas; the inner model already carries the full recenter offset (its own
  // position.y). Seeding the group at 0 keeps the exact same on-screen rest
  // position while ensuring the recenter offset is never double-counted (net
  // world Y = model.y + bob, not model.y + bob + model.y). This stays correct
  // even if AIM_HEIGHT / AIM_MODEL_FRACTION change.
  useEffect(() => {
    restY.current = 0;
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

    // Reduced motion: hold the coach at its rest transform. The outer group's
    // rest is identity (restY == 0, no sway/lean), so zeroing the animated
    // offsets = the exact rest pose — no pinned/recenter constant is touched
    // (the inner model keeps its own recenter offset). Freeze the breathing bob
    // too so nothing moves.
    if (reducedMotion) {
      energyRef.current = 0;
      group.position.y = restY.current;
      group.position.x = 0;
      group.rotation.y = 0;
      group.rotation.x = 0;
      return;
    }

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

// `speaking` + `getLoudness` drive the whole-group talking motion in <Avatar />.
// The OBJ is unrigged, so there is no body-animation prop.
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
      aria-label="Animated 3D gym coach that bobs and gestures while giving workout advice"
      onCreated={({ gl, camera }) => {
        // Tone mapping unchanged (ACESFilmic): the coach OBJ renders skin fine
        // under the near-neutral rig below, so per CONSTRAINT #2 we leave it.
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
