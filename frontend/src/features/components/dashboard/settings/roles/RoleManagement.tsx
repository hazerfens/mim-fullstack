'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Plus, Users, Shield, Settings, Eye } from 'lucide-react'
import { RoleList } from './RoleList'
import { PermissionMatrix } from './PermissionMatrix'
import { UserRoleAssignment } from './UserRoleAssignment'
import { UserPermissionMatrix } from './UserPermissionMatrix'
import { RoleForm } from './RoleForm'
import { useRolesStore, useRoles, useRolesLoading } from '@/stores/roles-store'
import type { Role } from '@/features/actions/settings/roles/role-actions'

export const RoleManagement: React.FC = () => {
  const roles = useRoles();
  const loading = useRolesLoading();
  const fetchRoles = useRolesStore((state) => state.fetchRoles);
  
  const [activeTab, setActiveTab] = useState('roles')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

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
    fetchRoles()
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
            className="cursor-pointer flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <Shield className="h-4 w-4" />
            Roller
          </TabsTrigger>
          <TabsTrigger 
            value="permissions" 
            className="cursor-pointer flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <Settings className="h-4 w-4" />
            İzinler
          </TabsTrigger>
          <TabsTrigger 
            value="assignments" 
            className="cursor-pointer flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <Users className="h-4 w-4" />
            Kullanıcı-Rol
          </TabsTrigger>
          <TabsTrigger 
            value="overview" 
            className="cursor-pointer flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
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
                  <CardTitle>Sistem Rolleri</CardTitle>
                  <CardDescription>
                    Rolleri oluşturun, düzenleyin ve yönetin
                  </CardDescription>
                </div>
                <Button onClick={handleCreateRole}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Rol
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RoleList
                roles={roles}
                onEdit={handleEditRole}
                onRefresh={fetchRoles}
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
              {roles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Henüz hiç rol oluşturulmamış
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {roles.map((role) => (
                    <AccordionItem key={role.id} value={role.id}>
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
                          <PermissionMatrix role={role} onUpdate={fetchRoles} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kullanıcı-Rol Atamaları Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <UserRoleAssignment onUpdate={fetchRoles} />
        </TabsContent>

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
        />
      )}
    </div>
  )
}