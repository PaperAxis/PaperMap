// iOS/Safari'de tum sayfa yakinlastirma-uzaklastirma jestlerini engeller.
// Cimdik (pinch) zoom, iOS Safari viewport'taki `maximum-scale`/`user-scalable`
// ayarlarini erisilebilirlik geregi yok saydigi icin jest olaylariyla engellenir.
// Harita (MaplibreGL) kendi `touch*` olaylarini kullandigindan haritanin
// kendi yakinlastirmasi bundan etkilenmez — yalnizca sayfa zoom'u kapanir.
export function disableZoom() {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  // Masaustu WebView: Ctrl/Cmd + tekerlek ile zoom
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
