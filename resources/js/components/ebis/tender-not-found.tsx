import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { FileQuestion } from 'lucide-react';

export function TenderNotFound() {
    return (
        <AppLayout breadcrumbs={[{ title: 'Tenders', href: '/tenders' }]}>
            <Head title="Tender not found" />
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <FileQuestion className="text-muted-foreground size-10" />
                <p className="font-medium">We couldn’t find that tender.</p>
                <Button asChild variant="outline">
                    <Link href={route('tenders.index')}>Back to tenders</Link>
                </Button>
            </div>
        </AppLayout>
    );
}
