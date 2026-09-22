import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Text/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import { useHistory } from "/src/views/screenshot/composables/useHistory.ts";
import { useOperation } from "/src/views/screenshot/composables/useOperation.ts";
import { useCursor } from "/src/views/screenshot/composables/useCursor.ts";
import { useCanvasContextRef } from "/src/views/screenshot/composables/useCanvasContextRef.ts";
import useCanvasMousedown from "/src/views/screenshot/composables/useCanvasMousedown.ts";
import useCanvasMousemove from "/src/views/screenshot/composables/useCanvasMousemove.ts";
import useCanvasMouseup from "/src/views/screenshot/composables/useCanvasMouseup.ts";
import useDrawSelect from "/src/views/screenshot/composables/useDrawSelect.ts";
import { HistoryItemType } from "/src/views/screenshot/types.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
import ScreenshotsSizeColor from "/src/views/screenshot/components/ScreenshotsSizeColor.vue";
import ScreenshotsTextarea from "/src/views/screenshot/components/ScreenshotsTextarea/index.vue";
import { draw, isHit } from "/src/views/screenshot/components/operations/Text/draw.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "index",
  setup(__props, { expose: __expose }) {
    __expose();
    const sizes = {
      3: 18,
      6: 32,
      9: 46
    };
    const store = useStore();
    const lang = computed(() => store.lang);
    const [history, historyDispatcher] = useHistory();
    const bounds = computed(() => getValue(store.bounds));
    const [operation, operationDispatcher] = useOperation();
    const [, cursorDispatcher] = useCursor();
    const canvasContextRef = useCanvasContextRef();
    const size = ref(3);
    const color = ref("#ee5126");
    const textRef = ref(null);
    const textEditRef = ref(
      null
    );
    const textareaBounds = ref(null);
    const text = ref("");
    const checked = computed(() => operation === "Text");
    const selectText = () => {
      operationDispatcher.set("Text");
      cursorDispatcher.set("default");
    };
    const handleSelectText = () => {
      if (checked.value) {
        return;
      }
      selectText();
      historyDispatcher.clearSelect();
    };
    const handleSizeChange = (newSize) => {
      if (textRef.value) {
        textRef.value.data.size = sizes[newSize];
      }
      size.value = newSize;
    };
    const handleColorChange = (newColor) => {
      if (textRef.value) {
        textRef.value.data.color = newColor;
      }
      color.value = newColor;
    };
    const handleTextareaChange = (value) => {
      text.value = value;
      if (checked.value && textRef.value) {
        textRef.value.data.text = value;
      }
    };
    const handleTextareaBlur = () => {
      if (textRef.value && textRef.value.data.text) {
        historyDispatcher.push(textRef.value);
      }
      textRef.value = null;
      text.value = "";
      textareaBounds.value = null;
    };
    const onDrawSelect = (action, e) => {
      if (action.name !== "Text") {
        return;
      }
      selectText();
      textEditRef.value = {
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
      if (!checked.value || !canvasContextRef.value || textRef.value || !bounds.value) {
        return;
      }
      const { left, top } = canvasContextRef.value.canvas.getBoundingClientRect();
      const fontFamily = window.getComputedStyle(canvasContextRef.value.canvas).fontFamily;
      const x = e.clientX - left;
      const y = e.clientY - top;
      textRef.value = {
        name: "Text",
        type: HistoryItemType.Source,
        data: {
          size: sizes[size.value],
          color: color.value,
          fontFamily,
          x,
          y,
          text: ""
        },
        editHistory: [],
        draw,
        isHit
      };
      textareaBounds.value = {
        x: e.clientX,
        y: e.clientY,
        maxWidth: bounds.value.width - x,
        maxHeight: bounds.value.height - y
      };
    };
    const onMousemove = (e) => {
      if (!checked.value) {
        return;
      }
      if (textEditRef.value) {
        textEditRef.value.data.x2 = e.clientX;
        textEditRef.value.data.y2 = e.clientY;
        if (history.top !== textEditRef.value) {
          textEditRef.value.source.editHistory.push(textEditRef.value);
          historyDispatcher.push(textEditRef.value);
        } else {
          historyDispatcher.set(history);
        }
      }
    };
    const onMouseup = () => {
      if (!checked.value) {
        return;
      }
      textEditRef.value = null;
    };
    useDrawSelect(onDrawSelect);
    useCanvasMousedown(onMousedown);
    useCanvasMousemove(onMousemove);
    useCanvasMouseup(onMouseup);
    const __returned__ = { sizes, store, lang, history, historyDispatcher, bounds, operation, operationDispatcher, cursorDispatcher, canvasContextRef, size, color, textRef, textEditRef, textareaBounds, text, checked, selectText, handleSelectText, handleSizeChange, handleColorChange, handleTextareaChange, handleTextareaBlur, onDrawSelect, onMousedown, onMousemove, onMouseup, ScreenshotsButton, ScreenshotsSizeColor, ScreenshotsTextarea };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock, createCommentVNode as _createCommentVNode, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", null, [
    _createVNode($setup["ScreenshotsButton"], {
      title: $setup.lang.operation_text_title,
      icon: "icon-text",
      checked: $setup.checked,
      onClick: $setup.handleSelectText
    }, {
      option: _withCtx(() => [
        _createVNode($setup["ScreenshotsSizeColor"], {
          size: $setup.size,
          color: $setup.color,
          onSizeChange: $setup.handleSizeChange,
          onColorChange: $setup.handleColorChange
        }, null, 8, ["size", "color"])
      ]),
      _: 1
      /* STABLE */
    }, 8, ["title", "checked"]),
    $setup.checked && $setup.textareaBounds ? (_openBlock(), _createBlock($setup["ScreenshotsTextarea"], {
      key: 0,
      x: $setup.textareaBounds.x,
      y: $setup.textareaBounds.y,
      "max-width": $setup.textareaBounds.maxWidth,
      "max-height": $setup.textareaBounds.maxHeight,
      size: $setup.sizes[$setup.size],
      color: $setup.color,
      value: $setup.text,
      onChange: $setup.handleTextareaChange,
      onBlur: $setup.handleTextareaBlur
    }, null, 8, ["x", "y", "max-width", "max-height", "size", "color", "value"])) : _createCommentVNode("v-if", true)
  ]);
}
_sfc_main.__hmrId = "65d60e82";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Text/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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LFFBQzFDLE9BQU87QUFDTCw0QkFBa0IsSUFBSSxPQUFPO0FBQUEsUUFDL0I7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUVBLFVBQU0sWUFBWSxNQUFZO0FBQzVCLFVBQUksQ0FBQyxRQUFRLE9BQU87QUFDbEI7QUFBQSxNQUNGO0FBRUEsa0JBQVksUUFBUTtBQUFBLElBQ3RCO0FBRUEsa0JBQWMsWUFBWTtBQUMxQix1QkFBbUIsV0FBVztBQUM5Qix1QkFBbUIsV0FBVztBQUM5QixxQkFBaUIsU0FBUzs7Ozs7Ozs7dUJBaE94QixvQkE0Qk07QUFBQSxJQTNCSixhQWNvQjtBQUFBLE1BYmpCLE9BQU8sWUFBSztBQUFBLE1BQ2IsTUFBSztBQUFBLE1BQ0osU0FBUztBQUFBLE1BQ1QsU0FBTztBQUFBO01BRUcsUUFBTSxTQUNmLE1BS0U7QUFBQSxRQUxGLGFBS0U7QUFBQSxVQUpDLE1BQU07QUFBQSxVQUNOLE9BQU87QUFBQSxVQUNQLGNBQWE7QUFBQSxVQUNiLGVBQWM7QUFBQTs7Ozs7SUFLYixrQkFBVyx1Q0FEbkIsYUFXRTtBQUFBO01BVEMsR0FBRyxzQkFBZTtBQUFBLE1BQ2xCLEdBQUcsc0JBQWU7QUFBQSxNQUNsQixhQUFXLHNCQUFlO0FBQUEsTUFDMUIsY0FBWSxzQkFBZTtBQUFBLE1BQzNCLE1BQU0sYUFBTSxXQUFJO0FBQUEsTUFDaEIsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsVUFBUTtBQUFBLE1BQ1IsUUFBTTtBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJpbmRleC52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8ZGl2PlxuICAgIDxTY3JlZW5zaG90c0J1dHRvblxuICAgICAgOnRpdGxlPVwibGFuZy5vcGVyYXRpb25fdGV4dF90aXRsZVwiXG4gICAgICBpY29uPVwiaWNvbi10ZXh0XCJcbiAgICAgIDpjaGVja2VkPVwiY2hlY2tlZFwiXG4gICAgICBAY2xpY2s9XCJoYW5kbGVTZWxlY3RUZXh0XCJcbiAgICA+XG4gICAgICA8dGVtcGxhdGUgI29wdGlvbj5cbiAgICAgICAgPFNjcmVlbnNob3RzU2l6ZUNvbG9yXG4gICAgICAgICAgOnNpemU9XCJzaXplXCJcbiAgICAgICAgICA6Y29sb3I9XCJjb2xvclwiXG4gICAgICAgICAgQHNpemUtY2hhbmdlPVwiaGFuZGxlU2l6ZUNoYW5nZVwiXG4gICAgICAgICAgQGNvbG9yLWNoYW5nZT1cImhhbmRsZUNvbG9yQ2hhbmdlXCJcbiAgICAgICAgLz5cbiAgICAgIDwvdGVtcGxhdGU+XG4gICAgPC9TY3JlZW5zaG90c0J1dHRvbj5cbiAgICA8U2NyZWVuc2hvdHNUZXh0YXJlYVxuICAgICAgdi1pZj1cImNoZWNrZWQgJiYgdGV4dGFyZWFCb3VuZHNcIlxuICAgICAgOng9XCJ0ZXh0YXJlYUJvdW5kcy54XCJcbiAgICAgIDp5PVwidGV4dGFyZWFCb3VuZHMueVwiXG4gICAgICA6bWF4LXdpZHRoPVwidGV4dGFyZWFCb3VuZHMubWF4V2lkdGhcIlxuICAgICAgOm1heC1oZWlnaHQ9XCJ0ZXh0YXJlYUJvdW5kcy5tYXhIZWlnaHRcIlxuICAgICAgOnNpemU9XCJzaXplc1tzaXplXVwiXG4gICAgICA6Y29sb3I9XCJjb2xvclwiXG4gICAgICA6dmFsdWU9XCJ0ZXh0XCJcbiAgICAgIEBjaGFuZ2U9XCJoYW5kbGVUZXh0YXJlYUNoYW5nZVwiXG4gICAgICBAYmx1cj1cImhhbmRsZVRleHRhcmVhQmx1clwiXG4gICAgLz5cbiAgPC9kaXY+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgcmVmLCBjb21wdXRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHVzZVN0b3JlLCBnZXRWYWx1ZSB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZVNjcmVlbnNob3RzQ29udGV4dCdcbmltcG9ydCB7IHVzZUhpc3RvcnkgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VIaXN0b3J5J1xuaW1wb3J0IHsgdXNlT3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlT3BlcmF0aW9uJ1xuaW1wb3J0IHsgdXNlQ3Vyc29yIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ3Vyc29yJ1xuaW1wb3J0IHsgdXNlQ2FudmFzQ29udGV4dFJlZiB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc0NvbnRleHRSZWYnXG5pbXBvcnQgdXNlQ2FudmFzTW91c2Vkb3duIGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUNhbnZhc01vdXNlZG93bidcbmltcG9ydCB1c2VDYW52YXNNb3VzZW1vdmUgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2Vtb3ZlJ1xuaW1wb3J0IHVzZUNhbnZhc01vdXNldXAgZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2V1cCdcbmltcG9ydCB1c2VEcmF3U2VsZWN0IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZURyYXdTZWxlY3QnXG5pbXBvcnQgeyBIaXN0b3J5SXRlbVR5cGUgfSBmcm9tICcuLi8uLi8uLi90eXBlcydcbmltcG9ydCBTY3JlZW5zaG90c0J1dHRvbiBmcm9tICcuLi8uLi9TY3JlZW5zaG90c0J1dHRvbi52dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHNTaXplQ29sb3IgZnJvbSAnLi4vLi4vU2NyZWVuc2hvdHNTaXplQ29sb3IudnVlJ1xuaW1wb3J0IFNjcmVlbnNob3RzVGV4dGFyZWEgZnJvbSAnLi4vLi4vU2NyZWVuc2hvdHNUZXh0YXJlYS9pbmRleC52dWUnXG5pbXBvcnQgeyBkcmF3LCBpc0hpdCB9IGZyb20gJy4vZHJhdydcblxuZXhwb3J0IGludGVyZmFjZSBUZXh0RGF0YSB7XG4gIHNpemU6IG51bWJlclxuICBjb2xvcjogc3RyaW5nXG4gIGZvbnRGYW1pbHk6IHN0cmluZ1xuICB4OiBudW1iZXJcbiAgeTogbnVtYmVyXG4gIHRleHQ6IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRleHRFZGl0RGF0YSB7XG4gIHgxOiBudW1iZXJcbiAgeDI6IG51bWJlclxuICB5MTogbnVtYmVyXG4gIHkyOiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUZXh0YXJlYUJvdW5kcyB7XG4gIHg6IG51bWJlclxuICB5OiBudW1iZXJcbiAgbWF4V2lkdGg6IG51bWJlclxuICBtYXhIZWlnaHQ6IG51bWJlclxufVxuXG5jb25zdCBzaXplczogUmVjb3JkPG51bWJlciwgbnVtYmVyPiA9IHtcbiAgMzogMTgsXG4gIDY6IDMyLFxuICA5OiA0NlxufVxuXG5jb25zdCBzdG9yZSA9IHVzZVN0b3JlKClcbmNvbnN0IGxhbmcgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS5sYW5nKVxuY29uc3QgW2hpc3RvcnksIGhpc3RvcnlEaXNwYXRjaGVyXSA9IHVzZUhpc3RvcnkoKVxuY29uc3QgYm91bmRzID0gY29tcHV0ZWQoKCkgPT4gZ2V0VmFsdWUoc3RvcmUuYm91bmRzKSlcbmNvbnN0IFtvcGVyYXRpb24sIG9wZXJhdGlvbkRpc3BhdGNoZXJdID0gdXNlT3BlcmF0aW9uKClcbmNvbnN0IFssIGN1cnNvckRpc3BhdGNoZXJdID0gdXNlQ3Vyc29yKClcbmNvbnN0IGNhbnZhc0NvbnRleHRSZWYgPSB1c2VDYW52YXNDb250ZXh0UmVmKClcblxuY29uc3Qgc2l6ZSA9IHJlZigzKVxuY29uc3QgY29sb3IgPSByZWYoJyNlZTUxMjYnKVxuY29uc3QgdGV4dFJlZiA9IHJlZjxpbXBvcnQoJy4uLy4uLy4uL3R5cGVzJykuSGlzdG9yeUl0ZW1Tb3VyY2U8VGV4dERhdGEsIFRleHRFZGl0RGF0YT4gfCBudWxsPihudWxsKVxuY29uc3QgdGV4dEVkaXRSZWYgPSByZWY8aW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtRWRpdDxUZXh0RWRpdERhdGEsIFRleHREYXRhPiB8IG51bGw+KFxuICBudWxsXG4pXG5jb25zdCB0ZXh0YXJlYUJvdW5kcyA9IHJlZjxUZXh0YXJlYUJvdW5kcyB8IG51bGw+KG51bGwpXG5jb25zdCB0ZXh0ID0gcmVmPHN0cmluZz4oJycpXG5cbmNvbnN0IGNoZWNrZWQgPSBjb21wdXRlZCgoKSA9PiBvcGVyYXRpb24gPT09ICdUZXh0JylcblxuY29uc3Qgc2VsZWN0VGV4dCA9ICgpID0+IHtcbiAgb3BlcmF0aW9uRGlzcGF0Y2hlci5zZXQoJ1RleHQnKVxuICBjdXJzb3JEaXNwYXRjaGVyLnNldCgnZGVmYXVsdCcpXG59XG5cbmNvbnN0IGhhbmRsZVNlbGVjdFRleHQgPSAoKSA9PiB7XG4gIGlmIChjaGVja2VkLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgc2VsZWN0VGV4dCgpXG4gIGhpc3RvcnlEaXNwYXRjaGVyLmNsZWFyU2VsZWN0KClcbn1cblxuY29uc3QgaGFuZGxlU2l6ZUNoYW5nZSA9IChuZXdTaXplOiBudW1iZXIpID0+IHtcbiAgaWYgKHRleHRSZWYudmFsdWUpIHtcbiAgICB0ZXh0UmVmLnZhbHVlLmRhdGEuc2l6ZSA9IHNpemVzW25ld1NpemVdXG4gIH1cbiAgc2l6ZS52YWx1ZSA9IG5ld1NpemVcbn1cblxuY29uc3QgaGFuZGxlQ29sb3JDaGFuZ2UgPSAobmV3Q29sb3I6IHN0cmluZykgPT4ge1xuICBpZiAodGV4dFJlZi52YWx1ZSkge1xuICAgIHRleHRSZWYudmFsdWUuZGF0YS5jb2xvciA9IG5ld0NvbG9yXG4gIH1cbiAgY29sb3IudmFsdWUgPSBuZXdDb2xvclxufVxuXG5jb25zdCBoYW5kbGVUZXh0YXJlYUNoYW5nZSA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gIHRleHQudmFsdWUgPSB2YWx1ZVxuICBpZiAoY2hlY2tlZC52YWx1ZSAmJiB0ZXh0UmVmLnZhbHVlKSB7XG4gICAgdGV4dFJlZi52YWx1ZS5kYXRhLnRleHQgPSB2YWx1ZVxuICB9XG59XG5cbmNvbnN0IGhhbmRsZVRleHRhcmVhQmx1ciA9ICgpID0+IHtcbiAgaWYgKHRleHRSZWYudmFsdWUgJiYgdGV4dFJlZi52YWx1ZS5kYXRhLnRleHQpIHtcbiAgICBoaXN0b3J5RGlzcGF0Y2hlci5wdXNoKHRleHRSZWYudmFsdWUpXG4gIH1cbiAgdGV4dFJlZi52YWx1ZSA9IG51bGxcbiAgdGV4dC52YWx1ZSA9ICcnXG4gIHRleHRhcmVhQm91bmRzLnZhbHVlID0gbnVsbFxufVxuXG5jb25zdCBvbkRyYXdTZWxlY3QgPSAoXG4gIGFjdGlvbjogaW1wb3J0KCcuLi8uLi8uLi90eXBlcycpLkhpc3RvcnlJdGVtU291cmNlPHVua25vd24sIHVua25vd24+LFxuICBlOiBNb3VzZUV2ZW50XG4pID0+IHtcbiAgaWYgKGFjdGlvbi5uYW1lICE9PSAnVGV4dCcpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIHNlbGVjdFRleHQoKVxuXG4gIHRleHRFZGl0UmVmLnZhbHVlID0ge1xuICAgIHR5cGU6IEhpc3RvcnlJdGVtVHlwZS5FZGl0LFxuICAgIGRhdGE6IHtcbiAgICAgIHgxOiBlLmNsaWVudFgsXG4gICAgICB5MTogZS5jbGllbnRZLFxuICAgICAgeDI6IGUuY2xpZW50WCxcbiAgICAgIHkyOiBlLmNsaWVudFlcbiAgICB9LFxuICAgIHNvdXJjZTogYWN0aW9uIGFzIGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTxUZXh0RGF0YSwgVGV4dEVkaXREYXRhPlxuICB9XG5cbiAgaGlzdG9yeURpc3BhdGNoZXIuc2VsZWN0KGFjdGlvbilcbn1cblxuY29uc3Qgb25Nb3VzZWRvd24gPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICBpZiAoIWNoZWNrZWQudmFsdWUgfHwgIWNhbnZhc0NvbnRleHRSZWYudmFsdWUgfHwgdGV4dFJlZi52YWx1ZSB8fCAhYm91bmRzLnZhbHVlKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgY29uc3QgeyBsZWZ0LCB0b3AgfSA9IGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzIS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICBjb25zdCBmb250RmFtaWx5ID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoY2FudmFzQ29udGV4dFJlZi52YWx1ZS5jYW52YXMhKS5mb250RmFtaWx5XG4gIGNvbnN0IHggPSBlLmNsaWVudFggLSBsZWZ0XG4gIGNvbnN0IHkgPSBlLmNsaWVudFkgLSB0b3BcblxuICB0ZXh0UmVmLnZhbHVlID0ge1xuICAgIG5hbWU6ICdUZXh0JyxcbiAgICB0eXBlOiBIaXN0b3J5SXRlbVR5cGUuU291cmNlLFxuICAgIGRhdGE6IHtcbiAgICAgIHNpemU6IHNpemVzW3NpemUudmFsdWVdLFxuICAgICAgY29sb3I6IGNvbG9yLnZhbHVlLFxuICAgICAgZm9udEZhbWlseSxcbiAgICAgIHgsXG4gICAgICB5LFxuICAgICAgdGV4dDogJydcbiAgICB9LFxuICAgIGVkaXRIaXN0b3J5OiBbXSxcbiAgICBkcmF3LFxuICAgIGlzSGl0XG4gIH1cblxuICB0ZXh0YXJlYUJvdW5kcy52YWx1ZSA9IHtcbiAgICB4OiBlLmNsaWVudFgsXG4gICAgeTogZS5jbGllbnRZLFxuICAgIG1heFdpZHRoOiBib3VuZHMudmFsdWUud2lkdGggLSB4LFxuICAgIG1heEhlaWdodDogYm91bmRzLnZhbHVlLmhlaWdodCAtIHlcbiAgfVxufVxuXG5jb25zdCBvbk1vdXNlbW92ZSA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgaWYgKHRleHRFZGl0UmVmLnZhbHVlKSB7XG4gICAgdGV4dEVkaXRSZWYudmFsdWUuZGF0YS54MiA9IGUuY2xpZW50WFxuICAgIHRleHRFZGl0UmVmLnZhbHVlLmRhdGEueTIgPSBlLmNsaWVudFlcbiAgICBpZiAoaGlzdG9yeS50b3AgIT09IHRleHRFZGl0UmVmLnZhbHVlKSB7XG4gICAgICB0ZXh0RWRpdFJlZi52YWx1ZS5zb3VyY2UuZWRpdEhpc3RvcnkucHVzaCh0ZXh0RWRpdFJlZi52YWx1ZSlcbiAgICAgIGhpc3RvcnlEaXNwYXRjaGVyLnB1c2godGV4dEVkaXRSZWYudmFsdWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIGhpc3RvcnlEaXNwYXRjaGVyLnNldChoaXN0b3J5KVxuICAgIH1cbiAgfVxufVxuXG5jb25zdCBvbk1vdXNldXAgPSAoKTogdm9pZCA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgdGV4dEVkaXRSZWYudmFsdWUgPSBudWxsXG59XG5cbnVzZURyYXdTZWxlY3Qob25EcmF3U2VsZWN0KVxudXNlQ2FudmFzTW91c2Vkb3duKG9uTW91c2Vkb3duKVxudXNlQ2FudmFzTW91c2Vtb3ZlKG9uTW91c2Vtb3ZlKVxudXNlQ2FudmFzTW91c2V1cChvbk1vdXNldXApXG48L3NjcmlwdD5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL29wZXJhdGlvbnMvVGV4dC9pbmRleC52dWUifQ==