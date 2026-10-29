# K7-Translate

K7-Translate 是一个面向 Microsoft Edge 的本地模型翻译扩展。选中文本后自动翻译，也可以将网页正文转为可切换的双语对照。默认模型为 [Index-Translate-2B](https://github.com/bilibili/Index-Translate)，通过 llama.cpp 在本机运行。

## 功能

- 选中文本自动翻译，支持目标语言切换、复制和重试。
- 正文优先的整页翻译，支持原文 / 双语 / 译文切换及恢复。
- 源语言自动识别，默认翻译为简体中文。
- 模型与 OpenAI 兼容服务地址可配置，翻译业务不依赖具体模型。
- macOS 原生 Metal 启动和 Docker 启动两种运行方式。
- 原文和译文不写入扩展存储，只保留短期内存缓存。

## 架构

```text
选文 / 整页 Content Script
          │ Extension Message
          ▼
MV3 Background Service Worker
          │
          ▼
TranslationService
  超时 / 取消 / 去重缓存 / 错误归一化
          │
          ▼
ProviderFactory → TranslationProvider
          │
          ▼
IndexTranslateProvider
  ├─ Index-Translate 提示词
  └─ OpenAICompatibleClient
          │
          ▼
llama-server + Index-Translate-2B GGUF
```

## 快速开始

### 1. 启动模型

选择以下一种方式。首次启动需要下载约 2B 参数的 Q4_K_M 模型，之后复用本地缓存。

#### macOS 原生（推荐，支持 Metal）

```bash
./scripts/setup-macos.sh --port 8000
```

脚本会安装固定版本的 llama.cpp、下载模型、检查端口并启动服务。看到“模型服务已就绪”后保持终端运行，按 `Ctrl+C` 停止。

官方 llama.cpp 安装包默认通过 `hf-mirror.com` 获取，模型默认从 IndexTeam 的 ModelScope 官方镜像获取。可以通过环境变量改用其他源：

```bash
LLAMA_INSTALL_REPO="https://huggingface.co/buckets/ggml-org/install.sh/resolve" \
MODEL_BASE_URL="https://huggingface.co" \
./scripts/setup-macos.sh --port 8000
```

#### macOS / Linux Docker（CPU）

```bash
K7_TRANS_PORT=8000 docker compose up --build -d
```

查看状态和日志：

```bash
docker compose ps
docker compose logs -f model
```

停止服务：

```bash
docker compose down
```

模型保存在 `k7-models` volume 中，普通停止和重启不会重复下载。只有主动执行 `docker compose down -v` 才会删除该缓存。macOS Docker 无法使用原生 Metal 加速，追求速度时优先使用原生脚本。

### 2. 验证模型服务

```bash
curl http://127.0.0.1:8000/v1/models

curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Index-Translate-2B",
    "messages": [{"role": "user", "content": "请将以下文本翻译为简体中文，直接输出翻译结果，不要进行任何解释。\n\nHello, world."}],
    "temperature": 0,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

### 3. 安装 Edge 扩展

```bash
pnpm install
pnpm build
```

1. 在 Edge 打开 `edge://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”，选择本项目的 `dist/` 目录。
4. 打开扩展设置，确认 Base URL 为 `http://127.0.0.1:8000/v1`，模型名为 `Index-Translate-2B`。
5. 点击“保存并测试真实翻译”。成功后即可在普通 HTTP/HTTPS 页面使用。

如果模型使用了其他端口，例如 `8123`，扩展 Base URL 应改为 `http://127.0.0.1:8123/v1`。

## 使用

- **选文翻译**：选中 2–4000 个字符的文本，稍等片刻后浮层会自动出现。输入框和可编辑区域不会自动触发。
- **整页翻译**：点击工具栏中的 K7 图标，再点击“翻译本页正文”。正文逐段翻译时仍可继续阅读。
- **显示模式**：在扩展弹窗中切换原文、双语或译文；点击“恢复原始页面”可取消当前页面任务并移除译文。
- **设置**：可配置模型端点、模型名、API Key、提示词、默认目标语言、超时和整页并发数。

`edge://`、扩展商店、独立 PDF 查看器等受保护页面不支持内容脚本。

## 替换模型

### 另一个 OpenAI 兼容服务

在扩展设置中修改：

- `Base URL`：服务地址，包含 `/v1`。
- `模型名称`：服务暴露的模型 ID。
- `提示词预设`：Index-Translate 使用 `Index-Translate`，其他模型可尝试 `通用翻译`。
- `API Key`：仅当服务需要时填写。

选文和整页代码不需要修改。

### 另一个本地 GGUF 模型

原生和 Docker 启动均支持以下环境变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `MODEL_REPO` | `IndexTeam/Index-Translate-2B-GGUF` | 模型仓库 |
| `MODEL_REVISION` | `master` | 模型分支或版本 |
| `MODEL_FILE` | `Index-Translate-2B.Q4_K_M.gguf` | GGUF 文件名 |
| `MODEL_ALIAS` | `Index-Translate-2B` | API 中的模型 ID |
| `MODEL_BASE_URL` | `https://modelscope.cn/models` | 下载源 |
| `CONTEXT_SIZE` | `8192` | 上下文长度 |

例如：

```bash
MODEL_REPO="your-org/your-model-GGUF" \
MODEL_FILE="your-model.Q4_K_M.gguf" \
MODEL_ALIAS="your-model" \
./scripts/setup-macos.sh --port 8000
```

替换模型必须受固定版本的 llama.cpp 支持。非翻译专用模型可能需要调整提示词，翻译质量由模型自身能力决定。

### 非 OpenAI 兼容协议

1. 在 `src/core/translation/TranslationProvider.ts` 基础上实现新的 provider。
2. 将协议转换放在 provider 内，保持统一的请求和响应结构。
3. 在 `src/providers/ProviderFactory.ts` 注册 provider 类型。

不要从 content script 直接调用模型专属 SDK；`TranslationService` 和 UI 都只依赖统一抽象。

## 开发

```bash
pnpm dev        # 扩展开发构建与热更新
pnpm typecheck  # TypeScript 检查
pnpm build      # 输出 dist/
```

主要目录：

```text
src/background/       MV3 消息路由
src/content/          选文浮层与整页翻译
src/core/translation/ 统一契约和应用服务
src/providers/        模型适配器与工厂
src/popup/            工具栏弹窗
src/options/          设置页
scripts/              原生与 Docker 启动脚本
```

## 故障排查

- **无法连接服务**：确认终端或容器仍在运行，检查端口是否一致，然后访问 `http://127.0.0.1:端口/health`。
- **端口被占用**：原生使用 `--port 8123`，Docker 使用 `K7_TRANS_PORT=8123 docker compose up --build -d`，并同步修改扩展设置。
- **模型返回空内容或思考标签**：确认使用 Index-Translate 提示词，且请求关闭了 thinking。
- **整页翻译较慢**：本地模型按段推理需要时间；默认并发为 2，可在设置中调整为 1–4。提高并发会增加内存和计算压力。
- **下载中断**：重新执行相同命令即可复用已下载文件。若 `.part` 文件损坏，可删除 `.runtime/models` 中对应文件或 Docker volume 后重试。
- **扩展更新后功能异常**：重新运行 `pnpm build`，然后在 `edge://extensions` 中点击扩展的刷新按钮。

## 当前边界

- 整页译文使用安全纯文本渲染；复杂内联链接和富文本格式保留仍需增强。
- 动态加载的长页面可在内容出现后重新执行整页翻译。
- 暂不支持流式输出、图片/音频翻译、术语表和浏览器同步。
- 模型权重及其使用条件遵循 Index-Translate 自身许可；K7-Translate 代码遵循仓库中的 MPL-2.0。

## TODO

- Windows 一键安装与启动脚本。
- 复杂内联格式、动态页面和流式翻译增强。
- 更多 provider 与 Firefox 适配。
- Edge 扩展商店发布。
