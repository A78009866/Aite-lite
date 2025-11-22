// تشغيل مكتبة dotenv لقراءة متغيرات البيئة من ملف .env محلياً
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const FirebaseStore = require('connect-session-firebase')(session);
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const cors = require('cors'); // تم إضافة هذا السطر

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
      } else if (req.originalUrl.includes('/api/posts/create')) {
        return 'post_media'; // مسار جديد لملفات المنشورات
      }
      return 'general';
    },
    public_id: (req, file) => Date.now() + '-' + file.originalname,
    resource_type: 'auto',
  },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // الحد الأقصى 10 ميجابايت 
});

// Firebase Admin SDK Initialization
if (!admin.apps.length) {
  // استخدام متغير بيئة لتخزين بيانات الخدمة JSON مشفرة
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = getDatabase();
const auth = getAuth();
const app = express();

// استخدام cors للسماح بطلبات من نطاقات مختلفة في التطوير
app.use(cors({
    origin: (origin, callback) => {
        // السماح بالطلبات بدون أصل (مثل تطبيقات الهاتف أو curl)
        if (!origin) return callback(null, true);
        // يمكنك هنا إضافة نطاقات محددة للسماح بها في بيئة الإنتاج
        // مثل: if (allowedDomains.includes(origin)) { return callback(null, true); }
        // في الوقت الحالي، سنسمح بالكل في بيئة التطوير
        return callback(null, true);
    },
    credentials: true,
}));

// Session Middleware Configuration
app.use(session({
    store: new FirebaseStore({
        database: db.ref('sessions')
    }),
    secret: process.env.SESSION_SECRET || 'a_very_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));


// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- Helper Functions ----------------

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        // في حالة طلب واجهة API، نرد بـ 401
        if (req.path.startsWith('/api')) {
            return res.status(401).json({ ok: false, error: 'Unauthorized: Not logged in' });
        }
        // في حالة طلب صفحة HTML، نعيد التوجيه لصفحة تسجيل الدخول
        res.redirect('/login');
    }
};

/**
 * دالة مساعدة لجلب تفاصيل ملف المستخدم
 * @param {string} userId - معرّف المستخدم
 * @returns {Promise<Object|null>}
 */
async function getUserProfile(userId) {
    if (!userId) return null;
    try {
        const snapshot = await db.ref(`profiles/${userId}`).once('value');
        const profile = snapshot.val();
        if (profile) {
            return {
                id: userId,
                username: profile.username || 'مستخدم غير معروف',
                profile_picture_url: profile.profile_picture_url || 'https://via.placeholder.com/40/3182CE/FFFFFF?text=P',
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

/**
 * دالة مساعدة لدمج تفاصيل المستخدم مع المنشورات
 * @param {Object} post - كائن المنشور من قاعدة البيانات
 * @param {string} postId - معرّف المنشور
 * @returns {Promise<Object>}
 */
async function processPost(postId, post) {
    const userProfile = await getUserProfile(post.userId);

    // جلب عدد الإعجابات
    const likesSnap = await db.ref(`posts/${postId}/likes`).once('value');
    const likesCount = likesSnap.numChildren();
    
    // جلب عدد التعليقات
    const commentsSnap = await db.ref(`posts/${postId}/comments`).once('value');
    const commentsCount = commentsSnap.numChildren();

    return {
        postId: postId,
        userId: post.userId,
        content: post.content || '',
        timestamp: post.timestamp,
        media: post.media || null,
        likes: likesCount,
        commentsCount: commentsCount,
        user: userProfile || { id: post.userId, username: 'مستخدم محذوف', profile_picture_url: 'https://via.placeholder.com/40/000000/FFFFFF?text=X' },
    };
}


// ---------------- Routes for Authentication and Pages ----------------

// Route for the login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Route for the registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Route for the splash screen
app.get('/splash', (req, res) => {
    res.sendFile(path.join(__dirname, 'splash.html'));
});

// Route to check authentication status and redirect
app.get('/check-status', (req, res) => {
    if (req.session && req.session.userId) {
        res.redirect('/chat_list');
    } else {
        res.redirect('/login');
    }
});

// Route for the main home feed (requires authentication)
app.get('/chat_list', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'chat_list.html'));
});

// Route for creating a new post (requires authentication)
app.get('/create-post', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'create_post.html'));
});

// Root route redirects to splash
app.get('/', (req, res) => {
    res.redirect('/splash');
});

// ---------------- API Routes for Posts and Profile ----------------

// API route to get user profile details
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const profile = await getUserProfile(req.session.userId);
        if (!profile) {
             return res.status(404).json({ ok: false, error: 'Profile not found' });
        }
        res.json(profile);
    } catch (error) {
        console.error('API Profile Error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch profile' });
    }
});

// API route to create a new post
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
    const userId = req.session.userId;
    const { content } = req.body;
    
    // التحقق من وجود محتوى أو ملف وسائط
    if (!content && !req.file) {
        return res.status(400).json({ ok: false, error: 'Post must contain content or media.' });
    }

    try {
        const postData = {
            userId: userId,
            content: content || '',
            timestamp: admin.database.ServerValue.TIMESTAMP,
        };

        if (req.file) {
            postData.media = {
                url: req.file.path,
                type: req.file.resource_type, // 'image', 'video', 'raw', 'audio'
                format: req.file.format,
            };
        }

        const newPostRef = db.ref('posts').push();
        await newPostRef.set(postData);

        res.json({ ok: true, message: 'Post created successfully', postId: newPostRef.key });

    } catch (error) {
        console.error('Post Creation Error:', error);
        res.status(500).json({ ok: false, error: 'Failed to create post' });
    }
});

// API route to fetch all posts
app.get('/api/posts', requireAuth, async (req, res) => {
    try {
        const postsSnap = await db.ref('posts').orderByChild('timestamp').once('value');
        const postsData = postsSnap.val();

        if (!postsData) {
            return res.json({ ok: true, posts: [] });
        }

        const postKeys = Object.keys(postsData).reverse(); // عرض الأحدث أولاً
        
        // جلب جميع المنشورات ومعالجة بيانات المستخدمين والإعجابات والتعليقات بالتوازي
        const processedPostsPromises = postKeys.map(key => processPost(key, postsData[key]));
        const processedPosts = await Promise.all(processedPostsPromises);

        res.json({ ok: true, posts: processedPosts });

    } catch (error) {
        console.error('Fetch Posts Error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch posts' });
    }
});


// API route to delete a post
app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const userId = req.session.userId;

    try {
        const postRef = db.ref(`posts/${postId}`);
        const postSnap = await postRef.once('value');
        const post = postSnap.val();

        if (!post) {
            return res.status(404).json({ ok: false, error: 'Post not found.' });
        }

        if (post.userId !== userId) {
            return res.status(403).json({ ok: false, error: 'Forbidden: You do not own this post.' });
        }

        // حذف المنشور و الإعجابات و التعليقات المرتبطة
        await postRef.remove();
        await db.ref(`posts/${postId}/likes`).remove();
        await db.ref(`posts/${postId}/comments`).remove();

        res.json({ ok: true, message: 'Post deleted successfully.' });

    } catch (error) {
        console.error('Post Deletion Error:', error);
        res.status(500).json({ ok: false, error: 'Failed to delete post' });
    }
});


// ---------------- NEW API Routes for LIKES AND COMMENTS ----------------

// API to handle liking/unliking a post
app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const userId = req.session.userId;

    try {
        const likeRef = db.ref(`posts/${postId}/likes/${userId}`);
        const likeSnap = await likeRef.once('value');

        if (likeSnap.exists()) {
            // المستخدم أعجب بالمنشور بالفعل، نقوم بإلغاء الإعجاب
            await likeRef.remove();
            res.json({ ok: true, liked: false, message: 'Unliked post successfully.' });
        } else {
            // المستخدم لم يعجب بالمنشور، نقوم بالإعجاب
            await likeRef.set(true); // يمكن تخزين التاريخ هنا أيضاً
            res.json({ ok: true, liked: true, message: 'Liked post successfully.' });
        }

    } catch (error) {
        console.error(`Like/Unlike Error for post ${postId}:`, error);
        res.status(500).json({ ok: false, error: 'Failed to process like/unlike.' });
    }
});

// API to fetch comments for a post
app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    const { postId } = req.params;

    try {
        const commentsSnap = await db.ref(`posts/${postId}/comments`).orderByChild('timestamp').once('value');
        const commentsData = commentsSnap.val();

        if (!commentsData) {
            return res.json({ ok: true, comments: [] });
        }

        const commentsKeys = Object.keys(commentsData);
        
        const processedCommentsPromises = commentsKeys.map(async key => {
            const comment = commentsData[key];
            const userProfile = await getUserProfile(comment.userId);
            
            return {
                commentId: key,
                content: comment.content,
                timestamp: comment.timestamp,
                user: userProfile || { id: comment.userId, username: 'مستخدم محذوف', profile_picture_url: 'https://via.placeholder.com/40/000000/FFFFFF?text=X' }
            };
        });

        const processedComments = await Promise.all(processedCommentsPromises);
        
        // عرض الأحدث أولاً
        processedComments.sort((a, b) => b.timestamp - a.timestamp);

        res.json({ ok: true, comments: processedComments });

    } catch (error) {
        console.error(`Fetch Comments Error for post ${postId}:`, error);
        res.status(500).json({ ok: false, error: 'Failed to fetch comments.' });
    }
});

// API to add a new comment to a post
app.post('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const userId = req.session.userId;
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ ok: false, error: 'Comment content cannot be empty.' });
    }

    try {
        const commentData = {
            userId: userId,
            content: content.trim(),
            timestamp: admin.database.ServerValue.TIMESTAMP,
        };

        const newCommentRef = db.ref(`posts/${postId}/comments`).push();
        await newCommentRef.set(commentData);
        
        // جلب عدد التعليقات الجديد (اختياري)
        const commentsSnap = await db.ref(`posts/${postId}/comments`).once('value');
        const commentsCount = commentsSnap.numChildren();


        res.json({ 
            ok: true, 
            message: 'Comment added successfully.', 
            commentId: newCommentRef.key,
            newCount: commentsCount
        });

    } catch (error) {
        console.error(`Add Comment Error for post ${postId}:`, error);
        res.status(500).json({ ok: false, error: 'Failed to add comment.' });
    }
});


// ---------------- Debug Routes ----------------
app.get('/api/debug/session', requireAuth, (req, res) => {
  res.json({
    ok: true,
    sessionId: req.session.id,
    isLoggedIn: !!(req.session && req.session.userId),
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
    return res.status(400).json({ ok: false, error: `Upload error: ${err.message}` });
  } else if (err) {
    // أخطاء أخرى غير متوقعة
    console.error('General error during upload or processing:', err);
    return res.status(500).json({ ok: false, error: 'An unknown error occurred during processing.' });
  }
  next(); // تمرير إلى المسارات التالية إذا لم يكن هناك خطأ
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
