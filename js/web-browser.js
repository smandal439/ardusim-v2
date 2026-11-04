/* -------------------------------------------------------
   web-browser.js — Web Browser Panel
   Renders HTML served by the simulated ESP32 WebServer.
   Intercepts link clicks and routes them back to the
   simulated server so GPIO changes happen on click.
   ------------------------------------------------------- */

'use strict';

class WebBrowser {
  constructor() {
    this.iframe   = document.getElementById('webbrowser-iframe');
    this.addrBar  = document.getElementById('webbrowser-url');
    this.statusEl = document.getElementById('webbrowser-status');
    this.refreshBtn = document.getElementById('btn-webbrowser-refresh');
    this.autoBtn    = document.getElementById('btn-webbrowser-auto');
    this.clearBtn   = document.getElementById('btn-webbrowser-clear');
    this._lastContent = '';
    this._lastUrl = '';
    this._autoRefresh = false;
    this._autoTimer = null;
    this._metaRefreshTimer = null;

    this._bind();
  }

  _bind() {
    this.refreshBtn?.addEventListener('click', () => this._refresh());
    this.autoBtn?.addEventListener('click', () => this.toggleAutoRefresh());
    this.clearBtn?.addEventListener('click', () => this.clear());

    if (this.addrBar) {
      this.addrBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._navigate(this.addrBar.value);
        }
      });
    }
  }

  _navigate(rawUrl) {
    if (!rawUrl) return;
    var path = rawUrl.trim();
    try {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        var u = new URL(path);
        path = u.pathname + (u.search || '');
      }
    } catch (_) {}
    if (!path.startsWith('/')) path = '/' + path;
    var sim = (window.parent && window.parent.ArduinoSim) || window.ArduinoSim || (window.App && window.App.sim);
    if (sim && sim._web && typeof sim._web._triggerRoute === 'function') {
      sim._web._triggerRoute(path);
    }
  }

  toggleAutoRefresh(forceState) {
    if (forceState !== undefined) {
      this._autoRefresh = !!forceState;
    } else {
      this._autoRefresh = !this._autoRefresh;
    }
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
    if (this._autoRefresh) {
      this._autoTimer = setInterval(() => {
        var sim = (window.parent && window.parent.ArduinoSim) || window.ArduinoSim || (window.App && window.App.sim);
        if (sim && sim._web && typeof sim._web._triggerRoute === 'function') {
          sim._web._triggerRoute(this._lastUrl || '/');
        }
      }, 1000);
    }
    if (this.autoBtn) {
      this.autoBtn.textContent = this._autoRefresh ? 'Auto: ON' : 'Auto: OFF';
      this.autoBtn.style.color = this._autoRefresh ? 'var(--run-color, #4CAF50)' : '';
      this.autoBtn.style.borderColor = this._autoRefresh ? 'var(--run-color, #4CAF50)' : '';
    }
  }

  stopTimers() {
    if (this._metaRefreshTimer) {
      clearTimeout(this._metaRefreshTimer);
      this._metaRefreshTimer = null;
    }
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
    this._autoRefresh = false;
    if (this.autoBtn) {
      this.autoBtn.textContent = 'Auto: OFF';
      this.autoBtn.style.color = '';
      this.autoBtn.style.borderColor = '';
    }
  }

  _scheduleMetaRefresh(html) {
    if (this._metaRefreshTimer) {
      clearTimeout(this._metaRefreshTimer);
      this._metaRefreshTimer = null;
    }
    if (!html || typeof html !== 'string') return;
    var match = html.match(/<meta\s+[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?(\d+)[^"'>]*["']?/i)
             || html.match(/<meta\s+[^>]*content=["']?(\d+)[^"'>]*["']?[^>]*http-equiv=["']?refresh["']?/i);
    if (match && match[1]) {
      var sec = parseInt(match[1], 10);
      if (sec > 0 && !this._autoRefresh) {
        this._metaRefreshTimer = setTimeout(() => {
          this._refresh();
        }, sec * 1000);
      }
    }
  }

  render(resp) {
    if (!resp || !resp.content) return;

    this._lastContent = resp.content;
    this._lastUrl = resp.url || '/';

    if (this.addrBar) {
      var ip = '192.168.4.1';
      try {
        var canvas = window.CircuitCanvas;
        if (canvas && Array.isArray(canvas.components)) {
          var wifi = canvas.components.find(function (c) { return c.type === 'wifi_module'; });
          if (wifi && wifi.props && wifi.props.ipAddress) ip = wifi.props.ipAddress;
        }
      } catch (_) {}
      this.addrBar.value = 'http://' + ip + this._lastUrl;
    }

    if (this.statusEl) {
      this.statusEl.textContent = resp.code + ' ' + resp.type;
      this.statusEl.style.color = resp.code >= 200 && resp.code < 400
        ? 'var(--run-color)' : 'var(--stop-color)';
    }

    if (this.iframe) {
      try {
        var doc = this.iframe.contentDocument || this.iframe.contentWindow.document;
        doc.open();
        doc.write(resp.content);
        doc.close();
        this._injectLinkInterceptor();
      } catch (e) {
        try {
          if (this.iframe.src && this.iframe.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.iframe.src);
          }
          var blob = new Blob([resp.content], { type: 'text/html' });
          this.iframe.src = URL.createObjectURL(blob);
        } catch (e2) {
          // silently fail
        }
      }
    }

    this._scheduleMetaRefresh(resp.content);
  }

  _injectLinkInterceptor() {
    try {
      var doc = this.iframe.contentDocument || this.iframe.contentWindow.document;
      if (!doc) return;

      doc.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) return;

        e.preventDefault();
        e.stopPropagation();

        if (window.parent && window.parent.ArduinoSim && window.parent.ArduinoSim._emitWebNavigate) {
          window.parent.ArduinoSim._emitWebNavigate(href);
        }
      }, true);

      var win = this.iframe.contentWindow;
      if (win && !win.__fetchIntercepted) {
        win.__fetchIntercepted = true;
        win.fetch = function(input) {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var sim = window.parent && window.parent.ArduinoSim;
          if (sim && sim._web && sim._web._triggerRoute) {
            sim._web._triggerRoute(url, { ajax: true });
          }
          // Wait for the handler to execute and produce a response
          return new Promise(function(resolve) {
            var checks = 0;
            var poll = function() {
              var resp = (sim && sim._webResp) || null;
              if (resp || checks++ > 20) {
                resolve(new Response((resp && resp.content) || 'OK', {
                  status: (resp && resp.code) || 200,
                  headers: { 'Content-Type': (resp && resp.type) || 'text/plain' }
                }));
              } else {
                setTimeout(poll, 10);
              }
            };
            poll();
          });
        };
      }
    } catch (e) {
      // cross-origin — ignore
    }
  }

  _refresh() {
    var sim = (window.parent && window.parent.ArduinoSim) || window.ArduinoSim || (window.App && window.App.sim);
    if (sim && sim._web && typeof sim._web._triggerRoute === 'function') {
      sim._web._triggerRoute(this._lastUrl || '/');
      return;
    }

    if (this._lastContent && this.iframe) {
      try {
        var doc = this.iframe.contentDocument || this.iframe.contentWindow.document;
        doc.open();
        doc.write(this._lastContent);
        doc.close();
        this._injectLinkInterceptor();
      } catch (e) {
        try {
          if (this.iframe.src && this.iframe.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.iframe.src);
          }
          var blob = new Blob([this._lastContent], { type: 'text/html' });
          this.iframe.src = URL.createObjectURL(blob);
        } catch (e2) {
          // ignore
        }
      }
    }
  }

  clear() {
    this.stopTimers();
    if (this.iframe) {
      try {
        var doc = this.iframe.contentDocument || this.iframe.contentWindow.document;
        doc.open();
        doc.write('');
        doc.close();
      } catch (e) {
        if (this.iframe.src && this.iframe.src.startsWith('blob:')) {
          URL.revokeObjectURL(this.iframe.src);
        }
        this.iframe.src = 'about:blank';
      }
    }
    if (this.addrBar) this.addrBar.value = 'about:blank';
    if (this.statusEl) {
      this.statusEl.textContent = 'No response';
      this.statusEl.style.color = '';
    }
    this._lastContent = '';
    this._lastUrl = '';
  }
}

window.WebBrowserClass = WebBrowser;
