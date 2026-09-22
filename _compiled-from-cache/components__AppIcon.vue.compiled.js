import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/AppIcon.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { computed, useAttrs } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "AppIcon",
  props: {
    icon: { type: String, required: true },
    size: { type: [String, Number], required: false, default: "1em" },
    color: { type: String, required: false, default: "currentColor" },
    rotate: { type: Number, required: false, default: 0 },
    flip: { type: String, required: false },
    inline: { type: Boolean, required: false, default: false },
    variant: { type: String, required: false, default: "line" }
  },
  setup(__props, { expose: __expose }) {
    __expose();
    const props = __props;
    const attrs = useAttrs();
    const iconClass = computed(() => {
      const iconName = props.icon;
      if (iconName.startsWith("ri-")) {
        return iconName;
      }
      return `ri-${iconName}-${props.variant}`;
    });
    const mergedClass = computed(() => {
      const classes = [iconClass.value];
      if (attrs.class) {
        if (typeof attrs.class === "string") {
          classes.push(attrs.class);
        } else if (Array.isArray(attrs.class)) {
          classes.push(...attrs.class);
        }
      }
      return classes.join(" ");
    });
    const iconStyle = computed(() => {
      const style = {
        fontSize: typeof props.size === "number" ? `${props.size}px` : props.size,
        display: props.inline ? "inline-block" : "block"
      };
      if (props.color !== "currentColor") {
        style.color = props.color;
      }
      if (props.rotate !== 0) {
        style.transform = `rotate(${props.rotate}deg)`;
      }
      if (props.flip) {
        const flipMap = {
          horizontal: "scaleX(-1)",
          vertical: "scaleY(-1)",
          both: "scale(-1)"
        };
        const flipTransform = flipMap[props.flip];
        if (style.transform) {
          style.transform += ` ${flipTransform}`;
        } else {
          style.transform = flipTransform;
        }
      }
      return style;
    });
    const __returned__ = { props, attrs, iconClass, mergedClass, iconStyle };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { normalizeClass as _normalizeClass, normalizeStyle as _normalizeStyle, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock(
    "i",
    {
      class: _normalizeClass($setup.mergedClass),
      style: _normalizeStyle($setup.iconStyle)
    },
    null,
    6
    /* CLASS, STYLE */
  );
}
_sfc_main.__hmrId = "54b59b04";
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
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/components/AppIcon.vue"]]);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IjtBQUNBLFNBQVMsVUFBVSxnQkFBZ0I7Ozs7Ozs7Ozs7Ozs7O0FBWW5DLFVBQU0sUUFBUTtBQVFkLFVBQU0sUUFBUSxTQUFTO0FBSXZCLFVBQU0sWUFBWSxTQUFTLE1BQU07QUFDL0IsWUFBTSxXQUFXLE1BQU07QUFHdkIsVUFBSSxTQUFTLFdBQVcsS0FBSyxHQUFHO0FBQzlCLGVBQU87QUFBQSxNQUNUO0FBR0EsYUFBTyxNQUFNLFFBQVEsSUFBSSxNQUFNLE9BQU87QUFBQSxJQUN4QyxDQUFDO0FBR0QsVUFBTSxjQUFjLFNBQVMsTUFBTTtBQUNqQyxZQUFNLFVBQVUsQ0FBQyxVQUFVLEtBQUs7QUFDaEMsVUFBSSxNQUFNLE9BQU87QUFDZixZQUFJLE9BQU8sTUFBTSxVQUFVLFVBQVU7QUFDbkMsa0JBQVEsS0FBSyxNQUFNLEtBQUs7QUFBQSxRQUMxQixXQUFXLE1BQU0sUUFBUSxNQUFNLEtBQUssR0FBRztBQUNyQyxrQkFBUSxLQUFLLEdBQUcsTUFBTSxLQUFLO0FBQUEsUUFDN0I7QUFBQSxNQUNGO0FBQ0EsYUFBTyxRQUFRLEtBQUssR0FBRztBQUFBLElBQ3pCLENBQUM7QUFFRCxVQUFNLFlBQVksU0FBUyxNQUFNO0FBQy9CLFlBQU0sUUFBZ0M7QUFBQSxRQUNwQyxVQUFVLE9BQU8sTUFBTSxTQUFTLFdBQVcsR0FBRyxNQUFNLElBQUksT0FBTyxNQUFNO0FBQUEsUUFDckUsU0FBUyxNQUFNLFNBQVMsaUJBQWlCO0FBQUEsTUFDM0M7QUFJQSxVQUFJLE1BQU0sVUFBVSxnQkFBZ0I7QUFDbEMsY0FBTSxRQUFRLE1BQU07QUFBQSxNQUN0QjtBQUVBLFVBQUksTUFBTSxXQUFXLEdBQUc7QUFDdEIsY0FBTSxZQUFZLFVBQVUsTUFBTSxNQUFNO0FBQUEsTUFDMUM7QUFFQSxVQUFJLE1BQU0sTUFBTTtBQUNkLGNBQU0sVUFBVTtBQUFBLFVBQ2QsWUFBWTtBQUFBLFVBQ1osVUFBVTtBQUFBLFVBQ1YsTUFBTTtBQUFBLFFBQ1I7QUFDQSxjQUFNLGdCQUFnQixRQUFRLE1BQU0sSUFBSTtBQUN4QyxZQUFJLE1BQU0sV0FBVztBQUNuQixnQkFBTSxhQUFhLElBQUksYUFBYTtBQUFBLFFBQ3RDLE9BQU87QUFDTCxnQkFBTSxZQUFZO0FBQUEsUUFDcEI7QUFBQSxNQUNGO0FBRUEsYUFBTztBQUFBLElBQ1QsQ0FBQzs7Ozs7Ozs7dUJBSUM7QUFBQSxJQUE2QztBQUFBO0FBQUEsTUFBekMsT0FBSyxnQkFBRSxrQkFBVztBQUFBLE1BQUcsT0FBSyxnQkFBRSxnQkFBUztBQUFBIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJBcHBJY29uLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIHVzZUF0dHJzIH0gZnJvbSAndnVlJ1xuXG5pbnRlcmZhY2UgUHJvcHMge1xuICBpY29uOiBzdHJpbmdcbiAgc2l6ZT86IHN0cmluZyB8IG51bWJlclxuICBjb2xvcj86IHN0cmluZ1xuICByb3RhdGU/OiBudW1iZXJcbiAgZmxpcD86ICdob3Jpem9udGFsJyB8ICd2ZXJ0aWNhbCcgfCAnYm90aCdcbiAgaW5saW5lPzogYm9vbGVhblxuICB2YXJpYW50PzogJ2xpbmUnIHwgJ2ZpbGwnXG59XG5cbmNvbnN0IHByb3BzID0gd2l0aERlZmF1bHRzKGRlZmluZVByb3BzPFByb3BzPigpLCB7XG4gIHNpemU6ICcxZW0nLFxuICBjb2xvcjogJ2N1cnJlbnRDb2xvcicsXG4gIHJvdGF0ZTogMCxcbiAgaW5saW5lOiBmYWxzZSxcbiAgdmFyaWFudDogJ2xpbmUnXG59KVxuXG5jb25zdCBhdHRycyA9IHVzZUF0dHJzKClcblxuLy8g5bCG5Zu+5qCH5ZCN56ew6L2s5o2i5Li6IHJlbWl4aWNvbiDnsbvlkI1cbi8vIOWmguaenOW3sue7j+aYryByaS0g5byA5aS077yI5a6M5pW057G75ZCN77yJ77yM55u05o6l5L2/55So77yb5ZCm5YiZ5re75YqgIHJpLSDliY3nvIDlkowgLWxpbmUvLWZpbGwg5ZCO57yAXG5jb25zdCBpY29uQ2xhc3MgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGNvbnN0IGljb25OYW1lID0gcHJvcHMuaWNvblxuXG4gIC8vIOWmguaenOW3sue7j+aYryByaS0g5byA5aS055qE5a6M5pW057G75ZCN77yM55u05o6l5L2/55SoXG4gIGlmIChpY29uTmFtZS5zdGFydHNXaXRoKCdyaS0nKSkge1xuICAgIHJldHVybiBpY29uTmFtZVxuICB9XG5cbiAgLy8g5ZCm5YiZ5re75YqgIHJpLSDliY3nvIDlkozlj5jkvZPlkI7nvIBcbiAgcmV0dXJuIGByaS0ke2ljb25OYW1lfS0ke3Byb3BzLnZhcmlhbnR9YFxufSlcblxuLy8g5ZCI5bm25Lyg5YWl55qEIGNsYXNzIOWSjOWbvuagh+exu+WQjVxuY29uc3QgbWVyZ2VkQ2xhc3MgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGNvbnN0IGNsYXNzZXMgPSBbaWNvbkNsYXNzLnZhbHVlXVxuICBpZiAoYXR0cnMuY2xhc3MpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzLmNsYXNzID09PSAnc3RyaW5nJykge1xuICAgICAgY2xhc3Nlcy5wdXNoKGF0dHJzLmNsYXNzKVxuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhdHRycy5jbGFzcykpIHtcbiAgICAgIGNsYXNzZXMucHVzaCguLi5hdHRycy5jbGFzcylcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNsYXNzZXMuam9pbignICcpXG59KVxuXG5jb25zdCBpY29uU3R5bGUgPSBjb21wdXRlZCgoKSA9PiB7XG4gIGNvbnN0IHN0eWxlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIGZvbnRTaXplOiB0eXBlb2YgcHJvcHMuc2l6ZSA9PT0gJ251bWJlcicgPyBgJHtwcm9wcy5zaXplfXB4YCA6IHByb3BzLnNpemUsXG4gICAgZGlzcGxheTogcHJvcHMuaW5saW5lID8gJ2lubGluZS1ibG9jaycgOiAnYmxvY2snXG4gIH1cblxuICAvLyDlj6rmnInlvZMgY29sb3Ig5LiN5pivICdjdXJyZW50Q29sb3InIOaXtuaJjeiuvue9ruWGheiBlOminOiJsuagt+W8j1xuICAvLyDov5nmoLflj6/ku6XlhYHorrjpgJrov4cgY2xhc3Mg5bGe5oCn77yI5aaCIFRhaWx3aW5kIOeahCB0ZXh0LXJlZC01MDDvvInmnaXorr7nva7popzoibJcbiAgaWYgKHByb3BzLmNvbG9yICE9PSAnY3VycmVudENvbG9yJykge1xuICAgIHN0eWxlLmNvbG9yID0gcHJvcHMuY29sb3JcbiAgfVxuXG4gIGlmIChwcm9wcy5yb3RhdGUgIT09IDApIHtcbiAgICBzdHlsZS50cmFuc2Zvcm0gPSBgcm90YXRlKCR7cHJvcHMucm90YXRlfWRlZylgXG4gIH1cblxuICBpZiAocHJvcHMuZmxpcCkge1xuICAgIGNvbnN0IGZsaXBNYXAgPSB7XG4gICAgICBob3Jpem9udGFsOiAnc2NhbGVYKC0xKScsXG4gICAgICB2ZXJ0aWNhbDogJ3NjYWxlWSgtMSknLFxuICAgICAgYm90aDogJ3NjYWxlKC0xKSdcbiAgICB9XG4gICAgY29uc3QgZmxpcFRyYW5zZm9ybSA9IGZsaXBNYXBbcHJvcHMuZmxpcF1cbiAgICBpZiAoc3R5bGUudHJhbnNmb3JtKSB7XG4gICAgICBzdHlsZS50cmFuc2Zvcm0gKz0gYCAke2ZsaXBUcmFuc2Zvcm19YFxuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZS50cmFuc2Zvcm0gPSBmbGlwVHJhbnNmb3JtXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN0eWxlXG59KVxuPC9zY3JpcHQ+XG5cbjx0ZW1wbGF0ZT5cbiAgPGkgOmNsYXNzPVwibWVyZ2VkQ2xhc3NcIiA6c3R5bGU9XCJpY29uU3R5bGVcIiAvPlxuPC90ZW1wbGF0ZT5cbiJdLCJmaWxlIjoiL1VzZXJzL3hpYW95ZS9EZXNrdG9wL2VsZWN0cm9uLXRvb2xzL3NyYy9yZW5kZXJlci9zcmMvY29tcG9uZW50cy9BcHBJY29uLnZ1ZSJ9