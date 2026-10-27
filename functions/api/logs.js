// GET /api/logs - 查询日志
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const logs = await env.LOGS.get('login_logs');
    return new Response(JSON.stringify({ logs: logs ? JSON.parse(logs) : [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
