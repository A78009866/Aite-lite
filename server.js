// server.js

// تشغيل مكتبة dotenv لقراءة متغيرات البيئة من ملف .env محلياً
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

const DEFAULT_PROFILE_PIC_URL = 'https://res.cloudinary.com/duixjs8az/image/upload/v1765009560/post_media/1765009560909-default_profile.png';

// إعدادات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// إعدادات Multer مع CloudinaryStorage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = 'general';

    // تحسين منطق تحديد المجلد
    const url = (req && req.originalUrl) ? req.originalUrl : '';
    if (file.fieldname === 'profile_picture') {
      folderName = 'profile_pics';
    } else if (file.fieldname === 'cover_photo') {
      folderName = 'cover_photos';
    } else if (url.includes('/messages/send')) {
      folderName = 'chat_media';
    } else if (url.includes('/api/posts/create')) {
      folderName = 'post_media';
    } else if (url.includes('/register')) {
      folderName = 'profile_pics';
    } else if (url.includes('/api/reels') || url.includes('/create-reel') || url.includes('/api/reels/create')) {
      folderName = 'reels';
    }

    let format = undefined;
    if (file.mimetype && file.mimetype.startsWith('audio/')) {
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

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY || '{}');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://trimer-4081b-default-rtdb.firebaseio.com",
  });
}

const firebaseAuth = getAuth();
const db = getDatabase();

const app = express();
const port = process.env.PORT || 3000;

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
  secret: process.env.SESSION_SECRET || 'a-firebase-secret-key-is-better',
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

// ---------------- Admin middleware (جديد) ----------------
// يسمح فقط للمستخدم الذي يطابق ADMIN_UID أو ADMIN_USERNAME بالوصول
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    return res.redirect('/login');
  }

  const adminUid = process.env.ADMIN_UID || null; // ضع UID الخاص بك في .env للاستخدام الأفضل
  const adminUsername = process.env.ADMIN_USERNAME || 'brahim1582007'; // اسم المستخدم الافتراضي للأدمن

  const email = req.session.email || '';
  const usernameFromEmail = email.split('@')[0]; // username@trimer.io

  const isAdmin = (adminUid && req.session.userId === adminUid) || (usernameFromEmail === adminUsername);

  if (!isAdmin) {
    if (req.path.startsWith('/api/')) return res.status(403).json({ ok: false, error: 'Forbidden' });
    return res.status(403).send('403 Forbidden — ليس لديك صلاحية الوصول لهذه الصفحة.');
  }
  next();
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
app.get('/users_list', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'users_list.html')); }); // friends (chats) list
app.get('/all_users', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'all_users.html')); }); // all users + requests
app.get('/chat', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat.html')); });
app.get('/chat.html', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat.html')); });

app.get('/profile/:userId?', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});
app.get('/edit_profile', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'edit_profile.html')); });
app.get('/create-post', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'create_post.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'login.html')); });
app.get('/register', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'register.html')); });

// Reels pages
app.get('/reels', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'reels.html')); });
app.get('/create-reel', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'create_reel.html')); });

// Notifications page
app.get('/notifications', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'notifications.html')); });

// ---------------- Admin Page route (جديد) ----------------
// الصفحة محمية بطبقة requireAuth ثم requireAdmin
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

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
    
    // Set Online on Login
    await db.ref(`profiles/${userRecord.uid}`).update({
      is_online: true,
      last_seen: admin.database.ServerValue.TIMESTAMP
    });

    res.redirect('/chat_list');
  } catch (error) {
    res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
  }
});

// استبدل هذا الجزء في server.js
app.post('/register', upload.fields([{ name: 'profile_picture' }, { name: 'cover_photo' }]), async (req, res) => {
  const { username, password, full_name } = req.body; // إضافة full_name هنا
  let profile_picture_url = DEFAULT_PROFILE_PIC_URL; // استخدام الثابت المحدد في بداية الملف
  let cover_photo_url = ''; // افتراضي فارغ

  try {
    if (!username || !password) {
      return res.redirect('/register?error=' + encodeURIComponent('Required fields missing.'));
    }
    const email = `${username}@trimer.io`;

    // معالجة الصور المرفوعة
    if (req.files) {
      if (req.files.profile_picture) {
        profile_picture_url = req.files.profile_picture[0].path;
      }
      if (req.files.cover_photo) {
        cover_photo_url = req.files.cover_photo[0].path;
      }
    }

    const userRecord = await firebaseAuth.createUser({
      email: email, password: password, displayName: username, photoURL: profile_picture_url
    });

    const profileData = {
      id: userRecord.uid, 
      username: username, 
      full_name: full_name || username, // حفظ الاسم الكامل أو اسم المستخدم كاحتياط
      email: email,
      profile_picture_url: profile_picture_url, 
      cover_photo_url: cover_photo_url, // حفظ صورة الغلاف
      is_online: true, 
      is_verified: false, 
      bio: '',
      last_seen: admin.database.ServerValue.TIMESTAMP,
      postsCount: 0
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


app.get('/logout', async (req, res) => {
  // Set Offline on Logout
  if (req.session && req.session.userId) {
    try {
      await db.ref(`profiles/${req.session.userId}`).update({
        is_online: false,
        last_seen: admin.database.ServerValue.TIMESTAMP
      });
    } catch (e) {
      console.error('Error setting offline on logout', e);
    }
  }

  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// ---------------- Active Status Heartbeat ----------------
// استقبال إشارة النشاط من العميل
app.post('/api/status/heartbeat', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    await db.ref(`profiles/${userId}`).update({
      is_online: true,
      last_seen: admin.database.ServerValue.TIMESTAMP
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// ---------------- Helper: Friend Utilities ----------------
async function areFriends(userA, userB) {
  if (!userA || !userB) return false;
  const snap = await db.ref(`friends/${userA}/${userB}`).once('value');
  return snap.exists();
}

// ---------------- Helper: Normalize stored comments ----------------
function normalizeStoredComment(val) {
  // val: raw object from DB
  const commentId = val.commentId || val.id || val.key || '';
  const content = val.content || val.commentContent || val.text || '';
  const timestamp = (typeof val.timestamp === 'number') ? val.timestamp : (val.timestamp ? Number(val.timestamp) : Date.now());

  let user = {};
  if (val.user && typeof val.user === 'object') {
    user.userId = val.user.userId || val.user.id || val.user.uid || val.userId || '';
    user.username = val.user.username || val.user.displayName || val.user.name || val.username || 'مستخدم';
    user.profile_picture_url = val.user.profile_picture_url || val.user.photoURL || val.profile_picture_url || DEFAULT_PROFILE_PIC_URL;
  } else {
    user.userId = val.userId || val.userID || val.from_user_id || '';
    user.username = val.username || val.from_username || 'مستخدم';
    user.profile_picture_url = val.profile_picture_url || DEFAULT_PROFILE_PIC_URL;
  }

  user.userId = user.userId || '';
  user.username = user.username || 'مستخدم';
  user.profile_picture_url = user.profile_picture_url || DEFAULT_PROFILE_PIC_URL;

  return {
    commentId,
    postId: val.postId || '',
    content,
    timestamp,
    user
  };
}

// ---------------- API: Admin endpoints (جديد) ----------------

// Get all users (only admin)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap = await db.ref('profiles').once('value');
    const profiles = snap.val() || {};
    const users = Object.values(profiles).map(u => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      profile_picture_url: u.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
      is_online: !!u.is_online,
      is_verified: !!u.is_verified,
      bio: u.bio || ''
    }));
    res.json({ ok: true, users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المستخدمين.' });
  }
});

// Verify/unverify a user (only admin)
// body: { verify: true/false }  (if omitted defaults to true)
app.post('/api/admin/users/:userId/verify', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const verify = req.body && typeof req.body.verify !== 'undefined' ? !!req.body.verify : true;

  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });

  try {
    const profileRef = db.ref(`profiles/${userId}`);
    const snap = await profileRef.once('value');
    if (!snap.exists()) return res.status(404).json({ ok: false, error: 'User not found' });

    await profileRef.update({ is_verified: verify });

    // optional: return updated profile
    const updatedSnap = await profileRef.once('value');
    const updatedProfile = updatedSnap.val();

    res.json({ ok: true, user: { id: updatedProfile.id, username: updatedProfile.username, is_verified: !!updatedProfile.is_verified } });
  } catch (error) {
    console.error('Error updating verification:', error);
    res.status(500).json({ ok: false, error: 'فشل في تحديث حالة التحقق.' });
  }
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
      contact_profile: profiles[chat.contact_id] || { username: 'مستخدم', profile_picture_url: 'https://via.placeholder.com/40', is_online: false }
    }));

    finalChats.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp);
    res.json({ ok: true, chats: finalChats });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'فشل في جلب المحادثات.' });
  }
});

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

  // Enforce friendship: cannot send unless friends
  try {
    const isFriend = await areFriends(senderId, contactId);
    if (!isFriend) {
      return res.status(403).json({ ok: false, error: 'You can only message friends.' });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Failed to verify friendship.' });
  }

  if (req.file) {
    mediaUrl = req.file.path;
    if (req.file.mimetype && req.file.mimetype.startsWith('image/')) mediaType = 'image';
    else if (req.file.mimetype && req.file.mimetype.startsWith('video/')) mediaType = 'video';
    else if (req.file.mimetype && req.file.mimetype.startsWith('audio/') || req.file.originalname.endsWith('.webm')) mediaType = 'audio';
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

    // تحديث ملخص الدردشة للمرسل إليه (زيادة عداد غير المقروء)
    await db.ref(`chats/${contactId}/${senderId}`).update({
      last_message_content: previewText,
      last_message_timestamp: timestamp,
      contact_id: senderId,
      unread_count: admin.database.ServerValue.increment(1),
      last_message_sender_id: senderId
    });

    // تحديث ملخص الدردشة للمرسل (العداد يبقى 0)
    await db.ref(`chats/${senderId}/${contactId}`).update({
      last_message_content: previewText,
      last_message_timestamp: timestamp,
      contact_id: contactId,
      unread_count: 0,
      last_message_sender_id: senderId
    });

    // Convert timestamp to numeric for response
    const now = Date.now();
    messageData.timestamp = now;
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

// ---------------- API: Users & Profile ----------------
// /api/users -> returns friends only
app.get('/api/users', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const friendsSnap = await db.ref(`friends/${currentUserId}`).once('value');
    const friendsObj = friendsSnap.val() || {};
    const friendIds = Object.keys(friendsObj);
    if (friendIds.length === 0) return res.json({ ok: true, users: [] });

    const profilePromises = friendIds.map(id => db.ref(`profiles/${id}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);
    const profiles = profileSnapshots.map(snap => snap.val() || {});
    const allChatsSnap = await db.ref(`chats/${currentUserId}`).once('value');
    const allChats = allChatsSnap.val() || {};

    const usersList = profiles.map((user) => {
      const contactId = user.id;
      const chatSummary = allChats[contactId] || {};
      let lastMessage = null;
      if (chatSummary.last_message_content) {
        lastMessage = {
          content: chatSummary.last_message_content,
          timestamp: chatSummary.last_message_timestamp,
          senderId: chatSummary.last_message_sender_id
        };
      }
      return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        profile_picture_url: user.profile_picture_url || 'https://via.placeholder.com/40',
        last_message: lastMessage,
        unread_count: chatSummary.unread_count || 0,
        is_online: !!user.is_online
      };
    });

    res.json({ ok: true, users: usersList });

  } catch (error) {
    console.error('Error in /api/users:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب قائمة الأصدقاء.' });
  }
});

// /api/users/all -> all users with is_friend/request flags
app.get('/api/users/all', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const profilesSnap = await db.ref('profiles').once('value');
    const profiles = profilesSnap.val() || {};
    const users = Object.values(profiles).filter(u => u.id !== currentUserId).map(user => ({ id: user.id, username: user.username, full_name: user.full_name, profile_picture_url: user.profile_picture_url || DEFAULT_PROFILE_PIC_URL, is_online: !!user.is_online }));
    const full = await Promise.all(users.map(async (u) => {
      const isFriendSnap = await db.ref(`friends/${currentUserId}/${u.id}`).once('value');
      const outgoing = await db.ref(`friend_requests/${u.id}/${currentUserId}`).once('value'); // request I sent to them
      const incoming = await db.ref(`friend_requests/${currentUserId}/${u.id}`).once('value'); // request they sent to me
      return { ...u, is_friend: isFriendSnap.exists(), request_sent: outgoing.exists(), request_received: incoming.exists() };
    }));
    res.json({ ok: true, users: full });
  } catch (error) {
    console.error('Error /api/users/all', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المستخدمين.' });
  }
});

// ---------------- API: Friends & Requests ----------------

// Send friend request
app.post('/api/friends/request', requireAuth, async (req, res) => {
  const fromId = req.session.userId;
  const { to_id } = req.body;
  if (!to_id) return res.status(400).json({ ok: false, error: 'to_id required' });
  if (fromId === to_id) return res.status(400).json({ ok: false, error: 'Cannot friend yourself' });

  try {
    const already = await areFriends(fromId, to_id);
    if (already) return res.status(409).json({ ok: false, error: 'Already friends' });

    const outgoing = await db.ref(`friend_requests/${to_id}/${fromId}`).once('value');
    if (outgoing.exists()) return res.status(409).json({ ok: false, error: 'Request already sent' });

    await db.ref(`friend_requests/${to_id}/${fromId}`).set({ from: fromId, timestamp: admin.database.ServerValue.TIMESTAMP });

    try {
      const fromProfileSnap = await db.ref(`profiles/${fromId}`).once('value');
      const fromProfile = fromProfileSnap.val() || {};
      const notifRef = db.ref(`notifications/${to_id}`).push();
      const notifData = {
        id: notifRef.key,
        type: 'friend_request',
        from_user_id: fromId,
        from_username: fromProfile.username || 'مستخدم',
        from_profile_picture_url: fromProfile.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        is_read: false
      };
      await notifRef.set(notifData);
    } catch (nerr) {
      console.error('Failed to create friend_request notification:', nerr);
    }

    res.json({ ok: true, message: 'Request sent' });
  } catch (error) {
    console.error('Error sending friend request', error);
    res.status(500).json({ ok: false, error: 'Failed to send request' });
  }
});

// Accept friend request
app.post('/api/friends/accept', requireAuth, async (req, res) => {
  const toId = req.session.userId;
  const { from_id } = req.body;
  if (!from_id) return res.status(400).json({ ok: false, error: 'from_id required' });

  try {
    const requestSnap = await db.ref(`friend_requests/${toId}/${from_id}`).once('value');
    if (!requestSnap.exists()) return res.status(404).json({ ok: false, error: 'Request not found' });

    const ts = admin.database.ServerValue.TIMESTAMP;

    await db.ref(`friends/${toId}/${from_id}`).set({ since: ts });
    await db.ref(`friends/${from_id}/${toId}`).set({ since: ts });

    await db.ref(`friend_requests/${toId}/${from_id}`).remove();
    await db.ref(`friend_requests/${from_id}/${toId}`).remove();

    try {
      const fromProfileSnap = await db.ref(`profiles/${toId}`).once('value');
      const fromProfile = fromProfileSnap.val() || {};
      const notifRef = db.ref(`notifications/${from_id}`).push();
      const notifData = {
        id: notifRef.key,
        type: 'friend_accept',
        from_user_id: toId,
        from_username: fromProfile.username || 'مستخدم',
        from_profile_picture_url: fromProfile.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        is_read: false
      };
      await notifRef.set(notifData);
    } catch (nerr) {
      console.error('Failed to create friend_accept notification:', nerr);
    }

    res.json({ ok: true, message: 'Friend added' });
  } catch (error) {
    console.error('Error accepting friend request', error);
    res.status(500).json({ ok: false });
  }
});

// Reject/Decline friend request
app.post('/api/friends/reject', requireAuth, async (req, res) => {
  const toId = req.session.userId;
  const { from_id } = req.body;
  if (!from_id) return res.status(400).json({ ok: false, error: 'from_id required' });

  try {
    await db.ref(`friend_requests/${toId}/${from_id}`).remove();
    res.json({ ok: true });
  } catch (error) {
    console.error('Error rejecting friend request', error);
    res.status(500).json({ ok: false });
  }
});

// Cancel outgoing friend request
app.post('/api/friends/cancel', requireAuth, async (req, res) => {
  const fromId = req.session.userId;
  const { to_id } = req.body;
  if (!to_id) return res.status(400).json({ ok: false, error: 'to_id required' });

  try {
    await db.ref(`friend_requests/${to_id}/${fromId}`).remove();
    res.json({ ok: true });
  } catch (error) {
    console.error('Error cancelling friend request', error);
    res.status(500).json({ ok: false });
  }
});

// Get friend requests incoming
app.get('/api/friends/requests', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const snap = await db.ref(`friend_requests/${userId}`).once('value');
    const items = [];
    snap.forEach(child => {
      const fromId = child.key;
      const val = child.val();
      items.push({ from: fromId, timestamp: val.timestamp || 0 });
    });

    const profiles = await Promise.all(items.map(i => db.ref(`profiles/${i.from}`).once('value')));
    const out = items.map((it, idx) => {
      const p = profiles[idx].val() || {};
      return { from: it.from, timestamp: it.timestamp, username: p.username || 'مستخدم', profile_picture_url: p.profile_picture_url || DEFAULT_PROFILE_PIC_URL };
    });

    res.json({ ok: true, requests: out });
  } catch (error) {
    console.error('Error getting friend requests', error);
    res.status(500).json({ ok: false });
  }
});

// Count incoming requests
app.get('/api/friends/requests_count', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const snap = await db.ref(`friend_requests/${userId}`).once('value');
    let count = 0;
    snap.forEach(() => count++);
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Error counting friend requests', error);
    res.status(500).json({ ok: false });
  }
});

// Get current user's friends with minimal data
app.get('/api/friends', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const friendsSnap = await db.ref(`friends/${currentUserId}`).once('value');
    const friendsObj = friendsSnap.val() || {};
    const friendIds = Object.keys(friendsObj);
    if (friendIds.length === 0) return res.json({ ok: true, friends: [] });

    const profilePromises = friendIds.map(id => db.ref(`profiles/${id}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);
    const friendsList = profileSnapshots.map(snap => snap.val() || {});
    res.json({ ok: true, friends: friendsList });
  } catch (error) {
    console.error('Error fetching friends', error);
    res.status(500).json({ ok: false });
  }
});

// ---------------- API: Profile ----------------
app.get('/api/profile', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedUserId = req.query.userId || currentUserId;
  try {
    const profileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
    const profileData = profileSnap.val();
    if (!profileData) return res.status(404).json({ ok: false });

    let isOwner = requestedUserId === currentUserId;
    let isFriend = false;
    let requestSent = false;
    let requestReceived = false;
    try {
      if (!isOwner) {
        const friendSnap = await db.ref(`friends/${currentUserId}/${requestedUserId}`).once('value');
        isFriend = friendSnap.exists();
        const outgoing = await db.ref(`friend_requests/${requestedUserId}/${currentUserId}`).once('value');
        requestSent = outgoing.exists();
        const incoming = await db.ref(`friend_requests/${currentUserId}/${requestedUserId}`).once('value');
        requestReceived = incoming.exists();
      }
    } catch (e) { /* ignore */ }

    res.json({ ok: true, ...profileData, is_owner: isOwner, is_friend: isFriend, request_sent: requestSent, request_received: requestReceived });
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

// Profile edit (supports multipart)
const uploadProfileFields = upload.fields([
  { name: 'profile_picture', maxCount: 1 },
  { name: 'cover_photo', maxCount: 1 }
]);

app.post('/api/profile/edit', requireAuth, uploadProfileFields, async (req, res) => {
  const userId = req.session.userId;
  const { full_name, username, bio } = req.body;

  if (!username || !full_name) {
    return res.status(400).json({ ok: false, error: 'اسم المستخدم والاسم الكامل مطلوبان.' });
  }

  const updates = {
    full_name: full_name,
    bio: bio,
    username: username,
  };

  try {
    const currentProfileSnap = await db.ref(`profiles/${userId}`).once('value');
    const currentUsername = currentProfileSnap.val().username;

    if (username !== currentUsername) {
      const existingUsernameSnap = await db.ref('profiles')
        .orderByChild('username')
        .equalTo(username)
        .once('value');

      let isUsernameTaken = false;
      existingUsernameSnap.forEach(snap => {
        if (snap.key !== userId) {
          isUsernameTaken = true;
        }
      });

      if (isUsernameTaken) {
        return res.status(409).json({ ok: false, error: 'اسم المستخدم هذا مأخوذ بالفعل.' });
      }

      const newEmail = `${username}@trimer.io`;
      await firebaseAuth.updateUser(userId, {
        displayName: username,
        email: newEmail
      });
      updates.email = newEmail;
    }

    if (req.files && req.files.profile_picture) {
      updates.profile_picture_url = req.files.profile_picture[0].path;
    }
    if (req.files && req.files.cover_photo) {
      updates.cover_photo_url = req.files.cover_photo[0].path;
    }

    await db.ref(`profiles/${userId}`).update(updates);

    res.json({ ok: true, message: 'تم تحديث الملف الشخصي بنجاح.' });

  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.code === 'auth/invalid-email' || error.code === 'auth/email-already-in-use' || error.message && error.message.includes('A user with the provided email already exists')) {
      return res.status(409).json({ ok: false, error: 'اسم المستخدم غير صالح أو مأخوذ.' });
    }
    res.status(500).json({ ok: false, error: 'فشل في تحديث الملف الشخصي.' });
  }
});

// ---------------- API: Posts ----------------

// Create post
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
  const userId = req.session.userId;
  const content = req.body.content ? req.body.content.trim() : '';
  let mediaUrl = null;
  let mediaType = null;

  if (content.length === 0 && !req.file) {
    return res.status(400).json({ ok: false, error: 'المحتوى مطلوب.' });
  }

  if (req.file) {
    mediaUrl = req.file.path;
    const mimeType = req.file.mimetype || '';
    if (mimeType.startsWith('image/')) mediaType = 'image';
    else if (mimeType.startsWith('video/')) mediaType = 'video';
    else if (mimeType.startsWith('audio/')) mediaType = 'audio';
    else mediaType = 'raw';
  }

  try {
    const newPostRef = db.ref('posts').push();
    const postId = newPostRef.key;
    const timestamp = admin.database.ServerValue.TIMESTAMP;

    const postData = {
      postId: postId,
      userId: userId,
      content: content,
      timestamp: timestamp,
      likes: 0,
      commentsCount: 0,
      media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
    };

    await newPostRef.set(postData);

    const userPostsCountRef = db.ref(`profiles/${userId}/postsCount`);
    await userPostsCountRef.transaction((currentCount) => (currentCount || 0) + 1);

    res.json({ ok: true, message: 'تم النشر', postId: postId });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ ok: false, error: 'فشل في إنشاء المنشور.' });
  }
});

// Get posts (feed)
app.get('/api/posts', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const postsSnap = await db.ref('posts')
      .orderByChild('timestamp')
      .limitToLast(50)
      .once('value');

    let posts = [];
    postsSnap.forEach(childSnap => {
      posts.push(childSnap.val());
    });
    posts.reverse();

    const userIds = [...new Set(posts.map(p => p.userId))];
    const profiles = {};
    const defaultProfileUrl = DEFAULT_PROFILE_PIC_URL;

    const profilePromises = userIds.map(userId => db.ref(`profiles/${userId}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
      profiles[userIds[index]] = snap.val();
    });

    const likedStatuses = {};
    const likePromises = posts.map(post => db.ref(`likes/${post.postId}/${currentUserId}`).once('value'));
    const likeSnapshots = await Promise.all(likePromises);

    likeSnapshots.forEach((snap, index) => {
      likedStatuses[posts[index].postId] = snap.val() !== null;
    });

    const finalPosts = posts.map(post => ({
      ...post,
      commentsCount: post.commentsCount || 0,
      is_liked: likedStatuses[post.postId] || false,
      user: {
        username: profiles[post.userId]?.username || 'مستخدم',
        profile_picture_url: profiles[post.userId]?.profile_picture_url || defaultProfileUrl,
        is_online: !!profiles[post.userId]?.is_online,
        is_verified: !!profiles[post.userId]?.is_verified
      }
    }));

    res.json({ ok: true, posts: finalPosts });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
  }
});

// Like/unlike post
app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  if (!postId) return res.status(400).json({ ok: false });

  const postRef = db.ref(`posts/${postId}`);
  const userLikeRef = db.ref(`likes/${postId}/${userId}`);

  try {
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) return res.status(404).json({ ok: false });

    const likeSnapshot = await userLikeRef.once('value');
    const isLiked = likeSnapshot.val();
    let likesUpdate = 0;
    let action = '';

    if (isLiked) {
      await userLikeRef.remove();
      likesUpdate = -1;
      action = 'unliked';
    } else {
      await userLikeRef.set(admin.database.ServerValue.TIMESTAMP);
      likesUpdate = 1;
      action = 'liked';
    }

    let newLikesCount = 0;
    await postRef.child('likes').transaction((currentCount) => {
      newLikesCount = (currentCount || 0) + likesUpdate;
      return newLikesCount < 0 ? 0 : newLikesCount;
    });

    // إنشاء إشعار للمستخدم صاحب المنشور عندما يقوم شخص آخر بالإعجاب
    try {
      const postData = postSnapshot.val();
      if (action === 'liked' && postData.userId && postData.userId !== userId) {
        const fromProfileSnap = await db.ref(`profiles/${userId}`).once('value');
        const fromProfile = fromProfileSnap.val() || {};
        const notifRef = db.ref(`notifications/${postData.userId}`).push();
        const notifData = {
          id: notifRef.key,
          type: 'post_like',
          from_user_id: userId,
          from_username: fromProfile.username || 'مستخدم',
          from_profile_picture_url: fromProfile.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
          postId: postId,
          reelId: null,
          timestamp: admin.database.ServerValue.TIMESTAMP,
          is_read: false
        };
        await notifRef.set(notifData);
      }
    } catch (nerr) {
      console.error('Failed to create post_like notification:', nerr);
    }

    res.json({ ok: true, action: action, newLikes: newLikesCount });

  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// Comment on post (UPDATED: normalize, return newComments)
app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;
  const { content } = req.body;

  if (!postId || !content) return res.status(400).json({ ok: false, error: 'Missing postId or content' });

  try {
    const postRef = db.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) return res.status(404).json({ ok: false, error: 'Post not found' });

    const userSnapshot = await db.ref(`profiles/${userId}`).once('value');
    const userData = userSnapshot.val() || {};

    const newCommentRef = db.ref(`comments/${postId}`).push();
    const commentId = newCommentRef.key;
    const timestamp = admin.database.ServerValue.TIMESTAMP;

    // Store a consistent normalized comment shape in DB
    const commentData = {
      commentId: commentId,
      postId: postId,
      userId: userId,
      content: content.trim(),
      timestamp: timestamp,
      user: {
        userId: userId,
        username: userData.username || 'مستخدم',
        profile_picture_url: userData.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
      }
    };

    await newCommentRef.set(commentData);

    // increment commentsCount on post (transaction to be safe)
    let newCommentsCount = 0;
    await postRef.child('commentsCount').transaction((currentCount) => {
      newCommentsCount = (currentCount || 0) + 1;
      return newCommentsCount;
    });

    // create notification for post owner (if commenter !== owner)
    try {
      const postData = postSnapshot.val();
      if (postData && postData.userId && postData.userId !== userId) {
        const fromProfileSnap = await db.ref(`profiles/${userId}`).once('value');
        const fromProfile = fromProfileSnap.val() || {};
        const notifRef = db.ref(`notifications/${postData.userId}`).push();
        const notifData = {
          id: notifRef.key,
          type: 'post_comment',
          from_user_id: userId,
          from_username: fromProfile.username || 'مستخدم',
          from_profile_picture_url: fromProfile.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
          postId: postId,
          reelId: null,
          commentId: commentId,
          commentContent: commentData.content,
          timestamp: admin.database.ServerValue.TIMESTAMP,
          is_read: false
        };
        await notifRef.set(notifData);
      }
    } catch (nerr) {
      console.error('Failed to create post_comment notification:', nerr);
    }

    // Read back the stored comment (so timestamp is resolved) and return normalized
    const savedSnap = await db.ref(`comments/${postId}`).child(commentId).once('value');
    const savedVal = savedSnap.val() || commentData;
    const normalized = normalizeStoredComment(savedVal);

    res.json({ ok: true, comment: normalized, newComments: newCommentsCount });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ ok: false, error: 'فشل في إضافة التعليق.' });
  }
});

// Get post comments (UPDATED: normalize)
app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
  const postId = req.params.postId;
  try {
    const commentsSnap = await db.ref(`comments/${postId}`)
      .orderByChild('timestamp')
      .once('value');

    const comments = [];
    commentsSnap.forEach(childSnap => {
      const v = childSnap.val();
      comments.push(normalizeStoredComment(v));
    });

    res.json({ ok: true, comments: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب التعليقات.' });
  }
});

// Delete post
app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  const postRef = db.ref(`posts/${postId}`);

  try {
    const postSnapshot = await postRef.once('value');
    const postData = postSnapshot.val();

    if (!postData) return res.status(404).json({ ok: false });
    if (postData.userId !== userId) return res.status(403).json({ ok: false });

    await postRef.remove();
    await db.ref(`profiles/${userId}/postsCount`).transaction((c) => (c || 0) > 0 ? c - 1 : 0);

    // also remove comments/likes/other related nodes to keep DB clean
    await db.ref(`comments/${postId}`).remove();
    await db.ref(`likes/${postId}`).remove();

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// Get posts by user
app.get('/api/posts/user/:userId', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedUserId = req.params.userId;

  try {
    const postsSnap = await db.ref('posts')
      .orderByChild('userId')
      .equalTo(requestedUserId)
      .once('value');

    let posts = [];
    postsSnap.forEach(childSnap => {
      posts.push(childSnap.val());
    });
    posts.reverse();

    const userProfileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
    const userProfile = userProfileSnap.val();

    if (!userProfile) {
      return res.status(404).json({ ok: false, error: 'User profile not found.' });
    }

    const likedStatuses = {};
    const likePromises = posts.map(post => db.ref(`likes/${post.postId}/${currentUserId}`).once('value'));
    const likeSnapshots = await Promise.all(likePromises);

    likeSnapshots.forEach((snap, index) => {
      likedStatuses[posts[index].postId] = snap.val() !== null;
    });

    const finalPosts = posts.map(post => ({
      ...post,
      commentsCount: post.commentsCount || 0,
      is_liked: likedStatuses[post.postId] || false,
      user: {
        username: userProfile?.username || 'مستخدم',
        profile_picture_url: userProfile?.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
        is_online: !!userProfile?.is_online,
        is_verified: !!userProfile?.is_verified
      }
    }));

    res.json({ ok: true, posts: finalPosts });

  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب منشورات المستخدم.' });
  }
});
// ---------------- API: Reels Implementation ----------------

// إنشاء ريل جديد
app.post('/api/reels/create', requireAuth, upload.single('media'), async (req, res) => {
  const userId = req.session.userId;
  const description = req.body.description ? req.body.description.trim() : '';
  
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'الفيديو مطلوب.' });
  }

  try {
    const newReelRef = db.ref('reels').push();
    const reelId = newReelRef.key;
    const timestamp = admin.database.ServerValue.TIMESTAMP;

    const reelData = {
      reelId: reelId,
      userId: userId,
      description: description,
      timestamp: timestamp,
      likes: 0,
      commentsCount: 0,
      videoUrl: req.file.path,
      mimeType: req.file.mimetype
    };

    await newReelRef.set(reelData);
    res.json({ ok: true, reelId: reelId });

  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({ ok: false, error: 'فشل في رفع الريل.' });
  }
});

app.get('/api/reels/feed', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const reelsSnap = await db.ref('reels').once('value');
    let reels = [];
    
    reelsSnap.forEach(snap => {
      const data = snap.val();
      if (data) reels.push(data);
    });

    reels.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const finalReels = await Promise.all(reels.map(async (reel) => {
      const userSnap = await db.ref(`profiles/${reel.userId}`).once('value');
      const userData = userSnap.val() || {};
      const likeSnap = await db.ref(`reels_likes/${reel.reelId}/${currentUserId}`).once('value');
      
      return {
        ...reel,
        commentsCount: reel.commentsCount || 0,
        is_liked: likeSnap.exists(),
        user: {
          username: userData.username || 'مستخدم',
          profile_picture_url: userData.profile_picture_url || 'https://via.placeholder.com/150',
          is_online: !!userData.is_online,
          is_verified: !!userData.is_verified
        }
      };
    }));

    res.json({ ok: true, reels: finalReels, currentUserId: currentUserId });
  } catch (error) {
    console.error("خطأ في جلب الريلز:", error);
    res.status(500).json({ ok: false, error: 'Error fetching reels' });
  }
});

app.delete('/api/reels/:reelId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { reelId } = req.params;

  try {
    const reelRef = db.ref(`reels/${reelId}`);
    const snapshot = await reelRef.once('value');
    const reel = snapshot.val();

    if (!reel) return res.status(404).json({ ok: false, error: 'الريل غير موجود' });
    
    if (reel.userId !== userId) {
      return res.status(403).json({ ok: false, error: 'غير مصرح لك بحذف هذا الريل' });
    }

    await reelRef.remove();
    await db.ref(`reels_likes/${reelId}`).remove();
    await db.ref(`reels_comments/${reelId}`).remove();

    res.json({ ok: true, message: 'تم الحذف بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'فشل الحذف' });
  }
});

app.post('/api/reels/:reelId/like', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { reelId } = req.params;

  const reelRef = db.ref(`reels/${reelId}`);
  const likeRef = db.ref(`reels_likes/${reelId}/${userId}`);

  try {
    const likeSnap = await likeRef.once('value');
    let isLiked = likeSnap.exists();
    let increment = 0;

    if (isLiked) {
      await likeRef.remove();
      increment = -1;
      isLiked = false;
    } else {
      await likeRef.set(admin.database.ServerValue.TIMESTAMP);
      increment = 1;
      isLiked = true;
    }

    await reelRef.child('likes').transaction(count => (count || 0) + increment);
    
    const updatedReelSnap = await reelRef.once('value');
    const updatedReel = updatedReelSnap.val();

    try {
      if (isLiked && updatedReel.userId && updatedReel.userId !== userId) {
        const fromProfileSnap = await db.ref(`profiles/${userId}`).once('value');
        const fromProfile = fromProfileSnap.val() || {};
        const notifRef = db.ref(`notifications/${updatedReel.userId}`).push();
        const notifData = {
          id: notifRef.key,
          type: 'reel_like',
          from_user_id: userId,
          from_username: fromProfile.username || 'مستخدم',
          from_profile_picture_url: fromProfile.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
          postId: null,
          reelId: reelId,
          timestamp: admin.database.ServerValue.TIMESTAMP,
          is_read: false
        };
        await notifRef.set(notifData);
      }
    } catch (nerr) {
      console.error('Failed to create reel_like notification:', nerr);
    }

    res.json({ ok: true, likes: updatedReel.likes, is_liked: isLiked });

  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/reels/:reelId/comment', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { reelId } = req.params;
  const { content } = req.body;

  if (!content) return res.status(400).json({ ok: false });

  try {
    const userSnap = await db.ref(`profiles/${userId}`).once('value');
    const user = userSnap.val();

    const commentRef = db.ref(`reels_comments/${reelId}`).push();
    const commentData = {
      id: commentRef.key,
      userId,
      username: user.username,
      profile_picture_url: user.profile_picture_url,
      content,
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    await commentRef.set(commentData);
    await db.ref(`reels/${reelId}/commentsCount`).transaction(c => (c || 0) + 1);

    try {
      const reelSnap = await db.ref(`reels/${reelId}`).once('value');
      const reel = reelSnap.val();
      if (reel && reel.userId && reel.userId !== userId) {
        const fromProfileSnap = await db.ref(`profiles/${userId}`).once('value');
        const fromProfile = fromProfileSnap.val() || {};
        const notifRef = db.ref(`notifications/${reel.userId}`).push();
        const notifData = {
          id: notifRef.key,
          type: 'reel_comment',
          from_user_id: userId,
          from_username: fromProfile.username || 'مستخدم',
          from_profile_picture_url: fromProfile.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
          postId: null,
          reelId: reelId,
          commentId: commentData.id,
          commentContent: commentData.content,
          timestamp: admin.database.ServerValue.TIMESTAMP,
          is_read: false
        };
        await notifRef.set(notifData);
      }
    } catch (nerr) {
      console.error('Failed to create reel_comment notification:', nerr);
    }

    res.json({ ok: true, comment: commentData });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/reels/:reelId/comments', requireAuth, async (req, res) => {
  const { reelId } = req.params;
  try {
    const snap = await db.ref(`reels_comments/${reelId}`)
      .orderByChild('timestamp')
      .limitToLast(100)
      .once('value');

    const comments = [];
    snap.forEach(s => {
      const val = s.val();
      if (val) comments.push(val);
    });

    res.json({ ok: true, comments: comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

// ---------------- API: Notifications ----------------

app.get('/api/notifications', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const snap = await db.ref(`notifications/${userId}`).once('value');
    const items = [];
    snap.forEach(child => {
      const v = child.val();
      items.push({ id: child.key, ...v });
    });
    items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const unreadCount = items.filter(i => !i.is_read).length;
    res.json({ ok: true, notifications: items, unread_count: unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب الإشعارات' });
  }
});

app.get('/api/notifications/unread_count', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const snap = await db.ref(`notifications/${userId}`).once('value');
    let count = 0;
    snap.forEach(child => {
      const v = child.val();
      if (!v.is_read) count++;
    });
    res.json({ ok: true, unread_count: count });
  } catch (error) {
    console.error('Error fetching unread notifications count:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب عدد الإشعارات' });
  }
});

app.post('/api/notifications/mark_read', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { id } = req.body || {};
  try {
    if (id) {
      await db.ref(`notifications/${userId}/${id}`).update({ is_read: true });
    } else {
      const snap = await db.ref(`notifications/${userId}`).once('value');
      const updates = {};
      snap.forEach(child => {
        const v = child.val();
        if (v && !v.is_read) updates[`${child.key}/is_read`] = true;
      });
      if (Object.keys(updates).length > 0) {
        await db.ref(`notifications/${userId}`).update(updates);
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ ok: false });
  }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const notifId = req.params.id;
  if (!notifId) return res.status(400).json({ ok: false });
  try {
    await db.ref(`notifications/${userId}/${notifId}`).remove();
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ ok: false });
  }
});

app.delete('/api/notifications', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    await db.ref(`notifications/${userId}`).remove();
    res.json({ ok: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ ok: false, error: 'فشل في حذف الإشعارات' });
  }
});

// ---- SSE stream endpoint: يدفع تحديثات الاشعارات فورياً للعميل ----
app.get('/api/notifications/stream', requireAuth, (req, res) => {
  const userId = req.session.userId;

  // تهيئة رأس SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': corsOptions.origin.includes(req.headers.origin) ? req.headers.origin : 'null',
  });
  res.write('\n');

  const notifRef = db.ref(`notifications/${userId}`);
  const chatsRef = db.ref(`chats/${userId}`);
  const friendReqRef = db.ref(`friend_requests/${userId}`);

  // دالة تجمع بيانات الإشعارات ومجموع الرسائل غير المقروءة وترسلها
  const sendCombined = async () => {
    try {
      const [notifSnap, chatsSnap, friendSnap] = await Promise.all([
        notifRef.once('value'),
        chatsRef.once('value'),
        friendReqRef.once('value')
      ]);

      const items = [];
      notifSnap.forEach(child => {
        const v = child.val();
        items.push({ id: child.key, ...v });
      });
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const unreadNotificationsCount = items.filter(i => !i.is_read).length;

      let unreadMessagesCount = 0;
      chatsSnap.forEach(child => {
        const v = child.val();
        if (v && v.unread_count) {
          unreadMessagesCount += Number(v.unread_count) || 0;
        }
      });

      let pendingFriendRequestsCount = 0;
      friendSnap.forEach(() => pendingFriendRequestsCount++);

      const payload = {
        unread_count: unreadNotificationsCount,
        notifications: items,
        unread_messages_count: unreadMessagesCount,
        pending_friend_requests_count: pendingFriendRequestsCount
      };

      res.write(`event: notifications\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      console.error('Error preparing SSE payload:', err);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    }
  };

  // ربط المستمعين على كلتا العقدتين: إشعارات والدردشات وطلبات الصداقة
  notifRef.on('value', sendCombined, err => {
    console.error('SSE notifications listener error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
  });
  chatsRef.on('value', sendCombined, err => {
    console.error('SSE chats listener error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
  });
  friendReqRef.on('value', sendCombined, err => {
    console.error('SSE friend-requests listener error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
  });

  // إرسال حالة أولية مباشرة
  sendCombined();

  // تنظيف عند إغلاق الاتصال من قبل العميل
  req.on('close', () => {
    try {
      notifRef.off('value', sendCombined);
      chatsRef.off('value', sendCombined);
      friendReqRef.off('value', sendCombined);
    } catch (e) { /* ignore */ }
    res.end();
  });
});

// ---------------- Active Status Cleaner ----------------
// مهمة دورية للتحقق من المستخدمين غير النشطين
const OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

setInterval(async () => {
  try {
    const profilesRef = db.ref('profiles');
    const snapshot = await profilesRef.orderByChild('is_online').equalTo(true).once('value');
    
    if (!snapshot.exists()) return;

    const updates = {};
    const now = Date.now();

    snapshot.forEach(child => {
      const user = child.val();
      if (user.last_seen && (now - user.last_seen > OFFLINE_THRESHOLD)) {
        updates[`${child.key}/is_online`] = false;
      }
    });

    if (Object.keys(updates).length > 0) {
      await profilesRef.update(updates);
    }
  } catch (error) {
    console.error('Error in offline check interval:', error);
  }
}, 60000); // Check every minute

// ---------------- Error Handling ----------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ ok: false, error: err.message });
  next(err);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
