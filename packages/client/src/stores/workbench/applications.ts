import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createApplication,
  getApplicationCreateOptions,
  getApplicationDetail,
  listApplicationSummaries,
} from '@/api/workbench/applications'
import type {
  ApplicationCreateInput,
  ApplicationCreateOptions,
  ApplicationDetail,
  ApplicationSectionKey,
  ApplicationSummary,
} from '@/types/workbench/application'

export const useApplicationsStore = defineStore('workbenchApplications', () => {
  const applications = ref<ApplicationSummary[]>([])
  const currentApplication = ref<ApplicationDetail | null>(null)
  const currentSection = ref<ApplicationSectionKey>('overview')
  const createOptions = ref<ApplicationCreateOptions | null>(null)
  const isLoadingList = ref(false)
  const isLoadingDetail = ref(false)
  const isLoadingCreateOptions = ref(false)
  const isCreating = ref(false)
  const error = ref<string | null>(null)

  async function loadApplications() {
    isLoadingList.value = true
    error.value = null
    try {
      applications.value = await listApplicationSummaries()
      return applications.value
    } catch (err: any) {
      error.value = String(err?.message || 'Failed to load applications')
      throw err
    } finally {
      isLoadingList.value = false
    }
  }

  async function loadApplicationDetail(applicationId: string) {
    isLoadingDetail.value = true
    error.value = null
    try {
      currentApplication.value = await getApplicationDetail(applicationId)
      const summaryIndex = applications.value.findIndex(app => app.id === applicationId)
      if (summaryIndex >= 0) {
        applications.value[summaryIndex] = {
          ...applications.value[summaryIndex],
          status: currentApplication.value.status,
          statusReason: currentApplication.value.statusReason,
          goalSummary: currentApplication.value.goalSummary,
          primaryProjectId: currentApplication.value.primaryProject?.id || null,
          primaryProjectName: currentApplication.value.primaryProject?.name || null,
          agentCount: currentApplication.value.agents.total,
          workflowEnabled: currentApplication.value.workflow.enabled,
          workflowName: currentApplication.value.workflow.name,
          hasPendingReview: currentApplication.value.run.hasPendingReview,
          hasActiveRun:
            currentApplication.value.run.status === 'running' ||
            currentApplication.value.run.status === 'paused',
          lastRunAt: currentApplication.value.run.startedAt,
          nextAction: currentApplication.value.nextAction,
        }
      }
      return currentApplication.value
    } catch (err: any) {
      error.value = String(err?.message || 'Failed to load application detail')
      throw err
    } finally {
      isLoadingDetail.value = false
    }
  }

  async function loadCreateOptions() {
    isLoadingCreateOptions.value = true
    error.value = null
    try {
      createOptions.value = await getApplicationCreateOptions()
      return createOptions.value
    } catch (err: any) {
      error.value = String(err?.message || 'Failed to load application create options')
      throw err
    } finally {
      isLoadingCreateOptions.value = false
    }
  }

  async function createNewApplication(input: ApplicationCreateInput) {
    isCreating.value = true
    error.value = null
    try {
      const result = await createApplication(input)
      await loadApplications()
      return result
    } catch (err: any) {
      error.value = String(err?.message || 'Failed to create application')
      throw err
    } finally {
      isCreating.value = false
    }
  }

  function setCurrentApplicationSection(section: ApplicationSectionKey) {
    currentSection.value = section
  }

  return {
    applications,
    currentApplication,
    currentSection,
    createOptions,
    isLoadingList,
    isLoadingDetail,
    isLoadingCreateOptions,
    isCreating,
    error,
    loadApplications,
    loadApplicationDetail,
    loadCreateOptions,
    createNewApplication,
    setCurrentApplicationSection,
  }
})
