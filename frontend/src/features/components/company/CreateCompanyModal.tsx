'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CreateCompanyForm } from '@/features/components/dashboard/settings/company/CreateCompanyForm'

interface CreateCompanyModalProps {
  triggerLabel?: string
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({ triggerLabel = 'Yeni Şirket Ekle' }) => {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    setOpen(false)
    // navigate to dashboard after creation and refresh
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" onClick={() => setOpen(true)}>{triggerLabel}</Button>
      </DialogTrigger>

      <DialogContent className="min-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Yeni Şirket Oluştur</DialogTitle>
          <DialogDescription>Yeni bir şirket oluşturmak için formu doldurun</DialogDescription>
        </DialogHeader>

        <div>
          <CreateCompanyForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreateCompanyModal
