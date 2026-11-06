# SWIFT Giden Transferler Süre Performans Analizi — Proje Takip

**Platform:** SWIFT gpi Pulse · **Son güncelleme:** 26 Ekim 2026 · **Sürüm:** v0.8 (3 aylık veri, ortalama bazlı analiz)

---

## 1. Nasıl çalıştırılır?

| Yöntem | Adım | AI Asistan |
|---|---|---|
| **Önerilen (Mac)** | `start.command` dosyasına çift tıklayın → tarayıcıda **http://127.0.0.1:8765/index.html** açılır | ✓ |
| Windows | `start.bat` dosyasına çift tıklayın | ✓ |
| Sunucusuz | `index.html` dosyasını doğrudan tarayıcıda açın | ✗ (diğer tüm sayfalar çalışır) |

- Gereksinim: yalnızca Python 3 (ek paket yok). İlk açılışta macOS "tanımlanamayan geliştirici" uyarısı verirse: sağ tık → Aç.
- Tüm kütüphaneler (ECharts, globe.gl, topojson) klasör içinde; internet gerekmez. Bayrak görselleri flagcdn.com'dan gelir, erişim yoksa emoji bayrak gösterilir.
- API anahtarları yalnızca `config.json` içinde durur, tarayıcıya gönderilmez. (`config.example.json` şablondur.)

**Veriyi yenilemek:** `pipeline/run_pipeline.sh ~/Desktop/mayis.csv ~/Desktop/haziran.csv ~/Desktop/temmuz.csv ~/Desktop/ekim.csv` (gereksinim: `pip3 install pandas scikit-learn`). Çıktı `data/` klasörüne yazılır; sayfayı yenilemek yeterli.

## 2. Klasör yapısı

```
index.html              Platform giriş sayfası
assets/                 Uygulama kodu (app.js, p_overview.js, p_globe.js, p_tools.js, style.css) + vendor/
data/                   data.js (70.909 işlem), events.js (gpi olayları), world.js (ülke sınırları)
pipeline/               CSV → platform verisi dönüşüm betikleri
server.py               Yerel sunucu + Azure GPT/Speech proxy
config.json             Azure anahtarları (paylaşmayın)
start.command / .bat    Tek tıkla başlatma
PROJE_TAKIP.md          Bu dosya
```

## 3. Platform sayfaları

| Sayfa | İçerik |
|---|---|
| Genel Bakış | KPI'lar, medyan uçtan uca süre, muhabir/alıcı zaman payı, ≤30dk/≤1sa/aynı gün/ertesi gün/2+ gün oranları, günlük hacim, otomatik bulgular, en hızlı/yavaş ülkeler |
| Dünya Haritası | Döndürülebilir 3D küre; ülkeler medyan süre/hacim/alıcıda bekleme/aynı gün % ile renklenir; TR → muhabir hub → alıcı ülke akış arkları; ülke tıklayınca bayrak, KPI, banka listesi |
| Süreç Analizi | Ülke bazında aşama ayrıştırması, kesim saati etkisi, saat×gün ısı haritası, döviz, rota uzunluğu, red/bekleme nedenleri, masraf tipi |
| Koridorlar | Ülke seçimi → o ülkeye muhabir bazında ortalama süre ve muhabir × döviz tablosu; en hızlı/yavaş koridorlar |
| Banka Karnesi | Alıcı ve muhabir bankalar için 0–100 skor + A–E not; hız×tutarlılık haritası; banka profili |
| Uyarılar | >24 saat sonuçlanmamış, RJCT, ülke normunun 3 katı süre, iptal/geri çağırma; performansı bozulan bankalar |
| Tahminleme | Yeni ödeme için P50/P80/P90 süre, aynı gün olasılığı, müşteri bilgilendirme metni, saat senaryosu, etken önemi |
| İşlem Gezgini | UETR/referans/banka arama; işlem bazında gpi zaman çizelgesi ve rota |
| AI Asistan | GPT-5.1 ile filtrelenmiş toplulaştırılmış veri üzerinde soru-cevap; Azure Speech ile seslendirme |
| Veri Kalitesi & Metodoloji | Mevcut kuralların sınanması, düzeltme önerileri, mevcut vs düzeltilmiş karşılaştırma |
| Proje Günlüğü | Sürüm geçmişi, açık sorular, yol haritası |

## 4. Veri — temel rakamlar (v1.4 · Mayıs–Temmuz + Ekim 2026)

- 4 CSV (mayis/haziran/temmuz/ekim) → **88.009 işlem (UETR)**. Dönemler: 1 May – 29 Tem ve 1 – 30 Eki (Ağustos–Eylül verisi yok).
- Kapsam dışı: her dönemin son 2 günü ve sonrası başlangıçlı işlemler (28 Tem+, 29 Eki+) ve FI transferleri — toplam 3.850 işlem.
- İşlem tipleri: Direct Payment 81.623 · Cover (COV) 6.386.
- Sonuç: ACCC 76.444 (%86,9) · RJCT 628.
- **İşlem süresi**: tüm işlemler 21,7 sa · **P95 ortalama 8,7 sa** — muhabir ağı 1,3 sa + alıcı banka 7,3 sa.
- Dönem bazında P95 ortalama: Mayıs–Temmuz 9,1 sa (68.679 işlem, değişmedi) · Ekim 7,1 sa (19.330 işlem).
- Ekim'in son haftasında gönderilen işlemlerin bir kısmının tracker mesajları henüz gelmediği için Ekim'de "takip mesajı yok" (%4,9) ve "alıcıda bekliyor" (%5,6) oranları yüksek; ACCC oranı %80,9.
- Aynı gün %75 · ertesi gün %13 · 2+ gün %12 · ≤1 saat %42.

## 5. Metodoloji — mevcut kurallarda tespit edilen sorunlar ve düzeltmeler

1. **ACCC'yi kimin gönderdiği kontrol edilmiyor.** Cover ve çok bacaklı rotalarda ACCC aracı bankadan (örn. PNBPUS3N, CITIUS33) gelebiliyor; alıcı banka hâlâ G004/G002 bildiriyor. CSV'de final=ACCC görünen **819 işlem** aslında alıcı banka teyitli değil. → Bitiş = alıcı bankanın (BIC ilk 4 hane eşleşmesi) **ilk** ACCC'si.
2. **SystemDate yerine gpi olay zamanı (:79:) kullanılmalı.** SystemDate KT'nin mesajı işlediği an: hafta içi medyan 4 dk gecikme, **cumartesi 1,8 gün, pazar 13 sa** (hafta sonu mesajları pazartesi 00:xx'te toplu işleniyor). CSV'deki BeneficiarySuresi'nin 0/5 dk'da yığılması 5 dk'lık işleme döngüsü artefaktı. BizdenCikis için pacs.008 CreDtTm (saniye hassas) kullanıldı.
3. **SonMesajTarihi son ACCC'yi alıyor.** 3.430 işlemde birden fazla ACCC var; 540 işlemde bitiş tarihi Haziran–Eylül'e taşıyor.
4. **8 haneli BIC eşleşmesi kırılgan** (UNCRITM1↔UNCRITMM, LOYDGB21↔LOYDGB2L, REVOLT21↔REVOGB2L). → Ulaşma: 6 hane; ACCC teyidi: 4 hane.
5. **Zaman damgası kalitesi:** 718 mesajda yalnızca tarih (00:00), 1.483 tutarsız (2001/2028 yılı vb.). En sık: ISBKTRIS, IBAZAZ2X, AFKBTRIS. Bu durumda SystemDate − 3 dk yedek.
6. **PDCR = "Pending Cancellation Request" (gSRP Stop & Recall)**, "Pending Credit" değil. Alıcıda bekleme ACSP/G002 (alacak beklemede), G003 (belge bekleniyor), G004 (fon bekleniyor) ile ifade edilir.
7. **Reference kolonu bozuk** (Excel bilimsel gösterim, 59.098 satır). Veri doğrudan SQL'den, Excel'e açılmadan alınmalı.
8. Sonuç: Medyan farkı küçük (~6 dk) ama işlemlerin **%12'sinde mevcut yöntem 1 saatten fazla, %3,4'ünde 1 günden fazla** uzun ölçüyor.

### Düzeltilmiş metrik tanımları
- **BizdenCikis (t0):** pacs.008 (yoksa pacs.009/MT103) CreDtTm.
- **AliciyaUlasma:** alıcı bankanın (CdtrAgt) bildiren veya iletilen banka olarak ilk görüldüğü gpi olay zamanı (BIC 6 hane; G002–G004/ACCC için 4 hane).
- **Bitis:** alıcı bankanın ilk ACCC'si; ondan önce RJCT varsa RJCT zamanı.
- **MuhabirAgiSuresi** = AliciyaUlasma − t0 · **AliciBankaSuresi** = Bitis − AliciyaUlasma · **Toplam** = Bitis − t0.

## 6. Azure API durumu

- Platformun AI özellikleri `server.py` üzerinden çalışır (tarayıcıdan doğrudan çağrı CORS ve anahtar güvenliği nedeniyle yapılmaz).
- Claude'un çalışma ortamından (bulut ve Mac sanal makinesi) Azure uç noktalarına çıkış kurum politikasıyla engelli olduğu için **bağlantı Claude tarafından test edilemedi.** Platformdaki **AI Asistan → "Bağlantıyı test et"** butonu sizin bilgisayarınızın ağından test eder.
- Kullanılan: #1 GPT-5.1 (sohbet, `max_completion_tokens`), #5 Speech (tr-TR-EmelNeural seslendirme). #3 Embedding ve #4 Realtime şimdilik gerekmiyor (ileride: doğal dilde işlem arama, sesli asistan).
- ⚠ Anahtarlar sohbette düz metin paylaşıldı; rotasyon önerilir.

## 7. Sürüm geçmişi

### v1.4 · 6 Kasım 2026
- **Ekim 2026 verisi eklendi** (ekim.csv · 68.912 mesaj · 19.330 işlem). Arayüz ve hesaplama kuralları değiştirilmedi.
- Veri hattı dönem-duyarlı hale getirildi (Ağustos–Eylül boşluğu nedeniyle): dönem sonu, kapsam dışı son 2 gün kuralı, "veri penceresi sonrası" bitişleri ve açık işlemlerin yaşı her işlemin kendi dönemine göre hesaplanıyor. Mayıs–Temmuz sonuçları birebir aynı kaldı.
- Yalnızca tarih/dönem metinleri güncellendi (kenar çubuğu, Veri Kalitesi sayfası 7. madde ve başlık).

### v1.3 · 3 Kasım 2026
- Hata düzeltmesi (kullanıcı testi, 112640431): alıcı CdtrAgt BMPBDEF2, ödeme muhabir CHASDEFX tarafından grubun Belçika birimi BMPBBEBB'ye iletilmiş (16:11), ACCC 16:27. Eski kural grubun kendi ACCC'sini "son muhabir bildirimi" saydığı için alıcı süresi 0 çıkıyordu. Yeni: muhabir 30 dk / alıcı 16 dk.
  - Alıcıya ulaşma: muhabirin alıcı banka grubunun (BIC 4 hane) başka bir birimine iletmesi de sayılır.
  - Son muhabir bildirimi: alıcı grubunun kendi ACCC/RJCT'si hariç.
  - 1.113 işlemin aşama ayrışması değişti; 0 dk alıcı banka 3.981 → 3.283. Kalan 0'ların 3.237'sinde muhabir iletimi ile ACCC aynı dakikada (doğrulandı), 46'sı doğrudan gönderimde ACSP ile ACCC aynı dakikada.
  - Toplam süreler değişmedi (P95 9,1 sa; muhabir 1,4 sa / alıcı 7,7 sa).
- **Açık karar:** 1.701 işlemde ACCC önce alıcı grubunun başka biriminden (örn. CHASUS33, CITIUS33), sonra alıcının kendi biriminden (örn. CHASHKHH) geliyor. Şu an ilki sonuç sayılıyor; alıcının kendi ACCC'si esas alınırsa P95 9,1 → 9,5 sa, tüm işlemler 23,7 → 24,1 sa. Karar (3 Kasım): mevcut yapı korunuyor (grubun ilk ACCC'si); öneri ileride değerlendirilecek.

### v1.2 · 3 Kasım 2026
- 0 dk aşama süreleri artık **mesaj zamanlarına göre gerçek değer** olarak gösteriliyor (kullanıcı kararı):
  - Doğrudan alıcıya gönderilip alıcı banka ACSP göndermeden ACCC yaptıysa: muhabir 0, sürenin tamamı alıcıda (3.252 işlem).
  - Son muhabirin iletim bildirimi ile alıcının ACCC'si aynı dakikadaysa: alıcı banka 0 (3.925 işlem; örn. 142601802 → muhabir 7 dk / alıcı 0).
  - İleri valörlüde ödeme valörden önce alıcıdaysa: muhabir 0 (1.835 işlem).
  - Son muhabir bildirimi kuralı artık aynı dakikayı da kapsıyor (önce "ölçülemedi" düşüyordu).
- "Ölçülemedi" yalnızca alıcının sonuç bildirimi muhabir bildirimlerinden önce zaman damgalı olan **218** tamamlanmış işlemde (örn. 112620531).
- Ortalamalar: P95 9,1 sa · muhabir ağı 1,4 sa · alıcı banka 7,7 sa.

### v1.1 · 3 Kasım 2026
- İşlem Gezgini: arama kutusunun yanında listelenen işlemlerin ortalama süre / muhabir ağı / alıcı banka değerleri.
- Genel filtre: **Rota Uzunluğu** (Doğrudan, 2, 3, 4+ banka) ve **"Yalnızca aynı gün valörlü"** kutusu (ileri valörlüleri hariç tutar).
- Süreç Analizi: "Red ve bekleme nedenleri" ve "Masraf tipi" kaldırıldı. İşlem tipi tablosu tam genişlikte.
- İşlem tipleri: "Müşteri Transferi" → **Direct Payment**; FI transferleri (18) kapsam dışı.
- TCZBTR2A adı **TC ZIRAAT BANKASI A.S.** olarak düzeltildi. Tahminleme ülke listesi alfabetik.
- **0 dk aşama süreleri düzeltildi:**
  - Doğrudan alıcıya giden ödemelerde alıcıya ulaşma = alıcı bankanın ilk ACSP bildirimi (örn. 112626063: muhabir 9 dk). ACSP valörden önceyse muhabir 0 (ödeme zaten alıcıda).
  - Alıcı banka rotada ilk kez kendi sonuç mesajıyla görünüyorsa ulaşma = son muhabirin önceki bildirimi (1.348 işlem).
  - Hiç ara bildirim yoksa (6.674 işlem) toplam süre geçerli, aşama ayrışması "ölçülemedi". Muhabir/alıcı ortalamaları ölçülebilen işlemlerdeki aşama payıyla ortalama süreye uygulanır (toplamları ortalama süreye eşit).
  - Sonuç: tamamlanan işlemlerde 0 dk muhabir 6.250 → 1.540 (1.529'u ileri valörlü), 0 dk alıcı banka 4.495 → 55.
- Kapsam: operasyonel başlangıcı 28 Temmuz ve sonrası olan işlemler analiz dışı.
- Kod: `pipeline/3_build.py`, `6_export.py`, `assets/app.js`, `p_overview.js`, `p_tools.js`, `style.css`.

### v1.0 · 26 Ekim 2026
- Uç değer ifadesi arayüzde **"P95 ortalama (uç değerler hariç)"** olarak standartlaştırıldı; filtre kutusu "Uç değerleri hariç tut (P95)".
- "İşlem süresi (mesai dışı ve tatiller hariç)" seçeneği kullanıcı kararıyla rapordan kaldırıldı (seçici, metodoloji metni ve karşılaştırma grafiği çubukları). Hesaplama `pipeline/mesai.py` içinde duruyor, ileride gerekirse yeniden açılabilir.

### v0.9 · 26 Ekim 2026
- Uç değer kuralı: **P95** — seçili filtrede süresi en uzun %5'lik dilimdeki işlemler "uç değerler hariç" ortalamaya katılmaz (filtreye göre dinamik; <20 işlemde uygulanmaz). Filtre çubuğundaki kutu ile dahil edilebilir.
- Yeni süre ölçüsü: **İşlem süresi (mesai dışı ve tatiller hariç)** — filtre çubuğundaki seçiciden açılır; aynı uç değer kutusu geçerli. Muhabir ağı süresi ilk muhabirin ülkesinin, alıcı banka süresi alıcı ülkenin yerel mesaisine (09:00–18:00) göre sayılır; yerel hafta sonu (Körfez ülkelerinde Cuma–Cumartesi) ve resmi tatiller (TR, ABD, DE, GB, FR, AT, IT; TR 26 Mayıs arife 13:00'e kadar) düşülür. Doğrudan alıcıya giden işlemlerde muhabir süresi 0.
- Not: Banka mesai dışında işlem yaptığında bu ölçüde süre 0'a yakın çıkabilir (örn. 112624945: işlem süresi 7,6 sa → mesai bazında 60 dk).
- Veri Kalitesi sayfasında yöntem karşılaştırma grafiğine mesai bazlı iki çubuk eklendi.
- Kod: `pipeline/mesai.py` (yeni), `4_durations.py`, `6_export.py`, `assets/app.js`, `p_overview.js`, `p_tools.js`.

### v0.8 · 26 Ekim 2026
- Tek süre tanımı: **İşlem süresi** (takvim/reel ayrımı kaldırıldı). Arayüzde uç değer sınırı yalnızca "uç değerler hariç ortalama" olarak anılıyor (iç kural: 72 saat).
- Düzeltme 1: Doğrudan alıcı bankaya gönderilen müşteri transferlerinde (InstdAgt = alıcı banka, cover yok; 5.422 işlem — Yapı Kredi, KFH, Intesa vb.) muhabir ağı süresi hatalı şekilde ~5,8 saat görünüyordu → artık 0, sürenin tamamı alıcı bankada.
- Düzeltme 2: Yalnızca tarih gönderen damgalar bankanın kendi yerel saatine göre (00:00) tespit ediliyor; TR saatine çevrildikten sonra gözden kaçan 563 damga yakalandı (örnek 112605891, Wing Hang HK).
- Bağımsız kontrol: rastgele 400 tamamlanmış işlem ham mesajlardan ayrı bir betikle yeniden hesaplandı; tüm sonuçlar platformla aynı.

### v0.7 · 26 Ekim 2026
- Uç değer kuralı: sabit 3 gün (72 saat). 3 günü aşan işlemler (~%6,7) ortalamaya katılmıyor, Uyarılar'da izleniyor. **Ortalama uçtan uca süre: 7,6 saat** (tüm işlemler dahil 23,5 sa).
- "Reel işlem süresi" kaldırıldı: 09–18 mesai varsayımı alıcı süresini yanlış sıfırlıyordu (örnek 112624945: Garanti ACCC 07:34 → alıcı süresi 224 dk iken 0 görünüyordu). Tüm analizler takvim süresi.
- Kontrol: tüm tamamlanan işlemlerde muhabir ağı + alıcı banka = uçtan uca süre (birebir).

### v0.6 · 26 Ekim 2026
- Zaman kuralı (örnek 102690092): olay zamanı :79:; :79: SWIFT'in mesajı oluşturduğu andan sonrasını gösteriyorsa hatalı sayılır ve SWIFT kayıt zamanı kullanılır (SABB ACCC: damga 11 May 22:35 → SWIFT kaydı 10 May 22:59).
- Yedek zaman artık SystemDate−3 dk değil, tracker'ın mesajı oluşturduğu an (:20: alanı, UTC; olaydan ortalama ~1 dk sonra). Hafta sonu toplu teslim gecikmesi yedek zamanlara yansımıyor.
- Valörden önce tamamlanan işlemler (246): başlangıç valör olarak kalır, "valörden önce tamamlandı" işaretlenir; tamamlanma oranında sayılır ama süre ortalamalarına katılmaz (çıkıştan ölçülünce 3,4 gün gibi yanıltıcı değerler oluşuyordu).
- 5.859 ileri tarihli + 2.430 yalnızca tarih + 1.199 tutarsız + 599 damgasız mesajda tracker zamanı kullanıldı.

### v0.5 · 26 Ekim 2026
- Koridorlar: ülke seçiminin yanına alıcı banka seçimi; alıcı bankalara göre ortalama süre grafiği ve alıcı banka tablosu.
- "Aynı gün %75" kontrol edildi: hesaplama doğru (tamamlanan işlemler, operasyonel başlangıç günü baz). Çıkış günü baz alınırsa %66,5; tüm işlemler paydaya alınırsa %66.

### v0.4 · 26 Ekim 2026
- Süre bazı sadeleştirildi: Takvim süresi (varsayılan) ve Reel işlem süresi. Dış rapor/kurum referansları kaldırıldı; Genel Bakış'ta "Süre nasıl ölçülüyor?" kartı.
- Koridorlar: ülke seçimli sade görünüm (muhabir bazında süre grafiği + muhabir × döviz tablosu) + en hızlı/yavaş koridorlar.

### v0.3 · 26 Ekim 2026
- Mayıs–Temmuz verisi; tüm KPI'lar ortalama bazlı, uç değerler Tukey kuralıyla ayıklanıyor (filtre çubuğundan kapatılabilir).
- Süre bazı seçimi ve uç değer ayıklama eklendi.
- OperasyonelBaslangic: valör (IntrBkSttlmDt) gönderim gününden ileriyse valör günü 00:00; ACCC valörden önceyse çıkış zamanı.
- :79: damga kontrolü: ileri tarihli (5.636), yalnızca tarih (2.430), tutarsız (1.199) damgalar ayıklanıp SystemDate−3 dk kullanılıyor.
- Grafiklerde koyu yeşil.
- Pipeline v3 (pipeline/1_load … 6_export); eski betikler pipeline/v1.

### v0.2 · 22 Ekim 2026
- SP revizyonu hazırlandı: `sql/SWIFT_gpi_SP_revize_v2.sql`. ACCC yalnızca bildiren BIC = BeneficiaryBIC ise final; değilse FinalN99ReasonCode/SonMesajTarihi akıştaki son mesajdan. Yeni kolonlar: IslemDurumu, IsFinal, AraciACCC*. Olay zamanı :79: satırından.
- GitHub için `.gitignore` (config.json ve işlem verisi hariç) ve README eklendi.
- start.command hata mesajlarını gösterecek şekilde güncellendi; adres http://127.0.0.1:8765.

### v0.1 · 14 Ekim 2026
- Book1.csv tam ayrıştırma; pacs/MT tracker içeriklerinden rota, durum, neden, kesinti, olay zamanı çıkarıldı.
- Düzeltilmiş metrikler + veri kalitesi raporu.
- Platform: 11 sayfa, 3D küre, filtreler (tarih, döviz, ülke, alıcı banka, muhabir, işlem tipi), bayrak ve banka monogramları, orta/açık tema.
- Tahmin modeli (hiyerarşik benzer-işlem + GBM etken önemi), uyarı kuralları, banka skorlaması.
- Yerel sunucu + Azure proxy, pipeline betikleri.

## 8. Açık sorular / teyit gerekenler
1. CSV'yi doğrudan SQL'den (Excel'den geçmeden) alabilir miyiz?
2. Hafta sonu tracker mesajları neden pazartesi 00:xx'te işleniyor?
3. Mayıs öncesi/sonrası daha uzun bir pencere alınabilir mi?
4. Müşteri segmenti / kanal / şube bilgisi eklenebilir mi?
5. Banka logoları: şu an otomatik monogram. Resmi logo kullanımı için kurumsal onay/kaynak gerekir.

## 9. Sonraki adımlar (öneri)
- SQL bağlantısı ile otomatik günlük yenileme.
- SLA hedefleri (ülke/banka) ve haftalık yönetim raporu (PDF).
- Tatil takvimi ve iş saati bazlı süre metriği.
- Takılı işlemler için e-posta/Teams uyarısı.
- Muhabir seçimi öneri motoru.
