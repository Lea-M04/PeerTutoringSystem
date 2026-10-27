<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Review;
use App\Models\Role;
use App\Models\Subject;
use App\Models\TutorApplication;
use App\Models\TutorAvailability;
use App\Models\TutorProfile;
use App\Models\TutorSubject;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DevelopmentDemoSeeder extends Seeder
{
    // This shared password is for fictional local demo accounts only.
    private const DEVELOPMENT_PASSWORD = 'PeerTutorDemo2026!';

    /**
     * @var array<int, array{name: string, email: string, first_name: string, last_name: string, faculty: string, program: string, year: int}>
     */
    private const STUDENTS = [
        ['name' => 'Arta Berisha', 'email' => 'arta.berisha@student.peertutoring.test', 'first_name' => 'Arta', 'last_name' => 'Berisha', 'faculty' => 'Faculty of Computer Science', 'program' => 'Software Engineering', 'year' => 2],
        ['name' => 'Luan Krasniqi', 'email' => 'luan.krasniqi@student.peertutoring.test', 'first_name' => 'Luan', 'last_name' => 'Krasniqi', 'faculty' => 'Faculty of Electrical Engineering', 'program' => 'Computer Engineering', 'year' => 3],
        ['name' => 'Drita Gashi', 'email' => 'drita.gashi@student.peertutoring.test', 'first_name' => 'Drita', 'last_name' => 'Gashi', 'faculty' => 'Faculty of Mathematics', 'program' => 'Applied Mathematics', 'year' => 2],
        ['name' => 'Blerim Hoxha', 'email' => 'blerim.hoxha@student.peertutoring.test', 'first_name' => 'Blerim', 'last_name' => 'Hoxha', 'faculty' => 'Faculty of Computer Science', 'program' => 'Information Technology', 'year' => 1],
        ['name' => 'Elira Shala', 'email' => 'elira.shala@student.peertutoring.test', 'first_name' => 'Elira', 'last_name' => 'Shala', 'faculty' => 'Faculty of Economics', 'program' => 'Business Informatics', 'year' => 3],
        ['name' => 'Arben Mustafa', 'email' => 'arben.mustafa@student.peertutoring.test', 'first_name' => 'Arben', 'last_name' => 'Mustafa', 'faculty' => 'Faculty of Natural Sciences', 'program' => 'Physics', 'year' => 2],
        ['name' => 'Vesa Rexha', 'email' => 'vesa.rexha@student.peertutoring.test', 'first_name' => 'Vesa', 'last_name' => 'Rexha', 'faculty' => 'Faculty of Philology', 'program' => 'English Language', 'year' => 1],
        ['name' => 'Drin Morina', 'email' => 'drin.morina@student.peertutoring.test', 'first_name' => 'Drin', 'last_name' => 'Morina', 'faculty' => 'Faculty of Computer Science', 'program' => 'Data Science', 'year' => 3],
        ['name' => 'Lira Bytyqi', 'email' => 'lira.bytyqi@student.peertutoring.test', 'first_name' => 'Lira', 'last_name' => 'Bytyqi', 'faculty' => 'Faculty of Mathematics', 'program' => 'Statistics', 'year' => 2],
        ['name' => 'Gent Haliti', 'email' => 'gent.haliti@student.peertutoring.test', 'first_name' => 'Gent', 'last_name' => 'Haliti', 'faculty' => 'Faculty of Computer Science', 'program' => 'Software Engineering', 'year' => 3],
    ];

    /**
     * @var array<int, array{name: string, email: string, first_name: string, last_name: string, faculty: string, program: string, year: int, subjects: array<int, int>}>
     */
    private const TUTORS = [
        ['name' => 'Nora Krasniqi', 'email' => 'nora.krasniqi@tutor.peertutoring.test', 'first_name' => 'Nora', 'last_name' => 'Krasniqi', 'faculty' => 'Faculty of Computer Science', 'program' => 'Software Engineering', 'year' => 4, 'subjects' => [0, 1]],
        ['name' => 'Ilir Berisha', 'email' => 'ilir.berisha@tutor.peertutoring.test', 'first_name' => 'Ilir', 'last_name' => 'Berisha', 'faculty' => 'Faculty of Mathematics', 'program' => 'Applied Mathematics', 'year' => 4, 'subjects' => [2, 3]],
        ['name' => 'Mira Gashi', 'email' => 'mira.gashi@tutor.peertutoring.test', 'first_name' => 'Mira', 'last_name' => 'Gashi', 'faculty' => 'Faculty of Natural Sciences', 'program' => 'Physics', 'year' => 4, 'subjects' => [4, 5]],
        ['name' => 'Luan Shala', 'email' => 'luan.shala@tutor.peertutoring.test', 'first_name' => 'Luan', 'last_name' => 'Shala', 'faculty' => 'Faculty of Computer Science', 'program' => 'Information Technology', 'year' => 4, 'subjects' => [0, 6]],
        ['name' => 'Era Mustafa', 'email' => 'era.mustafa@tutor.peertutoring.test', 'first_name' => 'Era', 'last_name' => 'Mustafa', 'faculty' => 'Faculty of Philology', 'program' => 'English Language', 'year' => 4, 'subjects' => [6, 7]],
    ];

    /** @var array<int, array{name: string, description: string}> */
    private const SUBJECTS = [
        ['name' => 'Computer Science', 'description' => 'Programming fundamentals, data structures, and problem solving.'],
        ['name' => 'Database Systems', 'description' => 'Relational design, SQL queries, and database fundamentals.'],
        ['name' => 'Mathematics', 'description' => 'Core university mathematics and guided problem solving.'],
        ['name' => 'Statistics', 'description' => 'Descriptive statistics, probability, and introductory inference.'],
        ['name' => 'Physics', 'description' => 'Mechanics and foundational university physics.'],
        ['name' => 'Academic Writing', 'description' => 'Essay structure, clarity, and academic writing skills.'],
        ['name' => 'English Language', 'description' => 'Grammar, vocabulary, and confident written communication.'],
        ['name' => 'Web Development', 'description' => 'HTML, CSS, JavaScript, and introductory application development.'],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $roles = Role::query()->get()->keyBy('name');
            $admin = User::query()
                ->whereHas('roles', fn ($query) => $query->where('name', Role::ADMIN))
                ->orderBy('id')
                ->first();

            if ($admin === null) {
                $admin = $this->makeUser([
                    'name' => 'Demo Administrator',
                    'email' => 'admin@peertutoring.test',
                    'first_name' => 'Demo',
                    'last_name' => 'Administrator',
                    'faculty_or_university' => 'PeerTutoringSystem Demo',
                    'study_program' => 'System Administration',
                    'year_of_study' => null,
                ]);
                $admin->roles()->syncWithoutDetaching([$roles[Role::ADMIN]->getKey()]);
            }

            $students = collect(self::STUDENTS)
                ->map(fn (array $student): User => $this->makeUser($this->userAttributes($student)))
                ->all();

            foreach ($students as $student) {
                $student->roles()->syncWithoutDetaching([$roles[Role::STUDENT]->getKey()]);
            }

            $subjects = collect(self::SUBJECTS)
                ->map(fn (array $subject): Subject => Subject::query()->firstOrCreate(
                    ['name' => $subject['name']],
                    ['description' => $subject['description'], 'is_active' => true],
                ))
                ->values();

            $this->seedTutors($admin, $students, $subjects, $roles);
            $this->seedApplicants($students, $subjects, $roles);
        });
    }

    /** @param array<string, mixed> $attributes */
    private function makeUser(array $attributes): User
    {
        return User::query()->firstOrCreate(
            ['email' => $attributes['email']],
            [
                ...$attributes,
                'password' => Hash::make(self::DEVELOPMENT_PASSWORD),
            ],
        );
    }

    /** @param array{name: string, email: string, first_name: string, last_name: string, faculty: string, program: string, year: int} $person
     * @return array<string, mixed>
     */
    private function userAttributes(array $person): array
    {
        return [
            'name' => $person['name'],
            'email' => $person['email'],
            'first_name' => $person['first_name'],
            'last_name' => $person['last_name'],
            'faculty_or_university' => $person['faculty'],
            'study_program' => $person['program'],
            'year_of_study' => $person['year'],
            'biography' => 'A fictional development account created for demonstrating the peer tutoring platform.',
        ];
    }

    /**
     * @param  array<int, User>  $students
     * @param  Collection<int, Subject>  $subjects
     * @param  Collection<string, Role>  $roles
     */
    private function seedTutors(User $admin, array $students, Collection $subjects, Collection $roles): void
    {
        $futureStatuses = [Booking::PENDING, Booking::ACCEPTED, Booking::REJECTED, Booking::CANCELLED, Booking::PENDING];
        $reviewComments = [
            'Explained the ideas clearly and helped me work through each step.',
            'A patient tutor who made a difficult topic easier to understand.',
            'Well prepared, friendly, and very helpful during the session.',
            'Great examples and a clear explanation of the material.',
            'The session was focused and helped me feel more confident.',
        ];
        $pastWeek = CarbonImmutable::now()->startOfWeek()->subWeek();
        $nextWeek = CarbonImmutable::now()->startOfWeek()->addWeek();

        foreach (self::TUTORS as $index => $tutorData) {
            $tutor = $this->makeUser($this->userAttributes($tutorData));
            $tutor->roles()->syncWithoutDetaching([$roles[Role::STUDENT]->getKey(), $roles[Role::TUTOR]->getKey()]);

            $subjectIds = collect($tutorData['subjects'])
                ->map(fn (int $subjectIndex): int => (int) $subjects->get($subjectIndex)->getKey())
                ->all();
            $application = TutorApplication::query()
                ->where('user_id', $tutor->getKey())
                ->where('status', TutorApplication::APPROVED)
                ->latest('id')
                ->first();

            if ($application === null) {
                $application = TutorApplication::query()
                    ->where('user_id', $tutor->getKey())
                    ->where('status', TutorApplication::PENDING)
                    ->latest('id')
                    ->first() ?? TutorApplication::query()->firstOrNew([
                        'user_id' => $tutor->getKey(),
                        'status' => TutorApplication::APPROVED,
                    ]);

                $application->forceFill([
                    'status' => TutorApplication::APPROVED,
                    'motivation' => 'I enjoy helping fellow students understand course material through patient, practical explanations.',
                    'reviewer_id' => $admin->getKey(),
                    'reviewed_at' => now(),
                    'rejection_reason' => null,
                ])->save();
            }
            $application->subjects()->syncWithoutDetaching($subjectIds);

            if ($application->reviewer_id === null || $application->reviewed_at === null) {
                $application->forceFill([
                    'reviewer_id' => $admin->getKey(),
                    'reviewed_at' => now(),
                ])->save();
            }

            $profile = TutorProfile::query()->firstOrCreate(
                ['user_id' => $tutor->getKey()],
                ['biography' => 'A fictional peer tutor who offers supportive, structured sessions for fellow students.'],
            );

            foreach ($subjectIds as $subjectId) {
                TutorSubject::query()->firstOrCreate(
                    ['tutor_profile_id' => $profile->getKey(), 'subject_id' => $subjectId],
                    ['description' => 'Step-by-step guidance with examples and practice questions.'],
                );
            }

            $pastStart = $pastWeek->addDays($index)->setTime(10, 0);
            $pastAvailability = $this->availability($profile, $pastStart);
            $pastBooking = $this->booking($students[$index], $profile, $pastAvailability, $subjectIds[0], Booking::COMPLETED);
            Review::query()->firstOrCreate(
                ['booking_id' => $pastBooking->getKey()],
                ['rating' => [5, 4, 5, 4, 5][$index], 'comment' => $reviewComments[$index]],
            );

            for ($slotIndex = 0; $slotIndex < 4; $slotIndex++) {
                $futureStart = $nextWeek->addDays($slotIndex)->setTime(9 + ($slotIndex * 2), 0);
                $availability = $this->availability($profile, $futureStart);

                if ($slotIndex === 0) {
                    $this->booking(
                        $students[($index + 5) % count($students)],
                        $profile,
                        $availability,
                        $subjectIds[$index % count($subjectIds)],
                        $futureStatuses[$index],
                    );
                }
            }

            $this->seedConversation($students[$index], $profile, $index);
        }
    }

    /**
     * @param  array<int, User>  $students
     * @param  Collection<int, Subject>  $subjects
     * @param  Collection<string, Role>  $roles
     */
    private function seedApplicants(array $students, Collection $subjects, Collection $roles): void
    {
        $applicants = [
            ['student_index' => 5, 'subject_index' => 2],
            ['student_index' => 6, 'subject_index' => 5],
        ];

        foreach ($applicants as $index => $applicantData) {
            $applicant = $students[$applicantData['student_index']];
            $applicant->roles()->syncWithoutDetaching([$roles[Role::STUDENT]->getKey()]);

            $application = TutorApplication::query()->firstOrNew([
                'user_id' => $applicant->getKey(),
                'status' => TutorApplication::PENDING,
            ]);
            if (! $application->exists) {
                $application->forceFill([
                    'motivation' => 'I would like to support other students in this subject and share study strategies that have worked for me.',
                ])->save();
            }
            $application->subjects()->syncWithoutDetaching([(int) $subjects->get($applicantData['subject_index'])->getKey()]);
        }
    }

    private function availability(TutorProfile $profile, CarbonImmutable $startsAt): TutorAvailability
    {
        return TutorAvailability::query()->firstOrCreate(
            [
                'tutor_profile_id' => $profile->getKey(),
                'starts_at' => $startsAt,
                'ends_at' => $startsAt->addHour(),
            ],
        );
    }

    private function booking(User $student, TutorProfile $profile, TutorAvailability $availability, int $subjectId, string $status): Booking
    {
        $booking = Booking::query()->firstOrNew([
            'tutor_availability_id' => $availability->getKey(),
        ]);
        $booking->student_id = $student->getKey();
        $booking->tutor_profile_id = $profile->getKey();
        $booking->subject_id = $subjectId;
        $booking->starts_at = $availability->starts_at;
        $booking->ends_at = $availability->ends_at;
        $booking->status = $status;
        $booking->save();

        return $booking;
    }

    private function seedConversation(User $student, TutorProfile $profile, int $index): void
    {
        $conversation = Conversation::query()->firstOrCreate([
            'student_id' => $student->getKey(),
            'tutor_profile_id' => $profile->getKey(),
        ]);
        $tutor = $profile->user()->firstOrFail();
        $messages = [
            [$student, 'Hi! Could you help me review the main ideas before my next class?'],
            [$tutor, 'Of course. Tell me which topic you would like to start with, and we can work through examples together.'],
            [$student, 'That sounds great. I will bring a few practice questions.'],
        ];

        foreach ($messages as $messageIndex => [$sender, $body]) {
            $clientMessageId = sprintf('00000000-0000-4000-8000-%012d', ($index * 10) + $messageIndex + 1);
            Message::query()->firstOrCreate(
                [
                    'conversation_id' => $conversation->getKey(),
                    'sender_id' => $sender->getKey(),
                    'client_message_id' => $clientMessageId,
                ],
                [
                    'body' => $body,
                    'read_at' => $messageIndex < 2 ? now() : null,
                ],
            );
        }
    }
}
