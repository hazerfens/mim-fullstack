'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1'

export interface Company {
  id: string
  adi: string | null
  unvani: string | null
  slug: string
  logo: string | null
  logo2: string | null
  is_active: boolean
  plan_type: string | null
  plan_expires: string | null
  modules: {
    branches: boolean
    departments: boolean
    employees: boolean
    projects: boolean
    invoices: boolean
    reports: boolean
    settings: boolean
  } | null
  created_at: string
  updated_at: string
}

interface CompanyState {
  companies: Company[]
  activeCompany: Company | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchCompanies: (token: string) => Promise<void>
  fetchActiveCompany: (token: string) => Promise<void>
  switchCompany: (token: string, companyId: string) => Promise<void>
  setActiveCompany: (company: Company | null) => void
  clearCompanies: () => void
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      companies: [],
      activeCompany: null,
      loading: false,
      error: null,

      fetchCompanies: async (token: string) => {
        set({ loading: true, error: null })
        try {
          const response = await fetch(`${API_URL}/company`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error('Failed to fetch companies')
          }

          const companies = await response.json()
          set({ companies, loading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error', 
            loading: false 
          })
        }
      },

      fetchActiveCompany: async (token: string) => {
        set({ loading: true, error: null })
        try {
          const response = await fetch(`${API_URL}/company/active`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            // No active company is not an error state
            if (response.status === 404) {
              set({ activeCompany: null, loading: false })
              return
            }
            throw new Error('Failed to fetch active company')
          }

          const company = await response.json()
          set({ activeCompany: company, loading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error', 
            loading: false 
          })
        }
      },

      switchCompany: async (token: string, companyId: string) => {
        set({ loading: true, error: null })
        try {
          const response = await fetch(`${API_URL}/company/switch`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ company_id: companyId }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || 'Failed to switch company')
          }

          // After switching, fetch the active company to update state
          await get().fetchActiveCompany(token)
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error', 
            loading: false 
          })
          throw error
        }
      },

      setActiveCompany: (company: Company | null) => {
        set({ activeCompany: company })
      },

      clearCompanies: () => {
        set({ companies: [], activeCompany: null, loading: false, error: null })
      },
    }),
    {
      name: 'company-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        activeCompany: state.activeCompany,
        companies: state.companies 
      }),
    }
  )
)

// Hooks for easier access
export const useCompanies = () => useCompanyStore((state) => state.companies)
export const useActiveCompany = () => useCompanyStore((state) => state.activeCompany)
export const useCompanyLoading = () => useCompanyStore((state) => state.loading)
export const useCompanyError = () => useCompanyStore((state) => state.error)
