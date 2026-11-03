import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote?: { message: string; author: string };
    auth: Auth;
    /** The company the user is working in (null before onboarding). */
    tenant: TenantSummary | null;
    /** The user's role in the current company. */
    role: TenantRole | null;
    /** Every company the user belongs to, for the switcher. */
    tenants: TenantSummary[];
    flash: { success?: string | null; error?: string | null };
    [key: string]: unknown;
}

export type TenantRole = 'owner' | 'editor' | 'viewer';

export interface TenantSummary {
    id: string;
    name: string;
    role?: TenantRole;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
