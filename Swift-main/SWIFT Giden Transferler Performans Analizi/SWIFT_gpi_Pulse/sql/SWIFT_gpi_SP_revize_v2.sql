/* =====================================================================
   SWIFT gpi Giden Transfer - Süre Performans Sorgusu  (REVİZE v2)
   ---------------------------------------------------------------------
   Mevcut SP'deki "SELECT ... ORDER BY SystemDate DESC" bloğunun yerine
   kullanılmak üzere hazırlanmıştır (DECLARE / IF NOT EXISTS sarmalı aynı
   kalabilir).

   DEĞİŞİKLİKLER
   1) ACCC yalnızca ACCC satırındaki bildiren banka (:79: altındaki ilk
      BIC) = BeneficiaryBIC ise "gerçek final" sayılır. Muhabir/aracı
      bankanın ACCC'si final değildir.
   2) Gerçek final yoksa FinalN99ReasonCode = akıştaki EN SON mesajın
      kodu, SonMesajTarihi = en son mesajın tarihi.
   3) Tamamlanan işlemde SonMesajTarihi = alıcı bankanın İLK ACCC'si
      (eski kod MAX alıyordu; mükerrer/geç gelen ACCC'ler süreyi şişiriyordu).
   4) RJCT hangi bankadan gelirse gelsin final kabul edilir (ilk RJCT).
   5) Olay zamanı SystemDate yerine tracker mesajının :79: satırındaki
      gpi zaman damgasından alınır (saat dilimi TR'ye çevrilir). Damga
      yoksa / yalnızca tarihse (00:00) / tutarsızsa SystemDate kullanılır.
   6) Yeni kolonlar: IslemDurumu, IsFinal, FinalBildirenBIC,
      AraciACCCVar, AraciACCCBIC, AraciACCCTarihi.
   7) Tracker mesajları tek seferde ayrıştırılır (satır başına korelasyonlu
      alt sorgular kalktı -> performans).

   NOT: SQL Server 2016+ (TRY_CONVERT, DATETIMEOFFSET, SWITCHOFFSET).
        Gerçek veritabanında test edilmemiştir; önce örnek UETR ile
        (dosyanın sonundaki test sorgusu) doğrulayın.
   ===================================================================== */

DECLARE @Baslangic DATETIME = '20260501',
        @Bitis     DATETIME = '20260531',
        @BicN      INT      = 6;   -- Alıcı eşleşmesi: 6 = banka+ülke (önerilen)
                                   -- 8 = tam BIC8 (UNCRITM1/UNCRITMM gibi
                                   --     şube/pasif BIC farklarını kaçırır)
                                   -- 4 = banka grubu (REVOLT21/REVOGB2L gibi
                                   --     ülkeler arası grup bankaları yakalar)

IF OBJECT_ID('tempdb..#Base')    IS NOT NULL DROP TABLE #Base;
IF OBJECT_ID('tempdb..#UetrBen') IS NOT NULL DROP TABLE #UetrBen;
IF OBJECT_ID('tempdb..#Trk')     IS NOT NULL DROP TABLE #Trk;
IF OBJECT_ID('tempdb..#Txn')     IS NOT NULL DROP TABLE #Txn;

/* ---------------------------------------------------------------------
   1) Kapsamdaki mesaj satırları (mevcut filtre ve join'ler aynen)
   --------------------------------------------------------------------- */
SELECT
    sj.SwiftId, sj.UnitId, sj.ProductId, sj.ProductSubId, sj.MessageType,
    f.Name AS FlowName, sj.MTId, sj.Reference, sj.RelatedReference,
    exc.Reference AS ExchangeReference,
    gj.UETRValue, gj.FinView,
    sj.SenderBic, sj.ReceiverBic,
    cus.CustomerName AS CorrespondentBankName,
    excBen.BeneficiaryBIC, excBen.BeneficiaryBankName,
    sj.Currency, sj.Amount, sj.ValueDate, sj.SwiftStatus, sj.IsProcessed, sj.IsMX,
    sj.UserName, sj.HostName, sj.SystemDate, sj.HostIp, sj.Direction,
    sj.MessageTypeDetail, sj.MessageSubType
INTO #Base
FROM BOA.SWF.SwiftJournal sj WITH (NOLOCK)
LEFT JOIN BOA.SWF.GPIJournal gj WITH (NOLOCK) ON gj.SwiftId = sj.SwiftId
OUTER APPLY ( SELECT TOP 1 InstanceId
              FROM BOA.COR.vWorkflowJournal vw WITH (NOLOCK)
              WHERE vw.Reference IN (sj.Reference, sj.RelatedReference) ) vw
LEFT JOIN BOA.WFL.vInstance vi ON vi.InstanceId = vw.InstanceId
LEFT JOIN BOA.WFL.Flow f       ON f.FlowId = vi.FlowId
LEFT JOIN BOA.FRG.Exchange exc WITH (NOLOCK) ON exc.Reference IN (sj.Reference, sj.RelatedReference)
LEFT JOIN BOA.FRG.ExchangeTransfer excTra WITH (NOLOCK) ON excTra.ExchangeId = exc.ExchangeId
LEFT JOIN BOA.CUS.Customer cus WITH (NOLOCK) ON cus.Customerid = excTra.CorrBankAccount
LEFT JOIN BOA.FRG.ExchangeBeneficiary excBen WITH (NOLOCK) ON excBen.ExchangeId = exc.ExchangeId
WHERE sj.SystemDate >= @Baslangic
  AND sj.SystemDate <  @Bitis
  AND f.Name = 'Giden Transfer'
  AND ISNULL(gj.UETRValue, '') <> '';

CREATE INDEX IX_Base_UETR ON #Base (UETRValue);

/* ---------------------------------------------------------------------
   2) UETR başına alıcı banka BIC'i
   --------------------------------------------------------------------- */
SELECT UETRValue,
       MAX(NULLIF(LTRIM(RTRIM(BeneficiaryBIC)), '')) AS BeneficiaryBIC
INTO #UetrBen
FROM #Base
GROUP BY UETRValue;

CREATE UNIQUE CLUSTERED INDEX IX_UetrBen ON #UetrBen (UETRValue);

/* ---------------------------------------------------------------------
   3) Bu UETR'lere ait TÜM gpi mesajlarının ayrıştırılması
      (tarih filtresi YOK: 31 Mayıs sonrası gelen ACCC'ler de görülür)

      Tracker (MT199/299) gövdesi:
        :79://2605041301-0400      <- olay zamanı + saat dilimi
        //ACCC                     <- durum / neden kodu
        //CITIUS33XXX              <- BİLDİREN banka [/iletilen banka/yöntem]
        //USD1500,                 <- tutar
      gSRP mesajı:
        :79:/PDCR/S003             <- zaman damgası yok
   --------------------------------------------------------------------- */
SELECT
    gpi.UETRValue,
    sj2.SwiftId,
    sj2.SystemDate,
    CASE WHEN gpi.FinView LIKE '<BizData%' THEN 1 ELSE 0 END AS IsBizData,
    s2.Durum,
    CASE WHEN LEN(s3.AjanBIC) IN (8, 11)
          AND s3.AjanBIC LIKE '[A-Z][A-Z][A-Z][A-Z][A-Z][A-Z][A-Z0-9][A-Z0-9]%'
         THEN s3.AjanBIC END                                   AS BildirenBIC,
    CASE WHEN LEN(s4.IletilenBIC) IN (8, 11)
          AND s4.IletilenBIC LIKE '[A-Z][A-Z][A-Z][A-Z][A-Z][A-Z][A-Z0-9][A-Z0-9]%'
         THEN s4.IletilenBIC END                               AS IletilenBIC,
    z.OlayHam
INTO #Trk
FROM #UetrBen u
INNER JOIN BOA.SWF.GPIJournal gpi WITH (NOLOCK) ON gpi.UETRValue = u.UETRValue
INNER JOIN BOA.SWF.SwiftJournal sj2 WITH (NOLOCK) ON sj2.SwiftId = gpi.SwiftId
CROSS APPLY (SELECT F   = REPLACE(gpi.FinView, CHAR(13), '')) a
CROSS APPLY (SELECT p79 = NULLIF(CHARINDEX(':79:', a.F), 0)) b
CROSS APPLY (SELECT L1s = b.p79 + 4) c
CROSS APPLY (SELECT L1e = CHARINDEX(CHAR(10), a.F + CHAR(10), c.L1s)) d
CROSS APPLY (SELECT L2e = CHARINDEX(CHAR(10), a.F + CHAR(10), d.L1e + 1)) e
CROSS APPLY (SELECT L3e = CHARINDEX(CHAR(10), a.F + CHAR(10), e.L2e + 1)) g
CROSS APPLY (SELECT
                Line1 = LTRIM(RTRIM(SUBSTRING(a.F, c.L1s,     d.L1e - c.L1s))),
                Line2 = LTRIM(RTRIM(SUBSTRING(a.F, d.L1e + 1, e.L2e - d.L1e - 1))),
                Line3 = LTRIM(RTRIM(SUBSTRING(a.F, e.L2e + 1, g.L3e - e.L2e - 1)))) l
CROSS APPLY (SELECT IsTs = CASE WHEN l.Line1 LIKE '//[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][+-][0-9][0-9][0-9][0-9]%'
                                THEN 1 ELSE 0 END) t
CROSS APPLY (SELECT
                Durum = CASE WHEN t.IsTs = 1 THEN l.Line2 ELSE l.Line1 END,
                Ajan  = CASE WHEN t.IsTs = 1 AND l.Line3 LIKE '//%' THEN STUFF(l.Line3, 1, 2, '') END) s2
CROSS APPLY (SELECT
                AjanBIC = LEFT(s2.Ajan, CHARINDEX('/', s2.Ajan + '/') - 1),
                Kalan   = SUBSTRING(s2.Ajan, CHARINDEX('/', s2.Ajan + '/') + 1, 200)) s3
CROSS APPLY (SELECT IletilenBIC = LEFT(s3.Kalan, CHARINDEX('/', s3.Kalan + '/') - 1)) s4
CROSS APPLY (SELECT OlayHam = CASE WHEN t.IsTs = 1 THEN TRY_CONVERT(DATETIMEOFFSET(0),
                  '20' + SUBSTRING(l.Line1, 3, 2) + '-' + SUBSTRING(l.Line1, 5, 2) + '-' + SUBSTRING(l.Line1, 7, 2)
                + ' '  + SUBSTRING(l.Line1, 9, 2) + ':' + SUBSTRING(l.Line1, 11, 2) + ':00 '
                + SUBSTRING(l.Line1, 13, 3) + ':' + SUBSTRING(l.Line1, 16, 2)) END) z;

/* Olay zamanını TR saatine çevir + kalite kontrolü */
ALTER TABLE #Trk ADD OlayZamani DATETIME NULL, ZamanKaynagi VARCHAR(20) NULL;

UPDATE t
SET OlayZamani   = CASE WHEN q.Gecerli = 1 THEN q.OlayTR ELSE DATEADD(MINUTE, -3, t.SystemDate) END,
    ZamanKaynagi = CASE WHEN t.OlayHam IS NULL THEN 'SystemDate'
                        WHEN q.Gecerli = 1   THEN 'gpi :79:'
                        ELSE 'SystemDate (damga hatalı)' END
FROM #Trk t
CROSS APPLY (SELECT OlayTR = CAST(SWITCHOFFSET(t.OlayHam, '+03:00') AS DATETIME)) o
CROSS APPLY (SELECT Gecerli = CASE
        WHEN t.OlayHam IS NULL THEN 0
        -- yalnızca tarih gönderen bankalar (ör. 2026-05-14 00:00)
        WHEN DATEPART(HOUR, t.OlayHam) = 0 AND DATEPART(MINUTE, t.OlayHam) = 0
             AND DATEDIFF(MINUTE, o.OlayTR, t.SystemDate) > 60 THEN 0
        -- gelecekte ya da çok eskide kalan damgalar (2001 / 2028 gibi)
        WHEN o.OlayTR > DATEADD(HOUR, 1, t.SystemDate)  THEN 0
        WHEN o.OlayTR < DATEADD(DAY, -40, t.SystemDate) THEN 0
        ELSE 1 END) q;

UPDATE #Trk SET OlayZamani = SystemDate, ZamanKaynagi = 'SystemDate' WHERE IsBizData = 1;

CREATE INDEX IX_Trk_UETR ON #Trk (UETRValue, OlayZamani);

/* ---------------------------------------------------------------------
   4) UETR (işlem) seviyesinde metrikler
   --------------------------------------------------------------------- */
;WITH E AS (
    SELECT t.*,
           u.BeneficiaryBIC,
           CASE WHEN u.BeneficiaryBIC IS NOT NULL
                 AND LEFT(t.BildirenBIC, @BicN) = LEFT(u.BeneficiaryBIC, @BicN) THEN 1 ELSE 0 END AS BildirenAlici,
           CASE WHEN u.BeneficiaryBIC IS NOT NULL
                 AND LEFT(t.IletilenBIC, @BicN) = LEFT(u.BeneficiaryBIC, @BicN) THEN 1 ELSE 0 END AS IletilenAlici
    FROM #Trk t
    INNER JOIN #UetrBen u ON u.UETRValue = t.UETRValue
),
Agg AS (
    SELECT
        UETRValue,
        MAX(BeneficiaryBIC) AS BeneficiaryBIC,
        MIN(CASE WHEN IsBizData = 1 THEN OlayZamani END)                                       AS BizdenCikisTarihi,
        -- Gerçek final: ALICI bankanın ilk ACCC'si
        MIN(CASE WHEN IsBizData = 0 AND Durum = '//ACCC' AND BildirenAlici = 1 THEN OlayZamani END) AS AliciACCCTarihi,
        -- Aracı / muhabir ACCC'si (bilgi amaçlı)
        MIN(CASE WHEN IsBizData = 0 AND Durum = '//ACCC' AND BildirenAlici = 0 THEN OlayZamani END) AS AraciACCCTarihi,
        -- İlk RJCT (hangi bankadan gelirse)
        MIN(CASE WHEN IsBizData = 0 AND Durum LIKE '//RJCT%' THEN OlayZamani END)               AS RJCTTarihi,
        -- Alıcı bankaya ulaşma: alıcı banka bildiren VEYA iletilen banka olarak ilk göründüğü an
        MIN(CASE WHEN IsBizData = 0
                  AND (Durum LIKE '//ACSP%' OR Durum = '//ACCC' OR Durum LIKE '//RJCT%')
                  AND (BildirenAlici = 1 OR IletilenAlici = 1) THEN OlayZamani END)            AS BeneficiaryeUlasmaTarihi,
        -- gpi üyesi olmayan alıcıya iletim (G001 -> alıcı): takip burada biter
        MAX(CASE WHEN IsBizData = 0 AND Durum = '//ACSP/G001' AND IletilenAlici = 1 THEN 1 ELSE 0 END) AS GpiDisiAlici,
        MAX(CASE WHEN IsBizData = 0 THEN OlayZamani END)                                       AS SonMesajZamani
    FROM E
    GROUP BY UETRValue
)
SELECT
    a.*,
    rj.Durum        AS RJCTKodu,
    rj.BildirenBIC  AS RJCTBildirenBIC,
    ar.BildirenBIC  AS AraciACCCBIC,
    son.Durum       AS SonMesajKodu,
    son.BildirenBIC AS SonMesajBildirenBIC,
    d.IslemDurumu
INTO #Txn
FROM Agg a
OUTER APPLY (SELECT TOP 1 Durum, BildirenBIC FROM #Trk x
             WHERE x.UETRValue = a.UETRValue AND x.IsBizData = 0 AND x.Durum LIKE '//RJCT%'
             ORDER BY x.OlayZamani, x.SystemDate) rj
OUTER APPLY (SELECT TOP 1 x.BildirenBIC FROM #Trk x
             WHERE x.UETRValue = a.UETRValue AND x.IsBizData = 0 AND x.Durum = '//ACCC'
               AND (a.BeneficiaryBIC IS NULL OR ISNULL(LEFT(x.BildirenBIC, @BicN), '') <> LEFT(a.BeneficiaryBIC, @BicN))
             ORDER BY x.OlayZamani, x.SystemDate) ar
OUTER APPLY (SELECT TOP 1 Durum, BildirenBIC FROM #Trk x            -- akıştaki EN SON mesaj
             WHERE x.UETRValue = a.UETRValue AND x.IsBizData = 0 AND x.Durum IS NOT NULL
             ORDER BY x.OlayZamani DESC, x.SystemDate DESC) son
CROSS APPLY (SELECT IslemDurumu = CASE
        WHEN a.RJCTTarihi IS NOT NULL AND (a.AliciACCCTarihi IS NULL OR a.RJCTTarihi < a.AliciACCCTarihi) THEN 'REDDEDILDI'
        WHEN a.AliciACCCTarihi IS NOT NULL      THEN 'TAMAMLANDI'
        WHEN a.GpiDisiAlici = 1                 THEN 'GPI DISI ALICIYA ILETILDI'
        WHEN a.BeneficiaryeUlasmaTarihi IS NOT NULL THEN 'ALICI BANKADA BEKLIYOR'
        WHEN a.SonMesajZamani IS NOT NULL       THEN 'MUHABIR AGINDA'
        ELSE 'TAKIP MESAJI YOK' END) d;

CREATE UNIQUE CLUSTERED INDEX IX_Txn ON #Txn (UETRValue);

/* ---------------------------------------------------------------------
   5) Çıktı (mevcut kolonlar + yeni kolonlar)
   --------------------------------------------------------------------- */
SELECT
    b.UnitId, b.ProductId, b.ProductSubId, b.MessageType, b.FlowName, b.MTId,
    b.Reference, b.RelatedReference, b.ExchangeReference,

    x.BizdenCikisTarihi,
    f.SonMesajTarihi,
    x.BeneficiaryeUlasmaTarihi,

    DATEDIFF(MINUTE, x.BizdenCikisTarihi, f.SonMesajTarihi)          AS AnaIslemSuresiDakika,
    DATEDIFF(MINUTE, x.BizdenCikisTarihi, x.BeneficiaryeUlasmaTarihi) AS CorrespondentNetworkSuresiDakika,
    DATEDIFF(MINUTE, x.BeneficiaryeUlasmaTarihi, f.SonMesajTarihi)    AS BeneficiarySuresiDakika,

    b.UETRValue, b.FinView,

    -- Bu satırdaki mesajın kendi kodu (artık LIKE zinciri yerine ayrıştırılmış satır)
    CASE WHEN tr.IsBizData = 1 THEN NULL ELSE tr.Durum END              AS CurrentN99ReasonCode,
    tr.BildirenBIC                                                      AS CurrentBildirenBIC,
    tr.OlayZamani                                                       AS CurrentOlayZamani,

    x.SonMesajKodu                                                      AS LastN99ReasonCode,
    f.FinalN99ReasonCode,

    -- YENİ
    x.IslemDurumu,
    CASE WHEN x.IslemDurumu IN ('TAMAMLANDI', 'REDDEDILDI') THEN 1 ELSE 0 END AS IsFinal,
    f.FinalBildirenBIC,
    CASE WHEN x.AraciACCCTarihi IS NOT NULL THEN 1 ELSE 0 END           AS AraciACCCVar,
    x.AraciACCCBIC,
    x.AraciACCCTarihi,

    b.SenderBic, b.ReceiverBic, b.CorrespondentBankName,
    b.BeneficiaryBIC, b.BeneficiaryBankName,
    b.Currency, b.Amount, b.ValueDate, b.SwiftStatus, b.IsProcessed, b.IsMX,
    b.UserName, b.HostName, b.SystemDate, b.HostIp, b.Direction,
    b.MessageTypeDetail, b.MessageSubType
FROM #Base b
LEFT JOIN #Txn x  ON x.UETRValue = b.UETRValue
LEFT JOIN #Trk tr ON tr.SwiftId  = b.SwiftId AND tr.UETRValue = b.UETRValue
CROSS APPLY (SELECT
    FinalN99ReasonCode = CASE x.IslemDurumu
                            WHEN 'REDDEDILDI' THEN x.RJCTKodu
                            WHEN 'TAMAMLANDI' THEN '//ACCC'
                            ELSE x.SonMesajKodu END,          -- final değilse: akıştaki son mesajın kodu
    SonMesajTarihi     = CASE x.IslemDurumu
                            WHEN 'REDDEDILDI' THEN x.RJCTTarihi
                            WHEN 'TAMAMLANDI' THEN x.AliciACCCTarihi   -- alıcının İLK ACCC'si
                            ELSE x.SonMesajZamani END,       -- final değilse: son gelen mesaj
    FinalBildirenBIC   = CASE x.IslemDurumu
                            WHEN 'REDDEDILDI' THEN x.RJCTBildirenBIC
                            WHEN 'TAMAMLANDI' THEN x.BeneficiaryBIC
                            ELSE x.SonMesajBildirenBIC END) f
ORDER BY b.SystemDate DESC;

/* =====================================================================
   TEST: Örnek işlem (e9e6d6e2-aa87-4c36-979a-a3282353687e)
   Beklenen sonuç:
     IslemDurumu              = ALICI BANKADA BEKLIYOR   (IsFinal = 0)
     FinalN99ReasonCode       = //ACSP/G002   (IIBAJOAMXXX, 07/05)
     SonMesajTarihi           = 07/05/2026 14:58  (:79: 11:58 UTC)
     AraciACCCVar = 1, AraciACCCBIC = CITIUS33XXX, AraciACCCTarihi = 04/05/2026 20:01
     BeneficiaryeUlasmaTarihi = 04/05/2026 17:40  (G001 IRVTUS3N -> IIBAJOAM, 14:40 UTC)

   Ayrıştırmayı kontrol etmek için 3. adımdan sonra:
     SELECT SystemDate, Durum, BildirenBIC, IletilenBIC, OlayZamani, ZamanKaynagi
     FROM #Trk WHERE UETRValue = 'e9e6d6e2-aa87-4c36-979a-a3282353687e'
     ORDER BY OlayZamani;
   ===================================================================== */
