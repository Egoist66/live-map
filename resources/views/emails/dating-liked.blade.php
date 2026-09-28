<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">💖 Вас лайкнули, {{ $liked->name }}!</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · {{ now()->format('d.m.Y H:i') }}</p>
  @if($isSuperlike)
    <p style="margin: 0 0 12px;">⭐ Это <b>суперлайк</b> — вы кому-то очень понравились!</p>
  @endif
  @if($isIncognito)
    <p style="margin: 0 0 12px;">🤫 Лайк <b>анонимный</b> («Тайный поклонник»). Автор раскроется при взаимном мэтче.</p>
  @else
    <p style="margin: 0 0 12px;">От кого: <b>{{ $liker->name }}</b></p>
  @endif
  <p style="margin: 16px 0 0;">
    <a href="{{ url('/swipes/admirers') }}" style="display: inline-block; background: #f43f5e; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 9999px;">Кто меня лайкнул</a>
  </p>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Лайкните в ответ — и откроется бесплатный чат (мэтч).</p>
</body>
</html>
