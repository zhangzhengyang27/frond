import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/ReminderPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, computed, onMounted, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import AppIcon from "/src/components/AppIcon.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ReminderPage",
  props: {
    query: { type: String, required: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const newTitle = ref("");
    const showTimePicker = ref(false);
    const quickTime = ref("");
    const customTime = ref("");
    const activeTab = ref("active");
    const reminders = ref([]);
    const activeReminders = computed(
      () => reminders.value.filter((r) => !r.isCompleted && !r.isDeleted)
    );
    const completedReminders = computed(
      () => reminders.value.filter((r) => r.isCompleted && !r.isDeleted)
    );
    const displayList = computed(
      () => activeTab.value === "active" ? activeReminders.value : completedReminders.value
    );
    async function loadReminders() {
      try {
        const filter = { isDeleted: false };
        const q = props.query?.trim();
        if (q) filter.search = q;
        reminders.value = await window.api.reminders.list(filter);
      } catch (err) {
        console.warn("[Reminder] 加载失败:", err);
      }
    }
    function parseNaturalLanguage(text) {
      const now = /* @__PURE__ */ new Date();
      let remindAt = null;
      let title = text.trim();
      const tomorrowMatch = text.match(/明天(上午|下午|早上|晚上)?(\d{1,2})[点:：](\d{2})?/);
      if (tomorrowMatch) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        const period = tomorrowMatch[1] || "";
        let hour = parseInt(tomorrowMatch[2]);
        const minute = tomorrowMatch[3] ? parseInt(tomorrowMatch[3]) : 0;
        if ((period === "下午" || period === "晚上") && hour < 12) hour += 12;
        if ((period === "早上" || period === "上午") && hour === 12) hour = 0;
        d.setHours(hour, minute, 0, 0);
        remindAt = d.getTime();
        title = text.replace(tomorrowMatch[0], "").trim();
      }
      const todayMatch = text.match(/今天(上午|下午|早上|晚上)?(\d{1,2})[点:：](\d{2})?/);
      if (todayMatch && !remindAt) {
        const d = new Date(now);
        const period = todayMatch[1] || "";
        let hour = parseInt(todayMatch[2]);
        const minute = todayMatch[3] ? parseInt(todayMatch[3]) : 0;
        if ((period === "下午" || period === "晚上") && hour < 12) hour += 12;
        if ((period === "早上" || period === "上午") && hour === 12) hour = 0;
        d.setHours(hour, minute, 0, 0);
        if (d.getTime() > now.getTime()) {
          remindAt = d.getTime();
          title = text.replace(todayMatch[0], "").trim();
        }
      }
      const durationMatch = text.match(/(\d+)(小时|分钟|天)后/);
      if (durationMatch && !remindAt) {
        const num = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        const d = new Date(now);
        if (unit === "小时") d.setHours(d.getHours() + num);
        else if (unit === "分钟") d.setMinutes(d.getMinutes() + num);
        else if (unit === "天") d.setDate(d.getDate() + num);
        remindAt = d.getTime();
        title = text.replace(durationMatch[0], "").trim();
      }
      const enTomorrowMatch = text.match(/\btomorrow\b.*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (enTomorrowMatch && !remindAt) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        let hour = parseInt(enTomorrowMatch[1]);
        const minute = enTomorrowMatch[2] ? parseInt(enTomorrowMatch[2]) : 0;
        const period = enTomorrowMatch[3]?.toLowerCase();
        if (period === "pm" && hour < 12) hour += 12;
        if (period === "am" && hour === 12) hour = 0;
        d.setHours(hour, minute, 0, 0);
        remindAt = d.getTime();
        title = text.replace(enTomorrowMatch[0], "").trim();
      }
      const enTodayMatch = text.match(/(?:\btoday\b\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
      if (enTodayMatch && !remindAt) {
        const d = new Date(now);
        let hour = parseInt(enTodayMatch[1]);
        const minute = enTodayMatch[2] ? parseInt(enTodayMatch[2]) : 0;
        const period = enTodayMatch[3]?.toLowerCase();
        if (period === "pm" && hour < 12) hour += 12;
        if (period === "am" && hour === 12) hour = 0;
        d.setHours(hour, minute, 0, 0);
        if (d.getTime() <= now.getTime()) {
          d.setDate(d.getDate() + 1);
        }
        remindAt = d.getTime();
        title = text.replace(enTodayMatch[0], "").trim();
      }
      const enDurationMatch = text.match(/\bin\s+(\d+)\s+(hour|hours|minute|minutes|day|days)\b/i);
      if (enDurationMatch && !remindAt) {
        const num = parseInt(enDurationMatch[1]);
        const unit = enDurationMatch[2].toLowerCase();
        const d = new Date(now);
        if (unit.startsWith("hour")) d.setHours(d.getHours() + num);
        else if (unit.startsWith("minute")) d.setMinutes(d.getMinutes() + num);
        else if (unit.startsWith("day")) d.setDate(d.getDate() + num);
        remindAt = d.getTime();
        title = text.replace(enDurationMatch[0], "").trim();
      }
      return { title: title || text, remindAt };
    }
    function onQuickTimeChange() {
      if (quickTime.value === "custom") return;
      if (newTitle.value.trim()) createReminder();
    }
    function computeRemindAt() {
      const now = Date.now();
      switch (quickTime.value) {
        case "1h":
          return now + 60 * 60 * 1e3;
        case "3h":
          return now + 3 * 60 * 60 * 1e3;
        case "tomorrow9": {
          const d = /* @__PURE__ */ new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
          return d.getTime();
        }
        case "tomorrow14": {
          const d = /* @__PURE__ */ new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(14, 0, 0, 0);
          return d.getTime();
        }
        case "custom":
          return customTime.value ? new Date(customTime.value).getTime() : null;
        default:
          return null;
      }
    }
    async function createReminder() {
      const title = newTitle.value.trim();
      if (!title) return;
      const parsed = parseNaturalLanguage(title);
      let remindAt = parsed.remindAt;
      if (quickTime.value) {
        remindAt = computeRemindAt();
      }
      try {
        await window.api.reminders.create({
          title: parsed.title,
          remindAt
        });
        newTitle.value = "";
        quickTime.value = "";
        customTime.value = "";
        showTimePicker.value = false;
        await loadReminders();
      } catch (err) {
        console.warn("[Reminder] 创建失败:", err);
      }
    }
    async function toggleComplete(id, isCompleted) {
      try {
        if (isCompleted) {
          await window.api.reminders.uncomplete(id);
        } else {
          await window.api.reminders.complete(id);
        }
        await loadReminders();
      } catch (err) {
        console.warn("[Reminder] 操作失败:", err);
      }
    }
    async function removeReminder(id) {
      try {
        await window.api.reminders.remove(id);
        await loadReminders();
      } catch (err) {
        console.warn("[Reminder] 删除失败:", err);
      }
    }
    function formatTime(ts) {
      const d = new Date(ts);
      const now = /* @__PURE__ */ new Date();
      const isToday = d.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (isToday) return `今天 ${time}`;
      if (isTomorrow) return `明天 ${time}`;
      return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
    }
    function isOverdue(reminder) {
      return !reminder.isCompleted && reminder.remindAt !== null && reminder.remindAt < Date.now();
    }
    onMounted(() => {
      void loadReminders();
    });
    watch(
      () => props.query,
      () => {
        void loadReminders();
      }
    );
    const __returned__ = { props, newTitle, showTimePicker, quickTime, customTime, activeTab, reminders, activeReminders, completedReminders, displayList, loadReminders, parseNaturalLanguage, onQuickTimeChange, computeRemindAt, createReminder, toggleComplete, removeReminder, formatTime, isOverdue, AppIcon };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, vModelText as _vModelText, withKeys as _withKeys, createElementVNode as _createElementVNode, withDirectives as _withDirectives, createVNode as _createVNode, withModifiers as _withModifiers, normalizeClass as _normalizeClass, vModelSelect as _vModelSelect, openBlock as _openBlock, createElementBlock as _createElementBlock, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, renderList as _renderList, Fragment as _Fragment, createBlock as _createBlock, createStaticVNode as _createStaticVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "reminder-page" };
const _hoisted_2 = { class: "reminder-create" };
const _hoisted_3 = {
  key: 0,
  class: "reminder-time-picker"
};
const _hoisted_4 = { class: "reminder-tabs" };
const _hoisted_5 = { class: "reminder-tab-count" };
const _hoisted_6 = { class: "reminder-tab-count" };
const _hoisted_7 = { class: "reminder-list" };
const _hoisted_8 = {
  key: 0,
  class: "reminder-empty"
};
const _hoisted_9 = { class: "reminder-empty-text" };
const _hoisted_10 = ["onMousedown"];
const _hoisted_11 = { class: "reminder-content" };
const _hoisted_12 = { class: "reminder-title" };
const _hoisted_13 = {
  key: 0,
  class: "reminder-notes"
};
const _hoisted_14 = {
  key: 1,
  class: "reminder-time"
};
const _hoisted_15 = ["onMousedown"];
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createCommentVNode(" 新建提醒输入区 "),
    _createElementVNode("div", _hoisted_2, [
      _withDirectives(_createElementVNode(
        "input",
        {
          "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.newTitle = $event),
          class: "reminder-create-input",
          type: "text",
          placeholder: "创建提醒…（支持自然语言，如「明天下午3点开会」）",
          onKeydown: _withKeys($setup.createReminder, ["enter"])
        },
        null,
        544
        /* NEED_HYDRATION, NEED_PATCH */
      ), [
        [_vModelText, $setup.newTitle]
      ]),
      _createElementVNode(
        "button",
        {
          class: _normalizeClass(["reminder-time-btn", { active: $setup.showTimePicker }]),
          title: "设置提醒时间",
          onMousedown: _cache[1] || (_cache[1] = _withModifiers(($event) => $setup.showTimePicker = !$setup.showTimePicker, ["prevent"]))
        },
        [
          _createVNode($setup["AppIcon"], {
            icon: "alarm-line",
            size: 16
          })
        ],
        34
        /* CLASS, NEED_HYDRATION */
      ),
      _createElementVNode(
        "button",
        {
          class: "reminder-create-btn",
          title: "创建提醒",
          onMousedown: _withModifiers($setup.createReminder, ["prevent"])
        },
        [
          _createVNode($setup["AppIcon"], {
            icon: "add-line",
            size: 16
          })
        ],
        32
        /* NEED_HYDRATION */
      )
    ]),
    _createCommentVNode(" 提醒时间选择 "),
    $setup.showTimePicker ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
      _withDirectives(_createElementVNode(
        "select",
        {
          "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.quickTime = $event),
          class: "reminder-time-select",
          onChange: $setup.onQuickTimeChange
        },
        [..._cache[6] || (_cache[6] = [
          _createStaticVNode('<option value="" data-v-b1dabe3a>不提醒</option><option value="1h" data-v-b1dabe3a>1 小时后</option><option value="3h" data-v-b1dabe3a>3 小时后</option><option value="tomorrow9" data-v-b1dabe3a>明天上午 9 点</option><option value="tomorrow14" data-v-b1dabe3a>明天下午 2 点</option><option value="custom" data-v-b1dabe3a>自定义…</option>', 6)
        ])],
        544
        /* NEED_HYDRATION, NEED_PATCH */
      ), [
        [_vModelSelect, $setup.quickTime]
      ]),
      $setup.quickTime === "custom" ? _withDirectives((_openBlock(), _createElementBlock(
        "input",
        {
          key: 0,
          "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $setup.customTime = $event),
          type: "datetime-local",
          class: "reminder-time-custom"
        },
        null,
        512
        /* NEED_PATCH */
      )), [
        [_vModelText, $setup.customTime]
      ]) : _createCommentVNode("v-if", true)
    ])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 标签切换 "),
    _createElementVNode("div", _hoisted_4, [
      _createElementVNode(
        "button",
        {
          class: _normalizeClass(["reminder-tab", { active: $setup.activeTab === "active" }]),
          onMousedown: _cache[4] || (_cache[4] = _withModifiers(($event) => $setup.activeTab = "active", ["prevent"]))
        },
        [
          _cache[7] || (_cache[7] = _createTextVNode(
            " 未完成 ",
            -1
            /* CACHED */
          )),
          _createElementVNode(
            "span",
            _hoisted_5,
            _toDisplayString($setup.activeReminders.length),
            1
            /* TEXT */
          )
        ],
        34
        /* CLASS, NEED_HYDRATION */
      ),
      _createElementVNode(
        "button",
        {
          class: _normalizeClass(["reminder-tab", { active: $setup.activeTab === "completed" }]),
          onMousedown: _cache[5] || (_cache[5] = _withModifiers(($event) => $setup.activeTab = "completed", ["prevent"]))
        },
        [
          _cache[8] || (_cache[8] = _createTextVNode(
            " 已完成 ",
            -1
            /* CACHED */
          )),
          _createElementVNode(
            "span",
            _hoisted_6,
            _toDisplayString($setup.completedReminders.length),
            1
            /* TEXT */
          )
        ],
        34
        /* CLASS, NEED_HYDRATION */
      )
    ]),
    _createCommentVNode(" 提醒列表 "),
    _createElementVNode("div", _hoisted_7, [
      $setup.displayList.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_8, [
        _createVNode($setup["AppIcon"], {
          icon: "alarm-line",
          size: 32
        }),
        _createElementVNode(
          "div",
          _hoisted_9,
          _toDisplayString($setup.activeTab === "active" ? "暂无待办提醒" : "暂无已完成提醒"),
          1
          /* TEXT */
        )
      ])) : _createCommentVNode("v-if", true),
      (_openBlock(true), _createElementBlock(
        _Fragment,
        null,
        _renderList($setup.displayList, (reminder) => {
          return _openBlock(), _createElementBlock(
            "div",
            {
              key: reminder.id,
              class: _normalizeClass(["reminder-item", { completed: reminder.isCompleted, overdue: $setup.isOverdue(reminder) }])
            },
            [
              _createElementVNode("button", {
                class: "reminder-checkbox",
                onMousedown: _withModifiers(($event) => $setup.toggleComplete(reminder.id, reminder.isCompleted), ["prevent"])
              }, [
                reminder.isCompleted ? (_openBlock(), _createBlock($setup["AppIcon"], {
                  key: 0,
                  icon: "checkbox-circle-fill",
                  size: 18
                })) : (_openBlock(), _createBlock($setup["AppIcon"], {
                  key: 1,
                  icon: "checkbox-circle-line",
                  size: 18
                }))
              ], 40, _hoisted_10),
              _createElementVNode("div", _hoisted_11, [
                _createElementVNode(
                  "div",
                  _hoisted_12,
                  _toDisplayString(reminder.title),
                  1
                  /* TEXT */
                ),
                reminder.notes ? (_openBlock(), _createElementBlock(
                  "div",
                  _hoisted_13,
                  _toDisplayString(reminder.notes),
                  1
                  /* TEXT */
                )) : _createCommentVNode("v-if", true),
                reminder.remindAt ? (_openBlock(), _createElementBlock("div", _hoisted_14, [
                  _createVNode($setup["AppIcon"], {
                    icon: "alarm-line",
                    size: 12
                  }),
                  _createElementVNode(
                    "span",
                    {
                      class: _normalizeClass({ overdue: $setup.isOverdue(reminder) })
                    },
                    _toDisplayString($setup.formatTime(reminder.remindAt)),
                    3
                    /* TEXT, CLASS */
                  )
                ])) : _createCommentVNode("v-if", true)
              ]),
              _createElementVNode("button", {
                class: "reminder-delete",
                onMousedown: _withModifiers(($event) => $setup.removeReminder(reminder.id), ["prevent"])
              }, [
                _createVNode($setup["AppIcon"], {
                  icon: "delete-bin-line",
                  size: 14
                })
              ], 40, _hoisted_15)
            ],
            2
            /* CLASS */
          );
        }),
        128
        /* KEYED_FRAGMENT */
      ))
    ])
  ]);
}
import "/src/launcher/pages/ReminderPage.vue?t=1788693638318&vue&type=style&index=0&scoped=b1dabe3a&lang.less";
_sfc_main.__hmrId = "b1dabe3a";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-b1dabe3a"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/ReminderPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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T0FBSywyQkFBYSxpQkFBVSxRQUFRO0FBQUE7cUNBQ3pDLGtCQUFXLFNBQVMsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBOztjQUtsQyxvQkFFUztBQUFBLGdCQUZELE9BQU07QUFBQSxnQkFBbUIsYUFBUywyQkFBVSxzQkFBZSxTQUFTLEVBQUU7QUFBQTtnQkFDNUUsYUFBNkM7QUFBQSxrQkFBcEMsTUFBSztBQUFBLGtCQUFtQixNQUFNO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlJlbWluZGVyUGFnZS52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8ZGl2IGNsYXNzPVwicmVtaW5kZXItcGFnZVwiPlxuICAgIDwhLS0g5paw5bu65o+Q6YaS6L6T5YWl5Yy6IC0tPlxuICAgIDxkaXYgY2xhc3M9XCJyZW1pbmRlci1jcmVhdGVcIj5cbiAgICAgIDxpbnB1dFxuICAgICAgICB2LW1vZGVsPVwibmV3VGl0bGVcIlxuICAgICAgICBjbGFzcz1cInJlbWluZGVyLWNyZWF0ZS1pbnB1dFwiXG4gICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgcGxhY2Vob2xkZXI9XCLliJvlu7rmj5DphpLigKbvvIjmlK/mjIHoh6rnhLbor63oqIDvvIzlpoLjgIzmmI7lpKnkuIvljYgz54K55byA5Lya44CN77yJXCJcbiAgICAgICAgQGtleWRvd24uZW50ZXI9XCJjcmVhdGVSZW1pbmRlclwiXG4gICAgICAvPlxuICAgICAgPGJ1dHRvblxuICAgICAgICBjbGFzcz1cInJlbWluZGVyLXRpbWUtYnRuXCJcbiAgICAgICAgOmNsYXNzPVwieyBhY3RpdmU6IHNob3dUaW1lUGlja2VyIH1cIlxuICAgICAgICB0aXRsZT1cIuiuvue9ruaPkOmGkuaXtumXtFwiXG4gICAgICAgIEBtb3VzZWRvd24ucHJldmVudD1cInNob3dUaW1lUGlja2VyID0gIXNob3dUaW1lUGlja2VyXCJcbiAgICAgID5cbiAgICAgICAgPEFwcEljb24gaWNvbj1cImFsYXJtLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cInJlbWluZGVyLWNyZWF0ZS1idG5cIiB0aXRsZT1cIuWIm+W7uuaPkOmGklwiIEBtb3VzZWRvd24ucHJldmVudD1cImNyZWF0ZVJlbWluZGVyXCI+XG4gICAgICAgIDxBcHBJY29uIGljb249XCJhZGQtbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOaPkOmGkuaXtumXtOmAieaLqSAtLT5cbiAgICA8ZGl2IHYtaWY9XCJzaG93VGltZVBpY2tlclwiIGNsYXNzPVwicmVtaW5kZXItdGltZS1waWNrZXJcIj5cbiAgICAgIDxzZWxlY3Qgdi1tb2RlbD1cInF1aWNrVGltZVwiIGNsYXNzPVwicmVtaW5kZXItdGltZS1zZWxlY3RcIiBAY2hhbmdlPVwib25RdWlja1RpbWVDaGFuZ2VcIj5cbiAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiPuS4jeaPkOmGkjwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwiMWhcIj4xIOWwj+aXtuWQjjwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwiM2hcIj4zIOWwj+aXtuWQjjwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwidG9tb3Jyb3c5XCI+5piO5aSp5LiK5Y2IIDkg54K5PC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJ0b21vcnJvdzE0XCI+5piO5aSp5LiL5Y2IIDIg54K5PC9vcHRpb24+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJjdXN0b21cIj7oh6rlrprkuYnigKY8L29wdGlvbj5cbiAgICAgIDwvc2VsZWN0PlxuICAgICAgPGlucHV0XG4gICAgICAgIHYtaWY9XCJxdWlja1RpbWUgPT09ICdjdXN0b20nXCJcbiAgICAgICAgdi1tb2RlbD1cImN1c3RvbVRpbWVcIlxuICAgICAgICB0eXBlPVwiZGF0ZXRpbWUtbG9jYWxcIlxuICAgICAgICBjbGFzcz1cInJlbWluZGVyLXRpbWUtY3VzdG9tXCJcbiAgICAgIC8+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOagh+etvuWIh+aNoiAtLT5cbiAgICA8ZGl2IGNsYXNzPVwicmVtaW5kZXItdGFic1wiPlxuICAgICAgPGJ1dHRvblxuICAgICAgICBjbGFzcz1cInJlbWluZGVyLXRhYlwiXG4gICAgICAgIDpjbGFzcz1cInsgYWN0aXZlOiBhY3RpdmVUYWIgPT09ICdhY3RpdmUnIH1cIlxuICAgICAgICBAbW91c2Vkb3duLnByZXZlbnQ9XCJhY3RpdmVUYWIgPSAnYWN0aXZlJ1wiXG4gICAgICA+XG4gICAgICAgIOacquWujOaIkCA8c3BhbiBjbGFzcz1cInJlbWluZGVyLXRhYi1jb3VudFwiPnt7IGFjdGl2ZVJlbWluZGVycy5sZW5ndGggfX08L3NwYW4+XG4gICAgICA8L2J1dHRvbj5cbiAgICAgIDxidXR0b25cbiAgICAgICAgY2xhc3M9XCJyZW1pbmRlci10YWJcIlxuICAgICAgICA6Y2xhc3M9XCJ7IGFjdGl2ZTogYWN0aXZlVGFiID09PSAnY29tcGxldGVkJyB9XCJcbiAgICAgICAgQG1vdXNlZG93bi5wcmV2ZW50PVwiYWN0aXZlVGFiID0gJ2NvbXBsZXRlZCdcIlxuICAgICAgPlxuICAgICAgICDlt7LlrozmiJAgPHNwYW4gY2xhc3M9XCJyZW1pbmRlci10YWItY291bnRcIj57eyBjb21wbGV0ZWRSZW1pbmRlcnMubGVuZ3RoIH19PC9zcGFuPlxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOaPkOmGkuWIl+ihqCAtLT5cbiAgICA8ZGl2IGNsYXNzPVwicmVtaW5kZXItbGlzdFwiPlxuICAgICAgPGRpdiB2LWlmPVwiZGlzcGxheUxpc3QubGVuZ3RoID09PSAwXCIgY2xhc3M9XCJyZW1pbmRlci1lbXB0eVwiPlxuICAgICAgICA8QXBwSWNvbiBpY29uPVwiYWxhcm0tbGluZVwiIDpzaXplPVwiMzJcIiAvPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicmVtaW5kZXItZW1wdHktdGV4dFwiPlxuICAgICAgICAgIHt7IGFjdGl2ZVRhYiA9PT0gJ2FjdGl2ZScgPyAn5pqC5peg5b6F5Yqe5o+Q6YaSJyA6ICfmmoLml6Dlt7LlrozmiJDmj5DphpInIH19XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXZcbiAgICAgICAgdi1mb3I9XCJyZW1pbmRlciBpbiBkaXNwbGF5TGlzdFwiXG4gICAgICAgIDprZXk9XCJyZW1pbmRlci5pZFwiXG4gICAgICAgIGNsYXNzPVwicmVtaW5kZXItaXRlbVwiXG4gICAgICAgIDpjbGFzcz1cInsgY29tcGxldGVkOiByZW1pbmRlci5pc0NvbXBsZXRlZCwgb3ZlcmR1ZTogaXNPdmVyZHVlKHJlbWluZGVyKSB9XCJcbiAgICAgID5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIGNsYXNzPVwicmVtaW5kZXItY2hlY2tib3hcIlxuICAgICAgICAgIEBtb3VzZWRvd24ucHJldmVudD1cInRvZ2dsZUNvbXBsZXRlKHJlbWluZGVyLmlkLCByZW1pbmRlci5pc0NvbXBsZXRlZClcIlxuICAgICAgICA+XG4gICAgICAgICAgPEFwcEljb24gdi1pZj1cInJlbWluZGVyLmlzQ29tcGxldGVkXCIgaWNvbj1cImNoZWNrYm94LWNpcmNsZS1maWxsXCIgOnNpemU9XCIxOFwiIC8+XG4gICAgICAgICAgPEFwcEljb24gdi1lbHNlIGljb249XCJjaGVja2JveC1jaXJjbGUtbGluZVwiIDpzaXplPVwiMThcIiAvPlxuICAgICAgICA8L2J1dHRvbj5cblxuICAgICAgICA8ZGl2IGNsYXNzPVwicmVtaW5kZXItY29udGVudFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJyZW1pbmRlci10aXRsZVwiPnt7IHJlbWluZGVyLnRpdGxlIH19PC9kaXY+XG4gICAgICAgICAgPGRpdiB2LWlmPVwicmVtaW5kZXIubm90ZXNcIiBjbGFzcz1cInJlbWluZGVyLW5vdGVzXCI+e3sgcmVtaW5kZXIubm90ZXMgfX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IHYtaWY9XCJyZW1pbmRlci5yZW1pbmRBdFwiIGNsYXNzPVwicmVtaW5kZXItdGltZVwiPlxuICAgICAgICAgICAgPEFwcEljb24gaWNvbj1cImFsYXJtLWxpbmVcIiA6c2l6ZT1cIjEyXCIgLz5cbiAgICAgICAgICAgIDxzcGFuIDpjbGFzcz1cInsgb3ZlcmR1ZTogaXNPdmVyZHVlKHJlbWluZGVyKSB9XCI+e3tcbiAgICAgICAgICAgICAgZm9ybWF0VGltZShyZW1pbmRlci5yZW1pbmRBdClcbiAgICAgICAgICAgIH19PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwicmVtaW5kZXItZGVsZXRlXCIgQG1vdXNlZG93bi5wcmV2ZW50PVwicmVtb3ZlUmVtaW5kZXIocmVtaW5kZXIuaWQpXCI+XG4gICAgICAgICAgPEFwcEljb24gaWNvbj1cImRlbGV0ZS1iaW4tbGluZVwiIDpzaXplPVwiMTRcIiAvPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICA8L2Rpdj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyByZWYsIGNvbXB1dGVkLCBvbk1vdW50ZWQsIHdhdGNoIH0gZnJvbSAndnVlJ1xuaW1wb3J0IEFwcEljb24gZnJvbSAnQHJlbmRlcmVyL2NvbXBvbmVudHMvQXBwSWNvbi52dWUnXG5cbmludGVyZmFjZSBSZW1pbmRlciB7XG4gIGlkOiBzdHJpbmdcbiAgdGl0bGU6IHN0cmluZ1xuICBub3Rlczogc3RyaW5nXG4gIGR1ZUF0OiBudW1iZXIgfCBudWxsXG4gIHJlbWluZEF0OiBudW1iZXIgfCBudWxsXG4gIGlzQ29tcGxldGVkOiBib29sZWFuXG4gIGlzRGVsZXRlZDogYm9vbGVhblxuICBjb21wbGV0ZWRBdDogbnVtYmVyIHwgbnVsbFxuICBjcmVhdGVkQXQ6IG51bWJlclxuICB1cGRhdGVkQXQ6IG51bWJlclxufVxuXG5jb25zdCBwcm9wcyA9IGRlZmluZVByb3BzPHsgcXVlcnk/OiBzdHJpbmcgfT4oKVxuXG5jb25zdCBuZXdUaXRsZSA9IHJlZignJylcbmNvbnN0IHNob3dUaW1lUGlja2VyID0gcmVmKGZhbHNlKVxuY29uc3QgcXVpY2tUaW1lID0gcmVmKCcnKVxuY29uc3QgY3VzdG9tVGltZSA9IHJlZignJylcbmNvbnN0IGFjdGl2ZVRhYiA9IHJlZjwnYWN0aXZlJyB8ICdjb21wbGV0ZWQnPignYWN0aXZlJylcbmNvbnN0IHJlbWluZGVycyA9IHJlZjxSZW1pbmRlcltdPihbXSlcblxuY29uc3QgYWN0aXZlUmVtaW5kZXJzID0gY29tcHV0ZWQoKCkgPT5cbiAgcmVtaW5kZXJzLnZhbHVlLmZpbHRlcigocikgPT4gIXIuaXNDb21wbGV0ZWQgJiYgIXIuaXNEZWxldGVkKVxuKVxuY29uc3QgY29tcGxldGVkUmVtaW5kZXJzID0gY29tcHV0ZWQoKCkgPT5cbiAgcmVtaW5kZXJzLnZhbHVlLmZpbHRlcigocikgPT4gci5pc0NvbXBsZXRlZCAmJiAhci5pc0RlbGV0ZWQpXG4pXG5cbmNvbnN0IGRpc3BsYXlMaXN0ID0gY29tcHV0ZWQoKCkgPT5cbiAgYWN0aXZlVGFiLnZhbHVlID09PSAnYWN0aXZlJyA/IGFjdGl2ZVJlbWluZGVycy52YWx1ZSA6IGNvbXBsZXRlZFJlbWluZGVycy52YWx1ZVxuKVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkUmVtaW5kZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIC8vIOaQnOe0ouivjeS6pOe7meS4u+i/m+eoi++8mkZUUzUg5YWo5paH5pCc57Si77yI5Lit5paH5a2Q5Liy5pyJIExJS0Ug5YWc5bqV77yJXG4gICAgY29uc3QgZmlsdGVyOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgaXNEZWxldGVkOiBmYWxzZSB9XG4gICAgY29uc3QgcSA9IHByb3BzLnF1ZXJ5Py50cmltKClcbiAgICBpZiAocSkgZmlsdGVyLnNlYXJjaCA9IHFcbiAgICByZW1pbmRlcnMudmFsdWUgPSAoYXdhaXQgd2luZG93LmFwaS5yZW1pbmRlcnMubGlzdChmaWx0ZXIpKSBhcyBSZW1pbmRlcltdXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUud2FybignW1JlbWluZGVyXSDliqDovb3lpLHotKU6JywgZXJyKVxuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlTmF0dXJhbExhbmd1YWdlKHRleHQ6IHN0cmluZyk6IHsgdGl0bGU6IHN0cmluZzsgcmVtaW5kQXQ6IG51bWJlciB8IG51bGwgfSB7XG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKClcbiAgbGV0IHJlbWluZEF0OiBudW1iZXIgfCBudWxsID0gbnVsbFxuICBsZXQgdGl0bGUgPSB0ZXh0LnRyaW0oKVxuXG4gIC8vIOeugOWNleeahOiHqueEtuivreiogOino+aekFxuICBjb25zdCB0b21vcnJvd01hdGNoID0gdGV4dC5tYXRjaCgv5piO5aSpKOS4iuWNiHzkuIvljYh85pep5LiKfOaZmuS4iik/KFxcZHsxLDJ9KVvngrk677yaXShcXGR7Mn0pPy8pXG4gIGlmICh0b21vcnJvd01hdGNoKSB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKG5vdylcbiAgICBkLnNldERhdGUoZC5nZXREYXRlKCkgKyAxKVxuICAgIGNvbnN0IHBlcmlvZCA9IHRvbW9ycm93TWF0Y2hbMV0gfHwgJydcbiAgICBsZXQgaG91ciA9IHBhcnNlSW50KHRvbW9ycm93TWF0Y2hbMl0pXG4gICAgY29uc3QgbWludXRlID0gdG9tb3Jyb3dNYXRjaFszXSA/IHBhcnNlSW50KHRvbW9ycm93TWF0Y2hbM10pIDogMFxuICAgIGlmICgocGVyaW9kID09PSAn5LiL5Y2IJyB8fCBwZXJpb2QgPT09ICfmmZrkuIonKSAmJiBob3VyIDwgMTIpIGhvdXIgKz0gMTJcbiAgICBpZiAoKHBlcmlvZCA9PT0gJ+aXqeS4iicgfHwgcGVyaW9kID09PSAn5LiK5Y2IJykgJiYgaG91ciA9PT0gMTIpIGhvdXIgPSAwXG4gICAgZC5zZXRIb3Vycyhob3VyLCBtaW51dGUsIDAsIDApXG4gICAgcmVtaW5kQXQgPSBkLmdldFRpbWUoKVxuICAgIHRpdGxlID0gdGV4dC5yZXBsYWNlKHRvbW9ycm93TWF0Y2hbMF0sICcnKS50cmltKClcbiAgfVxuXG4gIC8vIFwi5LuK5aSp5LiL5Y2IM+eCuVwiXG4gIGNvbnN0IHRvZGF5TWF0Y2ggPSB0ZXh0Lm1hdGNoKC/ku4rlpKko5LiK5Y2IfOS4i+WNiHzml6nkuIp85pma5LiKKT8oXFxkezEsMn0pW+eCuTrvvJpdKFxcZHsyfSk/LylcbiAgaWYgKHRvZGF5TWF0Y2ggJiYgIXJlbWluZEF0KSB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKG5vdylcbiAgICBjb25zdCBwZXJpb2QgPSB0b2RheU1hdGNoWzFdIHx8ICcnXG4gICAgbGV0IGhvdXIgPSBwYXJzZUludCh0b2RheU1hdGNoWzJdKVxuICAgIGNvbnN0IG1pbnV0ZSA9IHRvZGF5TWF0Y2hbM10gPyBwYXJzZUludCh0b2RheU1hdGNoWzNdKSA6IDBcbiAgICBpZiAoKHBlcmlvZCA9PT0gJ+S4i+WNiCcgfHwgcGVyaW9kID09PSAn5pma5LiKJykgJiYgaG91ciA8IDEyKSBob3VyICs9IDEyXG4gICAgaWYgKChwZXJpb2QgPT09ICfml6nkuIonIHx8IHBlcmlvZCA9PT0gJ+S4iuWNiCcpICYmIGhvdXIgPT09IDEyKSBob3VyID0gMFxuICAgIGQuc2V0SG91cnMoaG91ciwgbWludXRlLCAwLCAwKVxuICAgIGlmIChkLmdldFRpbWUoKSA+IG5vdy5nZXRUaW1lKCkpIHtcbiAgICAgIHJlbWluZEF0ID0gZC5nZXRUaW1lKClcbiAgICAgIHRpdGxlID0gdGV4dC5yZXBsYWNlKHRvZGF5TWF0Y2hbMF0sICcnKS50cmltKClcbiAgICB9XG4gIH1cblxuICAvLyBcIjHlsI/ml7blkI5cIiAvIFwiMzDliIbpkp/lkI5cIlxuICBjb25zdCBkdXJhdGlvbk1hdGNoID0gdGV4dC5tYXRjaCgvKFxcZCspKOWwj+aXtnzliIbpkp985aSpKeWQji8pXG4gIGlmIChkdXJhdGlvbk1hdGNoICYmICFyZW1pbmRBdCkge1xuICAgIGNvbnN0IG51bSA9IHBhcnNlSW50KGR1cmF0aW9uTWF0Y2hbMV0pXG4gICAgY29uc3QgdW5pdCA9IGR1cmF0aW9uTWF0Y2hbMl1cbiAgICBjb25zdCBkID0gbmV3IERhdGUobm93KVxuICAgIGlmICh1bml0ID09PSAn5bCP5pe2JykgZC5zZXRIb3VycyhkLmdldEhvdXJzKCkgKyBudW0pXG4gICAgZWxzZSBpZiAodW5pdCA9PT0gJ+WIhumSnycpIGQuc2V0TWludXRlcyhkLmdldE1pbnV0ZXMoKSArIG51bSlcbiAgICBlbHNlIGlmICh1bml0ID09PSAn5aSpJykgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgbnVtKVxuICAgIHJlbWluZEF0ID0gZC5nZXRUaW1lKClcbiAgICB0aXRsZSA9IHRleHQucmVwbGFjZShkdXJhdGlvbk1hdGNoWzBdLCAnJykudHJpbSgpXG4gIH1cblxuICAvLyDilIDilIAg6Iux5paH6Ieq54S26K+t6KiA6Kej5p6QIOKUgOKUgFxuXG4gIC8vIFwidG9tb3Jyb3cgM3BtXCIgLyBcInRvbW9ycm93IGF0IDNwbVwiIC8gXCJ0b21vcnJvdyAxNTowMFwiIC8gXCJ0b21vcnJvdyA5OjMwYW1cIlxuICBjb25zdCBlblRvbW9ycm93TWF0Y2ggPSB0ZXh0Lm1hdGNoKC9cXGJ0b21vcnJvd1xcYi4qPyhcXGR7MSwyfSkoPzo6KFxcZHsyfSkpP1xccyooYW18cG0pPy9pKVxuICBpZiAoZW5Ub21vcnJvd01hdGNoICYmICFyZW1pbmRBdCkge1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShub3cpXG4gICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSlcbiAgICBsZXQgaG91ciA9IHBhcnNlSW50KGVuVG9tb3Jyb3dNYXRjaFsxXSlcbiAgICBjb25zdCBtaW51dGUgPSBlblRvbW9ycm93TWF0Y2hbMl0gPyBwYXJzZUludChlblRvbW9ycm93TWF0Y2hbMl0pIDogMFxuICAgIGNvbnN0IHBlcmlvZCA9IGVuVG9tb3Jyb3dNYXRjaFszXT8udG9Mb3dlckNhc2UoKVxuICAgIGlmIChwZXJpb2QgPT09ICdwbScgJiYgaG91ciA8IDEyKSBob3VyICs9IDEyXG4gICAgaWYgKHBlcmlvZCA9PT0gJ2FtJyAmJiBob3VyID09PSAxMikgaG91ciA9IDBcbiAgICBkLnNldEhvdXJzKGhvdXIsIG1pbnV0ZSwgMCwgMClcbiAgICByZW1pbmRBdCA9IGQuZ2V0VGltZSgpXG4gICAgdGl0bGUgPSB0ZXh0LnJlcGxhY2UoZW5Ub21vcnJvd01hdGNoWzBdLCAnJykudHJpbSgpXG4gIH1cblxuICAvLyBcInRvZGF5IDNwbVwiIC8gXCJ0b2RheSBhdCAzcG1cIiAvIFwiM3BtXCLvvIjku4rlpKnvvIzlpoLmnpzlt7Lov4fliJnmmI7lpKnvvIlcbiAgY29uc3QgZW5Ub2RheU1hdGNoID0gdGV4dC5tYXRjaCgvKD86XFxidG9kYXlcXGJcXHMrKT8oPzphdFxccyspPyhcXGR7MSwyfSkoPzo6KFxcZHsyfSkpP1xccyooYW18cG0pXFxiL2kpXG4gIGlmIChlblRvZGF5TWF0Y2ggJiYgIXJlbWluZEF0KSB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKG5vdylcbiAgICBsZXQgaG91ciA9IHBhcnNlSW50KGVuVG9kYXlNYXRjaFsxXSlcbiAgICBjb25zdCBtaW51dGUgPSBlblRvZGF5TWF0Y2hbMl0gPyBwYXJzZUludChlblRvZGF5TWF0Y2hbMl0pIDogMFxuICAgIGNvbnN0IHBlcmlvZCA9IGVuVG9kYXlNYXRjaFszXT8udG9Mb3dlckNhc2UoKVxuICAgIGlmIChwZXJpb2QgPT09ICdwbScgJiYgaG91ciA8IDEyKSBob3VyICs9IDEyXG4gICAgaWYgKHBlcmlvZCA9PT0gJ2FtJyAmJiBob3VyID09PSAxMikgaG91ciA9IDBcbiAgICBkLnNldEhvdXJzKGhvdXIsIG1pbnV0ZSwgMCwgMClcbiAgICAvLyDlpoLmnpzml7bpl7Tlt7Lov4fvvIzorr7kuLrmmI7lpKlcbiAgICBpZiAoZC5nZXRUaW1lKCkgPD0gbm93LmdldFRpbWUoKSkge1xuICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSlcbiAgICB9XG4gICAgcmVtaW5kQXQgPSBkLmdldFRpbWUoKVxuICAgIHRpdGxlID0gdGV4dC5yZXBsYWNlKGVuVG9kYXlNYXRjaFswXSwgJycpLnRyaW0oKVxuICB9XG5cbiAgLy8gXCJpbiAxIGhvdXJcIiAvIFwiaW4gMzAgbWludXRlc1wiIC8gXCJpbiAyIGRheXNcIlxuICBjb25zdCBlbkR1cmF0aW9uTWF0Y2ggPSB0ZXh0Lm1hdGNoKC9cXGJpblxccysoXFxkKylcXHMrKGhvdXJ8aG91cnN8bWludXRlfG1pbnV0ZXN8ZGF5fGRheXMpXFxiL2kpXG4gIGlmIChlbkR1cmF0aW9uTWF0Y2ggJiYgIXJlbWluZEF0KSB7XG4gICAgY29uc3QgbnVtID0gcGFyc2VJbnQoZW5EdXJhdGlvbk1hdGNoWzFdKVxuICAgIGNvbnN0IHVuaXQgPSBlbkR1cmF0aW9uTWF0Y2hbMl0udG9Mb3dlckNhc2UoKVxuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShub3cpXG4gICAgaWYgKHVuaXQuc3RhcnRzV2l0aCgnaG91cicpKSBkLnNldEhvdXJzKGQuZ2V0SG91cnMoKSArIG51bSlcbiAgICBlbHNlIGlmICh1bml0LnN0YXJ0c1dpdGgoJ21pbnV0ZScpKSBkLnNldE1pbnV0ZXMoZC5nZXRNaW51dGVzKCkgKyBudW0pXG4gICAgZWxzZSBpZiAodW5pdC5zdGFydHNXaXRoKCdkYXknKSkgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgbnVtKVxuICAgIHJlbWluZEF0ID0gZC5nZXRUaW1lKClcbiAgICB0aXRsZSA9IHRleHQucmVwbGFjZShlbkR1cmF0aW9uTWF0Y2hbMF0sICcnKS50cmltKClcbiAgfVxuXG4gIHJldHVybiB7IHRpdGxlOiB0aXRsZSB8fCB0ZXh0LCByZW1pbmRBdCB9XG59XG5cbmZ1bmN0aW9uIG9uUXVpY2tUaW1lQ2hhbmdlKCk6IHZvaWQge1xuICBpZiAocXVpY2tUaW1lLnZhbHVlID09PSAnY3VzdG9tJykgcmV0dXJuXG4gIC8vIOmAieaLqeW/q+aNt+aXtumXtOWQjuiHquWKqOWIm+W7ulxuICBpZiAobmV3VGl0bGUudmFsdWUudHJpbSgpKSBjcmVhdGVSZW1pbmRlcigpXG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVSZW1pbmRBdCgpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKVxuICBzd2l0Y2ggKHF1aWNrVGltZS52YWx1ZSkge1xuICAgIGNhc2UgJzFoJzpcbiAgICAgIHJldHVybiBub3cgKyA2MCAqIDYwICogMTAwMFxuICAgIGNhc2UgJzNoJzpcbiAgICAgIHJldHVybiBub3cgKyAzICogNjAgKiA2MCAqIDEwMDBcbiAgICBjYXNlICd0b21vcnJvdzknOiB7XG4gICAgICBjb25zdCBkID0gbmV3IERhdGUoKVxuICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSlcbiAgICAgIGQuc2V0SG91cnMoOSwgMCwgMCwgMClcbiAgICAgIHJldHVybiBkLmdldFRpbWUoKVxuICAgIH1cbiAgICBjYXNlICd0b21vcnJvdzE0Jzoge1xuICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKClcbiAgICAgIGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpXG4gICAgICBkLnNldEhvdXJzKDE0LCAwLCAwLCAwKVxuICAgICAgcmV0dXJuIGQuZ2V0VGltZSgpXG4gICAgfVxuICAgIGNhc2UgJ2N1c3RvbSc6XG4gICAgICByZXR1cm4gY3VzdG9tVGltZS52YWx1ZSA/IG5ldyBEYXRlKGN1c3RvbVRpbWUudmFsdWUpLmdldFRpbWUoKSA6IG51bGxcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVSZW1pbmRlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgdGl0bGUgPSBuZXdUaXRsZS52YWx1ZS50cmltKClcbiAgaWYgKCF0aXRsZSkgcmV0dXJuXG5cbiAgLy8g5YWI6Kej5p6Q6Ieq54S26K+t6KiAXG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlTmF0dXJhbExhbmd1YWdlKHRpdGxlKVxuICBsZXQgcmVtaW5kQXQgPSBwYXJzZWQucmVtaW5kQXRcblxuICAvLyDlpoLmnpznlKjmiLfmiYvliqjpgInmi6nkuobml7bpl7TvvIzopobnm5boh6rnhLbor63oqIDop6PmnpBcbiAgaWYgKHF1aWNrVGltZS52YWx1ZSkge1xuICAgIHJlbWluZEF0ID0gY29tcHV0ZVJlbWluZEF0KClcbiAgfVxuXG4gIHRyeSB7XG4gICAgYXdhaXQgd2luZG93LmFwaS5yZW1pbmRlcnMuY3JlYXRlKHtcbiAgICAgIHRpdGxlOiBwYXJzZWQudGl0bGUsXG4gICAgICByZW1pbmRBdFxuICAgIH0pXG4gICAgbmV3VGl0bGUudmFsdWUgPSAnJ1xuICAgIHF1aWNrVGltZS52YWx1ZSA9ICcnXG4gICAgY3VzdG9tVGltZS52YWx1ZSA9ICcnXG4gICAgc2hvd1RpbWVQaWNrZXIudmFsdWUgPSBmYWxzZVxuICAgIGF3YWl0IGxvYWRSZW1pbmRlcnMoKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tSZW1pbmRlcl0g5Yib5bu65aSx6LSlOicsIGVycilcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB0b2dnbGVDb21wbGV0ZShpZDogc3RyaW5nLCBpc0NvbXBsZXRlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGlmIChpc0NvbXBsZXRlZCkge1xuICAgICAgYXdhaXQgd2luZG93LmFwaS5yZW1pbmRlcnMudW5jb21wbGV0ZShpZClcbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgd2luZG93LmFwaS5yZW1pbmRlcnMuY29tcGxldGUoaWQpXG4gICAgfVxuICAgIGF3YWl0IGxvYWRSZW1pbmRlcnMoKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tSZW1pbmRlcl0g5pON5L2c5aSx6LSlOicsIGVycilcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZW1vdmVSZW1pbmRlcihpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgd2luZG93LmFwaS5yZW1pbmRlcnMucmVtb3ZlKGlkKVxuICAgIGF3YWl0IGxvYWRSZW1pbmRlcnMoKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tSZW1pbmRlcl0g5Yig6Zmk5aSx6LSlOicsIGVycilcbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXRUaW1lKHRzOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBkID0gbmV3IERhdGUodHMpXG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKClcbiAgY29uc3QgaXNUb2RheSA9IGQudG9EYXRlU3RyaW5nKCkgPT09IG5vdy50b0RhdGVTdHJpbmcoKVxuICBjb25zdCB0b21vcnJvdyA9IG5ldyBEYXRlKG5vdylcbiAgdG9tb3Jyb3cuc2V0RGF0ZSh0b21vcnJvdy5nZXREYXRlKCkgKyAxKVxuICBjb25zdCBpc1RvbW9ycm93ID0gZC50b0RhdGVTdHJpbmcoKSA9PT0gdG9tb3Jyb3cudG9EYXRlU3RyaW5nKClcblxuICBjb25zdCB0aW1lID0gYCR7U3RyaW5nKGQuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgJzAnKX06JHtTdHJpbmcoZC5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsICcwJyl9YFxuICBpZiAoaXNUb2RheSkgcmV0dXJuIGDku4rlpKkgJHt0aW1lfWBcbiAgaWYgKGlzVG9tb3Jyb3cpIHJldHVybiBg5piO5aSpICR7dGltZX1gXG4gIHJldHVybiBgJHtkLmdldE1vbnRoKCkgKyAxfeaciCR7ZC5nZXREYXRlKCl95pelICR7dGltZX1gXG59XG5cbmZ1bmN0aW9uIGlzT3ZlcmR1ZShyZW1pbmRlcjogUmVtaW5kZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuICFyZW1pbmRlci5pc0NvbXBsZXRlZCAmJiByZW1pbmRlci5yZW1pbmRBdCAhPT0gbnVsbCAmJiByZW1pbmRlci5yZW1pbmRBdCA8IERhdGUubm93KClcbn1cblxub25Nb3VudGVkKCgpID0+IHtcbiAgdm9pZCBsb2FkUmVtaW5kZXJzKClcbn0pXG5cbi8vIOiDtuWbiuaQnOe0ouivjeWPmOWMliDihpIg6YeN5paw6LWw5ZCO56uv5qOA57Si77yIUmF5Y2FzdCDlvI/vvJrpobXlhoXmkJzntKLot5/pmo/moLnmkJzntKLmoYbvvIlcbndhdGNoKFxuICAoKSA9PiBwcm9wcy5xdWVyeSxcbiAgKCkgPT4ge1xuICAgIHZvaWQgbG9hZFJlbWluZGVycygpXG4gIH1cbilcbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkIGxhbmc9XCJsZXNzXCI+XG4ucmVtaW5kZXItcGFnZSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gIGhlaWdodDogMTAwJTtcbiAgcGFkZGluZzogOHB4IDEycHg7XG4gIGdhcDogOHB4O1xufVxuXG4ucmVtaW5kZXItY3JlYXRlIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA4cHg7XG59XG5cbi5yZW1pbmRlci1jcmVhdGUtaW5wdXQge1xuICBmbGV4OiAxO1xuICBwYWRkaW5nOiA4cHggMTJweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgYm9yZGVyLXJhZGl1czogOHB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1pbnB1dC1iZyk7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBvdXRsaW5lOiBub25lO1xuXG4gICY6Zm9jdXMge1xuICAgIGJvcmRlci1jb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgfVxufVxuXG4ucmVtaW5kZXItY3JlYXRlLWJ0biB7XG4gIHdpZHRoOiAzMnB4O1xuICBoZWlnaHQ6IDMycHg7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICBib3JkZXI6IG5vbmU7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgY29sb3I6ICNmZmY7XG4gIGN1cnNvcjogcG9pbnRlcjtcblxuICAmOmhvdmVyIHtcbiAgICBvcGFjaXR5OiAwLjk7XG4gIH1cbn1cblxuLnJlbWluZGVyLXRpbWUtYnRuIHtcbiAgd2lkdGg6IDMycHg7XG4gIGhlaWdodDogMzJweDtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgY3Vyc29yOiBwb2ludGVyO1xuXG4gICY6aG92ZXIge1xuICAgIGJvcmRlci1jb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgfVxuXG4gICYuYWN0aXZlIHtcbiAgICBib3JkZXItY29sb3I6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG4gICAgY29sb3I6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LWJnKTtcbiAgfVxufVxuXG4ucmVtaW5kZXItdGltZS1waWNrZXIge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDhweDtcbn1cblxuLnJlbWluZGVyLXRpbWUtc2VsZWN0LFxuLnJlbWluZGVyLXRpbWUtY3VzdG9tIHtcbiAgcGFkZGluZzogNnB4IDEwcHg7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItaW5wdXQtYmcpO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIGZvbnQtc2l6ZTogMTJweDtcbn1cblxuLnJlbWluZGVyLXRhYnMge1xuICBkaXNwbGF5OiBmbGV4O1xuICBnYXA6IDRweDtcbiAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIHBhZGRpbmctYm90dG9tOiA0cHg7XG59XG5cbi5yZW1pbmRlci10YWIge1xuICBwYWRkaW5nOiA2cHggMTJweDtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBmb250LXNpemU6IDEycHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgYm9yZGVyLXJhZGl1czogNnB4O1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDZweDtcblxuICAmLmFjdGl2ZSB7XG4gICAgY29sb3I6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50LWJnKTtcbiAgfVxufVxuXG4ucmVtaW5kZXItdGFiLWNvdW50IHtcbiAgZm9udC1zaXplOiAxMHB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1iYWRnZS1iZyk7XG4gIHBhZGRpbmc6IDFweCA2cHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbn1cblxuLnJlbWluZGVyLWxpc3Qge1xuICBmbGV4OiAxO1xuICBvdmVyZmxvdy15OiBhdXRvO1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDRweDtcbn1cblxuLnJlbWluZGVyLWVtcHR5IHtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIHBhZGRpbmc6IDQwcHggMjBweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZmFpbnQpO1xuICBnYXA6IDEycHg7XG59XG5cbi5yZW1pbmRlci1lbXB0eS10ZXh0IHtcbiAgZm9udC1zaXplOiAxM3B4O1xufVxuXG4ucmVtaW5kZXItaXRlbSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICBnYXA6IDEwcHg7XG4gIHBhZGRpbmc6IDEwcHggMTJweDtcbiAgYm9yZGVyLXJhZGl1czogOHB4O1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4xMnM7XG5cbiAgJjpob3ZlciB7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItcmVzdWx0LWhvdmVyKTtcbiAgfVxuXG4gICYuY29tcGxldGVkIC5yZW1pbmRlci10aXRsZSB7XG4gICAgdGV4dC1kZWNvcmF0aW9uOiBsaW5lLXRocm91Z2g7XG4gICAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZmFpbnQpO1xuICB9XG5cbiAgJi5vdmVyZHVlIC5yZW1pbmRlci10aXRsZSB7XG4gICAgY29sb3I6IHZhcigtLWxhdW5jaGVyLWRhbmdlciwgI2VhNjY2OCk7XG4gIH1cbn1cblxuLnJlbWluZGVyLWNoZWNrYm94IHtcbiAgZmxleC1zaHJpbms6IDA7XG4gIHdpZHRoOiAyNHB4O1xuICBoZWlnaHQ6IDI0cHg7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICBib3JkZXI6IG5vbmU7XG4gIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcblxuICAmOmhvdmVyIHtcbiAgICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgfVxufVxuXG4ucmVtaW5kZXItY29udGVudCB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcbn1cblxuLnJlbWluZGVyLXRpdGxlIHtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBmb250LXdlaWdodDogNTAwO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG59XG5cbi5yZW1pbmRlci1ub3RlcyB7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBtYXJnaW4tdG9wOiAycHg7XG4gIHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7XG59XG5cbi5yZW1pbmRlci10aW1lIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA0cHg7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtbXV0ZWQpO1xuICBtYXJnaW4tdG9wOiA0cHg7XG5cbiAgLm92ZXJkdWUge1xuICAgIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1kYW5nZXIsICNlYTY2NjgpO1xuICB9XG59XG5cbi5yZW1pbmRlci1kZWxldGUge1xuICBmbGV4LXNocmluazogMDtcbiAgd2lkdGg6IDI0cHg7XG4gIGhlaWdodDogMjRweDtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGJvcmRlcjogbm9uZTtcbiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZmFpbnQpO1xuICBvcGFjaXR5OiAwO1xuICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTJzO1xuXG4gIC5yZW1pbmRlci1pdGVtOmhvdmVyICYge1xuICAgIG9wYWNpdHk6IDE7XG4gIH1cblxuICAmOmhvdmVyIHtcbiAgICBjb2xvcjogdmFyKC0tbGF1bmNoZXItZGFuZ2VyLCAjZWE2NjY4KTtcbiAgfVxufVxuPC9zdHlsZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvbGF1bmNoZXIvcGFnZXMvUmVtaW5kZXJQYWdlLnZ1ZSJ9