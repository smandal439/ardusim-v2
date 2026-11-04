import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── Minimal browser-like globals ── */
global.window = {
  ArduinoLibs: {},
  ArduinoComponents: { COMPONENT_DEFS: {} },
  ArduinoSim: null,
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

const { COMPONENT_DEFS, clampPropValue, _fgNum, _fgBool } = loadScripts([
  'js/components/base.js',
  'js/components/function_generator.js',
], ['COMPONENT_DEFS', 'clampPropValue', '_fgNum', '_fgBool']);

const { CircuitCanvas } = loadScripts([
  'js/electrical.js',
  'js/components/base.js',
  'js/components/function_generator.js',
  'js/canvas.js',
], ['CircuitCanvas']);

const fgDef = COMPONENT_DEFS.func_gen;

function fgInst(overrides = {}) {
  return {
    type: 'func_gen',
    id: 'fg_test_1',
    x: 0,
    y: 0,
    props: { ...fgDef.defaultProps, ...overrides },
    runtimeState: {},
  };
}

const sim = {
  simTime: 137, // ms
  setPinVoltage(inst, pin, v) {},
};

describe('Enhanced Function Generator: Waveforms', () => {
  it('declares and synthesizes all 11 waveforms', () => {
    const expected = [
      'sine', 'square', 'triangle', 'sawtooth', 'ramp_down',
      'pulse', 'exp_rise', 'ecg', 'staircase', 'noise', 'dc',
    ];

    const waveCtrl = fgDef.interactive.find(c => c.field === 'ch1_wave');
    expect(waveCtrl).toBeTruthy();
    const options = waveCtrl.options.map(o => o.value);
    for (const w of expected) {
      expect(options).toContain(w);
    }

    // Synthesize each waveform without errors
    for (const w of expected) {
      const inst = fgInst({ ch1_wave: w });
      expect(() => fgDef.step(inst, sim)).not.toThrow();
      expect(Number.isFinite(inst.runtimeState.ch1_voltage)).toBe(true);
    }
  });

  it('synthesizes pure DC reference voltage as offset', () => {
    const inst = fgInst({ ch1_wave: 'dc', ch1_offset: 2.75, ch1_amp: 6.0 });
    fgDef.step(inst, sim);
    expect(inst.runtimeState.ch1_voltage).toBeCloseTo(2.75, 4);

    const instNeg = fgInst({ ch1_wave: 'dc', ch1_offset: -3.5 });
    fgDef.step(instNeg, sim);
    expect(instNeg.runtimeState.ch1_voltage).toBeCloseTo(-3.5, 4);
  });

  it('synthesizes cardiac ECG waveform with realistic peaks', () => {
    // 1 Hz ECG signal: period is 1.0s = 1000ms
    // R-wave peak is around 400ms (tau = 0.40)
    // S-wave trough is around 450ms (tau = 0.45)
    const instR = fgInst({ ch1_wave: 'ecg', ch1_freq: 1, ch1_amp: 4, ch1_offset: 0, ch1_phase: 0 });
    fgDef.step(instR, { simTime: 400 });
    const vR = instR.runtimeState.ch1_voltage;

    const instS = fgInst({ ch1_wave: 'ecg', ch1_freq: 1, ch1_amp: 4, ch1_offset: 0, ch1_phase: 0 });
    fgDef.step(instS, { simTime: 450 });
    const vS = instS.runtimeState.ch1_voltage;

    expect(vR).toBeGreaterThan(vS);
    expect(vR).toBeGreaterThan(1.0); // sharp positive QRS deflection
    expect(vS).toBeLessThan(0.0);   // negative S deflection
  });

  it('synthesizes ramp down with negative slope', () => {
    // 100 Hz ramp down: period 10ms
    // simTime: 1ms (tau=0.1) -> v1 should be higher than simTime: 3ms (tau=0.3)
    const inst1 = fgInst({ ch1_wave: 'ramp_down', ch1_freq: 100, ch1_amp: 2, ch1_offset: 0, ch1_phase: 0 });
    fgDef.step(inst1, { simTime: 1 });
    const v1 = inst1.runtimeState.ch1_voltage;

    const inst2 = fgInst({ ch1_wave: 'ramp_down', ch1_freq: 100, ch1_amp: 2, ch1_offset: 0, ch1_phase: 0 });
    fgDef.step(inst2, { simTime: 3 });
    const v2 = inst2.runtimeState.ch1_voltage;

    expect(v1).toBeGreaterThan(v2);
  });

  it('synthesizes exponential rise curve', () => {
    // Exponential rise has positive slope that flattens out
    const instA = fgInst({ ch1_wave: 'exp_rise', ch1_freq: 10, ch1_amp: 2, ch1_offset: 0, ch1_phase: 0 });
    fgDef.step(instA, { simTime: 10 }); // tau = 0.1
    const vA = instA.runtimeState.ch1_voltage;

    const instB = fgInst({ ch1_wave: 'exp_rise', ch1_freq: 10, ch1_amp: 2, ch1_offset: 0, ch1_phase: 0 });
    fgDef.step(instB, { simTime: 80 }); // tau = 0.8
    const vB = instB.runtimeState.ch1_voltage;

    expect(vB).toBeGreaterThan(vA);
  });
});

describe('Enhanced Function Generator: Independent Output Enable', () => {
  it('allows disabling CH1 output while CH2 continues running', () => {
    const inst = fgInst({ ch1_en: 0, ch2_en: 1 });
    fgDef.step(inst, sim);
    expect(inst.runtimeState.ch1_voltage).toBe(0);
    expect(inst.runtimeState.ch2_voltage).not.toBe(0);
  });

  it('allows disabling CH2 output while CH1 continues running', () => {
    const inst = fgInst({ ch1_en: 1, ch2_en: 0 });
    fgDef.step(inst, sim);
    expect(inst.runtimeState.ch1_voltage).not.toBe(0);
    expect(inst.runtimeState.ch2_voltage).toBe(0);
  });

  it('reads channel output enable from runtimeState first', () => {
    const inst = fgInst({ ch1_en: 1 });
    inst.runtimeState.ch1_en = 0;
    fgDef.step(inst, sim);
    expect(inst.runtimeState.ch1_voltage).toBe(0);
  });
});

describe('Enhanced Function Generator: Modulation Capabilities', () => {
  it('applies Amplitude Modulation (AM) to output envelope', () => {
    const instPeak = fgInst({
      ch1_wave: 'square',
      ch1_freq: 1000,
      ch1_amp: 6.0,
      ch1_offset: 0,
      ch1_phase: 0,
      ch1_duty: 90,
      ch1_mod: 'am',
      ch1_mod_freq: 10,
      ch1_mod_depth: 80,
    });
    fgDef.step(instPeak, { simTime: 0 });
    const vPeak = Math.abs(instPeak.runtimeState.ch1_voltage);

    const instTrough = fgInst({
      ch1_wave: 'square',
      ch1_freq: 1000,
      ch1_amp: 6.0,
      ch1_offset: 0,
      ch1_phase: 0,
      ch1_duty: 90,
      ch1_mod: 'am',
      ch1_mod_freq: 10,
      ch1_mod_depth: 80,
    });
    fgDef.step(instTrough, { simTime: 50 });
    const vTrough = Math.abs(instTrough.runtimeState.ch1_voltage);

    expect(vPeak).toBeGreaterThan(vTrough);
    expect(vPeak).toBeCloseTo(3.0, 1);
  });

  it('applies Frequency Modulation (FM)', () => {
    const inst = fgInst({
      ch1_wave: 'sine',
      ch1_freq: 1000,
      ch1_mod: 'fm',
      ch1_mod_freq: 50,
      ch1_mod_depth: 50,
    });
    expect(() => fgDef.step(inst, { simTime: 10 })).not.toThrow();
    expect(Number.isFinite(inst.runtimeState.ch1_voltage)).toBe(true);
  });

  it('applies Linear Frequency Sweep', () => {
    const inst = fgInst({
      ch1_wave: 'sine',
      ch1_freq: 500,
      ch1_mod: 'sweep',
      ch1_mod_freq: 1,
      ch1_mod_depth: 80,
    });
    expect(() => fgDef.step(inst, { simTime: 250 })).not.toThrow();
    expect(Number.isFinite(inst.runtimeState.ch1_voltage)).toBe(true);
  });
});

describe('Enhanced Function Generator: Inter-Channel Synchronization', () => {
  it('synchronizes CH2 frequency to CH1 in freq_track mode', () => {
    const inst = fgInst({
      ch_sync: 'freq_track',
      ch1_freq: 250,
      ch2_freq: 9999,
      ch1_wave: 'sawtooth',
      ch2_wave: 'sawtooth',
      ch1_amp: 2,
      ch2_amp: 2,
      ch1_offset: 0,
      ch2_offset: 0,
      ch1_phase: 0,
      ch2_phase: 0,
    });
    fgDef.step(inst, { simTime: 2 });
    expect(inst.runtimeState.ch1_voltage).toBeCloseTo(0, 1);
    expect(inst.runtimeState.ch2_voltage).toBeCloseTo(0, 1);
  });

  it('locks phase and frequency in phase_sync mode for quadrature signals', () => {
    const inst = fgInst({
      ch_sync: 'phase_sync',
      ch1_freq: 1000,
      ch1_wave: 'sine',
      ch2_wave: 'sine',
      ch1_amp: 2,
      ch2_amp: 2,
      ch1_offset: 0,
      ch2_offset: 0,
      ch1_phase: 0,
      ch2_phase: 90,
    });
    fgDef.step(inst, { simTime: 0 });
    expect(inst.runtimeState.ch1_voltage).toBeCloseTo(0, 2);
    expect(inst.runtimeState.ch2_voltage).toBeCloseTo(1.0, 2);
  });
});

describe('Enhanced Function Generator: Impedance Load Scaling', () => {
  it('halves output voltage in 50 Ohm load mode matching RF generators', () => {
    const hiZ = fgInst({ ch1_wave: 'dc', ch1_offset: 2.0, load_imp: 'highz' });
    fgDef.step(hiZ, sim);

    const load50 = fgInst({ ch1_wave: 'dc', ch1_offset: 2.0, load_imp: '50' });
    fgDef.step(load50, sim);

    expect(hiZ.runtimeState.ch1_voltage).toBeCloseTo(2.0, 2);
    expect(load50.runtimeState.ch1_voltage).toBeCloseTo(1.0, 2);
  });
});

describe('Enhanced Function Generator: Interactive Buttons on Canvas', () => {
  it('toggles CH1 and CH2 output with ch1Out / ch2Out buttons', () => {
    const inst = fgInst({ ch1_en: 1, ch2_en: 1 });
    const cc = CircuitCanvas.prototype;

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Out');
    expect(inst.props.ch1_en).toBe(0);

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Out');
    expect(inst.props.ch1_en).toBe(1);

    cc._handleFuncGenButtonClick.call({}, inst, 'ch2Out');
    expect(inst.props.ch2_en).toBe(0);
  });

  it('cycles through all 11 waveforms with ch1Wave button', () => {
    const inst = fgInst({ ch1_wave: 'sine' });
    const cc = CircuitCanvas.prototype;

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Wave');
    expect(inst.props.ch1_wave).toBe('square');

    // Cycle through remaining 10 waveforms
    for (let i = 0; i < 10; i++) {
      cc._handleFuncGenButtonClick.call({}, inst, 'ch1Wave');
    }
    expect(inst.props.ch1_wave).toBe('sine');
  });

  it('cycles sync modes with chSync button', () => {
    const inst = fgInst({ ch_sync: 'off' });
    const cc = CircuitCanvas.prototype;

    cc._handleFuncGenButtonClick.call({}, inst, 'chSync');
    expect(inst.props.ch_sync).toBe('freq_track');

    cc._handleFuncGenButtonClick.call({}, inst, 'chSync');
    expect(inst.props.ch_sync).toBe('phase_sync');

    cc._handleFuncGenButtonClick.call({}, inst, 'chSync');
    expect(inst.props.ch_sync).toBe('off');
  });

  it('cycles modulation modes with ch1Mod button', () => {
    const inst = fgInst({ ch1_mod: 'none' });
    const cc = CircuitCanvas.prototype;

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Mod');
    expect(inst.props.ch1_mod).toBe('am');

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Mod');
    expect(inst.props.ch1_mod).toBe('fm');

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Mod');
    expect(inst.props.ch1_mod).toBe('sweep');

    cc._handleFuncGenButtonClick.call({}, inst, 'ch1Mod');
    expect(inst.props.ch1_mod).toBe('none');
  });
});

describe('CircuitCanvas Integration: analogRead from Function Generator', () => {
  it('converts function generator output voltage into 0-1023 ADC reading for Arduino', () => {
    const cc = Object.create(CircuitCanvas.prototype);
    const fg = { id: 'fg_1', type: 'func_gen', runtimeState: { ch1_voltage: 2.5 } };
    cc.components = [
      { id: 'uno_1', type: 'arduino_uno' },
      fg,
    ];
    cc.wires = [
      { from: { instId: 'uno_1', pinId: 'A0' }, to: { instId: 'fg_1', pinId: 'ch1_out' } },
    ];

    const val = cc._readAnalogInput.call(cc, 'uno_1', 'A0');
    expect(val).toBeCloseTo(512, -1);
  });

  it('converts 3.3V function generator voltage on a 3.3V ESP32 ADC', () => {
    const cc = Object.create(CircuitCanvas.prototype);
    const fg = { id: 'fg_1', type: 'func_gen', runtimeState: { ch1_voltage: 3.3 } };
    cc.components = [
      { id: 'esp_1', type: 'esp32_devkit_v1' },
      fg,
    ];
    cc.wires = [
      { from: { instId: 'esp_1', pinId: 'GPIO36' }, to: { instId: 'fg_1', pinId: 'ch1_out' } },
    ];

    const val = cc._readAnalogInput.call(cc, 'esp_1', 'GPIO36');
    expect(val).toBe(1023);
  });
});
