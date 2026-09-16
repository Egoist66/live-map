<?php

namespace App\Http\Controllers;

use App\Events\DistrictCreated;
use App\Events\DistrictDeleted;
use App\Events\DistrictUpdated;
use App\Models\Conversation;
use App\Models\District;
use App\Models\DistrictMember;
use App\Models\Message;
use App\Models\User;
use App\Notifications\DistrictInvitedNotification;
use App\Notifications\DistrictInviteAcceptedNotification;
use App\Notifications\DistrictJoinRequestedNotification;
use App\Notifications\DistrictRequestApprovedNotification;
use App\Services\ContentModeration;
use App\Services\DistrictService;
use App\Services\ImageOptimizer;
use App\Services\UserNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * UDistrict: свои районы-заливки внутри домашней зоны.
 *
 * Районы видят все, пины внутри — только участники.
 * Доступ — по заявкам с одобрением владельца, у каждого
 * района свой общий чат (conversation type=district).
 *
  * Web-методы page* отдают страницы (Inertia), API-методы —
 * JSON для карты и живых обновлений.
 */
class DistrictController extends Controller
{
    /**
     * Страница списка районов: свои + витрина.
     *
     * Сам список догружается API (/api/districts), здесь только
     * лимиты тарифа для кнопки создания.
     *
     * @param Request $request текущий запрос
     * @return Response Inertia-страница Districts/Index
     */
    public function pageIndex(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Districts/Index', [
            'canCreate' => $user->canCreateDistrict(),
            'limitText' => $this->limitText($user),
        ]);
    }

    /**
     * Страница создания района из заливки кисти.
     *
     * Геометрия не едет в SSR — тяжёлая, лежит в sessionStorage
     * черновиком с карты (useDistrictDraft). Здесь только лимиты.
     *
     * @param Request $request текущий запрос
     * @return Response Inertia-страница Districts/Create
     */
    public function pageCreate(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Districts/Create', [
            'canCreate' => $user->canCreateDistrict(),
            'limitText' => $this->limitText($user),
        ]);
    }

    /**
     * Страница района в духе группы: обложка, аватары, табы.
     *
     * SSR отдаёт начальную карточку (без мигания), живые правки
     * приезжают API + realtime-шиной на фронте.
     *
     * @param Request $request текущий запрос
     * @param District $district район из route-model binding
     * @return Response Inertia-страница Districts/Show
     */
    public function pageShow(Request $request, District $district): Response
    {
        $viewerId = $request->user()?->id;
        $district->load('owner:id,name,avatar_path');

        return Inertia::render('Districts/Show', [
            'districtId' => (int) $district->id,
            'initialDistrict' => $this->detailsArray($district, $viewerId),
        ]);
    }

    /**
     * Текст лимита районов для кнопки создания.
     *
     * @param User $user кто смотрит
     * @return string понятная строка лимита
     */
    private function limitText(User $user): string
    {
        $limit = $user->districtsLimit();

        if ($limit === null) {
            return 'Без лимита районов';
        }

        $used = $user->districts()->count();

        return "Ваши районы: {$used} из {$limit}";
    }

    /**
     * Районы в видимом прямоугольнике карты.
     */
    public function index(Request $request)
    {
        $viewerId = $request->user()?->id;

        $query = District::with('owner:id,name,avatar_path')->withCount('approvedMembers')->latest()->limit(200);

        if ($request->boolean('mine')) {
            $ownedIds = $request->user()->districts()->pluck('districts.id');
            $memberIds = $request->user()->districtMemberships()->where('status', DistrictMember::STATUS_APPROVED)->pluck('district_id');
            $query->whereIn('id', $ownedIds->merge($memberIds)->unique()->values()->all() ?: [0]);
        } elseif ($request->filled(['min_lat', 'max_lat', 'min_lng', 'max_lng'])) {
            $minLat = (float) $request->input('min_lat');
            $maxLat = (float) $request->input('max_lat');
            $minLng = (float) $request->input('min_lng');
            $maxLng = (float) $request->input('max_lng');
            $query->whereBetween('center_lat', [min($minLat, $maxLat), max($minLat, $maxLat)]);
            $query->whereBetween('center_lng', [min($minLng, $maxLng), max($minLng, $maxLng)]);
        }

        $districts = $query->get();

        return response()->json($districts->map(fn (District $district) => $district->toPublicArray($viewerId))->values());
    }

    /**
     * Создать район из заливки кисти.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canCreateDistrict(), 429, 'Лимит районов: Free — 2, Pro — 5, Business — 15. Удалите лишний или смените тариф.');

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:500',
            'interest' => 'sometimes|string|in:' . implode(',', District::INTERESTS),
            'geometry' => 'required|array',
            'user_lat' => 'sometimes|nullable|numeric|between:-90,90',
            'user_lng' => 'sometimes|nullable|numeric|between:-180,180',
        ]);

        ContentModeration::assertClean($data['name'] ?? null, $data['description'] ?? null);

        $liveLat = isset($data['user_lat']) ? (float) $data['user_lat'] : null;
        $liveLng = isset($data['user_lng']) ? (float) $data['user_lng'] : null;
        $normalized = DistrictService::normalizeGeometry($user, $data['geometry'], $liveLat, $liveLng);

        $district = DB::transaction(function () use ($user, $data, $normalized) {
            $locked = User::whereKey($user->id)->lockForUpdate()->first();
            abort_unless($locked->canCreateDistrict(), 429, 'Лимит районов: Free — 2, Pro — 5, Business — 15. Удалите лишний или смените тариф.');

            $created = District::create([
                'user_id' => $user->id,
                'name' => trim($data['name']),
                'description' => isset($data['description']) ? trim($data['description']) : null,
                'interest' => $data['interest'] ?? 'neighbors',
                'geometry' => $normalized['geometry'],
                'center_lat' => $normalized['center_lat'],
                'center_lng' => $normalized['center_lng'],
            ]);
            $this->ensureChat($created);

            return $created;
        });

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictCreated($district))->toOthers();

        return response()->json($this->detailsArray($district, $user->id), 201);
    }

    /**
     * Подробная карточка: кто тут, что делают, пины (участникам).
     */
    public function show(Request $request, District $district)
    {
        $viewerId = $request->user()?->id;

        return response()->json($this->detailsArray($district, $viewerId));
    }

    /**
     * Править название/описание/интерес/заливку (только владелец).
     */
    public function update(Request $request, District $district)
    {
        $user = $request->user();
        abort_unless((int) $district->user_id === (int) $user->id || $user->isAdmin(), 403);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:80',
            'description' => 'nullable|string|max:500',
            'interest' => 'sometimes|string|in:' . implode(',', District::INTERESTS),
            'geometry' => 'sometimes|required|array',
            'user_lat' => 'sometimes|nullable|numeric|between:-90,90',
            'user_lng' => 'sometimes|nullable|numeric|between:-180,180',
        ]);

        ContentModeration::assertClean($data['name'] ?? null, $data['description'] ?? null);

        if (isset($data['name'])) {
            $district->name = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $district->description = $data['description'] !== null ? trim($data['description']) : null;
        }
        if (isset($data['interest'])) {
            $district->interest = $data['interest'];
        }
        if (isset($data['geometry'])) {
            $liveLat = isset($data['user_lat']) ? (float) $data['user_lat'] : null;
            $liveLng = isset($data['user_lng']) ? (float) $data['user_lng'] : null;
            $normalized = DistrictService::normalizeGeometry($district->owner ?? $user, $data['geometry'], $liveLat, $liveLng);
            $district->geometry = $normalized['geometry'];
            $district->center_lat = $normalized['center_lat'];
            $district->center_lng = $normalized['center_lng'];
        }
        $district->save();
        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json($this->detailsArray($district, $user->id));
    }

    /**
     * Удалить район вместе с его чатом (только владелец).
     */
    public function destroy(Request $request, District $district)
    {
        $user = $request->user();
        abort_unless((int) $district->user_id === (int) $user->id || $user->isAdmin(), 403);

        $districtId = (int) $district->id;
        $conversation = $district->conversation;
        $coverPath = $district->cover_path;
        $district->delete();
        if ($coverPath) {
            try {
                Storage::disk(District::coverDisk())->delete($coverPath);
            } catch (\Throwable) {
            }
        }
        if ($conversation) {
            $conversation->delete();
        }
        broadcast(new DistrictDeleted($districtId))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Поставить общую обложку района (только владелец).
     *
     * Обложка одна на всех жителей и гостей, в отличие от фона чата.
     *
     * @param Request $request текущий запрос
     * @param District $district район
     * @return \Illuminate\Http\JsonResponse обновлённая карточка
     */
    public function uploadCover(Request $request, District $district)
    {
        $this->assertOwner($request->user(), $district);

        $request->validate([
            'cover' => 'required|image|max:10240',
        ]);

        $path = ImageOptimizer::storeOptimized(
            $request->file('cover'),
            'district-covers',
            District::coverDisk(),
            ['maxSide' => 1920]
        );

        $old = $district->cover_path;

        $district->forceFill(['cover_path' => $path])->save();

        if ($old && $old !== $path) {
            try {
                Storage::disk(District::coverDisk())->delete($old);
            } catch (\Throwable) {
            }
        }

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json($this->detailsArray($district, $request->user()?->id));
    }

    /**
     * Убрать общую обложку района (только владелец).
     *
     * @param Request $request текущий запрос
     * @param District $district район
     * @return \Illuminate\Http\JsonResponse обновлённая карточка
     */
    public function destroyCover(Request $request, District $district)
    {
        $this->assertOwner($request->user(), $district);

        $old = $district->cover_path;

        $district->forceFill(['cover_path' => null])->save();

        if ($old) {
            try {
                Storage::disk(District::coverDisk())->delete($old);
            } catch (\Throwable) {
            }
        }

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json($this->detailsArray($district, $request->user()?->id));
    }

    /**
     * Кинуть заявку в район.
     */
    public function join(Request $request, District $district)
    {
        $user = $request->user();
        $role = $district->roleOf($user->id);
        abort_if($role === 'owner', 422, 'Это ваш район — заявки не нужны.');
        abort_if($role === 'member', 422, 'Вы уже живёте в этом районе.');
        abort_if($role === 'pending', 422, 'Заявка уже отправлена — дождитесь решения владельца.');
        abort_if($role === 'invited', 422, 'Вас уже пригласили — примите приглашение или отклоните его.');

        $member = DistrictMember::create([
            'district_id' => $district->id,
            'user_id' => $user->id,
            'status' => DistrictMember::STATUS_PENDING,
        ]);

        $owner = $district->owner;
        if ($owner) {
            UserNotifier::send($owner, new DistrictJoinRequestedNotification($district, $user));
        }
        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true, 'status' => $member->status, 'role' => 'pending'], 201);
    }

    /**
     * Пригласить в район (только владелец): именно приглашение, не авто-вход.
     *
     * Приглашённый сам решает кнопками «Принять / Отклонить» в уведомлениях
     * или карточке района. До принятия в жители и чат не добавляем, пины
     * района ему закрыты. Так зовут тех, кто район на карте даже не видит.
     */
    public function invite(Request $request, District $district)
    {
        $this->assertOwner($request->user(), $district);

        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $inviter = $request->user();
        $inviteeId = (int) $data['user_id'];
        abort_if($inviteeId === (int) $district->user_id, 422, 'Это ваш район — приглашать себя не нужно.');

        $invitee = User::findOrFail($inviteeId);
        $reason = $inviter->messageBlockReason($invitee);
        if ($reason && ! $inviter->isAdmin()) {
            abort(403, $reason);
        }

        $existing = $district->members()->where('user_id', $inviteeId)->first();
        if ($existing && $existing->status === DistrictMember::STATUS_APPROVED) {
            abort(422, 'Уже живёт в этом районе.');
        }
        if ($existing && $existing->status === DistrictMember::STATUS_INVITED) {
            abort(422, 'Приглашение уже отправлено — ждите ответа.');
        }
        if ($existing && $existing->status === DistrictMember::STATUS_PENDING) {
            abort(422, 'Человек сам кинул заявку — одобрите её во вкладке «Заявки».');
        }

        if ($existing) {
            $existing->status = DistrictMember::STATUS_INVITED;
            $existing->save();
        } else {
            DistrictMember::create([
                'district_id' => $district->id,
                'user_id' => $inviteeId,
                'status' => DistrictMember::STATUS_INVITED,
            ]);
        }

        UserNotifier::send($invitee, new DistrictInvitedNotification($district->fresh(), $inviter));

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true, 'status' => DistrictMember::STATUS_INVITED], 201);
    }

    /**
     * Принять приглашение в район (только приглашённый).
     *
     * Ставит approved, открывает пины и общий чат, гасит своё
     * уведомление district.invited и сообщает владельцу о новом жителе.
     */
    public function acceptInvite(Request $request, District $district)
    {
        $user = $request->user();
        $member = $district->members()
            ->where('user_id', $user->id)
            ->where('status', DistrictMember::STATUS_INVITED)
            ->firstOrFail();
        $member->status = DistrictMember::STATUS_APPROVED;
        $member->save();

        $conversation = $this->ensureChat($district);
        $conversation->participantRows()->updateOrCreate(
            ['user_id' => $user->id],
            ['joined_at' => now(), 'hidden_at' => null]
        );
        $this->systemMessage($conversation, '🎉 ' . ($user->name ?? 'Новый житель') . ' вступил(а) в район по приглашению.');
        $this->markInviteNotificationRead((int) $user->id, (int) $district->id);

        $owner = $district->owner;
        if ($owner && (int) $owner->id !== (int) $user->id) {
            UserNotifier::send($owner, new DistrictInviteAcceptedNotification($district->fresh(), $user));
        }

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true, 'status' => DistrictMember::STATUS_APPROVED, 'role' => 'member']);
    }

    /**
     * Отклонить приглашение в район (только приглашённый).
     *
     * Тихо удаляет приглашение и гасит уведомление. Владельца не спамим.
     */
    public function declineInvite(Request $request, District $district)
    {
        $user = $request->user();
        $member = $district->members()
            ->where('user_id', $user->id)
            ->where('status', DistrictMember::STATUS_INVITED)
            ->firstOrFail();
        $member->delete();
        $this->markInviteNotificationRead((int) $user->id, (int) $district->id);

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Отозвать приглашение (только владелец): приглашённый его больше не увидит.
     */
    public function cancelInvite(Request $request, District $district, User $user)
    {
        $this->assertOwner($request->user(), $district);

        $member = $district->members()
            ->where('user_id', $user->id)
            ->where('status', DistrictMember::STATUS_INVITED)
            ->firstOrFail();
        $member->delete();
        $this->markInviteNotificationRead((int) $user->id, (int) $district->id);

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Пометить прочитанным уведомление о приглашении в район.
     *
     * @param int $userId приглашённый
     * @param int $districtId район
     */
    private function markInviteNotificationRead(int $userId, int $districtId): void
    {
        try {
            \Illuminate\Notifications\DatabaseNotification::where('notifiable_id', $userId)
                ->where('type', 'district.invited')
                ->where('key', 'district-invite:'.$districtId)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        } catch (\Throwable) {
        }
    }

    /**
     * Одобрить заявку (только владелец): житель + чат + уведомление.
     */
    public function approve(Request $request, District $district, User $user)
    {
        $this->assertOwner($request->user(), $district);

        $member = $district->members()->where('user_id', $user->id)->firstOrFail();
        abort_if($member->status === DistrictMember::STATUS_APPROVED, 422, 'Уже одобрено.');
        $member->status = DistrictMember::STATUS_APPROVED;
        $member->save();

        $conversation = $this->ensureChat($district);
        $conversation->participantRows()->updateOrCreate(
            ['user_id' => $user->id],
            ['joined_at' => now(), 'hidden_at' => null]
        );
        $this->systemMessage($conversation, '🎉 ' . ($user->name ?? 'Новый житель') . ' вступил(а) в район.');
        UserNotifier::send($user, new DistrictRequestApprovedNotification($district->fresh()));

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true, 'status' => $member->status]);
    }

    /**
     * Отклонить заявку (только владелец).
     */
    public function reject(Request $request, District $district, User $user)
    {
        $this->assertOwner($request->user(), $district);

        $member = $district->members()->where('user_id', $user->id)->firstOrFail();
        abort_if($member->status === DistrictMember::STATUS_APPROVED, 422, 'Жителя нельзя отклонить — сначала исключите его.');
        $member->delete();
        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Исключить жителя (только владелец).
     */
    public function kick(Request $request, District $district, User $user)
    {
        $this->assertOwner($request->user(), $district);
        abort_if((int) $user->id === (int) $district->user_id, 422, 'Владельца исключить нельзя.');

        $member = $district->members()->where('user_id', $user->id)->where('status', DistrictMember::STATUS_APPROVED)->firstOrFail();
        $member->delete();

        $conversation = $this->ensureChat($district);
        $conversation->participantRows()->where('user_id', $user->id)->delete();
        $this->systemMessage($conversation, '🚪 ' . ($user->name ?? 'Житель') . ' покинул(а) район.');

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Выйти из района / отозвать свою заявку.
     */
    public function leave(Request $request, District $district)
    {
        $user = $request->user();
        abort_if((int) $district->user_id === (int) $user->id, 422, 'Владелец не может выйти — район можно только удалить.');

        $member = $district->members()->where('user_id', $user->id)->firstOrFail();
        $wasMember = $member->status === DistrictMember::STATUS_APPROVED;
        $member->delete();

        if ($wasMember && $district->conversation) {
            $district->conversation->participantRows()->where('user_id', $user->id)->delete();
            $this->systemMessage($district->conversation, '🚪 ' . ($user->name ?? 'Житель') . ' покинул(а) район.');
        }

        $district->load('owner:id,name,avatar_path');
        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Жители, заявки и исходящие приглашения (заявки и приглашения — только владельцу).
     */
    public function members(Request $request, District $district)
    {
        $viewer = $request->user();
        $role = $district->roleOf($viewer?->id);

        $approved = $district->approvedMembers()->with('user:id,name,avatar_path')->get();
        $residents = $approved->map(fn (DistrictMember $member) => [
            'id' => $member->user->id,
            'name' => $member->user->name,
            'avatar_url' => $member->user->avatar_url,
            'since' => $member->created_at?->toISOString(),
        ])->values();
        if ($district->owner) {
            $residents->prepend([
                'id' => $district->owner->id,
                'name' => $district->owner->name,
                'avatar_url' => $district->owner->avatar_url,
                'since' => $district->created_at?->toISOString(),
                'is_owner' => true,
            ]);
        }

        $pending = [];
        $invited = [];
        if ($role === 'owner') {
            $pending = $district->pendingMembers()->with('user:id,name,avatar_path')->get()->map(fn (DistrictMember $member) => [
                'id' => $member->user->id,
                'name' => $member->user->name,
                'avatar_url' => $member->user->avatar_url,
                'since' => $member->created_at?->toISOString(),
            ])->values();
            $invited = $district->invitedMembers()->with('user:id,name,avatar_path')->get()->map(fn (DistrictMember $member) => [
                'id' => $member->user->id,
                'name' => $member->user->name,
                'avatar_url' => $member->user->avatar_url,
                'since' => $member->created_at?->toISOString(),
            ])->values();
        }

        return response()->json(['residents' => $residents, 'pending' => $pending, 'invited' => $invited, 'role' => $role]);
    }

    /**
     * Полная карточка для диалога деталей.
     *
     * @param District $district район
     * @param int|null $viewerId кто смотрит
     * @return array<string,mixed>
     */
    private function detailsArray(District $district, ?int $viewerId): array
    {
        $role = $district->roleOf($viewerId);
        $canSeeInside = in_array($role, ['owner', 'member'], true) || ($viewerId && User::whereKey($viewerId)->first()?->isAdmin());
        $base = $district->toPublicArray($viewerId);

        $base['description'] = $district->description;
        if ($canSeeInside && $viewerId) {
            $base['pins'] = DistrictService::pinsInside($district, $viewerId);
            $base['pins_locked'] = false;
        } else {
            $base['pins'] = [];
            $base['pins_locked'] = true;
        }
        $base['pins_count'] = $canSeeInside && $viewerId
            ? count($base['pins'])
            : DistrictService::pinsCount($district);

        return $base;
    }

    /**
     * @param User $user проверяемый
     * @param District $district район
     */
    private function assertOwner(User $user, District $district): void
    {
        abort_unless((int) $district->user_id === (int) $user->id || $user->isAdmin(), 403, 'Только владелец района решает, кого пускать.');
    }

    /**
     * Общий чат района: один на район, создаётся лениво.
     *
     * @param District $district район
     * @return Conversation чат района
     */
    private function ensureChat(District $district): Conversation
    {
        $existing = $district->conversation_id
            ? Conversation::find($district->conversation_id)
            : Conversation::where('type', 'district')->where('district_id', $district->id)->first();
        if ($existing) {
            if ((int) $district->conversation_id !== (int) $existing->id) {
                $district->forceFill(['conversation_id' => $existing->id])->save();
            }

            return $existing;
        }

        $conversation = Conversation::create([
            'type' => 'district',
            'district_id' => $district->id,
            'created_by' => $district->user_id,
            'last_message_at' => now(),
        ]);
        $conversation->participantRows()->create([
            'user_id' => $district->user_id,
            'joined_at' => now(),
        ]);
        $district->forceFill(['conversation_id' => $conversation->id])->save();
        $this->systemMessage($conversation, '🏘️ Район «' . $district->name . '» создан. Общий чат открыт — знакомьтесь!');

        return $conversation;
    }

    /**
     * Системное сообщение в чат района.
     *
     * @param Conversation $conversation чат
     * @param string $body текст
     */
    private function systemMessage(Conversation $conversation, string $body): void
    {
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $conversation->created_by ?? $conversation->participantRows()->value('user_id'),
            'body' => $body,
            'type' => 'system',
        ]);
        $conversation->forceFill(['last_message_at' => $message->created_at])->save();
        try {
            broadcast(new \App\Events\MessageSent($message->load('conversation.participantRows')))->toOthers();
        } catch (\Throwable) {
        }
    }
}
