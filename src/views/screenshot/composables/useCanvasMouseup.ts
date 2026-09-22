/* 2026-09-22 由 dev 缓存编译产物机械还原：类型标注已被 esbuild 剥除，import 说明符已尽量还原。过 node --check，未做运行验证。 */
import { onMounted, onUnmounted } from "vue";
import useEmiter from "/src/views/screenshot/composables/useEmiter.ts";
export default function useCanvasMouseup(onMouseup) {
  const emiter = useEmiter();
  onMounted(() => {
    emiter.on("mouseup", onMouseup);
  });
  onUnmounted(() => {
    emiter.off("mouseup", onMouseup);
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUNhbnZhc01vdXNldXAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgb25Nb3VudGVkLCBvblVubW91bnRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB1c2VFbWl0ZXIgZnJvbSAnLi91c2VFbWl0ZXInXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVzZUNhbnZhc01vdXNldXAob25Nb3VzZXVwOiAoZTogTW91c2VFdmVudCkgPT4gdW5rbm93bikge1xuICBjb25zdCBlbWl0ZXIgPSB1c2VFbWl0ZXIoKVxuXG4gIG9uTW91bnRlZCgoKSA9PiB7XG4gICAgZW1pdGVyLm9uKCdtb3VzZXVwJywgb25Nb3VzZXVwKVxuICB9KVxuXG4gIG9uVW5tb3VudGVkKCgpID0+IHtcbiAgICBlbWl0ZXIub2ZmKCdtb3VzZXVwJywgb25Nb3VzZXVwKVxuICB9KVxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFdBQVcsbUJBQW1CO0FBQ3ZDLE9BQU8sZUFBZTtBQUV0Qix3QkFBd0IsaUJBQWlCLFdBQXVDO0FBQzlFLFFBQU0sU0FBUyxVQUFVO0FBRXpCLFlBQVUsTUFBTTtBQUNkLFdBQU8sR0FBRyxXQUFXLFNBQVM7QUFBQSxFQUNoQyxDQUFDO0FBRUQsY0FBWSxNQUFNO0FBQ2hCLFdBQU8sSUFBSSxXQUFXLFNBQVM7QUFBQSxFQUNqQyxDQUFDO0FBQ0g7IiwibmFtZXMiOltdfQ==