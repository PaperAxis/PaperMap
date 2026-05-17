import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api.js';

let listenersAdded = false;

// APK'da FCM push'a kaydolur ve cihaz token'ini sunucuya gonderir.
// Web'de push-notifications eklentisi yoktur — sessizce atlanir.
export async function registerPush() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (!listenersAdded) {
      listenersAdded = true;
      await PushNotifications.addListener('registration', (token) => {
        api('/api/notifications/token', {
          method: 'POST',
          body: { token: token.value, platform: 'android' },
        }).catch(() => {});
      });
      await PushNotifications.addListener('registrationError', (err) => {
        console.error('Push kayıt hatası:', err);
      });
    }

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    await PushNotifications.register();
  } catch (err) {
    console.error('Push kaydı başarısız:', err);
  }
}
