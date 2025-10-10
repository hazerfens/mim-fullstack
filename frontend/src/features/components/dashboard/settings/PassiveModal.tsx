'use client';

import React from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toggleCompanyActiveAction } from '@/features/actions/company-action';
import InlineAlert from '@/components/ui/inline-alert';

interface Props {
  companyId: string;
  isActive?: boolean;
}

export default function PassiveModal({ companyId, isActive }: Props) {
  const formId = `toggle-active-${companyId}`;
  const targetActive = !isActive;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700">
          {targetActive ? 'Şirketi Aktif Et' : 'Şirketi Pasif Yap'}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{targetActive ? 'Şirketi Aktif Et' : 'Şirketi Pasif Yap'}</DialogTitle>
        </DialogHeader>

  <InlineAlert description={targetActive ? 'Şirketi yeniden aktif hale getireceksiniz.' : 'Şirketi pasif hale getirirseniz, sadece şirket sahibi erişebilecektir.'} />

        <form id={formId} action={toggleCompanyActiveAction} className="mt-4">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="isActive" value={String(targetActive)} />
          <div className="flex justify-end pt-4">
            <DialogFooter>
              <button type="submit" className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700">{targetActive ? 'Aktifleştir' : 'Pasifleştir'}</button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
