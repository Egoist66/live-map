<?php

namespace App\Services;

/**
 * Каталог заданий для PRO-недели.
 *
 * Два трека на выбор: пины (ULove) и свайпы (ULove).
 * Каждый трек — 5 заданий с нарастающей сложностью.
 * Задания проверяются по реальным действиям в БД за текущий цикл,
 * «на отмашку» закрыть нельзя: нужны реакции, мэтчи, диалоги.
 */
class QuestCatalog
{
    /**
     * Все задания по трекам.
     *
     * @return array{pins: array, swipes: array}
     */
    public static function all(): array
    {
        return [
            'pins' => self::pins(),
            'swipes' => self::swipes(),
        ];
    }

    /**
     * Задания трека пинов.
     *
     * @return array<int, array{code:string,title:string,desc:string,hint:string,xp:int,target:int,icon:string}>
     */
    public static function pins(): array
    {
        return [
            [
                'code' => 'pins_first',
                'title' => 'Первая афиша',
                'desc' => 'Создай свой первый пин-встречу с местом и временем',
                'hint' => 'Карта → «+» → место, время, категория',
                'xp' => 50,
                'target' => 1,
                'icon' => 'pi pi-map-marker',
            ],
            [
                'code' => 'pins_reactions',
                'title' => 'Собиратель сердец',
                'desc' => 'Собери 10 реакций на свои пины от других людей',
                'hint' => 'Яркий заголовок + фото собирают больше реакций',
                'xp' => 100,
                'target' => 10,
                'icon' => 'pi pi-heart',
            ],
            [
                'code' => 'pins_comments',
                'title' => 'Живое обсуждение',
                'desc' => 'Получи 5 комментариев под своими пинами',
                'hint' => 'Задай вопрос в описании пина — люди отвечают',
                'xp' => 100,
                'target' => 5,
                'icon' => 'pi pi-comments',
            ],
            [
                'code' => 'pins_invites',
                'title' => 'Зазывала',
                'desc' => 'Пригласи 3 человек в свои пины через инвайты',
                'hint' => 'Открой пин → «Пригласить» → выбери друзей',
                'xp' => 150,
                'target' => 3,
                'icon' => 'pi pi-send',
            ],
            [
                'code' => 'pins_series',
                'title' => 'Серия из 5',
                'desc' => 'Создай 5 пинов за этот цикл — докажи, что ты организатор',
                'hint' => 'Разные категории: спорт, еда, прогулка, кино, помощь',
                'xp' => 150,
                'target' => 5,
                'icon' => 'pi pi-trophy',
            ],
        ];
    }

    /**
     * Задания трека свайпов.
     *
     * @return array<int, array{code:string,title:string,desc:string,hint:string,xp:int,target:int,icon:string}>
     */
    public static function swipes(): array
    {
        return [
            [
                'code' => 'swipes_profile',
                'title' => 'Анкета-магнит',
                'desc' => 'Заполни анкету: «О себе», 3 интереса и минимум 1 фото',
                'hint' => 'Свайпы → Анкета → о себе, интересы, фото в профиле',
                'xp' => 50,
                'target' => 1,
                'icon' => 'pi pi-user-edit',
            ],
            [
                'code' => 'swipes_swipes30',
                'title' => 'Разведчик',
                'desc' => 'Сделай 30 свайпов: лайки и пасы считаются вместе',
                'hint' => 'Листай ленту каждый день — это честная активность',
                'xp' => 100,
                'target' => 30,
                'icon' => 'pi pi-sync',
            ],
            [
                'code' => 'swipes_admirers5',
                'title' => 'Харизма',
                'desc' => 'Получи 5 лайков от других людей',
                'hint' => 'Хорошее фото и заполненная анкета решают',
                'xp' => 150,
                'target' => 5,
                'icon' => 'pi pi-heart-fill',
            ],
            [
                'code' => 'swipes_matches3',
                'title' => 'Три мэтча',
                'desc' => 'Добейся 3 взаимных мэтчей',
                'hint' => 'Лайкай тех, кто уже лайкнул тебя во вкладке «Лайки мне»',
                'xp' => 150,
                'target' => 3,
                'icon' => 'pi pi-users',
            ],
            [
                'code' => 'swipes_chats3',
                'title' => 'Первый шаг',
                'desc' => 'Начни 3 диалога после мэтча — напиши первым',
                'hint' => 'Мэтч открывает чат: поздоровайся и задай вопрос',
                'xp' => 150,
                'target' => 3,
                'icon' => 'pi pi-comment',
            ],
        ];
    }

    /**
     * Найти задание по треку и коду.
     *
     * @param string $track
     * @param string $code
     * @return array|null
     */
    public static function find(string $track, string $code): ?array
    {
        foreach (self::all()[$track] ?? [] as $quest) {
            if ($quest['code'] === $code) {
                return $quest;
            }
        }

        return null;
    }
}
