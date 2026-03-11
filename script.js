const CATEGORIES = {
  electronica: { name: 'Electrónica', di: 18, te: 3, iva: 21, gan: 6 },
  textil: { name: 'Textil/Calzado', di: 35, te: 3, iva: 21, gan: 6 },
  bienes_capital: { name: 'Bienes de Capital', di: 0, te: 0, iva: 10.5, gan: 6 },
  juguetes: { name: 'Juguetes', di: 35, te: 3, iva: 21, gan: 6 },
  insumos: { name: 'Insumos Básicos', di: 14, te: 3, iva: 21, gan: 6 },
};

const CONTAINERS = [
  { id: 'lcl', name: 'LCL (Carga Suelta)', maxCbm: 15, maxKg: 10000 },
  { id: '20st', name: "Contenedor 20' ST", maxCbm: 28, maxKg: 28000 },
  { id: '40st', name: "Contenedor 40' ST", maxCbm: 58, maxKg: 28800 },
  { id: '40hc', name: "Contenedor 40' HC", maxCbm: 68, maxKg: 28800 },
];

let state = {
  displayCurrency: 'USD', includeRecup: true, incoterm: 'FOB', inlandFreight: 0,
  freight: 1200, insurance: 250, gastosPuerto: 850, exchangeRate: 1000, targetMargin: 33,
  items: [
    { id: uid(), sku: 'Auriculares BT Pro', category: 'electronica', quantity: 500, fobUnit: 18, pcsPerCarton: 5, length: 30, width: 20, height: 15, gwPerCarton: 2, impInterno: 0 }
  ]
};

function uid(){ return Math.random().toString(36).slice(2, 10); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmtUsd(v){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v); }
function fmtArs(v){ return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v); }
function money(v){ return state.displayCurrency === 'ARS' ? fmtArs(v * state.exchangeRate) : fmtUsd(v); }

async function syncDolarAPI() {
    const btn = document.getElementById('syncTC');
    if(btn) btn.textContent = '⏳';
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        document.getElementById('exchangeRate').value = data.venta;
        state.exchangeRate = data.venta;
        calculate();
    } catch (error) { console.error("Error TC", error); }
    finally { if(btn) btn.textContent = '🔄'; }
}

function itemTemplate(item, index){
  const options = Object.entries(CATEGORIES).map(([k,c]) => `<option value="${k}" ${item.category===k?'selected':''}>${c.name}</option>`).join('');
  return `
    <div class="item-card" data-id="${item.id}">
        <div class="stacked">
            <div><label>SKU #${index+1}</label><input data-field="sku" value="${item.sku}"></div>
            <div><label>Categoría</label><select data-field="category">${options}</select></div>
        </div>
        <div class="stacked">
            <div><label>Cant.</label><input type="number" step="any" data-field="quantity" value="${item.quantity}"></div>
            <div><label>FOB/U (USD)</label><input type="number" step="any" data-field="fobUnit" value="${item.fobUnit}"></div>
        </div>
        <div class="stacked">
            <div><label>Unid. x Caja</label><input type="number" step="any" data-field="pcsPerCarton" value="${item.pcsPerCarton}"></div>
            <div><label>Kg x Caja</label><input type="number" step="any" data-field="gwPerCarton" value="${item.gwPerCarton}"></div>
        </div>
        <div class="stacked">
            <div><label>Dim. L/A/H (cm)</label><div class="dim-grid">
                <input type="number" step="any" data-field="length" value="${item.length}" placeholder="L">
                <input type="number" step="any" data-field="width" value="${item.width}" placeholder="A">
                <input type="number" step="any" data-field="height" value="${item.height}" placeholder="H">
            </div></div>
            <div><label>% Imp. Int.</label><input type="number" step="any" data-field="impInterno" value="${item.impInterno || 0}"></div>
        </div>
        <button class="btn-danger remove-item" ${state.items.length===1?'disabled':''}>Eliminar</button>
    </div>`;
}

function renderItems(){
  const wrap = document.getElementById('items');
  wrap.innerHTML = state.items.map(itemTemplate).join('');
  wrap.querySelectorAll('.item-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', e => {
        const field = e.target.dataset.field;
        state.items.find(x => x.id === id)[field] = (e.target.tagName === 'SELECT' || field === 'sku') ? e.target.value : num(e.target.value);
        calculate();
      });
    });
    card.querySelector('.remove-item').addEventListener('click', () => {
      if (state.items.length > 1) { state.items = state.items.filter(x => x.id !== id); renderItems(); calculate(); }
    });
  });
}

function calculate(){
  state.freight = num(document.getElementById('freight').value);
  state.insurance = num(document.getElementById('insurance').value);
  state.gastosPuerto = num(document.getElementById('gastosPuerto').value);
  state.exchangeRate = num(document.getElementById('exchangeRate').value) || 1;
  state.inlandFreight = num(document.getElementById('inlandFreight').value);
  state.targetMargin = num(document.getElementById('targetMargin').value);
  document.getElementById('targetMarginValue').textContent = state.targetMargin + '%';

  const totalGoodsFob = state.items.reduce((a,i)=>a + num(i.quantity)*num(i.fobUnit), 0);
  let totalCbm = 0, totalKg = 0, totalDi=0, totalTe=0, totalIva=0, totalGan=0, totalImpIntGlobal=0, totalCostoNacionalizado=0;
  
  const processed = state.items.map(item => {
    const qty = num(item.quantity) || 1;
    const unitFob = num(item.fobUnit);
    const itemFob = qty * unitFob;
    const cartons = Math.ceil(qty / (num(item.pcsPerCarton) || 1));
    const itemCbm = cartons * ((num(item.length) * num(item.width) * num(item.height)) / 1000000);
    const itemKg = cartons * num(item.gwPerCarton);
    totalCbm += itemCbm; totalKg += itemKg;

    const weight = totalGoodsFob > 0 ? itemFob / totalGoodsFob : 0;
    const proratedFreight = state.freight * weight;
    const proratedInsurance = state.insurance * weight;
    const proratedInland = (state.incoterm === 'EXW' ? state.inlandFreight : 0) * weight;
    const proratedPort = state.gastosPuerto * weight;
    
    const itemCif = itemFob + proratedInland + proratedFreight + proratedInsurance;
    
    const cat = CATEGORIES[item.category] || CATEGORIES.electronica;
    const itemDi = itemCif * (cat.di/100); 
    const itemTe = itemCif * (cat.te/100);
    const baseIva = itemCif + itemDi + itemTe;
    const itemIva = baseIva * (cat.iva/100); 
    const itemGan = baseIva * (cat.gan/100);
    const itemImpInt = baseIva * ((num(item.impInterno)||0)/100);
    
    const impRecuperables = itemIva + itemGan; 
    const impNoRecuperables = itemDi + itemTe + itemImpInt;
    
    const costoItemTotal = itemCif + impNoRecuperables + proratedPort + (state.includeRecup ? impRecuperables : 0);
    const costoUnitarioUsd = costoItemTotal / qty;
    const factorIndividual = unitFob > 0 ? costoUnitarioUsd / unitFob : 0;
    
    totalDi += itemDi; totalTe += itemTe; totalIva += itemIva; totalGan += itemGan; totalImpIntGlobal += itemImpInt; totalCostoNacionalizado += costoItemTotal;

    return { 
      ...item, cat, qty, itemCif, costoUnitarioUsd, factorIndividual, 
      itemDi, itemTe, itemImpInt, proratedFreight, proratedInsurance, proratedPort 
    };
  });

  document.getElementById('totalGoodsValue').textContent = money(totalGoodsFob);
  document.getElementById('totalCostoNacionalizado').textContent = money(totalCostoNacionalizado);
  document.getElementById('factorGlobal').textContent = `Factor: ${(totalCostoNacionalizado / (totalGoodsFob || 1)).toFixed(2)}x`;
  document.getElementById('avgUnitCost').textContent = money(totalCostoNacionalizado / (state.items.reduce((a,i)=>a+num(i.quantity),0) || 1));
  
  const margenMult = 1 / (1 - state.targetMargin / 100 || 1);
  const ventasUsd = processed.reduce((a,i)=> a + (i.costoUnitarioUsd * margenMult) * num(i.quantity), 0);
  document.getElementById('utilidadNeta').textContent = money(ventasUsd - totalCostoNacionalizado);

  let container = CONTAINERS[0];
  if (totalCbm > 15 || totalKg > 10000) container = CONTAINERS.find(c => totalCbm <= c.maxCbm && totalKg <= c.maxKg) || CONTAINERS[3];
  document.getElementById('recommendedContainer').textContent = container.name;
  document.getElementById('totalCbm').textContent = `${totalCbm.toFixed(2)} CBM`;
  document.getElementById('totalKg').textContent = `${(totalKg/1000).toFixed(2)} Ton`;
  document.getElementById('cbmBar').style.width = `${Math.min((totalCbm/container.maxCbm)*100, 100)}%`;
  document.getElementById('kgBar').style.width = `${Math.min((totalKg/container.maxKg)*100, 100)}%`;

  const rows = [
    ['Derechos de Imp. (DI)', money(totalDi)], ['Tasa Estad. (TE)', money(totalTe)],
    ['Impuestos Internos', money(totalImpIntGlobal)], 
    [`IVA ${state.includeRecup?'(Recup.)':''}`, money(totalIva)],
    [`Ganancias ${state.includeRecup?'(Recup.)':''}`, money(totalGan)],
    ['Gastos Locales', money(state.gastosPuerto)]
  ];
  document.getElementById('breakdownBody').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td class="right">${r[1]}</td></tr>`).join('');

  // TABLA UNITARIA ESTRICTA (Construcción paso a paso)
  document.getElementById('skuBody').innerHTML = processed.map(i => {
    let factorClass = i.factorIndividual < 1.4 ? 'factor-green' : i.factorIndividual > 2 ? 'factor-red' : 'factor-yellow';
    
    // División por unidad para mostrar el paso a paso
    const uFlete = i.proratedFreight / i.qty;
    const uSeguro = i.proratedInsurance / i.qty;
    const uCif = i.itemCif / i.qty;
    const uDi = i.itemDi / i.qty;
    const uTe = i.itemTe / i.qty;
    const uPort = i.proratedPort / i.qty;
    const uInt = i.itemImpInt / i.qty;
    
    let intHtml = uInt > 0 ? `<br><span style="color:#ef4444; font-size:0.75rem;">+${money(uInt)} (Int)</span>` : '';
    const costoArs = i.costoUnitarioUsd * state.exchangeRate;

    return `
    <tr>
      <td><strong>${i.sku}</strong> <span class="muted small">x${i.quantity}</span><br><span class="data-sub">${i.cat.name}</span></td>
      <td class="right" style="font-weight:600;">${money(num(i.fobUnit))}</td>
      <td class="right">${money(uFlete)}</td>
      <td class="right">${money(uSeguro)}</td>
      <td class="right" style="color:#3b82f6; font-weight:700;">${money(uCif)}</td>
      <td class="right">${money(uDi)}<br><span class="data-sub">(${i.cat.di}%)</span></td>
      <td class="right">${money(uTe)}<br><span class="data-sub">(${i.cat.te}%)</span>${intHtml}</td>
      <td class="right">${money(uPort)}</td>
      <td class="right" style="font-weight:800;">${fmtUsd(i.costoUnitarioUsd)}</td>
      <td class="right" style="color:var(--mexx-red); font-weight:800; font-size:1.05rem;">${fmtArs(costoArs)}</td>
      <td class="right ${factorClass}">${i.factorIndividual.toFixed(2)}x</td>
    </tr>`;
  }).join('');
}

// Lógica de Parseo TSV (Pegar desde Excel)
document.getElementById('pasteExcel').addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        
        const rows = text.split('\n').map(r => r.split('\t').map(c => c.trim())).filter(r => r.length >= 4);
        if (rows.length === 0) { alert('No se detectaron datos. Copiá las celdas de Excel primero.'); return; }
        
        const newItems = [];
        rows.forEach((cols, i) => {
            if (cols[0].toLowerCase() === 'sku' || isNaN(num(cols[2]))) return;
            
            const catRaw = cols[1] ? cols[1].toLowerCase() : 'electronica';
            const category = CATEGORIES[catRaw] ? catRaw : 'electronica';

            newItems.push({
                id: uid(),
                sku: cols[0] || `SKU-P${i}`,
                category: category,
                quantity: num(cols[2]) || 1,
                fobUnit: num(cols[3]) || 0,
                pcsPerCarton: num(cols[4]) || 1,
                length: num(cols[5]) || 0,
                width: num(cols[6]) || 0,
                height: num(cols[7]) || 0,
                gwPerCarton: num(cols[8]) || 0,
                impInterno: num(cols[9]) || 0
            });
        });

        if(newItems.length > 0) {
            if(confirm(`Se detectaron ${newItems.length} SKUs.\n\n[ACEPTAR] = Borrar lista actual y pegar nuevos.\n[CANCELAR] = Sumarlos a los que ya están.`)) {
                state.items = newItems;
            } else {
                state.items.push(...newItems);
            }
            renderItems();
            calculate();
        }
    } catch (e) { alert('Error al leer el portapapeles. Asegurate de darle permisos al navegador.'); }
});

// JSON Export / Import
document.getElementById('importJsonBtn').addEventListener('click', () => document.getElementById('fileImport').click());
document.getElementById('fileImport').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try { state = JSON.parse(ev.target.result); renderItems(); calculate(); } 
        catch (err) { alert('JSON inválido.'); }
    };
    reader.readAsText(file);
});
function exportJson(){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mexx-import-intelligence.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

// Listeners Base
['freight','insurance','gastosPuerto','exchangeRate','inlandFreight','targetMargin'].forEach(id => document.getElementById(id).addEventListener('input', calculate));
document.getElementById('addItem').addEventListener('click', () => { state.items.push({...state.items[0], id: uid()}); renderItems(); calculate(); });
document.getElementById('btnFOB').addEventListener('click', () => { state.incoterm='FOB'; document.getElementById('inlandWrap').style.display='none'; calculate(); });
document.getElementById('btnEXW').addEventListener('click', () => { state.incoterm='EXW'; document.getElementById('inlandWrap').style.display='block'; calculate(); });
document.getElementById('showUSD').addEventListener('click', () => { state.displayCurrency='USD'; calculate(); });
document.getElementById('showARS').addEventListener('click', () => { state.displayCurrency='ARS'; calculate(); });
document.getElementById('includeRecupBtn').addEventListener('click', () => { state.includeRecup=true; calculate(); });
document.getElementById('excludeRecupBtn').addEventListener('click', () => { state.includeRecup=false; calculate(); });
document.getElementById('exportJson').addEventListener('click', exportJson);
if(document.getElementById('syncTC')) document.getElementById('syncTC').addEventListener('click', syncDolarAPI);

renderItems(); calculate(); syncDolarAPI();