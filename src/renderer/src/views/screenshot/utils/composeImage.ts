/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { HistoryItemType } from "/src/views/screenshot/types.ts";
export default function composeImage({
  image,
  width,
  height,
  history,
  bounds,
  scaleFactor
}) {
  return new Promise((resolve, reject) => {
    const scale = Math.max(scaleFactor ?? window.devicePixelRatio, 0.1);
    const $canvas = document.createElement("canvas");
    const targetWidth = Math.max(1, Math.round(bounds.width * scale));
    const targetHeight = Math.max(1, Math.round(bounds.height * scale));
    $canvas.width = targetWidth;
    $canvas.height = targetHeight;
    const ctx = $canvas.getContext("2d");
    if (!ctx) {
      return reject(new Error("convert image to blob fail"));
    }
    const rx = image.naturalWidth / width;
    const ry = image.naturalHeight / height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    ctx.drawImage(
      image,
      bounds.x * rx,
      bounds.y * ry,
      bounds.width * rx,
      bounds.height * ry,
      0,
      0,
      bounds.width,
      bounds.height
    );
    history.stack.slice(0, history.index + 1).forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.draw(ctx, item);
      }
    });
    $canvas.toBlob((blob) => {
      $canvas.width = 0;
      $canvas.height = 0;
      if (!blob) {
        return reject(new Error("canvas toBlob fail"));
      }
      resolve(blob);
    }, "image/png");
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbXBvc2VJbWFnZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IEJvdW5kcywgSGlzdG9yeSB9IGZyb20gJy4uL3R5cGVzJ1xuaW1wb3J0IHsgSGlzdG9yeUl0ZW1UeXBlIH0gZnJvbSAnLi4vdHlwZXMnXG5cbmludGVyZmFjZSBDb21wb3NlSW1hZ2VPcHRzIHtcbiAgaW1hZ2U6IEhUTUxJbWFnZUVsZW1lbnRcbiAgd2lkdGg6IG51bWJlclxuICBoZWlnaHQ6IG51bWJlclxuICBoaXN0b3J5OiBIaXN0b3J5XG4gIGJvdW5kczogQm91bmRzXG4gIC8qKlxuICAgKiDovpPlh7rnvKnmlL7ns7vmlbDvvJrlupTkvKDmnaXmupDmmL7npLrlmajnmoQgc2NhbGVGYWN0b3LvvIjnqpflj6PmiKrlm77ml7Yg4omgIOW9k+WJjeeql+WPo+eahCBkcHLvvInjgIJcbiAgICog57y655yB5Zue6YCAIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlv44CCXG4gICAqL1xuICBzY2FsZUZhY3Rvcj86IG51bWJlclxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjb21wb3NlSW1hZ2Uoe1xuICBpbWFnZSxcbiAgd2lkdGgsXG4gIGhlaWdodCxcbiAgaGlzdG9yeSxcbiAgYm91bmRzLFxuICBzY2FsZUZhY3RvclxufTogQ29tcG9zZUltYWdlT3B0cyk6IFByb21pc2U8QmxvYj4ge1xuICByZXR1cm4gbmV3IFByb21pc2U8QmxvYj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHNjYWxlID0gTWF0aC5tYXgoc2NhbGVGYWN0b3IgPz8gd2luZG93LmRldmljZVBpeGVsUmF0aW8sIDAuMSlcbiAgICBjb25zdCAkY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICBjb25zdCB0YXJnZXRXaWR0aCA9IE1hdGgubWF4KDEsIE1hdGgucm91bmQoYm91bmRzLndpZHRoICogc2NhbGUpKVxuICAgIGNvbnN0IHRhcmdldEhlaWdodCA9IE1hdGgubWF4KDEsIE1hdGgucm91bmQoYm91bmRzLmhlaWdodCAqIHNjYWxlKSlcbiAgICAkY2FudmFzLndpZHRoID0gdGFyZ2V0V2lkdGhcbiAgICAkY2FudmFzLmhlaWdodCA9IHRhcmdldEhlaWdodFxuXG4gICAgY29uc3QgY3R4ID0gJGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG4gICAgaWYgKCFjdHgpIHtcbiAgICAgIHJldHVybiByZWplY3QobmV3IEVycm9yKCdjb252ZXJ0IGltYWdlIHRvIGJsb2IgZmFpbCcpKVxuICAgIH1cblxuICAgIGNvbnN0IHJ4ID0gaW1hZ2UubmF0dXJhbFdpZHRoIC8gd2lkdGhcbiAgICBjb25zdCByeSA9IGltYWdlLm5hdHVyYWxIZWlnaHQgLyBoZWlnaHRcblxuICAgIGN0eC5pbWFnZVNtb290aGluZ0VuYWJsZWQgPSB0cnVlXG4gICAgLy8g6K6+572u5aSq6auY77yM5Zu+54mH5Lya5qih57OKXG4gICAgY3R4LmltYWdlU21vb3RoaW5nUXVhbGl0eSA9ICdsb3cnXG4gICAgY3R4LnNldFRyYW5zZm9ybShzY2FsZSwgMCwgMCwgc2NhbGUsIDAsIDApXG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBib3VuZHMud2lkdGgsIGJvdW5kcy5oZWlnaHQpXG4gICAgY3R4LmRyYXdJbWFnZShcbiAgICAgIGltYWdlLFxuICAgICAgYm91bmRzLnggKiByeCxcbiAgICAgIGJvdW5kcy55ICogcnksXG4gICAgICBib3VuZHMud2lkdGggKiByeCxcbiAgICAgIGJvdW5kcy5oZWlnaHQgKiByeSxcbiAgICAgIDAsXG4gICAgICAwLFxuICAgICAgYm91bmRzLndpZHRoLFxuICAgICAgYm91bmRzLmhlaWdodFxuICAgIClcblxuICAgIGhpc3Rvcnkuc3RhY2suc2xpY2UoMCwgaGlzdG9yeS5pbmRleCArIDEpLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtLnR5cGUgPT09IEhpc3RvcnlJdGVtVHlwZS5Tb3VyY2UpIHtcbiAgICAgICAgaXRlbS5kcmF3KGN0eCwgaXRlbSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgJGNhbnZhcy50b0Jsb2IoKGJsb2IpID0+IHtcbiAgICAgIC8vIEJ1ZyMxNDog5pi+5byP6YeK5pS+IGNhbnZhcyDluK7liqkgR0Mg5Zue5pS25YaF5a2YXG4gICAgICAkY2FudmFzLndpZHRoID0gMFxuICAgICAgJGNhbnZhcy5oZWlnaHQgPSAwXG5cbiAgICAgIGlmICghYmxvYikge1xuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcignY2FudmFzIHRvQmxvYiBmYWlsJykpXG4gICAgICB9XG4gICAgICByZXNvbHZlKGJsb2IpXG4gICAgfSwgJ2ltYWdlL3BuZycpXG4gIH0pXG59XG4iXSwibWFwcGluZ3MiOiJBQUNBLFNBQVMsdUJBQXVCO0FBZWhDLHdCQUF3QixhQUFhO0FBQUEsRUFDbkM7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGLEdBQW9DO0FBQ2xDLFNBQU8sSUFBSSxRQUFjLENBQUMsU0FBUyxXQUFXO0FBQzVDLFVBQU0sUUFBUSxLQUFLLElBQUksZUFBZSxPQUFPLGtCQUFrQixHQUFHO0FBQ2xFLFVBQU0sVUFBVSxTQUFTLGNBQWMsUUFBUTtBQUMvQyxVQUFNLGNBQWMsS0FBSyxJQUFJLEdBQUcsS0FBSyxNQUFNLE9BQU8sUUFBUSxLQUFLLENBQUM7QUFDaEUsVUFBTSxlQUFlLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxPQUFPLFNBQVMsS0FBSyxDQUFDO0FBQ2xFLFlBQVEsUUFBUTtBQUNoQixZQUFRLFNBQVM7QUFFakIsVUFBTSxNQUFNLFFBQVEsV0FBVyxJQUFJO0FBQ25DLFFBQUksQ0FBQyxLQUFLO0FBQ1IsYUFBTyxPQUFPLElBQUksTUFBTSw0QkFBNEIsQ0FBQztBQUFBLElBQ3ZEO0FBRUEsVUFBTSxLQUFLLE1BQU0sZUFBZTtBQUNoQyxVQUFNLEtBQUssTUFBTSxnQkFBZ0I7QUFFakMsUUFBSSx3QkFBd0I7QUFFNUIsUUFBSSx3QkFBd0I7QUFDNUIsUUFBSSxhQUFhLE9BQU8sR0FBRyxHQUFHLE9BQU8sR0FBRyxDQUFDO0FBQ3pDLFFBQUksVUFBVSxHQUFHLEdBQUcsT0FBTyxPQUFPLE9BQU8sTUFBTTtBQUMvQyxRQUFJO0FBQUEsTUFDRjtBQUFBLE1BQ0EsT0FBTyxJQUFJO0FBQUEsTUFDWCxPQUFPLElBQUk7QUFBQSxNQUNYLE9BQU8sUUFBUTtBQUFBLE1BQ2YsT0FBTyxTQUFTO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQSxPQUFPO0FBQUEsTUFDUCxPQUFPO0FBQUEsSUFDVDtBQUVBLFlBQVEsTUFBTSxNQUFNLEdBQUcsUUFBUSxRQUFRLENBQUMsRUFBRSxRQUFRLENBQUMsU0FBUztBQUMxRCxVQUFJLEtBQUssU0FBUyxnQkFBZ0IsUUFBUTtBQUN4QyxhQUFLLEtBQUssS0FBSyxJQUFJO0FBQUEsTUFDckI7QUFBQSxJQUNGLENBQUM7QUFFRCxZQUFRLE9BQU8sQ0FBQyxTQUFTO0FBRXZCLGNBQVEsUUFBUTtBQUNoQixjQUFRLFNBQVM7QUFFakIsVUFBSSxDQUFDLE1BQU07QUFDVCxlQUFPLE9BQU8sSUFBSSxNQUFNLG9CQUFvQixDQUFDO0FBQUEsTUFDL0M7QUFDQSxjQUFRLElBQUk7QUFBQSxJQUNkLEdBQUcsV0FBVztBQUFBLEVBQ2hCLENBQUM7QUFDSDsiLCJuYW1lcyI6W119