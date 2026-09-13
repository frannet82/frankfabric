"use client";

// ---------------------------------------------------------------------------
// Shared Mixamo -> VRM animation retargeting.
//
// Extracted verbatim from the (previously duplicated) copies in
// components/wardrobe/WardrobeScene.tsx and components/chef/ChefScene.tsx so
// both scenes share a single implementation. This module is imported by
// client-only scenes (react-three-fiber <Canvas />, imported via next/dynamic
// { ssr:false }) and uses three.js, so it is marked "use client".
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

import * as THREE from "three";
import { type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";

export const MIXAMO_TO_VRM_BONE: Record<string, VRMHumanBoneName> = {
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
export function retargetMixamoClip(
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
