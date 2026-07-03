import type { ApplicationSectionKey } from '@/types/workbench/application'
import type { LocationQuery, RouteLocationRaw } from 'vue-router'

const APPLICATION_SECTIONS: ApplicationSectionKey[] = [
  'overview',
  'projects',
  'agents',
  'workflow',
  'artifacts',
  'runs',
  'collaboration',
  'settings',
]

export interface WorkbenchApplicationScopeContext {
  applicationId: string | null
  fromSection: ApplicationSectionKey
}

function normalizeQueryValue(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim()
  }
  return String(value || '').trim()
}

export function normalizeApplicationSection(
  value: string | null | undefined,
  fallback: ApplicationSectionKey = 'overview',
): ApplicationSectionKey {
  const section = String(value || '').trim()
  return APPLICATION_SECTIONS.includes(section as ApplicationSectionKey)
    ? (section as ApplicationSectionKey)
    : fallback
}

export function buildWorkbenchScopeQuery(
  applicationId: string,
  fromSection: ApplicationSectionKey,
): Record<string, string> {
  return {
    applicationId,
    fromSection,
  }
}

export function readWorkbenchApplicationScope(query: LocationQuery): WorkbenchApplicationScopeContext {
  const applicationId = normalizeQueryValue(query.applicationId as string | string[] | undefined) || null
  const fromSection = normalizeApplicationSection(
    normalizeQueryValue(query.fromSection as string | string[] | undefined),
    'overview',
  )

  return {
    applicationId,
    fromSection,
  }
}

export function buildApplicationDetailRoute(
  applicationId: string,
  section: ApplicationSectionKey,
): RouteLocationRaw {
  return {
    name: 'workbench.applicationDetail',
    params: { applicationId },
    query: section === 'overview' ? undefined : { section },
  }
}

export function buildScopedWorkbenchRoute(
  name: 'workbench.resources' | 'workbench.system',
  applicationId: string,
  fromSection: ApplicationSectionKey,
): RouteLocationRaw {
  return {
    name,
    query: buildWorkbenchScopeQuery(applicationId, fromSection),
  }
}
