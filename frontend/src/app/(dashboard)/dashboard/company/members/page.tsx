import { redirect } from "next/navigation";
import { getActiveCompanyAction } from "@/features/actions/company-action";
import CompanyMembersClient from "@/features/components/company/company-members-client";
import { getServerSession } from '@/lib/auth';

export default async function CompanyMembersPage() {
  const session = (await getServerSession());
  if (!session) redirect('/auth/login');

  const activeCompanyResult = await getActiveCompanyAction();
  if (activeCompanyResult.status !== 'success' || !activeCompanyResult.data) {
    redirect('/dashboard?error=no_active_company');
  }

  const company = activeCompanyResult.data;
  return (
    <div className="container mx-auto py-8 px-4">
      <CompanyMembersClient company={company} />
    </div>
  );
}
