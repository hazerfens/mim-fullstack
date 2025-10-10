import React from 'react'
import { getActiveCompanyAction, toggleCompanyActiveAction, Company as CompanyType } from '../../../../../features/actions/company-action'
import { getServerSession } from '../../../../../lib/auth'
import { redirect } from 'next/navigation'
import InlineAlert from '../../../../../components/ui/inline-alert'
import DeleteCompanyPermanentForm from '../../../../../features/components/dashboard/settings/DeleteCompanyPermanentForm'
import PassiveModal from '../../../../../features/components/dashboard/settings/PassiveModal'
import SoftDeleteModal from '../../../../../features/components/dashboard/settings/SoftDeleteModal'
import ExportDataModal from '../../../../../features/components/dashboard/settings/ExportDataModal'

const CompanySettings = async () => {
  const user = (await getServerSession());
  if (!user) redirect('/auth/login');

  const PageContent = async () => {
    // Server-side: fetch active company
    const res = await getActiveCompanyAction();
    let company: CompanyType | null = null;
    if (res && res.status === 'success') {
      company = res.data as CompanyType;
    }

    let isOwner = false;
    if (company && user) {
      const userId = user.id;
      const c = company as unknown as Record<string, unknown>;
      const ownerId = (c?.user_id as string | undefined) || ((c?.user as Record<string, unknown>)?.id as string | undefined) || null;
      if (ownerId && userId && ownerId.toString() === userId.toString()) {
        isOwner = true;
      }
    }

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
            <h2 className="text-lg font-medium">{company.adi || company.unvani || company.name}</h2>
            <p className="text-sm text-muted-foreground">Slug: {company.slug}</p>
          </div>

          <div className="pt-4 border-t">
            {!isOwner && (
              <div className="mb-4">
                <InlineAlert variant="default" description="Bu işlemleri yalnızca şirket sahibi gerçekleştirebilir." />
              </div>
            )}
            {isOwner && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border rounded-md">
                <h4 className="text-sm font-medium">Durum Değiştirme</h4>
                <p className="text-sm text-muted-foreground">Şirketi pasif yaparak erişimi kısıtlayabilir veya yeniden etkinleştirebilirsiniz.</p>
                <div className="pt-3">
                  <form id={`toggle-active-${company.id}`} action={toggleCompanyActiveAction} className="inline">
                    <input type="hidden" name="companyId" value={company.id} />
                    <input type="hidden" name="isActive" value={String(!company.is_active)} />
                    <PassiveModal companyId={company.id} isActive={company.is_active} />
                  </form>
                </div>
              </div>

              <div className="p-4 border rounded-md">
                <h4 className="text-sm font-medium">Yumuşak Silme</h4>
                <p className="text-sm text-muted-foreground">Şirket verileri saklanır fakat kullanıcılar erişemez; casbin politikaları temizlenir.</p>
                <div className="pt-3">
                  <SoftDeleteModal companyId={company.id} companyName={(company.adi || company.unvani || company.name || company.slug || 'Şirket').toString()} />
                </div>
              </div>

              <div className="p-4 border rounded-md">
                <h4 className="text-sm font-medium">Kalıcı Silme</h4>
                <p className="text-sm text-muted-foreground">Tüm veriler kalıcı olarak silinecek ve geri alınamaz.</p>
                <div className="pt-3">
                  <DeleteCompanyPermanentForm companyId={company.id} companyName={(company.adi || company.unvani || company.name || company.slug || 'Şirket').toString()} />
                </div>
              </div>

              <div className="p-4 border rounded-md">
                <h4 className="text-sm font-medium">Verileri Dışa Aktar</h4>
                <p className="text-sm text-muted-foreground">Üyeler, roller ve davetler dahil olmak üzere şirket verilerini JSON olarak indir.</p>
                <div className="pt-3">
                  <ExportDataModal companyId={company.id} />
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
    };

  // Render the async content with the server-session user
  return <PageContent />;
}

export default CompanySettings