/* ===================================================
   Aite - Internationalization (i18n) System
   Supports: Arabic (ar) + English (en)
   Handles: Text translation, RTL/LTR direction, placeholders
   =================================================== */

(function () {
  'use strict';

  var LANG_KEY = 'aite-lang';

  // ==================== TRANSLATIONS ====================
  var translations = {
    // ---- Common / Shared ----
    'الرئيسية': 'Home',
    'المحادثات': 'Chats',
    'ريلز': 'Reels',
    'الإشعارات': 'Notifications',
    'المستخدمون': 'Users',
    'المستخدمين': 'Users',
    'متجر': 'Store',
    'المتجر': 'Store',
    'الملف الشخصي': 'Profile',
    'الإعدادات': 'Settings',
    'إنشاء': 'Create',
    'منشور': 'Post',
    'قصة': 'Story',
    'البروفيل': 'Profile',
    'المستخدم': 'User',
    'القائمة': 'Menu',
    'تبديل الحساب': 'Switch Account',
    'Aite': 'Aite',

    // ---- Sidebar Menu ----
    'شركة Aite - كل الحقوق محفوظة © 2026': 'Aite Company - All Rights Reserved © 2026',

    // ---- Settings Page ----
    'الإعدادات - Aite': 'Settings - Aite',
    'الحساب': 'Account',
    'تعديل الملف الشخصي': 'Edit Profile',
    'المظهر': 'Appearance',
    'الوضع المظلم': 'Dark Mode',
    'الوضع الفاتح': 'Light Mode',
    'الأمان': 'Security',
    'كلمة المرور الحالية': 'Current Password',
    'كلمة المرور الجديدة': 'New Password',
    'تأكيد كلمة المرور': 'Confirm Password',
    'تحديث كلمة المرور': 'Update Password',
    'تسجيل الخروج': 'Log Out',
    'حذف الحساب': 'Delete Account',
    'تأكيد الخروج': 'Confirm Logout',
    'هل أنت متأكد من رغبتك في تسجيل الخروج؟': 'Are you sure you want to log out?',
    'إلغاء': 'Cancel',
    'خروج': 'Log Out',
    'حذف الحساب نهائياً': 'Delete Account Permanently',
    'سيتم حذف بياناتك من السيرفر وإزالته من هذا الجهاز. أدخل كلمة المرور للتأكيد.': 'Your data will be deleted from the server and removed from this device. Enter your password to confirm.',
    'كلمة المرور': 'Password',
    'اللغة': 'Language',
    'العربية': 'Arabic',
    'الإنجليزية': 'English',

    // ---- Settings JS Messages ----
    'كلمات المرور غير متطابقة.': 'Passwords do not match.',
    'كلمة المرور يجب أن تكون 6 أحرف على الأقل.': 'Password must be at least 6 characters.',
    'جارٍ التحديث...': 'Updating...',
    'تم تغيير كلمة المرور بنجاح.': 'Password changed successfully.',
    'حدث خطأ ما.': 'Something went wrong.',
    'فشل الاتصال بالسيرفر.': 'Failed to connect to server.',
    'جارٍ الحذف...': 'Deleting...',
    'فشل الحذف. تأكد من كلمة المرور.': 'Deletion failed. Check your password.',
    'خطأ في الاتصال بالسيرفر.': 'Error connecting to server.',

    // ---- Login Page ----
    'تسجيل الدخول — Aite': 'Login — Aite',
    'مرحباً بعودتك': 'Welcome back',
    'اسم المستخدم': 'Username',
    'أدخل اسم المستخدم': 'Enter username',
    'دخول': 'Login',
    'نسيت كلمة المرور؟': 'Forgot password?',
    'إنشاء حساب': 'Create Account',
    'تسجيل الدخول': 'Login',

    // ---- Register Page ----
    'إنشاء حساب جديد — Aite': 'Create New Account — Aite',
    'إنشاء حساب جديد': 'Create New Account',
    'الاسم الكامل': 'Full Name',
    'أدخل اسمك الكامل': 'Enter your full name',
    'غلاف': 'Cover',
    'لديك حساب بالفعل؟': 'Already have an account?',

    // ---- Forgot Password ----
    'نسيت كلمة المرور — Aite': 'Forgot Password — Aite',
    'نسيت كلمة المرور': 'Forgot Password',
    'أدخل اسم المستخدم أو بريد الاستعادة لإرسال رابط إعادة التعيين': 'Enter your username or recovery email to send a reset link',
    'اسم المستخدم أو البريد الإلكتروني': 'Username or Email',
    'إرسال رابط إعادة التعيين': 'Send Reset Link',
    'العودة لتسجيل الدخول': 'Back to Login',
    'أدخل اسم المستخدم أو البريد الإلكتروني.': 'Enter your username or email.',
    'جاري الإرسال...': 'Sending...',
    'تم إرسال رابط إعادة التعيين للإيميل المرتبط بالحساب.': 'Reset link sent to the email associated with the account.',
    'تم الإرسال': 'Sent',
    'حدث خطأ.': 'An error occurred.',
    'فشل في الاتصال بالخادم.': 'Failed to connect to server.',

    // ---- Reset Password ----
    'إعادة تعيين كلمة المرور — Aite': 'Reset Password — Aite',
    'إعادة تعيين كلمة المرور': 'Reset Password',
    'أدخل كلمة المرور الجديدة': 'Enter new password',
    'تغيير كلمة المرور': 'Change Password',
    'كلمتا المرور غير متطابقتين.': 'Passwords do not match.',
    'جاري التغيير...': 'Changing...',
    'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.': 'Reset link is invalid or expired.',
    'طلب رابط جديد': 'Request New Link',

    // ---- Accounts Page ----
    'حساباتك — Aite': 'Your Accounts — Aite',
    'اختر حساباً للمتابعة': 'Choose an account to continue',
    'تسجيل الدخول بحساب آخر': 'Login with another account',
    'لا توجد حسابات محفوظة': 'No saved accounts',
    'هل أنت متأكد من إزالة @': 'Are you sure you want to remove @',
    ' من الجهاز؟': ' from this device?',

    // ---- Chat List / Home Page ----
    'Aite - الصفحة الرئيسية': 'Aite - Home',
    'القصص': 'Stories',
    'إضافة قصة': 'Add Story',
    'أضف قصة': 'Add Story',
    'أضف تعليقاً...': 'Add a comment...',
    'أضف تعليقاً على القصة...': 'Comment on story...',
    'أعجبني': 'Like',
    'تعليق': 'Comment',
    'مشاركة': 'Share',
    'التعليقات': 'Comments',
    'لا توجد تعليقات بعد.': 'No comments yet.',
    'لا توجد تعليقات حالياً': 'No comments yet',
    'رد': 'Reply',
    'ردود': 'Replies',
    'إظهار': 'Show',
    'إخفاء الردود': 'Hide Replies',
    'حذف': 'Delete',
    'هل تريد حذف هذا التعليق؟': 'Do you want to delete this comment?',
    'حذف التعليق': 'Delete Comment',
    'هل تريد حذف هذا المنشور؟': 'Do you want to delete this post?',
    'حذف المنشور': 'Delete Post',
    'إبلاغ عن المنشور': 'Report Post',
    'نسخ الرابط': 'Copy Link',
    'تم نسخ الرابط': 'Link copied',
    'تعديل المنشور': 'Edit Post',
    'حفظ': 'Save',
    'تعديل': 'Edit',
    'لا توجد منشورات بعد': 'No posts yet',
    'متابعة': 'Follow',
    'إلغاء المتابعة': 'Unfollow',
    'منذ': 'ago',
    'الآن': 'Just now',
    'ثانية': 'second',
    'ثواني': 'seconds',
    'دقيقة': 'minute',
    'دقائق': 'minutes',
    'ساعة': 'hour',
    'ساعات': 'hours',
    'يوم': 'day',
    'أيام': 'days',
    'شهر': 'month',
    'أشهر': 'months',
    'سنة': 'year',
    'سنوات': 'years',

    // ---- Notifications ----
    'الإشعارات - Aite': 'Notifications - Aite',
    'لا توجد إشعارات': 'No notifications',
    'أعجب بمنشورك': 'liked your post',
    'علق على منشورك': 'commented on your post',
    'أعجب بتعليقك': 'liked your comment',
    'أعجب بردك': 'liked your reply',
    'رد على تعليقك': 'replied to your comment',
    'أرسل لك طلب صداقة': 'sent you a friend request',
    'أصبح صديقك الآن': 'is now your friend',
    'أعجب بالريل الخاص بك': 'liked your reel',
    'علق على الريل الخاص بك': 'commented on your reel',
    'أرسل لك رسالة': 'sent you a message',
    'ذكرك في تعليق': 'mentioned you in a comment',
    'ذكرك في منشور': 'mentioned you in a post',

    // ---- Profile Page ----
    'الملف الشخصي - Aite': 'Profile - Aite',
    'منشورات': 'Posts',
    'أصدقاء': 'Friends',
    'المنشورات': 'Posts',
    'لا توجد منشورات': 'No posts',
    'إضافة صديق': 'Add Friend',
    'أرسل طلب صداقة': 'Send Friend Request',
    'إلغاء الطلب': 'Cancel Request',
    'قبول': 'Accept',
    'رفض': 'Reject',
    'صديق': 'Friend',
    'إزالة الصداقة': 'Remove Friend',
    'حظر': 'Block',
    'إلغاء الحظر': 'Unblock',
    'محظور': 'Blocked',
    'أنت': 'You',
    'أنا': 'Me',
    'متصل': 'Online',
    'غير متصل': 'Offline',
    'آخر ظهور': 'Last seen',

    // ---- Edit Profile ----
    'تعديل الملف الشخصي - Aite': 'Edit Profile - Aite',
    'الاسم': 'Name',
    'النبذة': 'Bio',
    'الولاية': 'State',
    'البلدية': 'Municipality',
    'تاريخ الميلاد': 'Date of Birth',
    'الجنس': 'Gender',
    'ذكر': 'Male',
    'أنثى': 'Female',
    'حفظ التغييرات': 'Save Changes',
    'تم حفظ التغييرات بنجاح': 'Changes saved successfully',
    'جارٍ الحفظ...': 'Saving...',

    // ---- Chat Page ----
    'المحادثة': 'Chat',
    'أرسل رسالة': 'Send a message',
    'إرفاق ملف': 'Attach file',
    'تسجيل صوتي': 'Voice recording',
    'رسالة صوتية': 'Voice message',
    'حذف الرسالة': 'Delete Message',
    'نسخ': 'Copy',
    'رد على': 'Reply to',
    'هل تريد حذف هذه الرسالة؟': 'Do you want to delete this message?',
    'أنت غير متصل بالإنترنت': 'You are offline',
    'إعادة المحاولة': 'Retry',

    // ---- Users List ----
    'قائمة المحادثات - Aite': 'Chat List - Aite',
    'المحادثات الأخيرة': 'Recent Chats',
    'لا توجد محادثات': 'No chats',
    'ابحث...': 'Search...',
    'ابحث عن مستخدم...': 'Search for a user...',

    // ---- All Users ----
    'جميع المستخدمين - Aite': 'All Users - Aite',
    'طلبات الصداقة': 'Friend Requests',
    'جميع المستخدمين': 'All Users',
    'لا توجد طلبات صداقة': 'No friend requests',

    // ---- Search ----
    'البحث - Aite': 'Search - Aite',
    'بحث': 'Search',
    'ابحث عن أشخاص أو منشورات...': 'Search for people or posts...',
    'لم يتم العثور على نتائج': 'No results found',
    'أشخاص': 'People',

    // ---- Create Post ----
    'إنشاء منشور - Aite': 'Create Post - Aite',
    'إنشاء منشور': 'Create Post',
    'اكتب ما يدور في ذهنك...': 'What\'s on your mind...',
    'نشر': 'Post',
    'جارٍ النشر...': 'Posting...',
    'إضافة صور جديدة': 'Add new photos',
    'إضافة المزيد': 'Add more',

    // ---- Create Reel ----
    'إنشاء ريلز - Aite': 'Create Reel - Aite',
    'إنشاء ريلز': 'Create Reel',
    'أضف وصفاً للريلز...': 'Add reel description...',

    // ---- Create Story ----
    'إنشاء قصة - Aite': 'Create Story - Aite',
    'إنشاء قصة': 'Create Story',
    'أضف نصاً على القصة...': 'Add text to story...',
    'أضف موسيقى': 'Add Music',

    // ---- Marketplace ----
    'المتجر - Aite': 'Store - Aite',
    'إضافة منتج': 'Add Product',
    'أضف منتج جديد للبيع من زر ': 'Add a new product for sale from the button ',
    'لا توجد منتجات': 'No products',
    'منتجات': 'Products',

    // ---- Create / Edit Product ----
    'إضافة منتج - Aite': 'Add Product - Aite',
    'تعديل المنتج - Aite': 'Edit Product - Aite',
    'اسم المنتج': 'Product Name',
    'السعر': 'Price',
    'الوصف': 'Description',
    'الفئة': 'Category',
    'إلكترونيات': 'Electronics',
    'ملابس': 'Clothing',
    'أثاث': 'Furniture',
    'سيارات': 'Vehicles',
    'عقارات': 'Real Estate',
    'خدمات': 'Services',
    'أخرى': 'Other',
    'إضافة صور': 'Add Photos',
    'حفظ المنتج': 'Save Product',
    'جارٍ الحفظ': 'Saving',
    'حذف المنتج': 'Delete Product',
    'أضف وصف تفصيلي للمنتج... (الحالة، المواصفات، سبب البيع...)': 'Add detailed product description... (condition, specs, reason for selling...)',

    // ---- Product Detail ----
    'تفاصيل المنتج - Aite': 'Product Detail - Aite',
    'تفاصيل المنتج': 'Product Details',
    'مراسلة البائع': 'Message Seller',
    'تعديل المنتج': 'Edit Product',

    // ---- Reels ----
    'ريلز - Aite': 'Reels - Aite',

    // ---- Stories ----
    'القصص - Aite': 'Stories - Aite',

    // ---- Admin ----
    'لوحة التحكم - Aite': 'Admin Panel - Aite',
    'لوحة التحكم': 'Admin Panel',
    'إجمالي المستخدمين': 'Total Users',
    'إدارة المستخدمين والتحقق': 'User Management & Verification',

    // ---- Google Complete Profile ----
    'أكمل بياناتك لإنشاء حسابك على ': 'Complete your data to create your account on ',

    // ---- PWA / Offline ----
    'تثبيت التطبيق على جهازك': 'Install app on your device',
    'تثبيت': 'Install',
    'إضافة': 'Add',
    'أضف Aite إلى الشاشة الرئيسية': 'Add Aite to Home Screen',
    'تثبيت Aite': 'Install Aite',
    'اتبع الخطوات التالية لتثبيت التطبيق:': 'Follow these steps to install the app:',
    'إعادة المحاولة...': 'Retrying...',
    'إضافة إلى الشاشة الرئيسية': 'Add to Home Screen',

    // ---- Recovery Email Modal ----
    'أضف بريد الاستعادة': 'Add Recovery Email',
    'أضف بريدك الإلكتروني لاستعادة حسابك في حال نسيت كلمة المرور': 'Add your email to recover your account if you forget your password',
    'البريد الإلكتروني': 'Email',
    'أدخل البريد الإلكتروني.': 'Enter your email.',
    'إرسال الطلب': 'Send Request',

    // ---- Misc ----
    'تحميل المزيد': 'Load More',
    'لا يوجد المزيد': 'No more',
    'جارٍ التحميل...': 'Loading...',
    'يتم التحميل...': 'Loading...',
    'إغلاق': 'Close',
    'تأكيد': 'Confirm',
    'نعم': 'Yes',
    'لا': 'No',
    'موافق': 'OK',
    'رجوع': 'Back',
    'التالي': 'Next',
    'إرسال': 'Send',
    'تم': 'Done',
    'خطأ': 'Error',
    'نجاح': 'Success',
    'تحذير': 'Warning',
    'معلومات': 'Info',
    'الكل': 'All',
    'مسح الكل': 'Clear All',

    // ---- Post Options ----
    'خيارات المنشور': 'Post Options',
    'إبلاغ': 'Report',

    // ---- Chat specific ----
    'ألوان الرسائل ': 'Message Colors',
    'يكتب...': 'typing...',
    'متصل الآن': 'Online now',

    // ---- Reels specific ----
    'إزالة الفيديو': 'Remove Video',
    'إضافة نص جديد': 'Add New Text',

    // ---- Likes ----
    'الإعجابات': 'Likes',
    'لا توجد إعجابات': 'No likes',
    'أشخاص أعجبوا': 'People who liked',

    // ---- Time relative ----
    'منذ لحظات': 'moments ago',
    'أمس': 'Yesterday',
    'اليوم': 'Today',

    // ---- Settings language section ----
    'اللغة والاتجاه': 'Language & Direction',
    'عربي': 'Arabic',
    'English': 'English',

    // ---- Create Product ----
    'Aite - بيع منتج': 'Aite - Sell Product',
    'بيع منتج جديد': 'Sell New Product',
    'صور المنتج (حتى 5 صور)': 'Product Photos (up to 5)',
    'اضغط لإضافة صور': 'Click to add photos',
    'اسم المنتج *': 'Product Name *',
    'وصف المنتج': 'Product Description',
    'السعر بالدينار الجزائري (DZD) *': 'Price in Algerian Dinar (DZD) *',
    'د.ج': 'DZD',
    'نشر المنتج': 'Publish Product',

    // ---- Marketplace extra ----
    'ابحث عن منتج...': 'Search for a product...',
    'كل المنتجات': 'All Products',
    'منتجاتي': 'My Products',
    'الطلبات': 'Orders',
    'حذف الطلب': 'Delete Order',
    'هل أنت متأكد من حذف هذا الطلب؟': 'Are you sure you want to delete this order?',
    'لا توجد منتجات بعد': 'No products yet',
    'كن أول من يضيف منتج للبيع!': 'Be the first to add a product for sale!',

    // ---- Product Detail extra ----
    'هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.': 'Are you sure you want to delete this product? This action cannot be undone.',
    'طلب المنتج': 'Order Product',
    'رقم الهاتف': 'Phone Number',
    'إرسال الطلب': 'Send Order',
    'أدخل اسمك الكامل': 'Enter your full name',
    'اختر الولاية': 'Select State',
    'اختر الولاية أولاً': 'Select State first',
    'اختر البلدية': 'Select Municipality',
    'المنتج غير موجود': 'Product not found',

    // ---- More misc ----
    'الحد الأقصى 5 صور': 'Maximum 5 photos',
    'يرجى اختيار ملف صورة': 'Please select an image file',
    'يرجى ملء الحقول المطلوبة': 'Please fill in the required fields',
    'تم نشر المنتج بنجاح!': 'Product published successfully!',
    'جاري النشر...': 'Publishing...',
    'جاري التحميل...': 'Loading...',
    'أدخل كلمة المرور': 'Enter password',

    // ---- Dynamic JS Strings (alerts, textContent, etc.) ----
    'أرسل': 'Send',
    'أكمل بياناتك': 'Complete Your Data',
    'أو': 'or',
    'إجمالي الرسائل': 'Total Messages',
    'إجمالي المنشورات': 'Total Posts',
    'إحصائيات': 'Statistics',
    'إزالة': 'Remove',
    'إزالة أدمن': 'Remove Admin',
    'إنشاء الحساب': 'Create Account',
    'إيقاف': 'Deactivate',
    'اسم المشتري': 'Buyer Name',
    'اضغط لإضافة صورة': 'Click to add photo',
    'اكتب تعليقاً...': 'Write a comment...',
    'اكتب رسالة...': 'Type a message...',
    'الأصدقاء': 'Friends',
    'الانتقال للبروفايل': 'Go to Profile',
    'الدخول بحساب Google': 'Login with Google',
    'العنوان': 'Address',
    'المدة:': 'Duration:',
    'بحث عن مستخدم...': 'Search for user...',
    'تحديث المنتج': 'Update Product',
    'تحقق من اتصالك بالإنترنت': 'Check your internet connection',
    'تسجيل صوت': 'Voice recording',
    'تعذر تحميل المقطع الصوتي.': 'Failed to load audio clip.',
    'تعيين أدمن': 'Set as Admin',
    'تفعيل': 'Activate',
    'تم إرسال الطلب بنجاح!': 'Order sent successfully!',
    'تم إرسال طلب الصداقة.': 'Friend request sent.',
    'تم إلغاء الحظر': 'Unblocked',
    'تم الالتقاط': 'Captured',
    'تم الحذف': 'Deleted',
    'تم الحظر': 'Blocked',
    'تم الرفض': 'Rejected',
    'تم القبول': 'Accepted',
    'تم النسخ': 'Copied',
    'تم تحديث المنتج بنجاح!': 'Product updated successfully!',
    'تم تغيير كلمة المرور بنجاح': 'Password changed successfully',
    'تم نسخ الرابط!': 'Link copied!',
    'جاري إرسال الطلب...': 'Sending order...',
    'جاري الإرسال': 'Sending',
    'جاري الإلغاء...': 'Canceling...',
    'جاري الإنشاء...': 'Creating...',
    'جاري التحديث...': 'Updating...',
    'جاري التسجيل...': 'Recording...',
    'جاري الرفع': 'Uploading',
    'جاري الرفع...': 'Uploading...',
    'جاري الضغط...': 'Compressing...',
    'جاري النشر': 'Publishing',
    'جاري تسجيل الدخول...': 'Logging in...',
    'جاري رفع الصورة': 'Uploading image',
    'جاري رفع الفيديو...': 'Uploading video...',
    'جاري رفع الملف...': 'Uploading file...',
    'جاري رفع صورة البروفايل...': 'Uploading profile picture...',
    'جاري رفع صورة الغلاف...': 'Uploading cover photo...',
    'جاري ضغط الصورة': 'Compressing image',
    'جاهز': 'Ready',
    'حدث خطأ': 'An error occurred',
    'حدث خطأ في الاتصال بالخادم.': 'An error occurred connecting to the server.',
    'حذف كل الإشعارات؟': 'Delete all notifications?',
    'حسابات محظورة': 'Blocked Accounts',
    'حسابات نشطة': 'Active Accounts',
    'حفظ البريد': 'Save Email',
    'خطأ في الاتصال': 'Connection error',
    'خطأ في الاتصال بالخادم. لم يتم حفظ التغييرات.': 'Server connection error. Changes were not saved.',
    'خطأ في الاتصال بالسيرفر': 'Server connection error',
    'خطأ في الاتصال.': 'Connection error.',
    'خطأ في الاتصال: تأكد من تشغيل الخادم.': 'Connection error: Make sure the server is running.',
    'خطأ ميكروفون': 'Microphone error',
    'خيارات': 'Options',
    'رجاءً اختر صورة أو فيديو للقصة!': 'Please select an image or video for the story!',
    'صورة': 'Image',
    'صيغة البريد غير صحيحة.': 'Invalid email format.',
    'طلب صداقة': 'Friend request',
    'عرض أقل': 'Show less',
    'عرض الردود': 'Show Replies',
    'عرض الستوري': 'View Story',
    'عرض المزيد': 'Show more',
    'فشل إرسال الطلب': 'Failed to send order',
    'فشل الإجراء': 'Action failed',
    'فشل الإرسال': 'Failed to send',
    'فشل الاتصال بالسيرفر': 'Failed to connect to server',
    'فشل الاتصال.': 'Connection failed.',
    'فشل الحذف': 'Deletion failed',
    'فشل الحذف: ': 'Deletion failed: ',
    'فشل تحديث المنتج': 'Failed to update product',
    'فشل حذف القصة من السيرفر': 'Failed to delete story from server',
    'فشل في الاتصال': 'Connection failed',
    'فشل في جلب البيانات الحالية للملف الشخصي.': 'Failed to fetch current profile data.',
    'فشل: ': 'Failed: ',
    'فيديو': 'Video',
    'قصتي': 'My Story',
    'كلمة المرور يجب أن تكون 6 أحرف على الأقل': 'Password must be at least 6 characters',
    'لا توجد نتائج': 'No results',
    'لا يوجد اتصال بالإنترنت': 'No internet connection',
    'لديك حساب؟': 'Have an account?',
    'مشاهدات': 'Views',
    'مشاهدة': 'View',
    'ملاحظات': 'Notes',
    'ملاحظات إضافية (اختياري)': 'Additional notes (optional)',
    'نشر المنشور': 'Publish Post',
    'هل أنت متأكد من حذف هذا المنتج؟': 'Are you sure you want to delete this product?',
    'يجب اختيار صورة أو فيديو للقصة!': 'You must select an image or video for the story!',
    'يرجى اختيار فيديو أولاً!': 'Please select a video first!',
    'يرجى ملء جميع الحقول المطلوبة': 'Please fill in all required fields',
  };

  // ==================== CORE FUNCTIONS ====================

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'ar';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  // Build reverse map (en -> ar) once
  var reverseMap = {};
  for (var arText in translations) {
    if (translations.hasOwnProperty(arText)) {
      reverseMap[translations[arText]] = arText;
    }
  }

  /**
   * Translate a single string.
   * If current lang is 'en', look up Arabic -> English.
   * If current lang is 'ar', look up English -> Arabic (reverse).
   */
  function t(text) {
    if (!text || typeof text !== 'string') return text;
    var trimmed = text.trim();
    var lang = getLang();

    if (lang === 'en') {
      // AR -> EN
      if (translations[trimmed] !== undefined) return translations[trimmed];
      return text;
    } else {
      // EN -> AR (reverse)
      if (reverseMap[trimmed] !== undefined) return reverseMap[trimmed];
      return text;
    }
  }

  /**
   * Apply direction and lang attribute to <html>
   */
  function applyDirection() {
    var lang = getLang();
    var html = document.documentElement;
    if (lang === 'en') {
      html.setAttribute('lang', 'en');
      html.setAttribute('dir', 'ltr');
    } else {
      html.setAttribute('lang', 'ar');
      html.setAttribute('dir', 'rtl');
    }
  }

  /**
   * Translate all elements with data-i18n attribute.
   * Also handles data-i18n-placeholder and data-i18n-title.
   */
  function translatePage() {
    applyDirection();

    // Translate elements with data-i18n
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-i18n');
      if (key) {
        var translated = t(key);
        // Check if this is an input/textarea (use value) or regular element (use textContent)
        if (el.tagName === 'INPUT' && el.type !== 'password' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'file') {
          if (el.type === 'submit' || el.type === 'button') {
            el.value = translated;
          }
        } else {
          el.textContent = translated;
        }
      }
    }

    // Translate placeholders
    var phElements = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < phElements.length; j++) {
      var phEl = phElements[j];
      var phKey = phEl.getAttribute('data-i18n-placeholder');
      if (phKey) {
        phEl.setAttribute('placeholder', t(phKey));
      }
    }

    // Translate titles
    var titleElements = document.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < titleElements.length; k++) {
      var titleEl = titleElements[k];
      var titleKey = titleEl.getAttribute('data-i18n-title');
      if (titleKey) {
        titleEl.setAttribute('title', t(titleKey));
      }
    }

    // Translate document title
    var titleTag = document.querySelector('title');
    if (titleTag) {
      var titleText = titleTag.getAttribute('data-i18n');
      if (titleText) {
        document.title = t(titleText);
      }
    }
  }

  /**
   * Switch language and re-translate the page.
   */
  function switchLanguage(lang) {
    setLang(lang);
    translatePage();
    // Dispatch event for other scripts to listen
    window.dispatchEvent(new CustomEvent('aite-lang-changed', { detail: { lang: lang } }));
  }

  // ==================== INITIALIZATION ====================

  // Apply direction immediately (before DOM loads to prevent flash)
  applyDirection();

  // Translate once DOM is ready
  function onReady() {
    translatePage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  // ==================== EXPORTS ====================
  window.AiteI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    switchLanguage: switchLanguage,
    translatePage: translatePage,
    applyDirection: applyDirection,
    translations: translations

    // ---- Additional UI Strings ----
    'إعجابات التعليق': 'Comment Likes',
    'اضغط': 'Tap',
    'اضغط على أيقونة المشاركة': 'Tap the share icon',
    'الصوت': 'Sound',
    'الصور الحالية:': 'Current Images:',
    'تعديل التعليق': 'Edit Comment',
    'جاري الحفظ...': 'Saving...',
    'حدث خطأ أثناء الرفع': 'An error occurred during upload',
    'حذف الريل': 'Delete Reel',
    'حذف نهائي': 'Permanent Delete',
    'خطأ في التحميل': 'Loading error',
    'صوت': 'Voice',
    'صور المنتج': 'Product Images',
    'فشل في تحميل الطلبات.': 'Failed to load requests.',
    'فشل في تحميل المستخدمين.': 'Failed to load users.',
    'فشل في جلب الإشعارات.': 'Failed to fetch notifications.',
    'فشل في جلب الإعجابات': 'Failed to fetch likes',
    'فشل في جلب التعليقات.': 'Failed to fetch comments.',
    'فهمت': 'Got it',
    'في الأعلى': 'at the top',
    'في شريط Safari': 'in the Safari bar',
    'كل المستخدمين': 'All Users',
    'لا توجد إشعارات حالياً.': 'No notifications currently.',
    'لا توجد إعجابات بعد': 'No likes yet',
    'لا توجد ريلز حالياً': 'No reels currently',
    'لا توجد طلبات صداقة واردة.': 'No incoming friend requests.',
    'لا يمكن التراجع عن هذا الإجراء.': 'This action cannot be undone.',
    'لا يوجد مستخدمون آخرون.': 'No other users.',
    'لاحقاً': 'Later',
    'مراسلة': 'Message',
    'معلّقة': 'Pending',
    'مقترحون': 'Suggested',
    'هل أنت متأكد من حذف هذا التعليق؟ لا يمكن التراجع عن هذا الإجراء.': 'Are you sure you want to delete this comment? This action cannot be undone.',
    'هل أنت متأكد من حذف هذا الريل نهائياً؟': 'Are you sure you want to permanently delete this reel?',


    // ---- Pass 3: Remaining UI Strings ----
    '"إضافة إلى الشاشة الرئيسية"': '"Add to Home Screen"',
    '1. اضغط على أيقونة المشاركة ⬆️ في شريط Safari': '1. Tap the share icon ⬆️ in the Safari bar',
    '3-32 حرف: أحرف إنجليزية، أرقام، نقاط، شرطات': '3-32 characters: English letters, numbers, dots, dashes',
    '3. اضغط إضافة في الأعلى': '3. Tap Add at the top',
    'Aite - الإشعارات': 'Aite - Notifications',
    'Aite - القصص': 'Aite - Stories',
    'Aite - المتجر': 'Aite - Marketplace',
    'Aite - المحادثات': 'Aite - Chats',
    'Aite - الملف الشخصي': 'Aite - Profile',
    'Aite - تعديل الملف الشخصي': 'Aite - Edit Profile',
    'Aite - تعديل المنتج': 'Aite - Edit Product',
    'Aite - تفاصيل المنتج': 'Aite - Product Detail',
    'Aite - كل المستخدمين وطلبات الصداقة': 'Aite - All Users and Friend Requests',
    'JPG, PNG, WEBP, GIF وجميع الأنواع': 'JPG, PNG, WEBP, GIF and all types',
    'MP4, MOV — يدعم الملفات الكبيرة': 'MP4, MOV — supports large files',
    'أكمل بياناتك لإنشاء حسابك على Aite': 'Complete your data to create your Aite account',
    'إعجاب': 'Like',
    'إكمال الملف الشخصي': 'Complete Profile',
    'إكمال الملف الشخصي — Aite': 'Complete Profile — Aite',
    'إلى': 'To',
    'إنشاء قصة جديدة - Aite': 'Create New Story - Aite',
    'اختر تفاعل': 'Choose a reaction',
    'اختر صورة': 'Choose Image',
    'اختر صورة أو فيديو': 'Choose image or video',
    'اختر فيديو': 'Choose Video',
    'اسم المستخدم (@)': 'Username (@)',
    'اضغط لاختيار صورة': 'Click to choose image',
    'اضغط لاختيار فيديو': 'Click to choose video',
    'اضغط لاختيار ملف صوتي': 'Click to choose audio file',
    'اكتب شيئاً للبحث...': 'Type something to search...',
    'الأشخاص': 'People',
    'السيرة الذاتية': 'Bio',
    'السيرة الذاتية...': 'Bio...',
    'المدة: 0:30': 'Duration: 0:30',
    'الوسائط الحالية': 'Current Media',
    'بحث Aite': 'Aite Search',
    'تأكيد الحذف': 'Confirm Delete',
    'تحميل...': 'Loading...',
    'تسجيل': 'Record',
    'تعديل الرسالة': 'Edit Message',
    'تعديل صورة الغلاف': 'Edit Cover Photo',
    'تعرّف على أشخاص جدد': 'Meet new people',
    'تغيير': 'Change',
    'تم التعديل': 'Edited',
    'جاري تحميل المعاينة...': 'Loading preview...',
    'جاري تحميل المنشور...': 'Loading post...',
    'حذف القصة؟': 'Delete Story?',
    'حفظ التعديلات': 'Save Changes',
    'دمج': 'Merge',
    'ريل جديد': 'New Reel',
    'ريلز مقترحة': 'Suggested Reels',
    'سجل البحث': 'Search History',
    'سيتم حذف جميع بياناته نهائياً (المنشورات، التعليقات، المحادثات، كل شيء)': 'All data will be permanently deleted (posts, comments, chats, everything)',
    'شارك أفكارك وصورك': 'Share your thoughts and photos',
    'صديق مشترك': 'mutual friend',
    'عرض المنشور': 'View Post',
    'عرض كل النتائج لـ': 'View all results for',
    'غير موثق': 'Not Verified',
    'فيديو قصير': 'Short Video',
    'قصة جديدة': 'New Story',
    'كن أول من يعلق!': 'Be the first to comment!',
    'لا يمكنك مراسلة هذا الحساب': 'You cannot message this account',
    'لقد قام المستخدم بحظرك': 'This user has blocked you',
    'لقد قمت بحظر هذا المستخدم': 'You have blocked this user',
    'لن تتمكن من استعادة هذه القصة بعد حذفها.': 'You won\'t be able to recover this story after deleting it.',
    'لوحة الإدارة': 'Admin Panel',
    'لوحة الإدارة — Aite': 'Admin Panel — Aite',
    'لون الدائرة': 'Circle Color',
    'ماذا تريد أن تنشر؟': 'What do you want to post?',
    'مستخدم': 'User',
    'ملف صوتي': 'Audio File',
    'من': 'From',
    'منشور جديد': 'New Post',
    'موثق': 'Verified',
    'نشر القصة': 'Publish Story',
    'نشر ريل جديد': 'Publish New Reel',
    'نص': 'Text',
    'هل أنت متأكد أنك تريد حذف هذا المنشور؟': 'Are you sure you want to delete this post?',
    'هل أنت متأكد أنك تريد حذف هذا المنشور؟ لا يمكن التراجع عن هذا الإجراء.': 'Are you sure you want to delete this post? This action cannot be undone.',
    'هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء.': 'Are you sure you want to delete this message? This action cannot be undone.',


    // ---- Final Pass Strings ----
    '2. اختر "إضافة إلى الشاشة الرئيسية"': '2. Choose "Add to Home Screen"',

  };

})();
