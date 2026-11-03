import { Alert, AlertDescription } from '@/components/ui/alert';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { CircleAlert, CircleCheck } from 'lucide-react';

/** One-line success / error message from the last action (flashed by the controller). */
export function FlashMessages() {
    const { flash } = usePage<SharedData>().props;

    if (!flash?.success && !flash?.error) {
        return null;
    }

    return (
        <div className="px-4 pt-4" role="status" aria-live="polite">
            {flash.success && (
                <Alert>
                    <CircleCheck className="size-4" />
                    <AlertDescription>{flash.success}</AlertDescription>
                </Alert>
            )}
            {flash.error && (
                <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertDescription>{flash.error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
