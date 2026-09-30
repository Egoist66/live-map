<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserBlock;
use App\Models\Friendship;
use Illuminate\Http\Request;

class ChatUserController extends Controller
{
    public function search(Request $request)
    {
        $q = trim($request->input('q',''));
        abort_if(strlen($q)<2,422,'Минимум 2 символа');
        $me=$request->user();
        $perPage = max(1, min(30, (int) $request->input('per_page', 20)));
        $blocked = $me->isAdmin() ? collect() : UserBlock::where('blocker_id',$me->id)->pluck('blocked_id')->merge(UserBlock::where('blocked_id',$me->id)->pluck('blocker_id'))->unique();
        $base = User::where('id','!=',$me->id)
            ->whereNotIn('id',$blocked)
            ->whereNotIn('id', User::hiddenFromSearchFor($me))
            ->where(fn($qq)=>$qq->where('name','like',"%$q%")->orWhere('email','like',"%$q%"));
        $page = $base->select('id','name','profile_slug','avatar_path','message_privacy','allow_random_messages','last_seen_at','is_invisible','plan','role','is_admin','account_type')
            ->orderBy('name')
            ->paginate($perPage);
        $users = $page->getCollection();
        $ids = $users->pluck('id')->all();
        $orgBusinesses = [];
        try {
            $orgBusinesses = \App\Models\Business::whereIn('user_id', $ids ?: [0])
                ->orderByDesc('id')
                ->get()
                ->keyBy('user_id');
        } catch (\Throwable) {
            $orgBusinesses = collect();
        }
        $friendships = Friendship::where(function($q) use ($me,$ids){
                $q->where('requester_id',$me->id)->whereIn('addressee_id',$ids);
            })->orWhere(function($q) use ($me,$ids){
                $q->where('addressee_id',$me->id)->whereIn('requester_id',$ids);
            })->get()->keyBy(fn($f)=> $f->requester_id===$me->id ? $f->addressee_id : $f->requester_id);
        $rows = $users->map(function($u) use ($me, $friendships, $orgBusinesses){
                $isBusiness = ($u->account_type ?? 'person') === 'business';
                $businessRow = $isBusiness ? ($orgBusinesses[$u->id] ?? null) : null;
                $business = null;

                if ($isBusiness) {
                    $business = $businessRow ? [
                        'legal_form' => (string) ($businessRow->legal_form ?? 'ooo'),
                        'is_organization' => $businessRow->isOrganization(),
                        'is_verified' => $businessRow->isVerified(),
                        'verification_status' => (string) ($businessRow->verification_status ?? 'draft'),
                        'name' => (string) ($businessRow->name ?? $u->name ?? ''),
                    ] : [
                        'legal_form' => 'ooo',
                        'is_organization' => true,
                        'is_verified' => false,
                        'verification_status' => 'draft',
                        'name' => (string) ($u->name ?? ''),
                    ];
                }

                return [
                    'id'=>$u->id,
                    'name'=>$u->name,
                    'profile_slug'=>$u->profile_slug,
                    'avatar_path'=>$u->avatar_path,
                    'avatar_url'=>$u->avatar_url,
                    'account_type'=>$u->account_type ?? 'person',
                    'is_business'=>$isBusiness,
                    'is_organization'=>(bool) ($business['is_organization'] ?? false),
                    'business'=>$business,
                    'can_message'=>$me->canMessageUser($u),
                    'can_message_reason'=>$me->messageBlockReason($u),
                    'message_privacy'=>$u->message_privacy,
                    'allow_random_messages'=>$u->allow_random_messages,
                    'last_seen_at'=>$u->isInvisibleActive() && !$me->isAdmin() ? null : $u->last_seen_at?->toISOString(),
                    'is_invisible'=>$u->isInvisibleActive(),
                    'is_friend'=>($friendships[$u->id]?->status ?? null)==='accepted',
                    'is_pending'=>($friendships[$u->id]?->status ?? null)==='pending',
                    'friendship_outgoing'=>($friendships[$u->id]?->status ?? null)==='pending' ? ($friendships[$u->id]->requester_id===$me->id) : null,
                ];
            })->values();
        return response()->json([
            'data' => $rows,
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    public function heartbeat(Request $request)
    {
        if ($request->user()->isInvisibleActive()) {
            return response()->json(['ok' => true, 'invisible' => true]);
        }
        $request->user()->forceFill(['last_seen_at' => now()])->saveQuietly();
        return response()->json(['ok' => true]);
    }

    /**
     * Пометить пользователя отошедшим при закрытии Mini App.
     *
     * Фронт шлёт сюда keepalive-beacon на pagehide/скрытие вкладки:
     * last_seen_at сдвигаем за порог User::isAway (3 мин), чтобы
     * TelegramNotifier сразу слал дубли в бота, а не ждал пока
     * порог истечёт сам. UpdateLastSeen этот путь пропускает и
     * кэш last_seen обновляем здесь же, иначе мидлварь затёрла бы
     * метку свежим now().
     *
     * @param Request $request запрос от владельца сессии
     * @return \Illuminate\Http\JsonResponse
     */
    public function offline(Request $request)
    {
        $user = $request->user();

        if ($user->isInvisibleActive()) {
            return response()->json(['ok' => true, 'invisible' => true]);
        }

        $user->forceFill(['last_seen_at' => now()->subMinutes(5)])->saveQuietly();

        try {
            \Illuminate\Support\Facades\Cache::put('last_seen:'.$user->id, true, 120);
        } catch (\Throwable) {
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Сохранение приватности чата — только дропдаун message_privacy.
     *
     * @param Request $request запрос с message_privacy (everyone|friends|none)
     * @return \Illuminate\Http\JsonResponse
     */
    public function privacy(Request $request)
    {
        $request->validate(['message_privacy' => 'required|in:everyone,friends,none', 'allow_random_messages' => 'sometimes|boolean']);
        $user = $request->user();
        $user->message_privacy = $request->input('message_privacy');
        if ($request->has('allow_random_messages')) {
            $user->allow_random_messages = (bool) $request->input('allow_random_messages');
        }
        $user->save();
        return response()->json($user->only(['message_privacy', 'allow_random_messages', 'photo_comments_privacy']));
    }

    public function me(Request $request)
    {
        $u=$request->user();
        return response()->json([
            'id'=>$u->id,
            'name'=>$u->name,
            'avatar_path'=>$u->avatar_path,
            'avatar_url'=>$u->avatar_url,
            'message_privacy'=>$u->message_privacy,
            'allow_random_messages'=>$u->allow_random_messages,
            'dating_match_only'=>(bool) $u->dating_match_only,
            'auto_reply_enabled'=>(bool) $u->auto_reply_enabled,
            'auto_reply_text'=>$u->auto_reply_text,
            'unread_count'=>$u->unreadMessagesCount(),
            'last_seen_at'=>$u->last_seen_at?->toISOString(),
            'is_invisible'=>$u->isInvisibleActive(),
            'can_use_invisible'=>$u->canUseInvisible(),
        ]);
    }

    /**
     * Текущие настройки автоответа «меня нет онлайн».
     *
     * @param Request $request запрос
     * @return \Illuminate\Http\JsonResponse
     */
    public function autoReplyShow(Request $request)
    {
        $u = $request->user();

        return response()->json([
            'enabled' => (bool) $u->auto_reply_enabled,
            'text' => $u->auto_reply_text,
            'default_text' => \App\Models\User::AUTO_REPLY_DEFAULT,
            'has_email' => trim((string) $u->email) !== '',
        ]);
    }

    /**
     * Сохранить настройки автоответа.
     *
     * @param Request $request запрос с enabled и необязательным text
     * @return \Illuminate\Http\JsonResponse
     */
    public function autoReplyUpdate(Request $request)
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
            'text' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $user->auto_reply_enabled = (bool) $data['enabled'];

        $custom = trim((string) ($data['text'] ?? ''));

        $user->auto_reply_text = $custom !== '' ? mb_substr($custom, 0, 500) : null;
        $user->save();

        return response()->json([
            'enabled' => (bool) $user->auto_reply_enabled,
            'text' => $user->auto_reply_text,
            'default_text' => \App\Models\User::AUTO_REPLY_DEFAULT,
            'has_email' => trim((string) $user->email) !== '',
        ]);
    }
}
