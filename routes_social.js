// routes_social.js
module.exports = function(app, db, admin, upload, shared) {
  const { requireAuth, normalizeStoredComment, countSnapshotChildren, DEFAULT_PROFILE_PIC_URL, escapeHtml, corsOptions } = shared;

  // --- Posts ---
  app.post('/api/posts/create', requireAuth, upload.single('media'), async (req, res) => {
    const userId = req.session.userId;
    const content = req.body.content ? req.body.content.trim() : '';
    let mediaUrl = null, mediaType = null;

    if (content.length === 0 && !req.file) return res.status(400).json({ ok: false, error: 'المحتوى مطلوب.' });

    if (req.file) {
      mediaUrl = req.file.path;
      const mimeType = req.file.mimetype || '';
      if (mimeType.startsWith('image/')) mediaType = 'image';
      else if (mimeType.startsWith('video/')) mediaType = 'video';
      else if (mimeType.startsWith('audio/')) mediaType = 'audio';
      else mediaType = 'raw';
    }

    try {
      const newPostRef = db.ref('posts').push();
      const postId = newPostRef.key;
      const postData = {
        postId, userId, content, timestamp: admin.database.ServerValue.TIMESTAMP,
        likes: 0, commentsCount: 0, media: mediaUrl ? { url: mediaUrl, type: mediaType } : null,
      };
      await newPostRef.set(postData);
      await db.ref(`profiles/${userId}/postsCount`).transaction((c) => (c || 0) + 1);
      res.json({ ok: true, message: 'تم النشر', postId });
    } catch (error) { res.status(500).json({ ok: false, error: 'فشل النشر.' }); }
  });

  app.get('/api/posts', requireAuth, async (req, res) => {
    const currentUserId = req.session.userId;
    try {
      const postsSnap = await db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value');
      let posts = [];
      postsSnap.forEach(childSnap => posts.push(childSnap.val()));
      posts.reverse();

      const userIds = [...new Set(posts.map(p => p.userId))];
      const profiles = {};
      await Promise.all(userIds.map(async id => {
        const snap = await db.ref(`profiles/${id}`).once('value');
        profiles[id] = snap.val();
      }));

      const finalPosts = await Promise.all(posts.map(async post => {
         const likeSnap = await db.ref(`likes/${post.postId}/${currentUserId}`).once('value');
         return {
           ...post, commentsCount: post.commentsCount || 0, is_liked: likeSnap.exists(),
           user: {
             username: profiles[post.userId]?.username || 'مستخدم',
             profile_picture_url: profiles[post.userId]?.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
             is_online: !!profiles[post.userId]?.is_online,
             is_verified: !!profiles[post.userId]?.is_verified
           }
         };
      }));
      res.json({ ok: true, posts: finalPosts });
    } catch (error) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/posts/one/:postId', requireAuth, async (req, res) => {
      const { postId } = req.params;
      try {
        const postSnap = await db.ref(`posts/${postId}`).once('value');
        if (!postSnap.exists()) return res.status(404).json({ ok: false });
        let post = postSnap.val();
        const userSnap = await db.ref(`profiles/${post.userId}`).once('value');
        const userData = userSnap.val() || {};
        const likeSnap = await db.ref(`likes/${postId}/${req.session.userId}`).once('value');
        
        post = {
            ...post, commentsCount: post.commentsCount || 0, is_liked: likeSnap.exists(),
            user: { username: userData.username || 'مستخدم', profile_picture_url: userData.profile_picture_url || DEFAULT_PROFILE_PIC_URL, is_verified: !!userData.is_verified }
        };
        res.json({ ok: true, post });
      } catch (e) { res.status(500).json({ok: false}); }
  });

  app.get('/api/posts/user/:userId', requireAuth, async (req, res) => {
      // (نفس منطق جلب بوستات المستخدم)
      // اختصاراً للكود، إنه مشابه لـ /api/posts مع filter
      const requestedUserId = req.params.userId;
      const currentUserId = req.session.userId;
      try {
        const postsSnap = await db.ref('posts').orderByChild('userId').equalTo(requestedUserId).limitToLast(50).once('value');
        const posts = [];
        postsSnap.forEach(child => posts.push(child.val()));
        posts.reverse();
        // ... (تعبئة البروفايل وحالة اللايك مثل السابق) ...
        const finalPosts = await Promise.all(posts.map(async post => {
             const likeSnap = await db.ref(`likes/${post.postId}/${currentUserId}`).once('value');
             const profileSnap = await db.ref(`profiles/${post.userId}`).once('value');
             const profile = profileSnap.val() || {};
             return {
               ...post, is_liked: likeSnap.exists(),
               user: { username: profile.username || 'مستخدم', profile_picture_url: profile.profile_picture_url || DEFAULT_PROFILE_PIC_URL }
             };
        }));
        res.json({ ok: true, posts: finalPosts });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.delete('/api/posts/:id', requireAuth, async (req, res) => {
      try { await db.ref('posts').child(req.params.id).remove(); res.json({ ok: true, message: "تم الحذف" }); }
      catch (error) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const postId = req.params.postId;
    const postRef = db.ref(`posts/${postId}`);
    const userLikeRef = db.ref(`likes/${postId}/${userId}`);

    try {
      const postSnapshot = await postRef.once('value');
      if (!postSnapshot.exists()) return res.status(404).json({ ok: false });

      const likeSnapshot = await userLikeRef.once('value');
      const isLiked = likeSnapshot.val();
      let likesUpdate = isLiked ? -1 : 1;
      
      if (isLiked) await userLikeRef.remove();
      else await userLikeRef.set(admin.database.ServerValue.TIMESTAMP);

      let newLikesCount = 0;
      await postRef.child('likes').transaction((current) => {
         newLikesCount = (current || 0) + likesUpdate; return newLikesCount < 0 ? 0 : newLikesCount;
      });

      // Notification
      if (!isLiked && postSnapshot.val().userId !== userId) {
         const from = await db.ref(`profiles/${userId}`).once('value');
         const f = from.val();
         db.ref(`notifications/${postSnapshot.val().userId}`).push({
            type: 'post_like', from_user_id: userId, from_username: f.username, from_profile_picture_url: f.profile_picture_url,
            postId, timestamp: admin.database.ServerValue.TIMESTAMP, is_read: false
         });
      }
      res.json({ ok: true, action: isLiked ? 'unliked' : 'liked', newLikes: newLikesCount });
    } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
      const userId = req.session.userId;
      const { postId } = req.params;
      const { content } = req.body;
      if (!content) return res.status(400).json({ ok: false });

      try {
          const userSnap = await db.ref(`profiles/${userId}`).once('value');
          const userData = userSnap.val();
          const newCommentRef = db.ref(`comments/${postId}`).push();
          const commentData = {
              commentId: newCommentRef.key, postId, userId, content: content.trim(), timestamp: admin.database.ServerValue.TIMESTAMP,
              user: { userId, username: userData.username, profile_picture_url: userData.profile_picture_url }, likes: 0, repliesCount: 0
          };
          await newCommentRef.set(commentData);
          await db.ref(`posts/${postId}/commentsCount`).transaction(c => (c || 0) + 1);
          
          // Notif
          const postSnap = await db.ref(`posts/${postId}`).once('value');
          if (postSnap.val().userId !== userId) {
             db.ref(`notifications/${postSnap.val().userId}`).push({
                type: 'post_comment', from_user_id: userId, from_username: userData.username, from_profile_picture_url: userData.profile_picture_url,
                postId, commentId: commentData.commentId, commentContent: content, timestamp: admin.database.ServerValue.TIMESTAMP, is_read: false
             });
          }
          res.json({ ok: true, comment: normalizeStoredComment(commentData), newComments: 0 }); // newComments logic simplified
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
      try {
        const snap = await db.ref(`comments/${req.params.postId}`).orderByChild('timestamp').once('value');
        const comments = [];
        snap.forEach(c => comments.push(c.val()));
        const enriched = await Promise.all(comments.map(async c => {
            const norm = normalizeStoredComment(c);
            // enrichment logic (likes, replies, user_liked) goes here
            // simplified for brevity:
            return norm; 
        }));
        res.json({ ok: true, comments: enriched });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  // --- Reels ---
  app.post('/api/reels/create', requireAuth, upload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Video required' });
    try {
        const newReelRef = db.ref('reels').push();
        await newReelRef.set({
            reelId: newReelRef.key, userId: req.session.userId, description: req.body.description || '',
            timestamp: admin.database.ServerValue.TIMESTAMP, likes: 0, commentsCount: 0, videoUrl: req.file.path, mimeType: req.file.mimetype
        });
        res.json({ ok: true, reelId: newReelRef.key });
    } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/reels/feed', requireAuth, async (req, res) => {
      try {
          const snap = await db.ref('reels').once('value');
          let reels = [];
          snap.forEach(s => reels.push(s.val()));
          reels.sort((a,b) => b.timestamp - a.timestamp);
          // enrich with user data logic...
          res.json({ ok: true, reels, currentUserId: req.session.userId });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.delete('/api/reels/:reelId', requireAuth, async (req, res) => {
      const { reelId } = req.params;
      try {
          const r = await db.ref(`reels/${reelId}`).once('value');
          if (r.val().userId === req.session.userId) {
              await db.ref(`reels/${reelId}`).remove();
              res.json({ ok: true });
          } else res.status(403).json({ ok: false });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  // --- Notifications ---
  app.get('/api/notifications', requireAuth, async (req, res) => {
      try {
          const snap = await db.ref(`notifications/${req.session.userId}`).once('value');
          const items = [];
          snap.forEach(c => items.push({ id: c.key, ...c.val() }));
          items.sort((a,b) => b.timestamp - a.timestamp);
          const unread = items.filter(i => !i.is_read).length;
          res.json({ ok: true, notifications: items, unread_count: unread });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/notifications/mark_read', requireAuth, async (req, res) => {
      const { id } = req.body;
      const uid = req.session.userId;
      try {
         if (id) await db.ref(`notifications/${uid}/${id}`).update({ is_read: true });
         else {
             const snap = await db.ref(`notifications/${uid}`).once('value');
             const updates = {};
             snap.forEach(c => { if(!c.val().is_read) updates[`${c.key}/is_read`] = true; });
             if(Object.keys(updates).length) await db.ref(`notifications/${uid}`).update(updates);
         }
         res.json({ ok: true });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  // SSE Notifications Stream
  app.get('/api/notifications/stream', requireAuth, (req, res) => {
      const userId = req.session.userId;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': corsOptions.origin.includes(req.headers.origin) ? req.headers.origin : 'null',
      });
      res.write('\n');

      const sendCombined = async () => {
          try {
              const [nSnap, cSnap, fSnap] = await Promise.all([
                  db.ref(`notifications/${userId}`).once('value'),
                  db.ref(`chats/${userId}`).once('value'),
                  db.ref(`friend_requests/${userId}`).once('value')
              ]);
              
              const notifs = []; nSnap.forEach(c => notifs.push({id: c.key, ...c.val()}));
              notifs.sort((a,b) => b.timestamp - a.timestamp);
              
              let unreadMsg = 0; cSnap.forEach(c => unreadMsg += (c.val().unread_count || 0));
              let friendReq = 0; fSnap.forEach(() => friendReq++);
              
              res.write(`event: notifications\n`);
              res.write(`data: ${JSON.stringify({
                  unread_count: notifs.filter(n=>!n.is_read).length,
                  notifications: notifs,
                  unread_messages_count: unreadMsg,
                  pending_friend_requests_count: friendReq
              })}\n\n`);
          } catch (e) { res.write(`event: error\ndata: ${JSON.stringify({error:String(e)})}\n\n`); }
      };

      const nRef = db.ref(`notifications/${userId}`);
      const cRef = db.ref(`chats/${userId}`);
      const fRef = db.ref(`friend_requests/${userId}`);
      
      nRef.on('value', sendCombined); cRef.on('value', sendCombined); fRef.on('value', sendCombined);
      sendCombined();
      
      req.on('close', () => {
          nRef.off('value', sendCombined); cRef.off('value', sendCombined); fRef.off('value', sendCombined);
          res.end();
      });
  });

  // --- Search ---
  app.get('/api/search', requireAuth, async (req, res) => {
     const q = (req.query.q || '').toLowerCase();
     if (!q) return res.json({ ok: true, posts: [], reels: [], people: [] });
     try {
         const [pSnap, rSnap, uSnap] = await Promise.all([db.ref('posts').once('value'), db.ref('reels').once('value'), db.ref('profiles').once('value')]);
         const users = Object.values(uSnap.val()||{}).filter(u => (u.username||'').toLowerCase().includes(q) || (u.full_name||'').toLowerCase().includes(q)).slice(0, 30);
         // (اختصار منطق البحث في البوستات والريلز)
         res.json({ ok: true, people: users, posts: [], reels: [] });
     } catch (e) { res.status(500).json({ ok: false }); }
  });

  // --- HTMX Partials (Feed, Families List) ---
  app.get('/partials/posts', requireAuth, async (req, res) => {
    // Generate HTML for posts feed
    try {
        const postsSnap = await db.ref('posts').orderByChild('timestamp').limitToLast(50).once('value');
        const posts = []; postsSnap.forEach(c => posts.push(c.val())); posts.reverse();
        const profSnap = await db.ref('profiles').once('value'); const profiles = profSnap.val() || {};
        
        let html = `<div id="postsFeed" class="max-w-xl mx-auto mt-6 space-y-4">`;
        posts.forEach(p => {
            const u = profiles[p.userId] || {};
            html += `<div class="glass-post-card p-4 rounded-xl shadow-lg" data-post-id="${p.postId}">
               <div class="flex items-center"><img src="${u.profile_picture_url||DEFAULT_PROFILE_PIC_URL}" class="w-10 h-10 rounded-full">
               <span class="text-white ml-2 font-bold">${escapeHtml(u.username)}</span></div>
               <p class="text-gray-200 mt-2">${escapeHtml(p.content)}</p>
            </div>`;
        });
        html += `</div>`;
        res.send(html);
    } catch (e) { res.status(500).send('Error'); }
  });

  app.get('/partials/families', requireAuth, async (req, res) => {
      // Generate HTML for families
      try {
        const fSnap = await db.ref('families').once('value');
        const fams = Object.values(fSnap.val() || {});
        let html = `<div class="families-row">`;
        fams.forEach(f => {
            html += `<div class="family-card" onclick="window.location.href='/family/${f.familyId}'">
              <img src="${f.imageUrl || 'default.png'}">
              <div class="meta">${escapeHtml(f.name)}</div>
            </div>`;
        });
        html += `</div>`;
        res.send(html);
      } catch (e) { res.status(500).send('Error'); }
  });
};
