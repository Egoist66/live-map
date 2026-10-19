<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">🆕 Новый пользователь: {{ $userName }}</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · регистрация через {{ $channelLabel }} · {{ now()->format('d.m.Y H:i') }}</p>
  <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr><td style="color: #78716c;">Имя</td><td><b>{{ $userName }}</b></td></tr>
    <tr><td style="color: #78716c;">Email</td><td><a href="mailto:{{ $userEmail }}">{{ $userEmail }}</a></td></tr>
    <tr><td style="color: #78716c;">Тип аккаунта</td><td>{{ $accountTypeLabel }}</td></tr>
    @if($signupGoal !== '')
      <tr><td style="color: #78716c;">Цель захода</td><td>{{ $signupGoal }}</td></tr>
    @endif
    @if($telegramUsername)
      <tr><td style="color: #78716c;">Telegram</td><td>{{ '@'.$telegramUsername }}</td></tr>
    @endif
    @if($registeredAt)
      <tr><td style="color: #78716c;">Создан</td><td>{{ $registeredAt }}</td></tr>
    @endif
  </table>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Письмо отправлено автоматически при регистрации.</p>
</body>
</html>
