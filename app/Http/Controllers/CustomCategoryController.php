<?php

namespace App\Http\Controllers;

use App\Models\CustomCategory;
use App\Services\ContentModeration;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CustomCategoryController extends Controller
{
    public function index()
    {
        return response()->json(
            CustomCategory::orderBy('label')->limit(200)->get()->map(fn ($c) => $c->toPublicArray())
        );
    }

    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isPro() || $user->isAdmin(), 403, 'Свои категории доступны на тарифе Pro и выше.');

        $data = $request->validate([
            'label' => 'required|string|min:2|max:24',
            'icon' => 'nullable|string|max:12',
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        ContentModeration::assertClean($data['label']);

        $base = Str::slug($data['label'], '_');        if ($base === '' || !preg_match('/^[a-z0-9_]+$/', $base)) {
            $base = 'custom';
        }
        $base = substr($base, 0, 24);
        abort_if(in_array($base, \App\Models\Pin::BUILT_IN_CATEGORIES, true), 422, 'Такое название занято встроенной категорией.');

        $slug = $base;
        for ($i = 2; CustomCategory::where('slug', $slug)->exists(); $i++) {
            $slug = substr($base, 0, 28).'_'.$i;
        }

        $cat = CustomCategory::create([
            'user_id' => $user->id,
            'slug' => $slug,
            'label' => trim($data['label']),
            'icon' => $data['icon'] ?? '📍',
            'color' => $data['color'] ?? '#DC2626',
        ]);

        return response()->json($cat->toPublicArray(), 201);
    }

    public function destroy(Request $request, CustomCategory $customCategory)
    {
        abort_unless(
            $request->user()->isAdmin() || $customCategory->user_id === $request->user()->id,
            403, 'Можно удалять только свои категории.'
        );
        $customCategory->delete();
        return response()->json(['ok' => true]);
    }
}
