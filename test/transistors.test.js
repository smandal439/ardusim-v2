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

function makeTransistorCircuit(type, conducting, withBulb = false) {
  const components = [
    { id: 'supply', type: 'power_5v', props: {}, runtimeState: {} },
    { id: 'ground', type: 'power_gnd', props: {}, runtimeState: {} },
    { id: 'base_resistor', type: 'resistor', props: { value: 1000 }, runtimeState: {} },
    { id: 'collector_resistor', type: 'resistor', props: { value: 220 }, runtimeState: {} },
    { id: 'transistor', type, props: {}, runtimeState: {} },
  ];
  if (withBulb) {
    components.push({ id: 'bulb', type: 'bulb_12v', props: {}, runtimeState: {} });
  }
  const wires = [];
  const connect = (a, aPin, b, bPin) => {
    wires.push({
      from: { instId: a, pinId: aPin },
      to: { instId: b, pinId: bPin },
    });
  };

  if (type === 'npn_transistor') {
    if (withBulb) {
      connect('supply', 'vcc', 'bulb', 'anode');
      connect('bulb', 'cathode', 'transistor', 'collector');
    } else {
      connect('supply', 'vcc', 'collector_resistor', 'p1');
      connect('collector_resistor', 'p2', 'transistor', 'collector');
    }
    connect('transistor', 'emitter', 'ground', 'gnd');
    if (conducting) {
      components.push({ id: 'base_pull', type: 'resistor', props: { value: 10000 }, runtimeState: {} });
      connect('supply', 'vcc', 'base_resistor', 'p1');
      connect('base_resistor', 'p2', 'transistor', 'base');
      connect('transistor', 'base', 'base_pull', 'p1');
      connect('base_pull', 'p2', 'ground', 'gnd');
    } else {
      connect('transistor', 'base', 'ground', 'gnd');
    }
  } else {
    connect('transistor', 'emitter', 'supply', 'vcc');
    connect('collector_resistor', 'p1', 'transistor', 'collector');
    connect('collector_resistor', 'p2', 'ground', 'gnd');
    if (conducting) {
      connect('transistor', 'base', 'base_resistor', 'p1');
      connect('base_resistor', 'p2', 'ground', 'gnd');
    } else {
      connect('transistor', 'base', 'supply', 'vcc');
    }
  }

  const engine = new window.ElectricalEngine();
  engine.buildGraph(components, wires);
  engine.solve();
  return {
    engine,
    transistor: components.find(c => c.id === 'transistor'),
    bulb: components.find(c => c.id === 'bulb'),
  };
}

function makeDiodeCircuit(forwardBiased) {
  const components = [
    { id: 'supply', type: 'power_5v', props: {}, runtimeState: {} },
    { id: 'ground', type: 'power_gnd', props: {}, runtimeState: {} },
    { id: 'bulb', type: 'bulb_12v', props: {}, runtimeState: {} },
    { id: 'diode', type: 'diode_1n4007', props: {}, runtimeState: {} },
  ];
  const wires = [];
  const connect = (a, aPin, b, bPin) => {
    wires.push({
      from: { instId: a, pinId: aPin },
      to: { instId: b, pinId: bPin },
    });
  };

  connect('supply', 'vcc', 'bulb', 'anode');
  if (forwardBiased) {
    connect('bulb', 'cathode', 'diode', 'anode');
    connect('diode', 'cathode', 'ground', 'gnd');
  } else {
    connect('bulb', 'cathode', 'diode', 'cathode');
    connect('diode', 'anode', 'ground', 'gnd');
  }

  const engine = new window.ElectricalEngine();
  engine.buildGraph(components, wires);
  engine.solve();
  const Bulb = window.ArduinoComponents.getComponentClass('bulb_12v');
  const bulbInstance = new Bulb(components.find(component => component.id === 'bulb'));
  bulbInstance.canvas = { engine };
  bulbInstance.update();
  return {
    engine,
    diode: components.find(component => component.id === 'diode'),
    bulb: components.find(component => component.id === 'bulb'),
  };
}

describe('NPN and PNP transistors', () => {
  const updateBulb = (engine, bulb) => {
    const Bulb = window.ArduinoComponents.getComponentClass('bulb_12v');
    const instance = new Bulb(bulb);
    instance.canvas = { engine };
    instance.update();
    return bulb.runtimeState.brightness;
  };

  it('registers both transistor variants with base, collector, and emitter pins', () => {
    const defs = window.ArduinoComponents.COMPONENT_DEFS;
    for (const type of ['npn_transistor', 'pnp_transistor']) {
      expect(defs[type]).toBeTruthy();
      expect(defs[type].pins.map(pin => pin.id)).toEqual(['base', 'collector', 'emitter']);
      expect(window.ArduinoComponents.COMPONENT_CATALOG
        .find(group => group.category === 'Passive').ids).toContain(type);
    }
  });

  it('turns an NPN on when its base is above its emitter', () => {
    const { engine, transistor, bulb } = makeTransistorCircuit('npn_transistor', true, true);
    expect(transistor.runtimeState.conducting).toBe(true);
    expect(engine.getNetForPin('transistor', 'collector').voltage).toBeLessThan(3);
    expect(updateBulb(engine, bulb)).toBeGreaterThan(0);
  });

  it('keeps an NPN off when its base is tied to its emitter', () => {
    const { engine, transistor, bulb } = makeTransistorCircuit('npn_transistor', false, true);
    expect(transistor.runtimeState.conducting).toBe(false);
    expect(engine.hasGroundAtPin('transistor', 'collector')).toBe(false);
    expect(updateBulb(engine, bulb)).toBe(0);
  });

  it('turns a PNP on when its base is below its emitter', () => {
    const { engine, transistor } = makeTransistorCircuit('pnp_transistor', true);
    expect(transistor.runtimeState.conducting).toBe(true);
    expect(engine.getNetForPin('transistor', 'collector').voltage).toBeGreaterThan(4);
  });

  it('keeps a PNP off when its base is at its emitter voltage', () => {
    const { engine, transistor } = makeTransistorCircuit('pnp_transistor', false);
    expect(transistor.runtimeState.conducting).toBe(false);
    expect(engine.getNetForPin('transistor', 'collector').voltage).toBeLessThan(1);
  });

  it('conducts from anode to cathode and lights a series bulb', () => {
    const { engine, diode, bulb } = makeDiodeCircuit(true);
    expect(diode.runtimeState.conducting).toBe(true);
    expect(engine.getVoltageAtPin('diode', 'anode')).toBeGreaterThan(
      engine.getVoltageAtPin('diode', 'cathode')
    );
    expect(bulb.runtimeState.brightness).toBeGreaterThan(0);
  });

  it('blocks reverse current and keeps a series bulb off', () => {
    const { engine, diode, bulb } = makeDiodeCircuit(false);
    expect(diode.runtimeState.conducting).toBe(false);
    expect(engine.hasGroundAtPin('bulb', 'cathode')).toBe(false);
    expect(bulb.runtimeState.brightness).toBe(0);
  });
});
