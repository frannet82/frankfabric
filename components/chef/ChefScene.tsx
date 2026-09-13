"use client";

// ---------------------------------------------------------------------------
// Chef chatbot — interactive 3D chef avatar.
//
// This renders the "Swedish Chef" avatar loaded from a single textured Biped
// FBX (public/models/characters/swedish-chef/swedish-chef.fbx) with its diffuse
// texture (swedish_chef_diff.jpg) applied to the mesh material. The FBX ships
// its own hat (Biped Bip001_Cap* bones), so no procedural toque or garment
// assembly is needed here.
//
// This is a plain FBX, NOT a VRM: it is loaded with FBXLoader and does not go
// through the VRMLoaderPlugin or the lib/vrm transplant/retarget helpers (those
// remain in use by components/wardrobe/WardrobeScene.tsx only).
//
// The parent passes an `animation` prop ('idle' | 'waving'). The FBX has no
// baked body-animation clips, so this prop currently has no visible body
// effect; it is retained for API compatibility with ChefChatbot.tsx and for a
// later feature that drives mouth/jaw motion during the speaking window.
//
// All asset URLs are routed through lib/asset.ts's asset() so they resolve
// under the /frankfabric/ base path in production. This whole component touches
// WebGL/DOM (react-three-fiber <Canvas />), so it is imported via next/dynamic
// { ssr:false } in ChefChatbot.tsx and never runs during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { asset } from "@/lib/asset";

// Which chef animation state the parent requests. "idle" is the resting state;
// "waving" is set briefly by the parent when the chef replies. The current FBX
// has no baked body clips, so this has no visible body effect yet, but the type
// and prop are kept so ChefChatbot.tsx compiles unchanged.
export type ChefAnimation = "idle" | "waving";

type SceneProps = {
  animation: ChefAnimation;
};

// Swedish Chef FBX + its diffuse texture. Every path is base-path-prefixed via
// asset() so it resolves to /frankfabric/models/... in production. Never
// hardcode a bare "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/swedish-chef/swedish-chef.fbx");
const TEXTURE_URL = asset(
  "/models/characters/swedish-chef/swedish_chef_diff.jpg"
);

// The FBX is authored in Biped units: the rig stands ~1632 units tall in world
// space, so scale it down to a ~1.6-unit-tall figure that fits the camera.
const MODEL_SCALE = 0.001;

// The `animation` prop is intentionally unused for now: the FBX has no baked
// body clips, so there is no visible body animation to drive. It stays in the
// public API for ChefChatbot.tsx and for the later mouth-motion feature.
function Avatar() {
  const fbx = useLoader(FBXLoader, MODEL_URL);
  const loadedTexture = useLoader(THREE.TextureLoader, TEXTURE_URL);

  // Clone the FBX and texture so we never mutate the loader-cached values
  // returned from the hooks (also keeps React strict-mode remounts clean).
  const model = useMemo(() => {
    const root = fbx.clone(true);

    // FBX diffuse textures are authored top-left origin and in sRGB.
    const texture = loadedTexture.clone();
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    root.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((raw) => {
          const mat = raw as THREE.MeshPhongMaterial;
          if (!mat) return;
          mat.map = texture;
          mat.needsUpdate = true;
        });
      }
    });

    root.scale.setScalar(MODEL_SCALE);
    // Feet sit at the rig origin (y≈0), so no vertical offset is needed to
    // stand on the ground plane.
    root.position.set(0, 0, 0);
    return root;
  }, [fbx, loadedTexture]);

  useEffect(() => {
    return () => {
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    };
  }, [model]);

  return <primitive object={model} />;
}

// The `animation` prop is part of the public API (ChefChatbot.tsx passes it)
// but has no visible body effect yet, since the FBX ships no baked body clips.
export default function ChefScene({ animation: _animation }: SceneProps) {
  void _animation;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.4, 2.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      // react-three-fiber forwards unknown props to the underlying <canvas>, so
      // these give assistive tech a text alternative for the avatar stage.
      role="img"
      aria-label="3D chef avatar"
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        // Fixed, front-facing framing: aim the camera at the chef's upper body.
        camera.lookAt(0, 1.3, 0);
      }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#9b6bff" />
      <hemisphereLight args={["#cfe4ff", "#1a1d2a", 0.5]} />

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Avatar />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.35}
        scale={4}
        blur={2.4}
        far={2}
        color="#05060c"
      />
    </Canvas>
  );
}
