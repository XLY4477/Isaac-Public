Safari 离线 Web App
===================

此目录是以撒永恒版的独立 Safari Web App 包，目标是 iPhone 横屏，通过 Safari“添加到主屏幕”运行。游戏 SWF、Ruffle WebAssembly、网页 UI 与离线缓存均包含在包内。不会自动上传任何文件。

本地预览
--------
Windows 安装 Node.js 后，在此目录运行 node .\scripts\serve.mjs，然后在本机浏览器打开 http://localhost:8765。预览服务器仅监听本机回环地址；localhost 可用于桌面检查，iPhone 的 Safari 主屏幕安装和 Service Worker 离线功能需要 HTTPS 地址。

隐私与资源
----------
游戏 SWF、Ruffle、图标与网页代码均由本地网页包提供。网页没有哔哩哔哩地址、音视频外链、分析统计或上传接口；不需要 PotPlayer，也不会把游戏资源发送给媒体服务。实际部署时只上传运行所需文件。

iPhone 安装
-----------
1. 只发布网页运行必需文件：`index.html`、`app.js`、`style.css`、`sw.js`、`manifest.webmanifest`、`favicon.ico`、`icons/`、`public/` 和 `vendor/ruffle/`。不要把 `.build/`、`scripts/` 或项目的 `work/`、`outputs/` 一起发布；这些目录含构建/测试文件，不属于网页运行包。托管地址还需支持 `.wasm` 的 `application/wasm` MIME 类型。
2. 用 iPhone Safari 打开该地址，点“开始游戏”，等待游戏和 Ruffle 运行文件加载完成。
3. 用 Safari 分享菜单选择“添加到主屏幕”，之后从主屏幕图标启动。
4. 页面提示游戏和运行器缓存完成后，再断网验证。重要存档请定期导出 JSON 并另行备份。

网页存储按站点来源隔离；部署后不要随意更换域名、协议或子路径，否则浏览器会将其当成新站点，原站点存档和缓存不会自动迁移。

控制
----
触屏时左侧圆盘摇杆移动、右侧圆盘摇杆射击，可同时滑动；透明度和尺寸在右上角“设置”中调整。点击游戏 HUD 上的炸弹、卡牌/药丸、主动道具图标会分别调用原有 E、Q、空格操作，不另放一排动作键。道具辅助面板可从设置中打开，也可按 F1。键盘操作仍为 WASD、方向键、E、Q、空格和 F1；切出应用时会释放摇杆按键。

持久化说明
----------
游戏存档、成就解锁、收藏和语言使用 Flash SharedObject，经 Ruffle 保存到当前网页来源的浏览器存储；网页自身状态使用 IndexedDB。网页会申请持久化存储，但 iOS 不保证请求一定获准或缓存永不清理。页面提供存档导出/导入作为额外备份途径。

当前边界
--------
本地项目已完成静态网页包和桌面本地预览；尚未上传 HTTPS 主机，也尚未在真实 iPhone Safari 上验证。桌面浏览器测试通过不代表 iPhone 的触控、音频、存档与性能验收已通过。

游戏画面存在阻断问题：2026-10-16 在本地复现时，Ruffle 0.7.1 能显示角色和 HUD，但房间地板、墙体、石块等场景绘制缺失；更换官方 Ruffle 0.8.0 nightly 仍未恢复。SWF 本体资源齐全，运行请求也没有指向外部媒体服务。症状与 [Ruffle 的《The Binding of Isaac rocks and background not showing》问题](https://github.com/ruffle-rs/ruffle/issues/5522)一致。因此当前网页包不能作为完整可玩的版本交付；在房间背景、物件、门和切房都正常前，不应将其标记为完成。
