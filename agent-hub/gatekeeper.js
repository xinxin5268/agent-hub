/**
 * gatekeeper.js — 6道门禁校验机制
 * 
 * 参考天命设计，每章写完后执行6道校验，通过才能落地。
 * 
 * 用法:
 *   const gk = new GateKeeper('facts.jsonl');
 *   const result = await gk.check(chapterText, chapterMeta);
 *   if (result.passed) { /* 落地 */ }
 *   else { /* 返回失败原因 */ }
 */

const fs = require('fs');
const path = require('path');

class GateKeeper {
  constructor(factsPath = 'facts.jsonl') {
    this.factsPath = factsPath;
    this.facts = this._loadFacts();
  }

  // ─── 加载 facts.jsonl ─────────────────────────────
  _loadFacts() {
    if (!fs.existsSync(this.factsPath)) return [];
    return fs.readFileSync(this.factsPath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean);
  }

  // ─── 6道门禁 ──────────────────────────────────────

  /**
   * 门禁1: 协议解析
   * 解析章节中的 ---CHANGES--- 声明
   */
  checkProtocol(chapterText) {
    const changesRegex = /---CHANGES---\n([\s\S]*?)\n---END-CHANGES---/;
    const match = chapterText.match(changesRegex);
    if (!match) {
      return { passed: false, reason: '缺少 ---CHANGES--- 声明块', severity: 'error' };
    }
    const changesBlock = match[1];
    const changes = [];
    const lines = changesBlock.split('\n');
    for (const line of lines) {
      const changeMatch = line.match(/^(\w+)\s*[:：]\s*(.+)$/);
      if (changeMatch) {
        changes.push({ field: changeMatch[1], value: changeMatch[2].trim() });
      }
    }
    return { passed: changes.length > 0, reason: changes.length === 0 ? 'CHANGES 块为空' : null, changes };
  }

  /**
   * 门禁2: 引用校验
   * 新章节引用的事实是否在 facts.jsonl 中有记录
   */
  checkReferences(chapterText) {
    // 提取所有角色名、地名
    const knownEntities = new Set();
    for (const fact of this.facts) {
      if (fact.type === 'character') knownEntities.add(fact.name);
      if (fact.type === 'location') knownEntities.add(fact.name);
    }

    // 模拟实体提取（实际应用中用 NER）
    const referencedEntities = [];
    for (const entity of knownEntities) {
      if (chapterText.includes(entity)) {
        referencedEntities.push(entity);
      }
    }

    // 检查是否有未注册的明显新实体
    // 这里简化处理：只检查已知实体是否被正确引用
    const issues = [];
    for (const fact of this.facts) {
      if (fact.type === 'character' && fact.status === 'dead' && chapterText.includes(fact.name)) {
        issues.push(`角色 "${fact.name}" 已死亡，但本章中出现了`);
      }
    }

    return { passed: issues.length === 0, reason: issues.join('; '), referencedEntities };
  }

  /**
   * 门禁3: 一致性校验
   * 角色属性/关系/位置是否与历史一致
   */
  checkConsistency(chapterText) {
    const issues = [];
    
    for (const fact of this.facts) {
      if (fact.type !== 'character') continue;
      
      // 检查位置变化
      const locationPattern = new RegExp(`${fact.name}.*?(?:在|来到|前往|回到|离开)\\s*[^。，！？]{1,20}`);
      const locationMatch = chapterText.match(locationPattern);
      
      if (locationMatch && fact.location) {
        const mentionedLocation = locationMatch[0];
        // 如果新位置和历史位置不同，记录变化
        if (!mentionedLocation.includes(fact.location)) {
          issues.push({ 
            type: 'location_change', 
            character: fact.name,
            oldLocation: fact.location,
            newHint: mentionedLocation.substring(0, 30)
          });
        }
      }
    }

    // 允许位置变化（角色可以移动），但需要记录
    return { 
      passed: true, // 位置变化不阻塞，但需记录
      locationChanges: issues.filter(i => i.type === 'location_change'),
      note: issues.length > 0 ? `${issues.length} 个角色位置发生变化，已记录` : null
    };
  }

  /**
   * 门禁4: 未知实体检测
   * 是否出现了未注册的新角色/地点
   */
  checkUnknownEntities(chapterText) {
    const knownNames = new Set();
    for (const fact of this.facts) {
      if (fact.type === 'character') knownNames.add(fact.name);
      if (fact.type === 'location') knownNames.add(fact.name);
    }

    // 提取中文人名（2-4字中文）
    const nameRegex = /[\u4e00-\u9fff]{2,4}(?:先生|小姐|女士|老师|博士|局长|经理|医生|警官)?/g;
    const allNames = new Set(chapterText.match(nameRegex) || []);

    const unknownNames = [];
    for (const name of allNames) {
      if (!knownNames.has(name) && !['先生','小姐','女士','老师','博士','局长','经理','医生','警官','警察','司机','老板'].includes(name)) {
        unknownNames.push(name);
      }
    }

    return { 
      passed: unknownNames.length === 0, 
      reason: unknownNames.length > 0 ? `发现未注册实体: ${unknownNames.slice(0,5).join(', ')}` : null,
      unknownEntities: unknownNames
    };
  }

  /**
   * 门禁5: 描写一致性
   * 角色的外貌/语气/习惯描写是否守恒
   */
  checkDescriptionConsistency(chapterText) {
    const issues = [];
    
    for (const fact of this.facts) {
      if (fact.type !== 'character' || !fact.traits) continue;
      
      const traits = fact.traits;
      
      // 检查外貌描写是否一致
      if (traits.appearance) {
        for (const [key, value] of Object.entries(traits.appearance)) {
          const contradictPattern = new RegExp(`${fact.name}.*?(?:${value === '高' ? '矮' : value === '矮' ? '高' : value === '瘦' ? '胖' : value === '胖' ? '瘦' : ''})`);
          if (contradictPattern.source.includes('|')) continue; // 跳过复杂匹配
          const match = chapterText.match(contradictPattern);
          if (match) {
            issues.push(`角色 "${fact.name}" 的 "${key}" 属性与记录不一致（记录: ${value}）`);
          }
        }
      }
    }

    return { passed: issues.length === 0, reason: issues.join('; '), descriptionIssues: issues };
  }

  /**
   * 门禁6: 蓝图出场检查
   * 该出现的人是否出现了
   */
  checkBlueprints(chapterText, expectedCharacters = []) {
    if (expectedCharacters.length === 0) {
      return { passed: true, note: '无蓝图要求' };
    }

    const missing = [];
    for (const charName of expectedCharacters) {
      if (!chapterText.includes(charName)) {
        missing.push(charName);
      }
    }

    return { 
      passed: missing.length === 0, 
      reason: missing.length > 0 ? `蓝图角色未出场: ${missing.join(', ')}` : null,
      missingCharacters: missing
    };
  }

  // ─── 全量校验 ──────────────────────────────────────

  async check(chapterText, options = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      chapterTitle: options.title || '未知章节',
      gates: {},
      passed: false,
      summary: []
    };

    // 门禁1: 协议解析
    results.gates.protocol = this.checkProtocol(chapterText);
    results.summary.push({
      gate: 1,
      name: '协议解析',
      passed: results.gates.protocol.passed,
      detail: results.gates.protocol.reason || '通过'
    });

    // 门禁2: 引用校验
    results.gates.references = this.checkReferences(chapterText);
    results.summary.push({
      gate: 2,
      name: '引用校验',
      passed: results.gates.references.passed,
      detail: results.gates.references.reason || '通过'
    });

    // 门禁3: 一致性校验
    results.gates.consistency = this.checkConsistency(chapterText);
    results.summary.push({
      gate: 3,
      name: '一致性校验',
      passed: results.gates.consistency.passed,
      detail: results.gates.consistency.note || '通过'
    });

    // 门禁4: 未知实体检测
    results.gates.unknownEntities = this.checkUnknownEntities(chapterText);
    results.summary.push({
      gate: 4,
      name: '未知实体检测',
      passed: results.gates.unknownEntities.passed,
      detail: results.gates.unknownEntities.reason || '通过'
    });

    // 门禁5: 描写一致性
    results.gates.descriptionConsistency = this.checkDescriptionConsistency(chapterText);
    results.summary.push({
      gate: 5,
      name: '描写一致性',
      passed: results.gates.descriptionConsistency.passed,
      detail: results.gates.descriptionConsistency.reason || '通过'
    });

    // 门禁6: 蓝图出场检查
    results.gates.blueprints = this.checkBlueprints(chapterText, options.expectedCharacters || []);
    results.summary.push({
      gate: 6,
      name: '蓝图出场检查',
      passed: results.gates.blueprints.passed,
      detail: results.gates.blueprints.reason || '通过'
    });

    // 最终判定：门禁1必须通过，其他允许警告但不阻塞
    const criticalGates = ['protocol'];
    const criticalPassed = criticalGates.every(g => results.gates[g].passed);
    
    // 非关键门禁超过3个失败也阻塞
    const nonCriticalFailures = ['references', 'unknownEntities', 'descriptionConsistency', 'blueprints']
      .filter(g => !results.gates[g].passed).length;

    results.passed = criticalPassed && nonCriticalFailures < 3;

    if (!results.passed) {
      const failedGates = results.summary.filter(s => !s.passed).map(s => s.name);
      results.rejectReason = `未通过门禁: ${failedGates.join(', ')}`;
    }

    return results;
  }
}

module.exports = GateKeeper;

// ─── CLI 使用 ────────────────────────────────────────
if (require.main === module) {
  const [,, chapterFile, factsFile] = process.argv;
  if (!chapterFile) {
    console.error('用法: node gatekeeper.js <chapter.md> [facts.jsonl]');
    process.exit(1);
  }
  const chapterText = fs.readFileSync(chapterFile, 'utf-8');
  const gk = new GateKeeper(factsFile);
  gk.check(chapterText).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  });
}
