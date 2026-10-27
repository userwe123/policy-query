// User-Agent 黑名单管理 API
// GET /api/blacklist - 获取黑名单
// POST /api/blacklist - 添加到黑名单
// DELETE /api/blacklist - 从黑名单删除
// POST /api/blacklist/auto - 自动检测并添加恶意 UA

// 已知的恶意 User-Agent 模式
const MALICIOUS_UA_PATTERNS = [
  /sqlmap/i,           // SQL 注入工具
  /nikto/i,            // 漏洞扫描器
  /nmap/i,             // 网络扫描器
  /masscan/i,          // 端口扫描器
  /dirbuster/i,        // 目录爆破工具
  /havij/i,            // SQL 注入工具
  /w3af/i,             // Web 攻击框架
  /nessus/i,           // 漏洞扫描器
  /openvas/i,          // 漏洞扫描器
  /metasploit/i,       // 渗透测试框架
  /burpsuite/i,        // Web 安全测试工具
  /zap/i,              // OWASP ZAP
  /acunetix/i,         // 漏洞扫描器
  /qualys/i,           // 漏洞扫描器
  /rapid7/i,           // 漏洞扫描器
  /censys/i,           // 网络扫描器
  /shodan/i,           // 网络扫描器
  /zgrab/i,            // 网络扫描器
  /httpx/i,            // HTTP 扫描器
  /nuclei/i,           // 漏洞扫描器
  /gobuster/i,         // 目录爆破工具
  /ffuf/i,             // 目录爆破工具
  /wfuzz/i,            // Web 模糊测试
  /hydra/i,            // 暴力破解工具
  /medusa/i,           // 暴力破解工具
  /thc-hydra/i,        // 暴力破解工具
  /aircrack/i,         // 无线破解工具
  /hashcat/i,          // 密码破解工具
  /john/i,             // 密码破解工具
  /netcat/i,           // 网络工具
  /ncat/i,             // 网络工具
  /socat/i,            // 网络工具
  /wireshark/i,        // 网络分析工具
  /tcpdump/i,          // 网络抓包工具
  /mitmproxy/i,        // 中间人攻击工具
  /bettercap/i,        // 网络攻击工具
];

/**
 * 获取黑名单
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const blacklist = await env.LOGS.get('ua_blacklist');
    const list = blacklist ? JSON.parse(blacklist) : [];
    
    return new Response(JSON.stringify({ 
      success: true,
      blacklist: list,
      count: list.length
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

/**
 * 添加到黑名单
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const userAgent = data.userAgent;
    const reason = data.reason || '手动添加';
    
    if (!userAgent) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '缺少 User-Agent 参数' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 获取现有黑名单
    const blacklist = await env.LOGS.get('ua_blacklist');
    const list = blacklist ? JSON.parse(blacklist) : [];
    
    // 检查是否已存在
    const exists = list.some(item => item.userAgent === userAgent);
    if (exists) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '该 User-Agent 已在黑名单中' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 添加到黑名单
    list.push({
      userAgent,
      reason,
      addedAt: new Date().toISOString(),
      hitCount: 0
    });
    
    await env.LOGS.put('ua_blacklist', JSON.stringify(list));
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '已添加到黑名单',
      count: list.length
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

/**
 * 从黑名单删除
 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const userAgent = data.userAgent;
    
    if (!userAgent) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '缺少 User-Agent 参数' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 获取现有黑名单
    const blacklist = await env.LOGS.get('ua_blacklist');
    let list = blacklist ? JSON.parse(blacklist) : [];
    
    // 删除指定项
    const originalLength = list.length;
    list = list.filter(item => item.userAgent !== userAgent);
    
    if (list.length === originalLength) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '未找到该 User-Agent' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env.LOGS.put('ua_blacklist', JSON.stringify(list));
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '已从黑名单移除',
      count: list.length
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

/**
 * 自动检测并添加恶意 User-Agent
 */
export async function onRequestPut(context) {
  const { env } = context;
  
  try {
    // 获取 Bot 日志
    const botLogs = await env.LOGS.get('bot_logs');
    const logs = botLogs ? JSON.parse(botLogs) : [];
    
    // 获取现有黑名单
    const blacklist = await env.LOGS.get('ua_blacklist');
    const list = blacklist ? JSON.parse(blacklist) : [];
    
    let addedCount = 0;
    const addedUAs = [];
    
    // 分析 Bot 日志中的 User-Agent
    const uaStats = {};
    logs.forEach(log => {
      const ua = log.userAgent;
      if (!ua || ua === 'unknown') return;
      
      if (!uaStats[ua]) {
        uaStats[ua] = { count: 0, paths: new Set() };
      }
      uaStats[ua].count++;
      uaStats[ua].paths.add(log.path);
    });
    
    // 检测恶意 User-Agent
    for (const [ua, stats] of Object.entries(uaStats)) {
      // 检查是否匹配恶意模式
      let isMalicious = false;
      let matchedPattern = '';
      
      for (const pattern of MALICIOUS_UA_PATTERNS) {
        if (pattern.test(ua)) {
          isMalicious = true;
          matchedPattern = pattern.toString();
          break;
        }
      }
      
      // 检查是否高频访问（可能是攻击）
      const isHighFrequency = stats.count > 50;
      
      // 检查是否访问多个敏感路径（可能是扫描）
      const sensitivePaths = ['/admin', '/api', '/login', '/wp-admin', '/phpmyadmin'];
      const sensitivePathCount = Array.from(stats.paths).filter(p => 
        sensitivePaths.some(sp => p.includes(sp))
      ).length;
      const isScanning = sensitivePathCount >= 3;
      
      // 如果满足任一条件，添加到黑名单
      if ((isMalicious || isHighFrequency || isScanning) && 
          !list.some(item => item.userAgent === ua)) {
        let reason = '';
        if (isMalicious) {
          reason = `自动检测：匹配恶意模式 ${matchedPattern}`;
        } else if (isHighFrequency) {
          reason = `自动检测：高频访问（${stats.count} 次）`;
        } else if (isScanning) {
          reason = `自动检测：疑似扫描行为（访问 ${sensitivePathCount} 个敏感路径）`;
        }
        
        list.push({
          userAgent: ua,
          reason,
          addedAt: new Date().toISOString(),
          hitCount: stats.count
        });
        
        addedCount++;
        addedUAs.push({ ua, reason });
      }
    }
    
    // 保存更新后的黑名单
    if (addedCount > 0) {
      await env.LOGS.put('ua_blacklist', JSON.stringify(list));
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `自动检测完成，新增 ${addedCount} 个恶意 User-Agent`,
      added: addedUAs,
      total: list.length
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
