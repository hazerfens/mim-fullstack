"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { updateRoleAction } from "@/features/actions/settings/roles/role-actions";
import { Plus, Shield, Settings, Eye } from "lucide-react";
import { RoleList } from "./RoleList";
import { SystemRolesModal } from "./SystemRolesModal";
import { useSession } from "@/components/providers/session-provider";
import { PermissionMatrix } from "./PermissionMatrix";
import RolePermissionsModal from './RolePermissionsModal'
import { PermissionCatalogEditor } from "./PermissionCatalogEditor";
// UserRoleAssignment moved into Users settings; removed from Roles management tab
import { CasbinUserPermissionMatrix } from "./CasbinUserPermissionMatrix";
import { RoleForm } from "./RoleForm";
import { useRolesStore, useRoles, useRolesLoading, fetchRolesClient } from "@/stores/roles-store";
import type { Role } from "@/features/actions/settings/roles/role-actions";
import { useCompanyStore } from "@/stores/company-store";
import { toast } from "sonner";

export const RoleManagement: React.FC = () => {
  const roles = useRoles();
  const loading = useRolesLoading();
  const fetchRoles = useRolesStore((state) => state.fetchRoles);
  const activeCompany = useCompanyStore((s) => s.activeCompany);

  // Default to the Roles tab so admins land in the role list by default
  const [activeTab, setActiveTab] = useState("roles");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rolePermissionsModalRole, setRolePermissionsModalRole] = useState<Role | null>(null);

  const session = useSession();

  useEffect(() => {
    if (activeTab === "roles") {
      // Force a fresh roles fetch whenever user switches to the Roles tab
      void fetchRoles(activeCompany?.id, true);
    }
    if (
      activeTab === "system" &&
      (session.user?.role === "admin" || session.user?.role === "super_admin")
    ) {
      void fetchRoles(undefined, true);
    }
  }, [fetchRoles, activeCompany, activeTab, session.user?.role]);

  const handleCreateRole = () => {
    setSelectedRole(null);
    setShowForm(true);
  };

  const [systemModalOpen, setSystemModalOpen] = useState(false);
  const [systemRoles, setSystemRoles] = useState<Role[] | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);

  const openSystemRoles = async () => {
    // open modal immediately and fetch system roles via client-side fetch
    // to avoid server-action edge cases that sometimes return unexpected
    // responses when called from client components.
    setSystemModalOpen(true);
    setSystemLoading(true);
    try {
      const res = await fetchRolesClient(undefined);
      if (res.status === 'success') {
        setSystemRoles(res.roles || []);
      } else {
        toast.error(res.message || 'Sistem rolleri yüklenemedi');
      }
    } catch (err) {
      console.error('Failed to fetch system roles (client fallback)', err);
      toast.error('Sistem rolleri yüklenemedi');
    } finally {
      setSystemLoading(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedRole(null);
    // Force refresh so edited/created roles are immediately visible
    void fetchRoles(activeCompany?.id, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {(session.user?.role === "admin" ||
          session.user?.role === "super_admin") && (
          <Button
            type="button"
            variant="destructive"
            className="ml-2"
            onClick={openSystemRoles}
          >
            Sistem Rolleri
          </Button>
        )}
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent border-b rounded-none p-0">
          <TabsTrigger
            value="roles"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6" />
              Roller
            </div>
          </TabsTrigger>
          {/* System roles are available via a modal button to avoid unnecessary prefetches */}
          <TabsTrigger
            value="permissions"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6" />
              İzinler
            </div>
          </TabsTrigger>
          {/* Kullanıcı-Rol tab removed; use Users settings page for role assignment & permissions */}
          <TabsTrigger
            value="overview"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6" />
              Kullanıcı Özel İzinleri
            </div>
          </TabsTrigger>
        </TabsList>

        {/* Roller Tab */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {activeCompany
                      ? `${activeCompany.name} - Şirket Rolleri`
                      : "Sistem Rolleri"}
                  </CardTitle>
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
                onRefresh={(force?: boolean) =>
                  fetchRoles(activeCompany?.id, force)
                }
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
              {session.user?.role === "super_admin" && (
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
                    <AccordionItem
                      key={role.id ?? role.name}
                      value={role.id ?? role.name}
                    >
                      <AccordionPrimitive.Header className="flex">
                        <AccordionPrimitive.Trigger className="focus-visible:border-ring focus-visible:ring-ring/50 flex items-center gap-3 w-full rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180">
                          <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="min-w-0 ml-3">
                            <div className="font-semibold truncate">
                              {role.description}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {role.name}
                            </div>
                          </div>
                          <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200 ml-3" />
                        </AccordionPrimitive.Trigger>
                        <div className="flex items-center gap-2 ml-3">
                          <Badge
                            variant={role.is_active ? "default" : "secondary"}
                            className="mr-2"
                          >
                            {role.is_active ? "Aktif" : "Pasif"}
                          </Badge>
                          <Switch
                            checked={!!role.is_active}
                            onCheckedChange={async (v: boolean) => {
                              const rolesState = useRolesStore.getState();
                              const previous = rolesState.roles;
                              rolesState.setRoles(
                                previous.map((r: Role) =>
                                  r.id === role.id ? { ...r, is_active: v } : r
                                )
                              );
                              try {
                                const res = await updateRoleAction(
                                  role.id,
                                  { is_active: v },
                                  activeCompany?.id
                                );
                                if (res.status !== "success") {
                                  toast.error("Durum güncellenemedi", {
                                    description: res.message,
                                  });
                                  rolesState.setRoles(previous);
                                } else {
                                  toast.success(
                                    v
                                      ? "Rol aktifleştirildi"
                                      : "Rol pasifleştirildi"
                                  );
                                }
                              } catch (err) {
                                console.error("Toggle role active error", err);
                                toast.error(
                                  "Durum güncellemesi sırasında hata oluştu"
                                );
                                rolesState.setRoles(previous);
                              }
                            }}
                          />
                        </div>
                      </AccordionPrimitive.Header>
                      <AccordionContent>
                        <div className="pt-2 pb-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <PermissionMatrix role={role} companyId={activeCompany?.id} />
                            </div>
                            <div className="w-44">
                              <div className="sticky top-4">
                                <Button type="button" variant="secondary" onClick={() => setRolePermissionsModalRole(role)} className="w-full mb-3">Ek İzinler</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Roles Tab (admin and super_admin) */}
        {(session.user?.role === "admin" ||
          session.user?.role === "super_admin") && (
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

        {/* Kullanıcı Özel İzinleri Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kullanıcı Özel İzinleri</CardTitle>
              <CardDescription>
                Kullanıcılara rol dışında özel izinler atayın (Casbin ABAC)
              </CardDescription>
            </CardHeader>
              <CardContent>
              <CasbinUserPermissionMatrix active={activeTab === 'overview'} />
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
      <SystemRolesModal
        open={systemModalOpen}
        onOpenChange={(open) => {
          setSystemModalOpen(open);
          // when modal is closed, keep cached roles; when opened via other means, ensure we fetch
        }}
        roles={systemRoles || undefined}
        loading={systemLoading}
        onRefresh={openSystemRoles}
      />
      {rolePermissionsModalRole && (
        <RolePermissionsModal
          role={rolePermissionsModalRole}
          companyId={activeCompany?.id}
          open={Boolean(rolePermissionsModalRole)}
          onClose={() => setRolePermissionsModalRole(null)}
        />
      )}
    </div>
  );
};
