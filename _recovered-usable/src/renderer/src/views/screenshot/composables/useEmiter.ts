/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { useStore } from "/src/views/screenshot/composables/useScreenshotsContext.ts";
export default function useEmiter() {
  const store = useStore();
  const emiterRef = store.emiterRef;
  const on = (event, listener) => {
    const emiter = emiterRef.value;
    if (Array.isArray(emiter[event])) {
      emiter[event].push(listener);
    } else {
      emiter[event] = [listener];
    }
  };
  const off = (event, listener) => {
    const emiter = emiterRef.value;
    if (Array.isArray(emiter[event])) {
      const index = emiter[event].findIndex((item) => item === listener);
      if (index !== -1) {
        emiter[event].splice(index, 1);
      }
    }
  };
  const emit = (event, ...args) => {
    const emiter = emiterRef.value;
    if (Array.isArray(emiter[event])) {
      emiter[event].forEach((listener) => listener(...args));
    }
  };
  const reset = () => {
    emiterRef.value = {};
  };
  return {
    on,
    off,
    emit,
    reset
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUVtaXRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IEVtaXRlckxpc3RlbmVyIH0gZnJvbSAnLi4vdHlwZXMnXG5pbXBvcnQgeyB1c2VTdG9yZSB9IGZyb20gJy4vdXNlU2NyZWVuc2hvdHNDb250ZXh0J1xuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXRlckRpc3BhdGNoZXIge1xuICBvbjogKGV2ZW50OiBzdHJpbmcsIGxpc3RlbmVyOiBFbWl0ZXJMaXN0ZW5lcikgPT4gdm9pZFxuICBvZmY6IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRW1pdGVyTGlzdGVuZXIpID0+IHZvaWRcbiAgZW1pdDogKGV2ZW50OiBzdHJpbmcsIC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZFxuICByZXNldDogKCkgPT4gdm9pZFxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB1c2VFbWl0ZXIoKTogRW1pdGVyRGlzcGF0Y2hlciB7XG4gIGNvbnN0IHN0b3JlID0gdXNlU3RvcmUoKVxuICBjb25zdCBlbWl0ZXJSZWYgPSBzdG9yZS5lbWl0ZXJSZWZcblxuICBjb25zdCBvbiA9IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRW1pdGVyTGlzdGVuZXIpID0+IHtcbiAgICBjb25zdCBlbWl0ZXIgPSBlbWl0ZXJSZWYudmFsdWVcbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbWl0ZXJbZXZlbnRdKSkge1xuICAgICAgZW1pdGVyW2V2ZW50XS5wdXNoKGxpc3RlbmVyKVxuICAgIH0gZWxzZSB7XG4gICAgICBlbWl0ZXJbZXZlbnRdID0gW2xpc3RlbmVyXVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG9mZiA9IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogRW1pdGVyTGlzdGVuZXIpID0+IHtcbiAgICBjb25zdCBlbWl0ZXIgPSBlbWl0ZXJSZWYudmFsdWVcbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbWl0ZXJbZXZlbnRdKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBlbWl0ZXJbZXZlbnRdLmZpbmRJbmRleCgoaXRlbSkgPT4gaXRlbSA9PT0gbGlzdGVuZXIpXG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGVtaXRlcltldmVudF0uc3BsaWNlKGluZGV4LCAxKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGVtaXQgPSAoZXZlbnQ6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG4gICAgY29uc3QgZW1pdGVyID0gZW1pdGVyUmVmLnZhbHVlXG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbWl0ZXJbZXZlbnRdKSkge1xuICAgICAgZW1pdGVyW2V2ZW50XS5mb3JFYWNoKChsaXN0ZW5lcikgPT4gbGlzdGVuZXIoLi4uYXJncykpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgcmVzZXQgPSAoKSA9PiB7XG4gICAgZW1pdGVyUmVmLnZhbHVlID0ge31cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgb24sXG4gICAgb2ZmLFxuICAgIGVtaXQsXG4gICAgcmVzZXRcbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFDQSxTQUFTLGdCQUFnQjtBQVN6Qix3QkFBd0IsWUFBOEI7QUFDcEQsUUFBTSxRQUFRLFNBQVM7QUFDdkIsUUFBTSxZQUFZLE1BQU07QUFFeEIsUUFBTSxLQUFLLENBQUMsT0FBZSxhQUE2QjtBQUN0RCxVQUFNLFNBQVMsVUFBVTtBQUN6QixRQUFJLE1BQU0sUUFBUSxPQUFPLEtBQUssQ0FBQyxHQUFHO0FBQ2hDLGFBQU8sS0FBSyxFQUFFLEtBQUssUUFBUTtBQUFBLElBQzdCLE9BQU87QUFDTCxhQUFPLEtBQUssSUFBSSxDQUFDLFFBQVE7QUFBQSxJQUMzQjtBQUFBLEVBQ0Y7QUFFQSxRQUFNLE1BQU0sQ0FBQyxPQUFlLGFBQTZCO0FBQ3ZELFVBQU0sU0FBUyxVQUFVO0FBQ3pCLFFBQUksTUFBTSxRQUFRLE9BQU8sS0FBSyxDQUFDLEdBQUc7QUFDaEMsWUFBTSxRQUFRLE9BQU8sS0FBSyxFQUFFLFVBQVUsQ0FBQyxTQUFTLFNBQVMsUUFBUTtBQUNqRSxVQUFJLFVBQVUsSUFBSTtBQUNoQixlQUFPLEtBQUssRUFBRSxPQUFPLE9BQU8sQ0FBQztBQUFBLE1BQy9CO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFFQSxRQUFNLE9BQU8sQ0FBQyxVQUFrQixTQUFvQjtBQUNsRCxVQUFNLFNBQVMsVUFBVTtBQUV6QixRQUFJLE1BQU0sUUFBUSxPQUFPLEtBQUssQ0FBQyxHQUFHO0FBQ2hDLGFBQU8sS0FBSyxFQUFFLFFBQVEsQ0FBQyxhQUFhLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUN2RDtBQUFBLEVBQ0Y7QUFFQSxRQUFNLFFBQVEsTUFBTTtBQUNsQixjQUFVLFFBQVEsQ0FBQztBQUFBLEVBQ3JCO0FBRUEsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQ0Y7IiwibmFtZXMiOltdfQ==