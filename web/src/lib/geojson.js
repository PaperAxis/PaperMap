// Merkez (lat,lng) ve metre yaricapindan dairesel GeoJSON poligonu uretir
export function circlePolygon(lat, lng, radiusMeters, points = 64) {
  const earthR = 6371000;
  const latR = (radiusMeters / earthR) * (180 / Math.PI);
  const lngR = latR / Math.cos((lat * Math.PI) / 180);
  const coords = [];
  for (let i = 0; i <= points; i += 1) {
    const t = (i / points) * 2 * Math.PI;
    coords.push([lng + lngR * Math.cos(t), lat + latR * Math.sin(t)]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

export function geofencesToGeoJSON(geofences) {
  return {
    type: 'FeatureCollection',
    features: geofences.map((g) => ({
      type: 'Feature',
      properties: { id: g.id, name: g.name },
      geometry: circlePolygon(g.lat, g.lng, g.radius),
    })),
  };
}

// Konum gecmisi noktalarini iz (LineString) + nokta (Point) ozelliklerine cevirir
export function historyToGeoJSON(points) {
  const list = points || [];
  const features = [];
  if (list.length > 1) {
    features.push({
      type: 'Feature',
      properties: { kind: 'track' },
      geometry: {
        type: 'LineString',
        coordinates: list.map((p) => [p.lng, p.lat]),
      },
    });
  }
  for (const p of list) {
    features.push({
      type: 'Feature',
      properties: { recordedAt: p.recordedAt },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}
