/**
 * SoftwareSerial Library Plugin for ArduSim
 *
 * Provides SoftwareSerial simulation.
 * Supports: begin, write, println, read, available, peek, end, flush, listen, isListening.
 */
window.ArduinoLibs = window.ArduinoLibs || {};
window.ArduinoLibs['SoftwareSerial'] = {
  classes: ['SoftwareSerial'],
  includes: ['<SoftwareSerial.h>'],
  priority: 40,

  transpile: [
    [/[\s\S]+/g, function(code) {
      var serials = [];
      var match;
      var declaration = /\bSoftwareSerial\s+(\w+)\s*\(|\bvar\s+(\w+)\s*=\s*_a\.softwareSerialNew\s*\(/g;
      while ((match = declaration.exec(code)) !== null) serials.push(match[1] || match[2]);
      serials.forEach(function(name) {
        var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        code = code.replace(new RegExp('\\b' + escaped + '\\.begin\\s*\\(([^)]*)\\)', 'g'),
          '_a.softSerialBegin(' + name + ', $1)');
      });
      return code;
    }],
    [/\bSoftwareSerial\s+(\w+)\s*\(([^)]+)\)/g, 'var $1 = _a.softwareSerialNew($2)'],
    [/\b(\w+)\.println\s*\(/g, function(match, v) {
      if (v === 'Serial') return match;
      return '_a.genericPrintln(' + v + ', ';
    }],
    [/\b(\w+)\.listen\s*\(/g, '_a.softSerialListen($1)'],
    [/\b(\w+)\.isListening\s*\(/g, '_a.softSerialIsListening($1)'],
  ],

  runtime: function(self) {
    return {
      softwareSerialNew: function(rxPin, txPin) {
        var id = '_ss_' + rxPin + '_' + txPin;
        var buf = [];
        self._softSerial = self._softSerial || {};
        var ch = { rxPin: rxPin, txPin: txPin, buf: buf, listening: true, baud: 9600 };
        self._softSerial[id] = ch;
        self._serialLog('[SoftwareSerial] Created rx=' + rxPin + ' tx=' + txPin + '\n', 'system');

        var inst = {
          _ssId: id,
          rxPin: rxPin,
          txPin: txPin,
          begin: function(baud) {
            ch.listening = true;
            ch.baud = baud || 9600;
            self._serialLog('[SoftwareSerial] begin(' + ch.baud + ')\n', 'system');
          },
          available: function() {
            return ch.listening ? ch.buf.length : 0;
          },
          read: function() {
            if (!ch.listening || ch.buf.length === 0) return -1;
            var c = ch.buf.shift();
            return typeof c === 'number' ? c : c.charCodeAt(0);
          },
          peek: function() {
            if (!ch.listening || ch.buf.length === 0) return -1;
            var c = ch.buf[0];
            return typeof c === 'number' ? c : c.charCodeAt(0);
          },
          readString: function() {
            if (!ch.listening || ch.buf.length === 0) return '';
            var s = '';
            while (ch.buf.length > 0) {
              var c = ch.buf.shift();
              s += typeof c === 'number' ? String.fromCharCode(c) : c;
            }
            return s;
          },
          readStringUntil: function(terminator) {
            if (!ch.listening || ch.buf.length === 0) return '';
            var s = '';
            var termCode = typeof terminator === 'string' ? terminator.charCodeAt(0) : terminator;
            while (ch.buf.length > 0) {
              var c = ch.buf.shift();
              var code = typeof c === 'number' ? c : c.charCodeAt(0);
              if (code === termCode) break;
              s += String.fromCharCode(code);
            }
            return s;
          },
          write: function(val) {
            var text = typeof val === 'number' ? String.fromCharCode(val) : String(val);
            self._serialLog(text, 'data');
            return 1;
          },
          print: function(val) {
            self._serialLog(val !== undefined ? String(val) : '', 'data');
          },
          println: function(val) {
            self._serialLog((val !== undefined ? String(val) : '') + '\n', 'data');
          },
          listen: function() {
            ch.listening = true;
            return true;
          },
          isListening: function() {
            return !!ch.listening;
          },
          end: function() {
            ch.listening = false;
          },
          flush: function() {
            ch.buf.length = 0;
          },
        };
        return inst;
      },
      softSerialBegin: function(obj, baud) {
        if (obj && typeof obj.begin === 'function') {
          obj.begin(baud);
          return;
        }
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch) { ch.listening = true; ch.baud = baud; }
        self._serialLog('[SoftwareSerial] begin(' + baud + ')\n', 'system');
      },
      softSerialWrite: function(obj, val) {
        if (obj && typeof obj.write === 'function') {
          return obj.write(val);
        }
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch) { self._serialLog('[SoftwareSerial] write(' + val + ')\n', 'data'); }
      },
      softSerialPrintln: function(obj, val) {
        if (obj && typeof obj.println === 'function') {
          return obj.println(val);
        }
        self._serialLog(String(val) + '\n', 'data');
      },
      genericPrintln: function(obj, val) {
        var text = String(val);
        if (obj && obj.__tft) {
          var cursor = self._tftCursor || { col: 0, row: 0 };
          var size = self._tftTextSize || 1;
          var fg = self._tftFgColor != null ? self._tftFgColor : 0xFFFF;
          var bg = self._tftBgColor != null ? self._tftBgColor : 0x0000;
          self._emitEvent('tft_draw', { op: 'print', text: text, x: cursor.col, y: cursor.row, size: size, fg: fg, bg: bg });
          self._tftCursor = { col: 0, row: cursor.row + 8 * size };
          return;
        }
        if (obj && obj.__oled) {
          var cursor2 = self._lcdCursor || { col: 0, row: 0 };
          var size2 = self._oledTextSize || 1;
          self._emitEvent('oled_draw', { op: 'print', text: text, cursor: { col: cursor2.col, row: cursor2.row }, size: size2, color: self._oledTextColor === 0 ? 0 : 1 });
          self._lcdCursor = { col: 0, row: cursor2.row + 8 * size2 };
          return;
        }
        if (obj && typeof obj.println === 'function') {
          obj.println(val);
          return;
        }
        if (obj && obj._ssId) {
          self._serialLog(text + '\n', 'data');
          return;
        }
        self._serialLog(text + '\n', 'data');
      },
      softSerialRead: function(obj) {
        if (obj && typeof obj.read === 'function') return obj.read();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch && ch.buf.length > 0) {
          var c = ch.buf.shift();
          return typeof c === 'number' ? c : c.charCodeAt(0);
        }
        return -1;
      },
      softSerialAvailable: function(obj) {
        if (obj && typeof obj.available === 'function') return obj.available();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        return (ch && ch.listening) ? ch.buf.length : 0;
      },
      softSerialPeek: function(obj) {
        if (obj && typeof obj.peek === 'function') return obj.peek();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch && ch.buf.length > 0) {
          var c = ch.buf[0];
          return typeof c === 'number' ? c : c.charCodeAt(0);
        }
        return -1;
      },
      softSerialEnd: function(obj) {
        if (obj && typeof obj.end === 'function') return obj.end();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch) ch.listening = false;
      },
      softSerialFlush: function(obj) {
        if (obj && typeof obj.flush === 'function') return obj.flush();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch) ch.buf.length = 0;
      },
      softSerialListen: function(obj) {
        if (obj && typeof obj.listen === 'function') return obj.listen();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        if (ch) ch.listening = true;
      },
      softSerialIsListening: function(obj) {
        if (obj && typeof obj.isListening === 'function') return obj.isListening();
        var ch = self._softSerial && self._softSerial[obj && obj._ssId];
        return ch ? !!ch.listening : false;
      },
    };
  },

  constants: {},
  constructor: function(args) {
    return { rx: args[0] || 0, tx: args[1] || 0 };
  },
};
