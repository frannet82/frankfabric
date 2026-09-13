"use client";

// ---------------------------------------------------------------------------
// Chef chatbot — interactive 3D chef avatar.
//
// This renders a single VRM chef built by REUSING the repo's existing modular
// "drophunter" avatar objects (public/models/characters/drophunter/): the base
// body VRM plus the always-required eyes trait, a hair top, and a fitted top
// garment (the full jacket, tinted neutral white) so it reads as a chef's
// coat. A tiny three.js primitive chef's hat (a toque) sits on the head.
//
// The loading / garment-transplant / Mixamo-FBX-retarget approach is the same
// one used by components/wardrobe/WardrobeScene.tsx (CharacterStudio approach,
// MIT): a GLTFLoader with the VRMLoaderPlugin, read gltf.userData.vrm, call
// vrm.update(delta) every frame, and retarget the bundled Mixamo idle/waving
// FBX clips onto the VRM humanoid. Garment VRMs carry the same 198-joint
// skeleton as the base body, so each garment SkinnedMesh is rebound onto the
// base body's bones (matched by name) and reparented under the base scene.
//
// The parent passes a `animation` prop ('idle' | 'waving') so the chef can wave
// briefly whenever it replies, then settle back to idle.
//
// All asset URLs are routed through lib/asset.ts's asset() so they resolve
// under the /frankfabric/ base path in production. This whole component touches
// WebGL/DOM (react-three-fiber <Canvas />), so it is imported via next/dynamic
// { ssr:false } in ChefChatbot.tsx and never runs during static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
  type VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { asset } from "@/lib/asset";

// Which humanoid animation the chef plays. "idle" is the resting loop; "waving"
// is triggered briefly by the parent when the chef replies.
export type ChefAnimation = "idle" | "waving";

type SceneProps = {
  animation: ChefAnimation;
};

// Reused drophunter avatar objects. Every path is base-path-prefixed via
// asset() so it resolves to /frankfabric/models/... in production. Never
// hardcode a bare "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/drophunter/body.vrm");
const EYES_URL = asset("/models/characters/drophunter/eyes/regulareyes.vrm");
const HAIR_URL = asset("/models/characters/drophunter/head/short.vrm");
// A full jacket garment tinted a neutral white reads as a chef's coat.
const COAT_URL = asset("/models/characters/drophunter/chest/fulljacket.vrm");
const PANTS_URL = asset("/models/characters/drophunter/legs/cargopants.vrm");

// The chef's coat tint (near-white) so the full jacket reads as chef whites.
const COAT_COLOR = "#f3f1ea";

// Mixamo FBX animation clips (same reusable clips the wardrobe uses). Loaded
// client-side only via FBXLoader and retargeted onto the VRM humanoid.
const ANIMATION_URLS: Record<ChefAnimation, string> = {
  idle: asset("/animations/idle.fbx"),
  waving: asset("/animations/waving.fbx"),
};

// ---------------------------------------------------------------------------
// Mixamo -> VRM animation retargeting (same map + approach as WardrobeScene).
// For each Mixamo bone we look up the VRM humanoid bone via
// vrm.humanoid.getNormalizedBoneNode(), rebuild the clip's rotation tracks so
// they target the normalized bone node names, scale the hips position track to
// the VRM's hip height, and drop any track whose bone doesn't map.
// ---------------------------------------------------------------------------
const MIXAMO_TO_VRM_BONE: Record<string, VRMHumanBoneName> = {
  mixamorigHips: "hips" as VRMHumanBoneName,
  mixamorigSpine: "spine" as VRMHumanBoneName,
  mixamorigSpine1: "chest" as VRMHumanBoneName,
  mixamorigSpine2: "upperChest" as VRMHumanBoneName,
  mixamorigNeck: "neck" as VRMHumanBoneName,
  mixamorigHead: "head" as VRMHumanBoneName,
  mixamorigLeftShoulder: "leftShoulder" as VRMHumanBoneName,
  mixamorigLeftArm: "leftUpperArm" as VRMHumanBoneName,
  mixamorigLeftForeArm: "leftLowerArm" as VRMHumanBoneName,
  mixamorigLeftHand: "leftHand" as VRMHumanBoneName,
  mixamorigRightShoulder: "rightShoulder" as VRMHumanBoneName,
  mixamorigRightArm: "rightUpperArm" as VRMHumanBoneName,
  mixamorigRightForeArm: "rightLowerArm" as VRMHumanBoneName,
  mixamorigRightHand: "rightHand" as VRMHumanBoneName,
  mixamorigLeftUpLeg: "leftUpperLeg" as VRMHumanBoneName,
  mixamorigLeftLeg: "leftLowerLeg" as VRMHumanBoneName,
  mixamorigLeftFoot: "leftFoot" as VRMHumanBoneName,
  mixamorigLeftToeBase: "leftToes" as VRMHumanBoneName,
  mixamorigRightUpLeg: "rightUpperLeg" as VRMHumanBoneName,
  mixamorigRightLeg: "rightLowerLeg" as VRMHumanBoneName,
  mixamorigRightFoot: "rightFoot" as VRMHumanBoneName,
  mixamorigRightToeBase: "rightToes" as VRMHumanBoneName,
};

function retargetMixamoClip(
  asset3d: THREE.Group,
  clip: THREE.AnimationClip,
  vrm: VRM
): THREE.AnimationClip | null {
  const humanoid = vrm.humanoid;
  if (!humanoid) return null;

  const tracks: THREE.KeyframeTrack[] = [];

  const motionHipsNode = asset3d.getObjectByName("mixamorigHips");
  const vrmHipsNode = humanoid.getNormalizedBoneNode("hips" as VRMHumanBoneName);
  const motionHipsHeight = motionHipsNode
    ? motionHipsNode.getWorldPosition(new THREE.Vector3()).y
    : 1;
  const vrmHipsHeight = vrmHipsNode
    ? vrmHipsNode.getWorldPosition(new THREE.Vector3()).y
    : 1;
  const hipsScale =
    motionHipsHeight > 1e-6 ? vrmHipsHeight / motionHipsHeight : 1;

  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();

  for (const track of clip.tracks) {
    const trackSplit = track.name.split(".");
    const mixamoBoneName = trackSplit[0];
    const propertyName = trackSplit[1];
    const vrmBoneName = MIXAMO_TO_VRM_BONE[mixamoBoneName];
    if (!vrmBoneName) continue;

    const vrmNode = humanoid.getNormalizedBoneNode(vrmBoneName);
    if (!vrmNode) continue;
    const vrmNodeName = vrmNode.name;

    const mixamoNode = asset3d.getObjectByName(mixamoBoneName);
    if (!mixamoNode) continue;

    if (propertyName === "quaternion") {
      mixamoNode.getWorldQuaternion(restRotationInverse).invert();
      mixamoNode.parent?.getWorldQuaternion(parentRestWorldRotation);

      const quatTrack = track as THREE.QuaternionKeyframeTrack;
      const values = Array.from(quatTrack.values);
      for (let i = 0; i < values.length; i += 4) {
        _quatA.fromArray(values, i);
        _quatA
          .premultiply(parentRestWorldRotation)
          .multiply(restRotationInverse);
        _quatA.toArray(values, i);
      }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.quaternion`,
          Array.from(quatTrack.times),
          values
        )
      );
    } else if (propertyName === "position" && vrmBoneName === "hips") {
      const posTrack = track as THREE.VectorKeyframeTrack;
      const values = Array.from(posTrack.values).map((v) => v * hipsScale);
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.position`,
          Array.from(posTrack.times),
          values
        )
      );
    }
  }

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip(clip.name || "mixamo", clip.duration, tracks);
}

// ---------------------------------------------------------------------------
// Garment transplant (CharacterStudio approach, MIT). A loaded garment VRM
// carries its own copy of the base skeleton; rebind each SkinnedMesh onto the
// base body's bone nodes (matched by name) so it deforms with the animated base
// rig, then reparent under the base VRM scene. Returns the transplanted meshes
// and cloned materials so the caller can dispose them on unmount.
// ---------------------------------------------------------------------------
type Transplant = {
  group: THREE.Group;
  materials: THREE.Material[];
};

function applyColor(material: THREE.Material, hex: string) {
  const color = new THREE.Color(hex);
  const std = material as THREE.MeshStandardMaterial & {
    color?: THREE.Color;
    needsUpdate?: boolean;
  };
  if (std.color) {
    std.color.copy(color);
    std.needsUpdate = true;
  }
}

function transplantGarment(
  garment: VRM,
  baseVrm: VRM,
  color: string | null
): Transplant {
  const baseBonesByName = new Map<string, THREE.Object3D>();
  baseVrm.scene.traverse((obj) => {
    if (!baseBonesByName.has(obj.name)) baseBonesByName.set(obj.name, obj);
  });

  const group = new THREE.Group();
  group.name = "garment-transplant";
  const materials: THREE.Material[] = [];

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  garment.scene.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) skinnedMeshes.push(sm);
  });

  for (const mesh of skinnedMeshes) {
    const srcSkeleton = mesh.skeleton;
    const newBones = srcSkeleton.bones.map((bone) => {
      const baseBone = baseBonesByName.get(bone.name) as THREE.Bone | undefined;
      return baseBone ?? bone;
    });
    const newSkeleton = new THREE.Skeleton(newBones, srcSkeleton.boneInverses);

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((mat) => {
        const cloned = mat.clone();
        cloned.name = mat.name;
        materials.push(cloned);
        return cloned;
      });
    } else {
      const cloned = mesh.material.clone();
      cloned.name = mesh.material.name;
      mesh.material = cloned;
      materials.push(cloned);
    }

    mesh.bind(newSkeleton, mesh.bindMatrix);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (color) {
    materials.forEach((mat) => applyColor(mat, color));
  }

  return { group, materials };
}

// A single transplanted garment/trait. Loads the VRM client-side and mounts its
// skinned meshes onto the base body's skeleton. `color` null keeps authored
// materials (used for eyes/hair); a hex tints them (used for the coat).
function Garment({
  baseVrm,
  url,
  color,
}: {
  baseVrm: VRM;
  url: string | null;
  color: string | null;
}) {
  const mounted = useRef<Transplant | null>(null);
  const disposeScene = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const loader = new GLTFLoader();
    loader.register(
      (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: false })
    );

    loader.load(url, (gltf) => {
      if (cancelled) return;
      const garment = gltf.userData.vrm as VRM | undefined;
      if (!garment) return;

      const transplant = transplantGarment(garment, baseVrm, color);
      baseVrm.scene.add(transplant.group);
      mounted.current = transplant;
      disposeScene.current = garment.scene;
    });

    return () => {
      cancelled = true;
      const t = mounted.current;
      if (t) {
        baseVrm.scene.remove(t.group);
        t.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) mesh.geometry?.dispose();
        });
        t.materials.forEach((mat) => mat.dispose());
        mounted.current = null;
      }
      if (disposeScene.current) {
        VRMUtils.deepDispose(disposeScene.current);
        disposeScene.current = null;
      }
    };
  }, [baseVrm, url, color]);

  return null;
}

// A lightweight three.js primitive chef's toque, parented to the VRM head bone
// so it follows the animated rig. No extra assets are downloaded for it.
function ChefHat({ vrm }: { vrm: VRM }) {
  const headNode = useMemo(
    () => vrm.humanoid?.getNormalizedBoneNode("head" as VRMHumanBoneName) ?? null,
    [vrm]
  );

  const hat = useMemo(() => {
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#fbfaf6"),
      roughness: 0.85,
      metalness: 0,
    });

    // Stiff band around the head.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.07, 24),
      white
    );
    band.position.y = 0.13;
    band.castShadow = true;
    group.add(band);

    // Puffy crown of the toque.
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 20),
      white
    );
    crown.scale.set(1, 1.15, 1);
    crown.position.y = 0.24;
    crown.castShadow = true;
    group.add(crown);

    return group;
  }, []);

  useEffect(() => {
    if (!headNode) return;
    headNode.add(hat);
    return () => {
      headNode.remove(hat);
      hat.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    };
  }, [headNode, hat]);

  return null;
}

function Avatar({ animation }: SceneProps) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register(
      (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
    );
  });

  const vrm = gltf.userData.vrm as VRM;

  useMemo(() => {
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return vrm;
  }, [vrm]);

  useEffect(() => {
    return () => {
      VRMUtils.deepDispose(vrm.scene);
    };
  }, [vrm]);

  // Load + retarget the Mixamo FBX clips (client-side only).
  const idleFbx = useLoader(FBXLoader, ANIMATION_URLS.idle);
  const wavingFbx = useLoader(FBXLoader, ANIMATION_URLS.waving);

  const playback = useRef<{
    mixer: THREE.AnimationMixer;
    actions: Record<ChefAnimation, THREE.AnimationAction | null>;
  } | null>(null);
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const build = (fbx: THREE.Group): THREE.AnimationAction | null => {
      const raw = fbx.animations?.[0];
      if (!raw) return null;
      const clip = retargetMixamoClip(fbx, raw, vrm);
      return clip ? mixer.clipAction(clip) : null;
    };
    playback.current = {
      mixer,
      actions: {
        idle: build(idleFbx),
        waving: build(wavingFbx),
      },
    };
    currentAction.current = null;
    return () => {
      mixer.stopAllAction();
      playback.current = null;
      currentAction.current = null;
    };
  }, [vrm, idleFbx, wavingFbx]);

  // Crossfade to the requested clip when `animation` changes.
  useEffect(() => {
    const state = playback.current;
    if (!state) return;
    const next = state.actions[animation];
    const prev = currentAction.current;
    if (next === prev) return;

    const FADE = 0.3;
    if (next) {
      next.reset();
      next.setEffectiveWeight(1);
      next.fadeIn(FADE);
      next.play();
    }
    if (prev) {
      prev.fadeOut(FADE);
    }
    currentAction.current = next;
  }, [animation, idleFbx, wavingFbx, vrm]);

  useFrame((_, delta) => {
    playback.current?.mixer.update(delta);
    vrm.update(delta);
  });

  return (
    <group>
      <primitive object={vrm.scene} />

      {/* Required eyes trait (base body ships with empty sockets). */}
      <Garment baseVrm={vrm} url={EYES_URL} color={null} />
      {/* Hair. */}
      <Garment baseVrm={vrm} url={HAIR_URL} color={null} />
      {/* Chef whites: a full jacket tinted near-white + neutral trousers. */}
      <Garment baseVrm={vrm} url={COAT_URL} color={COAT_COLOR} />
      <Garment baseVrm={vrm} url={PANTS_URL} color="#20242e" />

      {/* Lightweight primitive chef's toque parented to the head bone. */}
      <ChefHat vrm={vrm} />
    </group>
  );
}

export default function ChefScene({ animation }: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.4, 2.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
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
          <Avatar animation={animation} />
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

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={1.6}
        maxDistance={4}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, 1.3, 0]}
        autoRotate={animation === "idle"}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
