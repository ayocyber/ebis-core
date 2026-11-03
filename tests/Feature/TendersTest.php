<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TendersTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get('/tenders')->assertRedirect('/login');
        $this->get('/tenders/tnd-001/eligibility')->assertRedirect('/login');
    }

    public function test_members_can_view_the_tender_list()
    {
        $this->actingAs(User::factory()->withCompany()->create());

        $this->get('/tenders')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tenders/index', false));
    }

    public function test_members_can_view_a_tender_eligibility_matrix()
    {
        $this->actingAs(User::factory()->withCompany()->create());

        $this->get('/tenders/tnd-001/eligibility')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('tenders/eligibility', false)
                ->where('tenderId', 'tnd-001'));
    }
}
