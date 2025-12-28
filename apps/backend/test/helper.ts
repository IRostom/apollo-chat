// This file contains code that we reuse between our tests.
import * as test from 'node:test'
import app from '../src/app'
import request from 'supertest'

export type TestContext = {
  after: typeof test.after
}

// Build and return the Express app wrapped with supertest
function build (t: TestContext) {
  // Return supertest request function for the app
  return request(app)
}

export {
  build
}
