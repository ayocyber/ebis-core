import { type TenantRole } from '@/types';

export const roleLabels: Record<TenantRole, string> = {
    owner: 'Owner',
    editor: 'Editor',
    viewer: 'Viewer',
};

export const roleDescriptions: Record<TenantRole, string> = {
    owner: 'Everything, including members, go / no-go and sign-off',
    editor: 'Upload tenders, edit the profile and bids',
    viewer: 'Read only',
};

export function roleLabel(role: TenantRole): string {
    return roleLabels[role];
}

export function canEdit(role: TenantRole | null): boolean {
    return role === 'owner' || role === 'editor';
}

export function isOwner(role: TenantRole | null): boolean {
    return role === 'owner';
}
