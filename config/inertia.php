<?php

/*
 * Only the page folder differs from Inertia's defaults: ours is `js/pages`, not `js/Pages`.
 * Windows ignores the case, so tests passed locally and failed on Linux CI.
 */

$pagePaths = [resource_path('js/pages')];
$pageExtensions = ['ts', 'tsx'];

return [
    'page_paths' => $pagePaths,
    'page_extensions' => $pageExtensions,

    'testing' => [
        'ensure_pages_exist' => true,
        'page_paths' => $pagePaths,
        'page_extensions' => $pageExtensions,
    ],
];
