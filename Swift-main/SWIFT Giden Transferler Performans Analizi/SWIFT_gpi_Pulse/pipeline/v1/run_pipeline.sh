#!/bin/bash
# Kullanım: ./run_pipeline.sh /yol/Book1.csv
# Gereksinim: python3 + pandas + scikit-learn  (pip3 install pandas scikit-learn)
set -e
cd "$(dirname "$0")"
export SWIFT_CSV="${1:-$HOME/Desktop/Book1.csv}"
echo "1/5 CSV okunuyor: $SWIFT_CSV";       python3 load.py --quiet
echo "2/5 Mesajlar ayrıştırılıyor";       python3 parse.py > /dev/null
echo "3/5 İşlem tablosu kuruluyor";       python3 build.py > /dev/null
echo "4/5 Model eğitiliyor";              python3 model.py
echo "5/5 Platform verisi yazılıyor";     python3 export.py > /dev/null
mv data.js events.js ../data/
rm -f *.pkl
echo "Tamamlandı. Platformu yenileyin."
