import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/ui/UBadge.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "UBadge",
  props: {
    variant: { type: String, required: false, default: "neutral" },
    dot: { type: Boolean, required: false, default: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const cls = computed(() => {
      switch (props.variant) {
        case "brand":
          return "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20";
        case "success":
          return "bg-success/10 text-success border-success/20";
        case "warning":
          return "bg-warning/10 text-warning border-warning/25";
        case "danger":
          return "bg-danger/10 text-danger border-danger/20";
        default:
          return "bg-surface-hover text-fg-secondary border-line-default";
      }
    });
    const dotCls = computed(() => {
      switch (props.variant) {
        case "brand":
          return "bg-brand-500";
        case "success":
          return "bg-success";
        case "warning":
          return "bg-warning";
        case "danger":
          return "bg-danger";
        default:
          return "bg-gray-400";
      }
    });
    const __returned__ = { props, cls, dotCls };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { normalizeClass as _normalizeClass, openBlock as _openBlock, createElementBlock as _createElementBlock, renderSlot as _renderSlot } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return $props.dot ? (_openBlock(), _createElementBlock(
    "span",
    {
      key: 0,
      class: _normalizeClass(["inline-block size-2 shrink-0 rounded-full", $setup.dotCls]),
      "aria-hidden": "true"
    },
    null,
    2
    /* CLASS */
  )) : (_openBlock(), _createElementBlock(
    "span",
    {
      key: 1,
      class: _normalizeClass(["inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none", $setup.cls])
    },
    [
      _renderSlot(_ctx.$slots, "default")
    ],
    2
    /* CLASS */
  ));
}
_sfc_main.__hmrId = "330a6b54";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/ui/UBadge.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUNBLFNBQVMsZ0JBQWdCOzs7Ozs7Ozs7QUFZekIsVUFBTSxRQUFRO0FBS2QsVUFBTSxNQUFNLFNBQVMsTUFBTTtBQUN6QixjQUFRLE1BQU0sU0FBUztBQUFBLFFBQ3JCLEtBQUs7QUFDSCxpQkFBTztBQUFBLFFBQ1QsS0FBSztBQUNILGlCQUFPO0FBQUEsUUFDVCxLQUFLO0FBQ0gsaUJBQU87QUFBQSxRQUNULEtBQUs7QUFDSCxpQkFBTztBQUFBLFFBQ1Q7QUFDRSxpQkFBTztBQUFBLE1BQ1g7QUFBQSxJQUNGLENBQUM7QUFFRCxVQUFNLFNBQVMsU0FBUyxNQUFNO0FBQzVCLGNBQVEsTUFBTSxTQUFTO0FBQUEsUUFDckIsS0FBSztBQUNILGlCQUFPO0FBQUEsUUFDVCxLQUFLO0FBQ0gsaUJBQU87QUFBQSxRQUNULEtBQUs7QUFDSCxpQkFBTztBQUFBLFFBQ1QsS0FBSztBQUNILGlCQUFPO0FBQUEsUUFDVDtBQUNFLGlCQUFPO0FBQUEsTUFDWDtBQUFBLElBQ0YsQ0FBQzs7Ozs7Ozs7U0FLUyw0QkFEUjtBQUFBLElBS0U7QUFBQTtBQUFBO01BSEEsT0FBSyxpQkFBQyw2Q0FDRSxhQUFNO0FBQUEsTUFDZCxlQUFZO0FBQUE7Ozs7c0JBRWQ7QUFBQSxJQU1PO0FBQUE7QUFBQTtNQUpMLE9BQUssaUJBQUMsdUdBQ0UsVUFBRztBQUFBOztNQUVYLFlBQVE7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiVUJhZGdlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5cbi8qKlxuICogVUJhZGdlIMK3IOW+veaghyAvIOeKtuaAgeeCuVxuICogLSB2YXJpYW50OiBicmFuZCAvIHN1Y2Nlc3MgLyB3YXJuaW5nIC8gZGFuZ2VyIC8gbmV1dHJhbFxuICogLSBkb3Q6IOWPqua4suafk+eKtuaAgeeCueS4jeW4puaWh+Wtl1xuICovXG5pbnRlcmZhY2UgUHJvcHMge1xuICB2YXJpYW50PzogJ2JyYW5kJyB8ICdzdWNjZXNzJyB8ICd3YXJuaW5nJyB8ICdkYW5nZXInIHwgJ25ldXRyYWwnXG4gIGRvdD86IGJvb2xlYW5cbn1cblxuY29uc3QgcHJvcHMgPSB3aXRoRGVmYXVsdHMoZGVmaW5lUHJvcHM8UHJvcHM+KCksIHtcbiAgdmFyaWFudDogJ25ldXRyYWwnLFxuICBkb3Q6IGZhbHNlXG59KVxuXG5jb25zdCBjbHMgPSBjb21wdXRlZCgoKSA9PiB7XG4gIHN3aXRjaCAocHJvcHMudmFyaWFudCkge1xuICAgIGNhc2UgJ2JyYW5kJzpcbiAgICAgIHJldHVybiAnYmctYnJhbmQtNTAwLzEwIHRleHQtYnJhbmQtNjAwIGRhcms6dGV4dC1icmFuZC00MDAgYm9yZGVyLWJyYW5kLTUwMC8yMCdcbiAgICBjYXNlICdzdWNjZXNzJzpcbiAgICAgIHJldHVybiAnYmctc3VjY2Vzcy8xMCB0ZXh0LXN1Y2Nlc3MgYm9yZGVyLXN1Y2Nlc3MvMjAnXG4gICAgY2FzZSAnd2FybmluZyc6XG4gICAgICByZXR1cm4gJ2JnLXdhcm5pbmcvMTAgdGV4dC13YXJuaW5nIGJvcmRlci13YXJuaW5nLzI1J1xuICAgIGNhc2UgJ2Rhbmdlcic6XG4gICAgICByZXR1cm4gJ2JnLWRhbmdlci8xMCB0ZXh0LWRhbmdlciBib3JkZXItZGFuZ2VyLzIwJ1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ2JnLXN1cmZhY2UtaG92ZXIgdGV4dC1mZy1zZWNvbmRhcnkgYm9yZGVyLWxpbmUtZGVmYXVsdCdcbiAgfVxufSlcblxuY29uc3QgZG90Q2xzID0gY29tcHV0ZWQoKCkgPT4ge1xuICBzd2l0Y2ggKHByb3BzLnZhcmlhbnQpIHtcbiAgICBjYXNlICdicmFuZCc6XG4gICAgICByZXR1cm4gJ2JnLWJyYW5kLTUwMCdcbiAgICBjYXNlICdzdWNjZXNzJzpcbiAgICAgIHJldHVybiAnYmctc3VjY2VzcydcbiAgICBjYXNlICd3YXJuaW5nJzpcbiAgICAgIHJldHVybiAnYmctd2FybmluZydcbiAgICBjYXNlICdkYW5nZXInOlxuICAgICAgcmV0dXJuICdiZy1kYW5nZXInXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiAnYmctZ3JheS00MDAnXG4gIH1cbn0pXG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICA8c3BhblxuICAgIHYtaWY9XCJkb3RcIlxuICAgIGNsYXNzPVwiaW5saW5lLWJsb2NrIHNpemUtMiBzaHJpbmstMCByb3VuZGVkLWZ1bGxcIlxuICAgIDpjbGFzcz1cImRvdENsc1wiXG4gICAgYXJpYS1oaWRkZW49XCJ0cnVlXCJcbiAgLz5cbiAgPHNwYW5cbiAgICB2LWVsc2VcbiAgICBjbGFzcz1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSByb3VuZGVkLWZ1bGwgYm9yZGVyIHB4LTIgcHktMC41IHRleHQtWzExcHhdIGZvbnQtbWVkaXVtIGxlYWRpbmctbm9uZVwiXG4gICAgOmNsYXNzPVwiY2xzXCJcbiAgPlxuICAgIDxzbG90IC8+XG4gIDwvc3Bhbj5cbjwvdGVtcGxhdGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2NvbXBvbmVudHMvdWkvVUJhZGdlLnZ1ZSJ9