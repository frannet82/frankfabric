"use client";
import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

type Vec = [number, number, number];
function Block({ at, size, color, radius = 0.015 }: { at: Vec; size: Vec; color: string; radius?: number }) {
  return <RoundedBox position={at} args={size} radius={radius} smoothness={2} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.84} /></RoundedBox>;
}
function Rail({ from, to, radius = 0.014 }: { from: Vec; to: Vec; radius?: number }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return <mesh position={mid} quaternion={rotation} castShadow><cylinderGeometry args={[radius, radius, a.distanceTo(b), 12]} /><meshStandardMaterial color="#b49a6c" metalness={0.68} roughness={0.4} /></mesh>;
}
function Mirror({ high }: { high: boolean }) {
  const mirror = useMemo(() => new Reflector(new THREE.PlaneGeometry(0.81, 1.77), { color: 0xc9ceca, textureWidth: high ? 512 : 256, textureHeight: high ? 1024 : 512, clipBias: 0.003, multisample: high ? 2 : 0 }), [high]);
  useEffect(() => () => { mirror.geometry.dispose(); mirror.dispose(); }, [mirror]);
  return <group position={[-0.96, 1.01, -1.15]} rotation={[0, 0.34, 0]}>
    <Block at={[0, 0, -0.025]} size={[0.91, 1.88, 0.06]} color="#a88f66" />
    <primitive object={mirror} position={[0, 0, 0.01]} />
  </group>;
}
function Curtain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.02, 2.5, 80, 24);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin((x + 0.51) * Math.PI * 14) * (0.04 + (1.25 - y) * 0.018));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={[1.58, 1.27, -1.35]}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#a9b1a2" roughness={1} side={THREE.DoubleSide} /></mesh>
    <Rail from={[-0.59, 1.31, 0]} to={[0.59, 1.31, 0]} />
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-0.46 + i * 0.13, 1.28, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.026, 0.004, 6, 16]} /><meshStandardMaterial color="#b49a6c" metalness={0.65} roughness={0.4} /></mesh>)}
  </group>;
}
function HangingClothes() {
  return <group position={[1.0, 0, -0.80]}>
    <Rail from={[-0.35, 0.05, 0]} to={[-0.35, 1.84, 0]} />
    <Rail from={[0.35, 0.05, 0]} to={[0.35, 1.84, 0]} />
    <Rail from={[-0.35, 1.84, 0]} to={[0.35, 1.84, 0]} />
    <Rail from={[-0.47, 0.035, 0]} to={[0.47, 0.035, 0]} radius={0.02} />
    {['#e4d7c2', '#a88c7b', '#687d78'].map((color, i) => <group key={color} position={[-0.21 + i * 0.2, 0, i * -0.035]} rotation={[0, -0.5, 0]}>
      <Rail from={[0, 1.83, 0]} to={[0, 1.69, 0]} radius={0.007} />
      <Rail from={[0, 1.70, 0]} to={[-0.16, 1.58, 0]} radius={0.008} />
      <Rail from={[0, 1.70, 0]} to={[0.16, 1.58, 0]} radius={0.008} />
      <Rail from={[-0.16, 1.58, 0]} to={[0.16, 1.58, 0]} radius={0.008} />
      <Block at={[0, 1.30, -0.015]} size={[0.30, 0.54, 0.048]} radius={0.04} color={color} />
      <group position={[-0.20, 1.43, -0.015]} rotation={[0, 0, -0.38]}><Block at={[0, 0, 0]} size={[0.11, 0.35, 0.05]} color={color} radius={0.025} /></group>
      <group position={[0.20, 1.43, -0.015]} rotation={[0, 0, 0.38]}><Block at={[0, 0, 0]} size={[0.11, 0.35, 0.05]} color={color} radius={0.025} /></group>
    </group>)}
  </group>;
}

export default function ChangingRoom({ high }: { high: boolean }) {
  return <group>
    <Block at={[0, 1.5, -1.75]} size={[6, 3, 0.12]} color="#ded8ce" />
    <Block at={[-2.1, 1.5, -0.5]} size={[0.12, 3, 2.6]} color="#d3ccc0" />
    <Block at={[0, -0.06, 0]} size={[6, 0.10, 7]} color="#aa8c6c" />
    {Array.from({ length: 17 }, (_, i) => <Block key={i} at={[-2.8 + i * 0.35, -0.003, 0]} size={[0.344, 0.012, 7]} color={i % 3 === 0 ? '#b59c7f' : i % 3 === 1 ? '#bda58a' : '#b29a7e'} radius={0.002} />)}
    <Block at={[0, 0.09, -1.66]} size={[4.1, 0.17, 0.045]} color="#c5bbae" />
    <Mirror high={high} />
    <Curtain />
    <HangingClothes />
    <group position={[-1.12, 0, 0.10]} rotation={[0, 0.18, 0]}>
      <Block at={[0, 0.36, 0]} size={[0.70, 0.15, 0.42]} color="#beaa91" radius={0.055} />
      {[-0.26, 0.26].map(x => <group key={x}>{[-0.14, 0.14].map(z => <Rail key={z} from={[x, 0.02, z]} to={[x, 0.32, z]} radius={0.018} />)}</group>)}
    </group>
    <mesh position={[0, 0.009, 0.09]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[0.83, 64]} /><meshStandardMaterial color="#e1d9cc" roughness={1} /></mesh>
    {/* Warm wall sconces remain geometry-only in Fast mode. */}
    {[-1.65, 0.03].map(x => <group key={x} position={[x, 1.94, -1.63]}>
      <Block at={[0, 0, 0]} size={[0.065, 0.32, 0.06]} color="#b29a75" />
      <mesh position={[0, 0, 0.05]}><capsuleGeometry args={[0.025, 0.23, 4, 10]} /><meshStandardMaterial color="#fff4da" emissive="#ffe2a8" emissiveIntensity={0.7} /></mesh>
    </group>)}
  </group>;
}
