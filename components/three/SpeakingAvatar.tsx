"use client";

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { asset } from '@/lib/asset';
import { transplantGarment } from '@/lib/vrm/transplant';
import SceneLoader from './SceneLoader';
import { prepareAnimeSkin, prepareAnimeHair } from '@/lib/vrm/animeAppearance';
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
      const gltf = await loader.loadAsync(asset(path.startsWith("/") ? path : ROOT + path));
      const model = gltf.userData.vrm as VRM;
      if (cancelled) { VRMUtils.deepDispose(model.scene); throw new Error('cancelled'); }
      owned.push(model);
      return model;
    };
    const outfit = [['chest/tanktop.vrm', '#617c63'], ['legs/sportshorts.vrm', '#282d31']];
    const pieces = [...outfit, ['/models/coach-reference/waves.vrm', '#39302e'], ['/models/coach-reference/eyes.vrm', ''], ['feet/tennisshoes.vrm', '#e9e7e0']];
    Promise.all([load('/models/coach-reference/body.vrm'), ...pieces.map(([path]) => load(path))]).then(([body, ...garments]) => {
      if (cancelled) return;
      prepareAnimeSkin(body.scene, "#ad754e", "#984957");
      garments.forEach((garment, i) => {
        const transplanted = transplantGarment(garment, body, { color: pieces[i][1] || null, preserveMaterials: !pieces[i][1] });
        if (pieces[i][0].endsWith('/waves.vrm')) prepareAnimeHair(transplanted.group);
        if (pieces[i][0].endsWith('/eyes.vrm')) {
          for (const material of transplanted.materials) {
            material.onBeforeCompile = shader => {
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #include <map_fragment>
                float iris = smoothstep(0.02, 0.12, diffuseColor.g - diffuseColor.r);
                float value = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                diffuseColor.rgb = mix(diffuseColor.rgb, value * vec3(0.15, 0.085, 0.048), iris);
              `);
            };
            material.customProgramCacheKey = () => 'coach-dark-brown-eyes-v1';
            material.needsUpdate = true;
          }
        }
        body.scene.add(transplanted.group);
      });
      body.scene.traverse(obj => { obj.frustumCulled = false; if (obj instanceof THREE.Mesh) { obj.geometry.computeVertexNormals(); obj.castShadow = true; obj.receiveShadow = true; } });
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
    vrm.expressionManager?.setValue('happy', speaking ? 0.12 : 0.28);
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
    // Bend around the normalized arms' local Y axes, mirrored left/right.
    // Local X runs along the arm, so rotating X alone only twists the forearm.
    if (exercise === 'curl' || motion.elbowCurl > 0.01) {
      pose.getNormalizedBoneNode('leftLowerArm')?.rotation.set(0, -motion.elbowCurl, 0);
      pose.getNormalizedBoneNode('rightLowerArm')?.rotation.set(0, motion.elbowCurl, 0);
    }
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      pose.getNormalizedBoneNode(`${side}Hand`)?.rotation.set(sign * motion.grip * 1.15, 0, 0);
      for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
        for (const segment of ['Proximal', 'Intermediate', 'Distal'] as const) {
          pose.getNormalizedBoneNode(`${side}${finger}${segment}` as VRMHumanBoneName)?.rotation.set(0, 0, sign * motion.grip * (segment === 'Proximal' ? 0.85 : 1.1));
        }
      }
      pose.getNormalizedBoneNode(`${side}ThumbProximal`)?.rotation.set(0, sign * motion.grip * 0.55, sign * motion.grip * 0.25);
    }
    vrm.scene.position.y = originY.current - motion.hipDrop * w + motion.hop * w;
    vrm.update(Math.min(delta, 0.05));
  });
  if (!vrm) return failed ? <Html center><p role="alert" className="rounded-xl bg-white p-4 text-sm text-gray-800">The character could not load. Reload the page to try again. You can still use the chat.</p></Html> : <SceneLoader />;
  return <primitive object={vrm.scene} />;
}
