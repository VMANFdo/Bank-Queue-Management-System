export type Role = "teller" | "branch_manager" | "head_office_admin";

export const ROLE_HIERARCHY: Record<Role, number> = {
  teller: 1,
  branch_manager: 2,
  head_office_admin: 3,
};

export const PATH_ROLE_MAP: Record<string, Role[]> = {
  "/teller": ["teller"],
  "/manager": ["branch_manager"],
  "/admin": ["head_office_admin"],
};

const ROLES = new Set<Role>(["teller", "branch_manager", "head_office_admin"]);

function isRole(value: unknown): value is Role {
  return ROLES.has(value as Role);
}

interface UserLike {
  app_metadata?: Record<string, unknown>;
}

export function getRole(user: UserLike | null): Role | null {
  if (!user) return null;
  const role = user.app_metadata?.role;
  return isRole(role) ? role : null;
}

export function hasRole(user: UserLike | null, ...allowed: Role[]): boolean {
  const role = getRole(user);
  return role !== null && allowed.includes(role);
}

export function requireRole(user: UserLike | null, ...allowed: Role[]): void {
  if (!hasRole(user, ...allowed)) {
    const role = getRole(user);
    throw new Error(
      `Access denied. Required role: ${allowed.join(" or ")}, got: ${role ?? "none"}`,
    );
  }
}

export function getRequiredRolesForPath(pathname: string): Role[] | null {
  for (const [prefix, roles] of Object.entries(PATH_ROLE_MAP)) {
    if (pathname.startsWith(prefix)) return roles;
  }
  return null;
}
