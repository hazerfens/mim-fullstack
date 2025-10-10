"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Mail, MoreVertical, Loader2, Crown, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OrphanedMembersModal from "./OrphanedMembersModal";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InlineAlert from '@/components/ui/inline-alert';
import {
  getCompanyMembers,
  getCompanyInvitations,
  removeMember,
  cancelInvitation,
  type CompanyMember,
  type PendingInvitation,
  } from "@/features/actions/company-member-action";
import InviteMemberDialog from "./invite-member-dialog";


interface CompanyMembersClientProps {
  company: {
    id: string;
    name?: string;
    adi?: string;
  };
}

export default function CompanyMembersClient({ company }: CompanyMembersClientProps) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [orphanModalOpen, setOrphanModalOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    const result = await getCompanyMembers(company.id);
    if (result.success && result.data) {
      setMembers(result.data);
    } else {
      setError(result.error || "Üyeler yüklenemedi");
    }
    setIsLoadingMembers(false);
  }, [company.id]);

  const loadInvitations = useCallback(async () => {
    setIsLoadingInvitations(true);
    const result = await getCompanyInvitations(company.id);
    if (result.success && result.data) {
      setInvitations(result.data);
    }
    setIsLoadingInvitations(false);
  }, [company.id]);

  useEffect(() => {
    loadMembers();
    loadInvitations();
  }, [loadMembers, loadInvitations]);

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Bu üyeyi çıkarmak istediğinizden emin misiniz?")) return;
    
    const result = await removeMember(company.id, memberId);
    if (result.success) {
      loadMembers();
    } else {
      alert(result.error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm("Bu daveti iptal etmek istediğinizden emin misiniz?")) return;
    
    const result = await cancelInvitation(company.id, invitationId);
    if (result.success) {
      loadInvitations();
    } else {
      alert(result.error);
    }
  };

  const getRoleBadgeColor = (roleName?: string) => {
    if (!roleName) return "bg-gray-100 text-gray-800";
    
    switch (roleName.toLowerCase()) {
      case "super_admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "admin":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "company_owner":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRoleDisplayName = (roleName?: string) => {
    if (!roleName) return "Rol Yok";
    
    const roleMap: Record<string, string> = {
      super_admin: "Süper Admin",
      admin: "Yönetici",
      company_owner: "Şirket Sahibi",
      manager: "Müdür",
      user: "Kullanıcı",
    };
    return roleMap[roleName.toLowerCase()] || roleName;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kullanıcı Yönetimi</h1>
          <p className="text-muted-foreground">
            {company.name || company.adi} şirketinin kullanıcılarını yönetin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Üye Davet Et
          </Button>
          <Button variant="outline" onClick={() => setOrphanModalOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Problemli Kullanıcıları Yönet
          </Button>
          {/* <Button variant="ghost" onClick={async () => {
            // Simple inline edit flow for company title/short name
            const newUnvani = prompt('Yeni Ünvan (unvani) girin:', company.name || company.adi || '');
            if (newUnvani === null) return;
            const newAdi = prompt('Yeni Kısa Ad (adi) girin:', company.adi || '');
            if (newAdi === null) return;

            // Call update action
            try {
              const res = await updateCompanyAction(company.id, { unvani: newUnvani, adi: newAdi });
              if (res.status === 'success') {
                toast.success('Şirket başarıyla güncellendi')
                window.location.reload();
              } else {
                toast.error('Şirket güncellenemedi: ' + res.message)
              }
            } catch (e) {
              console.error(e);
              toast.error('Şirket güncellenirken hata oluştu')
            }
          }}>
            <Users className="h-4 w-4 mr-2" />
            Şirketi Düzenle
          </Button>
          <Button variant="destructive" onClick={async () => {
            if (!confirm('Bu şirketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz. \nNot: Şirket silindiğinde roller, izinler, üyeler, davetler, şube ve departmanlar da kaldırılacaktır.')) return;
            try {
              const res = await deleteCompanyAction(company.id);
              if (res.status === 'success') {
                toast.success('Şirket silindi')
                // Redirect to dashboard main
                window.location.href = '/dashboard';
              } else {
                toast.error('Şirket silinemedi: ' + res.message)
              }
            } catch (e) {
              console.error(e);
              toast.error('Şirket silinirken hata oluştu')
            }
          }}>
            <Users className="h-4 w-4 mr-2" />
            Şirketi Sil
          </Button> */}
        </div>
      </div>
      <OrphanedMembersModal open={orphanModalOpen} onOpenChange={setOrphanModalOpen} companyId={company.id} />

      {error && (
        <InlineAlert variant="destructive" description={error} />
      )}

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Üyeler ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="h-4 w-4" />
            Bekleyen Davetler ({invitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          {isLoadingMembers ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Henüz üye bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {members.map((member) => {
                // Check if user data is missing
                const hasValidUser = member.user && member.user.email;
                const displayName = hasValidUser 
                  ? (member.user?.full_name || member.user?.email)
                  : "Bilinmeyen Kullanıcı (Veri Hatası)";
                const avatarFallback = hasValidUser
                  ? (member.user?.full_name?.[0] || member.user?.email?.[0]?.toUpperCase() || "U")
                  : "?";

                return (
                  <Card key={member.id} className={!hasValidUser ? "border-red-200 bg-red-50" : ""}>
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.user?.image_url} />
                          <AvatarFallback className={!hasValidUser ? "bg-red-200 text-red-700" : ""}>
                            {avatarFallback}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold ${!hasValidUser ? "text-red-600" : ""}`}>
                              {displayName}
                            </p>
                            {member.is_owner && (
                              <Crown className="h-4 w-4 text-yellow-600" />
                            )}
                            {member.is_active && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {hasValidUser ? member.user?.email : "Kullanıcı verisi bulunamadı"}
                          </p>
                          {!hasValidUser && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ Bu kayıt veritabanında hatalı - silinmeli
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge variant="outline" className={getRoleBadgeColor(member.role?.name)}>
                            {getRoleDisplayName(member.role?.name)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Katılma: {formatDate(member.joined_at)}
                          </p>
                        </div>

                        {!member.is_owner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                Üyeyi Çıkar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          {isLoadingInvitations ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Bekleyen davet bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {invitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Mail className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Davet eden: {invitation.inviter?.full_name || invitation.inviter?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="outline" className={getRoleBadgeColor(invitation.role_name)}>
                          {getRoleDisplayName(invitation.role_name)}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Son geçerlilik: {formatDate(invitation.expires_at)}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleCancelInvitation(invitation.id)}
                          >
                            Daveti İptal Et
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        companyId={company.id}
        onSuccess={() => {
          // Reload invitations list to show the new invitation
          loadInvitations();
        }}
      />
    </div>
  );
}
