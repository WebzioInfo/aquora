export interface UserLike {
  roles?: string[]
  roleName?: string
  primaryRole?: string
  [key: string]: any
}

/**
 * Checks if the logged-in user has the Owner role.
 * Resolves roles array (e.g. ['Owner'], ['companyowner']) as well as roleName / primaryRole properties.
 */
export const isOwnerUser = (user?: UserLike | null): boolean => {
  if (!user) return false
  const roles = user.roles || []
  const roleName = user.roleName || user.primaryRole || ''

  const ownerRoleIdentifiers = ['owner', 'companyowner', 'platformowner']

  const hasOwnerInRoles = roles.some((r: string) =>
    typeof r === 'string' && ownerRoleIdentifiers.includes(r.toLowerCase().trim())
  )

  const isOwnerRoleName = typeof roleName === 'string' && ownerRoleIdentifiers.includes(roleName.toLowerCase().trim())

  return hasOwnerInRoles || isOwnerRoleName
}

/**
 * Centralized permission rule:
 * Owner → NO access to Production Setup
 * Owner → NO access to Brands
 * Other authorized roles → Full access to Production Setup and Brands (if entitled)
 */
export const isModuleAccessAllowedForUser = (user: UserLike | null, moduleKey: 'production-setup' | 'brands'): boolean => {
  if (isOwnerUser(user)) {
    if (moduleKey === 'production-setup' || moduleKey === 'brands') {
      return false
    }
  }
  return true
}

/**
 * Filters sidebar navigation items based on user role permissions.
 * Specifically removes Production Setup and Brands from the sidebar when the user is an Owner.
 */
export const filterSidebarItemsForUser = (items: any[], user: UserLike | null): any[] => {
  const isOwner = isOwnerUser(user)
  if (!isOwner) return items

  return items
    .filter((item: any) => {
      const path = item.path || ''
      if (path.includes('/company/production-setup')) return false
      if (path.includes('/company/inventory') && path.includes('tab=brands')) return false
      return true
    })
    .map((item: any) => {
      if (item.children && Array.isArray(item.children)) {
        return {
          ...item,
          children: filterSidebarItemsForUser(item.children, user)
        }
      }
      return item
    })
}
