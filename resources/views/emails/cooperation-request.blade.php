<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">🤝 Заявка на сотрудничество: {{ $company }}</h2>
  <p style="margin: 0 0 16px; color: #78716c;">UPin · {{ now()->format('d.m.Y H:i') }}</p>
  <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr><td style="color: #78716c;">Компания</td><td><b>{{ $company }}</b></td></tr>
    <tr><td style="color: #78716c;">Email</td><td><a href="mailto:{{ $email }}">{{ $email }}</a></td></tr>
    @if($messageText)
    <tr><td style="color: #78716c;">Сообщение</td><td>{{ $messageText }}</td></tr>
    @endif
  </table>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Компания хотела бы обсудить вопросы сотрудничества — ответьте с почты администратора.</p>
</body>
</html>
