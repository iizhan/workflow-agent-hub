import Router from '@koa/router'
import { projectService, type ProjectPermissionConfig } from '../../services/hermes/project'

export const projectRoutes = new Router()

function handleProjectError(ctx: any, err: any) {
    const message = String(err?.message || 'Project operation failed')
    if (/not found/i.test(message)) {
        ctx.status = 404
    } else if (/required|absolute path|escapes project root|must be/i.test(message)) {
        ctx.status = 400
    } else {
        ctx.status = 500
    }
    ctx.body = { error: message }
}

projectRoutes.post('/api/hermes/projects/local-bind', async (ctx) => {
    try {
        const { name, description, localPath, roomId, permissions } = ctx.request.body as {
            name?: string
            description?: string
            localPath?: string
            roomId?: string
            permissions?: ProjectPermissionConfig
        }
        const result = projectService.bindLocalProject({
            name,
            description,
            localPath: String(localPath || ''),
            roomId,
            permissions,
        })
        ctx.body = result
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})

projectRoutes.get('/api/hermes/projects', async (ctx) => {
    ctx.body = { projects: projectService.listProjects() }
})

projectRoutes.get('/api/hermes/projects/:projectId', async (ctx) => {
    try {
        const project = projectService.getProject(ctx.params.projectId)
        if (!project) {
            ctx.status = 404
            ctx.body = { error: 'Project not found' }
            return
        }
        ctx.body = { project }
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})

projectRoutes.get('/api/hermes/projects/:projectId/files', async (ctx) => {
    try {
        const path = String(ctx.query.path || '')
        const entries = projectService.listProjectFiles(ctx.params.projectId, path)
        ctx.body = { entries, path }
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})

projectRoutes.get('/api/hermes/projects/:projectId/file-content', async (ctx) => {
    try {
        const path = String(ctx.query.path || '')
        ctx.body = projectService.readProjectFile(ctx.params.projectId, path)
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})

projectRoutes.get('/api/hermes/projects/:projectId/git/status', async (ctx) => {
    try {
        ctx.body = projectService.getProjectGitStatus(ctx.params.projectId)
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})

projectRoutes.get('/api/hermes/projects/:projectId/git/branches', async (ctx) => {
    try {
        ctx.body = projectService.getProjectGitBranches(ctx.params.projectId)
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})

projectRoutes.get('/api/hermes/projects/:projectId/git/diff', async (ctx) => {
    try {
        const path = String(ctx.query.path || '')
        ctx.body = projectService.getProjectGitDiff(ctx.params.projectId, path)
    } catch (err: any) {
        handleProjectError(ctx, err)
    }
})
