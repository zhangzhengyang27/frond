/* 2026-09-22 由 dev 缓存编译产物机械还原：类型标注已被 esbuild 剥除，import 说明符已尽量还原。过 node --check，未做运行验证。 */
import { useRouter, useRoute } from "vue-router";
export function useAppMenu() {
  const router = useRouter();
  const route = useRoute();
  function navigateAndRecord(moduleId, path) {
    router.push(path);
    if (window.api?.usage?.recordUse) {
      void window.api.usage.recordUse(moduleId);
    }
  }
  function install() {
    const unsubs = [];
    if (window.api.launcher?.onAppRouteTaken) {
      unsubs.push(
        window.api.launcher.onAppRouteTaken(({ path }) => {
          const target = path.split("?")[0];
          if (route.path === target) {
            router.push("/");
          }
        })
      );
    }
    if (window.api?.onAppOpenModule) {
      unsubs.push(
        window.api.onAppOpenModule(({ moduleId, path }) => {
          navigateAndRecord(moduleId, path);
        })
      );
    }
    if (window.api?.onAppGoHome) {
      unsubs.push(window.api.onAppGoHome(() => router.push("/")));
    }
    if (window.api?.onAppOpenCommandPalette) {
      unsubs.push(
        window.api.onAppOpenCommandPalette(() => {
          import("/src/composables/useCommandPalette.ts").then(({ useCommandPalette }) => {
            useCommandPalette().open();
          });
        })
      );
    }
    if (window.api?.onAppOpenSettings) {
      unsubs.push(window.api.onAppOpenSettings(() => router.push("/settings")));
    }
    if (window.api?.onAppOpenAbout) {
      unsubs.push(window.api.onAppOpenAbout(() => router.push("/about")));
    }
    return () => {
      for (const u of unsubs) u();
    };
  }
  return { install };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUFwcE1lbnUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMZWFmIMK3IOS4u+i/m+eoiyDihpIg5riy5p+T56uv77ya6I+c5Y2VIC8gZG9jayAvIHRyYXkg6Lez6L2s57uf5LiA5aSE55CGXG4gKlxuICog6K6i6ZiF55qEIGNoYW5uZWzvvIhzcmMvbWFpbi9tb2R1bGVzL2FwcE1lbnUudHMg5Y+R5Ye677yJ77yaXG4gKiAtIGFwcDpvcGVuTW9kdWxlICAgICAgICAgICB7IG1vZHVsZUlkLCBwYXRoIH1cbiAqIC0gYXBwOmdvSG9tZVxuICogLSBhcHA6b3BlbkNvbW1hbmRQYWxldHRlXG4gKiAtIGFwcDpvcGVuU2V0dGluZ3NcbiAqIC0gYXBwOm9wZW5BYm91dFxuICpcbiAqIOi3s+i9rOi3r+W+hOS4jiDijJgxLTkgLyBDb21tYW5kUGFsZXR0ZSDlrozlhajkuIDoh7TvvJpyb3V0ZXIucHVzaCArIHVzYWdlLnJlY29yZFVzZeOAglxuICog6LCD55So5pa577yIQXBwLnZ1Ze+8ieWcqOaMgui9veaXtiBpbnN0YWxsKCkg5LiA5qyh77yb5Y246L295pe2IHVuaW5zdGFsbCgpIOmHiuaUviBsaXN0ZW5lcuOAglxuICovXG5cbmltcG9ydCB7IHVzZVJvdXRlciwgdXNlUm91dGUgfSBmcm9tICd2dWUtcm91dGVyJ1xuXG50eXBlIFVuc3Vic2NyaWJlID0gKCkgPT4gdm9pZFxuXG5leHBvcnQgZnVuY3Rpb24gdXNlQXBwTWVudSgpOiB7XG4gIGluc3RhbGw6ICgpID0+IFVuc3Vic2NyaWJlXG59IHtcbiAgLy8g5b+F6aG75ZyoIHNldHVwIOS4iuS4i+aWh+WGheWPliByb3V0ZXLvvIjosIPnlKjmlrnlnKggc2V0dXAg5Lit6LCD55So5pysIGNvbXBvc2FibGXvvInjgIJcbiAgLy8g5LqL5Lu25Zue6LCD6YeM5YaN6LCDIHVzZVJvdXRlcigpIOS8muaLv+WIsCB1bmRlZmluZWTvvIhpbmplY3Qg6ISx56a7IHNldHVwIOWkseaViO+8ieKAlOKAlFxuICAvLyDov5nmraPmmK/jgIzog7blm4rmkJzmqKHlnZflm57ovabmsqHlj43lupTjgI3nmoTmoLnlm6DvvIhCL0ZpeCAyMDI2LTA577yJ44CCXG4gIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpXG4gIGNvbnN0IHJvdXRlID0gdXNlUm91dGUoKVxuXG4gIGZ1bmN0aW9uIG5hdmlnYXRlQW5kUmVjb3JkKG1vZHVsZUlkOiBzdHJpbmcsIHBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIHJvdXRlci5wdXNoKHBhdGgpXG4gICAgaWYgKHdpbmRvdy5hcGk/LnVzYWdlPy5yZWNvcmRVc2UpIHtcbiAgICAgIHZvaWQgd2luZG93LmFwaS51c2FnZS5yZWNvcmRVc2UobW9kdWxlSWQpXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaW5zdGFsbCgpOiBVbnN1YnNjcmliZSB7XG4gICAgY29uc3QgdW5zdWJzOiBVbnN1YnNjcmliZVtdID0gW11cblxuICAgIGlmICh3aW5kb3cuYXBpLmxhdW5jaGVyPy5vbkFwcFJvdXRlVGFrZW4pIHtcbiAgICAgIC8vIElBIHYyIOmYtuautUPvvJrni6znq4vmqKHlnZfnqpfmjqXnrqHmn5Dot6/nlLHml7bvvIzkuLvnqpflj6Poi6XmraPmmL7npLrlkIzkuIDot6/nlLHliJnorqnkvY3lm54gSHVi77yMXG4gICAgICAvLyDpgb/lhY3lkIzkuIDmqKHlnZflh7rnjrDjgIzmsonmtbjnqpcgKyDkuLvnqpflj6PluKbkvqfmoI/jgI3kuKTku73nlYzpnaJcbiAgICAgIHVuc3Vicy5wdXNoKFxuICAgICAgICB3aW5kb3cuYXBpLmxhdW5jaGVyLm9uQXBwUm91dGVUYWtlbigoeyBwYXRoIH0pID0+IHtcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSBwYXRoLnNwbGl0KCc/JylbMF1cbiAgICAgICAgICBpZiAocm91dGUucGF0aCA9PT0gdGFyZ2V0KSB7XG4gICAgICAgICAgICByb3V0ZXIucHVzaCgnLycpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgKVxuICAgIH1cblxuICAgIGlmICh3aW5kb3cuYXBpPy5vbkFwcE9wZW5Nb2R1bGUpIHtcbiAgICAgIHVuc3Vicy5wdXNoKFxuICAgICAgICB3aW5kb3cuYXBpLm9uQXBwT3Blbk1vZHVsZSgoeyBtb2R1bGVJZCwgcGF0aCB9KSA9PiB7XG4gICAgICAgICAgbmF2aWdhdGVBbmRSZWNvcmQobW9kdWxlSWQsIHBhdGgpXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgfVxuICAgIGlmICh3aW5kb3cuYXBpPy5vbkFwcEdvSG9tZSkge1xuICAgICAgdW5zdWJzLnB1c2god2luZG93LmFwaS5vbkFwcEdvSG9tZSgoKSA9PiByb3V0ZXIucHVzaCgnLycpKSlcbiAgICB9XG4gICAgaWYgKHdpbmRvdy5hcGk/Lm9uQXBwT3BlbkNvbW1hbmRQYWxldHRlKSB7XG4gICAgICB1bnN1YnMucHVzaChcbiAgICAgICAgd2luZG93LmFwaS5vbkFwcE9wZW5Db21tYW5kUGFsZXR0ZSgoKSA9PiB7XG4gICAgICAgICAgLy8g5byV5YWlIHVzZUNvbW1hbmRQYWxldHRl77yI5Yqo5oCBIGltcG9ydCDpgb/lhY0gU1NSIC8g5rWL6K+V546v5aKD5oql6ZSZ77yJXG4gICAgICAgICAgaW1wb3J0KCcuL3VzZUNvbW1hbmRQYWxldHRlJykudGhlbigoeyB1c2VDb21tYW5kUGFsZXR0ZSB9KSA9PiB7XG4gICAgICAgICAgICB1c2VDb21tYW5kUGFsZXR0ZSgpLm9wZW4oKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgfVxuICAgIGlmICh3aW5kb3cuYXBpPy5vbkFwcE9wZW5TZXR0aW5ncykge1xuICAgICAgdW5zdWJzLnB1c2god2luZG93LmFwaS5vbkFwcE9wZW5TZXR0aW5ncygoKSA9PiByb3V0ZXIucHVzaCgnL3NldHRpbmdzJykpKVxuICAgIH1cbiAgICBpZiAod2luZG93LmFwaT8ub25BcHBPcGVuQWJvdXQpIHtcbiAgICAgIHVuc3Vicy5wdXNoKHdpbmRvdy5hcGkub25BcHBPcGVuQWJvdXQoKCkgPT4gcm91dGVyLnB1c2goJy9hYm91dCcpKSlcbiAgICB9XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCB1IG9mIHVuc3VicykgdSgpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgaW5zdGFsbCB9XG59XG4iXSwibWFwcGluZ3MiOiJBQWNBLFNBQVMsV0FBVyxnQkFBZ0I7QUFJN0IsZ0JBQVMsYUFFZDtBQUlBLFFBQU0sU0FBUyxVQUFVO0FBQ3pCLFFBQU0sUUFBUSxTQUFTO0FBRXZCLFdBQVMsa0JBQWtCLFVBQWtCLE1BQW9CO0FBQy9ELFdBQU8sS0FBSyxJQUFJO0FBQ2hCLFFBQUksT0FBTyxLQUFLLE9BQU8sV0FBVztBQUNoQyxXQUFLLE9BQU8sSUFBSSxNQUFNLFVBQVUsUUFBUTtBQUFBLElBQzFDO0FBQUEsRUFDRjtBQUVBLFdBQVMsVUFBdUI7QUFDOUIsVUFBTSxTQUF3QixDQUFDO0FBRS9CLFFBQUksT0FBTyxJQUFJLFVBQVUsaUJBQWlCO0FBR3hDLGFBQU87QUFBQSxRQUNMLE9BQU8sSUFBSSxTQUFTLGdCQUFnQixDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ2hELGdCQUFNLFNBQVMsS0FBSyxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2hDLGNBQUksTUFBTSxTQUFTLFFBQVE7QUFDekIsbUJBQU8sS0FBSyxHQUFHO0FBQUEsVUFDakI7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUVBLFFBQUksT0FBTyxLQUFLLGlCQUFpQjtBQUMvQixhQUFPO0FBQUEsUUFDTCxPQUFPLElBQUksZ0JBQWdCLENBQUMsRUFBRSxVQUFVLEtBQUssTUFBTTtBQUNqRCw0QkFBa0IsVUFBVSxJQUFJO0FBQUEsUUFDbEMsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQ0EsUUFBSSxPQUFPLEtBQUssYUFBYTtBQUMzQixhQUFPLEtBQUssT0FBTyxJQUFJLFlBQVksTUFBTSxPQUFPLEtBQUssR0FBRyxDQUFDLENBQUM7QUFBQSxJQUM1RDtBQUNBLFFBQUksT0FBTyxLQUFLLHlCQUF5QjtBQUN2QyxhQUFPO0FBQUEsUUFDTCxPQUFPLElBQUksd0JBQXdCLE1BQU07QUFFdkMsaUJBQU8scUJBQXFCLEVBQUUsS0FBSyxDQUFDLEVBQUUsa0JBQWtCLE1BQU07QUFDNUQsOEJBQWtCLEVBQUUsS0FBSztBQUFBLFVBQzNCLENBQUM7QUFBQSxRQUNILENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUNBLFFBQUksT0FBTyxLQUFLLG1CQUFtQjtBQUNqQyxhQUFPLEtBQUssT0FBTyxJQUFJLGtCQUFrQixNQUFNLE9BQU8sS0FBSyxXQUFXLENBQUMsQ0FBQztBQUFBLElBQzFFO0FBQ0EsUUFBSSxPQUFPLEtBQUssZ0JBQWdCO0FBQzlCLGFBQU8sS0FBSyxPQUFPLElBQUksZUFBZSxNQUFNLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQztBQUFBLElBQ3BFO0FBRUEsV0FBTyxNQUFNO0FBQ1gsaUJBQVcsS0FBSyxPQUFRLEdBQUU7QUFBQSxJQUM1QjtBQUFBLEVBQ0Y7QUFFQSxTQUFPLEVBQUUsUUFBUTtBQUNuQjsiLCJuYW1lcyI6W119