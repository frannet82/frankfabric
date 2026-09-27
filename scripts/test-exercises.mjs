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
 for (let t=0;t<=2.4;t+=0.03) {
  const p=exercisePose('squat',t);
  assert.ok(Math.abs(p.leftThigh+p.leftKnee+p.ankle)<1e-10);
  assert.ok(p.hipDrop>=0 && p.hipDrop<0.3);
  assert.ok(p.leftKnee<=1.7);
 }
 assert.ok(exercisePose('squat',2.4).hipDrop<1e-10);
});
test('march alternates the lifted leg; rest clears all exercise offsets', () => {
 const left=exercisePose('march',0.6),right=exercisePose('march',1.8);
 assert.ok(left.leftThigh<0 && left.rightThigh===0);
 assert.ok(right.rightThigh<0 && right.leftThigh===0);
 for (const value of Object.values(exercisePose('rest',2))) assert.equal(Math.abs(value),0);
});

test('faster demonstrations reach full range halfway through each repetition', () => {
 assert.ok(Math.abs(exercisePose('squat',1.2).leftKnee - 1.7) < 1e-10);
 assert.ok(Math.abs(exercisePose('jacks',0.6).armRaise - 2.15) < 1e-10);
 assert.ok(Math.abs(exercisePose('jacks',0.6).spread - 0.28) < 1e-10);
 for (const seconds of [1.2, 2.4, 3.6]) {
  assert.ok(Math.abs(exercisePose('jacks',seconds).armRaise) < 1e-10);
  assert.ok(Math.abs(exercisePose('jacks',seconds).hop) < 1e-10);
 }
});

test('biceps curl raises both forearms while keeping legs and torso still', () => {
 const bottom=exercisePose('curl',0),top=exercisePose('curl',1.4),end=exercisePose('curl',2.8);
 assert.ok(top.elbowCurl > 2 && top.elbowCurl < 2.3);
 assert.ok(Math.abs(end.elbowCurl-bottom.elbowCurl)<1e-10);
 for (let t=0;t<2.8;t+=0.04) {
  const p=exercisePose('curl',t);
  for (const key of ['leftThigh','rightThigh','leftKnee','rightKnee','hipDrop','hop','lean','leftSwing','rightSwing']) assert.equal(Math.abs(p[key]),0);
  assert.equal(p.grip,1);
 }
 assert.equal(exercisePose('rest',0).grip,0);
});
