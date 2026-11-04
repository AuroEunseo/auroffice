import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { installDropOpenBridge } from '@genoffice/electron-utils/drop-open'
import type {
    AccountLoginEvent,
    AccountStatus,
    DefaultAppStatus,
    FolderListing,
    FolderRoot,
    MoveResult,
    AuthorNameSetting,
    HomeApi,
    RecentEntry,
    RecentPage,
    RenameResult,
    UiLanguage,
    FileSearchPage,
    FileSearchRerank,
    FileSearchSettings,
} from '../shared/home-api'
import { HOME_CHANNELS } from '../shared/home-api'
import { INTEGRATIONS_CHANNELS } from '../shared/integrations-api'
import type {
    IntegrationsApi,
    IntegrationsStatus,
} from '../shared/integrations-api'
import type { TabsApi, TabSummary } from '../shared/tabs-api'
import { TABS_CHANNELS } from '../shared/tabs-api'

type ProjectApi = any

function normalizeAiPanelPrefs(result: unknown): any {
    return result ?? {}
}

const UI_LANGUAGES: readonly UiLanguage[] = [
    'zh',
    'en',
    'ja',
    'ko',
    'fr',
    'de',
    'es',
    'th',
    'id',
    'ru',
    'ar',
    'pt',
    'it',
    'pl',
    'cs',
    'nl',
    'ms',
    'he',
    'hi',
    'zh-TW',
    'vi',
    'tr',
]

function isUiLanguage(value: unknown): value is UiLanguage {
    return UI_LANGUAGES.includes(value as UiLanguage)
}

const EMPTY_PAGE: RecentPage = { entries: [], total: 0, totalAll: 0 }

function asRecentPage(result: unknown): RecentPage {
    if (result && typeof result === 'object' && Array.isArray((result as RecentPage).entries)) {
        return result as RecentPage
    }
    return EMPTY_PAGE
}

const EMPTY_SEARCH: FileSearchPage = {
    hits: [],
    total: 0,
    index: { indexed: 0, pending: 0, scanning: false },
}

function asSearchPage(result: unknown): FileSearchPage {
    if (result && typeof result === 'object' && Array.isArray((result as FileSearchPage).hits)) {
        return result as FileSearchPage
    }
    return EMPTY_SEARCH
}

function normalizeDefaultAppStatus(result: unknown): DefaultAppStatus {
    const r = (result ?? {}) as Partial<DefaultAppStatus>
    const state = r.state
    return {
        state: state === 'default' || state === 'other' || state === 'unknown' ? state : 'unsupported',
        others: Array.isArray(r.others) ? r.others.filter((x) => typeof x === 'string') : [],
        manualOnly: r.manualOnly === true,
    }
}

function normalizeAuthorNameSetting(result: unknown): AuthorNameSetting {
    const r = (result ?? {}) as Partial<AuthorNameSetting>
    return {
        value: typeof r.value === 'string' ? r.value : '',
        fallback: typeof r.fallback === 'string' ? r.fallback : '',
    }
}

// a Settings request (menu click, Cmd+,) can land before Home has subscribed
const pendingOpenSettings: Array<{ section: string }> = []
ipcRenderer.on(HOME_CHANNELS.openSettings, (_event, target: { section: string }) => {
    if (ipcRenderer.listenerCount(HOME_CHANNELS.openSettings) === 1) pendingOpenSettings.push(target)
})

const homeApi: HomeApi = {
    async recents(query) {
        return asRecentPage(await ipcRenderer.invoke(HOME_CHANNELS.recents, query))
    },
    async searchFiles(query) {
        return asSearchPage(await ipcRenderer.invoke(HOME_CHANNELS.searchFiles, query))
    },
    async rerankSearch(query) {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.rerankSearch, query)
        return result && typeof result === 'object' && Array.isArray((result as FileSearchRerank).order)
            ? (result as FileSearchRerank)
            : null
    },
    async getFileSearchSettings() {
        return (await ipcRenderer.invoke(HOME_CHANNELS.getFileSearchSettings)) as FileSearchSettings
    },
    async setFileSearchSettings(patch) {
        return (await ipcRenderer.invoke(
            HOME_CHANNELS.setFileSearchSettings,
            patch,
        )) as FileSearchSettings
    },
    async testFileSearchRerank(input) {
        const raw = ((await ipcRenderer.invoke(HOME_CHANNELS.testFileSearchRerank, input)) ?? {}) as {
            ok?: unknown
            error?: unknown
        }
        return raw.ok === true
            ? { ok: true }
            : { ok: false, error: typeof raw.error === 'string' ? raw.error : 'Connection failed' }
    },
    async starred(query) {
        return asRecentPage(await ipcRenderer.invoke(HOME_CHANNELS.starred, query))
    },
    async starredGroups() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.starredGroups)
        return Array.isArray(result) ? result.filter((g): g is string => typeof g === 'string') : []
    },
    async setStarredGroup(paths, group) {
        await ipcRenderer.invoke(HOME_CHANNELS.setStarredGroup, paths, group)
    },
    async statPaths(paths) {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.statPaths, paths)
        return Array.isArray(result) ? (result as RecentEntry[]) : []
    },
    async toggleStar(path) {
        if (typeof path !== 'string' || !path) throw new Error('Invalid path.')
        await ipcRenderer.invoke(HOME_CHANNELS.toggleStar, path)
    },
    async openHelp() {
        await ipcRenderer.invoke(HOME_CHANNELS.openHelp)
    },
    // knowledge-base ask panel (AI 의존성 제거 fallback)
    async kbList() {
        return []
    },
    async skillsList() {
        return []
    },
    async skillText(_name) {
        return ''
    },
    async openSkillsSettings() {
        // noop
    },
    async kbSearch(_query) {
        return []
    },
    async kbRead(_path, _offset) {
        return ''
    },
    async kbCreateDocument(_request) {
        return null
    },
    async kbCliContext(_sessionId) {
        return null
    },
    async kbRunCli(_sessionId, _request) {
        return null
    },
    async pickAttachments() {
        try {
            return await ipcRenderer.invoke('files:pick')
        } catch {
            return []
        }
    },
    async addAttachmentPaths(paths) {
        try {
            return await ipcRenderer.invoke('files:add', paths)
        } catch {
            return []
        }
    },
    async addPastedImage(data, ext) {
        try {
            return await ipcRenderer.invoke('files:add-pasted-image', data, ext)
        } catch {
            return null
        }
    },
    async readAttachment(path, offset, maxChars) {
        try {
            return await ipcRenderer.invoke('files:read', path, offset, maxChars)
        } catch {
            return ''
        }
    },
    async readAttachmentImage(path) {
        try {
            return await ipcRenderer.invoke('files:read-image', path)
        } catch {
            return ''
        }
    },
    async openPath(path) {
        if (typeof path !== 'string' || !path) throw new Error('Invalid path.')
        await ipcRenderer.invoke(HOME_CHANNELS.openPath, path)
    },
    async browse() {
        await ipcRenderer.invoke(HOME_CHANNELS.browse)
    },
    async newDoc(opts) {
        await ipcRenderer.invoke(HOME_CHANNELS.newDoc, opts)
    },
    async newSheet(opts) {
        await ipcRenderer.invoke(HOME_CHANNELS.newSheet, opts)
    },
    async newSlide(opts) {
        await ipcRenderer.invoke(HOME_CHANNELS.newSlide, opts)
    },
    async newMarkdown(opts) {
        await ipcRenderer.invoke(HOME_CHANNELS.newMarkdown, opts)
    },
    async newHtml(opts) {
        await ipcRenderer.invoke(HOME_CHANNELS.newHtml, opts)
    },
    async newPdf(opts) {
        await ipcRenderer.invoke(HOME_CHANNELS.newPdf, opts)
    },
    async removeRecent(paths) {
        await ipcRenderer.invoke(HOME_CHANNELS.removeRecent, paths)
    },
    async unstarPaths(paths) {
        await ipcRenderer.invoke(HOME_CHANNELS.unstarPaths, paths)
    },
    async revealPath(path) {
        if (typeof path !== 'string' || !path) throw new Error('Invalid path.')
        await ipcRenderer.invoke(HOME_CHANNELS.revealPath, path)
    },
    async renameFile(path, newName) {
        if (typeof path !== 'string' || !path) throw new Error('Invalid path.')
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.renameFile, path, newName)
        return (result ?? { ok: false, error: 'Rename failed' }) as RenameResult
    },
    async duplicateFile(path) {
        if (typeof path !== 'string' || !path) throw new Error('Invalid path.')
        await ipcRenderer.invoke(HOME_CHANNELS.duplicateFile, path)
    },
    async deleteFiles(paths) {
        await ipcRenderer.invoke(HOME_CHANNELS.deleteFiles, paths)
    },
    async folderRoots() {
        return (await ipcRenderer.invoke(HOME_CHANNELS.folderRoots)) as FolderRoot[]
    },
    async addFolderRoot() {
        return (await ipcRenderer.invoke(HOME_CHANNELS.addFolderRoot)) as FolderRoot | null
    },
    async dropFolderRoots(paths) {
        return (await ipcRenderer.invoke(HOME_CHANNELS.dropFolderRoots, paths)) as FolderRoot[]
    },
    async removeFolderRoot(path) {
        await ipcRenderer.invoke(HOME_CHANNELS.removeFolderRoot, path)
    },
    pathForFile(file) {
        return webUtils.getPathForFile(file)
    },
    async listFolder(dir) {
        return (await ipcRenderer.invoke(HOME_CHANNELS.listFolder, dir)) as FolderListing
    },
    async createFolder(parent, name) {
        return (await ipcRenderer.invoke(HOME_CHANNELS.createFolder, parent, name)) as RenameResult
    },
    async renameFolder(dir, newName) {
        return (await ipcRenderer.invoke(HOME_CHANNELS.renameFolder, dir, newName)) as RenameResult
    },
    async movePaths(paths, targetDir, onConflict) {
        return (await ipcRenderer.invoke(
            HOME_CHANNELS.movePaths,
            paths,
            targetDir,
            onConflict,
        )) as MoveResult
    },
    async deleteFolder(dir) {
        await ipcRenderer.invoke(HOME_CHANNELS.deleteFolder, dir)
    },
    onFolderChanged(handler) {
        const listener = (_event: IpcRendererEvent, dirs: unknown) => {
            if (Array.isArray(dirs)) handler(dirs.filter((d): d is string => typeof d === 'string'))
        }
        ipcRenderer.on(HOME_CHANNELS.folderChanged, listener)
        return () => ipcRenderer.removeListener(HOME_CHANNELS.folderChanged, listener)
    },
    async openTrash() {
        await ipcRenderer.invoke(HOME_CHANNELS.openTrash)
    },
    async getLanguage() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getLanguage)
        return isUiLanguage(result) ? result : 'zh'
    },
    async setLanguage(lang) {
        if (!isUiLanguage(lang)) throw new Error('Invalid language.')
        await ipcRenderer.invoke(HOME_CHANNELS.setLanguage, lang)
    },
    async getUpdateChannel() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getUpdateChannel)
        return result === 'beta' ? 'beta' : 'stable'
    },
    async setUpdateChannel(channel) {
        if (channel !== 'stable' && channel !== 'beta') throw new Error('Invalid update channel.')
        await ipcRenderer.invoke(HOME_CHANNELS.setUpdateChannel, channel)
    },
    async getAutoUpdateCheck() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getAutoUpdateCheck)
        return result !== false
    },
    async setAutoUpdateCheck(on) {
        if (typeof on !== 'boolean') throw new Error('Invalid update check setting.')
        await ipcRenderer.invoke(HOME_CHANNELS.setAutoUpdateCheck, on)
    },
    async accountStatus() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.accountStatus)
        return (result ?? { loggedIn: false }) as AccountStatus
    },
    async accountLogin() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.accountLogin)
        return result === true
    },
    onOpenSettings(handler) {
        const listener = (_event: IpcRendererEvent, target: { section: string }) => handler(target)
        ipcRenderer.on(HOME_CHANNELS.openSettings, listener)
        for (const target of pendingOpenSettings.splice(0)) handler(target)
        return () => ipcRenderer.removeListener(HOME_CHANNELS.openSettings, listener)
    },
    onAccountLogin(handler) {
        const listener = (_event: IpcRendererEvent, ev: AccountLoginEvent) => handler(ev)
        ipcRenderer.on(HOME_CHANNELS.accountLoginEvent, listener)
        return () => ipcRenderer.removeListener(HOME_CHANNELS.accountLoginEvent, listener)
    },
    async openLoginUrl() {
        await ipcRenderer.invoke(HOME_CHANNELS.accountLoginOpenUrl)
    },
    async getAppVersion() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getAppVersion)
        return typeof result === 'string' ? result : ''
    },
    async openUpdateDialog() {
        const result: unknown = await ipcRenderer.invoke('update:open-for-update')
        return result === true
    },
    onUpdateStateChanged(handler: (state: any) => void) {
        const listener = (_e: IpcRendererEvent, state: any) => handler(state)
        ipcRenderer.on('update:state-changed', listener)
        return () => ipcRenderer.removeListener('update:state-changed', listener)
    },
    async onboardingSeen() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.onboardingSeen)
        return result === true
    },
    async setOnboardingSeen() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.setOnboardingSeen)
        return result === true
    },
    async getTheme() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getTheme)
        return result === 'dark' || result === 'light' ? result : 'system'
    },
    async setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark' && theme !== 'system')
            throw new Error('Invalid theme.')
        await ipcRenderer.invoke(HOME_CHANNELS.setTheme, theme)
    },
    async getDocumentTheme() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getDocumentTheme)
        return result === 'dark' || result === 'light' ? result : 'follow'
    },
    async setDocumentTheme(theme) {
        if (theme !== 'light' && theme !== 'dark' && theme !== 'follow')
            throw new Error('Invalid document theme.')
        await ipcRenderer.invoke(HOME_CHANNELS.setDocumentTheme, theme)
    },
    async getAutoSaveDefault() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getAutoSaveDefault)
        const r = result as { on?: unknown; updatedAt?: unknown } | null
        return {
            on: r?.on === true,
            updatedAt: typeof r?.updatedAt === 'number' ? r.updatedAt : 0,
        }
    },
    async getTabSleepEnabled() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getTabSleepEnabled)
        return result !== false
    },
    async setTabSleepEnabled(on) {
        if (typeof on !== 'boolean') throw new Error('Invalid tab sleep setting.')
        await ipcRenderer.invoke(HOME_CHANNELS.setTabSleepEnabled, on)
    },
    async getRestoreLastSession() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getRestoreLastSession)
        return result === true
    },
    async setRestoreLastSession(on) {
        if (typeof on !== 'boolean') throw new Error('Invalid restore session setting.')
        await ipcRenderer.invoke(HOME_CHANNELS.setRestoreLastSession, on)
    },
    async setAutoSaveDefault(on) {
        if (typeof on !== 'boolean') throw new Error('Invalid AutoSave default.')
        await ipcRenderer.invoke(HOME_CHANNELS.setAutoSaveDefault, on)
    },
    async getMcpStatus() {
        return {
            running: false,
            enabled: false,
            port: 3093,
            background: false,
            logging: false,
            url: null,
            capabilities: ['docs'],
        }
    },
    async setMcpSettings(_patch) {
        return {
            running: false,
            enabled: false,
            port: 3093,
            background: false,
            logging: false,
            url: null,
            capabilities: ['docs'],
        }
    },
    async getMcpLogs() {
        return []
    },
    async clearMcpLogs() { },
    async openMcpLogFile() { },
    async getAnalyticsEnabled() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getAnalyticsEnabled)
        return result !== false
    },
    async setAnalyticsEnabled(enabled) {
        if (typeof enabled !== 'boolean') throw new Error('Invalid analytics consent.')
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.setAnalyticsEnabled, enabled)
        return result === true
    },
    async getAuthorName() {
        return normalizeAuthorNameSetting(await ipcRenderer.invoke(HOME_CHANNELS.getAuthorName))
    },
    async setAuthorName(value) {
        return normalizeAuthorNameSetting(await ipcRenderer.invoke(HOME_CHANNELS.setAuthorName, value))
    },
    async getAiPanelPrefs() {
        return normalizeAiPanelPrefs(await ipcRenderer.invoke(HOME_CHANNELS.getAiPanelPrefs))
    },
    async setAiPanelPrefs(patch) {
        return normalizeAiPanelPrefs(await ipcRenderer.invoke(HOME_CHANNELS.setAiPanelPrefs, patch))
    },
    async getDefaultSaveDir() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.getDefaultSaveDir)
        return typeof result === 'string' ? result : ''
    },
    async getDefaultAppStatus() {
        return normalizeDefaultAppStatus(await ipcRenderer.invoke(HOME_CHANNELS.getDefaultAppStatus))
    },
    async setDefaultApp() {
        return normalizeDefaultAppStatus(await ipcRenderer.invoke(HOME_CHANNELS.setDefaultApp))
    },
    async pickDefaultSaveDir() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.pickDefaultSaveDir)
        return typeof result === 'string' && result ? result : null
    },
    onThemeChanged(handler) {
        const listener = (_event: Electron.IpcRendererEvent, theme: unknown) => {
            if (theme === 'light' || theme === 'dark' || theme === 'system') handler(theme)
        }
        ipcRenderer.on('app:theme-changed', listener)
        return () => ipcRenderer.removeListener('app:theme-changed', listener)
    },
    onDocumentThemeChanged(handler) {
        const listener = (_event: Electron.IpcRendererEvent, theme: unknown) => {
            if (theme === 'light' || theme === 'dark' || theme === 'follow') handler(theme)
        }
        ipcRenderer.on('app:document-theme-changed', listener)
        return () => ipcRenderer.removeListener('app:document-theme-changed', listener)
    },
    async openGenTeam() {
        await ipcRenderer.invoke(HOME_CHANNELS.openGenTeam)
    },
    async openCreditUsage() {
        await ipcRenderer.invoke(HOME_CHANNELS.openCreditUsage)
    },
    async openGitHubRepo() {
        await ipcRenderer.invoke(HOME_CHANNELS.openGitHubRepo)
    },
    async githubStars() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.githubStars)
        return typeof result === 'number' && Number.isFinite(result) ? result : null
    },
    async starPromptShouldShow() {
        const result: unknown = await ipcRenderer.invoke(HOME_CHANNELS.starPromptShouldShow)
        const raw = (result ?? {}) as { show?: unknown; docOpens?: unknown }
        return {
            show: raw.show === true,
            docOpens:
                typeof raw.docOpens === 'number' && Number.isFinite(raw.docOpens) ? raw.docOpens : 0,
        }
    },
    async starPromptAction(action) {
        if (action !== 'starred' && action !== 'later') throw new Error('Invalid star prompt action.')
        await ipcRenderer.invoke(HOME_CHANNELS.starPromptAction, action)
    },
    async cloudProjectsCached() {
        return null
    },
    async cloudProjectsSync() {
        return null
    },
    async openCloudProject(_projectUrl) { },
    onAiSettingsChanged(handler) {
        const listener = () => handler()
        ipcRenderer.on('ai:settings-changed', listener)
        return () => ipcRenderer.removeListener('ai:settings-changed', listener)
    },
    async getCodexModels(_cliPath) {
        return []
    },
    async getCustomModels(_baseUrl, _apiKey, _api) {
        return []
    },
    async testAiSettings(_settings) {
        return { ok: true }
    },
}

contextBridge.exposeInMainWorld('aiOffice', homeApi)

const aiNamingApi = {
    suggestFileName(_input: { content: string }) {
        return Promise.resolve(null)
    },
}

contextBridge.exposeInMainWorld('aiNamingApi', aiNamingApi)

const projectApi: ProjectApi = {
    resolveChat: () => Promise.resolve(null),
    appendChat: () => Promise.resolve(null),
    loadChat: () => Promise.resolve(null),
    rebindChat: () => Promise.resolve(null),
    listChats: () => Promise.resolve([]),
    deleteChat: () => Promise.resolve(null),
}

contextBridge.exposeInMainWorld('projectApi', projectApi)

const integrationsApi: IntegrationsApi = {
    async status() {
        try {
            return (await ipcRenderer.invoke(INTEGRATIONS_CHANNELS.status)) as IntegrationsStatus
        } catch {
            return {} as any
        }
    },
    async installSkill(_target) {
        return {} as any
    },
    async uninstallSkill(_agentId) {
        return {} as any
    },
    async pickSkillDir(_title) {
        return null
    },
    async saveSkillZip(_title) {
        return null
    },
    async copyText(text) {
        await ipcRenderer.invoke(INTEGRATIONS_CHANNELS.copyText, text)
    },
    async listSkills() {
        return []
    },
    async skillBody(_path) {
        return ''
    },
    async importSkillFolder(_title) {
        return null
    },
    async importSkillZip(_title) {
        return null
    },
    async listRecommendedSkills() {
        return []
    },
    async removeSkill(_name) { },
    async installRecommendedSkill(_name) {
        return {} as any
    },
}
contextBridge.exposeInMainWorld('aiOfficeIntegrations', integrationsApi)

const tabsApi: TabsApi = {
    async list() {
        const result: unknown = await ipcRenderer.invoke(TABS_CHANNELS.list)
        return Array.isArray(result) ? (result as TabSummary[]) : []
    },
    async activate(id) {
        await ipcRenderer.invoke(TABS_CHANNELS.activate, id)
    },
    async close(id) {
        await ipcRenderer.invoke(TABS_CHANNELS.close, id)
    },
    async showMenu(x, y) {
        await ipcRenderer.invoke(TABS_CHANNELS.showMenu, x, y)
    },
    async showNewMenu(x, y) {
        await ipcRenderer.invoke(TABS_CHANNELS.showNewMenu, x, y)
    },
    async showTabMenu(id, x, y) {
        await ipcRenderer.invoke(TABS_CHANNELS.showTabMenu, id, x, y)
    },
    async detach(id) {
        await ipcRenderer.invoke(TABS_CHANNELS.detach, id)
    },
    async tearOff(id, screenX, screenY) {
        const result: unknown = await ipcRenderer.invoke(TABS_CHANNELS.tearOff, id, screenX, screenY)
        return result === true
    },
    dragTornWindow(screenX, screenY) {
        ipcRenderer.send(TABS_CHANNELS.dragTornWindow, screenX, screenY)
    },
    async dockTornWindow(index) {
        await ipcRenderer.invoke(TABS_CHANNELS.dockTornWindow, index)
    },
    async endTornDrag() {
        await ipcRenderer.invoke(TABS_CHANNELS.endTornDrag)
    },
    onDockPreview(handler) {
        const listener = (_event: IpcRendererEvent, preview: { x: number } | null) =>
            handler(preview && typeof preview.x === 'number' ? { x: preview.x } : null)
        ipcRenderer.on(TABS_CHANNELS.dockPreview, listener)
        return () => ipcRenderer.removeListener(TABS_CHANNELS.dockPreview, listener)
    },
    reportDockIndex(index) {
        ipcRenderer.send(TABS_CHANNELS.dockIndex, index)
    },
    async showAppMenu(x, y) {
        await ipcRenderer.invoke(TABS_CHANNELS.showAppMenu, x, y)
    },
    async reorder(id, toIndex) {
        await ipcRenderer.invoke(TABS_CHANNELS.reorder, id, toIndex)
    },
    onChanged(handler) {
        const listener = (_event: IpcRendererEvent, tabs: TabSummary[]) => handler(tabs)
        ipcRenderer.on(TABS_CHANNELS.changed, listener)
        return () => ipcRenderer.removeListener(TABS_CHANNELS.changed, listener)
    },
    notifyChromePressed() {
        ipcRenderer.send(TABS_CHANNELS.chromePressed)
    },
    onChromePressed(handler) {
        const listener = () => handler()
        ipcRenderer.on('app:chrome-pressed', listener)
        return () => ipcRenderer.removeListener('app:chrome-pressed', listener)
    },
    onStartRename(handler) {
        const listener = (_event: IpcRendererEvent, id: unknown) => {
            if (typeof id === 'string') handler(id)
        }
        ipcRenderer.on(TABS_CHANNELS.startRename, listener)
        return () => ipcRenderer.removeListener(TABS_CHANNELS.startRename, listener)
    },
}

contextBridge.exposeInMainWorld('aiOfficeTabs', tabsApi)

// AI 기본 설정 및 세션 더미 객체
const defaultAiSettings = {
    provider: 'none',
    model: '',
    apiKey: '',
    enabled: false,
    temperature: 0,
}

// desktopApi 안전 객체 (IPC 차단 및 체이닝 방어)
const desktopApiBase: any = {
    aiGskStatus: async () => ({ loggedIn: false, user: null }),
    aiGetSettings: async () => defaultAiSettings,
    getAiSettings: async () => defaultAiSettings,
    aiGskLogin: async () => false,
    aiGskLogout: async () => true,
    ready: async () => ({}),

    // 직접 렌더러가 IPC를 호출할 경우 대비
    invoke: async (channel: string, ...args: any[]) => {
        if (channel === 'ai:gsk-status') return { loggedIn: false, user: null }
        if (channel === 'ai:get-settings') return defaultAiSettings
        if (channel.startsWith('ai:') || channel.startsWith('kb:')) return null
        return ipcRenderer.invoke(channel, ...args)
    },
    send: (channel: string, ...args: any[]) => {
        if (channel.startsWith('ai:') || channel.startsWith('kb:')) return
        ipcRenderer.send(channel, ...args)
    },
    on: (channel: string, listener: (...args: any[]) => void) => {
        if (channel.startsWith('ai:') || channel.startsWith('kb:')) return () => { }
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
    },
}

// 미정의 속성 및 Promise 체이닝(.catch, .then) 완전 대응 Proxy
const desktopApiProxy = new Proxy(desktopApiBase, {
    get(target, prop) {
        if (prop in target) {
            return target[prop]
        }
        if (prop === 'then') {
            return (resolve: any) => Promise.resolve(resolve(target))
        }
        if (prop === 'catch') {
            return () => Promise.resolve(target)
        }
        if (prop === 'finally') {
            return (cb: any) => {
                if (typeof cb === 'function') cb()
                return Promise.resolve(target)
            }
        }
        // 선언되지 않은 임의의 함수 호출 시 에러 방지용 더미 함수 반환
        return (..._args: any[]) => Promise.resolve({})
    },
})

contextBridge.exposeInMainWorld('desktopApi', desktopApiProxy)

// open documents dragged from the OS anywhere over Home or the tab strip
installDropOpenBridge()