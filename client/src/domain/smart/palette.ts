// Colour intelligence: k-means palette extraction from an image, colour naming,
// harmony suggestions and WCAG contrast - all pure functions over RGB arrays.

export type RGB = [number, number, number];

export const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
export const fromHex = (hex: string): RGB => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as RGB;

/** Deterministic k-means (k-means++ style seeding by farthest point) over sampled pixels. */
export function kMeans(pixels: RGB[], k = 6, iterations = 12): { color: RGB; share: number }[] {
  if (!pixels.length) return [];
  const dist = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const centers: RGB[] = [pixels[Math.floor(pixels.length / 2)]];
  while (centers.length < k) {
    let best = pixels[0], bestD = -1;
    for (const p of pixels) {
      const d = Math.min(...centers.map(c => dist(p, c)));
      if (d > bestD) { bestD = d; best = p; }
    }
    centers.push(best);
  }
  let assign = new Array<number>(pixels.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    assign = pixels.map(p => centers.reduce((bi, c, i) => (dist(p, c) < dist(p, centers[bi]) ? i : bi), 0));
    for (let i = 0; i < k; i++) {
      const members = pixels.filter((_, j) => assign[j] === i);
      if (members.length) centers[i] = [0, 1, 2].map(ch => members.reduce((s, m) => s + m[ch], 0) / members.length) as RGB;
    }
  }
  return centers
    .map((c, i) => ({ color: c.map(Math.round) as RGB, share: assign.filter(a => a === i).length / pixels.length }))
    .filter(c => c.share > 0.01)
    .sort((a, b) => b.share - a.share);
}

/** Samples every n-th pixel of RGBA image data. */
export function samplePixels(data: Uint8ClampedArray, every = 23): RGB[] {
  const out: RGB[] = [];
  for (let i = 0; i < data.length; i += 4 * every) if (data[i + 3] > 128) out.push([data[i], data[i + 1], data[i + 2]]);
  return out;
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round) as RGB;
}

/** Hebrew name of a colour family - used to describe the mood board in words. */
export function colorName(rgb: RGB): string {
  const [h, s, l] = rgbToHsl(rgb);
  if (l > 0.9) return 'לבן';
  if (l < 0.13) return 'שחור';
  if (s < 0.12) return l > 0.6 ? 'אפור בהיר' : l > 0.35 ? 'אפור' : 'אפור כהה';
  if (s < 0.35 && h >= 20 && h < 55) return l > 0.6 ? 'שמנת' : 'חום טבעי';
  const names: [number, string][] = [[15, 'אדום'], [40, 'כתום-טרקוטה'], [65, 'חרדל'], [160, 'ירוק'], [200, 'טורקיז'], [255, 'כחול'], [290, 'סגול'], [340, 'ורוד'], [361, 'אדום']];
  return names.find(([max]) => h < max)![1];
}

/** Relative luminance & WCAG contrast ratio. */
export function contrast(a: RGB, b: RGB): number {
  const lum = (c: RGB) => {
    const [r, g, bl] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Complementary + analogous accents derived from the dominant saturated colour. */
export function harmonies(palette: RGB[]): { label: string; colors: RGB[] }[] {
  const base = [...palette].sort((a, b) => rgbToHsl(b)[1] - rgbToHsl(a)[1])[0] ?? [128, 128, 128];
  const [h, s, l] = rgbToHsl(base);
  const ss = Math.max(0.25, s), ll = Math.min(0.6, Math.max(0.35, l));
  return [
    { label: 'משלים', colors: [base, hslToRgb((h + 180) % 360, ss, ll)] },
    { label: 'אנלוגי', colors: [hslToRgb((h + 330) % 360, ss, ll), base, hslToRgb((h + 30) % 360, ss, ll)] },
    { label: 'טריאדי', colors: [base, hslToRgb((h + 120) % 360, ss, ll), hslToRgb((h + 240) % 360, ss, ll)] },
  ];
}

/** 60-30-10 rule: dominant wall colour, secondary (furniture/textiles), accent. */
export function rule603010(palette: RGB[]): { role: string; color: RGB; pct: number }[] {
  const byLight = [...palette].sort((a, b) => rgbToHsl(b)[2] - rgbToHsl(a)[2]);
  const accent = [...palette].sort((a, b) => rgbToHsl(b)[1] - rgbToHsl(a)[1])[0];
  const rest = byLight.filter(c => c !== accent);
  return [
    { role: 'צבע דומיננטי – קירות ומשטחים גדולים', color: rest[0] ?? byLight[0], pct: 60 },
    { role: 'צבע משני – ריהוט וטקסטיל', color: rest[1] ?? byLight[1] ?? byLight[0], pct: 30 },
    { role: 'צבע הדגשה – אביזרים ותאורה', color: accent, pct: 10 },
  ];
}
