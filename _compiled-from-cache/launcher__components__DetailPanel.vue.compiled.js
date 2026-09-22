import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/launcher/components/DetailPanel.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import { marked } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/marked.js?v=ea0f6108";
import sanitizeHtml from "/src/utils/sanitize-html-wrapper.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "DetailPanel",
  props: {
    title: { type: String, required: false },
    content: { type: String, required: true },
    format: { type: String, required: false, default: "markdown" }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const renderedContent = computed(() => {
      if (props.format === "text") {
        return `<pre>${escapeHtml(props.content)}</pre>`;
      }
      try {
        const html = marked.parse(props.content, { async: false });
        return sanitizeHtml(html, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "del"]),
          allowedAttributes: {
            a: ["href", "title", "target", "rel"],
            img: ["src", "alt", "width", "height"],
            code: ["class"],
            span: ["class"]
          },
          transformTags: {
            a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener" })
          }
        });
      } catch {
        return escapeHtml(props.content);
      }
    });
    function escapeHtml(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    const __returned__ = { props, renderedContent, escapeHtml };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, createElementVNode as _createElementVNode, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = ["innerHTML"];
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock(
    _Fragment,
    null,
    [
      _createCommentVNode(" 内容已由 sanitizeHtml 白名单过滤（或 escapeHtml 转义），无原始插值 "),
      _createCommentVNode(" eslint-disable-next-line vue/no-v-html -- renderedContent 三条路径均先经 sanitize-html 白名单过滤/HTML 转义 "),
      _createElementVNode("div", {
        class: "detail-panel",
        innerHTML: $setup.renderedContent
      }, null, 8, _hoisted_1)
    ],
    2112
    /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */
  );
}
import "/src/launcher/components/DetailPanel.vue?vue&type=style&index=0&scoped=8d30529a&lang.css";
_sfc_main.__hmrId = "8d30529a";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8d30529a"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/launcher/components/DetailPanel.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQU9BLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsY0FBYztBQUN2QixPQUFPLGtCQUFrQjs7Ozs7Ozs7OztBQVF6QixVQUFNLFFBQVE7QUFJZCxVQUFNLGtCQUFrQixTQUFTLE1BQU07QUFDckMsVUFBSSxNQUFNLFdBQVcsUUFBUTtBQUMzQixlQUFPLFFBQVEsV0FBVyxNQUFNLE9BQU8sQ0FBQztBQUFBLE1BQzFDO0FBQ0EsVUFBSTtBQUNGLGNBQU0sT0FBTyxPQUFPLE1BQU0sTUFBTSxTQUFTLEVBQUUsT0FBTyxNQUFNLENBQUM7QUFHekQsZUFBTyxhQUFhLE1BQU07QUFBQSxVQUN4QixhQUFhLGFBQWEsU0FBUyxZQUFZLE9BQU8sQ0FBQyxPQUFPLEtBQUssQ0FBQztBQUFBLFVBQ3BFLG1CQUFtQjtBQUFBLFlBQ2pCLEdBQUcsQ0FBQyxRQUFRLFNBQVMsVUFBVSxLQUFLO0FBQUEsWUFDcEMsS0FBSyxDQUFDLE9BQU8sT0FBTyxTQUFTLFFBQVE7QUFBQSxZQUNyQyxNQUFNLENBQUMsT0FBTztBQUFBLFlBQ2QsTUFBTSxDQUFDLE9BQU87QUFBQSxVQUNoQjtBQUFBLFVBQ0EsZUFBZTtBQUFBLFlBQ2IsR0FBRyxhQUFhLGdCQUFnQixLQUFLLEVBQUUsUUFBUSxVQUFVLEtBQUssV0FBVyxDQUFDO0FBQUEsVUFDNUU7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNILFFBQVE7QUFDTixlQUFPLFdBQVcsTUFBTSxPQUFPO0FBQUEsTUFDakM7QUFBQSxJQUNGLENBQUM7QUFFRCxhQUFTLFdBQVcsTUFBc0I7QUFDeEMsYUFBTyxLQUNKLFFBQVEsTUFBTSxPQUFPLEVBQ3JCLFFBQVEsTUFBTSxNQUFNLEVBQ3BCLFFBQVEsTUFBTSxNQUFNLEVBQ3BCLFFBQVEsTUFBTSxRQUFRO0FBQUEsSUFDM0I7Ozs7Ozs7Ozs7Ozs7TUFuREU7QUFBQSxNQUNBO0FBQUEsTUFDQSxvQkFBcUQ7QUFBQSxRQUFoRCxPQUFNO0FBQUEsUUFBZSxXQUFRO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkRldGFpbFBhbmVsLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDwhLS0g5YaF5a655bey55SxIHNhbml0aXplSHRtbCDnmb3lkI3ljZXov4fmu6TvvIjmiJYgZXNjYXBlSHRtbCDovazkuYnvvInvvIzml6Dljp/lp4vmj5LlgLwgLS0+XG4gIDwhLS0gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHZ1ZS9uby12LWh0bWwgLS0gcmVuZGVyZWRDb250ZW50IOS4ieadoei3r+W+hOWdh+WFiOe7jyBzYW5pdGl6ZS1odG1sIOeZveWQjeWNlei/h+a7pC9IVE1MIOi9rOS5iSAtLT5cbiAgPGRpdiBjbGFzcz1cImRldGFpbC1wYW5lbFwiIHYtaHRtbD1cInJlbmRlcmVkQ29udGVudFwiIC8+XG48L3RlbXBsYXRlPlxuXG48c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyBtYXJrZWQgfSBmcm9tICdtYXJrZWQnXG5pbXBvcnQgc2FuaXRpemVIdG1sIGZyb20gJ0ByZW5kZXJlci91dGlscy9zYW5pdGl6ZS1odG1sLXdyYXBwZXInXG5cbmludGVyZmFjZSBQcm9wcyB7XG4gIHRpdGxlPzogc3RyaW5nXG4gIGNvbnRlbnQ6IHN0cmluZ1xuICBmb3JtYXQ/OiAndGV4dCcgfCAnbWFya2Rvd24nXG59XG5cbmNvbnN0IHByb3BzID0gd2l0aERlZmF1bHRzKGRlZmluZVByb3BzPFByb3BzPigpLCB7XG4gIGZvcm1hdDogJ21hcmtkb3duJ1xufSlcblxuY29uc3QgcmVuZGVyZWRDb250ZW50ID0gY29tcHV0ZWQoKCkgPT4ge1xuICBpZiAocHJvcHMuZm9ybWF0ID09PSAndGV4dCcpIHtcbiAgICByZXR1cm4gYDxwcmU+JHtlc2NhcGVIdG1sKHByb3BzLmNvbnRlbnQpfTwvcHJlPmBcbiAgfVxuICB0cnkge1xuICAgIGNvbnN0IGh0bWwgPSBtYXJrZWQucGFyc2UocHJvcHMuY29udGVudCwgeyBhc3luYzogZmFsc2UgfSkgYXMgc3RyaW5nXG4gICAgLy8g55m95ZCN5Y2V6L+H5ruk77yI5LiOIFBsdWdpbkxpc3RQYWdlIOS4gOiHtO+8ie+8muaJi+WGmeato+WImeWPr+iiqyA8c3ZnL29ubG9hZD3jgIFcbiAgICAvLyDlrp7kvZPljJYgamF2YXNjcmlwdDog562J5b2i5oCB57uV6L+H77yM6IO25ZuK56qX5oyB5YWo6YePIHdpbmRvdy5hcGkg5LiN6IO95YaS6ZmpXG4gICAgcmV0dXJuIHNhbml0aXplSHRtbChodG1sLCB7XG4gICAgICBhbGxvd2VkVGFnczogc2FuaXRpemVIdG1sLmRlZmF1bHRzLmFsbG93ZWRUYWdzLmNvbmNhdChbJ2ltZycsICdkZWwnXSksXG4gICAgICBhbGxvd2VkQXR0cmlidXRlczoge1xuICAgICAgICBhOiBbJ2hyZWYnLCAndGl0bGUnLCAndGFyZ2V0JywgJ3JlbCddLFxuICAgICAgICBpbWc6IFsnc3JjJywgJ2FsdCcsICd3aWR0aCcsICdoZWlnaHQnXSxcbiAgICAgICAgY29kZTogWydjbGFzcyddLFxuICAgICAgICBzcGFuOiBbJ2NsYXNzJ11cbiAgICAgIH0sXG4gICAgICB0cmFuc2Zvcm1UYWdzOiB7XG4gICAgICAgIGE6IHNhbml0aXplSHRtbC5zaW1wbGVUcmFuc2Zvcm0oJ2EnLCB7IHRhcmdldDogJ19ibGFuaycsIHJlbDogJ25vb3BlbmVyJyB9KVxuICAgICAgfVxuICAgIH0pXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBlc2NhcGVIdG1sKHByb3BzLmNvbnRlbnQpXG4gIH1cbn0pXG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRleHRcbiAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcbiAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxufVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQ+XG4uZGV0YWlsLXBhbmVsIHtcbiAgaGVpZ2h0OiAxMDAlO1xuICBvdmVyZmxvdy15OiBhdXRvO1xuICBwYWRkaW5nOiAxNnB4IDE4cHg7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgbGluZS1oZWlnaHQ6IDEuNjtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLXRleHQpO1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKGgxKSxcbi5kZXRhaWwtcGFuZWwgOmRlZXAoaDIpLFxuLmRldGFpbC1wYW5lbCA6ZGVlcChoMykge1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dCk7XG4gIGZvbnQtd2VpZ2h0OiA2MDA7XG4gIG1hcmdpbjogMTJweCAwIDhweDtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcChoMSkge1xuICBmb250LXNpemU6IDE4cHg7XG59XG4uZGV0YWlsLXBhbmVsIDpkZWVwKGgyKSB7XG4gIGZvbnQtc2l6ZTogMTZweDtcbn1cbi5kZXRhaWwtcGFuZWwgOmRlZXAoaDMpIHtcbiAgZm9udC1zaXplOiAxNHB4O1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKHApIHtcbiAgbWFyZ2luOiA4cHggMDtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcChjb2RlKSB7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgcGFkZGluZzogMnB4IDZweDtcbiAgYm9yZGVyLXJhZGl1czogNHB4O1xuICBmb250LXNpemU6IDEycHg7XG4gIGZvbnQtZmFtaWx5OiAnU0YgTW9ubycsIE1lbmxvLCBtb25vc3BhY2U7XG59XG5cbi5kZXRhaWwtcGFuZWwgOmRlZXAocHJlKSB7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgcGFkZGluZzogMTJweDtcbiAgYm9yZGVyLXJhZGl1czogOHB4O1xuICBvdmVyZmxvdy14OiBhdXRvO1xuICBtYXJnaW46IDEwcHggMDtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcChwcmUgY29kZSkge1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcbiAgcGFkZGluZzogMDtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcCh1bCksXG4uZGV0YWlsLXBhbmVsIDpkZWVwKG9sKSB7XG4gIHBhZGRpbmctbGVmdDogMjBweDtcbiAgbWFyZ2luOiA4cHggMDtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcChsaSkge1xuICBtYXJnaW46IDRweCAwO1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKGJsb2NrcXVvdGUpIHtcbiAgYm9yZGVyLWxlZnQ6IDNweCBzb2xpZCB2YXIoLS1sYXVuY2hlci1hY2NlbnQpO1xuICBwYWRkaW5nLWxlZnQ6IDEycHg7XG4gIG1hcmdpbjogMTBweCAwO1xuICBjb2xvcjogdmFyKC0tbGF1bmNoZXItdGV4dC1kaW0pO1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKGEpIHtcbiAgY29sb3I6IHZhcigtLWxhdW5jaGVyLWFjY2VudCk7XG4gIHRleHQtZGVjb3JhdGlvbjogbm9uZTtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcChhOmhvdmVyKSB7XG4gIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKGhyKSB7XG4gIGJvcmRlcjogbm9uZTtcbiAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIG1hcmdpbjogMTZweCAwO1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKHRhYmxlKSB7XG4gIHdpZHRoOiAxMDAlO1xuICBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1xuICBtYXJnaW46IDEwcHggMDtcbn1cblxuLmRldGFpbC1wYW5lbCA6ZGVlcCh0aCksXG4uZGV0YWlsLXBhbmVsIDpkZWVwKHRkKSB7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxhdW5jaGVyLWJvcmRlcik7XG4gIHBhZGRpbmc6IDZweCAxMHB4O1xuICB0ZXh0LWFsaWduOiBsZWZ0O1xufVxuXG4uZGV0YWlsLXBhbmVsIDpkZWVwKHRoKSB7XG4gIGJhY2tncm91bmQ6IHZhcigtLWxhdW5jaGVyLWJnLWVsZXZhdGVkKTtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2xhdW5jaGVyL2NvbXBvbmVudHMvRGV0YWlsUGFuZWwudnVlIn0=