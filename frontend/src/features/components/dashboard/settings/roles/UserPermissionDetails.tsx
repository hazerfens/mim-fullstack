'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, Shield, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getUserPermissionsAction } from '@/features/actions/settings/roles/role-actions'
import { getUserCustomPermissionsAction, type UserPermission } from '@/features/actions/settings/roles/user-permission-actions'
import { toast } from 'sonner'

interface UserPermissionDetailsProps {
  userId: string
  roleName?: string
}

const RESOURCES = ['companies', 'roles', 'permissions', 'users'] as const
const ACTIONS = ['create', 'read', 'update', 'delete'] as const

type Resource = typeof RESOURCES[number]
type Action = typeof ACTIONS[number]

interface TimeRestriction {
  allowed_days?: number[]
  start_time?: string
  end_time?: string
  start_date?: string
  end_date?: string
}

interface PermissionSource {
  allowed: boolean
  source: 'role' | 'custom' | 'none'
  priority?: number
  timeRestriction?: string
  customPermission?: UserPermission
}

export const UserPermissionDetails: React.FC<UserPermissionDetailsProps> = ({ userId, roleName }) => {
  const [loading, setLoading] = useState(true)
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [customPermissions, setCustomPermissions] = useState<UserPermission[]>([])
  
  const fetchAllPermissions = async () => {
    setLoading(true)
    try {
      // Fetch role permissions
      const roleResult = await getUserPermissionsAction(userId)
      if (roleResult.status === 'success') {
        // Convert PermissionDetail format to string array format
        const converted: Record<string, string[]> = {}
        const perms = roleResult.permissions
        
        // Process each resource
        Object.keys(perms).forEach((resource) => {
          const detail = perms[resource]
          if (detail && typeof detail === 'object') {
            const actions: string[] = []
            if (detail.create) actions.push('create')
            if (detail.read) actions.push('read')
            if (detail.update) actions.push('update')
            if (detail.delete) actions.push('delete')
            if (actions.length > 0) {
              converted[resource] = actions
            }
          }
        })
        
        setRolePermissions(converted)
      }

      // Fetch custom permissions
      const customResult = await getUserCustomPermissionsAction(userId)
      if (customResult.status === 'success') {
        setCustomPermissions(customResult.permissions)
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      toast.error('İzinler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchAllPermissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const getPermissionStatus = (resource: Resource, action: Action): PermissionSource => {
    // Check custom permissions first (higher priority)
    const customPerm = customPermissions.find(
      p => p.resource === resource && p.action === action
    )
    
    if (customPerm) {
      return {
        allowed: customPerm.is_allowed,
        source: 'custom',
        priority: customPerm.priority,
        timeRestriction: customPerm.time_restriction ? formatTimeRestriction(customPerm.time_restriction) : undefined,
        customPermission: customPerm
      }
    }

    // Check role permissions
    const resourcePerms = rolePermissions[resource] || []
    if (resourcePerms.includes(action)) {
      return {
        allowed: true,
        source: 'role'
      }
    }

    return {
      allowed: false,
      source: 'none'
    }
  }

  const formatTimeRestriction = (restriction: TimeRestriction): string => {
    if (!restriction) return ''
    
    const parts: string[] = []
    
    // Days (Backend uses 1=Monday, 7=Sunday)
    if (restriction.allowed_days && restriction.allowed_days.length > 0) {
      const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
      const days = restriction.allowed_days.map((d: number) => dayNames[d - 1]).join(', ')
      parts.push(days)
    }
    
    // Time range
    if (restriction.start_time && restriction.end_time) {
      parts.push(`${restriction.start_time}-${restriction.end_time}`)
    }
    
    return parts.join(' | ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">İzinler yükleniyor...</span>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="bg-muted/30 p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">İzin Matrisi</span>
            {roleName && (
              <Badge variant="outline" className="ml-2 text-xs">
                Rol: {roleName}
              </Badge>
            )}
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/40" />
              <span className="text-muted-foreground">Rol İzni</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40" />
              <span className="text-muted-foreground">Özel İzin</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-600" />
              <span className="text-muted-foreground">Zamanlı</span>
            </div>
          </div>
        </div>

      {/* Permission Matrix */}
      <div className="rounded-md border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium">Kaynak</th>
              {ACTIONS.map((action) => (
                <th key={action} className="text-center p-2 font-medium capitalize w-24">
                  {action === 'create' ? 'Oluştur' :
                   action === 'read' ? 'Görüntüle' :
                   action === 'update' ? 'Güncelle' : 'Sil'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource, idx) => (
              <tr key={resource} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="p-2 font-medium capitalize">
                  {resource === 'companies' ? 'Şirketler' :
                   resource === 'roles' ? 'Roller' :
                   resource === 'permissions' ? 'İzinler' : 'Kullanıcılar'}
                </td>
                {ACTIONS.map((action) => {
                  const status = getPermissionStatus(resource, action)
                  const hasCustomPerm = status.source === 'custom' && status.customPermission
                  
                  return (
                    <td key={action} className="p-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-1 cursor-help">
                            <div 
                              className={`
                                w-full max-w-[80px] rounded-md p-2 border transition-all
                                ${status.source === 'custom' 
                                  ? status.allowed 
                                    ? 'bg-green-500/10 border-green-500/40 hover:bg-green-500/20' 
                                    : 'bg-red-500/10 border-red-500/40 hover:bg-red-500/20'
                                  : status.source === 'role'
                                    ? 'bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/20'
                                    : 'bg-muted/50 border-muted-foreground/20'
                                }
                              `}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {status.allowed ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500/70" />
                                )}
                                {status.timeRestriction && (
                                  <Clock className="h-3 w-3 text-amber-600" />
                                )}
                              </div>
                            </div>
                            
                            {status.timeRestriction && (
                              <div className="text-[10px] text-muted-foreground text-center whitespace-nowrap">
                                {status.timeRestriction}
                              </div>
                            )}
                            
                            {status.priority !== undefined && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                P{status.priority}
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        
                        {hasCustomPerm && status.customPermission && (
                          <TooltipContent side="right" className="max-w-[300px] p-3">
                            <div className="space-y-2 text-xs">
                              <div className="font-semibold border-b pb-1 flex items-center gap-2">
                                <Shield className="h-3 w-3" />
                                Özel İzin Detayları
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Durum:</span>
                                  <Badge 
                                    variant={status.customPermission.is_allowed ? "default" : "destructive"}
                                    className="text-[10px] h-4"
                                  >
                                    {status.customPermission.is_allowed ? 'İzin Verildi' : 'Reddedildi'}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Öncelik:</span>
                                  <code className="text-[10px]">{status.customPermission.priority}</code>
                                </div>
                                
                                {status.customPermission.time_restriction && (
                                  <div className="pt-1 border-t space-y-1">
                                    <div className="flex items-center gap-1 text-amber-600">
                                      <Clock className="h-3 w-3" />
                                      <span className="font-medium">Zaman Kısıtlaması</span>
                                    </div>
                                    
                                    {status.customPermission.time_restriction.allowed_days && 
                                     status.customPermission.time_restriction.allowed_days.length > 0 && (
                                      <div className="text-muted-foreground">
                                        <span className="font-medium">Günler: </span>
                                        {status.customPermission.time_restriction.allowed_days.map((d) => {
                                          const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
                                          return days[d - 1] // Backend uses 1=Monday, 7=Sunday
                                        }).join(', ')}
                                      </div>
                                    )}
                                    
                                    {status.customPermission.time_restriction.start_time && 
                                     status.customPermission.time_restriction.end_time && (
                                      <div className="text-muted-foreground">
                                        <span className="font-medium">Saatler: </span>
                                        {status.customPermission.time_restriction.start_time} - {status.customPermission.time_restriction.end_time}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom Permissions Info */}
      {customPermissions.length > 0 && (
        <div className="space-y-3">
          <Card className="p-3 bg-muted/50 border-dashed">
            <div className="text-xs space-y-1">
              <div className="font-medium flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Özel İzin Özeti
              </div>
              <div className="text-muted-foreground">
                Bu kullanıcı için {customPermissions.length} özel izin tanımlanmış.
                Özel izinler rol izinlerini geçersiz kılar.
              </div>
            </div>
          </Card>

          {/* Detailed Custom Permissions List */}
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Shield className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Özel İzin Detayları</h4>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {customPermissions.map((perm, index) => (
                  <div 
                    key={perm.id || index}
                    className={`
                      p-3 rounded-lg border text-xs
                      ${perm.is_allowed 
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' 
                        : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1.5">
                        {/* Resource & Action */}
                        <div className="flex items-center gap-2">
                          {perm.is_allowed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className="font-semibold capitalize">
                            {perm.resource === 'companies' ? 'Şirketler' :
                             perm.resource === 'roles' ? 'Roller' :
                             perm.resource === 'permissions' ? 'İzinler' : 
                             perm.resource === 'users' ? 'Kullanıcılar' : perm.resource}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium capitalize">
                            {perm.action === 'create' ? 'Oluştur' :
                             perm.action === 'read' ? 'Görüntüle' :
                             perm.action === 'update' ? 'Güncelle' : 
                             perm.action === 'delete' ? 'Sil' : perm.action}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={perm.is_allowed ? "default" : "destructive"}
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            {perm.is_allowed ? 'İzin Verildi' : 'Reddedildi'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            Öncelik: {perm.priority}
                          </Badge>
                        </div>

                        {/* Time Restriction */}
                        {perm.time_restriction && (
                          <div className="pt-1.5 mt-1.5 border-t space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-600">
                              <Clock className="h-3 w-3" />
                              <span className="font-medium">Zaman Kısıtlaması</span>
                            </div>
                            
                            <div className="pl-4 space-y-0.5 text-muted-foreground">
                              {/* Days */}
                              {perm.time_restriction.allowed_days && perm.time_restriction.allowed_days.length > 0 && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium min-w-[60px]">Günler:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {perm.time_restriction.allowed_days.map((day) => {
                                      const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
                                      return (
                                        <Badge key={day} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                          {dayNames[day - 1]}
                                        </Badge>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* Time Range */}
                              {perm.time_restriction.start_time && perm.time_restriction.end_time && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium min-w-[60px]">Saatler:</span>
                                  <code className="bg-muted px-2 py-0.5 rounded text-[10px]">
                                    {perm.time_restriction.start_time} - {perm.time_restriction.end_time}
                                  </code>
                                </div>
                              )}
                              
                              {/* Date Range */}
                              {perm.time_restriction.start_date && perm.time_restriction.end_date && (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium min-w-[60px]">Tarihler:</span>
                                  <code className="bg-muted px-2 py-0.5 rounded text-[10px]">
                                    {new Date(perm.time_restriction.start_date).toLocaleDateString('tr-TR')} - {' '}
                                    {new Date(perm.time_restriction.end_date).toLocaleDateString('tr-TR')}
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Created/Updated Info */}
                        {perm.created_at && (
                          <div className="text-[10px] text-muted-foreground pt-1">
                            Oluşturulma: {new Date(perm.created_at).toLocaleString('tr-TR')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
      </div>
    </TooltipProvider>
  )
}
