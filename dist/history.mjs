import {units} from './units.mjs';
export const HISTORY_KEY='steam-operator.history.v1';
export const HISTORY_LIMIT=10;
const phases=['Superheated vapor','Compressed liquid','Supercritical fluid','Wet steam','Saturated liquid','Saturated vapor'];
function valid(entry){
 if(!entry||typeof entry.id!=='string'||typeof entry.createdAt!=='string'||!Number.isFinite(Date.parse(entry.createdAt)))return false;
 const keys=Object.keys(entry.inputs??{});
 if(keys.length!==2||keys.some(k=>!['P','T','Q','H','S'].includes(k)||!Number.isFinite(entry.inputs[k])))return false;
 if(!entry.result||!phases.includes(entry.result.phase))return false;
 if(!['P','T','H','S'].every(k=>Number.isFinite(entry.result[k])))return false;
 return Object.keys(units).every(k=>(entry.result[k]===null||Number.isFinite(entry.result[k]))&&typeof entry.units?.[k]==='string');
}
// Same inputs (values, pair and every chosen unit) as another saved calculation: saving it again replaces that record.
export function sameCalculation(a,b){
 if(!a||!b)return false;
 const ka=Object.keys(a.inputs??{}).sort(),kb=Object.keys(b.inputs??{}).sort();
 return ka.join()===kb.join()&&ka.every(k=>a.inputs[k]===b.inputs[k])&&Object.keys(units).every(k=>a.units?.[k]===b.units?.[k]);
}
export function createHistory(storage){
 let entries=[];
 try {const parsed=JSON.parse(storage.getItem(HISTORY_KEY)??'[]');if(Array.isArray(parsed)){entries=parsed.filter(valid).slice(0,HISTORY_LIMIT);if(parsed.length>HISTORY_LIMIT)storage.setItem(HISTORY_KEY,JSON.stringify(entries));}}catch{}
 const persist=()=>{try{storage.setItem(HISTORY_KEY,JSON.stringify(entries));return true;}catch{return false;}};
 return {
  list:()=>structuredClone(entries),
  add(entry,{replaceSame=false}={}){
   if(!valid(entry))throw new Error('Invalid calculation snapshot');
   const rest=entries.filter(e=>e.id!==entry.id);
   if(replaceSame&&sameCalculation(rest[0],entry))rest.shift();
   entries=[structuredClone(entry),...rest].slice(0,HISTORY_LIMIT);
   return persist();
  },
  insert(entry,index){
   if(!valid(entry))throw new Error('Invalid calculation snapshot');
   const rest=entries.filter(e=>e.id!==entry.id);
   rest.splice(Math.max(0,Math.min(index,rest.length)),0,structuredClone(entry));
   entries=rest.slice(0,HISTORY_LIMIT);
   return persist();
  },
  remove(id){entries=entries.filter(entry=>entry.id!==id);return persist();},
  clear(){entries=[];return persist();}
 };
}
