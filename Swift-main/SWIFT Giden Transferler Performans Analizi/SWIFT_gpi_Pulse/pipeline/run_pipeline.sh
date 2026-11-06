#!/bin/bash
# Kullanım: ./run_pipeline.sh ~/Desktop/mayis.csv ~/Desktop/haziran.csv ~/Desktop/temmuz.csv ~/Desktop/ekim.csv
# Gereksinim: python3 + pandas + scikit-learn  (pip3 install pandas scikit-learn)
set -e
cd "$(dirname "$0")"
echo "1/6 CSV'ler okunuyor";        python3 1_load.py "$@" > /dev/null
echo "2/6 Mesajlar ayrıştırılıyor"; python3 2_parse.py > /dev/null
echo "3/6 İşlem tablosu";           python3 3_build.py > /dev/null
echo "4/6 Süre bazları";            python3 4_durations.py
echo "5/6 Model";                   python3 5_model.py > /dev/null
echo "6/6 Platform verisi";         python3 6_export.py > /dev/null
mv data.js events.js ../data/ && rm -f *.pkl model.json
echo "Tamamlandı. Platformu yenileyin."
