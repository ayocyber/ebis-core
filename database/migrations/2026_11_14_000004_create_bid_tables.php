<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M6: the bid workspace (DEC-04). Response sections, which requirements each one
 * answers (the compliance matrix, BID-01), and a restorable history (BID-05).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_sections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            // Requirement ids answered here; a requirement sits in at most one section.
            $table->json('requirement_ids');
            $table->longText('body')->nullable();
            $table->unsignedInteger('word_limit')->nullable();
            $table->string('status', 12)->default('not_started');
            $table->string('assignee', 120)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tender_id', 'position']);
        });

        Schema::create('bid_section_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('section_id')->constrained('bid_sections')->cascadeOnDelete();
            $table->string('label', 120);
            $table->longText('body');
            $table->string('by_name', 120);
            $table->timestamps();
            $table->index(['section_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_section_versions');
        Schema::dropIfExists('bid_sections');
    }
};
