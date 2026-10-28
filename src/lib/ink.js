// Lifts handwriting off a photo of paper, in the browser.
// A port of edgework/tools/unmultiply.py: estimate the paper's colour on a coarse grid
// (max filter, then blur), divide it out, and keep what's darker than the paper as ink
// with real alpha. The result is a transparent PNG/WebP that multiplies into any page.
//
// liftInk(file, { lineHeight }) -> { blob, url, width, height }
// lineHeight: the pixel height one line of handwriting is scaled to, so every note
// comes out at the same size whatever camera took it.

const load = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file isn't an image this browser can read."));
    img.src = URL.createObjectURL(file);
  });

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// Paper estimate: shrink to a 48px-wide grid, take the brightest pixel in a 7x7 window
// (paper is lighter than ink), blur, then stretch back to full size.
function paperOf(src, w, h) {
  const gw = 48;
  const gh = Math.max(1, Math.round((48 * h) / w));
  const small = canvas(gw, gh);
  const sctx = small.getContext("2d");
  sctx.drawImage(src, 0, 0, gw, gh);
  const s = sctx.getImageData(0, 0, gw, gh);
  const out = sctx.createImageData(gw, gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const xx = Math.min(gw - 1, Math.max(0, x + dx));
          const yy = Math.min(gh - 1, Math.max(0, y + dy));
          const i = (yy * gw + xx) * 4;
          r = Math.max(r, s.data[i]);
          g = Math.max(g, s.data[i + 1]);
          b = Math.max(b, s.data[i + 2]);
        }
      }
      const o = (y * gw + x) * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = 255;
    }
  }
  sctx.putImageData(out, 0, 0);
  const big = canvas(w, h);
  const bctx = big.getContext("2d");
  bctx.filter = `blur(${Math.round(w / 16)}px)`;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, w, h);
  return bctx.getImageData(0, 0, w, h).data;
}

export async function liftInk(file, { lineHeight = 110, maxSide = 1800 } = {}) {
  const img = await load(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const work = canvas(w, h);
  const ctx = work.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  const photo = ctx.getImageData(0, 0, w, h);
  const paper = paperOf(work, w, h);
  const d = photo.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const cr = Math.min(1, d[i] / (paper[i] + 2));
    const cg = Math.min(1, d[i + 1] / (paper[i + 1] + 2));
    const cb = Math.min(1, d[i + 2] / (paper[i + 2] + 2));
    let a = 1 - Math.min(cr, cg, cb);
    a = Math.max(0, Math.min(1, (a - 0.12) / 0.88));
    if (a < 0.18) a = 0; // speckle and paper grain
    if (a > 0) {
      // Recover the ink's own colour: c = 1 - a + a * ink
      d[i] = Math.max(0, Math.min(255, ((cr - (1 - a)) / a) * 255));
      d[i + 1] = Math.max(0, Math.min(255, ((cg - (1 - a)) / a) * 255));
      d[i + 2] = Math.max(0, Math.min(255, ((cb - (1 - a)) / a) * 255));
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    d[i + 3] = Math.round(a * 255);
  }
  if (maxX < 0) throw new Error("Couldn't find any ink. Try a darker pen, or a closer photo in daylight.");

  ctx.putImageData(photo, 0, 0);
  const padPx = Math.round(Math.max(w, h) * 0.01);
  const cx = Math.max(0, minX - padPx), cy = Math.max(0, minY - padPx);
  const cw = Math.min(w, maxX + padPx) - cx, ch = Math.min(h, maxY + padPx) - cy;

  // One line of handwriting is usually 2.5-6x wider than tall; anything squarer is
  // probably two lines, so give it room for two.
  const lines = cw / ch < 2.2 ? 2 : 1;
  const outH = Math.round(lineHeight * lines);
  const outW = Math.round((cw * outH) / ch);
  const out = canvas(outW, outH);
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(work, cx, cy, cw, ch, 0, 0, outW, outH);

  const blob = await new Promise((resolve) => {
    out.toBlob((b) => {
      if (b && b.type === "image/webp") return resolve(b);
      out.toBlob(resolve, "image/png");
    }, "image/webp", 0.9);
  });
  return { blob, url: URL.createObjectURL(blob), width: outW, height: outH };
}

export function toFile(blob, name) {
  const ext = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `${name}.${ext}`, { type: blob.type });
}
