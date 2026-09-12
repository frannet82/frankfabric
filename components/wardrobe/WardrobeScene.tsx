"use client";

// ---------------------------------------------------------------------------
// Digital Wardrobe — interactive 3D scene (modular rigged VRM avatar).
//
// The avatar is a minimally-clothed modular base body VRM ("drophunter") loaded
// with @pixiv/three-vrm. The selectable clothes are REAL fitted garment VRMs
// that each carry the SAME 198-joint skeleton as the base body. We adopt the
// loading/animation approach used by CharacterStudio
// (https://github.com/M3-org/CharacterStudio, MIT): create a three GLTFLoader,
// register the VRMLoaderPlugin, read the parsed avatar from `gltf.userData.vrm`,
// and call `vrm.update(delta)` every frame so the rig's SpringBones and lookAt
// animate. We adopt the APPROACH, not the editor code.
//
// GARMENT TRANSPLANT (CharacterStudio approach, MIT): each garment VRM ships as
// a full VRM whose SkinnedMeshes are bound to a skeleton identical to the base
// body's. To make a garment deform with the animated base skeleton we rebind
// every garment SkinnedMesh onto the BASE body's bone nodes, matched by bone
// name, then parent the mesh under the base VRM scene. This replaces the old
// procedural-primitive overlay that doubled up on Seed-san's built-in clothing
// and caused the mismatch the user reported.
//
// All URLs (base body, garments, animations) are routed through lib/asset.ts's
// asset() helper so they carry the deployment base path (/frankfabric/ in
// production).
//
// This component touches the DOM/WebGL (react-three-fiber <Canvas />) and is
// therefore imported by WardrobeBuilder.tsx via next/dynamic with
// { ssr: false } so it never runs during Next.js static generation.
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
  MToonMaterial,
  type VRM,
  type VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { asset } from "@/lib/asset";

export type Category = "outfit" | "bottom" | "shoes" | "hat";

// Which humanoid animation the avatar plays. "rest" means no clip is playing
// (the avatar stays in its idle rest pose while the scene auto-rotates); the
// others map to the retargeted FBX clips bundled in public/animations/.
export type WardrobeAnimation = "rest" | "idle" | "walking" | "waving";

// FBX animation clips (Mixamo-style humanoid rigs). Loaded client-side only via
// FBXLoader and retargeted onto the VRM humanoid — see retargetMixamoClip
// below. URLs are base-path-prefixed so they resolve under /frankfabric/ in
// production.
const ANIMATION_URLS: Record<Exclude<WardrobeAnimation, "rest">, string> = {
  idle: asset("/animations/idle.fbx"),
  walking: asset("/animations/walking.fbx"),
  waving: asset("/animations/waving.fbx"),
};

export type WardrobeSelection = Record<Category, number>;
export type WardrobeColors = Record<Category, string>;

// Option labels shown in the UI. Index 0 is always the "Base"/"None" option:
// selecting it mounts no garment for that category, so the base body shows
// through unclothed for that slot.
export const OPTIONS: Record<Category, string[]> = {
  outfit: ["Base", "Tank Top", "Shirt", "Hoodie"],
  bottom: ["Base", "Cargo Pants", "Casual Shorts", "Skirt"],
  shoes: ["None", "Sneakers", "Short Boots"],
  hat: ["None", "Short", "Ponytail"],
};

// The minimally-clothed modular base body. Base-path-prefixed so it resolves to
// /frankfabric/models/characters/drophunter/body.vrm in production and
// /models/characters/drophunter/body.vrm in dev. NEVER hardcode a bare
// "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/drophunter/body.vrm");

// Per-category, per-option-index map to the real garment VRM public paths.
// Index 0 is null (Base/None → no garment mounted). Every non-null path is
// routed through asset() so it carries the base path in production. The order
// of each array matches OPTIONS above exactly.
const GARMENT_URLS: Record<Category, (string | null)[]> = {
  outfit: [
    null,
    asset("/models/characters/drophunter/chest/tanktop.vrm"),
    asset("/models/characters/drophunter/chest/shirt.vrm"),
    asset("/models/characters/drophunter/chest/hoodie.vrm"),
  ],
  bottom: [
    null,
    asset("/models/characters/drophunter/legs/cargopants.vrm"),
    asset("/models/characters/drophunter/legs/casualshorts.vrm"),
    asset("/models/characters/drophunter/legs/skirt.vrm"),
  ],
  shoes: [
    null,
    asset("/models/characters/drophunter/feet/sneakers.vrm"),
    asset("/models/characters/drophunter/feet/shortboots.vrm"),
  ],
  hat: [
    null,
    asset("/models/characters/drophunter/head/short.vrm"),
    asset("/models/characters/drophunter/head/ponytail.vrm"),
  ],
};

type SceneProps = {
  selection: WardrobeSelection;
  colors: WardrobeColors;
  animation: WardrobeAnimation;
};

// ---------------------------------------------------------------------------
// Mixamo -> VRM animation retargeting.
//
// The bundled FBX clips are authored on a Mixamo-style humanoid whose bones are
// named "mixamorigHips", "mixamorigSpine", "mixamorigLeftUpLeg", etc. To play
// them on the VRM we follow the well-known three-vrm Mixamo remap pattern
// (https://github.com/pixiv/three-vrm examples): for each Mixamo bone we look
// up the corresponding VRM humanoid bone via
// vrm.humanoid.getNormalizedBoneNode(<VRMHumanBoneName>), rebuild the clip's
// rotation (quaternion) tracks so they target the normalized bone node names,
// scale the hips position track to the VRM's hip height, and drop any track
// whose bone doesn't map. The resulting clip drives a THREE.AnimationMixer.
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

// Build a VRM-compatible AnimationClip from a raw Mixamo FBX clip. Returns null
// if no tracks could be mapped (e.g. an unexpected rig), so callers can skip.
function retargetMixamoClip(
  asset3d: THREE.Group,
  clip: THREE.AnimationClip,
  vrm: VRM
): THREE.AnimationClip | null {
  const humanoid = vrm.humanoid;
  if (!humanoid) return null;

  const tracks: THREE.KeyframeTrack[] = [];

  // Restspace correction: Mixamo hips vs VRM hips height, so the root motion of
  // the hips position track is scaled into the VRM's proportions.
  const motionHipsNode = asset3d.getObjectByName("mixamorigHips");
  const vrmHipsNode = humanoid.getNormalizedBoneNode(
    "hips" as VRMHumanBoneName
  );
  const motionHipsHeight = motionHipsNode
    ? motionHipsNode.getWorldPosition(new THREE.Vector3()).y
    : 1;
  const vrmHipsHeight = vrmHipsNode
    ? vrmHipsNode.getWorldPosition(new THREE.Vector3()).y
    : 1;
  const hipsScale =
    motionHipsHeight > 1e-6 ? vrmHipsHeight / motionHipsHeight : 1;

  // NOTE: the rest-frame rotations below (restRotationInverse and
  // parentRestWorldRotation) are read from each FBX node's *current* world
  // orientation, i.e. the loaded group's frame-0 pose. This is the canonical
  // three-vrm retarget assumption: Mixamo clips ship with frame 0 == the bind
  // (T/rest) pose, so frame-0 orientation is the correct rest frame. If a
  // source clip's frame 0 ever deviated from bind pose, that offset would be
  // baked into the correction — but the bundled idle/walking/waving clips all
  // satisfy this, so no explicit bind-pose sampling is needed.
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();

  for (const track of clip.tracks) {
    // Track names look like "mixamorigLeftArm.quaternion".
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
      // Rebuild rotation into the VRM bone's rest frame.
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
      // Only the hips carry meaningful translation; scale it to the VRM rig.
      const posTrack = track as THREE.VectorKeyframeTrack;
      const values = Array.from(posTrack.values).map((v) => v * hipsScale);
      // VRM 1.0 avatars face +Z like Mixamo, so no axis flip is needed here.
      void _vec3;
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

// Apply a hex color to a material, covering both standard three materials and
// @pixiv/three-vrm's MToon materials (which expose their own `color` uniform).
function applyColor(material: THREE.Material, hex: string) {
  const color = new THREE.Color(hex);
  if (material instanceof MToonMaterial) {
    material.color.copy(color);
    material.needsUpdate = true;
    return;
  }
  const std = material as THREE.MeshStandardMaterial;
  if (std.color) {
    std.color.copy(color);
    std.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Garment transplant (CharacterStudio approach, MIT).
//
// A loaded garment VRM carries its own copy of the base skeleton. To make the
// garment deform with the ANIMATED base body we rebind each garment SkinnedMesh
// onto the base body's bone nodes (matched by name), then reparent the mesh
// under the base VRM scene. The garment's own scene graph/skeleton is discarded
// afterwards (deep-disposed), keeping only the transplanted meshes alive.
//
// Returns the transplanted meshes plus the cloned materials that may be tinted,
// so the caller can dispose them on change/unmount without touching the shared
// base skeleton bones.
// ---------------------------------------------------------------------------
type Transplant = {
  group: THREE.Group;
  materials: THREE.Material[];
};

function transplantGarment(garment: VRM, baseVrm: VRM): Transplant {
  // Build a lookup of the base body's bone nodes by name (walk once).
  const baseBonesByName = new Map<string, THREE.Object3D>();
  baseVrm.scene.traverse((obj) => {
    if (!baseBonesByName.has(obj.name)) baseBonesByName.set(obj.name, obj);
  });

  const group = new THREE.Group();
  group.name = "garment-transplant";
  const materials: THREE.Material[] = [];

  // Collect skinned meshes first (traverse while mutating parent is unsafe).
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  garment.scene.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) skinnedMeshes.push(sm);
  });

  for (const mesh of skinnedMeshes) {
    const srcSkeleton = mesh.skeleton;
    // For each garment skeleton bone, find the base-body node with the same
    // name; fall back to the original bone if no match exists.
    const newBones = srcSkeleton.bones.map(
      (bone) => (baseBonesByName.get(bone.name) as THREE.Bone) ?? bone
    );
    const newSkeleton = new THREE.Skeleton(newBones, srcSkeleton.boneInverses);

    // Clone materials so tinting a garment never bleeds into another VRM's
    // shared source material instances.
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

    // Rebind the mesh to the base body's skeleton, preserving its bind matrix.
    mesh.bind(newSkeleton, mesh.bindMatrix);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return { group, materials };
}

// A single garment category. Loads the selected garment VRM (client-side only)
// and transplants its skinned meshes onto the base body's skeleton. Mounts
// nothing when the option index is 0 (Base/None) so the base body shows through.
function Garment({
  baseVrm,
  url,
  color,
}: {
  baseVrm: VRM;
  url: string | null;
  color: string;
}) {
  // Rendered group + tintable materials for the currently-mounted garment.
  const mounted = useRef<Transplant | null>(null);
  // The garment VRM scene we must deep-dispose on change/unmount (its own
  // skeleton/graph — never the shared base skeleton bones).
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

      const transplant = transplantGarment(garment, baseVrm);
      baseVrm.scene.add(transplant.group);
      mounted.current = transplant;
      disposeScene.current = garment.scene;
    });

    return () => {
      cancelled = true;
      const t = mounted.current;
      if (t) {
        baseVrm.scene.remove(t.group);
        // Dispose transplanted mesh geometries + cloned materials only. The
        // bones are the shared base skeleton, so we must NOT dispose them.
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
  }, [baseVrm, url]);

  // Live-tint the mounted garment's materials from the category colour control.
  useEffect(() => {
    const t = mounted.current;
    if (!t) return;
    t.materials.forEach((mat) => applyColor(mat, color));
  }, [color, url]);

  return null;
}

function Avatar({ selection, colors, animation }: SceneProps) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register(
      (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
    );
  });

  const vrm = gltf.userData.vrm as VRM;

  // One-time rig prep: optimise the scene, orient the avatar to face the
  // camera, and disable frustum culling for reliable draws. The drophunter base
  // body is VRM 1.0 (already faces +Z), so no 180° flip is needed. We do NOT
  // call combineSkeletons here: transplanted garment meshes bind to the base
  // skeleton's individual bone nodes by name, so those nodes must stay intact.
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

  // Dispose GPU resources when the avatar unmounts (route changes) to avoid
  // leaks — VRMUtils.deepDispose walks the whole scene graph.
  useEffect(() => {
    return () => {
      VRMUtils.deepDispose(vrm.scene);
    };
  }, [vrm]);

  // --- Animation: load + retarget the Mixamo FBX clips -------------------
  //
  // useLoader with FBXLoader runs entirely client-side (this whole component
  // is loaded via next/dynamic { ssr:false }, so FBXLoader never executes
  // during static generation). Each raw FBX is retargeted onto the VRM
  // humanoid via retargetMixamoClip and driven by a single AnimationMixer.
  const idleFbx = useLoader(FBXLoader, ANIMATION_URLS.idle);
  const walkingFbx = useLoader(FBXLoader, ANIMATION_URLS.walking);
  const wavingFbx = useLoader(FBXLoader, ANIMATION_URLS.waving);

  // All mutable playback state (mixer + per-clip actions + the action that is
  // currently faded in) lives in a single ref that this component owns and
  // mutates. Keeping it in a ref — rather than in useMemo return values — keeps
  // the AnimationAction mutations (reset/fadeIn/play) off React-tracked values.
  const playback = useRef<{
    mixer: THREE.AnimationMixer;
    actions: Record<
      Exclude<WardrobeAnimation, "rest">,
      THREE.AnimationAction | null
    >;
  } | null>(null);
  // The action currently faded in (null at rest). Its own ref so the crossfade
  // effect only mutates `ref.current`, which is a permitted ref write.
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // (Re)build the mixer and retargeted actions whenever the avatar or a loaded
  // FBX changes. Retargeting maps each Mixamo clip onto the VRM humanoid bones.
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
        walking: build(walkingFbx),
        waving: build(wavingFbx),
      },
    };
    currentAction.current = null;
    return () => {
      mixer.stopAllAction();
      playback.current = null;
      currentAction.current = null;
    };
  }, [vrm, idleFbx, walkingFbx, wavingFbx]);

  // Crossfade to the requested clip when `animation` changes; "rest" fades all
  // actions out so the avatar returns to its rest pose.
  useEffect(() => {
    const state = playback.current;
    if (!state) return;
    const next = animation === "rest" ? null : state.actions[animation];
    const prev = currentAction.current;
    if (next === prev) return;

    const FADE = 0.35;
    if (next) {
      // reset() re-enables the action and zeroes its time/weight; fadeIn then
      // ramps its weight to 1 over FADE seconds as we play it.
      next.reset();
      next.setEffectiveWeight(1);
      next.fadeIn(FADE);
      next.play();
    }
    if (prev) {
      prev.fadeOut(FADE);
    }
    currentAction.current = next;
  }, [animation, idleFbx, walkingFbx, wavingFbx, vrm]);

  // CharacterStudio's per-frame update contract: advance the animation mixer
  // first (which poses the normalized humanoid bones), then vrm.update(delta)
  // so SpringBones/lookAt and the retargeted pose are both applied. Garments
  // transplanted onto the base skeleton follow automatically.
  useFrame((_, delta) => {
    playback.current?.mixer.update(delta);
    vrm.update(delta);
  });

  return (
    <group>
      <primitive object={vrm.scene} />

      {/* Real fitted garment VRMs, transplanted onto the base skeleton. Each
          category mounts nothing at option 0 (Base/None), so the base body
          shows through for that slot. */}
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.outfit[selection.outfit] ?? null}
        color={colors.outfit}
      />
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.bottom[selection.bottom] ?? null}
        color={colors.bottom}
      />
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.shoes[selection.shoes] ?? null}
        color={colors.shoes}
      />
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.hat[selection.hat] ?? null}
        color={colors.hat}
      />
    </group>
  );
}

export default function WardrobeScene({
  selection,
  colors,
  animation,
}: SceneProps) {
  // Keep the showroom turntable spinning at rest; hold still while a clip
  // plays so the motion reads clearly.
  const autoRotate = animation === "rest";
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 2.6], fov: 40 }}
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

      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          <Avatar selection={selection} colors={colors} animation={animation} />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={4}
        blur={2.2}
        far={2}
        color="#2c2a26"
      />

      <OrbitControls
        enablePan={false}
        minDistance={1.4}
        maxDistance={5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, 1.1, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
