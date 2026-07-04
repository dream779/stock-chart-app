// lib/tavily.ts
// Minimal Tavily Search wrapper. Free tier 1000 req/month.

export class TavilyUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TavilyUpstreamError';
  }
}

export class TavilyRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TavilyRateLimitError';
  }
}

export interface TavilyNewsItem {
  title: string;
  url: string;
  content: string;
  date: string | null;
}

export interface TavilySearchParams {
  query: string;
  days?: number;
  maxResults?: number;
  signal?: AbortSignal;
}

interface RawTavilyResult {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
  date?: string;
}

interface RawTavilyResponse {
  results?: RawTavilyResult[];
}

function readApiKey(): string {
  const v = process.env.TAVILY_API_KEY;
  if (!v || v.trim() === '') {
    throw new TavilyUpstreamError('TAVILY_API_KEY 未配置');
  }
  return v;
}

function normalizeDate(raw: RawTavilyResult): string | null {
  const candidate = raw.published_date || raw.date;
  if (!candidate) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) return candidate.slice(0, 10);
  if (/^\d{8}$/.test(candidate)) return `${candidate.slice(0, 4)}-${candidate.slice(4, 6)}-${candidate.slice(6, 8)}`;
  return null;
}

export async function searchFundNews(params: TavilySearchParams): Promise<TavilyNewsItem[]> {
  const apiKey = readApiKey();
  const days = params.days ?? 7;
  const maxResults = params.maxResults ?? 5;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const signal = params.signal ?? controller.signal;

  let res: Response;
  try {
    res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: params.query,
        max_results: maxResults,
        days,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }),
      signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as { name?: string }).name === 'AbortError') {
      throw new TavilyUpstreamError('Tavily 请求超时 (5s)');
    }
    throw new TavilyUpstreamError(
      err instanceof Error ? `Tavily 网络错误: ${err.message}` : 'Tavily 网络错误'
    );
  }
  clearTimeout(timeoutId);

  if (res.status === 429) {
    throw new TavilyRateLimitError(`Tavily 429: ${await res.text().catch(() => '')}`);
  }
  if (!res.ok) {
    throw new TavilyUpstreamError(`Tavily HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }

  let body: RawTavilyResponse;
  try {
    body = (await res.json()) as RawTavilyResponse;
  } catch (err) {
    throw new TavilyUpstreamError(
      err instanceof Error ? `Tavily 响应解析失败: ${err.message}` : 'Tavily 响应解析失败'
    );
  }

  const items = Array.isArray(body.results) ? body.results : [];
  return items
    .filter((r): r is RawTavilyResult & { title: string; url: string; content: string } =>
      Boolean(r && r.title && r.url && r.content)
    )
    .map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      date: normalizeDate(r),
    }));
}