# Backend live-map — полная документация

Стек: Laravel 12, Eloquent, cookie-авторизация `web+auth`, Broadcasting Reverb, Web Push VAPID, MySQL.
Все API: `routes/api.php` под `middleware(['web','auth'])`, кроме публичного `GET /nbrb/*` (`throttle:60,1`). Гость карту не читает.

Поток: `routes/api.php -> Controller -> Model (скоупы/хелперы) -> MySQL + broadcast/push`.
Админ-API: `middleware(['web','auth','admin'])` — `AdminMiddleware` (role=admin или is_admin).

---

## 1. User — `users` (`App\Models\User`)

**Зачем:** центр всего. Владеет пинами, фото, бизнесами, дружбой, чатами, пушами. Хранит тариф, гео, приватность, невидимку, репутацию, баны, screen-lock.

**Поля:**
- База: `name, email UNIQUE, birth_date NULL (+age accessor), password(hashed,hidden), email_verified_at`
- Профиль: `avatar_path (+avatar_url), bio, reputation_score, level(novice|local|guide)`
- Гео: `latitude/longitude` (текущие), `country/country_code(lowercase)`, `home_lat/home_lng/home_radius_km=2/home_city/home_address/home_visibility(everyone|friends|none)/show_exact_home`
- Тариф: `plan(free|pro|business), plan_expires_at (+isPlanExpired/effectivePlan/effective_plan appends), pins_today_count/pins_today_date, stripe_id, pm_type, pm_last_four, trial_ends_at`
- Роли/модерация: `role(user|moderator|admin), is_admin, is_hidden_from_search, banned_at+banned_reason (isBanned())`
- Чат: `message_privacy(everyone|friends|none), allow_random_messages, is_anonymous_default`
- Фото: `photo_comments_privacy(everyone|friends|none)`
- Блюр: `default_blur_meters(0|300|1000|5000, 5000 только pro/business/admin, остальным кламп до 1000), default_location_precision`
- Screen-lock: `screen_lock_code(hidden!), screen_lock_timeout(1|5|10), screen_lock_kind(pin4|alpha8)`
- Онлайн: `last_seen_at, is_invisible`, `settings json`

**Лимиты (`User.php:145-257`):** `pinRadius/pinTtlHours/canCreatePin/livePinsCount` (см. Pin), `photoLimit free3/pro6/business-admin15`, `pinnedMessagesLimit free3/pro6/business20/admin∞`, `hiddenFriendsLimit free1/pro3/business-admin∞`, `canUseInvisible() pro/business/admin`, `canCommentProfilePhoto(target)`.

**Как работает:**
1. Регистрация `RegisteredUserController`, логин `AuthenticatedSessionController` (Breeze) + `LoginShield`: бан → 422, админ скип, ≥3 fails → заморозка 60 мин, ≥4 fails → автобан `banned_reason`, каждый fail пишет `login_attempts` (+geo через `IpGeolocation`, user_agent).
2. Каждый запрос через `UpdateLastSeen`: если авторизован и не `isInvisibleActive()`, троттлинг `Cache last_seen:{id} 120с` → `saveQuietly(last_seen_at)`. Явный пинг — `POST /chat/heartbeat` (невидимка → `{invisible:true}` без записи).
3. Анти-спам сообщений `messageBlockReason(other)`: себе нельзя; блоки в обе стороны; `message_privacy=none` → запрет; `=friends + !areFriends` → запрет (админ пишет только друзьям); `!allow_random_messages + !areFriends` → запрет.
4. Профиль `GET /users/{user}` (web `ProfileController@publicShow`): `isOwn, friendship/isFriend/isPending, isBlocked/isBlockedBy, canMessage/reason`, прячет `last_seen_at` если собеседник-невидимка и смотрящий не админ.
5. `PATCH /profile` (web, `throttle:profile-write`) — сброс `email_verified_at` при смене email. `DELETE /profile` — требует текущий пароль. Аватар вынесен: `POST /profile/avatar → AvatarController@store {avatar image≤2М, s3|public/avatars, удаление старого}`.
6. `PATCH /user/invisible` — только `canUseInvisible()`, иначе 403.

---

## 2. Pin — `pins` (`App\Models\Pin`) — ядро карты

**Зачем:** гео-объявление (19 встроенных + свои слаги для Pro/Business/admin через `custom_categories`) с временем жизни и отложенной публикацией. Политика/18+/наркотики/оружие/ненависть/криминал блокируются `ContentModeration::assertClean` на создании/редактировании пинов, комментариев и названий категорий (422). `CountryResolver::assertPinAllowed` — 422 если пин вне своей `country/country_code|home` (Nominatim reverse, Cache 30д; первый пин автосохраняет страну; админы bypass).

**Поля:** `user_id cascade, title(100), body(≤1000), photo_path(255?, просто путь), category VARCHAR(32)+INDEX, latitude/longitude+INDEX, real_lat/real_lng, location_precision (валидация blur_200|exact|district|custom, store всегда exact), district_name, radius_meters(min500|max500000, кламп тарифом), visibility_radius_km, status(active|expired|archived|deleted|scheduled)+publish_at(INDEX), expires_at INDEX, priority(normal|boosted|sponsored), is_pinned/is_sponsored/is_boosted, boosted_until, views/likes/reactions/comments_count, is_anonymous, meta json`.

**Скоупы:** `active() = status active + expires>now + publish<=now`, `scheduled() = status scheduled + publish>now`, `archivedOnly()`, `nearby(lat,lng,radiusKm)`, `boostedFirst()`.

**Как работает:**
1. `GET /pins?lat,lng,radius` (`throttle:pins-index` 120/мин) — `active()->nearby()`. Радиус = запрос или `pinRadius()/1000` (free5км/pro15/business50/admin500км), центр по умолчанию Москва. Выкидывает обе стороны блоков. `limit 100`, `with(user)`, одним запросом `my_reaction`.
2. `GET /pins/mine` — свои active+scheduled, `limit 50`. `GET /pins/mine/scheduled` — `status=scheduled+publish>now`. `GET /pins/mine/archived` — `expired|archived OR expires<=now`.
3. `GET /pins/{pin}` — чужой не-active → 404, `isVisibleForGender` → 403, отдает `my_reaction`.
4. `POST /pins` (`throttle:pins-write` 20/мин): `title≤100, body≤1000, category, lat/lng, radius 500..500000`. `canCreatePin()` иначе 429 (admin/pro/business безлимит, free ≤3 живых `active|scheduled + expires>now`, проверка под `lockForUpdate` + повторно в транзакции). `expires_at=now()+TTL (free4ч/pro12ч/business-admin null)`, опционально `publish_at` → `status=scheduled`. Broadcast `PinCreated` в `map` через `toOthers()`.
5. `PATCH/PUT /pins/{pin}` — `PinPolicy update` (владелец или admin через `Gate::before`), только `title/body/category`. Broadcast `PinUpdated`.
6. `DELETE` — владелец или admin, `forceDelete + delete comments/reactions`. Broadcast `PinDeleted {pinId}` (camelCase).
7. `POST /pins/{pin}/boost {type:top|glow|notify|extend}` — цены `1/2/5/3`, `extend=+1 день к expires_at`, остальные `+1ч к boosted_until`, `is_boosted=true`, запись `pin_boosts`. Broadcast `PinUpdated`.
8. Фон: `pins:prune everyFiveMinutes` — `where(expires_at<now)->delete()`; `pins:publish everyMinute` (`--limit=100`) — `scheduled+publish<=now → active + broadcast PinCreated`; `plans:downgrade-expired daily` — `pro|business + expired chunk200 → free`. Жалобы (3+ pending) → `status=archived`.

---

## 3. PinComment — `pin_comments` (SoftDeletes)

**Поля:** `pin_id/user_id cascade, parent_id self NULL cascade, content(≤1000), is_anonymous, deleted_at, INDEX(pin_id,created_at)`.

**Как:** `GET /pins/{pin}/comments` — `with(user,replies.user)`, `paginate 20`, анонимным зануляет `user`. `POST` (`throttle:comments-write` 60/мин) — `parent_id exists`, `increment(comments_count)` + `PinActivityNotifier::comment + broadcastCounters`. `PATCH/PUT /comments/{comment}` — `CommentPolicy` + антиспам ≤3 правок/сутки на пин (кеш `comment_edit:{user}:{pin}:{date}`) иначе 429. `DELETE` — `decrement`, SoftDelete. Упоминания `@Имя` → `Mentions::extractIds` → `PinActivity kind=mention` (минус self и взаимные блоки).

## 4. Reaction — `reactions` (полиморф `Pin|PinComment`)

`POST /reactions/toggle {reactable_type:pin|comment, reactable_id, type:like|fire|laugh|sad|angry|useful}` (`throttle:reactions` 120/мин): тот же type → удалить (`decrement reactions_count +likes_count если like`, `{reacted:false}`); другой → `update` (`{switched:true}`); нет → создать. Если `reactions_count%5==0` и до конца <23ч → `expires_at+1ч`. `UNIQUE(user,type,id,type)`. Проверка `isVisibleForGender` пина + `PinActivityNotifier::reaction`. Счетчики только для пинов.

## 5. PinView / PinBoost / CustomCategory

`PinView (pin_id,user_id NULL,ip)` — аналитика, дедуп логикой. `PinBoost (pin_id,user_id,type(top|glow|notify|extend),duration_hours,price,starts_at/ends_at)` — чек продвижения. `CustomCategory (user_id, slug PK-route, label, icon?, color?)`: `GET/POST /custom-categories` (`throttle:social-write`), `DELETE /custom-categories/{slug}` (владелец или admin), `toPublicArray {is_owner}`.

## 6. PinActivity — `pin_activities` (колокольчик)

**Поля:** `pin_id?, actor_id, owner_id, kind(reaction|comment|mention|photo_comment), reaction_type?, comment_id?, photo_id?, photo_comment_id?, excerpt(120), read_at`.

**Как:** `GET /pin-activities` (paginate 15, `with actor/pin/photo`), `GET /pin-activities/unread-count {count}`, `POST /pin-activities/read {all|ids[]}` → `read_at`. Создает `PinActivityNotifier` (скип если actor=owner): `reaction/comment/mentions/photoComment/photoMentions` + `broadcastCounters (map, as pin.activity {pin_id,reactions_count,comments_count})` + `PinActivityCreated (private user.{owner}, as pin.activity {activity:toNotifyArray()})` через `toOthers()` + webpush `sendPinActivity/sendPhotoActivity`. Realtime слушать оба: публичный `map` (счетчики) и приватный `user.{id}` (уведомления).

## 7. ZoneSubscription — `zone_subscriptions`

`GET` — свои. `POST {lat,lng,radius_km 1..10,types?,notify_via?}` → 201. `DELETE` — только своя. Триггера отправки нет — только хранение.

## 8. Business — `businesses`

`user_id cascade, name, category, address, lat/lng, description, phone, website, working_hours json, subscription_plan, is_active`, `belongsTo(user)`. Отдельного публичного API в `api.php` нет — через веб/Inertia.

## 9. Report — `reports`

`POST /reports {target_type:pin|comment|user, target_id, reason(spam|abuse|inappropriate|illegal|fake), description?}` (`throttle:reports` 10/мин) → `create(reporter_id=me)`. ≥3 `pending` по пину → `status=archived`. Создает `ReportCreated (private user.{adminId}[], as report.created {report})` + email `ReportReceived` + webpush `sendReport`. Разбор: `GET /admin/reports`, `POST /admin/reports/{report}/resolve` (admin).

## 10. UserBlock — `user_blocks`

`GET /blocks` — свои. `POST {user_id}` (`throttle:social-write`) — нельзя себя, идемпотентно 200, иначе `create + удалить Friendship в обе стороны`. `DELETE /blocks/{user}` — 404 если не было. Эффект везде: пины из выдачи, `Friendship::store` 403, `messageBlockReason` запрет, `ChatUser::search` исключает + `hiddenFromSearchFor`.

## 11. Friendship — `friendships`

**Поля:** `requester_id/addressee_id, status(pending|accepted|declined|blocked), hidden_by_requester/hidden_by_addressee (isHiddenFor/setHiddenFor)`.

**Как:**
- `GET /friendships → {friends, pending_in, pending_out}` (скрытые `hidden_by_*` себе не отдаются в чужом списке).
- `POST` (`throttle:social-write`) — нельзя себя, блок → 403. `accepted` → 422, `pending` → 422, `declined` → в `pending`. Иначе `create(pending)` + `FriendshipUpdated (private user.{req}+user.{adr})` + push `sendFriendRequest`.
- `POST /{id}/accept` (только получатель) → `accepted` + broadcast + push. `POST /{id}/decline` → `declined` + broadcast без пуша. `DELETE` — любой из двоих, hard delete.
- `GET /friendships/status/{user} → {is_friend,is_pending,is_blocked,can_message,reason}`.
- `PATCH /friendships/{friendship}/hidden {is_hidden?}` — только accepted, лимит `hiddenFriendsLimit (free1/pro3/business-admin∞)`.
- `GET /users/{user}/friends` — публичный список (ghost id=4 фильтруется).

## 12. ProfilePhoto — `profile_photos` + likes/comments

**Поля:** `profile_photos(user_id cascade, path255(+url s3|public), caption500?, sort_order uint default 0 + INDEX(user_id,sort_order), likes_count, comments_count)`; `profile_photo_likes(photo_id,user_id,UNIQUE)`; `profile_photo_comments(photo_id,user_id,content1000,INDEX(photo,created))`. Лимит `photoLimit free3/pro6/business-admin15` под `lockForUpdate`.

**Как (`throttle:social-write`, комменты `comments-write`, лайк `reactions`):** `GET /users/{user}/photos` (блок/приватность → 403, `abortIfBlocked`); `POST /photos {photo image≤5М, caption500 + ContentModeration}`; `POST|PATCH /photos/{photo} {caption,photo}` (владелец/admin); `DELETE` (то же); `POST /photos/{photo}/like` (toggle); `GET|POST /photos/{photo}/comments {content≤1000}`; `DELETE /photo-comments/{comment}` (автор коммента|владелец фото|admin). Лайк/коммент чужого → `PinActivityNotifier::photoComment` + push. `PATCH /user/photo-comments-privacy {photo_comments_privacy}` — гейт для комментов (`canCommentProfilePhoto`: everyone|friends+areFriends|none).

## 13. Conversation + Message — личка

**Conversation:** `type=direct, created_by, last_message_at`. **Participant (timestamps false):** `conversation_id+user_id UNIQUE, last_read_at/joined_at/hidden_at/cleared_at`.
**Message:** `conversation_id/user_id cascade, body≤2000, delivered_at/read_at/edited_at, pinned_at+pinned_by(FK users nullOnDelete), toArrayPayload {is_pinned,pinned_at,pinned_by,is_edited,statusFor}`.

**Как:**
1. `GET /conversations` — мои где `hidden_at=null`, `with(participants,last message)`, `withCount(unread)`, сортировка `last_message_at`. `cleared_at` прячет превью/unread. Невидимкам зануляет `last_seen_at`.
2. `POST /conversations {user_id,message?}` (`throttle:social-write`) — `messageBlockReason` → 403. Есть `findDirect` → снять `hidden_at` + опц. сообщение. Иначе транзакция + `MessageSent` + push.
3. `GET /conversations/{id}` — только участник, автодоставка чужих + broadcast.
4. `POST /{id}/read|delivered` (`throttle:chat-signal`) — `read_at/delivered_at`, `last_read_at`, broadcast `MessageRead/MessageDelivered`.
5. `DELETE /{id}` — себе `hidden_at=cleared_at=now`; скрыто у обоих → hard delete.
6. `Message`: `GET /{id}/messages?before=` (limit 30), `POST` (`throttle:messages-write`, снимает `hidden_at` у всех, broadcast `MessageSent` в `chat.{id}+user.{other}` + push), `POST /typing {is_typing}` (`throttle:chat-signal`), `PATCH` (свой текст + `edited_at`, broadcast `MessageUpdated`), `DELETE` (автор/admin, broadcast `MessageDeleted`).
7. Закрепы: `GET /{id}/pinned → {pinned[],pin_limit}`, `POST /messages/{message}/pin` + `DELETE .../unpin` (`throttle:pin-toggle` 60/мин, лимит `pinnedMessagesLimit`), broadcast `MessagePinned (private chat.{cid}, as message.pinned {message})` и на pin, и на unpin.

## 14. ChatUser + ScreenLock + NBRB + SEO

- `GET /chat/me {id,name,avatar,privacy,unread_count,last_seen,is_invisible,can_use_invisible}`; `GET /chat/users/search?q≥2` (`throttle:chat-search` 30/мин, исключает блоки + `is_hidden_from_search`, `{can_message,reason,is_friend,is_pending}`); `PATCH /chat/privacy {message_privacy,allow_random_messages}`.
- ScreenLock: `GET /user/screen-lock {enabled,timeout,kind}`, `PUT {kind:pin4|alpha8, code:^\\d{4}$|^[A-Za-z0-9]{8}$, timeout:1|5|10}` (plaintext в `screen_lock_code`), `DELETE`, `POST /user/screen-lock/verify {code}` (`throttle:screen-lock`, 404 если нет, 422 если неверно, `hash_equals`).
- NBRB (без auth, `throttle:60,1`, прокси `api.nbrb.by/exrates` + `Cache::remember`): `GET /nbrb/currencies/{curId?} (?all, 24ч)`, `GET /nbrb/rates/{code?} (?ondate,periodicity0|1,parammode0|1|2; 6ч/30д)`, `GET /nbrb/dynamics/{curId} (?startdate,enddate ≤365д, 12ч)`, `GET /nbrb/convert (?amount,from USD|код,ondate → {byn}, 6ч/30д)`. Даун → 502, нет → 404 `{message}`.
 - SEO (web): `GET /robots.txt` и `GET /sitemap.xml` строятся через `SeoSettingsService` (настройки из админки → SEO, хранение `app_settings seo.*`, дефолты из `config/seo.php`).
 - SEO-центр (админ, `AdminSeoController`): `GET /admin/seo` (всё одним запросом), `PUT /admin/seo/global|integrations|pages|robots|sitemap`. Blade `app` получает `$seoHead/$seoIntegrations` (композер в `AppServiceProvider`), Inertia шарит `seo` для SPA (`useSeo` подхватывает переопределения страниц).

## 15. PushSubscription + WebPushService

`POST /push-subscriptions {endpoint,keys.p256dh,keys.auth}` (`throttle:social-write`, `updateOrCreate(endpoint)`), `DELETE` (своя), `POST /test` (`throttle:push-test`). `WebPushService::isConfigured()` — VAPID + `class_exists(WebPush)`. `sendChatMessage` (превью 120, `url /chat/{id}, tag chat-{id}`), `sendFriendRequest (→/chat?tab=requests)`, `sendFriendAccepted (→/chat?tab=friends)`, `sendPinActivity/sendPhotoActivity`, `sendReport`, протухшие подписки удаляются. Всё синхронно после broadcast в `try/catch`.

## 16. WebSocket (Reverb)

**Транспорт:** `BROADCAST_CONNECTION=reverb`. Все 15 событий `ShouldBroadcastNow + InteractsWithSockets` (`toOthers()` — без эха). `broadcast()` в контроллерах в `try/catch + Log::warning` — данные сохранятся без сокета.

**Каналы (`routes/channels.php`):** `chat.{id}` (Private, `hasParticipant`), `user.{id}` (Private, свой), `map` (Public), `online` (Presence, невидимку не пускает, `{id,name,avatar_path}`).

**События:**
- `MessageSent (message.sent)` → `[chat.{cid}, user.{other}]`, `{message: toArrayPayload()+sender}`.
- `MessageRead (message.read)` → `[chat.{cid} + user.{участники}]`, `{conversation_id,user_id,message_ids,read_at}`.
- `MessageDelivered (message.delivered)` → `[chat.{cid}]`. `MessageUpdated/MessageDeleted` → `[chat.{cid}]`.
- `MessagePinned (message.pinned)` → `[chat.{cid}]`, `{message}` (pin и unpin).
- `TypingIndicator (typing)` → `[chat.{cid}]`, `{conversation_id,user_id,is_typing}`.
- `PinCreated (pin.created)/PinUpdated` → `[map]`, `{pin: toPublicArray()}`. `PinDeleted` → `{pinId}`.
- `PinCountersUpdated (map, as pin.activity)` → `{pin_id,reactions_count,comments_count,activity:null}`.
- `PinActivityCreated (user.{owner}, as pin.activity)` → `{pin_id,owner_id,activity}` (только actor≠owner).
- `FriendshipUpdated (friendship.updated)` → `[user.{req}, user.{adr}]`.
- `ReportCreated (user.{adminId}[], as report.created)` → `{report}`.
- `ImpersonationStarted (user.{target}, as impersonation.started)` → `{log:{id,reason,started_at}}`.

**Фронт (`echo.ts`, `useChat/useMap/usePresence`):** `Echo(reverb, key:VITE_REVERB_APP_KEY, authEndpoint:/broadcasting/auth)`, без ключа → `null`. `useChat`: `private(user.{uid})` глобально + `private(chat.{id})` в диалоге, `whisper('typing')` throttle 700мс. `useMap`: `channel('map')` (`.pin.created` + дубль `PinCreated`). `usePresence`: `join('online')`, heartbeat 60с. `BROADCAST_CONNECTION=null/log` — только REST.

## 17. Сервисы

- `PinActivityNotifier`: `counters/reaction/comment/mentions/photoComment/photoMentions`, `excerpt 120`, скип self.
- `Mentions`: `extractIds(@Имя до 4 слов, LOWER match, минус self)`, `notifyableIds()` (минус взаимные блоки).
- `LoginShield`: `COOLDOWN_FAILS=3/60мин/BAN_FAILS=4`, `check/recordFail` (+geo, автобан).
- `IpGeolocation`: `lookup(ip)` через `ip-api.com` (Cache 30д, приватные → null) → `{country,country_code,city}`.
- `CountryResolver`: `assertPinAllowed/assertResidenceAllowed` (Nominatim reverse, Cache 30д, админ bypass).
- `AppSettings`: `get/set (Cache appsettings:)`, `maintenanceEnabled/maintenancePage{title,message}`.
- `MonitoringService (ONLINE_MINUTES=3)`: `overview (cache60с: total/online/visible/invisible/new_today|week|month/active/pins/reports/plans)`, `chart(7-30д)+chartSummary(growth%)`, `online/users`.
- `UpdateLastSeen`, `PruneExpiredPins/PublishScheduledPins/DowngradeExpiredPlans`, `MakeAdmin`, `GenerateVapidKeys (vapid:keys)`.

## 18. Админка + AppUpdates + Impersonation

- `GET /admin/users (+search)`, `PATCH /admin/users/{user} {plan,role}`, `PATCH .../visibility {is_hidden_from_search}`, `POST .../ban {reason} / DELETE .../ban`, `DELETE .../{user}`.
- `GET /admin/monitoring/overview|chart?days|export(xlsx 3 листа)|online|users?filter(all|online|new|hidden|admins)&sort(last_seen|newest|oldest|name)`.
- `GET|PUT /admin/maintenance {enabled,title120,message1000}` (`CheckMaintenanceMode`, `AppSettings`).
- `GET /admin/login-attempts?q&successful(all|failed|success)` (`login_attempts: email,user_id,ip,country,code,city,user_agent512,successful, без updated_at`).
- Impersonation: `POST /admin/users/{user}/impersonate {reason10-500,confirmed}` → `AdminImpersonationLog(admin_id,target,reason,ip,ua,started_at)` + `ImpersonationStarted` в `user.{target}`; `POST /admin/impersonation/stop`; `GET /admin/impersonations?q&filter(all|unread|read)`; `GET /security/impersonations` (своя история) + `POST /security/impersonations/read` (`seen_at`).
- AppUpdates (`app_updates: title200,body10000,version?,is_published,published_at,created_by; app_update_reads: update,user,read_at`): `GET /updates` (20 published + `is_read`), `GET /updates/unread {count,updates[5],latest}`, `POST /updates/{id}/read`, `POST /updates/read-all`; админ `GET|POST /admin/updates`, `PATCH|DELETE /admin/updates/{id}` (`is_published → published_at`).

## 19. Throttle (`AppServiceProvider:36-54`, by user, auth by ip)

`auth-login10, auth-register5, auth-forgot3, auth-reset6, auth-confirm10; pins-write20, pins-index120, comments-write60, messages-write60, pin-toggle60, chat-signal120 (heartbeat/read/delivered/typing), reactions120, chat-search30, social-write60 (категории/фото/дружба/блоки/диалоги/пуши), screen-lock30, reports10, push-test10, profile-write30 (web PATCH/DELETE /profile, POST avatar)`. Группы: api auth `throttle:120,1`, nbrb `60,1`.

## 20. ER-схема

```
User 1—N Pin 1—N PinComment (self parent)
User 1—N Reaction N—1 (Pin|PinComment morph)
Pin 1—N PinView, Pin 1—N PinBoost
User 1—N ZoneSubscription, Business, Report, PushSubscription, ProfilePhoto 1—N Like/Comment
User 1—N PinActivity (actor/owner) N—1 Pin
User N—N UserBlock (blocker/blocked self)
User N—N Friendship (requester/addressee self)
User N—N Conversation (через Participant) 1—N Message
User 1—N AppUpdateRead N—1 AppUpdate, AppSetting(key PK)
User 1—N AdminImpersonationLog (admin/target), LoginAttempt
User 1—N SwipeAction (liker/liked), DatingMatch (user_a/user_b)
User 1—N ReferencePage (created_by/updated_by)
notifications (UUID morphs), subscriptions (stripe), sessions, cache, jobs
```

## 21. ReferencePage — `reference_pages` (справочники)

**Зачем:** контакты, политика конфиденциальности и публичная оферта, редактируемые из админки. Ссылки — в `AppFooter`.

**Поля:** `slug UNIQUE(contacts|privacy|offer), title200, body longtext?, meta json? {company_name,inn,ogrn,address,email,phone,version,effective_date}, attachments json? [{name,path,url,size,uploaded_at}], is_published, published_at, created_by/updated_by NULL nullOnDelete`. Скоупы `published(), bySlug()`, `allowedSlugs()`.

**Как:**
1. Публично (без auth): `GET /api/reference` (список опубликованных `id,slug,title,updated_at`), `GET /api/reference/{slug}` (404 если черновик/нет). Web-страницы `GET /contacts|/privacy|/offer → Inertia Reference {slug}` (имя `contacts|privacy|offer`).
2. Админ (`admin`): `GET|POST /api/admin/reference`, `PATCH|DELETE /api/admin/reference/{page}` (`is_published → published_at`, slug только из `allowedSlugs`, unique).
3. Файлы: `POST /api/admin/reference/{page}/attachments {file ≤10М: pdf,doc,docx,xls,xlsx,png,jpg,jpeg,svg,zip}` → `storage/reference` (disk public) + запись в `attachments`; `DELETE .../attachments/{index}` (404 если нет, файл удаляется с диска).
4. Миграция `2026_09_25_000002_create_reference_pages_table`.

## 22. Дейтинг — `DatingService` + `SwipeController`

**Зачем:** свайпы, мэтчи, квота рандомных чатов. Строго 18+ (`ADULT_AGE`, `assertAdult` → 403 `{age_gate:true, age_gate_reason:missing|underage}`).

**Таблицы:** `swipe_actions(liker_id,liked_id,action like|pass)`, `dating_matches(user_a|user_b orderedPair)`. Поля юзера (`2026_09_26_000002`): `dating_enabled default true, dating_goal?, dating_interests json?, dating_gender_pref default all, dating_hide_name/hide_age (PRO), dating_match_only, random_chats_used/random_chats_month`.

**Как:**
1. `GET /api/swipes/feed?goal&gender(male|female|all)&age_min&age_max&radius_km&interests[]` — исключает себя, просвайпанных (like+pass), скрытых (`hiddenFromSearchFor`), блоки (обе стороны), госта; `dating_enabled=true`; не-админам прячет админов; пол/цель — точное совпадение, пол по умолчанию — сохранённый выбор, иначе противоположный своему; возраст — строго 18+ с обязательной датой рождения (и в явном диапазоне, и по умолчанию: `whereNotNull + birth_date<=threshold`); радиус/интересы — пост-фильтр по `home_lat/lng` (haversine) и пересечению; `with profilePhotos orderBy(sort_order)`, `orderByDesc(last_seen_at)`, лимит 60/20. Ответ `{cards[], quota}`. Сброс фильтров историю не трогает; возврат просмотренных — только `POST /api/swipes/reset-history` (Free — 1 раз, PRO — безлимит).
2. `POST /api/swipes/action {user_id,action}` (`throttle:social-write`) — вся запись в одной транзакции: `updateOrCreate` свайпа (даблклик по unique ловится `QueryException` → перечитывание + `save`); лайк пишется всегда (лимит избранного лайки не блокирует — сверх лимита ждут мэтча, в избранном только свежие по лимиту: Free 3 / Pro 5 / Business 15); `notifyLiked` только за новый лайк (`wasRecentlyCreated || wasChanged('action')`), повторный like тихий; `like → pass` отзывает висящий `dating.liked` (`withdrawLike`); взаимный like → сериализация пары (`lockForUpdate` по ordered user-строкам) + `firstOrCreate DatingMatch` (гонка ловится `QueryException` → существующий) → комната-чат (`matchConversationTx`, переиспользует direct + системное сообщение, квоту не тратит) → уведомляет только создатель мэтча (`isNewMatch`), broadcast/push после коммита → 201 `{matched,match_id,conversation_id}`. Инкогнито скрывает и id (`briefFor`/`actorShape`/`admirers` отдают `null` до мэтча).
3. `GET /api/swipes/matches` (50, с direct-комнатами), `GET /api/swipes/quota`, `PATCH /api/swipes/settings` (`throttle:profile-write`; hide — только PRO иначе 402), `verifyAge` — дата один раз, `before_or_equal:-18y`, повтор → 422.
4. Квоты (`limitFor`): free 3 / pro 10 рандомных сообщений в месяц (`random_chats_used/month`), мэтчи пишут бесплатно; `tryConsumeRandomQuota` → 402 при исчерпании. Вызов из `ConversationController` при создании direct-чата.
5. Фото: `profile_photos.sort_order` (`2026_09_26_000003`, бэкфилл по `created_at`), `ProfilePhoto fillable + sort_order`.
