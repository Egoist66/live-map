<?php

namespace App\Http\Controllers;

use App\Models\AppUpdate;
use Illuminate\Http\Request;

class AdminAppUpdateController extends Controller
{
    public function index()
    {
        $updates = AppUpdate::with('author:id,name')->latest()->paginate(20);
        $updates->getCollection()->transform(fn ($u) => array_merge($u->toArray(), [
            'reads_count' => $u->reads()->count(),
        ]));
        return response()->json($updates);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'body' => 'required|string|max:10000',
            'version' => 'nullable|string|max:50',
            'is_published' => 'nullable|boolean',
        ]);
        $published = (bool) ($data['is_published'] ?? false);
        $update = AppUpdate::create([
            'title' => $data['title'],
            'body' => $data['body'],
            'version' => $data['version'] ?? null,
            'is_published' => $published,
            'published_at' => $published ? now() : null,
            'created_by' => $request->user()->id,
        ]);
        return response()->json($update, 201);
    }

    public function update(Request $request, AppUpdate $appUpdate)
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:200',
            'body' => 'sometimes|string|max:10000',
            'version' => 'nullable|string|max:50',
            'is_published' => 'sometimes|boolean',
        ]);
        if (array_key_exists('is_published', $data)) {
            $data['published_at'] = $data['is_published'] && ! $appUpdate->published_at ? now() : $appUpdate->published_at;
        }
        $appUpdate->update($data);
        return response()->json($appUpdate->fresh());
    }

    public function destroy(AppUpdate $appUpdate)
    {
        $appUpdate->delete();
        return response()->json(['ok' => true]);
    }
}
