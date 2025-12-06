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
const DEFAULT_PROFILE_PIC_URL = 'https://res.cloudinary.com/duixjs8az/image/upload/v1765009560/post_media/1765009560909-default_profile.png';
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
    if (req.originalUrl.includes('/register') || file.fieldname === 'profile_picture') folderName = 'profile_pics';
    else if (req.originalUrl.includes('/messages/send')) folderName = 'chat_media';
    else if (req.originalUrl.includes('/api/posts/create')) folderName = 'post_media';
    else if (file.fieldname === 'cover_photo') folderName = 'cover_photos'; // مجلد جديد لصور الغلاف
    
    let format = undefined;
    if (file.mimetype.startsWith('audio/')) {
        format = 'webm'; 
    }

    return {
      folder: folderName,
      public_id: Date.now() + '-' + path.parse(file.originalname).name,
      resource_type: 'auto',
      format: format
    };
  },
});

const upload = multer({ storage: storage });

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

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
app.use(express.static('views'));
// ---------------- Middleware ----------------
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
  secret: 'a-firebase-secret-key-is-better',
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

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User session not found or expired.' });
  }
  return res.redirect('/login');
}

// ---------------- Routes: Pages ----------------
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'splash.html')); });

app.get('/check-status', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/chat_list');
  } else {
    res.redirect('/login');
  }
});

app.get('/chat_list', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat_list.html')); });
app.get('/users_list', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'users_list.html')); });
app.get('/chat', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat.html')); });
app.get('/chat.html', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'chat.html')); });
app.get('/profile', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'profile.html')); });
// **تمت الإضافة: مسار صفحة التعديل**
app.get('/edit_profile', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'edit_profile.html')); });
app.get('/create-post', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'views', 'create_post.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'login.html')); });
app.get('/register', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'register.html')); });

// ---------------- Routes: Auth Logic ----------------
app.post('/login', async (req, res) => {
  const { username } = req.body;
  try {
    if (!username) throw new Error('Username required');
    const email = `${username}@trimer.io`;
    const userRecord = await firebaseAuth.getUserByEmail(email);
    req.session.userId = userRecord.uid;
    req.session.email = userRecord.email;
    await req.session.save();
    res.redirect('/chat_list');
  } catch (error) {
    res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
  }
});

app.post('/register', upload.single('profile_picture'), async (req, res) => {
  const { username, password } = req.body;
  let profile_picture_url = 'https://via.placeholder.com/150';

  try {
    if (!username || !password) {
        return res.redirect('/register?error=' + encodeURIComponent('Required fields missing.'));
    }
    const email = `${username}@trimer.io`;
    if (req.file) profile_picture_url = req.file.path;

    const userRecord = await firebaseAuth.createUser({
      email: email, password: password, displayName: username, photoURL: profile_picture_url
    });

    const profileData = {
      id: userRecord.uid, username: username, full_name: username, email: email,
      profile_picture_url: profile_picture_url, is_online: false, is_verified: false, bio: '', 
    };
    await db.ref('profiles/' + userRecord.uid).set(profileData);

    req.session.userId = userRecord.uid;
    req.session.email = email;
    await req.session.save();
    res.redirect('/chat_list');
  } catch (error) {
    res.redirect('/register?error=' + encodeURIComponent(error.message));
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// ---------------- API: Chat & Messages ----------------

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
      contact_profile: profiles[chat.contact_id] || { username: 'مستخدم', profile_picture_url: 'https://via.placeholder.com/40' }
    }));

    finalChats.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp);
    res.json({ ok: true, chats: finalChats });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'فشل في جلب المحادثات.' });
  }
});

app.get('/api/messages/:contactId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const contactId = req.params.contactId;
  const { limit = 50 } = req.query;

  if (!contactId) return res.status(400).json({ ok: false, error: 'Contact ID missing' });

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
    
    // إرسال الرسائل بالترتيب الزمني (الأقدم -> الأحدث)
    res.json({ ok: true, messages: messages }); 

  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error fetching messages.' });
  }
});

app.post('/api/messages/send', requireAuth, upload.single('media'), async (req, res) => {
    const senderId = req.session.userId;
    const contactId = req.body.other_id; 
    const { content, replied_to_id, replied_to_content, replied_to_sender } = req.body;
    
    const timestamp = admin.database.ServerValue.TIMESTAMP;
    let mediaUrl = null;
    let mediaType = null;

    if (!contactId || (!content && !req.file)) { 
      return res.status(400).json({ ok: false, error: 'No content to send.' });
    }
    
    if (req.file) {
      mediaUrl = req.file.path;
      if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
      else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
      else if (req.file.mimetype.startsWith('audio/') || req.file.originalname.endsWith('.webm')) mediaType = 'audio';
      else mediaType = 'raw';
    }

    try {
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
            replied_to_id: replied_to_id || null,
            replied_to_content: replied_to_content || null,
            replied_to_sender: replied_to_sender || null
        };

        await messagesRef.set(messageData);

        let previewText = content || (mediaType ? `[${mediaType}]` : 'ملف');

        // تحديث ملخص الدردشة للمرسل إليه (زيادة عداد غير المقروء)
        await db.ref(`chats/${contactId}/${senderId}`).update({
            last_message_content: previewText,
            last_message_timestamp: timestamp,
            contact_id: senderId, 
            unread_count: admin.database.ServerValue.increment(1),
            last_message_sender_id: senderId // ✅ ضروري لتحديد من أرسل آخر رسالة
        });

        // تحديث ملخص الدردشة للمرسل (العداد يبقى 0)
        await db.ref(`chats/${senderId}/${contactId}`).update({
            last_message_content: previewText,
            last_message_timestamp: timestamp,
            contact_id: contactId,
            unread_count: 0, 
            last_message_sender_id: senderId // ✅ ضروري لتحديد من أرسل آخر رسالة
        });
        
        messageData.timestamp = Date.now(); 
        res.json({ ok: true, message: 'Sent', messageData: messageData });

    } catch (error) {
        res.status(500).json({ ok: false, error: 'Failed to send.' });
    }
});

app.post('/api/mark_read', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { other_id } = req.body; 

    if (!other_id) return res.status(400).json({ ok: false });

    const chatRoomId = [userId, other_id].sort().join('_');
    const messagesRef = db.ref(`messages/${chatRoomId}`);

    try {
        // 1. تحديد الرسائل غير المقروءة التي أرسلها الطرف الآخر
        const messagesSnap = await messagesRef.orderByChild('senderId').equalTo(other_id).once('value');
        const updates = {};
        messagesSnap.forEach(childSnap => {
            if (childSnap.val().is_read === false) updates[`${childSnap.key}/is_read`] = true;
        });
        
        // 2. تحديث الرسائل في قاعدة البيانات
        if (Object.keys(updates).length > 0) await messagesRef.update(updates);
        
        // 3. تصفير عداد الرسائل غير المقروءة في ملخص الدردشة للمستخدم الحالي
        await db.ref(`chats/${userId}/${other_id}`).update({ unread_count: 0 });

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false });
    }
});

// ---------------- API: Users & Profile ----------------
app.get('/api/users', requireAuth, async (req, res) => {
    const currentUserId = req.session.userId;
    try {
        // 1. جلب جميع المستخدمين
        const profilesSnap = await db.ref('profiles').once('value');
        const profiles = profilesSnap.val() || {};
        const allUsers = Object.values(profiles).filter(user => user.id !== currentUserId);
        
        // 2. جلب جميع ملخصات المحادثات للمستخدم الحالي (استعلام واحد سريع)
        const allChatsSnap = await db.ref(`chats/${currentUserId}`).once('value');
        const allChats = allChatsSnap.val() || {};
        
        // 3. دمج بيانات المستخدم مع ملخص المحادثة (بدون استعلامات إضافية مكلفة)
        const usersList = allUsers.map((user) => {
            const contactId = user.id;
            const chatSummary = allChats[contactId] || {};
            
            // بناء كائن الرسالة الأخيرة من بيانات ملخص الدردشة
            let lastMessage = null;
            if (chatSummary.last_message_content) {
                lastMessage = {
                    content: chatSummary.last_message_content,
                    timestamp: chatSummary.last_message_timestamp,
                    senderId: chatSummary.last_message_sender_id // نعتمد على هذا الحقل
                };
            }

            return {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                profile_picture_url: user.profile_picture_url || 'https://via.placeholder.com/40',
                
                last_message: lastMessage,
                unread_count: chatSummary.unread_count || 0
            };
        });

        res.json({ ok: true, users: usersList });
        
    } catch (error) {
        console.error('CRITICAL ERROR in /api/users (Optimized):', error); 
        res.status(500).json({ ok: false, error: 'فشل في جلب قائمة المستخدمين. (راجع سجلات الخادم)' });
    }
});
// -------------------------------------------------------------------------

app.get('/api/profile', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const requestedUserId = req.query.userId || currentUserId; 
  try {
    const profileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
    const profileData = profileSnap.val();
    if (!profileData) return res.status(404).json({ ok: false });
    res.json({ ok: true, ...profileData, is_owner: requestedUserId === currentUserId });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/profile/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    try {
        const profileSnap = await db.ref('profiles').child(userId).once('value');
        const profile = profileSnap.val();
        if (!profile) return res.status(404).json({ ok: false });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ ok: false });
    }
});

// **المسار الجديد لتعديل الملف الشخصي (PUT /api/profile/edit)**
const uploadProfileFields = upload.fields([
    { name: 'profile_picture', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 }
]);

app.put('/api/profile/edit', requireAuth, uploadProfileFields, async (req, res) => {
    const userId = req.session.userId;
    const { full_name, username, bio } = req.body;
    
    if (!username || !full_name) {
        return res.status(400).json({ ok: false, error: 'اسم المستخدم والاسم الكامل مطلوبان.' });
    }

    const updates = {
        full_name: full_name,
        bio: bio,
        username: username,
    };

    try {
        // 1. التحقق من تغيير اسم المستخدم (Username Uniqueness Check)
        const currentProfileSnap = await db.ref(`profiles/${userId}`).once('value');
        const currentUsername = currentProfileSnap.val().username;

        if (username !== currentUsername) {
            // تحقق مما إذا كان اسم المستخدم الجديد مأخوذًا بالفعل
            const existingUsernameSnap = await db.ref('profiles')
                .orderByChild('username')
                .equalTo(username)
                .once('value');

            let isUsernameTaken = false;
            existingUsernameSnap.forEach(snap => {
                if (snap.key !== userId) {
                    isUsernameTaken = true;
                }
            });

            if (isUsernameTaken) {
                return res.status(409).json({ ok: false, error: 'اسم المستخدم هذا مأخوذ بالفعل.' });
            }
            
            // تحديث اسم العرض (displayName) والبريد الإلكتروني في Firebase Auth
            const newEmail = `${username}@trimer.io`;
            await firebaseAuth.updateUser(userId, {
                displayName: username,
                email: newEmail
            });
            updates.email = newEmail;
        }

        // 2. معالجة تحميل الصور (Cloudinary URLs)
        if (req.files && req.files.profile_picture) {
            updates.profile_picture_url = req.files.profile_picture[0].path;
        }
        if (req.files && req.files.cover_photo) {
            updates.cover_photo_url = req.files.cover_photo[0].path;
        }

        // 3. تحديث البيانات في قاعدة البيانات
        await db.ref(`profiles/${userId}`).update(updates);

        res.json({ ok: true, message: 'تم تحديث الملف الشخصي بنجاح.' });

    } catch (error) {
        console.error('Error updating profile:', error);
        // التعامل مع أخطاء Firebase Auth (مثل اسم مستخدم/بريد إلكتروني غير صالح)
        if (error.code === 'auth/invalid-email' || error.code === 'auth/email-already-in-use' || error.message.includes('A user with the provided email already exists')) {
             return res.status(409).json({ ok: false, error: 'اسم المستخدم غير صالح أو مأخوذ.' });
        }
        res.status(500).json({ ok: false, error: 'فشل في تحديث الملف الشخصي.' });
    }
});
// -------------------------------------------------------------------------

// ---------------- API: Posts (Full Implementation) ----------------

// 1. إنشاء منشور جديد
app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
  const userId = req.session.userId;
  const content = req.body.content ? req.body.content.trim() : '';
  let mediaUrl = null;
  let mediaType = null;

  if (content.length === 0 && !req.file) {
    return res.status(400).json({ ok: false, error: 'المحتوى مطلوب.' });
  }

  if (req.file) {
    mediaUrl = req.file.path; 
    const mimeType = req.file.mimetype;
    if (mimeType && mimeType.startsWith('image/')) mediaType = 'image';
    else if (mimeType && mimeType.startsWith('video/')) mediaType = 'video';
    else if (mimeType && mimeType.startsWith('audio/')) mediaType = 'audio';
    else mediaType = 'raw';
  }

  try {
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
      media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
    };

    await newPostRef.set(postData);

    const userPostsCountRef = db.ref(`profiles/${userId}/postsCount`);
    await userPostsCountRef.transaction((currentCount) => (currentCount || 0) + 1);

    res.json({ ok: true, message: 'تم النشر', postId: postId });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ ok: false, error: 'فشل في إنشاء المنشور.' });
  }
});

// 2. جلب المنشورات (الرئيسية)
app.get('/api/posts', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  try {
    const postsSnap = await db.ref('posts')
      .orderByChild('timestamp')
      .limitToLast(50)
      .once('value');

    let posts = [];
    postsSnap.forEach(childSnap => {
      posts.push(childSnap.val());
    });
    posts.reverse(); // الأحدث أولاً

    const userIds = [...new Set(posts.map(p => p.userId))];
    const profiles = {};
    const defaultProfileUrl = 'https://via.placeholder.com/40';

    const profilePromises = userIds.map(userId => db.ref(`profiles/${userId}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
        profiles[userIds[index]] = snap.val();
    });
    
    // التحقق من الإعجابات
    const likedStatuses = {};
    const likePromises = posts.map(post => db.ref(`likes/${post.postId}/${currentUserId}`).once('value'));
    const likeSnapshots = await Promise.all(likePromises);
    
    likeSnapshots.forEach((snap, index) => {
        likedStatuses[posts[index].postId] = snap.val() !== null;
    });

    const finalPosts = posts.map(post => ({
      ...post,
      is_liked: likedStatuses[post.postId] || false,
      user: {
        username: profiles[post.userId]?.username || 'مستخدم',
        profile_picture_url: profiles[post.userId]?.profile_picture_url || defaultProfileUrl
      }
    }));

    res.json({ ok: true, posts: finalPosts });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
  }
});

// 3. الإعجاب بمنشور
app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  if (!postId) return res.status(400).json({ ok: false });

  const postRef = db.ref(`posts/${postId}`);
  const userLikeRef = db.ref(`likes/${postId}/${userId}`);

  try {
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) return res.status(404).json({ ok: false });

    const likeSnapshot = await userLikeRef.once('value');
    const isLiked = likeSnapshot.val();
    let likesUpdate = 0;
    let action = '';
    
    if (isLiked) {
      await userLikeRef.remove();
      likesUpdate = -1;
      action = 'unliked';
    } else {
      await userLikeRef.set(admin.database.ServerValue.TIMESTAMP);
      likesUpdate = 1;
      action = 'liked';
    }

    let newLikesCount = 0;
    await postRef.child('likes').transaction((currentCount) => {
      newLikesCount = (currentCount || 0) + likesUpdate;
      return newLikesCount < 0 ? 0 : newLikesCount;
    });

    res.json({ ok: true, action: action, newLikes: newLikesCount });

  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// 4. التعليق على منشور
app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;
  const { content } = req.body;

  if (!postId || !content) return res.status(400).json({ ok: false });

  try {
    const postRef = db.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) return res.status(404).json({ ok: false });
    
    const userSnapshot = await db.ref(`profiles/${userId}`).once('value');
    const userData = userSnapshot.val();

    const newCommentRef = db.ref(`comments/${postId}`).push();
    const commentData = {
      commentId: newCommentRef.key,
      postId: postId,
      userId: userId,
      content: content.trim(),
      timestamp: admin.database.ServerValue.TIMESTAMP,
      user: {
        username: userData.username || 'مستخدم',
        profile_picture_url: userData.profile_picture_url || 'https://via.placeholder.com/40'
      }
    };

    await newCommentRef.set(commentData);

    let newCommentsCount = 0;
    await postRef.child('commentsCount').transaction((currentCount) => {
      newCommentsCount = (currentCount || 0) + 1;
      return newCommentsCount;
    });

    res.json({ ok: true, comment: commentData, newComments: newCommentsCount });

  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// 5. جلب تعليقات منشور
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

// 6. حذف منشور
app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  const postRef = db.ref(`posts/${postId}`);
  
  try {
    const postSnapshot = await postRef.once('value');
    const postData = postSnapshot.val();

    if (!postData) return res.status(404).json({ ok: false });
    if (postData.userId !== userId) return res.status(403).json({ ok: false });

    await postRef.remove();
    await db.ref(`profiles/${userId}/postsCount`).transaction((c) => (c || 0) > 0 ? c - 1 : 0);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});
app.get('/api/posts', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
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
    const defaultProfileUrl = DEFAULT_PROFILE_PIC_URL;

    const profilePromises = userIds.map(userId => db.ref(`profiles/${userId}`).once('value'));
    const profileSnapshots = await Promise.all(profilePromises);

    profileSnapshots.forEach((snap, index) => {
        profiles[userIds[index]] = snap.val();
    });
    
    const likedStatuses = {};
    const likePromises = posts.map(post => db.ref(`likes/${post.postId}/${currentUserId}`).once('value'));
    const likeSnapshots = await Promise.all(likePromises);
    
    likeSnapshots.forEach((snap, index) => {
        likedStatuses[posts[index].postId] = snap.val() !== null;
    });

    const finalPosts = posts.map(post => ({
      ...post,
      is_liked: likedStatuses[post.postId] || false,
      user: {
        username: profiles[post.userId]?.username || 'مستخدم',
        profile_picture_url: profiles[post.userId]?.profile_picture_url || defaultProfileUrl
      }
    }));

    res.json({ ok: true, posts: finalPosts });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ ok: false, error: 'فشل في جلب المنشورات.' });
  }
});

app.get('/api/posts/user/:userId', requireAuth, async (req, res) => {
    const currentUserId = req.session.userId;
    const requestedUserId = req.params.userId;
    
    try {
        const postsSnap = await db.ref('posts')
            .orderByChild('userId')
            .equalTo(requestedUserId)
            .once('value');
            
        let posts = [];
        postsSnap.forEach(childSnap => {
            posts.push(childSnap.val());
        });
        posts.reverse(); 
        
        const userProfileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
        const userProfile = userProfileSnap.val();
        
        if (!userProfile) {
            return res.status(404).json({ ok: false, error: 'User profile not found.' });
        }
        
        const likedStatuses = {};
        const likePromises = posts.map(post => db.ref(`likes/${post.postId}/${currentUserId}`).once('value'));
        const likeSnapshots = await Promise.all(likePromises);
        
        likeSnapshots.forEach((snap, index) => {
            likedStatuses[posts[index].postId] = snap.val() !== null;
        });
        
        const defaultProfileUrl = DEFAULT_PROFILE_PIC_URL; 

        const finalPosts = posts.map(post => ({
            ...post,
            is_liked: likedStatuses[post.postId] || false,
            user: {
                username: userProfile?.username || 'مستخدم',
                profile_picture_url: userProfile?.profile_picture_url || defaultProfileUrl
            }
        }));

        res.json({ ok: true, posts: finalPosts });
        
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ ok: false, error: 'فشل في جلب منشورات المستخدم.' });
    }
});

app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  if (!postId) return res.status(400).json({ ok: false });

  const postRef = db.ref(`posts/${postId}`);
  const userLikeRef = db.ref(`likes/${postId}/${userId}`);

  try {
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) return res.status(404).json({ ok: false });

    const likeSnapshot = await userLikeRef.once('value');
    const isLiked = likeSnapshot.val();
    let likesUpdate = 0;
    let action = '';
    
    if (isLiked) {
      await userLikeRef.remove();
      likesUpdate = -1;
      action = 'unliked';
    } else {
      await userLikeRef.set(admin.database.ServerValue.TIMESTAMP);
      likesUpdate = 1;
      action = 'liked';
    }

    let newLikesCount = 0;
    await postRef.child('likes').transaction((currentCount) => {
      newLikesCount = (currentCount || 0) + likesUpdate;
      return newLikesCount < 0 ? 0 : newLikesCount;
    });

    res.json({ ok: true, action: action, newLikes: newLikesCount });

  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;
  const { content } = req.body;

  if (!postId || !content) return res.status(400).json({ ok: false });

  try {
    const postRef = db.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once('value');
    if (!postSnapshot.exists()) return res.status(404).json({ ok: false });
    
    const userSnapshot = await db.ref(`profiles/${userId}`).once('value');
    const userData = userSnapshot.val();

    const newCommentRef = db.ref(`comments/${postId}`).push();
    const commentData = {
      commentId: newCommentRef.key,
      postId: postId,
      userId: userId,
      content: content.trim(),
      timestamp: admin.database.ServerValue.TIMESTAMP,
      user: {
        username: userData.username || 'مستخدم',
        profile_picture_url: userData.profile_picture_url || DEFAULT_PROFILE_PIC_URL
      }
    };

    await newCommentRef.set(commentData);

    let newCommentsCount = 0;
    await postRef.child('commentsCount').transaction((currentCount) => {
      newCommentsCount = (currentCount || 0) + 1;
      return newCommentsCount;
    });

    res.json({ ok: true, comment: commentData, newComments: newCommentsCount });

  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

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

app.delete('/api/posts/:postId', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const postId = req.params.postId;

  const postRef = db.ref(`posts/${postId}`);
  
  try {
    const postSnapshot = await postRef.once('value');
    const postData = postSnapshot.val();

    if (!postData) return res.status(404).json({ ok: false });
    if (postData.userId !== userId) return res.status(403).json({ ok: false });

    await postRef.remove();
    await db.ref(`profiles/${userId}/postsCount`).transaction((c) => (c || 0) > 0 ? c - 1 : 0);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});
// ---------------- Error Handling ----------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(413).json({ ok: false, error: err.message });
  next(err);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
