import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TenantSwitcher } from '@/components/tenant-switcher';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Building2, FileSearch, FolderLock, History, LayoutGrid, Users } from 'lucide-react';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Tenders',
        url: '/tenders',
        icon: FileSearch,
    },
    {
        title: 'Evidence vault',
        url: '/vault',
        icon: FolderLock,
    },
    {
        title: 'Company profile',
        url: '/company',
        icon: Building2,
    },
    {
        title: 'Audit log',
        url: '/activity',
        icon: History,
    },
    {
        title: 'Team',
        url: '/settings/members',
        icon: Users,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <TenantSwitcher />
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
