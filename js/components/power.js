/*
 * components/power.js — Power component definitions
 */

'use strict';
/*--------------------------- Power Supply------------------------------------- */
defComp({
  id: 'power_5v',
  name: '5V Power',
  category: 'Power',
  icon: '⚡',
  desc: '5V DC power supply terminal',
  width: 30,
  height: 30,
  defaultProps: {},
  pins: [
    { id: 'vcc', label: '5V', type: PIN_TYPE.POWER, x: 15, y: 30, side: 'bottom' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#cc3333';
    roundRect(ctx, 2, 2, 26, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('5V', 15, 16);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(15, 24); ctx.lineTo(15, 30); ctx.stroke();
    if (inst.selected) drawSelectionRect(ctx, -2, -2, 34, 34);
    ctx.restore();
  }
});

defComp({
  id: 'power_gnd',
  name: 'GND',
  category: 'Power',
  icon: '⏚',
  desc: 'Ground (GND) reference terminal',
  width: 30,
  height: 30,
  defaultProps: {},
  pins: [
    { id: 'gnd', label: 'GND', type: PIN_TYPE.GND, x: 15, y: 0, side: 'top' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(15, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(26, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 17); ctx.lineTo(22, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 22); ctx.lineTo(18, 22); ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GND', 15, 30);
    if (inst.selected) drawSelectionRect(ctx, -2, -2, 34, 34);
    ctx.restore();
  }
});

/* -------------- Li-Ion Battery (single cell, 3.7 V nominal) ------------------ */

const BATT_V_MIN = 2.5;
const BATT_V_MAX = 4.2;

function batterySocFromVoltage(v) {
  return Math.max(0, Math.min(1, (Number(v) - BATT_V_MIN) / (BATT_V_MAX - BATT_V_MIN)));
}

function batterySeedSoc(inst) {
  inst.runtimeState = inst.runtimeState || {};
  const v = inst.runtimeState.voltage ?? inst.props?.voltage ?? 3.7;
  inst.runtimeState._soc = batterySocFromVoltage(v);
  return inst.runtimeState._soc;
}

window.batterySeedSoc = batterySeedSoc;
window.batterySocFromVoltage = batterySocFromVoltage;

defComp({
  id: 'battery',
  name: 'Li-Ion Battery',
  category: 'Power',
  icon: '🔋',
  desc: 'Single-cell Li-Ion battery, 3.7 V nominal (2.5–4.2 V). Drains under load — lower Capacity (mAh) in Properties to see voltage drop faster. Drag Voltage to recharge/reset.',
  width: 144,
  height: 78,
  defaultProps: {
    voltage: 3.7,
    capacity_mah: 5,
    r_int: 0.15,
  },
  interactive: [
    { field: 'voltage', label: 'Voltage', min: 2.5, max: 4.2, step: 0.05, unit: 'V' },
  ],
  pins: [
    { id: 'pos', label: '+', type: PIN_TYPE.POWER, x: 142, y: 39, side: 'right' },
    { id: 'neg', label: '−', type: PIN_TYPE.GND,   x: 2,  y: 39, side: 'left' },
  ],
  step(inst, sim) {
    const rs = inst.runtimeState = inst.runtimeState || {};
    const props = inst.props || {};

    const useSim = !!(sim && sim.isRunning && typeof sim.simTime === 'number');
    const now = useSim
      ? sim.simTime
      : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const base = useSim ? 'sim' : 'wall';

    if (rs._timeBase !== base) {
      rs._timeBase = base;
      rs._lastTick = now;
    }

    const last = rs._lastTick;
    rs._lastTick = now;
    let dtMs = now - last;
    // simTime reset (Run) or first frame / clock jump — skip integrate
    if (!Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 60000) dtMs = 0;

    if (rs._soc == null) batterySeedSoc(inst);
    let soc = Math.max(0, Math.min(1, rs._soc));

    const capMah = Math.max(0.1, Number(rs.capacity_mah ?? props.capacity_mah ?? 5));
    const rInt = Math.max(0, Number(rs.r_int ?? props.r_int ?? 0.15));

    let iA = 0;
    const engine = window.CircuitCanvas && window.CircuitCanvas.engine;
    if (engine && typeof engine.calculateCurrent === 'function') {
      const raw = engine.calculateCurrent(inst.id, 'pos', inst.id, 'neg');
      if (Number.isFinite(raw)) iA = raw;
    }
    const iDis = Math.max(0, iA);

    if (dtMs > 0 && iDis > 1e-6) {
      const dAh = (iDis * (dtMs / 1000)) / 3600;
      soc = Math.max(0, soc - dAh / (capMah / 1000));
    }

    rs._soc = soc;
    const vOcv = BATT_V_MIN + soc * (BATT_V_MAX - BATT_V_MIN);
    rs.voltage = Math.max(0, vOcv - iDis * rInt);
  },
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const W = 144, H = 78;
    const v = Number(inst.runtimeState?.voltage ?? inst.props?.voltage ?? 3.7);
    const soc = inst.runtimeState?._soc != null
      ? Math.max(0, Math.min(1, inst.runtimeState._soc))
      : batterySocFromVoltage(v);
    const socPct = Math.round(soc * 100);

    const bodyX = 18, bodyY = 9, bodyW = 102, bodyH = 60, r = 9;

    ctx.save();
    ctx.translate(x, y);

    // ── Terminal Lead Stubs ──
    ctx.strokeStyle = '#78909c';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 39); ctx.lineTo(bodyX, 39); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyX + bodyW + 12, 39); ctx.lineTo(W, 39); ctx.stroke();

    // ── Negative Terminal Metallic Cap (Left) ──
    const negCapGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
    negCapGrad.addColorStop(0, '#b0bec5');
    negCapGrad.addColorStop(0.3, '#eceff1');
    negCapGrad.addColorStop(0.7, '#90a4ae');
    negCapGrad.addColorStop(1, '#546e7a');
    ctx.fillStyle = negCapGrad;
    roundRect(ctx, bodyX - 5, bodyY + 5, 8, bodyH - 10, 3);
    ctx.fill();

    // ── Positive Terminal Button Nipple (Right) ──
    const posCapGrad = ctx.createLinearGradient(0, bodyY + 18, 0, bodyY + bodyH - 18);
    posCapGrad.addColorStop(0, '#cfd8dc');
    posCapGrad.addColorStop(0.4, '#ffffff');
    posCapGrad.addColorStop(0.8, '#90a4ae');
    posCapGrad.addColorStop(1, '#607d8b');
    ctx.fillStyle = posCapGrad;
    roundRect(ctx, bodyX + bodyW, 24, 11, 30, 4);
    ctx.fill();
    ctx.strokeStyle = '#455a64';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Positive Insulation Ring
    ctx.fillStyle = '#1e88e5';
    roundRect(ctx, bodyX + bodyW - 3, 18, 5, 42, 2);
    ctx.fill();

    // ── Main Battery Sleeve (Metallic Cylinder Finish) ──
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    const wrapGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
    wrapGrad.addColorStop(0, '#1a232a');
    wrapGrad.addColorStop(0.25, '#2c3b47');
    wrapGrad.addColorStop(0.5, '#1e2830');
    wrapGrad.addColorStop(0.8, '#141a20');
    wrapGrad.addColorStop(1, '#0b0f13');
    ctx.fillStyle = wrapGrad;
    roundRect(ctx, bodyX, bodyY, bodyW, bodyH, r);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Body Border
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bodyX, bodyY, bodyW, bodyH, r);
    ctx.stroke();

    // Cylindrical Glass Reflection Streak
    const shineGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH / 2);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGrad;
    roundRect(ctx, bodyX + 2, bodyY + 2, bodyW - 4, bodyH / 2 - 2, { tl: r, tr: r, bl: 0, br: 0 });
    ctx.fill();

    // ── State of Charge (SOC) Bar Gauge ──
    const barX = bodyX + 9, barY = bodyY + bodyH - 16, barW = bodyW - 18, barH = 9;
    ctx.fillStyle = '#0a0d12';
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (soc > 0) {
      const fillW = Math.max(4, barW * soc);
      let socColor = '#00e676'; // High (>50%)
      let socGlow = 'rgba(0, 230, 118, 0.4)';
      if (soc <= 0.2) {
        socColor = '#ff1744';  // Critical (<=20%)
        socGlow = 'rgba(255, 23, 68, 0.4)';
      } else if (soc <= 0.5) {
        socColor = '#ffb300';  // Medium (20–50%)
        socGlow = 'rgba(255, 179, 0, 0.4)';
      }

      ctx.fillStyle = socColor;
      ctx.shadowColor = socGlow;
      ctx.shadowBlur = 5;
      roundRect(ctx, barX + 0.5, barY + 0.5, fillW - 1, barH - 1, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ── Text & Voltage / SOC % Readout ──
    ctx.fillStyle = '#eceff1';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Li-Ion 18650', bodyX + bodyW / 2, bodyY + 20);

    ctx.fillStyle = soc > 0.2 ? '#b0bec5' : '#ff8a80';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${v.toFixed(2)}V · ${socPct}%`, bodyX + bodyW / 2, bodyY + 35);

    // ── Terminal Polarity Badges ──
    // Positive Badge (+)
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(bodyX + bodyW - 12, bodyY + 15, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+', bodyX + bodyW - 12, bodyY + 19);

    // Negative Badge (−)
    ctx.fillStyle = '#455a64';
    ctx.beginPath();
    ctx.arc(bodyX + 12, bodyY + 15, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('−', bodyX + 12, bodyY + 19);

    if (inst.selected && typeof drawSelectionRect === 'function') {
      drawSelectionRect(ctx, -3, -2, W + 6, H + 4);
    }

    ctx.restore();
  }
});
/* -------------- MB102 Breadboard Power Supply Module (3.3V / 5V Dual Rail) ------------------ */
defComp({
  id: 'mb102_power',
  name: 'MB102 Power Supply',
  category: 'Power',
  icon: '⚡',
  desc: 'MB102 3.3V/5V breadboard power supply module with DC barrel jack, USB-A input/output, dual AMS1117 regulators, and rail selector jumpers',
  width: 160,
  height: 96,
  hidePinLabels: true,
  defaultProps: {
    powered: 1,
    topVoltage: '5V',
    bottomVoltage: '3.3V',
  },
  interactive: [
    { field: 'powered', label: 'Power Switch', type: 'toggle', min: 0, max: 1, step: 1, unit: '', inline: { x: 44, y: 26, w: 18, h: 18 } },
    {
      field: 'topVoltage',
      label: 'Top Rail',
      type: 'select',
      options: [
        { value: '5V', label: '5V' },
        { value: '3.3V', label: '3.3V' },
        { value: 'OFF', label: 'OFF (0V)' },
      ],
    },
    {
      field: 'bottomVoltage',
      label: 'Bottom Rail',
      type: 'select',
      options: [
        { value: '5V', label: '5V' },
        { value: '3.3V', label: '3.3V' },
        { value: 'OFF', label: 'OFF (0V)' },
      ],
    },
  ],
  pins: [
    { id: 'vcc_t', label: 'VCC_TOP', type: PIN_TYPE.POWER, x: 148, y: 12, side: 'top' },
    { id: 'gnd_t', label: 'GND_TOP', type: PIN_TYPE.GND, x: 148, y: 22, side: 'top' },
    { id: 'aux_gnd', label: 'GND', type: PIN_TYPE.GND, x: 104, y: 44, side: 'right' },
    { id: 'aux_3v3', label: '3.3V', type: PIN_TYPE.POWER, x: 104, y: 52, side: 'right' },
    { id: 'aux_5v', label: '5V', type: PIN_TYPE.POWER, x: 104, y: 60, side: 'right' },
    { id: 'vcc_b', label: 'VCC_BOT', type: PIN_TYPE.POWER, x: 148, y: 74, side: 'bottom' },
    { id: 'gnd_b', label: 'GND_BOT', type: PIN_TYPE.GND, x: 148, y: 84, side: 'bottom' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const isPowered = Boolean(inst.runtimeState?.powered ?? inst.props.powered ?? 1);
    const topV = String(inst.runtimeState?.topVoltage ?? inst.props.topVoltage ?? '5V');
    const botV = String(inst.runtimeState?.bottomVoltage ?? inst.props.bottomVoltage ?? '3.3V');
    const isOverload = Boolean(inst.runtimeState?.overload);
    const totalCurrent_mA = Number(inst.runtimeState?.actualCurrent_mA ?? 0);

    ctx.save();
    ctx.translate(x, y);

    // 1. Board Contour / PCB Outline with the classic breadboard notch
    // Left edge: x=4, top edge: y=4, bottom edge: y=92.
    // Right edge has top wing (y=4..32, x=154), center notch (y=32..64, x=142), bottom wing (y=64..92, x=154).
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(150, 4);
    ctx.arcTo(154, 4, 154, 8, 4);
    ctx.lineTo(154, 30);
    ctx.arcTo(154, 33, 151, 33, 3);
    ctx.lineTo(144, 33);
    ctx.arcTo(141, 33, 141, 36, 3);
    ctx.lineTo(141, 60);
    ctx.arcTo(141, 63, 144, 63, 3);
    ctx.lineTo(151, 63);
    ctx.arcTo(154, 63, 154, 66, 3);
    ctx.lineTo(154, 88);
    ctx.arcTo(154, 92, 150, 92, 4);
    ctx.lineTo(8, 92);
    ctx.arcTo(4, 92, 4, 88, 4);
    ctx.lineTo(4, 8);
    ctx.arcTo(4, 4, 8, 4, 4);
    ctx.closePath();

    // Fill PCB dark solder mask with subtle gradient
    const pcbGrad = ctx.createLinearGradient(0, 4, 0, 92);
    pcbGrad.addColorStop(0, '#15191e');
    pcbGrad.addColorStop(0.5, '#111417');
    pcbGrad.addColorStop(1, '#0c0e10');
    ctx.fillStyle = pcbGrad;
    ctx.fill();

    // Solder mask border outline
    ctx.strokeStyle = '#27303a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4 Corner mounting holes with ENIG gold plating
    const holes = [[9, 9], [9, 87], [149, 9], [149, 87]];
    holes.forEach(([hx, hy]) => {
      ctx.fillStyle = '#c5a044';
      ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6c86e';
      ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#07090b';
      ctx.beginPath(); ctx.arc(hx, hy, 1.7, 0, Math.PI * 2); ctx.fill();
    });

    // Copper micro-vias
    const vias = [[38, 14], [38, 78], [88, 14], [88, 82], [118, 36], [118, 60]];
    vias.forEach(([vx, vy]) => {
      ctx.fillStyle = '#bfa14c';
      ctx.beginPath(); ctx.arc(vx, vy, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0d10';
      ctx.beginPath(); ctx.arc(vx, vy, 0.6, 0, Math.PI * 2); ctx.fill();
    });

    // 2. DC Barrel Jack (5.5mm x 2.1mm)
    const jackGrad = ctx.createLinearGradient(6, 8, 6, 36);
    jackGrad.addColorStop(0, '#32373e');
    jackGrad.addColorStop(0.5, '#1b1d22');
    jackGrad.addColorStop(1, '#0f1013');
    ctx.fillStyle = jackGrad;
    roundRect(ctx, 6, 8, 30, 26, 2);
    ctx.fill();

    // Outer metal collar
    ctx.strokeStyle = '#828c98';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(6, 11, 4, 20);

    // Inner cavity
    ctx.fillStyle = '#060708';
    ctx.beginPath(); ctx.arc(6, 21, 6.8, -Math.PI / 2, Math.PI / 2); ctx.fill();

    // Center pin (+)
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.arc(6, 21, 2.2, -Math.PI / 2, Math.PI / 2); ctx.fill();

    // Polarity diagram and label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 3.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('-(o- +', 21, 31);
    ctx.fillText('6.5-12V', 21, 36);

    // 3. USB Type-A Receptacle (5V Input / Output)
    const usbGrad = ctx.createLinearGradient(6, 46, 6, 76);
    usbGrad.addColorStop(0, '#dbe2ea');
    usbGrad.addColorStop(0.25, '#b0bec5');
    usbGrad.addColorStop(0.75, '#78909c');
    usbGrad.addColorStop(1, '#455a64');
    ctx.fillStyle = usbGrad;
    roundRect(ctx, 6, 46, 30, 26, 2);
    ctx.fill();
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Receptacle interior & retention latches
    ctx.fillStyle = '#1c2024';
    ctx.fillRect(6, 50, 4, 18);
    // Latches
    ctx.fillStyle = '#263238';
    ctx.fillRect(15, 52, 5, 3.5);
    ctx.fillRect(15, 62, 5, 3.5);
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(15.5, 52.5, 4, 2.5);
    ctx.fillRect(15.5, 62.5, 4, 2.5);

    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 3.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('USB 5V', 21, 76);

    // 4. Latching Tactile Push Button (Power ON/OFF Switch)
    ctx.fillStyle = '#1e2227';
    roundRect(ctx, 44, 26, 18, 18, 2);
    ctx.fill();
    ctx.strokeStyle = '#424952';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bezel ring
    ctx.fillStyle = '#121417';
    ctx.beginPath(); ctx.arc(53, 35, 7.5, 0, Math.PI * 2); ctx.fill();

    const btnRadius = isPowered ? 5.8 : 6.8;
    const btnGrad = ctx.createRadialGradient(52, 34, 1, 53, 35, btnRadius);
    if (isPowered) {
      // Mechanically pressed
      btnGrad.addColorStop(0, '#e53935');
      btnGrad.addColorStop(0.6, '#c62828');
      btnGrad.addColorStop(1, '#670000');
    } else {
      // Elevated with drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath(); ctx.arc(54, 36, 7.2, 0, Math.PI * 2); ctx.fill();
      btnGrad.addColorStop(0, '#ff6b6b');
      btnGrad.addColorStop(0.5, '#e53935');
      btnGrad.addColorStop(1, '#8e0000');
    }
    ctx.fillStyle = btnGrad;
    ctx.beginPath(); ctx.arc(53, 35, btnRadius, 0, Math.PI * 2); ctx.fill();

    // Specular glint on button when elevated
    if (!isPowered) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath(); ctx.arc(51.5, 33.5, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    // ON/OFF Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 4.5px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ON/OFF', 53, 49);

    // 5. Power Indicator LED (PWR)
    ctx.fillStyle = '#212529';
    roundRect(ctx, 47, 8, 6, 8, 1);
    ctx.fill();

    if (isPowered) {
      if (isOverload) {
        // Warning / Overload Glow (Red/Amber)
        ctx.fillStyle = 'rgba(255, 61, 0, 0.4)';
        ctx.beginPath(); ctx.arc(50, 12, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff3d00';
        ctx.beginPath(); ctx.arc(50, 12, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(49.2, 11.2, 0.8, 0, Math.PI * 2); ctx.fill();
      } else {
        // Vibrant Green Glow
        ctx.fillStyle = 'rgba(0, 230, 118, 0.4)';
        ctx.beginPath(); ctx.arc(50, 12, 8, 0, Math.PI * 2); ctx.fill();
        const ledGrad = ctx.createRadialGradient(49.5, 11.5, 0.5, 50, 12, 2.5);
        ledGrad.addColorStop(0, '#b9f6ca');
        ledGrad.addColorStop(0.6, '#00e676');
        ledGrad.addColorStop(1, '#00a844');
        ctx.fillStyle = ledGrad;
        ctx.beginPath(); ctx.arc(50, 12, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath(); ctx.arc(49.2, 11.2, 0.8, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // Dormant unlit LED
      ctx.fillStyle = '#133519';
      ctx.beginPath(); ctx.arc(50, 12, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath(); ctx.arc(49.3, 11.3, 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'bold 3.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PWR', 50, 20);

    // 6. Dual AMS1117 Linear Voltage Regulators (SOT-223)
    const regulators = [
      { label: 'AMS1117', sub: '5.0', y: 15 },
      { label: 'AMS1117', sub: '3.3', y: 55 },
    ];

    regulators.forEach(reg => {
      // Copper thermal tab soldered to PCB
      ctx.fillStyle = '#b0bec5';
      roundRect(ctx, 68, reg.y - 3, 14, 3, 0.6);
      ctx.fill();

      // SOT-223 Molded package
      const pkgGrad = ctx.createLinearGradient(67, reg.y, 83, reg.y + 15);
      pkgGrad.addColorStop(0, '#2b3036');
      pkgGrad.addColorStop(1, '#181a1d');
      ctx.fillStyle = pkgGrad;
      roundRect(ctx, 67, reg.y, 16, 15, 1.5);
      ctx.fill();
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Pin 1 dot
      ctx.fillStyle = '#0f1113';
      ctx.beginPath(); ctx.arc(69.5, reg.y + 2.5, 0.8, 0, Math.PI * 2); ctx.fill();

      // 3 Gull-wing leads
      ctx.fillStyle = '#cfd8dc';
      ctx.fillRect(68.5, reg.y + 15, 2.5, 3.5);
      ctx.fillRect(73.5, reg.y + 15, 2.5, 3.5);
      ctx.fillRect(78.5, reg.y + 15, 2.5, 3.5);

      // Silkscreen text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = 'bold 3.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(reg.label, 75, reg.y + 6.5);
      ctx.font = 'bold 4px "JetBrains Mono", monospace';
      ctx.fillText(reg.sub, 75, reg.y + 11.5);
    });

    // 7. Aluminum Electrolytic Filter Capacitors
    const caps = [{ x: 50, y: 64 }, { x: 50, y: 78 }];
    caps.forEach(cap => {
      // Outer rim
      const capGrad = ctx.createRadialGradient(cap.x - 1, cap.y - 1, 1, cap.x, cap.y, 5);
      capGrad.addColorStop(0, '#78909c');
      capGrad.addColorStop(0.7, '#37474f');
      capGrad.addColorStop(1, '#1b2226');
      ctx.fillStyle = capGrad;
      ctx.beginPath(); ctx.arc(cap.x, cap.y, 5, 0, Math.PI * 2); ctx.fill();

      // Negative polarity stripe
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath();
      ctx.arc(cap.x, cap.y, 5, -Math.PI / 4, Math.PI / 4);
      ctx.lineTo(cap.x, cap.y);
      ctx.closePath();
      ctx.fill();

      // Stamped safety vent cross (+)
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cap.x - 2, cap.y); ctx.lineTo(cap.x + 2, cap.y);
      ctx.moveTo(cap.x, cap.y - 2); ctx.lineTo(cap.x, cap.y + 2);
      ctx.stroke();
    });

    // 8. 3-Pin Jumper Blocks (Top & Bottom Rails)
    function drawJumperBlock(jx, jy, selectedVal, labelY) {
      // Header base insulator
      ctx.fillStyle = '#181818';
      roundRect(ctx, jx - 1, jy - 1, 21, 9, 1.2);
      ctx.fill();
      ctx.strokeStyle = '#2e2e2e';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 3 Gold square pins
      for (let i = 0; i < 3; i++) {
        const px = jx + 3 + i * 6.5;
        const py = jy + 3.5;
        ctx.fillStyle = '#e5c158';
        ctx.fillRect(px - 1, py - 1, 2, 2);
        ctx.fillStyle = '#ffe082';
        ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
      }

      // Molded yellow jumper shunt
      if (selectedVal === '5V') {
        // Bridges Pin 1 and Pin 2
        const shuntGrad = ctx.createLinearGradient(jx + 1, jy, jx + 1, jy + 7);
        shuntGrad.addColorStop(0, '#fdd835');
        shuntGrad.addColorStop(0.7, '#fbc02d');
        shuntGrad.addColorStop(1, '#f57f17');
        ctx.fillStyle = shuntGrad;
        roundRect(ctx, jx + 1, jy + 0.5, 10.5, 6, 1.2);
        ctx.fill();
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // Grip ridges
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(jx + 4, jy + 1.5, 1, 4);
        ctx.fillRect(jx + 7, jy + 1.5, 1, 4);
      } else if (selectedVal === '3.3V') {
        // Bridges Pin 2 and Pin 3
        const shuntGrad = ctx.createLinearGradient(jx + 7.5, jy, jx + 7.5, jy + 7);
        shuntGrad.addColorStop(0, '#fdd835');
        shuntGrad.addColorStop(0.7, '#fbc02d');
        shuntGrad.addColorStop(1, '#f57f17');
        ctx.fillStyle = shuntGrad;
        roundRect(ctx, jx + 7.5, jy + 0.5, 10.5, 6, 1.2);
        ctx.fill();
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // Grip ridges
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(jx + 10.5, jy + 1.5, 1, 4);
        ctx.fillRect(jx + 13.5, jy + 1.5, 1, 4);
      } else {
        // OFF: parked on single pin leaving common disconnected
        ctx.fillStyle = '#fbc02d';
        roundRect(ctx, jx + 1, jy + 1, 4.5, 5, 0.8);
        ctx.fill();
      }

      // Silkscreen legends
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = 'bold 3.8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('5V   OFF   3V3', jx + 9.5, labelY);
    }

    drawJumperBlock(94, 18, topV, 14);
    drawJumperBlock(94, 71, botV, 85);

    // 9. Auxiliary 2x4 Header (3.3V, 5V, GND, GND)
    ctx.fillStyle = '#1c1c1c';
    roundRect(ctx, 94, 37, 18, 25, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    const auxLabels = ['3V3', '5V', 'GND', 'GND'];
    for (let r = 0; r < 4; r++) {
      const py = 41 + r * 5.7;
      for (let c = 0; c < 2; c++) {
        const px = 98 + c * 7;
        ctx.fillStyle = '#e5c158';
        ctx.fillRect(px - 1, py - 1, 2, 2);
        ctx.fillStyle = '#ffe082';
        ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
      }
      // Silkscreen label to the left of the header
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = 'bold 3.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(auxLabels[r], 93, py + 1.2);
    }

    // 10. Output Rail Wings (Breadboard Insert Header Pins)
    const railPins = [
      { label: '+', color: '#e53935', x: 148, y: 12 },
      { label: '-', color: '#1e88e5', x: 148, y: 22 },
      { label: '+', color: '#e53935', x: 148, y: 74 },
      { label: '-', color: '#1e88e5', x: 148, y: 84 },
    ];

    // Colored polarity stripes on the wings
    ctx.fillStyle = 'rgba(229, 57, 53, 0.25)';
    roundRect(ctx, 138, 8, 14, 8, 1); ctx.fill();
    ctx.fillStyle = 'rgba(30, 136, 229, 0.25)';
    roundRect(ctx, 138, 18, 14, 8, 1); ctx.fill();

    ctx.fillStyle = 'rgba(229, 57, 53, 0.25)';
    roundRect(ctx, 138, 70, 14, 8, 1); ctx.fill();
    ctx.fillStyle = 'rgba(30, 136, 229, 0.25)';
    roundRect(ctx, 138, 80, 14, 8, 1); ctx.fill();

    railPins.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(p.label, p.x - 7, p.y + 3);

      ctx.fillStyle = '#c5a044';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
    });

    // 11. Silkscreen Model & Live Status HUD
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 6px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MB-102', 124, 43);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 4px "JetBrains Mono", sans-serif';
    ctx.fillText('POWER MODULE', 124, 49);

    // Live Status badge
    if (isPowered) {
      if (isOverload) {
        ctx.fillStyle = '#ff3d00';
        ctx.font = 'bold 4px "JetBrains Mono", monospace';
        ctx.fillText('⚠️ OVERLOAD', 124, 56);
      } else {
        ctx.fillStyle = '#00e676';
        ctx.font = 'bold 4px "JetBrains Mono", monospace';
        const topText = topV === 'OFF' ? 'OFF' : topV;
        const botText = botV === 'OFF' ? 'OFF' : botV;
        ctx.fillText(`${topText} / ${botText}`, 124, 55);
        if (totalCurrent_mA > 0.5) {
          ctx.fillStyle = '#80d8ff';
          ctx.font = '3.5px "JetBrains Mono", monospace';
          ctx.fillText(`${totalCurrent_mA} mA`, 124, 61);
        }
      }
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = 'bold 4px "JetBrains Mono", monospace';
      ctx.fillText('OFFLINE', 124, 55);
    }

    if (inst.selected) drawSelectionRect(ctx, 0, 0, 160, 96);
    ctx.restore();
  }
});

/* -------------- Dual-Rail Benchtop DC Power Supply (5V/5A Fixed + ±0–32V/0–5A Split-Rail) ------------------ */
defComp({

  id: 'bench_power_supply',
  name: 'Benchtop Power Supply',
  category: 'Power',
  icon: '🎛️',
  desc: 'Dual-rail bench supply: fixed 5V/5A output plus adjustable split ±0–32V / 0–5A rails for op-amp circuits — POS=+V, NEG=−V, GND=0V center-tap',
  width: 310,
  height: 210,
  defaultProps: {
    powered: 1,
    outputEnabled: 1,
    voltageSet: 12.0,
    currentLimit: 2.5,
    actualCurrentPos: 0.0,
    actualCurrentNeg: 0.0,
    mode: 'CV',
    actualCurrent5V: 0.0,
  },
  interactive: [
    { field: 'powered', label: 'Power', type: 'toggle', min: 0, max: 1, step: 1, unit: '', inline: { x: 78, y: 148, w: 32, h: 42 } },
    { field: 'outputEnabled', label: 'Output', type: 'toggle', min: 0, max: 1, step: 1, unit: '', inline: { x: 26, y: 148, w: 32, h: 42 } },
    { field: 'voltageSet', label: 'Voltage (\u00b1)', min: 0.0, max: 32.0, step: 0.1, unit: 'V' },
    { field: 'currentLimit', label: 'Current (per rail)', min: 0.0, max: 5.0, step: 0.05, unit: 'A' },
  ],
  pins: [
    { id: 'VCC_5V', label: '5V', type: PIN_TYPE.POWER, x: 160, y: 182, side: 'bottom' },
    { id: 'GND_5V', label: '5V GND', type: PIN_TYPE.GND, x: 183, y: 182, side: 'bottom' },
    { id: 'POS', label: '+V', type: PIN_TYPE.POWER, x: 205, y: 182, side: 'bottom' },
    { id: 'GND', label: 'GND', type: PIN_TYPE.GND, x: 232, y: 182, side: 'bottom' },
    { id: 'NEG', label: '\u2212V', type: PIN_TYPE.POWER, x: 259, y: 182, side: 'bottom' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const isPowered = Boolean(inst.runtimeState?.powered ?? inst.props.powered ?? 1);
    const isOutOn = isPowered && Boolean(inst.runtimeState?.outputEnabled ?? inst.props.outputEnabled ?? 1);
    const vSet = Number(inst.runtimeState?.voltageSet ?? inst.props.voltageSet ?? 12.0);
    const iLim = Number(inst.runtimeState?.currentLimit ?? inst.props.currentLimit ?? 2.5);
    const iPos = isOutOn ? Number(inst.runtimeState?.actualCurrentPos ?? inst.props.actualCurrentPos ?? 0.0) : 0.0;
    const iNeg = isOutOn ? Number(inst.runtimeState?.actualCurrentNeg ?? inst.props.actualCurrentNeg ?? 0.0) : 0.0;
    const iAct5V = isPowered ? Number(inst.runtimeState?.actualCurrent5V ?? inst.props.actualCurrent5V ?? 0.0) : 0.0;
    const mode = inst.runtimeState?.mode ?? inst.props.mode ?? 'CV';
    const pOut = isOutOn ? vSet * (iPos + iNeg) : 0.0;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#1c2024';
    roundRect(ctx, 0, 0, 310, 210, 8);
    ctx.fill();

    const panelGrad = ctx.createLinearGradient(0, 4, 0, 206);
    panelGrad.addColorStop(0, '#32383e');
    panelGrad.addColorStop(0.3, '#262b30');
    panelGrad.addColorStop(1, '#1e2226');
    ctx.fillStyle = panelGrad;
    roundRect(ctx, 4, 4, 302, 202, 6);
    ctx.fill();

    ctx.fillStyle = '#0f1214';
    roundRect(ctx, 8, 2, 26, 4, 1); ctx.fill();
    roundRect(ctx, 276, 2, 26, 4, 1); ctx.fill();
    roundRect(ctx, 8, 204, 26, 4, 1); ctx.fill();
    roundRect(ctx, 276, 204, 26, 4, 1); ctx.fill();

    ctx.fillStyle = '#eceff1';
    ctx.font = 'bold 9px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DC POWER SUPPLY', 14, 18);

    ctx.fillStyle = '#78909c';
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.fillText('DPS-SPLIT PRO \u00b7 5V/5A + \u00b132V/5A', 14, 28);

    ctx.fillStyle = '#121518';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(230 + i * 16, 14, 11, 2.5);
    }

    ctx.fillStyle = '#0a0d0f';
    roundRect(ctx, 12, 34, 160, 112, 4);
    ctx.fill();
    ctx.strokeStyle = '#455a64';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isPowered) {
      ctx.textAlign = 'right';

      ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText('+88.8', 115, 56);
      ctx.fillStyle = 'rgba(255, 80, 80, 0.06)';
      ctx.fillText('\u221288.8', 115, 78);
      ctx.fillStyle = 'rgba(0, 230, 118, 0.06)';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('8.888', 98, 98);
      ctx.fillStyle = 'rgba(255, 171, 0, 0.06)';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText('888.8', 115, 118);
      ctx.fillStyle = 'rgba(255, 171, 0, 0.06)';
      ctx.fillText('888.8', 115, 138);

      ctx.fillStyle = isOutOn ? '#00e5ff' : '#0097a7';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText('+' + vSet.toFixed(1), 115, 56);

      ctx.fillStyle = isOutOn ? '#ff5252' : '#7f1d1d';
      ctx.fillText('\u2212' + vSet.toFixed(1), 115, 78);

      ctx.fillStyle = isOutOn ? '#00e676' : '#2e7d32';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('+' + iPos.toFixed(2) + '/' + '\u2212' + iNeg.toFixed(2), 115, 98);

      ctx.fillStyle = isOutOn ? '#ffab00' : '#c67c00';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText(pOut.toFixed(1).padStart(5, '0'), 115, 118);

      ctx.fillStyle = '#78909c';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('5V:', 36, 136);
      ctx.fillStyle = isPowered ? '#ff9100' : '#5d4037';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(iAct5V.toFixed(2) + 'A', 58, 136);

      ctx.font = 'bold 11px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#00e5ff'; ctx.fillText('V+', 122, 54);
      ctx.fillStyle = '#ff5252'; ctx.fillText('V\u2212', 122, 76);
      ctx.fillStyle = '#00e676'; ctx.fillText('A', 122, 96);
      ctx.font = 'bold 9px "JetBrains Mono", sans-serif';
      ctx.fillStyle = '#ffab00'; ctx.fillText('W', 122, 117);

      const isCV = mode === 'CV' && isOutOn;
      ctx.fillStyle = isCV ? '#00e676' : '#1b3a24';
      ctx.beginPath(); ctx.arc(148, 44, 3, 0, Math.PI * 2); ctx.fill();
      if (isCV) { ctx.fillStyle = 'rgba(0, 230, 118, 0.4)'; ctx.beginPath(); ctx.arc(148, 44, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = 'bold 6.5px "JetBrains Mono", sans-serif';
      ctx.fillStyle = isCV ? '#ffffff' : '#546e7a';
      ctx.fillText('CV', 154, 46);

      const isCC = mode === 'CC' && isOutOn;
      ctx.fillStyle = isCC ? '#ff1744' : '#3a141a';
      ctx.beginPath(); ctx.arc(148, 58, 3, 0, Math.PI * 2); ctx.fill();
      if (isCC) { ctx.fillStyle = 'rgba(255, 23, 68, 0.4)'; ctx.beginPath(); ctx.arc(148, 58, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = isCC ? '#ffffff' : '#546e7a';
      ctx.fillText('CC', 154, 60);

      ctx.fillStyle = isOutOn ? '#29b6f6' : '#132836';
      ctx.beginPath(); ctx.arc(148, 72, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isOutOn ? '#ffffff' : '#546e7a';
      ctx.fillText('ON', 154, 74);
    } else {
      ctx.fillStyle = '#1a2327';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('\u2014 STANDBY \u2014', 92, 90);
    }

    function drawRotaryKnob(kx, ky, label, valueText, accentColor) {
      ctx.fillStyle = '#181b1e';
      ctx.beginPath(); ctx.arc(kx, ky, 19, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 1;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(a) * 16, ky + Math.sin(a) * 16);
        ctx.lineTo(kx + Math.cos(a) * 19, ky + Math.sin(a) * 19);
        ctx.stroke();
      }

      const knobGrad = ctx.createRadialGradient(kx - 4, ky - 4, 1, kx, ky, 15);
      knobGrad.addColorStop(0, '#cfd8dc');
      knobGrad.addColorStop(0.5, '#90a4ae');
      knobGrad.addColorStop(1, '#455a64');
      ctx.fillStyle = knobGrad;
      ctx.beginPath(); ctx.arc(kx, ky, 15, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = accentColor;
      ctx.beginPath(); ctx.arc(kx + 9, ky - 6, 2, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#b0bec5';
      ctx.font = 'bold 7.5px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, kx, ky + 28);

      ctx.fillStyle = accentColor;
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      ctx.fillText(valueText, kx, ky - 23);
    }

    drawRotaryKnob(240, 56, 'VOLTAGE', '\u00b1' + vSet.toFixed(1) + 'V', '#00e5ff');
    drawRotaryKnob(240, 116, 'CURRENT', iLim.toFixed(2) + 'A', '#00e676');

    function drawToggleSwitch(tx, ty, tw, th, isOn, label) {
      ctx.fillStyle = '#0e1114';
      roundRect(ctx, tx, ty, tw, th, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,90,100,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const trackW = tw * 0.7;
      const trackH = 8;
      const trackX = tx + (tw - trackW) / 2;
      const trackY = ty + th / 2 - 2;
      ctx.fillStyle = '#080a0c';
      roundRect(ctx, trackX, trackY, trackW, trackH, trackH / 2);
      ctx.fill();

      if (isOn) {
        const grad = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
        grad.addColorStop(0, 'rgba(0,230,118,0.2)');
        grad.addColorStop(1, 'rgba(0,230,118,0.65)');
        ctx.fillStyle = grad;
        roundRect(ctx, trackX, trackY, trackW, trackH, trackH / 2);
        ctx.fill();
      }

      const thumbR = 5;
      const thumbX = isOn ? trackX + trackW - thumbR - 1 : trackX + thumbR + 1;
      const thumbY = trackY + trackH / 2;
      if (isFinite(thumbX) && isFinite(thumbY)) {
        const thumbGrad = ctx.createRadialGradient(thumbX - 1, thumbY - 1, 0.5, thumbX, thumbY, thumbR);
        thumbGrad.addColorStop(0, isOn ? '#c8e6c9' : '#b0bec5');
        thumbGrad.addColorStop(1, isOn ? '#2e7d32' : '#546e7a');
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
      ctx.fillStyle = isOn ? '#00e676' : '#1b3a24';
      ctx.beginPath(); ctx.arc(ledX, ledY, 2, 0, Math.PI * 2); ctx.fill();
      if (isOn) {
        ctx.fillStyle = 'rgba(0,230,118,0.3)';
        ctx.beginPath(); ctx.arc(ledX, ledY, 4.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = isOn ? '#eceff1' : '#78909c';
      ctx.font = 'bold 5.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, tx + tw / 2, ty + th - 3);
    }

    drawToggleSwitch(78, 148, 32, 42, isPowered, 'POWER');
    drawToggleSwitch(26, 148, 32, 42, isOutOn, 'OUTPUT');

    function drawBindingPost(bx, by, colorHex, rimColor, symbol, label) {
      ctx.fillStyle = '#14181b';
      ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();

      const postGrad = ctx.createRadialGradient(bx - 3, by - 3, 2, bx, by, 9);
      postGrad.addColorStop(0, rimColor);
      postGrad.addColorStop(0.7, colorHex);
      postGrad.addColorStop(1, '#0d1012');
      ctx.fillStyle = postGrad;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#d4af37';
      ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#08080a';
      ctx.beginPath(); ctx.arc(bx, by, 2.8, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#eceff1';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(symbol, bx, by + 3);

      ctx.fillStyle = '#78909c';
      ctx.font = 'bold 6px "JetBrains Mono", sans-serif';
      ctx.fillText(label, bx, by - 15);
    }

    ctx.fillStyle = '#546e7a';
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIXED 5V/5A', 171, 147);
    ctx.fillText('SPLIT RAIL \u00b132V/5A', 232, 147);

    drawBindingPost(160, 166, '#ff6d00', '#ffab40', '5V', '5V');
    drawBindingPost(183, 166, '#2e7d32', '#66bb6a', '\u2300', '5VGND');
    drawBindingPost(205, 166, '#d50000', '#ff5252', '+', '+V');
    drawBindingPost(232, 166, '#2e7d32', '#00e676', '\u2300', 'GND');
    drawBindingPost(259, 166, '#1565c0', '#42a5f5', '\u2212', '\u2212V');

    if (inst.selected) drawSelectionRect(ctx, -2, -2, 314, 214);
    ctx.restore();
  }
});

