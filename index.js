const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let sock;
let latestQrUrl = '';
let connectionStatus = 'Connecting...';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qr);
            console.log("\n==================================================");
            console.log("LINK UNTUK SCAN QR CODE (BERSIH):");
            console.log(latestQrUrl);
            console.log("==================================================\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, menghubungkan ulang...', shouldReconnect);
            connectionStatus = 'Disconnected. Reconnecting...';
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            connectionStatus = 'Connected';
            latestQrUrl = '';
            console.log('\n==================================================');
            console.log('✅ Bot WhatsApp Berhasil Terhubung!');
            console.log('==================================================\n');
        }
    });
}

// Endpoint untuk lihat QR di browser jika log terminal berantakan
app.get('/', (req, res) => {
    if (connectionStatus === 'Connected') {
        return res.send('<div style="text-align:center; padding:50px; font-family:sans-serif;"><h1>✅ Bot WhatsApp Berhasil Terhubung!</h1></div>');
    }
    if (latestQrUrl) {
        return res.send(`
            <div style="text-align:center; padding: 30px; font-family: sans-serif;">
                <h2>Scan QR Code WhatsApp di bawah ini:</h2>
                <img src="${latestQrUrl}" alt="QR Code" style="border: 2px solid #25D366; padding: 10px; border-radius: 12px; max-width: 300px;" />
                <p style="color: #666;">Refresh halaman ini jika QR expired.</p>
            </div>
        `);
    }
    return res.send('<div style="text-align:center; padding:50px; font-family:sans-serif;"><h2>Menginisialisasi Bot WhatsApp... Silakan refresh sebentar lagi.</h2></div>');
});

// Endpoint API yang akan dipanggil oleh Google Apps Script
app.post('/send-message', async (req, res) => {
    try {
        const { target, message } = req.body;
        
        if (!target || !message) {
            return res.status(400).json({ status: 'error', message: 'Target dan message wajib diisi' });
        }

        const jid = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });
        
        console.log(`Pesan berhasil terkirim ke ${target}`);
        return res.json({ status: 'success', message: 'Pesan berhasil terkirim' });
    } catch (error) {
        console.error('Gagal mengirim pesan:', error);
        return res.status(500).json({ status: 'error', message: error.toString() });
    }
});

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Server bot berjalan di port ${PORT}`);
    connectToWhatsApp();
});