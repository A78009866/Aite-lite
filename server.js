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
    resource_type: 'auto', // للسماح بتحميل الصور والفيديو والصوت
    // يمكن إضافة شروط للتحويلات هنا
  },
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024 // الحد الأقصى لحجم الملف: 10 ميجابايت
    }
});


// Firebase Admin SDK initialization
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
} catch (error) {
    if (!/already exists/u.test(error.message)) {
        console.error('Firebase initialization error:', error.stack);
    }
}


const auth = getAuth();
const db = getDatabase();
const app = express();
const port = process.env.PORT || 3000;

// Enable trust proxy if hosted behind a proxy (like Render)
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    app.set('trust proxy', 1); // Trust first proxy
}

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'a_strong_secret_key',
    resave: false,
    saveUninitialized: false, // لا تنشئ جلسة إلا إذا تم تعديلها
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax' // أو 'none' إذا كان هناك مشكلة في CORS، لكن 'lax' عادةً آمن
    },
    store: new FirebaseStore({
        database: db,
        expire: 60 * 60 * 24 * 7, // 7 days
        // (optional) prefix: 'sessions' // Default is 'sessions'
    })
};

if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sessionConfig.cookie.secure = true // serve secure cookies
  sessionConfig.cookie.sameSite = 'none'; // Required for cross-site cookie
}

app.use(session(sessionConfig));

// Middleware
app.use(cors({
    origin: '*', // يمكن تقييد هذا في الإنتاج
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// --- Authentication Middleware ---
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        // إذا كان الطلب AJAX، أرسل 401
        if (req.xhr || req.headers.accept.includes('json')) {
            res.status(401).json({ ok: false, error: 'غير مصرح لك. يرجى تسجيل الدخول.' });
        } else {
            // إذا كان الطلب تحميل صفحة، أعد التوجيه
            res.redirect('/login');
        }
    }
};

// --- Helper Functions (Mock for now, replace with actual logic) ---
// Note: In a real app, post fetching and creation would be much more complex, 
// including indexing and pagination. These are basic implementations.

/**
 * دالة مساعدة لدمج بيانات المنشور مع تفاعلات المستخدم وعدد التفاعلات الإجمالي
 * @param {object} postsSnapshot - Firebase snapshot of posts
 * @param {object} allReactions - Firebase snapshot of all reactions
 * @param {string} currentUserId - ID of the user viewing the posts
 * @returns {Array} - Array of post objects ready for client
 */
const formatPostsForClient = (postsSnapshot, allReactions, currentUserId) => {
    const posts = [];
    postsSnapshot.forEach(postSnap => {
        const post = postSnap.val();
        post.postId = postSnap.key; // إضافة مفتاح المنشور

        // 1. جلب تفاعل المستخدم الحالي
        const userReactionsForPost = allReactions[post.postId] || {};
        const currentUserReactionData = userReactionsForPost[currentUserId];
        post.userReaction = currentUserReactionData ? currentUserReactionData.type : null;

        // 2. حساب إجمالي التفاعلات وأعداد كل نوع
        // (يفترض أن المنشورات في قاعدة البيانات تحتوي بالفعل على هذه الحقول المحدثة - post.totalReactions و post.reactions)
        post.reactionsCount = post.totalReactions || 0;
        post.allReactionCounts = post.reactions || {};

        posts.push(post);
    });

    // ترتيب المنشورات من الأحدث للأقدم
    posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return posts;
};


// ---------------- API Endpoints ----------------

// مسار تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // استخدام Firebase Auth للتحقق من بيانات الاعتماد
        const userCredential = await auth.getUserByEmail(email);
        
        // (ملاحظة: Firebase Admin SDK لا يدعم التحقق من كلمة المرور مباشرة.
        // يجب استخدام Firebase Client SDK لهذا الغرض، أو الاعتماد على Firebase
        // Hosting لخدمة صفحة تسجيل دخول تقوم بذلك. هنا نفترض أن التحقق تم
        // بطريقة ما وأن userCredential صحيح).

        // For simplicity in this mock server, we will assume successful login
        // and set the session. In a real app, you'd verify the password first.
        
        req.session.userId = userCredential.uid;
        // ... (يمكن حفظ بيانات أخرى في الجلسة)

        res.json({ ok: true, message: 'تم تسجيل الدخول بنجاح.', userId: userCredential.uid });

    } catch (error) {
        console.error('Login error:', error.message);
        res.status(401).json({ ok: false, error: 'بريد إلكتروني أو كلمة مرور غير صحيحة.' });
    }
});


// مسار جلب ملف تعريف المستخدم الحالي
app.get('/api/profile', requireAuth, async (req, res) => {
    const userId = req.session.userId;

    try {
        const snap = await db.ref(`profiles/${userId}`).once('value');
        const profile = snap.val();

        if (profile) {
            // لا ترسل البيانات الحساسة مثل 'email' أو 'passwordHash'
            res.json({ 
                id: userId,
                username: profile.username,
                profile_picture_url: profile.profile_picture_url || '/images/default_profile.png'
            });
        } else {
            res.status(404).json({ ok: false, error: 'ملف التعريف غير موجود.' });
        }
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب ملف التعريف.' });
    }
});

// مسار جلب قائمة المنشورات
app.get('/api/posts', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { lastTimestamp } = req.query; // لتنفيذ التحميل اللانهائي

    try {
        // جلب جميع المنشورات
        let postsRef = db.ref('posts').orderByChild('timestamp');
        
        if (lastTimestamp) {
            // إذا كان هناك مؤشر، ابدأ من عنده
            postsRef = postsRef.endBefore(parseInt(lastTimestamp));
        }
        
        // جلب آخر 20 منشوراً
        const postsSnap = await postsRef.limitToLast(20).once('value');

        // جلب جميع سجلات تفاعلات المستخدمين
        const reactionsSnap = await db.ref('reactions').once('value');
        const allReactions = reactionsSnap.val() || {};

        // تنسيق وترتيب المنشورات للعميل
        const posts = formatPostsForClient(postsSnap, allReactions, userId);

        res.json({ ok: true, posts: posts });

    } catch (error) {
        console.error('Posts fetch error:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
    }
});

// مسار إضافة تفاعل لمنشور
// ----------------- [ الدالة المُعدّلة لضمان الثبات والإزالة الصحيحة ] -----------------
app.post('/api/posts/:postId/react', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const userId = req.session.userId;
    // reactionType يمكن أن تكون 'love', 'support', 'boring', 'wise' أو null للإزالة
    const { reactionType } = req.body; 

    if (!postId || !userId) {
        return res.status(400).json({ ok: false, error: 'Post ID and user ID are required.' });
    }

    const allowedReactions = ['love', 'support', 'boring', 'wise'];

    try {
        // التحقق من صلاحية نوع التفاعل قبل بدء المعاملة
        if (reactionType && !allowedReactions.includes(reactionType)) {
             return res.status(400).json({ ok: false, error: 'نوع التفاعل غير صالح.' });
        }
        
        let action; // 'added', 'removed', or 'changed'
        let finalReactionType = null;
        let totalReactions = 0;
        let allReactionCounts = {};
        
        // استخدام Transaction لضمان سلامة البيانات
        const resultRoot = await db.ref().transaction((root) => { 
            
            // 1. تحقق من وجود المنشور
            if (root === null || !root.posts || !root.posts[postId]) {
                 return; 
            }
            
            const postData = root.posts[postId];
            
            // 2. تهيئة بنية التفاعلات
            if (!root.reactions) { root.reactions = {}; }
            if (!root.reactions[postId]) { root.reactions[postId] = {}; }
            
            const currentReactionData = root.reactions[postId][userId];
            const currentReactionType = currentReactionData ? currentReactionData.type : null;
            
            const postReactions = postData.reactions || {};
            
            let transactionAction = 'no_change'; 
            
            // 3. المنطق المشترك لمعالجة الإزالة/الإلغاء
            
            // أ. إلغاء التفاعل الحالي أولاً (إذا كان موجوداً)
            if (currentReactionType) {
                // إنقاص عدد التفاعل القديم في المنشور
                postReactions[currentReactionType] = (postReactions[currentReactionType] || 1) - 1;
                if (postReactions[currentReactionType] <= 0) {
                    delete postReactions[currentReactionType];
                }
                // إزالة سجل المستخدم من الـ Reactions
                delete root.reactions[postId][userId];
                transactionAction = 'removed'; 
            }
            
            // ب. إضافة التفاعل الجديد (إذا كان نوع التفاعل الجديد موجوداً ومختلفاً عن القديم)
            if (reactionType && reactionType !== currentReactionType) {
                // إضافة التفاعل الجديد
                root.reactions[postId][userId] = { type: reactionType, timestamp: admin.database.ServerValue.TIMESTAMP };
                postReactions[reactionType] = (postReactions[reactionType] || 0) + 1;
                
                transactionAction = (currentReactionType) ? 'changed' : 'added';
                finalReactionType = reactionType; // التفاعل الجديد
            } else if (currentReactionType && currentReactionType === reactionType) {
                // حالة نقر المستخدم على نفس التفاعل، وقد عالجناها بالفعل في (أ) بالإزالة
                // لا نحتاج لإعادة إضافته، نترك حالة الإزالة
                finalReactionType = null; 
            } else {
                 // لا يوجد تفاعل حالي ولا تفاعل جديد مرسل (no_change)
                 finalReactionType = null;
                 if (!currentReactionType) transactionAction = 'no_change';
            }
            
            // 4. تحديث البيانات على المنشور
            postData.reactions = postReactions;
            postData.totalReactions = Object.values(postReactions).reduce((sum, count) => sum + count, 0);
            
            // تحديث المنشور في الجذر
            root.posts[postId] = postData;
            
            // حفظ القيم للرد قبل الخروج من الـ transaction
            totalReactions = postData.totalReactions;
            allReactionCounts = postReactions;
            action = transactionAction; // تعيين قيمة الرد

            return root; // تمرير القيمة الجديدة للجذر

        }, (error, committed, snapshot) => {
            if (error) {
                console.error('Transaction failed: ', error);
                throw new Error('Transaction failed');
            }
        });

        // إذا فشلت المعاملة بسبب عدم وجود المنشور
        if (!resultRoot) {
            return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
        }
        
        // الرد بالبيانات الجديدة التي تم تحديثها داخل المعاملة
        return res.json({ 
            ok: true, 
            action: action || 'no_change', 
            reaction: finalReactionType, // استخدام التفاعل النهائي الصحيح
            newReactionsCount: totalReactions || 0,
            allReactionCounts: allReactionCounts || {}
        });

    } catch (error) {
        console.error('Reaction error:', error.message);
        res.status(500).json({ ok: false, error: 'فشل في معالجة التفاعل.' });
    }
});
// ----------------- [ نهاية الدالة المُعدّلة ] -----------------


// مسار إنشاء منشور جديد
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
    const { content } = req.body;
    const userId = req.session.userId;
    let mediaData = null;

    if (!content && !req.file) {
        return res.status(400).json({ ok: false, error: 'المنشور لا يمكن أن يكون فارغاً.' });
    }

    if (req.file) {
        const fileType = req.file.mimetype.split('/')[0];
        mediaData = {
            url: req.file.path,
            type: fileType, // 'image', 'video', 'audio'
            // إذا كانت صورة، يمكن إضافة عرض وارتفاع
        };
    }

    try {
        // جلب اسم المستخدم وصورة البروفايل
        const profileSnap = await db.ref(`profiles/${userId}`).once('value');
        const profile = profileSnap.val();
        
        if (!profile) {
            return res.status(404).json({ ok: false, error: 'ملف التعريف غير موجود.' });
        }

        const newPostRef = db.ref('posts').push();
        const postData = {
            id: newPostRef.key,
            userId: userId,
            username: profile.username,
            profilePic: profile.profile_picture_url || '/images/default_profile.png',
            content: content || '',
            timestamp: admin.database.ServerValue.TIMESTAMP,
            media: mediaData,
            totalReactions: 0, // الإجمالي
            reactions: {}, // {love: 5, support: 2}
            totalComments: 0,
        };

        await newPostRef.set(postData);

        res.status(201).json({ 
            ok: true, 
            message: 'تم إنشاء المنشور بنجاح.', 
            post: { 
                ...postData,
                postId: newPostRef.key,
                userReaction: null, // لا يوجد تفاعل عند الإنشاء
                reactionsCount: 0,
                allReactionCounts: {}
            }
        });

    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ ok: false, error: 'فشل في إنشاء المنشور.' });
    }
});


// مسار جلب التعليقات لمنشور معين
app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    const { postId } = req.params;

    try {
        const commentsSnap = await db.ref(`comments/${postId}`).orderByChild('timestamp').once('value');
        const comments = [];

        commentsSnap.forEach(commentSnap => {
            const comment = commentSnap.val();
            comment.commentId = commentSnap.key;
            comments.push(comment);
        });

        res.json({ ok: true, comments: comments });

    } catch (error) {
        console.error('Comments fetch error:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب التعليقات.' });
    }
});

// مسار إضافة تعليق لمنشور
app.post('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.session.userId;

    if (!content) {
        return res.status(400).json({ ok: false, error: 'محتوى التعليق مطلوب.' });
    }

    try {
        // جلب اسم المستخدم وصورة البروفايل
        const profileSnap = await db.ref(`profiles/${userId}`).once('value');
        const profile = profileSnap.val();

        if (!profile) {
            return res.status(404).json({ ok: false, error: 'ملف التعريف غير موجود.' });
        }

        // إنشاء التعليق الجديد
        const newCommentRef = db.ref(`comments/${postId}`).push();
        const commentData = {
            id: newCommentRef.key,
            userId: userId,
            username: profile.username,
            profilePic: profile.profile_picture_url || '/images/default_profile.png',
            content: content,
            timestamp: admin.database.ServerValue.TIMESTAMP,
        };

        await newCommentRef.set(commentData);

        // تحديث عدد التعليقات في المنشور (معاملة بسيطة)
        const postRef = db.ref(`posts/${postId}`);
        await postRef.child('totalComments').transaction(currentCount => {
            return (currentCount || 0) + 1;
        });

        res.status(201).json({ 
            ok: true, 
            message: 'تم إضافة التعليق بنجاح.', 
            comment: commentData 
        });

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ ok: false, error: 'فشل في إضافة التعليق.' });
    }
});



// ---------------- Debug/Info Endpoints ----------------
// مسارات للمساعدة في فحص حالة الخادم والجلسة (للتطوير)
app.get('/api/debug/session', requireAuth, (req, res) => {
  res.json({
    ok: true,
    message: 'Session is active for the current user.',
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
  } else if (err) {
    // أخطاء أخرى غير معروفة
    console.error('Unknown server error:', err.stack);
    return res.status(500).json({ ok: false, error: 'حدث خطأ غير متوقع في الخادم.' });
  }
  next();
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat_list.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
