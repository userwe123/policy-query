addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // IP 定位查询代理
  if (path === '/geoip' && request.method === 'GET') {
    const ip = url.searchParams.get('ip');
    
    if (!ip) {
      return new Response(JSON.stringify({ error: '缺少 IP 参数' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      // 使用多个 API 源，依次尝试
      const apis = [
        `https://ipapi.co/${ip}/json/`,
        `https://ip.sb/geoip/${ip}`,
        `https://ipinfo.io/${ip}/json`
      ];
      
      let lastError = null;
      
      for (const apiUrl of apis) {
        try {
          const response = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cf: { cacheTtl: 3600 } // 缓存 1 小时
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // 统一返回格式
            let result = {
              ip: ip,
              country: '',
              region: '',
              city: '',
              isp: '',
              latitude: '',
              longitude: ''
            };
            
            // ipapi.co 格式（优先使用，数据最完整）
            if (data.country_name !== undefined) {
              result.country = data.country_name || '';
              result.region = data.region || '';
              result.city = data.city || '';
              result.isp = data.org || '';
              result.latitude = data.latitude || '';
              result.longitude = data.longitude || '';
            }
            // ip.sb 格式
            else if (data.country !== undefined) {
              result.country = data.country || '';
              result.region = data.region || '';
              result.city = data.city || '';
              result.isp = data.isp || '';
              result.latitude = data.latitude || '';
              result.longitude = data.longitude || '';
            }
            // ipinfo.io 格式
            else if (data.country !== undefined && data.city !== undefined) {
              result.country = data.country || '';
              result.region = data.region || '';
              result.city = data.city || '';
              result.isp = data.org || '';
              const loc = data.loc ? data.loc.split(',') : [];
              result.latitude = loc[0] || '';
              result.longitude = loc[1] || '';
            }
            
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (e) {
          lastError = e.message;
          continue;
        }
      }
      
      return new Response(JSON.stringify({ 
        error: '所有 API 源都失败了',
        lastError: lastError,
        ip: ip
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // 记录登录
  if (path === '/log' && request.method === 'POST') {
    try {
      const data = await request.json();
      const logEntry = {
        username: data.username || 'unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        timestamp: new Date().toISOString()
      };
      
      let logs = [];
      const existing = await LOGS.get('login_logs');
      if (existing) logs = JSON.parse(existing);
      
      logs.unshift(logEntry);
      if (logs.length > 1000) logs = logs.slice(0, 1000);
      
      await LOGS.put('login_logs', JSON.stringify(logs));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
  
  // 查询日志
  if (path === '/logs') {
    try {
      const logs = await LOGS.get('login_logs');
      return new Response(JSON.stringify({ logs: logs ? JSON.parse(logs) : [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
  
  // 清除日志
  if (path === '/clear' && request.method === 'POST') {
    try {
      await LOGS.put('login_logs', JSON.stringify([]));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
  
  return new Response('Policy Query Worker', {
    headers: corsHeaders
  });
}
