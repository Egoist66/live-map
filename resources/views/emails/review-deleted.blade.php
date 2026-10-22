<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">⭐ Твой отзыв ULove удалён модератором</h2>
  <p style="margin: 0 0 16px; color: #78716c;">ULove · {{ now()->format('d.m.Y H:i') }}</p>
  <p style="margin: 0 0 12px;">Здравствуйте, {{ $author->name }}!</p>
  <p style="margin: 0 0 12px;">Модерация удалила твой отзыв <b>#{{ $reviewId }}</b> — оценка <b>{{ $rating }} из 5</b>@if($excerpt) «{{ $excerpt }}»@endif. Рейтинг получателя пересчитан, сам отзыв больше нигде не виден.</p>
  <p style="margin: 0 0 12px;">Объяснение модератора:</p>
  <p style="margin: 0 0 16px; padding: 12px 14px; background: #f5f5f4; border-radius: 10px; border-left: 3px solid #f97316;"><b>{{ $reason }}</b></p>
  <p style="margin: 0 0 8px;">Правила простые:</p>
  <ul style="margin: 0 0 16px; padding-left: 20px; color: #44403c;">
    <li>отзыв пишется по делу и без мата — без травли, оскорблений и личных данных;</li>
    <li>звёзды ставятся раз и навсегда, а текст — нейтральный и честный;</li>
    <li>спорное решение — напиши в поддержку через Настройки → Поддержка.</li>
  </ul>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Спасибо, что помогаешь сообществу быть честным и добрым.</p>
</body>
</html>
