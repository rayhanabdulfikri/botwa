const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    // Sesi login akan disimpan di folder 'auth_info_baileys'
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("\n==================================================");
            console.log("SCAN QR CODE INI DI WHATSAPP HP ANDA:");
            console.log("==================================================\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n==================================================');
            console.log('✅ Bot WhatsApp Berhasil Terhubung!');
            console.log('==================================================\n');
        }
    });
}

// Endpoint API yang akan dipanggil oleh Google Apps Script
app.post('/send-message', async (req, res) => {
    try {
        const { target, message } = req.body;
        
        if (!target || !message) {
            return res.status(400).json({ status: 'error', message: 'Target dan message wajib diisi' });
        }

        // Format nomor ke ID WhatsApp (misal: 628123456789@s.whatsapp.net)
        const jid = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

        // Kirim pesan DM
        await sock.sendMessage(jid, { text: message });
        
        console.log(`Pesan berhasil terkirim ke ${target}`);
        return res.json({ status: 'success', message: 'Pesan berhasil terkirim' });
    } catch (error) {
        console.error('Gagal mengirim pesan:', error);
        return res.status(500).json({ status: 'error', message: error.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server bot berjalan di port ${PORT}`);
    connectToWhatsApp();
});