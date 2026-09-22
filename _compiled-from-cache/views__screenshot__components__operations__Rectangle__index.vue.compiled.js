import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Rectangle/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
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
import draw, { getEditedRectangleData } from "/src/views/screenshot/components/operations/Rectangle/draw.ts";
export var RectangleEditType = /* @__PURE__ */ ((RectangleEditType2) => {
  RectangleEditType2[RectangleEditType2["Move"] = 0] = "Move";
  RectangleEditType2[RectangleEditType2["ResizeTop"] = 1] = "ResizeTop";
  RectangleEditType2[RectangleEditType2["ResizeRightTop"] = 2] = "ResizeRightTop";
  RectangleEditType2[RectangleEditType2["ResizeRight"] = 3] = "ResizeRight";
  RectangleEditType2[RectangleEditType2["ResizeRightBottom"] = 4] = "ResizeRightBottom";
  RectangleEditType2[RectangleEditType2["ResizeBottom"] = 5] = "ResizeBottom";
  RectangleEditType2[RectangleEditType2["ResizeLeftBottom"] = 6] = "ResizeLeftBottom";
  RectangleEditType2[RectangleEditType2["ResizeLeft"] = 7] = "ResizeLeft";
  RectangleEditType2[RectangleEditType2["ResizeLeftTop"] = 8] = "ResizeLeftTop";
  return RectangleEditType2;
})(RectangleEditType || {});
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "index",
  setup(__props, { expose: __expose }) {
    __expose();
    const store = useStore();
    const lang = computed(() => store.lang);
    const [history, historyDispatcher] = useHistory();
    const [operation, operationDispatcher] = useOperation();
    const [, cursorDispatcher] = useCursor();
    const canvasContextRef = useCanvasContextRef();
    const size = ref(3);
    const color = ref("#ee5126");
    const rectangleRef = ref(null);
    const rectangleEditRef = ref(null);
    const setSize = (newSize) => {
      size.value = newSize;
    };
    const setColor = (newColor) => {
      color.value = newColor;
    };
    const checked = computed(() => operation === "Rectangle");
    const selectRectangle = () => {
      operationDispatcher.set("Rectangle");
      cursorDispatcher.set("crosshair");
    };
    const handleSelectRectangle = () => {
      if (checked.value) {
        return;
      }
      selectRectangle();
      historyDispatcher.clearSelect();
    };
    const onDrawSelect = (action, e) => {
      if (action.name !== "Rectangle" || !canvasContextRef.value) {
        return;
      }
      const source = action;
      selectRectangle();
      const { x1, y1, x2, y2 } = getEditedRectangleData(source);
      let type = 0 /* Move */;
      if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: (x1 + x2) / 2,
        y: y1
      })) {
        type = 1 /* ResizeTop */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x2,
        y: y1
      })) {
        type = 2 /* ResizeRightTop */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x2,
        y: (y1 + y2) / 2
      })) {
        type = 3 /* ResizeRight */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x2,
        y: y2
      })) {
        type = 4 /* ResizeRightBottom */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: (x1 + x2) / 2,
        y: y2
      })) {
        type = 5 /* ResizeBottom */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x1,
        y: y2
      })) {
        type = 6 /* ResizeLeftBottom */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x1,
        y: (y1 + y2) / 2
      })) {
        type = 7 /* ResizeLeft */;
      } else if (isHitCircle(canvasContextRef.value.canvas, e, {
        x: x1,
        y: y1
      })) {
        type = 8 /* ResizeLeftTop */;
      }
      rectangleEditRef.value = {
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
      if (!checked.value || !canvasContextRef.value || rectangleRef.value) {
        return;
      }
      const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
      const x = e.clientX - left;
      const y = e.clientY - top;
      rectangleRef.value = {
        name: "Rectangle",
        type: HistoryItemType.Source,
        data: {
          size: size.value,
          color: color.value,
          x1: x,
          y1: y,
          x2: x,
          y2: y
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
      if (rectangleEditRef.value) {
        rectangleEditRef.value.data.x2 = e.clientX;
        rectangleEditRef.value.data.y2 = e.clientY;
        if (history.top !== rectangleEditRef.value) {
          rectangleEditRef.value.source.editHistory.push(rectangleEditRef.value);
          historyDispatcher.push(rectangleEditRef.value);
        } else {
          historyDispatcher.set(history);
        }
      } else if (rectangleRef.value) {
        const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
        const rectangleData = rectangleRef.value.data;
        rectangleData.x2 = e.clientX - left;
        rectangleData.y2 = e.clientY - top;
        if (history.top !== rectangleRef.value) {
          historyDispatcher.push(rectangleRef.value);
        } else {
          historyDispatcher.set(history);
        }
      }
    };
    const onMouseup = () => {
      if (!checked.value) {
        return;
      }
      if (rectangleRef.value) {
        historyDispatcher.clearSelect();
      }
      rectangleRef.value = null;
      rectangleEditRef.value = null;
    };
    useDrawSelect(onDrawSelect);
    useCanvasMousedown(onMousedown);
    useCanvasMousemove(onMousemove);
    useCanvasMouseup(onMouseup);
    const __returned__ = { RectangleEditType, store, lang, history, historyDispatcher, operation, operationDispatcher, cursorDispatcher, canvasContextRef, size, color, rectangleRef, rectangleEditRef, setSize, setColor, checked, selectRectangle, handleSelectRectangle, onDrawSelect, onMousedown, onMousemove, onMouseup, ScreenshotsButton, ScreenshotsSizeColor };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: $setup.lang.operation_rectangle_title,
    icon: "icon-rectangle",
    checked: $setup.checked,
    onClick: $setup.handleSelectRectangle
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
_sfc_main.__hmrId = "e37ea6f3";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Rectangle/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUFpQixRQUFRO0FBQUEsSUFDM0I7QUFFQSxrQkFBYyxZQUFZO0FBQzFCLHVCQUFtQixXQUFXO0FBQzlCLHVCQUFtQixXQUFXO0FBQzlCLHFCQUFpQixTQUFTOzs7Ozs7Ozt1QkF2UXhCLGFBY29CO0FBQUEsSUFiakIsT0FBTyxZQUFLO0FBQUEsSUFDYixNQUFLO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxTQUFPO0FBQUE7SUFFRyxRQUFNLFNBQ2YsTUFLRTtBQUFBLE1BTEYsYUFLRTtBQUFBLFFBSkMsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFFBQ1AsY0FBYTtBQUFBLFFBQ2IsZUFBYztBQUFBIiwibmFtZXMiOlsiUmVjdGFuZ2xlRWRpdFR5cGUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiaW5kZXgudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPFNjcmVlbnNob3RzQnV0dG9uXG4gICAgOnRpdGxlPVwibGFuZy5vcGVyYXRpb25fcmVjdGFuZ2xlX3RpdGxlXCJcbiAgICBpY29uPVwiaWNvbi1yZWN0YW5nbGVcIlxuICAgIDpjaGVja2VkPVwiY2hlY2tlZFwiXG4gICAgQGNsaWNrPVwiaGFuZGxlU2VsZWN0UmVjdGFuZ2xlXCJcbiAgPlxuICAgIDx0ZW1wbGF0ZSAjb3B0aW9uPlxuICAgICAgPFNjcmVlbnNob3RzU2l6ZUNvbG9yXG4gICAgICAgIDpzaXplPVwic2l6ZVwiXG4gICAgICAgIDpjb2xvcj1cImNvbG9yXCJcbiAgICAgICAgQHNpemUtY2hhbmdlPVwic2V0U2l6ZVwiXG4gICAgICAgIEBjb2xvci1jaGFuZ2U9XCJzZXRDb2xvclwiXG4gICAgICAvPlxuICAgIDwvdGVtcGxhdGU+XG4gIDwvU2NyZWVuc2hvdHNCdXR0b24+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IGxhbmc9XCJ0c1wiPlxuZXhwb3J0IGludGVyZmFjZSBSZWN0YW5nbGVEYXRhIHtcbiAgc2l6ZTogbnVtYmVyXG4gIGNvbG9yOiBzdHJpbmdcbiAgeDE6IG51bWJlclxuICB5MTogbnVtYmVyXG4gIHgyOiBudW1iZXJcbiAgeTI6IG51bWJlclxufVxuXG5leHBvcnQgZW51bSBSZWN0YW5nbGVFZGl0VHlwZSB7XG4gIE1vdmUsXG4gIFJlc2l6ZVRvcCxcbiAgUmVzaXplUmlnaHRUb3AsXG4gIFJlc2l6ZVJpZ2h0LFxuICBSZXNpemVSaWdodEJvdHRvbSxcbiAgUmVzaXplQm90dG9tLFxuICBSZXNpemVMZWZ0Qm90dG9tLFxuICBSZXNpemVMZWZ0LFxuICBSZXNpemVMZWZ0VG9wXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjdGFuZ2xlRWRpdERhdGEge1xuICB0eXBlOiBSZWN0YW5nbGVFZGl0VHlwZVxuICB4MTogbnVtYmVyXG4gIHkxOiBudW1iZXJcbiAgeDI6IG51bWJlclxuICB5MjogbnVtYmVyXG59XG48L3NjcmlwdD5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZVNjcmVlbnNob3RzQ29udGV4dCdcbmltcG9ydCB7IHVzZUhpc3RvcnkgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VIaXN0b3J5J1xuaW1wb3J0IHsgdXNlT3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlT3BlcmF0aW9uJ1xuaW1wb3J0IHsgdXNlQ3Vyc29yIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ3Vyc29yJ1xuaW1wb3J0IHsgdXNlQ2FudmFzQ29udGV4dFJlZiB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc0NvbnRleHRSZWYnXG5pbXBvcnQgdXNlQ2FudmFzTW91c2Vkb3duIGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc01vdXNlZG93bidcbmltcG9ydCB1c2VDYW52YXNNb3VzZW1vdmUgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2Vtb3ZlJ1xuaW1wb3J0IHVzZUNhbnZhc01vdXNldXAgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2V1cCdcbmltcG9ydCB1c2VEcmF3U2VsZWN0IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZURyYXdTZWxlY3QnXG5pbXBvcnQgeyBIaXN0b3J5SXRlbVR5cGUgfSBmcm9tICcuLi8uLi8uLi90eXBlcydcbmltcG9ydCB7IGlzSGl0LCBpc0hpdENpcmNsZSB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2RyYXdVdGlscydcbmltcG9ydCBTY3JlZW5zaG90c0J1dHRvbiBmcm9tICcuLi8uLi9TY3JlZW5zaG90c0J1dHRvbi52dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHNTaXplQ29sb3IgZnJvbSAnLi4vLi4vU2NyZWVuc2hvdHNTaXplQ29sb3IudnVlJ1xuaW1wb3J0IGRyYXcsIHsgZ2V0RWRpdGVkUmVjdGFuZ2xlRGF0YSB9IGZyb20gJy4vZHJhdydcblxuY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5jb25zdCBsYW5nID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUubGFuZylcbmNvbnN0IFtoaXN0b3J5LCBoaXN0b3J5RGlzcGF0Y2hlcl0gPSB1c2VIaXN0b3J5KClcbmNvbnN0IFtvcGVyYXRpb24sIG9wZXJhdGlvbkRpc3BhdGNoZXJdID0gdXNlT3BlcmF0aW9uKClcbmNvbnN0IFssIGN1cnNvckRpc3BhdGNoZXJdID0gdXNlQ3Vyc29yKClcbmNvbnN0IGNhbnZhc0NvbnRleHRSZWYgPSB1c2VDYW52YXNDb250ZXh0UmVmKClcblxuY29uc3Qgc2l6ZSA9IHJlZigzKVxuY29uc3QgY29sb3IgPSByZWYoJyNlZTUxMjYnKVxuY29uc3QgcmVjdGFuZ2xlUmVmID0gcmVmPFxuICBpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1Tb3VyY2U8UmVjdGFuZ2xlRGF0YSwgUmVjdGFuZ2xlRWRpdERhdGE+IHwgbnVsbFxuPihudWxsKVxuY29uc3QgcmVjdGFuZ2xlRWRpdFJlZiA9IHJlZjxcbiAgaW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtRWRpdDxSZWN0YW5nbGVFZGl0RGF0YSwgUmVjdGFuZ2xlRGF0YT4gfCBudWxsXG4+KG51bGwpXG5cbmNvbnN0IHNldFNpemUgPSAobmV3U2l6ZTogbnVtYmVyKSA9PiB7XG4gIHNpemUudmFsdWUgPSBuZXdTaXplXG59XG5cbmNvbnN0IHNldENvbG9yID0gKG5ld0NvbG9yOiBzdHJpbmcpID0+IHtcbiAgY29sb3IudmFsdWUgPSBuZXdDb2xvclxufVxuXG5jb25zdCBjaGVja2VkID0gY29tcHV0ZWQoKCkgPT4gb3BlcmF0aW9uID09PSAnUmVjdGFuZ2xlJylcblxuY29uc3Qgc2VsZWN0UmVjdGFuZ2xlID0gKCkgPT4ge1xuICBvcGVyYXRpb25EaXNwYXRjaGVyLnNldCgnUmVjdGFuZ2xlJylcbiAgY3Vyc29yRGlzcGF0Y2hlci5zZXQoJ2Nyb3NzaGFpcicpXG59XG5cbmNvbnN0IGhhbmRsZVNlbGVjdFJlY3RhbmdsZSA9ICgpID0+IHtcbiAgaWYgKGNoZWNrZWQudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuICBzZWxlY3RSZWN0YW5nbGUoKVxuICBoaXN0b3J5RGlzcGF0Y2hlci5jbGVhclNlbGVjdCgpXG59XG5cbmNvbnN0IG9uRHJhd1NlbGVjdCA9IChcbiAgYWN0aW9uOiBpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1Tb3VyY2U8dW5rbm93biwgdW5rbm93bj4sXG4gIGU6IE1vdXNlRXZlbnRcbikgPT4ge1xuICBpZiAoYWN0aW9uLm5hbWUgIT09ICdSZWN0YW5nbGUnIHx8ICFjYW52YXNDb250ZXh0UmVmLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBzb3VyY2UgPSBhY3Rpb24gYXMgaW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtU291cmNlPFxuICAgIFJlY3RhbmdsZURhdGEsXG4gICAgUmVjdGFuZ2xlRWRpdERhdGFcbiAgPlxuICBzZWxlY3RSZWN0YW5nbGUoKVxuXG4gIGNvbnN0IHsgeDEsIHkxLCB4MiwgeTIgfSA9IGdldEVkaXRlZFJlY3RhbmdsZURhdGEoc291cmNlKVxuXG4gIGxldCB0eXBlID0gUmVjdGFuZ2xlRWRpdFR5cGUuTW92ZVxuICBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6ICh4MSArIHgyKSAvIDIsXG4gICAgICB5OiB5MVxuICAgIH0pXG4gICkge1xuICAgIHR5cGUgPSBSZWN0YW5nbGVFZGl0VHlwZS5SZXNpemVUb3BcbiAgfSBlbHNlIGlmIChcbiAgICBpc0hpdENpcmNsZShjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcywgZSwge1xuICAgICAgeDogeDIsXG4gICAgICB5OiB5MVxuICAgIH0pXG4gICkge1xuICAgIHR5cGUgPSBSZWN0YW5nbGVFZGl0VHlwZS5SZXNpemVSaWdodFRvcFxuICB9IGVsc2UgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiB4MixcbiAgICAgIHk6ICh5MSArIHkyKSAvIDJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gUmVjdGFuZ2xlRWRpdFR5cGUuUmVzaXplUmlnaHRcbiAgfSBlbHNlIGlmIChcbiAgICBpc0hpdENpcmNsZShjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcywgZSwge1xuICAgICAgeDogeDIsXG4gICAgICB5OiB5MlxuICAgIH0pXG4gICkge1xuICAgIHR5cGUgPSBSZWN0YW5nbGVFZGl0VHlwZS5SZXNpemVSaWdodEJvdHRvbVxuICB9IGVsc2UgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiAoeDEgKyB4MikgLyAyLFxuICAgICAgeTogeTJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gUmVjdGFuZ2xlRWRpdFR5cGUuUmVzaXplQm90dG9tXG4gIH0gZWxzZSBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6IHgxLFxuICAgICAgeTogeTJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gUmVjdGFuZ2xlRWRpdFR5cGUuUmVzaXplTGVmdEJvdHRvbVxuICB9IGVsc2UgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiB4MSxcbiAgICAgIHk6ICh5MSArIHkyKSAvIDJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gUmVjdGFuZ2xlRWRpdFR5cGUuUmVzaXplTGVmdFxuICB9IGVsc2UgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiB4MSxcbiAgICAgIHk6IHkxXG4gICAgfSlcbiAgKSB7XG4gICAgdHlwZSA9IFJlY3RhbmdsZUVkaXRUeXBlLlJlc2l6ZUxlZnRUb3BcbiAgfVxuXG4gIHJlY3RhbmdsZUVkaXRSZWYudmFsdWUgPSB7XG4gICAgdHlwZTogSGlzdG9yeUl0ZW1UeXBlLkVkaXQsXG4gICAgZGF0YToge1xuICAgICAgdHlwZSxcbiAgICAgIHgxOiBlLmNsaWVudFgsXG4gICAgICB5MTogZS5jbGllbnRZLFxuICAgICAgeDI6IGUuY2xpZW50WCxcbiAgICAgIHkyOiBlLmNsaWVudFlcbiAgICB9LFxuICAgIHNvdXJjZVxuICB9XG5cbiAgaGlzdG9yeURpc3BhdGNoZXIuc2VsZWN0KGFjdGlvbilcbn1cblxuY29uc3Qgb25Nb3VzZWRvd24gPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICBpZiAoIWNoZWNrZWQudmFsdWUgfHwgIWNhbnZhc0NvbnRleHRSZWYudmFsdWUgfHwgcmVjdGFuZ2xlUmVmLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCB7IGxlZnQsIHRvcCB9ID0gY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gIGNvbnN0IHggPSBlLmNsaWVudFggLSBsZWZ0XG4gIGNvbnN0IHkgPSBlLmNsaWVudFkgLSB0b3BcbiAgcmVjdGFuZ2xlUmVmLnZhbHVlID0ge1xuICAgIG5hbWU6ICdSZWN0YW5nbGUnLFxuICAgIHR5cGU6IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UsXG4gICAgZGF0YToge1xuICAgICAgc2l6ZTogc2l6ZS52YWx1ZSxcbiAgICAgIGNvbG9yOiBjb2xvci52YWx1ZSxcbiAgICAgIHgxOiB4LFxuICAgICAgeTE6IHksXG4gICAgICB4MjogeCxcbiAgICAgIHkyOiB5XG4gICAgfSxcbiAgICBlZGl0SGlzdG9yeTogW10sXG4gICAgZHJhdyxcbiAgICBpc0hpdFxuICB9XG59XG5cbmNvbnN0IG9uTW91c2Vtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgaWYgKCFjaGVja2VkLnZhbHVlIHx8ICFjYW52YXNDb250ZXh0UmVmLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBpZiAocmVjdGFuZ2xlRWRpdFJlZi52YWx1ZSkge1xuICAgIHJlY3RhbmdsZUVkaXRSZWYudmFsdWUuZGF0YS54MiA9IGUuY2xpZW50WFxuICAgIHJlY3RhbmdsZUVkaXRSZWYudmFsdWUuZGF0YS55MiA9IGUuY2xpZW50WVxuICAgIGlmIChoaXN0b3J5LnRvcCAhPT0gcmVjdGFuZ2xlRWRpdFJlZi52YWx1ZSkge1xuICAgICAgcmVjdGFuZ2xlRWRpdFJlZi52YWx1ZS5zb3VyY2UuZWRpdEhpc3RvcnkucHVzaChyZWN0YW5nbGVFZGl0UmVmLnZhbHVlKVxuICAgICAgaGlzdG9yeURpc3BhdGNoZXIucHVzaChyZWN0YW5nbGVFZGl0UmVmLnZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5zZXQoaGlzdG9yeSlcbiAgICB9XG4gIH0gZWxzZSBpZiAocmVjdGFuZ2xlUmVmLnZhbHVlKSB7XG4gICAgY29uc3QgeyBsZWZ0LCB0b3AgfSA9IGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzIS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIGNvbnN0IHJlY3RhbmdsZURhdGEgPSByZWN0YW5nbGVSZWYudmFsdWUuZGF0YVxuICAgIHJlY3RhbmdsZURhdGEueDIgPSBlLmNsaWVudFggLSBsZWZ0XG4gICAgcmVjdGFuZ2xlRGF0YS55MiA9IGUuY2xpZW50WSAtIHRvcFxuXG4gICAgaWYgKGhpc3RvcnkudG9wICE9PSByZWN0YW5nbGVSZWYudmFsdWUpIHtcbiAgICAgIGhpc3RvcnlEaXNwYXRjaGVyLnB1c2gocmVjdGFuZ2xlUmVmLnZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5zZXQoaGlzdG9yeSlcbiAgICB9XG4gIH1cbn1cblxuY29uc3Qgb25Nb3VzZXVwID0gKCkgPT4ge1xuICBpZiAoIWNoZWNrZWQudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGlmIChyZWN0YW5nbGVSZWYudmFsdWUpIHtcbiAgICBoaXN0b3J5RGlzcGF0Y2hlci5jbGVhclNlbGVjdCgpXG4gIH1cblxuICByZWN0YW5nbGVSZWYudmFsdWUgPSBudWxsXG4gIHJlY3RhbmdsZUVkaXRSZWYudmFsdWUgPSBudWxsXG59XG5cbnVzZURyYXdTZWxlY3Qob25EcmF3U2VsZWN0KVxudXNlQ2FudmFzTW91c2Vkb3duKG9uTW91c2Vkb3duKVxudXNlQ2FudmFzTW91c2Vtb3ZlKG9uTW91c2Vtb3ZlKVxudXNlQ2FudmFzTW91c2V1cChvbk1vdXNldXApXG48L3NjcmlwdD5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL29wZXJhdGlvbnMvUmVjdGFuZ2xlL2luZGV4LnZ1ZSJ9