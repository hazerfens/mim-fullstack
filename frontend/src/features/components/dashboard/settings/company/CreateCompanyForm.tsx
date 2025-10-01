'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Building2, Upload, X, Loader2, MapPin, Phone, Mail, Globe, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { createCompanyAction } from '@/features/actions/company-action'

interface CreateCompanyFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export const CreateCompanyForm: React.FC<CreateCompanyFormProps> = ({ onSuccess, onCancel }) => {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logo2Preview, setLogo2Preview] = useState<string | null>(null)

  // Basic Info
  const [formData, setFormData] = useState({
    unvani: '',
    adi: '',
    slug: '',
    logo: '',
    logo2: '',
    url: '',
    email: '',
    
    // Tax & Legal
    vd: '', // Tax Office
    vn: '', // Tax Number
    mersis: '',
    oda: '', // Chamber
    odano: '', // Chamber Number
    
    // Contact
    phone: '',
    phone2: '',
    fax: '',
    cellphone: '',
    
    // Address
    address: {
      street: '',
      city: '',
      state: '',
      country: 'Türkiye',
      postal_code: ''
    },
    
    // Coordinates
    coordinates: {
      lat: '',
      lng: ''
    },
    
    // Working Hours
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
    
    // Auto-generate slug from title
    if (field === 'unvani' && !formData.slug) {
      const slug = value.toLowerCase()
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }))
  }

  const handleCoordinatesChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      coordinates: { ...prev.coordinates, [field]: value }
    }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'logo2') => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo dosyası 5MB\'dan küçük olmalıdır')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        if (type === 'logo') {
          setLogoPreview(base64)
          setFormData(prev => ({ ...prev, logo: base64 }))
        } else {
          setLogo2Preview(base64)
          setFormData(prev => ({ ...prev, logo2: base64 }))
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const removeLogo = (type: 'logo' | 'logo2') => {
    if (type === 'logo') {
      setLogoPreview(null)
      setFormData(prev => ({ ...prev, logo: '' }))
    } else {
      setLogo2Preview(null)
      setFormData(prev => ({ ...prev, logo2: '' }))
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
      console.log('� Creating company with server action...')

      const result = await createCompanyAction({
        title: formData.unvani,
        name: formData.adi || formData.unvani,
        slug: formData.slug,
        logo: formData.logo || null,
        logo2: formData.logo2 || null,
        url: formData.url || null,
        email: formData.email || null,
        vd: formData.vd || null,
        vn: formData.vn || null,
        mersis: formData.mersis || null,
        oda: formData.oda || null,
        odano: formData.odano || null,
        phone: formData.phone || null,
        phone2: formData.phone2 || null,
        fax: formData.fax || null,
        cellphone: formData.cellphone || null,
        address: Object.values(formData.address).some(v => v) ? formData.address : null,
        coordinates: formData.coordinates.lat && formData.coordinates.lng ? formData.coordinates : null,
        workinghours: formData.working_hours,
      })

      console.log('📥 Server action result:', result)

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

      console.log('✅ Company created:', result.data)

      toast.success('Şirket oluşturuldu', {
        description: `${formData.unvani} başarıyla oluşturuldu`
      })

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
          <TabsTrigger value="legal">Yasal Bilgiler</TabsTrigger>
          <TabsTrigger value="contact">İletişim</TabsTrigger>
          <TabsTrigger value="location">Konum</TabsTrigger>
        </TabsList>

        {/* Basic Info */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Temel Şirket Bilgileri
              </CardTitle>
              <CardDescription>
                Şirketinizin temel bilgilerini girin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="unvani">Ünvan *</Label>
                  <Input
                    id="unvani"
                    placeholder="Örn: Acme Teknoloji A.Ş."
                    value={formData.unvani}
                    onChange={(e) => handleInputChange('unvani', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adi">Kısa Ad</Label>
                  <Input
                    id="adi"
                    placeholder="Örn: Acme Tech"
                    value={formData.adi}
                    onChange={(e) => handleInputChange('adi', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL için) *</Label>
                  <Input
                    id="slug"
                    placeholder="acme-teknoloji"
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    URL: yoursite.com/{formData.slug || 'slug'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">
                    <Globe className="inline h-4 w-4 mr-1" />
                    Web Sitesi
                  </Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://www.example.com"
                    value={formData.url}
                    onChange={(e) => handleInputChange('url', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="inline h-4 w-4 mr-1" />
                    E-posta
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="info@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label>Logo (Ana)</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative w-24 h-24 border rounded-lg overflow-hidden">
                        <Image 
                          src={logoPreview} 
                          alt="Logo preview" 
                          width={96}
                          height={96}
                          className="w-full h-full object-contain" 
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeLogo('logo')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e, 'logo')}
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG veya SVG. Max 5MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Logo (Alternatif)</Label>
                  <div className="flex items-center gap-4">
                    {logo2Preview ? (
                      <div className="relative w-24 h-24 border rounded-lg overflow-hidden">
                        <Image 
                          src={logo2Preview} 
                          alt="Logo 2 preview" 
                          width={96}
                          height={96}
                          className="w-full h-full object-contain" 
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeLogo('logo2')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e, 'logo2')}
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Koyu tema için beyaz logo
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Info */}
        <TabsContent value="legal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Yasal ve Mali Bilgiler
              </CardTitle>
              <CardDescription>
                Vergi dairesi, vergi numarası ve diğer yasal bilgiler
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vd">Vergi Dairesi</Label>
                  <Input
                    id="vd"
                    placeholder="Örn: Kadıköy"
                    value={formData.vd}
                    onChange={(e) => handleInputChange('vd', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vn">Vergi Numarası</Label>
                  <Input
                    id="vn"
                    placeholder="1234567890"
                    value={formData.vn}
                    onChange={(e) => handleInputChange('vn', e.target.value)}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="mersis">MERSİS Numarası</Label>
                  <Input
                    id="mersis"
                    placeholder="0123456789012345"
                    value={formData.mersis}
                    onChange={(e) => handleInputChange('mersis', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oda">Oda</Label>
                  <Input
                    id="oda"
                    placeholder="Örn: İstanbul Ticaret Odası"
                    value={formData.oda}
                    onChange={(e) => handleInputChange('oda', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="odano">Oda Numarası</Label>
                  <Input
                    id="odano"
                    placeholder="123456"
                    value={formData.odano}
                    onChange={(e) => handleInputChange('odano', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Info */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                İletişim Bilgileri
              </CardTitle>
              <CardDescription>
                Telefon, faks ve diğer iletişim bilgileri
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+90 (212) 123 45 67"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone2">Telefon 2</Label>
                  <Input
                    id="phone2"
                    type="tel"
                    placeholder="+90 (212) 123 45 68"
                    value={formData.phone2}
                    onChange={(e) => handleInputChange('phone2', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cellphone">Cep Telefonu</Label>
                  <Input
                    id="cellphone"
                    type="tel"
                    placeholder="+90 (532) 123 45 67"
                    value={formData.cellphone}
                    onChange={(e) => handleInputChange('cellphone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fax">Faks</Label>
                  <Input
                    id="fax"
                    type="tel"
                    placeholder="+90 (212) 123 45 69"
                    value={formData.fax}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location */}
        <TabsContent value="location" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Konum ve Adres Bilgileri
              </CardTitle>
              <CardDescription>
                Adres ve harita koordinatları
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Adres</Label>
                <Textarea
                  id="street"
                  placeholder="Cadde, Sokak, Bina No, Daire"
                  value={formData.address.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">İl</Label>
                  <Input
                    id="city"
                    placeholder="İstanbul"
                    value={formData.address.city}
                    onChange={(e) => handleAddressChange('city', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">İlçe</Label>
                  <Input
                    id="state"
                    placeholder="Kadıköy"
                    value={formData.address.state}
                    onChange={(e) => handleAddressChange('state', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Posta Kodu</Label>
                  <Input
                    id="postal_code"
                    placeholder="34000"
                    value={formData.address.postal_code}
                    onChange={(e) => handleAddressChange('postal_code', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Ülke</Label>
                  <Input
                    id="country"
                    placeholder="Türkiye"
                    value={formData.address.country}
                    onChange={(e) => handleAddressChange('country', e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-4">Harita Koordinatları</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lat">Enlem (Latitude)</Label>
                    <Input
                      id="lat"
                      placeholder="41.0082"
                      value={formData.coordinates.lat}
                      onChange={(e) => handleCoordinatesChange('lat', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lng">Boylam (Longitude)</Label>
                    <Input
                      id="lng"
                      placeholder="28.9784"
                      value={formData.coordinates.lng}
                      onChange={(e) => handleCoordinatesChange('lng', e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Google Maps&apos;ten koordinat almak için lokasyona sağ tıklayın
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            İptal
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Oluşturuluyor...
            </>
          ) : (
            <>
              <Building2 className="mr-2 h-4 w-4" />
              Şirketi Oluştur
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
