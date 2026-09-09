<?php

namespace App\Http\Controllers;

use App\Models\ReferencePage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Принятие публичной оферты пользователем.
 *
 * Фиксирует факт и версию оферты, чтобы при первом входе
 * показать окно согласия, а дальше не беспокоить.
 */
class TermsController extends Controller
{
    /**
     * Сохранить согласие пользователя с действующей офертой.
     */
    public function accept(Request $request): RedirectResponse
    {
        $version = ReferencePage::query()
            ->bySlug(ReferencePage::SLUG_OFFER)
            ->value('meta->version');

        $request->user()->forceFill([
            'terms_accepted_at' => now(),
            'terms_version' => is_string($version) ? $version : '1.0',
        ])->save();

        return back();
    }
}
