import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/EmojiSuggest.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { ref, computed, watch } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { parseEmojiTrigger, searchEmoji } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/emoji.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "EmojiSuggest",
  props: {
    text: { type: String, required: true }
  },
  emits: ["pick"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const selectedIndex = ref(0);
    const forcedHidden = ref(false);
    const trigger = computed(() => parseEmojiTrigger(props.text));
    const visible = computed(
      () => !forcedHidden.value && !!trigger.value && trigger.value.query.length >= 1
    );
    const matches = computed(
      () => trigger.value ? searchEmoji(trigger.value.query, 6) : []
    );
    watch(visible, (v) => {
      if (v) selectedIndex.value = 0;
      else forcedHidden.value = false;
    });
    function pick(emoji) {
      forcedHidden.value = true;
      emit("pick", emoji);
    }
    function consumeKey(e) {
      if (!visible.value) return false;
      const len = matches.value.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (len > 0) selectedIndex.value = (selectedIndex.value + 1) % len;
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (len > 0) selectedIndex.value = (selectedIndex.value - 1 + len) % len;
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const target = matches.value[selectedIndex.value];
        if (target) pick(target.emoji);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        forcedHidden.value = true;
        return true;
      }
      return false;
    }
    __expose({ consumeKey });
    const __returned__ = { props, emit, selectedIndex, forcedHidden, trigger, visible, matches, pick, consumeKey };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, renderList as _renderList, Fragment as _Fragment, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, withModifiers as _withModifiers, normalizeClass as _normalizeClass, Transition as _Transition, withCtx as _withCtx, createVNode as _createVNode } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = {
  key: 0,
  class: "emoji-suggest"
};
const _hoisted_2 = {
  key: 0,
  class: "es-empty"
};
const _hoisted_3 = ["onMouseenter", "onMousedown"];
const _hoisted_4 = { class: "es-glyph" };
const _hoisted_5 = { class: "es-name" };
const _hoisted_6 = { class: "es-cat" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock(
    _Fragment,
    null,
    [
      _createCommentVNode(" 输入域内联 :emoji 补全弹层（Raycast v2.1 式）。由父组件负责定位与文本替换。 "),
      _createVNode(_Transition, { name: "es-pop" }, {
        default: _withCtx(() => [
          $setup.visible ? (_openBlock(), _createElementBlock("div", _hoisted_1, [
            $setup.matches.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_2, "没有匹配的 Emoji")) : _createCommentVNode("v-if", true),
            (_openBlock(true), _createElementBlock(
              _Fragment,
              null,
              _renderList($setup.matches, (item, i) => {
                return _openBlock(), _createElementBlock("div", {
                  key: item.emoji,
                  class: _normalizeClass(["es-item", { selected: i === $setup.selectedIndex }]),
                  onMouseenter: ($event) => $setup.selectedIndex = i,
                  onMousedown: _withModifiers(($event) => $setup.pick(item.emoji), ["prevent"])
                }, [
                  _createElementVNode(
                    "span",
                    _hoisted_4,
                    _toDisplayString(item.emoji),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode(
                    "span",
                    _hoisted_5,
                    _toDisplayString(item.name),
                    1
                    /* TEXT */
                  ),
                  _createElementVNode(
                    "span",
                    _hoisted_6,
                    _toDisplayString(item.category),
                    1
                    /* TEXT */
                  )
                ], 42, _hoisted_3);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : _createCommentVNode("v-if", true)
        ]),
        _: 1
        /* STABLE */
      })
    ],
    2112
    /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
  );
}
import "/src/components/EmojiSuggest.vue?vue&type=style&index=0&scoped=95b2d632&lang.css";
_sfc_main.__hmrId = "95b2d632";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-95b2d632"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/EmojiSuggest.vue"]]);

//# sourceMappingURL=data:application/json;base64,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Im5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRW1vamlTdWdnZXN0LnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDwhLS0g6L6T5YWl5Z+f5YaF6IGUIDplbW9qaSDooaXlhajlvLnlsYLvvIhSYXljYXN0IHYyLjEg5byP77yJ44CC55Sx54i257uE5Lu26LSf6LSj5a6a5L2N5LiO5paH5pys5pu/5o2i44CCIC0tPlxuICA8VHJhbnNpdGlvbiBuYW1lPVwiZXMtcG9wXCI+XG4gICAgPGRpdiB2LWlmPVwidmlzaWJsZVwiIGNsYXNzPVwiZW1vamktc3VnZ2VzdFwiPlxuICAgICAgPGRpdiB2LWlmPVwibWF0Y2hlcy5sZW5ndGggPT09IDBcIiBjbGFzcz1cImVzLWVtcHR5XCI+5rKh5pyJ5Yy56YWN55qEIEVtb2ppPC9kaXY+XG4gICAgICA8ZGl2XG4gICAgICAgIHYtZm9yPVwiKGl0ZW0sIGkpIGluIG1hdGNoZXNcIlxuICAgICAgICA6a2V5PVwiaXRlbS5lbW9qaVwiXG4gICAgICAgIGNsYXNzPVwiZXMtaXRlbVwiXG4gICAgICAgIDpjbGFzcz1cInsgc2VsZWN0ZWQ6IGkgPT09IHNlbGVjdGVkSW5kZXggfVwiXG4gICAgICAgIEBtb3VzZWVudGVyPVwic2VsZWN0ZWRJbmRleCA9IGlcIlxuICAgICAgICBAbW91c2Vkb3duLnByZXZlbnQ9XCJwaWNrKGl0ZW0uZW1vamkpXCJcbiAgICAgID5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJlcy1nbHlwaFwiPnt7IGl0ZW0uZW1vamkgfX08L3NwYW4+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiZXMtbmFtZVwiPnt7IGl0ZW0ubmFtZSB9fTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJlcy1jYXRcIj57eyBpdGVtLmNhdGVnb3J5IH19PC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvVHJhbnNpdGlvbj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyByZWYsIGNvbXB1dGVkLCB3YXRjaCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB7IHBhcnNlRW1vamlUcmlnZ2VyLCBzZWFyY2hFbW9qaSB9IGZyb20gJ0BzaGFyZWQvZW1vamknXG5pbXBvcnQgdHlwZSB7IEVtb2ppSXRlbSB9IGZyb20gJ0BzaGFyZWQvZW1vamknXG5cbmNvbnN0IHByb3BzID0gZGVmaW5lUHJvcHM8e1xuICAvKiog6L6T5YWl5qGG5b2T5YmN5paH5pys77yI5ZCr5YWJ5qCH5YmN5YaF5a6577yJ77yM5o2u5q2k6Kej5p6QIDpxdWVyeSAqL1xuICB0ZXh0OiBzdHJpbmdcbn0+KClcblxuY29uc3QgZW1pdCA9IGRlZmluZUVtaXRzPHtcbiAgcGljazogW2Vtb2ppOiBzdHJpbmddXG59PigpXG5cbmNvbnN0IHNlbGVjdGVkSW5kZXggPSByZWYoMClcbmNvbnN0IGZvcmNlZEhpZGRlbiA9IHJlZihmYWxzZSlcblxuY29uc3QgdHJpZ2dlciA9IGNvbXB1dGVkKCgpID0+IHBhcnNlRW1vamlUcmlnZ2VyKHByb3BzLnRleHQpKVxuY29uc3QgdmlzaWJsZSA9IGNvbXB1dGVkKFxuICAoKSA9PiAhZm9yY2VkSGlkZGVuLnZhbHVlICYmICEhdHJpZ2dlci52YWx1ZSAmJiB0cmlnZ2VyLnZhbHVlLnF1ZXJ5Lmxlbmd0aCA+PSAxXG4pXG5cbmNvbnN0IG1hdGNoZXMgPSBjb21wdXRlZDxFbW9qaUl0ZW1bXT4oKCkgPT5cbiAgdHJpZ2dlci52YWx1ZSA/IHNlYXJjaEVtb2ppKHRyaWdnZXIudmFsdWUucXVlcnksIDYpIDogW11cbilcblxud2F0Y2godmlzaWJsZSwgKHYpID0+IHtcbiAgaWYgKHYpIHNlbGVjdGVkSW5kZXgudmFsdWUgPSAwXG4gIGVsc2UgZm9yY2VkSGlkZGVuLnZhbHVlID0gZmFsc2Vcbn0pXG5cbmZ1bmN0aW9uIHBpY2soZW1vamk6IHN0cmluZyk6IHZvaWQge1xuICBmb3JjZWRIaWRkZW4udmFsdWUgPSB0cnVlXG4gIGVtaXQoJ3BpY2snLCBlbW9qaSlcbn1cblxuLyoqXG4gKiDnlLHniLbovpPlhaXmoYblnKgga2V5ZG93biDml7bosIPnlKjvvJrlvLnlsYLmiZPlvIDml7bmtojotLnmlrnlkJHplK4v5Zue6L2mL1RhYi9Fc2PjgIJcbiAqIEByZXR1cm5zIHRydWUg6KGo56S65LqL5Lu25bey6KKr5by55bGC5raI6LS577yI54i25LiN5YaN5aSE55CGIEVudGVyIOWPkemAgeetie+8iVxuICovXG5mdW5jdGlvbiBjb25zdW1lS2V5KGU6IEtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcbiAgaWYgKCF2aXNpYmxlLnZhbHVlKSByZXR1cm4gZmFsc2VcbiAgY29uc3QgbGVuID0gbWF0Y2hlcy52YWx1ZS5sZW5ndGhcbiAgaWYgKGUua2V5ID09PSAnQXJyb3dEb3duJykge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGlmIChsZW4gPiAwKSBzZWxlY3RlZEluZGV4LnZhbHVlID0gKHNlbGVjdGVkSW5kZXgudmFsdWUgKyAxKSAlIGxlblxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgaWYgKGUua2V5ID09PSAnQXJyb3dVcCcpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBpZiAobGVuID4gMCkgc2VsZWN0ZWRJbmRleC52YWx1ZSA9IChzZWxlY3RlZEluZGV4LnZhbHVlIC0gMSArIGxlbikgJSBsZW5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmIChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJ1RhYicpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB0YXJnZXQgPSBtYXRjaGVzLnZhbHVlW3NlbGVjdGVkSW5kZXgudmFsdWVdXG4gICAgaWYgKHRhcmdldCkgcGljayh0YXJnZXQuZW1vamkpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgZm9yY2VkSGlkZGVuLnZhbHVlID0gdHJ1ZVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmRlZmluZUV4cG9zZSh7IGNvbnN1bWVLZXkgfSlcbjwvc2NyaXB0PlxuXG48c3R5bGUgc2NvcGVkPlxuLmVtb2ppLXN1Z2dlc3Qge1xuICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gIGJvdHRvbTogY2FsYygxMDAlICsgNnB4KTtcbiAgbGVmdDogMDtcbiAgbWluLXdpZHRoOiAyNDBweDtcbiAgbWF4LXdpZHRoOiAzMjBweDtcbiAgcGFkZGluZzogNHB4O1xuICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1ib3JkZXIpO1xuICBib3JkZXItcmFkaXVzOiAxMHB4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1wb3BvdmVyLWJnKTtcbiAgYm94LXNoYWRvdzogMCAxMnB4IDMycHggcmdiYSgwLCAwLCAwLCAwLjE4KTtcbiAgei1pbmRleDogMTIwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xufVxuXG4uZXMtaXRlbSB7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogOHB4O1xuICBwYWRkaW5nOiA1cHggOHB4O1xuICBib3JkZXItcmFkaXVzOiA2cHg7XG4gIGN1cnNvcjogcG9pbnRlcjtcbn1cblxuLmVzLWl0ZW0uc2VsZWN0ZWQge1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1sYXVuY2hlci1hY2NlbnQtc29mdCk7XG59XG5cbi5lcy1nbHlwaCB7XG4gIGZvbnQtc2l6ZTogMTZweDtcbiAgbGluZS1oZWlnaHQ6IDE7XG59XG5cbi5lcy1uYW1lIHtcbiAgZmxleDogMTtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIG92ZXJmbG93OiBoaWRkZW47XG4gIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xufVxuXG4uZXMtY2F0IHtcbiAgZm9udC1zaXplOiAxMHB4O1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1mYWludCk7XG59XG5cbi5lcy1lbXB0eSB7XG4gIHBhZGRpbmc6IDEwcHg7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgdGV4dC1hbGlnbjogY2VudGVyO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1tdXRlZCk7XG59XG5cbi5lcy1wb3AtZW50ZXItYWN0aXZlLFxuLmVzLXBvcC1sZWF2ZS1hY3RpdmUge1xuICB0cmFuc2l0aW9uOlxuICAgIG9wYWNpdHkgMC4xcyBlYXNlLFxuICAgIHRyYW5zZm9ybSAwLjFzIGVhc2U7XG59XG5cbi5lcy1wb3AtZW50ZXItZnJvbSxcbi5lcy1wb3AtbGVhdmUtdG8ge1xuICBvcGFjaXR5OiAwO1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoM3B4KTtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2NvbXBvbmVudHMvRW1vamlTdWdnZXN0LnZ1ZSJ9