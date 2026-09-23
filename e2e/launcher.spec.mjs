import { test } from 'playwright/test'

/**
 * 这个 spec 的原件已经没了：基线提交（8446ff2，事故后重建的快照）里它就只有
 * 一行 —— 而且那一行是某次会话把**工具回执**当成文件内容写了进来
 * （原文是「Wasted call — file unchanged since your last Read…」）。
 * 全盘（reconstructed/e2e、_recovery-* 各池、git 历史）都没有第二个副本，
 * 所以没有可回灌的东西：宁可留一条显式 skip，也不写一份看起来通过、
 * 其实没测任何东西的替身规格。
 *
 * 目前启动器链路由同目录的 capsule-*.spec.mjs / command-palette.spec.mjs /
 * plugin-arg-slots.spec.mjs 覆盖；本文件该补回什么，等对着 Raycast 逐项验收时再定。
 */
test.skip('launcher.spec 原件丢失（事故恢复期被工具回执覆盖，无副本可回灌）', () => {})
