'use client';

import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { deleteCompanySoftAction } from '@/features/actions/company-action';
import InlineAlert from '@/components/ui/inline-alert';

interface Props {
  companyId: string;
  companyName: string;
}

export default function SoftDeleteModal({ companyId, companyName }: Props) {
  const [input, setInput] = useState('');
  const matches = input.trim() === (companyName || '').trim();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700">Şirketi Sil (Yumuşak)</button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yumuşak Silme</DialogTitle>
        </DialogHeader>

  <InlineAlert description={"Bu işlem şirketi pasife alır ve verileri saklar ama kullanıcılar erişemez. Onay için şirket adını girin."} />

        <form action={deleteCompanySoftAction} className="mt-4">
          <input type="hidden" name="companyId" value={companyId} />
          <div className="space-y-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={companyName} className="w-full rounded-md border px-3 py-2" aria-label="Şirket adını yazın" name="confirmName" />
            <div className="flex justify-end pt-4">
              <DialogFooter>
                <button type="submit" disabled={!matches} className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">Şirketi Sil</button>
              </DialogFooter>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
