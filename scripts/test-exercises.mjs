import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync('lib/coach/exercises.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context = {exports:{}};
vm.runInNewContext(compiled,context);
const {exercisePose} = context.exports;
test('squat keeps feet level through the complete cycle and returns to standing', () => {
 for (let t=0;t<=3.6;t+=0.03) {
  const p=exercisePose('squat',t);
  assert.ok(Math.abs(p.leftThigh+p.leftKnee+p.ankle)<1e-10);
  assert.ok(p.hipDrop>=0 && p.hipDrop<0.3);
  assert.ok(p.leftKnee<=1.7);
 }
 assert.ok(exercisePose('squat',3.6).hipDrop<1e-10);
});
test('march alternates the lifted leg; rest clears all exercise offsets', () => {
 const left=exercisePose('march',0.6),right=exercisePose('march',1.8);
 assert.ok(left.leftThigh<0 && left.rightThigh===0);
 assert.ok(right.rightThigh<0 && right.leftThigh===0);
 for (const value of Object.values(exercisePose('rest',2))) assert.equal(Math.abs(value),0);
});
