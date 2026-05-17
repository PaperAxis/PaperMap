// Capacitor'un urettigi AndroidManifest.xml'e konum izinlerini ekler.
// @capacitor/geolocation izinleri otomatik eklemez; bu betik idempotenttir.
import { readFileSync, writeFileSync } from 'node:fs';

const manifestUrl = new URL(
  '../android/app/src/main/AndroidManifest.xml',
  import.meta.url,
);

let xml = readFileSync(manifestUrl, 'utf8');

const permissions = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
];

let added = 0;
for (const perm of permissions) {
  if (!xml.includes(perm)) {
    xml = xml.replace('</manifest>', `    ${perm}\n</manifest>`);
    added += 1;
  }
}

writeFileSync(manifestUrl, xml);
console.log(`AndroidManifest.xml güncellendi: ${added} konum izni eklendi.`);
