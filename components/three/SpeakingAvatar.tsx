"use client";

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { asset } from '@/lib/asset';
import { transplantGarment } from '@/lib/vrm/transplant';
import SceneLoader from './SceneLoader';
import { Html } from '@react-three/drei';

type Props = { speaking?: boolean; getLoudness?: () => number; reducedMotion?: boolean };
const ROOT = '/models/characters/drophunter/';

/** Each mounted character owns its VRM, so portfolio previews cannot share a skeleton. */
export default function SpeakingAvatar({ speaking = false, getLoudness, reducedMotion = false }: Props) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [failed, setFailed] = useState(false);
  const mouth = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const owned: VRM[] = [];
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const load = async (path: string) => {
      const gltf = await loader.loadAsync(asset(ROOT + path));
      const model = gltf.userData.vrm as VRM;
      if (cancelled) { VRMUtils.deepDispose(model.scene); throw new Error('cancelled'); }
      owned.push(model);
      return model;
    };
    const outfit = [['chest/tanktop.vrm', '#617c63'], ['legs/sportshorts.vrm', '#282d31']];
    const pieces = [...outfit, ['head/short.vrm', '#392b24'], ['eyes/regulareyes.vrm', ''], ['feet/tennisshoes.vrm', '#e9e7e0']];
    Promise.all([load('body.vrm'), ...pieces.map(([path]) => load(path))]).then(([body, ...garments]) => {
      if (cancelled) return;
      garments.forEach((garment, i) => {
        body.scene.add(transplantGarment(garment, body, { color: pieces[i][1] || null, preserveMaterials: !pieces[i][1] }).group);
      });
      body.scene.traverse(obj => { obj.frustumCulled = false; if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      body.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(body.scene);
      const scale = 1.7 / (box.max.y - box.min.y);
      body.scene.scale.setScalar(scale);
      body.scene.position.y = -box.min.y * scale;
      setVrm(body);
    }).catch(error => { if (!cancelled) { console.error('Character loading failed', error); setFailed(true); } });
    return () => { cancelled = true; owned.forEach(model => VRMUtils.deepDispose(model.scene)); };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!vrm) return;
    const t = clock.elapsedTime;
    const target = speaking ? (getLoudness ? getLoudness() : Math.max(0, Math.sin(t * 18)) * 0.7) : 0;
    mouth.current = THREE.MathUtils.damp(mouth.current, target, 22, delta);
    vrm.expressionManager?.setValue('aa', mouth.current * 0.85);
    vrm.expressionManager?.setValue('oh', mouth.current * (0.15 + 0.12 * Math.sin(t * 6)));
    vrm.expressionManager?.setValue('ee', mouth.current * (0.12 + 0.10 * Math.sin(t * 9)));
    vrm.expressionManager?.setValue('happy', 0.12);
    const blinkPhase = t % 4.7;
    vrm.expressionManager?.setValue('blink', reducedMotion ? 0 : Math.max(0, 1 - Math.abs(blinkPhase - 0.12) / 0.10));
    const gesture = reducedMotion ? 0 : (speaking ? 0.10 : 0.018);
    const pose = vrm.humanoid;
    pose.getNormalizedBoneNode('leftUpperArm')?.rotation.set(0, 0, -1.16 + gesture * Math.sin(t * 2.1));
    pose.getNormalizedBoneNode('rightUpperArm')?.rotation.set(0, 0, 1.16 + gesture * Math.sin(t * 1.7 + 1));
    pose.getNormalizedBoneNode('leftLowerArm')?.rotation.set(-0.18 - gesture * 1.5 * (0.5 + 0.5 * Math.sin(t * 2)), 0, 0);
    pose.getNormalizedBoneNode('rightLowerArm')?.rotation.set(-0.18 - gesture * 1.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + 2)), 0, 0);
    pose.getNormalizedBoneNode('head')?.rotation.set(gesture * 0.18 * Math.sin(t * 2), gesture * 0.3 * Math.sin(t * 0.8), 0);
    pose.getNormalizedBoneNode('chest')?.rotation.set(reducedMotion ? 0 : 0.008 * Math.sin(t * 1.8), 0, 0);
    vrm.update(Math.min(delta, 0.05));
  });
  if (!vrm) return failed ? <Html center><p role="alert" className="rounded-xl bg-white p-4 text-sm text-gray-800">The character could not load. Reload the page to try again. You can still use the chat.</p></Html> : <SceneLoader />;
  return <primitive object={vrm.scene} />;
}
