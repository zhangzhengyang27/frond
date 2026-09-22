import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/ScreenshotsSizeColor.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import ScreenshotsSize from "/src/views/screenshot/components/ScreenshotsSize.vue";
import ScreenshotsColor from "/src/views/screenshot/components/ScreenshotsColor.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ScreenshotsSizeColor",
  props: {
    size: { type: Number, required: true },
    color: { type: String, required: true }
  },
  emits: ["sizeChange", "colorChange"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const emit = __emit;
    const handleSizeChange = (value) => {
      emit("sizeChange", value);
    };
    const handleColorChange = (value) => {
      emit("colorChange", value);
    };
    const __returned__ = { emit, handleSizeChange, handleColorChange, ScreenshotsSize, ScreenshotsColor };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "screenshots-sizecolor" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode($setup["ScreenshotsSize"], {
      value: $props.size,
      onChange: $setup.handleSizeChange
    }, null, 8, ["value"]),
    _createVNode($setup["ScreenshotsColor"], {
      value: $props.color,
      onChange: $setup.handleColorChange
    }, null, 8, ["value"])
  ]);
}
import "/src/views/screenshot/components/ScreenshotsSizeColor.vue?vue&type=style&index=0&scoped=ac035c63&lang.css";
_sfc_main.__hmrId = "ac035c63";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ac035c63"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/ScreenshotsSizeColor.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQVFBLE9BQU8scUJBQXFCO0FBQzVCLE9BQU8sc0JBQXNCOzs7Ozs7Ozs7O0FBTzdCLFVBQU0sT0FBTztBQUtiLFVBQU0sbUJBQW1CLENBQUMsVUFBa0I7QUFDMUMsV0FBSyxjQUFjLEtBQUs7QUFBQSxJQUMxQjtBQUVBLFVBQU0sb0JBQW9CLENBQUMsVUFBa0I7QUFDM0MsV0FBSyxlQUFlLEtBQUs7QUFBQSxJQUMzQjs7Ozs7OztxQkExQk8sT0FBTSx3QkFBdUI7O3VCQUFsQyxvQkFHTSxPQUhOLFlBR007QUFBQSxJQUZKLGFBQTREO0FBQUEsTUFBMUMsT0FBTztBQUFBLE1BQU8sVUFBUTtBQUFBO0lBQ3hDLGFBQStEO0FBQUEsTUFBNUMsT0FBTztBQUFBLE1BQVEsVUFBUTtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTY3JlZW5zaG90c1NpemVDb2xvci52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8ZGl2IGNsYXNzPVwic2NyZWVuc2hvdHMtc2l6ZWNvbG9yXCI+XG4gICAgPFNjcmVlbnNob3RzU2l6ZSA6dmFsdWU9XCJzaXplXCIgQGNoYW5nZT1cImhhbmRsZVNpemVDaGFuZ2VcIiAvPlxuICAgIDxTY3JlZW5zaG90c0NvbG9yIDp2YWx1ZT1cImNvbG9yXCIgQGNoYW5nZT1cImhhbmRsZUNvbG9yQ2hhbmdlXCIgLz5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IFNjcmVlbnNob3RzU2l6ZSBmcm9tICcuL1NjcmVlbnNob3RzU2l6ZS52dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHNDb2xvciBmcm9tICcuL1NjcmVlbnNob3RzQ29sb3IudnVlJ1xuXG5kZWZpbmVQcm9wczx7XG4gIHNpemU6IG51bWJlclxuICBjb2xvcjogc3RyaW5nXG59PigpXG5cbmNvbnN0IGVtaXQgPSBkZWZpbmVFbWl0czx7XG4gIHNpemVDaGFuZ2U6IFt2YWx1ZTogbnVtYmVyXVxuICBjb2xvckNoYW5nZTogW3ZhbHVlOiBzdHJpbmddXG59PigpXG5cbmNvbnN0IGhhbmRsZVNpemVDaGFuZ2UgPSAodmFsdWU6IG51bWJlcikgPT4ge1xuICBlbWl0KCdzaXplQ2hhbmdlJywgdmFsdWUpXG59XG5cbmNvbnN0IGhhbmRsZUNvbG9yQ2hhbmdlID0gKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgZW1pdCgnY29sb3JDaGFuZ2UnLCB2YWx1ZSlcbn1cbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLnNjcmVlbnNob3RzLXNpemVjb2xvciB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIHBhZGRpbmc6IDNweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tc2hvdC1wYW5lbCk7XG4gIGJvcmRlci1yYWRpdXM6IDJweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tc2hvdC1ib3JkZXIpO1xufVxuPC9zdHlsZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL1NjcmVlbnNob3RzU2l6ZUNvbG9yLnZ1ZSJ9