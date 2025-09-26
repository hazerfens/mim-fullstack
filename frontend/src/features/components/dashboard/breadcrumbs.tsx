'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'

// API'den bölüm adını almak için basit bir fetch fonksiyonu
const fetchDepartmentName = async (id: string) => {
  try {
    const response = await fetch(`/api/bolumler/${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch department with ID: ${id}`)
    }
    const data = await response.json()
    return data.name // Bölüm adını alıyoruz
  } catch (error) {
    console.error('Error fetching department name:', error)
    return null
  }
}

// API'den malzeme adını almak için fetch fonksiyonu
const fetchMaterialName = async (id: string) => {
  try {
    // API'ye istek yaparak malzeme bilgisini al
    const response = await fetch(`/api/materials/${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch material with ID: ${id}`)
    }
    const data = await response.json()
    return data.name // Malzeme adını alıyoruz
  } catch (error) {
    console.error('Error fetching material name:', error)
    return null
  }
}

const MyBreadCrumbs = () => {
  const pathname = usePathname()
  const segments = pathname?.split('/').filter(item => item !== '')

  const segmentMapping: { [key: string]: string } = {
    dashboard: 'Dashboard',
    company: 'Şirket',
    faturalar: 'Faturalar',
    incoming: 'Alış Faturaları',
    cari: 'Cariler',
    outgoing: 'Satış Faturaları',
    stok: 'Stok',
    transactions: 'İşlemler',
    edit: 'Düzenle',
    raw: 'Hammadde Tanımları',
    depo: 'Depolar',
    bolumler: 'Bölümler',
    uretim: 'Üretim',
    kasa: 'Kasa',
    siparisler: 'Siparişler',
    kategoriler: 'Kategoriler',
    makineler: 'Makinalar',
    personel: 'Personel',
    kullanicilar: 'Kayıtlı Kullanıcılar',
    cariislemler: 'Cari Ayarları',
    permission: 'Rol Ayarları',
    userlist: 'Kullanıcı Listesi',
    alis: 'Gelen Faturalar',
    satis: 'Giden Faturalar',
    warehouses: 'Depolar',
    hammaddeler: 'Hammaddeler',
    products: 'Ürünler',
    categories: 'Kategoriler',
    definitions: 'Ürün Tanımları',
    urunler:'Ürünler',
    tabelatotem: 'Tabela/Totem',
    machines: 'Makineler',
    malzemeler: 'Malzemeler',
    extracost: 'Extra Maliyetler',
    materials: 'Malzemeler',
    content: 'İçerik Yönetimi',
    sliders: 'Slider',
    stockmovements: 'Stok Hareketleri',
    inventory: 'Stok',
    materialinventory: "Malzemeler",
    'material-inventory': "Malzemeler",
    'molds': "Yarı Mamüller",
    'price': "Fiyatlandırmalar",
  }
  const [departmentName, setDepartmentName] = useState<string | null>(null)
  const [materialName, setMaterialName] = useState<string | null>(null)

  // const buttonRef = useRef<HTMLButtonElement>(null)

  // const handleDrag = (e: React.MouseEvent, data: { x: number; y: number }) => {
  //   if (buttonRef.current) {
  //     const { x, y } = data
  //     buttonRef.current.style.transform = `translate(${x}px, ${y}px)`
  //   }
  // }

  // ID'leri kontrol etmek için yardımcı fonksiyon
  const isValidId = (id: string) => {
    // Departman ID'si "cm0" ile başlar
    return id.startsWith('cm0')
  }

  // Malzeme ID'sini kontrol etmek için, uzunluk kontrolü de yapalım
  const isMaterialId = (id: string) => {
    // Örnek: cmagtsx4a0009cexcybdsk8s8 gibi uzun ID'ler malzeme ID'si olabilir
    return id.length > 20;
  }

  // URL'nin `/uretim` içerip içermediğini kontrol edin
  const isProductionPath = pathname.includes('/uretim')
  
  // Malzeme detay sayfasında mı kontrol et (dashboard/materials/ID şeklinde)
  const isMaterialDetailPath = 
    segments && segments.length >= 3 && 
    segments[0] === 'dashboard' && 
    segments[1] === 'materials' && 
    isMaterialId(segments[2])
  
  // Eğer uretim rotasındaysak son segmenti departmentId olarak kabul et
  const departmentId =
    isProductionPath && isValidId(segments[segments.length - 1])
      ? segments[segments.length - 1] 
      : null
      
  // Eğer material detay sayfasındaysak malzeme ID'sini al
  const materialId = 
    isMaterialDetailPath ? segments[2] : null
  useEffect(() => {
    const getDepartmentName = async () => {
      // Sadece geçerli bir departmentId varsa API isteği yap
      if (departmentId) {
        try {
          const name = await fetchDepartmentName(departmentId)
          if (name) {
            setDepartmentName(name)
          } else {
            console.warn(`No department name found for ID: ${departmentId}`)
          }
        } catch (error) {
          console.error('Error fetching department name:', error)
        }
      } else {
        setDepartmentName(null) // Eğer bir departmentId yoksa, state'i sıfırla
      }
    }

    const getMaterialName = async () => {
      // Sadece geçerli bir materialId varsa API isteği yap
      if (materialId) {
        try {
          const name = await fetchMaterialName(materialId)
          if (name) {
            setMaterialName(name)
          } else {
            console.warn(`No material name found for ID: ${materialId}`)
          }
        } catch (error) {
          console.error('Error fetching material name:', error)
        }
      } else {
        setMaterialName(null) // Eğer bir materialId yoksa, state'i sıfırla
      }
    }

    getDepartmentName()
    getMaterialName()
  }, [departmentId, materialId])
  // Filtrelemeyi kaldırdık - tüm segmentleri gösteriyoruz artık
  const selectedSegments = segments.map((segment, index) => {
    // Öncelikle segment mapping'e bakarak bilinen bir segment mi kontrol et
    // Eğer bilinen bir segment değilse, department veya material ID'si olabilir
    const label =
      segmentMapping[segment as keyof typeof segmentMapping] ||
      (segment === departmentId && departmentName) ||
      (segment === materialId && materialName) ||
      segment

    const link = `/${segments.slice(0, index + 1).join('/')}`
    return { label, link }
  })

  return (
    <nav className='flex items-center text-sm'>
      {selectedSegments.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <ChevronRight size={15} className="mx-1 text-muted-foreground" />
          )}
          <Link
            href={item.link}
            className={`hover:text-foreground ${index === selectedSegments.length - 1 ? 'font-medium text-primary' : ''}`}
          >
            {item.label}
          </Link>
        </div>
      ))}
    </nav>
  )
}

export default MyBreadCrumbs