<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\DatingReview;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\ReviewPendingNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * ÐžÑ‚Ð·Ñ‹Ð²Ñ‹ Ð¾ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑÑ… Ð·Ð½Ð°ÐºÐ¾Ð¼ÑÑ‚Ð²: ÐºÑ‚Ð¾ Ð¼Ð¾Ð¶ÐµÑ‚, ÑÐ²Ð¾Ð´ÐºÐ°, ÑÐ¿Ð¸ÑÐ¾Ðº, Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ñ.
 *
 * ÐžÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð² Ð¼Ð¾Ð¶ÐµÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¾Ð²Ð°Ð²ÑˆÐ¸Ð¹ Ð¿Ð¾-Ð½Ð°ÑÑ‚Ð¾ÑÑ‰ÐµÐ¼Ñƒ:
 * Ð¿Ñ€ÑÐ¼Ð¾Ð¹ Ð´Ð¸Ð°Ð»Ð¾Ð³, Ð³Ð´Ðµ Ð±Ñ‹Ð»Ð¾ Ð½Ðµ Ð¼ÐµÐ½ÑŒÑˆÐµ MESSAGES_MIN_TOTAL ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹
 * (MESSAGES_MIN_PER_SIDE Ñ ÐºÐ°Ð¶Ð´Ð¾Ð¹ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ñ‹). ÐœÑÑ‚Ñ‡ Ð±ÐµÐ· Ð¿ÐµÑ€ÐµÐ¿Ð¸ÑÐºÐ¸ /
 * Ð¿Ð°Ñ€Ð° ÑÐ»Ð¾Ð² Ð² Ñ‡Ð°Ñ‚Ðµ â€” Ð½Ðµ Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ: Ð¼ÐµÑÑ‚ÑŒ-Ð¼Ð¸Ð½ÑƒÑÐºÐ° Ð¸ Ñ„Ð»ÑƒÐ´
 * Ð¾Ñ‚Ð¿Ð°Ð´Ð°ÑŽÑ‚ Ð½Ð° Ð³ÐµÐ¹Ñ‚Ðµ. Ð¡Ð¿Ð°Ð¼-Ð¿Ð¾Ð²ÐµÐ´ÐµÐ½Ð¸Ðµ (Ð´ÑƒÐ±Ð»Ð¸, ÐšÐÐŸÐ¡, Ñ‚ÐµÐ¼Ð¿) Ñ€ÐµÐ¶ÐµÑ‚
 * FloodGuard Ñ ÐºÐ¾Ð½Ñ‚ÐµÐºÑÑ‚Ð¾Ð¼ 'review' Ð² ÐºÐ¾Ð½Ñ‚Ñ€Ð¾Ð»Ð»ÐµÑ€Ðµ.
 *
 * ÐžÐ´Ð¸Ð½ Ð°Ð²Ñ‚Ð¾Ñ€ â€” Ð¾Ð´Ð¸Ð½ Ð¾Ñ‚Ð·Ñ‹Ð². ÐžÑ‚Ð·Ñ‹Ð² Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÐµÐ½ Ñ Ñ‚ÐµÐºÑÑ‚Ð¾Ð¼ Ð¾Ñ‚ BODY_MIN
 * ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð². Ð—Ð²Ñ‘Ð·Ð´Ñ‹ ÑÑ‚Ð°Ð²ÑÑ‚ÑÑ Ñ€Ð°Ð· Ð¸ Ð½Ð°Ð²ÑÐµÐ³Ð´Ð°: Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð°Ñ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ°
 * Ð¼ÐµÐ½ÑÐµÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ñ‚ÐµÐºÑÑ‚, Ð½Ð¾Ð²ÑƒÑŽ Ð¾Ñ†ÐµÐ½ÐºÑƒ Ð¿Ñ€Ð¸Ð¼ÐµÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð».
 * Ð£Ð´Ð°Ð»ÐµÐ½Ð¸Ðµ ÑÐ²Ð¾ÐµÐ³Ð¾ Ð¾Ñ‚Ð·Ñ‹Ð²Ð° Ð¾Ð±Ñ‹Ñ‡Ð½Ñ‹Ð¼ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑÐ¼ Ð·Ð°Ð¿Ñ€ÐµÑ‰ÐµÐ½Ð¾ â€” Ð¸Ð½Ð°Ñ‡Ðµ
 * Ð·Ð°Ð¼Ð¾Ñ€Ð¾Ð·ÐºÑƒ Ð·Ð²Ñ‘Ð·Ð´ Ð¾Ð±Ñ…Ð¾Ð´Ð¸Ð»Ð¸ Ð±Ñ‹ Ñ‡ÐµÑ€ÐµÐ· ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ/Ð¿Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ð·Ð°Ð½Ð¾Ð²Ð¾.
 *
 * ÐœÐ¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ñ Ð´Ð¸Ñ„Ñ„ÐµÑ€ÐµÐ½Ñ†Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ð°Ñ:
 * - Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð» (canModerate) Ð¿ÑƒÐ±Ð»Ð¸ÐºÑƒÐµÑ‚ÑÑ ÑÑ€Ð°Ð·Ñƒ;
 * - 4â€“5â˜… Ð¾Ñ‚ Ñ‚Ñ€Ð°ÑÑ‚Ð¾Ð²Ñ‹Ñ… Ð°Ð²Ñ‚Ð¾Ñ€Ð¾Ð² (trust_score >= AUTO_APPROVE_MIN_TRUST)
 *   â€” Ð°Ð²Ñ‚Ð¾-approve ÑÑ€Ð°Ð·Ñƒ Ð¿Ð¾ÑÐ»Ðµ ÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½Ð½Ð¾Ð¹ ContentModeration;
 * - Ð²ÑÑ‘ Ð¾ÑÑ‚Ð°Ð»ÑŒÐ½Ð¾Ðµ (Ð¿Ñ€ÐµÐ¶Ð´Ðµ Ð²ÑÐµÐ³Ð¾ 1â€“2â˜…) â€” Ñ€ÑƒÑ‡Ð½Ð°Ñ Ð¾Ñ‡ÐµÑ€ÐµÐ´ÑŒ pending:
 *   Ð°Ð´Ð¼Ð¸Ð½/Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ‚Ð¾Ñ€ Ð¾Ð´Ð¾Ð±Ñ€ÑÐµÑ‚ Ð² Ð°Ð´Ð¼Ð¸Ð½ÐºÐµ, Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð» Ð¿Ð¾Ð»ÑƒÑ‡Ð°ÐµÑ‚ realtime
 *   ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ review.created (ÑÐ¾ÐºÐµÑ‚ + polling-Ð·ÐµÑ€ÐºÐ°Ð»Ð¾).
 * Ð¡ÐºÑ€Ñ‹Ñ‚Ð¸Ðµ Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³Ð° â€” Ð¿Ñ€Ð¸Ð²Ð¸Ð»ÐµÐ³Ð¸Ñ Ð¿Ð»Ð°Ñ‚Ð½Ñ‹Ñ… Ñ‚Ð°Ñ€Ð¸Ñ„Ð¾Ð² (dating_hide_rating):
 * ÑÐºÑ€Ñ‹Ñ‚ â€” ÑÐ²Ð¾Ð´ÐºÐ° Ð¸ ÑÐ¿Ð¸ÑÐ¾Ðº Ð½Ðµ Ð¾Ñ‚Ð´Ð°ÑŽÑ‚ÑÑ Ð½Ð¸ÐºÐ¾Ð¼Ñƒ, ÐºÑ€Ð¾Ð¼Ðµ Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†Ð° Ð¸
 * Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð»Ð°, Ð° Ð½Ð¾Ð²Ñ‹Ð¹ Ð¾Ñ‚Ð·Ñ‹Ð² Ñ‚Ð°ÐºÐ¸Ð¼ Ð»ÑŽÐ´ÑÐ¼ Ð¿Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ð½ÐµÐ»ÑŒÐ·Ñ.
 */
class DatingReviewService
{
    /**
     * ÐœÐ¸Ð½Ð¸Ð¼ÑƒÐ¼ Ñ‚ÐµÐºÑÑ‚Ð° Ð¾Ñ‚Ð·Ñ‹Ð²Ð°, ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð²: Ð¾Ñ‚Ð·Ñ‹Ð² Ñ€Ð°ÑÐºÑ€Ñ‹Ð²Ð°ÐµÑ‚, Ð·Ð° Ñ‡Ñ‚Ð¾ Ð¾Ñ†ÐµÐ½ÐºÐ°.
     */
    public const BODY_MIN = 50;

    /**
     * ÐœÐ°ÐºÑÐ¸Ð¼ÑƒÐ¼ Ñ‚ÐµÐºÑÑ‚Ð° Ð¾Ñ‚Ð·Ñ‹Ð²Ð°, ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð².
     */
    public const BODY_LIMIT = 280;

    /**
     * ÐœÐ¸Ð½Ð¸Ð¼ÑƒÐ¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð² Ð¾Ð±Ñ‰ÐµÐ¼ Ð´Ð¸Ð°Ð»Ð¾Ð³Ðµ, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð¼Ð¾Ð¶Ð½Ð¾ Ð±Ñ‹Ð»Ð¾ Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ
     * Ð¾Ñ‚Ð·Ñ‹Ð²: Ð¼ÐµÑÑ‚ÑŒ-Ð¼Ð¸Ð½ÑƒÑÐºÐ° ÑÑ€Ð°Ð·Ñƒ Ð¿Ð¾ÑÐ»Ðµ ÐºÐ¾Ñ€Ð¾Ñ‚ÐºÐ¾Ð¹ Ð¿ÐµÑ€ÐµÐ¿Ð¸ÑÐºÐ¸ Ð¾Ñ‚Ð¿Ð°Ð´Ð°ÐµÑ‚.
     */
    public const MESSAGES_MIN_TOTAL = 10;

    /**
     * ÐœÐ¸Ð½Ð¸Ð¼ÑƒÐ¼ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ñ ÐºÐ°Ð¶Ð´Ð¾Ð¹ Ð¸Ð· ÑÑ‚Ð¾Ñ€Ð¾Ð½ Ð´Ð¸Ð°Ð»Ð¾Ð³Ð°: Ð¾Ð´Ð½Ð¾ÑÑ‚Ð¾Ñ€Ð¾Ð½Ð½Ð¸Ð¹
     * ÑÐ¿Ð°Ð¼ Ð½Ðµ Ð·Ð°ÑÑ‡Ð¸Ñ‚Ñ‹Ð²Ð°ÐµÑ‚ÑÑ, Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ Ð´Ð¾Ð»Ð¶Ð½Ð¾ Ð±Ñ‹Ñ‚ÑŒ Ð´Ð²ÑƒÑÑ‚Ð¾Ñ€Ð¾Ð½Ð½Ð¸Ð¼.
     */
    public const MESSAGES_MIN_PER_SIDE = 3;

    /**
     * ÐÐ²Ñ‚Ð¾-Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ðµ: Ð¾Ñ‚Ð·Ñ‹Ð²Ñ‹ 4â€“5â˜… Ð¾Ñ‚ Ñ‚Ñ€Ð°ÑÑ‚Ð¾Ð²Ñ‹Ñ… Ð°Ð²Ñ‚Ð¾Ñ€Ð¾Ð² Ð¿ÑƒÐ±Ð»Ð¸ÐºÑƒÑŽÑ‚ÑÑ
     * Ð±ÐµÐ· Ñ€ÑƒÑ‡Ð½Ð¾Ð¹ Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ (Ñ€ÑƒÑ‡Ð½Ð°Ñ Ð¾Ñ‡ÐµÑ€ÐµÐ´ÑŒ Ð¾ÑÑ‚Ð°Ñ‘Ñ‚ÑÑ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð½Ð° Ð½Ð¸Ð·ÐºÐ¸Ðµ).
     */
    public const AUTO_APPROVE_MIN_RATING = 4;

    /**
     * ÐŸÐ¾Ñ€Ð¾Ð³ Ñ‚Ñ€Ð°ÑÑ‚-ÑÐºÐ¾Ñ€Ð° Ð°Ð²Ñ‚Ð¾Ñ€Ð° Ð´Ð»Ñ Ð°Ð²Ñ‚Ð¾-Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ñ (1â€“10, Ð·Ð¾Ð½Ð°
     * Â«Ð¥Ð¾Ñ€Ð¾ÑˆÐ¾Â» Ð¸ Ð²Ñ‹ÑˆÐµ â€” TrustScoreService::scoreOf).
     */
    public const AUTO_APPROVE_MIN_TRUST = 7;

    /**
     * ÐœÐ¾Ð¶ÐµÑ‚ Ð»Ð¸ Ð°Ð²Ñ‚Ð¾Ñ€ Ð¾Ñ†ÐµÐ½Ð¸Ñ‚ÑŒ Ñ‡ÐµÐ»Ð¾Ð²ÐµÐºÐ°.
     *
     * ÐÐµÐ»ÑŒÐ·Ñ ÑÐµÐ±Ñ, Ð·Ð°Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ñ‹Ñ… (Ð² Ð»ÑŽÐ±ÑƒÑŽ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ñƒ), ÑÐºÑ€Ñ‹Ð²ÑˆÐ¸Ñ…
     * Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³ Ð¸ Ñ‚ÐµÑ…, Ñ ÐºÐµÐ¼ Ð½Ðµ Ð±Ñ‹Ð»Ð¾ Ð¾ÑÐ¼Ñ‹ÑÐ»ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ: Ð¿Ñ€ÑÐ¼Ð¾Ð¹
     * Ð´Ð¸Ð°Ð»Ð¾Ð³, Ð³Ð´Ðµ Ð²ÑÐµÐ³Ð¾ Ð½Ðµ Ð¼ÐµÐ½ÑŒÑˆÐµ MESSAGES_MIN_TOTAL ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð¸
     * Ñ…Ð¾Ñ‚Ñ Ð±Ñ‹ MESSAGES_MIN_PER_SIDE Ñ ÐºÐ°Ð¶Ð´Ð¾Ð¹ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ñ‹. ÐœÑÑ‚Ñ‡ Ð±ÐµÐ·
     * Ð¿ÐµÑ€ÐµÐ¿Ð¸ÑÐºÐ¸ â€” Ð½Ðµ Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ (Ð³Ð¾Ð»Ñ‹Ðµ Ð¼Ð¸Ð½ÑƒÑÐºÐ¸ ÑÐ¾ ÑÐ²ÐµÐ¶ÐµÐ³Ð¾
     * Ð¼ÑÑ‚Ñ‡Ð° Ð½Ðµ Ð¿ÑƒÐ±Ð»Ð¸ÐºÑƒÑŽÑ‚ÑÑ). ÐÐ´Ð¼Ð¸Ð½Ð°Ð¼ Ð¸ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ‚Ð¾Ñ€Ð°Ð¼ Ð¼Ð¾Ð¶Ð½Ð¾ Ð²ÑÐµÐ³Ð´Ð°:
     * Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ñ Ð¾Ñ‚Ð·Ñ‹Ð²Ð¾Ð² Ð±ÐµÐ· Ð²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾ÑÑ‚Ð¸ Ð¿Ð¾ÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ.
     *
     * @param User $author ÐºÑ‚Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð²Ð°ÐµÑ‚
     * @param User $target ÐºÐ¾Ð³Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð²Ð°ÑŽÑ‚
     * @return bool
     */
    public function canReview(User $author, User $target): bool
    {
        return $this->reviewBlockReason($author, $target) === null;
    }

    /**
     * ÐŸÐ¾Ñ‡ÐµÐ¼Ñƒ Ð¾Ñ‚Ð·Ñ‹Ð² Ð½ÐµÐ»ÑŒÐ·Ñ Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ: Ñ‚ÐµÐºÑÑ‚-Ð¿Ð¾Ð´ÑÐºÐ°Ð·ÐºÐ° Ð¸Ð»Ð¸ null.
     *
     * ÐšÐ°Ð½Ð¾Ð½Ð¸Ñ‡ÐµÑÐºÐ¸Ð¹ Ð¿Ð¾Ñ€ÑÐ´Ð¾Ðº Ð·Ð°Ð¿Ñ€ÐµÑ‚Ð¾Ð²: ÑÐ°Ð¼Ð¾Ð¾Ñ†ÐµÐ½ÐºÐ° â†’ ÑÐºÑ€Ñ‹Ñ‚Ñ‹Ð¹ Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³ â†’
     * Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð»-Ð±Ð°Ð¹Ð¿Ð°Ñ â†’ Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð¾Ð²ÐºÐ¸ â†’ Ð¾ÑÐ¼Ñ‹ÑÐ»ÐµÐ½Ð½Ð¾Ðµ Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ðµ. Ð¡Ñ‚Ð°Ñ„Ñ„
     * Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐµÑ‚ÑÑ Ð´Ð¾ Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð¾Ð²Ð¾Ðº: Ð´Ð°Ð¶Ðµ Ð·Ð°Ð±Ð»Ð¾ÐºÐ¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ð¾Ð¼Ñƒ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ‚Ð¾Ñ€Ñƒ
     * Ð½ÑƒÐ¶Ð½Ð¾ Ð¿Ð¸ÑÐ°Ñ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð²-Ð²Ñ‹Ð²Ð¾Ð´ Ð¿Ð¾ Ð¶Ð°Ð»Ð¾Ð±Ðµ.
     *
     * @param User $author ÐºÑ‚Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð²Ð°ÐµÑ‚
     * @param User $target ÐºÐ¾Ð³Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð²Ð°ÑŽÑ‚
     * @return string|null Ð¿Ñ€Ð¸Ñ‡Ð¸Ð½Ð° Ð·Ð°Ð¿Ñ€ÐµÑ‚Ð° Ð»Ð¸Ð±Ð¾ null ÐºÐ¾Ð³Ð´Ð° Ð¼Ð¾Ð¶Ð½Ð¾
     */
    public function reviewBlockReason(User $author, User $target): ?string
    {
        if ((int) $author->id === (int) $target->id) {
            return 'Ð¡ÐµÐ±Ñ Ð¾Ñ†ÐµÐ½Ð¸Ñ‚ÑŒ Ð½ÐµÐ»ÑŒÐ·Ñ';
        }

        if ((bool) ($target->dating_hide_rating ?? false) && ! $author->canModerate()) {
            return null;
        }

        if ($author->canModerate()) {
            return null;
        }

        $blocked = UserBlock::where(function ($query) use ($author, $target) {
            $query->where(function ($inner) use ($author, $target) {
                $inner->where('blocker_id', $author->id)->where('blocked_id', $target->id);
            })->orWhere(function ($inner) use ($author, $target) {
                $inner->where('blocker_id', $target->id)->where('blocked_id', $author->id);
            });
        })->exists();

        if ($blocked) {
            return null;
        }

        $dialog = Conversation::findDirect((int) $author->id, (int) $target->id);

        if ($dialog === null || ! $this->hasMeaningfulExchange($dialog)) {
            return 'ÐžÑ‚Ð·Ñ‹Ð² Ð¿Ð¾ÑÐ²Ð¸Ñ‚ÑÑ Ð¿Ð¾ÑÐ»Ðµ Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ: Ð½Ðµ Ð¼ÐµÐ½ÑŒÑˆÐµ '
                .self::MESSAGES_MIN_TOTAL.' ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ð¹ Ð² Ð¿ÐµÑ€ÐµÐ¿Ð¸ÑÐºÐµ '
                .'('.self::MESSAGES_MIN_PER_SIDE.' Ñ ÐºÐ°Ð¶Ð´Ð¾Ð¹ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ñ‹)';
        }

        return null;
    }

    /**
     * Ð‘Ñ‹Ð» Ð»Ð¸ Ð² Ð´Ð¸Ð°Ð»Ð¾Ð³Ðµ Ð½Ð°ÑÑ‚Ð¾ÑÑ‰Ð¸Ð¹ Ð´Ð²ÑƒÑÑ‚Ð¾Ñ€Ð¾Ð½Ð½Ð¸Ð¹ Ð¾Ð±Ð¼ÐµÐ½ ÑÐ¾Ð¾Ð±Ñ‰ÐµÐ½Ð¸ÑÐ¼Ð¸.
     *
     * Ð¡Ñ‡Ð¸Ñ‚Ð°ÐµÐ¼ Ð¿Ð¾ Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ðµ messages: Ð¾Ð±Ñ‰Ð¸Ð¹ Ð¸Ñ‚Ð¾Ð³ Ð¸ Ð²ÐºÐ»Ð°Ð´ ÐºÐ°Ð¶Ð´Ð¾Ð¹ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ñ‹.
     * Ð“Ð¾Ð»Ñ‹Ð¹ Ð¼ÑÑ‚Ñ‡ Ð¸ Â«Ð´Ð¸Ð°Ð»Ð¾Ð³Â» Ð¸Ð· Ð¿Ð°Ñ€Ñ‹ ÑÑ‚Ñ€Ð¾Ðº ÑƒÐ²Ð¾Ð´Ð° Ð¾Ñ‚ Ð¾Ñ†ÐµÐ½ÐºÐ¸ Ð½Ðµ ÑÐ¿Ð°ÑÐ°ÑŽÑ‚ â€”
     * Ð¾Ñ‚Ð·Ñ‹Ð² ÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚ÑÑ Ð²Ð¾Ð·Ð¼Ð¾Ð¶ÐµÐ½ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ÑÐ»Ðµ Ñ€ÐµÐ°Ð»ÑŒÐ½Ð¾Ð¹ Ð¿ÐµÑ€ÐµÐ¿Ð¸ÑÐºÐ¸.
     *
     * @param Conversation $dialog direct-Ð´Ð¸Ð°Ð»Ð¾Ð³ Ð¿Ð°Ñ€Ñ‹
     * @return bool true ÐºÐ¾Ð³Ð´Ð° Ð¾Ð±Ð¼ÐµÐ½ Ð´Ð¾ÑÑ‚Ð°Ñ‚Ð¾Ñ‡ÐµÐ½ Ð´Ð»Ñ Ð¾Ñ†ÐµÐ½ÐºÐ¸
     */
    private function hasMeaningfulExchange(Conversation $dialog): bool
    {
        $countsBySender = $dialog->messages()
            ->selectRaw('sender_id, COUNT(*) as messages_count')
            ->groupBy('sender_id')
            ->pluck('messages_count', 'sender_id');

        $total = (int) $countsBySender->sum();
        $activeSenders = $countsBySender
            ->filter(fn ($count): bool => (int) $count > 0)
            ->count();

        $minSideCount = $countsBySender->count() >= 2
            ? (int) $countsBySender->min()
            : 0;

        $enoughTotal = $total >= self::MESSAGES_MIN_TOTAL;
        $bothWrote = $activeSenders >= 2;
        $sidesBalanced = $minSideCount >= self::MESSAGES_MIN_PER_SIDE;

        return $enoughTotal && $bothWrote && $sidesBalanced;
    }

    /**
     * Ð¡Ð²Ð¾Ð´ÐºÐ° Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³Ð° Ñ‡ÐµÐ»Ð¾Ð²ÐµÐºÐ°.
     *
     * Ð¡ÐºÑ€Ñ‹Ñ‚Ñ‹Ð¹ Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³ (PRO+) Ð¾Ñ‚Ð´Ð°Ñ‘Ð¼ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†Ñƒ Ð¸ Ð°Ð´Ð¼Ð¸Ð½Ð°Ð¼:
     * Ð¾ÑÑ‚Ð°Ð»ÑŒÐ½Ñ‹Ð¼ â€” null, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð·Ð²Ñ‘Ð·Ð´Ñ‹ Ð½Ðµ ÑÐ²ÐµÑ‚Ð¸Ð»Ð¸ÑÑŒ Ð² Ð»ÐµÐ½Ñ‚Ðµ.
     *
     * @param User $target Ñ‡ÐµÐ¹ Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³
     * @param User|null $viewer ÐºÑ‚Ð¾ ÑÐ¼Ð¾Ñ‚Ñ€Ð¸Ñ‚ (null â€” Ð³Ð¾ÑÑ‚ÑŒ)
     * @return array{avg:float|null,count:int,hidden:bool}
     */
    public function summary(User $target, ?User $viewer = null): array
    {
        $hidden = (bool) ($target->dating_hide_rating ?? false);
        $isSelf = $viewer !== null && (int) $viewer->id === (int) $target->id;

        if ($hidden && ! $isSelf && ! ($viewer?->canModerate() ?? false)) {
            return ['avg' => null, 'count' => 0, 'hidden' => true];
        }

        $aggregate = DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->selectRaw('COUNT(*) as count, AVG(rating) as avg')
            ->first();

        $count = (int) ($aggregate->count ?? 0);

        if ($count === 0) {
            return ['avg' => null, 'count' => 0, 'hidden' => $hidden];
        }

        return ['avg' => round((float) $aggregate->avg, 1), 'count' => $count, 'hidden' => $hidden];
    }

    /**
     * Ð¡Ð²Ð¾Ð´ÐºÐ¸ ÑÑ€Ð°Ð·Ñƒ Ð´Ð»Ñ Ð¿Ð°Ñ‡ÐºÐ¸ Ð»ÑŽÐ´ÐµÐ¹ (Ð»ÐµÐ½Ñ‚Ð° ÑÐ²Ð°Ð¹Ð¿Ð¾Ð² Ð±ÐµÐ· N+1).
     *
     * Ð¡ÐºÑ€Ñ‹Ñ‚Ñ‹Ðµ Ð¾Ñ‚Ð´Ð°Ñ‘Ð¼ Ð¿ÑƒÑÑ‚Ñ‹Ð¼Ð¸ Ð²ÑÐµÐ¼, ÐºÑ€Ð¾Ð¼Ðµ ÑÐ°Ð¼Ð¸Ñ… Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†ÐµÐ²:
     * Ð² Ð»ÐµÐ½Ñ‚Ðµ Ñ‡ÑƒÐ¶Ð¾Ðµ ÑÐºÑ€Ñ‹Ñ‚Ð¾Ðµ Ð½Ðµ Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð½Ð¸ÐºÐ¾Ð³Ð´Ð°.
     *
     * @param int[] $targetIds id Ð»ÑŽÐ´ÐµÐ¹
     * @param User|null $viewer ÐºÑ‚Ð¾ ÑÐ¼Ð¾Ñ‚Ñ€Ð¸Ñ‚
     * @return array<int, array{avg:float|null,count:int,hidden:bool}> Ð¿Ð¾ id
     */
    public function summariesFor(array $targetIds, ?User $viewer = null): array
    {
        $ids = array_values(array_unique(array_map('intval', $targetIds)));

        if ($ids === []) {
            return [];
        }

        $viewerId = $viewer !== null ? (int) $viewer->id : 0;
        $viewerCanModerate = $viewer !== null && $viewer->canModerate();

        $hiddenIds = [];

        if (! $viewerCanModerate) {
            $hiddenIds = User::whereIn('id', $ids)
                ->where('dating_hide_rating', true)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        $rows = DatingReview::whereIn('target_id', $ids)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->selectRaw('target_id, COUNT(*) as count, AVG(rating) as avg')
            ->groupBy('target_id')
            ->get();

        $result = [];

        foreach ($ids as $id) {
            $result[$id] = ['avg' => null, 'count' => 0, 'hidden' => in_array($id, $hiddenIds, true)];
        }

        foreach ($rows as $row) {
            $id = (int) $row->target_id;

            if (! isset($result[$id])) {
                continue;
            }

            if ($result[$id]['hidden'] && $id !== $viewerId) {
                continue;
            }

            $count = (int) $row->count;

            $result[$id]['count'] = $count;
            $result[$id]['avg'] = $count > 0 ? round((float) $row->avg, 1) : null;
        }

        return $result;
    }

    /**
     * Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð¾Ñ‚Ð·Ñ‹Ð²Ð¾Ð² Ð¾ Ñ‡ÐµÐ»Ð¾Ð²ÐµÐºÐµ (Ð½Ð¾Ð²Ñ‹Ðµ ÑÐ²ÐµÑ€Ñ…Ñƒ).
     *
     * Ð¢Ð¾Ð»ÑŒÐºÐ¾ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð½Ñ‹Ðµ: pending/rejected Ð² ÑÐ¿Ð¸ÑÐ¾Ðº Ð½Ðµ Ð¿Ð¾Ð¿Ð°Ð´Ð°ÑŽÑ‚.
     * Ð¡ÐºÑ€Ñ‹Ñ‚Ñ‹Ð¹ Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³ Ð²Ð¸Ð´ÑÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð²Ð»Ð°Ð´ÐµÐ»ÐµÑ† Ð¸ Ð°Ð´Ð¼Ð¸Ð½Ñ‹.
     * ÐÐ²Ñ‚Ð¾Ñ€ Ð¿Ð¾Ð´Ñ‚ÑÐ³Ð¸Ð²Ð°ÐµÑ‚ÑÑ Ð¼Ð¸Ð½Ð¸-Ð¿Ñ€Ð¾Ñ„Ð¸Ð»ÐµÐ¼ (Ð¸Ð¼Ñ, Ð°Ð²Ð°Ñ‚Ð°Ñ€).
     *
     * @param User $target Ð¾ ÐºÐ¾Ð¼ Ð¾Ñ‚Ð·Ñ‹Ð²Ñ‹
     * @param User|null $viewer ÐºÑ‚Ð¾ ÑÐ¼Ð¾Ñ‚Ñ€Ð¸Ñ‚
     * @param int $perPage Ñ€Ð°Ð·Ð¼ÐµÑ€ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹
     * @return LengthAwarePaginator
     */
    public function listFor(User $target, ?User $viewer = null, int $perPage = 10): LengthAwarePaginator
    {
        $hidden = (bool) ($target->dating_hide_rating ?? false);
        $isSelf = $viewer !== null && (int) $viewer->id === (int) $target->id;

        abort_if($hidden && ! $isSelf && ! ($viewer?->isAdmin() ?? false), 403, 'Ð ÐµÐ¹Ñ‚Ð¸Ð½Ð³ ÑÐºÑ€Ñ‹Ñ‚ Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†ÐµÐ¼');

        return DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->with(['author:id,name,avatar_path,profile_slug'])
            ->latest('id')
            ->paginate($perPage);
    }

    /**
     * Ð¡Ð¾Ð·Ð´Ð°Ñ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð² Ð¸Ð»Ð¸ Ð¿Ð¾Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Ñ‚ÐµÐºÑÑ‚ ÑÐ²Ð¾ÐµÐ³Ð¾.
     *
     * Ð—Ð²Ñ‘Ð·Ð´Ñ‹ Ð·Ð°Ð¼Ð¾Ñ€Ð¾Ð¶ÐµÐ½Ñ‹: Ñƒ ÐºÐ¾Ð³Ð¾ Ð¾Ñ‚Ð·Ñ‹Ð² ÑƒÐ¶Ðµ ÐµÑÑ‚ÑŒ, Ñ‚Ð¾Ñ‚ Ð¼ÐµÐ½ÑÐµÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾
     * Ñ‚ÐµÐºÑÑ‚ â€” Ñ‡ÑƒÐ¶ÑƒÑŽ Ð¾Ñ†ÐµÐ½ÐºÑƒ Ð¿Ð¾Ð²ÐµÑ€Ñ… Ð¿Ñ€Ð¸Ð¼ÐµÑ‚ Ð»Ð¸ÑˆÑŒ Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð». Ð¢ÐµÐºÑÑ‚
     * Ð¾Ð±ÑÐ·Ð°Ñ‚ÐµÐ»ÐµÐ½ (Ð¼Ð¸Ð½Ð¸Ð¼ÑƒÐ¼ BODY_MIN ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð²) â€” Ð³Ð¾Ð»Ñ‹Ðµ Ð¾Ñ†ÐµÐ½ÐºÐ¸ Ð½Ðµ
     * Ð¿ÑƒÐ±Ð»Ð¸ÐºÑƒÐµÐ¼. ÐŸÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸Ñ Ð¿Ð¾ ÑÑ‚Ñ€Ð°Ñ‚Ð°Ð¼: Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð» â€” ÑÑ€Ð°Ð·Ñƒ
     * approved; Ð¿Ð¾Ð·Ð¸Ñ‚Ð¸Ð²Ð½Ñ‹Ðµ 4â€“5â˜… Ð¾Ñ‚ Ñ‚Ñ€Ð°ÑÑ‚Ð¾Ð²Ñ‹Ñ… (trust >= 7) â€”
     * Ð°Ð²Ñ‚Ð¾-approve Ñ Ñ‚ÐµÐ¼Ð¸ Ð¶Ðµ Ð¿Ð¾ÑÐ»ÐµÐ´ÐµÐ¹ÑÑ‚Ð²Ð¸ÑÐ¼Ð¸, Ñ‡Ñ‚Ð¾ Ñ€ÑƒÑ‡Ð½Ð¾Ðµ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ðµ
     * (ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ, Ñ‚Ð³-Ð¿Ð¸Ð½Ð³, ÑˆÑ‚Ñ€Ð°Ñ„ Ñ‚Ñ€Ð°ÑÑ‚Ð° Ñ†ÐµÐ»Ð¸ Ð·Ð° Ð½Ð¸Ð·ÐºÐ¸Ðµ). Ð’ÑÑ‘
     * Ð¿Ñ€Ð¾Ñ‡ÐµÐµ ÑƒÑ…Ð¾Ð´Ð¸Ñ‚ Ð² pending Ð¸ Ð»ÐµÑ‚Ð¸Ñ‚ Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð»Ñƒ realtime-ÑÐ¾Ð±Ñ‹Ñ‚Ð¸ÐµÐ¼
     * review.created Ð´Ð»Ñ Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð² Ð°Ð´Ð¼Ð¸Ð½ÐºÐµ.
     *
     * @param User $author ÐºÑ‚Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð²Ð°ÐµÑ‚
     * @param User $target ÐºÐ¾Ð³Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð²Ð°ÑŽÑ‚
     * @param int|null $rating Ð·Ð²Ñ‘Ð·Ð´Ñ‹ 1â€“5 (null â€” Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ñ‚ÐµÐºÑÑ‚)
     * @param string|null $body Ñ‚ÐµÐºÑÑ‚
     * @return DatingReview
     */
    public function upsert(User $author, User $target, ?int $rating, ?string $body): DatingReview
    {
        $blockReason = $this->reviewBlockReason($author, $target);

        abort_if($blockReason !== null, 422, $blockReason ?? 'ÐžÑ‚Ð·Ñ‹Ð² Ð¼Ð¾Ð¶Ð½Ð¾ Ð¾ÑÑ‚Ð°Ð²Ð¸Ñ‚ÑŒ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ÑÐ»Ðµ Ð¾Ð±Ñ‰ÐµÐ½Ð¸Ñ');

        $existing = DatingReview::where('author_id', $author->id)
            ->where('target_id', $target->id)
            ->first();

        $isStaff = $author->canModerate();

        if ($existing !== null && ! $isStaff) {
            $locked = (int) $existing->rating;

            if ($rating !== null && $rating !== $locked) {
                abort(422, 'Ð—Ð²Ñ‘Ð·Ð´Ñ‹ ÑƒÐ¶Ðµ Ð¿Ð¾ÑÑ‚Ð°Ð²Ð»ÐµÐ½Ñ‹ â€” Ð¼Ð¾Ð¶Ð½Ð¾ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ñ‚ÐµÐºÑÑ‚ Ð¾Ñ‚Ð·Ñ‹Ð²Ð°');
            }

            $rating = $locked;
        }

        if ($rating === null) {
            if ($existing !== null) {
                $rating = (int) $existing->rating;
            } else {
                abort(422, 'ÐŸÐ¾ÑÑ‚Ð°Ð²ÑŒÑ‚Ðµ Ð¾Ñ†ÐµÐ½ÐºÑƒ Ð¾Ñ‚ 1 Ð´Ð¾ 5');
            }
        }

        $clean = $body !== null ? trim((string) $body) : '';

        if (mb_strlen($clean) < self::BODY_MIN) {
            abort(422, 'ÐžÑ‚Ð·Ñ‹Ð² Ð±ÐµÐ· ÐºÐ¾Ð¼Ð¼ÐµÐ½Ñ‚Ð°Ñ€Ð¸Ñ Ð½Ðµ Ð¿Ñ€Ð¸Ð½ÑÑ‚ÑŒ: Ð½Ð°Ð¿Ð¸ÑˆÐ¸ '.self::BODY_MIN.'+ ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð² Ð¾ Ñ‡ÐµÐ»Ð¾Ð²ÐµÐºÐµ');
        }

        if (mb_strlen($clean) > self::BODY_LIMIT) {
            $clean = mb_substr($clean, 0, self::BODY_LIMIT);
        }

        ContentModeration::assertClean($clean);

        $trustedEnough = TrustScoreService::scoreOf($author) >= self::AUTO_APPROVE_MIN_TRUST;
        $autoApprove = ! $isStaff && $rating >= self::AUTO_APPROVE_MIN_RATING && $trustedEnough;

        $review = DatingReview::updateOrCreate(
            ['author_id' => $author->id, 'target_id' => $target->id],
            [
                'rating' => $rating,
                'body' => $clean,
                'status' => ($isStaff || $autoApprove) ? DatingReview::STATUS_APPROVED : DatingReview::STATUS_PENDING,
                'moderator_id' => $isStaff ? $author->id : null,
                'moderated_at' => ($isStaff || $autoApprove) ? now() : null,
            ]
        );

        try {
            \App\Jobs\ModeratePublicContentJob::dispatch('dating_review', (int) $review->id, (int) $author->id, (string) $clean);
        } catch (\Throwable) {
        }

        if ($isStaff) {
            $review->load(['author', 'target']);

            try {
                $this->approve($review, $author);
            } catch (\Throwable) {
            }

            return $review;
        }

        if ($autoApprove) {
            $review->load(['author', 'target']);

            try {
                $this->afterFirstApproval($review->refresh());
            } catch (\Throwable) {
            }

            return $review;
        }

        try {
            $this->notifyStaffPending($review->load(['author', 'target']));
        } catch (\Throwable) {
        }

        return $review;
    }

    /**
     * Ð”Ð¾Ð²ÐµÑÑ‚Ð¸ Ð´Ð¾ Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð»Ð° new pending-Ð¾Ñ‚Ð·Ñ‹Ð²: realtime-ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ðµ
     * review.created Ð¿Ð¾ ÐºÐ°Ð½Ð°Ð»Ñƒ user.{id} ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ‚Ð¾Ñ€Ð° Ð¸
     * Ð°Ð´Ð¼Ð¸Ð½Ð° + inbox-ÑÑ‚Ñ€Ð¾ÐºÐ° Ð´Ð»Ñ Ð¿Ð¾Ð»Ð»ÐµÑ€Ð°. Ð˜Ð´ÐµÐ¼Ð¿Ð¾Ñ‚ÐµÐ½Ñ‚Ð½Ð¾ Ð¿Ð¾
     * dedupeKey ReviewPendingNotification (id + updated_at).
     *
     * @param DatingReview $review Ð¾Ñ‚Ð·Ñ‹Ð² Ð² ÑÑ‚Ð°Ñ‚ÑƒÑÐµ pending
     * @return void
     */
    private function notifyStaffPending(DatingReview $review): void
    {
        $staff = User::query()
            ->where(function ($query) {
                $query->where('is_admin', true)->orWhereIn('role', ['admin', 'moderator']);
            })
            ->get(['id', 'role', 'is_admin']);

        foreach ($staff as $moderator) {
            try {
                UserNotifier::send($moderator, new ReviewPendingNotification($review));
            } catch (\Throwable) {
                // ÐžÑˆÐ¸Ð±ÐºÐ° Ð´Ð¾ÑÑ‚Ð°Ð²ÐºÐ¸ Ð¾Ð´Ð½Ð¾Ð¼Ñƒ Ð¸Ð· Ð¿ÐµÑ€ÑÐ¾Ð½Ð°Ð»Ð° Ð½Ðµ Ñ€Ð¾Ð½ÑÐµÑ‚ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÑƒ.
            }
        }
    }

    /**
     * ÐžÐ´Ð¾Ð±Ñ€Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð² Ð¸Ð· Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ð¸.
     *
     * Ð¢Ð¾Ð»ÑŒÐºÐ¾ Ð¿Ð¾ÑÐ»Ðµ Ð¿ÐµÑ€Ð²Ð¾Ð³Ð¾ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ñ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÑŽÑ‚ÑÑ: ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ
     * Ð¿Ð¾Ð»ÑƒÑ‡Ð°Ñ‚ÐµÐ»ÑŽ, Ñ‚Ð³-Ð¿Ð¸Ð½Ð³ Ð¸ ÑˆÑ‚Ñ€Ð°Ñ„ Ñ‚Ñ€Ð°ÑÑ‚-ÑÐºÐ¾Ñ€Ð° Ð·Ð° 1â€“2 Ð·Ð²ÐµÐ·Ð´Ñ‹.
     * ÐŸÐ¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾Ðµ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ðµ ÑƒÐ¶Ðµ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð½Ð¾Ð³Ð¾ â€” Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ñ„Ð¸ÐºÑÐ°Ñ†Ð¸Ñ Ñ€ÐµÑˆÐµÐ½Ð¸Ñ.
     *
     * @param DatingReview $review Ð¾Ñ‚Ð·Ñ‹Ð² Ñ Ð¿Ð¾Ð´Ð³Ñ€ÑƒÐ¶ÐµÐ½Ð½Ñ‹Ð¼ Ð°Ð²Ñ‚Ð¾Ñ€Ð¾Ð¼ Ð¸ target
     * @param User $moderator ÐºÑ‚Ð¾ Ð¾Ð´Ð¾Ð±Ñ€Ð¸Ð»
     * @return DatingReview
     */
    public function approve(DatingReview $review, User $moderator): DatingReview
    {
        $wasApproved = $review->isApproved();

        $review->forceFill([
            'status' => DatingReview::STATUS_APPROVED,
            'moderator_id' => $moderator->id,
            'moderated_at' => now(),
        ])->save();

        if ($wasApproved) {
            return $review->refresh();
        }

        return $this->afterFirstApproval($review->refresh());
    }

    /**
     * ÐŸÐ¾ÑÐ»ÐµÐ´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ Ð¿ÐµÑ€Ð²Ð¾Ð³Ð¾ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ñ (Ñ€ÑƒÑ‡Ð½Ð¾Ð³Ð¾ Ð¸Ð»Ð¸ Ð°Ð²Ñ‚Ð¾).
     *
     * Ð¨Ñ‚Ñ€Ð°Ñ„ Ñ‚Ñ€Ð°ÑÑ‚Ð° Ñ†ÐµÐ»Ð¸ Ð·Ð° 1â€“2â˜…, ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ Ñ†ÐµÐ»Ð¸ Ñ realtime
     * (dating.reviewed â†’ ÑÐ¾ÐºÐµÑ‚ + polling-Ð·ÐµÑ€ÐºÐ°Ð»Ð¾) Ð¸ Ñ‚Ð³-Ð¿Ð¸Ð½Ð³.
     * Ð’ÑÐµ ÑˆÐ°Ð³Ð¸ Ð² try/catch: ÑÐ°Ð¹Ð´-ÑÑ„Ñ„ÐµÐºÑ‚ Ð½Ðµ Ð²Ð°Ð»Ð¸Ñ‚ Ð¿ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ†Ð¸ÑŽ.
     *
     * @param DatingReview $review Ð¾Ñ‚Ð·Ñ‹Ð² ÑÐ¾ ÑÐ²ÐµÐ¶Ð¸Ð¼ ÑÑ‚Ð°Ñ‚ÑƒÑÐ¾Ð¼ approved
     * @return DatingReview Ñ‚Ð¾Ñ‚ Ð¶Ðµ Ð¾Ñ‚Ð·Ñ‹Ð² (Ð´Ð»Ñ Ñ‡ÐµÐ¹Ð½Ð¸Ð½Ð³Ð°)
     */
    private function afterFirstApproval(DatingReview $review): DatingReview
    {
        $target = $review->target;
        $author = $review->author;

        if ((int) $review->rating <= 2 && $target !== null) {
            try {
                TrustScoreService::penalizeBadReview($target);
            } catch (\Throwable) {
            }
        }

        if ($target !== null && $author !== null) {
            try {
                UserNotifier::send($target, new \App\Notifications\DatingReviewedNotification($author, (int) $target->id, $review));
            } catch (\Throwable) {
            }

            try {
                $authorName = trim((string) ($author->name ?? ''));

                TelegramNotifier::eventPing(
                    $target,
                    'reviews',
                    'â­ ðŸ’˜ <b>ULove</b> â€¢ <b>'.e($authorName !== '' ? $authorName : 'Ð¡Ð¾Ð±ÐµÑÐµÐ´Ð½Ð¸Ðº').'</b> Ð¾Ñ†ÐµÐ½Ð¸Ð»(Ð°) Ñ‚ÐµÐ±Ñ Ð½Ð° '.(int) $review->rating.' Ð¸Ð· 5',
                    '/profile',
                    'Ð¡Ð¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð²',
                    'dating-review:'.(int) $review->id,
                    null
                );
            } catch (\Throwable) {
            }
        }

        return $review;
    }

    /**
     * ÐžÑ‚ÐºÐ»Ð¾Ð½Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð² Ð¸Ð· Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ð¸.
     *
     * ÐžÑ‚ÐºÐ»Ð¾Ð½ÐµÐ½Ð¸Ðµ Ñ€Ð°Ð½ÐµÐµ Ð¾Ð´Ð¾Ð±Ñ€ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰Ð°ÐµÑ‚ Ñ‚Ñ€Ð°ÑÑ‚-ÑÐºÐ¾Ñ€ Ñ†ÐµÐ»Ð¸
     * (ÑˆÑ‚Ñ€Ð°Ñ„ Ð·Ð° 1â€“2 Ð·Ð²ÐµÐ·Ð´Ñ‹ ÑÐ½Ð¸Ð¼Ð°ÐµÐ¼ Ð¾Ð±Ñ€Ð°Ñ‚Ð½Ð¾). ÐÐ²Ñ‚Ð¾Ñ€ Ð¿Ð¾Ð»ÑƒÑ‡Ð°ÐµÑ‚
     * ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ Ð¾ Ñ€ÐµÑˆÐµÐ½Ð¸Ð¸.
     *
     * @param DatingReview $review Ð¾Ñ‚Ð·Ñ‹Ð²
     * @param User $moderator ÐºÑ‚Ð¾ Ð¾Ñ‚ÐºÐ»Ð¾Ð½Ð¸Ð»
     * @return DatingReview
     */
    public function reject(DatingReview $review, User $moderator): DatingReview
    {
        $wasApproved = $review->isApproved();

        $review->forceFill([
            'status' => DatingReview::STATUS_REJECTED,
            'moderator_id' => $moderator->id,
            'moderated_at' => now(),
        ])->save();

        if ($wasApproved) {
            $target = $review->target;

            if ($target !== null && (int) $review->rating <= 2) {
                try {
                    TrustScoreService::adjust($target, 1);
                } catch (\Throwable) {
                }
            }
        }

        try {
            UserNotifier::send($review->author, new \App\Notifications\ReviewModeratedNotification($review));
        } catch (\Throwable) {
        }

        return $review->refresh();
    }

    /**
     * ÐžÑ‡ÐµÑ€ÐµÐ´ÑŒ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ð¸ Ð´Ð»Ñ Ð°Ð´Ð¼Ð¸Ð½ÐºÐ¸: Ð¿Ð°Ñ‡ÐºÐ° Ð¾Ñ‚Ð·Ñ‹Ð²Ð¾Ð² + Ñ‡Ð¸ÑÐ»Ð¾ pending.
     *
     * ÐÐ²Ñ‚Ð¾Ñ€ Ð¸ Ð¿Ð¾Ð»ÑƒÑ‡Ð°Ñ‚ÐµÐ»ÑŒ Ð¿Ð¾Ð´Ñ‚ÑÐ³Ð¸Ð²Ð°ÑŽÑ‚ÑÑ Ð¼Ð¸Ð½Ð¸-Ð¿Ñ€Ð¾Ñ„Ð¸Ð»ÑÐ¼Ð¸ (Ð¸Ð¼Ñ, Ð°Ð²Ð°Ñ‚Ð°Ñ€
     * Ð´Ð»Ñ ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐ¸ Ñ€ÐµÑˆÐµÐ½Ð¸Ñ). Ð¡Ñ‚Ð°Ñ‚ÑƒÑÑ‹: pending|approved|rejected|all.
     *
     * @param User|null $viewer ÑÐ¼Ð¾Ñ‚Ñ€ÑÑ‰Ð¸Ð¹ (null â€” Ð½Ðµ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼: Ñƒ Ð²Ñ‹Ð·Ð¾Ð²Ð° ÑÐ²Ð¾Ð¹ abort)
     * @param string $status Ñ„Ð¸Ð»ÑŒÑ‚Ñ€ Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸
     * @param int $perPage Ñ€Ð°Ð·Ð¼ÐµÑ€ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹
     * @return array{page:LengthAwarePaginator, pending_count:int}
     */
    public function moderationQueue(?string $status = 'pending', int $perPage = 15): array
    {
        $statuses = [
            DatingReview::STATUS_PENDING,
            DatingReview::STATUS_APPROVED,
            DatingReview::STATUS_REJECTED,
        ];

        $chosen = in_array($status, $statuses, true) ? $status : null;

        $query = DatingReview::query()->with(['author:id,name,avatar_path,profile_slug', 'target:id,name,avatar_path,profile_slug']);

        if ($chosen !== null) {
            $query->where('status', $chosen);
        }

        if ($chosen === DatingReview::STATUS_PENDING) {
            // ÐžÑ‡ÐµÑ€ÐµÐ´ÑŒ Ñ Ð¿Ñ€Ð¸Ð¾Ñ€Ð¸Ñ‚ÐµÑ‚Ð¾Ð¼: Ñ…ÑƒÐ´ÑˆÐ¸Ðµ Ð¾Ñ†ÐµÐ½ÐºÐ¸ Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°ÐµÐ¼ Ð¿ÐµÑ€Ð²Ñ‹Ð¼Ð¸ â€”
            // Ð¸Ð¼ÐµÐ½Ð½Ð¾ Ñ‚Ð°Ð¼ Ñ€Ð¸ÑÐº Ð½ÐµÑÐ°Ð½ÐºÑ†Ð¸Ð¾Ð½Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ð¾Ð¹ Ð¼Ð¸Ð½ÑƒÑÐºÐ¸/Ð¼ÐµÑÑ‚Ð¸.
            $query->orderBy('rating')->orderByDesc('id');
        } else {
            $query->latest('id');
        }

        $page = $query->paginate($perPage);

        $pendingCount = DatingReview::where('status', DatingReview::STATUS_PENDING)->count();

        return ['page' => $page, 'pending_count' => $pendingCount];
    }

    /**
     * Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ ÑÐ²Ð¾Ð¹ Ð¾Ñ‚Ð·Ñ‹Ð². ÐžÐ±Ñ‹Ñ‡Ð½Ñ‹Ð¼ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑÐ¼ Ð·Ð°Ð¿Ñ€ÐµÑ‰ÐµÐ½Ð¾:
     * Ð¸Ð½Ð°Ñ‡Ðµ Ð·Ð°Ð¼Ð¾Ñ€Ð¾Ð·ÐºÑƒ Ð·Ð²Ñ‘Ð·Ð´ Ð¾Ð±Ñ…Ð¾Ð´Ð¸Ð»Ð¸ Ð±Ñ‹ ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸ÐµÐ¼ Ð¸ Ð½Ð¾Ð²Ð¾Ð¹ Ð¾Ñ†ÐµÐ½ÐºÐ¾Ð¹.
     * ÐÐ´Ð¼Ð¸Ð½Ñ‹ Ð¸ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ‚Ð¾Ñ€Ñ‹ Ð¼Ð¾Ð³ÑƒÑ‚ Ð²ÑÐµÐ³Ð´Ð°.
     *
     * @param User $author Ð²Ð»Ð°Ð´ÐµÐ»ÐµÑ† Ð¾Ñ‚Ð·Ñ‹Ð²Ð°
     * @param User $target Ð¾ ÐºÐ¾Ð¼ Ð±Ñ‹Ð» Ð¾Ñ‚Ð·Ñ‹Ð²
     * @return bool true ÐºÐ¾Ð³Ð´Ð° Ð±Ñ‹Ð»Ð¾ Ñ‡Ñ‚Ð¾ ÑƒÐ´Ð°Ð»ÑÑ‚ÑŒ
     */
    public function deleteOwn(User $author, User $target): bool
    {
        abort_if(! $author->canModerate(), 403, 'Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ð¾Ñ‚Ð·Ñ‹Ð² Ð½ÐµÐ»ÑŒÐ·Ñ â€” Ð·Ð²Ñ‘Ð·Ð´Ñ‹ ÑÑ‚Ð°Ð²ÑÑ‚ÑÑ Ñ€Ð°Ð· Ð¸ Ð½Ð°Ð²ÑÐµÐ³Ð´Ð°');

        return (bool) DatingReview::where('author_id', $author->id)
            ->where('target_id', $target->id)
            ->delete();
    }

    /**
     * ÐšÑ‚Ð¾ Ð¾Ñ†ÐµÐ½Ð¸Ð» Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†Ð°: ÑÐ²Ð¾Ð´ÐºÐ°, Ñ€Ð°ÑÐºÐ»Ð°Ð´ÐºÐ° Ð¿Ð¾ Ð·Ð²Ñ‘Ð·Ð´Ð°Ð¼, Ð¿Ð¾ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ‡Ð½Ñ‹Ð¹ ÑÐ¿Ð¸ÑÐ¾Ðº.
     *
     * Ð’Ñ‹Ð·Ñ‹Ð²Ð°ÐµÑ‚ÑÑ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð´Ð»Ñ ÑÐµÐ±Ñ (target = me): Ñ‡ÑƒÐ¶Ð¸Ðµ ÑÐ¿Ð¸ÑÐºÐ¸ ÑÐ¼Ð¾Ñ‚Ñ€ÑÑ‚ÑÑ
     * Ð¾Ð±Ñ‹Ñ‡Ð½Ñ‹Ð¼ index. ÐÐ²Ñ‚Ð¾Ñ€ Ð¿Ð¾Ð´Ñ‚ÑÐ³Ð¸Ð²Ð°ÐµÑ‚ÑÑ Ð¼Ð¸Ð½Ð¸-Ð¿Ñ€Ð¾Ñ„Ð¸Ð»ÐµÐ¼ Ð´Ð»Ñ ÑÑÑ‹Ð»ÐºÐ¸.
     *
     * @param User $target Ð²Ð»Ð°Ð´ÐµÐ»ÐµÑ† Ñ€ÐµÐ¹Ñ‚Ð¸Ð½Ð³Ð° (Ð²ÑÐµÐ³Ð´Ð° ÑÐ°Ð¼ ÑÐ¼Ð¾Ñ‚Ñ€ÑÑ‰Ð¸Ð¹)
     * @param int $perPage Ñ€Ð°Ð·Ð¼ÐµÑ€ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹
     * @return array{summary:array,distribution:array<int,int>,page:LengthAwarePaginator}
     */
    public function ratersFor(User $target, int $perPage = 10): array
    {
        $rows = DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->selectRaw('rating, COUNT(*) as count')
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->all();

        $distribution = [];

        for ($stars = 1; $stars <= 5; $stars++) {
            $distribution[$stars] = (int) ($rows[$stars] ?? 0);
        }

        $page = DatingReview::where('target_id', $target->id)
            ->where('status', DatingReview::STATUS_APPROVED)
            ->with(['author:id,name,avatar_path,profile_slug'])
            ->latest('id')
            ->paginate($perPage);

        return [
            'summary' => $this->summary($target, $target),
            'distribution' => $distribution,
            'page' => $page,
        ];
    }

    /**
     * Ð¡ÐµÑ€Ð¸Ð°Ð»Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð¾Ð´Ð½Ð¾Ð³Ð¾ Ð¾Ñ‚Ð·Ñ‹Ð²Ð° Ð´Ð»Ñ Ñ„Ñ€Ð¾Ð½Ñ‚Ð°.
     *
     * @param DatingReview $review Ð¾Ñ‚Ð·Ñ‹Ð² Ñ Ð¿Ð¾Ð´Ð³Ñ€ÑƒÐ¶ÐµÐ½Ð½Ñ‹Ð¼ Ð°Ð²Ñ‚Ð¾Ñ€Ð¾Ð¼
     * @return array<string,mixed>
     */
    public function serialize(DatingReview $review): array
    {
        $author = $review->relationLoaded('author') ? $review->author : null;

        return [
            'id' => (int) $review->id,
            'rating' => (int) $review->rating,
            'body' => $review->body,
            'status' => (string) $review->status,
            'moderation' => ContentModeration::flagsFor($review->body),
            'created_at' => $review->created_at?->toISOString(),
            'author' => $author ? [
                'id' => (int) $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url ?? null,
                'profile_slug' => $author->profile_slug ?? null,
            ] : null,
        ];
    }

    /**
     * Ð¡ÐµÑ€Ð¸Ð°Ð»Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð¾Ñ‚Ð·Ñ‹Ð²Ð° Ð´Ð»Ñ Ð¾Ñ‡ÐµÑ€ÐµÐ´Ð¸ Ð¼Ð¾Ð´ÐµÑ€Ð°Ñ†Ð¸Ð¸ Ð² Ð°Ð´Ð¼Ð¸Ð½ÐºÐµ.
     *
     * Ðš ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐµ Ñ€ÐµÑˆÐµÐ½Ð¸Ñ Ð½ÑƒÐ¶Ð½Ñ‹ Ð°Ð²Ñ‚Ð¾Ñ€, Ð¿Ð¾Ð»ÑƒÑ‡Ð°Ñ‚ÐµÐ»ÑŒ, ÑÑ‚Ð°Ñ‚ÑƒÑ, ÐºÑ‚Ð¾ Ð¸
     * ÐºÐ¾Ð³Ð´Ð° Ð¿Ñ€Ð¸Ð½ÑÐ» Ð¿Ñ€ÐµÐ´Ñ‹Ð´ÑƒÑ‰ÐµÐµ Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ.
     *
     * @param DatingReview $review Ð¾Ñ‚Ð·Ñ‹Ð² Ñ Ð¿Ð¾Ð´Ð³Ñ€ÑƒÐ¶ÐµÐ½Ð½Ñ‹Ð¼ Ð°Ð²Ñ‚Ð¾Ñ€Ð¾Ð¼ Ð¸ target
     * @return array<string,mixed>
     */
    public function serializeForModeration(DatingReview $review): array
    {
        $author = $review->relationLoaded('author') ? $review->author : null;
        $target = $review->relationLoaded('target') ? $review->target : null;

        return [
            'id' => (int) $review->id,
            'rating' => (int) $review->rating,
            'body' => $review->body,
            'status' => (string) $review->status,
            'created_at' => $review->created_at?->toISOString(),
            'moderated_at' => $review->moderated_at?->toISOString(),
            'author' => $author ? [
                'id' => (int) $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url ?? null,
                'profile_slug' => $author->profile_slug ?? null,
            ] : null,
            'target' => $target ? [
                'id' => (int) $target->id,
                'name' => $target->name,
                'avatar_url' => $target->avatar_url ?? null,
                'profile_slug' => $target->profile_slug ?? null,
            ] : null,
        ];
    }
}
