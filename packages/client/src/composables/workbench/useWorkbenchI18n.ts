import { useI18n } from 'vue-i18n'
import type {
  ApplicationNextAction,
  ApplicationScenario,
  ApplicationSectionKey,
  ApplicationStatus,
} from '@/types/workbench/application'

export function useWorkbenchI18n() {
  const { t, locale } = useI18n()

  function scenarioLabel(scenario: ApplicationScenario): string {
    return t(`workbench.scenarios.${scenario}`)
  }

  function statusLabel(status: ApplicationStatus | 'idle' | 'paused'): string {
    return t(`workbench.statuses.${status}`)
  }

  function sectionLabel(section: ApplicationSectionKey): string {
    return t(`workbench.sections.${section}`)
  }

  function nextActionLabel(action: Pick<ApplicationNextAction, 'key' | 'label'> | null | undefined): string {
    if (!action) return ''

    const map: Record<ApplicationNextAction['key'], string> = {
      bind_project: t('workbench.nextActions.bind_project'),
      configure_agents: t('workbench.nextActions.configure_agents'),
      configure_workflow: t('workbench.nextActions.configure_workflow'),
      start_first_run: t('workbench.nextActions.start_first_run'),
      open_current_run: t('workbench.nextActions.open_current_run'),
      review_pending_artifacts: t('workbench.nextActions.review_pending_artifacts'),
      inspect_failure: t('workbench.nextActions.inspect_failure'),
      view_artifacts: t('workbench.nextActions.view_artifacts'),
    }

    return map[action.key] || action.label
  }

  function statusReasonLabel(reason: string | null | undefined): string | null {
    if (!reason) return null

    const map: Record<string, string> = {
      'Recent run failed': t('workbench.statusReasons.recent_run_failed'),
      'Pending approvals require review': t('workbench.statusReasons.pending_approvals_require_review'),
      'A workflow run is currently active': t('workbench.statusReasons.workflow_run_active'),
      'Primary project is not configured yet': t('workbench.statusReasons.primary_project_not_configured'),
      'No active agents are configured yet': t('workbench.statusReasons.no_active_agents_configured'),
      'Workflow is not configured yet': t('workbench.statusReasons.workflow_not_configured'),
      'Latest run completed successfully': t('workbench.statusReasons.latest_run_completed_successfully'),
      'Ready for the next run': t('workbench.statusReasons.ready_for_next_run'),
    }

    return map[reason] || reason
  }

  return {
    t,
    locale,
    scenarioLabel,
    statusLabel,
    sectionLabel,
    nextActionLabel,
    statusReasonLabel,
  }
}
