import pandas as pd
df = pd.read_csv(__import__('os').environ.get('SWIFT_CSV','../../Book1.csv'), sep=';', encoding='utf-8-sig', dtype=str, keep_default_na=False)
df.to_pickle('raw.pkl')
import sys
if '--quiet' in sys.argv: raise SystemExit
print(df.shape)
print(df.dtypes)
for c in df.columns:
    vc=df[c].value_counts()
    print('====',c,'nunique',df[c].nunique(),'empty',(df[c]=='').sum())
    if c!='FinView': print(vc.head(8).to_string()[:800])
