const energy={'kcal/kWh':1,'kJ/kWh':4.187,'MJ/kWh':.004187};
export const fields=[
['heat','Heat rate',3000,energy,'Fuel energy per unit of electricity.'],
['lhv','Natural gas LHV',8700,{'kcal/Nm³':1,'kJ/Nm³':4.187,'MJ/Nm³':.004187},'Use the same normal conditions as the gas flow.'],
['power','Turbine power output',25,{'MW':1,'kW':1000},'Electrical power generated.'],
['feed','Natural gas feed',65000,{'Nm³/h':1,'Nm³/day':24},'Process feed included in the carbon estimate.'],
['fuel','Natural gas fuel',12000,{'Nm³/h':1,'Nm³/day':24},'Fuel gas consumed by the plant.'],
['demand','Plant power consumption',14,{'MW':1,'kW':1000},'Electrical demand of the ammonia plant.'],
['steam','Steam flow',100,{'t/h':1,'kg/h':1000,'t/day':24},'Enter a positive flow; select export or import below.'],
['production','Ammonia production',92,{'t/h':1,'kg/h':1000,'t/day':24},'Production rate must be greater than zero.'],
['electricity','Electricity CO₂ factor',.73,{'tCO₂/MWh':1,'kgCO₂/kWh':1,'kgCO₂/MWh':1000},'Applied to turbine output and plant power demand.'],
['steamEnergy','Steam energy allowance',755,{'kcal/kg':1,'kJ/kg':4.187,'MJ/kg':.004187},'Energy allowance per kg of steam.'],
['gasFactor','Natural gas CO₂ factor',56.1,{'tCO₂/TJ':1,'kgCO₂/GJ':1,'kgCO₂/TJ':1000},'Applied to feed plus fuel energy on an LHV basis.'],
['steamFactor','Steam CO₂ allowance',.18,{'tCO₂/t steam':1,'kgCO₂/t steam':1000,'kgCO₂/kg steam':1},'CO₂ burden or credit per tonne of steam.']];
export const outputs=[
['specificGas','Specific gas consumption',{'Nm³/kWh':1,'Nm³/MWh':1000},'Heat rate divided by LHV.'],
['turbineCO2','Turbine CO₂ emissions',{'tCO₂/h':1,'kgCO₂/h':1000,'tCO₂/day':24},'Turbine power multiplied by the electricity factor.'],
['specificEnergy','Specific plant energy',{'Gcal/t NH₃':1,'GJ/t NH₃':4.187,'MJ/kg NH₃':4.187,'kcal/kg NH₃':1000},'Net energy divided by ammonia production.'],
['specificCO2','Specific plant CO₂',{'tCO₂/t NH₃':1,'kgCO₂/t NH₃':1000,'kgCO₂/kg NH₃':1},'Net allocated CO₂ divided by ammonia production.'],
['netEnergy','Net plant energy',{'Gcal/h':1,'GJ/h':4.187,'MW thermal':4.187/3.6},'Gas plus power energy, adjusted for steam.'],
['netCO2','Net allocated plant CO₂',{'tCO₂/h':1,'kgCO₂/h':1000,'tCO₂/day':24},'Gas plus power CO₂, adjusted for steam.']];
export const defaults=()=>Object.fromEntries(fields.map(f=>[f[0],f[2]]));
export const selectedFields=mode=>mode==='turbine'?fields.filter(f=>['heat','lhv','power','electricity'].includes(f[0])):mode==='ammonia'?fields.filter(f=>f[0]!=='power'):fields;
export const selectedOutputs=mode=>mode==='turbine'?outputs.slice(0,2):mode==='ammonia'?outputs.slice(2):outputs;
export function calculate(v,direction,mode='all'){
 if(!['all','turbine','ammonia'].includes(mode))throw Error('Select a calculator.');
 for(const [id,name] of selectedFields(mode))if(!Number.isFinite(v[id])||v[id]<0)throw Error(name+': enter a number of zero or greater.');
 if(v.lhv<=0||(mode!=='turbine'&&v.production<=0))throw Error('LHV and ammonia production must be greater than zero.');
 if(mode!=='turbine'&&!['export','import'].includes(direction))throw Error('Select steam export or import.');
 if(mode==='turbine'){const result={specificGas:v.heat/v.lhv,turbineCO2:v.power*v.electricity};if(Object.values(result).some(x=>!Number.isFinite(x)))throw Error('Values are too large to calculate.');return result;}
 const sign=direction==='export'?-1:1;
 const gasEnergy=(v.feed+v.fuel)*v.lhv/1e6,powerEnergy=v.demand*1000*v.heat/1e6,steamEnergy=v.steam*1000*v.steamEnergy/1e6;
 const gasCO2=(v.feed+v.fuel)*v.lhv*4.187/1e9*v.gasFactor,powerCO2=v.demand*v.electricity,steamCO2=v.steam*v.steamFactor;
 const netEnergy=gasEnergy+powerEnergy+sign*steamEnergy,netCO2=gasCO2+powerCO2+sign*steamCO2;
 const result={specificGas:v.heat/v.lhv,turbineCO2:v.power*v.electricity,specificEnergy:netEnergy/v.production,specificCO2:netCO2/v.production,netEnergy,netCO2};
 if(mode==='ammonia'){delete result.specificGas;delete result.turbineCO2;}
 if(Object.values(result).some(x=>!Number.isFinite(x)))throw Error('Values are too large to calculate.');return result;
}
