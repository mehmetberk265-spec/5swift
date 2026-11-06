#!/bin/bash
cd "$(dirname "$0")" || { echo "HATA: klasore girilemedi"; read -p "Enter..."; exit 1; }
exec > >(tee start.log) 2>&1
echo "Baslangic: $(date)"
echo "=============================================="
echo " SWIFT gpi Pulse baslatiliyor..."
echo " Klasor: $(pwd)"
echo "=============================================="
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c "print()" >/dev/null 2>&1; then
  echo ""
  echo "HATA: Python 3 bulunamadi veya kurulu degil."
  echo "Cozum: Terminal'de 'xcode-select --install' calistirin ya da python.org'dan Python 3 kurun."
  echo "Gecici cozum: klasordeki index.html dosyasina cift tiklayin (AI Asistan haric her sey calisir)."
  read -p "Kapatmak icin Enter'a basin..."
  exit 1
fi
echo "Python: $(python3 --version)"
echo "Adres asagida yazacak (varsayilan http://127.0.0.1:8765/index.html)"
echo "Bu pencere acik kaldigi surece platform calisir. Kapatmak icin Ctrl+C."
echo ""
python3 -u server.py
echo "Python cikis kodu: $?"
echo ""
read -p "Sunucu durdu. Kapatmak icin Enter'a basin..."
