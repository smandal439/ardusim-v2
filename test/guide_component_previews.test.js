import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function setupEnvironment() {
  const windowMock = {
    ArduinoComponents: {
      COMPONENT_DEFS: {
        hcsr04: { name: 'Ultrasonic Sensor (HC-SR04)', category: 'Sensors', desc: 'Distance sensor', icon: '📡' },
        ic_555: { name: '555 Timer IC', category: 'Logic & ICs', desc: 'Timer / oscillator', icon: '⏱️' },
        arduino_uno: { name: 'Arduino Uno R3', category: 'Microcontrollers', desc: 'Development board', icon: '💻', pins: [{ id: 'D0' }, { id: 'D1' }] },
        resistor: { name: 'Resistor', category: 'Passives', desc: 'Limits electrical current', icon: '⚡' },
      },
      COMPONENT_CATALOG: [
        { category: 'Sensors', ids: ['hcsr04'] },
        { category: 'Logic & ICs', ids: ['ic_555'] },
        { category: 'Microcontrollers', ids: ['arduino_uno'] },
        { category: 'Passives', ids: ['resistor'] },
      ]
    }
  };

  const codeSvg = readSrc('js/components/component-svg.js');
  const codeGuide = readSrc('js/guide.js');

  const fn = new Function('window', 'document', `
    ${codeSvg}
    ${codeGuide}
    return {
      ComponentSvg: window.ComponentSvg,
      GuideManager: window.GuideManager,
      GUIDE_COMPONENTS: window.GuideManagerData.GUIDE_COMPONENTS
    };
  `);

  return fn(windowMock, global.document);
}

function createMockRoot() {
  const elements = {};
  return {
    innerHTML: '',
    querySelector: (selector) => {
      if (!elements[selector]) {
        elements[selector] = {
          innerHTML: '',
          textContent: '',
          addEventListener: () => {},
          querySelectorAll: () => []
        };
      }
      return elements[selector];
    },
    querySelectorAll: () => []
  };
}

describe('Guide Section Component Reference Tiles with SVG Previews', () => {
  it('renders .gc-card-preview-wrap with crisp SVG previews on component tiles in grid', () => {
    const { GuideManager, ComponentSvg } = setupEnvironment();
    expect(GuideManager).toBeDefined();
    expect(ComponentSvg).toBeDefined();

    const root = createMockRoot();
    GuideManager._compQuery = '';
    GuideManager._compCategory = 'all';
    GuideManager._renderCompGrid(root);

    const grid = root.querySelector('#gc-grid');
    expect(grid.innerHTML).toContain('class="gc-card"');
    expect(grid.innerHTML).toContain('class="gc-card-preview-wrap"');
    expect(grid.innerHTML).toContain('class="gc-card-preview"');
    expect(grid.innerHTML).toContain('class="comp-svg-preview"');
    expect(grid.innerHTML).toContain('data-comp="hcsr04"');
    expect(grid.innerHTML).toContain('data-comp="ic_555"');
    expect(grid.innerHTML).toContain('data-comp="arduino_uno"');
    expect(grid.innerHTML).toContain('data-comp="resistor"');
  });

  it('renders package badges like DIP-8 on IC reference tiles', () => {
    const { GuideManager } = setupEnvironment();
    const root = createMockRoot();

    GuideManager._compQuery = '555';
    GuideManager._compCategory = 'all';
    GuideManager._renderCompGrid(root);

    const grid = root.querySelector('#gc-grid');
    expect(grid.innerHTML).toContain('class="comp-badge"');
    expect(grid.innerHTML).toContain('DIP-8');
  });

  it('renders .gc-detail-preview with SVG preview in component detail reference sheet', () => {
    const { GuideManager } = setupEnvironment();
    const root = createMockRoot();

    GuideManager._renderCompDetail(root, 'hcsr04');

    expect(root.innerHTML).toContain('class="gc-detail-preview"');
    expect(root.innerHTML).toContain('class="comp-svg-preview"');
    expect(root.innerHTML).toContain('class="gc-detail-title-wrap"');
    expect(root.innerHTML).toContain('Ultrasonic Sensor (HC-SR04)');
    expect(root.innerHTML).toContain('Ultrasonic');
  });
});
