<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisteredUserController extends Controller
{
    public function __invoke(RegisterUserRequest $request)
    {
        $user = DB::transaction(function () use ($request): User {
            $studentRole = Role::query()->where('name', Role::STUDENT)->firstOrFail();

            $user = User::query()->create([
                'name' => $request->validated('name'),
                'email' => $request->validated('email'),
                'password' => Hash::make($request->validated('password')),
            ]);

            $user->roles()->attach($studentRole);

            return $user;
        });

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return UserResource::make($user->load('roles'))->response()->setStatusCode(201);
    }
}
