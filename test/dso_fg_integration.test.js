import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

function loadScripts(files, names) {
  const code = files.map(readSrc).join('\n;\n');
  const fn = new Function('window', 'document',
    code + '\n;return {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ') + '};');
  return fn(global.window, global.document);
}

const { COMPONENT_DEFS, _dsoAutoSet, _dsoFindConnectedFG } = loadScripts([
  'js/components/base.js',
  'js/components/function_generator.js',
  'js/components/dso.js',
], ['COMPONENT_DEFS', '_dsoAutoSet', '_dsoFindConnectedFG']);

window.ArduinoComponents.COMPONENT_DEFS = COMPONENT_DEFS;

const fgDef = COMPONENT_DEFS.func_gen;
const dsoDef = COMPONENT_DEFS.dso_4ch;

function mockCanvasCtx() {
  const paths = [];
  let currentPath = [];
  return {
    paths,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    clip() {},
    beginPath() { currentPath = []; paths.push(currentPath); },
    moveTo(x, y) { currentPath.push({ type: 'moveTo', x, y }); },
    lineTo(x, y) { currentPath.push({ type: 'lineTo', x, y }); },
    stroke() {},
    fill() {},
    fillRect() {},
    fillText() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    arc() {},
    arcTo() {},
    quadraticCurveTo() {},
    closePath() {},
    setLineDash() {},
    getLineDash() { return []; },
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: '',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
  };
}

describe('Function Generator to DSO 20Hz Integration', () => {
  function setupConnectedInstruments(fgProps = {}, dsoProps = {}) {
    const fg = {
      id: 'fg_1',
      type: 'func_gen',
      x: 0,
      y: 0,
      props: { ...fgDef.defaultProps, ch1_freq: 20, ch1_wave: 'sine', ch1_amp: 5.0, ...fgProps },
      runtimeState: {},
    };
    const dso = {
      id: 'dso_1',
      type: 'dso_4ch',
      x: 350,
      y: 0,
      props: { ...dsoDef.defaultProps, timebase: 0.005, ...dsoProps },
      runtimeState: {},
    };

    window.CircuitCanvas = {
      components: [fg, dso],
      wires: [
        { from: { instId: 'fg_1', pinId: 'ch1_out' }, to: { instId: 'dso_1', pinId: 'ch1_in' } },
        { from: { instId: 'fg_1', pinId: 'ch1_gnd' }, to: { instId: 'dso_1', pinId: 'gnd' } },
      ],
      _getWireTarget(instId, pinId) {
        if (instId === 'dso_1' && pinId === 'ch1_in') {
          return { inst: fg, pinId: 'ch1_out' };
        }
        return null;
      },
    };

    return { fg, dso };
  }

  it('correctly connects FG to DSO via _dsoFindConnectedFG', () => {
    const { fg, dso } = setupConnectedInstruments();
    const conn = _dsoFindConnectedFG(dso, 'ch1_in');
    expect(conn).toBeTruthy();
    expect(conn.inst).toBe(fg);
    expect(conn.pinId).toBe('ch1_out');
  });

  it('renders varying waveform points (NOT a flat line) when simulation is RUNNING', () => {
    const { fg, dso } = setupConnectedInstruments();
    const sim = {
      isRunning: true,
      simTime: 0,
      getPinVoltage: () => 0,
      setPinVoltage: () => {},
    };

    // Step 1: initial tick at simTime = 0
    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    // Step 2: advance simulation by 16ms
    sim.simTime = 16;
    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    // Step 3: advance simulation by another 16ms (simTime = 32ms)
    sim.simTime = 32;
    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    // Draw DSO
    const ctx = mockCanvasCtx();
    dsoDef.draw(ctx, dso, sim);

    // Verify trace is NOT a flat line
    // Find drawn path lines for CH1 (pts length == 280)
    const tracePaths = ctx.paths.filter(p => p.length >= 280);
    expect(tracePaths.length).toBeGreaterThan(0);

    const ch1Path = tracePaths[0];
    const yValues = ch1Path.map(p => p.y);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // The waveform must have a distinct amplitude spread, not a flat line (minY === maxY)
    expect(maxY - minY).toBeGreaterThan(10);
  });

  it('renders smooth analytical samples (NOT distorted by buffer starvation) in STOP condition', () => {
    const { fg, dso } = setupConnectedInstruments();

    // When stopped, sim is null and performance.now() is used
    // Emulate 10 consecutive frames (~16.6ms apart)
    let mockTime = 100.0;
    const origNow = performance.now;
    try {
      performance.now = () => mockTime * 1000;

      for (let frame = 0; frame < 10; frame++) {
        mockTime += 0.0166;
        fgDef.step(fg, null);
        dsoDef.step(dso, null);
      }

      // Check buffer size: buffer should maintain high-resolution samples without starving
      expect(dso._buffers.ch1.length).toBeGreaterThan(100);

      const ctx = mockCanvasCtx();
      dsoDef.draw(ctx, dso, null);

      const tracePaths = ctx.paths.filter(p => p.length >= 280);
      expect(tracePaths.length).toBeGreaterThan(0);

      const ch1Path = tracePaths[0];
      const yValues = ch1Path.map(p => p.y);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);

      // Verify that after 10 frames, the waveform is still a rich AC signal, not flat or zeroed
      expect(maxY - minY).toBeGreaterThan(10);
    } finally {
      performance.now = origNow;
    }
  });

  it('Auto Set on 20Hz signal automatically selects a suitable timebase', () => {
    const { fg, dso } = setupConnectedInstruments({ ch1_freq: 20 });
    let mockTime = 200.0;
    const origNow = performance.now;
    try {
      performance.now = () => mockTime * 1000;
      // Step once to initialize and second time to populate analytical samples
      fgDef.step(fg, null);
      dsoDef.step(dso, null);
      mockTime += 0.016;
      fgDef.step(fg, null);
      dsoDef.step(dso, null);

      // Now trigger autoSet
      dso.runtimeState.autoSet = 1;
      dsoDef.step(dso, null);

      // 20 Hz has period = 50ms. Target timebase for 3 cycles over 12 divs = 12.5ms/div.
      // Nearest standard step >= 12.5ms is 0.02s (20 ms/div).
      expect(dso.runtimeState.timebase).toBe(0.02);
      expect(dso.runtimeState.autoSet).toBe(0);
    } finally {
      performance.now = origNow;
    }
  });

  it('handles clean transition when switching from STOP to RUN', () => {
    const { fg, dso } = setupConnectedInstruments();

    // 1. Stopped mode with wall clock time
    let mockTime = 500.0;
    const origNow = performance.now;
    try {
      performance.now = () => mockTime * 1000;
      fgDef.step(fg, null);
      dsoDef.step(dso, null);
      mockTime += 0.016;
      fgDef.step(fg, null);
      dsoDef.step(dso, null);

      expect(dso._buffers.t[dso._buffers.t.length - 1]).toBeCloseTo(500.016, 2);

      // 2. Start simulation (simTime restarts at 0)
      const sim = { isRunning: true, simTime: 0, getPinVoltage: () => 0, setPinVoltage: () => {} };
      fgDef.step(fg, sim);
      dsoDef.step(dso, sim);

      // Discontinuity should cleanly clear the buffer without throwing or keeping backwards timestamps
      expect(dso._buffers.t[0]).toBe(0);

      // Advance sim
      sim.simTime = 16;
      fgDef.step(fg, sim);
      dsoDef.step(dso, sim);

      expect(dso._buffers.t[dso._buffers.t.length - 1]).toBeCloseTo(0.016, 3);
    } finally {
      performance.now = origNow;
    }
  });

  it('stabilizes periodic waveform so it does not scroll wildly across frames', () => {
    const { fg, dso } = setupConnectedInstruments({ ch1_freq: 20 }, { timebase: 0.02 });
    const sim = { isRunning: true, simTime: 0, getPinVoltage: () => 0, setPinVoltage: () => {} };

    // Advance simulation over several cycles
    for (let t = 0; t <= 120; t += 16) {
      sim.simTime = t;
      fgDef.step(fg, sim);
      dsoDef.step(dso, sim);
    }

    const ctx1 = mockCanvasCtx();
    dsoDef.draw(ctx1, dso, sim);
    const path1 = ctx1.paths.filter(p => p.length >= 280)[0];

    // Advance simulation by 16ms
    sim.simTime = 136;
    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    const ctx2 = mockCanvasCtx();
    dsoDef.draw(ctx2, dso, sim);
    const path2 = ctx2.paths.filter(p => p.length >= 280)[0];

    // Compare center pixel (px = 140) across consecutive frames
    // With trigger stabilization, the center pixel voltage/Y stays locked to the trigger point
    const center1 = path1[140].y;
    const center2 = path2[140].y;
    expect(Math.abs(center1 - center2)).toBeLessThan(2.0);
  });

  it('pauses the signal when Run/Stop or Hold is toggled', () => {
    const { fg, dso } = setupConnectedInstruments();
    const sim = { isRunning: true, simTime: 50, getPinVoltage: () => 0, setPinVoltage: () => {} };

    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    // 1. Pause via runStop = 0
    dso.runtimeState.runStop = 0;
    const bufLenBefore = dso._buffers.ch1.length;

    // Advance sim while stopped
    sim.simTime = 100;
    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    // Buffer should remain frozen
    expect(dso._buffers.ch1.length).toBe(bufLenBefore);

    // 2. Pause via Hold (paused = true)
    dso.runtimeState.runStop = 1;
    dso.runtimeState.paused = true;

    sim.simTime = 150;
    fgDef.step(fg, sim);
    dsoDef.step(dso, sim);

    expect(dso._buffers.ch1.length).toBe(bufLenBefore);
  });
});
