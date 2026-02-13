/**
 * Auth token provider for API requests.
 *
 * Stores a reference to Clerk's `getToken` Ref (initialized from a
 * Vue component via `useAuth()`), and exposes an `authFetch` wrapper that
 * attaches the Bearer token to every request.
 */

import type { Ref } from 'vue'

type GetTokenFn = (options?: { template?: string }) => Promise<string | null>

let _getToken: Ref<GetTokenFn | undefined> | null = null

/**
 * Call once from a Vue component's `<script setup>` to wire up the token provider.
 *
 * ```ts
 * const { getToken } = useAuth()
 * initAuthProvider(getToken)
 * ```
 */
export function initAuthProvider(getToken: Ref<GetTokenFn | undefined>) {
  _getToken = getToken
}

/**
 * Drop-in replacement for `fetch` that injects an `Authorization: Bearer <token>` header.
 * Falls back to a regular `fetch` if no auth provider has been initialized.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await _getToken?.value?.()
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(input, { ...init, headers })
}
