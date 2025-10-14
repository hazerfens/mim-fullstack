"use client";

import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "lucide-react";
import { Edit, Trash2, Users, Shield } from "lucide-react";
import {
  type Role,
  updateRoleAction,
} from "@/features/actions/settings/roles/role-actions";
import { toast } from "sonner";
import { useRolesStore } from "@/stores/roles-store";
import type { Permissions } from "@/lib/permissions";

interface RoleListProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onRefresh?: (force?: boolean) => void;
}

export const RoleList: React.FC<RoleListProps> = ({
  roles,
  onEdit,
  onRefresh,
}) => {
  // Subscribe to server-sent role events so active/passive changes are realtime
  // Subscribe to role SSE and update roles store in place (no full refresh)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events/roles");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (!data || !data.type) return;
          const rolesState = useRolesStore.getState();
          const current = rolesState.roles;
          if (data.type === "role.updated" && data.role) {
            const incoming = data.role;
            const updated = current.map((r: Role) =>
              r.id === incoming.id ? (incoming as Role) : r
            );
            rolesState.setRoles(updated);
          } else if (data.type === "role.created" && data.role) {
            const incoming = data.role;
            if (!current.find((r: Role) => r.id === incoming.id)) {
              rolesState.setRoles([incoming as Role, ...current]);
            }
          } else if (data.type === "role.deleted" && data.roleId) {
            rolesState.setRoles(
              current.filter((r: Role) => r.id !== data.roleId)
            );
          }
        } catch {}
      };
    } catch {
      // ignore
    }
    return () => {
      if (es) es.close();
    };
  }, []);

  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  useBlockFormSubmit(!!deletingRole);

  const handleDeleteRole = async (roleId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "success") {
        // Specific handling for conflict: role is assigned to users
        if (res.status === 409) {
          toast.error(
            data.message || "Rol kullanıcıya atandığı için silinemiyor"
          );
          // keep the confirmation modal open so user can cancel or inspect
          setIsDeleting(false);
          return;
        }

        toast.error(data.message || "Rol silinirken hata oluştu");
        setIsDeleting(false);
        setDeletingRole(null);
        return;
      }

      toast.success("Rol başarıyla silindi");
      onRefresh?.(true);
      // successful deletion -> close modal
      setIsDeleting(false);
      setDeletingRole(null);
    } catch (error) {
      console.error("Delete role error:", error);
      toast.error("Rol silinirken hata oluştu");
      setIsDeleting(false);
      setDeletingRole(null);
    }
  };

  const getPermissionCount = (permissions: Permissions) => {
    if (!permissions) return 0;

    let count = 0;
    Object.values(permissions).forEach((perm) => {
      if (perm?.create) count++;
      if (perm?.read) count++;
      if (perm?.update) count++;
      if (perm?.delete) count++;
    });
    return count;
  };

  return (
    <div>
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
                <AccordionPrimitive.Trigger className="focus-visible:border-ring cursor-pointer focus-visible:ring-ring/50 flex items-center gap-3 w-full rounded-md py-4 text-left text-sm font-medium transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180">
                  <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex flex-col min-w-0 ml-3">
                    <div className="text-sm truncate">
                      {role.description}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
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
                      const updatedList = previous.map((r: Role) =>
                        r.id === role.id ? { ...r, is_active: v } : r
                      );
                      rolesState.setRoles(updatedList);
                      try {
                        const res = await updateRoleAction(
                          role.id,
                          { is_active: v },
                          role.company_id ?? undefined
                        );
                        if (res.status !== "success") {
                          toast.error("Durum güncellenemedi", {
                            description: res.message,
                          });
                          rolesState.setRoles(previous);
                        } else {
                          toast.success(
                            v ? "Rol aktifleştirildi" : "Rol pasifleştirildi"
                          );
                        }
                      } catch (err) {
                        console.error("Toggle role active error", err);
                        toast.error("Durum güncellemesi sırasında hata oluştu");
                        rolesState.setRoles(previous);
                      }
                    }}
                  />
                </div>
              </AccordionPrimitive.Header>
              <AccordionContent>
                <div className="px-2 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{getPermissionCount(role.permissions)} izin</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onEdit(role);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Düzenle
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingRole(role);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Confirmation modal for deleting roles */}
      <AlertDialog
        open={!!deletingRole}
        onOpenChange={(open) => {
          if (!open) setDeletingRole(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rolü sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRole
                ? `${deletingRole.description} (${deletingRole.name}) rolünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
                : "Rolü silmek istediğinizden emin misiniz?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                if (deletingRole) {
                  handleDeleteRole(deletingRole.id);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// When confirmation dialog is open, block any form submit events that might come from
// ancestor forms (prevents accidental full page reloads caused by submit bubbling).
// We attach a capturing listener while the dialog is open and remove it afterwards.
function useBlockFormSubmit(shouldBlock: boolean) {
  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e: Event) => {
      // prevent any submit default behavior on the document
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, [shouldBlock]);
}
