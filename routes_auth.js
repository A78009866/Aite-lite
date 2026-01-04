// routes_auth.js
const path = require('path');
const fetch = require('node-fetch'); // تأكد من تثبيته npm i node-fetch@2

module.exports = function(app, db, firebaseAuth, admin, upload, shared) {
  const { requireAuth, requireAdmin, clientWantsJson, DEFAULT_PROFILE_PIC_URL } = shared;

  // --- HTML Pages Routes ---
  app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'splash.html')); });

  app.get('/check-status', (req, res) => {
    if (req.session && req.session.userId) res.redirect('/chat_list');
    else res.redirect('/accounts');
  });

  app.get('/accounts', (req, res) => res.sendFile(path.join(__dirname, 'views', 'accounts.html')));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
  app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));

  // Protected Views
  const protectedPages = [
    'chat_list', 'users_list', 'all_users', 'chat', 'chat.html',
    'edit_profile', 'create_post', 'reels', 'create_reel', 'notifications',
    'families', 'create_family', 'search', 'post.html'
  ];

  protectedPages.forEach(page => {
    const route = page.includes('.') ? `/${page}` : `/${page}`;
    const view = page.includes('.') ? page : `${page}.html`;
    app.get(route, requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', view)));
  });

  app.get('/profile/:userId?', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'profile.html')));
  app.get('/family/:familyId', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'family.html')));
  app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'views', 'settings.html')));
  app.get('/admin', requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
  
  // Support redirect for /post without html extension
  app.get('/post', requireAuth, (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(`/post.html${qs}`);
  });

  // --- Auth Logic ---

  app.post('/login', async (req, res) => {
    const { username } = req.body;
    const wantsJson = clientWantsJson(req);

    try {
      if (!username) throw new Error('اسم المستخدم مطلوب');
      const email = `${username}@trimer.io`;
      const userRecord = await firebaseAuth.getUserByEmail(email);
      req.session.userId = userRecord.uid;
      req.session.email = userRecord.email;
      await req.session.save();
      
      await db.ref(`profiles/${userRecord.uid}`).update({
        is_online: true,
        last_seen: admin.database.ServerValue.TIMESTAMP
      });

      if (wantsJson) {
        const profileSnap = await db.ref(`profiles/${userRecord.uid}`).once('value');
        const profile = profileSnap.val() || {};
        return res.json({
          ok: true, redirect: '/chat_list',
          username: profile.username || username,
          full_name: profile.full_name || username,
          profile_picture_url: profile.profile_picture_url || DEFAULT_PROFILE_PIC_URL
        });
      }
      res.redirect('/chat_list');
    } catch (error) {
      const msg = (error && error.message) ? error.message : 'Invalid username or password.';
      if (wantsJson) return res.status(403).json({ ok: false, error: msg });
      res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
    }
  });

  app.post('/register', upload.fields([{ name: 'profile_picture' }, { name: 'cover_photo' }]), async (req, res) => {
    const wantsJson = clientWantsJson(req);
    const { username, password, full_name } = req.body;
    let profile_picture_url = DEFAULT_PROFILE_PIC_URL;
    let cover_photo_url = '';

    try {
      if (!username || String(username).trim().length === 0) throw new Error('اسم المستخدم مطلوب.');
      if (/\s/.test(username)) throw new Error('لا يجب أن يحتوي اسم المستخدم على مسافات.');
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) throw new Error('اسم المستخدم يجب أن يتكون من أحرف وأرقام ونقاط أو _ أو - وطوله بين 3 و 32.');
      if (!password || password.length < 6) throw new Error('كلمة المرور قصيرة؛ يجب أن تكون 6 أحرف على الأقل.');

      const email = `${username}@trimer.io`;
      if (req.files) {
        if (req.files.profile_picture) profile_picture_url = req.files.profile_picture[0].path;
        if (req.files.cover_photo) cover_photo_url = req.files.cover_photo[0].path;
      }

      const userRecord = await firebaseAuth.createUser({ email, password, displayName: username, photoURL: profile_picture_url });

      const profileData = {
        id: userRecord.uid, username, full_name: full_name || username, email,
        profile_picture_url, cover_photo_url, is_online: true, is_verified: false,
        bio: '', last_seen: admin.database.ServerValue.TIMESTAMP, postsCount: 0
      };

      await db.ref('profiles/' + userRecord.uid).set(profileData);
      req.session.userId = userRecord.uid;
      req.session.email = email;
      await req.session.save();

      if (wantsJson) {
        return res.json({ ok: true, redirect: '/chat_list', username, full_name: profileData.full_name, profile_picture_url });
      }
      res.redirect('/chat_list');
    } catch (error) {
      let errMsg = 'فشل في إنشاء الحساب.';
      if (error && error.code === 'auth/email-already-exists') errMsg = 'اسم المستخدم مأخوذ بالفعل.';
      else if (error && error.message) errMsg = error.message;
      
      if (wantsJson) return res.status(400).json({ ok: false, error: errMsg });
      res.redirect('/register?error=' + encodeURIComponent(errMsg));
    }
  });

  app.get('/logout', async (req, res) => {
    if (req.session && req.session.userId) {
      try {
        await db.ref(`profiles/${req.session.userId}`).update({
          is_online: false, last_seen: admin.database.ServerValue.TIMESTAMP
        });
      } catch (e) {}
    }
    req.session.destroy(() => { res.clearCookie('connect.sid'); res.redirect('/accounts'); });
  });

  // --- Profile & User Info ---
  app.get('/api/get-public-info', async (req, res) => {
    try {
        const username = req.query.username;
        if (!username) return res.json({ found: false });
        const snapshot = await db.ref('profiles').orderByChild('username').equalTo(username).once('value');
        if (snapshot.exists()) {
            const profileData = Object.values(snapshot.val())[0];
            return res.json({
                found: true,
                full_name: profileData.full_name || username,
                profile_picture_url: profileData.profile_picture_url || DEFAULT_PROFILE_PIC_URL
            });
        }
        res.json({ found: false });
    } catch (error) { res.json({ found: false }); }
  });

  app.get('/api/profile', requireAuth, async (req, res) => {
    const currentUserId = req.session.userId;
    const requestedUserId = req.query.userId || currentUserId;
    try {
      const profileSnap = await db.ref(`profiles/${requestedUserId}`).once('value');
      const profileData = profileSnap.val();
      if (!profileData) return res.status(404).json({ ok: false });

      let isOwner = requestedUserId === currentUserId;
      let isFriend = false, requestSent = false, requestReceived = false;
      try {
        if (!isOwner) {
          const friendSnap = await db.ref(`friends/${currentUserId}/${requestedUserId}`).once('value');
          isFriend = friendSnap.exists();
          const outgoing = await db.ref(`friend_requests/${requestedUserId}/${currentUserId}`).once('value');
          requestSent = outgoing.exists();
          const incoming = await db.ref(`friend_requests/${currentUserId}/${requestedUserId}`).once('value');
          requestReceived = incoming.exists();
        }
      } catch (e) {}

      res.json({ ok: true, ...profileData, is_owner: isOwner, is_friend: isFriend, request_sent: requestSent, request_received: requestReceived });
    } catch (error) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/profile/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const profileSnap = await db.ref('profiles').child(userId).once('value');
      const profile = profileSnap.val();
      if (!profile) return res.status(404).json({ ok: false });
      res.json(profile);
    } catch (error) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/profile/edit', requireAuth, upload.fields([{ name: 'profile_picture' }, { name: 'cover_photo' }]), async (req, res) => {
    const userId = req.session.userId;
    const { full_name, username, bio } = req.body;

    if (!username || !full_name) return res.status(400).json({ ok: false, error: 'الاسم مطلوب.' });

    const updates = { full_name, bio, username };

    try {
      const currentProfileSnap = await db.ref(`profiles/${userId}`).once('value');
      const currentUsername = currentProfileSnap.val().username;

      if (username !== currentUsername) {
        const existingUsernameSnap = await db.ref('profiles').orderByChild('username').equalTo(username).once('value');
        let isUsernameTaken = false;
        existingUsernameSnap.forEach(snap => { if (snap.key !== userId) isUsernameTaken = true; });
        if (isUsernameTaken) return res.status(409).json({ ok: false, error: 'اسم المستخدم مأخوذ.' });

        const newEmail = `${username}@trimer.io`;
        await firebaseAuth.updateUser(userId, { displayName: username, email: newEmail });
        updates.email = newEmail;
      }

      if (req.files && req.files.profile_picture) updates.profile_picture_url = req.files.profile_picture[0].path;
      if (req.files && req.files.cover_photo) updates.cover_photo_url = req.files.cover_photo[0].path;

      await db.ref(`profiles/${userId}`).update(updates);
      res.json({ ok: true, message: 'تم التحديث.' });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') return res.status(409).json({ ok: false, error: 'اسم المستخدم مأخوذ.' });
      res.status(500).json({ ok: false, error: 'فشل التحديث.' });
    }
  });

  app.post('/api/change-password', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ ok: false, error: 'كلمة المرور ضعيفة' });
    try {
      await firebaseAuth.updateUser(userId, { password: newPassword });
      res.json({ ok: true, message: 'تم التغيير' });
    } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
  });

  app.post('/api/account/delete', requireAuth, async (req, res) => {
    const uid = req.session.userId;
    const password = (req.body && req.body.password) ? String(req.body.password) : '';
    if (!password) return res.status(400).json({ ok: false, error: 'Password required' });

    try {
      const snap = await db.ref(`profiles/${uid}`).once('value');
      const profile = snap.val() || {};
      const usernameToDelete = profile.username;
      let email = req.session.email || profile.email || `${usernameToDelete}@trimer.io`;

      const apiKey = process.env.FIREBASE_WEB_API_KEY;
      if (!apiKey) return res.status(500).json({ ok: false, error: 'Server misconfiguration' });

      const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
      const resp = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      });

      if (!resp.ok) return res.status(403).json({ ok: false, error: 'كلمة المرور غير صحيحة.' });

      await firebaseAuth.deleteUser(uid);
      const updates = {};
      updates[`profiles/${uid}`] = null;
      updates[`chats/${uid}`] = null;
      updates[`friends/${uid}`] = null;
      updates[`notifications/${uid}`] = null;
      updates[`sessions/${req.sessionID}`] = null;
      await db.ref().update(updates).catch(() => {});

      req.session.destroy(() => {
        res.json({ ok: true, message: 'Account deleted', deletedUsername: usernameToDelete });
      });
    } catch (err) { res.status(500).json({ ok: false, error: 'Server error' }); }
  });

  app.post('/api/status/heartbeat', requireAuth, async (req, res) => {
    try {
      await db.ref(`profiles/${req.session.userId}`).update({ is_online: true, last_seen: admin.database.ServerValue.TIMESTAMP });
      res.json({ ok: true });
    } catch (error) { res.status(500).json({ ok: false }); }
  });

  // Admin specific
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
      // (نفس كود الأدمن السابق لتقليل التكرار هنا)
      try {
        const snap = await db.ref('profiles').once('value');
        const profiles = snap.val() || {};
        const users = Object.values(profiles).map(u => ({
          id: u.id, username: u.username, full_name: u.full_name, email: u.email,
          profile_picture_url: u.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
          is_online: !!u.is_online, is_verified: !!u.is_verified, bio: u.bio || ''
        }));
        res.json({ ok: true, users });
      } catch (error) { res.status(500).json({ ok: false, error: 'فشل.' }); }
  });

  app.post('/api/admin/users/:userId/verify', requireAuth, requireAdmin, async (req, res) => {
      const { userId } = req.params;
      const verify = req.body && typeof req.body.verify !== 'undefined' ? !!req.body.verify : true;
      try {
        await db.ref(`profiles/${userId}`).update({ is_verified: verify });
        res.json({ ok: true });
      } catch (error) { res.status(500).json({ ok: false }); }
  });
};
