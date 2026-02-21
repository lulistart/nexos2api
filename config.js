export default {
  // Nexos.ai 配置
  nexos: {
    baseUrl: 'https://workspace.nexos.ai',
    chatId: process.env.NEXOS_CHAT_ID || 'b6aa7e13-5a78-4436-8668-700da8b6b790',
    handlerId: '4839e638-49d1-4c97-a1e5-0ad68b317c4b', // 默认模型 ID
    cookies: '', // 从环境变量读取
  },
  
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  
  // 模型 ID 映射（模型名称 -> nexos handler ID）
  modelMapping: {
    // Claude 系列
    'claude-haiku-4-5': 'dfb29932-cad7-4c5f-8189-d12eb9d0c3c9',
    'claude-opus-4-5': '49caf3e7-a347-4641-96da-6e4322cd03ab',
    'claude-opus-4-6': '4839e638-49d1-4c97-a1e5-0ad68b317c4b',
    'claude-sonnet-4-5': 'bc62fe29-732e-4488-aad6-17c1ad5691f1',
    'claude-sonnet-4-6': '050aa16c-c1ec-441f-8428-bb13458c9af5',
    
    // Gemini 系列
    'gemini-2-5-flash': 'ef863bf8-59b8-45b5-afa6-797512d7a110',
    'gemini-2-5-pro': '1172df4f-78a7-4bea-9482-be290ee858f8',
    'gemini-3-flash-preview': '2cc2f020-a66a-41b3-9ee2-2238631dab8a',
    'gemini-3-pro-preview': '6ba58bb6-0b77-40a8-a016-26900cda074c',
    'gemini-3-1-pro-preview': '7f888a48-2400-4221-8d0c-5d937a61cc7d',
    
    // GPT 系列
    'gpt-5': '5f15269e-e204-46c6-98d3-bbfd33fe400a',
    'gpt-5-1': 'd8f4a97d-5c15-4914-a363-707bccab2d1a',
    'gpt-5-2': '0a47b187-6ea2-4c8e-8d18-fb32223be6a6',
    
    // Grok 系列
    'grok-4-fast': 'a128fc4e-f482-414c-963b-7939e90c3ecd',
    'grok-4-fast-reasoning': '4889733a-acd5-48da-b93a-4b1c39487fc2',
    'grok-4-1-fast': '81426542-20df-45b6-b7b0-56592d911900',
    'grok-4-1-fast-reasoning': '5a5d8b99-5d02-4a0e-9547-a4e38e0cd64b',
    'grok-code-fast-1': '6c1c9f9f-31c6-4e89-a93e-b0db4a8ee97e',
    
    // Mistral 系列
    'mistral-large-3': 'b1e7d601-18c8-47af-a8f8-ab50f31b48de',
    
    // 默认
    'nexos-chat': '4839e638-49d1-4c97-a1e5-0ad68b317c4b' // 默认使用 Claude Opus 4.6
  },
  
  // 模型映射（从 nexos.ai 提取）
  models: [
    { id: 'claude-haiku-4-5', object: 'model', created: 1677610602, owned_by: 'anthropic' },
    { id: 'claude-opus-4-5', object: 'model', created: 1677610602, owned_by: 'anthropic' },
    { id: 'claude-opus-4-6', object: 'model', created: 1677610602, owned_by: 'anthropic' },
    { id: 'claude-sonnet-4-5', object: 'model', created: 1677610602, owned_by: 'anthropic' },
    { id: 'claude-sonnet-4-6', object: 'model', created: 1677610602, owned_by: 'anthropic' },
    { id: 'gemini-2-5-flash', object: 'model', created: 1677610602, owned_by: 'google' },
    { id: 'gemini-2-5-pro', object: 'model', created: 1677610602, owned_by: 'google' },
    { id: 'gemini-3-flash-preview', object: 'model', created: 1677610602, owned_by: 'google' },
    { id: 'gemini-3-pro-preview', object: 'model', created: 1677610602, owned_by: 'google' },
    { id: 'gemini-3-1-pro-preview', object: 'model', created: 1677610602, owned_by: 'google' },
    { id: 'gpt-5', object: 'model', created: 1677610602, owned_by: 'openai' },
    { id: 'gpt-5-1', object: 'model', created: 1677610602, owned_by: 'openai' },
    { id: 'gpt-5-2', object: 'model', created: 1677610602, owned_by: 'openai' },
    { id: 'grok-4-fast', object: 'model', created: 1677610602, owned_by: 'xai' },
    { id: 'grok-4-fast-reasoning', object: 'model', created: 1677610602, owned_by: 'xai' },
    { id: 'grok-4-1-fast', object: 'model', created: 1677610602, owned_by: 'xai' },
    { id: 'grok-4-1-fast-reasoning', object: 'model', created: 1677610602, owned_by: 'xai' },
    { id: 'grok-code-fast-1', object: 'model', created: 1677610602, owned_by: 'xai' },
    { id: 'mistral-large-3', object: 'model', created: 1677610602, owned_by: 'mistral' },
    { id: 'mistral-medium-3', object: 'model', created: 1677610602, owned_by: 'mistral' },
    { id: 'mistral-medium-3-1', object: 'model', created: 1677610602, owned_by: 'mistral' },
    { id: 'nexos-chat', object: 'model', created: 1677610602, owned_by: 'nexos' }
  ]
};
