/**
 * Markdown composable
 * Provides markdown rendering functionality
 */

import { computed } from 'vue'
import markdownit from 'markdown-it'
import type { Ref } from 'vue'

const md = markdownit()

/**
 * Convert markdown text to HTML
 */
export function useMarkdown(text: Ref<string> | string) {
  const html = computed(() => {
    const content = typeof text === 'string' ? text : text.value
    return md.render(content)
  })

  return {
    html,
  }
}

/**
 * Convert markdown text to HTML (one-time conversion)
 */
export function renderMarkdown(text: string): string {
  return md.render(text)
}

