import Anthropic from '@anthropic-ai/sdk';

export interface SummarizeInput {
  fundCode: string;
  fundName?: string;
  context?: string;
}

export interface SummarySection {
  summary: string;
  advice: string;
  table?: string;
}

export interface SummarizeUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface SummarizeOutput {
  fundCode: string;
  sections: SummarySection;
  raw: string;
  usage: SummarizeUsage;
  model: string;
}

export class MissingEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingEnvError';
  }
}

export class AiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUpstreamError';
  }
}

export class AiParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = 'AiParseError';
    this.raw = raw;
  }
}

const FUND_CODE_RE = /^\d{6}$/;

const SYSTEM_PROMPT = `你是一位中文基金市场分析助手，正在为长期定投的个人投资者撰写每日复盘。
风格要求：稳健、客观、避免预测式表述；信息不足时明确标注数据局限性。

### 基金身份（Identity Anchoring）
- 基金代码：{fundCode}
- 基金名称（如提供）：{fundName}
- 当前日期：{date}
仅围绕上述基金复盘；不要替换为同名/相似代码的其他基金，除非用户资料明确冲突。

### 信息优先级（Source-of-truth Rule）
1. 已披露净值 > 当日估算净值 > 媒体报道 > 板块/行业一般信息
2. 用户未提供当日行情/新闻时，可基于基金名称、类型、常见重仓板块做合理推断，
   但需在表格「数据可靠性」行标注 高/中/低

### 倾向决断（Decisive-rating Clause）
除非多空证据真正势均力敌，否则请明确给出 加仓/持有/减仓/观望 之一，
不要反复骑墙。

### 输出格式（严格遵守，不要 Markdown 代码块包裹）
基金信息总结：
  <200-300 字，叙述式。覆盖：(1) 近期净值表现与波动；(2) 所属板块/行业异动；
   (3) 关键驱动消息（政策、宏观、行业事件）。禁止堆砌项目符号。>

投资建议：
  <100-200 字。给出明确倾向及理由，必须包含「过往业绩不代表未来」
  与「本内容不构成具体投资建议」两段提示。>

关键要点（Markdown 表格）：
| 维度 | 当日观察 |
| --- | --- |
| 净值表现 | ... |
| 板块/行业 | ... |
| 主要驱动 | ... |
| 数据可靠性 | 高/中/低 |
`;

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildUserPrompt(input: SummarizeInput): string {
  return [
    `基金代码：${input.fundCode}`,
    `基金名称：${input.fundName ?? '（未提供）'}`,
    `当前日期：${formatDate(new Date())}`,
    `补充上下文（如有）：${input.context ?? '（无）'}`,
  ].join('\n');
}

function renderSystemPrompt(input: SummarizeInput): string {
  return SYSTEM_PROMPT.replace('{fundCode}', input.fundCode)
    .replace('{fundName}', input.fundName ?? '（未提供）')
    .replace('{date}', formatDate(new Date()));
}

function extractBlock(text: string, startMarker: string, endMarkers: string[]): string {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';
  const bodyStart = startIdx + startMarker.length;
  let endIdx = text.length;
  for (const m of endMarkers) {
    const i = text.indexOf(m, bodyStart);
    if (i !== -1 && i < endIdx) endIdx = i;
  }
  return text.slice(bodyStart, endIdx).trim();
}

export function parseSummary(text: string): SummarySection {
  const summary = extractBlock(text, '基金信息总结：', ['投资建议：', '关键要点']);
  const advice = extractBlock(text, '投资建议：', ['关键要点']);
  const table = extractBlock(text, '关键要点（Markdown 表格）：', []);
  if (!summary || !advice) {
    throw new AiParseError('模型响应缺少「基金信息总结」或「投资建议」段落', text);
  }
  return table ? { summary, advice, table } : { summary, advice };
}

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new MissingEnvError(`${name} 未配置`);
  }
  return v;
}

function createClient(): Anthropic {
  const apiKey = readEnv('ANTHROPIC_API_KEY');
  const baseURL = readEnv('ANTHROPIC_BASE_URL');
  return new Anthropic({ apiKey, baseURL });
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      'type' in block &&
      (block as { type: unknown }).type === 'text' &&
      'text' in block &&
      typeof (block as { text: unknown }).text === 'string'
    ) {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.join('');
}

export async function summarizeFundContext(
  input: SummarizeInput
): Promise<SummarizeOutput> {
  if (!input.fundCode || !FUND_CODE_RE.test(input.fundCode)) {
    throw new Error('fundCode 必须为 6 位数字');
  }

  const client = createClient();
  let response;
  try {
    response = await client.messages.create({
      model: 'MiniMax-M3',
      max_tokens: 1000,
      temperature: 1.0,
      system: renderSystemPrompt(input),
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
    });
  } catch (err) {
    throw new AiUpstreamError(
      err instanceof Error ? `MiniMax 调用失败: ${err.message}` : 'MiniMax 调用失败'
    );
  }

  const raw = extractText(response.content);
  const sections = parseSummary(raw);
  const usage: SummarizeUsage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };

  return {
    fundCode: input.fundCode,
    sections,
    raw,
    usage,
    model: 'MiniMax-M3',
  };
}