import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/shell/AppShell.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
import TopBar from "/src/components/shell/TopBar.vue";
import CommandPalette from "/src/components/shell/CommandPalette.vue?t=1789709850689";
import UToastProvider from "/src/components/ui/UToastProvider.vue";
import { useModuleShortcuts } from "/src/composables/useModuleShortcuts.ts";
import { useTheme } from "/src/composables/useTheme.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "AppShell",
  setup(__props, { expose: __expose }) {
    __expose();
    useModuleShortcuts();
    useTheme().initTheme();
    const __returned__ = { TopBar, CommandPalette, UToastProvider };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createVNode as _createVNode, createCommentVNode as _createCommentVNode, renderSlot as _renderSlot, createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=ea0f6108";
const _hoisted_1 = { class: "LeafAppShell h-screen flex flex-col bg-surface-0" };
const _hoisted_2 = { class: "app-scroll flex-1 min-w-0 overflow-auto" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode($setup["TopBar"]),
    _createCommentVNode(" Raycast 化：移除左侧菜单栏，内容区全屏 "),
    _createElementVNode("main", _hoisted_2, [
      _renderSlot(_ctx.$slots, "default")
    ]),
    _createCommentVNode(" 命令面板（⌘K）"),
    _createVNode($setup["CommandPalette"]),
    _createCommentVNode(" 全局 Toast 容器 "),
    _createVNode($setup["UToastProvider"])
  ]);
}
_sfc_main.__hmrId = "49f17c75";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/shell/AppShell.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUNBLE9BQU8sWUFBWTtBQUNuQixPQUFPLG9CQUFvQjtBQUMzQixPQUFPLG9CQUFvQjtBQUMzQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdCQUFnQjs7Ozs7QUFFekIsdUJBQW1CO0FBQ25CLGFBQVMsRUFBRSxVQUFVOzs7Ozs7O3FCQUlkLE9BQU0sbURBQWtEO3FCQUdyRCxPQUFNLDBDQUF5Qzs7dUJBSHZELG9CQVVNLE9BVk4sWUFVTTtBQUFBLElBVEosYUFBVTtBQUFBLElBQ1Y7QUFBQSxJQUNBLG9CQUVPLFFBRlAsWUFFTztBQUFBLE1BREwsWUFBUTtBQUFBO0lBRVY7QUFBQSxJQUNBLGFBQWtCO0FBQUEsSUFDbEI7QUFBQSxJQUNBLGFBQWtCO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkFwcFNoZWxsLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IFRvcEJhciBmcm9tICcuL1RvcEJhci52dWUnXG5pbXBvcnQgQ29tbWFuZFBhbGV0dGUgZnJvbSAnLi9Db21tYW5kUGFsZXR0ZS52dWUnXG5pbXBvcnQgVVRvYXN0UHJvdmlkZXIgZnJvbSAnLi4vdWkvVVRvYXN0UHJvdmlkZXIudnVlJ1xuaW1wb3J0IHsgdXNlTW9kdWxlU2hvcnRjdXRzIH0gZnJvbSAnLi4vLi4vY29tcG9zYWJsZXMvdXNlTW9kdWxlU2hvcnRjdXRzJ1xuaW1wb3J0IHsgdXNlVGhlbWUgfSBmcm9tICcuLi8uLi9jb21wb3NhYmxlcy91c2VUaGVtZSdcblxudXNlTW9kdWxlU2hvcnRjdXRzKClcbnVzZVRoZW1lKCkuaW5pdFRoZW1lKClcbjwvc2NyaXB0PlxuXG48dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJMZWFmQXBwU2hlbGwgaC1zY3JlZW4gZmxleCBmbGV4LWNvbCBiZy1zdXJmYWNlLTBcIj5cbiAgICA8VG9wQmFyIC8+XG4gICAgPCEtLSBSYXljYXN0IOWMlu+8muenu+mZpOW3puS+p+iPnOWNleagj++8jOWGheWuueWMuuWFqOWxjyAtLT5cbiAgICA8bWFpbiBjbGFzcz1cImFwcC1zY3JvbGwgZmxleC0xIG1pbi13LTAgb3ZlcmZsb3ctYXV0b1wiPlxuICAgICAgPHNsb3QgLz5cbiAgICA8L21haW4+XG4gICAgPCEtLSDlkb3ku6TpnaLmnb/vvIjijJhL77yJLS0+XG4gICAgPENvbW1hbmRQYWxldHRlIC8+XG4gICAgPCEtLSDlhajlsYAgVG9hc3Qg5a655ZmoIC0tPlxuICAgIDxVVG9hc3RQcm92aWRlciAvPlxuICA8L2Rpdj5cbjwvdGVtcGxhdGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL2NvbXBvbmVudHMvc2hlbGwvQXBwU2hlbGwudnVlIn0=