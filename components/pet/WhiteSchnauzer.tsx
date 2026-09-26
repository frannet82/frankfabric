"use client";
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import type { PetAction } from '@/lib/pet/petState';

type Vec = [number, number, number];
type Props = { mood: string; action?: PetAction | null; actionNonce?: number; wellbeing: number; onPetClick?: () => void; reducedMotion?: boolean };
function Coat({ at, size, color = '#fffefa', tilt = 0 }: { at: Vec; size: Vec; color?: string; tilt?: number }) {
  return <mesh position={at} scale={size} rotation={[0, 0, tilt]} castShadow receiveShadow>
    <sphereGeometry args={[1, 24, 16]} />
    <meshStandardMaterial color={color} roughness={0.93} />
  </mesh>;
}
function Eye({ x }: { x: number }) {
  return <group position={[x, 0.06, 0.235]}>
    <mesh scale={[0.052, 0.06, 0.025]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#292520" roughness={0.3} /></mesh>
    <mesh position={[0, 0, 0.02]} scale={[0.034, 0.043, 0.018]}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#110f0d" roughness={0.12} /></mesh>
    <mesh position={[-0.014, 0.022, 0.034]}><sphereGeometry args={[0.011, 12, 8]} /><meshBasicMaterial color="white" /></mesh>
    <mesh position={[0.015, -0.016, 0.034]}><sphereGeometry args={[0.005, 10, 8]} /><meshBasicMaterial color="#efe5d8" /></mesh>
  </group>;
}

/** A locally sculpted, groomed schnauzer. Mesh groups form a small animation rig. */
export default function WhiteSchnauzer({ mood, action, actionNonce, wellbeing, onPetClick, reducedMotion = false }: Props) {
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
  return <group ref={root} onPointerDown={event => { event.stopPropagation(); onPetClick?.(); }} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
    <group ref={body}>
      <Coat at={[0, 0.40, -0.07]} size={[0.27, 0.37, 0.27]} />
      <Coat at={[0, 0.61, 0.06]} size={[0.23, 0.27, 0.22]} />
      {[-1, 1].map(side => <group key={side}>
        <Coat at={[side * 0.24, 0.19, -0.02]} size={[0.15, 0.17, 0.19]} />
        <Coat at={[side * 0.24, 0.075, 0.1]} size={[0.135, 0.075, 0.19]} />
      </group>)}
    </group>
    <group ref={tail} position={[0.23, 0.28, -0.24]} rotation={[0, 0, 0.2]}>
      <Coat at={[0.08, 0.17, 0]} size={[0.065, 0.21, 0.065]} tilt={-0.45} />
    </group>
    {[-1, 1].map(side => <group key={side} ref={side === 1 ? paw : undefined} position={[side * 0.13, 0.5, 0.2]}>
      <Coat at={[0, -0.2, 0]} size={[0.085, 0.23, 0.09]} />
      <Coat at={[0, -0.43, 0.065]} size={[0.105, 0.075, 0.15]} />
      {[-1, 0, 1].map(toe => <Coat key={toe} at={[toe * 0.042, -0.442, 0.16]} size={[0.034, 0.047, 0.045]} />)}
    </group>)}
    <group ref={head} position={[0, 0.94, 0.11]}>
      <Coat at={[0, 0.025, 0]} size={[0.28, 0.245, 0.235]} />
      {/* Natural folded ears, with a soft warm inner surface. */}
      {[-1, 1].map(side => <group key={side} position={[side * 0.255, 0.115, -0.015]} rotation={[0.25, 0, side * 0.3]}>
        <Coat at={[0, -0.05, 0]} size={[0.105, 0.17, 0.065]} color="#efeee8" />
        <Coat at={[0, -0.045, 0.055]} size={[0.063, 0.115, 0.014]} color="#dcc6c0" />
        <Coat at={[0, -0.13, 0.075]} size={[0.082, 0.065, 0.045]} />
      </group>)}
      <group ref={eyes}><Eye x={-0.115} /><Eye x={0.115} /></group>
      {/* Schnauzer eyebrows fan outward, leaving both eyes clearly visible. */}
      {[-1, 1].map(side => <group key={side}>
        {[0, 1, 2].map(i => <Coat key={i} at={[side * (0.09 + i * 0.041), 0.16 - i * 0.006, 0.22]} size={[0.071, 0.027, 0.047]} tilt={-side * (0.15 + i * 0.1)} />)}
        <Coat at={[side * 0.13, -0.075, 0.23]} size={[0.15, 0.115, 0.15]} />
        {[0, 1, 2].map(i => <Coat key={i} at={[side * (0.125 + i * 0.035), -0.10 - i * 0.018, 0.30 - i * 0.012]} size={[0.08, 0.046, 0.052]} tilt={side * 0.4} />)}
      </group>)}
      <Coat at={[0, -0.035, 0.295]} size={[0.17, 0.105, 0.13]} />
      {/* Rounded, tapered beard; solid geometry avoids ragged alpha-card edges. */}
      <Coat at={[0, -0.18, 0.22]} size={[0.19, 0.17, 0.125]} />
      {[-2, -1, 0, 1, 2].map(i => <Coat key={i} at={[i * 0.058, -0.255 + Math.abs(i) * 0.018, 0.255]} size={[0.051, 0.085, 0.052]} tilt={i * -0.06} />)}
      <mesh position={[0, -0.065, 0.419]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.065, 0.004, 8, 20, Math.PI]} /><meshStandardMaterial color="#665b54" roughness={0.8} /></mesh>
      <mesh position={[0, 0.0, 0.412]} scale={[0.075, 0.052, 0.044]} castShadow><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#232321" roughness={0.36} /></mesh>
      <mesh position={[-0.021, 0.016, 0.45]} scale={[0.016, 0.006, 0.004]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#7e817e" roughness={0.5} /></mesh>
    </group>
    {/* A small sage collar and round brass tag. */}
    <mesh position={[0, 0.7, 0.10]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.195, 0.022, 10, 36]} /><meshStandardMaterial color="#829b8a" roughness={0.75} /></mesh>
    <mesh position={[0, 0.67, 0.313]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.034, 0.034, 0.009, 24]} /><meshStandardMaterial color="#d1b675" roughness={0.4} metalness={0.45} /></mesh>
  </group>;
}
