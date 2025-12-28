import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('default root route', async (t) => {
  const request = build(t)

  const res = await request.get('/')
  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(res.body, { root: true })
})
