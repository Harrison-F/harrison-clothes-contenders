/* Local per-topic manual order. No server writes or cross-device sync. */
var CatalogOrder = (() => {
 'use strict';
 const snapshots=new WeakMap();
 function reconcile(saved, ids) {const valid=new Set(ids);return [...new Set([...(Array.isArray(saved)?saved:[]).filter(id=>valid.has(id)),...ids])];}
 function mergeVisible(base, visible) {const set=new Set(visible);let i=0;return base.map(id=>set.has(id)?visible[i++]:id);}
 function attach(topic, grid, applySort) {
  const key='research-catalog-order:v1:'+topic.id;
  const nodes=new Map([...grid.children].map(el=>[topic.products[Number(el.dataset.productIndex)].id,el]));
  const ids=[...nodes.keys()];let saved=null,before=[],suppressUntil=0;
  try {saved=JSON.parse(localStorage.getItem(key));} catch (_) {}
  let manual=Array.isArray(saved)&&(topic.defaultSort!=='curated'||saved.some(id=>nodes.has(id)))?reconcile(saved,ids):null;
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');grid.before(status);
  const bar=document.querySelector('.research-sort');
  const manualButton=document.createElement('button');manualButton.type='button';manualButton.dataset.sort='manual';manualButton.textContent='My order';manualButton.title='Saved in this browser only';manualButton.setAttribute('aria-pressed','false');
  const reset=document.createElement('button');reset.type='button';reset.className='order-reset';reset.textContent='Reset order';reset.title=topic.defaultSort==='curated'?'Clear this browser’s saved order and restore shared Checkpoint 1 default order':'Clear this browser’s saved order and restore the default';bar.append(manualButton,reset);
  function ordered(){return [...grid.children].filter(el=>el.dataset.productId).map(el=>el.dataset.productId);}
  function setPressed(){bar.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b===manualButton)));}
  function arrange(order){order.forEach(id=>grid.append(nodes.get(id)));updateHandles();}
  function updateHandles(){const visible=[...grid.children].filter(c=>!c.hidden&&c.dataset.productId);visible.forEach((el,i)=>{const h=el.querySelector('.reorder-handle');h.setAttribute('aria-label',`Reorder ${topic.products[Number(el.dataset.productIndex)].name}, position ${i+1} of ${visible.length}. Hold and drag, or use Up and Down arrow keys.`);});}
  function save(order){manual=reconcile(order,ids);arrange(manual);setPressed();try {localStorage.setItem(key,JSON.stringify(manual));status.textContent='Order saved in this browser.';} catch(_){status.textContent='Order changed. Browser storage unavailable; this order will not survive reload.';manualButton.title='Browser storage unavailable — session only';}}
  nodes.forEach((el,id)=>{
   el.dataset.productId=id;
   const h=document.createElement('button');h.type='button';h.className='reorder-handle';h.textContent='⠿';h.title='Hold to drag · ↑/↓ to move';el.prepend(h);
   h.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const base=ordered(),visible=base.filter(x=>!nodes.get(x).hidden),from=visible.indexOf(id);const to=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,from+(event.key==='ArrowUp'?-1:1)));visible.splice(from,1);visible.splice(to,0,id);save(mergeVisible(base,visible));h.focus();});
  });
  manualButton.addEventListener('click',()=>{if(manual){arrange(manual);setPressed();}else save(ordered());});
  reset.addEventListener('click',()=>{manual=null;try {localStorage.removeItem(key);}catch(_){}applySort(['merchant','curated'].includes(topic.defaultSort)?topic.defaultSort:'price');manualButton.setAttribute('aria-pressed','false');updateHandles();status.textContent='Default order restored.';});
  grid.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}},true);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const sortable=new Sortable(grid,{draggable:'.display-card:not([hidden])',handle:'.reorder-handle',delay:220,delayOnTouchOnly:false,touchStartThreshold:5,forceFallback:true,fallbackOnBody:true,fallbackTolerance:4,animation:motion.matches?0:160,ghostClass:'order-ghost',chosenClass:'order-chosen',dragClass:'order-drag',scroll:true,scrollSensitivity:70,scrollSpeed:8,
   onChoose(){before=ordered();},onStart(){document.body.classList.add('catalog-dragging');},
   onEnd(event){document.body.classList.remove('catalog-dragging');suppressUntil=Date.now()+350;const visible=ordered().filter(id=>!nodes.get(id).hidden);save(mergeVisible(before,visible));event.item.querySelector('.reorder-handle').focus({preventScroll:true});}
  });
  motion.addEventListener('change',()=>sortable.option('animation',motion.matches?0:160));
  new MutationObserver(updateHandles).observe(grid,{subtree:true,attributes:true,attributeFilter:['hidden']});
  if(manual){arrange(manual);setPressed();}else updateHandles();
  snapshots.set(grid,()=>({fullOrderProductIds:[...(manual||ordered())],hasManualOrder:manual!==null}));
  return {clearPressed(){manualButton.setAttribute('aria-pressed','false');updateHandles();}};
 }
 return {reconcile,mergeVisible,attach,snapshot(grid){return snapshots.get(grid)?.();}};
})();
