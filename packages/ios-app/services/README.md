# iPad 模拟器形象预览服务

启动：在仓库根目录执行 `.venv/bin/python packages/ios-app/services/avatar_server.py`。
使用既有 SystemEdu 配置中的 DashScope key，服务端固定调用 `wan2.6-image`，只监听 `127.0.0.1:8769`。
密钥不写入 App、仓库或日志。模型接口依据 [万相 2.6 官方图像编辑文档](https://help.aliyun.com/zh/model-studio/wan-image-generation-api-reference)。

- App 先拍摄或通过 PhotosPicker 在本机读取照片并重编码，用户点击生成才上传。姓名和角色不发送给模型。
- 服务再次验证图片大小、像素数和格式，剥离元数据；不落盘原图。每次仅生成一张。
- 请求 ID 去重，单并发，禁止跨站 Origin；结果只保留在内存，15 分钟后访问失效。App 成功、失败或取消均请求删除缓存。关闭服务也会清空缓存。
- 只向固定供应商发送请求，结果下载限定 HTTPS 的 aliyuncs.com 子域，不跟随重定向。不接受用户提供的 URL、提示词或模型参数。
- 本机策略不等于供应商的保留策略，产品提示已区分。
- 无照片也能使用内置卡通队员；替换或取消形象不改学习记录。

这是 **Debug + Simulator 的本机预览适配器**。真机与 Release 不调用本机服务；生产使用仍需有身份验证、配额、部署与数据处理策略的 HTTPS 后端。没有生产部署或跨设备同步。

自动检查：`.venv/bin/python -m unittest discover -s packages/ios-app/services -p 'test_*.py'`。
Swift 的 `testLiveAvatarAdapterWithSyntheticBundledFixture` 需显式设置 `SYSTEMEDU_LIVE_AVATAR_TEST=1` 才调用真实服务；使用仓库已有的合成人物素材，不使用学生照片。

## Mac 摄像头用于模拟器

1. 启动上面的服务，保持终端运行。
2. 在 Debug iPad 模拟器的队员登记页点击「拍一张」。Mac 默认浏览器会打开本机相机页。
3. 点击「连接 Mac 摄像头」，按浏览器与 macOS 的提示允许摄像头；不申请麦克风。
4. 回到模拟器取景并点击「拍照」。回到登记页查看原照，确认后点击「将照片生成动画形象」。

照片选择器读取模拟器自己的图库；导入 Mac 照片参见[App README](../README.md)。原生模拟器相机不等于 Mac 摄像头透传，本实现采用仅在 Debug Simulator 编译的本机桥接。真实 iPad 和 Release 仍使用系统相机。

`/camera` 静态页面与 JPEG 中转共用 loopback 服务。模拟器创建临时读取凭据，浏览器通过 URL fragment 获得独立的写入凭据，加载后清除地址栏 fragment。页面不能读取缓存帧；请求校验 Host、Origin、凭据和图片内容。只允许固定静态文件，不开放文件系统路径、跨站请求或音频采集。

每次只允许一个连接，画面仅在内存中保留最新一帧；超过 3 秒没有更新就不再返回画面。10 秒收不到模拟器轮询或连接总长超过 3 分钟时销毁会话。拍照、取消、页面关闭、停止按钮会请求销毁；浏览器检测断开后停止视频轨道。后台计时器可能被浏览器延迟，拍完可直接关闭浏览器页。原照不落盘，不自动调用图像生成接口。

浏览器测试使用 Chromium 的合成视频设备，不会开启真实摄像头：

```sh
node packages/ios-app/scripts/verify-mac-camera.mjs
```

原生 UI 集成测试 `testMacCameraCaptureAndCancel` 需要先运行合成图像服务：

```sh
.venv/bin/python packages/ios-app/services/camera_test_server.py --mode native --port 8879
```

`testImportedSimulatorPhotoCanBeSelected` 需要先把仓库中的 `packages/student-web/public/mission/space/expedition-v2/crew/observer.png` 导入测试模拟器。测试只选取照片到本机预览，不点击生成。真实 Mac 摄像头仍需使用者完成系统授权并检查实际取景；合成测试通过不代表硬件拍摄已验收。
