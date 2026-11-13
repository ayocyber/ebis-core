import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <AppLogoIcon spin="hover" className="size-8 shrink-0" />
            <div className="ml-1 grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">ProcurPilot</span>
                <span className="text-muted-foreground truncate text-[11px]">Tender intelligence</span>
            </div>
        </>
    );
}
