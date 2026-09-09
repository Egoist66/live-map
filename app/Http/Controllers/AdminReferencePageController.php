<?php

namespace App\Http\Controllers;

use App\Models\ReferencePage;
use Illuminate\Http\Request;

/**
 * Управление справочными страницами из админ-панели.
 */
class AdminReferencePageController extends Controller
{
    public function index()
    {
        $pages = ReferencePage::with('author:id,name')
            ->orderBy('slug')
            ->paginate(20);

        return response()->json($pages);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $published = (bool) ($data['is_published'] ?? false);

        $page = ReferencePage::create([
            'slug' => $data['slug'],
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'meta' => $data['meta'] ?? null,
            'attachments' => $data['attachments'] ?? [],
            'is_published' => $published,
            'published_at' => $published ? now() : null,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($page, 201);
    }

    public function update(Request $request, ReferencePage $referencePage)
    {
        $data = $this->validatePayload($request, $referencePage->id);

        $payload = $data;
        unset($payload['is_published']);

        if (array_key_exists('is_published', $data)) {
            $payload['is_published'] = (bool) $data['is_published'];
            $payload['published_at'] = $payload['is_published'] && ! $referencePage->published_at
                ? now()
                : $referencePage->published_at;
        }

        $payload['updated_by'] = $request->user()->id;

        $referencePage->update($payload);

        return response()->json($referencePage->fresh());
    }

    public function destroy(ReferencePage $referencePage)
    {
        $referencePage->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Загрузка вложения к странице.
     */
    public function uploadAttachment(Request $request, ReferencePage $referencePage)
    {
        $data = $request->validate([
            'file' => 'required|file|max:10240|mimes:pdf,doc,docx,xls,xlsx,png,jpg,jpeg,svg,zip',
        ]);

        $file = $data['file'];
        $path = $file->store('reference', 'public');

        $attachments = $referencePage->attachments ?? [];
        $attachments[] = [
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'url' => '/storage/' . $path,
            'size' => $file->getSize(),
            'uploaded_at' => now()->toISOString(),
        ];

        $referencePage->update([
            'attachments' => $attachments,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($referencePage->fresh(), 201);
    }

    /**
     * Удаление вложения по индексу.
     */
    public function destroyAttachment(Request $request, ReferencePage $referencePage, int $index)
    {
        $attachments = $referencePage->attachments ?? [];

        abort_if(! isset($attachments[$index]), 404);

        $removed = $attachments[$index];
        unset($attachments[$index]);

        $referencePage->update([
            'attachments' => array_values($attachments),
            'updated_by' => $request->user()->id,
        ]);

        if (isset($removed['path'])) {
            \Storage::disk('public')->delete($removed['path']);
        }

        return response()->json($referencePage->fresh());
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        $slugRule = 'required|string|max:50|in:' . implode(',', ReferencePage::allowedSlugs());

        if ($ignoreId) {
            $slugRule .= '|unique:reference_pages,slug,' . $ignoreId;
        } else {
            $slugRule .= '|unique:reference_pages,slug';
        }

        $isUpdate = $ignoreId !== null;

        return $request->validate([
            'slug' => $isUpdate ? str_replace('required|', 'sometimes|', $slugRule) : $slugRule,
            'title' => ($isUpdate ? 'sometimes' : 'required') . '|string|max:200',
            'body' => 'nullable|string|max:100000',
            'meta' => 'nullable|array',
            'meta.company_name' => 'nullable|string|max:200',
            'meta.inn' => 'nullable|string|max:50',
            'meta.ogrn' => 'nullable|string|max:50',
            'meta.address' => 'nullable|string|max:500',
            'meta.email' => 'nullable|string|max:200',
            'meta.phone' => 'nullable|string|max:50',
            'meta.version' => 'nullable|string|max:50',
            'meta.effective_date' => 'nullable|string|max:20',
            'attachments' => 'nullable|array',
            'is_published' => 'sometimes|boolean',
        ]);
    }
}
