/**
 * Markdown composable
 * Provides markdown rendering functionality
 */

import { computed } from 'vue'
import markdownit from 'markdown-it'
import type { Ref } from 'vue'
// oxlint-disable-next-line no-unused-vars
import hljs from 'highlight.js'
import markdownItHighlightjs from 'markdown-it-highlightjs'
import MarkdownItCopyCode from 'markdown-it-copy-code'

// import CopyButtonPlugin from 'highlightjs-copy'

// hljs.addPlugin(new CopyButtonPlugin())
// const md = markdownit().use(markdownItHighlightjs)
const md = markdownit({
  html: false, // Disable raw HTML to prevent XSS when rendering with v-html
  linkify: true,
})
  .use(markdownItHighlightjs)
  .use(MarkdownItCopyCode, {
    // if you want use default config, just ignore options below.
    // below shows default options
    // containerClass: 'markdown-copy-code-container',
    // buttonClass: 'markdown-copy-code-button',
    // copySVGClass: 'markdown-copy-code-copy',
    // doneSVGClass: 'markdown-copy-code-done',
    // default is hugeicons:task-01
    // copySVG: '<svg>...</svg>',
    // default is hugeicons:task-done-01
    // doneSVG: '<svg>...</svg>',
    // displayDuration: 2000,
  })

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
