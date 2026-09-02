<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required','string','lowercase','email','max:255', Rule::unique(User::class)->ignore($this->user()->id)],
            'home_lat' => ['nullable','numeric','between:-90,90'],
            'home_lng' => ['nullable','numeric','between:-180,180'],
            'home_radius_km' => ['nullable','integer','min:1','max:20'],
            'is_anonymous_default' => ['nullable','boolean'],
            'avatar_path' => ['nullable','string','max:255'],
            'plan' => ['nullable','in:free,pro,business'],
        ];
    }
}
