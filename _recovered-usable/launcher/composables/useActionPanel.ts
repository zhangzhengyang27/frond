/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { computed, ref } from "vue";
export function useActionPanel(deps) {
  const actionPanelEntry = ref(null);
  const actionIndex = ref(0);
  const panelActions = computed(() => {
    const entry = actionPanelEntry.value;
    if (!entry) return [];
    const a = entry.action;
    const list = [];
    const primary = () => {
      actionPanelEntry.value = null;
      void deps.runEntry(entry);
    };
    const runAndHide = (fn) => () => {
      actionPanelEntry.value = null;
      fn();
      deps.hideWindow();
    };
    switch (a.type) {
      case "module":
        list.push({ label: "打开（沉浸窗口）", icon: "play-line", hint: "↵", run: primary });
        list.push({
          label: "在主窗口打开",
          icon: "window-line",
          run: runAndHide(() => window.api.launcher.openModule(a.moduleId, a.path))
        });
        list.push({
          label: "复制路径",
          icon: "file-copy-line",
          run: runAndHide(() => {
            void navigator.clipboard.writeText(a.path);
          })
        });
        break;
      case "page":
        list.push({ label: "打开（沉浸窗口）", icon: "play-line", hint: "↵", run: primary });
        list.push({
          label: "在主窗口打开",
          icon: "window-line",
          run: runAndHide(() => window.api.launcher.openModule(a.pageId, a.path))
        });
        break;
      case "app":
        list.push({ label: "启动应用", icon: "rocket-line", hint: "↵", run: primary });
        list.push({
          label: "复制路径",
          icon: "file-copy-line",
          run: runAndHide(() => {
            void navigator.clipboard.writeText(a.path);
          })
        });
        break;
      case "file":
        list.push({ label: "打开", icon: "external-link-line", hint: "↵", run: primary });
        list.push({
          label: "在 Finder 中显示",
          icon: "folder-open-line",
          run: runAndHide(() => {
            void window.api.fileSearch.reveal(a.path);
          })
        });
        list.push({
          label: "复制路径",
          icon: "file-copy-line",
          run: runAndHide(() => {
            void navigator.clipboard.writeText(a.path);
          })
        });
        break;
      case "shotPaste":
        list.push({ label: "粘贴到前台应用", icon: "clipboard-line", hint: "↵", run: primary });
        break;
      case "openUrl":
        list.push({ label: "打开链接", icon: "external-link-line", hint: "↵", run: primary });
        list.push({
          label: "复制链接",
          icon: "ri-link",
          run: runAndHide(() => {
            if (a.url) void navigator.clipboard.writeText(a.url);
          })
        });
        break;
      case "clipboardItem":
        list.push({ label: "复制", icon: "file-copy-line", hint: "↵", run: primary });
        list.push({
          label: "粘贴到前台应用",
          icon: "clipboard-line",
          run: runAndHide(() => {
            void window.api.clipHist.pasteBack(a.id);
          })
        });
        break;
      case "snippetItem":
        list.push({ label: "复制内容", icon: "file-copy-line", hint: "↵", run: primary });
        list.push({
          label: "在片段管理中打开",
          icon: "file-code-line",
          run: runAndHide(() => {
            void window.api.launcher.openModule("snippets", "/snippets");
          })
        });
        break;
      default:
        list.push({ label: "执行", icon: "play-line", hint: "↵", run: primary });
    }
    return list;
  });
  function toggleActionPanel() {
    if (actionPanelEntry.value) {
      actionPanelEntry.value = null;
      return;
    }
    const item = deps.results.value[deps.selectedIndex.value];
    if (!item) return;
    actionPanelEntry.value = item.entry;
    actionIndex.value = 0;
  }
  return { actionPanelEntry, actionIndex, panelActions, toggleActionPanel };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUFjdGlvblBhbmVsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyDnu5Pmnpznuqcg4oyYSyDliqjkvZzpnaLmnb/vvIhNMS4y77yM6IeqIExhdW5jaGVyQXBwLnZ1ZSDmir3lh7rvvIlcbiAqXG4gKiDmjInpgInkuK3mnaHnm67nmoQgYWN0aW9uIOexu+Wei+eUn+aIkOWPr+eUqOWKqOS9nOWIl+ihqO+8m+WKqOS9nOaJp+ihjOWQjue7n+S4gOWFs+mdouadv++8jFxuICog6ZyA6KaB5pS26LW36IO25ZuK55qE5Yqo5L2c6aKd5aSW6LCDIGhpZGVXaW5kb3fjgIJcbiAqL1xuaW1wb3J0IHsgY29tcHV0ZWQsIHJlZiwgdHlwZSBSZWYgfSBmcm9tICd2dWUnXG5pbXBvcnQgdHlwZSB7IENvbW1hbmRFbnRyeSB9IGZyb20gJ0BzaGFyZWQvY29tbWFuZHMnXG5pbXBvcnQgdHlwZSB7IFNjb3JlZEVudHJ5IH0gZnJvbSAnQHNoYXJlZC9zZWFyY2gnXG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFuZWxBY3Rpb24ge1xuICBsYWJlbDogc3RyaW5nXG4gIC8qKiByZW1peGljb24g5Zu+5qCH5ZCN77yISTTvvJpSYXljYXN0IEFjdGlvblBhbmVsIOavj+ihjOW4puWbvuagh++8iSAqL1xuICBpY29uOiBzdHJpbmdcbiAgLyoqIOmUruW4veaPkOekuu+8muWPquagh+azqOecn+WunuWPr+inpuWPkeeahOaMiemUru+8iOWuoeafpeS/ruWkje+8muWOn+WFiOaMieagh+etvueMnCDijJhDL+KMmFIg5L2G5bm25pyq57uR5a6a77yM5pyJ6K+v5a+877yJICovXG4gIGhpbnQ/OiBzdHJpbmdcbiAgcnVuOiAoKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VBY3Rpb25QYW5lbChkZXBzOiB7XG4gIHJlc3VsdHM6IFJlZjxTY29yZWRFbnRyeVtdPlxuICBzZWxlY3RlZEluZGV4OiBSZWY8bnVtYmVyPlxuICBydW5FbnRyeTogKGVudHJ5OiBDb21tYW5kRW50cnkpID0+IFByb21pc2U8dm9pZD5cbiAgaGlkZVdpbmRvdzogKCkgPT4gdm9pZFxufSk6IHtcbiAgYWN0aW9uUGFuZWxFbnRyeTogUmVmPENvbW1hbmRFbnRyeSB8IG51bGw+XG4gIGFjdGlvbkluZGV4OiBSZWY8bnVtYmVyPlxuICBwYW5lbEFjdGlvbnM6IFJlZjxQYW5lbEFjdGlvbltdPlxuICB0b2dnbGVBY3Rpb25QYW5lbDogKCkgPT4gdm9pZFxufSB7XG4gIGNvbnN0IGFjdGlvblBhbmVsRW50cnkgPSByZWY8Q29tbWFuZEVudHJ5IHwgbnVsbD4obnVsbClcbiAgY29uc3QgYWN0aW9uSW5kZXggPSByZWYoMClcblxuICAvKiog4oyYSyDliqjkvZzpnaLmnb/nmoTlj6/nlKjliqjkvZzvvIjmjInmnaHnm67nsbvlnovnlJ/miJDvvIkgKi9cbiAgY29uc3QgcGFuZWxBY3Rpb25zID0gY29tcHV0ZWQ8UGFuZWxBY3Rpb25bXT4oKCkgPT4ge1xuICAgIGNvbnN0IGVudHJ5ID0gYWN0aW9uUGFuZWxFbnRyeS52YWx1ZVxuICAgIGlmICghZW50cnkpIHJldHVybiBbXVxuICAgIGNvbnN0IGEgPSBlbnRyeS5hY3Rpb25cbiAgICBjb25zdCBsaXN0OiBQYW5lbEFjdGlvbltdID0gW11cbiAgICBjb25zdCBwcmltYXJ5ID0gKCk6IHZvaWQgPT4ge1xuICAgICAgYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSA9IG51bGxcbiAgICAgIHZvaWQgZGVwcy5ydW5FbnRyeShlbnRyeSlcbiAgICB9XG4gICAgY29uc3QgcnVuQW5kSGlkZSA9XG4gICAgICAoZm46ICgpID0+IHZvaWQpOiAoKCkgPT4gdm9pZCkgPT5cbiAgICAgICgpID0+IHtcbiAgICAgICAgYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSA9IG51bGxcbiAgICAgICAgZm4oKVxuICAgICAgICBkZXBzLmhpZGVXaW5kb3coKVxuICAgICAgfVxuICAgIHN3aXRjaCAoYS50eXBlKSB7XG4gICAgICBjYXNlICdtb2R1bGUnOlxuICAgICAgICBsaXN0LnB1c2goeyBsYWJlbDogJ+aJk+W8gO+8iOayiea1uOeql+WPo++8iScsIGljb246ICdwbGF5LWxpbmUnLCBoaW50OiAn4oa1JywgcnVuOiBwcmltYXJ5IH0pXG4gICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgbGFiZWw6ICflnKjkuLvnqpflj6PmiZPlvIAnLFxuICAgICAgICAgIGljb246ICd3aW5kb3ctbGluZScsXG4gICAgICAgICAgcnVuOiBydW5BbmRIaWRlKCgpID0+IHdpbmRvdy5hcGkubGF1bmNoZXIub3Blbk1vZHVsZShhLm1vZHVsZUlkLCBhLnBhdGgpKVxuICAgICAgICB9KVxuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxhYmVsOiAn5aSN5Yi26Lev5b6EJyxcbiAgICAgICAgICBpY29uOiAnZmlsZS1jb3B5LWxpbmUnLFxuICAgICAgICAgIHJ1bjogcnVuQW5kSGlkZSgoKSA9PiB7XG4gICAgICAgICAgICB2b2lkIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGEucGF0aClcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAncGFnZSc6XG4gICAgICAgIGxpc3QucHVzaCh7IGxhYmVsOiAn5omT5byA77yI5rKJ5rW456qX5Y+j77yJJywgaWNvbjogJ3BsYXktbGluZScsIGhpbnQ6ICfihrUnLCBydW46IHByaW1hcnkgfSlcbiAgICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgICBsYWJlbDogJ+WcqOS4u+eql+WPo+aJk+W8gCcsXG4gICAgICAgICAgaWNvbjogJ3dpbmRvdy1saW5lJyxcbiAgICAgICAgICBydW46IHJ1bkFuZEhpZGUoKCkgPT4gd2luZG93LmFwaS5sYXVuY2hlci5vcGVuTW9kdWxlKGEucGFnZUlkLCBhLnBhdGgpKVxuICAgICAgICB9KVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnYXBwJzpcbiAgICAgICAgbGlzdC5wdXNoKHsgbGFiZWw6ICflkK/liqjlupTnlKgnLCBpY29uOiAncm9ja2V0LWxpbmUnLCBoaW50OiAn4oa1JywgcnVuOiBwcmltYXJ5IH0pXG4gICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgbGFiZWw6ICflpI3liLbot6/lvoQnLFxuICAgICAgICAgIGljb246ICdmaWxlLWNvcHktbGluZScsXG4gICAgICAgICAgcnVuOiBydW5BbmRIaWRlKCgpID0+IHtcbiAgICAgICAgICAgIHZvaWQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoYS5wYXRoKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdmaWxlJzpcbiAgICAgICAgbGlzdC5wdXNoKHsgbGFiZWw6ICfmiZPlvIAnLCBpY29uOiAnZXh0ZXJuYWwtbGluay1saW5lJywgaGludDogJ+KGtScsIHJ1bjogcHJpbWFyeSB9KVxuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxhYmVsOiAn5ZyoIEZpbmRlciDkuK3mmL7npLonLFxuICAgICAgICAgIGljb246ICdmb2xkZXItb3Blbi1saW5lJyxcbiAgICAgICAgICBydW46IHJ1bkFuZEhpZGUoKCkgPT4ge1xuICAgICAgICAgICAgdm9pZCB3aW5kb3cuYXBpLmZpbGVTZWFyY2gucmV2ZWFsKGEucGF0aClcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxhYmVsOiAn5aSN5Yi26Lev5b6EJyxcbiAgICAgICAgICBpY29uOiAnZmlsZS1jb3B5LWxpbmUnLFxuICAgICAgICAgIHJ1bjogcnVuQW5kSGlkZSgoKSA9PiB7XG4gICAgICAgICAgICB2b2lkIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGEucGF0aClcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnc2hvdFBhc3RlJzpcbiAgICAgICAgbGlzdC5wdXNoKHsgbGFiZWw6ICfnspjotLTliLDliY3lj7DlupTnlKgnLCBpY29uOiAnY2xpcGJvYXJkLWxpbmUnLCBoaW50OiAn4oa1JywgcnVuOiBwcmltYXJ5IH0pXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdvcGVuVXJsJzpcbiAgICAgICAgbGlzdC5wdXNoKHsgbGFiZWw6ICfmiZPlvIDpk77mjqUnLCBpY29uOiAnZXh0ZXJuYWwtbGluay1saW5lJywgaGludDogJ+KGtScsIHJ1bjogcHJpbWFyeSB9KVxuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxhYmVsOiAn5aSN5Yi26ZO+5o6lJyxcbiAgICAgICAgICBpY29uOiAncmktbGluaycsXG4gICAgICAgICAgcnVuOiBydW5BbmRIaWRlKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChhLnVybCkgdm9pZCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChhLnVybClcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnY2xpcGJvYXJkSXRlbSc6XG4gICAgICAgIGxpc3QucHVzaCh7IGxhYmVsOiAn5aSN5Yi2JywgaWNvbjogJ2ZpbGUtY29weS1saW5lJywgaGludDogJ+KGtScsIHJ1bjogcHJpbWFyeSB9KVxuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxhYmVsOiAn57KY6LS05Yiw5YmN5Y+w5bqU55SoJyxcbiAgICAgICAgICBpY29uOiAnY2xpcGJvYXJkLWxpbmUnLFxuICAgICAgICAgIHJ1bjogcnVuQW5kSGlkZSgoKSA9PiB7XG4gICAgICAgICAgICB2b2lkIHdpbmRvdy5hcGkuY2xpcEhpc3QucGFzdGVCYWNrKGEuaWQpXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ3NuaXBwZXRJdGVtJzpcbiAgICAgICAgbGlzdC5wdXNoKHsgbGFiZWw6ICflpI3liLblhoXlrrknLCBpY29uOiAnZmlsZS1jb3B5LWxpbmUnLCBoaW50OiAn4oa1JywgcnVuOiBwcmltYXJ5IH0pXG4gICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgbGFiZWw6ICflnKjniYfmrrXnrqHnkIbkuK3miZPlvIAnLFxuICAgICAgICAgIGljb246ICdmaWxlLWNvZGUtbGluZScsXG4gICAgICAgICAgcnVuOiBydW5BbmRIaWRlKCgpID0+IHtcbiAgICAgICAgICAgIHZvaWQgd2luZG93LmFwaS5sYXVuY2hlci5vcGVuTW9kdWxlKCdzbmlwcGV0cycsICcvc25pcHBldHMnKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsaXN0LnB1c2goeyBsYWJlbDogJ+aJp+ihjCcsIGljb246ICdwbGF5LWxpbmUnLCBoaW50OiAn4oa1JywgcnVuOiBwcmltYXJ5IH0pXG4gICAgfVxuICAgIHJldHVybiBsaXN0XG4gIH0pXG5cbiAgLyoqIOW6lemDqCBBY3Rpb25zIOaMiemSru+8muWvueW9k+WJjemAieS4ree7k+aenOWRvOWHuiAvIOWFs+mXreWKqOS9nOmdouadv++8iOS4jiDijJhLIOWQjOS4gOeKtuaAge+8iSAqL1xuICBmdW5jdGlvbiB0b2dnbGVBY3Rpb25QYW5lbCgpOiB2b2lkIHtcbiAgICBpZiAoYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSkge1xuICAgICAgYWN0aW9uUGFuZWxFbnRyeS52YWx1ZSA9IG51bGxcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zdCBpdGVtID0gZGVwcy5yZXN1bHRzLnZhbHVlW2RlcHMuc2VsZWN0ZWRJbmRleC52YWx1ZV1cbiAgICBpZiAoIWl0ZW0pIHJldHVyblxuICAgIGFjdGlvblBhbmVsRW50cnkudmFsdWUgPSBpdGVtLmVudHJ5XG4gICAgYWN0aW9uSW5kZXgudmFsdWUgPSAwXG4gIH1cblxuICByZXR1cm4geyBhY3Rpb25QYW5lbEVudHJ5LCBhY3Rpb25JbmRleCwgcGFuZWxBY3Rpb25zLCB0b2dnbGVBY3Rpb25QYW5lbCB9XG59XG4iXSwibWFwcGluZ3MiOiJBQU1BLFNBQVMsVUFBVSxXQUFxQjtBQWFqQyxnQkFBUyxlQUFlLE1BVTdCO0FBQ0EsUUFBTSxtQkFBbUIsSUFBeUIsSUFBSTtBQUN0RCxRQUFNLGNBQWMsSUFBSSxDQUFDO0FBR3pCLFFBQU0sZUFBZSxTQUF3QixNQUFNO0FBQ2pELFVBQU0sUUFBUSxpQkFBaUI7QUFDL0IsUUFBSSxDQUFDLE1BQU8sUUFBTyxDQUFDO0FBQ3BCLFVBQU0sSUFBSSxNQUFNO0FBQ2hCLFVBQU0sT0FBc0IsQ0FBQztBQUM3QixVQUFNLFVBQVUsTUFBWTtBQUMxQix1QkFBaUIsUUFBUTtBQUN6QixXQUFLLEtBQUssU0FBUyxLQUFLO0FBQUEsSUFDMUI7QUFDQSxVQUFNLGFBQ0osQ0FBQyxPQUNELE1BQU07QUFDSix1QkFBaUIsUUFBUTtBQUN6QixTQUFHO0FBQ0gsV0FBSyxXQUFXO0FBQUEsSUFDbEI7QUFDRixZQUFRLEVBQUUsTUFBTTtBQUFBLE1BQ2QsS0FBSztBQUNILGFBQUssS0FBSyxFQUFFLE9BQU8sWUFBWSxNQUFNLGFBQWEsTUFBTSxLQUFLLEtBQUssUUFBUSxDQUFDO0FBQzNFLGFBQUssS0FBSztBQUFBLFVBQ1IsT0FBTztBQUFBLFVBQ1AsTUFBTTtBQUFBLFVBQ04sS0FBSyxXQUFXLE1BQU0sT0FBTyxJQUFJLFNBQVMsV0FBVyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUM7QUFBQSxRQUMxRSxDQUFDO0FBQ0QsYUFBSyxLQUFLO0FBQUEsVUFDUixPQUFPO0FBQUEsVUFDUCxNQUFNO0FBQUEsVUFDTixLQUFLLFdBQVcsTUFBTTtBQUNwQixpQkFBSyxVQUFVLFVBQVUsVUFBVSxFQUFFLElBQUk7QUFBQSxVQUMzQyxDQUFDO0FBQUEsUUFDSCxDQUFDO0FBQ0Q7QUFBQSxNQUNGLEtBQUs7QUFDSCxhQUFLLEtBQUssRUFBRSxPQUFPLFlBQVksTUFBTSxhQUFhLE1BQU0sS0FBSyxLQUFLLFFBQVEsQ0FBQztBQUMzRSxhQUFLLEtBQUs7QUFBQSxVQUNSLE9BQU87QUFBQSxVQUNQLE1BQU07QUFBQSxVQUNOLEtBQUssV0FBVyxNQUFNLE9BQU8sSUFBSSxTQUFTLFdBQVcsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDO0FBQUEsUUFDeEUsQ0FBQztBQUNEO0FBQUEsTUFDRixLQUFLO0FBQ0gsYUFBSyxLQUFLLEVBQUUsT0FBTyxRQUFRLE1BQU0sZUFBZSxNQUFNLEtBQUssS0FBSyxRQUFRLENBQUM7QUFDekUsYUFBSyxLQUFLO0FBQUEsVUFDUixPQUFPO0FBQUEsVUFDUCxNQUFNO0FBQUEsVUFDTixLQUFLLFdBQVcsTUFBTTtBQUNwQixpQkFBSyxVQUFVLFVBQVUsVUFBVSxFQUFFLElBQUk7QUFBQSxVQUMzQyxDQUFDO0FBQUEsUUFDSCxDQUFDO0FBQ0Q7QUFBQSxNQUNGLEtBQUs7QUFDSCxhQUFLLEtBQUssRUFBRSxPQUFPLE1BQU0sTUFBTSxzQkFBc0IsTUFBTSxLQUFLLEtBQUssUUFBUSxDQUFDO0FBQzlFLGFBQUssS0FBSztBQUFBLFVBQ1IsT0FBTztBQUFBLFVBQ1AsTUFBTTtBQUFBLFVBQ04sS0FBSyxXQUFXLE1BQU07QUFDcEIsaUJBQUssT0FBTyxJQUFJLFdBQVcsT0FBTyxFQUFFLElBQUk7QUFBQSxVQUMxQyxDQUFDO0FBQUEsUUFDSCxDQUFDO0FBQ0QsYUFBSyxLQUFLO0FBQUEsVUFDUixPQUFPO0FBQUEsVUFDUCxNQUFNO0FBQUEsVUFDTixLQUFLLFdBQVcsTUFBTTtBQUNwQixpQkFBSyxVQUFVLFVBQVUsVUFBVSxFQUFFLElBQUk7QUFBQSxVQUMzQyxDQUFDO0FBQUEsUUFDSCxDQUFDO0FBQ0Q7QUFBQSxNQUNGLEtBQUs7QUFDSCxhQUFLLEtBQUssRUFBRSxPQUFPLFdBQVcsTUFBTSxrQkFBa0IsTUFBTSxLQUFLLEtBQUssUUFBUSxDQUFDO0FBQy9FO0FBQUEsTUFDRixLQUFLO0FBQ0gsYUFBSyxLQUFLLEVBQUUsT0FBTyxRQUFRLE1BQU0sc0JBQXNCLE1BQU0sS0FBSyxLQUFLLFFBQVEsQ0FBQztBQUNoRixhQUFLLEtBQUs7QUFBQSxVQUNSLE9BQU87QUFBQSxVQUNQLE1BQU07QUFBQSxVQUNOLEtBQUssV0FBVyxNQUFNO0FBQ3BCLGdCQUFJLEVBQUUsSUFBSyxNQUFLLFVBQVUsVUFBVSxVQUFVLEVBQUUsR0FBRztBQUFBLFVBQ3JELENBQUM7QUFBQSxRQUNILENBQUM7QUFDRDtBQUFBLE1BQ0YsS0FBSztBQUNILGFBQUssS0FBSyxFQUFFLE9BQU8sTUFBTSxNQUFNLGtCQUFrQixNQUFNLEtBQUssS0FBSyxRQUFRLENBQUM7QUFDMUUsYUFBSyxLQUFLO0FBQUEsVUFDUixPQUFPO0FBQUEsVUFDUCxNQUFNO0FBQUEsVUFDTixLQUFLLFdBQVcsTUFBTTtBQUNwQixpQkFBSyxPQUFPLElBQUksU0FBUyxVQUFVLEVBQUUsRUFBRTtBQUFBLFVBQ3pDLENBQUM7QUFBQSxRQUNILENBQUM7QUFDRDtBQUFBLE1BQ0YsS0FBSztBQUNILGFBQUssS0FBSyxFQUFFLE9BQU8sUUFBUSxNQUFNLGtCQUFrQixNQUFNLEtBQUssS0FBSyxRQUFRLENBQUM7QUFDNUUsYUFBSyxLQUFLO0FBQUEsVUFDUixPQUFPO0FBQUEsVUFDUCxNQUFNO0FBQUEsVUFDTixLQUFLLFdBQVcsTUFBTTtBQUNwQixpQkFBSyxPQUFPLElBQUksU0FBUyxXQUFXLFlBQVksV0FBVztBQUFBLFVBQzdELENBQUM7QUFBQSxRQUNILENBQUM7QUFDRDtBQUFBLE1BQ0Y7QUFDRSxhQUFLLEtBQUssRUFBRSxPQUFPLE1BQU0sTUFBTSxhQUFhLE1BQU0sS0FBSyxLQUFLLFFBQVEsQ0FBQztBQUFBLElBQ3pFO0FBQ0EsV0FBTztBQUFBLEVBQ1QsQ0FBQztBQUdELFdBQVMsb0JBQTBCO0FBQ2pDLFFBQUksaUJBQWlCLE9BQU87QUFDMUIsdUJBQWlCLFFBQVE7QUFDekI7QUFBQSxJQUNGO0FBQ0EsVUFBTSxPQUFPLEtBQUssUUFBUSxNQUFNLEtBQUssY0FBYyxLQUFLO0FBQ3hELFFBQUksQ0FBQyxLQUFNO0FBQ1gscUJBQWlCLFFBQVEsS0FBSztBQUM5QixnQkFBWSxRQUFRO0FBQUEsRUFDdEI7QUFFQSxTQUFPLEVBQUUsa0JBQWtCLGFBQWEsY0FBYyxrQkFBa0I7QUFDMUU7IiwibmFtZXMiOltdfQ==