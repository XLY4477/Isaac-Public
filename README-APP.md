# Isaac — Safari Web App

面向 iPhone Safari 的完整网页运行包，使用普通《The Binding of Isaac: Wrath of the Lamb》版本，不是以撒永恒版。完整 SWF、离线 Ruffle 运行器、触控与设置界面均随仓库保存。

## iPhone 控件
- 横屏；左侧圆盘拖动控制 WASD 移动，右侧圆盘控制方向射击。
- 透明 HUD 热区：炸弹 E、卡牌/药丸 Q、主动道具空格。
- 设置可调透明度 0–85%；0% 时控件完全不可见，但触区仍工作。
- “按键位置编辑”打开网格布局页。可分别选移动、射击、炸弹、卡牌和主动道具，拖动或用方向微调位置，并独立调整大小与透明度（0% 完全不可见）；保存后写入本机 localStorage，离开不保存，恢复默认可一键还原。

## 隐私与离线边界
页面 CSP 将脚本、游戏文件和连接限制在当前来源；Ruffle 设置 `allowNetworking: "none"`，禁止 SWF 自己访问外网。没有统计、广告、上报、账号或上传代码。应用设置只写当前设备 localStorage；Service Worker 只缓存本站资源。升级时只清理 `isaac-reference-` 前缀的旧缓存，不触碰同域其他网页。

首次需要联网打开并等待游戏完整载入。Service Worker 会缓存页面、运行器、WebAssembly 与 SWF；之后可尝试断网打开。iOS 可能因存储压力回收网站缓存，需在目标手机验证。页面无远端脚本。Windows Defender 对源目录和输出包均报告“未发现威胁”，这不等同于绝对安全证明。

原始网页的 jsDelivr 脚本和 Google 文档链接未带入；没有执行原网页。游戏 SWF 是二进制，静态扫描不能证明它绝对无漏洞；运行器网络配置与 CSP 限制其网络访问。

## 启动
正式 iPhone Web App 需要可访问的 HTTPS 地址。Safari 打开地址后点“分享”→“添加到主屏幕”→开启“作为 Web App 打开”→“添加”。先在线打开一次，等游戏载入完成，再开飞行模式验证缓存。当前浏览器里的 localhost 只供这台电脑测试，手机不能直接访问电脑的 localhost。



## 屏幕旋转
主屏幕清单使用 orientation: any；页面布局监听尺寸与方向变化，并按可用安全区重新排版。横屏为主要游戏布局，竖屏时提示旋转。旋转锁定若由 iPhone 系统设置开启，网页不能替用户解除。


