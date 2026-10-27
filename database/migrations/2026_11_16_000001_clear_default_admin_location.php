<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Убирает устаревшую московскую точку, которую старый AdminSeeder
 * и MakeAdmin ставили администратору по умолчанию.
 *
 * Из-за неё расстояния в свайпах считались от Москвы, хотя сам админ
 * мог находиться в Минске: карточка показывала «663 км» до человека
 * рядом. Чистим только точный сейвер-дефолт, если город/страна не
 * указывают на Москву и Россию. Реальную московскую точку и другие
 * заполненные локации не трогаем.
 */
return new class extends Migration
{
    /**
     * Старые координаты Москвы из AdminSeeder/MakeAdmin.
     */
    private const DEFAULT_LAT = 55.7558;

    /**
     * Старые координаты Москвы из AdminSeeder/MakeAdmin.
     */
    private const DEFAULT_LNG = 37.6173;

    /**
     * Удалить сейвер-дефолт у администраторов с немосковской локацией.
     *
     * @return void
     */
    public function up(): void
    {
        $query = DB::table('users')
            ->where('is_admin', true)
            ->where('home_lat', self::DEFAULT_LAT)
            ->where('home_lng', self::DEFAULT_LNG)
            ->where(function ($query): void {
                $query->whereNull('home_city')
                    ->orWhere('home_city', '')
                    ->orWhereNotIn('home_city', ['Москва', 'Moscow']);
            })
            ->where(function ($query): void {
                $query->whereNull('country')
                    ->orWhere('country', '')
                    ->orWhereNotIn('country', ['Россия', 'Russia', 'РФ']);
            })
            ->where(function ($query): void {
                $query->whereNull('home_address')
                    ->orWhere('home_address', '')
                    ->orWhere(function ($addressQuery): void {
                        $addressQuery->where('home_address', 'not like', '%Москва%')
                            ->where('home_address', 'not like', '%Moscow%');
                    });
            });

        $query->update([
            'home_lat' => null,
            'home_lng' => null,
            'latitude' => null,
            'longitude' => null,
        ]);
    }

    /**
     * Откат не восстанавливает ошибочную точку.
     *
     * @return void
     */
    public function down(): void
    {
        //
    }
};
