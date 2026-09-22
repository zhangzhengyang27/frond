import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/ScreenshotsOperations.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, watch, computed, provide } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import Ok from "/src/views/screenshot/components/operations/Ok.vue";
import Cancel from "/src/views/screenshot/components/operations/Cancel.vue";
import Save from "/src/views/screenshot/components/operations/Save.vue";
import Undo from "/src/views/screenshot/components/operations/Undo.vue";
import Redo from "/src/views/screenshot/components/operations/Redo.vue";
import Rectangle from "/src/views/screenshot/components/operations/Rectangle/index.vue";
import Ellipse from "/src/views/screenshot/components/operations/Ellipse/index.vue";
import Arrow from "/src/views/screenshot/components/operations/Arrow/index.vue";
import Brush from "/src/views/screenshot/components/operations/Brush/index.vue";
import Text from "/src/views/screenshot/components/operations/Text/index.vue";
import Mosaic from "/src/views/screenshot/components/operations/Mosaic/index.vue";
import Pin from "/src/views/screenshot/components/operations/Pin.vue";
import Ocr from "/src/views/screenshot/components/operations/Ocr.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ScreenshotsOperations",
  emits: ["ok", "cancel", "save", "pin", "ocr"],
  setup(__props, { expose: __expose, emit: __emit }) {
    __expose();
    const store = useStore();
    const width = computed(() => store.width);
    const height = computed(() => store.height);
    const bounds = computed(() => getValue(store.bounds));
    const elRef = ref(null);
    const position = ref(null);
    const operationsRect = ref(null);
    provide("ScreenshotsOperationsRect", operationsRect);
    const emit = __emit;
    const handleOk = (blob, bounds2) => {
      emit("ok", blob, bounds2);
    };
    const handleCancel = () => {
      emit("cancel");
    };
    const handleSave = (blob, bounds2) => {
      emit("save", blob, bounds2);
    };
    const handlePin = () => {
      emit("pin", null, bounds.value);
    };
    const handleOcr = () => {
      emit("ocr", null, bounds.value);
    };
    watch(
      () => [bounds.value, elRef.value],
      () => {
        if (!bounds.value || !elRef.value) {
          return;
        }
        const elRect = elRef.value.getBoundingClientRect();
        let x = bounds.value.x + bounds.value.width - elRect.width;
        let y = bounds.value.y + bounds.value.height + 10;
        if (x < 0) {
          x = 0;
        }
        if (x > width.value - elRect.width) {
          x = width.value - elRect.width;
        }
        if (y > height.value - elRect.height) {
          y = height.value - elRect.height - 10;
        }
        if (!position.value || Math.abs(position.value.x - x) > 1 || Math.abs(position.value.y - y) > 1) {
          position.value = {
            x,
            y
          };
        }
        if (!operationsRect.value || Math.abs(operationsRect.value.x - elRect.x) > 1 || Math.abs(operationsRect.value.y - elRect.y) > 1 || Math.abs(operationsRect.value.width - elRect.width) > 1 || Math.abs(operationsRect.value.height - elRect.height) > 1) {
          operationsRect.value = {
            x: elRect.x,
            y: elRect.y,
            width: elRect.width,
            height: elRect.height
          };
        }
      },
      { immediate: true }
    );
    const __returned__ = { store, width, height, bounds, elRef, position, operationsRect, emit, handleOk, handleCancel, handleSave, handlePin, handleOcr, Ok, Cancel, Save, Undo, Redo, Rectangle, Ellipse, Arrow, Brush, Text, Mosaic, Pin, Ocr };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, createElementVNode as _createElementVNode, withModifiers as _withModifiers, normalizeStyle as _normalizeStyle, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "screenshots-operations-buttons" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return $setup.bounds ? (_openBlock(), _createElementBlock(
    "div",
    {
      key: 0,
      ref: "elRef",
      class: "screenshots-operations",
      style: _normalizeStyle({
        visibility: $setup.position ? "visible" : "hidden",
        transform: `translate(${$setup.position?.x ?? 0}px, ${$setup.position?.y ?? 0}px)`
      }),
      onDblclick: _cache[0] || (_cache[0] = _withModifiers(() => {
      }, ["stop"])),
      onContextmenu: _cache[1] || (_cache[1] = _withModifiers(() => {
      }, ["prevent", "stop"]))
    },
    [
      _createElementVNode("div", _hoisted_1, [
        _createVNode($setup["Rectangle"]),
        _createVNode($setup["Ellipse"]),
        _createVNode($setup["Arrow"]),
        _createVNode($setup["Brush"]),
        _createVNode($setup["Text"]),
        _createVNode($setup["Mosaic"]),
        _cache[2] || (_cache[2] = _createElementVNode(
          "div",
          { class: "screenshots-operations-divider" },
          null,
          -1
          /* CACHED */
        )),
        _createVNode($setup["Ocr"], { onOcr: $setup.handleOcr }),
        _createVNode($setup["Pin"], { onPin: $setup.handlePin }),
        _createVNode($setup["Ok"], { onOk: $setup.handleOk }),
        _createVNode($setup["Cancel"], { onCancel: $setup.handleCancel }),
        _createVNode($setup["Save"], { onSave: $setup.handleSave }),
        _cache[3] || (_cache[3] = _createElementVNode(
          "div",
          { class: "screenshots-operations-divider" },
          null,
          -1
          /* CACHED */
        )),
        _createVNode($setup["Undo"]),
        _createVNode($setup["Redo"])
      ])
    ],
    36
    /* STYLE, NEED_HYDRATION */
  )) : _createCommentVNode("v-if", true);
}
import "/src/views/screenshot/components/ScreenshotsOperations.vue?vue&type=style&index=0&scoped=48a1535e&lang.css";
_sfc_main.__hmrId = "48a1535e";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-48a1535e"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/ScreenshotsOperations.vue"]]);

//# sourceMappingURL=data:application/json;base64,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RjtBQUFBLE1BQ0EsRUFBRSxXQUFXLEtBQUs7QUFBQSxJQUNwQjs7Ozs7OztxQkFoSVMsT0FBTSxpQ0FBZ0M7O1NBVnJDLCtCQURSO0FBQUEsSUE0Qk07QUFBQTtBQUFBO01BMUJKLEtBQUk7QUFBQSxNQUNKLE9BQU07QUFBQSxNQUNMLE9BQUs7QUFBQSxvQkFBc0Isa0JBQVE7QUFBQSxnQ0FBdUQsaUJBQVUsS0FBQyxRQUFZLGlCQUFVLEtBQUM7QUFBQTtNQUk1SCxZQUFRLHlDQUFUO0FBQUEsU0FBYztBQUFBLE1BQ2IsZUFBVyx5Q0FBWjtBQUFBLFNBQXlCO0FBQUE7O01BRXpCLG9CQWdCTSxPQWhCTixZQWdCTTtBQUFBLFFBZkosYUFBYTtBQUFBLFFBQ2IsYUFBVztBQUFBLFFBQ1gsYUFBUztBQUFBLFFBQ1QsYUFBUztBQUFBLFFBQ1QsYUFBUTtBQUFBLFFBQ1IsYUFBVTtBQUFBLGtDQUNWO0FBQUEsVUFBOEM7QUFBQSxZQUF6QyxPQUFNLGlDQUFnQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFDM0MsYUFBd0IsaUJBQWxCLE9BQUssaUJBQVM7QUFBQSxRQUNwQixhQUF3QixpQkFBbEIsT0FBSyxpQkFBUztBQUFBLFFBQ3BCLGFBQXFCLGdCQUFoQixNQUFJLGdCQUFRO0FBQUEsUUFDakIsYUFBaUMsb0JBQXhCLFVBQVEsb0JBQVk7QUFBQSxRQUM3QixhQUEyQixrQkFBcEIsUUFBTSxrQkFBVTtBQUFBLGtDQUN2QjtBQUFBLFVBQThDO0FBQUEsWUFBekMsT0FBTSxpQ0FBZ0M7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBQzNDLGFBQVE7QUFBQSxRQUNSLGFBQVE7QUFBQSIsIm5hbWVzIjpbImJvdW5kcyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTY3JlZW5zaG90c09wZXJhdGlvbnMudnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjx0ZW1wbGF0ZT5cbiAgPGRpdlxuICAgIHYtaWY9XCJib3VuZHNcIlxuICAgIHJlZj1cImVsUmVmXCJcbiAgICBjbGFzcz1cInNjcmVlbnNob3RzLW9wZXJhdGlvbnNcIlxuICAgIDpzdHlsZT1cIntcbiAgICAgIHZpc2liaWxpdHk6IHBvc2l0aW9uID8gJ3Zpc2libGUnIDogJ2hpZGRlbicsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUoJHtwb3NpdGlvbj8ueCA/PyAwfXB4LCAke3Bvc2l0aW9uPy55ID8/IDB9cHgpYFxuICAgIH1cIlxuICAgIEBkYmxjbGljay5zdG9wXG4gICAgQGNvbnRleHRtZW51LnByZXZlbnQuc3RvcFxuICA+XG4gICAgPGRpdiBjbGFzcz1cInNjcmVlbnNob3RzLW9wZXJhdGlvbnMtYnV0dG9uc1wiPlxuICAgICAgPFJlY3RhbmdsZSAvPlxuICAgICAgPEVsbGlwc2UgLz5cbiAgICAgIDxBcnJvdyAvPlxuICAgICAgPEJydXNoIC8+XG4gICAgICA8VGV4dCAvPlxuICAgICAgPE1vc2FpYyAvPlxuICAgICAgPGRpdiBjbGFzcz1cInNjcmVlbnNob3RzLW9wZXJhdGlvbnMtZGl2aWRlclwiIC8+XG4gICAgICA8T2NyIEBvY3I9XCJoYW5kbGVPY3JcIiAvPlxuICAgICAgPFBpbiBAcGluPVwiaGFuZGxlUGluXCIgLz5cbiAgICAgIDxPayBAb2s9XCJoYW5kbGVPa1wiIC8+XG4gICAgICA8Q2FuY2VsIEBjYW5jZWw9XCJoYW5kbGVDYW5jZWxcIiAvPlxuICAgICAgPFNhdmUgQHNhdmU9XCJoYW5kbGVTYXZlXCIgLz5cbiAgICAgIDxkaXYgY2xhc3M9XCJzY3JlZW5zaG90cy1vcGVyYXRpb25zLWRpdmlkZXJcIiAvPlxuICAgICAgPFVuZG8gLz5cbiAgICAgIDxSZWRvIC8+XG4gICAgPC9kaXY+XG4gIDwvZGl2PlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgd2F0Y2gsIGNvbXB1dGVkLCBwcm92aWRlIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHR5cGUgeyBCb3VuZHMsIFBvc2l0aW9uIH0gZnJvbSAnLi4vdHlwZXMnXG5pbXBvcnQgeyB1c2VTdG9yZSwgZ2V0VmFsdWUgfSBmcm9tICcuLi9jb21wb3NhYmxlcy91c2VTY3JlZW5zaG90c0NvbnRleHQnXG5pbXBvcnQgT2sgZnJvbSAnLi9vcGVyYXRpb25zL09rLnZ1ZSdcbmltcG9ydCBDYW5jZWwgZnJvbSAnLi9vcGVyYXRpb25zL0NhbmNlbC52dWUnXG5pbXBvcnQgU2F2ZSBmcm9tICcuL29wZXJhdGlvbnMvU2F2ZS52dWUnXG5pbXBvcnQgVW5kbyBmcm9tICcuL29wZXJhdGlvbnMvVW5kby52dWUnXG5pbXBvcnQgUmVkbyBmcm9tICcuL29wZXJhdGlvbnMvUmVkby52dWUnXG5pbXBvcnQgUmVjdGFuZ2xlIGZyb20gJy4vb3BlcmF0aW9ucy9SZWN0YW5nbGUvaW5kZXgudnVlJ1xuaW1wb3J0IEVsbGlwc2UgZnJvbSAnLi9vcGVyYXRpb25zL0VsbGlwc2UvaW5kZXgudnVlJ1xuaW1wb3J0IEFycm93IGZyb20gJy4vb3BlcmF0aW9ucy9BcnJvdy9pbmRleC52dWUnXG5pbXBvcnQgQnJ1c2ggZnJvbSAnLi9vcGVyYXRpb25zL0JydXNoL2luZGV4LnZ1ZSdcbmltcG9ydCBUZXh0IGZyb20gJy4vb3BlcmF0aW9ucy9UZXh0L2luZGV4LnZ1ZSdcbmltcG9ydCBNb3NhaWMgZnJvbSAnLi9vcGVyYXRpb25zL01vc2FpYy9pbmRleC52dWUnXG5pbXBvcnQgUGluIGZyb20gJy4vb3BlcmF0aW9ucy9QaW4udnVlJ1xuaW1wb3J0IE9jciBmcm9tICcuL29wZXJhdGlvbnMvT2NyLnZ1ZSdcblxuY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5jb25zdCB3aWR0aCA9IGNvbXB1dGVkKCgpID0+IHN0b3JlLndpZHRoKVxuY29uc3QgaGVpZ2h0ID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUuaGVpZ2h0KVxuY29uc3QgYm91bmRzID0gY29tcHV0ZWQoKCkgPT4gZ2V0VmFsdWUoc3RvcmUuYm91bmRzKSlcbmNvbnN0IGVsUmVmID0gcmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbClcbmNvbnN0IHBvc2l0aW9uID0gcmVmPFBvc2l0aW9uIHwgbnVsbD4obnVsbClcbmNvbnN0IG9wZXJhdGlvbnNSZWN0ID0gcmVmPEJvdW5kcyB8IG51bGw+KG51bGwpXG5cbi8vIOaPkOS+myBvcGVyYXRpb25zUmVjdCDnu5nlrZDnu4Tku7bkvb/nlKhcbnByb3ZpZGUoJ1NjcmVlbnNob3RzT3BlcmF0aW9uc1JlY3QnLCBvcGVyYXRpb25zUmVjdClcblxuY29uc3QgZW1pdCA9IGRlZmluZUVtaXRzPHtcbiAgb2s6IFtibG9iOiBCbG9iIHwgbnVsbCwgYm91bmRzOiBCb3VuZHNdXG4gIGNhbmNlbDogW11cbiAgc2F2ZTogW2Jsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kc11cbiAgcGluOiBbYmxvYjogQmxvYiB8IG51bGwsIGJvdW5kczogQm91bmRzXVxuICBvY3I6IFtibG9iOiBCbG9iIHwgbnVsbCwgYm91bmRzOiBCb3VuZHNdXG59PigpXG5cbmNvbnN0IGhhbmRsZU9rID0gKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcyk6IHZvaWQgPT4ge1xuICBlbWl0KCdvaycsIGJsb2IsIGJvdW5kcylcbn1cblxuY29uc3QgaGFuZGxlQ2FuY2VsID0gKCk6IHZvaWQgPT4ge1xuICBlbWl0KCdjYW5jZWwnKVxufVxuXG5jb25zdCBoYW5kbGVTYXZlID0gKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcyk6IHZvaWQgPT4ge1xuICBlbWl0KCdzYXZlJywgYmxvYiwgYm91bmRzKVxufVxuXG5jb25zdCBoYW5kbGVQaW4gPSAoKTogdm9pZCA9PiB7XG4gIGVtaXQoJ3BpbicsIG51bGwsIGJvdW5kcy52YWx1ZSBhcyBCb3VuZHMpXG59XG5cbmNvbnN0IGhhbmRsZU9jciA9ICgpOiB2b2lkID0+IHtcbiAgZW1pdCgnb2NyJywgbnVsbCwgYm91bmRzLnZhbHVlIGFzIEJvdW5kcylcbn1cblxud2F0Y2goXG4gICgpID0+IFtib3VuZHMudmFsdWUsIGVsUmVmLnZhbHVlXSxcbiAgKCkgPT4ge1xuICAgIGlmICghYm91bmRzLnZhbHVlIHx8ICFlbFJlZi52YWx1ZSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgZWxSZWN0ID0gZWxSZWYudmFsdWUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblxuICAgIGxldCB4ID0gYm91bmRzLnZhbHVlLnggKyBib3VuZHMudmFsdWUud2lkdGggLSBlbFJlY3Qud2lkdGhcbiAgICBsZXQgeSA9IGJvdW5kcy52YWx1ZS55ICsgYm91bmRzLnZhbHVlLmhlaWdodCArIDEwXG5cbiAgICBpZiAoeCA8IDApIHtcbiAgICAgIHggPSAwXG4gICAgfVxuXG4gICAgaWYgKHggPiB3aWR0aC52YWx1ZSAtIGVsUmVjdC53aWR0aCkge1xuICAgICAgeCA9IHdpZHRoLnZhbHVlIC0gZWxSZWN0LndpZHRoXG4gICAgfVxuXG4gICAgaWYgKHkgPiBoZWlnaHQudmFsdWUgLSBlbFJlY3QuaGVpZ2h0KSB7XG4gICAgICB5ID0gaGVpZ2h0LnZhbHVlIC0gZWxSZWN0LmhlaWdodCAtIDEwXG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIXBvc2l0aW9uLnZhbHVlIHx8XG4gICAgICBNYXRoLmFicyhwb3NpdGlvbi52YWx1ZS54IC0geCkgPiAxIHx8XG4gICAgICBNYXRoLmFicyhwb3NpdGlvbi52YWx1ZS55IC0geSkgPiAxXG4gICAgKSB7XG4gICAgICBwb3NpdGlvbi52YWx1ZSA9IHtcbiAgICAgICAgeCxcbiAgICAgICAgeVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChcbiAgICAgICFvcGVyYXRpb25zUmVjdC52YWx1ZSB8fFxuICAgICAgTWF0aC5hYnMob3BlcmF0aW9uc1JlY3QudmFsdWUueCAtIGVsUmVjdC54KSA+IDEgfHxcbiAgICAgIE1hdGguYWJzKG9wZXJhdGlvbnNSZWN0LnZhbHVlLnkgLSBlbFJlY3QueSkgPiAxIHx8XG4gICAgICBNYXRoLmFicyhvcGVyYXRpb25zUmVjdC52YWx1ZS53aWR0aCAtIGVsUmVjdC53aWR0aCkgPiAxIHx8XG4gICAgICBNYXRoLmFicyhvcGVyYXRpb25zUmVjdC52YWx1ZS5oZWlnaHQgLSBlbFJlY3QuaGVpZ2h0KSA+IDFcbiAgICApIHtcbiAgICAgIG9wZXJhdGlvbnNSZWN0LnZhbHVlID0ge1xuICAgICAgICB4OiBlbFJlY3QueCxcbiAgICAgICAgeTogZWxSZWN0LnksXG4gICAgICAgIHdpZHRoOiBlbFJlY3Qud2lkdGgsXG4gICAgICAgIGhlaWdodDogZWxSZWN0LmhlaWdodFxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgeyBpbW1lZGlhdGU6IHRydWUgfVxuKVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQ+XG4uc2NyZWVuc2hvdHMtb3BlcmF0aW9ucyB7XG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgbGVmdDogMDtcbiAgdG9wOiAwO1xuICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtO1xufVxuXG4uc2NyZWVuc2hvdHMtb3BlcmF0aW9ucy1idXR0b25zIHtcbiAgZGlzcGxheTogZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgcGFkZGluZzogNHB4IDZweDtcbiAgYm9yZGVyLXJhZGl1czogMTBweDtcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tc2hvdC1oYWlybGluZSk7XG4gIGJhY2tncm91bmQ6IHZhcigtLXNob3QtZ2xhc3MpO1xuICBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoMjRweCkgc2F0dXJhdGUoMS42KTtcbiAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6IGJsdXIoMjRweCkgc2F0dXJhdGUoMS42KTtcbiAgYm94LXNoYWRvdzogdmFyKC0tc2hvdC1zaGFkb3cpO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICBhbmltYXRpb246IHNob3QtYmFyLWluIDAuMThzIGVhc2Utb3V0O1xufVxuXG5Aa2V5ZnJhbWVzIHNob3QtYmFyLWluIHtcbiAgZnJvbSB7XG4gICAgb3BhY2l0eTogMDtcbiAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNnB4KSBzY2FsZSgwLjk3KTtcbiAgfVxuICB0byB7XG4gICAgb3BhY2l0eTogMTtcbiAgICB0cmFuc2Zvcm06IG5vbmU7XG4gIH1cbn1cblxuLnNjcmVlbnNob3RzLW9wZXJhdGlvbnMtZGl2aWRlciB7XG4gIHdpZHRoOiAxcHg7XG4gIGhlaWdodDogMThweDtcbiAgYmFja2dyb3VuZDogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjE2KTtcbiAgbWFyZ2luOiAwIDRweDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9TY3JlZW5zaG90c09wZXJhdGlvbnMudnVlIn0=