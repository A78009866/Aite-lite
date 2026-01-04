// routes_chat.js
module.exports = function(app, db, admin, upload, shared) {
  const { requireAuth, DEFAULT_PROFILE_PIC_URL, corsOptions } = shared;

  async function areFriends(userA, userB) {
    if (!userA || !userB) return false;
    const snap = await db.ref(`friends/${userA}/${userB}`).once('value');
    return snap.exists();
  }

  // --- Friends ---
  app.get('/api/users', requireAuth, async (req, res) => {
      const uid = req.session.userId;
      try {
          const fSnap = await db.ref(`friends/${uid}`).once('value');
          const fIds = Object.keys(fSnap.val() || {});
          if (!fIds.length) return res.json({ ok: true, users: [] });
          
          const users = await Promise.all(fIds.map(async id => {
              const p = await db.ref(`profiles/${id}`).once('value');
              return p.val();
          }));
          res.json({ ok: true, users: users.filter(u=>u) });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/friends/request', requireAuth, async (req, res) => {
      const from = req.session.userId, { to_id } = req.body;
      if (from === to_id) return res.status(400).json({ ok: false });
      try {
          if (await areFriends(from, to_id)) return res.status(409).json({ ok: false, error: 'Already friends' });
          await db.ref(`friend_requests/${to_id}/${from}`).set({ from, timestamp: admin.database.ServerValue.TIMESTAMP });
          
          const myProfile = (await db.ref(`profiles/${from}`).once('value')).val();
          db.ref(`notifications/${to_id}`).push({
              type: 'friend_request', from_user_id: from, from_username: myProfile.username,
              timestamp: admin.database.ServerValue.TIMESTAMP, is_read: false
          });
          res.json({ ok: true });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/friends/accept', requireAuth, async (req, res) => {
      const to = req.session.userId, { from_id } = req.body;
      try {
          await db.ref(`friends/${to}/${from_id}`).set({ since: admin.database.ServerValue.TIMESTAMP });
          await db.ref(`friends/${from_id}/${to}`).set({ since: admin.database.ServerValue.TIMESTAMP });
          await db.ref(`friend_requests/${to}/${from_id}`).remove();
          res.json({ ok: true });
      } catch (e) { res.status(500).json({ ok: false }); }
  });
  
  app.get('/api/friends/requests', requireAuth, async (req, res) => {
      try {
          const snap = await db.ref(`friend_requests/${req.session.userId}`).once('value');
          const reqs = []; 
          snap.forEach(c => reqs.push({ from: c.key, ...c.val() }));
          // Enrich with profile data...
          res.json({ ok: true, requests: reqs });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  // --- Chats & Messages ---
  app.get('/api/chats', requireAuth, async (req, res) => {
      try {
          const snap = await db.ref(`chats/${req.session.userId}`).once('value');
          const chats = []; snap.forEach(c => chats.push(c.val()));
          chats.sort((a,b) => b.last_message_timestamp - a.last_message_timestamp);
          
          const enriched = await Promise.all(chats.map(async chat => {
              const p = await db.ref(`profiles/${chat.contact_id}`).once('value');
              return { ...chat, contact_profile: p.val() || { username: 'User' } };
          }));
          res.json({ ok: true, chats: enriched });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/messages/:contactId', requireAuth, async (req, res) => {
      const uid = req.session.userId, cid = req.params.contactId;
      const room = [uid, cid].sort().join('_');
      try {
          // Supports JSON fetch for clean UI
          const limit = req.query.limit || 50;
          const snap = await db.ref(`messages/${room}`).orderByChild('timestamp').limitToLast(Number(limit)).once('value');
          const msgs = [];
          snap.forEach(c => msgs.push({ messageId: c.key, ...c.val() }));
          
          if (req.xhr || req.headers.accept.includes('json')) {
              // Get other user info
              const otherUserSnap = await db.ref(`profiles/${cid}`).once('value');
              return res.json({ messages: msgs, currentUserId: uid, otherUser: otherUserSnap.val() });
          }
          res.json({ ok: true, messages: msgs });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/messages/send', upload.array('files'), requireAuth, async (req, res) => {
      const sender = req.session.userId, { contact_id, content, reply_to_id } = req.body;
      const room = [sender, contact_id].sort().join('_');
      try {
          const files = req.files || [];
          const attachments = files.map(f => ({ url: f.path, type: f.mimetype.startsWith('image') ? 'image' : 'file' }));
          
          const ref = db.ref(`messages/${room}`).push();
          const msg = {
              id: ref.key, senderId: sender, content: content||'', attachments, timestamp: admin.database.ServerValue.TIMESTAMP,
              is_read: false, reply_to_id: reply_to_id||null
          };
          await ref.set(msg);

          const preview = (content || (attachments.length ? 'مرفق' : ''));
          const updateData = { last_message_content: preview, last_message_timestamp: msg.timestamp, last_message_sender_id: sender, last_message_is_read: false };
          
          await db.ref(`chats/${contact_id}/${sender}`).update({ ...updateData, contact_id: sender, unread_count: admin.database.ServerValue.increment(1) });
          await db.ref(`chats/${sender}/${contact_id}`).update({ ...updateData, contact_id, unread_count: 0 });

          res.json({ ok: true, messageId: ref.key });
      } catch (e) { res.status(500).json({ ok: false }); }
  });
  
  app.post('/api/mark_read', requireAuth, async (req, res) => {
      const uid = req.session.userId, { other_id } = req.body;
      const room = [uid, other_id].sort().join('_');
      try {
          // 1. Mark individual messages
          const mRef = db.ref(`messages/${room}`);
          const snap = await mRef.orderByChild('senderId').equalTo(other_id).once('value');
          const updates = {};
          snap.forEach(c => { if(!c.val().is_read) updates[`${c.key}/is_read`] = true; });
          if(Object.keys(updates).length) await mRef.update(updates);
          
          // 2. Reset unread count for me
          await db.ref(`chats/${uid}/${other_id}`).update({ unread_count: 0 });
          // 3. Update "seen" status for the other user
          await db.ref(`chats/${other_id}/${uid}`).update({ last_message_is_read: true });
          
          res.json({ ok: true });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  // --- Users Stream (SSE) ---
  app.get('/api/users/stream', requireAuth, async (req, res) => {
      const uid = req.session.userId;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': corsOptions.origin.includes(req.headers.origin) ? req.headers.origin : 'null',
      });
      res.write('\n');

      const sendList = async () => {
          try {
              const fSnap = await db.ref(`friends/${uid}`).once('value');
              const fIds = Object.keys(fSnap.val() || {});
              if (!fIds.length) { res.write(`data: ${JSON.stringify({users:[]})}\n\n`); return; }

              const chatsSnap = await db.ref(`chats/${uid}`).once('value');
              const allChats = chatsSnap.val() || {};
              
              const users = await Promise.all(fIds.map(async id => {
                  const p = (await db.ref(`profiles/${id}`).once('value')).val();
                  if (!p) return null;
                  const chat = allChats[id] || {};
                  return {
                      id: p.id, username: p.username, full_name: p.full_name, profile_picture_url: p.profile_picture_url || DEFAULT_PROFILE_PIC_URL,
                      is_online: !!p.is_online, unread_count: chat.unread_count || 0,
                      last_message: chat.last_message_content ? { content: chat.last_message_content, timestamp: chat.last_message_timestamp, senderId: chat.last_message_sender_id } : null
                  };
              }));
              res.write(`data: ${JSON.stringify({ users: users.filter(u=>u) })}\n\n`);
          } catch (e) { res.write(`event: error\ndata: ${JSON.stringify({error:e.message})}\n\n`); }
      };
      
      sendList();
      const chatRef = db.ref(`chats/${uid}`);
      const friendRef = db.ref(`friends/${uid}`);
      chatRef.on('value', sendList); friendRef.on('value', sendList);
      const keepAlive = setInterval(sendList, 60000);
      
      req.on('close', () => {
          chatRef.off('value', sendList); friendRef.off('value', sendList); clearInterval(keepAlive);
          res.end();
      });
  });
};
