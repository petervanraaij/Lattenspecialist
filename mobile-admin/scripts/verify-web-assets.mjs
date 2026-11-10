import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

function references(text, file) {
  const found=[];
  if(file.endsWith('.html')) {
    for(const tag of text.matchAll(/<(script|link|img|source|iframe|video|audio|embed|input)\b([^>]*)>/gi)) {
      for(const attribute of tag[2].matchAll(/\b(src|href|poster|srcset)\s*=\s*(["'])(.*?)\2/gi)) {
        if(attribute[1].toLowerCase()==='href'&&tag[1].toLowerCase()!=='link')continue;
        const values=attribute[1].toLowerCase()==='srcset'?attribute[3].split(',').map(item=>item.trim().split(/\s+/)[0]):[attribute[3]];
        found.push(...values);
      }
    }
  }
  if(file.endsWith('.css')||file.endsWith('.html')) {
    for(const match of text.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gi))found.push(match[2]??match[3]);
    for(const match of text.matchAll(/@import\s+(["'])(.*?)\1/gi))found.push(match[2]);
  }
  if(file.endsWith('.js')||file.endsWith('.mjs')) {
    for(const match of text.matchAll(/\b(?:import|export)\s+(?:(?:[^;\n]*?)\s+from\s*)?["']([^"']+)["']/g))found.push(match[1]);
    for(const match of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g))found.push(match[1]);
    for(const match of text.matchAll(/\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g))found.push(match[1]);
    for(const match of text.matchAll(/["'`]((?:\.{1,2}\/|\/)?(?:images|vendor|fonts|assets)\/[^"'`]+)["'`]/g)) {
      if(/\.[a-z\d]{2,8}(?:[?#]|$)/i.test(match[1]))found.push(match[1]);
    }
  }
  return found;
}

export function auditWebAssets(directory) {
  const root=path.resolve(directory),files=new Map();
  function collect(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})) {
    const absolute=path.join(folder,entry.name);
    if(entry.isSymbolicLink())throw new Error('Packaged web assets must not use symlinks.');
    if(entry.isDirectory())collect(absolute);
    else if(entry.isFile())files.set(path.relative(root,absolute).replaceAll('\\','/'),absolute);
  }}
  collect(root);
  const missing=[],checked=[];
  let inspectedDocuments=0;
  for(const [file,absolute] of files) {
    if(!/\.(?:html|css|m?js)$/i.test(file))continue;
    inspectedDocuments++;
    for(const raw of references(fs.readFileSync(absolute,'utf8'),file)) {
      const reference=raw.trim().replaceAll('&amp;','&');
      if(!reference||reference.startsWith('#')||reference.startsWith('//')||/^[a-z][a-z\d+.-]*:/i.test(reference)||reference.includes('${'))continue;
      const urlPath=reference.split(/[?#]/,1)[0];
      if(!urlPath||urlPath.startsWith('/api/'))continue;
      let decoded;
      try{decoded=decodeURIComponent(urlPath);}catch{throw new Error('Invalid encoded local reference in '+file);}
      const target=path.posix.normalize(path.posix.join(decoded.startsWith('/')?'':path.posix.dirname(file),decoded.replace(/^\//,'')));
      if(target==='..'||target.startsWith('../'))throw new Error('Local asset escapes web root: '+file+' -> '+reference);
      checked.push({file,reference,target});
      if(!files.has(target))missing.push({file,reference,target});
    }
  }
  if(missing.length)throw new Error('Missing packaged local web assets:\n'+missing.map(item=>`${item.file} -> ${item.reference} (${item.target})`).join('\n'));
  return {files:files.size,inspectedDocuments,localReferences:checked.length,missingReferences:0};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  if(!process.argv[2])throw new Error('Explicit web asset directory is required.');
  console.log(JSON.stringify(auditWebAssets(process.argv[2])));
}
