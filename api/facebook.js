const https = require('https');

function normalize(input){
  input=String(input||'').trim();
  if(!input)return '';
  try{
    const u=new URL(/^https?:\/\//i.test(input)?input:'https://www.facebook.com/'+input.replace(/^@/,''));
    if(u.pathname==='/profile.php' && u.searchParams.get('id')) return u.searchParams.get('id');
    const p=u.pathname.split('/').filter(Boolean);
    if(!p.length)return '';
    if(['people','pages','groups'].includes(p[0]) && p[1]) return p[1].replace(/^@/,'');
    return p[0].replace(/^@/,'');
  }catch(e){}
  return input.replace(/^https?:\/\//i,'').replace(/^(www\.|m\.)?facebook\.com\//i,'').replace(/^@/,'').split('/')[0].split('?')[0];
}

function getMeta(html,name){
  const a=new RegExp('<meta[^>]+(?:property|name)=["\\']'+name.replace(':','\\:')+'["\\'][^>]+content=["\\']([^"\\']*)["\\']','i').exec(html);
  return a?a[1].replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"):'';
}

function fetchPage(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{
      'User-Agent':'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language':'en-US,en;q=0.9',
      'Referer':'https://www.facebook.com/'
    }},res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){
        return resolve(fetchPage(new URL(res.headers.location,url).toString()));
      }
      let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,url}));
    });
    req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Timeout')));
  });
}

function extractId(html){
  const patterns=[
    /fb:\/\/(?:profile|page|group|user)\/(\d+)/i,
    /"entity_id":"(\d+)"/i,
    /"profile_id":"(\d+)"/i,
    /"profileID":"(\d+)"/i,
    /"userID":"(\d+)"/i,
    /"user_id":"(\d+)"/i,
    /"page_id":"(\d+)"/i,
    /"owner_id":"(\d+)"/i
  ];
  for(const p of patterns){const m=html.match(p);if(m)return m[1]}
  const links=[getMeta(html,'al:android:url'),getMeta(html,'al:ios:url')];
  for(const s of links){const m=s.match(/\/(\d+)(?:$|[/?])/);if(m)return m[1]}
  return '';
}

module.exports=async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin','*');
  const input=(req.query||{}).input;
  if(!input)return res.status(400).json({success:false,error:'Parameter input wajib diisi.'});
  const username=normalize(input);
  if(!username)return res.status(400).json({success:false,error:'URL/username Facebook tidak valid.'});

  if(/^\d+$/.test(username)){
    return res.status(200).json({success:true,data:{username:'',fbid:username,title:'',type:'user'}});
  }

  try{
    const target='https://www.facebook.com/'+encodeURIComponent(username)+'/';
    const page=await fetchPage(target);
    if(page.status===404)return res.status(404).json({success:false,error:'Profil Facebook tidak ditemukan.'});
    const fbid=extractId(page.body);
    const title=getMeta(page.body,'og:title')||getMeta(page.body,'twitter:title')||username;
    const image=getMeta(page.body,'og:image')||'';
    if(!fbid)return res.status(404).json({success:false,error:'Facebook tidak menampilkan ID numerik pada halaman yang dapat dibaca. Kemungkinan Facebook memblokir request atau profil membutuhkan login.'});
    return res.status(200).json({success:true,data:{username,fbid,title:title.replace(/\s*[|•-]\s*Facebook$/i,''),type:'user',avatar:image}});
  }catch(e){
    return res.status(502).json({success:false,error:'Server gagal mengakses Facebook: '+e.message});
  }
};