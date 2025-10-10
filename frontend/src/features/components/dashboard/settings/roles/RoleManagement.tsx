'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Plus, Users, Shield, Settings, Eye } from 'lucide-react'
import { RoleList } from './RoleList'
import { useSession } from '@/components/providers/session-provider'
import { PermissionMatrix } from './PermissionMatrix'
import { PermissionCatalogEditor } from './PermissionCatalogEditor'
// UserRoleAssignment moved into Users settings; removed from Roles management tab
import { UserPermissionMatrix } from './UserPermissionMatrix'
import { RoleForm } from './RoleForm'
import { useRolesStore, useRoles, useRolesLoading } from '@/stores/roles-store'
import type { Role } from '@/features/actions/settings/roles/role-actions'
import { useCompanyStore } from '@/stores/company-store'

export const RoleManagement: React.FC = () => {
  const roles = useRoles();
  const loading = useRolesLoading();
  const fetchRoles = useRolesStore((state) => state.fetchRoles);
  const activeCompany = useCompanyStore((s) => s.activeCompany)
  
  const [activeTab, setActiveTab] = useState('roles')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [showForm, setShowForm] = useState(false)

  const session = useSession()

  useEffect(() => {
    fetchRoles(activeCompany?.id)
  }, [fetchRoles, activeCompany]);

  const handleCreateRole = () => {
    setSelectedRole(null)
    setShowForm(true)
  }

  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setSelectedRole(null)
    fetchRoles(activeCompany?.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 h-auto bg-transparent border-b rounded-none p-0">
          <TabsTrigger 
            value="roles" 
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <Shield className="h-4 w-4" />
            Roller
          </TabsTrigger>
          {session.user?.role === 'super_admin' && (
            <TabsTrigger
              value="system"
              className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
            >
              <Shield className="h-4 w-4" />
              Sistem Rolleri
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="permissions" 
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <Settings className="h-4 w-4" />
            İzinler
          </TabsTrigger>
          {/* Kullanıcı-Rol tab removed; use Users settings page for role assignment & permissions */}
          <TabsTrigger 
            value="overview" 
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <Eye className="h-4 w-4" />
            Genel Bakış
          </TabsTrigger>
        </TabsList>

        {/* Roller Tab */}
  <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{activeCompany ? `${activeCompany.name} - Şirket Rolleri` : 'Sistem Rolleri'}</CardTitle>
                  <CardDescription>
                    Rolleri oluşturun, düzenleyin ve yönetin
                  </CardDescription>
                </div>
                <Button type="button" onClick={handleCreateRole}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Rol
                </Button>
              </div>
            </CardHeader>
            <CardContent>
                <RoleList
                  roles={roles}
                  onEdit={handleEditRole}
                  onRefresh={(force?: boolean) => fetchRoles(activeCompany?.id, force)}
                />
            </CardContent>
          </Card>
        </TabsContent>

        {/* İzinler Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rol İzin Matrisi</CardTitle>
              <CardDescription>
                Her rol için modül bazlı izinleri yönetin (ABAC kuralları)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Permission catalog editor sits above the per-role matrix. Admins create catalog entries here, then use the matrix to bind them to roles. */}
              {session.user?.role === 'super_admin' && (
                <div className="mb-4">
                  <PermissionCatalogEditor />
                </div>
              )}

              {roles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Henüz hiç rol oluşturulmamış
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {roles.map((role) => (
                    <AccordionItem key={role.id ?? role.name} value={role.id ?? role.name}>
                      <AccordionTrigger className="hover:no-underline cursor-pointer hover:text-emerald-700">
                        <div className="flex items-center gap-3 w-full">
                          <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="flex items-center justify-between flex-1 text-left">
                            <div>
                              <span className="font-semibold">{role.description}</span>
                              <span className="text-sm text-muted-foreground ml-3">
                                {role.name}
                              </span>
                            </div>
                            <Badge variant={role.is_active ? "default" : "secondary"} className="mr-2">
                              {role.is_active ? 'Aktif' : 'Pasif'}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-2 pb-4">
                          <PermissionMatrix role={role} companyId={activeCompany?.id} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Roles Tab (super_admin only) */}
        {session.user?.role === 'super_admin' && (
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sistem Rolleri</CardTitle>
                    <CardDescription>
                      Sistem yöneticisinin oluşturduğu global roller
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <RoleList
                  roles={roles}
                  onEdit={handleEditRole}
                  onRefresh={() => fetchRoles(undefined, true)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 'Kullanıcı-Rol' tab removed - role assignment and per-user permission editing moved to Users page */}

        {/* Genel Bakış Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kullanıcı İzin Görünümü</CardTitle>
              <CardDescription>
                Tüm kullanıcıların sahip olduğu izinleri görüntüleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserPermissionMatrix />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showForm && (
        <RoleForm
          role={selectedRole}
          onClose={handleFormClose}
          companyId={activeCompany?.id}
        />
      )}
    </div>
  )
}