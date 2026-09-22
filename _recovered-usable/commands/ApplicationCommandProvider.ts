/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
export function createApplicationProvider() {
  return {
    id: "applications",
    categories: ["application"],
    reactive: false,
    async getCommands() {
      try {
        const apps = await window.api.getApplications();
        return apps.map((app) => ({
          id: `app:${app.path}`,
          title: app.name,
          aliases: app.aliases,
          subtitle: app.path,
          icon: app.icon ? "apps" : "window-2",
          category: "application",
          badge: "应用",
          actions: [
            { type: "app", path: app.path },
            { type: "copyText", text: app.path }
          ],
          detail: {
            title: app.name,
            content: `路径：\`${app.path}\`

回车启动应用`,
            format: "markdown"
          }
        }));
      } catch {
        return [];
      }
    }
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcGxpY2F0aW9uQ29tbWFuZFByb3ZpZGVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGVhZiDCtyDlupTnlKjlkb3ku6Tmj5DkvpvogIXvvIjpmLbmrrUxLjHvvIlcbiAqXG4gKiDmiavmj4/ns7vnu5/lupTnlKjvvIzms6jlhozkuLrmoIflh4YgQ29tbWFuZOOAglxuICog5aSN55So546w5pyJIGdldEFwcGxpY2F0aW9ucyBJUEPvvIzljIXoo4XkuLogQ29tbWFuZCDmoLzlvI/jgIJcbiAqL1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kLCBDb21tYW5kUHJvdmlkZXIgfSBmcm9tICdAc2hhcmVkL2NvbW1hbmRSZWdpc3RyeSdcblxuaW50ZXJmYWNlIEFwcGxpY2F0aW9uSW5mbyB7XG4gIG5hbWU6IHN0cmluZ1xuICBwYXRoOiBzdHJpbmdcbiAgaWNvbj86IHN0cmluZ1xuICBhbGlhc2VzPzogc3RyaW5nW11cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFwcGxpY2F0aW9uUHJvdmlkZXIoKTogQ29tbWFuZFByb3ZpZGVyIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogJ2FwcGxpY2F0aW9ucycsXG4gICAgY2F0ZWdvcmllczogWydhcHBsaWNhdGlvbiddLFxuICAgIHJlYWN0aXZlOiBmYWxzZSxcbiAgICBhc3luYyBnZXRDb21tYW5kcygpOiBQcm9taXNlPENvbW1hbmRbXT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYXBwcyA9IChhd2FpdCB3aW5kb3cuYXBpLmdldEFwcGxpY2F0aW9ucygpKSBhcyBBcHBsaWNhdGlvbkluZm9bXVxuICAgICAgICByZXR1cm4gYXBwcy5tYXAoKGFwcCkgPT4gKHtcbiAgICAgICAgICBpZDogYGFwcDoke2FwcC5wYXRofWAsXG4gICAgICAgICAgdGl0bGU6IGFwcC5uYW1lLFxuICAgICAgICAgIGFsaWFzZXM6IGFwcC5hbGlhc2VzLFxuICAgICAgICAgIHN1YnRpdGxlOiBhcHAucGF0aCxcbiAgICAgICAgICBpY29uOiBhcHAuaWNvbiA/ICdhcHBzJyA6ICd3aW5kb3ctMicsXG4gICAgICAgICAgY2F0ZWdvcnk6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgYmFkZ2U6ICflupTnlKgnLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIHsgdHlwZTogJ2FwcCcsIHBhdGg6IGFwcC5wYXRoIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdjb3B5VGV4dCcsIHRleHQ6IGFwcC5wYXRoIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIGRldGFpbDoge1xuICAgICAgICAgICAgdGl0bGU6IGFwcC5uYW1lLFxuICAgICAgICAgICAgY29udGVudDogYOi3r+W+hO+8mlxcYCR7YXBwLnBhdGh9XFxgXFxuXFxu5Zue6L2m5ZCv5Yqo5bqU55SoYCxcbiAgICAgICAgICAgIGZvcm1hdDogJ21hcmtkb3duJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSkpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXSwibWFwcGluZ3MiOiJBQWVPLGdCQUFTLDRCQUE2QztBQUMzRCxTQUFPO0FBQUEsSUFDTCxJQUFJO0FBQUEsSUFDSixZQUFZLENBQUMsYUFBYTtBQUFBLElBQzFCLFVBQVU7QUFBQSxJQUNWLE1BQU0sY0FBa0M7QUFDdEMsVUFBSTtBQUNGLGNBQU0sT0FBUSxNQUFNLE9BQU8sSUFBSSxnQkFBZ0I7QUFDL0MsZUFBTyxLQUFLLElBQUksQ0FBQyxTQUFTO0FBQUEsVUFDeEIsSUFBSSxPQUFPLElBQUksSUFBSTtBQUFBLFVBQ25CLE9BQU8sSUFBSTtBQUFBLFVBQ1gsU0FBUyxJQUFJO0FBQUEsVUFDYixVQUFVLElBQUk7QUFBQSxVQUNkLE1BQU0sSUFBSSxPQUFPLFNBQVM7QUFBQSxVQUMxQixVQUFVO0FBQUEsVUFDVixPQUFPO0FBQUEsVUFDUCxTQUFTO0FBQUEsWUFDUCxFQUFFLE1BQU0sT0FBTyxNQUFNLElBQUksS0FBSztBQUFBLFlBQzlCLEVBQUUsTUFBTSxZQUFZLE1BQU0sSUFBSSxLQUFLO0FBQUEsVUFDckM7QUFBQSxVQUNBLFFBQVE7QUFBQSxZQUNOLE9BQU8sSUFBSTtBQUFBLFlBQ1gsU0FBUyxRQUFRLElBQUksSUFBSTtBQUFBO0FBQUE7QUFBQSxZQUN6QixRQUFRO0FBQUEsVUFDVjtBQUFBLFFBQ0YsRUFBRTtBQUFBLE1BQ0osUUFBUTtBQUNOLGVBQU8sQ0FBQztBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOyIsIm5hbWVzIjpbXX0=