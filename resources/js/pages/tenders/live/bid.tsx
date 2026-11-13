import { type SectionVersion } from '@/hooks/use-tender-workspace';
import { sendJson } from '@/lib/http';
import { type BidWorkspaceApi, BidScreen } from '@/pages/tenders/bid';
import type { BidSection, EligibilityRow, Tender } from '@/types/ebis';
import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Versions = Record<string, SectionVersion[]>;

/**
 * Real tenders: the bid is saved on the server. Typing shows straight away and is
 * saved a moment after the user stops; versions and restores go to the server too
 * (BID-03, BID-05). There is no AI drafting here.
 */
export default function LiveBid({
    tender,
    rows,
    sections: initialSections,
    versions: initialVersions,
}: {
    tender: Tender;
    rows: EligibilityRow[];
    sections: BidSection[];
    versions: Versions;
}) {
    const workspace = useServerBid(tender, rows, initialSections, initialVersions);

    return (
        <>
            <BidScreen
                tender={tender}
                workspace={workspace}
                onAddSection={(title) => router.post(route('tenders.sections.store', tender.id), { title }, { preserveScroll: true })}
            />
            {workspace.saveFailed && (
                <div
                    role="alert"
                    className="bg-status-not-met fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-sm text-white shadow-lg"
                >
                    Your last changes couldn’t be saved. Check your connection; ProcurPilot tries again as you keep typing.
                </div>
            )}
        </>
    );
}

function useServerBid(
    tender: Tender,
    rows: EligibilityRow[],
    initialSections: BidSection[],
    initialVersions: Versions,
): BidWorkspaceApi & { saveFailed: boolean } {
    const [sections, setSections] = useState(initialSections);
    const [versions, setVersions] = useState(initialVersions);
    const [saveFailed, setSaveFailed] = useState(false);
    const saved = <T,>(v: T) => {
        setSaveFailed(false);
        return v;
    };
    const failed = () => {
        setSaveFailed(true);
        return undefined;
    };
    const pending = useRef<Record<string, number>>({});
    const latest = useRef(sections);
    latest.current = sections;

    // A new section or a reload brings fresh data from the server.
    useEffect(() => setSections(initialSections), [initialSections]);
    useEffect(() => setVersions(initialVersions), [initialVersions]);

    const url = (id: string) => route('tenders.sections.update', [tender.id, id]);

    const flush = useCallback(
        (id: string) => {
            window.clearTimeout(pending.current[id]);
            delete pending.current[id];
            const s = latest.current.find((x) => x.id === id);
            return s ? sendJson('PATCH', url(id), { body: s.body }).then(saved, failed) : Promise.resolve();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tender.id],
    );

    // Save anything still waiting when leaving the page.
    useEffect(() => () => Object.keys(pending.current).forEach((id) => void flush(id)), [flush]);

    const updateSection: BidWorkspaceApi['updateSection'] = (id, patch) => {
        setSections((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        const { body, ...rest } = patch;
        // Status and assignee are saved (and logged) at once; text a moment after typing stops.
        if (Object.keys(rest).length) void sendJson('PATCH', url(id), rest).then(saved, failed);
        if (body !== undefined) {
            window.clearTimeout(pending.current[id]);
            pending.current[id] = window.setTimeout(() => void flush(id), 800);
        }
    };

    const saveVersion: BidWorkspaceApi['saveVersion'] = (id, label) => {
        const body = latest.current.find((x) => x.id === id)?.body ?? '';
        if (!body.trim()) return;
        window.clearTimeout(pending.current[id]);
        delete pending.current[id];
        sendJson<{ version: SectionVersion | null }>('POST', route('tenders.sections.versions.store', [tender.id, id]), { label, body })
            .then(({ version }) => version && setVersions((v) => ({ ...v, [id]: [version, ...(v[id] ?? [])] })))
            .then(saved, failed);
    };

    const restoreVersion: BidWorkspaceApi['restoreVersion'] = (id, versionId) => {
        void flush(id).then(() =>
            sendJson<{ section: BidSection; versions: SectionVersion[] }>(
                'POST',
                route('tenders.sections.versions.restore', [tender.id, id, versionId]),
            )
                .then(({ section, versions: list }) => {
                    setSections((all) => all.map((s) => (s.id === id ? section : s)));
                    setVersions((v) => ({ ...v, [id]: list }));
                })
                .then(saved, failed),
        );
    };

    return { rows, sections, versions, updateSection, saveVersion, restoreVersion, saveFailed };
}
