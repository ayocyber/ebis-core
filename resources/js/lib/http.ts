/**
 * JSON requests for background saves (e.g. the bid editor's autosave), where an
 * Inertia visit would reload the page under the user's cursor. Laravel's CSRF
 * check reads the XSRF-TOKEN cookie it set, sent back as a header.
 */
export async function sendJson<T = unknown>(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
    const token = decodeURIComponent(document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
    const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    return (await res.json()) as T;
}

/**
 * POST JSON and save the file the server sends back (e.g. a form filled in with
 * answers not saved yet). The name comes from the server's Content-Disposition.
 */
export async function downloadPost(url: string, body: unknown, fallbackName: string): Promise<void> {
    const token = decodeURIComponent(document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
    const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const name = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];
    const href = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href, download: name ? decodeURIComponent(name) : fallbackName });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
}
