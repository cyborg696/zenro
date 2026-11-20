/**
 * ZENRO Wrist & Co. image generator
 * ---------------------------------
 * Builds the few decorative images the site needs as original SVG illustrations
 * (no brand logos, no emblems, no text on the dial):
 *
 *   node tools/generate-images.mjs
 *
 * Output: images/hero-watch.svg  (home page hero, generic wristwatch illustration)
 *         index.html             the same hero watch, inlined between the
 *                                <!-- hero-watch:start --> / <!-- hero-watch:end --> markers so
 *                                js/home.js can turn its hands to the live Bangladesh time
 *         images/favicon.svg     ("ZW" monogram)
 *         images/og-image.svg    (social sharing card; convert to JPG with
 *                                 node tools/optimise-images.mjs --og)
 *
 * Product photos are real photos, prepared with tools/optimise-images.mjs.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'images');
mkdirSync(OUT, { recursive: true });

/* ---------- helpers ---------- */
const n = (v) => Math.round(v * 100) / 100;
const rad = (deg) => ((deg - 90) * Math.PI) / 180;
const pt = (cx, cy, r, deg) => [n(cx + r * Math.cos(rad(deg))), n(cy + r * Math.sin(rad(deg)))];
const stops = (colors) =>
  colors.map((c, i) => `<stop offset="${n(i / (colors.length - 1))}" stop-color="${c}"/>`).join('');
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = 'Helvetica, Arial, sans-serif';

const METALS = {
  steel: ['#fdfdfd', '#c3c6c9', '#8a8e93', '#eceded', '#a2a6ab', '#f6f6f6', '#74787d'],
  gold: ['#fff3cc', '#e2bf75', '#a27a2e', '#f4dc9b', '#b78f3e', '#fbe8b2', '#86621f'],
  rose: ['#ffe4d4', '#e3a98c', '#a6634a', '#f3c8b0', '#b8795d', '#fcdac7', '#8a4e37'],
  black: ['#707070', '#3b3b3b', '#151515', '#4f4f4f', '#202020', '#5e5e5e', '#0e0e0e'],
};

/* ---------- watch parts ---------- */
function strapPaths(cx, cy, R, yMin, yMax) {
  const W = R * 1.0;
  const Wt = W * 0.84;
  const yTop = cy - R * 0.78;
  const yBot = cy + R * 0.78;
  return {
    W, Wt, yTop, yBot,
    top: `M${n(cx - W / 2)},${n(yTop)} L${n(cx - Wt / 2)},${n(yMin)} L${n(cx + Wt / 2)},${n(yMin)} L${n(cx + W / 2)},${n(yTop)} Z`,
    bot: `M${n(cx - W / 2)},${n(yBot)} L${n(cx - Wt / 2)},${n(yMax)} L${n(cx + Wt / 2)},${n(yMax)} L${n(cx + W / 2)},${n(yBot)} Z`,
  };
}

function strap(p, cx, cy, R, yMin, yMax) {
  const s = strapPaths(cx, cy, R, yMin, yMax);
  const widthAt = (y) => {
    const t = y < cy ? (s.yTop - y) / (s.yTop - yMin) : (y - s.yBot) / (yMax - s.yBot);
    return s.W + (s.Wt - s.W) * Math.max(0, Math.min(1, t));
  };
  let out = `<g opacity="0.22" filter="url(#blurSm)" transform="translate(14 18)"><path d="${s.top}"/><path d="${s.bot}"/></g>`;
  const kind = p.strap.kind;

  if (kind === 'bracelet') {
    const rowH = R * 0.2;
    const rows = [];
    for (let y = s.yTop; y > yMin - rowH; y -= rowH) rows.push([y - rowH + 3, y - 3]);
    for (let y = s.yBot; y < yMax + rowH; y += rowH) rows.push([y + 3, y + rowH - 3]);
    out += `<path d="${s.top}" fill="#3a3c3f"/><path d="${s.bot}" fill="#3a3c3f"/>`;
    for (const [y1, y2] of rows) {
      const w = widthAt((y1 + y2) / 2);
      const cw = w * 0.4;
      const sw = (w - cw) / 2 - 3;
      out += `<rect x="${n(cx - w / 2)}" y="${n(y1)}" width="${n(sw)}" height="${n(y2 - y1)}" rx="4" fill="url(#metal)"/>`;
      out += `<rect x="${n(cx + cw / 2 + 3)}" y="${n(y1)}" width="${n(sw)}" height="${n(y2 - y1)}" rx="4" fill="url(#metal)"/>`;
      out += `<rect x="${n(cx - cw / 2)}" y="${n(y1)}" width="${n(cw)}" height="${n(y2 - y1)}" rx="5" fill="url(#metalV)"/>`;
      out += `<line x1="${n(cx - cw / 2 + 4)}" y1="${n(y1 + 2)}" x2="${n(cx + cw / 2 - 4)}" y2="${n(y1 + 2)}" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5"/>`;
    }
    return out;
  }

  out += `<path d="${s.top}" fill="url(#strap)" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>`;
  out += `<path d="${s.bot}" fill="url(#strap)" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>`;

  if (kind === 'leather' || kind === 'alligator') {
    if (kind === 'alligator') {
      out += `<path d="${s.top}" fill="url(#scales)"/><path d="${s.bot}" fill="url(#scales)"/>`;
    }
    const inset = R * 0.045;
    const edge = (sign, yA, yB) => {
      const xA = cx + sign * (widthAt(yA) / 2 - inset);
      const xB = cx + sign * (widthAt(yB) / 2 - inset);
      return `<line x1="${n(xA)}" y1="${n(yA)}" x2="${n(xB)}" y2="${n(yB)}" stroke="${p.strap.stitch}" stroke-width="2.2" stroke-dasharray="9 7" stroke-linecap="round" opacity="0.9"/>`;
    };
    out += edge(-1, s.yTop - 6, yMin) + edge(1, s.yTop - 6, yMin) + edge(-1, s.yBot + 6, yMax) + edge(1, s.yBot + 6, yMax);
  } else if (kind === 'rubber') {
    const step = R * 0.12;
    for (let y = s.yTop - step; y > yMin; y -= step) {
      const w = widthAt(y) / 2 - R * 0.08;
      out += `<line x1="${n(cx - w)}" y1="${n(y)}" x2="${n(cx + w)}" y2="${n(y)}" stroke="#000" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/><line x1="${n(cx - w)}" y1="${n(y + 3)}" x2="${n(cx + w)}" y2="${n(y + 3)}" stroke="#fff" stroke-opacity="0.07" stroke-width="2" stroke-linecap="round"/>`;
    }
    for (let y = s.yBot + step; y < yMax; y += step) {
      const w = widthAt(y) / 2 - R * 0.08;
      out += `<line x1="${n(cx - w)}" y1="${n(y)}" x2="${n(cx + w)}" y2="${n(y)}" stroke="#000" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/><line x1="${n(cx - w)}" y1="${n(y + 3)}" x2="${n(cx + w)}" y2="${n(y + 3)}" stroke="#fff" stroke-opacity="0.07" stroke-width="2" stroke-linecap="round"/>`;
    }
  } else if (kind === 'canvas') {
    for (let k = -5; k <= 5; k++) {
      const op = k % 2 === 0 ? 0.22 : 0.1;
      out += `<line x1="${n(cx + (k * s.W) / 11)}" y1="${n(s.yTop)}" x2="${n(cx + (k * s.Wt) / 11)}" y2="${n(yMin)}" stroke="#000" stroke-opacity="${op}" stroke-width="2"/>`;
      out += `<line x1="${n(cx + (k * s.W) / 11)}" y1="${n(s.yBot)}" x2="${n(cx + (k * s.Wt) / 11)}" y2="${n(yMax)}" stroke="#000" stroke-opacity="${op}" stroke-width="2"/>`;
    }
  }
  return out;
}

function lugsAndCrown(p, cx, cy, R) {
  const W = R * 1.0;
  const lw = R * 0.12;
  const h = R * 0.5;
  let out = '';
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? cx - W / 2 - lw + 6 : cx + W / 2 - 6;
    out += `<rect x="${n(x)}" y="${n(cy - R * 1.06)}" width="${n(lw)}" height="${n(h)}" rx="${n(lw / 2.4)}" fill="url(#metalV)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5"/>`;
    out += `<rect x="${n(x)}" y="${n(cy + R * 1.06 - h)}" width="${n(lw)}" height="${n(h)}" rx="${n(lw / 2.4)}" fill="url(#metalV)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5"/>`;
  }
  const crownW = R * 0.13;
  const crownH = R * 0.2;
  const crown = (angle, w, hgt, grooves) => {
    let g = `<g transform="rotate(${angle} ${cx} ${cy})"><rect x="${n(cx + R - 8)}" y="${n(cy - hgt / 2)}" width="${n(w + 8)}" height="${n(hgt)}" rx="${n(hgt * 0.18)}" fill="url(#metalV)" stroke="#000" stroke-opacity="0.35" stroke-width="1.5"/>`;
    if (grooves) {
      for (let i = 1; i < 6; i++) {
        const y = cy - hgt / 2 + (hgt * i) / 6;
        g += `<line x1="${n(cx + R + w * 0.25)}" y1="${n(y)}" x2="${n(cx + R + w - 2)}" y2="${n(y)}" stroke="#000" stroke-opacity="0.35" stroke-width="1.5"/>`;
      }
    }
    return g + '</g>';
  };
  if (p.type === 'chrono') {
    out += crown(-38, crownW * 0.75, crownH * 0.62, false) + crown(38, crownW * 0.75, crownH * 0.62, false);
  }
  if (p.type === 'diver') {
    out += `<path d="M${n(cx + R * 0.92)},${n(cy - R * 0.3)} Q${n(cx + R * 1.12)},${n(cy)} ${n(cx + R * 0.92)},${n(cy + R * 0.3)} Z" fill="url(#metalV)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5"/>`;
  }
  out += crown(0, crownW, crownH, true);
  return out;
}

function bezel(p, cx, cy, R) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#metal)" stroke="#000" stroke-opacity="0.4" stroke-width="2"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${n(R * 0.965)}" fill="url(#metalR)"/>`;
  let dialR;

  if (p.type === 'diver' || p.bezel === 'tachy') {
    const rO = R * 0.93;
    const rI = R * 0.75;
    out += `<circle cx="${cx}" cy="${cy}" r="${n(rO)}" fill="url(#bezelInsert)" stroke="#000" stroke-opacity="0.5" stroke-width="1.5"/>`;
    const ink = p.bezelInk || '#f2efe8';
    if (p.type === 'diver') {
      for (let i = 0; i < 60; i++) {
        const a = i * 6;
        if (i === 0) continue;
        if (i % 10 === 0) {
          const [x, y] = pt(cx, cy, (rO + rI) / 2, a);
          out += `<text x="${x}" y="${y}" transform="rotate(${a} ${x} ${y})" font-family="${SANS}" font-weight="700" font-size="${n(R * 0.085)}" fill="${ink}" text-anchor="middle" dominant-baseline="central">${i}</text>`;
        } else if (i % 5 === 0) {
          const [x1, y1] = pt(cx, cy, rO - R * 0.035, a);
          const [x2, y2] = pt(cx, cy, rI + R * 0.045, a);
          out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${n(R * 0.022)}"/>`;
        } else if (i < 15) {
          const [x1, y1] = pt(cx, cy, rO - R * 0.035, a);
          const [x2, y2] = pt(cx, cy, rO - R * 0.075, a);
          out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${n(R * 0.01)}"/>`;
        }
      }
      const [tx, ty] = pt(cx, cy, rO - R * 0.03, 0);
      const tw = R * 0.075;
      out += `<path d="M${n(tx - tw)},${n(ty)} L${n(tx + tw)},${n(ty)} L${n(tx)},${n(ty + tw * 1.5)} Z" fill="${ink}"/>`;
      out += `<circle cx="${n(tx)}" cy="${n(ty + tw * 0.55)}" r="${n(tw * 0.32)}" fill="${p.lume}" stroke="#777" stroke-width="1"/>`;
    } else {
      // tachymeter scale
      for (let i = 0; i < 60; i++) {
        const [x1, y1] = pt(cx, cy, rI + R * 0.01, i * 6);
        const [x2, y2] = pt(cx, cy, rI + R * 0.04, i * 6);
        out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-opacity="0.8" stroke-width="1.4"/>`;
      }
      for (const t of [500, 300, 200, 150, 120, 100, 90, 80, 70, 65]) {
        const a = (3600 / t) * 6;
        const [x, y] = pt(cx, cy, (rO + rI) / 2 + R * 0.015, a);
        out += `<text x="${x}" y="${y}" transform="rotate(${n(a)} ${x} ${y})" font-family="${SANS}" font-weight="700" font-size="${n(R * 0.06)}" fill="${ink}" text-anchor="middle" dominant-baseline="central">${t}</text>`;
      }
      const [x, y] = pt(cx, cy, (rO + rI) / 2 + R * 0.015, 330);
      out += `<text x="${x}" y="${y}" transform="rotate(330 ${x} ${y})" font-family="${SANS}" font-weight="700" letter-spacing="2" font-size="${n(R * 0.05)}" fill="${ink}" text-anchor="middle" dominant-baseline="central">TACHYMETRE</text>`;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="${n(rI)}" fill="url(#metalR)" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>`;
    dialR = R * 0.71;
  } else {
    const thin = p.type === 'dress';
    out += `<circle cx="${cx}" cy="${cy}" r="${n(R * 0.93)}" fill="url(#metal)" stroke="#000" stroke-opacity="0.25" stroke-width="1"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${n(R * (thin ? 0.9 : 0.86))}" fill="url(#metalR)" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>`;
    dialR = R * (thin ? 0.87 : 0.82);
  }
  // rehaut (inner flange)
  out += `<circle cx="${cx}" cy="${cy}" r="${n(dialR + R * 0.012)}" fill="#000" fill-opacity="0.55"/>`;
  return { out, dialR };
}

function dialTexture(p, cx, cy, r) {
  let out = '';
  if (p.texture === 'sunburst') {
    let d = '';
    for (let i = 0; i < 240; i++) {
      const [x, y] = pt(cx, cy, r, i * 1.5);
      d += `M${cx},${cy}L${x},${y}`;
    }
    out += `<path d="${d}" stroke="#fff" stroke-opacity="0.05" stroke-width="1.2"/>`;
    out += `<path d="M${cx - r},${cy - r} L${cx + r},${cy + r} L${cx + r},${cy - r * 0.6} Z" fill="#fff" opacity="0.06"/>`;
  } else if (p.texture === 'guilloche') {
    out += `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="url(#clous)"/>`;
  } else if (p.texture === 'grain') {
    out += `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" filter="url(#grain)" opacity="0.18"/>`;
  }
  return `<g clip-path="url(#dialClip)">${out}</g>`;
}

function indices(p, cx, cy, r) {
  let out = '';
  const ink = p.ink;
  // minute track
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    const [x1, y1] = pt(cx, cy, r * 0.965, i * 6);
    const [x2, y2] = pt(cx, cy, r * (hour ? 0.9 : 0.925), i * 6);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-opacity="0.75" stroke-width="${hour ? 2.4 : 1.2}"/>`;
  }
  const skip = new Set(p.type === 'chrono' ? [3, 6, 9] : p.date ? [3] : []);
  const style = p.indices;

  if (style === 'baton') {
    for (let h = 0; h < 12; h++) {
      if (skip.has(h)) continue;
      const bw = r * (h === 0 ? 0.035 : 0.04);
      const bl = r * 0.18;
      const xs = h === 0 ? [-bw * 0.85, bw * 0.85] : [0];
      for (const ox of xs) {
        out += `<g transform="rotate(${h * 30} ${cx} ${cy})"><rect x="${n(cx + ox - bw / 2)}" y="${n(cy - r * 0.86)}" width="${n(bw)}" height="${n(bl)}" rx="1.5" fill="url(#metalV)" stroke="#000" stroke-opacity="0.45" stroke-width="1"/>`;
        if (p.lumeIndices) out += `<rect x="${n(cx + ox - bw / 4)}" y="${n(cy - r * 0.845)}" width="${n(bw / 2)}" height="${n(bl * 0.82)}" fill="${p.lume}"/>`;
        out += '</g>';
      }
    }
  } else if (style === 'roman') {
    const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    nums.forEach((t, h) => {
      const [x, y] = pt(cx, cy, r * 0.74, h * 30);
      out += `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="${n(r * 0.13)}" fill="${ink}" text-anchor="middle" dominant-baseline="central">${t}</text>`;
    });
  } else if (style === 'arabic') {
    for (let h = 0; h < 12; h++) {
      const [x, y] = pt(cx, cy, r * 0.73, h * 30);
      out += `<text x="${x}" y="${y}" font-family="${SANS}" font-weight="700" font-size="${n(r * 0.15)}" fill="${ink}" text-anchor="middle" dominant-baseline="central">${h === 0 ? 12 : h}</text>`;
      if ([10, 11, 0, 1, 2].includes(h)) continue; // keep the logo area clear
      const [x2, y2] = pt(cx, cy, r * 0.53, h * 30);
      out +=`<text x="${x2}" y="${y2}" font-family="${SANS}" font-size="${n(r * 0.06)}" fill="${ink}" fill-opacity="0.7" text-anchor="middle" dominant-baseline="central">${h === 0 ? 24 : h + 12}</text>`;
    }
  } else if (style === 'lume') {
    for (let h = 0; h < 12; h++) {
      if (skip.has(h)) continue;
      const a = h * 30;
      if (h === 0) {
        const [x, y] = pt(cx, cy, r * 0.8, 0);
        const w = r * 0.1;
        out += `<path d="M${n(x - w)},${n(y - w * 0.7)} L${n(x + w)},${n(y - w * 0.7)} L${n(x)},${n(y + w * 1.2)} Z" fill="${p.lume}" stroke="#c9c9c9" stroke-width="2.5"/>`;
      } else if (h % 3 === 0) {
        const bw = r * 0.07;
        out += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${n(cx - bw / 2)}" y="${n(cy - r * 0.87)}" width="${n(bw)}" height="${n(r * 0.2)}" rx="2" fill="${p.lume}" stroke="#c9c9c9" stroke-width="2.5"/></g>`;
      } else {
        const [x, y] = pt(cx, cy, r * 0.79, a);
        out += `<circle cx="${x}" cy="${y}" r="${n(r * 0.06)}" fill="${p.lume}" stroke="#c9c9c9" stroke-width="2.5"/>`;
      }
    }
  }
  return out;
}

function branding(p, cx, cy, r) {
  if (p.plain) return ''; // generic dial: no name or emblem
  const ink = p.ink;
  const [ex, ey] = [cx, cy - r * 0.55];
  const e = r * 0.035;
  let out = `<path d="M${n(ex)},${n(ey - e)} L${n(ex + e)},${n(ey)} L${n(ex)},${n(ey + e)} L${n(ex - e)},${n(ey)} Z" fill="${p.emblem || ink}"/>`;
  out += `<text x="${cx}" y="${n(cy - r * 0.29)}" font-family="${SANS}" font-size="${n(r * 0.042)}" letter-spacing="${n(r * 0.018)}" fill="${ink}" fill-opacity="0.75" text-anchor="middle" dominant-baseline="central">${p.subtext}</text>`;
  if (p.bottomText) {
    p.bottomText.forEach((t, i) => {
      out += `<text x="${cx}" y="${n(cy + r * (0.36 + i * 0.075))}" font-family="${SANS}" font-size="${n(r * 0.045)}" letter-spacing="${n(r * 0.012)}" fill="${i === 0 && p.bottomAccent ? p.accent : ink}" fill-opacity="0.85" text-anchor="middle" dominant-baseline="central">${t}</text>`;
    });
  }
  if (p.date) {
    const w = r * 0.17;
    const h = r * 0.12;
    const x = cx + r * 0.6;
    out += `<rect x="${n(x - w / 2)}" y="${n(cy - h / 2)}" width="${n(w)}" height="${n(h)}" fill="#f7f5ef" stroke="url(#metalV)" stroke-width="3"/>`;
    out += `<text x="${n(x)}" y="${n(cy + 1)}" font-family="${SANS}" font-weight="700" font-size="${n(r * 0.08)}" fill="#111" text-anchor="middle" dominant-baseline="central">18</text>`;
  }
  return out;
}

function subdials(p, cx, cy, r) {
  if (p.type !== 'chrono') return '';
  let out = '';
  const sr = r * 0.2;
  const spots = [[cx - r * 0.47, cy, 140], [cx + r * 0.47, cy, 30], [cx, cy + r * 0.47, 250]];
  for (const [x, y, handA] of spots) {
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(sr)}" fill="${p.subdial}" stroke="${p.subRing}" stroke-width="2.5"/>`;
    for (let k = sr * 0.25; k < sr * 0.95; k += 3.2) {
      out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(k)}" fill="none" stroke="#fff" stroke-opacity="0.05" stroke-width="1"/>`;
    }
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = pt(x, y, sr * 0.92, i * 30);
      const [x2, y2] = pt(x, y, sr * (i % 3 === 0 ? 0.68 : 0.78), i * 30);
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${p.subInk}" stroke-width="${i % 3 === 0 ? 2.2 : 1.2}"/>`;
    }
    out += `<g transform="translate(${n(x)} ${n(y)}) rotate(${handA})"><rect x="-1.6" y="${n(-sr * 0.82)}" width="3.2" height="${n(sr * 0.95)}" rx="1.6" fill="${p.subHand}"/></g>`;
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="4" fill="${p.subHand}"/>`;
  }
  return out;
}

function handShape(style, L, w, lume) {
  const tail = w * 0.9;
  if (style === 'dauphine') {
    return `<path d="M0,${n(tail)} L${n(-w / 2)},${n(-L * 0.2)} L0,${n(-L)} Z" fill="url(#handL)"/><path d="M0,${n(tail)} L${n(w / 2)},${n(-L * 0.2)} L0,${n(-L)} Z" fill="url(#handD)"/>`;
  }
  if (style === 'sword') {
    let s = `<path d="M${n(-w / 2)},${n(tail)} L${n(-w / 2)},${n(-L * 0.78)} L0,${n(-L)} L${n(w / 2)},${n(-L * 0.78)} L${n(w / 2)},${n(tail)} Z" fill="url(#handL)" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>`;
    if (lume) s += `<path d="M${n(-w * 0.28)},${n(-L * 0.18)} L${n(-w * 0.28)},${n(-L * 0.76)} L0,${n(-L * 0.9)} L${n(w * 0.28)},${n(-L * 0.76)} L${n(w * 0.28)},${n(-L * 0.18)} Z" fill="${lume}"/>`;
    return s;
  }
  // baton
  let s = `<rect x="${n(-w / 2)}" y="${n(-L)}" width="${n(w)}" height="${n(L + tail)}" rx="${n(w / 2)}" fill="url(#handL)" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>`;
  if (lume) s += `<rect x="${n(-w / 4)}" y="${n(-L * 0.93)}" width="${n(w / 2)}" height="${n(L * 0.72)}" rx="${n(w / 4)}" fill="${lume}"/>`;
  return s;
}

function hands(p, cx, cy, r) {
  const H = (10 + 9 / 60) * 30;
  const M = 9 * 6 + 36 / 10;
  const S = 216;
  const lume = p.lumeHands ? p.lume : null;
  let out = `<g filter="url(#handShadow)">`;
  const id = (name) => (p.live ? ` id="${name}"` : ''); // the hero's hands are turned by js/home.js
  out += `<g${id('hour')} transform="translate(${cx} ${cy}) rotate(${n(H)})">${handShape(p.hands, r * 0.56, r * 0.075, lume)}</g>`;
  out += `<g${id('minute')} transform="translate(${cx} ${cy}) rotate(${n(M)})">${handShape(p.hands, r * 0.84, r * 0.06, lume)}</g>`;
  out += `<g${id('second')} transform="translate(${cx} ${cy}) rotate(${S})"><rect x="-1.4" y="${n(-r * 0.9)}" width="2.8" height="${n(r * 1.12)}" rx="1.4" fill="${p.accent}"/>`;
  if (p.type === 'diver') out += `<circle cx="0" cy="${n(-r * 0.68)}" r="${n(r * 0.045)}" fill="${p.lume}" stroke="${p.accent}" stroke-width="3"/>`;
  out += `<circle cx="0" cy="${n(r * 0.16)}" r="${n(r * 0.03)}" fill="${p.accent}"/></g>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.045)}" fill="url(#metal)" stroke="#000" stroke-opacity="0.4"/><circle cx="${cx}" cy="${cy}" r="${n(r * 0.016)}" fill="#222"/>`;
  return out + '</g>';
}

const HAND_COLORS = {
  steel: ['#ffffff', '#9da1a6'],
  gold: ['#fbe3a4', '#a57b30'],
  rose: ['#fbd2bb', '#a6634a'],
  black: ['#fbe3a4', '#a57b30'],
};

function watchDefs(p, cx, cy, dialR) {
  const m = METALS[p.metal];
  const hc = p.handColors || HAND_COLORS[p.metal];
  return `
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">${stops(m)}</linearGradient>
<linearGradient id="metalR" x1="1" y1="1" x2="0" y2="0">${stops(m)}</linearGradient>
<linearGradient id="metalV" x1="0" y1="0" x2="1" y2="0">${stops([m[6], m[1], m[0], m[3], m[2]])}</linearGradient>
<linearGradient id="handL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hc[0]}"/><stop offset="1" stop-color="${hc[1]}"/></linearGradient>
<linearGradient id="handD" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hc[1]}"/><stop offset="1" stop-color="${hc[0]}"/></linearGradient>
<radialGradient id="dial" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="${p.dial[0]}"/><stop offset="1" stop-color="${p.dial[1]}"/></radialGradient>
<radialGradient id="bezelInsert" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="${(p.bezelColor || p.dial)[0]}"/><stop offset="1" stop-color="${(p.bezelColor || p.dial)[1]}"/></radialGradient>
<linearGradient id="strap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.strap.color[1]}"/><stop offset="0.45" stop-color="${p.strap.color[0]}"/><stop offset="1" stop-color="${p.strap.color[1]}"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<pattern id="scales" width="30" height="22" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="26" height="18" rx="7" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="1.6"/><rect x="5" y="5" width="12" height="6" rx="3" fill="#fff" fill-opacity="0.04"/></pattern>
<pattern id="clous" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="none"/><path d="M0,0 L12,0 M0,0 L0,12" stroke="#000" stroke-opacity="0.08" stroke-width="1.5"/><rect x="1" y="1" width="5" height="5" fill="#fff" fill-opacity="0.25"/></pattern>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter>
<filter id="blurSm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="handShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/></filter>
<clipPath id="dialClip"><circle cx="${cx}" cy="${cy}" r="${n(dialR)}"/></clipPath>`;
}

/** Builds the full watch (defs + body) centred on cx, cy with case radius R. */
function watch(p, cx, cy, R, yMin, yMax) {
  const bz = bezel(p, cx, cy, R);
  const r = bz.dialR;
  let body = `<ellipse cx="${n(cx + R * 0.08)}" cy="${n(cy + R * 0.12)}" rx="${n(R * 1.02)}" ry="${n(R * 1.02)}" fill="#000" opacity="0.38" filter="url(#blur)"/>`;
  body += strap(p, cx, cy, R, yMin, yMax);
  body += lugsAndCrown(p, cx, cy, R);
  body += bz.out;
  body += `<circle cx="${cx}" cy="${cy}" r="${n(r)}" fill="url(#dial)"/>`;
  body += dialTexture(p, cx, cy, r);
  body += subdials(p, cx, cy, r);
  body += indices(p, cx, cy, r);
  body += branding(p, cx, cy, r);
  body += hands(p, cx, cy, r);
  // crystal reflections
  body += `<g clip-path="url(#dialClip)"><ellipse cx="${n(cx - r * 0.25)}" cy="${n(cy - r * 0.55)}" rx="${n(r * 1.05)}" ry="${n(r * 0.55)}" transform="rotate(-28 ${n(cx - r * 0.25)} ${n(cy - r * 0.55)})" fill="url(#glass)" opacity="0.55"/></g>`;
  const [ax, ay] = pt(cx, cy, R - 3, 215);
  const [bx, by] = pt(cx, cy, R - 3, 330);
  body += `<path d="M${ax},${ay} A${n(R - 3)},${n(R - 3)} 0 0 1 ${bx},${by}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>`;
  return { defs: watchDefs(p, cx, cy, r), body };
}

/* ---------- the one generic watch used in the hero ---------- */
const HERO_WATCH = {
  type: 'dress', metal: 'gold', dial: ['#2a2723', '#050505'], texture: 'sunburst', plain: true,
  indices: 'baton', hands: 'dauphine', ink: '#e9d9a8', accent: '#d8b86e', date: true,
  strap: { kind: 'alligator', color: ['#2b2b2b', '#0b0b0b'], stitch: '#c9a961' },
};

/* ---------- writers ---------- */
function heroSvg({ live = false } = {}) {
  const p = { ...HERO_WATCH, live };
  const S = 1200;
  const cx = 600;
  const cy = 600;
  const R = 330;
  const w = watch(p, cx, cy, R, -700, S + 700);
  const open = live
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" class="hero__watch" role="img" aria-label="Watch showing the current time in Bangladesh">`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img">`;
  return `${open}
<defs>${w.defs}<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9a961" stop-opacity="0.35"/><stop offset="1" stop-color="#c9a961" stop-opacity="0"/></radialGradient></defs>
<circle cx="${cx}" cy="${cy}" r="560" fill="url(#halo)"/>
<g transform="rotate(-16 ${cx} ${cy})">${w.body}</g>
</svg>
`;
}

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<rect width="64" height="64" rx="14" fill="#0b0b0b"/>
<rect x="5" y="5" width="54" height="54" rx="10" fill="none" stroke="#c9a961" stroke-width="2"/>
<text x="32" y="33" font-family="${SERIF}" font-size="27" font-weight="600" letter-spacing="1" fill="#c9a961" text-anchor="middle" dominant-baseline="central">ZW</text>
</svg>
`;
}

function ogImageSvg() {
  const p = HERO_WATCH;
  const w = watch(p, 900, 315, 205, -400, 1100);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<defs>${w.defs}<radialGradient id="bgOg" cx="0.75" cy="0.4" r="0.8"><stop offset="0" stop-color="#2a261f"/><stop offset="1" stop-color="#050505"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#bgOg)"/>
<g transform="rotate(-12 900 315)">${w.body}</g>
<text x="80" y="250" font-family="${SERIF}" font-size="64" letter-spacing="14" fill="#f7f5f0">ZENRO WRIST</text>
<rect x="80" y="285" width="90" height="2" fill="#c9a961"/>
<text x="80" y="345" font-family="${SANS}" font-size="30" fill="#c9a961">Cash on Delivery all over Bangladesh</text>
<text x="80" y="395" font-family="${SANS}" font-size="24" fill="#bdb7ab">bKash · Nagad · Rocket · Bank · Order on WhatsApp</text>
</svg>
`;
}

writeFileSync(join(OUT, 'hero-watch.svg'), heroSvg());

/* Inline live copy in index.html. Every id gets an "hw-" prefix so it cannot clash with the page. */
const inline = heroSvg({ live: true })
  .trim()
  .replace(/\bid="([^"]+)"/g, 'id="hw-$1"')
  .replace(/url\(#([^)]+)\)/g, 'url(#hw-$1)');
const indexFile = join(ROOT, 'index.html');
const indexHtml = readFileSync(indexFile, 'utf8');
const markers = /(<!-- hero-watch:start -->)[\s\S]*?(<!-- hero-watch:end -->)/;
if (!markers.test(indexHtml)) throw new Error('index.html: hero-watch markers not found');
writeFileSync(indexFile, indexHtml.replace(markers, (m, a, b) => `${a}\n${inline}\n        ${b}`));
writeFileSync(join(OUT, 'favicon.svg'), faviconSvg());
writeFileSync(join(OUT, 'og-image.svg'), ogImageSvg());
console.log(`Generated 3 images in ${OUT} and the live hero watch in index.html`);
