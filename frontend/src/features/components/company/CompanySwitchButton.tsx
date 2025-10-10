'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyStore } from '@/stores/company-store';
import { toast } from 'sonner';

interface Props {
  companyId: string;
  children: React.ReactNode;
  className?: string;
}

export default function CompanySwitchButton({ companyId, children, className }: Props) {
  const [loading, setLoading] = React.useState(false);
  const switchCompany = useCompanyStore((s) => s.switchCompany);
  const companies = useCompanyStore((s) => s.companies);
  const router = useRouter();

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await switchCompany(companyId);
      if (res.ok) {
        const company = companies.find((c) => c.id === companyId);
        toast.success('Şirket değiştirildi', {
          description: `${company?.unvani || company?.name || 'Şirket'} aktif edildi`,
        });
        router.push('/dashboard');
      } else {
        setLoading(false);
        const msg = res.message || (res.statusCode === 403 ? 'Bu şirkete erişiminiz yok' : 'Şirket değiştirme başarısız oldu');
        toast.error(msg);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast.error('Şirket değiştirilirken hata oluştu');
    }
  };

  return (
    <button type="button" onClick={handle} disabled={loading} className={className}>
      {loading ? 'Yükleniyor...' : children}
    </button>
  );
}
