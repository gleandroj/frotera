import type { Role } from "@/lib/api/roles";

type TranslationFn = (key: string, options?: any) => string;

const fallbackDescriptionByRoleName: Array<{ matcher: RegExp; translationKey: string }> = [
  {
    matcher: /motorista/i,
    translationKey: "team.roleContext.fallbackByRole.driver",
  },
  {
    matcher: /visualizador/i,
    translationKey: "team.roleContext.fallbackByRole.viewer",
  },
  {
    matcher: /operador/i,
    translationKey: "team.roleContext.fallbackByRole.operator",
  },
  {
    matcher: /administrador/i,
    translationKey: "team.roleContext.fallbackByRole.admin",
  },
  {
    matcher: /dono|owner/i,
    translationKey: "team.roleContext.fallbackByRole.owner",
  },
];

export function describeRole(t: TranslationFn, role?: Role): string {
  if (!role) return t("team.roleContext.selectRoleHint");
  if (role.description?.trim()) return role.description.trim();
  const fallback = fallbackDescriptionByRoleName.find((item) => item.matcher.test(role.name));
  if (fallback) return t(fallback.translationKey);
  return t("team.roleContext.fallbackByRole.custom");
}

export function summarizeRolePermissions(t: TranslationFn, role?: Role): string[] {
  if (!role) return [];
  return role.permissions.map((permission) => {
    const moduleLabel = t(`roles.modules.${permission.module}`);
    const module =
      moduleLabel === `roles.modules.${permission.module}`
        ? permission.module
        : moduleLabel;
    const actions = permission.actions
      .map((action) => {
        const actionLabel = t(`roles.actions.${action}`);
        return actionLabel === `roles.actions.${action}` ? action : actionLabel;
      })
      .join(", ");
    return `${module}: ${actions || t("team.roleContext.noActionsDefined")}`;
  });
}

export function summarizeRoleScope(t: TranslationFn, role?: Role): {
  hasAssignedScope: boolean;
  labels: string[];
  explanation: string;
} {
  if (!role) {
    return {
      hasAssignedScope: false,
      labels: [],
      explanation: t("team.roleContext.selectRoleScopeHint"),
    };
  }

  const scopes = [...new Set(role.permissions.map((permission) => permission.scope))];
  const hasAssignedScope = scopes.includes("ASSIGNED");
  const hasGlobalScope = scopes.includes("GLOBAL");

  let explanation = t("team.roleContext.scopeUnknown");
  if (hasGlobalScope && hasAssignedScope) {
    explanation = t("team.roleContext.scopeMixed");
  } else if (hasGlobalScope) {
    explanation = t("team.roleContext.scopeGlobalOnly");
  } else if (hasAssignedScope) {
    explanation = t("team.roleContext.scopeAssignedOnly");
  }

  return { hasAssignedScope, labels: scopes, explanation };
}
