// android/app/google-services.json varsa, Capacitor Android projesine
// Google Services Gradle eklentisini ekler (FCM push icin). Idempotenttir.
// Dosya yoksa hicbir sey yapmaz — APK derlemesi yine basariyla tamamlanir.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const androidUrl = new URL('../android/', import.meta.url);

if (!existsSync(new URL('app/google-services.json', androidUrl))) {
  console.log('google-services.json yok — Firebase push yapılandırması atlandı.');
  process.exit(0);
}

// Proje build.gradle — google-services classpath
const projectUrl = new URL('build.gradle', androidUrl);
let project = readFileSync(projectUrl, 'utf8');
if (!project.includes('com.google.gms:google-services')) {
  project = project.replace(
    /dependencies\s*\{/,
    `dependencies {\n        classpath 'com.google.gms:google-services:4.4.2'`,
  );
  writeFileSync(projectUrl, project);
}

// app build.gradle — eklentiyi uygula
const appUrl = new URL('app/build.gradle', androidUrl);
let app = readFileSync(appUrl, 'utf8');
if (!app.includes('com.google.gms.google-services')) {
  app += "\napply plugin: 'com.google.gms.google-services'\n";
  writeFileSync(appUrl, app);
}

console.log('Firebase (google-services) yapılandırıldı — APK push etkin.');
