import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

global.window = {
  ArduinoLibs: {},
  ArduinoComponents: { COMPONENT_DEFS: {} },
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

function loadScripts(files, names) {
  const code = files.map(readSrc).join('\n;\n');
  const fn = new Function('window', 'document',
    code + '\n;return {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ') + '};');
  return fn(global.window, global.document);
}

const { COMPONENT_CATALOG, COMPONENT_DEFS, getComponentClass, createComponent, PIN_TYPE } = loadScripts([
  'js/components/base.js',
  'js/components/power.js',
  'js/components/function_generator.js',
  'js/components/probe.js',
  'js/components/logic_tag.js',
  'js/components/output.js',
  'js/components/ics.js',
  'js/components/ic_8255.js',
], ['COMPONENT_CATALOG', 'COMPONENT_DEFS', 'getComponentClass', 'createComponent', 'PIN_TYPE']);

const { ArduinoSimulator } = loadScripts(['js/simulator.js'], ['ArduinoSimulator']);

const ANALOG_ICS = ['lm358', 'lm393', 'lm324', 'cd4066'];
const DIGITAL_ICS = ['ic_74hc14', 'ic_74hc283', 'ic_74hc85', 'ic_74hc151', 'ic_74hc76'];
const ALL_NEW_ICS = [...ANALOG_ICS, ...DIGITAL_ICS];

function makeIC(type) {
  const comp = createComponent({ id: `t_${type}`, type, x: 0, y: 0, rotation: 0, props: {} });
  expect(comp, `createComponent(${type})`).toBeTruthy();
  comp.getConnectedPinNum = () => null;
  return comp;
}

function pinCtx() {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set: () => true,
  });
}

describe('Extended IC Catalog & Registration', () => {
  it('COMPONENT_CATALOG includes Analog ICs category', () => {
    const analogGroup = COMPONENT_CATALOG.find(g => g.category === 'Analog ICs');
    expect(analogGroup).toBeTruthy();
    for (const id of ANALOG_ICS) {
      expect(analogGroup.ids).toContain(id);
    }
  });

  it('COMPONENT_CATALOG Digital ICs includes all 5 new digital ICs', () => {
    const digGroup = COMPONENT_CATALOG.find(g => g.category === 'Digital ICs');
    expect(digGroup).toBeTruthy();
    for (const id of DIGITAL_ICS) {
      expect(digGroup.ids).toContain(id);
    }
  });

  for (const id of ALL_NEW_ICS) {
    it(`${id}: component def and class registered with matching pins`, () => {
      const def = COMPONENT_DEFS[id];
      expect(def, `def ${id}`).toBeTruthy();
      const Cls = getComponentClass(id);
      expect(Cls, `class ${id}`).toBeTruthy();
      const clsPins = Cls.prototype.getPins().map(p => p.id);
      const defPins = def.pins.map(p => p.id);
      expect(clsPins).toEqual(defPins);
      expect(new Set(defPins).size).toBe(defPins.length);
      expect(defPins).toContain('VCC');
      expect(defPins).toContain('GND');
    });

    it(`${id}: draw() smoke test succeeds`, () => {
      const def = COMPONENT_DEFS[id];
      expect(() => def.draw(pinCtx(), { x: 10, y: 10, selected: true, runtimeState: {} }, null)).not.toThrow();
    });
  }
});

describe('74HC14 Hex Schmitt NOT Inverter Logic', () => {
  it('inverts all 6 independent channels (0->1, 1->0)', () => {
    const ic = makeIC('ic_74hc14');
    const gates = [['A1', 'Y1'], ['A2', 'Y2'], ['A3', 'Y3'], ['A4', 'Y4'], ['A5', 'Y5'], ['A6', 'Y6']];

    // Inputs = 0 -> Outputs = 255 (HIGH)
    ic.props = { forcedInputs: { A1: 0, A2: 0, A3: 0, A4: 0, A5: 0, A6: 0 } };
    ic.update(null);
    for (const [_, outPin] of gates) {
      expect(ic.runtimeState[outPin]).toBe(255);
    }

    // Inputs = 1 -> Outputs = 0 (LOW)
    ic.props = { forcedInputs: { A1: 1, A2: 1, A3: 1, A4: 1, A5: 1, A6: 1 } };
    ic.update(null);
    for (const [_, outPin] of gates) {
      expect(ic.runtimeState[outPin]).toBe(0);
    }

    // Mixed inputs
    ic.props = { forcedInputs: { A1: 1, A2: 0, A3: 1, A4: 0, A5: 1, A6: 0 } };
    ic.update(null);
    expect(ic.runtimeState.Y1).toBe(0);
    expect(ic.runtimeState.Y2).toBe(255);
    expect(ic.runtimeState.Y3).toBe(0);
    expect(ic.runtimeState.Y4).toBe(255);
    expect(ic.runtimeState.Y5).toBe(0);
    expect(ic.runtimeState.Y6).toBe(255);
  });
});

describe('74HC283 4-Bit Binary Full Adder Logic', () => {
  it('correctly calculates binary addition with carry input and output', () => {
    const ic = makeIC('ic_74hc283');

    const testAdd = (a, b, c0) => {
      ic.props = {
        forcedInputs: {
          A1: a & 1, A2: (a >> 1) & 1, A3: (a >> 2) & 1, A4: (a >> 3) & 1,
          B1: b & 1, B2: (b >> 1) & 1, B3: (b >> 2) & 1, B4: (b >> 3) & 1,
          C0: c0,
        }
      };
      ic.update(null);
      const s = (ic.runtimeState.S1 ? 1 : 0) |
                ((ic.runtimeState.S2 ? 1 : 0) << 1) |
                ((ic.runtimeState.S3 ? 1 : 0) << 2) |
                ((ic.runtimeState.S4 ? 1 : 0) << 3);
      const c4 = ic.runtimeState.C4 ? 1 : 0;
      return { sum: s, c4, total: s + (c4 << 4) };
    };

    expect(testAdd(0, 0, 0)).toEqual({ sum: 0, c4: 0, total: 0 });
    expect(testAdd(5, 3, 0)).toEqual({ sum: 8, c4: 0, total: 8 });
    expect(testAdd(9, 6, 0)).toEqual({ sum: 15, c4: 0, total: 15 });
    expect(testAdd(9, 7, 0)).toEqual({ sum: 0, c4: 1, total: 16 });
    expect(testAdd(15, 1, 0)).toEqual({ sum: 0, c4: 1, total: 16 });
    expect(testAdd(15, 15, 0)).toEqual({ sum: 14, c4: 1, total: 30 });
    expect(testAdd(7, 8, 1)).toEqual({ sum: 0, c4: 1, total: 16 });
    expect(testAdd(15, 15, 1)).toEqual({ sum: 15, c4: 1, total: 31 });
  });
});

describe('74HC85 4-Bit Magnitude Comparator Logic', () => {
  it('evaluates A > B, A < B, and A = B correctly', () => {
    const ic = makeIC('ic_74hc85');

    const compare = (a, b, cascade = { iG: 0, iE: 1, iL: 0 }) => {
      ic.props = {
        forcedInputs: {
          A0: a & 1, A1: (a >> 1) & 1, A2: (a >> 2) & 1, A3: (a >> 3) & 1,
          B0: b & 1, B1: (b >> 1) & 1, B2: (b >> 2) & 1, B3: (b >> 3) & 1,
          I_AGT_B: cascade.iG, I_AEQ_B: cascade.iE, I_ALT_B: cascade.iL,
        }
      };
      ic.update(null);
      return {
        gt: ic.runtimeState.QA_GT_B ? 1 : 0,
        eq: ic.runtimeState.QA_EQ_B ? 1 : 0,
        lt: ic.runtimeState.QA_LT_B ? 1 : 0,
      };
    };

    // A > B
    expect(compare(9, 4)).toEqual({ gt: 1, eq: 0, lt: 0 });
    expect(compare(15, 14)).toEqual({ gt: 1, eq: 0, lt: 0 });

    // A < B
    expect(compare(2, 11)).toEqual({ gt: 0, eq: 0, lt: 1 });
    expect(compare(0, 1)).toEqual({ gt: 0, eq: 0, lt: 1 });

    // A == B
    expect(compare(7, 7, { iG: 0, iE: 1, iL: 0 })).toEqual({ gt: 0, eq: 1, lt: 0 });
    // A == B cascading from lower stage
    expect(compare(5, 5, { iG: 1, iE: 0, iL: 0 })).toEqual({ gt: 1, eq: 0, lt: 0 });
    expect(compare(5, 5, { iG: 0, iE: 0, iL: 1 })).toEqual({ gt: 0, eq: 0, lt: 1 });
  });
});

describe('74HC151 8:1 MUX Logic', () => {
  it('selects each input D0..D7 onto output Y and inverted W', () => {
    const ic = makeIC('ic_74hc151');
    const pattern = [1, 0, 1, 1, 0, 0, 1, 0];

    for (let sel = 0; sel < 8; sel++) {
      const bitA = sel & 1;
      const bitB = (sel >> 1) & 1;
      const bitC = (sel >> 2) & 1;
      const inputs = { G: 0, A: bitA, B: bitB, C: bitC };
      for (let i = 0; i < 8; i++) inputs[`D${i}`] = pattern[i];

      ic.props = { forcedInputs: inputs };
      ic.update(null);

      const expectedBit = pattern[sel];
      expect(ic.runtimeState.Y, `sel=${sel} Y`).toBe(expectedBit ? 255 : 0);
      expect(ic.runtimeState.W, `sel=${sel} W`).toBe(expectedBit ? 0 : 255);
    }
  });

  it('strobe HIGH disables outputs (Y=0, W=1)', () => {
    const ic = makeIC('ic_74hc151');
    ic.props = {
      forcedInputs: {
        G: 1, A: 0, B: 0, C: 0,
        D0: 1, D1: 1, D2: 1, D3: 1, D4: 1, D5: 1, D6: 1, D7: 1
      }
    };
    ic.update(null);
    expect(ic.runtimeState.Y).toBe(0);
    expect(ic.runtimeState.W).toBe(255);
  });
});

describe('74HC76 Dual J-K Flip-Flop Logic', () => {
  it('honors asynchronous PRE and CLR inputs', () => {
    const ic = makeIC('ic_74hc76');

    // Preset active (PRE=0, CLR=1) -> Q=1
    ic.props = { forcedInputs: { '1PRE': 0, '1CLR': 1, '1CLK': 1, '1J': 0, '1K': 0, '2PRE': 1, '2CLR': 1, '2CLK': 1, '2J': 0, '2K': 0 } };
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(255);
    expect(ic.runtimeState['1Qn']).toBe(0);

    // Clear active (PRE=1, CLR=0) -> Q=0
    ic.props = { forcedInputs: { '1PRE': 1, '1CLR': 0, '1CLK': 1, '1J': 0, '1K': 0, '2PRE': 1, '2CLR': 1, '2CLK': 1, '2J': 0, '2K': 0 } };
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(0);
    expect(ic.runtimeState['1Qn']).toBe(255);
  });

  it('toggles, sets, resets and holds on falling clock edges', () => {
    const ic = makeIC('ic_74hc76');
    ic.runtimeState = { q1: 0, prevClk1: 1 };

    // Set: J=1, K=0 on clock high then falling edge
    ic.props = { forcedInputs: { '1PRE': 1, '1CLR': 1, '1CLK': 1, '1J': 1, '1K': 0, '2PRE': 1, '2CLR': 1, '2CLK': 1, '2J': 0, '2K': 0 } };
    ic.update(null);
    ic.props.forcedInputs['1CLK'] = 0; // falling edge
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(255);

    // Hold: J=0, K=0 on falling edge
    ic.props.forcedInputs['1CLK'] = 1; ic.props.forcedInputs['1J'] = 0; ic.props.forcedInputs['1K'] = 0;
    ic.update(null);
    ic.props.forcedInputs['1CLK'] = 0;
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(255);

    // Reset: J=0, K=1 on falling edge
    ic.props.forcedInputs['1CLK'] = 1; ic.props.forcedInputs['1J'] = 0; ic.props.forcedInputs['1K'] = 1;
    ic.update(null);
    ic.props.forcedInputs['1CLK'] = 0;
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(0);

    // Toggle: J=1, K=1 on falling edge
    ic.props.forcedInputs['1CLK'] = 1; ic.props.forcedInputs['1J'] = 1; ic.props.forcedInputs['1K'] = 1;
    ic.update(null);
    ic.props.forcedInputs['1CLK'] = 0;
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(255); // 0 -> 1

    ic.props.forcedInputs['1CLK'] = 1;
    ic.update(null);
    ic.props.forcedInputs['1CLK'] = 0;
    ic.update(null);
    expect(ic.runtimeState['1Q']).toBe(0); // 1 -> 0
  });
});

describe('LM358 & LM324 Op-Amp Simulation', () => {
  it('LM358 differential inputs saturate output to supply / ground', () => {
    const ic = makeIC('lm358');
    const sim = {
      voltages: { '1IN+': 3.0, '1IN-': 2.0, '2IN+': 1.0, '2IN-': 4.0 },
      getPinVoltage(inst, pid) { return this.voltages[pid] || 0; }
    };
    global.window.ArduinoSim = sim;

    ic.update(null);
    expect(ic.runtimeState['1OUT']).toBe(5.0);
    expect(ic.runtimeState['2OUT']).toBe(0.0);
  });

  it('LM324 evaluates all 4 channels independently', () => {
    const ic = makeIC('lm324');
    const sim = {
      voltages: {
        '1IN+': 3.5, '1IN-': 1.5,
        '2IN+': 0.5, '2IN-': 2.5,
        '3IN+': 4.0, '3IN-': 1.0,
        '4IN+': 1.0, '4IN-': 4.0,
      },
      getPinVoltage(inst, pid) { return this.voltages[pid] || 0; }
    };
    global.window.ArduinoSim = sim;

    ic.update(null);
    expect(ic.runtimeState['1OUT']).toBe(5.0);
    expect(ic.runtimeState['2OUT']).toBe(0.0);
    expect(ic.runtimeState['3OUT']).toBe(5.0);
    expect(ic.runtimeState['4OUT']).toBe(0.0);
  });
});

describe('LM393 Dual Comparator Simulation', () => {
  it('compares IN+ vs IN- for threshold switching', () => {
    const ic = makeIC('lm393');
    const sim = {
      voltages: { '1IN+': 3.3, '1IN-': 2.5, '2IN+': 1.2, '2IN-': 2.5 },
      getPinVoltage(inst, pid) { return this.voltages[pid] || 0; }
    };
    global.window.ArduinoSim = sim;

    ic.update(null);
    expect(ic.runtimeState['1OUT']).toBe(255);
    expect(ic.runtimeState['2OUT']).toBe(0);
  });
});

describe('CD4066 Quad Bilateral Switch Simulation', () => {
  it('transfers signal when control is HIGH, blocks when LOW', () => {
    const ic = makeIC('cd4066');
    const sim = {
      voltages: {
        CTL1: 5.0, SIG1A: 5.0,
        CTL2: 0.0, SIG2A: 5.0,
        CTL3: 5.0, SIG3A: 2.5,
        CTL4: 0.0, SIG4A: 2.5,
      },
      getPinVoltage(inst, pid) { return this.voltages[pid] || 0; }
    };
    global.window.ArduinoSim = sim;

    ic.update(null);
    expect(ic.runtimeState.SIG1B).toBe(255); // CTL1 HIGH -> 5V passed
    expect(ic.runtimeState.SIG2B).toBe(0);   // CTL2 LOW -> blocked
    expect(ic.runtimeState.SIG3B).toBe(128); // CTL3 HIGH -> 2.5V passed (~128)
    expect(ic.runtimeState.SIG4B).toBe(0);   // CTL4 LOW -> blocked
  });
});

describe('Probe Voltage Read Path for Extended ICs', () => {
  const sim = new ArduinoSimulator();
  const probe = { id: 'la_ext', type: 'la_probe_ch1' };
  let prevCanvas;
  beforeEach(() => { prevCanvas = global.window.CircuitCanvas; });
  afterEach(() => { global.window.CircuitCanvas = prevCanvas; });

  function wireTo(type, pin, runtimeState) {
    const target = { id: 't_target', type, runtimeState };
    global.window.CircuitCanvas = {
      components: [target],
      wires: [{ id: 'w1', from: { instId: probe.id, pinId: 'tip' }, to: { instId: target.id, pinId: pin } }],
      _getConnectedPinNum: () => null,
    };
    return target;
  }

  it('reads op-amp voltages directly', () => {
    wireTo('lm358', '1OUT', { '1OUT': 3.7 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(3.7);

    wireTo('lm324', '3OUT', { '3OUT': 4.2 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(4.2);
  });

  it('reads digital IC output levels correctly', () => {
    wireTo('ic_74hc14', 'Y1', { Y1: 255 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(5.0);

    wireTo('ic_74hc283', 'S1', { S1: 0 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(0.0);

    wireTo('ic_74hc85', 'QA_GT_B', { QA_GT_B: 255 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(5.0);

    wireTo('ic_74hc151', 'Y', { Y: 255 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(5.0);

    wireTo('ic_74hc76', '1Q', { '1Q': 255 });
    expect(sim.getPinVoltage(probe, 'tip')).toBe(5.0);
  });
});
