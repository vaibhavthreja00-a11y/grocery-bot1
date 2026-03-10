const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const GROUP_NAME = process.env.GROUP_NAME || 'Grocery Orders';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
    console.log('📱 Scan this QR code with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp bot is ready!');
});

client.on('message', async (message) => {
    const chat = await message.getChat();
    if (chat.isGroup && chat.name === GROUP_NAME) {
        console.log(`📩 New message from ${chat.name}: ${message.body}`);
        if (N8N_WEBHOOK_URL) {
            await axios.post(N8N_WEBHOOK_URL, {
                message: message.body,
                sender: message.author,
                groupName: chat.name,
                timestamp: message.timestamp
            });
        }
    }
});

app.post('/send', async (req, res) => {
    const { groupName, message } = req.body;
    const chats = await client.getChats();
    const group = chats.find(c => c.isGroup && c.name === groupName);
    if (group) {
        await group.sendMessage(message);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Group not found' });
    }
});

app.get('/', (req, res) => {
    res.json({ status: 'Bot is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

client.initialize();
