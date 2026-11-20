/**
 * ZENRO Wrist & Co. home page hero watch
 * --------------------------------------
 * Builds the hero wristwatch in two layers:
 *
 *   node tools/generate-hero.mjs        (or: npm run hero)
 *   node tools/generate-hero.mjs --preview <file.png>   also writes a full preview picture
 *
 *   images/hero-watch.webp   the watch body (bracelet, case, gem-set bezel, dial, indices). It is
 *                            drawn as SVG with lighting, brushing and soft shadows, then rendered
 *                            to a picture with sharp so the page does not have to run those filters.
 *   index.html               a small inline SVG between the <!-- hero-watch:start --> and
 *                            <!-- hero-watch:end --> markers. It shows the picture and draws the
 *                            hands, the day, the date and the crystal reflections on top, so
 *                            js/home.js can show the live Bangladesh time, weekday and date.
 *
 * The design is a generic gold day-date dress watch: polished yellow-gold case, a bezel set with
 * round diamonds, champagne sunburst dial, baguette diamond indices, day window at 12, date window
 * at 3 and a three-row gold link bracelet. No brand names, logos or dial text.
 * Lighting is worked out in screen space (light from the top left), so the watch can be tilted
 * with ROT and its highlights and shadows still fall the right way.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE = 'images/hero-watch.webp';

/* ---------- layout ---------- */
const S = 1200; // canvas
const C = 600; // centre
const R = 330; // case radius
const DR = R * 0.8; // dial radius
const ROT = -16; // tilt of the whole watch, degrees
const LIGHT = 315; // screen direction the light comes from (0 = up, clockwise)
const W = R * 1.0; // bracelet width at the case (20 mm on a 40 mm case)
const DAY = { x: C, y: C - DR * 0.62, w: DR * 0.44, h: DR * 0.12 };
const DATE = { x: C + DR * 0.66, y: C, w: DR * 0.17, h: DR * 0.13 };

/* ---------- helpers ---------- */
const n = (v) => Math.round(v * 100) / 100;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const cosd = (d) => Math.cos((d * Math.PI) / 180);
const sind = (d) => Math.sin((d * Math.PI) / 180);
/** Point at distance r and angle deg (0 = 12 o'clock, clockwise). */
const pt = (r, deg, cx = C, cy = C) => [n(cx + r * sind(deg)), n(cy - r * cosd(deg))];
const lobe = (deg, p) => Math.pow(Math.max(0, cosd(deg)), p);
/** Lambert-style brightness of a surface whose normal points to watch angle a. */
const facing = (a) => 0.5 + 0.5 * cosd(a + ROT - LIGHT);
/** Turns a screen-space offset into watch space, so shadows fall the same way at any tilt. */
const toWatch = (dx, dy) => [n(dx * cosd(-ROT) + dy * sind(-ROT)), n(-dx * sind(-ROT) + dy * cosd(-ROT))];

const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t)).toString(16).padStart(2, '0')).join('')}`;
};
/** Polished yellow gold from 0 (in shadow) to 1 (catching the light). */
const gold = (b) => (b < 0.5 ? mix('#2e1d06', '#b3862f', b * 2) : mix('#b3862f', '#fff3c8', (b - 0.5) * 2));
/** Champagne sunburst dial from 0 (dark sector) to 1 (bright sector). */
const champagne = (b) => (b < 0.5 ? mix('#6a4810', '#d6aa4c', b * 2) : mix('#d6aa4c', '#fff1c2', (b - 0.5) * 2));
/** Diamond facet from 0 (dark reflection) to 1 (white sparkle). */
const ice = (b) => (b < 0.5 ? mix('#20262e', '#c3ccd6', b * 2) : mix('#c3ccd6', '#ffffff', (b - 0.5) * 2));

/** Small seeded random generator so every build gives the same picture. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reflection of the room in a polished surface, by screen angle. */
const env = (s) =>
  0.03 +
  0.95 * lobe(s - LIGHT, 7) +
  0.35 * lobe(s - LIGHT, 1.5) +
  0.62 * lobe(s - (LIGHT - 180), 14) +
  0.4 * lobe(s - (LIGHT + 75), 40) +
  0.3 * lobe(s - (LIGHT - 105), 60);

/** A ring between radii r1 and r2 shaded slice by slice (SVG has no conic gradient). */
function conicRing(r1, r2, color, step = 1) {
  let out = '';
  for (let a = 0; a < 360; a += step) {
    const [x1, y1] = pt(r1, a);
    const [x2, y2] = pt(r1, a + step + 0.4);
    const [x3, y3] = pt(r2, a + step + 0.4);
    const [x4, y4] = pt(r2, a);
    out += `<path d="M${x1},${y1}L${x2},${y2}L${x3},${y3}L${x4},${y4}Z" fill="${color(a + step / 2 + ROT)}"/>`;
  }
  return out;
}

/* ---------- bracelet ---------- */
function bracelet() {
  const Wt = W * 0.86;
  const yIn = R * 0.8;
  const far = 1500;
  const halfAt = (dist) => (W - (W - Wt) * clamp((dist - yIn) / (far - yIn))) / 2;
  const shape = (sy) => {
    const y0 = C + sy * yIn;
    const y1 = C + sy * far;
    return `M${n(C - W / 2)},${n(y0)} L${n(C - Wt / 2)},${n(y1)} L${n(C + Wt / 2)},${n(y1)} L${n(C + W / 2)},${n(y0)} Z`;
  };
  const [sx, sy] = toWatch(16, 26);
  let out = `<g opacity="0.6" filter="url(#softBlur)" transform="translate(${sx} ${sy})"><path d="${shape(-1)}"/><path d="${shape(1)}"/></g>`;

  const rowH = R * 0.165;
  const gap = 3.5;
  for (const side of [-1, 1]) {
    let links = '';
    let outer = '';
    for (let d = yIn - rowH * 0.4; d < far; d += rowH) {
      const d0 = d + gap / 2;
      const d1 = d + rowH - gap / 2;
      const half = halfAt((d0 + d1) / 2);
      const w = half * 2;
      const y = n(Math.min(C + side * d0, C + side * d1));
      const h = n(d1 - d0);
      const ow = w * 0.31 - gap;
      const cw = w * 0.38 - gap;
      const xl = n(C - half);
      const xc = n(C - cw / 2);
      const xr = n(C + half - ow);
      links += `<rect x="${xl}" y="${y}" width="${n(ow)}" height="${h}" rx="5" fill="url(#linkOuter)"/><rect x="${xr}" y="${y}" width="${n(ow)}" height="${h}" rx="5" fill="url(#linkOuter)"/>`;
      links += `<rect x="${xc}" y="${y}" width="${n(cw)}" height="${h}" rx="7" fill="url(#linkCenter)"/>`;
      links += `<rect x="${xl}" y="${y}" width="${n(ow)}" height="${h}" rx="5" fill="url(#linkV)"/><rect x="${xr}" y="${y}" width="${n(ow)}" height="${h}" rx="5" fill="url(#linkV)"/><rect x="${xc}" y="${y}" width="${n(cw)}" height="${h}" rx="7" fill="url(#linkV)"/>`;
      outer += `<rect x="${xl}" y="${y}" width="${n(ow)}" height="${h}" rx="5"/><rect x="${xr}" y="${y}" width="${n(ow)}" height="${h}" rx="5"/>`;
    }
    out += `<path d="${shape(side)}" fill="#160e03"/>`; // what shows through the gaps between links
    out += links;
    out += `<g fill="#000" filter="url(#brushed)" opacity="0.2">${outer}</g>`;
    out += `<path d="${shape(side)}" fill="url(#${side < 0 ? 'fadeUp' : 'fadeDown'})"/>`;
  }
  return out;
}

/* ---------- lugs and crown ---------- */
function lugs() {
  const lw = R * 0.15;
  const xi = C + W / 2;
  const xo = xi + lw;
  const yt = C - R * 1.13;
  const flare = R * 0.11; // the lug widens where it grows out of the case
  const yc = C - Math.sqrt(R * R - (xo + flare - C) ** 2); // where the outer edge meets the case
  const d = `M${n(xi)},${n(C - R * 0.5)} L${n(xi)},${n(yt + 10)} Q${n(xi)},${n(yt)} ${n(xi + 10)},${n(yt)} L${n(xo - 12)},${n(yt)} Q${n(xo)},${n(yt)} ${n(xo)},${n(yt + 14)} C${n(xo)},${n(yt + 70)} ${n(xo + 4)},${n(yc - 50)} ${n(xo + flare)},${n(yc + 2)} L${n(xo + flare)},${n(C - R * 0.5)} Z`;
  let defs = '';
  let body = '';
  let i = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const outer = gold(0.08 + 0.8 * facing(sx > 0 ? 90 : 270) ** 1.6);
      const top = gold(0.45 + 0.4 * facing(sy < 0 ? 0 : 180));
      defs += `<linearGradient id="lug${i}" gradientUnits="userSpaceOnUse" x1="${n(xo)}" y1="0" x2="${n(xi)}" y2="0"><stop offset="0" stop-color="${outer}"/><stop offset="0.3" stop-color="${mix(outer, '#fff3c8', 0.25)}"/><stop offset="0.38" stop-color="#fff6d6"/><stop offset="0.5" stop-color="${top}"/><stop offset="1" stop-color="${mix(top, '#000000', 0.3)}"/></linearGradient>`;
      body += `<path d="${d}" fill="url(#lug${i})" transform="translate(${C} ${C}) scale(${sx} ${sy}) translate(${-C} ${-C})"/>`;
      i++;
    }
  }
  return { defs, body: `<g filter="url(#dropMd)">${body}</g>` };
}

function crown() {
  const h = R * 0.25;
  const w = R * 0.12;
  const x0 = C + R + 8;
  const y0 = C - h / 2;
  const top = gold(0.2 + 0.75 * facing(0));
  const bottom = gold(0.08 + 0.5 * facing(180));
  const defs = `<linearGradient id="crownG" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y0)}" x2="0" y2="${n(y0 + h)}"><stop offset="0" stop-color="#1c1204"/><stop offset="0.12" stop-color="${top}"/><stop offset="0.3" stop-color="#fff6d6"/><stop offset="0.55" stop-color="${gold(0.45)}"/><stop offset="0.88" stop-color="${bottom}"/><stop offset="1" stop-color="#140c02"/></linearGradient>`;
  let out = `<g filter="url(#dropSm)">`;
  out += `<rect x="${n(C + R - 6)}" y="${n(C - h * 0.22)}" width="18" height="${n(h * 0.44)}" fill="url(#crownG)"/>`;
  out += `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" rx="7" fill="url(#crownG)"/>`;
  for (let y = y0 + 5; y < y0 + h - 4; y += 4.4) {
    out += `<line x1="${n(x0 + 4)}" y1="${n(y)}" x2="${n(x0 + w - 3)}" y2="${n(y)}" stroke="#2a1a04" stroke-opacity="0.4" stroke-width="1.4"/>`;
    out += `<line x1="${n(x0 + 4)}" y1="${n(y + 1.6)}" x2="${n(x0 + w - 3)}" y2="${n(y + 1.6)}" stroke="#fff6d6" stroke-opacity="0.25" stroke-width="1"/>`;
  }
  out += `<rect x="${n(x0 + w - 5)}" y="${n(y0 + 3)}" width="4" height="${n(h - 6)}" rx="2" fill="#fff6d6" fill-opacity="0.3"/></g>`;
  return { defs, body: out };
}

/* ---------- diamonds ---------- */
/** A round brilliant: sixteen facets of different brightness, a table and a thin girdle. */
function roundStone(x, y, r, rand, lit) {
  let out = `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r + 1.6)}" fill="#1a1105"/>`;
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${ice(0.35 + 0.3 * lit)}"/>`;
  for (let k = 0; k < 16; k++) {
    const a0 = k * 22.5;
    const [x1, y1] = pt(r, a0, x, y);
    const [x2, y2] = pt(r, a0 + 22.5, x, y);
    const dark = rand() < 0.28;
    const b = clamp(dark ? 0.05 + 0.3 * rand() : 0.55 + 0.35 * rand() + 0.25 * lit);
    let fill = ice(b);
    const tint = rand();
    if (tint > 0.93) fill = mix(fill, '#9fc4ff', 0.45); // a little fire
    else if (tint > 0.87) fill = mix(fill, '#ffd59a', 0.4);
    out += `<path d="M${n(x)},${n(y)}L${x1},${y1}L${x2},${y2}Z" fill="${fill}"/>`;
  }
  let table = '';
  for (let k = 0; k < 8; k++) {
    const [tx, ty] = pt(r * 0.5, k * 45 + 22.5, x, y);
    table += `${k ? 'L' : 'M'}${tx},${ty}`;
  }
  out += `<path d="${table}Z" fill="${ice(0.6 + 0.35 * rand() + 0.2 * lit)}" fill-opacity="0.85"/>`;
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r - 0.5)}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/>`;
  return out;
}

/** A four-point sparkle, kept upright on screen whatever the tilt. */
const glint = (x, y, L) =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${-ROT})" filter="url(#glow)"><path d="M${-L},0 L0,-1.3 L${L},0 L0,1.3Z M0,${-L} L1.3,0 L0,${L} L-1.3,0Z" fill="#fff"/><circle r="2.4" fill="#fff"/></g>`;

/** The gem-set bezel: a ring of round diamonds in a gold setting. */
function gemBezel() {
  const rand = rng(29);
  const rIn = R * 0.875;
  const rOut = R * 0.985;
  const rc = (rIn + rOut) / 2;
  const sr = ((rOut - rIn) / 2) * 0.86;
  const count = Math.floor((2 * Math.PI * rc) / (2 * sr + 2.6));
  let out = conicRing(rOut, rIn, (s) => gold(clamp(0.15 + 0.45 * env(s))));
  let glints = '';
  for (let i = 0; i < count; i++) {
    const a = (i * 360) / count;
    const [x, y] = pt(rc, a);
    const lit = lobe(a + ROT - LIGHT, 2) * 0.8 + lobe(a + ROT - LIGHT + 180, 6) * 0.4;
    out += roundStone(x, y, sr, rand, lit);
    // gold beads between the stones hold them in place
    for (const off of [-0.55, 0.55]) {
      const [bx, by] = pt(rc + off * sr * 1.2, a + 180 / count);
      out += `<circle cx="${bx}" cy="${by}" r="2.4" fill="${gold(0.55 + 0.4 * lit)}"/>`;
    }
    if ((lit > 0.55 && rand() > 0.45) || rand() > 0.95) glints += glint(x + sr * 0.2, y - sr * 0.2, sr * (1.2 + rand()));
  }
  return { body: out, glints };
}

/** A baguette diamond in a polished gold frame, pointing along watch angle a. */
function baguette(a, rand) {
  const w = DR * 0.062;
  const l = DR * 0.17;
  const y0 = C - DR * 0.885;
  const x0 = C - w / 2;
  const lit = facing(a);
  let out = `<g transform="rotate(${a} ${C} ${C})">`;
  out += `<rect x="${n(x0 - 3.5)}" y="${n(y0 - 3.5)}" width="${n(w + 7)}" height="${n(l + 7)}" rx="1.5" fill="url(#frameGold)"/>`;
  // step cut: nested rectangles, each a band of facets catching the light differently
  const steps = [0, 0.18, 0.36];
  steps.forEach((k, j) => {
    const ix = x0 + w * k * 0.5;
    const iy = y0 + w * k * 0.5;
    const iw = w * (1 - k);
    const ih = l - w * k;
    const b = clamp(0.4 + 0.45 * rand() + 0.25 * lit - j * 0.08);
    out += `<rect x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}" fill="${ice(b)}"/>`;
    out += `<rect x="${n(ix)}" y="${n(iy)}" width="${n(iw / 2)}" height="${n(ih)}" fill="${ice(clamp(b + (rand() - 0.5) * 0.5))}" fill-opacity="0.6"/>`;
  });
  out += `<path d="M${n(x0)},${n(y0)} L${n(x0 + w * 0.32)},${n(y0 + w * 0.32)} M${n(x0 + w)},${n(y0)} L${n(x0 + w * 0.68)},${n(y0 + w * 0.32)} M${n(x0)},${n(y0 + l)} L${n(x0 + w * 0.32)},${n(y0 + l - w * 0.32)} M${n(x0 + w)},${n(y0 + l)} L${n(x0 + w * 0.68)},${n(y0 + l - w * 0.32)}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.8"/>`;
  out += `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(l)}" fill="none" stroke="#2a1c06" stroke-opacity="0.6" stroke-width="0.8"/>`;
  return out + '</g>';
}

/* ---------- case ---------- */
function caseRings() {
  const ring = (r1, r2, shift, gain, bias) => conicRing(R * r1, R * r2, (s) => gold(clamp(bias + gain * env(s + shift))));
  let out = `<g filter="url(#dropLg)"><circle cx="${C}" cy="${C}" r="${R}" fill="#8a6522"/></g>`;
  out += ring(1.0, 0.982, 180, 0.6, 0.08); // case side
  const gems = gemBezel();
  out += gems.body;
  out += ring(0.875, 0.858, 175, 0.85, 0.08); // polished inner lip
  out += conicRing(R * 0.858, DR, (s) => mix('#4a3410', '#ecd394', 0.15 + 0.75 * env(s + 180))); // flange
  out += `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#caseVolume)"/>`;
  return { body: out, glints: gems.glints };
}

/* ---------- dial ---------- */
function dial() {
  const rand = rng(11);
  let out = `<circle cx="${C}" cy="${C}" r="${n(DR)}" fill="#d6aa4c"/><g clip-path="url(#dialClip)">`;
  const step = 0.5;
  for (let a = 0; a < 360; a += step) {
    const s = a + ROT;
    const b = clamp(0.12 + 0.82 * Math.abs(cosd(s - LIGHT)) ** 3 + 0.12 * Math.abs(cosd(s - LIGHT - 90)) ** 18 + (rand() - 0.5) * 0.08);
    const [x1, y1] = pt(DR + 2, a);
    const [x2, y2] = pt(DR + 2, a + step + 0.25);
    out += `<path d="M${C},${C}L${x1},${y1}L${x2},${y2}Z" fill="${champagne(b)}"/>`;
  }
  out += `<circle cx="${C}" cy="${C}" r="${n(DR)}" fill="url(#dialVignette)"/><circle cx="${C}" cy="${C}" r="${n(DR)}" filter="url(#fineGrain)" opacity="0.05"/></g>`;

  // printed minute track
  const ink = '#3a2a0e';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const [x1, y1] = pt(DR * 0.965, i * 6);
    const [x2, y2] = pt(DR * (big ? 0.925 : 0.94), i * 6);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-opacity="${big ? 0.85 : 0.65}" stroke-width="${big ? 2 : 1.1}"/>`;
  }
  return out;
}

/** Cut-out windows for the day (12 o'clock) and date (3 o'clock). The words are drawn live on top. */
function windows() {
  let out = '';
  for (const { x, y, w, h } of [DAY, DATE]) {
    out += `<g filter="url(#dropSm)"><rect x="${n(x - w / 2 - 4)}" y="${n(y - h / 2 - 4)}" width="${n(w + 8)}" height="${n(h + 8)}" rx="3" fill="url(#frameGold)"/></g>`;
    out += `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="1.5" fill="url(#windowG)"/>`;
  }
  return out;
}

function indices() {
  const rand = rng(5);
  let out = '';
  for (let h = 1; h < 12; h++) {
    if (h === 3) continue; // date window
    out += baguette(h * 30, rand);
  }
  return `<g filter="url(#dropXs)">${out}</g>`;
}

/* ---------- shared defs for the body ---------- */
function bodyDefs(extra) {
  const drop = (id, dx, dy, blur, op) => {
    const [x, y] = toWatch(dx, dy);
    return `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/><feOffset dx="${x}" dy="${y}" result="b"/><feFlood flood-color="#000" flood-opacity="${op}"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  };
  const yIn = C - R * 0.8;
  return `
<linearGradient id="linkOuter" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3d10"/><stop offset="0.14" stop-color="#c4973f"/><stop offset="0.4" stop-color="#f7de98"/><stop offset="0.62" stop-color="#e3b655"/><stop offset="0.9" stop-color="#9c6a1e"/><stop offset="1" stop-color="#4a320c"/></linearGradient>
<linearGradient id="linkCenter" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a4812"/><stop offset="0.16" stop-color="#e2b75e"/><stop offset="0.33" stop-color="#fffbe6"/><stop offset="0.46" stop-color="#f6d685"/><stop offset="0.74" stop-color="#b48535"/><stop offset="1" stop-color="#5a3d10"/></linearGradient>
<linearGradient id="linkV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.22" stop-color="#fff" stop-opacity="0"/><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a2000" stop-opacity="0.3"/></linearGradient>
<linearGradient id="frameGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4cc"/><stop offset="0.45" stop-color="#c49a45"/><stop offset="1" stop-color="#5a3d10"/></linearGradient>
<linearGradient id="windowG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b4aa"/><stop offset="0.28" stop-color="#f6f4ef"/><stop offset="1" stop-color="#e8e4dc"/></linearGradient>
<linearGradient id="fadeUp" gradientUnits="userSpaceOnUse" x1="0" y1="${n(yIn)}" x2="0" y2="${n(yIn - 520)}"><stop offset="0" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#0a0500" stop-opacity="0.5"/></linearGradient>
<linearGradient id="fadeDown" gradientUnits="userSpaceOnUse" x1="0" y1="${n(2 * C - yIn)}" x2="0" y2="${n(2 * C - yIn + 520)}"><stop offset="0" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#0a0500" stop-opacity="0.5"/></linearGradient>
<radialGradient id="caseVolume" cx="${C}" cy="${C}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0.97" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></radialGradient>
<radialGradient id="dialVignette" cx="${C}" cy="${C}" r="${n(DR)}" gradientUnits="userSpaceOnUse"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="0.9" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>
<clipPath id="dialClip"><circle cx="${C}" cy="${C}" r="${n(DR)}"/></clipPath>
<filter id="brushed" filterUnits="userSpaceOnUse" x="-400" y="-1200" width="2000" height="3600"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.012" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.6 0 0 0 -0.75" result="hi"/><feComposite in="hi" in2="SourceAlpha" operator="in"/></filter>
<filter id="fineGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>
<filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${drop('dropLg', 10, 18, 16, 0.75)}${drop('dropMd', 6, 10, 7, 0.6)}${drop('dropSm', 3, 5, 3, 0.55)}${drop('dropXs', 1.6, 2.8, 1.4, 0.65)}${extra}`;
}

/** The static watch body (everything that does not move), tilted by ROT. */
function bodySvg() {
  const l = lugs();
  const c = crown();
  const cs = caseRings();
  const body = bracelet() + l.body + c.body + cs.body + dial() + windows() + indices() + cs.glints;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<defs>${bodyDefs(l.defs + c.defs)}</defs>
<ellipse cx="${C + 26}" cy="${C + 40}" rx="${n(R * 1.08)}" ry="${n(R * 1.02)}" fill="#000" opacity="0.6" filter="url(#softBlur)"/>
<g transform="rotate(${ROT} ${C} ${C})">${body}</g>
</svg>`;
}

/* ---------- live layer: hands, day, date and crystal ---------- */
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function liveSvg(href, prefix = 'hw-') {
  const id = (s) => `${prefix}${s}`;
  // faceted baton hand: two flat halves meeting in a ridge, with a pointed tip
  const baton = (L, w) => {
    const tail = w * 1.1;
    return `<path d="M0,${n(tail)} L${n(-w / 2)},${n(tail)} L${n(-w / 2)},${n(-L * 0.9)} L0,${n(-L)} Z" fill="url(#${id('handL')})"/><path d="M0,${n(tail)} L${n(w / 2)},${n(tail)} L${n(w / 2)},${n(-L * 0.9)} L0,${n(-L)} Z" fill="url(#${id('handD')})"/>`;
  };
  const now = new Date(Date.now() + 6 * 3600e3);
  const rCrystal = n(R * 0.875);
  const font = "Helvetica, Arial, sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" class="hero__watch" role="img" aria-label="Gold watch showing the current time, day and date in Bangladesh">
<defs>
<radialGradient id="${id('halo')}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9a961" stop-opacity="0.3"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/></radialGradient>
<linearGradient id="${id('handL')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset="1" stop-color="#d2a654"/></linearGradient>
<linearGradient id="${id('handD')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a87a2a"/><stop offset="1" stop-color="#5a3c10"/></linearGradient>
<radialGradient id="${id('cap')}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff6d6"/><stop offset="0.5" stop-color="#c49a45"/><stop offset="1" stop-color="#4a3210"/></radialGradient>
<linearGradient id="${id('glare')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id('rim')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.4"/><stop offset="0.32" stop-color="#fff" stop-opacity="0"/><stop offset="0.8" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient>
<filter id="${id('handShadow')}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="4" dy="7" stdDeviation="3.5" flood-color="#000" flood-opacity="0.45"/></filter>
<clipPath id="${id('crystal')}"><circle cx="${C}" cy="${C}" r="${rCrystal}"/></clipPath>
</defs>
<circle cx="${C}" cy="${C}" r="560" fill="url(#${id('halo')})"/>
<image href="${href}" x="0" y="0" width="${S}" height="${S}"/>
<g transform="rotate(${ROT} ${C} ${C})" font-family="${font}" font-weight="700" fill="#1b1b1b" text-anchor="middle" dominant-baseline="central">
<text id="${id('day')}" x="${n(DAY.x)}" y="${n(DAY.y + 1)}" font-size="${n(DR * 0.07)}" letter-spacing="1.5">${DAYS[now.getUTCDay()]}</text>
<text id="${id('date')}" x="${n(DATE.x)}" y="${n(DATE.y + 1)}" font-size="${n(DR * 0.095)}">${now.getUTCDate()}</text>
</g>
<g filter="url(#${id('handShadow')})"><g transform="rotate(${ROT} ${C} ${C})">
<g id="${id('hour')}" transform="translate(${C} ${C}) rotate(304.5)">${baton(DR * 0.56, DR * 0.06)}</g>
<g id="${id('minute')}" transform="translate(${C} ${C}) rotate(57.6)">${baton(DR * 0.87, DR * 0.048)}</g>
<g id="${id('second')}" transform="translate(${C} ${C}) rotate(216)"><rect x="-1.2" y="${n(-DR * 0.93)}" width="2.4" height="${n(DR * 1.15)}" rx="1.2" fill="#e2bd6c"/><circle cx="0" cy="${n(DR * 0.16)}" r="${n(DR * 0.03)}" fill="#c9a050"/></g>
<circle cx="${C}" cy="${C}" r="${n(DR * 0.05)}" fill="url(#${id('cap')})"/><circle cx="${C}" cy="${C}" r="${n(DR * 0.016)}" fill="#3a2808"/>
</g></g>
<g clip-path="url(#${id('crystal')})"><ellipse cx="${n(C - R * 0.32)}" cy="${n(C - R * 0.5)}" rx="${n(R * 0.95)}" ry="${n(R * 0.48)}" transform="rotate(-32 ${n(C - R * 0.32)} ${n(C - R * 0.5)})" fill="url(#${id('glare')})"/></g>
<circle cx="${C}" cy="${C}" r="${n(rCrystal - 3)}" fill="none" stroke="url(#${id('rim')})" stroke-width="5"/>
</svg>`;
}

/* ---------- write ---------- */
const raster = await sharp(Buffer.from(bodySvg()), { density: 144 })
  .resize(S, S)
  .webp({ quality: 86, alphaQuality: 90, effort: 6 })
  .toBuffer();
writeFileSync(join(ROOT, IMAGE), raster);

const indexFile = join(ROOT, 'index.html');
const indexHtml = readFileSync(indexFile, 'utf8');
const markers = /(<!-- hero-watch:start -->)[\s\S]*?(<!-- hero-watch:end -->)/;
if (!markers.test(indexHtml)) throw new Error('index.html: hero-watch markers not found');
writeFileSync(indexFile, indexHtml.replace(markers, (m, a, b) => `${a}\n${liveSvg(IMAGE)}\n        ${b}`));

const at = process.argv.indexOf('--preview');
if (at > 0) {
  const png = await sharp(raster).png().toBuffer(); // the SVG renderer here cannot decode WebP
  const dataUri = `data:image/png;base64,${png.toString('base64')}`;
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><radialGradient id="g" cx="0.7" cy="0.4" r="0.8"><stop offset="0" stop-color="#2a261f"/><stop offset="0.55" stop-color="#0d0c0b"/><stop offset="1" stop-color="#050505"/></radialGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`;
  const live = await sharp(Buffer.from(liveSvg(dataUri, 'p-'))).png().toBuffer();
  await sharp(Buffer.from(bg)).composite([{ input: live }]).png().toFile(process.argv[at + 1]);
}

console.log(`Wrote ${IMAGE} (${Math.round(raster.length / 1024)} KB) and the live hero layer in index.html`);
