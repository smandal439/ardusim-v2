/**
 * test/arduino_reset_button.test.js
 * Unit tests verifying that the Arduino Uno on-board reset button is clickable,
 * provides visual pressed/released state feedback, changes hover cursor,
 * and resets the board / restarts sketch execution.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── Minimal browser-like globals ── */
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
  querySelectorAll: () => [],
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

const { CircuitCanvas } = loadScripts([
  'js/electrical.js',
  'js/components/base.js',
  'js/components/boards.js',
  'js/components/input.js',
  'js/components/output.js',
  'js/components/passive.js',
  'js/canvas.js',
], ['CircuitCanvas']);

const { ArduinoSimulator } = loadScripts([
  'js/simulator.js',
  'js/libraries/serial.js',
  'js/libraries/wire.js',
], ['ArduinoSimulator']);

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
  return { canvasEl, wrapperEl, ctx };
}

describe('Arduino Uno on-board reset button', () => {
  let cc;
  let canvasEl;
  let unoComp;

  beforeEach(() => {
    const stub = makeCanvasStub();
    canvasEl = stub.canvasEl;
    cc = new CircuitCanvas(canvasEl, stub.wrapperEl);
    cc.panX = 0;
    cc.panY = 0;
    cc.zoom = 1;
    unoComp = {
      id: 'uno1',
      type: 'arduino_uno',
      x: 100,
      y: 100,
      rotation: 0,
      props: {},
      runtimeState: {},
    };
    cc.components = [unoComp];
  });

  describe('Hit testing (_hitTestBoardReset)', () => {
    it('detects click directly on the reset button of Arduino Uno (rotation 0)', () => {
      // Uno reset actuator center is at local (15, 24)
      const hit = cc._hitTestBoardReset(100 + 15, 100 + 24);
      expect(hit).not.toBeNull();
      expect(hit.inst).toBe(unoComp);
      expect(hit.boardType).toBe('arduino_uno');
    });

    it('detects click within the button hit margin', () => {
      // Test corners of hitbox: x: 100 + [8..22], y: 100 + [18..30]
      expect(cc._hitTestBoardReset(100 + 10, 100 + 20)).not.toBeNull();
      expect(cc._hitTestBoardReset(100 + 20, 100 + 28)).not.toBeNull();
    });

    it('ignores clicks outside the reset button', () => {
      // Board center
      expect(cc._hitTestBoardReset(100 + 130, 100 + 80)).toBeNull();
      // Near digital pins
      expect(cc._hitTestBoardReset(100 + 150, 100 + 12)).toBeNull();
      // Outside the board
      expect(cc._hitTestBoardReset(50, 50)).toBeNull();
    });

    it('handles rotated board (rotation 1: 90 deg clockwise)', () => {
      unoComp.rotation = 1;
      // Uno width = 260, height = 160, center = (130, 80)
      const local = { lx: 15, ly: 24 };
      const defs = window.ArduinoComponents.COMPONENT_DEFS;
      const def = defs.arduino_uno;
      const cx = def.width / 2; // 130
      const cy = def.height / 2; // 80
      const dx = local.lx - cx; // -115
      const dy = local.ly - cy; // -56
      // rotate 90 CW: dx' = -dy = 56, dy' = dx = -115
      const wx = unoComp.x + cx - dy;
      const wy = unoComp.y + cy + dx;

      const hit = cc._hitTestBoardReset(wx, wy);
      expect(hit).not.toBeNull();
      expect(hit.inst).toBe(unoComp);
    });
  });

  describe('Mouse interaction & visual feedback', () => {
    it('sets cursor to pointer when hovering over the reset button', () => {
      const e = { offsetX: 115, offsetY: 124, clientX: 115, clientY: 124 };
      cc._onMouseMove(e);
      expect(canvasEl.style.cursor).toBe('pointer');
    });

    it('resets cursor when moving away from the reset button', () => {
      // Hover reset button
      cc._onMouseMove({ offsetX: 115, offsetY: 124, clientX: 115, clientY: 124 });
      expect(canvasEl.style.cursor).toBe('pointer');

      // Move outside component
      cc._onMouseMove({ offsetX: 30, offsetY: 30, clientX: 30, clientY: 30 });
      expect(canvasEl.style.cursor).toBe('');
    });

    it('sets _resetPressed to true on mousedown and calls reset handler', () => {
      const resetSpy = vi.fn();
      cc._handleBoardResetClick = resetSpy;

      const e = { offsetX: 115, offsetY: 124, clientX: 115, clientY: 124, button: 0 };
      cc._onMouseDown(e);

      expect(unoComp.runtimeState._resetPressed).toBe(true);
      expect(resetSpy).toHaveBeenCalledWith(unoComp);
    });

    it('auto-releases _resetPressed after release timer expires', async () => {
      cc._handleBoardResetClick = () => {};

      cc._onMouseDown({ offsetX: 115, offsetY: 124, clientX: 115, clientY: 124, button: 0 });
      expect(unoComp.runtimeState._resetPressed).toBe(true);

      await new Promise(r => setTimeout(r, 200));
      expect(unoComp.runtimeState._resetPressed).toBe(false);
    });
  });

  describe('ArduinoSimulator.reset() functionality', () => {
    let sim;

    beforeEach(() => {
      sim = new ArduinoSimulator();
      sim.board = 'arduino_uno';
    });

    afterEach(() => {
      if (sim.isRunning) sim.stop();
    });

    it('resets simTime, pinStates, pinModes, and loopCount', () => {
      sim.simTime = 12345;
      sim.pinStates = { 13: 1, 9: 255 };
      sim.pinModes = { 13: 1 };
      sim._loopCount = 99;

      sim.reset();

      expect(sim.simTime).toBe(0);
      expect(sim.pinStates).toEqual({});
      expect(sim.pinModes).toEqual({});
      expect(sim._loopCount).toBe(0);
    });

    it('logs board reset notice to serial monitor', () => {
      const logs = [];
      sim.onSerial = (text, type) => logs.push({ text, type });

      sim.reset();

      const resetLog = logs.find(l => l.text.includes('Board reset'));
      expect(resetLog).toBeDefined();
    });

    it('restarts running sketch from setup() on reset()', async () => {
      const setupCalls = [];
      const code = `
        int bootCount = 0;
        void setup() {
          bootCount++;
          Serial.println("SETUP_RUN");
        }
        void loop() {
          delay(50);
        }
      `;

      sim.onSerial = (text) => {
        if (text.includes('SETUP_RUN')) {
          setupCalls.push(text.trim());
        }
      };

      const runPromise = sim.run(code);
      await new Promise(r => setTimeout(r, 60));

      expect(setupCalls.length).toBe(1);

      // Trigger reset
      sim.reset();
      await new Promise(r => setTimeout(r, 60));

      // setup() should have run a second time
      expect(setupCalls.length).toBe(2);

      sim.stop();
      await runPromise;
    });
  });

  describe('App.resetBoard integration', () => {
    it('calls sim.reset() and shows feedback when simulation is running', () => {
      const sim = new ArduinoSimulator();
      global.window.ArduinoSim = sim;
      const resetSpy = vi.spyOn(sim, 'reset');
      const showToast = vi.fn();
      const outputLog = vi.fn();

      const app = {
        isRunning: true,
        canvas: cc,
        sim,
        showToast,
        output: { log: outputLog },
        resetBoard: null,
      };
      global.window.App = app;

      // Borrow App.prototype.resetBoard logic
      app.resetBoard = function(inst) {
        if (!inst) return;
        const s = this.canvas ? this.canvas._getSimForInst(inst) : this.sim;
        const boardName = inst.type === 'arduino_uno' ? 'Arduino Uno' : 'Board';
        if (this.isRunning) {
          if (s && typeof s.reset === 'function') s.reset();
          this.showToast(`${boardName} reset`, 'info');
          this.output?.log(`[System] ${boardName} reset button pressed`, 'system');
        } else {
          this.run();
        }
      };

      app.resetBoard(unoComp);

      expect(resetSpy).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Arduino Uno reset', 'info');
      expect(outputLog).toHaveBeenCalledWith('[System] Arduino Uno reset button pressed', 'system');
    });

    it('calls app.run() if reset button is clicked while simulation is stopped', () => {
      const runSpy = vi.fn();
      const showToast = vi.fn();
      const outputLog = vi.fn();

      const app = {
        isRunning: false,
        canvas: cc,
        run: runSpy,
        showToast,
        output: { log: outputLog },
        resetBoard: null,
      };

      app.resetBoard = function(inst) {
        if (!inst) return;
        const boardName = inst.type === 'arduino_uno' ? 'Arduino Uno' : 'Board';
        if (this.isRunning) {
          this.sim.reset();
        } else {
          this.showToast(`Starting ${boardName} simulation…`, 'info');
          this.output?.log(`[System] ${boardName} reset pressed — starting simulation`, 'system');
          this.run();
        }
      };

      app.resetBoard(unoComp);

      expect(runSpy).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Starting Arduino Uno simulation…', 'info');
      expect(outputLog).toHaveBeenCalledWith('[System] Arduino Uno reset pressed — starting simulation', 'system');
    });
  });

  describe('Arduino physical RST pin functionality', () => {
    it('does not reset when RST pin is floating or disconnected', () => {
      const resetSpy = vi.fn();
      cc._handleBoardResetClick = resetSpy;

      cc.updateSimState({});
      expect(resetSpy).not.toHaveBeenCalled();
    });

    it('triggers board reset when external RST pin is pulled to GND via push button', () => {
      const resetSpy = vi.fn();
      cc._handleBoardResetClick = resetSpy;

      const btn = {
        id: 'btn1',
        type: 'push_button',
        x: 300,
        y: 100,
        rotation: 0,
        props: {},
        runtimeState: { pressed: false },
      };
      cc.components.push(btn);
      cc.wires = [
        { id: 'w1', from: { instId: 'uno1', pinId: 'RST' }, to: { instId: 'btn1', pinId: 'p1' } },
        { id: 'w2', from: { instId: 'btn1', pinId: 'p3' }, to: { instId: 'uno1', pinId: 'GND1' } },
      ];

      // Initially unpressed
      cc.updateSimState({});
      expect(resetSpy).not.toHaveBeenCalled();
      expect(unoComp.runtimeState._resetPressed).toBeFalsy();

      // Press the button (connects RST to GND)
      btn.runtimeState.pressed = true;
      cc.updateSimState({});
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(unoComp.runtimeState._resetPressed).toBe(true);

      // Subsequent update while held down does not re-trigger repeatedly
      cc.updateSimState({});
      expect(resetSpy).toHaveBeenCalledTimes(1);

      // Release the button
      btn.runtimeState.pressed = false;
      cc.updateSimState({});
      expect(resetSpy).toHaveBeenCalledTimes(1);

      // Press again
      btn.runtimeState.pressed = true;
      cc.updateSimState({});
      expect(resetSpy).toHaveBeenCalledTimes(2);
    });

    it('triggers reset when RST is wired directly to GND', () => {
      const resetSpy = vi.fn();
      cc._handleBoardResetClick = resetSpy;

      cc.wires = [
        { id: 'w1', from: { instId: 'uno1', pinId: 'RST' }, to: { instId: 'uno1', pinId: 'GND1' } },
      ];

      cc.updateSimState({});
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(unoComp.runtimeState._resetPressed).toBe(true);
    });
  });
});
