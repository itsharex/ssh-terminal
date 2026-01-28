// AI 提示词模板

import type { ChatMessage } from '@/types/ai';

/**
 * 命令解释提示词模板
 */
export const COMMAND_EXPLAIN_PROMPT = `你是一个 Linux/Unix 命令行专家。请简洁解释以下 Shell 命令的功能：

请按以下格式回答：
1. 命令功能：一句话总结
2. 参数说明：简要解释关键参数
3. 常用场景：1-2 个使用场景
4. 风险提示：如果有潜在风险，请警告

回答要简洁明了，不超过 200 字。`;

/**
 * 自然语言转命令提示词模板
 */
export const NL_TO_COMMAND_PROMPT = `你是一个 Linux 命令生成助手。根据用户的自然语言描述，生成对应的 Shell 命令。

要求：
1. 只返回命令，不要解释
2. 如果需求不明确，返回 "ERROR: 不明确的命令"
3. 如果涉及危险操作，在命令前添加 "# 警告: "
4. 优先使用常用命令和参数

示例：
输入: "查看当前目录所有文件"
输出: ls -la

输入: "查找所有 .log 文件"
输出: find . -name "*.log"`;

/**
 * 错误分析提示词模板
 */
export const ERROR_ANALYSIS_PROMPT = `你是一个 Linux 系统故障排查专家。请分析以下错误信息并提供解决方案。

请按以下格式回答：
1. 错误原因：简要说明为什么会发生这个错误
2. 解决方案：提供 2-3 个可能的解决方案，按推荐顺序排列
3. 预防措施：如何避免类似问题

回答要简洁实用，每个解决方案不超过 50 字。`;

/**
 * 系统提示词（用于普通对话）
 */
export const DEFAULT_SYSTEM_PROMPT = `你是一个友好、专业的 Linux 和 DevOps 助手。你可以帮助用户解决技术问题、解释命令、提供最佳实践建议。

请：
1. 回答简洁明了
2. 提供实用的代码示例
3. 如果涉及危险操作，务必警告
4. 使用中文回答（除非用户明确要求英文）`;

/**
 * 格式化命令解释提示词
 */
export function formatCommandExplainPrompt(command: string): ChatMessage[] {
  return [
    { role: 'system', content: COMMAND_EXPLAIN_PROMPT },
    { role: 'user', content: `命令: ${command}` },
  ];
}

/**
 * 格式化自然语言转命令提示词
 */
export function formatNLToCommandPrompt(input: string): ChatMessage[] {
  return [
    { role: 'system', content: NL_TO_COMMAND_PROMPT },
    { role: 'user', content: `用户需求: ${input}` },
  ];
}

/**
 * 格式化错误分析提示词
 */
export function formatErrorAnalysisPrompt(error: string): ChatMessage[] {
  return [
    { role: 'system', content: ERROR_ANALYSIS_PROMPT },
    { role: 'user', content: `错误信息:\n${error}` },
  ];
}

/**
 * 格式化默认对话提示词
 */
export function formatDefaultChatPrompt(userMessage: string, history: ChatMessage[] = []): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];
  return messages;
}
