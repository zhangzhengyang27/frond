import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/SettingsView.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed, onBeforeUnmount, onMounted, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useRouter } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue-router.js?v=c8635d8b";
import AppIcon from "/src/components/AppIcon.vue";
import UBadge from "/src/components/ui/UBadge.vue";
import UButton from "/src/components/ui/UButton.vue";
import UProgress from "/src/components/ui/UProgress.vue";
import { resetOnboardingState } from "/src/router/index.ts?t=1788665009603";
import { useTheme } from "/src/composables/useTheme.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "SettingsView",
  setup(__props, { expose: __expose }) {
    __expose();
    document.title = "设置";
    const { theme, setTheme, initTheme } = useTheme();
    initTheme();
    const router = useRouter();
    const sections = [
      { id: "general", label: "通用", icon: "ri-settings-3-line" },
      { id: "launcher", label: "启动器", icon: "ri-search-eye-line" },
      { id: "ai", label: "AI", icon: "ri-sparkling-2-line" },
      { id: "focus", label: "专注", icon: "ri-focus-3-line" },
      { id: "extensions", label: "插件", icon: "ri-plug-2-line" },
      { id: "updates", label: "更新", icon: "ri-refresh-line" },
      { id: "data", label: "数据", icon: "ri-database-2-line" },
      { id: "advanced", label: "高级", icon: "ri-code-s-slash-line" },
      { id: "about", label: "关于", icon: "ri-information-line" }
    ];
    const activeSection = ref("general");
    const searchQuery = ref("");
    const filteredSections = computed(() => {
      if (!searchQuery.value.trim()) return sections;
      const q = searchQuery.value.toLowerCase();
      return sections.filter((s) => s.label.toLowerCase().includes(q));
    });
    const onRestartOnboarding = async () => {
      try {
        await window.api.preferences.resetOnboarding();
      } catch {
      }
      resetOnboardingState();
      await router.push("/onboarding");
    };
    const themes = [
      { id: "light", label: "浅色", description: "始终使用浅色界面", icon: "ri-sun-line" },
      { id: "dark", label: "深色", description: "始终使用深色界面", icon: "ri-moon-line" },
      { id: "auto", label: "跟随系统", description: "随 macOS / Windows 切换", icon: "ri-laptop-line" }
    ];
    const onSelectTheme = async (id) => {
      await setTheme(id);
    };
    const appVersion = ref("—");
    const systemInfo = ref(null);
    const shieldEnabled = ref(false);
    const shieldSupported = ref(true);
    const shieldWebsiteSupported = ref(true);
    const shieldAppsDraft = ref("");
    const shieldWebsitesDraft = ref("");
    const aiEnabled = ref(false);
    const aiApiKey = ref("");
    const aiBaseUrl = ref("https://api.openai.com/v1");
    const aiModel = ref("gpt-4o-mini");
    const aiSystemPrompt = ref("你是一个简洁高效的助手，回答尽量简短直接。");
    const aiTemperature = ref(0.7);
    const aiSaving = ref(false);
    const aiSaveMsg = ref("");
    async function loadAIConfig() {
      try {
        const cfg = await window.api.ai.getConfig();
        aiEnabled.value = cfg.enabled;
        aiApiKey.value = cfg.apiKey;
        aiBaseUrl.value = cfg.baseUrl;
        aiModel.value = cfg.model;
        aiSystemPrompt.value = cfg.systemPrompt;
        aiTemperature.value = cfg.temperature;
      } catch {
      }
    }
    async function saveAIConfig() {
      aiSaving.value = true;
      aiSaveMsg.value = "";
      try {
        await window.api.ai.setConfig({
          enabled: aiEnabled.value,
          apiKey: aiApiKey.value,
          baseUrl: aiBaseUrl.value,
          model: aiModel.value,
          systemPrompt: aiSystemPrompt.value,
          temperature: Number(aiTemperature.value)
        });
        aiSaveMsg.value = "已保存";
        setTimeout(() => {
          aiSaveMsg.value = "";
        }, 2e3);
      } catch {
        aiSaveMsg.value = "保存失败";
      } finally {
        aiSaving.value = false;
      }
    }
    async function loadShieldConfig() {
      try {
        const cfg = await window.api.focusShield.getConfig();
        shieldEnabled.value = cfg.enabled;
        shieldSupported.value = cfg.supported;
        shieldWebsiteSupported.value = cfg.websiteBlockSupported ?? true;
        shieldAppsDraft.value = cfg.apps.join(", ");
        shieldWebsitesDraft.value = (cfg.websites ?? []).join(", ");
      } catch {
        shieldSupported.value = false;
      }
    }
    async function toggleShieldEnabled() {
      const next = !shieldEnabled.value;
      try {
        const cfg = await window.api.focusShield.setConfig({ enabled: next });
        shieldEnabled.value = cfg.enabled;
      } catch {
      }
    }
    async function saveShieldApps() {
      const apps = shieldAppsDraft.value.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
      shieldAppsDraft.value = apps.join(", ");
      try {
        const cfg = await window.api.focusShield.setConfig({ apps });
        shieldAppsDraft.value = cfg.apps.join(", ");
      } catch {
      }
    }
    async function saveShieldWebsites() {
      const websites = shieldWebsitesDraft.value.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
      shieldWebsitesDraft.value = websites.join(", ");
      try {
        const cfg = await window.api.focusShield.setConfig({ websites });
        shieldWebsitesDraft.value = (cfg.websites ?? []).join(", ");
      } catch {
      }
    }
    onMounted(async () => {
      try {
        appVersion.value = await window.api.update.getCurrentVersion();
      } catch {
      }
      try {
        systemInfo.value = await window.api.system.info();
      } catch {
      }
      void loadShieldConfig();
      void loadAIConfig();
    });
    const onOpenDataDir = () => {
      if (systemInfo.value?.userDataPath) {
        void window.api.system.openPath(systemInfo.value.userDataPath);
      }
    };
    const onOpenLegacyDir = () => {
      if (systemInfo.value?.legacyArchivePath) {
        void window.api.system.openPath(systemInfo.value.legacyArchivePath);
      }
    };
    const telemetryMode = ref("local");
    onMounted(async () => {
      try {
        telemetryMode.value = await window.api.log.getMode();
      } catch {
      }
    });
    const telemetryOptions = [
      { id: "local", label: "本地（推荐）", description: "错误日志保存到本机 SQLite，重启可清。" },
      { id: "off", label: "关闭", description: "只保留内存 ring buffer，重启即清零。" },
      { id: "remote", label: "远程（1.0 暂未启用）", description: "在本地基础上预留远程通道；当前等同本地。" }
    ];
    const onSelectTelemetry = async (id) => {
      const prev = telemetryMode.value;
      telemetryMode.value = id;
      try {
        telemetryMode.value = await window.api.log.setMode(id);
      } catch (e) {
        console.warn("[SettingsView] setMode failed:", e);
        telemetryMode.value = prev;
      }
    };
    const onExportLogs = async () => {
      try {
        await window.api.log.export();
      } catch (e) {
        console.warn("[SettingsView] export failed:", e);
      }
    };
    const updateStatus = ref("idle");
    const updateVersion = ref("");
    const updateProgress = ref(0);
    const updateError = ref("");
    let unsubscribe = null;
    onMounted(() => {
      unsubscribe = window.api.update.onEvent((e) => {
        updateStatus.value = e.status;
        updateError.value = e.error ?? "";
        if (e.version) updateVersion.value = e.version;
        if (e.progress) updateProgress.value = Math.round(e.progress.percent);
      });
      window.api.update.getStatus().then((s) => updateStatus.value = s).catch(() => {
      });
    });
    onBeforeUnmount(() => {
      unsubscribe?.();
    });
    const onCheckUpdate = async () => {
      await window.api.update.check();
    };
    const onDownload = async () => {
      await window.api.update.download();
    };
    const onInstall = () => {
      window.api.update.install();
    };
    const statusText = (s) => {
      switch (s) {
        case "idle":
          return "未检查";
        case "checking":
          return "检查中…";
        case "available":
          return `有可用更新 v${updateVersion.value}`;
        case "not-available":
          return "已是最新版本";
        case "downloading":
          return `下载中 ${updateProgress.value}%`;
        case "downloaded":
          return `已下载 v${updateVersion.value}，点击重启安装`;
        case "error":
          return `错误：${updateError.value}`;
        default:
          return s;
      }
    };
    const canCheck = () => updateStatus.value === "idle" || updateStatus.value === "not-available" || updateStatus.value === "error";
    const canDownload = () => updateStatus.value === "available";
    const canInstall = () => updateStatus.value === "downloaded";
    const __returned__ = { theme, setTheme, initTheme, router, sections, activeSection, searchQuery, filteredSections, onRestartOnboarding, themes, onSelectTheme, appVersion, systemInfo, shieldEnabled, shieldSupported, shieldWebsiteSupported, shieldAppsDraft, shieldWebsitesDraft, aiEnabled, aiApiKey, aiBaseUrl, aiModel, aiSystemPrompt, aiTemperature, aiSaving, aiSaveMsg, loadAIConfig, saveAIConfig, loadShieldConfig, toggleShieldEnabled, saveShieldApps, saveShieldWebsites, onOpenDataDir, onOpenLegacyDir, telemetryMode, telemetryOptions, onSelectTelemetry, onExportLogs, updateStatus, updateVersion, updateProgress, updateError, get unsubscribe() {
      return unsubscribe;
    }, set unsubscribe(v) {
      unsubscribe = v;
    }, onCheckUpdate, onDownload, onInstall, statusText, canCheck, canDownload, canInstall, AppIcon, UBadge, UButton, UProgress };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createVNode as _createVNode, vModelText as _vModelText, createElementVNode as _createElementVNode, withDirectives as _withDirectives, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, createTextVNode as _createTextVNode, withCtx as _withCtx, createBlock as _createBlock, resolveComponent as _resolveComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "RaycastSettings flex h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]" };
const _hoisted_2 = { class: "flex w-[200px] shrink-0 flex-col border-r border-black/[0.06] bg-[#f5f5f7]" };
const _hoisted_3 = { class: "p-3" };
const _hoisted_4 = { class: "flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 ring-1 ring-black/[0.06]" };
const _hoisted_5 = { class: "flex-1 overflow-y-auto px-2 pb-3" };
const _hoisted_6 = ["onClick"];
const _hoisted_7 = { class: "flex-1 truncate" };
const _hoisted_8 = { class: "border-t border-black/[0.06] px-4 py-3" };
const _hoisted_9 = { class: "text-[11px] text-[#86868b]" };
const _hoisted_10 = { class: "flex-1 overflow-y-auto" };
const _hoisted_11 = { class: "mx-auto w-full max-w-[520px] px-6 py-8" };
const _hoisted_12 = { class: "mb-8" };
const _hoisted_13 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_14 = { class: "divide-y divide-black/[0.06]" };
const _hoisted_15 = ["onClick"];
const _hoisted_16 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b]" };
const _hoisted_17 = { class: "min-w-0 flex-1" };
const _hoisted_18 = { class: "text-[14px] font-medium text-[#1d1d1f]" };
const _hoisted_19 = { class: "mt-0.5 text-[12px] text-[#86868b]" };
const _hoisted_20 = {
  key: 0,
  class: "flex size-5 shrink-0 items-center justify-center rounded-full bg-[#007aff]"
};
const _hoisted_21 = { class: "mb-8" };
const _hoisted_22 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_23 = { class: "flex items-center gap-3 px-4 py-3" };
const _hoisted_24 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#007aff]/10 text-[#007aff]" };
const _hoisted_25 = { class: "mb-8" };
const _hoisted_26 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_27 = { class: "flex items-center gap-3 border-b border-black/[0.06] px-4 py-3" };
const _hoisted_28 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#007aff]/10 text-[#007aff]" };
const _hoisted_29 = ["aria-checked"];
const _hoisted_30 = { class: "space-y-4 px-4 py-4" };
const _hoisted_31 = { class: "grid grid-cols-2 gap-3" };
const _hoisted_32 = { class: "flex items-center gap-3" };
const _hoisted_33 = { class: "text-[12px] font-medium text-[#86868b]" };
const _hoisted_34 = { class: "flex items-center gap-3" };
const _hoisted_35 = {
  key: 0,
  class: "text-[12px] text-[#86868b]"
};
const _hoisted_36 = { class: "mb-8" };
const _hoisted_37 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_38 = { class: "flex items-center gap-3 border-b border-black/[0.06] px-4 py-3" };
const _hoisted_39 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ff9500]/10 text-[#ff9500]" };
const _hoisted_40 = ["aria-checked", "disabled"];
const _hoisted_41 = { class: "space-y-4 px-4 py-4" };
const _hoisted_42 = ["disabled"];
const _hoisted_43 = { class: "mb-1.5 block text-[12px] font-medium text-[#86868b]" };
const _hoisted_44 = {
  key: 0,
  class: "text-[#ff9500]"
};
const _hoisted_45 = ["disabled"];
const _hoisted_46 = { class: "mb-8" };
const _hoisted_47 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_48 = { class: "flex items-center gap-3 px-4 py-3" };
const _hoisted_49 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#af52de]/10 text-[#af52de]" };
const _hoisted_50 = { class: "mb-8" };
const _hoisted_51 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_52 = { class: "flex items-center gap-3 px-4 py-3" };
const _hoisted_53 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#007aff]/10 text-[#007aff]" };
const _hoisted_54 = { class: "min-w-0 flex-1" };
const _hoisted_55 = { class: "flex items-center gap-2" };
const _hoisted_56 = { class: "mt-0.5 text-[12px] text-[#86868b]" };
const _hoisted_57 = { class: "flex shrink-0 items-center gap-2" };
const _hoisted_58 = { class: "mb-8" };
const _hoisted_59 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_60 = { class: "divide-y divide-black/[0.06]" };
const _hoisted_61 = { class: "flex items-center gap-3 px-4 py-3" };
const _hoisted_62 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b]" };
const _hoisted_63 = { class: "min-w-0 flex-1" };
const _hoisted_64 = { class: "truncate font-mono text-[11px] text-[#86868b]" };
const _hoisted_65 = { class: "flex items-center gap-3 px-4 py-3" };
const _hoisted_66 = { class: "min-w-0 flex-1" };
const _hoisted_67 = { class: "flex items-center gap-2" };
const _hoisted_68 = { class: "mt-0.5 truncate font-mono text-[11px] text-[#86868b]" };
const _hoisted_69 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b]" };
const _hoisted_70 = { class: "mb-8" };
const _hoisted_71 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_72 = { class: "divide-y divide-black/[0.06]" };
const _hoisted_73 = ["onClick"];
const _hoisted_74 = { class: "min-w-0 flex-1" };
const _hoisted_75 = { class: "flex items-center gap-2" };
const _hoisted_76 = { class: "text-[14px] font-medium text-[#1d1d1f]" };
const _hoisted_77 = { class: "mt-0.5 text-[12px] text-[#86868b]" };
const _hoisted_78 = {
  key: 0,
  class: "flex size-5 shrink-0 items-center justify-center rounded-full bg-[#007aff]"
};
const _hoisted_79 = { class: "flex items-center gap-3 border-t border-black/[0.06] px-4 py-3" };
const _hoisted_80 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#86868b]" };
const _hoisted_81 = { class: "mb-8" };
const _hoisted_82 = { class: "overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" };
const _hoisted_83 = { class: "divide-y divide-black/[0.06]" };
const _hoisted_84 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#007aff]/10 text-[#007aff]" };
const _hoisted_85 = { class: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ff9500]/10 text-[#ff9500]" };
const _hoisted_86 = { class: "text-center text-[12px] text-[#86868b]" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_router_link = _resolveComponent("router-link");
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createCommentVNode(" ═══ 左侧边栏（Raycast 风格）═══ "),
    _createElementVNode("aside", _hoisted_2, [
      _createCommentVNode(" 搜索框 "),
      _createElementVNode("div", _hoisted_3, [
        _createElementVNode("div", _hoisted_4, [
          _createVNode($setup["AppIcon"], {
            icon: "ri-search-line",
            size: 14,
            class: "shrink-0 text-[#86868b]"
          }),
          _withDirectives(_createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.searchQuery = $event),
              type: "text",
              class: "flex-1 bg-transparent text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none",
              placeholder: "搜索设置…",
              spellcheck: "false"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [_vModelText, $setup.searchQuery]
          ])
        ])
      ]),
      _createCommentVNode(" 分类列表 "),
      _createElementVNode("nav", _hoisted_5, [
        (_openBlock(true), _createElementBlock(
          _Fragment,
          null,
          _renderList($setup.filteredSections, (section) => {
            return _openBlock(), _createElementBlock("button", {
              key: section.id,
              type: "button",
              class: _normalizeClass(["mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors", $setup.activeSection === section.id ? "bg-[#007aff]/15 text-[#007aff] font-medium" : "text-[#1d1d1f] hover:bg-black/[0.04]"]),
              onClick: ($event) => $setup.activeSection = section.id
            }, [
              _createVNode($setup["AppIcon"], {
                icon: section.icon,
                size: 16,
                class: "shrink-0"
              }, null, 8, ["icon"]),
              _createElementVNode(
                "span",
                _hoisted_7,
                _toDisplayString(section.label),
                1
                /* TEXT */
              )
            ], 10, _hoisted_6);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      _createCommentVNode(" 底部版本信息 "),
      _createElementVNode("div", _hoisted_8, [
        _createElementVNode(
          "div",
          _hoisted_9,
          "Leaf v" + _toDisplayString($setup.appVersion),
          1
          /* TEXT */
        )
      ])
    ]),
    _createCommentVNode(" ═══ 右侧内容区 ═══ "),
    _createElementVNode("main", _hoisted_10, [
      _createElementVNode("div", _hoisted_11, [
        _createCommentVNode(" ═══ 通用 ═══ "),
        $setup.activeSection === "general" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 0 },
          [
            _cache[12] || (_cache[12] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "通用",
              -1
              /* CACHED */
            )),
            _cache[13] || (_cache[13] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "外观与界面偏好。",
              -1
              /* CACHED */
            )),
            _createCommentVNode(" 外观 "),
            _createElementVNode("section", _hoisted_12, [
              _cache[11] || (_cache[11] = _createElementVNode(
                "h2",
                { class: "mb-3 text-[12px] font-medium uppercase tracking-wider text-[#86868b]" },
                "外观",
                -1
                /* CACHED */
              )),
              _createElementVNode("div", _hoisted_13, [
                _createElementVNode("div", _hoisted_14, [
                  (_openBlock(), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList($setup.themes, (t) => {
                      return _createElementVNode("button", {
                        key: t.id,
                        type: "button",
                        class: "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]",
                        onClick: ($event) => $setup.onSelectTheme(t.id)
                      }, [
                        _createElementVNode("div", _hoisted_16, [
                          _createVNode($setup["AppIcon"], {
                            icon: t.icon,
                            size: 16
                          }, null, 8, ["icon"])
                        ]),
                        _createElementVNode("div", _hoisted_17, [
                          _createElementVNode(
                            "div",
                            _hoisted_18,
                            _toDisplayString(t.label),
                            1
                            /* TEXT */
                          ),
                          _createElementVNode(
                            "div",
                            _hoisted_19,
                            _toDisplayString(t.description),
                            1
                            /* TEXT */
                          )
                        ]),
                        $setup.theme === t.id ? (_openBlock(), _createElementBlock("div", _hoisted_20, [
                          _createVNode($setup["AppIcon"], {
                            icon: "ri-check-line",
                            size: 12,
                            class: "text-white"
                          })
                        ])) : _createCommentVNode("v-if", true)
                      ], 8, _hoisted_15);
                    }),
                    64
                    /* STABLE_FRAGMENT */
                  ))
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "launcher" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 1 },
          [
            _createCommentVNode(" ═══ 启动器 ═══ "),
            _cache[16] || (_cache[16] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "启动器",
              -1
              /* CACHED */
            )),
            _cache[17] || (_cache[17] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "全局搜索、插件命令与快捷键。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_21, [
              _createElementVNode("div", _hoisted_22, [
                _createElementVNode("div", _hoisted_23, [
                  _createElementVNode("div", _hoisted_24, [
                    _createVNode($setup["AppIcon"], {
                      icon: "ri-search-line",
                      size: 16
                    })
                  ]),
                  _cache[15] || (_cache[15] = _createElementVNode(
                    "div",
                    { class: "min-w-0 flex-1" },
                    [
                      _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "胶囊启动台与插件"),
                      _createElementVNode("div", { class: "mt-0.5 text-[12px] text-[#86868b]" }, " 全局搜索 / 插件命令 / WebDAV 同步，均在启动器管理页配置 ")
                    ],
                    -1
                    /* CACHED */
                  )),
                  _createVNode($setup["UButton"], {
                    size: "sm",
                    variant: "secondary",
                    onClick: _cache[1] || (_cache[1] = ($event) => $setup.router.push("/launcher"))
                  }, {
                    default: _withCtx(() => [..._cache[14] || (_cache[14] = [
                      _createTextVNode(
                        "管理插件",
                        -1
                        /* CACHED */
                      )
                    ])]),
                    _: 1
                    /* STABLE */
                  })
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "ai" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 2 },
          [
            _createCommentVNode(" ═══ AI ═══ "),
            _cache[24] || (_cache[24] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "AI",
              -1
              /* CACHED */
            )),
            _cache[25] || (_cache[25] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "AI 助手配置。OpenAI 兼容 API，支持 DeepSeek / 通义 / Ollama 等。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_25, [
              _createElementVNode("div", _hoisted_26, [
                _createCommentVNode(" 启用开关 "),
                _createElementVNode("div", _hoisted_27, [
                  _createElementVNode("div", _hoisted_28, [
                    _createVNode($setup["AppIcon"], {
                      icon: "sparkling-2-line",
                      size: 16
                    })
                  ]),
                  _cache[18] || (_cache[18] = _createElementVNode(
                    "div",
                    { class: "min-w-0 flex-1" },
                    [
                      _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "AI 助手"),
                      _createElementVNode("div", { class: "mt-0.5 text-[12px] text-[#86868b]" }, "配置仅存本机")
                    ],
                    -1
                    /* CACHED */
                  )),
                  _createElementVNode("button", {
                    type: "button",
                    role: "switch",
                    "aria-checked": $setup.aiEnabled,
                    class: _normalizeClass(["relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors", $setup.aiEnabled ? "bg-[#34c759]" : "bg-[#e9e9eb]"]),
                    onClick: _cache[2] || (_cache[2] = ($event) => $setup.aiEnabled = !$setup.aiEnabled)
                  }, [
                    _createElementVNode(
                      "span",
                      {
                        class: _normalizeClass(["absolute top-[2px] size-6 rounded-full bg-white shadow-sm transition-all", $setup.aiEnabled ? "left-[20px]" : "left-[2px]"])
                      },
                      null,
                      2
                      /* CLASS */
                    )
                  ], 10, _hoisted_29)
                ]),
                _createCommentVNode(" 配置表单 "),
                _createElementVNode("div", _hoisted_30, [
                  _createElementVNode("div", null, [
                    _cache[19] || (_cache[19] = _createElementVNode(
                      "label",
                      { class: "mb-1.5 block text-[12px] font-medium text-[#86868b]" },
                      "API Key",
                      -1
                      /* CACHED */
                    )),
                    _withDirectives(_createElementVNode(
                      "input",
                      {
                        "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $setup.aiApiKey = $event),
                        type: "password",
                        placeholder: "sk-...",
                        class: "w-full rounded-lg bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none ring-1 ring-black/[0.06] transition-all focus:ring-[#007aff]/50"
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    ), [
                      [_vModelText, $setup.aiApiKey]
                    ])
                  ]),
                  _createElementVNode("div", _hoisted_31, [
                    _createElementVNode("div", null, [
                      _cache[20] || (_cache[20] = _createElementVNode(
                        "label",
                        { class: "mb-1.5 block text-[12px] font-medium text-[#86868b]" },
                        "Base URL",
                        -1
                        /* CACHED */
                      )),
                      _withDirectives(_createElementVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $setup.aiBaseUrl = $event),
                          type: "text",
                          placeholder: "https://api.openai.com/v1",
                          class: "w-full rounded-lg bg-[#f5f5f7] px-3 py-2 font-mono text-[12px] text-[#1d1d1f] outline-none ring-1 ring-black/[0.06] transition-all focus:ring-[#007aff]/50"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [_vModelText, $setup.aiBaseUrl]
                      ])
                    ]),
                    _createElementVNode("div", null, [
                      _cache[21] || (_cache[21] = _createElementVNode(
                        "label",
                        { class: "mb-1.5 block text-[12px] font-medium text-[#86868b]" },
                        "模型",
                        -1
                        /* CACHED */
                      )),
                      _withDirectives(_createElementVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $setup.aiModel = $event),
                          type: "text",
                          placeholder: "gpt-4o-mini",
                          class: "w-full rounded-lg bg-[#f5f5f7] px-3 py-2 font-mono text-[12px] text-[#1d1d1f] outline-none ring-1 ring-black/[0.06] transition-all focus:ring-[#007aff]/50"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [_vModelText, $setup.aiModel]
                      ])
                    ])
                  ]),
                  _createElementVNode("div", null, [
                    _cache[22] || (_cache[22] = _createElementVNode(
                      "label",
                      { class: "mb-1.5 block text-[12px] font-medium text-[#86868b]" },
                      "系统提示词",
                      -1
                      /* CACHED */
                    )),
                    _withDirectives(_createElementVNode(
                      "textarea",
                      {
                        "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $setup.aiSystemPrompt = $event),
                        rows: "2",
                        class: "w-full resize-none rounded-lg bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none ring-1 ring-black/[0.06] transition-all focus:ring-[#007aff]/50"
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    ), [
                      [_vModelText, $setup.aiSystemPrompt]
                    ])
                  ]),
                  _createElementVNode("div", _hoisted_32, [
                    _createElementVNode(
                      "label",
                      _hoisted_33,
                      "温度 " + _toDisplayString($setup.aiTemperature),
                      1
                      /* TEXT */
                    ),
                    _withDirectives(_createElementVNode(
                      "input",
                      {
                        "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => $setup.aiTemperature = $event),
                        type: "range",
                        min: "0",
                        max: "2",
                        step: "0.1",
                        class: "flex-1"
                      },
                      null,
                      512
                      /* NEED_PATCH */
                    ), [
                      [
                        _vModelText,
                        $setup.aiTemperature,
                        void 0,
                        { number: true }
                      ]
                    ])
                  ]),
                  _createElementVNode("div", _hoisted_34, [
                    _createVNode($setup["UButton"], {
                      size: "sm",
                      variant: "primary",
                      loading: $setup.aiSaving,
                      onClick: $setup.saveAIConfig
                    }, {
                      default: _withCtx(() => [..._cache[23] || (_cache[23] = [
                        _createTextVNode(
                          "保存配置",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    }, 8, ["loading"]),
                    $setup.aiSaveMsg ? (_openBlock(), _createElementBlock(
                      "span",
                      _hoisted_35,
                      _toDisplayString($setup.aiSaveMsg),
                      1
                      /* TEXT */
                    )) : _createCommentVNode("v-if", true)
                  ])
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "focus" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 3 },
          [
            _createCommentVNode(" ═══ 专注 ═══ "),
            _cache[29] || (_cache[29] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "专注",
              -1
              /* CACHED */
            )),
            _cache[30] || (_cache[30] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "番茄钟专注时屏蔽干扰应用和网站。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_36, [
              _createElementVNode("div", _hoisted_37, [
                _createCommentVNode(" 启用开关 "),
                _createElementVNode("div", _hoisted_38, [
                  _createElementVNode("div", _hoisted_39, [
                    _createVNode($setup["AppIcon"], {
                      icon: "ri-shield-line",
                      size: 16
                    })
                  ]),
                  _cache[26] || (_cache[26] = _createElementVNode(
                    "div",
                    { class: "min-w-0 flex-1" },
                    [
                      _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "专注护盾"),
                      _createElementVNode("div", { class: "mt-0.5 text-[12px] text-[#86868b]" }, " 工作计时进行中，清单内应用/网站切到前台即弹出全屏提醒 ")
                    ],
                    -1
                    /* CACHED */
                  )),
                  _createElementVNode("button", {
                    type: "button",
                    role: "switch",
                    "aria-checked": $setup.shieldEnabled,
                    disabled: !$setup.shieldSupported,
                    class: _normalizeClass(["relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-40", $setup.shieldEnabled ? "bg-[#34c759]" : "bg-[#e9e9eb]"]),
                    onClick: $setup.toggleShieldEnabled
                  }, [
                    _createElementVNode(
                      "span",
                      {
                        class: _normalizeClass(["absolute top-[2px] size-6 rounded-full bg-white shadow-sm transition-all", $setup.shieldEnabled ? "left-[20px]" : "left-[2px]"])
                      },
                      null,
                      2
                      /* CLASS */
                    )
                  ], 10, _hoisted_40)
                ]),
                _createCommentVNode(" 屏蔽清单 "),
                _createElementVNode("div", _hoisted_41, [
                  _createElementVNode("div", null, [
                    _cache[27] || (_cache[27] = _createElementVNode(
                      "label",
                      { class: "mb-1.5 block text-[12px] font-medium text-[#86868b]" },
                      "屏蔽清单（应用名片段，逗号分隔）",
                      -1
                      /* CACHED */
                    )),
                    _withDirectives(_createElementVNode("textarea", {
                      "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => $setup.shieldAppsDraft = $event),
                      rows: "2",
                      disabled: !$setup.shieldSupported,
                      placeholder: "游戏, chrome, bilibili",
                      class: "w-full resize-none rounded-lg bg-[#f5f5f7] px-3 py-2 font-mono text-[12px] text-[#1d1d1f] outline-none ring-1 ring-black/[0.06] transition-all focus:ring-[#007aff]/50 disabled:opacity-40",
                      onBlur: $setup.saveShieldApps
                    }, null, 40, _hoisted_42), [
                      [_vModelText, $setup.shieldAppsDraft]
                    ])
                  ]),
                  _createElementVNode("div", null, [
                    _createElementVNode("label", _hoisted_43, [
                      _cache[28] || (_cache[28] = _createTextVNode(
                        " 网站屏蔽（域名片段，逗号分隔） ",
                        -1
                        /* CACHED */
                      )),
                      !$setup.shieldWebsiteSupported ? (_openBlock(), _createElementBlock("span", _hoisted_44, "（仅 macOS 支持）")) : _createCommentVNode("v-if", true)
                    ]),
                    _withDirectives(_createElementVNode("textarea", {
                      "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => $setup.shieldWebsitesDraft = $event),
                      rows: "2",
                      disabled: !$setup.shieldSupported || !$setup.shieldWebsiteSupported,
                      placeholder: "youtube.com, twitter.com, bilibili.com",
                      class: "w-full resize-none rounded-lg bg-[#f5f5f7] px-3 py-2 font-mono text-[12px] text-[#1d1d1f] outline-none ring-1 ring-black/[0.06] transition-all focus:ring-[#007aff]/50 disabled:opacity-40",
                      onBlur: $setup.saveShieldWebsites
                    }, null, 40, _hoisted_45), [
                      [_vModelText, $setup.shieldWebsitesDraft]
                    ])
                  ])
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "extensions" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 4 },
          [
            _createCommentVNode(" ═══ 插件 ═══ "),
            _cache[33] || (_cache[33] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "插件",
              -1
              /* CACHED */
            )),
            _cache[34] || (_cache[34] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "管理已安装的插件与扩展。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_46, [
              _createElementVNode("div", _hoisted_47, [
                _createElementVNode("div", _hoisted_48, [
                  _createElementVNode("div", _hoisted_49, [
                    _createVNode($setup["AppIcon"], {
                      icon: "plug-2-line",
                      size: 16
                    })
                  ]),
                  _cache[32] || (_cache[32] = _createElementVNode(
                    "div",
                    { class: "min-w-0 flex-1" },
                    [
                      _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "插件管理"),
                      _createElementVNode("div", { class: "mt-0.5 text-[12px] text-[#86868b]" }, "查看、安装、卸载插件，管理插件偏好设置")
                    ],
                    -1
                    /* CACHED */
                  )),
                  _createVNode($setup["UButton"], {
                    size: "sm",
                    variant: "secondary",
                    onClick: _cache[10] || (_cache[10] = ($event) => $setup.router.push("/launcher"))
                  }, {
                    default: _withCtx(() => [..._cache[31] || (_cache[31] = [
                      _createTextVNode(
                        "打开管理页",
                        -1
                        /* CACHED */
                      )
                    ])]),
                    _: 1
                    /* STABLE */
                  })
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "updates" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 5 },
          [
            _createCommentVNode(" ═══ 更新 ═══ "),
            _cache[40] || (_cache[40] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "更新",
              -1
              /* CACHED */
            )),
            _cache[41] || (_cache[41] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "自动更新与版本管理。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_50, [
              _createElementVNode("div", _hoisted_51, [
                _createElementVNode("div", _hoisted_52, [
                  _createElementVNode("div", _hoisted_53, [
                    _createVNode($setup["AppIcon"], {
                      icon: "ri-refresh-line",
                      size: 16
                    })
                  ]),
                  _createElementVNode("div", _hoisted_54, [
                    _createElementVNode("div", _hoisted_55, [
                      _cache[37] || (_cache[37] = _createElementVNode(
                        "span",
                        { class: "text-[14px] font-medium text-[#1d1d1f]" },
                        "自动更新",
                        -1
                        /* CACHED */
                      )),
                      $setup.updateStatus === "available" ? (_openBlock(), _createBlock($setup["UBadge"], {
                        key: 0,
                        variant: "brand"
                      }, {
                        default: _withCtx(() => [..._cache[35] || (_cache[35] = [
                          _createTextVNode(
                            "可更新",
                            -1
                            /* CACHED */
                          )
                        ])]),
                        _: 1
                        /* STABLE */
                      })) : $setup.updateStatus === "error" ? (_openBlock(), _createBlock($setup["UBadge"], {
                        key: 1,
                        variant: "danger"
                      }, {
                        default: _withCtx(() => [..._cache[36] || (_cache[36] = [
                          _createTextVNode(
                            "错误",
                            -1
                            /* CACHED */
                          )
                        ])]),
                        _: 1
                        /* STABLE */
                      })) : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode(
                      "div",
                      _hoisted_56,
                      _toDisplayString($setup.statusText($setup.updateStatus)),
                      1
                      /* TEXT */
                    ),
                    $setup.updateStatus === "downloading" ? (_openBlock(), _createBlock($setup["UProgress"], {
                      key: 0,
                      value: $setup.updateProgress,
                      class: "mt-2"
                    }, null, 8, ["value"])) : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("div", _hoisted_57, [
                    $setup.canCheck() ? (_openBlock(), _createBlock($setup["UButton"], {
                      key: 0,
                      size: "sm",
                      variant: "secondary",
                      loading: $setup.updateStatus === "checking",
                      onClick: $setup.onCheckUpdate
                    }, {
                      default: _withCtx(() => [
                        _createTextVNode(
                          _toDisplayString($setup.updateStatus === "checking" ? "检查中…" : "检查更新"),
                          1
                          /* TEXT */
                        )
                      ]),
                      _: 1
                      /* STABLE */
                    }, 8, ["loading"])) : _createCommentVNode("v-if", true),
                    $setup.canDownload() ? (_openBlock(), _createBlock($setup["UButton"], {
                      key: 1,
                      size: "sm",
                      variant: "primary",
                      onClick: $setup.onDownload
                    }, {
                      default: _withCtx(() => [..._cache[38] || (_cache[38] = [
                        _createTextVNode(
                          "下载",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    })) : _createCommentVNode("v-if", true),
                    $setup.canInstall() ? (_openBlock(), _createBlock($setup["UButton"], {
                      key: 2,
                      size: "sm",
                      variant: "primary",
                      onClick: $setup.onInstall
                    }, {
                      default: _withCtx(() => [..._cache[39] || (_cache[39] = [
                        _createTextVNode(
                          "重启安装",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    })) : _createCommentVNode("v-if", true)
                  ])
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "data" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 6 },
          [
            _createCommentVNode(" ═══ 数据 ═══ "),
            _cache[49] || (_cache[49] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "数据",
              -1
              /* CACHED */
            )),
            _cache[50] || (_cache[50] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "数据存储、迁移与备份。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_58, [
              _createElementVNode("div", _hoisted_59, [
                _createElementVNode("div", _hoisted_60, [
                  _createCommentVNode(" 数据目录 "),
                  _createElementVNode("div", _hoisted_61, [
                    _createElementVNode("div", _hoisted_62, [
                      _createVNode($setup["AppIcon"], {
                        icon: "ri-folder-line",
                        size: 16
                      })
                    ]),
                    _createElementVNode("div", _hoisted_63, [
                      _cache[42] || (_cache[42] = _createElementVNode(
                        "div",
                        { class: "text-[14px] font-medium text-[#1d1d1f]" },
                        "数据目录",
                        -1
                        /* CACHED */
                      )),
                      _createElementVNode(
                        "div",
                        _hoisted_64,
                        _toDisplayString($setup.systemInfo?.userDataPath ?? "—"),
                        1
                        /* TEXT */
                      )
                    ]),
                    $setup.systemInfo?.userDataPath ? (_openBlock(), _createBlock($setup["UButton"], {
                      key: 0,
                      size: "sm",
                      variant: "ghost",
                      onClick: $setup.onOpenDataDir
                    }, {
                      default: _withCtx(() => [..._cache[43] || (_cache[43] = [
                        _createTextVNode(
                          "打开",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    })) : _createCommentVNode("v-if", true)
                  ]),
                  _createCommentVNode(" 旧版数据归档 "),
                  _createElementVNode("div", _hoisted_65, [
                    _createElementVNode(
                      "div",
                      {
                        class: _normalizeClass(["flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors", $setup.systemInfo?.legacyArchivePath ? "bg-[#34c759]/10 text-[#34c759]" : "bg-[#f5f5f7] text-[#86868b]"])
                      },
                      [
                        _createVNode($setup["AppIcon"], {
                          icon: $setup.systemInfo?.legacyArchivePath ? "ri-archive-line" : "ri-archive-stack-line",
                          size: 16
                        }, null, 8, ["icon"])
                      ],
                      2
                      /* CLASS */
                    ),
                    _createElementVNode("div", _hoisted_66, [
                      _createElementVNode("div", _hoisted_67, [
                        _cache[46] || (_cache[46] = _createElementVNode(
                          "span",
                          { class: "text-[14px] font-medium text-[#1d1d1f]" },
                          "旧版数据归档",
                          -1
                          /* CACHED */
                        )),
                        $setup.systemInfo?.legacyArchivePath ? (_openBlock(), _createBlock($setup["UBadge"], {
                          key: 0,
                          variant: "success"
                        }, {
                          default: _withCtx(() => [..._cache[44] || (_cache[44] = [
                            _createTextVNode(
                              "已归档",
                              -1
                              /* CACHED */
                            )
                          ])]),
                          _: 1
                          /* STABLE */
                        })) : $setup.systemInfo?.migrationDone === false ? (_openBlock(), _createBlock($setup["UBadge"], {
                          key: 1,
                          variant: "neutral"
                        }, {
                          default: _withCtx(() => [..._cache[45] || (_cache[45] = [
                            _createTextVNode(
                              "无需迁移",
                              -1
                              /* CACHED */
                            )
                          ])]),
                          _: 1
                          /* STABLE */
                        })) : _createCommentVNode("v-if", true)
                      ]),
                      _createElementVNode("div", _hoisted_68, [
                        $setup.systemInfo?.legacyArchivePath ? (_openBlock(), _createElementBlock(
                          _Fragment,
                          { key: 0 },
                          [
                            _createTextVNode(
                              _toDisplayString($setup.systemInfo.legacyArchivePath),
                              1
                              /* TEXT */
                            )
                          ],
                          64
                          /* STABLE_FRAGMENT */
                        )) : (_openBlock(), _createElementBlock(
                          _Fragment,
                          { key: 1 },
                          [
                            _createTextVNode("无旧数据")
                          ],
                          64
                          /* STABLE_FRAGMENT */
                        ))
                      ])
                    ]),
                    $setup.systemInfo?.legacyArchivePath ? (_openBlock(), _createBlock($setup["UButton"], {
                      key: 0,
                      size: "sm",
                      variant: "ghost",
                      onClick: $setup.onOpenLegacyDir
                    }, {
                      default: _withCtx(() => [..._cache[47] || (_cache[47] = [
                        _createTextVNode(
                          "打开",
                          -1
                          /* CACHED */
                        )
                      ])]),
                      _: 1
                      /* STABLE */
                    })) : _createCommentVNode("v-if", true)
                  ]),
                  _createCommentVNode(" 数据迁移中心 "),
                  _createVNode(_component_router_link, {
                    to: "/migration",
                    class: "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                  }, {
                    default: _withCtx(() => [
                      _createElementVNode("div", _hoisted_69, [
                        _createVNode($setup["AppIcon"], {
                          icon: "database-2-line",
                          size: 16
                        })
                      ]),
                      _cache[48] || (_cache[48] = _createElementVNode(
                        "div",
                        { class: "min-w-0 flex-1" },
                        [
                          _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "数据迁移中心"),
                          _createElementVNode("div", { class: "text-[12px] text-[#86868b]" }, "导入 / 导出 / 备份恢复 / 出厂重置")
                        ],
                        -1
                        /* CACHED */
                      )),
                      _createVNode($setup["AppIcon"], {
                        icon: "ri-arrow-right-s-line",
                        size: 16,
                        class: "text-[#86868b]"
                      })
                    ]),
                    _: 1
                    /* STABLE */
                  })
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "advanced" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 7 },
          [
            _createCommentVNode(" ═══ 高级 ═══ "),
            _cache[54] || (_cache[54] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "高级",
              -1
              /* CACHED */
            )),
            _cache[55] || (_cache[55] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "日志、遥测与开发者选项。",
              -1
              /* CACHED */
            )),
            _createCommentVNode(" 日志模式 "),
            _createElementVNode("section", _hoisted_70, [
              _cache[53] || (_cache[53] = _createElementVNode(
                "h2",
                { class: "mb-3 text-[12px] font-medium uppercase tracking-wider text-[#86868b]" },
                "日志",
                -1
                /* CACHED */
              )),
              _createElementVNode("div", _hoisted_71, [
                _createElementVNode("div", _hoisted_72, [
                  (_openBlock(), _createElementBlock(
                    _Fragment,
                    null,
                    _renderList($setup.telemetryOptions, (t) => {
                      return _createElementVNode("button", {
                        key: t.id,
                        type: "button",
                        class: "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]",
                        onClick: ($event) => $setup.onSelectTelemetry(t.id)
                      }, [
                        _createElementVNode(
                          "div",
                          {
                            class: _normalizeClass(["flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors", $setup.telemetryMode === t.id ? "bg-[#007aff]/10 text-[#007aff]" : "bg-[#f5f5f7] text-[#86868b]"])
                          },
                          [
                            _createVNode($setup["AppIcon"], {
                              icon: t.id === "off" ? "ri-eye-off-line" : t.id === "remote" ? "ri-cloud-line" : "ri-hard-drive-2-line",
                              size: 16
                            }, null, 8, ["icon"])
                          ],
                          2
                          /* CLASS */
                        ),
                        _createElementVNode("div", _hoisted_74, [
                          _createElementVNode("div", _hoisted_75, [
                            _createElementVNode(
                              "span",
                              _hoisted_76,
                              _toDisplayString(t.label),
                              1
                              /* TEXT */
                            )
                          ]),
                          _createElementVNode(
                            "div",
                            _hoisted_77,
                            _toDisplayString(t.description),
                            1
                            /* TEXT */
                          )
                        ]),
                        $setup.telemetryMode === t.id ? (_openBlock(), _createElementBlock("div", _hoisted_78, [
                          _createVNode($setup["AppIcon"], {
                            icon: "ri-check-line",
                            size: 12,
                            class: "text-white"
                          })
                        ])) : _createCommentVNode("v-if", true)
                      ], 8, _hoisted_73);
                    }),
                    64
                    /* STABLE_FRAGMENT */
                  ))
                ]),
                _createCommentVNode(" 导出日志 "),
                _createElementVNode("div", _hoisted_79, [
                  _createElementVNode("div", _hoisted_80, [
                    _createVNode($setup["AppIcon"], {
                      icon: "download-2-line",
                      size: 16
                    })
                  ]),
                  _cache[52] || (_cache[52] = _createElementVNode(
                    "div",
                    { class: "min-w-0 flex-1" },
                    [
                      _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "导出日志"),
                      _createElementVNode("div", { class: "text-[12px] text-[#86868b]" }, "打包最近 500 条日志，便于反馈问题时附上")
                    ],
                    -1
                    /* CACHED */
                  )),
                  _createVNode($setup["UButton"], {
                    size: "sm",
                    variant: "secondary",
                    onClick: $setup.onExportLogs
                  }, {
                    default: _withCtx(() => [..._cache[51] || (_cache[51] = [
                      _createTextVNode(
                        "导出",
                        -1
                        /* CACHED */
                      )
                    ])]),
                    _: 1
                    /* STABLE */
                  })
                ])
              ])
            ])
          ],
          64
          /* STABLE_FRAGMENT */
        )) : $setup.activeSection === "about" ? (_openBlock(), _createElementBlock(
          _Fragment,
          { key: 8 },
          [
            _createCommentVNode(" ═══ 关于 ═══ "),
            _cache[58] || (_cache[58] = _createElementVNode(
              "h1",
              { class: "mb-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]" },
              "关于",
              -1
              /* CACHED */
            )),
            _cache[59] || (_cache[59] = _createElementVNode(
              "p",
              { class: "mb-8 text-[14px] text-[#86868b]" },
              "版本信息与致谢。",
              -1
              /* CACHED */
            )),
            _createElementVNode("section", _hoisted_81, [
              _createElementVNode("div", _hoisted_82, [
                _createElementVNode("div", _hoisted_83, [
                  _createVNode(_component_router_link, {
                    to: "/about",
                    class: "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                  }, {
                    default: _withCtx(() => [
                      _createElementVNode("div", _hoisted_84, [
                        _createVNode($setup["AppIcon"], {
                          icon: "ri-information-line",
                          size: 16
                        })
                      ]),
                      _cache[56] || (_cache[56] = _createElementVNode(
                        "div",
                        { class: "min-w-0 flex-1" },
                        [
                          _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "关于 Leaf"),
                          _createElementVNode("div", { class: "text-[12px] text-[#86868b]" }, "版本、隐私、致谢")
                        ],
                        -1
                        /* CACHED */
                      )),
                      _createVNode($setup["AppIcon"], {
                        icon: "ri-arrow-right-s-line",
                        size: 16,
                        class: "text-[#86868b]"
                      })
                    ]),
                    _: 1
                    /* STABLE */
                  }),
                  _createElementVNode("button", {
                    type: "button",
                    class: "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]",
                    onClick: $setup.onRestartOnboarding
                  }, [
                    _createElementVNode("div", _hoisted_85, [
                      _createVNode($setup["AppIcon"], {
                        icon: "ri-refresh-line",
                        size: 16
                      })
                    ]),
                    _cache[57] || (_cache[57] = _createElementVNode(
                      "div",
                      { class: "min-w-0 flex-1" },
                      [
                        _createElementVNode("div", { class: "text-[14px] font-medium text-[#1d1d1f]" }, "重新开始引导"),
                        _createElementVNode("div", { class: "text-[12px] text-[#86868b]" }, "重看首次启动的 4 步引导")
                      ],
                      -1
                      /* CACHED */
                    )),
                    _createVNode($setup["AppIcon"], {
                      icon: "ri-arrow-right-s-line",
                      size: 16,
                      class: "text-[#86868b]"
                    })
                  ])
                ])
              ])
            ]),
            _createElementVNode(
              "p",
              _hoisted_86,
              "Leaf · v" + _toDisplayString($setup.appVersion) + " · 本地优先 / 开源",
              1
              /* TEXT */
            )
          ],
          64
          /* STABLE_FRAGMENT */
        )) : _createCommentVNode("v-if", true)
      ])
    ])
  ]);
}
_sfc_main.__hmrId = "5e0b544f";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only } = mod;
  if (_rerender_only) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/SettingsView.vue"]]);

//# sourceMappingURL=data:application/json;base64,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RTdDO0FBQUEsd0JBR007QUFBQSwwQkFIRCxPQUFNLGlCQUFnQjtBQUFBO0FBQUEsMEJBQ3pCLG9CQUFpRSxTQUE1RCxPQUFNLHlDQUF3QyxHQUFDLFNBQU87QUFBQSwwQkFDM0Qsb0JBQXNELFNBQWpELE9BQU0sNkJBQTRCLEdBQUMsVUFBUTtBQUFBOzs7O3NCQUVsRCxhQUEwRTtBQUFBLHdCQUFqRSxNQUFLO0FBQUEsd0JBQXlCLE1BQU07QUFBQSx3QkFBSSxPQUFNO0FBQUE7Ozs7O2tCQUd6RCxvQkFhUztBQUFBLG9CQVpQLE1BQUs7QUFBQSxvQkFDTCxPQUFNO0FBQUEsb0JBQ0wsU0FBTztBQUFBO29CQUVSLG9CQUVNLE9BRk4sYUFFTTtBQUFBLHNCQURKLGFBQTZDO0FBQUEsd0JBQXBDLE1BQUs7QUFBQSx3QkFBbUIsTUFBTTtBQUFBOztnREFFekM7QUFBQSxzQkFHTTtBQUFBLHdCQUhELE9BQU0saUJBQWdCO0FBQUE7QUFBQSx3QkFDekIsb0JBQWdFLFNBQTNELE9BQU0seUNBQXdDLEdBQUMsUUFBTTtBQUFBLHdCQUMxRCxvQkFBMkQsU0FBdEQsT0FBTSw2QkFBNEIsR0FBQyxlQUFhO0FBQUE7Ozs7b0JBRXZELGFBQTBFO0FBQUEsc0JBQWpFLE1BQUs7QUFBQSxzQkFBeUIsTUFBTTtBQUFBLHNCQUFJLE9BQU07QUFBQTs7Ozs7WUFNL0Q7QUFBQSxjQUEwRjtBQUFBLGNBQTFGO0FBQUEsY0FBa0QsYUFBUSxpQkFBRyxpQkFBVSxJQUFHO0FBQUEsY0FBWTtBQUFBO0FBQUE7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiU2V0dGluZ3NWaWV3LnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIG9uQmVmb3JlVW5tb3VudCwgb25Nb3VudGVkLCByZWYgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VSb3V0ZXIgfSBmcm9tICd2dWUtcm91dGVyJ1xuaW1wb3J0IEFwcEljb24gZnJvbSAnQGNvbXBvbmVudHMvQXBwSWNvbi52dWUnXG5pbXBvcnQgVUJhZGdlIGZyb20gJ0Bjb21wb25lbnRzL3VpL1VCYWRnZS52dWUnXG5pbXBvcnQgVUJ1dHRvbiBmcm9tICdAY29tcG9uZW50cy91aS9VQnV0dG9uLnZ1ZSdcbmltcG9ydCBVUHJvZ3Jlc3MgZnJvbSAnQGNvbXBvbmVudHMvdWkvVVByb2dyZXNzLnZ1ZSdcbmltcG9ydCB7IHJlc2V0T25ib2FyZGluZ1N0YXRlIH0gZnJvbSAnLi4vcm91dGVyJ1xuaW1wb3J0IHsgdXNlVGhlbWUsIHR5cGUgVGhlbWUgfSBmcm9tICcuLi9jb21wb3NhYmxlcy91c2VUaGVtZSdcbmltcG9ydCB0eXBlIHsgVXBkYXRlU3RhdHVzLCBVcGRhdGVFdmVudCB9IGZyb20gJy4uL3R5cGVzL3VwZGF0ZSdcbmltcG9ydCB0eXBlIHsgU3lzdGVtSW5mbyB9IGZyb20gJy4uL3R5cGVzL3N5c3RlbSdcbmltcG9ydCB0eXBlIHsgVGVsZW1ldHJ5TW9kZSB9IGZyb20gJy4uL3R5cGVzL2xvZydcblxuLy8g6K6+572u6aG16Z2i5qCH6aKYXG5kb2N1bWVudC50aXRsZSA9ICforr7nva4nXG5cbmNvbnN0IHsgdGhlbWUsIHNldFRoZW1lLCBpbml0VGhlbWUgfSA9IHVzZVRoZW1lKClcbmluaXRUaGVtZSgpXG5cbmNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpXG5cbi8vIOKUgOKUgCBSYXljYXN0IOmjjuagvO+8muW3puS+p+WIhuexu+i+ueagjyDilIDilIBcbmludGVyZmFjZSBTZXR0aW5nc1NlY3Rpb24ge1xuICBpZDogc3RyaW5nXG4gIGxhYmVsOiBzdHJpbmdcbiAgaWNvbjogc3RyaW5nXG59XG5jb25zdCBzZWN0aW9uczogU2V0dGluZ3NTZWN0aW9uW10gPSBbXG4gIHsgaWQ6ICdnZW5lcmFsJywgbGFiZWw6ICfpgJrnlKgnLCBpY29uOiAncmktc2V0dGluZ3MtMy1saW5lJyB9LFxuICB7IGlkOiAnbGF1bmNoZXInLCBsYWJlbDogJ+WQr+WKqOWZqCcsIGljb246ICdyaS1zZWFyY2gtZXllLWxpbmUnIH0sXG4gIHsgaWQ6ICdhaScsIGxhYmVsOiAnQUknLCBpY29uOiAncmktc3BhcmtsaW5nLTItbGluZScgfSxcbiAgeyBpZDogJ2ZvY3VzJywgbGFiZWw6ICfkuJPms6gnLCBpY29uOiAncmktZm9jdXMtMy1saW5lJyB9LFxuICB7IGlkOiAnZXh0ZW5zaW9ucycsIGxhYmVsOiAn5o+S5Lu2JywgaWNvbjogJ3JpLXBsdWctMi1saW5lJyB9LFxuICB7IGlkOiAndXBkYXRlcycsIGxhYmVsOiAn5pu05pawJywgaWNvbjogJ3JpLXJlZnJlc2gtbGluZScgfSxcbiAgeyBpZDogJ2RhdGEnLCBsYWJlbDogJ+aVsOaNricsIGljb246ICdyaS1kYXRhYmFzZS0yLWxpbmUnIH0sXG4gIHsgaWQ6ICdhZHZhbmNlZCcsIGxhYmVsOiAn6auY57qnJywgaWNvbjogJ3JpLWNvZGUtcy1zbGFzaC1saW5lJyB9LFxuICB7IGlkOiAnYWJvdXQnLCBsYWJlbDogJ+WFs+S6jicsIGljb246ICdyaS1pbmZvcm1hdGlvbi1saW5lJyB9XG5dXG5jb25zdCBhY3RpdmVTZWN0aW9uID0gcmVmKCdnZW5lcmFsJylcbmNvbnN0IHNlYXJjaFF1ZXJ5ID0gcmVmKCcnKVxuXG5jb25zdCBmaWx0ZXJlZFNlY3Rpb25zID0gY29tcHV0ZWQoKCkgPT4ge1xuICBpZiAoIXNlYXJjaFF1ZXJ5LnZhbHVlLnRyaW0oKSkgcmV0dXJuIHNlY3Rpb25zXG4gIGNvbnN0IHEgPSBzZWFyY2hRdWVyeS52YWx1ZS50b0xvd2VyQ2FzZSgpXG4gIHJldHVybiBzZWN0aW9ucy5maWx0ZXIoKHMpID0+IHMubGFiZWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSlcbn0pXG5cbi8vIOmHjeaWsOW8gOWni+W8leWvvFxuY29uc3Qgb25SZXN0YXJ0T25ib2FyZGluZyA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLnByZWZlcmVuY2VzLnJlc2V0T25ib2FyZGluZygpXG4gIH0gY2F0Y2gge1xuICAgIC8qIGlnbm9yZSAqL1xuICB9XG4gIHJlc2V0T25ib2FyZGluZ1N0YXRlKClcbiAgYXdhaXQgcm91dGVyLnB1c2goJy9vbmJvYXJkaW5nJylcbn1cblxuY29uc3QgdGhlbWVzOiBBcnJheTx7IGlkOiBUaGVtZTsgbGFiZWw6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZzsgaWNvbjogc3RyaW5nIH0+ID0gW1xuICB7IGlkOiAnbGlnaHQnLCBsYWJlbDogJ+a1heiJsicsIGRlc2NyaXB0aW9uOiAn5aeL57uI5L2/55So5rWF6Imy55WM6Z2iJywgaWNvbjogJ3JpLXN1bi1saW5lJyB9LFxuICB7IGlkOiAnZGFyaycsIGxhYmVsOiAn5rex6ImyJywgZGVzY3JpcHRpb246ICflp4vnu4jkvb/nlKjmt7HoibLnlYzpnaInLCBpY29uOiAncmktbW9vbi1saW5lJyB9LFxuICB7IGlkOiAnYXV0bycsIGxhYmVsOiAn6Lef6ZqP57O757ufJywgZGVzY3JpcHRpb246ICfpmo8gbWFjT1MgLyBXaW5kb3dzIOWIh+aNoicsIGljb246ICdyaS1sYXB0b3AtbGluZScgfVxuXVxuXG5jb25zdCBvblNlbGVjdFRoZW1lID0gYXN5bmMgKGlkOiBUaGVtZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCBzZXRUaGVtZShpZClcbn1cblxuLy8g5bqU55So54mI5pysXG5jb25zdCBhcHBWZXJzaW9uID0gcmVmKCfigJQnKVxuY29uc3Qgc3lzdGVtSW5mbyA9IHJlZjxTeXN0ZW1JbmZvIHwgbnVsbD4obnVsbClcblxuLy8g4pSA4pSAIOS4k+azqOaKpOebviDilIDilIBcbmNvbnN0IHNoaWVsZEVuYWJsZWQgPSByZWYoZmFsc2UpXG5jb25zdCBzaGllbGRTdXBwb3J0ZWQgPSByZWYodHJ1ZSlcbmNvbnN0IHNoaWVsZFdlYnNpdGVTdXBwb3J0ZWQgPSByZWYodHJ1ZSlcbmNvbnN0IHNoaWVsZEFwcHNEcmFmdCA9IHJlZignJylcbmNvbnN0IHNoaWVsZFdlYnNpdGVzRHJhZnQgPSByZWYoJycpXG5cbi8vIOKUgOKUgCBBSSDphY3nva4g4pSA4pSAXG5jb25zdCBhaUVuYWJsZWQgPSByZWYoZmFsc2UpXG5jb25zdCBhaUFwaUtleSA9IHJlZignJylcbmNvbnN0IGFpQmFzZVVybCA9IHJlZignaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MScpXG5jb25zdCBhaU1vZGVsID0gcmVmKCdncHQtNG8tbWluaScpXG5jb25zdCBhaVN5c3RlbVByb21wdCA9IHJlZign5L2g5piv5LiA5Liq566A5rSB6auY5pWI55qE5Yqp5omL77yM5Zue562U5bC96YeP566A55+t55u05o6l44CCJylcbmNvbnN0IGFpVGVtcGVyYXR1cmUgPSByZWYoMC43KVxuY29uc3QgYWlTYXZpbmcgPSByZWYoZmFsc2UpXG5jb25zdCBhaVNhdmVNc2cgPSByZWYoJycpXG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRBSUNvbmZpZygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjZmcgPSAoYXdhaXQgd2luZG93LmFwaS5haS5nZXRDb25maWcoKSkgYXMge1xuICAgICAgZW5hYmxlZDogYm9vbGVhblxuICAgICAgYXBpS2V5OiBzdHJpbmdcbiAgICAgIGJhc2VVcmw6IHN0cmluZ1xuICAgICAgbW9kZWw6IHN0cmluZ1xuICAgICAgc3lzdGVtUHJvbXB0OiBzdHJpbmdcbiAgICAgIHRlbXBlcmF0dXJlOiBudW1iZXJcbiAgICB9XG4gICAgYWlFbmFibGVkLnZhbHVlID0gY2ZnLmVuYWJsZWRcbiAgICBhaUFwaUtleS52YWx1ZSA9IGNmZy5hcGlLZXlcbiAgICBhaUJhc2VVcmwudmFsdWUgPSBjZmcuYmFzZVVybFxuICAgIGFpTW9kZWwudmFsdWUgPSBjZmcubW9kZWxcbiAgICBhaVN5c3RlbVByb21wdC52YWx1ZSA9IGNmZy5zeXN0ZW1Qcm9tcHRcbiAgICBhaVRlbXBlcmF0dXJlLnZhbHVlID0gY2ZnLnRlbXBlcmF0dXJlXG4gIH0gY2F0Y2gge1xuICAgIC8qIEFJIOmFjee9ruivu+WPluWksei0pSAqL1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhdmVBSUNvbmZpZygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYWlTYXZpbmcudmFsdWUgPSB0cnVlXG4gIGFpU2F2ZU1zZy52YWx1ZSA9ICcnXG4gIHRyeSB7XG4gICAgYXdhaXQgd2luZG93LmFwaS5haS5zZXRDb25maWcoe1xuICAgICAgZW5hYmxlZDogYWlFbmFibGVkLnZhbHVlLFxuICAgICAgYXBpS2V5OiBhaUFwaUtleS52YWx1ZSxcbiAgICAgIGJhc2VVcmw6IGFpQmFzZVVybC52YWx1ZSxcbiAgICAgIG1vZGVsOiBhaU1vZGVsLnZhbHVlLFxuICAgICAgc3lzdGVtUHJvbXB0OiBhaVN5c3RlbVByb21wdC52YWx1ZSxcbiAgICAgIHRlbXBlcmF0dXJlOiBOdW1iZXIoYWlUZW1wZXJhdHVyZS52YWx1ZSlcbiAgICB9KVxuICAgIGFpU2F2ZU1zZy52YWx1ZSA9ICflt7Lkv53lrZgnXG4gICAgc2V0VGltZW91dCgoKSA9PiB7IGFpU2F2ZU1zZy52YWx1ZSA9ICcnIH0sIDIwMDApXG4gIH0gY2F0Y2gge1xuICAgIGFpU2F2ZU1zZy52YWx1ZSA9ICfkv53lrZjlpLHotKUnXG4gIH0gZmluYWxseSB7XG4gICAgYWlTYXZpbmcudmFsdWUgPSBmYWxzZVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRTaGllbGRDb25maWcoKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY2ZnID0gYXdhaXQgd2luZG93LmFwaS5mb2N1c1NoaWVsZC5nZXRDb25maWcoKVxuICAgIHNoaWVsZEVuYWJsZWQudmFsdWUgPSBjZmcuZW5hYmxlZFxuICAgIHNoaWVsZFN1cHBvcnRlZC52YWx1ZSA9IGNmZy5zdXBwb3J0ZWRcbiAgICBzaGllbGRXZWJzaXRlU3VwcG9ydGVkLnZhbHVlID0gY2ZnLndlYnNpdGVCbG9ja1N1cHBvcnRlZCA/PyB0cnVlXG4gICAgc2hpZWxkQXBwc0RyYWZ0LnZhbHVlID0gY2ZnLmFwcHMuam9pbignLCAnKVxuICAgIHNoaWVsZFdlYnNpdGVzRHJhZnQudmFsdWUgPSAoY2ZnLndlYnNpdGVzID8/IFtdKS5qb2luKCcsICcpXG4gIH0gY2F0Y2gge1xuICAgIHNoaWVsZFN1cHBvcnRlZC52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlU2hpZWxkRW5hYmxlZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgbmV4dCA9ICFzaGllbGRFbmFibGVkLnZhbHVlXG4gIHRyeSB7XG4gICAgY29uc3QgY2ZnID0gYXdhaXQgd2luZG93LmFwaS5mb2N1c1NoaWVsZC5zZXRDb25maWcoeyBlbmFibGVkOiBuZXh0IH0pXG4gICAgc2hpZWxkRW5hYmxlZC52YWx1ZSA9IGNmZy5lbmFibGVkXG4gIH0gY2F0Y2gge1xuICAgIC8qIOiuvue9ruWksei0peS/neaMgeWOn+eKtuaAgSAqL1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNhdmVTaGllbGRBcHBzKCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBhcHBzID0gc2hpZWxkQXBwc0RyYWZ0LnZhbHVlXG4gICAgLnNwbGl0KC9bLO+8jFxcbl0vKVxuICAgIC5tYXAoKHMpID0+IHMudHJpbSgpKVxuICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgc2hpZWxkQXBwc0RyYWZ0LnZhbHVlID0gYXBwcy5qb2luKCcsICcpXG4gIHRyeSB7XG4gICAgY29uc3QgY2ZnID0gYXdhaXQgd2luZG93LmFwaS5mb2N1c1NoaWVsZC5zZXRDb25maWcoeyBhcHBzIH0pXG4gICAgc2hpZWxkQXBwc0RyYWZ0LnZhbHVlID0gY2ZnLmFwcHMuam9pbignLCAnKVxuICB9IGNhdGNoIHtcbiAgICAvKiBpZ25vcmUgKi9cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlU2hpZWxkV2Vic2l0ZXMoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHdlYnNpdGVzID0gc2hpZWxkV2Vic2l0ZXNEcmFmdC52YWx1ZVxuICAgIC5zcGxpdCgvWyzvvIxcXG5dLylcbiAgICAubWFwKChzKSA9PiBzLnRyaW0oKSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pXG4gIHNoaWVsZFdlYnNpdGVzRHJhZnQudmFsdWUgPSB3ZWJzaXRlcy5qb2luKCcsICcpXG4gIHRyeSB7XG4gICAgY29uc3QgY2ZnID0gYXdhaXQgd2luZG93LmFwaS5mb2N1c1NoaWVsZC5zZXRDb25maWcoeyB3ZWJzaXRlcyB9KVxuICAgIHNoaWVsZFdlYnNpdGVzRHJhZnQudmFsdWUgPSAoY2ZnLndlYnNpdGVzID8/IFtdKS5qb2luKCcsICcpXG4gIH0gY2F0Y2gge1xuICAgIC8qIGlnbm9yZSAqL1xuICB9XG59XG5cbm9uTW91bnRlZChhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgYXBwVmVyc2lvbi52YWx1ZSA9IGF3YWl0IHdpbmRvdy5hcGkudXBkYXRlLmdldEN1cnJlbnRWZXJzaW9uKClcbiAgfSBjYXRjaCB7XG4gICAgLyogaWdub3JlICovXG4gIH1cbiAgdHJ5IHtcbiAgICBzeXN0ZW1JbmZvLnZhbHVlID0gYXdhaXQgd2luZG93LmFwaS5zeXN0ZW0uaW5mbygpXG4gIH0gY2F0Y2gge1xuICAgIC8qIGlnbm9yZSAqL1xuICB9XG4gIHZvaWQgbG9hZFNoaWVsZENvbmZpZygpXG4gIHZvaWQgbG9hZEFJQ29uZmlnKClcbn0pXG5cbmNvbnN0IG9uT3BlbkRhdGFEaXIgPSAoKTogdm9pZCA9PiB7XG4gIGlmIChzeXN0ZW1JbmZvLnZhbHVlPy51c2VyRGF0YVBhdGgpIHtcbiAgICB2b2lkIHdpbmRvdy5hcGkuc3lzdGVtLm9wZW5QYXRoKHN5c3RlbUluZm8udmFsdWUudXNlckRhdGFQYXRoKVxuICB9XG59XG5cbmNvbnN0IG9uT3BlbkxlZ2FjeURpciA9ICgpOiB2b2lkID0+IHtcbiAgaWYgKHN5c3RlbUluZm8udmFsdWU/LmxlZ2FjeUFyY2hpdmVQYXRoKSB7XG4gICAgdm9pZCB3aW5kb3cuYXBpLnN5c3RlbS5vcGVuUGF0aChzeXN0ZW1JbmZvLnZhbHVlLmxlZ2FjeUFyY2hpdmVQYXRoKVxuICB9XG59XG5cbi8vIOKUgOKUgCDml6Xlv5cgLyDlj43ppogg4pSA4pSAXG5jb25zdCB0ZWxlbWV0cnlNb2RlID0gcmVmPFRlbGVtZXRyeU1vZGU+KCdsb2NhbCcpXG5cbm9uTW91bnRlZChhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgdGVsZW1ldHJ5TW9kZS52YWx1ZSA9IGF3YWl0IHdpbmRvdy5hcGkubG9nLmdldE1vZGUoKVxuICB9IGNhdGNoIHtcbiAgICAvKiBpZ25vcmUgKi9cbiAgfVxufSlcblxuY29uc3QgdGVsZW1ldHJ5T3B0aW9uczogQXJyYXk8e1xuICBpZDogVGVsZW1ldHJ5TW9kZVxuICBsYWJlbDogc3RyaW5nXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmdcbn0+ID0gW1xuICB7IGlkOiAnbG9jYWwnLCBsYWJlbDogJ+acrOWcsO+8iOaOqOiNkO+8iScsIGRlc2NyaXB0aW9uOiAn6ZSZ6K+v5pel5b+X5L+d5a2Y5Yiw5pys5py6IFNRTGl0Ze+8jOmHjeWQr+WPr+a4heOAgicgfSxcbiAgeyBpZDogJ29mZicsIGxhYmVsOiAn5YWz6ZetJywgZGVzY3JpcHRpb246ICflj6rkv53nlZnlhoXlrZggcmluZyBidWZmZXLvvIzph43lkK/ljbPmuIXpm7bjgIInIH0sXG4gIHsgaWQ6ICdyZW1vdGUnLCBsYWJlbDogJ+i/nOeoi++8iDEuMCDmmoLmnKrlkK/nlKjvvIknLCBkZXNjcmlwdGlvbjogJ+WcqOacrOWcsOWfuuehgOS4iumihOeVmei/nOeoi+mAmumBk++8m+W9k+WJjeetieWQjOacrOWcsOOAgicgfVxuXVxuXG5jb25zdCBvblNlbGVjdFRlbGVtZXRyeSA9IGFzeW5jIChpZDogVGVsZW1ldHJ5TW9kZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zdCBwcmV2ID0gdGVsZW1ldHJ5TW9kZS52YWx1ZVxuICB0ZWxlbWV0cnlNb2RlLnZhbHVlID0gaWRcbiAgdHJ5IHtcbiAgICB0ZWxlbWV0cnlNb2RlLnZhbHVlID0gYXdhaXQgd2luZG93LmFwaS5sb2cuc2V0TW9kZShpZClcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybignW1NldHRpbmdzVmlld10gc2V0TW9kZSBmYWlsZWQ6JywgZSlcbiAgICB0ZWxlbWV0cnlNb2RlLnZhbHVlID0gcHJldlxuICB9XG59XG5cbmNvbnN0IG9uRXhwb3J0TG9ncyA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLmxvZy5leHBvcnQoKVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKCdbU2V0dGluZ3NWaWV3XSBleHBvcnQgZmFpbGVkOicsIGUpXG4gIH1cbn1cblxuLy8g4pSA4pSAIOiHquWKqOabtOaWsCDilIDilIBcbmNvbnN0IHVwZGF0ZVN0YXR1cyA9IHJlZjxVcGRhdGVTdGF0dXM+KCdpZGxlJylcbmNvbnN0IHVwZGF0ZVZlcnNpb24gPSByZWY8c3RyaW5nPignJylcbmNvbnN0IHVwZGF0ZVByb2dyZXNzID0gcmVmPG51bWJlcj4oMClcbmNvbnN0IHVwZGF0ZUVycm9yID0gcmVmPHN0cmluZz4oJycpXG5cbmxldCB1bnN1YnNjcmliZTogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGxcbm9uTW91bnRlZCgoKSA9PiB7XG4gIHVuc3Vic2NyaWJlID0gd2luZG93LmFwaS51cGRhdGUub25FdmVudCgoZTogVXBkYXRlRXZlbnQpID0+IHtcbiAgICB1cGRhdGVTdGF0dXMudmFsdWUgPSBlLnN0YXR1c1xuICAgIHVwZGF0ZUVycm9yLnZhbHVlID0gZS5lcnJvciA/PyAnJ1xuICAgIGlmIChlLnZlcnNpb24pIHVwZGF0ZVZlcnNpb24udmFsdWUgPSBlLnZlcnNpb25cbiAgICBpZiAoZS5wcm9ncmVzcykgdXBkYXRlUHJvZ3Jlc3MudmFsdWUgPSBNYXRoLnJvdW5kKGUucHJvZ3Jlc3MucGVyY2VudClcbiAgfSlcbiAgd2luZG93LmFwaS51cGRhdGVcbiAgICAuZ2V0U3RhdHVzKClcbiAgICAudGhlbigocykgPT4gKHVwZGF0ZVN0YXR1cy52YWx1ZSA9IHMpKVxuICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAvKiBpZ25vcmUgKi9cbiAgICB9KVxufSlcblxub25CZWZvcmVVbm1vdW50KCgpID0+IHtcbiAgdW5zdWJzY3JpYmU/LigpXG59KVxuXG5jb25zdCBvbkNoZWNrVXBkYXRlID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBhd2FpdCB3aW5kb3cuYXBpLnVwZGF0ZS5jaGVjaygpXG59XG5cbmNvbnN0IG9uRG93bmxvYWQgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IHdpbmRvdy5hcGkudXBkYXRlLmRvd25sb2FkKClcbn1cblxuY29uc3Qgb25JbnN0YWxsID0gKCk6IHZvaWQgPT4ge1xuICB3aW5kb3cuYXBpLnVwZGF0ZS5pbnN0YWxsKClcbn1cblxuY29uc3Qgc3RhdHVzVGV4dCA9IChzOiBVcGRhdGVTdGF0dXMpOiBzdHJpbmcgPT4ge1xuICBzd2l0Y2ggKHMpIHtcbiAgICBjYXNlICdpZGxlJzogcmV0dXJuICfmnKrmo4Dmn6UnXG4gICAgY2FzZSAnY2hlY2tpbmcnOiByZXR1cm4gJ+ajgOafpeS4reKApidcbiAgICBjYXNlICdhdmFpbGFibGUnOiByZXR1cm4gYOacieWPr+eUqOabtOaWsCB2JHt1cGRhdGVWZXJzaW9uLnZhbHVlfWBcbiAgICBjYXNlICdub3QtYXZhaWxhYmxlJzogcmV0dXJuICflt7LmmK/mnIDmlrDniYjmnKwnXG4gICAgY2FzZSAnZG93bmxvYWRpbmcnOiByZXR1cm4gYOS4i+i9veS4rSAke3VwZGF0ZVByb2dyZXNzLnZhbHVlfSVgXG4gICAgY2FzZSAnZG93bmxvYWRlZCc6IHJldHVybiBg5bey5LiL6L29IHYke3VwZGF0ZVZlcnNpb24udmFsdWV977yM54K55Ye76YeN5ZCv5a6J6KOFYFxuICAgIGNhc2UgJ2Vycm9yJzogcmV0dXJuIGDplJnor6/vvJoke3VwZGF0ZUVycm9yLnZhbHVlfWBcbiAgICBkZWZhdWx0OiByZXR1cm4gc1xuICB9XG59XG5cbmNvbnN0IGNhbkNoZWNrID0gKCk6IGJvb2xlYW4gPT5cbiAgdXBkYXRlU3RhdHVzLnZhbHVlID09PSAnaWRsZScgfHxcbiAgdXBkYXRlU3RhdHVzLnZhbHVlID09PSAnbm90LWF2YWlsYWJsZScgfHxcbiAgdXBkYXRlU3RhdHVzLnZhbHVlID09PSAnZXJyb3InXG5jb25zdCBjYW5Eb3dubG9hZCA9ICgpOiBib29sZWFuID0+IHVwZGF0ZVN0YXR1cy52YWx1ZSA9PT0gJ2F2YWlsYWJsZSdcbmNvbnN0IGNhbkluc3RhbGwgPSAoKTogYm9vbGVhbiA9PiB1cGRhdGVTdGF0dXMudmFsdWUgPT09ICdkb3dubG9hZGVkJ1xuPC9zY3JpcHQ+XG5cbjx0ZW1wbGF0ZT5cbiAgPGRpdiBjbGFzcz1cIlJheWNhc3RTZXR0aW5ncyBmbGV4IGgtc2NyZWVuIG92ZXJmbG93LWhpZGRlbiBiZy1bI2Y1ZjVmN10gdGV4dC1bIzFkMWQxZl1cIj5cbiAgICA8IS0tIOKVkOKVkOKVkCDlt6bkvqfovrnmoI/vvIhSYXljYXN0IOmjjuagvO+8ieKVkOKVkOKVkCAtLT5cbiAgICA8YXNpZGUgY2xhc3M9XCJmbGV4IHctWzIwMHB4XSBzaHJpbmstMCBmbGV4LWNvbCBib3JkZXItciBib3JkZXItYmxhY2svWzAuMDZdIGJnLVsjZjVmNWY3XVwiPlxuICAgICAgPCEtLSDmkJzntKLmoYYgLS0+XG4gICAgICA8ZGl2IGNsYXNzPVwicC0zXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiByb3VuZGVkLWxnIGJnLXdoaXRlLzYwIHB4LTIuNSBweS0xLjUgcmluZy0xIHJpbmctYmxhY2svWzAuMDZdXCI+XG4gICAgICAgICAgPEFwcEljb24gaWNvbj1cInJpLXNlYXJjaC1saW5lXCIgOnNpemU9XCIxNFwiIGNsYXNzPVwic2hyaW5rLTAgdGV4dC1bIzg2ODY4Yl1cIiAvPlxuICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgdi1tb2RlbD1cInNlYXJjaFF1ZXJ5XCJcbiAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICAgIGNsYXNzPVwiZmxleC0xIGJnLXRyYW5zcGFyZW50IHRleHQtWzEzcHhdIHRleHQtWyMxZDFkMWZdIHBsYWNlaG9sZGVyOnRleHQtWyM4Njg2OGJdIGZvY3VzOm91dGxpbmUtbm9uZVwiXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIuaQnOe0ouiuvue9ruKAplwiXG4gICAgICAgICAgICBzcGVsbGNoZWNrPVwiZmFsc2VcIlxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDwhLS0g5YiG57G75YiX6KGoIC0tPlxuICAgICAgPG5hdiBjbGFzcz1cImZsZXgtMSBvdmVyZmxvdy15LWF1dG8gcHgtMiBwYi0zXCI+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICB2LWZvcj1cInNlY3Rpb24gaW4gZmlsdGVyZWRTZWN0aW9uc1wiXG4gICAgICAgICAgOmtleT1cInNlY3Rpb24uaWRcIlxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzPVwibWItMC41IGZsZXggdy1mdWxsIGl0ZW1zLWNlbnRlciBnYXAtMi41IHJvdW5kZWQtbWQgcHgtMi41IHB5LTEuNSB0ZXh0LWxlZnQgdGV4dC1bMTNweF0gdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgIDpjbGFzcz1cImFjdGl2ZVNlY3Rpb24gPT09IHNlY3Rpb24uaWQgPyAnYmctWyMwMDdhZmZdLzE1IHRleHQtWyMwMDdhZmZdIGZvbnQtbWVkaXVtJyA6ICd0ZXh0LVsjMWQxZDFmXSBob3ZlcjpiZy1ibGFjay9bMC4wNF0nXCJcbiAgICAgICAgICBAY2xpY2s9XCJhY3RpdmVTZWN0aW9uID0gc2VjdGlvbi5pZFwiXG4gICAgICAgID5cbiAgICAgICAgICA8QXBwSWNvbiA6aWNvbj1cInNlY3Rpb24uaWNvblwiIDpzaXplPVwiMTZcIiBjbGFzcz1cInNocmluay0wXCIgLz5cbiAgICAgICAgICA8c3BhbiBjbGFzcz1cImZsZXgtMSB0cnVuY2F0ZVwiPnt7IHNlY3Rpb24ubGFiZWwgfX08L3NwYW4+XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9uYXY+XG5cbiAgICAgIDwhLS0g5bqV6YOo54mI5pys5L+h5oGvIC0tPlxuICAgICAgPGRpdiBjbGFzcz1cImJvcmRlci10IGJvcmRlci1ibGFjay9bMC4wNl0gcHgtNCBweS0zXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxMXB4XSB0ZXh0LVsjODY4NjhiXVwiPkxlYWYgdnt7IGFwcFZlcnNpb24gfX08L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvYXNpZGU+XG5cbiAgICA8IS0tIOKVkOKVkOKVkCDlj7PkvqflhoXlrrnljLog4pWQ4pWQ4pWQIC0tPlxuICAgIDxtYWluIGNsYXNzPVwiZmxleC0xIG92ZXJmbG93LXktYXV0b1wiPlxuICAgICAgPGRpdiBjbGFzcz1cIm14LWF1dG8gdy1mdWxsIG1heC13LVs1MjBweF0gcHgtNiBweS04XCI+XG4gICAgICAgIDwhLS0g4pWQ4pWQ4pWQIOmAmueUqCDilZDilZDilZAgLS0+XG4gICAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwiYWN0aXZlU2VjdGlvbiA9PT0gJ2dlbmVyYWwnXCI+XG4gICAgICAgICAgPGgxIGNsYXNzPVwibWItMSB0ZXh0LVsyOHB4XSBmb250LXNlbWlib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtWyMxZDFkMWZdXCI+6YCa55SoPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cIm1iLTggdGV4dC1bMTRweF0gdGV4dC1bIzg2ODY4Yl1cIj7lpJbop4LkuI7nlYzpnaLlgY/lpb3jgII8L3A+XG5cbiAgICAgICAgICA8IS0tIOWkluingiAtLT5cbiAgICAgICAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLThcIj5cbiAgICAgICAgICAgIDxoMiBjbGFzcz1cIm1iLTMgdGV4dC1bMTJweF0gZm9udC1tZWRpdW0gdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHRleHQtWyM4Njg2OGJdXCI+5aSW6KeCPC9oMj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC14bCBiZy13aGl0ZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRpdmlkZS15IGRpdmlkZS1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB2LWZvcj1cInQgaW4gdGhlbWVzXCJcbiAgICAgICAgICAgICAgICAgIDprZXk9XCJ0LmlkXCJcbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmbGV4IHctZnVsbCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtNCBweS0zIHRleHQtbGVmdCB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy1ibGFjay9bMC4wMl1cIlxuICAgICAgICAgICAgICAgICAgQGNsaWNrPVwib25TZWxlY3RUaGVtZSh0LmlkKVwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggc2l6ZS04IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIGJnLVsjZjVmNWY3XSB0ZXh0LVsjODY4NjhiXVwiPlxuICAgICAgICAgICAgICAgICAgICA8QXBwSWNvbiA6aWNvbj1cInQuaWNvblwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+e3sgdC5sYWJlbCB9fTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibXQtMC41IHRleHQtWzEycHhdIHRleHQtWyM4Njg2OGJdXCI+e3sgdC5kZXNjcmlwdGlvbiB9fTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IHYtaWY9XCJ0aGVtZSA9PT0gdC5pZFwiIGNsYXNzPVwiZmxleCBzaXplLTUgc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtZnVsbCBiZy1bIzAwN2FmZl1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInJpLWNoZWNrLWxpbmVcIiA6c2l6ZT1cIjEyXCIgY2xhc3M9XCJ0ZXh0LXdoaXRlXCIgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvc2VjdGlvbj5cbiAgICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgICA8IS0tIOKVkOKVkOKVkCDlkK/liqjlmagg4pWQ4pWQ4pWQIC0tPlxuICAgICAgICA8dGVtcGxhdGUgdi1lbHNlLWlmPVwiYWN0aXZlU2VjdGlvbiA9PT0gJ2xhdW5jaGVyJ1wiPlxuICAgICAgICAgIDxoMSBjbGFzcz1cIm1iLTEgdGV4dC1bMjhweF0gZm9udC1zZW1pYm9sZCB0cmFja2luZy10aWdodCB0ZXh0LVsjMWQxZDFmXVwiPuWQr+WKqOWZqDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJtYi04IHRleHQtWzE0cHhdIHRleHQtWyM4Njg2OGJdXCI+5YWo5bGA5pCc57Si44CB5o+S5Lu25ZG95Luk5LiO5b+r5o236ZSu44CCPC9wPlxuXG4gICAgICAgICAgPHNlY3Rpb24gY2xhc3M9XCJtYi04XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3ctaGlkZGVuIHJvdW5kZWQteGwgYmctd2hpdGUgcmluZy0xIHJpbmctYmxhY2svWzAuMDZdXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTNcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBzaXplLTggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgYmctWyMwMDdhZmZdLzEwIHRleHQtWyMwMDdhZmZdXCI+XG4gICAgICAgICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwicmktc2VhcmNoLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxNHB4XSBmb250LW1lZGl1bSB0ZXh0LVsjMWQxZDFmXVwiPuiDtuWbiuWQr+WKqOWPsOS4juaPkuS7tjwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPlxuICAgICAgICAgICAgICAgICAgICDlhajlsYDmkJzntKIgLyDmj5Lku7blkb3ku6QgLyBXZWJEQVYg5ZCM5q2l77yM5Z2H5Zyo5ZCv5Yqo5Zmo566h55CG6aG16YWN572uXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8VUJ1dHRvbiBzaXplPVwic21cIiB2YXJpYW50PVwic2Vjb25kYXJ5XCIgQGNsaWNrPVwicm91dGVyLnB1c2goJy9sYXVuY2hlcicpXCI+566h55CG5o+S5Lu2PC9VQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvc2VjdGlvbj5cbiAgICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgICA8IS0tIOKVkOKVkOKVkCBBSSDilZDilZDilZAgLS0+XG4gICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2UtaWY9XCJhY3RpdmVTZWN0aW9uID09PSAnYWknXCI+XG4gICAgICAgICAgPGgxIGNsYXNzPVwibWItMSB0ZXh0LVsyOHB4XSBmb250LXNlbWlib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtWyMxZDFkMWZdXCI+QUk8L2gxPlxuICAgICAgICAgIDxwIGNsYXNzPVwibWItOCB0ZXh0LVsxNHB4XSB0ZXh0LVsjODY4NjhiXVwiPkFJIOWKqeaJi+mFjee9ruOAgk9wZW5BSSDlhbzlrrkgQVBJ77yM5pSv5oyBIERlZXBTZWVrIC8g6YCa5LmJIC8gT2xsYW1hIOetieOAgjwvcD5cblxuICAgICAgICAgIDxzZWN0aW9uIGNsYXNzPVwibWItOFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LWhpZGRlbiByb3VuZGVkLXhsIGJnLXdoaXRlIHJpbmctMSByaW5nLWJsYWNrL1swLjA2XVwiPlxuICAgICAgICAgICAgICA8IS0tIOWQr+eUqOW8gOWFsyAtLT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIGJvcmRlci1iIGJvcmRlci1ibGFjay9bMC4wNl0gcHgtNCBweS0zXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggc2l6ZS04IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIGJnLVsjMDA3YWZmXS8xMCB0ZXh0LVsjMDA3YWZmXVwiPlxuICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInNwYXJrbGluZy0yLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxNHB4XSBmb250LW1lZGl1bSB0ZXh0LVsjMWQxZDFmXVwiPkFJIOWKqeaJizwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPumFjee9ruS7heWtmOacrOacujwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgcm9sZT1cInN3aXRjaFwiXG4gICAgICAgICAgICAgICAgICA6YXJpYS1jaGVja2VkPVwiYWlFbmFibGVkXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVsYXRpdmUgaC1bMjhweF0gdy1bNDZweF0gc2hyaW5rLTAgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgIDpjbGFzcz1cImFpRW5hYmxlZCA/ICdiZy1bIzM0Yzc1OV0nIDogJ2JnLVsjZTllOWViXSdcIlxuICAgICAgICAgICAgICAgICAgQGNsaWNrPVwiYWlFbmFibGVkID0gIWFpRW5hYmxlZFwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSB0b3AtWzJweF0gc2l6ZS02IHJvdW5kZWQtZnVsbCBiZy13aGl0ZSBzaGFkb3ctc20gdHJhbnNpdGlvbi1hbGxcIlxuICAgICAgICAgICAgICAgICAgICA6Y2xhc3M9XCJhaUVuYWJsZWQgPyAnbGVmdC1bMjBweF0nIDogJ2xlZnQtWzJweF0nXCJcbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDwhLS0g6YWN572u6KGo5Y2VIC0tPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic3BhY2UteS00IHB4LTQgcHktNFwiPlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJtYi0xLjUgYmxvY2sgdGV4dC1bMTJweF0gZm9udC1tZWRpdW0gdGV4dC1bIzg2ODY4Yl1cIj5BUEkgS2V5PC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICB2LW1vZGVsPVwiYWlBcGlLZXlcIlxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwicGFzc3dvcmRcIlxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cInNrLS4uLlwiXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwidy1mdWxsIHJvdW5kZWQtbGcgYmctWyNmNWY1ZjddIHB4LTMgcHktMiB0ZXh0LVsxM3B4XSB0ZXh0LVsjMWQxZDFmXSBvdXRsaW5lLW5vbmUgcmluZy0xIHJpbmctYmxhY2svWzAuMDZdIHRyYW5zaXRpb24tYWxsIGZvY3VzOnJpbmctWyMwMDdhZmZdLzUwXCJcbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC1jb2xzLTIgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cIm1iLTEuNSBibG9jayB0ZXh0LVsxMnB4XSBmb250LW1lZGl1bSB0ZXh0LVsjODY4NjhiXVwiPkJhc2UgVVJMPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgdi1tb2RlbD1cImFpQmFzZVVybFwiXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MVwiXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgcm91bmRlZC1sZyBiZy1bI2Y1ZjVmN10gcHgtMyBweS0yIGZvbnQtbW9ubyB0ZXh0LVsxMnB4XSB0ZXh0LVsjMWQxZDFmXSBvdXRsaW5lLW5vbmUgcmluZy0xIHJpbmctYmxhY2svWzAuMDZdIHRyYW5zaXRpb24tYWxsIGZvY3VzOnJpbmctWyMwMDdhZmZdLzUwXCJcbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwibWItMS41IGJsb2NrIHRleHQtWzEycHhdIGZvbnQtbWVkaXVtIHRleHQtWyM4Njg2OGJdXCI+5qih5Z6LPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgdi1tb2RlbD1cImFpTW9kZWxcIlxuICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cImdwdC00by1taW5pXCJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCByb3VuZGVkLWxnIGJnLVsjZjVmNWY3XSBweC0zIHB5LTIgZm9udC1tb25vIHRleHQtWzEycHhdIHRleHQtWyMxZDFkMWZdIG91dGxpbmUtbm9uZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl0gdHJhbnNpdGlvbi1hbGwgZm9jdXM6cmluZy1bIzAwN2FmZl0vNTBcIlxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cIm1iLTEuNSBibG9jayB0ZXh0LVsxMnB4XSBmb250LW1lZGl1bSB0ZXh0LVsjODY4NjhiXVwiPuezu+e7n+aPkOekuuivjTwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcbiAgICAgICAgICAgICAgICAgICAgdi1tb2RlbD1cImFpU3lzdGVtUHJvbXB0XCJcbiAgICAgICAgICAgICAgICAgICAgcm93cz1cIjJcIlxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCByZXNpemUtbm9uZSByb3VuZGVkLWxnIGJnLVsjZjVmNWY3XSBweC0zIHB5LTIgdGV4dC1bMTNweF0gdGV4dC1bIzFkMWQxZl0gb3V0bGluZS1ub25lIHJpbmctMSByaW5nLWJsYWNrL1swLjA2XSB0cmFuc2l0aW9uLWFsbCBmb2N1czpyaW5nLVsjMDA3YWZmXS81MFwiXG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidGV4dC1bMTJweF0gZm9udC1tZWRpdW0gdGV4dC1bIzg2ODY4Yl1cIj7muKnluqYge3sgYWlUZW1wZXJhdHVyZSB9fTwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8aW5wdXQgdi1tb2RlbC5udW1iZXI9XCJhaVRlbXBlcmF0dXJlXCIgdHlwZT1cInJhbmdlXCIgbWluPVwiMFwiIG1heD1cIjJcIiBzdGVwPVwiMC4xXCIgY2xhc3M9XCJmbGV4LTFcIiAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxuICAgICAgICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cInByaW1hcnlcIiA6bG9hZGluZz1cImFpU2F2aW5nXCIgQGNsaWNrPVwic2F2ZUFJQ29uZmlnXCI+5L+d5a2Y6YWN572uPC9VQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gdi1pZj1cImFpU2F2ZU1zZ1wiIGNsYXNzPVwidGV4dC1bMTJweF0gdGV4dC1bIzg2ODY4Yl1cIj57eyBhaVNhdmVNc2cgfX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9zZWN0aW9uPlxuICAgICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICAgIDwhLS0g4pWQ4pWQ4pWQIOS4k+azqCDilZDilZDilZAgLS0+XG4gICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2UtaWY9XCJhY3RpdmVTZWN0aW9uID09PSAnZm9jdXMnXCI+XG4gICAgICAgICAgPGgxIGNsYXNzPVwibWItMSB0ZXh0LVsyOHB4XSBmb250LXNlbWlib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtWyMxZDFkMWZdXCI+5LiT5rOoPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cIm1iLTggdGV4dC1bMTRweF0gdGV4dC1bIzg2ODY4Yl1cIj7nlarojITpkp/kuJPms6jml7blsY/olL3lubLmibDlupTnlKjlkoznvZHnq5njgII8L3A+XG5cbiAgICAgICAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLThcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC14bCBiZy13aGl0ZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgPCEtLSDlkK/nlKjlvIDlhbMgLS0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBib3JkZXItYiBib3JkZXItYmxhY2svWzAuMDZdIHB4LTQgcHktM1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBiZy1bI2ZmOTUwMF0vMTAgdGV4dC1bI2ZmOTUwMF1cIj5cbiAgICAgICAgICAgICAgICAgIDxBcHBJY29uIGljb249XCJyaS1zaGllbGQtbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+5LiT5rOo5oqk55u+PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibXQtMC41IHRleHQtWzEycHhdIHRleHQtWyM4Njg2OGJdXCI+XG4gICAgICAgICAgICAgICAgICAgIOW3peS9nOiuoeaXtui/m+ihjOS4re+8jOa4heWNleWGheW6lOeUqC/nvZHnq5nliIfliLDliY3lj7DljbPlvLnlh7rlhajlsY/mj5DphpJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgcm9sZT1cInN3aXRjaFwiXG4gICAgICAgICAgICAgICAgICA6YXJpYS1jaGVja2VkPVwic2hpZWxkRW5hYmxlZFwiXG4gICAgICAgICAgICAgICAgICA6ZGlzYWJsZWQ9XCIhc2hpZWxkU3VwcG9ydGVkXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwicmVsYXRpdmUgaC1bMjhweF0gdy1bNDZweF0gc2hyaW5rLTAgcm91bmRlZC1mdWxsIHRyYW5zaXRpb24tY29sb3JzIGRpc2FibGVkOm9wYWNpdHktNDBcIlxuICAgICAgICAgICAgICAgICAgOmNsYXNzPVwic2hpZWxkRW5hYmxlZCA/ICdiZy1bIzM0Yzc1OV0nIDogJ2JnLVsjZTllOWViXSdcIlxuICAgICAgICAgICAgICAgICAgQGNsaWNrPVwidG9nZ2xlU2hpZWxkRW5hYmxlZFwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJhYnNvbHV0ZSB0b3AtWzJweF0gc2l6ZS02IHJvdW5kZWQtZnVsbCBiZy13aGl0ZSBzaGFkb3ctc20gdHJhbnNpdGlvbi1hbGxcIlxuICAgICAgICAgICAgICAgICAgICA6Y2xhc3M9XCJzaGllbGRFbmFibGVkID8gJ2xlZnQtWzIwcHhdJyA6ICdsZWZ0LVsycHhdJ1wiXG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8IS0tIOWxj+iUvea4heWNlSAtLT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInNwYWNlLXktNCBweC00IHB5LTRcIj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwibWItMS41IGJsb2NrIHRleHQtWzEycHhdIGZvbnQtbWVkaXVtIHRleHQtWyM4Njg2OGJdXCI+5bGP6JS95riF5Y2V77yI5bqU55So5ZCN54mH5q6177yM6YCX5Y+35YiG6ZqU77yJPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxuICAgICAgICAgICAgICAgICAgICB2LW1vZGVsPVwic2hpZWxkQXBwc0RyYWZ0XCJcbiAgICAgICAgICAgICAgICAgICAgcm93cz1cIjJcIlxuICAgICAgICAgICAgICAgICAgICA6ZGlzYWJsZWQ9XCIhc2hpZWxkU3VwcG9ydGVkXCJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCLmuLjmiI8sIGNocm9tZSwgYmlsaWJpbGlcIlxuICAgICAgICAgICAgICAgICAgICBjbGFzcz1cInctZnVsbCByZXNpemUtbm9uZSByb3VuZGVkLWxnIGJnLVsjZjVmNWY3XSBweC0zIHB5LTIgZm9udC1tb25vIHRleHQtWzEycHhdIHRleHQtWyMxZDFkMWZdIG91dGxpbmUtbm9uZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl0gdHJhbnNpdGlvbi1hbGwgZm9jdXM6cmluZy1bIzAwN2FmZl0vNTAgZGlzYWJsZWQ6b3BhY2l0eS00MFwiXG4gICAgICAgICAgICAgICAgICAgIEBibHVyPVwic2F2ZVNoaWVsZEFwcHNcIlxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwibWItMS41IGJsb2NrIHRleHQtWzEycHhdIGZvbnQtbWVkaXVtIHRleHQtWyM4Njg2OGJdXCI+XG4gICAgICAgICAgICAgICAgICAgIOe9keermeWxj+iUve+8iOWfn+WQjeeJh+aute+8jOmAl+WPt+WIhumalO+8iVxuICAgICAgICAgICAgICAgICAgICA8c3BhbiB2LWlmPVwiIXNoaWVsZFdlYnNpdGVTdXBwb3J0ZWRcIiBjbGFzcz1cInRleHQtWyNmZjk1MDBdXCI+77yI5LuFIG1hY09TIOaUr+aMge+8iTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcbiAgICAgICAgICAgICAgICAgICAgdi1tb2RlbD1cInNoaWVsZFdlYnNpdGVzRHJhZnRcIlxuICAgICAgICAgICAgICAgICAgICByb3dzPVwiMlwiXG4gICAgICAgICAgICAgICAgICAgIDpkaXNhYmxlZD1cIiFzaGllbGRTdXBwb3J0ZWQgfHwgIXNoaWVsZFdlYnNpdGVTdXBwb3J0ZWRcIlxuICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cInlvdXR1YmUuY29tLCB0d2l0dGVyLmNvbSwgYmlsaWJpbGkuY29tXCJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJ3LWZ1bGwgcmVzaXplLW5vbmUgcm91bmRlZC1sZyBiZy1bI2Y1ZjVmN10gcHgtMyBweS0yIGZvbnQtbW9ubyB0ZXh0LVsxMnB4XSB0ZXh0LVsjMWQxZDFmXSBvdXRsaW5lLW5vbmUgcmluZy0xIHJpbmctYmxhY2svWzAuMDZdIHRyYW5zaXRpb24tYWxsIGZvY3VzOnJpbmctWyMwMDdhZmZdLzUwIGRpc2FibGVkOm9wYWNpdHktNDBcIlxuICAgICAgICAgICAgICAgICAgICBAYmx1cj1cInNhdmVTaGllbGRXZWJzaXRlc1wiXG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvc2VjdGlvbj5cbiAgICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgICA8IS0tIOKVkOKVkOKVkCDmj5Lku7Yg4pWQ4pWQ4pWQIC0tPlxuICAgICAgICA8dGVtcGxhdGUgdi1lbHNlLWlmPVwiYWN0aXZlU2VjdGlvbiA9PT0gJ2V4dGVuc2lvbnMnXCI+XG4gICAgICAgICAgPGgxIGNsYXNzPVwibWItMSB0ZXh0LVsyOHB4XSBmb250LXNlbWlib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtWyMxZDFkMWZdXCI+5o+S5Lu2PC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cIm1iLTggdGV4dC1bMTRweF0gdGV4dC1bIzg2ODY4Yl1cIj7nrqHnkIblt7Llronoo4XnmoTmj5Lku7bkuI7mianlsZXjgII8L3A+XG5cbiAgICAgICAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLThcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC14bCBiZy13aGl0ZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktM1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBiZy1bI2FmNTJkZV0vMTAgdGV4dC1bI2FmNTJkZV1cIj5cbiAgICAgICAgICAgICAgICAgIDxBcHBJY29uIGljb249XCJwbHVnLTItbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+5o+S5Lu2566h55CGPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibXQtMC41IHRleHQtWzEycHhdIHRleHQtWyM4Njg2OGJdXCI+5p+l55yL44CB5a6J6KOF44CB5Y246L295o+S5Lu277yM566h55CG5o+S5Lu25YGP5aW96K6+572uPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPFVCdXR0b24gc2l6ZT1cInNtXCIgdmFyaWFudD1cInNlY29uZGFyeVwiIEBjbGljaz1cInJvdXRlci5wdXNoKCcvbGF1bmNoZXInKVwiPuaJk+W8gOeuoeeQhumhtTwvVUJ1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L3NlY3Rpb24+XG4gICAgICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgICAgPCEtLSDilZDilZDilZAg5pu05pawIOKVkOKVkOKVkCAtLT5cbiAgICAgICAgPHRlbXBsYXRlIHYtZWxzZS1pZj1cImFjdGl2ZVNlY3Rpb24gPT09ICd1cGRhdGVzJ1wiPlxuICAgICAgICAgIDxoMSBjbGFzcz1cIm1iLTEgdGV4dC1bMjhweF0gZm9udC1zZW1pYm9sZCB0cmFja2luZy10aWdodCB0ZXh0LVsjMWQxZDFmXVwiPuabtOaWsDwvaDE+XG4gICAgICAgICAgPHAgY2xhc3M9XCJtYi04IHRleHQtWzE0cHhdIHRleHQtWyM4Njg2OGJdXCI+6Ieq5Yqo5pu05paw5LiO54mI5pys566h55CG44CCPC9wPlxuXG4gICAgICAgICAgPHNlY3Rpb24gY2xhc3M9XCJtYi04XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwib3ZlcmZsb3ctaGlkZGVuIHJvdW5kZWQteGwgYmctd2hpdGUgcmluZy0xIHJpbmctYmxhY2svWzAuMDZdXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTNcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBzaXplLTggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgYmctWyMwMDdhZmZdLzEwIHRleHQtWyMwMDdhZmZdXCI+XG4gICAgICAgICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwicmktcmVmcmVzaC1saW5lXCIgOnNpemU9XCIxNlwiIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1pbi13LTAgZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ0ZXh0LVsxNHB4XSBmb250LW1lZGl1bSB0ZXh0LVsjMWQxZDFmXVwiPuiHquWKqOabtOaWsDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPFVCYWRnZSB2LWlmPVwidXBkYXRlU3RhdHVzID09PSAnYXZhaWxhYmxlJ1wiIHZhcmlhbnQ9XCJicmFuZFwiPuWPr+abtOaWsDwvVUJhZGdlPlxuICAgICAgICAgICAgICAgICAgICA8VUJhZGdlIHYtZWxzZS1pZj1cInVwZGF0ZVN0YXR1cyA9PT0gJ2Vycm9yJ1wiIHZhcmlhbnQ9XCJkYW5nZXJcIj7plJnor688L1VCYWRnZT5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPnt7IHN0YXR1c1RleHQodXBkYXRlU3RhdHVzKSB9fTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPFVQcm9ncmVzcyB2LWlmPVwidXBkYXRlU3RhdHVzID09PSAnZG93bmxvYWRpbmcnXCIgOnZhbHVlPVwidXBkYXRlUHJvZ3Jlc3NcIiBjbGFzcz1cIm10LTJcIiAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNocmluay0wIGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgPFVCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgdi1pZj1cImNhbkNoZWNrKClcIlxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwic2Vjb25kYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgOmxvYWRpbmc9XCJ1cGRhdGVTdGF0dXMgPT09ICdjaGVja2luZydcIlxuICAgICAgICAgICAgICAgICAgICBAY2xpY2s9XCJvbkNoZWNrVXBkYXRlXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3sgdXBkYXRlU3RhdHVzID09PSAnY2hlY2tpbmcnID8gJ+ajgOafpeS4reKApicgOiAn5qOA5p+l5pu05pawJyB9fVxuICAgICAgICAgICAgICAgICAgPC9VQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgPFVCdXR0b24gdi1pZj1cImNhbkRvd25sb2FkKClcIiBzaXplPVwic21cIiB2YXJpYW50PVwicHJpbWFyeVwiIEBjbGljaz1cIm9uRG93bmxvYWRcIj7kuIvovb08L1VCdXR0b24+XG4gICAgICAgICAgICAgICAgICA8VUJ1dHRvbiB2LWlmPVwiY2FuSW5zdGFsbCgpXCIgc2l6ZT1cInNtXCIgdmFyaWFudD1cInByaW1hcnlcIiBAY2xpY2s9XCJvbkluc3RhbGxcIj7ph43lkK/lronoo4U8L1VCdXR0b24+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9zZWN0aW9uPlxuICAgICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICAgIDwhLS0g4pWQ4pWQ4pWQIOaVsOaNriDilZDilZDilZAgLS0+XG4gICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2UtaWY9XCJhY3RpdmVTZWN0aW9uID09PSAnZGF0YSdcIj5cbiAgICAgICAgICA8aDEgY2xhc3M9XCJtYi0xIHRleHQtWzI4cHhdIGZvbnQtc2VtaWJvbGQgdHJhY2tpbmctdGlnaHQgdGV4dC1bIzFkMWQxZl1cIj7mlbDmja48L2gxPlxuICAgICAgICAgIDxwIGNsYXNzPVwibWItOCB0ZXh0LVsxNHB4XSB0ZXh0LVsjODY4NjhiXVwiPuaVsOaNruWtmOWCqOOAgei/geenu+S4juWkh+S7veOAgjwvcD5cblxuICAgICAgICAgIDxzZWN0aW9uIGNsYXNzPVwibWItOFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm92ZXJmbG93LWhpZGRlbiByb3VuZGVkLXhsIGJnLXdoaXRlIHJpbmctMSByaW5nLWJsYWNrL1swLjA2XVwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGl2aWRlLXkgZGl2aWRlLWJsYWNrL1swLjA2XVwiPlxuICAgICAgICAgICAgICAgIDwhLS0g5pWw5o2u55uu5b2VIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTNcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBiZy1bI2Y1ZjVmN10gdGV4dC1bIzg2ODY4Yl1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInJpLWZvbGRlci1saW5lXCIgOnNpemU9XCIxNlwiIC8+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1bMTRweF0gZm9udC1tZWRpdW0gdGV4dC1bIzFkMWQxZl1cIj7mlbDmja7nm67lvZU8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRydW5jYXRlIGZvbnQtbW9ubyB0ZXh0LVsxMXB4XSB0ZXh0LVsjODY4NjhiXVwiPnt7IHN5c3RlbUluZm8/LnVzZXJEYXRhUGF0aCA/PyAn4oCUJyB9fTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8VUJ1dHRvbiB2LWlmPVwic3lzdGVtSW5mbz8udXNlckRhdGFQYXRoXCIgc2l6ZT1cInNtXCIgdmFyaWFudD1cImdob3N0XCIgQGNsaWNrPVwib25PcGVuRGF0YURpclwiPuaJk+W8gDwvVUJ1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDwhLS0g5pen54mI5pWw5o2u5b2S5qGjIC0tPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTNcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICAgICAgIDpjbGFzcz1cInN5c3RlbUluZm8/LmxlZ2FjeUFyY2hpdmVQYXRoID8gJ2JnLVsjMzRjNzU5XS8xMCB0ZXh0LVsjMzRjNzU5XScgOiAnYmctWyNmNWY1ZjddIHRleHQtWyM4Njg2OGJdJ1wiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxBcHBJY29uIDppY29uPVwic3lzdGVtSW5mbz8ubGVnYWN5QXJjaGl2ZVBhdGggPyAncmktYXJjaGl2ZS1saW5lJyA6ICdyaS1hcmNoaXZlLXN0YWNrLWxpbmUnXCIgOnNpemU9XCIxNlwiIC8+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+5pen54mI5pWw5o2u5b2S5qGjPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIDxVQmFkZ2Ugdi1pZj1cInN5c3RlbUluZm8/LmxlZ2FjeUFyY2hpdmVQYXRoXCIgdmFyaWFudD1cInN1Y2Nlc3NcIj7lt7LlvZLmoaM8L1VCYWRnZT5cbiAgICAgICAgICAgICAgICAgICAgICA8VUJhZGdlIHYtZWxzZS1pZj1cInN5c3RlbUluZm8/Lm1pZ3JhdGlvbkRvbmUgPT09IGZhbHNlXCIgdmFyaWFudD1cIm5ldXRyYWxcIj7ml6DpnIDov4Hnp7s8L1VCYWRnZT5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtdC0wLjUgdHJ1bmNhdGUgZm9udC1tb25vIHRleHQtWzExcHhdIHRleHQtWyM4Njg2OGJdXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHRlbXBsYXRlIHYtaWY9XCJzeXN0ZW1JbmZvPy5sZWdhY3lBcmNoaXZlUGF0aFwiPnt7IHN5c3RlbUluZm8ubGVnYWN5QXJjaGl2ZVBhdGggfX08L3RlbXBsYXRlPlxuICAgICAgICAgICAgICAgICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2U+5peg5pen5pWw5o2uPC90ZW1wbGF0ZT5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxVQnV0dG9uIHYtaWY9XCJzeXN0ZW1JbmZvPy5sZWdhY3lBcmNoaXZlUGF0aFwiIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIEBjbGljaz1cIm9uT3BlbkxlZ2FjeURpclwiPuaJk+W8gDwvVUJ1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDwhLS0g5pWw5o2u6L+B56e75Lit5b+DIC0tPlxuICAgICAgICAgICAgICAgIDxyb3V0ZXItbGluayB0bz1cIi9taWdyYXRpb25cIiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktMyB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy1ibGFjay9bMC4wMl1cIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBiZy1bI2Y1ZjVmN10gdGV4dC1bIzg2ODY4Yl1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cImRhdGFiYXNlLTItbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+5pWw5o2u6L+B56e75Lit5b+DPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPuWvvOWFpSAvIOWvvOWHuiAvIOWkh+S7veaBouWkjSAvIOWHuuWOgumHjee9rjwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwicmktYXJyb3ctcmlnaHQtcy1saW5lXCIgOnNpemU9XCIxNlwiIGNsYXNzPVwidGV4dC1bIzg2ODY4Yl1cIiAvPlxuICAgICAgICAgICAgICAgIDwvcm91dGVyLWxpbms+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9zZWN0aW9uPlxuICAgICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICAgIDwhLS0g4pWQ4pWQ4pWQIOmrmOe6pyDilZDilZDilZAgLS0+XG4gICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2UtaWY9XCJhY3RpdmVTZWN0aW9uID09PSAnYWR2YW5jZWQnXCI+XG4gICAgICAgICAgPGgxIGNsYXNzPVwibWItMSB0ZXh0LVsyOHB4XSBmb250LXNlbWlib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtWyMxZDFkMWZdXCI+6auY57qnPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cIm1iLTggdGV4dC1bMTRweF0gdGV4dC1bIzg2ODY4Yl1cIj7ml6Xlv5fjgIHpgaXmtYvkuI7lvIDlj5HogIXpgInpobnjgII8L3A+XG5cbiAgICAgICAgICA8IS0tIOaXpeW/l+aooeW8jyAtLT5cbiAgICAgICAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLThcIj5cbiAgICAgICAgICAgIDxoMiBjbGFzcz1cIm1iLTMgdGV4dC1bMTJweF0gZm9udC1tZWRpdW0gdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHRleHQtWyM4Njg2OGJdXCI+5pel5b+XPC9oMj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC14bCBiZy13aGl0ZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRpdmlkZS15IGRpdmlkZS1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB2LWZvcj1cInQgaW4gdGVsZW1ldHJ5T3B0aW9uc1wiXG4gICAgICAgICAgICAgICAgICA6a2V5PVwidC5pZFwiXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmxleCB3LWZ1bGwgaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktMyB0ZXh0LWxlZnQgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6YmctYmxhY2svWzAuMDJdXCJcbiAgICAgICAgICAgICAgICAgIEBjbGljaz1cIm9uU2VsZWN0VGVsZW1ldHJ5KHQuaWQpXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmxleCBzaXplLTggc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICA6Y2xhc3M9XCJ0ZWxlbWV0cnlNb2RlID09PSB0LmlkID8gJ2JnLVsjMDA3YWZmXS8xMCB0ZXh0LVsjMDA3YWZmXScgOiAnYmctWyNmNWY1ZjddIHRleHQtWyM4Njg2OGJdJ1wiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxBcHBJY29uXG4gICAgICAgICAgICAgICAgICAgICAgOmljb249XCJ0LmlkID09PSAnb2ZmJyA/ICdyaS1leWUtb2ZmLWxpbmUnIDogdC5pZCA9PT0gJ3JlbW90ZScgPyAncmktY2xvdWQtbGluZScgOiAncmktaGFyZC1kcml2ZS0yLWxpbmUnXCJcbiAgICAgICAgICAgICAgICAgICAgICA6c2l6ZT1cIjE2XCJcbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1pbi13LTAgZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidGV4dC1bMTRweF0gZm9udC1tZWRpdW0gdGV4dC1bIzFkMWQxZl1cIj57eyB0LmxhYmVsIH19PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm10LTAuNSB0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPnt7IHQuZGVzY3JpcHRpb24gfX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiB2LWlmPVwidGVsZW1ldHJ5TW9kZSA9PT0gdC5pZFwiIGNsYXNzPVwiZmxleCBzaXplLTUgc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtZnVsbCBiZy1bIzAwN2FmZl1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInJpLWNoZWNrLWxpbmVcIiA6c2l6ZT1cIjEyXCIgY2xhc3M9XCJ0ZXh0LXdoaXRlXCIgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8IS0tIOWvvOWHuuaXpeW/lyAtLT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIGJvcmRlci10IGJvcmRlci1ibGFjay9bMC4wNl0gcHgtNCBweS0zXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXggc2l6ZS04IHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWxnIGJnLVsjZjVmNWY3XSB0ZXh0LVsjODY4NjhiXVwiPlxuICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cImRvd25sb2FkLTItbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtaW4tdy0wIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+5a+85Ye65pel5b+XPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGV4dC1bMTJweF0gdGV4dC1bIzg2ODY4Yl1cIj7miZPljIXmnIDov5EgNTAwIOadoeaXpeW/l++8jOS+v+S6juWPjemmiOmXrumimOaXtumZhOS4ijwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxVQnV0dG9uIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJzZWNvbmRhcnlcIiBAY2xpY2s9XCJvbkV4cG9ydExvZ3NcIj7lr7zlh7o8L1VCdXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9zZWN0aW9uPlxuICAgICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICAgIDwhLS0g4pWQ4pWQ4pWQIOWFs+S6jiDilZDilZDilZAgLS0+XG4gICAgICAgIDx0ZW1wbGF0ZSB2LWVsc2UtaWY9XCJhY3RpdmVTZWN0aW9uID09PSAnYWJvdXQnXCI+XG4gICAgICAgICAgPGgxIGNsYXNzPVwibWItMSB0ZXh0LVsyOHB4XSBmb250LXNlbWlib2xkIHRyYWNraW5nLXRpZ2h0IHRleHQtWyMxZDFkMWZdXCI+5YWz5LqOPC9oMT5cbiAgICAgICAgICA8cCBjbGFzcz1cIm1iLTggdGV4dC1bMTRweF0gdGV4dC1bIzg2ODY4Yl1cIj7niYjmnKzkv6Hmga/kuI7oh7TosKLjgII8L3A+XG5cbiAgICAgICAgICA8c2VjdGlvbiBjbGFzcz1cIm1iLThcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC14bCBiZy13aGl0ZSByaW5nLTEgcmluZy1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRpdmlkZS15IGRpdmlkZS1ibGFjay9bMC4wNl1cIj5cbiAgICAgICAgICAgICAgICA8cm91dGVyLWxpbmsgdG89XCIvYWJvdXRcIiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktMyB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy1ibGFjay9bMC4wMl1cIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBiZy1bIzAwN2FmZl0vMTAgdGV4dC1bIzAwN2FmZl1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInJpLWluZm9ybWF0aW9uLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIm1pbi13LTAgZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxNHB4XSBmb250LW1lZGl1bSB0ZXh0LVsjMWQxZDFmXVwiPuWFs+S6jiBMZWFmPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPueJiOacrOOAgemakOengeOAgeiHtOiwojwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwicmktYXJyb3ctcmlnaHQtcy1saW5lXCIgOnNpemU9XCIxNlwiIGNsYXNzPVwidGV4dC1bIzg2ODY4Yl1cIiAvPlxuICAgICAgICAgICAgICAgIDwvcm91dGVyLWxpbms+XG5cbiAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICAgIGNsYXNzPVwiZmxleCB3LWZ1bGwgaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktMyB0ZXh0LWxlZnQgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6YmctYmxhY2svWzAuMDJdXCJcbiAgICAgICAgICAgICAgICAgIEBjbGljaz1cIm9uUmVzdGFydE9uYm9hcmRpbmdcIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4IHNpemUtOCBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyBiZy1bI2ZmOTUwMF0vMTAgdGV4dC1bI2ZmOTUwMF1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cInJpLXJlZnJlc2gtbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWluLXctMCBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIHRleHQtWyMxZDFkMWZdXCI+6YeN5paw5byA5aeL5byV5a+8PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0ZXh0LVsxMnB4XSB0ZXh0LVsjODY4NjhiXVwiPumHjeeci+mmluasoeWQr+WKqOeahCA0IOatpeW8leWvvDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8QXBwSWNvbiBpY29uPVwicmktYXJyb3ctcmlnaHQtcy1saW5lXCIgOnNpemU9XCIxNlwiIGNsYXNzPVwidGV4dC1bIzg2ODY4Yl1cIiAvPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvc2VjdGlvbj5cblxuICAgICAgICAgIDxwIGNsYXNzPVwidGV4dC1jZW50ZXIgdGV4dC1bMTJweF0gdGV4dC1bIzg2ODY4Yl1cIj5MZWFmIMK3IHZ7eyBhcHBWZXJzaW9uIH19IMK3IOacrOWcsOS8mOWFiCAvIOW8gOa6kDwvcD5cbiAgICAgICAgPC90ZW1wbGF0ZT5cbiAgICAgIDwvZGl2PlxuICAgIDwvbWFpbj5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy92aWV3cy9TZXR0aW5nc1ZpZXcudnVlIn0=