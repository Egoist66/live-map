<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">💞 Мэтч, {{ $other->name }}!</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · {{ now()->format('d.m.Y H:i') }}</p>
  <p style="margin: 0 0 12px;">Вы понравились друг другу с <b>{{ $actor->name }}</b> — чат уже создан, лимиты в нём не действуют.</p>
  <p style="margin: 16px 0 0;">
    <a href="{{ url('/chat') }}" style="display: inline-block; background: #f43f5e; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 9999px;">Открыть чат</a>
  </p>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Не тяните с первым сообщением — мэтчи остывают быстро 😉</p>
</body>
</html>
