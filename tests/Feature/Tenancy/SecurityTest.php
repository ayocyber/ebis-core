<?php

use App\Models\Tenant;
use App\Models\User;

it('sends browser protections on every page', function () {
    $response = $this->get('/login')->assertOk();

    expect($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('X-Frame-Options'))->toBe('DENY')
        ->and($response->headers->get('Referrer-Policy'))->toBe('strict-origin-when-cross-origin')
        ->and($response->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'none'");
});

it('does not serve stored files by path', function () {
    $this->get('/storage/tenants/x/vault/file.pdf')->assertNotFound();
});

it('limits how often sign-up and password reset can be tried', function () {
    foreach (range(1, 6) as $i) {
        $this->post('/forgot-password', ['email' => "someone{$i}@example.com"])->assertStatus(302);
    }
    $this->post('/forgot-password', ['email' => 'someone@example.com'])->assertStatus(429);
});

it('limits how often one person can download exports', function () {
    $owner = User::factory()->create();
    Tenant::factory()->ownedBy($owner)->create();
    $this->actingAs($owner);

    foreach (range(1, 10) as $i) {
        $this->get('/settings/profile/data')->assertOk();
    }
    $this->get('/settings/profile/data')->assertStatus(429);
});
