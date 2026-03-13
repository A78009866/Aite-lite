/**
 * Aite - Multi-language Support (Arabic, French, English)
 * Include this script in every page BEFORE the closing </body> tag
 * Usage: Add data-i18n="key" to elements for text translation
 *        Add data-i18n-placeholder="key" for placeholder translation
 *        Add data-i18n-title="key" for title attribute translation
 */

(function () {
  'use strict';

  const LANG_KEY = 'aite-lang';
  const SUPPORTED_LANGS = ['ar', 'fr', 'en'];
  const RTL_LANGS = ['ar'];

  // ─── Translations ───
  const translations = {
    // ============ LOGIN PAGE ============
    login_title: { ar: 'تسجيل الدخول — Aite', fr: 'Connexion — Aite', en: 'Login — Aite' },
    login_welcome: { ar: 'مرحباً بعودتك', fr: 'Content de vous revoir', en: 'Welcome back' },
    login_username_label: { ar: 'اسم المستخدم', fr: "Nom d'utilisateur", en: 'Username' },
    login_username_placeholder: { ar: 'أدخل اسم المستخدم', fr: "Entrez le nom d'utilisateur", en: 'Enter username' },
    login_password_label: { ar: 'كلمة المرور', fr: 'Mot de passe', en: 'Password' },
    login_btn: { ar: 'دخول', fr: 'Connexion', en: 'Login' },
    login_loading: { ar: 'جاري تسجيل الدخول...', fr: 'Connexion en cours...', en: 'Logging in...' },
    login_or: { ar: 'أو', fr: 'OU', en: 'OR' },
    login_create_account: { ar: 'إنشاء حساب', fr: 'Créer un compte', en: 'Create account' },
    login_switch_account: { ar: 'تبديل الحساب', fr: 'Changer de compte', en: 'Switch account' },
    login_error_required: { ar: 'اسم المستخدم وكلمة المرور مطلوبان.', fr: "Le nom d'utilisateur et le mot de passe sont requis.", en: 'Username and password are required.' },
    login_error_failed: { ar: 'فشل في تسجيل الدخول.', fr: 'Échec de la connexion.', en: 'Login failed.' },
    login_error_server: { ar: 'فشل في الاتصال بالخادم', fr: 'Échec de connexion au serveur', en: 'Failed to connect to server' },
    login_error_server2: { ar: 'فشل في الاتصال بالخادم.', fr: 'Échec de connexion au serveur.', en: 'Failed to connect to server.' },

    // ============ REGISTER PAGE ============
    register_title: { ar: 'إنشاء حساب جديد — Aite', fr: 'Créer un compte — Aite', en: 'Create Account — Aite' },
    register_heading: { ar: 'إنشاء حساب جديد', fr: 'Créer un nouveau compte', en: 'Create New Account' },
    register_fullname_label: { ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Full Name' },
    register_fullname_placeholder: { ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Full Name' },
    register_username_label: { ar: 'اسم المستخدم', fr: "Nom d'utilisateur", en: 'Username' },
    register_password_label: { ar: 'كلمة المرور', fr: 'Mot de passe', en: 'Password' },
    register_btn: { ar: 'إنشاء حساب', fr: 'Créer un compte', en: 'Create Account' },
    register_loading: { ar: 'جاري التسجيل...', fr: 'Inscription en cours...', en: 'Registering...' },
    register_have_account: { ar: 'لديك حساب بالفعل؟', fr: 'Vous avez déjà un compte ?', en: 'Already have an account?' },
    register_login_link: { ar: 'تسجيل الدخول', fr: 'Se connecter', en: 'Login' },
    register_cover: { ar: 'غلاف', fr: 'Couverture', en: 'Cover' },
    register_error_username_required: { ar: 'اسم المستخدم مطلوب.', fr: "Le nom d'utilisateur est requis.", en: 'Username is required.' },
    register_error_no_spaces: { ar: 'لا يجب أن يحتوي اسم المستخدم على مسافات.', fr: "Le nom d'utilisateur ne doit pas contenir d'espaces.", en: 'Username must not contain spaces.' },
    register_error_format: { ar: 'اسم المستخدم يجب أن يتكون من أحرف وأرقام ونقاط أو _ أو - وطوله بين 3 و 32.', fr: "Le nom d'utilisateur doit contenir des lettres, chiffres, points, _ ou - (3-32 caractères).", en: 'Username must be 3-32 characters with letters, numbers, dots, _ or -.' },
    register_error_short_password: { ar: 'كلمة المرور قصيرة؛ يجب أن تكون 6 أحرف على الأقل.', fr: 'Le mot de passe est trop court ; au moins 6 caractères.', en: 'Password is too short; must be at least 6 characters.' },
    register_error_failed: { ar: 'فشل في التسجيل', fr: "Échec de l'inscription", en: 'Registration failed' },
    register_error_server: { ar: 'فشل في الاتصال بالخادم. حاول مرة أخرى.', fr: 'Échec de connexion au serveur. Réessayez.', en: 'Failed to connect to server. Try again.' },

    // ============ ACCOUNTS PAGE ============
    accounts_title: { ar: 'حساباتك — Aite', fr: 'Vos comptes — Aite', en: 'Your Accounts — Aite' },
    accounts_choose: { ar: 'اختر حساباً للمتابعة', fr: 'Choisissez un compte pour continuer', en: 'Choose an account to continue' },
    accounts_login_other: { ar: 'تسجيل الدخول بحساب آخر', fr: 'Se connecter avec un autre compte', en: 'Login with another account' },
    accounts_create_new: { ar: 'إنشاء حساب جديد', fr: 'Créer un nouveau compte', en: 'Create a new account' },
    accounts_no_saved: { ar: 'لا توجد حسابات محفوظة', fr: 'Aucun compte enregistré', en: 'No saved accounts' },
    accounts_confirm_remove: { ar: 'هل أنت متأكد من إزالة @{username} من الجهاز؟', fr: 'Voulez-vous vraiment supprimer @{username} de cet appareil ?', en: 'Are you sure you want to remove @{username} from this device?' },

    // ============ SETTINGS PAGE ============
    settings_title: { ar: 'الإعدادات - Aite', fr: 'Paramètres - Aite', en: 'Settings - Aite' },
    settings_heading: { ar: 'الإعدادات', fr: 'Paramètres', en: 'Settings' },
    settings_account: { ar: 'الحساب', fr: 'COMPTE', en: 'ACCOUNT' },
    settings_edit_profile: { ar: 'تعديل الملف الشخصي', fr: 'Modifier le profil', en: 'Edit Profile' },
    settings_appearance: { ar: 'المظهر', fr: 'APPARENCE', en: 'APPEARANCE' },
    settings_dark_mode: { ar: 'الوضع المظلم', fr: 'Mode sombre', en: 'Dark Mode' },
    settings_light_mode: { ar: 'الوضع الفاتح', fr: 'Mode clair', en: 'Light Mode' },
    settings_language: { ar: 'اللغة', fr: 'LANGUE', en: 'LANGUAGE' },
    settings_language_label: { ar: 'لغة التطبيق', fr: "Langue de l'application", en: 'App Language' },
    settings_security: { ar: 'الأمان', fr: 'SÉCURITÉ', en: 'SECURITY' },
    settings_new_password: { ar: 'كلمة المرور الجديدة', fr: 'Nouveau mot de passe', en: 'New Password' },
    settings_confirm_password: { ar: 'تأكيد كلمة المرور', fr: 'Confirmer le mot de passe', en: 'Confirm Password' },
    settings_update_password: { ar: 'تحديث كلمة المرور', fr: 'Mettre à jour le mot de passe', en: 'Update Password' },
    settings_updating: { ar: 'جارٍ التحديث...', fr: 'Mise à jour...', en: 'Updating...' },
    settings_logout: { ar: 'تسجيل الخروج', fr: 'Déconnexion', en: 'Logout' },
    settings_delete_account: { ar: 'حذف الحساب', fr: 'Supprimer le compte', en: 'Delete Account' },
    settings_logout_confirm_title: { ar: 'تأكيد الخروج', fr: 'Confirmer la déconnexion', en: 'Confirm Logout' },
    settings_logout_confirm_msg: { ar: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟', fr: 'Voulez-vous vraiment vous déconnecter ?', en: 'Are you sure you want to logout?' },
    settings_cancel: { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel' },
    settings_logout_btn: { ar: 'خروج', fr: 'Déconnexion', en: 'Logout' },
    settings_delete_title: { ar: 'حذف الحساب نهائياً', fr: 'Supprimer le compte définitivement', en: 'Delete Account Permanently' },
    settings_delete_msg: { ar: 'سيتم حذف بياناتك من السيرفر وإزالته من هذا الجهاز. أدخل كلمة المرور للتأكيد.', fr: 'Vos données seront supprimées du serveur et de cet appareil. Entrez le mot de passe pour confirmer.', en: 'Your data will be deleted from the server and this device. Enter password to confirm.' },
    settings_delete_password_placeholder: { ar: 'كلمة المرور', fr: 'Mot de passe', en: 'Password' },
    settings_delete_btn: { ar: 'حذف الحساب', fr: 'Supprimer le compte', en: 'Delete Account' },
    settings_deleting: { ar: 'جارٍ الحذف...', fr: 'Suppression...', en: 'Deleting...' },
    settings_password_mismatch: { ar: 'كلمات المرور غير متطابقة.', fr: 'Les mots de passe ne correspondent pas.', en: 'Passwords do not match.' },
    settings_password_short: { ar: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', fr: 'Le mot de passe doit contenir au moins 6 caractères.', en: 'Password must be at least 6 characters.' },
    settings_password_success: { ar: 'تم تغيير كلمة المرور بنجاح.', fr: 'Mot de passe changé avec succès.', en: 'Password changed successfully.' },
    settings_password_error: { ar: 'حدث خطأ ما.', fr: 'Une erreur est survenue.', en: 'Something went wrong.' },
    settings_server_error: { ar: 'فشل الاتصال بالسيرفر.', fr: 'Échec de connexion au serveur.', en: 'Failed to connect to server.' },
    settings_delete_error: { ar: 'فشل الحذف. تأكد من كلمة المرور.', fr: 'Échec. Vérifiez le mot de passe.', en: 'Failed. Check your password.' },
    settings_delete_server_error: { ar: 'خطأ في الاتصال بالسيرفر.', fr: 'Erreur de connexion au serveur.', en: 'Server connection error.' },

    // ============ EDIT PROFILE PAGE ============
    edit_profile_title: { ar: 'Aite - تعديل الملف الشخصي', fr: 'Aite - Modifier le profil', en: 'Aite - Edit Profile' },
    edit_profile_heading: { ar: 'تعديل الملف الشخصي', fr: 'Modifier le profil', en: 'Edit Profile' },
    edit_profile_cover: { ar: 'تعديل صورة الغلاف', fr: 'Modifier la couverture', en: 'Edit Cover Photo' },
    edit_profile_change_pic: { ar: 'تغيير صورة البروفايل', fr: 'Changer la photo de profil', en: 'Change Profile Picture' },
    edit_profile_fullname: { ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Full Name' },
    edit_profile_fullname_placeholder: { ar: 'أدخل اسمك الكامل', fr: 'Entrez votre nom complet', en: 'Enter your full name' },
    edit_profile_username: { ar: 'اسم المستخدم (@)', fr: "Nom d'utilisateur (@)", en: 'Username (@)' },
    edit_profile_username_placeholder: { ar: 'أدخل اسم المستخدم', fr: "Entrez le nom d'utilisateur", en: 'Enter username' },
    edit_profile_bio: { ar: 'السيرة الذاتية', fr: 'Bio', en: 'Bio' },
    edit_profile_bio_placeholder: { ar: 'اكتب شيئًا عن نفسك...', fr: 'Écrivez quelque chose sur vous...', en: 'Write something about yourself...' },
    edit_profile_save: { ar: 'حفظ التغييرات', fr: 'Enregistrer', en: 'Save Changes' },
    edit_profile_saving: { ar: 'جاري الحفظ...', fr: 'Enregistrement...', en: 'Saving...' },
    edit_profile_error_fetch: { ar: 'فشل في جلب البيانات الحالية للملف الشخصي.', fr: 'Échec du chargement des données du profil.', en: 'Failed to load profile data.' },
    edit_profile_error_connection: { ar: 'خطأ في الاتصال: تأكد من تشغيل الخادم.', fr: 'Erreur de connexion : vérifiez le serveur.', en: 'Connection error: check server.' },
    edit_profile_error_save: { ar: 'فشل في حفظ التغييرات. تحقق من اسم المستخدم.', fr: "Échec de l'enregistrement. Vérifiez le nom d'utilisateur.", en: 'Failed to save. Check username.' },
    edit_profile_error_server: { ar: 'خطأ في الاتصال بالخادم. لم يتم حفظ التغييرات.', fr: 'Erreur serveur. Modifications non enregistrées.', en: 'Server error. Changes not saved.' },

    // ============ NOTIFICATIONS PAGE ============
    notifications_title: { ar: 'Aite - الإشعارات', fr: 'Aite - Notifications', en: 'Aite - Notifications' },
    notifications_heading: { ar: 'الإشعارات', fr: 'Notifications', en: 'Notifications' },
    notifications_options: { ar: 'خيارات الإشعارات', fr: 'Options de notification', en: 'Notification Options' },
    notifications_mark_all_read: { ar: 'تعيين الكل كمقروء', fr: 'Tout marquer comme lu', en: 'Mark all as read' },
    notifications_delete_all: { ar: 'حذف الكل', fr: 'Tout supprimer', en: 'Delete all' },
    notifications_loading: { ar: 'جاري تحميل الإشعارات...', fr: 'Chargement des notifications...', en: 'Loading notifications...' },
    notifications_empty: { ar: 'لا توجد إشعارات حالياً.', fr: 'Aucune notification pour le moment.', en: 'No notifications yet.' },
    notifications_fetch_error: { ar: 'فشل في جلب الإشعارات.', fr: 'Échec du chargement des notifications.', en: 'Failed to load notifications.' },
    notifications_action_error: { ar: 'فشل الإجراء', fr: "Échec de l'action", en: 'Action failed' },
    notifications_delete_confirm: { ar: 'حذف كل الإشعارات؟', fr: 'Supprimer toutes les notifications ?', en: 'Delete all notifications?' },
    notifications_delete_error: { ar: 'فشل الحذف', fr: 'Échec de la suppression', en: 'Delete failed' },

    // Notification types
    notif_post_like: { ar: 'أعجب بمنشورك', fr: 'a aimé votre publication', en: 'liked your post' },
    notif_post_comment: { ar: 'علّق:', fr: 'a commenté :', en: 'commented:' },
    notif_comment_reply: { ar: 'ردّ على تعليقك:', fr: 'a répondu à votre commentaire :', en: 'replied to your comment:' },
    notif_comment_like: { ar: 'أعجب بتعليقك', fr: 'a aimé votre commentaire', en: 'liked your comment' },
    notif_story_like: { ar: 'تفاعل مع قصتك', fr: 'a réagi à votre story', en: 'reacted to your story' },
    notif_reel_like: { ar: 'أعجب بالريل الخاص بك', fr: 'a aimé votre reel', en: 'liked your reel' },
    notif_reel_comment: { ar: 'علّق على الريل:', fr: 'a commenté le reel :', en: 'commented on reel:' },
    notif_family_post_like: { ar: 'أعجب بمنشورك في العائلة', fr: 'a aimé votre publication familiale', en: 'liked your family post' },
    notif_family_post_comment: { ar: 'علّق في العائلة:', fr: 'a commenté en famille :', en: 'commented in family:' },
    notif_family_comment_like: { ar: 'أعجب بتعليقك العائلي', fr: 'a aimé votre commentaire familial', en: 'liked your family comment' },
    notif_family_comment_reply: { ar: 'رد عليك في العائلة:', fr: 'a répondu en famille :', en: 'replied in family:' },
    notif_friend_request: { ar: 'أرسل لك طلب صداقة', fr: "vous a envoyé une demande d'amitié", en: 'sent you a friend request' },
    notif_friend_accept: { ar: 'أصبح صديقك الآن', fr: 'est maintenant votre ami', en: 'is now your friend' },
    notif_message: { ar: 'أرسل لك رسالة', fr: 'vous a envoyé un message', en: 'sent you a message' },
    notif_message_reaction: { ar: 'تفاعل مع رسالتك', fr: 'a réagi à votre message', en: 'reacted to your message' },
    notif_default: { ar: 'إشعار جديد', fr: 'Nouvelle notification', en: 'New notification' },

    // Notification target hints
    notif_view_post: { ar: 'عرض المنشور', fr: 'Voir la publication', en: 'View post' },
    notif_view_comment: { ar: 'عرض التعليق', fr: 'Voir le commentaire', en: 'View comment' },
    notif_view_reply: { ar: 'عرض الرد', fr: 'Voir la réponse', en: 'View reply' },
    notif_view_stories: { ar: 'عرض القصص', fr: 'Voir les stories', en: 'View stories' },
    notif_watch_reel: { ar: 'مشاهدة الريل', fr: 'Voir le reel', en: 'Watch reel' },
    notif_open_family: { ar: 'فتح العائلة', fr: 'Ouvrir la famille', en: 'Open family' },
    notif_view_requests: { ar: 'عرض الطلبات', fr: 'Voir les demandes', en: 'View requests' },
    notif_visit_profile: { ar: 'زيارة الملف الشخصي', fr: 'Visiter le profil', en: 'Visit profile' },
    notif_open_chat: { ar: 'فتح المحادثة', fr: 'Ouvrir la conversation', en: 'Open chat' },
    notif_view: { ar: 'عرض', fr: 'Voir', en: 'View' },

    // ============ SEARCH PAGE ============
    search_title: { ar: 'بحث Aite', fr: 'Recherche Aite', en: 'Search Aite' },
    search_placeholder: { ar: 'ابحث عن أشخاص، منشورات، ريلز...', fr: 'Rechercher personnes, publications, reels...', en: 'Search people, posts, reels...' },
    search_people: { ar: 'الأشخاص', fr: 'Personnes', en: 'People' },
    search_reels: { ar: 'ريلز', fr: 'Reels', en: 'Reels' },
    search_posts: { ar: 'المنشورات', fr: 'Publications', en: 'Posts' },
    search_type_something: { ar: 'اكتب شيئاً للبحث...', fr: 'Tapez quelque chose pour rechercher...', en: 'Type something to search...' },

    // ============ PROFILE PAGE ============
    profile_title: { ar: 'Aite - الملف الشخصي', fr: 'Aite - Profil', en: 'Aite - Profile' },
    profile_link: { ar: 'الملف الشخصي', fr: 'Profil', en: 'Profile' },
    profile_logout: { ar: 'تسجيل الخروج', fr: 'Déconnexion', en: 'Logout' },
    profile_loading: { ar: 'تحميل...', fr: 'Chargement...', en: 'Loading...' },
    profile_fullname: { ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Full Name' },
    profile_bio_default: { ar: 'السيرة الذاتية...', fr: 'Bio...', en: 'Bio...' },
    profile_edit: { ar: 'تعديل', fr: 'Modifier', en: 'Edit' },
    profile_message: { ar: 'مراسلة', fr: 'Message', en: 'Message' },
    profile_posts_loading: { ar: 'جاري تحميل المنشورات...', fr: 'Chargement des publications...', en: 'Loading posts...' },
    profile_delete_confirm_title: { ar: 'تأكيد الحذف', fr: 'Confirmer la suppression', en: 'Confirm Delete' },
    profile_delete_confirm_msg: { ar: 'هل أنت متأكد أنك تريد حذف هذا المنشور؟ لا يمكن التراجع عن هذا الإجراء.', fr: 'Voulez-vous vraiment supprimer cette publication ? Cette action est irréversible.', en: 'Are you sure you want to delete this post? This action cannot be undone.' },
    profile_cancel: { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel' },
    profile_confirm_delete: { ar: 'تأكيد الحذف', fr: 'Confirmer', en: 'Confirm Delete' },
    profile_delete_post: { ar: 'حذف المنشور', fr: 'Supprimer la publication', en: 'Delete Post' },
    profile_add_friend: { ar: 'إضافة صديق', fr: 'Ajouter un ami', en: 'Add Friend' },
    profile_comments: { ar: 'التعليقات', fr: 'Commentaires', en: 'Comments' },
    profile_add_comment_placeholder: { ar: 'أضف تعليقاً...', fr: 'Ajouter un commentaire...', en: 'Add a comment...' },
    profile_online: { ar: 'متصل الآن', fr: 'En ligne', en: 'Online' },

    // ============ CHAT LIST / HOME PAGE ============
    home_title: { ar: 'Aite - الصفحة الرئيسية', fr: "Aite - Page d'accueil", en: 'Aite - Home' },

    // ============ STORIES PAGE ============
    stories_title: { ar: 'Aite - القصص', fr: 'Aite - Stories', en: 'Aite - Stories' },

    // ============ REELS PAGE ============
    reels_title: { ar: 'Aite - ريلز', fr: 'Aite - Reels', en: 'Aite - Reels' },

    // ============ CREATE POST ============
    create_post_title: { ar: 'Aite - إنشاء منشور', fr: 'Aite - Créer une publication', en: 'Aite - Create Post' },

    // ============ CREATE REEL ============
    create_reel_title: { ar: 'Aite - إنشاء ريل', fr: 'Aite - Créer un reel', en: 'Aite - Create Reel' },

    // ============ CREATE STORY ============
    create_story_title: { ar: 'Aite - إنشاء قصة', fr: 'Aite - Créer une story', en: 'Aite - Create Story' },

    // ============ FAMILIES ============
    families_title: { ar: 'Aite - العائلات', fr: 'Aite - Familles', en: 'Aite - Families' },

    // ============ ADMIN ============
    admin_title: { ar: 'لوحة الإدارة — Aite', fr: 'Administration — Aite', en: 'Admin Panel — Aite' },
    admin_heading: { ar: 'لوحة الإدارة', fr: 'Administration', en: 'Admin Panel' },

    // ============ CHAT PAGE ============
    chat_title: { ar: 'المحادثة', fr: 'Conversation', en: 'Chat' },

    // ============ ALL USERS ============
    all_users_title: { ar: 'Aite - كل المستخدمين وطلبات الصداقة', fr: 'Aite - Utilisateurs et demandes', en: 'Aite - All Users & Requests' },

    // ============ USERS LIST (CHATS) ============
    users_list_title: { ar: 'Aite - المحادثات', fr: 'Aite - Conversations', en: 'Aite - Chats' },

    // ============ POST PAGE ============
    post_title: { ar: 'عرض المنشور', fr: 'Voir la publication', en: 'View Post' },

    // ============ CREATE FAMILY ============
    create_family_title: { ar: 'إنشاء عائلة', fr: 'Créer une famille', en: 'Create Family' },

    // ============ FAMILY PAGE ============
    family_title: { ar: 'Aite - العائلة', fr: 'Aite - Famille', en: 'Aite - Family' },

    // ============ COMMON / SHARED ============
    common_cancel: { ar: 'إلغاء', fr: 'Annuler', en: 'Cancel' },
    common_save: { ar: 'حفظ', fr: 'Enregistrer', en: 'Save' },
    common_delete: { ar: 'حذف', fr: 'Supprimer', en: 'Delete' },
    common_close: { ar: 'إغلاق', fr: 'Fermer', en: 'Close' },
    common_loading: { ar: 'جاري التحميل...', fr: 'Chargement...', en: 'Loading...' },
    common_error: { ar: 'حدث خطأ', fr: 'Une erreur est survenue', en: 'An error occurred' },
    common_success: { ar: 'تمت العملية بنجاح', fr: 'Opération réussie', en: 'Operation successful' },
    common_user: { ar: 'مستخدم', fr: 'Utilisateur', en: 'User' },

    // ============ LANGUAGE NAMES ============
    lang_ar: { ar: 'العربية', fr: 'Arabe', en: 'Arabic' },
    lang_fr: { ar: 'الفرنسية', fr: 'Français', en: 'French' },
    lang_en: { ar: 'الإنجليزية', fr: 'Anglais', en: 'English' },

    // Native language names (shown in switcher)
    lang_ar_native: { ar: 'العربية', fr: 'العربية', en: 'العربية' },
    lang_fr_native: { ar: 'Français', fr: 'Français', en: 'Français' },
    lang_en_native: { ar: 'English', fr: 'English', en: 'English' },
  };

  // ─── Core Functions ───

  function getSavedLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (e) { /* ignore */ }
    return 'ar'; // default Arabic
  }

  function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  }

  function t(key, lang) {
    lang = lang || getSavedLang();
    if (translations[key] && translations[key][lang]) return translations[key][lang];
    if (translations[key] && translations[key]['ar']) return translations[key]['ar'];
    return key;
  }

  function isRTL(lang) {
    return RTL_LANGS.includes(lang || getSavedLang());
  }

  function applyDirection(lang) {
    lang = lang || getSavedLang();
    const rtl = isRTL(lang);
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.body.style.direction = rtl ? 'rtl' : 'ltr';
    document.body.style.textAlign = rtl ? 'right' : 'left';
  }

  function applyTranslations(lang) {
    lang = lang || getSavedLang();

    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key, lang);
      if (val !== key) el.textContent = val;
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key, lang);
      if (val !== key) el.setAttribute('placeholder', val);
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = t(key, lang);
      if (val !== key) el.setAttribute('title', val);
    });

    // Translate page title
    const titleEl = document.querySelector('[data-i18n-page-title]');
    if (titleEl) {
      const key = titleEl.getAttribute('data-i18n-page-title');
      const val = t(key, lang);
      if (val !== key) document.title = val;
    }

    // Update language switcher selects if any
    document.querySelectorAll('.lang-select').forEach(sel => {
      sel.value = lang;
    });
  }

  function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    saveLang(lang);
    applyDirection(lang);
    applyTranslations(lang);

    // Dispatch custom event for page-specific handlers
    window.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
  }

  // ─── Language Switcher HTML Generator ───

  function createLanguageSwitcher(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const lang = getSavedLang();
    container.innerHTML = `
      <div class="flex items-center justify-between w-full p-4 glass-button rounded-xl" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:8px;">
          <i class="fas fa-globe" style="color:#9ca3af;"></i>
          <span data-i18n="settings_language_label" style="color:#e5e7eb;">${t('settings_language_label', lang)}</span>
        </span>
        <select class="lang-select" onchange="window.AiteLang.switchLanguage(this.value)" style="background:rgba(255,255,255,0.08);color:#e5e7eb;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;outline:none;cursor:pointer;font-size:14px;min-width:120px;">
          <option value="ar" ${lang === 'ar' ? 'selected' : ''}>العربية</option>
          <option value="fr" ${lang === 'fr' ? 'selected' : ''}>Français</option>
          <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
    `;
  }

  // Login page compact switcher
  function createLoginLanguageSwitcher(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const lang = getSavedLang();
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0;">
        <i class="fas fa-globe" style="color:#6b7280;font-size:14px;"></i>
        <select class="lang-select" onchange="window.AiteLang.switchLanguage(this.value)" style="background:rgba(255,255,255,0.06);color:#9ca3af;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 10px;outline:none;cursor:pointer;font-size:13px;">
          <option value="ar" ${lang === 'ar' ? 'selected' : ''}>العربية</option>
          <option value="fr" ${lang === 'fr' ? 'selected' : ''}>Français</option>
          <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
    `;
  }

  // ─── Auto-initialize on load ───
  function init() {
    const lang = getSavedLang();
    applyDirection(lang);
    applyTranslations(lang);
  }

  // Run immediately if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API ───
  window.AiteLang = {
    t: t,
    getSavedLang: getSavedLang,
    switchLanguage: switchLanguage,
    applyTranslations: applyTranslations,
    applyDirection: applyDirection,
    createLanguageSwitcher: createLanguageSwitcher,
    createLoginLanguageSwitcher: createLoginLanguageSwitcher,
    isRTL: isRTL,
    translations: translations
  };

})();
