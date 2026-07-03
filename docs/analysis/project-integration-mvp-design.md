# Hermes Group Chat Project Integration MVP Design

## Background

The current Hermes group chat experience already supports:

- room-based agent collaboration
- workflow templates and workflow execution
- workflow artifacts and artifact browsing
- system change notifications and change history

The next step is to let a workgroup collaborate around a real software project instead of only chat messages and artifact files.

This document defines the first-phase MVP for project integration.

## Goals

Enable a group chat room to bind one primary software project so that:

- the room has a persistent project context
- users can inspect project files and Git status
- workflow artifacts can be synchronized into the project directory
- future code-generation and Git operations have a stable foundation

## Scope

Phase 1 includes:

- bind an existing local project directory
- optionally associate the project with a room as its primary project
- inspect project metadata
- browse project files
- preview text file content
- inspect Git status and branches
- define room-to-project permissions
- prepare workflow artifact syncing into the project tree

Phase 1 excludes:

- remote Git clone
- commit and push actions
- push approval workflow
- PR / MR integration
- multi-project room orchestration
- full code editing from the UI

## Product Model

Three core concepts remain:

- Room: collaboration space and agent/workflow runtime
- Workflow: room execution model and artifact production rules
- Project: real codebase or document repository bound to a room

Relationship model for MVP:

- one room can bind one primary project
- one project may later be referenced by multiple rooms
- workflow artifacts may optionally be copied into the bound project

## Data Model

### gc_projects

Stores project metadata and local binding information.

Fields:

- id
- name
- description
- sourceType (`local`, `git-clone`, `archive`)
- localPath
- repoUrl
- defaultBranch
- currentBranch
- gitEnabled
- gitAuthType (`none`, `ssh`, `pat`)
- artifactRootMode (`external`, `project-relative`)
- artifactRootPath
- createdAt
- updatedAt

### gc_room_projects

Stores room-to-project binding and permission policy.

Fields:

- id
- roomId
- projectId
- isPrimary
- allowRead
- allowWrite
- allowCommit
- allowPush
- pushRequireApproval
- createdAt
- updatedAt

### gc_project_operation_logs

Stores auditable project operations.

Fields:

- id
- projectId
- roomId
- operatorType (`user`, `agent`, `system`)
- operatorName
- action (`bind`, `read`, `write`, `branch-switch`, `pull`, `commit`, `push-request`, `push-approved`, `push-rejected`)
- status
- summary
- payloadJson
- createdAt

## Backend Architecture

Introduce a dedicated project service:

- `packages/server/src/services/hermes/project/index.ts`

Responsibilities:

- validate and bind local project paths
- detect project and Git metadata
- list files safely within the project root
- read text file content safely
- inspect Git status and branches
- store and retrieve room-project binding data
- append operation logs

Project routes:

- `packages/server/src/routes/hermes/projects.ts`

Group chat room routes remain the integration point for room-level binding:

- `PUT /api/hermes/group-chat/rooms/:roomId/project`
- `GET /api/hermes/group-chat/rooms/:roomId/project`

## API Design

### Bind local project

`POST /api/hermes/projects/local-bind`

Request:

```json
{
  "name": "my-project",
  "description": "optional",
  "localPath": "/absolute/path",
  "roomId": "optional-room-id",
  "permissions": {
    "allowRead": true,
    "allowWrite": true,
    "allowCommit": false,
    "allowPush": false,
    "pushRequireApproval": true
  }
}
```

### Get project detail

`GET /api/hermes/projects/:projectId`

### List project files

`GET /api/hermes/projects/:projectId/files?path=`

### Get file content

`GET /api/hermes/projects/:projectId/file-content?path=`

### Get Git status

`GET /api/hermes/projects/:projectId/git/status`

### Get Git branches

`GET /api/hermes/projects/:projectId/git/branches`

### Bind primary project to room

`PUT /api/hermes/group-chat/rooms/:roomId/project`

### Get room primary project

`GET /api/hermes/group-chat/rooms/:roomId/project`

## Frontend Design

Extend the existing group chat header with a new action:

- `项目 / Project`

Open a project modal with these sections:

1. Project bind form
- local path
- project name
- optional description
- permission defaults

2. Project overview
- project name
- local path
- repository URL
- current branch
- default branch
- Git availability
- room permission summary

3. File browser
- folder listing
- file preview for text-based files

4. Git summary
- branch name
- staged / modified / untracked summary
- branch list

Frontend implementation stays within existing group chat modules:

- `packages/client/src/api/hermes/group-chat.ts`
- `packages/client/src/stores/hermes/group-chat.ts`
- `packages/client/src/components/hermes/group-chat/GroupChatPanel.vue`

## Workflow Integration

Phase 1 only supports document-like artifact synchronization into the project tree.

Node properties to support in later workflow configuration:

- writeToProject
- projectRelativePath

Immediate MVP behavior:

- if a room has a primary project
- and a workflow node is configured to sync artifacts
- then generated artifact files may be copied into the project path

Recommended initial preset mapping:

- PRD -> `docs/prd/prd.md`
- Architecture -> `docs/architecture/system-design.md`
- QA -> `reports/test/test-report.md`

## Permissions

Default role policy recommendation:

- Analyst / Designer / Architect / QA: read + write docs, no commit, no push
- Frontend / Backend developers: read + write, commit later, no push
- Admin: push approval authority

For Phase 1, permissions are persisted but only read/write visibility is used by the UI.

## Security Constraints

- only absolute local paths are accepted for project binding
- all file browsing must stay inside the project root
- no shell command may operate outside the project root
- Git inspection commands must be non-interactive
- secret material is out of scope for Phase 1

## Delivery Plan

### Phase 1A

- schema additions
- project service
- project routes
- room-project binding routes

### Phase 1B

- frontend project modal
- project overview
- file browser
- Git summary

### Phase 1C

- workflow artifact sync hooks
- preset workflow-to-project mappings

## Success Criteria

The MVP is complete when a user can:

- bind a local project to a room
- view room-bound project metadata
- browse project files and preview text files
- inspect Git status and branches
- use the room as the collaboration space around that project

