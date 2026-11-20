# PaperMap tasarım sistemi

PaperMap, PaperApp'in güncel görünümüne (PaperAxis tasarım sistemi,
`paperaxis-standartlari` skill'i) taşındı. Renk, yazı tipi ve tema kataloğu
PaperApp'teki `src/lib/appearance/` ile aynı kaynaktan gelir; bir kullanıcının
seçtiği tema kimliği PaperApp, PaperBudget ve PaperMap'te aynı temayı anlatır.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `web/src/lib/appearance/themes.js` | 152 temalık katalog (PaperApp `themes.ts` dosyasından aktarıldı). Her palet `harden()` ile ölçülür: metin 4.5:1, form kenarı 3:1. `themeStyle()` temayı PaperMap'in CSS değişkenlerine çevirir |
| `web/src/lib/appearance/contrast.js` | WCAG 2.x kontrast hesabı |
| `web/src/lib/appearance/fonts.js` | 25 yazı tipi; kimlikler ve sıra PaperApp ile aynı |
| `web/src/lib/appearance/index.js` | Seçimi `<html>` üzerine uygular, `theme-color` meta etiketini günceller, gerekirse Google Fonts bağlantısını ekler |
| `web/src/styles.css` | Bileşen stilleri; yalnız semantik değişkenleri okur |
| `web/src/fonts.js` | Uygulamayla gelen yazı tipleri |
| `web/src/components/Credit.jsx` | Künye satırı: `© 2026 PaperAxis · PaperMap v0.1.0` |

## Renk değişkenleri

Varsayılan değerler PaperAxis Aydınlık'tır; seçilen tema bunların üzerine
yazar. Bileşenlerde ham hex kullanılmaz (harita işaretleri ve kullanıcının
seçtiği avatar/yer renkleri hariç).

| Değişken | PaperAxis Aydınlık | PaperAxis Koyu | Rol |
|---|---|---|---|
| `--app-bg` | `#F5F3EE` | `#171918` | Sayfa zemini (gradyan temalarda gradyan) |
| `--bg` | `#F5F3EE` | `#171918` | Düz zemin, alt gezinme |
| `--card` | `#FFFFFF` | `#232625` | Kart, açılır menü, panel |
| `--surface-2` | `#E6E4DE` | `#2D3130` | İkincil yüzey, hover, rozet |
| `--text` | `#171918` | `#F5F3EE` | Metin |
| `--muted` | `#666963` | `#9A9D96` | İkincil metin |
| `--border` | `#C9C6BD` | `#3A3E3C` | Dekoratif kenar |
| `--input-border` | `#7E817A` | `#7E817A` | Form alanı ve ikincil düğme kenarı |
| `--accent` | `#315BDB` | `#7A9BF0` | Birincil eylem, seçili durum, bağlantı |
| `--accent-hover` | `#2649B8` | `#8EA9F3` | Birincil hover |
| `--on-accent` | `#FFFFFF` | `#171918` | Birincil düğme yazısı |
| `--danger` / `--on-danger` | `#B3261E` / beyaz | `#F0736B` / ink | SOS, silme, hata |
| `--warn` | `#8A5300` | `#E8B44A` | Çevrimdışı bandı |
| `--ok` | `#4F6A44` | `#A5B99A` | Kişi durumu |

Ölçülmüş çiftler (PaperApp `docs/DESIGN_TOKENS.md`): ink/paper 15.93,
graphite/paper 5.03, beyaz/Axis Blue 5.75, Axis Blue/paper 5.19,
ink/Blue Light 6.54. Üretilen 150 temanın ölçümleri `harden()` içinde
çalışma anında yapılır.

## Tipografi

- Gövde: Inter (değişken), başlık: Manrope, etiket ve sayılar: JetBrains Mono.
  Üçü de `@fontsource-variable` ile uygulamayla gelir, `latin-ext` dahil.
- Lexend, Atkinson Hyperlegible, Roboto, Nunito ve Poppins da uygulamayla
  gelir (Android'de çevrimdışı çalışır). Diğer 15 yazı tipi yalnız seçildiğinde
  Google Fonts'tan yüklenir.
- Kart başlıkları (`.card h3`) ve `.pa-label` mono, büyük harf, 0.08em.
  Sayfa `lang="tr"` olduğu için "i" büyük harfte "İ" olur.

## Bileşen kuralları

- Düğmeler 44 px (`.small` 36 px), radius 8 px. Varyantlar `--btn-bg` ve
  `--btn-bg-hover` değişkenleriyle çalışır: arka planı kendi belirleyen
  sınıflar (liste satırı, tema kutusu) birincil hover'dan etkilenmez.
- Basılı durum `translateY(1px)`; ölçek animasyonu yok. Süreler 150 ile
  200 ms; `prefers-reduced-motion` hepsini kapatır.
- Odak her öğede `:focus-visible` ile 2 px `--accent` halka.
- Kartlar 12 px radius, gölgesiz; gölge yalnız yüzen katmanlarda (harita
  menüsü, alt panel, diyalog, oynatma çubuğu).
- İkonlar Lucide, varsayılan çizgi 1.5 px ("İkon stili" ayarı değiştirir).
- Gradyan yalnız kullanıcının seçtiği gradyan temalarda; profil banner'ı
  boşken düz `--surface-2`.

## Eski tercihler

Kayıtlı eski değerler kaybolmaz, `resolveThemeId()` en yakın temaya eşler:

| Eski | Yeni |
|---|---|
| `light`, `system`, boş | `paperaxis` |
| `dark` | `paperaxis-koyu` |
| `light-<aksan>`, `dark-<aksan>` | `light-<ton>`, `dark-<ton>` |
| `light-gradient-*`, `dark-gradient-*` | `light-grad-*`, `dark-grad-*` |
| `light-access-*`, `dark-access-*` | `a11y-light-*`, `a11y-*` |
| Yazı tipi `default` | `inter` |

Aksan → ton: emerald→zumrut, teal→turkuaz, blue→mavi, indigo→civit,
violet→menekse, fuchsia→fusya, pink→gul, rose→kiraz, orange→turuncu,
amber→kehribar. Sunucu tarafında değişiklik gerekmedi: `PATCH /api/auth/profile`
yeni kimlikleri zaten kabul ediyor.

## Bilinen sınırlamalar

- Veritabanındaki `avatarColor` varsayılanı hâlâ `#10b981`; yeni kullanıcılar
  yeşil avatarla başlar. Değiştirmek migration ister, bu işe katılmadı.
- Harita kutucuk stili (`mapStyle.js`) ve harita işaretlerinin renkleri
  değişmedi; yalnız açık/koyu seçimi temanın şemasından gelir.
- Google Fonts'tan gelen yazı tipleri yazı tipi listesinde seçilene kadar
  yedek yazı tipiyle önizlenir.
- PaperMap henüz PaperApp'in `GET/PUT /api/oidc/appearance` ucuyla senkron
  değil; kimlikler aynı olduğu için bağlanması tek adım.
