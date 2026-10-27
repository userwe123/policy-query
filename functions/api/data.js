// 数据管理 API
// POST /api/data/add - 添加数据（支持批量）
// POST /api/data/update - 更新数据
// POST /api/data/delete - 删除数据（支持批量）
// POST /api/data/import - 导入压缩包
// GET /api/data/list - 获取数据列表
// POST /api/data/import-delete - 导入表格删除

// 上传文件到 GitHub
async function uploadToGitHub(filename, content, token) {
  const url = `https://api.github.com/repos/userwe123/policy-query/contents/policies/${filename}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Policy-Query-System'
    },
    body: JSON.stringify({
      message: `Update ${filename}`,
      content: content,
      branch: 'main'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub upload failed: ${error}`);
  }
  
  return await response.json();
}

// 获取 GitHub 文件
async function getGitHubFile(path, token) {
  const url = `https://api.github.com/repos/userwe123/policy-query/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Policy-Query-System'
    }
  });
  
  if (!response.ok) {
    return null;
  }
  
  return await response.json();
}

// 删除 GitHub 文件
async function deleteGitHubFile(path, sha, token) {
  const url = `https://api.github.com/repos/userwe123/policy-query/contents/${path}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Policy-Query-System'
    },
    body: JSON.stringify({
      message: `Delete ${path}`,
      sha: sha,
      branch: 'main'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub delete failed: ${error}`);
  }
  
  return await response.json();
}

// 更新 data.json
async function updateDataJson(data, token) {
  // 获取当前 data.json 的 SHA
  const currentFile = await getGitHubFile('data.json', token);
  const sha = currentFile ? currentFile.sha : undefined;
  
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  
  const url = `https://api.github.com/repos/userwe123/policy-query/contents/data.json`;
  
  const body = {
    message: 'Update data.json',
    content: content,
    branch: 'main'
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Policy-Query-System'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Update data.json failed: ${error}`);
  }
  
  return await response.json();
}

// 获取当前数据
async function getCurrentData(token) {
  const file = await getGitHubFile('data.json', token);
  if (!file) {
    return [];
  }
  
  const content = atob(file.content);
  return JSON.parse(content);
}

/**
 * 添加数据
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // GitHub Token（从环境变量获取）
  const GITHUB_TOKEN = env.GITHUB_TOKEN || 'ghp_YwNTwS5gTjZtgMPCwRwN2jwq9kTnJN0XkLmN';
  
  try {
    const data = await request.json();
    
    // 添加数据
    if (path === '/api/data/add') {
      const policies = data.policies || [];
      
      if (policies.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: '没有要添加的数据'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 获取当前数据
      const currentData = await getCurrentData(GITHUB_TOKEN);
      
      // 添加新数据（去重）
      const existingKeys = new Set(currentData.map(p => `${p.vin}_${p.type}_${p.policy_no}`));
      let addedCount = 0;
      
      policies.forEach(policy => {
        const key = `${policy.vin}_${policy.type}_${policy.policy_no}`;
        if (!existingKeys.has(key)) {
          currentData.push(policy);
          existingKeys.add(key);
          addedCount++;
        }
      });
      
      // 更新 data.json
      await updateDataJson(currentData, GITHUB_TOKEN);
      
      return new Response(JSON.stringify({
        success: true,
        message: `成功添加 ${addedCount} 条保单数据`,
        added: addedCount,
        total: currentData.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 更新数据
    if (path === '/api/data/update') {
      const policies = data.policies || [];
      
      if (policies.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: '没有要更新的数据'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 获取当前数据
      const currentData = await getCurrentData(GITHUB_TOKEN);
      
      // 按 VIN 分组
      const vinGroups = {};
      currentData.forEach(p => {
        if (!vinGroups[p.vin]) {
          vinGroups[p.vin] = { jqx: [], syx: [] };
        }
        if (p.type === '交强险') {
          vinGroups[p.vin].jqx.push(p);
        } else if (p.type === '商业险') {
          vinGroups[p.vin].syx.push(p);
        }
      });
      
      let updatedCount = 0;
      let expiredCount = 0;
      
      // 处理更新逻辑
      policies.forEach(newPolicy => {
        const vin = newPolicy.vin;
        
        if (!vinGroups[vin]) {
          // 新车辆，直接添加
          currentData.push(newPolicy);
          updatedCount++;
        } else {
          // 已存在的车辆，检查是否需要更新
          const existingPolicies = vinGroups[vin];
          const type = newPolicy.type;
          const typeKey = type === '交强险' ? 'jqx' : 'syx';
          
          // 查找是否已有相同保单号的记录
          const existingIndex = existingPolicies[typeKey].findIndex(
            p => p.policy_no === newPolicy.policy_no
          );
          
          if (existingIndex >= 0) {
            // 更新现有保单
            const indexInData = currentData.findIndex(
              p => p.vin === vin && p.type === type && p.policy_no === newPolicy.policy_no
            );
            if (indexInData >= 0) {
              currentData[indexInData] = newPolicy;
              updatedCount++;
            }
          } else {
            // 新保单，添加
            currentData.push(newPolicy);
            updatedCount++;
          }
        }
      });
      
      // 检查到期未续保的情况
      // 如果导入的数据中某个 VIN 只有交强险没有商业险，且原数据有商业险，则删除商业险
      const importVinTypes = {};
      policies.forEach(p => {
        if (!importVinTypes[p.vin]) {
          importVinTypes[p.vin] = { jqx: false, syx: false };
        }
        if (p.type === '交强险') importVinTypes[p.vin].jqx = true;
        if (p.type === '商业险') importVinTypes[p.vin].syx = true;
      });
      
      // 删除到期的保单
      const toDelete = [];
      currentData.forEach((policy, index) => {
        const vin = policy.vin;
        if (importVinTypes[vin]) {
          // 该车辆在导入数据中
          if (policy.type === '交强险' && !importVinTypes[vin].jqx && vinGroups[vin].jqx.length > 0) {
            // 导入数据没有交强险，但原数据有，视为到期
            toDelete.push(index);
            expiredCount++;
          } else if (policy.type === '商业险' && !importVinTypes[vin].syx && vinGroups[vin].syx.length > 0) {
            // 导入数据没有商业险，但原数据有，视为到期
            toDelete.push(index);
            expiredCount++;
          }
        }
      });
      
      // 从后往前删除，避免索引变化
      toDelete.sort((a, b) => b - a).forEach(index => {
        currentData.splice(index, 1);
      });
      
      // 更新 data.json
      await updateDataJson(currentData, GITHUB_TOKEN);
      
      return new Response(JSON.stringify({
        success: true,
        message: `更新完成：${updatedCount} 条更新，${expiredCount} 条到期删除`,
        updated: updatedCount,
        expired: expiredCount,
        total: currentData.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 删除数据
    if (path === '/api/data/delete') {
      const vins = data.vins || [];
      
      if (vins.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: '没有要删除的数据'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 获取当前数据
      const currentData = await getCurrentData(GITHUB_TOKEN);
      
      // 删除指定 VIN 的所有数据
      const vinSet = new Set(vins);
      const newData = currentData.filter(p => !vinSet.has(p.vin));
      const deletedCount = currentData.length - newData.length;
      
      // 更新 data.json
      await updateDataJson(newData, GITHUB_TOKEN);
      
      return new Response(JSON.stringify({
        success: true,
        message: `成功删除 ${deletedCount} 条保单数据（${vins.length} 辆车）`,
        deleted: deletedCount,
        vehicles: vins.length,
        total: newData.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 导入表格删除
    if (path === '/api/data/import-delete') {
      const vins = data.vins || [];
      
      if (vins.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: '表格中没有识别到车架号'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 获取当前数据
      const currentData = await getCurrentData(GITHUB_TOKEN);
      
      // 删除指定 VIN 的所有数据
      const vinSet = new Set(vins);
      const newData = currentData.filter(p => !vinSet.has(p.vin));
      const deletedCount = currentData.length - newData.length;
      
      // 更新 data.json
      await updateDataJson(newData, GITHUB_TOKEN);
      
      return new Response(JSON.stringify({
        success: true,
        message: `成功删除 ${deletedCount} 条保单数据（${vins.length} 辆车）`,
        deleted: deletedCount,
        vehicles: vins.length,
        total: newData.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: '未知的操作'
    }), {
      status: 404,
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
 * 获取数据列表
 */
export async function onRequestGet(context) {
  const { env } = context;
  const GITHUB_TOKEN = env.GITHUB_TOKEN || 'ghp_YwNTwS5gTjZtgMPCwRwN2jwq9kTnJN0XkLmN';
  
  try {
    const data = await getCurrentData(GITHUB_TOKEN);
    
    // 按 VIN 分组统计
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
