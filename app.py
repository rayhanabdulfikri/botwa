import subprocess
import os
import threading
import requests
import time
import spaces
import gradio as gr
from fastapi import Request
from fastapi.responses import JSONResponse

@spaces.GPU
def init_gpu():
    return "ZeroGPU Ready"

# 1. Jalankan Node.js Bot di background (Port 3000)
def start_node_bot():
    print("Memulai instansi Node.js Bot...")
    env = os.environ.copy()
    env["PORT"] = "3000"
    subprocess.run(["npm", "install"])
    subprocess.Popen(["node", "index.js"], env=env)

threading.Thread(target=start_node_bot, daemon=True).start()

# 2. Fitur Keep-Alive Self-Ping (Mencegah HuggingFace Space Pause/Sleep)
def keep_alive_ping():
    while True:
        try:
            time.sleep(300) # Ping otomatis setiap 5 menit (300 detik)
            requests.get("http://127.0.0.1:7860/", timeout=5)
            print("Keep-Alive Ping Success!")
        except Exception as e:
            print("Keep-Alive Ping Log:", e)

threading.Thread(target=keep_alive_ping, daemon=True).start()

# 3. Fungsi untuk mengambil tampilan HTML / QR Code dari Node.js (Port 3000)
def get_bot_status():
    try:
        res = requests.get("http://127.0.0.1:3000/", timeout=3)
        return res.text
    except Exception:
        return "<div style='text-align:center; padding:30px; font-family:sans-serif;'><h3>Sedang menginisialisasi Bot WhatsApp... Silakan tunggu 5 detik lalu klik Refresh.</h3></div>"

# 4. Tampilan Gradio UI
with gr.Blocks(title="WhatsApp Bot Arcade") as demo:
    gr.Markdown("# 🚀 Bot WhatsApp Arcade Fasilitator")
    gr.Markdown("Di bawah ini adalah tampilan QR Code / Status Bot WhatsApp Anda secara langsung:")
    
    bot_html = gr.HTML(value=get_bot_status)
    refresh_btn = gr.Button("🔄 Refresh QR Code / Status", variant="primary")
    refresh_btn.click(fn=get_bot_status, outputs=bot_html)

# 5. Endpoint Proxy /send-message untuk Google Apps Script
@demo.app.post("/send-message")
async def send_message(request: Request):
    try:
        body = await request.json()
        res = requests.post("http://127.0.0.1:3000/send-message", json=body, timeout=10)
        return JSONResponse(content=res.json(), status_code=res.status_code)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

demo.launch(server_name="0.0.0.0", server_port=7860)
