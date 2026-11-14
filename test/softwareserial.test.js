import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SoftwareSerial Library Simulation', () => {
  let sim;

  beforeEach(() => {
    global.window = {};
    global.ArduinoLibs = {};

    const serialCode = fs.readFileSync(path.resolve(__dirname, '../js/libraries/serial.js'), 'utf-8');
    eval(serialCode);

    const ssCode = fs.readFileSync(path.resolve(__dirname, '../js/libraries/softwareserial.js'), 'utf-8');
    eval(ssCode);

    const simCode = fs.readFileSync(path.resolve(__dirname, '../js/simulator.js'), 'utf-8');
    eval(simCode);

    sim = new global.window.ArduinoSimulator();
  });

  it('transpiles SoftwareSerial sketch without syntax errors', () => {
    const code = `
      #include <SoftwareSerial.h>
      SoftwareSerial mySerial(10, 11);
      int ledPin = 13;

      void setup() {
        pinMode(ledPin, OUTPUT);
        Serial.begin(115200);
        mySerial.begin(9600);
        mySerial.println("Software serial ready!");
      }

      void loop() {
        if (mySerial.available()) {
          char c = mySerial.read();
          if (c == '1') {
            digitalWrite(ledPin, HIGH);
            Serial.println("LED ON");
          }
        }
      }
    `;

    const js = sim.transpile(code);
    expect(js).toContain('mySerial = _a.softwareSerialNew(10, 11)');
    expect(js).not.toContain('#include');
  });

  it('instantiates SoftwareSerial with all standard Arduino stream methods', () => {
    const lib = global.window.ArduinoLibs['SoftwareSerial'];
    const mockSelf = {
      _serialLog: () => {},
      _softSerial: {},
    };

    const rt = lib.runtime(mockSelf);
    const ss = rt.softwareSerialNew(10, 11);

    expect(typeof ss.begin).toBe('function');
    expect(typeof ss.available).toBe('function');
    expect(typeof ss.read).toBe('function');
    expect(typeof ss.peek).toBe('function');
    expect(typeof ss.write).toBe('function');
    expect(typeof ss.print).toBe('function');
    expect(typeof ss.println).toBe('function');
    expect(typeof ss.listen).toBe('function');
    expect(typeof ss.isListening).toBe('function');
    expect(typeof ss.end).toBe('function');
    expect(typeof ss.flush).toBe('function');
  });

  it('correctly handles available, read, write, and incoming data', () => {
    const lib = global.window.ArduinoLibs['SoftwareSerial'];
    const logs = [];
    const mockSelf = {
      _serialLog: (msg, type) => logs.push({ msg, type }),
      _softSerial: {},
    };

    const rt = lib.runtime(mockSelf);
    const ss = rt.softwareSerialNew(10, 11);
    ss.begin(9600);

    expect(ss.available()).toBe(0);
    expect(ss.read()).toBe(-1);

    // Simulate incoming data pushed to channel
    const ch = mockSelf._softSerial[ss._ssId];
    ch.buf.push('1');
    ch.buf.push('0');

    expect(ss.available()).toBe(2);
    expect(ss.peek()).toBe(49); // '1' = 49
    expect(ss.read()).toBe(49);
    expect(ss.available()).toBe(1);
    expect(ss.read()).toBe(48); // '0' = 48
    expect(ss.available()).toBe(0);

    // Test print & println
    ss.println('Hello SoftwareSerial');
    expect(logs.some(l => l.msg.includes('Hello SoftwareSerial'))).toBe(true);
  });

  it('runs the user sketch and triggers LED toggle on incoming data', async () => {
    const code = `
      #include <SoftwareSerial.h>
      SoftwareSerial mySerial(10, 11);
      int ledPin = 13;
      bool ledState = false;

      void setup() {
        pinMode(ledPin, OUTPUT);
        Serial.begin(115200);
        mySerial.begin(9600);
        digitalWrite(ledPin, LOW);
      }

      void loop() {
        if (mySerial.available()) {
          char c = mySerial.read();
          if (c == '1') {
            ledState = true;
            digitalWrite(ledPin, HIGH);
            Serial.println("LED ON");
          } else if (c == '0') {
            ledState = false;
            digitalWrite(ledPin, LOW);
            Serial.println("LED OFF");
          }
        }
      }
    `;

    sim.board = 'arduino_uno';
    const result = await sim.compile(code);
    expect(result.ok).toBe(true);

    const { vals, fn } = sim._compiledCtx;
    const sketch = fn(...vals);
    await sketch.setup();

    // Verify initial state: pin 13 is LOW
    expect(sim.pinStates['pin_13']).toBe(0);

    // Send '1' through sendSerialInput
    sim.sendSerialInput('1');
    await sketch.loop();

    // Verify pin 13 is HIGH (LED ON)
    expect(sim.pinStates['pin_13']).toBe(1);

    // Send '0' through sendSerialInput
    sim.sendSerialInput('0');
    await sketch.loop();

    // Verify pin 13 is LOW (LED OFF)
    expect(sim.pinStates['pin_13']).toBe(0);
  });
});
