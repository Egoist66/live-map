<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Выданная награда за активность.
 *
 * Одна строка = одно оплаченное действие за неделю. Повтор того же
 * действия над тем же объектом в ту же неделю упирается в уникальный
 * ключ и очков не даёт — так закрыто шулерство вида
 * «снял лайк → поставил → снова +1» или «удалил коммент → написал заново».
 *
 * @property int $id
 * @property int $user_id
 * @property string $action код действия из ActivityRewards::REWARDS
 * @property string $target_type тип объекта (flow_post, pin, user…)
 * @property int $target_id id объекта (0 — без привязки, только кап)
 * @property string $meta доп. измерение (например id лайкнувшего для бонуса автору)
 * @property string $week_key неделя в формате o-W (ISO, понедельник — воскресенье)
 * @property int $points сколько очков выдано
 */
class ActivityRewardClaim extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'target_type',
        'target_id',
        'meta',
        'week_key',
        'points',
    ];
}
