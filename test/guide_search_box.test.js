import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function createMockElement(tagName = 'div') {
  const listeners = {};
  const classes = new Set();
  const children = [];
  return {
    tagName: tagName.toUpperCase(),
    innerHTML: '',
    value: '',
    focus: () => {},
    classList: {
      add: (...c) => c.forEach(cls => classes.add(cls)),
      remove: (...c) => c.forEach(cls => classes.delete(cls)),
      toggle: (cls, force) => {
        if (force === undefined) {
          if (classes.has(cls)) { classes.delete(cls); return false; }
          classes.add(cls); return true;
        }
        if (force) { classes.add(cls); return true; }
        classes.delete(cls); return false;
      },
      contains: (cls) => classes.has(cls)
    },
    addEventListener: (evt, fn) => { (listeners[evt] ||= []).push(fn); },
    dispatchEvent: (evt) => {
      const type = typeof evt === 'string' ? evt : evt.type;
      (listeners[type] || []).forEach(fn => fn(evt));
    },
    appendChild: (child) => { children.push(child); },
    querySelectorAll: () => [],
    dataset: {}
  };
}

function setupGuideEnvironment(mockDoc) {
  const windowMock = {
    ArduinoComponents: {
      COMPONENT_DEFS: {
        led: { name: 'LED', category: 'Output', desc: 'Standard LED', icon: '💡' },
        resistor: { name: 'Resistor', category: 'Passives', desc: 'Resistor component', icon: '⚡' }
      },
      COMPONENT_CATALOG: [
        { category: 'Output', ids: ['led'] },
        { category: 'Passives', ids: ['resistor'] }
      ]
    }
  };

  const codeSvg = readSrc('js/components/component-svg.js');
  const codeGuide = readSrc('js/guide.js');

  const fn = new Function('window', 'document', `
    ${codeSvg}
    ${codeGuide}
    return {
      GuideManager: window.GuideManager
    };
  `);

  return fn(windowMock, mockDoc);
}

describe('Component Reference Search Box and Toolbar Gap', () => {
  it('renders .gc-search-box with accent icon, clean placeholder, and clear button', () => {
    const root = createMockElement('div');
    const elements = {};
    root.querySelector = (sel) => {
      if (!elements[sel]) elements[sel] = createMockElement();
      return elements[sel];
    };

    const mockDoc = {
      getElementById: (id) => (id === 'guide-pane-components' ? root : null),
      createElement: (tag) => createMockElement(tag)
    };

    const { GuideManager } = setupGuideEnvironment(mockDoc);
    GuideManager._renderCompGrid = () => {};
    GuideManager._renderComponents();

    expect(root.innerHTML).toContain('class="gc-toolbar"');
    expect(root.innerHTML).toContain('class="gc-search-box library-search"');
    expect(root.innerHTML).toContain('id="gc-search"');
    expect(root.innerHTML).toContain('placeholder="Search components..."');
    expect(root.innerHTML).toContain('id="gc-search-clear"');
    expect(root.innerHTML).toContain('class="search-clear"');
  });

  it('provides CSS gap below search box and styles matching other search boxes', () => {
    const css = readSrc('css/style.css');
    expect(css).toContain('.gc-toolbar');
    expect(css).toContain('gap: 12px;');
    expect(css).toContain('.gc-search-box');
    expect(css).toContain('border-radius: var(--radius-md);');
    expect(css).toContain('box-shadow: 0 0 0 3px rgba(0, 151, 156, 0.18);');
  });

  it('handles query typing and clear button click to reset search', () => {
    const searchInput = createMockElement('input');
    const searchClear = createMockElement('span');
    const filterBox = createMockElement('div');

    const elements = {
      '#gc-search': searchInput,
      '#gc-search-clear': searchClear,
      '#gc-filters': filterBox
    };

    const root = createMockElement('div');
    root.querySelector = (sel) => elements[sel] || createMockElement();

    const mockDoc = {
      getElementById: (id) => (id === 'guide-pane-components' ? root : null),
      createElement: (tag) => createMockElement(tag)
    };

    const { GuideManager } = setupGuideEnvironment(mockDoc);
    GuideManager._renderCompGrid = () => {};
    GuideManager._renderComponents();

    // Type query
    searchInput.value = 'resistor';
    searchInput.dispatchEvent({ type: 'input', target: { value: 'resistor' } });
    expect(GuideManager._compQuery).toBe('resistor');
    expect(searchClear.classList.contains('visible')).toBe(true);

    // Click clear button
    searchClear.dispatchEvent({ type: 'click' });
    expect(GuideManager._compQuery).toBe('');
    expect(searchInput.value).toBe('');
    expect(searchClear.classList.contains('visible')).toBe(false);
  });
});
