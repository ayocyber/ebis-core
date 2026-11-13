<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M3 (without AI): a tender's requirements (TUN-01/03). Rows start either as
 * suggestions found in the tender text or as entries the user typed; only
 * confirmed ones are checked for eligibility.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requirements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            $table->string('code', 16)->nullable();
            $table->string('title');
            $table->text('text');
            $table->string('category', 16);
            $table->string('topic', 16);
            $table->unsignedTinyInteger('weight')->nullable();
            // Where it is in the pack (EVD-01): document, page, clause and the exact words.
            $table->foreignUuid('document_id')->nullable()->constrained('tender_documents')->nullOnDelete();
            $table->unsignedInteger('page')->nullable();
            $table->string('section', 100)->nullable();
            $table->text('quote')->nullable();
            // How it is checked against the company (ELG-01), e.g. {"type":"turnover_min","amount":900000}.
            $table->json('check_rule')->nullable();
            $table->string('origin', 8);
            $table->char('quote_hash', 40)->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tender_id', 'confirmed_at']);
            $table->index(['tender_id', 'quote_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requirements');
    }
};
