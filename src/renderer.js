(function (root) {
  'use strict';
  const W = 1920, H = 1080;
  const P = Object.freeze({
    yellow: '#FFC93C', pink: '#FF8DB5', cobalt: '#2E5BE6', coral: '#FF5A5F',
    mint: '#A9E6C6', sky: '#8DD3F6', lilac: '#D3BEFF', ink: '#25214A', white: '#FFFFFF'
  });
  const EVENT = Object.fromEntries(root.FilmEvents.events.map(e => [e.name, e.frame]));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const between = (i, a, b) => clamp((i - EVENT[a]) / (EVENT[b] - EVENT[a]));

  function mulberry32(seed) {
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(root.FilmEvents.seed);
  const confetti = Array.from({ length: 30 }, (_, j) => ({
    x: 40 + rng() * 1840, y: 35 + rng() * 380, size: 10 + rng() * 17,
    type: j % 5, angle: rng() * Math.PI, speed: 5 + rng() * 12,
    color: [P.pink, P.yellow, P.mint, P.cobalt, P.lilac][j % 5]
  }));
  const clouds = [{ x: 280, y: 160, s: 1.15 }, { x: 920, y: 100, s: 0.75 }, { x: 1660, y: 145, s: 1.03 }];
  const skyline = [
    { x: -170, z: 560, w: 62, h: 119, c: P.lilac, p: 'dots' },
    { x: -116, z: 460, w: 39, h: 151, c: P.mint, p: 'stripes' },
    { x: -67, z: 510, w: 30, h: 102, c: P.pink, p: 'triangles' },
    { x: -40, z: 360, w: 32, h: 93, c: P.yellow, p: 'stripes' },
    { x: 8, z: 650, w: 45, h: 105, c: P.coral, p: 'dots' },
    { x: 50, z: 640, w: 43, h: 113, c: P.mint, p: 'triangles' },
    { x: 173, z: 580, w: 41, h: 104, c: P.pink, p: 'stripes' },
    { x: 211, z: 490, w: 53, h: 131, c: P.cobalt, p: 'zigzag' },
    { x: 264, z: 530, w: 62, h: 181, c: P.lilac, p: 'dots' },
    { x: -72, z: 200, w: 26, h: 50, c: P.coral, p: 'triangles' },
    { x: 161, z: 270, w: 40, h: 54, c: P.mint, p: 'dots' }
  ];

  function path(ctx, pts, close = true) {
    ctx.beginPath();
    pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    if (close) ctx.closePath();
  }
  function stroke(ctx, color = P.ink, width = 4) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  }
  function poly(ctx, pts, fill, outline = true) {
    path(ctx, pts); ctx.fillStyle = fill; ctx.fill(); if (outline) stroke(ctx);
  }
  function line(ctx, pts, color = P.ink, width = 4) { path(ctx, pts, false); stroke(ctx, color, width); }
  function rr(ctx, x, y, w, h, r, color, outline = true) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); if (outline) stroke(ctx);
  }
  function circle(ctx, x, y, r, color, outline = true) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); if (outline) stroke(ctx);
  }
  // Patterns use a fixed screen-space pitch so motifs keep their size as objects grow.
  function pattern(ctx, pts, kind, color = P.ink, pitch = 25) {
    ctx.save(); path(ctx, pts); ctx.clip();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.floor(Math.min(...xs) / pitch) * pitch - pitch;
    const y0 = Math.floor(Math.min(...ys) / pitch) * pitch - pitch;
    const x1 = Math.max(...xs) + pitch, y1 = Math.max(...ys) + pitch;
    if (x1 - x0 > 6000 || y1 - y0 > 6000) { ctx.restore(); return; }
    if (kind === 'stripes') {
      for (let x = x0 - (y1 - y0); x < x1; x += pitch) line(ctx, [[x, y1], [x + y1 - y0, y0]], color, 2);
    } else {
      for (let y = y0, row = 0; y < y1; y += pitch, row++) {
        for (let x = x0 + (row % 2) * pitch / 2; x < x1; x += pitch) {
          if (kind === 'dots') circle(ctx, x, y, 2.5, color, false);
          if (kind === 'triangles') poly(ctx, [[x - 4, y + 3], [x, y - 4], [x + 4, y + 3]], color, false);
          if (kind === 'zigzag') line(ctx, [[x - 7, y + 3], [x - 2, y - 3], [x + 3, y + 3], [x + 8, y - 3]], color, 2);
          if (kind === 'squiggles') {
            ctx.beginPath(); ctx.moveTo(x - 7, y);
            ctx.bezierCurveTo(x - 3, y - 8, x + 1, y + 8, x + 7, y); stroke(ctx, color, 2);
          }
        }
      }
    }
    ctx.restore();
  }
  function face(ctx, pts, fill, pat, pColor) {
    poly(ctx, pts.map(([x, y]) => [x + 9, y + 10]), P.ink, false);
    poly(ctx, pts, fill);
    if (pat) { pattern(ctx, pts, pat, pColor || P.ink); path(ctx, pts); stroke(ctx); }
  }

  function camera(i) {
    const u = ease(i / 719);
    const c = {
      z: 120 * u, x: 6.6, eye: 2.8, f: 1020 * (1 + 0.15 * u),
      yaw: mix(0.105, 0.18, u), roll: (-1.5 + 3 * u) * Math.PI / 180, horizon: 598
    };
    c.project = (x, y, z) => {
      const dz = Math.max(0.8, z - c.z), dx = x - c.x;
      const forward = Math.max(0.8, dz * Math.cos(c.yaw) + dx * Math.sin(c.yaw));
      const right = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw);
      return [W / 2 + c.f * right / forward, c.horizon + c.f * (c.eye - y) / forward];
    };
    return c;
  }
  function worldPoly(ctx, c, pts, color, outline = true) {
    const p = pts.map(([x, y, z]) => c.project(x, y, z)); poly(ctx, p, color, outline); return p;
  }
  function worldLine(ctx, c, pts, color, width = 4) { line(ctx, pts.map(([x, y, z]) => c.project(x, y, z)), color, width); }

  function sky(ctx, i) {
    ctx.fillStyle = P.sky; ctx.fillRect(-100, -100, W + 200, H + 200);
    for (const o of confetti) {
      const x = o.x + Math.sin(i / 210 + o.angle) * o.speed, y = o.y + Math.sin(i / 290 + o.angle) * 7;
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.angle + i / 20000);
      if (o.type === 0) circle(ctx, 0, 0, o.size * 0.45, o.color);
      if (o.type === 1) poly(ctx, [[-o.size, 7], [0, -o.size], [o.size, 7]], o.color);
      if (o.type === 2) rr(ctx, -o.size, -5, o.size * 2, 10, 5, o.color);
      if (o.type === 3) { ctx.beginPath(); ctx.arc(0, 0, o.size * 0.65, 0, Math.PI); stroke(ctx); }
      if (o.type === 4) line(ctx, [[-15, 3], [-7, -5], [1, 3], [9, -5], [17, 3]]);
      ctx.restore();
    }
    clouds.forEach((cl, j) => {
      const x = cl.x + i * (0.065 + j * 0.01), y = cl.y, s = cl.s;
      const cp = (dx, dy) => {
        ctx.beginPath(); ctx.moveTo(x - 95 * s + dx, y + 28 * s + dy);
        ctx.lineTo(x + 99 * s + dx, y + 28 * s + dy);
        ctx.bezierCurveTo(x + 139 * s + dx, y + 25 * s + dy, x + 143 * s + dx, y - 21 * s + dy, x + 94 * s + dx, y - 25 * s + dy);
        ctx.bezierCurveTo(x + 79 * s + dx, y - 76 * s + dy, x + 17 * s + dx, y - 80 * s + dy, x - 7 * s + dx, y - 39 * s + dy);
        ctx.bezierCurveTo(x - 55 * s + dx, y - 67 * s + dy, x - 87 * s + dx, y - 41 * s + dy, x - 83 * s + dx, y - 17 * s + dy);
        ctx.bezierCurveTo(x - 130 * s + dx, y - 20 * s + dy, x - 132 * s + dx, y + 25 * s + dy, x - 95 * s + dx, y + 28 * s + dy);
        ctx.closePath();
      };
      cp(9, 10); ctx.fillStyle = P.ink; ctx.fill();
      cp(0, 0); ctx.fillStyle = j === 1 ? P.mint : P.white; ctx.fill(); stroke(ctx);
      line(ctx, [[x - 55 * s, y + 8 * s], [x - 14 * s, y + 8 * s]], P.lilac, 4);
    });
  }

  function tower(ctx, c, b) {
    const { x, z, w, h } = b;
    const front = [[x, 0, z], [x + w, 0, z], [x + w, h, z], [x, h, z]].map(p => c.project(...p));
    const side = [[x + w, 0, z], [x + w, h, z], [x + w + 13, h, z + 19], [x + w + 13, 0, z + 19]].map(p => c.project(...p));
    poly(ctx, side, P.cobalt); pattern(ctx, side, 'stripes', P.ink, 24);
    face(ctx, front, b.c, b.p, b.c === P.cobalt ? P.white : P.ink);
    for (let y = 14; y < h - 3; y += 18) worldLine(ctx, c, [[x + 2, y, z], [x + w - 2, y, z]], P.ink, 3);
    worldPoly(ctx, c, [[x, h, z], [x + w, h, z], [x + w + 13, h, z + 19], [x + 13, h, z + 19]], P.yellow);
  }
  function waistTower(ctx, c) {
    const x = -93, z = 570, h = 244;
    const shape = [
      [x - 23, 0, z], [x + 23, 0, z], [x + 17, 50, z], [x + 13, 129, z],
      [x + 16, 196, z], [x + 21, h, z], [x - 21, h, z],
      [x - 16, 196, z], [x - 13, 129, z], [x - 17, 50, z]
    ].map(p => c.project(...p));
    face(ctx, shape, P.lilac, 'stripes', P.cobalt);
    ctx.save(); path(ctx, shape); ctx.clip();
    for (let j = -18; j <= 18; j += 6)
      line(ctx, [[x + j, 0, z], [x + j * 0.64, 126, z], [x + j * 0.94, h, z]].map(p => c.project(...p)), P.ink, 2);
    for (let y = 14; y < h; y += 15) worldLine(ctx, c, [[x - 25, y, z], [x + 25, y, z]], P.ink, 2);
    ctx.restore();
    worldLine(ctx, c, [[x - 22, h, z], [x + 22, h, z]], P.ink, 5);
  }
  function diagrid(ctx, pts, color = P.ink) {
    ctx.save(); path(ctx, pts); ctx.clip();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs) - 400, maxX = Math.max(...xs) + 400;
    const top = Math.min(...ys), bottom = Math.max(...ys), height = bottom - top;
    for (let x = minX; x < maxX; x += 35) {
      line(ctx, [[x, bottom + 8], [x + height * 0.6, top - 8]], color, 2);
      line(ctx, [[x, bottom + 8], [x - height * 0.6, top - 8]], color, 2);
    }
    for (let y = Math.floor(top / 42) * 42; y < bottom; y += 42) line(ctx, [[minX, y], [maxX, y]], P.white, 1.5);
    ctx.restore(); path(ctx, pts); stroke(ctx);
  }
  function landmark(ctx, c, i) {
    const x = 100, z = 450, s = 1.3;
    const loc = co => co.map(([a, b, d = 0]) => c.project(x + a * s, b * s, z + d));
    const left = loc([[-63, 0], [-32, 132], [-3, 126], [-29, 0]]);
    const leftSide = loc([[-29, 0], [-3, 126], [8, 128, 24], [-17, 0, 24]]);
    const right = loc([[32, 0], [15, 110], [46, 121], [69, 9]]);
    const rightSide = loc([[69, 9], [46, 121], [61, 124, 28], [81, 10, 28]]);
    const bridge = loc([[-32, 132], [27, 147], [46, 121], [-3, 107]]);
    const roof = loc([[-32, 132], [-16, 135, 28], [42, 150, 28], [27, 147]]);
    const bridgeRight = loc([[27, 147], [42, 150, 28], [61, 124, 28], [46, 121]]);
    const underside = loc([[-3, 107], [46, 121], [52, 112, 21], [7, 98, 21]]);
    const base = loc([[-66, -6], [-63, 8], [-24, 8], [32, 9], [69, 15], [78, 0, 22], [65, -7]]);
    const all = [left, leftSide, right, rightSide, bridge, bridgeRight, underside, roof, base];
    for (const f of [left, right, bridge]) poly(ctx, f.map(([a, b]) => [a + 10, b + 12]), P.ink, false);
    poly(ctx, rightSide, P.cobalt); diagrid(ctx, rightSide, P.ink);
    poly(ctx, leftSide, P.cobalt); diagrid(ctx, leftSide, P.white);
    poly(ctx, right, P.mint); diagrid(ctx, right);
    poly(ctx, left, P.sky); diagrid(ctx, left);
    poly(ctx, underside, P.lilac); pattern(ctx, underside, 'stripes', P.ink, 18);
    poly(ctx, bridgeRight, P.cobalt); diagrid(ctx, bridgeRight, P.white);
    poly(ctx, bridge, P.sky); diagrid(ctx, bridge);
    poly(ctx, roof, P.mint); pattern(ctx, roof, 'dots', P.ink, 22);
    poly(ctx, base, P.coral); pattern(ctx, base, 'stripes', P.ink, 23);
    if (i >= EVENT.cloud_shadow) {
      const t = between(i, 'cloud_shadow', 'end');
      const cx = mix(760, 1560, t), cy = 300;
      ctx.save(); ctx.beginPath();
      for (const f of all) { ctx.moveTo(...f[0]); for (let n = 1; n < f.length; n++) ctx.lineTo(...f[n]); ctx.closePath(); }
      ctx.clip();
      poly(ctx, [[cx - 160, cy - 140], [cx + 55, cy - 170], [cx + 150, cy - 92], [cx + 120, cy + 180], [cx - 60, cy + 245], [cx - 185, cy + 150]], P.cobalt, false);
      for (const f of all) diagrid(ctx, f);
      ctx.restore();
    }
  }
  function annex(ctx, c) {
    const x = 62, z = 395;
    const p = [[x, 0, z], [x, 30, z], [x + 12, 39, z], [x + 33, 24, z], [x + 48, 27, z], [x + 60, 2, z]].map(q => c.project(...q));
    face(ctx, p, P.pink, 'squiggles', P.ink);
    worldPoly(ctx, c, [[x, 30, z], [x + 12, 39, z], [x + 24, 40, z + 20], [x + 12, 31, z + 20]], P.yellow);
  }

  function ground(ctx, c) {
    const far = c.z + 1800, near = c.z + 0.85;
    ctx.fillStyle = P.mint; ctx.fillRect(-150, 592, W + 300, 700);
    worldPoly(ctx, c, [[-19, 0, near], [18, 0, near], [18, 0, far], [-19, 0, far]], P.lilac);
    worldPoly(ctx, c, [[18, 0, near], [29, 0, near], [29, 0, far], [18, 0, far]], P.yellow);
    worldPoly(ctx, c, [[19.6, 0.02, near], [22.2, 0.02, near], [22.2, 0.02, far], [19.6, 0.02, far]], P.coral);
    worldPoly(ctx, c, [[-22, 0, near], [-19, 0, near], [-19, 0, far], [-22, 0, far]], P.pink);
    worldPoly(ctx, c, [[-1.8, 0.15, near], [-0.5, 0.15, near], [-0.5, 0.15, far], [-1.8, 0.15, far]], P.pink);
    for (let z = 10; z < 650; z += 7) {
      if (z < c.z + 2) continue;
      worldPoly(ctx, c, [[-1.8, 0.16, z], [-0.5, 0.16, z], [-0.5, 0.16, z + 2.6], [-1.8, 0.16, z + 2.6]], P.yellow);
    }
    for (const x of [-13.2, -7.6, 4, 9.1, 14.2]) {
      for (let z = 2; z < 900; z += 13) {
        if (z < c.z + 1.6) continue;
        worldPoly(ctx, c, [[x - 0.11, 0.03, z], [x + 0.11, 0.03, z], [x + 0.11, 0.03, z + 6], [x - 0.11, 0.03, z + 6]], P.white, false);
      }
    }
    for (let z = 6; z < 800; z += 6) {
      if (z < c.z + 1.7) continue;
      worldLine(ctx, c, [[18, 0.1, z], [19.5, 0.1, z]], P.ink, 4);
    }
    worldLine(ctx, c, [[18, 0.1, near], [18, 0.1, far]], P.ink, 4);
    const crossZ = 112;
    for (let n = 0; n < 9; n++) {
      const x = 18.7 + n * 0.8;
      worldPoly(ctx, c, [[x, 0.05, crossZ - 3], [x + 0.48, 0.05, crossZ - 3], [x + 0.48, 0.05, crossZ + 3], [x, 0.05, crossZ + 3]], P.white, false);
    }
    for (const z of [40, 100, 170, 240]) {
      if (z < c.z + 6) continue;
      worldPoly(ctx, c, [[6.1, 0.06, z], [6.6, 0.06, z], [6.6, 0.06, z + 6], [7.4, 0.06, z + 6], [6.35, 0.06, z + 9], [5.3, 0.06, z + 6], [6.1, 0.06, z + 6]], P.white, false);
    }
  }
  function tree(ctx, c, x, z, kind, index) {
    const q = c.project(x, 0, z), top = c.project(x, 10.7, z);
    const h = q[1] - top[1], w = h * 0.64;
    if (h < 12 || h > 1400 || q[0] < -w - 80 || q[0] > W + w + 80) return;
    poly(ctx, [[q[0] - 8, q[1]], [q[0] + w * 0.8, q[1] + h * 0.24], [q[0] + w * 0.9, q[1] + h * 0.18], [q[0] + 9, q[1] - 6]], P.ink, false);
    const tw = Math.max(5, h * 0.048);
    poly(ctx, [[q[0] - tw, q[1]], [q[0] - tw, top[1] + h * 0.27], [q[0] + tw, top[1] + h * 0.27], [q[0] + tw, q[1]]], P.coral);
    const cy = top[1] + h * 0.3;
    const pts = kind === 'ginkgo' ? [
      [q[0] - w * 0.5, cy + h * 0.2], [q[0] - w * 0.65, cy - h * 0.1], [q[0] - w * 0.34, cy - h * 0.25], [q[0] - w * 0.08, cy - h * 0.18],
      [q[0] + w * 0.19, cy - h * 0.32], [q[0] + w * 0.55, cy - h * 0.16], [q[0] + w * 0.62, cy + h * 0.1], [q[0] + w * 0.24, cy + h * 0.27]
    ] : [
      [q[0] - w * 0.55, cy + h * 0.18], [q[0] - w * 0.63, cy - h * 0.02], [q[0] - w * 0.3, cy - h * 0.24], [q[0], cy - h * 0.3],
      [q[0] + w * 0.43, cy - h * 0.2], [q[0] + w * 0.63, cy + h * 0.03], [q[0] + w * 0.43, cy + h * 0.24], [q[0] - w * 0.1, cy + h * 0.3]
    ];
    face(ctx, pts, kind === 'ginkgo' ? P.yellow : P.mint, index % 2 ? 'triangles' : 'dots', P.ink);
    line(ctx, [[q[0], cy + h * 0.4], [q[0], cy], [q[0] - w * 0.23, cy - h * 0.08]], P.ink, 4);
    line(ctx, [[q[0], cy + h * 0.18], [q[0] + w * 0.23, cy - h * 0.07]], P.ink, 4);
  }
  function lamp(ctx, c, x, z) {
    const base = c.project(x, 0, z), top = c.project(x, 12, z), tip = c.project(x - 3, 12, z);
    if (base[0] < -100 || base[0] > W + 100) return;
    line(ctx, [base, top, tip], P.ink, 6);
    rr(ctx, tip[0] - 15, tip[1] - 2, 31, 10, 4, P.yellow);
  }
  function person(ctx, c, x, z, j, walking) {
    const q = c.project(x, 0, z), head = c.project(x, 2.1, z), h = q[1] - head[1], w = h * 0.34;
    ctx.beginPath(); ctx.ellipse(q[0] + w * 0.55, q[1] + h * 0.015, w * 0.85, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.ink; ctx.fill();
    const stride = walking ? Math.sin(walking + j) * h * 0.13 : 0;
    line(ctx, [[q[0] - w * 0.22, q[1] - h * 0.31], [q[0] - w * 0.43 - stride, q[1]]], P.ink, 4);
    line(ctx, [[q[0] + w * 0.22, q[1] - h * 0.31], [q[0] + w * 0.43 + stride, q[1]]], P.ink, 4);
    rr(ctx, q[0] - w * 0.6, head[1] + h * 0.28, w * 1.2, h * 0.44, Math.max(2, w * 0.2), [P.coral, P.cobalt, P.pink, P.lilac][j % 4]);
    circle(ctx, q[0], head[1] + h * 0.12, h * 0.13, P.yellow);
  }
  const CROSS_Z = 80;
  function crossing(ctx, c, i) {
    const q = c.project(24.3, 0, CROSS_Z), top = c.project(24.3, 5.3, CROSS_Z);
    line(ctx, [q, top], P.ink, 6);
    const size = Math.max(22, (q[1] - top[1]) * 0.38);
    rr(ctx, top[0] - size * 0.42, top[1], size * 0.84, size * 1.5, 4, P.ink);
    const green = i >= EVENT.crossing_green;
    circle(ctx, top[0], top[1] + size * 0.45, size * 0.2, green ? P.ink : P.coral);
    circle(ctx, top[0], top[1] + size * 1.05, size * 0.2, green ? P.mint : P.ink);
    for (let j = 0; j < 5; j++) {
      const t = ease(between(i - j * 5, 'pedestrians_walk', 'bus_overtake'));
      person(ctx, c, mix(25.9 + j * 0.65, 19.1 + j * 0.64, t), CROSS_Z - 1 + (j % 2) * 1.2, j, t > 0 && t < 1 ? i / 7 : 0);
    }
  }
  function shelter(ctx, c) {
    const x = 23.2, z = 100;
    worldPoly(ctx, c, [[x, 0, z], [x + 6.5, 0, z], [x + 6.5, 3.9, z], [x, 3.9, z]], P.sky);
    for (const a of [0, 3.25, 6.5]) worldLine(ctx, c, [[x + a, 0, z], [x + a, 4, z]], P.ink, 4);
    face(ctx, [[x - 1, 4, z - 1], [x + 7.5, 4, z - 1], [x + 7.5, 4, z + 3], [x - 1, 4, z + 3]].map(p => c.project(...p)), P.pink, 'dots');
    worldLine(ctx, c, [[x + 1, 1.0, z - 0.1], [x + 5.7, 1.0, z - 0.1]], P.coral, 8);
  }
  function car(ctx, c, v, i) {
    const z = v.z + c.z * v.speed + i * v.drift, x = v.x, w = v.tri ? 1.8 : 2.55, len = v.tri ? 3.1 : 4.6;
    if (z < c.z + (v.x < 0 ? 34 : 5) || z > c.z + 510) return;
    const h = v.tri ? 2 : 1.65;
    const near = c.project(x, 0, z), far = c.project(x, 0, z + len);
    const unit = Math.max(0.5, (near[1] - far[1]) * 0.35);
    poly(ctx, [[near[0] - unit * 6, near[1] + unit], [near[0] + unit * 8, near[1] + unit * 3], [far[0] + unit * 5, far[1]], [far[0] - unit * 5, far[1]]], P.ink, false);
    for (const dx of [-w * 0.43, w * 0.43]) {
      const p = c.project(x + dx, 0.4, z + 0.35);
      circle(ctx, p[0], p[1], Math.max(3.5, c.f * 0.31 / (z - c.z)), P.ink);
    }
    worldPoly(ctx, c, [[x - w / 2, 0.4, z], [x + w / 2, 0.4, z], [x + w / 2, 1.12, z], [x - w / 2, 1.12, z]], v.color);
    worldPoly(ctx, c, [[x + w / 2, 0.4, z], [x + w / 2, 0.4, z + len], [x + w / 2, h, z + len * 0.7], [x + w / 2, 1.12, z]], P.cobalt);
    poly(ctx, [[x - w * 0.46, 1.12, z], [x + w * 0.46, 1.12, z], [x + w * 0.39, h, z + len * 0.36], [x - w * 0.39, h, z + len * 0.36]].map(p => c.project(...p)), P.sky);
    worldPoly(ctx, c, [[x - w * 0.39, h, z + len * 0.36], [x + w * 0.39, h, z + len * 0.36], [x + w * 0.4, h, z + len * 0.76], [x - w * 0.4, h, z + len * 0.76]], v.color);
    for (const dx of [-w * 0.34, w * 0.34]) {
      const p = c.project(x + dx, 0.8, z - 0.05);
      rr(ctx, p[0] - 5, p[1] - 3, 10, 6, 2, P.coral);
    }
    if (v.taxi) {
      const p = c.project(x, h + 0.1, z + len * 0.56);
      rr(ctx, p[0] - 12, p[1] - 7, 24, 12, 3, P.white);
    }
    if (v.tri) {
      const cargo = [[x - 0.9, 1.15, z], [x + 0.9, 1.15, z], [x + 0.9, 2.05, z], [x - 0.9, 2.05, z]].map(p => c.project(...p));
      poly(ctx, cargo, P.mint); pattern(ctx, cargo, 'triangles', P.ink, 23);
    }
  }
  const cars = [
    { x: 1.7, z: 36, speed: 1.02, drift: 0.015, color: P.coral },
    { x: 6.6, z: 55, speed: 0.92, drift: 0.035, color: P.yellow, taxi: true },
    { x: 11.7, z: 89, speed: 0.96, drift: 0.01, color: P.pink },
    { x: 1.6, z: 120, speed: 0.8, drift: 0.015, color: P.sky },
    { x: 6.5, z: 165, speed: 0.7, drift: 0.02, color: P.coral },
    { x: 11.5, z: 210, speed: 0.6, drift: 0.01, color: P.yellow, taxi: true },
    { x: 15.8, z: 44, speed: 0.84, drift: 0.015, color: P.mint, tri: true },
    { x: -5, z: 98, speed: 0, drift: -0.08, color: P.cobalt },
    { x: -10.1, z: 137, speed: 0, drift: -0.09, color: P.pink },
    { x: -15.2, z: 189, speed: 0, drift: -0.06, color: P.yellow, taxi: true },
    { x: -5, z: 248, speed: 0, drift: -0.08, color: P.mint },
    { x: -10.2, z: 310, speed: 0, drift: -0.07, color: P.coral }
  ];
  const SIGN_TEXT = 'PARIS · Av. des Champs-\u00C9lys\u00E9es';
  function overpass(ctx, c, i) {
    if (i > EVENT.overpass_clear) return;
    const z = 30.2;
    if (c.z > z - 0.5) return;
    const back = z + 7;
    worldPoly(ctx, c, [[-29, 0, z], [-26, 0, z], [-26, 6.3, z], [-29, 6.3, z]], P.mint);
    worldPoly(ctx, c, [[25, 0, z], [28, 0, z], [28, 6.3, z], [25, 6.3, z]], P.mint);
    poly(ctx, [[-45, 6, z], [45, 6, z], [45, 6, back], [-45, 6, back]].map(p => c.project(...p)), P.ink);
    const front = [[-45, 6, z], [45, 6, z], [45, 7.4, z], [-45, 7.4, z]].map(p => c.project(...p));
    poly(ctx, front, P.pink); pattern(ctx, front, 'stripes', P.ink, 29); path(ctx, front); stroke(ctx);
    const top = [[-45, 7.4, z], [45, 7.4, z], [45, 7.4, back], [-45, 7.4, back]].map(p => c.project(...p));
    poly(ctx, top, P.mint); pattern(ctx, top, 'dots', P.ink, 26);
    const sp = c.project(6, 6.7, z - 0.1), s = clamp(c.f / (z - c.z) / 30, 0.6, 2.3);
    const label = SIGN_TEXT;
    ctx.font = `bold ${19 * s}px "Arial", sans-serif`;
    const sw = Math.max(228 * s, ctx.measureText(label).width + 40 * s);
    rr(ctx, sp[0] - sw / 2 + 7, sp[1] - 24 * s + 7, sw, 48 * s, 8, P.ink);
    rr(ctx, sp[0] - sw / 2, sp[1] - 24 * s, sw, 48 * s, 8, P.cobalt);
    ctx.fillStyle = P.white; ctx.textAlign = 'center';
    ctx.fillText(label, sp[0], sp[1] + 7 * s);
    if (i >= EVENT.overpass_enter) {
      poly(ctx, [[-19, 0.075, z - 4], [18, 0.075, z - 4], [18, 0.075, z + 8], [-19, 0.075, z + 8]].map(p => c.project(...p)), P.ink, false);
    }
  }
  function birds(ctx, i) {
    if (i < EVENT.birds_start || i > EVENT.overpass_clear) return;
    const t = (i - EVENT.birds_start) / (EVENT.overpass_clear - EVENT.birds_start), lead = -380 + (i - EVENT.birds_start) * 25;
    for (let j = 0; j < 9; j++) {
      const k = j - 4, x = lead - Math.abs(k) * 70, y = 62 + Math.abs(k) * 15 + k * 4 + Math.sin(t * 6 + j) * 4;
      const wing = Math.sin(i * 0.3 + j * 0.8) * 10;
      ctx.save(); ctx.translate(x, y); ctx.scale(2.4, 2.4);
      path(ctx, [[-17, -5 - wing], [-6, -9 - wing * 0.6], [0, 2], [6, -9 - wing * 0.6], [17, -5 - wing]], false);
      stroke(ctx, P.ink, 3);
      circle(ctx, 0, 1, 3.4, P.coral);
      ctx.restore();
    }
  }
  // busRear is relative to the camera, not the road.
  const BUS = { x: 10.7, w: 2.8, len: 11, h: 3.5 };
  const busRear = i => -13 + 45 * ease((i - 325) / 90) + Math.max(0, i - 415) * 0.2;
  function bus(ctx, c, i) {
    if (i < 320) return;
    const { len, h } = BUS, xl = BUS.x - BUS.w / 2, xr = BUS.x + BUS.w / 2;
    const zr = c.z + busRear(i), zf = zr + len, za = Math.max(zr, c.z + 2.2);
    if (zf <= c.z + 2.2) return;
    const pj = (x, y, z) => c.project(x, y, z);
    worldPoly(ctx, c, [[xr, 0, za], [xr + 3.4, 0, za], [xr + 3.4, 0, zf], [xr, 0, zf]], P.ink, false);
    const side = [[xl, 0.45, za], [xl, 0.45, zf], [xl, h, zf], [xl, h, za]].map(p => pj(...p));
    poly(ctx, side, P.yellow); pattern(ctx, side, 'dots', P.ink, 26); path(ctx, side); stroke(ctx);
    worldPoly(ctx, c, [[xl, 3.1, za], [xl, 3.1, zf], [xl, h, zf], [xl, h, za]], P.mint);
    worldPoly(ctx, c, [[xl, 0.95, za], [xl, 0.95, zf], [xl, 1.4, zf], [xl, 1.4, za]], P.coral);
    for (let k = 0; k < 6; k++) {
      const z0 = Math.max(zr + 0.8 + k * 1.75, za), z1 = zr + 0.8 + k * 1.75 + 1.45;
      if (z1 <= za + 0.1) continue;
      const win = worldPoly(ctx, c, [[xl, 1.7, z0], [xl, 1.7, z1], [xl, 2.95, z1], [xl, 2.95, z0]], k % 2 ? P.sky : P.lilac);
      line(ctx, [[win[0][0] + (win[3][0] - win[0][0]) * 0.2 + 5, win[0][1] - 6], [win[3][0] - 5, win[3][1] + 6 + (win[0][1] - win[3][1]) * 0.45]], P.white, 3);
    }
    for (const wz of [zr + 2.0, zr + len - 2.4]) {
      if (wz < za + 0.7) continue;
      const rim = Array.from({ length: 14 }, (_, n) => pj(xl, 0.62 + 0.62 * Math.sin(n / 14 * Math.PI * 2), wz + 0.62 * Math.cos(n / 14 * Math.PI * 2)));
      poly(ctx, rim, P.ink);
      const hub = Array.from({ length: 10 }, (_, n) => pj(xl - 0.02, 0.62 + 0.3 * Math.sin(n / 10 * Math.PI * 2), wz + 0.3 * Math.cos(n / 10 * Math.PI * 2)));
      poly(ctx, hub, P.cobalt);
    }
    if (zr > c.z + 2.2) {
      const rear = [[xl, 0.45, zr], [xr, 0.45, zr], [xr, h, zr], [xl, h, zr]].map(p => pj(...p));
      poly(ctx, rear, P.yellow); pattern(ctx, rear, 'stripes', P.ink, 22); path(ctx, rear); stroke(ctx);
      worldPoly(ctx, c, [[xl + 0.25, 1.8, zr], [xr - 0.25, 1.8, zr], [xr - 0.25, 3.0, zr], [xl + 0.25, 3.0, zr]], P.sky);
      worldPoly(ctx, c, [[xl, 3.1, zr], [xr, 3.1, zr], [xr, h, zr], [xl, h, zr]], P.mint);
      for (const lx of [xl + 0.3, xr - 0.75]) worldPoly(ctx, c, [[lx, 0.95, zr], [lx + 0.45, 0.95, zr], [lx + 0.45, 1.45, zr], [lx, 1.45, zr]], P.coral);
      worldPoly(ctx, c, [[BUS.x - 0.45, 0.75, zr], [BUS.x + 0.45, 0.75, zr], [BUS.x + 0.45, 1.15, zr], [BUS.x - 0.45, 1.15, zr]], P.white);
    }
  }
  // Leaf position is camera-relative until leaf_land, then fixed in world space.
  function leafRel(s) {
    const sp = ease(s), a = -0.6 + sp * Math.PI * 2 * 3, r = 1.5 * Math.pow(Math.sin(Math.PI * sp), 0.7);
    return {
      x: mix(3.6, 12, Math.pow(s, 3)) + r * Math.cos(a),
      y: Math.max(0.15, mix(3.0, 0.15, Math.pow(s, 1.2)) + 0.8 * r * Math.sin(a)),
      dz: mix(29, 13, s) - 12 * Math.sin(Math.PI * s), a, flat: clamp((s - 0.85) / 0.15)
    };
  }
  const leafWorld = j => {
    const cj = camera(j), r = leafRel(between(j, 'leaf_release', 'leaf_land'));
    return { p: [cj.x + r.x, r.y, cj.z + r.dz], r };
  };
  function leaf(ctx, c, i) {
    if (i < EVENT.leaf_release) return;
    const j = Math.min(i, EVENT.leaf_land), { p, r } = leafWorld(j);
    if (p[2] - c.z < 2) return;
    const q = c.project(...p);
    if (q[0] > W + 150 || q[1] > H + 150) return;
    if (i < EVENT.leaf_land) {
      const trail = [];
      for (let k = Math.max(EVENT.leaf_release, i - 40); k <= i; k++) trail.push(c.project(...leafWorld(k).p));
      ctx.save(); ctx.setLineDash([3, 12]);
      line(ctx, trail, P.ink, 4); ctx.restore();
    }
    const s = clamp(c.f / (p[2] - c.z) / 105, 0.1, 1.7);
    const angle = i >= EVENT.leaf_land ? 0.7 : r.a * 0.9 + 0.5;
    ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(angle); ctx.scale(1, mix(1, 0.5, r.flat));
    const fan = (dx, dy) => {
      ctx.beginPath(); ctx.moveTo(dx, 43 * s + dy);
      ctx.bezierCurveTo(-25 * s + dx, 21 * s + dy, -60 * s + dx, -7 * s + dy, -57 * s + dx, -28 * s + dy);
      ctx.bezierCurveTo(-44 * s + dx, -48 * s + dy, -22 * s + dx, -53 * s + dy, -6 * s + dx, -42 * s + dy);
      ctx.lineTo(dx, -31 * s + dy); ctx.lineTo(6 * s + dx, -42 * s + dy);
      ctx.bezierCurveTo(30 * s + dx, -55 * s + dy, 50 * s + dx, -42 * s + dy, 57 * s + dx, -26 * s + dy);
      ctx.bezierCurveTo(54 * s + dx, 3 * s + dy, 22 * s + dx, 30 * s + dy, dx, 43 * s + dy); ctx.closePath();
    };
    fan(8, 9); ctx.fillStyle = P.ink; ctx.fill();
    fan(0, 0); ctx.fillStyle = P.yellow; ctx.fill(); stroke(ctx);
    for (const a of [-43, -24, 0, 25, 44]) line(ctx, [[0, 40 * s], [a * s, -27 * s]], P.ink, 2);
    line(ctx, [[0, 40 * s], [9 * s, 69 * s]], P.ink, 4);
    ctx.restore();
  }
  function pill(ctx, text, font, cy, fill) {
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 48, h = 40, x = W / 2 - w / 2, y = cy - h / 2;
    rr(ctx, x + 6, y + 7, w, h, h / 2, P.ink, false);
    rr(ctx, x, y, w, h, h / 2, fill);
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, cy + 1);
  }
  function locationLabel(ctx, i) {
    ctx.save(); ctx.globalAlpha = ease(i / 60);
    const p = ease(i / 719), lat = mix(48.8738, 48.8710, p), lon = mix(2.2950, 2.3035, p);
    pill(ctx, 'Champs-\u00C9lys\u00E9es · Paris', 'bold 24px "Arial", sans-serif', 944, P.yellow);
    pill(ctx, 'Spring Rain · A gentle afternoon where the city hums along.', '21px "Arial", sans-serif', 992, P.mint);
    pill(ctx, `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`, 'bold 22px Consolas, "Courier New", monospace', 1040, P.pink);
    ctx.restore();
  }

  function frame(i, ctx) {
    if (!Number.isInteger(i) || i < 0 || i >= root.FilmEvents.frames) throw new RangeError('Frame must be an integer from 0 to 719.');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const c = camera(i);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(c.roll); ctx.translate(-W / 2, -H / 2);
    sky(ctx, i);
    const far = skyline.map(b => ({ z: b.z, draw: () => tower(ctx, c, b) }));
    far.push({ z: 570, draw: () => waistTower(ctx, c) });
    far.push({ z: 450, draw: () => landmark(ctx, c, i) });
    far.push({ z: 399, draw: () => annex(ctx, c) });
    far.sort((a, b) => b.z - a.z).forEach(o => o.draw());
    ground(ctx, c);
    const objects = [];
    for (let j = 0; j < 23; j++) {
      const z = 28 + j * 21;
      if (z > c.z + 8) {
        objects.push({ z, draw: () => tree(ctx, c, 24.5, z, j % 3 === 0 ? 'ginkgo' : 'green', j) });
        objects.push({ z: z + 8, draw: () => tree(ctx, c, -22.5, z + 8, j % 4 === 0 ? 'ginkgo' : 'green', j + 1) });
      }
      if (j % 3 === 1 && z > c.z + 10) objects.push({ z, draw: () => lamp(ctx, c, 18, z) });
    }
    for (const v of cars) objects.push({ z: v.z + c.z * v.speed + i * v.drift, draw: () => car(ctx, c, v, i) });
    objects.push({ z: 100, draw: () => shelter(ctx, c) });
    objects.push({ z: CROSS_Z, draw: () => crossing(ctx, c, i) });
    objects.push({ z: c.z + busRear(i) + BUS.len / 2, draw: () => bus(ctx, c, i) });
    objects.sort((a, b) => b.z - a.z).forEach(o => o.draw());
    overpass(ctx, c, i);
    birds(ctx, i);
    leaf(ctx, c, i);
    ctx.restore();
    locationLabel(ctx, i);
    ctx.restore();
  }
  root.MemphisFilm = Object.freeze({ W, H, P, frame, camera, mulberry32, EVENT });
})(window);
