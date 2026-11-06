import pandas as pd, numpy as np, json
D=pd.read_pickle('final.pkl'); T=pd.read_pickle('trk2.pkl'); E=pd.read_pickle('events.pkl'); raw=pd.read_pickle('raw.pkl')
C=json.load(open('countries.json')); M=json.load(open('model.json'))
TZ='UTC+03:00'; BASE=pd.Timestamp('2026-05-01',tz=TZ)
emin=lambda s:((s-BASE).dt.total_seconds()/60).round(1)
D=D[D.t0>=BASE].copy()   # Mayıs öncesi gönderimler kapsam dışı
names={}
for bic,nm in raw[['BeneficiaryBIC','BeneficiaryBankName']].drop_duplicates().values:
    if bic and nm: names.setdefault(bic[:8],nm.strip())
for bic,nm in raw[raw.Direction=='I'][['ReceiverBic','CorrespondentBankName']].drop_duplicates().values:
    if bic and nm and bic[:8] not in names: names[bic[:8]]=nm.strip()
KNOWN=eval(open('v1/export.py').read().split('KNOWN=')[1].split('\nfor k,v in KNOWN')[0])
for k,v in KNOWN.items(): names.setdefault(k,v)
names['TCZBTR2A']='TC ZIRAAT BANKASI A.S.'
def cname(cc):
    x=C.get(cc)
    if not x: return cc
    n=x['n']; return ('İ'+n[1:]) if n[0]=='i' else n[0].upper()+n[1:]
banks={}
def bidx(b):
    if not isinstance(b,str) or not b: return -1
    k=b[:8]
    if k not in banks: banks[k]=len(banks)
    return banks[k]
STATES=['ACCC','RJCT','PEND_BEN','NONGPI','ACC_INT','IN_NET','NO_TRK']; TYPES=['Direct Payment','Cover (COV)']
ccys=sorted(D.ccy.dropna().unique()); ci={c:i for i,c in enumerate(ccys)}
routes={}
def ridx(r):
    r=r if isinstance(r,str) else ''
    if r not in routes: routes[r]=len(routes)
    return routes[r]
f=lambda x,nd=0: None if pd.isna(x) else (round(float(x),nd) if nd else int(round(float(x))))
D=D.sort_values('t0'); D['i']=range(len(D))
t0m=emin(D.t0); stm=emin(D.start); vdd=((D.vd-BASE).dt.total_seconds()/86400)
rows=[]
for (u,r),a,b,v in zip(D.iterrows(),t0m,stm,vdd):
    rows.append([a,b,ci.get(r.ccy,-1),f(r.amt,2),bidx(r.instd),bidx(r.ben),r.ctry,TYPES.index(r.type),r.chrgbr or '',STATES.index(r.state),
      f(r.tot),f(r.net),f(r.benm),f(r.totM),f(r.netM),f(r.benM),f(r.totS),f(r.netS),f(r.benS),
      ridx(r.route),r.last_st if isinstance(r.last_st,str) else '',r.pend if isinstance(r.pend,str) else '',r.rj_rsn if isinstance(r.rj_rsn,str) else '',
      f(r.fee,2),f(r.cred_amt,2),int(bool(r.recall)),f(r.c_tot),f(r.c_net),f(r.c_ben),(r.c_final or '').replace('//',''),u,r.ref,int(r.bad_ts) if pd.notna(r.bad_ts) else 0,r.ben,
      int(r.vstat),int(bool(r.late_csv)),f(v),1 if r.nosplit else (2 if r.reach_fix else 0),f(r.age)])
E2=T[T.uetr.isin(D.index)].merge(D[['i']],left_on='uetr',right_index=True); E2['tm']=emin(E2.t)
ev={}
for r in E2.sort_values(['i','t']).itertuples():
    ev.setdefault(int(r.i),[]).append([r.tm,r.st+('/'+r.rsn if isinstance(r.rsn,str) else ''),bidx(r.rep) if isinstance(r.rep,str) else -1,bidx(r.fwd) if isinstance(r.fwd,str) else -1,round(r.fee,2) if r.fee else 0,r.tsq,round(r.lag) if pd.notna(r.lag) else None])
bl=[None]*len(banks)
for k,i in banks.items(): bl[i]=[k,names.get(k,'')]
used=sorted(set(D.ctry)|{b[4:6] for b in banks})
cmeta={cc:{'n':cname(cc),'ll':C[cc]['ll'],'num':C[cc]['num'],'reg':C[cc]['reg']} for cc in used if cc in C}
rl=[None]*len(routes)
for k,i in routes.items(): rl[i]=k
A=D[D.state=='ACCC']
Tq=T[T.ts.notna()].copy(); Tq['dow']=Tq.ts.dt.dayofweek
craw=raw.drop_duplicates('UETRValue')
dq=dict(rows_csv=int(len(raw)+180),dup_rows=180,msgs_unique=int(len(raw)),uetr_csv=int(raw.UETRValue.nunique()),txn=int(len(D)),
  sci_ref=int(raw.Reference.str.contains(r'E\+').sum()),
  csv_accc_not_ben=int(((D.c_final=='//ACCC')&(D.state!='ACCC')).sum()),
  csv_accc_not_ben_br=D[(D.c_final=='//ACCC')&(D.state!='ACCC')].state.value_counts().to_dict(),
  csv_neg_tot=int((D.c_tot<0).sum()),vstat=D.vstat.value_counts().to_dict(),late_csv=int(D.late_csv.sum()),
  lag_wd=float(Tq[Tq.dow<5].lag.median()),lag_sat=float(Tq[Tq.dow==5].lag.median()),lag_sun=float(Tq[Tq.dow==6].lag.median()),
  tsq=T.tsq.value_counts().to_dict(),tsq_rep=T[T.tsq!='ok'].rep.str[:8].value_counts().head(8).to_dict(),
  fut_rep=T[T.tsq=='ileri-tarihli'].rep.str[:8].value_counts().head(6).to_dict(),
  pdcr=int((T.st=='PDCR').sum()),multiple_accc=int((E[E.st=='ACCC'].groupby('uetr').size()>1).sum()),
  mean_cal=float(A.tot.mean()),mean_mesai=float(A.totM.mean()),mean_swift=float(A.totS.mean()),mean_csv=float(A.c_tot[A.c_tot>=0].mean()),
  mean_t0=float(A.tot_raw.mean()),nosplit=int(D.nosplit.sum()),reach_fix=int(D.reach_fix.sum()),zero_net=int((A.net<=0.05).sum()),zero_ben=int((A.benm<=0.05).sum()),acc_n=int(len(A)))
DEND=pd.to_datetime(raw.SystemDate,format='%d/%m/%Y %H:%M').max()
meta=dict(base='2026-05-01T00:00:00+03:00',dataEnd=DEND.strftime('%Y-%m-%dT%H:%M:00+03:00'),states=STATES,types=TYPES,ccys=ccys,banks=bl,countries=cmeta,routes=rl,model=M,dq=dq,generated=pd.Timestamp.now().isoformat())
open('data.js','w').write('window.SWIFT_META='+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\nwindow.SWIFT_TX='+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n')
open('events.js','w').write('window.SWIFT_EV='+json.dumps(ev,separators=(',',':'))+';\n')
print(len(rows),len(banks),len(routes)); print(json.dumps(dq,ensure_ascii=False)[:1500])
