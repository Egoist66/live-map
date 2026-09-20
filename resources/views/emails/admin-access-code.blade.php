<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">🔐 Вход в панель модерации</h2>
  <p style="margin: 0 0 16px; color: #78716c;">UPin · {{ now()->format('d.m.Y H:i') }}</p>
  <p style="margin: 0 0 8px;">Твой одноразовый код:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">{{ $code }}</p>
  <p style="margin: 0; color: #78716c; font-size: 13px;">Код действует {{ $ttlMinutes }} минут. Если это не ты — просто проигнорируй письмо.</p>
</body>
</html>
