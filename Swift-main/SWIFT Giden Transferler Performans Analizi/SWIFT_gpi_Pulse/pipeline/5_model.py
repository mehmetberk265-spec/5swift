import pandas as pd, numpy as np, json
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split
D=pd.read_pickle('final.pkl'); A=D[(D.state=='ACCC')&D.tot.notna()].copy()
A['hour']=A.t0.dt.hour+A.t0.dt.minute/60; A['dow']=A.t0.dt.dayofweek; A['lamt']=np.log1p(A.amt.fillna(0)); A['vd_fwd']=A.vd_fwd.astype(int)
feats=['ccy','ctry','instd','ben','hour','dow','chrgbr','type','lamt','vd_fwd']
X=A[feats].copy()
for c in ['ccy','ctry','instd','ben','chrgbr','type']:
    top=X[c].value_counts().index[:250]; X[c]=X[c].where(X[c].isin(top),'OTHER').astype('category')
y=np.log1p(A.tot)
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=.25,random_state=7)
m=HistGradientBoostingRegressor(categorical_features='from_dtype',max_iter=300,learning_rate=.06,random_state=7).fit(Xtr,ytr)
p=m.predict(Xte)
mae_med=np.median(np.abs(np.expm1(p)-np.expm1(yte)))
base=np.median(np.abs(np.expm1(ytr.median())-np.expm1(yte)))
r2=m.score(Xte,yte)
pi=permutation_importance(m,Xte,yte,n_repeats=5,random_state=7)
imp=dict(zip(feats,pi.importances_mean)); s=sum(max(v,0) for v in imp.values())
imp={k:round(max(v,0)/s,4) for k,v in sorted(imp.items(),key=lambda x:-x[1])}
# classification-ish: within 24h accuracy of predicted bucket
acc=( (np.expm1(p)<=1440)==(np.expm1(yte)<=1440)).mean()
res=dict(r2=round(r2,3),mae_med=round(mae_med,1),mae_base=round(base,1),acc24=round(acc,3),imp=imp,n_train=len(Xtr),n_test=len(Xte))
print(res); json.dump(res,open('model.json','w'))
