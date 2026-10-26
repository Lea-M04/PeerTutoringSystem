Hello {{ $recipientName }},

{{ $title }}

{{ $body }}
@foreach ($details as $label => $value)
{{ $label }}: {{ $value }}
@endforeach
@if ($actionUrl && $actionLabel)
{{ $actionLabel }}: {{ $actionUrl }}
@endif

Regards,
{{ config('app.name', 'Peer Tutoring Management System') }}
