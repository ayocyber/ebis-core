import { vaultCategoryMeta } from '@/lib/vault';
import type { RequirementCheck } from '@/types/ebis';

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export const insuranceKinds: { value: 'public' | 'employers' | 'professional'; label: string }[] = [
    { value: 'public', label: 'Public liability' },
    { value: 'employers', label: 'Employer’s liability' },
    { value: 'professional', label: 'Professional indemnity' },
];

export const checkTypes: { value: RequirementCheck['type'] | 'judgement'; label: string; hint: string }[] = [
    { value: 'judgement', label: 'You decide', hint: 'No automatic rule. You set the status in the eligibility check.' },
    { value: 'turnover_min', label: 'Minimum turnover', hint: 'Compared with the turnover in your company profile.' },
    {
        value: 'insurance_min',
        label: 'Insurance cover',
        hint: 'Compared with the cover in your company profile and the insurance documents in your vault.',
    },
    { value: 'certification', label: 'Certificate or accreditation', hint: 'Looked for in your vault, and must still be valid on the deadline.' },
    { value: 'years_trading', label: 'Years trading', hint: 'Worked out from the incorporation date in your company profile.' },
    { value: 'vault_documents', label: 'Documents in the vault', hint: 'Counts the vault documents of one kind, e.g. case studies.' },
];

/** One line saying how ProcurPilot will check a requirement. */
export function describeCheck(check?: RequirementCheck | null): string {
    if (!check) return 'You decide the status';
    switch (check.type) {
        case 'turnover_min':
            return `Turnover of at least ${gbp(check.amount)}${check.years && check.years > 1 ? ` in each of the last ${check.years} years` : ''}`;
        case 'insurance_min':
            return `${insuranceKinds.find((k) => k.value === check.kind)?.label ?? 'Insurance'} cover of at least ${gbp(check.amount)}`;
        case 'certification':
            return `${check.name}, valid on the deadline`;
        case 'years_trading':
            return `Trading for at least ${check.years} year${check.years > 1 ? 's' : ''}`;
        case 'vault_documents': {
            const label = vaultCategoryMeta[check.category]?.plural ?? 'documents';
            return `${check.count ?? 1} or more ${label.toLowerCase()} in the vault`;
        }
    }
}
