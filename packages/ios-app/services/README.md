# iPad 模拟器形象预览服务

启动：在仓库根目录执行 `.venv/bin/python packages/ios-app/services/avatar_server.py`。
使用既有 SystemEdu 配置中的 DashScope key，服务端固定调用 `wan2.6-image`，只监听 `127.0.0.1:8769`。
密钥不写入 App、仓库或日志。模型接口依据 [万相 2.6 官方图像编辑文档](https://help.aliyun.com/zh/model-studio/wan-image-generation-api-reference)。

- App 先用系统相机拍摄或 PhotosPicker 在本机读取照片并重编码，用户点击生成才上传。姓名和角色不发送给模型。
- 服务再次验证图片大小、像素数和格式，剥离元数据；不落盘原图。每次仅生成一张。
- 请求 ID 去重，单并发，禁止跨站 Origin；结果只保留在内存，15 分钟后访问失效。App 成功、失败或取消均请求删除缓存。关闭服务也会清空缓存。
- 只向固定供应商发送请求，结果下载限定 HTTPS 的 aliyuncs.com 子域，不跟随重定向。不接受用户提供的 URL、提示词或模型参数。
- 本机策略不等于供应商的保留策略，产品提示已区分。
- 无照片也能使用内置卡通队员；替换或取消形象不改学习记录。

这是 **Debug + Simulator 的本机预览适配器**。真机与 Release 不调用本机服务；生产使用仍需有身份验证、配额、部署与数据处理策略的 HTTPS 后端。没有生产部署或跨设备同步。

自动检查：`.venv/bin/python -m unittest discover -s packages/ios-app/services -p 'test_*.py'`。
Swift 的 `testLiveAvatarAdapterWithSyntheticBundledFixture` 需显式设置 `SYSTEMEDU_LIVE_AVATAR_TEST=1` 才调用真实服务；使用仓库已有的合成人物素材，不使用学生照片。照片选择器与生成结果需继续进行真实用户体验验证。
