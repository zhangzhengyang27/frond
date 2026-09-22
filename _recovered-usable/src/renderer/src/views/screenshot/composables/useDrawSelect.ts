/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { onMounted, onUnmounted } from "vue";
import useEmiter from "/src/views/screenshot/composables/useEmiter.ts";
export default function useDrawSelect(onDrawSelect) {
  const emiter = useEmiter();
  onMounted(() => {
    emiter.on("drawselect", onDrawSelect);
  });
  onUnmounted(() => {
    emiter.off("drawselect", onDrawSelect);
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZURyYXdTZWxlY3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgb25Nb3VudGVkLCBvblVubW91bnRlZCB9IGZyb20gJ3Z1ZSdcbmltcG9ydCB0eXBlIHsgSGlzdG9yeUl0ZW1Tb3VyY2UgfSBmcm9tICcuLi90eXBlcydcbmltcG9ydCB1c2VFbWl0ZXIgZnJvbSAnLi91c2VFbWl0ZXInXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHVzZURyYXdTZWxlY3QoXG4gIG9uRHJhd1NlbGVjdDogKGFjdGlvbjogSGlzdG9yeUl0ZW1Tb3VyY2U8dW5rbm93biwgdW5rbm93bj4sIGU6IE1vdXNlRXZlbnQpID0+IHVua25vd25cbikge1xuICBjb25zdCBlbWl0ZXIgPSB1c2VFbWl0ZXIoKVxuXG4gIG9uTW91bnRlZCgoKSA9PiB7XG4gICAgZW1pdGVyLm9uKCdkcmF3c2VsZWN0Jywgb25EcmF3U2VsZWN0KVxuICB9KVxuXG4gIG9uVW5tb3VudGVkKCgpID0+IHtcbiAgICBlbWl0ZXIub2ZmKCdkcmF3c2VsZWN0Jywgb25EcmF3U2VsZWN0KVxuICB9KVxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFdBQVcsbUJBQW1CO0FBRXZDLE9BQU8sZUFBZTtBQUV0Qix3QkFBd0IsY0FDdEIsY0FDQTtBQUNBLFFBQU0sU0FBUyxVQUFVO0FBRXpCLFlBQVUsTUFBTTtBQUNkLFdBQU8sR0FBRyxjQUFjLFlBQVk7QUFBQSxFQUN0QyxDQUFDO0FBRUQsY0FBWSxNQUFNO0FBQ2hCLFdBQU8sSUFBSSxjQUFjLFlBQVk7QUFBQSxFQUN2QyxDQUFDO0FBQ0g7IiwibmFtZXMiOltdfQ==