export const KEY='ammonia-saturation-history-v1';
export function addRecord(records,record){return [record,...records.filter(r=>r.id!==record.id)].slice(0,10)}
export function deleteRecord(records,id){return records.filter(r=>r.id!==id)}
export function validRecord(r){return r&&typeof r.id==='string'&&['pt','tp'].includes(r.mode)&&Number.isFinite(r.input)&&typeof r.inputUnit==='string'&&typeof r.outputUnit==='string'&&Number.isFinite(r.t)&&Number.isFinite(r.p)&&Number.isFinite(Date.parse(r.date))}
export function readRecords(storage){const value=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(validRecord).slice(0,10):[]}
