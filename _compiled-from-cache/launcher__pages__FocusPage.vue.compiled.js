import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/FocusPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed, onBeforeUnmount, onMounted, ref } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import CapsulePage from "/src/launcher/pages/CapsulePage.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "FocusPage",
  setup(__props, { expose: __expose }) {
    const snapshot = ref({});
    const displayLeft = ref(0);
    let tickHandle = null;
    const timeText = computed(() => {
      const s = Math.max(0, Math.floor(displayLeft.value));
      const m = Math.floor(s / 60);
      return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    });
    const modeLabel = computed(() => {
      if (!snapshot.value.isRunning && displayLeft.value <= 0) return "空闲";
      if (snapshot.value.currentMode === "work") return snapshot.value.isRunning ? "专注中" : "已暂停";
      return snapshot.value.currentMode === "shortBreak" ? "短休息" : "长休息";
    });
    const stateClass = computed(
      () => snapshot.value.isRunning ? snapshot.value.currentMode === "work" ? "work" : "break" : "idle"
    );
    const progressPercent = computed(() => {
      const total = Math.max(1, snapshot.value.totalSeconds ?? 0);
      return Math.min(100, Math.max(0, (1 - displayLeft.value / total) * 100));
    });
    const hints = computed(() => [
      { keys: "↵", label: snapshot.value.isRunning ? "暂停" : "开始" },
      { keys: "⌘↵", label: "跳过" },
      { keys: "⌘R", label: "重置" },
      { keys: "ESC", label: "返回" }
    ]);
    function applySnapshot(snap) {
      snapshot.value = { ...snapshot.value, ...snap };
      displayLeft.value = snap.timeLeftSeconds ?? 0;
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
      if (snapshot.value.isRunning) {
        tickHandle = setInterval(() => {
          if (displayLeft.value > 0) displayLeft.value -= 1;
        }, 1e3);
      }
    }
    async function toggle() {
      await window.api.pomodoro.dispatchShortcut("toggle");
    }
    async function skip() {
      await window.api.pomodoro.dispatchShortcut("skip");
    }
    async function reset() {
      await window.api.pomodoro.dispatchShortcut("reset");
    }
    function handleKey(e) {
      if (e.key === "Enter") {
        if (e.metaKey || e.ctrlKey) {
          void skip();
        } else {
          void toggle();
        }
        return true;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "r" || e.key === "R")) {
        void reset();
        return true;
      }
      return false;
    }
    __expose({ handleKey });
    let unsubTraySnapshot = null;
    onMounted(async () => {
      try {
        applySnapshot(await window.api.pomodoro.integration.getTraySnapshot());
      } catch {
      }
      window.api.pomodoro.integration.subscribeSnapshot();
      unsubTraySnapshot = window.api.pomodoro.integration.onTraySnapshot(
        (snap) => applySnapshot(snap)
      );
    });
    onBeforeUnmount(() => {
      if (tickHandle) clearInterval(tickHandle);
      unsubTraySnapshot?.();
      unsubTraySnapshot = null;
    });
    const __returned__ = { snapshot, displayLeft, get tickHandle() {
      return tickHandle;
    }, set tickHandle(v) {
      tickHandle = v;
    }, timeText, modeLabel, stateClass, progressPercent, hints, applySnapshot, toggle, skip, reset, handleKey, get unsubTraySnapshot() {
      return unsubTraySnapshot;
    }, set unsubTraySnapshot(v) {
      unsubTraySnapshot = v;
    }, CapsulePage };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { normalizeClass as _normalizeClass, createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, normalizeStyle as _normalizeStyle, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "focus-page" };
const _hoisted_2 = { class: "focus-left" };
const _hoisted_3 = { class: "focus-mode" };
const _hoisted_4 = {
  key: 0,
  class: "focus-task"
};
const _hoisted_5 = { class: "focus-meta" };
const _hoisted_6 = { key: 0 };
const _hoisted_7 = { class: "focus-bar" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["CapsulePage"], { hints: $setup.hints }, {
    default: _withCtx(() => [
      _createElementVNode("div", _hoisted_1, [
        _createElementVNode("div", {
          class: "focus-main",
          onClick: $setup.toggle
        }, [
          _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, [
              _createElementVNode(
                "span",
                {
                  class: _normalizeClass(["focus-dot", $setup.stateClass])
                },
                null,
                2
                /* CLASS */
              ),
              _createTextVNode(
                " " + _toDisplayString($setup.modeLabel),
                1
                /* TEXT */
              )
            ]),
            $setup.snapshot.taskTitle ? (_openBlock(), _createElementBlock(
              "div",
              _hoisted_4,
              _toDisplayString($setup.snapshot.taskTitle),
              1
              /* TEXT */
            )) : _createCommentVNode("v-if", true),
            _createElementVNode("div", _hoisted_5, [
              $setup.snapshot.projectName ? (_openBlock(), _createElementBlock(
                "span",
                _hoisted_6,
                _toDisplayString($setup.snapshot.projectName),
                1
                /* TEXT */
              )) : _createCommentVNode("v-if", true),
              _createElementVNode(
                "span",
                null,
                "今日 " + _toDisplayString($setup.snapshot.todayCompleted ?? 0) + " 🍅",
                1
                /* TEXT */
              )
            ])
          ]),
          _createElementVNode(
            "div",
            {
              class: _normalizeClass(["focus-time", { running: $setup.snapshot.isRunning }])
            },
            _toDisplayString($setup.timeText),
            3
            /* TEXT, CLASS */
          )
        ]),
        _createElementVNode("div", _hoisted_7, [
          _createElementVNode(
            "div",
            {
              class: _normalizeClass(["focus-bar-inner", $setup.snapshot.currentMode === "work" ? "work" : "break"]),
              style: _normalizeStyle({ width: $setup.progressPercent + "%" })
            },
            null,
            6
            /* CLASS, STYLE */
          )
        ])
      ])
    ]),
    _: 1
    /* STABLE */
  }, 8, ["hints"]);
}
import "/src/launcher/pages/FocusPage.vue?vue&type=style&index=0&scoped=b1f9f446&lang.css";
_sfc_main.__hmrId = "b1f9f446";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-b1f9f446"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/FocusPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QVc7QUFBQTtBQUFBO0FBQUE7Y0FDekQ7QUFBQSxnQkFBcUQ7QUFBQTtBQUFBLGdCQUEvQyxRQUFHLGlCQUFHLGdCQUFTLGtCQUFjLEtBQVE7QUFBQSxnQkFBRztBQUFBO0FBQUE7QUFBQTs7VUFHbEQ7QUFBQSxZQUFxRjtBQUFBO0FBQUEsY0FBaEYsT0FBSyxpQkFBQyxjQUFZLFdBQW9CLGdCQUFTLFVBQVM7QUFBQTs2QkFBTyxlQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUE7UUFFOUUsb0JBTU0sT0FOTixZQU1NO0FBQUEsVUFMSjtBQUFBLFlBSUU7QUFBQTtBQUFBLGNBSEEsT0FBSyxpQkFBQyxtQkFDRSxnQkFBUyxnQkFBVztBQUFBLGNBQzNCLE9BQUsseUJBQVcseUJBQWU7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRm9jdXNQYWdlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxDYXBzdWxlUGFnZSA6aGludHM9XCJoaW50c1wiPlxuICAgIDxkaXYgY2xhc3M9XCJmb2N1cy1wYWdlXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZm9jdXMtbWFpblwiIEBjbGljaz1cInRvZ2dsZVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZm9jdXMtbGVmdFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmb2N1cy1tb2RlXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cImZvY3VzLWRvdFwiIDpjbGFzcz1cInN0YXRlQ2xhc3NcIiAvPlxuICAgICAgICAgICAge3sgbW9kZUxhYmVsIH19XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiB2LWlmPVwic25hcHNob3QudGFza1RpdGxlXCIgY2xhc3M9XCJmb2N1cy10YXNrXCI+e3sgc25hcHNob3QudGFza1RpdGxlIH19PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZvY3VzLW1ldGFcIj5cbiAgICAgICAgICAgIDxzcGFuIHYtaWY9XCJzbmFwc2hvdC5wcm9qZWN0TmFtZVwiPnt7IHNuYXBzaG90LnByb2plY3ROYW1lIH19PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4+5LuK5pelIHt7IHNuYXBzaG90LnRvZGF5Q29tcGxldGVkID8/IDAgfX0g8J+NhTwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmb2N1cy10aW1lXCIgOmNsYXNzPVwieyBydW5uaW5nOiBzbmFwc2hvdC5pc1J1bm5pbmcgfVwiPnt7IHRpbWVUZXh0IH19PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmb2N1cy1iYXJcIj5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzPVwiZm9jdXMtYmFyLWlubmVyXCJcbiAgICAgICAgICA6Y2xhc3M9XCJzbmFwc2hvdC5jdXJyZW50TW9kZSA9PT0gJ3dvcmsnID8gJ3dvcmsnIDogJ2JyZWFrJ1wiXG4gICAgICAgICAgOnN0eWxlPVwieyB3aWR0aDogcHJvZ3Jlc3NQZXJjZW50ICsgJyUnIH1cIlxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvQ2Fwc3VsZVBhZ2U+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIG9uQmVmb3JlVW5tb3VudCwgb25Nb3VudGVkLCByZWYgfSBmcm9tICd2dWUnXG5pbXBvcnQgQ2Fwc3VsZVBhZ2UgZnJvbSAnLi9DYXBzdWxlUGFnZS52dWUnXG5cbi8qKiB0cmF5IOW/q+eFp++8iOS4juaJmOebmCAvIOi/t+S9oOeql+WFseeUqOmAmumBk++8jOS4u+eql+WPo+eVquiMhOmSn+ahpeaOqOmAge+8iSAqL1xuaW50ZXJmYWNlIFNuYXAge1xuICBpc1J1bm5pbmc/OiBib29sZWFuXG4gIGN1cnJlbnRNb2RlPzogJ3dvcmsnIHwgJ3Nob3J0QnJlYWsnIHwgJ2xvbmdCcmVhaydcbiAgdGFza1RpdGxlPzogc3RyaW5nXG4gIHByb2plY3ROYW1lPzogc3RyaW5nXG4gIHRpbWVMZWZ0U2Vjb25kcz86IG51bWJlclxuICB0b3RhbFNlY29uZHM/OiBudW1iZXJcbiAgdG9kYXlDb21wbGV0ZWQ/OiBudW1iZXJcbn1cblxuY29uc3Qgc25hcHNob3QgPSByZWY8U25hcD4oe30pXG5jb25zdCBkaXNwbGF5TGVmdCA9IHJlZigwKVxubGV0IHRpY2tIYW5kbGU6IFJldHVyblR5cGU8dHlwZW9mIHNldEludGVydmFsPiB8IG51bGwgPSBudWxsXG5cbmNvbnN0IHRpbWVUZXh0ID0gY29tcHV0ZWQoKCkgPT4ge1xuICBjb25zdCBzID0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcihkaXNwbGF5TGVmdC52YWx1ZSkpXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MClcbiAgcmV0dXJuIGAke20udG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpfTokeyhzICUgNjApLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKX1gXG59KVxuXG5jb25zdCBtb2RlTGFiZWwgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGlmICghc25hcHNob3QudmFsdWUuaXNSdW5uaW5nICYmIGRpc3BsYXlMZWZ0LnZhbHVlIDw9IDApIHJldHVybiAn56m66ZeyJ1xuICBpZiAoc25hcHNob3QudmFsdWUuY3VycmVudE1vZGUgPT09ICd3b3JrJykgcmV0dXJuIHNuYXBzaG90LnZhbHVlLmlzUnVubmluZyA/ICfkuJPms6jkuK0nIDogJ+W3suaaguWBnCdcbiAgcmV0dXJuIHNuYXBzaG90LnZhbHVlLmN1cnJlbnRNb2RlID09PSAnc2hvcnRCcmVhaycgPyAn55+t5LyR5oGvJyA6ICfplb/kvJHmga8nXG59KVxuXG5jb25zdCBzdGF0ZUNsYXNzID0gY29tcHV0ZWQoKCkgPT5cbiAgc25hcHNob3QudmFsdWUuaXNSdW5uaW5nID8gKHNuYXBzaG90LnZhbHVlLmN1cnJlbnRNb2RlID09PSAnd29yaycgPyAnd29yaycgOiAnYnJlYWsnKSA6ICdpZGxlJ1xuKVxuXG5jb25zdCBwcm9ncmVzc1BlcmNlbnQgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGNvbnN0IHRvdGFsID0gTWF0aC5tYXgoMSwgc25hcHNob3QudmFsdWUudG90YWxTZWNvbmRzID8/IDApXG4gIHJldHVybiBNYXRoLm1pbigxMDAsIE1hdGgubWF4KDAsICgxIC0gZGlzcGxheUxlZnQudmFsdWUgLyB0b3RhbCkgKiAxMDApKVxufSlcblxuY29uc3QgaGludHMgPSBjb21wdXRlZCgoKSA9PiBbXG4gIHsga2V5czogJ+KGtScsIGxhYmVsOiBzbmFwc2hvdC52YWx1ZS5pc1J1bm5pbmcgPyAn5pqC5YGcJyA6ICflvIDlp4snIH0sXG4gIHsga2V5czogJ+KMmOKGtScsIGxhYmVsOiAn6Lez6L+HJyB9LFxuICB7IGtleXM6ICfijJhSJywgbGFiZWw6ICfph43nva4nIH0sXG4gIHsga2V5czogJ0VTQycsIGxhYmVsOiAn6L+U5ZueJyB9XG5dKVxuXG5mdW5jdGlvbiBhcHBseVNuYXBzaG90KHNuYXA6IFNuYXApOiB2b2lkIHtcbiAgc25hcHNob3QudmFsdWUgPSB7IC4uLnNuYXBzaG90LnZhbHVlLCAuLi5zbmFwIH1cbiAgZGlzcGxheUxlZnQudmFsdWUgPSBzbmFwLnRpbWVMZWZ0U2Vjb25kcyA/PyAwXG4gIC8vIOi/kOihjOS4reacrOWcsOavj+enkuaPkuWAvO+8iOaOqOmAgeiKgua1geS4uiA1cyDkuIDmrKHvvIlcbiAgaWYgKHRpY2tIYW5kbGUpIHtcbiAgICBjbGVhckludGVydmFsKHRpY2tIYW5kbGUpXG4gICAgdGlja0hhbmRsZSA9IG51bGxcbiAgfVxuICBpZiAoc25hcHNob3QudmFsdWUuaXNSdW5uaW5nKSB7XG4gICAgdGlja0hhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmIChkaXNwbGF5TGVmdC52YWx1ZSA+IDApIGRpc3BsYXlMZWZ0LnZhbHVlIC09IDFcbiAgICB9LCAxMDAwKVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5kaXNwYXRjaFNob3J0Y3V0KCd0b2dnbGUnKVxufVxuYXN5bmMgZnVuY3Rpb24gc2tpcCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgd2luZG93LmFwaS5wb21vZG9yby5kaXNwYXRjaFNob3J0Y3V0KCdza2lwJylcbn1cbmFzeW5jIGZ1bmN0aW9uIHJlc2V0KCk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmRpc3BhdGNoU2hvcnRjdXQoJ3Jlc2V0Jylcbn1cblxuLyoqIOmUruebmOWIhuWPke+8iExhdW5jaGVyQXBwIOmbhuS4rei9rOWPke+8ie+8m+i/lOWbniB0cnVlIOihqOekuuW3sua2iOi0uSAqL1xuZnVuY3Rpb24gaGFuZGxlS2V5KGU6IEtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcbiAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgaWYgKGUubWV0YUtleSB8fCBlLmN0cmxLZXkpIHtcbiAgICAgIHZvaWQgc2tpcCgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZvaWQgdG9nZ2xlKClcbiAgICB9XG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBpZiAoKGUubWV0YUtleSB8fCBlLmN0cmxLZXkpICYmIChlLmtleSA9PT0gJ3InIHx8IGUua2V5ID09PSAnUicpKSB7XG4gICAgdm9pZCByZXNldCgpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICByZXR1cm4gZmFsc2Vcbn1cblxuZGVmaW5lRXhwb3NlKHsgaGFuZGxlS2V5IH0pXG5cbmxldCB1bnN1YlRyYXlTbmFwc2hvdDogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGxcblxub25Nb3VudGVkKGFzeW5jICgpID0+IHtcbiAgLy8g5Yid5aeL54q25oCBICsg6K6i6ZiF5aKe6YeP5o6o6YCB77yIc3Vic2NyaWJlU25hcHNob3Qg6Kem5Y+R5Li76L+b56iL5oyJIHNlbmRlciDlm57mjqjvvIlcbiAgdHJ5IHtcbiAgICBhcHBseVNuYXBzaG90KChhd2FpdCB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLmdldFRyYXlTbmFwc2hvdCgpKSBhcyBTbmFwKVxuICB9IGNhdGNoIHtcbiAgICAvKiDliJ3lp4vlv6vnhaflpLHotKXkuI3pmLvloZ7orqLpmIUgKi9cbiAgfVxuICB3aW5kb3cuYXBpLnBvbW9kb3JvLmludGVncmF0aW9uLnN1YnNjcmliZVNuYXBzaG90KClcbiAgLy8g5YaF6IGU6aG16ZqP6IO25ZuK5a+86Iiq5Y+N5aSNIHB1c2gvcG9w77ya5LiN6YCA6K6i5Lya5Y+g5Yqg55uR5ZCs77yM5q+P5p2h5o6o6YCB6Kem5Y+RIE4g5qyhXG4gIHVuc3ViVHJheVNuYXBzaG90ID0gd2luZG93LmFwaS5wb21vZG9yby5pbnRlZ3JhdGlvbi5vblRyYXlTbmFwc2hvdCgoc25hcCkgPT5cbiAgICBhcHBseVNuYXBzaG90KHNuYXAgYXMgU25hcClcbiAgKVxufSlcblxub25CZWZvcmVVbm1vdW50KCgpID0+IHtcbiAgaWYgKHRpY2tIYW5kbGUpIGNsZWFySW50ZXJ2YWwodGlja0hhbmRsZSlcbiAgdW5zdWJUcmF5U25hcHNob3Q/LigpXG4gIHVuc3ViVHJheVNuYXBzaG90ID0gbnVsbFxufSlcbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLmZvY3VzLXBhZ2Uge1xuICBwYWRkaW5nOiAxMHB4IDEycHggMTJweDtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiAxMHB4O1xufVxuXG4uZm9jdXMtbWFpbiB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgZ2FwOiAxNnB4O1xuICBwYWRkaW5nOiAxMHB4IDEycHg7XG4gIGJvcmRlci1yYWRpdXM6IDEwcHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgY3Vyc29yOiBwb2ludGVyO1xufVxuXG4uZm9jdXMtbGVmdCB7XG4gIG1pbi13aWR0aDogMDtcbiAgZGlzcGxheTogZmxleDtcbiAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgZ2FwOiA0cHg7XG59XG5cbi5mb2N1cy1tb2RlIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgZ2FwOiA2cHg7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQtZGltKTtcbn1cblxuLmZvY3VzLWRvdCB7XG4gIHdpZHRoOiA4cHg7XG4gIGhlaWdodDogOHB4O1xuICBib3JkZXItcmFkaXVzOiA1MCU7XG4gIGJhY2tncm91bmQ6IHJnYmEoMCwgMCwgMCwgMC40KTtcbn1cblxuLmZvY3VzLWRvdC53b3JrIHtcbiAgYmFja2dyb3VuZDogI2VmNDQ0NDtcbn1cblxuLmZvY3VzLWRvdC5icmVhayB7XG4gIGJhY2tncm91bmQ6ICMyMmM1NWU7XG59XG5cbi5mb2N1cy10YXNrIHtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBmb250LXdlaWdodDogNTAwO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xufVxuXG4uZm9jdXMtbWV0YSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGdhcDogMTBweDtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG59XG5cbi5mb2N1cy10aW1lIHtcbiAgZm9udC1zaXplOiAzNHB4O1xuICBmb250LXdlaWdodDogNjAwO1xuICBmb250LXZhcmlhbnQtbnVtZXJpYzogdGFidWxhci1udW1zO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIGxldHRlci1zcGFjaW5nOiAwLjAyZW07XG4gIGZsZXgtc2hyaW5rOiAwO1xufVxuXG4uZm9jdXMtdGltZS5ydW5uaW5nIHtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG59XG5cbi5mb2N1cy1iYXIge1xuICBoZWlnaHQ6IDRweDtcbiAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbn1cblxuLmZvY3VzLWJhci1pbm5lciB7XG4gIGhlaWdodDogMTAwJTtcbiAgYm9yZGVyLXJhZGl1czogOTk5cHg7XG4gIHRyYW5zaXRpb246IHdpZHRoIDAuNHMgZWFzZTtcbn1cblxuLmZvY3VzLWJhci1pbm5lci53b3JrIHtcbiAgYmFja2dyb3VuZDogI2VmNDQ0NDtcbn1cblxuLmZvY3VzLWJhci1pbm5lci5icmVhayB7XG4gIGJhY2tncm91bmQ6ICMyMmM1NWU7XG59XG48L3N0eWxlPlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy9sYXVuY2hlci9wYWdlcy9Gb2N1c1BhZ2UudnVlIn0=