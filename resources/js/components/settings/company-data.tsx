import InputError from '@/components/input-error';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { Download, TriangleAlert } from 'lucide-react';
import { FormEventHandler } from 'react';

/** SEC-02 (UK GDPR): owners download everything the company holds, or delete it. */
export function CompanyData({ companyName }: { companyName: string }) {
    return (
        <>
            <SettingsCard title="Company data" description="Everything ProcurPilot holds for this company (UK GDPR).">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">
                        One ZIP with every record as JSON (tenders, requirements, bids, the activity log) and every file uploaded to the vault and to
                        tenders.
                    </p>
                    <Button variant="outline" asChild className="shrink-0">
                        <a href={route('settings.company.data')} download>
                            <Download className="size-4" /> Download all data
                        </a>
                    </Button>
                </div>
            </SettingsCard>

            <DeleteCompany companyName={companyName} />
        </>
    );
}

function DeleteCompany({ companyName }: { companyName: string }) {
    const { data, setData, delete: destroy, processing, reset, errors, clearErrors } = useForm({ confirm_name: '', password: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        destroy(route('settings.company.destroy'), { preserveScroll: true, onFinish: () => reset('password') });
    };

    const close = () => {
        clearErrors();
        reset();
    };

    return (
        <SettingsCard title="Delete company" description="Remove the company and everything in it. This can’t be undone." tone="danger">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                    Every tender, bid, vault document, file and the activity log are deleted straight away, for every member. Download the data first
                    if you may need it.
                </p>
                <Dialog onOpenChange={(open) => !open && close()}>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="shrink-0">
                            Delete company
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle className="flex items-center gap-2">
                            <TriangleAlert className="text-status-not-met size-5" /> Delete {companyName}?
                        </DialogTitle>
                        <DialogDescription>
                            All of the company’s data and files are deleted for good. Members keep their own sign-in. Type the company name and your
                            password to confirm.
                        </DialogDescription>
                        <form className="space-y-5" onSubmit={submit}>
                            <div className="grid gap-2">
                                <Label htmlFor="confirm-name">
                                    Company name <span className="text-muted-foreground font-normal">({companyName})</span>
                                </Label>
                                <Input
                                    id="confirm-name"
                                    value={data.confirm_name}
                                    onChange={(e) => setData('confirm_name', e.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={errors.confirm_name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="delete-company-password">Your password</Label>
                                <Input
                                    id="delete-company-password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="current-password"
                                />
                                <InputError message={errors.password} />
                            </div>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button variant="destructive" disabled={processing || data.confirm_name.trim() !== companyName || !data.password}>
                                    Delete company
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </SettingsCard>
    );
}
