import Router from '@koa/router'
import * as ctrl from '../../controllers/hermes/memory'

export const memoryRoutes = new Router()

memoryRoutes.get('/api/hermes/memory', ctrl.get)
memoryRoutes.get('/api/hermes/memory/policy', ctrl.policy)
memoryRoutes.get('/api/hermes/memory/entries', ctrl.listEntries)
memoryRoutes.post('/api/hermes/memory/entries/archive-expired', ctrl.archiveExpired)
memoryRoutes.post('/api/hermes/memory/entries/:id/archive', ctrl.archiveEntry)
memoryRoutes.post('/api/hermes/memory/entries/:id/restore', ctrl.restoreEntry)
memoryRoutes.post('/api/hermes/memory', ctrl.save)
