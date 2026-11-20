// Icon (SVG) styles: stroke width and shape, applied globally from CSS.
// "normal" is the PaperAxis default: Lucide at a 1.5 px stroke.
// preview: React style object for a single sample icon.
export const ICON_STYLES = [
  { id: 'normal', name: 'Normal', preview: { strokeWidth: 1.5 } },
  { id: 'thin', name: 'İnce', preview: { strokeWidth: 1.15 } },
  { id: 'bold', name: 'Kalın', preview: { strokeWidth: 2.25 } },
  {
    id: 'sharp',
    name: 'Keskin',
    preview: { strokeWidth: 1.5, strokeLinejoin: 'miter', strokeLinecap: 'square' },
  },
];

export const ICON_STYLE_IDS = ICON_STYLES.map((s) => s.id);
