/**
 * ZENRO Wrist & Co. home page hero watch
 * --------------------------------------
 * Builds the hero wristwatch in two layers:
 *
 *   node tools/generate-hero.mjs        (or: npm run hero)
 *
 *   images/hero-watch.webp   the watch body (strap, case, dial, indices). It is drawn as SVG with
 *                            lighting, grain and soft shadows, then rendered to a picture with
 *                            sharp so the page does not have to run those filters.
 *   index.html               a small inline SVG between the <!-- hero-watch:start --> and
 *                            <!-- hero-watch:end --> markers. It shows the picture and draws the
 *                            hands, the date and the crystal reflections on top, so js/home.js can
 *                            turn the hands to the live Bangladesh time and set today's date.
 *
 * The design is a generic dress watch: polished steel case, midnight-blue sunburst dial, applied
 * faceted indices, date at 3 o'clock and a black grained leather strap. No names or emblems.
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
const DR = R * 0.835; // dial radius
const ROT = -16; // tilt of the whole watch, degrees
const LIGHT = 315; // screen direction the light comes from (0 = up, clockwise)
const W = R * 1.0; // strap width at the case (20 mm lugs on a 40 mm case)

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
/** Polished steel from 0 (in shadow) to 1 (catching the light). */
const steel = (b) => (b < 0.5 ? mix('#1c1f23', '#8a9098', b * 2) : mix('#8a9098', '#f7f9fb', (b - 0.5) * 2));

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

/* ---------- strap ---------- */
function strap() {
  const Wt = W * 0.86;
  const yIn = R * 0.8;
  const far = 1500;
  const shape = (sy) => {
    const y0 = C + sy * yIn;
    const y1 = C + sy * far;
    return `M${n(C - W / 2)},${n(y0)} L${n(C - Wt / 2)},${n(y1)} L${n(C + Wt / 2)},${n(y1)} L${n(C + W / 2)},${n(y0)} Z`;
  };
  const halfAt = (dist) => (W - (W - Wt) * clamp((dist - yIn) / (far - yIn))) / 2;
  const [sx, sy] = toWatch(16, 26);

  let out = `<g opacity="0.55" filter="url(#softBlur)" transform="translate(${sx} ${sy})"><path d="${shape(-1)}"/><path d="${shape(1)}"/></g>`;
  for (const side of [-1, 1]) {
    const d = shape(side);
    out += `<path d="${d}" fill="url(#leather)"/>`;
    out += `<path d="${d}" fill="#000" filter="url(#grain)" opacity="0.5"/>`;
    // padded edge: a soft crease just inside each side
    for (const edge of [-1, 1]) {
      const inset = W * 0.085;
      const stitch = W * 0.055;
      const a = R * 0.86;
      const b = far;
      const x = (dist, k) => n(C + edge * (halfAt(dist) - k));
      const y = (dist) => n(C + side * dist);
      out += `<line x1="${x(a, inset)}" y1="${y(a)}" x2="${x(b, inset)}" y2="${y(b)}" stroke="#fff" stroke-opacity="0.05" stroke-width="3"/>`;
      out += `<line x1="${x(a, stitch) + 0.8}" y1="${y(a) + 1.2}" x2="${x(b, stitch) + 0.8}" y2="${y(b) + 1.2}" stroke="#000" stroke-opacity="0.7" stroke-width="2.6" stroke-dasharray="8 6" stroke-linecap="round"/>`;
      out += `<line x1="${x(a, stitch)}" y1="${y(a)}" x2="${x(b, stitch)}" y2="${y(b)}" stroke="#cfc8b8" stroke-opacity="0.8" stroke-width="2" stroke-dasharray="8 6" stroke-linecap="round"/>`;
    }
    // painted edge
    out += `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.8" stroke-width="2.5"/>`;
    // the strap curves away from the light the further it gets from the case
    out += `<path d="${d}" fill="url(#${side < 0 ? 'fadeUp' : 'fadeDown'})"/>`;
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
      const outer = steel(0.08 + 0.8 * facing(sx > 0 ? 90 : 270) ** 1.6);
      const top = steel(0.42 + 0.4 * facing(sy < 0 ? 0 : 180));
      defs += `<linearGradient id="lug${i}" gradientUnits="userSpaceOnUse" x1="${n(xo)}" y1="0" x2="${n(xi)}" y2="0"><stop offset="0" stop-color="${outer}"/><stop offset="0.3" stop-color="${mix(outer, '#ffffff', 0.25)}"/><stop offset="0.38" stop-color="#f4f6f8"/><stop offset="0.5" stop-color="${top}"/><stop offset="1" stop-color="${mix(top, '#000000', 0.25)}"/></linearGradient>`;
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
  const top = steel(0.2 + 0.75 * facing(0));
  const bottom = steel(0.08 + 0.5 * facing(180));
  let out = `<linearGradient id="crownG" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y0)}" x2="0" y2="${n(y0 + h)}"><stop offset="0" stop-color="#15171a"/><stop offset="0.12" stop-color="${top}"/><stop offset="0.3" stop-color="#f6f8fa"/><stop offset="0.55" stop-color="${steel(0.45)}"/><stop offset="0.88" stop-color="${bottom}"/><stop offset="1" stop-color="#0d0f11"/></linearGradient>`;
  const defs = out;
  out = `<g filter="url(#dropSm)">`;
  out += `<rect x="${n(C + R - 6)}" y="${n(C - h * 0.22)}" width="18" height="${n(h * 0.44)}" fill="url(#crownG)"/>`;
  out += `<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" rx="7" fill="url(#crownG)"/>`;
  for (let y = y0 + 5; y < y0 + h - 4; y += 4.4) {
    out += `<line x1="${n(x0 + 4)}" y1="${n(y)}" x2="${n(x0 + w - 3)}" y2="${n(y)}" stroke="#000" stroke-opacity="0.32" stroke-width="1.4"/>`;
    out += `<line x1="${n(x0 + 4)}" y1="${n(y + 1.6)}" x2="${n(x0 + w - 3)}" y2="${n(y + 1.6)}" stroke="#fff" stroke-opacity="0.18" stroke-width="1"/>`;
  }
  out += `<rect x="${n(x0 + w - 5)}" y="${n(y0 + 3)}" width="4" height="${n(h - 6)}" rx="2" fill="#fff" fill-opacity="0.22"/></g>`;
  return { defs, body: out };
}

/* ---------- case ---------- */
function caseRings() {
  const ring = (r1, r2, shift, gain, bias) => conicRing(R * r1, R * r2, (s) => steel(clamp(bias + gain * env(s + shift))));
  let out = `<g filter="url(#dropLg)"><circle cx="${C}" cy="${C}" r="${R}" fill="#5d6269"/></g>`;
  out += ring(1.0, 0.982, 180, 0.55, 0.06); // case side
  out += ring(0.982, 0.912, 0, 1.0, 0.0); // polished bezel slope
  out += ring(0.912, 0.9, 0, 0.7, 0.32); // crest
  out += ring(0.9, 0.868, 175, 0.85, 0.02); // inner slope, lit from the far side
  out += conicRing(R * 0.868, DR, (s) => mix('#02060c', '#1f3556', 0.15 + 0.7 * env(s + 180))); // flange
  out += `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#caseVolume)"/>`;
  return out;
}

/* ---------- dial ---------- */
function dial() {
  const rand = rng(11);
  let out = `<circle cx="${C}" cy="${C}" r="${n(DR)}" fill="#0b1a33"/><g clip-path="url(#dialClip)">`;
  const step = 0.5;
  for (let a = 0; a < 360; a += step) {
    const s = a + ROT;
    const b = clamp(0.1 + 0.85 * Math.abs(cosd(s - LIGHT)) ** 3.2 + 0.12 * Math.abs(cosd(s - LIGHT - 90)) ** 18 + (rand() - 0.5) * 0.09);
    const [x1, y1] = pt(DR + 2, a);
    const [x2, y2] = pt(DR + 2, a + step + 0.25);
    out += `<path d="M${C},${C}L${x1},${y1}L${x2},${y2}Z" fill="${mix('#050e1d', '#3a6db3', b)}"/>`;
  }
  out += `<circle cx="${C}" cy="${C}" r="${n(DR)}" fill="url(#dialVignette)"/><circle cx="${C}" cy="${C}" r="${n(DR)}" filter="url(#fineGrain)" opacity="0.07"/></g>`;

  // printed railway minute track
  const ink = '#dfe7f1';
  out += `<circle cx="${C}" cy="${C}" r="${n(DR * 0.958)}" fill="none" stroke="${ink}" stroke-opacity="0.5" stroke-width="1"/><circle cx="${C}" cy="${C}" r="${n(DR * 0.918)}" fill="none" stroke="${ink}" stroke-opacity="0.5" stroke-width="1"/>`;
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const [x1, y1] = pt(DR * 0.958, i * 6);
    const [x2, y2] = pt(DR * (big ? 0.9 : 0.918), i * 6);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-opacity="${big ? 0.9 : 0.7}" stroke-width="${big ? 2.2 : 1.2}"/>`;
  }
  return out;
}

/** The cut-out date window at 3 o'clock. The number itself is drawn live on top. */
function dateWindow() {
  const { x, y, w, h } = DATE;
  let out = `<g filter="url(#dropSm)"><rect x="${n(x - w / 2 - 4)}" y="${n(y - h / 2 - 4)}" width="${n(w + 8)}" height="${n(h + 8)}" rx="2.5" fill="url(#frameG)"/></g>`;
  out += `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="1" fill="url(#dateG)"/>`;
  return out;
}
const DATE = { x: C + DR * 0.7, y: C, w: DR * 0.17, h: DR * 0.13 };

/** Applied, faceted steel indices. Each bar has two facets that catch the light differently. */
function indices() {
  const bw = DR * 0.05;
  const y0 = C - DR * 0.885;
  const y1 = C - DR * 0.715;
  let out = '';
  const bar = (a, ox, w) => {
    const l = steel(0.12 + 0.86 * facing(a - 90) ** 1.4);
    const r = steel(0.12 + 0.86 * facing(a + 90) ** 1.4);
    const cx = C + ox;
    const t = w * 0.35;
    return `<g transform="rotate(${a} ${C} ${C})"><path d="M${n(cx - w / 2)},${n(y0 + t)} L${n(cx)},${n(y0)} L${n(cx)},${n(y1)} L${n(cx - w / 2)},${n(y1 - t)} Z" fill="${l}"/><path d="M${n(cx + w / 2)},${n(y0 + t)} L${n(cx)},${n(y0)} L${n(cx)},${n(y1)} L${n(cx + w / 2)},${n(y1 - t)} Z" fill="${r}"/><line x1="${n(cx)}" y1="${n(y0 + 1)}" x2="${n(cx)}" y2="${n(y1 - 1)}" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/></g>`;
  };
  for (let h = 0; h < 12; h++) {
    if (h === 3) continue; // date window
    const a = h * 30;
    out += h === 0 ? bar(a, -bw * 0.8, bw * 0.9) + bar(a, bw * 0.8, bw * 0.9) : bar(a, 0, bw);
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
<linearGradient id="leather" gradientUnits="userSpaceOnUse" x1="${n(C - W / 2)}" y1="0" x2="${n(C + W / 2)}" y2="0"><stop offset="0" stop-color="#030303"/><stop offset="0.05" stop-color="#151413"/><stop offset="0.28" stop-color="#2b2926"/><stop offset="0.55" stop-color="#1f1d1b"/><stop offset="0.93" stop-color="#0f0e0d"/><stop offset="1" stop-color="#020202"/></linearGradient>
<linearGradient id="fadeUp" gradientUnits="userSpaceOnUse" x1="0" y1="${n(yIn)}" x2="0" y2="${n(yIn - 520)}"><stop offset="0" stop-color="#000" stop-opacity="0.15"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></linearGradient>
<linearGradient id="fadeDown" gradientUnits="userSpaceOnUse" x1="0" y1="${n(2 * C - yIn)}" x2="0" y2="${n(2 * C - yIn + 520)}"><stop offset="0" stop-color="#000" stop-opacity="0.15"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></linearGradient>
<radialGradient id="caseVolume" cx="${C}" cy="${C}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0.86" stop-color="#000" stop-opacity="0"/><stop offset="0.93" stop-color="#000" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>
<radialGradient id="dialVignette" cx="${C}" cy="${C}" r="${n(DR)}" gradientUnits="userSpaceOnUse"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="0.9" stop-color="#000" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
<linearGradient id="frameG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="0.45" stop-color="#9aa1a9"/><stop offset="1" stop-color="#3a3f45"/></linearGradient>
<linearGradient id="dateG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b4aa"/><stop offset="0.3" stop-color="#f3f1ec"/><stop offset="1" stop-color="#e6e2da"/></linearGradient>
<clipPath id="dialClip"><circle cx="${C}" cy="${C}" r="${n(DR)}"/></clipPath>
<filter id="grain" filterUnits="userSpaceOnUse" x="-400" y="-1200" width="2000" height="3600"><feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="3" seed="7" result="n"/><feDiffuseLighting in="n" surfaceScale="2.2" lighting-color="#fff" result="lit"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting><feColorMatrix in="lit" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.4 0 0 0 -0.95" result="hi"/><feComposite in="hi" in2="SourceAlpha" operator="in"/></filter>
<filter id="fineGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>
<filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
${drop('dropLg', 10, 18, 16, 0.75)}${drop('dropMd', 6, 10, 7, 0.6)}${drop('dropSm', 3, 5, 3, 0.55)}${drop('dropXs', 1.6, 2.8, 1.4, 0.7)}${extra}`;
}

/** The static watch body (everything that does not move), tilted by ROT. */
function bodySvg() {
  const l = lugs();
  const c = crown();
  const [gx, gy] = [C + 26, C + 40];
  const body = strap() + l.body + c.body + caseRings() + dial() + dateWindow() + indices();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<defs>${bodyDefs(l.defs + c.defs)}</defs>
<ellipse cx="${gx}" cy="${gy}" rx="${n(R * 1.08)}" ry="${n(R * 1.02)}" fill="#000" opacity="0.6" filter="url(#softBlur)"/>
<g transform="rotate(${ROT} ${C} ${C})">${body}</g>
</svg>`;
}

/* ---------- live layer: hands, date and crystal ---------- */
function liveSvg(href, prefix = 'hw-') {
  const id = (s) => `${prefix}${s}`;
  const dauphine = (L, w) => {
    const tail = w * 0.7;
    return `<path d="M0,${n(tail)} L${n(-w / 2)},${n(-L * 0.17)} L0,${n(-L)} Z" fill="url(#${id('handL')})"/><path d="M0,${n(tail)} L${n(w / 2)},${n(-L * 0.17)} L0,${n(-L)} Z" fill="url(#${id('handD')})"/>`;
  };
  const day = String(new Date(Date.now() + 6 * 3600e3).getUTCDate());
  const rCrystal = n(R * 0.87);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" class="hero__watch" role="img" aria-label="Watch showing the current time and date in Bangladesh">
<defs>
<radialGradient id="${id('halo')}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9a961" stop-opacity="0.26"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/></radialGradient>
<linearGradient id="${id('handL')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c0c8"/></linearGradient>
<linearGradient id="${id('handD')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d848d"/><stop offset="1" stop-color="#3c4148"/></linearGradient>
<radialGradient id="${id('cap')}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#a7aeb6"/><stop offset="1" stop-color="#3a3f45"/></radialGradient>
<linearGradient id="${id('glare')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id('rim')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.4"/><stop offset="0.32" stop-color="#fff" stop-opacity="0"/><stop offset="0.8" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient>
<filter id="${id('handShadow')}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="4" dy="7" stdDeviation="3.5" flood-color="#000" flood-opacity="0.5"/></filter>
<clipPath id="${id('crystal')}"><circle cx="${C}" cy="${C}" r="${rCrystal}"/></clipPath>
</defs>
<circle cx="${C}" cy="${C}" r="560" fill="url(#${id('halo')})"/>
<image href="${href}" x="0" y="0" width="${S}" height="${S}"/>
<g transform="rotate(${ROT} ${C} ${C})"><text id="${id('date')}" x="${n(DATE.x)}" y="${n(DATE.y + 1)}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${n(DR * 0.095)}" fill="#1b1b1b" text-anchor="middle" dominant-baseline="central">${day}</text></g>
<g filter="url(#${id('handShadow')})"><g transform="rotate(${ROT} ${C} ${C})">
<g id="${id('hour')}" transform="translate(${C} ${C}) rotate(304.5)">${dauphine(DR * 0.56, DR * 0.088)}</g>
<g id="${id('minute')}" transform="translate(${C} ${C}) rotate(57.6)">${dauphine(DR * 0.86, DR * 0.066)}</g>
<g id="${id('second')}" transform="translate(${C} ${C}) rotate(216)"><rect x="-1.2" y="${n(-DR * 0.92)}" width="2.4" height="${n(DR * 1.14)}" rx="1.2" fill="#e3e7eb"/><circle cx="0" cy="${n(DR * 0.16)}" r="${n(DR * 0.032)}" fill="#c9ced4"/></g>
<circle cx="${C}" cy="${C}" r="${n(DR * 0.05)}" fill="url(#${id('cap')})"/><circle cx="${C}" cy="${C}" r="${n(DR * 0.016)}" fill="#2a2e33"/>
</g></g>
<g clip-path="url(#${id('crystal')})"><ellipse cx="${n(C - R * 0.32)}" cy="${n(C - R * 0.5)}" rx="${n(R * 0.95)}" ry="${n(R * 0.48)}" transform="rotate(-32 ${n(C - R * 0.32)} ${n(C - R * 0.5)})" fill="url(#${id('glare')})"/></g>
<circle cx="${C}" cy="${C}" r="${n(rCrystal - 3)}" fill="none" stroke="url(#${id('rim')})" stroke-width="5"/>
</svg>`;
}

/* ---------- write ---------- */
const body = bodySvg();
const raster = await sharp(Buffer.from(body), { density: 144 })
  .resize(S, S)
  .webp({ quality: 86, alphaQuality: 90, effort: 6 })
  .toBuffer();
writeFileSync(join(ROOT, IMAGE), raster);

const indexFile = join(ROOT, 'index.html');
const indexHtml = readFileSync(indexFile, 'utf8');
const markers = /(<!-- hero-watch:start -->)[\s\S]*?(<!-- hero-watch:end -->)/;
if (!markers.test(indexHtml)) throw new Error('index.html: hero-watch markers not found');
writeFileSync(indexFile, indexHtml.replace(markers, (m, a, b) => `${a}\n${liveSvg(IMAGE)}\n        ${b}`));

// Optional full preview (body + live layer) for checking the look: node tools/generate-hero.mjs --preview <file.png>
const at = process.argv.indexOf('--preview');
if (at > 0) {
  const png = await sharp(raster).png().toBuffer(); // the SVG renderer here cannot decode WebP
  const dataUri = `data:image/png;base64,${png.toString('base64')}`;
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><radialGradient id="g" cx="0.7" cy="0.4" r="0.8"><stop offset="0" stop-color="#2a261f"/><stop offset="0.55" stop-color="#0d0c0b"/><stop offset="1" stop-color="#050505"/></radialGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`;
  const live = await sharp(Buffer.from(liveSvg(dataUri, 'p-'))).png().toBuffer();
  await sharp(Buffer.from(bg)).composite([{ input: live }]).png().toFile(process.argv[at + 1]);
}

console.log(`Wrote ${IMAGE} (${Math.round(raster.length / 1024)} KB) and the live hero layer in index.html`);
