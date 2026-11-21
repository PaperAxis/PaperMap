# PaperMap

Aile ve arkadaşlarla karşılıklı **konum paylaşımı** yapılan bir harita uygulaması.

- **Aile**: Bir aile oluştur, davet koduyla üyeleri ekle, aile bireylerinin konumunu haritada gör.
- **Arkadaş**: E-posta ile birebir arkadaş ekle, kabul edildikten sonra birbirinizi haritada görün.
- **Gerçek zamanlı**: Konumlar Socket.IO (WebSocket) ile anlık güncellenir.
- **Gizlilik**: Konum paylaşımını istediğin an aç/kapat. Kapalıyken kimse seni göremez.
- **Profil**: Banner, görünen ad, avatar rengi ve şifre düzenleme.
- **Görünüm**: PaperAxis tasarım sistemi (PaperApp ile aynı tokenlar).
  Varsayılan PaperAxis Aydınlık; PaperAxis Koyu ve 6 kategoride 150 tema daha
  (aydınlık, karanlık, gradyanlar, erişilebilir), 25 yazı tipi. Tema ve yazı
  tipi kimlikleri PaperApp ve PaperBudget ile aynıdır. Tercihler hesaba
  kayıtlıdır, tüm cihazlarda senkron. Ayrıntı: `docs/DESIGN_SYSTEM.md`.
- **Mobil**: Capacitor ile Android uygulamasına paketlenir.

## Native uygulamalar (2.0)

Android (Kotlin + Jetpack Compose) ve iOS (SwiftUI) native uygulamaları
`apps/` altındadır; aynı sunucuya bağlanır. Ayrıntı, kapsam ve API sözleşmesi:
[apps/README.md](apps/README.md). Derleme ve yayın:
`.github/workflows/native-release.yml` (APK → PaperUpdates `papermap-android`
ve GitHub Release, IPA → AltStore kaynağı; yalnızca `v*` etiketi ya da elle
çalıştırmada — `main`'e push yalnızca derler). Capacitor ile paketlenen eski web
kabuğu (`mobile-release.yml`) yalnızca elle çalışır.

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

# 3) Ortam dosyasini olustur ve duzenle
cp .env.example .env
#  .env icinde mutlaka degistir:
#   POSTGRES_PASSWORD = guclu bir parola
#   JWT_SECRET        = en az 32 karakter rastgele deger (openssl rand -hex 32)
#                       — bos/varsayilan birakilirsa server acilista durur
#   VITE_API_URL      = https://maps.paperaxis.com
#   ALLOWED_ORIGINS   = https://maps.paperaxis.com  (CORS; bos = tum origin'ler)
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

`server` ve `web` konteynerlerinde **healthcheck** vardır; `docker compose ps`
çıktısında durumları `healthy` görünmelidir. `web`, `server` sağlıklı olana
kadar başlamayı bekler.

### Otomatik dağıtım (self-hosted runner)

`.github/workflows/deploy.yml`, `main`'e her itmede sunucudaki self-hosted
runner'da çalışır: önce veritabanı yedeği alır, sonra `scripts/deploy.sh` ile
git'te izlenen dosyaları `/opt/PaperMap`'e kopyalar ve
`docker compose up -d --build --wait` ile yeniden derler. `.env`, `tiles/`,
`fcm/` ve `backups/` korunur; `.env` yoksa iş durur.

Sunucuda bir kez:

- Runner'ı organizasyona ya da bu depoya kaydedin (etiketler
  `self-hosted,linux,x64`; farklıysa repo değişkeni `RUNNER_LINUX`, ör.
  `["self-hosted","papermap"]`). Runner kullanıcısı `docker` grubunda olmalı.
- Kurulum klasörü runner kullanıcısına yazılabilir olmalı:
  `sudo chown -R <runner kullanıcısı> /opt/PaperMap`.
  Farklı klasör için repo değişkeni `PAPERMAP_DIR`.

### Uygulama güncellemeleri (PaperUpdates)

Mobil sürüm iş akışı Android APK'yı GitHub'ın runner'ında derler ve
`updates.paperaxis.com/papermap-android/` altına yayınlar (`releases.android.json` +
`PaperMap-<sürüm>.apk`). `versionCode` iş akışının çalıştırma numarasıdır.
Uygulama açılışta günde en fazla bir kez bu dosyayı okur; daha yeni sürüm varsa
altta "İndir ve kur" bandı çıkar, kurulum kullanıcının onayıyla yapılır.

Gerekenler:

- PaperUpdates yönetim uygulamasında `papermap` ürünü ve yayın anahtarı
  (`pup_…`) → repo secret'ı `PAPERAXIS_PUBLISH_TOKEN`. Ürün anahtarı
  `papermap-android`; uygulama bu klasörü okur.
- Kalıcı keystore secret'ları (aşağıda). Geçici anahtarla imzalanan APK
  kurulu uygulamanın üstüne kurulamadığı için o derlemede yayın atlanır.

### Veritabanı yedekleme

Tüm kullanıcı verisi `papermap_db` adlı Docker volume'unda tutulur. Düzenli
yedek alın:

```bash
# Elle yedek (./backups dizinine sıkıştırılmış SQL dump)
./scripts/backup-db.sh

# Bir yedekten geri yükle (mevcut veriyi değiştirir — onay ister)
./scripts/restore-db.sh backups/papermap-20260517-030000.sql.gz
```

Otomatik günlük yedek için cron'a ekleyin (yedekler 30 günden sonra silinir):

```bash
crontab -e
# Her gece 03:00:
0 3 * * * cd /opt/PaperMap && scripts/backup-db.sh >> backups/backup.log 2>&1
```

> Yedekleri ayrı bir makinede/depolamada da saklamanız önerilir — VDS
> tamamen kaybolursa yerel yedekler de gider.

### Harita verisi (self-hosted)

Harita kutucukları kendi sunucunda barındırılır — dış harita servisine bağımlılık
yoktur. `scripts/build-turkey-tiles.sh` betiği [planetiler](https://github.com/onthegomap/planetiler)
ile OpenStreetMap Türkiye verisinden vektör tile üretir (`tiles/turkey.mbtiles`).
`tiles` servisi (`tileserver-gl`) bunu sunar; web arayüzü `/tiles/` üzerinden
erişir. Harita stilleri (açık/koyu) `web/src/lib/mapStyle.js` içinde tanımlıdır;
POI'ler, ev numaraları, havalimanları, il/ilçe sınırları, tarım/kumsal/sulak
alanlar, patika ve tali yollar dahil tüm OpenMapTiles katmanları çizilir —
renkler tema ile birlikte değişir.

**3B harita.** Harita varsayılan olarak 3B açılır (sağ üstteki **3D / 2D**
düğmesiyle değiştirilir; tercih cihazda saklanır):

- **3B binalar** — OSM'deki yükseklik/kat sayısı (`render_height`) ile z14+
  yükselir; yüksek binalar hafif koyu tonda çizilir. Native uygulamalarda harita
  iki parmakla eğildiğinde aynı binalar görünür.
- **Gerçek arazi** (yalnız web) — dağlar ve vadiler yükseklik verisiyle
  kabartılır (1,3× vurgu), ufukta gökyüzü ve sis görünür.
- **Kabartma gölgesi** (hillshade) — web ve native; yakınlaştıkça yumuşar.
- Ek detaylar: otoyol / devlet yolu / tali yol hiyerarşisi, köprü ve tünel
  ayrımı, tek yön okları (z16+), otoyol numaraları (D-100, O-4…), metro/tramvay,
  feribot, teleferik, iskele, nehir ve park adları, IATA kodlu havalimanları ve
  renk kategorisi genişletilmiş POI'ler.

Yükseklik verisi AWS Open Data'daki [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
(Mapzen, terrarium PNG, z0-15) setidir. Tarayıcı bu servise **doğrudan bağlanmaz**:
web nginx'i `/terrain/` isteklerini sunucudan yapar ve `/var/cache/nginx/terrain`
altında 180 gün saklar (en fazla 6 GB). Böylece kullanıcının baktığı bölge üçüncü
tarafa gitmez ve her kutucuk yalnız bir kez indirilir. Web konteyneri yeniden
oluşturulursa önbellek boşalır, ilk bakışlarda yeniden dolar.

**Harita stilleri.** Katmanlar menüsünün (sağ üstteki katman simgesi) altındaki
**Harita stili** bölümünden seçilir; seçim cihazda saklanır:

| Stil | Açıklama |
|------|----------|
| Otomatik | Uygulama temasını izler (açık/koyu) — varsayılan |
| Açık / Koyu | Temadan bağımsız sabit stil |
| Arazi | Kâğıt tonlu zemin, doygun orman/tarla renkleri, belirgin dağ gölgeleri |
| Uydu | Uydu görüntüsü + yarı saydam yollar ve beyaz etiketler (hibrit) |

Uydu görüntüsü [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)
kaynağından gelir ve DEM gibi web nginx'i üzerinden (`/satellite/`) çekilip
`/var/cache/nginx/satellite` altında önbelleğe alınır (30 gün, en fazla 20 GB).
**Lisans notu:** Esri görüntüsü atıf zorunluluğuyla sunulur ve ticari / yoğun
kullanım için Esri (ArcGIS Location Platform) hesabı gerektirebilir. Başka bir
sağlayıcıya (ör. MapTiler Satellite) geçmek için `web/nginx.conf` içindeki
`$papermap_sat` ve `rewrite` satırlarını değiştirmek yeterlidir; istemci kodu
aynı kalır. Kaynak atıfları haritanın sol altındaki "i" düğmesinde gösterilir.

Native uygulamalar şimdilik açık/koyu stilleri kullanır (temaya göre).

Stil `mapStyle.js` içinde değişirse native stillerini yeniden üretin:

```bash
node apps/scripts/export-map-styles.mjs
```

**Detay seviyesi (maxzoom).** Betik varsayılan olarak **z15** üretir (planetiler'in
kendi varsayılanı 14). z15; bina, POI ve sokak geometrisini çok daha ayrıntılı
saklar, MapLibre bunları z16+ için büyüterek (overzoom) gösterir. Bedeli:
`turkey.mbtiles` ~2-3× büyür (~3-8 GB) ve üretim daha uzun sürer. Disk/süre
kısıtlıysa düşürebilirsiniz — bu durumda `mapStyle.js` içindeki kaynak `maxzoom`
değerini de eşitleyin:

```bash
TILE_MAXZOOM=14 ./scripts/build-turkey-tiles.sh --force
```

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

**`general` ağı:** `web` konteyneri sunucudaki ortak `general` ağına da
bağlıdır (`docker-compose.yml`, harici ağ). Bu ağdaki Nginx Proxy Manager
`papermap-web:80` adresine doğrudan ulaşır; ek `docker network connect` gerekmez.
Ağ önceden var olmalıdır (`docker network create general`); farklı adlıysa
`.env`'de `PAPERMAP_PROXY_NETWORK` ile verilir.

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

## Google ve PaperApp ile giriş

Giriş ve kayıt ekranında "Google ile devam et" ve "PaperApp ile devam et"
düğmeleri, Profil'de "Bağlı hesaplar" kartı vardır. Düğmeler yalnız sunucuda
yapılandırılmış sağlayıcılar için görünür. Akış, hesap eşleme kuralları ve
uçlar: [docs/SSO.md](docs/SSO.md).

Kurulum (`.env`, sonra `docker compose up -d server`):

1. **Google:** Google Cloud Console > APIs & Services > Credentials > OAuth
   client ID, tür **Web application**, yetkili dönüş adresi
   `https://maps.paperaxis.com/api/sso/google/callback`. `GOOGLE_CLIENT_ID` ve
   `GOOGLE_CLIENT_SECRET` doldurulur.
2. **PaperApp:** PaperApp'te `papermap` istemcisi tanımlanır (PaperApp
   `docs/OIDC.md`, dönüş adresi `https://maps.paperaxis.com/api/sso/paperapp/callback`),
   aynı sır burada `PAPERAPP_CLIENT_SECRET` olur; `PAPERAPP_ISSUER` PaperApp'teki
   `OIDC_ISSUER` ile birebir aynıdır.

`APP_URL` https olmalıdır; dönüş adresleri ondan kurulur.

## Push Bildirimleri (FCM — uygulama kapalıyken)

Alan giriş/çıkış bildirimleri, uygulama açık/arka plandayken Socket.IO ile gelir.
Uygulama **tamamen kapalıyken** de bildirim gelmesi için Firebase Cloud Messaging
(FCM) gerekir. FCM yapılandırılmazsa uygulama sorunsuz çalışır, yalnızca
kapalı-uygulama push'u devre dışı kalır.

**Sunucu tarafı kurulumu:**

1. [Firebase Console](https://console.firebase.google.com) → yeni proje.
2. **Proje ayarları → Servis hesapları → Yeni özel anahtar üret** → JSON iner.
3. Bu JSON'u VDS'te `/opt/PaperMap/fcm/service-account.json` olarak kaydedin:
   ```bash
   mkdir -p /opt/PaperMap/fcm
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

En kolayı: kendi bilgisayarınızda (openssl + `gh auth login` gerekli) tek komut.
Anahtarı openssl ile üretir, 4 secret'ı doğrudan yükler, parolayı ekrana basmaz;
yedeği `~/.papermap-keystore` altına koyar — **bu yedeği güvenli saklayın**,
kaybolursa kurulu uygulamalar bir daha güncellenemez:

```bash
./scripts/setup-android-keystore.sh
```

Elle yapmak isterseniz:

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

## Uygulama ikonu ve favicon (marka)

Tek kaynak: **`branding/logo.png`**. Bundan hem web favicon'ları hem de mobil
uygulama ikonlarının kaynakları üretilir:

- **Web favicon** (`web/public/favicon.ico`, `favicon-16/32.png`,
  `apple-touch-icon.png`, `icon-192/512.png`) — `index.html`'de bağlıdır,
  build ile `dist/`'e kopyalanır. Bunlar repoda **hazır** durur.
- **Mobil ikonlar** — `web/assets/` altındaki kaynaklardan (`icon-only.png`,
  `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`)
  CI'da `@capacitor/assets` ile Android `mipmap` ve iOS `AppIcon` setine
  otomatik üretilir (mobile-release workflow'unda `cap add` sonrası adım).
  Yani her APK/IPA derlemesinde ikon markanızla gömülür.

**Logoyu değiştirmek** için `branding/logo.png`'yi yenisiyle değiştirip:

```bash
pip install Pillow            # tek sefer
python3 scripts/generate-icons.py
```

Bu betik `web/public/` favicon'larını ve `web/assets/` mobil kaynaklarını
yeniden üretir; commit'leyip yeni bir derleme tetiklemeniz yeterli. Adaptive
ikon güvenli bölgesi, iOS için opak zemin ve koyu tema açılış ekranı otomatik
ayarlanır.

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

# Uygulama ikonunu markayla uret (CI bunu otomatik yapar)
npx --package @capacitor/assets@3 -- capacitor-assets generate --android \
  --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#ffffff' \
  --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#10131c'

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

> **Arka plan konumu:** APK'da uygulama arka plandayken de konum güncellenir
> (`@capacitor-community/background-geolocation`); Android kalıcı bir bildirim
> gösterir. Tarayıcıda konum yalnızca sayfa açıkken güncellenir.
>
> Arka planda **çalışması için iki ayar şart** (Android'in koyduğu kısıt):
> 1. **Konum izni "Her zaman izin ver"** olmalı — uygulama ilk açılışta
>    yalnızca "Uygulamayı kullanırken" izni alır. *Ayarlar > Uygulamalar >
>    PaperMap > İzinler > Konum > Her zaman izin ver* seçin. Bu seçili
>    değilse uygulama arka plana geçince konum **tamamen durur**.
> 2. **Pil optimizasyonu kapalı** olmalı — *Ayarlar > Uygulamalar > PaperMap
>    > Pil > Sınırsız / Optimize etme*. Aksi halde Android (özellikle
>    Xiaomi/Samsung/Oppo gibi markalarda) arka plandaki uygulamayı uyutur.
>
> Uygulama izin eksikse haritanın üstünde uyarı ve "Ayarları aç" düğmesi
> gösterir. **Uygulamayı görev yöneticisinden tamamen kapatırsanız** (kartı
> kaydırınca) arka plan servisi de durur — bu eklentinin/Android'in bir
> sınırıdır; uygulamanın arka planda *açık* kalması gerekir.

## iOS (iPhone)

Yukarıdaki **Mobil Sürüm** workflow'unun `ios` işi, GitHub'ın **macOS
runner**'ında iOS uygulamasını derler ve **imzasız bir IPA** üretip Release'e
yükler. (Mac sahibi olmanız gerekmez.) APK ile aynı anda, tek tetiklemeyle.

**Önemli — iOS imzalama:** Android'in aksine iOS'ta imzasız IPA doğrudan
kurulamaz. İmzasız `papermap-unsigned.ipa`'yı bir iPhone'a yüklemek için
**AltStore / SideStore** veya **Sideloadly** kullanılır; bunlar kendi
(ücretsiz) Apple ID'nizle uygulamayı imzalar. Uygulama 7 günde bir
yenilenmelidir (ücretsiz Apple ID sınırı).

### AltStore kaynağı (önerilen)

Workflow her sürümde bir **AltStore kaynağı** (`altstore.json`) üretip
Release'e ekler. Bu sayede IPA'yı elle indirmeye gerek kalmaz:

1. iPhone'a [AltStore](https://altstore.io) (veya SideStore) kurun ve
   bilgisayarınızda AltServer'ı çalıştırın.
2. AltStore → **Browse** → sağ üst **+** → şu kaynak URL'sini ekleyin:

   ```
   https://github.com/captainendis/papermap/releases/latest/download/altstore.json
   ```

3. **PaperMap** listede çıkar; **Free** / **Get** ile tek dokunuşla kurulur.
4. Yeni bir workflow çalıştığında AltStore uygulamayı **otomatik günceller**
   (kaynak hep en son sürüme işaret eder).

### Elle kurulum (kaynak olmadan)

Release'ten `papermap-unsigned.ipa`'yı indirip AltStore'da **My Apps → +**
ile seçerek de kurabilirsiniz. Sideloadly kullanıyorsanız IPA'yı uygulamaya
sürükleyip Apple ID'nizle imzalayın.

### iOS'ta bildirimler

iOS'ta **uzaktan push** (FCM/APNs) yalnızca **ücretli Apple Developer
hesabıyla** çalışır — ücretsiz Apple ID ile AltServer'dan kurulan uygulamada
push entitlement verilmediği için FCM push **çalışmaz**.

Bunun yerine uygulama **yerel bildirim** (local notification) gösterir; bu,
entitlement gerektirmez ve ücretsiz hesapla kurulan uygulamada da çalışır.
Sunucudan gelen bildirim olayı (alan giriş/çıkış, mesaj vb.) uygulama
**çalışırken** — ön planda ya da arka plan konum modu sayesinde canlıyken —
iPhone'da OS bildirimi olarak gösterilir.

> **Sınır:** iOS uygulamayı tamamen sonlandırırsa (uygulama bütünüyle
> kapalıyken) bildirim gelmez. Uygulama tamamen kapalıyken bildirim için
> ücretli Apple Developer hesabı + APNs yapılandırması zorunludur.

Android'de bu sınır yoktur; `GOOGLE_SERVICES_JSON_BASE64` secret'i ile FCM
push yapılandırıldığında APK uygulama kapalıyken de bildirim alır.

### Apple Developer hesabıyla (kalıcı kurulum)

Kalıcı kurulum / TestFlight ve tam push bildirimleri için **Apple Developer
Program** üyeliği (yılda 99$) gerekir. Üyelik alındığında bu workflow'a
imzalama (sertifika + provisioning profile, GitHub Secrets ile) ve iOS için
Firebase APNs yapılandırması eklenerek doğrudan kurulabilir, push destekli
IPA üretilebilir.

iOS projesi `web/ios/` altında üretilir (`.gitignore`'da). Yerel derleme için
Mac'te: `cd web && npm run build && npm run cap:add:ios && npm run cap:open:ios`.

## Ortam Değişkenleri

`.env.example` dosyasına bakın. Başlıca değişkenler:

| Değişken        | Açıklama                                              |
|-----------------|-------------------------------------------------------|
| `DATABASE_URL`  | PostgreSQL bağlantı dizesi                            |
| `JWT_SECRET`    | JWT imzalama anahtarı (üretimde uzun ve rastgele)     |
| `VITE_API_URL`  | Frontend'in kullanacağı backend adresi (build-time)   |
