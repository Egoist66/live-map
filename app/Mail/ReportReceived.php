<?php

namespace App\Mail;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReportReceived extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Report $report) {}

    public function envelope(): Envelope
    {
        $reasons = Report::reasons();
        $reason = $reasons[$this->report->reason] ?? $this->report->reason;
        return new Envelope(
            subject: "🚨 Жалоба #{$this->report->id}: {$this->report->target_type} #{$this->report->target_id} — {$reason}",
        );
    }

    public function content(): Content
    {
        $this->report->loadMissing(['reporter:id,name,email']);
        return new Content(
            view: 'emails.report-received',
            with: [
                'report' => $this->report,
                'reasons' => Report::reasons(),
            ],
        );
    }
}
