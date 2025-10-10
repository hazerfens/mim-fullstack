'use client';

import React from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { exportCompanyDataAction } from '@/features/actions/company-action';
import InlineAlert from '@/components/ui/inline-alert';

interface Props {
  companyId: string;
}

export default function ExportDataModal({ companyId }: Props) {
  const [selected, setSelected] = React.useState<string[]>(['company', 'members', 'invitations', 'roles']);
  const [loading, setLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const MODEL_OPTIONS: { key: string; label: string }[] = [
    { key: 'company', label: 'Şirket' },
    { key: 'members', label: 'Üyeler' },
    { key: 'invitations', label: 'Davetler' },
    { key: 'roles', label: 'Roller' },
    { key: 'branches', label: 'Şubeler' },
    { key: 'departments', label: 'Departmanlar' },
  ];

  const toggle = (key: string) => {
    setSelected((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  };

  const allSelected = MODEL_OPTIONS.every((m) => selected.includes(m.key));
  const toggleAll = () => {
    setSelected(allSelected ? [] : MODEL_OPTIONS.map((m) => m.key));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Verileri Dışa Aktar (JSON)</button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verileri Dışa Aktar</DialogTitle>
        </DialogHeader>

  <InlineAlert description="Şirket verilerini seçerek JSON olarak dışa aktarabilirsiniz." />
  {successMessage && <InlineAlert description={successMessage} />}
  {errorMessage && <InlineAlert variant="destructive" description={errorMessage} />}

        <form action={exportCompanyDataAction} className="mt-4 space-y-4">
          <input type="hidden" name="companyId" value={companyId} />
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span className="text-sm">Tümünü seç</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {MODEL_OPTIONS.map((m) => (
                <label key={m.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="models"
                    value={m.key}
                    checked={selected.includes(m.key)}
                    onChange={() => toggle(m.key)}
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DialogFooter>
              <button type="submit" disabled={selected.length === 0} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Anlık İndir</button>
            </DialogFooter>
            <button
              type="button"
              disabled={selected.length === 0 || loading}
              onClick={async () => {
                setSuccessMessage(null);
                setErrorMessage(null);
                setLoading(true);
                try {
                  const res = await fetch(`/api/v1/company/${companyId}/export/background`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ models: selected }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
                    setErrorMessage(err.error || 'Dışa aktarma başlatılamadı');
                    setLoading(false);
                    return;
                  }
                  setSuccessMessage('Dışa aktarma başlatıldı. İndirme linki e-posta ile gönderilecektir.');
                } catch (e) {
                  console.error(e);
                  setErrorMessage('Dışa aktarma başlatılırken hata oluştu');
                } finally {
                  setLoading(false);
                }
              }}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Başlatılıyor...' : 'Arka Planda Başlat ve E-posta Gönder'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
