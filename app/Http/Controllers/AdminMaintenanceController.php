<?php

namespace App\Http\Controllers;

use App\Services\AppSettings;
use Illuminate\Http\Request;

class AdminMaintenanceController extends Controller
{
    public function show()
    {
        return response()->json([
            'enabled' => AppSettings::maintenanceEnabled(),
            'title' => AppSettings::get('maintenance.title') ?: 'Технические работы',
            'message' => AppSettings::get('maintenance.message') ?: '',
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
            'title' => 'nullable|string|max:120',
            'message' => 'nullable|string|max:1000',
        ]);
        AppSettings::set('maintenance.enabled', $data['enabled'] ? '1' : '0');
        if (array_key_exists('title', $data)) AppSettings::set('maintenance.title', $data['title'] ?: 'Технические работы');
        if (array_key_exists('message', $data)) AppSettings::set('maintenance.message', $data['message'] ?? '');
        return $this->show();
    }
}
