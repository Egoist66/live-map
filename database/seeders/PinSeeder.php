<?php

namespace Database\Seeders;

use App\Models\Pin;
use App\Models\User;
use Illuminate\Database\Seeder;

class PinSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::first() ?? User::factory()->create(['email'=>'demo@livemap.test','plan'=>'premium']);
        $samples = [
            ['Где купить свежий хлеб вечером?','question',53.903,27.561],
            ['Пробка на ул. Немига — объезжайте','warning',53.902,27.559],
            ['Зову играть в волейбол в парке Горького через час','event',53.905,27.565],
            ['Отдам коляску, самовывоз','offer',53.900,27.560],
            ['Нужна помощь донести вещи до подъезда','help',53.904,27.568],
            ['Кофейня «Угол» — сегодня скидка 20%','announcement',53.901,27.562],
        ];
        foreach ($samples as [$title,$cat,$lat,$lng]) {
            Pin::create(['user_id'=>$user->id,'title'=>$title,'body'=>'Демо пин','category'=>$cat,'latitude'=>$lat,'longitude'=>$lng,'radius_meters'=>1000,'expires_at'=>now()->addHours(2)]);
        }
    }
}
