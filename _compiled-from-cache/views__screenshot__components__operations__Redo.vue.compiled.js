import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Redo.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import { HistoryItemType } from "/src/views/screenshot/types.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Redo",
  setup(__props, { expose: __expose }) {
    __expose();
    const store = useStore();
    const history = computed(() => getValue(store.history));
    const disabled = computed(
      () => !history.value.stack.length || history.value.stack.length - 1 === history.value.index
    );
    const handleClick = () => {
      const historyDispatcher = store.dispatcher?.setHistory;
      if (!historyDispatcher) return;
      const { index, stack } = history.value;
      const item = stack[index + 1];
      if (item) {
        if (item.type === HistoryItemType.Source) {
          item.isSelected = true;
        } else if (item.type === HistoryItemType.Edit) {
          item.source.editHistory.push(item);
        }
      }
      historyDispatcher({
        index: index >= stack.length - 1 ? stack.length - 1 : index + 1,
        stack
      });
    };
    const __returned__ = { store, history, disabled, handleClick, ScreenshotsButton };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: "重做",
    icon: "icon-redo",
    disabled: $setup.disabled,
    onClick: $setup.handleClick
  }, null, 8, ["disabled"]);
}
_sfc_main.__hmrId = "b265e255";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Redo.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyx1QkFBdUI7Ozs7O0FBRTlCLFVBQU0sUUFBUSxTQUFTO0FBQ3ZCLFVBQU0sVUFBVSxTQUFTLE1BQU0sU0FBUyxNQUFNLE9BQU8sQ0FBQztBQUV0RCxVQUFNLFdBQVc7QUFBQSxNQUNmLE1BQU0sQ0FBQyxRQUFRLE1BQU0sTUFBTSxVQUFVLFFBQVEsTUFBTSxNQUFNLFNBQVMsTUFBTSxRQUFRLE1BQU07QUFBQSxJQUN4RjtBQUVBLFVBQU0sY0FBYyxNQUFZO0FBRTlCLFlBQU0sb0JBQXFCLE1BQWMsWUFBWTtBQUNyRCxVQUFJLENBQUMsa0JBQW1CO0FBRXhCLFlBQU0sRUFBRSxPQUFPLE1BQU0sSUFBSSxRQUFRO0FBQ2pDLFlBQU0sT0FBTyxNQUFNLFFBQVEsQ0FBQztBQUU1QixVQUFJLE1BQU07QUFDUixZQUFJLEtBQUssU0FBUyxnQkFBZ0IsUUFBUTtBQUV4QyxlQUFLLGFBQWE7QUFBQSxRQUNwQixXQUFXLEtBQUssU0FBUyxnQkFBZ0IsTUFBTTtBQUM3QyxlQUFLLE9BQU8sWUFBWSxLQUFLLElBQUk7QUFBQSxRQUNuQztBQUFBLE1BQ0Y7QUFFQSx3QkFBa0I7QUFBQSxRQUNoQixPQUFPLFNBQVMsTUFBTSxTQUFTLElBQUksTUFBTSxTQUFTLElBQUksUUFBUTtBQUFBLFFBQzlEO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDs7Ozs7Ozs7dUJBckNFLGFBQTJGO0FBQUEsSUFBeEUsT0FBTTtBQUFBLElBQUssTUFBSztBQUFBLElBQWEsVUFBVTtBQUFBLElBQVcsU0FBTztBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJSZWRvLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxTY3JlZW5zaG90c0J1dHRvbiB0aXRsZT1cIumHjeWBmlwiIGljb249XCJpY29uLXJlZG9cIiA6ZGlzYWJsZWQ9XCJkaXNhYmxlZFwiIEBjbGljaz1cImhhbmRsZUNsaWNrXCIgLz5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyBjb21wdXRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHVzZVN0b3JlLCBnZXRWYWx1ZSB9IGZyb20gJy4uLy4uL2NvbXBvc2FibGVzL3VzZVNjcmVlbnNob3RzQ29udGV4dCdcbmltcG9ydCB7IEhpc3RvcnlJdGVtVHlwZSB9IGZyb20gJy4uLy4uL3R5cGVzJ1xuaW1wb3J0IFNjcmVlbnNob3RzQnV0dG9uIGZyb20gJy4uL1NjcmVlbnNob3RzQnV0dG9uLnZ1ZSdcblxuY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5jb25zdCBoaXN0b3J5ID0gY29tcHV0ZWQoKCkgPT4gZ2V0VmFsdWUoc3RvcmUuaGlzdG9yeSkpXG5cbmNvbnN0IGRpc2FibGVkID0gY29tcHV0ZWQoXG4gICgpID0+ICFoaXN0b3J5LnZhbHVlLnN0YWNrLmxlbmd0aCB8fCBoaXN0b3J5LnZhbHVlLnN0YWNrLmxlbmd0aCAtIDEgPT09IGhpc3RvcnkudmFsdWUuaW5kZXhcbilcblxuY29uc3QgaGFuZGxlQ2xpY2sgPSAoKTogdm9pZCA9PiB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGhpc3RvcnlEaXNwYXRjaGVyID0gKHN0b3JlIGFzIGFueSkuZGlzcGF0Y2hlcj8uc2V0SGlzdG9yeVxuICBpZiAoIWhpc3RvcnlEaXNwYXRjaGVyKSByZXR1cm5cblxuICBjb25zdCB7IGluZGV4LCBzdGFjayB9ID0gaGlzdG9yeS52YWx1ZVxuICBjb25zdCBpdGVtID0gc3RhY2tbaW5kZXggKyAxXVxuXG4gIGlmIChpdGVtKSB7XG4gICAgaWYgKGl0ZW0udHlwZSA9PT0gSGlzdG9yeUl0ZW1UeXBlLlNvdXJjZSkge1xuICAgICAgLy8g6YeN5YGaID0g5oGi5aSN6K+l5Zu+5b2i5Li66YCJ5Lit5oCB77yIdW5kbyDml7blt7Looqvnva4gZmFsc2XvvIlcbiAgICAgIGl0ZW0uaXNTZWxlY3RlZCA9IHRydWVcbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PT0gSGlzdG9yeUl0ZW1UeXBlLkVkaXQpIHtcbiAgICAgIGl0ZW0uc291cmNlLmVkaXRIaXN0b3J5LnB1c2goaXRlbSlcbiAgICB9XG4gIH1cblxuICBoaXN0b3J5RGlzcGF0Y2hlcih7XG4gICAgaW5kZXg6IGluZGV4ID49IHN0YWNrLmxlbmd0aCAtIDEgPyBzdGFjay5sZW5ndGggLSAxIDogaW5kZXggKyAxLFxuICAgIHN0YWNrXG4gIH0pXG59XG48L3NjcmlwdD5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL29wZXJhdGlvbnMvUmVkby52dWUifQ==