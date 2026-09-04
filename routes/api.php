<?php

use App\Http\Controllers\ChatUserController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\FriendshipController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PinCommentController;
use App\Http\Controllers\PinController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UserBlockController;
use App\Http\Controllers\ZoneSubscriptionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/pins/mine', [PinController::class, 'mine']);
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
    Route::apiResource('zone-subscriptions', ZoneSubscriptionController::class)->only(['index','store','destroy']);
    Route::post('/reports', [ReportController::class, 'store']);

    Route::get('/chat/me', [ChatUserController::class, 'me']);
    Route::post('/chat/heartbeat', [ChatUserController::class, 'heartbeat']);
    Route::get('/chat/users/search', [ChatUserController::class, 'search']);
    Route::patch('/chat/privacy', [ChatUserController::class, 'privacy']);
    Route::patch('/user/invisible', [\App\Http\Controllers\ProfileController::class, 'toggleInvisible']);

    Route::get('/friendships', [FriendshipController::class, 'index']);
    Route::post('/friendships', [FriendshipController::class, 'store']);
    Route::post('/friendships/{friendship}/accept', [FriendshipController::class, 'accept']);
    Route::post('/friendships/{friendship}/decline', [FriendshipController::class, 'decline']);
    Route::delete('/friendships/{friendship}', [FriendshipController::class, 'destroy']);
    Route::get('/friendships/status/{user}', [FriendshipController::class, 'status']);

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
});
