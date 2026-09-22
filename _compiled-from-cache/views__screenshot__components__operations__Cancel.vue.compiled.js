import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Cancel.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Cancel",
  emits: ["cancel"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const emit = __emit;
    const handleClick = () => {
      emit("cancel");
    };
    const __returned__ = { emit, handleClick, ScreenshotsButton };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: "取消",
    icon: "icon-cancel",
    onClick: $setup.handleClick
  });
}
_sfc_main.__hmrId = "ccb05a5f";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Cancel.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUtBLE9BQU8sdUJBQXVCOzs7Ozs7QUFFOUIsVUFBTSxPQUFPO0FBSWIsVUFBTSxjQUFjLE1BQU07QUFDeEIsV0FBSyxRQUFRO0FBQUEsSUFDZjs7Ozs7Ozs7dUJBWkUsYUFBd0U7QUFBQSxJQUFyRCxPQUFNO0FBQUEsSUFBSyxNQUFLO0FBQUEsSUFBZSxTQUFPO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkNhbmNlbC52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8U2NyZWVuc2hvdHNCdXR0b24gdGl0bGU9XCLlj5bmtohcIiBpY29uPVwiaWNvbi1jYW5jZWxcIiBAY2xpY2s9XCJoYW5kbGVDbGlja1wiIC8+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IFNjcmVlbnNob3RzQnV0dG9uIGZyb20gJy4uL1NjcmVlbnNob3RzQnV0dG9uLnZ1ZSdcblxuY29uc3QgZW1pdCA9IGRlZmluZUVtaXRzPHtcbiAgY2FuY2VsOiBbXVxufT4oKVxuXG5jb25zdCBoYW5kbGVDbGljayA9ICgpID0+IHtcbiAgZW1pdCgnY2FuY2VsJylcbn1cbjwvc2NyaXB0PlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy92aWV3cy9zY3JlZW5zaG90L2NvbXBvbmVudHMvb3BlcmF0aW9ucy9DYW5jZWwudnVlIn0=