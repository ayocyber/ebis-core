import InputError from '@/components/input-error';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { TriangleAlert } from 'lucide-react';
import { FormEventHandler, useRef } from 'react';

export default function DeleteUser() {
    const passwordInput = useRef<HTMLInputElement>(null);
    const { data, setData, delete: destroy, processing, reset, errors, clearErrors } = useForm({ password: '' });

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();
        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        clearErrors();
        reset();
    };

    return (
        <SettingsCard title="Delete account" description="Permanently remove your account. This can’t be undone." tone="danger">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                    Your sign-in and personal details are deleted. Tenders, evidence and the audit log belong to your company and stay with it.
                </p>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="shrink-0">
                            Delete account
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle className="flex items-center gap-2">
                            <TriangleAlert className="text-status-not-met size-5" /> Delete your account?
                        </DialogTitle>
                        <DialogDescription>
                            This permanently deletes your account. Enter your password to confirm. If you are the only Owner of a company, make
                            someone else an Owner first.
                        </DialogDescription>
                        <form className="space-y-6" onSubmit={deleteUser}>
                            <div className="grid gap-2">
                                <Label htmlFor="delete-password">Password</Label>
                                <Input
                                    id="delete-password"
                                    type="password"
                                    name="password"
                                    ref={passwordInput}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="current-password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary" onClick={closeModal}>
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button variant="destructive" disabled={processing || !data.password}>
                                    Delete account
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </SettingsCard>
    );
}
