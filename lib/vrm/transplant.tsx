"use client";

// ---------------------------------------------------------------------------
// Shared garment transplant (CharacterStudio approach, MIT).
//
// Extracted and unified from the (previously duplicated, drifted) copies in
// components/wardrobe/WardrobeScene.tsx and components/chef/ChefScene.tsx. This
// module is imported by client-only scenes and uses three.js, so it is marked
// "use client" (it also exports a React component, hence the .tsx extension).
//
// A loaded garment VRM carries its own copy of the base skeleton. To make the
// garment deform with the ANIMATED base body we rebind each garment SkinnedMesh
// onto the base body's bone nodes (matched by name), then reparent the mesh
// under the base VRM scene. The garment's own scene graph/skeleton is discarded
// afterwards (deep-disposed), keeping only the transplanted meshes alive.
//
// The unified API covers BOTH prior call sites without behavior change:
//  - wardrobe garments: preserveMaterials=false, a hex color always passed  => tinted
//  - wardrobe eyes:     preserveMaterials=true                              => untinted
//  - chef eyes/hair:    color=null                                          => untinted
//  - chef coat/pants:   a hex color                                         => tinted
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, MToonMaterial, type VRM } from "@pixiv/three-vrm";

// Apply a hex color to a material, covering both standard three materials and
// @pixiv/three-vrm's MToon materials (which expose their own `color` uniform).
// The drophunter garments render through MToonMaterial, so the MToon branch is
// what actually recolors the tinted garments.
export function applyColor(material: THREE.Material, hex: string) {
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

// The transplanted meshes plus the cloned materials that may be tinted, so the
// caller can dispose them on change/unmount without touching the shared base
// skeleton bones.
export type Transplant = {
  group: THREE.Group;
  materials: THREE.Material[];
};

export function transplantGarment(
  garment: VRM,
  baseVrm: VRM,
  options?: { color?: string | null; preserveMaterials?: boolean }
): Transplant {
  const color = options?.color ?? null;
  const preserveMaterials = options?.preserveMaterials ?? false;

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
    // name; fall back to the original bone if no match exists. A miss means the
    // garment rig diverges from the base rig, so the mesh would bind to a
    // detached bone and not follow the animation — surface it in development so
    // the mismatch is visible rather than silent.
    const newBones = srcSkeleton.bones.map((bone) => {
      const baseBone = baseBonesByName.get(bone.name) as THREE.Bone | undefined;
      if (!baseBone) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[vrm] garment bone "${bone.name}" has no match in the base ` +
              `body skeleton; the mesh will bind to a detached bone and will ` +
              `not follow the animated rig.`
          );
        }
        return bone;
      }
      return baseBone;
    });
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

  // Tint rule that unifies both call sites: preserveMaterials keeps the
  // VRM-authored materials verbatim (wardrobe eyes); otherwise a non-null color
  // string tints every cloned material on first paint (wardrobe garments + chef
  // coat/pants); a null/absent color leaves them untinted (chef eyes/hair).
  if (!preserveMaterials && color) {
    materials.forEach((mat) => applyColor(mat, color));
  }

  return { group, materials };
}

// A single garment category/trait. Loads the selected garment VRM (client-side
// only) and transplants its skinned meshes onto the base body's skeleton.
// Mounts nothing when `url` is null (Base/None) so the base body shows through.
export function Garment({
  baseVrm,
  url,
  color,
  preserveMaterials = false,
}: {
  baseVrm: VRM;
  url: string | null;
  color?: string | null;
  // When true, the transplanted VRM's authored materials are kept untinted
  // (used for the always-mounted eyes trait). Default false = normal garment.
  preserveMaterials?: boolean;
}) {
  // Rendered group + tintable materials for the currently-mounted garment.
  const mounted = useRef<Transplant | null>(null);
  // The garment VRM scene we must deep-dispose on change/unmount (its own
  // skeleton/graph — never the shared base skeleton bones).
  const disposeScene = useRef<THREE.Object3D | null>(null);
  // Latest requested colour, tracked in a ref so the async load callback can
  // apply the CURRENT tint even though the load effect below does not depend on
  // `color` (avoids re-loading the garment when only the colour changes). The
  // ref is synced in an effect (never during render) to satisfy react-hooks.
  const colorRef = useRef<string | null>(color ?? null);
  useEffect(() => {
    colorRef.current = color ?? null;
  }, [color]);

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

      // Apply the current colour during transplant so the garment renders in
      // its selected tint on first paint (fixes the initial-colour drop where
      // the tint effect ran before this async load populated mounted.current).
      const transplant = transplantGarment(garment, baseVrm, {
        color: colorRef.current,
        preserveMaterials,
      });
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
  }, [baseVrm, url, preserveMaterials]);

  // Live-tint the mounted garment's materials when the colour changes AFTER the
  // garment is already mounted. The initial tint is applied inside the load
  // callback above (via transplantGarment), so the early-return here on an
  // unpopulated mount.current no longer drops the first-paint colour. Skipped
  // entirely when preserveMaterials is set (the eyes keep their authored look)
  // or when no colour is provided (chef eyes/hair keep their authored look).
  useEffect(() => {
    if (preserveMaterials) return;
    if (!color) return;
    const t = mounted.current;
    if (!t) return;
    t.materials.forEach((mat) => applyColor(mat, color));
  }, [color, url, preserveMaterials]);

  return null;
}
