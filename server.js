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
      totalReactions: 0, 
      reactions: {},     
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

// نقطة النهاية الجديدة لمعالجة التفاعلات (أحببته، أدعمه، ممل، حكيم)
app.post('/api/posts/:postId/react', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const userId = req.session.userId;
    // reactionType يمكن أن تكون 'love', 'support', 'boring', 'wise' أو null للإزالة
    const { reactionType } = req.body; 

    if (!postId || !userId) {
        return res.status(400).json({ ok: false, error: 'Post ID and user ID are required.' });
    }

    // مسارات الوصول إلى البيانات
    const postRef = db.ref(`posts/${postId}`);
    const reactionsRef = db.ref(`reactions/${postId}/${userId}`); // لتخزين نوع تفاعل المستخدم
    const postReactionsCountsRef = db.ref(`posts/${postId}/reactions`); // لعدادات التفاعلات الكلية في المنشور
    const postTotalReactionsRef = db.ref(`posts/${postId}/totalReactions`); // للعدد الكلي للتفاعلات

    const allowedReactions = ['love', 'support', 'boring', 'wise'];

    if (reactionType !== null && !allowedReactions.includes(reactionType)) {
        return res.status(400).json({ ok: false, error: 'نوع التفاعل غير صالح.' });
    }

    try {
        const postExists = (await postRef.once('value')).exists();
        if (!postExists) {
             return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
        }

        let action = 'no_change';
        
        // 1. جلب تفاعل المستخدم الحالي
        const currentReactionSnapshot = await reactionsRef.once('value');
        const currentReactionData = currentReactionSnapshot.val();
        const currentReactionType = currentReactionData ? currentReactionData.type : null;

        // 2. تحديد الإجراء المطلوب (إزالة، إضافة، تغيير)
        let shouldRemove = false;
        let shouldAdd = false;
        let finalReactionType = null;
        
        if (reactionType === null) {
            // المستخدم يريد الإزالة صراحة (مثل عند النقر على تفاعله مرة أخرى)
            if (currentReactionType) {
                shouldRemove = true;
                action = 'removed';
            }
        } else if (reactionType === currentReactionType) {
            // منطق الواجهة الأمامية يجب أن يمنع هذا، ولكن كحماية للخلفية، لا نغير شيئًا.
            finalReactionType = currentReactionType;
            action = 'no_change';
        } else {
            // المستخدم يريد إضافة تفاعل جديد (أو تغيير تفاعل موجود)
            shouldAdd = true;
            finalReactionType = reactionType;
            if (currentReactionType) {
                shouldRemove = true; // يجب إزالة القديم أولاً
                action = 'changed';
            } else {
                action = 'added';
            }
        }

        // 3. تنفيذ الإجراءات باستخدام المعاملات (لضمان الدقة في العدادات)

        // *أ. إزالة التفاعل القديم (إذا وجد)*
        if (shouldRemove && currentReactionType) {
            // إنقاص العداد القديم باستخدام المعاملة (بأمان)
            await db.ref(`posts/${postId}/reactions/${currentReactionType}`).transaction(count => Math.max(0, (count || 1) - 1));
            // إزالة سجل تفاعل المستخدم
            await reactionsRef.remove();
        }

        // *ب. إضافة التفاعل الجديد (إذا طلب)*
        if (shouldAdd && reactionType) {
            // زيادة العداد الجديد باستخدام المعاملة (بأمان)
            await db.ref(`posts/${postId}/reactions/${reactionType}`).transaction(count => (count || 0) + 1);
            // حفظ سجل تفاعل المستخدم
            await reactionsRef.set({ type: reactionType, timestamp: admin.database.ServerValue.TIMESTAMP });
        }

        // 4. تحديث TotalReactions في المنشور
        let totalCount = 0;
        let allCounts = {};
        
        // جلب العدادات الجديدة بعد التحديثات المنفصلة
        const finalCountsSnap = await postReactionsCountsRef.once('value');
        allCounts = finalCountsSnap.val() || {};
        // حساب المجموع الكلي
        totalCount = Object.values(allCounts).reduce((sum, count) => sum + count, 0);

        // حفظ الإجمالي في المنشور
        await postTotalReactionsRef.set(totalCount);
        
        
        return res.json({ 
            ok: true, 
            action: action, 
            reaction: finalReactionType,
            newReactionsCount: totalCount,
            allReactionCounts: allCounts
        });

    } catch (error) {
        console.error('Reaction error:', error.message);
        res.status(500).json({ ok: false, error: 'فشل في معالجة التفاعل.' });
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

// نقطة وصول لحذف المنشور
app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  try {
    const postRef = db.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once('value');
    const postData = postSnapshot.val();

    if (!postSnapshot.exists()) {
      return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
    }

    if (postData.userId !== userId) {
      return res.status(403).json({ ok: false, error: 'غير مصرح لك بحذف هذا المنشور.' });
    }

    // 1. حذف المنشور
    await postRef.remove();
    // 2. حذف التعليقات والتفاعلات المرتبطة (اختياري، لضمان النظافة)
    await db.ref(`comments/${postId}`).remove();
    await db.ref(`reactions/${postId}`).remove(); // حذف التفاعلات

    // 3. تحديث عداد المنشورات للمستخدم (اختياري)
    const userPostsCountRef = db.ref(`profiles/${userId}/postsCount`);
    await userPostsCountRef.transaction((currentCount) => {
      return Math.max(0, (currentCount || 1) - 1);
    });

    res.json({ ok: true, message: 'تم حذف المنشور بنجاح.' });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ ok: false, error: 'فشل في حذف المنشور على الخادم.' });
  }
});

// نقطة وصول لجلب المنشورات الأخيرة (MODIFIED to handle reactions)
app.get('/api/posts', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId; 

  try {
    // 1. جلب المنشورات
    const postsSnap = await db.ref('posts')
      .orderByChild('timestamp')
      .limitToLast(50)
      .once('value');

    let posts = [];
    postsSnap.forEach(childSnap => {
      posts.push(childSnap.val());
    });
    posts.reverse(); // لعرض الأحدث أولاً

    // 2. تجميع معرفات المستخدمين
    const userIds = [...new Set(posts.map(p => p.userId))];
    const profiles = {};
    const defaultProfileUrl = 'https://via.placeholder.com/40/000000/FFFFFF?text=A';

    // 3. جلب ملفات المستخدمين
    const profilePromises = userIds.map(userId => 
      db.ref(`profiles/${userId}`).once('value').then(snap => {
        profiles[userId] = snap.val();
      })
    );
    await Promise.all(profilePromises);

    // 4. جلب جميع التفاعلات من قاعدة البيانات
    const reactionsSnap = await db.ref('reactions').once('value');
    const allReactions = reactionsSnap.val() || {}; 

    // 5. بناء مصفوفة المنشورات النهائية مع بيانات التفاعل وملف المستخدم
    const postsArray = [];
    posts.forEach(post => {
        // جلب تفاعل المستخدم الحالي
        const userReactionData = allReactions[post.postId] && allReactions[post.postId][currentUserId] 
                                ? allReactions[post.postId][currentUserId] 
                                : null;
        
        // إضافة بيانات التفاعل إلى المنشور
        post.userReaction = userReactionData ? userReactionData.type : null;
        post.reactionsCount = post.totalReactions || 0; // العدد الإجمالي للتفاعلات
        post.allReactionCounts = post.reactions || {}; // أعداد كل نوع تفاعل
        
        // إزالة الخصائص القديمة (likes و is_liked)
        delete post.is_liked; 
        delete post.likes;

        // إضافة بيانات المستخدم إلى المنشور
        const userProfile = profiles[post.userId] || { username: 'مستخدم محذوف', profile_picture_url: defaultProfileUrl };
        post.user = {
            id: post.userId,
            username: userProfile.username,
            profile_picture_url: userProfile.profile_picture_url,
        };

        postsArray.push(post);
    });

    res.json({ ok: true, posts: postsArray });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
  }
});


// ---------------- API: Users & Profile ----------------

// نقطة وصول لجلب ملف المستخدم الحالي
app.get('/api/profile', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    const profileSnap = await db.ref('profiles/' + userId).once('value');
    const profile = profileSnap.val();
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// نقطة وصول لجلب جميع المستخدمين (لصفحة users_list)
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const usersSnap = await db.ref('profiles').once('value');
        const users = [];
        usersSnap.forEach(childSnap => {
            const user = childSnap.val();
            // تصفية المعلومات الحساسة قبل الإرسال
            users.push({
                id: user.id,
                username: user.username,
                profile_picture_url: user.profile_picture_url,
                bio: user.bio,
                is_online: user.is_online,
            });
        });
        res.json({ ok: true, users: users });
    } catch (error) {
        console.error('Error fetching users list:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب قائمة المستخدمين.' });
    }
});


// ---------------- Debug/Info Routes ----------------

app.get('/api/debug/info', requireAuth, (req, res) => {
  res.json({
    ok: true,
    message: 'Debug info for authenticated user.',
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
    // أخطاء أخرى غير متوقعة
    console.error('Unknown error:', err);
    return res.status(500).json({ ok: false, error: 'حدث خطأ غير متوقع على الخادم.' });
  }
  next();
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
