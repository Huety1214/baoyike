'use strict';
// Presentation layer: existing financial rules remain in engine.js.
const pack=document.querySelector('.planning');
document.querySelector('header').insertBefore(document.querySelector('.client-pill'),document.querySelector('.header-right'));
document.querySelector('.board-center .orbit').textContent='LIFE QUEST';
document.querySelector('.brand-icon').textContent='🎲';
document.querySelector('.brand>span:last-child').childNodes[0].textContent='保險大富翁';
document.querySelector('.brand small').textContent='LIFE QUEST';
document.querySelector('.play-panel>.section-top .eyebrow').textContent='YOUR LIFE · YOUR CHOICE';
document.querySelector('.planning .eyebrow').textContent='PLANNING INVENTORY';
document.querySelector('.planning h2').textContent='規劃背包';
document.querySelector('.history-head h2').textContent='人生冒險日誌';
const closePack=document.createElement('button');closePack.className='close-panel';closePack.textContent='關閉 ✕';closePack.setAttribute('aria-label','關閉規劃背包');document.querySelector('.planning .section-top').append(closePack);
const closeLog=document.createElement('button');closeLog.className='close-panel';closeLog.textContent='關閉 ✕';document.querySelector('.history-head').append(closeLog);
const toolbar=document.createElement('nav');toolbar.className='game-toolbar';toolbar.setAttribute('aria-label','遊戲工具');toolbar.innerHTML='<button id="open-pack" aria-expanded="false"><span class="tool-icon">🎒</span><span class="tool-label">規劃背包</span></button><button id="open-log" aria-expanded="false"><span class="tool-icon">📖</span><span class="tool-label">冒險日誌</span></button><button id="game-report"><span class="tool-icon">🏁</span><span class="tool-label">人生回顧</span></button><button id="fullscreen" aria-label="切換全螢幕"><span class="tool-icon">⛶</span><span class="tool-label">全螢幕</span></button>';document.body.append(toolbar);
const toast=document.createElement('div');toast.className='toast';toast.setAttribute('role','status');document.body.append(toast);let toastTimeout;
const scenery=document.createElement('div');scenery.className='game-scenery';scenery.setAttribute('aria-hidden','true');document.body.append(scenery);
function togglePack(open){pause();pack.classList.toggle('open',open);$('open-pack').setAttribute('aria-expanded',String(open));if(open){document.body.classList.remove('history-open');$('open-log').setAttribute('aria-expanded','false');closePack.focus();}else $('open-pack').focus();}
function toggleLog(open){pause();document.body.classList.toggle('history-open',open);$('open-log').setAttribute('aria-expanded',String(open));if(open){pack.classList.remove('open');$('open-pack').setAttribute('aria-expanded','false');closeLog.focus();}else $('open-log').focus();}
$('open-pack').onclick=()=>togglePack(!pack.classList.contains('open'));closePack.onclick=()=>togglePack(false);$('open-log').onclick=()=>toggleLog(!document.body.classList.contains('history-open'));closeLog.onclick=()=>toggleLog(false);$('game-report').onclick=()=>{togglePack(false);toggleLog(false);openReport();};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){message('此瀏覽器不支援全螢幕，可使用瀏覽器的全螢幕功能。');}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(pack.classList.contains('open'))togglePack(false);if(document.body.classList.contains('history-open'))toggleLog(false);}});
const icons={market:'🌐',accident:'🚑',work:'💼',social:'🏡'};document.querySelectorAll('.tile').forEach((tile,i)=>{tile.querySelector('.tile-symbol').textContent=icons[E.CATEGORIES[i%4]];});
let lastPosition=-1;
function updatePawn(){if(!state||state.position===lastPosition)return;document.querySelectorAll('.pawn').forEach(p=>p.remove());const pawn=document.createElement('span');pawn.className='pawn';pawn.setAttribute('aria-label','客戶棋子');$('tile-'+state.position).append(pawn);lastPosition=state.position;}
const boardObserver=new MutationObserver(updatePawn);boardObserver.observe($('board'),{subtree:true,attributes:true,attributeFilter:['class']});updatePawn();
const messageObserver=new MutationObserver(()=>{if(!$('message').textContent)return;toast.textContent=$('message').textContent;toast.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.classList.remove('visible'),4200);});messageObserver.observe($('message'),{childList:true,characterData:true,subtree:true});
const eventObserver=new MutationObserver(()=>{const icon=$('event-card').querySelector('.event-icon');if(icon&&latest)icon.textContent=icons[latest.cat]||'🎲';$('event-card').style.animation='none';requestAnimationFrame(()=>$('event-card').style.animation='');});eventObserver.observe($('event-card'),{childList:true});if(latest){const icon=$('event-card').querySelector('.event-icon');if(icon)icon.textContent=icons[latest.cat]||'🎲';}
const originalRoll=$('roll').onclick;let rolling=false;$('roll').onclick=async()=>{if(rolling||!state||state.ended||state.remaining)return;rolling=true;$('roll').disabled=true;$('dice').classList.add('rolling');const flash=setInterval(()=>$('dice').textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][Math.floor(Math.random()*6)],75);await new Promise(resolve=>setTimeout(resolve,550));clearInterval(flash);$('dice').classList.remove('rolling');originalRoll();$('roll').disabled=false;rolling=false;};
