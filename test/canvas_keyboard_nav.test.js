import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

global.window = {
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
      led: {
        name: 'LED',
        width: 30,
        height: 30,
        pins: [
          { id: 'anode', label: 'A', x: 10, y: 30, type: 'anode' },
          { id: 'cathode', label: 'K', x: 20, y: 30, type: 'cathode' }
        ]
      }
    }
  },
  prompt: () => null
};

global.document = {
  getElementById: (id) => {
    if (id === 'wiring-hint') return { classList: { remove: vi.fn(), add: vi.fn() } };
    if (id === 'modal-overlay') return { classList: { contains: () => true } }; // hidden
    if (id === 'command-palette-backdrop') return { classList: { contains: () => true } }; // hidden
    return null;
  },
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
  canvas.zoom = 1;
  canvas.panX = 0;
  canvas.panY = 0;
  canvas.GRID = 5;
  canvas.mode = 'idle';
  canvas.wiringFrom = null;
  canvas.wireMouse = null;
  canvas.ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: (text) => ({ width: text.length * 7 }),
    font: '10px sans-serif'
  };
  canvas.canvas = { width: 800, height: 600, style: {} };
  canvas._render = vi.fn();
  canvas._onChanged = vi.fn();
  canvas._notifySelectionChange = vi.fn();
  canvas.history = [];
  canvas.historyIdx = -1;
  canvas._pushHistory();
  return canvas;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Canvas Keyboard Navigation', () => {
  it('identifies sequential navigation targets (components and pins)', () => {
    const canvas = createCanvas();
    canvas.components = [
      { id: 'r1', type: 'resistor', x: 50, y: 50, rotation: 0 },
      { id: 'led1', type: 'led', x: 150, y: 50, rotation: 0 }
    ];

    const targets = canvas._getNavigationTargets();
    expect(targets).toHaveLength(6);
    expect(targets[0]).toEqual({ type: 'component', inst: canvas.components[0], pin: null });
    expect(targets[1]).toEqual({ type: 'pin', inst: canvas.components[0], pin: expect.objectContaining({ id: 'p1' }) });
    expect(targets[2]).toEqual({ type: 'pin', inst: canvas.components[0], pin: expect.objectContaining({ id: 'p2' }) });
    expect(targets[3]).toEqual({ type: 'component', inst: canvas.components[1], pin: null });
    expect(targets[4]).toEqual({ type: 'pin', inst: canvas.components[1], pin: expect.objectContaining({ id: 'anode' }) });
    expect(targets[5]).toEqual({ type: 'pin', inst: canvas.components[1], pin: expect.objectContaining({ id: 'cathode' }) });
  });

  it('cycles forward through components and pins with Tab', () => {
    const canvas = createCanvas();
    canvas.components = [
      { id: 'r1', type: 'resistor', x: 50, y: 50, rotation: 0 },
      { id: 'led1', type: 'led', x: 150, y: 50, rotation: 0 }
    ];

    // First Tab selects first component
    canvas.cycleSelection(false);
    expect(canvas.selected).toBe(canvas.components[0]);
    expect(canvas.selectedPin).toBeNull();

    // Next Tab selects pin 1 of r1
    canvas.cycleSelection(false);
    expect(canvas.selected).toBe(canvas.components[0]);
    expect(canvas.selectedPin?.pin?.id).toBe('p1');

    // Next Tab selects pin 2 of r1
    canvas.cycleSelection(false);
    expect(canvas.selected).toBe(canvas.components[0]);
    expect(canvas.selectedPin?.pin?.id).toBe('p2');

    // Next Tab selects second component (led1)
    canvas.cycleSelection(false);
    expect(canvas.selected).toBe(canvas.components[1]);
    expect(canvas.selectedPin).toBeNull();
  });

  it('cycles reverse through components and pins with Shift+Tab and wraps', () => {
    const canvas = createCanvas();
    canvas.components = [
      { id: 'r1', type: 'resistor', x: 50, y: 50, rotation: 0 },
      { id: 'led1', type: 'led', x: 150, y: 50, rotation: 0 }
    ];

    // Shift+Tab with nothing selected wraps to last pin of last component
    canvas.cycleSelection(true);
    expect(canvas.selected).toBe(canvas.components[1]);
    expect(canvas.selectedPin?.pin?.id).toBe('cathode');

    // Reverse again -> anode of led1
    canvas.cycleSelection(true);
    expect(canvas.selectedPin?.pin?.id).toBe('anode');

    // Reverse again -> led1 component
    canvas.cycleSelection(true);
    expect(canvas.selected).toBe(canvas.components[1]);
    expect(canvas.selectedPin).toBeNull();
  });

  it('cycles components only with [ and ] (skipping pins)', () => {
    const canvas = createCanvas();
    canvas.components = [
      { id: 'r1', type: 'resistor', x: 50, y: 50, rotation: 0 },
      { id: 'led1', type: 'led', x: 150, y: 50, rotation: 0 }
    ];

    canvas.cycleComponentOnly(false);
    expect(canvas.selected?.id).toBe('r1');
    expect(canvas.selectedPin).toBeNull();

    canvas.cycleComponentOnly(false);
    expect(canvas.selected?.id).toBe('led1');
    expect(canvas.selectedPin).toBeNull();

    // Reverse cycle with [
    canvas.cycleComponentOnly(true);
    expect(canvas.selected?.id).toBe('r1');
  });

  it('nudges selected components with fine steps (2px) and Shift snap steps (10px)', () => {
    const canvas = createCanvas();
    const comp = { id: 'r1', type: 'resistor', x: 104, y: 106, selected: true, rotation: 0 };
    canvas.components = [comp];
    canvas.selected = comp;

    // Fine nudge right (+2px)
    canvas.nudgeSelected(1, 0, false);
    expect(comp.x).toBe(106);
    expect(comp.y).toBe(106);

    // Fine nudge down (+2px)
    canvas.nudgeSelected(0, 1, false);
    expect(comp.x).toBe(106);
    expect(comp.y).toBe(108);

    // Shift 10px snap step right
    canvas.nudgeSelected(1, 0, true);
    // (106 + 10) / 10 = 11.6 -> round = 12 * 10 = 120
    expect(comp.x).toBe(120);

    // Shift 10px snap step up
    canvas.nudgeSelected(0, -1, true);
    // (108 - 10) / 10 = 9.8 -> round = 10 * 10 = 100
    expect(comp.y).toBe(100);
  });

  it('starts wiring from selected pin on W and connects to target pin', () => {
    const canvas = createCanvas();
    const r1 = { id: 'r1', type: 'resistor', x: 50, y: 50, rotation: 0 };
    const led1 = { id: 'led1', type: 'led', x: 150, y: 50, rotation: 0 };
    canvas.components = [r1, led1];

    // Select pin 2 of r1
    canvas.selected = r1;
    canvas.selectedPin = { inst: r1, pin: { id: 'p2', label: '2', x: 60, y: 10 } };

    // Press W: starts wiring mode
    canvas.startWiringFromSelectedPin();
    expect(canvas.mode).toBe('wiring');
    expect(canvas.wiringFrom?.inst?.id).toBe('r1');
    expect(canvas.wiringFrom?.pin?.id).toBe('p2');

    // Cycle to led1 anode pin
    canvas.cycleSelection(false);
    expect(canvas.selectedPin?.inst?.id).toBe('led1');
    expect(canvas.selectedPin?.pin?.id).toBe('anode');

    // Press W again: completes wire!
    canvas.startWiringFromSelectedPin();
    expect(canvas.mode).toBe('idle');
    expect(canvas.wires).toHaveLength(1);
    expect(canvas.wires[0].from).toEqual({ instId: 'r1', pinId: 'p2' });
    expect(canvas.wires[0].to).toEqual({ instId: 'led1', pinId: 'anode' });
  });

  it('dispatches keyboard events properly via _onKeyDown', () => {
    const canvas = createCanvas();
    const comp = { id: 'r1', type: 'resistor', x: 100, y: 100, selected: true, rotation: 0 };
    canvas.components = [comp];
    canvas.selected = comp;

    const preventDefault = vi.fn();

    // Tab key
    canvas._onKeyDown({ key: 'Tab', shiftKey: false, preventDefault, target: {} });
    expect(preventDefault).toHaveBeenCalled();
    expect(canvas.selectedPin?.pin?.id).toBe('p1');

    // ArrowDown key with Shift (10px snap step)
    preventDefault.mockClear();
    canvas._onKeyDown({ key: 'ArrowDown', shiftKey: true, preventDefault, target: {} });
    expect(preventDefault).toHaveBeenCalled();
    expect(comp.y).toBe(110);

    // Escape clears pin and component selection
    canvas._onKeyDown({ key: 'Escape', preventDefault, target: {} });
    expect(canvas.selected).toBeNull();
    expect(canvas.selectedPin).toBeNull();
  });
});
