// transaction-modal.js — Modal logic for Budgetin
(function(){
  var TYPES = ['expense','income','transfer'];
  var LABELS = {expense:'Pengeluaran',income:'Pemasukan',transfer:'Transfer'};
  var COLORS = {expense:'red',income:'green',transfer:'blue'};
  var modal = document.querySelector('.modal-overlay');
  var title = document.querySelector('.modal-title');
  var tabs = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.tab-panel');
  var closeBtn = document.querySelector('.btn-close');
  var currentType = 'expense';
  var editMode = false;

  // ── Helpers ──
  function formatRp(n){ return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
  function parseAmount(s){ return parseInt((s||'').replace(/\D/g,''),10) || 0; }
  function today(){ return new Date().toISOString().slice(0,10); }
  function getPanel(type){ return document.getElementById('panel-'+type); }

  // ── 1. Tab switching ──
  tabs.forEach(function(tab,i){
    tab.addEventListener('click',function(){
      currentType = TYPES[i];
      tabs.forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      panels.forEach(function(p){ p.classList.remove('active'); });
      getPanel(currentType).classList.add('active');
      if(!editMode) resetForm(currentType);
    });
  });

  // ── 2. Format angka ──
  document.querySelectorAll('.amount-input').forEach(function(input){
    input.addEventListener('input',function(){
      var raw = parseAmount(this.value);
      if(raw > 0){ this.value = formatRp(raw); } else { this.value = ''; }
    });
    input.addEventListener('focus',function(){ if(!this.value) this.placeholder = 'Rp 0'; });
  });

  // ── 3. Validasi ──
  function validate(type){
    var panel = getPanel(type);
    var amount = parseAmount(panel.querySelector('.amount-input').value);
    if(amount <= 0){ shake(panel.querySelector('.amount-input')); return null; }
    var selects = panel.querySelectorAll('select');
    var data = { type:type, amount:amount, date:panel.querySelector('input[type="date"]').value||today(),
      note:panel.querySelector('input[placeholder="Opsional"]')?.value||'' };
    if(type==='expense'){
      data.category = selects[0].value; data.fromAccount = selects[1].value;
    } else if(type==='income'){
      data.source = selects[0].value; data.toAccount = selects[1].value;
    } else {
      data.fromAccount = selects[0].value; data.toAccount = selects[1].value;
      if(data.fromAccount === data.toAccount){ shake(selects[1]); return null; }
    }
    // Recurring
    var sw = panel.querySelector('.switch');
    data.recurring = { enabled:false, frequency:null, until:null };
    if(sw && sw.classList.contains('on')){
      var rSelects = panel.querySelector('.recurring-fields').querySelectorAll('select');
      data.recurring = { enabled:true, frequency:rSelects[0].value, until:rSelects[1].value };
    }
    return data;
  }
  function shake(el){ el.style.animation='shake .3s'; setTimeout(function(){el.style.animation='';},350); }

  // ── 4. Recurring toggle ──
  document.querySelectorAll('.switch').forEach(function(sw){
    sw.addEventListener('click',function(){
      var on = !this.classList.contains('on');
      this.classList.toggle('on',on);
      this.setAttribute('aria-checked',on);
      var fields = this.closest('.tab-panel').querySelector('.recurring-fields');
      if(fields){
        fields.style.display = on ? 'flex' : 'none';
        if(on) fields.style.animation = 'slideDown .2s ease';
      }
    });
  });

  // ── 5. Edit mode ──
  window.openEditMode = function(txData){
    editMode = true;
    openModal();
    // Switch to correct tab
    var idx = TYPES.indexOf(txData.type); if(idx<0) idx=0;
    tabs[idx].click();
    title.textContent = 'Edit Transaksi';
    var panel = getPanel(txData.type);
    // Fill amount
    panel.querySelector('.amount-input').value = formatRp(txData.amount);
    // Fill selects
    var selects = panel.querySelectorAll('select');
    if(txData.type==='expense'){ selects[0].value=txData.category||selects[0].value; selects[1].value=txData.fromAccount||selects[1].value; }
    else if(txData.type==='income'){ selects[0].value=txData.source||selects[0].value; selects[1].value=txData.toAccount||selects[1].value; }
    else { selects[0].value=txData.fromAccount||selects[0].value; selects[1].value=txData.toAccount||selects[1].value; }
    // Fill date & note
    var dateInput = panel.querySelector('input[type="date"]');
    if(txData.date) dateInput.value = txData.date;
    var noteInput = panel.querySelector('input[placeholder="Opsional"]');
    if(txData.note) noteInput.value = txData.note;
    // Recurring
    if(txData.recurring && txData.recurring.enabled){
      var sw = panel.querySelector('.switch');
      if(sw && !sw.classList.contains('on')) sw.click();
      var rSelects = panel.querySelector('.recurring-fields').querySelectorAll('select');
      rSelects[0].value = txData.recurring.frequency;
      rSelects[1].value = txData.recurring.until;
    }
    // Change button text
    var btn = panel.querySelector('.btn-submit');
    btn.textContent = 'Update ' + LABELS[txData.type];
    btn.dataset.editId = txData.id || '';
  };

  window.openCreateMode = function(){
    editMode = false;
    title.textContent = 'Transaksi Baru';
    panels.forEach(function(p){
      var btn = p.querySelector('.btn-submit');
      var type = p.id.replace('panel-','');
      btn.textContent = 'Simpan ' + LABELS[type];
      delete btn.dataset.editId;
    });
    resetForm(currentType);
    openModal();
  };

  function resetForm(type){
    var panel = getPanel(type);
    panel.querySelector('.amount-input').value = '';
    panel.querySelectorAll('select').forEach(function(s){ s.selectedIndex=0; });
    var dateInput = panel.querySelector('input[type="date"]'); if(dateInput) dateInput.value = today();
    var noteInput = panel.querySelector('input[placeholder="Opsional"]'); if(noteInput) noteInput.value = '';
    var sw = panel.querySelector('.switch');
    if(sw && sw.classList.contains('on')) sw.click();
  }

  // ── 6. Submit ──
  document.querySelectorAll('.btn-submit').forEach(function(btn){
    btn.addEventListener('click',function(){
      var type = this.closest('.tab-panel').id.replace('panel-','');
      var data = validate(type);
      if(!data) return;
      data.editId = this.dataset.editId || null;
      document.dispatchEvent(new CustomEvent('transaction-saved',{detail:data}));
      closeModal();
    });
  });

  // ── Modal open/close ──
  function openModal(){ modal.style.display='flex'; }
  function closeModal(){ modal.style.display='flex'; editMode=false; /* keep visible for demo */ }
  closeBtn.addEventListener('click',function(){ modal.style.display='none'; editMode=false; });
  modal.addEventListener('click',function(e){ if(e.target===modal){ modal.style.display='none'; editMode=false; }});

  // Inject shake keyframe
  var style = document.createElement('style');
  style.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}';
  document.head.appendChild(style);

  // Listen for saved events (debug)
  document.addEventListener('transaction-saved',function(e){ console.log('Transaction saved:',e.detail); });
})();
