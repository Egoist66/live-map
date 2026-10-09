<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinInvite;
use App\Models\User;
use App\Notifications\PinInviteAcceptedNotification;
use App\Notifications\PinInvitedNotification;
use App\Services\TelegramNotifier;
use App\Services\UserNotifier;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Приглашения посмотреть пин вне зоны/страны.
 *
 * Только автор (или админ) может пригласить. Приглашённый видит
 * пин через show/index даже из другой страны/зоны.
 */
class PinInviteController extends Controller
{
    public function index(Request $request, Pin $pin)
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || (int) $pin->user_id === (int) $user->id, 403);
        $invites = PinInvite::where('pin_id', $pin->id)->with('invitee:id,name,avatar_path')->latest()->limit(100)->get();
        return response()->json($invites);
    }

    public function store(Request $request, Pin $pin)
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || (int) $pin->user_id === (int) $user->id, 403, 'Приглашать может только автор пина.');
        $data = $request->validate(['user_id' => 'required|exists:users,id']);
        $inviteeId = (int) $data['user_id'];
        abort_if($inviteeId === (int) $pin->user_id, 422, 'Нельзя пригласить самого себя.');
        $invitee = User::findOrFail($inviteeId);
        $reason = $user->messageBlockReason($invitee);
        if ($reason && !$user->isAdmin()) {
            abort(403, $reason);
        }
        $alreadyInvited = PinInvite::where('pin_id', $pin->id)
            ->where('invitee_id', $inviteeId)
            ->exists();
        if (!$alreadyInvited && !$user->canInviteToPin()) {
            abort(429, 'Лимит free тарифа: 3 приглашения в пин в месяц. Pro — безлимит.');
        }
        $invite = PinInvite::updateOrCreate(
            ['pin_id' => $pin->id, 'invitee_id' => $inviteeId],
            ['inviter_id' => $user->id, 'status' => 'pending']
        );
        try {
            UserNotifier::send($invitee, new PinInvitedNotification($pin, $user, $inviteeId, (int) $invite->id));
        } catch (\Throwable) {
        }
        try {
            $pinTitle = trim((string) ($pin->title ?? ''));
            $titlePart = $pinTitle !== '' ? ' «'.e(mb_substr($pinTitle, 0, 60)).'»' : '';
            $inviterName = trim((string) ($user->name ?? ''));
            TelegramNotifier::eventPing(
                $invitee,
                'invites',
                '🎫 💘 <b>ULove</b> • <b>'.e($inviterName !== '' ? $inviterName : 'Собеседник').'</b> зовёт в пин'.$titlePart.' — виден вне зоны и страны',
                '/map?pin='.(int) $pin->id,
                'Смотреть пин',
                'pin-invite:'.(int) $invite->id.':'.$inviteeId,
                'pin.invited'
            );
        } catch (\Throwable) {
        }

        return response()->json($invite, 201);
    }

    /**
     * Принять приглашение в пин (только приглашённый).
     *
     * Ставит status=accepted, гасит своё уведомление pin.invited
     * и уведомляет автора пина что приглашение принято.
     */
    public function accept(Request $request, Pin $pin)
    {
        $user = $request->user();
        $invite = PinInvite::where('pin_id', $pin->id)
            ->where('invitee_id', $user->id)
            ->firstOrFail();
        $invite->status = 'accepted';
        $invite->save();
        $this->markInviteNotificationRead((int) $user->id, (int) $pin->id, (int) $user->id);
        $owner = User::find($pin->user_id);
        if ($owner && (int) $owner->id !== (int) $user->id) {
            try {
                UserNotifier::send($owner, new PinInviteAcceptedNotification($pin, $user, (int) $owner->id));
            } catch (\Throwable) {
            }
            try {
                $pinTitle = trim((string) ($pin->title ?? ''));
                $titlePart = $pinTitle !== '' ? ' «'.e(mb_substr($pinTitle, 0, 60)).'»' : '';
                $userName = trim((string) ($user->name ?? ''));
                TelegramNotifier::eventPing(
                    $owner,
                    'invites',
                    '✅ 💘 <b>ULove</b> • <b>'.e($userName !== '' ? $userName : 'Собеседник').'</b> принял(а) приглашение в пин'.$titlePart,
                    '/map?pin='.(int) $pin->id,
                    'Открыть пин',
                    'pin-invite-accepted:'.(int) $pin->id.':'.(int) $user->id,
                    'pin.invite_accepted'
                );
            } catch (\Throwable) {
            }
        }

        return response()->json($invite->fresh());
    }

    /**
     * Отклонить приглашение в пин (только приглашённый).
     *
     * Удаляет приглашение (доступ закрывается) и гасит
     * своё уведомление pin.invited. Автора не спамим.
     */
    public function decline(Request $request, Pin $pin)
    {
        $user = $request->user();
        $invite = PinInvite::where('pin_id', $pin->id)
            ->where('invitee_id', $user->id)
            ->firstOrFail();
        $invite->delete();
        $this->markInviteNotificationRead((int) $user->id, (int) $pin->id, (int) $user->id);

        return response()->json(['ok' => true]);
    }

    /**
     * Пометить прочитанным уведомление о приглашении.
     *
     * @param int $userId приглашённый
     * @param int $pinId пин
     * @param int $inviteeId приглашённый (часть dedupe-ключа)
     */
    private function markInviteNotificationRead(int $userId, int $pinId, int $inviteeId): void
    {
        try {
            DatabaseNotification::where('notifiable_id', $userId)
                ->where('type', 'pin.invited')
                ->where('key', 'pin-invite:'.$pinId.':'.$inviteeId)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        } catch (\Throwable) {
        }
    }

    public function destroy(Request $request, Pin $pin, PinInvite $invite)
    {
        $user = $request->user();
        abort_if((int) $invite->pin_id !== (int) $pin->id, 404);
        $isOwner = $user->isAdmin() || (int) $pin->user_id === (int) $user->id;
        $isInvitee = (int) $invite->invitee_id === (int) $user->id;
        abort_unless($isOwner || $isInvitee, 403);
        $invite->delete();
        return response()->json(['ok' => true]);
    }

    public function mine(Request $request)
    {
        $user = $request->user();
        $invites = PinInvite::where('invitee_id', $user->id)->with('pin.user:id,name,avatar_path,level')->latest()->limit(100)->get();
        $pins = $invites->map(fn($i) => $i->pin)->filter()->values();
        $visible = $pins->filter(function ($p) use ($user) {
            if ($p->status !== 'active') return false;
            if ($p->expires_at && $p->expires_at->isPast()) return false;
            return $p->isVisibleForGender($user);
        })->values();
        return response()->json($visible->map(fn($p) => $p->toPublicArray($user->id, true)));
    }

    /**
     * Остаток месячного лимита приглашений.
     *
     * Free — 3 в месяц, pro/premium/business/admin — безлимит.
     */
    public function usage(Request $request)
    {
        $user = $request->user();
        $unlimited = $user->isModerator() || in_array($user->effectivePlan(), User::PAID_PLANS, true);
        $limit = $unlimited ? null : User::FREE_PIN_INVITES_MONTH_LIMIT;
        $used = $unlimited ? 0 : $user->pinInvitesUsedThisMonth();
        $remaining = $unlimited ? null : max(0, $limit - $used);

        return response()->json([
            'used' => $used,
            'limit' => $limit,
            'remaining' => $remaining,
            'unlimited' => $unlimited,
        ]);
    }
}
