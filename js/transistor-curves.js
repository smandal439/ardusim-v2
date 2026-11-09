/**
 * js/transistor-curves.js
 * Transistor Characteristics Analyzer & Interactive Curve Tracer
 *
 * Provides real-time interactive plotting for BJT transistors:
 * - Output Characteristics (Ic vs Vce family of curves, Saturation / Active / Cutoff regions)
 * - Input Characteristics (Ib vs Vbe diode knee curve)
 * - Transfer Characteristics (Ic vs Ib current gain)
 * - DC Load Line & Dynamic Q-Point (Operating Point) tracking
 * - Transistor model preset selection and parameter tuning
 */

'use strict';

(function () {
  const BJT_MODELS = {
    '2N2222': { name: '2N2222', type: 'npn', beta: 160, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 100, desc: 'General Purpose High-Speed NPN' },
    'BC547':  { name: 'BC547',  type: 'npn', beta: 250, vbe_on: 0.66, vce_sat: 0.15, early_voltage: 120, desc: 'Low Noise Audio/General NPN' },
    '2N3904': { name: '2N3904', type: 'npn', beta: 100, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 80,  desc: 'General Purpose Switching NPN' },
    'TIP31C': { name: 'TIP31C', type: 'npn', beta: 40,  vbe_on: 0.70, vce_sat: 0.30, early_voltage: 60,  desc: 'Medium Power NPN (100V, 3A)' },
    '2N2907': { name: '2N2907', type: 'pnp', beta: 160, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 100, desc: 'General Purpose High-Speed PNP' },
    'BC557':  { name: 'BC557',  type: 'pnp', beta: 250, vbe_on: 0.66, vce_sat: 0.15, early_voltage: 120, desc: 'Low Noise Audio/General PNP' },
    '2N3906': { name: '2N3906', type: 'pnp', beta: 100, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 80,  desc: 'General Purpose Switching PNP' },
    'TIP32C': { name: 'TIP32C', type: 'pnp', beta: 40,  vbe_on: 0.70, vce_sat: 0.30, early_voltage: 60,  desc: 'Medium Power PNP (100V, 3A)' },
  };

  class TransistorCurvesModal {
    constructor() {
      this.targetInst = null;
      this.activeTab = 'output'; // 'output' | 'input' | 'transfer' | 'theory'
      this.isOpen = false;
      this.animId = null;
      this.modalEl = null;
      this.canvas = null;
      this.ctx = null;
      this.mouseX = -1;
      this.mouseY = -1;
      this._initDOM();
    }

    _initDOM() {
      if (document.getElementById('modal-transistor-curves')) {
        this.modalEl = document.getElementById('modal-transistor-curves');
        return;
      }

      const overlay = document.getElementById('modal-overlay');
      const container = document.createElement('div');
      container.id = 'modal-transistor-curves';
      container.className = 'modal modal-lg transistor-curves-modal';
      container.setAttribute('role', 'dialog');
      container.setAttribute('aria-modal', 'true');
      container.innerHTML = `
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);padding:12px 18px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">📈</span>
            <div>
              <h2 id="tc-title" style="margin:0;font-size:16px;font-weight:700;color:#f8fafc;">Transistor Characteristics Analyzer</h2>
              <span id="tc-subtitle" style="font-size:12px;color:#94a3b8;">Common Emitter IV Curves & Real-Time Q-Point</span>
            </div>
          </div>
          <button class="modal-close" id="btn-close-tc" aria-label="Close" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;">&times;</button>
        </div>

        <!-- Telemetry strip -->
        <div id="tc-telemetry" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:8px 18px;background:rgba(15,23,42,0.6);border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;font-family:monospace;">
          <div id="tc-badge-region" style="padding:2px 8px;border-radius:4px;font-weight:700;background:#64748b;color:#fff;">CUTOFF</div>
          <div style="color:#cbd5e1;">V<sub id="tc-sub-be">be</sub>: <b id="tc-val-vbe" style="color:#38bdf8;">0.00 V</b></div>
          <div style="color:#cbd5e1;">I<sub>b</sub>: <b id="tc-val-ib" style="color:#38bdf8;">0.00 µA</b></div>
          <div style="color:#cbd5e1;">V<sub id="tc-sub-ce">ce</sub>: <b id="tc-val-vce" style="color:#22c55e;">0.00 V</b></div>
          <div style="color:#cbd5e1;">I<sub>c</sub>: <b id="tc-val-ic" style="color:#22c55e;">0.00 mA</b></div>
          <div style="color:#cbd5e1;">β<sub>eff</sub>: <b id="tc-val-beta" style="color:#f59e0b;">100</b></div>
          <div style="color:#cbd5e1;">P<sub>D</sub>: <b id="tc-val-power" style="color:#e2e8f0;">0.0 mW</b></div>
        </div>

        <div class="modal-body" style="padding:14px 18px;display:flex;flex-direction:column;gap:12px;">
          <!-- Tabs Navigation -->
          <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
            <button type="button" class="tc-tab active" data-tab="output" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#f8fafc;font-size:13px;font-weight:600;cursor:pointer;">📊 Output (Ic vs Vce)</button>
            <button type="button" class="tc-tab" data-tab="input" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">📉 Input (Ib vs Vbe)</button>
            <button type="button" class="tc-tab" data-tab="transfer" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">📈 Transfer (Ic vs Ib)</button>
            <button type="button" class="tc-tab" data-tab="theory" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">📖 Theory & Lab Guide</button>
          </div>

          <!-- Main Layout: Canvas + Parameter Panel -->
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <!-- Canvas Graph -->
            <div style="flex:1;position:relative;background:#0b1120;border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;min-height:380px;">
              <canvas id="tc-canvas" width="660" height="380" style="width:100%;height:380px;display:block;"></canvas>
              <!-- Educational Overlay Info -->
              <div id="tc-theory-pane" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:#0b1120;overflow-y:auto;padding:18px;color:#cbd5e1;font-size:13px;line-height:1.6;">
                <h3 style="color:#f8fafc;margin-top:0;">Transistor Characteristics (Common Emitter)</h3>
                <p>A Bipolar Junction Transistor (BJT) is a current-controlled active device. In a common-emitter circuit, its operation is defined by three fundamental characteristic plots:</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;">
                  <div style="background:#1e293b;padding:12px;border-radius:6px;">
                    <b style="color:#38bdf8;">1. Output Characteristics (I<sub>C</sub> vs V<sub>CE</sub>):</b>
                    <ul style="padding-left:18px;margin:6px 0;">
                      <li><b>Cutoff:</b> I<sub>B</sub> ≤ 0. I<sub>C</sub> ≈ 0. Device acts as open switch.</li>
                      <li><b>Active:</b> V<sub>CE</sub> ≥ V<sub>CE(sat)</sub>. I<sub>C</sub> = β · I<sub>B</sub> · (1 + V<sub>CE</sub> / V<sub>A</sub>). Curves are flat horizontal lines with slight Early slope.</li>
                      <li><b>Saturation:</b> V<sub>CE</sub> &lt; V<sub>CE(sat)</sub>. I<sub>C</sub> drops sharply to 0 as both junctions forward bias.</li>
                    </ul>
                  </div>
                  <div style="background:#1e293b;padding:12px;border-radius:6px;">
                    <b style="color:#22c55e;">2. Input Characteristics (I<sub>B</sub> vs V<sub>BE</sub>):</b>
                    <ul style="padding-left:18px;margin:6px 0;">
                      <li>Forward-biased P-N diode curve.</li>
                      <li>Negligible current below cut-in knee (V<sub>BE(on)</sub> ≈ 0.65 V).</li>
                      <li>Above 0.65 V, base current increases rapidly.</li>
                      <li>Dynamic input resistance: r<sub>in</sub> = ΔV<sub>BE</sub> / ΔI<sub>B</sub> |<sub>Vce</sub>.</li>
                    </ul>
                  </div>
                </div>
                <div style="background:#1e293b;padding:12px;border-radius:6px;margin-bottom:12px;">
                  <b style="color:#f59e0b;">3. DC Load Line & Q-Point:</b>
                  <p style="margin:4px 0;">The DC load line represents the external collector circuit constraint: <code>I<sub>C</sub> = (V<sub>CC</sub> - V<sub>CE</sub>) / R<sub>C</sub></code>. The intersection of the load line with the active base current characteristic curve defines the operating Quiescent Point (Q-Point).</p>
                </div>
              </div>
            </div>

            <!-- Parameters Sidebar -->
            <div style="width:230px;background:#131c2e;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:12px;">
              <span style="font-weight:700;color:#f8fafc;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px;">BJT Model & Tuning</span>

              <div>
                <label style="color:#94a3b8;display:block;margin-bottom:4px;">Preset Model</label>
                <select id="tc-ctrl-model" class="prop-input" style="width:100%;padding:5px 8px;font-size:12px;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:4px;">
                  <option value="2N2222">2N2222 (General NPN, β=160)</option>
                  <option value="BC547">BC547 (Low Noise NPN, β=250)</option>
                  <option value="2N3904">2N3904 (Switching NPN, β=100)</option>
                  <option value="TIP31C">TIP31C (Power NPN, 3A, β=40)</option>
                  <option value="2N3906">2N3906 (General PNP, β=100)</option>
                  <option value="2N2907">2N2907 (Switching PNP, β=160)</option>
                  <option value="BC557">BC557 (Audio PNP, β=250)</option>
                  <option value="TIP32C">TIP32C (Power PNP, 3A, β=40)</option>
                  <option value="custom">Custom Parameters</option>
                </select>
              </div>

              <div>
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span>Gain β (h<sub>FE</sub>)</span>
                  <b id="tc-txt-beta" style="color:#f8fafc;">160</b>
                </div>
                <input type="range" id="tc-slider-beta" min="10" max="600" step="5" value="160" style="width:100%;">
              </div>

              <div>
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span>V<sub>be(on)</sub> (V)</span>
                  <b id="tc-txt-vbe-on" style="color:#f8fafc;">0.65 V</b>
                </div>
                <input type="range" id="tc-slider-vbe-on" min="0.4" max="1.0" step="0.01" value="0.65" style="width:100%;">
              </div>

              <div>
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span>V<sub>ce(sat)</sub> (V)</span>
                  <b id="tc-txt-vce-sat" style="color:#f8fafc;">0.20 V</b>
                </div>
                <input type="range" id="tc-slider-vce-sat" min="0.05" max="0.6" step="0.01" value="0.20" style="width:100%;">
              </div>

              <div>
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span>Early Voltage V<sub>A</sub></span>
                  <b id="tc-txt-va" style="color:#f8fafc;">100 V</b>
                </div>
                <input type="range" id="tc-slider-va" min="30" max="300" step="5" value="100" style="width:100%;">
              </div>

              <div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#cbd5e1;">
                  <input type="checkbox" id="tc-chk-loadline" checked>
                  <span>Show DC Load Line</span>
                </label>
              </div>

              <button type="button" id="tc-btn-apply" class="hdr-btn hdr-btn-run" style="margin-top:6px;width:100%;justify-content:center;font-size:12px;padding:6px 0;">
                Update Transistor
              </button>
            </div>
          </div>
        </div>
      `;

      if (overlay) {
        overlay.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
      this.modalEl = container;

      // Event listeners
      container.querySelector('#btn-close-tc')?.addEventListener('click', () => this.close());
      container.querySelectorAll('.tc-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
          container.querySelectorAll('.tc-tab').forEach(b => {
            b.classList.remove('active');
            b.style.color = '#94a3b8';
            b.style.background = 'none';
          });
          const target = e.currentTarget;
          target.classList.add('active');
          target.style.color = '#f8fafc';
          target.style.background = 'rgba(255,255,255,0.08)';
          this.activeTab = target.dataset.tab;
          const theoryPane = container.querySelector('#tc-theory-pane');
          if (theoryPane) {
            theoryPane.style.display = (this.activeTab === 'theory') ? 'block' : 'none';
          }
          this.render();
        });
      });

      this.canvas = container.querySelector('#tc-canvas');
      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
        this.canvas.addEventListener('mousemove', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          this.mouseX = e.clientX - rect.left;
          this.mouseY = e.clientY - rect.top;
        });
        this.canvas.addEventListener('mouseleave', () => {
          this.mouseX = -1;
          this.mouseY = -1;
        });
      }

      // Slider hooks
      const setupSlider = (id, txtId, unit, propKey) => {
        const slider = container.querySelector('#' + id);
        const txt = container.querySelector('#' + txtId);
        slider?.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (txt) txt.textContent = val + (unit ? ' ' + unit : '');
          if (this.targetInst) {
            this.targetInst.props = this.targetInst.props || {};
            this.targetInst.props[propKey] = val;
            this.targetInst.props.model = 'custom';
            const modelSelect = container.querySelector('#tc-ctrl-model');
            if (modelSelect) modelSelect.value = 'custom';
          }
          this._recalculateCircuit();
        });
      };
      setupSlider('tc-slider-beta', 'tc-txt-beta', '', 'beta');
      setupSlider('tc-slider-vbe-on', 'tc-txt-vbe-on', 'V', 'vbe_on');
      setupSlider('tc-slider-vce-sat', 'tc-txt-vce-sat', 'V', 'vce_sat');
      setupSlider('tc-slider-va', 'tc-txt-va', 'V', 'early_voltage');

      container.querySelector('#tc-ctrl-model')?.addEventListener('change', (e) => {
        const m = e.target.value;
        if (m === 'custom') return;
        const p = BJT_MODELS[m];
        if (p && this.targetInst) {
          this.targetInst.props = this.targetInst.props || {};
          this.targetInst.props.model = m;
          this.targetInst.props.beta = p.beta;
          this.targetInst.props.vbe_on = p.vbe_on;
          this.targetInst.props.vce_sat = p.vce_sat;
          this.targetInst.props.early_voltage = p.early_voltage;
          this._syncControlValues();
          this._recalculateCircuit();
        }
      });

      container.querySelector('#tc-chk-loadline')?.addEventListener('change', () => {
        this.render();
      });

      container.querySelector('#tc-btn-apply')?.addEventListener('click', () => {
        this._recalculateCircuit();
      });
    }

    _syncControlValues() {
      if (!this.targetInst || !this.modalEl) return;
      const props = this.targetInst.props || {};
      const isNPN = this.targetInst.type === 'npn_transistor';
      const model = props.model || (isNPN ? '2N2222' : '2N3906');
      const preset = BJT_MODELS[model] || {};

      const beta = Number(props.beta ?? preset.beta ?? 100);
      const vbeOn = Number(props.vbe_on ?? preset.vbe_on ?? 0.65);
      const vceSat = Number(props.vce_sat ?? preset.vce_sat ?? 0.20);
      const va = Number(props.early_voltage ?? preset.early_voltage ?? 100);

      const mSel = this.modalEl.querySelector('#tc-ctrl-model');
      if (mSel) mSel.value = model;

      const setVal = (id, txtId, val, unit) => {
        const input = this.modalEl.querySelector('#' + id);
        const txt = this.modalEl.querySelector('#' + txtId);
        if (input) input.value = val;
        if (txt) txt.textContent = val + (unit ? ' ' + unit : '');
      };
      setVal('tc-slider-beta', 'tc-txt-beta', beta, '');
      setVal('tc-slider-vbe-on', 'tc-txt-vbe-on', vbeOn.toFixed(2), 'V');
      setVal('tc-slider-vce-sat', 'tc-txt-vce-sat', vceSat.toFixed(2), 'V');
      setVal('tc-slider-va', 'tc-txt-va', va, 'V');
    }

    _recalculateCircuit() {
      const CC = window.CircuitCanvas || (window.App && window.App.canvas);
      if (CC && CC.engine && typeof CC.engine.solve === 'function') {
        CC.engine.solve(CC);
      }
      this.render();
    }

    open(inst) {
      if (!inst) return;
      this.targetInst = inst;
      this._initDOM();
      this.isOpen = true;

      const isNPN = inst.type === 'npn_transistor';
      const title = this.modalEl.querySelector('#tc-title');
      const subtitle = this.modalEl.querySelector('#tc-subtitle');
      const subBe = this.modalEl.querySelector('#tc-sub-be');
      const subCe = this.modalEl.querySelector('#tc-sub-ce');

      const modelName = inst.props?.model || (isNPN ? '2N2222' : '2N3906');
      if (title) title.textContent = `${modelName} · ${isNPN ? 'NPN' : 'PNP'} Transistor Characteristics`;
      if (subtitle) subtitle.textContent = `Common Emitter Multi-Curve Analysis & Dynamic Q-Point`;
      if (subBe) subBe.textContent = isNPN ? 'be' : 'eb';
      if (subCe) subCe.textContent = isNPN ? 'ce' : 'ec';

      this._syncControlValues();

      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.classList.remove('hidden');
      this.modalEl.classList.add('active');

      // Start live update loop
      const loop = () => {
        if (!this.isOpen) return;
        this.render();
        this.animId = requestAnimationFrame(loop);
      };
      if (this.animId) cancelAnimationFrame(this.animId);
      this.animId = requestAnimationFrame(loop);
    }

    close() {
      this.isOpen = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.modalEl) this.modalEl.classList.remove('active');
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.classList.add('hidden');
    }

    render() {
      if (!this.ctx || !this.targetInst || !this.isOpen) return;
      this._updateTelemetry();
      if (this.activeTab === 'theory') return;

      const W = this.canvas.width;
      const H = this.canvas.height;
      const ctx = this.ctx;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, W, H);

      switch (this.activeTab) {
        case 'output':
          this._drawOutputCharacteristics(ctx, W, H);
          break;
        case 'input':
          this._drawInputCharacteristics(ctx, W, H);
          break;
        case 'transfer':
          this._drawTransferCharacteristics(ctx, W, H);
          break;
      }
    }

    _updateTelemetry() {
      if (!this.targetInst || !this.modalEl) return;
      const rs = this.targetInst.runtimeState || {};
      const isNPN = this.targetInst.type === 'npn_transistor';
      const region = rs.region || (rs.conducting ? 'active' : 'cutoff');

      const badge = this.modalEl.querySelector('#tc-badge-region');
      if (badge) {
        badge.textContent = region.toUpperCase();
        if (region === 'saturation') {
          badge.style.background = '#22c55e';
          badge.style.color = '#022c22';
        } else if (region === 'active') {
          badge.style.background = '#38bdf8';
          badge.style.color = '#082f49';
        } else {
          badge.style.background = '#64748b';
          badge.style.color = '#fff';
        }
      }

      const vbe = rs.vbe || 0;
      const vce = rs.vce || 0;
      const ib = rs.ib || 0;
      const ic = rs.ic || 0;
      const power = rs.power || (vce * ic + vbe * ib);
      const betaEff = (ib > 1e-7) ? (ic / ib).toFixed(1) : (this.targetInst.props?.beta || 100);

      const setTxt = (id, str) => {
        const el = this.modalEl.querySelector('#' + id);
        if (el) el.textContent = str;
      };
      setTxt('tc-val-vbe', vbe.toFixed(3) + ' V');
      setTxt('tc-val-ib', (ib >= 0.001 ? (ib * 1e3).toFixed(2) + ' mA' : (ib * 1e6).toFixed(1) + ' µA'));
      setTxt('tc-val-vce', vce.toFixed(3) + ' V');
      setTxt('tc-val-ic', (ic >= 1 ? ic.toFixed(2) + ' A' : (ic * 1e3).toFixed(2) + ' mA'));
      setTxt('tc-val-beta', betaEff);
      setTxt('tc-val-power', (power * 1000).toFixed(1) + ' mW');
    }

    _drawAxes(ctx, ox, oy, pw, ph, xLabel, yLabel, xMax, yMax, xTicks = 5, yTicks = 5) {
      // Background Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= xTicks; i++) {
        const x = ox + (pw / xTicks) * i;
        ctx.moveTo(x, oy);
        ctx.lineTo(x, oy - ph);
      }
      for (let j = 0; j <= yTicks; j++) {
        const y = oy - (ph / yTicks) * j;
        ctx.moveTo(ox, y);
        ctx.lineTo(ox + pw, y);
      }
      ctx.stroke();

      // Main Axes
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy - ph - 10);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox + pw + 15, oy);
      ctx.stroke();

      // Tick Labels
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      for (let i = 0; i <= xTicks; i++) {
        const xVal = (xMax / xTicks) * i;
        const x = ox + (pw / xTicks) * i;
        ctx.fillText(xVal.toFixed(xMax < 2 ? 2 : 1), x, oy + 15);
      }
      ctx.fillText(xLabel, ox + pw / 2, oy + 32);

      ctx.textAlign = 'right';
      for (let j = 0; j <= yTicks; j++) {
        const yVal = (yMax / yTicks) * j;
        const y = oy - (ph / yTicks) * j;
        ctx.fillText(yVal.toFixed(yMax < 1 ? 2 : 1), ox - 8, y + 3);
      }

      ctx.save();
      ctx.translate(ox - 36, oy - ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    /* ═══════════════════════════════════════════════════════
       1. Output Characteristics: Ic vs Vce for multiple Ib
       ═══════════════════════════════════════════════════════ */
    _drawOutputCharacteristics(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};
      const isNPN = inst.type === 'npn_transistor';

      const beta = Number(props.beta || 160);
      const vceSat = Number(props.vce_sat || 0.20);
      const va = Number(props.early_voltage || 100);

      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      const vceMax = 12.0; // 0 to 12V
      const activeIb = rs.ib || 0;

      // Base current step determination
      let ibStep = 20e-6; // 20 uA
      if (activeIb > 100e-6) ibStep = Math.ceil(activeIb / 4 / 10e-6) * 10e-6;
      else if (activeIb > 0 && activeIb < 10e-6) ibStep = 5e-6;

      const numCurves = 5;
      const icMaxmA = ((numCurves * ibStep * beta * (1 + vceMax / va)) * 1000) * 1.15;
      const icMaxA = icMaxmA / 1000;

      // 1. Shaded Operating Zones
      // Saturation Zone (Vce < Vce_sat)
      const satW = (vceSat / vceMax) * pw;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fillRect(ox, oy - ph, satW, ph);

      // Saturation Boundary line
      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ox + satW, oy);
      ctx.lineTo(ox + satW, oy - ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'left';
      ctx.fillText('SATURATION', ox + 4, oy - ph + 15);
      ctx.fillText(`Vce < ${vceSat.toFixed(2)}V`, ox + 4, oy - ph + 27);

      // Active Region Label
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('ACTIVE REGION (Ic = β · Ib)', ox + satW + 10, oy - ph + 15);

      // 2. Draw Axes
      const xLbl = isNPN ? 'Collector-Emitter Voltage V_CE (V)' : 'Emitter-Collector Voltage V_EC (V)';
      this._drawAxes(ctx, ox, oy, pw, ph, xLbl, 'Collector Current I_C (mA)', vceMax, icMaxmA, 6, 5);

      // 3. Family of Output Characteristic Curves: Ic = beta * Ib * (1 - exp(-Vce/Vk)) * (1 + Vce/Va)
      const vk = vceSat / 2.3;
      for (let step = 1; step <= numCurves; step++) {
        const curIb = step * ibStep;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        for (let px = 0; px <= pw; px += 2) {
          const vce = (px / pw) * vceMax;
          const icActive = beta * curIb * (1 + vce / va);
          const ic = icActive * (1 - Math.exp(-vce / vk));
          const py = oy - (ic / icMaxA) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();

        // Label on curve
        const endVce = vceMax;
        const endIc = beta * curIb * (1 + endVce / va) * (1 - Math.exp(-endVce / vk));
        const endY = oy - (endIc / icMaxA) * ph;
        ctx.font = '9px monospace';
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'left';
        ctx.fillText(`Ib=${(curIb * 1e6).toFixed(0)}µA`, ox + pw + 3, endY + 3);
      }

      // Cutoff curve (Ib = 0 -> Ic = 0)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + pw, oy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText('Ib = 0 (Cutoff)', ox + pw + 3, oy + 3);

      // 4. Highlighted Live Operating Curve for actual Ib
      if (activeIb > 1e-8) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= pw; px += 2) {
          const vce = (px / pw) * vceMax;
          const icActive = beta * activeIb * (1 + vce / va);
          const ic = icActive * (1 - Math.exp(-vce / vk));
          const py = oy - (ic / icMaxA) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();
      }

      // 5. DC Load Line (if connected to collector load resistor and supply)
      const showLoadLine = this.modalEl.querySelector('#tc-chk-loadline')?.checked;
      const CC = window.CircuitCanvas || (window.App && window.App.canvas);
      if (showLoadLine && CC && CC.engine) {
        const engine = CC.engine;
        const cNet = engine.getNetForPin(inst.id, 'collector');
        if (cNet) {
          let vcc = 0;
          let rLoad = 0;
          for (const c of (CC.components || [])) {
            if (c.type === 'resistor') {
              const n1 = engine.getNetForPin(c.id, 'p1');
              const n2 = engine.getNetForPin(c.id, 'p2');
              if (n1 === cNet || n2 === cNet) {
                const other = (n1 === cNet) ? n2 : n1;
                vcc = Math.max(vcc, other?.voltage || 0);
                rLoad += (Number(c.props?.value) || 220) * (c.props?.unit === 'kΩ' ? 1e3 : 1);
              }
            } else if (c.type === 'bulb_12v') {
              const n1 = engine.getNetForPin(c.id, 'anode');
              const n2 = engine.getNetForPin(c.id, 'cathode');
              if (n1 === cNet || n2 === cNet) {
                const other = (n1 === cNet) ? n2 : n1;
                vcc = Math.max(vcc, other?.voltage || 0);
                rLoad += 12;
              }
            }
          }

          if (vcc > 0 && rLoad > 0) {
            const icSatLoad = (vcc / rLoad);
            const xIntercept = Math.min(vceMax, vcc);
            const yIntercept = icSatLoad;

            const pxVcc = (xIntercept / vceMax) * pw;
            const pyIc = oy - (Math.min(icMaxA, yIntercept) / icMaxA) * ph;

            ctx.strokeStyle = '#eab308';
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(ox, pyIc);
            ctx.lineTo(ox + pxVcc, oy);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#eab308';
            ctx.textAlign = 'right';
            ctx.fillText(`Load Line (Rc=${rLoad}Ω, Vcc=${vcc.toFixed(1)}V)`, ox + pxVcc - 4, oy - 8);
          }
        }
      }

      // 6. Dynamic Operating Point (Q-Point) Marker
      const liveVce = Math.min(vceMax, Math.max(0, rs.vce || 0));
      const liveIcA = Math.min(icMaxA, Math.max(0, rs.ic || 0));
      const qx = ox + (liveVce / vceMax) * pw;
      const qy = oy - (liveIcA / icMaxA) * ph;

      // Glow behind Q-point
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(qx, qy, 10 + 3 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Q-point center dot
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(qx, qy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Q-point label box
      const region = rs.region || 'cutoff';
      const qText = `Q: (${liveVce.toFixed(2)}V, ${(liveIcA * 1000).toFixed(2)}mA) [${region.toUpperCase()}]`;
      ctx.font = 'bold 10px monospace';
      const tw = ctx.measureText(qText).width;
      let bx = qx + 10;
      let by = qy - 12;
      if (bx + tw > W - 15) bx = qx - tw - 12;
      if (by < 20) by = qy + 18;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.fillRect(bx - 4, by - 10, tw + 8, 16);
      ctx.strokeRect(bx - 4, by - 10, tw + 8, 16);

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.fillText(qText, bx, by + 2);
    }

    /* ═══════════════════════════════════════════════════════
       2. Input Characteristics: Ib vs Vbe
       ═══════════════════════════════════════════════════════ */
    _drawInputCharacteristics(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};
      const isNPN = inst.type === 'npn_transistor';

      const vbeOn = Number(props.vbe_on || 0.65);
      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      const vbeMax = 1.0; // 0 to 1.0 V
      const ibMaxuA = 100.0; // 0 to 100 uA
      const ibMaxA = ibMaxuA * 1e-6;

      const xLbl = isNPN ? 'Base-Emitter Voltage V_BE (V)' : 'Emitter-Base Voltage V_EB (V)';
      this._drawAxes(ctx, ox, oy, pw, ph, xLbl, 'Base Current I_B (µA)', vbeMax, ibMaxuA, 5, 5);

      // Knee voltage threshold indicator
      const kneeX = ox + (vbeOn / vbeMax) * pw;
      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(kneeX, oy);
      ctx.lineTo(kneeX, oy - ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText(`Knee: Vbe(on) = ${vbeOn.toFixed(2)}V`, kneeX, oy - ph + 15);

      // Input Characteristic Curve (exponential forward diode drop with rd ≈ 25Ω)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const rd = 25;
      for (let px = 0; px <= pw; px += 2) {
        const vbe = (px / pw) * vbeMax;
        let ib = 0;
        if (vbe > vbeOn) {
          ib = (vbe - vbeOn) / (rd * 250); // scaled exponential characteristic
        }
        const py = oy - (ib / ibMaxA) * ph;
        if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
        else ctx.lineTo(ox + px, Math.max(oy - ph, py));
      }
      ctx.stroke();

      // Live Q-Point for Vbe and Ib
      const liveVbe = Math.min(vbeMax, Math.max(0, rs.vbe || 0));
      const liveIbuA = Math.min(ibMaxuA, Math.max(0, (rs.ib || 0) * 1e6));
      const qx = ox + (liveVbe / vbeMax) * pw;
      const qy = oy - (liveIbuA / ibMaxuA) * ph;

      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.arc(qx, qy, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(qx, qy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const qText = `Q: (${liveVbe.toFixed(3)}V, ${liveIbuA.toFixed(1)}µA)`;
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.fillText(qText, qx + 8, qy - 6);
    }

    /* ═══════════════════════════════════════════════════════
       3. Transfer Characteristics: Ic vs Ib
       ═══════════════════════════════════════════════════════ */
    _drawTransferCharacteristics(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};

      const beta = Number(props.beta || 160);
      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      const ibMaxuA = 100.0;
      const icMaxmA = (ibMaxuA * 1e-6 * beta * 1000) * 1.2;

      this._drawAxes(ctx, ox, oy, pw, ph, 'Base Current I_B (µA)', 'Collector Current I_C (mA)', ibMaxuA, icMaxmA, 5, 5);

      // Linear Transfer Line with slope = beta
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      const endY = oy - ((ibMaxuA * 1e-6 * beta * 1000) / icMaxmA) * ph;
      ctx.lineTo(ox + pw, endY);
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'right';
      ctx.fillText(`Slope = β (hFE = ${beta})`, ox + pw - 10, endY - 10);

      // Live Q-Point
      const liveIbuA = Math.min(ibMaxuA, Math.max(0, (rs.ib || 0) * 1e6));
      const liveIcmA = Math.min(icMaxmA, Math.max(0, (rs.ic || 0) * 1000));
      const qx = ox + (liveIbuA / ibMaxuA) * pw;
      const qy = oy - (liveIcmA / icMaxmA) * ph;

      ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.beginPath();
      ctx.arc(qx, qy, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(qx, qy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const qText = `Q: (${liveIbuA.toFixed(1)}µA, ${liveIcmA.toFixed(2)}mA)`;
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.fillText(qText, qx + 8, qy - 6);
    }
  }

  // Expose singleton on window
  window.TransistorCurvesModal = new TransistorCurvesModal();
})();
