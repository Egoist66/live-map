<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">Сброс кода скринлокера</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · {{ now()->format('d.m.Y H:i') }}</p>
  <p style="margin: 0 0 8px;">Ты запросил сброс кода блокировки экрана. Введи этот код в приложении:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">{{ $code }}</p>
  <p style="margin: 0; color: #78716c; font-size: 13px;">Код действует {{ $ttlMinutes }} минут. Если ты не запрашивал сброс — просто проигнорируй письмо, код блокировки останется прежним.</p>
</body>
</html>
