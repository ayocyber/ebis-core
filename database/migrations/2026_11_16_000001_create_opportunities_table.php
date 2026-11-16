<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Open tenders published on Find a Tender and Contracts Finder. Public data, shared
 * by every company, so not tenant-scoped. A company turns one into its own tender
 * with "Bid for this".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opportunities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source', 8); // fts | cf
            $table->string('ocid', 120)->unique();
            $table->string('notice_id', 120);
            // Same tender on both sites: title + buyer, so it is listed once.
            $table->char('match_key', 40)->index();
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('buyer_name');
            $table->string('buyer_type', 16);
            $table->unsignedBigInteger('value')->nullable();
            $table->char('currency', 3)->default('GBP');
            $table->timestamp('deadline')->index();
            $table->timestamp('published_at')->nullable();
            $table->string('cpv', 16)->nullable();
            $table->string('cpv_label')->nullable();
            $table->json('regions')->nullable();
            $table->boolean('sme_suitable')->nullable();
            $table->string('url', 1000);
            $table->string('submission_url', 1000)->nullable();
            /** list of {title, url, format} */
            $table->json('documents')->nullable();
            /** list of {name, type, weight} */
            $table->json('award_criteria')->nullable();
            /** list of strings: what suppliers must show */
            $table->json('selection')->nullable();
            $table->timestamps();
        });

        Schema::table('tenders', function (Blueprint $table) {
            // Where the tender came from when it was picked from the public feeds.
            $table->string('source_url', 1000)->nullable();
            $table->string('portal_url', 1000)->nullable();
        });

        Schema::table('company_profiles', function (Blueprint $table) {
            // Words that pick out the tenders worth showing this company.
            $table->json('tender_keywords')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('company_profiles', fn (Blueprint $t) => $t->dropColumn('tender_keywords'));
        Schema::table('tenders', fn (Blueprint $t) => $t->dropColumn(['source_url', 'portal_url']));
        Schema::dropIfExists('opportunities');
    }
};
