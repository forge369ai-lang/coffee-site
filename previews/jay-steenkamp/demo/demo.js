/* Shared layer for Jay Steenkamp concept demos: honest label, back link, and demo-safe buttons. */
(function(){
  if(window.top!==window.self){document.documentElement.classList.add('in-frame');}
  const css=`.jsd-pill{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;align-items:center;
  background:#111;color:#fff;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;padding:8px 8px 8px 14px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.3);white-space:nowrap;max-width:calc(100vw - 24px)}
  .jsd-pill span{opacity:.8;overflow:hidden;text-overflow:ellipsis}.jsd-pill a{background:#F0561D;color:#fff;text-decoration:none;border-radius:999px;padding:7px 12px;flex:none}
  .jsd-toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%) translateY(10px);opacity:0;z-index:9999;background:#fff;color:#111;font:500 14px/1.4 system-ui,sans-serif;
  padding:12px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:.25s;max-width:min(92vw,420px);text-align:center;pointer-events:none}
  .jsd-toast.on{opacity:1;transform:translateX(-50%)}html.in-frame .jsd-pill,html.in-frame .jsd-toast{display:none}`;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  const pill=document.createElement('div');pill.className='jsd-pill';
  pill.innerHTML='<span>Concept design · fictional business</span><a href="/work">By Jay Steenkamp →</a>';
  const toast=document.createElement('div');toast.className='jsd-toast';toast.setAttribute('role','status');
  document.addEventListener('DOMContentLoaded',()=>{document.body.append(pill,toast)});
  let tm;window.demoToast=t=>{toast.textContent=t;toast.classList.add('on');clearTimeout(tm);tm=setTimeout(()=>toast.classList.remove('on'),2600)};
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="https://wa.me"],a[href^="tel:"],a[href^="mailto:"],[data-demo]');
    if(!a||a.closest('.jsd-pill'))return;e.preventDefault();
    demoToast(a.dataset.demo||'On the real site, this opens '+(a.href.startsWith('tel:')?'a phone call':a.href.startsWith('mailto:')?'an email':'WhatsApp with a ready-made message')+'.')},true);
})();
