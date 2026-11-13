import { cn } from '@/lib/utils';
import { SVGAttributes } from 'react';

/**
 * ProcurPilot mark: a two-blade propeller (one blue, one red) turning around a
 * navy hub, on a white tile. Colours are fixed so it reads on any surface; the
 * same drawing is public/favicon.svg.
 *
 * `spin`: "idle" turns slowly all the time, "hover" turns while the surrounding
 * link or button is hovered. Both stop for people who prefer reduced motion
 * (see .logo-propeller in app.css).
 */
export default function AppLogoIcon({ spin, className, ...props }: SVGAttributes<SVGElement> & { spin?: 'idle' | 'hover' }) {
    return (
        <svg
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="ProcurPilot"
            className={cn(spin === 'idle' && 'logo-spin-idle', spin === 'hover' && 'logo-spin-hover', className)}
            {...props}
        >
            <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.5" fill="#fff" stroke="#DADDF0" strokeWidth="1.5" />
            <g className="logo-propeller">
                <path d="M16 16C14.2 11.2 15.6 6.4 19.4 6.2c3.7-.2 4.4 4.6.9 7.4C18.8 14.9 17.4 15.6 16 16z" fill="#2F3BFF" />
                <path d="M16 16C17.8 20.8 16.4 25.6 12.6 25.8c-3.7.2-4.4-4.6-.9-7.4C13.2 17.1 14.6 16.4 16 16z" fill="#E3262C" />
                <circle cx="16" cy="16" r="2.3" fill="#0B1B6B" />
            </g>
        </svg>
    );
}
