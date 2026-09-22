import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/components/ScreenshotsBackground.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, watch, onMounted, onUnmounted } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
import { getBoundsByPointsForBackground } from "/src/views/screenshot/utils/getBoundsByPoints.ts";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import ScreenshotsMagnifier from "/src/views/screenshot/components/ScreenshotsMagnifier.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "ScreenshotsBackground",
  setup(__props, { expose: __expose }) {
    __expose();
    const store = useStore();
    const url = computed(() => store.url);
    const image = computed(() => getValue(store.image));
    const width = computed(() => store.width);
    const height = computed(() => store.height);
    const bounds = computed(() => getValue(store.bounds));
    const elRef = ref(null);
    const pointRef = ref(null);
    const isMoveRef = ref(false);
    const position = ref(null);
    const updateBounds = (p1, p2) => {
      if (!elRef.value) {
        return;
      }
      const { x, y } = elRef.value.getBoundingClientRect();
      const boundsDispatcher = store.dispatcher?.setBounds;
      if (boundsDispatcher) {
        boundsDispatcher(
          getBoundsByPointsForBackground(
            {
              x: p1.x - x,
              y: p1.y - y
            },
            {
              x: p2.x - x,
              y: p2.y - y
            },
            width.value,
            height.value
          )
        );
      }
    };
    const handleMouseDown = (e) => {
      if (pointRef.value || bounds.value || e.button !== 0) {
        return;
      }
      pointRef.value = {
        x: e.clientX,
        y: e.clientY
      };
      isMoveRef.value = false;
    };
    let onMouseMove = null;
    let onMouseUp = null;
    onMounted(() => {
      onMouseMove = (e) => {
        if (elRef.value) {
          const rect = elRef.value.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientY < rect.top || e.clientX > rect.right || e.clientY > rect.bottom) {
            position.value = null;
          } else {
            position.value = {
              x: e.clientX - rect.x,
              y: e.clientY - rect.y
            };
          }
        }
        if (!pointRef.value) {
          return;
        }
        updateBounds(pointRef.value, {
          x: e.clientX,
          y: e.clientY
        });
        isMoveRef.value = true;
      };
      onMouseUp = (e) => {
        if (!pointRef.value) {
          return;
        }
        if (isMoveRef.value) {
          updateBounds(pointRef.value, {
            x: e.clientX,
            y: e.clientY
          });
        }
        pointRef.value = null;
        isMoveRef.value = false;
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
    onUnmounted(() => {
      if (onMouseMove) {
        window.removeEventListener("mousemove", onMouseMove);
        onMouseMove = null;
      }
      if (onMouseUp) {
        window.removeEventListener("mouseup", onMouseUp);
        onMouseUp = null;
      }
    });
    watch(
      () => [image.value, bounds.value],
      () => {
        if (!image.value || bounds.value) {
          position.value = null;
        }
      }
    );
    const __returned__ = { store, url, image, width, height, bounds, elRef, pointRef, isMoveRef, position, updateBounds, handleMouseDown, get onMouseMove() {
      return onMouseMove;
    }, set onMouseMove(v) {
      onMouseMove = v;
    }, get onMouseUp() {
      return onMouseUp;
    }, set onMouseUp(v) {
      onMouseUp = v;
    }, ScreenshotsMagnifier };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createElementVNode as _createElementVNode, openBlock as _openBlock, createBlock as _createBlock, createCommentVNode as _createCommentVNode, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = ["src"];
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return $setup.url && $setup.image ? (_openBlock(), _createElementBlock(
    "div",
    {
      key: 0,
      ref: "elRef",
      class: "screenshots-background",
      onMousedown: $setup.handleMouseDown
    },
    [
      _createElementVNode("img", {
        class: "screenshots-background-image",
        src: $setup.url
      }, null, 8, _hoisted_1),
      _cache[0] || (_cache[0] = _createElementVNode(
        "div",
        { class: "screenshots-background-mask" },
        null,
        -1
        /* CACHED */
      )),
      $setup.position && !$setup.bounds ? (_openBlock(), _createBlock($setup["ScreenshotsMagnifier"], {
        key: 0,
        x: $setup.position.x,
        y: $setup.position.y
      }, null, 8, ["x", "y"])) : _createCommentVNode("v-if", true)
    ],
    544
    /* NEED_HYDRATION, NEED_PATCH */
  )) : _createCommentVNode("v-if", true);
}
import "/src/views/screenshot/components/ScreenshotsBackground.vue?vue&type=style&index=0&scoped=33d5eb01&lang.css";
_sfc_main.__hmrId = "33d5eb01";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-33d5eb01"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/components/ScreenshotsBackground.vue"]]);

//# sourceMappingURL=data:application/json;base64,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aUJBQWlCLFdBQVcsU0FBUztBQUFBLElBQzlDLENBQUM7QUFFRCxnQkFBWSxNQUFNO0FBQ2hCLFVBQUksYUFBYTtBQUNmLGVBQU8sb0JBQW9CLGFBQWEsV0FBVztBQUNuRCxzQkFBYztBQUFBLE1BQ2hCO0FBQ0EsVUFBSSxXQUFXO0FBQ2IsZUFBTyxvQkFBb0IsV0FBVyxTQUFTO0FBQy9DLG9CQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0YsQ0FBQztBQUVEO0FBQUEsTUFDRSxNQUFNLENBQUMsTUFBTSxPQUFPLE9BQU8sS0FBSztBQUFBLE1BQ2hDLE1BQU07QUFDSixZQUFJLENBQUMsTUFBTSxTQUFTLE9BQU8sT0FBTztBQUNoQyxtQkFBUyxRQUFRO0FBQUEsUUFDbkI7QUFBQSxNQUNGO0FBQUEsSUFDRjs7Ozs7Ozs7Ozs7Ozs7Ozs7U0FwSWEsY0FBTyw4QkFBbEI7QUFBQSxJQUlNO0FBQUE7QUFBQTtNQUptQixLQUFJO0FBQUEsTUFBUSxPQUFNO0FBQUEsTUFBMEIsYUFBVztBQUFBOztNQUM5RSxvQkFBdUQ7QUFBQSxRQUFsRCxPQUFNO0FBQUEsUUFBZ0MsS0FBSztBQUFBO2dDQUNoRDtBQUFBLFFBQTJDO0FBQUEsVUFBdEMsT0FBTSw4QkFBNkI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BQ1osbUJBQVEsQ0FBSywrQkFBekMsYUFBbUY7QUFBQTtRQUFqQyxHQUFHLGdCQUFTO0FBQUEsUUFBSSxHQUFHLGdCQUFTO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlNjcmVlbnNob3RzQmFja2dyb3VuZC52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHRlbXBsYXRlPlxuICA8ZGl2IHYtaWY9XCJ1cmwgJiYgaW1hZ2VcIiByZWY9XCJlbFJlZlwiIGNsYXNzPVwic2NyZWVuc2hvdHMtYmFja2dyb3VuZFwiIEBtb3VzZWRvd249XCJoYW5kbGVNb3VzZURvd25cIj5cbiAgICA8aW1nIGNsYXNzPVwic2NyZWVuc2hvdHMtYmFja2dyb3VuZC1pbWFnZVwiIDpzcmM9XCJ1cmxcIiAvPlxuICAgIDxkaXYgY2xhc3M9XCJzY3JlZW5zaG90cy1iYWNrZ3JvdW5kLW1hc2tcIiAvPlxuICAgIDxTY3JlZW5zaG90c01hZ25pZmllciB2LWlmPVwicG9zaXRpb24gJiYgIWJvdW5kc1wiIDp4PVwicG9zaXRpb24ueFwiIDp5PVwicG9zaXRpb24ueVwiIC8+XG4gIDwvZGl2PlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgd2F0Y2gsIG9uTW91bnRlZCwgb25Vbm1vdW50ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgdHlwZSB7IFBvaW50LCBQb3NpdGlvbiB9IGZyb20gJy4uL3R5cGVzJ1xuaW1wb3J0IHsgdXNlU3RvcmUsIGdldFZhbHVlIH0gZnJvbSAnLi4vY29tcG9zYWJsZXMvdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuaW1wb3J0IHsgZ2V0Qm91bmRzQnlQb2ludHNGb3JCYWNrZ3JvdW5kIH0gZnJvbSAnLi4vdXRpbHMvZ2V0Qm91bmRzQnlQb2ludHMnXG5pbXBvcnQgeyBjb21wdXRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCBTY3JlZW5zaG90c01hZ25pZmllciBmcm9tICcuL1NjcmVlbnNob3RzTWFnbmlmaWVyLnZ1ZSdcblxuY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5jb25zdCB1cmwgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS51cmwpXG5jb25zdCBpbWFnZSA9IGNvbXB1dGVkKCgpID0+IGdldFZhbHVlKHN0b3JlLmltYWdlKSlcbmNvbnN0IHdpZHRoID0gY29tcHV0ZWQoKCkgPT4gc3RvcmUud2lkdGgpXG5jb25zdCBoZWlnaHQgPSBjb21wdXRlZCgoKSA9PiBzdG9yZS5oZWlnaHQpXG5jb25zdCBib3VuZHMgPSBjb21wdXRlZCgoKSA9PiBnZXRWYWx1ZShzdG9yZS5ib3VuZHMpKVxuY29uc3QgZWxSZWYgPSByZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKVxuY29uc3QgcG9pbnRSZWYgPSByZWY8UG9pbnQgfCBudWxsPihudWxsKVxuY29uc3QgaXNNb3ZlUmVmID0gcmVmPGJvb2xlYW4+KGZhbHNlKVxuY29uc3QgcG9zaXRpb24gPSByZWY8UG9zaXRpb24gfCBudWxsPihudWxsKVxuXG5jb25zdCB1cGRhdGVCb3VuZHMgPSAocDE6IFBvaW50LCBwMjogUG9pbnQpID0+IHtcbiAgaWYgKCFlbFJlZi52YWx1ZSkge1xuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IHsgeCwgeSB9ID0gZWxSZWYudmFsdWUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgY29uc3QgYm91bmRzRGlzcGF0Y2hlciA9IChzdG9yZSBhcyBhbnkpLmRpc3BhdGNoZXI/LnNldEJvdW5kc1xuICBpZiAoYm91bmRzRGlzcGF0Y2hlcikge1xuICAgIGJvdW5kc0Rpc3BhdGNoZXIoXG4gICAgICBnZXRCb3VuZHNCeVBvaW50c0ZvckJhY2tncm91bmQoXG4gICAgICAgIHtcbiAgICAgICAgICB4OiBwMS54IC0geCxcbiAgICAgICAgICB5OiBwMS55IC0geVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgeDogcDIueCAtIHgsXG4gICAgICAgICAgeTogcDIueSAtIHlcbiAgICAgICAgfSxcbiAgICAgICAgd2lkdGgudmFsdWUsXG4gICAgICAgIGhlaWdodC52YWx1ZVxuICAgICAgKVxuICAgIClcbiAgfVxufVxuXG5jb25zdCBoYW5kbGVNb3VzZURvd24gPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICBpZiAocG9pbnRSZWYudmFsdWUgfHwgYm91bmRzLnZhbHVlIHx8IGUuYnV0dG9uICE9PSAwKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgcG9pbnRSZWYudmFsdWUgPSB7XG4gICAgeDogZS5jbGllbnRYLFxuICAgIHk6IGUuY2xpZW50WVxuICB9XG4gIGlzTW92ZVJlZi52YWx1ZSA9IGZhbHNlXG59XG5cbi8vIEJ1ZyM3OiDlsIbkuovku7bnm5HlkKzlmajnp7vliLDpobblsYLvvIzpgb/lhY0gb25Nb3VudGVkIOW1jOWllyBvblVubW91bnRlZCDnmoTlj43mqKHlvI9cbmxldCBvbk1vdXNlTW92ZTogKChlOiBNb3VzZUV2ZW50KSA9PiB2b2lkKSB8IG51bGwgPSBudWxsXG5sZXQgb25Nb3VzZVVwOiAoKGU6IE1vdXNlRXZlbnQpID0+IHZvaWQpIHwgbnVsbCA9IG51bGxcblxub25Nb3VudGVkKCgpID0+IHtcbiAgb25Nb3VzZU1vdmUgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChlbFJlZi52YWx1ZSkge1xuICAgICAgY29uc3QgcmVjdCA9IGVsUmVmLnZhbHVlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gICAgICBpZiAoXG4gICAgICAgIGUuY2xpZW50WCA8IHJlY3QubGVmdCB8fFxuICAgICAgICBlLmNsaWVudFkgPCByZWN0LnRvcCB8fFxuICAgICAgICBlLmNsaWVudFggPiByZWN0LnJpZ2h0IHx8XG4gICAgICAgIGUuY2xpZW50WSA+IHJlY3QuYm90dG9tXG4gICAgICApIHtcbiAgICAgICAgcG9zaXRpb24udmFsdWUgPSBudWxsXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwb3NpdGlvbi52YWx1ZSA9IHtcbiAgICAgICAgICB4OiBlLmNsaWVudFggLSByZWN0LngsXG4gICAgICAgICAgeTogZS5jbGllbnRZIC0gcmVjdC55XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXBvaW50UmVmLnZhbHVlKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdXBkYXRlQm91bmRzKHBvaW50UmVmLnZhbHVlLCB7XG4gICAgICB4OiBlLmNsaWVudFgsXG4gICAgICB5OiBlLmNsaWVudFlcbiAgICB9KVxuICAgIGlzTW92ZVJlZi52YWx1ZSA9IHRydWVcbiAgfVxuXG4gIG9uTW91c2VVcCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgaWYgKCFwb2ludFJlZi52YWx1ZSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKGlzTW92ZVJlZi52YWx1ZSkge1xuICAgICAgdXBkYXRlQm91bmRzKHBvaW50UmVmLnZhbHVlLCB7XG4gICAgICAgIHg6IGUuY2xpZW50WCxcbiAgICAgICAgeTogZS5jbGllbnRZXG4gICAgICB9KVxuICAgIH1cbiAgICBwb2ludFJlZi52YWx1ZSA9IG51bGxcbiAgICBpc01vdmVSZWYudmFsdWUgPSBmYWxzZVxuICB9XG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlKVxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcClcbn0pXG5cbm9uVW5tb3VudGVkKCgpID0+IHtcbiAgaWYgKG9uTW91c2VNb3ZlKSB7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlKVxuICAgIG9uTW91c2VNb3ZlID0gbnVsbFxuICB9XG4gIGlmIChvbk1vdXNlVXApIHtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcClcbiAgICBvbk1vdXNlVXAgPSBudWxsXG4gIH1cbn0pXG5cbndhdGNoKFxuICAoKSA9PiBbaW1hZ2UudmFsdWUsIGJvdW5kcy52YWx1ZV0sXG4gICgpID0+IHtcbiAgICBpZiAoIWltYWdlLnZhbHVlIHx8IGJvdW5kcy52YWx1ZSkge1xuICAgICAgcG9zaXRpb24udmFsdWUgPSBudWxsXG4gICAgfVxuICB9XG4pXG48L3NjcmlwdD5cblxuPHN0eWxlIHNjb3BlZD5cbi5zY3JlZW5zaG90cy1iYWNrZ3JvdW5kIHtcbiAgd2lkdGg6IDEwMCU7XG4gIGhlaWdodDogMTAwJTtcbiAgcG9zaXRpb246IHJlbGF0aXZlO1xufVxuXG4uc2NyZWVuc2hvdHMtYmFja2dyb3VuZC1pbWFnZSB7XG4gIHdpZHRoOiAxMDAlO1xuICBoZWlnaHQ6IDEwMCU7XG4gIGRpc3BsYXk6IGJsb2NrO1xuICBib3JkZXI6IG5vbmU7XG4gIG91dGxpbmU6IG5vbmU7XG4gIGltYWdlLXJlbmRlcmluZzogLXdlYmtpdC1vcHRpbWl6ZS1jb250cmFzdDtcbiAgaW1hZ2UtcmVuZGVyaW5nOiBjcmlzcC1lZGdlcztcbiAgLXdlYmtpdC1mb250LXNtb290aGluZzogYW50aWFsaWFzZWQ7XG59XG5cbi5zY3JlZW5zaG90cy1iYWNrZ3JvdW5kLW1hc2sge1xuICB3aWR0aDogMTAwJTtcbiAgaGVpZ2h0OiAxMDAlO1xuICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gIHRvcDogMDtcbiAgcmlnaHQ6IDA7XG4gIGJvdHRvbTogMDtcbiAgbGVmdDogMDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiYSgwLCAwLCAwLCAwLjM1KTtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvY29tcG9uZW50cy9TY3JlZW5zaG90c0JhY2tncm91bmQudnVlIn0=