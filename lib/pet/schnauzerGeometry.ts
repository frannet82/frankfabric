import * as THREE from 'three';
export type Vec3 = [number, number, number];
export type CoatShape = 'oval' | 'skull' | 'beard' | 'leg';

export function coatGeometry(size: Vec3, shape: CoatShape = 'oval') {
  const geometry = new THREE.SphereGeometry(1, 40, 28);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i), z = positions.getZ(i);
    const y = positions.getY(i);
    const uneven = 1 + 0.009 * Math.sin(x * 31 + y * 19) * Math.sin(z * 27 - y * 13);
    if (shape === 'skull') { x = Math.sign(x) * Math.pow(Math.abs(x), 0.86); z = Math.sign(z) * Math.pow(Math.abs(z), 0.92); }
    if (shape === 'beard') x *= 0.86 + 0.14 * (y + 1) / 2;
    if (shape === 'leg') { x *= 1.05 - y * 0.08; z *= 1.05 - y * 0.08; }
    positions.setXYZ(i, x * size[0] * uneven, y * size[1] * uneven, z * size[2] * uneven);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function foldedEarGeometry(side: number) {
  const outline = new THREE.Shape();
  outline.moveTo(0, 0);
  outline.bezierCurveTo(0.045, 0.045, 0.11, 0.035, 0.165, -0.018);
  outline.bezierCurveTo(0.16, -0.065, 0.115, -0.19, 0.084, -0.205);
  outline.bezierCurveTo(0.062, -0.18, 0.018, -0.055, 0, 0);
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.012, bevelEnabled: true, bevelSize: 0.007, bevelThickness: 0.007, bevelSegments: 3, steps: 1, curveSegments: 12 });
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    position.setXYZ(i, x * side, y, position.getZ(i) + Math.max(0, -y) * 0.6);
  }
  // Mirroring positions reverses winding; reverse triangle winding to keep outward-facing normals.
  if (side < 0) {
    const index = geometry.index;
    if (index) for (let i = 0; i < index.count; i += 3) { const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a); }
    else {
      for (let i = 0; i < position.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(position, i);
        const b = new THREE.Vector3().fromBufferAttribute(position, i + 2);
        position.setXYZ(i, b.x, b.y, b.z); position.setXYZ(i + 2, a.x, a.y, a.z);
      }
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic, tapered three-segment strands, batched into one mesh per body part.
 * Surface-area sampling avoids bald poles. Groom direction is projected onto the
 * surface, so the beard hangs down rather than radiating out like spikes.
 */
export function furGeometry(surface: THREE.BufferGeometry, count: number, length: number, flow: Vec3, seed: number, maskEyes = false) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const source = surface.index ? surface.toNonIndexed() : surface.clone();
  const vertices = source.getAttribute('position'), normals = source.getAttribute('normal');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edge = new THREE.Vector3(), cross = new THREE.Vector3();
  const cumulative: number[] = [];
  let total = 0;
  for (let i = 0; i < vertices.count; i += 3) {
    a.fromBufferAttribute(vertices, i); b.fromBufferAttribute(vertices, i + 1); c.fromBufferAttribute(vertices, i + 2);
    total += edge.subVectors(b, a).cross(cross.subVectors(c, a)).length() / 2;
    cumulative.push(total);
  }
  const positions: number[] = [], colors: number[] = [];
  const p = new THREE.Vector3(), normal = new THREE.Vector3(), groom = new THREE.Vector3(), sideways = new THREE.Vector3();
  const normalB = new THREE.Vector3(), normalC = new THREE.Vector3();
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const emit = (point: THREE.Vector3, offset: number, shade: number) => { positions.push(point.x + sideways.x * offset, point.y + sideways.y * offset, point.z + sideways.z * offset); colors.push(shade, shade * 0.995, shade * 0.975); };
  for (let hair = 0; hair < count; hair++) {
    const area = random() * total;
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (cumulative[mid] < area) lo = mid + 1; else hi = mid; }
    const i = lo * 3;
    const u = Math.sqrt(random()), v = random();
    const wa = 1 - u, wb = u * (1 - v), wc = u * v;
    a.fromBufferAttribute(vertices, i); b.fromBufferAttribute(vertices, i + 1); c.fromBufferAttribute(vertices, i + 2);
    p.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
    if (maskEyes && p.z > 0.11 && p.y > 0.005 && p.y < 0.115 && Math.abs(Math.abs(p.x) - 0.095) < 0.043) continue;
    normal.fromBufferAttribute(normals, i).multiplyScalar(wa).addScaledVector(normalB.fromBufferAttribute(normals, i + 1), wb).addScaledVector(normalC.fromBufferAttribute(normals, i + 2), wc).normalize();
    groom.set(...flow).addScaledVector(normal, -normal.dot(new THREE.Vector3(...flow)));
    if (groom.lengthSq() < 0.001) groom.set(1, 0, 0).cross(normal);
    groom.normalize();
    sideways.crossVectors(normal, groom).normalize();
    const len = length * (0.55 + random() * 0.7);
    const width = 0.00065 + random() * 0.00045;
    const curl = (random() - 0.5) * len * 0.28;
    const shade = 0.79 + random() * 0.2;
    for (let segment = 0; segment <= 3; segment++) {
      const t = segment / 3;
      points[segment].copy(p).addScaledVector(normal, 0.0004 + len * (0.48 * t - 0.16 * t * t)).addScaledVector(groom, len * 0.85 * t).addScaledVector(sideways, curl * t * t);
    }
    for (let segment = 0; segment < 3; segment++) {
      const w0 = width * (1 - segment / 3), w1 = width * (1 - (segment + 1) / 3);
      emit(points[segment], -w0, shade); emit(points[segment], w0, shade); emit(points[segment + 1], w1, shade);
      emit(points[segment], -w0, shade); emit(points[segment + 1], w1, shade); emit(points[segment + 1], -w1, shade);
    }
  }
  source.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  result.computeVertexNormals(); result.computeBoundingSphere();
  return result;
}
