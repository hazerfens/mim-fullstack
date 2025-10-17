import React from 'react'
import { getActiveCompanyAction, Company as CompanyType } from '@/features/actions/company-action'
import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InlineAlert from '@/components/ui/inline-alert'
import CompanyDetailsForm from '@/features/components/company/company-details-form'
import { AdvancedSettingsSection } from '@/features/components/dashboard/settings/AdvancedSettingsSection'

const CompanySettings = async () => {
  const user = await getServerSession();
  if (!user) redirect('/auth/login');

  // Server-side: fetch active company
  const res = await getActiveCompanyAction();
  const company = res?.status === 'success' ? (res.data as CompanyType) : null;

  // Get company display name
  const companyName = company?.adi || company?.unvani || company?.name || company?.slug || 'Şirket';

  // Determine if current user is the owner (supports user_id or nested user.id)
  const isOwner = (() => {
    if (!company || !user) return false;
    
    // Super admins can manage any company
    if (user.role === 'super_admin') return true;
    
    // Check if user is the owner
    const companyData = company as unknown as Record<string, unknown>;
    const ownerId = companyData.user_id || (companyData.user as Record<string, unknown>)?.id;
    return ownerId != null && String(ownerId) === String(user.id);
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Şirket Ayarları</h1>
      <div className="bg-card border rounded-lg p-6">
        {!company && (
          <div className="text-sm text-muted-foreground">Aktif şirket bulunamadı.</div>
        )}

        {company && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">{companyName}</h2>
              <p className="text-sm text-muted-foreground">Slug: {company.slug}</p>
            </div>

            <CompanyDetailsForm company={company} />

            <div className="pt-4 border-t">
              {!isOwner && (
                <InlineAlert variant="default" description="Bu işlemleri yalnızca şirket sahibi gerçekleştirebilir." />
              )}
              
              {isOwner && (
                <AdvancedSettingsSection
                  companyId={company.id}
                  companyName={String(companyName)}
                  isActive={company.is_active || null}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompanySettings