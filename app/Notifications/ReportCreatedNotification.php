<?php

namespace App\Notifications;

use App\Models\Report;

/**
 * Новая жалоба (администраторам).
 */
class ReportCreatedNotification extends UserNotification
{
    public function __construct(private Report $report) {}

    public function type(): string { return 'report.created'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'report:'.$this->report->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'report' => $this->report->toNotifyArray(),
        ];
    }

    public function pushPayload(): ?array
    {
        $reasons = Report::reasons();
        $reason = $reasons[$this->report->reason] ?? $this->report->reason;
        $title = $this->report->targetTitle();

        return [
            'title' => "Жалоба #{$this->report->id}: {$reason}",
            'body' => ($title ? "«{$title}»" : "{$this->report->target_type} #{$this->report->target_id}").($this->report->description ? " — {$this->report->description}" : ''),
            'url' => '/settings?tab=admin',
            'tag' => 'report-'.$this->report->id,
            'avatar' => null,
        ];
    }
}
