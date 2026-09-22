import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/ui/UButton.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "UButton",
  props: {
    variant: { type: String, required: false, default: "secondary" },
    size: { type: String, required: false, default: "md" },
    type: { type: String, required: false, default: "button" },
    disabled: { type: Boolean, required: false, default: false },
    loading: { type: Boolean, required: false, default: false },
    block: { type: Boolean, required: false, default: false }
  },
  emits: ["click"],
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const sizeCls = computed(() => {
      if (props.size === "sm") return "h-7 px-2.5 text-xs gap-1.5 rounded-sm";
      if (props.size === "lg") return "h-11 px-5 text-sm gap-2 rounded-md";
      return "h-9 px-4 text-sm gap-2 rounded-md";
    });
    const variantCls = computed(() => {
      if (props.disabled || props.loading) {
        return "opacity-50 cursor-not-allowed";
      }
      switch (props.variant) {
        case "primary":
          return "bg-brand-500 text-white shadow-xs hover:bg-brand-400 active:bg-brand-600 focus-visible:shadow-ring-focus";
        case "ghost":
          return "text-fg-secondary hover:bg-surface-hover hover:text-fg-primary active:bg-surface-active focus-visible:shadow-ring-focus";
        case "danger":
          return "bg-transparent text-danger border border-line-default hover:border-danger/40 hover:bg-danger/5 focus-visible:shadow-ring-danger";
        default:
          return "bg-surface-1 text-fg-primary border border-line-default hover:border-line-strong hover:bg-surface-2 active:bg-surface-hover focus-visible:shadow-ring-focus";
      }
    });
    const __returned__ = { props, sizeCls, variantCls };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, renderSlot as _renderSlot, normalizeClass as _normalizeClass } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = ["type", "disabled"];
const _hoisted_2 = {
  key: 0,
  class: "size-3.5 animate-spin",
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": "true"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("button", {
    type: $props.type,
    disabled: $props.disabled || $props.loading,
    class: _normalizeClass(["inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-fast ease-out focus-visible:outline-none", [$setup.sizeCls, $setup.variantCls, $props.block ? "w-full" : ""]]),
    onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("click", $event))
  }, [
    $props.loading ? (_openBlock(), _createElementBlock("svg", _hoisted_2, [..._cache[1] || (_cache[1] = [
      _createElementVNode(
        "circle",
        {
          cx: "12",
          cy: "12",
          r: "9",
          stroke: "currentColor",
          "stroke-width": "3",
          opacity: "0.25"
        },
        null,
        -1
        /* CACHED */
      ),
      _createElementVNode(
        "path",
        {
          d: "M21 12a9 9 0 0 0-9-9",
          stroke: "currentColor",
          "stroke-width": "3",
          "stroke-linecap": "round"
        },
        null,
        -1
        /* CACHED */
      )
    ])])) : _createCommentVNode("v-if", true),
    _renderSlot(_ctx.$slots, "default")
  ], 10, _hoisted_1);
}
_sfc_main.__hmrId = "7a71ed8d";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
export const _rerender_only = __VUE_HMR_RUNTIME__.CHANGED_FILE === "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/ui/UButton.vue";
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only: _rerender_only2 } = mod;
  if (_rerender_only2) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/ui/UButton.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUNBLFNBQVMsZ0JBQWdCOzs7Ozs7Ozs7Ozs7OztBQWlCekIsVUFBTSxRQUFRO0FBV2QsVUFBTSxVQUFVLFNBQVMsTUFBTTtBQUM3QixVQUFJLE1BQU0sU0FBUyxLQUFNLFFBQU87QUFDaEMsVUFBSSxNQUFNLFNBQVMsS0FBTSxRQUFPO0FBQ2hDLGFBQU87QUFBQSxJQUNULENBQUM7QUFFRCxVQUFNLGFBQWEsU0FBUyxNQUFNO0FBQ2hDLFVBQUksTUFBTSxZQUFZLE1BQU0sU0FBUztBQUNuQyxlQUFPO0FBQUEsTUFDVDtBQUNBLGNBQVEsTUFBTSxTQUFTO0FBQUEsUUFDckIsS0FBSztBQUNILGlCQUFPO0FBQUEsUUFDVCxLQUFLO0FBQ0gsaUJBQU87QUFBQSxRQUNULEtBQUs7QUFDSCxpQkFBTztBQUFBLFFBQ1Q7QUFDRSxpQkFBTztBQUFBLE1BQ1g7QUFBQSxJQUNGLENBQUM7Ozs7Ozs7Ozs7RUFhSyxPQUFNO0FBQUEsRUFDTixTQUFRO0FBQUEsRUFDUixNQUFLO0FBQUEsRUFDTCxlQUFZOzs7dUJBWmhCLG9CQXVCUztBQUFBLElBdEJOLE1BQU07QUFBQSxJQUNOLFVBQVUsbUJBQVk7QUFBQSxJQUN2QixPQUFLLGlCQUFDLHNKQUFvSixDQUNqSixnQkFBUyxtQkFBWSxlQUFLO0FBQUEsSUFDbEMsU0FBSyxzQ0FBRSxXQUFLLFNBQVUsTUFBTTtBQUFBO0lBR3JCLGdDQURSLG9CQWNNLE9BZE4sWUFjTTtBQUFBLE1BUEo7QUFBQSxRQUFzRjtBQUFBO0FBQUEsVUFBOUUsSUFBRztBQUFBLFVBQUssSUFBRztBQUFBLFVBQUssR0FBRTtBQUFBLFVBQUksUUFBTztBQUFBLFVBQWUsZ0JBQWE7QUFBQSxVQUFJLFNBQVE7QUFBQTs7Ozs7TUFDN0U7QUFBQSxRQUtFO0FBQUE7QUFBQSxVQUpBLEdBQUU7QUFBQSxVQUNGLFFBQU87QUFBQSxVQUNQLGdCQUFhO0FBQUEsVUFDYixrQkFBZTtBQUFBOzs7Ozs7SUFHbkIsWUFBUTtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJVQnV0dG9uLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5cbi8qKlxuICogVUJ1dHRvbiDCtyDnu5/kuIDmjInpkq5cbiAqIC0gdmFyaWFudDogcHJpbWFyee+8iOWTgeeJjOWunuW/g++8iS8gc2Vjb25kYXJ577yI6Z2i5p2/K+aPj+i+ue+8iS8gZ2hvc3TvvIjml6DlupXvvIkvIGRhbmdlcu+8iOWNsemZqe+8iVxuICogLSBzaXplOiBzbSAvIG1kIC8gbGdcbiAqIC0gbG9hZGluZzog5YaF6IGUIHNwaW5uZXIg5bm256aB55So54K55Ye7XG4gKi9cbmludGVyZmFjZSBQcm9wcyB7XG4gIHZhcmlhbnQ/OiAncHJpbWFyeScgfCAnc2Vjb25kYXJ5JyB8ICdnaG9zdCcgfCAnZGFuZ2VyJ1xuICBzaXplPzogJ3NtJyB8ICdtZCcgfCAnbGcnXG4gIHR5cGU/OiAnYnV0dG9uJyB8ICdzdWJtaXQnIHwgJ3Jlc2V0J1xuICBkaXNhYmxlZD86IGJvb2xlYW5cbiAgbG9hZGluZz86IGJvb2xlYW5cbiAgYmxvY2s/OiBib29sZWFuXG59XG5cbmNvbnN0IHByb3BzID0gd2l0aERlZmF1bHRzKGRlZmluZVByb3BzPFByb3BzPigpLCB7XG4gIHZhcmlhbnQ6ICdzZWNvbmRhcnknLFxuICBzaXplOiAnbWQnLFxuICB0eXBlOiAnYnV0dG9uJyxcbiAgZGlzYWJsZWQ6IGZhbHNlLFxuICBsb2FkaW5nOiBmYWxzZSxcbiAgYmxvY2s6IGZhbHNlXG59KVxuXG5kZWZpbmVFbWl0czx7IGNsaWNrOiBbZTogTW91c2VFdmVudF0gfT4oKVxuXG5jb25zdCBzaXplQ2xzID0gY29tcHV0ZWQoKCkgPT4ge1xuICBpZiAocHJvcHMuc2l6ZSA9PT0gJ3NtJykgcmV0dXJuICdoLTcgcHgtMi41IHRleHQteHMgZ2FwLTEuNSByb3VuZGVkLXNtJ1xuICBpZiAocHJvcHMuc2l6ZSA9PT0gJ2xnJykgcmV0dXJuICdoLTExIHB4LTUgdGV4dC1zbSBnYXAtMiByb3VuZGVkLW1kJ1xuICByZXR1cm4gJ2gtOSBweC00IHRleHQtc20gZ2FwLTIgcm91bmRlZC1tZCdcbn0pXG5cbmNvbnN0IHZhcmlhbnRDbHMgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGlmIChwcm9wcy5kaXNhYmxlZCB8fCBwcm9wcy5sb2FkaW5nKSB7XG4gICAgcmV0dXJuICdvcGFjaXR5LTUwIGN1cnNvci1ub3QtYWxsb3dlZCdcbiAgfVxuICBzd2l0Y2ggKHByb3BzLnZhcmlhbnQpIHtcbiAgICBjYXNlICdwcmltYXJ5JzpcbiAgICAgIHJldHVybiAnYmctYnJhbmQtNTAwIHRleHQtd2hpdGUgc2hhZG93LXhzIGhvdmVyOmJnLWJyYW5kLTQwMCBhY3RpdmU6YmctYnJhbmQtNjAwIGZvY3VzLXZpc2libGU6c2hhZG93LXJpbmctZm9jdXMnXG4gICAgY2FzZSAnZ2hvc3QnOlxuICAgICAgcmV0dXJuICd0ZXh0LWZnLXNlY29uZGFyeSBob3ZlcjpiZy1zdXJmYWNlLWhvdmVyIGhvdmVyOnRleHQtZmctcHJpbWFyeSBhY3RpdmU6Ymctc3VyZmFjZS1hY3RpdmUgZm9jdXMtdmlzaWJsZTpzaGFkb3ctcmluZy1mb2N1cydcbiAgICBjYXNlICdkYW5nZXInOlxuICAgICAgcmV0dXJuICdiZy10cmFuc3BhcmVudCB0ZXh0LWRhbmdlciBib3JkZXIgYm9yZGVyLWxpbmUtZGVmYXVsdCBob3Zlcjpib3JkZXItZGFuZ2VyLzQwIGhvdmVyOmJnLWRhbmdlci81IGZvY3VzLXZpc2libGU6c2hhZG93LXJpbmctZGFuZ2VyJ1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ2JnLXN1cmZhY2UtMSB0ZXh0LWZnLXByaW1hcnkgYm9yZGVyIGJvcmRlci1saW5lLWRlZmF1bHQgaG92ZXI6Ym9yZGVyLWxpbmUtc3Ryb25nIGhvdmVyOmJnLXN1cmZhY2UtMiBhY3RpdmU6Ymctc3VyZmFjZS1ob3ZlciBmb2N1cy12aXNpYmxlOnNoYWRvdy1yaW5nLWZvY3VzJ1xuICB9XG59KVxuPC9zY3JpcHQ+XG5cbjx0ZW1wbGF0ZT5cbiAgPGJ1dHRvblxuICAgIDp0eXBlPVwidHlwZVwiXG4gICAgOmRpc2FibGVkPVwiZGlzYWJsZWQgfHwgbG9hZGluZ1wiXG4gICAgY2xhc3M9XCJpbmxpbmUtZmxleCBzZWxlY3Qtbm9uZSBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgd2hpdGVzcGFjZS1ub3dyYXAgZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tZmFzdCBlYXNlLW91dCBmb2N1cy12aXNpYmxlOm91dGxpbmUtbm9uZVwiXG4gICAgOmNsYXNzPVwiW3NpemVDbHMsIHZhcmlhbnRDbHMsIGJsb2NrID8gJ3ctZnVsbCcgOiAnJ11cIlxuICAgIEBjbGljaz1cIiRlbWl0KCdjbGljaycsICRldmVudClcIlxuICA+XG4gICAgPHN2Z1xuICAgICAgdi1pZj1cImxvYWRpbmdcIlxuICAgICAgY2xhc3M9XCJzaXplLTMuNSBhbmltYXRlLXNwaW5cIlxuICAgICAgdmlld0JveD1cIjAgMCAyNCAyNFwiXG4gICAgICBmaWxsPVwibm9uZVwiXG4gICAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgID5cbiAgICAgIDxjaXJjbGUgY3g9XCIxMlwiIGN5PVwiMTJcIiByPVwiOVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjNcIiBvcGFjaXR5PVwiMC4yNVwiIC8+XG4gICAgICA8cGF0aFxuICAgICAgICBkPVwiTTIxIDEyYTkgOSAwIDAgMC05LTlcIlxuICAgICAgICBzdHJva2U9XCJjdXJyZW50Q29sb3JcIlxuICAgICAgICBzdHJva2Utd2lkdGg9XCIzXCJcbiAgICAgICAgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiXG4gICAgICAvPlxuICAgIDwvc3ZnPlxuICAgIDxzbG90IC8+XG4gIDwvYnV0dG9uPlxuPC90ZW1wbGF0ZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvY29tcG9uZW50cy91aS9VQnV0dG9uLnZ1ZSJ9