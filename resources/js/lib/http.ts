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
