import { SVGAttributes, useId } from 'react';

/**
 * EBIS Core mark — a gradient tile with a three-line checklist,
 * the first line ticked and EBIS-red bullets. Self-contained colours so it reads on any surface.
 */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    const id = useId().replace(/:/g, '');

    return (
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
            <defs>
                <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#2F3BFF" />
                    <stop offset="0.6" stopColor="#1A1FB8" />
                    <stop offset="1" stopColor="#00036C" />
                </linearGradient>
                <linearGradient id={`${id}-shine`} x1="16" y1="0" x2="16" y2="18" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill={`url(#${id}-bg)`} />
            <rect width="32" height="32" rx="8" fill={`url(#${id}-shine)`} />
            <path d="M8.2 10.4l1.9 1.9 3.4-3.6" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="16" y="9.2" width="8" height="2.4" rx="1.2" fill="#fff" />
            <circle cx="10" cy="16.6" r="1.8" fill="#FF3B41" />
            <rect x="16" y="15.4" width="8" height="2.4" rx="1.2" fill="#fff" fillOpacity="0.85" />
            <circle cx="10" cy="22.8" r="1.8" fill="#FF3B41" fillOpacity="0.75" />
            <rect x="16" y="21.6" width="5" height="2.4" rx="1.2" fill="#fff" fillOpacity="0.6" />
        </svg>
    );
}
