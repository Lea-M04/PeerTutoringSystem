<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['message_id', 'storage_disk', 'storage_path', 'mime_type', 'size_bytes', 'width', 'height'])]
class MessageAttachment extends Model
{
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
