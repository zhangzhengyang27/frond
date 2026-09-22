import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/Screenshots.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { zhCN } from "/src/views/screenshot/types.ts";
import {
  provideScreenshotsContext
} from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import useGetLoadedImage from "/src/views/screenshot/composables/useGetLoadedImage.ts";
import composeImage from "/src/views/screenshot/utils/composeImage.ts";
import ScreenshotsBackground from "/src/views/screenshot/components/ScreenshotsBackground.vue";
import ScreenshotsCanvas from "/src/views/screenshot/components/ScreenshotsCanvas.vue";
import ScreenshotsOperations from "/src/views/screenshot/components/ScreenshotsOperations.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "Screenshots",
  props: {
    url: { type: String, required: false, default: void 0 },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    scaleFactor: { type: Number, required: false, default: void 0 },
    lang: { type: Object, required: false, default: () => ({}) },
    className: { type: String, required: false, default: "" },
    onOk: { type: Function, required: false, default: void 0 },
    onCancel: { type: Function, required: false, default: void 0 },
    onSave: { type: Function, required: false, default: void 0 },
    onPin: { type: Function, required: false, default: void 0 },
    onOcr: { type: Function, required: false, default: void 0 }
  },
  emits: ["ok", "cancel", "save", "pin", "ocr"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const image = useGetLoadedImage(props.url);
    const canvasRef = ref(null);
    const emiterRef = ref({});
    const history = ref({
      index: -1,
      stack: []
    });
    const bounds = ref(null);
    const cursor = ref("move");
    const operation = ref(void 0);
    const canvasContextRef = ref(null);
    watch(
      () => canvasRef.value?.ctx,
      (ctx) => {
        if (ctx && "value" in ctx) {
          canvasContextRef.value = ctx.value;
        } else {
          canvasContextRef.value = ctx || null;
        }
      },
      { immediate: true }
    );
    const store = {
      url: props.url,
      image,
      width: props.width,
      height: props.height,
      scaleFactor: props.scaleFactor,
      lang: {
        ...zhCN,
        ...props.lang
      },
      emiterRef,
      // 类型兼容：store 期望 Ref<CanvasRenderingContext2D | null>，此处
      // 上下文 store 接口比内联更宽松；any 是历史 copy-paste 残留
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContextRef,
      history,
      bounds,
      cursor,
      operation
    };
    const call = (funcName, ...args) => {
      const func = props[funcName];
      if (typeof func === "function") {
        func(...args);
      }
    };
    const dispatcher = {
      call,
      setHistory: (newHistory) => {
        history.value = typeof newHistory === "function" ? newHistory(history.value) : newHistory;
      },
      setBounds: (newBounds) => {
        bounds.value = typeof newBounds === "function" ? newBounds(bounds.value) : newBounds;
      },
      setCursor: (newCursor) => {
        cursor.value = typeof newCursor === "function" ? newCursor(cursor.value) : newCursor;
      },
      setOperation: (newOperation) => {
        operation.value = typeof newOperation === "function" ? newOperation(operation.value) : newOperation;
      }
    };
    const contextValue = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store,
      dispatcher
    };
    provideScreenshotsContext(contextValue);
    watch(
      () => props.url,
      (newUrl) => {
        ;
        store.url = newUrl;
      }
    );
    const reset = () => {
      emiterRef.value = {};
      history.value = {
        index: -1,
        stack: []
      };
      bounds.value = null;
      cursor.value = "move";
      operation.value = void 0;
    };
    const handleDoubleClick = async (e) => {
      if (e.button !== 0 || !image.value) {
        return;
      }
      if (bounds.value && canvasContextRef.value) {
        const blob = await composeImage({
          image: image.value,
          width: props.width,
          height: props.height,
          history: history.value,
          scaleFactor: props.scaleFactor,
          bounds: bounds.value
        });
        call("onOk", blob, bounds.value);
        reset();
      } else {
        const targetBounds = {
          x: 0,
          y: 0,
          width: props.width,
          height: props.height
        };
        const blob = await composeImage({
          image: image.value,
          width: props.width,
          height: props.height,
          history: history.value,
          scaleFactor: props.scaleFactor,
          bounds: targetBounds
        });
        call("onOk", blob, targetBounds);
        reset();
      }
    };
    const handleContextMenu = (e) => {
      if (e.button !== 2) {
        return;
      }
      e.preventDefault();
      call("onCancel");
      reset();
    };
    const handleOk = (blob, bounds2) => {
      call("onOk", blob, bounds2);
      reset();
    };
    const handleCancel = () => {
      call("onCancel");
      reset();
    };
    const handleSave = (blob, bounds2) => {
      call("onSave", blob, bounds2);
      reset();
    };
    const handlePin = async (blob, bounds2) => {
      try {
        let finalBlob = blob;
        if (!finalBlob && image.value && bounds2) {
          finalBlob = await composeImage({
            image: image.value,
            width: props.width,
            height: props.height,
            history: history.value,
            scaleFactor: props.scaleFactor,
            bounds: bounds2
          });
        }
        if (!finalBlob) return;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error ?? new Error("readAsDataURL failed"));
          reader.readAsDataURL(finalBlob);
        });
        const base64 = dataUrl.split(",")[1] ?? "";
        const result = await window.api.screenshot.pin.create({
          imagePath: dataUrl,
          imageBuffer: base64
        });
        if (result.success) {
          console.log("[Screenshots] Pin created:", result.id);
          call("onCancel");
          reset();
        }
      } catch (error) {
        console.error("[Screenshots] Failed to create pin:", error);
      }
    };
    const handleOcr = async (blob, bounds2) => {
      if (!image.value) return;
      try {
        const targetBounds = bounds2 || { x: 0, y: 0, width: props.width, height: props.height };
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = targetBounds.width;
        tempCanvas.height = targetBounds.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;
        const rx = image.value.naturalWidth / props.width;
        const ry = image.value.naturalHeight / props.height;
        tempCtx.drawImage(
          image.value,
          targetBounds.x * rx,
          targetBounds.y * ry,
          targetBounds.width * rx,
          targetBounds.height * ry,
          0,
          0,
          targetBounds.width,
          targetBounds.height
        );
        const dataUrl = tempCanvas.toDataURL("image/png");
        emit("ocr", dataUrl);
      } catch (error) {
        console.error("[Screenshots] Failed to handle OCR:", error);
      }
    };
    watch(
      () => props.url,
      () => {
        reset();
      }
    );
    const confirm = async () => {
      if (!image.value) return;
      if (bounds.value && canvasContextRef.value) {
        const blob = await composeImage({
          image: image.value,
          width: props.width,
          height: props.height,
          history: history.value,
          scaleFactor: props.scaleFactor,
          bounds: bounds.value
        });
        call("onOk", blob, bounds.value);
        reset();
      } else {
        const targetBounds = {
          x: 0,
          y: 0,
          width: props.width,
          height: props.height
        };
        const blob = await composeImage({
          image: image.value,
          width: props.width,
          height: props.height,
          history: history.value,
          scaleFactor: props.scaleFactor,
          bounds: targetBounds
        });
        call("onOk", blob, targetBounds);
        reset();
      }
    };
    __expose({ confirm });
    const __returned__ = { props, emit, image, canvasRef, emiterRef, history, bounds, cursor, operation, canvasContextRef, store, call, dispatcher, contextValue, reset, handleDoubleClick, handleContextMenu, handleOk, handleCancel, handleSave, handlePin, handleOcr, confirm, ScreenshotsBackground, ScreenshotsCanvas, ScreenshotsOperations };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, normalizeStyle as _normalizeStyle, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock(
    "div",
    {
      class: "screenshots",
      style: _normalizeStyle({ width: `${$props.width}px`, height: `${$props.height}px` }),
      onDblclick: $setup.handleDoubleClick,
      onContextmenu: $setup.handleContextMenu
    },
    [
      _createVNode($setup["ScreenshotsBackground"]),
      _createVNode(
        $setup["ScreenshotsCanvas"],
        { ref: "canvasRef" },
        null,
        512
        /* NEED_PATCH */
      ),
      _createVNode($setup["ScreenshotsOperations"], {
        onOk: $setup.handleOk,
        onCancel: $setup.handleCancel,
        onSave: $setup.handleSave,
        onPin: $setup.handlePin,
        onOcr: $setup.handleOcr
      })
    ],
    36
    /* STYLE, NEED_HYDRATION */
  );
}
import "/src/views/screenshot/components/Screenshots.vue?vue&type=style&index=0&lang.css";
import "/src/views/screenshot/components/Screenshots.vue?vue&type=style&index=1&scoped=5a73fe56&lang.css";
_sfc_main.__hmrId = "5a73fe56";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-5a73fe56"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/Screenshots.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUNqQixDQUFDO0FBQ0QsYUFBSyxRQUFRLE1BQU0sT0FBTyxLQUFLO0FBQy9CLGNBQU07QUFBQSxNQUNSLE9BQU87QUFDTCxjQUFNLGVBQWU7QUFBQSxVQUNuQixHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsVUFDSCxPQUFPLE1BQU07QUFBQSxVQUNiLFFBQVEsTUFBTTtBQUFBLFFBQ2hCO0FBQ0EsY0FBTSxPQUFPLE1BQU0sYUFBYTtBQUFBLFVBQzlCLE9BQU8sTUFBTTtBQUFBLFVBQ2IsT0FBTyxNQUFNO0FBQUEsVUFDYixRQUFRLE1BQU07QUFBQSxVQUNkLFNBQVMsUUFBUTtBQUFBLFVBQ2pCLGFBQWEsTUFBTTtBQUFBLFVBQ25CLFFBQVE7QUFBQSxRQUNWLENBQUM7QUFDRCxhQUFLLFFBQVEsTUFBTSxZQUFZO0FBQy9CLGNBQU07QUFBQSxNQUNSO0FBQUEsSUFDRjtBQUVBLGFBQWEsRUFBRSxRQUFRLENBQUM7Ozs7Ozs7O3VCQTlWdEI7QUFBQSxJQWVNO0FBQUE7QUFBQSxNQWRKLE9BQU07QUFBQSxNQUNMLE9BQUssNEJBQWMsWUFBSyxpQkFBaUIsYUFBTTtBQUFBLE1BQy9DLFlBQVU7QUFBQSxNQUNWLGVBQWE7QUFBQTs7TUFFZCxhQUF5QjtBQUFBLE1BQ3pCO0FBQUEsUUFBcUM7QUFBQSxVQUFsQixLQUFJLFlBQVc7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BQ2xDLGFBTUU7QUFBQSxRQUxDLE1BQUk7QUFBQSxRQUNKLFVBQVE7QUFBQSxRQUNSLFFBQU07QUFBQSxRQUNOLE9BQUs7QUFBQSxRQUNMLE9BQUs7QUFBQSIsIm5hbWVzIjpbImJvdW5kcyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJTY3JlZW5zaG90cy52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8ZGl2XG4gICAgY2xhc3M9XCJzY3JlZW5zaG90c1wiXG4gICAgOnN0eWxlPVwieyB3aWR0aDogYCR7d2lkdGh9cHhgLCBoZWlnaHQ6IGAke2hlaWdodH1weGAgfVwiXG4gICAgQGRibGNsaWNrPVwiaGFuZGxlRG91YmxlQ2xpY2tcIlxuICAgIEBjb250ZXh0bWVudT1cImhhbmRsZUNvbnRleHRNZW51XCJcbiAgPlxuICAgIDxTY3JlZW5zaG90c0JhY2tncm91bmQgLz5cbiAgICA8U2NyZWVuc2hvdHNDYW52YXMgcmVmPVwiY2FudmFzUmVmXCIgLz5cbiAgICA8U2NyZWVuc2hvdHNPcGVyYXRpb25zXG4gICAgICBAb2s9XCJoYW5kbGVPa1wiXG4gICAgICBAY2FuY2VsPVwiaGFuZGxlQ2FuY2VsXCJcbiAgICAgIEBzYXZlPVwiaGFuZGxlU2F2ZVwiXG4gICAgICBAcGluPVwiaGFuZGxlUGluXCJcbiAgICAgIEBvY3I9XCJoYW5kbGVPY3JcIlxuICAgIC8+XG4gIDwvZGl2PlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgd2F0Y2ggfSBmcm9tICd2dWUnXG5pbXBvcnQgdHlwZSB7IEJvdW5kcywgSGlzdG9yeSwgRW1pdGVyLCBMYW5nIH0gZnJvbSAnLi4vdHlwZXMnXG5pbXBvcnQgeyB6aENOIH0gZnJvbSAnLi4vdHlwZXMnXG5pbXBvcnQge1xuICBwcm92aWRlU2NyZWVuc2hvdHNDb250ZXh0LFxuICB0eXBlIFNjcmVlbnNob3RzQ29udGV4dFZhbHVlXG59IGZyb20gJy4uL2NvbXBvc2FibGVzL3VzZVNjcmVlbnNob3RzQ29udGV4dCdcbmltcG9ydCB1c2VHZXRMb2FkZWRJbWFnZSBmcm9tICcuLi9jb21wb3NhYmxlcy91c2VHZXRMb2FkZWRJbWFnZSdcbmltcG9ydCBjb21wb3NlSW1hZ2UgZnJvbSAnLi4vdXRpbHMvY29tcG9zZUltYWdlJ1xuaW1wb3J0IFNjcmVlbnNob3RzQmFja2dyb3VuZCBmcm9tICcuL1NjcmVlbnNob3RzQmFja2dyb3VuZC52dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHNDYW52YXMgZnJvbSAnLi9TY3JlZW5zaG90c0NhbnZhcy52dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHNPcGVyYXRpb25zIGZyb20gJy4vU2NyZWVuc2hvdHNPcGVyYXRpb25zLnZ1ZSdcblxuZXhwb3J0IGludGVyZmFjZSBTY3JlZW5zaG90c1Byb3BzIHtcbiAgdXJsPzogc3RyaW5nXG4gIHdpZHRoOiBudW1iZXJcbiAgaGVpZ2h0OiBudW1iZXJcbiAgLyoqIOadpea6kOaYvuekuuWZqOeahOe8qeaUvuezu+aVsO+8iOeql+WPo+aIquWbvi/ot6jlsY/ml7Yg4omgIOW9k+WJjeeql+WPoyBkcHLvvInvvIznlKjkuo7miJDlm77liIbovqjnjocgKi9cbiAgc2NhbGVGYWN0b3I/OiBudW1iZXJcbiAgbGFuZz86IFBhcnRpYWw8TGFuZz5cbiAgY2xhc3NOYW1lPzogc3RyaW5nXG4gIG9uT2s/OiAoYmxvYjogQmxvYiB8IG51bGwsIGJvdW5kczogQm91bmRzKSA9PiB2b2lkXG4gIG9uQ2FuY2VsPzogKCkgPT4gdm9pZFxuICBvblNhdmU/OiAoYmxvYjogQmxvYiB8IG51bGwsIGJvdW5kczogQm91bmRzKSA9PiB2b2lkXG4gIG9uUGluPzogKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcykgPT4gdm9pZFxuICBvbk9jcj86IChpbWFnZURhdGFVcmw6IHN0cmluZykgPT4gdm9pZFxufVxuXG5jb25zdCBwcm9wcyA9IHdpdGhEZWZhdWx0cyhkZWZpbmVQcm9wczxTY3JlZW5zaG90c1Byb3BzPigpLCB7XG4gIHVybDogdW5kZWZpbmVkLFxuICBzY2FsZUZhY3RvcjogdW5kZWZpbmVkLFxuICBsYW5nOiAoKSA9PiAoe30pLFxuICBjbGFzc05hbWU6ICcnLFxuICBvbk9rOiB1bmRlZmluZWQsXG4gIG9uQ2FuY2VsOiB1bmRlZmluZWQsXG4gIG9uU2F2ZTogdW5kZWZpbmVkLFxuICBvblBpbjogdW5kZWZpbmVkLFxuICBvbk9jcjogdW5kZWZpbmVkXG59KVxuXG5jb25zdCBlbWl0ID0gZGVmaW5lRW1pdHM8e1xuICBvazogW2Jsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kc11cbiAgY2FuY2VsOiBbXVxuICBzYXZlOiBbYmxvYjogQmxvYiB8IG51bGwsIGJvdW5kczogQm91bmRzXVxuICBwaW46IFtibG9iOiBCbG9iIHwgbnVsbCwgYm91bmRzOiBCb3VuZHNdXG4gIG9jcjogW2ltYWdlRGF0YVVybDogc3RyaW5nXVxufT4oKVxuXG5jb25zdCBpbWFnZSA9IHVzZUdldExvYWRlZEltYWdlKHByb3BzLnVybClcbmNvbnN0IGNhbnZhc1JlZiA9IHJlZjxJbnN0YW5jZVR5cGU8dHlwZW9mIFNjcmVlbnNob3RzQ2FudmFzPiB8IG51bGw+KG51bGwpXG5cbmNvbnN0IGVtaXRlclJlZiA9IHJlZjxFbWl0ZXI+KHt9KVxuY29uc3QgaGlzdG9yeSA9IHJlZjxIaXN0b3J5Pih7XG4gIGluZGV4OiAtMSxcbiAgc3RhY2s6IFtdXG59KVxuY29uc3QgYm91bmRzID0gcmVmPEJvdW5kcyB8IG51bGw+KG51bGwpXG5jb25zdCBjdXJzb3IgPSByZWY8c3RyaW5nIHwgdW5kZWZpbmVkPignbW92ZScpXG5jb25zdCBvcGVyYXRpb24gPSByZWY8c3RyaW5nIHwgdW5kZWZpbmVkPih1bmRlZmluZWQpXG5cbmNvbnN0IGNhbnZhc0NvbnRleHRSZWYgPSByZWY8Q2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbD4obnVsbClcblxud2F0Y2goXG4gICgpID0+IGNhbnZhc1JlZi52YWx1ZT8uY3R4LFxuICAoY3R4KSA9PiB7XG4gICAgaWYgKGN0eCAmJiAndmFsdWUnIGluIGN0eCkge1xuICAgICAgY2FudmFzQ29udGV4dFJlZi52YWx1ZSA9IChjdHggYXMgeyB2YWx1ZTogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbCB9KS52YWx1ZVxuICAgIH0gZWxzZSB7XG4gICAgICBjYW52YXNDb250ZXh0UmVmLnZhbHVlID0gKGN0eCBhcyBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQgfCBudWxsKSB8fCBudWxsXG4gICAgfVxuICB9LFxuICB7IGltbWVkaWF0ZTogdHJ1ZSB9XG4pXG5cbmNvbnN0IHN0b3JlID0ge1xuICB1cmw6IHByb3BzLnVybCxcbiAgaW1hZ2UsXG4gIHdpZHRoOiBwcm9wcy53aWR0aCxcbiAgaGVpZ2h0OiBwcm9wcy5oZWlnaHQsXG4gIHNjYWxlRmFjdG9yOiBwcm9wcy5zY2FsZUZhY3RvcixcbiAgbGFuZzoge1xuICAgIC4uLnpoQ04sXG4gICAgLi4ucHJvcHMubGFuZ1xuICB9LFxuICBlbWl0ZXJSZWYsXG4gIC8vIOexu+Wei+WFvOWuue+8mnN0b3JlIOacn+acmyBSZWY8Q2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIHwgbnVsbD7vvIzmraTlpIRcbiAgLy8g5LiK5LiL5paHIHN0b3JlIOaOpeWPo+avlOWGheiBlOabtOWuveadvu+8m2FueSDmmK/ljoblj7IgY29weS1wYXN0ZSDmrovnlZlcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgY2FudmFzQ29udGV4dFJlZjogY2FudmFzQ29udGV4dFJlZiBhcyBhbnksXG4gIGhpc3RvcnksXG4gIGJvdW5kcyxcbiAgY3Vyc29yLFxuICBvcGVyYXRpb25cbn1cblxuY29uc3QgY2FsbCA9IDxUIGV4dGVuZHMgdW5rbm93bltdPihmdW5jTmFtZTogc3RyaW5nLCAuLi5hcmdzOiBUKSA9PiB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGZ1bmMgPSAocHJvcHMgYXMgYW55KVtmdW5jTmFtZV1cbiAgaWYgKHR5cGVvZiBmdW5jID09PSAnZnVuY3Rpb24nKSB7XG4gICAgZnVuYyguLi5hcmdzKVxuICB9XG59XG5cbmNvbnN0IGRpc3BhdGNoZXIgPSB7XG4gIGNhbGwsXG4gIHNldEhpc3Rvcnk6IChuZXdIaXN0b3J5OiBIaXN0b3J5IHwgKChwcmV2OiBIaXN0b3J5KSA9PiBIaXN0b3J5KSkgPT4ge1xuICAgIGhpc3RvcnkudmFsdWUgPSB0eXBlb2YgbmV3SGlzdG9yeSA9PT0gJ2Z1bmN0aW9uJyA/IG5ld0hpc3RvcnkoaGlzdG9yeS52YWx1ZSkgOiBuZXdIaXN0b3J5XG4gIH0sXG4gIHNldEJvdW5kczogKG5ld0JvdW5kczogQm91bmRzIHwgbnVsbCB8ICgocHJldjogQm91bmRzIHwgbnVsbCkgPT4gQm91bmRzIHwgbnVsbCkpID0+IHtcbiAgICBib3VuZHMudmFsdWUgPSB0eXBlb2YgbmV3Qm91bmRzID09PSAnZnVuY3Rpb24nID8gbmV3Qm91bmRzKGJvdW5kcy52YWx1ZSkgOiBuZXdCb3VuZHNcbiAgfSxcbiAgc2V0Q3Vyc29yOiAoXG4gICAgbmV3Q3Vyc29yOiBzdHJpbmcgfCB1bmRlZmluZWQgfCAoKHByZXY6IHN0cmluZyB8IHVuZGVmaW5lZCkgPT4gc3RyaW5nIHwgdW5kZWZpbmVkKVxuICApID0+IHtcbiAgICBjdXJzb3IudmFsdWUgPSB0eXBlb2YgbmV3Q3Vyc29yID09PSAnZnVuY3Rpb24nID8gbmV3Q3Vyc29yKGN1cnNvci52YWx1ZSkgOiBuZXdDdXJzb3JcbiAgfSxcbiAgc2V0T3BlcmF0aW9uOiAoXG4gICAgbmV3T3BlcmF0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQgfCAoKHByZXY6IHN0cmluZyB8IHVuZGVmaW5lZCkgPT4gc3RyaW5nIHwgdW5kZWZpbmVkKVxuICApID0+IHtcbiAgICBvcGVyYXRpb24udmFsdWUgPVxuICAgICAgdHlwZW9mIG5ld09wZXJhdGlvbiA9PT0gJ2Z1bmN0aW9uJyA/IG5ld09wZXJhdGlvbihvcGVyYXRpb24udmFsdWUpIDogbmV3T3BlcmF0aW9uXG4gIH1cbn1cblxuY29uc3QgY29udGV4dFZhbHVlOiBTY3JlZW5zaG90c0NvbnRleHRWYWx1ZSA9IHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgc3RvcmU6IHN0b3JlIGFzIGFueSxcbiAgZGlzcGF0Y2hlclxufVxuXG5wcm92aWRlU2NyZWVuc2hvdHNDb250ZXh0KGNvbnRleHRWYWx1ZSlcblxuLy8g55uR5ZCsIHByb3BzLnVybCDlj5jljJbvvIzmm7TmlrAgc3RvcmUudXJsXG53YXRjaChcbiAgKCkgPT4gcHJvcHMudXJsLFxuICAobmV3VXJsKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICA7KHN0b3JlIGFzIGFueSkudXJsID0gbmV3VXJsXG4gIH1cbilcblxuY29uc3QgcmVzZXQgPSAoKSA9PiB7XG4gIGVtaXRlclJlZi52YWx1ZSA9IHt9XG4gIGhpc3RvcnkudmFsdWUgPSB7XG4gICAgaW5kZXg6IC0xLFxuICAgIHN0YWNrOiBbXVxuICB9XG4gIGJvdW5kcy52YWx1ZSA9IG51bGxcbiAgY3Vyc29yLnZhbHVlID0gJ21vdmUnXG4gIG9wZXJhdGlvbi52YWx1ZSA9IHVuZGVmaW5lZFxufVxuXG5jb25zdCBoYW5kbGVEb3VibGVDbGljayA9IGFzeW5jIChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gIGlmIChlLmJ1dHRvbiAhPT0gMCB8fCAhaW1hZ2UudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuICBpZiAoYm91bmRzLnZhbHVlICYmIGNhbnZhc0NvbnRleHRSZWYudmFsdWUpIHtcbiAgICBjb25zdCBibG9iID0gYXdhaXQgY29tcG9zZUltYWdlKHtcbiAgICAgIGltYWdlOiBpbWFnZS52YWx1ZSxcbiAgICAgIHdpZHRoOiBwcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogcHJvcHMuaGVpZ2h0LFxuICAgICAgaGlzdG9yeTogaGlzdG9yeS52YWx1ZSxcbiAgICAgIHNjYWxlRmFjdG9yOiBwcm9wcy5zY2FsZUZhY3RvcixcbiAgICAgIGJvdW5kczogYm91bmRzLnZhbHVlXG4gICAgfSlcbiAgICBjYWxsKCdvbk9rJywgYmxvYiwgYm91bmRzLnZhbHVlKVxuICAgIHJlc2V0KClcbiAgfSBlbHNlIHtcbiAgICBjb25zdCB0YXJnZXRCb3VuZHMgPSB7XG4gICAgICB4OiAwLFxuICAgICAgeTogMCxcbiAgICAgIHdpZHRoOiBwcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogcHJvcHMuaGVpZ2h0XG4gICAgfVxuICAgIGNvbnN0IGJsb2IgPSBhd2FpdCBjb21wb3NlSW1hZ2Uoe1xuICAgICAgaW1hZ2U6IGltYWdlLnZhbHVlLFxuICAgICAgd2lkdGg6IHByb3BzLndpZHRoLFxuICAgICAgaGVpZ2h0OiBwcm9wcy5oZWlnaHQsXG4gICAgICBoaXN0b3J5OiBoaXN0b3J5LnZhbHVlLFxuICAgICAgc2NhbGVGYWN0b3I6IHByb3BzLnNjYWxlRmFjdG9yLFxuICAgICAgYm91bmRzOiB0YXJnZXRCb3VuZHNcbiAgICB9KVxuICAgIGNhbGwoJ29uT2snLCBibG9iLCB0YXJnZXRCb3VuZHMpXG4gICAgcmVzZXQoKVxuICB9XG59XG5cbmNvbnN0IGhhbmRsZUNvbnRleHRNZW51ID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgaWYgKGUuYnV0dG9uICE9PSAyKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gIGNhbGwoJ29uQ2FuY2VsJylcbiAgcmVzZXQoKVxufVxuXG5jb25zdCBoYW5kbGVPayA9IChibG9iOiBCbG9iIHwgbnVsbCwgYm91bmRzOiBCb3VuZHMpID0+IHtcbiAgY2FsbCgnb25PaycsIGJsb2IsIGJvdW5kcylcbiAgcmVzZXQoKVxufVxuXG5jb25zdCBoYW5kbGVDYW5jZWwgPSAoKSA9PiB7XG4gIGNhbGwoJ29uQ2FuY2VsJylcbiAgcmVzZXQoKVxufVxuXG5jb25zdCBoYW5kbGVTYXZlID0gKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcykgPT4ge1xuICBjYWxsKCdvblNhdmUnLCBibG9iLCBib3VuZHMpXG4gIHJlc2V0KClcbn1cblxuY29uc3QgaGFuZGxlUGluID0gYXN5bmMgKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcykgPT4ge1xuICB0cnkge1xuICAgIC8vIOWmguaenCBibG9iIOS4uiBudWxs77yI5LuO5bel5YW35qCP6Kem5Y+R77yJ77yM6Ieq6KGM5ZCI5oiQ5Zu+54mHXG4gICAgbGV0IGZpbmFsQmxvYiA9IGJsb2JcbiAgICBpZiAoIWZpbmFsQmxvYiAmJiBpbWFnZS52YWx1ZSAmJiBib3VuZHMpIHtcbiAgICAgIGZpbmFsQmxvYiA9IGF3YWl0IGNvbXBvc2VJbWFnZSh7XG4gICAgICAgIGltYWdlOiBpbWFnZS52YWx1ZSxcbiAgICAgICAgd2lkdGg6IHByb3BzLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHByb3BzLmhlaWdodCxcbiAgICAgICAgaGlzdG9yeTogaGlzdG9yeS52YWx1ZSxcbiAgICAgICAgc2NhbGVGYWN0b3I6IHByb3BzLnNjYWxlRmFjdG9yLFxuICAgICAgICBib3VuZHNcbiAgICAgIH0pXG4gICAgfVxuICAgIGlmICghZmluYWxCbG9iKSByZXR1cm5cblxuICAgIC8vIGJsb2Ig4oaSIGRhdGFVUkzvvIhGaWxlUmVhZGVyIOW8guatpei9rOaNou+8jOmBv+WFjemAkOWtl+iKguaLvOS4suWcqOWkp+WbvuS4iuWNoemhv+aVsOenku+8iVxuICAgIGNvbnN0IGRhdGFVcmwgPSBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiByZXNvbHZlKHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nKVxuICAgICAgcmVhZGVyLm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVhZGVyLmVycm9yID8/IG5ldyBFcnJvcigncmVhZEFzRGF0YVVSTCBmYWlsZWQnKSlcbiAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbmFsQmxvYilcbiAgICB9KVxuICAgIGNvbnN0IGJhc2U2NCA9IGRhdGFVcmwuc3BsaXQoJywnKVsxXSA/PyAnJ1xuXG4gICAgLy8g6LCD55SoIEFQSSDliJvlu7rotLTlm75cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aW5kb3cuYXBpLnNjcmVlbnNob3QucGluLmNyZWF0ZSh7XG4gICAgICBpbWFnZVBhdGg6IGRhdGFVcmwsXG4gICAgICBpbWFnZUJ1ZmZlcjogYmFzZTY0XG4gICAgfSlcblxuICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgY29uc29sZS5sb2coJ1tTY3JlZW5zaG90c10gUGluIGNyZWF0ZWQ6JywgcmVzdWx0LmlkKVxuICAgICAgLy8g6LS05Zu+5Yib5bu65ZCO5YWz6Zet5oiq5Zu+56qX5Y+jXG4gICAgICBjYWxsKCdvbkNhbmNlbCcpXG4gICAgICByZXNldCgpXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tTY3JlZW5zaG90c10gRmFpbGVkIHRvIGNyZWF0ZSBwaW46JywgZXJyb3IpXG4gIH1cbn1cblxuY29uc3QgaGFuZGxlT2NyID0gYXN5bmMgKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcykgPT4ge1xuICBpZiAoIWltYWdlLnZhbHVlKSByZXR1cm5cblxuICB0cnkge1xuICAgIC8vIOWmguaenOaciemAieWMuiBib3VuZHPvvIzoo4HliarpgInljLrov5vooYwgT0NS77yb5ZCm5YiZ5L2/55So5YWo5Zu+XG4gICAgY29uc3QgdGFyZ2V0Qm91bmRzID0gYm91bmRzIHx8IHsgeDogMCwgeTogMCwgd2lkdGg6IHByb3BzLndpZHRoLCBoZWlnaHQ6IHByb3BzLmhlaWdodCB9XG5cbiAgICAvLyDliJvlu7rkuLTml7bnlLvluIPoo4HliarpgInljLpcbiAgICBjb25zdCB0ZW1wQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICB0ZW1wQ2FudmFzLndpZHRoID0gdGFyZ2V0Qm91bmRzLndpZHRoXG4gICAgdGVtcENhbnZhcy5oZWlnaHQgPSB0YXJnZXRCb3VuZHMuaGVpZ2h0XG4gICAgY29uc3QgdGVtcEN0eCA9IHRlbXBDYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgIGlmICghdGVtcEN0eCkgcmV0dXJuXG5cbiAgICAvLyDorqHnrpflm77niYfnvKnmlL7mr5TkvotcbiAgICBjb25zdCByeCA9IGltYWdlLnZhbHVlLm5hdHVyYWxXaWR0aCAvIHByb3BzLndpZHRoXG4gICAgY29uc3QgcnkgPSBpbWFnZS52YWx1ZS5uYXR1cmFsSGVpZ2h0IC8gcHJvcHMuaGVpZ2h0XG5cbiAgICB0ZW1wQ3R4LmRyYXdJbWFnZShcbiAgICAgIGltYWdlLnZhbHVlLFxuICAgICAgdGFyZ2V0Qm91bmRzLnggKiByeCxcbiAgICAgIHRhcmdldEJvdW5kcy55ICogcnksXG4gICAgICB0YXJnZXRCb3VuZHMud2lkdGggKiByeCxcbiAgICAgIHRhcmdldEJvdW5kcy5oZWlnaHQgKiByeSxcbiAgICAgIDAsXG4gICAgICAwLFxuICAgICAgdGFyZ2V0Qm91bmRzLndpZHRoLFxuICAgICAgdGFyZ2V0Qm91bmRzLmhlaWdodFxuICAgIClcblxuICAgIGNvbnN0IGRhdGFVcmwgPSB0ZW1wQ2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJylcbiAgICBlbWl0KCdvY3InLCBkYXRhVXJsKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tTY3JlZW5zaG90c10gRmFpbGVkIHRvIGhhbmRsZSBPQ1I6JywgZXJyb3IpXG4gIH1cbn1cblxud2F0Y2goXG4gICgpID0+IHByb3BzLnVybCxcbiAgKCkgPT4ge1xuICAgIHJlc2V0KClcbiAgfVxuKVxuXG4vKiog5L6b54i257uE5Lu26YCa6L+HIHJlZiDosIPnlKjvvIzmqKHmi5/igJznoa7lrprigJ3mk43kvZzvvIjlpoIgRW50ZXIg6ZSu6Kem5Y+R77yJICovXG5jb25zdCBjb25maXJtID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBpZiAoIWltYWdlLnZhbHVlKSByZXR1cm5cbiAgaWYgKGJvdW5kcy52YWx1ZSAmJiBjYW52YXNDb250ZXh0UmVmLnZhbHVlKSB7XG4gICAgY29uc3QgYmxvYiA9IGF3YWl0IGNvbXBvc2VJbWFnZSh7XG4gICAgICBpbWFnZTogaW1hZ2UudmFsdWUsXG4gICAgICB3aWR0aDogcHJvcHMud2lkdGgsXG4gICAgICBoZWlnaHQ6IHByb3BzLmhlaWdodCxcbiAgICAgIGhpc3Rvcnk6IGhpc3RvcnkudmFsdWUsXG4gICAgICBzY2FsZUZhY3RvcjogcHJvcHMuc2NhbGVGYWN0b3IsXG4gICAgICBib3VuZHM6IGJvdW5kcy52YWx1ZVxuICAgIH0pXG4gICAgY2FsbCgnb25PaycsIGJsb2IsIGJvdW5kcy52YWx1ZSlcbiAgICByZXNldCgpXG4gIH0gZWxzZSB7XG4gICAgY29uc3QgdGFyZ2V0Qm91bmRzID0ge1xuICAgICAgeDogMCxcbiAgICAgIHk6IDAsXG4gICAgICB3aWR0aDogcHJvcHMud2lkdGgsXG4gICAgICBoZWlnaHQ6IHByb3BzLmhlaWdodFxuICAgIH1cbiAgICBjb25zdCBibG9iID0gYXdhaXQgY29tcG9zZUltYWdlKHtcbiAgICAgIGltYWdlOiBpbWFnZS52YWx1ZSxcbiAgICAgIHdpZHRoOiBwcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogcHJvcHMuaGVpZ2h0LFxuICAgICAgaGlzdG9yeTogaGlzdG9yeS52YWx1ZSxcbiAgICAgIHNjYWxlRmFjdG9yOiBwcm9wcy5zY2FsZUZhY3RvcixcbiAgICAgIGJvdW5kczogdGFyZ2V0Qm91bmRzXG4gICAgfSlcbiAgICBjYWxsKCdvbk9rJywgYmxvYiwgdGFyZ2V0Qm91bmRzKVxuICAgIHJlc2V0KClcbiAgfVxufVxuXG5kZWZpbmVFeHBvc2UoeyBjb25maXJtIH0pXG48L3NjcmlwdD5cblxuPHN0eWxlPlxuQGltcG9ydCAnLi4vaWNvbnMvaWNvbmZvbnQubGVzcyc7XG48L3N0eWxlPlxuXG48c3R5bGUgc2NvcGVkPlxuLnNjcmVlbnNob3RzIHtcbiAgcG9zaXRpb246IHJlbGF0aXZlO1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVooMCk7XG4gIGZvbnQtZmFtaWx5OlxuICAgIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCAnSGVsdmV0aWNhIE5ldWUnLCBBcmlhbCwgJ05vdG8gU2FucycsXG4gICAgc2Fucy1zZXJpZjtcbn1cblxuLnNjcmVlbnNob3RzLFxuLnNjcmVlbnNob3RzICoge1xuICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICB1c2VyLXNlbGVjdDogbm9uZTtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9TY3JlZW5zaG90cy52dWUifQ==