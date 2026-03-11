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
  freight: 1200, insurance: 250, gastosPuerto: 850, exchangeRate: 1000, targetMargin: 35,
  items: [
    { id: uid(), sku: 'TV-55-OLED', category: 'electronica', quantity: 100, fobUnit: 150, pcsPerCarton: 2, length: 130, width: 15, height: 85, gwPerCarton: 25, impInterno: 0 }
  ]
};

function uid(){ return Math.random().toString(36).slice(2, 10); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmtUsd(v){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v); }
function fmtArs(v){ return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v); }
function money(v){ return state.displayCurrency === 'ARS' ? fmtArs(v * state.exchangeRate) : fmtUsd(v); }

// Sincronización con DolarAPI
async function syncDolarAPI() {
    const btn = document.getElementById('syncTC');
    if(btn) btn.textContent = '⏳';
    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        document.getElementById('exchangeRate').value = data.venta;
        state.exchangeRate = data.venta;
        calculate();
    } catch (error) {
        console.error("Error obteniendo TC", error);
    } finally {
        if(btn) btn.textContent = '🔄';
    }
}

// Plantilla HTML para cada SKU
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
            <div>
                <label>Dimensiones L/A/H (cm)</label>
                <div class="dim-grid">
                    <input type="number" step="any" data-field="length" value="${item.length}" placeholder="L">
                    <input type="number" step="any" data-field="width" value="${item.width}" placeholder="A">
                    <input type="number" step="any" data-field="height" value="${item.height}" placeholder="H">
                </div>
            </div>
            <div><label>% Imp. Interno</label><input type="number" step="any" data-field="impInterno" value="${item.impInterno || 0}"></div>
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
        state.items.find(x => x.id === id)[field] = e.target.tagName === 'SELECT' || field === 'sku' ? e.target.value : num(e.target.value);
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

  let totalCbm = 0, totalKg = 0, totalCartons = 0;
  const totalGoodsValue = state.items.reduce((a,i)=>a + num(i.quantity)*num(i.fobUnit),0);
  const totalFobAduanero = totalGoodsValue + (state.incoterm === 'EXW' ? state.inlandFreight : 0);
  const totalQuantity = state.items.reduce((a,i)=>a + num(i.quantity),0);
  const totalCifBase = totalFobAduanero + state.freight + state.insurance;

  let totalDi=0, totalTe=0, totalIva=0, totalGan=0, totalImpIntGlobal=0, totalCostoNacionalizado=0;
  
  const processed = state.items.map(item => {
    const qty = num(item.quantity), unitPrice = num(item.fobUnit), itemGoodsValue = qty * unitPrice;
    const pcs = num(item.pcsPerCarton) || 1;
    const cartons = Math.ceil(qty / pcs);
    const itemCbm = cartons * ((num(item.length) * num(item.width) * num(item.height)) / 1000000);
    const itemKg = cartons * num(item.gwPerCarton);
    totalCbm += itemCbm; totalKg += itemKg; totalCartons += cartons;

    const weight = totalGoodsValue > 0 ? itemGoodsValue / totalGoodsValue : 0;
    const proratedFreight = state.freight * weight;
    const proratedInsurance = state.insurance * weight;
    const itemCif = (itemGoodsValue + ((state.incoterm === 'EXW' ? state.inlandFreight : 0) * weight)) + proratedFreight + proratedInsurance;
    
    const cat = CATEGORIES[item.category] || CATEGORIES.electronica;
    const itemDi = itemCif * (cat.di/100); 
    const itemTe = itemCif * (cat.te/100);
    const baseIva = itemCif + itemDi + itemTe;
    const itemIva = baseIva * (cat.iva/100); 
    const itemGan = baseIva * (cat.gan/100);
    const itemImpInt = baseIva * ((num(item.impInterno)||0)/100);
    
    const impRecuperables = itemIva + itemGan; 
    const impNoRecuperables = itemDi + itemTe + itemImpInt;
    const costoItemTotal = itemCif + impNoRecuperables + (state.gastosPuerto * weight) + (state.includeRecup ? impRecuperables : 0);
    
    const costoUnitarioUsd = qty > 0 ? costoItemTotal / qty : 0;
    const factorIndividual = unitPrice > 0 ? costoUnitarioUsd / unitPrice : 0;
    
    totalDi += itemDi; totalTe += itemTe; totalIva += itemIva; totalGan += itemGan; totalImpIntGlobal += itemImpInt; totalCostoNacionalizado += costoItemTotal;

    return { ...item, cat, itemCbm, itemKg, itemCif, costoUnitarioUsd, factorIndividual, itemDi, itemTe, itemImpInt, proratedFreight, proratedInsurance };
  });

  const factorGlobal = totalGoodsValue > 0 ? totalCostoNacionalizado / totalGoodsValue : 0;
  const costoUnitarioPromedioUsd = totalQuantity > 0 ? totalCostoNacionalizado / totalQuantity : 0;
  
  const margenMultiplier = 1 / (1 - state.targetMargin / 100 || 1);
  const ventasTotalesUsd = processed.reduce((a,i)=>a + (i.costoUnitarioUsd * margenMultiplier) * num(i.quantity), 0);
  const utilidadNetaUsd = ventasTotalesUsd - totalCostoNacionalizado;

  let recommendedContainer = CONTAINERS[0];
  if (totalCbm > 0 || totalKg > 0) {
    let cbmC = totalCbm <= 15 ? CONTAINERS[0] : totalCbm <= 28 ? CONTAINERS[1] : totalCbm <= 58 ? CONTAINERS[2] : CONTAINERS[3];
    let kgC = totalKg <= 10000 ? CONTAINERS[0] : totalKg <= 28000 ? CONTAINERS[1] : totalKg <= 28800 ? CONTAINERS[2] : CONTAINERS[3];
    recommendedContainer = cbmC.maxCbm > kgC.maxCbm ? cbmC : kgC;
  }
  let utilCbm = recommendedContainer.maxCbm ? (totalCbm / recommendedContainer.maxCbm) * 100 : 0;
  let utilKg = recommendedContainer.maxKg ? (totalKg / recommendedContainer.maxKg) * 100 : 0;

  // Actualización DOM
  document.getElementById('goodsTitle').textContent = `Total ${state.incoterm}`;
  document.getElementById('totalGoodsValue').textContent = money(totalGoodsValue);
  document.getElementById('totalCostoNacionalizado').textContent = money(totalCostoNacionalizado);
  document.getElementById('factorGlobal').textContent = `Factor global: ${factorGlobal.toFixed(2)}x`;
  document.getElementById('avgUnitCost').textContent = money(costoUnitarioPromedioUsd);
  document.getElementById('tcSub').textContent = `TC: ${state.exchangeRate} ARS`;
  document.getElementById('utilidadNeta').textContent = money(utilidadNetaUsd);

  document.getElementById('totalCbm').textContent = `${totalCbm.toFixed(2)} CBM`;
  document.getElementById('totalKg').textContent = `${(totalKg/1000).toFixed(2)} Ton`;
  document.getElementById('recommendedContainer').textContent = recommendedContainer.name;
  document.getElementById('cbmBar').style.width = `${Math.min(utilCbm,100)}%`;
  document.getElementById('kgBar').style.width = `${Math.min(utilKg,100)}%`;

  const breakdown = [
    ['Derechos de importación (DI)', money(totalDi)],
    ['Tasa estadística (TE)', money(totalTe)],
    ['Impuestos Internos', money(totalImpIntGlobal)],
    [`IVA general ${state.includeRecup ? '(incluido)' : '(excluido)'}`, money(totalIva)],
    [`Percepción Ganancias ${state.includeRecup ? '(incluido)' : '(excluido)'}`, money(totalGan)],
    ['Gastos de puerto y despacho', money(state.gastosPuerto)],
    ['Subtotal nacionalización', `<strong>${money(totalCostoNacionalizado)}</strong>`]
  ];
  if (state.incoterm === 'EXW') breakdown.unshift(['Flete interno origen', money(state.inlandFreight)]);
  document.getElementById('breakdownBody').innerHTML = breakdown.map(r => `<tr><td>${r[0]}</td><td class="right">${r[1]}</td></tr>`).join('');

  // Tabla Final SKU
  document.getElementById('skuBody').innerHTML = processed.map(i => {
    let factorClass = i.factorIndividual < 1.4 ? 'factor-green' : i.factorIndividual > 2 ? 'factor-red' : 'factor-yellow';
    const costoArs = i.costoUnitarioUsd * state.exchangeRate;

    return `<tr>
      <td><strong>${i.sku}</strong> <span class="muted small">x${i.quantity}</span><br><span class="data-sub">${i.cat.name}</span></td>
      <td class="right">${money(num(i.fobUnit))}</td>
      <td class="right">${money(i.proratedFreight)}<br><span class="data-sub">+ ${money(i.proratedInsurance)} (Seg)</span></td>
      <td class="right">${money(i.itemDi)} (DI)<br><span class="data-sub">${money(i.itemTe)} (TE) / ${money(i.itemImpInt)} (Int)</span></td>
      <td class="right"><strong>${money(i.itemCif)}</strong></td>
      <td class="right" style="font-weight:800; font-size: 1rem;">
          ${fmtUsd(i.costoUnitarioUsd)}<br>
          <span style="font-size: 0.8rem; color: var(--mexx-red);">${fmtArs(costoArs)}</span>
      </td>
      <td class="right ${factorClass}">${i.factorIndividual.toFixed(2)}x</td>
    </tr>`;
  }).join('');
}

// Controladores UI
function setIncoterm(v){
    state.incoterm = v; document.getElementById('btnFOB').classList.toggle('active', v==='FOB'); document.getElementById('btnEXW').classList.toggle('active', v==='EXW');
    document.getElementById('inlandWrap').style.display = v === 'EXW' ? 'block' : 'none'; calculate();
}
function setCurrency(v){ state.displayCurrency = v; document.getElementById('showUSD').classList.toggle('active', v==='USD'); document.getElementById('showARS').classList.toggle('active', v==='ARS'); calculate(); }
function setRecup(v){ state.includeRecup = v; document.getElementById('includeRecupBtn').classList.toggle('active', v===true); document.getElementById('excludeRecupBtn').classList.toggle('active', v===false); calculate(); }

function saveScenario(){
    const name = document.getElementById('scenarioName').value.trim();
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('importar_scenarios') || '{}');
    saved[name] = JSON.parse(JSON.stringify(state));
    localStorage.setItem('importar_scenarios', JSON.stringify(saved));
    refreshScenarioList();
}

function loadScenario(name){
    const saved = JSON.parse(localStorage.getItem('importar_scenarios') || '{}');
    if (!saved[name]) return;
    state = saved[name];
    document.getElementById('scenarioName').value = name;
    document.getElementById('freight').value = state.freight;
    document.getElementById('insurance').value = state.insurance;
    document.getElementById('gastosPuerto').value = state.gastosPuerto;
    document.getElementById('exchangeRate').value = state.exchangeRate;
    document.getElementById('inlandFreight').value = state.inlandFreight || 0;
    document.getElementById('targetMargin').value = state.targetMargin;
    setIncoterm(state.incoterm);
    setCurrency(state.displayCurrency);
    setRecup(state.includeRecup);
    renderItems();
    calculate();
}

function refreshScenarioList(){
    const sel = document.getElementById('scenarioList');
    const saved = JSON.parse(localStorage.getItem('importar_scenarios') || '{}');
    sel.innerHTML = '<option value="">Cargar guardado…</option>' + Object.keys(saved).map(k => `<option value="${k}">${k}</option>`).join('');
}

function exportJson(){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'import-intelligence-state.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

// Listeners
document.getElementById('addItem').addEventListener('click', ()=>{ state.items.push({ id: uid(), sku: `SKU-${state.items.length+1}`, category:'electronica', quantity:10, fobUnit:100, pcsPerCarton:1, length:50, width:50, height:50, gwPerCarton:10, impInterno: 0 }); renderItems(); calculate(); });
['freight','insurance','gastosPuerto','exchangeRate','inlandFreight','targetMargin'].forEach(id => document.getElementById(id).addEventListener('input', calculate));
if(document.getElementById('syncTC')) document.getElementById('syncTC').addEventListener('click', syncDolarAPI);
document.getElementById('btnFOB').addEventListener('click', ()=>setIncoterm('FOB')); document.getElementById('btnEXW').addEventListener('click', ()=>setIncoterm('EXW'));
document.getElementById('showUSD').addEventListener('click', ()=>setCurrency('USD')); document.getElementById('showARS').addEventListener('click', ()=>setCurrency('ARS'));
document.getElementById('includeRecupBtn').addEventListener('click', ()=>setRecup(true)); document.getElementById('excludeRecupBtn').addEventListener('click', ()=>setRecup(false));
document.getElementById('saveScenario').addEventListener('click', saveScenario);
document.getElementById('scenarioList').addEventListener('change', e => e.target.value && loadScenario(e.target.value));
document.getElementById('exportJson').addEventListener('click', exportJson);

// Funcionalidad Importar JSON
document.getElementById('importJsonBtn').addEventListener('click', () => document.getElementById('fileImport').click());
document.getElementById('fileImport').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            state = JSON.parse(ev.target.result);
            document.getElementById('freight').value = state.freight;
            document.getElementById('insurance').value = state.insurance;
            document.getElementById('gastosPuerto').value = state.gastosPuerto;
            document.getElementById('exchangeRate').value = state.exchangeRate;
            document.getElementById('targetMargin').value = state.targetMargin;
            renderItems();
            calculate();
        } catch (err) { alert('El archivo JSON no es válido o está corrupto.'); }
    };
    reader.readAsText(file);
});

refreshScenarioList();
renderItems();
calculate();
syncDolarAPI();