import { RoleManagement } from '@/features/components/dashboard/settings/roles/RoleManagement'
import React from 'react'


const RolesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Role Yönetimi</h1>
        <p className="text-muted-foreground">
          Sistem rollerini ve izinlerini yönetin
        </p>
      </div>
      <RoleManagement />
    </div>
  )
}

export default RolesPage