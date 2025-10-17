"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Upload, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { PhoneInput } from '@/components/ui/phone-input';
import { updateCompanyAction } from '@/features/actions/company-action';
import { useCompanyStore } from '@/stores/company-store';

interface Company {
  id: string;
  name?: string | null;
  unvani?: string | null;
  adi?: string | null;
  slug?: string | null;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  url?: string | null;
  vd?: string | null;
  vn?: string | null;
  mersis?: string | null;
  oda?: string | null;
  odano?: string | null;
  is_active?: boolean | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  } | null;
  coordinates?: {
    lat?: number | null;
    lng?: number | null;
  } | null;
  [key: string]: unknown;
}

interface SovosVerificationResult {
  is_efattura: boolean;
  sovos_verified: boolean;
  sovos_unvan: string;
  message: string;
  status?: string;
  efattura_status?: string;
  error?: string;
}

interface Props {
  company: Company | null;
}

// Reusable section card
const SettingCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card className="border-border/50 hover:border-border transition-colors">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

export const CompanyDetailsForm: React.FC<Props> = ({ company }) => {
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [editingLogo, setEditingLogo] = useState(false);
  
  const [isVerifyingTax, setIsVerifyingTax] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Partial<SovosVerificationResult> | null>(null);
  
  const { updateActiveCompany } = useCompanyStore();

  // Form hooks
  const { register: regGeneral, handleSubmit: submitGeneral, reset: resetGeneral, formState: stateGeneral } = useForm({
    defaultValues: {
      adi: company?.adi || company?.name || '',
      unvani: company?.unvani || '',
      url: company?.url || '',
    },
  });

  const { register: regContact, handleSubmit: submitContact, reset: resetContact, formState: stateContact } = useForm({
    defaultValues: {
      email: company?.email || '',
      phone: company?.phone || '',
      cellphone: company?.cellphone || '',
      addressStreet: company?.address?.street || '',
      addressCity: company?.address?.city || '',
      addressState: company?.address?.state || '',
      addressCountry: company?.address?.country || '',
      addressPostalCode: company?.address?.postal_code || '',
      coordinatesLat: company?.coordinates?.lat || '',
      coordinatesLng: company?.coordinates?.lng || '',
    },
  });

  const { register: regCommercial, handleSubmit: submitCommercial, reset: resetCommercial, formState: stateCommercial } = useForm({
    defaultValues: {
      taxOffice: company?.vd || '',
      taxNumber: company?.vn || '',
      mersis: company?.mersis || '',
      chamber: company?.oda || '',
      chamberNumber: company?.odano || '',
    },
  });

  const companyDisplayName = company?.adi || company?.unvani || company?.name || company?.slug || 'Şirket';

  React.useEffect(() => {
    if (!company) return;
    resetGeneral({ 
      adi: company.adi || company.name || '',
      unvani: company.unvani || '',
      url: company.url || '' 
    });
    resetContact({ 
      email: company.email || '', 
      phone: company.phone || '',
      cellphone: company.cellphone || '',
      addressStreet: company.address?.street || '',
      addressCity: company.address?.city || '',
      addressState: company.address?.state || '',
      addressCountry: company.address?.country || '',
      addressPostalCode: company.address?.postal_code || '',
      coordinatesLat: company.coordinates?.lat?.toString() || '',
      coordinatesLng: company.coordinates?.lng?.toString() || '',
    });
    resetCommercial({
      taxOffice: company.vd || '',
      taxNumber: company.vn || '',
      mersis: company.mersis || '',
      chamber: company.oda || '',
      chamberNumber: company.odano || '',
    });
  }, [company, resetGeneral, resetContact, resetCommercial, companyDisplayName]);

  
  const { theme } = useTheme();

  const hasUnsavedChanges = stateGeneral.isDirty || stateContact.isDirty || stateCommercial.isDirty;

  const updateCompany = async (updates: Record<string, unknown>) => {
    if (!company) return { success: false };
    console.log('[company-details-form] Updating company with:', JSON.stringify(updates, null, 2));
    setIsPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateCompanyAction(company.id, updates);
      if (result.status === 'error') {
        const errorMsg = result.message || 'Güncelleme başarısız';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false };
      }
      // Update the store with new company data for immediate UI update
      // Map backend field names to frontend Company interface
      const storeUpdates: Record<string, unknown> = { ...updates };
      if (updates.adi) storeUpdates.name = updates.adi;  // Map adi to name for display
      console.log('[company-details-form] Calling updateActiveCompany with:', JSON.stringify(storeUpdates, null, 2));
      updateActiveCompany(storeUpdates);
      setSuccess('Güncellendi');
      toast.success('Güncellendi');
      return { success: true };
    } catch (e) {
      const errorMsg = String(e);
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsPending(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companySlug', company?.slug || company?.id || 'default');
      fd.append('fileType', 'logo');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Upload failed');

      await updateCompany({ logo: body.url });
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyTax = async (vknTc: string) => {
    if (!vknTc || vknTc.trim() === '') {
      toast.error('TC/VKN girmek zorunlu');
      return;
    }

    setIsVerifyingTax(true);
    setVerifyResult(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1';
      const res = await fetch(`${backendUrl}/company/verify-tax`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vkn_tc: vknTc.trim(),
          identifier: company?.id || vknTc,
          role: 'PK', // Müdür Ünvanı / Muhasebe Müdürü
        }),
      });

      const data = await res.json();
      setVerifyResult(data);

      if (data.sovos_verified) {
        toast.success(`${data.is_efattura ? 'E-Fatura' : 'E-Arşiv'} doğrulandı: ${data.sovos_unvan}`);
      } else {
        toast.error(data.message || 'Doğrulama başarısız');
      }
    } catch (err) {
      const errorMsg = String(err);
      toast.error(errorMsg);
      setVerifyResult({ error: errorMsg });
    } finally {
      setIsVerifyingTax(false);
    }
  };

  // const handleDeleteCompany = async () => {
  //   if (!company) return;
  //   try {
  //     setIsPending(true);
  //     const formData = new FormData();
  //     formData.append('companyId', company.id);
  //     await deleteCompanyPermanentAction(formData);
  //     toast.success('Şirket kalıcı olarak silindi');
  //   } catch (err) {
  //     const errorMsg = err instanceof Error ? err.message : String(err);
  //     setError(errorMsg);
  //     toast.error(errorMsg);
  //   } finally {
  //     setIsPending(false);
  //   }
  // };

  const LogoUploadArea = ({ logo }: { logo?: string | null }) => (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingLogo(true);
        }}
        onDragLeave={() => setIsDraggingLogo(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDraggingLogo(false);
          const file = e.dataTransfer?.files?.[0];
          if (file && editingLogo) await handleFileUpload(file);
        }}
        onClick={() => {
          if (editingLogo) {
            const input = document.getElementById(`company-logo-input-${company?.id}`) as HTMLInputElement;
            input?.click();
          }
        }}
        className={`relative rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
          isDraggingLogo
            ? theme === 'dark'
              ? 'border-primary bg-primary/10'
              : 'border-primary bg-primary/5'
            : 'border-border/50 hover:border-border bg-muted/30'
        } ${logo ? 'h-48' : 'aspect-square'}`}
      >
        {logo ? (
          <div className="relative w-full h-full">
            <Image
              src={logo}
              alt="Company Logo"
              fill
              className="object-contain p-4"
            />
            {editingLogo && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <div className="text-white text-sm font-medium text-center">
                  <Upload className="h-5 w-5 mx-auto mb-2" />
                  Değiştirmek için tıklayın
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center py-8">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <div className="font-semibold">Logonuzu yükleyin</div>
              <div className="text-xs mt-1">Dosyayı sürükleyin veya tıklayarak seçin</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // const DeleteConfirmation = () => {
  //   const [confirm, setConfirm] = useState('');
  //   const matches = confirm.trim() === companyDisplayName.trim();

  //   return (
  //     <div className="space-y-4">
  //       <Alert variant="destructive">
  //         <Trash2 className="h-4 w-4" />
  //         <AlertDescription>
  //           Bu işlem geri alınamaz. Şirket adını doğru girerek onaylayın.
  //         </AlertDescription>
  //       </Alert>
  //       <div className="space-y-2">
  //         <FieldLabel>
  //           Şirket adını girin: <span className="font-semibold text-foreground">{companyDisplayName}</span>
  //         </FieldLabel>
  //         <Input
  //           value={confirm}
  //           onChange={(e) => setConfirm(e.target.value)}
  //           placeholder={companyDisplayName}
  //           className="font-mono text-sm"
  //         />
  //       </div>
  //       <Button
  //         variant="destructive"
  //         disabled={!matches || isPending}
  //         onClick={handleDeleteCompany}
  //         className="w-full"
  //       >
  //         {isPending && <Spinner className="mr-2 h-4 w-4" />}
  //         Şirketi Kalıcı Olarak Sil
  //       </Button>
  //     </div>
  //   );
  // };

  if (!company) {
    return (
      <Alert>
        <AlertDescription>Seçili şirket yok</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Unsaved Changes Alert */}
      {hasUnsavedChanges && (
        <Alert>
          <AlertDescription className="text-amber-700 dark:text-amber-200">
            ⚠️ Kaydedilmemiş değişiklikler var. Lütfen değişiklikleri kaydedin veya iptal edin.
          </AlertDescription>
        </Alert>
      )}

      {/* Status messages */}
      {(success || error) && (
        <Alert variant={error ? 'destructive' : 'default'}>
          <AlertDescription>{error || success}</AlertDescription>
        </Alert>
      )}

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="contact">İletişim</TabsTrigger>
          <TabsTrigger value="commercial">Ticari</TabsTrigger>
          <TabsTrigger value="media">Medya</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <SettingCard title="Genel Bilgiler">
            <form
              onSubmit={submitGeneral(async (values) => {
                const result = await updateCompany({
                  unvani: values.unvani,
                  adi: values.adi,
                  url: values.url,
                });
                if (result.success) {
                  resetGeneral(values);
                }
              })}
              className="space-y-6"
            >
              <FieldGroup>
                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Firma Adı *</FieldLabel>
                    <Input 
                      {...regGeneral('adi')} 
                      placeholder="Firma adını girin"
                      disabled={isPending}
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Tam Ticari Ünvan</FieldLabel>
                    <Input 
                      {...regGeneral('unvani')} 
                      placeholder="Şirketin tam ticari ünvanı"
                      disabled={isPending}
                    />
                    <FieldDescription>Resmi ticari sicil kayıtlarında geçen ünvan</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Web URL</FieldLabel>
                    <Input 
                      {...regGeneral('url')} 
                      placeholder="https://example.com"
                      disabled={isPending}
                    />
                    <FieldDescription>Şirket web sitesi adresi</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {stateGeneral.isDirty && (
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={isPending} 
                    className="flex-1"
                  >
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Kaydediliyor...
                      </>
                    ) : (
                      'Kaydet'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetGeneral()}
                    disabled={isPending}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                </div>
              )}
            </form>
          </SettingCard>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4">
          <SettingCard title="İletişim Bilgileri">
            <form
              onSubmit={submitContact(async (values) => {
                const result = await updateCompany({
                  email: values.email,
                  phone: values.phone,
                  cellphone: values.cellphone,
                  address: {
                    street: values.addressStreet || null,
                    state: values.addressState || null,
                    city: values.addressCity || null,
                    country: values.addressCountry || null,
                    postal_code: values.addressPostalCode || null,
                  },
                  coordinates: {
                    lat: values.coordinatesLat ? parseFloat(String(values.coordinatesLat)) : null,
                    lng: values.coordinatesLng ? parseFloat(String(values.coordinatesLng)) : null,
                  },
                });
                if (result.success) {
                  resetContact(values);
                }
              })}
              className="space-y-6"
            >
              <FieldGroup>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Contact Inputs */}
                  <div className="space-y-4">
                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Email</FieldLabel>
                        <Input 
                          type="email" 
                          {...regContact('email')} 
                          placeholder="ornek@mail.com"
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Telefon</FieldLabel>
                        <PhoneInput 
                          {...regContact('phone')} 
                          placeholder="+90 312 123 45 67"
                          disabled={isPending}
                        />
                        <FieldDescription>Sabit hat numarası</FieldDescription>
                      </FieldContent>
                    </Field>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Cep Telefonu</FieldLabel>
                        <PhoneInput 
                          {...regContact('cellphone')} 
                          placeholder="+90 532 123 45 67"
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>
                  </div>
                  
                  {/* Right Column - Address Inputs */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-4">Adres Bilgileri</h4>
                    </div>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Adres</FieldLabel>
                        <Input 
                          {...regContact('addressStreet')} 
                          placeholder="Sokak, bina no vb."
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>İlçe/Bölge</FieldLabel>
                        <Input 
                          {...regContact('addressState')} 
                          placeholder="İlçe adı"
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Şehir</FieldLabel>
                        <Input 
                          {...regContact('addressCity')} 
                          placeholder="Şehir adı"
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Ülke</FieldLabel>
                        <Input 
                          {...regContact('addressCountry')} 
                          placeholder="Ülke adı"
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>

                    <Field orientation="vertical">
                      <FieldContent>
                        <FieldLabel>Posta Kodu</FieldLabel>
                        <Input 
                          {...regContact('addressPostalCode')} 
                          placeholder="Posta kodu"
                          disabled={isPending}
                        />
                      </FieldContent>
                    </Field>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Field orientation="vertical">
                        <FieldContent>
                          <FieldLabel>Enlem (Lat)</FieldLabel>
                          <Input 
                            type="number" 
                            step="any" 
                            {...regContact('coordinatesLat')} 
                            placeholder="35.366655"
                            disabled={isPending}
                          />
                        </FieldContent>
                      </Field>
                      <Field orientation="vertical">
                        <FieldContent>
                          <FieldLabel>Boylam (Lng)</FieldLabel>
                          <Input 
                            type="number" 
                            step="any" 
                            {...regContact('coordinatesLng')} 
                            placeholder="42.222154"
                            disabled={isPending}
                          />
                        </FieldContent>
                      </Field>
                    </div>
                  </div>
                </div>
              </FieldGroup>
              
              {stateContact.isDirty && (
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={isPending} 
                    className="flex-1"
                  >
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Kaydediliyor...
                      </>
                    ) : (
                      'Kaydet'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetContact()}
                    disabled={isPending}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                </div>
              )}
            </form>
          </SettingCard>
        </TabsContent>

        {/* Commercial Tab */}
        <TabsContent value="commercial" className="space-y-4">
          <SettingCard title="Ticari Bilgiler">
            <form
              onSubmit={submitCommercial(async (values) => {
                const result = await updateCompany({
                  vd: values.taxOffice,
                  vn: values.taxNumber,
                  mersis: values.mersis,
                  oda: values.chamber,
                  odano: values.chamberNumber,
                });
                if (result.success) {
                  resetCommercial(values);
                }
              })}
              className="space-y-6"
            >
              <FieldGroup>
                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Vergi Dairesi</FieldLabel>
                    <Input 
                      {...regCommercial('taxOffice')} 
                      placeholder="Vergi dairesi adı"
                      disabled={isPending}
                    />
                  </FieldContent>
                </Field>

                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Vergi No</FieldLabel>
                    <div className="flex gap-2">
                      <Input 
                        {...regCommercial('taxNumber')} 
                        placeholder="Vergi numarası"
                        disabled={isPending || isVerifyingTax}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const taxNumber = (document.querySelector('input[placeholder="Vergi numarası"]') as HTMLInputElement)?.value;
                          handleVerifyTax(taxNumber);
                        }}
                        disabled={isPending || isVerifyingTax}
                        className="flex-shrink-0"
                      >
                        {isVerifyingTax ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Doğrulanıyor...
                          </>
                        ) : (
                          'Doğrula'
                        )}
                      </Button>
                    </div>
                  </FieldContent>
                </Field>

                {verifyResult && (
                  <Alert className={verifyResult.sovos_verified ? 'border-green-500' : 'border-red-500'}>
                    <AlertDescription>
                      {verifyResult.sovos_verified ? (
                        <div className="space-y-2">
                          <div className="font-semibold text-green-700">✓ Doğrulama Başarılı</div>
                          <div className="text-sm">
                            <div><strong>Durumu:</strong> {verifyResult.is_efattura ? 'E-Fatura' : 'E-Arşiv'}</div>
                            <div><strong>Firma Adı:</strong> {verifyResult.sovos_unvan}</div>
                            <div><strong>E-Fatura Durumu:</strong> {verifyResult.efattura_status}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="font-semibold text-red-700">✗ Doğrulama Başarısız</div>
                          <div className="text-sm">{verifyResult.message || verifyResult.error}</div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Mersis</FieldLabel>
                    <Input 
                      {...regCommercial('mersis')} 
                      placeholder="Mersis numarası"
                      disabled={isPending}
                    />
                  </FieldContent>
                </Field>

                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Oda (Oda Adı)</FieldLabel>
                    <Input 
                      {...regCommercial('chamber')} 
                      placeholder="Ticaret odası adı (Ankara Ticaret Odası vb.)"
                      disabled={isPending}
                    />
                    <FieldDescription>Kayıtlı olduğunuz ticaret odası</FieldDescription>
                  </FieldContent>
                </Field>

                <Field orientation="vertical">
                  <FieldContent>
                    <FieldLabel>Oda No</FieldLabel>
                    <Input 
                      {...regCommercial('chamberNumber')} 
                      placeholder="Oda üye numarası"
                      disabled={isPending}
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>

              {stateCommercial.isDirty && (
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={isPending} 
                    className="flex-1"
                  >
                    {isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Kaydediliyor...
                      </>
                    ) : (
                      'Kaydet'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetCommercial()}
                    disabled={isPending}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                </div>
              )}
            </form>
          </SettingCard>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media" className="space-y-4">
          <SettingCard title="Logo & Görseller">
            <div className="space-y-4">
              {company.logo ? (
                <div className="relative h-40 rounded-lg overflow-hidden bg-muted border">
                  <Image
                    src={company.logo}
                    alt="Company Logo"
                    fill
                    className="object-contain p-4"
                  />
                </div>
              ) : (
                <div className="h-40 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/30">
                  <p className="text-sm text-muted-foreground">Logo yüklenmemiş</p>
                </div>
              )}

              {editingLogo ? (
                <div className="space-y-4">
                  <LogoUploadArea logo={company.logo} />

                  <input
                    id={`company-logo-input-${company.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleFileUpload(file);
                    }}
                  />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={isPending}
                      onClick={() => {
                        const input = document.getElementById(
                          `company-logo-input-${company.id}`
                        ) as HTMLInputElement;
                        input?.click();
                      }}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {company.logo ? 'Logo Değiştir' : 'Logo Yükle'}
                    </Button>

                    {company.logo && (
                      <Button
                        variant="destructive"
                        disabled={isPending}
                        onClick={async () => {
                          setIsPending(true);
                          await updateCompany({ logo: '' });
                          setIsPending(false);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setEditingLogo(false)}
                    disabled={isPending}
                  >
                    İptal
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setEditingLogo(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Logo {company.logo ? 'Değiştir' : 'Yükle'}
                </Button>
              )}
            </div>
          </SettingCard>
        </TabsContent>
      </Tabs>    
    </div>
  );
};

export default CompanyDetailsForm;
