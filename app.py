import subprocess
import os
import threading
import requests
import time
import gradio as gr
from fastapi import Request
from fastapi.responses import JSONResponse

# 1. Jalankan Node.js Bot di background (Port 3000)
def start_node_bot():
    print("Memulai instansi Node.js Bot...")
    env = os.environ.copy()
    env["PORT"] = "3000"
    subprocess.run(["npm", "install"], env=env)
    subprocess.Popen(["node", "index.js"], env=env)

threading.Thread(target=start_node_bot, daemon=True).start()

# 2. Fungsi untuk mengambil tampilan HTML / QR Code dari Node.js (Port 3000)
def get_bot_status():
    try:
        res = requests.get("http://127.0.0.1:3000/", timeout=5)
        return res.text
    except Exception:
        return "<div style='text-align:center; padding:30px; font-family:sans-serif;'><h3>⏳ Sedang menginisialisasi Bot WhatsApp... Silakan tunggu 10 detik lalu klik Refresh.</h3></div>"

# 3. Tampilan Gradio UI
with gr.Blocks(title="WhatsApp Bot Arcade") as demo:
    gr.Markdown("# 🚀 Bot WhatsApp Arcade Fasilitator")
    gr.Markdown("Klik **Refresh** untuk melihat QR Code atau status koneksi bot.")

    bot_html = gr.HTML(value=get_bot_status)
    refresh_btn = gr.Button("🔄 Refresh QR Code / Status", variant="primary")
    refresh_btn.click(fn=get_bot_status, outputs=bot_html)

# 4. Endpoint Proxy /send-message untuk Google Apps Script
@demo.app.post("/send-message")
async def send_message(request: Request):
    try:
        body = await request.json()
        res = requests.post("http://127.0.0.1:3000/send-message", json=body, timeout=15)
        return JSONResponse(content=res.json(), status_code=res.status_code)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# 5. Endpoint health-check agar UptimeRobot bisa ping dari luar
@demo.app.get("/ping")
async def ping():
    return JSONResponse(content={"status": "alive"})

demo.launch(server_name="0.0.0.0", server_port=7860)
