// routes_family.js
const crypto = require('crypto');

module.exports = function(app, db, admin, upload, shared) {
  const { requireAuth, normalizeStoredComment, countSnapshotChildren, DEFAULT_PROFILE_PIC_URL } = shared;

  // Helpers Local to Families
  function generateFamilyKey() { return crypto.randomBytes(4).toString('hex'); }
  function hashFamilyKey(plainKey) {
    const salt = process.env.FAMILY_KEY_SALT || 'fam-salt-default';
    return crypto.createHmac('sha256', salt).update(String(plainKey)).digest('hex');
  }
  async function isFamilyMember(familyId, userId) {
    if (!familyId || !userId) return false;
    const snap = await db.ref(`families/${familyId}/members/${userId}`).once('value');
    return snap.exists();
  }
  async function requireFamilyMember(req, res, next) {
    const userId = req.session.userId;
    const familyId = req.params.familyId || req.body.familyId;
    if (!familyId) return res.status(400).json({ ok: false, error: 'familyId required' });
    if (await isFamilyMember(familyId, userId)) return next();
    return res.status(403).json({ ok: false, error: 'You are not a member of this family' });
  }

  // --- Routes ---

  app.post('/api/families/create', requireAuth, upload.single('family_image'), async (req, res) => {
      const userId = req.session.userId;
      const { name } = req.body;
      if (!name || name.trim().length === 0) return res.status(400).json({ ok: false, error: 'Required' });

      try {
          const newRef = db.ref('families').push();
          const familyId = newRef.key;
          const plainKey = generateFamilyKey();
          const keyHash = hashFamilyKey(plainKey);
          const imageUrl = (req.file && req.file.path) ? req.file.path : '';
          
          const familyData = {
              familyId, name: name.trim(), imageUrl, creatorId: userId, keyHash,
              createdAt: admin.database.ServerValue.TIMESTAMP, membersCount: 1, keyPlain: plainKey
          };
          const members = {}; members[userId] = { role: 'owner', joinedAt: familyData.createdAt };

          await newRef.set({ ...familyData, members });
          await db.ref(`memberships/${userId}/${familyId}`).set(true);

          res.json({ ok: true, familyId, key: plainKey, family: familyData });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/families/my', requireAuth, async (req, res) => {
      const userId = req.session.userId;
      try {
          const snap = await db.ref('families').once('value');
          const myFamilies = [];
          snap.forEach(c => {
              const f = c.val();
              if (f.members && f.members[userId]) myFamilies.push(f);
          });
          res.json({ ok: true, families: myFamilies });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/families/:familyId/info', requireAuth, async (req, res) => {
      try {
          const snap = await db.ref(`families/${req.params.familyId}`).once('value');
          if (!snap.exists()) return res.status(404).json({ ok: false });
          const f = snap.val();
          const isMember = !!(f.members && f.members[req.session.userId]);
          res.json({ ok: true, family: { ...f, is_member: isMember, keyHash: undefined, keyPlain: undefined } });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.post('/api/families/:familyId/join', requireAuth, async (req, res) => {
      const { familyId } = req.params;
      const { key } = req.body;
      try {
          const snap = await db.ref(`families/${familyId}`).once('value');
          if (!snap.exists()) return res.status(404).json({ ok: false });
          const f = snap.val();
          if (hashFamilyKey(key) !== f.keyHash) return res.status(403).json({ ok: false, error: 'Invalid Key' });
          
          await db.ref(`families/${familyId}/members/${req.session.userId}`).set({ role: 'member', joinedAt: admin.database.ServerValue.TIMESTAMP });
          await db.ref(`families/${familyId}/membersCount`).transaction(c => (c||0) + 1);
          await db.ref(`memberships/${req.session.userId}/${familyId}`).set(true);
          res.json({ ok: true });
      } catch (e) { res.status(500).json({ ok: false }); }
  });
  
  app.get('/api/families/:familyId/key', requireAuth, async (req, res) => {
      try {
        const snap = await db.ref(`families/${req.params.familyId}`).once('value');
        if (snap.val().creatorId !== req.session.userId) return res.status(403).json({ ok: false });
        res.json({ ok: true, key: snap.val().keyPlain });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.delete('/api/families/:familyId', requireAuth, async (req, res) => {
      try {
        const fRef = db.ref(`families/${req.params.familyId}`);
        const snap = await fRef.once('value');
        if (snap.val().creatorId !== req.session.userId) return res.status(403).json({ ok: false });
        await fRef.remove();
        res.json({ ok: true });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  // Family Posts
  app.post('/api/families/:familyId/posts/create', requireAuth, requireFamilyMember, upload.single('media'), async (req, res) => {
      // (Similar to standard post create but under family_posts)
      try {
          const { familyId } = req.params;
          const content = req.body.content || '';
          let mediaUrl = req.file ? req.file.path : null;
          const ref = db.ref(`family_posts/${familyId}`).push();
          await ref.set({
              postId: ref.key, familyId, userId: req.session.userId, content, timestamp: admin.database.ServerValue.TIMESTAMP,
              media: mediaUrl ? { url: mediaUrl } : null, likes: 0, commentsCount: 0
          });
          res.json({ ok: true, postId: ref.key });
      } catch (e) { res.status(500).json({ ok: false }); }
  });

  app.get('/api/families/:familyId/posts', requireAuth, requireFamilyMember, async (req, res) => {
      try {
          const snap = await db.ref(`family_posts/${req.params.familyId}`).orderByChild('timestamp').limitToLast(50).once('value');
          const posts = [];
          snap.forEach(c => posts.push(c.val()));
          posts.reverse();
          // (Data enrichment omitted for brevity, add user profiles logic here)
          res.json({ ok: true, posts });
      } catch (e) { res.status(500).json({ ok: false }); }
  });
  
  // (Add family post like/comment endpoints similarly)
};
