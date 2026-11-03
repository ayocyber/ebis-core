import AppLogoIcon from '@/components/app-logo-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { roleLabel } from '@/lib/roles';
import { type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';

/**
 * Sidebar header: shows the current company and lets members of several companies switch.
 */
export function TenantSwitcher() {
    const { tenant, tenants, role } = usePage<SharedData>().props;
    const { isMobile, state } = useSidebar();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                            <span className="flex size-8 shrink-0">
                                <AppLogoIcon className="size-8 drop-shadow-[0_2px_8px_rgba(35,45,240,0.4)]" />
                            </span>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{tenant?.name ?? 'No company'}</span>
                                <span className="text-muted-foreground truncate text-xs">{role ? roleLabel(role) : 'EBIS Core'}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        align="start"
                        side={isMobile ? 'bottom' : state === 'collapsed' ? 'right' : 'bottom'}
                    >
                        <DropdownMenuLabel className="text-muted-foreground text-xs">Companies</DropdownMenuLabel>
                        {tenants.map((t) => (
                            <DropdownMenuItem
                                key={t.id}
                                onSelect={() => t.id !== tenant?.id && router.post(route('tenants.switch', t.id))}
                                className="gap-2"
                            >
                                <span className="flex-1 truncate">{t.name}</span>
                                {t.id === tenant?.id && <Check className="size-4" aria-label="Current company" />}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href={route('onboarding.create')} className="gap-2">
                                <Plus className="size-4" />
                                Add another company
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
