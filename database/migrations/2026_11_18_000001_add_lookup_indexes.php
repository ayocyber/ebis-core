<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M8 performance: Postgres does not index foreign keys by itself. These are the
 * lookups the app makes that had no index yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Every signed-in request reads the user's companies.
        Schema::table('tenant_users', fn (Blueprint $t) => $t->index('user_id'));
        Schema::table('tender_documents', fn (Blueprint $t) => $t->index(['tender_id', 'created_at']));
        Schema::table('audit_events', fn (Blueprint $t) => $t->index(['tender_id', 'created_at']));
        Schema::table('audit_events', fn (Blueprint $t) => $t->index(['tenant_id', 'actor_id']));
        Schema::table('profile_facts', fn (Blueprint $t) => $t->index('vault_document_id'));
        Schema::table('checklist_items', fn (Blueprint $t) => $t->index(['tender_id', 'position']));
    }

    public function down(): void
    {
        Schema::table('tenant_users', fn (Blueprint $t) => $t->dropIndex(['user_id']));
        Schema::table('tender_documents', fn (Blueprint $t) => $t->dropIndex(['tender_id', 'created_at']));
        Schema::table('audit_events', fn (Blueprint $t) => $t->dropIndex(['tender_id', 'created_at']));
        Schema::table('audit_events', fn (Blueprint $t) => $t->dropIndex(['tenant_id', 'actor_id']));
        Schema::table('profile_facts', fn (Blueprint $t) => $t->dropIndex(['vault_document_id']));
        Schema::table('checklist_items', fn (Blueprint $t) => $t->dropIndex(['tender_id', 'position']));
    }
};
