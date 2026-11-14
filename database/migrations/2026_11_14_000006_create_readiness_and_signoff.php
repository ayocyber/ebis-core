<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M7: the readiness score history (VAL-07) and the final sign-off (VAL-08).
 * ProcurPilot never submits; sign-off records that the bid is ready to send.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readiness_checks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('tender_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('score');
            $table->unsignedSmallInteger('critical');
            $table->string('by_name', 120);
            $table->boolean('manual')->default(false);
            $table->timestamps();
            $table->index(['tender_id', 'created_at']);
        });

        Schema::table('tenders', function (Blueprint $table) {
            $table->timestamp('signed_off_at')->nullable();
            $table->foreignId('signed_off_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tenders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('signed_off_by');
            $table->dropColumn('signed_off_at');
        });
        Schema::dropIfExists('readiness_checks');
    }
};
