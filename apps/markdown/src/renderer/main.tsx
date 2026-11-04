import { createRoot } from 'react-dom/client'
import { htmlDir, htmlLang, type Lang } from '@genoffice/i18n'
import App from './App'
import { LocaleProvider } from './i18n/locale'
import type { DocTheme, UiTheme } from '../shared/ipc'
import '@genoffice/ui/tokens.css'
import '@genoffice/ui/screentip.css'
import '@genoffice/ui/dropdown.css'
import '@genoffice/ui/find-panel.css'
import '@genoffice/ui/ribbon-collapse.css'
import '@genoffice/ui/markdown.css'
import '@genoffice/ui/image-viewer.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import './markdown-themes.css'
import { installScreenTips } from '@genoffice/ui'
import type { MarkdownTheme } from '../shared/markdown-theme'

// AI 모듈이 제거된 빌드에서 전역 참조가 남아 있어도 터지지 않도록 하는 더미
const dummyExtension = {
  name: 'StreamingTailGuardExtension',
  configure: () => dummyExtension,
}
;(globalThis as any).StreamingTailGuardExtension = dummyExtension

try {
  installScreenTips()
} catch (e) {
  console.warn('[main] installScreenTips failed', e)
}

function applyTheme(theme: UiTheme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

function applyMarkdownTheme(theme: MarkdownTheme): void {
  // a picked paper theme overrides the light/dark document theme for the paper
  if (!theme || theme === 'default') document.documentElement.removeAttribute('data-markdown-theme')
  else document.documentElement.setAttribute('data-markdown-theme', theme)
}

function applyDocumentTheme(theme: DocTheme): void {
  // data-doc-theme drives the preview paper (genoffice#1811); absent means 'follow' the UI theme
  if (!theme || theme === 'follow') document.documentElement.removeAttribute('data-doc-theme')
  else document.documentElement.setAttribute('data-doc-theme', theme)
}

/** preload API 호출이 실패(미정의/거부)해도 부트스트랩이 멈추지 않게 fallback 반환 */
async function safe<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return (await fn()) ?? fallback
  } catch {
    return fallback
  }
}

void (async () => {
  const [lang, theme, docTheme, mdTheme] = await Promise.all([
    safe<Lang>(() => window.markdownApi.getLanguage() as Promise<Lang>, 'zh' as Lang),
    safe<UiTheme>(() => window.markdownApi.getTheme(), 'system'),
    safe<DocTheme>(() => window.markdownApi.getDocumentTheme!(), 'follow'),
    safe<MarkdownTheme>(() => window.markdownApi.getMarkdownTheme!(), 'default'),
  ])
  document.documentElement.lang = htmlLang(lang)
  document.documentElement.dir = htmlDir(lang)
  applyTheme(theme)
  applyDocumentTheme(docTheme)
  applyMarkdownTheme(mdTheme)
  try {
    window.markdownApi.onThemeChanged(applyTheme)
    window.markdownApi.onDocumentThemeChanged?.(applyDocumentTheme)
  } catch (e) {
    console.warn('[main] theme listeners failed', e)
  }

  createRoot(document.getElementById('root')!).render(
    <LocaleProvider initial={lang}>
      <App />
    </LocaleProvider>,
  )
})()
