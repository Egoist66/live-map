<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1c1917; line-height: 1.5;">
  <h2 style="margin: 0 0 8px;">🚨 Новая жалоба #{{ $report->id }}</h2>
  <p style="margin: 0 0 16px; color: #78716c;">UPin · {{ now()->format('d.m.Y H:i') }}</p>
  <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr><td style="color: #78716c;">Тип</td><td><b>{{ $report->target_type }} #{{ $report->target_id }}</b></td></tr>
    @php($title = $report->targetTitle())
    @if($title)
    <tr><td style="color: #78716c;">Объект</td><td>{{ $title }}</td></tr>
    @endif
    <tr><td style="color: #78716c;">Причина</td><td><b>{{ $reasons[$report->reason] ?? $report->reason }}</b></td></tr>
    @if($report->description)
    <tr><td style="color: #78716c;">Описание</td><td>{{ $report->description }}</td></tr>
    @endif
    <tr><td style="color: #78716c;">Отправитель</td><td>{{ $report->reporter?->name }} ({{ $report->reporter?->email }})</td></tr>
  </table>
  <p style="margin: 16px 0 0; color: #78716c; font-size: 13px;">Разобрать жалобу можно в админке: Настройки → Админ → Жалобы.</p>
</body>
</html>
