"use client"

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Role } from '@/features/actions/settings/roles/role-actions'

export const SystemRolesModal: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  roles?: Role[]
  loading?: boolean
  onRefresh?: () => Promise<void>
}> = ({ open, onOpenChange, roles, loading = false, onRefresh }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sistem Rolleri</DialogTitle>
        </DialogHeader>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Sistem Rolleri</CardTitle>
            <div>
              {onRefresh && (
                <Button size="sm" variant="ghost" onClick={onRefresh}>
                  Yenile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Yükleniyor...</div>
            ) : (
              <div className="space-y-2">
                {(roles || []).length === 0 ? (
                  <div className="text-muted-foreground">Sistemde kayıtlı rol bulunamadı.</div>
                ) : (
                  roles!.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{r.description}</div>
                        <div className="text-xs text-muted-foreground">{r.name}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
