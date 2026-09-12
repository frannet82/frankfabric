"use client";

// ---------------------------------------------------------------------------
// Digital Wardrobe — interactive 3D scene.
//
// The avatar and every garment are built PROCEDURALLY from three.js primitive
// meshes (spheres, capsules, cylinders). No external model files (.glb/.gltf)
// or textures are loaded, so there is nothing to 404 under the GitHub Pages
// base path and no third-party asset licensing to track.
//
// This component touches the DOM/WebGL (react-three-fiber <Canvas />) and is
// therefore imported by WardrobeBuilder.tsx via next/dynamic with
// { ssr: false } so it never runs during Next.js static generation.
// ---------------------------------------------------------------------------

import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

export type Category = "top" | "bottom" | "shoes" | "hat";

export type WardrobeSelection = Record<Category, number>;
export type WardrobeColors = Record<Category, string>;

// Option 0 is always "None" for each category.
export const OPTIONS: Record<Category, string[]> = {
  top: ["None", "T-Shirt", "Hoodie", "Tank Top"],
  bottom: ["None", "Jeans", "Shorts", "Skirt"],
  shoes: ["None", "Sneakers", "Boots"],
  hat: ["None", "Cap", "Beanie"],
};

const SKIN = "#d7a98c";

type SceneProps = {
  selection: WardrobeSelection;
  colors: WardrobeColors;
};

function Body() {
  return (
    <group>
      {/* head */}
      <mesh position={[0, 2.05, 0]} castShadow>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.25, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.9, 8, 24]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.62, 1.05, 0]} rotation={[0, 0, 0.18]} castShadow>
        <capsuleGeometry args={[0.13, 1.0, 8, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0.62, 1.05, 0]} rotation={[0, 0, -0.18]} castShadow>
        <capsuleGeometry args={[0.13, 1.0, 8, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.22, -0.1, 0]} castShadow>
        <capsuleGeometry args={[0.17, 1.05, 8, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0.22, -0.1, 0]} castShadow>
        <capsuleGeometry args={[0.17, 1.05, 8, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Top({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.55} />;
  // Sleeve length varies by garment type.
  const longSleeve = option === 2; // Hoodie
  const sleeveless = option === 3; // Tank Top
  return (
    <group>
      {/* body of the top over the torso */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.48, 0.85, 8, 24]} />
        {mat}
      </mesh>
      {option === 2 && (
        // hood
        <mesh position={[0, 1.62, -0.12]} castShadow>
          <sphereGeometry args={[0.3, 20, 20]} />
          {mat}
        </mesh>
      )}
      {!sleeveless && (
        <>
          <mesh
            position={[-0.62, longSleeve ? 1.05 : 1.28, 0]}
            rotation={[0, 0, 0.18]}
            castShadow
          >
            <capsuleGeometry args={[0.16, longSleeve ? 1.0 : 0.42, 8, 16]} />
            {mat}
          </mesh>
          <mesh
            position={[0.62, longSleeve ? 1.05 : 1.28, 0]}
            rotation={[0, 0, -0.18]}
            castShadow
          >
            <capsuleGeometry args={[0.16, longSleeve ? 1.0 : 0.42, 8, 16]} />
            {mat}
          </mesh>
        </>
      )}
    </group>
  );
}

function Bottom({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.6} />;
  if (option === 3) {
    // Skirt — a cone flared out from the waist.
    return (
      <mesh position={[0, 0.3, 0]} castShadow>
        <coneGeometry args={[0.7, 0.95, 24, 1, true]} />
        {mat}
      </mesh>
    );
  }
  const legLength = option === 2 ? 0.5 : 1.1; // Shorts vs Jeans
  const legY = option === 2 ? 0.35 : 0.0;
  return (
    <group>
      {/* waist / hips */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.46, 0.2, 8, 20]} />
        {mat}
      </mesh>
      <mesh position={[-0.22, legY, 0]} castShadow>
        <capsuleGeometry args={[0.2, legLength, 8, 16]} />
        {mat}
      </mesh>
      <mesh position={[0.22, legY, 0]} castShadow>
        <capsuleGeometry args={[0.2, legLength, 8, 16]} />
        {mat}
      </mesh>
    </group>
  );
}

function Shoes({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.5} />;
  const boot = option === 2; // Boots rise higher up the ankle.
  const height = boot ? 0.45 : 0.2;
  const y = -0.78 + height / 2;
  return (
    <group>
      {[-0.22, 0.22].map((x) => (
        <group key={x}>
          <mesh position={[x, y, 0.06]} castShadow>
            <boxGeometry args={[0.24, height, 0.5]} />
            {mat}
          </mesh>
          {/* toe */}
          <mesh position={[x, -0.78 + 0.06, 0.32]} castShadow>
            <boxGeometry args={[0.24, 0.12, 0.2]} />
            {mat}
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Hat({ option, color }: { option: number; color: string }) {
  if (option === 0) return null;
  const mat = <meshStandardMaterial color={color} roughness={0.55} />;
  if (option === 2) {
    // Beanie — snug rounded cap.
    return (
      <mesh position={[0, 2.28, 0]} castShadow>
        <sphereGeometry args={[0.45, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        {mat}
      </mesh>
    );
  }
  // Cap — dome plus a brim.
  return (
    <group>
      <mesh position={[0, 2.3, 0]} castShadow>
        <sphereGeometry args={[0.44, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh position={[0, 2.28, 0.38]} rotation={[0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.32]} />
        {mat}
      </mesh>
    </group>
  );
}

export default function WardrobeScene({ selection, colors }: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.1, 5], fov: 42 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <color attach="background" args={["#efede8"]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      <hemisphereLight args={["#ffffff", "#cbc7bd", 0.5]} />

      <group position={[0, 0.2, 0]}>
        <Body />
        <Top option={selection.top} color={colors.top} />
        <Bottom option={selection.bottom} color={colors.bottom} />
        <Shoes option={selection.shoes} color={colors.shoes} />
        <Hat option={selection.hat} color={colors.hat} />
      </group>

      <ContactShadows
        position={[0, -1.0, 0]}
        opacity={0.4}
        scale={6}
        blur={2.2}
        far={3}
        color="#2c2a26"
      />

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={8}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, 0.9, 0]}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
