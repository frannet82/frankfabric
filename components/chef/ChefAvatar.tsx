"use client";
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { asset } from '@/lib/asset';

type Props = { speaking?: boolean; getLoudness?: () => number; reducedMotion?: boolean };
export default function ChefAvatar({ speaking = false, getLoudness, reducedMotion = false }: Props) {
  const source = useLoader(FBXLoader, asset('/models/characters/swedish-chef/swedish-chef.fbx'));
  const texture = useLoader(THREE.TextureLoader, asset('/models/characters/swedish-chef/swedish_chef_diff.jpg'));
  const model = useMemo(() => {
    const root = clone(source);
    const map = texture.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
    root.traverse(obj => {
      obj.frustumCulled = false;
      if (obj instanceof THREE.Mesh) { obj.material = material; obj.castShadow = true; obj.receiveShadow = true; }
    });
    root.scale.setScalar(0.001);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -bounds.min.y, -center.z);
    const bones = ['Bip001_Jaw', 'Bip001_Head', 'Bip001_L_UpperArm', 'Bip001_R_UpperArm', 'Bip001_L_Forearm', 'Bip001_R_Forearm'].map(name => {
      const bone = root.getObjectByName(name);
      return { bone, rest: bone?.rotation.clone() };
    });
    return { root, map, material, bones };
  }, [source, texture]);
  const bonesRef = useRef(model.bones);
  useEffect(() => { bonesRef.current = model.bones; }, [model]);
  const openness = useRef(0);
  const gesture = useRef(0);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const target = speaking ? (getLoudness ? getLoudness() : Math.max(0, Math.sin(t * 18)) * 0.8) : 0;
    openness.current = THREE.MathUtils.damp(openness.current, target, 22, delta);
    gesture.current = THREE.MathUtils.damp(gesture.current, speaking && !reducedMotion ? 1 : 0, 5, delta);
    const [jaw, head, left, right, leftForearm, rightForearm] = bonesRef.current;
    for (const item of bonesRef.current) if (item.bone && item.rest) item.bone.rotation.copy(item.rest);
    // The local X axis is the horizontal hinge; 272 skin vertices follow this bone.
    if (jaw.bone) jaw.bone.rotation.x += openness.current * 0.55;
    const g = gesture.current;
    if (head.bone && !reducedMotion) {
      head.bone.rotation.y += 0.025 * Math.sin(t * 0.85);
      head.bone.rotation.x += g * 0.025 * Math.sin(t * 2.2);
    }
    if (left.bone) left.bone.rotation.x += -0.85 + g * 0.12 * Math.sin(t * 1.6);
    if (right.bone) right.bone.rotation.x += -0.85 + g * 0.15 * Math.sin(t * 1.4 + 1.5);
    if (leftForearm.bone) leftForearm.bone.rotation.x += g * 0.24 * (0.5 + 0.5 * Math.sin(t * 1.7));
    if (rightForearm.bone) rightForearm.bone.rotation.x += g * 0.27 * (0.5 + 0.5 * Math.sin(t * 1.5 + 2));
  });
  useEffect(() => () => { model.material.dispose(); model.map.dispose(); }, [model]);
  return <primitive object={model.root} />;
}
