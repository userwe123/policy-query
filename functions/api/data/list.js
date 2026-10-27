// 数据管理 API - list.js
// GET /api/data/list - 获取数据列表

// 获取当前数据（从 GitHub 读取）
async function getCurrentData() {
  const resp = await fetch('https://raw.githubusercontent.com/userwe123/policy-query/main/data.json', {
    headers: { 'User-Agent': 'Policy-Query-System' },
    cf: { cacheTtl: 60 }
  });
  if (!resp.ok) {
    console.error('Failed to fetch data:', resp.status, resp.statusText);
    return [];
  }
  return await resp.json();
}

export async function onRequestGet(context) {
  try {
    const data = await getCurrentData();
    
    const vinStats = {};
    data.forEach(p => {
      if (!vinStats[p.vin]) {
        vinStats[p.vin] = { vin: p.vin, plate: p.plate, jqx: 0, syx: 0 };
      }
      if (p.type === '交强险') vinStats[p.vin].jqx++;
      if (p.type === '商业险') vinStats[p.vin].syx++;
    });
    
    return new Response(JSON.stringify({
      success: true,
      data: data,
      vehicles: Object.keys(vinStats).length,
      policies: data.length,
      stats: Object.values(vinStats)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'GET') {
    return onRequestGet(context);
  }
  return new Response(JSON.stringify({
    success: false,
    error: '不支持的请求方法'
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}
