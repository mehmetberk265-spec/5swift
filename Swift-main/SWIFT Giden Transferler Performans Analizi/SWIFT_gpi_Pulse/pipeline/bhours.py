import pandas as pd,numpy as np,json
C=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'countries.json')))
TZOFF={'TR':3,'US':-4,'GB':1,'DE':2,'FR':2,'IT':2,'ES':2,'NL':2,'BE':2,'AT':2,'CH':2,'PL':2,'CZ':2,'GR':3,'BG':3,'RO':3,'LT':3,'UA':3,'GE':4,'AZ':4,'AE':4,'OM':4,'SA':3,'KW':3,'QA':3,'BH':3,'JO':3,'IQ':3,'EG':3,'PS':3,'IL':3,'LB':3,'IR':3.5,'PK':5,'IN':5.5,'BD':6,'UZ':5,'KZ':5,'CN':8,'HK':8,'TW':8,'SG':8,'MY':8,'ID':7,'TH':7,'VN':7,'KR':9,'JP':9,'AU':10,'CA':-4,'MX':-6,'BR':-3,'ZA':2,'MA':1,'DZ':1,'TN':1,'LY':2,'NG':1,'KE':3,'TZ':3,'ET':3,'RU':3,'IE':1,'PT':1,'SE':2,'DK':2,'NO':2,'FI':3,'HU':2,'RS':2,'BA':2,'MK':2,'AL':2,'XK':2,'HR':2,'SI':2,'SK':2,'CY':3,'MT':2,'LU':2,'EE':3,'LV':3,'MD':3,'BY':3,'AM':4,'TM':5,'KG':6,'TJ':5,'AF':4.5,'LK':5.5,'NP':5.75,'PH':8,'NZ':12}
FRISAT={'SA','KW','QA','BH','OM','JO','IQ','EG','PS','DZ','LY','YE','SD','SY','AF','IR','BD'}
def off(cc):
    if cc in TZOFF: return TZOFF[cc]
    c=C.get(cc); return round(c['ll'][1]/15) if c else 0
def bus_minutes(s,e,ctry,h0=9,h1=18):
    """alıcı ülke yerel mesai saatleri (09-18, yerel hafta sonu hariç) içindeki dakikalar"""
    o=ctry.map(off).values
    ok=s.notna().values&e.notna().values
    res=np.full(len(s),np.nan)
    S=((s[ok]-pd.Timestamp('2026-01-01',tz='UTC')).dt.total_seconds()/60).values+o[ok]*60   # yerel dakika
    E=((e[ok]-pd.Timestamp('2026-01-01',tz='UTC')).dt.total_seconds()/60).values+o[ok]*60
    fs=np.isin(ctry.values[ok],list(FRISAT))
    out=np.zeros(ok.sum())
    d0=int(np.floor(S.min()/1440)); d1=int(np.ceil(E.max()/1440))
    for d in range(d0,d1+1):
        dow=(3+d)%7  # 2026-01-01 Perşembe -> Mon=0
        a=d*1440+h0*60; b=d*1440+h1*60
        wk=np.where(fs,dow in (4,5),dow in (5,6))
        out+=np.where(wk,0,np.clip(np.minimum(E,b)-np.maximum(S,a),0,None))
    res[ok]=out; return res
