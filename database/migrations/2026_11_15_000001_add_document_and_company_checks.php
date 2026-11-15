<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Checks on what users upload and type in:
 * - each vault document's text is checked against what it claims to be;
 * - the company's details are checked against the Companies House register.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vault_documents', function (Blueprint $table) {
            // passed | warnings | unreadable; null = uploaded before checks existed.
            $table->string('check_status', 12)->nullable();
            $table->json('check_notes')->nullable();
            $table->timestamp('checked_at')->nullable();
        });

        Schema::table('company_profiles', function (Blueprint $table) {
            $table->json('companies_house')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('vault_documents', function (Blueprint $table) {
            $table->dropColumn(['check_status', 'check_notes', 'checked_at']);
        });
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('companies_house');
        });
    }
};
