/* -------------------------------------------------------
   canvas.js — Circuit Canvas (HTML5 Canvas, drag/drop, wiring, pan/zoom)
  ------------------------------------------------------- */

'use strict'; 

function _canvasSliderProgress(value, min, max, scale) {
  const n = Number(value);
  const bounded = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  if (scale === 'log' && min > 0 && max > min) {
    return (Math.log(bounded) - Math.log(min)) / (Math.log(max) - Math.log(min));
  }
  return (bounded - min) / (max - min || 1);
}

function _canvasSliderValue(progress, min, max, scale) {
  const n = Number(progress);
  const pct = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  if (pct === 0) return min;
  if (pct === 1) return max;
  if (scale === 'log' && min > 0 && max > min) {
    return Math.exp(Math.log(min) + pct * (Math.log(max) - Math.log(min)));
  }
  return min + pct * (max - min);
}

/* ---- Hoisted IC output-pin tables (used by _readDigitalInput / _readAnalogInput) ---- */
const IC_OUTPUT_MAP = {
  ic_555: { pins: ['OUT'], activeLow: [] },
  ic_74hc00: { pins: ['Y1', 'Y2', 'Y3', 'Y4'], activeLow: [] },
  ic_74hc04: { pins: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'], activeLow: [] },
  ic_74hc08: { pins: ['Y1', 'Y2', 'Y3', 'Y4'], activeLow: [] },
  ic_74hc32: { pins: ['Y1', 'Y2', 'Y3', 'Y4'], activeLow: [] },
  ic_74hc595: { pins: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'QHn'], activeLow: [] },
  ic_74hc138: { pins: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'], activeLow: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'] },
  ic_74hc245: { pins: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'], activeLow: [] },
  ic_74hc74: { pins: ['Q1', 'Q1n', 'Q2', 'Q2n'], activeLow: ['Q1n', 'Q2n'] },
  ic_74hc165: { pins: ['Q7', 'Q7n'], activeLow: ['Q7n'] },
  ic_74hc193: { pins: ['Q0', 'Q1', 'Q2', 'Q3', 'TCU', 'TCD'], activeLow: ['TCU', 'TCD'] },
  ic_74hc47: { pins: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], activeLow: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
  ic_74hc148: { pins: ['A0', 'A1', 'A2', 'GS', 'EO'], activeLow: ['A0', 'A1', 'A2', 'GS', 'EO'] },
  ic_74hc02: { pins: ['Y1', 'Y2', 'Y3', 'Y4'], activeLow: [] },
  ic_74hc86: { pins: ['Y1', 'Y2', 'Y3', 'Y4'], activeLow: [] },
  ic_74hc139: {
    pins: ['Y0_1', 'Y1_1', 'Y2_1', 'Y3_1', 'Y0_2', 'Y1_2', 'Y2_2', 'Y3_2'],
    activeLow: ['Y0_1', 'Y1_1', 'Y2_1', 'Y3_1', 'Y0_2', 'Y1_2', 'Y2_2', 'Y3_2'],
  },
  ic_74hc153: { pins: ['Y1', 'Y2'], activeLow: [] },
  ic_74hc164: { pins: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'], activeLow: [] },
  ic_74hc4017: {
    pins: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q59'],
    activeLow: [],
  },
  lm741: { pins: ['OUT'], activeLow: [] },
  lm358: { pins: ['1OUT', '2OUT'], activeLow: [] },
  lm393: { pins: ['1OUT', '2OUT'], activeLow: [] },
  lm324: { pins: ['1OUT', '2OUT', '3OUT', '4OUT'], activeLow: [] },
  cd4066: { pins: ['SIG1B', 'SIG2B', 'SIG3B', 'SIG4B'], activeLow: [] },
  ic_74hc14: { pins: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'], activeLow: [] },
  ic_74hc283: { pins: ['S1', 'S2', 'S3', 'S4', 'C4'], activeLow: [] },
  ic_74hc85: { pins: ['QA_GT_B', 'QA_EQ_B', 'QA_LT_B'], activeLow: [] },
  ic_74hc151: { pins: ['Y', 'W'], activeLow: ['W'] },
  ic_74hc76: { pins: ['1Q', '1Qn', '2Q', '2Qn'], activeLow: ['1Qn', '2Qn'] },
  ic_8255: {
    pins: ['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7',
           'PB0','PB1','PB2','PB3','PB4','PB5','PB6','PB7',
           'PC0','PC1','PC2','PC3','PC4','PC5','PC6','PC7'],
    activeLow: [],
  },
};
const IC_OUTPUT_PIN_LIST = {
  ic_555: ['OUT'],
  potentiometer: ['wiper'],
  ic_74hc00: ['Y1', 'Y2', 'Y3', 'Y4'],
  ic_74hc04: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
  ic_74hc08: ['Y1', 'Y2', 'Y3', 'Y4'],
  ic_74hc32: ['Y1', 'Y2', 'Y3', 'Y4'],
  ic_74hc595: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'QHn'],
  ic_74hc138: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
  ic_74hc245: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
  ic_74hc74: ['Q1', 'Q1n', 'Q2', 'Q2n'],
  ic_74hc165: ['Q7', 'Q7n'],
  ic_74hc193: ['Q0', 'Q1', 'Q2', 'Q3', 'TCU', 'TCD'],
  ic_74hc47: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ic_74hc148: ['A0', 'A1', 'A2', 'GS', 'EO'],
  ic_74hc02: ['Y1', 'Y2', 'Y3', 'Y4'],
  ic_74hc86: ['Y1', 'Y2', 'Y3', 'Y4'],
  ic_74hc139: ['Y0_1', 'Y1_1', 'Y2_1', 'Y3_1', 'Y0_2', 'Y1_2', 'Y2_2', 'Y3_2'],
  ic_74hc153: ['Y1', 'Y2'],
  ic_74hc164: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
  ic_74hc4017: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q59'],
  lm741: ['OUT'],
  lm358: ['1OUT', '2OUT'],
  lm393: ['1OUT', '2OUT'],
  lm324: ['1OUT', '2OUT', '3OUT', '4OUT'],
  cd4066: ['SIG1B', 'SIG2B', 'SIG3B', 'SIG4B'],
  ic_74hc14: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
  ic_74hc283: ['S1', 'S2', 'S3', 'S4', 'C4'],
  ic_74hc85: ['QA_GT_B', 'QA_EQ_B', 'QA_LT_B'],
  ic_74hc151: ['Y', 'W'],
  ic_74hc76: ['1Q', '1Qn', '2Q', '2Qn'],
  ic_8255: ['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7',
            'PB0','PB1','PB2','PB3','PB4','PB5','PB6','PB7',
            'PC0','PC1','PC2','PC3','PC4','PC5','PC6','PC7'],
};

/* Classify an IC's pins into logic-level tag groups for the properties panel.
   Returns { inputs, outputs } (digital pins only) or null when the type has no
   IC output table / nothing taggable. Inputs are only forceable when the IC has
   a class-based update() that honours props.forcedInputs. */
function classifyICTags(type, pins) {
  const spec = typeof IC_OUTPUT_MAP !== 'undefined' ? IC_OUTPUT_MAP[type] : null;
  if (!spec) return null;
  const ac = window.ArduinoComponents;
  const hasClass = !!(ac && typeof ac.getComponentClass === 'function' && ac.getComponentClass(type));
  const outSet = new Set(spec.pins);
  const inputs = [];
  const outputs = [];
  for (const p of (pins || [])) {
    if (p.type !== 'digital') continue;
    if (outSet.has(p.id)) outputs.push(p.id);
    else if (hasClass) inputs.push(p.id);
  }
  if (!inputs.length && !outputs.length) return null;
  return { inputs, outputs };
}
window.classifyICTags = classifyICTags;

class CircuitCanvas {
  constructor(canvasEl, wrapperEl) {
    this.canvas = canvasEl;
    this.wrapper = wrapperEl;
    this.ctx = canvasEl.getContext('2d');

    /* State */
    this.components = [];  // { id, type, x, y, props, runtimeState, selected, rotation }
    this.wires = [];  // { id, from:{instId,pinId}, to:{instId,pinId}, color, waypoints:[], routeStyle:'orthogonal'|'bezier', bezierCtrl:{c1:{x,y},c2:{x,y}} }
    this.annotations = [];
    this.selected = null;
    this.selectedPin = null; // { inst, pin } for canvas keyboard navigation
    this.selectedWire = null;
    this.selectedAnnotation = null;
    this.selectedComponentLabel = null;
    this.wireJumpArcs = true; // CAD-style bridge arcs for crossing orthogonal wires
    this.wireTooltipEl = null;
    this.quickControlsEl = null;
    this._hasStandalonePower = false;

    /* Electrical engine */
    this.engine = new ElectricalEngine();

    /* Viewport */
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.GRID = 5;

    /* Interaction state machine */
    this.mode = 'idle';   // idle | dragging | annotationDragging | componentLabelDragging | panning | wiring | placing | placingText | wiredrag
    this.dragging = null;     // { inst, offsetX, offsetY }
    this.draggingAnnotation = null;
    this.draggingComponentLabel = null;
    this._touchActive = false;
    this.wiringFrom = null;     // { inst, pin, wx, wy }
    this.wireMouse = null;     // { x, y } world coords
    this.placingType = null;
    this._wireOffsets = {};       // wireId -> {hx, hy} routing hint for wire reshape
    this.draggingWire = null;     // { wireId, segIdx } — which wire segment is being dragged
    this.placingMouse = null;

    /* History */
    this.history = [];
    this.historyIdx = -1;

    /* Resize */
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.wrapper);
    this._resize();

    /* Events */
    this._bindEvents();
    this._rafId = requestAnimationFrame(() => this._render());

    /* Callbacks */
    this.onWireChanged = null;
    this.onCompChanged = null;
    this.onPinClick = null;  // (inst, pin) when user clicks a pin
    this.onContextMenu = null;

    /* Pin tooltip */
    this.tooltipEl = null;
    this._tipKey = null;

    /* Mini-Map & Pin Cross-Probing (Phase 2) */
    this.minimapVisible = false;
    this.minimapCanvas = null;
    this.minimapContainer = null;
    this.minimapDragging = false;
    this._minimapTransform = null;
    this.highlightedPin = null;

    /* Animated Current / Signal Flow (Phase 3) */
    this.animatedCurrentFlow = false;

    this._initMinimap();
  }

  /* -------------- RESIZE -------------- */
  _resize() {
    const w = this.wrapper.clientWidth;
    const h = this.wrapper.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this._viewportWidth = w;
    this._viewportHeight = h;
    this._dpr = dpr;
    const pixelWidth = Math.round(w * dpr);
    const pixelHeight = Math.round(h * dpr);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.panX === 0 && this.panY === 0) {
      this.panX = w / 2 - 200;
      this.panY = h / 2 - 150;
    }
  }

  /* -------------- RENDER -------------- */
  _render() {
    const { ctx, canvas, zoom, panX, panY } = this;
    if (!ctx || typeof ctx.setTransform !== 'function') return;
    const dpr = this._dpr || 1;
    const width = this._viewportWidth || canvas.width;
    const height = this._viewportHeight || canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Refresh active simulation states for live glowing & component updates
    const sim = window.ArduinoSim;
    if (sim && sim.isRunning && sim.pinStates) {
      this.updateSimState(sim.pinStates);
    } else if (this._hasStandalonePower) {
      // Without a running sketch, update components that provide their own
      // voltage (bench power supply, MB102, power_5v, function generator, etc.)
      this.updateSimState({});
    }

    // Sample oscilloscope and logic analyzer from probe components — always,
    // so probe-based channels work during both running and stopped states.
    // Use simulation time (emulated ms) whenever available so probe samples,
    // pin-change samples and tick samples share one time axis; fall back to
    // the wall clock only before the first run.
    const app = window.App;
    if (app) {
      const sampleT = (sim && (sim.isRunning || sim.simTime > 0)) ? sim.simTime : performance.now();
      if (app.osc && !app.osc.paused) {
        app.osc.sample(sampleT, {});
      }
      if (app.la && !app.la.paused) {
        app.la.sample(sampleT, {});
      }
    }

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    this._drawGrid(ctx);
    this._drawLvlTags(ctx);
    this._drawWires(ctx);
    this._drawComponents(ctx);
    try { this._drawInteractives(ctx); } catch (_e) { /* guard interactive rendering */ }
    this._drawOverlays(ctx);
    this._drawPinHighlight(ctx);

    ctx.restore();
    this._renderMinimap();
    this._rafId = requestAnimationFrame(() => this._render());
  }

  _drawGrid(ctx) {
    const G = this.GRID;
    const invZ = 1 / this.zoom;
    const startX = Math.floor(-this.panX * invZ / G) * G;
    const startY = Math.floor(-this.panY * invZ / G) * G;
    const endX = startX + ((this._viewportWidth || this.canvas.width) * invZ) + G;
    const endY = startY + ((this._viewportHeight || this.canvas.height) * invZ) + G;

    if (this.zoom >= 0.5) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5 / this.zoom;

      for (let x = startX; x <= endX; x += G) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y += G) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }

    // Major grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1 / this.zoom;
    const MG = G * 5;
    const msX = Math.floor(-this.panX * invZ / MG) * MG;
    const msY = Math.floor(-this.panY * invZ / MG) * MG;
    for (let x = msX; x <= endX; x += MG) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = msY; y <= endY; y += MG) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Origin marker
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
  }

  _getSimForInst(inst) {
    const sim1 = window.ArduinoSim;
    const sim2 = window.App && window.App.sim2;
    if (!sim2) return sim1;
    const boards = this.getAllBoardInsts();
    if (boards.length < 2) return sim1;
    const boardTypes = ['arduino_uno', 'esp32_devkit_v1', 'arduino_nano', 'stm32f746_disco', 'lpc2148', 'pico2w', 'intel_8085', 'intel_8051', 'industrial_plc'];
    if (boardTypes.includes(inst.type)) {
      const idx = boards.indexOf(inst);
      return idx === 1 ? sim2 : sim1;
    }
    for (const wire of this.wires) {
      let otherInstId;
      if (wire.from.instId === inst.id) otherInstId = wire.to.instId;
      else if (wire.to.instId === inst.id) otherInstId = wire.from.instId;
      else continue;
      const other = this.components.find(c => c.id === otherInstId);
      if (!other || !boardTypes.includes(other.type)) continue;
      const idx = boards.indexOf(other);
      return idx === 1 ? sim2 : sim1;
    }
    return sim1;
  }

  _drawComponents(ctx) {
    const { COMPONENT_DEFS, getComponentClass } = window.ArduinoComponents;
    const sim1 = window.ArduinoSim;
    const sim2 = window.App && window.App.sim2;
    let simByComponentId = null;
    if (sim2) {
      const boards = this.getAllBoardInsts();
      if (boards.length >= 2) {
        simByComponentId = new Map();
        const boardIndexById = new Map();
        boards.forEach((board, index) => {
          boardIndexById.set(board.id, index);
          simByComponentId.set(board.id, index === 1 ? sim2 : sim1);
        });
        for (const wire of this.wires) {
          if (!wire.from || !wire.to) continue;
          const fromBoard = boardIndexById.get(wire.from.instId);
          const toBoard = boardIndexById.get(wire.to.instId);
          if (fromBoard !== undefined && toBoard === undefined && !simByComponentId.has(wire.to.instId)) {
            simByComponentId.set(wire.to.instId, fromBoard === 1 ? sim2 : sim1);
          }
          if (toBoard !== undefined && fromBoard === undefined && !simByComponentId.has(wire.from.instId)) {
            simByComponentId.set(wire.from.instId, toBoard === 1 ? sim2 : sim1);
          }
        }
      }
    }

    let wiredPins;
    if (this.zoom >= 0.5) {
      wiredPins = new Map();
      for (const wire of this.wires) {
        for (const endpoint of [wire.from, wire.to]) {
          if (!endpoint) continue;
          let pins = wiredPins.get(endpoint.instId);
          if (!pins) {
            pins = new Set();
            wiredPins.set(endpoint.instId, pins);
          }
          pins.add(endpoint.pinId);
        }
      }
    }

    for (const inst of this.components) {
      const def = COMPONENT_DEFS[inst.type];
      if (!def) continue;

      const instSim = simByComponentId
        ? (simByComponentId.get(inst.id) || sim1)
        : this._getSimForInst(inst);

      if (typeof def.step === 'function') {
        def.step(inst, instSim?.isRunning ? instSim : null);
      }

      ctx.save();
      if (inst.rotation) {
        const cx = inst.x + def.width / 2;
        const cy = inst.y + def.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(inst.rotation * Math.PI / 2);
        ctx.translate(-cx, -cy);
      }

      // Prefer class-based render() over def.draw()
      const CompClass = getComponentClass(inst.type);
      if (CompClass && typeof inst._componentInstance === 'object' && typeof inst._componentInstance.render === 'function') {
        inst._componentInstance.render(ctx, instSim?.isRunning ? instSim : null);
      } else {
        def.draw(ctx, { ...inst }, instSim?.isRunning ? instSim : null);
      }

      // Draw pins
      if (this.zoom >= 0.5) {
        this._drawPins(ctx, inst, def, instSim, wiredPins);
      }

      ctx.restore();
    }

    // Draw placing ghost
    if (this.mode === 'placing' && this.placingMouse && this.placingType) {
      const def = COMPONENT_DEFS[this.placingType];
      if (def) {
        const gx = this._snap(this.placingMouse.x - def.width / 2);
        const gy = this._snap(this.placingMouse.y - def.height / 2);
        ctx.save();
        ctx.globalAlpha = 0.5;
        def.draw(ctx, { id: '__ghost__', type: this.placingType, x: gx, y: gy, width: def.width, height: def.height, props: def.defaultProps || {}, selected: false }, null);
        ctx.restore();
      }
    }
  }

  _drawPins(ctx, inst, def, instSim, wiredPins) {
    const sim = instSim || this._getSimForInst(inst);

    for (const pin of def.pins) {
      const wx = inst.x + pin.x;
      const wy = inst.y + pin.y;

      // Check if wired
      const isWired = wiredPins
        ? Boolean(wiredPins.get(inst.id)?.has(pin.id))
        : this.wires.some(w =>
          (w.from.instId === inst.id && w.from.pinId === pin.id) ||
          (w.to.instId === inst.id && w.to.pinId === pin.id)
        );

      // Get pin state
      const pinKey = `pin_${this._pinToNumber(pin.id)}`;
      const val = (sim && sim.isRunning) ? (sim.pinStates[pinKey] || 0) : 0;

      // Pin color
      let pinColor;
      if (pin.type === 'gnd') pinColor = '#666';
      else if (pin.type === 'power') pinColor = '#cc3333';
      else if (pin.type === 'pwm') pinColor = val > 0 ? `rgba(188,140,255,${0.4 + val / 255 * 0.6})` : '#555';
      else if (pin.type === 'analog') pinColor = '#e8c840';
      else pinColor = val > 0 ? '#ff5555' : '#3388cc';

      // Wiring highlight
      const isWiringFrom = this.wiringFrom && this.wiringFrom.inst.id === inst.id && this.wiringFrom.pin.id === pin.id;
      const isWiringTarget = this.mode === 'wiring';

      // Draw pin
      ctx.beginPath();
      ctx.arc(wx, wy, isWired ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isWiringFrom ? '#00e5ff' : (isWired ? pinColor : '#3a3a3a');
      ctx.fill();
      ctx.strokeStyle = isWiringTarget ? 'rgba(0,229,255,0.5)' : (isWired ? pinColor : '#555');
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.stroke();

      // Selected Pin highlight (Canvas Keyboard Navigation)
      const isSelectedPin = this.selectedPin && this.selectedPin.inst.id === inst.id && this.selectedPin.pin.id === pin.id;
      if (isSelectedPin) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(wx, wy, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2 / this.zoom;
        ctx.stroke();

        // Pin badge bubble for keyboard navigation
        ctx.fillStyle = 'rgba(13, 18, 24, 0.92)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1 / this.zoom;
        const pinText = `${inst.props?.label || inst.id} : ${pin.label || pin.id} [${pin.type || 'pin'}]`;
        ctx.font = `bold ${Math.max(9, 10 / this.zoom)}px 'JetBrains Mono', Consolas, monospace`;
        const textW = ctx.measureText(pinText).width;
        const padX = 6 / this.zoom;
        const boxW = textW + padX * 2;
        const boxH = 18 / this.zoom;
        const boxX = wx - boxW / 2;
        const boxY = wy - 16 / this.zoom - boxH;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 4 / this.zoom);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.strokeRect(boxX, boxY, boxW, boxH);
        }
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pinText, wx, boxY + boxH / 2);
        ctx.restore();
      }

      // Hover ring
      if (isWiringTarget && !isWiringFrom) {
        ctx.beginPath();
        ctx.arc(wx, wy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,229,255,0.3)';
        ctx.lineWidth = 1 / this.zoom;
        ctx.stroke();
      }

      // Pin label (only when zoomed in enough) — boards have baked-in labels
      const isBoard = inst.type === 'arduino_uno' || inst.type === 'esp32_devkit_v1' || inst.type === 'arduino_nano' || inst.type === 'stm32f746_disco' || inst.type === 'lpc2148' || inst.type === 'pico2w' || inst.type === 'intel_8085' || inst.type === 'intel_8051' || inst.type === 'industrial_plc';
      if (this.zoom >= 1 && !isBoard && !def.hidePinLabels) {
        ctx.fillStyle = '#888';
        ctx.font = `${8 / this.zoom}px Inter, sans-serif`;
        ctx.textAlign = pin.side === 'top' ? 'center' : 'center';
        const lx = wx;
        const ly = pin.side === 'top' ? wy - 8 / this.zoom : wy + 12 / this.zoom;
        ctx.fillText(pin.label, lx, ly);
      }
    }
  }

  // â”€â”€â”€ Wire routing (Wokwi / Tinkercad style orthogonal traces) â”€â”€â”€
  // A wire exits each pin straight out from the component side, then runs
  // horizontally/vertically with right-angle bends, avoiding component bodies.

  // Rotate a pin's local (pin.x, pin.y) offset around the component centre
  // by inst.rotation Ã— 90° CW and return the world position.
  _pinWorldPos(inst, pin) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    const def = defs && defs[inst.type];
    const cx = (def ? def.width : 40) / 2;
    const cy = (def ? def.height : 40) / 2;
    let dx = pin.x - cx;
    let dy = pin.y - cy;
    const rot = (inst.rotation || 0) % 4;
    for (let i = 0; i < rot; i++) { const t = dx; dx = -dy; dy = t; }
    return { x: inst.x + cx + dx, y: inst.y + cy + dy };
  }

  _getPinExitDir(instId, pinId) {
    const inst = this.components.find(c => c.id === instId);
    if (!inst) return { x: 0, y: 1 };
    const def = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS[inst.type];
    if (!def) return { x: 0, y: 1 };
    const pin = def.pins.find(p => p.id === pinId);
    if (!pin) return { x: 0, y: 1 };
    let side = pin.side;
    if (!side) {
      const w = def.width || 40, h = def.height || 40;
      side = pin.y < h * 0.5 ? 'top' : (pin.y > h * 0.5 ? 'bottom' : (pin.x < w * 0.5 ? 'left' : 'right'));
    }
    const dirs = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    let d = dirs[side] || { x: 0, y: 1 };
    const rot = (inst.rotation || 0) % 4;
    for (let i = 0; i < rot; i++) d = { x: -d.y, y: d.x }; // rotate 90° clockwise
    return d;
  }

  _componentRects() {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    const rects = [];
    for (const c of this.components) {
      const def = defs && defs[c.type];
      if (!def) continue;
      rects.push({ x: c.x - 6, y: c.y - 6, w: (def.width || 40) + 12, h: (def.height || 40) + 12 });
    }
    return rects;
  }

  // Liang—Barsky: does segment (a←b) intersect axis-aligned rect r?
  _segHitsRect(ax, ay, bx, by, r) {
    const l = r.x, t = r.y, ri = r.x + r.w, b = r.y + r.h;
    if ((ax < l && bx < l) || (ax > ri && bx > ri) || (ay < t && by < t) || (ay > b && by > b)) return false;
    let tmin = 0, tmax = 1;
    const dx = bx - ax, dy = by - ay;
    const p = [-dx, dx, -dy, dy];
    const q = [ax - l, ri - ax, ay - t, b - ay];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const r0 = q[i] / p[i];
        if (p[i] < 0) { if (r0 > tmax) return false; if (r0 > tmin) tmin = r0; }
        else { if (r0 < tmin) return false; if (r0 < tmax) tmax = r0; }
      }
    }
    return tmin <= tmax;
  }

  _scorePath(pts) {
    const rects = this._componentRects();
    let penalty = 0, len = 0;
    // Score from index 1..len-1 — excludes the pin←stub end segments
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      len += Math.hypot(b.x - a.x, b.y - a.y);
      for (const r of rects) {
        if (this._segHitsRect(a.x, a.y, b.x, b.y, r)) penalty++;
      }
    }
    // Penalize wire-to-wire crossings using cached segments (no recursion)
    if (this._wireSegCache) {
      for (const wSegs of this._wireSegCache) {
        if (!wSegs || wSegs.length < 2) continue;
        for (let i = 1; i < pts.length - 1; i++) {
          for (let j = 0; j < wSegs.length - 1; j++) {
            if (this._segHitsSeg(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, wSegs[j].x, wSegs[j].y, wSegs[j + 1].x, wSegs[j + 1].y)) {
              penalty += 0.5;
            }
          }
        }
      }
    }
    return { penalty, bends: pts.length - 2, len };
  }

  _buildWireSegCache() {
    this._wireSegCache = [];
    for (const w of this.wires) {
      const p1 = this._getPinWorldPos(w.from.instId, w.from.pinId);
      const p2 = this._getPinWorldPos(w.to.instId, w.to.pinId);
      if (!p1 || !p2) continue;
      if (w.waypoints && w.waypoints.length > 0) {
        this._wireSegCache.push([p1, ...w.waypoints.map(wp => ({ x: wp.x, y: wp.y })), p2]);
      } else if (w.routeStyle === 'bezier' && w.bezierCtrl) {
        this._wireSegCache.push(this._sampleBezier(p1, w.bezierCtrl.c1, w.bezierCtrl.c2, p2, 16));
      } else {
        const d1 = this._getPinExitDir(w.from.instId, w.from.pinId);
        const d2 = this._getPinExitDir(w.to.instId, w.to.pinId);
        const STUB = 24;
        const s1 = { x: p1.x + d1.x * STUB, y: p1.y + d1.y * STUB };
        const s2 = d2 && (d2.x || d2.y) ? { x: p2.x + d2.x * STUB, y: p2.y + d2.y * STUB } : { x: p2.x, y: p2.y };
        this._wireSegCache.push([p1, s1, s2, p2]);
      }
    }
  }

  _segHitsSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const denom = (dx - cx) * (by - ay) - (bx - ax) * (dy - cy);
    if (Math.abs(denom) < 0.001) return false;
    const t = ((cx - ax) * (by - ay) - (bx - ax) * (cy - ay)) / denom;
    const u = ((cx - ax) * (dy - cy) - (dx - cx) * (cy - ay)) / denom;
    return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
  }

  _laneCandidates(a, b, hint) {
    const push = (arr, v) => { if (arr.every(e => Math.abs(e - v) > 1)) arr.push(v); };
    const xLanes = [], yLanes = [];
    push(xLanes, (a.x + b.x) / 2); push(xLanes, a.x - 30); push(xLanes, a.x + 30);
    push(xLanes, b.x - 30); push(xLanes, b.x + 30);
    push(xLanes, a.x - 60); push(xLanes, a.x + 60);
    push(xLanes, b.x - 60); push(xLanes, b.x + 60);
    push(yLanes, (a.y + b.y) / 2); push(yLanes, a.y - 30); push(yLanes, a.y + 30);
    push(yLanes, b.y - 30); push(yLanes, b.y + 30);
    push(yLanes, a.y - 60); push(yLanes, a.y + 60);
    push(yLanes, b.y - 60); push(yLanes, b.y + 60);
    if (hint) { push(xLanes, hint.x); push(yLanes, hint.y); }
    return { xLanes, yLanes };
  }

  // Build an orthogonal polyline from pin1 (p1, exiting along d1) to pin2 (p2, exiting d2).
  _routePath(p1, d1, p2, d2, hint) {
    this._buildWireSegCache();
    const STUB = 24;
    const s1 = { x: p1.x + d1.x * STUB, y: p1.y + d1.y * STUB };
    const s2 = d2 && (d2.x || d2.y) ? { x: p2.x + d2.x * STUB, y: p2.y + d2.y * STUB } : { x: p2.x, y: p2.y };
    const a = s1, b = s2;

    const candidates = [];
    const mk = (...pts) => candidates.push([a, ...pts, b]);

    if (hint) {
      // Dragging: force the route through the cursor (orthogonal bends around it)
      mk({ x: hint.x, y: a.y }, { x: hint.x, y: b.y });
      mk({ x: a.x, y: hint.y }, { x: b.x, y: hint.y });
      mk({ x: hint.x, y: a.y }, { x: hint.x, y: hint.y }, { x: b.x, y: hint.y });
      mk({ x: a.x, y: hint.y }, { x: hint.x, y: hint.y }, { x: hint.x, y: b.y });
    } else {
      // Two L shapes
      mk({ x: b.x, y: a.y });          // horizontal then vertical
      mk({ x: a.x, y: b.y });          // vertical then horizontal

      // Z shapes through lanes
      const { xLanes, yLanes } = this._laneCandidates(a, b, hint);
      for (const lane of xLanes) mk({ x: lane, y: a.y }, { x: lane, y: b.y });
      for (const lane of yLanes) mk({ x: a.x, y: lane }, { x: b.x, y: lane });
    }

    // Pick the best candidate: least body crossings, then fewest bends, then shortest
    let best = null, bestScore = null;
    for (const cand of candidates) {
      const sc = this._scorePath(cand);
      if (!bestScore ||
        sc.penalty < bestScore.penalty ||
        (sc.penalty === bestScore.penalty && sc.bends < bestScore.bends) ||
        (sc.penalty === bestScore.penalty && sc.bends === bestScore.bends && sc.len < bestScore.len)) {
        best = cand;
        bestScore = sc;
      }
    }
    return [p1, ...(best || [a, b]), p2];
  }

  _wirePath(wire) {
    const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
    const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
    if (!p1 || !p2) return null;

    if (wire.routeStyle === 'bezier') {
      const d1 = this._getPinExitDir(wire.from.instId, wire.from.pinId);
      const d2 = this._getPinExitDir(wire.to.instId, wire.to.pinId);
      const ctrl = wire.bezierCtrl || this._autoBezierCtrl(p1, d1, p2, d2);
      return { type: 'bezier', p1, c1: ctrl.c1, c2: ctrl.c2, p2 };
    }

    if (wire.waypoints && Array.isArray(wire.waypoints) && wire.waypoints.length > 0) {
      return { type: 'orthogonal', pts: [p1, ...wire.waypoints.map(wp => ({ x: wp.x, y: wp.y })), p2] };
    }
    const d1 = this._getPinExitDir(wire.from.instId, wire.from.pinId);
    const d2 = this._getPinExitDir(wire.to.instId, wire.to.pinId);
    const off = this._wireOffsets && this._wireOffsets[wire.id];
    const hint = off && Number.isFinite(off.hx) ? { x: off.hx, y: off.hy } : null;
    return { type: 'orthogonal', pts: this._routePath(p1, d1, p2, d2, hint) };
  }

  _autoBezierCtrl(p1, d1, p2, d2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const scale = Math.max(40, dist * 0.4);
    return {
      c1: { x: p1.x + d1.x * scale, y: p1.y + d1.y * scale },
      c2: { x: p2.x + d2.x * scale, y: p2.y + d2.y * scale }
    };
  }

  _sampleBezier(p1, c1, c2, p2, steps) {
    steps = steps || 20;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push({
        x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
        y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y
      });
    }
    return pts;
  }

  _distToBezier(px, py, p1, c1, c2, p2) {
    const samples = this._sampleBezier(p1, c1, c2, p2, 24);
    let minDist = Infinity;
    for (let i = 0; i < samples.length - 1; i++) {
      const d = this._distToSegment(px, py, samples[i].x, samples[i].y, samples[i + 1].x, samples[i + 1].y);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  _drawWires(ctx) {
    const sim = window.ArduinoSim;

    for (const wire of this.wires) {
      const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
      const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
      if (!p1 || !p2) continue;

      const isSelected = this.selectedWire && this.selectedWire.id === wire.id;

      // Determine color: custom color takes priority, then dynamic sim state
      let color;
      if (wire.color) {
        color = wire.color;
      } else {
        const pinKey = this._getPinKey(wire.from.instId, wire.from.pinId);
        const val = sim?.isRunning ? (sim.pinStates[pinKey] || 0) : 0;
        const pinType = this._getPinType(wire.from.instId, wire.from.pinId);
        if (pinType === 'gnd') color = '#444';
        else if (pinType === 'power') color = '#994444';
        else if (val > 1 && val <= 255) color = `rgba(247,201,72,${0.6 + val / 255 * 0.4})`;
        else color = val > 0 ? '#cc3333' : '#2266aa';
      }

      const pathData = this._wirePath(wire);
      if (pathData) this._drawWire(ctx, pathData, color, isSelected, wire);
    }

    // Active wire preview (always orthogonal during wiring)
    if (this.mode === 'wiring' && this.wiringFrom && this.wireMouse) {
      const p1 = { x: this.wiringFrom.wx, y: this.wiringFrom.wy };
      const d1 = this._getPinExitDir(this.wiringFrom.instId, this.wiringFrom.pinId);
      const pts = this._routePath(p1, d1, this.wireMouse, null, this.wireMouse);
      this._drawWire(ctx, { type: 'orthogonal', pts }, '#00e5ff', true, null);
    }
  }

  _drawWire(ctx, pathData, color, highlighted, wire) {
    if (!pathData) return;
    ctx.save();

    if (pathData.type === 'bezier') {
      this._drawBezierWire(ctx, pathData, color, highlighted, wire);
    } else {
      this._drawOrthogonalWire(ctx, pathData.pts, color, highlighted, wire);
    }

    ctx.restore();
  }

  _buildOrthogonalPath(ctx, pts, wire) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (!this.wireJumpArcs || !wire || pts.length < 2) {
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      return;
    }

    const arcRadius = 5;
    const minMargin = 8;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];

      // Only horizontal segments jump over vertical segments
      const isHorizontal = Math.abs(p1.y - p2.y) < 0.5 && Math.abs(p1.x - p2.x) >= 16;
      if (!isHorizontal) {
        ctx.lineTo(p2.x, p2.y);
        continue;
      }

      const y = p1.y;
      const xMin = Math.min(p1.x, p2.x);
      const xMax = Math.max(p1.x, p2.x);
      const movingRight = p2.x > p1.x;

      // Find all vertical crossings with other wires
      const crossings = [];
      for (const otherWire of this.wires) {
        if (!otherWire || otherWire.id === wire.id) continue;
        // Don't jump over wires sharing a terminal pin (common net junction)
        if (otherWire.from?.instId === wire.from?.instId && otherWire.from?.pinId === wire.from?.pinId) continue;
        if (otherWire.from?.instId === wire.to?.instId && otherWire.from?.pinId === wire.to?.pinId) continue;
        if (otherWire.to?.instId === wire.from?.instId && otherWire.to?.pinId === wire.from?.pinId) continue;
        if (otherWire.to?.instId === wire.to?.instId && otherWire.to?.pinId === wire.to?.pinId) continue;

        const otherPath = this._wirePath(otherWire);
        if (!otherPath || otherPath.type !== 'orthogonal' || !otherPath.pts) continue;
        const opts = otherPath.pts;

        for (let j = 0; j < opts.length - 1; j++) {
          const o1 = opts[j];
          const o2 = opts[j + 1];
          // Check if other segment is vertical
          if (Math.abs(o1.x - o2.x) < 0.5) {
            const vx = o1.x;
            const vyMin = Math.min(o1.y, o2.y);
            const vyMax = Math.max(o1.y, o2.y);

            if (vx >= xMin + minMargin && vx <= xMax - minMargin &&
                y >= vyMin + minMargin && y <= vyMax - minMargin) {
              crossings.push(vx);
            }
          }
        }
      }

      if (crossings.length === 0) {
        ctx.lineTo(p2.x, p2.y);
        continue;
      }

      // Sort crossings in travel direction
      if (movingRight) {
        crossings.sort((a, b) => a - b);
      } else {
        crossings.sort((a, b) => b - a);
      }

      // Deduplicate crossings that are too close
      const filtered = [];
      for (const cx of crossings) {
        if (filtered.length === 0 || Math.abs(cx - filtered[filtered.length - 1]) >= arcRadius * 2.2) {
          filtered.push(cx);
        }
      }

      for (const cx of filtered) {
        if (movingRight) {
          ctx.lineTo(cx - arcRadius, y);
          ctx.arc(cx, y, arcRadius, Math.PI, 0, false);
        } else {
          ctx.lineTo(cx + arcRadius, y);
          ctx.arc(cx, y, arcRadius, 0, Math.PI, true);
        }
      }

      ctx.lineTo(p2.x, p2.y);
    }
  }

  _drawOrthogonalWire(ctx, pts, color, highlighted, wire) {
    if (!pts || pts.length < 2) return;

    // Selection glow behind wire
    if (highlighted) {
      ctx.strokeStyle = 'rgba(0,229,255,0.25)';
      ctx.lineWidth = 8 / this.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this._buildOrthogonalPath(ctx, pts, wire);
      ctx.stroke();
    }

    // Main wire stroke
    ctx.strokeStyle = highlighted ? '#00e5ff' : color;
    ctx.lineWidth = highlighted ? 3 / this.zoom : 2 / this.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (highlighted) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 6;
    }

    this._buildOrthogonalPath(ctx, pts, wire);
    ctx.stroke();

    // Animated marching current / signal flow (Phase 3)
    if (this._isWireConducting(wire)) {
      ctx.save();
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const speed = 0.035;
      const dash = 5 / this.zoom;
      const gap = 7 / this.zoom;
      const period = dash + gap;
      const offset = -((now * speed) % period);

      ctx.strokeStyle = '#fff59d';
      ctx.lineWidth = Math.max(1.5, 2.0 / this.zoom);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#ffee58';
      ctx.shadowBlur = 4 / this.zoom;
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([dash, gap]);
        ctx.lineDashOffset = offset;
      }
      this._buildOrthogonalPath(ctx, pts, wire);
      ctx.stroke();
      ctx.restore();
    }

    // Junction dots at the pins
    ctx.shadowBlur = 0;
    ctx.fillStyle = highlighted ? '#00e5ff' : color;
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 3 / this.zoom, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 3 / this.zoom, 0, Math.PI * 2); ctx.fill();

    // Draw bend-point handles on selected wire
    if (highlighted && wire && Array.isArray(wire.waypoints) && wire.waypoints.length > 0) {
      ctx.fillStyle = '#00e5ff';
      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 1.5 / this.zoom;
      for (const wp of wire.waypoints) {
        const sz = 4 / this.zoom;
        ctx.fillRect(wp.x - sz, wp.y - sz, sz * 2, sz * 2);
        ctx.strokeRect(wp.x - sz, wp.y - sz, sz * 2, sz * 2);
      }
    }
  }

  _drawBezierWire(ctx, data, color, highlighted, wire) {
    const { p1, c1, c2, p2 } = data;

    // Selection glow behind wire
    if (highlighted) {
      ctx.strokeStyle = 'rgba(0,229,255,0.25)';
      ctx.lineWidth = 8 / this.zoom;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
      ctx.stroke();
    }

    // Main wire stroke
    ctx.strokeStyle = highlighted ? '#00e5ff' : color;
    ctx.lineWidth = highlighted ? 3 / this.zoom : 2 / this.zoom;
    ctx.lineCap = 'round';
    if (highlighted) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
    ctx.stroke();

    // Animated marching current / signal flow (Phase 3)
    if (this._isWireConducting(wire)) {
      ctx.save();
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const speed = 0.035;
      const dash = 5 / this.zoom;
      const gap = 7 / this.zoom;
      const period = dash + gap;
      const offset = -((now * speed) % period);

      ctx.strokeStyle = '#fff59d';
      ctx.lineWidth = Math.max(1.5, 2.0 / this.zoom);
      ctx.lineCap = 'round';
      ctx.shadowColor = '#ffee58';
      ctx.shadowBlur = 4 / this.zoom;
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([dash, gap]);
        ctx.lineDashOffset = offset;
      }
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }

    // Junction dots at the pins
    ctx.shadowBlur = 0;
    ctx.fillStyle = highlighted ? '#00e5ff' : color;
    ctx.beginPath(); ctx.arc(p1.x, p1.y, 3 / this.zoom, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p2.x, p2.y, 3 / this.zoom, 0, Math.PI * 2); ctx.fill();

    // Draw control point handles on selected bezier wire
    if (highlighted && wire) {
      const sz = 4 / this.zoom;

      // Control arm lines
      ctx.strokeStyle = 'rgba(0,229,255,0.4)';
      ctx.lineWidth = 1 / this.zoom;
      ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(c1.x, c1.y);
      ctx.moveTo(p2.x, p2.y); ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Control point handles
      ctx.fillStyle = '#00e5ff';
      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.beginPath(); ctx.arc(c1.x, c1.y, sz, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(c2.x, c2.y, sz, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // â”€â”€â”€ Interactive on-canvas controls (sliders for sensors / potentiometer) â”€â”€â”€
  _drawInteractives(ctx) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs || this.zoom < 0.4) return;
    for (const inst of this.components) {
      const def = defs[inst.type];
      if (!def || !Array.isArray(def.interactive) || def.interactive.length === 0) continue;
      const rects = this._getInteractiveRects(inst);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        // Skip inline toggles — they're drawn by the component's own draw()
        if (r.ctrl.type === 'toggle' && r.ctrl.inline) continue;
        this._drawSlider(ctx, inst, r.ctrl, r);
      }
    }
  }

  _getInteractiveRects(inst) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    const def = defs && defs[inst.type];
    if (!def || !Array.isArray(def.interactive)) return [];
    const w = Math.max(60, def.width || 60);
    const h = def.height || 40;
    const allCtrls = def.interactive.filter(c => (!c.type || c.type === 'range' || c.type === 'toggle') && c.type !== 'select' && c.type !== 'checkbox');
    const result = [];
    let yOff = 16;

    for (const ctrl of allCtrls) {
      if (ctrl.type === 'toggle' && ctrl.inline) {
        result.push({
          x: inst.x + ctrl.inline.x,
          y: inst.y + ctrl.inline.y,
          width: ctrl.inline.w,
          height: ctrl.inline.h,
          ctrl,
        });
      } else {
        const rh = 12;
        result.push({
          x: inst.x,
          y: inst.y + h + yOff,
          width: w,
          height: rh,
          ctrl,
        });
        yOff += rh + 5;
      }
    }
    return result;
  }

  _getInteractiveValue(inst, ctrl) {
    const rs = inst.runtimeState || {};
    if (rs[ctrl.field] !== undefined) return rs[ctrl.field];
    const props = inst.props || {};
    if (props[ctrl.field] !== undefined) return props[ctrl.field];
    return ctrl.min;
  }

  _formatSliderValue(value, ctrl, inst) {
    const v = Number(value);
    if (inst && inst.type === 'potentiometer') {
      if (ctrl.field === 'value') {
        const rawRes = Number(inst.props?.resistance ?? inst.props?.value_res ?? 10000);
        const unitMult = inst.props?.unit === 'MΩ' ? 1e6 : (inst.props?.unit === 'kΩ' ? 1e3 : 1);
        const rTotal = Math.max(1, rawRes * (inst.props?.unit ? unitMult : (rawRes < 100 ? 1e3 : 1)));
        const maxVal = Math.max(1, Number(inst.props?.maxValue) || 1023);
        const ratio = Math.max(0, Math.min(1, v / maxVal));
        const rW2 = ratio * rTotal;
        const fmtR = rW2 >= 1e6 ? (rW2 / 1e6).toFixed(1) + 'MΩ' : (rW2 >= 1e3 ? (rW2 / 1e3).toFixed(1) + 'kΩ' : Math.round(rW2) + 'Ω');
        return `${Math.round(ratio * 100)}% (${fmtR})`;
      }
      if (ctrl.field === 'resistance') {
        const unit = inst.props?.unit || 'kΩ';
        return `${v} ${unit}`;
      }
    }
    if (ctrl.field === 'timebase' && Number.isFinite(v)) return String(Number(v.toPrecision(3)));
    if (Number.isInteger(ctrl.step)) return String(Math.round(v));
    return String(Math.round(v * 10) / 10);
  }

  _drawSlider(ctx, inst, ctrl, rect) {
    if (ctrl.type === 'toggle') return this._drawToggle(ctx, inst, ctrl, rect);
    // Default: range slider
    const value = this._getInteractiveValue(inst, ctrl);
    const pct = _canvasSliderProgress(value, ctrl.min, ctrl.max, ctrl.scale);
    const active = !!(window.ArduinoSim && window.ArduinoSim.isRunning);
    const invZ = 1 / this.zoom;

    ctx.save();

    // Label
    ctx.fillStyle = active ? 'rgba(220,240,255,0.95)' : 'rgba(160,165,175,0.8)';
    ctx.font = `bold ${7.5 * invZ}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(ctrl.label, rect.x, rect.y - 2 * invZ);

    // Value badge
    ctx.textAlign = 'right';
    ctx.fillStyle = active ? '#00e5ff' : '#78909c';
    ctx.fillText(this._formatSliderValue(value, ctrl, inst) + (ctrl.unit || ''), rect.x + rect.width, rect.y - 2 * invZ);

    // Track background
    ctx.fillStyle = '#0d1114';
    ctx.strokeStyle = active ? 'rgba(0,151,156,0.5)' : 'rgba(100,100,110,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, rect.height / 2);
    ctx.fill();
    ctx.stroke();

    // Fill bar
    if (pct > 0.01) {
      const grad = ctx.createLinearGradient(rect.x, 0, rect.x + pct * rect.width, 0);
      grad.addColorStop(0, active ? 'rgba(0,151,156,0.3)' : 'rgba(100,100,120,0.3)');
      grad.addColorStop(1, active ? 'rgba(0,151,156,0.85)' : 'rgba(100,100,120,0.6)');
      ctx.fillStyle = grad;
      roundRect(ctx, rect.x, rect.y, Math.max(rect.height, pct * rect.width), rect.height, rect.height / 2);
      ctx.fill();
    }

    // Thumb
    const tx = rect.x + pct * rect.width;
    const thumbY = rect.y + rect.height / 2;
    if (isFinite(tx) && isFinite(thumbY)) {
      const thumbGrad = ctx.createRadialGradient(tx - 1, thumbY - 1, 1, tx, thumbY, 5);
      thumbGrad.addColorStop(0, active ? '#b2ebf2' : '#cfd8dc');
      thumbGrad.addColorStop(1, active ? '#00bcd4' : '#78909c');
      ctx.fillStyle = thumbGrad;
      ctx.beginPath();
      ctx.arc(tx, thumbY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawToggle(ctx, inst, ctrl, rect) {
    const value = this._getInteractiveValue(inst, ctrl);
    const isOn = Number(value) > 0;
    const active = !!(window.ArduinoSim && window.ArduinoSim.isRunning);
    const invZ = 1 / this.zoom;
    const cx = rect.x + 22;
    const cy = rect.y + rect.height / 2;
    const trackW = 36;
    const trackH = 10;

    ctx.save();

    // Label
    ctx.fillStyle = active ? 'rgba(220,240,255,0.95)' : 'rgba(160,165,175,0.8)';
    ctx.font = `bold ${7.5 * invZ}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(ctrl.label, rect.x, rect.y - 1 * invZ);

    // Status badge
    ctx.textAlign = 'right';
    ctx.fillStyle = isOn ? (active ? '#00e676' : '#4caf50') : (active ? '#ff5252' : '#b71c1c');
    ctx.font = `bold ${7 * invZ}px "JetBrains Mono", monospace`;
    ctx.fillText(isOn ? 'ON' : 'OFF', rect.x + rect.width, rect.y - 1 * invZ);

    // Track groove
    ctx.fillStyle = '#0d1114';
    ctx.strokeStyle = 'rgba(80,90,100,0.5)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx - trackW / 2, cy - trackH / 2, trackW, trackH, trackH / 2);
    ctx.fill();
    ctx.stroke();

    // Fill arc when ON
    if (isOn) {
      const grad = ctx.createLinearGradient(cx - trackW / 2, 0, cx + trackW / 2, 0);
      grad.addColorStop(0, 'rgba(0,230,118,0.25)');
      grad.addColorStop(1, 'rgba(0,230,118,0.7)');
      ctx.fillStyle = grad;
      roundRect(ctx, cx - trackW / 2, cy - trackH / 2, trackW, trackH, trackH / 2);
      ctx.fill();
    }

    // Thumb
    const thumbX = isOn ? cx + trackW / 2 - 6 : cx - trackW / 2 + 6;
    if (isFinite(thumbX) && isFinite(cy)) {
      const thumbGrad = ctx.createRadialGradient(thumbX - 1, cy - 1, 1, thumbX, cy, 6);
      thumbGrad.addColorStop(0, isOn ? '#b9f6ca' : '#cfd8dc');
      thumbGrad.addColorStop(1, isOn ? '#00c853' : '#78909c');
      ctx.fillStyle = thumbGrad;
      ctx.beginPath();
      ctx.arc(thumbX, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  _hitTestSlider(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    for (const inst of this.components) {
      const def = defs[inst.type];
      if (!def || !Array.isArray(def.interactive) || def.interactive.length === 0) continue;
      const rects = this._getInteractiveRects(inst);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        // Skip inline toggles — they are handled by _hitTestInlineToggle
        if (r.ctrl.type === 'toggle' && r.ctrl.inline) continue;
        if (wx >= r.x - 6 && wx <= r.x + r.width + 6 && wy >= r.y - 8 && wy <= r.y + r.height + 8) {
          return { inst, ctrl: r.ctrl, rect: r };
        }
      }
    }
    return null;
  }

  _hitTestInlineToggle(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    for (const inst of this.components) {
      const def = defs[inst.type];
      if (!def || !Array.isArray(def.interactive)) continue;
      for (const ctrl of def.interactive) {
        if (ctrl.type !== 'toggle' || !ctrl.inline) continue;
        const rx = inst.x + ctrl.inline.x;
        const ry = inst.y + ctrl.inline.y;
        const rw = ctrl.inline.w;
        const rh = ctrl.inline.h;
        if (wx >= rx && wx <= rx + rw && wy >= ry && wy <= ry + rh) {
          return { inst, ctrl };
        }
      }
    }
    return null;
  }

  _hitTestMb102Jumper(wx, wy) {
    for (const inst of this.components) {
      if (inst.type !== 'mb102_power') continue;
      const lx = wx - inst.x;
      const ly = wy - inst.y;

      // Top Jumper: x in [93, 117], y in [13, 29]
      if (lx >= 93 && lx <= 117 && ly >= 13 && ly <= 29) {
        let targetVoltage = null;
        if (lx <= 101) targetVoltage = '5V';
        else if (lx >= 109) targetVoltage = '3.3V';
        return { inst, rail: 'top', targetVoltage };
      }

      // Bottom Jumper: x in [93, 117], y in [66, 82]
      if (lx >= 93 && lx <= 117 && ly >= 66 && ly <= 82) {
        let targetVoltage = null;
        if (lx <= 101) targetVoltage = '5V';
        else if (lx >= 109) targetVoltage = '3.3V';
        return { inst, rail: 'bottom', targetVoltage };
      }
    }
    return null;
  }

  _hitTestDsoButton(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    for (const inst of this.components) {
      if (inst.type !== 'dso_4ch') continue;
      const btnRects = inst._btnRects;
      if (!btnRects) continue;
      const lx = wx - inst.x;
      const ly = wy - inst.y;
      for (const [key, rect] of Object.entries(btnRects)) {
        if (lx >= rect.x && lx <= rect.x + rect.w && ly >= rect.y && ly <= rect.y + rect.h) {
          return { inst, key, rect };
        }
      }
    }
    return null;
  }

  _handleDsoButtonClick(inst, key) {
    const rs = inst.runtimeState || {};
    const props = inst.props || {};

    const cycleOptions = (field, options) => {
      const cur = rs[field] !== undefined ? rs[field] : (props[field] ?? options[0]);
      const idx = options.indexOf(cur);
      const next = options[(idx + 1) % options.length];
      rs[field] = next;
      props[field] = next;
    };

    switch (key) {
      case 'ch1':
      case 'ch2':
      case 'ch3':
      case 'ch4': {
        const field = key + '_en';
        const defVal = (key === 'ch1' || key === 'ch2');
        const cur = rs[field] !== undefined ? rs[field] : (props[field] ?? defVal);
        rs[field] = !cur;
        props[field] = !cur;
        break;
      }
      case 'runStop': {
        const cur = rs.runStop !== undefined ? rs.runStop : (props.runStop ?? 1);
        rs.runStop = cur ? 0 : 1;
        props.runStop = rs.runStop;
        break;
      }
      case 'pause': {
        const cur = rs.paused !== undefined ? rs.paused : (props.paused ?? 0);
        rs.paused = cur ? 0 : 1;
        props.paused = rs.paused;
        break;
      }
      case 'single': {
        const cur = rs.singleTrigger !== undefined ? rs.singleTrigger : (props.singleTrigger ?? 0);
        rs.singleTrigger = cur ? 0 : 1;
        props.singleTrigger = rs.singleTrigger;
        break;
      }
      case 'autoSet': {
        rs.autoSet = 1;
        props.autoSet = 1;
        break;
      }
      case 'fullscreen': {
        if (window.App) window.App.openDSOFullscreen(inst);
        break;
      }
      case 'trigSrc': {
        cycleOptions('trig_source', ['ch1', 'ch2', 'ch3', 'ch4']);
        break;
      }
      case 'trigSlope': {
        cycleOptions('trig_slope', ['rising', 'falling']);
        break;
      }
      case 'dsoMode': {
        cycleOptions('dsoMode', ['scope', 'spectrum', 'xy']);
        break;
      }
      case 'mathOp': {
        cycleOptions('math_op', ['off', 'add', 'sub', 'abs', 'mul']);
        break;
      }
      case 'ch1Coupling': {
        cycleOptions('ch1_coupling', ['dc', 'ac', 'gnd']);
        break;
      }
      case 'ch2Coupling': {
        cycleOptions('ch2_coupling', ['dc', 'ac', 'gnd']);
        break;
      }
      case 'pause': {
        rs.paused = !rs.paused;
        break;
      }
    }
  }

  _hitTestFuncGenButton(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    for (const inst of this.components) {
      if (inst.type !== 'func_gen') continue;
      const btnRects = inst._btnRects;
      if (!btnRects) continue;
      const lx = wx - inst.x;
      const ly = wy - inst.y;
      for (const [key, rect] of Object.entries(btnRects)) {
        if (lx >= rect.x && lx <= rect.x + rect.w && ly >= rect.y && ly <= rect.y + rect.h) {
          return { inst, key, rect };
        }
      }
    }
    return null;
  }

  _handleFuncGenButtonClick(inst, key) {
    const rs = inst.runtimeState || {};
    const props = inst.props || {};
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;

    const cycleOptions = (field, options) => {
      const cur = rs[field] !== undefined ? rs[field] : (props[field] ?? options[0]);
      const idx = options.indexOf(cur);
      const next = options[(idx + 1) % options.length];
      rs[field] = next;
      props[field] = next;
    };

    const waveOpts = (defs && defs.func_gen && defs.func_gen._waveIds) ||
      ['sine', 'square', 'triangle', 'sawtooth', 'ramp_down', 'pulse', 'exp_rise', 'ecg', 'staircase', 'noise', 'dc', 'pattern'];

    const freqSteps = [1, 10, 100, 1000, 10000, 100000, 1000000];
    const shiftFreq = (field, dir) => {
      const rawCur = rs[field] !== undefined ? rs[field] : (props[field] ?? 440);
      const cur = Number.isFinite(Number(rawCur)) ? Number(rawCur) : 440;
      let step = 1;
      for (const s of freqSteps) { if (cur >= s) step = s; }
      // Clamp through the component's own declared limits rather than a
      // hard-coded floor: the old Math.max(1, …) made "freq down" *raise* the
      // frequency whenever a project ran below 1 Hz (the bundled examples run
      // at 0.5 Hz), and nothing stopped the buttons reaching 1e999.
      const AC = window.ArduinoComponents || {};
      const def = AC.COMPONENT_DEFS && AC.COMPONENT_DEFS.func_gen;
      const bounded = typeof AC.clampPropValue === 'function'
        ? AC.clampPropValue(def, field, cur + dir * step)
        : cur + dir * step;
      const newVal = Number.isFinite(bounded) ? bounded : 0;
      rs[field] = newVal;
      props[field] = newVal;
    };

    switch (key) {
      case 'ch1Out': {
        const cur = rs.ch1_en !== undefined ? rs.ch1_en : (props.ch1_en ?? 1);
        const next = (cur === 0 || cur === '0' || cur === false) ? 1 : 0;
        rs.ch1_en = next;
        props.ch1_en = next;
        break;
      }
      case 'ch2Out': {
        const cur = rs.ch2_en !== undefined ? rs.ch2_en : (props.ch2_en ?? 1);
        const next = (cur === 0 || cur === '0' || cur === false) ? 1 : 0;
        rs.ch2_en = next;
        props.ch2_en = next;
        break;
      }
      case 'chSync': {
        const syncOpts = ['off', 'freq_track', 'phase_sync'];
        cycleOptions('ch_sync', syncOpts);
        break;
      }
      case 'ch1Mod': {
        const modOpts = ['none', 'am', 'fm', 'sweep'];
        cycleOptions('ch1_mod', modOpts);
        break;
      }
      case 'ch2Mod': {
        const modOpts = ['none', 'am', 'fm', 'sweep'];
        cycleOptions('ch2_mod', modOpts);
        break;
      }
      case 'ch1Wave': {
        cycleOptions('ch1_wave', waveOpts);
        break;
      }
      case 'ch2Wave': {
        cycleOptions('ch2_wave', waveOpts);
        break;
      }
      case 'ch1FreqUp': {
        shiftFreq('ch1_freq', 1);
        break;
      }
      case 'ch1FreqDown': {
        shiftFreq('ch1_freq', -1);
        break;
      }
      case 'ch2FreqUp': {
        shiftFreq('ch2_freq', 1);
        break;
      }
      case 'ch2FreqDown': {
        shiftFreq('ch2_freq', -1);
        break;
      }
    }
  }

  _hitTestDipSwitch(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    for (const inst of this.components) {
      if (inst.type !== 'dip_switch') continue;
      const def = defs[inst.type];
      if (!def) continue;
      const lx = wx - inst.x;
      const ly = wy - inst.y;
      for (let i = 0; i < 8; i++) {
        const sx = 12 + i * 16;
        if (lx >= sx - 8 && lx <= sx + 12 && ly >= 6 && ly <= 42) {
          return { inst, bit: i };
        }
      }
    }
    return null;
  }

  _hitTestKeypadButton(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    const keyMap = [
      ['1', '2', '3', 'A'],
      ['4', '5', '6', 'B'],
      ['7', '8', '9', 'C'],
      ['*', '0', '#', 'D']
    ];
    const btnW = 24, btnH = 20, startX = 14, startY = 14, gapX = 6, gapY = 6;
    for (const inst of this.components) {
      if (inst.type !== 'keypad_4x4') continue;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const kx = inst.x + startX + col * (btnW + gapX);
          const ky = inst.y + startY + row * (btnH + gapY);
          if (wx >= kx && wx <= kx + btnW && wy >= ky && wy <= ky + btnH) {
            return { inst, key: keyMap[row][col] };
          }
        }
      }
    }
    return null;
  }

  _hitTestIrRemoteButton(wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    if (!defs) return null;
    const buttons = [
      { label: 'CH\u2212', code: 0x45, row: 0, col: 0 },
      { label: 'CH', code: 0x46, row: 0, col: 1 },
      { label: 'CH+', code: 0x47, row: 0, col: 2 },
      { label: 'PREV', code: 0x44, row: 1, col: 0 },
      { label: 'NEXT', code: 0x40, row: 1, col: 1 },
      { label: 'PLAY', code: 0x43, row: 1, col: 2 },
      { label: '\u2212', code: 0x07, row: 2, col: 0 },
      { label: '+', code: 0x15, row: 2, col: 1 },
      { label: 'EQ', code: 0x09, row: 2, col: 2 },
      { label: '0', code: 0x16, row: 3, col: 0 },
      { label: '100+', code: 0x19, row: 3, col: 1 },
      { label: '200+', code: 0x0D, row: 3, col: 2 },
      { label: '1', code: 0x0C, row: 4, col: 0 },
      { label: '2', code: 0x18, row: 4, col: 1 },
      { label: '3', code: 0x5E, row: 4, col: 2 },
      { label: '4', code: 0x08, row: 5, col: 0 },
      { label: '5', code: 0x1C, row: 5, col: 1 },
      { label: '6', code: 0x5A, row: 5, col: 2 },
      { label: '7', code: 0x42, row: 6, col: 0 },
      { label: '8', code: 0x52, row: 6, col: 1 },
      { label: '9', code: 0x4A, row: 6, col: 2 },
    ];
    const btnW = 29, btnH = 20, gapX = 6, gapY = 4.5;
    const startX = 10, startY = 38;
    for (const inst of this.components) {
      if (inst.type !== 'ir_remote') continue;
      for (const btn of buttons) {
        const bx = inst.x + startX + btn.col * (btnW + gapX);
        const by = inst.y + startY + btn.row * (btnH + gapY);
        if (wx >= bx && wx <= bx + btnW && wy >= by && wy <= by + btnH) {
          return { inst, btn };
        }
      }
    }
    return null;
  }

  _hitTestIrRemoteHover(wx, wy) {
    const result = this._hitTestIrRemoteButton(wx, wy);
    return result ? result.inst : null;
  }

  _getLocalCoords(inst, wx, wy) {
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    const def = defs && defs[inst.type];
    const w = def ? def.width : (inst.width || 40);
    const h = def ? def.height : (inst.height || 40);
    const cx = inst.x + w / 2;
    const cy = inst.y + h / 2;
    let dx = wx - cx;
    let dy = wy - cy;
    const rot = ((inst.rotation || 0) % 4 + 4) % 4;
    for (let i = 0; i < rot; i++) {
      const t = dx;
      dx = dy;
      dy = -t;
    }
    return { lx: dx + w / 2, ly: dy + h / 2 };
  }

  _hitTestBoardReset(wx, wy) {
    if (!this.components) return null;
    for (const inst of this.components) {
      if (inst.type === 'arduino_uno') {
        const { lx, ly } = this._getLocalCoords(inst, wx, wy);
        // Uno Reset button switch body is at x: 9..21, y: 19..29, actuator center at (15, 24)
        if (lx >= 7 && lx <= 23 && ly >= 16 && ly <= 32) {
          return { inst, boardType: 'arduino_uno' };
        }
      } else if (inst.type === 'arduino_nano') {
        const { lx, ly } = this._getLocalCoords(inst, wx, wy);
        // Nano Reset button at x: 28..40, y: 33..47, center at (34, 40)
        if (lx >= 26 && lx <= 42 && ly >= 31 && ly <= 49) {
          return { inst, boardType: 'arduino_nano' };
        }
      } else if (inst.type === 'esp32_devkit_v1') {
        const { lx, ly } = this._getLocalCoords(inst, wx, wy);
        // ESP32 EN (reset) button at x: 24..36, y: 240..250
        if (lx >= 22 && lx <= 38 && ly >= 238 && ly <= 252) {
          return { inst, boardType: 'esp32_devkit_v1' };
        }
      }
    }
    return null;
  }

  _handleBoardResetClick(inst) {
    if (window.App && typeof window.App.resetBoard === 'function') {
      window.App.resetBoard(inst);
    } else {
      const sim = this._getSimForInst ? this._getSimForInst(inst) : (window.ArduinoSim || null);
      if (sim && typeof sim.reset === 'function') {
        sim.reset();
      }
    }
  }

  _updateSliderValue(drag, wx, wy) {
    const { inst, ctrl, rect } = drag;

    // Toggle: click anywhere to flip
    if (ctrl.type === 'toggle') {
      inst.runtimeState = inst.runtimeState || {};
      const cur = Number(inst.runtimeState[ctrl.field] ?? inst.props?.[ctrl.field] ?? ctrl.min);
      const val = cur > 0 ? ctrl.min : ctrl.max;
      inst.runtimeState[ctrl.field] = val;
      inst.props = inst.props || {};
      inst.props[ctrl.field] = val;
      if (typeof this._onInteractiveInputChanged === 'function') {
        this._onInteractiveInputChanged(inst, ctrl.field, val);
      }
      return;
    }

    // Knob or range slider: drag horizontally
    const pct = Math.max(0, Math.min(1, (wx - rect.x) / rect.width));
    let value = _canvasSliderValue(pct, ctrl.min, ctrl.max, ctrl.scale);
    if (ctrl.step) value = Math.round(value / ctrl.step) * ctrl.step;
    value = Math.max(ctrl.min, Math.min(ctrl.max, value));
    if (!ctrl.step || Number.isInteger(ctrl.step)) value = Math.round(value);
    inst.runtimeState = inst.runtimeState || {};
    inst.runtimeState[ctrl.field] = value;
    inst.props = inst.props || {};
    inst.props[ctrl.field] = value;
    if (inst.type === 'battery' && ctrl.field === 'voltage' && typeof window.batterySeedSoc === 'function') {
      window.batterySeedSoc(inst);
    }
    if (typeof this._onInteractiveInputChanged === 'function') {
      this._onInteractiveInputChanged(inst, ctrl.field, value);
    }
  }

  _onWheelSlider(sliderHit, deltaY) {
    const { inst, ctrl } = sliderHit;
    if (!inst || !ctrl) return;
    const min = Number(ctrl.min ?? 0);
    const max = Number(ctrl.max ?? 1023);
    const range = max - min;
    const defaultStep = range > 500 ? 25 : (range > 100 ? 5 : (range > 10 ? 1 : 0.1));
    const step = ctrl.step ? Math.max(ctrl.step, defaultStep) : defaultStep;
    const dir = deltaY < 0 ? 1 : -1;

    inst.runtimeState = inst.runtimeState || {};
    const curVal = Number(inst.runtimeState[ctrl.field] ?? inst.props?.[ctrl.field] ?? min);
    let nextVal = curVal + dir * step;
    if (ctrl.step) {
      nextVal = Math.round(nextVal / ctrl.step) * ctrl.step;
    }
    nextVal = Math.max(min, Math.min(max, nextVal));
    if (!ctrl.step || Number.isInteger(ctrl.step)) {
      nextVal = Math.round(nextVal);
    }

    inst.runtimeState[ctrl.field] = nextVal;
    inst.props = inst.props || {};
    inst.props[ctrl.field] = nextVal;

    if (inst.type === 'battery' && ctrl.field === 'voltage' && typeof window.batterySeedSoc === 'function') {
      window.batterySeedSoc(inst);
    }

    if (typeof this._onInteractiveInputChanged === 'function') {
      this._onInteractiveInputChanged(inst, ctrl.field, nextVal);
    }
    this.render();
  }

  _onInteractiveInputChanged(inst, field, val) {
    const sim = window.ArduinoSim || (window.App && window.App.sim);
    if (sim && typeof sim._onInteractiveInputChanged === 'function') {
      sim._onInteractiveInputChanged(inst, field, val);
    }
    if (window.App && typeof window.App._onInteractiveInputChanged === 'function') {
      window.App._onInteractiveInputChanged(inst, field, val);
    }
    if (typeof this.onInputChanged === 'function') {
      this.onInputChanged(inst, field, val);
    }
  }

  _getComponentLabelPos(inst, zoom = this.zoom) {
    const def = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS
      ? window.ArduinoComponents.COMPONENT_DEFS[inst.type]
      : null;
    if (!def) return null;
    const invZ = 1 / zoom;
    const baseX = inst.x + def.width / 2;
    const baseY = inst.y - 8 * invZ;
    const offsetX = Number(inst.props?.labelOffsetX) || 0;
    const offsetY = Number(inst.props?.labelOffsetY) || 0;
    return {
      x: baseX + offsetX,
      y: baseY + offsetY,
      baseX,
      baseY,
      hasOffset: (offsetX !== 0 || offsetY !== 0),
    };
  }

  _componentLabelBounds(inst, ctx = this.ctx, zoom = this.zoom) {
    const def = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS
      ? window.ArduinoComponents.COMPONENT_DEFS[inst.type]
      : null;
    const labelText = inst.props?.label || '';
    if (!def || (def.hideLabel && !labelText)) return null;
    const displayText = labelText || def.name;
    const pos = this._getComponentLabelPos(inst, zoom);
    if (!pos) return null;

    const invZ = 1 / zoom;
    const fontSize = 12 * invZ;
    const prevFont = ctx ? ctx.font : '';
    if (ctx && typeof ctx.measureText === 'function') {
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    }
    const width = (ctx && typeof ctx.measureText === 'function')
      ? ctx.measureText(displayText).width
      : displayText.length * 7 * invZ;
    if (ctx) ctx.font = prevFont;

    const padX = 4 * invZ;
    const padY = 2 * invZ;
    const boxW = width + padX * 2;
    const boxH = 14 * invZ + padY * 2;
    const boxX = pos.x - boxW / 2;
    const boxY = pos.y - 11 * invZ - padY;

    return {
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      labelX: pos.x,
      labelY: pos.y,
      baseX: pos.baseX,
      baseY: pos.baseY,
      hasOffset: pos.hasOffset,
      displayText,
      inst,
    };
  }

  _hitTestComponentLabel(wx, wy) {
    if (this.zoom < 0.7) return null;
    const invZ = 1 / this.zoom;
    const pad = 3 * invZ;
    for (const inst of [...this.components].reverse()) {
      const bounds = this._componentLabelBounds(inst, this.ctx, this.zoom);
      if (!bounds) continue;
      if (wx >= bounds.x - pad && wx <= bounds.x + bounds.width + pad &&
          wy >= bounds.y - pad && wy <= bounds.y + bounds.height + pad) {
        return { inst, bounds };
      }
    }
    return null;
  }

  _drawOverlays(ctx, zoom = this.zoom, includeComponentLabels = false) {
    if (zoom >= 0.7 || includeComponentLabels) {
      for (const inst of this.components) {
        const def = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS
          ? window.ArduinoComponents.COMPONENT_DEFS[inst.type]
          : null;
        const labelText = inst.props?.label || '';
        if (!def || (def.hideLabel && !labelText)) continue;
        const displayText = labelText || def.name;
        const pos = this._getComponentLabelPos(inst, zoom);
        if (!pos) continue;

        ctx.save();
        const labelColor = inst.props?.labelColor || '#ffffff';
        ctx.fillStyle = labelColor;
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = 3 / zoom;
        ctx.font = `600 ${12 / zoom}px Inter, sans-serif`;
        ctx.textAlign = 'center';

        // Draw leader line if label is offset from component
        if (pos.hasOffset) {
          ctx.save();
          if (typeof ctx.beginPath === 'function') {
            ctx.beginPath();
            if (typeof ctx.setLineDash === 'function') ctx.setLineDash([3 / zoom, 3 / zoom]);
            ctx.strokeStyle = labelColor;
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1 / zoom;
            if (typeof ctx.moveTo === 'function') ctx.moveTo(pos.baseX, pos.baseY + 4 / zoom);
            if (typeof ctx.lineTo === 'function') ctx.lineTo(pos.x, pos.y - 2 / zoom);
            if (typeof ctx.stroke === 'function') ctx.stroke();
          }
          ctx.restore();
        }

        ctx.strokeText(displayText, pos.x, pos.y);
        ctx.fillText(displayText, pos.x, pos.y);

        // Highlight selection border if component or its label is selected
        if (inst.selected || this.selectedComponentLabel === inst) {
          const bounds = this._componentLabelBounds(inst, ctx, zoom);
          if (bounds && typeof ctx.strokeRect === 'function') {
            ctx.save();
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 1 / zoom;
            if (typeof ctx.setLineDash === 'function') ctx.setLineDash([2 / zoom, 2 / zoom]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.restore();
          }
        }
        ctx.restore();
      }
    }

    for (const annotation of this.annotations || []) {
      const bounds = this._annotationBounds(annotation, ctx);
      ctx.save();
      ctx.font = '600 16px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const annColor = annotation.color || '#ffffff';
      ctx.fillStyle = annColor;
      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 3;
      annotation.text.split(/\r?\n/).forEach((line, index) => {
        ctx.strokeText(line, annotation.x, annotation.y + index * 20);
        ctx.fillText(line, annotation.x, annotation.y + index * 20);
      });
      if (annotation.selected) {
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(annotation.x - 4, annotation.y - 4, bounds.width + 8, bounds.height + 8);
      }
      ctx.restore();
    }

    if (this.mode === 'placingText' && this.placingMouse) {
      ctx.save();
      ctx.font = '600 16px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 3;
      ctx.strokeText('Text', this.placingMouse.x, this.placingMouse.y);
      ctx.fillText('Text', this.placingMouse.x, this.placingMouse.y);
      ctx.restore();
    }
  }

  _annotationBounds(annotation, ctx = this.ctx) {
    const lines = String(annotation.text || '').split(/\r?\n/);
    const previousFont = ctx.font;
    ctx.font = '600 16px Inter, sans-serif';
    const width = Math.max(8, ...lines.map(line =>
      typeof ctx.measureText === 'function' ? ctx.measureText(line).width : line.length * 8));
    ctx.font = previousFont;
    return { x: annotation.x, y: annotation.y, width, height: Math.max(20, lines.length * 20) };
  }

  _hitTestAnnotation(wx, wy) {
    for (const annotation of [...(this.annotations || [])].reverse()) {
      const bounds = this._annotationBounds(annotation);
      if (wx >= bounds.x - 4 && wx <= bounds.x + bounds.width + 4 &&
        wy >= bounds.y - 4 && wy <= bounds.y + bounds.height + 4) {
        return annotation;
      }
    }
    return null;
  }

  /* -------------- ON-CANVAS LOGIC TAGS -------------- */
  // Position sync (attached tags follow their pin), dotted connector and
  // hit-test rects. Runs at the start of each frame so pills, clicks and
  // cursor feedback all use fresh positions.
  _drawLvlTags(ctx) {
    this._lvlTagRects = [];
    const defs = (window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS) || {};
    for (const inst of this.components) {
      if (inst.type !== 'logic_level_in' && inst.type !== 'logic_level_out') continue;
      const def = defs[inst.type];
      if (!def) continue;
      const a = inst.props && inst.props.attach;
      if (a) {
        const target = this.components.find(c => c.id === a.instId);
        const tdef = target && defs[target.type];
        const pin = tdef && (tdef.pins || []).find(p => p.id === a.pinId);
        if (target && pin) {
          const wp = this._pinWorldPos(target, pin);
          const cx = target.x + tdef.width / 2;
          const cy = target.y + tdef.height / 2;
          let dx = wp.x - cx;
          let dy = wp.y - cy;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
          const ax = wp.x + dx * 20 - def.width / 2;
          const ay = wp.y + dy * 20 - def.height / 2;
          const beingDragged = this.mode === 'dragging' && this.dragging && this.dragging.inst === inst;
          if (!beingDragged) {
            inst.x = ax;
            inst.y = ay;
          }
          ctx.save();
          ctx.strokeStyle = 'rgba(245,185,66,0.6)';
          ctx.lineWidth = 1 / this.zoom;
          ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
          ctx.beginPath();
          ctx.moveTo(wp.x, wp.y);
          ctx.lineTo(inst.x + def.width / 2, inst.y + def.height / 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          delete inst.props.attach; // stale target — detach
        }
      }
      this._lvlTagRects.push({ inst, x: inst.x, y: inst.y, w: def.width, h: def.height });
    }
  }

  _hitTestTag(wx, wy) {
    const rects = this._lvlTagRects;
    if (!rects || !rects.length) return null;
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      const touchScale = Math.max(this.zoom, 0.01);
      const touchPadX = this._touchActive && r.inst.type === 'logic_level_in'
        ? Math.max(0, (44 / touchScale - r.w) / 2)
        : 0;
      const touchPadY = this._touchActive && r.inst.type === 'logic_level_in'
        ? Math.max(0, (44 / touchScale - r.h) / 2)
        : 0;
      if (wx >= r.x - touchPadX && wx <= r.x + r.w + touchPadX
        && wy >= r.y - touchPadY && wy <= r.y + r.h + touchPadY) return r;
    }
    return null;
  }

  // Snap a logic tag to the nearest classified IC pin within the attach
  // threshold. Nearest pin wins — the tag only links when that pin's kind
  // matches (input tag → input pin, output tag → output pin); otherwise
  // the tag stays free / wireable.
  _tryAttachTag(inst) {
    if (!inst || (inst.type !== 'logic_level_in' && inst.type !== 'logic_level_out')) return;
    const defs = (window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS) || {};
    const def = defs[inst.type];
    if (!def) return;
    const isInput = inst.type === 'logic_level_in';
    const cx = inst.x + def.width / 2;
    const cy = inst.y + def.height / 2;
    let best = null;
    let bestKind = null;
    let bestD = 24;
    for (const t of this.components) {
      if (t.id === inst.id) continue;
      const tdef = defs[t.type];
      if (!tdef || !Array.isArray(tdef.pins) || !tdef.pins.length) continue;
      const tags = window.classifyICTags ? window.classifyICTags(t.type, tdef.pins) : null;
      if (!tags) continue;
      const inSet = new Set(tags.inputs || []);
      const outSet = new Set(tags.outputs || []);
      if (!inSet.size && !outSet.size) continue;
      for (const p of tdef.pins) {
        const kind = inSet.has(p.id) ? 'in' : (outSet.has(p.id) ? 'out' : null);
        if (!kind) continue;
        const wp = this._pinWorldPos(t, p);
        const d = Math.hypot(wp.x - cx, wp.y - cy);
        if (d < bestD) {
          bestD = d;
          best = { instId: t.id, pinId: p.id };
          bestKind = kind;
        }
      }
    }
    if (!inst.props) inst.props = {};
    const matches = best && ((isInput && bestKind === 'in') || (!isInput && bestKind === 'out'));
    if (matches) inst.props.attach = best;
    else delete inst.props.attach;
  }

  // Click (mouse-up without moving) on an input tag:
  //  - attached: flip the forced level on the target IC pin
  //  - free:     flip the tag's own source level
  _toggleLogicTag(inst) {
    if (!inst || inst.type !== 'logic_level_in') return;
    if (!inst.props) inst.props = {};
    const a = inst.props.attach;
    if (a) {
      const target = this.components.find(c => c.id === a.instId);
      if (target) {
        let cur = this._getForcedLevel(a.instId, a.pinId);
        if (cur === null) cur = this._readDigitalInput(a.instId, a.pinId) ? 1 : 0;
        if (!target.props) target.props = {};
        if (!target.props.forcedInputs) target.props.forcedInputs = {};
        target.props.forcedInputs[a.pinId] = cur ? 0 : 1;
        this._onChanged();
        return;
      }
      delete inst.props.attach;
    }
    inst.props.level = inst.props.level ? 0 : 1;
    this._onChanged();
  }

  // Slide an SPDT slide switch to the opposite throw (COM ↔ A ⇄ COM ↔ B).
  // Only the throw index changes — the engine does the rest of the work.
  _toggleSlideSwitch(inst) {
    if (!inst || inst.type !== 'slide_switch') return;
    const onA = typeof window._slideSwitchThrow === 'function'
      ? window._slideSwitchThrow(inst) === 'a' : !(inst.runtimeState?.position ?? inst.props?.position);
    inst.runtimeState = inst.runtimeState || {};
    inst.runtimeState.position = onA ? 1 : 0;
    this._onChanged();
  }

  /* ---- Push button: momentary vs latching ---------------------------- */
  // A momentary (tactile) button is closed only while the pointer — or
  // Space/Enter — is physically held down. A latching one stays closed after a
  // click until the next click. Default is 'latching' so every existing
  // circuit keeps behaving exactly as it did before the property existed.
  _isMomentaryButton(inst) {
    if (!inst || inst.type !== 'push_button') return false;
    const mode = inst.props?.mode ?? inst.runtimeState?.mode;
    return mode === 'momentary';
  }

  _setPushButton(inst, pressed) {
    if (!inst || inst.type !== 'push_button') return;
    inst.runtimeState = inst.runtimeState || {};
    inst.runtimeState.pressed = !!pressed;
  }

  // Opens every button that the pointer is holding down. Called on document
  // mouseup so a button can't stay stuck closed when the pointer is released
  // outside the canvas element (the canvas never sees that mouseup).
  _releasePointerHeldButton() {
    if (this._pointerHeldButton) {
      this._setPushButton(this._pointerHeldButton, false);
      this._pointerHeldButton = null;
    }
  }

  // Right-click release: clears the forced level on an attached input tag.
  // Returns true when a force was released (caller should skip its menu).
  _releaseLogicTag(inst) {
    if (!inst || inst.type !== 'logic_level_in' || !inst.props) return false;
    const a = inst.props.attach;
    if (!a) return false;
    if (this._getForcedLevel(a.instId, a.pinId) === null) return false;
    const target = this.components.find(c => c.id === a.instId);
    if (target && target.props && target.props.forcedInputs) {
      delete target.props.forcedInputs[a.pinId];
      this._onChanged();
    }
    return true;
  }

  /* -------------- COMPONENT MANAGEMENT -------------- */
  addComponent(type, worldX, worldY) {
    const def = window.ArduinoComponents.COMPONENT_DEFS[type];
    if (!def) return null;
    const wx = Number.isFinite(Number(worldX)) ? Number(worldX) : 0;
    const wy = Number.isFinite(Number(worldY)) ? Number(worldY) : 0;

    const inst = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      x: this._snap(wx - def.width / 2),
      y: this._snap(wy - def.height / 2),
      width: def.width,
      height: def.height,
      props: { ...(def.defaultProps || {}) },
      runtimeState: {},
      selected: false,
      rotation: 0,
    };

    this._pushHistory();
    this.components.push(inst);
    this._onChanged();
    return inst;
  }

  removeComponent(id) {
    this._pushHistory();
    this.wires = this.wires.filter(w => w.from.instId !== id && w.to.instId !== id);
    this.components = this.components.filter(c => c.id !== id);
    if (this.selected && this.selected.id === id) this.selected = null;
    this._onChanged();
  }

  addWire(fromInstId, fromPinId, toInstId, toPinId, color = null, waypoints = [], opts = {}) {
    // Never allow a pin to be wired to itself
    if (fromInstId === toInstId && fromPinId === toPinId) return null;

    // Avoid duplicate wires
    const exists = this.wires.some(w =>
      (w.from.instId === fromInstId && w.from.pinId === fromPinId && w.to.instId === toInstId && w.to.pinId === toPinId) ||
      (w.from.instId === toInstId && w.from.pinId === toPinId && w.to.instId === fromInstId && w.to.pinId === fromPinId)
    );
    if (exists) return null;

    this._pushHistory();
    const wire = {
      id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      from: { instId: fromInstId, pinId: fromPinId },
      to: { instId: toInstId, pinId: toPinId },
      color: color || null,
      waypoints: Array.isArray(waypoints) ? waypoints.map(wp => ({ x: wp.x, y: wp.y })) : [],
      routeStyle: opts.routeStyle || 'orthogonal',
      bezierCtrl: opts.bezierCtrl || null,
    };
    this.wires.push(wire);
    this._onChanged();
    return wire;
  }

  setWireColor(wireId, color) {
    const wire = this.wires.find(w => w.id === wireId);
    if (!wire) return;
    this._pushHistory();
    wire.color = color || null;
    this._onChanged();
  }

  setWireStyle(wireId, style) {
    const wire = this.wires.find(w => w.id === wireId);
    if (!wire || wire.routeStyle === style) return;
    this._pushHistory();
    wire.routeStyle = style;
    if (style === 'bezier' && !wire.bezierCtrl) {
      const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
      const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
      const d1 = this._getPinExitDir(wire.from.instId, wire.from.pinId);
      const d2 = this._getPinExitDir(wire.to.instId, wire.to.pinId);
      if (p1 && p2) wire.bezierCtrl = this._autoBezierCtrl(p1, d1, p2, d2);
    }
    if (style === 'orthogonal') {
      wire.waypoints = [];
    }
    this._onChanged();
  }

  resetWireRoute(wireId) {
    const wire = this.wires.find(w => w.id === wireId);
    if (!wire) return;
    this._pushHistory();
    wire.waypoints = [];
    wire.bezierCtrl = null;
    this._onChanged();
  }

  _simplifyWaypoints(wire) {
    if (!wire || !wire.waypoints || wire.waypoints.length === 0) return;
    const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
    const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
    if (!p1 || !p2) return;

    let pts = [p1, ...wire.waypoints, p2];
    let simplified = [pts[0]];

    for (let i = 1; i < pts.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = pts[i];
      const next = pts[i + 1];

      // Skip duplicate consecutive points
      if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) continue;

      // Skip redundant collinear points on straight line
      const isCollinearX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
      const isCollinearY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
      if (isCollinearX || isCollinearY) continue;

      simplified.push(curr);
    }
    simplified.push(p2);

    wire.waypoints = simplified.slice(1, -1).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  }

  removeWire(id) {
    this._pushHistory();
    this.wires = this.wires.filter(w => w.id !== id);
    if (this.selectedWire && this.selectedWire.id === id) this.selectedWire = null;
    this._onChanged();
  }

  clearCanvas() {
    this._pushHistory();
    this.components = [];
    this.wires = [];
    this.annotations = [];
    this.selected = null;
    this.selectedWire = null;
    this.selectedAnnotation = null;
    this._onChanged();
    this._notifySelectionChange();
  }

  deselectAll() {
    this._selectAll(false);
    this.selected = null;
    this.selectedWire = null;
    this.selectedAnnotation = null;
    this._render();
    this._notifySelectionChange();
  }

  rotateSelected() {
    const selComps = this.components.filter(c => c.selected);
    if (selComps.length === 0 && this.selected) selComps.push(this.selected);
    if (selComps.length === 0) return;
    this._pushHistory();
    for (const c of selComps) {
      c.rotation = ((c.rotation || 0) + 1) % 4;
    }
    this._onChanged();
    this._notifySelectionChange();
  }

  deleteSelected() {
    if (this.selectedAnnotation) {
      this._pushHistory();
      this.annotations = this.annotations.filter(a => a.id !== this.selectedAnnotation.id);
      this.selectedAnnotation = null;
      this._pushHistory();
      this._onChanged();
      this._notifySelectionChange();
      return;
    }
    const selComps = this.components.filter(c => c.selected);
    if (selComps.length > 0) {
      this._pushHistory();
      const ids = new Set(selComps.map(c => c.id));
      this.wires = this.wires.filter(w => !ids.has(w.from.instId) && !ids.has(w.to.instId));
      this.components = this.components.filter(c => !ids.has(c.id));
      this.selected = null;
      this.selectedPin = null;
      this.selectedWire = null;
      this.selectedAnnotation = null;
      this._onChanged();
      this._notifySelectionChange();
      return;
    }
    if (this.selectedWire) {
      this.removeWire(this.selectedWire.id);
      this._notifySelectionChange();
    }
  }

  selectAll() {
    this.components.forEach(c => c.selected = true);
    this.selected = this.components[this.components.length - 1] || null;
    (this.annotations || []).forEach(a => a.selected = false);
    this.selectedAnnotation = null;
    this._notifySelectionChange();
  }

  duplicateSelected() {
    // Collect all selected components
    let selComps = this.components.filter(c => c.selected);
    if (selComps.length === 0 && this.selected) selComps = [this.selected];
    if (selComps.length === 0) return null;

    this._pushHistory();
    this._selectAll(false);

    const selIds = new Set(selComps.map(c => c.id));
    const selWires = this.wires.filter(w => selIds.has(w.from.instId) && selIds.has(w.to.instId));
    const offset = this.GRID * 2;
    const idMap = {};
    const dupes = [];

    for (const orig of selComps) {
      const def = window.ArduinoComponents.COMPONENT_DEFS[orig.type];
      const newId = `${orig.type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap[orig.id] = newId;
      const copy = {
        id: newId,
        type: orig.type,
        x: orig.x + offset,
        y: orig.y + offset,
        width: def ? def.width : orig.width,
        height: def ? def.height : orig.height,
        props: JSON.parse(JSON.stringify(orig.props || (def ? def.defaultProps : {}))),
        runtimeState: {},
        selected: true,
        rotation: orig.rotation || 0,
      };
      this.components.push(copy);
      dupes.push(copy);
    }

    for (const w of selWires) {
      const nf = idMap[w.from.instId], nt = idMap[w.to.instId];
      if (nf && nt) this.addWire(nf, w.from.pinId, nt, w.to.pinId, w.color, w.waypoints, { routeStyle: w.routeStyle, bezierCtrl: w.bezierCtrl });
    }

    this.selected = dupes[dupes.length - 1] || null;
    this.selectedWire = null;
    this._onChanged();
    this._notifySelectionChange();
    return this.selected;
  }

  copySelected() {
    // Collect all components where selected === true
    let selComps = this.components.filter(c => c.selected);
    // Fall back to single selected component
    if (selComps.length === 0 && this.selected) selComps = [this.selected];
    if (selComps.length === 0) return;

    const selIds = new Set(selComps.map(c => c.id));
    // Only copy wires where BOTH endpoints are in the selected set
    const selWires = this.wires.filter(w =>
      selIds.has(w.from.instId) && selIds.has(w.to.instId)
    );

    this._clipboard = {
      components: JSON.parse(JSON.stringify(selComps, (k, v) => k === '_componentInstance' ? undefined : v)),
      wires: JSON.parse(JSON.stringify(selWires)),
    };
  }

  paste() {
    if (!this._clipboard) return;
    const { components: origComps, wires: origWires } = this._clipboard;
    if (!origComps || origComps.length === 0) return;

    this._pushHistory();
    this._selectAll(false);

    // Compute bounding box of clipboard components for offset
    let minX = Infinity, minY = Infinity;
    for (const c of origComps) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
    }

    const offset = this.GRID * 4;
    const idMap = {}; // oldId ← newId
    const pastedComps = [];

    for (const orig of origComps) {
      const def = window.ArduinoComponents.COMPONENT_DEFS[orig.type];
      const newId = `${orig.type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap[orig.id] = newId;
      const copy = {
        id: newId,
        type: orig.type,
        x: orig.x + offset,
        y: orig.y + offset,
        width: def ? def.width : orig.width,
        height: def ? def.height : orig.height,
        props: JSON.parse(JSON.stringify(orig.props || {})),
        runtimeState: {},
        selected: true,
        rotation: orig.rotation || 0,
      };
      this.components.push(copy);
      pastedComps.push(copy);
    }

    // Remap and add wires
    for (const origWire of (origWires || [])) {
      const newFromId = idMap[origWire.from.instId];
      const newToId = idMap[origWire.to.instId];
      if (!newFromId || !newToId) continue;
      this.addWire(newFromId, origWire.from.pinId, newToId, origWire.to.pinId, origWire.color, origWire.waypoints, { routeStyle: origWire.routeStyle, bezierCtrl: origWire.bezierCtrl });
    }

    this.selected = pastedComps[pastedComps.length - 1] || null;
    this.selectedWire = null;

    // Update clipboard positions for sequential pastes
    for (const c of this._clipboard.components) {
      c.x += offset;
      c.y += offset;
    }

    this._onChanged();
  }

  startPlacing(type) {
    this.mode = 'placing';
    this.placingType = type;
    this.placingMouse = null;
    this.canvas.style.cursor = 'crosshair';
    const textButton = document.getElementById('btn-add-canvas-text');
    textButton?.classList.remove('active');
    textButton?.setAttribute('aria-pressed', 'false');
    // Show hint
    const hint = document.getElementById('placing-hint');
    const nameEl = document.getElementById('placing-name');
    if (hint && nameEl) {
      const def = window.ArduinoComponents.COMPONENT_DEFS[type];
      nameEl.textContent = def ? def.name : type;
      hint.classList.remove('hidden');
    }
    // Notify app that placing mode started
    if (this.onPlacingChanged) this.onPlacingChanged(true, type);
    this._notifySelectionChange();
  }

  startTextPlacement() {
    if (this.mode === 'placingText') {
      this.cancelPlacing();
      return;
    }
    if (this.mode === 'placing') this.cancelPlacing();
    this.mode = 'placingText';
    this.placingType = null;
    this.placingMouse = null;
    this.canvas.style.cursor = 'crosshair';
    const button = document.getElementById('btn-add-canvas-text');
    button?.classList.add('active');
    button?.setAttribute('aria-pressed', 'true');
    const hint = document.getElementById('placing-hint');
    const nameEl = document.getElementById('placing-name');
    if (hint && nameEl) {
      nameEl.textContent = 'Text annotation';
      hint.classList.remove('hidden');
    }
    if (this.onPlacingChanged) this.onPlacingChanged(true, null);
    this._notifySelectionChange();
  }

  addTextAnnotation(text, worldX, worldY, color = null) {
    const value = String(text || '');
    if (!value.trim()) return null;
    const annotation = {
      id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: value,
      x: this._snap(Number.isFinite(Number(worldX)) ? Number(worldX) : 0),
      y: this._snap(Number.isFinite(Number(worldY)) ? Number(worldY) : 0),
      selected: false,
    };
    if (typeof color === 'string' && color.trim()) {
      annotation.color = color.trim();
    }
    this._pushHistory();
    this.annotations.push(annotation);
    this._selectAll(false);
    annotation.selected = true;
    this.selectedAnnotation = annotation;
    this._pushHistory();
    this._onChanged();
    return annotation;
  }

  setComponentLabel(instId, label) {
    const comp = this.components.find(c => c.id === instId);
    if (!comp) return;
    this._pushHistory();
    comp.props = comp.props || {};
    comp.props.label = String(label ?? '').trim();
    this._pushHistory();
    this._onChanged();
    this._render();
  }

  setComponentLabelColor(instId, color) {
    const comp = this.components.find(c => c.id === instId);
    if (!comp) return;
    this._pushHistory();
    comp.props = comp.props || {};
    comp.props.labelColor = (typeof color === 'string' && color.trim()) ? color.trim() : null;
    this._pushHistory();
    this._onChanged();
    this._render();
  }

  setComponentLabelOffset(instId, offsetX, offsetY) {
    const comp = this.components.find(c => c.id === instId);
    if (!comp) return;
    this._pushHistory();
    comp.props = comp.props || {};
    comp.props.labelOffsetX = Number(offsetX) || 0;
    comp.props.labelOffsetY = Number(offsetY) || 0;
    this._pushHistory();
    this._onChanged();
    this._render();
  }

  resetComponentLabelOffset(instId) {
    const comp = this.components.find(c => c.id === instId);
    if (!comp) return;
    this._pushHistory();
    comp.props = comp.props || {};
    delete comp.props.labelOffsetX;
    delete comp.props.labelOffsetY;
    this._pushHistory();
    this._onChanged();
    this._render();
  }

  setAnnotationColor(annotationId, color) {
    const ann = (this.annotations || []).find(a => a.id === annotationId);
    if (!ann) return;
    this._pushHistory();
    ann.color = (typeof color === 'string' && color.trim()) ? color.trim() : null;
    this._pushHistory();
    this._onChanged();
    this._render();
  }

  setAnnotationText(annotationId, text) {
    const ann = (this.annotations || []).find(a => a.id === annotationId);
    if (!ann) return;
    this._pushHistory();
    ann.text = String(text ?? '');
    this._pushHistory();
    this._onChanged();
    this._render();
  }

  _placeTextAnnotation(world) {
    const text = window.prompt('Enter annotation text:');
    if (text !== null) this.addTextAnnotation(text, world.x, world.y);
  }

  cancelPlacing() {
    this.mode = 'idle';
    this.placingType = null;
    this.placingMouse = null;
    this.canvas.style.cursor = '';
    const button = document.getElementById('btn-add-canvas-text');
    button?.classList.remove('active');
    button?.setAttribute('aria-pressed', 'false');
    const hint = document.getElementById('placing-hint');
    if (hint) hint.classList.add('hidden');
    const nameEl = document.getElementById('placing-name');
    if (nameEl) nameEl.textContent = 'Component';
    // Remove active class from sidebar
    document.querySelectorAll('.comp-item').forEach(el => el.classList.remove('placing'));
    // Notify app that placing mode ended
    if (this.onPlacingChanged) this.onPlacingChanged(false);
    this._notifySelectionChange();
  }

  /* -------------- EVENT HANDLING -------------- */
  _bindEvents() {
    const canvas = this.canvas;

    window.addEventListener('resize', () => this._resize());
    canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    canvas.addEventListener('mouseup', e => this._onMouseUp(e));
    canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    canvas.addEventListener('dblclick', e => this._onDblClick(e));
    canvas.addEventListener('contextmenu', e => this._onContextMenu(e));
    canvas.addEventListener('mouseleave', () => {
      this._hidePinTooltip();
      this._hideWireTooltip();
    });

    // Touch events for mobile
    canvas.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', e => this._onTouchEnd(e), { passive: false });

    document.addEventListener('keydown', e => this._onKeyDown(e));
    document.addEventListener('keyup', e => this._onKeyUp(e));
    document.addEventListener('mouseup', () => {
      if (this.mode === 'panning') this.mode = 'idle';
      this._releasePointerHeldButton();
    });
  }

  /* --------------- TOUCH HANDLERS --------------- */
  _onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      clearTimeout(this._longPressTimer);
      this._touchActive = false;
      this._pinchStart = this._getTouchDist(e.touches);
      this._pinchCenter = this._getTouchCenter(e.touches);
      this._isPinching = true;
      return;
    }
    if (e.touches.length === 1) {
      e.preventDefault();
      this._touchActive = true;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      this._longPressTimer = setTimeout(() => {
        this._onLongPress(offsetX, offsetY);
      }, 500);
      this._touchStartPos = { x: touch.clientX, y: touch.clientY };
      // Simulate mouse event for single tap
      this._onMouseDown({ button: 0, offsetX, offsetY, clientX: touch.clientX, clientY: touch.clientY, altKey: false });
    }
  }

  _onTouchMove(e) {
    if (this._isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = this._getTouchDist(e.touches);
      const center = this._getTouchCenter(e.touches);
      const factor = dist / (this._pinchStart || dist);
      const rect = this.canvas.getBoundingClientRect();
      const mx = center.x - rect.left;
      const my = center.y - rect.top;

      // Two-finger pan: move canvas with gesture center
      if (this._pinchCenter) {
        this.panX += (center.x - this._pinchCenter.x);
        this.panY += (center.y - this._pinchCenter.y);
      }

      if (Math.abs(factor - 1) > 0.005) {
        this.panX -= (mx - this.panX) * (factor - 1);
        this.panY -= (my - this.panY) * (factor - 1);
        this.zoom = Math.max(0.1, Math.min(4, this.zoom * factor));
      }
      this._pinchStart = dist;
      this._pinchCenter = center;
      this._updateZoomDisplay();
      this._render();
      return;
    }
    if (e.touches.length === 1 && !this._isPinching) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      // Cancel long press if moved too far
      if (this._touchStartPos) {
        const dx = touch.clientX - this._touchStartPos.x;
        const dy = touch.clientY - this._touchStartPos.y;
        const touchDistance = Math.sqrt(dx * dx + dy * dy);
        if (touchDistance > 10) {
          clearTimeout(this._longPressTimer);
        }
        if (this._touchActive && this.mode === 'dragging'
          && this.dragging?.inst.type === 'logic_level_in'
          && !this.dragging.moved && touchDistance <= 10) {
          return;
        }
      }
      this._onMouseMove({ offsetX, offsetY, clientX: touch.clientX, clientY: touch.clientY, button: 0 });
    }
  }

  _onTouchEnd(e) {
    clearTimeout(this._longPressTimer);
    if (this._isPinching) {
      if (e.touches.length === 0) {
        this._isPinching = false;
        this._touchActive = false;
      }
      this._render();
      return;
    }
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      this._onMouseUp({ offsetX, offsetY, clientX: touch.clientX, clientY: touch.clientY, button: 0 });
    }
    this._touchActive = false;
  }

  _getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  _onLongPress(offsetX, offsetY) {
    const world = this._toWorld(offsetX, offsetY);
    const comp = this._hitTestComp(world.x, world.y);
    if (comp) {
      this._selectAll(false);
      comp.selected = true;
      this.selected = comp;
      this._notifySelectionChange();
      if (window.App) window.App._showContextMenu(comp, offsetX + this.canvas.getBoundingClientRect().left, offsetY + this.canvas.getBoundingClientRect().top);
    }
  }

  _onMouseDown(e) {
    this._hideWireTooltip();
    this._hidePinTooltip();
    const world = this._toWorld(e.offsetX, e.offsetY);
    this._lastMouse = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle/Alt+left = pan
      this.mode = 'panning';
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0) {
      if (this.mode === 'placingText') {
        this._placeTextAnnotation(world);
        return;
      }
      if (this.mode === 'placing') {
        this._placeComponent(world);
        return;
      }

      // On-canvas logic tags take priority over the pins beneath them
      if (this.mode !== 'wiring') {
        const tagHit = this._hitTestTag(world.x, world.y);
        if (tagHit) {
          const t = tagHit.inst;
          if (!e.shiftKey) this._selectAll(false);
          t.selected = true;
          this.selected = t;
          this.selectedWire = null;
          this.mode = 'dragging';
          this.dragging = {
            inst: t,
            offsetX: world.x - t.x,
            offsetY: world.y - t.y,
            startX: t.x,
            startY: t.y,
            moved: false,
          };
          return;
        }
      }

      const annotationHit = this._hitTestAnnotation(world.x, world.y);
      if (annotationHit) {
        this._selectAll(false);
        annotationHit.selected = true;
        this.selectedAnnotation = annotationHit;
        this.selected = null;
        this.selectedWire = null;
        this.selectedComponentLabel = null;
        this.mode = 'annotationDragging';
        this.draggingAnnotation = {
          annotation: annotationHit,
          offsetX: world.x - annotationHit.x,
          offsetY: world.y - annotationHit.y,
          moved: false,
          historyPushed: false,
        };
        return;
      }

      const compLabelHit = this._hitTestComponentLabel(world.x, world.y);
      if (compLabelHit) {
        if (!e.shiftKey) this._selectAll(false);
        compLabelHit.inst.selected = true;
        this.selected = compLabelHit.inst;
        this.selectedWire = null;
        this.selectedAnnotation = null;
        this.selectedComponentLabel = compLabelHit.inst;
        this.mode = 'componentLabelDragging';
        this.draggingComponentLabel = {
          inst: compLabelHit.inst,
          startOffsetX: Number(compLabelHit.inst.props?.labelOffsetX) || 0,
          startOffsetY: Number(compLabelHit.inst.props?.labelOffsetY) || 0,
          startMouseX: world.x,
          startMouseY: world.y,
          moved: false,
          historyPushed: false,
        };
        this.canvas.style.cursor = 'move';
        this._notifySelectionChange();
        this._render();
        return;
      }

      // Check pin click first (start wiring)
      const pinHit = this._hitTestPin(world.x, world.y);
      if (pinHit) {
        this.selectedPin = { inst: pinHit.inst, pin: pinHit.pin };
        if (this.mode === 'wiring') {
          // Complete wire if compatible pin
          if (pinHit.inst.id !== this.wiringFrom.inst.id) {
            this.addWire(this.wiringFrom.inst.id, this.wiringFrom.pin.id, pinHit.inst.id, pinHit.pin.id);
          }
          this._endWiring();
        } else {
          // Start wiring
          this._startWiring(pinHit.inst, pinHit.pin, pinHit.worldX, pinHit.worldY);
        }
        return;
      }

      if (this.mode === 'wiring') {
        this._endWiring();
        return;
      }

      // Board reset button click (e.g. Arduino Uno / Nano / ESP32 on-board tactile reset button)
      const boardResetHit = this._hitTestBoardReset(world.x, world.y);
      if (boardResetHit) {
        const { inst } = boardResetHit;
        inst.runtimeState = inst.runtimeState || {};
        if (inst.runtimeState._resetReleaseTimer) {
          clearTimeout(inst.runtimeState._resetReleaseTimer);
        }
        inst.runtimeState._resetPressed = true;
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        this._notifySelectionChange();
        this._render();

        // Auto-release visual button press after 160ms
        inst.runtimeState._resetReleaseTimer = setTimeout(() => {
          inst.runtimeState._resetPressed = false;
          inst.runtimeState._resetReleaseTimer = null;
          this._render();
        }, 160);

        this._handleBoardResetClick(inst);
        return;
      }

      // Interactive on-canvas slider (potentiometer / sensor value)
      const sliderHit = this._hitTestSlider(world.x, world.y);
      if (sliderHit) {
        this._selectAll(false);
        this.selected = null;
        this.selectedWire = null;
        this.selectedAnnotation = null;
        this.mode = 'sliderdrag';
        this.sliderDrag = sliderHit;
        this._updateSliderValue(sliderHit, world.x, world.y);
        return;
      }

      // Inline toggle inside a component (Power/Output switches on bench supply, MB102 power button)
      const inlineHit = this._hitTestInlineToggle(world.x, world.y);
      if (inlineHit) {
        const { inst, ctrl } = inlineHit;
        inst.runtimeState = inst.runtimeState || {};
        const cur = Number(inst.runtimeState[ctrl.field] ?? inst.props?.[ctrl.field] ?? ctrl.min);
        const nextVal = cur > 0 ? ctrl.min : ctrl.max;
        inst.runtimeState[ctrl.field] = nextVal;
        inst.props = inst.props || {};
        inst.props[ctrl.field] = nextVal;
        if (typeof this._onInteractiveInputChanged === 'function') {
          this._onInteractiveInputChanged(inst, ctrl.field, nextVal);
        }
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        this._pushHistory();
        this._onChanged();
        this._recalculateNets();
        return;
      }

      // MB102 Jumper click (switch top or bottom rail voltage directly on board)
      const mbJumperHit = this._hitTestMb102Jumper(world.x, world.y);
      if (mbJumperHit) {
        const { inst, rail, targetVoltage } = mbJumperHit;
        const propField = rail === 'top' ? 'topVoltage' : 'bottomVoltage';
        const curVal = String(inst.runtimeState?.[propField] ?? inst.props?.[propField] ?? (rail === 'top' ? '5V' : '3.3V'));
        let nextVal = targetVoltage;
        if (!nextVal || nextVal === curVal) {
          // Cycle: 5V -> 3.3V -> OFF -> 5V
          if (curVal === '5V') nextVal = '3.3V';
          else if (curVal === '3.3V') nextVal = 'OFF';
          else nextVal = '5V';
        }
        inst.props = inst.props || {};
        inst.runtimeState = inst.runtimeState || {};
        inst.props[propField] = nextVal;
        inst.runtimeState[propField] = nextVal;
        if (typeof this._onInteractiveInputChanged === 'function') {
          this._onInteractiveInputChanged(inst, propField, nextVal);
        }
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        this._pushHistory();
        this._onChanged();
        this._recalculateNets();
        return;
      }

      // DSO button clicks (channel toggles, trigger, mode, etc.)
      const dsoHit = this._hitTestDsoButton(world.x, world.y);
      if (dsoHit) {
        const { inst, key } = dsoHit;
        inst.runtimeState = inst.runtimeState || {};
        this._handleDsoButtonClick(inst, key);
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        return;
      }

      // Function Generator button clicks (wave selectors)
      const funcGenHit = this._hitTestFuncGenButton(world.x, world.y);
      if (funcGenHit) {
        const { inst, key } = funcGenHit;
        inst.runtimeState = inst.runtimeState || {};
        this._handleFuncGenButtonClick(inst, key);
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        return;
      }

      // DIP switch individual toggle
      const dipHit = this._hitTestDipSwitch(world.x, world.y);
      if (dipHit) {
        const { inst, bit } = dipHit;
        inst.runtimeState = inst.runtimeState || {};
        const cur = inst.runtimeState.switches ?? inst.props.switches ?? 0;
        inst.runtimeState.switches = cur ^ (1 << bit);
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        return;
      }

      // Keypad button click — press on click, auto-release after 150ms
      const keypadHit = this._hitTestKeypadButton(world.x, world.y);
      if (keypadHit) {
        const { inst, key } = keypadHit;
        inst.runtimeState = inst.runtimeState || {};
        // Clear any pending release timer
        if (inst.runtimeState._keyReleaseTimer) clearTimeout(inst.runtimeState._keyReleaseTimer);
        inst.runtimeState.pressedKey = key;
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        this._render();
        // Auto-release after 150ms
        inst.runtimeState._keyReleaseTimer = setTimeout(() => {
          inst.runtimeState.pressedKey = null;
          this._render();
        }, 150);
        return;
      }

      // IR Remote button click — press on click, send code to all ir_receiver instances
      const irRemoteHit = this._hitTestIrRemoteButton(world.x, world.y);
      if (irRemoteHit) {
        const { inst, btn } = irRemoteHit;
        inst.runtimeState = inst.runtimeState || {};
        if (inst.runtimeState._irReleaseTimer) clearTimeout(inst.runtimeState._irReleaseTimer);
        inst.runtimeState.lastButton = btn.label;
        inst.runtimeState.code = btn.code;
        inst.props.code = btn.code;
        // Send code to all ir_receiver instances on canvas
        for (const other of this.components) {
          if (other.type === 'ir_receiver') {
            other.runtimeState = other.runtimeState || {};
            other.runtimeState.code = btn.code;
            other.runtimeState.decoding = true;
            other.props.code = btn.code;
          }
        }
        this._selectAll(false);
        inst.selected = true;
        this.selected = inst;
        this._render();
        // Auto-release button highlight after 200ms
        inst.runtimeState._irReleaseTimer = setTimeout(() => {
          inst.runtimeState.lastButton = '';
          this._render();
        }, 200);
        return;
      }

      // Check wire click (select and/or start dragging segment/handle)
      const wireDetail = this._hitTestWireDetails(world.x, world.y);
      if (wireDetail) {
        this._selectAll(false);
        this.selectedWire = wireDetail.wire;
        this.selected = null;
        this._notifySelectionChange();

        const wire = wireDetail.wire;

        // Bezier control point drag
        if (wireDetail.bezierCtrl >= 0 && wire.routeStyle === 'bezier') {
          this.mode = 'wiredrag';
          this.draggingWire = {
            wireId: wire.id,
            bezierCtrl: wireDetail.bezierCtrl,
            handleIdx: -1,
            segIdx: -1,
            startWorld: { x: world.x, y: world.y },
            initialBezierCtrl: wire.bezierCtrl ? {
              c1: { x: wire.bezierCtrl.c1.x, y: wire.bezierCtrl.c1.y },
              c2: { x: wire.bezierCtrl.c2.x, y: wire.bezierCtrl.c2.y }
            } : null,
            moved: false
          };
          this.canvas.style.cursor = 'grabbing';
          return;
        }

        // If orthogonal wire doesn't have waypoints yet, initialize them from current polyline
        if (wire.routeStyle !== 'bezier' && (!wire.waypoints || wire.waypoints.length === 0) && wireDetail.pathData && wireDetail.pathData.pts && wireDetail.pathData.pts.length > 2) {
          wire.waypoints = wireDetail.pathData.pts.slice(1, -1).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
        }

        const pathData = this._wirePath(wire);
        const currentPts = pathData ? (pathData.type === 'bezier' ? [pathData.p1, pathData.c1, pathData.c2, pathData.p2] : pathData.pts) : (wireDetail.pathData ? wireDetail.pathData.pts : null);

        this.mode = 'wiredrag';
        this.draggingWire = {
          wireId: wire.id,
          handleIdx: wireDetail.handleIdx,
          segIdx: wireDetail.segIdx,
          bezierCtrl: -1,
          startWorld: { x: world.x, y: world.y },
          initialWaypoints: (wire.waypoints || []).map(p => ({ x: p.x, y: p.y })),
          initialBezierCtrl: wire.bezierCtrl ? {
            c1: { x: wire.bezierCtrl.c1.x, y: wire.bezierCtrl.c1.y },
            c2: { x: wire.bezierCtrl.c2.x, y: wire.bezierCtrl.c2.y }
          } : null,
          pts: currentPts ? currentPts.map(p => ({ x: p.x, y: p.y })) : [],
          moved: false
        };
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // Check component click
      const compHit = this._hitTestComp(world.x, world.y);
      if (compHit) {
        if (!e.shiftKey) this._selectAll(false);
        else {
          (this.annotations || []).forEach(a => a.selected = false);
          this.selectedAnnotation = null;
        }
        compHit.selected = true;
        this.selected = compHit;
        this.selectedWire = null;
        this._notifySelectionChange();

        // --- push_button: momentary presses while held, latching toggles ---
        if (compHit.type === 'push_button') {
          compHit.runtimeState = compHit.runtimeState || {};
          if (this._isMomentaryButton(compHit)) {
            compHit.runtimeState.pressed = true;
            this._pointerHeldButton = compHit;
          } else {
            compHit.runtimeState.pressed = !compHit.runtimeState.pressed;
          }
        }
        // ------------------------------------------------

        this.mode = 'dragging';
        this.dragging = {
          inst: compHit,
          offsetX: world.x - compHit.x,
          offsetY: world.y - compHit.y,
          startX: compHit.x,
          startY: compHit.y,
          moved: false,
        };
        return;
      }

      // Click on empty space — deselect
      this._selectAll(false);
      this.selected = null;
      this.selectedWire = null;
      this._notifySelectionChange();

      // Start pan
      this.mode = 'panning';
      this.canvas.style.cursor = 'grabbing';
    }
  }

  _onMouseMove(e) {
    const world = this._toWorld(e.offsetX, e.offsetY);
    this._updateCoords(e.offsetX, e.offsetY, world);

    if (this.mode === 'panning') {
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this.panX += dx;
      this.panY += dy;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._hidePinTooltip();
      this._hideWireTooltip();
      this._positionQuickControls(this.selected);
      return;
    }

    if (this.mode === 'annotationDragging' && this.draggingAnnotation) {
      const { annotation } = this.draggingAnnotation;
      const newX = this._snap(world.x - this.draggingAnnotation.offsetX);
      const newY = this._snap(world.y - this.draggingAnnotation.offsetY);
      if (newX !== annotation.x || newY !== annotation.y) {
        if (!this.draggingAnnotation.historyPushed) {
          this._pushHistory();
          this.draggingAnnotation.historyPushed = true;
        }
        annotation.x = newX;
        annotation.y = newY;
        this.draggingAnnotation.moved = true;
      }
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._hidePinTooltip();
      return;
    }

    if (this.mode === 'componentLabelDragging' && this.draggingComponentLabel) {
      const dx = world.x - this.draggingComponentLabel.startMouseX;
      const dy = world.y - this.draggingComponentLabel.startMouseY;
      const newOffsetX = this._snap(this.draggingComponentLabel.startOffsetX + dx);
      const newOffsetY = this._snap(this.draggingComponentLabel.startOffsetY + dy);
      const inst = this.draggingComponentLabel.inst;
      inst.props = inst.props || {};
      if (newOffsetX !== (inst.props.labelOffsetX || 0) || newOffsetY !== (inst.props.labelOffsetY || 0)) {
        if (!this.draggingComponentLabel.historyPushed) {
          this._pushHistory();
          this.draggingComponentLabel.historyPushed = true;
        }
        inst.props.labelOffsetX = newOffsetX;
        inst.props.labelOffsetY = newOffsetY;
        this.draggingComponentLabel.moved = true;
      }
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._hidePinTooltip();
      return;
    }

    if (this.mode === 'dragging' && this.dragging) {
      const newX = this._snap(world.x - this.dragging.offsetX);
      const newY = this._snap(world.y - this.dragging.offsetY);
      this.dragging.inst.x = newX;
      this.dragging.inst.y = newY;
      this.dragging.moved = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._hidePinTooltip();
      this._hideWireTooltip();
      this._positionQuickControls(this.dragging.inst);
      return;
    }

    if (this.mode === 'sliderdrag' && this.sliderDrag) {
      this._updateSliderValue(this.sliderDrag, world.x, world.y);
      return;
    }

    if (this.mode === 'wiredrag' && this.draggingWire) {
      const wire = this.wires.find(w => w.id === this.draggingWire.wireId);
      if (!wire) return;

      this.draggingWire.moved = true;
      const snapX = this._snap(world.x);
      const snapY = this._snap(world.y);

      // Case 0: Dragging a bezier control point
      if (this.draggingWire.bezierCtrl >= 0 && wire.routeStyle === 'bezier') {
        if (!wire.bezierCtrl) {
          const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
          const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
          const d1 = this._getPinExitDir(wire.from.instId, wire.from.pinId);
          const d2 = this._getPinExitDir(wire.to.instId, wire.to.pinId);
          wire.bezierCtrl = this._autoBezierCtrl(p1, d1, p2, d2);
        }
        const ctrlIdx = this.draggingWire.bezierCtrl;
        if (ctrlIdx === 0) {
          wire.bezierCtrl.c1.x = snapX;
          wire.bezierCtrl.c1.y = snapY;
        } else {
          wire.bezierCtrl.c2.x = snapX;
          wire.bezierCtrl.c2.y = snapY;
        }
        this._render();
        return;
      }

      const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
      const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
      if (!p1 || !p2) return;

      // Case 0b: Dragging a bezier wire segment (not a control point)
      if (wire.routeStyle === 'bezier' && this.draggingWire.handleIdx < 0 && this.draggingWire.bezierCtrl < 0) {
        if (!wire.bezierCtrl) {
          const d1 = this._getPinExitDir(wire.from.instId, wire.from.pinId);
          const d2 = this._getPinExitDir(wire.to.instId, wire.to.pinId);
          wire.bezierCtrl = this._autoBezierCtrl(p1, d1, p2, d2);
        }
        const dx = snapX - this.draggingWire.startWorld.x;
        const dy = snapY - this.draggingWire.startWorld.y;
        if (this.draggingWire.initialBezierCtrl) {
          wire.bezierCtrl.c1.x = this.draggingWire.initialBezierCtrl.c1.x + dx;
          wire.bezierCtrl.c1.y = this.draggingWire.initialBezierCtrl.c1.y + dy;
          wire.bezierCtrl.c2.x = this.draggingWire.initialBezierCtrl.c2.x + dx;
          wire.bezierCtrl.c2.y = this.draggingWire.initialBezierCtrl.c2.y + dy;
        }
        this._render();
        return;
      }

      // Case 1: Dragging an existing waypoint handle directly
      if (this.draggingWire.handleIdx >= 0 && wire.waypoints && wire.waypoints[this.draggingWire.handleIdx]) {
        wire.waypoints[this.draggingWire.handleIdx].x = snapX;
        wire.waypoints[this.draggingWire.handleIdx].y = snapY;
        this._render();
        return;
      }

      // Case 2: Dragging a segment
      const initPts = [p1, ...this.draggingWire.initialWaypoints.map(p => ({ x: p.x, y: p.y })), p2];
      const segIdx = this.draggingWire.segIdx;

      if (segIdx >= 0 && segIdx < initPts.length - 1) {
        const a = initPts[segIdx];
        const b = initPts[segIdx + 1];
        const isHoriz = Math.abs(a.y - b.y) <= 2;
        const isVert = Math.abs(a.x - b.x) <= 2;

        if (isHoriz) {
          if (initPts.length === 2) {
            wire.waypoints = [
              { x: a.x, y: snapY },
              { x: b.x, y: snapY }
            ];
          } else if (segIdx === 0) {
            const nextWp = initPts[1];
            wire.waypoints = [
              { x: a.x, y: snapY },
              { x: nextWp.x, y: snapY },
              ...initPts.slice(2, -1)
            ];
          } else if (segIdx === initPts.length - 2) {
            const prevWp = initPts[initPts.length - 2];
            wire.waypoints = [
              ...initPts.slice(1, -2),
              { x: prevWp.x, y: snapY },
              { x: b.x, y: snapY }
            ];
          } else {
            const wps = this.draggingWire.initialWaypoints.map(p => ({ ...p }));
            const wpAIdx = segIdx - 1;
            const wpBIdx = segIdx;
            if (wps[wpAIdx]) wps[wpAIdx].y = snapY;
            if (wps[wpBIdx]) wps[wpBIdx].y = snapY;
            wire.waypoints = wps;
          }
        } else if (isVert) {
          if (initPts.length === 2) {
            wire.waypoints = [
              { x: snapX, y: a.y },
              { x: snapX, y: b.y }
            ];
          } else if (segIdx === 0) {
            const nextWp = initPts[1];
            wire.waypoints = [
              { x: snapX, y: a.y },
              { x: snapX, y: nextWp.y },
              ...initPts.slice(2, -1)
            ];
          } else if (segIdx === initPts.length - 2) {
            const prevWp = initPts[initPts.length - 2];
            wire.waypoints = [
              ...initPts.slice(1, -2),
              { x: snapX, y: prevWp.y },
              { x: snapX, y: b.y }
            ];
          } else {
            const wps = this.draggingWire.initialWaypoints.map(p => ({ ...p }));
            const wpAIdx = segIdx - 1;
            const wpBIdx = segIdx;
            if (wps[wpAIdx]) wps[wpAIdx].x = snapX;
            if (wps[wpBIdx]) wps[wpBIdx].x = snapX;
            wire.waypoints = wps;
          }
        } else {
          if (segIdx === 0) {
            wire.waypoints = [{ x: snapX, y: snapY }, ...initPts.slice(2, -1)];
          } else {
            const wps = this.draggingWire.initialWaypoints.map(p => ({ ...p }));
            if (wps[segIdx - 1]) {
              wps[segIdx - 1].x = snapX;
              wps[segIdx - 1].y = snapY;
            }
            wire.waypoints = wps;
          }
        }
      }

      this._render();
      return;
    }

    if (this.mode === 'wiring') {
      this.wireMouse = world;
      this._hidePinTooltip();
      this._hideWireTooltip();
      return;
    }

    if (this.mode === 'placing') {
      this.placingMouse = world;
      this._hidePinTooltip();
      this._hideWireTooltip();
      return;
    }
    if (this.mode === 'placingText') {
      this.placingMouse = world;
      this._hidePinTooltip();
      this._hideWireTooltip();
      return;
    }

    // Hover cursor + pin tooltip
    const tagHover = this._hitTestTag(world.x, world.y);
    const pin = tagHover ? null : this._hitTestPin(world.x, world.y);
    const boardResetHover = this._hitTestBoardReset(world.x, world.y);
    const comp = this._hitTestComp(world.x, world.y);
    const wireDetail = this._hitTestWireDetails(world.x, world.y);
    const irRemoteHover = this._hitTestIrRemoteHover(world.x, world.y);

    // Update IR Remote hover state
    for (const inst of this.components) {
      if (inst.type === 'ir_remote') {
        const wasHovered = inst.runtimeState?._hovered;
        inst.runtimeState = inst.runtimeState || {};
        inst.runtimeState._hovered = (irRemoteHover === inst);
        if (wasHovered !== inst.runtimeState._hovered) this._render();
      }
      if (inst.type === 'sd_card') {
        const wasHovered = inst.runtimeState?._hovered;
        inst.runtimeState = inst.runtimeState || {};
        inst.runtimeState._hovered = (comp === inst);
        if (wasHovered !== inst.runtimeState._hovered) this._render();
      }
    }

    if (tagHover) {
      this.canvas.style.cursor = 'pointer';
      this._hidePinTooltip();
      this._hideWireTooltip();
    } else if (pin) {
      this.canvas.style.cursor = 'crosshair';
      this._hideWireTooltip();
      this._showPinTooltip(pin, e);
    } else if (boardResetHover) {
      this.canvas.style.cursor = 'pointer';
      this._hidePinTooltip();
      this._hideWireTooltip();
    } else if (irRemoteHover || this._hitTestInlineToggle(world.x, world.y) || this._hitTestMb102Jumper(world.x, world.y)) {
      this.canvas.style.cursor = 'pointer';
      this._hidePinTooltip();
      this._hideWireTooltip();
    } else {
      this._hidePinTooltip();
      if (this._hitTestAnnotation(world.x, world.y)) {
        this.canvas.style.cursor = 'move';
        this._hideWireTooltip();
      } else if (this._hitTestComponentLabel(world.x, world.y)) {
        this.canvas.style.cursor = 'move';
        this._hideWireTooltip();
      } else if (comp) {
        this.canvas.style.cursor = 'move';
        this._hideWireTooltip();
      } else if (wireDetail) {
        this.canvas.style.cursor = 'grab';
        this._showWireTooltip(wireDetail.wire, e);
      } else {
        this.canvas.style.cursor = '';
        this._hideWireTooltip();
      }
    }
  }

  _onMouseUp(e) {
    if (this.mode === 'annotationDragging' && this.draggingAnnotation) {
      if (this.draggingAnnotation.moved) this._onChanged();
      if (this.draggingAnnotation.moved) this._pushHistory();
      this.mode = 'idle';
      this.draggingAnnotation = null;
      this.canvas.style.cursor = '';
    }
    if (this.mode === 'componentLabelDragging' && this.draggingComponentLabel) {
      if (this.draggingComponentLabel.moved) this._onChanged();
      if (this.draggingComponentLabel.moved) this._pushHistory();
      this.mode = 'idle';
      this.draggingComponentLabel = null;
      this.canvas.style.cursor = '';
    }
    if (this.mode === 'dragging' && this.dragging) {
      const dragged = this.dragging.inst;
      // A momentary button opens the instant the pointer comes back up.
      if (dragged && dragged.type === 'push_button' && this._isMomentaryButton(dragged)) {
        this._setPushButton(dragged, false);
      }
      this._pointerHeldButton = null;
      if (this.dragging.moved) {
        if (dragged && (dragged.type === 'logic_level_in' || dragged.type === 'logic_level_out')) {
          this._tryAttachTag(dragged);
        }
        this._pushHistory();
        this._onChanged();
      } else if (dragged && dragged.type === 'logic_level_in') {
        // Click without moving — toggle the input tag's level
        this._toggleLogicTag(dragged);
      } else if (dragged && dragged.type === 'slide_switch') {
        // Click without moving — slide the actuator to the other throw
        this._toggleSlideSwitch(dragged);
      }
      this.mode = 'idle';
      this.dragging = null;
    }
    if (this.mode === 'panning') {
      this.mode = 'idle';
      this.canvas.style.cursor = '';
    }
    if (this.mode === 'sliderdrag') {
      this.mode = 'idle';
      this.sliderDrag = null;
    }
    // Release any held board reset button if needed
    if (this.components) {
      for (const c of this.components) {
        if (c.runtimeState && c.runtimeState._resetPressed && !c.runtimeState._resetReleaseTimer) {
          c.runtimeState._resetPressed = false;
          this._render();
        }
      }
    }
    if (this.mode === 'wiredrag' && this.draggingWire) {
      const wire = this.wires.find(w => w.id === this.draggingWire.wireId);
      if (wire) {
        this._simplifyWaypoints(wire);
      }
      if (this.draggingWire.moved) {
        this._pushHistory();
        this._onChanged();
      }
      this.mode = 'idle';
      this.draggingWire = null;
      this.canvas.style.cursor = '';
    }
    this._notifySelectionChange();
  }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = this._toWorld(mx, my);

    // 1. Check if hovering over an interactive slider
    const sliderHit = this._hitTestSlider(world.x, world.y);
    if (sliderHit) {
      this._onWheelSlider(sliderHit, e.deltaY);
      return;
    }

    // 2. Check if hovering over a component body that has an interactive value (e.g. potentiometer dial)
    const comp = this._hitTestComp(world.x, world.y);
    if (comp) {
      const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
      const def = defs && defs[comp.type];
      if (def && Array.isArray(def.interactive) && def.interactive.length > 0) {
        const ctrl = def.interactive.find(c => (!c.type || c.type === 'range') && c.field === 'value')
          || def.interactive.find(c => (!c.type || c.type === 'range'));
        if (ctrl) {
          this._onWheelSlider({ inst: comp, ctrl, rect: null }, e.deltaY);
          return;
        }
      }
    }

    // Default: zoom around mouse position
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    this.panX -= (mx - this.panX) * (factor - 1);
    this.panY -= (my - this.panY) * (factor - 1);
    this.zoom = Math.max(0.1, Math.min(4, this.zoom * factor));

    this._updateZoomDisplay();
  }

  _onDblClick(e) {
    const world = this._toWorld(e.offsetX, e.offsetY);
    const annotation = this._hitTestAnnotation(world.x, world.y);
    if (annotation) {
      const text = window.prompt('Edit annotation text:', annotation.text);
      if (text !== null && text.trim() && text !== annotation.text) {
        this._pushHistory();
        annotation.text = text;
        this._pushHistory();
        this._onChanged();
      }
      return;
    }
    const compLabelHit = this._hitTestComponentLabel(world.x, world.y);
    if (compLabelHit) {
      const inst = compLabelHit.inst;
      const def = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS
        ? window.ArduinoComponents.COMPONENT_DEFS[inst.type]
        : null;
      const curText = inst.props?.label || (def ? def.name : inst.type);
      const newText = window.prompt('Edit component label:', curText);
      if (newText !== null) {
        const trimmed = newText.trim();
        inst.props = inst.props || {};
        if (trimmed !== (inst.props.label || '')) {
          this._pushHistory();
          inst.props.label = trimmed;
          this._pushHistory();
          this._onChanged();
          this._render();
        }
      }
      return;
    }
    const comp = this._hitTestComp(world.x, world.y);
    if (comp && window.App) {
      if (comp.type === 'dso_4ch') {
        window.App.openDSOFullscreen(comp);
        return;
      }
      if (comp.type === 'hc05') {
        if (window.BluetoothPhoneModal) {
          window.BluetoothPhoneModal.open(comp);
        } else if (window.App.openBluetoothPhoneModal) {
          window.App.openBluetoothPhoneModal(comp);
        }
        return;
      }
      window.App.openPropsModal(comp);
    }
  }

  _onContextMenu(e) {
    e.preventDefault();
    const world = this._toWorld(e.offsetX, e.offsetY);
    // Right-click on a forced input tag releases its force (no menu)
    const tagHit = this._hitTestTag(world.x, world.y);
    if (tagHit && this._releaseLogicTag(tagHit.inst)) return;
    const annotation = this._hitTestAnnotation(world.x, world.y);
    if (annotation) {
      this._selectAll(false);
      annotation.selected = true;
      this.selectedAnnotation = annotation;
      this.selected = null;
      this.selectedWire = null;
      this.selectedComponentLabel = null;
      if (this.onContextMenu) {
        this.onContextMenu({ type: 'annotation', id: annotation.id, annotation }, e.clientX, e.clientY);
      }
      return;
    }
    const compLabelHit = this._hitTestComponentLabel(world.x, world.y);
    if (compLabelHit) {
      this._selectAll(false);
      compLabelHit.inst.selected = true;
      this.selected = compLabelHit.inst;
      this.selectedWire = null;
      this.selectedAnnotation = null;
      this.selectedComponentLabel = compLabelHit.inst;
      if (this.onContextMenu) {
        this.onContextMenu(compLabelHit.inst, e.clientX, e.clientY);
      }
      return;
    }
    const comp = this._hitTestComp(world.x, world.y);
    const wire = this._hitTestWire(world.x, world.y);
    if (comp) {
      this._selectAll(false);
      comp.selected = true;
      this.selected = comp;
      this.selectedWire = null;
      this.selectedComponentLabel = null;
    } else if (wire) {
      this._selectAll(false);
      this.selectedWire = wire;
      this.selected = null;
      this.selectedComponentLabel = null;
    }
    if (this.onContextMenu) {
      this.onContextMenu(comp || (wire ? { type: 'wire', id: wire.id, wire } : null), e.clientX, e.clientY);
    }
  }

  // Release whatever a momentary push button the keyboard is holding. Key repeat
  // is irrelevant here — only the first keyup of Space/Enter after a press counts.
  _onKeyUp(e) {
    const t = e.target;
    if (t && typeof t.closest === 'function' && t.closest('#editor-container')) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (this._keyHeldButton) {
      this._setPushButton(this._keyHeldButton, false);
      this._keyHeldButton = null;
    }
  }

  _onKeyDown(e) {
    // Only handle when canvas is in focus (not in editor)
    const t = e.target;
    if (t && typeof t.closest === 'function' && t.closest('#editor-container')) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    // Ignore canvas shortcuts when modal or command palette is open
    const overlay = document.getElementById('modal-overlay');
    if (overlay && !overlay.classList.contains('hidden')) return;
    const cmdPalette = document.getElementById('command-palette-backdrop');
    if (cmdPalette && !cmdPalette.classList.contains('hidden')) return;

    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

    // Prevent repeated actions when key is held down (allow held arrow nudging)
    if (e.repeat && !e.ctrlKey && !e.metaKey && !isArrow) return;

    // Arrow keys nudge selected components (Shift: 10px snap step, without Shift: fine 2px)
    if (isArrow && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -1;
      else if (e.key === 'ArrowDown') dy = 1;
      else if (e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'ArrowRight') dx = 1;
      this.nudgeSelected(dx, dy, e.shiftKey);
      return;
    }

    // Tab / Shift+Tab cycling between components and pins
    if (e.key === 'Tab') {
      e.preventDefault();
      this.cycleSelection(e.shiftKey);
      return;
    }

    // [ and ] direct component-only cycling (bracket navigation)
    if ((e.key === '[' || e.key === ']') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.cycleComponentOnly(e.key === '[');
      return;
    }

    // W hotkey for wiring
    if ((e.key === 'w' || e.key === 'W') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.startWiringFromSelectedPin();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelected(); }
    if (e.key === 'r' || e.key === 'R') { this.rotateSelected(); }
    if ((e.key === ' ' || e.key === 'Enter') && this.selected && this.selected.type === 'push_button') {
      e.preventDefault();
      if (this._isMomentaryButton(this.selected)) {
        this._setPushButton(this.selected, true);
        this._keyHeldButton = this.selected;
      } else {
        this._setPushButton(this.selected, !this.selected.runtimeState?.pressed);
      }
    }
    if ((e.key === ' ' || e.key === 'Enter') && this.selected && this.selected.type === 'slide_switch') {
      e.preventDefault();
      this._toggleSlideSwitch(this.selected);
    }
    if (e.key === 'Escape') {
      if (this.mode === 'placing' || this.mode === 'placingText') this.cancelPlacing();
      if (this.mode === 'wiring') this._endWiring();
      this._selectAll(false);
      this.selected = null;
      this.selectedPin = null;
      this.selectedWire = null;
      this.selectedAnnotation = null;
      this._render();
    }
    if (e.key === 'f' || e.key === 'F') { this.fitView(); }
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) { this.toggleMinimap(); }
    if (e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); this.toggleCurrentAnimation(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'c') { this.copySelected(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'v') { this.paste(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSelected(); }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); this.redo(); }
    if (e.ctrlKey && e.key === 'a') { e.preventDefault(); this.selectAll(); }
  }

  /* -------------- KEYBOARD NAVIGATION -------------- */
  _getNavigationTargets() {
    const { COMPONENT_DEFS } = window.ArduinoComponents || {};
    const targets = [];
    for (const inst of this.components) {
      targets.push({ type: 'component', inst, pin: null });
      const def = COMPONENT_DEFS ? COMPONENT_DEFS[inst.type] : null;
      if (def && Array.isArray(def.pins)) {
        for (const pin of def.pins) {
          targets.push({ type: 'pin', inst, pin });
        }
      }
    }
    return targets;
  }

  cycleSelection(reverse = false) {
    let targets = this._getNavigationTargets();
    if (this.mode === 'wiring') {
      targets = targets.filter(t => t.type === 'pin');
    }
    if (targets.length === 0) return;

    let currentIndex = -1;
    if (this.selectedPin) {
      currentIndex = targets.findIndex(t => t.type === 'pin' && t.inst.id === this.selectedPin.inst.id && t.pin.id === this.selectedPin.pin.id);
    } else if (this.selected) {
      currentIndex = targets.findIndex(t => t.type === 'component' && t.inst.id === this.selected.id);
    }

    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = reverse ? targets.length - 1 : 0;
    } else {
      nextIndex = reverse ? (currentIndex - 1 + targets.length) % targets.length : (currentIndex + 1) % targets.length;
    }

    const target = targets[nextIndex];
    this._selectAll(false);
    this.selected = target.inst;
    target.inst.selected = true;
    this.selectedWire = null;
    this.selectedAnnotation = null;

    if (target.type === 'pin') {
      this.selectedPin = { inst: target.inst, pin: target.pin };
      if (this.mode === 'wiring') {
        const wp = this._pinWorldPos(target.inst, target.pin);
        this.wireMouse = { x: wp.x, y: wp.y };
      }
      this._ensureVisible(target.inst, target.pin);
    } else {
      this.selectedPin = null;
      this._ensureVisible(target.inst);
    }

    this._notifySelectionChange();
    this._render();
  }

  cycleComponentOnly(reverse = false) {
    if (!this.components || this.components.length === 0) return;
    let currentIndex = -1;
    if (this.selected) {
      currentIndex = this.components.findIndex(c => c.id === this.selected.id);
    } else if (this.selectedPin) {
      currentIndex = this.components.findIndex(c => c.id === this.selectedPin.inst.id);
    }

    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = reverse ? this.components.length - 1 : 0;
    } else {
      nextIndex = reverse ? (currentIndex - 1 + this.components.length) % this.components.length : (currentIndex + 1) % this.components.length;
    }

    const nextComp = this.components[nextIndex];
    this._selectAll(false);
    nextComp.selected = true;
    this.selected = nextComp;
    this.selectedPin = null;
    this.selectedWire = null;
    this.selectedAnnotation = null;

    this._ensureVisible(nextComp);
    this._notifySelectionChange();
    this._render();
  }

  nudgeSelected(dx, dy, isSnap = false) {
    const selComps = this.components.filter(c => c.selected);
    if (selComps.length === 0 && this.selected) selComps.push(this.selected);
    if (selComps.length === 0) return;

    if (!this._nudgeHistoryPushed) {
      this._pushHistory();
      this._nudgeHistoryPushed = true;
    }
    if (this._nudgeTimer) clearTimeout(this._nudgeTimer);
    this._nudgeTimer = setTimeout(() => {
      this._nudgeHistoryPushed = false;
      this._onChanged();
    }, 250);

    const step = isSnap ? 10 : 2;
    for (const comp of selComps) {
      if (isSnap) {
        if (dx !== 0) comp.x = Math.round((comp.x + dx * step) / step) * step;
        if (dy !== 0) comp.y = Math.round((comp.y + dy * step) / step) * step;
      } else {
        comp.x += dx * step;
        comp.y += dy * step;
      }
    }

    this._positionQuickControls(this.selected);
    this._render();
  }

  startWiringFromSelectedPin() {
    if (this.mode === 'wiring') {
      if (this.selectedPin && this.wiringFrom && this.selectedPin.inst.id !== this.wiringFrom.inst.id) {
        this.addWire(this.wiringFrom.inst.id, this.wiringFrom.pin.id, this.selectedPin.inst.id, this.selectedPin.pin.id);
        this._endWiring();
        this._render();
        return;
      }
      this._endWiring();
      this._render();
      return;
    }

    if (!this.selectedPin && this.selected) {
      const { COMPONENT_DEFS } = window.ArduinoComponents || {};
      const def = COMPONENT_DEFS ? COMPONENT_DEFS[this.selected.type] : null;
      if (def && Array.isArray(def.pins) && def.pins.length > 0) {
        this.selectedPin = { inst: this.selected, pin: def.pins[0] };
      }
    }

    if (!this.selectedPin) return;

    const wp = this._pinWorldPos(this.selectedPin.inst, this.selectedPin.pin);
    this._startWiring(this.selectedPin.inst, this.selectedPin.pin, wp.x, wp.y);
    this._render();
  }

  _ensureVisible(inst, pin = null) {
    if (!this.canvas) return false;
    const target = pin ? this._pinWorldPos(inst, pin) : { x: inst.x, y: inst.y };
    if (!target) return false;
    const cw = this.canvas.width || 800;
    const ch = this.canvas.height || 600;
    const sx = target.x * this.zoom + this.panX;
    const sy = target.y * this.zoom + this.panY;
    const margin = 80;

    let panChanged = false;
    if (sx < margin) {
      this.panX += (margin - sx);
      panChanged = true;
    } else if (sx > cw - margin) {
      this.panX -= (sx - (cw - margin));
      panChanged = true;
    }
    if (sy < margin) {
      this.panY += (margin - sy);
      panChanged = true;
    } else if (sy > ch - margin) {
      this.panY -= (sy - (ch - margin));
      panChanged = true;
    }
    return panChanged;
  }

  /* -------------- WIRING -------------- */
  _startWiring(inst, pin, wx, wy) {
    this.mode = 'wiring';
    this.wiringFrom = { inst, pin, wx, wy };
    this.wireMouse = { x: wx, y: wy };
    const hint = document.getElementById('wiring-hint');
    if (hint) hint.classList.remove('hidden');
    this.canvas.style.cursor = 'crosshair';
    this._notifySelectionChange();
  }

  _endWiring() {
    this.mode = 'idle';
    this.wiringFrom = null;
    this.wireMouse = null;
    this.canvas.style.cursor = '';
    const hint = document.getElementById('wiring-hint');
    if (hint) hint.classList.add('hidden');
    this._notifySelectionChange();
  }

  _notifySelectionChange() {
    this._updateQuickControls();
    if (typeof this.onSelectionChange === 'function') {
      try {
        this.onSelectionChange({
          selected: this.selected,
          selectedWire: this.selectedWire,
          selectedAnnotation: this.selectedAnnotation,
          mode: this.mode,
          placingType: this.placingType,
          wiringFrom: this.wiringFrom
        });
      } catch (_) {}
    }
  }

  /* -------------- HIT TESTING -------------- */
  _hitTestPin(wx, wy) {
    const { COMPONENT_DEFS } = window.ArduinoComponents;
    const isTouch = this._touchActive || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
    const radius = isTouch ? Math.max(16, 22 / this.zoom) : Math.max(8, 10 / this.zoom);

    for (const inst of [...this.components].reverse()) {
      const def = COMPONENT_DEFS[inst.type];
      if (!def) continue;
      let nearest = null;
      let nearestDistance = radius;
      for (const pin of def.pins) {
        const wp = this._pinWorldPos(inst, pin);
        const px = wp.x;
        const py = wp.y;
        const dist = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2);
        if (dist <= radius && (!nearest || dist < nearestDistance)) {
          nearest = { inst, pin, worldX: px, worldY: py };
          nearestDistance = dist;
        }
      }
      if (nearest) return nearest;
    }
    return null;
  }

  /* -------------- PIN TOOLTIP -------------- */
  _pinTypeLabel(type) {
    const map = {
      digital: 'Digital I/O',
      pwm: 'PWM (Digital)',
      analog: 'Analog In (A/D)',
      power: 'Power',
      gnd: 'Ground',
      signal: 'Signal',
    };
    return map[type] || type;
  }

  _showPinTooltip(hit, e) {
    if (this.mode !== 'idle') return;
    if (!this.tooltipEl) this.tooltipEl = document.getElementById('pin-tooltip');
    const el = this.tooltipEl;
    if (!el) return;

    const { inst, pin } = hit;
    const key = `${inst.id}|${pin.id}`;
    const def = window.ArduinoComponents.COMPONENT_DEFS[inst.type];
    const typeLabel = this._pinTypeLabel(pin.type);
    const pinNum = this._pinToNumber(pin.id);
    const sim = window.ArduinoSim;
    const running = !!(sim && sim.isRunning);

    // Rebuild content only when hovering a different pin
    if (key !== this._tipKey) {
      this._tipKey = key;
      el.innerHTML = '';
      const frag = document.createDocumentFragment();

      const compName = (inst.props && inst.props.label)
        ? inst.props.label
        : ((def && def.name) || inst.type);
      const title = document.createElement('div');
      title.className = 'pin-tip-title';
      title.textContent = `${compName} · ${pin.label}`;
      frag.appendChild(title);

      const addRow = (k, v, cls) => {
        const row = document.createElement('div');
        row.className = 'pin-tip-row';
        const kEl = document.createElement('span');
        kEl.textContent = k;
        const vEl = document.createElement('b');
        vEl.textContent = v;
        if (cls) vEl.className = cls;
        row.appendChild(kEl);
        row.appendChild(vEl);
        frag.appendChild(row);
      };

      addRow('Type', typeLabel);
      // Pin function description from the guide reference
      const pinDoc = window.GuidePinDescs && window.GuidePinDescs[inst.type];
      if (pinDoc) {
        if (pinDoc[pin.id] && pinDoc[pin.id].desc) {
          addRow('Function', pinDoc[pin.id].desc);
        } else {
          // Board-style grouped pins (e.g. D0—D13, VP / VN): find a matching group
          const match = Object.entries(pinDoc).find(([k, v]) =>
            v.label && this._pinMatchesGroup(pin.id, v.label));
          if (match && match[1].desc) addRow('Function', match[1].desc);
        }
      }
      if (inst.type === 'esp32_devkit_v1') {
        const espAliases = { VP: 36, VN: 39, TX0: 1, RX0: 3, EN: 0 };
        if (pin.id in espAliases || /^D\d+$/.test(pin.id)) {
          addRow('GPIO', pinNum);
        }
      } else if ((inst.type === 'arduino_uno' || inst.type === 'arduino_nano') && /^[AD]\d+$/.test(pin.id)) {
        addRow('Arduino Pin', pinNum);
      } else if (inst.type === 'npn_transistor' || inst.type === 'pnp_transistor') {
        const rs = inst.runtimeState || {};
        const reg = (rs.region || (rs.conducting ? 'active' : 'cutoff')).toUpperCase();
        const regCls = reg === 'SATURATION' ? 'pin-tip-high' : (reg === 'ACTIVE' ? 'pin-tip-high' : 'pin-tip-low');
        addRow('Operating Region', reg, regCls);
        const engine = this.engine;
        if (engine) {
          const v = engine.getVoltageAtPin(inst.id, pin.id);
          if (v != null) addRow('Pin Voltage', v.toFixed(3) + ' V');
        }
        if (pin.id === 'base') {
          const ib = rs.ib || 0;
          addRow('Base Current Ib', ib >= 1e-3 ? (ib * 1e3).toFixed(2) + ' mA' : (ib * 1e6).toFixed(1) + ' µA');
        } else if (pin.id === 'collector') {
          const ic = rs.ic || 0;
          addRow('Collector Current Ic', ic >= 1 ? ic.toFixed(2) + ' A' : (ic * 1e3).toFixed(2) + ' mA');
        } else if (pin.id === 'emitter') {
          const ie = rs.ie || 0;
          addRow('Emitter Current Ie', ie >= 1 ? ie.toFixed(2) + ' A' : (ie * 1e3).toFixed(2) + ' mA');
        }
      } else if (inst.type === 'n_mosfet' || inst.type === 'p_mosfet' || inst.type === 'n_channel_mosfet' || inst.type === 'p_channel_mosfet'
        || inst.type === 'n_jfet' || inst.type === 'p_jfet' || inst.type === 'n_channel_jfet' || inst.type === 'p_channel_jfet') {
        const rs = inst.runtimeState || {};
        const reg = (rs.region || (rs.conducting ? 'linear' : 'cutoff')).toUpperCase();
        const regCls = (reg === 'LINEAR' || reg === 'OHMIC' || reg === 'SATURATION') ? 'pin-tip-high' : 'pin-tip-low';
        addRow('Operating Region', reg, regCls);
        const engine = this.engine;
        if (engine) {
          const v = engine.getVoltageAtPin(inst.id, pin.id);
          if (v != null) addRow('Pin Voltage', v.toFixed(3) + ' V');
        }
        if (rs.vgs != null) addRow('Vgs', rs.vgs.toFixed(3) + ' V');
        if (rs.vds != null) addRow('Vds', rs.vds.toFixed(3) + ' V');
        if (pin.id === 'gate') {
          const ig = rs.ig || 0;
          addRow('Gate Current Ig', Math.abs(ig) >= 1e-3 ? (ig * 1e3).toFixed(2) + ' mA' : (ig * 1e6).toFixed(1) + ' µA');
        } else if (pin.id === 'drain') {
          const id = rs.id || 0;
          addRow('Drain Current Id', id >= 1 ? id.toFixed(2) + ' A' : (id * 1e3).toFixed(2) + ' mA');
        } else if (pin.id === 'source') {
          const isCurr = rs.is_current ?? rs.id ?? 0;
          addRow('Source Current Is', isCurr >= 1 ? isCurr.toFixed(2) + ' A' : (isCurr * 1e3).toFixed(2) + ' mA');
        }
      } else if (inst.type === 'potentiometer') {
        const rs = inst.runtimeState || {};
        const maxVal = Math.max(1, Number(inst.props?.maxValue) || 1023);
        const rawVal = Number(rs.value ?? inst.props?.value ?? 512);
        const pct = Math.round((rawVal / maxVal) * 100);
        const rTotal = rs.r_total || 10000;
        const r1W = rs.r_1w || (rTotal * (1 - rawVal / maxVal));
        const rW2 = rs.r_w2 || (rTotal * (rawVal / maxVal));

        const fmtR = (r) => r >= 1e6 ? (r / 1e6).toFixed(1) + ' MΩ' : (r >= 1e3 ? (r / 1e3).toFixed(1) + ' kΩ' : Math.round(r) + ' Ω');

        addRow('Track Resistance', fmtR(rTotal));
        addRow('Wiper Position', `${pct}% (${rawVal}/${maxVal})`);
        if (pin.id === 'vcc' || pin.id === 'p1' || pin.id === 'cw' || pin.id === 't1') {
          addRow('Terminal', 'Pin 1 (Track Start)');
          addRow('R(Pin 1 - Wiper)', fmtR(r1W));
        } else if (pin.id === 'wiper' || pin.id === 'p2' || pin.id === 'out' || pin.id === 'w') {
          addRow('Terminal', 'Wiper');
          addRow('R(Wiper - Pin 2)', fmtR(rW2));
          addRow('R(Pin 1 - Wiper)', fmtR(r1W));
        } else if (pin.id === 'gnd' || pin.id === 'p3' || pin.id === 'ccw' || pin.id === 't2') {
          addRow('Terminal', 'Pin 2 (Track End)');
          addRow('R(Wiper - Pin 2)', fmtR(rW2));
        }
        if (this.engine) {
          const v = this.engine.getVoltageAtPin(inst.id, pin.id);
          if (v != null) addRow('Pin Voltage', v.toFixed(3) + ' V');
        }
      }
      if (running) {
        const val = sim.pinStates ? (sim.pinStates[`pin_${pinNum}`] || 0) : 0;
        if (pin.type === 'gnd') addRow('State', '0V', 'pin-tip-low');
        else if (pin.type === 'power') addRow('State', pin.label, 'pin-tip-high');
        else if (pin.type === 'pwm' && val > 0) addRow('State', `PWM ${val}`, 'pin-tip-high');
        else addRow('State', val > 0 ? 'HIGH' : 'LOW', val > 0 ? 'pin-tip-high' : 'pin-tip-low');
      } else {
        addRow('State', 'Idle');
      }

      // Active sketch reference count (Phase 2 Cross-Probing)
      const editorCode = (window.App?.editor?.getValue && typeof window.App.editor.getValue === 'function')
        ? window.App.editor.getValue()
        : (window.ArduinoSim?.sketch || '');
      if (editorCode) {
        const pinIdStr = pin.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const numStr = (pinNum !== null && Number.isFinite(pinNum)) ? String(pinNum) : '';
        const aliases = [pinIdStr];
        if (numStr && numStr !== pinIdStr) aliases.push(numStr);
        if (pin.id === 'D13' || pinNum === 13) aliases.push('LED_BUILTIN');
        const pattern = new RegExp(`\\b(${aliases.join('|')})\\b`, 'g');
        const matches = editorCode.match(pattern);
        const count = matches ? matches.length : 0;
        if (count > 0) {
          addRow('Sketch References', `${count} occurrence${count === 1 ? '' : 's'}`);
        }
      }

      if (this.engine) {
        const probeV = this.engine.getVoltageAtPin(inst.id, pin.id);
        if (probeV != null && inst.type !== 'potentiometer' && !inst.type.includes('transistor') && !inst.type.includes('fet')) {
          addRow('Live Voltage', probeV.toFixed(3) + ' V', probeV >= 2.5 ? 'pin-tip-high' : (probeV > 0.5 ? 'pin-tip-med' : 'pin-tip-low'));
        }
      }

      el.appendChild(frag);
    }

    // Follow cursor and clamp to viewport
    const pad = 14;
    el.classList.remove('hidden');
    el.style.left = `${e.clientX + pad}px`;
    el.style.top = `${e.clientY + pad}px`;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, e.clientX - r.width - pad)}px`;
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, e.clientY - r.height - pad)}px`;
  }

  _hidePinTooltip() {
    this._tipKey = null;
    if (this.tooltipEl) this.tooltipEl.classList.add('hidden');
  }

  _showWireTooltip(wire, e) {
    if (this.mode !== 'idle' || !wire) return;
    if (!this.wireTooltipEl) this.wireTooltipEl = document.getElementById('wire-tooltip');
    const el = this.wireTooltipEl;
    if (!el) return;

    const fromComp = this.components.find(c => c.id === wire.from?.instId);
    const toComp = this.components.find(c => c.id === wire.to?.instId);
    const fromDef = fromComp && window.ArduinoComponents?.COMPONENT_DEFS?.[fromComp.type];
    const toDef = toComp && window.ArduinoComponents?.COMPONENT_DEFS?.[toComp.type];
    const fromName = fromComp?.props?.label || fromDef?.name || wire.from?.instId || 'Net';
    const toName = toComp?.props?.label || toDef?.name || wire.to?.instId || 'Net';

    // Voltage telemetry
    let v = null;
    if (this.engine) {
      const vf = this.engine.getVoltageAtPin(wire.from?.instId, wire.from?.pinId);
      const vt = this.engine.getVoltageAtPin(wire.to?.instId, wire.to?.pinId);
      v = (vf != null) ? vf : vt;
    }

    const sim = window.ArduinoSim;
    let logicState = null;
    if (sim && sim.isRunning) {
      const pinNumFrom = this._pinToNumber(wire.from?.pinId);
      const pinNumTo = this._pinToNumber(wire.to?.pinId);
      const num = (pinNumFrom != null) ? pinNumFrom : pinNumTo;
      if (num != null && sim.pinStates) {
        const raw = sim.pinStates[`pin_${num}`];
        if (raw !== undefined) {
          if (raw === 0) logicState = 'LOW (0V)';
          else if (raw === 1 || raw === 255) logicState = 'HIGH (5V)';
          else logicState = `PWM (${raw}/255)`;
          if (v == null) {
            v = raw === 0 ? 0 : (raw === 1 ? 5 : (raw / 255 * 5));
          }
        }
      }
    }

    if (v == null) {
      const fromType = this._getPinType(wire.from?.instId, wire.from?.pinId);
      const toType = this._getPinType(wire.to?.instId, wire.to?.pinId);
      if (fromType === 'gnd' || toType === 'gnd') v = 0;
      else if (fromType === 'power' || toType === 'power') {
        if (wire.from?.pinId === '3V3' || wire.to?.pinId === '3V3') v = 3.3;
        else v = 5.0;
      }
    }

    const conducting = this._isWireConducting(wire);

    // Determine badge style
    let badgeCls = 'v-signal';
    let badgeText = 'SIGNAL';
    if (v != null) {
      if (v >= 3.0) {
        badgeCls = 'v-high';
        badgeText = `${v.toFixed(1)}V`;
      } else if (v > 0.5) {
        badgeCls = 'v-med';
        badgeText = `${v.toFixed(1)}V`;
      } else {
        badgeCls = 'v-low';
        badgeText = `${v.toFixed(1)}V`;
      }
    }

    el.innerHTML = `
      <div class="wire-tip-header">
        <span class="wire-tip-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Wire Probe
        </span>
        <span class="wire-tip-badge ${badgeCls}">${badgeText}</span>
      </div>
      <div class="pin-tip-row">
        <span>From</span><b>${fromName} · ${wire.from?.pinId || ''}</b>
      </div>
      <div class="pin-tip-row">
        <span>To</span><b>${toName} · ${wire.to?.pinId || ''}</b>
      </div>
      <div class="pin-tip-row">
        <span>Voltage</span><b>${v != null ? (v >= 0 ? v.toFixed(3) + ' V' : '0.000 V') : 'Floating'}</b>
      </div>
      ${logicState ? `<div class="pin-tip-row"><span>Logic</span><b>${logicState}</b></div>` : ''}
      <div class="pin-tip-row">
        <span>Current Flow</span><b style="color:${conducting ? '#00e676' : '#8b949e'}">${conducting ? 'Conducting (Live)' : 'Static / Low'}</b>
      </div>
      ${wire.color ? `<div class="pin-tip-row"><span>Color</span><b style="color:${wire.color}">● ${wire.color}</b></div>` : ''}
    `;

    const pad = 14;
    el.classList.remove('hidden');
    el.style.left = `${e.clientX + pad}px`;
    el.style.top = `${e.clientY + pad}px`;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, e.clientX - r.width - pad)}px`;
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, e.clientY - r.height - pad)}px`;
  }

  _hideWireTooltip() {
    if (this.wireTooltipEl) this.wireTooltipEl.classList.add('hidden');
  }

  _findInteractiveControl(inst) {
    if (!inst) return null;
    const def = window.ArduinoComponents?.COMPONENT_DEFS?.[inst.type];
    if (!def || !Array.isArray(def.interactive) || def.interactive.length === 0) return null;
    const slider = def.interactive.find(c => c.field && (c.min !== undefined && c.max !== undefined) && c.type !== 'toggle');
    if (slider) return slider;
    return def.interactive[0] || null;
  }

  _updateQuickControls() {
    if (!this.selected || this.selectedPin || this.selectedWire || this.selectedAnnotation) {
      this._hideQuickControls();
      return;
    }
    if (this._qcDismissedFor === this.selected.id) {
      return;
    }
    const ctrl = this._findInteractiveControl(this.selected);
    if (ctrl) {
      this._showQuickControls(this.selected, ctrl);
    } else {
      this._hideQuickControls();
    }
  }

  _showQuickControls(inst, ctrl) {
    if (!this.quickControlsEl) {
      this.quickControlsEl = document.getElementById('canvas-quick-controls');
    }
    const el = this.quickControlsEl;
    if (!el || !inst || !ctrl) return;

    this._qcTargetInst = inst;
    this._qcTargetCtrl = ctrl;

    const def = window.ArduinoComponents?.COMPONENT_DEFS?.[inst.type];
    const compLabel = inst.props?.label || def?.name || inst.type;
    const curVal = (inst.props && inst.props[ctrl.field] !== undefined)
      ? inst.props[ctrl.field]
      : (inst.runtimeState && inst.runtimeState[ctrl.field] !== undefined ? inst.runtimeState[ctrl.field] : (ctrl.min ?? 0));

    el.innerHTML = '';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'qc-icon';
    iconSpan.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    el.appendChild(iconSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'qc-name';
    nameSpan.textContent = ctrl.label || compLabel;
    nameSpan.title = compLabel;
    el.appendChild(nameSpan);

    const valSpan = document.createElement('span');
    valSpan.className = 'qc-val';
    const unit = ctrl.unit ? ` ${ctrl.unit}` : '';
    valSpan.textContent = `${curVal}${unit}`;

    if (ctrl.min !== undefined && ctrl.max !== undefined && ctrl.type !== 'toggle') {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'qc-slider';
      slider.min = ctrl.min;
      slider.max = ctrl.max;
      slider.step = ctrl.step || 1;
      slider.value = curVal;

      slider.addEventListener('mousedown', (e) => e.stopPropagation());
      slider.addEventListener('pointerdown', (e) => e.stopPropagation());
      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (!inst.props) inst.props = {};
        inst.props[ctrl.field] = val;
        if (!inst.runtimeState) inst.runtimeState = {};
        inst.runtimeState[ctrl.field] = val;
        valSpan.textContent = `${val}${unit}`;
        if (typeof this._onInteractiveInputChanged === 'function') {
          this._onInteractiveInputChanged(inst, ctrl.field, val);
        }
        this._onChanged();
        const propInput = document.querySelector(`.prop-input[name="${ctrl.field}"]`);
        if (propInput) {
          propInput.value = val;
        }
      });
      el.appendChild(slider);
    } else if (ctrl.type === 'toggle' || ctrl.type === 'button') {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn-xs';
      toggleBtn.style.padding = '2px 8px';
      toggleBtn.style.fontSize = '10px';
      toggleBtn.textContent = curVal ? 'ON' : 'OFF';
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = curVal ? 0 : 1;
        if (!inst.props) inst.props = {};
        inst.props[ctrl.field] = next;
        if (!inst.runtimeState) inst.runtimeState = {};
        inst.runtimeState[ctrl.field] = next;
        toggleBtn.textContent = next ? 'ON' : 'OFF';
        valSpan.textContent = next ? 'ON' : 'OFF';
        if (typeof this._onInteractiveInputChanged === 'function') {
          this._onInteractiveInputChanged(inst, ctrl.field, next);
        }
        this._onChanged();
      });
      el.appendChild(toggleBtn);
    }

    el.appendChild(valSpan);

    if (inst.type === 'hc05') {
      const phoneBtn = document.createElement('button');
      phoneBtn.className = 'btn-xs';
      phoneBtn.style.padding = '2px 8px';
      phoneBtn.style.fontSize = '10px';
      phoneBtn.style.marginLeft = '4px';
      phoneBtn.innerHTML = '📱 Phone';
      phoneBtn.title = 'Open Virtual Smartphone Controller';
      phoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.BluetoothPhoneModal?.open(inst);
      });
      el.appendChild(phoneBtn);
    }

    const closeBtn = document.createElement('span');
    closeBtn.className = 'qc-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Dismiss quick controls';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideQuickControls();
      this._qcDismissedFor = inst.id;
    });
    el.appendChild(closeBtn);

    el.classList.remove('hidden');
    this._positionQuickControls(inst);
  }

  _positionQuickControls(inst = this._qcTargetInst) {
    if (!this.quickControlsEl || this.quickControlsEl.classList.contains('hidden') || !inst) return;
    const def = window.ArduinoComponents?.COMPONENT_DEFS?.[inst.type];
    const w = def?.width || 40;
    const worldX = inst.x + w / 2;
    const worldY = inst.y;

    const screenX = worldX * this.zoom + this.panX;
    const screenY = worldY * this.zoom + this.panY;

    this.quickControlsEl.style.left = `${screenX}px`;
    this.quickControlsEl.style.top = `${screenY}px`;
  }

  _hideQuickControls() {
    this._qcTargetInst = null;
    this._qcTargetCtrl = null;
    if (this.quickControlsEl) {
      this.quickControlsEl.classList.add('hidden');
    }
  }

  _hitTestComp(wx, wy) {
    const { COMPONENT_DEFS } = window.ArduinoComponents;
    for (const inst of [...this.components].reverse()) {
      const def = COMPONENT_DEFS[inst.type];
      if (!def) continue;
      if (wx >= inst.x && wx <= inst.x + def.width &&
        wy >= inst.y && wy <= inst.y + def.height) {
        return inst;
      }
    }
    return null;
  }

  _hitTestWire(wx, wy) {
    const detail = this._hitTestWireDetails(wx, wy);
    return detail ? detail.wire : null;
  }

  _hitTestWireDetails(wx, wy) {
    const isTouch = this._touchActive || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
    const threshold = isTouch ? Math.max(12, 16 / this.zoom) : Math.max(6, 8 / this.zoom);
    let best = null;

    for (const wire of [...this.wires].reverse()) {
      const pathData = this._wirePath(wire);
      if (!pathData) continue;

      if (pathData.type === 'bezier') {
        const { p1, c1, c2, p2 } = pathData;

        // Check control point handles on selected bezier wire
        if (this.selectedWire && this.selectedWire.id === wire.id) {
          const distC1 = Math.hypot(wx - c1.x, wy - c1.y);
          if (distC1 <= threshold + 4) {
            return { wire, pathData, segIdx: -1, handleIdx: -1, bezierCtrl: 0, dist: distC1 };
          }
          const distC2 = Math.hypot(wx - c2.x, wy - c2.y);
          if (distC2 <= threshold + 4) {
            return { wire, pathData, segIdx: -1, handleIdx: -1, bezierCtrl: 1, dist: distC2 };
          }
        }

        // Check distance to bezier curve
        const d = this._distToBezier(wx, wy, p1, c1, c2, p2);
        if (d <= threshold) {
          if (!best || d < best.dist) {
            best = { wire, pathData, segIdx: 0, handleIdx: -1, bezierCtrl: -1, dist: d };
          }
        }
      } else {
        const pts = pathData.pts;
        if (!pts || pts.length < 2) continue;

        // Check waypoint handles if wire has waypoints
        if (wire.waypoints && Array.isArray(wire.waypoints)) {
          for (let j = 0; j < wire.waypoints.length; j++) {
            const wp = wire.waypoints[j];
            const dist = Math.hypot(wx - wp.x, wy - wp.y);
            if (dist <= threshold + 4) {
              return { wire, pathData, segIdx: -1, handleIdx: j, bezierCtrl: -1, dist };
            }
          }
        }

        // Check segments
        for (let i = 0; i < pts.length - 1; i++) {
          const d = this._distToSegment(wx, wy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
          if (d <= threshold) {
            if (!best || d < best.dist) {
              best = { wire, pathData, segIdx: i, handleIdx: -1, bezierCtrl: -1, dist: d };
            }
          }
        }
      }
    }
    return best;
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
    const nx = x1 + t * dx, ny = y1 + t * dy;
    return Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
  }

  /* -------------- UTILITIES -------------- */
  _toWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  _snap(v) { return Math.round(v / this.GRID) * this.GRID; }

  _selectAll(sel) {
    this.components.forEach(c => c.selected = sel);
    (this.annotations || []).forEach(a => a.selected = false);
    this.selectedAnnotation = null;
    this.selectedComponentLabel = null;
    if (!sel) this.selectedPin = null;
  }

  _getPinWorldPos(instId, pinId) {
    const inst = this.components.find(c => c.id === instId);
    if (!inst) return null;
    const def = window.ArduinoComponents.COMPONENT_DEFS[inst.type];
    if (!def) return null;
    const pin = def.pins.find(p => p.id === pinId);
    if (!pin) return null;
    return this._pinWorldPos(inst, pin);
  }

  _getPinKey(instId, pinId) {
    const inst = this.components.find(c => c.id === instId);
    if (!inst) return null;
    return `pin_${this._pinToNumber(pinId)}`;
  }

  _getPinType(instId, pinId) {
    const inst = this.components.find(c => c.id === instId);
    if (!inst) return 'digital';
    const def = window.ArduinoComponents.COMPONENT_DEFS[inst.type];
    if (!def) return 'digital';
    const pin = def.pins.find(p => p.id === pinId);
    return pin ? pin.type : 'digital';
  }

  _pinToNumber(pinId) {
    const plcMap = { I0_0: 2, I0_1: 3, I0_2: 4, I0_3: 5, Q0_0: 8, Q0_1: 9, Q0_2: 10, Q0_3: 11 };
    if (pinId in plcMap) return plcMap[pinId];
    const analogMap = { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, SDA: 18, SCL: 19 };
    if (pinId in analogMap) return analogMap[pinId];
    // ESP32 DevKit V1 pin aliases
    const esp32Map = { VP: 36, VN: 39, TX0: 1, RX0: 3, EN: 0 };
    // LPC2148 pin aliases
    const lpcMap = { VCC: -1, VBUS: -2, GND1: -3, GND2: -4, RST: -5, P0_0: 0, P0_1: 1, P0_2: 2, P0_3: 3, P0_4: 4, P0_5: 5, P0_6: 6, P0_7: 7, P0_8: 8, P0_9: 9, P0_10: 10, P0_11: 11, P0_12: 12, P0_13: 13, P0_14: 14, P0_15: 15, P0_16: 16, P0_17: 17, P0_18: 18, P0_19: 19, P0_20: 20, P0_21: 21, P0_22: 22, P0_23: 23, P0_25: 25, P0_26: 26, P0_27: 27, P0_28: 28 };
    if (pinId in lpcMap) return lpcMap[pinId];
    if (pinId in esp32Map) return esp32Map[pinId];
    // STM32F746G-DISCO: use Arduino D-number directly (D0-D15 ← 0-15)
    if (/^D\d+$/.test(pinId)) return parseInt(pinId.slice(1));
    // Intel 8085: PA.0-7 → 200-207, PB.0-7 → 210-217, PC.0-7 → 220-227
    // Intel 8051: P0.0-7 → 200-207, P1.0-7 → 210-217, P2.0-7 → 220-227, P3.0-7 → 230-237
    const i8085Match = /^P([ABC])\.(\d)$/.exec(pinId);
    if (i8085Match) {
      const portIdx = { A: 0, B: 1, C: 2 }[i8085Match[1]];
      return 200 + portIdx * 10 + parseInt(i8085Match[2]);
    }
    const i8051Match = /^P(\d)\.(\d)$/.exec(pinId);
    if (i8051Match) {
      return 200 + parseInt(i8051Match[1]) * 10 + parseInt(i8051Match[2]);
    }
    const n = parseInt(pinId.replace(/[^0-9]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  /* Match a pin like D7/A3/VP against a group label like "D0—D13",
     "A0—A5", "VP / VN" or "D34 / D35". */
  _pinMatchesGroup(pinId, groupLabel) {
    const label = String(groupLabel || '').trim();
    // Range form: "D0—D13"
    if (label.includes('—') || label.includes('-')) {
      const parts = label.split(/[—-]/);
      if (parts.length !== 2) return false;
      const m = /^([AD])(\d+)$/.exec(pinId);
      if (!m) return false;
      const letter = m[1];
      const num = parseInt(m[2], 10);
      const start = /^([AD])(\d+)$/.exec(parts[0].trim());
      const end = /^([AD])(\d+)$/.exec(parts[1].trim());
      if (!start || !end || start[1] !== letter || end[1] !== letter) return false;
      return num >= parseInt(start[2], 10) && num <= parseInt(end[2], 10);
    }
    // List form: "VP / VN" — match if pinId appears on either side
    return label.split('/').map(s => s.trim()).includes(pinId);
  }

  _placeComponent(world) {
    if (!this.placingType) return;
    const inst = this.addComponent(this.placingType, world.x, world.y);
    if (inst) this._tryAttachTag(inst);
    // Don't cancel placing — allow multiple placement
    // Press ESC to stop
    return inst;
  }

  _updateCoords(sx, sy, world) {
    const el = document.getElementById('canvas-coords');
    if (el) el.textContent = `X: ${Math.round(world.x)}  Y: ${Math.round(world.y)}`;
  }

  _updateZoomDisplay() {
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = `${Math.round(this.zoom * 100)}%`;
    this._positionQuickControls(this.selected);
  }

  _onChanged() {
    const compEl = document.getElementById('canvas-comp-count');
    const wireEl = document.getElementById('canvas-wire-count');
    if (compEl) compEl.textContent = `${this.components.length} component${this.components.length !== 1 ? 's' : ''}`;
    if (wireEl) wireEl.textContent = `${this.wires.length} wire${this.wires.length !== 1 ? 's' : ''}`;
    // Detect standalone power sources so DMM/function-gen update without running Arduino sketch
    const standaloneTypes = new Set(['power_5v', 'power_gnd', 'battery', 'mb102_power', 'bench_power_supply', 'func_gen', 'v_to_i_420ma', 'i_to_v_420ma', 'logic_level_in']);
    this._hasStandalonePower = this.components.some(c => standaloneTypes.has(c.type));
    // Rebuild electrical graph
    this.engine.buildGraph(this.components, this.wires);
    if (this.onCompChanged) this.onCompChanged();
  }

  /* -------------- VIEWPORT -------------- */
  fitView() {
    if (this.components.length === 0 && (!this.annotations || this.annotations.length === 0)) {
      this.panX = (this._viewportWidth || this.canvas.width) / 2 - 200;
      this.panY = (this._viewportHeight || this.canvas.height) / 2 - 100;
      this.zoom = 1;
      this._updateZoomDisplay();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const inst of this.components) {
      const def = window.ArduinoComponents.COMPONENT_DEFS[inst.type];
      if (!def) continue;
      minX = Math.min(minX, inst.x - 20);
      minY = Math.min(minY, inst.y - 30);
      maxX = Math.max(maxX, inst.x + def.width + 20);
      maxY = Math.max(maxY, inst.y + def.height + 20);
    }
    for (const annotation of this.annotations || []) {
      const bounds = this._annotationBounds(annotation);
      minX = Math.min(minX, bounds.x - 20);
      minY = Math.min(minY, bounds.y - 20);
      maxX = Math.max(maxX, bounds.x + bounds.width + 20);
      maxY = Math.max(maxY, bounds.y + bounds.height + 20);
    }

    const w = this._viewportWidth || this.canvas.width;
    const h = this._viewportHeight || this.canvas.height;
    const cw = maxX - minX, ch = maxY - minY;
    const safeCw = cw > 0 && Number.isFinite(cw) ? cw : 1;
    const safeCh = ch > 0 && Number.isFinite(ch) ? ch : 1;
    this.zoom = Math.min(4, Math.max(0.2, Math.min(w / safeCw, h / safeCh) * 0.9));
    this.panX = (w - safeCw * this.zoom) / 2 - minX * this.zoom;
    this.panY = (h - safeCh * this.zoom) / 2 - minY * this.zoom;
    this._updateZoomDisplay();
  }

  zoomIn() { this.zoom = Math.min(4, this.zoom * 1.2); this._updateZoomDisplay(); }
  zoomOut() { this.zoom = Math.max(0.1, this.zoom / 1.2); this._updateZoomDisplay(); }

  /* -------------- PHASE 2: MINI-MAP NAVIGATOR -------------- */
  _initMinimap() {
    if (typeof document === 'undefined') return;
    this.minimapContainer = document.getElementById('canvas-minimap');
    this.minimapCanvas = document.getElementById('minimap-canvas');

    if (this.minimapContainer) {
      this.minimapContainer.classList.toggle('hidden', !this.minimapVisible);
    }
    const toggleBtn = document.getElementById('btn-toggle-minimap');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.minimapVisible);
      toggleBtn.setAttribute('aria-pressed', this.minimapVisible ? 'true' : 'false');
    }
    const flowBtn = document.getElementById('btn-toggle-current-flow');
    if (flowBtn) {
      flowBtn.classList.toggle('active', this.animatedCurrentFlow);
      flowBtn.setAttribute('aria-pressed', this.animatedCurrentFlow ? 'true' : 'false');
    }

    const closeBtn = document.getElementById('btn-close-minimap');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimap(false);
      });
    }

    if (toggleBtn && !toggleBtn._minimapBound) {
      toggleBtn._minimapBound = true;
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimap();
      });
    }

    if (this.minimapCanvas) {
      this.minimapCanvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.minimapDragging = true;
        try { this.minimapCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        this._panFromMinimap(e);
      });

      this.minimapCanvas.addEventListener('pointermove', (e) => {
        if (!this.minimapDragging) return;
        e.preventDefault();
        e.stopPropagation();
        this._panFromMinimap(e);
      });

      const endDrag = (e) => {
        if (!this.minimapDragging) return;
        this.minimapDragging = false;
        try { this.minimapCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      this.minimapCanvas.addEventListener('pointerup', endDrag);
      this.minimapCanvas.addEventListener('pointercancel', endDrag);
    }
  }

  toggleMinimap(force) {
    if (typeof force === 'boolean') {
      this.minimapVisible = force;
    } else {
      this.minimapVisible = !this.minimapVisible;
    }

    if (!this.minimapContainer && typeof document !== 'undefined') {
      this.minimapContainer = document.getElementById('canvas-minimap');
    }
    if (this.minimapContainer) {
      this.minimapContainer.classList.toggle('hidden', !this.minimapVisible);
    }

    const toggleBtn = typeof document !== 'undefined' ? document.getElementById('btn-toggle-minimap') : null;
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.minimapVisible);
      toggleBtn.setAttribute('aria-pressed', this.minimapVisible ? 'true' : 'false');
    }

    if (this.minimapVisible) {
      this._renderMinimap();
    }
    return this.minimapVisible;
  }

  _panFromMinimap(e) {
    if (!this.minimapCanvas || !this._minimapTransform) return;
    const rect = this.minimapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { worldMinX, worldMinY, offX, offY, mmScale } = this._minimapTransform;
    if (!mmScale || mmScale <= 0) return;

    const targetWx = worldMinX + (mx - offX) / mmScale;
    const targetWy = worldMinY + (my - offY) / mmScale;

    const vw = this._viewportWidth || this.canvas.width;
    const vh = this._viewportHeight || this.canvas.height;

    this.panX = (vw / 2) - (targetWx * this.zoom);
    this.panY = (vh / 2) - (targetWy * this.zoom);
  }

  _renderMinimap() {
    if (!this.minimapVisible || !this.minimapCanvas) return;
    const mm = this.minimapCanvas;
    const mmCtx = mm.getContext('2d');
    if (!mmCtx) return;

    const mmW = mm.width || 180;
    const mmH = mm.height || 110;

    const vw = this._viewportWidth || this.canvas.width;
    const vh = this._viewportHeight || this.canvas.height;
    const viewMinX = -this.panX / this.zoom;
    const viewMinY = -this.panY / this.zoom;
    const viewMaxX = viewMinX + (vw / this.zoom);
    const viewMaxY = viewMinY + (vh / this.zoom);

    let minX = viewMinX;
    let minY = viewMinY;
    let maxX = viewMaxX;
    let maxY = viewMaxY;

    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    for (const inst of this.components) {
      const def = defs && defs[inst.type];
      const w = (def && def.width) || 40;
      const h = (def && def.height) || 40;
      minX = Math.min(minX, inst.x);
      minY = Math.min(minY, inst.y);
      maxX = Math.max(maxX, inst.x + w);
      maxY = Math.max(maxY, inst.y + h);
    }

    for (const annotation of this.annotations || []) {
      const b = this._annotationBounds(annotation);
      if (b) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
    }

    const pad = 60;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

    const worldW = Math.max(100, maxX - minX);
    const worldH = Math.max(100, maxY - minY);

    const targetW = mmW - 12;
    const targetH = mmH - 12;
    const mmScale = Math.min(targetW / worldW, targetH / worldH);
    const offX = 6 + (targetW - worldW * mmScale) / 2;
    const offY = 6 + (targetH - worldH * mmScale) / 2;

    this._minimapTransform = { worldMinX: minX, worldMinY: minY, offX, offY, mmScale };

    mmCtx.clearRect(0, 0, mmW, mmH);

    // Background
    mmCtx.fillStyle = '#11141c';
    mmCtx.fillRect(0, 0, mmW, mmH);

    // Mini grid dots
    mmCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let gx = offX; gx < offX + worldW * mmScale; gx += 18) {
      for (let gy = offY; gy < offY + worldH * mmScale; gy += 18) {
        mmCtx.fillRect(gx, gy, 1, 1);
      }
    }

    // Wires
    mmCtx.lineWidth = 1;
    for (const wire of this.wires) {
      const p1 = this._getPinWorldPos(wire.from.instId, wire.from.pinId);
      const p2 = this._getPinWorldPos(wire.to.instId, wire.to.pinId);
      if (!p1 || !p2) continue;
      const x1 = offX + (p1.x - minX) * mmScale;
      const y1 = offY + (p1.y - minY) * mmScale;
      const x2 = offX + (p2.x - minX) * mmScale;
      const y2 = offY + (p2.y - minY) * mmScale;
      mmCtx.strokeStyle = wire.color || '#4caf50';
      mmCtx.beginPath();
      mmCtx.moveTo(x1, y1);
      mmCtx.lineTo(x2, y2);
      mmCtx.stroke();
    }

    // Components
    const boardTypes = ['arduino_uno', 'esp32_devkit_v1', 'arduino_nano', 'stm32f746_disco', 'lpc2148', 'pico2w', 'intel_8085', 'intel_8051', 'industrial_plc'];
    for (const inst of this.components) {
      const def = defs && defs[inst.type];
      const w = Math.max(3, ((def && def.width) || 40) * mmScale);
      const h = Math.max(3, ((def && def.height) || 40) * mmScale);
      const x = offX + (inst.x - minX) * mmScale;
      const y = offY + (inst.y - minY) * mmScale;

      const isBoard = boardTypes.includes(inst.type);
      mmCtx.fillStyle = inst.selected ? '#00e5ff' : (isBoard ? '#1976d2' : '#374151');
      mmCtx.fillRect(x, y, w, h);
      mmCtx.strokeStyle = inst.selected ? '#ffffff' : (isBoard ? '#64b5f6' : 'rgba(255, 255, 255, 0.2)');
      mmCtx.lineWidth = 0.8;
      mmCtx.strokeRect(x, y, w, h);
    }

    // Viewport Illuminated Rectangle
    const vpX = offX + (viewMinX - minX) * mmScale;
    const vpY = offY + (viewMinY - minY) * mmScale;
    const vpW = (viewMaxX - viewMinX) * mmScale;
    const vpH = (viewMaxY - viewMinY) * mmScale;

    mmCtx.fillStyle = 'rgba(0, 229, 255, 0.12)';
    mmCtx.fillRect(vpX, vpY, vpW, vpH);
    mmCtx.strokeStyle = '#00e5ff';
    mmCtx.lineWidth = 1.5;
    mmCtx.strokeRect(vpX, vpY, vpW, vpH);
  }

  /* -------------- PHASE 2: PIN CROSS-PROBING -------------- */
  _matchPinIdentifier(pin, identifier) {
    if (!pin || !identifier) return false;
    const id = String(pin.id).toLowerCase();
    const lbl = String(pin.label || '').toLowerCase();
    const query = String(identifier).toLowerCase();

    if (id === query || lbl === query) return true;
    if (query === 'led_builtin' && (id === 'd13' || id === '13' || lbl === '13')) return true;
    if (/^\d+$/.test(query)) {
      if (id === `d${query}` || lbl === `d${query}` || lbl === query) return true;
      if (this._pinToNumber(pin.id) === Number(query)) return true;
    }
    if (/^d\d+$/i.test(query)) {
      const num = query.slice(1);
      if (id === num || lbl === num) return true;
    }
    if (/^a\d+$/i.test(query)) {
      if (id === query || lbl === query) return true;
    }
    return false;
  }

  highlightPin(pinIdentifier, instId = null) {
    if (!pinIdentifier) {
      this.clearPinHighlight();
      return null;
    }

    const normPin = String(pinIdentifier).trim();
    const boardTypes = ['arduino_uno', 'esp32_devkit_v1', 'arduino_nano', 'stm32f746_disco', 'lpc2148', 'pico2w', 'intel_8085', 'intel_8051', 'industrial_plc'];
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;

    // 1. Identify target component (MCU board if not specified)
    let targetInst = null;
    if (instId) {
      targetInst = this.components.find(c => c.id === instId);
    } else {
      // Find MCU board first
      targetInst = this.components.find(c => boardTypes.includes(c.type));
      if (!targetInst && this.components.length > 0) {
        // Fallback: look for any component having this pin
        for (const comp of this.components) {
          const def = defs && defs[comp.type];
          if (def && Array.isArray(def.pins) && def.pins.some(p => this._matchPinIdentifier(p, normPin))) {
            targetInst = comp;
            break;
          }
        }
      }
    }
    if (!targetInst) return null;

    const def = defs && defs[targetInst.type];
    if (!def || !Array.isArray(def.pins)) return null;

    // 2. Find matching pin on target component
    const matchedPin = def.pins.find(p => this._matchPinIdentifier(p, normPin));
    if (!matchedPin) return null;

    // 3. Find connected wires and target counterpart components
    const connectedWires = [];
    const connectedComponents = [];

    for (const wire of this.wires) {
      let otherInstId = null;
      let otherPinId = null;

      if (wire.from.instId === targetInst.id && wire.from.pinId === matchedPin.id) {
        otherInstId = wire.to.instId;
        otherPinId = wire.to.pinId;
      } else if (wire.to.instId === targetInst.id && wire.to.pinId === matchedPin.id) {
        otherInstId = wire.from.instId;
        otherPinId = wire.from.pinId;
      }

      if (otherInstId) {
        connectedWires.push(wire);
        const otherComp = this.components.find(c => c.id === otherInstId);
        if (otherComp) {
          const otherDef = defs && defs[otherComp.type];
          const otherPin = otherDef?.pins?.find(p => p.id === otherPinId);
          connectedComponents.push({
            inst: otherComp,
            pin: otherPin || { id: otherPinId, label: otherPinId },
            wire,
          });
        }
      }
    }

    this.highlightedPin = {
      inst: targetInst,
      pin: matchedPin,
      wires: connectedWires,
      connections: connectedComponents,
    };

    return this.highlightedPin;
  }

  clearPinHighlight() {
    if (this.highlightedPin) {
      this.highlightedPin = null;
    }
  }

  getPinConnections(pinIdentifier, instId = null) {
    const hl = this.highlightPin(pinIdentifier, instId);
    if (!hl) return null;

    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    const boardDef = defs && defs[hl.inst.type];
    const sim = window.ArduinoSim;
    const pinNum = this._pinToNumber(hl.pin.id);

    let pinMode = 'INPUT';
    if (sim && sim.pinModes && pinNum !== null && sim.pinModes[pinNum]) {
      pinMode = sim.pinModes[pinNum];
    }

    const connectedDetails = hl.connections.map(c => {
      const cDef = defs && defs[c.inst.type];
      const name = c.inst.props?.label || cDef?.name || c.inst.type;
      return {
        name,
        type: c.inst.type,
        pinLabel: c.pin.label || c.pin.id,
        wireColor: c.wire?.color || '#4caf50',
      };
    });

    return {
      boardName: hl.inst.props?.label || boardDef?.name || hl.inst.type,
      pinId: hl.pin.id,
      pinLabel: hl.pin.label || hl.pin.id,
      pinNumber: pinNum,
      pinType: hl.pin.type || 'digital',
      pinMode,
      connectedComponents: connectedDetails,
    };
  }

  _drawPinHighlight(ctx) {
    if (!this.highlightedPin) return;
    const { inst, pin, wires, connections } = this.highlightedPin;
    if (!inst || !pin) return;
    const pos = this._getPinWorldPos(inst.id, pin.id);

    ctx.save();

    // 1. Highlight connected wires with cyan glow
    for (const wire of wires || []) {
      const pathData = this._wirePath(wire);
      if (pathData) {
        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 14 / this.zoom;
        ctx.lineWidth = Math.max(3.5, 4.5 / this.zoom);
        if (pathData.type === 'bezier') {
          this._drawBezierWire(ctx, pathData, '#00e5ff', true, wire);
        } else {
          this._drawOrthogonalWire(ctx, pathData.pts, '#00e5ff', true, wire);
        }
        ctx.restore();
      }
    }

    // 2. Highlight connected components
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
    for (const conn of connections || []) {
      const c = conn.inst;
      if (!c) continue;
      const def = defs && defs[c.type];
      const cw = (def && def.width) || 40;
      const ch = (def && def.height) || 40;

      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10 / this.zoom;
      ctx.lineWidth = 2 / this.zoom;
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4 / this.zoom, 3 / this.zoom]);
      ctx.strokeRect(c.x - 4, c.y - 4, cw + 8, ch + 8);
      ctx.fillRect(c.x - 4, c.y - 4, cw + 8, ch + 8);
      ctx.restore();
    }

    // 3. Highlight pin with glowing halo
    if (pos) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.strokeStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12 / this.zoom;
      ctx.lineWidth = 3 / this.zoom;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /* -------------- PHASE 3: CURRENT FLOW ANIMATION -------------- */
  _isWireConducting(wire) {
    if (!wire || !this.animatedCurrentFlow) return false;
    const sim = window.ArduinoSim;
    const isRunning = !!(sim && sim.isRunning);
    const t1 = this._getPinType(wire.from?.instId, wire.from?.pinId);
    const t2 = this._getPinType(wire.to?.instId, wire.to?.pinId);

    if (!isRunning) {
      if (this._hasStandalonePower) {
        return t1 === 'power' || t2 === 'power';
      }
      return false;
    }

    const k1 = this._getPinKey(wire.from?.instId, wire.from?.pinId);
    const k2 = this._getPinKey(wire.to?.instId, wire.to?.pinId);
    const v1 = sim.pinStates ? (sim.pinStates[k1] || 0) : 0;
    const v2 = sim.pinStates ? (sim.pinStates[k2] || 0) : 0;

    if (t1 === 'power' || t2 === 'power' || v1 > 0 || v2 > 0) return true;
    if (this.engine) {
      const p1V = this.engine.getVoltageAtPin(wire.from?.instId, wire.from?.pinId);
      const p2V = this.engine.getVoltageAtPin(wire.to?.instId, wire.to?.pinId);
      if (Math.abs((p1V || 0) - (p2V || 0)) > 0.05 || (p1V && p1V > 0.5) || (p2V && p2V > 0.5)) return true;
    }
    return false;
  }

  toggleCurrentAnimation(force) {
    if (typeof force === 'boolean') {
      this.animatedCurrentFlow = force;
    } else {
      this.animatedCurrentFlow = !this.animatedCurrentFlow;
    }
    const btn = typeof document !== 'undefined' ? document.getElementById('btn-toggle-current-flow') : null;
    if (btn) {
      btn.classList.toggle('active', this.animatedCurrentFlow);
      btn.setAttribute('aria-pressed', this.animatedCurrentFlow ? 'true' : 'false');
    }
    return this.animatedCurrentFlow;
  }

  /* -------------- HISTORY -------------- */
  _serializeState() {
    return JSON.stringify({ components: this.components, wires: this.wires, annotations: this.annotations }, (key, val) => {
      if (key === '_componentInstance') return undefined;
      return val;
    });
  }

  _pushHistory() {
    const state = this._serializeState();
    this.history = this.history.slice(0, this.historyIdx + 1);
    this.history.push(state);
    if (this.history.length > 50) this.history.shift();
    this.historyIdx = this.history.length - 1;
  }

  undo() {
    if (this.historyIdx <= 0) return;
    this.historyIdx--;
    this._restoreState(this.history[this.historyIdx]);
  }

  redo() {
    if (this.historyIdx >= this.history.length - 1) return;
    this.historyIdx++;
    this._restoreState(this.history[this.historyIdx]);
  }

  _restoreState(json) {
    try {
      const { components, wires, annotations } = JSON.parse(json);
      this.components = components;
      this.annotations = Array.isArray(annotations)
        ? annotations.map(a => ({ ...a, selected: false }))
        : [];
      this.wires = (Array.isArray(wires) ? wires : []).map(w => ({
        ...w,
        color: (typeof w.color === 'string' && w.color.length > 0) ? w.color : null,
        waypoints: Array.isArray(w.waypoints)
          ? w.waypoints.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: Number(p.x), y: Number(p.y) }))
          : [],
        routeStyle: (w.routeStyle === 'bezier') ? 'bezier' : 'orthogonal',
        bezierCtrl: (w.bezierCtrl && w.bezierCtrl.c1 && w.bezierCtrl.c2) ? {
          c1: { x: Number(w.bezierCtrl.c1.x) || 0, y: Number(w.bezierCtrl.c1.y) || 0 },
          c2: { x: Number(w.bezierCtrl.c2.x) || 0, y: Number(w.bezierCtrl.c2.y) || 0 }
        } : null,
      }));
      this.selected = null;
      this.selectedPin = null;
      this.selectedWire = null;
      this.selectedAnnotation = null;
      this._onChanged();
    } catch (e) { }
  }

  /* -------------- SERIALIZE -------------- */
  serialize() {
    return {
      components: this.components.map(c => ({
        id: c.id,
        type: c.type,
        x: c.x,
        y: c.y,
        rotation: c.rotation,
        props: c.props,
      })),
      wires: this.wires.map(w => ({
        id: w.id,
        from: w.from,
        to: w.to,
        color: w.color || null,
        waypoints: w.waypoints || [],
        routeStyle: w.routeStyle || 'orthogonal',
        bezierCtrl: w.bezierCtrl || null,
      })),
      annotations: (this.annotations || []).map(a => {
        const item = {
          id: a.id,
          text: a.text,
          x: a.x,
          y: a.y,
        };
        if (a.color) item.color = a.color;
        return item;
      }),
    };
  }

  deserialize(data) {
    if (!data || typeof data !== 'object') return;
    const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS
      ? window.ArduinoComponents.COMPONENT_DEFS : {};

    // Sanitize components: keep only known types with valid ids/positions
    const seenIds = new Set();
    const components = (Array.isArray(data.components) ? data.components : [])
      .filter(c => c && typeof c === 'object' && c.type && defs[c.type] && c.id)
      .map(c => {
        const def = defs[c.type];
        const x = Number(c.x);
        const y = Number(c.y);
        const rot = Number(c.rotation);
        return {
          id: String(c.id),
          type: c.type,
          x: Number.isFinite(x) ? Math.round(x / this.GRID) * this.GRID : 0,
          y: Number.isFinite(y) ? Math.round(y / this.GRID) * this.GRID : 0,
          width: def.width,
          height: def.height,
          props: Object.assign({}, def.defaultProps || {},
            (c.props && typeof c.props === 'object') ? c.props : {}),
          runtimeState: {},
          selected: false,
          rotation: Number.isFinite(rot) ? ((Math.round(rot) % 4) + 4) % 4 : 0,
        };
      })
      .filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });

    const annotations = (Array.isArray(data.annotations) ? data.annotations : [])
      .filter(a => a && typeof a === 'object' && typeof a.text === 'string' && a.text.trim())
      .map((a, index) => {
        const x = Number(a.x);
        const y = Number(a.y);
        const ann = {
          id: String(a.id || `text_${index}_${Date.now()}`),
          text: a.text,
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
          selected: false,
        };
        if (typeof a.color === 'string' && a.color.trim()) {
          ann.color = a.color.trim();
        }
        return ann;
      });

    const idSet = new Set(components.map(c => c.id));
    const seenWires = new Set();
    const wires = (Array.isArray(data.wires) ? data.wires : [])
      .filter(w => w && w.from && w.to && idSet.has(w.from.instId) && idSet.has(w.to.instId))
      .map(w => ({
        id: String(w.id || `wire_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
        from: { instId: String(w.from.instId), pinId: String(w.from.pinId) },
        to: { instId: String(w.to.instId), pinId: String(w.to.pinId) },
        color: (typeof w.color === 'string' && w.color.length > 0) ? w.color : null,
        waypoints: Array.isArray(w.waypoints)
          ? w.waypoints.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: Number(p.x), y: Number(p.y) }))
          : [],
        routeStyle: (w.routeStyle === 'bezier') ? 'bezier' : 'orthogonal',
        bezierCtrl: (w.bezierCtrl && w.bezierCtrl.c1 && w.bezierCtrl.c2) ? {
          c1: { x: Number(w.bezierCtrl.c1.x) || 0, y: Number(w.bezierCtrl.c1.y) || 0 },
          c2: { x: Number(w.bezierCtrl.c2.x) || 0, y: Number(w.bezierCtrl.c2.y) || 0 }
        } : null,
      }))
      .filter(w => {
        if (w.from.instId === w.to.instId && w.from.pinId === w.to.pinId) return false;
        const a = `${w.from.instId}:${w.from.pinId}:${w.to.instId}:${w.to.pinId}`;
        const b = `${w.to.instId}:${w.to.pinId}:${w.from.instId}:${w.from.pinId}`;
        if (seenWires.has(a) || seenWires.has(b)) return false;
        seenWires.add(a);
        seenWires.add(b);
        return true;
      });

    this.components = components;
    this.wires = wires;
    this.annotations = annotations;
    this.selected = null;
    this.selectedWire = null;
    this.selectedAnnotation = null;

    // Reset history so undo can't roll back into a blank/empty state
    this.history = [this._serializeState()];
    this.historyIdx = 0;

    this._onChanged();
    setTimeout(() => this.fitView(), 100);
  }

  exportPNG() {
    try {
      const SCALE = 3;
      const PADDING = 40;

      // Compute bounding box of all components
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const inst of this.components) {
        const def = window.ArduinoComponents?.COMPONENT_DEFS?.[inst.type];
        if (!def) continue;
        minX = Math.min(minX, inst.x - 20);
        minY = Math.min(minY, inst.y - 30);
        maxX = Math.max(maxX, inst.x + (def.width || 120) + 20);
        maxY = Math.max(maxY, inst.y + (def.height || 80) + 20);
      }
      for (const annotation of this.annotations || []) {
        const bounds = this._annotationBounds(annotation);
        minX = Math.min(minX, bounds.x - 20);
        minY = Math.min(minY, bounds.y - 20);
        maxX = Math.max(maxX, bounds.x + bounds.width + 20);
        maxY = Math.max(maxY, bounds.y + bounds.height + 20);
      }
      if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300; }

      const cw = maxX - minX;
      const ch = maxY - minY;
      const outW = Math.ceil((cw + PADDING * 2) * SCALE);
      const outH = Math.ceil((ch + PADDING * 2) * SCALE);

      const tmp = document.createElement('canvas');
      tmp.width = outW;
      tmp.height = outH;
      const tc = tmp.getContext('2d');

      // Dark background
      tc.fillStyle = '#0d1117';
      tc.fillRect(0, 0, outW, outH);

      // Compute zoom to fit circuit
      const fitZoom = Math.min(outW / (cw + PADDING * 2), outH / (ch + PADDING * 2)) / SCALE;
      const tx = (outW - cw * fitZoom * SCALE) / 2 - minX * fitZoom * SCALE;
      const ty = (outH - ch * fitZoom * SCALE) / 2 - minY * fitZoom * SCALE;

      tc.save();
      tc.scale(SCALE, SCALE);
      tc.translate(tx / SCALE, ty / SCALE);
      tc.scale(fitZoom, fitZoom);

      // Draw grid
      const G = this.GRID;
      const invZ = 1 / fitZoom;
      const gsX = Math.floor((-tx / SCALE) * invZ / G) * G;
      const gsY = Math.floor((-ty / SCALE) * invZ / G) * G;
      const geX = gsX + (outW / SCALE * invZ) + G;
      const geY = gsY + (outH / SCALE * invZ) + G;
      tc.strokeStyle = 'rgba(255,255,255,0.04)';
      tc.lineWidth = 0.5;
      for (let x = gsX; x <= geX; x += G) {
        tc.beginPath(); tc.moveTo(x, gsY); tc.lineTo(x, geY); tc.stroke();
      }
      for (let y = gsY; y <= geY; y += G) {
        tc.beginPath(); tc.moveTo(gsX, y); tc.lineTo(geX, y); tc.stroke();
      }

      // Draw wires
      this._drawWires(tc);

      try { this._drawLvlTags(tc); } catch (_e) { /* guard */ }

      // Draw components
      this._drawComponents(tc);

      try { this._drawInteractives(tc); } catch (_e) { /* guard */ }
      this._drawOverlays(tc, fitZoom, true);

      tc.restore();

      const a = document.createElement('a');
      a.href = tmp.toDataURL('image/png');
      a.download = 'circuit.png';
      a.click();
    } catch (e) {
      console.error('[ArduSim] Export PNG failed:', e);
      if (window.App && window.App.showToast) window.App.showToast('Could not export image', 'error');
    }
  }

  /* -------------- SIM HELPERS -------------- */
  // Get Arduino Uno instance (first one found)
  getArduinoInst() {
    return this.components.find(c => c.type === 'arduino_uno' || c.type === 'industrial_plc') || null;
  }

  // Get whichever microcontroller board instance is placed (first one found)
  getBoardInst() {
    return this.components.find(c => c.type === 'arduino_uno' || c.type === 'esp32_devkit_v1' || c.type === 'arduino_nano' || c.type === 'stm32f746_disco' || c.type === 'lpc2148' || c.type === 'pico2w' || c.type === 'intel_8085' || c.type === 'intel_8051' || c.type === 'industrial_plc') || null;
  }

  // Get all board instances on the canvas
  getAllBoardInsts() {
    return this.components.filter(c => c.type === 'arduino_uno' || c.type === 'esp32_devkit_v1' || c.type === 'arduino_nano' || c.type === 'stm32f746_disco' || c.type === 'lpc2148' || c.type === 'pico2w' || c.type === 'intel_8085' || c.type === 'intel_8051' || c.type === 'industrial_plc');
  }

  // Get board instance by index (0-based)
  getBoardInstByIndex(idx) {
    const boards = this.getAllBoardInsts();
    return boards[idx] || null;
  }

  // Update component display based on simulation state and circuit electrical paths
  updateSimState(pinStates) {
    if (this._updatingSimState) return;
    this._updatingSimState = true;
    try { this._updateSimStateInner(pinStates); } finally { this._updatingSimState = false; }
  }

  _updateSimStateInner(pinStates) {
    const { getComponentClass } = window.ArduinoComponents;

    // Pre-update relay / SSR state so buildGraph uses latest active flag
    for (const inst of this.components) {
      if (inst.type === 'relay' || inst.type === 'ssr_8ch') {
        const CompClass = getComponentClass(inst.type);
        if (CompClass) {
          if (!inst._componentInstance || inst._componentInstance.type !== inst.type) {
            inst._componentInstance = new CompClass(inst);
          }
          inst._componentInstance.canvas = this;
          inst._componentInstance.update(this);
        }
      }
    }

    // Rebuild electrical graph with current relay states
    this.engine.buildGraph(this.components, this.wires);
    // Solve electrical graph
    this.engine.solve(this);

    // Check external RST / EN pin reset (falling edge to GND)
    for (const inst of this.components) {
      if (inst.type !== 'arduino_uno' && inst.type !== 'arduino_nano' && inst.type !== 'esp32_devkit_v1') continue;
      const rstPinIds = inst.type === 'arduino_nano' ? ['RST1', 'RST2'] : (inst.type === 'esp32_devkit_v1' ? ['EN'] : ['RST']);
      let isGrounded = false;
      for (const rstId of rstPinIds) {
        const net = this.engine?.pinToNet?.get(`${inst.id}:${rstId}`);
        if (net && net.grounds && net.grounds.length > 0 && (net.voltage === 0 || net.voltage < 1.0)) {
          isGrounded = true;
          break;
        }
      }
      inst.runtimeState = inst.runtimeState || {};
      const wasGrounded = !!inst.runtimeState._extRstGnd;
      inst.runtimeState._extRstGnd = isGrounded;
      if (isGrounded && !wasGrounded) {
        inst.runtimeState._resetPressed = true;
        this._render();
        if (inst.runtimeState._resetReleaseTimer) clearTimeout(inst.runtimeState._resetReleaseTimer);
        inst.runtimeState._resetReleaseTimer = setTimeout(() => {
          inst.runtimeState._resetPressed = false;
          inst.runtimeState._resetReleaseTimer = null;
          this._render();
        }, 160);
        this._handleBoardResetClick(inst);
      }
    }

    // Feed back solved voltages for Arduino input pins so external signals
    // (func_gen, sensors, etc.) propagate to pinStates ← _emitPinChange ← interrupts
    const sim = window.ArduinoSim;
    if (sim && this.engine.pinToNet) {
      const arduinoTypes = ['arduino_uno', 'arduino_nano', 'esp32_devkit_v1', 'stm32f746_disco', 'lpc2148', 'pico2w', 'intel_8085', 'intel_8051', 'industrial_plc'];
      for (const inst of this.components) {
        if (!arduinoTypes.includes(inst.type)) continue;
        const maxV = (inst.type === 'esp32_devkit_v1' || inst.type === 'stm32f746_disco' || inst.type === 'lpc2148' || inst.type === 'pico2w') ? 3.3 : 5.0;
        for (const [pinKey, net] of this.engine.pinToNet) {
          if (!pinKey.startsWith(inst.id + ':')) continue;
          const pinId = pinKey.slice(inst.id.length + 1);
          const pinNum = this._pinToNumber(pinId);
          if (pinNum == null) continue;
          const mode = sim.pinModes?.[`pin_${pinNum}`];
          if (mode !== 'INPUT' && mode !== 'INPUT_PULLUP' && mode !== 'INPUT_PULLDOWN') continue;

          let voltage = net.voltage || 0;
          if (mode === 'INPUT_PULLUP'
            && (!net.sources || net.sources.length === 0)
            && (!net.grounds || net.grounds.length === 0)) {
            voltage = maxV;
          }
          const digitalVal = voltage >= maxV / 2 ? 1 : 0;
          const key = `pin_${pinNum}`;
          const currentVal = sim.pinStates?.[key];
          const defaultVal = mode === 'INPUT_PULLUP' ? 1 : 0;
          if (digitalVal !== (currentVal ?? defaultVal)) {
            sim.setPinState(key, digitalVal);
          }
        }
      }
    }

    for (const inst of this.components) {
      // â”€â”€ Class-based component: delegate to update() â”€â”€
      const CompClass = getComponentClass(inst.type);
      if (CompClass) {
        if (!inst._componentInstance || inst._componentInstance.type !== inst.type) {
          inst._componentInstance = new CompClass(inst);
        }
        inst._componentInstance.canvas = this;
        inst._componentInstance.update(this);
        continue; // skip legacy switch/case
      }

      // â”€â”€ Legacy defComp() fallback â”€â”€
      switch (inst.type) {
        case 'led':
        case 'led_green':
        case 'led_blue':
        case 'led_yellow':
        case 'led_orange':
        case 'led_white':
          {
            // 1. Trace Anode (+) to voltage sources & series resistance
            const anodeNet = this._tracePinNet(inst.id, 'anode');
            // 2. Trace Cathode (-) to Ground paths & series resistance
            const cathodeNet = this._tracePinNet(inst.id, 'cathode');

            const hasGround = cathodeNet.grounds.length > 0;
            const bestSource = anodeNet.sources.sort((a, b) => b.voltage - a.voltage)[0] || null;

            if (!hasGround || !bestSource || bestSource.voltage <= 0) {
              // No complete circuit: missing ground or missing voltage source -> OFF
              inst.runtimeState.val = 0;
              inst.runtimeState.lit = false;
              inst.runtimeState.brightness = 0;
              inst.runtimeState.current_mA = 0;
              inst.runtimeState.overload = false;
              inst.runtimeState.blown = false;
              inst.runtimeState._warnedBlown = false;
            } else {
              // Complete circuit! Calculate total resistance (anode path + cathode path + Arduino pin resistance)
              const bestGround = cathodeNet.grounds.sort((a, b) => a.resistance - b.resistance)[0];
              const rTotal = Math.max(10, (bestSource.resistance || 0) + (bestGround.resistance || 0) + 25);
              const vSource = bestSource.voltage; // e.g. 5.0V or PWM duty cycle
              const vf = 2.0; // typical LED forward voltage drop (V)
              const rawVal = bestSource.rawVal;

              // PWM (analogWrite, value 2—254 on a digital pin): brightness follows the
              // duty cycle directly so fades are clearly visible, even below Vf.
              const isPWM = bestSource.type === 'digital' && rawVal > 1 && rawVal < 255;

              if (isPWM) {
                const frac = rawVal / 255;
                // Slight perceptual ease so the eye sees a smooth ramp
                const normBrightness = Math.max(0, Math.min(1.0, Math.pow(frac, 0.8)));
                inst.runtimeState.val = rawVal;
                inst.runtimeState.lit = normBrightness > 0.02;
                inst.runtimeState.brightness = normBrightness;
                inst.runtimeState.current_mA = vSource >= vf ? ((vSource - vf) / rTotal) * 1000 : 0;
              } else if (vSource < vf) {
                inst.runtimeState.val = 0;
                inst.runtimeState.lit = false;
                inst.runtimeState.brightness = 0;
                inst.runtimeState.current_mA = 0;
              } else {
                // Current in mA: I = (V_source - Vf) / R_total * 1000
                const i_mA = ((vSource - vf) / rTotal) * 1000;
                inst.runtimeState.current_mA = i_mA;

                // LED nominal full brightness is ~15mA (standard 220 ohm resistor gives ~12.2mA -> ~0.93)
                // Human perceptual brightness response: (I / 14mA)^0.55
                const normBrightness = Math.max(0, Math.min(1.0, Math.pow(i_mA / 14.0, 0.55)));

                inst.runtimeState.val = rawVal;
                inst.runtimeState.lit = normBrightness > 0.02;
                inst.runtimeState.brightness = normBrightness;
              }

              // â”€â”€ Overload / failure detection â”€â”€
              // A standard LED is rated for ~20 mA. Above 20 mA it's stressed (warning),
              // above 40 mA (e.g. connected straight to 5V without a resistor) it "blows".
              const iLed = inst.runtimeState.current_mA || 0;
              inst.runtimeState.overload = iLed > 20;
              inst.runtimeState.blown = iLed > 40;

              if (inst.runtimeState.blown) {
                inst.runtimeState.lit = false;
                inst.runtimeState.brightness = 0;
                inst.runtimeState.val = 0;
                if (!inst.runtimeState._warnedBlown) {
                  inst.runtimeState._warnedBlown = true;
                  if (window.OutputPanel) {
                    window.OutputPanel.log(
                      `LED (${inst.id}) is over-current (~${Math.round(iLed)} mA) without a current-limiting resistor and has blown! Add a 220Ω resistor in series.`,
                      'warn'
                    );
                  }
                }
              } else {
                inst.runtimeState._warnedBlown = false;
              }
            }
            break;
          }
        case 'bulb_12v': {
          const anodeHasWire = this.wires.some(w =>
            (w.from.instId === inst.id && w.from.pinId === 'anode') ||
            (w.to.instId === inst.id && w.to.pinId === 'anode')
          );
          const cathodeHasWire = this.wires.some(w =>
            (w.from.instId === inst.id && w.from.pinId === 'cathode') ||
            (w.to.instId === inst.id && w.to.pinId === 'cathode')
          );
          if (!anodeHasWire || !cathodeHasWire) {
            inst.runtimeState.brightness = 0;
            inst.runtimeState.blown = false;
            inst.runtimeState._warnedBlown = false;
            break;
          }

          const anodeNet = this._tracePinNet(inst.id, 'anode', ['bulb_12v']);
          const cathodeNet = this._tracePinNet(inst.id, 'cathode', ['bulb_12v']);

          // Incandescent filament is non-polar: it lights when a source sits on
          // either pin AND a ground on the opposite pin (both orientations).
          const driveFrom = (srcNet, gndNet) => {
            if (srcNet.sources.length === 0 || gndNet.grounds.length === 0) return null;
            return {
              source: srcNet.sources.slice().sort((a, b) => b.voltage - a.voltage)[0],
              ground: gndNet.grounds.slice().sort((a, b) => a.resistance - b.resistance)[0],
            };
          };
          let drive = driveFrom(anodeNet, cathodeNet);
          const reverseDrive = driveFrom(cathodeNet, anodeNet);
          if (reverseDrive && (!drive || reverseDrive.source.voltage > drive.source.voltage)) {
            drive = reverseDrive;
          }
          const bestSource = drive ? drive.source : null;
          const bestGround = drive ? drive.ground : null;
          const hasGround = !!bestGround;

          if (!hasGround || !bestSource || bestSource.voltage <= 0) {
            inst.runtimeState.brightness = 0;
            inst.runtimeState.blown = false;
            inst.runtimeState._warnedBlown = false;
          } else {
            const rTotal = Math.max(1, (bestSource.resistance || 0) + (bestGround.resistance || 0));
            const vSource = bestSource.voltage;

            // 12V incandescent: brightness scales linearly with voltage up to 12V
            const normBrightness = Math.max(0, Math.min(1.0, vSource / 12.0));
            inst.runtimeState.brightness = normBrightness;

            // Blow if voltage exceeds 16V (over-voltage)
            if (vSource > 16) {
              inst.runtimeState.blown = true;
              inst.runtimeState.brightness = 0;
              if (!inst.runtimeState._warnedBlown) {
                inst.runtimeState._warnedBlown = true;
                if (window.OutputPanel) {
                  window.OutputPanel.log(
                    `12V Bulb (${inst.id}) has blown! Applied voltage: ${vSource.toFixed(1)}V exceeds maximum rating.`,
                    'warn'
                  );
                }
              }
            } else {
              inst.runtimeState.blown = false;
              inst.runtimeState._warnedBlown = false;
            }
          }
          break;
        }
        case 'rgb_led': {
          // Cathode must be connected to GND
          const cathodeNet = this._tracePinNet(inst.id, 'gnd');
          const hasGround = cathodeNet.grounds.length > 0;

          if (!hasGround) {
            inst.runtimeState.red = 0;
            inst.runtimeState.green = 0;
            inst.runtimeState.blue = 0;
            inst.runtimeState.r = 0;
            inst.runtimeState.g = 0;
            inst.runtimeState.b = 0;
          } else {
            const bestGround = cathodeNet.grounds.sort((a, b) => a.resistance - b.resistance)[0];
            const gndR = bestGround.resistance || 0;

            const traceChannel = (pinId, vf) => {
              const net = this._tracePinNet(inst.id, pinId);
              const source = net.sources.sort((a, b) => b.voltage - a.voltage)[0] || null;
              if (!source || source.voltage < vf) return 0;
              const rTotal = Math.max(10, (source.resistance || 0) + gndR + 25);
              const i_mA = ((source.voltage - vf) / rTotal) * 1000;
              const norm = Math.max(0, Math.min(1.0, Math.pow(i_mA / 14.0, 0.55)));
              return Math.round(norm * 255);
            };

            inst.runtimeState.r = traceChannel('red', 1.8);
            inst.runtimeState.g = traceChannel('green', 2.2);
            inst.runtimeState.b = traceChannel('blue', 2.8);
            inst.runtimeState.red = inst.runtimeState.r;
            inst.runtimeState.green = inst.runtimeState.g;
            inst.runtimeState.blue = inst.runtimeState.b;
          }
          break;
        }
        case 'bench_power_supply': {
          const bsPowered = Boolean(inst.runtimeState?.powered ?? inst.props?.powered ?? 1);
          const bsOutOn = bsPowered && Boolean(inst.runtimeState?.outputEnabled ?? inst.props?.outputEnabled ?? 1);
          const vSet = Number(inst.runtimeState?.voltageSet ?? inst.props?.voltageSet ?? 12.0);
          const iLim = Number(inst.runtimeState?.currentLimit ?? inst.props?.currentLimit ?? 2.5);

          inst.runtimeState.actualCurrentPos = 0;
          inst.runtimeState.actualCurrentNeg = 0;
          inst.runtimeState.actualCurrent5V = 0;
          inst.runtimeState.mode = 'CV';

          if (bsOutOn && vSet > 0) {
            const posNet = this._tracePinNet(inst.id, 'POS');
            const posGrounds = posNet.grounds;
            const posSources = posNet.sources;

            if (posGrounds.length > 0) {
              let invRSum = 0;
              for (const g of posGrounds) {
                const r = Math.max(0.1, g.resistance || 0.1);
                invRSum += 1 / r;
              }
              const loadR = invRSum > 0 ? 1 / invRSum : 999999;
              let iAct = vSet / Math.max(0.1, loadR);
              if (iAct > iLim) { iAct = iLim; inst.runtimeState.mode = 'CC'; }
              inst.runtimeState.actualCurrentPos = Math.round(iAct * 1000) / 1000;
            } else if (posSources.length <= 1) {
              inst.runtimeState.actualCurrentPos = 0;
            }

            const negNet = this._tracePinNet(inst.id, 'NEG');
            const negGrounds = negNet.grounds;
            const negSources = negNet.sources;

            if (negGrounds.length > 0) {
              let invRSumN = 0;
              for (const g of negGrounds) {
                const r = Math.max(0.1, g.resistance || 0.1);
                invRSumN += 1 / r;
              }
              const loadRN = invRSumN > 0 ? 1 / invRSumN : 999999;
              let iActN = vSet / Math.max(0.1, loadRN);
              if (iActN > iLim) { iActN = iLim; inst.runtimeState.mode = 'CC'; }
              inst.runtimeState.actualCurrentNeg = Math.round(iActN * 1000) / 1000;
            } else if (negSources.length <= 1) {
              inst.runtimeState.actualCurrentNeg = 0;
            }
          }

          if (bsPowered) {
            const vcc5vNet = this._tracePinNet(inst.id, 'VCC_5V');
            const gnd5vNet = this._tracePinNet(inst.id, 'GND_5V');
            const gnd5vGrounds = gnd5vNet.grounds;
            const gnd5vSources = gnd5vNet.sources;

            if (gnd5vGrounds.length > 0) {
              let invRSum5V = 0;
              for (const g of gnd5vGrounds) {
                const r = Math.max(0.1, g.resistance || 0.1);
                invRSum5V += 1 / r;
              }
              const loadR5V = invRSum5V > 0 ? 1 / invRSum5V : 999999;
              let iAct5V = 5.0 / Math.max(0.1, loadR5V);
              if (iAct5V > 5.0) iAct5V = 5.0;
              inst.runtimeState.actualCurrent5V = Math.round(iAct5V * 1000) / 1000;
            } else if (gnd5vSources.length <= 1) {
              inst.runtimeState.actualCurrent5V = 0;
            }
          }
          break;
        }
        case 'mb102_power': {
          const mbPowered = Boolean(inst.runtimeState?.powered ?? inst.props?.powered ?? 1);
          inst.runtimeState = inst.runtimeState || {};
          if (!mbPowered) {
            inst.runtimeState.actualCurrent_mA = 0;
            inst.runtimeState.iTop_mA = 0;
            inst.runtimeState.iBot_mA = 0;
            inst.runtimeState.iAux_mA = 0;
            inst.runtimeState.overload = false;
            inst.runtimeState.mode = 'OFF';
            break;
          }

          const topV = String(inst.runtimeState?.topVoltage ?? inst.props?.topVoltage ?? '5V');
          const botV = String(inst.runtimeState?.bottomVoltage ?? inst.props?.bottomVoltage ?? '3.3V');
          const voltageMap = { '5V': 5.0, '3.3V': 3.3, 'OFF': 0 };

          let totalCurrentA = 0;
          let iTopA = 0;
          let iBotA = 0;
          let iAuxA = 0;

          // Top rail current draw
          if (voltageMap[topV] > 0) {
            const net = this._tracePinNet(inst.id, 'vcc_t');
            if (net.grounds.length > 0) {
              let invRSum = 0;
              for (const g of net.grounds) {
                invRSum += 1 / Math.max(0.1, g.resistance || 0.1);
              }
              const loadR = invRSum > 0 ? 1 / invRSum : 999999;
              iTopA = voltageMap[topV] / Math.max(0.1, loadR);
              totalCurrentA += iTopA;
            }
          }

          // Bottom rail current draw
          if (voltageMap[botV] > 0) {
            const net = this._tracePinNet(inst.id, 'vcc_b');
            if (net.grounds.length > 0) {
              let invRSum = 0;
              for (const g of net.grounds) {
                invRSum += 1 / Math.max(0.1, g.resistance || 0.1);
              }
              const loadR = invRSum > 0 ? 1 / invRSum : 999999;
              iBotA = voltageMap[botV] / Math.max(0.1, loadR);
              totalCurrentA += iBotA;
            }
          }

          // Aux 5V current draw
          const netAux5 = this._tracePinNet(inst.id, 'aux_5v');
          if (netAux5.grounds.length > 0) {
            let invRSum = 0;
            for (const g of netAux5.grounds) {
              invRSum += 1 / Math.max(0.1, g.resistance || 0.1);
            }
            const loadR = invRSum > 0 ? 1 / invRSum : 999999;
            const iAux5 = 5.0 / Math.max(0.1, loadR);
            iAuxA += iAux5;
            totalCurrentA += iAux5;
          }

          // Aux 3.3V current draw
          const netAux3 = this._tracePinNet(inst.id, 'aux_3v3');
          if (netAux3.grounds.length > 0) {
            let invRSum = 0;
            for (const g of netAux3.grounds) {
              invRSum += 1 / Math.max(0.1, g.resistance || 0.1);
            }
            const loadR = invRSum > 0 ? 1 / invRSum : 999999;
            const iAux3 = 3.3 / Math.max(0.1, loadR);
            iAuxA += iAux3;
            totalCurrentA += iAux3;
          }

          const totalCurrent_mA = totalCurrentA * 1000;
          const isOverload = totalCurrent_mA > 800;
          inst.runtimeState.overload = isOverload;
          inst.runtimeState.mode = isOverload ? 'OVERLOAD' : 'CV';
          inst.runtimeState.actualCurrent_mA = Math.round(totalCurrent_mA * 10) / 10;
          inst.runtimeState.iTop_mA = Math.round(iTopA * 1000 * 10) / 10;
          inst.runtimeState.iBot_mA = Math.round(iBotA * 1000 * 10) / 10;
          inst.runtimeState.iAux_mA = Math.round(iAuxA * 1000 * 10) / 10;
          break;
        }
        case 'buzzer': {
          const vccNet = this._tracePinNet(inst.id, 'vcc');
          const gndNet = this._tracePinNet(inst.id, 'gnd');
          const hasVcc = vccNet.sources.length > 0 && vccNet.sources[0].voltage > 1.5;
          const hasGnd = gndNet.grounds.length > 0;
          inst.runtimeState.active = hasVcc && hasGnd;
          break;
        }
        case 'tm1637': {
          const hasVccWire = this.wires.some(w =>
            (w.from && w.from.instId === inst.id && w.from.pinId === 'VCC') ||
            (w.to && w.to.instId === inst.id && w.to.pinId === 'VCC')
          );
          const hasGndWire = this.wires.some(w =>
            (w.from && w.from.instId === inst.id && w.from.pinId === 'GND') ||
            (w.to && w.to.instId === inst.id && w.to.pinId === 'GND')
          );
          let powered = false;
          if (hasVccWire && hasGndWire) {
            const vccNet = this._tracePinNet(inst.id, 'VCC');
            const gndNet = this._tracePinNet(inst.id, 'GND');
            const hasVcc = vccNet.sources && vccNet.sources.some(s => s.voltage >= 2.0);
            const hasGnd = gndNet.grounds && gndNet.grounds.length > 0;
            powered = Boolean(hasVcc && hasGnd);
          }
          if (!inst.runtimeState) inst.runtimeState = {};
          inst.runtimeState.powered = powered;
          if (!powered) {
            inst.runtimeState.digits = [0, 0, 0, 0];
            inst.runtimeState.colon = 0;
          }
          break;
        }
        case 'seg7': {
          const segPins = ['segA', 'segB', 'segC', 'segD', 'segE', 'segF', 'segG', 'dp'];
          const segKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
          const commonAnode = !!inst.props.commonAnode;
          // Real display: COM must complete the circuit — common-cathode needs a
          // path to ground, common-anode to a supply. If COM isn't wired at all
          // we assume it's hooked up, so simple demo circuits keep working.
          const comWired = this.wires.some(w =>
            (w.from.instId === inst.id && w.from.pinId === 'com') ||
            (w.to.instId === inst.id && w.to.pinId === 'com'));
          let powered = true;
          if (comWired) {
            const comNet = this._tracePinNet(inst.id, 'com');
            powered = commonAnode ? comNet.sources.length > 0 : comNet.grounds.length > 0;
          }
          const segments = {};
          segPins.forEach((pinId, i) => {
            let bright = 0;
            const pinNum = this._getConnectedPinNum(inst.id, pinId);
            if (powered && pinNum !== null && sim && sim.pinStates) {
              const raw = sim.pinStates[`pin_${pinNum}`];
              const mode = sim.pinModes ? sim.pinModes[`pin_${pinNum}`] : undefined;
              const isInput = mode === 'INPUT' || mode === 'INPUT_PULLUP';
              if (raw !== undefined && raw !== null) {
                if (commonAnode) {
                  // Common anode: segment lights when its pin SINKS (LOW). A
                  // high-Z input can't sink current, so it stays dark even
                  // though canvas feedback may have written a 0 into the pin.
                  if (!isInput) bright = raw === 0 ? 1 : (raw <= 1 ? 0 : 1 - Math.min(raw / 255, 1));
                } else if (raw > 0) {
                  // Common cathode: lit when the pin SOURCES voltage. raw 1 =
                  // digital HIGH (full), 2..255 = PWM duty -> brightness.
                  bright = raw <= 1 ? 1 : Math.min(raw / 255, 1);
                }
              }
            } else if (powered && pinNum === null && sim && typeof sim.getPinVoltage === 'function'
              && this.wires.some(w =>
                (w.from.instId === inst.id && w.from.pinId === pinId) ||
                (w.to.instId === inst.id && w.to.pinId === pinId))) {
              // No Arduino pin on this net — resolve the far end (IC output,
              // sensor, power rail) through the wire-graph voltage walk and
              // map 0–5 V onto the 0–255 raw scale used above.
              const volts = Number(sim.getPinVoltage(inst, pinId)) || 0;
              const raw = Math.max(0, Math.min(255, Math.round(volts * 51)));
              if (commonAnode) bright = raw === 0 ? 1 : 1 - Math.min(raw / 255, 1);
              else if (raw > 0) bright = Math.min(raw / 255, 1);
            }
            segments[segKeys[i]] = bright;
          });
          inst.runtimeState.segments = segments;
          break;
        }
        case 'potentiometer': {
          const val = inst.runtimeState.value !== undefined ? inst.runtimeState.value : (inst.props.value || 512);
          const maxVal = Math.max(1, Number(inst.props.maxValue) || 1023);
          const ratio = Math.max(0, Math.min(1, val / maxVal));

          const rawRes = Number(inst.props?.resistance ?? inst.props?.value_res ?? 10000);
          const unitMult = inst.props?.unit === 'MΩ' ? 1e6 : (inst.props?.unit === 'kΩ' ? 1e3 : 1);
          const rTotal = Math.max(1, rawRes * (inst.props?.unit ? unitMult : (rawRes < 100 ? 1e3 : 1)));
          const r1W = Math.max(0.01, (1 - ratio) * rTotal);
          const rW2 = Math.max(0.01, ratio * rTotal);

          inst.runtimeState.r_total = rTotal;
          inst.runtimeState.r_1w = r1W;
          inst.runtimeState.r_w2 = rW2;
          inst.runtimeState.ratio = ratio;

          const wiperPin = this._getConnectedPinNum(inst.id, 'wiper')
            ?? this._getConnectedPinNum(inst.id, 'p2')
            ?? this._getConnectedPinNum(inst.id, 'out')
            ?? this._getConnectedPinNum(inst.id, 'w');

          let vWiper = null;
          if (this.engine) {
            vWiper = this.engine.getVoltageAtPin(inst.id, 'wiper')
              ?? this.engine.getVoltageAtPin(inst.id, 'p2')
              ?? this.engine.getVoltageAtPin(inst.id, 'out')
              ?? this.engine.getVoltageAtPin(inst.id, 'w');
          }

          if (vWiper != null) {
            inst.runtimeState.voltage = vWiper;
            const adcVal = Math.max(0, Math.min(1023, Math.round((vWiper / 5.0) * 1023)));
            inst.runtimeState.wiper = adcVal;
            if (wiperPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
              window.ArduinoSim.pinStates[`pin_${wiperPin}`] = adcVal;
            }
          } else {
            const vccNet = this._tracePinNet(inst.id, 'vcc');
            const gndNet = this._tracePinNet(inst.id, 'gnd');
            const hasGnd = gndNet.grounds.length > 0;
            if (vccNet.sources.length > 0 && hasGnd) {
              const src = vccNet.sources[0];
              const outVoltage = src.voltage * ratio;
              const adcVal = Math.round((outVoltage / 5.0) * 1023);
              inst.runtimeState.voltage = outVoltage;
              inst.runtimeState.wiper = adcVal;
              if (wiperPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
                window.ArduinoSim.pinStates[`pin_${wiperPin}`] = adcVal;
              }
            }
          }
          break;
        }
        case 'push_button': {
          const pressed = inst.runtimeState.pressed;
          const p1 = this._getConnectedPinNum(inst.id, 'p1');
          const p3 = this._getConnectedPinNum(inst.id, 'p3');
          if (p1 !== null && window.ArduinoSim) {
            const newVal = pressed ? 0 : 1;
            const curVal = window.ArduinoSim.pinStates ? (window.ArduinoSim.pinStates[`pin_${p1}`] ?? (window.ArduinoSim.pinModes?.[`pin_${p1}`] === 'INPUT_PULLUP' ? 1 : 0)) : 0;
            if (curVal !== newVal) window.ArduinoSim.setPinState(`pin_${p1}`, newVal);
          }
          break;
        }
        case 'servo': {
          if (inst.runtimeState._servoDriven) break;
          const sigPin = this._getConnectedPinNum(inst.id, 'signal');
          let pwm = 0;
          if (sigPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
            pwm = window.ArduinoSim.pinStates[`pin_${sigPin}`] || 0;
          }
          inst.runtimeState.angle = Math.round((pwm / 255) * 180);
          break;
        }
        case 'servo_continuous': {
          const sigPin = this._getConnectedPinNum(inst.id, 'signal');
          let pwm = 0;
          if (sigPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
            pwm = window.ArduinoSim.pinStates[`pin_${sigPin}`] || 0;
          }
          const center = 127;
          const speed = Math.max(-100, Math.min(100, Math.round(((pwm - center) / center) * 100)));
          inst.runtimeState.speed = speed;
          break;
        }
        case 'dip_switch': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const switches = inst.runtimeState?.switches ?? inst.props.switches ?? 0;
          for (let i = 0; i < 8; i++) {
            const pinNum = this._getConnectedPinNum(inst.id, String(i + 1));
            if (pinNum !== null) {
              sim.pinStates[`pin_${pinNum}`] = (switches >> i) & 1 ? 1 : 0;
            }
          }
          break;
        }
        case 'rotary_encoder': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const position = inst.runtimeState?.position ?? inst.props.position ?? 0;
          const pressed = inst.runtimeState?.pressed ?? inst.props.pressed ?? false;
          const aPin = this._getConnectedPinNum(inst.id, 'A');
          const bPin = this._getConnectedPinNum(inst.id, 'B');
          const swPin = this._getConnectedPinNum(inst.id, 'SW');
          if (aPin !== null) sim.pinStates[`pin_${aPin}`] = Math.abs(position) % 2;
          if (bPin !== null) sim.pinStates[`pin_${bPin}`] = Math.abs(Math.floor(position / 2)) % 2;
          if (swPin !== null) sim.pinStates[`pin_${swPin}`] = pressed ? 0 : 1;
          break;
        }
        case 'relay': {
          const sigPin = this._getConnectedPinNum(inst.id, 'sig');
          const sigOn = sigPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates
            ? !!window.ArduinoSim.pinStates[`pin_${sigPin}`] : false;
          const wasActive = inst.runtimeState.active;
          inst.runtimeState.active = sigOn;
          // Tick sound on state change
          if (wasActive !== undefined && wasActive !== sigOn) {
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'square';
              osc.frequency.value = 1200;
              gain.gain.value = 0.15;
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.05);
            } catch (e) { }
          }
          break;
        }
        case 'dc_motor': {
          let pwm = 0;

          // 1. Try Arduino PWM pin
          const inPin = this._getConnectedPinNum(inst.id, 'in');
          if (inPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
            pwm = window.ArduinoSim.pinStates[`pin_${inPin}`] || 0;
          }

          // 2. Try L298N motor driver output
          if (pwm === 0) {
            const target = this._getWireTarget(inst.id, 'in');
            if (target && target.inst.type === 'l298n') {
              const l298 = target.inst;
              const pinId = target.pinId;
              if (pinId === 'OUT1' || pinId === 'OUT2') pwm = Math.abs((l298.runtimeState?.motorA || 0)) * 255;
              else if (pinId === 'OUT3' || pinId === 'OUT4') pwm = Math.abs((l298.runtimeState?.motorB || 0)) * 255;
            }
          }

          // 3. Direct DC power (bench supply, power_5v, battery, etc.)
          let speed = Math.max(0, Math.min(1, (Number(pwm) || 0) / 255));
          if (speed === 0) {
            const inNet = this._tracePinNet(inst.id, 'in');
            const gndNet = this._tracePinNet(inst.id, 'gnd');
            const hasGnd = gndNet.grounds.length > 0;
            if (hasGnd && inNet.sources.length > 0) {
              const bestSource = inNet.sources.sort((a, b) => b.voltage - a.voltage)[0];
              if (bestSource && bestSource.voltage > 0) {
                speed = Math.min(1, bestSource.voltage / 12);
              }
            }
          }

          inst.runtimeState.speed = speed;
          inst.runtimeState.rpm = Math.round(speed * 120);
          break;
        }
        case 'l298n': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const readPin = (pid) => {
            const pn = this._getConnectedPinNum(inst.id, pid);
            return pn !== null ? (sim.pinStates[`pin_${pn}`] || 0) : 0;
          };
          const in1 = readPin('IN1'), in2 = readPin('IN2');
          const in3 = readPin('IN3'), in4 = readPin('IN4');
          const ena = readPin('ENA'), enb = readPin('ENB');
          let motorA = 0;
          if (in1 && !in2) motorA = ena / 255;
          else if (!in1 && in2) motorA = -(ena / 255);
          let motorB = 0;
          if (in3 && !in4) motorB = enb / 255;
          else if (!in3 && in4) motorB = -(enb / 255);
          inst.runtimeState.motorA = motorA;
          inst.runtimeState.motorB = motorB;
          break;
        }
        case 'ldr': {
          const aPin = this._getConnectedPinNum(inst.id, 'a');
          if (aPin !== null) {
            const val = inst.runtimeState.light !== undefined ? inst.runtimeState.light : (inst.props.light || 512);
            if (window.ArduinoSim && window.ArduinoSim.pinStates) {
              window.ArduinoSim.pinStates[`pin_${aPin}`] = val;
            }
          }
          break;
        }
        case 'pir': {
          const outPin = this._getConnectedPinNum(inst.id, 'out');
          if (outPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
            const motion = inst.runtimeState.motion !== undefined ? !!inst.runtimeState.motion : !!(inst.props.motion || 0);
            window.ArduinoSim.pinStates[`pin_${outPin}`] = motion ? 1 : 0;
          }
          break;
        }
        case 'joystick': {
          if (window.ArduinoSim && window.ArduinoSim.pinStates) {
            const xPin = this._getConnectedPinNum(inst.id, 'x');
            const yPin = this._getConnectedPinNum(inst.id, 'y');
            const swPin = this._getConnectedPinNum(inst.id, 'sw');
            const xv = inst.runtimeState.x !== undefined ? inst.runtimeState.x : (inst.props.x || 512);
            const yv = inst.runtimeState.y !== undefined ? inst.runtimeState.y : (inst.props.y || 512);
            const swPressed = inst.runtimeState.sw !== undefined ? !!inst.runtimeState.sw : !!(inst.props.sw || 0);
            if (xPin !== null) window.ArduinoSim.pinStates[`pin_${xPin}`] = xv;
            if (yPin !== null) window.ArduinoSim.pinStates[`pin_${yPin}`] = yv;
            if (swPin !== null) window.ArduinoSim.pinStates[`pin_${swPin}`] = swPressed ? 0 : 1; // INPUT_PULLUP
          }
          break;
        }

        case 'ic_555':
          this._updateIc555(inst);
          break;

        case 'ic_74hc00': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const gates = [['A1', 'B1', 'Y1'], ['A2', 'B2', 'Y2'], ['A3', 'B3', 'Y3'], ['A4', 'B4', 'Y4']];
          for (const [a, b, y] of gates) {
            const outVal = (read(a) & read(b)) ? 0 : 1;
            inst.runtimeState[y] = outVal ? 255 : 0;
            const pn = this._getConnectedPinNum(inst.id, y);
            if (pn !== null) ps[`pin_${pn}`] = outVal ? 255 : 0;
          }
          break;
        }

        case 'ic_74hc04': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const gates = [
            ['A1', 'Y1'], ['A2', 'Y2'], ['A3', 'Y3'], ['A4', 'Y4'], ['A5', 'Y5'], ['A6', 'Y6']
          ];
          for (const [a, y] of gates) {
            const outVal = read(a) ? 0 : 1;
            inst.runtimeState[y] = outVal ? 255 : 0;
            const pn = this._getConnectedPinNum(inst.id, y);
            if (pn !== null) ps[`pin_${pn}`] = outVal ? 255 : 0;
          }
          break;
        }

        case 'ic_74hc08': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const gates = [['A1', 'B1', 'Y1'], ['A2', 'B2', 'Y2'], ['A3', 'B3', 'Y3'], ['A4', 'B4', 'Y4']];
          for (const [a, b, y] of gates) {
            const outVal = read(a) & read(b);
            inst.runtimeState[y] = outVal ? 255 : 0;
            const pn = this._getConnectedPinNum(inst.id, y);
            if (pn !== null) ps[`pin_${pn}`] = outVal ? 255 : 0;
          }
          break;
        }

        case 'ic_74hc32': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const gates = [['A1', 'B1', 'Y1'], ['A2', 'B2', 'Y2'], ['A3', 'B3', 'Y3'], ['A4', 'B4', 'Y4']];
          for (const [a, b, y] of gates) {
            const outVal = read(a) | read(b);
            inst.runtimeState[y] = outVal ? 255 : 0;
            const pn = this._getConnectedPinNum(inst.id, y);
            if (pn !== null) ps[`pin_${pn}`] = outVal ? 255 : 0;
          }
          break;
        }

        case 'ic_74hc595': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };

          if (inst.runtimeState._shiftReg === undefined) inst.runtimeState._shiftReg = 0;
          if (inst.runtimeState._latchReg === undefined) inst.runtimeState._latchReg = 0;
          if (inst.runtimeState._lastSRCLK === undefined) inst.runtimeState._lastSRCLK = 0;
          if (inst.runtimeState._lastRCLK === undefined) inst.runtimeState._lastRCLK = 0;

          const srclk = read('SRCLK');
          const rclk = read('RCLK');
          const oe = read('OE');
          const srclr = read('SRCLR');

          if (srclr === 0) {
            inst.runtimeState._shiftReg = 0;
            inst.runtimeState._lastSRCLK = srclk;
            inst.runtimeState._lastRCLK = rclk;
            break;
          }

          if (srclk === 1 && inst.runtimeState._lastSRCLK === 0) {
            const ser = read('SER');
            inst.runtimeState._shiftReg = ((inst.runtimeState._shiftReg << 1) | ser) & 0xFF;
          }
          inst.runtimeState._lastSRCLK = srclk;

          if (rclk === 1 && inst.runtimeState._lastRCLK === 0) {
            inst.runtimeState._latchReg = inst.runtimeState._shiftReg;
          }
          inst.runtimeState._lastRCLK = rclk;

          const outputActive = oe === 0;
          const output = outputActive ? inst.runtimeState._latchReg : 0;
          inst.runtimeState.bits = output;

          ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].forEach((pinId, i) => {
            const bitVal = (output >> i) & 1;
            inst.runtimeState[pinId] = bitVal ? 255 : 0;
            write(pinId, bitVal);
          });
          const q7nVal = (inst.runtimeState._shiftReg >> 7) & 1;
          inst.runtimeState.QHn = q7nVal ? 255 : 0;
          write('QHn', q7nVal);
          break;
        }

        case 'ic_74hc138': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };

          const a0 = read('A0');
          const a1 = read('A1');
          const a2 = read('A2');
          const g1 = read('G1');
          const g2a = read('G2A');
          const g2b = read('G2B');

          const enabled = g1 === 1 && g2a === 0 && g2b === 0;
          const addr = (a2 << 2) | (a1 << 1) | a0;

          for (let i = 0; i < 8; i++) {
            const outVal = (enabled && i === addr) ? 0 : 1;
            inst.runtimeState[`Y${i}`] = outVal ? 255 : 0;
            write(`Y${i}`, outVal);
          }
          inst.runtimeState.activeOutput = enabled ? addr : -1;
          break;
        }

        case 'ic_74hc245': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const readVal = (id) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            return pn !== null ? (ps[`pin_${pn}`] || 0) : 0;
          };
          const writeVal = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val;
          };

          const dir = read('DIR');
          const oe = read('OE');

          inst.runtimeState.direction = dir;

          if (oe === 1) {
            for (let i = 1; i <= 8; i++) {
              inst.runtimeState[`A${i}`] = 0;
              inst.runtimeState[`B${i}`] = 0;
              writeVal(`A${i}`, 0);
              writeVal(`B${i}`, 0);
            }
          } else if (dir === 1) {
            for (let i = 1; i <= 8; i++) {
              const val = readVal(`A${i}`);
              inst.runtimeState[`B${i}`] = val;
              writeVal(`B${i}`, val);
            }
          } else {
            for (let i = 1; i <= 8; i++) {
              const val = readVal(`B${i}`);
              inst.runtimeState[`A${i}`] = val;
              writeVal(`A${i}`, val);
            }
          }
          break;
        }

        case 'ic_74hc74': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };
          // Initialize edge detectors
          if (inst.runtimeState._lastCLK1 === undefined) inst.runtimeState._lastCLK1 = 0;
          if (inst.runtimeState._lastCLK2 === undefined) inst.runtimeState._lastCLK2 = 0;
          if (inst.runtimeState.Q1 === undefined) inst.runtimeState.Q1 = 0;
          if (inst.runtimeState.Q2 === undefined) inst.runtimeState.Q2 = 0;
          // Flip-flop 1: CLR1, PRE1 are active-LOW
          const clr1 = read('CLR1');
          const pre1 = read('PRE1');
          const clk1 = read('CLK1');
          const d1 = read('D1');
          if (clr1 === 0) {
            inst.runtimeState.Q1 = 0;
          } else if (pre1 === 0) {
            inst.runtimeState.Q1 = 1;
          } else if (clk1 === 1 && inst.runtimeState._lastCLK1 === 0) {
            inst.runtimeState.Q1 = d1;
          }
          inst.runtimeState._lastCLK1 = clk1;
          write('Q1', inst.runtimeState.Q1);
          write('Q1n', inst.runtimeState.Q1 ? 0 : 1);
          // Flip-flop 2
          const clr2 = read('CLR2');
          const pre2 = read('PRE2');
          const clk2 = read('CLK2');
          const d2 = read('D2');
          if (clr2 === 0) {
            inst.runtimeState.Q2 = 0;
          } else if (pre2 === 0) {
            inst.runtimeState.Q2 = 1;
          } else if (clk2 === 1 && inst.runtimeState._lastCLK2 === 0) {
            inst.runtimeState.Q2 = d2;
          }
          inst.runtimeState._lastCLK2 = clk2;
          write('Q2', inst.runtimeState.Q2);
          write('Q2n', inst.runtimeState.Q2 ? 0 : 1);
          break;
        }

        case 'ic_74hc165': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };
          if (inst.runtimeState._lastCLK165 === undefined) inst.runtimeState._lastCLK165 = 0;
          if (inst.runtimeState.bits === undefined) inst.runtimeState.bits = 0;
          const shld = read('SHLD'); // active LOW = parallel load
          const clk = read('CLK');
          const clkInh = read('CLKINH');
          if (shld === 0) {
            // Parallel load A-H
            let val = 0;
            for (let i = 0; i < 8; i++) {
              const pinId = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][i];
              if (read(pinId)) val |= (1 << i);
            }
            inst.runtimeState.bits = val;
          } else if (clk === 1 && inst.runtimeState._lastCLK165 === 0 && clkInh === 0) {
            // Shift left, insert SER at LSB
            const ser = read('SER');
            inst.runtimeState.bits = ((inst.runtimeState.bits << 1) | ser) & 0xFF;
          }
          inst.runtimeState._lastCLK165 = clk;
          // Q7 = MSB, Q7n = !MSB
          write('Q7', (inst.runtimeState.bits >> 7) & 1);
          write('Q7n', (inst.runtimeState.bits >> 7) & 1 ? 0 : 1);
          break;
        }

        case 'ic_74hc193': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };
          if (inst.runtimeState.count === undefined) inst.runtimeState.count = 0;
          if (inst.runtimeState._lastCPU === undefined) inst.runtimeState._lastCPU = 0;
          if (inst.runtimeState._lastCPD === undefined) inst.runtimeState._lastCPD = 0;
          const mr = read('MR'); // Master Reset (active HIGH)
          const pl = read('PL'); // Parallel Load (active LOW)
          const cpu = read('CPU');
          const cpd = read('CPD');
          if (mr) {
            inst.runtimeState.count = 0;
          } else if (pl === 0) {
            // Parallel load from D0-D3 inputs
            let val = 0;
            if (read('D0')) val |= 1;
            if (read('D1')) val |= 2;
            if (read('D2')) val |= 4;
            if (read('D3')) val |= 8;
            inst.runtimeState.count = val & 0xF;
          } else {
            if (cpu === 1 && inst.runtimeState._lastCPU === 0) {
              inst.runtimeState.count = (inst.runtimeState.count + 1) & 0xF;
            }
            if (cpd === 1 && inst.runtimeState._lastCPD === 0) {
              inst.runtimeState.count = (inst.runtimeState.count - 1) & 0xF;
            }
          }
          inst.runtimeState._lastCPU = cpu;
          inst.runtimeState._lastCPD = cpd;
          const c = inst.runtimeState.count;
          inst.runtimeState.Q0 = c & 1;
          inst.runtimeState.Q1 = (c >> 1) & 1;
          inst.runtimeState.Q2 = (c >> 2) & 1;
          inst.runtimeState.Q3 = (c >> 3) & 1;
          inst.runtimeState.TCU = (c === 0xF) ? 0 : 1;
          inst.runtimeState.TCD = (c === 0x0) ? 0 : 1;
          write('Q0', c & 1); write('Q1', (c >> 1) & 1);
          write('Q2', (c >> 2) & 1); write('Q3', (c >> 3) & 1);
          write('TCU', (c === 0xF) ? 0 : 1);  // carry: LOW at count=15
          write('TCD', (c === 0x0) ? 0 : 1);  // borrow: LOW at count=0
          break;
        }

        case 'ic_74hc47': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };
          // BCD input
          let bcd = 0;
          if (read('A')) bcd |= 1;
          if (read('B')) bcd |= 2;
          if (read('C')) bcd |= 4;
          if (read('D')) bcd |= 8;
          // 7-segment decode table (active LOW: 0=on, 1=off) — segments a-g
          const segTable = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71];
          const lt = read('LT');
          const bi = read('BI');
          let segments;
          if (bi === 0) {
            segments = 0x00; // blanking
          } else if (lt === 0) {
            segments = 0x7F; // lamp test: all on
          } else {
            segments = segTable[bcd] || 0x7F;
          }
          inst.runtimeState.segments = segments;
          // Active LOW outputs: write inverted segments
          write('a', (segments & 0x01) ? 0 : 1);
          write('b', (segments & 0x02) ? 0 : 1);
          write('c', (segments & 0x04) ? 0 : 1);
          write('d', (segments & 0x08) ? 0 : 1);
          write('e', (segments & 0x10) ? 0 : 1);
          write('f', (segments & 0x20) ? 0 : 1);
          write('g', (segments & 0x40) ? 0 : 1);
          break;
        }

        case 'ic_74hc148': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) ps[`pin_${pn}`] = val ? 255 : 0;
          };
          const ei = read('EI'); // active LOW enable
          // Read inputs I0-I7 (active LOW: 0 = active)
          const inputs = [0, 1, 2, 3, 4, 5, 6, 7].map(i => !read(`I${i}`));
          let activeIdx = -1;
          for (let i = 7; i >= 0; i--) {
            if (inputs[i]) { activeIdx = i; break; }
          }
          const anyActive = activeIdx >= 0;
          if (ei === 1) {
            // Disabled: all outputs HIGH
            write('A0', 0); write('A1', 0); write('A2', 0);
            write('GS', 0); write('EO', 0);
            inst.runtimeState.code = null;
          } else {
            if (anyActive) {
              write('A0', activeIdx & 1);
              write('A1', (activeIdx >> 1) & 1);
              write('A2', (activeIdx >> 2) & 1);
              write('GS', 1); // group select active
              write('EO', 0);
            } else {
              write('A0', 1); write('A1', 1); write('A2', 1);
              write('GS', 0);
              write('EO', 1); // no input active
            }
            inst.runtimeState.code = anyActive ? activeIdx : null;
          }
          break;
        }

        case 'lm741': {
          const sim = window.ArduinoSim;
          const ps = (sim && sim.pinStates) || {};
          // Read analog voltages at IN+ and IN-
          const readAnalog = (id) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            if (pn !== null) return (ps[`pin_${pn}`] || 0) * 5.0 / 1023.0;
            // Check for IC output sources
            const wireTarget = this._getWireTarget(inst.id, id);
            if (wireTarget) {
              const other = wireTarget.inst;
              if (other.type === 'potentiometer' && (wireTarget.pinId === 'wiper' || wireTarget.pinId === 'p2' || wireTarget.pinId === 'out' || wireTarget.pinId === 'w')) {
                return other.runtimeState?.voltage ?? ((other.runtimeState?.wiper || 0) * 5.0 / 1023.0);
              }
              if (other.type === 'lm741' && wireTarget.pinId === 'OUT') {
                return other.runtimeState?.vOut || 0;
              }
            }
            return 0;
          };
          const vInp = readAnalog('INP');
          const vInn = readAnalog('INN');
          const vccp = 5.0;  // Assume 5V rail
          const vccn = 0;
          const diff = vInp - vInn;
          let vOut = diff * 100000; // High open-loop gain
          vOut = Math.max(vccn, Math.min(vccp, vOut)); // Clamp to supply rails
          inst.runtimeState.vOut = vOut;
          // Write output voltage scaled to pin state (0-1023 for 0-5V)
          const pn = this._getConnectedPinNum(inst.id, 'OUT');
          if (pn !== null) ps[`pin_${pn}`] = Math.round((vOut / 5.0) * 1023);
          break;
        }

        case 'lm358': {
          const sim = window.ArduinoSim;
          const ps = (sim && sim.pinStates) || {};
          const readV = (pid) => {
            const pn = this._getConnectedPinNum(inst.id, pid);
            if (pn !== null) return ((ps[`pin_${pn}`] || 0) / 1023.0) * 5.0;
            const target = this._getWireTarget(inst.id, pid);
            if (target) {
              const o = target.inst;
              if (o.type === 'potentiometer' && (target.pinId === 'wiper' || target.pinId === 'p2' || target.pinId === 'out' || target.pinId === 'w')) {
                return o.runtimeState?.voltage ?? (((o.runtimeState?.wiper || 0) / 1023) * 5.0);
              }
              if (o.type === 'power_5v') return 5.0;
              if (o.type === 'power_gnd') return 0;
              if (o.runtimeState?.[target.pinId] != null) return o.runtimeState[target.pinId];
            }
            return 0;
          };
          inst.runtimeState = inst.runtimeState || {};
          const diff1 = readV('1IN+') - readV('1IN-');
          const v1 = Math.max(0, Math.min(5.0, diff1 * 100000));
          inst.runtimeState['1OUT'] = v1;
          const p1 = this._getConnectedPinNum(inst.id, '1OUT');
          if (p1 !== null) ps[`pin_${p1}`] = Math.round((v1 / 5.0) * 1023);

          const diff2 = readV('2IN+') - readV('2IN-');
          const v2 = Math.max(0, Math.min(5.0, diff2 * 100000));
          inst.runtimeState['2OUT'] = v2;
          const p2 = this._getConnectedPinNum(inst.id, '2OUT');
          if (p2 !== null) ps[`pin_${p2}`] = Math.round((v2 / 5.0) * 1023);
          break;
        }

        case 'lm393': {
          const sim = window.ArduinoSim;
          const ps = (sim && sim.pinStates) || {};
          const readV = (pid) => {
            const pn = this._getConnectedPinNum(inst.id, pid);
            if (pn !== null) return ((ps[`pin_${pn}`] || 0) / 1023.0) * 5.0;
            const target = this._getWireTarget(inst.id, pid);
            if (target) {
              const o = target.inst;
              if (o.type === 'potentiometer' && (target.pinId === 'wiper' || target.pinId === 'p2' || target.pinId === 'out' || target.pinId === 'w')) {
                return o.runtimeState?.voltage ?? (((o.runtimeState?.wiper || 0) / 1023) * 5.0);
              }
              if (o.type === 'power_5v') return 5.0;
              if (o.type === 'power_gnd') return 0;
              if (o.runtimeState?.[target.pinId] != null) return o.runtimeState[target.pinId];
            }
            return 0;
          };
          inst.runtimeState = inst.runtimeState || {};
          const out1 = readV('1IN+') > readV('1IN-') ? 255 : 0;
          inst.runtimeState['1OUT'] = out1;
          const p1 = this._getConnectedPinNum(inst.id, '1OUT');
          if (p1 !== null) ps[`pin_${p1}`] = out1;

          const out2 = readV('2IN+') > readV('2IN-') ? 255 : 0;
          inst.runtimeState['2OUT'] = out2;
          const p2 = this._getConnectedPinNum(inst.id, '2OUT');
          if (p2 !== null) ps[`pin_${p2}`] = out2;
          break;
        }

        case 'lm324': {
          const sim = window.ArduinoSim;
          const ps = (sim && sim.pinStates) || {};
          const readV = (pid) => {
            const pn = this._getConnectedPinNum(inst.id, pid);
            if (pn !== null) return ((ps[`pin_${pn}`] || 0) / 1023.0) * 5.0;
            const target = this._getWireTarget(inst.id, pid);
            if (target) {
              const o = target.inst;
              if (o.type === 'potentiometer' && (target.pinId === 'wiper' || target.pinId === 'p2' || target.pinId === 'out' || target.pinId === 'w')) {
                return o.runtimeState?.voltage ?? (((o.runtimeState?.wiper || 0) / 1023) * 5.0);
              }
              if (o.type === 'power_5v') return 5.0;
              if (o.type === 'power_gnd') return 0;
              if (o.runtimeState?.[target.pinId] != null) return o.runtimeState[target.pinId];
            }
            return 0;
          };
          inst.runtimeState = inst.runtimeState || {};
          const pairs = [
            ['1IN+', '1IN-', '1OUT'],
            ['2IN+', '2IN-', '2OUT'],
            ['3IN+', '3IN-', '3OUT'],
            ['4IN+', '4IN-', '4OUT']
          ];
          for (const [inp, inn, out] of pairs) {
            const diff = readV(inp) - readV(inn);
            const v = Math.max(0, Math.min(5.0, diff * 100000));
            inst.runtimeState[out] = v;
            const pn = this._getConnectedPinNum(inst.id, out);
            if (pn !== null) ps[`pin_${pn}`] = Math.round((v / 5.0) * 1023);
          }
          break;
        }

        case 'cd4066': {
          const sim = window.ArduinoSim;
          const ps = (sim && sim.pinStates) || {};
          const readSig = (pid) => {
            const pn = this._getConnectedPinNum(inst.id, pid);
            if (pn !== null) return (ps[`pin_${pn}`] || 0);
            const target = this._getWireTarget(inst.id, pid);
            if (target) {
              const o = target.inst;
              if (o.type === 'power_5v') return 255;
              if (o.type === 'power_gnd') return 0;
              if (o.runtimeState?.[target.pinId] != null) return o.runtimeState[target.pinId];
            }
            return 0;
          };
          inst.runtimeState = inst.runtimeState || {};
          const switches = [
            ['CTL1', 'SIG1A', 'SIG1B'],
            ['CTL2', 'SIG2A', 'SIG2B'],
            ['CTL3', 'SIG3A', 'SIG3B'],
            ['CTL4', 'SIG4A', 'SIG4B']
          ];
          for (const [ctl, sigA, sigB] of switches) {
            const ctlVal = this._readDigitalInput(inst.id, ctl);
            const val = ctlVal ? readSig(sigA) : 0;
            inst.runtimeState[sigB] = val;
            const pn = this._getConnectedPinNum(inst.id, sigB);
            if (pn !== null) ps[`pin_${pn}`] = val;
          }
          break;
        }

        case 'ic_74hc14': {
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => this._writeDigitalOutput(inst.id, id, val);
          inst.runtimeState = inst.runtimeState || {};
          const gates = [['A1', 'Y1'], ['A2', 'Y2'], ['A3', 'Y3'], ['A4', 'Y4'], ['A5', 'Y5'], ['A6', 'Y6']];
          for (const [inPin, outPin] of gates) {
            const outVal = read(inPin) ? 0 : 1;
            write(outPin, outVal);
            inst.runtimeState[outPin] = outVal ? 255 : 0;
          }
          break;
        }

        case 'ic_74hc283': {
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => this._writeDigitalOutput(inst.id, id, val);
          inst.runtimeState = inst.runtimeState || {};
          const a = (read('A1') ? 1 : 0) | ((read('A2') ? 1 : 0) << 1) | ((read('A3') ? 1 : 0) << 2) | ((read('A4') ? 1 : 0) << 3);
          const b = (read('B1') ? 1 : 0) | ((read('B2') ? 1 : 0) << 1) | ((read('B3') ? 1 : 0) << 2) | ((read('B4') ? 1 : 0) << 3);
          const c0 = read('C0') ? 1 : 0;
          const sum = a + b + c0;
          const s1 = sum & 1;
          const s2 = (sum >> 1) & 1;
          const s3 = (sum >> 2) & 1;
          const s4 = (sum >> 3) & 1;
          const c4 = (sum >> 4) & 1;
          write('S1', s1); inst.runtimeState['S1'] = s1 ? 255 : 0;
          write('S2', s2); inst.runtimeState['S2'] = s2 ? 255 : 0;
          write('S3', s3); inst.runtimeState['S3'] = s3 ? 255 : 0;
          write('S4', s4); inst.runtimeState['S4'] = s4 ? 255 : 0;
          write('C4', c4); inst.runtimeState['C4'] = c4 ? 255 : 0;
          inst.runtimeState.sum = sum & 0x0F;
          break;
        }

        case 'ic_74hc85': {
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => this._writeDigitalOutput(inst.id, id, val);
          inst.runtimeState = inst.runtimeState || {};
          const a = (read('A0') ? 1 : 0) | ((read('A1') ? 1 : 0) << 1) | ((read('A2') ? 1 : 0) << 2) | ((read('A3') ? 1 : 0) << 3);
          const b = (read('B0') ? 1 : 0) | ((read('B1') ? 1 : 0) << 1) | ((read('B2') ? 1 : 0) << 2) | ((read('B3') ? 1 : 0) << 3);
          const iG = read('I_AGT_B');
          const iL = read('I_ALT_B');
          const iE = read('I_AEQ_B');
          let oG = 0, oL = 0, oE = 0;
          if (a > b) {
            oG = 1;
          } else if (a < b) {
            oL = 1;
          } else {
            // Cascaded
            if (iE || (!iG && !iL)) oE = 1;
            else if (iG && !iL) oG = 1;
            else if (iL && !iG) oL = 1;
          }
          write('QA_GT_B', oG); inst.runtimeState['QA_GT_B'] = oG ? 255 : 0;
          write('QA_EQ_B', oE); inst.runtimeState['QA_EQ_B'] = oE ? 255 : 0;
          write('QA_LT_B', oL); inst.runtimeState['QA_LT_B'] = oL ? 255 : 0;
          break;
        }

        case 'ic_74hc151': {
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => this._writeDigitalOutput(inst.id, id, val);
          inst.runtimeState = inst.runtimeState || {};
          const g = read('G'); // active LOW strobe
          if (g) {
            write('Y', 0); inst.runtimeState['Y'] = 0;
            write('W', 1); inst.runtimeState['W'] = 255;
          } else {
            const s = (read('A') ? 1 : 0) | ((read('B') ? 1 : 0) << 1) | ((read('C') ? 1 : 0) << 2);
            const d = read(`D${s}`) ? 1 : 0;
            write('Y', d); inst.runtimeState['Y'] = d ? 255 : 0;
            write('W', d ? 0 : 1); inst.runtimeState['W'] = d ? 0 : 255;
          }
          break;
        }

        case 'ic_74hc76': {
          const read = (id) => this._readDigitalInput(inst.id, id);
          const write = (id, val) => this._writeDigitalOutput(inst.id, id, val);
          inst.runtimeState = inst.runtimeState || {};
          const rs = inst.runtimeState;
          if (rs.q1 === undefined) rs.q1 = 0;
          if (rs.q2 === undefined) rs.q2 = 0;

          // Channel 1
          const pre1 = read('1PRE'); // active LOW
          const clr1 = read('1CLR'); // active LOW
          const clk1 = read('1CLK');
          const prevClk1 = rs.prevClk1 ?? 1;
          rs.prevClk1 = clk1;

          if (!pre1 && clr1) rs.q1 = 1;
          else if (pre1 && !clr1) rs.q1 = 0;
          else if (!pre1 && !clr1) rs.q1 = 1;
          else if (prevClk1 === 1 && clk1 === 0) { // falling edge
            const j1 = read('1J') ? 1 : 0;
            const k1 = read('1K') ? 1 : 0;
            if (j1 && !k1) rs.q1 = 1;
            else if (!j1 && k1) rs.q1 = 0;
            else if (j1 && k1) rs.q1 = rs.q1 ? 0 : 1;
          }
          write('1Q', rs.q1); inst.runtimeState['1Q'] = rs.q1 ? 255 : 0;
          write('1Qn', rs.q1 ? 0 : 1); inst.runtimeState['1Qn'] = rs.q1 ? 0 : 255;

          // Channel 2
          const pre2 = read('2PRE');
          const clr2 = read('2CLR');
          const clk2 = read('2CLK');
          const prevClk2 = rs.prevClk2 ?? 1;
          rs.prevClk2 = clk2;

          if (!pre2 && clr2) rs.q2 = 1;
          else if (pre2 && !clr2) rs.q2 = 0;
          else if (!pre2 && !clr2) rs.q2 = 1;
          else if (prevClk2 === 1 && clk2 === 0) { // falling edge
            const j2 = read('2J') ? 1 : 0;
            const k2 = read('2K') ? 1 : 0;
            if (j2 && !k2) rs.q2 = 1;
            else if (!j2 && k2) rs.q2 = 0;
            else if (j2 && k2) rs.q2 = rs.q2 ? 0 : 1;
          }
          write('2Q', rs.q2); inst.runtimeState['2Q'] = rs.q2 ? 255 : 0;
          write('2Qn', rs.q2 ? 0 : 1); inst.runtimeState['2Qn'] = rs.q2 ? 0 : 255;
          break;
        }

        /* â”€â”€ MPU6050 IMU (I2C sensor — writes accel values to pin states) â”€â”€ */
        case 'mpu6050': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const defaults = { accelX: 0, accelY: 0, accelZ: 1024, gyroX: 0, gyroY: 0, gyroZ: 0 };
          for (const [key, fallback] of Object.entries(defaults)) {
            if (inst.runtimeState[key] === undefined) {
              inst.runtimeState[key] = inst.props[key] ?? fallback;
            }
          }
          break;
        }

        /* â”€â”€ DS3231 RTC (I2C sensor — provides time/date via registers) â”€â”€ */
        case 'ds3231': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          if (!inst.runtimeState) inst.runtimeState = {};
          const rs = inst.runtimeState;
          const pr = inst.props || {};
          if (!rs._initialized) {
            rs._initialized = true;
            rs.hour = pr.hour ?? 12;
            rs.minute = pr.minute ?? 0;
            rs.second = pr.second ?? 0;
            rs.day = pr.day ?? 1;
            rs.month = pr.month ?? 1;
            rs.year = pr.year ?? 26;
            rs.temperature = pr.temperature ?? 25.0;
            rs._lastTick = sim.simTime ?? 0;
            rs.alarm1Enabled = false;
            rs.alarm2Enabled = false;
            rs.alarm1Flag = false;
            rs.alarm2Flag = false;
          }
          /* Advance clock by elapsed sim-time */
          const now = sim.simTime ?? 0;
          const elapsed = now - (rs._lastTick || 0);
          rs._lastTick = now;
          if (elapsed > 0) {
            rs.second += Math.floor(elapsed / 1000);
            while (rs.second >= 60) { rs.second -= 60; rs.minute++; }
            while (rs.second < 0) { rs.second += 60; rs.minute--; }
            while (rs.minute >= 60) { rs.minute -= 60; rs.hour++; }
            while (rs.minute < 0) { rs.minute += 60; rs.hour--; }
            while (rs.hour >= 24) { rs.hour -= 24; rs.day++; }
            while (rs.hour < 0) { rs.hour += 24; rs.day--; }
            const daysInMonth = [31, (rs.year % 4 === 0 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const maxDay = daysInMonth[(rs.month - 1)] || 31;
            while (rs.day > maxDay) { rs.day -= maxDay; rs.month++; }
            while (rs.day < 1) { rs.month--; rs.day += (daysInMonth[(rs.month - 1)] || 31); }
            while (rs.month > 12) { rs.month -= 12; rs.year++; }
            while (rs.month < 1) { rs.month += 12; rs.year--; }
          }
          break;
        }

        /* â”€â”€ 28BYJ-48 Stepper Motor (reads 4 digital pins, computes angle) â”€â”€ */
        case 'stepper_28byj': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const ps = sim.pinStates;
          const readBit = (id) => {
            const pn = this._getConnectedPinNum(inst.id, id);
            return pn !== null ? ((ps[`pin_${pn}`] || 0) > 0 ? 1 : 0) : 0;
          };
          const in1 = readBit('IN1'), in2 = readBit('IN2');
          const in3 = readBit('IN3'), in4 = readBit('IN4');
          // Half-step sequence lookup: pattern ← step delta
          const pattern = (in1) | (in2 << 1) | (in3 << 2) | (in4 << 3);
          const prev = inst.runtimeState._lastPattern ?? 0;
          const stepAngle = 5.625 / 64;

          // Preferred: track the Stepper library object's position so CW/CCW
          // and multi-step frames are rendered exactly (delta carries sign).
          let matched = null;
          const pinNums = ['IN1', 'IN2', 'IN3', 'IN4']
            .map(id => this._getConnectedPinNum(inst.id, id));
          if (sim._steppers && pinNums.every(p => p !== null)) {
            const want = [...new Set(pinNums)].sort((a, b) => a - b).join(',');
            for (const k in sim._steppers) {
              const s = sim._steppers[k];
              const have = [...new Set([s.pin1, s.pin2, s.pin3, s.pin4].filter(p => p != null))]
                .sort((a, b) => a - b).join(',');
              if (have === want) { matched = s; break; }
            }
          }
          if (matched) {
            if (inst.runtimeState._lastPos !== undefined) {
              const delta = matched.pos - inst.runtimeState._lastPos;
              if (delta) inst.runtimeState.angle = (inst.runtimeState.angle ?? 0) + delta * stepAngle;
            }
            inst.runtimeState._lastPos = matched.pos;
          } else if (pattern !== 0 && pattern !== prev) {
            // Fallback: no Stepper object — any coil change = one step forward
            inst.runtimeState.angle = (inst.runtimeState.angle ?? 0) + stepAngle;
          }
          inst.runtimeState._lastPattern = pattern;
          inst.runtimeState.active = pattern !== 0 || (!!matched && matched.pos !== matched.target);
          break;
        }

        /* â”€â”€ WS2812B NeoPixel (single LED — reads color from props/runtimeState) â”€â”€ */
        case 'neopixel': {
          if (inst.runtimeState.r === undefined) inst.runtimeState.r = inst.props.r ?? 0;
          if (inst.runtimeState.g === undefined) inst.runtimeState.g = inst.props.g ?? 0;
          if (inst.runtimeState.b === undefined) inst.runtimeState.b = inst.props.b ?? 0;
          if (inst.runtimeState.brightness === undefined) inst.runtimeState.brightness = inst.props.brightness ?? 255;
          break;
        }

        /* â”€â”€ WS2812B NeoPixel Strip (8-pixel — reads pixel array from runtimeState) â”€â”€ */
        case 'neopixel_strip': {
          const npStripBri = inst.props.brightness ?? 255;
          if (inst.runtimeState.brightness === undefined) inst.runtimeState.brightness = npStripBri;
          if (!Array.isArray(inst.runtimeState.pixels)) {
            const numPx = inst.props.numPixels || 8;
            inst.runtimeState.pixels = Array(numPx).fill({ r: inst.props.r ?? 0, g: inst.props.g ?? 0, b: inst.props.b ?? 0 });
          }
          break;
        }

        /* â”€â”€ WS2812B NeoPixel Ring (12-pixel — reads pixel array from runtimeState) â”€â”€ */
        case 'neopixel_ring': {
          const npRingBri = inst.props.brightness ?? 255;
          if (inst.runtimeState.brightness === undefined) inst.runtimeState.brightness = npRingBri;
          if (!Array.isArray(inst.runtimeState.pixels)) {
            const numPx = inst.props.numPixels || 12;
            inst.runtimeState.pixels = Array(numPx).fill({ r: inst.props.r ?? 0, g: inst.props.g ?? 0, b: inst.props.b ?? 0 });
          }
          break;
        }

        /* â”€â”€ WS2812B NeoPixel 8x8 Matrix (64-pixel — reads pixel array from runtimeState) â”€â”€ */
        case 'neopixel_8x8_matrix': {
          const npRingBri = inst.props.brightness ?? 255;
          if (inst.runtimeState.brightness === undefined) inst.runtimeState.brightness = npRingBri;
          if (!Array.isArray(inst.runtimeState.pixels)) {
            const numPx = inst.props.numPixels || 64;
            inst.runtimeState.pixels = Array(numPx).fill({ r: inst.props.r ?? 0, g: inst.props.g ?? 0, b: inst.props.b ?? 0 });
          }
          break;
        }

        /* â”€â”€ IR Obstacle Sensor (writes digital to connected pin) â”€â”€ */
        case 'ir_obstacle': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const detected = inst.runtimeState?.detected ?? inst.props.detected ?? 0;
          inst.runtimeState.detected = detected;
          inst.runtimeState.OUT = detected ? 0 : 1;
          const outPn = this._getConnectedPinNum(inst.id, 'OUT');
          if (outPn !== null) sim.pinStates[`pin_${outPn}`] = detected ? 0 : 1;
          break;
        }

        /* â”€â”€ Flex Sensor (writes analog value to connected pin) â”€â”€ */
        case 'flex_sensor': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const bend = inst.runtimeState?.bend ?? inst.props.bend ?? 0;
          inst.runtimeState.bend = bend;
          const sigPn = this._getConnectedPinNum(inst.id, 'SIG');
          if (sigPn !== null) sim.pinStates[`pin_${sigPn}`] = bend;
          break;
        }

        /* â”€â”€ NTC Thermistor (writes analog value to connected pin) â”€â”€ */
        case 'thermistor': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;
          const temp = inst.runtimeState?.temperature ?? inst.props.temperature ?? 25;
          inst.runtimeState.temperature = temp;
          // Convert temperature to analog value (simplified: 0-1023 maps to -10-80°C)
          const analogVal = Math.round(((temp + 10) / 90) * 1023);
          const p1Pn = this._getConnectedPinNum(inst.id, 'p1');
          if (p1Pn !== null) sim.pinStates[`pin_${p1Pn}`] = Math.max(0, Math.min(1023, analogVal));
          break;
        }

        /* â”€â”€ 1N4007 Diode (pass-through with forward voltage drop) â”€â”€ */
        case 'diode_1n4007': {
          const anodeVoltage = this.engine.getVoltageAtPin(inst.id, 'anode');
          const cathodeVoltage = this.engine.getVoltageAtPin(inst.id, 'cathode');
          inst.runtimeState.conducting = anodeVoltage - cathodeVoltage >= 0.65;
          break;
        }

        /* â”€â”€ Digital Multimeter — measures voltage / resistance / continuity â”€â”€ */
        case 'multimeter': {
          // props.mode is the source of truth — runtimeState.mode is only a
          // mirror, otherwise a mode switch after the first tick is ignored.
          const mode = inst.props?.mode || inst.runtimeState?.mode || 'V_DC';

          // Use ElectricalEngine's solved voltages for accurate readings
          // (accounts for voltage division through resistors)
          const vRed = this.engine.getVoltageAtPin(inst.id, 'probe_red');
          const vCom = this.engine.getVoltageAtPin(inst.id, 'probe_com');

          let displayText = '0.000';
          let displayUnit = 'V';
          let displayMode = 'DC';
          let displayBeep = false;

          switch (mode) {
            case 'V_DC': {
              const diff = vRed - vCom;
              const absV = Math.abs(diff);
              const sign = diff < 0 ? '-' : '';
              let disp = absV;
              let pfx = '';
              if (absV >= 1e6) { disp = absV / 1e6; pfx = 'M'; }
              else if (absV >= 1e3) { disp = absV / 1e3; pfx = 'k'; }
              else if (absV > 0 && absV < 0.001) { disp = absV * 1e6; pfx = 'µ'; }
              else if (absV > 0 && absV < 1) { disp = absV * 1e3; pfx = 'm'; }
              const decimals = disp >= 100 ? 1 : 3;
              displayText = sign + disp.toFixed(decimals);
              displayUnit = pfx + 'V';
              displayMode = 'DC';
              break;
            }
            case 'V_AC': {
              const rms = Math.abs(vRed - vCom);
              let disp = rms;
              let pfx = '';
              if (rms >= 1e6) { disp = rms / 1e6; pfx = 'M'; }
              else if (rms >= 1e3) { disp = rms / 1e3; pfx = 'k'; }
              else if (rms > 0 && rms < 1) { disp = rms * 1e3; pfx = 'm'; }
              const decimals = disp >= 100 ? 1 : 3;
              displayText = disp.toFixed(decimals);
              displayUnit = pfx + 'V';
              displayMode = 'AC';
              break;
            }
            case 'A_DC': {
              // The three jacks are shorted inside the meter, so branch currents
              // are recovered with KCL over the wire group attached to each jack.
              // The largest group sum is the shunt current — this works for any
              // wiring style (V/Ω+COM, 10A+COM, either polarity).
              const absA = Math.abs(this._mmMeasureCurrent(inst));
              let disp, pfx;
              if (absA >= 1) { disp = absA; pfx = 'A'; }
              else if (absA >= 0.001) { disp = absA * 1000; pfx = 'mA'; }
              else { disp = absA * 1e6; pfx = 'µA'; }
              const decimals = disp >= 100 ? 1 : 3;
              displayText = disp.toFixed(decimals);
              displayUnit = pfx;
              displayMode = 'DC';
              inst.runtimeState.amps = absA;
              break;
            }
            case 'RES': {
              const redNet = this._tracePinNet(inst.id, 'probe_red');
              const comNet = this._tracePinNet(inst.id, 'probe_com');
              const redHasSrc = redNet.sources.length > 0;
              const comHasSrc = comNet.sources.length > 0;

              if (redHasSrc && comHasSrc) {
                displayText = 'Err';
                displayUnit = '';
                displayMode = 'Ω';
              } else {
                let totalR = this._measureResistanceBetween(inst.id, 'probe_red', inst.id, 'probe_com');
                if ((!Number.isFinite(totalR) || totalR <= 0) && this.engine && typeof this.engine.measureResistance === 'function') {
                  totalR = this.engine.measureResistance(inst.id, 'probe_red', inst.id, 'probe_com');
                }
                if (totalR < Infinity && totalR > 0) {
                  let disp = totalR;
                  let pfx = '';
                  if (totalR >= 1e6) { disp = totalR / 1e6; pfx = 'M'; }
                  else if (totalR >= 1e3) { disp = totalR / 1e3; pfx = 'k'; }
                  const decimals = disp >= 100 ? 1 : 2;
                  displayText = disp.toFixed(decimals);
                  displayUnit = pfx + 'Ω';
                  displayMode = 'AUTO';
                } else {
                  displayText = 'O.L';
                  displayUnit = 'MΩ';
                  displayMode = 'AUTO';
                }
              }
              break;
            }
            case 'CONT': {
              let totalR = this._measureResistanceBetween(inst.id, 'probe_red', inst.id, 'probe_com');
              if ((!Number.isFinite(totalR) || totalR <= 0) && this.engine && typeof this.engine.measureResistance === 'function') {
                totalR = this.engine.measureResistance(inst.id, 'probe_red', inst.id, 'probe_com');
              }
              const threshold = 40;
              if (totalR <= threshold && totalR > 0) {
                displayText = totalR.toFixed(1);
                displayUnit = 'Ω';
                displayBeep = true;
              } else {
                displayText = 'O.L';
                displayUnit = 'Ω';
                displayBeep = false;
              }
              displayMode = 'CONT';
              break;
            }
            case 'MV_DC': {
              const diff = (vRed - vCom) * 1000;
              const sign = diff < 0 ? '-' : '';
              displayText = sign + Math.abs(diff).toFixed(1);
              displayUnit = 'mV';
              displayMode = 'DC';
              break;
            }
            case 'DIODE': {
              const diff = vRed - vCom;
              if (diff > 0.05 && diff < 3.0) {
                displayText = diff.toFixed(3);
              } else {
                displayText = 'O.L';
              }
              displayUnit = 'V';
              displayMode = 'DIODE';
              break;
            }
            case 'A_AC': {
              const absA = Math.abs(this._mmMeasureCurrent(inst));
              let disp, pfx;
              if (absA >= 1) { disp = absA; pfx = 'A'; }
              else if (absA >= 0.001) { disp = absA * 1000; pfx = 'mA'; }
              else { disp = absA * 1e6; pfx = 'µA'; }
              const decimals = disp >= 100 ? 1 : 3;
              displayText = disp.toFixed(decimals);
              displayUnit = pfx;
              displayMode = 'AC';
              inst.runtimeState.amps = absA;
              break;
            }
          }

          inst.runtimeState.displayText = displayText;
          inst.runtimeState.displayUnit = displayUnit;
          inst.runtimeState.displayMode = displayMode;
          inst.runtimeState.displayBeep = displayBeep;
          inst.runtimeState.mode = mode;
          break;
        }

        /* ------ Dual Channel Function Generator — outputs voltage waveforms ------ */
        case 'func_gen': {
          const def = window.ArduinoComponents?.COMPONENT_DEFS?.func_gen;
          if (def && typeof def.step === 'function') {
            def.step(inst, window.ArduinoSim);
          }
          break;
        }

        case 'lm35_sensor': {
          const outPin = this._getConnectedPinNum(inst.id, 'OUT');
          if (outPin !== null && window.ArduinoSim && window.ArduinoSim.pinStates) {
            // Temperature in °C (default 25°C)
            const temp = inst.runtimeState.temp !== undefined
              ? inst.runtimeState.temp
              : (inst.props.temp ?? 25);

            // LM35 outputs 10mV/°C (0.01V/°C). Map to 10-bit ADC (0-1023) based on a 5.0V VREF:
            const voltage = Math.max(0, temp * 0.01);
            const adcVal = Math.max(0, Math.min(1023, Math.round((voltage / 5.0) * 1023)));

            window.ArduinoSim.pinStates[`pin_${outPin}`] = adcVal;
          }
          break;
        }

        case 'keypad_4x4': {
          // Keypad column state is computed live in digitalRead() — no cached update needed.
          break;
        }

        /* ------ MAX7219 — SPI bit-bang decoder ------ */
        case 'max7219': {
          const sim = window.ArduinoSim;
          if (!sim || !sim.pinStates) break;

          const dinPn = this._getConnectedPinNum(inst.id, 'DIN');
          const csPn = this._getConnectedPinNum(inst.id, 'CS');
          const clkPn = this._getConnectedPinNum(inst.id, 'CLK');

          const dinVal = dinPn !== null ? (sim.pinStates[`pin_${dinPn}`] ? 1 : 0) : this._readDigitalInput(inst.id, 'DIN');
          const csVal = csPn !== null ? (sim.pinStates[`pin_${csPn}`] ? 1 : 0) : this._readDigitalInput(inst.id, 'CS');
          const clkVal = clkPn !== null ? (sim.pinStates[`pin_${clkPn}`] ? 1 : 0) : this._readDigitalInput(inst.id, 'CLK');

          if (!inst.runtimeState._spi) {
            inst.runtimeState._spi = {
              shiftReg: 0,
              bitCount: 0,
              prevClk: 0,
              prevCs: 1,
              rows: new Uint8Array(8),
              regs: {},
            };
          }
          const spi = inst.runtimeState._spi;
          const prevCs = spi.prevCs;
          const prevClk = spi.prevClk;

          if (prevCs === 1 && csVal === 0) {
            spi.shiftReg = 0;
            spi.bitCount = 0;
          }

          if (csVal === 0 && prevClk === 0 && clkVal === 1) {
            spi.shiftReg = ((spi.shiftReg << 1) | dinVal) & 0xFFFF;
            spi.bitCount++;
          }

          if (prevCs === 0 && csVal === 1 && spi.bitCount >= 16) {
            const addr = (spi.shiftReg >> 8) & 0x0F;
            const data = spi.shiftReg & 0xFF;
            spi.regs[addr] = data;

            if (addr >= 1 && addr <= 8) {
              spi.rows[addr - 1] = data;
            }
          }

          spi.prevClk = clkVal;
          spi.prevCs = csVal;
          break;
        }
      }
    }
  }

  // Electrical graph network tracer: traverses wires and series components to discover sources & ground nodes
  /**
   * Current through the DMM shunt (amps), for A_DC / A_AC modes.
   * In current mode the meter internally commons all three jacks, so the
   * branch currents are recovered with KCL over the wire group attached to
   * each jack (wires only — never through the meter's internal short).
   * Returns the largest group sum, which makes the reading independent of
   * which jacks the circuit uses (V/Ω + COM, 10A + COM) and of polarity.
   */
  _mmMeasureCurrent(inst) {
    const engine = this.engine;
    const meterNet = engine.getNetForPin(inst.id, 'probe_red')
      || engine.getNetForPin(inst.id, 'probe_com');
    if (!meterNet) return 0;
    const vNet = meterNet.voltage;

    const branchResistance = (comp) => {
      switch (comp.type) {
        case 'resistor':
          return (Number(comp.props?.value) || 220)
            * (comp.props?.unit === 'kΩ' ? 1e3 : comp.props?.unit === 'MΩ' ? 1e6 : 1);
        case 'bulb_12v': return 12;
        case 'led': case 'led_green': case 'led_blue':
        case 'led_yellow': case 'led_orange': case 'led_white': return 20;
        case 'diode_1n4007': return 10;
        default: return null;
      }
    };

    // All pins reachable from a jack through wires only
    const wireGroup = (pinId) => {
      const group = new Set();
      const queue = [`${inst.id}:${pinId}`];
      while (queue.length > 0) {
        const key = queue.shift();
        if (group.has(key)) continue;
        group.add(key);
        const sep = key.indexOf(':');
        const cInstId = key.slice(0, sep);
        const cPinId = key.slice(sep + 1);
        for (const w of this.wires) {
          let ni, np;
          if (w.from.instId === cInstId && w.from.pinId === cPinId) { ni = w.to.instId; np = w.to.pinId; }
          else if (w.to.instId === cInstId && w.to.pinId === cPinId) { ni = w.from.instId; np = w.from.pinId; }
          else continue;
          queue.push(`${ni}:${np}`);
        }
      }
      return group;
    };

    // Sum of (V_meter − V_outside)/R over 2-terminal passives straddling the group
    const groupAmps = (group) => {
      const defs = window.ArduinoComponents?.COMPONENT_DEFS || {};
      let sum = 0;
      for (const comp of this.components) {
        if (comp.type === 'npn_transistor' || comp.type === 'pnp_transistor') {
          const rs = comp.runtimeState || {};
          const cIn = group.has(`${comp.id}:collector`);
          const bIn = group.has(`${comp.id}:base`);
          const eIn = group.has(`${comp.id}:emitter`);
          if (cIn && !bIn && !eIn) sum += (rs.ic || 0);
          else if (bIn && !cIn && !eIn) sum += (rs.ib || 0);
          else if (eIn && !cIn && !bIn) sum += (rs.ie || 0);
          continue;
        }
        if (comp.type === 'n_mosfet' || comp.type === 'p_mosfet' || comp.type === 'n_channel_mosfet' || comp.type === 'p_channel_mosfet'
          || comp.type === 'n_jfet' || comp.type === 'p_jfet' || comp.type === 'n_channel_jfet' || comp.type === 'p_channel_jfet') {
          const rs = comp.runtimeState || {};
          const dIn = group.has(`${comp.id}:drain`);
          const sIn = group.has(`${comp.id}:source`);
          const gIn = group.has(`${comp.id}:gate`);
          if (dIn && !sIn && !gIn) sum += (rs.id || 0);
          else if (sIn && !dIn && !gIn) sum += (rs.is_current ?? rs.id ?? 0);
          else if (gIn && !dIn && !sIn) sum += (rs.ig || 0);
          continue;
        }
        if (comp.type === 'potentiometer') {
          const rs = comp.runtimeState || {};
          const r1W = rs.r_1w || 5000;
          const rW2 = rs.r_w2 || 5000;
          const in1 = group.has(`${comp.id}:vcc`) || group.has(`${comp.id}:p1`) || group.has(`${comp.id}:cw`) || group.has(`${comp.id}:t1`);
          const inW = group.has(`${comp.id}:wiper`) || group.has(`${comp.id}:p2`) || group.has(`${comp.id}:out`) || group.has(`${comp.id}:w`);
          const in2 = group.has(`${comp.id}:gnd`) || group.has(`${comp.id}:p3`) || group.has(`${comp.id}:ccw`) || group.has(`${comp.id}:t2`);

          const net1 = engine.getNetForPin(comp.id, 'vcc');
          const netW = engine.getNetForPin(comp.id, 'wiper');
          const net2 = engine.getNetForPin(comp.id, 'gnd');

          if (in1 !== inW && net1 && netW) {
            const outNet = in1 ? netW : net1;
            sum += (vNet - outNet.voltage) / r1W;
          }
          if (inW !== in2 && netW && net2) {
            const outNet = inW ? net2 : netW;
            sum += (vNet - outNet.voltage) / rW2;
          }
          if (!netW && in1 !== in2 && net1 && net2) {
            const rTot = rs.r_total || (r1W + rW2);
            const outNet = in1 ? net2 : net1;
            sum += (vNet - outNet.voltage) / rTot;
          }
          continue;
        }
        const r = branchResistance(comp);
        if (r == null || r <= 0) continue;
        const pins = defs[comp.type]?.pins;
        if (!pins || pins.length !== 2) continue;
        const key1 = `${comp.id}:${pins[0].id}`;
        const key2 = `${comp.id}:${pins[1].id}`;
        const in1 = group.has(key1);
        const in2 = group.has(key2);
        if (in1 === in2) continue; // both sides inside or outside
        const net1 = engine.getNetForPin(comp.id, pins[0].id);
        const net2 = engine.getNetForPin(comp.id, pins[1].id);
        if (!net1 || !net2) continue;
        const outsideNet = in1 ? net2 : net1;
        sum += (vNet - outsideNet.voltage) / r;
      }
      return sum;
    };

    let best = 0;
    for (const pinId of ['probe_com', 'probe_red', 'probe_amp']) {
      const amps = Math.abs(groupAmps(wireGroup(pinId)));
      if (amps > best) best = amps;
    }
    return best;
  }

  /* ── 555 timer ──────────────────────────────────────────────────
     Driven from _updateSimStateInner. `now` is injectable so tests can
     step time deterministically instead of waiting on Date.now(). */
  _updateIc555(inst, now = Date.now()) {
    const sim = window.ArduinoSim;
    const rs = inst.runtimeState;
    if (!sim || !sim.pinStates) return;

    const outPin = this._getConnectedPinNum(inst.id, 'OUT');
    const disPin = this._getConnectedPinNum(inst.id, 'DIS');
    const thrPin = this._getConnectedPinNum(inst.id, 'THR');
    const trigPin = this._getConnectedPinNum(inst.id, 'TRIG');

    const write = (pin, val) => { if (pin !== null) sim.pinStates[`pin_${pin}`] = val; };

    // Power sanity: no supply or no return path -> output parks low
    const hasVcc = this._tracePinNet(inst.id, 'VCC').sources.some(s => s.voltage >= 4.5);
    const hasGnd = this._tracePinNet(inst.id, 'GND').grounds.length > 0;
    if (!hasVcc || !hasGnd) {
      rs.outHigh = false;
      rs.OUT = 0;
      rs.DIS = 255;
      rs.pulseProgress = 0;
      write(outPin, 0);
      write(disPin, 255);
      return;
    }

    // RST is active-low: an explicit ground (or a board pin driven LOW) resets.
    // Floating / tied to VCC leaves the timer running.
    const resetActive = this._tracePinNet(inst.id, 'RST').grounds.length === 0;
    if (!resetActive) {
      rs.outHigh = false;
      rs.OUT = 0;
      rs.DIS = 0;
      rs._mState = 'idle';
      rs._capVoltage = 0;
      rs.pulseProgress = 0;
      write(outPin, 0);
      write(disPin, 0);
      return;
    }

    const mode = inst.props?.mode === 'monostable' ? 'monostable' : 'astable';
    if (rs._mode !== mode) {
      rs._mode = mode;
      rs._capVoltage = 0;
      rs._mState = 'idle';
      rs.outHigh = false;
      rs.pulseProgress = 0;
      delete rs.tPulse;
      delete rs._pulseT0;
    }

    if (rs._lastTime == null) rs._lastTime = now;
    if (rs._capVoltage === undefined) rs._capVoltage = 0;
    const dt = Math.max(0, (now - rs._lastTime) / 1000);
    rs._lastTime = now;

    const { r1, r2, capC } = this._resolve555RC(inst);

    if (mode === 'monostable') {
      this._step555Monostable(inst, now, r1, capC);
    } else {
      this._step555Astable(inst, dt, r1, r2, capC);
    }

    const outVal = rs.outHigh ? 255 : 0;
    // DIS is released while the timing cap charges and pulled to GND to
    // discharge it — it must never read as a ground during the charge phase.
    const disVal = rs.outHigh ? 255 : 0;
    rs.OUT = outVal;
    rs.DIS = disVal;
    write(outPin, outVal);
    write(disPin, disVal);

    const capScaled = Math.round(rs._capVoltage * 255);
    write(thrPin, capScaled);
    write(trigPin, capScaled);
  }

  /* Monostable (one-shot): a TRIG pulse at/below 1/3 VCC asserts OUT for
     t = 1.1 · R · C, then the cap reaches 2/3 VCC and OUT drops again.
     The trigger is level-sensitive, exactly as in the datasheet: holding
     TRIG low keeps OUT asserted and holds the cap discharged. */
  _step555Monostable(inst, now, rTiming, capC) {
    const rs = inst.runtimeState;

    // 1.1·R·C when the timing network resolves, else the pulseTime prop
    let tPulse = (rTiming && capC) ? 1.1 * rTiming * capC : 0;
    if (!(tPulse > 0)) tPulse = Math.max(0.01, Number(inst.props.pulseTime) || 1);
    rs.tPulse = tPulse;

    const trigLow = this._tracePinNet(inst.id, 'TRIG').grounds.length > 0;

    if (trigLow) {
      rs._mState = 'timing';
      rs._pulseT0 = now;
      rs.outHigh = true;
      rs._capVoltage = 0;
      rs.pulseProgress = 0;
      return;
    }

    if (rs._mState !== 'timing') {
      rs.outHigh = false;
      rs._capVoltage = 0;
      rs.pulseProgress = 0;
      return;
    }

    const frac = Math.min(1, (now - rs._pulseT0) / 1000 / tPulse);
    rs.pulseProgress = frac;
    rs._capVoltage = frac * (2 / 3); // ramp toward the 2/3·VCC threshold
    if (frac >= 1) {
      rs._mState = 'idle';
      rs.outHigh = false;
      rs._capVoltage = 0;
      rs.pulseProgress = 0;
    }
  }

  /* Astable: free-running oscillator, charging toward 2/3·VCC and
     discharging toward 1/3·VCC through R1/R2/C. */
  _step555Astable(inst, dt, r1, r2, capC) {
    const rs = inst.runtimeState;

    let tHigh, tLow;
    if (r1 != null && r2 != null && capC != null && capC > 0 && r1 > 0 && r2 > 0) {
      // Real 555 astable formulas
      tHigh = 0.693 * (r1 + r2) * capC;
      tLow = 0.693 * r2 * capC;
    } else {
      // Fallback to props when components not resolved
      const freq = inst.props.frequency || 1000;
      const duty = (inst.props.dutyCycle || 50) / 100;
      const period = 1 / freq;
      tHigh = period * duty;
      tLow = period * (1 - duty);
    }
    rs.tHigh = tHigh;
    rs.tLow = tLow;

    const vThresh = 2 / 3;
    const vTrig = 1 / 3;

    let cv = rs._capVoltage;
    if (rs.outHigh) {
      cv = Math.min(1.0, cv + dt / tHigh * 0.8);
      if (cv >= vThresh) {
        rs.outHigh = false;
        cv = vThresh;
      }
    } else {
      cv = Math.max(0, cv - dt / tLow * 0.8);
      if (cv <= vTrig) {
        rs.outHigh = true;
        cv = vTrig;
      }
    }
    rs._capVoltage = cv;
  }

  /* One wire endpoint of `ic`'s pin, as { instId, pinId }. */
  _linksOnPin(ic, pinId) {
    const out = [];
    for (const w of this.wires) {
      if (w.from.instId === ic.id && w.from.pinId === pinId) out.push({ instId: w.to.instId, pinId: w.to.pinId });
      else if (w.to.instId === ic.id && w.to.pinId === pinId) out.push({ instId: w.from.instId, pinId: w.from.pinId });
    }
    return out;
  }

  _compsOnPin(ic, pinId, type) {
    const out = [];
    for (const link of this._linksOnPin(ic, pinId)) {
      const c = this.components.find(x => x.id === link.instId);
      if (c && c.type === type) out.push(c);
    }
    return out;
  }

  _ohmsOf(c) {
    let v = c.runtimeState?.value ?? c.props?.value ?? 0;
    const u = c.runtimeState?.unit || c.props?.unit || 'Ω';
    if (u === 'kΩ') v *= 1e3;
    else if (u === 'MΩ') v *= 1e6;
    return v;
  }

  _faradsOf(c) {
    let v = c.runtimeState?.value ?? c.props?.value ?? 0;
    const u = c.runtimeState?.unit || c.props?.unit || 'F';
    if (u === 'µF') v *= 1e-6;
    else if (u === 'nF') v *= 1e-9;
    else if (u === 'pF') v *= 1e-12;
    else if (u === 'mF') v *= 1e-3;
    return v;
  }

  /* Resolve R1, R2 and the timing cap of a 555 from its wiring.
       R1 : VCC -> DIS/THR   (or a 5 V rail -> DIS/THR)
       R2 : DIS <-> THR
       C  : THR/TRIG -> ground
     Resistors that only touch TRIG (trigger pull-ups), CV or OUT are not
     timing components and are deliberately ignored. */
  _resolve555RC(ic) {
    let r1 = null, r2 = null, capC = null;

    const resistors = new Map();
    for (const pid of ['VCC', 'DIS', 'THR', 'TRIG']) {
      for (const c of this._compsOnPin(ic, pid, 'resistor')) resistors.set(c.id, c);
    }

    for (const [, r] of resistors) {
      const icPins = [];
      const far = [];
      for (const w of this.wires) {
        if (w.from.instId !== r.id && w.to.instId !== r.id) continue;
        const other = w.from.instId === r.id ? w.to : w.from;
        if (other.instId === ic.id) icPins.push(other.pinId);
        else far.push(other);
      }
      const touchesDis = icPins.includes('DIS');
      const touchesThr = icPins.includes('THR');
      const ohms = this._ohmsOf(r);

      if (icPins.includes('VCC') && (touchesDis || touchesThr)) {
        if (r1 == null) r1 = ohms;
      } else if (touchesDis && touchesThr) {
        if (r2 == null) r2 = ohms;
      } else if (r1 == null && (touchesDis || touchesThr)
        && far.some(f => this._tracePinNet(f.instId, f.pinId).sources.some(s => s.voltage >= 4.5))) {
        r1 = ohms;
      }
    }

    const defs = (window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS) || {};
    const capPinIds = ((defs.capacitor && defs.capacitor.pins) || []).map(p => p.id);
    for (const pid of ['THR', 'TRIG']) {
      for (const link of this._linksOnPin(ic, pid)) {
        const cap = this.components.find(c => c.id === link.instId);
        if (!cap || cap.type !== 'capacitor') continue;
        const farPin = capPinIds.find(id => id !== link.pinId);
        if (!farPin) continue;
        if (this._tracePinNet(cap.id, farPin).grounds.length > 0) {
          capC = this._faradsOf(cap);
          break;
        }
      }
      if (capC != null) break;
    }

    return { r1, r2, capC };
  }

  _tracePinNet(startInstId, startPinId, skipInternalTypes) {
    const queue = [{ instId: startInstId, pinId: startPinId, resistance: 0 }];
    const visited = new Set();
    const sources = [];
    const grounds = [];
    skipInternalTypes = skipInternalTypes || [];

    while (queue.length > 0) {
      const current = queue.shift();
      const nodeKey = `${current.instId}:${current.pinId}`;

      const inst = this.components.find(c => c.id === current.instId);
      if (!inst) continue;

      // Allow ground pins to be re-visited (for parallel path resistance calculation)
      // but don't trace further from them
      const isGroundPin = this._isGroundPin(inst, current.pinId);
      if (isGroundPin) {
        grounds.push({ type: 'gnd', instId: inst.id, pinId: current.pinId, resistance: current.resistance });
        continue;
      }

      if (visited.has(nodeKey)) {
        // Parallel path discovery: follow wires-only from visited node to find ground/source pins
        const wq = [{ iid: current.instId, pid: current.pinId, d: 0 }];
        const wv = new Set();
        while (wq.length > 0) {
          const wn = wq.shift();
          const wk = wn.iid + ':' + wn.pid;
          if (wv.has(wk) || wn.d > 10) continue;
          wv.add(wk);
          for (const w of this.wires) {
            let ni, np;
            if (w.from.instId === wn.iid && w.from.pinId === wn.pid) { ni = w.to.instId; np = w.to.pinId; }
            else if (w.to.instId === wn.iid && w.to.pinId === wn.pid) { ni = w.from.instId; np = w.from.pinId; }
            else continue;
            const ninst = this.components.find(c => c.id === ni);
            if (!ninst) continue;
            if (this._isGroundPin(ninst, np)) {
              grounds.push({ type: 'gnd', instId: ni, pinId: np, resistance: current.resistance });
            } else {
              wq.push({ iid: ni, pid: np, d: wn.d + 1 });
            }
          }
        }
        continue;
      }
      visited.add(nodeKey);

      // 1. Arduino Uno / Nano Pins
      if (inst.type === 'arduino_uno' || inst.type === 'arduino_nano') {
        const pinId = current.pinId;
        if (pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND_D' || pinId === 'GND' || pinId === 'GND3') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId, resistance: current.resistance });
        } else if (pinId === '5V' || pinId === 'VIN' || pinId === '5V2' || pinId === 'IOREF') {
          sources.push({ type: '5v', voltage: 5.0, rawVal: 255, resistance: current.resistance });
        } else if (pinId === '3V3') {
          sources.push({ type: '3v3', voltage: 3.3, rawVal: 168, resistance: current.resistance });
        } else if (pinId === 'RST' || pinId === 'RST1' || pinId === 'RST2') {
          sources.push({ type: 'pullup', voltage: 5.0, rawVal: 255, resistance: current.resistance + 10000 });
        } else {
          // Digital or Analog pin (D0—D13, A0—A5)
          const pinNum = this._pinToNumber(pinId);
          const pinKey = `pin_${pinNum}`;
          const sim = window.ArduinoSim;
          const rawVal = sim && sim.pinStates ? (sim.pinStates[pinKey] || 0) : 0;

          if (rawVal > 0) {
            const voltage = 5.0 * (rawVal > 1 ? (rawVal / 255) : 1.0);
            sources.push({ type: 'digital', pinNum, pinKey, voltage, rawVal, resistance: current.resistance });
          } else {
            // Pin is LOW (0V) -> can act as current sink (GND)
            grounds.push({ type: 'digital_low', pinNum, pinKey, resistance: current.resistance });
          }
        }
        continue;
      }

      // 1b. ESP32 DevKit V1 Pins
      if (inst.type === 'esp32_devkit_v1') {
        const pinId = current.pinId;
        if (pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId, resistance: current.resistance });
        } else if (pinId === 'VIN') {
          sources.push({ type: '5v', voltage: 5.0, rawVal: 255, resistance: current.resistance });
        } else if (pinId === '3V3') {
          sources.push({ type: '3v3', voltage: 3.3, rawVal: 168, resistance: current.resistance });
        } else if (pinId === 'EN') {
          // Reset line — not a usable GPIO
        } else {
          // GPIO (D0—D35), analog ADC pins (VP/VN/D32—D35), UART (TX0/RX0)
          const pinNum = this._pinToNumber(pinId);
          const pinKey = `pin_${pinNum}`;
          const sim = window.ArduinoSim;
          const rawVal = sim && sim.pinStates ? (sim.pinStates[pinKey] || 0) : 0;

          if (rawVal > 0) {
            const voltage = 3.3 * (rawVal > 1 ? (rawVal / 255) : 1.0);
            sources.push({ type: 'digital', pinNum, pinKey, voltage, rawVal, resistance: current.resistance });
          } else {
            grounds.push({ type: 'digital_low', pinNum, pinKey, resistance: current.resistance });
          }
        }
        continue;
      }

      // 1d. Raspberry Pi Pico 2 W Pins (3.3V logic)
      if (inst.type === 'pico2w') {
        const pinId = current.pinId;
        if (pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND3' || pinId === 'GND4' || pinId === 'GND5' || pinId === 'GND6' || pinId === 'GND7' || pinId === 'AGND') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId, resistance: current.resistance });
        } else if (pinId === 'VBUS') {
          sources.push({ type: '5v', voltage: 5.0, rawVal: 255, resistance: current.resistance });
        } else if (pinId === '3V3OUT' || pinId === '3V3') {
          sources.push({ type: '3v3', voltage: 3.3, rawVal: 168, resistance: current.resistance });
        } else if (pinId === 'VSYS' || pinId === '3V3EN' || pinId === 'RUN' || pinId === 'ADCREF') {
          // System pins — not user GPIOs
        } else {
          // GPIO (GP0—GP28)
          const pinNum = this._pinToNumber(pinId);
          const pinKey = `pin_${pinNum}`;
          const sim = window.ArduinoSim;
          const rawVal = sim && sim.pinStates ? (sim.pinStates[pinKey] || 0) : 0;

          if (rawVal > 0) {
            const voltage = 3.3 * (rawVal > 1 ? (rawVal / 255) : 1.0);
            sources.push({ type: 'digital', pinNum, pinKey, voltage, rawVal, resistance: current.resistance });
          } else {
            grounds.push({ type: 'digital_low', pinNum, pinKey, resistance: current.resistance });
          }
        }
        continue;
      }

      // 1c. Intel 8085 / 8051 Pins
      if (inst.type === 'intel_8085' || inst.type === 'intel_8051') {
        const pinId = current.pinId;
        if (pinId === 'GND' || pinId === 'GND1' || pinId === 'GND2') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId, resistance: current.resistance });
        } else if (pinId === 'VCC' || pinId === 'VCC2' || pinId === 'VCC5') {
          sources.push({ type: '5v', voltage: 5.0, rawVal: 255, resistance: current.resistance });
        } else {
          const pinNum = this._pinToNumber(pinId);
          const pinKey = `pin_${pinNum}`;
          const sim = window.ArduinoSim;
          const rawVal = sim && sim.pinStates ? (sim.pinStates[pinKey] || 0) : 0;
          if (rawVal > 0) {
            const voltage = 5.0 * (rawVal > 1 ? (rawVal / 255) : 1.0);
            sources.push({ type: 'digital', pinNum, pinKey, voltage, rawVal, resistance: current.resistance });
          } else {
            grounds.push({ type: 'digital_low', pinNum, pinKey, resistance: current.resistance });
          }
        }
        continue;
      }

      // 2. Power and Ground components
      if (inst.type === 'power_5v') {
        sources.push({ type: '5v', voltage: 5.0, rawVal: 255, resistance: current.resistance });
        continue;
      }
      if (inst.type === 'power_gnd') {
        grounds.push({ type: 'gnd', instId: inst.id, pinId: 'gnd', resistance: current.resistance });
        continue;
      }

      if (inst.type === 'battery') {
        const battV = this._getBatteryPosVoltage(inst);
        if (current.pinId === 'pos' && battV > 0) {
          sources.push({ type: 'battery', voltage: battV, rawVal: 255, resistance: current.resistance, instId: inst.id, pinId: 'pos' });
        }
        // Only the bottom cell of a series stack is a true ground;
        // intermediate NEG pins sit at elevated potential.
        if (current.pinId === 'neg' && !this._batteryNegIsIntermediate(inst)) {
          grounds.push({ type: 'gnd', instId: inst.id, pinId: 'neg', resistance: current.resistance });
        }
        continue;
      }

      // 2b. MB102 Breadboard Power Supply
      if (inst.type === 'mb102_power') {
        const mbPowered = Boolean(inst.runtimeState?.powered ?? inst.props?.powered ?? 1);
        const topV = inst.runtimeState?.topVoltage ?? inst.props?.topVoltage ?? '5V';
        const botV = inst.runtimeState?.bottomVoltage ?? inst.props?.bottomVoltage ?? '3.3V';
        const voltageMap = { '5V': 5.0, '3.3V': 3.3, 'OFF': 0 };

        if (mbPowered) {
          if (current.pinId === 'vcc_t' && voltageMap[topV] > 0) {
            sources.push({ type: topV, voltage: voltageMap[topV], rawVal: 255, resistance: current.resistance, instId: inst.id, pinId: 'vcc_t' });
          }
          if (current.pinId === 'vcc_b' && voltageMap[botV] > 0) {
            sources.push({ type: botV, voltage: voltageMap[botV], rawVal: 168, resistance: current.resistance, instId: inst.id, pinId: 'vcc_b' });
          }
          if (current.pinId === 'aux_5v') {
            sources.push({ type: '5V', voltage: 5.0, rawVal: 255, resistance: current.resistance, instId: inst.id, pinId: 'aux_5v' });
          }
          if (current.pinId === 'aux_3v3') {
            sources.push({ type: '3.3V', voltage: 3.3, rawVal: 168, resistance: current.resistance, instId: inst.id, pinId: 'aux_3v3' });
          }
        }
        if (current.pinId === 'gnd_t' || current.pinId === 'gnd_b' || current.pinId === 'aux_gnd') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId: current.pinId, resistance: current.resistance });
        }
        // Do NOT continue — let wire-following at bottom of loop execute
        // so the trace can leave the mb102_power through connected wires
      }

      // 2c. Benchtop DC Power Supply (split-rail: +V, -V, GND, 5V)
      if (inst.type === 'bench_power_supply') {
        const bsPowered = Boolean(inst.runtimeState?.powered ?? inst.props?.powered ?? 1);
        const bsOutOn = bsPowered && Boolean(inst.runtimeState?.outputEnabled ?? inst.props?.outputEnabled ?? 1);
        const vSet = Number(inst.runtimeState?.voltageSet ?? inst.props?.voltageSet ?? 12.0);

        if (current.pinId === 'POS' && bsOutOn && vSet > 0) {
          sources.push({ type: 'bench_v+', voltage: vSet, rawVal: 255, resistance: current.resistance });
        }
        if (current.pinId === 'NEG' && bsOutOn && vSet > 0) {
          sources.push({ type: 'bench_v-', voltage: -vSet, rawVal: 0, resistance: current.resistance });
        }
        if (current.pinId === 'GND') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId: current.pinId, resistance: current.resistance });
        }

        if (bsPowered && current.pinId === 'VCC_5V') {
          sources.push({ type: '5V_fixed', voltage: 5.0, rawVal: 255, resistance: current.resistance });
        }
        if (bsPowered && current.pinId === 'GND_5V') {
          grounds.push({ type: 'gnd', instId: inst.id, pinId: current.pinId, resistance: current.resistance });
        }
        // Do NOT continue — let wire-following at bottom of loop execute
        // so the trace can leave the bench_supply through connected wires
      }

      // 3. Resistor internal pass-through (p1 <-> p2)
      if (inst.type === 'resistor') {
        const rVal = (Number(inst.props.value) || 220) * (inst.props.unit === 'kΩ' ? 1e3 : inst.props.unit === 'MΩ' ? 1e6 : 1);
        const otherPin = current.pinId === 'p1' ? 'p2' : 'p1';
        queue.push({
          instId: inst.id,
          pinId: otherPin,
          resistance: current.resistance + rVal,
        });
      }

      // 3b. 12V Bulb internal pass-through (anode ↔ cathode, ~12Ω nominal)
      // Non-polar filament: trace through it in either direction
      // (reverse-orientation bulbs must not hide the circuit behind them)
      if (inst.type === 'bulb_12v' && !skipInternalTypes.includes('bulb_12v')) {
        if (current.pinId === 'anode') {
          queue.push({
            instId: inst.id,
            pinId: 'cathode',
            resistance: current.resistance + 12,
          });
        } else if (current.pinId === 'cathode') {
          queue.push({
            instId: inst.id,
            pinId: 'anode',
            resistance: current.resistance + 12,
          });
        }
      }

      // 4. Push Button internal pass-through
      if (inst.type === 'push_button') {
        const isPressed = inst.runtimeState && inst.runtimeState.pressed;
        if (current.pinId === 'p1') queue.push({ instId: inst.id, pinId: 'p2', resistance: current.resistance });
        if (current.pinId === 'p2') queue.push({ instId: inst.id, pinId: 'p1', resistance: current.resistance });
        if (current.pinId === 'p3') queue.push({ instId: inst.id, pinId: 'p4', resistance: current.resistance });
        if (current.pinId === 'p4') queue.push({ instId: inst.id, pinId: 'p3', resistance: current.resistance });

        if (isPressed) {
          if (current.pinId === 'p1' || current.pinId === 'p2') {
            queue.push({ instId: inst.id, pinId: 'p3', resistance: current.resistance });
            queue.push({ instId: inst.id, pinId: 'p4', resistance: current.resistance });
          } else {
            queue.push({ instId: inst.id, pinId: 'p1', resistance: current.resistance });
            queue.push({ instId: inst.id, pinId: 'p2', resistance: current.resistance });
          }
        }
      }

      // 4b. Relay internal pass-through (COM ↔ NO when active, COM ↔ NC when inactive)
      if (inst.type === 'relay') {
        const relayOn = !!(inst.runtimeState && inst.runtimeState.active);
        if (current.pinId === 'com') {
          queue.push({ instId: inst.id, pinId: relayOn ? 'no' : 'nc', resistance: current.resistance });
        } else if (current.pinId === 'no' && relayOn) {
          queue.push({ instId: inst.id, pinId: 'com', resistance: current.resistance });
        } else if (current.pinId === 'nc' && !relayOn) {
          queue.push({ instId: inst.id, pinId: 'com', resistance: current.resistance });
        }
      }

      // 4b1. Slide switch internal pass-through (COM ↔ selected throw)
      if (inst.type === 'slide_switch') {
        const sel = typeof window._slideSwitchThrow === 'function'
          ? window._slideSwitchThrow(inst) : 'a';
        if (current.pinId === 'com') {
          queue.push({ instId: inst.id, pinId: sel, resistance: current.resistance });
        } else if (current.pinId === sel) {
          queue.push({ instId: inst.id, pinId: 'com', resistance: current.resistance });
        }
      }

      // 4b2. SSR channel pass-through (outNa ↔ outNb when channel N is on)
      if (inst.type === 'ssr_8ch') {
        const m = /^out(\d)([ab])$/.exec(current.pinId);
        if (m) {
          const chList = (inst.runtimeState && inst.runtimeState.channels) || [];
          const chOn = !!chList[Number(m[1]) - 1];
          if (chOn) {
            queue.push({
              instId: inst.id,
              pinId: `out${m[1]}${m[2] === 'a' ? 'b' : 'a'}`,
              resistance: current.resistance,
            });
          }
        }
      }

      // 4b0. Multimeter pass-through in current mode (jacks commoned, 0Ω)
      if (inst.type === 'multimeter') {
        const mmMode = inst.props?.mode || inst.runtimeState?.mode || 'V_DC';
        if (mmMode === 'A_DC' || mmMode === 'A_AC') {
          if (current.pinId === 'probe_red' || current.pinId === 'probe_amp') {
            queue.push({ instId: inst.id, pinId: 'probe_com', resistance: current.resistance });
          } else if (current.pinId === 'probe_com') {
            queue.push({ instId: inst.id, pinId: 'probe_red', resistance: current.resistance });
            queue.push({ instId: inst.id, pinId: 'probe_amp', resistance: current.resistance });
          }
        }
      }

      // 4b1. Digital IC output pins act as voltage sources
      const IC_OUTPUT_PINS = {
        ic_555: ['OUT', 'DIS'],
        ic_74hc04: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
        ic_74hc00: ['Y1', 'Y2', 'Y3', 'Y4'],
        ic_74hc08: ['Y1', 'Y2', 'Y3', 'Y4'],
        ic_74hc32: ['Y1', 'Y2', 'Y3', 'Y4'],
        ic_74hc595: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'QHn'],
        ic_74hc138: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
        ic_74hc245: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
        ic_74hc74: ['Q1', 'Q1n', 'Q2', 'Q2n'],
        ic_74hc165: ['Q7', 'Q7n'],
        ic_74hc193: ['Q0', 'Q1', 'Q2', 'Q3', 'TCU', 'TCD'],
        ic_74hc47: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        ic_74hc148: ['A0', 'A1', 'A2', 'GS', 'EO'],
        ic_74hc02: ['Y1', 'Y2', 'Y3', 'Y4'],
        ic_74hc86: ['Y1', 'Y2', 'Y3', 'Y4'],
        ic_74hc139: ['Y0_1', 'Y1_1', 'Y2_1', 'Y3_1', 'Y0_2', 'Y1_2', 'Y2_2', 'Y3_2'],
        ic_74hc153: ['Y1', 'Y2'],
        ic_74hc164: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
        ic_74hc4017: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q59'],
        lm741: ['OUT'],
        lm358: ['1OUT', '2OUT'],
        lm393: ['1OUT', '2OUT'],
        lm324: ['1OUT', '2OUT', '3OUT', '4OUT'],
        cd4066: ['SIG1B', 'SIG2B', 'SIG3B', 'SIG4B'],
        ic_74hc14: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
        ic_74hc283: ['S1', 'S2', 'S3', 'S4', 'C4'],
        ic_74hc85: ['QA_GT_B', 'QA_EQ_B', 'QA_LT_B'],
        ic_74hc151: ['Y', 'W'],
        ic_74hc76: ['1Q', '1Qn', '2Q', '2Qn'],
        ic_8255: ['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7',
                  'PB0','PB1','PB2','PB3','PB4','PB5','PB6','PB7',
                  'PC0','PC1','PC2','PC3','PC4','PC5','PC6','PC7'],
      };
      if (IC_OUTPUT_PINS[inst.type] && IC_OUTPUT_PINS[inst.type].includes(current.pinId)) {
        let rawVal;
        if (inst.type === 'lm741') {
          rawVal = inst.runtimeState && inst.runtimeState.vOut != null
            ? Math.round((inst.runtimeState.vOut / 5.0) * 255) : 0;
        } else if (inst.type === 'lm358' || inst.type === 'lm324') {
          const v = inst.runtimeState?.[current.pinId] ?? 0;
          rawVal = Math.max(0, Math.min(255, Math.round((v / 5.0) * 255)));
        } else {
          rawVal = inst.runtimeState && inst.runtimeState[current.pinId] != null
            ? inst.runtimeState[current.pinId] : 0;
        }
        if (rawVal > 0) {
          const voltage = 5.0 * (rawVal > 1 ? (rawVal / 255) : 1.0);
          sources.push({ type: 'ic_out', voltage, rawVal, resistance: current.resistance });
        } else {
          grounds.push({ type: 'ic_out_low', resistance: current.resistance });
        }
      }

      // 4b2. Function generator output pins act as voltage sources
      if (inst.type === 'func_gen') {
        const rs = inst.runtimeState || {};
        if (current.pinId === 'ch1_out') {
          const v = rs.ch1_voltage != null ? rs.ch1_voltage : 0;
          if (v > 0) {
            sources.push({ type: 'func_gen', voltage: v, resistance: current.resistance });
          } else {
            grounds.push({ type: 'func_gen_low', resistance: current.resistance });
          }
        } else if (current.pinId === 'ch2_out') {
          const v = rs.ch2_voltage != null ? rs.ch2_voltage : 0;
          if (v > 0) {
            sources.push({ type: 'func_gen', voltage: v, resistance: current.resistance });
          } else {
            grounds.push({ type: 'func_gen_low', resistance: current.resistance });
          }
        }
      }

      // 4c. Breadboard internal connectivity
      if (inst.type === 'breadboard' || inst.type === 'breadboard_small') {
        const defs = window.ArduinoComponents?.COMPONENT_DEFS;
        const def = defs && defs[inst.type];
        if (def) {
          const myGroup = window._breadboardGetGroup(current.pinId);
          if (myGroup) {
            for (const otherPin of def.pins) {
              if (otherPin.id === current.pinId) continue;
              const otherGroup = window._breadboardGetGroup(otherPin.id);
              if (otherGroup === myGroup) {
                queue.push({ instId: inst.id, pinId: otherPin.id, resistance: current.resistance });
              }
            }
          }
        }
      }

      // 5. Traverse connected wires
      for (const wire of this.wires) {
        if (wire.from.instId === current.instId && wire.from.pinId === current.pinId) {
          queue.push({
            instId: wire.to.instId,
            pinId: wire.to.pinId,
            resistance: current.resistance,
          });
        } else if (wire.to.instId === current.instId && wire.to.pinId === current.pinId) {
          queue.push({
            instId: wire.from.instId,
            pinId: wire.from.pinId,
            resistance: current.resistance,
          });
        }
      }
    }

    return { sources, grounds };
  }

  /**
   * Effective voltage at a battery's POS terminal.
   * For series-cascaded batteries (POS of one wired to NEG of another) the
   * voltages add up, so walk down to the bottom of the stack and sum.
   */
  _getBatteryPosVoltage(inst) {
    const ownV = () => Number(inst.runtimeState?.voltage ?? inst.props?.voltage ?? 3.7);
    const batteries = (this.components || []).filter(c => c.type === 'battery');
    if (batteries.length <= 1) return ownV();

    // belowMap: batteryId → battery it sits on top of (NEG wired to that POS)
    const belowMap = new Map();
    for (const b of batteries) {
      for (const w of this.wires || []) {
        let otherId = null;
        if (w.from.instId === b.id && w.from.pinId === 'neg' && w.to.pinId === 'pos') {
          otherId = w.to.instId;
        } else if (w.to.instId === b.id && w.to.pinId === 'neg' && w.from.pinId === 'pos') {
          otherId = w.from.instId;
        }
        if (otherId && batteries.some(x => x.id === otherId)) {
          belowMap.set(b.id, otherId);
          break;
        }
      }
    }
    if (belowMap.size === 0) return ownV();

    // Walk down to the bottom of this battery's stack
    const chain = [];
    let current = inst;
    const visited = new Set();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.unshift(current);
      const belowId = belowMap.get(current.id);
      current = belowId ? batteries.find(b => b.id === belowId) : null;
    }

    // Sum voltages from the bottom up through this battery
    let total = 0;
    for (const b of chain) {
      total += Number(b.runtimeState?.voltage ?? b.props?.voltage ?? 3.7);
    }
    return total;
  }

  /** True if this battery's NEG is wired to a lower battery's POS (series mid-cell). */
  _batteryNegIsIntermediate(inst) {
    for (const w of this.wires || []) {
      if (w.from.instId === inst.id && w.from.pinId === 'neg' && w.to.pinId === 'pos') return true;
      if (w.to.instId === inst.id && w.to.pinId === 'neg' && w.from.pinId === 'pos') return true;
    }
    return false;
  }

  // Quick check if a pin is a ground-type pin (for parallel path re-visiting)
  _isGroundPin(inst, pinId) {
    if (inst.type === 'industrial_plc') return pinId === 'COM';
    if (inst.type === 'arduino_uno' || inst.type === 'arduino_nano') {
      return pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND_D' || pinId === 'GND' || pinId === 'GND3';
    }
    if (inst.type === 'esp32_devkit_v1') {
      return pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND';
    }
    if (inst.type === 'pico2w') {
      return pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND3' || pinId === 'GND4' || pinId === 'GND5' || pinId === 'GND6' || pinId === 'GND7' || pinId === 'AGND';
    }
    if (inst.type === 'intel_8085' || inst.type === 'intel_8051') {
      return pinId === 'GND' || pinId === 'GND1' || pinId === 'GND2';
    }
    if (inst.type === 'power_gnd') return true;
    if (inst.type === 'bench_power_supply') return pinId === 'GND' || pinId === 'GND_5V';
    if (inst.type === 'mb102_power') return pinId === 'gnd_t' || pinId === 'gnd_b' || pinId === 'aux_gnd';
    if (inst.type === 'battery') return pinId === 'neg';
    // Arduino / LPC2148 digital pin LOW acts as ground
    if (inst.type === 'arduino_uno' || inst.type === 'arduino_nano' || inst.type === 'esp32_devkit_v1' || inst.type === 'lpc2148' || inst.type === 'pico2w' || inst.type === 'intel_8085' || inst.type === 'intel_8051' || inst.type === 'industrial_plc') {
      const pinNum = this._pinToNumber(pinId);
      if (pinNum != null) {
        const sim = window.ArduinoSim;
        const rawVal = sim && sim.pinStates ? (sim.pinStates[`pin_${pinNum}`] || 0) : 0;
        if (rawVal === 0) return true;
      }
    }
    // IC output LOW acts as ground
    const IC_OUTPUT_PINS = {
      ic_555: ['OUT'],
      ic_74hc04: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
      ic_74hc00: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc08: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc32: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc595: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'QHn'],
      ic_74hc138: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
      ic_74hc245: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
      ic_74hc74: ['Q1', 'Q1n', 'Q2', 'Q2n'],
      ic_74hc165: ['Q7', 'Q7n'],
      ic_74hc193: ['Q0', 'Q1', 'Q2', 'Q3', 'TCU', 'TCD'],
      ic_74hc47: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      ic_74hc148: ['A0', 'A1', 'A2', 'GS', 'EO'],
      ic_74hc02: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc86: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc139: ['Y0_1', 'Y1_1', 'Y2_1', 'Y3_1', 'Y0_2', 'Y1_2', 'Y2_2', 'Y3_2'],
      ic_74hc153: ['Y1', 'Y2'],
      ic_74hc164: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
      ic_74hc4017: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q59'],
      lm741: ['OUT'],
      lm358: ['1OUT', '2OUT'],
      lm393: ['1OUT', '2OUT'],
      lm324: ['1OUT', '2OUT', '3OUT', '4OUT'],
      cd4066: ['SIG1B', 'SIG2B', 'SIG3B', 'SIG4B'],
      ic_74hc14: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
      ic_74hc283: ['S1', 'S2', 'S3', 'S4', 'C4'],
      ic_74hc85: ['QA_GT_B', 'QA_EQ_B', 'QA_LT_B'],
      ic_74hc151: ['Y', 'W'],
      ic_74hc76: ['1Q', '1Qn', '2Q', '2Qn'],
      ic_8255: ['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7',
                'PB0','PB1','PB2','PB3','PB4','PB5','PB6','PB7',
                'PC0','PC1','PC2','PC3','PC4','PC5','PC6','PC7'],
    };
    if (IC_OUTPUT_PINS[inst.type] && IC_OUTPUT_PINS[inst.type].includes(pinId)) {
      const rawVal = inst.runtimeState && inst.runtimeState[pinId] != null ? inst.runtimeState[pinId] : 0;
      if (rawVal === 0) return true;
    }
    return false;
  }

  // Measure equivalent resistance between two pins, handling parallel paths correctly
  _measureResistanceBetween(startInstId, startPinId, targetInstId, targetPinId) {
    // Helper: get resistance value for a component
    const getResistance = (inst) => {
      if (inst.type === 'resistor') {
        return (Number(inst.props && inst.props.value) || 220)
          * (inst.props.unit === 'kΩ' ? 1e3 : inst.props.unit === 'MΩ' ? 1e6 : 1);
      }
      if (inst.type === 'diode_1n4007') return 0.7;
      if (inst.type === 'bulb_12v') return 12;
      return 0;
    };

    // Build adjacency list: pinKey ← [{ pinKey, resistance }]
    const adj = new Map();
    const addEdge = (a, b, r) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ key: b, r });
      adj.get(b).push({ key: a, r });
    };

    // Register all component pins
    for (const inst of this.components) {
      const { COMPONENT_DEFS } = window.ArduinoComponents || {};
      const def = COMPONENT_DEFS && COMPONENT_DEFS[inst.type];
      if (!def || !def.pins) continue;
      for (const pin of def.pins) {
        adj.set(`${inst.id}:${pin.id}`, []);
      }
    }

    // Wire edges (zero resistance)
    for (const w of this.wires) {
      addEdge(`${w.from.instId}:${w.from.pinId}`, `${w.to.instId}:${w.to.pinId}`, 0);
    }

    // Internal pass-through for non-resistor components (zero resistance)
    for (const inst of this.components) {
      if (inst.type === 'resistor') continue; // handled separately
      const key = (pin) => `${inst.id}:${pin}`;
      if (inst.type === 'push_button') {
        const pressed = inst.runtimeState && inst.runtimeState.pressed;
        if (pressed) { addEdge(key('p1'), key('p3'), 0); addEdge(key('p2'), key('p4'), 0); }
        else { addEdge(key('p1'), key('p2'), 0); addEdge(key('p3'), key('p4'), 0); }
      } else if (inst.type === 'relay') {
        const on = inst.runtimeState && inst.runtimeState.active;
        addEdge(key('com'), key(on ? 'no' : 'nc'), 0);
      } else if (inst.type === 'slide_switch') {
        const throwPin = typeof window._slideSwitchThrow === 'function'
          ? window._slideSwitchThrow(inst) : 'a';
        addEdge(key('com'), key(throwPin), 0);
      } else if (inst.type === 'ssr_8ch') {
        const channels = (inst.runtimeState && inst.runtimeState.channels) || [];
        for (let i = 1; i <= 8; i++) {
          if (channels[i - 1]) addEdge(key(`out${i}a`), key(`out${i}b`), 0);
        }
      } else if (inst.type === 'breadboard' || inst.type === 'breadboard_small') {
        const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
        const def = defs && defs[inst.type];
        if (def) {
          const groups = {};
          for (const pin of def.pins) {
            const g = window._breadboardGetGroup && window._breadboardGetGroup(pin.id);
            if (g) { if (!groups[g]) groups[g] = []; groups[g].push(pin.id); }
          }
          for (const pinIds of Object.values(groups)) {
            for (let i = 1; i < pinIds.length; i++) addEdge(key(pinIds[0]), key(pinIds[i]), 0);
          }
        }
      } else if (inst.type === 'led' || inst.type === 'led_green' || inst.type === 'led_blue'
        || inst.type === 'led_yellow' || inst.type === 'led_orange' || inst.type === 'led_white') {
        addEdge(key('anode'), key('cathode'), 20);
      } else if (inst.type === 'bulb_12v') {
        addEdge(key('anode'), key('cathode'), 12);
      } else if (inst.type === 'diode_1n4007') {
        addEdge(key('anode'), key('cathode'), 0.7);
      } else if (inst.type === 'potentiometer') {
        const rawRes = Number(inst.props?.resistance ?? inst.props?.value_res ?? 10000);
        const unitMult = inst.props?.unit === 'MΩ' ? 1e6 : (inst.props?.unit === 'kΩ' ? 1e3 : 1);
        const rTotal = Math.max(1, rawRes * (inst.props?.unit ? unitMult : (rawRes < 100 ? 1e3 : 1)));
        const maxVal = Math.max(1, Number(inst.props?.maxValue) || 1023);
        const rawVal = Number(inst.runtimeState?.value ?? inst.props?.value ?? 512);
        const ratio = Math.max(0, Math.min(1, rawVal / maxVal));

        const r1W = Math.max(0.01, (1 - ratio) * rTotal);
        const rW2 = Math.max(0.01, ratio * rTotal);

        addEdge(key('p1'), key('vcc'), 0);
        addEdge(key('cw'), key('vcc'), 0);
        addEdge(key('t1'), key('vcc'), 0);
        addEdge(key('p2'), key('wiper'), 0);
        addEdge(key('out'), key('wiper'), 0);
        addEdge(key('w'), key('wiper'), 0);
        addEdge(key('p3'), key('gnd'), 0);
        addEdge(key('ccw'), key('gnd'), 0);
        addEdge(key('t2'), key('gnd'), 0);

        addEdge(key('vcc'), key('wiper'), r1W);
        addEdge(key('wiper'), key('gnd'), rW2);
      }
    }

    // Resistor edges (with resistance value)
    for (const inst of this.components) {
      if (inst.type !== 'resistor') continue;
      const r = getResistance(inst);
      addEdge(`${inst.id}:p1`, `${inst.id}:p2`, Math.max(r, 0.01));
    }

    const startKey = `${startInstId}:${startPinId}`;
    const targetKey = `${targetInstId}:${targetPinId}`;

    if (!adj.has(startKey) || !adj.has(targetKey)) return Infinity;

    // Find all simple paths from start to target using DFS, collect path resistances
    const pathResistances = [];
    const maxPaths = 200; // safety limit

    const dfs = (currentKey, visited, totalR) => {
      if (pathResistances.length >= maxPaths) return;
      if (currentKey === targetKey) {
        pathResistances.push(totalR);
        return;
      }
      const neighbors = adj.get(currentKey);
      if (!neighbors) return;
      for (const { key: nextKey, r } of neighbors) {
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        dfs(nextKey, visited, totalR + r);
        visited.delete(nextKey);
      }
    };

    const visited = new Set([startKey]);
    dfs(startKey, visited, 0);

    if (pathResistances.length === 0) return Infinity;

    // Combine all path resistances using parallel formula
    let totalConductance = 0;
    for (const r of pathResistances) {
      if (r > 0) totalConductance += 1 / r;
    }
    return totalConductance > 0 ? 1 / totalConductance : Infinity;
  }

  _getWireTarget(instId, pinId) {
    for (const wire of this.wires) {
      if (wire.from.instId === instId && wire.from.pinId === pinId) {
        const inst = this.components.find(c => c.id === wire.to.instId);
        return inst ? { inst, pinId: wire.to.pinId } : null;
      }
      if (wire.to.instId === instId && wire.to.pinId === pinId) {
        const inst = this.components.find(c => c.id === wire.from.instId);
        return inst ? { inst, pinId: wire.from.pinId } : null;
      }
    }
    return null;
  }

  _getConnectedPinNum(instId, pinId) {
    const BOARD_TYPES = new Set(['arduino_uno', 'arduino_nano', 'esp32_devkit_v1', 'lpc2148', 'stm32f746_disco', 'pico2w', 'intel_8085', 'intel_8051', 'industrial_plc']);
    const inst = this.components.find(c => c.id === instId);
    if (inst && BOARD_TYPES.has(inst.type)) {
      return this._pinToNumber(pinId);
    }
    for (const wire of this.wires) {
      let otherInstId, otherPinId;
      if (wire.from.instId === instId && wire.from.pinId === pinId) {
        otherInstId = wire.to.instId;
        otherPinId = wire.to.pinId;
      } else if (wire.to.instId === instId && wire.to.pinId === pinId) {
        otherInstId = wire.from.instId;
        otherPinId = wire.from.pinId;
      } else continue;

      const otherInst = this.components.find(c => c.id === otherInstId);
      if (!otherInst) continue;
      if (otherInst.type === 'arduino_uno' || otherInst.type === 'arduino_nano' || otherInst.type === 'esp32_devkit_v1' || otherInst.type === 'lpc2148' || otherInst.type === 'pico2w' || otherInst.type === 'intel_8085' || otherInst.type === 'intel_8051' || otherInst.type === 'industrial_plc') {
        return this._pinToNumber(otherPinId);
      }
    }
    return null;
  }

  // _readDigitalInput(fromInstId, pinId) {
  //   const wireTarget = this._getWireTarget(fromInstId, pinId);
  //   if (!wireTarget) return 0;
  //   const other = wireTarget.inst;
  //   if (other.type === 'power_5v') return 1;
  //   if (other.type === 'power_gnd') return 0;
  //   if (other.type === 'push_button') {
  //     const pressed = other.runtimeState && other.runtimeState.pressed;
  //     const tp = wireTarget.pinId;
  //     if (pressed) {
  //       if (tp === 'p1' || tp === 'p2') return this._readDigitalInput(other.id, 'p3');
  //       return this._readDigitalInput(other.id, 'p1');
  //     }
  //     if (tp === 'p1') return this._readDigitalInput(other.id, 'p2');
  //     if (tp === 'p2') return this._readDigitalInput(other.id, 'p1');
  //     if (tp === 'p3') return this._readDigitalInput(other.id, 'p4');
  //     if (tp === 'p4') return this._readDigitalInput(other.id, 'p3');
  //     return 0;
  //   }
  //   if (other.type === 'func_gen') {
  //     const rs = other.runtimeState || {};
  //     const v = wireTarget.pinId === 'ch1_out' ? (rs.ch1_voltage || 0)
  //       : wireTarget.pinId === 'ch2_out' ? (rs.ch2_voltage || 0) : 0;
  //     return v > 0 ? 1 : 0;
  //   }
  //   const pn = this._getConnectedPinNum(fromInstId, pinId);
  //   if (pn !== null) {
  //     const sim = window.ArduinoSim;
  //     return (sim && sim.pinStates && (sim.pinStates[`pin_${pn}`] || 0) > 0) ? 1 : 0;
  //   }
  //   const IC_OUT = {
  //     ic_555: ['OUT'],
  //     potentiometer: ['wiper'],
  //     ic_74hc00: ['Y1', 'Y2', 'Y3', 'Y4'],
  //     ic_74hc04: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
  //     ic_74hc08: ['Y1', 'Y2', 'Y3', 'Y4'],
  //     ic_74hc32: ['Y1', 'Y2', 'Y3', 'Y4'],
  //     ic_74hc595: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'QHn'],
  //     ic_74hc138: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
  //     ic_74hc245: ['A1','A2','A3','A4','A5','A6','A7','A8','B1','B2','B3','B4','B5','B6','B7','B8'],
  //     ic_74hc74: ['Q1', 'Q1n', 'Q2', 'Q2n'],
  //     ic_74hc165: ['Q7', 'Q7n'],
  //     ic_74hc193: ['Q0', 'Q1', 'Q2', 'Q3', 'TCU', 'TCD'],
  //     ic_74hc47: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  //     ic_74hc148: ['A0', 'A1', 'A2', 'GS', 'EO'],
  //     lm741: ['OUT'],
  //   };
  //   if (IC_OUT[other.type] && IC_OUT[other.type].includes(wireTarget.pinId)) {
  //     const raw = other.runtimeState && other.runtimeState[wireTarget.pinId] != null
  //       ? other.runtimeState[wireTarget.pinId] : 0;
  //     return raw > 0 ? 1 : 0;
  //   }
  //   return 0;
  // }
  /* Forced logic level set by the properties-panel input tag (props.forcedInputs). */
  _getForcedLevel(instId, pinId) {
    const c = this.components.find(x => x.id === instId);
    const fi = c && c.props && c.props.forcedInputs;
    if (!fi || fi[pinId] === undefined) return null;
    return fi[pinId] ? 1 : 0;
  }

  _readDigitalInput(fromInstId, pinId, visited = new Set()) {
    // Prevent infinite recursion loops across connected components
    const visitKey = `${fromInstId}:${pinId}`;
    if (visited.has(visitKey)) return 0;
    visited.add(visitKey);

    // Panel input tag force overrides any wiring
    const forced = this._getForcedLevel(fromInstId, pinId);
    if (forced !== null) return forced;

    const wireTarget = this._getWireTarget(fromInstId, pinId);
    if (!wireTarget) return 0;

    const other = wireTarget.inst;
    const targetPin = wireTarget.pinId;

    // 1. Power rails
    if (other.type === 'power_5v') return 1;
    if (other.type === 'power_gnd') return 0;

    // 1a. Logic input tag acting as a wired constant source
    if (other.type === 'logic_level_in') return (other.props && other.props.level) ? 1 : 0;

    // 1b. Breadboard: every hole on the same internal node reads as one signal
    if (other.type === 'breadboard' || other.type === 'breadboard_small') {
      const bg = window._breadboardGetGroup;
      const grp = bg && bg(targetPin);
      if (grp) {
        const def = (window.ArduinoComponents?.COMPONENT_DEFS || {})[other.type];
        for (const p of (def?.pins || [])) {
          if (bg(p.id) !== grp) continue;
          if (this._readDigitalInput(other.id, p.id, visited) === 1) return 1;
        }
      }
      return 0;
    }

    // 2. Pass-through components (Resistors)
    if (other.type === 'resistor') {
      const otherPin = targetPin === 'p1' ? 'p2' : 'p1';
      return this._readDigitalInput(other.id, otherPin, visited);
    }

    // 3. Push buttons
    if (other.type === 'push_button') {
      const pressed = other.runtimeState && other.runtimeState.pressed;
      if (pressed) {
        const nextPin = (targetPin === 'p1' || targetPin === 'p2') ? 'p3' : 'p1';
        return this._readDigitalInput(other.id, nextPin, visited);
      }
      // Unpressed: pass through adjacent terminal pairs (p1-p2 or p3-p4)
      const pairMap = { p1: 'p2', p2: 'p1', p3: 'p4', p4: 'p3' };
      return pairMap[targetPin] ? this._readDigitalInput(other.id, pairMap[targetPin], visited) : 0;
    }

    // 3b. Slide switch — only the selected throw conducts through to COM
    if (other.type === 'slide_switch') {
      const sel = typeof window._slideSwitchThrow === 'function'
        ? window._slideSwitchThrow(other) : 'a';
      if (targetPin === 'com') return this._readDigitalInput(other.id, sel, visited);
      if (targetPin === sel) return this._readDigitalInput(other.id, 'com', visited);
      return 0; // the other throw is open
    }

    // 4. Analog signal sources (with 2.5V CMOS digital thresholding)
    if (other.type === 'func_gen') {
      const rs = other.runtimeState || {};
      const v = targetPin === 'ch1_out' ? (rs.ch1_voltage || 0)
        : targetPin === 'ch2_out' ? (rs.ch2_voltage || 0) : 0;
      return v >= 2.5 ? 1 : 0;
    }

    if (other.type === 'potentiometer' && (targetPin === 'wiper' || targetPin === 'p2' || targetPin === 'out' || targetPin === 'w')) {
      const v = (other.runtimeState && (other.runtimeState.voltage ?? ((other.runtimeState.wiper || 0) / 1023 * 5.0))) || 0;
      return v >= 2.5 ? 1 : 0;
    }

    // 5. Arduino Pin state bridge
    const pn = this._getConnectedPinNum(fromInstId, pinId);
    if (pn !== null) {
      const sim = window.ArduinoSim;
      return (sim && sim.pinStates && (sim.pinStates[`pin_${pn}`] || 0) > 0) ? 1 : 0;
    }

    // 6. Integrated Circuits with Active-LOW default handling
    const icSpec = IC_OUTPUT_MAP[other.type];
    if (icSpec && icSpec.pins.includes(targetPin)) {
      const rs = other.runtimeState || {};
      if (rs[targetPin] !== undefined) {
        return rs[targetPin] > 0 ? 1 : 0;
      }
      // Default fallback: Active-LOW pins default to 1, others to 0
      return icSpec.activeLow.includes(targetPin) ? 1 : 0;
    }

    return 0;
  }

  _hasDigitalInputSource(fromInstId, pinId, visited = new Set()) {
    const visitKey = `${fromInstId}:${pinId}`;
    if (visited.has(visitKey)) return false;
    visited.add(visitKey);
    if (this._getForcedLevel(fromInstId, pinId) !== null) return true;
    const wireTarget = this._getWireTarget(fromInstId, pinId);
    if (!wireTarget) return false;
    const other = wireTarget.inst;
    const targetPin = wireTarget.pinId;
    if (other.type === 'power_5v' || other.type === 'power_gnd') return true;
    if (other.type === 'logic_level_in') return true;
    if (other.type === 'breadboard' || other.type === 'breadboard_small') {
      const bg = window._breadboardGetGroup;
      const grp = bg && bg(targetPin);
      if (grp) {
        const def = (window.ArduinoComponents?.COMPONENT_DEFS || {})[other.type];
        for (const p of (def?.pins || [])) {
          if (bg(p.id) !== grp) continue;
          if (this._hasDigitalInputSource(other.id, p.id, visited)) return true;
        }
      }
      return false;
    }
    if (other.type === 'resistor') {
      const otherPin = targetPin === 'p1' ? 'p2' : 'p1';
      return this._hasDigitalInputSource(other.id, otherPin, visited);
    }
    if (other.type === 'push_button') {
      const nextPin = (targetPin === 'p1' || targetPin === 'p2')
        ? (targetPin === 'p1' ? 'p2' : 'p1')
        : (targetPin === 'p3' ? 'p4' : 'p3');
      return this._hasDigitalInputSource(other.id, nextPin, visited);
    }
    if (other.type === 'slide_switch') {
      const sel = typeof window._slideSwitchThrow === 'function'
        ? window._slideSwitchThrow(other) : 'a';
      if (targetPin === 'com') return this._hasDigitalInputSource(other.id, sel, visited);
      if (targetPin === sel) return this._hasDigitalInputSource(other.id, 'com', visited);
      return false;
    }
    if (other.type === 'func_gen') return true;
    if (other.type === 'potentiometer' && (targetPin === 'wiper' || targetPin === 'p2' || targetPin === 'out' || targetPin === 'w')) return true;
    const pn = this._getConnectedPinNum(fromInstId, pinId);
    if (pn !== null) return true;
    const icSpec = IC_OUTPUT_MAP[other.type];
    if (icSpec && icSpec.pins.includes(targetPin)) return true;
    return false;
  }

  _readAnalogInput(fromInstId, pinId) {
    const wireTarget = this._getWireTarget(fromInstId, pinId);
    if (!wireTarget) {
      // No wire on this pin — an interactive value (e.g. a remote slider)
      // may already sit in pinStates for board pins.
      const from = this.components.find(c => c.id === fromInstId);
      const boardTypes = ['arduino_uno', 'arduino_nano', 'esp32_devkit_v1', 'lpc2148', 'stm32f746_disco', 'pico2w', 'intel_8085', 'intel_8051', 'industrial_plc'];
      if (from && boardTypes.includes(from.type)) {
        const pn = this._pinToNumber(pinId);
        const sim = window.ArduinoSim;
        return (sim && sim.pinStates) ? (sim.pinStates[`pin_${pn}`] || 0) : 0;
      }
      return 0;
    }
    const other = wireTarget.inst;
    if (other.type === 'power_5v') return 1023;
    if (other.type === 'power_gnd') return 0;
    if (other.type === 'func_gen') {
      const rs = other.runtimeState || {};
      const tp = wireTarget.pinId;
      const v = tp === 'ch1_out' ? (rs.ch1_voltage != null ? rs.ch1_voltage : 0)
        : tp === 'ch2_out' ? (rs.ch2_voltage != null ? rs.ch2_voltage : 0) : 0;
      const src = this.components.find(c => c.id === fromInstId);
      const vRef = (src && (src.type === 'esp32_devkit_v1' || src.type === 'stm32f746_disco'
        || src.type === 'lpc2148' || src.type === 'pico2w')) ? 3.3 : 5.0;
      const clampedV = Math.max(0, Math.min(vRef, v));
      return Math.max(0, Math.min(1023, Math.round((clampedV / vRef) * 1023)));
    }
    if (other.type === 'push_button') {
      const pressed = other.runtimeState && other.runtimeState.pressed;
      const tp = wireTarget.pinId;
      if (pressed) {
        if (tp === 'p1' || tp === 'p2') return this._readAnalogInput(other.id, 'p3');
        return this._readAnalogInput(other.id, 'p1');
      }
      if (tp === 'p1') return this._readAnalogInput(other.id, 'p2');
      if (tp === 'p2') return this._readAnalogInput(other.id, 'p1');
      if (tp === 'p3') return this._readAnalogInput(other.id, 'p4');
      if (tp === 'p4') return this._readAnalogInput(other.id, 'p3');
      return 0;
    }
    // Slide switch — follow COM onto the selected throw (the open throw reads 0
    // instead of leaving a stale ADC value from the previous position).
    if (other.type === 'slide_switch') {
      const sel = typeof window._slideSwitchThrow === 'function'
        ? window._slideSwitchThrow(other) : 'a';
      const tp = wireTarget.pinId;
      if (tp === 'com') return this._readAnalogInput(other.id, sel);
      if (tp === sel) return this._readAnalogInput(other.id, 'com');
      return 0;
    }
    // For a potentiometer wiper, return the component's live value directly.
    // Do this before resolving the Arduino pin number; otherwise analogRead()
    // can simply read the previous cached pinState value.
    if (other.type === 'potentiometer' && (wireTarget.pinId === 'wiper' || wireTarget.pinId === 'p2' || wireTarget.pinId === 'out' || wireTarget.pinId === 'w')) {
      if (this.engine && typeof this.engine.getVoltageAtPin === 'function') {
        const v = this.engine.getVoltageAtPin(other.id, wireTarget.pinId)
          ?? this.engine.getVoltageAtPin(other.id, 'wiper')
          ?? this.engine.getVoltageAtPin(other.id, 'p2');
        if (Number.isFinite(v)) {
          const src = this.components.find(c => c.id === fromInstId);
          const vRef = (src && (src.type === 'esp32_devkit_v1' || src.type === 'stm32f746_disco'
            || src.type === 'lpc2148' || src.type === 'pico2w')) ? 3.3 : 5.0;
          return Math.max(0, Math.min(1023, Math.round((v / vRef) * 1023)));
        }
      }
      const value = other.runtimeState?.value ?? other.props?.value ?? 512;
      const maxValue = Number(other.props?.maxValue ?? 1023);
      return Math.max(0, Math.min(1023, Math.round((Number(value) / maxValue) * 1023)));
    }

    // Passive networks (voltage dividers fed by a battery, regulator rails…)
    // aren't tracked in pinStates — read the solved nodal voltage instead.
    if (this.engine && typeof this.engine.getVoltageAtPin === 'function') {
      const v = this.engine.getVoltageAtPin(fromInstId, pinId);
      if (Number.isFinite(v) && v > 0) {
        const src = this.components.find(c => c.id === fromInstId);
        const vRef = (src && (src.type === 'esp32_devkit_v1' || src.type === 'stm32f746_disco'
          || src.type === 'lpc2148' || src.type === 'pico2w')) ? 3.3 : 5.0;
        return Math.max(0, Math.min(1023, Math.round((v / vRef) * 1023)));
      }
    }

    const pn = this._getConnectedPinNum(fromInstId, pinId);
    if (pn !== null) {
      const sim = window.ArduinoSim;
      return (sim && sim.pinStates) ? (sim.pinStates[`pin_${pn}`] || 0) : 0;
    }
    // If the source is a board but the wire target is a sensor (not a board),
    // read from pinStates directly — sensors like LM35 write ADC values there.
    const fromInst = this.components.find(c => c.id === fromInstId);
    if (fromInst && (fromInst.type === 'arduino_uno' || fromInst.type === 'arduino_nano' || fromInst.type === 'esp32_devkit_v1' || fromInst.type === 'lpc2148' || fromInst.type === 'pico2w' || fromInst.type === 'stm32f746_disco' || fromInst.type === 'intel_8085' || fromInst.type === 'intel_8051' || fromInst.type === 'industrial_plc')) {
      const boardPn = this._pinToNumber(pinId);
      const sim = window.ArduinoSim;
      return (sim && sim.pinStates) ? (sim.pinStates[`pin_${boardPn}`] || 0) : 0;
    }
    if (IC_OUTPUT_PIN_LIST[other.type] && IC_OUTPUT_PIN_LIST[other.type].includes(wireTarget.pinId)) {
      const raw = other.runtimeState && other.runtimeState[wireTarget.pinId] != null
        ? other.runtimeState[wireTarget.pinId] : 0;
      return Math.round((raw / 255) * 1023);
    }
    return 0;
  }

  _writeDigitalOutput(fromInstId, pinId, val) {
    const sim = window.ArduinoSim;
    const ps = sim ? sim.pinStates : null;
    const pn = this._getConnectedPinNum(fromInstId, pinId);
    if (pn !== null && ps) ps[`pin_${pn}`] = val ? 255 : 0;
    const wireTarget = this._getWireTarget(fromInstId, pinId);
    if (!wireTarget) return;
    const other = wireTarget.inst;
    // 8255: latch bus changes immediately. A microprocessor can issue and
    // retract a WR̄ pulse many thousands of times between two rendered
    // frames, so waiting for the per-frame step() would miss every write.
    if (other.type === 'ic_8255') {
      const defs = window.ArduinoComponents && window.ArduinoComponents.COMPONENT_DEFS;
      const d8255 = defs && defs.ic_8255;
      if (d8255 && typeof d8255._onBusPin === 'function') d8255._onBusPin(other, wireTarget.pinId, val);
    }
    const IC_OUT = {
      ic_555: ['OUT'],
      ic_74hc00: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc04: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
      ic_74hc08: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc32: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc595: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'QHn'],
      ic_74hc138: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
      ic_74hc245: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'],
      ic_74hc74: ['Q1', 'Q1n', 'Q2', 'Q2n'],
      ic_74hc165: ['Q7', 'Q7n'],
      ic_74hc193: ['Q0', 'Q1', 'Q2', 'Q3', 'TCU', 'TCD'],
      ic_74hc47: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      ic_74hc148: ['A0', 'A1', 'A2', 'GS', 'EO'],
      ic_74hc02: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc86: ['Y1', 'Y2', 'Y3', 'Y4'],
      ic_74hc139: ['Y0_1', 'Y1_1', 'Y2_1', 'Y3_1', 'Y0_2', 'Y1_2', 'Y2_2', 'Y3_2'],
      ic_74hc153: ['Y1', 'Y2'],
      ic_74hc164: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
      ic_74hc4017: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q59'],
      lm741: ['OUT'],
      lm358: ['1OUT', '2OUT'],
      lm393: ['1OUT', '2OUT'],
      lm324: ['1OUT', '2OUT', '3OUT', '4OUT'],
      cd4066: ['SIG1B', 'SIG2B', 'SIG3B', 'SIG4B'],
      ic_74hc14: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
      ic_74hc283: ['S1', 'S2', 'S3', 'S4', 'C4'],
      ic_74hc85: ['QA_GT_B', 'QA_EQ_B', 'QA_LT_B'],
      ic_74hc151: ['Y', 'W'],
      ic_74hc76: ['1Q', '1Qn', '2Q', '2Qn'],
      ic_8255: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
                'PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7',
                'PB0','PB1','PB2','PB3','PB4','PB5','PB6','PB7',
                'PC0','PC1','PC2','PC3','PC4','PC5','PC6','PC7'],
    };
    if (IC_OUT[other.type] && IC_OUT[other.type].includes(wireTarget.pinId)) {
      other.runtimeState[wireTarget.pinId] = val ? 255 : 0;
    }
  }
}

/* Export */
window.CircuitCanvas = null; // Will be set in app.js
window.CircuitCanvasClass = CircuitCanvas;
