// This publishable key is intentionally public. Room data still requires the
// separate per-player/host capability at the authenticated game endpoint.
export const PUBLIC_KEY='sb_publishable_mI94i3exzVPlHveGFX1WOw_1Ucab3_f';
export function classifyMessage(raw,topic){try{const m=JSON.parse(raw);if(m.topic!==topic)return null;if(m.event==='broadcast'&&m.payload?.event==='changed')return 'changed';if(m.event==='phx_reply'&&m.payload?.status==='ok')return 'ready';if(['phx_error','phx_close'].includes(m.event)||m.payload?.status==='error')return 'error';return null;}catch{return null;}}
export class RoomLive{
 constructor(code,onChange,onStatus=()=>{}){this.topic='realtime:quiz-salon:'+code;this.onChange=onChange;this.onStatus=onStatus;this.closed=false;this.ref=1;this.connected=false;this.lastReceived=0;this.attempts=0;this.open();}
 open(){if(this.closed)return;try{
  const ws=new WebSocket('wss://ojyswaxuqwnqilrvtjll.supabase.co/realtime/v1/websocket?apikey='+PUBLIC_KEY+'&vsn=1.0.0');this.ws=ws;
  ws.onopen=()=>{if(this.closed)return;this.lastReceived=Date.now();this.send(this.topic,'phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:false}},'1');this.heartbeat=setInterval(()=>{if(Date.now()-this.lastReceived>55000){ws.close();return;}this.send('phoenix','heartbeat',{});},20000);};
  ws.onmessage=e=>{this.lastReceived=Date.now();const kind=classifyMessage(e.data,this.topic);if(kind==='ready'){this.connected=true;this.attempts=0;this.onStatus(true);this.onChange();}else if(kind==='changed')this.onChange();else if(kind==='error')ws.close();};
  ws.onerror=()=>ws.close();
  ws.onclose=()=>{clearInterval(this.heartbeat);this.connected=false;this.onStatus(false);if(!this.closed)this.retry=setTimeout(()=>this.open(),Math.min(10000,800*2**this.attempts++)+Math.random()*300);};
 }catch{this.onStatus(false);if(!this.closed)this.retry=setTimeout(()=>this.open(),3000);}}
 send(topic,event,payload,joinRef){if(this.ws?.readyState===1)this.ws.send(JSON.stringify({topic,event,payload,ref:String(++this.ref),...(joinRef?{join_ref:joinRef}:{})}));}
 stop(){this.closed=true;clearTimeout(this.retry);clearInterval(this.heartbeat);this.ws?.close();this.connected=false;}
}
