<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">🛟 Обращение в поддержку: {{ $subjectText }}</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · {{ now()->format('d.m.Y H:i') }}</p>
  <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr><td style="color: #78716c;">От</td><td><b>{{ $senderName }}</b></td></tr>
    <tr><td style="color: #78716c;">Email</td><td><a href="mailto:{{ $senderEmail }}">{{ $senderEmail }}</a></td></tr>
    <tr><td style="color: #78716c;">Тема</td><td><b>{{ $subjectText }}</b></td></tr>
    <tr><td style="color: #78716c;">Сообщение</td><td>{{ $messageText }}</td></tr>
  </table>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Пользователь ждёт ответа — ответьте с почты администратора.</p>
</body>
</html>
