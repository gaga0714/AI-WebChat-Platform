<script setup>
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { ref, watch } from 'vue'

const props = defineProps({
  source: { type: String, default: '' },
  sanitize: { type: Boolean, default: true } // 生产环境建议默认 true
})

const md = new MarkdownIt({
  html: false,          // 生产环境建议关闭原始 HTML（更安全）
  linkify: true,
  breaks: true,
  highlight(str, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return `<pre><code class="hljs language-${lang}">` +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
      }
      return `<pre><code class="hljs">` +
        hljs.highlightAuto(str).value +
        '</code></pre>'
    } catch {
      return `<pre><code>${md.utils.escapeHtml(str)}</code></pre>`
    }
  }
})

const html = ref('')
watch(() => props.source, (v) => {
  const raw = md.render(v || '')
  html.value = props.sanitize ? DOMPurify.sanitize(raw) : raw
}, { immediate: true })
</script>

<template>
  <div v-html="html"></div>
</template>
