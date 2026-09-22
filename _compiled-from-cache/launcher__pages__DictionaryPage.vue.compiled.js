import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/pages/DictionaryPage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, watch, onMounted } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import AppIcon from "/src/components/AppIcon.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "DictionaryPage",
  props: {
    query: { type: String, required: false }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const word = ref("");
    const loading = ref(false);
    const definitions = ref([]);
    async function queryWord(w) {
      if (!w.trim()) {
        definitions.value = [];
        return;
      }
      loading.value = true;
      try {
        definitions.value = await window.api.dictionary.query(w.trim());
      } catch (err) {
        console.warn("DictionaryPage: query failed", err);
        definitions.value = [];
      } finally {
        loading.value = false;
      }
    }
    function openInMacDictionary() {
      if (word.value) void window.api.dictionary.open(word.value);
    }
    watch(
      () => props.query,
      (q) => {
        if (q && q.trim()) {
          word.value = q.trim();
          void queryWord(word.value);
        }
      }
    );
    onMounted(() => {
      if (props.query?.trim()) {
        word.value = props.query.trim();
        void queryWord(word.value);
      }
    });
    const __returned__ = { props, word, loading, definitions, queryWord, openInMacDictionary, AppIcon };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, renderList as _renderList, Fragment as _Fragment } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "dict-page" };
const _hoisted_2 = {
  key: 0,
  class: "dict-prompt"
};
const _hoisted_3 = {
  key: 1,
  class: "dict-loading"
};
const _hoisted_4 = {
  key: 2,
  class: "dict-empty"
};
const _hoisted_5 = {
  key: 3,
  class: "dict-content"
};
const _hoisted_6 = { class: "dict-header" };
const _hoisted_7 = { class: "dict-word" };
const _hoisted_8 = {
  key: 0,
  class: "dict-phonetic"
};
const _hoisted_9 = { class: "dict-meanings" };
const _hoisted_10 = { class: "dict-pos" };
const _hoisted_11 = { class: "dict-defs" };
const _hoisted_12 = {
  key: 0,
  class: "dict-example"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    !$setup.word ? (_openBlock(), _createElementBlock("div", _hoisted_2, [
      _createVNode($setup["AppIcon"], {
        icon: "book-2",
        size: 28
      }),
      _cache[0] || (_cache[0] = _createElementVNode(
        "span",
        null,
        "输入要查询的英文单词",
        -1
        /* CACHED */
      ))
    ])) : $setup.loading ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
      _createVNode($setup["AppIcon"], {
        icon: "loader-4",
        size: 18,
        class: "spin"
      }),
      _createElementVNode(
        "span",
        null,
        "查询 " + _toDisplayString($setup.word) + "…",
        1
        /* TEXT */
      )
    ])) : $setup.definitions.length === 0 ? (_openBlock(), _createElementBlock("div", _hoisted_4, [
      _createVNode($setup["AppIcon"], {
        icon: "error-warning",
        size: 24
      }),
      _createElementVNode(
        "span",
        null,
        '未找到 "' + _toDisplayString($setup.word) + '" 的释义',
        1
        /* TEXT */
      ),
      _createElementVNode("button", {
        class: "dict-open-btn",
        onClick: $setup.openInMacDictionary
      }, " 在 macOS 词典中打开 ")
    ])) : (_openBlock(), _createElementBlock("div", _hoisted_5, [
      _createElementVNode("div", _hoisted_6, [
        _createElementVNode(
          "span",
          _hoisted_7,
          _toDisplayString($setup.word),
          1
          /* TEXT */
        ),
        $setup.definitions[0]?.phonetic ? (_openBlock(), _createElementBlock(
          "span",
          _hoisted_8,
          _toDisplayString($setup.definitions[0].phonetic),
          1
          /* TEXT */
        )) : _createCommentVNode("v-if", true),
        _createElementVNode("button", {
          class: "dict-open-btn",
          onClick: $setup.openInMacDictionary
        }, [
          _createVNode($setup["AppIcon"], {
            icon: "external-link",
            size: 12
          }),
          _cache[1] || (_cache[1] = _createElementVNode(
            "span",
            null,
            "词典",
            -1
            /* CACHED */
          ))
        ])
      ]),
      _createElementVNode("div", _hoisted_9, [
        (_openBlock(true), _createElementBlock(
          _Fragment,
          null,
          _renderList($setup.definitions[0].meanings, (meaning, mi) => {
            return _openBlock(), _createElementBlock("div", {
              key: mi,
              class: "dict-meaning"
            }, [
              _createElementVNode(
                "div",
                _hoisted_10,
                _toDisplayString(meaning.partOfSpeech),
                1
                /* TEXT */
              ),
              _createElementVNode("ol", _hoisted_11, [
                (_openBlock(true), _createElementBlock(
                  _Fragment,
                  null,
                  _renderList(meaning.definitions.slice(0, 3), (def, di) => {
                    return _openBlock(), _createElementBlock("li", {
                      key: di,
                      class: "dict-def"
                    }, [
                      _createElementVNode(
                        "span",
                        null,
                        _toDisplayString(def.definition),
                        1
                        /* TEXT */
                      ),
                      def.example ? (_openBlock(), _createElementBlock(
                        "span",
                        _hoisted_12,
                        '"' + _toDisplayString(def.example) + '"',
                        1
                        /* TEXT */
                      )) : _createCommentVNode("v-if", true)
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])
    ]))
  ]);
}
import "/src/launcher/pages/DictionaryPage.vue?vue&type=style&index=0&scoped=ae2facbe&lang.css";
_sfc_main.__hmrId = "ae2facbe";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ae2facbe"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/pages/DictionaryPage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QkFBVyxHQUFJLFFBQVE7QUFBQTtBQUFBO0FBQUE7UUFFNUIsb0JBR1M7QUFBQSxVQUhELE9BQU07QUFBQSxVQUFpQixTQUFPO0FBQUE7VUFDcEMsYUFBMkM7QUFBQSxZQUFsQyxNQUFLO0FBQUEsWUFBaUIsTUFBTTtBQUFBO29DQUNyQztBQUFBLFlBQWU7QUFBQTtBQUFBLFlBQVQ7QUFBQSxZQUFFO0FBQUE7QUFBQTtBQUFBOztNQUdaLG9CQVVNLE9BVk4sWUFVTTtBQUFBLDJCQVRKO0FBQUEsVUFRTTtBQUFBO0FBQUEsc0JBUnVCLG1CQUFXLEdBQUksVUFBUSxDQUF2QyxTQUFTLE9BQUU7aUNBQXhCLG9CQVFNO0FBQUEsY0FSaUQsS0FBSztBQUFBLGNBQUksT0FBTTtBQUFBO2NBQ3BFO0FBQUEsZ0JBQXNEO0FBQUEsZ0JBQXREO0FBQUEsZ0JBQXNELGlCQUE3QixRQUFRLFlBQVk7QUFBQTtBQUFBO0FBQUE7QUFBQSxjQUM3QyxvQkFLSyxNQUxMLGFBS0s7QUFBQSxtQ0FKSDtBQUFBLGtCQUdLO0FBQUE7QUFBQSw4QkFIbUIsUUFBUSxZQUFZLE1BQUssUUFBckMsS0FBSyxPQUFFO3lDQUFuQixvQkFHSztBQUFBLHNCQUhxRCxLQUFLO0FBQUEsc0JBQUksT0FBTTtBQUFBO3NCQUN2RTtBQUFBLHdCQUFpQztBQUFBO0FBQUEseUNBQXhCLElBQUksVUFBVTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUNYLElBQUkseUJBQWhCO0FBQUEsd0JBQXdFO0FBQUEsd0JBQXhFO0FBQUEsd0JBQThDLE1BQUMsaUJBQUcsSUFBSSxPQUFPLElBQUc7QUFBQSx3QkFBQztBQUFBO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkRpY3Rpb25hcnlQYWdlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJkaWN0LXBhZ2VcIj5cbiAgICA8ZGl2IHYtaWY9XCIhd29yZFwiIGNsYXNzPVwiZGljdC1wcm9tcHRcIj5cbiAgICAgIDxBcHBJY29uIGljb249XCJib29rLTJcIiA6c2l6ZT1cIjI4XCIgLz5cbiAgICAgIDxzcGFuPui+k+WFpeimgeafpeivoueahOiLseaWh+WNleivjTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHYtZWxzZS1pZj1cImxvYWRpbmdcIiBjbGFzcz1cImRpY3QtbG9hZGluZ1wiPlxuICAgICAgPEFwcEljb24gaWNvbj1cImxvYWRlci00XCIgOnNpemU9XCIxOFwiIGNsYXNzPVwic3BpblwiIC8+XG4gICAgICA8c3Bhbj7mn6Xor6Ige3sgd29yZCB9feKApjwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IHYtZWxzZS1pZj1cImRlZmluaXRpb25zLmxlbmd0aCA9PT0gMFwiIGNsYXNzPVwiZGljdC1lbXB0eVwiPlxuICAgICAgPEFwcEljb24gaWNvbj1cImVycm9yLXdhcm5pbmdcIiA6c2l6ZT1cIjI0XCIgLz5cbiAgICAgIDxzcGFuPuacquaJvuWIsCBcInt7IHdvcmQgfX1cIiDnmoTph4rkuYk8L3NwYW4+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiZGljdC1vcGVuLWJ0blwiIEBjbGljaz1cIm9wZW5Jbk1hY0RpY3Rpb25hcnlcIj5cbiAgICAgICAg5ZyoIG1hY09TIOivjeWFuOS4reaJk+W8gFxuICAgICAgPC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdiB2LWVsc2UgY2xhc3M9XCJkaWN0LWNvbnRlbnRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkaWN0LWhlYWRlclwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImRpY3Qtd29yZFwiPnt7IHdvcmQgfX08L3NwYW4+XG4gICAgICAgIDxzcGFuIHYtaWY9XCJkZWZpbml0aW9uc1swXT8ucGhvbmV0aWNcIiBjbGFzcz1cImRpY3QtcGhvbmV0aWNcIj5cbiAgICAgICAgICB7eyBkZWZpbml0aW9uc1swXS5waG9uZXRpYyB9fVxuICAgICAgICA8L3NwYW4+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJkaWN0LW9wZW4tYnRuXCIgQGNsaWNrPVwib3BlbkluTWFjRGljdGlvbmFyeVwiPlxuICAgICAgICAgIDxBcHBJY29uIGljb249XCJleHRlcm5hbC1saW5rXCIgOnNpemU9XCIxMlwiIC8+XG4gICAgICAgICAgPHNwYW4+6K+N5YW4PC9zcGFuPlxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRpY3QtbWVhbmluZ3NcIj5cbiAgICAgICAgPGRpdiB2LWZvcj1cIihtZWFuaW5nLCBtaSkgaW4gZGVmaW5pdGlvbnNbMF0ubWVhbmluZ3NcIiA6a2V5PVwibWlcIiBjbGFzcz1cImRpY3QtbWVhbmluZ1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkaWN0LXBvc1wiPnt7IG1lYW5pbmcucGFydE9mU3BlZWNoIH19PC9kaXY+XG4gICAgICAgICAgPG9sIGNsYXNzPVwiZGljdC1kZWZzXCI+XG4gICAgICAgICAgICA8bGkgdi1mb3I9XCIoZGVmLCBkaSkgaW4gbWVhbmluZy5kZWZpbml0aW9ucy5zbGljZSgwLCAzKVwiIDprZXk9XCJkaVwiIGNsYXNzPVwiZGljdC1kZWZcIj5cbiAgICAgICAgICAgICAgPHNwYW4+e3sgZGVmLmRlZmluaXRpb24gfX08L3NwYW4+XG4gICAgICAgICAgICAgIDxzcGFuIHYtaWY9XCJkZWYuZXhhbXBsZVwiIGNsYXNzPVwiZGljdC1leGFtcGxlXCI+XCJ7eyBkZWYuZXhhbXBsZSB9fVwiPC9zcGFuPlxuICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICA8L29sPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICA8L2Rpdj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyByZWYsIHdhdGNoLCBvbk1vdW50ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgQXBwSWNvbiBmcm9tICdAY29tcG9uZW50cy9BcHBJY29uLnZ1ZSdcblxuaW50ZXJmYWNlIERpY3Rpb25hcnlEZWZpbml0aW9uIHtcbiAgd29yZDogc3RyaW5nXG4gIHBob25ldGljPzogc3RyaW5nXG4gIG1lYW5pbmdzOiBBcnJheTx7XG4gICAgcGFydE9mU3BlZWNoOiBzdHJpbmdcbiAgICBkZWZpbml0aW9uczogQXJyYXk8e1xuICAgICAgZGVmaW5pdGlvbjogc3RyaW5nXG4gICAgICBleGFtcGxlPzogc3RyaW5nXG4gICAgfT5cbiAgfT5cbn1cblxuY29uc3QgcHJvcHMgPSBkZWZpbmVQcm9wczx7IHF1ZXJ5Pzogc3RyaW5nIH0+KClcblxuY29uc3Qgd29yZCA9IHJlZignJylcbmNvbnN0IGxvYWRpbmcgPSByZWYoZmFsc2UpXG5jb25zdCBkZWZpbml0aW9ucyA9IHJlZjxEaWN0aW9uYXJ5RGVmaW5pdGlvbltdPihbXSlcblxuLy8gcHJvcHMucXVlcnkg5piv6IO25ZuK5Lyg5YWl55qE5pCc57Si6K+N77yb5pys6aG15p+l6K+i5Yqo5L2c55qE5Ye95pWw5ZCN6YG/5YWN5LiOIHByb3Ag6YeN5ZCN77yIdnVlL25vLWR1cGUta2V5c++8iVxuYXN5bmMgZnVuY3Rpb24gcXVlcnlXb3JkKHc6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIXcudHJpbSgpKSB7XG4gICAgZGVmaW5pdGlvbnMudmFsdWUgPSBbXVxuICAgIHJldHVyblxuICB9XG4gIGxvYWRpbmcudmFsdWUgPSB0cnVlXG4gIHRyeSB7XG4gICAgZGVmaW5pdGlvbnMudmFsdWUgPSAoYXdhaXQgd2luZG93LmFwaS5kaWN0aW9uYXJ5LnF1ZXJ5KHcudHJpbSgpKSkgYXMgRGljdGlvbmFyeURlZmluaXRpb25bXVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLndhcm4oJ0RpY3Rpb25hcnlQYWdlOiBxdWVyeSBmYWlsZWQnLCBlcnIpXG4gICAgZGVmaW5pdGlvbnMudmFsdWUgPSBbXVxuICB9IGZpbmFsbHkge1xuICAgIGxvYWRpbmcudmFsdWUgPSBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIG9wZW5Jbk1hY0RpY3Rpb25hcnkoKTogdm9pZCB7XG4gIGlmICh3b3JkLnZhbHVlKSB2b2lkIHdpbmRvdy5hcGkuZGljdGlvbmFyeS5vcGVuKHdvcmQudmFsdWUpXG59XG5cbndhdGNoKFxuICAoKSA9PiBwcm9wcy5xdWVyeSxcbiAgKHEpID0+IHtcbiAgICBpZiAocSAmJiBxLnRyaW0oKSkge1xuICAgICAgd29yZC52YWx1ZSA9IHEudHJpbSgpXG4gICAgICB2b2lkIHF1ZXJ5V29yZCh3b3JkLnZhbHVlKVxuICAgIH1cbiAgfVxuKVxuXG5vbk1vdW50ZWQoKCkgPT4ge1xuICBpZiAocHJvcHMucXVlcnk/LnRyaW0oKSkge1xuICAgIHdvcmQudmFsdWUgPSBwcm9wcy5xdWVyeS50cmltKClcbiAgICB2b2lkIHF1ZXJ5V29yZCh3b3JkLnZhbHVlKVxuICB9XG59KVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQ+XG4uZGljdC1wYWdlIHtcbiAgaGVpZ2h0OiAxMDAlO1xuICBvdmVyZmxvdy15OiBhdXRvO1xuICBwYWRkaW5nOiAxNnB4O1xufVxuXG4uZGljdC1wcm9tcHQsXG4uZGljdC1sb2FkaW5nLFxuLmRpY3QtZW1wdHkge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgaGVpZ2h0OiAxMDAlO1xuICBnYXA6IDEwcHg7XG4gIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNCk7XG4gIGZvbnQtc2l6ZTogMTNweDtcbn1cblxuLmRpY3QtZW1wdHkge1xuICBnYXA6IDE0cHg7XG59XG5cbi5zcGluIHtcbiAgYW5pbWF0aW9uOiBzcGluIDFzIGxpbmVhciBpbmZpbml0ZTtcbn1cblxuQGtleWZyYW1lcyBzcGluIHtcbiAgdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG59XG5cbi5kaWN0LW9wZW4tYnRuIHtcbiAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGdhcDogNXB4O1xuICBwYWRkaW5nOiA2cHggMTRweDtcbiAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgwLCAxMjIsIDI1NSwgMC4zKTtcbiAgYm9yZGVyLXJhZGl1czogNnB4O1xuICBiYWNrZ3JvdW5kOiByZ2JhKDAsIDEyMiwgMjU1LCAwLjA2KTtcbiAgY29sb3I6ICMwMDdBRkY7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMTVzO1xufVxuXG4uZGljdC1vcGVuLWJ0bjpob3ZlciB7XG4gIGJhY2tncm91bmQ6IHJnYmEoMCwgMTIyLCAyNTUsIDAuMTIpO1xufVxuXG4uZGljdC1oZWFkZXIge1xuICBkaXNwbGF5OiBmbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBnYXA6IDEwcHg7XG4gIG1hcmdpbi1ib3R0b206IDE2cHg7XG4gIHBhZGRpbmctYm90dG9tOiAxMnB4O1xuICBib3JkZXItYm90dG9tOiAxcHggc29saWQgcmdiYSgwLCAwLCAwLCAwLjA4KTtcbn1cblxuLmRpY3Qtd29yZCB7XG4gIGZvbnQtc2l6ZTogMjJweDtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgY29sb3I6IHJnYmEoMCwgMCwgMCwgMC45KTtcbn1cblxuLmRpY3QtcGhvbmV0aWMge1xuICBmb250LXNpemU6IDE0cHg7XG4gIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNDUpO1xuICBmb250LWZhbWlseTogJ1NGIE1vbm8nLCBNZW5sbywgbW9ub3NwYWNlO1xufVxuXG4uZGljdC1oZWFkZXIgLmRpY3Qtb3Blbi1idG4ge1xuICBtYXJnaW4tbGVmdDogYXV0bztcbn1cblxuLmRpY3QtbWVhbmluZ3Mge1xuICBkaXNwbGF5OiBmbGV4O1xuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICBnYXA6IDE2cHg7XG59XG5cbi5kaWN0LXBvcyB7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgY29sb3I6ICMwMDdBRkY7XG4gIHRleHQtdHJhbnNmb3JtOiBsb3dlcmNhc2U7XG4gIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgbWFyZ2luLWJvdHRvbTogOHB4O1xufVxuXG4uZGljdC1kZWZzIHtcbiAgbWFyZ2luOiAwO1xuICBwYWRkaW5nLWxlZnQ6IDE4cHg7XG4gIGRpc3BsYXk6IGZsZXg7XG4gIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gIGdhcDogOHB4O1xufVxuXG4uZGljdC1kZWYge1xuICBmb250LXNpemU6IDEzcHg7XG4gIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuOCk7XG4gIGxpbmUtaGVpZ2h0OiAxLjU7XG59XG5cbi5kaWN0LWV4YW1wbGUge1xuICBkaXNwbGF5OiBibG9jaztcbiAgbWFyZ2luLXRvcDogNHB4O1xuICBmb250LXNpemU6IDEycHg7XG4gIGNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuNDUpO1xuICBmb250LXN0eWxlOiBpdGFsaWM7XG59XG48L3N0eWxlPlxuIl0sImZpbGUiOiIvVXNlcnMveGlhb3llL0Rlc2t0b3AvZWxlY3Ryb24tdG9vbHMvc3JjL3JlbmRlcmVyL3NyYy9sYXVuY2hlci9wYWdlcy9EaWN0aW9uYXJ5UGFnZS52dWUifQ==