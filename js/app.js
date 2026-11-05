/*! 远见·企业出海助手 —— 主应用（单页，全部模块共享同一项目情景） */
(function () {
  'use strict';

  var D = window.VO_DATA;
  var E = window.VOEngine;
  var NEWS = window.VO_NEWS || { meta: { exportedAt: '', sources: [], allFailed: false, snapshotNote: '新闻数据缺失' }, items: [] };

  /* ================= 小工具 ================= */
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function toast(msg, type) {
    var wrap = $('toastWrap');
    var t = h('div', { class: 'toast ' + (type || '') }, msg);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3100);
  }
  function fmtMoney(v, currency) {
    if (v === null || v === undefined) return '—';
    return currency + ' ' + Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 10);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDateTime(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d)) return String(s);
    return fmtDate(s) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function newsId(it) { return E.hashInputs({ u: it.url, t: it.title }); }
  function newsDate(it) {
    var d = new Date(it.date || '');
    return isNaN(d) ? String(it.date || '') : d.toISOString().slice(0, 10);
  }
  var sourceMap = {};
  D.sources.forEach(function (s) { sourceMap[s.id] = s; });
  function sourceLink(id) {
    var s = sourceMap[id];
    if (!s) return h('span', { class: 'tag' }, id);
    var a = h('a', { href: s.url || '#', target: '_blank', rel: 'noopener noreferrer' }, s.title || id);
    return h('span', { class: 'tag brand', title: (s.verification ? '核验状态：' + s.verification + '；' : '') + '核验日期：' + (s.checkedAt || '未记录') }, a);
  }
  function sourceLinks(ids) {
    var wrap = h('span', {});
    (ids || []).slice(0, 6).forEach(function (id, i) {
      if (i) wrap.appendChild(document.createTextNode(' '));
      wrap.appendChild(sourceLink(id));
    });
    if ((ids || []).length > 6) wrap.appendChild(h('span', { class: 'subhint' }, ' 等 ' + ids.length + ' 条来源'));
    return wrap;
  }
  function lookupField(key) {
    var f = null;
    D.fields.forEach(function (x) { if (x.key === key || x.ruleKey === key) f = x; });
    if (!f) D.ruleFields.forEach(function (x) { if (x.key === key) f = x; });
    if (!f && EXTRA_FIELDS[key]) f = EXTRA_FIELDS[key];
    return f;
  }
  function optionsOf(field) {
    var opts = String(field.options || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    if (field.type === 'boolean' || (field.type === 'select' && opts[0] === 'yes' && opts.indexOf('no') >= 0)) {
      return [{ v: true, label: '是' }, { v: false, label: '否' }];
    }
    return opts.filter(function (o) { return o !== 'unknown'; }).map(function (o) {
      var label = o === 'yes' ? '是' : o === 'no' ? '否' : o;
      return { v: o === 'yes' ? true : o === 'no' ? false : o, label: label };
    });
  }
  function fieldType(field) {
    if (field.type === 'number' || field.type === 'integer') return 'number';
    if (field.type === 'date') return 'date';
    var opts = optionsOf(field);
    if (field.type === 'tri_state' || (opts.length === 2 && (opts[0].v === true) && (opts[1].v === false))) return 'tri';
    return 'select';
  }

  // 补充字段定义：原始规则使用、但 80 项字段字典未覆盖的产品事实
  var EXTRA_FIELDS = {
    boils_water: { key: 'boils_water', name: '是否以煮沸水为主要功能', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    electrical_class: { key: 'electrical_class', name: '电气类别（防电击保护）', type: 'select', options: 'Class I|Class II|Class III|unknown', unknownAllowed: true },
    detachable_cord: { key: 'detachable_cord', name: '电源线是否可拆卸', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    power_kw: { key: 'power_kw', name: '额定输入功率', type: 'number', unit: 'kW', unknownAllowed: true },
    voltage_dc: { key: 'voltage_dc', name: '直流电压', type: 'number', unit: 'V', unknownAllowed: true },
    registration_expired: { key: 'registration_expired', name: '已有注册是否已过期（如适用）', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    modified: { key: 'modified', name: '与已注册型号相比是否经过修改', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    iot: { key: 'iot', name: '是否具备物联网/联网功能', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    complete_unit: { key: 'complete_unit', name: '是否为完整设备（非部件/散件）', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    set_goods: { key: 'set_goods', name: '是否作为成套商品申报', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    packaging_turnover: { key: 'packaging_turnover', name: '包装年营业额（如适用）', type: 'number', unit: '等值', unknownAllowed: true },
    specified_packaging: { key: 'specified_packaging', name: '包装类型是否符合目录口径', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
    special_claim: { key: 'special_claim', name: '是否作出特殊宣称（如健康/抗菌）', type: 'select', options: 'yes|no|unknown', unknownAllowed: true },
  };

  /* ================= 状态与保存 ================= */
  var LS_KEY = 'vo-workbench-v2';
  var state = null;
  function defaultProject(name) {
    var now = new Date().toISOString();
    return {
      id: 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || '新项目',
      companyId: '', companyName: '',
      createdAt: now, updatedAt: now,
      scenario: { market: '', subcategoryId: '', placingOnMarketDate: '', importDate: '', role: '', facts: {}, factsUnknown: {}, factNotes: {} },
      tax: { goodsValue: '', currency: 'SGD', fxRate: '', fxSource: '', incoterm: 'FOB', priceBasis: 'FOB', freight: '', insurance: '', multipleSales: false, lsp: '', lastBuyerDeclarant: '', importRoute: 'bulk', specialValuation: 'no', remedyCheck: '', confirmedCustomsValue: '', valuationConfirmed: false, customsValueConfirmed: '', origin: 'CN', originPreference: 'none', psrSatisfied: '', docsValid: '', transportCond: '', transport: 'sea', salesState: 'VIC', quantity: '' },
      hsChoice: '',
      todoState: {},
      newsSelected: [],
      qianwen: { taskText: '', taskHash: '', taskAt: '', responses: [] },
      reportSnapshots: []
    };
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { state = JSON.parse(raw); if (!state.projects || !state.projects.length) throw new Error('empty'); }
      else throw new Error('empty');
    } catch (e) {
      state = { v: 2, projects: [defaultProject('示例项目')], currentId: null };
      state.currentId = state.projects[0].id;
      persist(false);
    }
    if (!state.currentId || !state.projects.some(function (p) { return p.id === state.currentId; })) {
      state.currentId = state.projects[0].id;
    }
  }
  var saveTimer = null;
  function persist(feedback) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      $('saveHint').textContent = '已保存到本机浏览器 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
      if (feedback) toast('已保存到本机浏览器（仅本设备，非多人协作）', 'ok');
    } catch (e) {
      $('saveHint').textContent = '本机保存不可用（浏览器隐私模式或存储被禁用），本次修改仅当前会话有效';
      if (feedback) toast('保存失败：' + e.message, 'err');
    }
  }
  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { persist(false); }, 400);
  }
  function proj() {
    return state.projects.find(function (p) { return p.id === state.currentId; });
  }
  function touch() { proj().updatedAt = new Date().toISOString(); queueSave(); }

  /* ---------- 输入指纹 ---------- */
  function inputHash() {
    var p = proj();
    return E.hashInputs({
      market: p.scenario.market, sub: p.scenario.subcategoryId,
      facts: p.scenario.facts, factsUnknown: p.scenario.factsUnknown,
      dates: [p.scenario.placingOnMarketDate, p.scenario.importDate], role: p.scenario.role,
      tax: p.tax, hs: p.hsChoice, news: p.newsSelected
    });
  }

  /* ---------- 事实读写 ---------- */
  function setFact(key, val) {
    var p = proj().scenario;
    if (val === 'unknown') { delete p.facts[key]; p.factsUnknown[key] = true; }
    else { p.factsUnknown[key] = false; if (val === '' || val === undefined) delete p.facts[key]; else p.facts[key] = val; }
    touch();
  }
  function getFact(key) {
    var p = proj().scenario;
    if (p.factsUnknown[key]) return 'unknown';
    var v = p.facts[key];
    return v === undefined ? '' : v;
  }
  function engineFacts() {
    var p = proj().scenario;
    var out = {};
    Object.keys(p.facts).forEach(function (k) {
      var v = p.facts[k];
      if (v === '' || v === null || v === undefined) return;
      if (v === 'true') out[k] = true;
      else if (v === 'false') out[k] = false;
      else out[k] = v;
    });
    return out;
  }

  /* ================= 选项数据 ================= */
  var ruleJ = {};
  D.rules.forEach(function (r) { ruleJ[r.jurisdiction] = true; });
  var JUR = {};
  D.jurisdictions.forEach(function (j) { JUR[j.code] = j; });
  function chainOf(code) { return E.jurisdictionChain(D, code); }
  function marketHasRules(code) {
    return chainOf(code).some(function (c) { return ruleJ[c]; });
  }
  function subById(id) { return D.subcategories.find(function (s) { return s.id === id; }) || null; }

  /* ================= 标签导航 ================= */
  var currentTab = 'company';
  function showTab(name) {
    currentTab = name;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + name); });
    window.scrollTo(0, 0);
    renderTab(name);
  }
  function renderTab(name) {
    if (name === 'company') renderCompanies();
    else if (name === 'product') renderProduct();
    else if (name === 'compliance') renderCompliance(true);
    else if (name === 'tax') renderTax();
    else if (name === 'news') renderNews();
    else if (name === 'qianwen') renderQianwen();
    else if (name === 'report') renderReport();
    else if (name === 'about') renderAbout();
  }

  /* ================= 模块 1：企业研究档案 ================= */
  function renderCompanies() {
    var host = $('companyList');
    clear(host);
    D.companies.forEach(function (c) {
      var card = h('div', { class: 'card' });
      card.appendChild(h('h3', {}, c.fullName, h('span', { class: 'tag brand', style: 'margin-left:8px' }, '企业研究档案')));
      card.appendChild(h('p', { class: 'subhint' }, c.tagline));
      card.appendChild(h('p', { class: 'subhint' }, c.scopeNote));

      // 研究路线
      var route = h('details', { class: 'box' });
      route.appendChild(h('summary', {}, c.researchRoute.title));
      route.appendChild(h('p', { class: 'banner warn' }, c.researchRoute.disclaimer));
      var ol = h('ol', {});
      c.researchRoute.steps.forEach(function (s) { ol.appendChild(h('li', {}, s)); });
      route.appendChild(ol);
      route.appendChild(h('p', { class: 'subhint' }, '研究路线依据（点击打开原文）：'));
      c.researchRoute.sources.forEach(function (s) {
        route.appendChild(h('div', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label)));
      });
      card.appendChild(route);

      // 市场状态
      var mt = h('table', { class: 't' });
      mt.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '市场'), h('th', {}, '研究状态'), h('th', {}, '说明'))));
      var tb = h('tbody', {});
      c.markets.forEach(function (m) {
        tb.appendChild(h('tr', {}, h('td', {}, m.name), h('td', {}, h('span', { class: 'tag warn' }, m.status)), h('td', {}, m.note)));
      });
      mt.appendChild(tb);
      card.appendChild(mt);

      // 产品
      card.appendChild(h('h4', {}, '研究产品与待核实参数'));
      var pt = h('table', { class: 't' });
      pt.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '型号'), h('th', {}, '品类'), h('th', {}, '已核参数'), h('th', {}, '待核实'), h('th', {}, '来源'), h('th', {}, '操作'))));
      var pb = h('tbody', {});
      c.products.forEach(function (p) {
        var btn = h('button', { class: 'btn sm', onclick: function () { bringIn(c, p); } }, '带入产品登记');
        var src = h('div', {});
        p.sources.forEach(function (s) { src.appendChild(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label)); src.appendChild(h('br')); });
        pb.appendChild(h('tr', {},
          h('td', {}, h('b', {}, p.model)),
          h('td', {}, p.category),
          h('td', {}, p.facts),
          h('td', {}, h('span', { class: 'tag warn' }, '待核实'), p.pending),
          h('td', {}, src),
          h('td', {}, btn)));
      });
      pt.appendChild(pb);
      card.appendChild(pt);
      card.appendChild(h('p', { class: 'subhint' }, '带入时，参数标记为「企业档案（国内/官网版）」；出口版本（电压、插头、语言、认证配置）需重核，不能把国内型号当作出口型号。'));

      // 财报
      var ft = h('details', { class: 'box' });
      ft.appendChild(h('summary', {}, '财报中的海外业务、税费与退款（公开披露，核验日 2026-11-04）'));
      var ftab = h('table', { class: 't' });
      var fhead = h('thead', {}, h('tr', {}, h('th', {}, '期间'), h('th', {}, '项目'), h('th', {}, '金额及口径'), h('th', {}, '来源')));
      var fbody = h('tbody', {});
      c.finance.forEach(function (f) {
        fbody.appendChild(h('tr', {}, h('td', {}, f.period), h('td', {}, f.item), h('td', {}, f.value),
          h('td', {}, h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.src))));
      });
      ftab.appendChild(fhead); ftab.appendChild(fbody);
      ft.appendChild(ftab);
      ft.appendChild(h('p', { class: 'subhint' }, c.financeNote));
      card.appendChild(ft);

      host.appendChild(card);
    });
  }

  function bringIn(company, product) {
    var p = proj();
    p.companyId = company.id;
    p.companyName = company.name;
    p.scenario.subcategoryId = product.subcategoryId;
    var routeMarket = company.markets[0] ? company.markets[0].code : '';
    if (!p.scenario.market) p.scenario.market = routeMarket;
    var bf = product.bringFacts || {};
    var map = {
      household: 'household', endUse: 'end_use', voltageAc: 'voltage_ac', frequencyHz: 'frequency_hz',
      capacityL: 'capacity_l', mainFunction: 'main_function', wirelessPresent: 'wireless_present',
      internetConnected: 'internet_connected', batteryPresent: 'battery_present', foodContact: 'food_contact'
    };
    Object.keys(map).forEach(function (k) {
      if (bf[k] !== undefined) {
        p.scenario.facts[map[k]] = bf[k];
        p.scenario.factsUnknown[map[k]] = false;
        p.scenario.factNotes[map[k]] = '企业档案带入（' + product.model + ' 国内/官网版参数，出口版需重核）';
      }
    });
    if (bf.powerW) { p.scenario.facts.power_kw = bf.powerW / 1000; p.scenario.factsUnknown.power_kw = false; p.scenario.factNotes.power_kw = '企业档案带入（' + product.model + '）；国内版功率'; }
    p.scenario.facts.household = true;
    p.scenario.facts.end_use = 'consumer';
    p.scenario.factsUnknown.household = false;
    p.scenario.factsUnknown.end_use = false;
    p.scenario.factNotes.household = '企业档案带入（家用产品）';
    p.scenario.factNotes.end_use = '企业档案带入（面向消费者）';
    p.name = company.name + ' ' + product.model.split('（')[0] + ' 项目';
    touch();
    showTab('product');
    toast('已带入「' + product.model + '」研究参数。出口版参数与待核实项请继续核对。', 'ok');
  }

  /* ================= 模块 2：产品与市场登记 ================= */
  function renderProduct() {
    var p = proj();
    $('pName').value = p.name;
    $('pCompany').value = p.companyName || '';
    $('pPlacingDate').value = p.scenario.placingOnMarketDate || '';
    $('pImportDate').value = p.scenario.importDate || '';
    $('pRole').value = p.scenario.role || '';

    // 目的地
    var sel = $('pMarket');
    clear(sel);
    sel.appendChild(h('option', { value: '' }, '请选择目的地'));
    var withRules = D.jurisdictions.filter(function (j) { return marketHasRules(j.code); });
    var others = D.jurisdictions.filter(function (j) { return !marketHasRules(j.code); });
    var g1 = h('optgroup', { label: '已收录可执行规则的市场' });
    withRules.forEach(function (j) { g1.appendChild(h('option', { value: j.code }, j.name + '（' + j.code + '）')); });
    var g2 = h('optgroup', { label: '仅有法规索引 / 待规则核验' });
    others.forEach(function (j) { g2.appendChild(h('option', { value: j.code }, j.name + '（' + j.code + '）')); });
    sel.appendChild(g1); sel.appendChild(g2);
    sel.value = p.scenario.market || '';
    $('marketNote').textContent = marketNoteText(p.scenario.market);

    // 大类/组/小类
    var catSel = $('pCategory');
    if (!catSel.options.length) {
      clear(catSel);
      catSel.appendChild(h('option', { value: '' }, '请选择大类'));
      D.categories.forEach(function (c) { catSel.appendChild(h('option', { value: c.id }, c.name)); });
    }
    catSel.value = '';
    fillGroups('');
    if (p.scenario.subcategoryId) {
      var sub = subById(p.scenario.subcategoryId);
      if (sub) {
        catSel.value = (D.groups.find(function (g) { return g.id === sub.group; }) || {}).category || '';
        fillGroups(catSel.value);
        $('pGroup').value = sub.group;
        fillSubs(sub.group);
        $('pSub').value = sub.id;
      }
    }
    $('subNote').textContent = subNoteText(p.scenario.subcategoryId);

    renderBizFacts();
    renderDynFacts();
    updateRegisterSummary();
  }
  function marketNoteText(code) {
    if (!code) return '目的地决定允许进入的法域规则集合（含显式继承的上位法域）；不跨法域默认替代。';
    var j = JUR[code];
    if (!j) return '';
    var has = marketHasRules(code);
    var inherits = (j.inherits || []).map(function (c) { return JUR[c] ? JUR[c].name : c; }).join('、');
    return (j.note || '') + (inherits ? '；继承：' + inherits + '。' : '') +
      (has ? '当前数据包对该法域链收录了可执行条件规则。' : '当前数据包对该法域暂无可执行规则，将显示资料导航与「待规则核验」清单，不输出虚假的完整结论。');
  }
  function fillGroups(catId) {
    var g = $('pGroup');
    clear(g);
    g.appendChild(h('option', { value: '' }, catId ? '请选择产品组' : '先选大类'));
    g.disabled = !catId;
    if (catId) D.groups.filter(function (x) { return x.category === catId; }).forEach(function (x) { g.appendChild(h('option', { value: x.id }, x.name)); });
  }
  function fillSubs(groupId) {
    var s = $('pSub');
    clear(s);
    s.appendChild(h('option', { value: '' }, groupId ? '请选择叶子小类' : '先选产品组'));
    s.disabled = !groupId;
    if (groupId) D.subcategories.filter(function (x) { return x.group === groupId; }).forEach(function (x) {
      s.appendChild(h('option', { value: x.id }, x.name + '（' + x.evidence + '）'));
    });
  }
  function subNoteText(id) {
    var s = subById(id);
    if (!s) return '小类决定动态问题、规则候选路由与 HS 候选；M1 表示证据等级为草案，不能宣称完整合规初筛。';
    return '主要功能：' + s.core + '。可变配置：' + s.variable + '。证据等级 ' + s.evidence + (s.evidence === 'M1' ? '（草案：分类与资料导航可用，不输出完整初筛结论）' : '') + '。HS 相关特征：' + s.hsFeatures + '。';
  }

  var BIZ_FACTS = [
    { key: 'consumer_product', label: '是否面向消费者的产品' },
    { key: 'offered_online', label: '是否在线向目的地消费者展示销售要约' },
    { key: 'packaging_present', label: '投放市场时是否带包装' }
  ];
  function renderBizFacts() {
    var host = $('bizFacts');
    clear(host);
    var p = proj();
    var codes = chainOf(p.scenario.market);
    var list = BIZ_FACTS.slice();
    if (codes.indexOf('EU') >= 0) list.push({ key: 'eu_established_economic_operator', label: '是否已有欧盟境内责任经济运营者（欧盟市场需要）' });
    list.forEach(function (f) {
      host.appendChild(triControl(f.label, f.key));
    });
  }
  function triControl(label, key, extraMeta) {
    var val = getFact(key);
    var wrap = h('div', { class: 'qa' });
    wrap.appendChild(h('div', { class: 'q' }, label));
    var meta = h('div', { class: 'meta' }, extraMeta || '');
    wrap.appendChild(meta);
    var tri = h('div', { class: 'tri' });
    [['true', '是'], ['false', '否'], ['unknown', '不确定']].forEach(function (pair) {
      var on = (pair[0] === 'unknown') ? val === 'unknown' : (val === true && pair[0] === 'true') || (val === false && pair[0] === 'false');
      tri.appendChild(h('button', {
        type: 'button', class: (pair[0] === 'unknown' ? 'unknown ' : '') + (on ? 'on' : ''),
        onclick: function () {
          setFact(key, pair[0] === 'unknown' ? 'unknown' : (pair[0] === 'true'));
          renderBizFacts(); renderDynFacts(); updateRegisterSummary();
        }
      }, pair[1]));
    });
    wrap.appendChild(tri);
    return wrap;
  }

  function dynQuestions() {
    var sub = proj().scenario.subcategoryId;
    if (!sub) return [];
    return D.dynamicMap.filter(function (m) { return m.sub === sub; })
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (m) {
        var f = null;
        D.fields.forEach(function (x) { if (x.id === m.field) f = x; });
        if (!f) return null;
        return { map: m, field: f };
      }).filter(Boolean);
  }
  function renderDynFacts() {
    var host = $('dynFacts');
    clear(host);
    var sub = proj().scenario.subcategoryId;
    if (!sub) { $('dynIntro').textContent = '选定叶子小类后显示对应问题；不同品类出现不同问题。'; return; }
    var qs = dynQuestions();
    $('dynIntro').textContent = '「' + subById(sub).name + '」共 ' + qs.length + ' 项已发布问题（来自产品知识包，均允许回答不确定）。未列入的问题不影响当前法域的规则判断。';
    qs.forEach(function (q) {
      host.appendChild(questionControl(q.field, q.map));
    });
  }
  function questionControl(field, map) {
    var val = getFact(field.key);
    var wrap = h('div', { class: 'qa' });
    wrap.appendChild(h('div', { class: 'q' }, field.name + (field.unit ? '（' + field.unit + '）' : '')));
    var judgments = (map && map.judgments || []).map(function (j) {
      var jn = D.judgments.find(function (x) { return x.id === j; });
      return jn ? jn.name : j;
    });
    var noteBits = [];
    if (map && map.businessUse) noteBits.push(map.businessUse);
    if (judgments.length) noteBits.push('影响判断：' + judgments.join('、'));
    var notes = proj().scenario.factNotes[field.key];
    if (notes) noteBits.push('来源：' + notes);
    wrap.appendChild(h('div', { class: 'meta' }, noteBits.join('；')));
    var t = fieldType(field);
    if (t === 'tri') {
      var tri = h('div', { class: 'tri' });
      [['true', '是'], ['false', '否'], ['unknown', '不确定']].forEach(function (pair) {
        var on = (pair[0] === 'unknown') ? val === 'unknown' : (val === true && pair[0] === 'true') || (val === false && pair[0] === 'false');
        tri.appendChild(h('button', {
          type: 'button', class: (pair[0] === 'unknown' ? 'unknown ' : '') + (on ? 'on' : ''),
          onclick: function () {
            setFact(field.key, pair[0] === 'unknown' ? 'unknown' : (pair[0] === 'true'));
            renderDynFacts(); updateRegisterSummary();
          }
        }, pair[1]));
      });
      wrap.appendChild(tri);
    } else if (t === 'number') {
      var row = h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px' });
      var inp = h('input', { type: 'number', step: 'any', min: '0', value: val === 'unknown' || val === '' ? '' : String(val), style: 'border:1px solid var(--line);border-radius:6px;padding:6px 9px;width:150px' });
      inp.addEventListener('change', function () {
        if (inp.value === '') setFact(field.key, 'unknown');
        else setFact(field.key, Number(inp.value));
        renderDynFacts(); updateRegisterSummary();
      });
      row.appendChild(inp);
      var ub = h('button', { type: 'button', class: 'btn sm sec' + (val === 'unknown' ? ' ' : ''), onclick: function () { setFact(field.key, 'unknown'); renderDynFacts(); updateRegisterSummary(); } }, '不确定');
      if (val === 'unknown') ub.classList.add('on');
      row.appendChild(ub);
      wrap.appendChild(row);
    } else if (t === 'date') {
      var inp2 = h('input', { type: 'date', value: val === 'unknown' ? '' : String(val || ''), style: 'border:1px solid var(--line);border-radius:6px;padding:6px 9px;margin-top:6px' });
      inp2.addEventListener('change', function () { setFact(field.key, inp2.value || 'unknown'); renderDynFacts(); updateRegisterSummary(); });
      wrap.appendChild(inp2);
    } else {
      var sel = h('select', { style: 'border:1px solid var(--line);border-radius:6px;padding:6px 9px;margin-top:6px;max-width:320px' });
      sel.appendChild(h('option', { value: '' }, '请选择 / 暂不确定'));
      optionsOf(field).forEach(function (o) { sel.appendChild(h('option', { value: typeof o.v === 'boolean' ? String(o.v) : o.v }, o.label)); });
      sel.value = val === 'unknown' ? '' : String(val === true ? 'true' : val === false ? 'false' : (val || ''));
      sel.addEventListener('change', function () {
        setFact(field.key, sel.value === '' ? 'unknown' : sel.value);
        renderDynFacts(); updateRegisterSummary();
      });
      wrap.appendChild(sel);
    }
    return wrap;
  }
  function updateRegisterSummary() {
    var p = proj();
    var qs = dynQuestions();
    var unknowns = qs.filter(function (q) { return getFact(q.field.key) === 'unknown'; });
    var answered = qs.filter(function (q) { var v = getFact(q.field.key); return v !== '' && v !== 'unknown'; });
    var bits = [];
    bits.push('已登记：目的地 ' + (p.scenario.market ? (JUR[p.scenario.market] ? JUR[p.scenario.market].name : p.scenario.market) : '未选') +
      '；小类 ' + (p.scenario.subcategoryId ? subById(p.scenario.subcategoryId).name : '未选') +
      '；投放日期 ' + (p.scenario.placingOnMarketDate || '未填') + '。');
    bits.push('产品事实：已答 ' + answered.length + ' / ' + qs.length + '，其中标记不确定 ' + unknowns.length + ' 项。');
    if (unknowns.length) {
      var names = unknowns.map(function (q) { return q.field.name; }).slice(0, 6).join('、');
      bits.push('不确定项（对应判断将保持待确认，不会按「否」处理）：' + names + (unknowns.length > 6 ? ' 等' : '') + '。');
    }
    $('registerSummary').textContent = bits.join(' ');
  }

  /* ---------- 产品页事件 ---------- */
  $('pName').addEventListener('change', function () { proj().name = $('pName').value || '未命名项目'; touch(); refreshProjSelect(); });
  $('pCompany').addEventListener('change', function () { proj().companyName = $('pCompany').value; touch(); });
  $('pPlacingDate').addEventListener('change', function () { proj().scenario.placingOnMarketDate = $('pPlacingDate').value; touch(); updateRegisterSummary(); });
  $('pImportDate').addEventListener('change', function () { proj().scenario.importDate = $('pImportDate').value; touch(); });
  $('pRole').addEventListener('change', function () { proj().scenario.role = $('pRole').value; touch(); });
  $('pMarket').addEventListener('change', function () {
    proj().scenario.market = $('pMarket').value;
    touch();
    $('marketNote').textContent = marketNoteText(proj().scenario.market);
    renderBizFacts(); updateRegisterSummary();
  });
  $('pCategory').addEventListener('change', function () { fillGroups($('pCategory').value); fillSubs(''); $('subNote').textContent = subNoteText(''); });
  $('pGroup').addEventListener('change', function () { fillSubs($('pGroup').value); $('subNote').textContent = subNoteText(''); });
  $('pSub').addEventListener('change', function () {
    proj().scenario.subcategoryId = $('pSub').value;
    touch();
    $('subNote').textContent = subNoteText(proj().scenario.subcategoryId);
    renderDynFacts(); updateRegisterSummary();
  });
  $('btnGoCompliance').addEventListener('click', function () { showTab('compliance'); });

  /* ================= 模块 3：合规初筛 ================= */
  function runCompliance() {
    var p = proj();
    if (!p.scenario.market || !p.scenario.subcategoryId) return null;
    return E.evaluateScenario(D, {
      market: p.scenario.market,
      subcategoryId: p.scenario.subcategoryId,
      facts: engineFacts(),
      placingOnMarketDate: p.scenario.placingOnMarketDate || ''
    });
  }
  var lastCompliance = null;
  function renderCompliance(auto) {
    var host = $('complianceResult');
    clear(host);
    var p = proj();
    if (!p.scenario.market || !p.scenario.subcategoryId) {
      host.appendChild(h('div', { class: 'banner warn' }, '请先在第 2 步完成目的地与产品小类登记，再运行条件初筛。'));
      return;
    }
    if (auto) {
      // 自动计算（不阻塞）
      lastCompliance = runCompliance();
      renderComplianceResult(host, lastCompliance);
      return;
    }
    // 手动运行：给加载反馈
    $('complianceRunInfo').textContent = '正在评估…';
    var btn = $('btnRunCompliance');
    btn.disabled = true;
    btn.innerHTML = '';
    btn.appendChild(h('span', { class: 'spin' }));
    btn.appendChild(document.createTextNode('评估中'));
    setTimeout(function () {
      try {
        lastCompliance = runCompliance();
        renderComplianceResult(host, lastCompliance);
        $('complianceRunInfo').textContent = '评估完成：适用 ' + (lastCompliance ? lastCompliance.applicableRules.length : 0) + ' 条，待补事实 ' + (lastCompliance ? lastCompliance.unknownRules.length : 0) + ' 条（快照 ' + E.SNAPSHOT_DATE + '）';
        toast('条件初筛完成', 'ok');
      } catch (e) {
        host.appendChild(h('div', { class: 'banner bad' }, '评估失败：' + e.message + '。请检查登记信息后重试。'));
        toast('评估失败：' + e.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = '运行条件初筛';
      }
    }, 120);
  }
  function ruleCard(r) {
    var card = h('div', { class: 'rule-item state-' + (r.state === 'applicable' ? 'applicable' : r.state === 'review_required' ? 'review' : r.state === 'unknown' ? 'unknown' : 'not') });
    var head = h('div', { class: 'head' });
    head.appendChild(h('b', {}, r.name || r.id));
    head.appendChild(h('span', { class: 'tag' }, r.id));
    head.appendChild(h('span', { class: 'tag brand' }, (JUR[r.jurisdiction] ? JUR[r.jurisdiction].name : r.jurisdiction)));
    if (D.topics.length) {
      var tp = D.topics.find(function (t) { return t.id === r.topic; });
      if (tp) head.appendChild(h('span', { class: 'tag' }, tp.name));
    }
    if (r.state === 'review_required' || r.humanReview) head.appendChild(h('span', { class: 'tag info' }, '需人工复核'));
    if (r.origin === 'task3_verified_rule') head.appendChild(h('span', { class: 'tag ok' }, '条款级核验规则'));
    card.appendChild(head);
    var body = h('div', { class: 'body' });
    if (r.state === 'unknown') {
      var miss = (r.missingFields || []).map(function (k) { var f = lookupField(k); return f ? f.name : k; });
      body.appendChild(h('div', {}, '待补事实：', miss.join('、') || '（见下方问题）'));
    } else if (r.state === 'not_applicable') {
      var why = [];
      if (r.dateActive === false) why.push(r.dateReason);
      if (r.notApplicable) why.push(r.notApplicable);
      if (!why.length) why.push('条件明确不满足（当前产品/经营事实未命中该规则的适用条件，或命中排除项）。');
      body.appendChild(h('div', {}, why.join('；')));
    } else {
      if (r.obligation) body.appendChild(h('div', {}, r.obligation));
      if (r.exceptions) body.appendChild(h('div', { class: 'subhint' }, '例外与提示：' + r.exceptions));
      if (r.dateNote) body.appendChild(h('div', { class: 'subhint' }, r.dateNote));
      if (r.effectiveFrom || r.effectiveTo) body.appendChild(h('div', { class: 'subhint' }, '适用期：' + (r.effectiveFrom || '不限') + ' 至 ' + (r.effectiveTo || '不限') + '；按投放日期 ' + (lastCompliance ? lastCompliance.asOf : '') + ' 选版本。'));
      if (r.humanReviewNote) body.appendChild(h('div', { class: 'subhint' }, '人工复核：' + r.humanReviewNote));
    }
    card.appendChild(body);
    if (r.locator || (r.sourceIds && r.sourceIds.length)) {
      var src = h('div', { class: 'src' });
      if (r.locator) src.appendChild(document.createTextNode('条款定位：' + r.locator + '　'));
      if (r.sourceIds && r.sourceIds.length) src.appendChild(sourceLinks(r.sourceIds));
      card.appendChild(src);
    }
    return card;
  }
  function renderComplianceResult(host, sc) {
    if (!sc) return;
    // 覆盖横幅
    var cov = h('div', { class: 'banner ' + (sc.coverage.level === 'L1' ? 'warn' : 'info') });
    cov.appendChild(document.createTextNode('服务覆盖等级：' + sc.coverage.level + '（' + sc.coverage.label + '）。' + sc.coverageDefinition));
    host.appendChild(cov);
    sc.gaps.forEach(function (g) { host.appendChild(h('div', { class: 'banner bad' }, '覆盖缺口：' + g)); });

    // 分组
    var g1 = h('div', { class: 'card' });
    g1.appendChild(h('h3', {}, '可能适用（' + sc.applicableRules.length + ' 条）', h('span', { class: 'subhint', style: 'margin-left:8px' }, '只有这些规则会生成行动与材料；含需人工复核项')));
    if (!sc.applicableRules.length) g1.appendChild(h('p', { class: 'subhint' }, '当前输入下没有明确适用的规则；请查看「待补事实」与「待规则核验」。'));
    sc.applicableRules.forEach(function (r) { g1.appendChild(ruleCard(r)); });
    host.appendChild(g1);

    // 待补事实 + 追问
    var g2 = h('div', { class: 'card' });
    g2.appendChild(h('h3', {}, '待补事实（' + sc.unknownRules.length + ' 条规则待确认）'));
    g2.appendChild(h('p', { class: 'subhint' }, '以下事实缺失时对应规则不能判断；回答后立即重新计算。缺失不会按「否」处理。'));
    if (!sc.questions.length) g2.appendChild(h('p', { class: 'subhint' }, '没有可自动追问的缺失事实。'));
    sc.questions.forEach(function (q) {
      var f = q.field;
      g2.appendChild(questionControl(f, { judgments: [], businessUse: f.businessUse || (f.name === f.name ? '' : '') }));
      var affected = h('div', { class: 'subhint', style: 'margin:-4px 0 8px' }, '影响规则：' + (q.affectedRules.join('、') || '—'));
      g2.appendChild(affected);
    });
    if (sc.unknownRules.length) {
      var d2 = h('details', { class: 'box' });
      d2.appendChild(h('summary', {}, '查看待确认规则明细（' + sc.unknownRules.length + '）'));
      sc.unknownRules.forEach(function (r) { d2.appendChild(ruleCard(r)); });
      g2.appendChild(d2);
    }
    host.appendChild(g2);

    // 不适用
    var g3 = h('div', { class: 'card' });
    g3.appendChild(h('h3', {}, '单条规则不适用（' + sc.excludedRules.length + ' 条）'));
    g3.appendChild(h('p', { class: 'subhint' }, '按当前事实与投放日期明确不满足的规则；每条给出原因，可展开核对。'));
    var d3 = h('details', { class: 'box' });
    d3.appendChild(h('summary', {}, '展开不适用规则（' + sc.excludedRules.length + '）'));
    sc.excludedRules.forEach(function (r) { d3.appendChild(ruleCard(r)); });
    g3.appendChild(d3);
    host.appendChild(g3);

    // 待规则核验
    var g4 = h('div', { class: 'card' });
    g4.appendChild(h('h3', {}, '待规则核验（' + sc.pendingRegulations.length + ' 条法规）'));
    g4.appendChild(h('p', { class: 'subhint' }, '以下法规在目的法域链内已有来源索引，但尚未形成可自动执行的条款级规则。它们不会生成义务结论，必须人工核对原文后再判断。'));
    if (!sc.pendingRegulations.length) g4.appendChild(h('p', { class: 'subhint' }, '当前法域链内的法规均有可执行规则或不在索引内。'));
    sc.pendingRegulations.forEach(function (reg) {
      var it = h('div', { class: 'rule-item state-not' });
      var head = h('div', { class: 'head' });
      head.appendChild(h('b', {}, reg.name));
      head.appendChild(h('span', { class: 'tag' }, reg.id));
      head.appendChild(h('span', { class: 'tag warn' }, reg.maturity === 'verified_index_only' ? '索引已核，无条款规则' : reg.maturity));
      it.appendChild(head);
      it.appendChild(h('div', { class: 'body' }, (reg.purpose || '') + (reg.techConditions ? '。适用条件：' + reg.techConditions : '')));
      var src = h('div', { class: 'src' }, '核验日期：' + reg.checkedAt + '　');
      if (reg.officialUrl) src.appendChild(h('a', { href: reg.officialUrl, target: '_blank', rel: 'noopener noreferrer' }, '打开官方来源'));
      it.appendChild(src);
      g4.appendChild(it);
    });
    host.appendChild(g4);

    // 行动与材料
    var g5 = h('div', { class: 'card' });
    g5.appendChild(h('h3', {}, '办理行动与材料清单（来自可能适用规则）'));
    g5.appendChild(h('p', { class: 'subhint' }, '勾选状态仅保存在本机，用于团队跟踪，不等同于合规完成证明。'));
    if (!sc.actionList.length) g5.appendChild(h('p', { class: 'subhint' }, '当前没有适用的规则，因此没有生成的行动与材料。'));
    sc.actionList.forEach(function (a) {
      var done = !!(proj().todoState[a.id] && proj().todoState[a.id].done);
      var row = h('div', { class: 'todo-row' + (done ? ' done' : '') });
      var cb = h('input', { type: 'checkbox' });
      cb.checked = done;
      cb.addEventListener('change', function () {
        proj().todoState[a.id] = { done: cb.checked, at: new Date().toISOString() };
        row.classList.toggle('done', cb.checked);
        touch();
      });
      var body = h('div', { class: 't-body' });
      body.appendChild(h('div', { class: 't-title' }, a.name, ' ', h('span', { class: 'tag' }, a.id)));
      body.appendChild(h('div', { class: 't-text' }, a.text));
      body.appendChild(h('div', { class: 't-meta' }, '责任建议：' + (a.responsibility || '—') + '；完成节点：' + (a.due || '—') + '；性质：' + (a.nature || '—')));
      if (a.locator) body.appendChild(h('div', { class: 't-meta' }, '条款定位：' + a.locator));
      if (a.materialIds && a.materialIds.length) {
        var mats = a.materialIds.map(function (mid) {
          var m = D.materials.find(function (x) { return x.id === mid; });
          return m ? m.name : mid;
        });
        body.appendChild(h('div', { class: 't-meta' }, '涉及材料：' + mats.join('；')));
      }
      if (a.sourceIds && a.sourceIds.length) body.appendChild(h('div', { class: 't-meta' }, sourceLinks(a.sourceIds)));
      row.appendChild(cb); row.appendChild(body);
      g5.appendChild(row);
    });
    if (sc.materialList.length) {
      var mt = h('table', { class: 't' });
      mt.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '材料'), h('th', {}, '企业准备状态'), h('th', {}, '专业复核'))));
      var tb = h('tbody', {});
      sc.materialList.forEach(function (m) {
        tb.appendChild(h('tr', {}, h('td', {}, m.name + ' '), h('td', {}, m.prep || '未提供'), h('td', {}, m.review || '未复核')));
      });
      mt.appendChild(tb);
      g5.appendChild(mt);
    }
    host.appendChild(g5);
  }
  $('btnRunCompliance').addEventListener('click', function () { renderCompliance(false); });

  /* ================= 模块 4：HS 与税费 ================= */
  function taxInput() {
    var p = proj();
    var t = p.tax;
    var input = {
      market: p.scenario.market,
      product_type: (subById(p.scenario.subcategoryId) || {}).legacy || '',
      subcategory_id: p.scenario.subcategoryId,
      hs_candidate: p.hsChoice || '',
      origin: t.origin || '',
      import_date: p.scenario.importDate || '',
      goods_value: t.goodsValue === '' ? null : Number(t.goodsValue),
      currency: t.currency || '',
      incoterm: t.incoterm || '',
      price_basis: t.priceBasis || '',
      freight: t.freight === '' ? null : Number(t.freight),
      insurance: t.insurance === '' ? null : Number(t.insurance),
      multiple_sales: t.multipleSales === true || t.multipleSales === 'true',
      lsp: t.lsp === '' ? null : Number(t.lsp),
      last_buyer_is_declarant: t.lastBuyerDeclarant === true,
      import_route: t.importRoute || 'bulk',
      special_valuation: t.specialValuation === 'yes' ? true : t.specialValuation === 'unknown' ? 'unknown' : false,
      remedy_check: t.remedyCheck || '',
      confirmed_customs_value: t.confirmedCustomsValue === '' ? null : Number(t.confirmedCustomsValue),
      valuation_professionally_confirmed: t.valuationConfirmed === true || t.valuationConfirmed === 'true',
      customs_value_confirmed: t.customsValueConfirmed === '' ? null : Number(t.customsValueConfirmed),
      origin_preference: t.originPreference || 'none',
      origin_psr_satisfied: t.psrSatisfied === true || t.psrSatisfied === 'true' ? true : (t.psrSatisfied === 'unknown' ? 'unknown' : null),
      origin_documents_valid: t.docsValid === true || t.docsValid === 'true' ? true : null,
      transport_conditions_satisfied: t.transportCond === true || t.transportCond === 'true' ? true : null,
      transport: t.transport || '',
      sales_state: t.salesState || '',
      quantity: t.quantity === '' ? null : Number(t.quantity)
    };
    if (t.currency && !['SGD'].includes(t.currency) && input.market === 'SG') {
      input.fx_record = { rate: t.fxRate === '' ? null : Number(t.fxRate), source: t.fxSource || '' };
    } else if (t.currency && !['AUD'].includes(t.currency) && input.market === 'AU') {
      input.fx_record = { rate: t.fxRate === '' ? null : Number(t.fxRate), source: t.fxSource || '' };
    }
    return input;
  }
  function renderTax() {
    var host = $('taxBody');
    clear(host);
    var p = proj();
    if (!p.scenario.market || !p.scenario.subcategoryId) {
      host.appendChild(h('div', { class: 'banner warn' }, '请先在第 2 步完成目的地与产品小类登记。'));
      return;
    }
    var sub = subById(p.scenario.subcategoryId);
    var sc = runCompliance();

    // HS 候选
    var hsCard = h('div', { class: 'card' });
    hsCard.appendChild(h('h3', {}, '目的国 HS 候选方向'));
    hsCard.appendChild(h('div', { class: 'banner warn' }, 'HS 候选只是归类研究方向，不是海关最终归类；最终编码以目的国海关税则与个案裁定为准。'));
    var cands = sc ? sc.hsCandidates : [];
    if (!cands.length) {
      hsCard.appendChild(h('div', { class: 'banner bad' }, '当前「' + sub.name + ' × ' + (JUR[p.scenario.market] ? JUR[p.scenario.market].name : p.scenario.market) + '」组合尚无经来源关联的目的国 HS 候选。这是数据包的明确缺口：不能冒充有归类结论，也不按零税率处理。'));
    } else {
      cands.forEach(function (c) {
        var on = p.hsChoice === c.id;
        var item = h('div', { class: 'rule-item' + (on ? ' state-applicable' : '') });
        var head = h('div', { class: 'head' });
        var radio = h('input', { type: 'radio', name: 'hsChoice', value: c.id });
        radio.checked = on;
        radio.addEventListener('change', function () { proj().hsChoice = c.id; touch(); renderTax(); });
        head.appendChild(radio);
        head.appendChild(h('b', {}, c.code + ' '));
        head.appendChild(h('span', { class: 'tag' }, c.market));
        head.appendChild(h('span', { class: 'tag warn' }, '候选方向'));
        item.appendChild(head);
        item.appendChild(h('div', { class: 'body' }, (c.desc || '') + (c.support ? '。依据：' + c.support : '')));
        if (c.questions) item.appendChild(h('div', { class: 'subhint' }, '区分问题：' + c.questions));
        var meta = h('div', { class: 'src' }, (c.gri ? '归类规则：' + c.gri + '；' : '') + (c.tariffVersion ? '税则版本：' + c.tariffVersion + '；' : '') + '复核状态：' + (c.review || '—') + '；');
        if (c.sourceIds && c.sourceIds.length) meta.appendChild(sourceLinks(c.sourceIds));
        item.appendChild(meta);
        hsCard.appendChild(item);
      });
      hsCard.appendChild(h('p', { class: 'subhint' }, '选择一个候选后，下方税费测算将使用该编码前缀匹配已核税率画像。'));
    }
    host.appendChild(hsCard);

    // 税费测算
    var market = p.scenario.market;
    var card = h('div', { class: 'card' });
    card.appendChild(h('h3', {}, '税费阶段测算（' + (market === 'SG' ? '新加坡' : market === 'AU' ? '澳大利亚' : JUR[market] ? JUR[market].name : market) + '）'));
    if (market !== 'SG' && market !== 'AU') {
      card.appendChild(h('div', { class: 'banner bad' }, '当前数据包仅对新加坡（SG）与澳大利亚（AU）建立了可复算的税费画像。其他目的地显示已知分项缺口，不能输出完整税额，也不按零处理。'));
      host.appendChild(card);
      return;
    }
    var f = p.tax;
    var fields = h('div', {});
    function numField(label, key, step) {
      var lab = h('label', { class: 'f' }, label);
      var inp = h('input', { type: 'number', step: step || 'any', min: '0', value: f[key] === '' || f[key] === null || f[key] === undefined ? '' : String(f[key]) });
      inp.addEventListener('change', function () { f[key] = inp.value; touch(); });
      lab.appendChild(inp);
      return lab;
    }
    function selField(label, key, opts) {
      var lab = h('label', { class: 'f' }, label);
      var s = h('select', {});
      opts.forEach(function (o) { s.appendChild(h('option', { value: o[0] }, o[1])); });
      s.value = f[key] || '';
      s.addEventListener('change', function () { f[key] = s.value; touch(); renderTax(); });
      lab.appendChild(s);
      return lab;
    }
    var currencyOpts = market === 'SG' ? [['SGD', 'SGD 新加坡元'], ['CNY', 'CNY 人民币'], ['USD', 'USD 美元']] : [['AUD', 'AUD 澳元'], ['CNY', 'CNY 人民币'], ['USD', 'USD 美元']];
    fields.appendChild(h('div', { class: 'fields' },
      numField('货值（' + (f.currency || '计价币种') + '）', 'goodsValue'),
      selField('币种', 'currency', currencyOpts),
      numField('国际运费', 'freight'),
      numField('国际保险费', 'insurance'),
      numField('数量（台/套，用于分摊展示）', 'quantity'),
      selField('贸易术语', 'incoterm', [['FOB', 'FOB（不含国际运保）'], ['CIF', 'CIF（已含国际运保）'], ['DDP', 'DDP（到门含税总价）'], ['other', '其他/未确定']]),
      selField('原产地', 'origin', [['CN', '中国 CN'], ['other', '其他国家/未确认']]),
      selField('特殊估价（需专业结论）', 'specialValuation', [['no', '否——按常规估价'], ['yes', '是'], ['unknown', '不确定']])
    ));
    if (f.incoterm === 'DDP') {
      fields.appendChild(h('div', { class: 'banner warn' }, 'DDP 含税总价不能倒算海关价值：需提供经专业确认的海关价值与费用拆分（下方两栏），否则税基被阻断。合同费用承担（DDP 由卖方承担）与法定税率是两回事。'));
      fields.appendChild(h('div', { class: 'fields' },
        numField('经专业确认的海关价值', 'confirmedCustomsValue'),
        selField('是否经专业确认', 'valuationConfirmed', [['', '未确认'], [true, '已确认']]) // 简化为选择
      ));
    }
    if (f.currency !== (market === 'SG' ? 'SGD' : 'AUD')) {
      fields.appendChild(h('div', { class: 'fields' },
        numField('汇率（1 外币 = ? ' + (market === 'SG' ? 'SGD' : 'AUD') + '）', 'fxRate'),
        h('label', { class: 'f' }, '汇率来源及日期（法定汇率记录）', (function () {
          var inp = h('input', { type: 'text', value: f.fxSource || '', placeholder: '例如：中国人民银行 2026-11-04 中间价' });
          inp.addEventListener('change', function () { f.fxSource = inp.value; touch(); });
          return inp;
        })())
      ));
    }
    if (market === 'SG') {
      fields.appendChild(h('div', { class: 'fields' },
        selField('进口路线', 'importRoute', [['bulk', '普通批量进口'], ['low_value', '低值路线'], ['postal', '空邮/邮寄']]),
        selField('进口前是否存在多次销售', 'multipleSales', [['', '否'], [true, '是——需最后买方申报价']]),
        numField('最后买方申报价（如多次销售）', 'lsp')
      ));
    }
    if (market === 'AU') {
      fields.appendChild(h('div', { class: 'fields' },
        numField('海关价值 CV（经确认，AUD）', 'customsValueConfirmed'),
        selField('运输方式（生物安全费需要）', 'transport', [['sea', '海运'], ['air', '空运']]),
        selField('销售州（电气安全提示用）', 'salesState', [['VIC', '维州 VIC'], ['other', '其他州/未指定']]),
        selField('优惠原产情景（ChAFTA）', 'originPreference', [['none', '不申请优惠'], ['conditional', '拟申请——条件未复核'], ['reviewed', '已复核——需勾选下方三项']])
      ));
      if (f.originPreference === 'reviewed') {
        fields.appendChild(h('div', { class: 'banner warn' }, 'ChAFTA 零关税只有在「PSR 满足 + 原产证明有效 + 运输条件满足」三项同时成立时才可启用；当前数据包未运行 HS 特定 PSR 自动判断，以下声明由用户负责并留痕。'));
        fields.appendChild(h('div', { class: 'fields' },
          selField('PSR 已满足', 'psrSatisfied', [['', '未确认'], [true, '已满足'], ['unknown', '不确定']]),
          selField('原产证明有效', 'docsValid', [['', '未确认'], [true, '有效']]),
          selField('运输条件满足（直接运输）', 'transportCond', [['', '未确认'], [true, '满足']])
        ));
      }
    }
    fields.appendChild(h('div', { class: 'fields' },
      selField('贸易救济/附加措施核查', 'remedyCheck', [['', '尚未核查'], ['confirmed_clear', '已核查：无适用措施'], ['measures_found', '发现适用措施——需另行计入']]))
    );
    card.appendChild(fields);

    var runBtn = h('button', { class: 'btn', style: 'margin-top:8px' }, '计算税费');
    var result = h('div', {});
    runBtn.addEventListener('click', function () {
      runBtn.disabled = true;
      runBtn.innerHTML = '';
      runBtn.appendChild(h('span', { class: 'spin' }));
      runBtn.appendChild(document.createTextNode('计算中'));
      setTimeout(function () {
        try {
          renderTaxResult(result, E.calculateTaxes(D, taxInput()));
        } catch (e) {
          result.appendChild(h('div', { class: 'banner bad' }, '税费计算失败：' + e.message));
          toast('税费计算失败：' + e.message, 'err');
        } finally {
          runBtn.disabled = false;
          runBtn.textContent = '重新计算税费';
        }
      }, 100);
    });
    card.appendChild(runBtn);
    card.appendChild(result);
    host.appendChild(card);
    // 首次自动展示一次结果（基于当前输入）
    renderTaxResult(result, E.calculateTaxes(D, taxInput()));
  }
  function renderTaxResult(host, tax) {
    clear(host);
    if (tax.lines && tax.lines.length) {
      var t = h('table', { class: 't' });
      t.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, '分项'), h('th', {}, '性质'), h('th', { class: 'num' }, '税率'), h('th', { class: 'num' }, '税基/基础'), h('th', { class: 'num' }, '金额（' + tax.currency + '）'), h('th', {}, '承担方（合同视角）'), h('th', {}, '状态'))));
      var tb = h('tbody', {});
      tax.lines.forEach(function (l) {
        tb.appendChild(h('tr', {},
          h('td', {}, l.label, h('div', { class: 'subhint' }, sourceLinks(l.sourceIds))),
          h('td', {}, l.classification),
          h('td', { class: 'num' }, l.rate === null || l.rate === undefined ? '—' : (l.rate * 100).toFixed(l.rate * 100 % 1 === 0 ? 0 : 1) + '%'),
          h('td', { class: 'num' }, typeof l.base === 'number' ? l.base.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : (l.base || '—')),
          h('td', { class: 'num' }, l.amount === null || l.amount === undefined ? '—（被阻断）' : Number(l.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
          h('td', {}, l.payer || '—'),
          h('td', {}, l.status === 'indicative' ? h('span', { class: 'tag warn' }, '指示性') : l.status === 'blocked' ? h('span', { class: 'tag bad' }, '阻断') : h('span', { class: 'tag ok' }, '已算'))));
      });
      t.appendChild(tb);
      host.appendChild(h('h4', {}, '计算明细（按有依据的公式逐行输出）'));
      host.appendChild(h('div', { class: 'tbl-wrap' }, t));
      var summary = h('div', {});
      summary.appendChild(h('p', {}, '已知法定分项小计：', h('b', {}, tax.known_statutory_subtotal === null ? '不可用（存在被阻断分项）' : fmtMoney(tax.known_statutory_subtotal, tax.currency))));
      summary.appendChild(h('p', {}, '完整进口法定总额：', h('b', { style: tax.complete_total === null ? 'color:var(--bad)' : 'color:var(--ok)' },
        tax.complete_total === null ? '不可用' : fmtMoney(tax.complete_total, tax.currency))));
      if (tax.conditional_preferential_scenario) summary.appendChild(h('p', { class: 'subhint' }, '优惠情景说明：' + tax.conditional_preferential_scenario));
      if (tax.preferential_duty_saving !== null && tax.preferential_duty_saving !== undefined && tax.preferential_duty_saving > 0) summary.appendChild(h('p', { class: 'subhint' }, '如优惠成立，可节省关税约：' + fmtMoney(tax.preferential_duty_saving, tax.currency)));
      host.appendChild(summary);
    } else {
      host.appendChild(h('div', { class: 'banner bad' }, (tax.blockers && tax.blockers[0]) || '无法计算。'));
    }
    if (tax.blockers && tax.blockers.length) {
      var b = h('div', { class: 'banner bad' });
      b.appendChild(h('b', {}, '完整总额保持为空的原因（不按零处理）：'));
      var ul = h('ul', { style: 'margin:6px 0 0 18px' });
      tax.blockers.forEach(function (x) { ul.appendChild(h('li', {}, x)); });
      b.appendChild(ul);
      host.appendChild(b);
    }
    (tax.warnings || []).forEach(function (w) { host.appendChild(h('div', { class: 'banner warn' }, '提示：' + w)); });
    (tax.assumptions || []).forEach(function (a) { host.appendChild(h('div', { class: 'subhint' }, '测算假设：' + a)); });
    host.appendChild(h('div', { class: 'subhint', style: 'margin-top:6px' }, '计算依据快照：' + tax.snapshotDate + '；分项金额可由同一组输入复算。货值、汇率、措施状态变化后请重新计算。'));
  }

  /* ================= 模块 5：新闻雷达 ================= */
  var newsFilter = { market: '', category: '', kw: '', projectOnly: false };
  function renderNews() {
    var host = $('newsBody');
    clear(host);
    var p = proj();
    var meta = NEWS.meta || {};
    var cov = h('div', { class: 'banner info' });
    cov.appendChild(h('b', {}, '来源与覆盖说明：'));
    cov.appendChild(document.createTextNode(' 新闻快照来自政府官方 RSS/Atom 公告（见来源状态），由 GitHub Actions 定时采集（北京时间约 09:17 / 17:17）。这是定时更新的公告快照，不是实时监控；也不覆盖全网舆情或社交平台情感监测。官方新闻不自动等于已生效法规——生效日期以法规原文为准。'));
    host.appendChild(cov);

    if (!NEWS.items.length) {
      host.appendChild(h('div', { class: 'banner bad' }, '新闻快照为空或未加载（data/news.js 缺失）。请运行采集程序或检查部署文件。'));
      return;
    }
    var status = h('div', { class: 'card' });
    status.appendChild(h('h3', {}, '快照状态'));
    status.appendChild(h('p', { class: 'subhint' }, '快照更新时间：' + fmtDateTime(meta.exportedAt) + '；共 ' + NEWS.items.length + ' 条；' + (meta.snapshotNote || '')));
    if (meta.allFailed) status.appendChild(h('div', { class: 'banner bad' }, '最近一次采集全部来源失败：已保留最后成功快照及其时间，请查看仓库 Actions 日志与采集状态。'));
    var st = h('table', { class: 't' });
    st.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '来源'), h('th', {}, '市场'), h('th', {}, '状态'))));
    var tb = h('tbody', {});
    (meta.sources || []).forEach(function (s) {
      tb.appendChild(h('tr', {}, h('td', {}, s.name), h('td', {}, s.market),
        h('td', {}, s.status === 'ok' ? h('span', { class: 'tag ok' }, '采集成功 ' + (s.count || '')) : s.status === 'error' ? h('span', { class: 'tag bad' }, '失败：' + (s.error || '').slice(0, 60)) : h('span', { class: 'tag' }, '待首次采集'))));
    });
    st.appendChild(tb);
    status.appendChild(h('div', { class: 'tbl-wrap' }, st));
    host.appendChild(status);

    // 筛选
    var fc = h('div', { class: 'card' });
    fc.appendChild(h('h3', {}, '筛选（市场 / 主题 / 关键词 / 当前项目）'));
    var markets = [...new Set(NEWS.items.map(function (i) { return i.market; }))];
    var cats = [...new Set(NEWS.items.map(function (i) { return i.category; }))];
    var fs = h('div', { class: 'fields' });
    var mSel = h('select', {});
    mSel.appendChild(h('option', { value: '' }, '全部市场'));
    if (p.scenario.market) mSel.appendChild(h('option', { value: '__project__' }, '当前项目目的地（' + (JUR[p.scenario.market] ? JUR[p.scenario.market].name : p.scenario.market) + '）'));
    markets.forEach(function (m) { mSel.appendChild(h('option', { value: m }, m)); });
    mSel.value = newsFilter.market;
    mSel.addEventListener('change', function () { newsFilter.market = mSel.value; renderNews(); });
    var cSel = h('select', {});
    cSel.appendChild(h('option', { value: '' }, '全部主题'));
    cats.forEach(function (c) { cSel.appendChild(h('option', { value: c }, c)); });
    cSel.value = newsFilter.category;
    cSel.addEventListener('change', function () { newsFilter.category = cSel.value; renderNews(); });
    var kwInp = h('input', { type: 'search', value: newsFilter.kw, placeholder: '标题/摘要关键词' });
    kwInp.addEventListener('change', function () { newsFilter.kw = kwInp.value.trim(); renderNews(); });
    var poLabel = h('label', { class: 'f', style: 'flex-direction:row;align-items:center;gap:6px' });
    var poCb = h('input', { type: 'checkbox' });
    poCb.checked = newsFilter.projectOnly;
    poCb.addEventListener('change', function () { newsFilter.projectOnly = poCb.checked; renderNews(); });
    poLabel.appendChild(poCb); poLabel.appendChild(document.createTextNode(' 仅显示当前项目目的地'));
    fs.appendChild(h('label', { class: 'f' }, '市场', mSel));
    fs.appendChild(h('label', { class: 'f' }, '主题分类', cSel));
    fs.appendChild(h('label', { class: 'f' }, '关键词', kwInp));
    fs.appendChild(poLabel);
    fc.appendChild(fs);
    host.appendChild(fc);

    // 列表
    var projMarketNames = p.scenario.market ? chainOf(p.scenario.market).map(function (c) { return JUR[c] ? JUR[c].name : c; }) : [];
    var items = NEWS.items.filter(function (it) {
      if (newsFilter.projectOnly || newsFilter.market === '__project__') {
        if (projMarketNames.indexOf(it.market) < 0) return false;
      } else if (newsFilter.market && it.market !== newsFilter.market) return false;
      if (newsFilter.category && it.category !== newsFilter.category) return false;
      if (newsFilter.kw) {
        var kw = newsFilter.kw.toLowerCase();
        if (((it.title || '') + ' ' + (it.summary || '')).toLowerCase().indexOf(kw) < 0) return false;
      }
      return true;
    }).slice(0, 200);

    var list = h('div', { class: 'card' });
    list.appendChild(h('h3', {}, '新闻列表（' + items.length + ' 条' + (NEWS.items.length > 200 ? '，显示前 200' : '') + '）'));
    list.appendChild(h('p', { class: 'subhint' }, '勾选新闻可带入第 6 步分析任务与第 7 步综合报告。每条显示发布时间、来源、快照更新时间与核验状态。'));
    items.forEach(function (it) {
      var id = newsId(it);
      var sel = p.newsSelected.indexOf(id) >= 0;
      var row = h('div', { class: 'news-item' });
      var cb = h('input', { type: 'checkbox', 'aria-label': '选择新闻' });
      cb.checked = sel;
      cb.addEventListener('change', function () {
        if (cb.checked) { if (p.newsSelected.indexOf(id) < 0) p.newsSelected.push(id); }
        else p.newsSelected = p.newsSelected.filter(function (x) { return x !== id; });
        touch();
      });
      var body = h('div', { class: 'n-body' });
      var titleA = h('a', { href: it.url || '#', target: '_blank', rel: 'noopener noreferrer' }, it.title || '（无标题）');
      body.appendChild(h('div', { class: 'n-title' }, titleA));
      body.appendChild(h('div', { class: 'n-meta' },
        '发布：' + fmtDate(it.date) + '｜来源：' + (it.source || '—') + '｜市场：' + (it.market || '—') +
        '｜快照：' + fmtDateTime(meta.exportedAt)));
      body.appendChild(h('div', {}, h('span', { class: 'tag' }, it.category || '未分类'), h('span', { class: 'tag ' + (it.level === '高' ? 'bad' : it.level === '中' ? 'warn' : '') }, '影响级别：' + (it.level || '中')), h('span', { class: 'tag warn' }, '核验状态：' + (it.verified || '待核验'))));
      if (it.summary) body.appendChild(h('div', { class: 'n-sum' }, it.summary));
      if (it.impact) body.appendChild(h('div', { class: 'n-impact' }, '规则提示（本地引擎，非千问分析）：' + it.impact));
      row.appendChild(cb); row.appendChild(body);
      list.appendChild(row);
    });
    if (!items.length) list.appendChild(h('div', { class: 'banner warn' }, '没有符合筛选条件的新闻。'));
    host.appendChild(list);
  }

  /* ================= 模块 6：千问辅助建议 ================= */
  function buildTaskText() {
    var p = proj();
    var sc = runCompliance();
    var sub = subById(p.scenario.subcategoryId);
    var marketName = JUR[p.scenario.market] ? JUR[p.scenario.market].name : p.scenario.market;
    var lines = [];
    lines.push('# 小家电出海分析任务（远见·企业出海助手 生成）');
    lines.push('');
    lines.push('生成时间：' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '｜输入指纹：' + inputHash() + '｜数据快照：' + E.SNAPSHOT_DATE);
    lines.push('');
    lines.push('请以合规顾问视角分析以下出海情景。要求：只基于「已知事实」与「引用依据」推理；对缺失信息明确列为「待补资料」，不要假设已取得认证或已确定进口商。');
    lines.push('');
    lines.push('## 一、项目情景');
    lines.push('- 项目：' + p.name + '；企业：' + (p.companyName || '未填写'));
    lines.push('- 产品小类：' + (sub ? sub.name + '（' + sub.id + '，证据等级 ' + sub.evidence + '）' : '未选') + '；主要功能：' + (sub ? sub.core : '—'));
    lines.push('- 目的地：' + marketName + '（法域链：' + (sc ? sc.jurisdictionChain.join(' → ') : '—') + '）');
    lines.push('- 投放市场日期：' + (p.scenario.placingOnMarketDate || '未填') + '；进口/申报日期：' + (p.scenario.importDate || '未填') + '；企业角色：' + (p.scenario.role || '未填'));
    lines.push('');
    lines.push('## 二、已知产品/经营事实');
    var facts = engineFacts();
    var keys = Object.keys(facts);
    if (!keys.length) lines.push('（暂无已登记事实）');
    keys.sort().forEach(function (k) {
      var f = lookupField(k);
      var v = facts[k];
      var vs = v === true ? '是' : v === false ? '否' : String(v);
      lines.push('- ' + (f ? f.name : k) + '（' + k + '）：' + vs + (p.scenario.factNotes[k] ? '〔' + p.scenario.factNotes[k] + '〕' : ''));
    });
    var unk = Object.keys(p.scenario.factsUnknown).filter(function (k) { return p.scenario.factsUnknown[k]; });
    if (unk.length) {
      lines.push('');
      lines.push('## 三、明确不确定的事实（不得按“否”推断）');
      unk.forEach(function (k) { var f = lookupField(k); lines.push('- ' + (f ? f.name : k) + '（' + k + '）'); });
    }
    if (sc) {
      lines.push('');
      lines.push('## 四、本地规则引擎初筛结果（规则提示，非千问输出）');
      lines.push('- 覆盖等级：' + sc.coverage.level + '（' + sc.coverage.label + '）');
      lines.push('- 可能适用规则 ' + sc.applicableRules.length + ' 条：' + (sc.applicableRules.map(function (r) { return r.id + ' ' + r.name; }).join('；') || '无'));
      lines.push('- 待补事实规则 ' + sc.unknownRules.length + ' 条；缺失字段：' + (sc.missingFields.join('、') || '无'));
      lines.push('- 不适用规则 ' + sc.excludedRules.length + ' 条；待规则核验法规 ' + sc.pendingRegulations.length + ' 条');
      sc.gaps.forEach(function (g) { lines.push('- 覆盖缺口：' + g); });
    }
    // 税费
    var tax = E.calculateTaxes(D, taxInput());
    lines.push('');
    lines.push('## 五、税费阶段测算与缺口');
    if (tax.lines && tax.lines.length) {
      lines.push('- 币种：' + tax.currency + '；已知法定分项小计：' + (tax.known_statutory_subtotal === null ? '不可用' : tax.known_statutory_subtotal) + '；完整总额：' + (tax.complete_total === null ? '不可用' : tax.complete_total));
      tax.lines.forEach(function (l) { lines.push('  - ' + l.label + '：税率 ' + (l.rate === null ? '—' : (l.rate * 100) + '%') + '，金额 ' + (l.amount === null ? '被阻断' : l.amount) + '（' + l.classification + '）'); });
    } else {
      lines.push('- 当前目的地没有可复算税费画像：' + (tax.blockers[0] || ''));
    }
    (tax.blockers || []).forEach(function (b) { lines.push('- 阻断原因：' + b); });
    // 新闻
    if (p.newsSelected.length) {
      lines.push('');
      lines.push('## 六、所选政策新闻线索');
      NEWS.items.filter(function (it) { return p.newsSelected.indexOf(newsId(it)) >= 0; }).forEach(function (it) {
        lines.push('- [' + fmtDate(it.date) + '][' + it.market + '][' + it.category + '] ' + it.title + '（来源：' + it.source + '；核验状态：' + (it.verified || '待核验') + '）');
        if (it.summary) lines.push('  摘要：' + String(it.summary).slice(0, 200));
        lines.push('  原文：' + it.url);
      });
      lines.push('提示：官方新闻不自动等于已生效法规；请核对适用日期与产品范围。');
    }
    lines.push('');
    lines.push('## 七、要求的输出结构');
    lines.push('请严格按以下结构输出，并在每项结论后标注引用依据（法规编号/条款/官方链接）：');
    lines.push('1. 已知事实清单（区分企业档案带入值与出口版需重核值）；');
    lines.push('2. 适用前提（每条结论成立所依赖的事实与日期条件）；');
    lines.push('3. 待补资料清单（按优先级排序，注明向谁索取）；');
    lines.push('4. 优先行动（含建议责任角色：合规/产品/质量/物流/销售）；');
    lines.push('5. 引用依据汇总；');
    lines.push('6. 三组建议：**立即办理** ／ **补证后判断** ／ **持续关注**。');
    lines.push('');
    lines.push('约束：不要虚构认证状态、进口商、税率或生效日期；未知税率与贸易救济不得按零处理；对覆盖不足的产品与市场组合明确说明缺口。');
    return lines.join('\n');
  }
  function renderQianwen() {
    var host = $('qianwenBody');
    clear(host);
    var p = proj();
    var cur = inputHash();

    var card = h('div', { class: 'card' });
    card.appendChild(h('h3', {}, '手动闭环：生成分析任务 → 交给千问办公 → 粘贴回复'));
    card.appendChild(h('div', { class: 'banner info' }, '本模块不调用付费 API，也不在本页面内运行模型：任务由你复制后交给千问办公实际分析，真实回复由你粘贴回本页保存。页面明确区分「规则提示（本地引擎）」与「千问回复（人工导入）」；本页面不会虚构任何千问输出。'));
    var genBtn = h('button', { class: 'btn' }, '根据当前项目生成分析任务');
    var ta = h('textarea', { class: 'task', spellcheck: 'false', 'aria-label': '分析任务文本' });
    ta.value = p.qianwen.taskText || '';
    var taskMeta = h('p', { class: 'subhint' });
    function updateTaskMeta() {
      if (!p.qianwen.taskText) { taskMeta.textContent = '尚未生成任务。'; return; }
      var same = p.qianwen.taskHash === cur;
      taskMeta.textContent = '任务生成于 ' + fmtDateTime(p.qianwen.taskAt) + '；输入指纹 ' + p.qianwen.taskHash + (same ? '（与当前输入一致）' : '（当前输入已变化——任务内容可能过时，建议重新生成）');
    }
    genBtn.addEventListener('click', function () {
      genBtn.disabled = true;
      genBtn.innerHTML = '';
      genBtn.appendChild(h('span', { class: 'spin' }));
      genBtn.appendChild(document.createTextNode('生成中'));
      setTimeout(function () {
        try {
          p.qianwen.taskText = buildTaskText();
          p.qianwen.taskHash = inputHash();
          p.qianwen.taskAt = new Date().toISOString();
          ta.value = p.qianwen.taskText;
          updateTaskMeta();
          touch();
          toast('分析任务已生成（基于当前输入指纹 ' + p.qianwen.taskHash + '）', 'ok');
        } catch (e) {
          toast('生成失败：' + e.message, 'err');
        } finally {
          genBtn.disabled = false;
          genBtn.textContent = '重新生成分析任务';
        }
      }, 150);
    });
    var copyBtn = h('button', { class: 'btn sec', style: 'margin-left:8px' }, '复制任务');
    copyBtn.addEventListener('click', function () {
      if (!ta.value) { toast('请先生成任务', 'err'); return; }
      var done = function () { toast('已复制到剪贴板，请粘贴给千问办公', 'ok'); };
      var fail = function () {
        ta.removeAttribute('readonly'); ta.select();
        try { document.execCommand('copy'); done(); }
        catch (e) { toast('复制失败：请手动全选文本复制', 'err'); }
        window.getSelection && window.getSelection().removeAllRanges();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(done, fail);
      } else fail();
    });
    var btnRow = h('div', { style: 'margin:8px 0' }, genBtn, copyBtn);
    card.appendChild(btnRow);
    ta.setAttribute('readonly', 'readonly');
    card.appendChild(ta);
    card.appendChild(taskMeta);
    host.appendChild(card);

    // 回复
    var rc = h('div', { class: 'card' });
    rc.appendChild(h('h3', {}, '粘贴千问回复并保存'));
    rc.appendChild(h('p', { class: 'subhint' }, '把千问办公的真实回复粘贴到下方，保存后合并进综合报告；保存时记录当前输入指纹，输入变化后自动显示「需要重新分析」。'));
    var ra = h('textarea', { class: 'task', placeholder: '在此粘贴千问回复……' });
    var saveBtn = h('button', { class: 'btn', style: 'margin-top:8px' }, '保存回复到项目');
    saveBtn.addEventListener('click', function () {
      if (!ra.value.trim()) { toast('回复内容为空', 'err'); return; }
      p.qianwen.responses.unshift({ id: 'R' + Date.now().toString(36), at: new Date().toISOString(), hash: cur, text: ra.value.trim() });
      if (p.qianwen.responses.length > 20) p.qianwen.responses.pop();
      ra.value = '';
      touch();
      toast('回复已保存（输入指纹 ' + cur + '）', 'ok');
      renderQianwen();
    });
    rc.appendChild(ra);
    rc.appendChild(saveBtn);
    host.appendChild(rc);

    // 已保存回复
    var lc = h('div', { class: 'card' });
    lc.appendChild(h('h3', {}, '已保存的千问回复（' + p.qianwen.responses.length + '）'));
    if (!p.qianwen.responses.length) lc.appendChild(h('p', { class: 'subhint' }, '还没有保存的回复。'));
    p.qianwen.responses.forEach(function (r) {
      var same = r.hash === cur;
      var item = h('div', { class: 'rule-item ' + (same ? 'state-applicable' : 'state-unknown') });
      var head = h('div', { class: 'head' });
      head.appendChild(h('span', { class: 'tag brand' }, '千问回复（人工导入）'));
      head.appendChild(h('span', { class: 'tag' }, '保存于 ' + fmtDateTime(r.at)));
      head.appendChild(same ? h('span', { class: 'tag ok' }, '与当前输入一致') : h('span', { class: 'tag bad' }, '需要重新分析（输入已变化）'));
      item.appendChild(head);
      var pre = h('div', { class: 'body', style: 'white-space:pre-wrap;font-size:13.5px' }, r.text);
      item.appendChild(pre);
      var del = h('button', { class: 'btn sm danger', style: 'margin-top:6px' }, '删除该回复');
      del.addEventListener('click', function () {
        p.qianwen.responses = p.qianwen.responses.filter(function (x) { return x.id !== r.id; });
        touch(); renderQianwen();
      });
      item.appendChild(del);
      lc.appendChild(item);
    });
    host.appendChild(lc);
  }

  /* ================= 模块 7：综合报告 ================= */
  function reportData() {
    var p = proj();
    var sc = runCompliance();
    var tax = E.calculateTaxes(D, taxInput());
    var sub = subById(p.scenario.subcategoryId);
    var selectedNews = NEWS.items.filter(function (it) { return p.newsSelected.indexOf(newsId(it)) >= 0; });
    var cur = inputHash();
    return { p: p, sc: sc, tax: tax, sub: sub, selectedNews: selectedNews, hash: cur };
  }
  function renderReport() {
    var host = $('reportBody');
    clear(host);
    var p = proj();
    var R = reportData();

    var head = h('div', { class: 'card' });
    head.appendChild(h('h2', {}, '远见 · 企业出海综合报告'));
    head.appendChild(h('p', { class: 'subhint' }, '项目：' + p.name + '｜生成时间：' + fmtDateTime(new Date().toISOString()) + '｜当前输入指纹：' + R.hash + '｜数据快照：' + E.SNAPSHOT_DATE));
    var snaps = p.reportSnapshots;
    if (snaps.length) {
      var latest = snaps[0];
      if (latest.hash === R.hash) head.appendChild(h('div', { class: 'fresh' }, '最新报告快照（' + fmtDateTime(latest.at) + '）与当前输入一致。'));
      else head.appendChild(h('div', { class: 'stale' }, '注意：当前输入与最近报告快照（' + fmtDateTime(latest.at) + '，指纹 ' + latest.hash + '）不一致——快照为历史结果，下列内容按当前输入实时重新计算。可点击「保存报告快照」更新基准。'));
    } else {
      head.appendChild(h('div', { class: 'banner info' }, '尚未保存报告快照。修改输入后，未另存的旧报告不会继续被当作最新结论；建议在每次评审前点击「保存报告快照」。'));
    }
    head.appendChild(h('p', { class: 'subhint' }, '本机保存说明：项目数据保存在本机浏览器 localStorage，属单人本机使用，不是多人协作或团队同步；团队共享请使用导出的 JSON 或打印 PDF。'));
    host.appendChild(head);

    // 1 项目与企业
    var s1 = h('div', { class: 'card' });
    s1.appendChild(h('h3', {}, '1. 企业与项目'));
    var kv = h('dl', { class: 'kv' });
    function kvr(k, v) { kv.appendChild(h('dt', {}, k)); kv.appendChild(h('dd', {}, v === '' || v === undefined ? '—' : v)); }
    kvr('企业', p.companyName || '未填写');
    kvr('项目', p.name);
    kvr('目的地', p.scenario.market ? (JUR[p.scenario.market] ? JUR[p.scenario.market].name + '（' + p.scenario.market + '）' : p.scenario.market) : '未选');
    kvr('产品小类', R.sub ? R.sub.name + '（' + R.sub.id + '，证据 ' + R.sub.evidence + '）' : '未选');
    kvr('投放市场日期', p.scenario.placingOnMarketDate || '未填');
    kvr('进口/申报日期', p.scenario.importDate || '未填');
    kvr('企业角色', p.scenario.role || '未填');
    s1.appendChild(kv);
    host.appendChild(s1);

    // 2 产品事实
    var s2 = h('div', { class: 'card' });
    s2.appendChild(h('h3', {}, '2. 关键产品与经营事实'));
    var facts = engineFacts();
    var fkeys = Object.keys(facts);
    var ukeys = Object.keys(p.scenario.factsUnknown).filter(function (k) { return p.scenario.factsUnknown[k]; });
    if (fkeys.length || ukeys.length) {
      var ft = h('table', { class: 't' });
      ft.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '事实'), h('th', {}, '值'), h('th', {}, '来源/说明'))));
      var fb = h('tbody', {});
      fkeys.sort().forEach(function (k) {
        var f = lookupField(k);
        var v = facts[k];
        fb.appendChild(h('tr', {}, h('td', {}, f ? f.name : k), h('td', {}, v === true ? '是' : v === false ? '否' : String(v)), h('td', {}, p.scenario.factNotes[k] || '')));
      });
      ukeys.forEach(function (k) {
        var f = lookupField(k);
        fb.appendChild(h('tr', {}, h('td', {}, f ? f.name : k), h('td', {}, h('span', { class: 'tag warn' }, '不确定')), h('td', {}, '对应判断保持待确认，不按「否」处理')));
      });
      ft.appendChild(fb);
      s2.appendChild(ft);
    } else s2.appendChild(h('p', { class: 'subhint' }, '未登记产品事实。'));
    host.appendChild(s2);

    // 3 合规初筛
    var s3 = h('div', { class: 'card' });
    s3.appendChild(h('h3', {}, '3. 法规与合规初筛结论'));
    if (!R.sc) { s3.appendChild(h('p', { class: 'subhint' }, '未完成登记，无法评估。')); }
    else {
      var sc = R.sc;
      s3.appendChild(h('p', {}, '覆盖等级：', h('b', {}, sc.coverage.level + '（' + sc.coverage.label + '）'), '；法域链：' + sc.jurisdictionChain.join(' → ') + '；评估基准日期：' + sc.asOf));
      sc.gaps.forEach(function (g) { s3.appendChild(h('div', { class: 'banner bad' }, '覆盖缺口：' + g)); });
      var rt = h('table', { class: 't' });
      rt.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '规则'), h('th', {}, '结论'), h('th', {}, '义务/原因'), h('th', {}, '依据'))));
      var rb = h('tbody', {});
      function ruleRow(r, stateLabel, cls) {
        rb.appendChild(h('tr', {},
          h('td', {}, h('b', {}, r.name), h('div', { class: 'subhint' }, r.id + '｜' + (JUR[r.jurisdiction] ? JUR[r.jurisdiction].name : r.jurisdiction))),
          h('td', {}, h('span', { class: 'tag ' + cls }, stateLabel)),
          h('td', {}, r.state === 'unknown' ? ('待补：' + (r.missingFields || []).map(function (k) { var f = lookupField(k); return f ? f.name : k; }).join('、')) : (r.state === 'not_applicable' ? ((r.dateActive === false ? r.dateReason + '；' : '') + (r.notApplicable || '条件不满足')) : (r.obligation || ''))),
          h('td', {}, h('div', { class: 'subhint' }, (r.locator ? r.locator + '　' : '') + ''), sourceLinks(r.sourceIds))));
      }
      sc.applicableRules.forEach(function (r) { ruleRow(r, r.state === 'review_required' ? '需人工复核' : '可能适用', r.state === 'review_required' ? 'info' : 'ok'); });
      sc.unknownRules.forEach(function (r) { ruleRow(r, '待补事实', 'warn'); });
      sc.excludedRules.forEach(function (r) { ruleRow(r, '不适用', ''); });
      rt.appendChild(rb);
      s3.appendChild(h('div', { class: 'tbl-wrap' }, rt));
      if (sc.pendingRegulations.length) {
        var pd = h('details', { class: 'box' });
        pd.appendChild(h('summary', {}, '待规则核验法规（' + sc.pendingRegulations.length + ' 条，仅索引级）'));
        sc.pendingRegulations.forEach(function (reg) {
          pd.appendChild(h('div', {}, '· ' + reg.name + '（' + reg.id + '，核验 ' + reg.checkedAt + '）', reg.officialUrl ? h('a', { href: reg.officialUrl, target: '_blank', rel: 'noopener noreferrer', style: 'margin-left:6px' }, '原文') : null));
        });
        s3.appendChild(pd);
      }
    }
    host.appendChild(s3);

    // 4 行动与材料
    var s4 = h('div', { class: 'card' });
    s4.appendChild(h('h3', {}, '4. 行动清单与材料（含完成状态）'));
    if (R.sc && R.sc.actionList.length) {
      var at = h('table', { class: 't' });
      at.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '行动'), h('th', {}, '责任建议'), h('th', {}, '节点'), h('th', {}, '状态'))));
      var ab = h('tbody', {});
      R.sc.actionList.forEach(function (a) {
        var done = !!(p.todoState[a.id] && p.todoState[a.id].done);
        ab.appendChild(h('tr', {},
          h('td', {}, h('b', {}, a.name), h('div', { class: 'subhint' }, a.text + (a.locator ? '｜' + a.locator : ''))),
          h('td', {}, a.responsibility || '—'),
          h('td', {}, a.due || '—'),
          h('td', {}, done ? h('span', { class: 'tag ok' }, '已勾选完成') : h('span', { class: 'tag' }, '未完成'))));
      });
      at.appendChild(ab);
      s4.appendChild(h('div', { class: 'tbl-wrap' }, at));
      var mats = R.sc.materialList.map(function (m) { return m.name + (m.prep ? '（' + m.prep + '）' : ''); });
      s4.appendChild(h('p', {}, '涉及材料（' + R.sc.materialList.length + ' 项）：', mats.length ? mats.join('；') : '—'));
    } else s4.appendChild(h('p', { class: 'subhint' }, '当前没有适用的规则，因此没有生成的行动与材料；这不代表无需办理任何手续，请查看覆盖缺口与待规则核验清单。'));
    host.appendChild(s4);

    // 5 HS 与税费
    var s5 = h('div', { class: 'card' });
    s5.appendChild(h('h3', {}, '5. HS 候选与税费阶段测算'));
    if (p.hsChoice) {
      var c = D.hsCandidates.find(function (x) { return x.id === p.hsChoice; });
      if (c) s5.appendChild(h('p', {}, '选定 HS 候选：', h('b', {}, c.code), '（候选方向，非海关最终归类；复核状态：' + (c.review || '—') + '）'));
    } else s5.appendChild(h('p', { class: 'subhint' }, '未选择 HS 候选。'));
    if (R.tax.lines && R.tax.lines.length) {
      var tt = h('table', { class: 't' });
      tt.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '分项'), h('th', { class: 'num' }, '税率'), h('th', { class: 'num' }, '税基'), h('th', { class: 'num' }, '金额（' + R.tax.currency + '）'), h('th', {}, '承担方'), h('th', {}, '依据'))));
      var tb2 = h('tbody', {});
      R.tax.lines.forEach(function (l) {
        tb2.appendChild(h('tr', {}, h('td', {}, l.label),
          h('td', { class: 'num' }, l.rate === null || l.rate === undefined ? '—' : (l.rate * 100).toFixed(l.rate * 100 % 1 === 0 ? 0 : 1) + '%'),
          h('td', { class: 'num' }, typeof l.base === 'number' ? l.base.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : (l.base || '—')),
          h('td', { class: 'num' }, l.amount === null || l.amount === undefined ? '—（被阻断）' : Number(l.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })),
          h('td', {}, l.payer || '—'),
          h('td', {}, sourceLinks(l.sourceIds))));
      });
      tt.appendChild(tb2);
      s5.appendChild(h('div', { class: 'tbl-wrap' }, tt));
      s5.appendChild(h('p', {}, '已知法定分项小计：', h('b', {}, R.tax.known_statutory_subtotal === null ? '不可用' : fmtMoney(R.tax.known_statutory_subtotal, R.tax.currency)),
        '；完整总额：', h('b', { style: R.tax.complete_total === null ? 'color:var(--bad)' : 'color:var(--ok)' }, R.tax.complete_total === null ? '不可用' : fmtMoney(R.tax.complete_total, R.tax.currency))));
      (R.tax.blockers || []).forEach(function (b) { s5.appendChild(h('div', { class: 'banner bad' }, '阻断：' + b)); });
    } else {
      (R.tax.blockers || ['当前目的地无可复算税费画像。']).forEach(function (b) { s5.appendChild(h('div', { class: 'banner bad' }, '税费缺口：' + b)); });
    }
    host.appendChild(s5);

    // 6 新闻
    var s6 = h('div', { class: 'card' });
    s6.appendChild(h('h3', {}, '6. 所选政策新闻（' + R.selectedNews.length + ' 条）'));
    s6.appendChild(h('p', { class: 'subhint' }, '官方新闻不自动等于已生效法规；快照时间 ' + fmtDateTime(NEWS.meta && NEWS.meta.exportedAt) + '。'));
    R.selectedNews.forEach(function (it) {
      s6.appendChild(h('div', {}, '· [' + fmtDate(it.date) + '][' + it.market + '] ',
        h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer' }, it.title),
        '（' + it.source + '，核验：' + (it.verified || '待核验') + '）'));
    });
    if (!R.selectedNews.length) s6.appendChild(h('p', { class: 'subhint' }, '未选择新闻。可在第 5 步筛选并勾选。'));
    host.appendChild(s6);

    // 7 千问建议
    var s7 = h('div', { class: 'card' });
    s7.appendChild(h('h3', {}, '7. 千问辅助建议（人工导入回复 ' + p.qianwen.responses.length + ' 份）'));
    s7.appendChild(h('p', { class: 'subhint' }, '区分说明：本报告第 3 节的规则结论来自本地规则引擎（规则提示）；以下内容为千问办公人工导入回复，页面不虚构任何模型输出。'));
    if (p.qianwen.responses.length) {
      p.qianwen.responses.forEach(function (r) {
        var same = r.hash === R.hash;
        s7.appendChild(h('div', { class: 'rule-item ' + (same ? 'state-applicable' : 'state-unknown') },
          h('div', { class: 'head' },
            h('span', { class: 'tag brand' }, '千问回复（人工导入）'),
            h('span', { class: 'tag' }, fmtDateTime(r.at)),
            same ? h('span', { class: 'tag ok' }, '与当前输入一致') : h('span', { class: 'tag bad' }, '需要重新分析（输入已变化）')),
          h('div', { class: 'body', style: 'white-space:pre-wrap;font-size:13.5px' }, r.text)));
      });
    } else {
      s7.appendChild(h('div', { class: 'banner info' }, '尚无千问回复。请到第 6 步生成分析任务 → 交给千问办公 → 粘贴保存。'));
    }
    host.appendChild(s7);

    // 8 追溯说明
    var s8 = h('div', { class: 'card' });
    s8.appendChild(h('h3', {}, '8. 结论追溯与免责'));
    s8.appendChild(h('p', { class: 'subhint' }, '每条规则结论均含规则 ID、法域、条款定位与来源链接；税费分项含税率、税基、币种、承担方与来源 ID；新闻含发布时间、来源与核验状态；千问回复含保存时间与输入指纹。'));
    s8.appendChild(h('p', { class: 'subhint' }, '本报告为合规准备与资料组织工具的输出：不构成正式合规、认证、法律、税务、原产资格或海关归类结论；数据快照 ' + E.SNAPSHOT_DATE + '，覆盖范围与未完成事项见「数据说明」。'));
    host.appendChild(s8);

    $('reportHint').textContent = '历史快照 ' + (p.reportSnapshots.length) + ' 份（最新 ' + (p.reportSnapshots[0] ? fmtDateTime(p.reportSnapshots[0].at) : '—') + '）';
  }
  $('btnPrint').addEventListener('click', function () { window.print(); });
  $('btnExportJson').addEventListener('click', function () {
    var p = proj();
    var R = reportData();
    var payload = {
      exportedAt: new Date().toISOString(), app: D.meta.app, version: D.meta.version,
      snapshot: E.SNAPSHOT_DATE, inputHash: R.hash,
      project: p,
      computed: {
        coverage: R.sc ? R.sc.coverage : null,
        applicableRules: R.sc ? R.sc.applicableRules.map(function (r) { return { id: r.id, name: r.name, obligation: r.obligation, locator: r.locator, sourceIds: r.sourceIds }; }) : [],
        unknownRules: R.sc ? R.sc.unknownRules.map(function (r) { return { id: r.id, missingFields: r.missingFields }; }) : [],
        gaps: R.sc ? R.sc.gaps : [],
        tax: { currency: R.tax.currency, known_statutory_subtotal: R.tax.known_statutory_subtotal, complete_total: R.tax.complete_total, blockers: R.tax.blockers, lines: R.tax.lines },
        selectedNews: R.selectedNews
      },
      note: '本文件为项目导出（单人本机使用），非多人协作记录。'
    };
    var blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '远见出海项目-' + (p.name || '未命名') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('项目 JSON 已导出', 'ok');
  });
  $('btnSaveSnapshot').addEventListener('click', function () {
    var p = proj();
    var R = reportData();
    p.reportSnapshots.unshift({ at: new Date().toISOString(), hash: R.hash, name: p.name, note: '适用 ' + (R.sc ? R.sc.applicableRules.length : 0) + ' 条；税费完整总额 ' + (R.tax.complete_total === null ? '不可用' : R.tax.complete_total) });
    if (p.reportSnapshots.length > 10) p.reportSnapshots.pop();
    touch();
    toast('报告快照已保存（指纹 ' + R.hash + '）', 'ok');
    renderReport();
  });

  /* ================= 数据说明 ================= */
  function renderAbout() {
    var host = $('aboutBody');
    clear(host);
    var c = h('div', { class: 'card' });
    c.appendChild(h('h3', {}, '数据来源与快照'));
    c.appendChild(h('p', { class: 'subhint' }, '整合构建日期：' + D.meta.builtAt + '；原始数据快照：' + D.meta.dataAsOf + '。'));
    D.meta.dataSources.forEach(function (s) { c.appendChild(h('p', { style: 'margin:4px 0;font-size:13.5px' }, '· ' + s)); });
    c.appendChild(h('p', { class: 'subhint' }, '范围：' + D.meta.scope));
    host.appendChild(c);

    var n = h('div', { class: 'card' });
    n.appendChild(h('h3', {}, '数据规模'));
    n.appendChild(h('div', { class: 'legend' },
      h('span', { class: 'tag brand' }, '法规索引 ' + D.regulations.length),
      h('span', { class: 'tag brand' }, '来源记录 ' + D.sources.length),
      h('span', { class: 'tag brand' }, '条件规则 ' + D.rules.length),
      h('span', { class: 'tag brand' }, '产品小类 ' + D.subcategories.length),
      h('span', { class: 'tag brand' }, '动态问题映射 ' + D.dynamicMap.length),
      h('span', { class: 'tag brand' }, '行动 ' + D.actions.length),
      h('span', { class: 'tag brand' }, '材料 ' + D.materials.length),
      h('span', { class: 'tag brand' }, 'HS 候选 ' + D.hsCandidates.length),
      h('span', { class: 'tag brand' }, '税费画像 ' + D.taxProfiles.length)));
    n.appendChild(h('h4', {}, '服务覆盖等级'));
    Object.keys(D.meta.levels).forEach(function (k) {
      n.appendChild(h('p', { style: 'margin:4px 0;font-size:13.5px' }, h('span', { class: 'tag brand' }, k), ' ' + D.meta.levels[k]));
    });
    host.appendChild(n);

    var g = h('div', { class: 'card' });
    g.appendChild(h('h3', {}, '未完成事项与缺口'));
    g.appendChild(h('p', { class: 'subhint' }, D.gapsSummary.note));
    var glist = h('table', { class: 't' });
    glist.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '审计项'), h('th', {}, '严重度'), h('th', {}, '发现'), h('th', {}, '处理方向'))));
    var gb = h('tbody', {});
    D.hsTaxAudit.forEach(function (a) {
      gb.appendChild(h('tr', {}, h('td', {}, a.id), h('td', {}, h('span', { class: 'tag ' + (a.severity === 'critical' ? 'bad' : 'warn') }, a.severity)), h('td', {}, a.finding), h('td', {}, a.resolution)));
    });
    glist.appendChild(gb);
    g.appendChild(h('div', { class: 'tbl-wrap' }, glist));
    g.appendChild(h('p', { class: 'subhint' }, '覆盖矩阵缺口总数：' + D.gapsSummary.total + '（法域 × 主题矩阵空白、成员国实施缺口与来源访问问题合计，不代表 440 部法规缺失）。'));
    host.appendChild(g);

    var nw = h('div', { class: 'card' });
    nw.appendChild(h('h3', {}, '新闻更新机制与覆盖边界'));
    nw.appendChild(h('p', { class: 'subhint' }, 'GitHub Actions 定时采集（北京时间约 09:17 / 17:17，可手动运行）→ 合并去重 → 输出 news.json / news.js 与来源状态 → GitHub Pages 发布。这是定时快照，不是实时监控；来源为政府官方 RSS/Atom 公告，不覆盖全网舆情与社交平台情感监测；采集遵循来源网站访问规则，失败时保留历史快照并记录失败状态。'));
    host.appendChild(nw);

    var d = h('div', { class: 'card' });
    d.appendChild(h('h3', {}, '免责声明'));
    d.appendChild(h('p', { class: 'subhint' }, '本工具用于初步合规辅助和资料组织。任何材料勾选、规则匹配、HS 候选或税费结果都不自动构成正式合规、认证、法律、税务、原产资格或海关归类结论。规则、税率、费用或关键事实不完整时，系统显示已知分项与明确缺口，完整结论保持为空。'));
    host.appendChild(d);
  }

  /* ================= 项目管理 ================= */
  function refreshProjSelect() {
    var sel = $('projSelect');
    clear(sel);
    state.projects.forEach(function (p) {
      sel.appendChild(h('option', { value: p.id }, p.name + (p.scenario.market ? '（' + (JUR[p.scenario.market] ? JUR[p.scenario.market].name : p.scenario.market) + '）' : '')));
    });
    sel.value = state.currentId;
  }
  $('projSelect').addEventListener('change', function () {
    state.currentId = $('projSelect').value;
    lastCompliance = null;
    persist(false);
    renderTab(currentTab);
    toast('已切换项目：' + proj().name, 'ok');
  });
  $('btnNewProj').addEventListener('click', function () {
    var name = window.prompt('新项目名称：', '新项目');
    if (name === null) return;
    var p = defaultProject(name.trim() || '新项目');
    state.projects.unshift(p);
    state.currentId = p.id;
    lastCompliance = null;
    persist(false);
    refreshProjSelect();
    showTab('product');
    toast('已创建项目：' + p.name, 'ok');
  });
  $('btnRenameProj').addEventListener('click', function () {
    var name = window.prompt('重命名项目：', proj().name);
    if (name === null) return;
    proj().name = name.trim() || proj().name;
    touch();
    refreshProjSelect();
    renderTab(currentTab);
  });
  $('btnDelProj').addEventListener('click', function () {
    if (state.projects.length <= 1) { toast('至少保留一个项目', 'err'); return; }
    if (!window.confirm('确定删除项目「' + proj().name + '」？该项目数据将从本机存储移除。')) return;
    var id = proj().id;
    state.projects = state.projects.filter(function (p) { return p.id !== id; });
    state.currentId = state.projects[0].id;
    lastCompliance = null;
    persist(false);
    refreshProjSelect();
    renderTab(currentTab);
    toast('项目已从本机存储删除', 'ok');
  });

  /* ================= 标签事件与启动 ================= */
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
  });

  loadState();
  refreshProjSelect();
  showTab('company');
  persist(false);

  /* 测试钩子：仅暴露当前项目读改与重载，不含任何敏感信息 */
  window.__VO_TEST__ = {
    current: function () { return proj(); },
    mutate: function (fn) { fn(proj()); touch(); },
    reloadAll: function () { loadState(); refreshProjSelect(); showTab(currentTab); }
  };
})();
