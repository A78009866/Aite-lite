// Lightweight static preview server for the views/ directory.
// Used only for taking screenshots and previewing the redesigned UI
// without requiring Firebase / R2 / mail credentials.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;
const VIEWS = path.join(__dirname, 'views');

app.use('/', express.static(VIEWS, { extensions: ['html'] }));

// Route helpers so `/login`, `/register` etc. resolve like the real app
const pageNames = [
  'splash', 'accounts', 'admin', 'all_users', 'chat', 'chat_list',
  'create_post', 'create_product', 'create_reel', 'create_story',
  'edit_product', 'edit_profile', 'forgot-password',
  'google-complete-profile', 'login', 'marketplace', 'notifications',
  'post', 'product_detail', 'profile', 'reels', 'register',
  'reset-password', 'search', 'settings', 'stories', 'users_list'
];
pageNames.forEach(name => {
  app.get('/' + name, (req, res) => res.sendFile(path.join(VIEWS, name + '.html')));
});

app.get('/', (req, res) => res.sendFile(path.join(VIEWS, 'splash.html')));

app.listen(PORT, () => {
  console.log('Preview server running on http://localhost:' + PORT);
});
