import { computed } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { useStore } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
export function useCanvasContextRef() {
  const store = useStore();
  return computed(() => {
    const ctx = store.canvasContextRef.value;
    if (!ctx) {
      return null;
    }
    return {
      canvas: ctx.canvas || null,
      ctx
    };
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUNhbnZhc0NvbnRleHRSZWYudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY29tcHV0ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgeyB1c2VTdG9yZSB9IGZyb20gJy4vdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlQ2FudmFzQ29udGV4dFJlZigpIHtcbiAgY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG4gIHJldHVybiBjb21wdXRlZCgoKSA9PiB7XG4gICAgY29uc3QgY3R4ID0gc3RvcmUuY2FudmFzQ29udGV4dFJlZi52YWx1ZVxuICAgIGlmICghY3R4KSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICAvLyBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQg5pys6Lqr5bCx5pyJIGNhbnZhcyDlsZ7mgKdcbiAgICByZXR1cm4ge1xuICAgICAgY2FudmFzOiBjdHguY2FudmFzIHx8IG51bGwsXG4gICAgICBjdHhcbiAgICB9XG4gIH0pXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBRWxCLGdCQUFTLHNCQUFzQjtBQUNwQyxRQUFNLFFBQVEsU0FBUztBQUN2QixTQUFPLFNBQVMsTUFBTTtBQUNwQixVQUFNLE1BQU0sTUFBTSxpQkFBaUI7QUFDbkMsUUFBSSxDQUFDLEtBQUs7QUFDUixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU87QUFBQSxNQUNMLFFBQVEsSUFBSSxVQUFVO0FBQUEsTUFDdEI7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDO0FBQ0g7IiwibmFtZXMiOltdfQ==