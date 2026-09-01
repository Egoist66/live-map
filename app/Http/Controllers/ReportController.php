<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'target_type' => 'required|in:pin,comment,user',
            'target_id' => 'required|integer',
            'reason' => 'required|in:spam,abuse,inappropriate,illegal,fake',
            'description' => 'nullable|string|max:1000',
        ]);
        $data['reporter_id'] = $request->user()->id;
        $report = \App\Models\Report::create($data);
        if (\App\Models\Report::where('target_type',$data['target_type'])->where('target_id',$data['target_id'])->where('status','pending')->count() >= 3) {
            if ($data['target_type']==='pin') \App\Models\Pin::where('id',$data['target_id'])->update(['status'=>'archived']);
        }
        return response()->json($report, 201);
    }
}
