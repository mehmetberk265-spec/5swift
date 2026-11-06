import pandas as pd, re, numpy as np
from datetime import datetime, timedelta, timezone
df=pd.read_pickle('raw.pkl').drop_duplicates('MTId')
TR=timezone(timedelta(hours=3))
def xml(tag,s):
    m=re.search(r'<%s[^>]*>([^<]*)</%s>'%(tag,tag),s); return m.group(1) if m else None
def xmlblk(tag,s):
    m=re.search(r'<%s>(.*?)</%s>'%(tag,tag),s,re.S); return m.group(1) if m else ''
out=[];trk=[];oth=[]
for r in df.itertuples(index=False):
    fv=r.FinView; mt=r.MessageType
    if mt in('pacs.008','pacs.009'):
        doc=fv.split('<Document')[1]
        cre=xml('CreDt',fv)
        tx=xmlblk('CdtTrfTxInf',doc)
        amt=re.search(r'<IntrBkSttlmAmt Ccy="(\w+)">([\d.]+)',tx)
        cov='UndrlygCstmrCdtTrf' in tx
        und=xmlblk('UndrlygCstmrCdtTrf',tx) if cov else tx
        cdtragt=xml('BICFI',xmlblk('CdtrAgt',und)) or xml('BICFI',xmlblk('CdtrAgt',tx))
        out.append(dict(uetr=r.UETRValue,mt=mt,cre=pd.Timestamp(cre).tz_convert(TR) if cre else None,
          instd=xml('BICFI',xmlblk('InstdAgt',tx)),cdtragt=cdtragt,
          intrmy=xml('BICFI',xmlblk('IntrmyAgt1',und)),rmbrs=xml('BICFI',xmlblk('InstgRmbrsmntAgt',fv)),
          ccy=amt.group(1) if amt else None,amt=float(amt.group(2)) if amt else None,
          chrgbr=xml('ChrgBr',tx),svc=xml('Cd',xmlblk('SvcLvl',tx)),sttl=xml('SttlmMtd',fv),cov=cov,
          cdtrctry=xml('Ctry',xmlblk('Cdtr',und)),ref=r.ExchangeReference,user=r.UserName,unit=r.UnitId,
          csv_benbic=r.BeneficiaryBIC,csv_benname=r.BeneficiaryBankName,csv_corr=r.CorrespondentBankName,sysdate=r.SystemDate))
    elif mt in('103','202COV'):
        t=re.search(r':32A:(\d{6})(\w{3})([\d,]+)',fv)
        out.append(dict(uetr=r.UETRValue,mt=mt,cre=pd.to_datetime(r.SystemDate,format='%d/%m/%Y %H:%M').tz_localize(TR),
          instd=re.search(r'\{2:I\d{3}(\w{8})',fv).group(1)+'XXX',cdtragt=(re.search(r':57A:(\w+)',fv) or [None,None])[1],
          ccy=t.group(2) if t else None,amt=float(t.group(3).replace(',','.')) if t else None,
          chrgbr=(re.search(r':71A:(\w+)',fv) or [None,None])[1],ref=r.ExchangeReference,user=r.UserName,unit=r.UnitId,
          csv_benbic=r.BeneficiaryBIC,csv_benname=r.BeneficiaryBankName,csv_corr=r.CorrespondentBankName,sysdate=r.SystemDate,cov=False))
    elif mt in('199','299') and r.Direction=='O':
        b4=re.search(r'\{4:\s*(.*?)-\}',fv,re.S).group(1)
        lines=[l.strip() for l in b4.splitlines() if l.strip()]
        m79=re.search(r':79:(.*)',b4); first=m79.group(1).strip()
        ts=None;st=rsn=rep=fwd=meth=None;ccy=None;am=None;fees=[]
        mt_=re.match(r'//(\d{10})([+-]\d{4})',first)
        idx=[i for i,l in enumerate(lines) if l.startswith(':79:')][0]
        rest=lines[idx+1:]
        if mt_:
            ts=datetime.strptime(mt_.group(1),'%y%m%d%H%M').replace(tzinfo=timezone(timedelta(hours=int(mt_.group(2)[:3]),minutes=int(mt_.group(2)[0]+mt_.group(2)[3:]))))
            if rest:
                s=rest[0][2:].split('/'); st=s[0]; rsn=s[1] if len(s)>1 else None
            if len(rest)>1 and not re.match(r'//[A-Z]{3}[\d,]',rest[1]):
                p=rest[1][2:].split('/'); rep=p[0] or None; fwd=p[1] if len(p)>1 and p[1] else None; meth='/'.join(p[2:]) or None
            for l in rest[1:]:
                a=re.match(r'//([A-Z]{3})([\d,]+)',l)
                if a and am is None: ccy=a.group(1); am=float(a.group(2).rstrip(',').replace(',','.') or 0)
                f=re.match(r'//:71F:([A-Z]{3})([\d,]+)',l)
                if f: fees.append(float(f.group(2).rstrip(',').replace(',','.') or 0))
        else:
            s=first.strip('/').split('/'); st=s[0]; rsn=s[1] if len(s)>1 else None
            if rest: rep=rest[0].split('/')[-1]
        h=re.search(r'\{2:O\d{3}(\d{4})(\d{6})\w{28}(\d{6})(\d{4})',fv)
        trk.append(dict(uetr=r.UETRValue,mtid=r.MTId,mt=mt,ts=ts,st=st,rsn=rsn,rep=rep,fwd=fwd,meth=meth,ccy=ccy,amt=am,fee=sum(fees),nfee=len(fees),
           sysdate=pd.to_datetime(r.SystemDate,format='%d/%m/%Y %H:%M').tz_localize(TR),ref=r.ExchangeReference))
    else:
        oth.append(dict(uetr=r.UETRValue,mt=mt,sysdate=r.SystemDate,txt=re.sub(r'\s+',' ',fv[-300:]),ref=r.ExchangeReference))
O=pd.DataFrame(out);T=pd.DataFrame(trk);X=pd.DataFrame(oth)
T['ts']=pd.to_datetime(T.ts,utc=True).dt.tz_convert(TR)
O.to_pickle('out.pkl');T.to_pickle('trk.pkl');X.to_pickle('oth.pkl')
print(O.shape,T.shape,X.shape)
