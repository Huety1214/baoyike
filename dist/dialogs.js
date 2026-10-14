'use strict';
// A press must start and end outside the card; dragging text out does not dismiss.
document.querySelectorAll('dialog').forEach(dialog=>{
  let outsidePress=false;
  const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',e=>{outsidePress=e.button===0&&outside(e);});
  dialog.addEventListener('pointerup',e=>{if(outsidePress&&e.button===0&&outside(e))dialog.close();outsidePress=false;});
  dialog.addEventListener('pointercancel',()=>outsidePress=false);
  dialog.addEventListener('close',()=>outsidePress=false);
});

// Drawers have a real backdrop so dismissal cannot click the game underneath.
const panelBackdrop=document.createElement('div');panelBackdrop.className='panel-backdrop';panelBackdrop.hidden=true;panelBackdrop.setAttribute('aria-hidden','true');document.body.append(panelBackdrop);
const drawerPanels=[pack,leftSidebar,rightSidebar];
function syncPanelBackdrop(){panelBackdrop.hidden=!drawerPanels.some(panel=>(panel.classList.contains('open')||panel.classList.contains('mobile-open'))&&getComputedStyle(panel).position==='fixed'&&getComputedStyle(panel).display!=='none');}
const drawerObserver=new MutationObserver(syncPanelBackdrop);drawerPanels.forEach(panel=>drawerObserver.observe(panel,{attributes:true,attributeFilter:['class']}));
panelBackdrop.onclick=()=>{togglePack(false);closeSidebars();};
window.addEventListener('resize',syncPanelBackdrop);syncPanelBackdrop();
