#!/bin/bash
# 定时重新索引 skill — 每 1 小时执行 classifier.py 重新扫描技能目录
cd "$(dirname "$0")/.." || exit 1

CLASSIFIER="./smart-skill-manager/classifier.py"

if [ -f "$CLASSIFIER" ]; then
    python3 "$CLASSIFIER" --skip-if-unchanged >> /tmp/classifier-cron.log 2>&1
    echo "[$(date)] classifier done" >> /tmp/classifier-cron.log
else
    echo "[$(date)] classifier.py not found at $CLASSIFIER" >> /tmp/classifier-cron.log
fi