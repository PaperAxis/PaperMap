# PaperMap

Aile ve arkadaşlarla karşılıklı **konum paylaşımı** yapılan bir harita uygulaması.

- **Aile**: Bir aile oluştur, davet koduyla üyeleri ekle, aile bireylerinin konumunu haritada gör.
- **Arkadaş**: E-posta ile birebir arkadaş ekle, kabul edildikten sonra birbirinizi haritada görün.
- **Gerçek zamanlı**: Konumlar Socket.IO (WebSocket) ile anlık güncellenir.
- **Gizlilik**: Konum paylaşımını istediğin an aç/kapat. Kapalıyken kimse seni göremez.
- **Profil**: Banner, görünen ad, avatar rengi ve şifre düzenleme.
- **Görünüm**: 6 kategori (aydınlık, karanlık, gradyan, erişilebilir) altında
  60 tema ve okunabilirlik dostu yazı tipleri (Lexend, Atkinson Hyperlegible
  vb.). Tercihler hesaba kayıtlıdır, tüm cihazlarda senkron.
- **Mobil**: Capacitor ile Android uygulamasına paketlenir.

## Teknolojiler

| Katman      | Teknoloji                             |
|-------------|---------------------------------------|
| Frontend    | React + Vite, MapLibre GL + OpenFreeMap |
| Backend     | Node.js + Express + Socket.IO         |
| Veritabanı  | PostgreSQL + Prisma ORM               |
| Mobil       | Capacitor (Android)                   |
| Dağıtım     | Docker + docker-compose               |

## Hızlı Başlangıç (Docker)

```bash
cp .env.example .env      # gerekirse degerleri duzenle
docker compose up --build
```

Servisler (varsayılan `BIND_HOST=127.0.0.1`):

- Web arayüz: http://localhost:8080
- Backend API: http://localhost:4015
- PostgreSQL: yalnızca compose ağında (dışarı kapalı)

`server` konteyneri açılışta veritabanı migration'larını otomatik uygular
(`prisma migrate deploy`).

## VDS'te Yayına Alma (Deployment)

`maps.paperaxis.com` üzerinden yayın için:

```bash
# 1) Docker kurulu degilse:
curl -fsSL https://get.docker.com | sh

# 2) Projeyi al
git clone <repo-url> papermap && cd papermap
git checkout claude/papermap-location-app-4bIAf

# 3) Ortam dosyasini olustur ve duzenle
cp .env.example .env
#  .env icinde mutlaka degistir:
#   POSTGRES_PASSWORD = guclu bir parola
#   JWT_SECRET        = uzun rastgele bir deger  (or: openssl rand -hex 32)
#   VITE_API_URL      = https://maps.paperaxis.com
#   BIND_HOST         = 127.0.0.1   (reverse proxy ayni VDS'te ise)

# 4) Turkiye harita verisini uret (tek seferlik; harita varsa atlanir)
./scripts/build-turkey-tiles.sh

# 5) Baslat (arka planda) — migration'lar otomatik uygulanir
docker compose up -d --build

# Durum / loglar / durdurma
docker compose ps
docker compose logs -f
docker compose down

# Guncelleme (yeni kod sonrasi)
git pull && docker compose up -d --build
```

### Harita verisi (self-hosted)

Harita kutucukları kendi sunucunda barındırılır — dış harita servisine bağımlılık
yoktur. `scripts/build-turkey-tiles.sh` betiği [planetiler](https://github.com/onthegomap/planetiler)
ile OpenStreetMap Türkiye verisinden vektör tile üretir (`tiles/turkey.mbtiles`,
~1-3 GB). `tiles` servisi (`tileserver-gl`) bunu sunar; web arayüzü `/tiles/`
üzerinden erişir. Harita stilleri (açık/koyu) `web/src/lib/mapStyle.js` içinde
tanımlıdır — renkler tema ile birlikte değişir.

Betik **idempotenttir**: `tiles/turkey.mbtiles` zaten varsa hiçbir şey indirmez
veya yeniden üretmez, anında çıkar. Yani `git pull` + yeniden dağıtımlarda tekrar
çalıştırmak güvenlidir, ek yük getirmez. Haritayı güncel OSM verisiyle yenilemek
istediğinizde açıkça zorlayın:

```bash
./scripts/build-turkey-tiles.sh --force
docker compose restart tiles
```

Çalıştıktan sonra konteynerler (yalnızca `127.0.0.1` üzerinde):

- `127.0.0.1:8080` → web arayüzü (**tek giriş noktası**)
- `127.0.0.1:4015` → backend (yalnızca hata ayıklama için)

### Reverse proxy yönlendirmesi

`web` konteyneri tek giriş noktasıdır: `/api/` ve `/socket.io/` isteklerini
kendi içinde backend'e (`server:4015`) yönlendirir, geri kalanı React arayüzünü
sunar. Dolayısıyla dış reverse proxy'nizin **tek yapması gereken**
`maps.paperaxis.com` → `papermap-web` (port 80) yönlendirmesidir (WebSocket açık).

> Hedef adı olarak benzersiz alias **`papermap-web`** kullanılır (servis adı
> `web` yaygın olduğundan başka projelerle karışmasın diye). Konteyner adı
> `papermap-web-1` de çözülür ama proje adına bağlıdır; `papermap-web` sabittir.

**Proxy doğrudan VDS host'unda ise:** `proxy_pass http://127.0.0.1:8080;`

**Proxy bir Docker konteynerinde ise:** proxy'yi `papermap-net` ağına bağlayın
ve `papermap-web` adına yönlendirin:

```yaml
# Proxy'nin kendi compose dosyasina:
services:
  <proxy-servisiniz>:
    networks: [default, papermap-net]
networks:
  papermap-net:
    external: true
```

```nginx
server {
    server_name maps.paperaxis.com;
    # ... TLS ayarlariniz ...
    resolver 127.0.0.11 valid=30s;

    location / {
        set $papermap_web papermap-web:80;
        proxy_pass http://$papermap_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Nginx Proxy Manager** kullanıyorsanız: NPM konteynerini `papermap-net` ağına
> ekleyin, sonra **Proxy Host** oluşturun → Forward Hostname `papermap-web`,
> Forward Port `80`, **Websockets Support: AÇIK**. Custom location gerekmez.

## Push Bildirimleri (FCM — uygulama kapalıyken)

Alan giriş/çıkış bildirimleri, uygulama açık/arka plandayken Socket.IO ile gelir.
Uygulama **tamamen kapalıyken** de bildirim gelmesi için Firebase Cloud Messaging
(FCM) gerekir. FCM yapılandırılmazsa uygulama sorunsuz çalışır, yalnızca
kapalı-uygulama push'u devre dışı kalır.

**Sunucu tarafı kurulumu:**

1. [Firebase Console](https://console.firebase.google.com) → yeni proje.
2. **Proje ayarları → Servis hesapları → Yeni özel anahtar üret** → JSON iner.
3. Bu JSON'u VDS'te `/opt/papermap/fcm/service-account.json` olarak kaydedin:
   ```bash
   mkdir -p /opt/papermap/fcm
   # service-account.json dosyasini bu klasore koyun
   docker compose restart server
   ```
   `server` logunda `FCM push etkin.` görünmelidir. (`fcm/` klasörü `.gitignore`'dadır.)

**Mobil (APK) tarafı kurulumu:**

1. Firebase Console → projeye **Android uygulaması ekle**, paket adı: `com.paperaxis.papermap`.
2. `google-services.json` dosyasını indirin.
3. Dosyayı **base64**'e çevirin (kopyala-yapıştır bozulmasını önler):
   ```bash
   base64 -w0 google-services.json      # macOS: base64 -i google-services.json
   ```
4. Çıkan tek satırı GitHub repo **Settings → Secrets → Actions** altına
   `GOOGLE_SERVICES_JSON_BASE64` adıyla ekleyin. (Alternatif, en güvenlisi:
   `gh secret set GOOGLE_SERVICES_JSON_BASE64 < <(base64 -w0 google-services.json)`)
5. APK'yı yeniden derleyin (yeni etiket veya "Run workflow").

Workflow bu secret'ı bulup geçerli bir JSON'a çözebilirse Firebase'i otomatik
bağlar; secret yoksa veya bozuksa APK **yine derlenir**, yalnızca push devre
dışı kalır (Actions logunda uyarı görünür). Yerel derlemede `google-services.json`
dosyasını `web/android/app/` içine koyup `node scripts/patch-google-services.mjs`
çalıştırın.

## Geliştirme (Docker'sız)

```bash
# 1) PostgreSQL'i baslat (ornek)
docker run -d --name papermap-pg -p 5432:5432 \
  -e POSTGRES_USER=papermap -e POSTGRES_PASSWORD=papermap_dev_password \
  -e POSTGRES_DB=papermap postgres:16-alpine

# 2) Backend
cd server
npm install
export DATABASE_URL="postgresql://papermap:papermap_dev_password@localhost:5432/papermap?schema=public"
export JWT_SECRET="dev_secret"
npx prisma migrate deploy
npm run dev            # http://localhost:4015

# 3) Frontend (ayri terminal)
cd web
npm install
npm run dev            # http://localhost:5173
```

Frontend geliştirmede backend adresini `web/.env` içine yazabilirsin:

```
VITE_API_URL=http://localhost:4015
```

## Proje Yapısı

```
papermap/
├── docker-compose.yml
├── server/   # Express + Socket.IO + Prisma
│   ├── prisma/schema.prisma     # User, Friendship, Family, FamilyMember, Location
│   └── src/
│       ├── routes/              # auth, friends, families, location
│       ├── socket.js            # gercek zamanli konum yayini
│       └── visibility.js        # kimin kimi gorebilecegi
└── web/      # React + Vite + Capacitor
    └── src/
        ├── pages/               # Login, Register, MapView, Friends, Family
        ├── components/          # Nav, ProtectedRoute, PeerList
        └── lib/                 # api, auth, socket, geo, time
```

## Kullanım Akışı

1. Kayıt ol / giriş yap.
2. **Arkadaşlar** sekmesinden e-posta ile arkadaşlık isteği gönder; karşı taraf kabul etsin.
3. Veya **Aile** sekmesinden aile oluştur, davet kodunu paylaş; diğerleri kodla katılsın.
4. **Harita** sekmesi konumunu paylaşır ve görünür kişileri canlı gösterir.
5. Üstteki **Paylaşım açık/kapalı** düğmesiyle konum paylaşımını dilediğin an durdur.

## GitHub Actions ile APK + IPA (önerilen)

`.github/workflows/mobile-release.yml` **tek workflow'u** Android APK ve iOS IPA'yı
**paralel** derler ve ikisini tek bir **GitHub Release**'e yükler. Yerel kurulum
(Android Studio / Mac) gerekmez.

**Tetikleme:**

- **Etiket ile:** `git tag v1.0.0 && git push origin v1.0.0` → APK + IPA derlenir.
- **Elle:** GitHub'da **Actions** sekmesi → *Mobil Sürüm (APK + IPA)* → **Run workflow**.

iOS işi başarısız olsa bile (örn. henüz ayarlanmamışsa) Android APK yine yayınlanır.

**Backend adresi:** Varsayılan olarak `https://maps.paperaxis.com` gömülür.
Değiştirmek için repo **Settings → Secrets and variables → Actions → Variables**
altına `VITE_API_URL` değişkenini ekleyin (ya da elle çalıştırırken girin).

**İmzalama:** Workflow imzalı APK üretir. Secrets yoksa o derlemeye özel geçici bir
keystore oluşturur (APK kurulur ama her derlemede anahtar değişir). Uygulamayı
önceki kurulum üzerine **güncelleyebilmek** için kalıcı bir keystore oluşturup
aşağıdaki 4 secret'ı ekleyin (**Settings → Secrets and variables → Actions → Secrets**):

```bash
# 1) Keystore olustur (bir kez)
keytool -genkeypair -v -keystore papermap.jks -alias papermap \
  -keyalg RSA -keysize 2048 -validity 10000

# 2) base64'e cevir (secret'a bu degeri yapistirin)
base64 -w0 papermap.jks        # macOS: base64 -i papermap.jks
```

| Secret adı                  | Değer                                  |
|-----------------------------|----------------------------------------|
| `ANDROID_KEYSTORE_BASE64`   | `papermap.jks` dosyasının base64 hali   |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore (store) parolası               |
| `ANDROID_KEY_ALIAS`         | Anahtar alias'ı (örn. `papermap`)       |
| `ANDROID_KEY_PASSWORD`      | Anahtar (key) parolası                  |

Derleme bitince **Releases** sayfasından `papermap.apk` indirilip cihaza kurulur.

## Mobil (Capacitor / Android) — yerel derleme

Android projesi `web/android/` altında üretilir ve `.gitignore` ile hariç tutulur;
aşağıdaki komutlarla yeniden üretilir.

**Gereksinimler:** Android Studio + Android SDK + JDK 21 (Capacitor 7 gereği).

```bash
cd web

# Backend adresini LAN IP'sine gore ayarla (mobil cihazda localhost CALISMAZ)
export VITE_API_URL=http://192.168.1.20:4015

npm install
npm run build
npm run cap:add:android     # ilk kez: android/ klasorunu olusturur
npm run cap:sync            # web build'ini ve eklentileri senkronlar
npm run cap:open:android    # Android Studio'da acar -> Run ile cihaza yukle
```

Web kodu her değiştiğinde: `npm run build && npm run cap:sync`.

### Android manifest düzenlemeleri

`npm run cap:add:android` sonrası konum izinleri için şu betiği çalıştırın
(GitHub Actions workflow'u bunu otomatik yapar):

```bash
node scripts/patch-manifest.mjs
```

Bu, `web/android/app/src/main/AndroidManifest.xml` dosyasına konum
(ön plan + arka plan) ve bildirim izinlerini ekler.

Ayrıca backend `https` değil `http` ise (yerel geliştirme), `<application>`
etiketine `android:usesCleartextTraffic="true"` ekleyin. Üretimde backend'i
HTTPS arkasına almanız önerilir.

> **Arka plan konumu:** APK'da uygulama arka plandayken/kapalıyken de konum
> güncellenir (`@capacitor-community/background-geolocation`); Android kalıcı
> bir bildirim gösterir. Tarayıcıda konum yalnızca sayfa açıkken güncellenir.

## iOS (iPhone)

Yukarıdaki **Mobil Sürüm** workflow'unun `ios` işi, GitHub'ın **macOS
runner**'ında iOS uygulamasını derler ve **imzasız bir IPA** üretip Release'e
yükler. (Mac sahibi olmanız gerekmez.) APK ile aynı anda, tek tetiklemeyle.

**Önemli — iOS imzalama:** Android'in aksine iOS'ta imzasız IPA doğrudan
kurulamaz. İmzasız `papermap-unsigned.ipa`'yı bir iPhone'a yüklemek için:

- **AltStore** veya **Sideloadly** ile kendi (ücretsiz) Apple ID'nizle imzalayın.
  Uygulama 7 günde bir yenilenmelidir (ücretsiz Apple ID sınırı).
- Kalıcı kurulum / TestFlight için **Apple Developer Program** üyeliği (yılda
  99$) gerekir. Üyelik alındığında bu workflow'a imzalama (sertifika +
  provisioning profile, GitHub Secrets ile) eklenerek doğrudan kurulabilir IPA
  üretilebilir.

iOS projesi `web/ios/` altında üretilir (`.gitignore`'da). Yerel derleme için
Mac'te: `cd web && npm run build && npm run cap:add:ios && npm run cap:open:ios`.

## Ortam Değişkenleri

`.env.example` dosyasına bakın. Başlıca değişkenler:

| Değişken        | Açıklama                                              |
|-----------------|-------------------------------------------------------|
| `DATABASE_URL`  | PostgreSQL bağlantı dizesi                            |
| `JWT_SECRET`    | JWT imzalama anahtarı (üretimde uzun ve rastgele)     |
| `VITE_API_URL`  | Frontend'in kullanacağı backend adresi (build-time)   |
