# PaperMap

Aile ve arkadaşlarla karşılıklı **konum paylaşımı** yapılan bir harita uygulaması.

- **Aile**: Bir aile oluştur, davet koduyla üyeleri ekle, aile bireylerinin konumunu haritada gör.
- **Arkadaş**: E-posta ile birebir arkadaş ekle, kabul edildikten sonra birbirinizi haritada görün.
- **Gerçek zamanlı**: Konumlar Socket.IO (WebSocket) ile anlık güncellenir.
- **Gizlilik**: Konum paylaşımını istediğin an aç/kapat. Kapalıyken kimse seni göremez.
- **Mobil**: Capacitor ile Android uygulamasına paketlenir.

## Teknolojiler

| Katman      | Teknoloji                             |
|-------------|---------------------------------------|
| Frontend    | React + Vite, Leaflet (OpenStreetMap) |
| Backend     | Node.js + Express + Socket.IO         |
| Veritabanı  | PostgreSQL + Prisma ORM               |
| Mobil       | Capacitor (Android)                   |
| Dağıtım     | Docker + docker-compose               |

## Hızlı Başlangıç (Docker)

```bash
cp .env.example .env      # gerekirse degerleri duzenle
docker compose up --build
```

Servisler:

- Web arayüz: http://localhost:8080
- Backend API: http://localhost:4015
- PostgreSQL: localhost:5432

`server` konteyneri açılışta veritabanı migration'larını otomatik uygular
(`prisma migrate deploy`).

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

## GitHub Actions ile APK (önerilen)

`.github/workflows/android-release.yml` workflow'u imzalı bir release APK üretir,
backend adresini ve gerekli izinleri APK'ya gömer ve sonucu bir **GitHub Release**'e
yükler. Yerel Android Studio kurulumu gerekmez.

**Tetikleme:**

- **Etiket ile:** `git tag v1.0.0 && git push origin v1.0.0` → otomatik derlenir.
- **Elle:** GitHub'da **Actions** sekmesi → *Android APK* → **Run workflow**.

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

**Gereksinimler:** Android Studio + Android SDK + JDK 17.

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

Bu, `web/android/app/src/main/AndroidManifest.xml` dosyasına
`ACCESS_COARSE_LOCATION` ve `ACCESS_FINE_LOCATION` izinlerini ekler.

Ayrıca backend `https` değil `http` ise (yerel geliştirme), `<application>`
etiketine `android:usesCleartextTraffic="true"` ekleyin. Üretimde backend'i
HTTPS arkasına almanız önerilir.

> **Not (MVP sınırı):** Konum yalnızca uygulama açıkken (foreground) güncellenir.
> Arka planda konum takibi bu sürümün kapsamı dışındadır.

## Ortam Değişkenleri

`.env.example` dosyasına bakın. Başlıca değişkenler:

| Değişken        | Açıklama                                              |
|-----------------|-------------------------------------------------------|
| `DATABASE_URL`  | PostgreSQL bağlantı dizesi                            |
| `JWT_SECRET`    | JWT imzalama anahtarı (üretimde uzun ve rastgele)     |
| `VITE_API_URL`  | Frontend'in kullanacağı backend adresi (build-time)   |
