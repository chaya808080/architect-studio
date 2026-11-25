// Approximate city coordinates -> haversine distance -> driving minutes (urban factor + parking).

export const CITIES: Record<string, [number, number]> = {
  'תל אביב': [32.0853, 34.7818],
  'רמת גן': [32.0684, 34.8248],
  'בני ברק': [32.0807, 34.8338],
  'גבעתיים': [32.0718, 34.8107],
  'פתח תקווה': [32.0840, 34.8878],
  'הרצליה': [32.1624, 34.8447],
  'רעננה': [32.1848, 34.8713],
  'ראשון לציון': [31.9730, 34.7925],
  'מודיעין': [31.8980, 35.0104],
  'ירושלים': [31.7683, 35.2137],
  'חיפה': [32.7940, 34.9896],
  'כפר סבא': [32.1782, 34.9076],
};

export const STUDIO_CITY = 'רמת גן';

export function distanceKm(a: string, b: string): number {
  const p = CITIES[a];
  const q = CITIES[b];
  if (!p || !q) return 20;
  const rad = Math.PI / 180;
  const dLat = (q[0] - p[0]) * rad;
  const dLon = (q[1] - p[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Same city: 15 minutes buffer. Otherwise road factor 1.35, ~45 km/h average, +10 min parking. */
export function travelMinutes(from: string, to: string): number {
  if (from === to) return 15;
  const minutes = (distanceKm(from, to) * 1.35 / 45) * 60 + 10;
  return Math.round(minutes / 5) * 5;
}
