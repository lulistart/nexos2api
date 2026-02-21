import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import config from './config.js';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config();

const app = express();
app.use(express.json());

// 当前 Chat ID 文件路径
const CURRENT_CHAT_FILE = './current-chat.json';

// 读取当前 Chat ID
function getCurrentChatId() {
  try {
    if (fs.existsSync(CURRENT_CHAT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CURRENT_CHAT_FILE, 'utf8'));
      if (data.chatId) {
        return data.chatId;
      }
    }
  } catch (error) {
    console.warn('Failed to read current chat ID:', error.message);
  }
  // 如果文件不存在或读取失败，使用 .env 配置
  return config.nexos.chatId;
}

// 保存当前 Chat ID
function setCurrentChatId(chatId) {
  try {
    fs.writeFileSync(CURRENT_CHAT_FILE, JSON.stringify({ chatId }, null, 2));
    console.log(`✓ Current chat ID updated to: ${chatId}`);
    return true;
  } catch (error) {
    console.error('Failed to save current chat ID:', error.message);
    return false;
  }
}

// v1/models 接口
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: config.models
  });
});

// 图片代理接口
app.get('/v1/files/:chatId/:fileId/download', async (req, res) => {
  try {
    const { chatId, fileId } = req.params;
    console.log(`\n=== File download request ===`);
    console.log(`Chat ID: ${chatId}, File ID: ${fileId}`);
    
    // 获取 cookies
    let cookies = process.env.NEXOS_COOKIES || config.nexos.cookies;
    if (!cookies) {
      console.error('NEXOS_COOKIES not configured');
      return res.status(500).json({ 
        error: 'NEXOS_COOKIES not configured in .env file' 
      });
    }
    cookies = cookies.replace(/[\r\n]/g, '').trim();
    
    // 构建 nexos.ai 文件下载 URL
    const fileUrl = `${config.nexos.baseUrl}/api/chat/${chatId}/files/${fileId}/download`;
    console.log(`Downloading from: ${fileUrl}`);
    
    // 请求文件
    const response = await axios.get(fileUrl, {
      headers: {
        'accept': '*/*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'referer': `${config.nexos.baseUrl}/chat/${chatId}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'cookie': cookies
      },
      responseType: 'stream'
    });
    
    // 转发响应头
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-disposition']) {
      res.setHeader('Content-Disposition', response.headers['content-disposition']);
    }
    
    // 流式传输文件
    response.data.pipe(res);
    
    console.log('File download successful');
  } catch (error) {
    console.error('\n=== File download error ===');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    res.status(error.response?.status || 500).json({
      error: {
        message: error.message,
        type: 'file_download_error'
      }
    });
  }
});

// v1/chat/completions 接口
app.post('/v1/chat/completions', async (req, res) => {
  try {
    console.log('\n=== New chat request ===');
    const { messages, model, temperature = 1, max_tokens = 128000, stream = false } = req.body;
    console.log('Messages:', JSON.stringify(messages, null, 2));
    
    // 支持通过 header 或 body 指定 chat ID，否则使用当前活动的 chat ID
    const chatId = req.headers['x-nexos-chat-id'] || req.body.chat_id || getCurrentChatId();
    console.log('Using Chat ID:', chatId);
    
    // 提取最后一条用户消息
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      console.error('No user message found');
      return res.status(400).json({ error: 'No user message found' });
    }
    console.log('User message:', lastUserMessage.content);

    // 获取 cookies 并清理
    let cookies = process.env.NEXOS_COOKIES || config.nexos.cookies;
    if (!cookies) {
      console.error('NEXOS_COOKIES not configured');
      return res.status(500).json({ 
        error: 'NEXOS_COOKIES not configured in .env file' 
      });
    }
    cookies = cookies.replace(/[\r\n]/g, '').trim();

    // 根据请求的模型获取对应的 handler ID
    const requestedModel = model || 'nexos-chat';
    let handlerId = config.modelMapping[requestedModel];
    
    if (!handlerId) {
      console.warn(`Model '${requestedModel}' not found in mapping, using default model`);
      handlerId = config.nexos.handlerId;
    }
    
    console.log('Requested model:', requestedModel);
    console.log('Using handler ID:', handlerId);

    // 根据模型调整 max_tokens（Gemini 模型最大支持 65536）
    let adjustedMaxTokens = max_tokens;
    const isGeminiModel = requestedModel.toLowerCase().includes('gemini');
    if (isGeminiModel && max_tokens > 65536) {
      adjustedMaxTokens = 65536;
      console.log(`Adjusted max_tokens from ${max_tokens} to ${adjustedMaxTokens} for Gemini model`);
    }
    console.log(`Final max_tokens to be used: ${adjustedMaxTokens}`);

    // 获取对话历史以获得最新消息 ID
    console.log('Fetching chat history...');
    let lastMessageId = null;
    
    // 检查是否禁用历史记录（通过环境变量或请求参数）
    const disableHistory = process.env.DISABLE_HISTORY === 'true' || req.body.disable_history === true;
    
    if (!disableHistory) {
      try {
        const historyResponse = await axios.get(
          `${config.nexos.baseUrl}/api/chat/${chatId}/history?offset=0`,
          {
            headers: {
              'accept': '*/*',
              'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'cache-control': 'no-cache',
              'content-type': 'application/json',
              'referer': `${config.nexos.baseUrl}/chat/${chatId}`,
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
              'cookie': cookies
            }
          }
        );
        
        // 从历史记录中获取最新消息 ID
        if (historyResponse.data && historyResponse.data.items && historyResponse.data.items.length > 0) {
          lastMessageId = historyResponse.data.items[0].id;
          console.log('Got last message ID:', lastMessageId);
        } else {
          console.log('No history items found');
        }
      } catch (historyError) {
        console.warn('Failed to fetch history, will try without last_message_id:', historyError.message);
      }
    } else {
      console.log('History disabled, starting fresh conversation');
    }

    // 构建 nexos.ai 请求 - 注意：不要给字符串加引号
    const formData = new FormData();
    formData.append('action', 'chat_completion');
    formData.append('chatId', chatId);
    
    const nexosData = {
      handler: {
        id: handlerId,  // 使用根据模型选择的 handler ID
        type: 'model',
        fallbacks: true
      },
      user_message: {
        text: lastUserMessage.content,
        client_metadata: {},
        files: []
      },
      advanced_parameters: {},  // 先创建空对象
      functionalityHeader: 'chat',
      tools: {
        web_search: { enabled: true },
        deep_research: { enabled: false },
        code_interpreter: { enabled: true }
      },
      enabled_integrations: []
    };

    // 只在有值时添加 advanced_parameters
    if (adjustedMaxTokens) {
      nexosData.advanced_parameters.max_completion_tokens = adjustedMaxTokens;
    }
    if (temperature !== undefined && temperature !== 1) {
      nexosData.advanced_parameters.temperature = temperature;
    }
    
    // 如果 advanced_parameters 为空，删除它
    if (Object.keys(nexosData.advanced_parameters).length === 0) {
      delete nexosData.advanced_parameters;
    }

    // 如果获取到了最新消息 ID，添加到请求中
    if (lastMessageId) {
      nexosData.chat = {
        last_message_id: lastMessageId
      };
    }
    
    formData.append('data', JSON.stringify(nexosData));
    console.log('Nexos data:', JSON.stringify(nexosData, null, 2));

    console.log('Cookie configured, length:', cookies.length);
    console.log('Sending request to:', `${config.nexos.baseUrl}/api/chat/${chatId}`);

    // 发送请求到 nexos.ai
    const response = await axios.post(
      `${config.nexos.baseUrl}/api/chat/${chatId}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'accept': '*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
          'origin': config.nexos.baseUrl,
          'referer': `${config.nexos.baseUrl}/chat/${chatId}`,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
          'cookie': cookies
        },
        responseType: stream ? 'stream' : 'json',
        validateStatus: () => true // 接受所有状态码
      }
    );

    console.log('Response status:', response.status);

    // 检查是否是流式请求
    console.log('Stream mode:', stream);

    // 读取响应数据
    let responseData = response.data;
    if (Buffer.isBuffer(responseData)) {
      responseData = responseData.toString('utf-8');
      console.log('Response data (from buffer):', responseData);
    } else if (typeof responseData === 'string') {
      console.log('Response data (string):', responseData);
    } else if (responseData && typeof responseData === 'object' && responseData.read) {
      // 如果是流，读取它
      const chunks = [];
      for await (const chunk of responseData) {
        chunks.push(chunk);
      }
      responseData = Buffer.concat(chunks).toString('utf-8');
      console.log('Response data (from stream):', responseData);
    } else {
      console.log('Response data (object):', responseData);
    }

    // 尝试解析 JSON
    let parsedData;
    try {
      parsedData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    } catch (e) {
      parsedData = responseData;
    }

    // 检查响应状态
    if (response.status !== 200) {
      console.error('Nexos API error:', response.status, response.statusText);
      console.error('Parsed error data:', parsedData);
      return res.status(response.status).json({
        error: {
          message: `Nexos API returned ${response.status}: ${response.statusText}`,
          type: 'nexos_api_error',
          details: parsedData
        }
      });
    }

    console.log('Success! Parsed data:', parsedData);
    console.log('About to process response, stream mode:', stream);

    if (stream) {
      // 流式响应 - 解析 SSE 并转换为 OpenAI 格式
      console.log('Processing as streaming response...');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 解析 nexos SSE 格式
      const lines = responseData.split('\n');
      let chunksSent = 0;
      let fileMapping = {}; // 存储文件名到 UUID 的映射
      let textBuffer = ''; // 缓冲文本以处理跨块的图片链接
      
      for (const line of lines) {
        // 提取工具结果中的文件信息
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const jsonData = JSON.parse(line.substring(6));
            
            // 从工具结果中提取文件映射
            if (jsonData.tool_result && jsonData.tool_result.result && jsonData.tool_result.result.results) {
              for (const result of jsonData.tool_result.result.results) {
                if (result.files && result.files.files) {
                  for (const file of result.files.files) {
                    if (file.name && file.file_uuid) {
                      fileMapping[file.name] = file.file_uuid;
                      console.log(`File mapping: ${file.name} -> ${file.file_uuid}`);
                    }
                  }
                }
              }
            }
            
            // content_type 在顶层，不在 content 对象内
            if (jsonData.content && jsonData.content.text && jsonData.content_type === 'text') {
              // 将文本添加到缓冲区
              textBuffer += jsonData.content.text;
              
              // 检查缓冲区是否包含完整的图片链接
              // 如果包含完整的图片链接或者不包含未完成的链接，则处理并发送
              const hasCompleteImageLink = /!\[([^\]]*)\]\(sandbox:\/mnt\/output-data\/[^)]+\)/.test(textBuffer);
              const hasIncompleteImageLink = /!\[([^\]]*)\]\(sandbox:\/mnt\/output-data\/[^)]*$/.test(textBuffer);
              
              if (hasCompleteImageLink || (!hasIncompleteImageLink && textBuffer.length > 0)) {
                // 替换 sandbox 格式的图片链接
                let processedText = textBuffer.replace(
                  /!\[([^\]]*)\]\(sandbox:\/mnt\/output-data\/([^)]+)\)/g,
                  (match, alt, filename) => {
                    const fileUuid = fileMapping[filename];
                    if (fileUuid) {
                      const proxyUrl = `http://${req.get('host') || `${config.server.host}:${config.server.port}`}/v1/files/${chatId}/${fileUuid}/download`;
                      console.log(`✓ Replaced image link: ${filename} -> ${proxyUrl}`);
                      return `![${alt}](${proxyUrl})`;
                    }
                    console.warn(`✗ No file UUID found for: ${filename}`);
                    return match;
                  }
                );
                
                // 替换直接的 nexos.ai 链接
                processedText = replaceImageLinks(
                  processedText, 
                  chatId,
                  req.get('host') || `${config.server.host}:${config.server.port}`
                );
                
                // 发送处理后的文本
                if (processedText) {
                  const openaiChunk = {
                    id: `chatcmpl-${generateMessageId()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model || 'nexos-chat',
                    choices: [{
                      index: 0,
                      delta: { content: processedText },
                      finish_reason: null
                    }]
                  };
                  res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
                  chunksSent++;
                }
                
                // 清空缓冲区
                textBuffer = '';
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      // 发送剩余的缓冲文本
      if (textBuffer.length > 0) {
        let processedText = textBuffer.replace(
          /!\[([^\]]*)\]\(sandbox:\/mnt\/output-data\/([^)]+)\)/g,
          (match, alt, filename) => {
            const fileUuid = fileMapping[filename];
            if (fileUuid) {
              const proxyUrl = `http://${req.get('host') || `${config.server.host}:${config.server.port}`}/v1/files/${chatId}/${fileUuid}/download`;
              console.log(`✓ Replaced image link (final): ${filename} -> ${proxyUrl}`);
              return `![${alt}](${proxyUrl})`;
            }
            return match;
          }
        );
        
        processedText = replaceImageLinks(
          processedText,
          chatId,
          req.get('host') || `${config.server.host}:${config.server.port}`
        );
        
        if (processedText) {
          const openaiChunk = {
            id: `chatcmpl-${generateMessageId()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model || 'nexos-chat',
            choices: [{
              index: 0,
              delta: { content: processedText },
              finish_reason: null
            }]
          };
          res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
          chunksSent++;
        }
      }
      
      console.log(`Sent ${chunksSent} chunks in streaming mode`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 非流式响应 - 提取所有文本内容
      const lines = responseData.split('\n');
      let fullText = '';
      let textChunks = 0;
      let thinkingChunks = 0;
      let allEvents = [];
      let fileMapping = {}; // 存储文件名到 UUID 的映射
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.substring(7).trim();
          allEvents.push(eventType);
        }
        
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const jsonData = JSON.parse(line.substring(6));
            
            // 从工具结果中提取文件映射
            if (jsonData.tool_result && jsonData.tool_result.result && jsonData.tool_result.result.results) {
              for (const result of jsonData.tool_result.result.results) {
                if (result.files && result.files.files) {
                  for (const file of result.files.files) {
                    if (file.name && file.file_uuid) {
                      fileMapping[file.name] = file.file_uuid;
                    }
                  }
                }
              }
            }
            
            // 记录所有数据结构用于调试
            if (jsonData.content) {
              console.log('Content structure:', JSON.stringify(jsonData.content, null, 2));
            }
            
            if (jsonData.content && jsonData.content.text !== undefined) {
              // content_type 在顶层，区分 thinking 和实际文本
              if (jsonData.content_type === 'text' && jsonData.content.text) {
                fullText += jsonData.content.text;
                textChunks++;
              } else if (jsonData.content.thinking) {
                thinkingChunks++;
              }
            }
            // 检查是否有错误
            if (jsonData.content && jsonData.content.error) {
              console.warn('Content error:', jsonData.content.error);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      console.log(`Event types found: ${allEvents.join(', ')}`);
      console.log(`Extracted ${textChunks} text chunks, ${thinkingChunks} thinking chunks`);
      console.log(`Full text length: ${fullText.length}`);
      if (fullText.length > 0) {
        console.log(`First 200 chars: ${fullText.substring(0, 200)}`);
      }
      
      // 替换 sandbox 格式的图片链接
      let processedText = fullText.replace(
        /!\[([^\]]*)\]\(sandbox:\/mnt\/output-data\/([^)]+)\)/g,
        (match, alt, filename) => {
          const fileUuid = fileMapping[filename];
          if (fileUuid) {
            const proxyUrl = `http://${req.get('host') || `${config.server.host}:${config.server.port}`}/v1/files/${chatId}/${fileUuid}/download`;
            console.log(`Replaced image link: ${filename} -> ${proxyUrl}`);
            return `![${alt}](${proxyUrl})`;
          }
          console.warn(`No file UUID found for: ${filename}`);
          return match;
        }
      );
      
      // 替换直接的 nexos.ai 链接
      processedText = replaceImageLinks(
        processedText,
        chatId,
        req.get('host') || `${config.server.host}:${config.server.port}`
      );
      
      res.json({
        id: `chatcmpl-${generateMessageId()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'nexos-chat',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: processedText || 'No response'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      });
    }
  } catch (error) {
    console.error('\n=== Error occurred ===');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
    if (error.request && !error.response) {
      console.error('Request was made but no response received');
    }
    
    res.status(500).json({
      error: {
        message: error.message,
        type: 'api_error',
        details: error.response?.data
      }
    });
  }
});

// 辅助函数
function generateMessageId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function replaceImageLinks(text, chatId, serverHost) {
  if (!text) return text;
  
  // 替换 sandbox:/mnt/output-data/ 格式的图片链接
  // 从 nexos.ai 的响应中提取 file_uuid
  const sandboxPattern = /!\[([^\]]*)\]\(sandbox:\/mnt\/output-data\/([^)]+)\)/g;
  
  // 这个模式匹配不会直接给我们 file_uuid，我们需要从工具结果中获取
  // 暂时保持原样，因为实际的图片链接会在后续处理中添加
  
  // 替换直接的 nexos.ai 文件下载链接
  const nexosPattern = new RegExp(`${config.nexos.baseUrl}/api/chat/([^/]+)/files/([^/]+)/download`, 'g');
  text = text.replace(nexosPattern, (match, cId, fileId) => {
    return `http://${serverHost}/v1/files/${cId}/${fileId}/download`;
  });
  
  return text;
}

function extractContent(data) {
  // 根据实际响应格式提取内容
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  if (data.text) return data.text;
  return JSON.stringify(data);
}

// 创建新对话的端点
app.post('/v1/chat/create', async (req, res) => {
  try {
    console.log('\n=== Creating new chat ===');
    
    // 获取 cookies
    let cookies = process.env.NEXOS_COOKIES || config.nexos.cookies;
    if (!cookies) {
      return res.status(500).json({ 
        error: 'NEXOS_COOKIES not configured in .env file' 
      });
    }
    cookies = cookies.replace(/[\r\n]/g, '').trim();
    
    // 请求创建新对话
    const response = await axios.get(`${config.nexos.baseUrl}/chat.data`, {
      headers: {
        'accept': '*/*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'referer': `${config.nexos.baseUrl}/`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'cookie': cookies
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302 || status < 400
    });
    
    // 从响应中提取 chat ID
    const responseData = JSON.stringify(response.data);
    const chatIdMatch = responseData.match(/\/chat\/([a-f0-9-]{36})/);
    
    if (chatIdMatch && chatIdMatch[1]) {
      const newChatId = chatIdMatch[1];
      console.log(`Created new chat ID: ${newChatId}`);
      
      // 自动设置为当前活动的 Chat ID
      const autoSwitch = req.body.auto_switch !== false; // 默认自动切换
      if (autoSwitch) {
        setCurrentChatId(newChatId);
      }
      
      res.json({
        success: true,
        chatId: newChatId,
        url: `${config.nexos.baseUrl}/chat/${newChatId}`,
        currentChat: autoSwitch,
        message: autoSwitch 
          ? `New chat created and set as current: ${newChatId}`
          : `New chat created: ${newChatId}. Call POST /v1/chat/switch with chatId to switch to it.`
      });
    } else {
      console.error('Failed to extract chat ID from response:', responseData);
      res.status(500).json({
        error: 'Failed to extract chat ID from response',
        response: responseData
      });
    }
  } catch (error) {
    console.error('Error creating chat:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'api_error'
      }
    });
  }
});

// 切换当前 Chat ID
app.post('/v1/chat/switch', (req, res) => {
  const { chatId } = req.body;
  
  if (!chatId) {
    return res.status(400).json({
      error: 'chatId is required'
    });
  }
  
  if (setCurrentChatId(chatId)) {
    res.json({
      success: true,
      chatId: chatId,
      message: `Switched to chat: ${chatId}`
    });
  } else {
    res.status(500).json({
      error: 'Failed to switch chat'
    });
  }
});

// 获取当前 Chat ID
app.get('/v1/chat/current', (req, res) => {
  const currentChatId = getCurrentChatId();
  res.json({
    chatId: currentChatId,
    source: fs.existsSync(CURRENT_CHAT_FILE) ? 'file' : 'config'
  });
});

// 启动服务器
app.listen(config.server.port, config.server.host, () => {
  console.log(`OpenAI compatible API running on http://${config.server.host}:${config.server.port}`);
  console.log(`Models endpoint: http://${config.server.host}:${config.server.port}/v1/models`);
  console.log(`Chat endpoint: http://${config.server.host}:${config.server.port}/v1/chat/completions`);
  console.log(`Create chat endpoint: http://${config.server.host}:${config.server.port}/v1/chat/create`);
  console.log(`Switch chat endpoint: http://${config.server.host}:${config.server.port}/v1/chat/switch`);
  console.log(`Current chat endpoint: http://${config.server.host}:${config.server.port}/v1/chat/current`);
  console.log(`\nCurrent Chat ID: ${getCurrentChatId()}`);
});
