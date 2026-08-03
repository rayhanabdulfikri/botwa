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
    subprocess.run(["npm", "install"])
    subprocess.Popen(["node", "index.js"], env=env)

threading.Thread(target=start_node_bot, daemon=True).start()

# 2. Buat Tampilan Gradio untuk HuggingFace Health Check (Port 7860)
with gr.Blocks(title="WhatsApp Bot Arcade") as demo:
    gr.Markdown("# 🚀 Bot WhatsApp Arcade Fasilitator")
    gr.Markdown("Status: **Online** | Di bawah ini adalah tampilan QR Code / Status Bot WhatsApp Anda:")
    gr.HTML('<iframe src="http://127.0.0.1:3000/" width="100%" height="450px" style="border:2px solid #25D366; border-radius:12px;"></iframe>')

app = demo.app

# 3. Endpoint Proxy /send-message untuk Google Apps Script
@app.post("/send-message")
async def send_message(request: Request):
    try:
        body = await request.json()
        res = requests.post("http://127.0.0.1:3000/send-message", json=body, timeout=10)
        return JSONResponse(content=res.json(), status_code=res.status_code)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)
