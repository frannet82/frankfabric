"use client";

type Vec = [number, number, number];
function Box({ position, size, color }: { position: Vec; size: Vec; color: string }) {
  return <mesh position={position} receiveShadow castShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}
function Plant({ position }: { position: Vec }) {
  return <group position={position}>
    <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.12, 0.09, 0.24, 16]} /><meshStandardMaterial color="#bb8062" /></mesh>
    {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 2) * 0.1, 0.32 + i * 0.045, Math.cos(i * 2) * 0.06]} rotation={[0, i, 0.45]} scale={[0.06, 0.20, 0.025]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={i % 2 ? '#58755a' : '#3c5949'} /></mesh>)}
  </group>;
}

/** Small, local geometry keeps the furnished rooms available on both quality tiers. */
export default function StudioEnvironment({ kind }: { kind: 'chef' | 'coach' | 'pet' }) {
  const gym = kind === 'coach';
  return <group>
    <color attach="background" args={[gym ? '#343d3c' : '#e5ded0']} />
    <Box position={[0, 1.6, -1.35]} size={[8, 3.2, 0.12]} color={gym ? '#3e4947' : '#e5dfd2'} />
    <Box position={[0, -0.055, 0]} size={[8, 0.1, 7]} color={gym ? '#545a58' : '#b49a7b'} />
    {[-2, -1, 0, 1, 2].map(x => <Box key={x} position={[x, 0.005, 0]} size={[0.008, 0.006, 7]} color={gym ? '#424846' : '#9e8366'} />)}
    {kind === 'chef' ? <>
      <Box position={[0, 0.53, -0.98]} size={[4.5, 1.05, 0.62]} color="#607c6b" />
      <Box position={[0, 1.07, -0.95]} size={[4.6, 0.075, 0.75]} color="#f0e9db" />
      {[-1.65, -0.85, 0.85, 1.65].map(x => <group key={x}><Box position={[x, 0.52, -0.65]} size={[0.72, 0.88, 0.025]} color="#6f8b78" /><Box position={[x, 0.84, -0.62]} size={[0.23, 0.025, 0.025]} color="#d3b578" /></group>)}
      <Box position={[0, 2.02, -1.1]} size={[3.6, 0.06, 0.4]} color="#a78762" />
      {[-1.45, -1.12, 0.92, 1.26].map((x, i) => <mesh key={x} position={[x, 2.17, -1.07]}><cylinderGeometry args={[0.08, 0.08, 0.25, 16]} /><meshStandardMaterial color={['#dfb76e', '#e8ddd0', '#bb7660', '#e8ddd0'][i]} roughness={0.8} /></mesh>)}
      <Plant position={[1.25, 1.12, -0.88]} />
      <Box position={[-1.1, 1.12, -0.83]} size={[0.5, 0.025, 0.35]} color="#a4764b" />
    </> : gym ? <>
      <Box position={[-1.15, 1.68, -1.25]} size={[1.35, 1.5, 0.06]} color="#b0c4c1" />
      <Box position={[-1.15, 0.90, -1.17]} size={[1.45, 0.045, 0.09]} color="#d0b274" />
      <Box position={[1.15, 0.55, -0.95]} size={[1.0, 0.07, 0.4]} color="#292e2e" />
      {[0.8, 1.15, 1.5].map(x => <group key={x} position={[x, 0.68, -0.95]}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 0.24, 12]} /><meshStandardMaterial color="#a8b0ad" metalness={0.6} roughness={0.3} /></mesh>
        {[-0.12, 0.12].map(dx => <mesh key={dx} position={[dx, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.06, 12]} /><meshStandardMaterial color="#222b2b" /></mesh>)}
      </group>)}
      <Box position={[0.6, 0.02, 0]} size={[0.8, 0.025, 1.7]} color="#778f83" />
      <Plant position={[1.8, 0, -1]} />
    </> : <>
      <Box position={[-1.15, 0.38, -0.9]} size={[1.4, 0.4, 0.65]} color="#b99173" />
      <Box position={[-1.15, 0.7, -1.14]} size={[1.4, 0.5, 0.18]} color="#c5a78c" />
      <Box position={[1, 1.7, -1.25]} size={[1.15, 1.1, 0.04]} color="#f6eddc" />
      <Box position={[1, 1.7, -1.21]} size={[0.98, 0.92, 0.02]} color="#a9c2bc" />
      <Box position={[1, 1.7, -1.17]} size={[0.035, 0.98, 0.02]} color="#f6eddc" />
      <Plant position={[1.55, 0, -0.9]} />
    </>}
  </group>;
}
