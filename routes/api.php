<?php

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\ChatUserController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\CustomCategoryController;
use App\Http\Controllers\FriendshipController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NbrbController;
use App\Http\Controllers\PinCommentController;
use App\Http\Controllers\PinController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SwipeController;
use App\Http\Controllers\UserBlockController;
use App\Http\Controllers\VersionController;
use App\Http\Controllers\ZoneSubscriptionController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:60,1')->group(function () {
    Route::get('/version', [VersionController::class, 'show']);
    Route::get('/nbrb/convert', [NbrbController::class, 'convert']);
    Route::get('/nbrb/dynamics/{curId}', [NbrbController::class, 'dynamics'])->whereNumber('curId');
    Route::get('/nbrb/currencies/{curId?}', [NbrbController::class, 'currencies'])->whereNumber('curId');
    Route::get('/nbrb/rates/{code?}', [NbrbController::class, 'rates'])->where('code', '[A-Za-z0-9]+');
});

Route::get('/reference', [\App\Http\Controllers\ReferencePageController::class, 'index']);
Route::get('/reference/{slug}', [\App\Http\Controllers\ReferencePageController::class, 'show']);

// Telegram Mini App (@U1ove_bot): вход по initData — гость (web-сессия),
// статус/отвязка — только залогиненным.
// Статус — ВНЕ общего ведра throttle:60,1: оно общее с version/nbrb
// и считается по IP — за NAT/на Laravel Cloud одиночный статус
// умирал в 429. Отдельное пер-юзер ведро telegram-status (60/мин),
// как у email-status.
// Автовход — тоже НЕ по IP: мобильные операторы прячут сотни абонентов
// за один CGNAT-IP и общее ведро душило легитимных юзеров в 429 «порой».
// Именной лимитер telegram-auth: 30/мин на telegram_id из initData
// + 300/мин страховка на IP от флуда (см. AppServiceProvider).
Route::middleware(['web', 'throttle:telegram-auth'])->post('/telegram/auth', [\App\Http\Controllers\TelegramAuthController::class, 'auth']);
// Вебхук бота: апдейты message/callback_query для нативной панели сеансов.
// Без web/auth — Telegram шлёт без кук; секрет сверяем внутри контроллера.
Route::middleware('throttle:120,1')->post('/telegram/webhook', \App\Http\Controllers\TelegramWebhookController::class);
Route::middleware(['web', 'auth:web,sanctum'])->group(function () {
    Route::get('/telegram/status', [\App\Http\Controllers\TelegramAuthController::class, 'status'])->middleware('throttle:telegram-status');
    Route::patch('/telegram/preferences', [\App\Http\Controllers\TelegramAuthController::class, 'preferences'])->middleware('throttle:telegram-status');
    Route::patch('/telegram/email', [\App\Http\Controllers\TelegramAuthController::class, 'updateEmail'])->middleware('throttle:telegram-status');
    Route::post('/telegram/switch-code', [\App\Http\Controllers\TelegramAuthController::class, 'switchCode'])->middleware('throttle:telegram-status');
    Route::delete('/telegram/link', [\App\Http\Controllers\TelegramAuthController::class, 'unlink'])->middleware('throttle:telegram-status');
});

// Публичная заявка на сотрудничество с лендинга (гость, без авторизации).
Route::middleware(['web', 'throttle:6,1'])->post('/cooperation', [\App\Http\Controllers\CooperationController::class, 'store']);

// Горячие поллеры: тикают каждые 2-4с с каждой вкладки и делят общее ведро
// throttle:120,1 с остальным API — во время звонка сами себя душили в 429
// (sync + signals + show + pending ≈ 90-120/мин на вкладку), сигналинг умирал
// и звонок оставался чёрным. Живут в отдельном ведре throttle:polling (300/мин
// на юзера), именные лимитеры (realtime-sync, video-signal) поверх остаются.
// Порядок важен: ice-servers — до /video/{call}, иначе {call} съест путь.
Route::middleware(['web', 'auth:web,sanctum', 'throttle:polling'])->group(function () {
    Route::get('/realtime/mode', [\App\Http\Controllers\RealtimeController::class, 'mode']);
    Route::get('/realtime/sync', [\App\Http\Controllers\RealtimeController::class, 'sync'])->middleware('throttle:realtime-sync');
    Route::get('/video/ice-servers', [\App\Http\Controllers\VideoController::class, 'iceServers']);
    Route::get('/video/{call}/signals', [\App\Http\Controllers\VideoController::class, 'signals'])->middleware('throttle:video-signal');
    Route::get('/video/{call}', [\App\Http\Controllers\VideoController::class, 'show']);
    Route::get('/video/pending/incoming', [\App\Http\Controllers\VideoController::class, 'pending']);
    Route::get('/video/roulette/stats', [\App\Http\Controllers\VideoController::class, 'rouletteStats']);
});

// Подтверждение почты — ВНЕ общего ведра throttle:120,1: поллеры
// (sync + signals + show + pending ≈ 90-120/мин на вкладку) забивали
// общее ведро и одиночный клик «Подтвердить» умирал в 429.
// Статус — щедро (опрос при монтировании баннера), отправка —
// отдельное ведро email-resend (5 попыток на 5 минут на юзера).
Route::middleware(['web', 'auth:web,sanctum'])->group(function () {
    Route::get('/email/verification-status', [\App\Http\Controllers\EmailVerificationController::class, 'status'])->middleware('throttle:email-status');
    Route::post('/email/verification-notification', [\App\Http\Controllers\EmailVerificationController::class, 'send'])->middleware('throttle:email-resend');
});

// Лёгкие статусные точки (бейджи/история/поллинг вкладок): ВНЕ общего ведра.
// Делили throttle:120,1 с картой/чатом и падали в 429 пачкой по 4-6
// параллельных запросов (badges fetch + focus-рефетч + 2-3 вкладки).
// Отдельное пер-юзер ведро throttle:status-read (600/мин): легитимный
// поллинг проходит, ранэвэй-луп упирается в 10 rps. Писательные лимитеры
// и гостевые остаются жёсткими — DDoS-защита не страдает.
Route::middleware(['web', 'auth:web,sanctum', 'throttle:status-read'])->group(function () {
    Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [\App\Http\Controllers\NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read', [\App\Http\Controllers\NotificationController::class, 'read']);
    Route::get('/security/impersonations', [\App\Http\Controllers\AdminImpersonationController::class, 'myHistory']);
    Route::post('/security/impersonations/read', [\App\Http\Controllers\AdminImpersonationController::class, 'markSeen']);
    Route::get('/updates', [\App\Http\Controllers\AppUpdateController::class, 'index']);
    Route::get('/updates/unread', [\App\Http\Controllers\AppUpdateController::class, 'unread']);
    Route::post('/updates/{appUpdate}/read', [\App\Http\Controllers\AppUpdateController::class, 'markRead']);
    Route::post('/updates/read-all', [\App\Http\Controllers\AppUpdateController::class, 'markAllRead']);
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/chat/me', [ChatUserController::class, 'me']);
    Route::get('/friendships', [FriendshipController::class, 'index']);
    Route::get('/friendships/status/{user}', [FriendshipController::class, 'status']);
    Route::get('/account/status', [\App\Http\Controllers\AccountController::class, 'status']);
    Route::get('/subscription/status', [\App\Http\Controllers\SubscriptionController::class, 'status']);
    Route::get('/swipes/quota', [SwipeController::class, 'quota']);
});

// Остальное API: общее ведро поднято 120 → 300/мин на юзера. Причина та же:
// две вкладки (карта + чат + бейджи) выбирали 120 суммарно и резали даже
// одиночные клики. 300/мин = 5 rps на юзера — ранэвэй-луп всё равно виден,
// писательные именные лимитеры (social-write 60, messages 60 и т.д.)
// поверх остаются и режут спам/флуд как раньше.
Route::middleware(['web', 'auth:web,sanctum', 'throttle:300,1'])->group(function () {
    Route::get('/pins/mine', [PinController::class, 'mine']);
    Route::get('/pins/mine/scheduled', [PinController::class, 'scheduled']);
    Route::get('/pins/mine/archived', [PinController::class, 'archived']);
    Route::get('/pins', [PinController::class, 'index'])->middleware('throttle:pins-index');
    Route::get('/pins/{pin}', [PinController::class, 'show']);
    Route::post('/pins', [PinController::class, 'store'])->middleware('throttle:pins-write');
    Route::patch('/pins/{pin}', [PinController::class, 'update']);
    Route::put('/pins/{pin}', [PinController::class, 'update']);
    Route::delete('/pins/{pin}', [PinController::class, 'destroy']);
    Route::post('/pins/{pin}/boost', [PinController::class, 'boost'])->middleware('throttle:pins-write');
    Route::get('/pins/invited/mine', [\App\Http\Controllers\PinInviteController::class, 'mine']);
    Route::get('/pins/invites/usage', [\App\Http\Controllers\PinInviteController::class, 'usage']);
    Route::get('/pins/{pin}/invites', [\App\Http\Controllers\PinInviteController::class, 'index']);
    Route::post('/pins/{pin}/invites', [\App\Http\Controllers\PinInviteController::class, 'store'])->middleware('throttle:social-write');
    Route::post('/pins/{pin}/invites/accept', [\App\Http\Controllers\PinInviteController::class, 'accept'])->middleware('throttle:social-write');
    Route::post('/pins/{pin}/invites/decline', [\App\Http\Controllers\PinInviteController::class, 'decline'])->middleware('throttle:social-write');
    Route::delete('/pins/{pin}/invites/{invite}', [\App\Http\Controllers\PinInviteController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/pins/{pin}/comments', [PinCommentController::class, 'index']);
    Route::post('/pins/{pin}/comments', [PinCommentController::class, 'store'])->middleware('throttle:comments-write');
    Route::patch('/comments/{comment}', [PinCommentController::class, 'update']);
    Route::put('/comments/{comment}', [PinCommentController::class, 'update']);
    Route::delete('/comments/{comment}', [PinCommentController::class, 'destroy']);
    Route::post('/reactions/toggle', [ReactionController::class, 'toggle'])->middleware('throttle:reactions');
    Route::get('/pins/{pin}/likers', [ReactionController::class, 'likers']);
    Route::get('/flow-posts', [\App\Http\Controllers\FlowPostController::class, 'index']);
    Route::post('/flow-posts', [\App\Http\Controllers\FlowPostController::class, 'store'])->middleware('throttle:social-write');
    Route::get('/flow-posts/{post}', [\App\Http\Controllers\FlowPostController::class, 'show']);
    Route::post('/flow-posts/{post}', [\App\Http\Controllers\FlowPostController::class, 'update'])->middleware('throttle:social-write');
    Route::patch('/flow-posts/{post}', [\App\Http\Controllers\FlowPostController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/flow-posts/{post}', [\App\Http\Controllers\FlowPostController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/flow-posts/{post}/like', [\App\Http\Controllers\FlowPostController::class, 'toggleLike'])->middleware('throttle:reactions');
    Route::post('/flow-posts/{post}/repost', [\App\Http\Controllers\FlowPostController::class, 'repost'])->middleware('throttle:social-write');
    Route::get('/flow-posts/{post}/likers', [\App\Http\Controllers\FlowPostController::class, 'likers']);
    Route::get('/flow-posts/{post}/comments', [\App\Http\Controllers\FlowPostCommentController::class, 'index']);
    Route::post('/flow-posts/{post}/comments', [\App\Http\Controllers\FlowPostCommentController::class, 'store'])->middleware('throttle:comments-write');
    Route::get('/flow-posts/{post}/comments/{comment}/replies', [\App\Http\Controllers\FlowPostCommentController::class, 'replies']);
    Route::post('/flow-polls/{poll}/vote', [\App\Http\Controllers\FlowPollController::class, 'vote'])->middleware('throttle:reactions');
    Route::post('/flow-polls/{poll}/close', [\App\Http\Controllers\FlowPollController::class, 'close'])->middleware('throttle:social-write');
    Route::get('/flow-tags/trending', [\App\Http\Controllers\FlowTagController::class, 'trending']);
    Route::patch('/flow-comments/{comment}', [\App\Http\Controllers\FlowPostCommentController::class, 'update']);
    Route::put('/flow-comments/{comment}', [\App\Http\Controllers\FlowPostCommentController::class, 'update']);
    Route::delete('/flow-comments/{comment}', [\App\Http\Controllers\FlowPostCommentController::class, 'destroy'])->middleware('throttle:social-write');
    Route::delete('/notifications', [\App\Http\Controllers\NotificationController::class, 'clear'])->middleware('throttle:social-write');
    Route::get('/sessions', [\App\Http\Controllers\SessionController::class, 'index']);
    Route::delete('/sessions', [\App\Http\Controllers\SessionController::class, 'destroyOthers'])->middleware('throttle:social-write');
    Route::delete('/sessions/{id}', [\App\Http\Controllers\SessionController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/devices', [\App\Http\Controllers\DeviceController::class, 'index']);
    Route::post('/devices/{device}/trust', [\App\Http\Controllers\DeviceController::class, 'trust'])->middleware('throttle:social-write');
    Route::post('/devices/{device}/terminate', [\App\Http\Controllers\DeviceController::class, 'terminate'])->middleware('throttle:social-write');
    Route::post('/devices/{device}/block', [\App\Http\Controllers\DeviceController::class, 'block'])->middleware('throttle:social-write');
    Route::post('/devices/{device}/unblock', [\App\Http\Controllers\DeviceController::class, 'unblock'])->middleware('throttle:social-write');
    Route::get('/admin/reports', [ReportController::class, 'index']);
    Route::post('/admin/reports/{report}/resolve', [ReportController::class, 'resolve']);
    Route::apiResource('zone-subscriptions', ZoneSubscriptionController::class)->only(['index','store','destroy']);
    Route::get('/districts', [\App\Http\Controllers\DistrictController::class, 'index']);
    Route::post('/districts', [\App\Http\Controllers\DistrictController::class, 'store'])->middleware('throttle:social-write');
    Route::get('/districts/{district}', [\App\Http\Controllers\DistrictController::class, 'show']);
    Route::patch('/districts/{district}', [\App\Http\Controllers\DistrictController::class, 'update'])->middleware('throttle:social-write');
    Route::put('/districts/{district}', [\App\Http\Controllers\DistrictController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/districts/{district}', [\App\Http\Controllers\DistrictController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/districts/{district}/members', [\App\Http\Controllers\DistrictController::class, 'members']);
    Route::post('/districts/{district}/join', [\App\Http\Controllers\DistrictController::class, 'join'])->middleware('throttle:social-write');
    Route::delete('/districts/{district}/leave', [\App\Http\Controllers\DistrictController::class, 'leave'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/invites', [\App\Http\Controllers\DistrictController::class, 'invite'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/invites/accept', [\App\Http\Controllers\DistrictController::class, 'acceptInvite'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/invites/decline', [\App\Http\Controllers\DistrictController::class, 'declineInvite'])->middleware('throttle:social-write');
    Route::delete('/districts/{district}/invites/{user}', [\App\Http\Controllers\DistrictController::class, 'cancelInvite'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/members/{user}/approve', [\App\Http\Controllers\DistrictController::class, 'approve'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/members/{user}/reject', [\App\Http\Controllers\DistrictController::class, 'reject'])->middleware('throttle:social-write');
    Route::delete('/districts/{district}/members/{user}', [\App\Http\Controllers\DistrictController::class, 'kick'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/cover', [\App\Http\Controllers\DistrictController::class, 'uploadCover'])->middleware('throttle:social-write');
    Route::delete('/districts/{district}/cover', [\App\Http\Controllers\DistrictController::class, 'destroyCover'])->middleware('throttle:social-write');
    Route::get('/districts/{district}/posts', [\App\Http\Controllers\DistrictPostController::class, 'index']);
    Route::post('/districts/{district}/posts', [\App\Http\Controllers\DistrictPostController::class, 'store'])->middleware('throttle:social-write');
    Route::patch('/districts/{district}/posts/{post}', [\App\Http\Controllers\DistrictPostController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/districts/{district}/posts/{post}', [\App\Http\Controllers\DistrictPostController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/districts/{district}/posts/{post}/like', [\App\Http\Controllers\DistrictPostController::class, 'toggleLike'])->middleware('throttle:reactions');
    Route::get('/districts/{district}/posts/{post}/comments', [\App\Http\Controllers\DistrictPostCommentController::class, 'index']);
    Route::post('/districts/{district}/posts/{post}/comments', [\App\Http\Controllers\DistrictPostCommentController::class, 'store'])->middleware('throttle:comments-write');
    Route::patch('/districts/{district}/posts/{post}/comments/{comment}', [\App\Http\Controllers\DistrictPostCommentController::class, 'update'])->middleware('throttle:comments-write');
    Route::delete('/districts/{district}/posts/{post}/comments/{comment}', [\App\Http\Controllers\DistrictPostCommentController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/custom-categories', [CustomCategoryController::class, 'index']);
    Route::post('/custom-categories', [CustomCategoryController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/custom-categories/{customCategory}', [CustomCategoryController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/reports', [ReportController::class, 'store'])->middleware('throttle:reports');
    Route::post('/support', [\App\Http\Controllers\SupportController::class, 'store'])->middleware('throttle:support');

    // Текстовый AI-ассистент (OpenRouter, Laravel AI SDK): гид, разбор профиля.
    // Модерация — локальная (ContentModeration + Blasp), отдельного роута нет.
    // Именные лимитеры — в AppServiceProvider, часовой лимит профиля — в AiTextService.
    Route::post('/ai/ask', [\App\Http\Controllers\AiAssistantController::class, 'ask'])->middleware('throttle:ai-guide');
    Route::post('/ai/ask/stream', [\App\Http\Controllers\AiAssistantController::class, 'askStream'])->middleware('throttle:ai-guide');
    Route::post('/ai/profile-analysis', [\App\Http\Controllers\AiAssistantController::class, 'analyze'])->middleware('throttle:ai-profile');
    Route::post('/ai/questionnaire-draft', [\App\Http\Controllers\AiAssistantController::class, 'draftQuestionnaire'])->middleware('throttle:ai-profile');
    Route::get('/ai/conversations', [\App\Http\Controllers\AiAssistantController::class, 'index'])->middleware('throttle:ai-guide');
    Route::get('/ai/conversations/{id}', [\App\Http\Controllers\AiAssistantController::class, 'history'])->middleware('throttle:ai-guide');
    Route::get('/ai/quick-commands', [\App\Http\Controllers\AiAssistantController::class, 'quickCommands'])->middleware('throttle:ai-guide');
    Route::post('/ai/feedback', [\App\Http\Controllers\AiAssistantController::class, 'feedback'])->middleware('throttle:ai-guide');

    Route::post('/chat/heartbeat', [ChatUserController::class, 'heartbeat'])->middleware('throttle:chat-signal');
    Route::post('/chat/offline', [ChatUserController::class, 'offline'])->middleware('throttle:chat-signal');
    Route::get('/chat/users/search', [ChatUserController::class, 'search'])->middleware('throttle:chat-search');
    Route::patch('/chat/privacy', [ChatUserController::class, 'privacy']);
    Route::get('/chat/auto-reply', [ChatUserController::class, 'autoReplyShow']);
    Route::patch('/chat/auto-reply', [ChatUserController::class, 'autoReplyUpdate']);
    Route::patch('/user/invisible', [\App\Http\Controllers\ProfileController::class, 'toggleInvisible']);
    Route::patch('/user/default-mode', [\App\Http\Controllers\ProfileController::class, 'updateDefaultMode'])->middleware('throttle:profile-write');
    Route::patch('/user/modules', [\App\Http\Controllers\ProfileController::class, 'updateAppModules'])->middleware('throttle:profile-write');
    Route::patch('/user/photo-comments-privacy', [\App\Http\Controllers\ProfilePhotoController::class, 'updatePrivacy']);
    Route::patch('/user/flow-comments-privacy', [\App\Http\Controllers\ProfileController::class, 'updateFlowCommentsPrivacy']);
    Route::patch('/user/call-cooldown', [\App\Http\Controllers\ProfileController::class, 'updateCallCooldown']);
    Route::patch('/user/video-calls', [\App\Http\Controllers\ProfileController::class, 'updateVideoCalls']);

    Route::post('/account/hide', [\App\Http\Controllers\AccountController::class, 'hide'])->middleware('throttle:social-write');
    Route::post('/account/show', [\App\Http\Controllers\AccountController::class, 'show'])->middleware('throttle:social-write');
    Route::post('/account/deletion', [\App\Http\Controllers\AccountController::class, 'requestDeletion'])->middleware('throttle:social-write');
    Route::delete('/account/deletion', [\App\Http\Controllers\AccountController::class, 'cancelDeletion'])->middleware('throttle:social-write');

    Route::get('/users/{user}/photos', [\App\Http\Controllers\ProfilePhotoController::class, 'index']);
    Route::post('/users/{user}/view', [\App\Http\Controllers\ProfileStatsController::class, 'trackView'])->middleware('throttle:social-write');
    Route::get('/profile-stats', [\App\Http\Controllers\ProfileStatsController::class, 'index']);
    Route::get('/profile-stats/export', [\App\Http\Controllers\ProfileStatsController::class, 'export']);
    Route::patch('/profile-stats/preferences', [\App\Http\Controllers\ProfileStatsController::class, 'updatePreferences']);
    Route::post('/photos', [\App\Http\Controllers\ProfilePhotoController::class, 'store'])->middleware('throttle:social-write');
    Route::post('/photos/{photo}', [\App\Http\Controllers\ProfilePhotoController::class, 'update'])->middleware('throttle:social-write');
    Route::patch('/photos/{photo}', [\App\Http\Controllers\ProfilePhotoController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/photos/{photo}', [\App\Http\Controllers\ProfilePhotoController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/photos/{photo}/like', [\App\Http\Controllers\ProfilePhotoController::class, 'toggleLike'])->middleware('throttle:reactions');
    Route::post('/photos/{photo}/main', [\App\Http\Controllers\ProfilePhotoController::class, 'makeMain'])->middleware('throttle:social-write');
    Route::get('/photos/{photo}/likers', [\App\Http\Controllers\ProfilePhotoController::class, 'likers']);
    Route::get('/photos/{photo}/comments', [\App\Http\Controllers\ProfilePhotoController::class, 'comments']);
    Route::post('/photos/{photo}/comments', [\App\Http\Controllers\ProfilePhotoController::class, 'storeComment'])->middleware('throttle:comments-write');
    Route::delete('/photo-comments/{comment}', [\App\Http\Controllers\ProfilePhotoController::class, 'destroyComment']);

    Route::get('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'show']);
    Route::put('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'update']);
    Route::delete('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'destroy']);
    Route::post('/user/screen-lock/verify', [\App\Http\Controllers\ScreenLockController::class, 'verify'])->middleware('throttle:screen-lock');

    Route::post('/friendships', [FriendshipController::class, 'store'])->middleware('throttle:social-write');
    Route::post('/friendships/{friendship}/accept', [FriendshipController::class, 'accept'])->middleware('throttle:social-write');
    Route::post('/friendships/{friendship}/decline', [FriendshipController::class, 'decline'])->middleware('throttle:social-write');
    Route::delete('/friendships/{friendship}', [FriendshipController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/swipes/feed', [SwipeController::class, 'feed']);
    Route::post('/swipes/action', [SwipeController::class, 'act'])->middleware('throttle:social-write');
    Route::get('/swipes/matches', [SwipeController::class, 'matches']);
    Route::get('/swipes/active', [SwipeController::class, 'active']);
    Route::get('/swipes/favorites', [SwipeController::class, 'favorites']);
    Route::get('/swipes/admirers', [SwipeController::class, 'admirers']);
    Route::delete('/swipes/favorites/{user}', [SwipeController::class, 'removeFavorite'])->middleware('throttle:social-write');
    Route::post('/swipes/reset-history', [SwipeController::class, 'resetHistory']);
    Route::post('/swipes/undo', [SwipeController::class, 'undo'])->middleware('throttle:social-write');
    Route::post('/swipes/boost', [SwipeController::class, 'boost'])->middleware('throttle:social-write');
    Route::post('/swipes/extras/purchase', [SwipeController::class, 'purchase'])->middleware('throttle:social-write');
    Route::patch('/swipes/settings', [SwipeController::class, 'settings'])->middleware('throttle:profile-write');
    Route::post('/swipes/verify-age', [SwipeController::class, 'verifyAge'])->middleware('throttle:profile-write');
    Route::get('/dating/reviews', [\App\Http\Controllers\DatingReviewController::class, 'index']);
    Route::post('/dating/reviews', [\App\Http\Controllers\DatingReviewController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/dating/reviews', [\App\Http\Controllers\DatingReviewController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/trust/me', [\App\Http\Controllers\TrustController::class, 'me']);
    Route::post('/video/match/call', [\App\Http\Controllers\VideoController::class, 'callMatch'])->middleware('throttle:social-write');
    Route::post('/video/{call}/accept', [\App\Http\Controllers\VideoController::class, 'accept'])->middleware('throttle:social-write');
    Route::post('/video/{call}/decline', [\App\Http\Controllers\VideoController::class, 'decline'])->middleware('throttle:social-write');
    Route::post('/video/{call}/hangup', [\App\Http\Controllers\VideoController::class, 'hangup'])->middleware('throttle:social-write');
    Route::post('/video/{call}/signal', [\App\Http\Controllers\VideoController::class, 'signal'])->middleware('throttle:video-signal');
    Route::post('/video/roulette/join', [\App\Http\Controllers\VideoController::class, 'rouletteJoin'])->middleware('throttle:social-write');
    Route::post('/video/roulette/next', [\App\Http\Controllers\VideoController::class, 'rouletteNext'])->middleware('throttle:social-write');
    Route::post('/video/roulette/leave', [\App\Http\Controllers\VideoController::class, 'rouletteLeave'])->middleware('throttle:social-write');
    Route::patch('/friendships/{friendship}/hidden', [FriendshipController::class, 'toggleHidden']);
    Route::get('/users/{user}/friends', [FriendshipController::class, 'publicList']);

    Route::get('/blocks', [UserBlockController::class, 'index']);
    Route::post('/blocks', [UserBlockController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/blocks/{user}', [UserBlockController::class, 'destroy'])->middleware('throttle:social-write');

    Route::get('/subscriptions', [\App\Http\Controllers\UserSubscriptionController::class, 'index']);
    Route::get('/users/{user}/subscription', [\App\Http\Controllers\UserSubscriptionController::class, 'status']);
    Route::post('/users/{user}/subscription', [\App\Http\Controllers\UserSubscriptionController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/users/{user}/subscription', [\App\Http\Controllers\UserSubscriptionController::class, 'destroy'])->middleware('throttle:social-write');

    Route::post('/conversations', [ConversationController::class, 'store'])->middleware('throttle:social-write');
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead'])->middleware('throttle:chat-signal');
    Route::post('/conversations/{conversation}/delivered', [ConversationController::class, 'markDelivered'])->middleware('throttle:chat-signal');
    Route::match(['patch', 'post'], '/conversations/{conversation}/wallpaper', [ConversationController::class, 'updateWallpaper'])->middleware('throttle:social-write');
    Route::delete('/conversations', [ConversationController::class, 'clearAll'])->middleware('throttle:social-write');
    Route::delete('/conversations/{conversation}', [ConversationController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/conversations/{conversation}/pin', [ConversationController::class, 'pin'])->middleware('throttle:pin-toggle');
    Route::delete('/conversations/{conversation}/pin', [ConversationController::class, 'unpin'])->middleware('throttle:pin-toggle');
    Route::get('/conversations/{conversation}/export', [ConversationController::class, 'exportHtml']);

    Route::post('/conversations/{conversation}/telegram-share', [\App\Http\Controllers\TelegramShareController::class, 'offer'])->middleware('throttle:social-write');
    Route::delete('/conversations/{conversation}/telegram-share', [\App\Http\Controllers\TelegramShareController::class, 'revoke'])->middleware('throttle:social-write');

    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store'])->middleware('throttle:messages-write');
    Route::post('/conversations/{conversation}/typing', [MessageController::class, 'typing'])->middleware('throttle:chat-signal');
    Route::post('/chat/share-post', [\App\Http\Controllers\PostShareController::class, 'store'])->middleware('throttle:social-write');

    Route::patch('/messages/{message}', [MessageController::class, 'update']);
    Route::delete('/messages/{message}', [MessageController::class, 'destroy']);
    Route::post('/messages/bulk-delete', [MessageController::class, 'bulkDestroy'])->middleware('throttle:social-write');
    Route::post('/messages/forward', [MessageController::class, 'forward'])->middleware('throttle:messages-write');
    Route::get('/conversations/{conversation}/pinned', [MessageController::class, 'pinned']);
    Route::post('/messages/{message}/pin', [MessageController::class, 'pin'])->middleware('throttle:pin-toggle');
    Route::delete('/messages/{message}/pin', [MessageController::class, 'unpin'])->middleware('throttle:pin-toggle');

    Route::get('/chat/attachments', [\App\Http\Controllers\ChatAttachmentController::class, 'index']);
    Route::get('/chat/attachments/download-all', [\App\Http\Controllers\ChatAttachmentController::class, 'downloadAll']);
    Route::get('/chat/attachments/{message}/download', [\App\Http\Controllers\ChatAttachmentController::class, 'download']);
    Route::delete('/chat/attachments', [\App\Http\Controllers\ChatAttachmentController::class, 'clear'])->middleware('throttle:social-write');
    Route::delete('/chat/attachments/{message}', [\App\Http\Controllers\ChatAttachmentController::class, 'destroy'])->middleware('throttle:social-write');

    // «Избранное» — личные заметки, чат только для себя (gzip + AES-256-GCM в БД).
    Route::get('/saved-notes/settings', [\App\Http\Controllers\SavedNoteController::class, 'settings']);
    Route::patch('/saved-notes/settings', [\App\Http\Controllers\SavedNoteController::class, 'updateSettings'])->middleware('throttle:social-write');
    Route::get('/saved-notes', [\App\Http\Controllers\SavedNoteController::class, 'index']);
    Route::post('/saved-notes', [\App\Http\Controllers\SavedNoteController::class, 'store'])->middleware('throttle:social-write');
    Route::patch('/saved-notes/{savedNote}', [\App\Http\Controllers\SavedNoteController::class, 'update'])->middleware('throttle:social-write');
    Route::put('/saved-notes/{savedNote}', [\App\Http\Controllers\SavedNoteController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/saved-notes', [\App\Http\Controllers\SavedNoteController::class, 'clear'])->middleware('throttle:social-write');
    Route::delete('/saved-notes/{savedNote}', [\App\Http\Controllers\SavedNoteController::class, 'destroy'])->middleware('throttle:social-write');

    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/push-subscriptions/test', [PushSubscriptionController::class, 'test'])->middleware('throttle:push-test');

    Route::post('/expo-push-tokens', [\App\Http\Controllers\ExpoPushTokenController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/expo-push-tokens', [\App\Http\Controllers\ExpoPushTokenController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/expo-push-tokens/test', [\App\Http\Controllers\ExpoPushTokenController::class, 'test'])->middleware('throttle:push-test');

    Route::post('/admin/impersonation/stop', [\App\Http\Controllers\AdminImpersonationController::class, 'stop']);

    Route::get('/quests', [\App\Http\Controllers\QuestController::class, 'index']);
    Route::post('/quests/refresh', [\App\Http\Controllers\QuestController::class, 'refresh'])->middleware('throttle:social-write');
    Route::post('/quests/claim', [\App\Http\Controllers\QuestController::class, 'claim'])->middleware('throttle:social-write');

    Route::post('/subscription/renew', [\App\Http\Controllers\SubscriptionController::class, 'renew'])->middleware('throttle:social-write');
    Route::post('/subscription/cancel', [\App\Http\Controllers\SubscriptionController::class, 'cancel'])->middleware('throttle:social-write');

    Route::get('/sos/mine', [\App\Http\Controllers\SosController::class, 'mine']);
    Route::get('/pins/{pin}/sos', [\App\Http\Controllers\SosController::class, 'show']);
    Route::post('/pins/{pin}/sos/accept', [\App\Http\Controllers\SosController::class, 'accept'])->middleware('throttle:social-write');
    Route::post('/pins/{pin}/sos/decline', [\App\Http\Controllers\SosController::class, 'decline'])->middleware('throttle:social-write');
    Route::post('/pins/{pin}/sos/close', [\App\Http\Controllers\SosController::class, 'close'])->middleware('throttle:social-write');

    Route::patch('/account-type', [\App\Http\Controllers\AccountTypeController::class, 'update']);
    Route::get('/businesses/map', [\App\Http\Controllers\BusinessController::class, 'map']);
    Route::get('/businesses/search', [\App\Http\Controllers\BusinessController::class, 'search']);
    Route::get('/businesses/{business}/pins', [\App\Http\Controllers\BusinessController::class, 'pins']);
    Route::get('/businesses/{business}/photos', [\App\Http\Controllers\BusinessPhotoController::class, 'index']);
    Route::get('/business-photos/by-owner/{user}', [\App\Http\Controllers\BusinessPhotoController::class, 'byOwner']);
    Route::post('/businesses/{business}/photos', [\App\Http\Controllers\BusinessPhotoController::class, 'store'])->middleware('throttle:social-write');
    Route::post('/businesses/{business}/logo', [\App\Http\Controllers\BusinessController::class, 'logo'])->middleware('throttle:social-write');
    Route::post('/businesses/{business}/cover', [\App\Http\Controllers\BusinessController::class, 'cover'])->middleware('throttle:social-write');
    Route::delete('/businesses/{business}/photos/{photo}', [\App\Http\Controllers\BusinessPhotoController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/business', [\App\Http\Controllers\BusinessController::class, 'show']);
    Route::patch('/business', [\App\Http\Controllers\BusinessController::class, 'update'])->middleware('throttle:profile-write');
    Route::get('/business/dashboard', [\App\Http\Controllers\BusinessController::class, 'dashboard']);
    Route::post('/business/submit', [\App\Http\Controllers\BusinessController::class, 'submit'])->middleware('throttle:social-write');
    Route::get('/businesses/{business}/ads', [\App\Http\Controllers\BusinessAdController::class, 'index']);
    Route::get('/business/ads/quota', [\App\Http\Controllers\BusinessAdController::class, 'quota']);
    Route::get('/business/ads/district-quota', [\App\Http\Controllers\BusinessAdController::class, 'districtQuota']);
    Route::post('/businesses/{business}/ads', [\App\Http\Controllers\BusinessAdController::class, 'store'])->middleware('throttle:social-write');
    Route::patch('/business-ads/{ad}', [\App\Http\Controllers\BusinessAdController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/business-ads/{ad}', [\App\Http\Controllers\BusinessAdController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/business-ads/{ad}/districts', [\App\Http\Controllers\BusinessAdController::class, 'placeInDistricts'])->middleware('throttle:social-write');
});

// Табы модератора: Статистика, Модерация, Справочники, SEO.
// Админ проходит тоже: canModerate() включает админов.
// Действия по отношению к админам модератору запрещены
// внутри контроллеров (AdminUserController).
Route::middleware(['web', 'auth:web,sanctum', 'admin:moderator', 'throttle:300,1'])->group(function () {
    Route::get('/admin/access/status', [\App\Http\Controllers\AdminAccessController::class, 'status']);
    Route::post('/admin/access/code', [\App\Http\Controllers\AdminAccessController::class, 'code'])->middleware('throttle:30,1,admin-access-code');
    Route::post('/admin/access/verify', [\App\Http\Controllers\AdminAccessController::class, 'verify'])->middleware('throttle:30,1,admin-access-verify');
    Route::post('/admin/access/lock', [\App\Http\Controllers\AdminAccessController::class, 'lock']);
    Route::get('/admin/monitoring/overview', [\App\Http\Controllers\AdminMonitoringController::class, 'overview']);
    Route::get('/admin/monitoring/chart', [\App\Http\Controllers\AdminMonitoringController::class, 'chart']);
    Route::get('/admin/monitoring/export', [\App\Http\Controllers\AdminMonitoringController::class, 'export']);
    Route::get('/admin/monitoring/online', [\App\Http\Controllers\AdminMonitoringController::class, 'online']);
    Route::get('/admin/users/search', [AdminUserController::class, 'search']);
    Route::get('/admin/telegram-users', [\App\Http\Controllers\AdminTelegramUserController::class, 'index']);
    Route::patch('/admin/users/{user}/visibility', [AdminUserController::class, 'updateVisibility']);
    Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
    Route::get('/admin/businesses', [\App\Http\Controllers\BusinessController::class, 'adminIndex']);
    Route::post('/admin/business/{business}/verify', [\App\Http\Controllers\BusinessController::class, 'verify']);
    Route::post('/admin/business/{business}/reject', [\App\Http\Controllers\BusinessController::class, 'reject']);
    Route::get('/admin/seo', [\App\Http\Controllers\AdminSeoController::class, 'show']);
    Route::put('/admin/seo/global', [\App\Http\Controllers\AdminSeoController::class, 'updateGlobal']);
    Route::put('/admin/seo/integrations', [\App\Http\Controllers\AdminSeoController::class, 'updateIntegrations']);
    Route::put('/admin/seo/pages', [\App\Http\Controllers\AdminSeoController::class, 'updatePages']);
    Route::put('/admin/seo/robots', [\App\Http\Controllers\AdminSeoController::class, 'updateRobots']);
    Route::put('/admin/seo/sitemap', [\App\Http\Controllers\AdminSeoController::class, 'updateSitemap']);
    Route::get('/admin/reference', [\App\Http\Controllers\AdminReferencePageController::class, 'index']);
    Route::post('/admin/reference', [\App\Http\Controllers\AdminReferencePageController::class, 'store']);
    Route::patch('/admin/reference/{referencePage}', [\App\Http\Controllers\AdminReferencePageController::class, 'update']);
    Route::delete('/admin/reference/{referencePage}', [\App\Http\Controllers\AdminReferencePageController::class, 'destroy']);
    Route::post('/admin/reference/{referencePage}/attachments', [\App\Http\Controllers\AdminReferencePageController::class, 'uploadAttachment']);
    Route::delete('/admin/reference/{referencePage}/attachments/{index}', [\App\Http\Controllers\AdminReferencePageController::class, 'destroyAttachment'])->whereNumber('index');
});

// Только полные админы: Управление, Безопасность, роли/тарифы,
// баны, вход в чужой аккаунт, обновления, maintenance, realtime.
// Верификация бизнеса — в группе модераторов выше (admin:moderator),
// чтобы заявки видели и обрабатывали и модераторы, и админы.
Route::middleware(['web', 'auth:web,sanctum', 'admin', 'throttle:300,1'])->group(function () {
    Route::get('/admin/updates', [\App\Http\Controllers\AdminAppUpdateController::class, 'index']);
    Route::post('/admin/updates', [\App\Http\Controllers\AdminAppUpdateController::class, 'store']);
    Route::patch('/admin/updates/{appUpdate}', [\App\Http\Controllers\AdminAppUpdateController::class, 'update']);
    Route::delete('/admin/updates/{appUpdate}', [\App\Http\Controllers\AdminAppUpdateController::class, 'destroy']);
    Route::get('/admin/monitoring/users', [\App\Http\Controllers\AdminMonitoringController::class, 'users']);
    Route::get('/admin/users', [AdminUserController::class, 'index']);
    Route::post('/admin/users', [AdminUserController::class, 'store'])->middleware('throttle:30,1');
    Route::post('/admin/users/{user}/ban', [AdminUserController::class, 'ban']);
    Route::delete('/admin/users/{user}/ban', [AdminUserController::class, 'unban']);
    Route::get('/admin/login-attempts', [\App\Http\Controllers\AdminLoginAttemptController::class, 'index']);
    Route::post('/admin/login-attempts/seen', [\App\Http\Controllers\AdminLoginAttemptController::class, 'seen']);
    Route::post('/admin/login-attempts/reset', [\App\Http\Controllers\AdminLoginAttemptController::class, 'reset']);
    Route::get('/admin/maintenance', [\App\Http\Controllers\AdminMaintenanceController::class, 'show']);
    Route::put('/admin/maintenance', [\App\Http\Controllers\AdminMaintenanceController::class, 'update']);
    Route::get('/admin/modules', [\App\Http\Controllers\AdminModulesController::class, 'show']);
    Route::put('/admin/modules', [\App\Http\Controllers\AdminModulesController::class, 'update']);
    Route::get('/admin/ai', [\App\Http\Controllers\AdminAiController::class, 'show']);
    Route::put('/admin/ai', [\App\Http\Controllers\AdminAiController::class, 'update']);
    Route::post('/admin/realtime/mode', [\App\Http\Controllers\RealtimeController::class, 'setMode']);
    Route::patch('/admin/users/{user}', [AdminUserController::class, 'update']);
    Route::post('/admin/users/{user}/impersonate', [\App\Http\Controllers\AdminImpersonationController::class, 'impersonate']);
    Route::get('/admin/impersonations', [\App\Http\Controllers\AdminImpersonationController::class, 'index']);
});
