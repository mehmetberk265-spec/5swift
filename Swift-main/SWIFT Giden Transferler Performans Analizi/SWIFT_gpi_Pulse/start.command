#!/bin/bash
# SWIFT gpi Pulse - baslatici (cift tiklayin)
cd "$(dirname "$0")" || { echo "HATA: klasore girilemedi"; read -p "Enter..."; exit 1; }
LOG="$(pwd)/start.log"
: > "$LOG"
log(){ echo "$@" | tee -a "$LOG"; }
log "Baslangic: $(date)"
log "=============================================="
log " SWIFT gpi Pulse baslatiliyor..."
log " Klasor: $(pwd)"
log "=============================================="

xattr -dr com.apple.quarantine . 2>/dev/null
chmod +x start.command 2>/dev/null

PY=""
for c in python3 /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "print()" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  log "HATA: Python 3 bulunamadi. Terminal'de 'xcode-select --install' calistirin."
  log "Gecici cozum: index.html dosyasina cift tiklayin (AI Asistan haric her sey calisir)."
  read -p "Kapatmak icin Enter'a basin..."; exit 1
fi
log "Python: $($PY --version 2>&1)"

# Eski SWIFT gpi Pulse sunucularini kapat
for p in $(lsof -nP -iTCP:8765-8784 -sTCP:LISTEN -t 2>/dev/null | sort -u); do
  if ps -p "$p" -o command= 2>/dev/null | grep -q "server.py"; then
    log "Eski sunucu kapatiliyor (PID $p)"; kill "$p" 2>/dev/null
  fi
done
sleep 1

# Bos port bul
PORT=8765
while lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do PORT=$((PORT+1)); done
URL="http://127.0.0.1:$PORT/index.html"
log "Adres: $URL"
log "Bu pencere acik kaldigi surece platform calisir. Kapatmak icin Ctrl+C."
log ""

# Sunucu hazir olunca tarayiciyi ac
( for i in $(seq 1 40); do
    if curl -s -o /dev/null "http://127.0.0.1:$PORT/api/health"; then open "$URL"; exit 0; fi
    sleep 0.5
  done
  echo "UYARI: Sunucu 20 sn icinde yanit vermedi. Tarayicida elle acin: $URL" | tee -a "$LOG" ) &

SWIFT_PORT=$PORT "$PY" -u server.py --no-browser 2>&1 | tee -a "$LOG"
log "Sunucu durdu."
read -p "Kapatmak icin Enter'a basin..."
