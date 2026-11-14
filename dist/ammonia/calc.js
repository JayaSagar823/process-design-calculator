import {data} from './data.js';
export {data};
export function interpolate(value,key){
  if(!Number.isFinite(value)) throw Error('Enter a valid number.');
  if(value<data[0][key] || value>data.at(-1)[key]) throw Error(key==='p'?'Pressure must be within 0.386–113 bar absolute.':'Temperature must be within −51.1–132 °C.');
  const exact=data.find(d=>Math.abs(d[key]-value)<1e-10);
  if(exact)return {...exact,lo:exact,hi:exact,exact:true};
  const i=data.findIndex(d=>d[key]>value),lo=data[i-1],hi=data[i],f=(value-lo[key])/(hi[key]-lo[key]);
  return {t:lo.t+f*(hi.t-lo.t),p:lo.p+f*(hi.p-lo.p),lo,hi,exact:false};
}
export const factors={bar:1,kPa:0.01,MPa:10,psi:0.06894757293168,'kgf/cm²':0.980665};
export function absolute(value,unit,basis,atm){return value*factors[unit]+(basis==='gauge'?atm:0);}
export function celsius(value,unit){return unit==='F'?(value-32)*5/9:unit==='K'?value-273.15:value;}
