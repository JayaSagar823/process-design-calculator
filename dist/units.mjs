// Canonical values: Pa absolute, K, J/kg, J/(kg K), kg/m³ and SI transport units.
// NIST SP 811 conversion factors. Btu and calories use International Table (IT).
const u=(label,scale=1,offset=0,basis)=>({label,scale,offset,basis});
const pressure=[['MPa',1e6],['kPa',1e3],['bar',1e5],['Pa',1],['hPa',100],['mbar',100],['psi',6894.757293168],['kgf/cm²',98066.5],['kgf/m²',9.80665],['atm',101325],['Torr',101325/760],['mmHg',133.322387415],['cmHg',1333.22387415],['inHg',3386.388640341],['mmH₂O',9.80665],['cmH₂O',98.0665],['mH₂O',9806.65],['inH₂O',249.08891],['ftH₂O',2989.06692],['lbf/ft²',.45359237*9.80665/.3048**2],['N/mm²',1e6]];
const energy=[u('kJ/kg',1000),u('J/kg'),u('MJ/kg',1e6),u('J/g',1000),u('kcal(IT)/kg',4186.8),u('cal(IT)/g',4186.8),u('Btu(IT)/lb',2326)];
const capacity=[u('kJ/(kg·K)',1000),u('J/(kg·K)'),u('kJ/(kg·°C)',1000),u('J/(g·K)',1000),u('kcal(IT)/(kg·°C)',4186.8),u('cal(IT)/(g·°C)',4186.8),u('Btu(IT)/(lb·°F)',4186.8)];
export const units={
 P:pressure.map(([name,scale])=>u(name==='psi'?'psia':`${name}(a)`,scale,0,'Absolute pressure')),
 T:[u('°C',1,273.15),u('K'),u('°F',5/9,255.3722222222222),u('°R',5/9)],
 Q:[u('fraction'),u('%',.01)],H:energy,S:capacity,U:energy,
 D:[u('kg/m³'),u('g/cm³',1000),u('kg/L',1000),u('g/L'),u('lb/ft³',.45359237/.3048**3),u('lb/US gal',.45359237/.003785411784),u('lb/UK gal',.45359237/.00454609)],
 Z:[u('—')],CD:[u('—')],N:[u('—')],
 M:[u('Pa·s'),u('mPa·s',.001),u('μPa·s',1e-6),u('cP',.001),u('P',.1),u('lb/(ft·s)',.45359237/.3048)],
 CP:capacity,CV:capacity,
 X:[u('N/m'),u('mN/m',.001),u('dyn/cm',.001),u('lbf/in',.45359237*9.80665/.0254)],
 K:[u('W/(m·K)'),u('W/(m·°C)'),u('mW/(m·K)',.001),u('kW/(m·K)',1000),u('kcal(IT)/(h·m·°C)',4186.8/3600),u('Btu(IT)/(h·ft·°F)',1055.05585262/3600/.3048*1.8)],
 V:[u('m²/s'),u('mm²/s',1e-6),u('cSt',1e-6),u('St',1e-4),u('cm²/s',1e-4),u('ft²/s',.3048**2)]
};
export const toSI=(value,unit)=>value*unit.scale+unit.offset;
export const fromSI=(value,unit)=>(value-unit.offset)/unit.scale;
const imperial={P:'psia',T:'°F',H:'Btu(IT)/lb',U:'Btu(IT)/lb',S:'Btu(IT)/(lb·°F)',CP:'Btu(IT)/(lb·°F)',CV:'Btu(IT)/(lb·°F)',D:'lb/ft³',M:'cP',X:'dyn/cm',K:'Btu(IT)/(h·ft·°F)',V:'cSt'};
export const presetIndex=(key,isImperial)=>isImperial&&imperial[key]?units[key].findIndex(u=>u.label===imperial[key]):0;
