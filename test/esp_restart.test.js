/**
 * test/esp_restart.test.js — ESP.restart() and esp_restart() system reboot tests
 * Run: npx vitest run test/esp_restart.test.js
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

const { ArduinoSimulator } = loadScripts([
  'js/simulator.js',
  'js/libraries/serial.js',
  'js/libraries/freertos.js',
  'js/libraries/preferences.js',
], ['ArduinoSimulator']);

describe('ESP system APIs and restart', () => {
  let sim;

  beforeEach(() => {
    sim = new ArduinoSimulator();
    sim.board = 'esp32_devkit_v1';
    global.window.ArduinoSim = sim;
    delete global.window._testBootCount;
    delete global.window._preferencesStores;
  });

  afterEach(() => {
    if (sim && sim.isRunning) sim.stop();
  });

  it('defines ESP and esp_restart in buildContext', () => {
    const ctx = sim.buildContext();
    expect(ctx.ESP).toBeDefined();
    expect(typeof ctx.ESP.restart).toBe('function');
    expect(typeof ctx.ESP.reset).toBe('function');
    expect(typeof ctx.esp_restart).toBe('function');
    expect(typeof ctx._a.esp_restart).toBe('function');

    expect(ctx.ESP.getFreeHeap()).toBeGreaterThan(0);
    expect(ctx.ESP.getHeapSize()).toBe(327680);
    expect(ctx.ESP.getChipModel()).toBe('ESP32-D0WDQ6');
    expect(ctx.ESP.getChipCores()).toBe(2);
    expect(ctx.ESP.getCpuFreqMHz()).toBe(240);
    expect(ctx.ESP.getFlashChipSize()).toBe(4194304);
  });

  it('compiles sketches using ESP.restart() and esp_restart() without errors', async () => {
    const code = `
      void setup() {
        ESP.restart();
      }
      void loop() {}
    `;
    const res = await sim.compile(code);
    expect(res.ok).toBe(true);

    const code2 = `
      void setup() {
        esp_restart();
      }
      void loop() {}
    `;
    const res2 = await sim.compile(code2);
    expect(res2.ok).toBe(true);
  });

  it('restarts execution and re-runs setup() on ESP.restart()', async () => {
    const logs = [];
    sim.onSerial = (text, type) => logs.push({ text, type });

    global.window._testBootCount = 0;

    const sketch = `
      int runVar = 10;
      void setup() {
        window._testBootCount = (window._testBootCount || 0) + 1;
        Serial.print("BootCount=");
        Serial.println(window._testBootCount);
        if (window._testBootCount < 3) {
          ESP.restart();
        }
      }
      void loop() {
        delay(100);
      }
    `;

    sim.speed = 10; // Fast execution
    const runPromise = sim.run(sketch);

    // Wait until boot count reaches 3
    const deadline = Date.now() + 3000;
    while ((global.window._testBootCount || 0) < 3 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 20));
    }

    expect(global.window._testBootCount).toBe(3);

    const allText = logs.map(l => l.text).join('');
    expect(allText).toContain('BootCount=1');
    expect(allText).toContain('BootCount=2');
    expect(allText).toContain('BootCount=3');
    expect(allText).toContain('[ESP] Restarting system...');

    sim.stop();
    await runPromise;
  });

  it('works with esp_restart() identically', async () => {
    const logs = [];
    sim.onSerial = (text, type) => logs.push({ text, type });

    global.window._testBootCount = 0;

    const sketch = `
      void setup() {
        window._testBootCount = (window._testBootCount || 0) + 1;
        Serial.print("Run=");
        Serial.println(window._testBootCount);
        if (window._testBootCount < 2) {
          esp_restart();
        }
      }
      void loop() {
        delay(50);
      }
    `;

    sim.speed = 10;
    const runPromise = sim.run(sketch);

    const deadline = Date.now() + 3000;
    while ((global.window._testBootCount || 0) < 2 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 20));
    }

    expect(global.window._testBootCount).toBe(2);
    const allText = logs.map(l => l.text).join('');
    expect(allText).toContain('Run=1');
    expect(allText).toContain('Run=2');

    sim.stop();
    await runPromise;
  });

  it('survives persistent memory (Preferences) across ESP.restart()', async () => {
    const logs = [];
    sim.onSerial = (text, type) => logs.push({ text, type });

    const sketch = `
      #include <Preferences.h>
      Preferences prefs;

      void setup() {
        prefs.begin("my-app", false);
        int count = prefs.getInt("boots", 0);
        Serial.print("PrefsBoot=");
        Serial.println(count);
        prefs.putInt("boots", count + 1);
        if (count < 2) {
          ESP.restart();
        }
      }
      void loop() {
        delay(50);
      }
    `;

    sim.speed = 10;
    const runPromise = sim.run(sketch);

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const allText = logs.map(l => l.text).join('');
      if (allText.includes('PrefsBoot=2')) break;
      await new Promise(r => setTimeout(r, 20));
    }

    const allText = logs.map(l => l.text).join('');
    expect(allText).toContain('PrefsBoot=0');
    expect(allText).toContain('PrefsBoot=1');
    expect(allText).toContain('PrefsBoot=2');

    sim.stop();
    await runPromise;
  });

  it('stops safely when hitting restart limit on infinite restart loop', async () => {
    const logs = [];
    sim.onSerial = (text, type) => logs.push({ text, type });

    const infiniteRestartSketch = `
      void setup() {
        ESP.restart();
      }
      void loop() {}
    `;

    sim.speed = 100; // Ultra fast
    await sim.run(infiniteRestartSketch);

    const errorLog = logs.find(l => l.text && l.text.includes('Restart limit (100) reached'));
    expect(errorLog).toBeDefined();
    expect(sim.isRunning).toBe(false);
  }, 15000);
});
