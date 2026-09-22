# Hyper Key 设计评审（批次 3 产出，实施待用户在场测试）

> 背景：V4 差距分析 P1-8。Raycast Hyper Key = 把 Caps Lock（或修饰键/F 键）重映射为
> 「✦ 超级修饰键」，在其上录制不与系统/应用冲突的组合快捷键；带单按（Quick Press）
> 行为、冲突诊断面板、Secure Input 兼容模式。Leaf 目前完全没有该能力，且本仓库
> 已有 uiohook 全局按键监听（两段式直达）可部分复用。

## 两个候选方案

### 方案 A：hidutil 系统级重映射 + uiohook 组合监听（推荐起步方案）

**原理**：`hidutil property --set '{"UserKeyMapping":[{HIDKeyboardModifierMappingSrc:0x700000039, HIDKeyboardModifierMappingDst:0x700000068}]}'`
把 Caps Lock（0x39）映射为 F18（0x68，未被消费的键）；uiohook 监听 F18 的
keydown/keyup 与其叠加键，在 keyup 时分发命令。

**优点**：
- 零原生代码：Apple 官方机制，无驱动、无 CGEventTap 内嵌、不触发键盘安全审计
- uiohook 已在依赖内（两段式直达同款监听栈），工程量最小
- 可实现「按住 = 修饰键、单按 = 可配置动作」（keydown/keyup 时序完整）

**缺点 / 风险**：
- `hidutil property --set` 是**系统级**变更：启用期间所有应用都收到 F18（这正是
  Hyper Key 想要的），但用户停用前会一直生效；重启后失效（需 LaunchAgent 才持久，
  建议第一期不做持久化，应用启动时重新应用 + 退出时 `hidutil --clear`）
- 只对「可重映射的内置/USB/部分蓝牙键盘」生效，Universal Control 共享键盘会被
  跳过（Raycast 文档同样声明此限制）
- 单按发真实 Caps Lock 需要 osascript `key code 57`（可做，但嵌套重映射需注意）
- 与 Karabiner 冲突（同 Raycast：检测到 Karabiner 虚拟键盘时提示关闭）

### 方案 B：CGEventTap 原生插件（node-gyp / N-API）

**原理**：原生 addon 建 kCGEventTapOptionDefault 的 event tap，拦截 Caps Lock
keydown 并转换为 ✦ 修饰标记，可完全对齐 Raycast（含按应用生效、Quick Press 精确
时序、不污染系统配置）。

**优点**：行为上限最高；不改变系统全局配置；可做 Secure Input 兼容。
**缺点**：需要原生编译链（electron-rebuild + CI 双架构产物）、事件回调进 Node 的
延迟抖动、维护成本高；「复刻」收益边际——Raycast 的体验差异主要在打磨而非机制。

## 结论

**第一期走方案 A**：设置页加「Hyper Key（实验）」开关，启用即应用 hidutil 映射
（Caps Lock → F18）+ uiohook 监听组合 + 单按可选（无操作 / 退出键 / 真 Caps），
关闭即 clear 映射并注销监听；键位诊断（F18 是否可达 / Karabiner 检测）先以
「权限诊断」页同款思路做最小版。方案 B 作为二期演进项，只有当 A 的用户反馈
（键盘兼容性 / 延迟）不达标时再启动。

**实施前提**：键盘重映射直接影响用户输入，必须用户在场逐项验收（启用/停用即时性、
单按时序、多键盘场景），故本批次只产出本评审，不落代码。
