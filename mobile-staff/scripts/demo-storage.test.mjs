import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base='ad1b2ba913dc44cd9fb9a16eaec767a4bc6c5540';
const activityPath='mobile-staff/android/app/src/main/java/nl/lattenspecialist/medewerkers/DemoActivity.java',manifestPath='mobile-staff/android/app/src/main/AndroidManifest.xml';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('only the one-time storage guard changes the release12 DemoActivity',()=>{
 const original=spawnSync('git',['show',base+':'+activityPath],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(original.status,0);
 const normalize=text=>text.replaceAll('\r\n','\n');
 const expected=normalize(original.stdout).replace('public final class DemoActivity extends Activity {','public final class DemoActivity extends Activity {\n    private static boolean dataDirectoryReady;').replace('        WebView.setDataDirectorySuffix("synthetic-review-demo");','        prepareDemoStorage();').replace('    @TargetApi(28)\n    private void configure','    @TargetApi(28)\n    private static synchronized void prepareDemoStorage() {\n        if (!dataDirectoryReady) { WebView.setDataDirectorySuffix("synthetic-review-demo"); dataDirectoryReady = true; }\n    }\n\n    @TargetApi(28)\n    private void configure');
 assert.equal(normalize(read(activityPath)),expected);
});
test('guard precedes WebView initialization and process/cookie boundaries remain intact',()=>{
 const source=read(activityPath),onCreate=source.slice(source.indexOf('onCreate('),source.indexOf('private static synchronized'));
 assert.ok(onCreate.indexOf('prepareDemoStorage();')<onCreate.indexOf('configure(layout);'));
 assert.ok(onCreate.indexOf('Build.VERSION.SDK_INT < 28')<onCreate.indexOf('prepareDemoStorage();'));
 assert.equal((source.match(/setDataDirectorySuffix\(/g)||[]).length,1);
 for(const required of ['setAcceptCookie(true)','setAcceptThirdPartyCookies(web, false)','handler.cancel()','request.deny()','setAllowFileAccess(false)','setAllowContentAccess(false)'])assert.ok(source.includes(required),required);
 assert.doesNotMatch(source,/addJavascriptInterface|Intent.ACTION_VIEW|getSharedPreferences|handler.proceed\(/);
 assert.match(read(manifestPath),/<activity android:name=".DemoActivity" android:exported="false" android:process=":demo"/);
});
test('all tracked operational Staff source and assets retain release12 bytes',()=>{
 const files=spawnSync('git',['ls-tree','-r','--name-only',base,'--','mobile-staff'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(files.status,0);
 for(const file of files.stdout.trim().split('\n').filter(Boolean)){
  if(file===activityPath||file==='mobile-staff/android/app/build.gradle'||file==='mobile-staff/README.md')continue;
  const original=spawnSync('git',['cat-file','--filters',`--path=${file}`,base+':'+file],{cwd:root,encoding:null,windowsHide:true});assert.equal(original.status,0,file);
  assert.deepEqual(fs.readFileSync(path.join(root,file)),original.stdout,file);
 }
});
