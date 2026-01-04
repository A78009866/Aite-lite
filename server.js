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

// --- 1. إعدادات وثوابت ---
const DEFAULT_PROFILE_PIC_URL = 'https://res.cloudinary.com/duixjs8az/image/upload/v1765009560/post_media/1765009560909-default_profile.png';
const port = process.env.PORT || 3000;

// --- 2. إعدادات Cloudinary & Multer ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = 'general';
    const url = (req && req.originalUrl) ? req.originalUrl : '';
    
    if (file.fieldname === 'profile_picture') folderName = 'profile_pics';
    else if (file.fieldname === 'cover_photo') folderName = 'cover_photos';
    else if (file.fieldname === 'family_image') folderName = 'families';
    else if (url.includes('/messages/send')) folderName = 'chat_media';
    else if (url.includes('/api/posts/create')) folderName = 'post_media';
    else if (url.includes('/reels') || url.includes('/create-reel')) folderName = 'reels';
    else if (url.includes('/register')) folderName = 'profile_pics';

    let format = undefined;
    if (file.mimetype && file.mimetype.startsWith('audio/')) format = 'webm';

    return {
      folder: folderName,
      public_id: Date.now() + '-' + path.parse(file.originalname).name,
      resource_type: 'auto',
      format: format
    };
  },
});
const upload = multer({ storage: storage });

// --- 3. تهيئة Firebase ---
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY || '{}');
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://trimer-4081b-default-rtdb.firebaseio.com",
  });
}
const firebaseAuth = getAuth();
const db = getDatabase();

// --- 4. إعداد Express Middleware ---
const app = express();
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

// --- 5. وظائف مساعدة مشتركة (Shared Helpers) ---

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.path.startsWith('/api/') || req.path.startsWith('/partials/')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User session not found or expired.' });
  }
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    return res.redirect('/login');
  }

  const adminUid = process.env.ADMIN_UID || null;
  const adminUsername = process.env.ADMIN_USERNAME || 'brahim1582007';

  const email = req.session.email || '';
  const usernameFromEmail = email.split('@')[0];

  const isAdmin = (adminUid && req.session.userId === adminUid) || (usernameFromEmail === adminUsername);

  if (!isAdmin) {
    if (req.path.startsWith('/api/')) return res.status(403).json({ ok: false, error: 'Forbidden' });
    return res.status(403).send('403 Forbidden — ليس لديك صلاحية الوصول لهذه الصفحة.');
  }
  next();
}

function normalizeStoredComment(val) {
  const commentId = val.commentId || val.id || val.key || val.keyId || '';
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

  const likesCount = typeof val.likes === 'number' ? val.likes : (val.likesCount || 0);
  const repliesCount = typeof val.repliesCount === 'number' ? val.repliesCount : (val.replies_count || 0);

  return { commentId, postId: val.postId || '', content, timestamp, user, likes: likesCount || 0, repliesCount: repliesCount || 0 };
}

function countSnapshotChildren(snap) {
  let c = 0;
  snap.forEach(() => c++);
  return c;
}

function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function clientWantsJson(req) {
  return (req.xhr) || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
}

// تجميع الأدوات في كائن واحد لتمريره للملفات الأخرى
const shared = {
  requireAuth,
  requireAdmin,
  normalizeStoredComment,
  countSnapshotChildren,
  escapeHtml,
  clientWantsJson,
  DEFAULT_PROFILE_PIC_URL,
  corsOptions
};

// --- 6. استدعاء ملفات المسارات (Inject Dependencies) ---
// يتم تمرير التطبيق، قاعدة البيانات، المصادقة، أدوات الرفع، والأدوات المشتركة لكل ملف
require('./routes_auth')(app, db, firebaseAuth, admin, upload, shared);
require('./routes_social')(app, db, admin, upload, shared);
require('./routes_family')(app, db, admin, upload, shared);
require('./routes_chat')(app, db, admin, upload, shared);

// --- 7. مهام الخلفية (Background Tasks) ---
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
    if (Object.keys(updates).length > 0) await profilesRef.update(updates);
  } catch (error) {
    console.error('Error in offline check interval:', error);
  }
}, 60000);

// --- 8. معالجة الأخطاء وبدء الخادم ---
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ ok: false, error: err.message });
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Server error' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
