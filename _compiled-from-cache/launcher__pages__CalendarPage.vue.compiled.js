import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/CalendarPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { ref, computed, onMounted } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import PageFooterBar from "/src/launcher/pages/PageFooterBar.vue";
import AppIcon from "/src/components/AppIcon.vue";
import { formatClock } from "/src/utils/format.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "CalendarPage",
  setup(__props, { expose: __expose }) {
    __expose();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const now = /* @__PURE__ */ new Date();
    const year = ref(now.getFullYear());
    const month = ref(now.getMonth());
    const selectedDate = ref(null);
    const reminders = ref([]);
    const calendarDays = computed(() => {
      const firstDay = new Date(year.value, month.value, 1);
      const lastDay = new Date(year.value, month.value + 1, 0);
      const startWeekday = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      const daysInPrevMonth = new Date(year.value, month.value, 0).getDate();
      const today = /* @__PURE__ */ new Date();
      const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      const days = [];
      for (let i = startWeekday - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const ts = new Date(year.value, month.value - 1, d).getTime();
        days.push({
          year: year.value,
          month: month.value - 1,
          date: d,
          currentMonth: false,
          isToday: false,
          isSelected: false,
          reminderCount: countRemindersOnDay(ts),
          timestamp: ts
        });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const ts = new Date(year.value, month.value, d).getTime();
        const dayStr = `${year.value}-${month.value}-${d}`;
        days.push({
          year: year.value,
          month: month.value,
          date: d,
          currentMonth: true,
          isToday: dayStr === todayStr,
          isSelected: selectedDate.value?.timestamp === ts,
          reminderCount: countRemindersOnDay(ts),
          timestamp: ts
        });
      }
      const remaining = 42 - days.length;
      for (let d = 1; d <= remaining; d++) {
        const ts = new Date(year.value, month.value + 1, d).getTime();
        days.push({
          year: year.value,
          month: month.value + 1,
          date: d,
          currentMonth: false,
          isToday: false,
          isSelected: false,
          reminderCount: countRemindersOnDay(ts),
          timestamp: ts
        });
      }
      return days;
    });
    const dayReminders = computed(() => {
      if (!selectedDate.value) return [];
      const start = selectedDate.value.timestamp;
      const end = start + 24 * 60 * 60 * 1e3;
      return reminders.value.filter((r) => {
        if (r.isDeleted) return false;
        const t = r.remindAt || r.dueAt;
        if (!t) return false;
        return t >= start && t < end;
      });
    });
    function countRemindersOnDay(timestamp) {
      const start = timestamp;
      const end = start + 24 * 60 * 60 * 1e3;
      return reminders.value.filter((r) => {
        if (r.isDeleted) return false;
        const t = r.remindAt || r.dueAt;
        if (!t) return false;
        return t >= start && t < end;
      }).length;
    }
    function prevMonth() {
      if (month.value === 0) {
        month.value = 11;
        year.value--;
      } else {
        month.value--;
      }
    }
    function nextMonth() {
      if (month.value === 11) {
        month.value = 0;
        year.value++;
      } else {
        month.value++;
      }
    }
    function goToday() {
      const t = /* @__PURE__ */ new Date();
      year.value = t.getFullYear();
      month.value = t.getMonth();
      const ts = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      selectedDate.value = {
        year: t.getFullYear(),
        month: t.getMonth(),
        date: t.getDate(),
        currentMonth: true,
        isToday: true,
        isSelected: true,
        reminderCount: countRemindersOnDay(ts),
        timestamp: ts
      };
    }
    function selectDate(day) {
      selectedDate.value = { ...day, isSelected: true };
    }
    async function toggleReminder(reminder) {
      try {
        if (reminder.isCompleted) {
          await window.api.reminders.uncomplete(reminder.id);
        } else {
          await window.api.reminders.complete(reminder.id);
        }
        await loadReminders();
      } catch (err) {
        console.warn("[Calendar] 操作失败:", err);
      }
    }
    const formatTime = formatClock;
    async function loadReminders() {
      try {
        reminders.value = await window.api.reminders.list({ isDeleted: false });
      } catch (err) {
        console.warn("[Calendar] 加载提醒失败:", err);
      }
    }
    onMounted(() => {
      void loadReminders();
      goToday();
    });
    const __returned__ = { weekdays, now, year, month, selectedDate, reminders, calendarDays, dayReminders, countRemindersOnDay, prevMonth, nextMonth, goToday, selectDate, toggleReminder, formatTime, loadReminders, PageFooterBar, AppIcon };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createVNode as _createVNode, withModifiers as _withModifiers, createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, normalizeClass as _normalizeClass, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "calendar-page" };
const _hoisted_2 = { class: "cal-header" };
const _hoisted_3 = { class: "cal-title" };
const _hoisted_4 = { class: "cal-weekdays" };
const _hoisted_5 = { class: "cal-grid" };
const _hoisted_6 = ["onMousedown"];
const _hoisted_7 = { class: "cal-day-num" };
const _hoisted_8 = {
  key: 0,
  class: "cal-day-dots"
};
const _hoisted_9 = {
  key: 0,
  class: "cal-reminders"
};
const _hoisted_10 = { class: "cal-reminders-title" };
const _hoisted_11 = {
  key: 0,
  class: "cal-reminders-empty"
};
const _hoisted_12 = ["onMousedown"];
const _hoisted_13 = { class: "cal-reminder-title" };
const _hoisted_14 = {
  key: 0,
  class: "cal-reminder-time"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createCommentVNode(" 头部：月份切换 "),
    _createElementVNode("div", _hoisted_2, [
      _createElementVNode(
        "button",
        {
          class: "cal-nav-btn",
          onMousedown: _withModifiers($setup.prevMonth, ["prevent"])
        },
        [
          _createVNode($setup["AppIcon"], {
            icon: "arrow-left-s-line",
            size: 16
          })
        ],
        32
        /* NEED_HYDRATION */
      ),
      _createElementVNode(
        "div",
        _hoisted_3,
        _toDisplayString($setup.year) + "年" + _toDisplayString($setup.month + 1) + "月",
        1
        /* TEXT */
      ),
      _createElementVNode(
        "button",
        {
          class: "cal-nav-btn",
          onMousedown: _withModifiers($setup.nextMonth, ["prevent"])
        },
        [
          _createVNode($setup["AppIcon"], {
            icon: "arrow-right-s-line",
            size: 16
          })
        ],
        32
        /* NEED_HYDRATION */
      ),
      _createElementVNode(
        "button",
        {
          class: "cal-today-btn",
          onMousedown: _withModifiers($setup.goToday, ["prevent"])
        },
        "今天",
        32
        /* NEED_HYDRATION */
      )
    ]),
    _createCommentVNode(" 星期表头 "),
    _createElementVNode("div", _hoisted_4, [
      (_openBlock(), _createElementBlock(
        _Fragment,
        null,
        _renderList($setup.weekdays, (day) => {
          return _createElementVNode(
            "div",
            {
              key: day,
              class: "cal-weekday"
            },
            _toDisplayString(day),
            1
            /* TEXT */
          );
        }),
        64
        /* STABLE_FRAGMENT */
      ))
    ]),
    _createCommentVNode(" 日期网格 "),
    _createElementVNode("div", _hoisted_5, [
      (_openBlock(true), _createElementBlock(
        _Fragment,
        null,
        _renderList($setup.calendarDays, (day, idx) => {
          return _openBlock(), _createElementBlock("div", {
            key: idx,
            class: _normalizeClass(["cal-day", {
              "other-month": !day.currentMonth,
              today: day.isToday,
              selected: day.isSelected,
              "has-reminder": day.reminderCount > 0
            }]),
            onMousedown: _withModifiers(($event) => $setup.selectDate(day), ["prevent"])
          }, [
            _createElementVNode(
              "span",
              _hoisted_7,
              _toDisplayString(day.date),
              1
              /* TEXT */
            ),
            day.reminderCount > 0 ? (_openBlock(), _createElementBlock("div", _hoisted_8, [
              (_openBlock(true), _createElementBlock(
                _Fragment,
                null,
                _renderList(Math.min(day.reminderCount, 3), (n) => {
                  return _openBlock(), _createElementBlock("span", {
                    key: n,
                    class: "cal-dot"
                  });
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : _createCommentVNode("v-if", true)
          ], 42, _hoisted_6);
        }),
        128
        /* KEYED_FRAGMENT */
      ))
    ]),
    _createCommentVNode(" 选中日期的提醒列表 "),
    $setup.selectedDate ? (_openBlock(), _createElementBlock("div", _hoisted_9, [
      _createElementVNode("div", _hoisted_10, [
        _createVNode($setup["AppIcon"], {
          icon: "alarm-line",
          size: 14
        }),
        _createElementVNode(
          "span",
          null,
          _toDisplayString($setup.selectedDate.year) + "年" + _toDisplayString($setup.selectedDate.month + 1) + "月" + _toDisplayString($setup.selectedDate.date) + "日 提醒",
          1
          /* TEXT */
        )
      ]),
      $setup.dayReminders.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_11, "当天暂无提醒")) : _createCommentVNode("v-if", true),
      (_openBlock(true), _createElementBlock(
        _Fragment,
        null,
        _renderList($setup.dayReminders, (reminder) => {
          return _openBlock(), _createElementBlock("div", {
            key: reminder.id,
            class: "cal-reminder-item"
          }, [
            _createElementVNode("button", {
              class: "cal-reminder-check",
              onMousedown: _withModifiers(($event) => $setup.toggleReminder(reminder), ["prevent"])
            }, [
              reminder.isCompleted ? (_openBlock(), _createBlock($setup["AppIcon"], {
                key: 0,
                icon: "checkbox-circle-fill",
                size: 16
              })) : (_openBlock(), _createBlock($setup["AppIcon"], {
                key: 1,
                icon: "checkbox-circle-line",
                size: 16
              }))
            ], 40, _hoisted_12),
            _createElementVNode(
              "div",
              {
                class: _normalizeClass(["cal-reminder-content", { completed: reminder.isCompleted }])
              },
              [
                _createElementVNode(
                  "div",
                  _hoisted_13,
                  _toDisplayString(reminder.title),
                  1
                  /* TEXT */
                ),
                reminder.remindAt ? (_openBlock(), _createElementBlock(
                  "div",
                  _hoisted_14,
                  _toDisplayString($setup.formatTime(reminder.remindAt)),
                  1
                  /* TEXT */
                )) : _createCommentVNode("v-if", true)
              ],
              2
              /* CLASS */
            )
          ]);
        }),
        128
        /* KEYED_FRAGMENT */
      ))
    ])) : _createCommentVNode("v-if", true),
    _createVNode($setup["PageFooterBar"])
  ]);
}
import "/src/launcher/pages/CalendarPage.vue?vue&type=style&index=0&scoped=30fdeeff&lang.less";
_sfc_main.__hmrId = "30fdeeff";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-30fdeeff"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/CalendarPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QXdCLE1BQU07QUFBQTs7WUFFckQ7QUFBQSxjQUtNO0FBQUE7QUFBQSxnQkFMRCxPQUFLLGlCQUFDLHdCQUFzQixhQUFzQixTQUFTLFlBQVc7QUFBQTs7Z0JBQ3pFO0FBQUEsa0JBQTBEO0FBQUEsa0JBQTFEO0FBQUEsa0JBQTBELGlCQUF2QixTQUFTLEtBQUs7QUFBQTtBQUFBO0FBQUE7QUFBQSxnQkFDdEMsU0FBUywwQkFBcEI7QUFBQSxrQkFFTTtBQUFBLGtCQUZOO0FBQUEsa0JBRU0saUJBREQsa0JBQVcsU0FBUyxRQUFRO0FBQUE7QUFBQTtBQUFBOzs7Ozs7Ozs7OztJQUt2QyxhQUFpQjtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJDYWxlbmRhclBhZ2UudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPGRpdiBjbGFzcz1cImNhbGVuZGFyLXBhZ2VcIj5cbiAgICA8IS0tIOWktOmDqO+8muaciOS7veWIh+aNoiAtLT5cbiAgICA8ZGl2IGNsYXNzPVwiY2FsLWhlYWRlclwiPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImNhbC1uYXYtYnRuXCIgQG1vdXNlZG93bi5wcmV2ZW50PVwicHJldk1vbnRoXCI+XG4gICAgICAgIDxBcHBJY29uIGljb249XCJhcnJvdy1sZWZ0LXMtbGluZVwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgPC9idXR0b24+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2FsLXRpdGxlXCI+e3sgeWVhciB9feW5tHt7IG1vbnRoICsgMSB9feaciDwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImNhbC1uYXYtYnRuXCIgQG1vdXNlZG93bi5wcmV2ZW50PVwibmV4dE1vbnRoXCI+XG4gICAgICAgIDxBcHBJY29uIGljb249XCJhcnJvdy1yaWdodC1zLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgIDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImNhbC10b2RheS1idG5cIiBAbW91c2Vkb3duLnByZXZlbnQ9XCJnb1RvZGF5XCI+5LuK5aSpPC9idXR0b24+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOaYn+acn+ihqOWktCAtLT5cbiAgICA8ZGl2IGNsYXNzPVwiY2FsLXdlZWtkYXlzXCI+XG4gICAgICA8ZGl2IHYtZm9yPVwiZGF5IGluIHdlZWtkYXlzXCIgOmtleT1cImRheVwiIGNsYXNzPVwiY2FsLXdlZWtkYXlcIj57eyBkYXkgfX08L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgIDwhLS0g5pel5pyf572R5qC8IC0tPlxuICAgIDxkaXYgY2xhc3M9XCJjYWwtZ3JpZFwiPlxuICAgICAgPGRpdlxuICAgICAgICB2LWZvcj1cIihkYXksIGlkeCkgaW4gY2FsZW5kYXJEYXlzXCJcbiAgICAgICAgOmtleT1cImlkeFwiXG4gICAgICAgIGNsYXNzPVwiY2FsLWRheVwiXG4gICAgICAgIDpjbGFzcz1cIntcbiAgICAgICAgICAnb3RoZXItbW9udGgnOiAhZGF5LmN1cnJlbnRNb250aCxcbiAgICAgICAgICB0b2RheTogZGF5LmlzVG9kYXksXG4gICAgICAgICAgc2VsZWN0ZWQ6IGRheS5pc1NlbGVjdGVkLFxuICAgICAgICAgICdoYXMtcmVtaW5kZXInOiBkYXkucmVtaW5kZXJDb3VudCA+IDBcbiAgICAgICAgfVwiXG4gICAgICAgIEBtb3VzZWRvd24ucHJldmVudD1cInNlbGVjdERhdGUoZGF5KVwiXG4gICAgICA+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiY2FsLWRheS1udW1cIj57eyBkYXkuZGF0ZSB9fTwvc3Bhbj5cbiAgICAgICAgPGRpdiB2LWlmPVwiZGF5LnJlbWluZGVyQ291bnQgPiAwXCIgY2xhc3M9XCJjYWwtZGF5LWRvdHNcIj5cbiAgICAgICAgICA8c3BhbiB2LWZvcj1cIm4gaW4gTWF0aC5taW4oZGF5LnJlbWluZGVyQ291bnQsIDMpXCIgOmtleT1cIm5cIiBjbGFzcz1cImNhbC1kb3RcIj48L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8IS0tIOmAieS4reaXpeacn+eahOaPkOmGkuWIl+ihqCAtLT5cbiAgICA8ZGl2IHYtaWY9XCJzZWxlY3RlZERhdGVcIiBjbGFzcz1cImNhbC1yZW1pbmRlcnNcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjYWwtcmVtaW5kZXJzLXRpdGxlXCI+XG4gICAgICAgIDxBcHBJY29uIGljb249XCJhbGFybS1saW5lXCIgOnNpemU9XCIxNFwiIC8+XG4gICAgICAgIDxzcGFuXG4gICAgICAgICAgPnt7IHNlbGVjdGVkRGF0ZS55ZWFyIH195bm0e3sgc2VsZWN0ZWREYXRlLm1vbnRoICsgMSB9feaciHt7IHNlbGVjdGVkRGF0ZS5kYXRlIH195pelXG4gICAgICAgICAg5o+Q6YaSPC9zcGFuXG4gICAgICAgID5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiB2LWlmPVwiZGF5UmVtaW5kZXJzLmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwiY2FsLXJlbWluZGVycy1lbXB0eVwiPuW9k+WkqeaaguaXoOaPkOmGkjwvZGl2PlxuICAgICAgPGRpdiB2LWZvcj1cInJlbWluZGVyIGluIGRheVJlbWluZGVyc1wiIDprZXk9XCJyZW1pbmRlci5pZFwiIGNsYXNzPVwiY2FsLXJlbWluZGVyLWl0ZW1cIj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNhbC1yZW1pbmRlci1jaGVja1wiIEBtb3VzZWRvd24ucHJldmVudD1cInRvZ2dsZVJlbWluZGVyKHJlbWluZGVyKVwiPlxuICAgICAgICAgIDxBcHBJY29uIHYtaWY9XCJyZW1pbmRlci5pc0NvbXBsZXRlZFwiIGljb249XCJjaGVja2JveC1jaXJjbGUtZmlsbFwiIDpzaXplPVwiMTZcIiAvPlxuICAgICAgICAgIDxBcHBJY29uIHYtZWxzZSBpY29uPVwiY2hlY2tib3gtY2lyY2xlLWxpbmVcIiA6c2l6ZT1cIjE2XCIgLz5cbiAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYWwtcmVtaW5kZXItY29udGVudFwiIDpjbGFzcz1cInsgY29tcGxldGVkOiByZW1pbmRlci5pc0NvbXBsZXRlZCB9XCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImNhbC1yZW1pbmRlci10aXRsZVwiPnt7IHJlbWluZGVyLnRpdGxlIH19PC9kaXY+XG4gICAgICAgICAgPGRpdiB2LWlmPVwicmVtaW5kZXIucmVtaW5kQXRcIiBjbGFzcz1cImNhbC1yZW1pbmRlci10aW1lXCI+XG4gICAgICAgICAgICB7eyBmb3JtYXRUaW1lKHJlbWluZGVyLnJlbWluZEF0KSB9fVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxQYWdlRm9vdGVyQmFyIC8+XG4gIDwvZGl2PlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgY29tcHV0ZWQsIG9uTW91bnRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCBQYWdlRm9vdGVyQmFyIGZyb20gJy4vUGFnZUZvb3RlckJhci52dWUnXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAcmVuZGVyZXIvY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcbmltcG9ydCB7IGZvcm1hdENsb2NrIH0gZnJvbSAnQHV0aWxzL2Zvcm1hdCdcblxuaW50ZXJmYWNlIFJlbWluZGVyIHtcbiAgaWQ6IHN0cmluZ1xuICB0aXRsZTogc3RyaW5nXG4gIG5vdGVzOiBzdHJpbmdcbiAgZHVlQXQ6IG51bWJlciB8IG51bGxcbiAgcmVtaW5kQXQ6IG51bWJlciB8IG51bGxcbiAgaXNDb21wbGV0ZWQ6IGJvb2xlYW5cbiAgaXNEZWxldGVkOiBib29sZWFuXG4gIGNvbXBsZXRlZEF0OiBudW1iZXIgfCBudWxsXG4gIGNyZWF0ZWRBdDogbnVtYmVyXG4gIHVwZGF0ZWRBdDogbnVtYmVyXG59XG5cbmludGVyZmFjZSBDYWxlbmRhckRheSB7XG4gIHllYXI6IG51bWJlclxuICBtb250aDogbnVtYmVyXG4gIGRhdGU6IG51bWJlclxuICBjdXJyZW50TW9udGg6IGJvb2xlYW5cbiAgaXNUb2RheTogYm9vbGVhblxuICBpc1NlbGVjdGVkOiBib29sZWFuXG4gIHJlbWluZGVyQ291bnQ6IG51bWJlclxuICB0aW1lc3RhbXA6IG51bWJlclxufVxuXG5jb25zdCB3ZWVrZGF5cyA9IFsn5pelJywgJ+S4gCcsICfkuownLCAn5LiJJywgJ+WbmycsICfkupQnLCAn5YWtJ11cblxuY29uc3Qgbm93ID0gbmV3IERhdGUoKVxuY29uc3QgeWVhciA9IHJlZihub3cuZ2V0RnVsbFllYXIoKSlcbmNvbnN0IG1vbnRoID0gcmVmKG5vdy5nZXRNb250aCgpKVxuY29uc3Qgc2VsZWN0ZWREYXRlID0gcmVmPENhbGVuZGFyRGF5IHwgbnVsbD4obnVsbClcbmNvbnN0IHJlbWluZGVycyA9IHJlZjxSZW1pbmRlcltdPihbXSlcblxuY29uc3QgY2FsZW5kYXJEYXlzID0gY29tcHV0ZWQ8Q2FsZW5kYXJEYXlbXT4oKCkgPT4ge1xuICBjb25zdCBmaXJzdERheSA9IG5ldyBEYXRlKHllYXIudmFsdWUsIG1vbnRoLnZhbHVlLCAxKVxuICBjb25zdCBsYXN0RGF5ID0gbmV3IERhdGUoeWVhci52YWx1ZSwgbW9udGgudmFsdWUgKyAxLCAwKVxuICBjb25zdCBzdGFydFdlZWtkYXkgPSBmaXJzdERheS5nZXREYXkoKVxuICBjb25zdCBkYXlzSW5Nb250aCA9IGxhc3REYXkuZ2V0RGF0ZSgpXG4gIGNvbnN0IGRheXNJblByZXZNb250aCA9IG5ldyBEYXRlKHllYXIudmFsdWUsIG1vbnRoLnZhbHVlLCAwKS5nZXREYXRlKClcblxuICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKClcbiAgY29uc3QgdG9kYXlTdHIgPSBgJHt0b2RheS5nZXRGdWxsWWVhcigpfS0ke3RvZGF5LmdldE1vbnRoKCl9LSR7dG9kYXkuZ2V0RGF0ZSgpfWBcblxuICBjb25zdCBkYXlzOiBDYWxlbmRhckRheVtdID0gW11cblxuICAvLyDkuIrmnIjloavlhYVcbiAgZm9yIChsZXQgaSA9IHN0YXJ0V2Vla2RheSAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgZCA9IGRheXNJblByZXZNb250aCAtIGlcbiAgICBjb25zdCB0cyA9IG5ldyBEYXRlKHllYXIudmFsdWUsIG1vbnRoLnZhbHVlIC0gMSwgZCkuZ2V0VGltZSgpXG4gICAgZGF5cy5wdXNoKHtcbiAgICAgIHllYXI6IHllYXIudmFsdWUsXG4gICAgICBtb250aDogbW9udGgudmFsdWUgLSAxLFxuICAgICAgZGF0ZTogZCxcbiAgICAgIGN1cnJlbnRNb250aDogZmFsc2UsXG4gICAgICBpc1RvZGF5OiBmYWxzZSxcbiAgICAgIGlzU2VsZWN0ZWQ6IGZhbHNlLFxuICAgICAgcmVtaW5kZXJDb3VudDogY291bnRSZW1pbmRlcnNPbkRheSh0cyksXG4gICAgICB0aW1lc3RhbXA6IHRzXG4gICAgfSlcbiAgfVxuXG4gIC8vIOacrOaciFxuICBmb3IgKGxldCBkID0gMTsgZCA8PSBkYXlzSW5Nb250aDsgZCsrKSB7XG4gICAgY29uc3QgdHMgPSBuZXcgRGF0ZSh5ZWFyLnZhbHVlLCBtb250aC52YWx1ZSwgZCkuZ2V0VGltZSgpXG4gICAgY29uc3QgZGF5U3RyID0gYCR7eWVhci52YWx1ZX0tJHttb250aC52YWx1ZX0tJHtkfWBcbiAgICBkYXlzLnB1c2goe1xuICAgICAgeWVhcjogeWVhci52YWx1ZSxcbiAgICAgIG1vbnRoOiBtb250aC52YWx1ZSxcbiAgICAgIGRhdGU6IGQsXG4gICAgICBjdXJyZW50TW9udGg6IHRydWUsXG4gICAgICBpc1RvZGF5OiBkYXlTdHIgPT09IHRvZGF5U3RyLFxuICAgICAgaXNTZWxlY3RlZDogc2VsZWN0ZWREYXRlLnZhbHVlPy50aW1lc3RhbXAgPT09IHRzLFxuICAgICAgcmVtaW5kZXJDb3VudDogY291bnRSZW1pbmRlcnNPbkRheSh0cyksXG4gICAgICB0aW1lc3RhbXA6IHRzXG4gICAgfSlcbiAgfVxuXG4gIC8vIOS4i+aciOWhq+WFhe+8iOihpem9kCA2IOihjCA0MiDmoLzvvIlcbiAgY29uc3QgcmVtYWluaW5nID0gNDIgLSBkYXlzLmxlbmd0aFxuICBmb3IgKGxldCBkID0gMTsgZCA8PSByZW1haW5pbmc7IGQrKykge1xuICAgIGNvbnN0IHRzID0gbmV3IERhdGUoeWVhci52YWx1ZSwgbW9udGgudmFsdWUgKyAxLCBkKS5nZXRUaW1lKClcbiAgICBkYXlzLnB1c2goe1xuICAgICAgeWVhcjogeWVhci52YWx1ZSxcbiAgICAgIG1vbnRoOiBtb250aC52YWx1ZSArIDEsXG4gICAgICBkYXRlOiBkLFxuICAgICAgY3VycmVudE1vbnRoOiBmYWxzZSxcbiAgICAgIGlzVG9kYXk6IGZhbHNlLFxuICAgICAgaXNTZWxlY3RlZDogZmFsc2UsXG4gICAgICByZW1pbmRlckNvdW50OiBjb3VudFJlbWluZGVyc09uRGF5KHRzKSxcbiAgICAgIHRpbWVzdGFtcDogdHNcbiAgICB9KVxuICB9XG5cbiAgcmV0dXJuIGRheXNcbn0pXG5cbmNvbnN0IGRheVJlbWluZGVycyA9IGNvbXB1dGVkKCgpID0+IHtcbiAgaWYgKCFzZWxlY3RlZERhdGUudmFsdWUpIHJldHVybiBbXVxuICBjb25zdCBzdGFydCA9IHNlbGVjdGVkRGF0ZS52YWx1ZS50aW1lc3RhbXBcbiAgY29uc3QgZW5kID0gc3RhcnQgKyAyNCAqIDYwICogNjAgKiAxMDAwXG4gIHJldHVybiByZW1pbmRlcnMudmFsdWUuZmlsdGVyKChyKSA9PiB7XG4gICAgaWYgKHIuaXNEZWxldGVkKSByZXR1cm4gZmFsc2VcbiAgICBjb25zdCB0ID0gci5yZW1pbmRBdCB8fCByLmR1ZUF0XG4gICAgaWYgKCF0KSByZXR1cm4gZmFsc2VcbiAgICByZXR1cm4gdCA+PSBzdGFydCAmJiB0IDwgZW5kXG4gIH0pXG59KVxuXG5mdW5jdGlvbiBjb3VudFJlbWluZGVyc09uRGF5KHRpbWVzdGFtcDogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3Qgc3RhcnQgPSB0aW1lc3RhbXBcbiAgY29uc3QgZW5kID0gc3RhcnQgKyAyNCAqIDYwICogNjAgKiAxMDAwXG4gIHJldHVybiByZW1pbmRlcnMudmFsdWUuZmlsdGVyKChyKSA9PiB7XG4gICAgaWYgKHIuaXNEZWxldGVkKSByZXR1cm4gZmFsc2VcbiAgICBjb25zdCB0ID0gci5yZW1pbmRBdCB8fCByLmR1ZUF0XG4gICAgaWYgKCF0KSByZXR1cm4gZmFsc2VcbiAgICByZXR1cm4gdCA+PSBzdGFydCAmJiB0IDwgZW5kXG4gIH0pLmxlbmd0aFxufVxuXG5mdW5jdGlvbiBwcmV2TW9udGgoKTogdm9pZCB7XG4gIGlmIChtb250aC52YWx1ZSA9PT0gMCkge1xuICAgIG1vbnRoLnZhbHVlID0gMTFcbiAgICB5ZWFyLnZhbHVlLS1cbiAgfSBlbHNlIHtcbiAgICBtb250aC52YWx1ZS0tXG4gIH1cbn1cblxuZnVuY3Rpb24gbmV4dE1vbnRoKCk6IHZvaWQge1xuICBpZiAobW9udGgudmFsdWUgPT09IDExKSB7XG4gICAgbW9udGgudmFsdWUgPSAwXG4gICAgeWVhci52YWx1ZSsrXG4gIH0gZWxzZSB7XG4gICAgbW9udGgudmFsdWUrK1xuICB9XG59XG5cbmZ1bmN0aW9uIGdvVG9kYXkoKTogdm9pZCB7XG4gIGNvbnN0IHQgPSBuZXcgRGF0ZSgpXG4gIHllYXIudmFsdWUgPSB0LmdldEZ1bGxZZWFyKClcbiAgbW9udGgudmFsdWUgPSB0LmdldE1vbnRoKClcbiAgY29uc3QgdHMgPSBuZXcgRGF0ZSh0LmdldEZ1bGxZZWFyKCksIHQuZ2V0TW9udGgoKSwgdC5nZXREYXRlKCkpLmdldFRpbWUoKVxuICBzZWxlY3RlZERhdGUudmFsdWUgPSB7XG4gICAgeWVhcjogdC5nZXRGdWxsWWVhcigpLFxuICAgIG1vbnRoOiB0LmdldE1vbnRoKCksXG4gICAgZGF0ZTogdC5nZXREYXRlKCksXG4gICAgY3VycmVudE1vbnRoOiB0cnVlLFxuICAgIGlzVG9kYXk6IHRydWUsXG4gICAgaXNTZWxlY3RlZDogdHJ1ZSxcbiAgICByZW1pbmRlckNvdW50OiBjb3VudFJlbWluZGVyc09uRGF5KHRzKSxcbiAgICB0aW1lc3RhbXA6IHRzXG4gIH1cbn1cblxuZnVuY3Rpb24gc2VsZWN0RGF0ZShkYXk6IENhbGVuZGFyRGF5KTogdm9pZCB7XG4gIHNlbGVjdGVkRGF0ZS52YWx1ZSA9IHsgLi4uZGF5LCBpc1NlbGVjdGVkOiB0cnVlIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlUmVtaW5kZXIocmVtaW5kZXI6IFJlbWluZGVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgaWYgKHJlbWluZGVyLmlzQ29tcGxldGVkKSB7XG4gICAgICBhd2FpdCB3aW5kb3cuYXBpLnJlbWluZGVycy51bmNvbXBsZXRlKHJlbWluZGVyLmlkKVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB3aW5kb3cuYXBpLnJlbWluZGVycy5jb21wbGV0ZShyZW1pbmRlci5pZClcbiAgICB9XG4gICAgYXdhaXQgbG9hZFJlbWluZGVycygpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUud2FybignW0NhbGVuZGFyXSDmk43kvZzlpLHotKU6JywgZXJyKVxuICB9XG59XG5cbmNvbnN0IGZvcm1hdFRpbWUgPSBmb3JtYXRDbG9ja1xuXG5hc3luYyBmdW5jdGlvbiBsb2FkUmVtaW5kZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIHJlbWluZGVycy52YWx1ZSA9IChhd2FpdCB3aW5kb3cuYXBpLnJlbWluZGVycy5saXN0KHsgaXNEZWxldGVkOiBmYWxzZSB9KSkgYXMgUmVtaW5kZXJbXVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tDYWxlbmRhcl0g5Yqg6L295o+Q6YaS5aSx6LSlOicsIGVycilcbiAgfVxufVxuXG5vbk1vdW50ZWQoKCkgPT4ge1xuICB2b2lkIGxvYWRSZW1pbmRlcnMoKVxuICAvLyDpu5jorqTpgInkuK3ku4rlpKlcbiAgZ29Ub2RheSgpXG59KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQgbGFuZz1cImxlc3NcIj5cbi5jYWxlbmRhci1wYWdlIHtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgaGVpZ2h0OiAxMDAlO1xuICBwYWRkaW5nOiAxMnB4O1xuICBnYXA6IDhweDtcbn1cblxuLmNhbC1oZWFkZXIge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDhweDtcbn1cblxuLmNhbC1uYXYtYnRuIHtcbiAgd2lkdGg6IDI4cHg7XG4gIGhlaWdodDogMjhweDtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGJvcmRlcjogbm9uZTtcbiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG5cbiAgJjpob3ZlciB7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItcmVzdWx0LWhvdmVyKTtcbiAgICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIH1cbn1cblxuLmNhbC10aXRsZSB7XG4gIGZsZXg6IDE7XG4gIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgZm9udC1zaXplOiAxNHB4O1xuICBmb250LXdlaWdodDogNjAwO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG59XG5cbi5jYWwtdG9kYXktYnRuIHtcbiAgcGFkZGluZzogNHB4IDEwcHg7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG5cbiAgJjpob3ZlciB7XG4gICAgYm9yZGVyLWNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICAgIGNvbG9yOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICB9XG59XG5cbi5jYWwtd2Vla2RheXMge1xuICBkaXNwbGF5OiBncmlkO1xuICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg3LCAxZnIpO1xuICBnYXA6IDJweDtcbn1cblxuLmNhbC13ZWVrZGF5IHtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICBmb250LXNpemU6IDExcHg7XG4gIGZvbnQtd2VpZ2h0OiA1MDA7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0LW11dGVkKTtcbiAgcGFkZGluZzogNHB4IDA7XG59XG5cbi5jYWwtZ3JpZCB7XG4gIGRpc3BsYXk6IGdyaWQ7XG4gIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDcsIDFmcik7XG4gIGdhcDogMnB4O1xufVxuXG4uY2FsLWRheSB7XG4gIGFzcGVjdC1yYXRpbzogMTtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIGdhcDogMnB4O1xuXG4gICY6aG92ZXIge1xuICAgIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLXJlc3VsdC1ob3Zlcik7XG4gIH1cblxuICAmLm90aGVyLW1vbnRoIHtcbiAgICBvcGFjaXR5OiAwLjM7XG4gIH1cblxuICAmLnRvZGF5IHtcbiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQtYmcpO1xuICAgIC5jYWwtZGF5LW51bSB7XG4gICAgICBjb2xvcjogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgfVxuICB9XG5cbiAgJi5zZWxlY3RlZCB7XG4gICAgYmFja2dyb3VuZDogdmFyKC0tbGF1bmNoZXItYWNjZW50KTtcbiAgICAuY2FsLWRheS1udW0ge1xuICAgICAgY29sb3I6ICNmZmY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgIH1cbiAgICAuY2FsLWRvdCB7XG4gICAgICBiYWNrZ3JvdW5kOiAjZmZmO1xuICAgIH1cbiAgfVxufVxuXG4uY2FsLWRheS1udW0ge1xuICBmb250LXNpemU6IDEycHg7XG4gIGNvbG9yOiB2YXIoLS1sYXVuY2hlci10ZXh0KTtcbn1cblxuLmNhbC1kYXktZG90cyB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGdhcDogMnB4O1xufVxuXG4uY2FsLWRvdCB7XG4gIHdpZHRoOiA0cHg7XG4gIGhlaWdodDogNHB4O1xuICBib3JkZXItcmFkaXVzOiA1MCU7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG59XG5cbi5jYWwtcmVtaW5kZXJzIHtcbiAgbWFyZ2luLXRvcDogOHB4O1xuICBwYWRkaW5nLXRvcDogOHB4O1xuICBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tbGF1bmNoZXItYm9yZGVyKTtcbiAgbWF4LWhlaWdodDogMTYwcHg7XG4gIG92ZXJmbG93LXk6IGF1dG87XG59XG5cbi5jYWwtcmVtaW5kZXJzLXRpdGxlIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA2cHg7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICBtYXJnaW4tYm90dG9tOiA4cHg7XG59XG5cbi5jYWwtcmVtaW5kZXJzLWVtcHR5IHtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1mYWludCk7XG4gIHBhZGRpbmc6IDhweCAwO1xuICB0ZXh0LWFsaWduOiBjZW50ZXI7XG59XG5cbi5jYWwtcmVtaW5kZXItaXRlbSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICBnYXA6IDhweDtcbiAgcGFkZGluZzogNnB4IDhweDtcbiAgYm9yZGVyLXJhZGl1czogNnB4O1xuXG4gICY6aG92ZXIge1xuICAgIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLXJlc3VsdC1ob3Zlcik7XG4gIH1cbn1cblxuLmNhbC1yZW1pbmRlci1jaGVjayB7XG4gIGZsZXgtc2hyaW5rOiAwO1xuICB3aWR0aDogMjBweDtcbiAgaGVpZ2h0OiAyMHB4O1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG59XG5cbi5jYWwtcmVtaW5kZXItY29udGVudCB7XG4gIGZsZXg6IDE7XG4gIG1pbi13aWR0aDogMDtcblxuICAmLmNvbXBsZXRlZCAuY2FsLXJlbWluZGVyLXRpdGxlIHtcbiAgICB0ZXh0LWRlY29yYXRpb246IGxpbmUtdGhyb3VnaDtcbiAgICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1mYWludCk7XG4gIH1cbn1cblxuLmNhbC1yZW1pbmRlci10aXRsZSB7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbn1cblxuLmNhbC1yZW1pbmRlci10aW1lIHtcbiAgZm9udC1zaXplOiAxMHB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG4gIG1hcmdpbi10b3A6IDJweDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2xhdW5jaGVyL3BhZ2VzL0NhbGVuZGFyUGFnZS52dWUifQ==