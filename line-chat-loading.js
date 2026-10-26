"use strict";
// LINE's official loading animation is ONLY a progress indicator, never a
// customer reply, order receipt, CRM acknowledgement or paid Push message.
const URL="https://api.line.me/v2/bot/chat/loading/start";
const SINGLE_USER=/^U[0-9a-f]{32}$/i;
const DELAY_MS=650;
const REQUEST_TIMEOUT_MS=1500;

async function withLineLoadingIndicator(event,task,options={}){
 if(typeof task!=="function")throw TypeError("Verified operation required");
 const id=event?.source?.type==="user"?String(event.source.userId||""):"";
 const token=String(options.token??process.env.CHANNEL_ACCESS_TOKEN??"");
 const fetcher=options.fetchImpl??globalThis.fetch;
 if(!SINGLE_USER.test(id)||!token||typeof fetcher!=="function")return task();

 const delay=Math.max(0,Math.min(2000,Number(options.delayMs??DELAY_MS)||0));
 let finished=false,controller=null;
 const timer=setTimeout(()=>{
  if(finished)return;
  controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  Promise.resolve().then(()=>fetcher(URL,{
   method:"POST",
   headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({chatId:id,loadingSeconds:10}),
   signal:controller.signal
  })).catch(()=>{/* Loading is optional; never slow down the real operation. */})
    .finally(()=>clearTimeout(deadline));
 },delay);
 try{return await task();}
 finally{
  finished=true;
  clearTimeout(timer);
  // Do not let a late loading request outlive an already-completed order
  // acknowledgement. The next actual LINE reply ends any shown animation.
  if(controller)controller.abort();
 }
}
module.exports={withLineLoadingIndicator};
