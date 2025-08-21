// تشغيل مكتبة dotenv لقراءة متغيرات البيئة من ملف .env محلياً
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const FirebaseStore = require('connect-session-firebase')(session);
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cloudinary Configuration using Environment Variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Multer setup for file uploads using Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      if (req.originalUrl.includes('/register')) {
        return 'profile_pics';
      } else if (req.originalUrl.includes('/messages/send')) {
        return 'chat_media';
      }
      return 'general';
    },
    public_id: (req, file) => Date.now() + '-' + file.originalname.split('.')[0],
    resource_type: 'auto',
  },
});

const upload = multer({ storage: storage });

// Load service account key from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const firebaseAuth = getAuth();
const db = getDatabase();

const app = express();
const port = process.env.PORT || 3000;

// ---------------- Middleware ----------------
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// إعدادات الجلسة (session) الجديدة مع Firebase
app.use(session({
  store: new FirebaseStore({
    database: db.ref('sessions')
  }),
  name: '__session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    // هذه الإعدادات ضرورية لتطبيق Capacitor
    sameSite: 'none',
    secure: true,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// ---------------- Authentication helper ----------------
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // إذا كان المسار هو API، أرسل استجابة 401 Unauthorized بتنسيق JSON
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User session not found or expired.' });
  }

  // خلاف ذلك، أعد التوجيه إلى صفحة تسجيل الدخول
  return res.redirect('/login.html');
}

// ---------------- Routes: pages ----------------
app.use(express.static(path.join(__dirname, 'views')));
app.get('/', (req, res) => res.redirect('/splash.html'));

app.get('/chat_list.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chat_list.html'));
});

app.get('/chat.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});

app.get('/profile.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// ---------------- Auth Routes ----------------
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' });
  }

  try {
    const userSnapshot = await db.ref('profiles').orderByChild('username').equalTo(username.toLowerCase()).once('value');
    if (!userSnapshot.exists()) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحين.' });
    }

    const userData = Object.values(userSnapshot.val())[0];
    const user = await firebaseAuth.getUserByEmail(userData.email);

    // التحقق من كلمة المرور
    const userAuth = await firebaseAuth.signInWithEmailAndPassword(user.email, password);
    
    req.session.userId = userAuth.user.uid;
    res.json({ success: true, user: { uid: userAuth.user.uid, username: userData.username } });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول. يرجى التأكد من بياناتك.' });
  }
});

app.post('/register', upload.single('profile_picture'), async (req, res) => {
  const { username, email, full_name, password } = req.body;
  const profilePicture = req.file;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'اسم المستخدم والبريد الإلكتروني وكلمة المرور مطلوبة.' });
  }

  try {
    const userRecord = await firebaseAuth.createUser({
      email,
      password,
      displayName: username,
    });

    const uid = userRecord.uid;
    const profile_picture_url = profilePicture ? profilePicture.path : 'https://res.cloudinary.com/duixjs8az/image/upload/v1/profile_pics/default_profile.png';
    const creation_time = new Date().toISOString();

    const newProfile = {
      uid: uid,
      username: username.toLowerCase(),
      full_name: full_name || username,
      email: email,
      profile_picture_url: profile_picture_url,
      is_online: true,
      creation_time: creation_time
    };

    await db.ref(`profiles/${uid}`).set(newProfile);
    req.session.userId = uid;
    res.status(201).json({ success: true, user: newProfile });

  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      return res.status(409).json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل.' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('__session');
    res.redirect('/login.html');
  });
});

// ---------------- API Routes ----------------
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedUserId = req.query.user_id || currentUserId;
  const defaultProfileUrl = 'https://via.placeholder.com/150';

  try {
    const [profileSnapshot, userSnapshot] = await Promise.all([
      db.ref('profiles/' + requestedUserId).once('value'),
      db.ref('users/' + requestedUserId).once('value')
    ]);
    
    const profileData = profileSnapshot.val() || {};
    const userData = userSnapshot.val() || {};

    const fullProfile = {
      id: requestedUserId,
      username: profileData.username || userData.username || userData.displayName || '',
      full_name: profileData.full_name || userData.full_name || userData.displayName || '',
      email: profileData.email || userData.email || '',
      profile_picture_url: profileData.profile_picture_url || userData.profile_picture_url || defaultProfileUrl,
      is_online: !!(profileData.is_online || userData.is_online),
      is_verified: !!(profileData.is_verified || userData.is_verified)
    };

    res.json(fullProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.get('/api/chat_list', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const defaultProfileUrl = 'https://via.placeholder.com/150';

  try {
    const [profilesSnapshot, usersSnapshot, messagesSnapshot] = await Promise.all([
      db.ref('profiles').once('value'),
      db.ref('users').once('value'),
      db.ref('messages').once('value')
    ]);

    const profiles = profilesSnapshot.val() || {};
    const users = usersSnapshot.val() || {};
    const allMessages = messagesSnapshot.val() || {};

    const map = {};

    Object.keys(users).forEach(uid => {
      map[uid] = {
        id: uid,
        username: users[uid].username || users[uid].displayName || '',
        full_name: users[uid].full_name || users[uid].displayName || '',
        profile_picture_url: users[uid].profile_picture_url || users[uid].photoURL || defaultProfileUrl,
        is_online: !!users[uid].is_online,
        is_verified: !!users[uid].is_verified
      };
    });

    Object.keys(profiles).forEach(uid => {
      map[uid] = {
        id: uid,
        username: profiles[uid].username || (map[uid] && map[uid].username) || '',
        full_name: profiles[uid].full_name || (map[uid] && map[uid].full_name) || '',
        profile_picture_url: profiles[uid].profile_picture_url || (map[uid] && map[uid].profile_picture_url) || defaultProfileUrl,
        is_online: !!profiles[uid].is_online,
        is_verified: !!profiles[uid].is_verified
      };
    });

    const results = [];
    for (const uid of Object.keys(map)) {
      if (uid === currentUserId) continue;

      const p = map[uid];

      let lastMessage = null;
      Object.values(allMessages).forEach(msg => {
        if (!msg) return;
        if ((msg.sender_id === currentUserId && msg.receiver_id === uid) ||
            (msg.sender_id === uid && msg.receiver_id === currentUserId)) {
          if (!lastMessage || new Date(msg.created_at) > new Date(lastMessage.created_at)) {
            lastMessage = msg;
          }
        }
      });

      const last = lastMessage;
      let lastMessageText = 'بدء محادثة جديدة';
      if (last) {
        if (last.content) {
            lastMessageText = last.content;
        } else if (last.media_type === 'audio') {
            lastMessageText = 'قام بارسال رسالة صوتية';
        } else if (last.media_type === 'image') {
            lastMessageText = 'قام بارسال صورة';
        } else if (last.media_type === 'video') {
            lastMessageText = 'قام بارسال فيديو';
        } else if (last.media_url) {
            lastMessageText = 'ملف مرفق';
        }
      }
      
      const is_new = !!(last && last.sender_id !== currentUserId && !last.is_read);

      results.push({
        user: {
          id: p.id,
          username: p.username,
          full_name: p.full_name || null,
          profile_picture_url: p.profile_picture_url || defaultProfileUrl,
          is_online: !!p.is_online,
          is_verified: !!p.is_verified
        },
        last_message: lastMessageText,
        last_time: last ? last.created_at : null,
        is_new: is_new
      });
    }

    results.sort((a, b) => {
      if (a.is_new === b.is_new) {
        const at = a.last_time ? new Date(a.last_time).getTime() : 0;
        const bt = b.last_time ? new Date(b.last_time).getTime() : 0;
        if (at === bt) {
          const an = (a.user.username || '').toLowerCase();
          const bn = (b.user.username || '').toLowerCase();
          return an < bn ? -1 : (an > bn ? 1 : 0);
        }
        return bt - at;
      }
      return a.is_new ? -1 : 1;
    });

    res.json(results);
  } catch (err) {
    console.error('/api/chat_list error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/messages/:other_id', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const otherId = req.params.other_id;

  try {
    const messagesSnapshot = await db.ref('messages').orderByChild('created_at').once('value');
    const allMessages = messagesSnapshot.val() || {};

    const chatMessages = Object.values(allMessages).filter(msg =>
      (msg.sender_id === currentUserId && msg.receiver_id === otherId) ||
      (msg.sender_id === otherId && msg.receiver_id === currentUserId)
    );

    res.json(chatMessages);
  } catch (err) {
    console.error('/api/messages/:other_id error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/messages/send', upload.single('media'), requireAuth, async (req, res) => {
  console.log('API call to /api/messages/send received.');
  const currentUserId = req.session.userId;
  const { other_id, content, replied_to_id, replied_to_content, replied_to_sender } = req.body;
  let media_url = null;
  let media_type = 'text';

  // Check if session user ID is correct
  console.log('Current User ID:', currentUserId);

  try {
    if (req.file) {
      media_url = req.file.path;
      if (req.file.mimetype) {
        if (req.file.mimetype.startsWith('audio/')) {
          media_type = 'audio';
        } else if (req.file.mimetype.startsWith('video/')) {
          media_type = 'video';
        } else if (req.file.mimetype.startsWith('image/')) {
          media_type = 'image';
        } else {
          media_type = 'raw';
        }
      } else {
        console.warn('File uploaded without mimetype. Setting to "raw".');
        media_type = 'raw';
      }
      console.log('Media file received. Path:', media_url);
    }

    if (!other_id || (!content && !media_url)) {
      console.log('Missing other_id or content/media.');
      return res.status(400).json({ error: 'other_id and content or media are required' });
    }

    const messagesRef = db.ref('messages');
    const newMessageRef = messagesRef.push();

    const payload = {
      id: newMessageRef.key,
      sender_id: currentUserId,
      receiver_id: other_id,
      content: content || '',
      created_at: new Date().toISOString(),
      is_read: false,
      media_url: media_url,
      media_type: media_type
    };

    if (replied_to_id) {
      payload.replied_to_id = replied_to_id;
      payload.replied_to_content = replied_to_content;
      payload.replied_to_sender = replied_to_sender;
    }

    console.log('Payload for message:', payload);
    await newMessageRef.set(payload);
    console.log('Message sent successfully. Responding with JSON.');
    res.status(200).send(JSON.stringify({ ok: true, message: payload }));
  } catch (err) {
    console.error('/api/messages/send error:', err);
    console.log('Responding with an error status.');
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.post('/api/mark_read', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const { other_id } = req.body;
  if (!other_id) return res.status(400).json({ error: 'other_id is required' });

  try {
    const messagesSnapshot = await db.ref('messages').orderByChild('receiver_id').equalTo(currentUserId).once('value');
    const messagesToUpdate = messagesSnapshot.val() || {};

    const updates = {};
    let updatedCount = 0;

    Object.keys(messagesToUpdate).forEach(key => {
      const msg = messagesToUpdate[key];
      if (msg.sender_id === other_id && !msg.is_read) {
        updates[`/messages/${key}/is_read`] = true;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await db.ref().update(updates);
    }

    res.json({ ok: true, updated: updatedCount });
  } catch (err) {
    console.error('/api/mark_read error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// New search endpoint
app.get('/api/users/search', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const searchQuery = query.toLowerCase();

  const defaultProfileUrl = 'https://via.placeholder.com/150';
  
  try {
    const [profilesSnapshot, usersSnapshot] = await Promise.all([
      db.ref('profiles').once('value'),
      db.ref('users').once('value')
    ]);
    const profiles = profilesSnapshot.val() || {};
    const users = usersSnapshot.val() || {};

    const map = {};
    const foundUsers = [];

    // Combine data from 'users' and 'profiles'
    Object.keys(users).forEach(uid => {
      map[uid] = {
        uid: uid,
        username: users[uid].username || users[uid].displayName || '',
        full_name: users[uid].full_name || users[uid].displayName || '',
        profile_picture_url: users[uid].profile_picture_url || users[uid].photoURL || defaultProfileUrl,
        is_online: !!users[uid].is_online,
        is_verified: !!users[uid].is_verified
      };
    });

    Object.keys(profiles).forEach(uid => {
      map[uid] = {
        uid: uid,
        username: profiles[uid].username || (map[uid] && map[uid].username) || '',
        full_name: profiles[uid].full_name || (map[uid] && map[uid].full_name) || '',
        profile_picture_url: profiles[uid].profile_picture_url || (map[uid] && map[uid].profile_picture_url) || defaultProfileUrl,
        is_online: !!profiles[uid].is_online,
        is_verified: !!profiles[uid].is_verified
      };
    });

    // Filter users based on search query
    Object.values(map).forEach(user => {
      if (user.uid === currentUserId) return;
      if (
        (user.username && user.username.toLowerCase().includes(searchQuery)) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchQuery))
      ) {
        foundUsers.push(user);
      }
    });

    res.status(200).json(foundUsers);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

app.get('/api/users', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const defaultProfileUrl = 'https://via.placeholder.com/150';

  try {
    const [profilesSnapshot, usersSnapshot] = await Promise.all([
      db.ref('profiles').once('value'),
      db.ref('users').once('value')
    ]);
    const profiles = profilesSnapshot.val() || {};
    const users = usersSnapshot.val() || {};

    const map = {};

    Object.keys(users).forEach(uid => {
      map[uid] = {
        uid: uid,
        username: users[uid].username || users[uid].displayName || '',
        full_name: users[uid].full_name || users[uid].displayName || '',
        profile_picture_url: users[uid].profile_picture_url || users[uid].photoURL || defaultProfileUrl,
        is_online: !!users[uid].is_online,
        is_verified: !!users[uid].is_verified
      };
    });

    Object.keys(profiles).forEach(uid => {
      map[uid] = {
        uid: uid,
        username: profiles[uid].username || (map[uid] && map[uid].username) || '',
        full_name: profiles[uid].full_name || (map[uid] && map[uid].full_name) || '',
        profile_picture_url: profiles[uid].profile_picture_url || (map[uid] && map[uid].profile_picture_url) || defaultProfileUrl,
        is_online: !!profiles[uid].is_online,
        is_verified: !!profiles[uid].is_verified
      };
    });

    const usersList = Object.keys(map)
      .filter(uid => uid !== currentUserId)
      .map(uid => ({ uid, ...map[uid] }));

    res.status(200).json(usersList);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/debug/session', (req, res) => {
  res.json({
    ok: true,
    hasSession: !!(req.session && req.session.userId),
    userId: req.session.userId || null,
    cookies: req.headers.cookie || null,
    nodeEnv: process.env.NODE_ENV,
    isSecure: req.secure,
    proxySetting: app.get('trust proxy')
  });
});

app.get('/api/debug/raw_profiles', requireAuth, async (req, res) => {
  try {
    const snap = await db.ref('profiles').once('value');
    res.json({ ok: true, count: snap.numChildren(), data: snap.val() });
  } catch (err) {
    console.error('raw_profiles error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/debug/raw_users', requireAuth, async (req, res) => {
  try {
    const snap = await db.ref('users').once('value');
    res.json({ ok: true, count: snap.numChildren(), data: snap.val() });
  } catch (err) {
    console.error('raw_users error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// ---------------- Error handling middleware for Multer ----------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload failed', message: err.message });
  } else if (err) {
    console.error('General error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
  next();
});

// بدء الخادم
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
