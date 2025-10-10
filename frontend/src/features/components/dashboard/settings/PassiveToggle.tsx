'use client';

import React from 'react';

interface Props {
  formId: string;
  companyId?: string;
  isActive?: boolean;
}

export default function PassiveToggle({ formId, isActive }: Props) {
  const targetActive = !isActive;

  const onClick = () => {
    if (!targetActive) {
      // going to deactivate: confirm
      const confirmed = window.confirm('Şirket pasif hale getirildiğinde kullanıcılar erişemez. Devam etmek istiyor musunuz?');
      if (!confirmed) return;
    }
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (form) {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className={targetActive ? "inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700" : "inline-flex items-center rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"}
      >
        {targetActive ? 'Şirketi Aktif Et' : 'Şirketi Pasif Yap'}
      </button>
    </div>
  );
}
