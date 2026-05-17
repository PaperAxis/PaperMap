# PaperMap

Aile ve arkadaşlarla karşılıklı **konum paylaşımı** yapılan bir harita uygulaması.

- **Aile**: Bir aile oluştur, davet koduyla üyeleri ekle, aile bireylerinin konumunu haritada gör.
- **Arkadaş**: E-posta ile birebir arkadaş ekle, kabul edildikten sonra birbirinizi haritada görün.
- **Gerçek zamanlı**: Konumlar Socket.IO (WebSocket) ile anlık güncellenir.
- **Gizlilik**: Konum paylaşımını istediğin an aç/kapat.
- **Mobil**: Capacitor ile Android uygulamasına paketlenir.

## Teknolojiler

| Katman      | Teknoloji                          |
|-------------|------------------------------------|
| Frontend    | React + Vite, Leaflet (OpenStreetMap) |
| Backend     | Node.js + Express + Socket.IO      |
| Veritabanı  | PostgreSQL + Prisma ORM            |
| Mobil       | Capacitor (Android)                |
| Dağıtım     | Docker + docker-compose            |

## Hızlı Başlangıç (Docker)

```bash
cp .env.example .env      # gerekirse degerleri duzenle
docker compose up --build
```

Servisler:

- Web arayüz: http://localhost:8080
- Backend API: http://localhost:4000
- PostgreSQL: localhost:5432

`server` konteyneri açılışta veritabanı migration'larını otomatik uygular.

## Geliştirme (Docker'sız)

```bash
# Backend
cd server && npm install && npm run dev

# Frontend (ayri terminal)
cd web && npm install && npm run dev
```

## Proje Yapısı

```
papermap/
├── docker-compose.yml
├── server/   # Express + Socket.IO + Prisma
└── web/      # React + Vite + Capacitor
```

## Mobil (Capacitor)

Mobil derleme adımları ileride bu bölüme eklenecektir (uygulama adımı 10).
Önemli: Mobil cihazda `localhost` backend'e ulaşmaz; `VITE_API_URL` değerini
geliştirme makinenizin LAN IP adresine ayarlayın.

> **Not (MVP sınırı):** Konum yalnızca uygulama açıkken (foreground) güncellenir.
> Arka planda konum takibi bu sürümün kapsamı dışındadır.
