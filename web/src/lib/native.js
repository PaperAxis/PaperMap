import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Native (APK) baslangic ayarlari.
// Durum cubugu (bildirim bari) artik WebView icerigin uzerine binmez —
// icerik durum cubugunun altindan baslar.
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#0b1220' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* durum cubugu ayarlanamadi — kritik degil */
  }
}
