// Cloudflare Worker - 登录日志记录
// 部署后访问日志存储在 KV 存储中

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // 记录登录
    if (path === '/log' && request.method === 'POST') {
      try {
        const data = await request.json();
        const timestamp = new Date().toISOString();
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        
        const logEntry = {
          username: data.username || 'unknown',
          ip: ip,
          userAgent: userAgent,
          timestamp: timestamp,
          location: data.location || ''
        };
        
        // 获取现有日志
        let logs = [];
        const existing = await env.LOGS.get('login_logs');
        if (existing) {
          logs = JSON.parse(existing);
        }
        
        // 添加新日志（保留最近 1000 条）
        logs.unshift(logEntry);
        if (logs.length > 1000) {
          logs = logs.slice(0, 1000);
        }
        
        // 保存
        await env.LOGS.put('login_logs', JSON.stringify(logs));
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 查询日志
    if (path === '/logs' && request.method === 'GET') {
      try {
        const logs = await env.LOGS.get('login_logs');
        const data = logs ? JSON.parse(logs) : [];
        
        return new Response(JSON.stringify({ logs: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 清除日志
    if (path === '/clear' && request.method === 'POST') {
      try {
        await env.LOGS.put('login_logs', JSON.stringify([]));
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
