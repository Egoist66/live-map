<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">💬 Ответ поддержки: {{ $subjectText }}</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · обращение #{{ $ticketId }} · {{ now()->format('d.m.Y H:i') }}</p>
  <p style="margin: 0 0 8px;">Здравствуйте, {{ $senderName }}!</p>
  <div style="margin: 0 0 16px; padding: 12px 14px; background: #f5f5f4; border-radius: 12px;">{{ $replyText }}</div>
  <p style="margin: 0 0 4px; color: #78716c; font-size: 13px;">Ваш вопрос:</p>
  <blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #d6d3d1; color: #57534e; font-size: 13px;">{{ $questionText }}</blockquote>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Если вопрос не закрыт — напишите нам снова из настроек приложения.</p>
</body>
</html>
