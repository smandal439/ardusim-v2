/**
 * js/bluetooth-controller.js — Virtual Smartphone Bluetooth Controller
 *
 * Simulates a mobile smartphone interface running a Bluetooth Terminal / Controller app.
 * Provides real-time bidirectional UART communication with the HC-05 Bluetooth module:
 * - Wireless pairing & connection state (toggles HC-05 on-board LED and STATE pin)
 * - Quick action buttons: "LED ON" ('1'), "LED OFF" ('0'), and "Toggle"
 * - Serial Terminal: Type custom commands, send with configurable line endings, and view responses
 * - Draggable floating phone chassis with minimizable widget pill
 */

'use strict';

(function () {
  class BluetoothPhoneController {
    constructor() {
      this.targetInst = null;
      this.connected = false;
      this.ledState = false;
      this.activeTab = 'buttons'; // 'buttons' | 'terminal' | 'info'
      this.isOpen = false;
      this.isMinimized = false;
      this.history = [];
      this.autoScroll = true;

      this.wrapperEl = null;
      this.pillEl = null;
      this.logContainerEl = null;
      this.inputEl = null;

      this._initDOM();
      this._bindEvents();
      this._startClock();
    }

    _initDOM() {
      if (document.getElementById('bt-phone-wrapper')) {
        this.wrapperEl = document.getElementById('bt-phone-wrapper');
        this.pillEl = document.getElementById('bt-phone-pill');
        return;
      }

      // 1. Minimized floating pill
      const pill = document.createElement('div');
      pill.id = 'bt-phone-pill';
      pill.className = 'bt-phone-pill hidden';
      pill.innerHTML = `
        <span>📱</span>
        <span id="bt-pill-status">HC-05 · Disconnected</span>
      `;
      document.body.appendChild(pill);
      this.pillEl = pill;

      // 2. Main phone chassis
      const phone = document.createElement('div');
      phone.id = 'bt-phone-wrapper';
      phone.className = 'bt-phone-wrapper hidden';
      phone.setAttribute('role', 'dialog');
      phone.setAttribute('aria-label', 'Virtual Smartphone Bluetooth Controller');

      phone.innerHTML = `
        <!-- Top Bezel & Speaker -->
        <div class="bt-phone-notch-bar" id="bt-phone-drag-handle">
          <div class="bt-phone-camera"></div>
          <div class="bt-phone-speaker"></div>
        </div>

        <!-- Phone Status Bar -->
        <div class="bt-phone-status-bar">
          <span id="bt-phone-clock">12:00</span>
          <div class="bt-phone-status-icons">
            <span class="bt-phone-bt-icon" id="bt-phone-bt-icon" title="Bluetooth Status">ᚼ</span>
            <span style="font-size:10px;">📶</span>
            <span style="font-size:10px;">🔋 98%</span>
          </div>
        </div>

        <!-- App Header Bar -->
        <div class="bt-phone-app-header">
          <div class="bt-phone-app-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M7 7l10 10-5 5V2l5 5L7 17"></path>
            </svg>
            <span>ArduSim BT Remote</span>
          </div>
          <div class="bt-phone-actions">
            <button class="bt-phone-icon-btn" id="bt-btn-minimize" title="Minimize phone (—)">—</button>
            <button class="bt-phone-icon-btn" id="bt-btn-close" title="Close phone (✕)">✕</button>
          </div>
        </div>

        <!-- Device Connection Strip -->
        <div class="bt-phone-device-strip">
          <div class="bt-phone-device-info">
            <span class="bt-phone-device-name" id="bt-device-name">HC-05 Wireless</span>
            <span class="bt-phone-device-status">
              <span class="bt-phone-status-dot" id="bt-status-dot"></span>
              <span id="bt-status-text" style="color:#94a3b8;">Disconnected</span>
            </span>
          </div>
          <button class="bt-phone-connect-btn" id="bt-btn-connect">Connect</button>
        </div>

        <!-- App Navigation Tabs -->
        <div class="bt-phone-tabs">
          <button class="bt-phone-tab-btn active" data-tab="buttons" id="bt-tab-buttons">
            <span>🎮</span> Buttons
          </button>
          <button class="bt-phone-tab-btn" data-tab="terminal" id="bt-tab-terminal">
            <span>💬</span> Terminal
          </button>
          <button class="bt-phone-tab-btn" data-tab="info" id="bt-tab-info">
            <span>ℹ️</span> Guide
          </button>
        </div>

        <!-- App Body Views -->
        <div class="bt-phone-screen-body">
          <!-- 1. CONTROLLER TAB -->
          <div class="bt-pane" id="bt-pane-buttons">
            <!-- Visual LED Readout -->
            <div class="bt-led-indicator-card">
              <div class="bt-led-label-wrap">
                <span class="bt-led-label-title">Hardware Feedback</span>
                <span class="bt-led-state-text" id="bt-led-state-text">LED is OFF</span>
              </div>
              <div class="bt-virtual-bulb" id="bt-virtual-bulb" title="Pin 13 LED State"></div>
            </div>

            <!-- Big Primary Action Buttons -->
            <div class="bt-big-buttons-grid">
              <button class="bt-btn-action bt-btn-on" id="bt-btn-led-on" title="Transmit character '1' via Bluetooth">
                <span style="font-size:22px;">💡</span>
                <span>LED ON</span>
                <span class="bt-btn-sub">SEND '1'</span>
              </button>

              <button class="bt-btn-action bt-btn-off" id="bt-btn-led-off" title="Transmit character '0' via Bluetooth">
                <span style="font-size:22px;">🌑</span>
                <span>LED OFF</span>
                <span class="bt-btn-sub">SEND '0'</span>
              </button>

              <button class="bt-btn-toggle" id="bt-btn-led-toggle" title="Toggle current LED state">
                <span>🔄 Toggle LED State</span>
              </button>
            </div>

            <!-- Macro keypad buttons -->
            <div class="bt-macros-section">
              <span class="bt-section-label">Quick Commands</span>
              <div class="bt-macros-grid">
                <button class="bt-macro-btn" data-send="1">1 (ON)</button>
                <button class="bt-macro-btn" data-send="0">0 (OFF)</button>
                <button class="bt-macro-btn" data-send="+">+</button>
                <button class="bt-macro-btn" data-send="-">-</button>
                <button class="bt-macro-btn" data-send="F">▲ Fwd</button>
                <button class="bt-macro-btn" data-send="B">▼ Rev</button>
                <button class="bt-macro-btn" data-send="L">◀ Left</button>
                <button class="bt-macro-btn" data-send="R">▶ Right</button>
              </div>
            </div>
          </div>

          <!-- 2. SERIAL TERMINAL TAB -->
          <div class="bt-pane hidden" id="bt-pane-terminal">
            <div class="bt-terminal-wrapper">
              <div class="bt-terminal-logs" id="bt-terminal-logs">
                <div class="bt-log-row sys">
                  <span class="bt-badge bt-badge-sys">SYS</span>
                  <span class="bt-log-msg">HC-05 Bluetooth Terminal Ready. Pair & send data below.</span>
                </div>
              </div>

              <div class="bt-terminal-controls">
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                  <input type="checkbox" id="bt-chk-autoscroll" checked> Auto-scroll
                </label>
                <div style="display:flex;align-items:center;gap:6px;">
                  <select id="bt-sel-eol" style="background:#1e293b;border:1px solid #334155;color:#cbd5e1;font-size:10px;border-radius:4px;padding:1px 4px;">
                    <option value="" selected>No Line Ending</option>
                    <option value="\n">Newline (\n)</option>
                    <option value="\r\n">Both (\r\n)</option>
                  </select>
                  <button id="bt-btn-clear-log" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:10px;">Clear</button>
                </div>
              </div>

              <div class="bt-terminal-input-bar">
                <input type="text" class="bt-terminal-input" id="bt-terminal-input" placeholder="Type command..." autocomplete="off">
                <button class="bt-terminal-send-btn" id="bt-btn-send">Send</button>
              </div>
            </div>
          </div>

          <!-- 3. INFO / GUIDE TAB -->
          <div class="bt-pane hidden" id="bt-pane-info">
            <div class="bt-info-card">
              <h4>📶 HC-05 Bluetooth Module</h4>
              <p>The HC-05 is a Bluetooth Serial Port Profile (SPP) transceiver. It bridges wireless commands from your phone into UART Serial for Arduino.</p>
              
              <table class="bt-info-table">
                <tr><td><b>Baud Rate:</b></td><td><code>115,200 baud</code> (or 9600 for AT)</td></tr>
                <tr><td><b>TXD Pin:</b></td><td>Connects to Arduino RX (D0 or SoftSerial)</td></tr>
                <tr><td><b>RXD Pin:</b></td><td>Connects to Arduino TX (D1 or SoftSerial)</td></tr>
                <tr><td><b>STATE Pin:</b></td><td>Outputs HIGH (5V) when paired</td></tr>
              </table>
            </div>

            <div class="bt-info-card">
              <h4>💡 How To Use</h4>
              <p>1. Start the simulation by clicking <b>Run</b>.</p>
              <p>2. Tap <b>Connect</b> above — notice the HC-05 on-board LED changes to solid blue.</p>
              <p>3. Tap <b>LED ON</b> or <b>LED OFF</b> — watch the Arduino LED toggle instantly!</p>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(phone);
      this.wrapperEl = phone;
      this.logContainerEl = phone.querySelector('#bt-terminal-logs');
      this.inputEl = phone.querySelector('#bt-terminal-input');

      this._makeDraggable(phone.querySelector('#bt-phone-drag-handle'), phone);
    }

    _bindEvents() {
      if (!this.wrapperEl) return;

      // Close / Minimize
      this.wrapperEl.querySelector('#bt-btn-close')?.addEventListener('click', () => this.close());
      this.wrapperEl.querySelector('#bt-btn-minimize')?.addEventListener('click', () => this.minimize());
      this.pillEl?.addEventListener('click', () => this.restore());

      // Connect Button
      this.wrapperEl.querySelector('#bt-btn-connect')?.addEventListener('click', () => this.toggleConnect());

      // Tab Buttons
      const tabBtns = this.wrapperEl.querySelectorAll('.bt-phone-tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tab = e.currentTarget.getAttribute('data-tab');
          this.switchTab(tab);
        });
      });

      // Quick LED Action Buttons
      this.wrapperEl.querySelector('#bt-btn-led-on')?.addEventListener('click', () => {
        this.sendData('1');
      });

      this.wrapperEl.querySelector('#bt-btn-led-off')?.addEventListener('click', () => {
        this.sendData('0');
      });

      this.wrapperEl.querySelector('#bt-btn-led-toggle')?.addEventListener('click', () => {
        const next = this.ledState ? '0' : '1';
        this.sendData(next);
      });

      // Macro buttons
      this.wrapperEl.querySelectorAll('.bt-macro-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const val = e.currentTarget.getAttribute('data-send');
          if (val) this.sendData(val);
        });
      });

      // Terminal Send
      const sendInput = () => {
        if (!this.inputEl) return;
        const text = this.inputEl.value;
        if (!text) return;
        const eolVal = this.wrapperEl.querySelector('#bt-sel-eol')?.value || '';
        this.sendData(text, eolVal);
        this.inputEl.value = '';
      };

      this.wrapperEl.querySelector('#bt-btn-send')?.addEventListener('click', sendInput);
      this.inputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendInput();
      });

      // Terminal Clear
      this.wrapperEl.querySelector('#bt-btn-clear-log')?.addEventListener('click', () => {
        if (this.logContainerEl) {
          this.logContainerEl.innerHTML = '';
          this._appendLog('sys', 'Log cleared.');
        }
      });

      // Auto-scroll toggle
      const autoScrollChk = this.wrapperEl.querySelector('#bt-chk-autoscroll');
      autoScrollChk?.addEventListener('change', (e) => {
        this.autoScroll = !!e.target.checked;
      });
    }

    _startClock() {
      const update = () => {
        const clockEl = this.wrapperEl?.querySelector('#bt-phone-clock');
        if (clockEl) {
          const now = new Date();
          const hrs = String(now.getHours()).padStart(2, '0');
          const mins = String(now.getMinutes()).padStart(2, '0');
          clockEl.textContent = `${hrs}:${mins}`;
        }
      };
      update();
      setInterval(update, 10000);
    }

    _makeDraggable(handle, el) {
      if (!handle || !el) return;
      let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
      let isDragging = false;

      const onPointerDown = (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Switch from right/bottom anchoring to left/top for dragging
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.left = `${initialLeft}px`;
        el.style.top = `${initialTop}px`;

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        e.preventDefault();
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newX = initialLeft + dx;
        let newY = initialTop + dy;

        // Clamp inside window viewport
        const maxW = window.innerWidth - el.offsetWidth - 10;
        const maxH = window.innerHeight - el.offsetHeight - 10;
        newX = Math.max(10, Math.min(maxW, newX));
        newY = Math.max(10, Math.min(maxH, newY));

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      };

      const onPointerUp = () => {
        isDragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      handle.addEventListener('pointerdown', onPointerDown);
    }

    _getTargetInst() {
      if (this.targetInst) return this.targetInst;
      const comps = window.CircuitCanvas?.components || window.App?.canvas?.components || [];
      const found = comps.find(c => c.type === 'hc05');
      if (found) {
        this.targetInst = found;
        return found;
      }
      return null;
    }

    open(inst) {
      this.targetInst = inst || this._getTargetInst();
      this.isOpen = true;
      this.isMinimized = false;

      // Sync state from component
      if (this.targetInst) {
        const isConn = !!(this.targetInst.runtimeState?.connected ?? this.targetInst.props?.connected ?? false);
        this.connected = isConn;
      }

      this._updateUIState();
      this.pillEl?.classList.add('hidden');
      this.wrapperEl?.classList.remove('hidden');

      // Check if simulation is running and provide gentle hint if not
      const isRunning = window.ArduinoSim && window.ArduinoSim.isRunning;
      if (!isRunning && window.App?.showToast) {
        window.App.showToast('Tip: Press Run to start the Arduino simulation', 'info');
      }
    }

    close() {
      this.isOpen = false;
      this.isMinimized = false;
      this.wrapperEl?.classList.add('hidden');
      this.pillEl?.classList.add('hidden');
    }

    minimize() {
      this.isOpen = false;
      this.isMinimized = true;
      this.wrapperEl?.classList.add('hidden');
      this.pillEl?.classList.remove('hidden');
      this._updatePillText();
    }

    restore() {
      this.open(this.targetInst);
    }

    switchTab(tabName) {
      this.activeTab = tabName;
      if (!this.wrapperEl) return;

      this.wrapperEl.querySelectorAll('.bt-phone-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
      });

      this.wrapperEl.querySelectorAll('.bt-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.id !== `bt-pane-${tabName}`);
      });
    }

    toggleConnect(inst) {
      const target = inst || this._getTargetInst();
      if (!target) {
        if (window.App?.showToast) {
          window.App.showToast('No HC-05 Bluetooth module found in circuit', 'warning');
        }
        return;
      }
      this.targetInst = target;

      const nextState = !this.connected;
      this.connected = nextState;

      // Update props and runtimeState on HC-05 module
      target.props = target.props || {};
      target.props.connected = nextState;
      target.runtimeState = target.runtimeState || {};
      target.runtimeState.connected = nextState;

      // Drive HC-05 STATE pin (HIGH when connected, LOW when disconnected)
      if (window.ArduinoSim) {
        window.ArduinoSim.setPinState(`${target.id}_STATE`, nextState ? 1 : 0);
      }

      // Re-render canvas to immediately update HC-05 LED (solid cyan vs fast blink)
      if (window.CircuitCanvas?.render) {
        window.CircuitCanvas.render();
      } else if (window.App?.canvas?.render) {
        window.App.canvas.render();
      }

      this._updateUIState();
      this._updatePillText();

      if (nextState) {
        this._appendLog('sys', 'Connected to HC-05 (115200 baud, 8-N-1)');
        if (window.App?.showToast) {
          window.App.showToast('Bluetooth Connected to HC-05', 'success');
        }
      } else {
        this._appendLog('sys', 'Disconnected from HC-05');
        if (window.App?.showToast) {
          window.App.showToast('Bluetooth Disconnected', 'info');
        }
      }
    }

    sendData(data, appendEol = '') {
      if (data === undefined || data === null) return;
      const text = String(data) + appendEol;
      const target = this._getTargetInst();

      // Check if simulation is running
      const sim = window.ArduinoSim;
      if (!sim || !sim.isRunning) {
        if (window.App?.showToast) {
          window.App.showToast('Please start the simulation (Run) first!', 'warning');
        }
        this._appendLog('sys', 'Failed: Simulation is not running.');
        return;
      }

      // Auto-connect if currently disconnected
      if (!this.connected) {
        this.toggleConnect(target);
      }

      // Transmit to simulation UART buffer (feeds hardware Serial.read())
      sim.sendSerialInput(text);

      // Support SoftwareSerial if listening
      if (sim._softSerial) {
        for (const ssId in sim._softSerial) {
          const ch = sim._softSerial[ssId];
          if (ch && ch.listening && Array.isArray(ch.buf)) {
            for (const c of text) ch.buf.push(c);
          }
        }
      }

      // Update UI log
      const displayPayload = String(data).replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      this._appendLog('tx', displayPayload);

      // Optimistically update LED bulb state if sending 1 or 0
      if (String(data).trim() === '1') {
        this._updateLEDIndicator(true);
      } else if (String(data).trim() === '0') {
        this._updateLEDIndicator(false);
      }
    }

    onSerialData(text) {
      if (!text || typeof text !== 'string') return;
      if (!this.connected) return;

      const trimmed = text.trim();
      if (!trimmed) return;

      // Append to phone terminal
      this._appendLog('rx', trimmed);

      // Detect feedback from Arduino sketch (e.g. "LED ON" / "LED OFF")
      if (trimmed.includes('LED ON')) {
        this._updateLEDIndicator(true);
      } else if (trimmed.includes('LED OFF')) {
        this._updateLEDIndicator(false);
      }
    }

    onSimReset() {
      this._updateLEDIndicator(false);
    }

    _updateLEDIndicator(on) {
      this.ledState = on;
      const bulb = this.wrapperEl?.querySelector('#bt-virtual-bulb');
      const text = this.wrapperEl?.querySelector('#bt-led-state-text');
      if (bulb) bulb.classList.toggle('on', on);
      if (text) {
        text.classList.toggle('on', on);
        text.textContent = on ? 'LED is ON' : 'LED is OFF';
      }
    }

    _updateUIState() {
      if (!this.wrapperEl) return;
      const isConn = this.connected;

      const connectBtn = this.wrapperEl.querySelector('#bt-btn-connect');
      if (connectBtn) {
        connectBtn.textContent = isConn ? 'Disconnect' : 'Connect';
        connectBtn.classList.toggle('connected', isConn);
      }

      const statusDot = this.wrapperEl.querySelector('#bt-status-dot');
      if (statusDot) {
        statusDot.className = `bt-phone-status-dot ${isConn ? 'connected' : ''}`;
      }

      const statusText = this.wrapperEl.querySelector('#bt-status-text');
      if (statusText) {
        statusText.textContent = isConn ? 'Connected' : 'Disconnected';
        statusText.style.color = isConn ? '#34d399' : '#94a3b8';
      }

      const btIcon = this.wrapperEl.querySelector('#bt-phone-bt-icon');
      if (btIcon) {
        btIcon.classList.toggle('connected', isConn);
      }

      const devName = this.wrapperEl.querySelector('#bt-device-name');
      if (devName && this.targetInst) {
        devName.textContent = this.targetInst.props?.label || 'HC-05 Wireless';
      }
    }

    _updatePillText() {
      const textEl = this.pillEl?.querySelector('#bt-pill-status');
      if (textEl) {
        textEl.textContent = this.connected ? 'HC-05 · Connected 🟢' : 'HC-05 · Disconnected ⚪';
      }
    }

    _appendLog(dir, msg) {
      if (!this.logContainerEl) return;
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      const row = document.createElement('div');
      row.className = `bt-log-row ${dir}`;

      let badgeClass = 'bt-badge-sys';
      let badgeText = 'SYS';
      if (dir === 'tx') { badgeClass = 'bt-badge-tx'; badgeText = 'TX'; }
      if (dir === 'rx') { badgeClass = 'bt-badge-rx'; badgeText = 'RX'; }

      row.innerHTML = `
        <span class="bt-log-time">${timeStr}</span>
        <span class="bt-badge ${badgeClass}">${badgeText}</span>
        <span class="bt-log-msg">${this._escape(msg)}</span>
      `;

      this.logContainerEl.appendChild(row);

      if (this.autoScroll) {
        this.logContainerEl.scrollTop = this.logContainerEl.scrollHeight;
      }
    }

    _escape(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  // Export singleton instance
  window.BluetoothPhoneController = BluetoothPhoneController;
  window.BluetoothPhoneModal = new BluetoothPhoneController();
})();
