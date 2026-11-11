<?php

use App\Http\Controllers\PipePageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Мини-сайт Pipes (pipe.ulove.by)
|--------------------------------------------------------------------------
|
| Threads-подобные короткие посты про отношения и встречи. Роуты живут
| под доменом config('pipe.domain') и используют стандартный web-стек:
| сессии общие с ulove.by при SESSION_DOMAIN=.ulove.by, так что
| залогиненный пользователь главного сайта сразу «внутри» Pipes.
|
| Локальная разработка без hosts-записи (PIPE_DOMAIN не задан в .env):
| те же экшены отвечают по пути /pipe главного приложения —
|   http://localhost:8000/pipe, /pipe/thread/1, /pipe/author/2
| поэтому route('pipe.show') локально метает в localhost, а не
| в недоступный pipe.ulove.by:8000.
|
*/

$pipePages = function (): void {
    Route::get('/', [PipePageController::class, 'index'])->name('index');
    Route::get('/thread/{thread}', [PipePageController::class, 'show'])
        ->whereNumber('thread')
        ->name('show');
    Route::get('/author/{user}', [PipePageController::class, 'profile'])
        ->whereNumber('user')
        ->name('profile');
};

$pipeDomain = (string) config('pipe.domain', '');

if ($pipeDomain !== '') {
    Route::domain($pipeDomain)->name('pipe.')->group($pipePages);
    return;
}

if (app()->environment('local')) {
    Route::prefix('pipe')->name('pipe.')->group($pipePages);
}
