import createCoolProp from './coolprop.js';
import { solve, saturationReferences } from './thermo.mjs';

let engine;
const ready = createCoolProp({
  locateFile: (name) => new URL(name, import.meta.url).href,
  print: () => {},
  printErr: () => {},
}).then((cp) => {
  engine = cp;
  let version = '8.0.0';
  try { version = cp.get_global_param_string('version'); } catch {}
  self.postMessage({ ready: true, version });
}).catch(() => {
  self.postMessage({ init: true, error: 'The calculation engine could not load. Please reload the page and try again.' });
});

self.onmessage = async ({ data }) => {
  await ready;
  const { id, inputs } = data;
  try {
    if (!engine) throw new Error('The calculation engine is unavailable. Please reload the page.');
    if(data.type==='references'){self.postMessage({id,references:saturationReferences(engine,data.P,data.T)});return;}
    self.postMessage({ id, result: solve(engine, inputs) });
  } catch (error) {
    if(data.type==='references'){self.postMessage({id,references:{temperatureAtPressure:null,pressureAtTemperature:null}});return;}
    self.postMessage({ id, error: error instanceof Error ? error.message : 'These inputs could not be solved. Check the values and try another pair.' });
  }
};
