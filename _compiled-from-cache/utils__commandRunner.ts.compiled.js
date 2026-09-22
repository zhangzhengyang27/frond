import { buildQuicklinkUrl, WINDOW_MODULES } from "/@fs/Users/xiaoye/Desktop/electron-tools/src/shared/commands.ts?t=1788665323791";
export async function executeCommand(entry, opts) {
  const { router, inMainWindow, close } = opts;
  const a = entry.action;
  switch (a.type) {
    case "module": {
      void window.api.usage.recordUse(a.moduleId);
      if (!inMainWindow || WINDOW_MODULES.has(a.moduleId) || !router) {
        void window.api.createNewWindow(`${a.path}?immersive=1`);
        close();
        break;
      }
      await router.push(a.path);
      close();
      break;
    }
    case "page": {
      if (!inMainWindow || !router) {
        void window.api.createNewWindow(`${a.path}?immersive=1`);
        close();
        break;
      }
      await router.push(a.path);
      close();
      break;
    }
    case "plugin": {
      window.api.launcher.openPlugin(a.pluginId, a.cmd);
      break;
    }
    case "app": {
      void window.api.launchApplication(a.path);
      close();
      break;
    }
    case "action": {
      if (a.action === "screenshot.start") {
        await window.api.screenshot.startCapture();
      }
      close();
      break;
    }
    case "copyText": {
      try {
        await navigator.clipboard.writeText(a.text);
      } catch {
      }
      close();
      break;
    }
    case "system": {
      await window.api.sysCmd.run(a.cmdId);
      close();
      break;
    }
    case "quicklink": {
      if (a.url.includes("{query}")) {
        if (opts.openQuicklinkArg) {
          opts.openQuicklinkArg(entry);
          break;
        }
        void window.api.system.openExternal(buildQuicklinkUrl(a.url, ""));
        close();
        break;
      }
      void window.api.system.openExternal(a.url);
      close();
      break;
    }
    case "firstParty": {
      if (a.page === "settings") {
        await window.api.createNewWindow("/settings");
        close();
        break;
      }
      if (opts.openFirstParty) {
        opts.openFirstParty(a.page);
      } else {
        window.api.launcher.openFirstParty(a.page);
      }
      break;
    }
    case "file": {
      void window.api.system.openPath(a.path);
      close();
      break;
    }
    case "clipboardItem": {
      try {
        await window.api.clipHist.copy(a.id);
      } catch {
      }
      close();
      break;
    }
    case "snippetItem": {
      try {
        const snip = await window.api.snippet.getSnippetById(a.id);
        const text = snip?.contents?.[0]?.value ?? "";
        if (text) await navigator.clipboard.writeText(String(text));
      } catch {
      }
      close();
      break;
    }
    case "screenshotItem": {
      try {
        await window.api.screenshot.history.copyImage(a.filePath);
      } catch {
      }
      close();
      break;
    }
    case "floatingNote": {
      void window.api.floatingNote.toggle();
      close();
      break;
    }
  }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1hbmRSdW5uZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMZWFmIMK3IOWRveS7pOaJp+ihjOWZqO+8iElBIHYy44CM57uf5LiA5ZG95Luk5bGC44CN77yJXG4gKlxuICog5ZCv5Yqo5Y+w6IO25ZuK5LiOIOKMmEsg5ZG95Luk6Z2i5p2/5YWx55So55qEIENvbW1hbmRFbnRyeSDmiafooYzpgLvovpHvvJpcbiAqIOWQjOS4gOS4quWRveS7pO+8jOS7juWTquS4quWFpeWPo+inpuWPke+8jOihjOS4uuivreS5iemDveS4gOiHtOKAlOKAlFxuICogLSBtb2R1bGXvvJrkuLvnqpflj6PlhoXnm7TmjqXot6/nlLHot7PovazvvJvog7blm4rkuK3liJnnu4/kuLvov5vnqIvllKTotbfkuLvnqpflj6Plho3ot7PovaxcbiAqIC0gcGFnZe+8muezu+e7n+euoeeQhumhte+8jOWQjOS4ilxuICogLSBwbHVnaW7vvJrllKTotbfog7blm4rnqpfmib/ovb3mj5Lku7bkuqTkupLvvIjpl6jnrqHov5vlhaXvvIlcbiAqIC0gYXBw77ya5Lqk57uZ57O757uf5ZCv5YqoXG4gKiAtIGFjdGlvbu+8mueri+WNs+aJp+ihjO+8iOaIquWbvuetie+8ie+8jOS4jeaJk+W8gOmhtemdolxuICovXG5pbXBvcnQgdHlwZSB7IFJvdXRlciB9IGZyb20gJ3Z1ZS1yb3V0ZXInXG5pbXBvcnQgdHlwZSB7IENvbW1hbmRFbnRyeSwgRmlyc3RQYXJ0eVBhZ2UgfSBmcm9tICdAc2hhcmVkL2NvbW1hbmRzJ1xuaW1wb3J0IHsgYnVpbGRRdWlja2xpbmtVcmwsIFdJTkRPV19NT0RVTEVTIH0gZnJvbSAnQHNoYXJlZC9jb21tYW5kcydcblxuZXhwb3J0IGludGVyZmFjZSBDb21tYW5kUnVuT3B0aW9ucyB7XG4gIC8qKiDkuLvnqpflj6PlhoXnmoTlhaXlj6PvvIjijJhL77yJ5b+F5Lyg77yb6IO25ZuK56qX5pegIHJvdXRlcu+8jOWPr+S4jeS8oCAqL1xuICByb3V0ZXI/OiBSb3V0ZXJcbiAgLyoqIHRydWUgPSDlt7LlnKjkuLvnqpflj6PvvIjijJhL77yJ77ybZmFsc2UgPSDog7blm4rnqpfkuK3miafooYwgKi9cbiAgaW5NYWluV2luZG93OiBib29sZWFuXG4gIC8qKiDmiafooYzlkI7nmoTmlLblsL7vvIjog7blm4ogaGlkZSAvIOKMmEsg5YWz6Z2i5p2/77yJ77ybcGx1Z2luIC8gZmlyc3RQYXJ0eSDliIbmlK/kuI3mlLblsL4gKi9cbiAgY2xvc2U6ICgpID0+IHZvaWRcbiAgLyoqIOiDtuWbiueql+WGheaJk+W8gOesrOS4gOaWueWGheiBlOmhte+8iOS7heiDtuWbiuWFpeWPo+aPkOS+m++8m+KMmEsg6LWwIElQQyDllKTotbfog7blm4rvvIkgKi9cbiAgb3BlbkZpcnN0UGFydHk/OiAocGFnZTogRmlyc3RQYXJ0eVBhZ2UpID0+IHZvaWRcbiAgLyoqIOWPguaVsOWMliBRdWlja2xpbmvvvIhVUkwg5ZCrIHtxdWVyeX3vvInpnIDopoHlj4LmlbDovpPlhaXml7blm57osIPvvIjog7blm4rooajljZXvvInvvJvnvLrnnIHpgIDljJbkuLrmiZPlvIDln7rnoYDpk77mjqUgKi9cbiAgb3BlblF1aWNrbGlua0FyZz86IChlbnRyeTogQ29tbWFuZEVudHJ5KSA9PiB2b2lkXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlQ29tbWFuZChlbnRyeTogQ29tbWFuZEVudHJ5LCBvcHRzOiBDb21tYW5kUnVuT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB7IHJvdXRlciwgaW5NYWluV2luZG93LCBjbG9zZSB9ID0gb3B0c1xuICBjb25zdCBhID0gZW50cnkuYWN0aW9uXG5cbiAgc3dpdGNoIChhLnR5cGUpIHtcbiAgICBjYXNlICdtb2R1bGUnOiB7XG4gICAgICB2b2lkIHdpbmRvdy5hcGkudXNhZ2UucmVjb3JkVXNlKGEubW9kdWxlSWQpXG4gICAgICAvLyDpmLbmrrVD44CM5Li756qX5Y+j6ZmN57qn44CN77yaXG4gICAgICAvLyAtIOiDtuWbiuWFpeWPo++8muS4gOW+i+W8gOayiea1uOW8j+eLrOeri+eql+WPo++8iOaXoOS+p+agjyAvIOmhtuagj++8jD9pbW1lcnNpdmU9Me+8ie+8jFxuICAgICAgLy8gICDmkJzku4DkuYjlsLHlj6rnnIvku4DkuYjvvIzkuLvnqpflj6Pkv53mjIHlvZPliY3nirbmgIFcbiAgICAgIC8vIC0g4oyYSyDlhaXlj6PvvJrovbvlnovmqKHlnZflnKjkuLvnqpflj6PlhoXlr7zoiKrvvIjnlKjmiLfmnKzlsLHlnKjlt6XkvZzlj7DvvInvvJtcbiAgICAgIC8vICAg6YeN5Z6L5qih5Z2X77yI54mH5q61IC8g5b2V5bGP77yMV0lORE9XX01PRFVMRVPvvInlvIDmsonmtbjlvI/ni6znq4vnqpflj6NcbiAgICAgIGlmICghaW5NYWluV2luZG93IHx8IFdJTkRPV19NT0RVTEVTLmhhcyhhLm1vZHVsZUlkKSB8fCAhcm91dGVyKSB7XG4gICAgICAgIHZvaWQgd2luZG93LmFwaS5jcmVhdGVOZXdXaW5kb3coYCR7YS5wYXRofT9pbW1lcnNpdmU9MWApXG4gICAgICAgIGNsb3NlKClcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHJvdXRlci5wdXNoKGEucGF0aClcbiAgICAgIGNsb3NlKClcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGNhc2UgJ3BhZ2UnOiB7XG4gICAgICBpZiAoIWluTWFpbldpbmRvdyB8fCAhcm91dGVyKSB7XG4gICAgICAgIC8vIOiDtuWbiuaJk+W8gOezu+e7n+mhte+8iOiuvue9riAvIOi/geenuyAvIOWFs+S6ju+8ieWQjOagt+i1sOayiea1uOW8j+eLrOeri+eql+WPo1xuICAgICAgICB2b2lkIHdpbmRvdy5hcGkuY3JlYXRlTmV3V2luZG93KGAke2EucGF0aH0/aW1tZXJzaXZlPTFgKVxuICAgICAgICBjbG9zZSgpXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBhd2FpdCByb3V0ZXIucHVzaChhLnBhdGgpXG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICAgIH1cbiAgICBjYXNlICdwbHVnaW4nOiB7XG4gICAgICAvLyDllKTotbfog7blm4rnqpflubbmiZPlvIDmj5Lku7bvvJvog7blm4rkv53mjIHlj6/op4Hov5vlhaXmj5Lku7bkuqTkupLvvIzkuI3miafooYwgY2xvc2VcbiAgICAgIHdpbmRvdy5hcGkubGF1bmNoZXIub3BlblBsdWdpbihhLnBsdWdpbklkLCBhLmNtZClcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGNhc2UgJ2FwcCc6IHtcbiAgICAgIHZvaWQgd2luZG93LmFwaS5sYXVuY2hBcHBsaWNhdGlvbihhLnBhdGgpXG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICAgIH1cbiAgICBjYXNlICdhY3Rpb24nOiB7XG4gICAgICBpZiAoYS5hY3Rpb24gPT09ICdzY3JlZW5zaG90LnN0YXJ0Jykge1xuICAgICAgICBhd2FpdCB3aW5kb3cuYXBpLnNjcmVlbnNob3Quc3RhcnRDYXB0dXJlKClcbiAgICAgIH1cbiAgICAgIGNsb3NlKClcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGNhc2UgJ2NvcHlUZXh0Jzoge1xuICAgICAgLy8g6K6h566X5Zmo5YWc5bqV562J5Zy65pmv77ya5aSN5Yi25paH5pys5ZCO5pS26LW377yIUmF5Y2FzdCDnmoQgY29weS10aGVuLWNsb3Nl77yJXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChhLnRleHQpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyog5Ymq6LS05p2/5aSx6LSl6Z2Z6buYICovXG4gICAgICB9XG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICAgIH1cbiAgICBjYXNlICdzeXN0ZW0nOiB7XG4gICAgICAvLyDns7vnu5/lkb3ku6QgLyDnqpflj6PnrqHnkIbvvIhNMu+8ie+8muS4u+i/m+eoi+aJp+ihjO+8jOWksei0peaPkOekuueUseS4u+i/m+eoi+i/lOWbnlxuICAgICAgYXdhaXQgd2luZG93LmFwaS5zeXNDbWQucnVuKGEuY21kSWQpXG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICAgIH1cbiAgICBjYXNlICdxdWlja2xpbmsnOiB7XG4gICAgICAvLyBRdWlja2xpbmtz77yITTIuM++8ie+8muezu+e7n+m7mOiupOa1j+iniOWZqOaJk+W8gO+8m+WQqyB7cXVlcnl9IOWNoOS9jeespueahOWPguaVsOWMlumTvuaOpVxuICAgICAgLy8g5Zyo6IO25ZuK5YaF5YWI5by55Y+C5pWw6KGo5Y2V77yIUmF5Y2FzdCDnmoQgUmVxdWlyZWQgQXJndW1lbnTvvInvvIzijJhLIOaXoOi+k+WFpeacuuWItuWImeaJk+W8gOWfuuehgOmTvuaOpVxuICAgICAgaWYgKGEudXJsLmluY2x1ZGVzKCd7cXVlcnl9JykpIHtcbiAgICAgICAgaWYgKG9wdHMub3BlblF1aWNrbGlua0FyZykge1xuICAgICAgICAgIG9wdHMub3BlblF1aWNrbGlua0FyZyhlbnRyeSlcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICAgIHZvaWQgd2luZG93LmFwaS5zeXN0ZW0ub3BlbkV4dGVybmFsKGJ1aWxkUXVpY2tsaW5rVXJsKGEudXJsLCAnJykpXG4gICAgICAgIGNsb3NlKClcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIHZvaWQgd2luZG93LmFwaS5zeXN0ZW0ub3BlbkV4dGVybmFsKGEudXJsKVxuICAgICAgY2xvc2UoKVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgY2FzZSAnZmlyc3RQYXJ0eSc6IHtcbiAgICAgIC8vIFJheWNhc3Qg5YyW77ya6K6+572u6aG15omT5byA54us56uL55qE5a6M5pW06K6+572u56qX5Y+j77yI6ICM6Z2e6IO25ZuK5YaF6IGU5b+r5o236K6+572u77yJXG4gICAgICBpZiAoYS5wYWdlID09PSAnc2V0dGluZ3MnKSB7XG4gICAgICAgIGF3YWl0IHdpbmRvdy5hcGkuY3JlYXRlTmV3V2luZG93KCcvc2V0dGluZ3MnKVxuICAgICAgICBjbG9zZSgpXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBpZiAob3B0cy5vcGVuRmlyc3RQYXJ0eSkge1xuICAgICAgICAvLyDog7blm4rlhaXlj6PvvJrlsLHlnLDmiZPlvIDlhoXogZTpobVcbiAgICAgICAgb3B0cy5vcGVuRmlyc3RQYXJ0eShhLnBhZ2UpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyDijJhLIOetieWklumDqOWFpeWPo++8muWUpOi1t+iDtuWbiueql+W5tuaJk+W8gOWvueW6lOmhte+8iOmXqOeuoei/m+WFpe+8iVxuICAgICAgICB3aW5kb3cuYXBpLmxhdW5jaGVyLm9wZW5GaXJzdFBhcnR5KGEucGFnZSlcbiAgICAgIH1cbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGNhc2UgJ2ZpbGUnOiB7XG4gICAgICAvLyDnu5/kuIDmt7flkIjmkJzntKLvvJrmlofku7bnu5PmnpzvvIzlm57ovabnlKjns7vnu5/pu5jorqTnqIvluo/miZPlvIBcbiAgICAgIHZvaWQgd2luZG93LmFwaS5zeXN0ZW0ub3BlblBhdGgoYS5wYXRoKVxuICAgICAgY2xvc2UoKVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgY2FzZSAnY2xpcGJvYXJkSXRlbSc6IHtcbiAgICAgIC8vIOe7n+S4gOa3t+WQiOaQnOe0ou+8muWJqui0tOadv+WOhuWPsuadoeebru+8jOWbnui9puWGjeWkjeWItuWIsOWJqui0tOadv1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd2luZG93LmFwaS5jbGlwSGlzdC5jb3B5KGEuaWQpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyog5aSN5Yi25aSx6LSl6Z2Z6buYICovXG4gICAgICB9XG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICAgIH1cbiAgICBjYXNlICdzbmlwcGV0SXRlbSc6IHtcbiAgICAgIC8vIOe7n+S4gOa3t+WQiOaQnOe0ou+8muS7o+eggeeJh+aute+8jOWbnui9puWPlummluS4quWGheWuueWdl+WkjeWItlxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc25pcCA9IChhd2FpdCB3aW5kb3cuYXBpLnNuaXBwZXQuZ2V0U25pcHBldEJ5SWQoYS5pZCkpIGFzIHtcbiAgICAgICAgICBjb250ZW50cz86IEFycmF5PHsgdmFsdWU/OiBzdHJpbmcgfT5cbiAgICAgICAgfSB8IG51bGxcbiAgICAgICAgY29uc3QgdGV4dCA9IHNuaXA/LmNvbnRlbnRzPy5bMF0/LnZhbHVlID8/ICcnXG4gICAgICAgIGlmICh0ZXh0KSBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChTdHJpbmcodGV4dCkpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyog54mH5q616K+75Y+WL+WkjeWItuWksei0pemdmem7mCAqL1xuICAgICAgfVxuICAgICAgY2xvc2UoKVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgY2FzZSAnc2NyZWVuc2hvdEl0ZW0nOiB7XG4gICAgICAvLyDnu5/kuIDmt7flkIjmkJzntKLvvJrmiKrlm77ljoblj7LvvIzlm57ovablpI3liLblm77niYfliLDliarotLTmnb9cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHdpbmRvdy5hcGkuc2NyZWVuc2hvdC5oaXN0b3J5LmNvcHlJbWFnZShhLmZpbGVQYXRoKVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIOWkjeWItuWksei0pemdmem7mCAqL1xuICAgICAgfVxuICAgICAgY2xvc2UoKVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgY2FzZSAnZmxvYXRpbmdOb3RlJzoge1xuICAgICAgLy8g5omT5byA5rWu5Yqo56yU6K6w56qX5Y+jXG4gICAgICB2b2lkIHdpbmRvdy5hcGkuZmxvYXRpbmdOb3RlLnRvZ2dsZSgpXG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFhQSxTQUFTLG1CQUFtQixzQkFBc0I7QUFlbEQsc0JBQXNCLGVBQWUsT0FBcUIsTUFBd0M7QUFDaEcsUUFBTSxFQUFFLFFBQVEsY0FBYyxNQUFNLElBQUk7QUFDeEMsUUFBTSxJQUFJLE1B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