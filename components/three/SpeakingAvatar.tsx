"use client";

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { asset } from '@/lib/asset';
import { transplantGarment } from '@/lib/vrm/transplant';
import SceneLoader from './SceneLoader';
import { exercisePose, type Exercise } from '@/lib/coach/exercises';
import { Html } from '@react-three/drei';

type Props = { exercise?: Exercise; paused?: boolean; speaking?: boolean; getLoudness?: () => number; reducedMotion?: boolean };
const ROOT = '/models/characters/drophunter/';

/** Each mounted character owns its VRM, so portfolio previews cannot share a skeleton. */
export default function SpeakingAvatar({ exercise = 'rest', paused = false, speaking = false, getLoudness, reducedMotion = false }: Props) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [failed, setFailed] = useState(false);
  const rigRef = useRef<VRM | null>(null);
  const motionRef = useRef(exercisePose("rest", 0));
  const mouth = useRef(0);
  const exerciseTime = useRef(0);
  const exerciseWeight = useRef(0);
  const originY = useRef(0);
  useEffect(() => { exerciseTime.current = 0; }, [exercise]);
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
      originY.current = body.scene.position.y;
      rigRef.current = body;
      setVrm(body);
    }).catch(error => { if (!cancelled) { console.error('Character loading failed', error); setFailed(true); } });
    return () => { rigRef.current = null; cancelled = true; owned.forEach(model => VRMUtils.deepDispose(model.scene)); };
  }, []);

  useFrame(({ clock }, delta) => {
    const vrm = rigRef.current;
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
    // Demos are explicitly started by the user; Pause also works with reduced motion.
    if (!paused) exerciseTime.current += Math.min(delta, 0.05);
    exerciseWeight.current = THREE.MathUtils.damp(exerciseWeight.current, exercise === 'rest' ? 0 : 1, 5, delta);
    const targetMotion = exercisePose(exercise, exerciseTime.current);
    const motion = motionRef.current;
    for (const key of Object.keys(motion) as (keyof typeof motion)[]) {
      motion[key] = THREE.MathUtils.damp(motion[key], targetMotion[key], 12, delta);
    }
    const w = exerciseWeight.current;
    pose.getNormalizedBoneNode('leftUpperLeg')?.rotation.set(motion.leftThigh * w, 0, motion.spread * w);
    pose.getNormalizedBoneNode('rightUpperLeg')?.rotation.set(motion.rightThigh * w, 0, -motion.spread * w);
    pose.getNormalizedBoneNode('leftLowerLeg')?.rotation.set(motion.leftKnee * w, 0, 0);
    pose.getNormalizedBoneNode('rightLowerLeg')?.rotation.set(motion.rightKnee * w, 0, 0);
    pose.getNormalizedBoneNode('leftFoot')?.rotation.set(motion.ankle * w, 0, -motion.spread * w);
    pose.getNormalizedBoneNode('rightFoot')?.rotation.set(motion.ankle * w, 0, motion.spread * w);
    if (exercise !== 'rest') {
      pose.getNormalizedBoneNode('leftUpperArm')?.rotation.set(motion.leftSwing, 0, -1.3 + motion.armRaise);
      pose.getNormalizedBoneNode('rightUpperArm')?.rotation.set(motion.rightSwing, 0, 1.3 - motion.armRaise);
      pose.getNormalizedBoneNode('leftLowerArm')?.rotation.set(-0.25, 0, 0);
      pose.getNormalizedBoneNode('rightLowerArm')?.rotation.set(-0.25, 0, 0);
      pose.getNormalizedBoneNode('chest')?.rotation.set(motion.lean, 0, 0);
      pose.getNormalizedBoneNode('head')?.rotation.set(-motion.lean * 0.5, 0, 0);
    }
    vrm.scene.position.y = originY.current - motion.hipDrop * w + motion.hop * w;
    vrm.update(Math.min(delta, 0.05));
  });
  if (!vrm) return failed ? <Html center><p role="alert" className="rounded-xl bg-white p-4 text-sm text-gray-800">The character could not load. Reload the page to try again. You can still use the chat.</p></Html> : <SceneLoader />;
  return <primitive object={vrm.scene} />;
}
