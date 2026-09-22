import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/ui/UEmpty.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "UEmpty",
  props: {
    title: { type: String, required: false, default: "空空如也" },
    description: { type: String, required: false, default: "" }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const __returned__ = {};
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { renderSlot as _renderSlot, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "flex flex-col items-center justify-center gap-2 py-16 text-center" };
const _hoisted_2 = {
  key: 0,
  class: "mb-1 flex size-12 items-center justify-center rounded-full bg-surface-hover text-fg-muted"
};
const _hoisted_3 = { class: "text-sm font-medium text-fg-secondary" };
const _hoisted_4 = {
  key: 1,
  class: "max-w-72 text-xs text-fg-muted"
};
const _hoisted_5 = {
  key: 2,
  class: "mt-3"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _ctx.$slots.icon ? (_openBlock(), _createElementBlock("div", _hoisted_2, [
      _renderSlot(_ctx.$slots, "icon")
    ])) : _createCommentVNode("v-if", true),
    _createElementVNode(
      "p",
      _hoisted_3,
      _toDisplayString($props.title),
      1
      /* TEXT */
    ),
    $props.description ? (_openBlock(), _createElementBlock(
      "p",
      _hoisted_4,
      _toDisplayString($props.description),
      1
      /* TEXT */
    )) : _createCommentVNode("v-if", true),
    _ctx.$slots.action ? (_openBlock(), _createElementBlock("div", _hoisted_5, [
      _renderSlot(_ctx.$slots, "action")
    ])) : _createCommentVNode("v-if", true)
  ]);
}
_sfc_main.__hmrId = "d30a9bdc";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/ui/UEmpty.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O3FCQWlCTyxPQUFNLG9FQUFtRTs7O0VBRzFFLE9BQU07O3FCQUlMLE9BQU0sd0NBQXVDOzs7RUFDMUIsT0FBTTs7OztFQUNGLE9BQU07Ozt1QkFUbEMsb0JBWU0sT0FaTixZQVlNO0FBQUEsSUFWSSxZQUFPLHNCQURmLG9CQUtNLE9BTE4sWUFLTTtBQUFBLE1BREosWUFBb0I7QUFBQTtJQUV0QjtBQUFBLE1BQWdFO0FBQUEsTUFBaEU7QUFBQSxNQUFnRSxpQkFBWixZQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFDaEQsb0NBQVQ7QUFBQSxNQUFrRjtBQUFBLE1BQWxGO0FBQUEsTUFBa0YsaUJBQWxCLGtCQUFXO0FBQUE7QUFBQTtBQUFBO0lBQ2hFLFlBQU8sd0JBQWxCLG9CQUVNLE9BRk4sWUFFTTtBQUFBLE1BREosWUFBc0I7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiVUVtcHR5LnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuLyoqXG4gKiBVRW1wdHkgwrcg57uf5LiA56m654q25oCBXG4gKiDpgJrov4cgI2ljb24g5o+S5qe95pS+5Zu+5qCH77yMI2FjdGlvbiDmlL7mk43kvZzmjInpkq5cbiAqL1xuaW50ZXJmYWNlIFByb3BzIHtcbiAgdGl0bGU/OiBzdHJpbmdcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbn1cblxud2l0aERlZmF1bHRzKGRlZmluZVByb3BzPFByb3BzPigpLCB7XG4gIHRpdGxlOiAn56m656m65aaC5LmfJyxcbiAgZGVzY3JpcHRpb246ICcnXG59KVxuPC9zY3JpcHQ+XG5cbjx0ZW1wbGF0ZT5cbiAgPGRpdiBjbGFzcz1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHB5LTE2IHRleHQtY2VudGVyXCI+XG4gICAgPGRpdlxuICAgICAgdi1pZj1cIiRzbG90cy5pY29uXCJcbiAgICAgIGNsYXNzPVwibWItMSBmbGV4IHNpemUtMTIgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtZnVsbCBiZy1zdXJmYWNlLWhvdmVyIHRleHQtZmctbXV0ZWRcIlxuICAgID5cbiAgICAgIDxzbG90IG5hbWU9XCJpY29uXCIgLz5cbiAgICA8L2Rpdj5cbiAgICA8cCBjbGFzcz1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1mZy1zZWNvbmRhcnlcIj57eyB0aXRsZSB9fTwvcD5cbiAgICA8cCB2LWlmPVwiZGVzY3JpcHRpb25cIiBjbGFzcz1cIm1heC13LTcyIHRleHQteHMgdGV4dC1mZy1tdXRlZFwiPnt7IGRlc2NyaXB0aW9uIH19PC9wPlxuICAgIDxkaXYgdi1pZj1cIiRzbG90cy5hY3Rpb25cIiBjbGFzcz1cIm10LTNcIj5cbiAgICAgIDxzbG90IG5hbWU9XCJhY3Rpb25cIiAvPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5cbjwvdGVtcGxhdGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2NvbXBvbmVudHMvdWkvVUVtcHR5LnZ1ZSJ9