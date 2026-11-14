import assert from 'node:assert/strict';
import create from './dist/engine/coolprop.js';
import {solve,saturationReferences} from './dist/engine/thermo.mjs';
import {units,fromSI} from './dist/units.mjs';
const cp=await create({print:()=>{},printErr:()=>{}});
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
// Independent IF97 Region 4 reference points (K, MPa): T_sat(1 MPa), P_sat(573.15 K).
const st=solve(cp,{P:1e6,T:573.15}).states[0];
near(st.saturation.temperatureAtPressure,453.0356323914666,1e-7);
near(st.saturation.pressureAtTemperature,8587708.32955728,.01);
near(fromSI(st.saturation.temperatureAtPressure,units.T.find(u=>u.label==='°F')),355.79413830464,1e-7);
assert.equal(solve(cp,{P:1e6,T:773.15}).states[0].saturation.pressureAtTemperature,null);
near(solve(cp,{P:1e6,T:773.15}).states[0].saturation.temperatureAtPressure,453.0356323914666,1e-7);
assert.equal(saturationReferences(cp,1e6,647.096).pressureAtTemperature,null);
assert.equal(solve(cp,{P:25e6,T:773.15}).states[0].saturation,null);
assert.equal(solve(cp,{P:1e6,Q:.5}).states[0].saturation,null);
// Subcooled water at 1 MPa, 100 °C: both saturation references are available.
const liquid=solve(cp,{P:1e6,T:373.15}).states[0];
assert.equal(liquid.phase,'Compressed liquid');
near(liquid.saturation.temperatureAtPressure,453.0356323914666,1e-7);
near(liquid.saturation.pressureAtTemperature,101417.97792131,.01);
near(fromSI(liquid.saturation.pressureAtTemperature,units.P.find(u=>u.label==='bar(a)')),1.0141797792131,1e-7);
const highPressureLiquid=solve(cp,{P:25e6,T:373.15}).states[0];
assert.equal(highPressureLiquid.saturation.temperatureAtPressure,null);
near(highPressureLiquid.saturation.pressureAtTemperature,101417.97792131,.01);
assert.equal(saturationReferences(cp,22.064e6,373.15).temperatureAtPressure,null);
console.log('Saturation reference values, unit conversion and critical/single-phase boundaries passed.');
