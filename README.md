# Nexos.ai OpenAI 兼容代理

将 nexos.ai 的 API 封装为标准的 OpenAI 兼容接口。

## ✅ 功能状态

- ✅ `/v1/models` - 获取可用模型列表
- ✅ `/v1/chat/completions` - 聊天补全接口（支持流式和非流式）
- ✅ `/v1/chat/create` - 创建新对话
- ✅ `/v1/files/:chatId/:fileId/download` - 图片代理下载
- ✅ 自动获取对话历史，支持连续对话
- ✅ SSE 流式响应解析
- ✅ 自动替换图片链接为代理 URL

## 安装

```bash
npm install
```

## 配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置 Cookies：

从浏览器获取 Cookies 的步骤：
- 打开 https://workspace.nexos.ai
- 按 F12 打开开发者工具
- 切换到 Network 标签
- 发送一条消息
- 找到 chat 请求，复制 Request Headers 中的 Cookie 值
- 粘贴到 `.env` 文件中

```env
NEXOS_COOKIES=你的完整cookie字符串
```

3. 启动服务器并创建第一个对话：
```bash
npm start
```

然后调用：
```bash
curl -X POST http://localhost:3000/v1/chat/create
```

这会创建一个新对话并自动设置为当前活动对话。

## 运行

```bash
npm start
```

服务将在 http://0.0.0.0:3000 启动

## 使用示例

### 创建新对话（自动切换）

```bash
curl -X POST http://localhost:3000/v1/chat/create
```

响应示例：
```json
{
  "success": true,
  "chatId": "97c4cf66-a608-42bc-a69e-80bca69b83d5",
  "url": "https://workspace.nexos.ai/chat/97c4cf66-a608-42bc-a69e-80bca69b83d5",
  "currentChat": true,
  "message": "New chat created and set as current: 97c4cf66-a608-42bc-a69e-80bca69b83d5"
}
```

创建后，新对话会自动成为当前活动对话，后续所有请求都会使用这个新对话。

### 查看当前对话

```bash
curl http://localhost:3000/v1/chat/current
```

### 切换到已有对话

```bash
curl -X POST http://localhost:3000/v1/chat/switch \
  -H "Content-Type: application/json" \
  -d '{"chatId": "另一个chat-id"}'
```

### 获取模型列表

```bash
curl http://localhost:3000/v1/models
```

### 聊天补全（非流式）

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "temperature": 1,
    "max_tokens": 2000
  }'
```

### 聊天补全（使用指定的 Chat ID）

方法 1：通过 HTTP Header 指定
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Nexos-Chat-Id: 97c4cf66-a608-42bc-a69e-80bca69b83d5" \
  -d '{
    "model": "claude-opus-4-6",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

方法 2：通过请求 Body 指定
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "chat_id": "97c4cf66-a608-42bc-a69e-80bca69b83d5",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

### 聊天补全（流式）

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true
  }'
```

## 与 OpenAI SDK 集成

### 基本用法（使用 .env 中的默认 Chat ID）

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key' // 可以是任意值
});

const response = await client.chat.completions.create({
  model: 'claude-opus-4-6',
  messages: [{ role: 'user', content: '你好' }]
});

console.log(response.choices[0].message.content);
```

### 使用指定的 Chat ID

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy-key',
  defaultHeaders: {
    'X-Nexos-Chat-Id': '97c4cf66-a608-42bc-a69e-80bca69b83d5'
  }
});

const response = await client.chat.completions.create({
  model: 'claude-opus-4-6',
  messages: [{ role: 'user', content: '你好' }]
});

console.log(response.choices[0].message.content);
```

## 支持的模型

- Claude 系列：claude-haiku-4-5, claude-opus-4-5, claude-opus-4-6, claude-sonnet-4-5, claude-sonnet-4-6
- Gemini 系列：gemini-2-5-flash, gemini-2-5-pro, gemini-3-flash-preview, gemini-3-pro-preview
- GPT 系列：gpt-5, gpt-5-1, gpt-5-2
- Grok 系列：grok-4-fast, grok-4-fast-reasoning, grok-4-1-fast, grok-code-fast-1
- Mistral 系列：mistral-large-3, mistral-medium-3, mistral-medium-3-1

## 注意事项

- **首次使用必须创建对话**：启动服务器后，先调用 `POST /v1/chat/create` 创建第一个对话
- **Chat ID 自动管理**：Chat ID 保存在 `current-chat.json` 文件中，无需手动配置
- **对话会同步到网页**：通过 API 发送的消息会出现在 nexos.ai 网页的对话中，因为使用的是真实的对话 ID
- **禁用历史记录**：如果不想形成连续对话，可以在 `.env` 中设置 `DISABLE_HISTORY=true`，或在请求中添加 `"disable_history": true`
- **支持动态 Chat ID**：可以通过 HTTP Header `X-Nexos-Chat-Id` 或请求 Body 中的 `chat_id` 字段指定不同的对话
- **优先级**：Header > Body > current-chat.json
- 需要有效的 nexos.ai cookies 才能正常工作
- cookies 可能会过期，需要定期更新
- 每次请求会自动获取最新的对话历史，支持连续对话（除非禁用）
- 响应格式已转换为标准的 OpenAI 格式
- 图片链接会自动替换为代理 URL，确保客户端可以正常访问
- Gemini 模型的 max_tokens 会自动调整为 65536（其限制）

## 多对话管理

代理服务器支持完整的多对话管理功能：

### 关于对话同步

**重要说明**：通过 API 发送的消息会出现在 nexos.ai 网页上，因为我们使用的是真实的 nexos.ai 对话 ID。

这意味着：
- ✅ 你可以在网页上查看 API 的对话历史
- ✅ 支持连续对话，AI 会记住上下文
- ⚠️ API 的对话会和网页的对话混在一起

**如果你不想在网页上看到 API 的对话：**

1. **方案 1：使用专门的对话**
   - 创建一个专门用于 API 的对话
   - 不在网页上打开这个对话
   
2. **方案 2：禁用历史记录**
   - 在 `.env` 中设置 `DISABLE_HISTORY=true`
   - 或在每个请求中添加 `"disable_history": true`
   - 这样每次都是"新对话"，不会形成连续对话

### 工作原理

1. **当前活动对话**：服务器维护一个"当前活动对话"的概念，存储在 `current-chat.json` 文件中
2. **自动切换**：调用 `POST /v1/chat/create` 创建新对话时，会自动切换到新对话
3. **无需重启**：切换对话不需要重启服务器
4. **持久化**：当前对话 ID 保存在文件中，重启服务器后仍然有效
5. **无需 .env 配置**：Chat ID 完全由 `current-chat.json` 管理，不需要在 `.env` 中配置

### 使用流程

1. **创建新对话**：
   ```bash
   curl -X POST http://localhost:3000/v1/chat/create
   ```
   新对话会自动成为当前活动对话

2. **开始聊天**：
   ```bash
   curl http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "claude-opus-4-6", "messages": [{"role": "user", "content": "你好"}]}'
   ```
   会使用当前活动对话

3. **切换到其他对话**：
   ```bash
   curl -X POST http://localhost:3000/v1/chat/switch \
     -H "Content-Type: application/json" \
     -d '{"chatId": "另一个chat-id"}'
   ```

4. **查看当前对话**：
   ```bash
   curl http://localhost:3000/v1/chat/current
   ```

### 优先级

Chat ID 的选择优先级：
1. HTTP Header `X-Nexos-Chat-Id`（最高优先级）
2. 请求 Body 中的 `chat_id` 字段
3. 当前活动对话（`current-chat.json`）（最低优先级）

如果以上都没有，会返回错误提示需要先创建对话。

## 测试

测试历史记录 API：
```bash
node test-history.js
```
