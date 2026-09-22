import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Pin.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Pin",
  emits: ["pin"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const emit = __emit;
    const handlePin = () => {
      emit("pin");
    };
    const __returned__ = { emit, handlePin };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("button", {
    class: "pin-button",
    title: "贴图",
    onClick: $setup.handlePin
  }, [..._cache[0] || (_cache[0] = [
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
          d: "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
        })
      ],
      -1
      /* CACHED */
    )
  ])]);
}
import "/src/views/screenshot/components/operations/Pin.vue?vue&type=style&index=0&scoped=e8594213&lang.css";
_sfc_main.__hmrId = "e8594213";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-e8594213"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Pin.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBU0EsVUFBTSxPQUFPO0FBSWIsVUFBTSxZQUFZLE1BQU07QUFDdEIsV0FBSyxLQUFLO0FBQUEsSUFDWjs7Ozs7Ozs7dUJBZEUsb0JBSVM7QUFBQSxJQUpELE9BQU07QUFBQSxJQUFhLE9BQU07QUFBQSxJQUFNLFNBQU87QUFBQTtJQUM1QztBQUFBLE1BRU07QUFBQTtBQUFBLFFBRkQsU0FBUTtBQUFBLFFBQVksT0FBTTtBQUFBLFFBQUssUUFBTztBQUFBOztRQUN6QyxvQkFBcUY7QUFBQSxVQUEvRSxNQUFLO0FBQUEsVUFBZSxHQUFFO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlBpbi52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8YnV0dG9uIGNsYXNzPVwicGluLWJ1dHRvblwiIHRpdGxlPVwi6LS05Zu+XCIgQGNsaWNrPVwiaGFuZGxlUGluXCI+XG4gICAgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9XCIxNlwiIGhlaWdodD1cIjE2XCI+XG4gICAgICA8cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk0xNiAxMlY0aDFWMkg3djJoMXY4bC0yIDJ2Mmg1LjJ2NmgxLjZ2LTZIMTh2LTJsLTItMnpcIiAvPlxuICAgIDwvc3ZnPlxuICA8L2J1dHRvbj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5jb25zdCBlbWl0ID0gZGVmaW5lRW1pdHM8e1xuICBwaW46IFtdXG59PigpXG5cbmNvbnN0IGhhbmRsZVBpbiA9ICgpID0+IHtcbiAgZW1pdCgncGluJylcbn1cbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLnBpbi1idXR0b24ge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgd2lkdGg6IDI4cHg7XG4gIGhlaWdodDogMjhweDtcbiAgcGFkZGluZzogMDtcbiAgYm9yZGVyOiBub25lO1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBib3JkZXItcmFkaXVzOiA0cHg7XG4gIGNvbG9yOiB2YXIoLS1zaG90LXRleHQtbXV0ZWQpO1xuICB0cmFuc2l0aW9uOiBhbGwgMC4ycztcbn1cblxuLnBpbi1idXR0b246aG92ZXIge1xuICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDAsIDAsIDAuMDYpO1xuICBjb2xvcjogdmFyKC0tc2hvdC1hY2NlbnQpO1xufVxuXG4ucGluLWJ1dHRvbiBzdmcge1xuICBmbGV4LXNocmluazogMDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9vcGVyYXRpb25zL1Bpbi52dWUifQ==