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

  // التحقق من وجود محتوى نصي أو ملف وسائط
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

// نقطة وصول للإعجاب بمنشور
app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  if (!postId) {
    return res.status(400).json({ ok: false, error: 'معرف المنشور مطلوب.' });
  }

  const postRef = db.ref(`posts/${postId}`);
  const userLikeRef = db.ref(`likes/${postId}/${userId}`);

  try {
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) {
      return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
    }

    const likeSnapshot = await userLikeRef.once('value');
    const isLiked = likeSnapshot.val();
    let likesUpdate = 0;
    let action = '';
    
    // عملية الإعجاب/إلغاء الإعجاب
    if (isLiked) {
      // إلغاء الإعجاب
      await userLikeRef.remove();
      likesUpdate = -1;
      action = 'unliked';
    } else {
      // إعجاب
      await userLikeRef.set(admin.database.ServerValue.TIMESTAMP);
      likesUpdate = 1;
      action = 'liked';
    }

    // تحديث عداد الإعجابات في المنشور
    let newLikesCount = 0;
    await postRef.child('likes').transaction((currentCount) => {
      newLikesCount = (currentCount || 0) + likesUpdate;
      return newLikesCount < 0 ? 0 : newLikesCount;
    });

    res.json({ ok: true, action: action, newLikes: newLikesCount });

  } catch (error) {
    console.error('Error handling like:', error);
    res.status(500).json({ ok: false, error: 'فشل في معالجة الإعجاب على الخادم.' });
  }
});

// نقطة وصول لإضافة تعليق جديد
app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;
  const { content } = req.body;

  if (!postId || !content || content.trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'محتوى التعليق مطلوب.' });
  }

  try {
    const postRef = db.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) {
      return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
    }
    
    const userSnapshot = await db.ref(`profiles/${userId}`).once('value');
    const userData = userSnapshot.val();

    const newCommentRef = db.ref(`comments/${postId}`).push();
    const commentId = newCommentRef.key;
    const timestamp = admin.database.ServerValue.TIMESTAMP;

    const commentData = {
      commentId: commentId,
      postId: postId,
      userId: userId,
      content: content.trim(),
      timestamp: timestamp,
      user: {
        username: userData.username || 'مستخدم غير معروف',
        profile_picture_url: userData.profile_picture_url || 'https://via.placeholder.com/40/000000/FFFFFF?text=A'
      }
    };

    await newCommentRef.set(commentData);

    // تحديث عداد التعليقات في المنشور
    let newCommentsCount = 0;
    await postRef.child('commentsCount').transaction((currentCount) => {
      newCommentsCount = (currentCount || 0) + 1;
      return newCommentsCount;
    });

    res.json({ ok: true, message: 'تم إضافة التعليق بنجاح', comment: commentData, newComments: newCommentsCount });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ ok: false, error: 'فشل في إضافة التعليق على الخادم.' });
  }
});

// نقطة وصول لجلب جميع التعليقات لمنشور
app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
  const postId = req.params.postId;

  try {
    const commentsSnap = await db.ref(`comments/${postId}`)
      .orderByChild('timestamp')
      .once('value');

    const comments = [];
    commentsSnap.forEach(childSnap => {
      comments.push(childSnap.val());
    });

    res.json({ ok: true, comments: comments });

  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب التعليقات.' });
  }
});


// نقطة وصول لجلب المنشورات الأخيرة (مُعدّلة لجلب حالة الإعجاب)
app.get('/api/posts', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId; // جلب معرف المستخدم الحالي

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
    const defaultProfileUrl = 'https://via.placeholder.com/40/000000/FFFFFF?text=A';

    // جلب ملفات المستخدمين
    const profilePromises = userIds.map(userId => db.ref(`profiles/${userId}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
        profiles[userIds[index]] = snap.val();
    });
    
    // جلب حالة إعجاب المستخدم الحالي لكل منشور
    const likedStatuses = {};
    const likePromises = posts.map(post => 
      db.ref(`likes/${post.postId}/${currentUserId}`).once('value')
    );
    const likeSnapshots = await Promise.all(likePromises);
    
    likeSnapshots.forEach((snap, index) => {
        likedStatuses[posts[index].postId] = snap.val() !== null;
    });
    // ----------------------------------------------------

    const finalPosts = posts.map(post => ({
      ...post,
      is_liked: likedStatuses[post.postId] || false, // إضافة حالة الإعجاب
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

// نقطة وصول لحذف منشور
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

  try {
    const profileSnap = await db.ref(`profiles/${currentUserId}`).once('value');
    const profileData = profileSnap.val();

    if (!profileData) {
      return res.status(404).json({ ok: false, error: 'ملف المستخدم غير موجود.' });
    }

    res.json({ ok: true, ...profileData });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب بيانات الملف الشخصي.' });
  }
});


// ---------------- API: Chat List and Messages ----------------
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
      contact_profile: profiles[chat.contact_id] || { username: 'مستخدم غير معروف', profile_picture_url: 'https://via.placeholder.com/40' }
    }));

    res.json({ ok: true, chats: finalChats });
    
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب قائمة المحادثات.' });
  }
});

// نقطة وصول لجلب الرسائل في محادثة محددة
app.get('/api/messages/:contactId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const contactId = req.params.contactId;
  const { limit = 50 } = req.query; // يمكن تحديد عدد الرسائل المُراد جلبها

  if (!contactId) {
    return res.status(400).json({ ok: false, error: 'معرف جهة الاتصال مطلوب.' });
  }

  // تحديد اسم غرفة الدردشة بترتيب أبجدي للمُعرّفات
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

    res.json({ ok: true, messages: messages.reverse() }); // اعكس الترتيب لعرض الأحدث في الأسفل

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب الرسائل.' });
  }
});


// نقطة وصول لإرسال رسالة جديدة (نص أو وسائط)
app.post('/api/messages/send/:contactId', requireAuth, upload.single('media'), async (req, res) => {
  const senderId = req.session.userId;
  const contactId = req.params.contactId;
  const { content } = req.body;
  
  let mediaUrl = null;
  let mediaType = null;
  const timestamp = admin.database.ServerValue.TIMESTAMP;

  // التحقق من وجود محتوى نصي أو ملف وسائط
  if ((!content || content.trim().length === 0) && !req.file) {
    return res.status(400).json({ ok: false, error: 'يجب توفير محتوى نصي أو ملف وسائط.' });
  }

  // إذا تم رفع ملف بنجاح
  if (req.file) {
    mediaUrl = req.file.path; // الرابط النهائي من Cloudinary
    
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
    // تحديد اسم غرفة الدردشة بترتيب أبجدي للمُعرّفات
    const chatRoomId = [senderId, contactId].sort().join('_');
    const messagesRef = db.ref(`messages/${chatRoomId}`).push();
    const messageId = messagesRef.key;

    const messageData = {
      messageId: messageId,
      senderId: senderId,
      content: content || null,
      timestamp: timestamp,
      // حفظ بيانات الوسائط فقط إذا كانت موجودة
      media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
      is_read: false,
    };

    await messagesRef.set(messageData);

    // تحديث بيانات المحادثات (last_message_content) لكلا المستخدمين
    const lastMessageContent = content || `[${mediaType === 'image' ? 'صورة' : mediaType === 'video' ? 'فيديو' : mediaType === 'audio' ? 'مقطع صوتي' : 'ملف وسائط'}]`;

    // تحديث محادثة المرسل
    await db.ref(`chats/${senderId}/${contactId}`).update({
        last_message_content: lastMessageContent,
        last_message_timestamp: timestamp,
        contact_id: contactId,
    });

    // تحديث محادثة المُستقبِل
    await db.ref(`chats/${contactId}/${senderId}`).update({
        last_message_content: lastMessageContent,
        last_message_timestamp: timestamp,
        contact_id: senderId,
    });

    res.json({ ok: true, message: 'تم إرسال الرسالة بنجاح', messageData: messageData });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ ok: false, error: 'فشل في إرسال الرسالة.' });
  }
});


// ---------------- Debug Routes (for development purposes) ----------------
app.get('/api/debug/session', requireAuth, (req, res) => {
  res.json({
    ok: true,
    message: 'Session is active.',
    isAuthenticated: !!(req.session && req.session.userId),
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
    return res.status(413).json({ ok: false, error: `خطأ في تحميل الملف: ${err.message}` });
  }
  if (err) {
    // أخطاء أخرى
    console.error('General error:', err);
    return res.status(500).json({ ok: false, error: 'حدث خطأ غير متوقع على الخادم.' });
  }
  next();
});

// ---------------- Server Start ----------------
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
