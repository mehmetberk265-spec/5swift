import pandas as pd
import os,sys
fs=sys.argv[1:] or [os.path.expanduser('~/Desktop/'+x+'.csv') for x in ['mayis','haziran','temmuz','ekim']]; dfs=[]
for f in fs:
    d=pd.read_csv(f,sep=';',encoding='utf-8-sig',dtype=str,keep_default_na=False)
    d['src']=f; dfs.append(d); print(f,d.shape)
df=pd.concat(dfs,ignore_index=True)
print('dup MTId',df.MTId.duplicated().sum())
df=df.drop_duplicates('MTId')
df.to_pickle('raw.pkl'); print(df.shape)
for c in ['MessageType','Direction','FinalN99ReasonCode']: print(df[c].value_counts().head(12).to_dict())
for c in ['BizdenCikisTarihi','OperasyonelBaslangicTarihi','SonMesajTarihi','SystemDate','ValueDate']:
    d=pd.to_datetime(df[c],format='%d/%m/%Y %H:%M',errors='coerce'); print(c,d.min(),d.max(),'null',d.isna().sum())
print(df.UETRValue.nunique())
