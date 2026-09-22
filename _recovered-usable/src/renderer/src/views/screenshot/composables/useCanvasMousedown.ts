/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { onMounted, onUnmounted } from "vue";
import useEmiter from "/src/views/screenshot/composables/useEmiter.ts";
export default function useCanvasMousedown(onMousedown) {
  const emiter = useEmiter();
  onMounted(() => {
    emiter.on("mousedown", onMousedown);
  });
  onUnmounted(() => {
    emiter.off("mousedown", onMousedown);
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUNhbnZhc01vdXNlZG93bi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBvbk1vdW50ZWQsIG9uVW5tb3VudGVkIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHVzZUVtaXRlciBmcm9tICcuL3VzZUVtaXRlcidcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXNlQ2FudmFzTW91c2Vkb3duKG9uTW91c2Vkb3duOiAoZTogTW91c2VFdmVudCkgPT4gdW5rbm93bikge1xuICBjb25zdCBlbWl0ZXIgPSB1c2VFbWl0ZXIoKVxuXG4gIG9uTW91bnRlZCgoKSA9PiB7XG4gICAgZW1pdGVyLm9uKCdtb3VzZWRvd24nLCBvbk1vdXNlZG93bilcbiAgfSlcblxuICBvblVubW91bnRlZCgoKSA9PiB7XG4gICAgZW1pdGVyLm9mZignbW91c2Vkb3duJywgb25Nb3VzZWRvd24pXG4gIH0pXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsV0FBVyxtQkFBbUI7QUFDdkMsT0FBTyxlQUFlO0FBRXRCLHdCQUF3QixtQkFBbUIsYUFBeUM7QUFDbEYsUUFBTSxTQUFTLFVBQVU7QUFFekIsWUFBVSxNQUFNO0FBQ2QsV0FBTyxHQUFHLGFBQWEsV0FBVztBQUFBLEVBQ3BDLENBQUM7QUFFRCxjQUFZLE1BQU07QUFDaEIsV0FBTyxJQUFJLGFBQWEsV0FBVztBQUFBLEVBQ3JDLENBQUM7QUFDSDsiLCJuYW1lcyI6W119