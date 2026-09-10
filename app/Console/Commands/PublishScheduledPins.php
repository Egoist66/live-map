<?php

namespace App\Console\Commands;

use App\Events\PinCreated;
use App\Models\Pin;
use Illuminate\Console\Command;

class PublishScheduledPins extends Command
{
    protected $signature = 'pins:publish {--limit=100}';
    protected $description = 'Публикует запланированные пины, у которых наступило время (publish_at)';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        $pins = Pin::scheduled()->where('publish_at', '<=', now())->orderBy('publish_at')->limit($limit)->with('user')->get();
        $count = 0;
        foreach ($pins as $pin) {
            $pin->update(['status' => 'active']);
            try {
                broadcast(new PinCreated($pin))->toOthers();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
            }
            try {
                \App\Services\UserSubscriptionNotifier::pinCreated($pin);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('subscription notify failed: '.$e->getMessage());
            }
            $count++;
        }
        $this->info("Published $count scheduled pins");
        return 0;
    }
}
