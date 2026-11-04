import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { DefaultAppStatus } from '../../shared/home-api'
import { AUTHOR_NAME_MAX } from '../../shared/home-api'
import type { UpdateUiState } from '../../shared/update-api'
import { useI18n } from './locale'
import type { StringKey } from './locale'
import type {
    AccountStatus,
    AuthorNameSetting,
    DocTheme,
    UiTheme,
} from '../../shared/home-api'
import './settings.css'

// 지원 언어 목록
const LANG_OPTIONS = [
    { value: 'ko', label: '한국어' },
] as const

// UI 테마
const THEME_OPTIONS = [
    { value: 'system', labelKey: 'themeSystem' },
    { value: 'light', labelKey: 'themeLight' },
    { value: 'dark', labelKey: 'themeDark' },
] as const satisfies readonly { value: UiTheme; labelKey: StringKey }[]

// 문서 본문 테마
const DOC_THEME_OPTIONS = [
    { value: 'follow', labelKey: 'docThemeFollowApp' },
    { value: 'light', labelKey: 'themeLight' },
    { value: 'dark', labelKey: 'themeDark' },
] as const satisfies readonly { value: DocTheme; labelKey: StringKey }[]

// 업데이트 채널
const CHANNEL_OPTIONS = [
    { value: 'stable', labelKey: 'channelStable' },
    { value: 'beta', labelKey: 'channelBeta' },
] as const satisfies readonly { value: 'stable' | 'beta'; labelKey: StringKey }[]

export type SectionId = 'account' | 'general' | 'about'

const SECTIONS: { id: SectionId; labelKey: StringKey }[] = [
    { id: 'account', labelKey: 'setSecAccount' },
    { id: 'general', labelKey: 'setSecGeneral' },
    { id: 'about', labelKey: 'setSecAbout' },
]

function formatStars(n: number): string {
    if (n < 1000) return String(n)
    const k = n / 1000
    return `${k >= 100 ? Math.round(k) : (Math.round(k * 10) / 10).toString().replace(/\.0$/, '')}k`
}

function Field({
    label,
    value,
    valueTitle,
    action,
}: {
    label: string
    value: string
    valueTitle?: string
    action?: ReactNode
}) {
    return (
        <div className="set-field">
            <div className="set-field-text">
                <div className="set-field-label">{label}</div>
                <div className="set-field-value" data-tip={valueTitle}>
                    {value}
                </div>
            </div>
            {action}
        </div>
    )
}

function SectionIcon({ id }: { id: SectionId }) {
    if (id === 'account') {
        return (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2 1H6a4 4 0 0 0-4 4v1h12v-1a4 4 0 0 0-4-4z" />
            </svg>
        )
    }
    if (id === 'about') {
        return (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm1 8H7v-4h2v4z" />
            </svg>
        )
    }
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 4.75A3.25 3.25 0 1 0 8 11.25 3.25 3.25 0 0 0 8 4.75zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z" />
        </svg>
    )
}

function Dropdown<T extends string>({
    className,
    value,
    ariaLabel,
    options,
    onPick,
}: {
    className?: string
    value: T
    ariaLabel?: string
    options: readonly { value: T; label: string }[]
    onPick: (val: T) => void
}) {
    return (
        <select
            className={className}
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => onPick(e.target.value as T)}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
}

export interface SettingsTarget {
    section: SectionId
}

export interface SettingsModalProps {
    status: AccountStatus | null
    loggingOut: boolean
    loginWaiting: boolean
    loginUrl: string | null
    urlCopied: boolean
    onOpenLoginUrl: () => void
    onCopyLoginUrl: () => void
    onClose: () => void
    onFileSearchChange?: () => void
    onLogin: () => void
    onLogout: () => void
    skillUpdateDue?: boolean
    onSkillUpdateDue?: (due: boolean) => void
    target?: SettingsTarget | null
}

export function SettingsModal({
    status,
    loggingOut,
    loginWaiting,
    loginUrl,
    urlCopied,
    onOpenLoginUrl,
    onCopyLoginUrl,
    onClose,
    onLogin,
    onLogout,
    target,
}: SettingsModalProps) {
    const { lang, setLang, t } = useI18n()
    const [section, setSection] = useState<SectionId>(target?.section ?? 'account')

    useEffect(() => {
        if (target?.section) setSection(target.section)
    }, [target])

    const [theme, setTheme] = useState<UiTheme>('system')
    const [docTheme, setDocTheme] = useState<DocTheme>('follow')
    const [saveDir, setSaveDir] = useState('')
    const [analyticsOn, setAnalyticsOn] = useState(true)
    const [analyticsSaving, setAnalyticsSaving] = useState(false)
    const [autoSaveOn, setAutoSaveOn] = useState(false)
    const [tabSleepOn, setTabSleepOn] = useState(true)
    const [restoreSessionOn, setRestoreSessionOn] = useState(false)
    const [autoUpdateCheckOn, setAutoUpdateCheckOn] = useState(true)
    const [defaultApp, setDefaultApp] = useState<DefaultAppStatus | null>(null)
    const [defaultAppBusy, setDefaultAppBusy] = useState(false)
    const [defaultAppFailed, setDefaultAppFailed] = useState(false)
    const [authorName, setAuthorName] = useState<AuthorNameSetting>({ value: '', fallback: '' })
    const [channel, setChannel] = useState<'stable' | 'beta'>('stable')
    const [appVersion, setAppVersion] = useState('')
    const [githubStars, setGithubStars] = useState<number | null>(null)
    const [updateState, setUpdateState] = useState<UpdateUiState | null>(null)

    useEffect(() => {
        let alive = true
        void (window as any).aiOffice?.getTheme?.().then((th: UiTheme) => {
            if (alive) setTheme(th)
        })
        void (window as any).aiOffice?.getDocumentTheme?.().then((th: DocTheme) => {
            if (alive) setDocTheme(th)
        })
        void (window as any).aiOffice?.getDefaultSaveDir?.().then((dir: string) => {
            if (alive && dir) setSaveDir(dir)
        })
        void (window as any).aiOffice?.getAnalyticsEnabled?.().then((on: boolean) => {
            if (alive) setAnalyticsOn(on !== false)
        })
        void (window as any).aiOffice?.getAutoSaveDefault?.().then((v: { on: boolean }) => {
            if (alive) setAutoSaveOn(v.on)
        })
        void (window as any).aiOffice?.getTabSleepEnabled?.().then((on: boolean) => {
            if (alive) setTabSleepOn(on)
        })
        void (window as any).aiOffice?.getRestoreLastSession?.().then((on: boolean) => {
            if (alive) setRestoreSessionOn(on)
        })
        void (window as any).aiOffice?.getDefaultAppStatus?.().then((st: DefaultAppStatus) => {
            if (alive) setDefaultApp(st)
        })
        void (window as any).aiOffice?.getAuthorName?.().then((v: AuthorNameSetting) => {
            if (alive) setAuthorName(v)
        })
        void (window as any).aiOffice?.getUpdateChannel?.().then((ch: 'stable' | 'beta') => {
            if (alive) setChannel(ch)
        })
        void (window as any).aiOffice?.getAutoUpdateCheck?.().then((on: boolean) => {
            if (alive) setAutoUpdateCheckOn(on)
        })
        void (window as any).aiOffice?.getAppVersion?.().then((v: string) => {
            if (alive && v) setAppVersion(v)
        })
        void (window as any).aiOffice
            ?.getUpdateState?.()
            .then((s: UpdateUiState) => {
                if (alive) setUpdateState(s)
            })
            .catch(() => undefined)
        void (window as any).aiOffice?.githubStars?.().then((n: number | null) => {
            if (alive && n !== null) setGithubStars(n)
        })
        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        const off = (window as any).aiOffice?.onUpdateStateChanged?.((s: UpdateUiState) => setUpdateState(s))
        return () => off?.()
    }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const applyTheme = (next: UiTheme) => {
        setTheme(next)
        void (window as any).aiOffice?.setTheme?.(next)
        if (next === 'system') document.documentElement.removeAttribute('data-theme')
        else document.documentElement.setAttribute('data-theme', next)
    }

    const applyDocumentTheme = (next: DocTheme) => {
        setDocTheme(next)
        void (window as any).aiOffice?.setDocumentTheme?.(next)
    }

    const commitAuthorName = () => {
        void (window as any).aiOffice?.setAuthorName?.(authorName.value).then(setAuthorName)
    }

    const changeSaveDir = () => {
        void (window as any).aiOffice?.pickDefaultSaveDir?.().then((dir: string | null) => {
            if (dir) setSaveDir(dir)
        })
    }

    useEffect(() => {
        if (!defaultApp?.manualOnly) return
        const refresh = () => {
            void (window as any).aiOffice?.getDefaultAppStatus?.().then(setDefaultApp)
        }
        window.addEventListener('focus', refresh)
        return () => window.removeEventListener('focus', refresh)
    }, [defaultApp?.manualOnly])

    const claimDefaultApp = () => {
        setDefaultAppBusy(true)
        setDefaultAppFailed(false)
        void (window as any).aiOffice
            ?.setDefaultApp?.()
            .then((st: DefaultAppStatus) => {
                setDefaultApp(st)
                if (!st.manualOnly && st.state !== 'default') setDefaultAppFailed(true)
            })
            .catch(() => setDefaultAppFailed(true))
            .finally(() => setDefaultAppBusy(false))
    }

    const defaultAppDesc = (() => {
        if (!defaultApp) return ''
        if (defaultAppFailed) return t('setDefaultAppFailed')
        if (defaultApp.state === 'default') return t('setDefaultAppIs')
        if (defaultApp.state === 'other' && defaultApp.others.length > 0)
            return t('setDefaultAppOther', { app: defaultApp.others.join(', ') })
        return t('setDefaultAppDesc')
    })()

    const loggedIn = status?.loggedIn ?? false
    const email = status?.email ?? ''

    return (
        <div
            className="set-overlay"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="set-dialog" role="dialog" aria-modal="true" aria-label={t('settings')}>
                <div className="set-header">
                    <h2 className="set-title">{t('settings')}</h2>
                    <button className="set-close" onClick={onClose} aria-label={t('cancel')}>
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                            <path
                                d="M2 2l10 10M12 2L2 12"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
                <div className="set-body">
                    <nav className="set-nav" aria-label={t('settings')}>
                        {SECTIONS.map((s) => (
                            <button
                                key={s.id}
                                className={`set-nav-item${section === s.id ? ' active' : ''}`}
                                aria-current={section === s.id}
                                onClick={() => setSection(s.id)}
                            >
                                <SectionIcon id={s.id} />
                                {t(s.labelKey)}
                            </button>
                        ))}
                    </nav>
                    <div className="set-pane">
                        {section === 'account' && (
                            <>
                                <h3 className="set-pane-title">{t('setSecAccount')}</h3>
                                <Field label={t('setEmail')} value={loggedIn ? email : t('setNotLoggedIn')} />
                                {loggedIn && (
                                    <Field
                                        label={t('credits')}
                                        value={
                                            status?.creditBalance === undefined
                                                ? '—'
                                                : Math.floor(status.creditBalance).toLocaleString('en-US')
                                        }
                                        action={
                                            <button
                                                className="set-btn"
                                                data-tip={t('creditsTip')}
                                                onClick={() => void (window as any).aiOffice?.openCreditUsage?.()}
                                            >
                                                {t('setViewUsage')}
                                            </button>
                                        }
                                    />
                                )}
                                <div className="set-pane-footer">
                                    {loggedIn ? (
                                        <button className="set-btn danger" disabled={loggingOut} onClick={onLogout}>
                                            {loggingOut ? t('loggingOut') : t('logout')}
                                        </button>
                                    ) : (
                                        <>
                                            {loginWaiting && loginUrl && (
                                                <>
                                                    <button className="set-btn" onClick={onOpenLoginUrl}>
                                                        {t('loginOpenManually')}
                                                    </button>
                                                    <button className="set-btn" onClick={onCopyLoginUrl}>
                                                        {urlCopied ? t('loginCopied') : t('loginCopyUrl')}
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {section === 'general' && (
                            <>
                                <h3 className="set-pane-title">{t('setSecGeneral')}</h3>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <label className="set-field-label">{t('language')}</label>
                                    </div>
                                    <Dropdown
                                        className="set-dd"
                                        value={lang}
                                        ariaLabel={t('language')}
                                        options={LANG_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                                        onPick={(v) => setLang(v as typeof lang)}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <label className="set-field-label">{t('theme')}</label>
                                    </div>
                                    <Dropdown
                                        className="set-dd"
                                        value={theme}
                                        ariaLabel={t('theme')}
                                        options={THEME_OPTIONS.map((opt) => ({
                                            value: opt.value,
                                            label: t(opt.labelKey),
                                        }))}
                                        onPick={(v) => applyTheme(v as UiTheme)}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <label className="set-field-label">{t('documentTheme')}</label>
                                    </div>
                                    <Dropdown
                                        className="set-dd"
                                        value={docTheme}
                                        ariaLabel={t('documentTheme')}
                                        options={DOC_THEME_OPTIONS.map((opt) => ({
                                            value: opt.value,
                                            label: t(opt.labelKey),
                                        }))}
                                        onPick={(v) => applyDocumentTheme(v as DocTheme)}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <div className="set-field-stack">
                                            <label className="set-field-label" htmlFor="set-author-name">
                                                {t('setAuthorName')}
                                            </label>
                                            <div className="set-field-desc">{t('setAuthorNameDesc')}</div>
                                        </div>
                                    </div>
                                    <input
                                        id="set-author-name"
                                        className="set-input"
                                        type="text"
                                        value={authorName.value}
                                        placeholder={authorName.fallback}
                                        maxLength={AUTHOR_NAME_MAX}
                                        spellCheck={false}
                                        autoComplete="off"
                                        onChange={(e) => setAuthorName((prev) => ({ ...prev, value: e.target.value }))}
                                        onBlur={commitAuthorName}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') e.currentTarget.blur()
                                        }}
                                    />
                                </div>
                                {defaultApp && defaultApp.state !== 'unsupported' && (
                                    <div className="set-field">
                                        <div className="set-field-text">
                                            <div className="set-field-stack">
                                                <div className="set-field-label">{t('setDefaultApp')}</div>
                                                <div className="set-field-desc">{defaultAppDesc}</div>
                                            </div>
                                        </div>
                                        <button
                                            className="set-btn"
                                            disabled={defaultAppBusy || defaultApp.state === 'default'}
                                            onClick={claimDefaultApp}
                                        >
                                            {defaultApp.manualOnly
                                                ? t('setDefaultAppOpenSettings')
                                                : t('setDefaultAppSet')}
                                        </button>
                                    </div>
                                )}
                                <Field
                                    label={t('saveLocation')}
                                    value={saveDir || '—'}
                                    valueTitle={saveDir}
                                    action={
                                        <button className="set-btn" onClick={changeSaveDir}>
                                            {t('setChange')}
                                        </button>
                                    }
                                />
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <div className="set-field-stack">
                                            <div className="set-field-label">{t('setAutoSave')}</div>
                                            <div className="set-field-desc">{t('setAutoSaveDesc')}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="set-switch"
                                        role="switch"
                                        aria-checked={autoSaveOn}
                                        aria-label={t('setAutoSave')}
                                        onClick={() => {
                                            const next = !autoSaveOn
                                            setAutoSaveOn(next)
                                            void (window as any).aiOffice?.setAutoSaveDefault?.(next).catch(() => { })
                                        }}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <div className="set-field-stack">
                                            <div className="set-field-label">{t('setRestoreSession')}</div>
                                            <div className="set-field-desc">{t('setRestoreSessionDesc')}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="set-switch"
                                        role="switch"
                                        aria-checked={restoreSessionOn}
                                        aria-label={t('setRestoreSession')}
                                        onClick={() => {
                                            const next = !restoreSessionOn
                                            setRestoreSessionOn(next)
                                            void (window as any).aiOffice?.setRestoreLastSession?.(next).catch(() => { })
                                        }}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <div className="set-field-stack">
                                            <div className="set-field-label">{t('setTabSleep')}</div>
                                            <div className="set-field-desc">{t('setTabSleepDesc')}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="set-switch"
                                        role="switch"
                                        aria-checked={tabSleepOn}
                                        aria-label={t('setTabSleep')}
                                        onClick={() => {
                                            const next = !tabSleepOn
                                            setTabSleepOn(next)
                                            void (window as any).aiOffice?.setTabSleepEnabled?.(next).catch(() => { })
                                        }}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <div className="set-field-stack">
                                            <div className="set-field-label">{t('setAnalytics')}</div>
                                            <div className="set-field-desc">{t('setAnalyticsDesc')}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="set-switch"
                                        role="switch"
                                        aria-checked={analyticsOn}
                                        aria-label={t('setAnalytics')}
                                        disabled={analyticsSaving}
                                        onClick={() => {
                                            const next = !analyticsOn
                                            setAnalyticsSaving(true)
                                            void (window as any).aiOffice
                                                ?.setAnalyticsEnabled?.(next)
                                                .then((persisted: boolean) => {
                                                    if (persisted) setAnalyticsOn(next)
                                                })
                                                .catch(() => { })
                                                .finally(() => setAnalyticsSaving(false))
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {section === 'about' && (
                            <>
                                <h3 className="set-pane-title">{t('setSecAbout')}</h3>
                                <Field label={t('versionLabel')} value={appVersion || '—'} />
                                {updateState && (
                                    <div className="set-field">
                                        <div className="set-field-text">
                                            <label className="set-field-label">{t('setUpdateAvailableLabel')}</label>
                                        </div>
                                        <button
                                            type="button"
                                            className="set-update-btn"
                                            onClick={() => void (window as any).aiOffice?.openUpdateDialog?.()}
                                        >
                                            {updateState.phase === 'downloading'
                                                ? t('setUpdateDownloading', {
                                                    percent: Math.round(updateState.percent),
                                                })
                                                : updateState.phase === 'downloaded'
                                                    ? t('setUpdateRestart')
                                                    : t('setUpdateTo', { version: updateState.version })}
                                        </button>
                                    </div>
                                )}
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <label className="set-field-label">{t('updateChannel')}</label>
                                    </div>
                                    <Dropdown
                                        className="set-dd"
                                        value={channel}
                                        ariaLabel={t('updateChannel')}
                                        options={CHANNEL_OPTIONS.map((opt) => ({
                                            value: opt.value,
                                            label: t(opt.labelKey),
                                        }))}
                                        onPick={(v) => {
                                            const next = v === 'beta' ? 'beta' : 'stable'
                                            setChannel(next)
                                            void (window as any).aiOffice?.setUpdateChannel?.(next)
                                        }}
                                    />
                                </div>
                                <div className="set-field">
                                    <div className="set-field-text">
                                        <div className="set-field-stack">
                                            <div className="set-field-label">{t('setAutoUpdateCheck')}</div>
                                            <div className="set-field-desc">{t('setAutoUpdateCheckDesc')}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="set-switch"
                                        role="switch"
                                        aria-checked={autoUpdateCheckOn}
                                        aria-label={t('setAutoUpdateCheck')}
                                        onClick={() => {
                                            const next = !autoUpdateCheckOn
                                            setAutoUpdateCheckOn(next)
                                            void (window as any).aiOffice?.setAutoUpdateCheck?.(next).catch(() => { })
                                        }}
                                    />
                                </div>
                                <Field
                                    label={t('setGithub')}
                                    value={
                                        githubStars === null
                                            ? 'github.com/genspark-ai/genoffice'
                                            : `github.com/genspark-ai/genoffice · ★ ${formatStars(githubStars)}`
                                    }
                                    action={
                                        <button
                                            className="set-btn"
                                            onClick={() => void (window as any).aiOffice?.openGitHubRepo?.()}
                                        >
                                            {t('starOnGitHub')}
                                        </button>
                                    }
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}