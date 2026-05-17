import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let permissionAsked = false;
let granted = false;

// Native (APK/IPA) platformlarda OS bildirimleri icin izin ister.
// iOS'ta ucretli Apple hesabi olmadan FCM/APNs push calismaz; yerel
// bildirimler ise entitlement gerektirmeden calisir — AltStore/AltServer
// ile ucretsiz Apple ID'yle kurulan uygulamada da gosterilir.
export async function requestLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  if (permissionAsked) return;
  permissionAsked = true;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      perm = await LocalNotifications.requestPermissions();
    }
    granted = perm.display === 'granted';
  } catch (err) {
    console.error('Yerel bildirim izni alınamadı:', err);
  }
}

// Bir OS bildirimi gosterir. Web'de sessizce atlanir (orada tarayici
// Notification API'si kullanilir). Uygulama on planda ya da konum modu
// sayesinde arka planda canliyken calisir.
export async function showLocalNotification(title, body) {
  if (!Capacitor.isNativePlatform() || !granted) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2147483647),
          title: title || 'PaperMap',
          body: body || '',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('Yerel bildirim gösterilemedi:', err);
    return false;
  }
}
