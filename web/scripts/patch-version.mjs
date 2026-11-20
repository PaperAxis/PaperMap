// Capacitor'un urettigi android/app/build.gradle'a surum adini ve kodunu yazar.
// Kullanim: node scripts/patch-version.mjs <versionName> <versionCode>
// PaperUpdates istemcisi versionCode'u karsilastirir; Android ayrica ayni ya da
// daha dusuk versionCode'lu bir APK'yi guncelleme olarak kurmaz.
import { readFileSync, writeFileSync } from 'node:fs';

const [versionName, versionCodeRaw] = process.argv.slice(2);
const versionCode = Number(versionCodeRaw);
if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
  console.error('Kullanim: node scripts/patch-version.mjs <versionName> <versionCode>');
  process.exit(2);
}

const gradleUrl = new URL('../android/app/build.gradle', import.meta.url);
let gradle = readFileSync(gradleUrl, 'utf8');

const before = gradle;
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

if (gradle === before && !before.includes(`versionCode ${versionCode}`)) {
  console.error('build.gradle icinde versionCode/versionName bulunamadi.');
  process.exit(1);
}

writeFileSync(gradleUrl, gradle);
console.log(`build.gradle: versionName ${versionName}, versionCode ${versionCode}`);
