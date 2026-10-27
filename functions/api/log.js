// POST /api/log - 记录登录
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const logEntry = {
      username: data.username || 'unknown',
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    let logs = [];
    const existing = await env.LOGS.get('login_logs');
    if (existing) logs = JSON.parse(existing);
    
    logs.unshift(logEntry);
    if (logs.length > 1000) logs = logs.slice(0, 1000);
    
    await env.LOGS.put('login_logs', JSON.stringify(logs));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
