import React from 'react'
import { UsersTable } from '@/features/components/dashboard/settings/users/UsersTable'

const UsersSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kullanıcı Yönetimi</h1>
        <p className="text-muted-foreground">Sistemdeki kullanıcıları görüntüleyin, arayın, düzenleyin veya silin.</p>
      </div>
      <UsersTable />
    </div>
  )
}

export default UsersSettings