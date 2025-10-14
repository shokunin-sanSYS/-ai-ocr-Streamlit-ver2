// ====== State ======
const cnv = document.getElementById('canvas');
const ctx = cnv.getContext('2d');
const zcv = document.getElementById('zoom');
const ztx = zcv.getContext('2d');

const thres = document.getElementById('thres');
const thresVal = document.getElementById('thresVal');
const zoomSize = document.getElementById('zoomSize');
const zoomSizeVal = document.getElementById('zoomSizeVal');
const zoomScale = document.getElementById('zoomScale');
const zoomScaleVal = document.getElementById('zoomScaleVal');
const realmm = document.getElementById('realmm');
const scaleInfo = document.getElementById('scaleInfo');
const subjectEl = document.getElementById('subject');

let image = new Image();
let dets = [];              // [{box:[[x,y]..4],[...]], text, conf]
let clicks = [];            // [{x,y}]
let pxPerMM = null;         // 計算結果

// ====== Helpers ======
function drawAll() {
  if (!image.complete) return;
  cnv.width = image.width; cnv.height = image.height;
  ctx.drawImage(image, 0, 0);
  const thr = parseFloat(thres.value);
  for (const d of dets) {
    if ((d.conf ?? 1) < thr) continue;
    const b = d.box.map(p => ({x: p[0], y: p[1]}));
    const x = Math.min(b[0].x, b[2].x), y = Math.min(b[0].y, b[2].y);
    const w = Math.abs(b[2].x - b[0].x), h = Math.abs(b[2].y - b[0].y);
    const isDim = /(?:[φ∅Φ]?\s?\d{2,5})(?:\s*[×x]\s*\d{2,5})?/u.test(d.text.replace(/\s+/g,''));
    ctx.lineWidth = 2;
    ctx.strokeStyle = isDim ? '#16a34a' : '#b59f00';
    ctx.strokeRect(x, y, w, h);
  }
  // クリック点＆線
  ctx.fillStyle = 'red';
  for (const p of clicks) ctx.fillRect(p.x-3, p.y-3, 6, 6);
  if (clicks.length >= 2) {
    ctx.strokeStyle = 'red'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(clicks[clicks.length-2].x, clicks[clicks.length-2].y);
    ctx.lineTo(clicks[clicks.length-1].x, clicks[clicks.length-1].y); ctx.stroke();
  }
}

function setZoomAround({x, y}) {
  const size = parseInt(zoomSize.value, 10);
  const scale = parseInt(zoomScale.value, 10);
  const half = Math.floor(size / 2);
  const sx = Math.max(0, x - half);
  const sy = Math.max(0, y - half);
  const ex = Math.min(image.width, x + half);
  const ey = Math.min(image.height, y + half);
  const cw = ex - sx, ch = ey - sy;
  zcv.width = cw * scale; zcv.height = ch * scale;
  ztx.imageSmoothingEnabled = false;
  ztx.drawImage(image, sx, sy, cw, ch, 0, 0, cw*scale, ch*scale);
  // 点と線を重畳
  ztx.fillStyle = 'red';
  for (const p of clicks.slice(-2)) {
    ztx.fillRect((p.x - sx)*scale - 3, (p.y - sy)*scale - 3, 6, 6);
  }
  if (clicks.length >= 2) {
    const a = clicks[clicks.length-2], b = clicks[clicks.length-1];
    ztx.strokeStyle = 'red'; ztx.lineWidth = 2;
    ztx.beginPath();
    ztx.moveTo((a.x - sx)*scale, (a.y - sy)*scale);
    ztx.lineTo((b.x - sx)*scale, (b.y - sy)*scale);
    ztx.stroke();
    const dpx = Math.hypot(a.x - b.x, a.y - b.y);
    document.getElementById('zoomMeta').textContent =
      `拡大: ${size}px ×${scale} / 2点距離: ${dpx.toFixed(1)} px / スケール: ${pxPerMM ? pxPerMM.toFixed(3) : '未設定'} px/mm`;
  } else {
    document.getElementById('zoomMeta').textContent = `拡大: ${size}px ×${scale}`;
  }
}

function updateScale() {
  if (clicks.length >= 2 && parseFloat(realmm.value) > 0) {
    const a = clicks[clicks.length-2], b = clicks[clicks.length-1];
    const dpx = Math.hypot(a.x - b.x, a.y - b.y);
    pxPerMM = dpx / parseFloat(realmm.value);
    if (!isFinite(pxPerMM)) return;
    scaleInfo.textContent = `スケール: ${pxPerMM.toFixed(3)} px/mm`;
  }
}

// ====== Events ======
cnv.addEventListener('click', (e)=>{
  const rect = cnv.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (cnv.width / rect.width));
  const y = Math.round((e.clientY - rect.top)  * (cnv.height / rect.height));
  clicks.push({x,y}); if (clicks.length > 10) clicks.shift();
  updateScale(); drawAll(); setZoomAround({x,y});
});

thres.oninput = ()=>{ thresVal.textContent = (+thres.value).toFixed(2); drawAll(); };
zoomSize.oninput = ()=>{ zoomSizeVal.textContent = zoomSize.value; if (clicks.length) setZoomAround(clicks[clicks.length-1]); };
zoomScale.oninput = ()=>{ zoomScaleVal.textContent = zoomScale.value; if (clicks.length) setZoomAround(clicks[clicks.length-1]); };
realmm.oninput = ()=>{ updateScale(); if (clicks.length) setZoomAround(clicks[clicks.length-1]); updateScale();};

document.getElementById('btn-reset').onclick = ()=>{
  clicks = []; pxPerMM = null; scaleInfo.textContent = 'スケール: ‐';
  document.getElementById('detail').innerHTML = '';
  document.getElementById('summary').innerHTML = '';
  drawAll();
};

document.getElementById('btn-demo').onclick = async ()=>{
  // デモ画像と検出結果を読み込み
  image.src = './demo_image.png';
  dets = await (await fetch('./demo_dets.json', {cache:'no-store'})).json();
  subjectEl.value = 'ビル 1階梁伏図（デモ用）';
  await new Promise(r=> image.onload = r);
  clicks = []; pxPerMM = null; scaleInfo.textContent = 'スケール: ‐';
  drawAll();
};

document.getElementById('file-img').onchange = async (e)=>{
  const f = e.target.files[0]; if (!f) return;
  subjectEl.value = (f.name || '').replace(/\.[^.]+$/,'') || subjectEl.value;
  image.src = URL.createObjectURL(f);
  await new Promise(r=> image.onload = r);
  drawAll();
};

document.getElementById('file-json').onchange = async (e)=>{
  const f = e.target.files[0]; if (!f) return;
  const txt = await f.text(); dets = JSON.parse(txt);
  drawAll();
};

// ====== Export: CSV / Excel ======
function buildDetail(threshold=0.5){
  // dets(JSON) → 明細配列
  const rows = [];
  for (const d of dets) {
    const conf = +(d.conf ?? 1);
    if (conf < threshold) continue;
    const txt = String(d.text || '').trim();
    const m = txt.replace(/\s+/g,'').match(/^(?:[φ∅Φ]?\s?(\d{2,5}))(?:\s*[×x]\s*(\d{2,5}))?(?:\s*(mm|㎜))?$/u);
    if (!m) continue;
    const g1 = m[1] ? +m[1] : null;
    const g2 = m[2] ? +m[2] : null;
    rows.push({
      source: subjectEl.value || 'drawing',
      page: 1,
      type: 'dimension_text',
      text: txt,
      dim1_mm: g1,
      dim2_mm: g2,
      conf: conf
    });
  }
  return rows;
}

function renderTables(rows){
  // Summary
  const count = rows.length;
  const sumTbl = document.getElementById('summary');
  sumTbl.innerHTML = `<tr><th>type</th><th>count</th></tr>
    <tr><td>dimension_text</td><td>${count}</td></tr>`;

  // Detail (top50)
  const detTbl = document.getElementById('detail');
  const head = ['source','page','type','text','dim1_mm','dim2_mm','conf'];
  detTbl.innerHTML = '<tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr>'+
    rows.slice(0,50).map(r=>'<tr>'+head.map(h=>`<td>${r[h] ?? ''}</td>`).join('')+'</tr>').join('');
}

document.getElementById('btn-csv').onclick = ()=>{
  const rows = buildDetail(parseFloat(thres.value));
  renderTables(rows);
  const head = ['source','page','type','text','dim1_mm','dim2_mm','conf'];
  const csv = [head.join(',')].concat(rows.map(r=>head.map(h=>r[h] ?? '').join(','))).join('\n');
  const blob = new Blob([new TextEncoder().encode(csv)], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'takeoff_result.csv'; a.click();
};

document.getElementById('btn-xlsx').onclick = ()=>{
  const rows = buildDetail(parseFloat(thres.value));
  renderTables(rows);

  // 単価マスタ（デモ用）
  const price = [
    {pattern:/^H[-‐–]200[×x]100/i, item:'鉄骨H形鋼 H-200×100', unit:'本', unit_price:12000},
    {pattern:/^φ?1[5-9]$/i,        item:'鉄筋 D16',              unit:'本', unit_price:600},
    {pattern:/^φ?16$/i,            item:'鉄筋 D16',              unit:'本', unit_price:600},
    {pattern:/^100[×x]200$/i,      item:'小梁 100×200',          unit:'本', unit_price:8000},
    {pattern:/^\d{4}$/,            item:'一般寸法テキスト',      unit:'式', unit_price:100},
  ];

  const tmp = rows.map(r=>({...r, item:'未分類', unit:'式', qty:1, unit_price:0}));
  for (const r of tmp){
    for (const p of price){
      if (p.pattern.test(String(r.text))) {
        r.item = p.item; r.unit = p.unit; r.unit_price = p.unit_price; break;
      }
    }
  }
  // 集計
  const map = new Map();
  for (const r of tmp){
    const key = `${r.item}|${r.unit}|${r.unit_price}`;
    const v = map.get(key) || {item:r.item, unit:r.unit, unit_price:r.unit_price, qty:0};
    v.qty += r.qty; map.set(key, v);
  }
  const est = Array.from(map.values()).map(v=>({...v, amount: v.qty * v.unit_price}));
  const subtotal = est.reduce((a,b)=>a+b.amount,0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;
  const hdr = [
    {項目:'小計', 金額:subtotal},
    {項目:'消費税', 金額:tax},
    {項目:'合計', 金額:total},
  ];

  // Excel生成（SheetJS）
  const wb = XLSX.utils.book_new();
  const wsDet = XLSX.utils.json_to_sheet(rows);
  const wsEst = XLSX.utils.json_to_sheet(est);
  const wsHdr = XLSX.utils.json_to_sheet(hdr);
  XLSX.utils.book_append_sheet(wb, wsDet, '明細');
  XLSX.utils.book_append_sheet(wb, wsEst, '見積明細');
  XLSX.utils.book_append_sheet(wb, wsHdr, '見積サマリー');

  // “見積書”シート（簡易）
  const title = [['見積書'],[],['件名', subjectEl.value || '図面AI-OCR積算 デモ'],['発行日', new Date().toISOString().slice(0,10)],[],['区分','項目','数量','単価','金額']];
  const wsDoc = XLSX.utils.aoa_to_sheet(title);
  let row = 7;
  for (const e of est){
    XLSX.utils.sheet_add_aoa(wsDoc, [['構造材', e.item, e.qty, e.unit_price, e.amount]], {origin: `A${row++}`});
  }
  row += 1;
  XLSX.utils.sheet_add_aoa(wsDoc, [['小計','', '', '', subtotal], ['消費税','', '', '', tax], ['合計','', '', '', total]], {origin: `A${row}`});
  wsDoc['!cols'] = [{wch:12},{wch:36},{wch:8},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsDoc, '見積書');

  XLSX.writeFile(wb, 'estimate.xlsx');
};
