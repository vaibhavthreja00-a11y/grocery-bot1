const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const GROUP_NAME = process.env.GROUP_NAME || 'Grocery Orders';

let latestQR = null;
let botStatus = 'initializing';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    latestQR = qr;
    botStatus = 'waiting_for_scan';
    console.log('==== QR CODE GENERATED - VISIT /qr TO SCAN ====');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    botStatus = 'ready';
    latestQR = null;
    console.log('WhatsApp bot is ready!');
});

client.on('disconnected', (reason) => {
    botStatus = 'disconnected';
    console.log('Bot disconnected:', reason);
});

client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        if (chat.isGroup && chat.name === GROUP_NAME) {
            console.log('New message from ' + chat.name + ': ' + message.body);
            if (N8N_WEBHOOK_URL) {
                await axios.post(N8N_WEBHOOK_URL, {
                    message: message.body,
                    sender: message.author,
                    groupName: chat.name,
                    timestamp: message.timestamp
                });
            }
        }
    } catch (err) {
        console.log('Message error:', err.message);
    }
});

app.post('/send', async (req, res) => {
    try {
        const { groupName, message } = req.body;
        const chats = await client.getChats();
        const group = chats.find(c => c.isGroup && c.name === groupName);
        if (group) {
            await group.sendMessage(message);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Group not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/qr', (req, res) => {
    if (botStatus === 'ready') {
        return res.send('<h1>Bot is connected and ready!</h1>');
    }
    if (!latestQR) {
        return res.send('<h1>QR not ready yet. Refresh in 10 seconds...</h1>');
    }
    res.send('<html><body style="background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh"><h2 style="color:white">Scan with WhatsApp</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(latestQR) + '" /><p style="color:white">Refresh page if expired</p></body></html>');
});

app.get('/', (req, res) => {
    res.json({ status: 'Bot is running!', botStatus: botStatus, qrAvailable: !!latestQR });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});

client.initialize();
