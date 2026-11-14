/* ═══════════════════════════════════════════════════════════════════
   component-svg.js — Crisp Miniaturized SVG Previews for Components
   ═══════════════════════════════════════════════════════════════════
   Provides crisp vector SVG previews and package badges for all
   ArduSim sensors, ICs, modules, actuators, passives, and boards.
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

(function(root) {
  const ComponentSvg = {
    /* -------------------------------------------------------------
       Helper to wrap SVG elements in standard 36x36 viewBox canvas
       ------------------------------------------------------------- */
    _wrap(inner) {
      return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
    },

    /* -------------------------------------------------------------
       DIP Integrated Circuit SVG Generator
       ------------------------------------------------------------- */
    _drawDIP(pinsCount, label, sub) {
      const pinsPerSide = Math.max(4, Math.floor(pinsCount / 2));
      const isWide = pinsCount >= 40;
      const bodyW = isWide ? 22 : 16;
      const bodyX = (36 - bodyW) / 2;
      const bodyH = 30;
      const bodyY = 3;

      let pinsSvg = '';
      const pinW = 4;
      const pinH = 1.6;
      const spacing = (bodyH - 4) / (pinsPerSide - 1 || 1);

      for (let i = 0; i < pinsPerSide; i++) {
        const py = bodyY + 2 + i * spacing - pinH / 2;
        // Left pin
        pinsSvg += `<rect x="${bodyX - pinW + 0.8}" y="${py.toFixed(1)}" width="${pinW}" height="${pinH}" rx="0.4" fill="#cfd8dc" stroke="#607d8b" stroke-width="0.5"/>`;
        // Right pin
        pinsSvg += `<rect x="${(bodyX + bodyW - 0.8).toFixed(1)}" y="${py.toFixed(1)}" width="${pinW}" height="${pinH}" rx="0.4" fill="#cfd8dc" stroke="#607d8b" stroke-width="0.5"/>`;
      }

      // Chip text font size
      const textLen = (label || '').length;
      let fontSize = 4;
      if (textLen <= 3) fontSize = 4.8;
      else if (textLen <= 5) fontSize = 3.8;
      else fontSize = 3.2;

      return this._wrap(`
        ${pinsSvg}
        <!-- Chip body -->
        <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="1.8" fill="#1e2229" stroke="#37474f" stroke-width="1"/>
        <!-- Top orientation notch -->
        <path d="M ${bodyX + bodyW / 2 - 2.5} ${bodyY} A 2.5 2.5 0 0 0 ${bodyX + bodyW / 2 + 2.5} ${bodyY}" fill="#111418" stroke="#37474f" stroke-width="0.6"/>
        <!-- Pin 1 dot -->
        <circle cx="${bodyX + 2.8}" cy="${bodyY + 3.8}" r="1" fill="#00e5ff" opacity="0.8"/>
        <!-- Silkscreen label -->
        <text x="18" y="19" font-family="'JetBrains Mono', Consolas, monospace" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" transform="rotate(-90 18 19)" letter-spacing="0.2">${label}</text>
      `);
    },

    /* -------------------------------------------------------------
       Individual Component Renderers
       ------------------------------------------------------------- */
    _renderers: {
      // ── SENSORS ──
      hcsr04() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="10" width="32" height="16" rx="2" fill="#0277bd" stroke="#01579b" stroke-width="0.8"/>
          <!-- Ultrasonic transducers -->
          <circle cx="10" cy="18" r="6.2" fill="#cfd8dc" stroke="#78909c" stroke-width="1"/>
          <circle cx="10" cy="18" r="4.2" fill="#eceff1"/>
          <circle cx="10" cy="18" r="1.8" fill="#546e7a"/>
          <text x="10" y="19.2" font-size="2.8" font-family="monospace" font-weight="bold" fill="#263238" text-anchor="middle">T</text>
          <circle cx="26" cy="18" r="6.2" fill="#cfd8dc" stroke="#78909c" stroke-width="1"/>
          <circle cx="26" cy="18" r="4.2" fill="#eceff1"/>
          <circle cx="26" cy="18" r="1.8" fill="#546e7a"/>
          <text x="26" y="19.2" font-size="2.8" font-family="monospace" font-weight="bold" fill="#263238" text-anchor="middle">R</text>
          <!-- Crystal oscillator -->
          <rect x="16.5" y="14" width="3" height="8" rx="1" fill="#b0bec5" stroke="#78909c" stroke-width="0.5"/>
          <!-- Pins -->
          <rect x="13" y="26" width="10" height="4" fill="#ffd54f" stroke="#ffb300" stroke-width="0.5"/>
        </svg>`;
      },

      dht11() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Blue sensor cage -->
          <rect x="7" y="5" width="22" height="23" rx="2.5" fill="#00b0ff" stroke="#0091ea" stroke-width="1"/>
          <!-- Air vents -->
          <rect x="10" y="8" width="16" height="2" rx="0.6" fill="#00838f"/>
          <rect x="10" y="12" width="16" height="2" rx="0.6" fill="#00838f"/>
          <rect x="10" y="16" width="16" height="2" rx="0.6" fill="#00838f"/>
          <rect x="10" y="20" width="16" height="2" rx="0.6" fill="#00838f"/>
          <text x="18" y="26" font-size="2.8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">DHT11</text>
          <!-- 4 Leads -->
          <rect x="9.5" y="28" width="1.5" height="5" fill="#cfd8dc" stroke="#78909c" stroke-width="0.4"/>
          <rect x="14.5" y="28" width="1.5" height="5" fill="#cfd8dc" stroke="#78909c" stroke-width="0.4"/>
          <rect x="19.5" y="28" width="1.5" height="5" fill="#cfd8dc" stroke="#78909c" stroke-width="0.4"/>
          <rect x="24.5" y="28" width="1.5" height="5" fill="#cfd8dc" stroke="#78909c" stroke-width="0.4"/>
        </svg>`;
      },

      pir() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="7" width="26" height="24" rx="2" fill="#1b5e20" stroke="#0d3d13" stroke-width="0.8"/>
          <!-- White Fresnel dome -->
          <circle cx="18" cy="18" r="9" fill="#f8f9fa" stroke="#cfd8dc" stroke-width="1"/>
          <!-- Polyhedral facets -->
          <circle cx="18" cy="18" r="6" stroke="#b0bec5" stroke-width="0.8" fill="none"/>
          <circle cx="18" cy="18" r="3" stroke="#90a4ae" stroke-width="0.8" fill="none"/>
          <line x1="9" y1="18" x2="27" y2="18" stroke="#b0bec5" stroke-width="0.6"/>
          <line x1="18" y1="9" x2="18" y2="27" stroke="#b0bec5" stroke-width="0.6"/>
          <!-- Orange trim pots -->
          <rect x="7" y="23" width="3.5" height="3.5" rx="0.5" fill="#ff9800" stroke="#f57c00" stroke-width="0.4"/>
          <rect x="25.5" y="23" width="3.5" height="3.5" rx="0.5" fill="#ff9800" stroke="#f57c00" stroke-width="0.4"/>
        </svg>`;
      },

      ldr() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="16" r="10.5" fill="#ffe082" stroke="#ffb300" stroke-width="1.2"/>
          <!-- Cadmium Sulfide serpentine zigzag -->
          <path d="M 12 11 Q 18 11 24 11 Q 24 13.5 18 13.5 Q 12 13.5 12 16 Q 18 16 24 16 Q 24 18.5 18 18.5 Q 12 18.5 12 21 Q 18 21 24 21" stroke="#d84315" stroke-width="1.6" stroke-linecap="round" fill="none"/>
          <!-- Leads -->
          <line x1="14" y1="26.5" x2="14" y2="33" stroke="#90a4ae" stroke-width="1.6" stroke-linecap="round"/>
          <line x1="22" y1="26.5" x2="22" y2="33" stroke="#90a4ae" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`;
      },

      mpu6050() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="4" width="26" height="28" rx="2" fill="#0d47a1" stroke="#082b63" stroke-width="0.8"/>
          <!-- QFN-24 Chip -->
          <rect x="12" y="10" width="12" height="12" rx="1.5" fill="#212121" stroke="#424242" stroke-width="0.8"/>
          <!-- Orientation dot -->
          <circle cx="14" cy="12" r="0.8" fill="#ffd54f"/>
          <!-- Axis arrows -->
          <path d="M 16 16 L 20 16 M 19 14.5 L 21 16 L 19 17.5" stroke="#00e5ff" stroke-width="0.8" stroke-linecap="round"/>
          <path d="M 16 16 L 16 12 M 14.5 13 L 16 11 L 17.5 13" stroke="#76ff03" stroke-width="0.8" stroke-linecap="round"/>
          <text x="18" y="26" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">MPU6050</text>
          <!-- Pins -->
          <rect x="7" y="29" width="22" height="2" fill="#ffd54f"/>
        </svg>`;
      },

      ds3231() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="5" width="28" height="26" rx="2" fill="#1565c0" stroke="#0d47a1" stroke-width="0.8"/>
          <!-- Coin cell holder -->
          <circle cx="14" cy="18" r="7.5" fill="#37474f" stroke="#78909c" stroke-width="1"/>
          <circle cx="14" cy="18" r="5" fill="#cfd8dc"/>
          <text x="14" y="19" font-size="3" font-family="sans-serif" font-weight="bold" fill="#37474f" text-anchor="middle">CR</text>
          <!-- SOIC RTC chip -->
          <rect x="23" y="12" width="6" height="12" rx="0.5" fill="#212121" stroke="#424242" stroke-width="0.5"/>
          <text x="18" y="29" font-size="2.5" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">DS3231</text>
        </svg>`;
      },

      bme280() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="5" width="22" height="26" rx="2" fill="#4a148c" stroke="#310b5e" stroke-width="0.8"/>
          <!-- Barometric sensor metal lid -->
          <rect x="12" y="10" width="12" height="9" rx="1.5" fill="#cfd8dc" stroke="#90a4ae" stroke-width="0.8"/>
          <!-- Barometer vent hole -->
          <circle cx="15" cy="14.5" r="1.4" fill="#212121"/>
          <text x="18" y="24" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffd54f" text-anchor="middle">BME280</text>
          <rect x="10" y="28" width="16" height="2" fill="#ffd54f"/>
        </svg>`;
      },

      vl53l0x() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="5" width="22" height="26" rx="2" fill="#311b92" stroke="#1f0e63" stroke-width="0.8"/>
          <!-- Laser aperture window -->
          <rect x="11" y="9" width="14" height="9" rx="1.5" fill="#212121" stroke="#ff1744" stroke-width="0.8"/>
          <circle cx="15" cy="13.5" r="2" fill="#ff1744" opacity="0.9"/>
          <circle cx="21" cy="13.5" r="2" fill="#00e5ff" opacity="0.9"/>
          <text x="18" y="24" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">ToF-Laser</text>
          <rect x="10" y="28" width="16" height="2" fill="#ffd54f"/>
        </svg>`;
      },

      ir_obstacle() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="9" width="22" height="22" rx="2" fill="#0277bd" stroke="#01579b" stroke-width="0.8"/>
          <!-- IR Emitter LED (Clear) -->
          <rect x="10" y="3" width="5.5" height="7" rx="2.5" fill="#e1f5fe" stroke="#81d4fa" stroke-width="0.8"/>
          <!-- IR Photodiode (Black) -->
          <rect x="20.5" y="3" width="5.5" height="7" rx="2.5" fill="#212121" stroke="#424242" stroke-width="0.8"/>
          <!-- Trimmer -->
          <rect x="14" y="16" width="8" height="7" rx="1" fill="#00e5ff" stroke="#00b0ff" stroke-width="0.6"/>
          <circle cx="18" cy="19.5" r="2" fill="#ffffff"/>
        </svg>`;
      },

      lm35_sensor() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- TO-92 D-shape package -->
          <path d="M 10 17 A 8 8 0 0 1 26 17 L 26 10 L 10 10 Z" fill="#212121" stroke="#424242" stroke-width="0.8"/>
          <text x="18" y="14" font-size="3.2" font-family="monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">LM35</text>
          <!-- 3 Pins -->
          <line x1="12" y1="17" x2="12" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="18" y1="17" x2="18" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="24" y1="17" x2="24" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
      },

      ds18b20() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 10 17 A 8 8 0 0 1 26 17 L 26 10 L 10 10 Z" fill="#212121" stroke="#424242" stroke-width="0.8"/>
          <text x="18" y="14" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffd54f" text-anchor="middle">18B20</text>
          <line x1="12" y1="17" x2="12" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="18" y1="17" x2="18" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="24" y1="17" x2="24" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
      },

      water_flow_sensor() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="10" fill="#263238" stroke="#455a64" stroke-width="1.2"/>
          <rect x="3" y="14" width="7" height="8" rx="1.5" fill="#37474f" stroke="#546e7a"/>
          <rect x="26" y="14" width="7" height="8" rx="1.5" fill="#37474f" stroke="#546e7a"/>
          <!-- Turbine rotor -->
          <circle cx="18" cy="18" r="6" fill="#0277bd"/>
          <path d="M 15 18 L 21 18 M 18 15 L 18 21" stroke="#ffffff" stroke-width="1.5"/>
          <path d="M 12 18 L 24 18 M 21 15 L 24 18 L 21 21" stroke="#00e5ff" stroke-width="1.2" stroke-linecap="round"/>
        </svg>`;
      },

      flex_sensor() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="14" y="3" width="8" height="30" rx="1.5" fill="#ffb74d" stroke="#f57c00" stroke-width="0.8"/>
          <!-- Resistive segments -->
          <rect x="16" y="6" width="4" height="1.8" fill="#212121"/>
          <rect x="16" y="10" width="4" height="1.8" fill="#212121"/>
          <rect x="16" y="14" width="4" height="1.8" fill="#212121"/>
          <rect x="16" y="18" width="4" height="1.8" fill="#212121"/>
          <rect x="16" y="22" width="4" height="1.8" fill="#212121"/>
          <rect x="16" y="26" width="4" height="1.8" fill="#212121"/>
        </svg>`;
      },

      hx711() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="24" height="24" rx="2" fill="#2e7d32" stroke="#1b5e20" stroke-width="0.8"/>
          <rect x="12" y="11" width="12" height="12" rx="1" fill="#212121" stroke="#424242" stroke-width="0.6"/>
          <text x="18" y="18" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">HX711</text>
          <!-- Terminal pins -->
          <circle cx="9" cy="11" r="1.2" fill="#ffd54f"/>
          <circle cx="9" cy="16" r="1.2" fill="#ffd54f"/>
          <circle cx="9" cy="21" r="1.2" fill="#ffd54f"/>
          <circle cx="27" cy="11" r="1.2" fill="#ffd54f"/>
          <circle cx="27" cy="16" r="1.2" fill="#ffd54f"/>
          <circle cx="27" cy="21" r="1.2" fill="#ffd54f"/>
        </svg>`;
      },

      bh1750() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="5" width="22" height="26" rx="2" fill="#1565c0" stroke="#0d47a1" stroke-width="0.8"/>
          <!-- Diffuser dome -->
          <circle cx="18" cy="15" r="5.5" fill="#ffffff" stroke="#e0e0e0" stroke-width="0.8"/>
          <circle cx="18" cy="15" r="3" fill="#ffd54f" opacity="0.6"/>
          <text x="18" y="26" font-size="2.8" font-family="monospace" font-weight="bold" fill="#ffd54f" text-anchor="middle">BH1750</text>
        </svg>`;
      },

      ina219() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="5" width="24" height="26" rx="2" fill="#311b92" stroke="#1f0e63" stroke-width="0.8"/>
          <!-- Shunt resistor R100 -->
          <rect x="12" y="9" width="12" height="6" rx="0.5" fill="#212121" stroke="#9e9e9e" stroke-width="0.6"/>
          <text x="18" y="13.5" font-size="2.8" font-family="monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">R100</text>
          <text x="18" y="22" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">INA219</text>
          <rect x="10" y="27" width="16" height="2" fill="#ffd54f"/>
        </svg>`;
      },

      // ── BOARDS ──
      arduino_uno() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="28" height="28" rx="2.5" fill="#00838f" stroke="#004d40" stroke-width="0.8"/>
          <!-- USB-B Port -->
          <rect x="2" y="6" width="7" height="8" rx="1" fill="#b0bec5" stroke="#78909c" stroke-width="0.6"/>
          <!-- DC Barrel -->
          <rect x="2" y="19" width="8" height="9" rx="1" fill="#212121" stroke="#424242" stroke-width="0.6"/>
          <!-- Pin headers -->
          <rect x="11" y="5" width="19" height="3" fill="#212121"/>
          <rect x="13" y="28" width="17" height="3" fill="#212121"/>
          <!-- ATmega328P DIP -->
          <rect x="15" y="14" width="13" height="7" rx="0.5" fill="#263238" stroke="#37474f" stroke-width="0.5"/>
          <text x="21.5" y="18.8" font-size="2.6" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">UNO</text>
        </svg>`;
      },

      esp32_devkit_v1() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="3" width="24" height="30" rx="2" fill="#1b1d23" stroke="#37474f" stroke-width="0.8"/>
          <!-- ESP-WROOM-32 Shield -->
          <rect x="10" y="10" width="16" height="15" rx="1" fill="#cfd8dc" stroke="#90a4ae" stroke-width="0.8"/>
          <!-- Meander antenna -->
          <path d="M 12 5 L 24 5 L 24 7.5 L 14 7.5 L 14 9.5 L 22 9.5" fill="none" stroke="#ffd54f" stroke-width="1"/>
          <text x="18" y="18.5" font-size="2.6" font-family="monospace" font-weight="bold" fill="#212121" text-anchor="middle">ESP32</text>
          <!-- Headers -->
          <rect x="7" y="10" width="2" height="18" fill="#ffd54f"/>
          <rect x="27" y="10" width="2" height="18" fill="#ffd54f"/>
        </svg>`;
      },

      arduino_nano() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="3" width="18" height="30" rx="2" fill="#0277bd" stroke="#01579b" stroke-width="0.8"/>
          <rect x="14" y="2" width="8" height="4" fill="#b0bec5"/>
          <rect x="13.5" y="12" width="9" height="9" rx="1" fill="#212121"/>
          <text x="18" y="17.5" font-size="2.4" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">NANO</text>
          <rect x="9.5" y="7" width="1.5" height="22" fill="#ffd54f"/>
          <rect x="25" y="7" width="1.5" height="22" fill="#ffd54f"/>
        </svg>`;
      },

      pico2w() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="3" width="20" height="30" rx="2" fill="#2e7d32" stroke="#1b5e20" stroke-width="0.8"/>
          <rect x="13" y="2" width="10" height="3.5" rx="0.5" fill="#cfd8dc"/>
          <rect x="12" y="11" width="12" height="11" rx="1" fill="#cfd8dc" stroke="#90a4ae" stroke-width="0.6"/>
          <text x="18" y="18" font-size="2.6" font-family="monospace" font-weight="bold" fill="#212121" text-anchor="middle">PICO</text>
          <rect x="8.5" y="7" width="1.5" height="22" fill="#ffd54f"/>
          <rect x="26" y="7" width="1.5" height="22" fill="#ffd54f"/>
        </svg>`;
      },

      industrial_plc() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="4" width="26" height="28" rx="2" fill="#37474f" stroke="#263238" stroke-width="1"/>
          <rect x="8" y="9" width="20" height="18" rx="1" fill="#212121"/>
          <text x="18" y="17" font-size="3.5" font-family="monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">PLC</text>
          <text x="18" y="23" font-size="2.4" font-family="monospace" fill="#76ff03" text-anchor="middle">RUN/ERR</text>
          <rect x="8" y="5" width="20" height="3" fill="#78909c"/>
          <rect x="8" y="28" width="20" height="3" fill="#78909c"/>
        </svg>`;
      },

      // ── OUTPUT ──
      led(color = '#ff3333') {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Flanged LED Dome -->
          <path d="M 11 17 A 7 7 0 0 1 25 17 L 26 21 L 10 21 Z" fill="${color}" stroke="#ffffff" stroke-width="0.8" opacity="0.95"/>
          <ellipse cx="18" cy="21" rx="8" ry="1.8" fill="${color}"/>
          <!-- Glow center -->
          <circle cx="16" cy="14" r="2.5" fill="#ffffff" opacity="0.6"/>
          <!-- Leads -->
          <line x1="14" y1="22.8" x2="14" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="22" y1="22.8" x2="22" y2="30" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
      },

      rgb_led() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 11 16 A 7 7 0 0 1 25 16 L 26 20 L 10 20 Z" fill="#f5f5f5" stroke="#cfd8dc" stroke-width="0.8"/>
          <!-- R G B dies -->
          <circle cx="14" cy="14" r="1.5" fill="#ff1744"/>
          <circle cx="18" cy="12" r="1.5" fill="#00e676"/>
          <circle cx="22" cy="14" r="1.5" fill="#2979ff"/>
          <!-- 4 leads -->
          <line x1="12" y1="20" x2="12" y2="33" stroke="#90a4ae" stroke-width="1.2"/>
          <line x1="16" y1="20" x2="16" y2="34" stroke="#90a4ae" stroke-width="1.2"/>
          <line x1="20" y1="20" x2="20" y2="32" stroke="#90a4ae" stroke-width="1.2"/>
          <line x1="24" y1="20" x2="24" y2="31" stroke="#90a4ae" stroke-width="1.2"/>
        </svg>`;
      },

      buzzer() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="12" fill="#212121" stroke="#424242" stroke-width="1.2"/>
          <circle cx="18" cy="18" r="4" fill="#0d1117" stroke="#37474f" stroke-width="0.6"/>
          <text x="11" y="13" font-size="5" font-family="sans-serif" font-weight="bold" fill="#ff5252">+</text>
        </svg>`;
      },

      seg7() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="5" width="20" height="26" rx="2" fill="#111418" stroke="#333" stroke-width="1"/>
          <text x="18" y="24" font-family="'JetBrains Mono', Consolas, monospace" font-size="17" font-weight="bold" fill="#ff1744" text-anchor="middle">8</text>
          <circle cx="23.5" cy="24" r="1.2" fill="#ff1744"/>
        </svg>`;
      },

      tm1637() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="9" width="30" height="18" rx="2" fill="#111418" stroke="#333" stroke-width="1"/>
          <text x="18" y="22" font-family="'JetBrains Mono', Consolas, monospace" font-size="10" font-weight="bold" fill="#ff1744" text-anchor="middle" letter-spacing="1">88:88</text>
        </svg>`;
      },

      lcd1602() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="7" width="30" height="22" rx="2" fill="#004d40" stroke="#00796b" stroke-width="1"/>
          <rect x="6" y="10" width="24" height="16" rx="1" fill="#76ff03" opacity="0.9"/>
          <text x="18" y="20.5" font-family="'JetBrains Mono', monospace" font-size="4.8" font-weight="bold" fill="#003300" text-anchor="middle">16x2 LCD</text>
        </svg>`;
      },

      oled_ssd1306() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="26" height="26" rx="2" fill="#0d47a1" stroke="#082b63" stroke-width="0.8"/>
          <rect x="8" y="8" width="20" height="16" rx="1" fill="#000000" stroke="#00e5ff" stroke-width="0.8"/>
          <text x="18" y="18" font-size="3.8" font-family="monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">OLED</text>
          <rect x="11" y="26" width="14" height="2" fill="#ffd54f"/>
        </svg>`;
      },

      neopixel() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="7" width="22" height="22" rx="2.5" fill="#ffffff" stroke="#cfd8dc" stroke-width="1"/>
          <circle cx="18" cy="18" r="7.5" fill="#212121"/>
          <circle cx="16" cy="16" r="2" fill="#ff1744"/>
          <circle cx="20" cy="16" r="2" fill="#00e676"/>
          <circle cx="18" cy="20" r="2" fill="#2979ff"/>
        </svg>`;
      },

      bulb_12v() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="15" r="9" fill="#fff9c4" stroke="#fbc02d" stroke-width="1"/>
          <!-- Filament -->
          <path d="M 15 18 L 16.5 13 L 18 16 L 19.5 13 L 21 18" stroke="#f57f17" stroke-width="1" stroke-linecap="round"/>
          <rect x="14" y="23" width="8" height="5" rx="1" fill="#b0bec5" stroke="#78909c" stroke-width="0.8"/>
          <rect x="15" y="28" width="6" height="3" rx="1" fill="#78909c"/>
        </svg>`;
      },

      // ── INPUT ──
      push_button() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="7" width="22" height="22" rx="2.5" fill="#37474f" stroke="#263238" stroke-width="1"/>
          <circle cx="18" cy="18" r="6.8" fill="#111111" stroke="#212121" stroke-width="0.8"/>
          <!-- 4 Bent Pins -->
          <line x1="3" y1="11" x2="7" y2="11" stroke="#cfd8dc" stroke-width="2" stroke-linecap="round"/>
          <line x1="3" y1="25" x2="7" y2="25" stroke="#cfd8dc" stroke-width="2" stroke-linecap="round"/>
          <line x1="29" y1="11" x2="33" y2="11" stroke="#cfd8dc" stroke-width="2" stroke-linecap="round"/>
          <line x1="29" y1="25" x2="33" y2="25" stroke="#cfd8dc" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
      },

      potentiometer() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="16" r="10.5" fill="#0277bd" stroke="#01579b" stroke-width="1"/>
          <circle cx="18" cy="16" r="7.5" fill="#eceff1" stroke="#b0bec5" stroke-width="0.8"/>
          <line x1="18" y1="9" x2="18" y2="15" stroke="#263238" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="26.5" x2="12" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="18" y1="26.5" x2="18" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="24" y1="26.5" x2="24" y2="33" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
      },

      joystick() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="26" height="26" rx="3" fill="#0277bd" stroke="#01579b" stroke-width="1"/>
          <circle cx="18" cy="18" r="9" fill="#212121" stroke="#424242" stroke-width="1"/>
          <circle cx="18" cy="18" r="5" fill="#37474f"/>
        </svg>`;
      },

      keypad_4x4() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="4" width="24" height="28" rx="2" fill="#212121" stroke="#37474f" stroke-width="1"/>
          <!-- 4x4 matrix dots -->
          <circle cx="10" cy="8" r="1.5" fill="#ff1744"/>
          <circle cx="15" cy="8" r="1.5" fill="#e0e0e0"/>
          <circle cx="20" cy="8" r="1.5" fill="#e0e0e0"/>
          <circle cx="25" cy="8" r="1.5" fill="#ffd54f"/>
          <circle cx="10" cy="14" r="1.5" fill="#e0e0e0"/>
          <circle cx="15" cy="14" r="1.5" fill="#e0e0e0"/>
          <circle cx="20" cy="14" r="1.5" fill="#e0e0e0"/>
          <circle cx="25" cy="14" r="1.5" fill="#ffd54f"/>
          <circle cx="10" cy="20" r="1.5" fill="#e0e0e0"/>
          <circle cx="15" cy="20" r="1.5" fill="#e0e0e0"/>
          <circle cx="20" cy="20" r="1.5" fill="#e0e0e0"/>
          <circle cx="25" cy="20" r="1.5" fill="#ffd54f"/>
          <circle cx="10" cy="26" r="1.5" fill="#e0e0e0"/>
          <circle cx="15" cy="26" r="1.5" fill="#e0e0e0"/>
          <circle cx="20" cy="26" r="1.5" fill="#e0e0e0"/>
          <circle cx="25" cy="26" r="1.5" fill="#ffd54f"/>
        </svg>`;
      },

      // ── ACTUATORS ──
      servo() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="11" width="22" height="18" rx="2" fill="#0277bd" stroke="#01579b" stroke-width="1"/>
          <rect x="13" y="6" width="10" height="5" rx="1" fill="#01579b"/>
          <circle cx="18" cy="8" r="4.5" fill="#ffffff" stroke="#b0bec5" stroke-width="0.8"/>
          <path d="M 18 8 L 29 6 L 29 10 Z" fill="#ffffff" stroke="#b0bec5" stroke-width="0.6"/>
          <text x="18" y="22" font-size="2.8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">SG90</text>
        </svg>`;
      },

      dc_motor() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="10" width="20" height="18" rx="4" fill="#cfd8dc" stroke="#78909c" stroke-width="1"/>
          <!-- Shaft -->
          <rect x="16" y="3" width="4" height="7" rx="1" fill="#ffd54f" stroke="#ffb300" stroke-width="0.8"/>
          <text x="18" y="21" font-size="3.2" font-family="monospace" font-weight="bold" fill="#37474f" text-anchor="middle">MOTOR</text>
        </svg>`;
      },

      relay() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="7" width="26" height="22" rx="2.5" fill="#0288d1" stroke="#01579b" stroke-width="1"/>
          <text x="18" y="16" font-size="3.8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">RELAY</text>
          <text x="18" y="22" font-size="2.8" font-family="monospace" fill="#e1f5fe" text-anchor="middle">5V DC</text>
        </svg>`;
      },

      nema17() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="26" height="26" rx="2.5" fill="#37474f" stroke="#263238" stroke-width="1"/>
          <rect x="5" y="13" width="26" height="10" fill="#212121"/>
          <circle cx="18" cy="18" r="5.5" fill="#cfd8dc"/>
          <circle cx="18" cy="18" r="2.2" fill="#ffd54f"/>
          <!-- 4 mounting holes -->
          <circle cx="8" cy="8" r="1.2" fill="#212121"/>
          <circle cx="28" cy="8" r="1.2" fill="#212121"/>
          <circle cx="8" cy="28" r="1.2" fill="#212121"/>
          <circle cx="28" cy="28" r="1.2" fill="#212121"/>
        </svg>`;
      },

      // ── PASSIVE & POWER ──
      resistor() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="2" y1="18" x2="34" y2="18" stroke="#b0bec5" stroke-width="2.2" stroke-linecap="round"/>
          <rect x="8" y="12" width="20" height="12" rx="4" fill="#d7ccc8" stroke="#8d6e63" stroke-width="1"/>
          <!-- Color bands (1kΩ: Brown, Black, Red, Gold) -->
          <rect x="11.5" y="12" width="2" height="12" fill="#5d4037"/>
          <rect x="15.5" y="12" width="2" height="12" fill="#212121"/>
          <rect x="19.5" y="12" width="2" height="12" fill="#d32f2f"/>
          <rect x="23.5" y="12" width="1.6" height="12" fill="#ffd54f"/>
        </svg>`;
      },

      capacitor() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="6" width="16" height="22" rx="3" fill="#1565c0" stroke="#0d47a1" stroke-width="1"/>
          <ellipse cx="18" cy="6" rx="8" ry="2" fill="#cfd8dc"/>
          <!-- Negative stripe [-] -->
          <rect x="20" y="6" width="4.5" height="22" fill="#cfd8dc"/>
          <text x="22.2" y="18" font-size="4.5" font-weight="bold" fill="#0d47a1" text-anchor="middle">-</text>
          <line x1="14" y1="28" x2="14" y2="34" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="22" y1="28" x2="22" y2="34" stroke="#b0bec5" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
      },

      breadboard() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="6" width="30" height="24" rx="2.5" fill="#fafafa" stroke="#cfd8dc" stroke-width="1"/>
          <!-- Rails -->
          <line x1="5" y1="9" x2="31" y2="9" stroke="#e53935" stroke-width="1"/>
          <line x1="5" y1="27" x2="31" y2="27" stroke="#1e88e5" stroke-width="1"/>
          <!-- Tie holes -->
          <circle cx="8" cy="14" r="0.8" fill="#78909c"/>
          <circle cx="13" cy="14" r="0.8" fill="#78909c"/>
          <circle cx="18" cy="14" r="0.8" fill="#78909c"/>
          <circle cx="23" cy="14" r="0.8" fill="#78909c"/>
          <circle cx="28" cy="14" r="0.8" fill="#78909c"/>
          <circle cx="8" cy="22" r="0.8" fill="#78909c"/>
          <circle cx="13" cy="22" r="0.8" fill="#78909c"/>
          <circle cx="18" cy="22" r="0.8" fill="#78909c"/>
          <circle cx="23" cy="22" r="0.8" fill="#78909c"/>
          <circle cx="28" cy="22" r="0.8" fill="#78909c"/>
        </svg>`;
      },

      diode_1n4007() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="2" y1="18" x2="34" y2="18" stroke="#b0bec5" stroke-width="2" stroke-linecap="round"/>
          <rect x="9" y="13" width="18" height="10" rx="1.5" fill="#212121" stroke="#37474f" stroke-width="0.8"/>
          <!-- Cathode band -->
          <rect x="11" y="13" width="3.5" height="10" fill="#cfd8dc"/>
        </svg>`;
      },

      battery() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="8" width="16" height="23" rx="2" fill="#212121" stroke="#424242" stroke-width="1"/>
          <rect x="10" y="16" width="16" height="9" fill="#f57c00"/>
          <text x="18" y="22.5" font-size="3.2" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">9V</text>
          <circle cx="14" cy="6" r="2" fill="#cfd8dc"/>
          <rect x="19" y="4.5" width="4" height="3.5" rx="0.5" fill="#cfd8dc"/>
        </svg>`;
      },

      mb102_power() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Stepped MB102 PCB -->
          <path d="M 3 6 L 33 6 L 33 13 L 29 13 L 29 23 L 33 23 L 33 30 L 3 30 Z" fill="#14171a" stroke="#2c333a" stroke-width="0.8"/>
          <!-- DC Barrel Jack -->
          <rect x="3" y="8" width="7" height="6.5" rx="0.8" fill="#212529" stroke="#78909c" stroke-width="0.5"/>
          <circle cx="5" cy="11.2" r="1" fill="#ffd54f"/>
          <!-- USB Port -->
          <rect x="3" y="19" width="7" height="7" rx="0.8" fill="#b0bec5" stroke="#78909c" stroke-width="0.5"/>
          <rect x="5.5" y="21" width="3" height="3" fill="#263238"/>
          <!-- Power Button (Red) -->
          <rect x="12" y="13.5" width="5.5" height="5.5" rx="0.6" fill="#1a1d20" stroke="#37474f" stroke-width="0.4"/>
          <circle cx="14.7" cy="16.2" r="2" fill="#d32f2f"/>
          <!-- Power LED (Green) -->
          <circle cx="14.7" cy="9.5" r="1.2" fill="#00e676"/>
          <!-- Regulators (AMS1117) -->
          <rect x="19.5" y="8.5" width="4.5" height="4.5" rx="0.5" fill="#263238"/>
          <rect x="19.5" y="21" width="4.5" height="4.5" rx="0.5" fill="#263238"/>
          <!-- Jumper blocks (Yellow) -->
          <rect x="25" y="9" width="3.5" height="2.5" rx="0.4" fill="#fbc02d"/>
          <rect x="25" y="22.5" width="3.5" height="2.5" rx="0.4" fill="#fbc02d"/>
          <!-- Rail pins -->
          <circle cx="31.5" cy="8.5" r="0.8" fill="#e53935"/>
          <circle cx="31.5" cy="11" r="0.8" fill="#1e88e5"/>
          <circle cx="31.5" cy="25" r="0.8" fill="#e53935"/>
          <circle cx="31.5" cy="27.5" r="0.8" fill="#1e88e5"/>
        </svg>`;
      },

      multimeter() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="3" width="18" height="30" rx="3.5" fill="#fbc02d" stroke="#f57f17" stroke-width="1"/>
          <!-- LCD -->
          <rect x="12" y="6" width="12" height="7.5" rx="1" fill="#c8e6c9" stroke="#81c784" stroke-width="0.5"/>
          <text x="18" y="11.5" font-family="'JetBrains Mono', monospace" font-size="4" font-weight="bold" fill="#1b5e20" text-anchor="middle">0.00</text>
          <!-- Selector dial -->
          <circle cx="18" cy="21" r="5" fill="#212121" stroke="#424242" stroke-width="0.8"/>
          <line x1="18" y1="21" x2="18" y2="17.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
        </svg>`;
      },

      wifi_module() {
        return `<svg class="comp-svg-preview" viewBox="0 0 36 36" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="5" width="22" height="26" rx="2" fill="#0d47a1" stroke="#082b63" stroke-width="0.8"/>
          <!-- Antenna -->
          <path d="M 10 9 L 26 9 L 26 12 L 12 12 L 12 14 L 24 14" fill="none" stroke="#ffd54f" stroke-width="1"/>
          <rect x="12" y="16" width="12" height="8" rx="0.5" fill="#212121"/>
          <text x="18" y="21.5" font-size="2.6" font-family="monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">WIFI</text>
        </svg>`;
      },
    },

    /* -------------------------------------------------------------
       Package Badges
       ------------------------------------------------------------- */
    _badges: {
      // ICs
      ic_555: 'DIP-8',
      lm358: 'DIP-8',
      lm393: 'DIP-8',
      lm741: 'DIP-8',
      lm324: 'DIP-14',
      cd4066: 'DIP-14',
      ic_74hc00: 'DIP-14',
      ic_74hc02: 'DIP-14',
      ic_74hc04: 'DIP-14',
      ic_74hc08: 'DIP-14',
      ic_74hc14: 'DIP-14',
      ic_74hc32: 'DIP-14',
      ic_74hc86: 'DIP-14',
      ic_74hc74: 'DIP-14',
      ic_74hc164: 'DIP-14',
      ic_74hc76: 'DIP-16',
      ic_74hc47: 'DIP-16',
      ic_74hc85: 'DIP-16',
      ic_74hc138: 'DIP-16',
      ic_74hc139: 'DIP-16',
      ic_74hc148: 'DIP-16',
      ic_74hc151: 'DIP-16',
      ic_74hc153: 'DIP-16',
      ic_74hc165: 'DIP-16',
      ic_74hc193: 'DIP-16',
      ic_74hc245: 'DIP-20',
      ic_74hc283: 'DIP-16',
      ic_74hc595: 'DIP-16',
      ic_74hc4017: 'DIP-16',
      ic_8255: 'DIP-40',

      // Sensors
      dht11: '1-Wire',
      ds18b20: '1-Wire',
      hcsr04: 'Ultrasonic',
      ldr: 'Analog',
      pir: 'Digital',
      mpu6050: 'I2C (IMU)',
      ds3231: 'I2C (RTC)',
      bme280: 'I2C/SPI',
      vl53l0x: 'I2C (ToF)',
      hx711: 'ADC',
      water_flow_sensor: 'Pulse',
      load_cell: 'Analog',
      bh1750: 'I2C (Lux)',
      ina219: 'I2C (V/I)',
      max6675: 'SPI (Temp)',
      ir_obstacle: 'Digital',
      flex_sensor: 'Analog',
      thermistor: 'Analog',
      lm35_sensor: 'Analog',
      v_to_i_420ma: '4-20mA',
      i_to_v_420ma: '4-20mA',

      // Boards
      arduino_uno: 'ATmega328P',
      esp32_devkit_v1: 'WiFi / BLE',
      arduino_nano: 'Nano 328P',
      stm32f746_disco: 'Cortex-M7',
      lpc2148: 'ARM7',
      pico2w: 'RP2350',
      intel_8085: '8-Bit CPU',
      intel_8051: '8051 MCU',
      industrial_plc: 'PLC Relay',

      // Actuators
      servo: 'PWM 180°',
      servo_continuous: 'PWM 360°',
      dc_motor: 'DC Motor',
      relay: 'SPDT 5V',
      ssr_8ch: '8-CH SSR',
      stepper_28byj: '5V Stepper',
      l298n: 'Dual H-Bridge',
      tb6600: 'Driver 4A',
      nema17: 'Stepper',

      // Passives
      resistor: 'Resistor',
      capacitor: 'Capacitor',
      breadboard: '830 Tie-Pt',
      breadboard_small: '400 Tie-Pt',
      mb102_power: 'Dual-Rail PSU',
      diode_1n4007: 'Diode',
      npn_transistor: 'TO-92 NPN',
      pnp_transistor: 'TO-92 PNP',
      n_mosfet: 'TO-220 N-Ch',
      p_mosfet: 'TO-220 P-Ch',
      n_jfet: 'TO-92 N-Ch',
      p_jfet: 'TO-92 P-Ch',

      // Output
      led: '5mm LED',
      led_green: '5mm LED',
      led_blue: '5mm LED',
      led_yellow: '5mm LED',
      led_orange: '5mm LED',
      led_white: '5mm LED',
      rgb_led: 'RGB 4-Pin',
      buzzer: 'Piezo',
      seg7: '1-Digit',
      tm1637: '4-Digit I2C',
      lcd1602: '16x2 LCD',
      lcd1602_i2c: '16x2 I2C',
      lcd2004_i2c: '20x4 I2C',
      oled_ssd1306: 'I2C OLED',
      neopixel: 'WS2812B',
      max7219: '8x8 Matrix',
      bulb_12v: '12V Bulb',

      // Communication
      wifi_module: 'ESP-01',
      lora_module: 'RF 433/868',
      sd_card: 'SPI Card',
      hc05: 'Bluetooth',
      gps_neo6m: 'GPS UART',
      rc522: 'RFID 13.56M',
    },

    /* -------------------------------------------------------------
       Get crisp SVG markup for any component
       ------------------------------------------------------------- */
    getSvg(id, def = {}) {
      if (!id) return this._drawDIP(8, 'IC');

      // 1. Direct custom renderer match
      if (this._renderers[id]) {
        return this._renderers[id]();
      }

      // 2. LED variants
      if (id.startsWith('led_')) {
        const colorMap = {
          led_green: '#00e676',
          led_blue: '#2979ff',
          led_yellow: '#ffea00',
          led_orange: '#ff9100',
          led_white: '#ffffff',
        };
        return this._renderers.led(colorMap[id] || '#ff3333');
      }
      if (id === 'led') return this._renderers.led('#ff3333');

      // 3. Digital and Analog ICs
      const icMap = {
        ic_555: { pins: 8, label: '555' },
        lm358: { pins: 8, label: '358' },
        lm393: { pins: 8, label: '393' },
        lm741: { pins: 8, label: '741' },
        lm324: { pins: 14, label: '324' },
        cd4066: { pins: 14, label: '4066' },
        ic_74hc00: { pins: 14, label: '74HC00' },
        ic_74hc02: { pins: 14, label: '74HC02' },
        ic_74hc04: { pins: 14, label: '74HC04' },
        ic_74hc08: { pins: 14, label: '74HC08' },
        ic_74hc14: { pins: 14, label: '74HC14' },
        ic_74hc32: { pins: 14, label: '74HC32' },
        ic_74hc86: { pins: 14, label: '74HC86' },
        ic_74hc74: { pins: 14, label: '74HC74' },
        ic_74hc164: { pins: 14, label: '74HC164' },
        ic_74hc76: { pins: 16, label: '74HC76' },
        ic_74hc47: { pins: 16, label: '74HC47' },
        ic_74hc85: { pins: 16, label: '74HC85' },
        ic_74hc138: { pins: 16, label: '74HC138' },
        ic_74hc139: { pins: 16, label: '74HC139' },
        ic_74hc148: { pins: 16, label: '74HC148' },
        ic_74hc151: { pins: 16, label: '74HC151' },
        ic_74hc153: { pins: 16, label: '74HC153' },
        ic_74hc165: { pins: 16, label: '74HC165' },
        ic_74hc193: { pins: 16, label: '74HC193' },
        ic_74hc245: { pins: 20, label: '74HC245' },
        ic_74hc283: { pins: 16, label: '74HC283' },
        ic_74hc595: { pins: 16, label: '74HC595' },
        ic_74hc4017: { pins: 16, label: '4017' },
        ic_8255: { pins: 40, label: '8255' },
      };

      if (icMap[id]) {
        return this._drawDIP(icMap[id].pins, icMap[id].label);
      }

      // 4. Probes (Oscilloscope / Logic Analyzer / DSO)
      if (id.includes('probe')) {
        const probeColor = def.color || (id.includes('ch1') ? '#00e5ff' : id.includes('ch2') ? '#ff9800' : '#76ff03');
        return this._wrap(`
          <!-- Probe body & needle -->
          <path d="M 9 9 L 24 24" stroke="#cfd8dc" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="24" r="3.5" fill="${probeColor}" stroke="#ffffff" stroke-width="0.8"/>
          <line x1="26" y1="26" x2="32" y2="32" stroke="#cfd8dc" stroke-width="1.6" stroke-linecap="round"/>
          <!-- Ground crocodile clip wire -->
          <path d="M 12 12 Q 10 24 16 26" fill="none" stroke="#212121" stroke-width="1.4"/>
        `);
      }

      // 5. Transistors (NPN / PNP / FETs)
      if (id.includes('transistor') || id.includes('fet')) {
        const isFet = id.includes('mosfet');
        if (isFet) {
          return this._wrap(`
            <rect x="9" y="4" width="18" height="8" rx="1.5" fill="#cfd8dc" stroke="#90a4ae" stroke-width="0.8"/>
            <circle cx="18" cy="8" r="2.2" fill="#212121"/>
            <rect x="9" y="11" width="18" height="13" rx="1" fill="#212121" stroke="#37474f" stroke-width="0.8"/>
            <text x="18" y="19" font-size="3" font-family="monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">MOS</text>
            <line x1="12" y1="24" x2="12" y2="33" stroke="#90a4ae" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="18" y1="24" x2="18" y2="33" stroke="#90a4ae" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="24" y1="24" x2="24" y2="33" stroke="#90a4ae" stroke-width="1.8" stroke-linecap="round"/>
          `);
        }
        return this._wrap(`
          <path d="M 10 18 A 8 8 0 0 1 26 18 L 26 10 L 10 10 Z" fill="#212121" stroke="#37474f" stroke-width="0.8"/>
          <text x="18" y="15" font-size="2.8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">${id.includes('npn') ? 'NPN' : 'PNP'}</text>
          <line x1="12" y1="18" x2="12" y2="33" stroke="#90a4ae" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="18" y1="18" x2="18" y2="33" stroke="#90a4ae" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="24" y1="18" x2="24" y2="33" stroke="#90a4ae" stroke-width="1.8" stroke-linecap="round"/>
        `);
      }

      // 6. Displays (TFT, LCD, OLED)
      if (id.includes('lcd') || id.includes('tft') || id.includes('ili9341') || id.includes('oled')) {
        return this._renderers.oled_ssd1306();
      }

      // 7. NeoPixel variants
      if (id.includes('neopixel')) {
        return this._renderers.neopixel();
      }

      // 8. Power rails
      if (id === 'power_5v') {
        return this._wrap(`
          <circle cx="18" cy="18" r="11" fill="#ffebee" stroke="#ef5350" stroke-width="1.2"/>
          <text x="18" y="21" font-size="6" font-family="monospace" font-weight="bold" fill="#d32f2f" text-anchor="middle">+5V</text>
        `);
      }
      if (id === 'power_gnd') {
        return this._wrap(`
          <circle cx="18" cy="18" r="11" fill="#eceff1" stroke="#78909c" stroke-width="1.2"/>
          <path d="M 18 10 L 18 20 M 11 20 L 25 20 M 13.5 23 L 22.5 23 M 16 26 L 20 26" stroke="#37474f" stroke-width="1.6" stroke-linecap="round"/>
        `);
      }

      // 9. Generic clean fallback PCB module
      const shortName = (def.name || id).slice(0, 5).toUpperCase();
      return this._wrap(`
        <rect x="5" y="5" width="26" height="26" rx="3" fill="#1e2229" stroke="#37474f" stroke-width="1"/>
        <circle cx="9" cy="9" r="1.2" fill="#ffd54f"/>
        <circle cx="27" cy="9" r="1.2" fill="#ffd54f"/>
        <circle cx="9" cy="27" r="1.2" fill="#ffd54f"/>
        <circle cx="27" cy="27" r="1.2" fill="#ffd54f"/>
        <text x="18" y="19" font-size="3.5" font-family="'JetBrains Mono', monospace" font-weight="bold" fill="#00e5ff" text-anchor="middle">${shortName}</text>
      `);
    },

    /* -------------------------------------------------------------
       Get package or protocol badge
       ------------------------------------------------------------- */
    getBadge(id, def = {}) {
      if (this._badges[id]) return this._badges[id];
      if (id.startsWith('ic_') || id.startsWith('lm')) return 'IC';
      if (id.includes('probe')) return 'PROBE';
      if (id.includes('fet') || id.includes('transistor')) return 'DISCRETE';
      if (def.category) return def.category.slice(0, 8);
      return null;
    }
  };

  window.ComponentSvg = ComponentSvg;
  if (window.ArduinoComponents) {
    window.ArduinoComponents.ComponentSvg = ComponentSvg;
  }
})();
