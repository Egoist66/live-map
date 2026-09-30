<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('pins:publish')->everyMinute();
Schedule::command('pins:prune')->everyFiveMinutes();
Schedule::command('plans:downgrade-expired')->daily();
Schedule::command('chat:prune-attachments')->daily();
Schedule::command('video:prune-calls')->daily();
Schedule::command('rewards:weekly-recap')->weeklyOn(1, '9:00');
Schedule::command('users:prune-pending-deletion')->dailyAt('04:30');
