const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

let sock;
let latestQrUrl = '';
let connectionStatus = 'Connecting...';
const AUTH_FOLDER = 'auth_info_baileys';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    sock = makeWASocket({
        auth: state
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

// Endpoint untuk lihat QR di browser
app.get('/', (req, res) => {
    if (connectionStatus === 'Connected') {
        return res.send(`
            <div style="text-align:center; padding:50px; font-family:sans-serif;">
                <h1>✅ Bot WhatsApp Berhasil Terhubung!</h1>
                <p style="color:#666;">Ingin mengganti ke Nomor WA kedua? <a href="/logout" onclick="return confirm('Yakin ingin logout & scan QR baru?')" style="color:red; font-weight:bold;">Klik Logout di sini</a></p>
            </div>
        `);
    }
    if (latestQrUrl) {
        return res.send(`
            <div style="text-align:center; padding: 30px; font-family: sans-serif;">
                <h2>Scan QR Code dengan WA Nomor Kedua Anda:</h2>
                <img src="${latestQrUrl}" alt="QR Code" style="border: 2px solid #25D366; padding: 10px; border-radius: 12px; max-width: 300px;" />
                <p style="color: #666;">Refresh halaman ini jika QR expired.</p>
            </div>
        `);
    }
    return res.send('<div style="text-align:center; padding:50px; font-family:sans-serif;"><h2>Menginisialisasi Bot WhatsApp... Silakan refresh sebentar lagi.</h2></div>');
});

// Endpoint untuk Logout & Ganti Nomor WA
app.get('/logout', async (req, res) => {
    try {
        if (sock) {
            try { await sock.logout(); } catch(e){}
        }
        if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        }
        connectionStatus = 'Disconnected';
        latestQrUrl = '';
        setTimeout(() => { connectToWhatsApp(); }, 2000);
        return res.send('<div style="text-align:center; padding:50px; font-family:sans-serif;"><h2>✅ Sesi Logout Berhasil! <a href="/">Klik di sini untuk scan QR baru</a></h2></div>');
    } catch(err) {
        return res.status(500).send('Gagal logout: ' + err.toString());
    }
});

// Endpoint Kirim Pesan Personal (DM 1-on-1)
app.post('/send-message', async (req, res) => {
    try {
        const { target, message } = req.body;
        if (!target || !message) {
            return res.status(400).json({ status: 'error', message: 'Target dan message wajib diisi' });
        }
        const jid = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });
        console.log(`Pesan DM terkirim ke ${target}`);
        return res.json({ status: 'success', message: 'Pesan DM berhasil terkirim' });
    } catch (error) {
        console.error('Gagal mengirim pesan:', error);
        return res.status(500).json({ status: 'error', message: error.toString() });
    }
});

// Endpoint Otomatis Masuk Grup WA via Link Invite (e.g. BebJ3vwKM8j3t1fEiy7GS4)
app.post('/join-group', async (req, res) => {
    try {
        const { inviteCode } = req.body; // kode invite misal "BebJ3vwKM8j3t1fEiy7GS4" atau URL full
        let code = inviteCode || '';
        if (code.includes('chat.whatsapp.com/')) {
            code = code.split('chat.whatsapp.com/')[1].trim();
        }
        const groupJid = await sock.groupAcceptInvite(code);
        console.log(`Bot berhasil masuk grup: ${groupJid}`);
        return res.json({ status: 'success', groupJid: groupJid });
    } catch (error) {
        console.error('Gagal masuk grup:', error);
        return res.status(500).json({ status: 'error', message: error.toString() });
    }
});

// Endpoint Kirim Pesan ke GRUP WA + MENTION / TAG PARTICIPANTS
app.post('/send-group', async (req, res) => {
    try {
        const { groupJid, inviteCode, message, mentions } = req.body;
        
        let targetJid = groupJid;
        if (!targetJid && inviteCode) {
            let code = inviteCode;
            if (code.includes('chat.whatsapp.com/')) {
                code = code.split('chat.whatsapp.com/')[1].trim();
            }
            targetJid = await sock.groupAcceptInvite(code);
        }

        if (!targetJid || !message) {
            return res.status(400).json({ status: 'error', message: 'groupJid/inviteCode dan message wajib diisi' });
        }

        // Susun array mentions (nomor HP berformat 628xxx@s.whatsapp.net)
        let mentionJids = [];
        if (Array.isArray(mentions)) {
            mentionJids = mentions.map(num => String(num).replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        }

        await sock.sendMessage(targetJid, { text: message, mentions: mentionJids });
        console.log(`Pesan grup + mentions terkirim ke ${targetJid}`);
        return res.json({ status: 'success', message: 'Pesan grup berhasil terkirim' });
    } catch (error) {
        console.error('Gagal mengirim pesan grup:', error);
        return res.status(500).json({ status: 'error', message: error.toString() });
    }
});

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Server bot berjalan di port ${PORT}`);
    connectToWhatsApp();
});