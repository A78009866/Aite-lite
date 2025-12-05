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
const fs = require('fs'); // لاستخدام نظام الملفات المحلي

// تهيئة Firebase Admin SDK
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
} catch (e) {
    console.error("Firebase initialization failed. Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
    process.exit(1);
}

const db = getDatabase();
const firebaseAuth = getAuth();

// إعدادات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// إعدادات Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = 'general';
    if (req.originalUrl.includes('/register')) folderName = 'profile_pics';
    else if (req.originalUrl.includes('/messages/send')) folderName = 'chat_media';
    else if (req.originalUrl.includes('/api/posts/create') || req.originalUrl.includes('/api/profile/update')) folderName = 'post_media';
    
    let format = undefined;
    if (file.mimetype.startsWith('audio/')) {
        format = 'webm'; 
    }

    return {
      folder: folderName,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'mp3', 'm4a', 'ogg'],
      format: format,
    };
  }
});

const upload = multer({ storage: storage });

// إعداد Express
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// إعداد الجلسات
const sessionSecret = process.env.SESSION_SECRET || 'super-secret-key';
app.use(session({
    store: new FirebaseStore({
        database: db,
        expire: 60 * 60 * 1000 // 1 ساعة
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } // 1 ساعة
}));


// ---------------- وظيفة حماية المسارات ----------------
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    // يجب توجيه المستخدم لصفحة تسجيل الدخول إذا لم يكن هناك جلسة
    // بما أننا نستخدم API، نرد برمز 401
    if (req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ error: 'Unauthenticated' });
    }
    res.redirect('/login');
}

// ---------------- المسارات الثابتة ----------------

app.use(express.static(path.join(__dirname, 'public')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/chat_list', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'chat_list.html')));
app.get('/chat', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/create-post', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'create_post.html')));
app.get('/profile', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'profile.html'))); // المسار الجديد لصفحة البروفايل


// ---------------- API: Authentication ----------------

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRecord = await firebaseAuth.getUserByEmail(email);
        // في تطبيق حقيقي، يجب التحقق من كلمة المرور عبر Firebase Authentication SDK في الواجهة الأمامية
        // هنا نفترض أن التحقق تم بنجاح وأن userRecord موجود
        
        req.session.userId = userRecord.uid;
        req.session.isLoggedIn = true;
        res.json({ ok: true, userId: userRecord.uid });
        
    } catch (error) {
        console.error("Login failed:", error.message);
        res.status(401).json({ ok: false, error: 'بريد إلكتروني أو كلمة مرور غير صحيحة.' });
    }
});

app.post('/api/register', upload.single('profile_picture'), async (req, res) => {
    const { email, password, username, full_name } = req.body;
    const profile_picture_url = req.file ? req.file.path : null; 
    
    try {
        // إنشاء المستخدم في Firebase Authentication
        const userRecord = await firebaseAuth.createUser({
            email: email,
            password: password,
            displayName: full_name,
            photoURL: profile_picture_url
        });

        // حفظ بيانات البروفايل في Realtime Database
        await db.ref(`profiles/${userRecord.uid}`).set({
            id: userRecord.uid,
            username: username,
            full_name: full_name,
            email: email,
            profile_picture_url: profile_picture_url || 'https://via.placeholder.com/150/000000/FFFFFF?text=A',
            bio: 'مستخدم جديد على Aite.',
            postsCount: 0,
            followersCount: 0,
            followingCount: 0
        });

        req.session.userId = userRecord.uid;
        req.session.isLoggedIn = true;
        res.json({ ok: true, userId: userRecord.uid });

    } catch (error) {
        console.error("Registration failed:", error.message);
        let errorMessage = 'فشل التسجيل. تحقق من البيانات المدخلة.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'هذا البريد الإلكتروني مستخدم بالفعل.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'صيغة البريد الإلكتروني غير صحيحة.';
        }
        res.status(400).json({ ok: false, error: errorMessage });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ ok: false, error: 'فشل تسجيل الخروج.' });
        res.json({ ok: true });
    });
});

// ---------------- API: Users & Profile (المسار المُحسَّن) ----------------

// 1. جلب بيانات الملف الشخصي (مطلوب لـ chat_list.html و profile.html)
// تم تعديل هذا المسار ليتعامل مع جلب بروفايل المستخدم الحالي أو أي مستخدم آخر
app.get('/api/profile', requireAuth, async (req, res) => {
    const currentUserId = req.session.userId;
    const requestedUserId = req.query.userId || currentUserId; // جلب المعرف من الـ query أو استخدام المعرف الحالي

    try {
        const profileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
        const profileData = profileSnap.val();

        if (!profileData) {
            return res.status(404).json({ ok: false, error: 'لم يتم العثور على الملف الشخصي.' });
        }

        const dataToSend = {
            id: requestedUserId,
            username: profileData.username,
            full_name: profileData.full_name,
            profile_picture_url: profileData.profile_picture_url,
            cover_picture_url: profileData.cover_picture_url, // حقل جديد
            bio: profileData.bio, // حقل جديد
            postsCount: profileData.postsCount || 0,
            followersCount: profileData.followersCount || 0,
            followingCount: profileData.followingCount || 0,
            is_owner: requestedUserId === currentUserId // لمعرفة ما إذا كان المستخدم الحالي هو صاحب البروفايل
        };

        res.json({ ok: true, ...dataToSend });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ ok: false, error: 'فشل جلب بيانات الملف الشخصي.' });
    }
});

// 2. تحديث الملف الشخصي (مطلوب لـ profile.html)
app.post('/api/profile/update', requireAuth, upload.fields([
    { name: 'profile_picture', maxCount: 1 },
    { name: 'cover_picture', maxCount: 1 }
]), async (req, res) => {
    const userId = req.session.userId;
    const { bio } = req.body;
    const profile_picture_file = req.files?.profile_picture?.[0];
    const cover_picture_file = req.files?.cover_picture?.[0];

    try {
        // 1. جلب البيانات الحالية
        const profileRef = db.ref(`profiles/${userId}`);
        
        const updateData = {}; 

        // 2. تحديث السيرة الذاتية (Bio)
        if (bio !== undefined) {
             updateData.bio = bio.trim();
        }

        // 3. تحديث صورة البروفايل
        if (profile_picture_file) {
            updateData.profile_picture_url = profile_picture_file.path;
            // تحديث photoURL في Firebase Auth أيضاً
            await firebaseAuth.updateUser(userId, { photoURL: updateData.profile_picture_url });
        }
        
        // 4. تحديث صورة الغلاف (نفترض وجود حقل cover_picture_url في بروفايل Firebase)
        if (cover_picture_file) {
            updateData.cover_picture_url = cover_picture_file.path;
        }
        
        // 5. تطبيق التحديثات على قاعدة البيانات
        if (Object.keys(updateData).length > 0) {
            await profileRef.update(updateData);
        }
        
        res.json({ ok: true, message: 'تم تحديث الملف الشخصي بنجاح.' });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ ok: false, error: error.message || 'فشل في تحديث الملف الشخصي.' });
    }
});

// ---------------- API: Posts (Full Implementation) ----------------

// 3. إنشاء منشور (تم افتراضه من chat_list.html)
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
    const userId = req.session.userId;
    const { content } = req.body;
    const mediaFile = req.file;

    try {
        // جلب بيانات المستخدم
        const userSnap = await db.ref(`profiles/${userId}`).once('value');
        const userData = userSnap.val();

        if (!userData) {
            return res.status(404).json({ ok: false, error: 'User not found.' });
        }
        
        const newPostRef = db.ref('posts').push();
        const postId = newPostRef.key;
        const timestamp = Date.now();
        
        const media = mediaFile ? {
            url: mediaFile.path,
            type: mediaFile.mimetype.startsWith('video/') ? 'video' : mediaFile.mimetype.startsWith('audio/') ? 'audio' : 'image',
            mimetype: mediaFile.mimetype
        } : null;

        const postData = {
            postId: postId,
            userId: userId,
            username: userData.username,
            profile_picture_url: userData.profile_picture_url,
            content: content,
            timestamp: timestamp,
            media: media,
            likes: 0,
            commentsCount: 0
        };

        await newPostRef.set(postData);
        
        // تحديث عداد المنشورات للمستخدم
        await db.ref(`profiles/${userId}/postsCount`).transaction((c) => (c || 0) + 1);

        res.json({ ok: true, post: postData });

    } catch (error) {
        console.error("Post creation failed:", error);
        res.status(500).json({ ok: false, error: 'فشل في إنشاء المنشور.' });
    }
});

// 4. جلب جميع المنشورات (تم افتراضه من chat_list.html)
app.get('/api/posts', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    try {
        const postsSnap = await db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value');

        let posts = [];
        const postIds = [];
        postsSnap.forEach(childSnap => {
            posts.push(childSnap.val());
            postIds.push(childSnap.key);
        });
        posts.reverse(); // الأحدث أولاً
        
        // جلب حالة الإعجاب لكل منشور
        const likedStatuses = {};
        const likePromises = postIds.map(postId => db.ref(`likes/${postId}/${userId}`).once('value'));
        const likeSnapshots = await Promise.all(likePromises);
        
        likeSnapshots.forEach((snap, index) => {
            likedStatuses[postIds[index]] = snap.val() !== null;
        });

        const finalPosts = posts.map(post => ({
            ...post,
            is_liked: likedStatuses[post.postId] || false,
        }));

        res.json({ ok: true, posts: finalPosts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
    }
});

// 5. جلب تعليقات منشور (تم افتراضه من chat_list.html)
app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
  const postId = req.params.postId;
  try {
    const commentsSnap = await db.ref(`comments/${postId}`)
      .orderByChild('timestamp')
      .once('value');

    const comments = [];
    commentsSnap.forEach(childSnap => comments.push(childSnap.val()));

    res.json({ ok: true, comments: comments });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// 6. حذف منشور (تم افتراضه من chat_list.html)
app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  const postRef = db.ref(`posts/${postId}`);
  
  try {
    const postSnapshot = await postRef.once('value');
    const postData = postSnapshot.val();

    if (!postData) return res.status(404).json({ ok: false, error: 'Post not found' });
    if (postData.userId !== userId) return res.status(403).json({ ok: false, error: 'Forbidden' });

    await postRef.remove();
    await db.ref(`profiles/${userId}/postsCount`).transaction((c) => (c || 0) > 0 ? c - 1 : 0);

    // حذف الإعجابات والتعليقات المرتبطة
    await db.ref(`likes/${postId}`).remove();
    await db.ref(`comments/${postId}`).remove();

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ ok: false, error: 'فشل في حذف المنشور.' });
  }
});

// 7. جلب منشورات مستخدم معين (مطلوب لـ profile.html)
app.get('/api/posts/user/:userId', requireAuth, async (req, res) => {
    const requestedUserId = req.params.userId;
    const currentUserId = req.session.userId;

    try {
        // جلب المنشورات الخاصة بهذا المستخدم فقط
        const postsSnap = await db.ref('posts')
          .orderByChild('userId')
          .equalTo(requestedUserId)
          .limitToLast(50) // حد أقصى 50 منشور
          .once('value');

        let posts = [];
        const postIds = [];
        postsSnap.forEach(childSnap => {
            posts.push(childSnap.val());
            postIds.push(childSnap.key);
        });
        posts.reverse(); // الأحدث أولاً
        
        // التحقق من الإعجابات (لتحديد ما إذا كان المستخدم الحالي قد أعجب بالمنشور)
        const likedStatuses = {};
        if (postIds.length > 0) {
            const likePromises = postIds.map(postId => db.ref(`likes/${postId}/${currentUserId}`).once('value'));
            const likeSnapshots = await Promise.all(likePromises);
            
            likeSnapshots.forEach((snap, index) => {
                likedStatuses[postIds[index]] = snap.val() !== null;
            });
        }


        const finalPosts = posts.map(post => ({
            ...post,
            is_liked: likedStatuses[post.postId] || false,
        }));

        res.json({ ok: true, posts: finalPosts });

    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب منشورات المستخدم.' });
    }
});


// 8. مسار الإعجاب/إلغاء الإعجاب
app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const postId = req.params.postId;
    const likeRef = db.ref(`likes/${postId}/${userId}`);
    const postRef = db.ref(`posts/${postId}`);

    try {
        const likeSnap = await likeRef.once('value');
        const isLiked = likeSnap.val() !== null;

        if (isLiked) {
            // إلغاء الإعجاب
            await likeRef.remove();
            await postRef.child('likes').transaction(currentLikes => (currentLikes || 0) > 0 ? currentLikes - 1 : 0);
            res.json({ ok: true, action: 'unliked', newCount: (await postRef.child('likes').once('value')).val() });
        } else {
            // إعجاب
            await likeRef.set(true);
            await postRef.child('likes').transaction(currentLikes => (currentLikes || 0) + 1);
            res.json({ ok: true, action: 'liked', newCount: (await postRef.child('likes').once('value')).val() });
        }

    } catch (error) {
        console.error("Like action failed:", error);
        res.status(500).json({ ok: false, error: 'فشل في تنفيذ عملية الإعجاب.' });
    }
});


// ---------------- بدء تشغيل الخادم ----------------

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Firebase project URL: ${process.env.FIREBASE_DATABASE_URL}`);
});
