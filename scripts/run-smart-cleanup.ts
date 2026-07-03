import { smartCloneCleanup } from '../packages/server/src/services/hermes/profile-credentials'

for (const name of ['default', 'localhost-deepseek', 'qwen']) {
  const result = smartCloneCleanup(name)
  console.log(JSON.stringify({ name, ...result }))
}
