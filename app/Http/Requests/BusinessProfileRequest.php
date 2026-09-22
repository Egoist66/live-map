<?php

namespace App\Http\Requests;

use App\Models\Business;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Валидация профиля бизнеса (кабинет, законодательство РБ).
 */
class BusinessProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'legal_form' => ['required', 'string', 'in:' . implode(',', Business::LEGAL_FORMS)],
            'unp' => ['nullable', 'string', 'regex:/^\d{9}$/'],
            'reg_number' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:255'],
            'legal_address' => ['nullable', 'string', 'max:255'],
            'director_name' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'description' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:32'],
            'website' => ['nullable', 'string', 'max:255'],
            'working_hours' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'unp.regex' => 'УНП — строго 9 цифр',
            'legal_form.in' => 'Выберите форму: ООО, ИП, самозанятый и др.',
        ];
    }
}
