import assert from 'node:assert/strict';
import {units,toSI,fromSI,presetIndex} from './dist/units.mjs';
const get=(key,label)=>units[key].find(u=>u.label===label);
const near=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-8,Math.abs(b)*1e-10),`${a} != ${b}`);
near(toSI(1,get('P','bar(a)')),100000);
near(toSI(1,get('P','kgf/cm²(a)')),98066.5);
near(toSI(760,get('P','Torr(a)')),101325);
assert.equal(units.P.length,21);
assert.ok(units.P.every(u=>u.basis==='Absolute pressure'&&u.scale>0&&u.offset===0));
near(toSI(212,get('T','°F')),373.15);
near(toSI(491.67,get('T','°R')),273.15);
near(toSI(1,get('S','Btu(IT)/(lb·°F)')),4186.8);
near(toSI(1,get('H','Btu(IT)/lb')),2326);
near(toSI(1,get('M','cP')),.001);
near(toSI(1,get('V','cSt')),1e-6);
for(const [k,group] of Object.entries(units)){
 assert.equal(new Set(group.map(u=>u.label)).size,group.length);
 assert.ok(presetIndex(k,true)>=0);
 for(const u of group)near(toSI(fromSI(123456.789,u),u),123456.789);
}
assert.equal(units.P[presetIndex('P',true)].label,'psia');
console.log(`Passed known conversions and roundtrips for ${Object.values(units).reduce((n,u)=>n+u.length,0)} property-unit options; ${units.P.length} pressure options.`);
