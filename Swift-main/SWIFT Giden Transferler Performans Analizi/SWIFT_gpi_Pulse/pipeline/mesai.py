"""Mesai içi süre: her ayak kendi bankasının ülke saatine göre ölçülür.
Mesai: yerel 09:00-18:00, yerel hafta sonu ve resmi tatiller hariç."""
import numpy as np, pandas as pd, datetime as dt
from bhours import off, FRISAT
HOL = {  # 2026 Mayıs-Temmuz resmi tatiller (tam gün; TR 26 May arife yarım gün → 13:00 sonrası)
 'TR': ['2026-05-01', '2026-05-19', '2026-05-27', '2026-05-28', '2026-05-29', '2026-07-15'],
 'US': ['2026-05-25', '2026-06-19', '2026-07-03'],
 'DE': ['2026-05-01', '2026-05-14', '2026-05-25'],
 'GB': ['2026-05-04', '2026-05-25'],
 'FR': ['2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14'],
 'AT': ['2026-05-01', '2026-05-14', '2026-05-25', '2026-06-04'],
 'IT': ['2026-06-02'],
}
HALF = {('TR', '2026-05-26'): 13}   # arife: mesai 13:00'te biter
EPOCH = dt.date(2026, 1, 1)
def _di(s): return (dt.date.fromisoformat(s) - EPOCH).days
HOLD = {}
for c, ds in HOL.items():
    for d in ds: HOLD.setdefault(_di(d), set()).add(c)
def mesai_minutes(s, e, ctry, h0=9, h1=18):
    ctry = pd.Series(ctry).reset_index(drop=True); s = pd.Series(s).reset_index(drop=True); e = pd.Series(e).reset_index(drop=True)
    o = ctry.map(off).values
    ok = s.notna().values & e.notna().values
    res = np.full(len(s), np.nan)
    if not ok.any(): return res
    base = pd.Timestamp('2026-01-01', tz='UTC')
    S = ((s[ok] - base).dt.total_seconds() / 60).values + o[ok] * 60
    E = ((e[ok] - base).dt.total_seconds() / 60).values + o[ok] * 60
    cc = ctry.values[ok]; fs = np.isin(cc, list(FRISAT))
    out = np.zeros(ok.sum())
    for d in range(int(np.floor(S.min() / 1440)), int(np.ceil(E.max() / 1440)) + 1):
        dow = (3 + d) % 7  # 2026-01-01 Perşembe; Pzt=0
        a = d * 1440 + h0 * 60; b = d * 1440 + h1 * 60
        wk = np.where(fs, dow in (4, 5), dow in (5, 6))
        hol = np.isin(cc, list(HOLD.get(d, ())))
        bb = np.full(len(S), b, dtype=float)
        for (c, ds), hh in HALF.items():
            if _di(ds) == d: bb = np.where(cc == c, d * 1440 + hh * 60, bb)
        out += np.where(wk | hol, 0, np.clip(np.minimum(E, bb) - np.maximum(S, a), 0, None))
    res[ok] = out
    return res
