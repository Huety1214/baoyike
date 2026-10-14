'use strict';
// Player details and restart live with the board, without an application bar.
const playerDialog=document.createElement('dialog');playerDialog.id='player-dialog';playerDialog.setAttribute('aria-label','玩家狀態詳情');
playerDialog.innerHTML='<div class="player-heading"><h2>玩家狀態</h2><button id="close-player" class="text-btn">關閉 ✕</button></div><div id="player-identity"></div><div id="player-details"></div><div class="player-actions"></div>';
document.body.append(playerDialog);
$('player-identity').append(document.querySelector('.client-pill'));
const restartButton=$('restart');restartButton.textContent='重新遊戲';restartButton.className='primary full';playerDialog.querySelector('.player-actions').append(restartButton);
document.querySelector('header').remove();
const playerButton=document.createElement('button');playerButton.id='open-player';playerButton.innerHTML='<span class="tool-icon">🙂</span><span class="tool-label">玩家狀態</span>';gameMenu.insertBefore(playerButton,$('game-report'));
const boardRestart=document.createElement('button');boardRestart.id='board-restart';boardRestart.className='primary';boardRestart.textContent='重新遊戲 ↻';boardRestart.hidden=true;document.querySelector('.board-center').insertBefore(boardRestart,document.querySelector('.board-foot'));

// Keep a clean starting profile for subsequent games; current saves remain intact.
const createWithProfile=E.create;E.create=input=>{const next=createWithProfile(input);next.initialProfile={...input};return next;};
function beginNewGame(){
  pause();closeSidebars();togglePack(false);
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  const profile=state?.initialProfile||state;
  if(profile){for(const input of $('setup-form').elements){if(input.name&&Object.hasOwn(profile,input.name))input.value=profile[input.name];}}
  $('setup').showModal();
}
restartButton.onclick=beginNewGame;boardRestart.onclick=beginNewGame;
$('close-player').onclick=()=>playerDialog.close();
playerButton.onclick=()=>{pause();renderPlayer();playerDialog.showModal();};
function detail(label,value){return `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`;}
function renderPlayer(){
  boardRestart.hidden=!!state&&!state.ended;boardRestart.textContent=state?'重新遊戲 ↻':'設定玩家，開始人生 →';
  if(!state){$('player-details').innerHTML='<p class="hint">尚未設定玩家。按下重新遊戲，可以建立你要體驗的人生。</p>';$('roll').hidden=true;return;}
  const s=state,p=E.investmentSnapshot(s),working=s.age>=65?'退休':s.unemployed>0?`收入中斷，約 ${s.unemployed/2} 年後恢復`:'工作中';
  const status=s.ended?(s.reason==='death'?`人生結束：${s.deathCause}`:'必要支出無法支付'):working;
  const protections=Object.entries(E.POLICIES).filter(([k])=>s.policies[k]).map(([,v])=>v.name);if(p)protections.push('投資型壽險');
  $('player-details').innerHTML=`<p class="player-life-status">${esc(status)}</p><h3>生活與家庭</h3><dl class="player-grid">${detail('年齡',s.age+' 歲')}${detail('已經歷',s.periods/2+' 年')}${detail('工作',s.job)}${detail('健康',s.health==='chronic'?'慢性疾病':'無已知疾病')}${detail('家庭',s.married==='yes'?'已婚／有伴侶':'單身')}${detail('子女／扶養',`${s.children}／${s.dependents} 人`)}</dl><h3>收入與支出（每年）</h3><dl class="player-grid">${detail('目前收入',money(E.income(s))+' 元')}${detail('生活費',money(s.expense)+' 元')}${detail('保障型保費',money(E.premium(s))+' 元')}${detail('投資型續繳',money(p?.annualPremium||0)+' 元')}${detail('貸款本金還款',money(Math.min(s.repayment,s.debt))+' 元')}${detail('貸款年利率',s.interest.toFixed(1)+'%')}</dl><h3>資產與負債</h3><dl class="player-grid">${detail('可用現金',money(s.cash)+' 元')}${detail('既有股票資產',money(s.stocks)+' 元')}${detail('既有債券資產',money(s.bonds)+' 元')}${detail('房產等其他資產',money(s.property)+' 元')}${detail('投資型帳戶',money(p?.value||0)+' 元')}${detail('負債餘額',money(s.debt)+' 元')}${detail('淨資產',money(E.net(s)-(s.reason==='bankruptcy'?s.shortfall:0))+' 元')}</dl><h3>目前保障</h3><p class="player-cover">${esc(protections.length?protections.join('、'):'尚未投保')}</p><p class="hint">重新遊戲會先開啟客戶設定，可沿用或修改資料；送出前仍保留目前進度。</p>`;
}
const renderBeforePlayer=render;render=function(){renderBeforePlayer();renderPlayer();};
renderPlayer();
