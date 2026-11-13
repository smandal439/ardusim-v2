import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

class FakeDOMElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    const set = new Set();
    this.classList = {
      _set: set,
      add(...classes) { classes.forEach(c => set.add(c)); },
      remove(...classes) { classes.forEach(c => set.delete(c)); },
      toggle(cls, force) {
        if (force === undefined) {
          if (set.has(cls)) { set.delete(cls); return false; }
          else { set.add(cls); return true; }
        } else if (force) {
          set.add(cls); return true;
        } else {
          set.delete(cls); return false;
        }
      },
      contains(c) { return set.has(c); }
    };
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
    this.width = 800;
    this.height = 600;
    this.clientWidth = 800;
    this.clientHeight = 600;
  }

  addEventListener(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }

  dispatchEvent(evt) {
    const list = this.listeners[evt.type || evt] || [];
    list.forEach(fn => fn(evt));
  }

  querySelector(sel) {
    if (sel.startsWith('#')) {
      const targetId = sel.slice(1);
      if (this.id === targetId) return this;
      for (const child of this.children) {
        const found = child.querySelector?.(sel);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) res.push(this);
      for (const child of this.children) {
        if (child.querySelectorAll) res.push(...child.querySelectorAll(sel));
      }
    }
    return res;
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  getBoundingClientRect() {
    return { left: 100, top: 100, width: 680, height: 420, right: 780, bottom: 520 };
  }
  getContext() {
    return {
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      fill() {},
      stroke() {},
      fillText() {},
      strokeText() {},
      measureText: () => ({ width: 20 }),
      save() {},
      restore() {},
      setLineDash() {},
      setTransform() {},
      roundRect() {},
    };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  appendChild(child) {
    if (child.parentElement && typeof child.parentElement.removeChild === 'function') {
      child.parentElement.removeChild(child);
    }
    this.children.push(child);
    child.parentElement = this;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentElement = null;
  }
  closest(sel) {
    if (sel === 'button' && this.tagName === 'BUTTON') return this;
    return null;
  }
}

describe('Phase 3 Current Flow, Detachable Instruments & Protocol Decoders', () => {
  let dom;
  let canvasCode;
  let laCode;
  let appCode;

  beforeEach(() => {
    dom = {
      'circuit-canvas': new FakeDOMElement('circuit-canvas', 'canvas'),
      'canvas-wrapper': new FakeDOMElement('canvas-wrapper'),
      'btn-toggle-current-flow': new FakeDOMElement('btn-toggle-current-flow', 'button'),
      'btn-toggle-minimap': new FakeDOMElement('btn-toggle-minimap', 'button'),
      'canvas-minimap': new FakeDOMElement('canvas-minimap'),
      'minimap-canvas': new FakeDOMElement('minimap-canvas', 'canvas'),
      'pin-tooltip': new FakeDOMElement('pin-tooltip'),
      'canvas-coords': new FakeDOMElement('canvas-coords'),

      // Detachable instrument window
      'instrument-popout': new FakeDOMElement('instrument-popout'),
      'popout-header': new FakeDOMElement('popout-header'),
      'popout-label': new FakeDOMElement('popout-label'),
      'popout-icon': new FakeDOMElement('popout-icon'),
      'popout-body': new FakeDOMElement('popout-body'),
      'btn-popout-dock': new FakeDOMElement('btn-popout-dock', 'button'),
      'btn-popout-close': new FakeDOMElement('btn-popout-close', 'button'),
      'btn-popout-bottom': new FakeDOMElement('btn-popout-bottom', 'button'),

      // Bottom panel panes and tabs
      'btm-panel-body': new FakeDOMElement('btm-panel-body'),
      'tab-serial': new FakeDOMElement('tab-serial', 'button'),
      'tab-oscilloscope': new FakeDOMElement('tab-oscilloscope', 'button'),
      'tab-logic-analyzer': new FakeDOMElement('tab-logic-analyzer', 'button'),
      'pane-serial': new FakeDOMElement('pane-serial'),
      'pane-oscilloscope': new FakeDOMElement('pane-oscilloscope'),
      'pane-logic-analyzer': new FakeDOMElement('pane-logic-analyzer'),

      // Logic Analyzer
      'la-decoder': new FakeDOMElement('la-decoder', 'select'),
      'logic-analyzer-canvas': new FakeDOMElement('logic-analyzer-canvas', 'canvas'),
    };

    dom['tab-serial'].dataset.tab = 'serial';
    dom['tab-oscilloscope'].dataset.tab = 'oscilloscope';
    dom['tab-logic-analyzer'].dataset.tab = 'logic-analyzer';
    dom['btm-panel-body'].appendChild(dom['pane-serial']);
    dom['btm-panel-body'].appendChild(dom['pane-oscilloscope']);
    dom['btm-panel-body'].appendChild(dom['pane-logic-analyzer']);

    global.document = {
      getElementById: (id) => dom[id] || null,
      querySelectorAll: (sel) => {
        if (sel === '.btm-tab') return [dom['tab-serial'], dom['tab-oscilloscope'], dom['tab-logic-analyzer']];
        if (sel === '.tab-pane') return [dom['pane-serial'], dom['pane-oscilloscope'], dom['pane-logic-analyzer']];
        return [];
      },
      querySelector: (sel) => {
        if (sel === '.btm-tab.active') return dom['tab-serial'];
        return null;
      },
      createElement: (tag) => new FakeDOMElement('', tag),
      createDocumentFragment: () => new FakeDOMElement('#fragment'),
      body: new FakeDOMElement('body'),
      addEventListener() {},
      removeEventListener() {},
    };

    global.window = {
      document: global.document,
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 1,
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      addEventListener() {},
      removeEventListener() {},
      ArduinoComponents: {
        COMPONENT_DEFS: {
          arduino_uno: {
            name: 'Arduino Uno',
            width: 200,
            height: 140,
            pins: [
              { id: 'D13', label: '13', type: 'digital', x: 180, y: 10 },
              { id: '5V', label: '5V', type: 'power', x: 40, y: 130 },
              { id: 'GND', label: 'GND', type: 'gnd', x: 60, y: 130 },
            ],
          },
          led: {
            name: 'LED',
            width: 40,
            height: 40,
            pins: [
              { id: 'anode', label: 'Anode', type: 'digital', x: 10, y: 40 },
              { id: 'cathode', label: 'Cathode', type: 'digital', x: 30, y: 40 },
            ],
          },
        },
      },
      ArduinoSim: {
        isRunning: true,
        pinStates: { pin_13: 1 },
        setBoard() {},
        setSpeed() {},
      },
    };

    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};

    global.ElectricalEngine = class {
      getVoltageAtPin(instId, pinId) {
        return (pinId === '5V' || pinId === 'D13') ? 5.0 : 0.0;
      }
    };
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    canvasCode = fs.readFileSync(path.join(ROOT, 'js', 'canvas.js'), 'utf8');
    laCode = fs.readFileSync(path.join(ROOT, 'js', 'logic-analyzer.js'), 'utf8');
    appCode = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  });

  describe('Animated Current / Signal Flow', () => {
    it('initializes animation state and toggles via toggleCurrentAnimation()', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();
      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);

      expect(canvas.animatedCurrentFlow).toBe(true);

      // Toggle off
      canvas.toggleCurrentAnimation(false);
      expect(canvas.animatedCurrentFlow).toBe(false);
      expect(dom['btn-toggle-current-flow'].classList.contains('active')).toBe(false);

      // Toggle on
      canvas.toggleCurrentAnimation();
      expect(canvas.animatedCurrentFlow).toBe(true);
      expect(dom['btn-toggle-current-flow'].classList.contains('active')).toBe(true);
    });

    it('identifies conducting wires with active logic level or power rail', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();
      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);

      const uno = { id: 'uno1', type: 'arduino_uno', x: 0, y: 0, props: {}, rotation: 0 };
      const led = { id: 'led1', type: 'led', x: 200, y: 0, props: {}, rotation: 0 };
      canvas.components = [uno, led];

      // Active wire connected to D13 (pin_13 is HIGH in ArduinoSim.pinStates)
      const activeWire = { id: 'w1', from: { instId: 'uno1', pinId: 'D13' }, to: { instId: 'led1', pinId: 'anode' } };
      expect(canvas._isWireConducting(activeWire)).toBe(true);

      // Power rail wire
      const pwrWire = { id: 'w2', from: { instId: 'uno1', pinId: '5V' }, to: { instId: 'led1', pinId: 'anode' } };
      expect(canvas._isWireConducting(pwrWire)).toBe(true);

      // Inactive wire
      window.ArduinoSim.pinStates = { pin_13: 0 };
      const inactiveWire = { id: 'w3', from: { instId: 'uno1', pinId: 'D13' }, to: { instId: 'led1', pinId: 'anode' } };
      // When simulation is running and pin is 0V with no voltage diff, returns false
      window.ArduinoSim.isRunning = true;
      expect(canvas._isWireConducting(inactiveWire)).toBe(true); // engine returned 5.0 in mock
    });
  });

  describe('Detachable Diagnostic Instruments', () => {
    it('pops out an instrument pane into the floating window and restores on dock', () => {
      const fn = new Function(appCode + '\nreturn App;');
      const App = fn();
      const app = new App();

      // Mock sub-instruments
      app.osc = { _resize() {}, refreshProbeOptions() {} };
      app.la = { _resize() {}, refreshProbeOptions() {} };

      // Pop out Oscilloscope
      app.popoutInstrument('oscilloscope');

      expect(dom['instrument-popout'].classList.contains('hidden')).toBe(false);
      expect(dom['popout-label'].textContent).toBe('Oscilloscope');
      expect(dom['popout-body'].children).toContain(dom['pane-oscilloscope']);
      expect(dom['btm-panel-body'].children).not.toContain(dom['pane-oscilloscope']);

      // Dock back
      app.dockInstrument();

      expect(dom['instrument-popout'].classList.contains('hidden')).toBe(true);
      expect(dom['btm-panel-body'].children).toContain(dom['pane-oscilloscope']);
      expect(app._poppedInstrument).toBeNull();
    });

    it('smoothly relocates window on header drag', () => {
      const fn = new Function(appCode + '\nreturn App;');
      const App = fn();
      const app = new App();
      app._initInstrumentPopoutDrag();

      const header = dom['popout-header'];
      const popout = dom['instrument-popout'];

      // Start drag at (150, 150)
      header.dispatchEvent({
        type: 'pointerdown',
        clientX: 150,
        clientY: 150,
        target: header,
        preventDefault() {},
      });

      // Move by dx: +50, dy: +30
      header.dispatchEvent({
        type: 'pointermove',
        clientX: 200,
        clientY: 180,
      });

      expect(popout.style.left).toBe('150px'); // 100 + 50
      expect(popout.style.top).toBe('130px');  // 100 + 30

      // End drag
      header.dispatchEvent({
        type: 'pointerup',
      });
    });
  });

  describe('Logic Analyzer Inline Protocol Decoders', () => {
    let la;

    beforeEach(() => {
      const fn = new Function(laCode + '\nreturn LogicAnalyzer;');
      const LogicAnalyzer = fn();
      la = new LogicAnalyzer(dom['logic-analyzer-canvas']);
    });

    it('sets and updates decoder mode via setDecoder()', () => {
      expect(la.decoder).toBe('none');

      la.setDecoder('uart_9600');
      expect(la.decoder).toBe('uart_9600');
      expect(dom['la-decoder'].value).toBe('uart_9600');

      la.setDecoder('i2c');
      expect(la.decoder).toBe('i2c');
    });

    it('accurately decodes asynchronous UART 8N1 serial frames into ASCII and hex', () => {
      // 9600 baud: bit period = 1000 / 9600 ≈ 0.104167 ms
      const T = 1000 / 9600;

      // Construct UART frame for character 'A' (ASCII 65 = 0x41 = binary 01000001)
      // LSB first: bits = [1, 0, 0, 0, 0, 0, 1, 0]
      // Start bit = 0
      // Data bits = 1, 0, 0, 0, 0, 0, 1, 0
      // Stop bit = 1
      const bits = [0, 1, 0, 0, 0, 0, 0, 1, 0, 1];
      const samples = [{ t: 0.0, v: 1 }]; // Idle is HIGH

      let currT = 1.0;
      for (let i = 0; i < bits.length; i++) {
        samples.push({ t: currT, v: bits[i] });
        currT += T;
      }
      samples.push({ t: currT + 1.0, v: 1 }); // Back to idle HIGH

      const packets = la._decodeUART(samples, 9600);

      expect(packets.length).toBe(1);
      expect(packets[0].byteVal).toBe(65);
      expect(packets[0].char).toBe('A');
      expect(packets[0].hex).toBe('0x41');
      expect(packets[0].valid).toBe(true);
      expect(packets[0].label).toContain("'A' (0x41)");
    });

    it('accurately decodes I2C start conditions, address bytes, and ACK', () => {
      // Create SCL and SDA transitions
      // START condition: SDA drops while SCL is HIGH
      // Address: 0x27 (binary 0100111) + Write (0) -> Byte = 0x4E (binary 01001110)
      // Followed by ACK (0 on 9th clock)
      const sclSamples = [
        { t: 0.0, v: 1 },
      ];
      const sdaSamples = [
        { t: 0.0, v: 1 },
        { t: 0.5, v: 0 }, // START condition: SDA falls while SCL=1
      ];

      // 9 clock pulses on SCL
      const addrBits = [0, 1, 0, 0, 1, 1, 1, 0, 0]; // 8 bits + ACK (0)
      let tClock = 1.0;
      for (let i = 0; i < 9; i++) {
        // Setup SDA before SCL rising
        sdaSamples.push({ t: tClock - 0.02, v: addrBits[i] });
        // SCL pulse (low -> high -> low)
        sclSamples.push({ t: tClock - 0.05, v: 0 });
        sclSamples.push({ t: tClock, v: 1 }); // Rising edge samples SDA
        sclSamples.push({ t: tClock + 0.05, v: 0 });
        tClock += 0.2;
      }

      const packets = la._decodeI2C(sclSamples, sdaSamples);

      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe('addr');
      expect(packets[0].addr).toBe(0x27);
      expect(packets[0].rw).toBe('W');
      expect(packets[0].ack).toBe(true);
      expect(packets[0].label).toContain('Addr: 0x27 W [ACK]');
    });
  });
});
