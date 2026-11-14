import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

global.window = {
  ArduinoComponents: { COMPONENT_DEFS: {} },
};

function loadScripts(files, names) {
  const code = files.map(readSrc).join('\n;\n');
  const fn = new Function('window',
    code + '\n;return {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : (window['${n}'] || undefined)`).join(', ') + '};');
  return fn(global.window);
}

const { ComponentSvg, COMPONENT_CATALOG } = loadScripts([
  'js/components/base.js',
  'js/components/component-svg.js',
], ['ComponentSvg', 'COMPONENT_CATALOG']);

describe('Visual Component Cards with SVG Previews', () => {
  it('ComponentSvg is defined with getSvg and getBadge methods', () => {
    expect(ComponentSvg).toBeDefined();
    expect(typeof ComponentSvg.getSvg).toBe('function');
    expect(typeof ComponentSvg.getBadge).toBe('function');
  });

  it('generates valid crisp SVG for all 132 catalog components without error', () => {
    expect(COMPONENT_CATALOG).toBeDefined();
    let count = 0;
    for (const group of COMPONENT_CATALOG) {
      for (const id of group.ids || []) {
        const svg = ComponentSvg.getSvg(id);
        expect(svg).toBeDefined();
        expect(svg).toContain('<svg');
        expect(svg).toContain('class="comp-svg-preview"');
        expect(svg).toContain('viewBox="0 0 36 36"');
        expect(svg).toContain('</svg>');
        count++;
      }
      if (group.dropdown && group.dropdown.variants) {
        for (const v of group.dropdown.variants) {
          const svg = ComponentSvg.getSvg(v.id, v);
          expect(svg).toBeDefined();
          expect(svg).toContain('<svg');
          expect(svg).toContain('</svg>');
          count++;
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(132);
  });

  it('renders authentic DIP packages for digital and analog ICs with chip labels', () => {
    // 555 timer
    const svg555 = ComponentSvg.getSvg('ic_555');
    expect(svg555).toContain('555');
    expect(svg555).toContain('orientation notch');
    expect(svg555).toContain('Pin 1 dot');

    // Dual Op-Amp LM358
    const svg358 = ComponentSvg.getSvg('lm358');
    expect(svg358).toContain('358');

    // Quad NAND 74HC00
    const svg7400 = ComponentSvg.getSvg('ic_74hc00');
    expect(svg7400).toContain('74HC00');

    // Shift Register 74HC595
    const svg595 = ComponentSvg.getSvg('ic_74hc595');
    expect(svg595).toContain('74HC595');

    // Wide 40-pin IC 8255
    const svg8255 = ComponentSvg.getSvg('ic_8255');
    expect(svg8255).toContain('8255');
  });

  it('renders realistic miniaturized visual features for prominent sensors', () => {
    // HC-SR04 Ultrasonic (Transmitter T and Receiver R cans)
    const hcsr04 = ComponentSvg.getSvg('hcsr04');
    expect(hcsr04).toContain('>T<');
    expect(hcsr04).toContain('>R<');

    // DHT11 (Vents and humidity case)
    const dht11 = ComponentSvg.getSvg('dht11');
    expect(dht11).toContain('DHT11');
    expect(dht11).toContain('Air vents');

    // PIR motion sensor (Fresnel dome and facet rings)
    const pir = ComponentSvg.getSvg('pir');
    expect(pir).toContain('Fresnel dome');
    expect(pir).toContain('Orange trim pots');

    // LDR photoresistor (Serpentine CdS track)
    const ldr = ComponentSvg.getSvg('ldr');
    expect(ldr).toContain('Cadmium Sulfide');

    // MPU6050 (QFN chip and axis arrows)
    const mpu = ComponentSvg.getSvg('mpu6050');
    expect(mpu).toContain('MPU6050');
    expect(mpu).toContain('QFN-24');

    // DS3231 RTC (Coin cell holder)
    const ds = ComponentSvg.getSvg('ds3231');
    expect(ds).toContain('Coin cell holder');
    expect(ds).toContain('DS3231');

    // BME280 (Vent hole)
    const bme = ComponentSvg.getSvg('bme280');
    expect(bme).toContain('BME280');
    expect(bme).toContain('Barometer vent hole');
  });

  it('renders distinct colored domes for all LED variants', () => {
    const red = ComponentSvg.getSvg('led');
    expect(red).toContain('#ff3333');

    const green = ComponentSvg.getSvg('led_green');
    expect(green).toContain('#00e676');

    const blue = ComponentSvg.getSvg('led_blue');
    expect(blue).toContain('#2979ff');

    const yellow = ComponentSvg.getSvg('led_yellow');
    expect(yellow).toContain('#ffea00');

    const white = ComponentSvg.getSvg('led_white');
    expect(white).toContain('#ffffff');
  });

  it('provides package and protocol badges for components', () => {
    expect(ComponentSvg.getBadge('ic_555')).toBe('DIP-8');
    expect(ComponentSvg.getBadge('lm358')).toBe('DIP-8');
    expect(ComponentSvg.getBadge('ic_74hc00')).toBe('DIP-14');
    expect(ComponentSvg.getBadge('ic_74hc595')).toBe('DIP-16');
    expect(ComponentSvg.getBadge('ic_8255')).toBe('DIP-40');
    expect(ComponentSvg.getBadge('hcsr04')).toBe('Ultrasonic');
    expect(ComponentSvg.getBadge('dht11')).toBe('1-Wire');
    expect(ComponentSvg.getBadge('mpu6050')).toContain('I2C');
    expect(ComponentSvg.getBadge('arduino_uno')).toBe('ATmega328P');
    expect(ComponentSvg.getBadge('resistor')).toBe('Resistor');
  });

  it('falls back gracefully to a generic styled PCB module for arbitrary unknown components', () => {
    const custom = ComponentSvg.getSvg('unknown_custom_sensor_xyz', { name: 'Custom Module' });
    expect(custom).toContain('<svg');
    expect(custom).toContain('comp-svg-preview');
    expect(custom).toContain('CUSTO');
  });
});
