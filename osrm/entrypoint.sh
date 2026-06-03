#!/bin/sh
set -e

DATA_FILE="/data/uzbekistan-latest.osrm"
READY_FILE="/data/.osrm_ready"
PBF_FILE="/data/uzbekistan-latest.osm.pbf"

if [ ! -f "$READY_FILE" ]; then
    echo "[OSRM] O'zbekiston yo'l ma'lumotlari yuklanmoqda (~110 MB)..."
    wget -q --show-progress --retry-connrefused --tries=3 \
        -O "$PBF_FILE" \
        https://download.geofabrik.de/asia/uzbekistan-latest.osm.pbf

    echo "[OSRM] Extract (1/3) - yo'llar ajratilmoqda..."
    osrm-extract -p /opt/car.lua "$PBF_FILE"

    echo "[OSRM] Partition (2/3) - grafik bo'linmoqda..."
    osrm-partition "$DATA_FILE"

    echo "[OSRM] Customize (3/3) - optimallashtirilmoqda..."
    osrm-customize "$DATA_FILE"

    rm -f "$PBF_FILE"
    touch "$READY_FILE"
    echo "[OSRM] Tayyor! Server ishga tushmoqda..."
fi

exec osrm-routed --algorithm mld --max-table-size 1000 "$DATA_FILE"
