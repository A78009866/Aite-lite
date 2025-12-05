// server.js

require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const FirebaseStore = require('connect-session-firebase')(session);
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const cors = require('cors'); 

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// إعدادات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// إعدادات Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = 'general';
    if (req.originalUrl.includes('/register')) folderName = 'profile_pics';
    else if (req.originalUrl.includes('/messages/send')) folderName = 'chat_media';
    else if (req.originalUrl.includes('/api/posts/create')) folderName = 'post_media';
    
    let format = undefined;
    if (file.mimetype.startsWith('audio/')) {
        format = 'webm'; 
    }

    return {
      folder: folderName,
      public_id: Date.now() + '-' + path.parse(file.originalname).name,
      resource_type: 'auto',
      format: format
    };
  },
});

const upload = multer({ storage: storage });

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://trimer-4081b-default-rtdb.firebaseio.com",
    });
}

const firebaseAuth = getAuth();
const db = getDatabase();

const app = express();
const port = 3000;

// ---------------- Middleware ----------------
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const corsOptions = {
  origin: ['http://localhost:8100', 'https://chat-trimer.vercel.app'],
  credentials: true, 
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); 

app.use(session({
  secret: 'a-firebase-secret-key-is-better',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 
  },
  store: new FirebaseStore({
    database: db,
    collection: 'sessions',
    ttl: 86400
  })
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User session not found or expired.' });
  }
  return res.redirect('/login');
}

// ---------------- Routes: Pages ----------------
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'splash.html')); });

app.get('/check-status', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/chat_list');
  } else {
    res.redirect('/login');
  }
});

app.get('/chat_list', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat_list.html')); });
app.get('/users_list', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'users_list.html')); });
app.get('/chat', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat.html')); });
app.get('/chat.html', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat.html')); });
app.get('/profile', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'profile.html')); });
app.get('/create-post', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'create_post.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'login.html')); });
app.get('/register', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'register.html')); });

// ---------------- Routes: Auth Logic ----------------
app.post('/login', async (req, res) => {
  const { username } = req.body;
  try {
    if (!username) throw new Error('Username required');
    const email = `${username}@trimer.io`;
    const userRecord = await firebaseAuth.getUserByEmail(email);
    req.session.userId = userRecord.uid;
    req.session.email = userRecord.email;
    await req.session.save();
    res.redirect('/chat_list');
  } catch (error) {
    res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
  }
});

app.post('/register', upload.single('profile_picture'), async (req, res) => {
  const { username, password } = req.body;
  let profile_picture_url = 'https://via.placeholder.com/150';

  try {
    if (!username || !password) {
        return res.redirect('/register?error=' + encodeURIComponent('Required fields missing.'));
    }
    const email = `${username}@trimer.io`;
    if (req.file) profile_picture_url = req.file.path;

    const userRecord = await firebaseAuth.createUser({
      email: email, password: password, displayName: username, photoURL: profile_picture_url
    });

    const profileData = {
      id: userRecord.uid, username: username, full_name: username, email: email,
      profile_picture_url: profile_picture_url, is_online: false, is_verified: false, bio: '', 
    };
    await db.ref('profiles/' + userRecord.uid).set(profileData);

    req.session.userId = userRecord.uid;
    req.session.email = email;
    await req.session.save();
    res.redirect('/chat_list');
  } catch (error) {
    res.redirect('/register?error=' + encodeURIComponent(error.message));
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// ---------------- API: Chat & Messages ----------------

app.get('/api/chats', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const chatRefs = db.ref(`chats/${userId}`);
    const chatSnap = await chatRefs.once('value');
    const chats = [];
    const contactIds = [];

    chatSnap.forEach(childSnap => {
      const chat = childSnap.val();
      chats.push(chat);
      contactIds.push(chat.contact_id);
    });

    const profiles = {};
    const profilePromises = contactIds.map(id => db.ref(`profiles/${id}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
      profiles[contactIds[index]] = snap.val();
    });

    const finalChats = chats.map(chat => ({
      ...chat,
      contact_profile: profiles[chat.contact_id] || { username: 'مستخدم', profile_picture_url: 'https://via.placeholder.com/40' }
    }));

    finalChats.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp);
    res.json({ ok: true, chats: finalChats });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'فشل في جلب المحادثات.' });
  }
});

// ✅ تعديل: جلب الرسائل بترتيب زمني (الأقدم أولاً) لكي يعرضها العميل بشكل صحيح
app.get('/api/messages/:contactId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const contactId = req.params.contactId;
  const { limit = 50 } = req.query;

  if (!contactId) return res.status(400).json({ ok: false, error: 'Contact ID missing' });

  const chatRoomId = [userId, contactId].sort().join('_');
  const messagesRef = db.ref(`messages/${chatRoomId}`);

  try {
    const messagesSnap = await messagesRef
      .orderByChild('timestamp')
      .limitToLast(Number(limit))
      .once('value');

    const messages = [];
    messagesSnap.forEach(childSnap => {
      messages.push(childSnap.val());
    });
    
    // نرسل الرسائل مصفوفة: [الأقدم، ... ، الأحدث]
    // العميل سيضعهم في الصفحة واحداً تلو الآخر، فتظهر الأقدم في الأعلى والأحدث في الأسفل
    res.json({ ok: true, messages: messages }); 

  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error fetching messages.' });
  }
});

app.post('/api/messages/send', requireAuth, upload.single('media'), async (req, res) => {
    const senderId = req.session.userId;
    const contactId = req.body.other_id; 
    const { content, replied_to_id, replied_to_content, replied_to_sender } = req.body;
    
    const timestamp = admin.database.ServerValue.TIMESTAMP;
    let mediaUrl = null;
    let mediaType = null;

    if (!contactId || (!content && !req.file)) { 
      return res.status(400).json({ ok: false, error: 'No content to send.' });
    }
    
    if (req.file) {
      mediaUrl = req.file.path;
      if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
      else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
      else if (req.file.mimetype.startsWith('audio/') || req.file.originalname.endsWith('.webm')) mediaType = 'audio';
      else mediaType = 'raw';
    }

    try {
        const chatRoomId = [senderId, contactId].sort().join('_');
        const messagesRef = db.ref(`messages/${chatRoomId}`).push();
        const messageId = messagesRef.key;

        const messageData = {
            messageId: messageId,
            senderId: senderId,
            content: content || null,
            timestamp: timestamp,
            media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
            is_read: false,
            replied_to_id: replied_to_id || null,
            replied_to_content: replied_to_content || null,
            replied_to_sender: replied_to_sender || null
        };

        await messagesRef.set(messageData);

        let previewText = content || (mediaType ? `[${mediaType}]` : 'ملف');

        await db.ref(`chats/${contactId}/${senderId}`).update({
            last_message_content: previewText,
            last_message_timestamp: timestamp,
            contact_id: senderId, 
            unread_count: admin.database.ServerValue.increment(1) 
        });

        await db.ref(`chats/${senderId}/${contactId}`).update({
            last_message_content: previewText,
            last_message_timestamp: timestamp,
            contact_id: contactId
        });
        
        messageData.timestamp = Date.now(); 
        res.json({ ok: true, message: 'Sent', messageData: messageData });

    } catch (error) {
        res.status(500).json({ ok: false, error: 'Failed to send.' });
    }
});

app.post('/api/mark_read', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { other_id } = req.body; 

    if (!other_id) return res.status(400).json({ ok: false });

    const chatRoomId = [userId, other_id].sort().join('_');
    const messagesRef = db.ref(`messages/${chatRoomId}`);

    try {
        const messagesSnap = await messagesRef.orderByChild('senderId').equalTo(other_id).once('value');
        const updates = {};
        messagesSnap.forEach(childSnap => {
            if (childSnap.val().is_read === false) updates[`${childSnap.key}/is_read`] = true;
        });
        
        if (Object.keys(updates).length > 0) await messagesRef.update(updates);
        await db.ref(`chats/${userId}/${other_id}`).update({ unread_count: 0 });

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false });
    }
});

app.get('/api/users', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const profilesSnap = await db.ref('profiles').once('value');
    const profiles = profilesSnap.val() || {};
    const usersList = Object.values(profiles)
        .filter(user => user.id !== currentUserId)
        .map(user => ({
          id: user.id, username: user.username, 
          profile_picture_url: user.profile_picture_url || 'https://via.placeholder.com/40'
        }));
    res.json({ ok: true, users: usersList });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedUserId = req.query.userId || currentUserId; 
  try {
    const profileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
    const profileData = profileSnap.val();
    if (!profileData) return res.status(404).json({ ok: false });
    res.json({ ok: true, ...profileData, is_owner: requestedUserId === currentUserId });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/profile/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    try {
        const profileSnap = await db.ref('profiles').child(userId).once('value');
        const profile = profileSnap.val();
        if (!profile) return res.status(404).json({ ok: false });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ ok: false });
    }
});

// Posts stubs to prevent errors
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => { res.json({ ok: true }); });

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ ok: false, error: err.message });
  next(err);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
