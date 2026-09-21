<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">💬 Новое сообщение, {{ $recipient->name }}</h2>
  <p style="margin: 0 0 16px; color: #78716c;">UConnect · {{ now()->format('d.m.Y H:i') }}</p>
  <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr><td style="color: #78716c;">От кого</td><td><b>{{ $sender->name }}</b></td></tr>
    <tr><td style="color: #78716c;">Сообщение</td><td>{{ $preview !== '' ? $preview : '📎 вложение' }}</td></tr>
    <tr><td style="color: #78716c;">Автоответ</td><td>✅ Собеседнику отправлено: «Я пока не онлайн, пообщаемся позже»</td></tr>
  </table>
  <p style="margin: 16px 0 0;">
    <a href="{{ url('/chat?c=' . $conversation->id) }}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 9999px;">Открыть чат</a>
  </p>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Отключить автоответ можно в чате: меню диалога → «Автоответ».</p>
</body>
</html>
