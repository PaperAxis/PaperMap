import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

// Cihazin pil durumu: { level: 0-100, charging: bool } veya null
export async function getBattery() {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await Device.getBatteryInfo();
      if (info.batteryLevel == null) return null;
      return {
        level: Math.round(info.batteryLevel * 100),
        charging: !!info.isCharging,
      };
    }
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      const b = await navigator.getBattery();
      return { level: Math.round(b.level * 100), charging: b.charging };
    }
  } catch {
    /* pil bilgisi alinamadi */
  }
  return null;
}

// Pil etiketi (metin — her cihazda ayni): "Pil %85" / "Pil %85 (şarjda)"
export function batteryLabel(battery, charging) {
  if (battery == null) return '';
  return `Pil %${battery}${charging ? ' (şarjda)' : ''}`;
}
