/**
 * test/mb102_power.test.js — MB102 Power Supply Module comprehensive test suite
 * Tests component definition, inline toggle, jumper hit-testing, net tracing,
 * electrical simulation, LED lighting, overload detection, and SVG preview.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

global.window = {
  ArduinoLibs: {},
  ArduinoComponents: { COMPONENT_DEFS: {} },
  ArduinoSim: null,
  CircuitCanvas: null,
  ComponentSvg: null,
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
    code + '\n;return {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : (window['${n}'] || undefined)`).join(', ') + '};');
  return fn(global.window, global.document);
}

function makeCanvasStub() {
  const ctx = new Proxy({}, {
    get(_, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
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
    addEventListener() {}, removeEventListener() {},
  };
  return { canvasEl, wrapperEl, ctx };
}

describe('MB102 Breadboard Power Supply Module', () => {
  let CircuitCanvas, ComponentSvg, ElectricalEngine;

  beforeAll(() => {
    const loaded = loadScripts([
      'js/electrical.js',
      'js/components/base.js',
      'js/components/component-svg.js',
      'js/components/passive.js',
      'js/components/power.js',
      'js/components/output.js',
      'js/canvas.js',
    ], ['CircuitCanvas', 'ComponentSvg', 'ElectricalEngine']);
    CircuitCanvas = loaded.CircuitCanvas;
    ComponentSvg = loaded.ComponentSvg;
    ElectricalEngine = loaded.ElectricalEngine;
  });

  describe('Component Definition & Metadata', () => {
    it('is registered in ArduinoComponents with correct metadata', () => {
      const def = window.ArduinoComponents.COMPONENT_DEFS.mb102_power;
      expect(def).toBeDefined();
      expect(def.id).toBe('mb102_power');
      expect(def.name).toBe('MB102 Power Supply');
      expect(def.category).toBe('Power');
      expect(def.width).toBe(160);
      expect(def.height).toBe(96);
      expect(def.hidePinLabels).toBe(true);
    });

    it('has power switch as an inline toggle and selectable rail voltages', () => {
      const def = window.ArduinoComponents.COMPONENT_DEFS.mb102_power;
      const powerCtrl = def.interactive.find(c => c.field === 'powered');
      expect(powerCtrl).toBeDefined();
      expect(powerCtrl.type).toBe('toggle');
      expect(powerCtrl.inline).toEqual({ x: 44, y: 26, w: 18, h: 18 });

      const topCtrl = def.interactive.find(c => c.field === 'topVoltage');
      expect(topCtrl).toBeDefined();
      expect(topCtrl.type).toBe('select');
      expect(topCtrl.options.map(o => o.value || o)).toContain('5V');
      expect(topCtrl.options.map(o => o.value || o)).toContain('3.3V');
      expect(topCtrl.options.map(o => o.value || o)).toContain('OFF');

      const botCtrl = def.interactive.find(c => c.field === 'bottomVoltage');
      expect(botCtrl).toBeDefined();
      expect(botCtrl.type).toBe('select');
    });

    it('has rail output and auxiliary pin definitions with correct coordinates', () => {
      const def = window.ArduinoComponents.COMPONENT_DEFS.mb102_power;
      const pinIds = def.pins.map(p => p.id);
      expect(pinIds).toContain('vcc_t');
      expect(pinIds).toContain('gnd_t');
      expect(pinIds).toContain('vcc_b');
      expect(pinIds).toContain('gnd_b');
      expect(pinIds).toContain('aux_5v');
      expect(pinIds).toContain('aux_3v3');
      expect(pinIds).toContain('aux_gnd');
    });
  });

  describe('Interactive Canvas Controls', () => {
    it('detects inline power switch button clicks via _hitTestInlineToggle', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 200, 200);

      // Center of power button is at (inst.x + 53, inst.y + 35)
      const hit = canvas._hitTestInlineToggle(inst.x + 53, inst.y + 35);
      expect(hit).not.toBeNull();
      expect(hit.inst.id).toBe(inst.id);
      expect(hit.ctrl.field).toBe('powered');

      // Click outside button should not hit
      expect(canvas._hitTestInlineToggle(inst.x + 5, inst.y + 5)).toBeNull();
    });

    it('detects top and bottom rail jumper clicks via _hitTestMb102Jumper', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 200, 200);

      // Top jumper block at inst.x + 94..117, inst.y + 13..29
      const topHit5V = canvas._hitTestMb102Jumper(inst.x + 96, inst.y + 20);
      expect(topHit5V).not.toBeNull();
      expect(topHit5V.inst.id).toBe(inst.id);
      expect(topHit5V.rail).toBe('top');
      expect(topHit5V.targetVoltage).toBe('5V');

      const topHit3V3 = canvas._hitTestMb102Jumper(inst.x + 112, inst.y + 20);
      expect(topHit3V3.targetVoltage).toBe('3.3V');

      // Bottom jumper block at inst.x + 94..117, inst.y + 66..82
      const botHit = canvas._hitTestMb102Jumper(inst.x + 96, inst.y + 74);
      expect(botHit).not.toBeNull();
      expect(botHit.rail).toBe('bottom');
    });
  });

  describe('Electrical Engine Integration (electrical.js)', () => {
    it('classifies sources and grounds for top, bottom, and aux rails when powered', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 100, 100);
      inst.props.powered = 1;
      inst.props.topVoltage = '5V';
      inst.props.bottomVoltage = '3.3V';

      const r1 = canvas.addComponent('resistor', 300, 100);
      const r2 = canvas.addComponent('resistor', 300, 200);
      const r3 = canvas.addComponent('resistor', 300, 300);
      const r4 = canvas.addComponent('resistor', 300, 400);

      canvas.wires.push({ from: { instId: inst.id, pinId: 'vcc_t' }, to: { instId: r1.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: inst.id, pinId: 'vcc_b' }, to: { instId: r2.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: inst.id, pinId: 'aux_5v' }, to: { instId: r3.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: inst.id, pinId: 'aux_3v3' }, to: { instId: r4.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: inst.id, pinId: 'gnd_t' }, to: { instId: r1.id, pinId: 'p2' } });

      canvas.engine.buildGraph(canvas.components, canvas.wires);
      canvas.engine.solve(canvas);

      const netTop = canvas.engine.pinToNet.get(`${inst.id}:vcc_t`);
      expect(netTop).toBeDefined();
      expect(netTop.sources.length).toBeGreaterThan(0);
      expect(netTop.sources[0].voltage).toBe(5.0);

      const netBot = canvas.engine.pinToNet.get(`${inst.id}:vcc_b`);
      expect(netBot).toBeDefined();
      expect(netBot.sources.length).toBeGreaterThan(0);
      expect(netBot.sources[0].voltage).toBe(3.3);

      const netAux5 = canvas.engine.pinToNet.get(`${inst.id}:aux_5v`);
      expect(netAux5.sources[0].voltage).toBe(5.0);

      const netAux3 = canvas.engine.pinToNet.get(`${inst.id}:aux_3v3`);
      expect(netAux3.sources[0].voltage).toBe(3.3);
    });

    it('generates no sources when powered off, but preserves ground connection', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 100, 100);
      inst.props.powered = 0;
      inst.runtimeState = { powered: 0 };

      const r1 = canvas.addComponent('resistor', 300, 100);
      canvas.wires.push({ from: { instId: inst.id, pinId: 'vcc_t' }, to: { instId: r1.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: inst.id, pinId: 'gnd_t' }, to: { instId: r1.id, pinId: 'p2' } });

      canvas.engine.buildGraph(canvas.components, canvas.wires);
      canvas.engine.solve(canvas);

      const netTop = canvas.engine.pinToNet.get(`${inst.id}:vcc_t`);
      expect(netTop.sources.length).toBe(0);

      const netGnd = canvas.engine.pinToNet.get(`${inst.id}:gnd_t`);
      expect(netGnd.grounds.length).toBeGreaterThan(0);
    });

    it('outputs 0V when rail jumper is set to OFF', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 100, 100);
      inst.props.powered = 1;
      inst.props.topVoltage = 'OFF';
      inst.props.bottomVoltage = '5V';

      const r1 = canvas.addComponent('resistor', 300, 100);
      const r2 = canvas.addComponent('resistor', 300, 200);
      canvas.wires.push({ from: { instId: inst.id, pinId: 'vcc_t' }, to: { instId: r1.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: inst.id, pinId: 'vcc_b' }, to: { instId: r2.id, pinId: 'p1' } });

      canvas.engine.buildGraph(canvas.components, canvas.wires);
      canvas.engine.solve(canvas);

      const netTop = canvas.engine.pinToNet.get(`${inst.id}:vcc_t`);
      expect(netTop.sources.length).toBe(0);

      const netBot = canvas.engine.pinToNet.get(`${inst.id}:vcc_b`);
      expect(netBot.sources[0].voltage).toBe(5.0);
    });
  });

  describe('Canvas Net Tracing (_tracePinNet)', () => {
    it('properly outputs voltages and instId/pinId metadata for all rails', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 50, 50);
      inst.props.powered = 1;
      inst.props.topVoltage = '5V';
      inst.props.bottomVoltage = '3.3V';

      const netTop = canvas._tracePinNet(inst.id, 'vcc_t');
      expect(netTop.sources.length).toBe(1);
      expect(netTop.sources[0].voltage).toBe(5.0);
      expect(netTop.sources[0].instId).toBe(inst.id);
      expect(netTop.sources[0].pinId).toBe('vcc_t');

      const netBot = canvas._tracePinNet(inst.id, 'vcc_b');
      expect(netBot.sources.length).toBe(1);
      expect(netBot.sources[0].voltage).toBe(3.3);
      expect(netBot.sources[0].instId).toBe(inst.id);
      expect(netBot.sources[0].pinId).toBe('vcc_b');

      // Aux pins deliver regulated 5.0V and 3.3V
      const netAux5 = canvas._tracePinNet(inst.id, 'aux_5v');
      expect(netAux5.sources[0].voltage).toBe(5.0);
      const netAux3 = canvas._tracePinNet(inst.id, 'aux_3v3');
      expect(netAux3.sources[0].voltage).toBe(3.3);

      // Grounds
      const netGndT = canvas._tracePinNet(inst.id, 'gnd_t');
      expect(netGndT.grounds.length).toBe(1);
      expect(netGndT.grounds[0].instId).toBe(inst.id);
      expect(netGndT.grounds[0].pinId).toBe('gnd_t');
    });

    it('updates output when runtimeState voltages change', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);
      const inst = canvas.addComponent('mb102_power', 50, 50);
      inst.runtimeState = { powered: 1, topVoltage: '3.3V', bottomVoltage: '5V' };

      const netTop = canvas._tracePinNet(inst.id, 'vcc_t');
      expect(netTop.sources[0].voltage).toBe(3.3);

      const netBot = canvas._tracePinNet(inst.id, 'vcc_b');
      expect(netBot.sources[0].voltage).toBe(5.0);
    });
  });

  describe('LED and Circuit Simulation Integration', () => {
    it('lights up an LED wired to top rail (vcc_t and gnd_t) through a resistor', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);

      const mb = canvas.addComponent('mb102_power', 50, 50);
      mb.props.powered = 1;
      mb.props.topVoltage = '5V';

      const res = canvas.addComponent('resistor', 250, 50);
      res.props.value = 220; // 220 ohm

      const led = canvas.addComponent('led', 350, 50);

      // Wire: mb:vcc_t -> res:p1, res:p2 -> led:anode, led:cathode -> mb:gnd_t
      canvas.wires.push({ from: { instId: mb.id, pinId: 'vcc_t' }, to: { instId: res.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: res.id, pinId: 'p2' }, to: { instId: led.id, pinId: 'anode' } });
      canvas.wires.push({ from: { instId: led.id, pinId: 'cathode' }, to: { instId: mb.id, pinId: 'gnd_t' } });

      canvas.updateSimState({});

      expect(led.runtimeState).toBeDefined();
      expect(led.runtimeState.lit).toBe(true);
      expect(led.runtimeState.brightness).toBeGreaterThan(0.5);
      expect(led.runtimeState.current_mA).toBeGreaterThan(10);
    });

    it('turns off the LED when MB102 is powered off or top rail set to OFF', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);

      const mb = canvas.addComponent('mb102_power', 50, 50);
      mb.props.powered = 0; // Powered OFF
      mb.props.topVoltage = '5V';

      const res = canvas.addComponent('resistor', 250, 50);
      res.props.value = 220;

      const led = canvas.addComponent('led', 350, 50);

      canvas.wires.push({ from: { instId: mb.id, pinId: 'vcc_t' }, to: { instId: res.id, pinId: 'p1' } });
      canvas.wires.push({ from: { instId: res.id, pinId: 'p2' }, to: { instId: led.id, pinId: 'anode' } });
      canvas.wires.push({ from: { instId: led.id, pinId: 'cathode' }, to: { instId: mb.id, pinId: 'gnd_t' } });

      canvas.updateSimState({});

      expect(led.runtimeState.lit).toBe(false);
    });

    it('detects short-circuit and overload (>800mA) on the MB102 regulators', () => {
      const { canvasEl, wrapperEl } = makeCanvasStub();
      const canvas = new CircuitCanvas(canvasEl, wrapperEl);

      const mb = canvas.addComponent('mb102_power', 50, 50);
      mb.props.powered = 1;
      mb.props.topVoltage = '5V';

      // Direct wire from vcc_t to gnd_t (dead short!)
      canvas.wires.push({ from: { instId: mb.id, pinId: 'vcc_t' }, to: { instId: mb.id, pinId: 'gnd_t' } });

      canvas.updateSimState({});

      expect(mb.runtimeState).toBeDefined();
      expect(mb.runtimeState.overload).toBe(true);
      expect(mb.runtimeState.mode).toBe('OVERLOAD');
      expect(mb.runtimeState.actualCurrent_mA).toBeGreaterThan(800);
    });
  });

  describe('SVG Preview (component-svg.js)', () => {
    it('provides custom SVG renderer for mb102_power in ComponentSvg', () => {
      expect(ComponentSvg).toBeDefined();
      expect(typeof ComponentSvg._renderers.mb102_power).toBe('function');
      const svg = ComponentSvg.getSvg('mb102_power');
      expect(svg).toContain('<svg');
      expect(svg).toContain('comp-svg-preview');
    });

    it('has package badge for mb102_power', () => {
      expect(ComponentSvg.getBadge('mb102_power')).toBe('Dual-Rail PSU');
    });
  });

  describe('Canvas Rendering (draw method)', () => {
    it('draws without error in all states (ON, OFF, Overload)', () => {
      const def = window.ArduinoComponents.COMPONENT_DEFS.mb102_power;
      const { ctx } = makeCanvasStub();

      const instOn = { x: 50, y: 50, props: { powered: 1, topVoltage: '5V', bottomVoltage: '3.3V' }, runtimeState: { powered: 1, actualCurrent_mA: 12.5 } };
      expect(() => def.draw(ctx, instOn, null)).not.toThrow();

      const instOff = { x: 50, y: 50, props: { powered: 0, topVoltage: '5V', bottomVoltage: '3.3V' }, runtimeState: { powered: 0 } };
      expect(() => def.draw(ctx, instOff, null)).not.toThrow();

      const instOverload = { x: 50, y: 50, props: { powered: 1, topVoltage: '5V', bottomVoltage: '3.3V' }, runtimeState: { powered: 1, overload: true, actualCurrent_mA: 950 } };
      expect(() => def.draw(ctx, instOverload, null)).not.toThrow();
    });
  });
});
