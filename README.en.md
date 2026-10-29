# K7-Translate · [中文](README.md)

K7-Translate is a local-model translation extension for Microsoft Edge and Google Chrome. It automatically translates selected text and can turn webpage content into a switchable bilingual view. The default model is [Index-Translate-2B](https://github.com/bilibili/Index-Translate), running locally through llama.cpp. Both browsers use the same Manifest V3 build output.

## Features

- Automatic translation of selected text, with target-language switching, copying, and retrying.
- Content-first full-page translation, with original / bilingual / translated view switching and restoration.
- Automatic source-language detection, with Simplified Chinese as the default target language.
- Configurable model and OpenAI-compatible service endpoints; translation features are not tied to a specific model.
- Two ways to run the model: natively on macOS with Metal, or through Docker.
- Original and translated text are never written to extension storage; only a short-lived in-memory cache is retained.

## Architecture

```text
Selection / Full-page Content Script
          │ Extension Message
          ▼
MV3 Background Service Worker
          │
          ▼
TranslationService
  Timeout / Cancellation / Deduplication Cache / Error Normalization
          │
          ▼
ProviderFactory → TranslationProvider
          │
          ▼
IndexTranslateProvider
  ├─ Index-Translate Prompt
  └─ OpenAICompatibleClient
          │
          ▼
llama-server + Index-Translate-2B GGUF
```

## Quick Start

### 1. Start the Model

Choose one of the following methods. The first launch downloads a Q4_K_M model with approximately 2B parameters; subsequent launches reuse the local cache.

#### Native macOS (Recommended, Metal Support)

```bash
./scripts/setup-macos.sh --port 8000
```

The script installs a pinned version of llama.cpp, downloads the model, checks the port, and starts the service. Keep the terminal running after you see “Model service is ready,” and press `Ctrl+C` to stop it.

The official llama.cpp installer uses `hf-mirror.com` by default, while the model is downloaded from IndexTeam's official ModelScope mirror. You can use environment variables to switch to other sources:

```bash
LLAMA_INSTALL_REPO="https://huggingface.co/buckets/ggml-org/install.sh/resolve" \
MODEL_BASE_URL="https://huggingface.co" \
./scripts/setup-macos.sh --port 8000
```

#### macOS / Linux Docker (CPU)

```bash
K7_TRANS_PORT=8000 docker compose up --build -d
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f model
```

Stop the service:

```bash
docker compose down
```

The model is stored in the `k7-models` volume, so normal stops and restarts do not download it again. The cache is deleted only when you explicitly run `docker compose down -v`. Docker on macOS cannot use native Metal acceleration; use the native script for better performance.

### 2. Verify the Model Service

```bash
curl http://127.0.0.1:8000/v1/models

curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Index-Translate-2B",
    "messages": [{"role": "user", "content": "Please translate the following text into Simplified Chinese. Output only the translation without any explanation.\n\nHello, world."}],
    "temperature": 0,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

### 3. Install the Edge / Chrome Extension

```bash
pnpm install
pnpm build
```

Edge and Chrome use the same `dist/` directory; no separate builds are required.

1. Open `edge://extensions` in Edge or `chrome://extensions` in Chrome.
2. Enable “Developer mode.”
3. Click “Load unpacked” and select this project's `dist/` directory.
4. Open the extension settings and confirm that Base URL is `http://127.0.0.1:8000/v1` and the model name is `Index-Translate-2B`.
5. Click “Save and test a real translation.” Once it succeeds, you can use the extension on regular HTTP/HTTPS pages.

If the model uses a different port, such as `8123`, change the extension's Base URL to `http://127.0.0.1:8123/v1`.

## Usage

- **Selected text**: Select 2–4000 characters and wait a moment for the translation overlay to appear. Input fields and editable areas do not trigger it automatically.
- **Full-page translation**: Click the K7 icon in the toolbar, then click “Translate page content.” You can keep reading while content is translated paragraph by paragraph.
- **Display modes**: Switch between original, bilingual, and translated views in the extension popup. Click “Restore original page” to cancel the current page task and remove translations.
- **Settings**: Configure the model endpoint, model name, API key, prompt, default target language, timeout, and full-page translation concurrency.

Content scripts are not supported on protected pages such as `edge://`, `chrome://`, extension stores, and standalone PDF viewers.

## Using a Different Model

### Another OpenAI-Compatible Service

Change the following in the extension settings:

- `Base URL`: The service URL, including `/v1`.
- `Model name`: The model ID exposed by the service.
- `Prompt preset`: Use `Index-Translate` for Index-Translate; try `General Translation` for other models.
- `API Key`: Required only if the service needs one.

No changes to the selected-text or full-page translation code are required.

### Another Local GGUF Model

Both native and Docker launch methods support the following environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL_REPO` | `IndexTeam/Index-Translate-2B-GGUF` | Model repository |
| `MODEL_REVISION` | `master` | Model branch or revision |
| `MODEL_FILE` | `Index-Translate-2B.Q4_K_M.gguf` | GGUF filename |
| `MODEL_ALIAS` | `Index-Translate-2B` | Model ID in the API |
| `MODEL_BASE_URL` | `https://modelscope.cn/models` | Download source |
| `CONTEXT_SIZE` | `8192` | Context length |

For example:

```bash
MODEL_REPO="your-org/your-model-GGUF" \
MODEL_FILE="your-model.Q4_K_M.gguf" \
MODEL_ALIAS="your-model" \
./scripts/setup-macos.sh --port 8000
```

The replacement model must be supported by the pinned llama.cpp version. Models not designed specifically for translation may require prompt adjustments, and translation quality depends on the model's capabilities.

### Non-OpenAI-Compatible Protocols

1. Implement a new provider based on `src/core/translation/TranslationProvider.ts`.
2. Keep protocol conversion inside the provider, preserving the unified request and response structures.
3. Register the provider type in `src/providers/ProviderFactory.ts`.

Do not call model-specific SDKs directly from content scripts; both `TranslationService` and the UI depend only on the shared abstraction.

## Development

```bash
pnpm dev        # Extension development build with hot reload
pnpm typecheck  # TypeScript checks
pnpm build      # Output to dist/
```

Main directories:

```text
src/background/       MV3 message routing
src/content/          Selection overlay and full-page translation
src/core/translation/ Shared contracts and application services
src/providers/        Model adapters and factory
src/popup/            Toolbar popup
src/options/          Settings page
scripts/              Native and Docker launch scripts
```

## Troubleshooting

- **Cannot connect to the service**: Make sure the terminal or container is still running and the ports match, then visit `http://127.0.0.1:PORT/health`.
- **Port already in use**: Use `--port 8123` for native mode or `K7_TRANS_PORT=8123 docker compose up --build -d` for Docker, and update the extension settings accordingly.
- **The model returns empty content or thinking tags**: Confirm that the Index-Translate prompt is selected and thinking is disabled in the request.
- **Full-page translation is slow**: Local models need time to process each paragraph. The default concurrency is 2 and can be adjusted to 1–4 in settings. Higher concurrency increases memory and compute usage.
- **Interrupted downloads**: Run the same command again to reuse downloaded files. If a `.part` file is corrupted, delete the corresponding file in `.runtime/models` or the Docker volume and retry.
- **Features break after an extension update**: Run `pnpm build` again, then click the extension's reload button in `edge://extensions` or `chrome://extensions`.

## Current Limitations

- Full-page translations use safe plain-text rendering; preserving complex inline links and rich-text formatting still needs improvement.
- On long pages with dynamically loaded content, run full-page translation again after new content appears.
- Streaming output, image/audio translation, glossaries, and browser sync are not yet supported.
- Model weights and their terms of use follow the Index-Translate license; K7-Translate code is licensed under the MPL-2.0 included in this repository.

## TODO

- [ ] One-click installation and launch scripts for Windows.
- [ ] Improved complex inline formatting, dynamic pages, and streaming translation.
- [ ] More providers and Firefox support.
- [ ] Publication on the Edge and Chrome extension stores.
