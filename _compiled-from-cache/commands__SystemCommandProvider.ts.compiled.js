export function createSystemCommandProvider() {
  return {
    id: "system",
    categories: ["system", "window"],
    reactive: false,
    async getCommands() {
      const commands = [];
      commands.push(
        {
          id: "system:lock",
          title: "锁定屏幕",
          subtitle: "System",
          icon: "lock-password",
          category: "system",
          badge: "系统",
          keywords: ["lock", "锁屏", "suoding"],
          actions: [{ type: "system", cmdId: "system.lock" }]
        },
        {
          id: "system:sleep",
          title: "睡眠",
          subtitle: "System",
          icon: "moon-clear",
          category: "system",
          badge: "系统",
          keywords: ["sleep", "睡眠", "shuimian"],
          actions: [{ type: "system", cmdId: "system.sleep" }]
        },
        {
          id: "system:restart",
          title: "重新启动",
          subtitle: "System",
          icon: "restart",
          category: "system",
          badge: "系统",
          keywords: ["restart", "重启", "chongqi"],
          actions: [{ type: "system", cmdId: "system.restart" }]
        },
        {
          id: "system:shutdown",
          title: "关机",
          subtitle: "System",
          icon: "shutdown",
          category: "system",
          badge: "系统",
          keywords: ["shutdown", "关机", "guanji"],
          actions: [{ type: "system", cmdId: "system.shutdown" }]
        },
        {
          id: "system:emptyTrash",
          title: "清倒废纸篓",
          subtitle: "System",
          icon: "delete-bin",
          category: "system",
          badge: "系统",
          keywords: ["trash", "废纸篓", "回收站", "feizhilou", "empty", "清空", "qingkong"],
          actions: [{ type: "system", cmdId: "system.emptyTrash" }]
        },
        {
          id: "system:hideAll",
          title: "隐藏所有窗口",
          subtitle: "Window",
          icon: "eye-off",
          category: "window",
          badge: "窗口",
          keywords: ["hide", "隐藏", "yincang", "desktop", "桌面", "showdesktop"],
          actions: [{ type: "system", cmdId: "system.hideAll" }]
        },
        {
          id: "system:screensaver",
          title: "屏幕保护",
          subtitle: "System",
          icon: "image-line",
          category: "system",
          badge: "系统",
          keywords: ["screensaver", "屏保", "pingbao", "screen saver"],
          actions: [{ type: "system", cmdId: "system.screensaver" }]
        },
        {
          id: "system:muteToggle",
          title: "静音切换",
          subtitle: "System",
          icon: "volume-mute-line",
          category: "system",
          badge: "系统",
          keywords: ["mute", "静音", "jingyin", "volume", "音量", "yinliang"],
          actions: [{ type: "system", cmdId: "system.muteToggle" }]
        }
      );
      const windowCommands = [
        {
          id: "window:maximize",
          title: "最大化当前窗口",
          icon: "fullscreen-line",
          cmdId: "window.maximize",
          keywords: ["maximize", "最大化", "zuidahua"]
        },
        {
          id: "window:restore",
          title: "还原窗口",
          icon: "fullscreen-exit-line",
          cmdId: "window.restore",
          keywords: ["restore", "还原", "huanyuan", "exit fullscreen"]
        },
        {
          id: "window:center",
          title: "居中当前窗口",
          icon: "layout-grid-line",
          cmdId: "window.center",
          keywords: ["center", "居中", "juzhong"]
        },
        {
          id: "window:leftHalf",
          title: "窗口左半屏",
          icon: "layout-left-line",
          cmdId: "window.left",
          keywords: ["left", "左半屏", "zuobanping", "分屏", "fenping"]
        },
        {
          id: "window:rightHalf",
          title: "窗口右半屏",
          icon: "layout-right-line",
          cmdId: "window.right",
          keywords: ["right", "右半屏", "youbanping", "分屏", "fenping"]
        },
        {
          id: "window:topHalf",
          title: "窗口上半屏",
          icon: "layout-top-line",
          cmdId: "window.top",
          keywords: ["top", "上半屏", "shangbanping", "分屏", "fenping"]
        },
        {
          id: "window:bottomHalf",
          title: "窗口下半屏",
          icon: "layout-bottom-line",
          cmdId: "window.bottom",
          keywords: ["bottom", "下半屏", "xiabanping", "分屏", "fenping"]
        },
        {
          id: "window:topLeft",
          title: "窗口左上四分之一",
          icon: "layout-grid-line",
          cmdId: "window.topLeft",
          keywords: ["topleft", "左上", "zuoshang", "四分之一", "sifenzhiyi"]
        },
        {
          id: "window:topRight",
          title: "窗口右上四分之一",
          icon: "layout-grid-line",
          cmdId: "window.topRight",
          keywords: ["topright", "右上", "youshang", "四分之一", "sifenzhiyi"]
        },
        {
          id: "window:bottomLeft",
          title: "窗口左下四分之一",
          icon: "layout-grid-line",
          cmdId: "window.bottomLeft",
          keywords: ["bottomleft", "左下", "zuoxia", "四分之一", "sifenzhiyi"]
        },
        {
          id: "window:bottomRight",
          title: "窗口右下四分之一",
          icon: "layout-grid-line",
          cmdId: "window.bottomRight",
          keywords: ["bottomright", "右下", "youxia", "四分之一", "sifenzhiyi"]
        },
        {
          id: "window:nextDisplay",
          title: "窗口移到下一个显示器",
          icon: "monitor-line",
          cmdId: "window.nextDisplay",
          keywords: [
            "display",
            "显示器",
            "xianshiqi",
            "screen",
            "屏幕",
            "pingmu",
            "move",
            "移动",
            "yidong"
          ]
        }
      ];
      for (const wc of windowCommands) {
        commands.push({
          id: wc.id,
          title: wc.title,
          subtitle: "Window",
          icon: wc.icon,
          category: "window",
          badge: "窗口",
          keywords: wc.keywords,
          actions: [{ type: "system", cmdId: wc.cmdId }]
        });
      }
      return commands;
    }
  };
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlN5c3RlbUNvbW1hbmRQcm92aWRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExlYWYgwrcg57O757uf5ZG95Luk5o+Q5L6b6ICF77yI6Zi25q61MS4x77yJXG4gKlxuICog57O757uf5pON5L2cICsg56qX5Y+j566h55CG5ZG95Luk77yM5rOo5YaM5Li65qCH5YeGIENvbW1hbmTjgIJcbiAqIGNtZElkIOagvOW8j++8mnN5c3RlbS57YWN0aW9ufSAvIHdpbmRvdy57YWN0aW9ufe+8jOS4juS4u+i/m+eoiyBzeXN0ZW1jbWQ6cnVuIElQQyDlr7npvZDjgIJcbiAqL1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kLCBDb21tYW5kUHJvdmlkZXIgfSBmcm9tICdAc2hhcmVkL2NvbW1hbmRSZWdpc3RyeSdcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN5c3RlbUNvbW1hbmRQcm92aWRlcigpOiBDb21tYW5kUHJvdmlkZXIge1xuICByZXR1cm4ge1xuICAgIGlkOiAnc3lzdGVtJyxcbiAgICBjYXRlZ29yaWVzOiBbJ3N5c3RlbScsICd3aW5kb3cnXSxcbiAgICByZWFjdGl2ZTogZmFsc2UsXG4gICAgYXN5bmMgZ2V0Q29tbWFuZHMoKTogUHJvbWlzZTxDb21tYW5kW10+IHtcbiAgICAgIGNvbnN0IGNvbW1hbmRzOiBDb21tYW5kW10gPSBbXVxuXG4gICAgICAvLyDilIDilIAg57O757uf5pON5L2cIOKUgOKUgFxuICAgICAgY29tbWFuZHMucHVzaChcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnc3lzdGVtOmxvY2snLFxuICAgICAgICAgIHRpdGxlOiAn6ZSB5a6a5bGP5bmVJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ1N5c3RlbScsXG4gICAgICAgICAgaWNvbjogJ2xvY2stcGFzc3dvcmQnLFxuICAgICAgICAgIGNhdGVnb3J5OiAnc3lzdGVtJyxcbiAgICAgICAgICBiYWRnZTogJ+ezu+e7nycsXG4gICAgICAgICAga2V5d29yZHM6IFsnbG9jaycsICfplIHlsY8nLCAnc3VvZGluZyddLFxuICAgICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdzeXN0ZW0nLCBjbWRJZDogJ3N5c3RlbS5sb2NrJyB9XVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdzeXN0ZW06c2xlZXAnLFxuICAgICAgICAgIHRpdGxlOiAn552h55ygJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ1N5c3RlbScsXG4gICAgICAgICAgaWNvbjogJ21vb24tY2xlYXInLFxuICAgICAgICAgIGNhdGVnb3J5OiAnc3lzdGVtJyxcbiAgICAgICAgICBiYWRnZTogJ+ezu+e7nycsXG4gICAgICAgICAga2V5d29yZHM6IFsnc2xlZXAnLCAn552h55ygJywgJ3NodWltaWFuJ10sXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ3N5c3RlbScsIGNtZElkOiAnc3lzdGVtLnNsZWVwJyB9XVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdzeXN0ZW06cmVzdGFydCcsXG4gICAgICAgICAgdGl0bGU6ICfph43mlrDlkK/liqgnLFxuICAgICAgICAgIHN1YnRpdGxlOiAnU3lzdGVtJyxcbiAgICAgICAgICBpY29uOiAncmVzdGFydCcsXG4gICAgICAgICAgY2F0ZWdvcnk6ICdzeXN0ZW0nLFxuICAgICAgICAgIGJhZGdlOiAn57O757ufJyxcbiAgICAgICAgICBrZXl3b3JkczogWydyZXN0YXJ0JywgJ+mHjeWQrycsICdjaG9uZ3FpJ10sXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ3N5c3RlbScsIGNtZElkOiAnc3lzdGVtLnJlc3RhcnQnIH1dXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3N5c3RlbTpzaHV0ZG93bicsXG4gICAgICAgICAgdGl0bGU6ICflhbPmnLonLFxuICAgICAgICAgIHN1YnRpdGxlOiAnU3lzdGVtJyxcbiAgICAgICAgICBpY29uOiAnc2h1dGRvd24nLFxuICAgICAgICAgIGNhdGVnb3J5OiAnc3lzdGVtJyxcbiAgICAgICAgICBiYWRnZTogJ+ezu+e7nycsXG4gICAgICAgICAga2V5d29yZHM6IFsnc2h1dGRvd24nLCAn5YWz5py6JywgJ2d1YW5qaSddLFxuICAgICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdzeXN0ZW0nLCBjbWRJZDogJ3N5c3RlbS5zaHV0ZG93bicgfV1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnc3lzdGVtOmVtcHR5VHJhc2gnLFxuICAgICAgICAgIHRpdGxlOiAn5riF5YCS5bqf57q456+TJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ1N5c3RlbScsXG4gICAgICAgICAgaWNvbjogJ2RlbGV0ZS1iaW4nLFxuICAgICAgICAgIGNhdGVnb3J5OiAnc3lzdGVtJyxcbiAgICAgICAgICBiYWRnZTogJ+ezu+e7nycsXG4gICAgICAgICAga2V5d29yZHM6IFsndHJhc2gnLCAn5bqf57q456+TJywgJ+WbnuaUtuermScsICdmZWl6aGlsb3UnLCAnZW1wdHknLCAn5riF56m6JywgJ3Fpbmdrb25nJ10sXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ3N5c3RlbScsIGNtZElkOiAnc3lzdGVtLmVtcHR5VHJhc2gnIH1dXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3N5c3RlbTpoaWRlQWxsJyxcbiAgICAgICAgICB0aXRsZTogJ+makOiXj+aJgOacieeql+WPoycsXG4gICAgICAgICAgc3VidGl0bGU6ICdXaW5kb3cnLFxuICAgICAgICAgIGljb246ICdleWUtb2ZmJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ3dpbmRvdycsXG4gICAgICAgICAgYmFkZ2U6ICfnqpflj6MnLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ2hpZGUnLCAn6ZqQ6JePJywgJ3lpbmNhbmcnLCAnZGVza3RvcCcsICfmoYzpnaInLCAnc2hvd2Rlc2t0b3AnXSxcbiAgICAgICAgICBhY3Rpb25zOiBbeyB0eXBlOiAnc3lzdGVtJywgY21kSWQ6ICdzeXN0ZW0uaGlkZUFsbCcgfV1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnc3lzdGVtOnNjcmVlbnNhdmVyJyxcbiAgICAgICAgICB0aXRsZTogJ+Wxj+W5leS/neaKpCcsXG4gICAgICAgICAgc3VidGl0bGU6ICdTeXN0ZW0nLFxuICAgICAgICAgIGljb246ICdpbWFnZS1saW5lJyxcbiAgICAgICAgICBjYXRlZ29yeTogJ3N5c3RlbScsXG4gICAgICAgICAgYmFkZ2U6ICfns7vnu58nLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ3NjcmVlbnNhdmVyJywgJ+Wxj+S/nScsICdwaW5nYmFvJywgJ3NjcmVlbiBzYXZlciddLFxuICAgICAgICAgIGFjdGlvbnM6IFt7IHR5cGU6ICdzeXN0ZW0nLCBjbWRJZDogJ3N5c3RlbS5zY3JlZW5zYXZlcicgfV1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnc3lzdGVtOm11dGVUb2dnbGUnLFxuICAgICAgICAgIHRpdGxlOiAn6Z2Z6Z+z5YiH5o2iJyxcbiAgICAgICAgICBzdWJ0aXRsZTogJ1N5c3RlbScsXG4gICAgICAgICAgaWNvbjogJ3ZvbHVtZS1tdXRlLWxpbmUnLFxuICAgICAgICAgIGNhdGVnb3J5OiAnc3lzdGVtJyxcbiAgICAgICAgICBiYWRnZTogJ+ezu+e7nycsXG4gICAgICAgICAga2V5d29yZHM6IFsnbXV0ZScsICfpnZnpn7MnLCAnamluZ3lpbicsICd2b2x1bWUnLCAn6Z+z6YePJywgJ3lpbmxpYW5nJ10sXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ3N5c3RlbScsIGNtZElkOiAnc3lzdGVtLm11dGVUb2dnbGUnIH1dXG4gICAgICAgIH1cbiAgICAgIClcblxuICAgICAgLy8g4pSA4pSAIOeql+WPo+euoeeQhu+8iOWujOaVtCAxNCDnp43luIPlsYDvvInilIDilIBcbiAgICAgIGNvbnN0IHdpbmRvd0NvbW1hbmRzOiBBcnJheTx7XG4gICAgICAgIGlkOiBzdHJpbmdcbiAgICAgICAgdGl0bGU6IHN0cmluZ1xuICAgICAgICBpY29uOiBzdHJpbmdcbiAgICAgICAgY21kSWQ6IHN0cmluZ1xuICAgICAgICBrZXl3b3Jkczogc3RyaW5nW11cbiAgICAgIH0+ID0gW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICd3aW5kb3c6bWF4aW1pemUnLFxuICAgICAgICAgIHRpdGxlOiAn5pyA5aSn5YyW5b2T5YmN56qX5Y+jJyxcbiAgICAgICAgICBpY29uOiAnZnVsbHNjcmVlbi1saW5lJyxcbiAgICAgICAgICBjbWRJZDogJ3dpbmRvdy5tYXhpbWl6ZScsXG4gICAgICAgICAga2V5d29yZHM6IFsnbWF4aW1pemUnLCAn5pyA5aSn5YyWJywgJ3p1aWRhaHVhJ11cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnd2luZG93OnJlc3RvcmUnLFxuICAgICAgICAgIHRpdGxlOiAn6L+Y5Y6f56qX5Y+jJyxcbiAgICAgICAgICBpY29uOiAnZnVsbHNjcmVlbi1leGl0LWxpbmUnLFxuICAgICAgICAgIGNtZElkOiAnd2luZG93LnJlc3RvcmUnLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ3Jlc3RvcmUnLCAn6L+Y5Y6fJywgJ2h1YW55dWFuJywgJ2V4aXQgZnVsbHNjcmVlbiddXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3dpbmRvdzpjZW50ZXInLFxuICAgICAgICAgIHRpdGxlOiAn5bGF5Lit5b2T5YmN56qX5Y+jJyxcbiAgICAgICAgICBpY29uOiAnbGF5b3V0LWdyaWQtbGluZScsXG4gICAgICAgICAgY21kSWQ6ICd3aW5kb3cuY2VudGVyJyxcbiAgICAgICAgICBrZXl3b3JkczogWydjZW50ZXInLCAn5bGF5LitJywgJ2p1emhvbmcnXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICd3aW5kb3c6bGVmdEhhbGYnLFxuICAgICAgICAgIHRpdGxlOiAn56qX5Y+j5bem5Y2K5bGPJyxcbiAgICAgICAgICBpY29uOiAnbGF5b3V0LWxlZnQtbGluZScsXG4gICAgICAgICAgY21kSWQ6ICd3aW5kb3cubGVmdCcsXG4gICAgICAgICAga2V5d29yZHM6IFsnbGVmdCcsICflt6bljYrlsY8nLCAnenVvYmFucGluZycsICfliIblsY8nLCAnZmVucGluZyddXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3dpbmRvdzpyaWdodEhhbGYnLFxuICAgICAgICAgIHRpdGxlOiAn56qX5Y+j5Y+z5Y2K5bGPJyxcbiAgICAgICAgICBpY29uOiAnbGF5b3V0LXJpZ2h0LWxpbmUnLFxuICAgICAgICAgIGNtZElkOiAnd2luZG93LnJpZ2h0JyxcbiAgICAgICAgICBrZXl3b3JkczogWydyaWdodCcsICflj7PljYrlsY8nLCAneW91YmFucGluZycsICfliIblsY8nLCAnZmVucGluZyddXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3dpbmRvdzp0b3BIYWxmJyxcbiAgICAgICAgICB0aXRsZTogJ+eql+WPo+S4iuWNiuWxjycsXG4gICAgICAgICAgaWNvbjogJ2xheW91dC10b3AtbGluZScsXG4gICAgICAgICAgY21kSWQ6ICd3aW5kb3cudG9wJyxcbiAgICAgICAgICBrZXl3b3JkczogWyd0b3AnLCAn5LiK5Y2K5bGPJywgJ3NoYW5nYmFucGluZycsICfliIblsY8nLCAnZmVucGluZyddXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3dpbmRvdzpib3R0b21IYWxmJyxcbiAgICAgICAgICB0aXRsZTogJ+eql+WPo+S4i+WNiuWxjycsXG4gICAgICAgICAgaWNvbjogJ2xheW91dC1ib3R0b20tbGluZScsXG4gICAgICAgICAgY21kSWQ6ICd3aW5kb3cuYm90dG9tJyxcbiAgICAgICAgICBrZXl3b3JkczogWydib3R0b20nLCAn5LiL5Y2K5bGPJywgJ3hpYWJhbnBpbmcnLCAn5YiG5bGPJywgJ2ZlbnBpbmcnXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICd3aW5kb3c6dG9wTGVmdCcsXG4gICAgICAgICAgdGl0bGU6ICfnqpflj6Plt6bkuIrlm5vliIbkuYvkuIAnLFxuICAgICAgICAgIGljb246ICdsYXlvdXQtZ3JpZC1saW5lJyxcbiAgICAgICAgICBjbWRJZDogJ3dpbmRvdy50b3BMZWZ0JyxcbiAgICAgICAgICBrZXl3b3JkczogWyd0b3BsZWZ0JywgJ+W3puS4iicsICd6dW9zaGFuZycsICflm5vliIbkuYvkuIAnLCAnc2lmZW56aGl5aSddXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ3dpbmRvdzp0b3BSaWdodCcsXG4gICAgICAgICAgdGl0bGU6ICfnqpflj6Plj7PkuIrlm5vliIbkuYvkuIAnLFxuICAgICAgICAgIGljb246ICdsYXlvdXQtZ3JpZC1saW5lJyxcbiAgICAgICAgICBjbWRJZDogJ3dpbmRvdy50b3BSaWdodCcsXG4gICAgICAgICAga2V5d29yZHM6IFsndG9wcmlnaHQnLCAn5Y+z5LiKJywgJ3lvdXNoYW5nJywgJ+Wbm+WIhuS5i+S4gCcsICdzaWZlbnpoaXlpJ11cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnd2luZG93OmJvdHRvbUxlZnQnLFxuICAgICAgICAgIHRpdGxlOiAn56qX5Y+j5bem5LiL5Zub5YiG5LmL5LiAJyxcbiAgICAgICAgICBpY29uOiAnbGF5b3V0LWdyaWQtbGluZScsXG4gICAgICAgICAgY21kSWQ6ICd3aW5kb3cuYm90dG9tTGVmdCcsXG4gICAgICAgICAga2V5d29yZHM6IFsnYm90dG9tbGVmdCcsICflt6bkuIsnLCAnenVveGlhJywgJ+Wbm+WIhuS5i+S4gCcsICdzaWZlbnpoaXlpJ11cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnd2luZG93OmJvdHRvbVJpZ2h0JyxcbiAgICAgICAgICB0aXRsZTogJ+eql+WPo+WPs+S4i+Wbm+WIhuS5i+S4gCcsXG4gICAgICAgICAgaWNvbjogJ2xheW91dC1ncmlkLWxpbmUnLFxuICAgICAgICAgIGNtZElkOiAnd2luZG93LmJvdHRvbVJpZ2h0JyxcbiAgICAgICAgICBrZXl3b3JkczogWydib3R0b21yaWdodCcsICflj7PkuIsnLCAneW91eGlhJywgJ+Wbm+WIhuS5i+S4gCcsICdzaWZlbnpoaXlpJ11cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnd2luZG93Om5leHREaXNwbGF5JyxcbiAgICAgICAgICB0aXRsZTogJ+eql+WPo+enu+WIsOS4i+S4gOS4quaYvuekuuWZqCcsXG4gICAgICAgICAgaWNvbjogJ21vbml0b3ItbGluZScsXG4gICAgICAgICAgY21kSWQ6ICd3aW5kb3cubmV4dERpc3BsYXknLFxuICAgICAgICAgIGtleXdvcmRzOiBbXG4gICAgICAgICAgICAnZGlzcGxheScsXG4gICAgICAgICAgICAn5pi+56S65ZmoJyxcbiAgICAgICAgICAgICd4aWFuc2hpcWknLFxuICAgICAgICAgICAgJ3NjcmVlbicsXG4gICAgICAgICAgICAn5bGP5bmVJyxcbiAgICAgICAgICAgICdwaW5nbXUnLFxuICAgICAgICAgICAgJ21vdmUnLFxuICAgICAgICAgICAgJ+enu+WKqCcsXG4gICAgICAgICAgICAneWlkb25nJ1xuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgXVxuXG4gICAgICBmb3IgKGNvbnN0IHdjIG9mIHdpbmRvd0NvbW1hbmRzKSB7XG4gICAgICAgIGNvbW1hbmRzLnB1c2goe1xuICAgICAgICAgIGlkOiB3Yy5pZCxcbiAgICAgICAgICB0aXRsZTogd2MudGl0bGUsXG4gICAgICAgICAgc3VidGl0bGU6ICdXaW5kb3cnLFxuICAgICAgICAgIGljb246IHdjLmljb24sXG4gICAgICAgICAgY2F0ZWdvcnk6ICd3aW5kb3cnLFxuICAgICAgICAgIGJhZGdlOiAn56qX5Y+jJyxcbiAgICAgICAgICBrZXl3b3Jkczogd2Mua2V5d29yZHMsXG4gICAgICAgICAgYWN0aW9uczogW3sgdHlwZTogJ3N5c3RlbScsIGNtZElkOiB3Yy5jbWRJZCB9XVxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gY29tbWFuZHNcbiAgICB9XG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBUU8sZ0JBQVMsOEJBQStDO0FBQzdELFNBQU87QUFBQSxJQUNMLElBQUk7QUFBQSxJQUNKLFlBQVksQ0FBQyxVQUFVLFFBQVE7QUFBQSxJQUMvQixVQUFVO0FBQUEsSUFDVixNQUFNLGNBQWtDO0FBQ3RDLFlBQU0sV0FBc0IsQ0FBQztBQUc3QixlQUFTO0FBQUEsUUFDUDtBQUFBLFVBQ0UsSUFBSTtBQUFBLFVBQ0osT0FBTztBQUFBLFVBQ1AsVUFBVTtBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sVUFBVTtBQUFBLFVBQ1YsT0FBTztBQUFBLFVBQ1AsVUFBVSxDQUFDLFFBQVEsTUFBTSxTQUFTO0FBQUEsVUFDbEMsU0FBUyxDQUFDLEVBQUUsTUFBTSxVQUFVLE9BQU8sY0FBYyxDQUFDO0FBQUEsUUFDcEQ7QUFBQSxRQUNBO0FBQUEsVUFDRSxJQUFJO0FBQUEsVUFDSixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixVQUFVO0FBQUEsVUFDVixPQUFPO0FBQUEsVUFDUCxVQUFVLENBQUMsU0FBUyxNQUFNLFVBQVU7QUFBQSxVQUNwQyxTQUFTLENBQUMsRUFBRSxNQUFNLFVBQVUsT0FBTyxlQUFlLENBQUM7QUFBQSxRQUNyRDtBQUFBLFFBQ0E7QUFBQSxVQUNFLElBQUk7QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLFVBQVU7QUFBQSxVQUNWLE9BQU87QUFBQSxVQUNQLFVBQVUsQ0FBQyxXQUFXLE1BQU0sU0FBUztBQUFBLFVBQ3JDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sVUFBVSxPQUFPLGlCQUFpQixDQUFDO0FBQUEsUUFDdkQ7QUFBQSxRQUNBO0FBQUEsVUFDRSxJQUFJO0FBQUEsVUFDSixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixVQUFV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