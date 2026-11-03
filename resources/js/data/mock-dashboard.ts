/** Mock win/loss history for the dashboard (fictional). Activity now comes from the audit log. */

export interface QuarterResult {
    quarter: string;
    won: number;
    lost: number;
    wonValue: number;
}

export const results: QuarterResult[] = [
    { quarter: 'Q4 25', won: 1, lost: 3, wonValue: 410_000 },
    { quarter: 'Q1 26', won: 2, lost: 2, wonValue: 1_150_000 },
    { quarter: 'Q2 26', won: 1, lost: 2, wonValue: 380_000 },
    { quarter: 'Q3 26', won: 3, lost: 2, wonValue: 2_060_000 },
];
