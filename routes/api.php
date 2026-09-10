<?php

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\ChatUserController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\CustomCategoryController;
use App\Http\Controllers\FriendshipController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NbrbController;
use App\Http\Controllers\PinActivityController;
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

Route::middleware(['web', 'auth', 'throttle:120,1'])->group(function () {
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
    Route::get('/pins/{pin}/invites', [\App\Http\Controllers\PinInviteController::class, 'index']);
    Route::post('/pins/{pin}/invites', [\App\Http\Controllers\PinInviteController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/pins/{pin}/invites/{invite}', [\App\Http\Controllers\PinInviteController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/pins/{pin}/comments', [PinCommentController::class, 'index']);
    Route::post('/pins/{pin}/comments', [PinCommentController::class, 'store'])->middleware('throttle:comments-write');
    Route::patch('/comments/{comment}', [PinCommentController::class, 'update']);
    Route::put('/comments/{comment}', [PinCommentController::class, 'update']);
    Route::delete('/comments/{comment}', [PinCommentController::class, 'destroy']);
    Route::post('/reactions/toggle', [ReactionController::class, 'toggle'])->middleware('throttle:reactions');
    Route::get('/pin-activities', [PinActivityController::class, 'index']);
    Route::get('/pin-activities/unread-count', [PinActivityController::class, 'unreadCount']);
    Route::post('/pin-activities/read', [PinActivityController::class, 'read']);
    Route::get('/admin/reports', [ReportController::class, 'index']);
    Route::post('/admin/reports/{report}/resolve', [ReportController::class, 'resolve']);
    Route::apiResource('zone-subscriptions', ZoneSubscriptionController::class)->only(['index','store','destroy']);
    Route::get('/custom-categories', [CustomCategoryController::class, 'index']);
    Route::post('/custom-categories', [CustomCategoryController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/custom-categories/{customCategory}', [CustomCategoryController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/reports', [ReportController::class, 'store'])->middleware('throttle:reports');

    Route::get('/chat/me', [ChatUserController::class, 'me']);
    Route::post('/chat/heartbeat', [ChatUserController::class, 'heartbeat'])->middleware('throttle:chat-signal');
    Route::get('/chat/users/search', [ChatUserController::class, 'search'])->middleware('throttle:chat-search');
    Route::patch('/chat/privacy', [ChatUserController::class, 'privacy']);
    Route::patch('/user/invisible', [\App\Http\Controllers\ProfileController::class, 'toggleInvisible']);
    Route::patch('/user/photo-comments-privacy', [\App\Http\Controllers\ProfilePhotoController::class, 'updatePrivacy']);

    Route::get('/users/{user}/photos', [\App\Http\Controllers\ProfilePhotoController::class, 'index']);
    Route::post('/photos', [\App\Http\Controllers\ProfilePhotoController::class, 'store'])->middleware('throttle:social-write');
    Route::post('/photos/{photo}', [\App\Http\Controllers\ProfilePhotoController::class, 'update'])->middleware('throttle:social-write');
    Route::patch('/photos/{photo}', [\App\Http\Controllers\ProfilePhotoController::class, 'update'])->middleware('throttle:social-write');
    Route::delete('/photos/{photo}', [\App\Http\Controllers\ProfilePhotoController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/photos/{photo}/like', [\App\Http\Controllers\ProfilePhotoController::class, 'toggleLike'])->middleware('throttle:reactions');
    Route::get('/photos/{photo}/comments', [\App\Http\Controllers\ProfilePhotoController::class, 'comments']);
    Route::post('/photos/{photo}/comments', [\App\Http\Controllers\ProfilePhotoController::class, 'storeComment'])->middleware('throttle:comments-write');
    Route::delete('/photo-comments/{comment}', [\App\Http\Controllers\ProfilePhotoController::class, 'destroyComment']);

    Route::get('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'show']);
    Route::put('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'update']);
    Route::delete('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'destroy']);
    Route::post('/user/screen-lock/verify', [\App\Http\Controllers\ScreenLockController::class, 'verify'])->middleware('throttle:screen-lock');

    Route::get('/friendships', [FriendshipController::class, 'index']);    Route::post('/friendships', [FriendshipController::class, 'store'])->middleware('throttle:social-write');
    Route::post('/friendships/{friendship}/accept', [FriendshipController::class, 'accept'])->middleware('throttle:social-write');
    Route::post('/friendships/{friendship}/decline', [FriendshipController::class, 'decline'])->middleware('throttle:social-write');
    Route::delete('/friendships/{friendship}', [FriendshipController::class, 'destroy'])->middleware('throttle:social-write');
    Route::get('/friendships/status/{user}', [FriendshipController::class, 'status']);
    Route::get('/swipes/feed', [SwipeController::class, 'feed']);
    Route::post('/swipes/action', [SwipeController::class, 'act'])->middleware('throttle:social-write');
    Route::get('/swipes/matches', [SwipeController::class, 'matches']);
    Route::get('/swipes/active', [SwipeController::class, 'active']);
    Route::get('/swipes/favorites', [SwipeController::class, 'favorites']);
    Route::delete('/swipes/favorites/{user}', [SwipeController::class, 'removeFavorite'])->middleware('throttle:social-write');
    Route::post('/swipes/reset-history', [SwipeController::class, 'resetHistory']);
    Route::get('/swipes/quota', [SwipeController::class, 'quota']);
    Route::patch('/swipes/settings', [SwipeController::class, 'settings'])->middleware('throttle:profile-write');
    Route::post('/swipes/verify-age', [SwipeController::class, 'verifyAge'])->middleware('throttle:profile-write');
    Route::patch('/friendships/{friendship}/hidden', [FriendshipController::class, 'toggleHidden']);
    Route::get('/users/{user}/friends', [FriendshipController::class, 'publicList']);

    Route::get('/blocks', [UserBlockController::class, 'index']);
    Route::post('/blocks', [UserBlockController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/blocks/{user}', [UserBlockController::class, 'destroy'])->middleware('throttle:social-write');

    Route::get('/subscriptions', [\App\Http\Controllers\UserSubscriptionController::class, 'index']);
    Route::get('/users/{user}/subscription', [\App\Http\Controllers\UserSubscriptionController::class, 'status']);
    Route::post('/users/{user}/subscription', [\App\Http\Controllers\UserSubscriptionController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/users/{user}/subscription', [\App\Http\Controllers\UserSubscriptionController::class, 'destroy'])->middleware('throttle:social-write');

    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store'])->middleware('throttle:social-write');
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead'])->middleware('throttle:chat-signal');
    Route::post('/conversations/{conversation}/delivered', [ConversationController::class, 'markDelivered'])->middleware('throttle:chat-signal');
    Route::delete('/conversations/{conversation}', [ConversationController::class, 'destroy'])->middleware('throttle:social-write');

    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store'])->middleware('throttle:messages-write');
    Route::post('/conversations/{conversation}/typing', [MessageController::class, 'typing'])->middleware('throttle:chat-signal');
    Route::patch('/messages/{message}', [MessageController::class, 'update']);
    Route::delete('/messages/{message}', [MessageController::class, 'destroy']);
    Route::get('/conversations/{conversation}/pinned', [MessageController::class, 'pinned']);
    Route::post('/messages/{message}/pin', [MessageController::class, 'pin'])->middleware('throttle:pin-toggle');
    Route::delete('/messages/{message}/pin', [MessageController::class, 'unpin'])->middleware('throttle:pin-toggle');

    Route::get('/chat/attachments', [\App\Http\Controllers\ChatAttachmentController::class, 'index']);
    Route::delete('/chat/attachments', [\App\Http\Controllers\ChatAttachmentController::class, 'clear'])->middleware('throttle:social-write');
    Route::delete('/chat/attachments/{message}', [\App\Http\Controllers\ChatAttachmentController::class, 'destroy'])->middleware('throttle:social-write');

    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->middleware('throttle:social-write');
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->middleware('throttle:social-write');
    Route::post('/push-subscriptions/test', [PushSubscriptionController::class, 'test'])->middleware('throttle:push-test');

    Route::post('/admin/impersonation/stop', [\App\Http\Controllers\AdminImpersonationController::class, 'stop']);
    Route::get('/security/impersonations', [\App\Http\Controllers\AdminImpersonationController::class, 'myHistory']);
    Route::post('/security/impersonations/read', [\App\Http\Controllers\AdminImpersonationController::class, 'markSeen']);

    Route::get('/updates', [\App\Http\Controllers\AppUpdateController::class, 'index']);
    Route::get('/updates/unread', [\App\Http\Controllers\AppUpdateController::class, 'unread']);
    Route::post('/updates/{appUpdate}/read', [\App\Http\Controllers\AppUpdateController::class, 'markRead']);
    Route::post('/updates/read-all', [\App\Http\Controllers\AppUpdateController::class, 'markAllRead']);
});

Route::middleware(['web', 'auth', 'admin', 'throttle:120,1'])->group(function () {
    Route::get('/admin/updates', [\App\Http\Controllers\AdminAppUpdateController::class, 'index']);
    Route::post('/admin/updates', [\App\Http\Controllers\AdminAppUpdateController::class, 'store']);
    Route::patch('/admin/updates/{appUpdate}', [\App\Http\Controllers\AdminAppUpdateController::class, 'update']);
    Route::delete('/admin/updates/{appUpdate}', [\App\Http\Controllers\AdminAppUpdateController::class, 'destroy']);
    Route::get('/admin/monitoring/overview', [\App\Http\Controllers\AdminMonitoringController::class, 'overview']);
    Route::get('/admin/monitoring/chart', [\App\Http\Controllers\AdminMonitoringController::class, 'chart']);
    Route::get('/admin/monitoring/export', [\App\Http\Controllers\AdminMonitoringController::class, 'export']);
    Route::get('/admin/monitoring/online', [\App\Http\Controllers\AdminMonitoringController::class, 'online']);
    Route::get('/admin/monitoring/users', [\App\Http\Controllers\AdminMonitoringController::class, 'users']);
    Route::get('/admin/users', [AdminUserController::class, 'index']);
    Route::get('/admin/users/search', [AdminUserController::class, 'search']);
    Route::post('/admin/users/{user}/ban', [AdminUserController::class, 'ban']);
    Route::delete('/admin/users/{user}/ban', [AdminUserController::class, 'unban']);
    Route::get('/admin/login-attempts', [\App\Http\Controllers\AdminLoginAttemptController::class, 'index']);
    Route::get('/admin/maintenance', [\App\Http\Controllers\AdminMaintenanceController::class, 'show']);
    Route::put('/admin/maintenance', [\App\Http\Controllers\AdminMaintenanceController::class, 'update']);
    Route::patch('/admin/users/{user}', [AdminUserController::class, 'update']);
    Route::patch('/admin/users/{user}/visibility', [AdminUserController::class, 'updateVisibility']);
    Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
    Route::post('/admin/users/{user}/impersonate', [\App\Http\Controllers\AdminImpersonationController::class, 'impersonate']);
    Route::get('/admin/impersonations', [\App\Http\Controllers\AdminImpersonationController::class, 'index']);
    Route::get('/admin/reference', [\App\Http\Controllers\AdminReferencePageController::class, 'index']);
    Route::post('/admin/reference', [\App\Http\Controllers\AdminReferencePageController::class, 'store']);
    Route::patch('/admin/reference/{referencePage}', [\App\Http\Controllers\AdminReferencePageController::class, 'update']);
    Route::delete('/admin/reference/{referencePage}', [\App\Http\Controllers\AdminReferencePageController::class, 'destroy']);
    Route::post('/admin/reference/{referencePage}/attachments', [\App\Http\Controllers\AdminReferencePageController::class, 'uploadAttachment']);
    Route::delete('/admin/reference/{referencePage}/attachments/{index}', [\App\Http\Controllers\AdminReferencePageController::class, 'destroyAttachment'])->whereNumber('index');
});
