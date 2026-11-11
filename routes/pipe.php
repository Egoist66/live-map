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
| Путь /pipe доступен ВСЕГДА и на любом хосте (ulove.by, localhost,
| dev-домены) — можно открыть ленту напрямую из основного приложения.
| Дополнительно, когда задан PIPE_DOMAIN, те же экшены отвечают на
| отдельном домене pipe.ulove.by.
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
}

// Путь-версия: всегда доступна (ulove.by/pipe, localhost/pipe).
// Имена pipe.path.* не конфликтуют с pipe.* (домен) — route('pipe.*')
// при заданном PIPE_DOMAIN продолжает метать в домен мини-сайта.
Route::prefix('pipe')->name('pipe.path.')->group($pipePages);
