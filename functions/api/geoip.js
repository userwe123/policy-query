// GET /api/geoip?ip=xxx - IP 定位查询代理
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const ip = url.searchParams.get('ip');
  
  if (!ip) {
    return new Response(JSON.stringify({ error: '缺少 IP 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // 使用多个 API 源，依次尝试
    const apis = [
      `https://ip.sb/geoip/${ip}`,
      `https://ipapi.co/${ip}/json/`,
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
          
          // ip.sb 格式
          if (data.country !== undefined) {
            result.country = data.country || '';
            result.region = data.region || '';
            result.city = data.city || '';
            result.isp = data.isp || '';
            result.latitude = data.latitude || '';
            result.longitude = data.longitude || '';
          }
          // ipapi.co 格式
          else if (data.country_name !== undefined) {
            result.country = data.country_name || '';
            result.region = data.region || '';
            result.city = data.city || '';
            result.isp = data.org || '';
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
            headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
