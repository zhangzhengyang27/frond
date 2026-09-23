<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <!-- ═══ 页头 ═══ -->
    <section class="mb-9">
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div class="flex items-center gap-3 p-4">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-500/20 bg-brand-500/10 text-fg-brand"
          >
            <AppIcon icon="search" :size="18" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-fg-primary">启动器</span>
              <UBadge variant="neutral">Alt + Space 唤起</UBadge>
            </div>
            <div class="mt-0.5 text-xs text-fg-tertiary">
              胶囊搜索窗：搜索应用 / Leaf 功能 / 插件命令，ESC 关闭
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 插件 ═══ -->
    <section class="mb-9">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xs font-medium tracking-wider text-fg-muted uppercase">已安装插件</h2>
        <UButton size="sm" variant="ghost" :loading="importing" @click="onImport">
          从文件夹导入
        </UButton>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div v-if="plugins.length === 0" class="p-8">
          <UEmpty
            title="还没有安装插件"
            description="插件是包含 plugin.json 的本地目录包，选择目录即可导入"
          >
            <template #action>
              <UButton size="sm" :loading="importing" @click="onImport">导入第一个插件</UButton>
            </template>
          </UEmpty>
        </div>
        <div v-else class="divide-y divide-line-subtle">
          <div v-for="p in plugins" :key="p.id" class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-md border border-line-subtle bg-surface-2 text-fg-tertiary"
              >
                <AppIcon icon="plug-2" :size="17" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium text-fg-primary">{{ p.name }}</span>
                  <span class="shrink-0 text-xs text-fg-faint">v{{ p.version ?? '—' }}</span>
                  <UBadge v-if="!p.enabled" variant="neutral">已停用</UBadge>
                </div>
                <div class="mt-0.5 truncate text-xs text-fg-tertiary">
                  {{ p.description || p.id }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <UButton
                  v-if="(p.preferences?.length ?? 0) > 0"
                  size="sm"
                  variant="ghost"
                  @click="togglePrefs(p.id)"
                >
                  设置
                </UButton>
                <UButton size="sm" variant="ghost" @click="onToggle(p)">
                  {{ p.enabled ? '停用' : '启用' }}
                </UButton>
                <UButton size="sm" variant="ghost" @click="onTryRun(p)">运行</UButton>
                <UButton size="sm" variant="danger" @click="onRemove(p)">卸载</UButton>
              </div>
            </div>
            <!-- M3.2 偏好表单（宿主按清单声明自动渲染） -->
            <div v-if="prefsOpen === p.id" class="mt-3 space-y-2 rounded-md bg-surface-0 p-3">
              <div
                v-for="pref in p.preferences ?? []"
                :key="pref.name"
                class="flex items-center gap-3"
              >
                <span class="w-28 shrink-0 text-xs text-fg-secondary">{{ pref.label }}</span>
                <select
                  v-if="pref.type === 'select'"
                  v-model="prefValues[p.id + '.' + pref.name]"
                  class="min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40"
                >
                  <option v-for="opt in pref.options ?? []" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
                <label
                  v-else-if="pref.type === 'checkbox'"
                  class="flex flex-1 items-center gap-2 text-xs text-fg-tertiary"
                >
                  <input
                    v-model="prefValues[p.id + '.' + pref.name]"
                    type="checkbox"
                    class="accent-brand-500"
                  />
                  启用
                </label>
                <input
                  v-else
                  v-model="prefValues[p.id + '.' + pref.name]"
                  class="min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40"
                  :placeholder="String(pref.default ?? '')"
                />
              </div>
              <div class="flex justify-end pt-1">
                <UButton size="sm" :loading="prefSaving" @click="savePrefs(p.id)">保存偏好</UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 插件市场（M3.5 静态市场 v0）═══ -->
    <section class="mb-9">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xs font-medium tracking-wider text-fg-muted uppercase">插件市场</h2>
        <div class="flex items-center gap-2">
          <span class="text-xs text-fg-faint">索引：仓库 plugins.json</span>
          <UButton size="sm" variant="ghost" :loading="marketLoading" @click="refreshMarket">
            刷新
          </UButton>
        </div>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div v-if="market.length === 0" class="p-6">
          <UEmpty title="市场索引为空" description="未找到 plugins.json 或索引中没有条目" />
        </div>
        <div v-else class="divide-y divide-line-subtle">
          <div v-for="entry in market" :key="entry.id" class="flex items-center gap-3 p-4">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-md border border-line-subtle bg-surface-2 text-fg-tertiary"
            >
              <AppIcon icon="store-2-line" :size="17" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-fg-primary">{{ entry.name }}</span>
                <span class="shrink-0 text-xs text-fg-faint">v{{ entry.version ?? '—' }}</span>
                <UBadge v-if="entry.installed && entry.updatable" variant="warning">
                  可更新 {{ entry.installedVersion }} → {{ entry.version }}
                </UBadge>
                <UBadge v-else-if="entry.installed" variant="neutral">已安装</UBadge>
              </div>
              <div class="mt-0.5 truncate text-xs text-fg-tertiary">
                {{ entry.description || entry.id }}
                <template v-if="entry.author"> · {{ entry.author }}</template>
              </div>
            </div>
            <UButton
              v-if="entry.installed && entry.updatable"
              size="sm"
              :loading="installingId === entry.id"
              @click="onMarketUpdate(entry)"
            >
              更新
            </UButton>
            <UButton
              v-else
              size="sm"
              variant="ghost"
              :disabled="entry.installed"
              :loading="installingId === entry.id"
              @click="onMarketInstall(entry)"
            >
              {{ entry.installed ? '已安装' : '安装' }}
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Quicklinks（M2.3）═══ -->
    <section class="mb-9">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xs font-medium tracking-wider text-fg-muted uppercase">快捷链接</h2>
        <UButton size="sm" variant="ghost" @click="addQuicklink">添加</UButton>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div v-if="quicklinks.length === 0" class="p-6">
          <UEmpty
            title="还没有快捷链接"
            description="添加常用 URL（如 GitHub），在启动台里搜索即可一键打开"
          />
        </div>
        <div v-else class="divide-y divide-line-subtle">
          <div v-for="link in quicklinks" :key="link.id" class="flex items-center gap-2 p-3">
            <AppIcon icon="link" :size="15" class="shrink-0 text-fg-tertiary" />
            <input
              v-model="link.name"
              class="w-40 shrink-0 rounded-md border border-line-subtle bg-surface-0 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40"
              placeholder="名称"
            />
            <input
              v-model="link.url"
              class="min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-0 px-2.5 py-1.5 text-xs text-fg-primary outline-none focus:border-brand-500/40"
              placeholder="https://…（可含 {query} 占位符，如 github.com/search?q={query}）"
            />
            <UButton size="sm" variant="ghost" @click="removeQuicklink(link)">删除</UButton>
          </div>
        </div>
        <div v-if="quicklinks.length > 0" class="flex justify-end border-t border-line-subtle p-3">
          <UButton size="sm" :loading="qlSaving" @click="saveQuicklinks">保存</UButton>
        </div>
      </div>
    </section>

    <!-- ═══ 片段文本扩展（M5.1）═══ -->
    <section class="mb-9">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xs font-medium tracking-wider text-fg-muted uppercase">片段文本扩展</h2>
        <label class="flex cursor-pointer items-center gap-2 text-xs text-fg-secondary">
          <input v-model="expansionEnabled" type="checkbox" class="accent-brand-500" />
          {{ expansionEnabled ? '已开启' : '已关闭' }}
        </label>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div class="space-y-2 p-4">
          <p class="text-xs leading-relaxed text-fg-tertiary">
            在任意应用中键入片段的「触发词」再按空格 / 回车，自动展开为片段内容。
            触发词在片段编辑器顶部设置；macOS 需要「辅助功能」授权（监听与注入）。
          </p>
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs text-fg-faint">
              当前 {{ expansionTriggerCount }} 个触发词 · 全局监听{{
                expansionHookOk ? '正常' : '未就绪'
              }}
            </span>
            <div class="flex items-center gap-1">
              <UButton size="sm" variant="ghost" :loading="probing" @click="onProbePermission">
                权限诊断
              </UButton>
              <UButton v-if="probeFailed" size="sm" variant="ghost" @click="openA11ySettings">
                打开授权设置
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 快捷键（M4 + 两段式）═══ -->
    <section class="mb-9">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xs font-medium tracking-wider text-fg-muted uppercase">快捷键</h2>
        <span class="text-xs text-fg-faint">录制组合键需含修饰键；字母框 = 两段式直达</span>
      </div>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <!-- 主热键 -->
        <div class="flex items-center gap-3 border-b border-line-subtle p-4">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-500/20 bg-brand-500/10 text-fg-brand"
          >
            <AppIcon icon="hotkey-line" :size="17" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-fg-primary">启动台主热键</div>
            <div class="mt-0.5 text-xs text-fg-tertiary">全局唤起 / 收起胶囊搜索窗</div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors"
            :class="
              recording?.type === 'main'
                ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                : 'border-line-subtle bg-surface-0 text-fg-secondary hover:border-brand-500/40'
            "
            @click="startRecording('main')"
          >
            {{ recording?.type === 'main' ? '按下组合键…' : hotkeyConfig.main }}
          </button>
        </div>
        <!-- 截图热键（默认 ⌥⇧S；2026-09-23 起进可配置热键系统） -->
        <div class="flex items-center gap-3 border-b border-line-subtle p-4">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-500/20 bg-brand-500/10 text-fg-brand"
          >
            <AppIcon icon="crop-line" :size="17" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-fg-primary">截图热键</div>
            <div class="mt-0.5 text-xs text-fg-tertiary">
              {{ hotkeyConfig.screenshot ? '全局开始一次截图' : '已关闭（可用设置项重新绑定）' }}
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors"
            :class="
              recording?.type === 'screenshot'
                ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                : 'border-line-subtle bg-surface-0 text-fg-secondary hover:border-brand-500/40'
            "
            @click="startRecording('screenshot')"
          >
            {{
              recording?.type === 'screenshot' ? '按下组合键…' : hotkeyConfig.screenshot || '未设置'
            }}
          </button>
          <button
            v-if="hotkeyConfig.screenshot"
            type="button"
            class="shrink-0 rounded-md border border-line-subtle px-2 py-1.5 text-xs text-fg-tertiary transition-colors hover:border-danger/40 hover:text-danger"
            title="关闭截图热键"
            @click="clearScreenshotHotkey"
          >
            关闭
          </button>
        </div>
        <!-- 命令热键列表 -->
        <div class="max-h-72 divide-y divide-line-subtle overflow-y-auto">
          <div
            v-for="entry in hotkeyCommands"
            :key="entry.entry.key"
            class="flex items-center gap-3 px-4 py-2.5"
          >
            <AppIcon :icon="entry.entry.icon" :size="15" class="shrink-0 text-fg-tertiary" />
            <div class="min-w-0 flex-1">
              <span class="text-xs font-medium text-fg-primary">{{ entry.entry.title }}</span>
              <span class="ml-2 text-[10px] text-fg-faint">{{ entry.entry.subtitle }}</span>
            </div>
            <template v-if="entry.bound">
              <button
                v-for="accel in entry.bound"
                :key="accel"
                type="button"
                class="shrink-0 rounded border border-line-subtle bg-surface-0 px-2 py-0.5 font-mono text-[10px] text-fg-secondary hover:border-danger/40 hover:text-danger"
                :title="'点击删除该绑定'"
                @click="removeCommandHotkey(accel)"
              >
                {{ accel }} ×
              </button>
            </template>
            <!-- 两段式直达字母：主热键后按住修饰键再按字母直达命令 -->
            <input
              :value="chordLetterOf(entry.entry)"
              class="w-8 shrink-0 rounded border border-line-subtle bg-surface-0 px-1.5 py-0.5 text-center font-mono text-[10px] text-fg-secondary outline-none focus:border-brand-500/40"
              maxlength="1"
              placeholder="—"
              title="两段式：主热键后按住修饰键不放再按此字母直达（留空清除）"
              @change="(e) => setChordLetter(entry.entry, (e.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              class="shrink-0 rounded-md border px-2.5 py-1 text-[10px] transition-colors"
              :class="
                recording?.type === 'command' && recording.key === entry.entry.key
                  ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                  : 'border-line-subtle bg-surface-0 text-fg-tertiary hover:border-brand-500/40'
              "
              @click="startRecording('command', entry.entry.key)"
            >
              {{
                recording?.type === 'command' && recording.key === entry.entry.key
                  ? '按下…'
                  : '绑热键'
              }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ WebDAV 同步 ═══ -->
    <section class="mb-9">
      <h2 class="mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase">
        WebDAV 同步（插件数据）
      </h2>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div class="space-y-2 p-4">
          <input
            v-model="syncForm.url"
            class="w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40"
            placeholder="WebDAV 地址（如 https://dav.example.com/dav）"
          />
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              v-model="syncForm.username"
              class="w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40"
              placeholder="用户名"
            />
            <input
              v-model="syncForm.password"
              type="password"
              class="w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40"
              placeholder="密码"
            />
          </div>
          <input
            v-model="syncForm.remoteDir"
            class="w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-xs text-fg-primary outline-none focus:border-brand-500/40"
            placeholder="远端目录（默认 /leaf-launcher）"
          />
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs text-fg-faint">
              备份内容为插件数据快照；插件本体需在各设备重新导入
            </span>
            <div class="flex items-center gap-1">
              <UButton size="sm" variant="ghost" :loading="syncTesting" @click="onSyncTest">
                测试连接
              </UButton>
              <UButton size="sm" variant="ghost" :loading="syncRestoring" @click="onSyncRestore">
                恢复
              </UButton>
              <UButton size="sm" :loading="syncBacking" @click="onSyncSaveAndBackup">
                保存并备份
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 开发 ═══ -->
    <section class="mb-9">
      <h2 class="mb-3 text-xs font-medium tracking-wider text-fg-muted uppercase">开发者</h2>
      <div class="rounded-md border border-line-subtle bg-surface-1 shadow-sm">
        <div class="divide-y divide-line-subtle">
          <!-- 热重载开发模式（对标 ray develop） -->
          <div>
            <div class="flex items-center gap-3 p-4">
              <AppIcon icon="flashlight-line" class="mt-0.5 shrink-0 text-info" :size="16" />
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-fg-primary">热重载开发模式</div>
                <div class="mt-0.5 text-xs text-fg-tertiary">
                  注册包含 plugin.json 的本地目录，保存文件自动重装并重载插件（300ms 防抖）
                </div>
              </div>
              <UButton size="sm" :loading="devAdding" @click="onAddDevPlugin">
                添加开发目录
              </UButton>
            </div>
            <div
              v-if="devPlugins.length > 0"
              class="divide-y divide-line-subtle border-t border-line-subtle"
            >
              <div v-for="d in devPlugins" :key="d.pluginId" class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="truncate text-xs font-medium text-fg-primary">
                        {{ d.name || d.pluginId }}
                      </span>
                      <span v-if="d.version" class="shrink-0 text-[10px] text-fg-faint">
                        v{{ d.version }}
                      </span>
                      <UBadge v-if="!d.sourceExists" variant="danger">目录缺失</UBadge>
                      <UBadge v-else-if="!d.manifestValid" variant="warning">
                        plugin.json 异常
                      </UBadge>
                      <UBadge v-if="!d.installed" variant="neutral">未安装</UBadge>
                    </div>
                    <div
                      class="mt-0.5 truncate font-mono text-[10px] text-fg-tertiary"
                      :title="d.sourceDir"
                    >
                      {{ d.sourceDir }}
                    </div>
                  </div>
                  <label
                    class="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-fg-secondary"
                  >
                    <input
                      type="checkbox"
                      :checked="d.autoReload"
                      class="accent-brand-500"
                      @change="onDevAutoReload(d, ($event.target as HTMLInputElement).checked)"
                    />
                    自动重载
                  </label>
                  <UButton
                    size="sm"
                    variant="ghost"
                    :loading="devReloadingId === d.pluginId"
                    @click="onDevReload(d)"
                  >
                    重载
                  </UButton>
                  <UButton size="sm" variant="ghost" @click="onDevRemove(d)">移除</UButton>
                </div>
              </div>
            </div>
            <div v-else class="border-t border-line-subtle px-4 py-3 text-xs text-fg-faint">
              还没有注册开发目录。选择仓库 example-plugin/ 试试：修改 index.html 保存后会自动重载。
            </div>
          </div>
          <div class="flex items-start gap-3 p-4">
            <AppIcon icon="code-s-slash-line" class="mt-0.5 shrink-0 text-info" :size="16" />
            <div class="min-w-0 flex-1 text-xs leading-relaxed text-fg-tertiary">
              插件 = 一个包含
              <code class="rounded bg-surface-2 px-1 py-0.5 text-fg-primary">plugin.json</code>
              的目录（声明 id / 名称 / 入口页 / 命令），页面里通过
              <code class="rounded bg-surface-2 px-1 py-0.5 text-fg-primary"
                >window.launcherApi</code
              >
              调用受控 API（通知、剪贴板、副输入框、数据存储等）。参考仓库
              <code class="rounded bg-surface-2 px-1 py-0.5 text-fg-primary">example-plugin/</code>
              与
              <code class="rounded bg-surface-2 px-1 py-0.5">docs/modules/10-launcher.md</code>。
            </div>
          </div>
          <div class="flex items-center gap-3 p-4">
            <AppIcon icon="folder-2-line" class="mt-0.5 shrink-0 text-info" :size="16" />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium text-fg-primary">插件数据目录</div>
              <div class="mt-0.5 text-xs text-fg-tertiary">已安装插件与索引的存放位置</div>
            </div>
            <UButton size="sm" variant="ghost" @click="openPluginsDir()">打开</UButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UBadge from '@components/ui/UBadge.vue'
import UButton from '@components/ui/UButton.vue'
import UEmpty from '@components/ui/UEmpty.vue'
import { useToast } from '@composables/useToast'
import { builtinStaticRows } from '@renderer/commands/BuiltinCommandProvider'
import type { CommandHotkeySpec } from '@preload/index.d'

interface LauncherPlugin {
  id: string
  name: string
  version?: string
  description?: string
  enabled: boolean
  commands?: Array<{ code: string; title: string; description?: string }>
  preferences?: Array<{
    name: string
    label: string
    type: 'text' | 'select' | 'checkbox'
    default?: string | boolean
    options?: string[]
  }>
}

const toast = useToast()
const plugins = ref<LauncherPlugin[]>([])
const importing = ref(false)

function openPluginsDir(): void {
  window.api.launcher.openPluginsDir()
}

async function refresh(): Promise<void> {
  try {
    plugins.value = await window.api.launcher.listPlugins()
  } catch {
    toast.error('读取插件列表失败')
  }
}

async function onImport(): Promise<void> {
  importing.value = true
  try {
    const picked = await window.api.launcher.selectPluginFolder()
    if (!picked.success || !picked.dirPath) return
    const result = await window.api.launcher.installFromFolder(picked.dirPath)
    if (result.success) {
      toast.success(`已导入 ${result.plugin?.name ?? '插件'}`)
      await refresh()
    } else {
      toast.error('导入失败', { description: result.error })
    }
  } catch (error) {
    toast.error('导入失败', { description: (error as Error).message })
  } finally {
    importing.value = false
  }
}

// ───── 插件市场（M3.5 静态市场 v0）─────
interface MarketEntry {
  id: string
  name: string
  version?: string
  description?: string
  author?: string
  download: string
  installed: boolean
  installedVersion?: string
  updatable: boolean
}

const market = ref<MarketEntry[]>([])
const marketLoading = ref(false)
const installingId = ref<string | null>(null)

async function refreshMarket(): Promise<void> {
  marketLoading.value = true
  try {
    market.value = await window.api.launcher.marketList()
  } catch {
    /* 索引读取失败保持空 */
  } finally {
    marketLoading.value = false
  }
}

async function onMarketInstall(entry: MarketEntry): Promise<void> {
  installingId.value = entry.id
  try {
    const result = await window.api.launcher.marketInstall(entry.id)
    if (result.success) {
      toast.success(`已安装 ${result.plugin?.name ?? entry.name}`)
      await Promise.all([refresh(), refreshMarket()])
    } else {
      toast.error('安装失败', { description: result.error })
    }
  } catch (error) {
    toast.error('安装失败', { description: (error as Error).message })
  } finally {
    installingId.value = null
  }
}

// ───── 开发者生态通道（launcher:devPlugins:* / launcher:market:update）─────
// 注意：这些方法需要配套的 preload 绑定（清单见 docs/PLUGIN_DEVELOPMENT.md「开发模式」）。
// 绑定就绪前 window.api.launcher 上不存在对应方法，这里统一 cast + 存在性守卫，
// 运行时行为与既有 window.api.launcher 方法完全一致
interface MarketUpdateResult {
  success: boolean
  error?: string
  plugin?: { id: string; name?: string; version?: string }
}

interface DevPluginRow {
  pluginId: string
  sourceDir: string
  autoReload: boolean
  name?: string
  version?: string
  installed: boolean
  sourceExists: boolean
  manifestValid: boolean
}

interface DevPluginsApi {
  devPluginsList: () => Promise<DevPluginRow[]>
  devPluginsAdd: (dir: string) => Promise<{
    ok: boolean
    error?: string
    plugin?: { id: string; name: string; version?: string }
  }>
  devPluginsRemove: (pluginId: string) => Promise<{ ok: boolean; error?: string }>
  devPluginsSetAutoReload: (
    pluginId: string,
    autoReload: boolean
  ) => Promise<{ ok: boolean; error?: string }>
  devPluginsReload: (pluginId: string) => Promise<{
    ok: boolean
    error?: string
    plugin?: { id: string; name: string; version?: string }
  }>
  marketUpdate: (entryId: string) => Promise<MarketUpdateResult>
  /** 主进程推送：watcher 自动重装结果（成功/失败），用于 toast 与列表刷新 */
  onDevPluginsChanged: (
    cb: (payload: {
      kind: 'added' | 'removed' | 'reloaded' | 'error'
      pluginId: string
      name?: string
      error?: string
    }) => void
  ) => () => void
}

/** devPlugins 绑定是否可用（旧 preload 上方法不存在 → 返回 null，界面降级为不可用） */
function devChannels(): DevPluginsApi | null {
  const api = window.api.launcher as unknown as Partial<DevPluginsApi>
  return typeof api.devPluginsList === 'function' ? (api as DevPluginsApi) : null
}

async function onMarketUpdate(entry: MarketEntry): Promise<void> {
  const api = devChannels()
  if (!api || typeof api.marketUpdate !== 'function') {
    toast.error('更新通道未就绪', { description: '需要包含 marketUpdate 绑定的 preload' })
    return
  }
  installingId.value = entry.id
  try {
    const result = await api.marketUpdate(entry.id)
    if (result.success) {
      toast.success(
        `已更新 ${result.plugin?.name ?? entry.name}` +
          (result.plugin?.version ? ` → v${result.plugin.version}` : '')
      )
      await Promise.all([refresh(), refreshMarket()])
    } else {
      toast.error('更新失败', { description: result.error })
    }
  } catch (error) {
    toast.error('更新失败', { description: (error as Error).message })
  } finally {
    installingId.value = null
  }
}

const devPlugins = ref<DevPluginRow[]>([])
const devAdding = ref(false)
const devReloadingId = ref<string | null>(null)
let offDevChanged: (() => void) | null = null

async function refreshDevPlugins(): Promise<void> {
  const api = devChannels()
  if (!api) return
  try {
    devPlugins.value = await api.devPluginsList()
  } catch {
    /* 读取失败保持空 */
  }
}

async function onAddDevPlugin(): Promise<void> {
  const api = devChannels()
  if (!api) {
    toast.error('开发者通道未就绪', { description: '需要包含 devPlugins 绑定的 preload' })
    return
  }
  devAdding.value = true
  try {
    // 目录选择复用管理页「从文件夹导入」的既有 dialog 通道
    const picked = await window.api.launcher.selectPluginFolder()
    if (!picked.success || !picked.dirPath) return
    const result = await api.devPluginsAdd(picked.dirPath)
    if (result.ok) {
      toast.success(`已注册开发目录：${result.plugin?.name ?? result.plugin?.id ?? ''}`)
      await Promise.all([refresh(), refreshDevPlugins(), refreshMarket()])
    } else {
      toast.error('注册失败', { description: result.error })
    }
  } catch (error) {
    toast.error('注册失败', { description: (error as Error).message })
  } finally {
    devAdding.value = false
  }
}

async function onDevAutoReload(d: DevPluginRow, autoReload: boolean): Promise<void> {
  const api = devChannels()
  if (!api) return
  const result = await api.devPluginsSetAutoReload(d.pluginId, autoReload)
  if (result.ok) {
    await refreshDevPlugins()
  } else {
    toast.error('设置失败', { description: result.error })
    await refreshDevPlugins()
  }
}

async function onDevReload(d: DevPluginRow): Promise<void> {
  const api = devChannels()
  if (!api) return
  devReloadingId.value = d.pluginId
  try {
    const result = await api.devPluginsReload(d.pluginId)
    if (result.ok) {
      toast.success(`已重载 ${result.plugin?.name ?? d.name ?? d.pluginId}`)
      await Promise.all([refresh(), refreshDevPlugins(), refreshMarket()])
    } else {
      toast.error('重载失败', { description: result.error })
    }
  } catch (error) {
    toast.error('重载失败', { description: (error as Error).message })
  } finally {
    devReloadingId.value = null
  }
}

async function onDevRemove(d: DevPluginRow): Promise<void> {
  const api = devChannels()
  if (!api) return
  // 语义：移除 = 解除开发跟踪（停 watcher + 删配置），插件本体保留已安装；
  // 需要卸载时用「已安装插件」区的卸载按钮
  const result = await api.devPluginsRemove(d.pluginId)
  if (result.ok) {
    toast.success(`已移除开发跟踪：${d.name || d.pluginId}（插件保留已安装）`)
    await refreshDevPlugins()
  } else {
    toast.error('移除失败', { description: result.error })
  }
}

// ───── 插件偏好（M3.2）─────
const prefsOpen = ref<string | null>(null)
const prefValues = ref<Record<string, string | boolean>>({})
const prefSaving = ref(false)

async function togglePrefs(pluginId: string): Promise<void> {
  if (prefsOpen.value === pluginId) {
    prefsOpen.value = null
    return
  }
  const plugin = plugins.value.find((p) => p.id === pluginId)
  if (!plugin) return
  // 展开时拉取当前值（默认值兜底）
  for (const pref of plugin.preferences ?? []) {
    const key = pluginId + '.' + pref.name
    try {
      const result = await window.api.launcher.getPreference(pluginId, pref.name)
      prefValues.value[key] = (result?.value ?? pref.default ?? '') as string | boolean
    } catch {
      prefValues.value[key] = (pref.default ?? '') as string | boolean
    }
  }
  prefsOpen.value = pluginId
}

async function savePrefs(pluginId: string): Promise<void> {
  prefSaving.value = true
  try {
    const plugin = plugins.value.find((p) => p.id === pluginId)
    if (!plugin) return
    for (const pref of plugin.preferences ?? []) {
      const key = pluginId + '.' + pref.name
      await window.api.launcher.setPreference(pluginId, pref.name, prefValues.value[key])
    }
    toast.success('偏好已保存')
  } catch {
    toast.error('偏好保存失败')
  } finally {
    prefSaving.value = false
  }
}

// ───── 快捷键（M4）─────
/** 形状就是桥上那一份（主进程按 kind 白名单校验），不再本地重定义 */
type HotkeySpec = CommandHotkeySpec

const hotkeyConfig = ref<{
  main: string
  screenshot: string
  commands: Record<string, HotkeySpec>
  chords?: Record<string, HotkeySpec>
}>({
  main: 'Alt+Space',
  screenshot: 'Alt+Shift+S',
  commands: {}
})
const recording = ref<{ type: 'main' | 'command' | 'screenshot'; key?: string } | null>(null)

/** 可绑热键的命令（静态命令注册表 → 热键 spec） */
function specOfCommand(entry: CommandEntryLike): HotkeySpec | null {
  const a = entry.action
  switch (a.type) {
    case 'module':
      return { kind: 'module', id: a.moduleId, path: a.path }
    case 'page':
      return { kind: 'module', id: a.pageId, path: a.path }
    case 'action':
      // 主进程没有 screenshot 这一档 hotkey（CommandHotkeySpec.kind 白名单里没有），
      // 以前这里造一个发过去只会被静默丢掉 —— 明说「不可绑」比假可绑好
      return null
    case 'system':
      return { kind: 'system', id: a.cmdId }
    case 'quicklink':
      return { kind: 'quicklink', url: a.url }
    case 'firstParty':
      return { kind: 'firstParty', id: a.page }
    default:
      return null
  }
}

interface CommandEntryLike {
  key: string
  icon: string
  title: string
  subtitle: string
  action: {
    type: string
    moduleId?: string
    path?: string
    pageId?: string
    cmdId?: string
    url?: string
    page?: string
    action?: string
  }
}

const hotkeyCommands = computed(() => {
  // P-7②：与 Registry 同一份定义（builtin provider），不再另抄一份静态清单
  const specs = builtinStaticRows() as unknown as CommandEntryLike[]
  return specs
    .map((entry) => {
      const spec = specOfCommand(entry)
      const bound = spec
        ? Object.entries(hotkeyConfig.value.commands)
            .filter(([, s]) => JSON.stringify(s) === JSON.stringify(spec))
            .map(([accel]) => accel)
        : []
      return { entry, spec, bound: bound.length > 0 ? bound : null }
    })
    .filter((row) => row.spec !== null)
})

async function refreshHotkeys(): Promise<void> {
  try {
    hotkeyConfig.value = await window.api.launcher.hotkeysGetConfig()
  } catch {
    /* 保持默认 */
  }
}

// ───── 两段式直达（主热键后按住修饰键 + 字母）─────
function chordLetterOf(entry: CommandEntryLike): string {
  const spec = specOfCommand(entry)
  if (!spec) return ''
  const found = Object.entries(hotkeyConfig.value.chords ?? {}).find(
    ([, s]) => JSON.stringify(s) === JSON.stringify(spec)
  )
  return found?.[0] ?? ''
}

async function setChordLetter(entry: CommandEntryLike, letter: string): Promise<void> {
  const spec = specOfCommand(entry)
  if (!spec) return
  const l = letter.trim().toLowerCase()
  if (l && !/^[a-z]$/.test(l)) {
    toast.error('两段式字母只能是 a-z')
    await refreshHotkeys()
    return
  }
  try {
    await window.api.launcher.hotkeysSetChord(l, l ? spec : null)
    await refreshHotkeys()
  } catch {
    toast.error('两段式配置失败')
  }
}

// ───── 片段文本扩展（M5.1）─────
const expansionEnabled = ref(false)
const expansionTriggerCount = ref(0)
const expansionHookOk = ref(true)
const probing = ref(false)
const probeFailed = ref(false)

async function refreshExpansion(): Promise<void> {
  try {
    const cfg = await window.api.launcher.expansionGetConfig()
    expansionEnabled.value = cfg.enabled
    expansionTriggerCount.value = cfg.triggerCount
    expansionHookOk.value = cfg.hookAvailable
  } catch {
    /* 保持默认 */
  }
}

watch(expansionEnabled, async (enabled) => {
  try {
    await window.api.launcher.expansionSetConfig({ enabled })
  } catch {
    toast.error('扩展开关保存失败')
  }
})

async function onProbePermission(): Promise<void> {
  probing.value = true
  toast.info?.('请在 4 秒内按下任意键（如空格）…')
  try {
    const result = await window.api.launcher.expansionProbe()
    if (result.received) {
      probeFailed.value = false
      expansionHookOk.value = true
      toast.success('全局按键监听正常，文本扩展可用')
    } else {
      probeFailed.value = true
      expansionHookOk.value = false
      toast.error('未捕获到按键：需要「辅助功能」授权', {
        description: '打开授权设置，把 Leaf 加入辅助功能列表后重试'
      })
    }
  } catch {
    toast.error('诊断失败')
  } finally {
    probing.value = false
  }
}

function openA11ySettings(): void {
  if (/Mac/i.test(navigator.platform)) {
    void window.api.system.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    )
  }
}

function startRecording(type: 'main' | 'command' | 'screenshot', key?: string): void {
  recording.value = { type, key }
}

/** keydown → Electron accelerator（修饰键 + 主键） */
function eventToAccelerator(e: KeyboardEvent): string | null {
  const MODIFIER_KEYS = ['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'CapsLock', 'Dead']
  if (MODIFIER_KEYS.includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Control')
  if (e.metaKey) parts.push('Command')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null // 必须含修饰键，避免吞掉普通按键
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc'
  }
  const key = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  return [...parts, key].join('+')
}

async function onRecordingKeydown(e: KeyboardEvent): Promise<void> {
  if (!recording.value) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') {
    recording.value = null
    return
  }
  const accel = eventToAccelerator(e)
  if (!accel) return
  try {
    if (recording.value.type === 'main') {
      await window.api.launcher.hotkeysSetMain(accel)
      toast.success(`主热键已设为 ${accel}`)
    } else if (recording.value.type === 'screenshot') {
      const res = await window.api.launcher.hotkeysSetScreenshot(accel)
      // 主进程注册失败会照实回报 conflicts，不能先报「已设置」再默默失效
      if (res.conflicts?.screenshot) toast.error(`${accel} 注册失败（可能被占用）`)
      else toast.success(`截图热键已设为 ${accel}`)
    } else {
      const entry = hotkeyCommands.value.find((r) => r.entry.key === recording.value?.key)
      if (entry?.spec) {
        await window.api.launcher.hotkeysSetCommand(accel, entry.spec)
        toast.success(`${entry.entry.title} 已绑定 ${accel}`)
      }
    }
    await refreshHotkeys()
  } catch {
    toast.error('热键设置失败')
  } finally {
    recording.value = null
  }
}

async function removeCommandHotkey(accel: string): Promise<void> {
  await window.api.launcher.hotkeysSetCommand(accel, null)
  await refreshHotkeys()
}

/** 关掉截图热键（主进程把 '' 当合法值，不再注册） */
async function clearScreenshotHotkey(): Promise<void> {
  try {
    await window.api.launcher.hotkeysSetScreenshot('')
    toast.info('已关闭截图热键')
  } catch {
    toast.error('热键设置失败')
  }
  await refreshHotkeys()
}

// ───── Quicklinks（M2.3）─────
interface QuicklinkItem {
  id: string
  name: string
  url: string
}

const quicklinks = ref<QuicklinkItem[]>([])
const qlSaving = ref(false)

async function refreshQuicklinks(): Promise<void> {
  try {
    quicklinks.value = await window.api.launcher.quicklinksList()
  } catch {
    /* 读取失败保持空 */
  }
}

function addQuicklink(): void {
  quicklinks.value.push({
    id: `ql-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    url: 'https://'
  })
}

async function removeQuicklink(link: QuicklinkItem): Promise<void> {
  quicklinks.value = quicklinks.value.filter((l) => l.id !== link.id)
  await saveQuicklinks()
}

async function saveQuicklinks(): Promise<void> {
  qlSaving.value = true
  try {
    const items = quicklinks.value
      .filter((l) => l.name.trim() && /^https?:\/\//.test(l.url.trim()))
      .map((l) => ({ id: l.id, name: l.name.trim(), url: l.url.trim() }))
    await window.api.launcher.quicklinksSave(items)
    quicklinks.value = items
    toast.success('快捷链接已保存')
  } catch {
    toast.error('保存失败')
  } finally {
    qlSaving.value = false
  }
}

async function onToggle(p: LauncherPlugin): Promise<void> {
  const result = await window.api.launcher.setPluginEnabled(p.id, !p.enabled)
  if (result.success) {
    await refresh()
  } else {
    toast.error('操作失败')
  }
}

async function onRemove(p: LauncherPlugin): Promise<void> {
  if (!window.confirm(`确定卸载插件「${p.name}」？其数据目录将被删除。`)) return
  const result = await window.api.launcher.removePlugin(p.id)
  if (result.success) {
    toast.success(`已卸载 ${p.name}`)
    await refresh()
  } else {
    toast.error('卸载失败', { description: result.error })
  }
}

function onTryRun(p: LauncherPlugin): void {
  const cmd = p.commands?.[0]?.code
  window.api.launcher.openPlugin(p.id, cmd)
}

// ───── WebDAV 同步 ─────
const syncForm = ref({ url: '', username: '', password: '', remoteDir: '/leaf-launcher' })
const syncTesting = ref(false)
const syncBacking = ref(false)
const syncRestoring = ref(false)

onMounted(async () => {
  void refresh()
  void refreshMarket()
  void refreshQuicklinks()
  void refreshHotkeys()
  void refreshExpansion()
  void refreshDevPlugins()
  window.addEventListener('keydown', onRecordingKeydown, true)
  // 开发热重载推送（watcher 自动重装成功/失败）→ toast + 列表刷新
  const devApi = devChannels()
  if (devApi && typeof devApi.onDevPluginsChanged === 'function') {
    offDevChanged = devApi.onDevPluginsChanged((payload) => {
      if (payload.kind === 'reloaded') {
        toast.success(`已热重载 ${payload.name || payload.pluginId}`)
      } else if (payload.kind === 'error') {
        toast.error(`热重载失败：${payload.name || payload.pluginId}`, {
          description: payload.error
        })
      }
      void refresh()
      void refreshDevPlugins()
      void refreshMarket()
    })
  }
  try {
    syncForm.value = await window.api.launcher.syncGetConfig()
  } catch {
    /* 配置读取失败保持默认 */
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onRecordingKeydown, true)
  offDevChanged?.()
  offDevChanged = null
})

async function onSyncSaveAndBackup(): Promise<void> {
  syncBacking.value = true
  try {
    await window.api.launcher.syncSetConfig({ ...syncForm.value })
    const result = await window.api.launcher.syncBackup()
    if (result.ok) {
      toast.success(`备份成功（${result.count ?? 0} 条数据）`)
    } else {
      toast.error('备份失败', { description: result.error })
    }
  } finally {
    syncBacking.value = false
  }
}

async function onSyncTest(): Promise<void> {
  syncTesting.value = true
  try {
    const result = await window.api.launcher.syncTest({ ...syncForm.value })
    if (result.ok) {
      toast.success('连接成功')
    } else {
      toast.error('连接失败', { description: result.error })
    }
  } finally {
    syncTesting.value = false
  }
}

async function onSyncRestore(): Promise<void> {
  if (!window.confirm('恢复将用云端快照覆盖本地全部插件数据，确定继续？')) return
  syncRestoring.value = true
  try {
    const result = await window.api.launcher.syncRestore()
    if (result.ok) {
      toast.success(`恢复成功（${result.count ?? 0} 条数据）`)
    } else {
      toast.error('恢复失败', { description: result.error })
    }
  } finally {
    syncRestoring.value = false
  }
}
</script>
