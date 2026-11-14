import assert from 'node:assert/strict';
import fs from 'node:fs';
import create from './dist/engine/coolprop.js';
import {solve} from './dist/engine/thermo.mjs';
const cp=await create({print:()=>{},printErr:()=>{}});
const fixtures=JSON.parse(fs.readFileSync('fixtures.json','utf8'));
for(const {inputs,expected} of fixtures){
 const {states}=solve(cp,inputs);assert.equal(states.length,1);const s=states[0];
 for(const k of ['P','T','H','S']) assert.ok(Math.abs(s[k]/expected[k]-1)<3e-5,`${Object.keys(inputs)} ${k}: ${s[k]} vs ${expected[k]}`);
 console.log(Object.keys(inputs).join('+'),'passed');
}
assert.throws(()=>solve(cp,{P:1e6,T:453.0356323914666}),/saturation/);
assert.throws(()=>solve(cp,{P:1e6,Q:1.1}),/fraction/);
assert.equal(solve(cp,{S:4361.70517362565,Q:.5}).states.length,2);
console.log('All ten input pairs, invalid quality, saturation and ambiguity passed.');
