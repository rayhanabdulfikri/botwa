const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

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
            const isLoggedOut = (lastDisconnect.error)?.output?.statusCode === DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Is Logged Out:', isLoggedOut);
            
            connectionStatus = 'Disconnected';
            latestQrUrl = '';

            if (isLoggedOut) {
                console.log('⚠️ Terdeteksi logout dari HP! Menghapus sesi lama & membuat QR Code baru...');
                if (fs.existsSync(AUTH_FOLDER)) {
                    try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch(e){}
                }
                setTimeout(() => { connectToWhatsApp(); }, 2000);
            } else {
                console.log('Menghubungkan ulang...');
                setTimeout(() => { connectToWhatsApp(); }, 3000);
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

// Endpoint JSON Status untuk auto-check halaman
app.get('/status', (req, res) => {
    return res.json({
        status: connectionStatus,
        connected: connectionStatus === 'Connected',
        qrUrl: latestQrUrl
    });
});

// Endpoint untuk lihat QR di browser dengan Auto-Refresh otomatis
app.get('/', (req, res) => {
    if (connectionStatus === 'Connected') {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bot WhatsApp Terhubung</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 30px; background-color: #f7f9fa; }
                    .card { background: white; padding: 40px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                </style>
            </head>
            <body>
                <div class="card" id="mainCard">
                    <h1 style="color:#25D366;">✅ Bot WhatsApp Berhasil Terhubung!</h1>
                    <p style="color:#666;">Ingin mengganti nomor? <a href="/logout" onclick="return confirm('Yakin ingin logout & scan QR baru?')" style="color:red; font-weight:bold;">Klik Logout di sini</a></p>
                    <p style="color:#888; font-size:12px; margin-top:20px;">Jika Anda Keluar (Logout) dari WA HP Anda, halaman ini akan otomatis kembali menampilkan QR Code baru!</p>
                </div>
                <script>
                    setInterval(async () => {
                        try {
                            const res = await fetch('/status');
                            const data = await res.json();
                            if (!data.connected) {
                                location.reload();
                            }
                        } catch(e) {}
                    }, 2000);
                </script>
            </body>
            </html>
        `);
    }

    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan QR WhatsApp</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: sans-serif; text-align: center; padding: 30px; background-color: #f7f9fa; }
                .card { background: white; padding: 30px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                img { border: 3px solid #25D366; padding: 10px; border-radius: 12px; max-width: 280px; }
            </style>
        </head>
        <body>
            <div class="card" id="mainCard">
                <h2>Scan QR Code dengan WA Nomor Kedua Anda:</h2>
                ${latestQrUrl ? `<img src="${latestQrUrl}" alt="QR Code" />` : '<h3>Menginisialisasi QR Code... Sebentar lagi</h3>'}
                <p style="color: #666; margin-top: 15px;">Halaman ini akan <b>otomatis berubah ke tampilan Berhasil</b> setelah discan di HP!</p>
            </div>

            <script>
                setInterval(async () => {
                    try {
                        const res = await fetch('/status');
                        const data = await res.json();
                        if (data.connected) {
                            location.reload();
                        } else if (data.qrUrl && !document.querySelector('img')) {
                            location.reload();
                        }
                    } catch(e) {}
                }, 2000);
            </script>
        </body>
        </html>
    `);
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

// Endpoint Otomatis Masuk Grup WA via Link Invite
app.post('/join-group', async (req, res) => {
    try {
        const { inviteCode } = req.body;
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
        const { groupJid, inviteCode, message, mentions, mentionAll } = req.body;
        
        let targetJid = groupJid;
        
        if (!targetJid && inviteCode) {
            let code = inviteCode;
            if (code.includes('chat.whatsapp.com/')) {
                code = code.split('chat.whatsapp.com/')[1].trim();
            }
            try {
                targetJid = await sock.groupAcceptInvite(code);
            } catch (joinErr) {
                console.log('Gagal accept invite, mencari grup terdaftar...', joinErr.message);
                const allGroups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(allGroups);
                if (groupList.length > 0) {
                    targetJid = groupList[0].id;
                }
            }
        }

        if (!targetJid || !message) {
            return res.status(400).json({ status: 'error', message: 'Gagal menemukan Grup WA. Pastikan bot sudah join grup atau inviteCode benar.' });
        }

        let mentionJids = [];
        if (mentionAll) {
            try {
                const groupMeta = await sock.groupMetadata(targetJid);
                mentionJids = groupMeta.participants.map(p => p.id);
            } catch(metaErr) {
                console.log('Gagal fetch group metadata, fallback to mentions array:', metaErr.message);
                if (Array.isArray(mentions)) {
                    mentionJids = mentions.map(num => String(num).replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                }
            }
        } else if (Array.isArray(mentions)) {
            mentionJids = mentions.map(num => String(num).replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        }

        await sock.sendMessage(targetJid, { text: message, mentions: mentionJids });
        console.log(`Pesan grup + mentions terkirim ke ${targetJid}`);
        return res.json({ status: 'success', message: 'Pesan grup berhasil terkirim', groupJid: targetJid });
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