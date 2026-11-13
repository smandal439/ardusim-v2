import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  focus() {}
  scrollIntoView() {}
}

describe('Phase 1 UI Enhancements', () => {
  let app;
  let dom;

  beforeEach(() => {
    dom = {
      'cmd-palette-overlay': new FakeDOMElement('cmd-palette-overlay'),
      'cmd-palette-modal': new FakeDOMElement('cmd-palette-modal'),
      'cmd-palette-input': new FakeDOMElement('cmd-palette-input', 'input'),
      'cmd-palette-results': new FakeDOMElement('cmd-palette-results'),
      'btn-hdr-cmd-palette': new FakeDOMElement('btn-hdr-cmd-palette', 'button'),
      'btn-menu-cmd-palette': new FakeDOMElement('btn-menu-cmd-palette', 'button'),

      'wire-quick-palette': new FakeDOMElement('wire-quick-palette'),
      'btn-wire-toggle-style': new FakeDOMElement('btn-wire-toggle-style', 'button'),
      'wire-quick-style-text': new FakeDOMElement('wire-quick-style-text', 'span'),
      'btn-wire-quick-delete': new FakeDOMElement('btn-wire-quick-delete', 'button'),
      'btn-wire-quick-close': new FakeDOMElement('btn-wire-quick-close', 'button'),

      'panel-editor': new FakeDOMElement('panel-editor'),
      'panel-canvas': new FakeDOMElement('panel-canvas'),
      'panel-components': new FakeDOMElement('panel-components'),
      'bottom-panel': new FakeDOMElement('bottom-panel'),
      'main-layout': new FakeDOMElement('main-layout'),
      'resizer-left': new FakeDOMElement('resizer-left'),
      'resizer-right': new FakeDOMElement('resizer-right'),

      'btn-layout-default': new FakeDOMElement('btn-layout-default', 'button'),
      'btn-layout-code': new FakeDOMElement('btn-layout-code', 'button'),
      'btn-layout-circuit': new FakeDOMElement('btn-layout-circuit', 'button'),
      'btn-layout-debug': new FakeDOMElement('btn-layout-debug', 'button'),

      'board-tab-1': new FakeDOMElement('board-tab-1', 'button'),
      'board-tab-2': new FakeDOMElement('board-tab-2', 'button'),
      'board2-editor-area': new FakeDOMElement('board2-editor-area'),
      'board2-monaco-container': new FakeDOMElement('board2-monaco-container'),
      'board2-code-textarea': new FakeDOMElement('board2-code-textarea', 'textarea'),
      'board2-highlight': new FakeDOMElement('board2-highlight'),
      'board2-highlight-code': new FakeDOMElement('board2-highlight-code'),
      'editor-container': new FakeDOMElement('editor-container'),
      'file-explorer': new FakeDOMElement('file-explorer'),
      'editor-tabs': new FakeDOMElement('editor-tabs'),
      'editor-body': new FakeDOMElement('editor-body'),
      'editor-cursor': new FakeDOMElement('editor-cursor')
    };

    dom['cmd-palette-overlay'].classList.add('hidden');
    dom['wire-quick-palette'].classList.add('hidden');

    // Add color swatches to wire-quick-palette
    ['#e53935', '#212121', '#1e88e5', '#43a047'].forEach(c => {
      const sw = new FakeDOMElement('', 'button');
      sw.classList.add('wire-color-swatch');
      sw.dataset.color = c;
      dom['wire-quick-palette'].children.push(sw);
    });

    global.document = {
      body: new FakeDOMElement('body'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: (id) => dom[id] || null,
      querySelector: (sel) => {
        if (sel === '.main-layout') return dom['main-layout'];
        if (sel.startsWith('#')) return dom[sel.slice(1)] || null;
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel === '.wire-color-swatch') return dom['wire-quick-palette'].children;
        return [];
      }
    };

    global.window = {
      innerHeight: 900,
      innerWidth: 1400,
      addEventListener: vi.fn(),
      ArduinoComponents: {
        COMPONENT_DEFS: {
          led: { name: 'LED' },
          resistor: { name: 'Resistor' },
          servo: { name: 'Servo Motor' }
        }
      },
      StorageManager: {
        markDirty: vi.fn()
      }
    };

    // Load App methods
    const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    const createInstance = new Function('window', 'document', `${appSource}\nreturn new App();`);
    app = createInstance(global.window, global.document);
    app.canvas = {
      selectedWire: null,
      setWireColor: vi.fn((id, col) => { if (app.canvas.selectedWire) app.canvas.selectedWire.color = col; }),
      setWireStyle: vi.fn((id, st) => { if (app.canvas.selectedWire) app.canvas.selectedWire.routeStyle = st; }),
      removeWire: vi.fn(),
      deselectAll: vi.fn(() => { app.canvas.selectedWire = null; }),
      startPlacing: vi.fn(),
      fitView: vi.fn(),
      resize: vi.fn()
    };
    app.editor = {
      getAllFiles: () => ({ 'sketch.ino': 'void setup(){}' }),
      getActiveFileName: () => 'sketch.ino',
      loadFiles: vi.fn()
    };
  });

  describe('Command Palette (Ctrl+K)', () => {
    it('initializes and provides grouped commands including components', () => {
      app._initCommandPalette();
      const commands = app._getCommandPaletteCommands();
      expect(commands.length).toBeGreaterThan(15);

      const actionCmds = commands.filter(c => c.category === 'action');
      const layoutCmds = commands.filter(c => c.category === 'layout');
      const boardCmds = commands.filter(c => c.category === 'board');
      const compCmds = commands.filter(c => c.category === 'component');

      expect(actionCmds.some(c => c.id === 'run')).toBe(true);
      expect(layoutCmds.some(c => c.id === 'layout-code')).toBe(true);
      expect(boardCmds.some(c => c.id === 'board-esp32')).toBe(true);
      expect(compCmds.some(c => c.title === 'Add LED')).toBe(true);
    });

    it('opens palette, updates visibility, and closes on Escape', () => {
      app._initCommandPalette();
      expect(dom['cmd-palette-overlay'].classList.contains('hidden')).toBe(true);

      app._openCommandPalette();
      expect(dom['cmd-palette-overlay'].classList.contains('hidden')).toBe(false);

      app._closeCommandPalette();
      expect(dom['cmd-palette-overlay'].classList.contains('hidden')).toBe(true);
    });

    it('executes a command and closes palette', () => {
      app._initCommandPalette();
      app._openCommandPalette();

      const runSpy = vi.fn();
      app._executeCommand({ id: 'test-cmd', run: runSpy });

      expect(runSpy).toHaveBeenCalled();
      expect(dom['cmd-palette-overlay'].classList.contains('hidden')).toBe(true);
    });

    it('filters commands according to search query', () => {
      app._initCommandPalette();
      app._renderCommandPaletteResults('servo');
      expect(app._cmdPaletteFiltered.length).toBeGreaterThanOrEqual(1);
      expect(app._cmdPaletteFiltered[0].title).toContain('Servo');
    });
  });

  describe('Layout Presets', () => {
    it('applies code focus layout and collapses panels', () => {
      app.applyLayoutPreset('code');
      expect(document.body.classList.contains('layout-code-focus')).toBe(true);
      expect(dom['panel-components'].classList.contains('collapsed')).toBe(true);
      expect(dom['bottom-panel'].classList.contains('collapsed')).toBe(true);
      expect(dom['btn-layout-code'].classList.contains('active')).toBe(true);
    });

    it('applies circuit focus layout and collapses editor', () => {
      app.applyLayoutPreset('circuit');
      expect(document.body.classList.contains('layout-circuit-focus')).toBe(true);
      expect(dom['panel-editor'].classList.contains('collapsed')).toBe(true);
      expect(dom['btn-layout-circuit'].classList.contains('active')).toBe(true);
    });

    it('applies debug bench layout and sets expanded bottom panel', () => {
      app.applyLayoutPreset('debug');
      expect(document.body.classList.contains('layout-debug-bench')).toBe(true);
      expect(dom['bottom-panel'].classList.contains('collapsed')).toBe(false);
      expect(dom['bottom-panel'].style.height).toBe(`${Math.round(900 * 0.42)}px`);
      expect(dom['btn-layout-debug'].classList.contains('active')).toBe(true);
    });

    it('restores default layout', () => {
      app._restoreResizedLayout = vi.fn();
      app.applyLayoutPreset('default');
      expect(document.body.classList.contains('layout-default')).toBe(true);
      expect(app._restoreResizedLayout).toHaveBeenCalled();
      expect(dom['btn-layout-default'].classList.contains('active')).toBe(true);
    });
  });

  describe('Wire Color Floating Quick-Selector', () => {
    it('initializes palette and toggles visibility on wire selection', () => {
      app._initWireQuickPalette();

      // No wire selected -> hidden
      app._updateWireQuickPalette({ selectedWire: null });
      expect(dom['wire-quick-palette'].classList.contains('hidden')).toBe(true);

      // Wire selected -> shown
      const wire = { id: 'w1', color: '#e53935', routeStyle: 'orthogonal' };
      app.canvas.selectedWire = wire;
      app._updateWireQuickPalette({ selectedWire: wire });
      expect(dom['wire-quick-palette'].classList.contains('hidden')).toBe(false);
      expect(dom['wire-quick-style-text'].textContent).toBe('Orthogonal');
    });

    it('updates wire color and style when buttons are triggered', () => {
      app._initWireQuickPalette();
      const wire = { id: 'w1', color: '#212121', routeStyle: 'orthogonal' };
      app.canvas.selectedWire = wire;
      app._updateWireQuickPalette({ selectedWire: wire });

      // Click style toggle button
      dom['btn-wire-toggle-style'].dispatchEvent({ type: 'click', stopPropagation: vi.fn() });
      expect(app.canvas.setWireStyle).toHaveBeenCalledWith('w1', 'bezier');

      // Click delete button
      dom['btn-wire-quick-delete'].dispatchEvent({ type: 'click', stopPropagation: vi.fn() });
      expect(app.canvas.removeWire).toHaveBeenCalledWith('w1');
    });
  });

  describe('Board 2 Monaco Upgrade', () => {
    it('initializes Monaco for Board 2 with Arduino C++ config', () => {
      const mockEditor = {
        getValue: vi.fn(() => 'void setup() { Serial.begin(115200); }'),
        setValue: vi.fn(),
        layout: vi.fn(),
        focus: vi.fn(),
        onDidChangeModelContent: vi.fn(),
        onDidChangeCursorPosition: vi.fn()
      };
      global.window.monaco = {
        editor: {
          create: vi.fn(() => mockEditor),
          setTheme: vi.fn()
        }
      };

      app._bindBoard2TabUI();
      expect(global.window.monaco.editor.create).toHaveBeenCalled();
      expect(app.board2Editor).toBe(mockEditor);
    });

    it('switches between Board 1 and Board 2 using Monaco', () => {
      const mockEditor = {
        getValue: vi.fn(() => 'void setup() {}'),
        setValue: vi.fn(),
        layout: vi.fn(),
        focus: vi.fn(),
        onDidChangeModelContent: vi.fn(),
        onDidChangeCursorPosition: vi.fn()
      };
      app.board2Editor = mockEditor;

      app._switchToBoard(1);
      expect(app._activeBoard).toBe(1);
      expect(dom['board2-editor-area'].style.display).toBe('flex');
      expect(dom['editor-body'].style.display).toBe('none');
      expect(mockEditor.focus).toHaveBeenCalled();

      // Read code from Monaco
      expect(app._getBoard2Code()).toBe('void setup() {}');

      // Set code updates Monaco and syncs with textarea
      app._setBoard2Code('void loop() { delay(100); }');
      expect(mockEditor.setValue).toHaveBeenCalledWith('void loop() { delay(100); }');
      expect(dom['board2-code-textarea'].value).toBe('void loop() { delay(100); }');

      // Switch back to Board 1
      app._switchToBoard(0);
      expect(app._activeBoard).toBe(0);
      expect(dom['board2-editor-area'].style.display).toBe('none');
      expect(dom['editor-body'].style.display).toBe('');
    });
  });
});
