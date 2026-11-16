export const KEY='ammonia-saturation-history-v1';
export const sameInputs=(a,b)=>!!a&&!!b&&a.mode===b.mode&&a.input===b.input&&a.inputUnit===b.inputUnit&&a.outputUnit===b.outputUnit;
// A repeat of the newest calculation replaces it (new date, at the top) instead of filling History with copies.
export function addRecord(records,record,limit=10){const rest=records.filter(r=>r.id!==record.id);if(sameInputs(rest[0],record))rest.shift();return [record,...rest].slice(0,limit)}
export function deleteRecord(records,id){return records.filter(r=>r.id!==id)}
export function restoreRecord(records,record,index,limit=10){const rest=records.filter(r=>r.id!==record.id);return [...rest.slice(0,index),record,...rest.slice(index)].slice(0,limit)}
export function validRecord(r){return r&&typeof r.id==='string'&&['pt','tp'].includes(r.mode)&&Number.isFinite(r.input)&&typeof r.inputUnit==='string'&&typeof r.outputUnit==='string'&&Number.isFinite(r.t)&&Number.isFinite(r.p)&&Number.isFinite(Date.parse(r.date))}
export function readRecords(storage,limit=10){const value=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(validRecord).slice(0,limit):[]}
