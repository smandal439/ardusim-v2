import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
      contains(c) { return set.has(c); },
    };
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
    this.scrollHeight = 100;
    this.scrollTop = 0;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }

  dispatchEvent(evt) {
    const list = this.listeners[evt.type || evt] || [];
    list.forEach(fn => fn(evt));
  }

  querySelector(sel) {
    if (sel.includes(' ')) {
      const parts = sel.split(/\s+/);
      let curr = this;
      for (const part of parts) {
        curr = curr.querySelector ? curr.querySelector(part) : null;
        if (!curr) return null;
      }
      return curr;
    }
    if (sel.startsWith('#')) {
      const targetId = sel.slice(1);
      if (this.id === targetId) return this;
      for (const child of this.children) {
        const found = child.querySelector?.(sel);
        if (found) return found;
      }
    } else if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) return this;
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
  getBoundingClientRect() { return { left: 100, top: 100, width: 320, height: 560 }; }
}

describe('Virtual Smartphone Bluetooth Controller', () => {
  let controller;
  let mockSim;
  let mockComp;
  let elements;

  beforeEach(() => {
    elements = {};

    global.document = {
      body: new FakeDOMElement('body'),
      createElement(tag) {
        return new FakeDOMElement('', tag);
      },
      getElementById(id) {
        return elements[id] || null;
      },
    };

    // Override appendChild to track elements by ID
    const origAppend = global.document.body.appendChild.bind(global.document.body);
    global.document.body.appendChild = function (child) {
      if (child.id) elements[child.id] = child;
      return origAppend(child);
    };

    global.window = {
      document: global.document,
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock ArduinoSim
    mockSim = {
      isRunning: true,
      serialInputBuffer: [],
      pinStates: {},
      sendSerialInput(text) {
        for (const ch of text) {
          this.serialInputBuffer.push(ch);
        }
      },
      setPinState(pinKey, val) {
        this.pinStates[pinKey] = val;
      },
    };
    global.window.ArduinoSim = mockSim;

    // Mock HC-05 component instance
    mockComp = {
      id: 'bt1',
      type: 'hc05',
      props: { connected: false, rxData: '' },
      runtimeState: { connected: false, rxData: '' },
    };

    global.window.CircuitCanvas = {
      components: [mockComp],
      render: vi.fn(),
    };

    global.window.App = {
      canvas: global.window.CircuitCanvas,
      showToast: vi.fn(),
    };

    // Load and evaluate bluetooth-controller.js
    const code = fs.readFileSync(path.resolve(__dirname, '../js/bluetooth-controller.js'), 'utf-8');
    eval(code);

    controller = global.window.BluetoothPhoneModal;
  });

  it('initializes the phone DOM elements and floating pill', () => {
    expect(elements['bt-phone-wrapper']).toBeDefined();
    expect(elements['bt-phone-pill']).toBeDefined();
    expect(controller).toBeDefined();
  });

  it('opens and closes the phone interface for HC-05', () => {
    controller.open(mockComp);
    expect(controller.isOpen).toBe(true);
    expect(elements['bt-phone-wrapper'].classList.contains('hidden')).toBe(false);

    controller.close();
    expect(controller.isOpen).toBe(false);
    expect(elements['bt-phone-wrapper'].classList.contains('hidden')).toBe(true);
  });

  it('minimizes into a floating pill and restores', () => {
    controller.open(mockComp);
    controller.minimize();
    expect(controller.isMinimized).toBe(true);
    expect(elements['bt-phone-wrapper'].classList.contains('hidden')).toBe(true);
    expect(elements['bt-phone-pill'].classList.contains('hidden')).toBe(false);

    controller.restore();
    expect(controller.isMinimized).toBe(false);
    expect(elements['bt-phone-wrapper'].classList.contains('hidden')).toBe(false);
    expect(elements['bt-phone-pill'].classList.contains('hidden')).toBe(true);
  });

  it('toggles Bluetooth connection and updates HC-05 state & STATE pin', () => {
    controller.open(mockComp);
    expect(controller.connected).toBe(false);

    // Connect
    controller.toggleConnect(mockComp);
    expect(controller.connected).toBe(true);
    expect(mockComp.props.connected).toBe(true);
    expect(mockComp.runtimeState.connected).toBe(true);
    expect(mockSim.pinStates['bt1_STATE']).toBe(1);
    expect(global.window.CircuitCanvas.render).toHaveBeenCalled();

    // Disconnect
    controller.toggleConnect(mockComp);
    expect(controller.connected).toBe(false);
    expect(mockComp.props.connected).toBe(false);
    expect(mockComp.runtimeState.connected).toBe(false);
    expect(mockSim.pinStates['bt1_STATE']).toBe(0);
  });

  it('sends data to the simulator serial input buffer', () => {
    controller.open(mockComp);

    // Send '1'
    controller.sendData('1');
    expect(mockSim.serialInputBuffer).toContain('1');
    expect(controller.ledState).toBe(true);

    // Send '0'
    controller.sendData('0');
    expect(mockSim.serialInputBuffer).toContain('0');
    expect(controller.ledState).toBe(false);
  });

  it('handles incoming serial data from Arduino and updates terminal & LED readout', () => {
    controller.open(mockComp);
    controller.toggleConnect(mockComp);

    // Arduino sends "LED ON\r\n"
    controller.onSerialData('LED ON\r\n');
    expect(controller.ledState).toBe(true);

    // Arduino sends "LED OFF\r\n"
    controller.onSerialData('LED OFF\r\n');
    expect(controller.ledState).toBe(false);
  });

  it('supports customizable ON/OFF payloads and persists them to component props', () => {
    controller.open(mockComp);
    expect(controller.onPayload).toBe('1');
    expect(controller.offPayload).toBe('0');

    // Customize payloads to 'H' and 'L'
    controller.setPayloads('H', 'L');
    expect(controller.onPayload).toBe('H');
    expect(controller.offPayload).toBe('L');
    expect(mockComp.props.onPayload).toBe('H');
    expect(mockComp.props.offPayload).toBe('L');

    // Sending onPayload transmits 'H'
    controller.sendData(controller.onPayload);
    expect(mockSim.serialInputBuffer).toContain('H');
    expect(controller.ledState).toBe(true);

    // Sending offPayload transmits 'L'
    controller.sendData(controller.offPayload);
    expect(mockSim.serialInputBuffer).toContain('L');
    expect(controller.ledState).toBe(false);

    // Reopening syncs stored custom payloads from component props
    const otherComp = {
      id: 'bt2',
      type: 'hc05',
      props: { connected: true, onPayload: 'ON', offPayload: 'OFF' },
      runtimeState: { connected: true },
    };
    controller.open(otherComp);
    expect(controller.onPayload).toBe('ON');
    expect(controller.offPayload).toBe('OFF');
  });
});
