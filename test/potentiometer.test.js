/**
 * test/potentiometer.test.js — Potentiometer variable resistance tests
 * Run: npx vitest run test/potentiometer.test.js
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

global.window = {
  ArduinoLibs: {},
  ArduinoComponents: { COMPONENT_DEFS: {} },
  ArduinoSim: null,
  CircuitCanvas: null,
  EXAMPLE_SKETCHES: [],
  addEventListener() {},
  removeEventListener() {},
};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => ({ style: {}, getContext: () => null, appendChild() {} }),
  addEventListener() {},
  removeEventListener() {},
};
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function loadScripts(files, names) {
  const code = files.map(readSrc).join('\n;\n');
  const fn = new Function('window', 'document',
    code + '\n;return {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ') + '};');
  return fn(global.window, global.document);
}

const { ElectricalEngine, CircuitCanvas } = loadScripts([
  'js/electrical.js',
  'js/components/base.js',
  'js/components/passive.js',
  'js/components/input.js',
  'js/components/power.js',
  'js/components/output.js',
  'js/components/multimeter.js',
  'js/canvas.js',
], ['ElectricalEngine', 'CircuitCanvas']);

function makeCanvasStub() {
  const ctx = new Proxy({}, {
    get(_, prop) {
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return () => {};
    },
    set: () => true,
  });
  const canvasEl = {
    width: 900, height: 600, style: {}, parentElement: null,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }),
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, focus() {},
  };
  const wrapperEl = {
    clientWidth: 900, clientHeight: 600,
    appendChild() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }),
  };
  return new CircuitCanvas(canvasEl, wrapperEl);
}

describe('Potentiometer component definition and variable resistance', () => {
  it('has default props with resistance 10 and unit kΩ', () => {
    const def = window.ArduinoComponents.COMPONENT_DEFS['potentiometer'];
    expect(def).toBeDefined();
    expect(def.defaultProps.resistance).toBe(10);
    expect(def.defaultProps.unit).toBe('kΩ');
    expect(def.defaultProps.maxValue).toBe(1023);
    expect(def.pins.map(p => p.id)).toEqual(['vcc', 'wiper', 'gnd']);
    expect(def.pins.map(p => p.label)).toEqual(['1', 'W', '2']);
  });

  it('measures variable resistance between pins based on wiper position', () => {
    const engine = new ElectricalEngine();
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1000, value: 500 },
      runtimeState: {},
    };
    engine.buildGraph([pot], []);

    // Full track resistance
    const rTotal = engine.measureResistance('pot1', 'vcc', 'pot1', 'gnd');
    expect(rTotal).toBeCloseTo(10000, 0);

    // At 50%, Pin 1 - Wiper and Wiper - Pin 2 are both 5000 ohms
    const r1W = engine.measureResistance('pot1', 'vcc', 'pot1', 'wiper');
    const rW2 = engine.measureResistance('pot1', 'wiper', 'pot1', 'gnd');
    expect(r1W).toBeCloseTo(5000, 0);
    expect(rW2).toBeCloseTo(5000, 0);
    expect(r1W + rW2).toBeCloseTo(10000, 0);
  });

  it('measures resistance at wiper extremes (0% and 100%)', () => {
    const engine = new ElectricalEngine();
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1000, value: 0 },
      runtimeState: { value: 0 },
    };
    engine.buildGraph([pot], []);

    // At 0% position:
    // Pin 1 to Wiper = full 10k
    // Wiper to Pin 2 = minimum (~0.01 ohm clamp)
    const r1W_zero = engine.measureResistance('pot1', 'vcc', 'pot1', 'wiper');
    const rW2_zero = engine.measureResistance('pot1', 'wiper', 'pot1', 'gnd');
    expect(r1W_zero).toBeCloseTo(10000, 0);
    expect(rW2_zero).toBeLessThan(1);

    // At 100% position:
    pot.runtimeState.value = 1000;
    engine.buildGraph([pot], []);
    const r1W_full = engine.measureResistance('pot1', 'vcc', 'pot1', 'wiper');
    const rW2_full = engine.measureResistance('pot1', 'wiper', 'pot1', 'gnd');
    expect(r1W_full).toBeLessThan(1);
    expect(rW2_full).toBeCloseTo(10000, 0);
  });

  it('supports custom resistance values and units (e.g. 500 Ω, 100 kΩ, 1 MΩ)', () => {
    const engine = new ElectricalEngine();
    const pot500 = {
      id: 'pot_500',
      type: 'potentiometer',
      props: { resistance: 500, unit: 'Ω', maxValue: 100, value: 25 },
      runtimeState: { value: 25 },
    };
    engine.buildGraph([pot500], []);
    expect(engine.measureResistance('pot_500', 'vcc', 'pot_500', 'gnd')).toBeCloseTo(500, 0);
    expect(engine.measureResistance('pot_500', 'wiper', 'pot_500', 'gnd')).toBeCloseTo(125, 0);
    expect(engine.measureResistance('pot_500', 'vcc', 'pot_500', 'wiper')).toBeCloseTo(375, 0);

    const pot1M = {
      id: 'pot_1M',
      type: 'potentiometer',
      props: { resistance: 1, unit: 'MΩ', maxValue: 100, value: 70 },
      runtimeState: { value: 70 },
    };
    engine.buildGraph([pot1M], []);
    expect(engine.measureResistance('pot_1M', 'vcc', 'pot_1M', 'gnd')).toBeCloseTo(1000000, -2);
    expect(engine.measureResistance('pot_1M', 'wiper', 'pot_1M', 'gnd')).toBeCloseTo(700000, -2);
    expect(engine.measureResistance('pot_1M', 'vcc', 'pot_1M', 'wiper')).toBeCloseTo(300000, -2);
  });
});

describe('Potentiometer circuit simulation in ElectricalEngine', () => {
  it('acts as a precision voltage divider when powered across terminals 1 and 2', () => {
    const engine = new ElectricalEngine();
    const pwr = { id: 'batt1', type: 'battery', props: { voltage: 10 }, runtimeState: {} };
    const gnd = { id: 'gnd1', type: 'power_gnd', props: {}, runtimeState: {} };
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1000, value: 500 },
      runtimeState: {},
    };

    const wires = [
      { from: { instId: 'batt1', pinId: 'pos' }, to: { instId: 'pot1', pinId: 'vcc' } },
      { from: { instId: 'batt1', pinId: 'neg' }, to: { instId: 'pot1', pinId: 'gnd' } },
      { from: { instId: 'pot1', pinId: 'gnd' }, to: { instId: 'gnd1', pinId: 'gnd' } },
    ];

    engine.buildGraph([pwr, gnd, pot], wires);
    engine.solve();

    expect(engine.getVoltageAtPin('pot1', 'vcc')).toBeCloseTo(10, 2);
    expect(engine.getVoltageAtPin('pot1', 'gnd')).toBeCloseTo(0, 2);
    expect(engine.getVoltageAtPin('pot1', 'wiper')).toBeCloseTo(5.0, 2);

    // Change position to 25%
    pot.props.value = 250;
    engine.buildGraph([pwr, gnd, pot], wires);
    engine.solve();
    expect(engine.getVoltageAtPin('pot1', 'wiper')).toBeCloseTo(2.5, 2);

    // Change position to 80%
    pot.props.value = 800;
    engine.buildGraph([pwr, gnd, pot], wires);
    engine.solve();
    expect(engine.getVoltageAtPin('pot1', 'wiper')).toBeCloseTo(8.0, 2);
  });

  it('acts as a variable series resistor (rheostat) to regulate current and voltage', () => {
    const engine = new ElectricalEngine();
    // 12V supply -> 1k fixed resistor -> potentiometer pin 1 -> wiper -> ground
    const pwr = { id: 'batt1', type: 'battery', props: { voltage: 12 }, runtimeState: {} };
    const rFixed = { id: 'r1', type: 'resistor', props: { value: 1, unit: 'kΩ' }, runtimeState: {} };
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 1, unit: 'kΩ', maxValue: 1000, value: 0 },
      runtimeState: { value: 0 }, // 0% wiper position -> R_1W = 1000 ohms
    };
    const gnd = { id: 'gnd1', type: 'power_gnd', props: {}, runtimeState: {} };

    const wires = [
      { from: { instId: 'batt1', pinId: 'pos' }, to: { instId: 'r1', pinId: 'p1' } },
      { from: { instId: 'r1', pinId: 'p2' }, to: { instId: 'pot1', pinId: 'vcc' } },
      { from: { instId: 'pot1', pinId: 'wiper' }, to: { instId: 'batt1', pinId: 'neg' } },
      { from: { instId: 'batt1', pinId: 'neg' }, to: { instId: 'gnd1', pinId: 'gnd' } },
    ];

    engine.buildGraph([pwr, rFixed, pot, gnd], wires);
    engine.solve();

    // R_total = 1000 + 1000 = 2000 ohms. Midpoint voltage between r1 and pot1 should be 6.0 V.
    const vMid = engine.getVoltageAtPin('r1', 'p2');
    expect(vMid).toBeCloseTo(6.0, 2);

    // Now turn wiper to 100% (value = 1000 -> R_1W ~ 0 ohms)
    pot.runtimeState.value = 1000;
    engine.buildGraph([pwr, rFixed, pot, gnd], wires);
    engine.solve();
    // With pot R_1W ~ 0 ohms, the wiper shorts Pin 1 to GND, pulling vMid close to 0 V
    const vMid_short = engine.getVoltageAtPin('r1', 'p2');
    expect(vMid_short).toBeCloseTo(0.0, 1);
  });
});

describe('CircuitCanvas potentiometer UI and integration', () => {
  it('formats slider values with variable resistance badge', () => {
    const cc = makeCanvasStub();
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1023, value: 512 },
      runtimeState: { value: 512 },
    };

    const ctrlWiper = { field: 'value', min: 0, max: 1023, step: 1 };
    const strWiper = cc._formatSliderValue(512, ctrlWiper, pot);
    expect(strWiper).toContain('50%');
    expect(strWiper).toContain('5.0kΩ');

    const ctrlRes = { field: 'resistance' };
    const strRes = cc._formatSliderValue(10, ctrlRes, pot);
    expect(strRes).toBe('10 kΩ');
  });

  it('updateSimState populates runtimeState resistance and reads solved wiper voltage', () => {
    const cc = makeCanvasStub();
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1000, value: 500 },
      runtimeState: {},
    };
    cc.components = [pot];
    cc.updateSimState({});

    expect(pot.runtimeState.r_total).toBe(10000);
    expect(pot.runtimeState.r_1w).toBeCloseTo(5000, 0);
    expect(pot.runtimeState.r_w2).toBeCloseTo(5000, 0);
    expect(pot.runtimeState.ratio).toBeCloseTo(0.5, 2);
  });

  it('measures potentiometer resistance with digital multimeter (DMM)', () => {
    const cc = makeCanvasStub();
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1000, value: 500 },
      runtimeState: {},
    };
    const dmm = {
      id: 'dmm1',
      type: 'multimeter',
      props: { mode: 'RES' },
      runtimeState: {},
    };

    // Connect DMM across Pin 1 (vcc) and Wiper
    const wires = [
      { from: { instId: 'dmm1', pinId: 'probe_red' }, to: { instId: 'pot1', pinId: 'vcc' } },
      { from: { instId: 'dmm1', pinId: 'probe_com' }, to: { instId: 'pot1', pinId: 'wiper' } },
    ];

    cc.components = [pot, dmm];
    cc.wires = wires;
    cc.updateSimState({});

    expect(dmm.runtimeState.displayUnit).toBe('kΩ');
    expect(parseFloat(dmm.runtimeState.displayText)).toBeCloseTo(5.0, 1);

    // Change wiper to 20% (value = 200 -> R_1W = 8kΩ)
    pot.props.value = 200;
    cc.updateSimState({});
    expect(parseFloat(dmm.runtimeState.displayText)).toBeCloseTo(8.0, 1);
  });

  it('_readAnalogInput reads voltage from circuit and maps to 0-1023', () => {
    const cc = makeCanvasStub();
    const uno = { id: 'uno1', type: 'arduino_uno' };
    const pwr = { id: 'batt1', type: 'battery', props: { voltage: 5.0 }, runtimeState: {} };
    const gnd = { id: 'gnd1', type: 'power_gnd', props: {}, runtimeState: {} };
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      props: { resistance: 10, unit: 'kΩ', maxValue: 1000, value: 500 },
      runtimeState: {},
    };

    const wires = [
      { from: { instId: 'batt1', pinId: 'pos' }, to: { instId: 'pot1', pinId: 'vcc' } },
      { from: { instId: 'batt1', pinId: 'neg' }, to: { instId: 'pot1', pinId: 'gnd' } },
      { from: { instId: 'pot1', pinId: 'gnd' }, to: { instId: 'gnd1', pinId: 'gnd' } },
      { from: { instId: 'uno1', pinId: 'A0' }, to: { instId: 'pot1', pinId: 'wiper' } },
    ];

    cc.components = [uno, pwr, gnd, pot];
    cc.wires = wires;
    cc.updateSimState({});

    const adc = cc._readAnalogInput('uno1', 'A0');
    expect(adc).toBeCloseTo(512, -1); // 2.5V on a 5V ref maps to ~512
  });
});
