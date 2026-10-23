export type Bbox = [south: number, north: number, west: number, east: number];
export type Cell = { lat: string; lon: string; radius: number; zoom: number };

/**
 * Split a bounding box into n x n cells. Same maths as grid_cells() in scripts/scrape.py:
 * radius (m) = 1.15 x half the cell diagonal, at least 1000; zoom = the Maps zoom whose ~1000px
 * viewport is about as wide as the cell (11..17), so each search looks at its own tile.
 */
export function gridCells(bbox: Bbox, n: number): Cell[] {
  const [s, nn, w, e] = bbox;
  const dlat = (nn - s) / n, dlon = (e - w) / n;
  const mPerDeg = (6371000 * Math.PI) / 180;
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const lat = s + (i + 0.5) * dlat, lon = w + (j + 0.5) * dlon;
      const cos = Math.cos((lat * Math.PI) / 180);
      const width = Math.max(1, dlon * mPerDeg * cos);
      const diag = Math.hypot(dlat * mPerDeg, width);
      const zoom = Math.round(Math.log2((156543.03 * cos * 1000) / width));
      cells.push({
        lat: lat.toFixed(6), lon: lon.toFixed(6),
        radius: Math.max(1000, Math.ceil((1.15 * diag) / 2)),
        zoom: Math.min(17, Math.max(11, zoom)),
      });
    }
  }
  return cells;
}

/** Tiles leak past the area edge (the radius does not clip results), so drop rows outside the box plus a 10% margin. */
export function inBbox(lat: string | undefined, lon: string | undefined, bbox: Bbox, margin = 0.1) {
  const la = parseFloat(lat ?? ""), lo = parseFloat(lon ?? "");
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return true; // no coordinates: keep it
  const [s, n, w, e] = bbox;
  const my = (n - s) * margin, mx = (e - w) * margin;
  return la >= s - my && la <= n + my && lo >= w - mx && lo <= e + mx;
}
