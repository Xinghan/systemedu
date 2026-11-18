import test from 'node:test'
import { execFileSync } from 'node:child_process'

test('iOS media variants preserve legacy IDs, isolate draft previews, and require current acceptance evidence', () => {
  execFileSync('python3', ['tests/test_ios_media.py'], { encoding: 'utf8', stdio: 'pipe' })
})
