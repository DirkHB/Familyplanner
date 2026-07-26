// Exakte sRGB(hex) -> OKLCH Konvertierung, ohne Abhängigkeiten.
// Grundlage: Björn Ottosson, OKLab. Ausgabe gerundet auf sinnvolle Stellen.

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToOklch(hex) {
  const h = hex.replace("#", "");
  const r = srgbToLinear(parseInt(h.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(h.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(h.slice(4, 6), 16));

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { L, C, H };
}

const tokens = {
  "bg": "#F5EFE6",
  "surface": "#FBF7F1",
  "surface-muted": "#EADFD1",
  "ink": "#111E33",
  "ink-muted": "#4B5A73",
  "accent": "#12A594",
  "accent-light": "#7EDCD0",
  "counter": "#C08A86",
  "counter-light": "#E8CFCB",
  "signal": "#B54A3A",
};

for (const [name, hex] of Object.entries(tokens)) {
  const { L, C, H } = hexToOklch(hex);
  const l = (L * 100).toFixed(2);
  const c = C.toFixed(4);
  const hue = H.toFixed(2);
  console.log(`--color-${name}: ${hex}  ->  oklch(${l}% ${c} ${hue})`);
}
