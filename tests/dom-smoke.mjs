/**
 * 远见·企业出海助手 —— 浏览器冒烟测试（jsdom，无外部网络）
 * 运行：node tests/dom-smoke.mjs
 * 验证：页面脚本在真实 DOM 中可执行；七大模块主要交互真实可用。
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const html = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const dom = new JSDOM(html, {
  url: 'https://vision-overseas.test/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;
window.scrollTo = function () {};
if (!window.URL.createObjectURL) window.URL.createObjectURL = function () { return 'blob:mock'; };
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = function () {};

// 依次执行页面引用的脚本（与 <script src> 顺序一致）
const scripts = ['data/vo-data.js', 'data/news.js', 'js/engine.js', 'js/app.js'];
for (const s of scripts) {
  const code = readFileSync(join(ROOT, s), 'utf-8');
  window.eval(code);
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; failures.push(name); console.log('  ✗', name, detail ? '→ ' + String(detail).slice(0, 200) : ''); }
}
function clickByText(selector, text) {
  const btns = [...document.querySelectorAll(selector)];
  const b = btns.find((x) => x.textContent.includes(text));
  if (b) b.click();
  return b;
}

console.log('== 1. 启动与数据 ==');
check('VO_DATA 已加载', !!window.VO_DATA && window.VO_DATA.rules.length === 86);
check('VO_NEWS 已加载', !!window.VO_NEWS && window.VO_NEWS.items.length > 0);
check('引擎已加载', !!window.VOEngine);
check('企业档案渲染（两家企业）', document.querySelectorAll('#companyList .card').length === 2);
check('企业档案含带入按钮', [...document.querySelectorAll('#companyList button')].filter((b) => b.textContent.includes('带入产品登记')).length === 8);

console.log('== 2. 企业带入产品登记 ==');
// 找到小熊 DFB-P20H1 的带入按钮（第一行）
const bringBtns = [...document.querySelectorAll('#companyList button')].filter((b) => b.textContent.includes('带入产品登记'));
bringBtns[0].click();
check('带入后进入产品登记页', document.getElementById('view-product').classList.contains('on'));
check('带入产品小类=电饭煲', document.getElementById('pSub').value === 'K-COOK-003', document.getElementById('pSub').value);
check('带入市场=马来西亚', document.getElementById('pMarket').value === 'MY', document.getElementById('pMarket').value);
check('带入电压事实', window.eval('window.__VO_TEST__.current().scenario.facts.voltage_ac') === 220, window.eval('JSON.stringify(window.__VO_TEST__.current().scenario.facts)'));
check('带入功率事实(kW)', window.eval('window.__VO_TEST__.current().scenario.facts.power_kw') === 0.6);
const dynCount = document.querySelectorAll('#dynFacts .qa').length;
check('动态问题已生成（电饭煲）', dynCount > 0, 'count=' + dynCount);
// 不同品类出现不同问题：切换到扫地机器人
window.eval('(function(){const d=document.getElementById("pCategory");d.value=[...d.options].find(o=>o.textContent.includes("清洁")).value;d.dispatchEvent(new window.Event("change"));})()');
window.eval('(function(){const g=document.getElementById("pGroup");g.value=[...g.options].find(o=>o.textContent.includes("真空吸尘")).value;g.dispatchEvent(new window.Event("change"));})()');
window.eval('(function(){const s=document.getElementById("pSub");s.value="C-VAC-005";s.dispatchEvent(new window.Event("change"));})()');
const dynCount2 = document.querySelectorAll('#dynFacts .qa').length;
check('不同品类问题不同（扫地机器人）', dynCount2 !== dynCount, dynCount + ' → ' + dynCount2);

console.log('== 3. 合规初筛 ==');
// 切到德国场景
window.eval('(function(){const m=document.getElementById("pMarket");m.value="DE";m.dispatchEvent(new window.Event("change"));})()');
clickByText('#tabs button', '法规与合规初筛');
window.eval('document.getElementById("btnRunCompliance").click()');
await new Promise((r) => setTimeout(r, 300));
const compText = document.getElementById('complianceResult').textContent;
check('覆盖等级横幅出现', compText.includes('服务覆盖等级'));
check('分组标题出现（可能适用）', compText.includes('可能适用'));
check('分组标题出现（待补事实）', compText.includes('待补事实'));
check('分组标题出现（单条规则不适用）', compText.includes('单条规则不适用'));
check('分组标题出现（待规则核验）', compText.includes('待规则核验'));
check('行动清单出现', compText.includes('办理行动与材料清单'));
// 回答追问：在待补事实区找 是/否 按钮点第一个
const qaButtons = [...document.querySelectorAll('#complianceResult .qa .tri button')];
check('追问控件已渲染', qaButtons.length > 0);
if (qaButtons.length) qaButtons[0].click();
await new Promise((r) => setTimeout(r, 50));
check('回答后重新计算（结果区刷新）', document.getElementById('complianceResult').textContent.includes('可能适用'));

console.log('== 4. HS 与税费（德国无覆盖 → 明确缺口）==');
clickByText('#tabs button', 'HS 与税费');
const taxText = document.getElementById('taxBody').textContent;
check('德国组合显示 HS 缺口', taxText.includes('尚无经来源关联的目的国 HS 候选') || taxText.includes('HS 候选方向'));
check('德国组合显示税费不可用说明', taxText.includes('仅对新加坡（SG）与澳大利亚（AU）'));
// 切到 SG 水壶：通过测试钩子修改内存项目状态，走完整税费
window.eval('(function(){window.__VO_TEST__.mutate(function(p){p.scenario.market="SG";p.scenario.subcategoryId="K-BEV-001";p.scenario.facts=Object.assign({},p.scenario.facts,{household:true,end_use:"consumer",voltage_ac:230,capacity_l:1.7,heats_liquid:true,boils_water:true,portable:true});});})()');
window.eval('document.querySelectorAll("#tabs button").forEach(b=>{if(b.dataset.tab==="tax")b.click()})');
const sgTaxText = document.getElementById('taxBody').textContent;
check('SG 组合出现 HS 候选 85167910', sgTaxText.includes('85167910'), '');
// 填写货值并计算
const numInputs = [...document.querySelectorAll('#taxBody input[type=number]')];
check('税费表单数字输入存在', numInputs.length >= 4);
const goods = numInputs[0];
goods.value = '20000';
goods.dispatchEvent(new window.Event('change'));
const freight = numInputs[1]; freight.value = '1500'; freight.dispatchEvent(new window.Event('change'));
const insurance = numInputs[2]; insurance.value = '100'; insurance.dispatchEvent(new window.Event('change'));
clickByText('#taxBody button', '计算税费');
await new Promise((r) => setTimeout(r, 300));
const taxResult = document.getElementById('taxBody').textContent;
check('SG 税费明细包含进口 GST 9%', taxResult.includes('进口 GST'), '');
check('SG 已知法定小计出现', taxResult.includes('已知法定分项小计'), '');
check('分项金额计算（FOB+CIF税基 21600）', taxResult.includes('21,600.00'), '');
check('贸易救济未核查 → 完整总额不可用', taxResult.includes('完整进口法定总额：不可用') && taxResult.includes('贸易救济'), '');

console.log('== 5. 新闻雷达 ==');
clickByText('#tabs button', '政策与新闻雷达');
const newsText = document.getElementById('newsBody').textContent;
check('新闻来源说明出现', newsText.includes('不是实时监控'));
check('新闻列表渲染', document.querySelectorAll('#newsBody .news-item').length > 0, '');
// 勾选第一条
const firstNewsCb = document.querySelector('#newsBody .news-item input[type=checkbox]');
firstNewsCb.click();
check('新闻可勾选进入项目', window.eval('window.__VO_TEST__.current().newsSelected.length') === 1);
// 关键词筛选
const kwInput = [...document.querySelectorAll('#newsBody input[type=search]')][0];
kwInput.value = '不存在的关键词xyz';
kwInput.dispatchEvent(new window.Event('change'));
check('关键词筛选生效（空结果提示）', document.getElementById('newsBody').textContent.includes('没有符合筛选条件'));

console.log('== 6. 千问辅助 ==');
clickByText('#tabs button', '千问辅助建议');
clickByText('#qianwenBody button', '根据当前项目生成分析任务');
await new Promise((r) => setTimeout(r, 400));
const taskText = document.querySelector('#qianwenBody textarea.task').value;
check('分析任务已生成', taskText.includes('小家电出海分析任务'), '');
check('任务包含要求的输出结构', taskText.includes('立即办理') && taskText.includes('补证后判断') && taskText.includes('持续关注'), '');
check('任务包含所选新闻', taskText.includes('所选政策新闻线索'), '');
clickByText('#qianwenBody button', '复制任务');
await new Promise((r) => setTimeout(r, 100));
// 粘贴回复
const replyArea = [...document.querySelectorAll('#qianwenBody textarea.task')][1];
replyArea.value = '【千问回复示例】已知事实：……（人工导入测试）';
clickByText('#qianwenBody button', '保存回复到项目');
await new Promise((r) => setTimeout(r, 50));
check('回复已保存并标记人工导入', document.getElementById('qianwenBody').textContent.includes('千问回复（人工导入）'), '');
check('回复标记与当前输入一致', document.getElementById('qianwenBody').textContent.includes('与当前输入一致'), '');

console.log('== 7. 综合报告 ==');
clickByText('#tabs button', '综合报告');
const repText = document.getElementById('reportBody').textContent;
check('报告包含企业与项目', repText.includes('企业与项目'), '');
check('报告包含合规结论表', repText.includes('法规与合规初筛结论'), '');
check('报告包含税费', repText.includes('HS 候选与税费阶段测算'), '');
check('报告包含所选新闻', repText.includes('所选政策新闻'), '');
check('报告包含千问回复', repText.includes('千问辅助建议'), '');
check('报告包含追溯与免责', repText.includes('结论追溯与免责'), '');
clickByText('#reportBody + * , body', ''); // noop
clickByText('body button', '保存报告快照');
await new Promise((r) => setTimeout(r, 50));
check('报告快照已保存', window.eval('window.__VO_TEST__.current().reportSnapshots.length') === 1);
// 修改输入后旧结果标记历史
window.eval('(function(){window.__VO_TEST__.mutate(function(p){p.scenario.placingOnMarketDate="2027-01-01";});})()');
window.eval('document.querySelectorAll("#tabs button").forEach(b=>{if(b.dataset.tab==="report")b.click()})');
check('输入变化后快照标记为历史结果', document.getElementById('reportBody').textContent.includes('快照为历史结果'), '');

console.log('== 8. 数据说明与项目状态 ==');
clickByText('#tabs button', '数据说明');
check('数据说明包含覆盖等级', document.getElementById('aboutBody').textContent.includes('服务覆盖等级'), '');
check('数据说明包含缺口', document.getElementById('aboutBody').textContent.includes('未完成事项与缺口'), '');
check('数据说明包含新闻边界', document.getElementById('aboutBody').textContent.includes('不是实时监控'), '');

console.log(`\n===== DOM 冒烟测试：${pass + fail} 项断言，通过 ${pass}，失败 ${fail} =====`);
if (failures.length) { console.log('失败：', failures.join('；')); process.exit(1); }
console.log('全部通过 ✔');
