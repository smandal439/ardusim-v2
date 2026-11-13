import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

global.window = {
  ArduinoLibs: {},
  ArduinoComponents: { COMPONENT_DEFS: {} },
  ArduinoSim: null,
  addEventListener() {},
  removeEventListener() {},
};

const ROOT = path.resolve(__dirname, '..');
const loadScripts = (files) => {
  const code = files.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n;\n');
  new Function('window', 'document', code)(global.window, {});
};

loadScripts([
  'js/components/base.js',
  'js/components/passive.js',
  'js/components/power.js',
  'js/components/output.js',
  'js/electrical.js',
]);

function makeNMOSCircuit(gateHigh, withBulb = false) {
  const components = [
    { id: 'supply', type: 'power_5v', props: {}, runtimeState: {} },
    { id: 'ground', type: 'power_gnd', props: {}, runtimeState: {} },
    { id: 'mosfet', type: 'n_mosfet', props: { model: '2N7000', vth: 2.1, rds_on: 1.2 }, runtimeState: {} },
  ];
  if (withBulb) {
    components.push({ id: 'bulb', type: 'bulb_12v', props: {}, runtimeState: {} });
  } else {
    components.push({ id: 'load_res', type: 'resistor', props: { value: 1000 }, runtimeState: {} });
  }

  const wires = [];
  const connect = (a, aPin, b, bPin) => {
    wires.push({ from: { instId: a, pinId: aPin }, to: { instId: b, pinId: bPin } });
  };

  // Drain circuit: Supply -> Load -> Drain; Source -> Ground
  if (withBulb) {
    connect('supply', 'vcc', 'bulb', 'anode');
    connect('bulb', 'cathode', 'mosfet', 'drain');
  } else {
    connect('supply', 'vcc', 'load_res', 'p1');
    connect('load_res', 'p2', 'mosfet', 'drain');
  }
  connect('mosfet', 'source', 'ground', 'gnd');

  // Gate control
  if (gateHigh) {
    connect('supply', 'vcc', 'mosfet', 'gate');
  } else {
    connect('mosfet', 'gate', 'ground', 'gnd');
  }

  const engine = new window.ElectricalEngine();
  engine.buildGraph(components, wires);
  engine.solve();

  return {
    engine,
    mosfet: components.find(c => c.id === 'mosfet'),
    bulb: components.find(c => c.id === 'bulb'),
  };
}

function makePMOSCircuit(gateLow, withBulb = false) {
  const components = [
    { id: 'supply', type: 'power_5v', props: {}, runtimeState: {} },
    { id: 'ground', type: 'power_gnd', props: {}, runtimeState: {} },
    { id: 'mosfet', type: 'p_mosfet', props: { model: 'IRF9540N', vth: -3.0, rds_on: 0.12 }, runtimeState: {} },
  ];
  if (withBulb) {
    components.push({ id: 'bulb', type: 'bulb_12v', props: {}, runtimeState: {} });
  } else {
    components.push({ id: 'load_res', type: 'resistor', props: { value: 1000 }, runtimeState: {} });
  }

  const wires = [];
  const connect = (a, aPin, b, bPin) => {
    wires.push({ from: { instId: a, pinId: aPin }, to: { instId: b, pinId: bPin } });
  };

  // High-side P-MOSFET: Supply -> Source; Drain -> Load -> Ground
  connect('supply', 'vcc', 'mosfet', 'source');
  if (withBulb) {
    connect('mosfet', 'drain', 'bulb', 'anode');
    connect('bulb', 'cathode', 'ground', 'gnd');
  } else {
    connect('mosfet', 'drain', 'load_res', 'p1');
    connect('load_res', 'p2', 'ground', 'gnd');
  }

  // Gate control (Gate Low turns PMOS ON; Gate High turns PMOS OFF)
  if (gateLow) {
    connect('mosfet', 'gate', 'ground', 'gnd');
  } else {
    connect('supply', 'vcc', 'mosfet', 'gate');
  }

  const engine = new window.ElectricalEngine();
  engine.buildGraph(components, wires);
  engine.solve();

  return {
    engine,
    mosfet: components.find(c => c.id === 'mosfet'),
    bulb: components.find(c => c.id === 'bulb'),
  };
}

describe('MOSFET and JFET Components', () => {
  const updateBulb = (engine, bulb) => {
    const Bulb = window.ArduinoComponents.getComponentClass('bulb_12v');
    const instance = new Bulb(bulb);
    instance.canvas = { engine };
    instance.update();
    return bulb.runtimeState.brightness;
  };

  it('registers N-MOSFET, P-MOSFET, N-JFET, and P-JFET with gate, drain, and source pins', () => {
    const defs = window.ArduinoComponents.COMPONENT_DEFS;
    const passiveCatalog = window.ArduinoComponents.COMPONENT_CATALOG.find(g => g.category === 'Passive').ids;

    for (const type of ['n_mosfet', 'p_mosfet', 'n_jfet', 'p_jfet']) {
      expect(defs[type]).toBeTruthy();
      expect(defs[type].pins.map(p => p.id)).toEqual(['gate', 'drain', 'source']);
      expect(passiveCatalog).toContain(type);
    }
  });

  it('supports presets for both MOSFETs and JFETs', () => {
    expect(window.MOSFET_MODELS['2N7000']).toBeTruthy();
    expect(window.MOSFET_MODELS['IRF540N']).toBeTruthy();
    expect(window.MOSFET_MODELS['IRF9540N']).toBeTruthy();

    expect(window.JFET_MODELS['2N5457']).toBeTruthy();
    expect(window.JFET_MODELS['2N3819']).toBeTruthy();
    expect(window.JFET_MODELS['2N5460']).toBeTruthy();
  });

  describe('N-Channel MOSFET (Enhancement Mode)', () => {
    it('turns ON when Gate is driven HIGH (5V > Vth) and powers a load bulb', () => {
      const { engine, mosfet, bulb } = makeNMOSCircuit(true, true);
      expect(mosfet.runtimeState.conducting).toBe(true);
      expect(mosfet.runtimeState.region).toBe('linear');
      expect(mosfet.runtimeState.vgs).toBeGreaterThanOrEqual(4.5);
      expect(engine.getNetForPin('mosfet', 'drain').voltage).toBeLessThan(1.0);
      expect(updateBulb(engine, bulb)).toBeGreaterThan(0);
    });

    it('stays OFF when Gate is driven LOW (0V < Vth) and bulb remains unlit', () => {
      const { engine, mosfet, bulb } = makeNMOSCircuit(false, true);
      expect(mosfet.runtimeState.conducting).toBe(false);
      expect(mosfet.runtimeState.region).toBe('cutoff');
      expect(engine.hasGroundAtPin('mosfet', 'drain')).toBe(false);
      expect(updateBulb(engine, bulb)).toBe(0);
    });

    it('conducts via internal body diode when Source voltage exceeds Drain voltage', () => {
      // Connect Source to 5V, Drain to Ground through a 220Ω resistor
      const components = [
        { id: 'vcc', type: 'power_5v', props: {}, runtimeState: {} },
        { id: 'gnd', type: 'power_gnd', props: {}, runtimeState: {} },
        { id: 'r', type: 'resistor', props: { value: 220 }, runtimeState: {} },
        { id: 'mosfet', type: 'n_mosfet', props: { model: '2N7000' }, runtimeState: {} },
      ];
      const wires = [
        { from: { instId: 'vcc', pinId: 'vcc' }, to: { instId: 'mosfet', pinId: 'source' } },
        { from: { instId: 'mosfet', pinId: 'gate' }, to: { instId: 'gnd', pinId: 'gnd' } },
        { from: { instId: 'mosfet', pinId: 'drain' }, to: { instId: 'r', pinId: 'p1' } },
        { from: { instId: 'r', pinId: 'p2' }, to: { instId: 'gnd', pinId: 'gnd' } },
      ];

      const engine = new window.ElectricalEngine();
      engine.buildGraph(components, wires);
      engine.solve();

      const mos = components.find(c => c.id === 'mosfet');
      expect(mos.runtimeState.body_diode).toBe(true);
      expect(mos.runtimeState.conducting).toBe(true);
      expect(engine.getVoltageAtPin('mosfet', 'drain')).toBeGreaterThan(3.5);
    });
  });

  describe('P-Channel MOSFET (Enhancement Mode)', () => {
    it('turns ON when Gate is driven LOW (Vsg = 5V > |Vth|) and powers load', () => {
      const { engine, mosfet, bulb } = makePMOSCircuit(true, true);
      expect(mosfet.runtimeState.conducting).toBe(true);
      expect(mosfet.runtimeState.region).toBe('linear');
      expect(engine.getVoltageAtPin('mosfet', 'drain')).toBeGreaterThan(4.0);
      expect(updateBulb(engine, bulb)).toBeGreaterThan(0);
    });

    it('stays OFF when Gate is tied to Source rail (Vsg = 0V < |Vth|)', () => {
      const { engine, mosfet, bulb } = makePMOSCircuit(false, true);
      expect(mosfet.runtimeState.conducting).toBe(false);
      expect(mosfet.runtimeState.region).toBe('cutoff');
      expect(engine.getVoltageAtPin('mosfet', 'drain')).toBeLessThan(0.5);
      expect(updateBulb(engine, bulb)).toBe(0);
    });
  });

  describe('N-Channel JFET (Depletion Mode)', () => {
    it('is normally ON at zero gate bias (Vgs = 0V > Vp = -3V)', () => {
      // Connect VCC (5V) -> 1kΩ resistor -> Drain; Source -> GND; Gate -> GND
      const components = [
        { id: 'vcc', type: 'power_5v', props: {}, runtimeState: {} },
        { id: 'gnd', type: 'power_gnd', props: {}, runtimeState: {} },
        { id: 'rd', type: 'resistor', props: { value: 1000 }, runtimeState: {} },
        { id: 'jfet', type: 'n_jfet', props: { model: '2N5457', vp: -3.0, idss: 0.003 }, runtimeState: {} },
      ];
      const wires = [
        { from: { instId: 'vcc', pinId: 'vcc' }, to: { instId: 'rd', pinId: 'p1' } },
        { from: { instId: 'rd', pinId: 'p2' }, to: { instId: 'jfet', pinId: 'drain' } },
        { from: { instId: 'jfet', pinId: 'source' }, to: { instId: 'gnd', pinId: 'gnd' } },
        { from: { instId: 'jfet', pinId: 'gate' }, to: { instId: 'gnd', pinId: 'gnd' } },
      ];

      const engine = new window.ElectricalEngine();
      engine.buildGraph(components, wires);
      engine.solve();

      const jfet = components.find(c => c.id === 'jfet');
      expect(jfet.runtimeState.conducting).toBe(true);
      expect(jfet.runtimeState.region).not.toBe('cutoff');
      expect(jfet.runtimeState.id).toBeGreaterThan(0.001); // Several mA drain current
    });

    it('enters Cutoff when Gate is reverse-biased past pinch-off voltage (Vgs <= Vp)', () => {
      // Use battery to place Source at +5V and Gate at 0V so Vgs = -5V <= Vp (-3V)
      const components = [
        { id: 'vcc10', type: 'battery', props: { voltage: 10 }, runtimeState: { voltage: 10 } },
        { id: 'vcc5', type: 'power_5v', props: {}, runtimeState: {} },
        { id: 'gnd', type: 'power_gnd', props: {}, runtimeState: {} },
        { id: 'rd', type: 'resistor', props: { value: 1000 }, runtimeState: {} },
        { id: 'jfet', type: 'n_jfet', props: { model: '2N5457', vp: -3.0 }, runtimeState: {} },
      ];
      const wires = [
        { from: { instId: 'vcc10', pinId: 'pos' }, to: { instId: 'rd', pinId: 'p1' } },
        { from: { instId: 'rd', pinId: 'p2' }, to: { instId: 'jfet', pinId: 'drain' } },
        // Source is at +5V
        { from: { instId: 'vcc5', pinId: 'vcc' }, to: { instId: 'jfet', pinId: 'source' } },
        // Gate is at 0V (so Vgs = -5V, which is <= -3V)
        { from: { instId: 'jfet', pinId: 'gate' }, to: { instId: 'gnd', pinId: 'gnd' } },
        { from: { instId: 'vcc10', pinId: 'neg' }, to: { instId: 'gnd', pinId: 'gnd' } },
      ];

      const engine = new window.ElectricalEngine();
      engine.buildGraph(components, wires);
      engine.solve();

      const jfet = components.find(c => c.id === 'jfet');
      expect(jfet.runtimeState.region).toBe('cutoff');
      expect(jfet.runtimeState.conducting).toBe(false);
      expect(jfet.runtimeState.id).toBe(0);
    });
  });

  describe('P-Channel JFET (Depletion Mode)', () => {
    it('is normally ON at zero gate bias', () => {
      const components = [
        { id: 'vcc', type: 'power_5v', props: {}, runtimeState: {} },
        { id: 'gnd', type: 'power_gnd', props: {}, runtimeState: {} },
        { id: 'rd', type: 'resistor', props: { value: 1000 }, runtimeState: {} },
        { id: 'jfet', type: 'p_jfet', props: { model: '2N5460', vp: 2.5, idss: 0.0025 }, runtimeState: {} },
      ];
      const wires = [
        { from: { instId: 'vcc', pinId: 'vcc' }, to: { instId: 'jfet', pinId: 'source' } },
        { from: { instId: 'jfet', pinId: 'drain' }, to: { instId: 'rd', pinId: 'p1' } },
        { from: { instId: 'rd', pinId: 'p2' }, to: { instId: 'gnd', pinId: 'gnd' } },
        // Gate tied to Source rail so Vgs = 0V (< Vp = 2.5V)
        { from: { instId: 'jfet', pinId: 'gate' }, to: { instId: 'vcc', pinId: 'vcc' } },
      ];

      const engine = new window.ElectricalEngine();
      engine.buildGraph(components, wires);
      engine.solve();

      const jfet = components.find(c => c.id === 'jfet');
      expect(jfet.runtimeState.conducting).toBe(true);
      expect(jfet.runtimeState.region).not.toBe('cutoff');
    });
  });

  describe('Resistance Measurement', () => {
    it('measures low Rds across drain-source when conducting', () => {
      const { engine, mosfet } = makeNMOSCircuit(true, false);
      const r = engine.measureResistance('mosfet', 'drain', 'mosfet', 'source');
      expect(r).toBeLessThan(10); // Rds is around ~1.2Ω
    });
  });
});
