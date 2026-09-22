import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Brush/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import { useHistory } from "/src/views/screenshot/composables/useHistory.ts";
import { useOperation } from "/src/views/screenshot/composables/useOperation.ts";
import { useCursor } from "/src/views/screenshot/composables/useCursor.ts";
import { useCanvasContextRef } from "/src/views/screenshot/composables/useCanvasContextRef.ts";
import useCanvasMousedown from "/src/views/screenshot/composables/useCanvasMousedown.ts";
import useCanvasMousemove from "/src/views/screenshot/composables/useCanvasMousemove.ts";
import useCanvasMouseup from "/src/views/screenshot/composables/useCanvasMouseup.ts";
import useDrawSelect from "/src/views/screenshot/composables/useDrawSelect.ts";
import { HistoryItemType } from "/src/views/screenshot/types.ts";
import { isHit } from "/src/views/screenshot/utils/drawUtils.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
import ScreenshotsSizeColor from "/src/views/screenshot/components/ScreenshotsSizeColor.vue";
import draw from "/src/views/screenshot/components/operations/Brush/draw.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "index",
  setup(__props, { expose: __expose }) {
    __expose();
    const store = useStore();
    const lang = computed(() => store.lang);
    const [, cursorDispatcher] = useCursor();
    const [operation, operationDispatcher] = useOperation();
    const canvasContextRef = useCanvasContextRef();
    const [history, historyDispatcher] = useHistory();
    const size = ref(3);
    const color = ref("#ee5126");
    const brushRef = ref(
      null
    );
    const brushEditRef = ref(
      null
    );
    const checked = computed(() => operation === "Brush");
    const selectBrush = () => {
      operationDispatcher.set("Brush");
      cursorDispatcher.set("default");
    };
    const handleSelectBrush = () => {
      if (checked.value) {
        return;
      }
      selectBrush();
      historyDispatcher.clearSelect();
    };
    const setSize = (value) => {
      size.value = value;
    };
    const setColor = (value) => {
      color.value = value;
    };
    const onDrawSelect = (action, e) => {
      if (action.name !== "Brush") {
        return;
      }
      selectBrush();
      brushEditRef.value = {
        type: HistoryItemType.Edit,
        data: {
          x1: e.clientX,
          y1: e.clientY,
          x2: e.clientX,
          y2: e.clientY
        },
        source: action
      };
      historyDispatcher.select(action);
    };
    const onMousedown = (e) => {
      if (!checked.value || brushRef.value || !canvasContextRef.value) {
        return;
      }
      const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
      brushRef.value = {
        name: "Brush",
        type: HistoryItemType.Source,
        data: {
          size: size.value,
          color: color.value,
          points: [
            {
              x: e.clientX - left,
              y: e.clientY - top
            }
          ]
        },
        editHistory: [],
        draw,
        isHit
      };
    };
    const onMousemove = (e) => {
      if (!checked.value || !canvasContextRef.value) {
        return;
      }
      if (brushEditRef.value) {
        brushEditRef.value.data.x2 = e.clientX;
        brushEditRef.value.data.y2 = e.clientY;
        if (history.top !== brushEditRef.value) {
          brushEditRef.value.source.editHistory.push(brushEditRef.value);
          historyDispatcher.push(brushEditRef.value);
        } else {
          historyDispatcher.set(history);
        }
      } else if (brushRef.value) {
        const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
        brushRef.value.data.points.push({
          x: e.clientX - left,
          y: e.clientY - top
        });
        if (history.top !== brushRef.value) {
          historyDispatcher.push(brushRef.value);
        } else {
          historyDispatcher.set(history);
        }
      }
    };
    const onMouseup = () => {
      if (!checked.value) {
        return;
      }
      if (brushRef.value) {
        historyDispatcher.clearSelect();
      }
      brushRef.value = null;
      brushEditRef.value = null;
    };
    useDrawSelect(onDrawSelect);
    useCanvasMousedown(onMousedown);
    useCanvasMousemove(onMousemove);
    useCanvasMouseup(onMouseup);
    const __returned__ = { store, lang, cursorDispatcher, operation, operationDispatcher, canvasContextRef, history, historyDispatcher, size, color, brushRef, brushEditRef, checked, selectBrush, handleSelectBrush, setSize, setColor, onDrawSelect, onMousedown, onMousemove, onMouseup, ScreenshotsButton, ScreenshotsSizeColor };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: $setup.lang.operation_brush_title,
    icon: "icon-brush",
    checked: $setup.checked,
    onClick: $setup.handleSelectBrush
  }, {
    option: _withCtx(() => [
      _createVNode($setup["ScreenshotsSizeColor"], {
        size: $setup.size,
        color: $setup.color,
        onSizeChange: $setup.setSize,
        onColorChange: $setup.setColor
      }, null, 8, ["size", "color"])
    ]),
    _: 1
    /* STABLE */
  }, 8, ["title", "checked"]);
}
_sfc_main.__hmrId = "9c2b419f";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Brush/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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Imlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImluZGV4LnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxTY3JlZW5zaG90c0J1dHRvblxuICAgIDp0aXRsZT1cImxhbmcub3BlcmF0aW9uX2JydXNoX3RpdGxlXCJcbiAgICBpY29uPVwiaWNvbi1icnVzaFwiXG4gICAgOmNoZWNrZWQ9XCJjaGVja2VkXCJcbiAgICBAY2xpY2s9XCJoYW5kbGVTZWxlY3RCcnVzaFwiXG4gID5cbiAgICA8dGVtcGxhdGUgI29wdGlvbj5cbiAgICAgIDxTY3JlZW5zaG90c1NpemVDb2xvclxuICAgICAgICA6c2l6ZT1cInNpemVcIlxuICAgICAgICA6Y29sb3I9XCJjb2xvclwiXG4gICAgICAgIEBzaXplLWNoYW5nZT1cInNldFNpemVcIlxuICAgICAgICBAY29sb3ItY2hhbmdlPVwic2V0Q29sb3JcIlxuICAgICAgLz5cbiAgICA8L3RlbXBsYXRlPlxuICA8L1NjcmVlbnNob3RzQnV0dG9uPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZVNjcmVlbnNob3RzQ29udGV4dCdcbmltcG9ydCB7IHVzZUhpc3RvcnkgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VIaXN0b3J5J1xuaW1wb3J0IHsgdXNlT3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlT3BlcmF0aW9uJ1xuaW1wb3J0IHsgdXNlQ3Vyc29yIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ3Vyc29yJ1xuaW1wb3J0IHsgdXNlQ2FudmFzQ29udGV4dFJlZiB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc0NvbnRleHRSZWYnXG5pbXBvcnQgdXNlQ2FudmFzTW91c2Vkb3duIGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc01vdXNlZG93bidcbmltcG9ydCB1c2VDYW52YXNNb3VzZW1vdmUgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2Vtb3ZlJ1xuaW1wb3J0IHVzZUNhbnZhc01vdXNldXAgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2V1cCdcbmltcG9ydCB1c2VEcmF3U2VsZWN0IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZURyYXdTZWxlY3QnXG5pbXBvcnQgeyBIaXN0b3J5SXRlbVR5cGUsIFBvaW50IH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMnXG5pbXBvcnQgeyBpc0hpdCB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2RyYXdVdGlscydcbmltcG9ydCBTY3JlZW5zaG90c0J1dHRvbiBmcm9tICcuLi8uLi9TY3JlZW5zaG90c0J1dHRvbi52dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHNTaXplQ29sb3IgZnJvbSAnLi4vLi4vU2NyZWVuc2hvdHNTaXplQ29sb3IudnVlJ1xuaW1wb3J0IGRyYXcgZnJvbSAnLi9kcmF3J1xuXG5leHBvcnQgaW50ZXJmYWNlIEJydXNoRGF0YSB7XG4gIHNpemU6IG51bWJlclxuICBjb2xvcjogc3RyaW5nXG4gIHBvaW50czogUG9pbnRbXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJydXNoRWRpdERhdGEge1xuICB4MTogbnVtYmVyXG4gIHkxOiBudW1iZXJcbiAgeDI6IG51bWJlclxuICB5MjogbnVtYmVyXG59XG5cbmNvbnN0IHN0b3JlID0gdXNlU3RvcmUoKVxuY29uc3QgbGFuZyA9IGNvbXB1dGVkKCgpID0+IHN0b3JlLmxhbmcpXG5jb25zdCBbLCBjdXJzb3JEaXNwYXRjaGVyXSA9IHVzZUN1cnNvcigpXG5jb25zdCBbb3BlcmF0aW9uLCBvcGVyYXRpb25EaXNwYXRjaGVyXSA9IHVzZU9wZXJhdGlvbigpXG5jb25zdCBjYW52YXNDb250ZXh0UmVmID0gdXNlQ2FudmFzQ29udGV4dFJlZigpXG5jb25zdCBbaGlzdG9yeSwgaGlzdG9yeURpc3BhdGNoZXJdID0gdXNlSGlzdG9yeSgpXG5cbmNvbnN0IHNpemUgPSByZWYoMylcbmNvbnN0IGNvbG9yID0gcmVmKCcjZWU1MTI2JylcbmNvbnN0IGJydXNoUmVmID0gcmVmPGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTxCcnVzaERhdGEsIEJydXNoRWRpdERhdGE+IHwgbnVsbD4oXG4gIG51bGxcbilcbmNvbnN0IGJydXNoRWRpdFJlZiA9IHJlZjxpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1FZGl0PEJydXNoRWRpdERhdGEsIEJydXNoRGF0YT4gfCBudWxsPihcbiAgbnVsbFxuKVxuXG5jb25zdCBjaGVja2VkID0gY29tcHV0ZWQoKCkgPT4gb3BlcmF0aW9uID09PSAnQnJ1c2gnKVxuXG5jb25zdCBzZWxlY3RCcnVzaCA9ICgpID0+IHtcbiAgb3BlcmF0aW9uRGlzcGF0Y2hlci5zZXQoJ0JydXNoJylcbiAgY3Vyc29yRGlzcGF0Y2hlci5zZXQoJ2RlZmF1bHQnKVxufVxuXG5jb25zdCBoYW5kbGVTZWxlY3RCcnVzaCA9ICgpID0+IHtcbiAgaWYgKGNoZWNrZWQudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuICBzZWxlY3RCcnVzaCgpXG4gIGhpc3RvcnlEaXNwYXRjaGVyLmNsZWFyU2VsZWN0KClcbn1cblxuY29uc3Qgc2V0U2l6ZSA9ICh2YWx1ZTogbnVtYmVyKSA9PiB7XG4gIHNpemUudmFsdWUgPSB2YWx1ZVxufVxuXG5jb25zdCBzZXRDb2xvciA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gIGNvbG9yLnZhbHVlID0gdmFsdWVcbn1cblxuY29uc3Qgb25EcmF3U2VsZWN0ID0gKFxuICBhY3Rpb246IGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTx1bmtub3duLCB1bmtub3duPixcbiAgZTogTW91c2VFdmVudFxuKSA9PiB7XG4gIGlmIChhY3Rpb24ubmFtZSAhPT0gJ0JydXNoJykge1xuICAgIHJldHVyblxuICB9XG5cbiAgc2VsZWN0QnJ1c2goKVxuXG4gIGJydXNoRWRpdFJlZi52YWx1ZSA9IHtcbiAgICB0eXBlOiBIaXN0b3J5SXRlbVR5cGUuRWRpdCxcbiAgICBkYXRhOiB7XG4gICAgICB4MTogZS5jbGllbnRYLFxuICAgICAgeTE6IGUuY2xpZW50WSxcbiAgICAgIHgyOiBlLmNsaWVudFgsXG4gICAgICB5MjogZS5jbGllbnRZXG4gICAgfSxcbiAgICBzb3VyY2U6IGFjdGlvbiBhcyBpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1Tb3VyY2U8QnJ1c2hEYXRhLCBCcnVzaEVkaXREYXRhPlxuICB9XG5cbiAgaGlzdG9yeURpc3BhdGNoZXIuc2VsZWN0KGFjdGlvbilcbn1cblxuY29uc3Qgb25Nb3VzZWRvd24gPSAoZTogTW91c2VFdmVudCk6IHZvaWQgPT4ge1xuICBpZiAoIWNoZWNrZWQudmFsdWUgfHwgYnJ1c2hSZWYudmFsdWUgfHwgIWNhbnZhc0NvbnRleHRSZWYudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IHsgbGVmdCwgdG9wIH0gPSBjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcyEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblxuICBicnVzaFJlZi52YWx1ZSA9IHtcbiAgICBuYW1lOiAnQnJ1c2gnLFxuICAgIHR5cGU6IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UsXG4gICAgZGF0YToge1xuICAgICAgc2l6ZTogc2l6ZS52YWx1ZSxcbiAgICAgIGNvbG9yOiBjb2xvci52YWx1ZSxcbiAgICAgIHBvaW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgeDogZS5jbGllbnRYIC0gbGVmdCxcbiAgICAgICAgICB5OiBlLmNsaWVudFkgLSB0b3BcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0sXG4gICAgZWRpdEhpc3Rvcnk6IFtdLFxuICAgIGRyYXcsXG4gICAgaXNIaXRcbiAgfVxufVxuXG5jb25zdCBvbk1vdXNlbW92ZSA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSB8fCAhY2FudmFzQ29udGV4dFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgaWYgKGJydXNoRWRpdFJlZi52YWx1ZSkge1xuICAgIGJydXNoRWRpdFJlZi52YWx1ZS5kYXRhLngyID0gZS5jbGllbnRYXG4gICAgYnJ1c2hFZGl0UmVmLnZhbHVlLmRhdGEueTIgPSBlLmNsaWVudFlcbiAgICBpZiAoaGlzdG9yeS50b3AgIT09IGJydXNoRWRpdFJlZi52YWx1ZSkge1xuICAgICAgYnJ1c2hFZGl0UmVmLnZhbHVlLnNvdXJjZS5lZGl0SGlzdG9yeS5wdXNoKGJydXNoRWRpdFJlZi52YWx1ZSlcbiAgICAgIGhpc3RvcnlEaXNwYXRjaGVyLnB1c2goYnJ1c2hFZGl0UmVmLnZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5zZXQoaGlzdG9yeSlcbiAgICB9XG4gIH0gZWxzZSBpZiAoYnJ1c2hSZWYudmFsdWUpIHtcbiAgICBjb25zdCB7IGxlZnQsIHRvcCB9ID0gY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cbiAgICBicnVzaFJlZi52YWx1ZS5kYXRhLnBvaW50cy5wdXNoKHtcbiAgICAgIHg6IGUuY2xpZW50WCAtIGxlZnQsXG4gICAgICB5OiBlLmNsaWVudFkgLSB0b3BcbiAgICB9KVxuXG4gICAgaWYgKGhpc3RvcnkudG9wICE9PSBicnVzaFJlZi52YWx1ZSkge1xuICAgICAgaGlzdG9yeURpc3BhdGNoZXIucHVzaChicnVzaFJlZi52YWx1ZSlcbiAgICB9IGVsc2Uge1xuICAgICAgaGlzdG9yeURpc3BhdGNoZXIuc2V0KGhpc3RvcnkpXG4gICAgfVxuICB9XG59XG5cbmNvbnN0IG9uTW91c2V1cCA9ICgpOiB2b2lkID0+IHtcbiAgaWYgKCFjaGVja2VkLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBpZiAoYnJ1c2hSZWYudmFsdWUpIHtcbiAgICBoaXN0b3J5RGlzcGF0Y2hlci5jbGVhclNlbGVjdCgpXG4gIH1cblxuICBicnVzaFJlZi52YWx1ZSA9IG51bGxcbiAgYnJ1c2hFZGl0UmVmLnZhbHVlID0gbnVsbFxufVxuXG51c2VEcmF3U2VsZWN0KG9uRHJhd1NlbGVjdClcbnVzZUNhbnZhc01vdXNlZG93bihvbk1vdXNlZG93bilcbnVzZUNhbnZhc01vdXNlbW92ZShvbk1vdXNlbW92ZSlcbnVzZUNhbnZhc01vdXNldXAob25Nb3VzZXVwKVxuPC9zY3JpcHQ+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9vcGVyYXRpb25zL0JydXNoL2luZGV4LnZ1ZSJ9