import {
  getUserCompaniesAction,
  getAllCompaniesForAdminAction,
} from "@/features/actions/company-action";
import CreateCompanyModal from "@/features/components/company/CreateCompanyModal";
import CompanyCleanupOnLoad from "@/features/components/company/CompanyCleanupOnLoad";
import Link from "next/link";
import CompanySwitchButton from "@/features/components/company/CompanySwitchButton";
import { redirect } from "next/navigation";
import { getServerSession } from '@/lib/auth';
import type { Company } from "@/features/actions/company-action";
import type { User } from "@/types/user/user";
import { Button } from "@/components/ui/button";

export default async function SayfamizdaPage() {
  const user = (await getServerSession()) as User | null;
  if (!user) {
    redirect('/auth/login');
  }

  const PageContent = async ({ user }: { user: User }) => {
    // Fetch companies according to role
    let companiesResult;
    if (user?.role === 'super_admin') {
      companiesResult = await getAllCompaniesForAdminAction();
    } else {
      companiesResult = await getUserCompaniesAction();
    }

    if (companiesResult.status !== 'success') {
      // Show minimal UI with error or fallback
      return (
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-2xl font-semibold mb-4">Sayfamızda</h1>
          <p className="text-sm text-muted-foreground">
            {companiesResult.status === 'error'
              ? companiesResult.message
              : 'Lütfen giriş yapın.'}
          </p>
        </div>
      );
    }

    const companies = companiesResult.data as Company[];

    // Normal user: if not member of any company -> show "Yeni Şirket Ekle"
    if (user?.role !== 'super_admin') {
      if (!companies || companies.length === 0) {
        return (
          <div className="container mx-auto py-8 px-4">
            <CompanyCleanupOnLoad />
            <h1 className="text-2xl font-semibold mb-4">
              Hoş geldiniz, {user?.full_name || user?.email}
            </h1>
            <p className="mb-6">
              Henüz bir şirkete kayıt olmamışsınız. Yeni bir şirket
              oluşturabilirsiniz.
            </p>
            <CreateCompanyModal />
          </div>
        );
      }

      // If user belongs to companies, show the first one as requested
      const company = companies[0] as Company;
      const displayName =
        company.unvani || company.adi || company.name || company.slug || 'Şirkete Git';
      return (
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-2xl font-semibold mb-4">
            Hoş geldiniz, {user?.full_name || user?.email}
          </h1>
          <p className="mb-6">Aşağıdaki butonla şirket panelinize geçebilirsiniz.</p>
          <CompanySwitchButton companyId={company.id} className="btn btn-outline">
            {displayName}
          </CompanySwitchButton>
        </div>
      );
    }

    // super_admin: show list of all companies (and creation/dashboard actions)
    const hasCompanies = !!companies && companies.length > 0;
    return (
      <div className="container mx-auto py-8 px-4">
        <CompanyCleanupOnLoad />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Tüm Şirketler</h1>
          <div className="flex gap-2">
            <CreateCompanyModal />
            {!hasCompanies && (
              <Button>
                <Link href="/dashboard" className="btn btn-outline">
                  Dashboard
                </Link>
              </Button>
            )}
          </div>
        </div>

        {!hasCompanies ? (
          <div className="p-6 border rounded-md">
            <p className="mb-4">
              Henüz kayıtlı bir şirket yok. Yeni bir şirket oluşturabilir veya
              genel yönetim paneline gidebilirsiniz.
            </p>
            <div className="flex gap-2">
              <CreateCompanyModal />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((c: Company) => {
              const name = c.unvani || c.adi || c.name || c.slug || c.id;
              return (
                <div
                  key={c.id}
                  className="p-4 border rounded-md flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-muted-foreground">{c.slug}</div>
                  </div>
                  <CompanySwitchButton companyId={c.id} className="btn btn-sm">
                    Aç
                  </CompanySwitchButton>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return <PageContent user={user as User} />;
}
