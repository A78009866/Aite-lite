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

// 💡 التعديل هنا: التحقق من وجود تهيئة سابقة لمنع خطأ FirebaseAppError (app/duplicate-app)
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

// مسار عرض صفحة قائمة المستخدمين الجديدة
app.get('/users_list', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'users_list.html'));
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
      // **تعديل: إضافة حقل النبذة (bio) لتمكين العرض المشروط**
      bio: '', 
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
    const commentsSnap = await db.ref(`comments/${postId}`).orderByChild('timestamp').once('value');
    const comments = [];
    commentsSnap.forEach(snap => {
      comments.push(snap.val());
    });
    res.json({ ok: true, comments: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب التعليقات.' });
  }
});

// نقطة وصول لجلب جميع المنشورات
app.get('/api/posts', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const postsSnap = await db.ref('posts').orderByChild('timestamp').once('value');
    const posts = [];
    postsSnap.forEach(snap => {
      posts.push(snap.val());
    });

    // جلب بيانات المستخدمين لجميع المنشورات
    const userIds = [...new Set(posts.map(post => post.userId))];
    const profilesSnap = await db.ref('profiles').once('value');
    const profiles = profilesSnap.val() || {};

    // جلب حالة الإعجاب للمستخدم الحالي
    const likesSnap = await db.ref('likes').once('value');
    const likes = likesSnap.val() || {};

    const finalPosts = posts.reverse().map(post => {
      const userProfile = profiles[post.userId] || { username: 'مستخدم محذوف', profile_picture_url: 'https://via.placeholder.com/40' };
      const isLiked = likes[post.postId] && likes[post.postId][currentUserId] !== undefined;

      return {
        ...post,
        user: {
          id: userProfile.id,
          username: userProfile.username,
          full_name: userProfile.full_name,
          profile_picture_url: userProfile.profile_picture_url,
        },
        isLiked: isLiked,
      };
    });

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

    // حذف التعليقات والإعجابات المتعلقة به
    await db.ref(`comments/${postId}`).remove();
    await db.ref(`likes/${postId}`).remove();

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
    const userId = req.session.userId;
    try {
        const profileSnap = await db.ref('profiles/' + userId).once('value');
        const profile = profileSnap.val();

        if (!profile) {
            return res.status(404).json({ ok: false, error: "الملف الشخصي غير موجود." });
        }

        res.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ ok: false, error: "خطأ داخلي في الخادم." });
    }
});

app.get('/api/profile/:userId', requireAuth, async (req, res) => {
    const targetUserId = req.params.userId;
    try {
        const profileSnap = await db.ref('profiles/' + targetUserId).once('value');
        const profile = profileSnap.val();

        if (!profile) {
            return res.status(404).json({ ok: false, error: "الملف الشخصي غير موجود." });
        }

        // إرجاع البيانات المطلوبة لـ chat.html
        const publicProfile = {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            profile_picture_url: profile.profile_picture_url
        };

        res.json(publicProfile);

    } catch (error) {
        console.error('Error fetching single profile:', error);
        res.status(500).json({ ok: false, error: "خطأ داخلي في الخادم." });
    }
});

// نقطة وصول لجلب قائمة المستخدمين (لصفحة users_list.html)
app.get('/api/users/list', requireAuth, async (req, res) => {
    const currentUserId = req.session.userId;
    try {
        const profilesSnap = await db.ref('profiles').once('value');
        const profiles = profilesSnap.val() || {};

        // تصفية المستخدم الحالي من القائمة وتنسيق البيانات
        const usersList = Object.values(profiles).filter(user => user.id !== currentUserId).map(user => ({
            id: user.id,
            username: user.username,
            profile_picture_url: user.profile_picture_url || 'https://via.placeholder.com/40/000000/FFFFFF?text=U'
        }));

        res.json({ ok: true, users: usersList });
    } catch (error) {
        console.error('Error fetching users list:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب قائمة المستخدمين.' });
    }
});

// ---------------- API: Chat List and Messages ----------------
app.get('/api/chats', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const chatRefs = db.ref(`chats/${userId}`);
    // جلب آخر رسالة في كل محادثة
    const chatSnap = await chatRefs.orderByChild('last_message_timestamp').once('value');
    
    const chats = [];
    const contactIds = [];

    chatSnap.forEach(childSnap => {
        const chat = childSnap.val();
        chats.push(chat);
        contactIds.push(chat.contact_id);
    });

    // جلب ملفات التعريف لجهات الاتصال دفعة واحدة
    const profiles = {};
    const profilePromises = contactIds.map(id => db.ref(`profiles/${id}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
        profiles[contactIds[index]] = snap.val();
    });

    // تجميع بيانات المحادثات مع ملفات التعريف
    const finalChats = chats.reverse().map(chat => ({
      ...chat,
      contact_profile: profiles[chat.contact_id] || { username: 'مستخدم غير معروف', profile_picture_url: 'https://via.placeholder.com/40' }
    }));

    res.json({ ok: true, chats: finalChats });

  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب قائمة المحادثات.' });
  }
});

// نقطة وصول لجلب رسائل المحادثة
app.get('/api/messages/:contactId', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const contactId = req.params.contactId;

    try {
        if (!contactId) {
            return res.status(400).json({ ok: false, error: 'معرف جهة الاتصال مطلوب.' });
        }

        // تحديد اسم غرفة الدردشة بترتيب أبجدي للمُعرّفات
        const chatRoomId = [userId, contactId].sort().join('_');
        const messagesRef = db.ref(`messages/${chatRoomId}`);
        
        // جلب آخر 100 رسالة (لتقليل حجم البيانات)
        const messagesSnap = await messagesRef.limitToLast(100).once('value');
        const messages = [];
        messagesSnap.forEach(childSnap => {
            messages.push(childSnap.val());
        });

        res.json(messages);

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب الرسائل.' });
    }
});

// نقطة وصول لإرسال رسالة جديدة (نص أو وسائط)
// ✅ تم تعديل المسار لاستخدام POST /api/messages/send
app.post('/api/messages/send', requireAuth, upload.single('media'), async (req, res) => {
  const senderId = req.session.userId;
  // ✅ استخراج contactId من body بدلاً من params (باستخدام الاسم other_id المرسل من chat.html)
  const { content, other_id: contactId, replied_to_id, replied_to_content, replied_to_sender } = req.body;
  const timestamp = admin.database.ServerValue.TIMESTAMP;
  let mediaUrl = null;
  let mediaType = null;

  if (!contactId) {
    return res.status(400).json({ ok: false, error: 'معرف جهة الاتصال مطلوب.' });
  }
  
  // التحقق من وجود محتوى نصي أو ملف وسائط
  if (!content && !req.file && !(req.body.content && req.body.content.length > 0)) {
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
    // تحديد اسم غرفة الدردشة بترتيب أبجدي للمُعرّفات
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
      replied_to_id: replied_to_id || null, // إضافة بيانات الرد
      replied_to_content: replied_to_content || null,
      replied_to_sender: replied_to_sender || null,
    };

    await messagesRef.set(messageData);

    // تحديث بيانات المحادثات (last message and unread count)
    const senderChatRef = db.ref(`chats/${senderId}/${contactId}`);
    const receiverChatRef = db.ref(`chats/${contactId}/${senderId}`);
    
    // تحديث المحادثة لدى المُرسِل
    await senderChatRef.update({
        last_message: content ? content.substring(0, 50) : (mediaType || 'ملف'),
        last_message_timestamp: timestamp,
        contact_id: contactId,
        unread_count: 0 // يتم تصفير عداد المرسل
    });
    
    // تحديث المحادثة لدى المُستقبِل وزيادة عداد الرسائل غير المقروءة
    await receiverChatRef.transaction((current) => {
        if (current === null) {
            return {
                last_message: content ? content.substring(0, 50) : (mediaType || 'ملف'),
                last_message_timestamp: timestamp,
                contact_id: senderId,
                unread_count: 1
            };
        }
        return {
            ...current,
            last_message: content ? content.substring(0, 50) : (mediaType || 'ملف'),
            last_message_timestamp: timestamp,
            unread_count: (current.unread_count || 0) + 1
        };
    });

    res.json({ ok: true, messageId: messageId });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ ok: false, error: 'فشل في إرسال الرسالة على الخادم.' });
  }
});

// ✅ نقطة وصول جديدة لتعليم الرسائل كمقروءة (حل مشكلة 404 POST /api/mark_read)
app.post('/api/mark_read', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { other_id } = req.body; // يتم إرسالها من chat.html

  if (!other_id) {
    return res.status(400).json({ ok: false, error: 'معرف جهة الاتصال مطلوب.' });
  }

  try {
    // 1. تحديد اسم غرفة الدردشة بترتيب أبجدي للمُعرّفات
    const chatRoomId = [userId, other_id].sort().join('_');
    const messagesRef = db.ref(`messages/${chatRoomId}`);

    // 2. تحديث الرسائل التي أرسلها الطرف الآخر وجعلها مقروءة
    // استخدم الاستعلام للتقليل من حجم البيانات: جلب الرسائل غير المقروءة فقط
    const messagesSnap = await messagesRef
      .orderByChild('is_read')
      .equalTo(false)
      .once('value');

    const updates = {};
    messagesSnap.forEach(childSnap => {
      const msg = childSnap.val();
      // إذا كانت الرسالة غير مقروءة ومرسلها هو الطرف الآخر (other_id)
      if (msg.senderId === other_id) {
        updates[`${childSnap.key}/is_read`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      await messagesRef.update(updates);
    }
    
    // 3. تحديث عداد الرسائل غير المقروءة للمستخدم الحالي إلى صفر
    await db.ref(`chats/${userId}/${other_id}`).update({
        unread_count: 0
    });

    res.json({ ok: true, message: 'تم تعليم الرسائل كمقروءة بنجاح.' });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ ok: false, error: 'فشل في عملية تعليم الرسائل كمقروءة.' });
  }
});


// ---------------- Debug Routes ----------------
// يمكن استخدام هذه المسارات لتصحيح الأخطاء محليًا أو على الخادم
app.get('/api/debug/session', requireAuth, (req, res) => {
  res.json({
    userId: req.session.userId,
    email: req.session.email,
    sessionId: req.session.id,
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
    // لا يوجد لدينا مجموعة 'users' في قاعدة البيانات الحالية، يتم الاعتماد على Firebase Auth و Profiles
    res.json({ ok: true, message: 'No direct "users" collection, check profiles.' });
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
    return res.status(500).json({ ok: false, error: 'خطأ غير متوقع على الخادم.' });
  }
  next();
});

// ---------------- Server Startup ----------------
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
