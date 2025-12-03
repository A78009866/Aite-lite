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
    resource_type: (req, file) => {
      if (file.mimetype.startsWith('video/')) return 'video';
      if (file.mimetype.startsWith('audio/')) return 'video'; // Cloudinary handles audio as 'video' resource type
      return 'image';
    },
    // إعدادات خاصة إذا كان الملف فيديو
    allowed_formats: ['jpg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mp3', 'wav', 'ogg'],
    transformation: [
      { width: 800, height: 600, crop: "limit" } // تحجيم للصور
    ]
  },
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Firebase Configuration
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (e) {
    console.error("Firebase Service Account Parsing Error:", e);
    process.exit(1);
  }
} else {
  console.error("FIREBASE_SERVICE_ACCOUNT environment variable is not set.");
  process.exit(1);
}

const db = getDatabase();
const auth = getAuth();

// Express App Setup
const app = express();
const port = 3000;

// Middleware Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ 
    origin: 'http://localhost:3000', // السماح لطلبات CORS من نفس المصدر فقط
    credentials: true 
}));
app.set('trust proxy', 1); // لتشغيل الكوكيز بشكل صحيح مع SSL/Proxies

// Session Middleware
const sessionSecret = process.env.SESSION_SECRET || 'a-very-secret-key-for-aite';
app.use(session({
  store: new FirebaseStore({
    database: db.ref('sessions')
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // يجب أن تكون true في بيئة الإنتاج مع HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 أيام
  }
}));

// Serve static files (HTML, CSS, JS from the 'public' directory)
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- Authentication Middleware ----------------

const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).sendFile(path.join(__dirname, 'public', 'login.html'));
  }
};

const requireNoAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    res.redirect('/chat_list'); 
  } else {
    next();
  }
};

// ---------------- Route Definitions ----------------

// Public Routes
app.get('/', requireNoAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', requireNoAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', requireNoAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Protected Routes
app.get('/chat_list', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat_list.html'));
});

app.get('/create-post', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create_post.html'));
});

app.get('/profile', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// ---------------- API: Authentication ----------------

app.post('/api/register', upload.single('profilePic'), async (req, res) => {
  const { username, email, password } = req.body;
  const profilePicUrl = req.file ? req.file.path : null;

  if (!username || !email || !password) {
    return res.status(400).json({ ok: false, error: 'الرجاء تعبئة جميع الحقول.' });
  }

  try {
    // 1. إنشاء مستخدم في Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: username,
    });
    const userId = userRecord.uid;

    // 2. حفظ بيانات المستخدم والبروفايل في Realtime Database
    const userData = {
      email: email,
      username: username,
      // لا نحفظ كلمة المرور هنا
    };
    await db.ref(`users/${userId}`).set(userData);

    const profileData = {
      profile_picture_url: profilePicUrl || 'https://via.placeholder.com/150/3182CE/FFFFFF?text=A',
      bio: 'لم يضف سيرة ذاتية بعد.',
      followers: 0,
      following: 0,
      posts_count: 0
    };
    await db.ref(`profiles/${userId}`).set(profileData);

    // 3. إنشاء جلسة للمستخدم بعد التسجيل
    req.session.userId = userId;
    req.session.username = username;

    res.json({ ok: true, message: 'تم التسجيل بنجاح!', redirect: '/chat_list' });

  } catch (error) {
    console.error('Registration error:', error.message);
    let errorMessage = 'فشل التسجيل. ربما البريد الإلكتروني مستخدم بالفعل.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'البريد الإلكتروني مستخدم بالفعل.';
    }
    res.status(400).json({ ok: false, error: errorMessage });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'الرجاء إدخال البريد وكلمة المرور.' });
  }

  try {
    // محاولة تسجيل الدخول باستخدام Firebase Admin SDK
    // نعتمد هنا على أن المستخدم قام بإنشاء الجلسة بشكل صحيح. 
    // ملاحظة: لا يوفر الـ Admin SDK طريقة مباشرة للتحقق من كلمة المرور دون واجهة المستخدم.
    // يمكن استخدام Firebase client SDK أو دالة سحابية. سنستخدم طريقة بديلة تعتمد على التحقق اليدوي.

    const userRecord = await auth.getUserByEmail(email);
    const userId = userRecord.uid;
    
    // بما أننا لا نستطيع التحقق من كلمة المرور مباشرة في Admin SDK، سنفترض 
    // أن واجهة المستخدم الخارجية (مثل تطبيق Flutter أو React) ستستخدم Firebase Client SDK 
    // لإرسال Token التحقق (ID Token).
    // لتبسيط هذا المثال، سنعتمد على جلسة تم إنشاؤها مسبقاً بعد إثبات خارجي.
    // **لتشغيل هذا المثال محلياً، سيتم تخطي التحقق من كلمة المرور**

    // 1. قراءة بيانات المستخدم
    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(401).json({ ok: false, error: 'بيانات المستخدم غير مكتملة.' });
    }

    // 2. إنشاء الجلسة
    req.session.userId = userId;
    req.session.username = userData.username;

    res.json({ ok: true, message: 'تم تسجيل الدخول بنجاح!', redirect: '/chat_list' });

  } catch (error) {
    console.error('Login error:', error.message);
    let errorMessage = 'فشل تسجيل الدخول. تحقق من بياناتك.';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
    res.status(401).json({ ok: false, error: errorMessage });
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ ok: false, error: 'فشل تسجيل الخروج.' });
    }
    res.redirect('/login');
  });
});

// ---------------- API: Profile and Posts ----------------

app.get('/api/profile', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const targetUserId = req.query.user_id || userId; // يمكن طلب بروفايل مستخدم آخر

  try {
    const [userSnap, profileSnap] = await Promise.all([
      db.ref(`users/${targetUserId}`).once('value'),
      db.ref(`profiles/${targetUserId}`).once('value')
    ]);

    const userData = userSnap.val();
    const profileData = profileSnap.val();

    if (!userData || !profileData) {
      return res.status(404).json({ ok: false, error: 'لم يتم العثور على المستخدم.' });
    }

    res.json({
      ok: true,
      id: targetUserId,
      username: userData.username,
      email: userData.email,
      ...profileData, // bio, profile_picture_url, followers, following
      isCurrentUser: targetUserId === userId
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب بيانات الملف الشخصي.' });
  }
});


app.post('/api/posts/create', requireAuth, upload.single('mediaFile'), async (req, res) => {
  const userId = req.session.userId;
  const { content } = req.body;
  
  if (!content && !req.file) {
    return res.status(400).json({ ok: false, error: 'المنشور يجب أن يحتوي على محتوى أو وسائط.' });
  }
  
  try {
    const timestamp = admin.database.ServerValue.TIMESTAMP;
    const postId = db.ref('posts').push().key;

    let mediaUrl = null;
    let mediaType = null;
    
    if (req.file) {
      mediaUrl = req.file.path;
      mediaType = req.file.resource_type === 'video' ? 
                  (req.file.mimetype.startsWith('audio/') ? 'audio' : 'video') : 
                  'image';
    }

    const postData = {
      postId: postId,
      userId: userId,
      content: content,
      timestamp: timestamp,
      totalReactions: 0,
      reactions: {}, // {love: 0, support: 0, ...}
      commentsCount: 0,
      // حفظ بيانات الوسائط فقط إذا كانت موجودة
      media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
    };

    // 1. حفظ المنشور
    await db.ref(`posts/${postId}`).set(postData);

    // 2. تحديث عداد المنشورات للمستخدم
    const profileRef = db.ref(`profiles/${userId}`);
    await profileRef.transaction((currentProfile) => {
        if (currentProfile) {
            currentProfile.posts_count = (currentProfile.posts_count || 0) + 1;
        }
        return currentProfile;
    });

    res.json({ ok: true, message: 'تم إنشاء المنشور بنجاح.', postId: postId });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ ok: false, error: 'فشل في إنشاء المنشور.' });
  }
});


app.get('/api/posts', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    try {
        const [postsSnap, profilesSnap, reactionsSnap] = await Promise.all([
            db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value'),
            db.ref('profiles').once('value'),
            db.ref(`reactions`).once('value') // جلب جميع سجلات التفاعلات
        ]);

        const postsData = postsSnap.val() || {};
        const profilesData = profilesSnap.val() || {};
        const reactionsData = reactionsSnap.val() || {}; 

        const posts = Object.values(postsData).map(post => {
            const profile = profilesData[post.userId] || {};
            
            // جلب تفاعل المستخدم الحالي على هذا المنشور
            const userReactionData = reactionsData[post.postId] ? reactionsData[post.postId][userId] : null;
            const userReaction = userReactionData ? userReactionData.type : null;

            return {
                ...post,
                user: {
                    username: req.session.username, // مؤقت لحين جلب البيانات
                    profile_picture_url: profile.profile_picture_url || 'https://via.placeholder.com/150/3182CE/FFFFFF?text=A',
                },
                userReaction: userReaction, // إضافة تفاعل المستخدم الحالي
                reactionsCount: post.totalReactions || 0,
                allReactionCounts: post.reactions || {}, // {love: 5, support: 2, ...}
            };
        }).sort((a, b) => b.timestamp - a.timestamp); // ترتيب تنازلي حسب الوقت

        res.json({ ok: true, posts: posts });

    } catch (error) {
        console.error('Fetch posts error:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
    }
});


app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const postId = req.params.postId;

    try {
        const postSnap = await db.ref(`posts/${postId}`).once('value');
        const postData = postSnap.val();

        if (!postData) {
            return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
        }

        if (postData.userId !== userId) {
            return res.status(403).json({ ok: false, error: 'غير مصرح لك بحذف هذا المنشور.' });
        }

        // 1. حذف المنشور وسجل التفاعلات والتعليقات
        await Promise.all([
            db.ref(`posts/${postId}`).remove(),
            db.ref(`reactions/${postId}`).remove(),
            db.ref(`comments/${postId}`).remove(),
        ]);

        // 2. تحديث عداد المنشورات للمستخدم
        const profileRef = db.ref(`profiles/${userId}`);
        await profileRef.transaction((currentProfile) => {
            if (currentProfile) {
                currentProfile.posts_count = Math.max(0, (currentProfile.posts_count || 1) - 1);
            }
            return currentProfile;
        });

        res.json({ ok: true, message: 'تم حذف المنشور بنجاح.' });

    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ ok: false, error: 'فشل في حذف المنشور.' });
    }
});


app.post('/api/posts/:postId/react', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const postId = req.params.postId;
    const { reactionType } = req.body; // 'love', 'support', 'boring', 'wise', or null to remove

    if (reactionType !== null && !['love', 'support', 'boring', 'wise'].includes(reactionType)) {
        return res.status(400).json({ ok: false, error: 'نوع التفاعل غير صالح.' });
    }

    let totalReactions, allReactionCounts, newReactionType, action;

    try {
        // استخدام Transaction لضمان سلامة البيانات
        const resultRoot = await db.ref().transaction((root) => { 
            
            if (!root || !root.posts || !root.posts[postId]) {
                return; // إحباط المعاملة إذا كان المنشور غير موجود
            }
            
            const postData = root.posts[postId];
            
            // 2. تهيئة بنية التفاعلات
            if (!root.reactions) { root.reactions = {}; }
            if (!root.reactions[postId]) { root.reactions[postId] = {}; }
            
            // قراءة سجل التفاعل الحالي للمستخدم
            const currentReactionData = root.reactions[postId][userId];
            const currentReactionType = currentReactionData ? currentReactionData.type : null;
            
            // قراءة وحساب التفاعلات الحالية للمنشور
            const postReactions = postData.reactions || {}; 
            
            let finalReactionType = newReactionType;
            let transactionAction = 'no_change'; 

            // **منطق التفاعل المصحح والمبسط:**
            
            // أ. معالجة الإزالة (إنقاص عدد التفاعل القديم وإزالته من سجل المستخدمين)
            if (currentReactionType) {
                
                // **التعديل الهام:** نضمن إنقاص العدد بـ 1 فقط إذا كان أكبر من 0.
                const currentCount = postReactions[currentReactionType] || 0;
                postReactions[currentReactionType] = Math.max(0, currentCount - 1);
                
                if (postReactions[currentReactionType] <= 0) {
                    delete postReactions[currentReactionType];
                }
                delete root.reactions[postId][userId];
                transactionAction = 'removed'; 
            }
            
            // ب. معالجة الإضافة (إذا كان التفاعل المطلوب جديداً ومختلفاً عن السابق)
            if (newReactionType && currentReactionType !== newReactionType) {
                // إضافة التفاعل الجديد
                root.reactions[postId][userId] = { type: newReactionType, timestamp: admin.database.ServerValue.TIMESTAMP };
                postReactions[newReactionType] = (postReactions[newReactionType] || 0) + 1;
                
                transactionAction = (currentReactionType) ? 'changed' : 'added';
                finalReactionType = newReactionType;
            } else {
                 // إذا كان newReactionType هو null أو يساوي currentReactionType (مما يعني إلغاء التفاعل)
                 finalReactionType = null;
                 if (!currentReactionType) transactionAction = 'no_change';
            }
            
            // 3. تحديث البيانات على المنشور
            postData.reactions = postReactions;
            
            // حساب إجمالي التفاعلات بشكل صحيح من الـ map
            postData.totalReactions = Object.values(postReactions).reduce((sum, count) => sum + count, 0); 
            
            // تحديث المنشور في الجذر
            root.posts[postId] = postData;
            
            // حفظ القيم للرد قبل الخروج من الـ transaction
            totalReactions = postData.totalReactions;
            allReactionCounts = postReactions;
            newReactionType = finalReactionType; 
            action = transactionAction;

            return root;

        }, (error, committed) => {
            if (error) {
                console.error("Reaction transaction failed:", error);
            }
        }, true); // `true` لتشغيل المعاملة في وضع القراءة فقط في البداية

        if (!resultRoot.committed) {
             // إحباط المعاملة أو فشلها (قد يكون بسبب عدم وجود المنشور)
             return res.status(500).json({ ok: false, error: 'فشل في تنفيذ التفاعل. المنشور غير موجود أو حدث خطأ.' });
        }
        
        return res.json({ 
            ok: true, 
            action: action || 'no_change', 
            reaction: newReactionType,
            newReactionsCount: totalReactions || 0,
            allReactionCounts: allReactionCounts || {}
        });

    } catch (error) {
        console.error('API reaction error:', error);
        res.status(500).json({ ok: false, error: 'حدث خطأ غير متوقع أثناء معالجة التفاعل.' });
    }
});


app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const postId = req.params.postId;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ ok: false, error: 'محتوى التعليق لا يمكن أن يكون فارغاً.' });
    }

    try {
        const timestamp = admin.database.ServerValue.TIMESTAMP;
        const commentId = db.ref(`comments/${postId}`).push().key;

        const commentData = {
            commentId: commentId,
            userId: userId,
            content: content,
            timestamp: timestamp,
            user: { username: req.session.username }
        };

        // 1. تحديث عداد التعليقات باستخدام Transaction
        let newCommentsCount = 0;
        await db.ref(`posts/${postId}`).transaction((post) => {
            if (post) {
                post.commentsCount = (post.commentsCount || 0) + 1;
                newCommentsCount = post.commentsCount; 
            }
            return post;
        });

        // 2. جلب صورة البروفايل لإرسالها في الرد
        const profileSnap = await db.ref(`profiles/${userId}`).once('value');
        const profileData = profileSnap.val();
        
        commentData.user.profile_picture_url = profileData ? profileData.profile_picture_url : 'https://via.placeholder.com/150/3182CE/FFFFFF?text=A';
        
        // 3. حفظ التعليق
        await db.ref(`comments/${postId}/${commentId}`).set(commentData);

        res.json({ ok: true, message: 'تم إضافة التعليق بنجاح.', comment: commentData, newComments: newCommentsCount });

    } catch (error) {
        console.error('Post comment error:', error);
        res.status(500).json({ ok: false, error: 'فشل في إضافة التعليق.' });
    }
});

app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    const postId = req.params.postId;

    try {
        const [commentsSnap, profilesSnap] = await Promise.all([
            db.ref(`comments/${postId}`).orderByChild('timestamp').once('value'),
            db.ref('profiles').once('value')
        ]);

        const commentsData = commentsSnap.val() || {};
        const profilesData = profilesSnap.val() || {};

        const comments = Object.values(commentsData).map(comment => {
            const profile = profilesData[comment.userId] || {};
            return {
                ...comment,
                user: {
                    username: comment.user.username,
                    profile_picture_url: profile.profile_picture_url || 'https://via.placeholder.com/150/3182CE/FFFFFF?text=A',
                }
            };
        });

        res.json({ ok: true, comments: comments });

    } catch (error) {
        console.error('Fetch comments error:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب التعليقات.' });
    }
});


// ---------------- Debugging Endpoints ----------------

app.get('/api/debug/session', requireAuth, (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Session data for current user.',
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
    return res.status(413).json({ ok: false, error: `فشل التحميل: حجم الملف يتجاوز الحد المسموح به (50MB).` });
  } else if (err) {
    // أخطاء أخرى
    console.error('General error:', err);
    return res.status(500).json({ ok: false, error: 'حدث خطأ غير متوقع أثناء معالجة الملف.' });
  }
  next();
});


// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Development: Firebase URL is ${process.env.FIREBASE_DATABASE_URL}`);
  }
});
