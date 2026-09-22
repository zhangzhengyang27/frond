import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Arrow/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
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
import { isHit, isHitCircle } from "/src/views/screenshot/utils/drawUtils.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
import ScreenshotsSizeColor from "/src/views/screenshot/components/ScreenshotsSizeColor.vue";
import draw, { getEditedArrowData } from "/src/views/screenshot/components/operations/Arrow/draw.ts";
export var ArrowEditType = /* @__PURE__ */ ((ArrowEditType2) => {
  ArrowEditType2[ArrowEditType2["Move"] = 0] = "Move";
  ArrowEditType2[ArrowEditType2["MoveStart"] = 1] = "MoveStart";
  ArrowEditType2[ArrowEditType2["MoveEnd"] = 2] = "MoveEnd";
  return ArrowEditType2;
})(ArrowEditType || {});
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "index",
  setup(__props, { expose: __expose }) {
    __expose();
    const store = useStore();
    const lang = computed(() => store.lang);
    const [, cursorDispatcher] = useCursor();
    const [operation, operationDispatcher] = useOperation();
    const [history, historyDispatcher] = useHistory();
    const canvasContextRef = useCanvasContextRef();
    const size = ref(3);
    const color = ref("#ee5126");
    const arrowRef = ref(null);
    const arrowEditRef = ref(null);
    const setSize = (newSize) => {
      size.value = newSize;
    };
    const setColor = (newColor) => {
      color.value = newColor;
    };
    const checked = computed(() => operation === "Arrow");
    const selectArrow = () => {
      operationDispatcher.set("Arrow");
      cursorDispatcher.set("default");
    };
    const handleSelectArrow = () => {
      if (checked.value) {
        return;
      }
      selectArrow();
      historyDispatcher.clearSelect();
    };
    const onDrawSelect = (action, e) => {
      if (action.name !== "Arrow" || !canvasContextRef.value) {
        return;
      }
      const source = action;
      selectArrow();
      const { x1, y1, x2, y2 } = getEditedArrowData(source);
      let type = 0;
      if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x1,
        y: y1
      })) {
        type = 1;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x2,
        y: y2
      })) {
        type = 2;
      }
      arrowEditRef.value = {
        type: HistoryItemType.Edit,
        data: {
          type,
          x1: e.clientX,
          y1: e.clientY,
          x2: e.clientX,
          y2: e.clientY
        },
        source
      };
      historyDispatcher.select(action);
    };
    const onMousedown = (e) => {
      if (!checked.value || arrowRef.value || !canvasContextRef.value) {
        return;
      }
      const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
      arrowRef.value = {
        name: "Arrow",
        type: HistoryItemType.Source,
        data: {
          size: size.value,
          color: color.value,
          x1: e.clientX - left,
          y1: e.clientY - top,
          x2: e.clientX - left,
          y2: e.clientY - top
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
      if (arrowEditRef.value) {
        arrowEditRef.value.data.x2 = e.clientX;
        arrowEditRef.value.data.y2 = e.clientY;
        if (history.top !== arrowEditRef.value) {
          arrowEditRef.value.source.editHistory.push(arrowEditRef.value);
          historyDispatcher.push(arrowEditRef.value);
        } else {
          historyDispatcher.set(history);
        }
      } else if (arrowRef.value) {
        const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
        arrowRef.value.data.x2 = e.clientX - left;
        arrowRef.value.data.y2 = e.clientY - top;
        if (history.top !== arrowRef.value) {
          historyDispatcher.push(arrowRef.value);
        } else {
          historyDispatcher.set(history);
        }
      }
    };
    const onMouseup = () => {
      if (!checked.value) {
        return;
      }
      if (arrowRef.value) {
        historyDispatcher.clearSelect();
      }
      arrowRef.value = null;
      arrowEditRef.value = null;
    };
    useDrawSelect(onDrawSelect);
    useCanvasMousedown(onMousedown);
    useCanvasMousemove(onMousemove);
    useCanvasMouseup(onMouseup);
    const __returned__ = { ArrowEditType, store, lang, cursorDispatcher, operation, operationDispatcher, history, historyDispatcher, canvasContextRef, size, color, arrowRef, arrowEditRef, setSize, setColor, checked, selectArrow, handleSelectArrow, onDrawSelect, onMousedown, onMousemove, onMouseup, ScreenshotsButton, ScreenshotsSizeColor };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: $setup.lang.operation_arrow_title,
    icon: "icon-arrow",
    checked: $setup.checked,
    onClick: $setup.handleSelectArrow
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
_sfc_main.__hmrId = "f3249851";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Arrow/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QyxRQUFRLE9BQU87QUFDbEI7QUFBQSxNQUNGO0FBRUEsVUFBSSxTQUFTLE9BQU87QUFDbEIsMEJBQWtCLFlBQVk7QUFBQSxNQUNoQztBQUVBLGVBQVMsUUFBUTtBQUNqQixtQkFBYSxRQUFRO0FBQUEsSUFDdkI7QUFFQSxrQkFBYyxZQUFZO0FBQzFCLHVCQUFtQixXQUFXO0FBQzlCLHVCQUFtQixXQUFXO0FBQzlCLHFCQUFpQixTQUFTOzs7Ozs7Ozt1QkEzTnhCLGFBY29CO0FBQUEsSUFiakIsT0FBTyxZQUFLO0FBQUEsSUFDYixNQUFLO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxTQUFPO0FBQUE7SUFFRyxRQUFNLFNBQ2YsTUFLRTtBQUFBLE1BTEYsYUFLRTtBQUFBLFFBSkMsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFFBQ1AsY0FBYTtBQUFBLFFBQ2IsZUFBYztBQUFBIiwibmFtZXMiOlsiQXJyb3dFZGl0VHlwZSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJpbmRleC52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8U2NyZWVuc2hvdHNCdXR0b25cbiAgICA6dGl0bGU9XCJsYW5nLm9wZXJhdGlvbl9hcnJvd190aXRsZVwiXG4gICAgaWNvbj1cImljb24tYXJyb3dcIlxuICAgIDpjaGVja2VkPVwiY2hlY2tlZFwiXG4gICAgQGNsaWNrPVwiaGFuZGxlU2VsZWN0QXJyb3dcIlxuICA+XG4gICAgPHRlbXBsYXRlICNvcHRpb24+XG4gICAgICA8U2NyZWVuc2hvdHNTaXplQ29sb3JcbiAgICAgICAgOnNpemU9XCJzaXplXCJcbiAgICAgICAgOmNvbG9yPVwiY29sb3JcIlxuICAgICAgICBAc2l6ZS1jaGFuZ2U9XCJzZXRTaXplXCJcbiAgICAgICAgQGNvbG9yLWNoYW5nZT1cInNldENvbG9yXCJcbiAgICAgIC8+XG4gICAgPC90ZW1wbGF0ZT5cbiAgPC9TY3JlZW5zaG90c0J1dHRvbj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgbGFuZz1cInRzXCI+XG5leHBvcnQgaW50ZXJmYWNlIEFycm93RGF0YSB7XG4gIHNpemU6IG51bWJlclxuICBjb2xvcjogc3RyaW5nXG4gIHgxOiBudW1iZXJcbiAgeDI6IG51bWJlclxuICB5MTogbnVtYmVyXG4gIHkyOiBudW1iZXJcbn1cblxuZXhwb3J0IGVudW0gQXJyb3dFZGl0VHlwZSB7XG4gIE1vdmUsXG4gIE1vdmVTdGFydCxcbiAgTW92ZUVuZFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFycm93RWRpdERhdGEge1xuICB0eXBlOiBBcnJvd0VkaXRUeXBlXG4gIHgxOiBudW1iZXJcbiAgeDI6IG51bWJlclxuICB5MTogbnVtYmVyXG4gIHkyOiBudW1iZXJcbn1cbjwvc2NyaXB0PlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgcmVmLCBjb21wdXRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHVzZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuaW1wb3J0IHsgdXNlSGlzdG9yeSB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUhpc3RvcnknXG5pbXBvcnQgeyB1c2VPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VPcGVyYXRpb24nXG5pbXBvcnQgeyB1c2VDdXJzb3IgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDdXJzb3InXG5pbXBvcnQgeyB1c2VDYW52YXNDb250ZXh0UmVmIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzQ29udGV4dFJlZidcbmltcG9ydCB1c2VDYW52YXNNb3VzZWRvd24gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2Vkb3duJ1xuaW1wb3J0IHVzZUNhbnZhc01vdXNlbW92ZSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDYW52YXNNb3VzZW1vdmUnXG5pbXBvcnQgdXNlQ2FudmFzTW91c2V1cCBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDYW52YXNNb3VzZXVwJ1xuaW1wb3J0IHVzZURyYXdTZWxlY3QgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlRHJhd1NlbGVjdCdcbmltcG9ydCB7IEhpc3RvcnlJdGVtVHlwZSB9IGZyb20gJy4uLy4uLy4uL3R5cGVzJ1xuaW1wb3J0IHsgaXNIaXQsIGlzSGl0Q2lyY2xlIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZHJhd1V0aWxzJ1xuaW1wb3J0IFNjcmVlbnNob3RzQnV0dG9uIGZyb20gJy4uLy4uL1NjcmVlbnNob3RzQnV0dG9uLnZ1ZSdcbmltcG9ydCBTY3JlZW5zaG90c1NpemVDb2xvciBmcm9tICcuLi8uLi9TY3JlZW5zaG90c1NpemVDb2xvci52dWUnXG5pbXBvcnQgZHJhdywgeyBnZXRFZGl0ZWRBcnJvd0RhdGEgfSBmcm9tICcuL2RyYXcnXG5cbmNvbnN0IHN0b3JlID0gdXNlU3RvcmUoKVxuY29uc3QgbGFuZyA9IGNvbXB1dGVkKCgpID0+IHN0b3JlLmxhbmcpXG5jb25zdCBbLCBjdXJzb3JEaXNwYXRjaGVyXSA9IHVzZUN1cnNvcigpXG5jb25zdCBbb3BlcmF0aW9uLCBvcGVyYXRpb25EaXNwYXRjaGVyXSA9IHVzZU9wZXJhdGlvbigpXG5jb25zdCBbaGlzdG9yeSwgaGlzdG9yeURpc3BhdGNoZXJdID0gdXNlSGlzdG9yeSgpXG5jb25zdCBjYW52YXNDb250ZXh0UmVmID0gdXNlQ2FudmFzQ29udGV4dFJlZigpXG5cbmNvbnN0IHNpemUgPSByZWYoMylcbmNvbnN0IGNvbG9yID0gcmVmKCcjZWU1MTI2JylcbmNvbnN0IGFycm93UmVmID0gcmVmPFxuICB8IGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTxcbiAgICAgIGltcG9ydCgnLi9pbmRleC52dWUnKS5BcnJvd0RhdGEsXG4gICAgICBpbXBvcnQoJy4vaW5kZXgudnVlJykuQXJyb3dFZGl0RGF0YVxuICAgID5cbiAgfCBudWxsXG4+KG51bGwpXG5jb25zdCBhcnJvd0VkaXRSZWYgPSByZWY8XG4gIHwgaW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtRWRpdDxcbiAgICAgIGltcG9ydCgnLi9pbmRleC52dWUnKS5BcnJvd0VkaXREYXRhLFxuICAgICAgaW1wb3J0KCcuL2luZGV4LnZ1ZScpLkFycm93RGF0YVxuICAgID5cbiAgfCBudWxsXG4+KG51bGwpXG5cbmNvbnN0IHNldFNpemUgPSAobmV3U2l6ZTogbnVtYmVyKSA9PiB7XG4gIHNpemUudmFsdWUgPSBuZXdTaXplXG59XG5cbmNvbnN0IHNldENvbG9yID0gKG5ld0NvbG9yOiBzdHJpbmcpID0+IHtcbiAgY29sb3IudmFsdWUgPSBuZXdDb2xvclxufVxuXG5jb25zdCBjaGVja2VkID0gY29tcHV0ZWQoKCkgPT4gb3BlcmF0aW9uID09PSAnQXJyb3cnKVxuXG5jb25zdCBzZWxlY3RBcnJvdyA9ICgpID0+IHtcbiAgb3BlcmF0aW9uRGlzcGF0Y2hlci5zZXQoJ0Fycm93JylcbiAgY3Vyc29yRGlzcGF0Y2hlci5zZXQoJ2RlZmF1bHQnKVxufVxuXG5jb25zdCBoYW5kbGVTZWxlY3RBcnJvdyA9ICgpID0+IHtcbiAgaWYgKGNoZWNrZWQudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuICBzZWxlY3RBcnJvdygpXG4gIGhpc3RvcnlEaXNwYXRjaGVyLmNsZWFyU2VsZWN0KClcbn1cblxuY29uc3Qgb25EcmF3U2VsZWN0ID0gKFxuICBhY3Rpb246IGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTx1bmtub3duLCB1bmtub3duPixcbiAgZTogTW91c2VFdmVudFxuKSA9PiB7XG4gIGlmIChhY3Rpb24ubmFtZSAhPT0gJ0Fycm93JyB8fCAhY2FudmFzQ29udGV4dFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3Qgc291cmNlID0gYWN0aW9uIGFzIGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTxcbiAgICBpbXBvcnQoJy4vaW5kZXgudnVlJykuQXJyb3dEYXRhLFxuICAgIGltcG9ydCgnLi9pbmRleC52dWUnKS5BcnJvd0VkaXREYXRhXG4gID5cbiAgc2VsZWN0QXJyb3coKVxuXG4gIGNvbnN0IHsgeDEsIHkxLCB4MiwgeTIgfSA9IGdldEVkaXRlZEFycm93RGF0YShzb3VyY2UpXG4gIGxldCB0eXBlOiBpbXBvcnQoJy4vaW5kZXgudnVlJykuQXJyb3dFZGl0VHlwZSA9IDAgLy8gTW92ZVxuICBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6IHgxLFxuICAgICAgeTogeTFcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gMSAvLyBNb3ZlU3RhcnRcbiAgfSBlbHNlIGlmIChcbiAgICBpc0hpdENpcmNsZShjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcywgZSwge1xuICAgICAgeDogeDIsXG4gICAgICB5OiB5MlxuICAgIH0pXG4gICkge1xuICAgIHR5cGUgPSAyIC8vIE1vdmVFbmRcbiAgfVxuXG4gIGFycm93RWRpdFJlZi52YWx1ZSA9IHtcbiAgICB0eXBlOiBIaXN0b3J5SXRlbVR5cGUuRWRpdCxcbiAgICBkYXRhOiB7XG4gICAgICB0eXBlLFxuICAgICAgeDE6IGUuY2xpZW50WCxcbiAgICAgIHkxOiBlLmNsaWVudFksXG4gICAgICB4MjogZS5jbGllbnRYLFxuICAgICAgeTI6IGUuY2xpZW50WVxuICAgIH0sXG4gICAgc291cmNlXG4gIH1cblxuICBoaXN0b3J5RGlzcGF0Y2hlci5zZWxlY3QoYWN0aW9uKVxufVxuXG5jb25zdCBvbk1vdXNlZG93biA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSB8fCBhcnJvd1JlZi52YWx1ZSB8fCAhY2FudmFzQ29udGV4dFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgeyBsZWZ0LCB0b3AgfSA9IGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzIS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICBhcnJvd1JlZi52YWx1ZSA9IHtcbiAgICBuYW1lOiAnQXJyb3cnLFxuICAgIHR5cGU6IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UsXG4gICAgZGF0YToge1xuICAgICAgc2l6ZTogc2l6ZS52YWx1ZSxcbiAgICAgIGNvbG9yOiBjb2xvci52YWx1ZSxcbiAgICAgIHgxOiBlLmNsaWVudFggLSBsZWZ0LFxuICAgICAgeTE6IGUuY2xpZW50WSAtIHRvcCxcbiAgICAgIHgyOiBlLmNsaWVudFggLSBsZWZ0LFxuICAgICAgeTI6IGUuY2xpZW50WSAtIHRvcFxuICAgIH0sXG4gICAgZWRpdEhpc3Rvcnk6IFtdLFxuICAgIGRyYXcsXG4gICAgaXNIaXRcbiAgfVxufVxuXG5jb25zdCBvbk1vdXNlbW92ZSA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSB8fCAhY2FudmFzQ29udGV4dFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG4gIGlmIChhcnJvd0VkaXRSZWYudmFsdWUpIHtcbiAgICBhcnJvd0VkaXRSZWYudmFsdWUuZGF0YS54MiA9IGUuY2xpZW50WFxuICAgIGFycm93RWRpdFJlZi52YWx1ZS5kYXRhLnkyID0gZS5jbGllbnRZXG4gICAgaWYgKGhpc3RvcnkudG9wICE9PSBhcnJvd0VkaXRSZWYudmFsdWUpIHtcbiAgICAgIGFycm93RWRpdFJlZi52YWx1ZS5zb3VyY2UuZWRpdEhpc3RvcnkucHVzaChhcnJvd0VkaXRSZWYudmFsdWUpXG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5wdXNoKGFycm93RWRpdFJlZi52YWx1ZSlcbiAgICB9IGVsc2Uge1xuICAgICAgaGlzdG9yeURpc3BhdGNoZXIuc2V0KGhpc3RvcnkpXG4gICAgfVxuICB9IGVsc2UgaWYgKGFycm93UmVmLnZhbHVlKSB7XG4gICAgY29uc3QgeyBsZWZ0LCB0b3AgfSA9IGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzIS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXG4gICAgYXJyb3dSZWYudmFsdWUuZGF0YS54MiA9IGUuY2xpZW50WCAtIGxlZnRcbiAgICBhcnJvd1JlZi52YWx1ZS5kYXRhLnkyID0gZS5jbGllbnRZIC0gdG9wXG5cbiAgICBpZiAoaGlzdG9yeS50b3AgIT09IGFycm93UmVmLnZhbHVlKSB7XG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5wdXNoKGFycm93UmVmLnZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5zZXQoaGlzdG9yeSlcbiAgICB9XG4gIH1cbn1cblxuY29uc3Qgb25Nb3VzZXVwID0gKCkgPT4ge1xuICBpZiAoIWNoZWNrZWQudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGlmIChhcnJvd1JlZi52YWx1ZSkge1xuICAgIGhpc3RvcnlEaXNwYXRjaGVyLmNsZWFyU2VsZWN0KClcbiAgfVxuXG4gIGFycm93UmVmLnZhbHVlID0gbnVsbFxuICBhcnJvd0VkaXRSZWYudmFsdWUgPSBudWxsXG59XG5cbnVzZURyYXdTZWxlY3Qob25EcmF3U2VsZWN0KVxudXNlQ2FudmFzTW91c2Vkb3duKG9uTW91c2Vkb3duKVxudXNlQ2FudmFzTW91c2Vtb3ZlKG9uTW91c2Vtb3ZlKVxudXNlQ2FudmFzTW91c2V1cChvbk1vdXNldXApXG48L3NjcmlwdD5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL29wZXJhdGlvbnMvQXJyb3cvaW5kZXgudnVlIn0=