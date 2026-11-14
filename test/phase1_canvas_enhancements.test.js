import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

class FakeClassList {
  constructor() {
    this._set = new Set();
  }
  add(...classes) { classes.forEach(c => this._set.add(c)); }
  remove(...classes) { classes.forEach(c => this._set.delete(c)); }
  contains(c) { return this._set.has(c); }
  toggle(cls, force) {
    if (force === undefined) {
      if (this._set.has(cls)) { this._set.delete(cls); return false; }
      this._set.add(cls);
      return true;
    }
    if (force) { this._set.add(cls); return true; }
    this._set.delete(cls);
    return false;
  }
}

class FakeDOMElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classList = new FakeClassList();
    this.style = {};
    this.children = [];
    this._innerHTML = '';
    this._textContent = '';
    this.eventListeners = {};
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = val;
  }

  appendChild(child) {
    if (child.tagName === 'FRAGMENT') {
      this.children.push(...child.children);
      return child;
    }
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(listener);
  }

  dispatchEvent(event) {
    const list = this.eventListeners[event.type] || [];
    list.forEach(fn => fn(event));
  }

  getBoundingClientRect() {
    return {
      left: parseFloat(this.style.left || 0),
      top: parseFloat(this.style.top || 0),
      right: parseFloat(this.style.left || 0) + 160,
      bottom: parseFloat(this.style.top || 0) + 80,
      width: 160,
      height: 80
    };
  }
}

global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  devicePixelRatio: 1,
  ArduinoComponents: {
    COMPONENT_DEFS: {
      resistor: {
        name: 'Resistor',
        width: 60,
        height: 20,
        pins: [
          { id: 'p1', label: '1', x: 0, y: 10, type: 'passive' },
          { id: 'p2', label: '2', x: 60, y: 10, type: 'passive' }
        ]
      },
      potentiometer: {
        name: 'Potentiometer',
        width: 40,
        height: 40,
        interactive: [
          { field: 'value', label: 'Wiper', min: 0, max: 1023, step: 1, unit: '' }
        ],
        pins: [
          { id: 'vcc', label: 'VCC', x: 0, y: 10, type: 'power' },
          { id: 'wiper', label: 'WIPER', x: 20, y: 35, type: 'analog' },
          { id: 'gnd', label: 'GND', x: 40, y: 10, type: 'gnd' }
        ]
      },
      hcsr04: {
        name: 'HC-SR04 Ultrasonic Sensor',
        width: 100,
        height: 48,
        interactive: [
          { field: 'distance', label: 'Distance', min: 2, max: 400, step: 1, unit: 'cm' }
        ],
        pins: [
          { id: 'vcc', label: 'VCC', x: 10, y: 48, type: 'power' },
          { id: 'trig', label: 'TRIG', x: 30, y: 48, type: 'digital' },
          { id: 'echo', label: 'ECHO', x: 50, y: 48, type: 'digital' },
          { id: 'gnd', label: 'GND', x: 70, y: 48, type: 'gnd' }
        ]
      }
    }
  },
  ArduinoSim: {
    isRunning: false,
    pinStates: {}
  }
};

const domElements = {
  'wire-tooltip': new FakeDOMElement('div', 'wire-tooltip'),
  'pin-tooltip': new FakeDOMElement('div', 'pin-tooltip'),
  'canvas-quick-controls': new FakeDOMElement('div', 'canvas-quick-controls'),
  'zoom-display': new FakeDOMElement('div', 'zoom-display')
};

global.document = {
  getElementById: (id) => domElements[id] || null,
  createElement: (tag) => new FakeDOMElement(tag),
  createDocumentFragment: () => new FakeDOMElement('fragment'),
  querySelector: () => null,
  querySelectorAll: () => []
};

const canvasSource = fs.readFileSync(path.join(ROOT, 'js/canvas.js'), 'utf8');
const { CircuitCanvas } = new Function(
  'window',
  'document',
  `${canvasSource}\n;return { CircuitCanvas };`
)(global.window, global.document);

function createCanvas() {
  const canvas = Object.create(CircuitCanvas.prototype);
  canvas.components = [];
  canvas.wires = [];
  canvas.annotations = [];
  canvas.selected = null;
  canvas.selectedPin = null;
  canvas.selectedWire = null;
  canvas.selectedAnnotation = null;
  canvas.selectedComponentLabel = null;
  canvas.wireJumpArcs = true;
  canvas.wireTooltipEl = domElements['wire-tooltip'];
  canvas.tooltipEl = domElements['pin-tooltip'];
  canvas.quickControlsEl = domElements['canvas-quick-controls'];
  canvas.zoom = 1;
  canvas.panX = 0;
  canvas.panY = 0;
  canvas.GRID = 5;
  canvas.mode = 'idle';
  canvas.engine = {
    getVoltageAtPin: vi.fn((instId, pinId) => {
      if (pinId === 'vcc') return 5.0;
      if (pinId === 'gnd') return 0.0;
      if (pinId === 'wiper') return 2.5;
      return 3.3;
    })
  };
  canvas._isWireConducting = vi.fn(() => true);
  canvas._onChanged = vi.fn();
  canvas._render = vi.fn();
  canvas._pushHistory = vi.fn();
  canvas._onInteractiveInputChanged = vi.fn();
  return canvas;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Phase 1 UI Enhancements — Wire Jump Arcs', () => {
  it('enables CAD-style wire jump arcs by default', () => {
    const canvas = createCanvas();
    expect(canvas.wireJumpArcs).toBe(true);
  });

  it('draws a jump arc when a horizontal wire crosses a vertical wire without connection', () => {
    const canvas = createCanvas();
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn()
    };

    const wire1 = {
      id: 'w1',
      from: { instId: 'c1', pinId: 'p1' },
      to: { instId: 'c2', pinId: 'p1' },
      routeStyle: 'orthogonal'
    };

    const wire2 = {
      id: 'w2',
      from: { instId: 'c3', pinId: 'p1' },
      to: { instId: 'c4', pinId: 'p1' },
      routeStyle: 'orthogonal'
    };

    canvas.wires = [wire1, wire2];

    // Wire 1 is horizontal from x=0 to x=100 at y=50
    // Wire 2 is vertical from y=0 to y=100 at x=50
    canvas._wirePath = vi.fn((w) => {
      if (w.id === 'w1') {
        return { type: 'orthogonal', pts: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };
      }
      if (w.id === 'w2') {
        return { type: 'orthogonal', pts: [{ x: 50, y: 0 }, { x: 50, y: 100 }] };
      }
      return null;
    });

    canvas._buildOrthogonalPath(ctx, [{ x: 0, y: 50 }, { x: 100, y: 50 }], wire1);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 50);
    // Crossing is at x=50, y=50, radius=5
    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 5, Math.PI, 0, false);
    expect(ctx.lineTo).toHaveBeenCalledWith(45, 50);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 50);
  });

  it('suppresses jump arcs when wireJumpArcs is disabled', () => {
    const canvas = createCanvas();
    canvas.wireJumpArcs = false;

    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn()
    };

    const wire1 = {
      id: 'w1',
      from: { instId: 'c1', pinId: 'p1' },
      to: { instId: 'c2', pinId: 'p1' }
    };
    const wire2 = {
      id: 'w2',
      from: { instId: 'c3', pinId: 'p1' },
      to: { instId: 'c4', pinId: 'p1' }
    };
    canvas.wires = [wire1, wire2];

    canvas._wirePath = vi.fn((w) => {
      if (w.id === 'w1') return { type: 'orthogonal', pts: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };
      if (w.id === 'w2') return { type: 'orthogonal', pts: [{ x: 50, y: 0 }, { x: 50, y: 100 }] };
      return null;
    });

    canvas._buildOrthogonalPath(ctx, [{ x: 0, y: 50 }, { x: 100, y: 50 }], wire1);

    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 50);
  });

  it('does not jump over wires that share a junction pin', () => {
    const canvas = createCanvas();
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn()
    };

    const wire1 = {
      id: 'w1',
      from: { instId: 'c1', pinId: 'p1' },
      to: { instId: 'c2', pinId: 'p1' }
    };
    // wire2 shares c1:p1 (branch / tee junction)
    const wire2 = {
      id: 'w2',
      from: { instId: 'c1', pinId: 'p1' },
      to: { instId: 'c3', pinId: 'p1' }
    };
    canvas.wires = [wire1, wire2];

    canvas._wirePath = vi.fn((w) => {
      if (w.id === 'w1') return { type: 'orthogonal', pts: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };
      if (w.id === 'w2') return { type: 'orthogonal', pts: [{ x: 50, y: 0 }, { x: 50, y: 100 }] };
      return null;
    });

    canvas._buildOrthogonalPath(ctx, [{ x: 0, y: 50 }, { x: 100, y: 50 }], wire1);

    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

describe('Phase 1 UI Enhancements — Wire & Pin Hover Probe', () => {
  it('renders rich floating telemetry on wire hover', () => {
    const canvas = createCanvas();
    canvas.components = [
      { id: 'c1', type: 'potentiometer', props: { label: 'Speed Pot' } },
      { id: 'c2', type: 'hcsr04', props: { label: 'Sonar' } }
    ];

    const wire = {
      id: 'w1',
      from: { instId: 'c1', pinId: 'wiper' },
      to: { instId: 'c2', pinId: 'echo' },
      color: '#00e5ff'
    };

    const mouseEvent = { clientX: 200, clientY: 150 };
    canvas._showWireTooltip(wire, mouseEvent);

    const el = domElements['wire-tooltip'];
    expect(el.classList.contains('hidden')).toBe(false);
    expect(el.innerHTML).toContain('Wire Probe');
    expect(el.innerHTML).toContain('Speed Pot');
    expect(el.innerHTML).toContain('Sonar');
    expect(el.innerHTML).toContain('2.500 V');
    expect(el.innerHTML).toContain('Conducting (Live)');
    expect(el.style.left).toBe('214px');
    expect(el.style.top).toBe('164px');
  });

  it('hides wire tooltip on request', () => {
    const canvas = createCanvas();
    const el = domElements['wire-tooltip'];
    el.classList.remove('hidden');

    canvas._hideWireTooltip();
    expect(el.classList.contains('hidden')).toBe(true);
  });

  it('includes live voltage probe row in pin tooltip', () => {
    const canvas = createCanvas();
    const inst = { id: 'c1', type: 'resistor', props: { label: 'R1' } };
    const pin = { id: 'p1', label: '1', type: 'passive' };

    const tipEl = domElements['pin-tooltip'];
    canvas.tooltipEl = tipEl;
    canvas._showPinTooltip({ inst, pin }, { clientX: 100, clientY: 100 });

    expect(tipEl.children.length).toBeGreaterThan(0);
    // Find row child with text
    const textRows = tipEl.children.map(c => {
      const texts = (c.children || []).map(ch => ch.textContent);
      return texts.join(': ');
    });
    const hasLiveV = textRows.some(r => r.includes('Live Voltage'));
    expect(hasLiveV).toBe(true);
  });
});

describe('Phase 1 UI Enhancements — On-Canvas Floating Quick-Controls', () => {
  it('discovers interactive controls for components', () => {
    const canvas = createCanvas();
    const pot = { id: 'pot1', type: 'potentiometer' };
    const sonar = { id: 's1', type: 'hcsr04' };
    const res = { id: 'r1', type: 'resistor' };

    const potCtrl = canvas._findInteractiveControl(pot);
    expect(potCtrl).not.toBeNull();
    expect(potCtrl.field).toBe('value');
    expect(potCtrl.min).toBe(0);
    expect(potCtrl.max).toBe(1023);

    const sonarCtrl = canvas._findInteractiveControl(sonar);
    expect(sonarCtrl).not.toBeNull();
    expect(sonarCtrl.field).toBe('distance');
    expect(sonarCtrl.unit).toBe('cm');

    const resCtrl = canvas._findInteractiveControl(res);
    expect(resCtrl).toBeNull();
  });

  it('shows HUD quick controls slider and updates component values on slider input', () => {
    const canvas = createCanvas();
    const pot = {
      id: 'pot1',
      type: 'potentiometer',
      x: 100,
      y: 100,
      props: { value: 500 },
      runtimeState: { value: 500 }
    };
    canvas.components = [pot];
    canvas.selected = pot;

    canvas._updateQuickControls();

    const qcEl = domElements['canvas-quick-controls'];
    expect(qcEl.classList.contains('hidden')).toBe(false);

    // Locate the slider
    const slider = qcEl.children.find(c => c.tagName === 'INPUT' && c.className === 'qc-slider');
    expect(slider).toBeDefined();
    expect(slider.min).toBe(0);
    expect(slider.max).toBe(1023);
    expect(slider.value).toBe(500);

    // Simulate dragging slider to 750
    slider.value = 750;
    slider.dispatchEvent({ type: 'input', target: slider });

    expect(pot.props.value).toBe(750);
    expect(pot.runtimeState.value).toBe(750);
    expect(canvas._onInteractiveInputChanged).toHaveBeenCalledWith(pot, 'value', 750);
    expect(canvas._onChanged).toHaveBeenCalled();
  });

  it('anchors quick controls directly above component based on pan and zoom', () => {
    const canvas = createCanvas();
    const pot = { id: 'pot1', type: 'potentiometer', x: 200, y: 150 };
    canvas.zoom = 1.5;
    canvas.panX = 50;
    canvas.panY = 30;

    canvas._positionQuickControls(pot);

    const qcEl = domElements['canvas-quick-controls'];
    // Width of potentiometer is 40. Center X is 200 + 20 = 220.
    // Screen X = 220 * 1.5 + 50 = 380px.
    // Screen Y = 150 * 1.5 + 30 = 255px.
    expect(qcEl.style.left).toBe('380px');
    expect(qcEl.style.top).toBe('255px');
  });

  it('hides quick controls when component is deselected', () => {
    const canvas = createCanvas();
    const qcEl = domElements['canvas-quick-controls'];
    qcEl.classList.remove('hidden');

    canvas.selected = null;
    canvas._updateQuickControls();

    expect(qcEl.classList.contains('hidden')).toBe(true);
  });
});
