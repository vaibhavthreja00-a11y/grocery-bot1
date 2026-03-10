const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

// Your n8n webhook URL - you'll fill this in Phase 2
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';

// Your WhatsApp group name - fill this in Railway later
const GROUP_NAME = process.env.GROUP_NAME || 'Grocery Orders';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Show QR code to scan
client.on('qr', (qr) => {
    console.log('📱 Scan this QR code with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp bot is ready!');
});

// Listen for messages in your group
client.on('message', async (message) => {
    const chat = await message.getChat();
    
    // Only process group messages from your specific group
    if (chat.isGroup && chat.name === GROUP_NAME) {
        console.log(`📩 New message from ${chat.name}: ${message.body}`);
        
        // Send message to n8n for processing
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

// Endpoint for n8n to send replies back to WhatsApp
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

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

client.initialize();
