// web_search support: unsupported (probed 2026-07-04)
// MiniMax M3 rejects web_search_20250305 tool with "function name or parameters is empty (2013)".
// summarizeFundContext attempts the tool then falls back to a no-tools call.

import Anthropic from '@anthropic-ai/sdk';
import type { FundDetail } from './fund-detail';
import type { TavilyNewsItem } from './tavily';

export interface SummarizeFundQuote {
  nav: number;
  changePercent: number | null;
  navDate: string;
}

export interface SummarizeInput {
  fundCode: string;
  fundName?: string;
  context?: string;
  fundQuote?: SummarizeFundQuote | null;
  enableWebSearch?: boolean;
  signal?: AbortSignal;
  fundDetail?: FundDetail | null;
  news?: TavilyNewsItem[] | null;
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
  webSearchUsed?: boolean;
  newsCount?: number;
  detailsLoaded?: boolean;
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
1. 已披露净值 > 当日估算净值 > 近期新闻摘要 > 阶段收益数据 > 模型自身训练知识
2. 新闻摘要截至 {date}。若模型自身训练知识超过此日期，请勿假设，仍以新闻摘要为准。
3. 若「近期新闻」区块缺失或为空，请在「新闻时效」字段标注『无近期新闻』，不要编造。
4. 用户未提供当日行情/新闻时，可基于基金名称、类型、常见重仓板块做合理推断，
   但需在表格「数据可靠性」行标注 高/中/低

### 倾向决断（Decisive-rating Clause）
除非多空证据真正势均力敌，否则请明确给出 加仓/持有/减仓/观望 之一，
不要反复骑墙。

### 输出格式（严格遵守，不要 Markdown 代码块包裹）
基金信息总结：
  <800 字以内（软约束），叙述式。覆盖：(1) 近期净值表现与波动；(2) 所属板块/行业异动；
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
| 新闻时效 | 高/中/低（若新闻缺失则为『无近期新闻』） |
| 数据可靠性 | 高/中/低 |
`;

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatFundDetailBlock(d: FundDetail | null | undefined): string {
  if (!d) return '';
  const lines: string[] = ['【基础信息】'];
  if (d.shortName) lines.push(`  基金名称：${d.shortName}`);
  if (d.fundType) lines.push(`  基金类型：${d.fundType}`);
  if (d.scale) lines.push(`  资产规模：${d.scale.toFixed(2)} 亿元${d.scaleDate ? `（截至 ${d.scaleDate}）` : ''}`);
  if (d.manager) lines.push(`  基金经理：${d.manager}`);
  if (d.inceptionDate) lines.push(`  成立日期：${d.inceptionDate}`);
  if (d.bench) lines.push(`  业绩基准：${d.bench}`);
  if (d.invTarget) lines.push(`  投资目标：${d.invTarget}`);

  if (d.periodReturns.length > 0) {
    lines.push('', `【阶段收益（截至 ${formatDate(new Date())}）】`);
    lines.push('  区间         收益%     同类平均%    沪深300%    排行/总数');
    for (const p of d.periodReturns) {
      const y = (p.yield >= 0 ? '+' : '') + p.yield.toFixed(2);
      const avg = p.categoryAvg ? p.categoryAvg.toFixed(2) : '--';
      const hs = p.hs300 != null ? (p.hs300 >= 0 ? '+' : '') + p.hs300.toFixed(2) : '--';
      const rank = p.rank != null && p.total != null ? `${p.rank}/${p.total}` : '--';
      lines.push(`  ${p.range.padEnd(8, '　')}  ${y.padStart(7)}   ${avg.padStart(8)}    ${hs.padStart(7)}    ${rank}`);
    }
  }

  if (d.holdings.length > 0) {
    lines.push('', '【持仓特征】', `  前 ${d.holdings.length} 重仓股票（名称 / 主题 / 权重%）：`);
    d.holdings.forEach((h, i) => {
      lines.push(`    ${i + 1}. ${h.name} / ${h.theme || '未知'} / ${h.ratio.toFixed(2)}%`);
    });
  }

  if (d.themes.length > 0) {
    lines.push(`  主题配置（经理占比 / 同类平均%）：`);
    d.themes.forEach((t, i) => {
      lines.push(`    ${i + 1}. ${t.name}  ${t.managerRatio.toFixed(2)}% / ${t.categoryAvg.toFixed(2)}%`);
    });
  }

  return lines.join('\n');
}

function formatNewsBlock(news: TavilyNewsItem[] | null | undefined): string {
  if (!news || news.length === 0) return '';
  const today = formatDate(new Date());
  const lines: string[] = [`【近期新闻（来自 Tavily，时间范围 7 天，截至 ${today}）】`];
  news.forEach((n, i) => {
    const dateStr = n.date ? `[${n.date}] ` : '';
    lines.push(`  ${i + 1}. ${dateStr}${n.title}`);
    lines.push(`     摘要：${n.content.slice(0, 200)}`);
  });
  lines.push(`  （共 ${news.length} 条；信息具有时效性，请勿外推）`);
  return lines.join('\n');
}

function buildUserPrompt(input: SummarizeInput): string {
  const quoteLine = input.fundQuote
    ? `今日参考估值：单位净值 ${input.fundQuote.nav}（${input.fundQuote.navDate}），盘中估算涨跌幅 ${input.fundQuote.changePercent ?? '未知'}%。`
    : '';
  return [
    `基金代码：${input.fundCode}`,
    `基金名称：${input.fundName ?? '（未提供）'}`,
    `当前日期：${formatDate(new Date())}`,
    quoteLine,
    formatFundDetailBlock(input.fundDetail),
    formatNewsBlock(input.news),
    `补充上下文（如有）：${input.context ?? '（无）'}`,
  ]
    .filter(Boolean)
    .join('\n');
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

function isToolUnsupportedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: number; message?: string; error?: { type?: string } };
  const msg = (anyErr.message ?? '') + ' ' + (anyErr.error?.type ?? '');
  return /tool|invalid_request|function name|empty/i.test(msg) || anyErr.status === 400;
}

export async function summarizeFundContext(
  input: SummarizeInput
): Promise<SummarizeOutput> {
  if (!input.fundCode || !FUND_CODE_RE.test(input.fundCode)) {
    throw new Error('fundCode 必须为 6 位数字');
  }

  const client = createClient();
  const enableWebSearch = input.enableWebSearch !== false;
  const baseArgs = {
    model: 'MiniMax-M3' as const,
    max_tokens: 1000,
    temperature: 1.0,
    system: renderSystemPrompt(input),
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  };

  let response;
  let webSearchUsed = false;
  try {
    const argsWithTools = enableWebSearch
      ? { ...baseArgs, tools: [{ type: 'web_search_20250305', name: 'web_search' } as never] }
      : baseArgs;
    response = await client.messages.create(argsWithTools as never);
    webSearchUsed = enableWebSearch;
  } catch (err) {
    if (enableWebSearch && isToolUnsupportedError(err)) {
      console.warn('[lib/ai] web_search unsupported, retrying without tools:', err instanceof Error ? err.message : err);
      try {
        response = await client.messages.create(baseArgs as never);
        webSearchUsed = false;
      } catch (err2) {
        throw new AiUpstreamError(
          err2 instanceof Error ? `MiniMax 调用失败: ${err2.message}` : 'MiniMax 调用失败'
        );
      }
    } else {
      throw new AiUpstreamError(
        err instanceof Error ? `MiniMax 调用失败: ${err.message}` : 'MiniMax 调用失败'
      );
    }
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
    webSearchUsed,
    newsCount: input.news?.length ?? 0,
    detailsLoaded: input.fundDetail != null,
  };
}