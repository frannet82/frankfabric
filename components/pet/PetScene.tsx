"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { damp3 } from "maath/easing";
import * as THREE from "three";
import type { PetAction } from "@/lib/pet/petState";
import WhiteSchnauzer from "./WhiteSchnauzer";
import StudioEnvironment from "@/components/three/StudioEnvironment";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";

const AIM_HEIGHT = 0.6;
const CAMERA_DISTANCE = 3.4;

type SceneProps = {
  mood: string;
  action?: PetAction | null;
  actionNonce?: number;
  wellbeing: number;
  quality?: Quality;
  onPetClick?: () => void;
  reducedMotion?: boolean;
};

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
        gl.toneMappingExposure = 1.0;
        // Soft, procedural (no network) image-based lighting so the wet eyes,
        // nose and coat pick up gentle reflections.
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.3;
        pmrem.dispose();
        camera.lookAt(0, AIM_HEIGHT, 0);
      }}
    >
      <ambientLight intensity={0.4} color="#ffffff" />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.1}
        color="#ffffff"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0006}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.3} color="#ffffff" />
      <hemisphereLight args={["#fff2dd", "#efe2c9", 0.35]} />
      {isHigh ? <pointLight position={[-1.8, 2.4, -2.4]} intensity={0.6} color="#fff2dd" distance={9} decay={1.6} /> : null}

      <CameraRig action={action} actionNonce={actionNonce} reducedMotion={reducedMotion} />

      <StudioEnvironment kind="pet" />
      <Suspense fallback={<SceneLoader />}>
        <WhiteSchnauzer
          high={isHigh}
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
