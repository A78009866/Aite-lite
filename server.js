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
      // تحديد المجلد بناءً على المسار
      if (req.originalUrl.includes('/register')) {
        return 'profile_pics';
      } else if (req.originalUrl.includes('/messages/send')) {
        return 'chat_media';
      } else if (req.originalUrl.includes('/api/posts/create')) {
        return 'post_media'; // مجلد مخصص لوسائط المنشورات
      }
      return 'general';
    },
    public_id: (req, file) => Date.now() + '-' + file.originalname,
    resource_type: 'auto',
  },
});

const upload = multer({ storage: storage });

// Load service account key from environment variable
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://trimer-4081b-default-rtdb.firebaseio.com",
});

const firebaseAuth = getAuth();
const db = getDatabase();

const app = express();
const port = 3000;

// ---------------- Middleware ----------------
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// قم بتحديد أصول (origins) محددة مسموح بها.
const corsOptions = {
  origin: ['http://localhost:8100', 'https://chat-trimer.vercel.app'],
  credentials: true, 
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); 

// إعدادات الجلسة (session) الجديدة مع Firebase
app.use(session({
  secret: 'a-firebase-secret-key-is-better',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  },
  store: new FirebaseStore({
    database: db,
    collection: 'sessions',
    ttl: 3600
  })
}));

// ---------------- Authentication helper ----------------
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  if (req.path.startsWith('/api/')) {
    console.error('API call unauthorized. Session not found for user ID:', req.session.userId);
    return res.status(401).json({ error: 'Unauthorized', message: 'User session not found or expired.' });
  }

  console.log('Redirecting to login. Path:', req.path);
  return res.redirect('/login');
}

// ---------------- Routes: pages ----------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'splash.html'));
});

app.get('/check-status', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/chat_list');
  } else {
    res.redirect('/login');
  }
});

app.get('/chat_list', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chat_list.html'));
});

app.get('/chat.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});
app.get('/chat', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});

app.get('/profile', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

// مسار عرض صفحة إنشاء منشور
app.get('/create-post', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'create_post.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// ---------------- Auth Routes ----------------
app.post('/login', async (req, res) => {
  const { username } = req.body;
  try {
    const email = `${username}@trimer.io`;
    const userRecord = await firebaseAuth.getUserByEmail(email);
    req.session.userId = userRecord.uid;
    req.session.email = userRecord.email;
    await req.session.save();
    res.redirect('/chat_list');
  } catch (error) {
    console.error('Login error:', error.message);
    const errorMessage = 'Invalid username or password.';
    res.redirect('/login?error=' + encodeURIComponent(errorMessage));
  }
});

app.post('/register', upload.single('profile_picture'), async (req, res) => {
  const { username, password } = req.body;
  let profile_picture_url = 'https://via.placeholder.com/150';

  try {
    if (!username || !password) {
        return res.redirect('/register?error=' + encodeURIComponent('اسم المستخدم وكلمة المرور مطلوبان.'));
    }

    const email = `${username}@trimer.io`;

    if (req.file) {
      profile_picture_url = req.file.path;
    }

    const userRecord = await firebaseAuth.createUser({
      email: email,
      password: password,
      displayName: username,
      photoURL: profile_picture_url
    });

    const profileData = {
      id: userRecord.uid,
      username: username,
      full_name: username,
      email: email,
      profile_picture_url: profile_picture_url,
      is_online: false,
      is_verified: false,
    };
    await db.ref('profiles/' + userRecord.uid).set(profileData);

    req.session.userId = userRecord.uid;
    req.session.email = email;
    await req.session.save();
    res.redirect('/chat_list');
  } catch (error) {
    console.error('Registration Error:', error.message);
    res.redirect('/register?error=' + encodeURIComponent(error.message));
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// ---------------- API: Posts ----------------

// نقطة وصول لإنشاء منشور جديد
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
  const userId = req.session.userId;
  const content = req.body.content ? req.body.content.trim() : '';
  let mediaUrl = null;
  let mediaType = null;

  // التحقق من وجود محتوى نصي أو ملف وسائط (تم تحقيق طلبك)
  if (content.length === 0 && !req.file) {
    return res.status(400).json({ ok: false, error: 'يجب توفير محتوى نصي أو ملف وسائط.' });
  }

  // إذا تم رفع ملف بنجاح
  if (req.file) {
    mediaUrl = req.file.path; // الرابط النهائي من Cloudinary
    
    // تحديد نوع الملف بناءً على MimeType
    const mimeType = req.file.mimetype;
    if (mimeType && mimeType.startsWith('image/')) {
        mediaType = 'image';
    } else if (mimeType && mimeType.startsWith('video/')) {
        mediaType = 'video';
    } else if (mimeType && mimeType.startsWith('audio/')) {
        mediaType = 'audio';
    } else {
        mediaType = 'raw';
    }
  }

  try {
    // 1. إنشاء المنشور الجديد في قاعدة البيانات
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
      // حفظ بيانات الوسائط فقط إذا كانت موجودة
      media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
    };

    await newPostRef.set(postData);

    // 2. تحديث عداد المنشورات للمستخدم (اختياري)
    const userPostsCountRef = db.ref(`profiles/${userId}/postsCount`);
    await userPostsCountRef.transaction((currentCount) => {
      return (currentCount || 0) + 1;
    });

    res.json({ ok: true, message: 'تم نشر المنشور بنجاح', postId: postId });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ ok: false, error: 'فشل في إنشاء المنشور على الخادم.' });
  }
});

// نقطة وصول لجلب المنشورات الأخيرة
app.get('/api/posts', requireAuth, async (req, res) => {
  try {
    const postsSnap = await db.ref('posts')
      .orderByChild('timestamp')
      .limitToLast(50)
      .once('value');

    const posts = [];
    postsSnap.forEach(childSnap => {
      posts.push(childSnap.val());
    });

    posts.reverse(); 

    const userIds = [...new Set(posts.map(p => p.userId))];
    const profiles = {};
    const defaultProfileUrl = 'https://via.placeholder.com/40/000000/FFFFFF?text=A';

    const profilePromises = userIds.map(userId => db.ref(`profiles/${userId}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
        profiles[userIds[index]] = snap.val();
    });

    const finalPosts = posts.map(post => ({
      ...post,
      user: {
        username: profiles[post.userId]?.username || 'مستخدم غير معروف',
        profile_picture_url: profiles[post.userId]?.profile_picture_url || defaultProfileUrl
      }
    }));

    res.json({ ok: true, posts: finalPosts });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
  }
});

// نقطة وصول لحذف منشور (تم تحقيق طلبك)
app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  if (!postId) {
    return res.status(400).json({ ok: false, error: 'معرف المنشور مطلوب للحذف.' });
  }

  const postRef = db.ref(`posts/${postId}`);

  try {
    const postSnapshot = await postRef.once('value');
    const postData = postSnapshot.val();

    if (!postData) {
      return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
    }

    // التحقق من أن المستخدم الحالي هو صاحب المنشور
    if (postData.userId !== userId) {
      return res.status(403).json({ ok: false, error: 'ليس لديك صلاحية لحذف هذا المنشور.' });
    }

    // حذف المنشور من قاعدة البيانات
    await postRef.remove();
    
    // تحديث عداد المنشورات للمستخدم
    const userPostsCountRef = db.ref(`profiles/${userId}/postsCount`);
    await userPostsCountRef.transaction((currentCount) => {
      return (currentCount || 0) > 0 ? (currentCount - 1) : 0;
    });

    res.json({ ok: true, message: 'تم حذف المنشور بنجاح.' });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ ok: false, error: 'فشل في حذف المنشور على الخادم.' });
  }
});


// ---------------- API: Profile and User Operations ----------------

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
        is_verified: !!profiles[uid].is_online,
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
        is_verified: !!profiles[uid].is_online,
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
    // خطأ من Multer (مثل حجم الملف كبير جدًا)
    console.error('Multer error:', err);
    return res.status(400).json({ error: 'Upload failed', message: err.message });
  } else if (err) {
    // أي خطأ آخر
    console.error('General error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
  next();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
