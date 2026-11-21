<!--
  Copyright (c) 2026 PaperAxis. All rights reserved.
  This file is part of PaperMap.
-->

# PaperMap native uygulamaları

`android/` Kotlin + Jetpack Compose, `ios/` Swift + SwiftUI ile yazılmış, aynı
sunucuya (`https://maps.paperaxis.com`) bağlanan native PaperMap uygulamalarıdır.
Web arayüzü (`web/`) ve sunucu (`server/`) değişmez; native uygulamalar aynı REST
API'yi ve Socket.IO olaylarını kullanır.

| | Android | iOS |
|---|---|---|
| Dil / arayüz | Kotlin 2, Jetpack Compose, Material 3 | Swift 5.9, SwiftUI (iOS 16+) |
| Harita | MapLibre Native Android | MapLibre Native iOS (SPM) |
| Gerçek zamanlı | socket.io-client-java | Socket.IO-Client-Swift (SPM) |
| Arka plan konumu | Foreground service + FusedLocationProvider | CoreLocation, `allowsBackgroundLocationUpdates` |
| Güncelleme | PaperUpdates (`papermap-android`) | AltStore kaynağı |
| Kimlik | `com.paperaxis.papermap` | `com.paperaxis.papermap` |

Uygulama kimliği Capacitor sürümüyle aynıdır ve aynı anahtarla imzalanır; native
APK, kurulu Capacitor uygulamasının üzerine güncelleme olarak kurulur.

## Sürüm

Sürüm adı **etiketten** gelir: `v3.0.0` etiketi atılınca Android `versionName` ve
iOS `MARKETING_VERSION` `3.0.0` olur, GitHub Release, PaperUpdates ve AltStore
kaynağı bu sürümle yayınlanır:

```bash
git tag v3.0.0 && git push origin v3.0.0
```

Etiket push'layamıyorsanız: **Actions → Native Sürüm (APK + IPA) → Run workflow**,
dal `main`, **version** `3.0.0`. İş akışı `v3.0.0` etiketini çalıştırılan commit'e
kendisi atar ve aynı yayını yapar (etiket zaten varsa durur).

Etiket `vX.Y.Z` biçiminde olmalıdır; değilse iş akışı durur. Etiketsiz
çalışmalarda (dal derlemeleri, elle çalıştırma) sürüm son `vX.Y.Z` etiketinin
`X.Y`'si + çalıştırma numarasıdır (ör. `3.0.42`), böylece elle yayınlar etiketli
sürümün gerisine düşmez. Bu yüzden elle yayından sonra yeni sürüm için ara
sürümü artırın (`v3.1.0`); yama etiketi (`v3.0.1`) PaperUpdates'te daha eski
sayılabilir. Android `versionCode` / iOS build numarası her zaman
`200 + çalıştırma no`dur (hep artar; Capacitor derlemelerinin (≤ 199) üstünde).
Ayrıntı: `.github/scripts/app-version.sh`.

## Ortak kaynaklar

- `shared/map-style-light.json`, `shared/map-style-dark.json`: web'in harita
  stilinden (`web/src/lib/mapStyle.js`) üretilir, iki uygulama da bunu paketler:
  `node apps/scripts/export-map-styles.mjs`
- `assets/`: uygulama ikonu ve açılış ekranı kaynakları
  (`python3 scripts/generate-icons.py` üretir, kaynak `branding/papermap-*.svg`).

## Kapsam (2.0)

Giriş / kayıt, canlı harita (kendi konumun + arkadaş ve aile üyelerinin konumu,
pil, son güncelleme, durum), konum paylaşımını açma/kapama, arka planda konum
gönderme, arkadaşlar (liste, istek gönder/kabul et/sil), aileler (liste, üyeler,
oluştur, davet koduyla katıl, ayrıl), profil (görünen ad, oturumu kapat, Hakkında).
Android'de PaperUpdates ile uygulama içi güncelleme.

**2.1:** sohbet (birebir, grup, aile; konum mesajı gösterimi; canlı mesaj),
bildirimler (liste, okundu, sistem bildirimi). Android'de uygulama kapalıyken
FCM push (`google-services.json` varsa). iOS'ta push yok: sunucu yalnızca FCM
gönderir, imzasız (AltStore) IPA'da APNs kullanılamaz; bildirim soket + yerel
bildirimle gelir (arka plan konum modu açıkken uygulama canlı kalır).

Sonraki sürümlere kalanlar: alanlar (geofence), yerler,
buluşmalar, yolculuk/ETA, SOS, konum geçmişi, paylaşım bağlantıları, profil
fotoğrafı yükleme, temalar, yönetim.

## API özeti

Tüm istekler `Authorization: Bearer <token>`; hata gövdesi `{ "error": "..." }`.

| İş | İstek | Yanıt |
|---|---|---|
| Giriş | `POST /api/auth/login` `{login, password}` (login: e-posta ya da kullanıcı adı) | `{token, user}` |
| Kayıt | `POST /api/auth/register` `{email, username, displayName, password}` (şifre ≥ 8) | 201 `{token, user}` |
| Ben | `GET /api/auth/me` | `{user}` |
| Profil | `PATCH /api/auth/profile` `{displayName}` | `{user}` |
| Paylaşım | `PATCH /api/location/sharing` `{enabled, durationMinutes?}` | `{user}` |
| Konum (HTTP) | `POST /api/location` `{lat, lng, accuracy, battery, charging}` | `{ok}` |
| Arkadaşlar | `GET /api/friends` | `{friends, incoming, outgoing}` her biri `{friendshipId, user:{id, displayName, username, avatarColor, avatarPath}}` |
| İstek gönder | `POST /api/friends` `{username}` | 201 |
| Kabul | `POST /api/friends/:friendshipId/accept` | `{ok}` |
| Sil / reddet | `DELETE /api/friends/:friendshipId` | `{ok}` |
| Aileler | `GET /api/families` | `{families:[{id, name, inviteCode, role, memberCount}]}` |
| Aile detayı | `GET /api/families/:id` | `{id, name, inviteCode, ownerId, members:[{id, displayName, username, avatarColor, avatarPath, role, joinedAt}]}` |
| Aile oluştur | `POST /api/families` `{name}` | 201 `{id, name, inviteCode}` |
| Katıl | `POST /api/families/join` `{inviteCode}` | 201 `{id, name}` |
| Ayrıl | `DELETE /api/families/:id/leave` | `{ok}` |

| Sohbetler | `GET /api/conversations` | `{conversations:[{id, type: direct\|group\|family, title, otherUser:{id, avatarColor, avatarPath}\|null, memberCount, lastMessage:{body, createdAt, senderName}\|null, updatedAt, unread}]}` |
| Birebir aç | `POST /api/conversations/direct` `{userId}` | `{conversationId}` |
| Grup aç | `POST /api/conversations/group` `{name, memberIds}` | 201 `{conversationId}` |
| Mesajlar | `GET /api/conversations/:id/messages` (son 200, eskiden yeniye) | `{conversation, messages:[message]}` |
| Gönder | `POST /api/conversations/:id/messages` `{body}` ya da `{placeLat, placeLng, placeLabel}` | 201 `{message}` |
| Okundu | `POST /api/conversations/:id/read` | `{ok}` |
| Bildirimler | `GET /api/notifications` (son 100) | `{notifications:[{id, title, body, createdAt, readAt}], unread}` |
| Tümü okundu | `POST /api/notifications/read` | `{ok}` |
| Push token | `POST /api/notifications/token` `{token, platform: "android"}` | `{ok}` |

`message`: `{id, conversationId, body, placeLat, placeLng, placeLabel, createdAt,
senderId, senderName, senderAvatarColor, senderAvatarPath}`. Konum mesajında
`placeLat`/`placeLng` doludur.

`user`: `{id, email, username, displayName, sharingEnabled, sharingUntil, avatarColor,
avatarPath, bannerPath, theme, statusText, emailVerified, isAdmin}`. `avatarPath`
sunucuya göreli yoldur (`/uploads/...`).

**Socket.IO** (`/socket.io/`, `auth: { token }`):

| Yön | Olay | Veri |
|---|---|---|
| → | `location:update` | `{lat, lng, accuracy, battery, charging}` |
| → | `refresh` | — |
| ← | `peers:snapshot` | `[peer]` (bağlanınca ve `refresh` sonrası) |
| ← | `peer:location` | `peer` |
| ← | `peer:offline` | `{userId}` |
| ← | `peers:changed` | — (`refresh` gönder) |
| ← | `message` | `{conversationId, message}` (gönderen dahil tüm üyelere) |
| ← | `notification` | `{id, title, body, createdAt}` (yeni mesaj, alan, pil vb.) |

`peer`: `{userId, displayName, avatarColor, avatarPath, statusText, lat, lng,
accuracy, battery, charging, updatedAt}`.

## Tasarım

PaperAxis tokenları: zemin `#F5F3EE`, metin `#171918`, kart `#E6E4DE`, ikincil metin
`#666963`, tek vurgu Axis Blue `#315BDB` (koyu temada `#7A9BF0`), hata `#B3261E`.
Başlık Manrope, gövde Inter. Gradyan, glow, emoji yok; ekranda tek birincil mavi buton.

---

Bir PaperAxis ürünüdür. © 2026 PaperAxis · info@paperaxis.com
