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
    this.width = 180;
    this.height = 110;
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
    return { left: 100, top: 100, width: 180, height: 110, right: 280, bottom: 210 };
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
    };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  appendChild(child) {
    this.children.push(child);
    if (child.textContent) this.innerHTML += child.textContent + ' ';
    if (child.children?.length) {
      for (const c of child.children) {
        this.innerHTML += (c.textContent || '') + ' ';
        if (c.children?.length) {
          for (const sub of c.children) {
            this.innerHTML += (sub.textContent || '') + ' ';
          }
        }
      }
    }
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

describe('Phase 2 Hardware Ergonomics & Diagnostic Exporters', () => {
  let dom;
  let canvasCode;
  let editorCode;
  let laCode;
  let oscCode;

  beforeEach(() => {
    dom = {
      'circuit-canvas': new FakeDOMElement('circuit-canvas', 'canvas'),
      'canvas-wrapper': new FakeDOMElement('canvas-wrapper'),
      'canvas-minimap': new FakeDOMElement('canvas-minimap'),
      'minimap-canvas': new FakeDOMElement('minimap-canvas', 'canvas'),
      'btn-toggle-minimap': new FakeDOMElement('btn-toggle-minimap', 'button'),
      'btn-close-minimap': new FakeDOMElement('btn-close-minimap', 'button'),
      'pin-tooltip': new FakeDOMElement('pin-tooltip'),
      'canvas-coords': new FakeDOMElement('canvas-coords'),
      'zoom-display': new FakeDOMElement('zoom-display'),
      'btn-osc-export-csv': new FakeDOMElement('btn-osc-export-csv', 'button'),
      'btn-la-export-vcd': new FakeDOMElement('btn-la-export-vcd', 'button'),
      'btn-la-export-csv': new FakeDOMElement('btn-la-export-csv', 'button'),
    };

    global.document = {
      getElementById: (id) => dom[id] || null,
      querySelectorAll: () => [],
      createElement: (tag) => new FakeDOMElement('', tag),
      createDocumentFragment: () => new FakeDOMElement('#fragment'),
      body: new FakeDOMElement('body'),
      addEventListener() {},
      removeEventListener() {},
    };

    global.window = {
      document: global.document,
      devicePixelRatio: 1,
      ArduinoComponents: {
        COMPONENT_DEFS: {
          arduino_uno: {
            name: 'Arduino Uno',
            width: 200,
            height: 140,
            pins: [
              { id: 'D13', label: '13', type: 'digital', x: 180, y: 10 },
              { id: 'D2', label: '2', type: 'digital', x: 80, y: 10 },
              { id: 'A0', label: 'A0', type: 'analog', x: 100, y: 130 },
              { id: '5V', label: '5V', type: 'power', x: 40, y: 130 },
              { id: 'GND', label: 'GND', type: 'gnd', x: 60, y: 130 },
            ],
          },
          led: {
            name: 'LED (Red)',
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
        isRunning: false,
        pinModes: { 13: 'OUTPUT', 2: 'INPUT_PULLUP', 14: 'INPUT' },
        pinStates: {},
        sketch: '',
      },
      addEventListener() {},
      removeEventListener() {},
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
    };

    global.ElectricalEngine = class {
      getVoltageAtPin() { return 5.0; }
    };
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    canvasCode = fs.readFileSync(path.join(ROOT, 'js', 'canvas.js'), 'utf8');
    editorCode = fs.readFileSync(path.join(ROOT, 'js', 'editor.js'), 'utf8');
    laCode = fs.readFileSync(path.join(ROOT, 'js', 'logic-analyzer.js'), 'utf8');
    oscCode = fs.readFileSync(path.join(ROOT, 'js', 'oscilloscope.js'), 'utf8');
  });

  describe('Canvas Mini-Map Navigation', () => {
    it('initializes and toggles visibility via toggleMinimap()', () => {
      // Evaluate canvas.js
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();

      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      expect(canvas.minimapVisible).toBe(false);
      expect(dom['canvas-minimap'].classList.contains('hidden')).toBe(true);
      expect(dom['btn-toggle-minimap'].classList.contains('active')).toBe(false);

      // Toggle on
      canvas.toggleMinimap();
      expect(canvas.minimapVisible).toBe(true);
      expect(dom['canvas-minimap'].classList.contains('hidden')).toBe(false);
      expect(dom['btn-toggle-minimap'].classList.contains('active')).toBe(true);

      // Toggle off
      canvas.toggleMinimap(false);
      expect(canvas.minimapVisible).toBe(false);
      expect(dom['canvas-minimap'].classList.contains('hidden')).toBe(true);
      expect(dom['btn-toggle-minimap'].classList.contains('active')).toBe(false);
    });

    it('calculates world bounds and renders thumbnail with viewport rect', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();

      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      canvas.toggleMinimap(true);
      canvas.components = [
        { id: 'uno1', type: 'arduino_uno', x: 100, y: 150, props: {}, rotation: 0 },
        { id: 'led1', type: 'led', x: 350, y: 150, props: {}, rotation: 0 },
      ];
      canvas.wires = [
        { id: 'w1', from: { instId: 'uno1', pinId: 'D13' }, to: { instId: 'led1', pinId: 'anode' }, color: '#00e5ff' },
      ];

      canvas._renderMinimap();

      expect(canvas._minimapTransform).toBeDefined();
      expect(canvas._minimapTransform.mmScale).toBeGreaterThan(0);
      expect(canvas._minimapTransform.worldMinX).toBeLessThan(100);
    });

    it('smoothly translates pointer drag on mini-map to main canvas panX and panY', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();

      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      canvas._viewportWidth = 800;
      canvas._viewportHeight = 600;
      canvas.zoom = 1;

      // Seed transform
      canvas._minimapTransform = {
        worldMinX: 0,
        worldMinY: 0,
        offX: 6,
        offY: 6,
        mmScale: 0.2,
      };

      // Drag to mini-map coordinate (x: 50, y: 40) relative to mini-map canvas (100, 100 on screen)
      const mockEvent = { clientX: 150, clientY: 140 };
      canvas._panFromMinimap(mockEvent);

      // targetWx = 0 + (50 - 6) / 0.2 = 220
      // panX = 400 - 220 * 1 = 180
      expect(canvas.panX).toBe(180);

      // targetWy = 0 + (40 - 6) / 0.2 = 170
      // panY = 300 - 170 * 1 = 130
      expect(canvas.panY).toBe(130);
    });
  });

  describe('Code-to-Canvas Pin Cross-Probing', () => {
    it('highlights pin, wire, and connected hardware when queried', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();

      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      const uno = { id: 'uno1', type: 'arduino_uno', x: 100, y: 100, props: { label: 'Board 1' }, rotation: 0 };
      const led = { id: 'led1', type: 'led', x: 300, y: 100, props: { label: 'Status LED' }, rotation: 0 };
      canvas.components = [uno, led];
      canvas.wires = [
        { id: 'w1', from: { instId: 'uno1', pinId: 'D13' }, to: { instId: 'led1', pinId: 'anode' }, color: '#1e88e5' },
      ];

      // Query pin '13' (numeric alias for D13)
      const hl = canvas.highlightPin('13');
      expect(hl).toBeDefined();
      expect(hl.pin.id).toBe('D13');
      expect(hl.inst.id).toBe('uno1');
      expect(hl.wires.length).toBe(1);
      expect(hl.connections.length).toBe(1);
      expect(hl.connections[0].inst.id).toBe('led1');

      // Check pin connection metadata
      const info = canvas.getPinConnections('13');
      expect(info.boardName).toBe('Board 1');
      expect(info.pinLabel).toBe('13');
      expect(info.pinMode).toBe('OUTPUT');
      expect(info.connectedComponents.length).toBe(1);
      expect(info.connectedComponents[0].name).toBe('Status LED');
      expect(info.connectedComponents[0].wireColor).toBe('#1e88e5');

      // Clear highlight
      canvas.clearPinHighlight();
      expect(canvas.highlightedPin).toBeNull();
    });

    it('resolves LED_BUILTIN and analog pin aliases accurately', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();

      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      canvas.components = [
        { id: 'uno1', type: 'arduino_uno', x: 100, y: 100, props: {}, rotation: 0 },
      ];

      const hlBuiltin = canvas.highlightPin('LED_BUILTIN');
      expect(hlBuiltin).toBeDefined();
      expect(hlBuiltin.pin.id).toBe('D13');

      const hlA0 = canvas.highlightPin('A0');
      expect(hlA0).toBeDefined();
      expect(hlA0.pin.id).toBe('A0');
    });

    it('counts occurrences of pin references in the active sketch for pin tooltips', () => {
      const fn = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fn();

      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      const uno = { id: 'uno1', type: 'arduino_uno', x: 100, y: 100, props: {}, rotation: 0 };
      canvas.components = [uno];

      window.ArduinoSim.sketch = `
        void setup() {
          pinMode(13, OUTPUT);
          pinMode(LED_BUILTIN, OUTPUT);
        }
        void loop() {
          digitalWrite(13, HIGH);
          delay(500);
          digitalWrite(13, LOW);
          delay(500);
        }
      `;

      // Call _showPinTooltip for D13
      const hit = { inst: uno, pin: { id: 'D13', label: '13', type: 'digital' } };
      canvas._showPinTooltip(hit, { clientX: 200, clientY: 200 });

      // Check that tooltip element was populated with sketch references
      const tooltip = dom['pin-tooltip'];
      expect(tooltip.innerHTML).toContain('Sketch References');
      // 13 appears 3 times + LED_BUILTIN 1 time = 4 occurrences
      expect(tooltip.innerHTML).toContain('4 occurrences');
    });

    it('provides rich markdown documentation and highlights canvas on Monaco hover', () => {
      let registeredHoverProvider = null;
      window.monaco = {
        languages: {
          register() {},
          setMonarchTokensProvider() {},
          setLanguageConfiguration() {},
          registerCompletionItemProvider() {},
          CompletionItemKind: {},
          registerHoverProvider: (lang, provider) => {
            if (lang === 'arduino') registeredHoverProvider = provider;
          },
        },
        editor: {
          defineTheme() {},
        },
      };
      global.monaco = window.monaco;

      // Set up canvas on window
      const fnCanvas = new Function(canvasCode + '\nreturn CircuitCanvas;');
      const CircuitCanvas = fnCanvas();
      const canvas = new CircuitCanvas(dom['circuit-canvas'], dom['canvas-wrapper']);
      const uno = { id: 'uno1', type: 'arduino_uno', x: 100, y: 100, props: { label: 'Arduino Uno' }, rotation: 0 };
      const led = { id: 'led1', type: 'led', x: 300, y: 100, props: { label: 'Red LED' }, rotation: 0 };
      canvas.components = [uno, led];
      canvas.wires = [
        { id: 'w1', from: { instId: 'uno1', pinId: 'D13' }, to: { instId: 'led1', pinId: 'anode' }, color: '#e53935' },
      ];
      window.CircuitCanvas = canvas;

      // Evaluate editor.js
      const fnEditor = new Function(editorCode + '\nreturn EditorManager;');
      const EditorManager = fnEditor();
      EditorManager._registerArduinoFormatter = () => {};
      EditorManager._registerArduinoLanguage();

      expect(registeredHoverProvider).toBeDefined();

      // Test hover on pin token '13'
      const mockModel = {
        getWordAtPosition: () => ({ word: '13' }),
        getLineContent: () => '  pinMode(13, OUTPUT);',
      };
      const res = registeredHoverProvider.provideHover(mockModel, { lineNumber: 1, column: 11 });

      expect(res).toBeDefined();
      expect(res.contents[0].value).toContain('🔌 13 (Arduino Uno)');
      expect(res.contents[0].value).toContain('Red LED');
      expect(res.contents[0].value).toContain('#e53935');

      // Target pin was highlighted on canvas
      expect(canvas.highlightedPin).toBeDefined();
      expect(canvas.highlightedPin.pin.id).toBe('D13');
    });
  });

  describe('Logic Analyzer Waveform Exporters', () => {
    let la;

    beforeEach(() => {
      const fn = new Function(laCode + '\nreturn LogicAnalyzer;');
      const LogicAnalyzer = fn();
      const canvasEl = new FakeDOMElement('logic-analyzer-canvas', 'canvas');
      la = new LogicAnalyzer(canvasEl);
    });

    it('exports multi-channel captures to standard IEEE 1364 Value Change Dump (.vcd)', () => {
      // Configure channels
      la.channels[0].pin = 'D2';
      la.channels[0].enabled = true;
      la.channels[1].pin = 'D3';
      la.channels[1].enabled = true;
      for (let i = 2; i < la.channels.length; i++) la.channels[i].enabled = false;

      // Record transitions: t is in ms
      la.data['D2'] = [
        { t: 0.0, v: 0 },
        { t: 1.0, v: 1 },
        { t: 2.5, v: 0 },
      ];
      la.data['D3'] = [
        { t: 0.0, v: 1 },
        { t: 1.5, v: 0 },
        { t: 3.0, v: 1 },
      ];

      const vcd = la.exportVCD();

      // Verify IEEE 1364 structural elements
      expect(vcd).toContain('$timescale\n   1us\n$end');
      expect(vcd).toContain('$scope module logic_analyzer $end');
      expect(vcd).toContain('$var wire 1 ! CH1_D2 $end');
      expect(vcd).toContain('$var wire 1 # CH2_D3 $end');
      expect(vcd).toContain('$dumpvars');
      expect(vcd).toContain('#1000\n1!');
      expect(vcd).toContain('#1500\n0#');
      expect(vcd).toContain('#2500\n0!');
      expect(vcd).toContain('#3000\n1#');
    });

    it('exports multi-channel captures to aligned CSV matrix', () => {
      la.channels[0].pin = 'D2';
      la.channels[0].enabled = true;
      la.channels[1].pin = 'D3';
      la.channels[1].enabled = true;
      for (let i = 2; i < la.channels.length; i++) la.channels[i].enabled = false;

      la.data['D2'] = [
        { t: 0.0, v: 1 },
        { t: 10.0, v: 0 },
      ];
      la.data['D3'] = [
        { t: 0.0, v: 0 },
        { t: 5.0, v: 1 },
        { t: 10.0, v: 1 },
      ];

      const csv = la.exportCSV();

      const lines = csv.trim().split('\n');
      expect(lines[0]).toBe('Time_ms,CH1_D2,CH2_D3');
      expect(lines[1]).toBe('0.000,1,0');
      expect(lines[2]).toBe('5.000,1,1');
      expect(lines[3]).toBe('10.000,0,1');
    });
  });

  describe('Oscilloscope Waveform Exporters', () => {
    it('exports dual-channel traces with raw ADC and converted voltage levels to CSV', () => {
      const fn = new Function(oscCode + '\nreturn Oscilloscope;');
      const Oscilloscope = fn();
      const canvasEl = new FakeDOMElement('oscilloscope-canvas', 'canvas');
      const osc = new Oscilloscope(canvasEl);

      osc.ch1Pin = 'A0';
      osc.ch2Pin = 'A1';

      osc.ch1Data = [
        { t: 0.0, v: 0 },
        { t: 50.0, v: 512 },
        { t: 100.0, v: 1023 },
      ];
      osc.ch2Data = [
        { t: 0.0, v: 1023 },
        { t: 50.0, v: 512 },
        { t: 100.0, v: 0 },
      ];

      const csv = osc.exportCSV();

      const lines = csv.trim().split('\n');
      expect(lines[0]).toBe('Time_ms,CH1_A0_raw,CH1_A0_V,CH2_A1_raw,CH2_A1_V');
      expect(lines[1]).toBe('0.000,0,0.000,1023,5.000');
      expect(lines[2]).toBe('50.000,512,2.502,512,2.502');
      expect(lines[3]).toBe('100.000,1023,5.000,0,0.000');
    });
  });
});
