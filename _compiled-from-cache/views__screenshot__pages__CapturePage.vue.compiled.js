import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/views/screenshot/pages/CapturePage.vue");import { defineComponent as _defineComponent } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import { ref, defineAsyncComponent, onMounted, onUnmounted } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
import Screenshots from "/src/views/screenshot/components/Screenshots.vue";
import CaptureModeBar from "/src/views/screenshot/components/CaptureModeBar.vue";
import WindowPicker from "/src/views/screenshot/components/WindowPicker.vue";
import DelaySelector from "/src/views/screenshot/components/DelaySelector.vue";
import CountdownDisplay from "/src/views/screenshot/components/CountdownDisplay.vue";
import HistoryPanel from "/src/views/screenshot/components/HistoryPanel.vue";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "CapturePage",
  setup(__props, { expose: __expose }) {
    __expose();
    const OcrResult = defineAsyncComponent(() => import("/src/views/screenshot/components/OcrResult.vue"));
    const imageUrl = ref(null);
    const display = ref(null);
    const captureMode = ref("screen");
    const windowPickerVisible = ref(false);
    const delaySelectorVisible = ref(false);
    const countdownVisible = ref(false);
    const countdownSeconds = ref(0);
    const historyVisible = ref(false);
    const ocrImageSrc = ref(null);
    const currentSourceInfo = ref(null);
    const screenshotsRef = ref(null);
    let countdownInterval = null;
    onMounted(() => {
      window.api.screenshot.onCapture((displayData, url) => {
        stopCountdown();
        windowPickerVisible.value = false;
        delaySelectorVisible.value = false;
        historyVisible.value = false;
        ocrImageSrc.value = null;
        display.value = displayData;
        imageUrl.value = url;
        captureMode.value = "screen";
        currentSourceInfo.value = { sourceType: "screen" };
      });
      window.api.screenshot.onReset(() => {
        stopCountdown();
        imageUrl.value = null;
        display.value = null;
        windowPickerVisible.value = false;
        currentSourceInfo.value = null;
      });
      window.addEventListener("keydown", handleKeyDown);
      window.api.screenshot.ready();
    });
    onUnmounted(() => {
      window.api.screenshot.removeListeners();
      window.removeEventListener("keydown", handleKeyDown);
      stopCountdown();
    });
    const handleKeyDown = (e) => {
      const target = e.target;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (ocrImageSrc.value) {
          ocrImageSrc.value = null;
        } else if (historyVisible.value) {
          historyVisible.value = false;
        } else if (windowPickerVisible.value) {
          windowPickerVisible.value = false;
        } else if (delaySelectorVisible.value) {
          delaySelectorVisible.value = false;
        } else if (countdownVisible.value) {
          handleCountdownCancel();
        } else {
          handleCancel();
        }
      } else if (e.key === "Enter") {
        if (imageUrl.value && display.value && !ocrImageSrc.value && !windowPickerVisible.value && !historyVisible.value) {
          e.preventDefault();
          screenshotsRef.value?.confirm();
        }
      }
    };
    const handleModeChange = async (mode) => {
      if (mode === "window") {
        windowPickerVisible.value = true;
      } else {
        windowPickerVisible.value = false;
        try {
          await window.api.screenshot.endCapture();
          await window.api.screenshot.startCapture();
        } catch (error) {
          console.error("[CapturePage] Failed to switch to screen mode:", error);
        }
      }
    };
    const handleDelayScreenshot = () => {
      delaySelectorVisible.value = true;
    };
    const handleToggleHistory = () => {
      historyVisible.value = !historyVisible.value;
    };
    const handleOpenHistoryItem = async (item) => {
      historyVisible.value = false;
      try {
        await window.api.screenshot.history.openFile(item.filePath);
      } catch (error) {
        console.error("[CapturePage] Failed to open history item:", error);
      }
    };
    const handleDelayStart = async (seconds) => {
      delaySelectorVisible.value = false;
      stopCountdown();
      countdownSeconds.value = seconds;
      countdownVisible.value = true;
      countdownInterval = setInterval(() => {
        if (!countdownVisible.value) {
          stopCountdown();
          return;
        }
        countdownSeconds.value--;
        if (countdownSeconds.value <= 0) {
          stopCountdown();
          startScreenCapture();
        }
      }, 1e3);
    };
    const handleDelayCancel = () => {
      delaySelectorVisible.value = false;
    };
    const stopCountdown = () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      countdownVisible.value = false;
      countdownSeconds.value = 0;
    };
    const handleCountdownCancel = () => {
      stopCountdown();
    };
    const startScreenCapture = async () => {
      try {
        await window.api.screenshot.endCapture();
        await window.api.screenshot.startCapture();
      } catch (error) {
        console.error("[CapturePage] Failed to start screen capture:", error);
      }
    };
    const handleWindowSelect = async (win) => {
      windowPickerVisible.value = false;
      try {
        const result = await window.api.screenshot.captureWindow(win.id, display.value?.scaleFactor);
        if (result.success && result.imageUrl && result.bounds) {
          const fakeDisplay = {
            id: -1,
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height,
            scaleFactor: result.scaleFactor ?? display.value?.scaleFactor ?? 1
          };
          display.value = fakeDisplay;
          imageUrl.value = result.imageUrl;
          currentSourceInfo.value = { sourceType: "window", sourceId: win.id, sourceName: win.name };
        } else {
          console.error("[CapturePage] Failed to capture window:", result.error);
        }
      } catch (error) {
        console.error("[CapturePage] handleWindowSelect error:", error);
      }
    };
    const handleWindowPickerClose = () => {
      windowPickerVisible.value = false;
    };
    const handleOk = async (blob, bounds) => {
      if (!blob || !display.value) return;
      try {
        const arrayBuffer = await blob.arrayBuffer();
        window.api.screenshot.ok(arrayBuffer, {
          bounds,
          display: display.value,
          ...currentSourceInfo.value
        });
      } catch (error) {
        console.error("[CapturePage] handleOk error:", error);
      }
    };
    const handleSave = async (blob, bounds) => {
      if (!blob || !display.value) return;
      try {
        const arrayBuffer = await blob.arrayBuffer();
        window.api.screenshot.save(arrayBuffer, {
          bounds,
          display: display.value,
          ...currentSourceInfo.value
        });
      } catch (error) {
        console.error("[CapturePage] handleSave error:", error);
      }
    };
    const handleOcr = (imageDataUrl) => {
      ocrImageSrc.value = imageDataUrl;
    };
    const handleOcrResult = (text) => {
      console.log("[CapturePage] OCR result:", text);
    };
    const handleCancel = () => {
      try {
        window.api.screenshot.cancel();
      } catch (error) {
        console.error("[CapturePage] handleCancel error:", error);
      }
    };
    const __returned__ = { OcrResult, imageUrl, display, captureMode, windowPickerVisible, delaySelectorVisible, countdownVisible, countdownSeconds, historyVisible, ocrImageSrc, currentSourceInfo, screenshotsRef, get countdownInterval() {
      return countdownInterval;
    }, set countdownInterval(v) {
      countdownInterval = v;
    }, handleKeyDown, handleModeChange, handleDelayScreenshot, handleToggleHistory, handleOpenHistoryItem, handleDelayStart, handleDelayCancel, stopCountdown, handleCountdownCancel, startScreenCapture, handleWindowSelect, handleWindowPickerClose, handleOk, handleSave, handleOcr, handleOcrResult, handleCancel, Screenshots, CaptureModeBar, WindowPicker, DelaySelector, CountdownDisplay, HistoryPanel };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createCommentVNode as _createCommentVNode, openBlock as _openBlock, createBlock as _createBlock, createVNode as _createVNode, createElementBlock as _createElementBlock } from "/@fs/Users/xiaoye/Desktop/electron-tools/node_modules/.vite/deps/vue.js?v=c8635d8b";
const _hoisted_1 = { class: "screenshot-capture" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _createCommentVNode(" 截图模式切换栏 "),
    !$setup.windowPickerVisible && !$setup.countdownVisible && !$setup.imageUrl && !$setup.historyVisible ? (_openBlock(), _createBlock($setup["CaptureModeBar"], {
      key: 0,
      mode: $setup.captureMode,
      onModeChange: $setup.handleModeChange,
      onDelayScreenshot: $setup.handleDelayScreenshot,
      onToggleHistory: $setup.handleToggleHistory
    }, null, 8, ["mode"])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 历史记录面板 "),
    _createVNode($setup["HistoryPanel"], {
      visible: $setup.historyVisible,
      onClose: _cache[0] || (_cache[0] = ($event) => $setup.historyVisible = false),
      onOpen: $setup.handleOpenHistoryItem
    }, null, 8, ["visible"]),
    _createCommentVNode(" 延时选择器 "),
    $setup.delaySelectorVisible ? (_openBlock(), _createBlock($setup["DelaySelector"], {
      key: 1,
      onStart: $setup.handleDelayStart,
      onCancel: $setup.handleDelayCancel
    })) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 倒计时显示 "),
    $setup.countdownVisible ? (_openBlock(), _createBlock($setup["CountdownDisplay"], {
      key: 2,
      seconds: $setup.countdownSeconds,
      onCancel: $setup.handleCountdownCancel
    }, null, 8, ["seconds"])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 窗口选择器 "),
    $setup.windowPickerVisible ? (_openBlock(), _createBlock($setup["WindowPicker"], {
      key: 3,
      onSelect: $setup.handleWindowSelect,
      onClose: $setup.handleWindowPickerClose
    })) : _createCommentVNode("v-if", true),
    _createCommentVNode(" OCR 结果展示 "),
    $setup.ocrImageSrc ? (_openBlock(), _createBlock($setup["OcrResult"], {
      key: 4,
      "image-src": $setup.ocrImageSrc,
      onClose: _cache[1] || (_cache[1] = ($event) => $setup.ocrImageSrc = null),
      onResult: $setup.handleOcrResult
    }, null, 8, ["image-src"])) : _createCommentVNode("v-if", true),
    _createCommentVNode(" 截图编辑器 "),
    $setup.imageUrl && $setup.display ? (_openBlock(), _createBlock($setup["Screenshots"], {
      key: 5,
      ref: "screenshotsRef",
      url: $setup.imageUrl,
      width: $setup.display.width,
      height: $setup.display.height,
      "scale-factor": $setup.display.scaleFactor,
      onOk: $setup.handleOk,
      onCancel: $setup.handleCancel,
      onSave: $setup.handleSave,
      onOcr: $setup.handleOcr
    }, null, 8, ["url", "width", "height", "scale-factor"])) : _createCommentVNode("v-if", true)
  ]);
}
import "/src/views/screenshot/pages/CapturePage.vue?vue&type=style&index=0&scoped=e04b51c1&lang.css";
_sfc_main.__hmrId = "e04b51c1";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only } = mod;
  if (_rerender_only) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-e04b51c1"], ["__file", "/Users/xiaoye/Desktop/electron-tools/src/renderer/src/views/screenshot/pages/CapturePage.vue"]]);

//# sourceMappingURL=data:application/json;base64,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QTtJQUduQjtBQUFBLElBQ0EsYUFJRTtBQUFBLE1BSEMsU0FBUztBQUFBLE1BQ1QsU0FBSyxzQ0FBRSx3QkFBYztBQUFBLE1BQ3JCLFFBQU07QUFBQTtJQUdUO0FBQUEsSUFFUSw2Q0FEUixhQUlFO0FBQUE7TUFGQyxTQUFPO0FBQUEsTUFDUCxVQUFRO0FBQUE7SUFHWDtBQUFBLElBRVEseUNBRFIsYUFJRTtBQUFBO01BRkMsU0FBUztBQUFBLE1BQ1QsVUFBUTtBQUFBO0lBR1g7QUFBQSxJQUVRLDRDQURSLGFBSUU7QUFBQTtNQUZDLFVBQVE7QUFBQSxNQUNSLFNBQU87QUFBQTtJQUdWO0FBQUEsSUFFUSxvQ0FEUixhQUtFO0FBQUE7TUFIQyxhQUFXO0FBQUEsTUFDWCxTQUFLLHNDQUFFLHFCQUFXO0FBQUEsTUFDbEIsVUFBUTtBQUFBO0lBR1g7QUFBQSxJQUVRLG1CQUFZLGdDQURwQixhQVdFO0FBQUE7TUFUQSxLQUFJO0FBQUEsTUFDSCxLQUFLO0FBQUEsTUFDTCxPQUFPLGVBQVE7QUFBQSxNQUNmLFFBQVEsZUFBUTtBQUFBLE1BQ2hCLGdCQUFjLGVBQVE7QUFBQSxNQUN0QixNQUFJO0FBQUEsTUFDSixVQUFRO0FBQUEsTUFDUixRQUFNO0FBQUEsTUFDTixPQUFLO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkNhcHR1cmVQYWdlLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDxkaXYgY2xhc3M9XCJzY3JlZW5zaG90LWNhcHR1cmVcIj5cbiAgICA8IS0tIOaIquWbvuaooeW8j+WIh+aNouagjyAtLT5cbiAgICA8Q2FwdHVyZU1vZGVCYXJcbiAgICAgIHYtaWY9XCIhd2luZG93UGlja2VyVmlzaWJsZSAmJiAhY291bnRkb3duVmlzaWJsZSAmJiAhaW1hZ2VVcmwgJiYgIWhpc3RvcnlWaXNpYmxlXCJcbiAgICAgIDptb2RlPVwiY2FwdHVyZU1vZGVcIlxuICAgICAgQG1vZGUtY2hhbmdlPVwiaGFuZGxlTW9kZUNoYW5nZVwiXG4gICAgICBAZGVsYXktc2NyZWVuc2hvdD1cImhhbmRsZURlbGF5U2NyZWVuc2hvdFwiXG4gICAgICBAdG9nZ2xlLWhpc3Rvcnk9XCJoYW5kbGVUb2dnbGVIaXN0b3J5XCJcbiAgICAvPlxuXG4gICAgPCEtLSDljoblj7LorrDlvZXpnaLmnb8gLS0+XG4gICAgPEhpc3RvcnlQYW5lbFxuICAgICAgOnZpc2libGU9XCJoaXN0b3J5VmlzaWJsZVwiXG4gICAgICBAY2xvc2U9XCJoaXN0b3J5VmlzaWJsZSA9IGZhbHNlXCJcbiAgICAgIEBvcGVuPVwiaGFuZGxlT3Blbkhpc3RvcnlJdGVtXCJcbiAgICAvPlxuXG4gICAgPCEtLSDlu7bml7bpgInmi6nlmaggLS0+XG4gICAgPERlbGF5U2VsZWN0b3JcbiAgICAgIHYtaWY9XCJkZWxheVNlbGVjdG9yVmlzaWJsZVwiXG4gICAgICBAc3RhcnQ9XCJoYW5kbGVEZWxheVN0YXJ0XCJcbiAgICAgIEBjYW5jZWw9XCJoYW5kbGVEZWxheUNhbmNlbFwiXG4gICAgLz5cblxuICAgIDwhLS0g5YCS6K6h5pe25pi+56S6IC0tPlxuICAgIDxDb3VudGRvd25EaXNwbGF5XG4gICAgICB2LWlmPVwiY291bnRkb3duVmlzaWJsZVwiXG4gICAgICA6c2Vjb25kcz1cImNvdW50ZG93blNlY29uZHNcIlxuICAgICAgQGNhbmNlbD1cImhhbmRsZUNvdW50ZG93bkNhbmNlbFwiXG4gICAgLz5cblxuICAgIDwhLS0g56qX5Y+j6YCJ5oup5ZmoIC0tPlxuICAgIDxXaW5kb3dQaWNrZXJcbiAgICAgIHYtaWY9XCJ3aW5kb3dQaWNrZXJWaXNpYmxlXCJcbiAgICAgIEBzZWxlY3Q9XCJoYW5kbGVXaW5kb3dTZWxlY3RcIlxuICAgICAgQGNsb3NlPVwiaGFuZGxlV2luZG93UGlja2VyQ2xvc2VcIlxuICAgIC8+XG5cbiAgICA8IS0tIE9DUiDnu5PmnpzlsZXnpLogLS0+XG4gICAgPE9jclJlc3VsdFxuICAgICAgdi1pZj1cIm9jckltYWdlU3JjXCJcbiAgICAgIDppbWFnZS1zcmM9XCJvY3JJbWFnZVNyY1wiXG4gICAgICBAY2xvc2U9XCJvY3JJbWFnZVNyYyA9IG51bGxcIlxuICAgICAgQHJlc3VsdD1cImhhbmRsZU9jclJlc3VsdFwiXG4gICAgLz5cblxuICAgIDwhLS0g5oiq5Zu+57yW6L6R5ZmoIC0tPlxuICAgIDxTY3JlZW5zaG90c1xuICAgICAgdi1pZj1cImltYWdlVXJsICYmIGRpc3BsYXlcIlxuICAgICAgcmVmPVwic2NyZWVuc2hvdHNSZWZcIlxuICAgICAgOnVybD1cImltYWdlVXJsXCJcbiAgICAgIDp3aWR0aD1cImRpc3BsYXkud2lkdGhcIlxuICAgICAgOmhlaWdodD1cImRpc3BsYXkuaGVpZ2h0XCJcbiAgICAgIDpzY2FsZS1mYWN0b3I9XCJkaXNwbGF5LnNjYWxlRmFjdG9yXCJcbiAgICAgIEBvaz1cImhhbmRsZU9rXCJcbiAgICAgIEBjYW5jZWw9XCJoYW5kbGVDYW5jZWxcIlxuICAgICAgQHNhdmU9XCJoYW5kbGVTYXZlXCJcbiAgICAgIEBvY3I9XCJoYW5kbGVPY3JcIlxuICAgIC8+XG4gIDwvZGl2PlxuPC90ZW1wbGF0ZT5cblxuPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmltcG9ydCB7IHJlZiwgZGVmaW5lQXN5bmNDb21wb25lbnQsIG9uTW91bnRlZCwgb25Vbm1vdW50ZWQgfSBmcm9tICd2dWUnXG5pbXBvcnQgU2NyZWVuc2hvdHMgZnJvbSAnLi4vY29tcG9uZW50cy9TY3JlZW5zaG90cy52dWUnXG5pbXBvcnQgQ2FwdHVyZU1vZGVCYXIgZnJvbSAnLi4vY29tcG9uZW50cy9DYXB0dXJlTW9kZUJhci52dWUnXG5pbXBvcnQgV2luZG93UGlja2VyIGZyb20gJy4uL2NvbXBvbmVudHMvV2luZG93UGlja2VyLnZ1ZSdcbmltcG9ydCBEZWxheVNlbGVjdG9yIGZyb20gJy4uL2NvbXBvbmVudHMvRGVsYXlTZWxlY3Rvci52dWUnXG5pbXBvcnQgQ291bnRkb3duRGlzcGxheSBmcm9tICcuLi9jb21wb25lbnRzL0NvdW50ZG93bkRpc3BsYXkudnVlJ1xuaW1wb3J0IEhpc3RvcnlQYW5lbCBmcm9tICcuLi9jb21wb25lbnRzL0hpc3RvcnlQYW5lbC52dWUnXG4vLyDlhbPplK7vvJrmioogT2NyUmVzdWx0IOaUueS4uuW8guatpee7hOS7tu+8jOmYsuatouWug+eahOWtkOaooeWdl++8iOWmgiBPY3JTZXJ2aWNl77yJ5Ye66ZSZ5pe2XG4vLyDpmLvloZ7mlbTkuKogQ2FwdHVyZVBhZ2UudnVlIOeahOino+aekO+8jOS7juiAjOWvvOiHtCBvbk1vdW50ZWQg5peg5rOV6Kem5Y+R44CBXG4vLyBTQ1JFRU5TSE9UOnJlYWR5IOawuOi/nOWPkeS4jeWHuuWOu+OAglxuY29uc3QgT2NyUmVzdWx0ID0gZGVmaW5lQXN5bmNDb21wb25lbnQoKCkgPT4gaW1wb3J0KCcuLi9jb21wb25lbnRzL09jclJlc3VsdC52dWUnKSlcbmltcG9ydCB0eXBlIHsgQm91bmRzIH0gZnJvbSAnLi4vdHlwZXMnXG5cbmludGVyZmFjZSBEaXNwbGF5IHtcbiAgaWQ6IG51bWJlclxuICB4OiBudW1iZXJcbiAgeTogbnVtYmVyXG4gIHdpZHRoOiBudW1iZXJcbiAgaGVpZ2h0OiBudW1iZXJcbiAgc2NhbGVGYWN0b3I6IG51bWJlclxufVxuXG5pbnRlcmZhY2UgV2luZG93SW5mbyB7XG4gIGlkOiBzdHJpbmdcbiAgbmFtZTogc3RyaW5nXG4gIHRodW1ibmFpbDogc3RyaW5nXG4gIGJvdW5kczoge1xuICAgIHg6IG51bWJlclxuICAgIHk6IG51bWJlclxuICAgIHdpZHRoOiBudW1iZXJcbiAgICBoZWlnaHQ6IG51bWJlclxuICB9XG59XG5cbmNvbnN0IGltYWdlVXJsID0gcmVmPHN0cmluZyB8IG51bGw+KG51bGwpXG5jb25zdCBkaXNwbGF5ID0gcmVmPERpc3BsYXkgfCBudWxsPihudWxsKVxuY29uc3QgY2FwdHVyZU1vZGUgPSByZWY8J3NjcmVlbicgfCAnd2luZG93Jz4oJ3NjcmVlbicpXG5jb25zdCB3aW5kb3dQaWNrZXJWaXNpYmxlID0gcmVmKGZhbHNlKVxuY29uc3QgZGVsYXlTZWxlY3RvclZpc2libGUgPSByZWYoZmFsc2UpXG5jb25zdCBjb3VudGRvd25WaXNpYmxlID0gcmVmKGZhbHNlKVxuY29uc3QgY291bnRkb3duU2Vjb25kcyA9IHJlZigwKVxuY29uc3QgaGlzdG9yeVZpc2libGUgPSByZWYoZmFsc2UpXG5jb25zdCBvY3JJbWFnZVNyYyA9IHJlZjxzdHJpbmcgfCBudWxsPihudWxsKVxuY29uc3QgY3VycmVudFNvdXJjZUluZm8gPSByZWY8e1xuICBzb3VyY2VUeXBlOiAnc2NyZWVuJyB8ICd3aW5kb3cnXG4gIHNvdXJjZUlkPzogc3RyaW5nXG4gIHNvdXJjZU5hbWU/OiBzdHJpbmdcbn0gfCBudWxsPihudWxsKVxuY29uc3Qgc2NyZWVuc2hvdHNSZWYgPSByZWY8SW5zdGFuY2VUeXBlPHR5cGVvZiBTY3JlZW5zaG90cz4gfCBudWxsPihudWxsKVxuXG5sZXQgY291bnRkb3duSW50ZXJ2YWw6IFJldHVyblR5cGU8dHlwZW9mIHNldEludGVydmFsPiB8IG51bGwgPSBudWxsXG5cbm9uTW91bnRlZCgoKSA9PiB7XG4gIC8vIOebkeWQrOaIquWbvuS6i+S7tlxuICB3aW5kb3cuYXBpLnNjcmVlbnNob3Qub25DYXB0dXJlKChkaXNwbGF5RGF0YTogRGlzcGxheSwgdXJsOiBzdHJpbmcpID0+IHtcbiAgICAvLyDph43nva7miYDmnIkgVUkg54q25oCB77yI5aSN55So56qX5Y+j5pe25LiN5Lya6YeN5pawIG9uTW91bnRlZO+8jOmcgOaJi+WKqOmHjee9ru+8iVxuICAgIHN0b3BDb3VudGRvd24oKVxuICAgIHdpbmRvd1BpY2tlclZpc2libGUudmFsdWUgPSBmYWxzZVxuICAgIGRlbGF5U2VsZWN0b3JWaXNpYmxlLnZhbHVlID0gZmFsc2VcbiAgICBoaXN0b3J5VmlzaWJsZS52YWx1ZSA9IGZhbHNlXG4gICAgb2NySW1hZ2VTcmMudmFsdWUgPSBudWxsXG5cbiAgICBkaXNwbGF5LnZhbHVlID0gZGlzcGxheURhdGFcbiAgICBpbWFnZVVybC52YWx1ZSA9IHVybFxuICAgIGNhcHR1cmVNb2RlLnZhbHVlID0gJ3NjcmVlbidcbiAgICBjdXJyZW50U291cmNlSW5mby52YWx1ZSA9IHsgc291cmNlVHlwZTogJ3NjcmVlbicgfVxuICB9KVxuXG4gIC8vIOebkeWQrOmHjee9ruS6i+S7tlxuICB3aW5kb3cuYXBpLnNjcmVlbnNob3Qub25SZXNldCgoKSA9PiB7XG4gICAgc3RvcENvdW50ZG93bigpXG4gICAgaW1hZ2VVcmwudmFsdWUgPSBudWxsXG4gICAgZGlzcGxheS52YWx1ZSA9IG51bGxcbiAgICB3aW5kb3dQaWNrZXJWaXNpYmxlLnZhbHVlID0gZmFsc2VcbiAgICBjdXJyZW50U291cmNlSW5mby52YWx1ZSA9IG51bGxcbiAgfSlcblxuICAvLyDplK7nm5jlv6vmjbfplK7mlK/mjIFcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVLZXlEb3duKVxuXG4gIC8vIOmAmuefpeS4u+i/m+eoi+WHhuWkh+WujOaIkFxuICB3aW5kb3cuYXBpLnNjcmVlbnNob3QucmVhZHkoKVxufSlcblxub25Vbm1vdW50ZWQoKCkgPT4ge1xuICB3aW5kb3cuYXBpLnNjcmVlbnNob3QucmVtb3ZlTGlzdGVuZXJzKClcbiAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVLZXlEb3duKVxuICBzdG9wQ291bnRkb3duKClcbn0pXG5cbi8qKiBFU0Mg5Y+W5raIIC8gRW50ZXIg56Gu6K6kICovXG5jb25zdCBoYW5kbGVLZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgLy8g5paH5pys6L6T5YWl5Lit55qE5oyJ6ZSu5LiN5oum5oiq77yI5paH5pys5qCH5rOo5o2i6KGM44CB5Y6G5Y+y5pCc57Si562J77yJXG4gIGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbFxuICBpZiAoXG4gICAgdGFyZ2V0ICYmXG4gICAgKHRhcmdldC50YWdOYW1lID09PSAnVEVYVEFSRUEnIHx8IHRhcmdldC50YWdOYW1lID09PSAnSU5QVVQnIHx8IHRhcmdldC5pc0NvbnRlbnRFZGl0YWJsZSlcbiAgKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgLy8g5LyY5YWI57qn77ya5YWz6Zet5by556qXID4g5Y+W5raI5YCS6K6h5pe2ID4g5Y+W5raI5oiq5Zu+XG4gICAgaWYgKG9jckltYWdlU3JjLnZhbHVlKSB7XG4gICAgICBvY3JJbWFnZVNyYy52YWx1ZSA9IG51bGxcbiAgICB9IGVsc2UgaWYgKGhpc3RvcnlWaXNpYmxlLnZhbHVlKSB7XG4gICAgICBoaXN0b3J5VmlzaWJsZS52YWx1ZSA9IGZhbHNlXG4gICAgfSBlbHNlIGlmICh3aW5kb3dQaWNrZXJWaXNpYmxlLnZhbHVlKSB7XG4gICAgICB3aW5kb3dQaWNrZXJWaXNpYmxlLnZhbHVlID0gZmFsc2VcbiAgICB9IGVsc2UgaWYgKGRlbGF5U2VsZWN0b3JWaXNpYmxlLnZhbHVlKSB7XG4gICAgICBkZWxheVNlbGVjdG9yVmlzaWJsZS52YWx1ZSA9IGZhbHNlXG4gICAgfSBlbHNlIGlmIChjb3VudGRvd25WaXNpYmxlLnZhbHVlKSB7XG4gICAgICBoYW5kbGVDb3VudGRvd25DYW5jZWwoKVxuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGVDYW5jZWwoKVxuICAgIH1cbiAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgIC8vIOS7heWcqOaIquWbvue8lui+keWZqOa0u+WKqOS4lOaXoOW8ueWxguaXtuinpuWPkeehruiupO+8iE9DUiDmta7lsYLmiZPlvIDml7YgRW50ZXIg5Lqk57uZ5rWu5bGC77yJXG4gICAgaWYgKFxuICAgICAgaW1hZ2VVcmwudmFsdWUgJiZcbiAgICAgIGRpc3BsYXkudmFsdWUgJiZcbiAgICAgICFvY3JJbWFnZVNyYy52YWx1ZSAmJlxuICAgICAgIXdpbmRvd1BpY2tlclZpc2libGUudmFsdWUgJiZcbiAgICAgICFoaXN0b3J5VmlzaWJsZS52YWx1ZVxuICAgICkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBzY3JlZW5zaG90c1JlZi52YWx1ZT8uY29uZmlybSgpXG4gICAgfVxuICB9XG59XG5cbmNvbnN0IGhhbmRsZU1vZGVDaGFuZ2UgPSBhc3luYyAobW9kZTogJ3NjcmVlbicgfCAnd2luZG93JykgPT4ge1xuICBpZiAobW9kZSA9PT0gJ3dpbmRvdycpIHtcbiAgICB3aW5kb3dQaWNrZXJWaXNpYmxlLnZhbHVlID0gdHJ1ZVxuICB9IGVsc2Uge1xuICAgIC8vIOWIh+aNouWbnuWxj+W5leaIquWbvuaooeW8j++8jOmcgOimgemHjeaWsOW8gOWni+aIquWbvlxuICAgIHdpbmRvd1BpY2tlclZpc2libGUudmFsdWUgPSBmYWxzZVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB3aW5kb3cuYXBpLnNjcmVlbnNob3QuZW5kQ2FwdHVyZSgpXG4gICAgICBhd2FpdCB3aW5kb3cuYXBpLnNjcmVlbnNob3Quc3RhcnRDYXB0dXJlKClcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0NhcHR1cmVQYWdlXSBGYWlsZWQgdG8gc3dpdGNoIHRvIHNjcmVlbiBtb2RlOicsIGVycm9yKVxuICAgIH1cbiAgfVxufVxuXG5jb25zdCBoYW5kbGVEZWxheVNjcmVlbnNob3QgPSAoKSA9PiB7XG4gIGRlbGF5U2VsZWN0b3JWaXNpYmxlLnZhbHVlID0gdHJ1ZVxufVxuXG5jb25zdCBoYW5kbGVUb2dnbGVIaXN0b3J5ID0gKCkgPT4ge1xuICBoaXN0b3J5VmlzaWJsZS52YWx1ZSA9ICFoaXN0b3J5VmlzaWJsZS52YWx1ZVxufVxuXG5jb25zdCBoYW5kbGVPcGVuSGlzdG9yeUl0ZW0gPSBhc3luYyAoaXRlbTogYW55KSA9PiB7XG4gIGhpc3RvcnlWaXNpYmxlLnZhbHVlID0gZmFsc2VcbiAgdHJ5IHtcbiAgICAvLyDnlKjns7vnu5/pu5jorqTmn6XnnIvlmajmiZPlvIDmiKrlm75cbiAgICBhd2FpdCB3aW5kb3cuYXBpLnNjcmVlbnNob3QuaGlzdG9yeS5vcGVuRmlsZShpdGVtLmZpbGVQYXRoKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tDYXB0dXJlUGFnZV0gRmFpbGVkIHRvIG9wZW4gaGlzdG9yeSBpdGVtOicsIGVycm9yKVxuICB9XG59XG5cbmNvbnN0IGhhbmRsZURlbGF5U3RhcnQgPSBhc3luYyAoc2Vjb25kczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGRlbGF5U2VsZWN0b3JWaXNpYmxlLnZhbHVlID0gZmFsc2VcbiAgLy8g5byA5aeL5YCS6K6h5pe2XG4gIHN0b3BDb3VudGRvd24oKVxuICBjb3VudGRvd25TZWNvbmRzLnZhbHVlID0gc2Vjb25kc1xuICBjb3VudGRvd25WaXNpYmxlLnZhbHVlID0gdHJ1ZVxuXG4gIGNvdW50ZG93bkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIC8vIOWkjeeUqOeql+WPo+WcuuaZr++8muWAkuiuoeaXtuacn+mXtOWPr+iDveiiq+aWsOaIquWbvi/ph43nva7miZPmlq3vvIzku4XlrZjmtLvml7bnlJ/mlYhcbiAgICBpZiAoIWNvdW50ZG93blZpc2libGUudmFsdWUpIHtcbiAgICAgIHN0b3BDb3VudGRvd24oKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGNvdW50ZG93blNlY29uZHMudmFsdWUtLVxuICAgIGlmIChjb3VudGRvd25TZWNvbmRzLnZhbHVlIDw9IDApIHtcbiAgICAgIHN0b3BDb3VudGRvd24oKVxuICAgICAgLy8g5YCS6K6h5pe257uT5p2f77yM5byA5aeL5oiq5Zu+XG4gICAgICBzdGFydFNjcmVlbkNhcHR1cmUoKVxuICAgIH1cbiAgfSwgMTAwMClcbn1cblxuY29uc3QgaGFuZGxlRGVsYXlDYW5jZWwgPSAoKSA9PiB7XG4gIGRlbGF5U2VsZWN0b3JWaXNpYmxlLnZhbHVlID0gZmFsc2Vcbn1cblxuLyoqIOe7n+S4gOa4heeQhuWAkuiuoeaXtu+8iG9uQ2FwdHVyZSAvIG9uUmVzZXQgLyDljbjovb0gLyDmraPluLjnu5PmnZ/lhbHnlKjvvIkgKi9cbmNvbnN0IHN0b3BDb3VudGRvd24gPSAoKTogdm9pZCA9PiB7XG4gIGlmIChjb3VudGRvd25JbnRlcnZhbCkge1xuICAgIGNsZWFySW50ZXJ2YWwoY291bnRkb3duSW50ZXJ2YWwpXG4gICAgY291bnRkb3duSW50ZXJ2YWwgPSBudWxsXG4gIH1cbiAgY291bnRkb3duVmlzaWJsZS52YWx1ZSA9IGZhbHNlXG4gIGNvdW50ZG93blNlY29uZHMudmFsdWUgPSAwXG59XG5cbmNvbnN0IGhhbmRsZUNvdW50ZG93bkNhbmNlbCA9ICgpOiB2b2lkID0+IHtcbiAgc3RvcENvdW50ZG93bigpXG59XG5cbmNvbnN0IHN0YXJ0U2NyZWVuQ2FwdHVyZSA9IGFzeW5jICgpID0+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCB3aW5kb3cuYXBpLnNjcmVlbnNob3QuZW5kQ2FwdHVyZSgpXG4gICAgYXdhaXQgd2luZG93LmFwaS5zY3JlZW5zaG90LnN0YXJ0Q2FwdHVyZSgpXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW0NhcHR1cmVQYWdlXSBGYWlsZWQgdG8gc3RhcnQgc2NyZWVuIGNhcHR1cmU6JywgZXJyb3IpXG4gIH1cbn1cblxuY29uc3QgaGFuZGxlV2luZG93U2VsZWN0ID0gYXN5bmMgKHdpbjogV2luZG93SW5mbyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICB3aW5kb3dQaWNrZXJWaXNpYmxlLnZhbHVlID0gZmFsc2VcblxuICB0cnkge1xuICAgIC8vIOaNleiOt+aMh+Wumueql+WPo++8iOS8oOW9k+WJjSBvdmVybGF5IOaJgOWcqOaYvuekuuWZqOeahOe8qeaUvuezu+aVsO+8jOS4u+i/m+eoi+aNruatpOaNoueul+mAu+i+keWwuuWvuO+8iVxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkuc2NyZWVuc2hvdC5jYXB0dXJlV2luZG93KHdpbi5pZCwgZGlzcGxheS52YWx1ZT8uc2NhbGVGYWN0b3IpXG4gICAgaWYgKHJlc3VsdC5zdWNjZXNzICYmIHJlc3VsdC5pbWFnZVVybCAmJiByZXN1bHQuYm91bmRzKSB7XG4gICAgICAvLyDnqpflj6Plm77lg4/kvZzkuLrni6znq4vmnaXmupDvvJrpgLvovpHlsLrlr7jnlLHkuLvov5vnqIvmjIkgc2NhbGVGYWN0b3Ig5o2i566X77yMXG4gICAgICAvLyDkv53or4EgUmV0aW5hIOS4i+e8lui+keWZqOWwuuWvuOS4jum8oOagh+WdkOagh+WSjOWbvuWDj+WGheWuueS4gOiHtFxuICAgICAgY29uc3QgZmFrZURpc3BsYXk6IERpc3BsYXkgPSB7XG4gICAgICAgIGlkOiAtMSxcbiAgICAgICAgeDogcmVzdWx0LmJvdW5kcy54LFxuICAgICAgICB5OiByZXN1bHQuYm91bmRzLnksXG4gICAgICAgIHdpZHRoOiByZXN1bHQuYm91bmRzLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHJlc3VsdC5ib3VuZHMuaGVpZ2h0LFxuICAgICAgICBzY2FsZUZhY3RvcjogcmVzdWx0LnNjYWxlRmFjdG9yID8/IGRpc3BsYXkudmFsdWU/LnNjYWxlRmFjdG9yID8/IDFcbiAgICAgIH1cbiAgICAgIGRpc3BsYXkudmFsdWUgPSBmYWtlRGlzcGxheVxuICAgICAgaW1hZ2VVcmwudmFsdWUgPSByZXN1bHQuaW1hZ2VVcmxcbiAgICAgIGN1cnJlbnRTb3VyY2VJbmZvLnZhbHVlID0geyBzb3VyY2VUeXBlOiAnd2luZG93Jywgc291cmNlSWQ6IHdpbi5pZCwgc291cmNlTmFtZTogd2luLm5hbWUgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ2FwdHVyZVBhZ2VdIEZhaWxlZCB0byBjYXB0dXJlIHdpbmRvdzonLCByZXN1bHQuZXJyb3IpXG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tDYXB0dXJlUGFnZV0gaGFuZGxlV2luZG93U2VsZWN0IGVycm9yOicsIGVycm9yKVxuICB9XG59XG5cbmNvbnN0IGhhbmRsZVdpbmRvd1BpY2tlckNsb3NlID0gKCkgPT4ge1xuICB3aW5kb3dQaWNrZXJWaXNpYmxlLnZhbHVlID0gZmFsc2Vcbn1cblxuY29uc3QgaGFuZGxlT2sgPSBhc3luYyAoYmxvYjogQmxvYiB8IG51bGwsIGJvdW5kczogQm91bmRzKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGlmICghYmxvYiB8fCAhZGlzcGxheS52YWx1ZSkgcmV0dXJuXG4gIHRyeSB7XG4gICAgY29uc3QgYXJyYXlCdWZmZXIgPSBhd2FpdCBibG9iLmFycmF5QnVmZmVyKClcbiAgICB3aW5kb3cuYXBpLnNjcmVlbnNob3Qub2soYXJyYXlCdWZmZXIsIHtcbiAgICAgIGJvdW5kcyxcbiAgICAgIGRpc3BsYXk6IGRpc3BsYXkudmFsdWUsXG4gICAgICAuLi5jdXJyZW50U291cmNlSW5mby52YWx1ZVxuICAgIH0pXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW0NhcHR1cmVQYWdlXSBoYW5kbGVPayBlcnJvcjonLCBlcnJvcilcbiAgfVxufVxuXG5jb25zdCBoYW5kbGVTYXZlID0gYXN5bmMgKGJsb2I6IEJsb2IgfCBudWxsLCBib3VuZHM6IEJvdW5kcyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBpZiAoIWJsb2IgfHwgIWRpc3BsYXkudmFsdWUpIHJldHVyblxuICB0cnkge1xuICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgYmxvYi5hcnJheUJ1ZmZlcigpXG4gICAgd2luZG93LmFwaS5zY3JlZW5zaG90LnNhdmUoYXJyYXlCdWZmZXIsIHtcbiAgICAgIGJvdW5kcyxcbiAgICAgIGRpc3BsYXk6IGRpc3BsYXkudmFsdWUsXG4gICAgICAuLi5jdXJyZW50U291cmNlSW5mby52YWx1ZVxuICAgIH0pXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW0NhcHR1cmVQYWdlXSBoYW5kbGVTYXZlIGVycm9yOicsIGVycm9yKVxuICB9XG59XG5cbmNvbnN0IGhhbmRsZU9jciA9IChpbWFnZURhdGFVcmw6IHN0cmluZyk6IHZvaWQgPT4ge1xuICBvY3JJbWFnZVNyYy52YWx1ZSA9IGltYWdlRGF0YVVybFxufVxuXG5jb25zdCBoYW5kbGVPY3JSZXN1bHQgPSAodGV4dDogc3RyaW5nKTogdm9pZCA9PiB7XG4gIGNvbnNvbGUubG9nKCdbQ2FwdHVyZVBhZ2VdIE9DUiByZXN1bHQ6JywgdGV4dClcbiAgLy8g5Y+v5Lul5Zyo6L+Z6YeM5bCG6K+G5Yir57uT5p6c5aSN5Yi25Yiw5Ymq6LS05p2/5oiW5YW25LuW5aSE55CGXG59XG5cbmNvbnN0IGhhbmRsZUNhbmNlbCA9ICgpID0+IHtcbiAgdHJ5IHtcbiAgICB3aW5kb3cuYXBpLnNjcmVlbnNob3QuY2FuY2VsKClcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbQ2FwdHVyZVBhZ2VdIGhhbmRsZUNhbmNlbCBlcnJvcjonLCBlcnJvcilcbiAgfVxufVxuPC9zY3JpcHQ+XG5cbjxzdHlsZSBzY29wZWQ+XG4uc2NyZWVuc2hvdC1jYXB0dXJlIHtcbiAgcG9zaXRpb246IGZpeGVkO1xuICB0b3A6IDA7XG4gIGxlZnQ6IDA7XG4gIHdpZHRoOiAxMDB2dztcbiAgaGVpZ2h0OiAxMDB2aDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbn1cbjwvc3R5bGU+XG4iXSwiZmlsZSI6Ii9Vc2Vycy94aWFveWUvRGVza3RvcC9lbGVjdHJvbi10b29scy9zcmMvcmVuZGVyZXIvc3JjL3ZpZXdzL3NjcmVlbnNob3QvcGFnZXMvQ2FwdHVyZVBhZ2UudnVlIn0=