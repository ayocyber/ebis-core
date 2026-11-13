<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M1: company profile, evidence vault, profile facts and the audit log.
 * Evidence chain: ProfileFact → VaultDocument (the file that proves it).
 */
return new class extends Migration
{
    public function up(): void
    {
        // PRF-01: one live profile per company; every save bumps `version`.
        Schema::create('company_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->string('legal_name')->default('');
            $table->string('trading_name')->default('');
            $table->string('company_number', 16)->default('');
            $table->date('incorporated_at')->nullable();
            $table->string('registered_office')->default('');
            $table->string('vat_number', 32)->default('');
            $table->string('cdp_id', 64)->default('');
            $table->string('website')->default('');
            $table->string('sector')->default('');
            $table->unsignedInteger('employees')->default(0);
            $table->unsignedInteger('engineers')->default(0);
            $table->json('turnover');
            $table->string('auditor')->default('');
            $table->json('insurance');
            $table->json('social_value');
            $table->text('about')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Snapshot of every saved version, so past assessments can say which profile they used.
        Schema::create('company_profile_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('data');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['tenant_id', 'version']);
        });

        Schema::create('vault_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('category', 16);
            $table->string('file_name');
            $table->string('kind', 8);
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('size_bytes');
            $table->string('disk', 32);
            $table->string('path');
            $table->char('sha256', 64);
            $table->string('issuer')->nullable();
            $table->string('reference')->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->text('summary')->nullable();
            // A renewal archives the version it replaces; the old row stays for the audit trail.
            // Its foreign key is added below, once the primary key exists (Postgres needs that order).
            $table->uuid('replaces_id')->nullable();
            $table->timestamp('archived_at')->nullable();
            // PRF-05: when the 90- and 30-day reminders went out, so each is sent once.
            $table->timestamp('alerted_90_at')->nullable();
            $table->timestamp('alerted_30_at')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'archived_at', 'expires_at']);
            $table->index(['tenant_id', 'sha256']);
        });

        Schema::table('vault_documents', function (Blueprint $table) {
            $table->foreign('replaces_id')->references('id')->on('vault_documents')->nullOnDelete();
        });

        // PRF-03: every fact records its source document, dates and verification.
        Schema::create('profile_facts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('vault_document_id')->nullable()->constrained()->nullOnDelete();
            // Stable name a tender requirement can ask for, e.g. "pf-cep" (Cyber Essentials Plus).
            $table->string('key', 64)->nullable();
            $table->string('label');
            $table->string('value');
            $table->string('source', 32);
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'key']);
        });

        // EVD-05: append-only. The AuditEvent model refuses updates and deletes.
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            // Name at the time of the action; null actor + "ProcurPilot" = the system.
            $table->string('actor_name');
            $table->string('category', 16);
            $table->string('action');
            $table->string('target');
            $table->string('tender_id', 64)->nullable();
            $table->text('detail')->nullable();
            // What it happened to. String id so it fits UUID and integer keys alike.
            $table->string('subject_type')->nullable();
            $table->string('subject_id', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('profile_facts');
        Schema::dropIfExists('vault_documents');
        Schema::dropIfExists('company_profile_versions');
        Schema::dropIfExists('company_profiles');
    }
};
