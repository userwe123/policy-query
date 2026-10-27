// POST /api/captcha - 生成验证码
// GET /api/captcha?id=xxx&answer=xxx - 校验验证码

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 生成随机数学题
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    switch (operator) {
      case '+':
        answer = a + b;
        break;
      case '-':
        answer = a - b;
        break;
      case '×':
        answer = a * b;
        break;
    }
    
    // 生成验证码 ID
    const captchaId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    
    // 存储到 KV（5 分钟过期）
    await env.LOGS.put(`captcha:${captchaId}`, answer.toString(), {
      expirationTtl: 300
    });
    
    return new Response(JSON.stringify({
      success: true,
      captchaId,
      question: `${a} ${operator} ${b} = ?`
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const captchaId = url.searchParams.get('id');
  const answer = url.searchParams.get('answer');
  
  if (!captchaId || !answer) {
    return new Response(JSON.stringify({ error: '缺少参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // 从 KV 获取正确答案
    const correctAnswer = await env.LOGS.get(`captcha:${captchaId}`);
    
    if (!correctAnswer) {
      return new Response(JSON.stringify({
        success: false,
        message: '验证码已过期，请重新获取'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 验证答案（无论对错都删除，防止重复使用）
    await env.LOGS.delete(`captcha:${captchaId}`);
    
    const isCorrect = correctAnswer.trim() === answer.trim();
    
    return new Response(JSON.stringify({
      success: isCorrect,
      message: isCorrect ? '验证通过' : '答案错误'
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
