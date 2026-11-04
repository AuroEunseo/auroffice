import { createRoot } from 'react-dom/client'
import { htmlDir, htmlLang, type Lang } from '@genoffice/i18n'
import App from './App'
import { PresentView } from './PresentView'
import { LocaleProvider } from './i18n/locale'
import type { UiTheme } from '../shared/ipc'
import { installScreenTips } from '@genoffice/ui'
import '@genoffice/ui/tokens.css'
import '@genoffice/ui/screentip.css'
import '@genoffice/ui/dropdown.css'
import '@genoffice/ui/find-panel.css'
import '@genoffice/ui/color-picker.css'
import '@genoffice/ui/ribbon-collapse.css'
import '@genoffice/ui/image-dialogs.css'
import './styles.css'

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
    safe<Lang>(() => window.htmlApi.getLanguage() as Promise<Lang>, 'zh' as Lang),
    safe<UiTheme>(() => window.htmlApi.getTheme(), 'system'),
  ])
  document.documentElement.lang = htmlLang(lang)
  document.documentElement.dir = htmlDir(lang)
  applyTheme(theme)
  try {
    window.htmlApi.onThemeChanged(applyTheme)
  } catch (e) {
    console.warn('[main] onThemeChanged failed', e)
  }
  // a present tab/window (opened by Present → New tab) renders only its owner's preview
  const params = new URLSearchParams(location.search)
  const present = params.has('present')
  createRoot(document.getElementById('root')!).render(
    <LocaleProvider initial={lang}>
      {present ? <PresentView title={params.get('title') ?? ''} /> : <App />}
    </LocaleProvider>,
  )
})()
