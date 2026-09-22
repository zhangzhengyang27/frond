import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/ScreenshotsButton.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import ScreenshotsOption from "/src/views/screenshot/components/ScreenshotsOption/index.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ScreenshotsButton",
  props: {
    title: { type: String, required: false },
    icon: { type: String, required: false },
    checked: { type: Boolean, required: false },
    disabled: { type: Boolean, required: false },
    type: { type: String, required: false },
    option: { type: null, required: false }
  },
  emits: ["click"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const emit = __emit;
    const handleClick = (e) => {
      emit("click", e);
    };
    const __returned__ = { emit, handleClick, ScreenshotsOption };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { normalizeClass as _normalizeClass, openBlock as _openBlock, createElementBlock as _createElementBlock, renderSlot as _renderSlot, withCtx as _withCtx, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = ["title"];
const _hoisted_2 = {
  key: 1,
  class: "screenshots-operations-divider"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsOption"], {
    open: $props.checked,
    content: $props.option
  }, {
    content: _withCtx(() => [
      _renderSlot(_ctx.$slots, "option", {}, void 0, true)
    ]),
    default: _withCtx(() => [
      $props.type !== "divider" ? (_openBlock(), _createElementBlock("div", {
        key: 0,
        class: _normalizeClass([
          "screenshots-button",
          { "screenshots-button-checked": $props.checked, "screenshots-button-disabled": $props.disabled }
        ]),
        title: $props.title,
        onClick: $setup.handleClick
      }, [
        $props.icon ? (_openBlock(), _createElementBlock(
          "span",
          {
            key: 0,
            class: _normalizeClass([$props.icon, "screenshots-button-icon"])
          },
          null,
          2
          /* CLASS */
        )) : _renderSlot(_ctx.$slots, "default", { key: 1 }, void 0, true)
      ], 10, _hoisted_1)) : (_openBlock(), _createElementBlock("div", _hoisted_2))
    ]),
    _: 3
    /* FORWARDED */
  }, 8, ["open", "content"]);
}
import "/src/views/screenshot/components/ScreenshotsButton.vue?vue&type=style&index=0&scoped=64f66318&lang.css";
_sfc_main.__hmrId = "64f66318";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-64f66318"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/ScreenshotsButton.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQXNCQSxPQUFPLHVCQUF1Qjs7Ozs7Ozs7Ozs7Ozs7QUFjOUIsVUFBTSxPQUFPO0FBSWIsVUFBTSxjQUFjLENBQUMsTUFBa0I7QUFDckMsV0FBSyxTQUFTLENBQUM7QUFBQSxJQUNqQjs7Ozs7Ozs7OztFQTVCZ0IsT0FBTTs7O3VCQWJwQixhQWlCb0I7QUFBQSxJQWpCQSxNQUFNO0FBQUEsSUFBVSxTQUFTO0FBQUE7SUFjaEMsU0FBTyxTQUNoQixNQUFzQjtBQUFBLE1BQXRCLFlBQXNCO0FBQUE7c0JBZHhCLE1BV007QUFBQSxNQVZFLGdCQUFJLDJCQURaLG9CQVdNO0FBQUE7UUFUSCxPQUFLO0FBQUE7MENBQTBFLGdCQUFPLCtCQUFpQyxnQkFBUTtBQUFBO1FBSS9ILE9BQU87QUFBQSxRQUNQLFNBQU87QUFBQTtRQUVJLDZCQUFaO0FBQUEsVUFBa0U7QUFBQTtBQUFBO1lBQS9DLE9BQUssaUJBQUUsYUFBWSx5QkFBeUI7QUFBQTs7OzthQUMvRCxZQUFlO0FBQUEsMkNBRWpCLG9CQUFxRCxPQUFyRCxVQUFxRDtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTY3JlZW5zaG90c0J1dHRvbi52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8U2NyZWVuc2hvdHNPcHRpb24gOm9wZW49XCJjaGVja2VkXCIgOmNvbnRlbnQ9XCJvcHRpb25cIj5cbiAgICA8ZGl2XG4gICAgICB2LWlmPVwidHlwZSAhPT0gJ2RpdmlkZXInXCJcbiAgICAgIDpjbGFzcz1cIltcbiAgICAgICAgJ3NjcmVlbnNob3RzLWJ1dHRvbicsXG4gICAgICAgIHsgJ3NjcmVlbnNob3RzLWJ1dHRvbi1jaGVja2VkJzogY2hlY2tlZCwgJ3NjcmVlbnNob3RzLWJ1dHRvbi1kaXNhYmxlZCc6IGRpc2FibGVkIH1cbiAgICAgIF1cIlxuICAgICAgOnRpdGxlPVwidGl0bGVcIlxuICAgICAgQGNsaWNrPVwiaGFuZGxlQ2xpY2tcIlxuICAgID5cbiAgICAgIDxzcGFuIHYtaWY9XCJpY29uXCIgOmNsYXNzPVwiaWNvblwiIGNsYXNzPVwic2NyZWVuc2hvdHMtYnV0dG9uLWljb25cIiAvPlxuICAgICAgPHNsb3Qgdi1lbHNlIC8+XG4gICAgPC9kaXY+XG4gICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJzY3JlZW5zaG90cy1vcGVyYXRpb25zLWRpdmlkZXJcIiAvPlxuICAgIDx0ZW1wbGF0ZSAjY29udGVudD5cbiAgICAgIDxzbG90IG5hbWU9XCJvcHRpb25cIiAvPlxuICAgIDwvdGVtcGxhdGU+XG4gIDwvU2NyZWVuc2hvdHNPcHRpb24+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IFNjcmVlbnNob3RzT3B0aW9uIGZyb20gJy4vU2NyZWVuc2hvdHNPcHRpb24vaW5kZXgudnVlJ1xuXG5kZWZpbmVQcm9wczx7XG4gIHRpdGxlPzogc3RyaW5nXG4gIGljb24/OiBzdHJpbmdcbiAgY2hlY2tlZD86IGJvb2xlYW5cbiAgZGlzYWJsZWQ/OiBib29sZWFuXG4gIHR5cGU/OiAnZGl2aWRlcidcbiAgLy8gb3B0aW9uIOaYryBidXR0b24g5YaF6YOoIGRyb3Bkb3duIOWGheWuue+8jOe7k+aehOeUsSBTY3JlZW5zaG90c09wdGlvbiDmtojotLnvvJtcbiAgLy8g5YWx5Lqr57G75Z6L5ZyoIFNjcmVlbnNob3RzT3B0aW9uL2luZGV4LnZ1ZVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBvcHRpb24/OiBhbnlcbn0+KClcblxuY29uc3QgZW1pdCA9IGRlZmluZUVtaXRzPHtcbiAgY2xpY2s6IFtlOiBNb3VzZUV2ZW50XVxufT4oKVxuXG5jb25zdCBoYW5kbGVDbGljayA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gIGVtaXQoJ2NsaWNrJywgZSlcbn1cbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLnNjcmVlbnNob3RzLWJ1dHRvbiB7XG4gIHdpZHRoOiAyOHB4O1xuICBoZWlnaHQ6IDI4cHg7XG4gIGxpbmUtaGVpZ2h0OiAyOHB4O1xuICBjb2xvcjogdmFyKC0tc2hvdC10ZXh0LWRpbSk7XG4gIGZvbnQtc2l6ZTogMTZweDtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICBtYXJnaW46IDAgMnB4O1xuICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIGJvcmRlci1yYWRpdXM6IDdweDtcbiAgdHJhbnNpdGlvbjpcbiAgICBiYWNrZ3JvdW5kLWNvbG9yIDAuMTVzLFxuICAgIGNvbG9yIDAuMTVzLFxuICAgIHRyYW5zZm9ybSAwLjFzO1xufVxuXG4uc2NyZWVuc2hvdHMtYnV0dG9uOmhvdmVyIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA5KTtcbiAgY29sb3I6IHZhcigtLXNob3QtdGV4dCk7XG59XG5cbi5zY3JlZW5zaG90cy1idXR0b246YWN0aXZlIHtcbiAgdHJhbnNmb3JtOiBzY2FsZSgwLjkpO1xufVxuXG4uc2NyZWVuc2hvdHMtYnV0dG9uLWNoZWNrZWQge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1zaG90LWFjY2VudC1zb2Z0KTtcbiAgY29sb3I6IHZhcigtLXNob3QtYWNjZW50KTtcbn1cblxuLnNjcmVlbnNob3RzLWJ1dHRvbi1jaGVja2VkOmhvdmVyIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tc2hvdC1hY2NlbnQtc29mdCk7XG4gIGNvbG9yOiB2YXIoLS1zaG90LWFjY2VudCk7XG59XG5cbi5zY3JlZW5zaG90cy1idXR0b24tZGlzYWJsZWQge1xuICBjb2xvcjogdmFyKC0tc2hvdC10ZXh0LWZhaW50KTtcbiAgY3Vyc29yOiBub3QtYWxsb3dlZDtcbn1cblxuLnNjcmVlbnNob3RzLWJ1dHRvbi1kaXNhYmxlZDpob3ZlciB7XG4gIGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50O1xuICBjb2xvcjogdmFyKC0tc2hvdC10ZXh0LWZhaW50KTtcbn1cblxuLnNjcmVlbnNob3RzLWJ1dHRvbi1kaXNhYmxlZDphY3RpdmUge1xuICB0cmFuc2Zvcm06IG5vbmU7XG59XG5cbi5zY3JlZW5zaG90cy1idXR0b24taWNvbiB7XG4gIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgZm9udC1zaXplOiAxNnB4O1xuICBsaW5lLWhlaWdodDogMTtcbn1cblxuLnNjcmVlbnNob3RzLW9wZXJhdGlvbnMtZGl2aWRlciB7XG4gIGJhY2tncm91bmQ6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xNik7XG4gIHdpZHRoOiAxcHg7XG4gIGhlaWdodDogMThweDtcbiAgbWFyZ2luOiAwIDRweDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9TY3JlZW5zaG90c0J1dHRvbi52dWUifQ==