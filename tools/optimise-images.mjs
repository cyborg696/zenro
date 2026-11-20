/**
 * ZENRO Wrist & Co. — product photo optimiser
 * -------------------------------------------
 * Turns raw JPG/PNG photos into small, privacy-safe WebP files for the site.
 *
 *   npm install            (once, installs sharp)
 *   npm run images         (or: node tools/optimise-images.mjs)
 *   node tools/optimise-images.mjs --contain   pad photos to 4:5 instead of cropping
 *   node tools/optimise-images.mjs --studio    "studio" finish for phone / Instagram photos:
 *       evens out the tones, lifts colour slightly, sharpens, and fills the 4:5 frame with a
 *       blurred, darkened copy of the photo plus a soft vignette instead of flat black bars
 *       (implies --contain, so the photo itself is never cropped)
 *   npm run og-image       (or: node tools/optimise-images.mjs --og) builds images/og-image.jpg
 *
 * Put raw photos in images/raw/ named <product-id>-<n>.jpg (or .jpeg / .png), e.g.
 *   images/raw/rolex-datejust-01-1.jpg
 *   images/raw/rolex-datejust-01-2.jpg
 * Sub-folders are fine too: images/raw/rolex/datejust/rolex-datejust-01-1.jpg
 * The product id must already exist in js/products.js (that is how the brand and model
 * folders are found).
 *
 * For every photo it:
 *  - rotates it the right way up, then removes all EXIF / GPS location / camera data
 *  - crops it to 4:5 (or pads it with --contain)
 *  - writes images/products/<brand>/<model>/<product-id>-<n>.webp      (1200 x 1500)
 *    and    images/products/<brand>/<model>/<product-id>-<n>-600.webp  (600 x 750)
 *  - never enlarges a photo. When the source is too small for 1200 x 1500 (for example a
 *    640 px Instagram image), the large file is written at the biggest 4:5 size the source
 *    allows and its name records that width: <product-id>-<n>-w640.webp. productImageSet()
 *    in js/products.js reads that width for the srcset.
 * and finally prints the `images: [...]` lines to paste into js/products.js.
 *
 * images/raw/ is listed in .gitignore so the originals (which may contain location data)
 * are never published.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed. Run "npm install" in the project folder first.');
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'images', 'raw');
const OUT = join(ROOT, 'images', 'products');
const SIZES = [
  { width: 1200, height: 1500, suffix: '' },
  { width: 600, height: 750, suffix: '-600' },
];
const args = new Set(process.argv.slice(2));
const STUDIO = args.has('--studio');
const FIT = STUDIO || args.has('--contain') ? 'contain' : 'cover';
const BACKGROUND = '#0b0b0b';

/** Studio finish: corrected photo, centred on a blurred dark copy of itself, with a vignette. */
async function studioImage(file, width, height) {
  const photo = await sharp(file)
    .rotate()
    .normalise({ lower: 1, upper: 99 }) // stretch the tones without clipping highlights
    .modulate({ saturation: 1.08 })
    .resize(width, height, { fit: 'inside' })
    .sharpen({ sigma: 0.7, m1: 0.6, m2: 2 })
    .toBuffer();
  const backdrop = await sharp(file)
    .rotate()
    .resize(width, height, { fit: 'cover' })
    .blur(Math.max(10, width / 24))
    .modulate({ brightness: 0.4, saturation: 0.7 })
    .toBuffer();
  const vignette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="v" cx="50%" cy="46%" r="72%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`
  );
  return sharp(backdrop).composite([{ input: photo, gravity: 'centre' }, { input: vignette }]);
}
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ---------- Open Graph image ---------- */
if (args.has('--og')) {
  const src = join(ROOT, 'images', 'og-image.svg');
  const dest = join(ROOT, 'images', 'og-image.jpg');
  await sharp(src, { density: 144 }).resize(1200, 630).jpeg({ quality: 85, mozjpeg: true }).toFile(dest);
  console.log(`Wrote ${relative(ROOT, dest)}`);
  process.exit(0);
}

/* ---------- Read the catalogue (js/products.js) ---------- */
function loadCatalogue() {
  const code = readFileSync(join(ROOT, 'js', 'products.js'), 'utf8');
  const context = vm.createContext({ console });
  return vm.runInContext(`${code}\n;({ PRODUCTS })`, context).PRODUCTS;
}
const products = new Map(loadCatalogue().map((p) => [p.id, p]));

/* ---------- Find raw photos ---------- */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(jpe?g|png)$/i.test(name) ? [full] : [];
  });
}

const files = walk(RAW).sort();
if (!files.length) {
  console.log(`No photos found. Put JPG/PNG files named <product-id>-<n>.jpg in ${relative(ROOT, RAW)}/`);
  process.exit(0);
}

const results = new Map(); // product id -> [paths]
const problems = [];

for (const file of files) {
  const name = basename(file, extname(file)).toLowerCase();
  const match = name.match(/^(.+)-(\d{1,2})$/);
  if (!match || !SLUG_RE.test(match[1])) {
    problems.push(`${relative(ROOT, file)}: rename it to <product-id>-<n>.jpg, e.g. rolex-datejust-01-1.jpg`);
    continue;
  }
  const [, id, n] = match;
  const product = products.get(id);
  if (!product) {
    problems.push(`${relative(ROOT, file)}: no product with id "${id}" in js/products.js (add the product first)`);
    continue;
  }
  const folder = join(OUT, product.brand, product.model);
  mkdirSync(folder, { recursive: true });

  // Never enlarge: `grow` is how much the photo would have to be scaled up to fill (cover)
  // or fit (contain) the box. Above 1 the box shrinks instead, keeping an exact 4:5 shape.
  const meta = await sharp(file).metadata();
  const turned = (meta.orientation || 1) >= 5;
  const srcW = turned ? meta.height : meta.width;
  const srcH = turned ? meta.width : meta.height;
  let largeName = `${id}-${n}`;
  for (const size of SIZES) {
    let { width, height } = size;
    const grow = (FIT === 'contain' ? Math.min : Math.max)(width / srcW, height / srcH);
    if (grow > 1) {
      width = Math.floor(width / grow / 4) * 4;
      height = (width / 4) * 5;
      if (size.suffix === '') largeName = `${id}-${n}-w${width}`;
      else console.warn(`  ${relative(ROOT, file)} is small: its ${size.suffix} file is only ${width} px wide`);
    }
    const dest = join(folder, `${largeName}${size.suffix}.webp`);
    const base = STUDIO
      ? await studioImage(file, width, height)
      : sharp(file)
        .rotate() // apply the camera orientation before the metadata is dropped
        .resize(width, height, { fit: FIT, position: 'centre', background: BACKGROUND });
    await base
      .flatten({ background: BACKGROUND })
      .webp({ quality: 80, effort: 5 })
      .toFile(dest); // sharp writes no EXIF/GPS/ICC metadata unless asked to
  }
  const publicPath = `images/products/${product.brand}/${product.model}/${largeName}.webp`;
  results.set(id, [...(results.get(id) || []), publicPath]);
  console.log(`✓ ${relative(ROOT, file)} -> ${publicPath} (+ -600 version)`);
}

if (results.size) {
  console.log('\nPaste these lines into js/products.js (replace the existing images line of each product):\n');
  for (const [id, paths] of results) {
    const photoNo = (p) => Number(p.match(/-(\d+)(?:-w\d+)?\.webp$/)[1]);
    const sorted = paths.sort((a, b) => photoNo(a) - photoNo(b));
    console.log(`  // ${id}\n  images: [${sorted.map((p) => `'${p}'`).join(', ')}],\n`);
  }
}
if (problems.length) {
  console.log('\nSkipped:');
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exitCode = 1;
}
