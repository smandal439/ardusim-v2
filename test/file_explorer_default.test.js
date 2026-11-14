import { describe, it, expect, beforeEach } from 'vitest';
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
    this.listeners = {};
    this.title = '';
    this.innerHTML = '';
  }

  addEventListener(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }

  dispatchEvent(evt) {
    const list = this.listeners[evt.type || evt] || [];
    list.forEach(fn => fn(evt));
  }
}

describe('File Explorer Default Hidden / Collapsed State', () => {
  it('verifies index.html has file explorer collapsed by default', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('class="dark-theme file-explorer-collapsed"');
    expect(html).toContain('class="file-explorer collapsed"');
    expect(html).toContain('id="file-explorer-resizer" style="display: none;"');
  });

  it('collapses file explorer on EditorManager._bindFileEvents initialization', () => {
    const toggleBtn = new FakeDOMElement('btn-toggle-file-explorer', 'button');
    const expandBtn = new FakeDOMElement('btn-expand-file-explorer', 'button');
    const fileExplorer = new FakeDOMElement('file-explorer');
    const resizer = new FakeDOMElement('file-explorer-resizer');
    const body = new FakeDOMElement('body');

    const dom = {
      'btn-toggle-file-explorer': toggleBtn,
      'btn-expand-file-explorer': expandBtn,
      'file-explorer': fileExplorer,
      'file-explorer-resizer': resizer,
      'btn-new-file': new FakeDOMElement('btn-new-file', 'button'),
      'ctx-file-rename': new FakeDOMElement('ctx-file-rename'),
      'ctx-file-delete': new FakeDOMElement('ctx-file-delete')
    };

    global.document = {
      body,
      getElementById: (id) => dom[id] || null,
      querySelector: () => null,
      addEventListener: () => {}
    };

    global.window = {
      matchMedia: () => ({ matches: false }),
      monaco: {
        languages: {
          register: () => {},
          setMonarchTokensProvider: () => {},
          setLanguageConfiguration: () => {},
          registerCompletionItemProvider: () => {},
          registerHoverProvider: () => {},
          CompletionItemKind: {}
        },
        editor: {
          defineTheme: () => {}
        }
      }
    };
    global.monaco = global.window.monaco;

    const editorCode = fs.readFileSync(path.join(ROOT, 'js/editor.js'), 'utf8');
    const fnEditor = new Function(editorCode + '\nreturn EditorManager;');
    const EditorManager = fnEditor();

    EditorManager._bindFileEvents();

    // Verify it is collapsed by default
    expect(fileExplorer.classList.contains('collapsed')).toBe(true);
    expect(body.classList.contains('file-explorer-collapsed')).toBe(true);
    expect(resizer.style.display).toBe('none');
    expect(toggleBtn.title).toBe('Expand File Explorer');

    // Clicking expandBtn expands the file explorer
    expandBtn.dispatchEvent({ type: 'click' });
    expect(fileExplorer.classList.contains('collapsed')).toBe(false);
    expect(body.classList.contains('file-explorer-collapsed')).toBe(false);
    expect(resizer.style.display).toBe('');
    expect(toggleBtn.title).toBe('Collapse File Explorer');

    // Clicking toggleBtn collapses it again
    toggleBtn.dispatchEvent({ type: 'click' });
    expect(fileExplorer.classList.contains('collapsed')).toBe(true);
    expect(body.classList.contains('file-explorer-collapsed')).toBe(true);
    expect(resizer.style.display).toBe('none');

    // Calling toggleFileExplorer programmatically
    EditorManager.toggleFileExplorer(false);
    expect(fileExplorer.classList.contains('collapsed')).toBe(false);
    EditorManager.toggleFileExplorer(true);
    expect(fileExplorer.classList.contains('collapsed')).toBe(true);
  });
});
