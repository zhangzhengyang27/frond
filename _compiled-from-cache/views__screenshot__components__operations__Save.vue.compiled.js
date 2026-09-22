import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Save.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed, onUnmounted } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import composeImage from "/src/views/screenshot/utils/composeImage.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Save",
  emits: ["save"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const store = useStore();
    const image = computed(() => getValue(store.image));
    const width = computed(() => store.width);
    const height = computed(() => store.height);
    const scaleFactor = computed(() => store.scaleFactor);
    const history = computed(() => getValue(store.history));
    const bounds = computed(() => getValue(store.bounds));
    const emit = __emit;
    let composeTimer = null;
    const handleClick = async () => {
      const historyDispatcher = store.dispatcher?.setHistory;
      if (historyDispatcher) {
        historyDispatcher((prev) => {
          const newHistory = { ...prev };
          newHistory.stack.forEach((item) => {
            if (item.type === 1) {
              item.isSelected = false;
            }
          });
          return newHistory;
        });
      }
      composeTimer = setTimeout(async () => {
        try {
          if (!image.value || !bounds.value) {
            return;
          }
          const blob = await composeImage({
            image: image.value,
            width: width.value,
            height: height.value,
            history: history.value,
            scaleFactor: scaleFactor.value,
            bounds: bounds.value
          });
          emit("save", blob, bounds.value);
        } catch (error) {
          console.error("[Save] 生成截图失败:", error);
        }
      }, 50);
    };
    onUnmounted(() => {
      if (composeTimer) {
        clearTimeout(composeTimer);
        composeTimer = null;
      }
    });
    const __returned__ = { store, image, width, height, scaleFactor, history, bounds, emit, get composeTimer() {
      return composeTimer;
    }, set composeTimer(v) {
      composeTimer = v;
    }, handleClick, ScreenshotsButton };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: "保存",
    icon: "icon-save",
    onClick: $setup.handleClick
  });
}
_sfc_main.__hmrId = "763a9d82";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Save.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUtBLFNBQVMsVUFBVSxtQkFBbUI7QUFDdEMsU0FBUyxVQUFVLGdCQUFnQjtBQUNuQyxPQUFPLGtCQUFrQjtBQUV6QixPQUFPLHVCQUF1Qjs7Ozs7O0FBRTlCLFVBQU0sUUFBUSxTQUFTO0FBQ3ZCLFVBQU0sUUFBUSxTQUFTLE1BQU0sU0FBUyxNQUFNLEtBQUssQ0FBQztBQUNsRCxVQUFNLFFBQVEsU0FBUyxNQUFNLE1BQU0sS0FBSztBQUN4QyxVQUFNLFNBQVMsU0FBUyxNQUFNLE1BQU0sTUFBTTtBQUMxQyxVQUFNLGNBQWMsU0FBUyxNQUFNLE1BQU0sV0FBVztBQUNwRCxVQUFNLFVBQVUsU0FBUyxNQUFNLFNBQVMsTUFBTSxPQUFPLENBQUM7QUFDdEQsVUFBTSxTQUFTLFNBQVMsTUFBTSxTQUFTLE1BQU0sTUFBTSxDQUFDO0FBRXBELFVBQU0sT0FBTztBQUtiLFFBQUksZUFBcUQ7QUFFekQsVUFBTSxjQUFjLFlBQTJCO0FBRTdDLFlBQU0sb0JBQXFCLE1BQWMsWUFBWTtBQUNyRCxVQUFJLG1CQUFtQjtBQUVyQiwwQkFBa0IsQ0FBQyxTQUFjO0FBQy9CLGdCQUFNLGFBQWEsRUFBRSxHQUFHLEtBQUs7QUFFN0IscUJBQVcsTUFBTSxRQUFRLENBQUMsU0FBYztBQUN0QyxnQkFBSSxLQUFLLFNBQVMsR0FBRztBQUNuQixtQkFBSyxhQUFhO0FBQUEsWUFDcEI7QUFBQSxVQUNGLENBQUM7QUFDRCxpQkFBTztBQUFBLFFBQ1QsQ0FBQztBQUFBLE1BQ0g7QUFHQSxxQkFBZSxXQUFXLFlBQVk7QUFDcEMsWUFBSTtBQUNGLGNBQUksQ0FBQyxNQUFNLFNBQVMsQ0FBQyxPQUFPLE9BQU87QUFDakM7QUFBQSxVQUNGO0FBQ0EsZ0JBQU0sT0FBTyxNQUFNLGFBQWE7QUFBQSxZQUM5QixPQUFPLE1BQU07QUFBQSxZQUNiLE9BQU8sTUFBTTtBQUFBLFlBQ2IsUUFBUSxPQUFPO0FBQUEsWUFDZixTQUFTLFFBQVE7QUFBQSxZQUNqQixhQUFhLFlBQVk7QUFBQSxZQUN6QixRQUFRLE9BQU87QUFBQSxVQUNqQixDQUFDO0FBQ0QsZUFBSyxRQUFRLE1BQU0sT0FBTyxLQUFLO0FBQUEsUUFDakMsU0FBUyxPQUFPO0FBQ2Qsa0JBQVEsTUFBTSxrQkFBa0IsS0FBSztBQUFBLFFBQ3ZDO0FBQUEsTUFDRixHQUFHLEVBQUU7QUFBQSxJQUNQO0FBR0EsZ0JBQVksTUFBTTtBQUNoQixVQUFJLGNBQWM7QUFDaEIscUJBQWEsWUFBWTtBQUN6Qix1QkFBZTtBQUFBLE1BQ2pCO0FBQUEsSUFDRixDQUFDOzs7Ozs7Ozs7Ozs7dUJBckVDLGFBQXNFO0FBQUEsSUFBbkQsT0FBTTtBQUFBLElBQUssTUFBSztBQUFBLElBQWEsU0FBTztBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTYXZlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxTY3JlZW5zaG90c0J1dHRvbiB0aXRsZT1cIuS/neWtmFwiIGljb249XCJpY29uLXNhdmVcIiBAY2xpY2s9XCJoYW5kbGVDbGlja1wiIC8+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIG9uVW5tb3VudGVkIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgdXNlU3RvcmUsIGdldFZhbHVlIH0gZnJvbSAnLi4vLi4vY29tcG9zYWJsZXMvdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuaW1wb3J0IGNvbXBvc2VJbWFnZSBmcm9tICcuLi8uLi91dGlscy9jb21wb3NlSW1hZ2UnXG5pbXBvcnQgdHlwZSB7IEJvdW5kcyB9IGZyb20gJy4uLy4uL3R5cGVzJ1xuaW1wb3J0IFNjcmVlbnNob3RzQnV0dG9uIGZyb20gJy4uL1NjcmVlbnNob3RzQnV0dG9uLnZ1ZSdcblxuY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5jb25zdCBpbWFnZSA9IGNvbXB1dGVkKCgpID0+IGdldFZhbHVlKHN0b3JlLmltYWdlKSlcbmNvbnN0IHdpZHRoID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUud2lkdGgpXG5jb25zdCBoZWlnaHQgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS5oZWlnaHQpXG5jb25zdCBzY2FsZUZhY3RvciA9IGNvbXB1dGVkKCgpID0+IHN0b3JlLnNjYWxlRmFjdG9yKVxuY29uc3QgaGlzdG9yeSA9IGNvbXB1dGVkKCgpID0+IGdldFZhbHVlKHN0b3JlLmhpc3RvcnkpKVxuY29uc3QgYm91bmRzID0gY29tcHV0ZWQoKCkgPT4gZ2V0VmFsdWUoc3RvcmUuYm91bmRzKSlcblxuY29uc3QgZW1pdCA9IGRlZmluZUVtaXRzPHtcbiAgc2F2ZTogW2Jsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kc11cbn0+KClcblxuLy8gQnVnIzk6IOS/neWtmCBzZXRUaW1lb3V0IOW8leeUqOS7peS+v+e7hOS7tuWNuOi9veaXtua4hemZpFxubGV0IGNvbXBvc2VUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbFxuXG5jb25zdCBoYW5kbGVDbGljayA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgY29uc3QgaGlzdG9yeURpc3BhdGNoZXIgPSAoc3RvcmUgYXMgYW55KS5kaXNwYXRjaGVyPy5zZXRIaXN0b3J5XG4gIGlmIChoaXN0b3J5RGlzcGF0Y2hlcikge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgaGlzdG9yeURpc3BhdGNoZXIoKHByZXY6IGFueSkgPT4ge1xuICAgICAgY29uc3QgbmV3SGlzdG9yeSA9IHsgLi4ucHJldiB9XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgbmV3SGlzdG9yeS5zdGFjay5mb3JFYWNoKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gMSkge1xuICAgICAgICAgIGl0ZW0uaXNTZWxlY3RlZCA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICByZXR1cm4gbmV3SGlzdG9yeVxuICAgIH0pXG4gIH1cblxuICAvLyBCdWcjOTog5piO56Gu5bu26L+f5pe26Ze0ICsgdHJ5LWNhdGNoIOmUmeivr+WkhOeQhlxuICBjb21wb3NlVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgaWYgKCFpbWFnZS52YWx1ZSB8fCAhYm91bmRzLnZhbHVlKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IGNvbXBvc2VJbWFnZSh7XG4gICAgICAgIGltYWdlOiBpbWFnZS52YWx1ZSxcbiAgICAgICAgd2lkdGg6IHdpZHRoLnZhbHVlLFxuICAgICAgICBoZWlnaHQ6IGhlaWdodC52YWx1ZSxcbiAgICAgICAgaGlzdG9yeTogaGlzdG9yeS52YWx1ZSxcbiAgICAgICAgc2NhbGVGYWN0b3I6IHNjYWxlRmFjdG9yLnZhbHVlLFxuICAgICAgICBib3VuZHM6IGJvdW5kcy52YWx1ZVxuICAgICAgfSlcbiAgICAgIGVtaXQoJ3NhdmUnLCBibG9iLCBib3VuZHMudmFsdWUpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tTYXZlXSDnlJ/miJDmiKrlm77lpLHotKU6JywgZXJyb3IpXG4gICAgfVxuICB9LCA1MClcbn1cblxuLy8gQnVnIzk6IOe7hOS7tuWNuOi9veaXtua4hemZpOWumuaXtuWZqFxub25Vbm1vdW50ZWQoKCkgPT4ge1xuICBpZiAoY29tcG9zZVRpbWVyKSB7XG4gICAgY2xlYXJUaW1lb3V0KGNvbXBvc2VUaW1lcilcbiAgICBjb21wb3NlVGltZXIgPSBudWxsXG4gIH1cbn0pXG48L3NjcmlwdD5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL29wZXJhdGlvbnMvU2F2ZS52dWUifQ==