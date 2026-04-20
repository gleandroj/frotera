"use client"

import { externalApi, authAPI, organizationAPI } from "@/lib/frontend/api-client"
import { setLanguageCookie } from "@/lib/language-utils"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

export interface OrganizationRole {
  id: string
  key?: string
  name: string
  description?: string | null
  isSystem: boolean
  color?: string | null
  permissions: Array<{
    id: string
    module: string
    actions: string[]
    scope: string
  }>
}

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  currency: string
  role: OrganizationRole
  createdAt: string
  stripeCustomerId?: string
}

export interface User {
  id: string
  email: string
  name: string | null
  phoneNumber: string | null
  language: string | null
  twoFactorEnabled: boolean
  twoFactorVerified: boolean
  emailVerified: Date | null
  isSuperAdmin: boolean
  mustChangePassword?: boolean
}

const CURRENT_CUSTOMER_ID_KEY = "currentCustomerId"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isLoggingOut: boolean
  organizations: Organization[]
  currentOrganization: Organization | null
  organizationsLoading: boolean
  /** Global filter: when set, list APIs should send this customerId query param */
  selectedCustomerId: string | null
  setSelectedCustomerId: (customerId: string | null) => void
  refreshOrganizations: () => Promise<Organization[]>
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ data: any }>
  logout: (redirect?: boolean) => Promise<void>
  refreshToken: () => Promise<void>
  refreshUser: () => Promise<void> // This will now fetch updated user info including phone
  refreshAndSwitchOrganization: (orgId: string) => Promise<void>
  setTokens: (accessToken: string, refreshToken: string) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizationsLoading, setOrganizationsLoading] = useState(true)
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<string | null>(null)
  const router = useRouter()

  const setSelectedCustomerId = (customerId: string | null) => {
    setSelectedCustomerIdState(customerId)
    if (customerId === null) {
      localStorage.removeItem(CURRENT_CUSTOMER_ID_KEY)
    } else {
      localStorage.setItem(CURRENT_CUSTOMER_ID_KEY, customerId)
    }
  }

  // Token management
  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem("accessToken", accessToken)
    localStorage.setItem("refreshToken", refreshToken)
  }

  const clearTokens = () => {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("currentOrganizationId")
    localStorage.removeItem(CURRENT_CUSTOMER_ID_KEY)
  }

  const refreshOrganizations = async (): Promise<Organization[]> => {
    try {
      setOrganizationsLoading(true)
      const response = await organizationAPI.getUserOrganizations()
      const data = response.data
      const organizations = data.organizations || []
      setOrganizations(organizations)

      // Get the stored organization ID from localStorage
      const storedOrgId = localStorage.getItem("currentOrganizationId")

      if (organizations.length > 0) {
        if (storedOrgId) {
          // Try to find the stored organization in the list
          const storedOrg = organizations.find((org: Organization) => org.id === storedOrgId)
          if (storedOrg) {
            setCurrentOrganization(storedOrg)
          } else {
            // If stored org not found, use the first one and update localStorage
            setCurrentOrganization(organizations[0])
            localStorage.setItem("currentOrganizationId", organizations[0].id)
          }
        } else {
          // No stored org, use the first one and save it
          setCurrentOrganization(organizations[0])
          localStorage.setItem("currentOrganizationId", organizations[0].id)
        }
      } else {
        // No organizations available
        setCurrentOrganization(null)
        localStorage.removeItem("currentOrganizationId")
      }

      return organizations
    } catch (err: any) {
      console.error("Failed to load organizations:", err)
      const errorMessage = err.response?.data?.error || err.message || "Failed to load organizations"
      toast.error(errorMessage)
      throw err
    } finally {
      setOrganizationsLoading(false)
    }
  }

  const refreshAndSwitchOrganization = async (orgId: string) => {
    try {
      setOrganizationsLoading(true)

      // Fetch fresh organizations
      const response = await organizationAPI.getUserOrganizations()
      const organizations = response.data.organizations || []

      // Find the target organization
      const targetOrg = organizations.find((org: Organization) => org.id === orgId)
      if (!targetOrg) {
        throw new Error(`Organization with ID ${orgId} not found`)
      }

      // Update all state atomically; clear customer filter when switching org
      setOrganizations(organizations)
      setCurrentOrganization(targetOrg)
      setSelectedCustomerIdState(null)
      localStorage.setItem("currentOrganizationId", orgId)
      localStorage.removeItem(CURRENT_CUSTOMER_ID_KEY)

      return organizations
    } catch (err: any) {
      console.error("Failed to refresh and switch organization:", err)
      const errorMessage = err.response?.data?.error || err.message || "Failed to refresh and switch organization"
      toast.error(errorMessage)
      throw err
    } finally {
      setOrganizationsLoading(false)
    }
  }

  const checkAuth = async () => {
    try {
      const { data } = await externalApi.get<{ user: User }>("/api/auth/me") // User type already updated
      setUser(data.user)

      // Set language cookie based on user's preference
      if (data.user.language) {
        await setLanguageCookie(data.user.language)
      }

      // Load organizations after user is authenticated
      await refreshOrganizations()
    } catch (error) {
      console.error("[Auth] Failed to check auth status:", error)
      setUser(null)
      setOrganizations([])
      setCurrentOrganization(null)
      clearTokens()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    try {
      setIsLoading(true)
      const response = await authAPI.login(email, password, twoFactorCode)

      // Store tokens in localStorage
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken)

      // Handle 2FA flow
      if (response.data.requires2FA) {
        router.push("/2fa-verify")
        return response
      }

      setUser(response.data.user)
      await refreshOrganizations()

      // Set language cookie based on user's preference
      if (response.data.user.language) {
        await setLanguageCookie(response.data.user.language)
      }

      // Force password change before accessing the app
      if (response.data.user.mustChangePassword) {
        router.push("/change-password")
        return response
      }

      // Handle return URL if present
      const params = new URLSearchParams(window.location.search)
      const returnUrl = params.get("from")
      router.push(returnUrl || "/dashboard")

      return response
    } catch (error) {
      console.error("[Auth] Login failed:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (redirect = true) => {
    try {
      setIsLoggingOut(true)

      // Call logout API endpoint
      try {
        await authAPI.logout()
      } catch (error) {
        // Even if API call fails, continue with local logout
        // This ensures user can logout even if server is unreachable
        console.error("[Auth] Logout API call failed:", error)
      }

      // Clear local state
      clearTokens()
      setUser(null)
      setOrganizations([])
      setCurrentOrganization(null)
      setSelectedCustomerIdState(null)

      // Redirect to login page
      if (redirect) {
        router.push("/login")
      }
    } catch (error) {
      console.error("[Auth] Logout failed:", error)
      // Still clear local state even if there's an error
      clearTokens()
      setUser(null)
      setOrganizations([])
      setCurrentOrganization(null)
      setSelectedCustomerIdState(null)
      if (redirect) {
        router.push("/login")
      }
    } finally {
      // Reset logout state after a short delay to prevent toast from showing
      setTimeout(() => setIsLoggingOut(false), 1000)
    }
  }

  const refreshToken = async () => {
    try {
      await checkAuth()
    } catch (error) {
      console.error("[Auth] Token refresh failed:", error)
      await logout()
    }
  }

  const refreshUser = async () => {
    await checkAuth()
  }

  // Restore current organization and customer filter from localStorage
  useEffect(() => {
    const savedOrgId = localStorage.getItem("currentOrganizationId")
    if (savedOrgId && organizations.length > 0) {
      const savedOrg = organizations.find((o) => o.id === savedOrgId)
      if (savedOrg) {
        setCurrentOrganization(savedOrg)
      }
    }
  }, [organizations])

  useEffect(() => {
    const saved = localStorage.getItem(CURRENT_CUSTOMER_ID_KEY)
    setSelectedCustomerIdState(saved || null)
  }, [])

  // Check authentication status on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (token) {
      checkAuth()
    } else {
      setIsLoading(false)
      setOrganizationsLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isLoggingOut,
        organizations,
        currentOrganization,
        organizationsLoading,
        selectedCustomerId,
        setSelectedCustomerId,
        refreshOrganizations,
        login,
        logout,
        refreshToken,
        refreshUser,
        refreshAndSwitchOrganization,
        setTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
