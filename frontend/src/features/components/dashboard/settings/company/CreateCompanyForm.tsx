'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, MapPin, Phone, Mail, Globe, FileText, Briefcase, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { FileUpload, type FileWithPreview } from '@/components/ui/file-upload'
import { toast } from 'sonner'
import { createCompanyAction } from '@/features/actions/company-action'
import { useCompanyStore } from '@/stores/company-store'
import { cn } from '@/lib/utils'

interface CreateCompanyFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export const CreateCompanyForm: React.FC<CreateCompanyFormProps> = ({ onSuccess, onCancel }) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState({
    unvani: '',
    adi: '',
    slug: '',
    logo: null as FileWithPreview | null,
    logo2: null as FileWithPreview | null,
    url: '',
    email: '',
    vd: '',
    vn: '',
    mersis: '',
    oda: '',
    odano: '',
    phone: '',
    phone2: '',
    fax: '',
    cellphone: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: 'Türkiye',
      postal_code: ''
    },
    coordinates: {
      lat: '',
      lng: ''
    },
    working_hours: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '18:00', closed: true },
      sunday: { open: '09:00', close: '18:00', closed: true }
    }
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    if (field === 'unvani' && !formData.slug) {
      const slug = value.toLowerCase()
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }

    if (field === 'unvani' && value) {
      setCompletedSteps(prev => new Set(prev).add('basic'))
    }
  }

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }))
    
    if (value) {
      setCompletedSteps(prev => new Set(prev).add('location'))
    }
  }

  const handleCoordinatesChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      coordinates: { ...prev.coordinates, [field]: value }
    }))
  }

  const handleLogoChange = (file: FileWithPreview | null, type: 'logo' | 'logo2') => {
    setFormData(prev => ({ ...prev, [type]: file }))
  }

  const uploadFile = async (file: File, companySlug: string, fileType: 'logo' | 'logo2'): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('companySlug', companySlug)
      formData.append('fileType', fileType)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('File upload error:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.unvani || !formData.slug) {
      toast.error('Ünvan ve slug alanları zorunludur')
      return
    }

    setLoading(true)
    try {
      // Upload logo files first
      let logoUrl: string | null = null
      let logo2Url: string | null = null

      if (formData.logo) {
        logoUrl = await uploadFile(formData.logo, formData.slug, 'logo')
        if (!logoUrl) {
          toast.error('Logo yüklenemedi')
        }
      }

      if (formData.logo2) {
        logo2Url = await uploadFile(formData.logo2, formData.slug, 'logo2')
        if (!logo2Url) {
          toast.error('Alternatif logo yüklenemedi')
        }
      }

      const result = await createCompanyAction({
        unvani: formData.unvani,
        adi: formData.adi || undefined,
        name: formData.adi || formData.unvani,
        slug: formData.slug,
        logo: logoUrl,
        logo2: logo2Url,
        url: formData.url || undefined,
        email: formData.email || undefined,
        vd: formData.vd || undefined,
        vn: formData.vn || undefined,
        mersis: formData.mersis || undefined,
        oda: formData.oda || undefined,
        odano: formData.odano || undefined,
        phone: formData.phone || undefined,
        phone2: formData.phone2 || undefined,
        fax: formData.fax || undefined,
        cellphone: formData.cellphone || undefined,
        address: Object.values(formData.address).some(v => v) ? formData.address : undefined,
        coordinates: formData.coordinates.lat && formData.coordinates.lng ? {
          lat: parseFloat(formData.coordinates.lat),
          lng: parseFloat(formData.coordinates.lng)
        } : undefined,
        workinghours: formData.working_hours,
      })

      if (result.status === 'error') {
        if (result.statusCode === 401) {
          toast.error('Oturum Bulunamadı', {
            description: 'Lütfen tekrar giriş yapın'
          })
          setTimeout(() => {
            router.push('/auth/login')
          }, 2000)
          return
        }
        throw new Error(result.message)
      }

      toast.success('Şirket oluşturuldu', {
        description: `${formData.unvani} başarıyla oluşturuldu`
      })

      // Update client-side company store and persist locally so we avoid
      // an extra server-side GET for the active company. This keeps the
      // UI responsive and prevents unnecessary backend calls.
      try {
        const cs = useCompanyStore.getState();
        const existing = Array.isArray(cs.companies) ? cs.companies : [];
        const newCompanies = [...existing, (result.data as any)];
        // Hydrate store with new companies and set the created company as active
        cs.hydrateCompanies(newCompanies as any, result.data as any);
        // Persist an explicit company-storage object so SessionProvider can
        // hydrate on next load without querying the server.
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const obj = { companies: newCompanies, activeCompany: result.data };
            window.localStorage.setItem('company-storage', JSON.stringify(obj));
          }
        } catch (e) {
          try { console.warn('[create-company] failed to persist companies locally', e); } catch {}
        }
      } catch (err) {
        console.warn('Failed to hydrate local company store after create:', err);
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast.error('Hata', {
        description: error instanceof Error ? error.message : 'Şirket oluşturulamadı'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex h-[calc(95vh-180px)] flex-col'>
      <ScrollArea className='h-[calc(95vh-300px)]'>
        <div className='space-y-4 px-5 py-4'>
          <section className='space-y-4'>
            <div className='flex items-center gap-3'>
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                completedSteps.has('basic') ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
              )}>
                {completedSteps.has('basic') ? <Check className='h-3 w-3' /> : <Building2 className='h-3 w-3' />}
              </div>
              <div>
                <h3 className='font-semibold text-lg'>Temel Bilgiler</h3>
                <p className='text-sm text-muted-foreground'>Şirketinizin temel bilgilerini girin</p>
              </div>
            </div>
            
            <div className='ml-4 space-y-4 border-l-2 border-muted pl-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='unvani' className='flex items-center gap-2'>
                    <Briefcase className='h-4 w-4' />
                    Ünvan *
                  </Label>
                  <Input
                    id='unvani'
                    placeholder='Örn: Acme Teknoloji A.Ş.'
                    value={formData.unvani}
                    onChange={(e) => handleInputChange('unvani', e.target.value)}
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='adi'>Kısa Ad</Label>
                  <Input
                    id='adi'
                    placeholder='Örn: Acme Tech'
                    value={formData.adi}
                    onChange={(e) => handleInputChange('adi', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='slug'>Slug (URL için) *</Label>
                  <Input
                    id='slug'
                    placeholder='acme-teknoloji'
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='url'>
                    <Globe className='inline h-4 w-4 mr-1' />
                    Web Sitesi
                  </Label>
                  <Input
                    id='url'
                    type='url'
                    placeholder='https://www.example.com'
                    value={formData.url}
                    onChange={(e) => handleInputChange('url', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='email'>
                    <Mail className='inline h-4 w-4 mr-1' />
                    E-posta
                  </Label>
                  <Input
                    id='email'
                    type='email'
                    placeholder='info@example.com'
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>

              <div className='grid gap-4 pt-2 sm:grid-cols-2'>
                <FileUpload
                  label='Ana Logo'
                  description='PNG, JPG veya SVG. Max: 5MB'
                  value={formData.logo || undefined}
                  onChange={(file) => handleLogoChange(file, 'logo')}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] }}
                  maxSize={5 * 1024 * 1024}
                />
                
                <FileUpload
                  label='Alternatif Logo'
                  description='Koyu tema için. Max: 5MB'
                  value={formData.logo2 || undefined}
                  onChange={(file) => handleLogoChange(file, 'logo2')}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] }}
                  maxSize={5 * 1024 * 1024}
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className='space-y-2'>
            <div className='flex items-center gap-3'>
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                completedSteps.has('legal') ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
              )}>
                {completedSteps.has('legal') ? <Check className='h-3 w-3' /> : <FileText className='h-3 w-3' />}
              </div>
              <div>
                <h3 className='font-semibold text-lg'>Yasal Bilgiler</h3>
                <p className='text-sm text-muted-foreground'>Vergi dairesi ve diğer yasal bilgiler</p>
              </div>
            </div>
            
            <div className='ml-4 space-y-4 border-l-2 border-muted pl-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='vd'>Vergi Dairesi</Label>
                  <Input
                    id='vd'
                    placeholder='Örn: Kadıköy'
                    value={formData.vd}
                    onChange={(e) => {
                      handleInputChange('vd', e.target.value)
                      if (e.target.value) setCompletedSteps(prev => new Set(prev).add('legal'))
                    }}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='vn'>Vergi Numarası</Label>
                  <Input
                    id='vn'
                    placeholder='1234567890'
                    value={formData.vn}
                    onChange={(e) => handleInputChange('vn', e.target.value)}
                  />
                </div>

                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='mersis'>MERSİS Numarası</Label>
                  <Input
                    id='mersis'
                    placeholder='0123456789012345'
                    value={formData.mersis}
                    onChange={(e) => handleInputChange('mersis', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='oda'>Oda</Label>
                  <Input
                    id='oda'
                    placeholder='Örn: İTO'
                    value={formData.oda}
                    onChange={(e) => handleInputChange('oda', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='odano'>Oda Numarası</Label>
                  <Input
                    id='odano'
                    placeholder='123456'
                    value={formData.odano}
                    onChange={(e) => handleInputChange('odano', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className='space-y-2'>
            <div className='flex items-center gap-3'>
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                completedSteps.has('contact') ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
              )}>
                {completedSteps.has('contact') ? <Check className='h-3 w-3' /> : <Phone className='h-3 w-3' />}
              </div>
              <div>
                <h3 className='font-semibold text-lg'>İletişim Bilgileri</h3>
                <p className='text-sm text-muted-foreground'>Telefon ve faks bilgileri</p>
              </div>
            </div>
            
            <div className='ml-4 space-y-4 border-l-2 border-muted pl-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='phone'>Telefon</Label>
                  <Input
                    id='phone'
                    type='tel'
                    placeholder='+90 (212) 123 45 67'
                    value={formData.phone}
                    onChange={(e) => {
                      handleInputChange('phone', e.target.value)
                      if (e.target.value) setCompletedSteps(prev => new Set(prev).add('contact'))
                    }}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='cellphone'>Cep Telefonu</Label>
                  <Input
                    id='cellphone'
                    type='tel'
                    placeholder='+90 (532) 123 45 67'
                    value={formData.cellphone}
                    onChange={(e) => handleInputChange('cellphone', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='phone2'>Telefon 2</Label>
                  <Input
                    id='phone2'
                    type='tel'
                    placeholder='+90 (212) 123 45 68'
                    value={formData.phone2}
                    onChange={(e) => handleInputChange('phone2', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='fax'>Faks</Label>
                  <Input
                    id='fax'
                    type='tel'
                    placeholder='+90 (212) 123 45 69'
                    value={formData.fax}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className='space-y-4'>
            <div className='flex items-center gap-3'>
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                completedSteps.has('location') ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
              )}>
                {completedSteps.has('location') ? <Check className='h-3 w-3' /> : <MapPin className='h-3 w-3' />}
              </div>
              <div>
                <h3 className='font-semibold text-lg'>Konum ve Adres</h3>
                <p className='text-sm text-muted-foreground'>Adres ve harita koordinatları</p>
              </div>
            </div>
            
            <div className='ml-4 space-y-4 border-l-2 border-muted pl-4'>
              <div className='space-y-2'>
                <Label htmlFor='street'>Adres</Label>
                <Textarea
                  id='street'
                  placeholder='Cadde, Sokak, Bina No, Daire'
                  value={formData.address.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  rows={3}
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='city'>İl</Label>
                  <Input
                    id='city'
                    placeholder='İstanbul'
                    value={formData.address.city}
                    onChange={(e) => handleAddressChange('city', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='state'>İlçe</Label>
                  <Input
                    id='state'
                    placeholder='Kadıköy'
                    value={formData.address.state}
                    onChange={(e) => handleAddressChange('state', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='postal_code'>Posta Kodu</Label>
                  <Input
                    id='postal_code'
                    placeholder='34000'
                    value={formData.address.postal_code}
                    onChange={(e) => handleAddressChange('postal_code', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='country'>Ülke</Label>
                  <Input
                    id='country'
                    placeholder='Türkiye'
                    value={formData.address.country}
                    onChange={(e) => handleAddressChange('country', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='lat'>Enlem (Latitude)</Label>
                  <Input
                    id='lat'
                    placeholder='41.0082'
                    value={formData.coordinates.lat}
                    onChange={(e) => handleCoordinatesChange('lat', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='lng'>Boylam (Longitude)</Label>
                  <Input
                    id='lng'
                    placeholder='28.9784'
                    value={formData.coordinates.lng}
                    onChange={(e) => handleCoordinatesChange('lng', e.target.value)}
                  />
                </div>
              </div>
              
              <p className='text-xs text-muted-foreground'>
                Google Maps&apos;ten koordinat almak için lokasyona sağ tıklayın
              </p>
            </div>
          </section>
        </div>
      </ScrollArea>

      <div className='border-t bg-background p-6'>
        <div className='flex justify-between gap-4'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <div className='flex gap-1'>
              {Array.from({ length: 4 }).map((_, i) => {
                const sections = ['basic', 'legal', 'contact', 'location']
                return (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 w-8 rounded-full transition-colors',
                      completedSteps.has(sections[i]) ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )
              })}
            </div>
            <span>{completedSteps.size} / 4 bölüm</span>
          </div>
          
          <div className='flex gap-3'>
            {onCancel && (
              <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
                İptal
              </Button>
            )}
            <Button type='submit' disabled={loading} size='lg'>
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Building2 className='mr-2 h-4 w-4' />
                  Şirketi Oluştur
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
