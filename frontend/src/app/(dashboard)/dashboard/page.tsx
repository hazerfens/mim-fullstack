import React from 'react'
import { getServerSession } from '@/lib/auth';
import DashboardNotifications from '@/features/components/dashboard/dashboard-notifications';
import { redirect } from 'next/navigation';
import type { User } from '@/types/user/user';



const Dashboard = async () => {
  const user = (await getServerSession()) as User | null;
  if (!user) redirect('/auth/login');

  return (
    <div>
      {/* <DashboardNotifications /> */}
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">
          Hoş geldin, {user?.email || '-'}!
          <br />Rol: {user?.role || '-'}
          <br />Email: {user?.email || '-'}
          <br />Kullanıcı ID: {user?.id || '-'}
          <br />image_url: {user?.image_url || '-'}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;