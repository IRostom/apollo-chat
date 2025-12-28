import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('conversations route is accessible', async (t) => {
  const request = build(t)

  const res = await request.get('/conversations')

  assert.strictEqual(res.status, 200)
  assert.ok(Array.isArray(res.body))
})
