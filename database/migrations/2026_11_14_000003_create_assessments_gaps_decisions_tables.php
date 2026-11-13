<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M4 eligibility (ELG/EVD) and M5 gaps and go/no-go (GAP/DEC).
 *
 * Assessments are kept per check run (EVD-04): each records the tender, profile and
 * requirement versions it used, so a later profile change never alters a past result.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('eligibility_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('tender_version');
            $table->unsignedInteger('profile_version')->nullable();
            // Which vault documents (and versions of them) the run saw, to spot changes since.
            $table->char('vault_fingerprint', 40)->nullable();
            $table->string('verdict', 24);
            $table->unsignedTinyInteger('score');
            $table->foreignId('run_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tender_id', 'created_at']);
        });

        Schema::create('assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('run_id')->constrained('eligibility_runs')->cascadeOnDelete();
            $table->foreignUuid('requirement_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('requirement_version');
            $table->string('status', 16);
            // "rule" for hard criteria, "user" for judgement calls, "ai" later (ELG-05).
            $table->string('method', 8);
            $table->string('summary', 500);
            $table->text('reasoning');
            $table->json('facts');
            $table->json('stale')->nullable();
            $table->json('override')->nullable();
            $table->boolean('reviewed')->default(false);
            $table->timestamps();
            $table->index(['run_id', 'requirement_id']);
        });

        Schema::create('gaps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            // One gap per requirement; it keeps its progress across check runs (GAP-05).
            $table->foreignUuid('requirement_id')->constrained()->cascadeOnDelete();
            $table->string('severity', 8);
            $table->string('title');
            $table->text('description');
            $table->text('remedy');
            $table->unsignedSmallInteger('time_to_close_days');
            $table->string('status', 12)->default('open');
            $table->string('owner')->nullable();
            $table->json('evidence')->nullable();
            $table->timestamp('status_changed_at')->nullable();
            $table->foreignId('status_changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['tender_id', 'requirement_id']);
        });

        Schema::create('tender_decisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('run_id')->nullable()->constrained('eligibility_runs')->nullOnDelete();
            $table->string('outcome', 8);
            $table->text('reason');
            $table->json('acknowledged_blockers');
            $table->json('conditions')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['tender_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tender_decisions');
        Schema::dropIfExists('gaps');
        Schema::dropIfExists('assessments');
        Schema::dropIfExists('eligibility_runs');
    }
};
