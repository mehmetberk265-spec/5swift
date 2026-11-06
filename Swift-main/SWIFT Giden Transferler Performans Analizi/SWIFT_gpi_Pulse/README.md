# SWIFT gpi Pulse — Giden Transfer Süre Performansı

Kuveyt Türk'ten çıkan SWIFT gpi ödemelerinin uçtan uca süresini (muhabir ağı + alıcı banka) analiz eden yerel analiz platformu.

## Çalıştırma
1. `config.example.json` → `config.json` olarak kopyalayın, Azure anahtarlarını girin (AI Asistan için).
2. Veriyi üretin: `pipeline/run_pipeline.sh /yol/Book1.csv` (gereksinim: `pip3 install pandas scikit-learn`).
3. `start.command` (Mac) / `start.bat` (Windows) → http://127.0.0.1:8765/index.html

`config.json`, ham CSV ve işlem verisi (`data/data.js`, `data/events.js`) `.gitignore` ile repoya alınmaz.
Ayrıntılar: `PROJE_TAKIP.md`.
