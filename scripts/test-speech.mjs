import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync('lib/speech/SpeechVoice.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup() {
  let now = 1000;
  const queued = [];
  const synth = { getVoices: () => [{ name: 'Italian Premium', lang: 'it-IT' }, { name: 'English Natural', lang: 'en-US' }], resume() {}, speak(u) { queued.push(u); u.onstart(); }, cancel() {} };
  const context = { exports: {}, window: { speechSynthesis: synth }, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, performance: { now: () => now }, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  return { voice: new context.exports.SpeechVoice(), queued, advance: value => { now += value; } };
}
const wait = () => new Promise(resolve => setTimeout(resolve, 45));
test('English voice, boundary pauses and exactly-once completion', async () => {
  const { voice, queued, advance } = setup();
  let starts = 0, ends = 0;
  voice.speak('A simple recipe.', { onStart: () => starts++, onEnd: () => ends++ });
  await wait();
  assert.equal(starts, 1);
  assert.equal(queued[0].voice.lang, 'en-US');
  assert.ok(voice.getLoudness() > 0);
  queued[0].onboundary({ name: 'word', charIndex: 0 });
  advance(800);
  assert.equal(voice.getLoudness(), 0);
  const end = queued[0].onend;
  end(); end();
  assert.equal(ends, 1);
  assert.equal(voice.getLoudness(), 0);
  voice.dispose();
});
test('replacement and mute close prior talking window without queuing stale text', async () => {
  const { voice, queued } = setup();
  let oldEnds = 0, newEnds = 0;
  voice.speak('Old reply', { onEnd: () => oldEnds++ });
  voice.speak('New reply', { onEnd: () => newEnds++ });
  await wait();
  assert.equal(oldEnds, 1);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].text, 'New reply');
  voice.setMuted(true);
  assert.equal(newEnds, 1);
  assert.equal(voice.getLoudness(), 0);
  voice.speak('Muted reply');
  await wait();
  assert.equal(queued.length, 1);
  voice.dispose();
});
