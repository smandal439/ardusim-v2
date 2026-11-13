/**
 * js/transistor-curves.js
 * Transistor Characteristics Analyzer & Interactive Curve Tracer
 *
 * Provides real-time interactive plotting for:
 * - BJT Transistors (NPN & PNP): Output (Ic vs Vce), Input (Ib vs Vbe), Transfer (Ic vs Ib)
 * - Enhancement MOSFETs (N-Channel & P-Channel): Output (Id vs Vds), Gate Characteristics, Transfer (Id vs Vgs)
 * - Depletion JFETs (N-Channel & P-Channel): Output (Id vs Vds), Gate Junction, Transfer Shockley Curve (Id vs Vgs)
 * - DC Load Line & Dynamic Q-Point (Operating Point) tracking
 * - Model preset selection and parameter tuning
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

  const MOSFET_MODELS = {
    '2N7000':  { name: '2N7000',  channel: 'n', vth: 2.1, rds_on: 1.2, kn: 0.1, lambda: 0.01, desc: 'Small-Signal N-MOSFET (60V, 200mA)' },
    'IRF540N': { name: 'IRF540N', channel: 'n', vth: 3.0, rds_on: 0.044, kn: 5.0, lambda: 0.005, desc: 'Power N-MOSFET (100V, 33A)' },
    'BS170':   { name: 'BS170',   channel: 'n', vth: 2.0, rds_on: 1.8, kn: 0.12, lambda: 0.01, desc: 'Switching N-MOSFET (60V, 500mA)' },
    'IRFZ44N': { name: 'IRFZ44N', channel: 'n', vth: 2.5, rds_on: 0.0175, kn: 8.0, lambda: 0.005, desc: 'Power N-MOSFET (55V, 49A)' },
    'IRF9540N': { name: 'IRF9540N', channel: 'p', vth: -3.0, rds_on: 0.117, kn: 3.0, lambda: 0.005, desc: 'Power P-MOSFET (-100V, -23A)' },
    'VP2106':   { name: 'VP2106',   channel: 'p', vth: -2.0, rds_on: 5.0, kn: 0.08, lambda: 0.01, desc: 'Small-Signal P-MOSFET (-60V, -250mA)' },
    'BS250':    { name: 'BS250',    channel: 'p', vth: -2.2, rds_on: 7.0, kn: 0.05, lambda: 0.01, desc: 'Small-Signal P-MOSFET (-45V, -180mA)' },
    'IRF5305':  { name: 'IRF5305',  channel: 'p', vth: -2.5, rds_on: 0.06, kn: 5.0, lambda: 0.005, desc: 'Power P-MOSFET (-55V, -31A)' },
  };

  const JFET_MODELS = {
    '2N5457': { name: '2N5457', channel: 'n', vp: -3.0, idss: 0.003, rds0: 200, lambda: 0.01, desc: 'General Purpose N-JFET (Vp=-3V, Idss=3mA)' },
    '2N3819': { name: '2N3819', channel: 'n', vp: -4.0, idss: 0.010, rds0: 100, lambda: 0.01, desc: 'RF/Amplifier N-JFET (Vp=-4V, Idss=10mA)' },
    'J201':   { name: 'J201',   channel: 'n', vp: -0.8, idss: 0.0006, rds0: 400, lambda: 0.01, desc: 'Audio Preamp N-JFET (Vp=-0.8V, Idss=0.6mA)' },
    'BF245A': { name: 'BF245A', channel: 'n', vp: -1.5, idss: 0.004, rds0: 150, lambda: 0.01, desc: 'Audio/RF N-JFET (Vp=-1.5V, Idss=4mA)' },
    '2N5460': { name: '2N5460', channel: 'p', vp: 2.5,  idss: 0.0025, rds0: 250, lambda: 0.01, desc: 'General Audio P-JFET (Vp=+2.5V, Idss=2.5mA)' },
    '2N3820': { name: '2N3820', channel: 'p', vp: 3.5,  idss: 0.008,  rds0: 120, lambda: 0.01, desc: 'Switching P-JFET (Vp=+3.5V, Idss=8mA)' },
    'J174':   { name: 'J174',   channel: 'p', vp: 3.0,  idss: 0.030,  rds0: 30,  lambda: 0.01, desc: 'Low-Noise P-JFET (Vp=+3V, Idss=30mA)' },
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

    _getDeviceKind(type) {
      if (type === 'n_mosfet' || type === 'p_mosfet' || type === 'n_channel_mosfet' || type === 'p_channel_mosfet') return 'mosfet';
      if (type === 'n_jfet' || type === 'p_jfet' || type === 'n_channel_jfet' || type === 'p_channel_jfet') return 'jfet';
      return 'bjt';
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
          <div style="color:#cbd5e1;"><span id="tc-lbl-vin">V<sub>be</sub></span>: <b id="tc-val-vbe" style="color:#38bdf8;">0.00 V</b></div>
          <div style="color:#cbd5e1;"><span id="tc-lbl-iin">I<sub>b</sub></span>: <b id="tc-val-ib" style="color:#38bdf8;">0.00 µA</b></div>
          <div style="color:#cbd5e1;"><span id="tc-lbl-vout">V<sub>ce</sub></span>: <b id="tc-val-vce" style="color:#22c55e;">0.00 V</b></div>
          <div style="color:#cbd5e1;"><span id="tc-lbl-iout">I<sub>c</sub></span>: <b id="tc-val-ic" style="color:#22c55e;">0.00 mA</b></div>
          <div style="color:#cbd5e1;"><span id="tc-lbl-gain">β<sub>eff</sub></span>: <b id="tc-val-beta" style="color:#f59e0b;">100</b></div>
          <div style="color:#cbd5e1;">P<sub>D</sub>: <b id="tc-val-power" style="color:#e2e8f0;">0.0 mW</b></div>
        </div>

        <div class="modal-body" style="padding:14px 18px;display:flex;flex-direction:column;gap:12px;">
          <!-- Tabs Navigation -->
          <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
            <button type="button" class="tc-tab active" data-tab="output" id="tc-tab-output" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#f8fafc;font-size:13px;font-weight:600;cursor:pointer;">📊 Output Curves</button>
            <button type="button" class="tc-tab" data-tab="input" id="tc-tab-input" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">📉 Input Characteristics</button>
            <button type="button" class="tc-tab" data-tab="transfer" id="tc-tab-transfer" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">📈 Transfer Characteristics</button>
            <button type="button" class="tc-tab" data-tab="theory" id="tc-tab-theory" style="background:none;border:none;padding:6px 14px;border-radius:6px;color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">📖 Theory & Lab Guide</button>
          </div>

          <!-- Main Layout: Canvas + Parameter Panel -->
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <!-- Canvas Graph -->
            <div style="flex:1;position:relative;background:#0b1120;border:1px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden;min-height:380px;">
              <canvas id="tc-canvas" width="660" height="380" style="width:100%;height:380px;display:block;"></canvas>
              <!-- Educational Overlay Info -->
              <div id="tc-theory-pane" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:#0b1120;overflow-y:auto;padding:18px;color:#cbd5e1;font-size:13px;line-height:1.6;">
                <div id="tc-theory-content"></div>
              </div>
            </div>

            <!-- Parameters Sidebar -->
            <div style="width:230px;background:#131c2e;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px;font-size:12px;">
              <span id="tc-sidebar-heading" style="font-weight:700;color:#f8fafc;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px;">Model & Tuning</span>

              <div>
                <label id="tc-lbl-model" style="color:#94a3b8;display:block;margin-bottom:4px;">Preset Model</label>
                <select id="tc-ctrl-model" class="prop-input" style="width:100%;padding:5px 8px;font-size:12px;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:4px;">
                </select>
              </div>

              <div id="tc-ctrl-group-1">
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span id="tc-lbl-slider-1">Gain β (hFE)</span>
                  <b id="tc-txt-slider-1" style="color:#f8fafc;">160</b>
                </div>
                <input type="range" id="tc-slider-1" min="10" max="600" step="5" value="160" style="width:100%;">
              </div>

              <div id="tc-ctrl-group-2">
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span id="tc-lbl-slider-2">Vbe(on) (V)</span>
                  <b id="tc-txt-slider-2" style="color:#f8fafc;">0.65 V</b>
                </div>
                <input type="range" id="tc-slider-2" min="0.4" max="1.0" step="0.01" value="0.65" style="width:100%;">
              </div>

              <div id="tc-ctrl-group-3">
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span id="tc-lbl-slider-3">Vce(sat) (V)</span>
                  <b id="tc-txt-slider-3" style="color:#f8fafc;">0.20 V</b>
                </div>
                <input type="range" id="tc-slider-3" min="0.05" max="0.6" step="0.01" value="0.20" style="width:100%;">
              </div>

              <div id="tc-ctrl-group-4">
                <div style="display:flex;justify-content:space-between;color:#94a3b8;margin-bottom:2px;">
                  <span id="tc-lbl-slider-4">Early Voltage VA</span>
                  <b id="tc-txt-slider-4" style="color:#f8fafc;">100 V</b>
                </div>
                <input type="range" id="tc-slider-4" min="30" max="300" step="5" value="100" style="width:100%;">
              </div>

              <div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#cbd5e1;">
                  <input type="checkbox" id="tc-chk-loadline" checked>
                  <span>Show DC Load Line</span>
                </label>
              </div>

              <button type="button" id="tc-btn-apply" class="hdr-btn hdr-btn-run" style="margin-top:6px;width:100%;justify-content:center;font-size:12px;padding:6px 0;">
                Update Parameters
              </button>
            </div>
          </div>
        </div>
      `;

      if (overlay) overlay.appendChild(container);
      else document.body.appendChild(container);
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
      const hookSlider = (sliderId, txtId, paramKey, unitFn) => {
        const slider = container.querySelector('#' + sliderId);
        const txt = container.querySelector('#' + txtId);
        slider?.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (txt) txt.textContent = unitFn(val);
          if (this.targetInst) {
            this.targetInst.props = this.targetInst.props || {};
            this.targetInst.props[this._activeParamKeys[paramKey]] = val;
            this.targetInst.props.model = 'custom';
            const mSel = container.querySelector('#tc-ctrl-model');
            if (mSel) mSel.value = 'custom';
          }
          this._recalculateCircuit();
        });
      };
      this._activeParamKeys = ['beta', 'vbe_on', 'vce_sat', 'early_voltage'];
      hookSlider('tc-slider-1', 'tc-txt-slider-1', 0, v => `${v}`);
      hookSlider('tc-slider-2', 'tc-txt-slider-2', 1, v => `${v.toFixed(2)} V`);
      hookSlider('tc-slider-3', 'tc-txt-slider-3', 2, v => `${v.toFixed(2)} V`);
      hookSlider('tc-slider-4', 'tc-txt-slider-4', 3, v => `${v.toFixed(0)} V`);

      container.querySelector('#tc-ctrl-model')?.addEventListener('change', (e) => {
        const m = e.target.value;
        if (m === 'custom' || !this.targetInst) return;
        const kind = this._getDeviceKind(this.targetInst.type);
        let p = null;
        if (kind === 'mosfet') p = (window.MOSFET_MODELS || MOSFET_MODELS)[m];
        else if (kind === 'jfet') p = (window.JFET_MODELS || JFET_MODELS)[m];
        else p = (window.BJT_MODELS || BJT_MODELS)[m];

        if (p) {
          this.targetInst.props = this.targetInst.props || {};
          this.targetInst.props.model = m;
          Object.assign(this.targetInst.props, p);
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
      const type = this.targetInst.type;
      const kind = this._getDeviceKind(type);
      const isN = (type.startsWith('n_') || type.startsWith('npn'));

      const mSel = this.modalEl.querySelector('#tc-ctrl-model');
      mSel.innerHTML = '';

      if (kind === 'mosfet') {
        const models = window.MOSFET_MODELS || MOSFET_MODELS;
        const defaultModel = isN ? '2N7000' : 'IRF9540N';
        const curModel = props.model || defaultModel;
        for (const [key, item] of Object.entries(models)) {
          if ((isN && item.channel === 'n') || (!isN && item.channel === 'p')) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${key} (${item.desc || ''})`;
            mSel.appendChild(opt);
          }
        }
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Custom Parameters';
        mSel.appendChild(customOpt);
        mSel.value = curModel;

        const preset = models[curModel] || {};
        const vth = Number(props.vth ?? preset.vth ?? (isN ? 2.1 : -3.0));
        const rdsOn = Number(props.rds_on ?? preset.rds_on ?? 1.2);
        const kn = Number(props.kn ?? preset.kn ?? 0.1);
        const lambda = Number(props.lambda ?? preset.lambda ?? 0.01);

        this._activeParamKeys = ['vth', 'rds_on', 'kn', 'lambda'];
        this._setControl(1, 'Threshold Vth', vth, isN ? 0.5 : -10, isN ? 10 : -0.5, 0.1, `${vth.toFixed(1)} V`);
        this._setControl(2, 'On-Resistance Rds(on)', rdsOn, 0.01, 20, 0.01, `${rdsOn.toFixed(3)} Ω`);
        this._setControl(3, 'Gain Factor Kn', kn, 0.01, 20, 0.05, `${kn.toFixed(2)} A/V²`);
        this._setControl(4, 'Channel Mod λ', lambda, 0, 0.05, 0.002, `${lambda.toFixed(3)}`);
      } else if (kind === 'jfet') {
        const models = window.JFET_MODELS || JFET_MODELS;
        const defaultModel = isN ? '2N5457' : '2N5460';
        const curModel = props.model || defaultModel;
        for (const [key, item] of Object.entries(models)) {
          if ((isN && item.channel === 'n') || (!isN && item.channel === 'p')) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${key} (${item.desc || ''})`;
            mSel.appendChild(opt);
          }
        }
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Custom Parameters';
        mSel.appendChild(customOpt);
        mSel.value = curModel;

        const preset = models[curModel] || {};
        const vp = Number(props.vp ?? preset.vp ?? (isN ? -3.0 : 2.5));
        const idss = Number(props.idss ?? preset.idss ?? (isN ? 0.003 : 0.0025));
        const rds0 = Number(props.rds0 ?? preset.rds0 ?? (isN ? 200 : 250));
        const lambda = Number(props.lambda ?? preset.lambda ?? 0.01);

        this._activeParamKeys = ['vp', 'idss', 'rds0', 'lambda'];
        this._setControl(1, 'Pinch-off Vp', vp, isN ? -6.0 : 0.5, isN ? -0.5 : 6.0, 0.1, `${vp.toFixed(1)} V`);
        this._setControl(2, 'Zero-Bias Idss', idss * 1000, 0.1, 50, 0.1, `${(idss * 1000).toFixed(1)} mA`);
        this._setControl(3, 'Zero-Bias Rds0', rds0, 10, 1000, 10, `${rds0.toFixed(0)} Ω`);
        this._setControl(4, 'Channel Mod λ', lambda, 0, 0.05, 0.002, `${lambda.toFixed(3)}`);
      } else {
        // BJT
        const models = window.BJT_MODELS || BJT_MODELS;
        const defaultModel = isN ? '2N2222' : '2N3906';
        const curModel = props.model || defaultModel;
        for (const [key, item] of Object.entries(models)) {
          if ((isN && item.type === 'npn') || (!isN && item.type === 'pnp')) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${key} (${item.desc || ''})`;
            mSel.appendChild(opt);
          }
        }
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Custom Parameters';
        mSel.appendChild(customOpt);
        mSel.value = curModel;

        const preset = models[curModel] || {};
        const beta = Number(props.beta ?? preset.beta ?? 100);
        const vbeOn = Number(props.vbe_on ?? preset.vbe_on ?? 0.65);
        const vceSat = Number(props.vce_sat ?? preset.vce_sat ?? 0.20);
        const va = Number(props.early_voltage ?? preset.early_voltage ?? 100);

        this._activeParamKeys = ['beta', 'vbe_on', 'vce_sat', 'early_voltage'];
        this._setControl(1, 'Gain β (hFE)', beta, 10, 600, 5, `${beta}`);
        this._setControl(2, 'Vbe(on)', vbeOn, 0.4, 1.0, 0.01, `${vbeOn.toFixed(2)} V`);
        this._setControl(3, 'Vce(sat)', vceSat, 0.05, 0.6, 0.01, `${vceSat.toFixed(2)} V`);
        this._setControl(4, 'Early Voltage VA', va, 30, 300, 5, `${va.toFixed(0)} V`);
      }
    }

    _setControl(num, label, val, min, max, step, textVal) {
      const lbl = this.modalEl.querySelector(`#tc-lbl-slider-${num}`);
      const txt = this.modalEl.querySelector(`#tc-txt-slider-${num}`);
      const sld = this.modalEl.querySelector(`#tc-slider-${num}`);
      if (lbl) lbl.textContent = label;
      if (txt) txt.textContent = textVal;
      if (sld) {
        sld.min = min;
        sld.max = max;
        sld.step = step;
        sld.value = val;
      }
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

      const type = inst.type;
      const kind = this._getDeviceKind(type);
      const isN = (type.startsWith('n_') || type.startsWith('npn'));

      const title = this.modalEl.querySelector('#tc-title');
      const subtitle = this.modalEl.querySelector('#tc-subtitle');
      const lblVin = this.modalEl.querySelector('#tc-lbl-vin');
      const lblIin = this.modalEl.querySelector('#tc-lbl-iin');
      const lblVout = this.modalEl.querySelector('#tc-lbl-vout');
      const lblIout = this.modalEl.querySelector('#tc-lbl-iout');
      const lblGain = this.modalEl.querySelector('#tc-lbl-gain');

      const tabOut = this.modalEl.querySelector('#tc-tab-output');
      const tabIn = this.modalEl.querySelector('#tc-tab-input');
      const tabTr = this.modalEl.querySelector('#tc-tab-transfer');

      if (kind === 'mosfet') {
        const defaultModel = isN ? '2N7000' : 'IRF9540N';
        const modelName = inst.props?.model || defaultModel;
        if (title) title.textContent = `${modelName} · ${isN ? 'N-Channel' : 'P-Channel'} MOSFET Characteristics`;
        if (subtitle) subtitle.textContent = `Enhancement-Mode Output (Id vs Vds) & Transfer (Id vs Vgs) Curves`;
        if (lblVin) lblVin.innerHTML = `V<sub>gs</sub>`;
        if (lblIin) lblIin.innerHTML = `I<sub>g</sub>`;
        if (lblVout) lblVout.innerHTML = `V<sub>ds</sub>`;
        if (lblIout) lblIout.innerHTML = `I<sub>d</sub>`;
        if (lblGain) lblGain.innerHTML = `R<sub>ds</sub>`;
        if (tabOut) tabOut.textContent = `📊 Output (Id vs Vds)`;
        if (tabIn) tabIn.textContent = `📉 Gate Insulation`;
        if (tabTr) tabTr.textContent = `📈 Transfer (Id vs Vgs)`;
      } else if (kind === 'jfet') {
        const defaultModel = isN ? '2N5457' : '2N5460';
        const modelName = inst.props?.model || defaultModel;
        if (title) title.textContent = `${modelName} · ${isN ? 'N-Channel' : 'P-Channel'} JFET Characteristics`;
        if (subtitle) subtitle.textContent = `Depletion-Mode Output (Id vs Vds) & Shockley Curve`;
        if (lblVin) lblVin.innerHTML = `V<sub>gs</sub>`;
        if (lblIin) lblIin.innerHTML = `I<sub>g</sub>`;
        if (lblVout) lblVout.innerHTML = `V<sub>ds</sub>`;
        if (lblIout) lblIout.innerHTML = `I<sub>d</sub>`;
        if (lblGain) lblGain.innerHTML = `R<sub>ds</sub>`;
        if (tabOut) tabOut.textContent = `📊 Output (Id vs Vds)`;
        if (tabIn) tabIn.textContent = `📉 Gate Junction`;
        if (tabTr) tabTr.textContent = `📈 Shockley Curve`;
      } else {
        const defaultModel = isN ? '2N2222' : '2N3906';
        const modelName = inst.props?.model || defaultModel;
        if (title) title.textContent = `${modelName} · ${isN ? 'NPN' : 'PNP'} Transistor Characteristics`;
        if (subtitle) subtitle.textContent = `Common Emitter Multi-Curve Analysis & Dynamic Q-Point`;
        if (lblVin) lblVin.innerHTML = `V<sub>be</sub>`;
        if (lblIin) lblIin.innerHTML = `I<sub>b</sub>`;
        if (lblVout) lblVout.innerHTML = `V<sub>ce</sub>`;
        if (lblIout) lblIout.innerHTML = `I<sub>c</sub>`;
        if (lblGain) lblGain.innerHTML = `β<sub>eff</sub>`;
        if (tabOut) tabOut.textContent = `📊 Output (Ic vs Vce)`;
        if (tabIn) tabIn.textContent = `📉 Input (Ib vs Vbe)`;
        if (tabTr) tabTr.textContent = `📈 Transfer (Ic vs Ib)`;
      }

      this._syncControlValues();
      this._updateTheoryPane(kind);

      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.classList.remove('hidden');
      this.modalEl.classList.add('active');

      const loop = () => {
        if (!this.isOpen) return;
        this.render();
        this.animId = requestAnimationFrame(loop);
      };
      if (this.animId) cancelAnimationFrame(this.animId);
      this.animId = requestAnimationFrame(loop);
    }

    _updateTheoryPane(kind) {
      const pane = this.modalEl.querySelector('#tc-theory-content');
      if (!pane) return;
      if (kind === 'mosfet') {
        pane.innerHTML = `
          <h3 style="color:#f8fafc;margin-top:0;">MOSFET Characteristics & Operating Regions</h3>
          <p>A Metal-Oxide-Semiconductor Field-Effect Transistor (MOSFET) is a voltage-controlled switch and amplifier with an insulated dielectric gate:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;">
            <div style="background:#1e293b;padding:12px;border-radius:6px;">
              <b style="color:#38bdf8;">1. Operating Regions:</b>
              <ul style="padding-left:18px;margin:6px 0;">
                <li><b>Cutoff:</b> V<sub>GS</sub> < V<sub>th</sub>. The conductive channel is not formed; I<sub>D</sub> ≈ 0.</li>
                <li><b>Ohmic / Linear:</b> V<sub>GS</sub> ≥ V<sub>th</sub> and V<sub>DS</sub> < (V<sub>GS</sub> - V<sub>th</sub>). Transistor acts as a voltage-controlled resistor with on-resistance R<sub>DS(on)</sub>.</li>
                <li><b>Saturation:</b> V<sub>GS</sub> ≥ V<sub>th</sub> and V<sub>DS</sub> ≥ (V<sub>GS</sub> - V<sub>th</sub>). Channel pinches off at drain; current saturates at I<sub>D</sub> = K<sub>n</sub>·(V<sub>GS</sub> - V<sub>th</sub>)².</li>
              </ul>
            </div>
            <div style="background:#1e293b;padding:12px;border-radius:6px;">
              <b style="color:#22c55e;">2. Body Diode & Switching:</b>
              <ul style="padding-left:18px;margin:6px 0;">
                <li>Integrated substrate P-N body diode protects against inductive flyback voltages.</li>
                <li>Extremely fast nanosecond switching speeds with negligible gate drive power.</li>
                <li>Gate input impedance R<sub>in</sub> > 10<sup>12</sup> Ω.</li>
              </ul>
            </div>
          </div>`;
      } else if (kind === 'jfet') {
        pane.innerHTML = `
          <h3 style="color:#f8fafc;margin-top:0;">JFET Characteristics (Shockley Depletion Mode)</h3>
          <p>A Junction Field-Effect Transistor (JFET) is a normally-ON depletion mode device controlled by reverse-biasing the gate-channel P-N junction:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;">
            <div style="background:#1e293b;padding:12px;border-radius:6px;">
              <b style="color:#38bdf8;">1. Operating Regions:</b>
              <ul style="padding-left:18px;margin:6px 0;">
                <li><b>Ohmic Region:</b> V<sub>DS</sub> < (V<sub>GS</sub> - V<sub>p</sub>). Channel behaves as a voltage-variable resistor.</li>
                <li><b>Pinch-Off / Saturation:</b> V<sub>DS</sub> ≥ (V<sub>GS</sub> - V<sub>p</sub>). Depletion layers pinch channel; current saturates at Shockley equation: I<sub>D</sub> = I<sub>DSS</sub>·(1 - V<sub>GS</sub>/V<sub>p</sub>)².</li>
                <li><b>Cutoff:</b> Gate reverse bias exceeds pinch-off voltage V<sub>p</sub> (e.g. V<sub>GS</sub> ≤ -3V for N-JFET); I<sub>D</sub> drops to 0.</li>
              </ul>
            </div>
            <div style="background:#1e293b;padding:12px;border-radius:6px;">
              <b style="color:#22c55e;">2. High Input Impedance:</b>
              <ul style="padding-left:18px;margin:6px 0;">
                <li>Reverse-biased gate draws negligible leakage (< 1 nA).</li>
                <li>Ideal for low-noise high-impedance audio preamplifiers and analog switches.</li>
              </ul>
            </div>
          </div>`;
      } else {
        pane.innerHTML = `
          <h3 style="color:#f8fafc;margin-top:0;">Transistor Characteristics (Common Emitter)</h3>
          <p>A Bipolar Junction Transistor (BJT) is a current-controlled active device. In a common-emitter circuit, its operation is defined by three fundamental characteristic plots:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;">
            <div style="background:#1e293b;padding:12px;border-radius:6px;">
              <b style="color:#38bdf8;">1. Output Characteristics (I<sub>C</sub> vs V<sub>CE</sub>):</b>
              <ul style="padding-left:18px;margin:6px 0;">
                <li><b>Cutoff:</b> I<sub>B</sub> ≤ 0. I<sub>C</sub> ≈ 0. Device acts as open switch.</li>
                <li><b>Active:</b> V<sub>CE</sub> ≥ V<sub>CE(sat)</sub>. I<sub>C</sub> = β · I<sub>B</sub> · (1 + V<sub>CE</sub> / V<sub>A</sub>).</li>
                <li><b>Saturation:</b> V<sub>CE</sub> < V<sub>CE(sat)</sub>. I<sub>C</sub> drops sharply to 0.</li>
              </ul>
            </div>
            <div style="background:#1e293b;padding:12px;border-radius:6px;">
              <b style="color:#22c55e;">2. Input Characteristics (I<sub>B</sub> vs V<sub>BE</sub>):</b>
              <ul style="padding-left:18px;margin:6px 0;">
                <li>Forward-biased P-N diode curve.</li>
                <li>Negligible current below cut-in knee (V<sub>BE(on)</sub> ≈ 0.65 V).</li>
              </ul>
            </div>
          </div>`;
      }
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
      const type = this.targetInst.type;
      const kind = this._getDeviceKind(type);
      const region = rs.region || (rs.conducting ? 'active' : 'cutoff');

      const badge = this.modalEl.querySelector('#tc-badge-region');
      if (badge) {
        badge.textContent = region.toUpperCase();
        if (region === 'saturation' || region === 'ohmic' || region === 'linear') {
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

      const setTxt = (id, str) => {
        const el = this.modalEl.querySelector('#' + id);
        if (el) el.textContent = str;
      };

      if (kind === 'mosfet' || kind === 'jfet') {
        const vgs = rs.vgs || 0;
        const vds = rs.vds || 0;
        const ig = rs.ig || 0;
        const id = rs.id || 0;
        const rds = rs.rds || 1e7;
        const power = rs.power || Math.abs(vds * id);

        setTxt('tc-val-vbe', vgs.toFixed(3) + ' V');
        setTxt('tc-val-ib', (Math.abs(ig) >= 0.001 ? (ig * 1e3).toFixed(2) + ' mA' : (ig * 1e6).toFixed(1) + ' µA'));
        setTxt('tc-val-vce', vds.toFixed(3) + ' V');
        setTxt('tc-val-ic', (id >= 1 ? id.toFixed(2) + ' A' : (id * 1e3).toFixed(2) + ' mA'));
        setTxt('tc-val-beta', rds >= 1e6 ? '>1 MΩ' : (rds >= 1e3 ? (rds / 1e3).toFixed(1) + ' kΩ' : rds.toFixed(2) + ' Ω'));
        setTxt('tc-val-power', (power * 1000).toFixed(1) + ' mW');
      } else {
        // BJT
        const vbe = rs.vbe || 0;
        const vce = rs.vce || 0;
        const ib = rs.ib || 0;
        const ic = rs.ic || 0;
        const power = rs.power || (vce * ic + vbe * ib);
        const betaEff = (ib > 1e-7) ? (ic / ib).toFixed(1) : (this.targetInst.props?.beta || 100);

        setTxt('tc-val-vbe', vbe.toFixed(3) + ' V');
        setTxt('tc-val-ib', (ib >= 0.001 ? (ib * 1e3).toFixed(2) + ' mA' : (ib * 1e6).toFixed(1) + ' µA'));
        setTxt('tc-val-vce', vce.toFixed(3) + ' V');
        setTxt('tc-val-ic', (ic >= 1 ? ic.toFixed(2) + ' A' : (ic * 1e3).toFixed(2) + ' mA'));
        setTxt('tc-val-beta', betaEff);
        setTxt('tc-val-power', (power * 1000).toFixed(1) + ' mW');
      }
    }

    _drawAxes(ctx, ox, oy, pw, ph, xLabel, yLabel, xMax, yMax, xTicks = 5, yTicks = 5) {
      // Grid
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
        ctx.fillText(yVal.toFixed(yMax < 1 ? 2 : (yMax < 10 ? 1 : 0)), ox - 8, y + 3);
      }

      ctx.save();
      ctx.translate(ox - 36, oy - ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    _drawOutputCharacteristics(ctx, W, H) {
      const kind = this._getDeviceKind(this.targetInst.type);
      if (kind === 'mosfet') return this._drawMOSFETOutput(ctx, W, H);
      if (kind === 'jfet') return this._drawJFETOutput(ctx, W, H);
      return this._drawBJTOutput(ctx, W, H);
    }

    /* ═══════════════════════════════════════════════════════
       1a. BJT Output Characteristics: Ic vs Vce
       ═══════════════════════════════════════════════════════ */
    _drawBJTOutput(ctx, W, H) {
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

      const vceMax = 12.0;
      const activeIb = rs.ib || 0;

      let ibStep = 20e-6;
      if (activeIb > 100e-6) ibStep = Math.ceil(activeIb / 4 / 10e-6) * 10e-6;
      else if (activeIb > 0 && activeIb < 10e-6) ibStep = 5e-6;

      const numCurves = 5;
      const icMaxmA = ((numCurves * ibStep * beta * (1 + vceMax / va)) * 1000) * 1.15;
      const icMaxA = icMaxmA / 1000;

      // Saturation Zone
      const satW = (vceSat / vceMax) * pw;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fillRect(ox, oy - ph, satW, ph);

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

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('ACTIVE REGION (Ic = β · Ib)', ox + satW + 10, oy - ph + 15);

      const xLbl = isNPN ? 'Collector-Emitter Voltage V_CE (V)' : 'Emitter-Collector Voltage V_EC (V)';
      this._drawAxes(ctx, ox, oy, pw, ph, xLbl, 'Collector Current I_C (mA)', vceMax, icMaxmA, 6, 5);

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

        const endVce = vceMax;
        const endIc = beta * curIb * (1 + endVce / va) * (1 - Math.exp(-endVce / vk));
        const endY = oy - (endIc / icMaxA) * ph;
        ctx.font = '9px monospace';
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'left';
        ctx.fillText(`Ib=${(curIb * 1e6).toFixed(0)}µA`, ox + pw + 3, endY + 3);
      }

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + pw, oy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText('Ib = 0 (Cutoff)', ox + pw + 3, oy + 3);

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

      this._drawDCLoadLine(ctx, inst, ox, oy, pw, ph, vceMax, icMaxA, icMaxmA, 'collector');

      const liveVce = Math.min(vceMax, Math.max(0, rs.vce || 0));
      const liveIcA = Math.min(icMaxA, Math.max(0, rs.ic || 0));
      const qx = ox + (liveVce / vceMax) * pw;
      const qy = oy - (liveIcA / icMaxA) * ph;
      this._drawQPointMarker(ctx, qx, qy, liveVce, liveIcA, rs.region || 'cutoff', W);
    }

    /* ═══════════════════════════════════════════════════════
       1b. MOSFET Output Characteristics: Id vs Vds
       ═══════════════════════════════════════════════════════ */
    _drawMOSFETOutput(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};
      const isN = (inst.type === 'n_mosfet' || inst.type === 'n_channel_mosfet');

      const vth = Number(props.vth ?? (isN ? 2.1 : -3.0));
      const kn = Number(props.kn ?? 0.1);
      const lambda = Number(props.lambda ?? 0.01);

      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      const vdsMax = 12.0;
      const absVth = Math.abs(vth);

      const vgsSteps = [absVth + 0.5, absVth + 1.0, absVth + 1.5, absVth + 2.0, absVth + 2.5];
      const maxVov = 2.5;
      const idMaxSatA = kn * (maxVov * maxVov) * (1 + lambda * vdsMax) * 1.15;
      const idMaxA = Math.max(0.005, idMaxSatA);
      const idMaxmA = idMaxA * 1000;

      // Shaded Ohmic Region
      ctx.fillStyle = 'rgba(34, 197, 94, 0.06)';
      ctx.fillRect(ox, oy - ph, pw * 0.25, ph);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'left';
      ctx.fillText('OHMIC / LINEAR REGION', ox + 4, oy - ph + 15);
      ctx.fillText('Vds < Vgs - Vth', ox + 4, oy - ph + 27);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('SATURATION / PINCH-OFF (Id = Kn·(Vgs-Vth)²)', ox + pw * 0.28, oy - ph + 15);

      const xLbl = isN ? 'Drain-Source Voltage V_DS (V)' : 'Source-Drain Voltage V_SD (V)';
      const yLbl = idMaxA >= 1 ? 'Drain Current I_D (A)' : 'Drain Current I_D (mA)';
      const yMaxVal = idMaxA >= 1 ? idMaxA : idMaxmA;
      this._drawAxes(ctx, ox, oy, pw, ph, xLbl, yLbl, vdsMax, yMaxVal, 6, 5);

      for (const curVgs of vgsSteps) {
        const vov = curVgs - absVth;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        for (let px = 0; px <= pw; px += 2) {
          const vds = (px / pw) * vdsMax;
          let id = 0;
          if (vds < vov) {
            id = kn * (2 * vov * vds - vds * vds) * (1 + lambda * vds);
          } else {
            id = kn * (vov * vov) * (1 + lambda * vds);
          }
          const yVal = idMaxA >= 1 ? id : id * 1000;
          const py = oy - (yVal / yMaxVal) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();

        const vdsEnd = vdsMax;
        const idEnd = kn * (vov * vov) * (1 + lambda * vdsEnd);
        const yValEnd = idMaxA >= 1 ? idEnd : idEnd * 1000;
        const endY = oy - (yValEnd / yMaxVal) * ph;
        ctx.font = '9px monospace';
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'left';
        ctx.fillText(`Vgs=${curVgs.toFixed(1)}V`, ox + pw + 3, endY + 3);
      }

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + pw, oy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText('Vgs ≤ Vth (Cutoff)', ox + pw + 3, oy + 3);

      const liveVgs = Math.abs(rs.vgs || 0);
      if (liveVgs > absVth) {
        const vov = liveVgs - absVth;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= pw; px += 2) {
          const vds = (px / pw) * vdsMax;
          let id = 0;
          if (vds < vov) {
            id = kn * (2 * vov * vds - vds * vds) * (1 + lambda * vds);
          } else {
            id = kn * (vov * vov) * (1 + lambda * vds);
          }
          const yVal = idMaxA >= 1 ? id : id * 1000;
          const py = oy - (yVal / yMaxVal) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();
      }

      this._drawDCLoadLine(ctx, inst, ox, oy, pw, ph, vdsMax, idMaxA, yMaxVal, 'drain');

      const liveVds = Math.min(vdsMax, Math.max(0, Math.abs(rs.vds || 0)));
      const liveIdA = Math.max(0, rs.id || 0);
      const liveIdVal = idMaxA >= 1 ? liveIdA : liveIdA * 1000;
      const qx = ox + (liveVds / vdsMax) * pw;
      const qy = oy - (Math.min(yMaxVal, liveIdVal) / yMaxVal) * ph;
      this._drawQPointMarker(ctx, qx, qy, liveVds, liveIdA, rs.region || 'cutoff', W);
    }

    /* ═══════════════════════════════════════════════════════
       1c. JFET Output Characteristics: Id vs Vds
       ═══════════════════════════════════════════════════════ */
    _drawJFETOutput(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};
      const isN = (inst.type === 'n_jfet' || inst.type === 'n_channel_jfet');

      const vp = Number(props.vp ?? (isN ? -3.0 : 2.5));
      const idss = Number(props.idss ?? (isN ? 0.003 : 0.0025));
      const lambda = Number(props.lambda ?? 0.01);

      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      const vdsMax = 12.0;
      const absVp = Math.abs(vp);

      const vgsLevels = [0, 0.25 * vp, 0.5 * vp, 0.75 * vp];
      const idMaxSatA = idss * (1 + lambda * vdsMax) * 1.2;
      const idMaxA = Math.max(0.001, idMaxSatA);
      const idMaxmA = idMaxA * 1000;

      // Shaded Ohmic Region
      ctx.fillStyle = 'rgba(34, 197, 94, 0.06)';
      ctx.fillRect(ox, oy - ph, (absVp / vdsMax) * pw, ph);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'left';
      ctx.fillText('OHMIC REGION', ox + 4, oy - ph + 15);
      ctx.fillText(`Vds < |Vp| (${absVp.toFixed(1)}V)`, ox + 4, oy - ph + 27);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('PINCH-OFF / SATURATION (Id = Idss·(1 - Vgs/Vp)²)', ox + (absVp / vdsMax) * pw + 10, oy - ph + 15);

      const xLbl = isN ? 'Drain-Source Voltage V_DS (V)' : 'Source-Drain Voltage V_SD (V)';
      this._drawAxes(ctx, ox, oy, pw, ph, xLbl, 'Drain Current I_D (mA)', vdsMax, idMaxmA, 6, 5);

      for (const curVgs of vgsLevels) {
        const u = Math.max(0, 1 - curVgs / vp);
        const vdsSat = absVp * u;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        for (let px = 0; px <= pw; px += 2) {
          const vds = (px / pw) * vdsMax;
          let id = 0;
          if (vds < vdsSat) {
            id = (2 * idss / (vp * vp)) * ((curVgs - vp) * vds - 0.5 * vds * vds);
          } else {
            id = idss * (u * u) * (1 + lambda * vds);
          }
          id = Math.max(0, id);
          const py = oy - ((id * 1000) / idMaxmA) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();

        const endVds = vdsMax;
        const endId = idss * (u * u) * (1 + lambda * endVds);
        const endY = oy - ((endId * 1000) / idMaxmA) * ph;
        ctx.font = '9px monospace';
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'left';
        ctx.fillText(`Vgs=${curVgs.toFixed(2)}V`, ox + pw + 3, endY + 3);
      }

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + pw, oy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Vgs = Vp (${vp}V, Cutoff)`, ox + pw + 3, oy + 3);

      const liveVgs = rs.vgs ?? 0;
      const isLiveConducting = isN ? (liveVgs > vp) : (liveVgs < vp);
      if (isLiveConducting) {
        const u = Math.max(0, 1 - liveVgs / vp);
        const vdsSat = absVp * u;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= pw; px += 2) {
          const vds = (px / pw) * vdsMax;
          let id = 0;
          if (vds < vdsSat) {
            id = (2 * idss / (vp * vp)) * ((liveVgs - vp) * vds - 0.5 * vds * vds);
          } else {
            id = idss * (u * u) * (1 + lambda * vds);
          }
          id = Math.max(0, id);
          const py = oy - ((id * 1000) / idMaxmA) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();
      }

      this._drawDCLoadLine(ctx, inst, ox, oy, pw, ph, vdsMax, idMaxA, idMaxmA, 'drain');

      const liveVds = Math.min(vdsMax, Math.max(0, Math.abs(rs.vds || 0)));
      const liveIdA = Math.max(0, rs.id || 0);
      const qx = ox + (liveVds / vdsMax) * pw;
      const qy = oy - ((liveIdA * 1000) / idMaxmA) * ph;
      this._drawQPointMarker(ctx, qx, qy, liveVds, liveIdA, rs.region || 'cutoff', W);
    }

    _drawDCLoadLine(ctx, inst, ox, oy, pw, ph, vMax, iMaxA, yMaxVal, pinName) {
      const showLoadLine = this.modalEl.querySelector('#tc-chk-loadline')?.checked;
      const CC = window.CircuitCanvas || (window.App && window.App.canvas);
      if (showLoadLine && CC && CC.engine) {
        const engine = CC.engine;
        const cNet = engine.getNetForPin(inst.id, pinName);
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
            const icSatLoadA = (vcc / rLoad);
            const xIntercept = Math.min(vMax, vcc);
            const pxVcc = (xIntercept / vMax) * pw;
            const yInterceptVal = yMaxVal === iMaxA ? icSatLoadA : icSatLoadA * 1000;
            const pyIc = oy - (Math.min(yMaxVal, yInterceptVal) / yMaxVal) * ph;

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
            ctx.fillText(`Load Line (RL=${rLoad}Ω, Vcc=${vcc.toFixed(1)}V)`, ox + pxVcc - 4, oy - 8);
          }
        }
      }
    }

    _drawQPointMarker(ctx, qx, qy, vVal, iValA, region, W) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(qx, qy, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(qx, qy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const qText = `Q: (${vVal.toFixed(2)}V, ${(iValA * 1000).toFixed(2)}mA) [${region.toUpperCase()}]`;
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
       2. Input Characteristics: Ib vs Vbe / Gate Insulation
       ═══════════════════════════════════════════════════════ */
    _drawInputCharacteristics(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};
      const kind = this._getDeviceKind(inst.type);

      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      if (kind === 'mosfet') {
        // Insulated Gate Characteristics: Ig ≈ 0 A
        this._drawAxes(ctx, ox, oy, pw, ph, 'Gate-Source Voltage V_GS (V)', 'Gate Current I_G (pA)', 10, 10, 5, 5);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + pw, oy);
        ctx.stroke();

        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('Insulated SiO₂ Dielectric Gate: I_G ≈ 0 A (R_in > 10¹² Ω)', ox + pw / 2, oy - ph / 2);

        const liveVgs = Math.min(10, Math.max(0, Math.abs(rs.vgs || 0)));
        const qx = ox + (liveVgs / 10) * pw;
        const qy = oy;

        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(qx, qy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`Q: (${liveVgs.toFixed(2)}V, 0.00 pA)`, qx, qy - 10);
        return;
      }

      if (kind === 'jfet') {
        // Gate P-N junction reverse leakage vs forward clamp
        this._drawAxes(ctx, ox, oy, pw, ph, 'Gate-Source Voltage V_GS (V)', 'Gate Current I_G (µA)', 1.0, 100, 5, 5);

        const kneeX = ox + (0.65 / 1.0) * pw;
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
        ctx.fillText('Forward Bias Diode Clamp: 0.65V', kneeX, oy - ph + 15);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= pw; px += 2) {
          const vgs = (px / pw) * 1.0;
          let ig = 0;
          if (vgs > 0.65) ig = (vgs - 0.65) / 25 * 1e3; // uA
          const py = oy - (Math.min(100, ig) / 100) * ph;
          if (px === 0) ctx.moveTo(ox + px, py);
          else ctx.lineTo(ox + px, py);
        }
        ctx.stroke();
        return;
      }

      // BJT Input Characteristics
      const vbeOn = Number(props.vbe_on || 0.65);
      const isNPN = inst.type === 'npn_transistor';
      const vbeMax = 1.0;
      const ibMaxuA = 100.0;
      const ibMaxA = ibMaxuA * 1e-6;

      const xLbl = isNPN ? 'Base-Emitter Voltage V_BE (V)' : 'Emitter-Base Voltage V_EB (V)';
      this._drawAxes(ctx, ox, oy, pw, ph, xLbl, 'Base Current I_B (µA)', vbeMax, ibMaxuA, 5, 5);

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

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const rd = 25;
      for (let px = 0; px <= pw; px += 2) {
        const vbe = (px / pw) * vbeMax;
        let ib = 0;
        if (vbe > vbeOn) {
          ib = (vbe - vbeOn) / (rd * 250);
        }
        const py = oy - (ib / ibMaxA) * ph;
        if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
        else ctx.lineTo(ox + px, Math.max(oy - ph, py));
      }
      ctx.stroke();

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
       3. Transfer Characteristics: Ic vs Ib / Id vs Vgs
       ═══════════════════════════════════════════════════════ */
    _drawTransferCharacteristics(ctx, W, H) {
      const inst = this.targetInst;
      const props = inst.props || {};
      const rs = inst.runtimeState || {};
      const kind = this._getDeviceKind(inst.type);

      const ox = 55;
      const oy = H - 50;
      const pw = W - ox - 65;
      const ph = H - 85;

      if (kind === 'mosfet') {
        // MOSFET Transfer Curve: Id vs Vgs
        const isN = (inst.type === 'n_mosfet' || inst.type === 'n_channel_mosfet');
        const vth = Number(props.vth ?? (isN ? 2.1 : -3.0));
        const absVth = Math.abs(vth);
        const kn = Number(props.kn ?? 0.1);

        const vgsMax = 6.0;
        const idMaxA = kn * Math.pow(vgsMax - absVth, 2) * 1.1;
        const idMaxVal = idMaxA >= 1 ? idMaxA : idMaxA * 1000;
        const yLbl = idMaxA >= 1 ? 'Drain Current I_D (A)' : 'Drain Current I_D (mA)';

        this._drawAxes(ctx, ox, oy, pw, ph, 'Gate-Source Voltage V_GS (V)', yLbl, vgsMax, idMaxVal, 6, 5);

        // Threshold indicator
        const vthX = ox + (absVth / vgsMax) * pw;
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(vthX, oy);
        ctx.lineTo(vthX, oy - ph);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText(`Vth = ${absVth.toFixed(1)}V`, vthX, oy - ph + 15);

        // Quadratic enhancement curve
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= pw; px += 2) {
          const vgs = (px / pw) * vgsMax;
          let id = 0;
          if (vgs > absVth) {
            id = kn * Math.pow(vgs - absVth, 2);
          }
          const yVal = idMaxA >= 1 ? id : id * 1000;
          const py = oy - (yVal / idMaxVal) * ph;
          if (px === 0) ctx.moveTo(ox + px, Math.max(oy - ph, py));
          else ctx.lineTo(ox + px, Math.max(oy - ph, py));
        }
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#22c55e';
        ctx.textAlign = 'right';
        ctx.fillText(`Id = Kn·(Vgs - Vth)²`, ox + pw - 10, oy - ph + 30);

        // Live Q-Point
        const liveVgs = Math.min(vgsMax, Math.max(0, Math.abs(rs.vgs || 0)));
        const liveIdA = Math.max(0, rs.id || 0);
        const liveIdVal = idMaxA >= 1 ? liveIdA : liveIdA * 1000;
        const qx = ox + (liveVgs / vgsMax) * pw;
        const qy = oy - (liveIdVal / idMaxVal) * ph;

        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(qx, qy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(`Q: (${liveVgs.toFixed(2)}V, ${(liveIdA * 1000).toFixed(2)}mA)`, qx + 8, qy - 6);
        return;
      }

      if (kind === 'jfet') {
        // JFET Shockley Curve: Id vs Vgs from Vp to 0V
        const isN = (inst.type === 'n_jfet' || inst.type === 'n_channel_jfet');
        const vp = Number(props.vp ?? (isN ? -3.0 : 2.5));
        const absVp = Math.abs(vp);
        const idss = Number(props.idss ?? (isN ? 0.003 : 0.0025));
        const idssmA = idss * 1000;

        this._drawAxes(ctx, ox, oy, pw, ph, '|V_GS| (V) from 0 to |V_p|', 'Drain Current I_D (mA)', absVp, idssmA * 1.1, 5, 5);

        // Shockley curve
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= pw; px += 2) {
          const vgsMag = (px / pw) * absVp;
          const u = Math.max(0, 1 - vgsMag / absVp);
          const id = idss * u * u;
          const py = oy - ((id * 1000) / (idssmA * 1.1)) * ph;
          if (px === 0) ctx.moveTo(ox + px, py);
          else ctx.lineTo(ox + px, py);
        }
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#22c55e';
        ctx.textAlign = 'right';
        ctx.fillText(`Shockley: Id = Idss·(1 - Vgs/Vp)²`, ox + pw - 10, oy - ph + 30);

        // Live Q-Point
        const liveVgsMag = Math.min(absVp, Math.max(0, Math.abs(rs.vgs || 0)));
        const liveIdA = Math.max(0, rs.id || 0);
        const qx = ox + (liveVgsMag / absVp) * pw;
        const qy = oy - ((liveIdA * 1000) / (idssmA * 1.1)) * ph;

        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(qx, qy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(`Q: (|Vgs|=${liveVgsMag.toFixed(2)}V, ${(liveIdA * 1000).toFixed(2)}mA)`, qx + 8, qy - 6);
        return;
      }

      // BJT Transfer Characteristics: Ic vs Ib
      const beta = Number(props.beta || 160);
      const ibMaxuA = 100.0;
      const icMaxmA = (ibMaxuA * 1e-6 * beta * 1000) * 1.2;

      this._drawAxes(ctx, ox, oy, pw, ph, 'Base Current I_B (µA)', 'Collector Current I_C (mA)', ibMaxuA, icMaxmA, 5, 5);

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

  window.TransistorCurvesModal = new TransistorCurvesModal();
})();
