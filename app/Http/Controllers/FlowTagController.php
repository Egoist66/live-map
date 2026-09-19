<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\Request;

/**
 * Хэштеги UFlow: тренды для чипов над лентой.
 */
class FlowTagController extends Controller
{
    /**
     * Топ тегов по числу постов.
     *
     * @param Request $request запрос с limit
     */
    public function trending(Request $request)
    {
        $data = $request->validate([
            'limit' => 'sometimes|integer|min:1|max:20',
        ]);

        $limit = (int) ($data['limit'] ?? 10);

        $tags = Tag::orderByDesc('posts_count')
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'name', 'posts_count']);

        return response()->json(['data' => $tags]);
    }
}
