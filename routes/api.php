<?php

use App\Http\Controllers\PinCommentController;
use App\Http\Controllers\PinController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\ReportController;
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
});
