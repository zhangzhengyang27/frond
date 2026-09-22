import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Ellipse/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
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
import draw, { getEditedEllipseData } from "/src/views/screenshot/components/operations/Ellipse/draw.ts";
export var EllipseEditType = /* @__PURE__ */ ((EllipseEditType2) => {
  EllipseEditType2[EllipseEditType2["Move"] = 0] = "Move";
  EllipseEditType2[EllipseEditType2["ResizeTop"] = 1] = "ResizeTop";
  EllipseEditType2[EllipseEditType2["ResizeRightTop"] = 2] = "ResizeRightTop";
  EllipseEditType2[EllipseEditType2["ResizeRight"] = 3] = "ResizeRight";
  EllipseEditType2[EllipseEditType2["ResizeRightBottom"] = 4] = "ResizeRightBottom";
  EllipseEditType2[EllipseEditType2["ResizeBottom"] = 5] = "ResizeBottom";
  EllipseEditType2[EllipseEditType2["ResizeLeftBottom"] = 6] = "ResizeLeftBottom";
  EllipseEditType2[EllipseEditType2["ResizeLeft"] = 7] = "ResizeLeft";
  EllipseEditType2[EllipseEditType2["ResizeLeftTop"] = 8] = "ResizeLeftTop";
  return EllipseEditType2;
})(EllipseEditType || {});
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
    const ellipseRef = ref(null);
    const ellipseEditRef = ref(null);
    const setSize = (newSize) => {
      size.value = newSize;
    };
    const setColor = (newColor) => {
      color.value = newColor;
    };
    const checked = computed(() => operation === "Ellipse");
    const selectEllipse = () => {
      operationDispatcher.set("Ellipse");
      cursorDispatcher.set("crosshair");
    };
    const handleSelectEllipse = () => {
      if (checked.value) {
        return;
      }
      selectEllipse();
      historyDispatcher.clearSelect();
    };
    const onDrawSelect = (action, e) => {
      if (action.name !== "Ellipse" || !canvasContextRef.value) {
        return;
      }
      const source = action;
      selectEllipse();
      const { x1, y1, x2, y2 } = getEditedEllipseData(source);
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
      ellipseEditRef.value = {
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
      if (!checked.value || !canvasContextRef.value || ellipseRef.value) {
        return;
      }
      const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
      const x = e.clientX - left;
      const y = e.clientY - top;
      ellipseRef.value = {
        name: "Ellipse",
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
      if (ellipseEditRef.value) {
        ellipseEditRef.value.data.x2 = e.clientX;
        ellipseEditRef.value.data.y2 = e.clientY;
        if (history.top !== ellipseEditRef.value) {
          ellipseEditRef.value.source.editHistory.push(ellipseEditRef.value);
          historyDispatcher.push(ellipseEditRef.value);
        } else {
          historyDispatcher.set(history);
        }
      } else if (ellipseRef.value) {
        const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
        ellipseRef.value.data.x2 = e.clientX - left;
        ellipseRef.value.data.y2 = e.clientY - top;
        if (history.top !== ellipseRef.value) {
          historyDispatcher.push(ellipseRef.value);
        } else {
          historyDispatcher.set(history);
        }
      }
    };
    const onMouseup = () => {
      if (!checked.value) {
        return;
      }
      if (ellipseRef.value) {
        historyDispatcher.clearSelect();
      }
      ellipseRef.value = null;
      ellipseEditRef.value = null;
    };
    useDrawSelect(onDrawSelect);
    useCanvasMousedown(onMousedown);
    useCanvasMousemove(onMousemove);
    useCanvasMouseup(onMouseup);
    const __returned__ = { EllipseEditType, store, lang, history, historyDispatcher, operation, operationDispatcher, cursorDispatcher, canvasContextRef, size, color, ellipseRef, ellipseEditRef, setSize, setColor, checked, selectEllipse, handleSelectEllipse, onDrawSelect, onMousedown, onMousemove, onMouseup, ScreenshotsButton, ScreenshotsSizeColor };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: $setup.lang.operation_ellipse_title,
    icon: "icon-ellipse",
    checked: $setup.checked,
    onClick: $setup.handleSelectEllipse
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
_sfc_main.__hmrId = "0f5c65d6";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Ellipse/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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LGtCQUFjLFlBQVk7QUFDMUIsdUJBQW1CLFdBQVc7QUFDOUIsdUJBQW1CLFdBQVc7QUFDOUIscUJBQWlCLFNBQVM7Ozs7Ozs7O3VCQWxReEIsYUFjb0I7QUFBQSxJQWJqQixPQUFPLFlBQUs7QUFBQSxJQUNiLE1BQUs7QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULFNBQU87QUFBQTtJQUVHLFFBQU0sU0FDZixNQUtFO0FBQUEsTUFMRixhQUtFO0FBQUEsUUFKQyxNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxjQUFhO0FBQUEsUUFDYixlQUFjO0FBQUEiLCJuYW1lcyI6WyJFbGxpcHNlRWRpdFR5cGUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiaW5kZXgudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPFNjcmVlbnNob3RzQnV0dG9uXG4gICAgOnRpdGxlPVwibGFuZy5vcGVyYXRpb25fZWxsaXBzZV90aXRsZVwiXG4gICAgaWNvbj1cImljb24tZWxsaXBzZVwiXG4gICAgOmNoZWNrZWQ9XCJjaGVja2VkXCJcbiAgICBAY2xpY2s9XCJoYW5kbGVTZWxlY3RFbGxpcHNlXCJcbiAgPlxuICAgIDx0ZW1wbGF0ZSAjb3B0aW9uPlxuICAgICAgPFNjcmVlbnNob3RzU2l6ZUNvbG9yXG4gICAgICAgIDpzaXplPVwic2l6ZVwiXG4gICAgICAgIDpjb2xvcj1cImNvbG9yXCJcbiAgICAgICAgQHNpemUtY2hhbmdlPVwic2V0U2l6ZVwiXG4gICAgICAgIEBjb2xvci1jaGFuZ2U9XCJzZXRDb2xvclwiXG4gICAgICAvPlxuICAgIDwvdGVtcGxhdGU+XG4gIDwvU2NyZWVuc2hvdHNCdXR0b24+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IGxhbmc9XCJ0c1wiPlxuZXhwb3J0IGludGVyZmFjZSBFbGxpcHNlRGF0YSB7XG4gIHNpemU6IG51bWJlclxuICBjb2xvcjogc3RyaW5nXG4gIHgxOiBudW1iZXJcbiAgeTE6IG51bWJlclxuICB4MjogbnVtYmVyXG4gIHkyOiBudW1iZXJcbn1cblxuZXhwb3J0IGVudW0gRWxsaXBzZUVkaXRUeXBlIHtcbiAgTW92ZSxcbiAgUmVzaXplVG9wLFxuICBSZXNpemVSaWdodFRvcCxcbiAgUmVzaXplUmlnaHQsXG4gIFJlc2l6ZVJpZ2h0Qm90dG9tLFxuICBSZXNpemVCb3R0b20sXG4gIFJlc2l6ZUxlZnRCb3R0b20sXG4gIFJlc2l6ZUxlZnQsXG4gIFJlc2l6ZUxlZnRUb3Bcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbGxpcHNlRWRpdERhdGEge1xuICB0eXBlOiBFbGxpcHNlRWRpdFR5cGVcbiAgeDE6IG51bWJlclxuICB5MTogbnVtYmVyXG4gIHgyOiBudW1iZXJcbiAgeTI6IG51bWJlclxufVxuPC9zY3JpcHQ+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyByZWYsIGNvbXB1dGVkIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgdXNlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VTY3JlZW5zaG90c0NvbnRleHQnXG5pbXBvcnQgeyB1c2VIaXN0b3J5IH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlSGlzdG9yeSdcbmltcG9ydCB7IHVzZU9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZU9wZXJhdGlvbidcbmltcG9ydCB7IHVzZUN1cnNvciB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUN1cnNvcidcbmltcG9ydCB7IHVzZUNhbnZhc0NvbnRleHRSZWYgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDYW52YXNDb250ZXh0UmVmJ1xuaW1wb3J0IHVzZUNhbnZhc01vdXNlZG93biBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDYW52YXNNb3VzZWRvd24nXG5pbXBvcnQgdXNlQ2FudmFzTW91c2Vtb3ZlIGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc01vdXNlbW92ZSdcbmltcG9ydCB1c2VDYW52YXNNb3VzZXVwIGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc01vdXNldXAnXG5pbXBvcnQgdXNlRHJhd1NlbGVjdCBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VEcmF3U2VsZWN0J1xuaW1wb3J0IHsgSGlzdG9yeUl0ZW1UeXBlIH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMnXG5pbXBvcnQgeyBpc0hpdCwgaXNIaXRDaXJjbGUgfSBmcm9tICcuLi8uLi8uLi91dGlscy9kcmF3VXRpbHMnXG5pbXBvcnQgU2NyZWVuc2hvdHNCdXR0b24gZnJvbSAnLi4vLi4vU2NyZWVuc2hvdHNCdXR0b24udnVlJ1xuaW1wb3J0IFNjcmVlbnNob3RzU2l6ZUNvbG9yIGZyb20gJy4uLy4uL1NjcmVlbnNob3RzU2l6ZUNvbG9yLnZ1ZSdcbmltcG9ydCBkcmF3LCB7IGdldEVkaXRlZEVsbGlwc2VEYXRhIH0gZnJvbSAnLi9kcmF3J1xuXG5jb25zdCBzdG9yZSA9IHVzZVN0b3JlKClcbmNvbnN0IGxhbmcgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS5sYW5nKVxuY29uc3QgW2hpc3RvcnksIGhpc3RvcnlEaXNwYXRjaGVyXSA9IHVzZUhpc3RvcnkoKVxuY29uc3QgW29wZXJhdGlvbiwgb3BlcmF0aW9uRGlzcGF0Y2hlcl0gPSB1c2VPcGVyYXRpb24oKVxuY29uc3QgWywgY3Vyc29yRGlzcGF0Y2hlcl0gPSB1c2VDdXJzb3IoKVxuY29uc3QgY2FudmFzQ29udGV4dFJlZiA9IHVzZUNhbnZhc0NvbnRleHRSZWYoKVxuXG5jb25zdCBzaXplID0gcmVmKDMpXG5jb25zdCBjb2xvciA9IHJlZignI2VlNTEyNicpXG5jb25zdCBlbGxpcHNlUmVmID0gcmVmPFxuICBpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1Tb3VyY2U8RWxsaXBzZURhdGEsIEVsbGlwc2VFZGl0RGF0YT4gfCBudWxsXG4+KG51bGwpXG5jb25zdCBlbGxpcHNlRWRpdFJlZiA9IHJlZjxcbiAgaW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtRWRpdDxFbGxpcHNlRWRpdERhdGEsIEVsbGlwc2VEYXRhPiB8IG51bGxcbj4obnVsbClcblxuY29uc3Qgc2V0U2l6ZSA9IChuZXdTaXplOiBudW1iZXIpID0+IHtcbiAgc2l6ZS52YWx1ZSA9IG5ld1NpemVcbn1cblxuY29uc3Qgc2V0Q29sb3IgPSAobmV3Q29sb3I6IHN0cmluZykgPT4ge1xuICBjb2xvci52YWx1ZSA9IG5ld0NvbG9yXG59XG5cbmNvbnN0IGNoZWNrZWQgPSBjb21wdXRlZCgoKSA9PiBvcGVyYXRpb24gPT09ICdFbGxpcHNlJylcblxuY29uc3Qgc2VsZWN0RWxsaXBzZSA9ICgpID0+IHtcbiAgb3BlcmF0aW9uRGlzcGF0Y2hlci5zZXQoJ0VsbGlwc2UnKVxuICBjdXJzb3JEaXNwYXRjaGVyLnNldCgnY3Jvc3NoYWlyJylcbn1cblxuY29uc3QgaGFuZGxlU2VsZWN0RWxsaXBzZSA9ICgpID0+IHtcbiAgaWYgKGNoZWNrZWQudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuICBzZWxlY3RFbGxpcHNlKClcbiAgaGlzdG9yeURpc3BhdGNoZXIuY2xlYXJTZWxlY3QoKVxufVxuXG5jb25zdCBvbkRyYXdTZWxlY3QgPSAoXG4gIGFjdGlvbjogaW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtU291cmNlPHVua25vd24sIHVua25vd24+LFxuICBlOiBNb3VzZUV2ZW50XG4pID0+IHtcbiAgaWYgKGFjdGlvbi5uYW1lICE9PSAnRWxsaXBzZScgfHwgIWNhbnZhc0NvbnRleHRSZWYudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IHNvdXJjZSA9IGFjdGlvbiBhcyBpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1Tb3VyY2U8RWxsaXBzZURhdGEsIEVsbGlwc2VFZGl0RGF0YT5cbiAgc2VsZWN0RWxsaXBzZSgpXG5cbiAgY29uc3QgeyB4MSwgeTEsIHgyLCB5MiB9ID0gZ2V0RWRpdGVkRWxsaXBzZURhdGEoc291cmNlKVxuXG4gIGxldCB0eXBlID0gRWxsaXBzZUVkaXRUeXBlLk1vdmVcbiAgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiAoeDEgKyB4MikgLyAyLFxuICAgICAgeTogeTFcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gRWxsaXBzZUVkaXRUeXBlLlJlc2l6ZVRvcFxuICB9IGVsc2UgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiB4MixcbiAgICAgIHk6IHkxXG4gICAgfSlcbiAgKSB7XG4gICAgdHlwZSA9IEVsbGlwc2VFZGl0VHlwZS5SZXNpemVSaWdodFRvcFxuICB9IGVsc2UgaWYgKFxuICAgIGlzSGl0Q2lyY2xlKGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzLCBlLCB7XG4gICAgICB4OiB4MixcbiAgICAgIHk6ICh5MSArIHkyKSAvIDJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gRWxsaXBzZUVkaXRUeXBlLlJlc2l6ZVJpZ2h0XG4gIH0gZWxzZSBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6IHgyLFxuICAgICAgeTogeTJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gRWxsaXBzZUVkaXRUeXBlLlJlc2l6ZVJpZ2h0Qm90dG9tXG4gIH0gZWxzZSBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6ICh4MSArIHgyKSAvIDIsXG4gICAgICB5OiB5MlxuICAgIH0pXG4gICkge1xuICAgIHR5cGUgPSBFbGxpcHNlRWRpdFR5cGUuUmVzaXplQm90dG9tXG4gIH0gZWxzZSBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6IHgxLFxuICAgICAgeTogeTJcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gRWxsaXBzZUVkaXRUeXBlLlJlc2l6ZUxlZnRCb3R0b21cbiAgfSBlbHNlIGlmIChcbiAgICBpc0hpdENpcmNsZShjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcywgZSwge1xuICAgICAgeDogeDEsXG4gICAgICB5OiAoeTEgKyB5MikgLyAyXG4gICAgfSlcbiAgKSB7XG4gICAgdHlwZSA9IEVsbGlwc2VFZGl0VHlwZS5SZXNpemVMZWZ0XG4gIH0gZWxzZSBpZiAoXG4gICAgaXNIaXRDaXJjbGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMsIGUsIHtcbiAgICAgIHg6IHgxLFxuICAgICAgeTogeTFcbiAgICB9KVxuICApIHtcbiAgICB0eXBlID0gRWxsaXBzZUVkaXRUeXBlLlJlc2l6ZUxlZnRUb3BcbiAgfVxuXG4gIGVsbGlwc2VFZGl0UmVmLnZhbHVlID0ge1xuICAgIHR5cGU6IEhpc3RvcnlJdGVtVHlwZS5FZGl0LFxuICAgIGRhdGE6IHtcbiAgICAgIHR5cGUsXG4gICAgICB4MTogZS5jbGllbnRYLFxuICAgICAgeTE6IGUuY2xpZW50WSxcbiAgICAgIHgyOiBlLmNsaWVudFgsXG4gICAgICB5MjogZS5jbGllbnRZXG4gICAgfSxcbiAgICBzb3VyY2VcbiAgfVxuXG4gIGhpc3RvcnlEaXNwYXRjaGVyLnNlbGVjdChhY3Rpb24pXG59XG5cbmNvbnN0IG9uTW91c2Vkb3duID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgaWYgKCFjaGVja2VkLnZhbHVlIHx8ICFjYW52YXNDb250ZXh0UmVmLnZhbHVlIHx8IGVsbGlwc2VSZWYudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IHsgbGVmdCwgdG9wIH0gPSBjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcyEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgY29uc3QgeCA9IGUuY2xpZW50WCAtIGxlZnRcbiAgY29uc3QgeSA9IGUuY2xpZW50WSAtIHRvcFxuICBlbGxpcHNlUmVmLnZhbHVlID0ge1xuICAgIG5hbWU6ICdFbGxpcHNlJyxcbiAgICB0eXBlOiBIaXN0b3J5SXRlbVR5cGUuU291cmNlLFxuICAgIGRhdGE6IHtcbiAgICAgIHNpemU6IHNpemUudmFsdWUsXG4gICAgICBjb2xvcjogY29sb3IudmFsdWUsXG4gICAgICB4MTogeCxcbiAgICAgIHkxOiB5LFxuICAgICAgeDI6IHgsXG4gICAgICB5MjogeVxuICAgIH0sXG4gICAgZWRpdEhpc3Rvcnk6IFtdLFxuICAgIGRyYXcsXG4gICAgaXNIaXRcbiAgfVxufVxuXG5jb25zdCBvbk1vdXNlbW92ZSA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSB8fCAhY2FudmFzQ29udGV4dFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG4gIGlmIChlbGxpcHNlRWRpdFJlZi52YWx1ZSkge1xuICAgIGVsbGlwc2VFZGl0UmVmLnZhbHVlLmRhdGEueDIgPSBlLmNsaWVudFhcbiAgICBlbGxpcHNlRWRpdFJlZi52YWx1ZS5kYXRhLnkyID0gZS5jbGllbnRZXG4gICAgaWYgKGhpc3RvcnkudG9wICE9PSBlbGxpcHNlRWRpdFJlZi52YWx1ZSkge1xuICAgICAgZWxsaXBzZUVkaXRSZWYudmFsdWUuc291cmNlLmVkaXRIaXN0b3J5LnB1c2goZWxsaXBzZUVkaXRSZWYudmFsdWUpXG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5wdXNoKGVsbGlwc2VFZGl0UmVmLnZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXN0b3J5RGlzcGF0Y2hlci5zZXQoaGlzdG9yeSlcbiAgICB9XG4gIH0gZWxzZSBpZiAoZWxsaXBzZVJlZi52YWx1ZSkge1xuICAgIGNvbnN0IHsgbGVmdCwgdG9wIH0gPSBjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcyEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgICBlbGxpcHNlUmVmLnZhbHVlLmRhdGEueDIgPSBlLmNsaWVudFggLSBsZWZ0XG4gICAgZWxsaXBzZVJlZi52YWx1ZS5kYXRhLnkyID0gZS5jbGllbnRZIC0gdG9wXG5cbiAgICBpZiAoaGlzdG9yeS50b3AgIT09IGVsbGlwc2VSZWYudmFsdWUpIHtcbiAgICAgIGhpc3RvcnlEaXNwYXRjaGVyLnB1c2goZWxsaXBzZVJlZi52YWx1ZSlcbiAgICB9IGVsc2Uge1xuICAgICAgaGlzdG9yeURpc3BhdGNoZXIuc2V0KGhpc3RvcnkpXG4gICAgfVxuICB9XG59XG5cbmNvbnN0IG9uTW91c2V1cCA9ICgpID0+IHtcbiAgaWYgKCFjaGVja2VkLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBpZiAoZWxsaXBzZVJlZi52YWx1ZSkge1xuICAgIGhpc3RvcnlEaXNwYXRjaGVyLmNsZWFyU2VsZWN0KClcbiAgfVxuXG4gIGVsbGlwc2VSZWYudmFsdWUgPSBudWxsXG4gIGVsbGlwc2VFZGl0UmVmLnZhbHVlID0gbnVsbFxufVxuXG51c2VEcmF3U2VsZWN0KG9uRHJhd1NlbGVjdClcbnVzZUNhbnZhc01vdXNlZG93bihvbk1vdXNlZG93bilcbnVzZUNhbnZhc01vdXNlbW92ZShvbk1vdXNlbW92ZSlcbnVzZUNhbnZhc01vdXNldXAob25Nb3VzZXVwKVxuPC9zY3JpcHQ+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9vcGVyYXRpb25zL0VsbGlwc2UvaW5kZXgudnVlIn0=