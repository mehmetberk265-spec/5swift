import pandas as pd, numpy as np
TZ='UTC+03:00'
TR_HOL=[('2026-05-01',0),('2026-05-19',0),('2026-05-26',13),('2026-05-27',0),('2026-05-28',0),('2026-05-29',0),('2026-05-30',0),('2026-07-15',0)]
US_HOL=['2026-05-25','2026-06-19','2026-07-03']
def excl_intervals(ccy,ctry):
    iv=[]
    if ctry=='TR':
        for d,h in TR_HOL:
            s=pd.Timestamp(d,tz=TZ)+pd.Timedelta(hours=h); iv.append((s,pd.Timestamp(d,tz=TZ)+pd.Timedelta(days=1)))
    if ccy=='USD':
        for d in US_HOL: iv.append((pd.Timestamp(d,tz=TZ)+pd.Timedelta(hours=7),pd.Timestamp(d,tz=TZ)+pd.Timedelta(days=1,hours=7)))  # NY günü ≈ TR 07:00-07:00
    return iv
WK0=pd.Timestamp('2026-01-03',tz=TZ)  # Saturday
def weekend_minutes(s,e):
    """[s,e) aralığında Cmt+Paz (TR saati) dakikaları — vektörel"""
    tot=np.zeros(len(s))
    S=((s-WK0).dt.total_seconds()/60).values; Ee=((e-WK0).dt.total_seconds()/60).values
    W=7*1440
    for k in range(-1,40):
        a=k*W; b=a+2*1440
        tot+=np.clip(np.minimum(Ee,b)-np.maximum(S,a),0,None)
    return tot
def holiday_minutes(s,e,ccy,ctry):
    out=np.zeros(len(s))
    for (c,k),idx in pd.DataFrame({'c':ccy.values,'k':ctry.values}).groupby(['c','k']).groups.items():
        iv=excl_intervals(c,k)
        if not iv: continue
        ss=s.iloc[idx]; ee=e.iloc[idx]
        for a,b in iv:
            if a.dayofweek>=5: continue
            out[idx]+=np.clip(np.minimum(ee,b)-np.maximum(ss,a),pd.Timedelta(0),None).dt.total_seconds().values/60 if False else np.clip(((np.minimum(ee,b)-np.maximum(ss,a)).dt.total_seconds()/60).values,0,None)
    return out
def biz_minutes(s,e,ccy,ctry):
    m=((e-s).dt.total_seconds()/60).values
    ok=~np.isnan(m)
    r=np.full(len(m),np.nan)
    if ok.any():
        ss=s[ok].reset_index(drop=True); ee=e[ok].reset_index(drop=True)
        r[ok]=m[ok]-weekend_minutes(ss,ee)-holiday_minutes(ss,ee,ccy[ok].reset_index(drop=True),ctry[ok].reset_index(drop=True))
    return np.clip(r,0,None)
