<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M2 Ingest: one tender record per pack (ING-03), its documents and the text read
 * from them (ING-02). Requirements (M3) will hang off tenders.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('reference', 100)->nullable();
            $table->text('summary')->nullable();
            $table->string('buyer_name');
            $table->string('buyer_type', 16);
            $table->string('buyer_location')->nullable();
            $table->string('sector')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('clarification_deadline')->nullable();
            // ING-04: needed before any assessment, so it is required at upload.
            $table->timestamp('deadline');
            $table->unsignedBigInteger('estimated_value')->nullable();
            $table->char('currency', 3)->default('GBP');
            $table->unsignedSmallInteger('lots')->nullable();
            $table->string('stage', 16)->default('extraction');
            // Bumped when the pack changes, so later assessments can record what they used.
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'deadline']);
        });

        Schema::create('tender_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('kind', 8);
            $table->string('role', 64);
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedInteger('pages')->nullable();
            $table->string('disk', 32);
            $table->string('path');
            $table->char('sha256', 64);
            // Set when the file came out of an uploaded ZIP.
            $table->string('from_archive')->nullable();
            $table->string('extraction_status', 16)->default('pending');
            // Pages separated by form feeds (\f) so requirements can cite a page.
            $table->longText('extracted_text')->nullable();
            $table->json('unreadable_pages')->nullable();
            $table->string('extraction_error', 500)->nullable();
            $table->timestamp('extracted_at')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'sha256']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tender_documents');
        Schema::dropIfExists('tenders');
    }
};
