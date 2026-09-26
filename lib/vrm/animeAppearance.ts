import * as THREE from 'three';

/** A shared skin shader keeps face and body on the same palette. Authored dark
 * features survive, while pink baked blush cannot create a mismatched face. */
export function prepareAnimeSkin(root: THREE.Object3D, skin: string, lips: string) {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const candidate of materials) {
      const material = candidate as THREE.MeshStandardMaterial;
      if (!['skin', 'Face'].includes(material.name) || !material.isMeshStandardMaterial) continue;
      const face = material.name === 'Face';
      material.color.set(skin);
      material.roughness = 0.88;
      material.onBeforeCompile = shader => {
        shader.uniforms.lipColor = { value: new THREE.Color(lips) };
        shader.fragmentShader = 'uniform vec3 lipColor;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 authored = texture2D(map, vMapUv);
            float ink = smoothstep(0.08, 0.30, authored.r);
            float shade = mix(authored.r, 0.90 + 0.10 * authored.r, ink);
            diffuseColor.rgb *= shade;
            diffuseColor.a *= authored.a;
            ${face ? `
            vec2 lipUV = (vMapUv - vec2(0.5, 0.502)) / vec2(0.039, 0.010);
            float lipstick = (1.0 - smoothstep(0.65, 1.0, dot(lipUV, lipUV))) * ink;
            diffuseColor.rgb = mix(diffuseColor.rgb, lipColor * shade, lipstick * 0.78);
            ` : ''}
          #endif
        `);
      };
      material.customProgramCacheKey = () => `anime-skin-${face}-${skin}-${lips}`;
      material.needsUpdate = true;
    }
  });
}

/** Preserve the original sculpted locks and highlights without the red source tint. */
export function prepareAnimeHair(root: THREE.Object3D) {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 authoredHair = texture2D(map, vMapUv);
            float strand = dot(authoredHair.rgb, vec3(0.30, 0.45, 0.25));
            diffuseColor.rgb *= 0.45 + 0.55 * strand;
            diffuseColor.a *= authoredHair.a;
          #endif
        `);
      };
      material.customProgramCacheKey = () => 'anime-hair-neutral-strands-v1';
      material.needsUpdate = true;
    }
  });
}
