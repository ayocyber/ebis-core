import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <AppLogoIcon className="size-8 shrink-0 drop-shadow-[0_2px_8px_rgba(35,45,240,0.4)]" />
            <div className="ml-1 grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">EBIS Core</span>
                <span className="text-muted-foreground truncate text-[11px]">Tender intelligence</span>
            </div>
        </>
    );
}
