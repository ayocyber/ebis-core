<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M6: the documents checklist of a real tender (BID-02): forms to complete
 * (pre-filled from the profile, BID-06), files for this bid, vault documents and
 * the written response, with each one's progress.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            // What it was made from, e.g. "response", "req:<id>", "doc:<id>"; null when added by hand.
            $table->string('key', 80)->nullable();
            $table->string('kind', 12);
            $table->string('title');
            $table->text('why');
            $table->string('source');
            $table->string('need', 12)->default('required');
            $table->string('condition')->nullable();
            $table->json('formats');
            $table->string('file_stem', 80);
            $table->boolean('signature')->default(false);
            // Form fields: [{id, label, profile?: column to pre-fill from, hint?}].
            $table->json('fields')->nullable();
            $table->string('vault_match')->nullable();
            $table->json('progress')->nullable();
            $table->string('file_disk', 32)->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tender_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_items');
    }
};
