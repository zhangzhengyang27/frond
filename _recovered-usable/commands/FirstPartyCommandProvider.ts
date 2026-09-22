/* 2026-09-22 由 dev-server 缓存的编译产物机械还原：非原始源码，类型标注已被 esbuild 剥除，
   import 说明符已尽量改回裸包名。过了 node --check 语法校验，未做运行验证。 */
export function createFirstPartyCommandProvider() {
  return {
    id: "first-party",
    categories: [
      "ai",
      "clipboard",
      "snippet",
      "screenshot",
      "recording",
      "pomodoro",
      "settings",
      "file"
    ],
    reactive: false,
    async getCommands() {
      const commands = [];
      commands.push(
        {
          id: "ai:chat",
          title: "AI 对话",
          subtitle: "Ask anything",
          icon: "sparkling-2",
          category: "ai",
          badge: "AI",
          keywords: ["ai", "chat", "对话", "duihua", "gpt", "chatgpt"],
          actions: [{ type: "firstParty", page: "ai" }]
        },
        {
          id: "ai:translate",
          title: "翻译为中文",
          subtitle: "AI · 读取剪贴板",
          icon: "translate",
          category: "ai",
          badge: "AI",
          keywords: ["translate", "翻译", "fanyi", "中译英", "英译中"],
          actions: [{ type: "firstParty", page: "ai" }]
        },
        {
          id: "ai:summarize",
          title: "总结文本",
          subtitle: "AI · 读取剪贴板",
          icon: "file-list",
          category: "ai",
          badge: "AI",
          keywords: ["summarize", "总结", "zongjie", "摘要", "zhaiyao"],
          actions: [{ type: "firstParty", page: "ai" }]
        },
        {
          id: "ai:rewrite",
          title: "润色改写",
          subtitle: "AI · 读取剪贴板",
          icon: "edit",
          category: "ai",
          badge: "AI",
          keywords: ["rewrite", "润色", "runse", "改写", "gaixie", "polish"],
          actions: [{ type: "firstParty", page: "ai" }]
        }
      );
      commands.push({
        id: "clipboard:history",
        title: "剪贴板历史",
        subtitle: "最近 200 条",
        icon: "clipboard",
        category: "clipboard",
        badge: "剪贴板",
        keywords: [
          "clipboard",
          "剪贴板",
          "jian tieban",
          "history",
          "历史",
          "lishi",
          "paste",
          "粘贴"
        ],
        actions: [{ type: "firstParty", page: "clips" }]
      });
      commands.push({
        id: "snippets:search",
        title: "代码片段",
        subtitle: "搜索并复制",
        icon: "code",
        category: "snippet",
        badge: "片段",
        keywords: ["snippet", "片段", "pianduan", "code", "代码", "daima"],
        actions: [{ type: "firstParty", page: "snippets" }]
      });
      commands.push(
        {
          id: "screenshot:capture",
          title: "截图",
          subtitle: "区域 / 窗口 / 全屏",
          icon: "camera",
          category: "screenshot",
          badge: "截图",
          keywords: ["screenshot", "截图", "jietu", "capture", "截屏", "jieping"],
          actions: [
            { type: "module", moduleId: "screenshot", path: "/screenshot/capture" },
            { type: "firstParty", page: "shots" }
          ]
        },
        {
          id: "screenshot:history",
          title: "截图历史",
          subtitle: "查看最近截图",
          icon: "image",
          category: "screenshot",
          badge: "截图",
          keywords: ["screenshot", "截图", "jietu", "history", "历史", "lishi"],
          actions: [{ type: "firstParty", page: "shots" }]
        }
      );
      commands.push({
        id: "recording:start",
        title: "屏幕录制",
        subtitle: "开始录制",
        icon: "video",
        category: "recording",
        badge: "录屏",
        keywords: ["record", "录制", "luzhi", "screen", "屏幕", "pingmu", "录屏", "luping"],
        actions: [{ type: "module", moduleId: "screenRecorder", path: "/screenRecorder/record" }]
      });
      commands.push(
        {
          id: "pomodoro:start",
          title: "番茄钟",
          subtitle: "开始专注",
          icon: "timer",
          category: "pomodoro",
          badge: "番茄钟",
          keywords: ["pomodoro", "番茄", "fanqie", "focus", "专注", "zhuanzhu", "timer", "计时"],
          actions: [
            { type: "firstParty", page: "focus" },
            { type: "firstParty", page: "focusStats" }
          ]
        },
        {
          id: "pomodoro:stats",
          title: "番茄钟统计",
          subtitle: "查看专注记录",
          icon: "bar-chart",
          category: "pomodoro",
          badge: "番茄钟",
          keywords: ["stats", "统计", "tongji", "pomodoro", "番茄", "fanqie"],
          actions: [{ type: "firstParty", page: "focusStats" }]
        }
      );
      commands.push({
        id: "files:search",
        title: "搜索文件",
        subtitle: "Spotlight 搜索",
        icon: "folder",
        category: "file",
        badge: "文件",
        keywords: ["file", "文件", "wenjian", "search", "搜索", "sousuo", "find", "查找"],
        actions: [{ type: "firstParty", page: "files" }]
      });
      commands.push({
        id: "browser:tabs",
        title: "浏览器标签",
        subtitle: "Chrome / Safari",
        icon: "global",
        category: "extension",
        badge: "扩展",
        keywords: ["browser", "浏览器", "liulanqi", "tab", "标签", "biaoqian", "chrome", "safari"],
        actions: [{ type: "firstParty", page: "browserTabs" }]
      });
      commands.push({
        id: "system:info",
        title: "系统信息",
        subtitle: "CPU / 内存 / 磁盘",
        icon: "cpu",
        category: "system",
        badge: "系统",
        keywords: [
          "system",
          "系统",
          "xitong",
          "info",
          "信息",
          "xinxi",
          "cpu",
          "内存",
          "neicun",
          "磁盘",
          "cipan",
          "硬件",
          "yingjian"
        ],
        actions: [{ type: "firstParty", page: "systemInfo" }]
      });
      commands.push({
        id: "window:switch",
        title: "切换窗口",
        subtitle: "搜索并激活窗口",
        icon: "window-2",
        category: "window",
        badge: "窗口",
        keywords: [
          "window",
          "窗口",
          "chuangkou",
          "switch",
          "切换",
          "qiehuan",
          "alt-tab",
          "app",
          "应用"
        ],
        actions: [{ type: "firstParty", page: "windowSwitcher" }]
      });
      commands.push({
        id: "trash:open",
        title: "回收站",
        subtitle: "查看 / 清空 / 恢复",
        icon: "delete-bin",
        category: "system",
        badge: "系统",
        keywords: [
          "trash",
          "回收站",
          "huishouzhan",
          "recycle",
          "回收",
          "huishou",
          "empty",
          "清空",
          "qingkong",
          "restore",
          "恢复",
          "huifu"
        ],
        actions: [
          { type: "firstParty", page: "trash" },
          { type: "system", cmdId: "system.emptyTrash" }
        ]
      });
      commands.push({
        id: "dictionary:lookup",
        title: "词典",
        subtitle: "查询英文单词释义",
        icon: "book-2",
        category: "extension",
        badge: "工具",
        keywords: [
          "dictionary",
          "词典",
          "cidian",
          "define",
          "查询",
          "chaxun",
          "word",
          "单词",
          "danci",
          "translation",
          "翻译",
          "fanyi",
          "meaning",
          "释义",
          "shiyi"
        ],
        actions: [{ type: "firstParty", page: "dictionary" }]
      });
      commands.push({
        id: "settings:open",
        title: "设置",
        subtitle: "偏好设置",
        icon: "settings",
        category: "settings",
        badge: "设置",
        keywords: [
          "settings",
          "设置",
          "shezhi",
          "preferences",
          "偏好",
          "pianhao",
          "config",
          "配置"
        ],
        actions: [{ type: "firstParty", page: "settings" }]
      });
      commands.push({
        id: "reminders:list",
        title: "提醒事项",
        subtitle: "查看和创建提醒",
        icon: "alarm",
        category: "reminder",
        badge: "提醒",
        keywords: [
          "reminder",
          "提醒",
          "tixing",
          "todo",
          "待办",
          "daiban",
          "task",
          "任务",
          "renwu",
          "alarm",
          "闹钟",
          "naozhong"
        ],
        actions: [{ type: "firstParty", page: "reminders" }]
      });
      commands.push({
        id: "notes:floating",
        title: "浮动笔记",
        subtitle: "置顶快速记录",
        icon: "sticky-note",
        category: "note",
        badge: "笔记",
        keywords: [
          "floating",
          "浮动",
          "fudong",
          "note",
          "笔记",
          "biji",
          "quick note",
          "快速记录",
          "kuaisujilu"
        ],
        actions: [{ type: "floatingNote" }]
      });
      commands.push({
        id: "calendar:view",
        title: "日历",
        subtitle: "查看日程与提醒",
        icon: "calendar",
        category: "calendar",
        badge: "日历",
        keywords: [
          "calendar",
          "日历",
          "rili",
          "schedule",
          "日程",
          "richeng",
          "date",
          "日期",
          "month",
          "月"
        ],
        actions: [{ type: "firstParty", page: "calendar" }]
      });
      return commands;
    }
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkZpcnN0UGFydHlDb21tYW5kUHJvdmlkZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMZWFmIMK3IOesrOS4gOaWueWRveS7pOaPkOS+m+iAhe+8iOmYtuautTEuMe+8iVxuICpcbiAqIOWGhee9ruWKn+iDveWRveS7pO+8mkFJ44CB5Ymq6LS05p2/5Y6G5Y+y44CB54mH5q6144CB5oiq5Zu+44CB55Wq6IyE6ZKf44CB6K6+572u44CB5paH5Lu25pCc57Si562J44CCXG4gKiDov4Hnp7voh6ogc2hhcmVkL2NvbW1hbmRzLnRzIOeahCBGSVJTVF9QQVJUWV9DT01NQU5EUyAvIEFDVElPTl9DT01NQU5EU+OAglxuICovXG5pbXBvcnQgdHlwZSB7IENvbW1hbmQsIENvbW1hbmRQcm92aWRlciB9IGZyb20gJ0BzaGFyZWQvY29tbWFuZFJlZ2lzdHJ5J1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRmlyc3RQYXJ0eUNvbW1hbmRQcm92aWRlcigpOiBDb21tYW5kUHJvdmlkZXIge1xuICByZXR1cm4ge1xuICAgIGlkOiAnZmlyc3QtcGFydHknLFxuICAgIGNhdGVnb3JpZXM6IFtcbiAgICAgICdhaScsXG4gICAgICAnY2xpcGJvYXJkJyxcbiAgICAgICdzbmlwcGV0JyxcbiAgICAgICdzY3JlZW5zaG90JyxcbiAgICAgICdyZWNvcmRpbmcnLFxuICAgICAgJ3BvbW9kb3JvJyxcbiAgICAgICdzZXR0aW5ncycsXG4gICAgICAnZmlsZSdcbiAgICBdLFxuICAgIHJlYWN0aXZlOiBmYWxzZSxcbiAgICBhc3luYyBnZXRDb21tYW5kcygpOiBQcm9taXNlPENvbW1hbmRbXT4ge1xuICAgICAgY29uc3QgY29tbWFuZHM6IENvbW1hbmRbXSA9IFtdXG5cbiAgICAgIC8vIOKUgOKUgCBBSSDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2FpOmNoYXQnLFxuICAgICAgICAgIHRpdGxlOiAnQUkg5a+56K+dJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ0FzayBhbnl0aGluZycsXG4gICAgICAgICAgaWNvbjogJ3NwYXJrbGluZy0yJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ2FpJyxcbiAgICAgICAgICBiYWRnZTogJ0FJJyxcbiAgICAgICAgICBrZXl3b3JkczogWydhaScsICdjaGF0JywgJ+WvueivnScsICdkdWlodWEnLCAnZ3B0JywgJ2NoYXRncHQnXSxcbiAgICAgICAgICBhY3Rpb25zOiBbeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdhaScgfV1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnYWk6dHJhbnNsYXRlJyxcbiAgICAgICAgICB0aXRsZTogJ+e/u+ivkeS4uuS4reaWhycsXG4gICAgICAgICAgc3VidGl0bGU6ICdBSSDCtyDor7vlj5bliarotLTmnb8nLFxuICAgICAgICAgIGljb246ICd0cmFuc2xhdGUnLFxuICAgICAgICAgIGNhdGVnb3J5OiAnYWknLFxuICAgICAgICAgIGJhZGdlOiAnQUknLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ3RyYW5zbGF0ZScsICfnv7vor5EnLCAnZmFueWknLCAn5Lit6K+R6IuxJywgJ+iLseivkeS4rSddLFxuICAgICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2FpJyB9XVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdhaTpzdW1tYXJpemUnLFxuICAgICAgICAgIHRpdGxlOiAn5oC757uT5paH5pysJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ0FJIMK3IOivu+WPluWJqui0tOadvycsXG4gICAgICAgICAgaWNvbjogJ2ZpbGUtbGlzdCcsXG4gICAgICAgICAgY2F0ZWdvcnk6ICdhaScsXG4gICAgICAgICAgYmFkZ2U6ICdBSScsXG4gICAgICAgICAga2V5d29yZHM6IFsnc3VtbWFyaXplJywgJ+aAu+e7kycsICd6b25namllJywgJ+aRmOimgScsICd6aGFpeWFvJ10sXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnYWknIH1dXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ2FpOnJld3JpdGUnLFxuICAgICAgICAgIHRpdGxlOiAn5ram6Imy5pS55YaZJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ0FJIMK3IOivu+WPluWJqui0tOadvycsXG4gICAgICAgICAgaWNvbjogJ2VkaXQnLFxuICAgICAgICAgIGNhdGVnb3J5OiAnYWknLFxuICAgICAgICAgIGJhZGdlOiAnQUknLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ3Jld3JpdGUnLCAn5ram6ImyJywgJ3J1bnNlJywgJ+aUueWGmScsICdnYWl4aWUnLCAncG9saXNoJ10sXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnYWknIH1dXG4gICAgICAgIH1cbiAgICAgIClcblxuICAgICAgLy8g4pSA4pSAIOWJqui0tOadv+WOhuWPsiDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goe1xuICAgICAgICBpZDogJ2NsaXBib2FyZDpoaXN0b3J5JyxcbiAgICAgICAgdGl0bGU6ICfliarotLTmnb/ljoblj7InLFxuICAgICAgICBzdWJ0aXRsZTogJ+acgOi/kSAyMDAg5p2hJyxcbiAgICAgICAgaWNvbjogJ2NsaXBib2FyZCcsXG4gICAgICAgIGNhdGVnb3J5OiAnY2xpcGJvYXJkJyxcbiAgICAgICAgYmFkZ2U6ICfliarotLTmnb8nLFxuICAgICAgICBrZXl3b3JkczogW1xuICAgICAgICAgICdjbGlwYm9hcmQnLFxuICAgICAgICAgICfliarotLTmnb8nLFxuICAgICAgICAgICdqaWFuIHRpZWJhbicsXG4gICAgICAgICAgJ2hpc3RvcnknLFxuICAgICAgICAgICfljoblj7InLFxuICAgICAgICAgICdsaXNoaScsXG4gICAgICAgICAgJ3Bhc3RlJyxcbiAgICAgICAgICAn57KY6LS0J1xuICAgICAgICBdLFxuICAgICAgICBhY3Rpb25zOiBbeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdjbGlwcycgfV1cbiAgICAgIH0pXG5cbiAgICAgIC8vIOKUgOKUgCDku6PnoIHniYfmrrUg4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdzbmlwcGV0czpzZWFyY2gnLFxuICAgICAgICB0aXRsZTogJ+S7o+eggeeJh+autScsXG4gICAgICAgIHN1YnRpdGxlOiAn5pCc57Si5bm25aSN5Yi2JyxcbiAgICAgICAgaWNvbjogJ2NvZGUnLFxuICAgICAgICBjYXRlZ29yeTogJ3NuaXBwZXQnLFxuICAgICAgICBiYWRnZTogJ+eJh+autScsXG4gICAgICAgIGtleXdvcmRzOiBbJ3NuaXBwZXQnLCAn54mH5q61JywgJ3BpYW5kdWFuJywgJ2NvZGUnLCAn5Luj56CBJywgJ2RhaW1hJ10sXG4gICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ3NuaXBwZXRzJyB9XVxuICAgICAgfSlcblxuICAgICAgLy8g4pSA4pSAIOaIquWbviDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3NjcmVlbnNob3Q6Y2FwdHVyZScsXG4gICAgICAgICAgdGl0bGU6ICfmiKrlm74nLFxuICAgICAgICAgIHN1YnRpdGxlOiAn5Yy65Z+fIC8g56qX5Y+jIC8g5YWo5bGPJyxcbiAgICAgICAgICBpY29uOiAnY2FtZXJhJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ3NjcmVlbnNob3QnLFxuICAgICAgICAgIGJhZGdlOiAn5oiq5Zu+JyxcbiAgICAgICAgICBrZXl3b3JkczogWydzY3JlZW5zaG90JywgJ+aIquWbvicsICdqaWV0dScsICdjYXB0dXJlJywgJ+aIquWxjycsICdqaWVwaW5nJ10sXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgeyB0eXBlOiAnbW9kdWxlJywgbW9kdWxlSWQ6ICdzY3JlZW5zaG90JywgcGF0aDogJy9zY3JlZW5zaG90L2NhcHR1cmUnIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ3Nob3RzJyB9XG4gICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdzY3JlZW5zaG90Omhpc3RvcnknLFxuICAgICAgICAgIHRpdGxlOiAn5oiq5Zu+5Y6G5Y+yJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ+afpeeci+acgOi/keaIquWbvicsXG4gICAgICAgICAgaWNvbjogJ2ltYWdlJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ3NjcmVlbnNob3QnLFxuICAgICAgICAgIGJhZGdlOiAn5oiq5Zu+JyxcbiAgICAgICAgICBrZXl3b3JkczogWydzY3JlZW5zaG90JywgJ+aIquWbvicsICdqaWV0dScsICdoaXN0b3J5JywgJ+WOhuWPsicsICdsaXNoaSddLFxuICAgICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ3Nob3RzJyB9XVxuICAgICAgICB9XG4gICAgICApXG5cbiAgICAgIC8vIOKUgOKUgCDlvZXlsY8g4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdyZWNvcmRpbmc6c3RhcnQnLFxuICAgICAgICB0aXRsZTogJ+Wxj+W5leW9leWIticsXG4gICAgICAgIHN1YnRpdGxlOiAn5byA5aeL5b2V5Yi2JyxcbiAgICAgICAgaWNvbjogJ3ZpZGVvJyxcbiAgICAgICAgY2F0ZWdvcnk6ICdyZWNvcmRpbmcnLFxuICAgICAgICBiYWRnZTogJ+W9leWxjycsXG4gICAgICAgIGtleXdvcmRzOiBbJ3JlY29yZCcsICflvZXliLYnLCAnbHV6aGknLCAnc2NyZWVuJywgJ+Wxj+W5lScsICdwaW5nbXUnLCAn5b2V5bGPJywgJ2x1cGluZyddLFxuICAgICAgICBhY3Rpb25zOiBbeyB0eXBlOiAnbW9kdWxlJywgbW9kdWxlSWQ6ICdzY3JlZW5SZWNvcmRlcicsIHBhdGg6ICcvc2NyZWVuUmVjb3JkZXIvcmVjb3JkJyB9XVxuICAgICAgfSlcblxuICAgICAgLy8g4pSA4pSAIOeVquiMhOmSnyDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3BvbW9kb3JvOnN0YXJ0JyxcbiAgICAgICAgICB0aXRsZTogJ+eVquiMhOmSnycsXG4gICAgICAgICAgc3VidGl0bGU6ICflvIDlp4vkuJPms6gnLFxuICAgICAgICAgIGljb246ICd0aW1lcicsXG4gICAgICAgICAgY2F0ZWdvcnk6ICdwb21vZG9ybycsXG4gICAgICAgICAgYmFkZ2U6ICfnlarojITpkp8nLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ3BvbW9kb3JvJywgJ+eVquiMhCcsICdmYW5xaWUnLCAnZm9jdXMnLCAn5LiT5rOoJywgJ3podWFuemh1JywgJ3RpbWVyJywgJ+iuoeaXtiddLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgIHsgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnZm9jdXMnIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2ZvY3VzU3RhdHMnIH1cbiAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3BvbW9kb3JvOnN0YXRzJyxcbiAgICAgICAgICB0aXRsZTogJ+eVquiMhOmSn+e7n+iuoScsXG4gICAgICAgICAgc3VidGl0bGU6ICfmn6XnnIvkuJPms6jorrDlvZUnLFxuICAgICAgICAgIGljb246ICdiYXItY2hhcnQnLFxuICAgICAgICAgIGNhdGVnb3J5OiAncG9tb2Rvcm8nLFxuICAgICAgICAgIGJhZGdlOiAn55Wq6IyE6ZKfJyxcbiAgICAgICAgICBrZXl3b3JkczogWydzdGF0cycsICfnu5/orqEnLCAndG9uZ2ppJywgJ3BvbW9kb3JvJywgJ+eVquiMhCcsICdmYW5xaWUnXSxcbiAgICAgICAgICBhY3Rpb25zOiBbeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdmb2N1c1N0YXRzJyB9XVxuICAgICAgICB9XG4gICAgICApXG5cbiAgICAgIC8vIOKUgOKUgCDmlofku7bmkJzntKIg4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdmaWxlczpzZWFyY2gnLFxuICAgICAgICB0aXRsZTogJ+aQnOe0ouaWh+S7ticsXG4gICAgICAgIHN1YnRpdGxlOiAnU3BvdGxpZ2h0IOaQnOe0oicsXG4gICAgICAgIGljb246ICdmb2xkZXInLFxuICAgICAgICBjYXRlZ29yeTogJ2ZpbGUnLFxuICAgICAgICBiYWRnZTogJ+aWh+S7ticsXG4gICAgICAgIGtleXdvcmRzOiBbJ2ZpbGUnLCAn5paH5Lu2JywgJ3dlbmppYW4nLCAnc2VhcmNoJywgJ+aQnOe0oicsICdzb3VzdW8nLCAnZmluZCcsICfmn6Xmib4nXSxcbiAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnZmlsZXMnIH1dXG4gICAgICB9KVxuXG4gICAgICAvLyDilIDilIAg5rWP6KeI5Zmo5qCH562+IOKUgOKUgFxuICAgICAgY29tbWFuZHMucHVzaCh7XG4gICAgICAgIGlkOiAnYnJvd3Nlcjp0YWJzJyxcbiAgICAgICAgdGl0bGU6ICfmtY/op4jlmajmoIfnrb4nLFxuICAgICAgICBzdWJ0aXRsZTogJ0Nocm9tZSAvIFNhZmFyaScsXG4gICAgICAgIGljb246ICdnbG9iYWwnLFxuICAgICAgICBjYXRlZ29yeTogJ2V4dGVuc2lvbicsXG4gICAgICAgIGJhZGdlOiAn5omp5bGVJyxcbiAgICAgICAga2V5d29yZHM6IFsnYnJvd3NlcicsICfmtY/op4jlmagnLCAnbGl1bGFucWknLCAndGFiJywgJ+agh+etvicsICdiaWFvcWlhbicsICdjaHJvbWUnLCAnc2FmYXJpJ10sXG4gICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ2Jyb3dzZXJUYWJzJyB9XVxuICAgICAgfSlcblxuICAgICAgLy8g4pSA4pSAIOezu+e7n+S/oeaBryDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goe1xuICAgICAgICBpZDogJ3N5c3RlbTppbmZvJyxcbiAgICAgICAgdGl0bGU6ICfns7vnu5/kv6Hmga8nLFxuICAgICAgICBzdWJ0aXRsZTogJ0NQVSAvIOWGheWtmCAvIOejgeebmCcsXG4gICAgICAgIGljb246ICdjcHUnLFxuICAgICAgICBjYXRlZ29yeTogJ3N5c3RlbScsXG4gICAgICAgIGJhZGdlOiAn57O757ufJyxcbiAgICAgICAga2V5d29yZHM6IFtcbiAgICAgICAgICAnc3lzdGVtJyxcbiAgICAgICAgICAn57O757ufJyxcbiAgICAgICAgICAneGl0b25nJyxcbiAgICAgICAgICAnaW5mbycsXG4gICAgICAgICAgJ+S/oeaBrycsXG4gICAgICAgICAgJ3hpbnhpJyxcbiAgICAgICAgICAnY3B1JyxcbiAgICAgICAgICAn5YaF5a2YJyxcbiAgICAgICAgICAnbmVpY3VuJyxcbiAgICAgICAgICAn56OB55uYJyxcbiAgICAgICAgICAnY2lwYW4nLFxuICAgICAgICAgICfnoazku7YnLFxuICAgICAgICAgICd5aW5namlhbidcbiAgICAgICAgXSxcbiAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnc3lzdGVtSW5mbycgfV1cbiAgICAgIH0pXG5cbiAgICAgIC8vIOKUgOKUgCDnqpflj6PliIfmjaIg4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICd3aW5kb3c6c3dpdGNoJyxcbiAgICAgICAgdGl0bGU6ICfliIfmjaLnqpflj6MnLFxuICAgICAgICBzdWJ0aXRsZTogJ+aQnOe0ouW5tua/gOa0u+eql+WPoycsXG4gICAgICAgIGljb246ICd3aW5kb3ctMicsXG4gICAgICAgIGNhdGVnb3J5OiAnd2luZG93JyxcbiAgICAgICAgYmFkZ2U6ICfnqpflj6MnLFxuICAgICAgICBrZXl3b3JkczogW1xuICAgICAgICAgICd3aW5kb3cnLFxuICAgICAgICAgICfnqpflj6MnLFxuICAgICAgICAgICdjaHVhbmdrb3UnLFxuICAgICAgICAgICdzd2l0Y2gnLFxuICAgICAgICAgICfliIfmjaInLFxuICAgICAgICAgICdxaWVodWFuJyxcbiAgICAgICAgICAnYWx0LXRhYicsXG4gICAgICAgICAgJ2FwcCcsXG4gICAgICAgICAgJ+W6lOeUqCdcbiAgICAgICAgXSxcbiAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnd2luZG93U3dpdGNoZXInIH1dXG4gICAgICB9KVxuXG4gICAgICAvLyDilIDilIAg5Zue5pS256uZIOKUgOKUgFxuICAgICAgY29tbWFuZHMucHVzaCh7XG4gICAgICAgIGlkOiAndHJhc2g6b3BlbicsXG4gICAgICAgIHRpdGxlOiAn5Zue5pS256uZJyxcbiAgICAgICAgc3VidGl0bGU6ICfmn6XnnIsgLyDmuIXnqbogLyDmgaLlpI0nLFxuICAgICAgICBpY29uOiAnZGVsZXRlLWJpbicsXG4gICAgICAgIGNhdGVnb3J5OiAnc3lzdGVtJyxcbiAgICAgICAgYmFkZ2U6ICfns7vnu58nLFxuICAgICAgICBrZXl3b3JkczogW1xuICAgICAgICAgICd0cmFzaCcsXG4gICAgICAgICAgJ+WbnuaUtuermScsXG4gICAgICAgICAgJ2h1aXNob3V6aGFuJyxcbiAgICAgICAgICAncmVjeWNsZScsXG4gICAgICAgICAgJ+WbnuaUticsXG4gICAgICAgICAgJ2h1aXNob3UnLFxuICAgICAgICAgICdlbXB0eScsXG4gICAgICAgICAgJ+a4heepuicsXG4gICAgICAgICAgJ3Fpbmdrb25nJyxcbiAgICAgICAgICAncmVzdG9yZScsXG4gICAgICAgICAgJ+aBouWkjScsXG4gICAgICAgICAgJ2h1aWZ1J1xuICAgICAgICBdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICd0cmFzaCcgfSxcbiAgICAgICAgICB7IHR5cGU6ICdzeXN0ZW0nLCBjbWRJZDogJ3N5c3RlbS5lbXB0eVRyYXNoJyB9XG4gICAgICAgIF1cbiAgICAgIH0pXG5cbiAgICAgIC8vIOKUgOKUgCDor43lhbgg4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdkaWN0aW9uYXJ5Omxvb2t1cCcsXG4gICAgICAgIHRpdGxlOiAn6K+N5YW4JyxcbiAgICAgICAgc3VidGl0bGU6ICfmn6Xor6Loi7HmlofljZXor43ph4rkuYknLFxuICAgICAgICBpY29uOiAnYm9vay0yJyxcbiAgICAgICAgY2F0ZWdvcnk6ICdleHRlbnNpb24nLFxuICAgICAgICBiYWRnZTogJ+W3peWFtycsXG4gICAgICAgIGtleXdvcmRzOiBbXG4gICAgICAgICAgJ2RpY3Rpb25hcnknLFxuICAgICAgICAgICfor43lhbgnLFxuICAgICAgICAgICdjaWRpYW4nLFxuICAgICAgICAgICdkZWZpbmUnLFxuICAgICAgICAgICfmn6Xor6InLFxuICAgICAgICAgICdjaGF4dW4nLFxuICAgICAgICAgICd3b3JkJyxcbiAgICAgICAgICAn5Y2V6K+NJyxcbiAgICAgICAgICAnZGFuY2knLFxuICAgICAgICAgICd0cmFuc2xhdGlvbicsXG4gICAgICAgICAgJ+e/u+ivkScsXG4gICAgICAgICAgJ2ZhbnlpJyxcbiAgICAgICAgICAnbWVhbmluZycsXG4gICAgICAgICAgJ+mHiuS5iScsXG4gICAgICAgICAgJ3NoaXlpJ1xuICAgICAgICBdLFxuICAgICAgICBhY3Rpb25zOiBbeyB0eXBlOiAnZmlyc3RQYXJ0eScsIHBhZ2U6ICdkaWN0aW9uYXJ5JyB9XVxuICAgICAgfSlcblxuICAgICAgLy8g4pSA4pSAIOiuvue9riDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goe1xuICAgICAgICBpZDogJ3NldHRpbmdzOm9wZW4nLFxuICAgICAgICB0aXRsZTogJ+iuvue9ricsXG4gICAgICAgIHN1YnRpdGxlOiAn5YGP5aW96K6+572uJyxcbiAgICAgICAgaWNvbjogJ3NldHRpbmdzJyxcbiAgICAgICAgY2F0ZWdvcnk6ICdzZXR0aW5ncycsXG4gICAgICAgIGJhZGdlOiAn6K6+572uJyxcbiAgICAgICAga2V5d29yZHM6IFtcbiAgICAgICAgICAnc2V0dGluZ3MnLFxuICAgICAgICAgICforr7nva4nLFxuICAgICAgICAgICdzaGV6aGknLFxuICAgICAgICAgICdwcmVmZXJlbmNlcycsXG4gICAgICAgICAgJ+WBj+WlvScsXG4gICAgICAgICAgJ3BpYW5oYW8nLFxuICAgICAgICAgICdjb25maWcnLFxuICAgICAgICAgICfphY3nva4nXG4gICAgICAgIF0sXG4gICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ3NldHRpbmdzJyB9XVxuICAgICAgfSlcblxuICAgICAgLy8g4pSA4pSAIOaPkOmGkuS6i+mhuSDilIDilIBcbiAgICAgIGNvbW1hbmRzLnB1c2goe1xuICAgICAgICBpZDogJ3JlbWluZGVyczpsaXN0JyxcbiAgICAgICAgdGl0bGU6ICfmj5DphpLkuovpobknLFxuICAgICAgICBzdWJ0aXRsZTogJ+afpeeci+WSjOWIm+W7uuaPkOmGkicsXG4gICAgICAgIGljb246ICdhbGFybScsXG4gICAgICAgIGNhdGVnb3J5OiAncmVtaW5kZXInLFxuICAgICAgICBiYWRnZTogJ+aPkOmGkicsXG4gICAgICAgIGtleXdvcmRzOiBbXG4gICAgICAgICAgJ3JlbWluZGVyJyxcbiAgICAgICAgICAn5o+Q6YaSJyxcbiAgICAgICAgICAndGl4aW5nJyxcbiAgICAgICAgICAndG9kbycsXG4gICAgICAgICAgJ+W+heWKnicsXG4gICAgICAgICAgJ2RhaWJhbicsXG4gICAgICAgICAgJ3Rhc2snLFxuICAgICAgICAgICfku7vliqEnLFxuICAgICAgICAgICdyZW53dScsXG4gICAgICAgICAgJ2FsYXJtJyxcbiAgICAgICAgICAn6Ze56ZKfJyxcbiAgICAgICAgICAnbmFvemhvbmcnXG4gICAgICAgIF0sXG4gICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdmaXJzdFBhcnR5JywgcGFnZTogJ3JlbWluZGVycycgfV1cbiAgICAgIH0pXG5cbiAgICAgIC8vIOKUgOKUgCDmta7liqjnrJTorrAg4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdub3RlczpmbG9hdGluZycsXG4gICAgICAgIHRpdGxlOiAn5rWu5Yqo56yU6K6wJyxcbiAgICAgICAgc3VidGl0bGU6ICfnva7pobblv6vpgJ/orrDlvZUnLFxuICAgICAgICBpY29uOiAnc3RpY2t5LW5vdGUnLFxuICAgICAgICBjYXRlZ29yeTogJ25vdGUnLFxuICAgICAgICBiYWRnZTogJ+eslOiusCcsXG4gICAgICAgIGtleXdvcmRzOiBbXG4gICAgICAgICAgJ2Zsb2F0aW5nJyxcbiAgICAgICAgICAn5rWu5YqoJyxcbiAgICAgICAgICAnZnVkb25nJyxcbiAgICAgICAgICAnbm90ZScsXG4gICAgICAgICAgJ+eslOiusCcsXG4gICAgICAgICAgJ2JpamknLFxuICAgICAgICAgICdxdWljayBub3RlJyxcbiAgICAgICAgICAn5b+r6YCf6K6w5b2VJyxcbiAgICAgICAgICAna3VhaXN1amlsdSdcbiAgICAgICAgXSxcbiAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2Zsb2F0aW5nTm90ZScgfV1cbiAgICAgIH0pXG5cbiAgICAgIC8vIOKUgOKUgCDml6XljoYg4pSA4pSAXG4gICAgICBjb21tYW5kcy5wdXNoKHtcbiAgICAgICAgaWQ6ICdjYWxlbmRhcjp2aWV3JyxcbiAgICAgICAgdGl0bGU6ICfml6XljoYnLFxuICAgICAgICBzdWJ0aXRsZTogJ+afpeeci+aXpeeoi+S4juaPkOmGkicsXG4gICAgICAgIGljb246ICdjYWxlbmRhcicsXG4gICAgICAgIGNhdGVnb3J5OiAnY2FsZW5kYXInLFxuICAgICAgICBiYWRnZTogJ+aXpeWOhicsXG4gICAgICAgIGtleXdvcmRzOiBbXG4gICAgICAgICAgJ2NhbGVuZGFyJyxcbiAgICAgICAgICAn5pel5Y6GJyxcbiAgICAgICAgICAncmlsaScsXG4gICAgICAgICAgJ3NjaGVkdWxlJyxcbiAgICAgICAgICAn5pel56iLJyxcbiAgICAgICAgICAncmljaGVuZycsXG4gICAgICAgICAgJ2RhdGUnLFxuICAgICAgICAgICfml6XmnJ8nLFxuICAgICAgICAgICdtb250aCcsXG4gICAgICAgICAgJ+aciCdcbiAgICAgICAgXSxcbiAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ2ZpcnN0UGFydHknLCBwYWdlOiAnY2FsZW5kYXInIH1dXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gY29tbWFuZHNcbiAgICB9XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBUU8sZ0JBQVMsa0NBQW1EO0FBQ2pFLFNBQU87QUFBQSxJQUNMLElBQUk7QUFBQSxJQUNKLFlBQVk7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBLFVBQVU7QUFBQSxJQUNWLE1BQU0sY0FBa0M7QUFDdEMsWUFBTSxXQUFzQixDQUFDO0FBRzdCLGVBQVM7QUFBQSxRQUNQO0FBQUEsVUFDRSxJQUFJO0FBQUEsVUFDSixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixVQUFVO0FBQUEsVUFDVixPQUFPO0FBQUEsVUFDUCxVQUFVLENBQUMsTUFBTSxRQUFRLE1BQU0sVUFBVSxPQUFPLFNBQVM7QUFBQSxVQUN6RCxTQUFTLENBQUMsRUFBRSxNQUFNLGNBQWMsTUFBTSxLQUFLLENBQUM7QUFBQSxRQUM5QztBQUFBLFFBQ0E7QUFBQSxVQUNFLElBQUk7QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLFVBQVU7QUFBQSxVQUNWLE9BQU87QUFBQSxVQUNQLFVBQVUsQ0FBQyxhQUFhLE1BQU0sU0FBUyxPQUFPLEtBQUs7QUFBQSxVQUNuRCxTQUFTLENBQUMsRUFBRSxNQUFNLGNBQWMsTUFBTSxLQUFLLENBQUM7QUFBQSxRQUM5QztBQUFBLFFBQ0E7QUFBQSxVQUNFLElBQUk7QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLFVBQVU7QUFBQSxVQUNWLE9BQU87QUFBQSxVQUNQLFVBQVUsQ0FBQyxhQUFhLE1BQU0sV0FBVyxNQUFNLFNBQVM7QUFBQSxVQUN4RCxTQUFTLENBQUMsRUFBRSxNQUFNLGNBQWMsTUFBTSxLQUFLLENBQUM7QUFBQSxRQUM5QztBQUFBLFFBQ0E7QUFBQSxVQUNFLElBQUk7QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLFVBQVU7QUFBQSxVQUNWLE9BQU87QUFBQSxVQUNQLFVBQVUsQ0FBQyxXQUFXLE1BQU0sU0FBUyxNQUFNLFVBQVUsUUFBUTtBQUFBLFVBQzdELFNBQVMsQ0FBQyxFQUFFLE1BQU0sY0FBYyxNQUFNLEtBQUssQ0FBQztBQUFBLFFBQzlDO0FBQUEsTUFDRjtBQUdBLGVBQVMsS0FBSztBQUFBLFFBQ1osSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLFFBQ0EsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sUUFBUSxDQUFDO0FBQUEsTUFDakQsQ0FBQztBQUdELGVBQVMsS0FBSztBQUFBLFFBQ1osSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsVUFBVSxDQUFDLFdBQVcsTUFBTSxZQUFZLFFBQVEsTUFBTSxPQUFPO0FBQUEsUUFDN0QsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sV0FBVyxDQUFDO0FBQUEsTUFDcEQsQ0FBQztBQUdELGVBQVM7QUFBQSxRQUNQO0FBQUEsVUFDRSxJQUFJO0FBQUEsVUFDSixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixVQUFVO0FBQUEsVUFDVixPQUFPO0FBQUEsVUFDUCxVQUFVLENBQUMsY0FBYyxNQUFNLFNBQVMsV0FBVyxNQUFNLFNBQVM7QUFBQSxVQUNsRSxTQUFTO0FBQUEsWUFDUCxFQUFFLE1BQU0sVUFBVSxVQUFVLGNBQWMsTUFBTSxzQkFBc0I7QUFBQSxZQUN0RSxFQUFFLE1BQU0sY0FBYyxNQUFNLFFBQVE7QUFBQSxVQUN0QztBQUFBLFFBQ0Y7QUFBQSxRQUNBO0FBQUEsVUFDRSxJQUFJO0FBQUEsVUFDSixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixVQUFVO0FBQUEsVUFDVixPQUFPO0FBQUEsVUFDUCxVQUFVLENBQUMsY0FBYyxNQUFNLFNBQVMsV0FBVyxNQUFNLE9BQU87QUFBQSxVQUNoRSxTQUFTLENBQUMsRUFBRSxNQUFNLGNBQWMsTUFBTSxRQUFRLENBQUM7QUFBQSxRQUNqRDtBQUFBLE1BQ0Y7QUFHQSxlQUFTLEtBQUs7QUFBQSxRQUNaLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFVBQVUsQ0FBQyxVQUFVLE1BQU0sU0FBUyxVQUFVLE1BQU0sVUFBVSxNQUFNLFFBQVE7QUFBQSxRQUM1RSxTQUFTLENBQUMsRUFBRSxNQUFNLFVBQVUsVUFBVSxrQkFBa0IsTUFBTSx5QkFBeUIsQ0FBQztBQUFBLE1BQzFGLENBQUM7QUFHRCxlQUFTO0FBQUEsUUFDUDtBQUFBLFVBQ0UsSUFBSTtBQUFBLFVBQ0osT0FBTztBQUFBLFVBQ1AsVUFBVTtBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sVUFBVTtBQUFBLFVBQ1YsT0FBTztBQUFBLFVBQ1AsVUFBVSxDQUFDLFlBQVksTUFBTSxVQUFVLFNBQVMsTUFBTSxZQUFZLFNBQVMsSUFBSTtBQUFBLFVBQy9FLFNBQVM7QUFBQSxZQUNQLEVBQUUsTUFBTSxjQUFjLE1BQU0sUUFBUTtBQUFBLFlBQ3BDLEVBQUUsTUFBTSxjQUFjLE1BQU0sYUFBYTtBQUFBLFVBQzNDO0FBQUEsUUFDRjtBQUFBLFFBQ0E7QUFBQSxVQUNFLElBQUk7QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLFVBQVU7QUFBQSxVQUNWLE9BQU87QUFBQSxVQUNQLFVBQVUsQ0FBQyxTQUFTLE1BQU0sVUFBVSxZQUFZLE1BQU0sUUFBUTtBQUFBLFVBQzlELFNBQVMsQ0FBQyxFQUFFLE1BQU0sY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLFFBQ3REO0FBQUEsTUFDRjtBQUdBLGVBQVMsS0FBSztBQUFBLFFBQ1osSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsVUFBVSxDQUFDLFFBQVEsTUFBTSxXQUFXLFVBQVUsTUFBTSxVQUFVLFFBQVEsSUFBSTtBQUFBLFFBQzFFLFNBQVMsQ0FBQyxFQUFFLE1BQU0sY0FBYyxNQUFNLFFBQVEsQ0FBQztBQUFBLE1BQ2pELENBQUM7QUFHRCxlQUFTLEtBQUs7QUFBQSxRQUNaLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFVBQVUsQ0FBQyxXQUFXLE9BQU8sWUFBWSxPQUFPLE1BQU0sWUFBWSxVQUFVLFFBQVE7QUFBQSxRQUNwRixTQUFTLENBQUMsRUFBRSxNQUFNLGNBQWMsTUFBTSxjQUFjLENBQUM7QUFBQSxNQUN2RCxDQUFDO0FBR0QsZUFBUyxLQUFLO0FBQUEsUUFDWixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsUUFDUCxVQUFVO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixPQUFPO0FBQUEsUUFDUCxVQUFVO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUNBLFNBQVMsQ0FBQyxFQUFFLE1BQU0sY0FBYyxNQUFNLGFBQWEsQ0FBQztBQUFBLE1BQ3RELENBQUM7QUFHRCxlQUFTLEtBQUs7QUFBQSxRQUNaLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNGO0FBQUEsUUFDQSxTQUFTLENBQUMsRUFBRSxNQUFNLGNBQWMsTUFBTSxpQkFBaUIsQ0FBQztBQUFBLE1BQzFELENBQUM7QUFHRCxlQUFTLEtBQUs7QUFBQSxRQUNaLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNGO0FBQUEsUUFDQSxTQUFTO0FBQUEsVUFDUCxFQUFFLE1BQU0sY0FBYyxNQUFNLFFBQVE7QUFBQSxVQUNwQyxFQUFFLE1BQU0sVUFBVSxPQUFPLG9CQUFvQjtBQUFBLFFBQy9DO0FBQUEsTUFDRixDQUFDO0FBR0QsZUFBUyxLQUFLO0FBQUEsUUFDWixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsUUFDUCxVQUFVO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixPQUFPO0FBQUEsUUFDUCxVQUFVO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLFFBQ0EsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sYUFBYSxDQUFDO0FBQUEsTUFDdEQsQ0FBQztBQUdELGVBQVMsS0FBSztBQUFBLFFBQ1osSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLFFBQ0EsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sV0FBVyxDQUFDO0FBQUEsTUFDcEQsQ0FBQztBQUdELGVBQVMsS0FBSztBQUFBLFFBQ1osSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsVUFBVTtBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQSxRQUNBLFNBQVMsQ0FBQyxFQUFFLE1BQU0sY0FBYyxNQUFNLFlBQVksQ0FBQztBQUFBLE1BQ3JELENBQUM7QUFHRCxlQUFTLEtBQUs7QUFBQSxRQUNaLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNGO0FBQUEsUUFDQSxTQUFTLENBQUMsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUFBLE1BQ3BDLENBQUM7QUFHRCxlQUFTLEtBQUs7QUFBQSxRQUNaLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLFFBQ0EsU0FBUyxDQUFDLEVBQUUsTUFBTSxjQUFjLE1BQU0sV0FBVyxDQUFDO0FBQUEsTUFDcEQsQ0FBQztBQUVELGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUNGOyIsIm5hbWVzIjpbXX0=