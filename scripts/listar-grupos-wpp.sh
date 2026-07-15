#!/usr/bin/env bash
source /opt/sie/.env.wppconnect
S="${1:-sie-chip-04}"
TOKEN=$(curl -s -X POST "http://127.0.0.1:21465/api/$S/$WPPCONNECT_SECRET_KEY/generate-token" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:21465/api/$S/all-groups" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  const j=JSON.parse(d);
  const groups=j.response||j.groups||j;
  if(!Array.isArray(groups)){ console.log(d.slice(0,1500)); process.exit(0); }
  groups.forEach((g,i)=>{
    const name=g.name||g.subject||g.contact?.name||g.groupMetadata?.subject||'?';
    const id=g.id?._serialized||g.id||g.groupMetadata?.id?._serialized||'?';
    console.log(i+1, name, '|', id);
  });
});
"
