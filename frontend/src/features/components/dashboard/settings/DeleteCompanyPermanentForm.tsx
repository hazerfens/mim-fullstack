'use client';

import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { useCompanyStore } from '@/stores/company-store';
import { toast } from 'sonner';
import InlineAlert from '@/components/ui/inline-alert';

interface Props {
  companyId: string;
  companyName: string;
}

export default function DeleteCompanyPermanentForm({ companyId, companyName }: Props) {
  const [input, setInput] = useState('');
  const router = useRouter();
  const clearCompanies = useCompanyStore((s) => s.clearCompanies);
  const matches = input.trim() === (companyName || '').trim();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
          Kalıcı Sil
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Şirketi Kalıcı Olarak Sil</DialogTitle>
        </DialogHeader>

  <InlineAlert description={"Bu işlem geri alınamaz. Lütfen şirket adını doğru girerek onaylayın."} />

        <form className="mt-4" onSubmit={async (e) => {
          e.preventDefault();
          if (!matches) return;
          try {
            const res = await fetch('/api/company/permanent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ companyId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.status !== 'success') {
              toast.error(data.message || 'Şirket kalıcı olarak silinemedi');
              return;
            }
            // Clear client store and navigate home without a hard refresh
            clearCompanies();
            toast.success('Şirket kalıcı olarak silindi');
            router.replace('/');
          } catch (err) {
            console.error(err);
            toast.error('Silme sırasında hata oluştu');
          }
        }}>
          <input type="hidden" name="companyId" value={companyId} />
          <div className="space-y-2">
            <div className='text-xs'>Şirket adını girin: <span className='font-medium'>&rdquo;{companyName}&rdquo;</span></div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={companyName}
              className="w-full rounded-md border px-3 py-2"
              aria-label="Şirket adını yazın"
              name="confirmName"
            />
            <div className="flex justify-end gap-2 pt-4">
              <DialogFooter>
                <button
                  type="submit"
                  disabled={!matches}
                  className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Şirketi Kalıcı Olarak Sil
                </button>
              </DialogFooter>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
