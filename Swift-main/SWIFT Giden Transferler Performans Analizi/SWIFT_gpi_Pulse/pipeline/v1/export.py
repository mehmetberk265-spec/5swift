import pandas as pd, numpy as np, json, re
D=pd.read_pickle('final.pkl'); E=pd.read_pickle('events.pkl'); T=pd.read_pickle('trk2.pkl'); raw=pd.read_pickle('raw.pkl')
C=json.load(open('countries.json')); M=json.load(open('model.json'))
BASE=pd.Timestamp('2026-05-01 00:00',tz='UTC+03:00')
def emin(s): return ((s-BASE).dt.total_seconds()/60).round(1)
# bank names
names={}
b=raw[['BeneficiaryBIC','BeneficiaryBankName']].drop_duplicates()
for bic,nm in b.values:
    if bic and nm: names.setdefault(bic[:8],nm.strip())
p=raw[raw.Direction=='I'][['ReceiverBic','CorrespondentBankName']].drop_duplicates()
for bic,nm in p.values:
    if bic and nm and bic[:8] not in names: names[bic[:8]]=nm.strip()
KNOWN={'CHASUS33':'JPMORGAN CHASE BANK - NEW YORK','CITIUS33':'CITIBANK N.A. - NEW YORK','IRVTUS3N':'THE BANK OF NEW YORK MELLON - NEW YORK','MRMDUS33':'HSBC BANK USA - NEW YORK',
'SCBLUS33':'STANDARD CHARTERED BANK - NEW YORK','PNBPUS3N':'WELLS FARGO BANK - NEW YORK','BOFAUS3N':'BANK OF AMERICA - NEW YORK','DEUTUS33':'DEUTSCHE BANK TRUST CO. AMERICAS','CHASGB2L':'JPMORGAN CHASE BANK - LONDON',
'CHASDEFX':'J.P. MORGAN SE - FRANKFURT','DEUTDEFF':'DEUTSCHE BANK AG - FRANKFURT','COBADEFF':'COMMERZBANK AG - FRANKFURT','CITIGB2L':'CITIBANK N.A. - LONDON','BKTRUS33':'DEUTSCHE BANK TRUST CO - NEW YORK',
'REVOGB2L':'REVOLUT LTD - LONDON','KTEFTRIS':'KUVEYT TURK KATILIM BANKASI','KTAGDEFF':'KT BANK AG - FRANKFURT','SCBLHKHH':'STANDARD CHARTERED BANK - HONG KONG','HSBCHKHH':'HSBC - HONG KONG','BKCHCNBJ':'BANK OF CHINA','ICBKCNBJ':'ICBC - BEIJING','PCBCCNBJ':'CHINA CONSTRUCTION BANK','ABOCCNBJ':'AGRICULTURAL BANK OF CHINA','COMMCNSH':'BANK OF COMMUNICATIONS',
'UNCRITMM':'UNICREDIT S.P.A. - MILANO','BCITITMM':'INTESA SANPAOLO - MILANO','MIDLGB22':'HSBC UK BANK - LONDON','BARCGB22':'BARCLAYS BANK - LONDON','NWBKGB2L':'NATWEST - LONDON','LOYDGB2L':'LLOYDS BANK - LONDON',
'SBININBB':'STATE BANK OF INDIA','HDFCINBB':'HDFC BANK','ICICINBB':'ICICI BANK','CITITRIX':'CITIBANK - ISTANBUL','RZBAATWW':'RAIFFEISEN BANK INTERNATIONAL - VIENNA','CCFRFRPP':'HSBC CONTINENTAL EUROPE - PARIS','SOGEFRPP':'SOCIETE GENERALE - PARIS','BNPAFRPP':'BNP PARIBAS - PARIS'}
for k,v in KNOWN.items(): names.setdefault(k,v)
def cname(cc):
    x=C.get(cc); 
    if not x: return cc
    n=x['n']; return n[0].upper().replace('i','İ') + n[1:] if n[0]=='i' else n[0].upper()+n[1:]
banks={}
def bidx(bic):
    if not isinstance(bic,str) or not bic: return -1
    k=bic[:8]
    if k not in banks: banks[k]=len(banks)
    return banks[k]
STATES=['ACCC','RJCT','PEND_BEN','NONGPI','ACC_INT','IN_NET','NO_TRK']
TYPES=['Müşteri Transferi','Cover (COV)','FI Transfer']
ccys=sorted(D.ccy.dropna().unique()); ci={c:i for i,c in enumerate(ccys)}
routes={}
def ridx(r):
    r=r if isinstance(r,str) else ''
    if r not in routes: routes[r]=len(routes)
    return routes[r]
D=D.sort_values('t0'); D['i']=range(len(D))
def f(x,nd=0):
    return None if pd.isna(x) else (round(float(x),nd) if nd else int(round(float(x))))
rows=[]
t0=emin(D.t0); 
for (u,r),tt in zip(D.iterrows(),t0):
    rows.append([tt, ci.get(r.ccy,-1), f(r.amt,2), bidx(r.instd), bidx(r.ben), r.ctry, TYPES.index(r.type), r.chrgbr or '', STATES.index(r.state),
      f(r.tot), f(r.net), f(r.benm), ridx(r.route), r.last_st if isinstance(r.last_st,str) else '', r.pend if isinstance(r.pend,str) else '', r.rj_rsn if isinstance(r.rj_rsn,str) else '',
      f(r.fee,2), f(r.cred_amt,2), int(bool(r.recall)), f(r.c_tot), f(r.c_net), f(r.c_ben), (r.c_final or '').replace('//',''), u, r.ref, int(r.bad_ts) if pd.notna(r.bad_ts) else 0, r.ben])
# events
E2=T[T.uetr.isin(D.index)].copy(); E2=E2.merge(D[['i']],left_on='uetr',right_index=True)
E2['tm']=emin(E2.t)
ev={}
for r in E2.sort_values(['i','t']).itertuples():
    ev.setdefault(int(r.i),[]).append([r.tm, r.st+('/'+r.rsn if isinstance(r.rsn,str) else ''), bidx(r.rep) if isinstance(r.rep,str) else -1, bidx(r.fwd) if isinstance(r.fwd,str) else -1, round(r.fee,2) if r.fee else 0, r.tsq, round(r.lag) if pd.notna(r.lag) else None])
for k in list(banks): names.setdefault(k,'')
bl=[None]*len(banks)
for k,i in banks.items(): bl[i]=[k,names.get(k,'')]
ctry_used=sorted(set(D.ctry)|{b[4:6] for b in banks})
cmeta={cc:{'n':cname(cc),'ll':C[cc]['ll'],'num':C[cc]['num'],'reg':C[cc]['reg']} for cc in ctry_used if cc in C}
rl=[None]*len(routes)
for k,i in routes.items(): rl[i]=k
meta=dict(base='2026-05-01T00:00:00+03:00',dataEnd='2026-05-29T23:59:00+03:00',states=STATES,types=TYPES,ccys=ccys,banks=bl,countries=cmeta,routes=rl,model=M,
  cols=['t0','ccy','amt','corr','ben','ctry','type','chrgbr','state','tot','net','benm','route','last','pend','rjrsn','fee','cred','recall','c_tot','c_net','c_ben','c_final','uetr','ref','badts','benbic'],
  generated=pd.Timestamp.now().isoformat())
# data quality summary
A=D[D.state=='ACCC']; both=A[A.c_tot.notna()]; d=both.c_tot-both.tot
Tq=T[T.ts.notna()].copy(); Tq['dow']=Tq.ts.dt.dayofweek
dq=dict(rows_csv=int(len(raw)),msgs_unique=int(raw.MTId.nunique()),dup_rows=int(len(raw)-raw.MTId.nunique()),uetr_csv=int(raw.UETRValue.nunique()),txn=int(len(D)),
  uetr_no_out=int(raw.UETRValue.nunique()-len(D)-int((raw.UETRValue.isin(D.index)==False).sum()*0)),
  sci_ref=int(raw.Reference.str.contains('E\\+').sum()),
  csv_accc_not_ben=int(((D.c_final=='//ACCC')&(D.state!='ACCC')).sum()),
  csv_accc_not_ben_br=D[(D.c_final=='//ACCC')&(D.state!='ACCC')].state.value_counts().to_dict(),
  over_med=round(float(d.median()),1),over_mean=round(float(d.mean()),1),over60=round(float((d>60).mean()),4),over1d=round(float((d>1440).mean()),4),
  csv_neg_ben=int((pd.to_numeric(raw.BeneficiarySuresiDakika,errors='coerce')<0).sum()),
  sonmesaj_after_window=int((pd.to_datetime(raw.drop_duplicates('UETRValue').SonMesajTarihi,format='%d/%m/%Y %H:%M')>'2026-05-31').sum()),
  lag_wd=float(Tq[Tq.dow<5].lag.median()),lag_sat=float(Tq[Tq.dow==5].lag.median()),lag_sun=float(Tq[Tq.dow==6].lag.median()),
  tsq=T.tsq.value_counts().to_dict(), tsq_rep=T[T.tsq!='ok'].rep.str[:8].value_counts().head(8).to_dict(),
  pdcr=int((T.st=='PDCR').sum()), multiple_accc=int((E[E.st=='ACCC'].groupby('uetr').size()>1).sum()))
dq['uetr_no_out']=int(raw.UETRValue.nunique()-raw[raw.UETRValue.isin(D.index)].UETRValue.nunique())
meta['dq']=dq
js='window.SWIFT_META='+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\nwindow.SWIFT_TX='+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n'
open('data.js','w').write(js)
open('events.js','w').write('window.SWIFT_EV='+json.dumps(ev,separators=(',',':'))+';\n')
print(len(js)/1e6,'MB', len(rows), len(banks), len(routes)); print(json.dumps(dq,ensure_ascii=False,indent=0)[:2000])
