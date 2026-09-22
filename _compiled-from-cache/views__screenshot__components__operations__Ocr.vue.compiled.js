import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Ocr.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Ocr",
  emits: ["ocr"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const emit = __emit;
    const __returned__ = { emit };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("button", {
    class: "ocr-button",
    title: "文字识别",
    onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("ocr"))
  }, [..._cache[1] || (_cache[1] = [
    _createElementVNode(
      "svg",
      {
        viewBox: "0 0 24 24",
        width: "16",
        height: "16"
      },
      [
        _createElementVNode("path", {
          fill: "currentColor",
          d: "M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"
        })
      ],
      -1
      /* CACHED */
    )
  ])]);
}
import "/src/views/screenshot/components/operations/Ocr.vue?vue&type=style&index=0&scoped=0e5ea95b&lang.css";
_sfc_main.__hmrId = "0e5ea95b";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-0e5ea95b"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Ocr.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBU0EsVUFBTSxPQUFPOzs7Ozs7Ozt1QkFSWCxvQkFJUztBQUFBLElBSkQsT0FBTTtBQUFBLElBQWEsT0FBTTtBQUFBLElBQVEsU0FBSyxzQ0FBRSxXQUFLO0FBQUE7SUFDbkQ7QUFBQSxNQUVNO0FBQUE7QUFBQSxRQUZELFNBQVE7QUFBQSxRQUFZLE9BQU07QUFBQSxRQUFLLFFBQU87QUFBQTs7UUFDekMsb0JBQW1GO0FBQUEsVUFBN0UsTUFBSztBQUFBLFVBQWUsR0FBRTtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJPY3IudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPGJ1dHRvbiBjbGFzcz1cIm9jci1idXR0b25cIiB0aXRsZT1cIuaWh+Wtl+ivhuWIq1wiIEBjbGljaz1cIiRlbWl0KCdvY3InKVwiPlxuICAgIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiMTZcIiBoZWlnaHQ9XCIxNlwiPlxuICAgICAgPHBhdGggZmlsbD1cImN1cnJlbnRDb2xvclwiIGQ9XCJNMi41IDR2M2g1djEyaDNWN2g1VjRoLTEzem0xOSA1aC05djNoM3Y3aDN2LTdoM1Y5elwiIC8+XG4gICAgPC9zdmc+XG4gIDwvYnV0dG9uPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmNvbnN0IGVtaXQgPSBkZWZpbmVFbWl0czx7XG4gIG9jcjogW11cbn0+KClcbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLm9jci1idXR0b24ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgd2lkdGg6IDI4cHg7XG4gIGhlaWdodDogMjhweDtcbiAgcGFkZGluZzogMDtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBib3JkZXItcmFkaXVzOiA0cHg7XG4gIGNvbG9yOiB2YXIoLS1zaG90LXRleHQtbXV0ZWQpO1xuICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcbn1cblxuLm9jci1idXR0b246aG92ZXIge1xuICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDAsIDAsIDAuMDYpO1xuICBjb2xvcjogdmFyKC0tc2hvdC1hY2NlbnQpO1xufVxuXG4ub2NyLWJ1dHRvbiBzdmcge1xuICBmbGV4LXNocmluazogMDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9vcGVyYXRpb25zL09jci52dWUifQ==