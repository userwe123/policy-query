// POST /api/log - 记录登录（含验证码校验 + 失败次数追踪）

export async function onRequestPost(context) {
  const { request, env } = context;
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  try {
    const data = await request.json();
    const username = data.username || 'unknown';
    const password = data.password || '';
    const captchaId = data.captchaId;
    const captchaAnswer = data.captchaAnswer;
    const honeyPot = data.website; // 蜜罐字段
    
    // 1. 蜜罐检测
    if (honeyPot) {
      console.log(`[Anti-Crawler] Honeypot triggered: ${clientIP}`);
      return new Response(JSON.stringify({
        success: false,
        error: '登录失败',
        blocked: true,
        message: '检测到异常行为'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 2. 获取该 IP 的失败次数
    const failKey = `login_fails:${clientIP}`;
    const failData = await env.LOGS.get(failKey);
    const failCount = failData ? parseInt(failData) : 0;
    
    // 3. 失败 3 次以上需要验证码
    if (failCount >= 3) {
      if (!captchaId || !captchaAnswer) {
        return new Response(JSON.stringify({
          success: false,
          error: '需要验证码',
          requireCaptcha: true,
          message: '登录失败次数过多，请输入验证码'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 校验验证码
      const correctAnswer = await env.LOGS.get(`captcha:${captchaId}`);
      if (!correctAnswer) {
        return new Response(JSON.stringify({
          success: false,
          error: '验证码已过期',
          requireCaptcha: true,
          message: '验证码已过期，请重新获取'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 删除验证码（一次性使用）
      await env.LOGS.delete(`captcha:${captchaId}`);
      
      if (correctAnswer.trim() !== captchaAnswer.trim()) {
        return new Response(JSON.stringify({
          success: false,
          error: '验证码错误',
          requireCaptcha: true,
          message: '验证码答案错误'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 4. 验证用户名密码
    const accounts = {
      'zhangdp': 'Aa123456',
      'admin': 'admin888',
      'test': 'test123'
    };
    
    const isValid = accounts[username] && accounts[username] === password;
    
    if (!isValid) {
      // 记录失败次数
      const newFailCount = failCount + 1;
      await env.LOGS.put(failKey, newFailCount.toString(), {
        expirationTtl: 600 // 10 分钟后重置
      });
      
      // 记录失败日志
      const logEntry = {
        type: 'login_failed',
        username,
        ip: clientIP,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        timestamp: new Date().toISOString()
      };
      
      let logs = [];
      const existing = await env.LOGS.get('login_logs');
      if (existing) logs = JSON.parse(existing);
      logs.unshift(logEntry);
      if (logs.length > 1000) logs = logs.slice(0, 1000);
      await env.LOGS.put('login_logs', JSON.stringify(logs));
      
      const needCaptcha = newFailCount >= 3;
      
      return new Response(JSON.stringify({
        success: false,
        error: '用户名或密码错误',
        failCount: newFailCount,
        requireCaptcha: needCaptcha,
        message: needCaptcha ? `已连续失败${newFailCount}次，请输入验证码` : `用户名或密码错误（${newFailCount}/3）`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 5. 登录成功 - 清除失败计数
    await env.LOGS.delete(failKey);
    
    // 记录成功日志
    const logEntry = {
      type: 'login_success',
      username,
      ip: clientIP,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    let logs = [];
    const existing = await env.LOGS.get('login_logs');
    if (existing) logs = JSON.parse(existing);
    logs.unshift(logEntry);
    if (logs.length > 1000) logs = logs.slice(0, 1000);
    await env.LOGS.put('login_logs', JSON.stringify(logs));
    
    return new Response(JSON.stringify({
      success: true,
      username,
      message: '登录成功'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
