import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/ScreenshotsColor.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ScreenshotsColor",
  props: {
    value: { type: String, required: true }
  },
  emits: ["change"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const emit = __emit;
    const colors = ["#ee5126", "#fceb4d", "#90e746", "#51c0fa", "#7a7a7a", "#ffffff"];
    const handleChange = (color) => {
      emit("change", color);
    };
    const __returned__ = { emit, colors, handleChange };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, normalizeClass as _normalizeClass, normalizeStyle as _normalizeStyle, createElementVNode as _createElementVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "screenshots-color" };
const _hoisted_2 = ["onClick"];
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    (_openBlock(), _createElementBlock(
      _Fragment,
      null,
      _renderList($setup.colors, (color) => {
        return _createElementVNode("div", {
          key: color,
          class: _normalizeClass(["screenshots-color-item", { "screenshots-color-active": color === $props.value }]),
          style: _normalizeStyle({ backgroundColor: color }),
          onClick: ($event) => $setup.handleChange(color)
        }, null, 14, _hoisted_2);
      }),
      64
      /* STABLE_FRAGMENT */
    ))
  ]);
}
import "/src/views/screenshot/components/ScreenshotsColor.vue?vue&type=style&index=0&scoped=5eaeb3d0&lang.css";
_sfc_main.__hmrId = "5eaeb3d0";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-5eaeb3d0"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/ScreenshotsColor.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBaUJBLFVBQU0sT0FBTztBQUliLFVBQU0sU0FBUyxDQUFDLFdBQVcsV0FBVyxXQUFXLFdBQVcsV0FBVyxTQUFTO0FBRWhGLFVBQU0sZUFBZSxDQUFDLFVBQWtCO0FBQ3RDLFdBQUssVUFBVSxLQUFLO0FBQUEsSUFDdEI7Ozs7Ozs7cUJBeEJPLE9BQU0sb0JBQW1COzs7dUJBQTlCLG9CQVFNLE9BUk4sWUFRTTtBQUFBLG1CQVBKO0FBQUEsTUFNRTtBQUFBO0FBQUEsa0JBTGdCLGVBQU0sQ0FBZixVQUFLO2VBRGQsb0JBTUU7QUFBQSxVQUpDLEtBQUs7QUFBQSxVQUNMLE9BQUsseUVBQTJELFVBQVUsYUFBSztBQUFBLFVBQy9FLE9BQUssbUNBQXFCLE1BQUs7QUFBQSxVQUMvQixTQUFLLFlBQUUsb0JBQWEsS0FBSztBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTY3JlZW5zaG90c0NvbG9yLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJzY3JlZW5zaG90cy1jb2xvclwiPlxuICAgIDxkaXZcbiAgICAgIHYtZm9yPVwiY29sb3IgaW4gY29sb3JzXCJcbiAgICAgIDprZXk9XCJjb2xvclwiXG4gICAgICA6Y2xhc3M9XCJbJ3NjcmVlbnNob3RzLWNvbG9yLWl0ZW0nLCB7ICdzY3JlZW5zaG90cy1jb2xvci1hY3RpdmUnOiBjb2xvciA9PT0gdmFsdWUgfV1cIlxuICAgICAgOnN0eWxlPVwieyBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yIH1cIlxuICAgICAgQGNsaWNrPVwiaGFuZGxlQ2hhbmdlKGNvbG9yKVwiXG4gICAgLz5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuZGVmaW5lUHJvcHM8e1xuICB2YWx1ZTogc3RyaW5nXG59PigpXG5cbmNvbnN0IGVtaXQgPSBkZWZpbmVFbWl0czx7XG4gIGNoYW5nZTogW3ZhbHVlOiBzdHJpbmddXG59PigpXG5cbmNvbnN0IGNvbG9ycyA9IFsnI2VlNTEyNicsICcjZmNlYjRkJywgJyM5MGU3NDYnLCAnIzUxYzBmYScsICcjN2E3YTdhJywgJyNmZmZmZmYnXVxuXG5jb25zdCBoYW5kbGVDaGFuZ2UgPSAoY29sb3I6IHN0cmluZykgPT4ge1xuICBlbWl0KCdjaGFuZ2UnLCBjb2xvcilcbn1cbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLnNjcmVlbnNob3RzLWNvbG9yIHtcbiAgaGVpZ2h0OiAyOHB4O1xuICBwYWRkaW5nOiAwIDJweDtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbn1cblxuLnNjcmVlbnNob3RzLWNvbG9yLWl0ZW0ge1xuICB3aWR0aDogMTZweDtcbiAgaGVpZ2h0OiAxNnB4O1xuICBib3JkZXItcmFkaXVzOiA1MCU7XG4gIGN1cnNvcjogcG9pbnRlcjtcbiAgbWFyZ2luOiAwIDRweDtcbiAgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMXB4IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yOCk7XG4gIHRyYW5zaXRpb246XG4gICAgdHJhbnNmb3JtIDAuMTJzLFxuICAgIGJveC1zaGFkb3cgMC4xNXM7XG59XG5cbi5zY3JlZW5zaG90cy1jb2xvci1pdGVtOmhvdmVyIHtcbiAgdHJhbnNmb3JtOiBzY2FsZSgxLjE1KTtcbn1cblxuLnNjcmVlbnNob3RzLWNvbG9yLWl0ZW06YWN0aXZlIHtcbiAgdHJhbnNmb3JtOiBzY2FsZSgwLjk1KTtcbn1cblxuLnNjcmVlbnNob3RzLWNvbG9yLWFjdGl2ZSB7XG4gIGJveC1zaGFkb3c6XG4gICAgMCAwIDAgMnB4IHZhcigtLXNob3QtZ2xhc3Mtc3Ryb25nKSxcbiAgICAwIDAgMCA0cHggdmFyKC0tc2hvdC1hY2NlbnQpO1xufVxuXG4uc2NyZWVuc2hvdHMtY29sb3ItYWN0aXZlOmhvdmVyIHtcbiAgdHJhbnNmb3JtOiBzY2FsZSgxLjE1KTtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9TY3JlZW5zaG90c0NvbG9yLnZ1ZSJ9