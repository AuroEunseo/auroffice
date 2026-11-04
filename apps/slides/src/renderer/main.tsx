import React from 'react'
import { createRoot } from 'react-dom/client'
import { htmlDir, htmlLang, type Lang } from '@genoffice/i18n'
import { App } from './App'
import { AudienceView } from './components/AudienceView'
import { LocaleProvider, setModuleLang } from './i18n/locale'
import type { UiTheme } from '../shared/ipc'
import '@genoffice/ui/tokens.css'
import '@genoffice/ui/screentip.css'
import '@genoffice/ui/color-picker.css'
import '@genoffice/ui/dropdown.css'
import '@genoffice/ui/ribbon-collapse.css'
import '@genoffice/ui/markdown.css'
import './styles.css'
import { installScreenTips } from '@genoffice/ui'

// 미등록 IPC 또는 비동기 거부 에러 무시
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('ai:') || event.reason?.message?.includes('slidesApi')) {
      event.preventDefault()
    }
  })
}

// AI 질의/요청 트리거 버튼 더미 컴포넌트
const SafeDummyComponent: React.FC<any> = () => null
SafeDummyComponent.displayName = 'SafeDummyComponent'

export const AiAskTrigger: any = SafeDummyComponent
;(globalThis as any).AiAskTrigger = SafeDummyComponent

const dummyExtension = {
  name: 'StreamingTailGuardExtension',
  configure: () => dummyExtension,
}
;(globalThis as any).StreamingTailGuardExtension = dummyExtension

installScreenTips()

// Canvas fillText never triggers @font-face downloads, so the bundled document fonts
// (Carlito ↔ Calibri) must be loaded explicitly or Konva silently draws the fallback face.
for (const variant of ['', 'bold ', 'italic ', 'italic bold ']) {
  document.fonts?.load?.(`${variant}16px Carlito`).catch(() => {})
  document.fonts?.load?.(`${variant}16px 'Carlito GO'`).catch(() => {})
}

// ?mode=audience: the presenter view's external-screen audience show window (created by the main process)
const mode = new URLSearchParams(window.location.search).get('mode')

// macOS windows are created with vibrancy; let the thumbnail pane show it
// (the audience show window stays fully opaque)
if (mode !== 'audience' && navigator.platform.toLowerCase().includes('mac'))
  document.body.classList.add('vib')

function applyTheme(theme: UiTheme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

async function bootstrap(): Promise<void> {
  let lang: Lang = 'zh'
  let theme: UiTheme = 'system'
  const api = (window as any).slidesApi

  try {
    // per-promise catch: standalone runs have no app:get-theme handler, and
    // that rejection must not drop a resolved language
    if (api) {
      ;[lang, theme] = await Promise.all([
        api.getLanguage ? api.getLanguage().catch(() => 'zh' as const) : Promise.resolve('zh' as const),
        api.getTheme ? api.getTheme().catch(() => 'system' as const) : Promise.resolve('system' as const),
      ])
    }
  } catch {
    /* dev renderer without the preload bridge */
  }

  setModuleLang(lang)
  document.documentElement.lang = htmlLang(lang)
  document.documentElement.dir = htmlDir(lang)

  // the audience show window renders slide content only — it never themes
  if (mode !== 'audience') {
    applyTheme(theme)
    if (api?.onThemeChanged) {
      try {
        api.onThemeChanged(applyTheme)
      } catch {
        /* 무시 */
      }
    }
  }

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LocaleProvider initial={lang}>
        {mode === 'audience' ? <AudienceView /> : <App />}
      </LocaleProvider>
    </React.StrictMode>,
  )
}

void bootstrap()