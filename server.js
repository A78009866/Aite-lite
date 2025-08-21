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
const cors = require('cors');

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
    public_id: (req, file) => Date.now() + '-' + file.originalname,
  },
});
const upload = multer({ storage: storage });

// Firebase Admin SDK setup using environment variable
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
  process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const auth = getAuth();
const db = getDatabase();
const usersRef = db.ref('users');
const profilesRef = db.ref('profiles');
const messagesRef = db.ref('messages');

const app = express();

// استخدام CORS للسماح بالطلبات من أي مصدر (مهم لتطبيق Capacitor)
app.use(cors({
  origin: true,
  credentials: true
}));

// إعداد الجلسة
// Use FirebaseStore with the Firebase Admin SDK
const store = new FirebaseStore({
    database: db.ref('sessions')
});

app.use(session({
  store: store,
  secret: process.env.SESSION_SECRET || 'your-secret-key', // استخدم متغير بيئة
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' ? true : 'auto', // استخدم 'auto' للتعامل مع بيئات Vercel
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 أيام
  }
}));

// تحديد مسارات للملفات الثابتة
app.use(express.static(path.join(__dirname, 'www')));

// Middleware لإنشاء JSON و Form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware للتحقق من المصادقة (Auth Middleware)
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'API call unauthorized. Session not found for user ID: ' + req.session.userId });
  }
};

// ---------------- API Routes ----------------

// Route للتحقق من حالة المصادقة
app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.userId) {
        res.status(200).json({ isAuthenticated: true, userId: req.session.userId });
    } else {
        res.status(401).json({ isAuthenticated: false });
    }
});

// Route لتسجيل الدخول
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' });
  }

  try {
    const usersSnapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
    const userData = usersSnapshot.val();

    if (!userData) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحين.' });
    }

    const userId = Object.keys(userData)[0];
    const user = userData[userId];

    if (user.password !== password) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحين.' });
    }

    // هنا يتم تعيين الجلسة
    req.session.userId = userId;
    res.json({ message: 'تم تسجيل الدخول بنجاح.', userId: userId });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'فشل في تسجيل الدخول. يرجى المحاولة لاحقاً.' });
  }
});

// Route لإنشاء حساب جديد
app.post('/register', upload.single('profile_picture'), async (req, res) => {
  const { username, password } = req.body;
  let profilePictureUrl = req.file ? req.file.path : null;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' });
  }

  try {
    const existingUser = await usersRef.orderByChild('username').equalTo(username).once('value');
    if (existingUser.exists()) {
      return res.status(409).json({ error: 'اسم المستخدم موجود بالفعل. يرجى اختيار اسم آخر.' });
    }

    const newUserRef = usersRef.push();
    const newProfileRef = profilesRef.child(newUserRef.key);

    const newUser = {
      username: username,
      password: password,
      uid: newUserRef.key,
      // ... أي بيانات مستخدم أخرى
    };

    const newProfile = {
      username: username,
      full_name: username,
      profile_picture_url: profilePictureUrl || 'https://res.cloudinary.com/duixjs8az/image/upload/v1/profile_pics/default_profile.png',
      is_online: true,
      last_seen: admin.database.ServerValue.TIMESTAMP,
      uid: newUserRef.key
    };

    await Promise.all([
      newUserRef.set(newUser),
      newProfileRef.set(newProfile)
    ]);

    req.session.userId = newUserRef.key;
    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح.', userId: newUserRef.key });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'فشل في إنشاء الحساب.' });
  }
});

// Route لتسجيل الخروج
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'فشل في تسجيل الخروج.' });
    }
    res.clearCookie('connect.sid'); // مسح الكوكيز
    res.json({ message: 'تم تسجيل الخروج بنجاح.' });
  });
});

// ---------------- API Routes Requiring Auth ----------------

// Route للحصول على الملف الشخصي
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.query.user_id || req.session.userId;
        const profileSnapshot = await profilesRef.child(userId).once('value');
        if (!profileSnapshot.exists()) {
            return res.status(404).json({ error: 'الملف الشخصي غير موجود.' });
        }
        res.json(profileSnapshot.val());
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ error: 'فشل في جلب الملف الشخصي.' });
    }
});

// Route لجلب قائمة المحادثات (بناءً على أحدث الرسائل)
app.get('/api/chat_list', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const chatList = [];
    const messagesByUser = {};

    const messagesSnapshot = await messagesRef.orderByChild('timestamp').once('value');
    messagesSnapshot.forEach(messageSnapshot => {
      const message = messageSnapshot.val();
      const otherId = message.sender_id === userId ? message.receiver_id : message.sender_id;

      if (!messagesByUser[otherId]) {
        messagesByUser[otherId] = [];
      }
      messagesByUser[otherId].push(message);
    });

    const userIds = Object.keys(messagesByUser);
    for (const otherId of userIds) {
      const otherUserMessages = messagesByUser[otherId];
      const latestMessage = otherUserMessages.sort((a, b) => b.timestamp - a.timestamp)[0];

      const otherUserSnapshot = await profilesRef.child(otherId).once('value');
      const otherUser = otherUserSnapshot.val();

      if (otherUser) {
        chatList.push({
          user: otherUser,
          last_message: latestMessage.content,
          last_time: latestMessage.timestamp,
          is_new: latestMessage.receiver_id === userId && !latestMessage.is_read
        });
      }
    }

    res.json(chatList);
  } catch (err) {
    console.error('Chat list error:', err);
    res.status(500).json({ error: 'فشل في جلب قائمة المحادثات.' });
  }
});

// Route لجلب رسائل محددة
app.get('/api/messages/:other_id', requireAuth, async (req, res) => {
  try {
    const { other_id } = req.params;
    const userId = req.session.userId;

    // جلب جميع الرسائل بين المستخدمين
    const messagesSnapshot = await messagesRef.once('value');
    const messages = [];

    messagesSnapshot.forEach(childSnapshot => {
      const message = childSnapshot.val();
      const isBetweenUsers = (message.sender_id === userId && message.receiver_id === other_id) ||
                             (message.sender_id === other_id && message.receiver_id === userId);
      if (isBetweenUsers) {
        messages.push(message);
      }
    });

    // فرز الرسائل حسب الوقت
    messages.sort((a, b) => a.timestamp - b.timestamp);

    res.json(messages);

  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'فشل في جلب الرسائل.' });
  }
});

// Route لإرسال الرسائل
app.post('/api/messages/send', requireAuth, upload.single('media'), async (req, res) => {
  try {
    const { other_id, content, replied_to_id, replied_to_content, replied_to_sender } = req.body;
    const mediaUrl = req.file ? req.file.path : null;
    const mediaType = req.file ? (req.file.mimetype.startsWith('image') ? 'image' : (req.file.mimetype.startsWith('audio') ? 'audio' : 'video')) : null;

    const newMessageRef = messagesRef.push();
    const newMessage = {
      id: newMessageRef.key,
      sender_id: req.session.userId,
      receiver_id: other_id,
      content: content || null,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      is_read: false,
      media_url: mediaUrl,
      media_type: mediaType,
      replied_to_id: replied_to_id || null,
      replied_to_content: replied_to_content || null,
      replied_to_sender: replied_to_sender || null
    };

    await newMessageRef.set(newMessage);

    res.status(201).json({ message: 'تم الإرسال بنجاح.', messageId: newMessageRef.key });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'فشل في إرسال الرسالة.' });
  }
});

// Route للبحث عن المستخدمين
app.get('/api/users/search', requireAuth, async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.json([]);
  }

  try {
    const profilesSnapshot = await profilesRef.once('value');
    const users = [];

    profilesSnapshot.forEach(profileSnapshot => {
      const profile = profileSnapshot.val();
      if (profile.username.includes(query) || (profile.full_name && profile.full_name.includes(query))) {
        users.push({
          uid: profile.uid,
          username: profile.username,
          full_name: profile.full_name,
          profile_picture_url: profile.profile_picture_url
        });
      }
    });

    res.json(users);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'فشل في البحث عن المستخدمين.' });
  }
});

// Route لتمييز الرسائل كمقروءة
app.post('/api/mark_read', requireAuth, async (req, res) => {
  try {
    const { other_id } = req.body;
    const userId = req.session.userId;

    const messagesSnapshot = await messagesRef.once('value');
    messagesSnapshot.forEach(childSnapshot => {
      const message = childSnapshot.val();
      if (message.receiver_id === userId && message.sender_id === other_id && !message.is_read) {
        childSnapshot.ref.update({ is_read: true });
      }
    });

    res.json({ message: 'تم تمييز الرسائل كمقروءة.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'فشل في تمييز الرسائل.' });
  }
});

// Middleware for Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer Error:', err);
    res.status(400).json({ error: `خطأ في تحميل الملف: ${err.message}` });
  } else {
    next(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
