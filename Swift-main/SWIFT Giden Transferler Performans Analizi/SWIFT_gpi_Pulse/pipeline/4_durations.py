import pandas as pd,numpy as np
from bizt import biz_minutes
D=pd.read_pickle('final.pkl')
s=D.start; e=D.t_end; r=D[['t_reach']].t_reach
reach=pd.concat([r,s],axis=1).max(axis=1); reach=pd.concat([reach,e],axis=1).min(axis=1).where(e.notna(),reach)
D['totB']=biz_minutes(s,e,D.ccy.fillna(''),D.ctry)
D['netB']=biz_minutes(s,reach.where(D.t_reach.notna()),D.ccy.fillna(''),D.ctry)
D['netB']=np.where(D.totB.notna(),np.minimum(D.netB,D.totB),D.netB)
D['benB']=D.totB-D.netB
D['ageB']=biz_minutes(s,D.seg_end,D.ccy.fillna(''),D.ctry)
from bhours import bus_minutes
fin=D.t_end.notna()
reach=D[['t_reach','start']].max(axis=1)
reach=pd.concat([reach,D.t_end],axis=1).min(axis=1).where(fin,reach)
D['benS']=bus_minutes(reach.where(fin&D.t_reach.notna()),D.t_end.where(fin&D.t_reach.notna()),D.ctry)
D['netS']=D.net; D['totS']=D.netS+D.benS
from mesai import mesai_minutes
cc_corr=D.instd.fillna('XXXXTR').str[4:6]
r2=D[['t_reach','start']].max(axis=1); r2=pd.concat([r2,D.t_end],axis=1).min(axis=1).where(D.t_end.notna(),r2)
D['netM']=mesai_minutes(D.start.where(D.t_end.notna()),r2.where(D.t_end.notna()),cc_corr).round(1)
D['benM']=mesai_minutes(r2.where(D.t_end.notna()),D.t_end,D.ctry).round(1)
D.loc[D.direct.fillna(False),'netM']=np.where(D.loc[D.direct.fillna(False),'t_end'].notna(),0,np.nan)
D['totM']=D.netM+D.benM
for c in ['tot','net','benm','totB','netB','benB','totS','netS','benS','totM','netM','benM']:
    D.loc[D.vstat==2,c]=np.nan
D.to_pickle('final.pkl'); print('süreler hazır · valörden önce tamamlanan:',int((D.vstat==2).sum()))
