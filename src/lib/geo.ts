export type Position = [number, number];
export type PolygonRing = Position[];
export type GeoPolygon = { type: "Polygon"; coordinates: PolygonRing[] };

export function ringArea(ring: PolygonRing): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

const METERS_PER_DEG_LAT = 111_320;
export function metersPerDegLon(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

export function polygonAreaM2(polygon: GeoPolygon | PolygonRing): number {
  const ring = Array.isArray(polygon) ? polygon : polygon.coordinates[0];
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const areaDeg = ringArea(ring);
  return areaDeg * METERS_PER_DEG_LAT * metersPerDegLon(lat);
}

export function polygonCentroid(ring: PolygonRing): Position {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-16) {
    const avg = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0] as Position);
    return [avg[0] / ring.length, avg[1] / ring.length];
  }
  a *= 0.5;
  return [x / (6 * a), y / (6 * a)];
}

export function bbox(ring: PolygonRing) {
  return ring.reduce(
    (b, [x, y]) => ({
      minX: Math.min(b.minX, x),
      minY: Math.min(b.minY, y),
      maxX: Math.max(b.maxX, x),
      maxY: Math.max(b.maxY, y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

export function bboxOverlap(a: PolygonRing, b: PolygonRing): boolean {
  const ba = bbox(a);
  const bb = bbox(b);
  return ba.minX < bb.maxX && ba.maxX > bb.minX && ba.minY < bb.maxY && ba.maxY > bb.minY;
}

function isInside(point: Position, ring: PolygonRing): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function clipPolygon(subject: PolygonRing, clip: PolygonRing): PolygonRing {
  let output = subject;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) break;
    const side = (p: Position) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const intersection = (p1: Position, p2: Position): Position => {
      const s1 = side(p1);
      const s2 = side(p2);
      const t = s1 / (s1 - s2);
      return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
    };
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const curIn = side(cur) >= 0;
      const prevIn = side(prev) >= 0;
      if (curIn) {
        if (!prevIn) output.push(intersection(prev, cur));
        output.push(cur);
      } else if (prevIn) {
        output.push(intersection(prev, cur));
      }
    }
  }
  return output;
}

export function intersectionAreaM2(a: GeoPolygon | PolygonRing, b: GeoPolygon | PolygonRing): number {
  const ra = Array.isArray(a) ? a : a.coordinates[0];
  const rb = Array.isArray(b) ? b : b.coordinates[0];
  if (!bboxOverlap(ra, rb)) return 0;
  const clipped = clipPolygon(ra, rb);
  if (clipped.length < 3) {
    if (ra.some((p) => isInside(p, rb)) || rb.some((p) => isInside(p, ra))) {
      return Math.min(polygonAreaM2(ra), polygonAreaM2(rb)) * 0.5;
    }
    return 0;
  }
  return polygonAreaM2(clipped);
}

export function overlapRatio(a: GeoPolygon | PolygonRing, b: GeoPolygon | PolygonRing): number {
  const ra = Array.isArray(a) ? a : a.coordinates[0];
  const rb = Array.isArray(b) ? b : b.coordinates[0];
  const area = intersectionAreaM2(ra, rb);
  const minArea = Math.min(polygonAreaM2(ra), polygonAreaM2(rb));
  return minArea > 0 ? area / minArea : 0;
}

export function centroidDistanceM(a: PolygonRing, b: PolygonRing): number {
  const ca = polygonCentroid(a);
  const cb = polygonCentroid(b);
  const lat = (ca[1] + cb[1]) / 2;
  const dx = (ca[0] - cb[0]) * metersPerDegLon(lat);
  const dy = (ca[1] - cb[1]) * METERS_PER_DEG_LAT;
  return Math.sqrt(dx * dx + dy * dy);
}

export function parsePolygon(value: string): GeoPolygon | null {
  try {
    const geo = JSON.parse(value);
    if (geo?.type === "Polygon" && Array.isArray(geo.coordinates?.[0])) return geo as GeoPolygon;
    return null;
  } catch {
    return null;
  }
}

export function toRing(value: string | GeoPolygon): PolygonRing | null {
  if (typeof value === "string") {
    const p = parsePolygon(value);
    return p ? p.coordinates[0] : null;
  }
  return value.coordinates[0];
}

export function formatArea(value: number): string {
  return `${Math.round(value).toLocaleString("en-IN")} m²`;
}
