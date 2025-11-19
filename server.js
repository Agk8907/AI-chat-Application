require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// --- CONFIGURATION ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/agk_ai_db";
const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const PORT = process.env.PORT || 3000;

// 🚀 MODEL
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025"; 

if (!GEMINI_API_KEY) {
    console.error("❌ FATAL ERROR: GEMINI_API_KEY is not set in .env file.");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const ConversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, default: "New Chat" },
    updatedAt: { type: Date, default: Date.now }
});

const ChatSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Chat = mongoose.model('Chat', ChatSchema);

// --- AUTH MIDDLEWARE ---
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Access denied" });
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid token" });
    }
};

// --- ROUTES ---

// 1. Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Missing fields" });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.json({ message: "User registered!" });
    } catch (err) {
        res.status(400).json({ error: "Username already exists" });
    }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign({ _id: user._id }, JWT_SECRET);
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// 3. Update User
app.put('/api/user', authenticate, async (req, res) => {
    try {
        const { username, password } = req.body;
        const updates = {};
        if (username) updates.username = username;
        if (password) updates.password = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(req.user._id, updates);
        res.json({ message: "Profile updated" });
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// 4. Get Conversations
app.get('/api/conversations', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const orphanedCount = await Chat.countDocuments({ userId, conversationId: { $exists: false } });
        if (orphanedCount > 0) {
            const legacyConvo = new Conversation({ userId, title: "Previous Chat History", updatedAt: new Date() });
            await legacyConvo.save();
            await Chat.updateMany({ userId, conversationId: { $exists: false } }, { $set: { conversationId: legacyConvo._id } });
        }
        const conversations = await Conversation.find({ userId }).sort({ updatedAt: -1 });
        res.json(conversations);
    } catch (err) { res.status(500).json({ error: "Failed to fetch" }); }
});

// 5. Create Conversation
app.post('/api/conversations', authenticate, async (req, res) => {
    try {
        const convo = new Conversation({ userId: req.user._id, title: "New Chat" });
        await convo.save();
        res.json(convo);
    } catch (err) { res.status(500).json({ error: "Failed to create" }); }
});

// 6. Update Title
app.put('/api/conversations/:id', authenticate, async (req, res) => {
    try {
        const { title } = req.body;
        await Conversation.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { title });
        res.json({ message: "Title updated" });
    } catch (err) { res.status(500).json({ error: "Failed to update" }); }
});

// 7. Delete Conversation
app.delete('/api/conversations/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const convo = await Conversation.findOne({ _id: id, userId });
        if (!convo) return res.status(404).json({ error: "Not found" });
        await Chat.deleteMany({ conversationId: id });
        await Conversation.findByIdAndDelete(id);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

// 8. Get History
app.get('/api/chat/:conversationId', authenticate, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const history = await Chat.find({ userId: req.user._id, conversationId }).sort({ timestamp: 1 });
        res.json(history);
    } catch (err) { res.status(500).json({ error: "Failed to fetch" }); }
});

// 9. STREAM CHAT (Text Only)
app.post('/api/chat', authenticate, async (req, res) => {
    try {
        const { text, conversationId } = req.body;
        const userId = req.user._id;

        if (!conversationId) return res.status(400).json({ error: "Missing ID" });

        // 1. Save User Message
        const userMsg = new Chat({ userId, conversationId, role: 'user', text });
        await userMsg.save();

        const currentConvo = await Conversation.findById(conversationId);
        if (currentConvo && currentConvo.title === "New Chat") {
            const newTitle = text.length > 30 ? text.substring(0, 30) + "..." : text;
            await Conversation.findByIdAndUpdate(conversationId, { title: newTitle });
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
        
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            res.write(`Error: AI Service Unavailable.`);
            res.end();
            return;
        }

        let fullAiText = "";

        response.body.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6);
                        if (jsonStr.trim() === '[DONE]') return;
                        const data = JSON.parse(jsonStr);
                        const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textChunk) {
                            fullAiText += textChunk;
                            res.write(textChunk);
                        }
                    } catch (e) {}
                }
            }
        });

        response.body.on('end', async () => {
            if (fullAiText) {
                const aiMsg = new Chat({ userId, conversationId, role: 'model', text: fullAiText });
                await aiMsg.save();
                await Conversation.findByIdAndUpdate(conversationId, { updatedAt: Date.now() });
            }
            res.end();
        });

    } catch (err) {
        console.error("Stream Error:", err);
        res.status(500).end();
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));