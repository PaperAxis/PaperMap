// İkon (SVG) stilleri — çizgi kalınlığı/biçimi. CSS ile global uygulanır.
// preview: tek bir ikonun önizlemesi için React style nesnesi.
export const ICON_STYLES = [
  { id: 'normal', name: 'Normal', preview: { strokeWidth: 2 } },
  { id: 'thin', name: 'İnce', preview: { strokeWidth: 1.3 } },
  { id: 'bold', name: 'Kalın', preview: { strokeWidth: 2.75 } },
  {
    id: 'sharp',
    name: 'Keskin',
    preview: { strokeWidth: 2, strokeLinejoin: 'miter', strokeLinecap: 'square' },
  },
];

export const ICON_STYLE_IDS = ICON_STYLES.map((s) => s.id);
