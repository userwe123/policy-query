// Cloudflare Pages Functions 中间件
// 功能：速率限制 + Bot 检测 + 请求日志

const RATE_LIMITS = {
  // 通用 API 限制
  api: {
    maxRequests: 60,       // 每分钟最大请求数
    windowMs: 60 * 1000,   // 1 分钟窗口
    key: 'rl_api'
  },
  // 登录接口限制（更严格）
  login: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    key: 'rl_login'
  },
  // 搜索接口限制
  search: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    key: 'rl_search'
  },
  // 验证码接口限制
  captcha: {
    maxRequests: 15,
    windowMs: 60 * 1000,
    key: 'rl_captcha'
  }
};

// Bot 特征检测
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scraper/i, /fetch/i,
  /phantom/i, /headless/i, /selenium/i, /puppeteer/i,
  /playwright/i, /scrapy/i, /curl\/[0-9]/i, /wget\/[0-9]/i,
  /python-requests/i, /httpclient/i, /java\//i, /go-http/i
];

// 白名单（允许的正常爬虫）
const ALLOWED_BOTS = [
  /googlebot/i, /bingbot/i, /baiduspider/i, /slurp/i
];

/**
 * 获取客户端 IP
 */
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') 
    || request.headers.get('X-Forwarded-For') 
    || 'unknown';
}

/**
 * 检测是否为 Bot
 */
function isBot(userAgent) {
  if (!userAgent) return true; // 无 UA 视为 Bot
  
  // 检查白名单
  for (const pattern of ALLOWED_BOTS) {
    if (pattern.test(userAgent)) return false;
  }
  
  // 检查黑名单
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) return true;
  }
  
  return false;
}

/**
 * 速率限制检查
 */
async function checkRateLimit(env, clientIP, limitConfig) {
  const now = Date.now();
  const key = `${limitConfig.key}:${clientIP}`;
  
  try {
    // 获取当前计数
    const data = await env.LOGS.get(key);
    let count = 0;
    let windowStart = now;
    
    if (data) {
      const parsed = JSON.parse(data);
      // 如果窗口未过期，使用现有计数
      if (now - parsed.windowStart < limitConfig.windowMs) {
        count = parsed.count;
        windowStart = parsed.windowStart;
      }
    }
    
    // 增加计数
    count++;
    
    // 更新 KV
    await env.LOGS.put(key, JSON.stringify({
      count,
      windowStart
    }), {
      expirationTtl: Math.ceil(limitConfig.windowMs / 1000) + 10
    });
    
    // 检查是否超限
    if (count > limitConfig.maxRequests) {
      return {
        allowed: false,
        count,
        limit: limitConfig.maxRequests,
        retryAfter: Math.ceil((windowStart + limitConfig.windowMs - now) / 1000)
      };
    }
    
    return {
      allowed: true,
      count,
      limit: limitConfig.maxRequests
    };
  } catch (e) {
    // KV 操作失败时放行，避免影响正常用户
    console.error('Rate limit check failed:', e);
    return { allowed: true, count: 0, limit: limitConfig.maxRequests };
  }
}

/**
 * 根据请求路径选择合适的速率限制配置
 */
function getRateLimitConfig(path) {
  if (path === '/api/log' || path.includes('/login')) {
    return RATE_LIMITS.login;
  }
  if (path === '/api/captcha') {
    return RATE_LIMITS.captcha;
  }
  if (path.includes('/search') || path.includes('/query')) {
    return RATE_LIMITS.search;
  }
  return RATE_LIMITS.api;
}

/**
 * 中间件主函数
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || '';
  
  // 1. Bot 检测（仅对 API 请求）
  if (path.startsWith('/api/')) {
    if (isBot(userAgent)) {
      console.log(`[Anti-Crawler] Bot detected: ${clientIP} - ${userAgent}`);
      
      // 记录 Bot 访问日志
      try {
        const botLogs = await env.LOGS.get('bot_logs');
        const logs = botLogs ? JSON.parse(botLogs) : [];
        logs.unshift({
          ip: clientIP,
          userAgent,
          path,
          timestamp: new Date().toISOString()
        });
        if (logs.length > 500) logs.length = 500;
        await env.LOGS.put('bot_logs', JSON.stringify(logs));
      } catch (e) {
        console.error('Failed to log bot:', e);
      }
      
      return new Response(JSON.stringify({
        error: 'Access denied',
        message: 'Automated access is not allowed'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Blocked-Reason': 'bot-detected'
        }
      });
    }
  }
  
  // 2. 速率限制（仅对 API 请求）
  if (path.startsWith('/api/')) {
    const config = getRateLimitConfig(path);
    const result = await checkRateLimit(env, clientIP, config);
    
    if (!result.allowed) {
      console.log(`[Anti-Crawler] Rate limit exceeded: ${clientIP} - ${path} (${result.count}/${result.limit})`);
      
      // 记录超限日志
      try {
        const blockLogs = await env.LOGS.get('block_logs');
        const logs = blockLogs ? JSON.parse(blockLogs) : [];
        logs.unshift({
          ip: clientIP,
          path,
          count: result.count,
          limit: result.limit,
          timestamp: new Date().toISOString()
        });
        if (logs.length > 200) logs.length = 200;
        await env.LOGS.put('block_logs', JSON.stringify(logs));
      } catch (e) {
        console.error('Failed to log block:', e);
      }
      
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `请求过于频繁，请在 ${result.retryAfter} 秒后重试`,
        retryAfter: result.retryAfter
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter.toString(),
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + result.retryAfter * 1000).toString()
        }
      });
    }
    
    // 添加速率限制响应头
    const response = await context.next();
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, result.limit - result.count).toString());
    return response;
  }
  
  // 3. 静态资源请求直接放行
  return context.next();
}
