---
title: BotWA Arcade Fasilitator
emoji: 🚀
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: "4.44.0"
app_file: app.py
pinned: true
hardware: cpu-basic
---

# 🚀 Bot WhatsApp Arcade Fasilitator

Bot WhatsApp otomatis untuk mengirim reminder kepada peserta GCAF26 yang belum progress.

## Cara Pakai

1. Buka Space ini, klik **Refresh** untuk melihat QR Code
2. Scan QR Code menggunakan WhatsApp
3. Bot siap menerima perintah kirim pesan via endpoint `/send-message`

## Endpoint

- `GET /` — Tampilan QR Code / Status koneksi bot
- `POST /send-message` — Kirim pesan WhatsApp
- `GET /ping` — Health check (untuk UptimeRobot)
