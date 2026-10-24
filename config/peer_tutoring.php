<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
    'tutor_application' => [
        'transcript_max_kb' => max(1, (int) env('TUTOR_APPLICATION_TRANSCRIPT_MAX_KB', 10240)),
    ],
    'initial_admin' => [
        'email' => env('INITIAL_ADMIN_EMAIL'),
        'password' => env('INITIAL_ADMIN_PASSWORD'),
    ],
];
