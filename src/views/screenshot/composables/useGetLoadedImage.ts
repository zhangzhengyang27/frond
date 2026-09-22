/* 2026-09-22 由 dev 缓存编译产物机械还原：类型标注已被 esbuild 剥除，import 说明符已尽量还原。过 node --check，未做运行验证。 */
import { ref, watch, onUnmounted } from "vue";
export default function useGetLoadedImage(url) {
  const image = ref(null);
  let prevImg = null;
  watch(
    () => url,
    (newUrl) => {
      if (prevImg) {
        prevImg.onload = null;
        prevImg.onerror = null;
        prevImg.src = "";
        prevImg = null;
      }
      if (!newUrl) {
        image.value = null;
        return;
      }
      const img = new Image();
      prevImg = img;
      img.onload = () => {
        image.value = img;
      };
      img.onerror = () => {
        image.value = null;
      };
      img.src = newUrl;
    },
    { immediate: true }
  );
  onUnmounted(() => {
    if (prevImg) {
      prevImg.onload = null;
      prevImg.onerror = null;
      prevImg.src = "";
      prevImg = null;
    }
    image.value = null;
  });
  return image;
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUdldExvYWRlZEltYWdlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlZiwgd2F0Y2gsIG9uVW5tb3VudGVkIH0gZnJvbSAndnVlJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB1c2VHZXRMb2FkZWRJbWFnZSh1cmw/OiBzdHJpbmcpIHtcbiAgY29uc3QgaW1hZ2UgPSByZWY8SFRNTEltYWdlRWxlbWVudCB8IG51bGw+KG51bGwpXG5cbiAgLy8gQnVnIzY6IOS/neWtmOaXpyBJbWFnZSDlvJXnlKjku6Xkvr/muIXnkIZcbiAgbGV0IHByZXZJbWc6IEhUTUxJbWFnZUVsZW1lbnQgfCBudWxsID0gbnVsbFxuXG4gIHdhdGNoKFxuICAgICgpID0+IHVybCxcbiAgICAobmV3VXJsKSA9PiB7XG4gICAgICAvLyBCdWcjNjog5riF55CG5penIEltYWdlIOWvueixoe+8jOmHiuaUvuWGheWtmFxuICAgICAgaWYgKHByZXZJbWcpIHtcbiAgICAgICAgcHJldkltZy5vbmxvYWQgPSBudWxsXG4gICAgICAgIHByZXZJbWcub25lcnJvciA9IG51bGxcbiAgICAgICAgcHJldkltZy5zcmMgPSAnJ1xuICAgICAgICBwcmV2SW1nID0gbnVsbFxuICAgICAgfVxuXG4gICAgICBpZiAoIW5ld1VybCkge1xuICAgICAgICBpbWFnZS52YWx1ZSA9IG51bGxcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG4gICAgICBwcmV2SW1nID0gaW1nXG4gICAgICBpbWcub25sb2FkID0gKCkgPT4ge1xuICAgICAgICBpbWFnZS52YWx1ZSA9IGltZ1xuICAgICAgfVxuICAgICAgaW1nLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgIGltYWdlLnZhbHVlID0gbnVsbFxuICAgICAgfVxuICAgICAgaW1nLnNyYyA9IG5ld1VybFxuICAgIH0sXG4gICAgeyBpbW1lZGlhdGU6IHRydWUgfVxuICApXG5cbiAgLy8g57uE5Lu25Y246L295pe25riF55CGXG4gIG9uVW5tb3VudGVkKCgpID0+IHtcbiAgICBpZiAocHJldkltZykge1xuICAgICAgcHJldkltZy5vbmxvYWQgPSBudWxsXG4gICAgICBwcmV2SW1nLm9uZXJyb3IgPSBudWxsXG4gICAgICBwcmV2SW1nLnNyYyA9ICcnXG4gICAgICBwcmV2SW1nID0gbnVsbFxuICAgIH1cbiAgICBpbWFnZS52YWx1ZSA9IG51bGxcbiAgfSlcblxuICByZXR1cm4gaW1hZ2Vcbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxLQUFLLE9BQU8sbUJBQW1CO0FBRXhDLHdCQUF3QixrQkFBa0IsS0FBYztBQUN0RCxRQUFNLFFBQVEsSUFBNkIsSUFBSTtBQUcvQyxNQUFJLFVBQW1DO0FBRXZDO0FBQUEsSUFDRSxNQUFNO0FBQUEsSUFDTixDQUFDLFdBQVc7QUFFVixVQUFJLFNBQVM7QUFDWCxnQkFBUSxTQUFTO0FBQ2pCLGdCQUFRLFVBQVU7QUFDbEIsZ0JBQVEsTUFBTTtBQUNkLGtCQUFVO0FBQUEsTUFDWjtBQUVBLFVBQUksQ0FBQyxRQUFRO0FBQ1gsY0FBTSxRQUFRO0FBQ2Q7QUFBQSxNQUNGO0FBRUEsWUFBTSxNQUFNLElBQUksTUFBTTtBQUN0QixnQkFBVTtBQUNWLFVBQUksU0FBUyxNQUFNO0FBQ2pCLGNBQU0sUUFBUTtBQUFBLE1BQ2hCO0FBQ0EsVUFBSSxVQUFVLE1BQU07QUFDbEIsY0FBTSxRQUFRO0FBQUEsTUFDaEI7QUFDQSxVQUFJLE1BQU07QUFBQSxJQUNaO0FBQUEsSUFDQSxFQUFFLFdBQVcsS0FBSztBQUFBLEVBQ3BCO0FBR0EsY0FBWSxNQUFNO0FBQ2hCLFFBQUksU0FBUztBQUNYLGNBQVEsU0FBUztBQUNqQixjQUFRLFVBQVU7QUFDbEIsY0FBUSxNQUFNO0FBQ2QsZ0JBQVU7QUFBQSxJQUNaO0FBQ0EsVUFBTSxRQUFRO0FBQUEsRUFDaEIsQ0FBQztBQUVELFNBQU87QUFDVDsiLCJuYW1lcyI6W119