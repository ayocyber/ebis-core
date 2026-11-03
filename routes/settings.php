<?php

use App\Http\Controllers\Settings\CompanyController;
use App\Http\Controllers\Settings\InvitationController;
use App\Http\Controllers\Settings\MembersController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['auth', 'tenant'])->group(function () {
    Route::redirect('settings', 'settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance');

    // Company (the current tenant)
    Route::get('settings/company', [CompanyController::class, 'edit'])->name('company.edit');
    Route::patch('settings/company', [CompanyController::class, 'update'])->name('company.update');

    Route::get('settings/members', [MembersController::class, 'index'])->name('members.index');
    Route::patch('settings/members/{user}', [MembersController::class, 'update'])->name('members.update');
    Route::delete('settings/members/{user}', [MembersController::class, 'destroy'])->name('members.destroy');

    Route::post('settings/invitations', [InvitationController::class, 'store'])->name('invitations.store');
    Route::delete('settings/invitations/{invitation}', [InvitationController::class, 'destroy'])->name('invitations.destroy');
});
