addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 国家名称中文映射
const COUNTRY_MAP = {
  'China': '中国',
  'United States': '美国',
  'United Kingdom': '英国',
  'Japan': '日本',
  'South Korea': '韩国',
  'Germany': '德国',
  'France': '法国',
  'Canada': '加拿大',
  'Australia': '澳大利亚',
  'Russia': '俄罗斯',
  'India': '印度',
  'Brazil': '巴西',
  'Singapore': '新加坡',
  'Thailand': '泰国',
  'Malaysia': '马来西亚',
  'Indonesia': '印度尼西亚',
  'Philippines': '菲律宾',
  'Vietnam': '越南',
  'Italy': '意大利',
  'Spain': '西班牙',
  'Netherlands': '荷兰',
  'Switzerland': '瑞士',
  'Sweden': '瑞典',
  'Norway': '挪威',
  'Denmark': '丹麦',
  'Finland': '芬兰',
  'Poland': '波兰',
  'Turkey': '土耳其',
  'Mexico': '墨西哥',
  'Argentina': '阿根廷'
};

// 省份名称中文映射（部分）
const REGION_MAP = {
  'Guangdong': '广东',
  'Beijing': '北京',
  'Shanghai': '上海',
  'Tianjin': '天津',
  'Chongqing': '重庆',
  'Hebei': '河北',
  'Shanxi': '山西',
  'Liaoning': '辽宁',
  'Jilin': '吉林',
  'Heilongjiang': '黑龙江',
  'Jiangsu': '江苏',
  'Zhejiang': '浙江',
  'Anhui': '安徽',
  'Fujian': '福建',
  'Jiangxi': '江西',
  'Shandong': '山东',
  'Henan': '河南',
  'Hubei': '湖北',
  'Hunan': '湖南',
  'Sichuan': '四川',
  'Guizhou': '贵州',
  'Yunnan': '云南',
  'Shaanxi': '陕西',
  'Gansu': '甘肃',
  'Qinghai': '青海',
  'Taiwan': '台湾',
  'Inner Mongolia': '内蒙古',
  'Guangxi': '广西',
  'Tibet': '西藏',
  'Xinjiang': '新疆',
  'Hainan': '海南',
  'Hong Kong': '香港',
  'Macau': '澳门'
};

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
      // 使用多个 API 源，依次尝试（优先使用返回中文数据的 API）
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
              result.country = COUNTRY_MAP[data.country_name] || data.country_name || '';
              result.region = REGION_MAP[data.region] || data.region || '';
              result.city = data.city || '';
              result.isp = data.org || '';
              result.latitude = data.latitude || '';
              result.longitude = data.longitude || '';
            }
            // ip.sb 格式
            else if (data.country !== undefined) {
              result.country = COUNTRY_MAP[data.country] || data.country || '';
              result.region = REGION_MAP[data.region] || data.region || '';
              result.city = data.city || '';
              result.isp = data.isp || '';
              result.latitude = data.latitude || '';
              result.longitude = data.longitude || '';
            }
            // ipinfo.io 格式
            else if (data.country !== undefined && data.city !== undefined) {
              result.country = COUNTRY_MAP[data.country] || data.country || '';
              result.region = REGION_MAP[data.region] || data.region || '';
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
