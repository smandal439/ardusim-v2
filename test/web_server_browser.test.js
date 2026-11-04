import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

// Set up mock window environment
function setupWindow() {
  global.window = {
    ArduinoLibs: {},
    ArduinoComponents: {
      COMPONENT_DEFS: {
        potentiometer: {
          id: 'potentiometer',
          interactive: [{ field: 'value', label: 'Wiper', min: 0, max: 1023, step: 1 }],
          defaultProps: { value: 512, maxValue: 1023 },
        },
        esp32_devkit_v1: {
          id: 'esp32_devkit_v1',
          pins: [
            { id: 'VP', type: 'analog' },
            { id: 'GND1', type: 'gnd' },
          ],
        },
      },
    },
    CircuitCanvas: null,
    CppTypes: {
      getTypePattern() {
        return 'void|bool|char|int|float|double|long|short|byte|boolean|unsigned|signed|String|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|ssize_t';
      },
      getFullTypeRegex() {
        const pattern = this.getTypePattern();
        return new RegExp(`(?:const\\s+)?(?:unsigned\\s+)?(?:${pattern})\\s*\\*?\\s*`, 'g');
      },
    },
    App: null,
  };
  global.window.parent = global.window;

  // Load simulator and webserver library
  eval(fs.readFileSync(path.join(root, 'js', 'simulator.js'), 'utf8'));
  eval(fs.readFileSync(path.join(root, 'js', 'libraries', 'webserver.js'), 'utf8'));
  eval(fs.readFileSync(path.join(root, 'js', 'libraries', 'serial.js'), 'utf8'));
}

describe('WebBrowser & ESP32 Web Server Potentiometer Temperature Integration', () => {
  beforeEach(() => {
    setupWindow();
  });

  it('WebBrowser handles rendering, refresh, navigation, and meta-refresh', () => {
    vi.useFakeTimers();
    try {
      // Mock DOM elements
      const iframeDoc = {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
      };
      const mockIframe = {
        contentDocument: iframeDoc,
        contentWindow: { document: iframeDoc, fetch: vi.fn() },
      };
      const mockAddrBar = { value: '', addEventListener: vi.fn() };
      const mockStatusEl = { textContent: '', style: {} };
      const mockRefreshBtn = { addEventListener: vi.fn() };
      const mockAutoBtn = { addEventListener: vi.fn(), textContent: '', style: {} };
      const mockClearBtn = { addEventListener: vi.fn() };

      global.document = {
        getElementById(id) {
          if (id === 'webbrowser-iframe') return mockIframe;
          if (id === 'webbrowser-url') return mockAddrBar;
          if (id === 'webbrowser-status') return mockStatusEl;
          if (id === 'btn-webbrowser-refresh') return mockRefreshBtn;
          if (id === 'btn-webbrowser-auto') return mockAutoBtn;
          if (id === 'btn-webbrowser-clear') return mockClearBtn;
          return null;
        },
      };

      eval(fs.readFileSync(path.join(root, 'js', 'web-browser.js'), 'utf8'));

      const browser = new window.WebBrowserClass();
      expect(browser).toBeDefined();

      // Mock simulator with web server
      const mockTriggerRoute = vi.fn();
      window.ArduinoSim = {
        _web: {
          _triggerRoute: mockTriggerRoute,
        },
      };

      // 1. Render HTML response
      const sampleHtml = '<html><head><meta http-equiv="refresh" content="2"></head><body><h1>ESP32</h1><p>Temperature: 25 &deg;C</p></body></html>';
      browser.render({
        code: 200,
        type: 'text/html',
        content: sampleHtml,
        url: '/',
      });

      expect(iframeDoc.write).toHaveBeenCalledWith(sampleHtml);
      expect(mockAddrBar.value).toBe('http://192.168.4.1/');
      expect(mockStatusEl.textContent).toBe('200 text/html');

      // 2. Meta-refresh timer fires after 2 seconds
      vi.advanceTimersByTime(2000);
      expect(mockTriggerRoute).toHaveBeenCalledWith('/');

      // 3. User manual refresh
      mockTriggerRoute.mockClear();
      browser._refresh();
      expect(mockTriggerRoute).toHaveBeenCalledWith('/');

      // 4. Navigate via address bar
      mockTriggerRoute.mockClear();
      browser._navigate('/on');
      expect(mockTriggerRoute).toHaveBeenCalledWith('/on');

      // 5. Auto-refresh toggle
      mockTriggerRoute.mockClear();
      browser.toggleAutoRefresh(true);
      expect(mockAutoBtn.textContent).toBe('Auto: ON');
      vi.advanceTimersByTime(1000);
      expect(mockTriggerRoute).toHaveBeenCalledWith('/');

      browser.toggleAutoRefresh(false);
      expect(mockAutoBtn.textContent).toBe('Auto: OFF');
      browser.stopTimers();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Potentiometer slider and wheel interaction in canvas update runtimeState and props', () => {
    eval(fs.readFileSync(path.join(root, 'js', 'canvas.js'), 'utf8'));

    const mockCanvas = {
      addEventListener: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      style: {},
    };
    global.document.createElement = () => mockCanvas;

    const potInst = {
      id: 'pot1',
      type: 'potentiometer',
      props: { value: 512, maxValue: 1023 },
      runtimeState: { value: 512 },
    };

    const canvas = Object.create(window.CircuitCanvasClass ? window.CircuitCanvasClass.prototype : {});
    canvas.components = [potInst];
    canvas.wires = [];
    canvas.zoom = 1;
    canvas.panX = 0;
    canvas.panY = 0;
    canvas.render = vi.fn();

    const inputChangeFn = vi.fn();
    canvas._onInteractiveInputChanged = inputChangeFn;

    // Test wheel scroll up (decrease deltaY -> increase pot value)
    const ctrl = { field: 'value', min: 0, max: 1023, step: 1 };
    canvas._onWheelSlider({ inst: potInst, ctrl }, -100);

    expect(potInst.runtimeState.value).toBeGreaterThan(512);
    expect(potInst.props.value).toBe(potInst.runtimeState.value);
    expect(inputChangeFn).toHaveBeenCalledWith(potInst, 'value', potInst.runtimeState.value);

    // Test wheel scroll down (increase deltaY -> decrease pot value)
    const cur = potInst.runtimeState.value;
    canvas._onWheelSlider({ inst: potInst, ctrl }, 100);
    expect(potInst.runtimeState.value).toBeLessThan(cur);
    expect(potInst.props.value).toBe(potInst.runtimeState.value);
  });

  it('ESP32 Web Server example updates temperature when potentiometer changes', async () => {
    const examplePath = path.join(root, 'Examples', 'esp32_web_server.json');
    const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

    const potInst = example.circuit.components.find(c => c.id === 'pot1');
    const boardInst = example.circuit.components.find(c => c.type === 'esp32_devkit_v1');
    expect(potInst).toBeDefined();
    expect(boardInst).toBeDefined();

    // Mock CircuitCanvas
    window.CircuitCanvas = {
      components: example.circuit.components,
      wires: example.circuit.wires,
      getBoardInst: () => boardInst,
      getBoardInstByIndex: () => boardInst,
      _getWireTarget(instId, pinId) {
        for (const wire of example.circuit.wires) {
          if (wire.from.instId === instId && wire.from.pinId === pinId) {
            const inst = example.circuit.components.find(c => c.id === wire.to.instId);
            return inst ? { inst, pinId: wire.to.pinId } : null;
          }
          if (wire.to.instId === instId && wire.to.pinId === pinId) {
            const inst = example.circuit.components.find(c => c.id === wire.from.instId);
            return inst ? { inst, pinId: wire.from.pinId } : null;
          }
        }
        return null;
      },
      _readAnalogInput(fromInstId, pinId) {
        const target = this._getWireTarget(fromInstId, pinId);
        if (target && target.inst.type === 'potentiometer' && target.pinId === 'wiper') {
          const val = target.inst.runtimeState?.value ?? target.inst.props?.value ?? 512;
          const maxVal = Number(target.inst.props?.maxValue ?? 1023);
          return Math.max(0, Math.min(1023, Math.round((Number(val) / maxVal) * 1023)));
        }
        return 0;
      },
    };

    const sim = new window.ArduinoSimulator();
    sim.setBoard('esp32_devkit_v1');
    window.ArduinoSim = sim;

    const emittedPages = [];
    sim.onWebPage = (resp) => emittedPages.push(resp);

    const code = example.files['sketch.ino'];
    const result = await sim.compile(code);
    expect(result.ok).toBe(true);

    const { vals, fn } = sim._compiledCtx;
    const sketch = fn(...vals);
    sim.speed = 10000;

    await sketch.setup();

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // 1. Initial Root page request (pot at default 512 -> ~25 deg C)
    potInst.runtimeState = { value: 512 };
    potInst.props.value = 512;
    sim._web._triggerRoute('/');
    await sleep(20);

    expect(emittedPages.length).toBeGreaterThan(0);
    const firstPage = emittedPages[emittedPages.length - 1];
    expect(firstPage.content).toContain('Temperature: <b>25 &deg;C</b>');
    expect(firstPage.content).toContain('<meta http-equiv="refresh" content="2">');

    // 2. User moves/scrolls potentiometer to maximum (1023 -> 35 deg C)
    potInst.runtimeState = { value: 1023 };
    potInst.props.value = 1023;
    sim._onInteractiveInputChanged(potInst, 'value', 1023);

    // Fast-forward debounce timer (80ms)
    await sleep(150);

    const maxPage = emittedPages[emittedPages.length - 1];
    expect(maxPage.content).toContain('Temperature: <b>35 &deg;C</b>');

    // 3. User moves/scrolls potentiometer to minimum (0 -> 15 deg C)
    potInst.runtimeState = { value: 0 };
    potInst.props.value = 0;
    sim._onInteractiveInputChanged(potInst, 'value', 0);

    await sleep(150);

    const minPage = emittedPages[emittedPages.length - 1];
    expect(minPage.content).toContain('Temperature: <b>15 &deg;C</b>');

    // 4. Test link click to toggle LED /on route
    sim._web._triggerRoute('/on');
    await sleep(20);
    expect(sim.pinStates['pin_13']).toBe(1);

    sim.stop();
  });
});
