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
export function createHistory(storage){
 let entries=[];
 try {const parsed=JSON.parse(storage.getItem(HISTORY_KEY)??'[]');if(Array.isArray(parsed)){entries=parsed.filter(valid).slice(0,HISTORY_LIMIT);if(parsed.length>HISTORY_LIMIT)storage.setItem(HISTORY_KEY,JSON.stringify(entries));}}catch{}
 const persist=()=>{try{storage.setItem(HISTORY_KEY,JSON.stringify(entries));return true;}catch{return false;}};
 return {
  list:()=>structuredClone(entries),
  add(entry){
   if(!valid(entry))throw new Error('Invalid calculation snapshot');
   entries=[structuredClone(entry),...entries.filter(e=>e.id!==entry.id)].slice(0,HISTORY_LIMIT);
   return persist();
  },
  remove(id){entries=entries.filter(entry=>entry.id!==id);return persist();},
  clear(){entries=[];return persist();}
 };
}
