/* 
   js/electrical.js — Electrical Connection Engine
   Circuit graph builder, net tracer, voltage/current solver.
*/

'use strict';

/**
 * Net — a set of electrically connected pins sharing the same voltage.
 */
class Net {
  constructor(id) {
    this.id = id;
    /** @type {Map<string,{instId:string, pinId:string}>} pinId ← { instId, pinId } */
    this.pins = new Map();
    /** @type {{voltage:number, type:string, resistance:number, rawVal?:number}[]} */
    this.sources = [];
    /** @type {{instId:string, pinId:string, resistance:number}[]} */
    this.grounds = [];
    /** Resolved voltage for this net */
    this.voltage = 0;
    /** Total equivalent resistance to ground */
    this.resistanceToGround = Infinity;
  }

  addPin(instId, pinId) {
    this.pins.set(`${instId}:${pinId}`, { instId, pinId });
  }

  hasPin(instId, pinId) {
    return this.pins.has(`${instId}:${pinId}`);
  }
}

/**
 * ElectricalEngine — builds circuit graph and solves voltages.
 *
 * Usage:
 *   const engine = new ElectricalEngine(components, wires);
 *   engine.solve();
 *   const net = engine.getNetForPin('comp_1', 'anode');
 *   console.log(net.voltage);
 */
class ElectricalEngine {
  constructor() {
    /** @type {import('./components/base').Component[]} */
    this.components = [];
    /** @type {{from:{instId:string,pinId:string}, to:{instId:string,pinId:string}}[]} */
    this.wires = [];
    /** @type {Map<string,Net>} netKey ← Net */
    this.nets = new Map();
    /** @type {Map<string,Net>} "instId:pinId" ← Net */
    this.pinToNet = new Map();
    /** Ground net reference */
    this.groundNet = null;
  }

  /* -------------------------- GRAPH CONSTRUCTION ------------------------------- */

  /**
   * Build the circuit graph from components and wires.
   * Call this whenever the circuit changes.
   */
  buildGraph(components, wires) {
    this.components = components || [];
    this.wires = wires || [];
    this.nets.clear();
    this.pinToNet.clear();
    this.groundNet = null;
    this._adjacency = null;

    // 1. Union-Find to group connected pins into nets
    const parent = new Map();
    const find = (key) => {
      if (!parent.has(key)) parent.set(key, key);
      let root = key;
      while (parent.get(root) !== root) root = parent.get(root);
      // Path compression
      let curr = key;
      while (curr !== root) { const next = parent.get(curr); parent.set(curr, root); curr = next; }
      return root;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    // Register all component pins
    const { COMPONENT_DEFS } = window.ArduinoComponents || {};
    for (const inst of this.components) {
      const def = COMPONENT_DEFS && COMPONENT_DEFS[inst.type];
      if (!def || !def.pins) continue;
      for (const pin of def.pins) {
        const key = `${inst.id}:${pin.id}`;
        find(key); // ensure it exists
      }
    }

    // Union pins connected by wires
    for (const wire of this.wires) {
      const a = `${wire.from.instId}:${wire.from.pinId}`;
      const b = `${wire.to.instId}:${wire.to.pinId}`;
      union(a, b);
    }

    // Union pins connected through component internals
    for (const inst of this.components) {
      const connections = this._getInternalConnections(inst);
      for (const [a, b] of connections) {
        union(a, b);
      }
    }

    // 2. Build Net objects from union-find groups
    const groups = new Map(); // rootKey ← Net
    for (const [key] of parent) {
      const root = find(key);
      if (!groups.has(root)) groups.set(root, new Net(root));
      const net = groups.get(root);
      const [instId, pinId] = key.split(':');
      net.addPin(instId, pinId);
      this.pinToNet.set(key, net);
    }

    // Also create nets for unconnected pins (isolated)
    for (const inst of this.components) {
      const def = COMPONENT_DEFS && COMPONENT_DEFS[inst.type];
      if (!def || !def.pins) continue;
      for (const pin of def.pins) {
        const key = `${inst.id}:${pin.id}`;
        if (!this.pinToNet.has(key)) {
          const net = new Net(key);
          net.addPin(inst.id, pin.id);
          this.pinToNet.set(key, net);
          this.nets.set(key, net);
        }
      }
    }

    // Move grouped nets to main map
    for (const [, net] of groups) {
      this.nets.set(net.id, net);
    }
  }

  /**
   * Get internal pin connections for a component (e.g., switch contacts).
   * Returns array of [pinA_key, pinB_key] pairs.
   * Resistors and capacitors are NOT shorted — they are resistive elements
   * solved by the nodal analysis in solve().
   */
  _getInternalConnections(inst) {
    const conns = [];
    const key = (pin) => `${inst.id}:${pin}`;

    switch (inst.type) {
      // Resistors and capacitors are NOT shorted here.
      // They are modeled as conductance edges in the nodal solver.
      case 'resistor':
      case 'capacitor':
        break;
      case 'diode_1n4007':
        // Forward-biased: anode ← cathode (handled in solve, not graph)
        break;
      case 'push_button': {
        const pressed = inst.runtimeState?.pressed;
        if (pressed) {
          conns.push([key('p1'), key('p3')]);
          conns.push([key('p2'), key('p4')]);
        } else {
          conns.push([key('p1'), key('p2')]);
          conns.push([key('p3'), key('p4')]);
        }
        break;
      }
      case 'relay': {
        const active = inst.runtimeState?.active;
        if (active) {
          conns.push([key('com'), key('no')]);
        } else {
          conns.push([key('com'), key('nc')]);
        }
        break;
      }
      case 'slide_switch': {
        // SPDT: the blade always touches exactly one throw
        const throwPin = typeof window._slideSwitchThrow === 'function'
          ? window._slideSwitchThrow(inst) : 'a';
        conns.push([key('com'), key(throwPin)]);
        break;
      }
      case 'ssr_8ch': {
        const channels = inst.runtimeState?.channels || [];
        for (let i = 1; i <= 8; i++) {
          if (channels[i - 1]) conns.push([key(`out${i}a`), key(`out${i}b`)]);
        }
        break;
      }
      case 'multimeter': {
        // In current mode, the multimeter is a short circuit (0Ω) — probes are
        // connected. props is the source of truth (runtimeState.mode mirrors it
        // and can lag behind a mode switch made in the property panel).
        // All three jacks are commoned so wiring through the 10A terminal works.
        const mode = inst.props?.mode || inst.runtimeState?.mode || 'V_DC';
        if (mode === 'A_DC' || mode === 'A_AC') {
          conns.push([key('probe_red'), key('probe_com')]);
          conns.push([key('probe_amp'), key('probe_com')]);
        }
        break;
      }
      case 'breadboard':
      case 'breadboard_small': {
        // Breadboard groups: rows a-e share a rail, rows f-j share a rail
        const groups = {};
        const def = (window.ArduinoComponents?.COMPONENT_DEFS || {})[inst.type];
        if (def && def.pins) {
          for (const pin of def.pins) {
            const g = this._breadboardGroup(pin.id);
            if (g) {
              if (!groups[g]) groups[g] = [];
              groups[g].push(pin.id);
            }
          }
        }
        for (const pinIds of Object.values(groups)) {
          for (let i = 1; i < pinIds.length; i++) {
            conns.push([key(pinIds[0]), key(pinIds[i])]);
          }
        }
        break;
      }
      // Switches: just pass-through
      case 'dip_switch':
        // DIP switch doesn't have internal connections (each switch is separate)
        break;
    }
    return conns;
  }

  _breadboardGroup(pinId) {
    // Must mirror js/components/passive.js pin ids: all five holes in each
    // column share a node, while the two halves and four rails stay isolated.
    if (!pinId) return null;
    const railMatch = /^(rp|rn|bp|bn)\d*$/.exec(pinId);
    if (railMatch) return { rp: 'rail_tp', rn: 'rail_tn', bp: 'rail_bp', bn: 'rail_bn' }[railMatch[1]];
    const m = /^([ul])([tb])(\d+)$/.exec(pinId);
    if (m) return m[1] + m[3];
    const middle = /^([ul])m[123](\d+)$/.exec(pinId);
    if (middle) return middle[1] + middle[2];
    return null;
  }

  /* --------------------------- NET SOLVING ----------------------------------- */

  /**
   * Solve the circuit using nodal analysis (Gauss-Seidel iteration).
   * Computes correct voltages for resistive networks including voltage dividers.
   * Call after buildGraph().
   * @param {CircuitCanvas} canvas — canvas instance for pin number resolution
   */
  solve(canvas) {
    const { COMPONENT_DEFS } = window.ArduinoComponents || {};
    this._canvas = canvas || null;

    // Clear previous solve data
    for (const [, net] of this.nets) {
      net.sources = [];
      net.grounds = [];
      net.voltage = 0;
      net.resistanceToGround = Infinity;
    }

    // 1. Classify components — identify voltage sources and grounds
    for (const inst of this.components) {
      this._classifyComponent(inst);
    }

    // 1b. Stack series-cascaded batteries so their voltages add up
    this._resolveBatteryStacks();

    // 2. Build adjacency list from resistive elements (resistors, bulbs, diodes, etc.)
    //    Each edge connects two nets with a resistance value.
    const adjacency = new Map(); // netId ← [{ net, resistance, tag }]
    const addEdge = (netA, netB, resistance, tag = null) => {
      if (!netA || !netB || netA === netB || resistance <= 0) return;
      if (!adjacency.has(netA.id)) adjacency.set(netA.id, []);
      if (!adjacency.has(netB.id)) adjacency.set(netB.id, []);
      adjacency.get(netA.id).push({ net: netB, resistance, tag });
      adjacency.get(netB.id).push({ net: netA, resistance, tag });
    };

    const removeEdgesByTag = (tag) => {
      if (!tag) return;
      for (const [, list] of adjacency) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].tag === tag) list.splice(i, 1);
        }
      }
    };

    const transistors = [];
    const diodes = [];
    for (const inst of this.components) {
      if (inst.type === 'npn_transistor' || inst.type === 'pnp_transistor') {
        transistors.push(inst);
        continue;
      }
      if (inst.type === 'diode_1n4007') {
        diodes.push(inst);
        continue;
      }

      // Only the bulb gets a real resistive edge here (its 12Ω filament is
      // physically meaningful). LEDs and diodes stay inert in solve(): a
      // single linear resistance cannot model their forward drop — a 20Ω
      // edge would wrongly divide the rail through the cathode ground path.
      // (measureResistance() has its own LED/diode edges for continuity.)
      const net1 = this.getNetForPin(inst.id, inst.type === 'bulb_12v' ? 'anode' : 'p1');
      const net2 = this.getNetForPin(inst.id, inst.type === 'bulb_12v' ? 'cathode' : 'p2');
      if (!net1 || !net2) continue;

      switch (inst.type) {
        case 'resistor': {
          const r = (Number(inst.props?.value) || 220)
            * (inst.props?.unit === 'kΩ' ? 1e3 : inst.props?.unit === 'MΩ' ? 1e6 : 1);
          addEdge(net1, net2, Math.max(r, 0.01));
          break;
        }
        case 'capacitor':
          // DC steady-state: capacitor is open circuit (very high resistance)
          addEdge(net1, net2, 1e9);
          break;
        case 'bulb_12v':
          addEdge(net1, net2, 12); // filament
          break;
        case 'led':
        case 'led_green':
        case 'led_blue':
        case 'led_yellow':
        case 'led_orange':
        case 'led_white':
          // Intentionally no solve() edge — see comment above.
          break;
      }
    }

    // 3. Initialize voltages from sources and grounds
    const fixedNets = new Set();
    for (const [, net] of this.nets) {
      if (net.sources.length > 0) {
        net.voltage = net.sources.sort((a, b) => b.voltage - a.voltage)[0].voltage;
        fixedNets.add(net.id);
      } else if (net.grounds.length > 0) {
        net.voltage = 0;
        fixedNets.add(net.id);
      }
    }

    // 4. Gauss-Seidel iterative relaxation to solve KCL at each free node
    //    For each free node: V = Σ(V_neighbor / R_neighbor) / Σ(1 / R_neighbor)
    const relaxVoltages = () => {
      for (let iter = 0; iter < 200; iter++) {
        let maxDelta = 0;
        for (const [netId, net] of this.nets) {
          if (fixedNets.has(netId)) continue;
          const neighbors = adjacency.get(netId);
          if (!neighbors || neighbors.length === 0) continue;

          let sumG = 0;
          let sumVG = 0;
          for (const { net: neighbor, resistance } of neighbors) {
            const g = 1 / resistance;
            sumG += g;
            sumVG += neighbor.voltage * g;
          }
          if (sumG > 0) {
            const newV = sumVG / sumG;
            maxDelta = Math.max(maxDelta, Math.abs(newV - net.voltage));
            net.voltage = newV;
          }
        }
        if (maxDelta < 0.0001) break;
      }
    };

    relaxVoltages();

    // Helper to evaluate external Thevenin equivalent (Voc, Rth) seen by a pin's net,
    // excluding edges associated with specific internal component tags.
    const getNetThevenin = (net, excludeTags = []) => {
      if (!net) return { voc: 0, rth: Infinity };
      if (net.sources && net.sources.length > 0) {
        const v = [...net.sources].sort((a, b) => b.voltage - a.voltage)[0].voltage;
        return { voc: v, rth: 0.05 };
      }
      if (net.grounds && net.grounds.length > 0) {
        return { voc: 0, rth: 0.05 };
      }
      const neighbors = adjacency.get(net.id) || [];
      let sumG = 0;
      let sumVG = 0;
      for (const edge of neighbors) {
        if (edge.tag && excludeTags.includes(edge.tag)) continue;
        const g = 1 / Math.max(0.001, edge.resistance);
        sumG += g;
        sumVG += edge.net.voltage * g;
      }
      if (sumG <= 0) return { voc: 0, rth: Infinity };
      return { voc: sumVG / sumG, rth: 1 / sumG };
    };

    const BJT_DEFAULT_MODELS = {
      '2N2222': { beta: 160, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 100, is_npn: true },
      'BC547':  { beta: 250, vbe_on: 0.66, vce_sat: 0.15, early_voltage: 120, is_npn: true },
      '2N3904': { beta: 100, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 80,  is_npn: true },
      'TIP31C': { beta: 40,  vbe_on: 0.70, vce_sat: 0.30, early_voltage: 60,  is_npn: true },
      '2N2907': { beta: 160, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 100, is_npn: false },
      'BC557':  { beta: 250, vbe_on: 0.66, vce_sat: 0.15, early_voltage: 120, is_npn: false },
      '2N3906': { beta: 100, vbe_on: 0.65, vce_sat: 0.20, early_voltage: 80,  is_npn: false },
      'TIP32C': { beta: 40,  vbe_on: 0.70, vce_sat: 0.30, early_voltage: 60,  is_npn: false },
    };

    // Non-linear resolution loop for Diodes and BJTs (Cutoff, Active, Saturation regions)
    const maxNonlinearPasses = (diodes.length > 0 || transistors.length > 0) ? 3 : 0;
    for (let pass = 0; pass < maxNonlinearPasses; pass++) {
      let anyChange = false;

      // 4a. Diode Modeling (Forward-biased 0.65V drop)
      for (const inst of diodes) {
        const anode = this.getNetForPin(inst.id, 'anode');
        const cathode = this.getNetForPin(inst.id, 'cathode');
        const tag = 'diode_' + inst.id;
        removeEdgesByTag(tag);

        const vAnode = anode?.voltage ?? 0;
        const vCathode = cathode?.voltage ?? 0;
        const forwardBiased = (vAnode - vCathode) >= 0.65;

        inst.runtimeState = inst.runtimeState || {};
        if (inst.runtimeState.conducting !== forwardBiased) anyChange = true;
        inst.runtimeState.conducting = forwardBiased;
        if (forwardBiased) {
          addEdge(anode, cathode, 10, tag);
        }
      }

      // 4b. BJT Transistor Modeling (Cutoff, Active Region with Early Effect, Saturation Region)
      for (const inst of transistors) {
        const isNPN = inst.type === 'npn_transistor';
        const base = this.getNetForPin(inst.id, 'base');
        const emitter = this.getNetForPin(inst.id, 'emitter');
        const collector = this.getNetForPin(inst.id, 'collector');

        const tagB = 'trans_b_' + inst.id;
        const tagC = 'trans_c_' + inst.id;
        removeEdgesByTag(tagB);
        removeEdgesByTag(tagC);

        inst.runtimeState = inst.runtimeState || {};
        const model = inst.props?.model || (isNPN ? '2N2222' : '2N3906');
        const preset = (window.BJT_MODELS && window.BJT_MODELS[model])
          || BJT_DEFAULT_MODELS[model] || {};
        const beta = Math.max(1, Number(inst.props?.beta ?? preset.beta ?? (isNPN ? 160 : 100)));
        const vbe_on = Math.max(0.1, Number(inst.props?.vbe_on ?? preset.vbe_on ?? 0.65));
        const vce_sat = Math.max(0.01, Number(inst.props?.vce_sat ?? preset.vce_sat ?? 0.20));
        const va = Math.max(10, Number(inst.props?.early_voltage ?? preset.early_voltage ?? 100));

        const selfTags = [tagB, tagC];
        const bTh = getNetThevenin(base, selfTags);
        const cTh = getNetThevenin(collector, selfTags);
        const vE = emitter?.voltage ?? 0;

        let region = 'cutoff';
        let ib = 0;
        let ic = 0;
        let rce = 1e7;
        let rbe = 1e7;

        if (isNPN) {
          // --- NPN Transistor ---
          const isForward = bTh.voc > vE + vbe_on;
          if (isForward && base && emitter) {
            ib = Math.max(0, (bTh.voc - (vE + vbe_on)) / (bTh.rth + 25));
            rbe = Math.max(10, (vE + vbe_on) / Math.max(1e-8, ib));
            addEdge(base, emitter, rbe, tagB);
          }

          if (ib > 1e-8 && cTh.voc > vE && collector && emitter) {
            const vceEst = Math.max(0, cTh.voc - vE);
            const icActive = beta * ib * (1 + vceEst / va);
            const icSatMax = Math.max(0, (cTh.voc - (vE + vce_sat)) / Math.max(0.1, cTh.rth));

            if (icActive >= icSatMax) {
              // Saturation: VCE drops to VCE(sat), current is load limited
              region = 'saturation';
              ic = icSatMax;
              rce = Math.max(8, vce_sat / Math.max(1e-5, ic));
            } else {
              // Active: IC = beta * IB * (1 + VCE / VA)
              region = 'active';
              ic = icActive;
              const vceDrop = Math.max(vce_sat, cTh.voc - vE - ic * cTh.rth);
              rce = Math.max(8, vceDrop / Math.max(1e-6, ic));
            }
            addEdge(collector, emitter, rce, tagC);
          }
        } else {
          // --- PNP Transistor ---
          const isForward = bTh.voc < vE - vbe_on;
          if (isForward && base && emitter) {
            ib = Math.max(0, ((vE - vbe_on) - bTh.voc) / (bTh.rth + 25));
            rbe = Math.max(10, vbe_on / Math.max(1e-8, ib));
            addEdge(emitter, base, rbe, tagB);
          }

          if (ib > 1e-8 && cTh.voc < vE && collector && emitter) {
            const vecEst = Math.max(0, vE - cTh.voc);
            const icActive = beta * ib * (1 + vecEst / va);
            const icSatMax = Math.max(0, ((vE - vce_sat) - cTh.voc) / Math.max(0.1, cTh.rth));

            if (icActive >= icSatMax) {
              // Saturation: VEC drops to VEC(sat)
              region = 'saturation';
              ic = icSatMax;
              rce = Math.max(8, vce_sat / Math.max(1e-5, ic));
            } else {
              // Active: IC = beta * IB * (1 + VEC / VA)
              region = 'active';
              ic = icActive;
              const vecDrop = Math.max(vce_sat, vE - cTh.voc - ic * cTh.rth);
              rce = Math.max(8, vecDrop / Math.max(1e-6, ic));
            }
            addEdge(emitter, collector, rce, tagC);
          }
        }

        const conducting = region !== 'cutoff';
        if (inst.runtimeState.conducting !== conducting || inst.runtimeState.region !== region) {
          anyChange = true;
        }

        inst.runtimeState.conducting = conducting;
        inst.runtimeState.region = region;
        inst.runtimeState.ib = ib;
        inst.runtimeState.ic = ic;
        inst.runtimeState.ie = ib + ic;
        inst.runtimeState.rce = rce;
        inst.runtimeState.rbe = rbe;
        inst.runtimeState.model = model;
        inst.runtimeState.beta = beta;
        inst.runtimeState.vbe_on = vbe_on;
        inst.runtimeState.vce_sat = vce_sat;
        inst.runtimeState.early_voltage = va;
      }

      relaxVoltages();
      if (!anyChange && pass > 0) break;
    }

    // Populate post-solve voltages and power dissipation for all transistors
    for (const inst of transistors) {
      const rs = inst.runtimeState || {};
      const baseV = this.getNetForPin(inst.id, 'base')?.voltage ?? 0;
      const emitterV = this.getNetForPin(inst.id, 'emitter')?.voltage ?? 0;
      const collectorV = this.getNetForPin(inst.id, 'collector')?.voltage ?? 0;

      rs.vbe = Math.abs(baseV - emitterV);
      rs.vce = Math.abs(collectorV - emitterV);
      rs.vcb = Math.abs(collectorV - baseV);
      rs.beta_actual = (rs.ib && rs.ib > 1e-7) ? (rs.ic / rs.ib) : (rs.beta || 100);
      rs.power = (rs.vce || 0) * (rs.ic || 0) + (rs.vbe || 0) * (rs.ib || 0);
    }

    // Store adjacency for getSourceAtPin/hasGroundAtPin traversal
    this._adjacency = adjacency;

    // 5. Calculate equivalent resistance to ground for each net
    for (const [, net] of this.nets) {
      net.resistanceToGround = this._calcResistanceToGround(net);
    }
  }

  /**
   * Detect series-cascaded batteries (POS of one wired to NEG of another)
   * and stack their voltages so the multimeter/load sees the sum.
   *
   * Only the bottom battery's NEG is a true 0 V ground; intermediate battery
   * NEG pins sit at elevated potential and must not be marked as ground.
   */
  _resolveBatteryStacks() {
    const batteries = this.components.filter(c => c.type === 'battery');
    if (batteries.length <= 1) return;

    const netId = (instId, pinId) => this.getNetForPin(instId, pinId)?.id;

    // belowMap: batteryId → id of the battery it sits on top of
    // (this battery's NEG shares a net with that battery's POS)
    const belowMap = new Map();
    for (const b of batteries) {
      const negNetId = netId(b.id, 'neg');
      if (!negNetId) continue;
      for (const a of batteries) {
        if (a.id === b.id) continue;
        if (netId(a.id, 'pos') === negNetId) {
          belowMap.set(b.id, a.id);
          break;
        }
      }
    }

    // No series chain (single, parallel, or unconnected) — leave as-is
    if (belowMap.size === 0) return;

    // Cumulative voltage from the bottom of each stack up to this battery
    const cumulative = new Map();
    const computeCumulative = (battId, visited = new Set()) => {
      if (cumulative.has(battId)) return cumulative.get(battId);
      if (visited.has(battId)) return 0;
      visited.add(battId);
      const batt = batteries.find(b => b.id === battId);
      const v = Number(batt.runtimeState?.voltage ?? batt.props?.voltage ?? 3.7);
      const belowId = belowMap.get(battId);
      const total = belowId ? computeCumulative(belowId, visited) + v : v;
      cumulative.set(battId, total);
      return total;
    };
    for (const b of batteries) computeCumulative(b.id);

    for (const b of batteries) {
      const cumV = cumulative.get(b.id);
      const posNet = this.getNetForPin(b.id, 'pos');
      const negNet = this.getNetForPin(b.id, 'neg');

      // POS source voltage = stack voltage (not just this cell's voltage)
      if (posNet) {
        const existing = posNet.sources.find(s => s.type === 'battery' && s.instId === b.id);
        if (existing) {
          existing.voltage = cumV;
        } else {
          posNet.sources.push({
            type: 'battery', voltage: cumV, rawVal: 255,
            resistance: 0, instId: b.id, pinId: 'pos',
          });
        }
      }

      // Only the bottom battery (nothing sits on a chain below it via being
      // a key of belowMap) keeps NEG as ground. Intermediate NEG pins float.
      const isBottom = !belowMap.has(b.id);
      if (negNet) {
        if (isBottom) {
          if (!negNet.grounds.some(g => g.instId === b.id && g.pinId === 'neg')) {
            negNet.grounds.push({ instId: b.id, pinId: 'neg', resistance: 0 });
          }
        } else {
          negNet.grounds = negNet.grounds.filter(
            g => !(g.instId === b.id && g.pinId === 'neg')
          );
        }
      }
    }
  }

  /**
   * Classify a component's pins as voltage sources or grounds.
   */
  _classifyComponent(inst) {
    const netOf = (pinId) => this.getNetForPin(inst.id, pinId);
    const addSource = (pinId, type, voltage, rawVal, resistance) => {
      const net = netOf(pinId);
      if (net) net.sources.push({ type, voltage, rawVal: rawVal ?? 255, resistance: resistance || 0, instId: inst.id, pinId });
    };
    const addGround = (pinId, type, resistance) => {
      const net = netOf(pinId);
      if (net) net.grounds.push({ instId: inst.id, pinId, resistance: resistance || 0 });
    };

    switch (inst.type) {
      case 'arduino_uno':
      case 'arduino_nano':
      case 'esp32_devkit_v1':
      case 'stm32f746_disco':
      case 'lpc2148':
      case 'pico2w':
      case 'intel_8085':
      case 'intel_8051': {
        const is3v3 = (inst.type === 'esp32_devkit_v1' || inst.type === 'stm32f746_disco' || inst.type === 'lpc2148' || inst.type === 'pico2w');
        const maxV = is3v3 ? 3.3 : 5.0;
        const sim = window.ArduinoSim;

        // Iterate over all pins on this component that have nets
        for (const [pinKey, net] of this.pinToNet) {
          if (!pinKey.startsWith(inst.id + ':')) continue;
          const pinId = pinKey.slice(inst.id.length + 1);

          if (pinId === '5V' || pinId === 'VIN' || pinId === '5V2' || pinId === 'VCC' || pinId === 'VBUS' || pinId === 'IOREF') {
            // A battery wired straight to the supply rail IS the supply —
            // don't override its voltage with the board's fixed 5 V rail.
            if (!this._railHasBattery(inst.id, pinId)) addSource(pinId, '5v', 5.0, 255);
          } else if (pinId === '3V3' || pinId === '3V3OUT') {
            if (!this._railHasBattery(inst.id, pinId)) addSource(pinId, '3v3', 3.3, 168);
          } else if (pinId === 'GND1' || pinId === 'GND2' || pinId === 'GND3' || pinId === 'GND4' || pinId === 'GND5' || pinId === 'GND6' || pinId === 'GND7' || pinId === 'GND_D' || pinId === 'GND' || pinId === 'AGND') {
            addGround(pinId, 'gnd');
          } else {
            const pinNum = this._canvas?._pinToNumber?.(pinId);
            if (pinNum != null) {
              const pinMode = sim?.pinModes?.[`pin_${pinNum}`];
              // ESP32 GPIO34-39 are input-only: they can never drive the
              // graph, so treat them as passive regardless of pinMode —
              // otherwise an unconfigured ADC pin is grounded and reads 0 V.
              const inputOnly = inst.type === 'esp32_devkit_v1' && pinNum >= 34 && pinNum <= 39;
              if (inputOnly || pinMode === 'INPUT' || pinMode === 'INPUT_PULLUP' || pinMode === 'INPUT_PULLDOWN') {
                // Input pins are passive readers — don't drive the electrical graph.
                // Their solved voltages are fed back to pinStates in updateSimState.
              } else {
                const rawVal = sim?.pinStates?.[`pin_${pinNum}`] || 0;
                if (rawVal > 0) {
                  addSource(pinId, 'digital', maxV * (rawVal > 1 ? rawVal / 255 : 1), rawVal);
                } else {
                  addGround(pinId, 'digital_low');
                }
              }
            }
          }
        }
        break;
      }
      case 'power_5v':
        addSource('vcc', '5v', 5.0, 255);
        addGround('gnd', 'gnd');
        break;
      case 'logic_level_in':
        // Free logic input tag - drives the net as a constant 0/1 source
        if (inst.props && inst.props.level) addSource('out', 'logic_high', 5.0, 255);
        else addGround('out', 'logic_low');
        break;
      case 'water_flow_sensor': {
        // YF-S201 Hall-effect pulse output: push-pull square wave on SIG.
        // Driving the net here (instead of poking pinStates directly) lets the
        // INPUT/INPUT_PULLUP feed-back in updateSimState derive the pin level
        // and emit the edges that fire the sketch's attachInterrupt().
        if (inst.runtimeState && inst.runtimeState.pulseHigh) addSource('SIG', 'digital', 5.0, 255);
        else addGround('SIG', 'digital_low');
        break;
      }
      case 'power_gnd':
        addGround('gnd', 'gnd');
        break;
      case 'mb102_power': {
        const powered = inst.runtimeState?.powered ?? inst.props?.powered ?? 1;
        if (powered) {
          const topV = inst.props?.topVoltage ?? '5V';
          const voltageMap = { '5V': 5.0, '3.3V': 3.3, 'OFF': 0 };
          if (voltageMap[topV] > 0) addSource('vcc_t', topV, voltageMap[topV], 255);
          addSource('aux_5v', '5v', 5.0, 255);
        }
        addGround('gnd_t', 'gnd');
        addGround('gnd_b', 'gnd');
        addGround('aux_gnd', 'gnd');
        break;
      }
      case 'bench_power_supply': {
        const powered = inst.runtimeState?.powered ?? inst.props?.powered ?? 1;
        const outputOn = powered && (inst.runtimeState?.outputEnabled ?? inst.props?.outputEnabled ?? 1);
        const vSet = inst.runtimeState?.voltageSet ?? inst.props?.voltageSet ?? 12.0;
        if (outputOn && vSet > 0) {
          addSource('POS', 'bench_v+', vSet, 255);
          addSource('NEG', 'bench_v-', -vSet, 0);
        }
        if (powered) addSource('VCC_5V', '5V_fixed', 5.0, 255);
        addGround('GND', 'gnd');
        addGround('GND_5V', 'gnd');
        break;
      }
      case 'battery': {
        const voltage = inst.runtimeState?.voltage ?? inst.props?.voltage ?? 3.7;
        addSource('pos', 'battery', voltage, 255);
        addGround('neg', 'gnd');
        break;
      }
      case 'ic_555':
      case 'ic_74hc04':
      case 'ic_74hc00':
      case 'ic_74hc08':
      case 'ic_74hc32':
      case 'ic_74hc595':
      case 'ic_74hc138':
      case 'ic_74hc245':
      case 'ic_74hc74':
      case 'ic_74hc165':
      case 'ic_74hc193':
      case 'ic_74hc47':
      case 'ic_74hc148':
      case 'ic_74hc02':
      case 'ic_74hc86':
      case 'ic_74hc139':
      case 'ic_74hc153':
      case 'ic_74hc164':
      case 'ic_74hc4017':
      case 'lm741':
      case 'lm358':
      case 'lm393':
      case 'lm324':
      case 'cd4066':
      case 'ic_74hc14':
      case 'ic_74hc283':
      case 'ic_74hc85':
      case 'ic_74hc151':
      case 'ic_74hc76':
      case 'ic_8255':
        this._classifyIC(inst);
        break;
      case 'func_gen': {
        const rs = inst.runtimeState || {};
        const powered = inst.props?.powered ?? 1;
        if (powered) {
          addSource('ch1_out', 'func_gen', rs.ch1_voltage ?? 0, 255);
          addSource('ch2_out', 'func_gen', rs.ch2_voltage ?? 0, 255);
        }
        break;
      }
      case 'v_to_i_420ma': {
        // 4-20mA loop driver: the OUT+ pin carries the voltage the loop current
        // develops across a 250Ω shunt (4mA→1.0V … 20mA→5.0V, V = I × 250Ω).
        const mA = inst.runtimeState?.current ?? 12;
        const raw = Math.max(0, Math.min(255, Math.round((mA / 20) * 255)));
        addSource('OUT+', 'current_loop', mA / 4, raw);
        addGround('GND', 'gnd');
        break;
      }
      case 'i_to_v_420ma': {
        // Receiver output: 0-5V analog signal for an Arduino input pin.
        const vOut = Math.max(0, inst.runtimeState?.vOut ?? 0);
        const raw = Math.max(0, Math.min(255, Math.round((vOut / 5) * 255)));
        addSource('VOUT', 'analog_out', vOut, raw);
        addGround('GND', 'gnd');
        break;
      }
    }
  }

  _classifyIC(inst) {
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
    const outPins = IC_OUTPUT_PINS[inst.type] || [];
    for (const pinId of outPins) {
      const net = this.getNetForPin(inst.id, pinId);
      if (!net) continue;
      let rawVal;
      if (inst.type === 'lm741') {
        rawVal = inst.runtimeState?.vOut != null
          ? Math.round((inst.runtimeState.vOut / 5.0) * 255) : 0;
      } else if (inst.type === 'lm358' || inst.type === 'lm324') {
        const v = inst.runtimeState?.[pinId] ?? 0;
        rawVal = Math.max(0, Math.min(255, Math.round((v / 5.0) * 255)));
      } else {
        rawVal = inst.runtimeState?.[pinId] ?? 0;
      }
      if (rawVal > 0) {
        net.sources.push({ type: 'ic_out', voltage: 5.0 * (rawVal > 1 ? rawVal / 255 : 1), rawVal, resistance: 0 });
      } else {
        net.grounds.push({ instId: inst.id, pinId, resistance: 0 });
      }
    }
  }

  _calcResistanceToGround(net) {
    if (net.grounds.length === 0) return Infinity;
    if (net.grounds.length === 1) return net.grounds[0].resistance || 0;
    // Parallel resistance formula: 1/R = sum(1/Ri)
    let invR = 0;
    for (const g of net.grounds) {
      const r = Math.max(0.1, g.resistance || 0.1);
      invR += 1 / r;
    }
    return invR > 0 ? 1 / invR : Infinity;
  }

  /*  -----------------------QUERY API  -----------------------------------*/

  /**
   * Get the Net for a specific pin on a component.
   * @returns {Net|null}
   */
  getNetForPin(instId, pinId) {
    return this.pinToNet.get(`${instId}:${pinId}`) || null;
  }

  /**
   * True when a battery component shares this pin's net (the battery is
   * wired directly to the rail and must be treated as the supply).
   */
  _railHasBattery(instId, pinId) {
    const net = this.getNetForPin(instId, pinId);
    if (!net) return false;
    for (const p of net.pins.values()) {
      if (p.instId === instId) continue;
      const other = this.components.find(c => c.id === p.instId);
      if (other && other.type === 'battery') return true;
    }
    return false;
  }

  /**
   * Get voltage at a pin.
   * @returns {number} voltage in volts
   */
  getVoltageAtPin(instId, pinId) {
    const net = this.getNetForPin(instId, pinId);
    return net ? net.voltage : 0;
  }

  /**
   * Get the best (highest) voltage source connected to a pin.
   * Traces through the adjacency (resistive edges) to find sources on
   * connected nets — needed because resistors are no longer shorted.
   * @returns {{voltage:number, rawVal:number, type:string, resistance:number}|null}
   */
  getSourceAtPin(instId, pinId) {
    const net = this.getNetForPin(instId, pinId);
    if (!net) return null;
    if (net.sources.length > 0) {
      return net.sources.sort((a, b) => b.voltage - a.voltage)[0];
    }
    if (!this._adjacency || this._adjacency.size === 0) return null;
    const visited = new Set();
    const queue = [net];
    visited.add(net.id);
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const { net: neighbor } of (this._adjacency.get(cur.id) || [])) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        if (neighbor.sources.length > 0) {
          const best = neighbor.sources.sort((a, b) => b.voltage - a.voltage)[0];
          return { ...best, resistance: best.resistance };
        }
        queue.push(neighbor);
      }
    }
    return null;
  }

  /**
   * Check if a pin has a ground path.
   * Traces through the adjacency (resistive edges) to find grounds on
   * connected nets.
   */
  hasGroundAtPin(instId, pinId) {
    const net = this.getNetForPin(instId, pinId);
    if (!net) return false;
    if (net.grounds.length > 0) return true;
    if (!this._adjacency || this._adjacency.size === 0) return false;
    const visited = new Set();
    const queue = [net];
    visited.add(net.id);
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const { net: neighbor } of (this._adjacency.get(cur.id) || [])) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        if (neighbor.grounds.length > 0) return true;
        queue.push(neighbor);
      }
    }
    return false;
  }

  /**
   * Measure equivalent resistance between two pins, handling parallel paths correctly.
   * Finds all simple paths and combines them using the parallel formula.
   */
  measureResistance(startInstId, startPinId, endInstId, endPinId) {
    const adj = new Map();
    const addEdge = (a, b, r) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ key: b, r });
      adj.get(b).push({ key: a, r });
    };

    // Wire edges (zero resistance)
    for (const wire of this.wires) {
      addEdge(`${wire.from.instId}:${wire.from.pinId}`, `${wire.to.instId}:${wire.to.pinId}`, 0);
    }

    // Component internal edges
    for (const inst of this.components) {
      const key = (pin) => `${inst.id}:${pin}`;
      if (inst.type === 'resistor') {
        const r = (Number(inst.props?.value) || 220)
          * (inst.props?.unit === 'kΩ' ? 1e3 : inst.props?.unit === 'MΩ' ? 1e6 : 1);
        addEdge(key('p1'), key('p2'), Math.max(r, 0.01));
      } else if ((inst.type === 'npn_transistor' || inst.type === 'pnp_transistor')
        && inst.runtimeState?.conducting) {
        addEdge(key('collector'), key('emitter'), Math.max(5, inst.runtimeState.rce || 10));
        addEdge(key('base'), key('emitter'), Math.max(10, inst.runtimeState.rbe || 50));
      } else if (inst.type === 'diode_1n4007' && inst.runtimeState?.conducting) {
        addEdge(key('anode'), key('cathode'), 10);
      } else if (inst.type === 'bulb_12v') {
        addEdge(key('anode'), key('cathode'), 12);
      } else if (inst.type === 'led' || inst.type === 'led_green' || inst.type === 'led_blue'
        || inst.type === 'led_yellow' || inst.type === 'led_orange' || inst.type === 'led_white') {
        addEdge(key('anode'), key('cathode'), 20);
      } else if (inst.type === 'push_button') {
        const pressed = inst.runtimeState?.pressed;
        if (pressed) { addEdge(key('p1'), key('p3'), 0); addEdge(key('p2'), key('p4'), 0); }
        else { addEdge(key('p1'), key('p2'), 0); addEdge(key('p3'), key('p4'), 0); }
      } else if (inst.type === 'relay') {
        const on = inst.runtimeState?.active;
        addEdge(key('com'), key(on ? 'no' : 'nc'), 0);
      } else if (inst.type === 'slide_switch') {
        const throwPin = typeof window._slideSwitchThrow === 'function'
          ? window._slideSwitchThrow(inst) : 'a';
        addEdge(key('com'), key(throwPin), 0);
      } else if (inst.type === 'ssr_8ch') {
        const channels = inst.runtimeState?.channels || [];
        for (let i = 1; i <= 8; i++) {
          if (channels[i - 1]) addEdge(key(`out${i}a`), key(`out${i}b`), 0);
        }
      }
    }

    const startKey = `${startInstId}:${startPinId}`;
    const endKey = `${endInstId}:${endPinId}`;
    if (!adj.has(startKey) || !adj.has(endKey)) return Infinity;

    // DFS to find all simple paths, collect their resistances
    const pathResistances = [];
    const dfs = (currentKey, visited, totalR) => {
      if (pathResistances.length >= 200) return;
      if (currentKey === endKey) { pathResistances.push(totalR); return; }
      const neighbors = adj.get(currentKey);
      if (!neighbors) return;
      for (const { key: nextKey, r } of neighbors) {
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        dfs(nextKey, visited, totalR + r);
        visited.delete(nextKey);
      }
    };
    dfs(startKey, new Set([startKey]), 0);

    if (pathResistances.length === 0) return Infinity;
    // A dead short (a 0 Ω path — closed switch, pressed button, closed relay)
    // conducts perfectly: report 0, not Infinity. Callers such as
    // hasCompleteCircuit() and calculateCurrent() already expect 0 here.
    if (pathResistances.some(r => r === 0)) return 0;

    // Parallel combination: 1/R_total = Σ(1/Ri)
    let totalConductance = 0;
    for (const r of pathResistances) {
      if (r > 0) totalConductance += 1 / r;
    }
    return totalConductance > 0 ? 1 / totalConductance : Infinity;
  }

  /**
   * Calculate current through a path between two pins.
   * I = V / R (Ohm's law)
   */
  calculateCurrent(startInstId, startPinId, endInstId, endPinId) {
    const vStart = this.getVoltageAtPin(startInstId, startPinId);
    const vEnd = this.getVoltageAtPin(endInstId, endPinId);
    const r = this.measureResistance(startInstId, startPinId, endInstId, endPinId);
    if (r === Infinity || r === 0) return 0;
    const vDiff = vStart - vEnd;
    return vDiff / r;
  }

  /**
   * Check if a complete circuit exists (source ← component ← ground).
   */
  hasCompleteCircuit(instId, sourcePin, groundPin) {
    const hasSource = this.getSourceAtPin(instId, sourcePin) !== null;
    const hasGround = this.hasGroundAtPin(instId, groundPin);
    if (!hasSource || !hasGround) return false;
    // Check there's a path from source to ground through this component
    const r = this.measureResistance(instId, sourcePin, instId, groundPin);
    return r < Infinity;
  }
}

/* --------------------------- EXPORT -----------------------------------*/
window.ElectricalEngine = ElectricalEngine;
window.Net = Net;