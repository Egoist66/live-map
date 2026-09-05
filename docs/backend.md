# Backend live-map — полная документация

Стек: Laravel 12, Eloquent, cookie-авторизация `web+auth`, Broadcasting Reverb, Web Push VAPID, MySQL.
Все API: `routes/api.php` под `middleware(['web','auth'])`. Гость карту не читает.

Поток: `routes/api.php -> Controller -> Model (скоупы/хелперы) -> MySQL + broadcast/push`.

---

## 1. User — `users` (`App\Models\User`)

**Зачем:** центр всего. Владеет пинами, бизнесами, дружбой, чатами, пушами. Хранит тариф, гео, приватность, невидимку, репутацию. Без юзера нет ничего.

**Поля:**
- База: `name, email UNIQUE, gender(male|female|other) NULL, password(hashed,hidden), email_verified_at`
- Профиль: `avatar_path (+avatar_url), bio, reputation_score, level(novice|local|guide)`
- Гео: `latitude/longitude` (текущие), `home_lat/home_lng/home_radius_km=2` (дом)
- Тариф: `plan(free|pro|business), plan_expires_at, pins_today_count/pins_today_date, stripe_id, pm_type, pm_last_four, trial_ends_at`
- Роли: `role(user|moderator|admin), is_admin`
- Чат: `message_privacy(everyone|friends|none), allow_random_messages, is_anonymous_default`
- Онлайн: `last_seen_at, is_invisible`

**Связи:** `pins, comments, reactions, zoneSubscriptions, businesses, reports, blocks(blocker_id), blockedBy(blocked_id), friendships, friendshipsReceived, conversations (pivot), pushSubscriptions`.

**Как работает:**
1. Регистрация `RegisteredUserController`, логин `AuthenticatedSessionController` (Breeze). Сессия в `sessions`.
2. Каждый запрос через `UpdateLastSeen`: если авторизован и не `isInvisibleActive()`, раз в 120 сек (кеш `last_seen:{id}`) пишет `last_seen_at`. Невидимка (`is_invisible`, тариф pro/business/admin) не светится. Явный пинг — `POST /chat/heartbeat`.
3. Лимиты пинов `canCreatePin()`: `admin/pro/business = безлимит`, `free = 3 в сутки` (сброс по `pins_today_date`). Радиус `pinRadius()`: `free=1км, pro/business=5км, admin=50км`. TTL `pinTtlHours()`: `free=2ч, pro/business=24ч, admin=168ч`.
4. Анти-спам сообщений `messageBlockReason(other)` (вызывается при создании диалога/сообщения, в `friendship-status`, в поиске):
   - себе нельзя; я заблокировал / меня заблокировали → запрет;
   - `other.message_privacy=none` → запрет;
   - `=friends + !areFriends` → запрет;
   - `!allow_random_messages + !areFriends` → запрет.
5. Профиль `GET /users/{user}`: отдает `isOwn, friendship/isFriend/isPending, isBlocked/isBlockedBy, canMessage/reason`, прячет `last_seen_at` если собеседник-невидимка и смотрящий не админ.
6. `PATCH /profile` — сброс `email_verified_at` при смене email. `DELETE /profile` — требует текущий пароль, разлогинивает и удаляет. `POST /avatar` — кладет в `s3` (если настроен) иначе `public/avatars`, старый файл удаляет.

**Кто может:** читать чужой профиль — любой авторизованный; править — только свое (+админ правит через `dashboard/admin`); `POST /profile/invisible` — только `canUseInvisible()` (pro/business/admin), иначе 403.

---

## 2. Pin — `pins` (`App\Models\Pin`) — ядро карты

**Зачем:** гео-объявление `question|announcement|warning|event|offer|help` с временем жизни. Все остальное (комменты, реакции, жалобы, бусты, подписки на зоны) крутится вокруг пина.

**Поля:** `user_id cascade, title(120), body, photo_path, category+INDEX, latitude/longitude (публичные)+INDEX, real_lat/real_lng (точные), location_precision(blur_200|exact|district), district_name, radius_meters, visibility_radius_km, status(active|expired|archived|deleted), expires_at INDEX, priority(normal|boosted|sponsored), is_pinned/is_sponsored/is_boosted, boosted_until, views_count/likes_count/reactions_count/comments_count, is_anonymous, meta json`.

**Как работает:**
1. `GET /pins?lat,lng,radius` — `active()->where(status=active)->nearby(lat,lng,radiusKm)`. Радиус = запрос или `pinRadius()/1000`, центр по умолчанию Москва. Выкидывает обе стороны блоков. Сортировка `boostedFirst()`, `limit 100`, `with(user:id,name,avatar_path,level)`. Одним запросом подтягивает `my_reaction`.
2. `GET /pins/mine` — только свои активные, `limit 50`.
3. `POST /pins`: валидация `title, body≤1000, category, lat/lng, radius 500..50000`. Проверка `canCreatePin()` иначе 429. Пины всегда точные (`exact`, без сдвига) — размывается только точка геопозиции юзера (`users.default_blur_meters`: 0/300/1000/5000, 5000 только pro/business/admin, остальным кламп до 1000 в `ProfileController@update`). Радиус обрезается тарифом, `expires_at=now()+TTL тарифа`, `is_anonymous ?? is_anonymous_default`. Счетчик суток. Broadcast `PinCreated` в публичный канал `map` (`pin.created`) через `toOthers()`.
4. `PATCH /pins/{pin}` — `PinPolicy update` (владелец или admin), только `title/body/category`. Broadcast `PinUpdated`.
5. `DELETE` — владелец или `canDeletePin` (admin/owner). Broadcast `PinDeleted {pinId}`.
6. `POST /pins/{pin}/boost {type:top|glow|notify|extend}` — цены `1/2/5/3`, `extend=+1 день к expires_at`, остальные `+1ч к boosted_until`, ставит `is_boosted=true`. Создает запись `pin_boosts`. Broadcast `PinUpdated`.
7. Фон `pins:prune` — удаляет `expires_at<now`. Жалобы (3+ pending) переводят пин в `archived` — он пропадает из выдачи.

**Зачем блюр и счетчики:** `real_*` никому не отдаем — защита геопозиции. Счетчики избегают `COUNT(*)` на 100 пинов в радиусе.

---

## 3. PinComment — `pin_comments` (SoftDeletes)

**Зачем:** обсуждение пина, треды через `parent_id`. Без комментов карта немая.

**Поля:** `pin_id cascade, user_id cascade, parent_id self NULL cascade, content text, is_anonymous, deleted_at, INDEX(pin_id,created_at)`.

**Как работает:** `GET /pins/{pin}/comments` — `with(user,replies.user)`, `paginate 20`, анонимным зануляет `user`. `POST` — `content≤1000, parent_id exists`, `pin->increment(comments_count)`. `PATCH` — `CommentPolicy` (owner/admin) + антиспам: не-админ ≤3 правок в сутки на пин (кеш `comment_edit:{user}:{pin}:{date}`), иначе 429. `DELETE` — `decrement(comments_count)`, SoftDelete. Broadcast нет.

## 4. Reaction — `reactions` (полиморф `Pin|PinComment`)

**Зачем:** виральность и обратная связь `like|fire|laugh|sad|angry|useful`. Одна запись = один голос.

**Как работает `POST /reactions {reactable_type:pin|comment, reactable_id, type}`:**
- тот же type есть → удалить, пину `decrement reactions_count (+likes_count если like)` → `{reacted:false}`;
- другой type есть → `update(type)`, пину правим только `likes_count` → `{switched:true}`;
- нет → создать, пину `increment`. Если `reactions_count%5==0` и до конца жизни <23ч → `expires_at+1ч` (вирус продлевает жизнь).
Уникальность `UNIQUE(user,type,id,type)` запрещает дубли. Счетчики только для пинов, комменты считают на лету.

## 5. PinView — `pin_views` / PinBoost — `pin_boosts`

**Зачем:** `PinView (pin_id,user_id NULL,ip)` — факт просмотра для аналитики, дедуп только логикой. `PinBoost (pin_id,user_id,type(top|glow|notify|extend),duration_hours,price,starts_at/ends_at)` — чек платного продвижения, синхронизируется с `pins.is_boosted/boosted_until/priority`.

## 6. ZoneSubscription — `zone_subscriptions`

**Зачем:** «следи за районом». Заготовка под пуш «новый help рядом с домом».

**Как:** `GET` — свои. `POST {lat,lng,radius_km 1..10,types?,notify_via?}` → 201. `DELETE` — только своя. Пока без триггера отправки — только хранение интереса.

## 7. Business — `businesses`

**Зачем:** бизнес-профиль юзера (кафе/сервис) отдельно от пинов, привязка к тарифу `free|business|pro`.

**Поля:** `user_id cascade, name, category, address, lat/lng, description, phone, website, working_hours json, subscription_plan, is_active`. Только `belongsTo(user)`. Отдельного публичного API в `api.php` нет — управляется через веб/Inertia.

## 8. Report — `reports` (крауд-модерация)

**Зачем:** жалобы на `pin|comment|user` без админки в реальном времени.

**Как:** `POST /reports {target_type,target_id,reason(spam|abuse|inappropriate|illegal|fake),description?}` → `create(reporter_id=me)`. Если по цели накопилось ≥3 `pending` и цель — пин → `status=archived` (исчезает из ленты). Разбор модератором (`moderator_id,resolved_at,status=resolved|dismissed`) — вне текущего API.

## 9. UserBlock — `user_blocks` (изоляция)

**Зачем:** полный игнор человека: скрыть его пины, запретить дружбу/личку/поиск.

**Как:** `GET /blocks` — свои. `POST {user_id}` — нельзя себя, идемпотентно 200 если уже есть, иначе транзакция `create + удалить Friendship в обе стороны`. `DELETE /blocks/{user}` — 404 если не было. Эффект читается везде: `PinController` выкидывает из выдачи, `Friendship::store` 403, `messageBlockReason` запрещает диалог, `ChatUser::search` исключает.

## 10. Friendship — `friendships` (гейт для лички)

**Зачем:** статусы `pending|accepted|declined|blocked`, гейт для `message_privacy=friends`.

**Как:**
- `GET /friendships` → `{friends, pending_in, pending_out}`.
- `POST {user_id}` — нельзя себя, блок → 403. Есть `accepted` → 422, `pending` → 422, `declined` → перевыставить в `pending` от меня. Иначе `create(pending)` + broadcast `FriendshipUpdated` в `user.{req}+user.{adr}` + push `sendFriendRequest`.
- `POST /{id}/accept` — только получатель + pending → `accepted` + broadcast + push `sendFriendAccepted`.
- `POST /{id}/decline` — только получатель → `declined` + broadcast без пуша.
- `DELETE /{id}` — любой из двоих, hard delete без broadcast.
- `GET /friendships/status/{user}` → `{is_friend,is_pending,is_blocked,can_message,reason}`.

## 11. Conversation + ConversationParticipant + Message — личка

**Зачем:** диалоги `direct` с непрочитанными, статусами `sent→delivered→read`, мягким удалением.

**Conversation:** `type=direct, created_by, last_message_at`. Хелперы `hasParticipant(), findDirect(a,b), otherParticipant()`.
**Participant (timestamps false):** `conversation_id+user_id UNIQUE, last_read_at/joined_at/hidden_at(скрыть диалог)/cleared_at(скрыть историю)`.

**Как:**
1. `GET /conversations` — только мои где `hidden_at=null`, `with(participants,last message)`, `withCount(unread)`, сортировка по `last_message_at`. Если `cleared_at` новее последнего сообщения — прячет превью и пересчитывает unread. Невидимкам зануляет `last_seen_at` для не-админа.
2. `POST /conversations {user_id,message?}` — проверка `messageBlockReason/canMessageUser` → 403. Если `findDirect` есть → снять свой `hidden_at`, опционально отправить сообщение. Иначе транзакция `create + 2 участника + сообщение + broadcast MessageSent + push sendChatMessage`.
3. `GET /conversations/{id}` — только участник, сообщения `limit 100` с фильтром `cleared_at`, чужие недоставленные помечает `delivered_at=now` + broadcast.
4. `POST /{id}/read` — чужие непрочитанные → `read_at=now (+delivered_at если пусто)`, `last_read_at=now`, broadcast `MessageRead`. `POST /{id}/delivered` — только доставка + `MessageDelivered`.
5. `DELETE /{id}` — себе `hidden_at=cleared_at=now`; если у обоих скрыто — hard delete.
6. `Message`: `GET /{id}/messages?before=` — `limit 30 назад`, автодоставка. `POST` — `body≤2000`, перепроверка блока, снимает `hidden_at` у всех (переоткрывает чат), broadcast `MessageSent` в `chat.{id}+user.{other}` + push. `POST /typing {is_typing}` — broadcast `TypingIndicator`. `PATCH` — только свой текст + `edited_at`, broadcast `MessageUpdated`. `DELETE` — автор или admin, broadcast `MessageDeleted`.

## 12. PushSubscription + WebPushService — офлайн-уведомления

**Зачем:** доставить «тебе написали / приняли дружбу», когда вкладка закрыта.

**Как:** `POST /push-subscriptions {endpoint,keys.p256dh,keys.auth}` — `updateOrCreate(endpoint)`. `DELETE` — только своя. `POST /test` — шлет себе тестовый пуш. `WebPushService`: работает только если есть VAPID-ключи и класс WebPush; `sendChatMessage` режет превью до 120 символов, `url /chat/{id}, tag chat-{id}`; `sendFriendRequest→/chat?tab=requests`, `sendFriendAccepted→/chat?tab=friends`; при отправке считает `sent`, удаляет протухшие подписки, все вызовы обернуты в `try/catch`.

## 13. WebSocket (Reverb) — как устроен подробно

**Зачем:** живая карта и чат без polling. Пины летят всем, сообщения — только участникам, онлайн — через presence.

**Транспорт:** `BROADCAST_CONNECTION=reverb`, Laravel Reverb WS-сервер (`REVERB_HOST/PORT/SCHEME` + `REVERB_APP_ID/KEY/SECRET`). Все 10 событий `implements ShouldBroadcastNow` (сразу в сокет, без очереди) + `InteractsWithSockets` (нужен для `toOthers()` — отправитель не получает эхо, у него optimistic UI). Каждый `broadcast()` в контроллерах обернут в `try/catch + Log::warning('reverb broadcast failed')` — чат/пин сохранится даже если сокет лежит.

**Каналы (`routes/channels.php`):**
- `chat.{id}` (Private) — `Conversation::find + hasParticipant(user.id)`, иначе false. Вся переписка диалога.
- `user.{id}` (Private) — только `(int)user.id===(int)userId`. Личные добивки: новое сообщение когда ты не в диалоге, `message.read`, `friendship.updated`.
- `map` (Public `Channel`) — `return true`, без auth. Живые пины.
- `online` (Presence) — если `isInvisibleActive()` → false (невидимку не пускает и не светит), иначе отдает `{id,name,avatar_path}` для `.here/.joining/.leaving`.

**События и payload:**
- `MessageSent (message.sent)` → `[Private chat.{cid}, Private user.{otherId}]`, `{message: toArrayPayload()+sender{id,name,avatar_path}}`. Двойная отправка: в диалог + лично получателю (чтобы прилетело даже без открытого чата).
- `MessageRead (message.read)` → `[Private chat.{cid} + Private user.{каждого участника}]`, `{conversation_id,user_id,message_ids,read_at}`.
- `MessageDelivered (message.delivered)` → `[Private chat.{cid}]`, `{conversation_id,message_ids,user_id,delivered_at}`.
- `MessageUpdated (message.updated)` → `[Private chat.{cid}]`, `{message}`. `MessageDeleted (message.deleted)` → то же, `{message_id,conversation_id}`.
- `TypingIndicator (typing)` → `[Private chat.{cid}]`, `{conversation_id,user_id,is_typing}`.
- `PinCreated (pin.created) / PinUpdated (pin.updated)` → `[Channel map]`, `{pin: toPublicArray()}` (без `real_*`). `PinDeleted (pin.deleted)` → то же, `{pinId}` (именно camelCase).
- `FriendshipUpdated (friendship.updated)` → `[Private user.{req}, Private user.{adr}]`, `{friendship:{id,requester_id,addressee_id,status,requester,addressee}}`.

**Жизненный цикл сообщения по сокету:**
1. `POST /conversations/{id}/messages` → `Message::create` + `last_message_at=now` + снять `hidden_at` у всех → `broadcast(MessageSent)->toOthers()` → падает в `chat.{id}` (открытый диалог) и в `user.{other}` (глобальный слушатель).
2. Открытие диалога `GET /conversations/{id}` или `GET messages` → чужие `delivered_at=null` → `update(now)` + `broadcast(MessageDelivered)->toOthers()`.
3. `POST /{id}/read` → чужие `read_at=null` → `read_at=delivered_at=now`, `last_read_at=now` + `broadcast(MessageRead)` всем участникам.
4. Печать: фронт `whisper('typing')` (P2P через `accept_client_events_from=members`) + серверный `POST /typing` → `broadcast(TypingIndicator)`. Фронт слушает оба: `listenForWhisper('typing')` и `listen('.typing')`.

**Фронт (`echo.ts`, `useChat/useMap/usePresence`):**
- `echo.ts`: `new Echo({broadcaster:reverb, key:VITE_REVERB_APP_KEY, wsHost:VITE_REVERB_HOST||hostname, wsPort/wssPort, forceTLS, authEndpoint:/broadcasting/auth})`. Если ключа нет → `window.Echo=null`, realtime выключен.
- `useChat`: глобально `echo.private(user.{uid}).listen('.message.sent/.updated/.deleted/.delivered/.read/.friendship.updated')`; в открытом диалоге дополнительно `echo.private(chat.{id})` (старый `leave`), плюс `whisper('typing')` с throttle 700мс, авто-false 1200мс, expire 2500мс.
- `useMap`: `echo.channel('map').listen('.pin.created/.updated/.deleted')` (и дубль без точки `PinCreated` — имя класса) → `store.addRealtime/removeRealtime`, `leave('map')` при размонтировании.
- `usePresence`: `echo.join('online').here/.joining/.leaving` → `Set<onlineIds>`, `heartbeat POST` каждые 60с + по `visible`, `disconnect` на `beforeunload`, невидимка блокирует connect.

**Отладка:** `BROADCAST_CONNECTION=null/log` — события никуда не летят (фронт работает только через REST). Ошибка auth канала → 403 на `/broadcasting/auth` (проверь `hasParticipant` и куку сессии).

## 14. Сервисы детально

**WebPushService (`app/Services/WebPushService.php`):**
- `isConfigured()` — есть `services.webpush.vapid.public/private_key` + `class_exists(WebPush)`. Все вызовы из чата/дружбы идут только если true, иначе молча скип.
- `sendToUser(user,payload)` → `sendToSubscriptions(user->pushSubscriptions()->get(), payload)`.
- `sendChatMessage(recipient,sender,convId,body)` — `title=sender.name, body=первые 120 символов со схлопнутыми пробелами ('Новое сообщение' если пусто), url=/chat/{id}, tag=chat-{id}, avatar=sender.avatar_url`.
- `sendFriendRequest(other,me)` — `url=/chat?tab=requests, tag=friend-request-{friendshipId}`. `sendFriendAccepted` — `url=/chat?tab=friends, tag=friend-accepted-{id}`.
- `sendToSubscriptions` — `new WebPush(VAPID subject=app.url)`, на каждую подписку `sendOneNotification(Subscription(endpoint,p256dh,auth,aesgcm), json)`, затем `flush()`: успех → `sent++`, `isSubscriptionExpired()` → `PushSubscription::where(endpoint)->delete()`, иначе `Log::warning`. Возвращает `{sent}`. Вызывается синхронно после `broadcast` (не в очередь).

**UpdateLastSeen (`app/Http/Middleware/UpdateLastSeen.php`):** после `$next`, если `auth && !isInvisibleActive()`, троттлинг `Cache last_seen:{id} 120с` → `saveQuietly(last_seen_at=now)` без touching событий.

**PruneExpiredPins (`pins:prune`):** `Pin::where(expires_at<now)->delete()` (каскадно тянет views/boosts/comments). Повесить в scheduler/крон раз в 5–15 мин, иначе `index(active)` все равно скроет, но таблица растет.

**Прочее:** `MakeAdmin (make:admin)`, `GenerateVapidKeys (vapid:keys)`, `Pin::blurCoords/toPublicArray/pinRadius/pinTtlHours/canCreatePin`, `Message::toArrayPayload/statusFor`, `Conversation::findDirect`, `Friendship::areFriends/pendingBetween`.

## 15. Сквозное и крон

- Крон `pins:prune`, команды `make:admin`, `vapid:keys`.
- Служебные без моделей: `notifications (UUID morphs)`, `subscriptions (stripe)`, `sessions, cache, jobs`.

## ER-схема (текстом)

```
User 1—N Pin 1—N PinComment (self parent)
User 1—N Reaction N—1 (Pin|PinComment morph)
Pin 1—N PinView, Pin 1—N PinBoost
User 1—N ZoneSubscription, Business, Report, PushSubscription
User N—N UserBlock (blocker/blocked self)
User N—N Friendship (requester/addressee self)
User N—N Conversation (через ConversationParticipant) 1—N Message
```
