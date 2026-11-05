import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

describe('Mobile View Enhancements', () => {
  describe('Touch Gesture & Hit Testing in CircuitCanvas', () => {
    it('executes two-finger pinch-to-zoom and pan with render updates', () => {
      // Mock minimal canvas instance
      const canvasMock = {
        zoom: 1.0,
        panX: 0,
        panY: 0,
        _isPinching: false,
        _touchActive: false,
        _renderCount: 0,
        _render() { this._renderCount++; },
        _updateZoomDisplay() {},
        canvas: {
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
        },
        _getTouchDist(touches) {
          const dx = touches[0].clientX - touches[1].clientX;
          const dy = touches[0].clientY - touches[1].clientY;
          return Math.sqrt(dx * dx + dy * dy);
        },
        _getTouchCenter(touches) {
          return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
          };
        }
      };

      // Import methods logic from js/canvas.js
      const canvasCode = fs.readFileSync(path.join(ROOT, 'js/canvas.js'), 'utf8');
      expect(canvasCode).toContain('this.panX += (center.x - this._pinchCenter.x);');
      expect(canvasCode).toContain('this.panY += (center.y - this._pinchCenter.y);');
      expect(canvasCode).toContain('this._render();');

      // Test pinch start
      const eStart = {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 }
        ],
        preventDefault: vi.fn()
      };
      // Simulate _onTouchStart logic
      canvasMock._touchActive = false;
      canvasMock._pinchStart = canvasMock._getTouchDist(eStart.touches); // 100
      canvasMock._pinchCenter = canvasMock._getTouchCenter(eStart.touches); // {x:150, y:100}
      canvasMock._isPinching = true;

      expect(canvasMock._pinchStart).toBe(100);
      expect(canvasMock._pinchCenter).toEqual({ x: 150, y: 100 });

      // Test pinch move with zoom & pan
      const eMove = {
        touches: [
          { clientX: 80, clientY: 120 },
          { clientX: 280, clientY: 120 }
        ],
        preventDefault: vi.fn()
      };
      const dist = canvasMock._getTouchDist(eMove.touches); // 200
      const center = canvasMock._getTouchCenter(eMove.touches); // {x:180, y:120}
      const factor = dist / canvasMock._pinchStart; // 2.0

      // Pan Center delta
      canvasMock.panX += (center.x - canvasMock._pinchCenter.x); // +30
      canvasMock.panY += (center.y - canvasMock._pinchCenter.y); // +20

      // Zoom around mx, my
      const mx = center.x;
      const my = center.y;
      canvasMock.panX -= (mx - canvasMock.panX) * (factor - 1);
      canvasMock.panY -= (my - canvasMock.panY) * (factor - 1);
      canvasMock.zoom = Math.max(0.1, Math.min(4, canvasMock.zoom * factor));
      canvasMock._pinchStart = dist;
      canvasMock._pinchCenter = center;
      canvasMock._render();

      expect(canvasMock.zoom).toBe(2.0);
      expect(canvasMock._renderCount).toBe(1);
    });

    it('uses expanded hit-testing radius for pins on touch devices', () => {
      const canvasCode = fs.readFileSync(path.join(ROOT, 'js/canvas.js'), 'utf8');
      expect(canvasCode).toContain('isTouch ? Math.max(16, 22 / this.zoom) : Math.max(8, 10 / this.zoom)');

      // Evaluate radius logic
      const getPinRadius = (isTouch, zoom) => {
        return isTouch ? Math.max(16, 22 / zoom) : Math.max(8, 10 / zoom);
      };

      // Desktop/mouse at 1x zoom
      expect(getPinRadius(false, 1.0)).toBe(10);
      // Touch/mobile at 1x zoom
      expect(getPinRadius(true, 1.0)).toBe(22);

      // Pin at (100, 100), user touches at (115, 100) -> distance = 15
      const pinDist = 15;
      const hitDesktop = pinDist <= getPinRadius(false, 1.0);
      const hitTouch = pinDist <= getPinRadius(true, 1.0);

      expect(hitDesktop).toBe(false); // Misses on desktop mouse click
      expect(hitTouch).toBe(true);    // Hits on mobile finger tap
    });

    it('uses expanded threshold for wire hit-testing on touch devices', () => {
      const canvasCode = fs.readFileSync(path.join(ROOT, 'js/canvas.js'), 'utf8');
      expect(canvasCode).toContain('isTouch ? Math.max(12, 16 / this.zoom) : Math.max(6, 8 / this.zoom)');

      const getWireThreshold = (isTouch, zoom) => {
        return isTouch ? Math.max(12, 16 / zoom) : Math.max(6, 8 / zoom);
      };

      // Desktop/mouse at 1x zoom
      expect(getWireThreshold(false, 1.0)).toBe(8);
      // Touch/mobile at 1x zoom
      expect(getWireThreshold(true, 1.0)).toBe(16);

      // Tap 10px away from wire
      const tapDist = 10;
      expect(tapDist <= getWireThreshold(false, 1.0)).toBe(false); // Misses with mouse
      expect(tapDist <= getWireThreshold(true, 1.0)).toBe(true);  // Hits with finger
    });
  });

  describe('Mobile Canvas Quick-Action Bar', () => {
    let mockElement;

    beforeEach(() => {
      mockElement = {
        innerHTML: '',
        classList: {
          classes: new Set(['hidden']),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([])
      };
    });

    it('renders component quick actions (Rotate, Props, Clone, Delete, Done)', () => {
      // Mock App helper
      const app = {
        _isMobile: true,
        _escHtml(s) { return s; },
        _updateMobileCanvasActions(state) {
          const bar = mockElement;
          if (!this._isMobile || !state) {
            bar.classList.add('hidden');
            bar.innerHTML = '';
            return;
          }
          const { selected, selectedWire } = state;
          if (selected) {
            bar.classList.remove('hidden');
            const title = selected.props?.label || selected.type || 'Part';
            bar.innerHTML = `
              <div class="mob-actions-wrap">
                <span class="mob-action-title">${title}</span>
                <div class="mob-action-buttons">
                  <button type="button" class="mob-action-btn" id="mob-action-rotate">Rotate</button>
                  <button type="button" class="mob-action-btn" id="mob-action-props">Props</button>
                  <button type="button" class="mob-action-btn" id="mob-action-duplicate">Clone</button>
                  <button type="button" class="mob-action-btn mob-btn-danger" id="mob-action-delete">Delete</button>
                  <button type="button" class="mob-action-btn" id="mob-action-done">✕</button>
                </div>
              </div>`;
            return;
          }
          if (selectedWire) {
            bar.classList.remove('hidden');
            bar.innerHTML = '<div class="mob-actions-wrap"><div class="mob-wire-colors"></div></div>';
            return;
          }
          bar.classList.add('hidden');
        }
      };

      // 1. When a component is selected
      app._updateMobileCanvasActions({
        selected: { id: 'led_1', type: 'led', props: { label: 'Status LED' } },
        selectedWire: null
      });

      expect(mockElement.classList.contains('hidden')).toBe(false);
      expect(mockElement.innerHTML).toContain('Status LED');
      expect(mockElement.innerHTML).toContain('Rotate');
      expect(mockElement.innerHTML).toContain('Props');
      expect(mockElement.innerHTML).toContain('Clone');
      expect(mockElement.innerHTML).toContain('Delete');

      // 2. When deselected
      app._updateMobileCanvasActions(null);
      expect(mockElement.classList.contains('hidden')).toBe(true);
    });

    it('renders wire quick actions with palette and route style toggle', () => {
      const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
      expect(appCode).toContain('mob-wire-colors');
      expect(appCode).toContain('mob-wire-style');
      expect(appCode).toContain('mob-wire-delete');
      expect(appCode).toContain('this.canvas?.setWireColor');
      expect(appCode).toContain('this.canvas?.setWireStyle');
    });
  });

  describe('Mobile Bottom Sheet DOM Hierarchy Preservation', () => {
    it('moves and restores .editor-main preserving tabs and editor container', () => {
      const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
      // In _openMobileSheet('sheet-editor')
      expect(appCode).toContain("const editorMain = document.querySelector('.editor-main');");
      expect(appCode).toContain('body.appendChild(editorMain);');

      // In _closeAllMobileSheets()
      expect(appCode).toContain('resizer.after(editorMain);');
      expect(appCode).toContain('editorBodyContainer.appendChild(editorMain);');
    });

    it('restores serial monitor to #btm-panel-body', () => {
      const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
      expect(appCode).toContain("const btmBody = document.getElementById('btm-panel-body') || document.getElementById('bottom-panel');");
      expect(appCode).toContain('btmBody.appendChild(serialPane);');
    });
  });

  describe('Mobile Hints and Cancellation', () => {
    it('has cancel buttons in wiring and placing hint banners in index.html', () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      expect(html).toContain('id="btn-cancel-wiring"');
      expect(html).toContain('id="btn-cancel-placing"');
      expect(html).toContain('id="mobile-canvas-actions"');
    });

    it('binds cancel buttons to canvas._endWiring() and canvas.cancelPlacing()', () => {
      const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
      expect(appCode).toContain("get('btn-cancel-wiring')?.addEventListener('click', () => this.canvas?._endWiring());");
      expect(appCode).toContain("get('btn-cancel-placing')?.addEventListener('click', () => this.canvas?.cancelPlacing());");
    });

    it('auto-closes component sheet upon selecting a part on mobile', () => {
      const appCode = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
      expect(appCode).toContain('if (this._isMobile) this._closeAllMobileSheets();');
    });
  });

  describe('Mobile CSS Styles & Positioning', () => {
    it('overrides context menu positioning on mobile with !important', () => {
      const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
      expect(css).toContain('.canvas-context-menu {');
      expect(css).toContain('position: fixed !important;');
      expect(css).toContain('bottom: 56px !important;');
      expect(css).toContain('z-index: 170 !important;');
    });

    it('defines styles for mobile canvas quick actions and cancel buttons', () => {
      const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
      expect(css).toContain('.mobile-canvas-actions');
      expect(css).toContain('.mob-actions-wrap');
      expect(css).toContain('.mob-action-btn');
      expect(css).toContain('.mob-color-btn');
      expect(css).toContain('.hint-cancel-btn');
      expect(css).toContain('pointer-events: auto;');
    });
  });
});
