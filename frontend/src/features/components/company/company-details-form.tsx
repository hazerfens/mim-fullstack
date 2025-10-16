"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Upload, Edit } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import InlineAlert from '@/components/ui/inline-alert';

interface Company {
  id: string;
  name?: string | null;
  unvani?: string | null;
  adi?: string | null;
  slug?: string | null;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  url?: string | null;
  vd?: string | null;
  vn?: string | null;
  mersis?: string | null;
  oda?: string | null;
  odano?: string | null;
}

interface Props {
  company: Company | null;
  isOwner?: boolean;
}

export const CompanyDetailsForm: React.FC<Props> = ({ company, isOwner = false }) => {
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editing states for each section
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingCommercial, setEditingCommercial] = useState(false);
  const [editingLogo, setEditingLogo] = useState(false);

  // Form state for each section
  const { register: regGeneral, handleSubmit: submitGeneral, reset: resetGeneral } = useForm({
    defaultValues: {
      name: company?.name || company?.unvani || company?.adi || '',
      url: company?.url || '',
    },
  });
  const { register: regContact, handleSubmit: submitContact, reset: resetContact } = useForm({
    defaultValues: {
      email: company?.email || '',
      phone: company?.phone || '',
      phoneAlt: company?.phone || '',
    },
  });
  const { register: regCommercial, handleSubmit: submitCommercial, reset: resetCommercial } = useForm({
    defaultValues: {
      taxOffice: company?.vd || '',
      taxNumber: company?.vn || '',
      mersis: company?.mersis || '',
      chamber: company?.oda || '',
      chamberNumber: company?.odano || '',
    },
  });

  // Reset reactive forms when company changes
  React.useEffect(() => {
    resetGeneral({
      name: company?.name || company?.unvani || company?.adi || '',
      url: company?.url || '',
    });
    resetContact({
      email: company?.email || '',
      phone: company?.phone || '',
      phoneAlt: company?.phone || '',
    });
    resetCommercial({
      taxOffice: company?.vd || '',
      taxNumber: company?.vn || '',
      mersis: company?.mersis || '',
      chamber: company?.oda || '',
      chamberNumber: company?.odano || '',
    });
  }, [company, resetContact, resetGeneral, resetCommercial]);

  const router = useRouter();

  const updateCompany = async (updates: Record<string, string>) => {
    if (!company) return { success: false };
    setIsPending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, updates }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message || 'Güncelleme başarısız');
        return { success: false };
      }
  setSuccess('Güncellendi');
  toast.success('Güncellendi');
  // Refresh server-rendered data without a full reload
  setTimeout(() => router.refresh(), 700);
      return { success: true };
    } catch (e) {
  setError(String(e));
  toast.error(String(e));
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companySlug', company?.slug || company?.id || 'default');
      fd.append('fileType', 'logo');

      const up = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const body = await up.json();
      if (!up.ok) throw new Error(body.error || 'Upload failed');

      await updateCompany({ logo: body.url });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsPending(false);
    }
  };

  const DeleteCompanyInline: React.FC<{ companyId: string; companyName: string }> = ({ companyId, companyName }) => {
    const [confirm, setConfirm] = useState('');
    const matches = confirm.trim() === companyName.trim();

    return (
      <div className="space-y-3">
        <InlineAlert description={"Bu işlem geri alınamaz. Lütfen şirket adını doğru girerek onaylayın."} />
        <div className="mt-2">
          <div className="text-xs">Şirket adını girin: <span className="font-medium">{companyName}</span></div>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={companyName}
            className="w-full rounded-md border px-3 py-2 mt-2"
            aria-label="Şirket adını yazın"
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="destructive"
            disabled={!matches}
            onClick={async () => {
              if (!matches) return;
              try {
                const res = await fetch('/api/company/permanent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ companyId }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || data.status !== 'success') {
                  toast.error(data.message || 'Şirket kalıcı olarak silinemedi');
                  return;
                }
                toast.success('Şirket kalıcı olarak silindi');
                router.replace('/');
              } catch (err) {
                console.error(err);
                toast.error('Silme sırasında hata oluştu');
              }
            }}
          >
            Şirketi Kalıcı Olarak Sil
          </Button>
        </div>
      </div>
    );
  };

  // Overlay component for logo area
  const LogoDropOverlay: React.FC<{ companyId: string; onFile: (file: File) => Promise<void> }> = ({ companyId, onFile }) => {
    const { theme } = useTheme();
    const [isDragging, setIsDragging] = useState(false);

    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer?.files?.[0];
          if (!f) return;
          setIsPending(true);
          await onFile(f);
        }}
        onClick={() => {
          const inp = document.getElementById(`company-logo-input-${companyId}`) as HTMLInputElement | null;
          inp?.click();
        }}
        className={`absolute inset-0 flex items-center justify-center rounded-md cursor-pointer transition-all ${isDragging ? (theme === 'dark' ? 'bg-white/10' : 'bg-black/5') : 'bg-transparent'}`}
      >
        <div className="text-xs text-gray-500">Dosyayı buraya bırakın</div>
      </div>
    );
  };

  return (
    <div>
      {!company ? (
        <div className="text-sm text-muted-foreground">Seçili şirket yok</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: Company summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">Genel Bilgiler
                <button type="button" onClick={() => setEditingGeneral(v => !v)} className="text-sm ">{editingGeneral ? 'İptal' : <Edit className="h-4 w-4" />}</button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(success || error) && (
                  <div className="mb-3">
                    {success && <div className="text-sm text-green-600">{success}</div>}
                    {error && <div className="text-sm text-red-600">{error}</div>}
                  </div>
                )}
                {!editingGeneral ? (
                  <>
                    <div>
                      <Label>Firma Adı</Label>
                      <div className="mt-1 text-lg font-semibold">{company.name || company.unvani || company.adi}</div>
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <div className="mt-1">{company.slug}</div>
                    </div>
                    <div>
                      <Label>Web URL</Label>
                      <div className="mt-1">{company.url || '—'}</div>
                    </div>
                  </>
                ) : (
                  <form onSubmit={submitGeneral(async (values) => {
                    await updateCompany({ unvani: values.name, adi: values.name, url: values.url });
                  })} className="space-y-3">
                    <div>
                      <Label>Firma Adı</Label>
                      <Input {...regGeneral('name')} />
                    </div>
                    <div>
                      <Label>Web URL</Label>
                      <Input {...regGeneral('url')} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kaydet'}</Button>
                      <Button variant="ghost" onClick={() => setEditingGeneral(false)}>İptal</Button>
                    </div>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delete company card (owner only) */}
          {isOwner && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Şirketi Kalıcı Sil</CardTitle>
              </CardHeader>
              <CardContent>
                <DeleteCompanyInline companyId={company.id} companyName={(company.adi || company.unvani || company.name || company.slug || '').toString()} />
              </CardContent>
            </Card>
          )}

          {/* Middle: Edit form */}
          <div className="md:col-span-2 grid grid-cols-1 gap-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>İletişim Bilgileri</CardTitle>
                <button type="button" onClick={() => setEditingContact(v => !v)} className="text-sm ">{editingContact ? 'İptal' : <Edit className="h-4 w-4" />}</button>
              </CardHeader>
              <CardContent>
                {!editingContact ? (
                  <div className="space-y-2">
                    <div>
                      <Label>Email</Label>
                      <div className="mt-1">{company.email || '—'}</div>
                    </div>
                    <div>
                      <Label>Telefon</Label>
                      <div className="mt-1">{company.phone || '—'}</div>
                    </div>
                    <div>
                      <Label>İkincil Telefon</Label>
                      <div className="mt-1">{company.phone || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitContact(async (values) => {
                    await updateCompany({ email: values.email, phone: values.phone });
                  })} className="space-y-3">
                    <div>
                      <Label>Email</Label>
                      <Input {...regContact('email')} />
                    </div>
                    <div>
                      <Label>Telefon</Label>
                      <Input {...regContact('phone')} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kaydet'}</Button>
                      <Button variant="ghost" onClick={() => setEditingContact(false)}>İptal</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Ticari Bilgiler</CardTitle>
                <button type="button" onClick={() => setEditingCommercial(v => !v)} className="text-sm ">{editingCommercial ? 'İptal' : <Edit className="h-4 w-4" />}</button>
              </CardHeader>
              <CardContent>
                {!editingCommercial ? (
                  <div className="space-y-2">
                    <div>
                      <Label>Vergi Dairesi</Label>
                      <div className="mt-1">{company.vd || '—'}</div>
                    </div>
                    <div>
                      <Label>Vergi No</Label>
                      <div className="mt-1">{company.vn || '—'}</div>
                    </div>
                    <div>
                      <Label>Mersis</Label>
                      <div className="mt-1">{company.mersis || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitCommercial(async (values) => {
                    await updateCompany({ vd: values.taxOffice, vn: values.taxNumber, mersis: values.mersis });
                  })} className="space-y-3">
                    <div>
                      <Label>Vergi Dairesi</Label>
                      <Input {...regCommercial('taxOffice')} />
                    </div>
                    <div>
                      <Label>Vergi No</Label>
                      <Input {...regCommercial('taxNumber')} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kaydet'}</Button>
                      <Button variant="ghost" onClick={() => setEditingCommercial(false)}>İptal</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Logo card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">Logo & Görseller
                <button type="button" onClick={() => setEditingLogo(v => !v)} className="text-sm ">{editingLogo ? 'İptal' : <Edit className="h-4 w-4" />}</button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="w-36 h-36 rounded-md overflow-hidden bg-gray-50 border relative">
                  {company.logo ? (
                    <Image src={company.logo} alt="Company Logo" width={144} height={144} className="object-contain" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">Yok</div>
                  )}
                  {/* Overlay component (only when no logo present) */}
                  {editingLogo && !company.logo && (
                    <LogoDropOverlay companyId={company.id} onFile={handleFileUpload} />
                  )}
                </div>

                <div className="flex gap-2 w-full">
                  {editingLogo && (
                    <>
                      <input
                        id={`company-logo-input-${company.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsPending(true);
                          setError(null);
                          await handleFileUpload(file);
                        }}
                      />
                      <Button className="flex-1" variant="outline" disabled={isPending} onClick={() => {
                        const inp = document.getElementById(`company-logo-input-${company.id}`) as HTMLInputElement | null;
                        inp?.click();
                      }}>
                        <Upload className="mr-2 h-4 w-4" /> Yükle
                      </Button>
                    </>
                  )}

                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!company) return;
                      setIsPending(true);
                      setError(null);
                      try {
                        await updateCompany({ logo: '' });
                      } catch (err) {
                        setError(String(err));
                      } finally {
                        setIsPending(false);
                      }
                    }}
                    className="w-24"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Sil
                  </Button>
                </div>
                {/* Drag & drop handled by overlay */}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailsForm;
