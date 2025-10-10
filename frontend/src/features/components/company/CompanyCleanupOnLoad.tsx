'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCompanyStore } from '@/stores/company-store';

export default function CompanyCleanupOnLoad() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clearCompanies = useCompanyStore((s) => s.clearCompanies);

  useEffect(() => {
    const flag = searchParams.get('company_cleared');
    if (flag === '1') {
      clearCompanies();
      // remove query param without adding a new history entry
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router, clearCompanies]);

  return null;
}
