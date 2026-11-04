'use strict';

/* Read a numeric generator setting, coerced, finite and clamped to its
   declared range. Raw Number(...) conversions let "Infinity" or a hand-typed
   1e999 through, which reaches the waveform math as Infinity and turns the
   sample into NaN — an invalid voltage on the output pin. */
function _fgNum(v, def, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

function _fgBool(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['', '0', 'false', 'off', 'no'].includes(normalized)) return false;
    if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  }
  return Boolean(value);
}

const FG_WAVEFORMS = [
  { id: 'sine',      label: 'Sine',           badge: 'SIN' },
  { id: 'square',    label: 'Square',         badge: 'SQR' },
  { id: 'triangle',  label: 'Triangle',       badge: 'TRI' },
  { id: 'sawtooth',  label: 'Sawtooth (Up)',  badge: 'SAW' },
  { id: 'ramp_down', label: 'Ramp Down',      badge: 'RMP' },
  { id: 'pulse',     label: 'Narrow Pulse',   badge: 'PUL' },
  { id: 'exp_rise',  label: 'Exponential',    badge: 'EXP' },
  { id: 'ecg',       label: 'Cardiac (ECG)',  badge: 'ECG' },
  { id: 'staircase', label: 'Staircase',      badge: 'STR' },
  { id: 'noise',     label: 'Noise',          badge: 'NOI' },
  { id: 'dc',        label: 'DC Level',       badge: 'DC'  },
];

const FG_WAVE_IDS = FG_WAVEFORMS.map(w => w.id);

function _fgSampleRaw(wave, tau, t, freq, duty) {
  let normalized = 0;
  switch (wave) {
    case 'square':
      normalized = tau < duty ? 1.0 : -1.0;
      break;
    case 'triangle':
      normalized = tau < duty
        ? -1.0 + 2.0 * (tau / duty)
        : 1.0 - 2.0 * ((tau - duty) / (1.0 - duty));
      break;
    case 'sawtooth':
      normalized = 2.0 * tau - 1.0;
      break;
    case 'ramp_down':
      normalized = 1.0 - 2.0 * tau;
      break;
    case 'pulse':
      normalized = tau < duty ? 1.0 : -1.0;
      break;
    case 'exp_rise':
      normalized = -1.0 + 2.0 * (1.0 - Math.exp(-4.0 * tau)) / (1.0 - Math.exp(-4.0));
      break;
    case 'ecg': {
      // Analytical P-Q-R-S-T cardiac waveform
      const p  =  0.20 * Math.exp(-Math.pow((tau - 0.20) / 0.045, 2));
      const q  = -0.15 * Math.exp(-Math.pow((tau - 0.35) / 0.020, 2));
      const r  =  1.00 * Math.exp(-Math.pow((tau - 0.40) / 0.025, 2));
      const s  = -0.25 * Math.exp(-Math.pow((tau - 0.45) / 0.020, 2));
      const tw =  0.30 * Math.exp(-Math.pow((tau - 0.65) / 0.080, 2));
      normalized = (p + q + r + s + tw) * 1.6 - 0.3;
      break;
    }
    case 'staircase':
      normalized = Math.floor(tau * 8.0) / 3.5 - 1.0;
      break;
    case 'noise':
      normalized = Math.sin(t * freq * 137.5) * 0.7 + Math.sin(t * freq * 239.1) * 0.3;
      break;
    case 'dc':
      normalized = 0.0;
      break;
    case 'sine':
    default:
      normalized = Math.sin(2.0 * Math.PI * tau);
      break;
  }
  return Number.isFinite(normalized) ? normalized : 0.0;
}

function _fgCalcVrms(wave, amp, offset, dutyPct) {
  const vpp = Math.max(0, amp);
  const vdc = offset;
  const duty = Math.max(0.01, Math.min(0.99, (dutyPct || 50) / 100));
  let vacRms = 0;
  switch (wave) {
    case 'sine':
      vacRms = (vpp / 2) / Math.SQRT2;
      break;
    case 'square':
    case 'pulse':
      vacRms = (vpp / 2) * 2 * Math.sqrt(duty * (1 - duty));
      break;
    case 'triangle':
    case 'sawtooth':
    case 'ramp_down':
      vacRms = (vpp / 2) / Math.sqrt(3);
      break;
    case 'noise':
      vacRms = (vpp / 2) * 0.58;
      break;
    case 'dc':
      vacRms = 0;
      break;
    default:
      vacRms = (vpp / 2) * 0.65;
      break;
  }
  return Math.sqrt(vdc * vdc + vacRms * vacRms);
}

defComp({
  id: 'func_gen',
  name: 'Function Generator',
  category: 'Instruments',
  icon: '〜',
  desc: 'Precision Dual-Channel DDS Function Generator — 11 waveforms, AM/FM/Sweep modulation, channel sync, and dual-trace phosphor display',

  width: 300,
  height: 190,

  defaultProps: {
    powered: 1,
    ch1_en: 1,
    ch1_wave: 'sine',
    ch1_freq: 440,
    ch1_amp: 5.0,
    ch1_offset: 0,
    ch1_phase: 0,
    ch1_duty: 50,
    ch1_mod: 'none',
    ch1_mod_freq: 10,
    ch1_mod_depth: 50,

    ch2_en: 1,
    ch2_wave: 'square',
    ch2_freq: 880,
    ch2_amp: 3.0,
    ch2_offset: 0,
    ch2_phase: 90,
    ch2_duty: 50,
    ch2_mod: 'none',
    ch2_mod_freq: 10,
    ch2_mod_depth: 50,

    ch_sync: 'off',
    load_imp: 'highz',
  },

  interactive: [
    { field: 'powered', label: 'Power', type: 'toggle', min: 0, max: 1, step: 1, unit: '', inline: { x: 265, y: 28, w: 26, h: 42 } },

    // Channel 1 Controls
    { field: 'ch1_en', label: 'CH1 Enable', type: 'checkbox' },
    { field: 'ch1_wave', label: 'CH1 Wave', type: 'select', options: FG_WAVEFORMS.map(w => ({ value: w.id, label: w.label })) },
    { field: 'ch1_freq', label: 'CH1 Freq', type: 'number', min: 0, max: 10000000, unit: 'Hz' },
    { field: 'ch1_amp', label: 'CH1 Amp', min: 0, max: 10, step: 0.1, unit: 'Vpp' },
    { field: 'ch1_offset', label: 'CH1 Offset', min: -5, max: 5, step: 0.1, unit: 'V' },
    { field: 'ch1_phase', label: 'CH1 Phase', min: 0, max: 360, step: 1, unit: '\u00b0' },
    { field: 'ch1_duty', label: 'CH1 Duty', min: 1, max: 99, step: 1, unit: '%' },
    { field: 'ch1_mod', label: 'CH1 Modulation', type: 'select', options: [
      { value: 'none', label: 'None' },
      { value: 'am', label: 'AM (Amplitude)' },
      { value: 'fm', label: 'FM (Frequency)' },
      { value: 'sweep', label: 'Frequency Sweep' },
    ]},
    { field: 'ch1_mod_freq', label: 'CH1 Mod Freq', type: 'number', min: 0.1, max: 1000, unit: 'Hz' },
    { field: 'ch1_mod_depth', label: 'CH1 Mod Depth', type: 'number', min: 0, max: 100, unit: '%' },

    // Channel 2 Controls
    { field: 'ch2_en', label: 'CH2 Enable', type: 'checkbox' },
    { field: 'ch2_wave', label: 'CH2 Wave', type: 'select', options: FG_WAVEFORMS.map(w => ({ value: w.id, label: w.label })) },
    { field: 'ch2_freq', label: 'CH2 Freq', type: 'number', min: 0, max: 10000000, unit: 'Hz' },
    { field: 'ch2_amp', label: 'CH2 Amp', min: 0, max: 10, step: 0.1, unit: 'Vpp' },
    { field: 'ch2_offset', label: 'CH2 Offset', min: -5, max: 5, step: 0.1, unit: 'V' },
    { field: 'ch2_phase', label: 'CH2 Phase', min: 0, max: 360, step: 1, unit: '\u00b0' },
    { field: 'ch2_duty', label: 'CH2 Duty', min: 1, max: 99, step: 1, unit: '%' },
    { field: 'ch2_mod', label: 'CH2 Modulation', type: 'select', options: [
      { value: 'none', label: 'None' },
      { value: 'am', label: 'AM (Amplitude)' },
      { value: 'fm', label: 'FM (Frequency)' },
      { value: 'sweep', label: 'Frequency Sweep' },
    ]},
    { field: 'ch2_mod_freq', label: 'CH2 Mod Freq', type: 'number', min: 0.1, max: 1000, unit: 'Hz' },
    { field: 'ch2_mod_depth', label: 'CH2 Mod Depth', type: 'number', min: 0, max: 100, unit: '%' },

    // Global instrument controls
    { field: 'ch_sync', label: 'Channel Sync', type: 'select', options: [
      { value: 'off', label: 'Independent (Off)' },
      { value: 'freq_track', label: 'Frequency Tracking' },
      { value: 'phase_sync', label: 'Phase Synchronized' },
    ]},
    { field: 'load_imp', label: 'Load Impedance', type: 'select', options: [
      { value: 'highz', label: 'High-Z (Open Circuit)' },
      { value: '50', label: '50 \u03a9 (Terminated)' },
    ]},
  ],

  pins: [
    { id: 'ch1_out', label: 'CH1',  type: PIN_TYPE.SIGNAL, x: 80,  y: 190, side: 'bottom' },
    { id: 'ch1_gnd', label: 'GND1', type: PIN_TYPE.GND,   x: 110, y: 190, side: 'bottom' },
    { id: 'ch2_out', label: 'CH2',  type: PIN_TYPE.SIGNAL, x: 170, y: 190, side: 'bottom' },
    { id: 'ch2_gnd', label: 'GND2', type: PIN_TYPE.GND,   x: 200, y: 190, side: 'bottom' },
  ],

  evaluateChannel(inst, channel, t) {
    inst.runtimeState = inst.runtimeState || {};
    const rs = inst.runtimeState;
    const props = inst.props || {};
    const P = (field, def) => (rs[field] !== undefined ? rs[field] : (props[field] ?? def));

    const powered = _fgBool(P('powered', 1));
    if (!powered) return 0;

    const en = _fgBool(P(`${channel}_en`, 1));
    if (!en) return 0;

    const wave = P(`${channel}_wave`, channel === 'ch1' ? 'sine' : 'square') || 'sine';
    let freq = _fgNum(P(`${channel}_freq`), channel === 'ch1' ? 440 : 880, 0, 10000000);
    const amp = _fgNum(P(`${channel}_amp`), channel === 'ch1' ? 5.0 : 3.0, 0, 10);
    const offset = _fgNum(P(`${channel}_offset`), 0, -5, 5);
    let phaseDeg = _fgNum(P(`${channel}_phase`), channel === 'ch1' ? 0 : 90, 0, 360);
    const duty = _fgNum(P(`${channel}_duty`), 50, 1, 99) / 100;

    // Channel Synchronization
    const syncMode = P('ch_sync', 'off');
    if (channel === 'ch2') {
      const ch1Freq = _fgNum(P('ch1_freq'), 440, 0, 10000000);
      const ch1Phase = _fgNum(P('ch1_phase'), 0, 0, 360);
      if (syncMode === 'freq_track') {
        freq = ch1Freq;
      } else if (syncMode === 'phase_sync') {
        freq = ch1Freq;
        phaseDeg = (ch1Phase + phaseDeg) % 360;
      }
    }

    // Modulation
    const modMode = P(`${channel}_mod`, 'none');
    const modFreq = _fgNum(P(`${channel}_mod_freq`), 10, 0.1, 1000);
    const modDepth = _fgNum(P(`${channel}_mod_depth`), 50, 0, 100) / 100;

    let effFreq = freq;
    let effAmp = amp;
    let effPhase = phaseDeg / 360;

    if (modMode === 'am') {
      // Standard AM envelope modulation:
      // Envelope = 1 + modDepth * cos(2*pi*modFreq*t)
      // Normalize by (1 + modDepth) so peak amplitude matches set amplitude
      const amEnv = Math.max(0, 1.0 + modDepth * Math.cos(2.0 * Math.PI * modFreq * t));
      effAmp = amp * (amEnv / (1.0 + modDepth));
    } else if (modMode === 'fm') {
      const deltaF = Math.min(freq, freq * modDepth * 0.5);
      effPhase += (-deltaF / (2.0 * Math.PI * Math.max(0.1, modFreq))) * Math.cos(2.0 * Math.PI * modFreq * t);
    } else if (modMode === 'sweep') {
      const sweepPeriod = Math.max(0.01, 1.0 / Math.max(0.1, modFreq));
      const sweepProgress = (t % sweepPeriod) / sweepPeriod;
      const fStart = freq * Math.max(0.1, 1.0 - modDepth * 0.5);
      const fStop = freq * (1.0 + modDepth * 0.5);
      effFreq = fStart + (fStop - fStart) * sweepProgress;
    }

    const tau = ((t * effFreq + effPhase) % 1.0 + 1.0) % 1.0;
    const norm = _fgSampleRaw(wave, tau, t, effFreq, duty);

    // Impedance Load Scaling (High-Z vs 50 Ohm)
    const loadMode = P('load_imp', 'highz');
    const loadScale = String(loadMode).toLowerCase().includes('50') ? 0.5 : 1.0;

    const rawOut = (offset + norm * (effAmp / 2.0)) * loadScale;
    return Number.isFinite(rawOut) ? Math.min(10, Math.max(-10, rawOut)) : 0;
  },

  step(inst, sim) {
    inst.runtimeState = inst.runtimeState || {};
    const rawT = sim && typeof sim.simTime === 'number' ? sim.simTime / 1000 : performance.now() / 1000;
    const t = Number.isFinite(rawT) ? rawT : 0;

    const v1 = this.evaluateChannel(inst, 'ch1', t);
    const v2 = this.evaluateChannel(inst, 'ch2', t);

    inst.runtimeState.ch1_voltage = v1;
    inst.runtimeState.ch2_voltage = v2;

    if (sim && typeof sim.setPinVoltage === 'function') {
      sim.setPinVoltage(inst, 'ch1_out', v1);
      sim.setPinVoltage(inst, 'ch1_gnd', 0);
      sim.setPinVoltage(inst, 'ch2_out', v2);
      sim.setPinVoltage(inst, 'ch2_gnd', 0);
    }
  },

  _btnRects: {},

  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const props = inst.props || {};
    const rs = inst.runtimeState || {};
    const P = (field, def) => (rs[field] !== undefined ? rs[field] : (props[field] ?? def));
    const num = (field, def, min, max) => _fgNum(P(field), def, min, max);
    const W = 300, H = 190;
    const isPowered = _fgBool(P('powered', 1));

    ctx.save();
    ctx.translate(x, y);

    if (!inst._btnRects) inst._btnRects = {};

    // ── Chassis Body ──
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a2e38');
    bg.addColorStop(0.5, '#20242c');
    bg.addColorStop(1, '#16181f');
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H - 25, 10);
    ctx.fill();
    ctx.strokeStyle = '#0a0c10';
    ctx.lineWidth = 3;
    ctx.stroke();

    // ── Top Title Bar ──
    ctx.fillStyle = '#14171d';
    ctx.fillRect(8, 6, W - 16, 18);

    // Instrument Logo & Title
    ctx.fillStyle = isPowered ? '#00e5ff' : '#1e333d';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DDS-8000 PRO', 14, 18);

    ctx.fillStyle = isPowered ? '#7e8a9d' : '#2b313d';
    ctx.font = '7px sans-serif';
    ctx.fillText('DUAL-CHANNEL ARBITRARY FUNCTION GENERATOR', 88, 18);

    // Master Power Indicator LED
    ctx.fillStyle = isPowered ? '#00e676' : '#1a3a23';
    ctx.beginPath();
    ctx.arc(W - 48, 15, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (isPowered) {
      ctx.fillStyle = 'rgba(0,230,118,0.35)';
      ctx.beginPath();
      ctx.arc(W - 48, 15, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Phosphor Screen ──
    // Width 248 so it leaves a clean 7px gap before the toggle switch at x=265
    const scrX = 10, scrY = 28, scrW = 248, scrH = 56;
    ctx.fillStyle = '#020407';
    roundRect(ctx, scrX - 2, scrY - 2, scrW + 4, scrH + 4, 4);
    ctx.fill();
    ctx.fillStyle = '#010305';
    roundRect(ctx, scrX, scrY, scrW, scrH, 3);
    ctx.fill();
    ctx.strokeStyle = '#222838';
    ctx.lineWidth = 1;
    ctx.stroke();

    const ch1En = _fgBool(P('ch1_en', 1));
    const ch2En = _fgBool(P('ch2_en', 1));
    const syncMode = P('ch_sync', 'off');
    const loadMode = P('load_imp', 'highz');

    const ch1Freq = num('ch1_freq', 440, 0, 10000000);
    const ch2Freq = num('ch2_freq', 880, 0, 10000000);
    const ch1Amp = num('ch1_amp', 5, 0, 10);
    const ch2Amp = num('ch2_amp', 3, 0, 10);
    const ch1Offset = num('ch1_offset', 0, -5, 5);
    const ch2Offset = num('ch2_offset', 0, -5, 5);
    const ch1Phase = num('ch1_phase', 0, 0, 360);
    const ch2Phase = num('ch2_phase', 90, 0, 360);
    const ch1Duty = num('ch1_duty', 50, 1, 99);
    const ch2Duty = num('ch2_duty', 50, 1, 99);

    if (isPowered) {
      // Graticule grid
      ctx.strokeStyle = '#0a1622';
      ctx.lineWidth = 0.5;
      for (let gx = 1; gx < 10; gx++) {
        const gxPos = scrX + (scrW / 10) * gx;
        ctx.beginPath(); ctx.moveTo(gxPos, scrY); ctx.lineTo(gxPos, scrY + scrH); ctx.stroke();
      }
      for (let gy = 1; gy < 6; gy++) {
        const gyPos = scrY + (scrH / 6) * gy;
        ctx.beginPath(); ctx.moveTo(scrX, gyPos); ctx.lineTo(scrX + scrW, gyPos); ctx.stroke();
      }
      // Zero line
      ctx.strokeStyle = '#142538';
      ctx.lineWidth = 0.8;
      const zeroY = scrY + scrH / 2;
      ctx.beginPath(); ctx.moveTo(scrX, zeroY); ctx.lineTo(scrX + scrW, zeroY); ctx.stroke();

      // Waveform trace rendering
      const baseFreq = ch1Freq || ch2Freq || 100;
      const timeWindow = 2.5 / baseFreq;
      const dt = timeWindow / scrW;
      const vScale = (scrH / 2) / 6.0;

      // CH1 Trace (Cyan)
      if (ch1En) {
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let px = 0; px < scrW; px++) {
          const st = px * dt;
          const v = this.evaluateChannel(inst, 'ch1', st);
          const py = zeroY - v * vScale;
          if (px === 0) ctx.moveTo(scrX + px, py); else ctx.lineTo(scrX + px, py);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Disabled CH1 flat trace
        ctx.strokeStyle = 'rgba(0,229,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(scrX, zeroY); ctx.lineTo(scrX + scrW, zeroY);
        ctx.stroke();
      }

      // CH2 Trace (Neon Pink)
      if (ch2En) {
        ctx.shadowColor = '#ff2d6d';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#ff2d6d';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let px = 0; px < scrW; px++) {
          const st = px * dt;
          const v = this.evaluateChannel(inst, 'ch2', st);
          const py = zeroY - v * vScale;
          if (px === 0) ctx.moveTo(scrX + px, py); else ctx.lineTo(scrX + px, py);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Screen OSD Labels
      ctx.fillStyle = 'rgba(2, 6, 12, 0.85)';
      roundRect(ctx, scrX + 2, scrY + 2, 70, 11, 2);
      ctx.fill();
      ctx.fillStyle = ch1En ? '#00e5ff' : '#4a5d68';
      ctx.font = 'bold 6.5px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('CH1: ' + _fmtFreq(ch1Freq) + (ch1En ? '' : ' [OFF]'), scrX + 4, scrY + 10);

      ctx.fillStyle = 'rgba(2, 6, 12, 0.85)';
      roundRect(ctx, scrX + 76, scrY + 2, 70, 11, 2);
      ctx.fill();
      ctx.fillStyle = ch2En ? '#ff2d6d' : '#684a56';
      ctx.fillText('CH2: ' + _fmtFreq(ch2Freq) + (ch2En ? '' : ' [OFF]'), scrX + 78, scrY + 10);

      // Status indicator on right screen
      ctx.fillStyle = 'rgba(2, 6, 12, 0.85)';
      roundRect(ctx, scrX + scrW - 80, scrY + 2, 78, 11, 2);
      ctx.fill();
      ctx.fillStyle = '#a0b0c0';
      ctx.textAlign = 'right';
      const syncLbl = syncMode === 'off' ? 'INDEP' : syncMode === 'freq_track' ? 'TRACK' : 'LOCK';
      const impLbl = String(loadMode).toLowerCase().includes('50') ? '50\u03a9' : 'Hi-Z';
      ctx.fillText(syncLbl + ' | ' + impLbl, scrX + scrW - 4, scrY + 10);
    } else {
      ctx.fillStyle = '#0f141d';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u2014 STANDBY \u2014', scrX + scrW / 2, scrY + scrH / 2 + 3);
    }

    // ── Power Toggle Switch ──
    const drawToggleSwitch = (tx, ty, tw, th, isOn, label) => {
      ctx.fillStyle = '#0e1116';
      roundRect(ctx, tx, ty, tw, th, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,95,115,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const trackW = tw * 0.7;
      const trackH = 8;
      const trackX = tx + (tw - trackW) / 2;
      const trackY = ty + th / 2 - 2;
      ctx.fillStyle = '#06080b';
      roundRect(ctx, trackX, trackY, trackW, trackH, trackH / 2);
      ctx.fill();

      if (isOn) {
        const grad = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
        grad.addColorStop(0, 'rgba(0,230,118,0.2)');
        grad.addColorStop(1, 'rgba(0,230,118,0.7)');
        ctx.fillStyle = grad;
        roundRect(ctx, trackX, trackY, trackW, trackH, trackH / 2);
        ctx.fill();
      }

      const thumbR = 5;
      const thumbX = isOn ? trackX + trackW - thumbR - 1 : trackX + thumbR + 1;
      const thumbY = trackY + trackH / 2;
      if (Number.isFinite(thumbX) && Number.isFinite(thumbY)) {
        const thumbGrad = ctx.createRadialGradient(thumbX - 1, thumbY - 1, 0.5, thumbX, thumbY, thumbR);
        thumbGrad.addColorStop(0, isOn ? '#c8e6c9' : '#cfd8dc');
        thumbGrad.addColorStop(1, isOn ? '#2e7d32' : '#455a64');
        ctx.fillStyle = thumbGrad;
        ctx.beginPath();
        ctx.arc(thumbX, thumbY, thumbR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      const ledX = tx + tw / 2;
      const ledY = ty + 5;
      ctx.fillStyle = isOn ? '#00e676' : '#1a3822';
      ctx.beginPath(); ctx.arc(ledX, ledY, 2, 0, Math.PI * 2); ctx.fill();
      if (isOn) {
        ctx.fillStyle = 'rgba(0,230,118,0.3)';
        ctx.beginPath(); ctx.arc(ledX, ledY, 4.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = isOn ? '#eceff1' : '#78909c';
      ctx.font = 'bold 5.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, tx + tw / 2, ty + th - 3);
    };

    drawToggleSwitch(265, 28, 26, 42, isPowered, 'POWER');

    // ── Channel Cards ──
    const cardY = 88, cardH = 68, cardGap = 8;
    const cardW = (scrW - cardGap) / 2; // 120px each

    const _drawCard = (cx, cy, cw, ch, label, labelColor, en, wave, freq, amp, offset, phase, duty, modMode) => {
      ctx.fillStyle = isPowered ? '#161920' : '#101217';
      roundRect(ctx, cx, cy, cw, ch, 5);
      ctx.fill();

      // Color top accent stripe
      ctx.fillStyle = isPowered && en ? labelColor : '#222834';
      roundRect(ctx, cx, cy, cw, 2.5, 4);
      ctx.fill();

      // Card Header
      ctx.fillStyle = isPowered && en ? labelColor : '#455060';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, cx + 6, cy + 13);

      // Output Status Badge
      const outBadgeW = 26;
      ctx.fillStyle = isPowered && en ? 'rgba(0,230,118,0.18)' : 'rgba(255,255,255,0.05)';
      roundRect(ctx, cx + 58, cy + 4, outBadgeW, 11, 2);
      ctx.fill();
      ctx.fillStyle = isPowered && en ? '#00e676' : '#556070';
      ctx.font = 'bold 6.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(en ? 'ON' : 'OFF', cx + 58 + outBadgeW / 2, cy + 12);

      // Wave Badge
      const waveObj = FG_WAVEFORMS.find(w => w.id === wave) || FG_WAVEFORMS[0];
      const badgeW = 28;
      ctx.fillStyle = isPowered ? '#222834' : '#16181f';
      roundRect(ctx, cx + cw - badgeW - 6, cy + 4, badgeW, 11, 2);
      ctx.fill();
      ctx.fillStyle = isPowered && en ? labelColor : '#556070';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(waveObj.badge, cx + cw - badgeW / 2 - 6, cy + 12);

      // Parameter Readouts
      const vrms = _fgCalcVrms(wave, amp, offset, duty);
      ctx.fillStyle = isPowered && en ? '#9aa8b8' : '#3c4452';
      ctx.font = '7.5px monospace';
      ctx.textAlign = 'left';
      const lineH = 10;
      let py = cy + 24;

      ctx.fillText('Freq: ' + _fmtFreq(freq), cx + 6, py); py += lineH;
      ctx.fillText('Amp:  ' + amp.toFixed(1) + 'Vpp', cx + 6, py); py += lineH;
      ctx.fillText('Off:  ' + (offset >= 0 ? '+' : '') + offset.toFixed(1) + 'V', cx + 6, py); py += lineH;
      ctx.fillText('Phs:  ' + phase + '\u00B0 | ' + duty + '%', cx + 6, py); py += lineH;

      // True RMS readout
      ctx.fillStyle = isPowered && en ? '#00e5ff' : '#3c4452';
      ctx.fillText('RMS:  ' + vrms.toFixed(2) + 'V', cx + 6, py);
    };

    const ch1Wave = P('ch1_wave', 'sine') || 'sine';
    const ch2Wave = P('ch2_wave', 'square') || 'square';
    const ch1Mod = P('ch1_mod', 'none');
    const ch2Mod = P('ch2_mod', 'none');

    _drawCard(scrX, cardY, cardW, cardH, 'CH1', '#00e5ff',
      ch1En, ch1Wave, ch1Freq, ch1Amp, ch1Offset, ch1Phase, ch1Duty, ch1Mod);
    _drawCard(scrX + cardW + cardGap, cardY, cardW, cardH, 'CH2', '#ff2d6d',
      ch2En, ch2Wave, ch2Freq, ch2Amp, ch2Offset, ch2Phase, ch2Duty, ch2Mod);

    // ── Interactive Control Buttons Row ──
    const _ctrlBtn = (bx, by, bw, bh, lbl, col, active) => {
      const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
      if (active) {
        bg.addColorStop(0, col);
        bg.addColorStop(1, _darken(col, 0.35));
      } else {
        bg.addColorStop(0, '#222832');
        bg.addColorStop(1, '#161920');
      }
      ctx.fillStyle = bg;
      roundRect(ctx, bx, by, bw, bh, 3);
      ctx.fill();
      ctx.strokeStyle = active ? '#0a0d12' : '#141820';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = active ? '#ffffff' : '#6b778c';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, bx + bw / 2, by + bh - 4);
    };

    const btnY = 160;
    const btnH = 13;

    // CH1 [OUT1] Toggle Button
    _ctrlBtn(10, btnY, 26, btnH, 'OUT1', '#00c853', isPowered && ch1En);
    inst._btnRects.ch1Out = { x: 10, y: btnY, w: 26, h: btnH, field: 'ch1_en' };

    // CH1 [WAVE] Cycle Button
    const ch1WaveObj = FG_WAVEFORMS.find(w => w.id === ch1Wave) || FG_WAVEFORMS[0];
    _ctrlBtn(38, btnY, 30, btnH, ch1WaveObj.badge, '#00b0ff', isPowered);
    inst._btnRects.ch1Wave = { x: 38, y: btnY, w: 30, h: btnH, field: 'ch1_wave', options: FG_WAVE_IDS };

    // CH1 Freq [▼] and [▲] Buttons
    _ctrlBtn(70, btnY, 14, btnH, '\u25BC', '#00b0ff', isPowered);
    inst._btnRects.ch1FreqDown = { x: 70, y: btnY, w: 14, h: btnH, field: 'ch1_freq_down' };
    _ctrlBtn(86, btnY, 14, btnH, '\u25B2', '#00b0ff', isPowered);
    inst._btnRects.ch1FreqUp = { x: 86, y: btnY, w: 14, h: btnH, field: 'ch1_freq_up' };

    // CH1 [MOD] Cycle Button
    const ch1ModLbl = ch1Mod === 'none' ? 'MOD' : ch1Mod.toUpperCase();
    _ctrlBtn(102, btnY, 26, btnH, ch1ModLbl, '#7c4dff', isPowered && ch1Mod !== 'none');
    inst._btnRects.ch1Mod = { x: 102, y: btnY, w: 26, h: btnH, field: 'ch1_mod' };

    // Center [SYNC] Button
    const syncBtnLbl = syncMode === 'off' ? 'SYNC' : syncMode === 'freq_track' ? 'TRACK' : 'PHASE';
    _ctrlBtn(132, btnY, 34, btnH, syncBtnLbl, '#ff9100', isPowered && syncMode !== 'off');
    inst._btnRects.chSync = { x: 132, y: btnY, w: 34, h: btnH, field: 'ch_sync' };

    // CH2 [MOD] Cycle Button
    const ch2ModLbl = ch2Mod === 'none' ? 'MOD' : ch2Mod.toUpperCase();
    _ctrlBtn(170, btnY, 26, btnH, ch2ModLbl, '#7c4dff', isPowered && ch2Mod !== 'none');
    inst._btnRects.ch2Mod = { x: 170, y: btnY, w: 26, h: btnH, field: 'ch2_mod' };

    // CH2 [OUT2] Toggle Button
    _ctrlBtn(200, btnY, 26, btnH, 'OUT2', '#00c853', isPowered && ch2En);
    inst._btnRects.ch2Out = { x: 200, y: btnY, w: 26, h: btnH, field: 'ch2_en' };

    // CH2 [WAVE] Cycle Button
    const ch2WaveObj = FG_WAVEFORMS.find(w => w.id === ch2Wave) || FG_WAVEFORMS[0];
    _ctrlBtn(228, btnY, 30, btnH, ch2WaveObj.badge, '#ff2d6d', isPowered);
    inst._btnRects.ch2Wave = { x: 228, y: btnY, w: 30, h: btnH, field: 'ch2_wave', options: FG_WAVE_IDS };

    // CH2 Freq [▼] and [▲] Buttons
    _ctrlBtn(260, btnY, 14, btnH, '\u25BC', '#ff2d6d', isPowered);
    inst._btnRects.ch2FreqDown = { x: 260, y: btnY, w: 14, h: btnH, field: 'ch2_freq_down' };
    _ctrlBtn(276, btnY, 14, btnH, '\u25B2', '#ff2d6d', isPowered);
    inst._btnRects.ch2FreqUp = { x: 276, y: btnY, w: 14, h: btnH, field: 'ch2_freq_up' };

    // ── Realistic Metallic BNC Terminals ──
    const _drawBNC = (bx, by, lbl, col, isSignal) => {
      // Outer chassis washer
      ctx.fillStyle = '#1e222a';
      ctx.beginPath(); ctx.arc(bx, by, 9.5, 0, Math.PI * 2); ctx.fill();

      // Knurled metallic outer shell
      const mg = ctx.createLinearGradient(bx - 6, by - 6, bx + 6, by + 6);
      mg.addColorStop(0, '#c8d2de');
      mg.addColorStop(0.35, '#8291a2');
      mg.addColorStop(0.65, '#5c6776');
      mg.addColorStop(1, '#2c333e');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(bx, by, 7.5, 0, Math.PI * 2); ctx.fill();

      // Insulating black ring
      ctx.fillStyle = '#080a0e';
      ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, Math.PI * 2); ctx.fill();

      // Center pin (Gold for signal, silver for ground)
      const pinCol = isSignal ? (isPowered ? '#ffd700' : '#887a4a') : '#a8b4c0';
      ctx.fillStyle = pinCol;
      ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, Math.PI * 2); ctx.fill();

      // Color accent ring
      if (isSignal && isPowered) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(bx, by, 8.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Label
      ctx.fillStyle = isPowered ? col : '#505a6a';
      ctx.font = 'bold 6.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, bx, by + 14);
    };

    const bncY = 175;
    _drawBNC(80,  bncY, 'CH1',  '#00e5ff', true);
    _drawBNC(110, bncY, 'GND1', '#8898a8', false);
    _drawBNC(170, bncY, 'CH2',  '#ff2d6d', true);
    _drawBNC(200, bncY, 'GND2', '#8898a8', false);

    // ── Selection Outline ──
    if (inst.selected && typeof drawSelectionRect === 'function') {
      drawSelectionRect(ctx, -4, -4, W + 8, H + 4);
    }

    ctx.restore();
  }
});

function _fmtFreq(hz) {
  if (hz >= 1e6) return (hz / 1e6).toFixed(2) + ' MHz';
  if (hz >= 1e3) return (hz / 1e3).toFixed(2) + ' kHz';
  return hz.toFixed(0) + ' Hz';
}

function _darken(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}
