/* 2026-09-22 由 dev 缓存编译产物机械还原：类型标注已被 esbuild 剥除，import 说明符已尽量还原。过 node --check，未做运行验证。 */
import { computed } from "vue";
import { HistoryItemType } from "/src/views/screenshot/types.ts";
import { useStore, getValue } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
export function useHistory() {
  const store = useStore();
  const history = computed(() => getValue(store.history));
  const dispatcher = store.dispatcher;
  const push = (action) => {
    const { index, stack } = history.value;
    stack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false;
      }
    });
    if (action.type === HistoryItemType.Source) {
      action.isSelected = true;
    } else if (action.type === HistoryItemType.Edit) {
      action.source.isSelected = true;
    }
    const newStack = stack.slice(0, index + 1);
    newStack.push(action);
    dispatcher?.setHistory({
      index: newStack.length - 1,
      stack: newStack
    });
  };
  const pop = () => {
    const { stack } = history.value;
    const newStack = stack.slice();
    newStack.pop();
    dispatcher?.setHistory({
      index: newStack.length - 1,
      stack: newStack
    });
  };
  const undo = () => {
    const { index, stack } = history.value;
    const newStack = [...stack];
    const item = newStack[index];
    if (item) {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false;
      } else if (item.type === HistoryItemType.Edit) {
        item.source.editHistory.pop();
      }
    }
    dispatcher?.setHistory({
      index: index <= 0 ? -1 : index - 1,
      stack: newStack
    });
  };
  const redo = () => {
    const { index, stack } = history.value;
    const newStack = [...stack];
    const item = newStack[index + 1];
    if (item) {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false;
      } else if (item.type === HistoryItemType.Edit) {
        item.source.editHistory.push(item);
      }
    }
    dispatcher?.setHistory({
      index: index >= newStack.length - 1 ? newStack.length - 1 : index + 1,
      stack: newStack
    });
  };
  const set = (newHistory) => {
    dispatcher?.setHistory({ ...newHistory });
  };
  const select = (action) => {
    const { stack } = history.value;
    const newStack = [...stack];
    newStack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        if (item === action) {
          item.isSelected = true;
        } else {
          item.isSelected = false;
        }
      }
    });
    dispatcher?.setHistory({ ...history.value, stack: newStack });
  };
  const clearSelect = () => {
    const { stack } = history.value;
    const newStack = [...stack];
    newStack.forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.isSelected = false;
      }
    });
    dispatcher?.setHistory({ ...history.value, stack: newStack });
  };
  const reset = () => {
    dispatcher?.setHistory({
      index: -1,
      stack: []
    });
  };
  return [
    {
      // 必须用 getter：组件在挂载时（stack 为空）拿到的是引用快照，
      // 若平铺求值则 top/index/stack 永远停留在初始值，导致
      // 「history.top !== x」判断恒真 → 拖动时每帧重复 push 历史（图形飞出画布、撤销失效）
      get index() {
        return history.value.index;
      },
      get stack() {
        return history.value.stack;
      },
      get top() {
        return history.value.stack[history.value.index];
      }
    },
    {
      push,
      pop,
      undo,
      redo,
      set,
      select,
      clearSelect,
      reset
    }
  ];
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUhpc3RvcnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgdHlwZSB7IEhpc3RvcnksIEhpc3RvcnlJdGVtIH0gZnJvbSAnLi4vdHlwZXMnXG5pbXBvcnQgeyBIaXN0b3J5SXRlbVR5cGUgfSBmcm9tICcuLi90eXBlcydcbmltcG9ydCB7IHVzZVN0b3JlLCBnZXRWYWx1ZSB9IGZyb20gJy4vdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuXG5leHBvcnQgaW50ZXJmYWNlIEhpc3RvcnlWYWx1ZSBleHRlbmRzIEhpc3Rvcnkge1xuICB0b3A/OiBIaXN0b3J5SXRlbTx1bmtub3duLCB1bmtub3duPlxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhpc3RvcnlEaXNwYXRjaGVyIHtcbiAgcHVzaDogPFMsIEU+KGFjdGlvbjogSGlzdG9yeUl0ZW08UywgRT4pID0+IHZvaWRcbiAgcG9wOiAoKSA9PiB2b2lkXG4gIHVuZG86ICgpID0+IHZvaWRcbiAgcmVkbzogKCkgPT4gdm9pZFxuICBzZXQ6IChoaXN0b3J5OiBIaXN0b3J5KSA9PiB2b2lkXG4gIHNlbGVjdDogPFMsIEU+KGFjdGlvbjogSGlzdG9yeUl0ZW08UywgRT4pID0+IHZvaWRcbiAgY2xlYXJTZWxlY3Q6ICgpID0+IHZvaWRcbiAgcmVzZXQ6ICgpID0+IHZvaWRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUhpc3RvcnkoKTogW0hpc3RvcnlWYWx1ZSwgSGlzdG9yeURpc3BhdGNoZXJdIHtcbiAgY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG4gIGNvbnN0IGhpc3RvcnkgPSBjb21wdXRlZCgoKSA9PiBnZXRWYWx1ZShzdG9yZS5oaXN0b3J5KSlcbiAgLy8gc3RvcmUg5pivIHByb3ZpZGVTY3JlZW5zaG90c0NvbnRleHQg5rOo5YWl55qE5aSN5ZCI5a+56LGh77yM57G75Z6L5pyq5a6M5YWo5pS25pWbXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGRpc3BhdGNoZXIgPSAoc3RvcmUgYXMgYW55KS5kaXNwYXRjaGVyXG5cbiAgY29uc3QgcHVzaCA9IDxTLCBFPihhY3Rpb246IEhpc3RvcnlJdGVtPFMsIEU+KSA9PiB7XG4gICAgY29uc3QgeyBpbmRleCwgc3RhY2sgfSA9IGhpc3RvcnkudmFsdWVcblxuICAgIHN0YWNrLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtLnR5cGUgPT09IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UpIHtcbiAgICAgICAgaXRlbS5pc1NlbGVjdGVkID0gZmFsc2VcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgaWYgKGFjdGlvbi50eXBlID09PSBIaXN0b3J5SXRlbVR5cGUuU291cmNlKSB7XG4gICAgICBhY3Rpb24uaXNTZWxlY3RlZCA9IHRydWVcbiAgICB9IGVsc2UgaWYgKGFjdGlvbi50eXBlID09PSBIaXN0b3J5SXRlbVR5cGUuRWRpdCkge1xuICAgICAgYWN0aW9uLnNvdXJjZS5pc1NlbGVjdGVkID0gdHJ1ZVxuICAgIH1cblxuICAgIGNvbnN0IG5ld1N0YWNrID0gc3RhY2suc2xpY2UoMCwgaW5kZXggKyAxKVxuICAgIG5ld1N0YWNrLnB1c2goYWN0aW9uKVxuXG4gICAgZGlzcGF0Y2hlcj8uc2V0SGlzdG9yeSh7XG4gICAgICBpbmRleDogbmV3U3RhY2subGVuZ3RoIC0gMSxcbiAgICAgIHN0YWNrOiBuZXdTdGFja1xuICAgIH0pXG4gIH1cblxuICBjb25zdCBwb3AgPSAoKSA9PiB7XG4gICAgY29uc3QgeyBzdGFjayB9ID0gaGlzdG9yeS52YWx1ZVxuICAgIGNvbnN0IG5ld1N0YWNrID0gc3RhY2suc2xpY2UoKVxuICAgIG5ld1N0YWNrLnBvcCgpXG5cbiAgICBkaXNwYXRjaGVyPy5zZXRIaXN0b3J5KHtcbiAgICAgIGluZGV4OiBuZXdTdGFjay5sZW5ndGggLSAxLFxuICAgICAgc3RhY2s6IG5ld1N0YWNrXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IHVuZG8gPSAoKSA9PiB7XG4gICAgY29uc3QgeyBpbmRleCwgc3RhY2sgfSA9IGhpc3RvcnkudmFsdWVcbiAgICBjb25zdCBuZXdTdGFjayA9IFsuLi5zdGFja11cbiAgICBjb25zdCBpdGVtID0gbmV3U3RhY2tbaW5kZXhdXG5cbiAgICBpZiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gSGlzdG9yeUl0ZW1UeXBlLlNvdXJjZSkge1xuICAgICAgICBpdGVtLmlzU2VsZWN0ZWQgPSBmYWxzZVxuICAgICAgfSBlbHNlIGlmIChpdGVtLnR5cGUgPT09IEhpc3RvcnlJdGVtVHlwZS5FZGl0KSB7XG4gICAgICAgIGl0ZW0uc291cmNlLmVkaXRIaXN0b3J5LnBvcCgpXG4gICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hlcj8uc2V0SGlzdG9yeSh7XG4gICAgICBpbmRleDogaW5kZXggPD0gMCA/IC0xIDogaW5kZXggLSAxLFxuICAgICAgc3RhY2s6IG5ld1N0YWNrXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IHJlZG8gPSAoKSA9PiB7XG4gICAgY29uc3QgeyBpbmRleCwgc3RhY2sgfSA9IGhpc3RvcnkudmFsdWVcbiAgICBjb25zdCBuZXdTdGFjayA9IFsuLi5zdGFja11cbiAgICBjb25zdCBpdGVtID0gbmV3U3RhY2tbaW5kZXggKyAxXVxuXG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIGlmIChpdGVtLnR5cGUgPT09IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UpIHtcbiAgICAgICAgaXRlbS5pc1NlbGVjdGVkID0gZmFsc2VcbiAgICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSBIaXN0b3J5SXRlbVR5cGUuRWRpdCkge1xuICAgICAgICBpdGVtLnNvdXJjZS5lZGl0SGlzdG9yeS5wdXNoKGl0ZW0pXG4gICAgICB9XG4gICAgfVxuXG4gICAgZGlzcGF0Y2hlcj8uc2V0SGlzdG9yeSh7XG4gICAgICBpbmRleDogaW5kZXggPj0gbmV3U3RhY2subGVuZ3RoIC0gMSA/IG5ld1N0YWNrLmxlbmd0aCAtIDEgOiBpbmRleCArIDEsXG4gICAgICBzdGFjazogbmV3U3RhY2tcbiAgICB9KVxuICB9XG5cbiAgY29uc3Qgc2V0ID0gKG5ld0hpc3Rvcnk6IEhpc3RvcnkpID0+IHtcbiAgICBkaXNwYXRjaGVyPy5zZXRIaXN0b3J5KHsgLi4ubmV3SGlzdG9yeSB9KVxuICB9XG5cbiAgY29uc3Qgc2VsZWN0ID0gPFMsIEU+KGFjdGlvbjogSGlzdG9yeUl0ZW08UywgRT4pID0+IHtcbiAgICBjb25zdCB7IHN0YWNrIH0gPSBoaXN0b3J5LnZhbHVlXG4gICAgY29uc3QgbmV3U3RhY2sgPSBbLi4uc3RhY2tdXG4gICAgbmV3U3RhY2suZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gSGlzdG9yeUl0ZW1UeXBlLlNvdXJjZSkge1xuICAgICAgICBpZiAoaXRlbSA9PT0gYWN0aW9uKSB7XG4gICAgICAgICAgaXRlbS5pc1NlbGVjdGVkID0gdHJ1ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGl0ZW0uaXNTZWxlY3RlZCA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KVxuICAgIGRpc3BhdGNoZXI/LnNldEhpc3RvcnkoeyAuLi5oaXN0b3J5LnZhbHVlLCBzdGFjazogbmV3U3RhY2sgfSlcbiAgfVxuXG4gIGNvbnN0IGNsZWFyU2VsZWN0ID0gKCkgPT4ge1xuICAgIGNvbnN0IHsgc3RhY2sgfSA9IGhpc3RvcnkudmFsdWVcbiAgICBjb25zdCBuZXdTdGFjayA9IFsuLi5zdGFja11cbiAgICBuZXdTdGFjay5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICBpZiAoaXRlbS50eXBlID09PSBIaXN0b3J5SXRlbVR5cGUuU291cmNlKSB7XG4gICAgICAgIGl0ZW0uaXNTZWxlY3RlZCA9IGZhbHNlXG4gICAgICB9XG4gICAgfSlcblxuICAgIGRpc3BhdGNoZXI/LnNldEhpc3RvcnkoeyAuLi5oaXN0b3J5LnZhbHVlLCBzdGFjazogbmV3U3RhY2sgfSlcbiAgfVxuXG4gIGNvbnN0IHJlc2V0ID0gKCkgPT4ge1xuICAgIGRpc3BhdGNoZXI/LnNldEhpc3Rvcnkoe1xuICAgICAgaW5kZXg6IC0xLFxuICAgICAgc3RhY2s6IFtdXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiBbXG4gICAge1xuICAgICAgLy8g5b+F6aG755SoIGdldHRlcu+8mue7hOS7tuWcqOaMgui9veaXtu+8iHN0YWNrIOS4uuepuu+8ieaLv+WIsOeahOaYr+W8leeUqOW/q+eFp++8jFxuICAgICAgLy8g6Iul5bmz6ZO65rGC5YC85YiZIHRvcC9pbmRleC9zdGFjayDmsLjov5zlgZznlZnlnKjliJ3lp4vlgLzvvIzlr7zoh7RcbiAgICAgIC8vIOOAjGhpc3RvcnkudG9wICE9PSB444CN5Yik5pat5oGS55yfIOKGkiDmi5bliqjml7bmr4/luKfph43lpI0gcHVzaCDljoblj7LvvIjlm77lvaLpo57lh7rnlLvluIPjgIHmkqTplIDlpLHmlYjvvIlcbiAgICAgIGdldCBpbmRleCgpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gaGlzdG9yeS52YWx1ZS5pbmRleFxuICAgICAgfSxcbiAgICAgIGdldCBzdGFjaygpOiBIaXN0b3J5SXRlbTx1bmtub3duLCB1bmtub3duPltdIHtcbiAgICAgICAgcmV0dXJuIGhpc3RvcnkudmFsdWUuc3RhY2tcbiAgICAgIH0sXG4gICAgICBnZXQgdG9wKCk6IEhpc3RvcnlJdGVtPHVua25vd24sIHVua25vd24+IHwgdW5kZWZpbmVkIHtcbiAgICAgICAgcmV0dXJuIGhpc3RvcnkudmFsdWUuc3RhY2tbaGlzdG9yeS52YWx1ZS5pbmRleF1cbiAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIHB1c2gsXG4gICAgICBwb3AsXG4gICAgICB1bmRvLFxuICAgICAgcmVkbyxcbiAgICAgIHNldCxcbiAgICAgIHNlbGVjdCxcbiAgICAgIGNsZWFyU2VsZWN0LFxuICAgICAgcmVzZXRcbiAgICB9XG4gIF1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxVQUFVLGdCQUFnQjtBQWlCNUIsZ0JBQVMsYUFBZ0Q7QUFDOUQsUUFBTSxRQUFRLFNBQVM7QUFDdkIsUUFBTSxVQUFVLFNBQVMsTUFBTSxTQUFTLE1BQU0sT0FBTyxDQUFDO0FBR3RELFFBQU0sYUFBYyxNQUFjO0FBRWxDLFFBQU0sT0FBTyxDQUFPLFdBQThCO0FBQ2hELFVBQU0sRUFBRSxPQUFPLE1BQU0sSUFBSSxRQUFRO0FBRWpDLFVBQU0sUUFBUSxDQUFDLFNBQVM7QUFDdEIsVUFBSSxLQUFLLFNBQVMsZ0JBQWdCLFFBQVE7QUFDeEMsYUFBSyxhQUFhO0FBQUEsTUFDcEI7QUFBQSxJQUNGLENBQUM7QUFFRCxRQUFJLE9BQU8sU0FBUyxnQkFBZ0IsUUFBUTtBQUMxQyxhQUFPLGFBQWE7QUFBQSxJQUN0QixXQUFXLE9BQU8sU0FBUyxnQkFBZ0IsTUFBTTtBQUMvQyxhQUFPLE9BQU8sYUFBYTtBQUFBLElBQzdCO0FBRUEsVUFBTSxXQUFXLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUN6QyxhQUFTLEtBQUssTUFBTTtBQUVwQixnQkFBWSxXQUFXO0FBQUEsTUFDckIsT0FBTyxTQUFTLFNBQVM7QUFBQSxNQUN6QixPQUFPO0FBQUEsSUFDVCxDQUFDO0FBQUEsRUFDSDtBQUVBLFFBQU0sTUFBTSxNQUFNO0FBQ2hCLFVBQU0sRUFBRSxNQUFNLElBQUksUUFBUTtBQUMxQixVQUFNLFdBQVcsTUFBTSxNQUFNO0FBQzdCLGFBQVMsSUFBSTtBQUViLGdCQUFZLFdBQVc7QUFBQSxNQUNyQixPQUFPLFNBQVMsU0FBUztBQUFBLE1BQ3pCLE9BQU87QUFBQSxJQUNULENBQUM7QUFBQSxFQUNIO0FBRUEsUUFBTSxPQUFPLE1BQU07QUFDakIsVUFBTSxFQUFFLE9BQU8sTUFBTSxJQUFJLFFBQVE7QUFDakMsVUFBTSxXQUFXLENBQUMsR0FBRyxLQUFLO0FBQzFCLFVBQU0sT0FBTyxTQUFTLEtBQUs7QUFFM0IsUUFBSSxNQUFNO0FBQ1IsVUFBSSxLQUFLLFNBQVMsZ0JBQWdCLFFBQVE7QUFDeEMsYUFBSyxhQUFhO0FBQUEsTUFDcEIsV0FBVyxLQUFLLFNBQVMsZ0JBQWdCLE1BQU07QUFDN0MsYUFBSyxPQUFPLFlBQVksSUFBSTtBQUFBLE1BQzlCO0FBQUEsSUFDRjtBQUVBLGdCQUFZLFdBQVc7QUFBQSxNQUNyQixPQUFPLFNBQVMsSUFBSSxLQUFLLFFBQVE7QUFBQSxNQUNqQyxPQUFPO0FBQUEsSUFDVCxDQUFDO0FBQUEsRUFDSDtBQUVBLFFBQU0sT0FBTyxNQUFNO0FBQ2pCLFVBQU0sRUFBRSxPQUFPLE1BQU0sSUFBSSxRQUFRO0FBQ2pDLFVBQU0sV0FBVyxDQUFDLEdBQUcsS0FBSztBQUMxQixVQUFNLE9BQU8sU0FBUyxRQUFRLENBQUM7QUFFL0IsUUFBSSxNQUFNO0FBQ1IsVUFBSSxLQUFLLFNBQVMsZ0JBQWdCLFFBQVE7QUFDeEMsYUFBSyxhQUFhO0FBQUEsTUFDcEIsV0FBVyxLQUFLLFNBQVMsZ0JBQWdCLE1BQU07QUFDN0MsYUFBSyxPQUFPLFlBQVksS0FBSyxJQUFJO0FBQUEsTUFDbkM7QUFBQSxJQUNGO0FBRUEsZ0JBQVksV0FBVztBQUFBLE1BQ3JCLE9BQU8sU0FBUyxTQUFTLFNBQVMsSUFBSSxTQUFTLFNBQVMsSUFBSSxRQUFRO0FBQUEsTUFDcEUsT0FBTztBQUFBLElBQ1QsQ0FBQztBQUFBLEVBQ0g7QUFFQSxRQUFNLE1BQU0sQ0FBQyxlQUF3QjtBQUNuQyxnQkFBWSxXQUFXLEVBQUUsR0FBRyxXQUFXLENBQUM7QUFBQSxFQUMxQztBQUVBLFFBQU0sU0FBUyxDQUFPLFdBQThCO0FBQ2xELFVBQU0sRUFBRSxNQUFNLElBQUksUUFBUTtBQUMxQixVQUFNLFdBQVcsQ0FBQyxHQUFHLEtBQUs7QUFDMUIsYUFBUyxRQUFRLENBQUMsU0FBUztBQUN6QixVQUFJLEtBQUssU0FBUyxnQkFBZ0IsUUFBUTtBQUN4QyxZQUFJLFNBQVMsUUFBUTtBQUNuQixlQUFLLGFBQWE7QUFBQSxRQUNwQixPQUFPO0FBQ0wsZUFBSyxhQUFhO0FBQUEsUUFDcEI7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQ0QsZ0JBQVksV0FBVyxFQUFFLEdBQUcsUUFBUSxPQUFPLE9BQU8sU0FBUyxDQUFDO0FBQUEsRUFDOUQ7QUFFQSxRQUFNLGNBQWMsTUFBTTtBQUN4QixVQUFNLEVBQUUsTUFBTSxJQUFJLFFBQVE7QUFDMUIsVUFBTSxXQUFXLENBQUMsR0FBRyxLQUFLO0FBQzFCLGFBQVMsUUFBUSxDQUFDLFNBQVM7QUFDekIsVUFBSSxLQUFLLFNBQVMsZ0JBQWdCLFFBQVE7QUFDeEMsYUFBSyxhQUFhO0FBQUEsTUFDcEI7QUFBQSxJQUNGLENBQUM7QUFFRCxnQkFBWSxXQUFXLEVBQUUsR0FBRyxRQUFRLE9BQU8sT0FBTyxTQUFTLENBQUM7QUFBQSxFQUM5RDtBQUVBLFFBQU0sUUFBUSxNQUFNO0FBQ2xCLGdCQUFZLFdBQVc7QUFBQSxNQUNyQixPQUFPO0FBQUEsTUFDUCxPQUFPLENBQUM7QUFBQSxJQUNWLENBQUM7QUFBQSxFQUNIO0FBRUEsU0FBTztBQUFBLElBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUlFLElBQUksUUFBZ0I7QUFDbEIsZUFBTyxRQUFRLE1BQU07QUFBQSxNQUN2QjtBQUFBLE1BQ0EsSUFBSSxRQUF5QztBQUMzQyxlQUFPLFFBQVEsTUFBTTtBQUFBLE1BQ3ZCO0FBQUEsTUFDQSxJQUFJLE1BQWlEO0FBQ25ELGVBQU8sUUFBUSxNQUFNLE1BQU0sUUFBUSxNQUFNLEtBQUs7QUFBQSxNQUNoRDtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOyIsIm5hbWVzIjpbXX0=