const http = require('http');
const crypto = require('crypto');
function req(m,p,b,h={}){return new Promise(r=>{const u=new URL('http://localhost:4000'+p);const o={method:m,hostname:u.hostname,port:u.port,path:u.pathname+u.search,headers:{'Content-Type':'application/json',...h},timeout:8000};const q=http.request(o,s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>r({s:s.statusCode,b:d,h:s.headers}))});q.on('error',()=>r({s:0,b:'ERR',h:{}}));q.on('timeout',()=>{q.destroy();r({s:0,b:'TIMEOUT',h:{}})});if(b)q.write(typeof b==='string'?b:JSON.stringify(b));q.end()})}
let V=[];
function chk(n,p,d){if(p)console.log('  [X] '+n);else{V.push({n,d:d||''});console.log('  [!!!PWNED!!!] '+n+(d?' -> '+d:''))}}

async function run(){
  const uid=crypto.randomBytes(4).toString('hex');
  const e='brutal_'+uid+'@test.com';
  await req('POST','/api/auth/send-code',{email:e});
  const cr=await req('POST','/api/auth/send-code',{email:e});
  let code='';try{code=JSON.parse(cr.b).code}catch{}
  if(code)await req('POST','/api/auth/verify-code',{email:e,code});
  await req('POST','/api/auth/register',{email:e,password:'Hack1234',nickname:'brutal',username:'br_'+uid});
  const lr=await req('POST','/api/auth/login',{email:e,password:'Hack1234'});
  let tk='';try{tk=JSON.parse(lr.b).token}catch{}
  if(!tk){console.log('LOGIN FAILED');return}
  const a={Authorization:'Bearer '+tk};
  console.log('=== BRUTAL ATTACK MODE ===\n');

  // 1. Zero-Day XSS
  console.log('=== 1. Zero-Day XSS (15) ===');
  const xss=[
    '<div style="background:url(javascript:alert(1))">',
    '<img src="x" onerror  =  alert(1)>',
    '<svg><animate onbegin=alert(1)>',
    '<object data=javascript:alert(1)>',
    '<embed src=javascript:alert(1)>',
    '<form><button formaction=javascript:alert(1)>',
    '<a href=ja&#x76;ascript:alert(1)>',
    '<img src=x onerror=\\u0061lert(1)>',
    '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e',
    '<style>*{background:url("javascript:alert(1)")}</style>',
    '<link rel=import href=data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==>',
    '<base href=javascript:alert(1)//',
    '<meta http-equiv=refresh content="0;url=javascript:alert(1)">',
    '<isindex action=javascript:alert(1)>',
    '<input type=image src=x onerror=alert(1)>',
  ];
  for(const x of xss){
    const r=await req('POST','/api/workouts',{date:'2026-04-27',exercise:x,sets:1,reps:1},a);
    if(r.s===201){
      const id=JSON.parse(r.b).id;
      const list=await req('GET','/api/workouts',null,a);
      const items=JSON.parse(list.b);
      const saved=items.find(w=>w.id===id);
      const bad=saved&&/onerror|onload|onclick|onbegin|javascript:|formaction|data:text\/html/i.test(saved.exercise);
      chk('XSS: '+x.substring(0,35),!bad,bad?'STORED: '+saved.exercise:undefined);
      await req('DELETE','/api/workouts/'+id,null,a);
    } else chk('XSS: '+x.substring(0,35),true);
  }

  // 2. Type Confusion
  console.log('\n=== 2. Type Confusion (8) ===');
  let r=await req('POST','/api/workouts',{date:'2026-04-27',exercise:['<script>'],sets:1,reps:1},a);
  chk('Type: array exercise',r.s!==500);
  r=await req('POST','/api/workouts',{date:'2026-04-27',exercise:123,sets:1,reps:1},a);
  chk('Type: number exercise',r.s!==500);
  r=await req('POST','/api/workouts',{date:'2026-04-27',exercise:null,sets:1,reps:1},a);
  chk('Type: null exercise',r.s===400);
  r=await req('POST','/api/inbody',{weight:'abc'},a);
  chk('Type: string weight',r.s===400);
  r=await req('POST','/api/inbody',{weight:Infinity},a);
  chk('Type: Infinity weight',r.s===400);
  r=await req('POST','/api/inbody',{weight:NaN},a);
  chk('Type: NaN weight',r.s===400);
  r=await req('POST','/api/workouts',{date:12345,exercise:'test',sets:1,reps:1},a);
  chk('Type: number date',r.s===400);
  r=await req('POST','/api/workouts',{date:'2026-04-27',exercise:'test',sets:'abc',reps:'xyz'},a);
  chk('Type: string sets/reps',r.s===400);

  // 3. Business Logic
  console.log('\n=== 3. Business Logic (6) ===');
  r=await req('POST','/api/workouts',{date:'2099-12-31',exercise:'future',sets:1,reps:1},a);
  chk('Logic: future date 2099',r.s!==500);
  r=await req('POST','/api/inbody',{weight:0.001,date:'2026-04-27'},a);
  chk('Logic: 0.001kg weight',r.s!==500);
  r=await req('POST','/api/inbody',{weight:499.9,height:299,fat_pct:99,muscle_kg:199,water_l:199,date:'2026-04-27'},a);
  chk('Logic: max boundary',r.s===201);
  // 동시 10개 생성
  const promises=[];
  for(let i=0;i<10;i++)promises.push(req('POST','/api/workouts',{date:'2026-04-27',exercise:'concurrent'+i,sets:1,reps:1},a));
  const results=await Promise.all(promises);
  const created=results.filter(x=>x.s===201).length;
  const ids=results.filter(x=>x.s===201).map(x=>{try{return JSON.parse(x.b).id}catch{return null}}).filter(Boolean);
  const uniqueIds=new Set(ids);
  chk('Logic: concurrent '+created+'/10 (unique IDs: '+uniqueIds.size+')',uniqueIds.size===ids.length,'duplicate IDs!');
  for(const id of ids)await req('DELETE','/api/workouts/'+id,null,a);
  // 빈 body
  r=await req('POST','/api/workouts',{},a);
  chk('Logic: empty body',r.s===400);
  r=await req('POST','/api/workouts','not json',a);
  chk('Logic: invalid JSON',r.s===400||r.s===500);

  // 4. Token Manipulation
  console.log('\n=== 4. Token Manipulation (6) ===');
  const parts=tk.split('.');
  const fakePayload=Buffer.from(JSON.stringify({userId:1,role:'admin'})).toString('base64url');
  r=await req('GET','/api/security/dashboard',null,{Authorization:'Bearer '+parts[0]+'.'+fakePayload+'.'+parts[2]});
  chk('Token: forged admin',r.s===401||r.s===403);
  r=await req('GET','/api/workouts',null,{Authorization:'Bearer '+parts[0]+'.'+parts[1]+'.'});
  chk('Token: empty sig',r.s===401);
  const noneHeader=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');
  r=await req('GET','/api/workouts',null,{Authorization:'Bearer '+noneHeader+'.'+parts[1]+'.'});
  chk('Token: alg none',r.s===401);
  const expPayload=Buffer.from(JSON.stringify({userId:1,exp:1})).toString('base64url');
  r=await req('GET','/api/workouts',null,{Authorization:'Bearer '+parts[0]+'.'+expPayload+'.x'});
  chk('Token: expired forged',r.s===401);
  const sqlPayload=Buffer.from(JSON.stringify({userId:'1 OR 1=1'})).toString('base64url');
  r=await req('GET','/api/workouts',null,{Authorization:'Bearer '+parts[0]+'.'+sqlPayload+'.x'});
  chk('Token: SQL userId',r.s===401);
  r=await req('GET','/api/workouts',null,{Authorization:'Bearer '+tk.replace(/./g,'a')});
  chk('Token: scrambled',r.s===401);

  // 5. Race Condition
  console.log('\n=== 5. Race Condition (3) ===');
  // 동시 삭제
  const wr=await req('POST','/api/workouts',{date:'2026-04-27',exercise:'race',sets:1,reps:1},a);
  if(wr.s===201){
    const wid=JSON.parse(wr.b).id;
    const del=await Promise.all([
      req('DELETE','/api/workouts/'+wid,null,a),
      req('DELETE','/api/workouts/'+wid,null,a),
    ]);
    const success=del.filter(x=>x.s===200).length;
    chk('Race: double delete ('+success+' success)',success<=1);
  }else chk('Race: double delete',true);
  // 동시 닉네임 변경
  const nicks=await Promise.all([
    req('PUT','/api/auth/nickname',{nickname:'raceA'},a),
    req('PUT','/api/auth/nickname',{nickname:'raceB'},a),
  ]);
  chk('Race: concurrent nickname',nicks.every(x=>x.s===200));
  // 동시 인바디 생성
  const inb=await Promise.all([
    req('POST','/api/inbody',{weight:70,date:'2026-04-27'},a),
    req('POST','/api/inbody',{weight:71,date:'2026-04-27'},a),
  ]);
  const inbIds=inb.filter(x=>x.s===201).map(x=>{try{return JSON.parse(x.b).id}catch{return null}});
  chk('Race: concurrent inbody (unique IDs)',new Set(inbIds).size===inbIds.length);
  for(const id of inbIds)if(id)await req('DELETE','/api/inbody/'+id,null,a);

  // 6. Error Disclosure
  console.log('\n=== 6. Error Disclosure (4) ===');
  r=await req('GET','/api/nonexistent');
  chk('Err: no stack in 404',!r.b.includes('at '&&!r.b.includes('node_modules')));
  r=await req('POST','/api/workouts','{{{{',{...a,'Content-Type':'application/json'});
  chk('Err: no stack in bad JSON',!r.b.includes('SyntaxError'));
  r=await req('GET','/api/security/dashboard',null,a);
  chk('Err: admin 403 no leak',!r.b.includes('password')&&!r.b.includes('secret'));
  r=await req('GET','/api/health');
  chk('Err: health no secrets',!r.b.includes('JWT_SECRET')&&!r.b.includes('password'));

  // RESULT
  const total=15+8+6+6+3+4;
  console.log('\n========================================');
  console.log('  BRUTAL ATTACK RESULTS');
  console.log('  BLOCKED: '+(total-V.length)+' / PWNED: '+V.length);
  console.log('  TOTAL: '+total);
  console.log('========================================');
  if(V.length>0){console.log('\n  *** VULNERABILITIES ***');V.forEach((v,i)=>console.log('  '+(i+1)+'. '+v.n+(v.d?' -> '+v.d:'')))}
  else console.log('\n  IMPENETRABLE. ZERO VULNERABILITIES.');
}
run().catch(console.error);
