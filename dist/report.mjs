import {units,fromSI} from './units.mjs';

export const propertyLabels={P:'Pressure',T:'Temperature',Q:'Vapor fraction',H:'Enthalpy',S:'Entropy',U:'Internal energy',D:'Density',Z:'Compressibility',M:'Dynamic viscosity',CP:'Heat capacity Cp',CD:'Cp / Cv',CV:'Heat capacity Cv',X:'Surface tension',K:'Thermal conductivity',V:'Kinematic viscosity',N:'Prandtl number'};
export const formatValue=n=>n!==0&&(Math.abs(n)<0.001||Math.abs(n)>=1e7)?n.toExponential(5):Number(n.toPrecision(7)).toString();
export const phaseName=state=>state.phase==='Superheated vapor'?'Superheated steam':state.phase==='Compressed liquid'?'Subcooled liquid':state.phase;

export function createReport(snapshot){
 if(!snapshot?.result)throw new Error('Calculate a result first.');
 const {result,inputs}=snapshot;
 const chosen=k=>units[k].find(u=>u.label===snapshot.units[k])??units[k][0];
 const value=(k,n)=>Number.isFinite(n)?formatValue(fromSI(n,chosen(k))):'N/A';
 const rows=[];
 for(const k of Object.keys(propertyLabels))if(k in inputs)rows.push(['Input',propertyLabels[k],value(k,inputs[k]),chosen(k).label]);
 const output={...result,Q:result.phase==='Superheated vapor'?1:result.phase==='Compressed liquid'?0:result.Q};
 for(const k of Object.keys(propertyLabels))rows.push(['Output',propertyLabels[k],value(k,output[k]),chosen(k).label]);
 if(result.saturation){
  rows.push(['Saturation',`Saturation temperature at ${value('P',result.P)} ${chosen('P').label}`,value('T',result.saturation.temperatureAtPressure),chosen('T').label]);
  rows.push(['Saturation',`Saturation pressure at ${value('T',result.T)} ${chosen('T').label}`,value('P',result.saturation.pressureAtTemperature),chosen('P').label]);
 }
 const at=new Date(snapshot.createdAt).toISOString();
 const notes=['All pressures are absolute. N/A means not defined or not modeled.'];
 if(result.phase==='Superheated vapor')notes.push('Vapor fraction 1 denotes all vapor; saturation quality is not defined for superheated steam.');
 if(result.phase==='Compressed liquid')notes.push('Vapor fraction 0 denotes all liquid.');
 if(result.phase==='Wet steam')notes.push('Wet-steam heat capacities and transport properties require a two-phase model.');
 if(result.phase==='Supercritical fluid')notes.push('Vapor fraction is not defined for supercritical fluid.');
 if(result.saturation&&result.P>=22.064e6)notes.push('Saturation temperature is not defined at or above critical pressure.');
 if(result.saturation&&result.T>=647.096)notes.push('Saturation pressure is not defined at or above critical temperature.');
 const text=['Steam Properties Calculator',`State: ${phaseName(result)}`,`Calculated: ${at}`,'Method: IAPWS-IF97',...['Input','Output','Saturation'].flatMap(section=>{
  const sectionRows=rows.filter(row=>row[0]===section);
  return sectionRows.length?['',section.toUpperCase(),...sectionRows.map(([,label,n,u])=>`${label}: ${n}${u==='—'?'':` ${u}`}`)]:[];
 }),...['','Notes',...notes]].join('\n');
 const csvRows=[['Section','Property','Value','Unit'],['Calculation','State',phaseName(result),''],['Calculation','Calculated (UTC)',at,''],['Calculation','Method','IAPWS-IF97',''],...rows,...notes.map(note=>['Note',note,'',''])];
 const csv='\uFEFF'+csvRows.map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
 return {text,csv,filename:`steam-properties-${at.replace(/[:.]/g,'-')}`,rows};
}
