"use client"

import React, { useState } from "react"
import { PhoneInput } from "@/components/ui/phone-input"
import { PhoneInputField } from "@/features/components/inputs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * PhoneInput Component Demo/Test Page
 * 
 * Bu sayfa PhoneInput component'inin çeşitli kullanım senaryolarını gösterir.
 * Development sırasında component'i test etmek için kullanılabilir.
 * 
 * Rotaya eklemek için:
 * app/(dashboard)/settings/phone-input-demo/page.tsx
 */
export default function PhoneInputDemo() {
  const [phone1, setPhone1] = useState("")
  const [phone2, setPhone2] = useState("+905321234567")
  const [phone3, setPhone3] = useState("")

  const handleChange1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone1(e.target.value)
  }

  const handleChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone2(e.target.value)
  }

  const handleChange3 = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone3(e.target.value)
  }

  return (
    <div className="space-y-8 p-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">PhoneInput Component Demo</h1>
        <p className="text-muted-foreground">
          Türk telefon numaraları için otomatik formatlama
        </p>
      </div>

      {/* Format Information */}
      <Alert>
        <AlertDescription>
          <strong>Format:</strong> +xx xxx xxx xx xx (Max 12 digit)
          <br />
          <strong>Örnek:</strong> +90 532 123 45 67
          <br />
          <strong>Display:</strong> Formatlanmış görünüm
          <br />
          <strong>Storage:</strong> Boşluksuz versiyonu kaydedilir (+905321234567)
        </AlertDescription>
      </Alert>

      {/* Example 1: Basic PhoneInput */}
      <Card>
        <CardHeader>
          <CardTitle>Örnek 1: Temel PhoneInput</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Telefon Numarası</label>
            <PhoneInput
              value={phone1}
              onChange={handleChange1}
              placeholder="+90 5XX XXX XX XX"
            />
          </div>
          <div className="text-sm space-y-1">
            <p>
              <strong>Display Value:</strong> {phone1 || "Boş"}
            </p>
            <p>
              <strong>Clean Value:</strong> {phone1.replace(/\s/g, "") || "Boş"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Example 2: With Default Value */}
      <Card>
        <CardHeader>
          <CardTitle>Örnek 2: Varsayılan Değer ile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Telefon Numarası</label>
            <PhoneInput
              value={phone2}
              onChange={handleChange2}
              placeholder="+90 3XX XXX XX XX"
            />
          </div>
          <div className="text-sm space-y-1">
            <p>
              <strong>Display Value:</strong> {phone2 || "Boş"}
            </p>
            <p>
              <strong>Clean Value:</strong> {phone2.replace(/\s/g, "") || "Boş"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Example 3: PhoneInputField */}
      <Card>
        <CardHeader>
          <CardTitle>Örnek 3: PhoneInputField (Field Wrapper)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PhoneInputField
            value={phone3}
            onChange={handleChange3}
            label="Cep Telefonu"
            description="Cep telefonu numaranız"
            required
            placeholder="+90 5XX XXX XX XX"
          />
          <div className="text-sm space-y-1 bg-muted p-3 rounded">
            <p>
              <strong>Display Value:</strong> {phone3 || "Boş"}
            </p>
            <p>
              <strong>Clean Value:</strong> {phone3.replace(/\s/g, "") || "Boş"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Format Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Formatlama Örnekleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-muted-foreground">Girdi</p>
                <div className="space-y-2 font-mono text-xs mt-2">
                  <p>5321234567</p>
                  <p>905321234567</p>
                  <p>+905321234567</p>
                  <p>+90 532 123 45 67</p>
                  <p>+90 (532) 123-4567</p>
                </div>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Çıktı</p>
                <div className="space-y-2 font-mono text-xs mt-2">
                  <p>+53 212 345 67</p>
                  <p>+90 532 123 45 67</p>
                  <p>+90 532 123 45 67</p>
                  <p>+90 532 123 45 67</p>
                  <p>+90 532 123 45 67</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanım Notları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc list-inside space-y-2">
            <li>Plus işareti otomatik olarak başına eklenir</li>
            <li>Sadece rakamlar kabul edilir (diğer karakterler silinir)</li>
            <li>Max 12 digit sınırlaması vardır</li>
            <li>Display değeri formatlanmış (+90 532 123 45 67)</li>
            <li>
              Kaydedilecek değer temiz şekilde gönderilir
              (+905321234567)
            </li>
            <li>React Hook Form ile uyumludur</li>
            <li>Disabled state desteği vardır</li>
            <li>Accessibility attributes otomatik eklenmiştir</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
