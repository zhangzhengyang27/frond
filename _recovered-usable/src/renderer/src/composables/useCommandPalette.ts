/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
import { ref } from "vue";
const isOpen = ref(false);
export function useCommandPalette() {
  return {
    isOpen,
    open: () => {
      isOpen.value = true;
    },
    close: () => {
      isOpen.value = false;
    },
    toggle: () => {
      isOpen.value = !isOpen.value;
    }
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVzZUNvbW1hbmRQYWxldHRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyDlkb3ku6TpnaLmnb/lvIDlhbPvvIjijJhLIC8gQ3RybCtL77yJXG4gKlxuICog5Y2V5L6L77ya5pW05LiqIEFwcCDkuK3ku7vkvZXlnLDmlrnosIMgb3BlbigpIOmDveS8muaJk+W8gOWQjOS4gOmdouadv+OAglxuICog5L2/55So5pa55byP77yaXG4gKiAgIGNvbnN0IHBhbGV0dGUgPSB1c2VDb21tYW5kUGFsZXR0ZSgpXG4gKiAgIHBhbGV0dGUub3BlbigpIC8gcGFsZXR0ZS5jbG9zZSgpIC8gcGFsZXR0ZS50b2dnbGUoKVxuICogICBwYWxldHRlLmlzT3Blbu+8iHJlZu+8ieKAlCDlkb3ku6TpnaLmnb/ph4znlKggdi1pZiDmuLLmn5NcbiAqL1xuXG5pbXBvcnQgeyByZWYgfSBmcm9tICd2dWUnXG5cbmNvbnN0IGlzT3BlbiA9IHJlZihmYWxzZSlcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUNvbW1hbmRQYWxldHRlKCk6IHtcbiAgaXNPcGVuOiB0eXBlb2YgaXNPcGVuXG4gIG9wZW46ICgpID0+IHZvaWRcbiAgY2xvc2U6ICgpID0+IHZvaWRcbiAgdG9nZ2xlOiAoKSA9PiB2b2lkXG59IHtcbiAgcmV0dXJuIHtcbiAgICBpc09wZW4sXG4gICAgb3BlbjogKCkgPT4ge1xuICAgICAgaXNPcGVuLnZhbHVlID0gdHJ1ZVxuICAgIH0sXG4gICAgY2xvc2U6ICgpID0+IHtcbiAgICAgIGlzT3Blbi52YWx1ZSA9IGZhbHNlXG4gICAgfSxcbiAgICB0b2dnbGU6ICgpID0+IHtcbiAgICAgIGlzT3Blbi52YWx1ZSA9ICFpc09wZW4udmFsdWVcbiAgICB9XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBVUEsU0FBUyxXQUFXO0FBRXBCLE1BQU0sU0FBUyxJQUFJLEtBQUs7QUFFakIsZ0JBQVMsb0JBS2Q7QUFDQSxTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0EsTUFBTSxNQUFNO0FBQ1YsYUFBTyxRQUFRO0FBQUEsSUFDakI7QUFBQSxJQUNBLE9BQU8sTUFBTTtBQUNYLGFBQU8sUUFBUTtBQUFBLElBQ2pCO0FBQUEsSUFDQSxRQUFRLE1BQU07QUFDWixhQUFPLFFBQVEsQ0FBQyxPQUFPO0FBQUEsSUFDekI7QUFBQSxFQUNGO0FBQ0Y7IiwibmFtZXMiOltdfQ==