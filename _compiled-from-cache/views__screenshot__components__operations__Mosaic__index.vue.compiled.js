import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/operations/Mosaic/index.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, computed, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import { useHistory } from "/src/views/screenshot/composables/useHistory.ts";
import { useOperation } from "/src/views/screenshot/composables/useOperation.ts";
import { useCursor } from "/src/views/screenshot/composables/useCursor.ts";
import { useCanvasContextRef } from "/src/views/screenshot/composables/useCanvasContextRef.ts";
import useCanvasMousedown from "/src/views/screenshot/composables/useCanvasMousedown.ts";
import useCanvasMousemove from "/src/views/screenshot/composables/useCanvasMousemove.ts";
import useCanvasMouseup from "/src/views/screenshot/composables/useCanvasMouseup.ts";
import { HistoryItemType } from "/src/views/screenshot/types.ts";
import ScreenshotsButton from "/src/views/screenshot/components/ScreenshotsButton.vue";
import ScreenshotsSize from "/src/views/screenshot/components/ScreenshotsSize.vue";
import draw from "/src/views/screenshot/components/operations/Mosaic/draw.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "index",
  setup(__props, { expose: __expose }) {
    __expose();
    function getColor(x, y, imageData) {
      if (!imageData) {
        return [0, 0, 0, 0];
      }
      const { data, width: width2 } = imageData;
      const index = y * width2 * 4 + x * 4;
      return Array.from(data.slice(index, index + 4));
    }
    const store = useStore();
    const lang = computed(() => store.lang);
    const image = computed(() => getValue(store.image));
    const width = computed(() => store.width);
    const height = computed(() => store.height);
    const [operation, operationDispatcher] = useOperation();
    const canvasContextRef = useCanvasContextRef();
    const [history, historyDispatcher] = useHistory();
    const bounds = computed(() => getValue(store.bounds));
    const [, cursorDispatcher] = useCursor();
    const size = ref(3);
    const imageDataRef = ref(null);
    const mosaicRef = ref(null);
    const checked = computed(() => operation === "Mosaic");
    const selectMosaic = () => {
      operationDispatcher.set("Mosaic");
      cursorDispatcher.set("crosshair");
    };
    const handleSelectMosaic = () => {
      if (checked.value) {
        return;
      }
      selectMosaic();
      historyDispatcher.clearSelect();
    };
    const setSize = (value) => {
      size.value = value;
    };
    const onMousedown = (e) => {
      if (!checked.value || mosaicRef.value || !imageDataRef.value || !canvasContextRef.value) {
        return;
      }
      const rect = canvasContextRef.value.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const mosaicSize = size.value * 2;
      mosaicRef.value = {
        name: "Mosaic",
        type: HistoryItemType.Source,
        data: {
          size: mosaicSize,
          tiles: [
            {
              x,
              y,
              color: getColor(x, y, imageDataRef.value)
            }
          ]
        },
        editHistory: [],
        draw
      };
    };
    const onMousemove = (e) => {
      if (!checked.value || !mosaicRef.value || !canvasContextRef.value || !imageDataRef.value) {
        return;
      }
      const rect = canvasContextRef.value.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const mosaicSize = mosaicRef.value.data.size;
      const mosaicTiles = mosaicRef.value.data.tiles;
      let lastTile = mosaicTiles[mosaicTiles.length - 1];
      if (!lastTile) {
        mosaicTiles.push({
          x,
          y,
          color: getColor(x, y, imageDataRef.value)
        });
      } else {
        const dx = lastTile.x - x;
        const dy = lastTile.y - y;
        let length = Math.sqrt(dx ** 2 + dy ** 2);
        const sin = -dy / length;
        const cos = -dx / length;
        while (length > mosaicSize) {
          const cx = Math.floor(lastTile.x + mosaicSize * cos);
          const cy = Math.floor(lastTile.y + mosaicSize * sin);
          lastTile = {
            x: cx,
            y: cy,
            color: getColor(cx, cy, imageDataRef.value)
          };
          mosaicTiles.push(lastTile);
          length -= mosaicSize;
        }
        if (length > mosaicSize / 2) {
          mosaicTiles.push({
            x,
            y,
            color: getColor(x, y, imageDataRef.value)
          });
        }
      }
      if (history.top !== mosaicRef.value) {
        historyDispatcher.push(mosaicRef.value);
      } else {
        historyDispatcher.set(history);
      }
    };
    const onMouseup = () => {
      if (!checked.value) {
        return;
      }
      mosaicRef.value = null;
    };
    watch(
      () => [bounds.value, image.value, checked.value],
      () => {
        if (!bounds.value || !image.value || !checked.value) {
          return;
        }
        const $canvas = document.createElement("canvas");
        const canvasContext = $canvas.getContext("2d");
        if (!canvasContext) {
          return;
        }
        $canvas.width = bounds.value.width;
        $canvas.height = bounds.value.height;
        const rx = image.value.naturalWidth / width.value;
        const ry = image.value.naturalHeight / height.value;
        canvasContext.drawImage(
          image.value,
          bounds.value.x * rx,
          bounds.value.y * ry,
          bounds.value.width * rx,
          bounds.value.height * ry,
          0,
          0,
          bounds.value.width,
          bounds.value.height
        );
        imageDataRef.value = canvasContext.getImageData(0, 0, bounds.value.width, bounds.value.height);
      },
      { immediate: true }
    );
    useCanvasMousedown(onMousedown);
    useCanvasMousemove(onMousemove);
    useCanvasMouseup(onMouseup);
    const __returned__ = { getColor, store, lang, image, width, height, operation, operationDispatcher, canvasContextRef, history, historyDispatcher, bounds, cursorDispatcher, size, imageDataRef, mosaicRef, checked, selectMosaic, handleSelectMosaic, setSize, onMousedown, onMousemove, onMouseup, ScreenshotsButton, ScreenshotsSize };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createBlock($setup["ScreenshotsButton"], {
    title: $setup.lang.operation_mosaic_title,
    icon: "icon-mosaic",
    checked: $setup.checked,
    onClick: $setup.handleSelectMosaic
  }, {
    option: _withCtx(() => [
      _createVNode($setup["ScreenshotsSize"], {
        value: $setup.size,
        onChange: $setup.setSize
      }, null, 8, ["value"])
    ]),
    _: 1
    /* STABLE */
  }, 8, ["title", "checked"]);
}
_sfc_main.__hmrId = "f203efd0";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/operations/Mosaic/index.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QUFXO0FBQzlCLHFCQUFpQixTQUFTOzs7Ozs7Ozt1QkF2TnhCLGFBU29CO0FBQUEsSUFSakIsT0FBTyxZQUFLO0FBQUEsSUFDYixNQUFLO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxTQUFPO0FBQUE7SUFFRyxRQUFNLFNBQ2YsTUFBbUQ7QUFBQSxNQUFuRCxhQUFtRDtBQUFBLFFBQWpDLE9BQU87QUFBQSxRQUFPLFVBQVE7QUFBQSIsIm5hbWVzIjpbIndpZHRoIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImluZGV4LnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxTY3JlZW5zaG90c0J1dHRvblxuICAgIDp0aXRsZT1cImxhbmcub3BlcmF0aW9uX21vc2FpY190aXRsZVwiXG4gICAgaWNvbj1cImljb24tbW9zYWljXCJcbiAgICA6Y2hlY2tlZD1cImNoZWNrZWRcIlxuICAgIEBjbGljaz1cImhhbmRsZVNlbGVjdE1vc2FpY1wiXG4gID5cbiAgICA8dGVtcGxhdGUgI29wdGlvbj5cbiAgICAgIDxTY3JlZW5zaG90c1NpemUgOnZhbHVlPVwic2l6ZVwiIEBjaGFuZ2U9XCJzZXRTaXplXCIgLz5cbiAgICA8L3RlbXBsYXRlPlxuICA8L1NjcmVlbnNob3RzQnV0dG9uPlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgY29tcHV0ZWQsIHdhdGNoIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgdXNlU3RvcmUsIGdldFZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuaW1wb3J0IHsgdXNlSGlzdG9yeSB9IGZyb20gJy4uLy4uLy4uL2NvbXBvc2FibGVzL3VzZUhpc3RvcnknXG5pbXBvcnQgeyB1c2VPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VPcGVyYXRpb24nXG5pbXBvcnQgeyB1c2VDdXJzb3IgfSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDdXJzb3InXG5pbXBvcnQgeyB1c2VDYW52YXNDb250ZXh0UmVmIH0gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzQ29udGV4dFJlZidcbmltcG9ydCB1c2VDYW52YXNNb3VzZWRvd24gZnJvbSAnLi4vLi4vLi4vY29tcG9zYWJsZXMvdXNlQ2FudmFzTW91c2Vkb3duJ1xuaW1wb3J0IHVzZUNhbnZhc01vdXNlbW92ZSBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDYW52YXNNb3VzZW1vdmUnXG5pbXBvcnQgdXNlQ2FudmFzTW91c2V1cCBmcm9tICcuLi8uLi8uLi9jb21wb3NhYmxlcy91c2VDYW52YXNNb3VzZXVwJ1xuaW1wb3J0IHsgSGlzdG9yeUl0ZW1UeXBlIH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMnXG5pbXBvcnQgU2NyZWVuc2hvdHNCdXR0b24gZnJvbSAnLi4vLi4vU2NyZWVuc2hvdHNCdXR0b24udnVlJ1xuaW1wb3J0IFNjcmVlbnNob3RzU2l6ZSBmcm9tICcuLi8uLi9TY3JlZW5zaG90c1NpemUudnVlJ1xuaW1wb3J0IGRyYXcgZnJvbSAnLi9kcmF3J1xuXG5leHBvcnQgaW50ZXJmYWNlIE1vc2FpY1RpbGUge1xuICB4OiBudW1iZXJcbiAgeTogbnVtYmVyXG4gIGNvbG9yOiBudW1iZXJbXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1vc2FpY0RhdGEge1xuICBzaXplOiBudW1iZXJcbiAgdGlsZXM6IE1vc2FpY1RpbGVbXVxufVxuXG5mdW5jdGlvbiBnZXRDb2xvcih4OiBudW1iZXIsIHk6IG51bWJlciwgaW1hZ2VEYXRhOiBJbWFnZURhdGEpOiBudW1iZXJbXSB7XG4gIGlmICghaW1hZ2VEYXRhKSB7XG4gICAgcmV0dXJuIFswLCAwLCAwLCAwXVxuICB9XG4gIGNvbnN0IHsgZGF0YSwgd2lkdGggfSA9IGltYWdlRGF0YVxuXG4gIGNvbnN0IGluZGV4ID0geSAqIHdpZHRoICogNCArIHggKiA0XG5cbiAgcmV0dXJuIEFycmF5LmZyb20oZGF0YS5zbGljZShpbmRleCwgaW5kZXggKyA0KSlcbn1cblxuY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5jb25zdCBsYW5nID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUubGFuZylcbmNvbnN0IGltYWdlID0gY29tcHV0ZWQoKCkgPT4gZ2V0VmFsdWUoc3RvcmUuaW1hZ2UpKVxuY29uc3Qgd2lkdGggPSBjb21wdXRlZCgoKSA9PiBzdG9yZS53aWR0aClcbmNvbnN0IGhlaWdodCA9IGNvbXB1dGVkKCgpID0+IHN0b3JlLmhlaWdodClcbmNvbnN0IFtvcGVyYXRpb24sIG9wZXJhdGlvbkRpc3BhdGNoZXJdID0gdXNlT3BlcmF0aW9uKClcbmNvbnN0IGNhbnZhc0NvbnRleHRSZWYgPSB1c2VDYW52YXNDb250ZXh0UmVmKClcbmNvbnN0IFtoaXN0b3J5LCBoaXN0b3J5RGlzcGF0Y2hlcl0gPSB1c2VIaXN0b3J5KClcbmNvbnN0IGJvdW5kcyA9IGNvbXB1dGVkKCgpID0+IGdldFZhbHVlKHN0b3JlLmJvdW5kcykpXG5jb25zdCBbLCBjdXJzb3JEaXNwYXRjaGVyXSA9IHVzZUN1cnNvcigpXG5cbmNvbnN0IHNpemUgPSByZWYoMylcbmNvbnN0IGltYWdlRGF0YVJlZiA9IHJlZjxJbWFnZURhdGEgfCBudWxsPihudWxsKVxuY29uc3QgbW9zYWljUmVmID0gcmVmPGltcG9ydCgnLi4vLi4vLi4vdHlwZXMnKS5IaXN0b3J5SXRlbVNvdXJjZTxNb3NhaWNEYXRhLCBudWxsPiB8IG51bGw+KG51bGwpXG5cbmNvbnN0IGNoZWNrZWQgPSBjb21wdXRlZCgoKSA9PiBvcGVyYXRpb24gPT09ICdNb3NhaWMnKVxuXG5jb25zdCBzZWxlY3RNb3NhaWMgPSAoKSA9PiB7XG4gIG9wZXJhdGlvbkRpc3BhdGNoZXIuc2V0KCdNb3NhaWMnKVxuICBjdXJzb3JEaXNwYXRjaGVyLnNldCgnY3Jvc3NoYWlyJylcbn1cblxuY29uc3QgaGFuZGxlU2VsZWN0TW9zYWljID0gKCkgPT4ge1xuICBpZiAoY2hlY2tlZC52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG4gIHNlbGVjdE1vc2FpYygpXG4gIGhpc3RvcnlEaXNwYXRjaGVyLmNsZWFyU2VsZWN0KClcbn1cblxuY29uc3Qgc2V0U2l6ZSA9ICh2YWx1ZTogbnVtYmVyKSA9PiB7XG4gIHNpemUudmFsdWUgPSB2YWx1ZVxufVxuXG5jb25zdCBvbk1vdXNlZG93biA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSB8fCBtb3NhaWNSZWYudmFsdWUgfHwgIWltYWdlRGF0YVJlZi52YWx1ZSB8fCAhY2FudmFzQ29udGV4dFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgcmVjdCA9IGNhbnZhc0NvbnRleHRSZWYudmFsdWUuY2FudmFzIS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICBjb25zdCB4ID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0XG4gIGNvbnN0IHkgPSBlLmNsaWVudFkgLSByZWN0LnRvcFxuICBjb25zdCBtb3NhaWNTaXplID0gc2l6ZS52YWx1ZSAqIDJcbiAgbW9zYWljUmVmLnZhbHVlID0ge1xuICAgIG5hbWU6ICdNb3NhaWMnLFxuICAgIHR5cGU6IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UsXG4gICAgZGF0YToge1xuICAgICAgc2l6ZTogbW9zYWljU2l6ZSxcbiAgICAgIHRpbGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB4LFxuICAgICAgICAgIHksXG4gICAgICAgICAgY29sb3I6IGdldENvbG9yKHgsIHksIGltYWdlRGF0YVJlZi52YWx1ZSlcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0sXG4gICAgZWRpdEhpc3Rvcnk6IFtdLFxuICAgIGRyYXdcbiAgfVxufVxuXG5jb25zdCBvbk1vdXNlbW92ZSA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSB8fCAhbW9zYWljUmVmLnZhbHVlIHx8ICFjYW52YXNDb250ZXh0UmVmLnZhbHVlIHx8ICFpbWFnZURhdGFSZWYudmFsdWUpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IHJlY3QgPSBjYW52YXNDb250ZXh0UmVmLnZhbHVlLmNhbnZhcyEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgY29uc3QgeCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdFxuICBjb25zdCB5ID0gZS5jbGllbnRZIC0gcmVjdC50b3BcblxuICBjb25zdCBtb3NhaWNTaXplID0gbW9zYWljUmVmLnZhbHVlLmRhdGEuc2l6ZVxuICBjb25zdCBtb3NhaWNUaWxlcyA9IG1vc2FpY1JlZi52YWx1ZS5kYXRhLnRpbGVzXG5cbiAgbGV0IGxhc3RUaWxlID0gbW9zYWljVGlsZXNbbW9zYWljVGlsZXMubGVuZ3RoIC0gMV1cblxuICBpZiAoIWxhc3RUaWxlKSB7XG4gICAgbW9zYWljVGlsZXMucHVzaCh7XG4gICAgICB4LFxuICAgICAgeSxcbiAgICAgIGNvbG9yOiBnZXRDb2xvcih4LCB5LCBpbWFnZURhdGFSZWYudmFsdWUpXG4gICAgfSlcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBkeCA9IGxhc3RUaWxlLnggLSB4XG4gICAgY29uc3QgZHkgPSBsYXN0VGlsZS55IC0geVxuICAgIC8vIOWHj+Wwj+eCueeahOS4quaVsFxuICAgIGxldCBsZW5ndGggPSBNYXRoLnNxcnQoZHggKiogMiArIGR5ICoqIDIpXG4gICAgY29uc3Qgc2luID0gLWR5IC8gbGVuZ3RoXG4gICAgY29uc3QgY29zID0gLWR4IC8gbGVuZ3RoXG5cbiAgICB3aGlsZSAobGVuZ3RoID4gbW9zYWljU2l6ZSkge1xuICAgICAgY29uc3QgY3ggPSBNYXRoLmZsb29yKGxhc3RUaWxlLnggKyBtb3NhaWNTaXplICogY29zKVxuICAgICAgY29uc3QgY3kgPSBNYXRoLmZsb29yKGxhc3RUaWxlLnkgKyBtb3NhaWNTaXplICogc2luKVxuICAgICAgbGFzdFRpbGUgPSB7XG4gICAgICAgIHg6IGN4LFxuICAgICAgICB5OiBjeSxcbiAgICAgICAgY29sb3I6IGdldENvbG9yKGN4LCBjeSwgaW1hZ2VEYXRhUmVmLnZhbHVlKVxuICAgICAgfVxuICAgICAgbW9zYWljVGlsZXMucHVzaChsYXN0VGlsZSlcbiAgICAgIGxlbmd0aCAtPSBtb3NhaWNTaXplXG4gICAgfVxuXG4gICAgLy8g5pyA5ZCO5LiA5Liq5L2N572u6KGl5YWF5LiA5Z2XXG4gICAgaWYgKGxlbmd0aCA+IG1vc2FpY1NpemUgLyAyKSB7XG4gICAgICBtb3NhaWNUaWxlcy5wdXNoKHtcbiAgICAgICAgeCxcbiAgICAgICAgeSxcbiAgICAgICAgY29sb3I6IGdldENvbG9yKHgsIHksIGltYWdlRGF0YVJlZi52YWx1ZSlcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgaWYgKGhpc3RvcnkudG9wICE9PSBtb3NhaWNSZWYudmFsdWUpIHtcbiAgICBoaXN0b3J5RGlzcGF0Y2hlci5wdXNoKG1vc2FpY1JlZi52YWx1ZSlcbiAgfSBlbHNlIHtcbiAgICBoaXN0b3J5RGlzcGF0Y2hlci5zZXQoaGlzdG9yeSlcbiAgfVxufVxuXG5jb25zdCBvbk1vdXNldXAgPSAoKSA9PiB7XG4gIGlmICghY2hlY2tlZC52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgbW9zYWljUmVmLnZhbHVlID0gbnVsbFxufVxuXG53YXRjaChcbiAgKCkgPT4gW2JvdW5kcy52YWx1ZSwgaW1hZ2UudmFsdWUsIGNoZWNrZWQudmFsdWVdLFxuICAoKSA9PiB7XG4gICAgaWYgKCFib3VuZHMudmFsdWUgfHwgIWltYWdlLnZhbHVlIHx8ICFjaGVja2VkLnZhbHVlKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCAkY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcblxuICAgIGNvbnN0IGNhbnZhc0NvbnRleHQgPSAkY2FudmFzLmdldENvbnRleHQoJzJkJylcblxuICAgIGlmICghY2FudmFzQ29udGV4dCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgJGNhbnZhcy53aWR0aCA9IGJvdW5kcy52YWx1ZS53aWR0aFxuICAgICRjYW52YXMuaGVpZ2h0ID0gYm91bmRzLnZhbHVlLmhlaWdodFxuXG4gICAgY29uc3QgcnggPSBpbWFnZS52YWx1ZS5uYXR1cmFsV2lkdGggLyB3aWR0aC52YWx1ZVxuICAgIGNvbnN0IHJ5ID0gaW1hZ2UudmFsdWUubmF0dXJhbEhlaWdodCAvIGhlaWdodC52YWx1ZVxuXG4gICAgY2FudmFzQ29udGV4dC5kcmF3SW1hZ2UoXG4gICAgICBpbWFnZS52YWx1ZSxcbiAgICAgIGJvdW5kcy52YWx1ZS54ICogcngsXG4gICAgICBib3VuZHMudmFsdWUueSAqIHJ5LFxuICAgICAgYm91bmRzLnZhbHVlLndpZHRoICogcngsXG4gICAgICBib3VuZHMudmFsdWUuaGVpZ2h0ICogcnksXG4gICAgICAwLFxuICAgICAgMCxcbiAgICAgIGJvdW5kcy52YWx1ZS53aWR0aCxcbiAgICAgIGJvdW5kcy52YWx1ZS5oZWlnaHRcbiAgICApXG5cbiAgICBpbWFnZURhdGFSZWYudmFsdWUgPSBjYW52YXNDb250ZXh0LmdldEltYWdlRGF0YSgwLCAwLCBib3VuZHMudmFsdWUud2lkdGgsIGJvdW5kcy52YWx1ZS5oZWlnaHQpXG4gIH0sXG4gIHsgaW1tZWRpYXRlOiB0cnVlIH1cbilcblxudXNlQ2FudmFzTW91c2Vkb3duKG9uTW91c2Vkb3duKVxudXNlQ2FudmFzTW91c2Vtb3ZlKG9uTW91c2Vtb3ZlKVxudXNlQ2FudmFzTW91c2V1cChvbk1vdXNldXApXG48L3NjcmlwdD5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvdmlld3Mvc2NyZWVuc2hvdC9jb21wb25lbnRzL29wZXJhdGlvbnMvTW9zYWljL2luZGV4LnZ1ZSJ9