// POST /api/clear - 清除日志
export async function onRequestPost(context) {
  const { env } = context;
  
  try {
    await env.LOGS.put('login_logs', JSON.stringify([]));
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
