import { createRoot } from 'react-dom/client'
import { htmlDir, htmlLang, type Lang } from '@genoffice/i18n'
import App from './App'
import { LocaleProvider } from './i18n/locale'
import type { UiTheme } from '../shared/ipc'
import '@genoffice/ui/tokens.css'
import '@genoffice/ui/screentip.css'
import '@genoffice/ui/color-picker.css'
import '@genoffice/ui/dropdown.css'
import '@genoffice/ui/ribbon-collapse.css'
import '@genoffice/ui/markdown.css'
import './styles.css'
import { installScreenTips } from '@genoffice/ui'

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

/** preload API 호출이 실패(미정의/거부)해도 부트스트랩이 멈추지 않게 fallback 반환 */
async function safe<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return (await fn()) ?? fallback
  } catch {
    return fallback
  }
}

void (async () => {
  const [lang, theme] = await Promise.all([
    safe<Lang>(() => window.pdfApi.getLanguage() as Promise<Lang>, 'zh' as Lang),
    safe<UiTheme>(() => window.pdfApi.getTheme(), 'system'),
  ])
  document.documentElement.lang = htmlLang(lang)
  document.documentElement.dir = htmlDir(lang)
  applyTheme(theme)
  try {
    window.pdfApi.onThemeChanged(applyTheme)
  } catch (e) {
    console.warn('[main] onThemeChanged failed', e)
  }

  createRoot(document.getElementById('root')!).render(
    <LocaleProvider initial={lang}>
      <App />
    </LocaleProvider>,
  )
})()
