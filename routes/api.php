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
use App\Http\Controllers\UserBlockController;
use App\Http\Controllers\ZoneSubscriptionController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:60,1')->group(function () {
    Route::get('/nbrb/convert', [NbrbController::class, 'convert']);
    Route::get('/nbrb/dynamics/{curId}', [NbrbController::class, 'dynamics'])->whereNumber('curId');
    Route::get('/nbrb/currencies/{curId?}', [NbrbController::class, 'currencies'])->whereNumber('curId');
    Route::get('/nbrb/rates/{code?}', [NbrbController::class, 'rates'])->where('code', '[A-Za-z0-9]+');
});

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/pins/mine', [PinController::class, 'mine']);
    Route::get('/pins/mine/scheduled', [PinController::class, 'scheduled']);
    Route::get('/pins/mine/archived', [PinController::class, 'archived']);
    Route::get('/pins', [PinController::class, 'index']);
    Route::post('/pins', [PinController::class, 'store']);
    Route::patch('/pins/{pin}', [PinController::class, 'update']);
    Route::put('/pins/{pin}', [PinController::class, 'update']);
    Route::delete('/pins/{pin}', [PinController::class, 'destroy']);
    Route::post('/pins/{pin}/boost', [PinController::class, 'boost']);
    Route::get('/pins/{pin}/comments', [PinCommentController::class, 'index']);
    Route::post('/pins/{pin}/comments', [PinCommentController::class, 'store']);
    Route::patch('/comments/{comment}', [PinCommentController::class, 'update']);
    Route::put('/comments/{comment}', [PinCommentController::class, 'update']);
    Route::delete('/comments/{comment}', [PinCommentController::class, 'destroy']);
    Route::post('/reactions/toggle', [ReactionController::class, 'toggle']);
    Route::get('/pin-activities', [PinActivityController::class, 'index']);
    Route::get('/pin-activities/unread-count', [PinActivityController::class, 'unreadCount']);
    Route::post('/pin-activities/read', [PinActivityController::class, 'read']);
    Route::get('/admin/reports', [ReportController::class, 'index']);
    Route::post('/admin/reports/{report}/resolve', [ReportController::class, 'resolve']);
    Route::apiResource('zone-subscriptions', ZoneSubscriptionController::class)->only(['index','store','destroy']);
    Route::get('/custom-categories', [CustomCategoryController::class, 'index']);
    Route::post('/custom-categories', [CustomCategoryController::class, 'store']);
    Route::delete('/custom-categories/{customCategory}', [CustomCategoryController::class, 'destroy']);
    Route::post('/reports', [ReportController::class, 'store']);

    Route::get('/chat/me', [ChatUserController::class, 'me']);
    Route::post('/chat/heartbeat', [ChatUserController::class, 'heartbeat']);
    Route::get('/chat/users/search', [ChatUserController::class, 'search']);
    Route::patch('/chat/privacy', [ChatUserController::class, 'privacy']);
    Route::patch('/user/invisible', [\App\Http\Controllers\ProfileController::class, 'toggleInvisible']);

    Route::get('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'show']);
    Route::put('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'update']);
    Route::delete('/user/screen-lock', [\App\Http\Controllers\ScreenLockController::class, 'destroy']);
    Route::post('/user/screen-lock/verify', [\App\Http\Controllers\ScreenLockController::class, 'verify'])->middleware('throttle:30,1');

    Route::get('/friendships', [FriendshipController::class, 'index']);
    Route::post('/friendships', [FriendshipController::class, 'store']);
    Route::post('/friendships/{friendship}/accept', [FriendshipController::class, 'accept']);
    Route::post('/friendships/{friendship}/decline', [FriendshipController::class, 'decline']);
    Route::delete('/friendships/{friendship}', [FriendshipController::class, 'destroy']);
    Route::get('/friendships/status/{user}', [FriendshipController::class, 'status']);
    Route::patch('/friendships/{friendship}/hidden', [FriendshipController::class, 'toggleHidden']);
    Route::get('/users/{user}/friends', [FriendshipController::class, 'publicList']);

    Route::get('/blocks', [UserBlockController::class, 'index']);
    Route::post('/blocks', [UserBlockController::class, 'store']);
    Route::delete('/blocks/{user}', [UserBlockController::class, 'destroy']);

    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store']);
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead']);
    Route::post('/conversations/{conversation}/delivered', [ConversationController::class, 'markDelivered']);
    Route::delete('/conversations/{conversation}', [ConversationController::class, 'destroy']);

    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store']);
    Route::post('/conversations/{conversation}/typing', [MessageController::class, 'typing']);
    Route::patch('/messages/{message}', [MessageController::class, 'update']);
    Route::delete('/messages/{message}', [MessageController::class, 'destroy']);

    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store']);
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy']);
    Route::post('/push-subscriptions/test', [PushSubscriptionController::class, 'test']);
});

Route::middleware(['web', 'auth', 'admin'])->group(function () {
    Route::get('/admin/users/search', [AdminUserController::class, 'search']);
    Route::patch('/admin/users/{user}/visibility', [AdminUserController::class, 'updateVisibility']);
    Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
});
