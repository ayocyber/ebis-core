<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $this->actingAs($user = User::factory()->withCompany()->create());

        $this->get('/dashboard')->assertOk();
    }

    public function test_the_dashboard_lists_the_companys_own_live_tenders()
    {
        $this->actingAs($user = User::factory()->withCompany()->create());
        $tenant = Tenant::sole();

        app(CurrentTenant::class)->runAs($tenant, function () {
            Tender::factory()->create(['title' => 'Live one']);
            Tender::factory()->create(['title' => 'Already submitted', 'stage' => 'submitted']);
        });

        // Another company's tender never shows.
        $rival = User::factory()->withCompany()->create();
        app(CurrentTenant::class)->runAs($rival->tenants()->sole(), fn () => Tender::factory()->create());

        $this->get('/dashboard')->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->has('tenders', 1)
            ->where('tenders.0.title', 'Live one'));
    }
}
