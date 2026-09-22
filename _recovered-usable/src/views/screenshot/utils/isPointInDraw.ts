/* 2026-09-22 由 dev 缓存编译产物机械还原：类型标注已被 esbuild 剥除，import 说明符已尽量还原。过 node --check，未做运行验证。 */
import { HistoryItemType } from "/src/views/screenshot/types.ts";
export default function isPointInDraw(bounds, canvas, history, e) {
  if (!canvas) {
    return false;
  }
  const $canvas = document.createElement("canvas");
  $canvas.width = bounds.width;
  $canvas.height = bounds.height;
  const ctx = $canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  const { left, top } = canvas.getBoundingClientRect();
  const x = e.clientX - left;
  const y = e.clientY - top;
  const stack = [...history.stack.slice(0, history.index + 1)];
  return stack.reverse().find((item) => {
    if (item.type !== HistoryItemType.Source) {
      return false;
    }
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    return item.isHit?.(ctx, item, { x, y });
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlzUG9pbnRJbkRyYXcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBCb3VuZHMsIEhpc3RvcnkgfSBmcm9tICcuLi90eXBlcydcbmltcG9ydCB7IEhpc3RvcnlJdGVtVHlwZSB9IGZyb20gJy4uL3R5cGVzJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBpc1BvaW50SW5EcmF3KFxuICBib3VuZHM6IEJvdW5kcyxcbiAgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGwsXG4gIGhpc3Rvcnk6IEhpc3RvcnksXG4gIGU6IE1vdXNlRXZlbnRcbikge1xuICBpZiAoIWNhbnZhcykge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgY29uc3QgJGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gICRjYW52YXMud2lkdGggPSBib3VuZHMud2lkdGhcbiAgJGNhbnZhcy5oZWlnaHQgPSBib3VuZHMuaGVpZ2h0XG4gIGNvbnN0IGN0eCA9ICRjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuXG4gIGlmICghY3R4KSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBjb25zdCB7IGxlZnQsIHRvcCB9ID0gY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gIGNvbnN0IHggPSBlLmNsaWVudFggLSBsZWZ0XG4gIGNvbnN0IHkgPSBlLmNsaWVudFkgLSB0b3BcblxuICBjb25zdCBzdGFjayA9IFsuLi5oaXN0b3J5LnN0YWNrLnNsaWNlKDAsIGhpc3RvcnkuaW5kZXggKyAxKV1cblxuICByZXR1cm4gc3RhY2sucmV2ZXJzZSgpLmZpbmQoKGl0ZW0pID0+IHtcbiAgICBpZiAoaXRlbS50eXBlICE9PSBIaXN0b3J5SXRlbVR5cGUuU291cmNlKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBib3VuZHMud2lkdGgsIGJvdW5kcy5oZWlnaHQpXG4gICAgcmV0dXJuIGl0ZW0uaXNIaXQ/LihjdHgsIGl0ZW0sIHsgeCwgeSB9KVxuICB9KVxufVxuIl0sIm1hcHBpbmdzIjoiQUFDQSxTQUFTLHVCQUF1QjtBQUVoQyx3QkFBd0IsY0FDdEIsUUFDQSxRQUNBLFNBQ0EsR0FDQTtBQUNBLE1BQUksQ0FBQyxRQUFRO0FBQ1gsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLFVBQVUsU0FBUyxjQUFjLFFBQVE7QUFDL0MsVUFBUSxRQUFRLE9BQU87QUFDdkIsVUFBUSxTQUFTLE9BQU87QUFDeEIsUUFBTSxNQUFNLFFBQVEsV0FBVyxJQUFJO0FBRW5DLE1BQUksQ0FBQyxLQUFLO0FBQ1IsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLEVBQUUsTUFBTSxJQUFJLElBQUksT0FBTyxzQkFBc0I7QUFDbkQsUUFBTSxJQUFJLEVBQUUsVUFBVTtBQUN0QixRQUFNLElBQUksRUFBRSxVQUFVO0FBRXRCLFFBQU0sUUFBUSxDQUFDLEdBQUcsUUFBUSxNQUFNLE1BQU0sR0FBRyxRQUFRLFFBQVEsQ0FBQyxDQUFDO0FBRTNELFNBQU8sTUFBTSxRQUFRLEVBQUUsS0FBSyxDQUFDLFNBQVM7QUFDcEMsUUFBSSxLQUFLLFNBQVMsZ0JBQWdCLFFBQVE7QUFDeEMsYUFBTztBQUFBLElBQ1Q7QUFDQSxRQUFJLFVBQVUsR0FBRyxHQUFHLE9BQU8sT0FBTyxPQUFPLE1BQU07QUFDL0MsV0FBTyxLQUFLLFFBQVEsS0FBSyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUN6QyxDQUFDO0FBQ0g7IiwibmFtZXMiOltdfQ==