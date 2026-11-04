import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

describe('Arduino Uno R3 layout (Tinkercad & Wokwi real board style)', () => {
  const boardsSource = fs.readFileSync(path.join(ROOT, 'js/components/boards.js'), 'utf8');

  // Load component definitions from boards.js
  const defs = {};
  const mockPIN_TYPE = {
    DIGITAL: 'digital',
    PWM: 'pwm',
    ANALOG: 'analog',
    POWER: 'power',
    GND: 'gnd',
    SIGNAL: 'signal',
  };

  const fn = new Function('defComp', 'PIN_TYPE', 'roundRect', boardsSource);
  fn(
    (comp) => { defs[comp.id] = comp; },
    mockPIN_TYPE,
    () => {}
  );

  const uno = defs['arduino_uno'];

  it('defines the arduino_uno component with correct attributes', () => {
    expect(uno).toBeDefined();
    expect(uno.id).toBe('arduino_uno');
    expect(uno.name).toBe('Arduino Uno R3');
    expect(uno.pins).toBeInstanceOf(Array);
  });

  it('places digital pins D0 through D13 from right to left along the top edge', () => {
    const pinMap = {};
    for (const p of uno.pins) {
      pinMap[p.id] = p;
    }

    // Check all digital pins D0..D13 exist on the top side
    for (let i = 0; i <= 13; i++) {
      const p = pinMap[`D${i}`];
      expect(p, `D${i} must be defined`).toBeDefined();
      expect(p.side).toBe('top');
    }

    // Verify right-to-left order: x(D0) > x(D1) > ... > x(D13)
    for (let i = 0; i < 13; i++) {
      const rightPin = pinMap[`D${i}`];
      const leftPin = pinMap[`D${i + 1}`];
      expect(rightPin.x).toBeGreaterThan(
        leftPin.x,
        `Expected D${i} (x=${rightPin.x}) to be to the right of D${i + 1} (x=${leftPin.x})`
      );
    }
  });

  it('places SCL, SDA, AREF, and GND to the left of D13 on the top header', () => {
    const pinMap = {};
    for (const p of uno.pins) {
      pinMap[p.id] = p;
    }

    expect(pinMap['SCL']).toBeDefined();
    expect(pinMap['SDA']).toBeDefined();
    expect(pinMap['AREF']).toBeDefined();
    expect(pinMap['GND_D']).toBeDefined();

    expect(pinMap['SCL'].x).toBeLessThan(pinMap['SDA'].x);
    expect(pinMap['SDA'].x).toBeLessThan(pinMap['AREF'].x);
    expect(pinMap['AREF'].x).toBeLessThan(pinMap['GND_D'].x);
    expect(pinMap['GND_D'].x).toBeLessThan(pinMap['D13'].x);
  });

  it('places the POWER header on the bottom-left and ANALOG IN header on the bottom-right', () => {
    const pinMap = {};
    for (const p of uno.pins) {
      pinMap[p.id] = p;
    }

    // Power pins
    expect(pinMap['RST']).toBeDefined();
    expect(pinMap['3V3']).toBeDefined();
    expect(pinMap['5V']).toBeDefined();
    expect(pinMap['GND1']).toBeDefined();
    expect(pinMap['GND2']).toBeDefined();
    expect(pinMap['VIN']).toBeDefined();

    // Analog pins
    for (let i = 0; i <= 5; i++) {
      expect(pinMap[`A${i}`], `A${i} must be defined`).toBeDefined();
    }

    // Order within power header: RST -> 3V3 -> 5V -> GND1 -> GND2 -> VIN
    expect(pinMap['RST'].x).toBeLessThan(pinMap['3V3'].x);
    expect(pinMap['3V3'].x).toBeLessThan(pinMap['5V'].x);
    expect(pinMap['5V'].x).toBeLessThan(pinMap['GND1'].x);
    expect(pinMap['GND1'].x).toBeLessThan(pinMap['GND2'].x);
    expect(pinMap['GND2'].x).toBeLessThan(pinMap['VIN'].x);

    // Power header must be to the left of the Analog In header
    expect(pinMap['VIN'].x).toBeLessThan(
      pinMap['A0'].x,
      'Power header (VIN) must be to the left of Analog In header (A0)'
    );

    // Order within analog header: A0 -> A1 -> A2 -> A3 -> A4 -> A5
    for (let i = 0; i < 5; i++) {
      expect(pinMap[`A${i}`].x).toBeLessThan(pinMap[`A${i + 1}`].x);
    }
  });

  it('maintains backward compatibility pins 5V2 and GND3 for existing circuits', () => {
    const pinMap = {};
    for (const p of uno.pins) {
      pinMap[p.id] = p;
    }

    expect(pinMap['5V2']).toBeDefined();
    expect(pinMap['GND3']).toBeDefined();
    expect(pinMap['5V2'].type).toBe('power');
    expect(pinMap['GND3'].type).toBe('gnd');
  });
});
