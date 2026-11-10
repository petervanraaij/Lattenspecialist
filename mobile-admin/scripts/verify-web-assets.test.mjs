import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditWebAssets} from './verify-web-assets.mjs';

function fixture(files,run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ls-packaged-web-assets-'));try{
 for(const [name,contents]of Object.entries(files)){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents);}
 run(root);
}finally{
 const target=path.resolve(root),temporaryRoot=path.resolve(os.tmpdir());
 if(!target.startsWith(temporaryRoot+path.sep)||!path.basename(target).startsWith('ls-packaged-web-assets-'))throw new Error('Unexpected fixture cleanup target.');
 fs.rmSync(target,{recursive:true,force:true});
}}

test('regression: query-versioned treatment files must be copied',()=>fixture({
 'index.html':'<link rel="stylesheet" href="treatment-overview.css?v=gold-3"><script src="treatment-overview.js?v=brush-1"></script>'
},root=>assert.throws(()=>auditWebAssets(root),/treatment-overview\.css[\s\S]*treatment-overview\.js/)));
test('regression: imported CSS workshop image must be copied',()=>fixture({
 'index.html':'<link rel="stylesheet" href="styles.css">','styles.css':'header{background:url(images/hero-workshop.webp)}'
},root=>assert.throws(()=>auditWebAssets(root),/images\/hero-workshop\.webp/)));
test('checks HTML, CSS and JavaScript references with URL normalization',()=>fixture({
 'index.html':'<link rel="stylesheet" href="styles.css?v=21"><script src="main.js"></script><img src="/images/badge.webp">',
 'styles.css':'@import "sub/extra.css";header{background:url("images/hero-workshop.webp?v=2")}',
 'sub/extra.css':'i{background:url(../images/badge.webp)}',
 'main.js':'import "./part.js"; const image=new URL("./images/badge.webp",import.meta.url);',
 'part.js':'const image="images/badge.webp";','images/badge.webp':'image','images/hero-workshop.webp':'image'
},root=>assert.equal(auditWebAssets(root).missingReferences,0)));
test('external, API and fragment references are not treated as packaged files',()=>fixture({
 'index.html':'<script src="https://example.test/app.js"></script><img src="data:image/png;base64,AAAA"><img src="/api/material/photo?id=1">',
 'styles.css':'a{mask:url(#symbol)}'
},root=>assert.equal(auditWebAssets(root).localReferences,0)));
test('missing JavaScript import fails the build',()=>fixture({'main.js':'export {open} from "./missing.js";'},root=>assert.throws(()=>auditWebAssets(root),/missing\.js/)));
test('relative parent references cannot escape the packaged root',()=>fixture({'index.html':'<img src="../private.webp">'},root=>assert.throws(()=>auditWebAssets(root),/escapes web root/)));
