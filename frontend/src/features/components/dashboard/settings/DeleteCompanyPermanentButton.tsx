'use client';

import React from 'react';

interface Props {
  formId: string;
  companyName?: string | null;
}

export default function DeleteCompanyPermanentButton({ formId, companyName }: Props) {
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const name = companyName || 'bu şirket';
    const confirmed = window.confirm(
      `Bu işlemi geri alamazsınız. ${name} kalıcı olarak silinecek. Devam etmek istiyor musunuz?`
    );
    if (!confirmed) return;

    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (form) {
      // Use requestSubmit if available to respect validation
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    } else {
      // Fallback: submit via fetch directly (not recommended; server action preferred)
      console.warn('Form not found for permanent delete');
    }
  };

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      type="button"
    >
      Kalıcı Sil
    </button>
  );
}
