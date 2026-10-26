<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background: #f4f7f7; color: #24313b; font-family: Arial, sans-serif;">
    <main style="max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px;">
        <p>Hello {{ $recipientName }},</p>
        <h1 style="font-size: 22px; line-height: 1.3;">{{ $title }}</h1>
        <p style="line-height: 1.6;">{{ $body }}</p>

        @if ($details !== [])
            <dl style="margin: 24px 0;">
                @foreach ($details as $label => $value)
                    <dt style="margin-top: 12px; color: #52616b; font-size: 13px;">{{ $label }}</dt>
                    <dd style="margin: 4px 0 0;">{{ $value }}</dd>
                @endforeach
            </dl>
        @endif

        @if ($actionUrl && $actionLabel)
            <p style="margin: 28px 0;">
                <a href="{{ $actionUrl }}" style="display: inline-block; padding: 12px 18px; background: #264653; color: #ffffff; border-radius: 6px; text-decoration: none;">{{ $actionLabel }}</a>
            </p>
        @endif

        <p style="margin-top: 32px; line-height: 1.6;">Regards,<br>{{ config('app.name', 'Peer Tutoring Management System') }}</p>
    </main>
</body>
</html>
