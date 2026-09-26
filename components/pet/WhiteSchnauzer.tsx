"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import type { PetAction } from '@/lib/pet/petState';
import { coatGeometry, foldedEarGeometry, furGeometry, type CoatShape, type Vec3 } from '@/lib/pet/schnauzerGeometry';

type Props = { mood: string; action?: PetAction | null; actionNonce?: number; wellbeing: number; onPetClick?: () => void; reducedMotion?: boolean; high?: boolean };
const Density = createContext(1);
function Coat({ at, size, shape = 'oval', hairs = 1800, length = 0.023, flow = [0, -1, 0], tint = '#f2f0e9', tilt = 0, seed = 31 }: { at: Vec3; size: Vec3; shape?: CoatShape; hairs?: number; length?: number; flow?: Vec3; tint?: string; tilt?: number; seed?: number }) {
  const density = useContext(Density);
  const [sx, sy, sz] = size, [fx, fy, fz] = flow;
  const surface = useMemo(() => coatGeometry([sx, sy, sz], shape), [sx, sy, sz, shape]);
  const fur = useMemo(() => furGeometry(surface, Math.round(hairs * density), length, [fx, fy, fz], seed, shape === 'skull'), [surface, hairs, density, length, fx, fy, fz, seed, shape]);
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => fur.dispose(), [fur]);
  return <group position={at} rotation={[0, 0, tilt]}>
    <mesh geometry={surface} castShadow receiveShadow><meshStandardMaterial color={tint} roughness={0.95} /></mesh>
    <mesh geometry={fur}><meshStandardMaterial color={tint} vertexColors roughness={0.97} side={THREE.DoubleSide} /></mesh>
  </group>;
}
function Ear({ side }: { side: number }) {
  const density = useContext(Density);
  const surface = useMemo(() => foldedEarGeometry(side), [side]);
  const fur = useMemo(() => furGeometry(surface, Math.round(1400 * density), 0.018, [side * 0.3, -1, 0], 101 + side), [surface, density, side]);
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => fur.dispose(), [fur]);
  return <group position={[side * 0.155, 0.20, -0.015]} rotation={[0.15, -side * 0.22, -side * 0.10]}>
    <mesh geometry={surface} castShadow><meshStandardMaterial color="#e8e5df" roughness={0.98} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={fur}><meshStandardMaterial color="#f5f2ec" vertexColors roughness={0.98} side={THREE.DoubleSide} /></mesh>
    <mesh position={[side * 0.04, 0.005, 0.018]} rotation={[0, 0, side * 0.3]} scale={[0.03, 0.035, 0.007]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#baa5a0" roughness={1} /></mesh>
  </group>;
}
function Eye({ x }: { x: number }) {
  return <group position={[x, 0.054, 0.161]} scale={[0.84, 0.82, 0.85]}>
    <mesh scale={[0.035, 0.032, 0.019]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#665951" roughness={0.95} /></mesh>
    <mesh position={[0, 0.001, 0.012]} scale={[0.027, 0.027, 0.019]}><sphereGeometry args={[1, 28, 20]} /><meshPhysicalMaterial color="#201a16" roughness={0.18} clearcoat={0.35} clearcoatRoughness={0.15} /></mesh>
    <mesh position={[0, 0.002, 0.029]} scale={[0.017, 0.020, 0.005]}><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color="#080807" roughness={0.18} /></mesh>
    <mesh position={[-0.009, 0.012, 0.034]}><sphereGeometry args={[0.004, 10, 8]} /><meshBasicMaterial color="#fffdf8" /></mesh>
  </group>;
}

/** Reference-led anatomy with a short clipped coat and long brushed furnishings.
 * Everything stays real 3D: groomed strand meshes follow the same animated groups.
 */
export default function WhiteSchnauzer({ mood, action, actionNonce, wellbeing, onPetClick, reducedMotion = false, high = true }: Props) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const paw = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const reaction = useRef(0);
  const elapsed = useRef(0);
  useCursor(hovered);
  useEffect(() => { reaction.current = action ? 1 : 0; elapsed.current = 0; }, [action, actionNonce]);
  useFrame(({ clock }, delta) => {
    if (!root.current || !head.current || !tail.current || !paw.current || !eyes.current || !body.current) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;
    const sleeping = action === 'sleep' || mood === 'tired';
    const active = reducedMotion ? 0 : reaction.current;
    if (action !== 'sleep') reaction.current = Math.max(0, reaction.current - dt / 3.5);
    const playful = action === 'play' ? active : 0;
    const eating = action === 'feed' ? active : 0;
    const washing = action === 'clean' ? active : 0;
    // Keep the nose facing +Z. Only small pitch/roll gestures; never turn away.
    head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, sleeping ? 0.17 : eating * 0.16 * (0.5 + 0.5 * Math.sin(elapsed.current * 6)), 5, dt);
    head.current.rotation.z = reducedMotion ? 0 : (sleeping ? 0.09 : Math.sin(t * 0.65) * 0.025 + washing * Math.sin(elapsed.current * 12) * 0.06);
    const blink = Math.max(0, 1 - Math.abs((t % 4.4) - 0.12) / 0.1);
    eyes.current.scale.y = sleeping ? 0.08 : reducedMotion ? 1 : 1 - blink * 0.93;
    body.current.scale.y = reducedMotion ? 1 : 1 + Math.sin(t * (sleeping ? 1.4 : 2)) * 0.009;
    tail.current.rotation.z = reducedMotion || sleeping ? 0.2 : Math.sin(t * 8) * (0.18 + wellbeing / 240);
    paw.current.rotation.x = -playful * (0.45 + 0.25 * Math.sin(elapsed.current * 4));
    root.current.position.y = playful * Math.max(0, Math.sin(elapsed.current * 5)) * 0.055;
  });
  return <Density.Provider value={high ? 1 : 0.4}>
    <group ref={root} onPointerDown={event => { event.stopPropagation(); onPetClick?.(); }} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <group ref={body}>
        <Coat at={[0, 0.42, -0.10]} size={[0.205, 0.35, 0.24]} hairs={4800} length={0.017} />
        <Coat at={[0, 0.68, 0.035]} size={[0.19, 0.26, 0.18]} hairs={2400} length={0.024} />
        <Coat at={[0, 0.83, 0.025]} size={[0.132, 0.20, 0.14]} hairs={1400} length={0.012} />
        {[-1, 1].map(side => <group key={side}>
          <Coat at={[side * 0.20, 0.22, -0.035]} size={[0.135, 0.20, 0.19]} hairs={1600} length={0.04} seed={50 + side} />
          <Coat at={[side * 0.22, 0.065, 0.13]} size={[0.105, 0.06, 0.145]} hairs={850} length={0.032} />
        </group>)}
      </group>
      <group ref={tail} position={[0.18, 0.32, -0.26]} rotation={[0, 0, -0.3]}>
        <Coat at={[0, 0.15, 0]} size={[0.035, 0.19, 0.038]} hairs={1000} length={0.018} flow={[0, 1, 0]} />
      </group>
      {[-1, 1].map(side => <group key={side} ref={side === 1 ? paw : undefined} position={[side * 0.118, 0.61, 0.145]}>
        <Coat at={[0, -0.245, 0]} size={[0.083, 0.29, 0.084]} shape="leg" hairs={2600} length={0.041} seed={73 + side} />
        <Coat at={[0, -0.547, 0.055]} size={[0.086, 0.062, 0.12]} hairs={1000} length={0.028} flow={[0, -0.7, 0.6]} />
      </group>)}
      <group ref={head} position={[0, 0.94, 0.08]}>
        <Coat at={[0, 0.035, 0]} size={[0.185, 0.20, 0.165]} shape="skull" hairs={5400} length={0.013} flow={[0, -0.35, 1]} />
        <Ear side={-1} /><Ear side={1} />
        <group ref={eyes}><Eye x={-0.094} /><Eye x={0.094} /></group>
        {/* Low, swept brows and a long muzzle, rather than a round teddy-bear face. */}
        {[-1, 1].map(side => <group key={side}>
          <Coat at={[side * 0.092, 0.089, 0.147]} size={[0.074, 0.016, 0.03]} hairs={1400} length={0.037} flow={[side * 0.75, -0.2, 0.5]} tilt={-side * 0.06} />
          <Coat at={[side * 0.082, -0.115, 0.18]} size={[0.105, 0.12, 0.105]} shape="beard" hairs={3000} length={0.059} flow={[side * 0.15, -1, 0.18]} tint="#eeeae1" seed={93 + side} />
        </group>)}
        <Coat at={[0, -0.027, 0.177]} size={[0.075, 0.085, 0.122]} hairs={1700} length={0.012} flow={[0, -0.1, 1]} />
        <Coat at={[0, -0.185, 0.16]} size={[0.12, 0.095, 0.092]} shape="beard" hairs={3200} length={0.06} flow={[0, -1, 0.1]} tint="#ece8df" />
        {/* Dark triangular leather nose and tiny recessed nostrils. */}
        <mesh position={[0, -0.075, 0.315]} scale={[0.052, 0.037, 0.036]} castShadow><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#171918" roughness={0.48} /></mesh>
        {[-1, 1].map(side => <mesh key={side} position={[side * 0.023, -0.075, 0.346]} scale={[0.010, 0.0065, 0.003]} rotation={[0, 0, side * 0.18]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#050606" roughness={0.9} /></mesh>)}
      </group>
      <mesh position={[0, 0.82, 0.028]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.137, 0.012, 10, 40]} /><meshStandardMaterial color="#9baeb3" roughness={0.85} /></mesh>
      <mesh position={[0, 0.78, 0.176]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.022, 0.022, 0.004, 20]} /><meshStandardMaterial color="#beb4a2" roughness={0.55} metalness={0.35} /></mesh>
    </group>
  </Density.Provider>;
}
