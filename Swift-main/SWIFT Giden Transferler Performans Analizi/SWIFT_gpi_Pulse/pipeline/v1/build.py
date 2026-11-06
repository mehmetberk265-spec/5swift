import pandas as pd, numpy as np, json, re
O=pd.read_pickle('out.pkl');T=pd.read_pickle('trk.pkl');X=pd.read_pickle('oth.pkl');raw=pd.read_pickle('raw.pkl')
C=json.load(open('countries.json'))
DATA_END=pd.Timestamp('2026-05-29 23:59',tz='UTC+03:00')
# ---------- outgoing primary
O['prio']=O.mt.map({'pacs.008':0,'103':1,'pacs.009':2,'202COV':3})
O=O.sort_values(['uetr','prio','cre'])
P=O.groupby('uetr').first()
P['t0']=O.groupby('uetr').cre.min()
mts=O.groupby('uetr').mt.apply(set)
P['has_cov']=mts.apply(lambda s:'pacs.008' in s and 'pacs.009' in s)
P['ben']=P.cdtragt.fillna(P.csv_benbic).replace('',np.nan)
P=P[P.ben.notna()]
P['ben4']=P.ben.str[:4]; P['ben6']=P.ben.str[:6]
P['ctry']=P.ben.str[4:6]
P['type']=np.where(P.mt=='pacs.009','FI Transfer',np.where(P.has_cov,'Cover (COV)','Müşteri Transferi'))
# ---------- tracker timestamps
T=T[T.uetr.isin(P.index)].copy()
T=T.merge(P[['t0','ben4','ben6']],left_on='uetr',right_index=True)
dateonly=T.ts.notna()&(T.ts.dt.hour==0)&(T.ts.dt.minute==0)&((T.sysdate-T.ts).dt.total_seconds()>3600)
bad=T.ts.isna()|dateonly|((T.sysdate-T.ts).dt.total_seconds()<-3600)|((T.sysdate-T.ts).dt.total_seconds()>40*86400)|(T.ts<T.t0-pd.Timedelta(minutes=2))
T['tsq']=np.where(T.ts.isna(),'yok',np.where(dateonly,'sadece-tarih',np.where(bad,'tutarsız','ok')))
T['t']=T.ts.where(~bad,T.sysdate-pd.Timedelta(minutes=3))
T['t']=T[['t','t0']].max(axis=1)
T['rep4']=T.rep.str[:4];T['rep6']=T.rep.str[:6];T['fwd6']=T.fwd.str[:6];T['fwd4']=T.fwd.str[:4]
T['lag']=(T.sysdate-T.ts).dt.total_seconds()/60
T=T.sort_values(['uetr','t','sysdate'])
E=T[T.st.isin(['ACSP','ACCC','RJCT'])].copy()
E['isben_rep']=(E.rep6==E.ben6)|((E.rep4==E.ben4)&(E.st.isin(['ACCC','RJCT'])|E.rsn.isin(['G002','G003','G004'])))
E['isben_fwd']=(E.fwd6==E.ben6)
E['reach']=E.isben_rep|E.isben_fwd
E['acc_ben']=(E.st=='ACCC')&((E.rep4==E.ben4))
E['acc_oth']=(E.st=='ACCC')&~E.acc_ben
E['rj']=E.st=='RJCT'
g=E.groupby('uetr')
A=pd.DataFrame({'n_trk':g.size(),'t_first':g.t.min()})
for col in ['reach','acc_ben','acc_oth','rj']:
    A['t_'+col]=E[E[col]].groupby('uetr').t.min()
fr=E[E.rj].groupby('uetr').first(); A['rj_rsn']=fr.rsn; A['rj_bic']=fr.rep
fo=E[E.acc_oth].groupby('uetr').first(); A['acc_oth_bic']=fo.rep
fb=E[E.acc_ben].groupby('uetr').first(); A['cred_amt']=fb.amt; A['cred_ccy']=fb.ccy
la=g.last(); A['last_st']=la.st+la.rsn.fillna('').map(lambda x:'/'+x if x else ''); A['last_rep']=la.rep; A['t_last']=la.t
A['g001_ben']=E[(E.rsn=='G001')&E.isben_fwd].groupby('uetr').t.min()
A['pend']=E[E.isben_rep&E.rsn.isin(['G002','G003','G004'])].groupby('uetr').rsn.agg(lambda s:','.join(sorted(set(s))))
A['fee']=g.fee.sum(); A['fee_n']=g.nfee.sum()
A['bad_ts']=g.tsq.agg(lambda s:(s!='ok').sum())
# route
def route(df):
    seen=[]
    for a,b in zip(df.rep,df.fwd):
        for x in (a,b):
            if isinstance(x,str) and len(x)>=8:
                k=x[:8]
                if k[:4] not in('KTEF','TRCK') and k not in seen: seen.append(k)
    return '>'.join(seen)
A['route']=g[['rep','fwd']].apply(route)
D=P.join(A)
D['recall']=D.index.isin(X[X.mt.isin(['camt.056','196'])].uetr)|D.index.isin(T[T.st=='PDCR'].uetr)
def state(r):
    if pd.notna(r.t_rj) and (pd.isna(r.t_acc_ben) or r.t_rj<r.t_acc_ben): return 'RJCT'
    if pd.notna(r.t_acc_ben): return 'ACCC'
    if pd.notna(r.g001_ben): return 'NONGPI'
    if pd.notna(r.t_reach): return 'PEND_BEN'
    if pd.notna(r.t_acc_oth): return 'ACC_INT'
    if r.n_trk>0: return 'IN_NET'
    return 'NO_TRK'
D['n_trk']=D.n_trk.fillna(0)
D['state']=D.apply(state,axis=1)
D['t_reach']=D[['t_reach','g001_ben']].min(axis=1)
D.loc[(D.state=='ACCC'),'t_reach']=D.loc[D.state=='ACCC',['t_reach','t_acc_ben']].min(axis=1)
D['t_end']=np.where(D.state=='ACCC',D.t_acc_ben,np.where(D.state=='RJCT',D.t_rj,pd.NaT))
D['t_end']=pd.to_datetime(D.t_end)
mi=lambda a,b:(a-b).dt.total_seconds()/60
D['tot']=mi(D.t_end,D.t0); D['net']=mi(D.t_reach,D.t0); D['benm']=mi(D.t_end,D.t_reach)
D['age']=mi(pd.Series(DATA_END,index=D.index),D.t0)
# csv
c=raw.drop_duplicates('UETRValue').set_index('UETRValue')
for k,v in {'AnaIslemSuresiDakika':'c_tot','CorrespondentNetworkSuresiDakika':'c_net','BeneficiarySuresiDakika':'c_ben'}.items(): D[v]=pd.to_numeric(c[k],errors='coerce').reindex(D.index)
D['c_final']=c.FinalN99ReasonCode.reindex(D.index)
D['corr_name']=c.CorrespondentBankName.reindex(D.index)
D['ben_name']=c.BeneficiaryBankName.reindex(D.index)
D.to_pickle('final.pkl'); E.to_pickle('events.pkl'); T.to_pickle('trk2.pkl')
print(D.state.value_counts()); print(D[D.state=='ACCC'][['tot','net','benm','c_tot']].describe(percentiles=[.25,.5,.75,.9]).round(1))
print('neg',(D.tot<0).sum(),(D.net<0).sum(),(D.benm<0).sum())
print(T.tsq.value_counts())
