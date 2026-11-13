import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Buyer, Tender } from '@/types/ebis';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

/** ING-04: the details a tender needs. Field names match the Laravel request. */
export type TenderDetails = {
    title: string;
    reference: string;
    buyer_name: string;
    buyer_type: Buyer['type'];
    buyer_location: string;
    sector: string;
    deadline: string;
    clarification_deadline: string;
    estimated_value: string;
    lots: string;
    summary: string;
};

export const buyerTypes: { value: Buyer['type']; label: string }[] = [
    { value: 'local', label: 'Local authority' },
    { value: 'central', label: 'Central government' },
    { value: 'nhs', label: 'NHS' },
    { value: 'education', label: 'Education' },
    { value: 'devolved', label: 'Devolved government' },
    { value: 'private', label: 'Private sector' },
    { value: 'international', label: 'International' },
];

export const emptyTenderDetails: TenderDetails = {
    title: '',
    reference: '',
    buyer_name: '',
    buyer_type: 'local',
    buyer_location: '',
    sector: '',
    deadline: '',
    clarification_deadline: '',
    estimated_value: '',
    lots: '',
    summary: '',
};

/** ISO date → the browser's local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function detailsFromTender(t: Tender): TenderDetails {
    return {
        title: t.title,
        reference: t.reference,
        buyer_name: t.buyer.name,
        buyer_type: t.buyer.type,
        buyer_location: t.buyer.location,
        sector: t.sector,
        deadline: toLocalInput(t.deadline),
        clarification_deadline: toLocalInput(t.clarificationDeadline),
        estimated_value: t.estimatedValue ? String(t.estimatedValue.amount) : '',
        lots: t.lots ? String(t.lots) : '',
        summary: t.summary,
    };
}

export function TenderDetailsFields({
    data,
    setData,
    errors,
    idPrefix = 'td',
    startExpanded = false,
}: {
    data: TenderDetails;
    setData: <K extends keyof TenderDetails>(key: K, value: TenderDetails[K]) => void;
    errors: Partial<Record<keyof TenderDetails, string>>;
    idPrefix?: string;
    startExpanded?: boolean;
}) {
    const [more, setMore] = useState(startExpanded);
    const id = (k: keyof TenderDetails) => `${idPrefix}-${k}`;
    const err = (k: keyof TenderDetails) =>
        errors[k] && (
            <p className="text-status-not-met text-xs" role="alert">
                {errors[k]}
            </p>
        );

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={id('title')}>Tender title</Label>
                <Input
                    id={id('title')}
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    placeholder="e.g. Network refresh across 12 council sites"
                    required
                />
                {err('title')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={id('buyer_name')}>Buyer</Label>
                <Input
                    id={id('buyer_name')}
                    value={data.buyer_name}
                    onChange={(e) => setData('buyer_name', e.target.value)}
                    placeholder="e.g. Northshire County Council"
                    required
                />
                {err('buyer_name')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={id('buyer_type')}>Buyer type</Label>
                <Select value={data.buyer_type} onValueChange={(v) => setData('buyer_type', v as Buyer['type'])}>
                    <SelectTrigger id={id('buyer_type')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {buyerTypes.map((b) => (
                            <SelectItem key={b.value} value={b.value}>
                                {b.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {err('buyer_type')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={id('reference')}>Reference</Label>
                <Input
                    id={id('reference')}
                    value={data.reference}
                    onChange={(e) => setData('reference', e.target.value)}
                    placeholder="e.g. NCC/ICT/2026/014"
                    className="font-mono"
                />
                {err('reference')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={id('deadline')}>Submission deadline</Label>
                <Input
                    id={id('deadline')}
                    type="datetime-local"
                    value={data.deadline}
                    onChange={(e) => setData('deadline', e.target.value)}
                    required
                />
                {err('deadline')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={id('estimated_value')}>Estimated value (£)</Label>
                <Input
                    id={id('estimated_value')}
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={data.estimated_value}
                    onChange={(e) => setData('estimated_value', e.target.value)}
                    placeholder="Optional"
                />
                {err('estimated_value')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={id('lots')}>Lots</Label>
                <Input
                    id={id('lots')}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={data.lots}
                    onChange={(e) => setData('lots', e.target.value)}
                    placeholder="Optional"
                />
                {err('lots')}
            </div>

            {!more ? (
                <button
                    type="button"
                    onClick={() => setMore(true)}
                    className="text-primary inline-flex items-center gap-1 text-left text-xs font-medium hover:underline sm:col-span-2"
                >
                    <ChevronDown className="size-3.5" /> More details (optional)
                </button>
            ) : (
                <>
                    <div className="space-y-1.5">
                        <Label htmlFor={id('buyer_location')}>Buyer location</Label>
                        <Input
                            id={id('buyer_location')}
                            value={data.buyer_location}
                            onChange={(e) => setData('buyer_location', e.target.value)}
                            placeholder="e.g. Northshire, England"
                        />
                        {err('buyer_location')}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={id('sector')}>Sector</Label>
                        <Input
                            id={id('sector')}
                            value={data.sector}
                            onChange={(e) => setData('sector', e.target.value)}
                            placeholder="e.g. ICT infrastructure"
                        />
                        {err('sector')}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={id('clarification_deadline')}>Clarification questions deadline</Label>
                        <Input
                            id={id('clarification_deadline')}
                            type="datetime-local"
                            value={data.clarification_deadline}
                            onChange={(e) => setData('clarification_deadline', e.target.value)}
                        />
                        {err('clarification_deadline')}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={id('summary')}>Summary</Label>
                        <textarea
                            id={id('summary')}
                            value={data.summary}
                            onChange={(e) => setData('summary', e.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder="What the buyer wants, in a sentence or two"
                            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                        />
                        {err('summary')}
                    </div>
                </>
            )}
        </div>
    );
}
