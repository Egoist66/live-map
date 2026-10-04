# Кастомные artisan-команды приложения

Только наши команды из `app/Console/Commands/`. Штатные Laravel (`migrate`, `config:cache`, `queue:work`…)
смотри в `artisan.commands.md`.

Запуск всегда из корня проекта: `php artisan <команда> [аргументы] [опции]`.
Справку по любой команде покажет `php artisan help <команда>`.

---

## Администрирование

### `make:admin`
Создать админа или повысить существующего пользователя (все привилегии, тариф Premium).

```bash
php artisan make:admin admin@company.by
php artisan make:admin admin@company.by --password=secret123 --name="Иван"
```

Без аргументов спросит email интерактивно. Пароль можно не указывать — подставится
дефолтный (будет показан в выводе), для существующего юзера смену пароля подтвердишь отдельно.

### `user:delete`
Найти и удалить пользователя по id / email / profile_slug (связи, токены и файлы чистятся
сервисом). Ghost-юзер (ID 4) и админы защищены от случайного сноса.

```bash
php artisan user:delete spam@example.com
php artisan user:delete 123 --force            # без подтверждения
php artisan user:delete boss@company.by --with-admin  # разрешить снос админа
```

⚠️ Безвозвратно. Сначала без `--force`, проверь, кого нашло.

### `service:email`
Показать/сменить почту сервиса (`ADMIN_EMAIL` в `.env`) — туда уходят письма
поддержки, сотрудничества и жалоб (всем `is_admin` + этот адрес).

```bash
php artisan service:email --show              # только показать текущие адреса
php artisan service:email help@company.by     # сменить (спросит подтверждение)
php artisan service:email help@company.by --from --test
```

- `--from` — заодно сменить и `MAIL_FROM_ADDRESS` (адрес «от кого»).
- `--test` — после смены отправить тестовое письмо (проверка SMTP).
- Если конфиг закэширован — сам пересоберёт `config:cache`, иначе `.env` подхватится сам.
- После смены перезапусти RoadRunner / queue-воркеры — долгоживущие процессы старый `.env` не увидят.

---

## Контент и планы (стоят в планировщике, см. `routes/console.php`)

| Команда | Расписание | Что делает |
|---|---|---|
| `pins:publish --limit=100` | каждую минуту | Публикует запланированные пины, у которых наступило `publish_at` |
| `pins:prune` | каждые 5 минут | Истёкшие пины переводит в архив (`expired`), из БД не удаляет |
| `plans:downgrade-expired` | ежедневно | Понижает юзеров с истёкшими платными планами до free |
| `chat:prune-attachments` | ежедневно | Удаляет вложения чатов старше 15 дней (текст и сами чаты не трогает) |
| `video:prune-calls --days=30` | ежедневно | Удаляет метаданные завершённых видеозвонков старше N дней |
| `rewards:weekly-recap` | пн 09:00 | Рассылка недельного дайджеста баллов активности |
| `users:prune-pending-deletion --limit=100` | ежедневно 04:30 | Дотирает аккаунты после 14-дневного grace-периода удаления |

Ручной запуск для проверки — просто без расписания, например:

```bash
php artisan pins:publish
php artisan plans:downgrade-expired
```

---

## Приватность и шифрование

### `chat:encrypt-messages`
Шифрует тексты сообщений чата (AES-256-GCM).

```bash
php artisan chat:encrypt-messages --dry-run   # сначала прогон без записи!
php artisan chat:encrypt-messages --chunk=500
```

### `privacy:encrypt-texts`
Шифрует тексты профилей/пинов и подобного пользовательского контента (AES-256-GCM).

```bash
php artisan privacy:encrypt-texts --dry-run
php artisan privacy:encrypt-texts --chunk=500
```

⚠️ Обе команды сначала гоняй с `--dry-run` и убедись в бэкапе БД.

### `photos:backfill-thumbs`
Догенерировать превью 480px для фото, у которых нет `thumb_path`.

```bash
php artisan photos:backfill-thumbs --dry-run
php artisan photos:backfill-thumbs --chunk=200
```

---

## Telegram и PWA

### `telegram:setup-bot`
Регистрирует бота в Telegram: webhook на `{APP_URL}/api/telegram/webhook`,
24 команды-мегаменю и нативную кнопку меню `commands` у поля ввода.

```bash
php artisan telegram:setup-bot
php artisan telegram:setup-bot --url=https://example.com/api/telegram/webhook --webapp=https://example.com/?tgWebApp=1
```

Требует `TELEGRAM_BOT_TOKEN` в `.env`, иначе откажется работать.

### `pwa:vapid`
Генерирует VAPID-ключи для Web Push (уведомления в браузере/PWA).

```bash
php artisan pwa:vapid
```

Вывод положи в `.env` (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, смотри подсказку команды).
