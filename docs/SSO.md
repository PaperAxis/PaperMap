<!--
  Copyright (c) 2026 PaperAxis. All rights reserved.
  This file is part of PaperMap.
-->

# Google ve PaperApp ile giriş (SSO)

PaperMap iki dış kimlik sağlayıcıyı destekler: **Google** ve **PaperApp**
(PaperAxis OIDC sağlayıcısı, `docs/OIDC.md` PaperApp deposunda). İkisi de aynı
sunucu taraflı akışla çalışır: kod + PKCE (S256), `state` ve `nonce`. Web ve
native uygulamalar sağlayıcıyla doğrudan konuşmaz; yalnız PaperMap sunucusuyla
konuşur. Bu yüzden Google için tek bir **Web uygulaması** OAuth istemcisi yeter
(Android SHA-1 ya da iOS istemcisi gerekmez).

## Sağlayıcı anahtarları

| `provider` | Sağlayıcı | Düğme metni |
|---|---|---|
| `google` | Google (`https://accounts.google.com`) | Google ile devam et |
| `paperapp` | PaperApp (`PAPERAPP_ISSUER`) | PaperApp ile devam et |

## Akış

```
istemci ──► GET /api/sso/:provider/start?client=web|android|ios&mode=login|link[&ticket=…]
sunucu  ──► 302 sağlayıcının authorize adresi (state, nonce, PKCE challenge)
sağlayıcı ─► 302 GET /api/sso/:provider/callback?code&state
sunucu  ──► kodu takas eder, id_token'ı doğrular, kullanıcıyı bulur/oluşturur/bağlar
        ──► 302 dönüş adresi + ?code=<tek kullanımlık PaperMap kodu>  (ya da ?error=<kod>)
istemci ──► POST /api/auth/sso/exchange {code}  → {token, user}   (mode=login)
            POST /api/auth/sso/exchange {code}  → {linked: true, provider, user} (mode=link)
```

Dönüş adresleri (sunucu kendisi seçer, istekten alınmaz):

| `client` | Dönüş |
|---|---|
| `web` | `${APP_URL}/sso` |
| `android`, `ios` | `papermap://sso` |

Sorgu: başarıda `code=<64 hex>&mode=login|link&provider=…`; hatada
`error=<kod>&provider=…`. PaperMap kodu 120 sn geçerli ve tek kullanımlıktır.

## Uçlar

| İş | İstek | Yanıt |
|---|---|---|
| Etkin sağlayıcılar | `GET /api/auth/sso/providers` | `{providers: ["google", "paperapp"]}` (yalnız yapılandırılmış olanlar) |
| Başlat | `GET /api/sso/:provider/start?client=&mode=&ticket=` | 302 |
| Dönüş | `GET /api/sso/:provider/callback` | 302 |
| Bağlama bileti | `POST /api/auth/sso/link-ticket` (oturum gerekir) `{provider}` | `{ticket}` (120 sn, tek kullanım; `mode=link` başlatırken `ticket` olarak verilir) |
| Kod takası | `POST /api/auth/sso/exchange` `{code}` | login: `{token, user}`; link: `{linked: true, provider, user}` |
| Bağlı hesaplar | `GET /api/auth/identities` (oturum) | `{identities: [{provider, email, createdAt}], hasPassword}` |
| Bağlantıyı kaldır | `DELETE /api/auth/identities/:provider` (oturum) | `{ok}`; şifresi olmayan ve başka bağlantısı kalmayan hesapta `409` |

## Hesap eşleme kuralları

1. `(provider, subject)` zaten bağlıysa o kullanıcıyla giriş yapılır
   (`disabled` kullanıcı → `error=account_disabled`).
2. `mode=link`: bilet sahibinin hesabına bağlanır. Bu kimlik başka bir hesaba
   bağlıysa `error=identity_in_use`.
3. `mode=login`, bağlı değil:
   - **Google** ve `email_verified=true`, aynı e-postalı PaperMap hesabı var ve
     o hesabın `emailVerified=true` → otomatik bağlanır, giriş yapılır.
   - Aynı e-postalı hesap var ama yukarıdaki koşul yok (PaperApp e-postayı
     doğrulamaz: `email_verified` hep `false`) → `error=email_in_use`.
     Kullanıcı şifresiyle girip Profil > Bağlı hesaplar'dan bağlar.
   - E-posta yoksa yeni hesap açılır: `displayName` = `name`, `username` e-postanın
     yerel kısmından türetilir (geçersiz karakterler `_`, 3–20, çakışırsa sayı eki),
     rastgele şifre, `hasPassword=false`. Google'da `emailVerified=true`.

Hata kodları: `access_denied`, `invalid_state`, `provider_error`,
`email_missing`, `email_in_use`, `identity_in_use`, `account_disabled`,
`not_configured`. İstemciler Türkçe mesaja çevirir.

## Yapılandırma (`.env`)

```sh
# Google Cloud Console > APIs & Services > Credentials > OAuth client ID
#   Uygulama türü: Web application
#   Authorized redirect URI: https://maps.paperaxis.com/api/sso/google/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# PaperApp OIDC (PaperApp .env'de OIDC_CLIENT_PAPERMAP_* ile eşleşir)
PAPERAPP_ISSUER=https://app.paperaxis.com   # TEYİT: PaperApp'teki OIDC_ISSUER ile birebir
PAPERAPP_CLIENT_ID=papermap
PAPERAPP_CLIENT_SECRET=
```

Boş bırakılan sağlayıcı kapalıdır; düğmesi gösterilmez. Dönüş adresi
`${APP_URL}/api/sso/<provider>/callback` (APP_URL https olmalı).

## Native uygulamalar

- **Android:** başlatma adresini tarayıcıda açar (`ACTION_VIEW`);
  `papermap://sso` için `intent-filter` (`BROWSABLE`, `singleTask` etkinlik)
  dönüşü yakalar, `code`'u takas eder.
- **iOS:** `ASWebAuthenticationSession` (`callbackURLScheme: "papermap"`,
  `prefersEphemeralWebBrowserSession = false`). Info.plist'e `papermap` URL şeması.
- Bağlama: önce `POST /api/auth/sso/link-ticket`, sonra `mode=link&ticket=…` ile başlat.
