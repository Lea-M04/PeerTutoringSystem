<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class ChatImageProcessor
{
    /**
     * @return array{contents: string, extension: string, mime_type: string, width: int, height: int, size_bytes: int}
     */
    public function process(UploadedFile $upload): array
    {
        $contents = file_get_contents($upload->getRealPath());
        $imageInfo = $contents === false ? false : @getimagesizefromstring($contents);
        $allowedTypes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];

        if (! is_array($imageInfo)
            || ! isset($allowedTypes[$imageInfo['mime'] ?? ''])
            || $imageInfo[0] < 1
            || $imageInfo[1] < 1
            || $imageInfo[0] > 6000
            || $imageInfo[1] > 6000
            || ($imageInfo[0] * $imageInfo[1]) > 12_000_000
            || $upload->getMimeType() !== $imageInfo['mime']) {
            throw ValidationException::withMessages([
                'attachment' => 'Choose a valid JPEG, PNG, or WebP image within the supported dimensions.',
            ]);
        }

        $image = $contents === false ? false : @imagecreatefromstring($contents);
        if (! $image instanceof \GdImage) {
            throw ValidationException::withMessages([
                'attachment' => 'The selected image could not be decoded.',
            ]);
        }

        ob_start();
        try {
            $encoded = match ($imageInfo['mime']) {
                'image/jpeg' => imagejpeg($image, null, 88),
                'image/png' => imagepng($image, null, 6),
                'image/webp' => function_exists('imagewebp') && imagewebp($image, null, 82),
            };
            $normalizedContents = ob_get_contents();
        } finally {
            ob_end_clean();
            imagedestroy($image);
        }

        if (! $encoded || ! is_string($normalizedContents) || strlen($normalizedContents) > 5 * 1024 * 1024) {
            throw ValidationException::withMessages([
                'attachment' => 'The image could not be safely processed within the 5 MiB limit.',
            ]);
        }

        return [
            'contents' => $normalizedContents,
            'extension' => $allowedTypes[$imageInfo['mime']],
            'mime_type' => $imageInfo['mime'],
            'width' => $imageInfo[0],
            'height' => $imageInfo[1],
            'size_bytes' => strlen($normalizedContents),
        ];
    }
}
