"use strict";
const content = document.querySelector('#content');
const dialog = document.querySelector('dialog');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => {const u=new URL(value,location.href); if (!['https:','http:'].includes(u.protocol)) throw Error('Invalid source URL'); return esc(u.href);};
const imageURL = value => {if (!/^assets\/images\/[a-z0-9-]+\.(webp|png|jpg)$/.test(value)) throw Error('Invalid local image'); return esc(value);};
async function load(path) {const response=await fetch(path); if(!response.ok) throw Error(`Could not load research (HTTP ${response.status}).`); return response.json();}
const intro = (title,summary,updated='',compact=false) => `<header class="intro"><h1>${esc(title)}</h1>${compact && !summary?.trim() ? '' : `<p>${esc(summary)}</p>`}${updated ? `<p class="research-updated">Sources checked ${esc(updated)}</p>`:''}</header>`;
const search = label => `<label class="search-field research-search"><span class="sr-only">${esc(label)}</span><input type="search" placeholder="${esc(label)}" aria-label="${esc(label)}"></label>`;
function attachSearch() {
 let category='All';const input=document.querySelector('input[type=search]');
 function apply(){const term=input.value.trim().toLowerCase();let shown=0;
 document.querySelectorAll('[data-search]').forEach(card=>{card.hidden=!card.dataset.search.includes(term)||(category!=='All'&&card.dataset.category!==category)||(card.dataset.removed!==undefined&&card.dataset.removed!==(card.parentElement.dataset.removedView||'false'));if(!card.hidden)shown++;});
 document.querySelector('#no-results').hidden=shown>0;
 const count=document.querySelector('#catalog-count');if(count)count.textContent=`${shown}${document.querySelector('.display-template')?.dataset.removedView==='true'?' removed':''} item${shown===1?'':'s'}`;
 }
 input.addEventListener('input',apply);
 document.querySelectorAll('[data-category-filter]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.categoryFilter;document.querySelectorAll('[data-category-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));apply();}));apply();return apply;
}
function catalogMeta(p){
 const item=p.name.split(' · ').slice(1).join(' · ')||p.name;
 const store=p.store||p.brand;
 const lining=p.materialCaveat||(p.category==='Jacket'?p.summary:'Trims not fully specified.');
 return `<div class="card-head"><div class="identity"><h2><a class="product-title-link" href="${safeURL(p.url)}" target="_blank" rel="noopener noreferrer">${esc(item)}</a></h2></div></div><p class="catalog-store" data-field="store">${esc(store)}</p><p class="catalog-price" data-field="price">${p.unitPriceUSD==null?'Price unknown':esc(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(p.unitPriceUSD))}</p><p class="catalog-material" data-field="material">${esc(p.facts.Fabric)}${lining?` · ${esc(lining)}`:''}</p>${p.deal?`<p class="catalog-deal" data-field="deals">${esc(p.deal)}</p>`:''}`;
}
function openImage(product) {document.querySelector('#image-title').textContent=product.name;dialog.querySelector('img').src=product.image;dialog.querySelector('img').alt=product.imageAlt;document.querySelector('#image-caption').textContent=product.imageNote;dialog.showModal();}
dialog.querySelector('button').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
const photos = p => p.images?.length ? p.images : [{src:p.image,alt:p.imageAlt}];
const productURL = (p,topic) => safeURL(p.url || topic.sources.find(s=>s.id===p.sources[0]).url);
function gallery(p,topic) {
 if(p.images && !p.images.length && !p.image) return `<section class="product-gallery" aria-label="${esc(p.name)} image unavailable"><a class="portrait-wrap product-photo-link" href="${productURL(p,topic)}" target="_blank" rel="noopener noreferrer"><span class="catalog-material missing-product-image">Retailer image unavailable<br>Open selected listing →</span></a><div class="gallery-controls"><span class="gallery-count">Gallery unavailable</span></div></section>`;
 const images=photos(p);
 return `<section class="product-gallery" data-gallery="${esc(p.id)}" aria-label="${esc(p.name)} photos" aria-roledescription="carousel"><a class="portrait-wrap product-photo-link" href="${productURL(p,topic)}" target="_blank" rel="noopener noreferrer" aria-label="Shop ${esc(p.name)}"><img class="portrait" src="${imageURL(images[0].src)}" alt="${esc(images[0].alt)}"></a><div class="gallery-controls">${images.length>1?`<button class="gallery-arrow" data-step="-1" aria-label="Previous photo of ${esc(p.name)}">←</button><span class="gallery-count" aria-live="polite">1 / ${images.length}</span><button class="gallery-arrow" data-step="1" aria-label="Next photo of ${esc(p.name)}">→</button>`:'<span class="gallery-count">1 photo</span>'}<button class="gallery-expand" data-image="${esc(p.id)}" aria-label="Expand ${esc(p.name)} image">Expand</button></div></section>`;
}
function attachGalleries(topic) {
 document.querySelectorAll('[data-gallery]').forEach(el=>{
  const p=topic.products.find(p=>p.id===el.dataset.gallery), images=photos(p);let index=0,start=null,suppressClick=false;
  function move(step){index=(index+step+images.length)%images.length;const im=el.querySelector('img');im.src=images[index].src;im.alt=images[index].alt;const count=el.querySelector('.gallery-count');count.textContent=`${index+1} / ${images.length}`;}
  el.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>move(Number(b.dataset.step))));
  el.addEventListener('keydown',e=>{if(images.length>1&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
  const link=el.querySelector('.product-photo-link');
  link.addEventListener('touchstart',e=>{start={x:e.touches[0].clientX,y:e.touches[0].clientY};suppressClick=false;},{passive:true});
  link.addEventListener('touchend',e=>{if(!start||images.length<2)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){if(e.cancelable)e.preventDefault();suppressClick=true;move(dx<0?1:-1);}start=null;},{passive:false});
  link.addEventListener('click',e=>{if(suppressClick){e.preventDefault();suppressClick=false;}});
  el.querySelector('[data-image]').addEventListener('click',()=>openImage({...p,image:images[index].src,imageAlt:images[index].alt}));
 });
}
function attachNaturalSort(topic) {
 const grid=content.querySelector('.display-template');
 const cards=new Map([...grid.children].map(card=>[topic.products[Number(card.dataset.productIndex)],card]));
 const buttons=content.querySelectorAll('[data-sort]');let ordering=null;
 function apply(mode) {
  ordering?.clearPressed();
  // Move existing nodes so search, gallery position and disclosures survive.
  (mode==='merchant' ? topic.products : sortNaturalProducts(topic.products,mode)).forEach(p=>grid.append(cards.get(p)));
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sort===mode)));
 }
 buttons.forEach(button=>button.addEventListener('click',()=>apply(button.dataset.sort)));
 apply(topic.defaultSort==='merchant' ? 'merchant' : 'price');
 if(document.body.classList.contains('clothing-catalog')) ordering=CatalogOrder.attach(topic,grid,apply);
}
async function render() {
 const library=await load('data/library.json'); const id=new URLSearchParams(location.search).get('topic');
 if(!id) {document.title='Research library';content.innerHTML=intro('Research library','Decisions, comparisons and the evidence behind them.')+search('Search topics')+`<section class="display-template" aria-label="Research topics">${library.topics.map(t=>`<article class="display-card" data-search="${esc((t.title+' '+t.summary).toLowerCase())}"><a class="portrait-wrap" href="?topic=${encodeURIComponent(t.id)}" aria-label="Open ${esc(t.title)}"><img class="portrait" src="${imageURL(t.image)}" alt="${esc(t.imageAlt)}"></a><div class="card-body"><div class="card-head"><div class="identity"><h2>${esc(t.title)}</h2></div></div><p class="bio">${esc(t.summary)}</p><div class="card-foot"><a class="secondary-button" href="?topic=${encodeURIComponent(t.id)}">View research →</a></div></div></article>`).join('')}</section><p id="no-results" class="empty" hidden>No matching topics.</p>`;attachSearch();return;}
 if(!library.topics.some(t=>t.id===id)||! /^[a-z0-9-]+$/.test(id)) throw Error('Topic not found. Choose a topic from the library.');
 const topic=await load(`data/topics/${id}.json`);document.title=topic.id==='harrison-clothes-contenders'?"Harrison's Clothes Contenders":topic.title+' · Research library';document.querySelector('#home-link').hidden=false;
 const compact=topic.layout==='natural-basics';
 content.classList.toggle('natural-basics',compact);
 const catalog=topic.id==='mens-natural-wardrobe'||topic.catalog===true;document.body.classList.toggle('clothing-catalog',catalog);
 const recommendation=topic.recommendation || {};
 const showRecommendation=!compact || Object.values(recommendation).some(v=>typeof v==='string' && v.trim());
 content.innerHTML=intro(topic.title,catalog?'':topic.summary,catalog?'':topic.updated,compact)+(showRecommendation ? `<section class="research-recommendation"><h2>${esc(recommendation.title || "")}</h2><p>${esc(recommendation.text || "")}</p><p>${esc(recommendation.test || "")}</p></section>` : '')+(catalog?`<div class="catalog-categories" role="group" aria-label="Clothing type">${[['All','All'],...([...new Set(topic.products.map(p=>p.category).filter(Boolean))].sort().map(c=>[c,({Shirt:'Shirts',Sweater:'Sweaters',Jacket:'Jackets'})[c]||c]))].map(([value,label])=>`<button type="button" data-category-filter="${value}" aria-pressed="${value==='All'}">${label}</button>`).join('')}<span id="catalog-count"></span></div>`:'')+search('Search products and criteria')+(compact ? `<div class="research-sort" role="group" aria-label="Sort products">${topic.defaultSort==='merchant'?'<button type="button" data-sort="merchant" aria-pressed="true">Merchant order</button>':''}<button type="button" data-sort="price" aria-pressed="${topic.defaultSort!=='merchant'}">Price</button><button type="button" data-sort="integrity" aria-pressed="false">Material integrity</button><span>Unit prices · pre-shipping</span></div>` : '')+`<section class="display-template" aria-label="Product comparison">${topic.products.map((p,index)=>`<article class="display-card" data-product-index="${index}" data-category="${esc(p.category||'')}" data-search="${esc([p.name,p.verdict,p.summary,...Object.values(p.facts)].join(' ').toLowerCase())}">${gallery(p,topic)}<div class="card-body">${catalog?catalogMeta(p):`<div class="card-head"><div class="identity"><h2><a class="product-title-link" href="${productURL(p,topic)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a></h2></div></div><p class="research-verdict">${esc(p.verdict)}</p>${compact && !p.summary?.trim() ? "" : `<p class="bio">${esc(p.summary)}</p>`}<dl class="research-facts">${Object.entries(p.facts).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`}<details class="research-details"><summary>Sources & evidence</summary>${catalog?`<p>${esc(p.facts.Fit)} · ${esc(p.facts.Status)}</p><p>${esc(p.attribution||'Outside-network comparator; first-party product verification, not influencer endorsement.')}</p>`:''}${p.sources.map(id=>{const s=topic.sources.find(s=>s.id===id);return `<a href="${safeURL(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.type)} · ${esc(s.note)}</p>`;}).join('')}<p>Image: ${esc(p.imageNote)}</p></details></div></article>`).join('')}</section><p id="no-results" class="empty" hidden>No matching products.</p>${topic.showCollectionNotes===false?'':`<section class="research-notes"><h2>What the evidence does—and doesn’t—say</h2><p>${esc(topic.evidenceNote)}</p><p>${esc(topic.caveat)}</p>${catalog?`<details class="research-details"><summary>Research coverage & source classification</summary><p>${esc(topic.summary)}</p><p>Sources checked ${esc(topic.updated)}</p>${topic.sources.filter(s=>s.id.startsWith('expansion-')).map(s=>`<a href="${safeURL(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><p>${esc(s.type)} · ${esc(s.note)}</p>`).join('')}</details>`:''}</section>`}` + (topic.products.length ? "" : `<details class="research-details"><summary>Screened products & exclusion reasons</summary>${topic.sources.map(s=>`<a href="${safeURL(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.type)} · ${esc(s.note)}</p>`).join("")}</details>`);
 const applySearch=attachSearch();attachGalleries(topic);
 if(compact) attachNaturalSort(topic);
 if(catalog) CatalogRemoval.attach(topic,applySearch);
}
render().catch(error=>{content.innerHTML=`<section class="research-error"><h1>Research unavailable</h1><p>${esc(error.message)}</p><a class="secondary-button" href="./">Back to library</a></section>`;});
