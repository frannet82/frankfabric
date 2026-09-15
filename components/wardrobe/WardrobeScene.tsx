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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import SceneLoader from "@/components/three/SceneLoader";
import {
  DEFAULT_QUALITY,
  qualitySettings,
  type Quality,
} from "@/components/three/quality";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
} from "@pixiv/three-vrm";
import { asset } from "@/lib/asset";
import { retargetMixamoClip } from "@/lib/vrm/retarget";
import { Garment } from "@/lib/vrm/transplant";
import {
  OPTIONS,
  type Category,
  type WardrobeAnimation,
  type WardrobeSelection,
  type WardrobeColors,
} from "@/components/wardrobe/wardrobeOptions";

// OPTIONS and the shared wardrobe types now live in the lightweight
// components/wardrobe/wardrobeOptions.ts module (NO three.js imports), so the
// control UI (WardrobeBuilder) can import them WITHOUT dragging this
// three.js-heavy scene module into the static page bundle. Re-export OPTIONS +
// the types here so any existing importer of this module keeps working.
export {
  OPTIONS,
  type Category,
  type WardrobeAnimation,
  type WardrobeSelection,
  type WardrobeColors,
};

// FBX animation clips (Mixamo-style humanoid rigs). Loaded client-side only via
// FBXLoader and retargeted onto the VRM humanoid — see retargetMixamoClip
// below. URLs are base-path-prefixed so they resolve under /frankfabric/ in
// production.
//
// These clips are loaded ON DEMAND — the same on-demand pattern the garments
// use (a garment VRM streams in only when its <Garment url=…> is selected).
// Each clip is fetched only once its animation has actually been requested by
// the current view: on cold load that is just the builder's default ("idle"),
// so walking.fbx (~0.37MB) + waving.fbx (~0.62MB) are NOT streamed until the
// user first selects them. This keeps the wardrobe cold load from eagerly
// pulling ~0.99MB of clips the initial view never plays, without changing the
// animation UX — the mixer/crossfade wiring below drives whichever clips have
// loaded, and switching among Rest/Idle/Walking/Waving still crossfades.
const ANIMATION_URLS: Record<Exclude<WardrobeAnimation, "rest">, string> = {
  idle: asset("/animations/idle.fbx"),
  walking: asset("/animations/walking.fbx"),
  waving: asset("/animations/waving.fbx"),
};

type ClipName = Exclude<WardrobeAnimation, "rest">;

// The minimally-clothed modular base body. Base-path-prefixed so it resolves to
// /frankfabric/models/characters/drophunter/body.vrm in production and
// /models/characters/drophunter/body.vrm in dev. NEVER hardcode a bare
// "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/drophunter/body.vrm");

// The eyes are a SEPARATE required trait of this modular avatar (the drophunter
// manifest lists requiredTraits=['body','eyes']). The base body VRM ships with
// empty eye sockets — without this mesh they render as black holes. We bundle
// the "Regular Eyes" VRM and transplant it onto the base skeleton UNCONDITIONALLY
// on load, using the same bone-rebind path garments use. It is NOT a
// user-selectable option, so it never appears in OPTIONS/GARMENT_URLS/THUMBNAILS.
// Routed through asset() so it resolves under /frankfabric/ in production.
const EYES_URL = asset("/models/characters/drophunter/eyes/regulareyes.vrm");

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
    asset("/models/characters/drophunter/chest/croptop.vrm"),
    asset("/models/characters/drophunter/chest/lightshirt.vrm"),
    asset("/models/characters/drophunter/chest/fulljacket.vrm"),
    asset("/models/characters/drophunter/chest/tuckedshirt.vrm"),
    asset("/models/characters/drophunter/chest/sweater.vrm"),
  ],
  bottom: [
    null,
    asset("/models/characters/drophunter/legs/cargopants.vrm"),
    asset("/models/characters/drophunter/legs/casualshorts.vrm"),
    asset("/models/characters/drophunter/legs/skirt.vrm"),
    asset("/models/characters/drophunter/legs/sportshorts.vrm"),
    asset("/models/characters/drophunter/legs/abovekneeshorts.vrm"),
    asset("/models/characters/drophunter/legs/waistshorts.vrm"),
    asset("/models/characters/drophunter/legs/doublebeltpants.vrm"),
  ],
  shoes: [
    null,
    asset("/models/characters/drophunter/feet/sneakers.vrm"),
    asset("/models/characters/drophunter/feet/shortboots.vrm"),
    asset("/models/characters/drophunter/feet/thinshoe.vrm"),
    asset("/models/characters/drophunter/feet/dressboots.vrm"),
    asset("/models/characters/drophunter/feet/tallboots.vrm"),
    asset("/models/characters/drophunter/feet/tennisshoes.vrm"),
    asset("/models/characters/drophunter/feet/hightop.vrm"),
  ],
  hat: [
    null,
    asset("/models/characters/drophunter/head/short.vrm"),
    asset("/models/characters/drophunter/head/ponytail.vrm"),
    asset("/models/characters/drophunter/head/curledbangs.vrm"),
    asset("/models/characters/drophunter/head/buns.vrm"),
    asset("/models/characters/drophunter/head/straight.vrm"),
    asset("/models/characters/drophunter/head/swept.vrm"),
    asset("/models/characters/drophunter/head/longspike.vrm"),
    asset("/models/characters/drophunter/head/dreds.vrm"),
  ],
};

type SceneProps = {
  selection: WardrobeSelection;
  colors: WardrobeColors;
  animation: WardrobeAnimation;
};

// Full scene props including the shared High/Fast render-quality tier
// (components/three/quality.ts). The tier gates Canvas shadows, dpr, shadow-map
// resolution, soft shadows and the heavier fill/bounce lights + backdrop depth.
type WardrobeSceneProps = SceneProps & {
  quality?: Quality;
};

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

  // --- Animation: load + retarget the Mixamo FBX clips ON DEMAND ---------
  //
  // The clips are loaded the same way garments are: only when they are
  // actually needed. Rather than eagerly useLoader-ing idle/walking/waving at
  // mount (~2.57MB), we mount a per-clip <ClipLoader> ONLY for clips that have
  // been requested. A clip is "requested" once its animation has been selected
  // — seeded with the initial `animation` prop so the builder's default
  // ("idle") loads on cold start, while walking/waving defer until the user
  // first picks them. Each ClipLoader suspends on its own FBX fetch, retargets
  // the clip, and hands it to registerClip which builds the AnimationAction on
  // the shared mixer; the crossfade then drives whichever actions exist.

  // The single AnimationMixer that drives every clip. Built by useMemo and used
  // as a RETURNED VALUE — not written into a ref during render — so it exists
  // before ANY child effect runs. Child (ClipLoader) effects fire before parent
  // effects on the same commit, so building the mixer in a parent effect would
  // leave it null when a clip first tries to register (the bug that left the
  // avatar stuck in its T-pose). Rebuilt when the avatar (`vrm`) changes.
  const mixer = useMemo(() => new THREE.AnimationMixer(vrm.scene), [vrm]);
  // Per-clip retargeted actions, filled in as each ClipLoader loads its clip.
  // Held in a ref because it is mutated only from callbacks/effects (never
  // during render) and must not itself trigger re-renders. Rebuilt whenever the
  // mixer is rebuilt (see the effect below).
  const actions = useRef<Record<ClipName, THREE.AnimationAction | null>>({
    idle: null,
    walking: null,
    waving: null,
  });
  // The action currently faded in (null at rest). A ref so the crossfade
  // callback only mutates `ref.current`, which is a permitted ref write.
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // Which clips have been requested so far (so their <ClipLoader> is mounted
  // and their FBX fetched). Seeded from the initial animation: "rest" needs no
  // clip, anything else needs its own clip on cold load. This is the on-demand
  // gate — walking/waving are absent from this set until first selected.
  const [requested, setRequested] = useState<Set<ClipName>>(() =>
    animation === "rest" ? new Set() : new Set<ClipName>([animation])
  );

  // When the selected animation changes to a clip we have not requested yet,
  // add it so its ClipLoader mounts and streams the FBX in on demand. This is
  // the React "adjust state while rendering" pattern (not a setState-in-effect
  // cascade): the extra render happens before the browser paints, so the new
  // ClipLoader mounts in the same commit that reflects the selection.
  if (animation !== "rest" && !requested.has(animation)) {
    setRequested(new Set(requested).add(animation));
  }

  // Stop the mixer's actions when it is torn down (avatar change/unmount). We
  // do NOT clear `actions.current` here: on a rig rebuild each ClipLoader's
  // effect re-runs (it depends on `vrm`) and re-registers its clip against the
  // new mixer, overwriting the stale entry — clearing here would instead race
  // ahead of those child effects (child effects run before parent effects) and
  // wipe a just-registered clip, stranding the avatar in its T-pose.
  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      currentAction.current = null;
    };
  }, [mixer]);

  // Crossfade to the requested clip: fade the current action out and the target
  // in. Called both when `animation` changes AND when a just-loaded clip
  // registers its action (a clip selected before its FBX finished loading still
  // starts playing the moment it becomes available). "rest" fades everything
  // out so the avatar returns to its rest pose.
  const applyCrossfade = useCallback(() => {
    const next = animation === "rest" ? null : actions.current[animation];
    // If the requested clip has not loaded/registered yet, wait — the
    // ClipLoader will call this again once its action exists.
    if (animation !== "rest" && !next) return;
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
  }, [animation]);

  // Called by each ClipLoader once its retargeted clip is ready. The action is
  // built HERE from the shared mixer (the same mixer useFrame advances), so all
  // clips play on one timeline and crossfades between them work. Passing the
  // retargeted clip (not a pre-built action) keeps the single-mixer invariant.
  // Then re-evaluate the crossfade in case this is the clip currently awaited.
  const registerClip = useCallback(
    (name: ClipName, clip: THREE.AnimationClip | null) => {
      actions.current[name] = clip ? mixer.clipAction(clip) : null;
      applyCrossfade();
    },
    [applyCrossfade, mixer]
  );

  // Re-run the crossfade when the selected animation changes.
  useEffect(() => {
    applyCrossfade();
  }, [applyCrossfade]);

  // CharacterStudio's per-frame update contract: advance the animation mixer
  // first (which poses the normalized humanoid bones), then vrm.update(delta)
  // so SpringBones/lookAt and the retargeted pose are both applied. Garments
  // transplanted onto the base skeleton follow automatically.
  useFrame((_, delta) => {
    mixer.update(delta);
    vrm.update(delta);
  });

  return (
    <group>
      <primitive object={vrm.scene} />

      {/* On-demand animation clip loaders. One mounts per requested clip; each
          suspends on its own FBX fetch, retargets it against this VRM, and
          registers the resulting clip into the shared mixer. Unrequested clips
          (walking/waving on cold load) render nothing, so their FBX is never
          fetched — mirroring the garment on-demand load pattern.

          Each loader gets its OWN <Suspense fallback={null}> so streaming a
          newly-selected clip mid-session does NOT blank the already-rendered
          avatar behind the scene-level SceneLoader: the avatar keeps playing
          its current pose and the new clip simply crossfades in once ready. */}
      {(["idle", "walking", "waving"] as ClipName[])
        .filter((name) => requested.has(name))
        .map((name) => (
          <Suspense key={name} fallback={null}>
            <ClipLoader name={name} vrm={vrm} register={registerClip} />
          </Suspense>
        ))}

      {/* Required eyes trait. The base body ships with empty eye sockets (the
          "black hole" bug); this transplants the authored "Regular Eyes" mesh
          onto the base skeleton ALWAYS, independent of any selection. It is not
          a user-selectable option. preserveMaterials keeps the VRM's authored
          irises/whites so the eyes render naturally rather than a flat tint. */}
      <Garment
        baseVrm={vrm}
        url={EYES_URL}
        color="#000000"
        preserveMaterials
      />

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

// Loads a SINGLE Mixamo FBX clip on demand and registers its retargeted
// AnimationAction with the parent Avatar's shared mixer. This component
// suspends (via useLoader) until its own FBX has streamed in, so mounting it is
// what triggers the network fetch — exactly the on-demand pattern the garment
// <Garment> components use. It renders no scene objects; it exists only to own
// one clip's load + retarget lifecycle.
function ClipLoader({
  name,
  vrm,
  register,
}: {
  name: ClipName;
  vrm: VRM;
  register: (name: ClipName, clip: THREE.AnimationClip | null) => void;
}) {
  // useLoader with FBXLoader runs entirely client-side (this whole component is
  // loaded via next/dynamic { ssr:false }, so FBXLoader never executes during
  // static generation) and suspends until the FBX is fetched.
  const fbx = useLoader(FBXLoader, ANIMATION_URLS[name]);

  useEffect(() => {
    const raw = fbx.animations?.[0];
    const clip = raw ? retargetMixamoClip(fbx, raw, vrm) : null;
    // Hand the retargeted clip to the parent, which builds the action from the
    // shared mixer so all clips play on one timeline and crossfades work.
    register(name, clip);
    return () => {
      register(name, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbx, vrm, name]);

  return null;
}

// A subtle floor + backdrop for depth. The wardrobe previously set only a flat
// #efede8 background + ContactShadows, so the avatar read as floating on a flat
// card. This adds a matte ground disc at y=0 (the ContactShadows plane) with a
// soft radial vignette baked into a small in-memory canvas texture (no external
// asset, nothing added to the cold-load budget), fading out at the rim so it
// dissolves into the flat background instead of ending on a hard line. Gated to
// High; on Fast the avatar keeps only its ContactShadows over the flat bg,
// exactly like today.
function GroundBackdrop() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.06,
        size / 2,
        size / 2,
        size / 2
      );
      // Warm atelier neutral, slightly darker than the #efede8 background at the
      // center so the floor reads with depth, fading to transparent at the rim.
      grad.addColorStop(0, "rgba(224,220,210,1)");
      grad.addColorStop(0.6, "rgba(214,209,198,1)");
      grad.addColorStop(1, "rgba(214,209,198,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
      <circleGeometry args={[5, 64]} />
      <meshStandardMaterial
        map={texture}
        transparent
        roughness={0.96}
        metalness={0}
      />
    </mesh>
  );
}

export default function WardrobeScene({
  selection,
  colors,
  animation,
  quality = DEFAULT_QUALITY,
}: WardrobeSceneProps) {
  // Keep the showroom turntable spinning at rest; hold still while a clip
  // plays so the motion reads clearly.
  const autoRotate = animation === "rest";
  const q = qualitySettings(quality);
  const isHigh = quality === "high";
  return (
    <Canvas
      shadows={q.shadows}
      dpr={q.dpr}
      camera={{ position: [0, 1.35, 2.6], fov: 40 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        // Tone mapping unchanged (ACESFilmic). The key intensity below is kept
        // at today's ~1.4 and the whole rig stays near-neutral, so the VRM's
        // skin/face does NOT clip to white under High — verified by spot-check
        // (see FEAT-002 findings). Per CONSTRAINT #2, changing the operator
        // would require a per-scene before/after screenshot proving it fixes a
        // blow-out; there is no blow-out to fix, so ACESFilmic stays.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <color attach="background" args={["#efede8"]} />

      {/* NOTE: drei <SoftShadows> is deliberately NOT used here. It rewrites the
          global shadow-map shader chunk, which collides with the VRM's custom
          MToon "Face" ShaderMaterial and throws a "vogelDiskSample function
          already has a body" fragment-shader compile error, breaking the
          avatar. We soften shadow edges the plan's alternative way instead: a
          higher shadow-map resolution on High plus tuned ContactShadows blur. */}

      {/* Proper key/fill/bounce rig, kept near-neutral so the VRM skin keeps
          true color. Only the key casts shadows. */}
      <ambientLight intensity={0.6} />
      {/* KEY: front-right, high; the only shadow caster. Intensity held at
          today's 1.4 so skin does not blow out; shadow-map res scales with
          quality (High above today's 1024). */}
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.4}
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0009}
      />
      {/* FILL: softer, from the opposite side, to open the shadow side. */}
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      {/* Sky-to-ground bounce. */}
      <hemisphereLight args={["#ffffff", "#cbc7bd", 0.5]} />
      {/* RIM / back-bounce (High only): subtle separation from the backdrop. */}
      {isHigh ? (
        <pointLight
          position={[-2, 3, -3]}
          intensity={0.45}
          color="#ffffff"
          distance={10}
          decay={1.6}
        />
      ) : null}

      <Suspense fallback={<SceneLoader />}>
        <group position={[0, 0, 0]}>
          <Avatar selection={selection} colors={colors} animation={animation} />
        </group>
        {/* Floor/backdrop for depth — High only. */}
        {isHigh ? <GroundBackdrop /> : null}
      </Suspense>

      {/* Kept ContactShadows so the avatar never floats; softened blur on High. */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={4}
        blur={isHigh ? 2.8 : 2.2}
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
