// Capacitor'un urettigi iOS Info.plist'ine konum/foto izin aciklamalarini
// ve arka plan konum modunu ekler. Idempotenttir.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const plistUrl = new URL('../ios/App/App/Info.plist', import.meta.url);
if (!existsSync(plistUrl)) {
  console.log('Info.plist bulunamadı — once "cap add ios" calistirilmali.');
  process.exit(0);
}

let xml = readFileSync(plistUrl, 'utf8');

const keys = [
  [
    'NSLocationWhenInUseUsageDescription',
    '<string>Konumunuz aile ve arkadaşlarınızla paylaşılır.</string>',
  ],
  [
    'NSLocationAlwaysAndWhenInUseUsageDescription',
    '<string>Uygulama arka plandayken de konumunuzun paylaşılabilmesi için gereklidir.</string>',
  ],
  [
    'NSPhotoLibraryUsageDescription',
    '<string>Profil fotoğrafı ve banner seçebilmek için.</string>',
  ],
];

let additions = '';
for (const [key, value] of keys) {
  if (!xml.includes(`<key>${key}</key>`)) {
    additions += `\t<key>${key}</key>\n\t${value}\n`;
  }
}
if (!xml.includes('<key>UIBackgroundModes</key>')) {
  additions +=
    '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>\n\t</array>\n';
}

if (additions) {
  xml = xml.replace(/<\/dict>\s*<\/plist>\s*$/, `${additions}</dict>\n</plist>\n`);
  writeFileSync(plistUrl, xml);
  console.log('Info.plist güncellendi (konum/foto izinleri eklendi).');
} else {
  console.log('Info.plist zaten güncel.');
}
