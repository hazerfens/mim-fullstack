import React from 'react'
import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { User } from '@/types/user/user'
import MenuManagement from '@/features/components/dashboard/settings/menu-management'


const MenuSettingsPage = async () => {
  const user = (await getServerSession()) as User | null
  if (!user) redirect('/auth/login')

  // Check if user has admin privileges
  if (!['admin', 'super_admin'].includes(user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Menü Yönetimi</h1>
        <p className="text-muted-foreground">
          Sistem menülerini ve içeriklerini yönetin
        </p>
      </div>
        <MenuManagement />
      
    </div>
  )
}

export default MenuSettingsPage