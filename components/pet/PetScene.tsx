"use client";

// ---------------------------------------------------------------------------
// Virtual pet — interactive 3D Miniature Schnauzer (rigged GLB + AnimationMixer).
//
// MODEL: public/models/characters/schnauzer/miniature_schnauzer.glb — a fully
// rigged, skinned Miniature Schnauzer (54-joint canine skeleton, 11 facial morph
// targets, fur cards, PBR textures) exported from Blender with 23 SEPARATE,
// independently callable animation clips (Idle_Relaxed, Idle_Sit, Idle_Lie,
// Sleep, Walk, Trot, Run, Sit_Down, Stand_Up, Lie_Down, Get_Up, Look_Around,
// Curious, Head_Tilt, Happy, Tail_Wag, Sniff, Bark, Bark_02, Bark_03,
// Give_Paw, Play_Bow, Jump). The web build is meshopt-compressed (gltfpack), so
// the GLTFLoader gets three's MeshoptDecoder.
//
// BEHAVIOUR: a tiny posture state machine (stand / sit / lie / sleep) chooses
// the looping idle clip; posture changes play the matching transition clip
// (Sit_Down, Stand_Up, Lie_Down, Get_Up) and everything cross-fades. The
// Tamagotchi contract is unchanged: mood -> posture + facial nuance, a
// transient `action` (re-armed via `actionNonce`) plays a one-shot reaction,
// and the scene never mutates stats (clicks still route through
// VirtualPet.doAction). When idle and standing the dog occasionally looks
// around / tilts its head / sniffs, its head follows the pointer, and a
// mood-scaled ADDITIVE tail wag is layered on top of whatever is playing.
//
// Reduced motion: the mixer is frozen on the first frame of the posture idle,
// no ambient behaviours, no pointer-follow and no camera nudge.
//
// Every asset URL goes through lib/asset.ts so it resolves under /frankfabric/
// in production. Imported via next/dynamic { ssr:false } by VirtualPet.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, useCursor } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "@/lib/asset";
import type { PetAction } from "@/lib/pet/petState";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";

const MODEL_URL = asset("/models/characters/schnauzer/miniature_schnauzer.glb");
const BARK_SOUND = asset("/sounds/dog-bark.wav");

// The GLB is authored in real-world metres (~34 cm at the withers, 46 cm to the
// top of the head). Scale it up to a comfortable on-stage size.
const MODEL_SCALE = 2.75;
// Three-quarter view: the model faces +Z (toward the camera); yaw it a little.
const BODY_YAW = THREE.MathUtils.degToRad(-32);
const AIM_HEIGHT = 0.58;
const CAMERA_DISTANCE = 4.6;
// The body is long (nose to tail); nudge it so the whole dog sits centred in the
// three-quarter view.
const MODEL_OFFSET_X = 0.12;
const FADE = 0.35;

type Posture = "stand" | "sit" | "lie" | "sleep";
const POSTURE_IDLE: Record<Posture, string> = {
  stand: "Idle_Relaxed",
  sit: "Idle_Sit",
  lie: "Idle_Lie",
  sleep: "Sleep",
};
// Transition clips between postures ("via" = go through another posture first).
const TRANSITION: Record<string, { clip?: string; via?: Posture }> = {
  "stand>sit": { clip: "Sit_Down" },
  "sit>stand": { clip: "Stand_Up" },
  "stand>lie": { clip: "Lie_Down" },
  "lie>stand": { clip: "Get_Up" },
  "stand>sleep": { clip: "Lie_Down" },
  "sleep>stand": { clip: "Get_Up" },
  "lie>sleep": {},
  "sleep>lie": {},
  "sit>lie": { via: "stand" },
  "sit>sleep": { via: "stand" },
  "lie>sit": { via: "stand" },
  "sleep>sit": { via: "stand" },
};
const AMBIENT = ["Look_Around", "Head_Tilt", "Curious", "Sniff", "Look_Around", "Head_Tilt", "Bark"];
const PLAY_REACTIONS = ["Play_Bow", "Give_Paw", "Jump", "Happy", "Bark_02", "Head_Tilt"];

// Mood -> resting posture + a small additive facial expression (morph targets).
function moodPosture(mood: string): Posture {
  switch (mood) {
    case "tired":
      return "lie";
    case "hungry":
    case "dirty":
    case "sad":
      return "sit";
    default:
      return "stand";
  }
}
const MOOD_FACE: Record<string, Record<string, number>> = {
  happy: { Smile: 0.35, Brow_Raise: 0.2 },
  content: { Smile: 0.12 },
  hungry: { Brow_Worried: 0.45 },
  tired: { Eyes_Squint: 0.45, Brow_Lower: 0.2 },
  dirty: { Brow_Worried: 0.3, Mouth_Close: 0.3 },
  sad: { Brow_Worried: 0.75, Mouth_Close: 0.4 },
};
const WAG_BY_MOOD: Record<string, number> = { happy: 1, content: 0.45, hungry: 0.15, dirty: 0.1, sad: 0, tired: 0 };

// Adds a mood expression on top of whatever the clips set this frame (the
// mixer rewrites every morph weight each frame, so nothing accumulates).
function applyMoodFace(meshes: THREE.Mesh[], face: Record<string, number> | undefined) {
  if (!face) return;
  for (const mesh of meshes) {
    const dict = mesh.morphTargetDictionary;
    const inf = mesh.morphTargetInfluences;
    if (!dict || !inf) continue;
    for (const [k, v] of Object.entries(face)) {
      const i = dict[k];
      if (i !== undefined) inf[i] = Math.min(1, inf[i] + v);
    }
  }
}

type SceneProps = {
  mood: string;
  action?: PetAction | null;
  actionNonce?: number;
  wellbeing: number;
  quality?: Quality;
  onPetClick?: () => void;
  reducedMotion?: boolean;
};

function Schnauzer({ mood, action, actionNonce, wellbeing, onPetClick, reducedMotion = false }: SceneProps) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  }) as GLTF;
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // --- clone the skinned scene (SkeletonUtils rebinds skeletons) ------------
  const model = useMemo(() => {
    const root = cloneSkeleton(gltf.scene) as THREE.Object3D;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // skinned bounds move with the animation
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        // Fur cards are alpha-tested; alpha-to-coverage (with MSAA) gives soft,
        // non-aliased strand edges.
        if (std.alphaTest > 0) {
          std.alphaToCoverage = true;
          std.alphaTest = 0.3;
        }
      });
    });
    root.scale.setScalar(MODEL_SCALE);
    root.rotation.y = BODY_YAW;
    root.position.x = MODEL_OFFSET_X;
    return root;
  }, [gltf]);

  // Scene-graph handles used every frame (filled in the mixer effect; kept in
  // refs so the per-frame mutation happens on ref-held objects).
  const morphMeshesRef = useRef<THREE.Mesh[]>([]);
  const headBoneRef = useRef<THREE.Object3D | null>(null);
  const eyeBonesRef = useRef<THREE.Object3D[]>([]);

  // --- animation system -----------------------------------------------------
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const wagRef = useRef<THREE.AnimationAction | null>(null);
  const currentRef = useRef<THREE.AnimationAction | null>(null);
  const postureRef = useRef<Posture>("stand");
  const busyRef = useRef(false); // a one-shot / transition is playing
  const queueRef = useRef<{ clip?: string; posture?: Posture; hold?: number }[]>([]);
  const holdUntilRef = useRef(0); // keep a forced posture (sleep) until this time
  const nextAmbientRef = useRef(0);
  const clockRef = useRef(0);
  const moodRef = useRef(mood);
  const lookRef = useRef(new THREE.Vector2());
  const lookWeightRef = useRef(0);
  const barkAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingBarkRef = useRef<number | null>(null);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    const morphs: THREE.Mesh[] = [];
    model.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) morphs.push(m);
    });
    morphMeshesRef.current = morphs;
    headBoneRef.current = model.getObjectByName("head") ?? null;
    eyeBonesRef.current = ["eye_L", "eye_R"].map((n) => model.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    const acts: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) {
      acts[clip.name] = mixer.clipAction(clip);
    }
    actionsRef.current = acts;
    // Additive tail wag: only the tail tracks of Tail_Wag, blended on top.
    const wagSrc = gltf.animations.find((c) => c.name === "Tail_Wag");
    if (wagSrc) {
      const tailOnly = new THREE.AnimationClip(
        "Tail_Wag_Additive",
        wagSrc.duration,
        wagSrc.tracks.filter((t) => t.name.startsWith("tail_")).map((t) => t.clone())
      );
      THREE.AnimationUtils.makeClipAdditive(tailOnly);
      const wag = mixer.clipAction(tailOnly);
      wag.blendMode = THREE.AdditiveAnimationBlendMode;
      wag.setLoop(THREE.LoopRepeat, Infinity);
      wag.setEffectiveWeight(0);
      wag.play();
      wagRef.current = wag;
    }
    // start in the mood's posture without a transition
    const p = moodPosture(moodRef.current);
    postureRef.current = p;
    const idle = acts[POSTURE_IDLE[p]];
    if (idle) {
      idle.reset().play();
      currentRef.current = idle;
    }
    nextAmbientRef.current = 6 + Math.random() * 4;
    const onFinished = () => {
      busyRef.current = false;
    };
    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      mixerRef.current = null;
    };
  }, [gltf, model]);

  // crossfade helper
  const fadeTo = (name: string, loop: boolean) => {
    const next = actionsRef.current[name];
    if (!next) return false;
    const prev = currentRef.current;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) next.crossFadeFrom(prev, FADE, false);
    currentRef.current = next;
    if (name.startsWith("Bark")) pendingBarkRef.current = clockRef.current + (name === "Bark" ? 0.3 : 0.25);
    return true;
  };

  // plan the steps needed to reach a posture
  const planPosture = (from: Posture, to: Posture): { clip?: string; posture?: Posture }[] => {
    if (from === to) return [];
    const t = TRANSITION[`${from}>${to}`];
    if (!t) return [{ posture: to }];
    if (t.via) return [...planPosture(from, t.via), ...planPosture(t.via, to)];
    return [{ clip: t.clip, posture: to }];
  };

  const enqueueReaction = (clips: string[], posture: Posture = "stand", hold = 0) => {
    const steps = planPosture(postureRef.current, posture);
    queueRef.current = [...steps, ...clips.map((c) => ({ clip: c })), ...(hold ? [{ hold }] : [])];
    busyRef.current = false;
  };

  // one-shot reactions to Tamagotchi actions (re-armed by the nonce)
  useEffect(() => {
    if (!action || reducedMotion) return;
    switch (action) {
      case "feed":
        enqueueReaction(["Sniff", "Happy"]);
        break;
      case "play":
        enqueueReaction([PLAY_REACTIONS[Math.floor(Math.random() * PLAY_REACTIONS.length)]]);
        break;
      case "clean":
        enqueueReaction(["Happy"]);
        break;
      case "sleep": {
        const steps = planPosture(postureRef.current, "sleep");
        queueRef.current = steps.length ? steps : [{ posture: "sleep" }];
        holdUntilRef.current = clockRef.current + 10;
        busyRef.current = false;
        break;
      }
    }
    nextAmbientRef.current = clockRef.current + 8 + Math.random() * 6;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actionNonce, reducedMotion]);

  useFrame((state, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const dt = Math.min(delta, 0.05);

    if (reducedMotion) {
      // freeze on the first frame of the current posture idle
      const idle = actionsRef.current[POSTURE_IDLE[postureRef.current]];
      if (idle && currentRef.current !== idle) {
        mixer.stopAllAction();
        idle.reset().play();
        currentRef.current = idle;
      }
      if (idle) {
        idle.paused = true;
        idle.time = 0;
      }
      if (wagRef.current) wagRef.current.setEffectiveWeight(0);
      mixer.update(0);
      return;
    }
    clockRef.current += dt;
    const now = clockRef.current;
    const m = moodRef.current;

    // --- scheduler: advance the queue whenever nothing one-shot is playing
    if (!busyRef.current) {
      const step = queueRef.current.shift();
      if (step) {
        if (step.clip) {
          fadeTo(step.clip, false);
          busyRef.current = true;
          if (step.posture) postureRef.current = step.posture;
        } else if (step.posture) {
          postureRef.current = step.posture;
          fadeTo(POSTURE_IDLE[step.posture], true);
        }
      } else {
        // settle into the right posture for the mood (sleep is held for a while)
        const want: Posture = now < holdUntilRef.current ? postureRef.current : moodPosture(m);
        if (want !== postureRef.current) {
          queueRef.current = planPosture(postureRef.current, want);
        } else {
          const idleName = POSTURE_IDLE[postureRef.current];
          if (currentRef.current !== actionsRef.current[idleName]) fadeTo(idleName, true);
          // ambient behaviours while standing idle
          if (postureRef.current === "stand" && now > nextAmbientRef.current) {
            const pool = m === "happy" ? [...AMBIENT, "Happy", "Play_Bow"] : AMBIENT;
            queueRef.current = [{ clip: pool[Math.floor(Math.random() * pool.length)] }];
            nextAmbientRef.current = now + 9 + Math.random() * 8;
          }
        }
      }
    }

    // --- livelier / sleepier playback speed from wellbeing
    const wb = Math.max(0, Math.min(1, wellbeing / 100));
    const cur = currentRef.current;
    if (cur && cur.loop === THREE.LoopRepeat) cur.setEffectiveTimeScale(0.85 + 0.3 * wb);

    // --- additive tail wag scaled by mood (not while lying/sleeping)
    const wag = wagRef.current;
    if (wag) {
      const target = postureRef.current === "stand" || postureRef.current === "sit" ? WAG_BY_MOOD[m] ?? 0.3 : 0;
      const w = THREE.MathUtils.damp(wag.getEffectiveWeight(), target, 3, dt);
      wag.setEffectiveWeight(w);
      wag.setEffectiveTimeScale(0.8 + 0.6 * (WAG_BY_MOOD[m] ?? 0.3));
    }

    mixer.update(dt);

    // --- mood expression on top of the animated morph weights
    applyMoodFace(morphMeshesRef.current, MOOD_FACE[m]);

    // --- head (and eyes) gently follow the pointer while idling
    const idleNow = !busyRef.current && queueRef.current.length === 0 && postureRef.current !== "sleep";
    lookWeightRef.current = THREE.MathUtils.damp(lookWeightRef.current, idleNow ? 1 : 0, 2.5, dt);
    lookRef.current.x = THREE.MathUtils.damp(lookRef.current.x, state.pointer.x, 4, dt);
    lookRef.current.y = THREE.MathUtils.damp(lookRef.current.y, state.pointer.y, 4, dt);
    const lw = lookWeightRef.current;
    const headBone = headBoneRef.current;
    if (headBone && headBone.parent && lw > 0.01) {
      const yaw = THREE.MathUtils.clamp(lookRef.current.x, -1, 1) * 0.42 * lw;
      const pitch = THREE.MathUtils.clamp(lookRef.current.y, -1, 1) * -0.2 * lw;
      const pq = new THREE.Quaternion();
      headBone.parent.getWorldQuaternion(pq);
      const world = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw + 0.25 * lw, 0, "YXZ"));
      // express the world-space rotation in the head's parent space
      const modelQ = new THREE.Quaternion();
      model.getWorldQuaternion(modelQ);
      const wq = modelQ.clone().multiply(world).multiply(modelQ.clone().invert());
      const local = pq.clone().invert().multiply(wq).multiply(pq);
      headBone.quaternion.premultiply(local);
      for (const eye of eyeBonesRef.current) {
        const epq = new THREE.Quaternion();
        eye.parent?.getWorldQuaternion(epq);
        const el = epq.clone().invert().multiply(wq).multiply(epq);
        eye.quaternion.premultiply(new THREE.Quaternion().slerp(el, 0.5));
      }
    }

    // --- bark sound synced to the jaw
    if (pendingBarkRef.current !== null && now >= pendingBarkRef.current) {
      pendingBarkRef.current = null;
      try {
        if (!barkAudioRef.current) {
          barkAudioRef.current = new Audio(BARK_SOUND);
          barkAudioRef.current.volume = 0.55;
        }
        barkAudioRef.current.currentTime = 0;
        const p = barkAudioRef.current.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        /* audio is optional */
      }
    }
  });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPetClick?.();
  };

  return (
    <group
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

function GroundBackdrop() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size / 2);
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
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
      <circleGeometry args={[3.6, 64]} />
      <meshStandardMaterial map={texture} transparent roughness={0.95} metalness={0} />
    </mesh>
  );
}

// Interaction-responsive camera nudge layered on the pinned framing.
const PINNED_CAM = new THREE.Vector3(0, AIM_HEIGHT + 0.4, CAMERA_DISTANCE);
const PINNED_LOOK = new THREE.Vector3(0, AIM_HEIGHT, 0);
function petActionPose(action: PetAction | null | undefined) {
  switch (action) {
    case "feed":
    case "play":
      return { pos: new THREE.Vector3(0, -0.04, -0.25), look: new THREE.Vector3(0, -0.05, 0) };
    case "sleep":
      return { pos: new THREE.Vector3(0, 0.05, 0.12), look: new THREE.Vector3(0, -0.12, 0) };
    case "clean":
      return { pos: new THREE.Vector3(0.05, 0.02, 0.02), look: new THREE.Vector3(0, 0, 0) };
    default:
      return { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  }
}
function CameraRig({ action, actionNonce = 0, reducedMotion = false }: { action?: PetAction | null; actionNonce?: number; reducedMotion?: boolean }) {
  const posOffset = useRef(new THREE.Vector3());
  const lookOffset = useRef(new THREE.Vector3());
  const pulse = useRef(0);
  useEffect(() => {
    pulse.current = 1;
  }, [actionNonce]);
  useFrame((state, delta) => {
    const { pos, look } = petActionPose(action);
    pulse.current = reducedMotion ? 0 : Math.max(0, pulse.current - delta / 1.4);
    const s = pulse.current;
    damp3(posOffset.current, [pos.x * s, pos.y * s, pos.z * s], 0.5, delta);
    damp3(lookOffset.current, [look.x * s, look.y * s, look.z * s], 0.5, delta);
    state.camera.position.copy(PINNED_CAM).add(posOffset.current);
    state.camera.lookAt(PINNED_LOOK.x + lookOffset.current.x, PINNED_LOOK.y + lookOffset.current.y, PINNED_LOOK.z + lookOffset.current.z);
  });
  return null;
}

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
      camera={{ position: [0, AIM_HEIGHT + 0.4, CAMERA_DISTANCE], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label="Animated 3D Miniature Schnauzer that reacts to feeding, play, sleep and cleaning"
      onCreated={({ gl, camera, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // White fur under ACES reads grey at exposure 1; lift it slightly.
        gl.toneMappingExposure = 1.22;
        // Soft, procedural (no network) image-based lighting so the wet eyes,
        // nose and coat pick up gentle reflections.
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.45;
        pmrem.dispose();
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      <ambientLight intensity={0.75} color="#fff6ea" />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.25}
        color="#fff3e0"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0006}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#ffffff" />
      <hemisphereLight args={["#fff2dd", "#efe2c9", 0.55]} />
      {isHigh ? <pointLight position={[-1.8, 2.4, -2.4]} intensity={0.6} color="#fff2dd" distance={9} decay={1.6} /> : null}

      <CameraRig action={action} actionNonce={actionNonce} reducedMotion={reducedMotion} />

      <Suspense fallback={<SceneLoader />}>
        <Schnauzer
          mood={mood}
          action={action}
          actionNonce={actionNonce}
          wellbeing={wellbeing}
          onPetClick={onPetClick}
          reducedMotion={reducedMotion}
        />
        {isHigh ? <GroundBackdrop /> : null}
      </Suspense>

      <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={5} blur={isHigh ? 3.0 : 2.6} far={2} color="#3a2c1a" />
    </Canvas>
  );
}
