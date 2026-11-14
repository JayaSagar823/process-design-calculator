/* Steam/water state solver. SI throughout; CoolProp IF97::Water (IAPWS-IF97).
 * Deliberately bounded to liquid/vapor water, without ice or metastable states.
 */
export const LIMITS = Object.freeze({Tmin:273.16,Tmax:1073.15,Pmin:611.657,Pmax:100e6,Tcritical:647.096,Pcritical:22.064e6});
const FLUID = 'IF97::Water';
const KEYS = ['P','T','Q','H','S'];
const MAX_FINITE = 1e100;
function valid(x) { return typeof x === 'number' && Number.isFinite(x) && Math.abs(x)<MAX_FINITE; }
function props(CP, output, a, av, b, bv) {
  let v;
  try { v=CP.PropsSI(output,a,av,b,bv,FLUID); } catch { throw new Error('These inputs do not define a valid liquid or vapor water state within the calculation range.'); }
  if (!valid(v)) throw new Error('These inputs do not define a valid liquid or vapor water state within the calculation range.');
  return v;
}
function optional(CP, output, args) { try { return props(CP,output,...args); } catch { return null; } }
function inRange(P,T) {
  // 0.01 Pa tolerance accommodates rounding of the published triple pressure.
  return valid(P)&&valid(T)&&P>=LIMITS.Pmin-.01&&P<=LIMITS.Pmax*1.000000001&&T>=LIMITS.Tmin-1e-6&&T<=LIMITS.Tmax+1e-6;
}
function rangeError() { return new Error('No valid state was found in the supported range: 0.01–800 °C and 0.00611657–1000 bar absolute.'); }
function quality(q) { return q>=-1e-8&&q<=1+1e-8?q<=1e-8?0:q>=1-1e-8?1:q:null; }
export function saturationReferences(CP,P,T){
  if(!inRange(P,T))throw rangeError();
  return {
    temperatureAtPressure:P<LIMITS.Pcritical?optional(CP,'T',['P',P,'Q',1]):null,
    pressureAtTemperature:T<LIMITS.Tcritical?optional(CP,'P',['T',T,'Q',1]):null
  };
}
function state(CP,args) {
  // A nontrivial output forces a real flash; requesting an input key alone does not.
  const D=props(CP,'Dmass',...args), P=props(CP,'P',...args), T=props(CP,'T',...args);
  if (!inRange(P,T)) throw rangeError();
  const Q=quality(props(CP,'Q',...args));
  const wet=Q!==null&&Q>1e-8&&Q<1-1e-8;
  const H=props(CP,'Hmass',...args), S=props(CP,'Smass',...args), U=props(CP,'Umass',...args);
  const CPv=wet?null:optional(CP,'Cpmass',args), CV=wet?null:optional(CP,'Cvmass',args);
  const M=wet?null:optional(CP,'viscosity',args), K=wet?null:optional(CP,'conductivity',args);
  // Surface tension belongs to the equilibrium liquid-vapor interface only.
  const X=Q===null?null:optional(CP,'surface_tension',args);
  const Z=wet?null:P/(D*461.526*T);
  const phase=wet?'Wet steam':Q===0?'Saturated liquid':Q===1?'Saturated vapor':T>=LIMITS.Tcritical&&P>=LIMITS.Pcritical?'Supercritical fluid':T>=LIMITS.Tcritical?'Superheated vapor':P>=LIMITS.Pcritical?'Compressed liquid':P>props(CP,'P','T',T,'Q',0)?'Compressed liquid':'Superheated vapor';
  return {P,T,Q,H,S,U,D,Z,M,CP:CPv,CV,CD:CPv!==null&&CV!==null&&CV>0?CPv/CV:null,X,K,V:M!==null?M/D:null,N:M!==null&&CPv!==null&&K!==null&&K>0?M*CPv/K:null,phase,saturation:['Superheated vapor','Compressed liquid'].includes(phase)?saturationReferences(CP,P,T):null};
}
function canonicalState(CP,args) {
  const P=props(CP,'P',...args), T=props(CP,'T',...args);let Q=quality(props(CP,'Q',...args));
  // HEOS H,S can return an unassigned quality at exact saturation endpoints.
  // Recover only when P,T and BOTH caloric properties agree with saturation.
  if(Q===null&&T>=LIMITS.Tmin&&T<LIMITS.Tcritical) {
    const ps=props(CP,'P','T',T,'Q',0);
    if(Math.abs(P/ps-1)<1e-6) {
      const h=props(CP,'H',...args),s=props(CP,'S',...args);
      const hf=props(CP,'H','T',T,'Q',0),hg=props(CP,'H','T',T,'Q',1);
      const sf=props(CP,'S','T',T,'Q',0),sg=props(CP,'S','T',T,'Q',1);
      const q=quality((h-hf)/(hg-hf));
      if(q!==null&&Math.abs(s-(sf+q*(sg-sf)))<Math.max(1e-5,Math.abs(s)*1e-8))Q=q;
    }
  }
  return state(CP,Q===null?['P',P,'T',T]:['T',T,'Q',Q]);
}
function safe(f,x) { try { const y=f(x); return valid(y)?y:NaN; } catch { return NaN; } }
function goldenExtreme(f,a,b,maximize) {
  const ratio=(Math.sqrt(5)-1)/2, sign=maximize?-1:1;
  let c=b-ratio*(b-a),d=a+ratio*(b-a),fc=sign*safe(f,c),fd=sign*safe(f,d);
  for(let i=0;i<65;i++) {
    if(!valid(fc)||!valid(fd)) return (a+b)/2;
    if(fc<fd) { b=d;d=c;fd=fc;c=b-ratio*(b-a);fc=sign*safe(f,c); }
    else { a=c;c=d;fc=fd;d=a+ratio*(b-a);fd=sign*safe(f,d); }
  }
  return (a+b)/2;
}
/** Bounded all-root search, including local extrema (double roots).
 * The smooth stable branches are sampled and locally refined; invalid samples
 * split intervals. A final property residual check rejects discontinuity roots.
 */
function roots(f,target,lo,hi,{log=false,critical=false}={}) {
  if(hi<=lo) return [];
  const toX=log?Math.exp:x=>x, a=log?Math.log(lo):lo, b=log?Math.log(hi):hi;
  const fun=z=>f(toX(z));
  const grid=Array.from({length:241},(_,i)=>a+(b-a)*i/240);
  if(critical&&!log) for(let i=0;i<=70;i++) { const t=LIMITS.Tcritical-Math.pow(10,-5+i*7/70);if(t>a&&t<b)grid.push(t); }
  grid.sort((x,y)=>x-y);
  let samples=grid.map(x=>({x,y:safe(fun,x)}));
  const extra=[];
  for(let i=1;i<samples.length-1;i++) {
    const l=samples[i-1],c=samples[i],r=samples[i+1];
    if(!valid(l.y)||!valid(c.y)||!valid(r.y))continue;
    if((c.y<l.y&&c.y<r.y)||(c.y>l.y&&c.y>r.y)) {
      const x=goldenExtreme(fun,l.x,r.x,c.y>l.y);extra.push({x,y:safe(fun,x),extreme:true});
    }
  }
  samples.push(...extra);samples.sort((x,y)=>x.x-y.x);
  const result=[], tolerance=Math.max(1e-7,Math.abs(target)*2e-10);
  function add(z) { const x=toX(z); if(Math.abs(safe(f,x)-target)<=tolerance*10&&!result.some(old=>Math.abs(old-x)<=1e-7*Math.max(1,Math.abs(x))))result.push(x); }
  // A tangent root is flat: several nearby samples can have indistinguishable
  // residuals. Treat each contiguous near-zero group as one root and prefer
  // the refined extremum, rather than inventing branches on either side.
  for(let i=0;i<samples.length;i++) {
    if(!valid(samples[i].y)||Math.abs(samples[i].y-target)>tolerance)continue;
    let best=samples[i];
    while(i+1<samples.length&&valid(samples[i+1].y)&&Math.abs(samples[i+1].y-target)<=tolerance) {
      const next=samples[++i];if(next.extreme||(!best.extreme&&Math.abs(next.y-target)<Math.abs(best.y-target)))best=next;
    }
    add(best.x);
  }
  for(let i=0;i<samples.length;i++) {
    const current=samples[i];
    if(!valid(current.y))continue;
    if(!i||!valid(samples[i-1].y))continue;
    let left=samples[i-1].x,right=current.x,fl=samples[i-1].y-target,fr=current.y-target;
    if(Math.abs(fl)<=tolerance||Math.abs(fr)<=tolerance)continue;
    if(fl*fr>=0)continue;
    for(let k=0;k<75;k++) {
      const mid=(left+right)/2,fm=safe(fun,mid)-target;
      if(!valid(fm))break;
      if(Math.abs(fm)<=tolerance){left=right=mid;break;}
      if(fl*fm<=0){right=mid;fr=fm;}else{left=mid;fl=fm;}
    }
    add((left+right)/2);
  }
  return result.sort((x,y)=>x-y);
}
function fixedQuality(CP,Q,key,value) {
  const found=roots(T=>props(CP,key,'T',T,'Q',Q),value,LIMITS.Tmin,LIMITS.Tcritical-1e-5,{critical:true});
  return found.map(T=>state(CP,['T',T,'Q',Q]));
}
function fixedTemperature(CP,T,key,value) {
  const states=[], intervals=[];
  if(T<LIMITS.Tcritical-1e-7) {
    const ps=props(CP,'P','T',T,'Q',0),yf=props(CP,key,'T',T,'Q',0),yg=props(CP,key,'T',T,'Q',1);
    const q=(value-yf)/(yg-yf);
    if(q>=-1e-10&&q<=1+1e-10)states.push(state(CP,['T',T,'Q',Math.max(0,Math.min(1,q))]));
    if(ps>LIMITS.Pmin)intervals.push([LIMITS.Pmin,Math.min(LIMITS.Pmax,ps*(1-2e-6))]);
    if(ps<LIMITS.Pmax)intervals.push([Math.max(LIMITS.Pmin,ps*(1+2e-6)),LIMITS.Pmax]);
  } else intervals.push([LIMITS.Pmin,LIMITS.Pmax]);
  for(const [lo,hi] of intervals) {
    for(const P of roots(P=>props(CP,key,'P',P,'T',T),value,lo,hi,{log:true})) {
      try { const s=state(CP,['P',P,'T',T]);if(!states.some(old=>Math.abs(old.P-P)<Math.max(.1,P*1e-7)))states.push(s); } catch { /* Reject invalid/metastable candidates. */ }
    }
  }
  return states.sort((a,b)=>a.P-b.P);
}
export function solve(CP,inputs) {
  if(!CP||typeof CP.PropsSI!=='function')throw new Error('The steam calculation engine is still loading.');
  const keys=KEYS.filter(k=>inputs[k]!==undefined&&inputs[k]!==null&&inputs[k]!=='');
  if(keys.length!==2)throw new Error('Enter exactly two properties to calculate a state.');
  if(keys.some(k=>!valid(inputs[k])))throw new Error('Enter a finite number for each selected property.');
  const {P,T,Q}=inputs;
  if(keys.includes('P')&&(P<LIMITS.Pmin||P>LIMITS.Pmax))throw new Error('Pressure must be 0.00611657–1000 bar absolute (611.657 Pa–100 MPa).');
  if(keys.includes('T')&&(T<LIMITS.Tmin||T>LIMITS.Tmax))throw new Error('Temperature must be 0.01–800 °C (273.16–1073.15 K).');
  if(keys.includes('Q')&&(Q<0||Q>1))throw new Error('Vapor quality must be a fraction from 0 to 1.');
  const pair=keys.join('');let states=[];
  if(pair==='PT'&&T<LIMITS.Tcritical) {
    const saturation=props(CP,'P','T',T,'Q',0);
    if(Math.abs(P/saturation-1)<=1e-5)throw new Error('Pressure and temperature lie on the saturation curve and do not determine vapor quality. Replace either input with quality, enthalpy, or entropy.');
  }
  if((pair==='PQ'&&P>=LIMITS.Pcritical)||(pair==='TQ'&&T>=LIMITS.Tcritical))throw new Error('Vapor quality is defined only below the critical point: 373.946 °C and 220.64 bar.');
  if(pair==='QH'||pair==='QS')states=fixedQuality(CP,Q,keys[1],inputs[keys[1]]);
  else if(pair==='TH'||pair==='TS')states=fixedTemperature(CP,T,keys[1],inputs[keys[1]]);
  else states=[canonicalState(CP,[keys[0],inputs[keys[0]],keys[1],inputs[keys[1]]])];
  if(!states.length)throw rangeError();
  // Every returned candidate must reproduce BOTH supplied properties.
  states=states.filter(s=>keys.every(k=>s[k]!==null&&Math.abs(s[k]-inputs[k])<=Math.max(k==='Q'?1e-7:1e-5,Math.abs(inputs[k])*2e-5)));
  if(!states.length)throw new Error('The solver could not reproduce both inputs within tolerance. Check the values and units.');
  const warnings=[];
  if(states.length>1)warnings.push(`These inputs have ${states.length} valid states within the calculation range. Select the state that matches your process.`);
  if(states.some(s=>s.Q!==null&&s.Q>1e-8&&s.Q<1-1e-8))warnings.push('Wet steam: bulk Cp, Cv, their ratio, compressibility factor, viscosity, conductivity, kinematic viscosity, and Prandtl number are not reported; they require an applicable two-phase model.');
  if(states.some(s=>s.Q===null))warnings.push('Quality is only defined on the liquid–vapor saturation curve. Surface tension is only reported for a saturated interface.');
  return {states,warnings};
}
