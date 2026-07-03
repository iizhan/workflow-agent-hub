import type { ApplicationSectionKey, ApplicationSummary } from '@/types/workbench/application'

export type ApplicationWorkbenchFocus = 'all' | 'review' | 'failed' | 'running' | 'ready' | 'setup'

export function applicationPriorityRank(application: ApplicationSummary): number {
  if (application.hasPendingReview || application.status === 'waiting_review') return 600
  if (application.status === 'failed') return 520
  if (application.hasActiveRun || application.status === 'running') return 440
  if (application.status === 'ready') return 360
  if (application.status === 'setup_required' || application.status === 'draft') return 280
  if (application.status === 'completed') return 200
  return 120
}

export function activityTimestamp(application: ApplicationSummary): number {
  return application.updatedAt || application.lastRunAt || 0
}

export function compareApplications(left: ApplicationSummary, right: ApplicationSummary): number {
  const priorityGap = applicationPriorityRank(right) - applicationPriorityRank(left)
  if (priorityGap !== 0) return priorityGap
  return activityTimestamp(right) - activityTimestamp(left)
}

export function matchesApplicationFocus(
  application: ApplicationSummary,
  focus: ApplicationWorkbenchFocus,
): boolean {
  if (focus === 'review') return application.hasPendingReview || application.status === 'waiting_review'
  if (focus === 'failed') return application.status === 'failed'
  if (focus === 'running') return application.hasActiveRun || application.status === 'running'
  if (focus === 'ready') {
    return application.status === 'ready' && !application.hasActiveRun && !application.hasPendingReview
  }
  if (focus === 'setup') {
    return application.status === 'draft' || application.status === 'setup_required'
  }
  return true
}

export function preferredApplicationSection(application: ApplicationSummary): ApplicationSectionKey {
  if (application.nextAction?.targetSection) return application.nextAction.targetSection
  if (application.hasActiveRun || application.status === 'running') return 'collaboration'
  if (
    application.hasPendingReview
    || application.status === 'waiting_review'
    || application.status === 'failed'
    || application.status === 'ready'
  ) return 'runs'
  if (application.status === 'completed') return 'artifacts'
  return 'overview'
}
