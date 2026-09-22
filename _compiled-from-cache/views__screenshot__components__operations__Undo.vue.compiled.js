import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Undo.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import { HistoryItemType } from "/src/views/screenshot/types.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Undo",
  setup(__props, { expose: __expose }) {
    __expose();
    const store = useStore();
    const history = computed(() => getValue(store.history));
    const disabled = computed(() => history.value.index === -1);
    const handleClick = () => {
      const historyDispatcher = store.dispatcher?.setHistory;
      if (!historyDispatcher) return;
      const { index, stack } = history.value;
      const item = stack[index];
      if (item) {
        if (item.type === HistoryItemType.Source) {
          item.isSelected = false;
        } else if (item.type === HistoryItemType.Edit) {
          item.source.editHistory.pop();
        }
      }
      historyDispatcher({
        index: index <= 0 ? -1 : index - 1,
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
    title: "撤销",
    icon: "icon-undo",
    disabled: $setup.disabled,
    onClick: $setup.handleClick
  }, null, 8, ["disabled"]);
}
_sfc_main.__hmrId = "43bbcf61";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Undo.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyx1QkFBdUI7Ozs7O0FBRTlCLFVBQU0sUUFBUSxTQUFTO0FBQ3ZCLFVBQU0sVUFBVSxTQUFTLE1BQU0sU0FBUyxNQUFNLE9BQU8sQ0FBQztBQUV0RCxVQUFNLFdBQVcsU0FBUyxNQUFNLFFBQVEsTUFBTSxVQUFVLEVBQUU7QUFFMUQsVUFBTSxjQUFjLE1BQVk7QUFFOUIsWUFBTSxvQkFBcUIsTUFBYyxZQUFZO0FBQ3JELFVBQUksQ0FBQyxrQkFBbUI7QUFFeEIsWUFBTSxFQUFFLE9BQU8sTUFBTSxJQUFJLFFBQVE7QUFDakMsWUFBTSxPQUFPLE1BQU0sS0FBSztBQUV4QixVQUFJLE1BQU07QUFDUixZQUFJLEtBQUssU0FBUyxnQkFBZ0IsUUFBUTtBQUN4QyxlQUFLLGFBQWE7QUFBQSxRQUNwQixXQUFXLEtBQUssU0FBUyxnQkFBZ0IsTUFBTTtBQUM3QyxlQUFLLE9BQU8sWUFBWSxJQUFJO0FBQUEsUUFDOUI7QUFBQSxNQUNGO0FBRUEsd0JBQWtCO0FBQUEsUUFDaEIsT0FBTyxTQUFTLElBQUksS0FBSyxRQUFRO0FBQUEsUUFDakM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIOzs7Ozs7Ozt1QkFsQ0UsYUFBMkY7QUFBQSxJQUF4RSxPQUFNO0FBQUEsSUFBSyxNQUFLO0FBQUEsSUFBYSxVQUFVO0FBQUEsSUFBVyxTQUFPO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlVuZG8udnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPFNjcmVlbnNob3RzQnV0dG9uIHRpdGxlPVwi5pKk6ZSAXCIgaWNvbj1cImljb24tdW5kb1wiIDpkaXNhYmxlZD1cImRpc2FibGVkXCIgQGNsaWNrPVwiaGFuZGxlQ2xpY2tcIiAvPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IGNvbXB1dGVkIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgdXNlU3RvcmUsIGdldFZhbHVlIH0gZnJvbSAnLi4vLi4vY29tcG9zYWJsZXMvdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuaW1wb3J0IHsgSGlzdG9yeUl0ZW1UeXBlIH0gZnJvbSAnLi4vLi4vdHlwZXMnXG5pbXBvcnQgU2NyZWVuc2hvdHNCdXR0b24gZnJvbSAnLi4vU2NyZWVuc2hvdHNCdXR0b24udnVlJ1xuXG5jb25zdCBzdG9yZSA9IHVzZVN0b3JlKClcbmNvbnN0IGhpc3RvcnkgPSBjb21wdXRlZCgoKSA9PiBnZXRWYWx1ZShzdG9yZS5oaXN0b3J5KSlcblxuY29uc3QgZGlzYWJsZWQgPSBjb21wdXRlZCgoKSA9PiBoaXN0b3J5LnZhbHVlLmluZGV4ID09PSAtMSlcblxuY29uc3QgaGFuZGxlQ2xpY2sgPSAoKTogdm9pZCA9PiB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGhpc3RvcnlEaXNwYXRjaGVyID0gKHN0b3JlIGFzIGFueSkuZGlzcGF0Y2hlcj8uc2V0SGlzdG9yeVxuICBpZiAoIWhpc3RvcnlEaXNwYXRjaGVyKSByZXR1cm5cblxuICBjb25zdCB7IGluZGV4LCBzdGFjayB9ID0gaGlzdG9yeS52YWx1ZVxuICBjb25zdCBpdGVtID0gc3RhY2tbaW5kZXhdXG5cbiAgaWYgKGl0ZW0pIHtcbiAgICBpZiAoaXRlbS50eXBlID09PSBIaXN0b3J5SXRlbVR5cGUuU291cmNlKSB7XG4gICAgICBpdGVtLmlzU2VsZWN0ZWQgPSBmYWxzZVxuICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSBIaXN0b3J5SXRlbVR5cGUuRWRpdCkge1xuICAgICAgaXRlbS5zb3VyY2UuZWRpdEhpc3RvcnkucG9wKClcbiAgICB9XG4gIH1cblxuICBoaXN0b3J5RGlzcGF0Y2hlcih7XG4gICAgaW5kZXg6IGluZGV4IDw9IDAgPyAtMSA6IGluZGV4IC0gMSxcbiAgICBzdGFja1xuICB9KVxufVxuPC9zY3JpcHQ+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9vcGVyYXRpb25zL1VuZG8udnVlIn0=