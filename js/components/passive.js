/*
 * components/passive.js — Passive component definitions
 */

'use strict';
/* -------------------- RESISTOR -------------------------- */
defComp({
  id: 'resistor',
  name: 'Resistor',
  category: 'Passive',
  icon: '⬛',
  desc: 'Fixed value resistor with color band marking',
  width: 20,
  height: 60,
  defaultProps: { value: 220, unit: 'Ω' },
  interactive: [
    {
      field: 'unit', label: 'Unit', type: 'select', options: [
        { value: 'Ω', label: 'Ω (Ohm)' },
        { value: 'kΩ', label: 'kΩ (kiloohm)' },
        { value: 'MΩ', label: 'MΩ (megaohm)' },
      ]
    },
  ],
  pins: [
    { id: 'p1', label: '1', type: PIN_TYPE.SIGNAL, x: 10, y: 0, side: 'top' },
    { id: 'p2', label: '2', type: PIN_TYPE.SIGNAL, x: 10, y: 60, side: 'bottom' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const val = inst.props.value || 220;
    // Bands encode ohms, so scale by the selected unit (Ω / kΩ / MΩ)
    const ohms = val
      * (inst.props.unit === 'kΩ' ? 1e3 : inst.props.unit === 'MΩ' ? 1e6 : 1);
    const bands = resistorBands(ohms);

    ctx.save();
    ctx.translate(x, y);

    // Lead wires
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 44); ctx.lineTo(10, 60); ctx.stroke();

    // Body
    ctx.fillStyle = '#d4c4a0';
    roundRect(ctx, 2, 16, 16, 28, 3);
    ctx.fill();
    ctx.strokeStyle = '#b0a080';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Color bands
    const bandX = [5, 9, 13, 17];
    const bandColors = [...bands, '#c0a040'];
    bandColors.forEach((col, i) => {
      if (i >= 4) return;
      ctx.fillStyle = col;
      ctx.fillRect(bandX[i], 16, 3, 28);
    });

    // Tolerance band (last)
    ctx.fillStyle = '#c0a040';
    ctx.fillRect(17, 20, 3, 20);

    // Value label
    ctx.fillStyle = '#555';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(10, 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 6px sans-serif';
    ctx.fillText(formatResistance(val, inst.props.unit), 0, 2);
    ctx.restore();

    if (inst.selected) drawSelectionRect(ctx, -3, -3, 26, 66);
    ctx.restore();
  }
});

/*----------------------Capacitor ----------------------------- */
defComp({
  id: 'capacitor',
  name: 'Capacitor',
  category: 'Passive',
  icon: '⚡',
  desc: 'Electrolytic capacitor — stores electrical charge between two plates',
  width: 20,
  height: 60,
  defaultProps: { value: 100, unit: 'µF' },
  interactive: [
    {
      field: 'unit', label: 'Unit', type: 'select', options: [
        { value: 'mF', label: 'mF (millifarad)' },
        { value: 'µF', label: 'µF (microfarad)' },
        { value: 'nF', label: 'nF (nanofarad)' },
        { value: 'pF', label: 'pF (picofarad)' },
      ]
    },
  ],
  pins: [
    { id: 'pos', label: '+', type: PIN_TYPE.SIGNAL, x: 10, y: 0, side: 'top' },
    { id: 'neg', label: '−', type: PIN_TYPE.GND, x: 10, y: 60, side: 'bottom' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    ctx.save();
    ctx.translate(x, y);
    // Leads
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 38); ctx.lineTo(10, 60); ctx.stroke();
    // Plates
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(2, 22); ctx.lineTo(18, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 30); ctx.lineTo(18, 30); ctx.stroke();
    // + mark
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('+', 4, 22);
    // Body curve
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(10, 30, 8, 0, Math.PI);
    ctx.stroke();
    // Value
    ctx.fillStyle = '#888'; ctx.font = '6px sans-serif';
    ctx.save(); ctx.translate(10, 34); ctx.rotate(-Math.PI / 2);
    ctx.fillText((inst.props.value || 100) + (inst.props.unit || 'µF'), 0, 2);
    ctx.restore();
    if (inst.selected) drawSelectionRect(ctx, -3, -3, 26, 66);
    ctx.restore();
  }
});

/* -------- BREADBOARD (Realistic Half-Size / 400 Tie-Points) ----------- */
function _genBreadboardPins({ cols, startX, width, upperRowsY, lowerRowsY, railCount, railGroupSize, railStartX, railOffset, railStep, railRowsY }) {
  const pins = [];
  const stepX = (width - startX * 2) / (cols - 1);
  const rowLabelsUpper = ['a', 'b', 'c', 'd', 'e'];
  const rowLabelsLower = ['f', 'g', 'h', 'i', 'j'];

  for (let c = 0; c < cols; c++) {
    const hx = Math.round(startX + c * stepX);
    const n = c + 1;
    for (let row = 0; row < 5; row++) {
      const upperId = row === 0 ? `ut${n}` : row === 4 ? `ub${n}` : `um${row}${n}`;
      const lowerId = row === 0 ? `lt${n}` : row === 4 ? `lb${n}` : `lm${row}${n}`;
      pins.push({ id: upperId, label: `${n}${rowLabelsUpper[row]}`, type: PIN_TYPE.SIGNAL, x: hx, y: upperRowsY[row], side: 'top' });
      pins.push({ id: lowerId, label: `${n}${rowLabelsLower[row]}`, type: PIN_TYPE.SIGNAL, x: hx, y: lowerRowsY[row], side: 'bottom' });
    }
  }

  const railIds = ['rp', 'rn', 'bp', 'bn'];
  const railTypes = [PIN_TYPE.POWER, PIN_TYPE.GND, PIN_TYPE.POWER, PIN_TYPE.GND];
  for (let i = 0; i < railCount; i++) {
    const hx = railStartX + i * railStep + Math.floor(i / railGroupSize) * railOffset;
    for (let rail = 0; rail < railIds.length; rail++) {
      const id = i === 0 ? railIds[rail] : `${railIds[rail]}${i + 1}`;
      pins.push({ id, label: railTypes[rail] === PIN_TYPE.POWER ? '+' : '-', type: railTypes[rail], x: hx, y: railRowsY[rail], side: rail < 2 ? 'top' : 'bottom' });
    }
  }
  return pins;
}

function _breadboardGetGroup(pinId) {
  const railMatch = /^(rp|rn|bp|bn)\d*$/.exec(pinId);
  if (railMatch) return { rp: 'rail_tp', rn: 'rail_tn', bp: 'rail_bp', bn: 'rail_bn' }[railMatch[1]];
  const m = pinId.match(/^([ul])([tb])(\d+)$/);
  if (m) return m[1] + m[3];
  const middle = /^([ul])m[123](\d+)$/.exec(pinId);
  if (middle) return middle[1] + middle[2];
  return null;
}
window._breadboardGetGroup = _breadboardGetGroup;

/* ════════════════ Small Breadboard (16-column) ════════════════ */
function _genSmallBreadboardPins() {
  const W = 320, H = 170;
  return _genBreadboardPins({
    cols: 16, startX: 36, width: W,
    upperRowsY: [45, 56, 67, 78, 90],
    lowerRowsY: [102, 113, 124, 135, 147],
    railCount: 12, railGroupSize: 4, railStartX: 38, railOffset: 6, railStep: (W - 90) / 11,
    railRowsY: [14, 24, H - 24, H - 14],
  });
}

defComp({
  id: 'breadboard_small',
  name: 'Breadboard (Small)',
  category: 'Passive',
  icon: '🟦',
  desc: '170 tie-point mini breadboard — 16 columns × 2 halves (upper a–e, lower f–j) + 4 power rails. Ideal for DIP IC circuits',
  width: 320,
  height: 170,
  defaultProps: {},
  hidePinLabels: true,
  pins: _genSmallBreadboardPins(),
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const W = 320, H = 170;
    ctx.save();
    ctx.translate(x, y);

    // 1. Base Housing
    ctx.fillStyle = '#dfdbd0';
    roundRect(ctx, 0, 0, W, H, 6);
    ctx.fill();
    const bodyGrad = ctx.createLinearGradient(0, 0, 0, H);
    bodyGrad.addColorStop(0, '#fcfbfa');
    bodyGrad.addColorStop(0.5, '#f4f1ea');
    bodyGrad.addColorStop(1, '#ebe6dc');
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, 2, 2, W - 4, H - 4, 5);
    ctx.fill();
    ctx.strokeStyle = '#c4bfb2'; ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 6); ctx.stroke();

    // Side tabs
    ctx.fillStyle = '#d4cfc2';
    roundRect(ctx, -2, H / 2 - 10, 3, 20, 2); ctx.fill();
    roundRect(ctx, W - 1, H / 2 - 10, 3, 20, 2); ctx.fill();

    // 2. Center DIP Trough
    const midY = H / 2;
    const grooveH = 10;
    const grooveGrad = ctx.createLinearGradient(0, midY - grooveH / 2, 0, midY + grooveH / 2);
    grooveGrad.addColorStop(0, '#b8b4a6');
    grooveGrad.addColorStop(0.25, '#d3cfc3');
    grooveGrad.addColorStop(0.75, '#e8e5dc');
    grooveGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grooveGrad;
    ctx.fillRect(12, midY - grooveH / 2, W - 24, grooveH);

    // 3. Power Rail Stripes
    const railX1 = 28, railX2 = W - 28;
    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(railX1, 10); ctx.lineTo(railX2, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(railX1, H - 10); ctx.lineTo(railX2, H - 10); ctx.stroke();
    ctx.strokeStyle = '#1e88e5';
    ctx.beginPath(); ctx.moveTo(railX1, 28); ctx.lineTo(railX2, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(railX1, H - 28); ctx.lineTo(railX2, H - 28); ctx.stroke();

    // Polarity glyphs
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e53935';
    ctx.fillText('+', 18, 10); ctx.fillText('+', W - 18, 10);
    ctx.fillText('+', 18, H - 10); ctx.fillText('+', W - 18, H - 10);
    ctx.fillStyle = '#1e88e5';
    ctx.fillText('−', 18, 28); ctx.fillText('−', W - 18, 28);
    ctx.fillText('−', 18, H - 28); ctx.fillText('−', W - 18, H - 28);

    // 4. Tie-Hole Renderer
    function drawTieHole(hx, hy) {
      ctx.fillStyle = '#dcd7cc';
      ctx.fillRect(hx - 3, hy - 3, 6, 6);
      ctx.fillStyle = '#181715';
      ctx.fillRect(hx - 2, hy - 2, 4, 4);
      ctx.fillStyle = '#52504a';
      ctx.fillRect(hx - 1, hy - 0.8, 2, 1.6);
    }

    // 5. 16-Column Grid
    const cols = 16, startX = 36, stepX = (W - 72) / (cols - 1);
    const upperRowsY = [45, 56, 67, 78, 90];
    const lowerRowsY = [102, 113, 124, 135, 147];
    const rowLabelsUpper = ['a', 'b', 'c', 'd', 'e'];
    const rowLabelsLower = ['f', 'g', 'h', 'i', 'j'];

    ctx.fillStyle = '#7a766c';
    ctx.font = 'bold 8px "JetBrains Mono", sans-serif';
    for (let r = 0; r < 5; r++) {
      ctx.fillText(rowLabelsUpper[r], 18, upperRowsY[r]);
      ctx.fillText(rowLabelsUpper[r], W - 18, upperRowsY[r]);
      ctx.fillText(rowLabelsLower[r], 18, lowerRowsY[r]);
      ctx.fillText(rowLabelsLower[r], W - 18, lowerRowsY[r]);
    }

    for (let col = 0; col < cols; col++) {
      const hx = startX + col * stepX;
      const colNum = col + 1;
      if (colNum === 1 || colNum % 5 === 0 || colNum === cols) {
        ctx.fillStyle = '#666157';
        ctx.font = 'bold 7.5px "JetBrains Mono", sans-serif';
        ctx.fillText(colNum.toString(), hx, 36);
        ctx.fillText(colNum.toString(), hx, H - 36);
      }
      for (let r = 0; r < 5; r++) drawTieHole(hx, upperRowsY[r]);
      for (let r = 0; r < 5; r++) drawTieHole(hx, lowerRowsY[r]);
    }

    // 6. Power Rail Sockets (12-hole grouped arrays)
    for (let i = 0; i < 12; i++) {
      const groupOffset = Math.floor(i / 4) * 6;
      const hx = 38 + i * ((W - 90) / 11) + groupOffset;
      drawTieHole(hx, 14);
      drawTieHole(hx, 24);
      drawTieHole(hx, H - 24);
      drawTieHole(hx, H - 14);
    }

    if (inst.selected) drawSelectionRect(ctx, -4, -4, W + 8, H + 8);
    ctx.restore();
  }
});

defComp({
  id: 'breadboard',
  name: 'Breadboard',
  category: 'Passive',
  icon: '🟦',
  desc: '400 tie-point solderless breadboard — 30 columns × 2 halves (upper a–e, lower f–j) + 4 power rails',
  width: 580,
  height: 220,
  defaultProps: {},
  hidePinLabels: true,
  pins: _genBreadboardPins({
    cols: 30, startX: 42, width: 580,
    upperRowsY: [55, 68, 81, 94, 107],
    lowerRowsY: [123, 136, 149, 162, 175],
    railCount: 25, railGroupSize: 5, railStartX: 45, railOffset: 8, railStep: (580 - 122) / 24,
    railRowsY: [19, 31, 220 - 31, 220 - 19],
  }),
  draw(ctx, inst, sim) {
    const { x, y, width: W, height: H } = inst;
    ctx.save();
    ctx.translate(x, y);

    // 1. Base Housing & Bevel
    ctx.fillStyle = '#dfdbd0';
    roundRect(ctx, 0, 0, W, H, 8);
    ctx.fill();

    // Top surface (molded ABS off-white plastic)
    const bodyGrad = ctx.createLinearGradient(0, 0, 0, H);
    bodyGrad.addColorStop(0, '#fcfbfa');
    bodyGrad.addColorStop(0.5, '#f4f1ea');
    bodyGrad.addColorStop(1, '#ebe6dc');
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, 2, 2, W - 4, H - 4, 6);
    ctx.fill();

    // Exterior border rim
    ctx.strokeStyle = '#c4bfb2';
    ctx.lineWidth = 1.2;
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 8);
    ctx.stroke();

    // Side Interlocking Tabs & Notches
    ctx.fillStyle = '#d4cfc2';
    roundRect(ctx, -2, H / 2 - 14, 4, 28, 2);
    ctx.fill();
    roundRect(ctx, W - 2, H / 2 - 14, 4, 28, 2);
    ctx.fill();

    // 2. Center DIP Isolation Trough (IC Divider Canal)
    const midY = H / 2;
    const grooveH = 12;
    const grooveGrad = ctx.createLinearGradient(0, midY - grooveH / 2, 0, midY + grooveH / 2);
    grooveGrad.addColorStop(0, '#b8b4a6');
    grooveGrad.addColorStop(0.25, '#d3cfc3');
    grooveGrad.addColorStop(0.75, '#e8e5dc');
    grooveGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grooveGrad;
    ctx.fillRect(16, midY - grooveH / 2, W - 32, grooveH);

    // 3. Power Rail Stripes & Polarity Indicators
    const railX1 = 34;
    const railX2 = W - 34;

    // Top Rails (+ Red, - Blue)
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(railX1, 13);
    ctx.lineTo(railX2, 13);
    ctx.stroke();

    ctx.strokeStyle = '#1e88e5';
    ctx.beginPath();
    ctx.moveTo(railX1, 37);
    ctx.lineTo(railX2, 37);
    ctx.stroke();

    // Bottom Rails (+ Red, - Blue)
    ctx.strokeStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(railX1, H - 37);
    ctx.lineTo(railX2, H - 37);
    ctx.stroke();

    ctx.strokeStyle = '#1e88e5';
    ctx.beginPath();
    ctx.moveTo(railX1, H - 13);
    ctx.lineTo(railX2, H - 13);
    ctx.stroke();

    // Polarity Glyphs
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#e53935';
    ctx.fillText('+', 22, 13);
    ctx.fillText('+', W - 22, 13);
    ctx.fillText('+', 22, H - 37);
    ctx.fillText('+', W - 22, H - 37);

    ctx.fillStyle = '#1e88e5';
    ctx.fillText('−', 22, 37);
    ctx.fillText('−', W - 22, 37);
    ctx.fillText('−', 22, H - 13);
    ctx.fillText('−', W - 22, H - 13);

    // 4. Spring Contact Tie-Hole Renderer
    function drawTieHole(hx, hy) {
      // Cavity Bevel
      ctx.fillStyle = '#dcd7cc';
      ctx.fillRect(hx - 3.5, hy - 3.5, 7, 7);

      // Dark Interior Well
      ctx.fillStyle = '#181715';
      ctx.fillRect(hx - 2.5, hy - 2.5, 5, 5);

      // Nickel-Plated Spring Clip Reflection
      ctx.fillStyle = '#52504a';
      ctx.fillRect(hx - 1.5, hy - 1, 3, 2);
    }

    // 5. 30 Pin Columns & Matrix Grid
    const cols = 30;
    const startX = 42;
    const stepX = (W - 84) / (cols - 1);

    const upperRowsY = [55, 68, 81, 94, 107];
    const lowerRowsY = [123, 136, 149, 162, 175];
    const rowLabelsUpper = ['a', 'b', 'c', 'd', 'e'];
    const rowLabelsLower = ['f', 'g', 'h', 'i', 'j'];

    // Silkscreen Row Coordinates
    ctx.fillStyle = '#7a766c';
    ctx.font = 'bold 9px "JetBrains Mono", sans-serif';

    for (let r = 0; r < 5; r++) {
      ctx.fillText(rowLabelsUpper[r], 24, upperRowsY[r]);
      ctx.fillText(rowLabelsUpper[r], W - 24, upperRowsY[r]);
      ctx.fillText(rowLabelsLower[r], 24, lowerRowsY[r]);
      ctx.fillText(rowLabelsLower[r], W - 24, lowerRowsY[r]);
    }

    // Column Indicators & Terminals
    for (let col = 0; col < cols; col++) {
      const hx = startX + col * stepX;
      const colNum = col + 1;

      if (colNum === 1 || colNum % 5 === 0) {
        ctx.fillStyle = '#666157';
        ctx.font = 'bold 8.5px "JetBrains Mono", sans-serif';
        ctx.fillText(colNum.toString(), hx, 46);
        ctx.fillText(colNum.toString(), hx, H - 46);
      }

      // Upper rows (a–e)
      for (let r = 0; r < 5; r++) drawTieHole(hx, upperRowsY[r]);

      // Lower rows (f–j)
      for (let r = 0; r < 5; r++) drawTieHole(hx, lowerRowsY[r]);
    }

    // 6. Power Distribution Bus Sockets (5-hole grouped arrays)
    for (let i = 0; i < 25; i++) {
      const groupOffset = Math.floor(i / 5) * 8;
      const hx = 45 + i * ((W - 122) / 24) + groupOffset;

      drawTieHole(hx, 19);
      drawTieHole(hx, 31);
      drawTieHole(hx, H - 31);
      drawTieHole(hx, H - 19);
    }

    if (inst.selected) drawSelectionRect(ctx, -4, -4, W + 8, H + 8);
    ctx.restore();
  }
});

/*-----------------------diode_1n4007---------------------- */
defComp({
  id: 'diode_1n4007',
  name: '1N4007 Diode',
  category: 'Passive',
  icon: '',
  desc: 'General-purpose rectifier diode. 1A forward current, 1000V reverse voltage. 0.7V forward drop',
  width: 40,
  height: 14,
  defaultProps: {},
  interactive: [],
  pins: [
    { id: 'anode', label: 'A', type: PIN_TYPE.SIGNAL, x: 4, y: 14, side: 'bottom' },
    { id: 'cathode', label: 'K', type: PIN_TYPE.SIGNAL, x: 36, y: 14, side: 'bottom' },
  ],
  draw(ctx, inst, sim) {
    const { x, y } = inst;
    const rs = inst.runtimeState || {};
    const conducting = rs.conducting || false;
    ctx.save();
    ctx.translate(x, y);

    // Body
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 8, 2, 24, 10, 2);
    ctx.fill();

    // Cathode band
    ctx.fillStyle = '#888';
    ctx.fillRect(26, 2, 3, 10);

    // Diode symbol (triangle + bar)
    ctx.fillStyle = conducting ? '#00cc66' : '#555';
    ctx.beginPath();
    ctx.moveTo(12, 7);
    ctx.lineTo(22, 3);
    ctx.lineTo(22, 11);
    ctx.closePath();
    ctx.fill();

    // Cathode bar
    ctx.strokeStyle = conducting ? '#00cc66' : '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 3);
    ctx.lineTo(22, 11);
    ctx.stroke();

    // Arrow direction
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 7);
    ctx.lineTo(18, 7);
    ctx.lineTo(16, 5);
    ctx.moveTo(18, 7);
    ctx.lineTo(16, 9);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#aaa';
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('1N4007', 18, 8);

    // Wire leads
    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(4, 7); ctx.lineTo(8, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, 7); ctx.lineTo(36, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 7); ctx.lineTo(4, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(36, 7); ctx.lineTo(36, 14); ctx.stroke();

    if (inst.selected) drawSelectionRect(ctx, 0, 0, 40, 14);
    ctx.restore();
  }
});

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
if (typeof window !== 'undefined') window.BJT_MODELS = BJT_MODELS;

function drawTransistor(ctx, inst, polarity) {
  const { x, y } = inst;
  const rs = inst.runtimeState || {};
  const region = rs.region || (rs.conducting ? 'active' : 'cutoff');

  let strokeColor = '#64748b';
  let glowColor = null;
  let badgeText = 'OFF';
  if (region === 'saturation') {
    strokeColor = '#22c55e';
    glowColor = 'rgba(34, 197, 94, 0.2)';
    badgeText = 'SAT';
  } else if (region === 'active') {
    strokeColor = '#38bdf8';
    glowColor = 'rgba(56, 189, 248, 0.2)';
    badgeText = 'ACT';
  }

  ctx.save();
  ctx.translate(x, y);

  // Background operating glow
  if (glowColor) {
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(24, 25, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Terminal leads
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 25); ctx.lineTo(17, 25);
  ctx.moveTo(23, 19); ctx.lineTo(40, 8); ctx.lineTo(48, 0);
  ctx.moveTo(23, 31); ctx.lineTo(40, 42); ctx.lineTo(48, 50);
  ctx.stroke();

  // Transistor can/circle
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(24, 25, 16, 0, Math.PI * 2);
  ctx.stroke();

  // Base bar
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 17); ctx.lineTo(20, 33);
  ctx.moveTo(17, 25); ctx.lineTo(20, 25);
  ctx.stroke();

  // The emitter arrow points out for NPN and into the base for PNP.
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  if (polarity === 'npn') {
    ctx.moveTo(37, 39); ctx.lineTo(43, 45); ctx.lineTo(35, 44);
  } else {
    ctx.moveTo(29, 33); ctx.lineTo(35, 34); ctx.lineTo(30, 39);
  }
  ctx.closePath();
  ctx.fill();

  // Terminal Pin labels
  ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('B', 4, 21);
  ctx.fillText('C', 38, 7);
  ctx.fillText('E', 38, 49);

  // Model & State labels
  const modelName = inst.props?.model || (polarity === 'npn' ? '2N2222' : '2N3906');
  ctx.font = 'bold 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(modelName, 0, 61);
  ctx.fillStyle = strokeColor;
  ctx.fillText('[' + badgeText + ']', 34, 61);

  if (inst.selected) drawSelectionRect(ctx, -3, -3, 56, 68);
  ctx.restore();
}

for (const polarity of ['npn', 'pnp']) {
  const isNPN = polarity === 'npn';
  const defaultModel = isNPN ? '2N2222' : '2N3906';
  const preset = BJT_MODELS[defaultModel];

  defComp({
    id: `${polarity}_transistor`,
    name: `${polarity.toUpperCase()} Transistor`,
    category: 'Passive',
    icon: polarity.toUpperCase(),
    desc: `${polarity.toUpperCase()} bipolar junction transistor (BJT) with cutoff, active, and saturation characteristics`,
    search: `${polarity} bjt transistor 2n2222 bc547 2n3904 2n3906 tip31c`,
    width: 48,
    height: 50,
    defaultProps: {
      model: defaultModel,
      beta: preset.beta,
      vbe_on: preset.vbe_on,
      vce_sat: preset.vce_sat,
      early_voltage: preset.early_voltage,
    },
    interactive: [
      {
        field: 'model', label: 'BJT Model Preset', type: 'select',
        options: isNPN ? [
          { value: '2N2222', label: '2N2222 (General Purpose, β=160)' },
          { value: 'BC547',  label: 'BC547 (Low Noise Audio, β=250)' },
          { value: '2N3904', label: '2N3904 (Switching NPN, β=100)' },
          { value: 'TIP31C', label: 'TIP31C (Power NPN, 3A, β=40)' },
          { value: 'custom', label: 'Custom BJT Parameters' },
        ] : [
          { value: '2N3906', label: '2N3906 (General Purpose, β=100)' },
          { value: '2N2907', label: '2N2907 (Switching PNP, β=160)' },
          { value: 'BC557',  label: 'BC557 (Audio / Low Noise, β=250)' },
          { value: 'TIP32C', label: 'TIP32C (Power PNP, 3A, β=40)' },
          { value: 'custom', label: 'Custom BJT Parameters' },
        ],
      },
      { field: 'beta', label: 'Current Gain (β / hFE)', type: 'number', min: 10, max: 1000, step: 5 },
      { field: 'vbe_on', label: 'Base-Emitter Drop Vbe(on) [V]', type: 'number', min: 0.2, max: 1.5, step: 0.01 },
      { field: 'vce_sat', label: 'Saturation Voltage Vce(sat) [V]', type: 'number', min: 0.05, max: 1.0, step: 0.01 },
      { field: 'early_voltage', label: 'Early Voltage VA [V]', type: 'number', min: 20, max: 500, step: 5 },
    ],
    contextMenu: [
      {
        label: 'View Characteristics (IV Curves)',
        icon: '📈',
        action: (inst) => {
          if (window.TransistorCurvesModal) {
            window.TransistorCurvesModal.open(inst);
          } else if (window.App?.openTransistorCurves) {
            window.App.openTransistorCurves(inst);
          }
        },
      },
    ],
    pins: [
      { id: 'base', label: 'B', type: PIN_TYPE.SIGNAL, x: 0, y: 25, side: 'left' },
      { id: 'collector', label: 'C', type: PIN_TYPE.SIGNAL, x: 48, y: 0, side: 'top' },
      { id: 'emitter', label: 'E', type: PIN_TYPE.SIGNAL, x: 48, y: 50, side: 'bottom' },
    ],
    draw(ctx, inst) {
      drawTransistor(ctx, inst, polarity);
    },
  });
}

/* ==========================================================================
   MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor)
   N-Channel and P-Channel Enhancement Mode
   ========================================================================== */

const MOSFET_MODELS = {
  // N-Channel Enhancement MOSFETs
  '2N7000':  { name: '2N7000',  channel: 'n', vth: 2.1, rds_on: 1.2, kn: 0.1,  vds_max: 60,  id_max: 0.2,  lambda: 0.01,  desc: 'Small-Signal N-MOSFET (60V, 200mA)' },
  'IRF540N': { name: 'IRF540N', channel: 'n', vth: 3.0, rds_on: 0.044, kn: 5.0, vds_max: 100, id_max: 33.0, lambda: 0.005, desc: 'Power N-MOSFET (100V, 33A, 44mΩ)' },
  'BS170':   { name: 'BS170',   channel: 'n', vth: 2.0, rds_on: 1.8, kn: 0.12, vds_max: 60,  id_max: 0.5,  lambda: 0.01,  desc: 'Small-Signal Switching N-MOSFET (60V, 500mA)' },
  'IRFZ44N': { name: 'IRFZ44N', channel: 'n', vth: 2.5, rds_on: 0.0175, kn: 8.0, vds_max: 55, id_max: 49.0, lambda: 0.005, desc: 'High-Current Power N-MOSFET (55V, 49A)' },

  // P-Channel Enhancement MOSFETs
  'IRF9540N': { name: 'IRF9540N', channel: 'p', vth: -3.0, rds_on: 0.117, kn: 3.0,  vds_max: 100, id_max: 23.0, lambda: 0.005, desc: 'Power P-MOSFET (-100V, -23A, 117mΩ)' },
  'VP2106':   { name: 'VP2106',   channel: 'p', vth: -2.0, rds_on: 5.0,   kn: 0.08, vds_max: 60,  id_max: 0.25, lambda: 0.01,  desc: 'Small-Signal P-MOSFET (-60V, -250mA)' },
  'BS250':    { name: 'BS250',    channel: 'p', vth: -2.2, rds_on: 7.0,   kn: 0.05, vds_max: 45,  id_max: 0.18, lambda: 0.01,  desc: 'Small-Signal P-MOSFET (-45V, -180mA)' },
  'IRF5305':  { name: 'IRF5305',  channel: 'p', vth: -2.5, rds_on: 0.06,  kn: 5.0,  vds_max: 55,  id_max: 31.0, lambda: 0.005, desc: 'High-Power P-MOSFET (-55V, -31A)' },
};

/* ==========================================================================
   JFET (Junction Field-Effect Transistor)
   N-Channel and P-Channel Depletion Mode
   ========================================================================== */

const JFET_MODELS = {
  // N-Channel JFETs (Depletion Mode, Vp < 0)
  '2N5457': { name: '2N5457', channel: 'n', vp: -3.0, idss: 0.003, rds0: 200, lambda: 0.01, desc: 'General Purpose N-JFET (Vp=-3V, Idss=3mA)' },
  '2N3819': { name: '2N3819', channel: 'n', vp: -4.0, idss: 0.010, rds0: 100, lambda: 0.01, desc: 'VHF/RF Amplifier N-JFET (Vp=-4V, Idss=10mA)' },
  'J201':   { name: 'J201',   channel: 'n', vp: -0.8, idss: 0.0006, rds0: 400, lambda: 0.01, desc: 'High Gain Audio Preamp N-JFET (Vp=-0.8V, Idss=0.6mA)' },
  'BF245A': { name: 'BF245A', channel: 'n', vp: -1.5, idss: 0.004, rds0: 150, lambda: 0.01, desc: 'RF/Audio Amplifier N-JFET (Vp=-1.5V, Idss=4mA)' },

  // P-Channel JFETs (Depletion Mode, Vp > 0)
  '2N5460': { name: '2N5460', channel: 'p', vp: 2.5, idss: 0.0025, rds0: 250, lambda: 0.01, desc: 'General Purpose Audio P-JFET (Vp=+2.5V, Idss=2.5mA)' },
  '2N3820': { name: '2N3820', channel: 'p', vp: 3.5, idss: 0.008,  rds0: 120, lambda: 0.01, desc: 'Audio/Switching P-JFET (Vp=+3.5V, Idss=8mA)' },
  'J174':   { name: 'J174',   channel: 'p', vp: 3.0, idss: 0.030,  rds0: 30,  lambda: 0.01, desc: 'Low-Noise Switching P-JFET (Vp=+3V, Idss=30mA)' },
};

if (typeof window !== 'undefined') {
  window.MOSFET_MODELS = MOSFET_MODELS;
  window.JFET_MODELS = JFET_MODELS;
}

function drawMOSFET(ctx, inst, channel) {
  const { x, y } = inst;
  const rs = inst.runtimeState || {};
  const region = rs.region || (rs.conducting ? 'linear' : 'cutoff');

  let strokeColor = '#64748b';
  let glowColor = null;
  let badgeText = 'OFF';
  if (region === 'linear' || region === 'ohmic') {
    strokeColor = '#22c55e';
    glowColor = 'rgba(34, 197, 94, 0.2)';
    badgeText = 'LIN';
  } else if (region === 'saturation') {
    strokeColor = '#38bdf8';
    glowColor = 'rgba(56, 189, 248, 0.2)';
    badgeText = 'SAT';
  }

  ctx.save();
  ctx.translate(x, y);

  if (glowColor) {
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(24, 25, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enclosing circle
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(24, 25, 16, 0, Math.PI * 2);
  ctx.stroke();

  // Terminal leads (silver/gray)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Gate lead
  ctx.moveTo(0, 25); ctx.lineTo(17, 25);
  // Drain lead: from channel segment (22, 18) -> (36, 18) -> (40, 8) -> (48, 0)
  ctx.moveTo(22, 18); ctx.lineTo(36, 18); ctx.lineTo(40, 8); ctx.lineTo(48, 0);
  // Source lead: from channel segment (22, 32) -> (36, 32) -> (40, 42) -> (48, 50)
  ctx.moveTo(22, 32); ctx.lineTo(36, 32); ctx.lineTo(40, 42); ctx.lineTo(48, 50);
  // Substrate tie to source line
  ctx.moveTo(22, 25); ctx.lineTo(32, 25); ctx.lineTo(32, 32);
  ctx.stroke();

  // Gate plate (insulated bar)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(17, 16); ctx.lineTo(17, 34);
  ctx.stroke();

  // 3-segment channel bar (Enhancement mode dashed channel)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 16); ctx.lineTo(22, 20); // Drain segment
  ctx.moveTo(22, 23); ctx.lineTo(22, 27); // Substrate segment
  ctx.moveTo(22, 30); ctx.lineTo(22, 34); // Source segment
  ctx.stroke();

  // Channel Substrate Arrow: points IN for N-Channel, OUT for P-Channel
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  if (channel === 'n') {
    // Arrow points IN towards channel (left)
    ctx.moveTo(29, 21); ctx.lineTo(23, 25); ctx.lineTo(29, 29);
  } else {
    // Arrow points OUT away from channel (right)
    ctx.moveTo(24, 21); ctx.lineTo(30, 25); ctx.lineTo(24, 29);
  }
  ctx.closePath();
  ctx.fill();

  // Pin Labels
  ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('G', 4, 21);
  ctx.fillText('D', 38, 7);
  ctx.fillText('S', 38, 49);

  // Model & State labels
  const defaultModel = channel === 'n' ? '2N7000' : 'IRF9540N';
  const modelName = inst.props?.model || defaultModel;
  ctx.font = 'bold 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(modelName, 0, 61);
  ctx.fillStyle = strokeColor;
  ctx.fillText('[' + badgeText + ']', 34, 61);

  if (inst.selected) drawSelectionRect(ctx, -3, -3, 56, 68);
  ctx.restore();
}

function drawJFET(ctx, inst, channel) {
  const { x, y } = inst;
  const rs = inst.runtimeState || {};
  const region = rs.region || (rs.conducting ? 'ohmic' : 'cutoff');

  let strokeColor = '#64748b';
  let glowColor = null;
  let badgeText = 'OFF';
  if (region === 'ohmic' || region === 'linear') {
    strokeColor = '#22c55e';
    glowColor = 'rgba(34, 197, 94, 0.2)';
    badgeText = 'OHM';
  } else if (region === 'saturation') {
    strokeColor = '#38bdf8';
    glowColor = 'rgba(56, 189, 248, 0.2)';
    badgeText = 'SAT';
  }

  ctx.save();
  ctx.translate(x, y);

  if (glowColor) {
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(24, 25, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enclosing circle
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(24, 25, 16, 0, Math.PI * 2);
  ctx.stroke();

  // Terminal leads (silver/gray)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Gate lead
  ctx.moveTo(0, 25); ctx.lineTo(24, 25);
  // Drain lead
  ctx.moveTo(24, 17); ctx.lineTo(38, 17); ctx.lineTo(40, 8); ctx.lineTo(48, 0);
  // Source lead
  ctx.moveTo(24, 33); ctx.lineTo(38, 33); ctx.lineTo(40, 42); ctx.lineTo(48, 50);
  ctx.stroke();

  // Continuous channel bar
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(24, 16); ctx.lineTo(24, 34);
  ctx.stroke();

  // Gate arrow: points IN for N-Channel, OUT for P-Channel
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  if (channel === 'n') {
    // Arrow points IN towards channel (right)
    ctx.moveTo(15, 21); ctx.lineTo(22, 25); ctx.lineTo(15, 29);
  } else {
    // Arrow points OUT away from channel (left)
    ctx.moveTo(20, 21); ctx.lineTo(13, 25); ctx.lineTo(20, 29);
  }
  ctx.closePath();
  ctx.fill();

  // Pin Labels
  ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('G', 4, 21);
  ctx.fillText('D', 38, 7);
  ctx.fillText('S', 38, 49);

  // Model & State labels
  const defaultModel = channel === 'n' ? '2N5457' : '2N5460';
  const modelName = inst.props?.model || defaultModel;
  ctx.font = 'bold 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(modelName, 0, 61);
  ctx.fillStyle = strokeColor;
  ctx.fillText('[' + badgeText + ']', 34, 61);

  if (inst.selected) drawSelectionRect(ctx, -3, -3, 56, 68);
  ctx.restore();
}

// Register MOSFET Components
for (const ch of ['n', 'p']) {
  const isN = ch === 'n';
  const defaultModel = isN ? '2N7000' : 'IRF9540N';
  const preset = MOSFET_MODELS[defaultModel];

  defComp({
    id: `${ch}_mosfet`,
    name: `${ch.toUpperCase()}-Channel MOSFET`,
    category: 'Passive',
    icon: `${ch.toUpperCase()}-MOS`,
    desc: `${ch.toUpperCase()}-Channel enhancement-mode MOSFET with cutoff, linear (ohmic), and saturation characteristics`,
    search: `${ch} mosfet nmos pmos ${ch}-channel transistor 2n7000 irf540n bs170 irfz44n irf9540n vp2106 bs250 fet switch`,
    width: 48,
    height: 50,
    defaultProps: {
      model: defaultModel,
      vth: preset.vth,
      rds_on: preset.rds_on,
      kn: preset.kn,
      lambda: preset.lambda,
    },
    interactive: [
      {
        field: 'model', label: 'MOSFET Model Preset', type: 'select',
        options: isN ? [
          { value: '2N7000',  label: '2N7000 (Small-Signal N-MOS, 60V, 200mA)' },
          { value: 'IRF540N', label: 'IRF540N (Power N-MOS, 100V, 33A, 44mΩ)' },
          { value: 'BS170',   label: 'BS170 (Switching N-MOS, 60V, 500mA)' },
          { value: 'IRFZ44N', label: 'IRFZ44N (High-Current N-MOS, 55V, 49A)' },
          { value: 'custom',  label: 'Custom MOSFET Parameters' },
        ] : [
          { value: 'IRF9540N', label: 'IRF9540N (Power P-MOS, -100V, -23A, 117mΩ)' },
          { value: 'VP2106',   label: 'VP2106 (Small-Signal P-MOS, -60V, -250mA)' },
          { value: 'BS250',    label: 'BS250 (Small-Signal P-MOS, -45V, -180mA)' },
          { value: 'IRF5305',  label: 'IRF5305 (High-Power P-MOS, -55V, -31A)' },
          { value: 'custom',   label: 'Custom MOSFET Parameters' },
        ],
      },
      { field: 'vth', label: isN ? 'Threshold Voltage Vth [V]' : 'Threshold Voltage |Vth| [V]', type: 'number', min: isN ? 0.5 : -10, max: isN ? 10 : -0.5, step: 0.1 },
      { field: 'rds_on', label: 'On-State Resistance Rds(on) [Ω]', type: 'number', min: 0.005, max: 50, step: 0.01 },
      { field: 'kn', label: 'Transconductance Factor Kn [A/V²]', type: 'number', min: 0.001, max: 50, step: 0.05 },
    ],
    contextMenu: [
      {
        label: 'View Characteristics (IV Curves)',
        icon: '📈',
        action: (inst) => {
          if (window.TransistorCurvesModal) {
            window.TransistorCurvesModal.open(inst);
          } else if (window.App?.openTransistorCurves) {
            window.App.openTransistorCurves(inst);
          }
        },
      },
    ],
    pins: [
      { id: 'gate', label: 'G', type: PIN_TYPE.SIGNAL, x: 0, y: 25, side: 'left' },
      { id: 'drain', label: 'D', type: PIN_TYPE.SIGNAL, x: 48, y: 0, side: 'top' },
      { id: 'source', label: 'S', type: PIN_TYPE.SIGNAL, x: 48, y: 50, side: 'bottom' },
    ],
    draw(ctx, inst) {
      drawMOSFET(ctx, inst, ch);
    },
  });
}

// Register JFET Components
for (const ch of ['n', 'p']) {
  const isN = ch === 'n';
  const defaultModel = isN ? '2N5457' : '2N5460';
  const preset = JFET_MODELS[defaultModel];

  defComp({
    id: `${ch}_jfet`,
    name: `${ch.toUpperCase()}-Channel JFET`,
    category: 'Passive',
    icon: `${ch.toUpperCase()}-JFET`,
    desc: `${ch.toUpperCase()}-Channel junction field-effect transistor (normally-ON depletion mode)`,
    search: `${ch} jfet njfet pjfet ${ch}-channel transistor 2n5457 2n3819 j201 bf245a 2n5460 2n3820 j174 fet`,
    width: 48,
    height: 50,
    defaultProps: {
      model: defaultModel,
      vp: preset.vp,
      idss: preset.idss,
      rds0: preset.rds0,
      lambda: preset.lambda,
    },
    interactive: [
      {
        field: 'model', label: 'JFET Model Preset', type: 'select',
        options: isN ? [
          { value: '2N5457', label: '2N5457 (General Purpose N-JFET, Vp=-3V, Idss=3mA)' },
          { value: '2N3819', label: '2N3819 (VHF/RF N-JFET, Vp=-4V, Idss=10mA)' },
          { value: 'J201',   label: 'J201 (High-Gain Audio N-JFET, Vp=-0.8V, Idss=0.6mA)' },
          { value: 'BF245A', label: 'BF245A (Audio/RF N-JFET, Vp=-1.5V, Idss=4mA)' },
          { value: 'custom', label: 'Custom JFET Parameters' },
        ] : [
          { value: '2N5460', label: '2N5460 (General Purpose Audio P-JFET, Vp=+2.5V)' },
          { value: '2N3820', label: '2N3820 (Switching P-JFET, Vp=+3.5V)' },
          { value: 'J174',   label: 'J174 (Low-Noise Switching P-JFET, Vp=+3V)' },
          { value: 'custom', label: 'Custom JFET Parameters' },
        ],
      },
      { field: 'vp', label: isN ? 'Pinch-off Voltage Vp [V]' : 'Pinch-off Voltage Vp [V]', type: 'number', min: isN ? -10 : 0.5, max: isN ? -0.2 : 10, step: 0.1 },
      { field: 'idss', label: 'Zero-Bias Saturation Current Idss [A]', type: 'number', min: 0.0001, max: 0.1, step: 0.0005 },
      { field: 'rds0', label: 'Zero-Bias Resistance Rds0 [Ω]', type: 'number', min: 10, max: 2000, step: 10 },
    ],
    contextMenu: [
      {
        label: 'View Characteristics (IV Curves)',
        icon: '📈',
        action: (inst) => {
          if (window.TransistorCurvesModal) {
            window.TransistorCurvesModal.open(inst);
          } else if (window.App?.openTransistorCurves) {
            window.App.openTransistorCurves(inst);
          }
        },
      },
    ],
    pins: [
      { id: 'gate', label: 'G', type: PIN_TYPE.SIGNAL, x: 0, y: 25, side: 'left' },
      { id: 'drain', label: 'D', type: PIN_TYPE.SIGNAL, x: 48, y: 0, side: 'top' },
      { id: 'source', label: 'S', type: PIN_TYPE.SIGNAL, x: 48, y: 50, side: 'bottom' },
    ],
    draw(ctx, inst) {
      drawJFET(ctx, inst, ch);
    },
  });
}

// Aliases for compatibility
if (typeof ArduinoComponents !== 'undefined' && ArduinoComponents.COMPONENT_DEFS) {
  ArduinoComponents.COMPONENT_DEFS['n_channel_mosfet'] = ArduinoComponents.COMPONENT_DEFS['n_mosfet'];
  ArduinoComponents.COMPONENT_DEFS['p_channel_mosfet'] = ArduinoComponents.COMPONENT_DEFS['p_mosfet'];
  ArduinoComponents.COMPONENT_DEFS['n_channel_jfet'] = ArduinoComponents.COMPONENT_DEFS['n_jfet'];
  ArduinoComponents.COMPONENT_DEFS['p_channel_jfet'] = ArduinoComponents.COMPONENT_DEFS['p_jfet'];
}

