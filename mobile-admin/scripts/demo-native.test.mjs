import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const native='mobile-admin/android/app/src/main';
const java=path.join(root,native,'java/nl/lattenspecialist/beheer');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const base='9918b5b5ebedb65d08f88e08fd148cc76c5e81c9';
test('operational16 preserved except exactly the authorised Android7 notification-channel guard',()=>{
 for(const file of ['java/nl/lattenspecialist/beheer/MainActivity.java','java/nl/lattenspecialist/beheer/RequestNotificationWorker.java','java/nl/lattenspecialist/beheer/AdminWidgetProvider.java','java/nl/lattenspecialist/beheer/QuickRequestWidgetProvider.java','layout/admin_widget.xml','layout/quick_request_widget.xml','xml/admin_widget_info.xml','xml/quick_request_widget_info.xml'].map(file=>`${native}/${file.startsWith('java/')?file:'res/'+file}`)){
  // Apply the checkout's ordinary Git filters (Windows CRLF) to the pinned blob.
  const original=spawnSync('git',['cat-file','--filters',`--path=${file}`,`${base}:${file}`],{cwd:root,encoding:null,windowsHide:true});
  assert.equal(original.status,0);
  const expected=file.endsWith('/RequestNotificationWorker.java')?Buffer.from(original.stdout.toString('utf8').replace('        manager.createNotificationChannel(new NotificationChannel(CHANNEL,','        if(Build.VERSION.SDK_INT>=26) manager.createNotificationChannel(new NotificationChannel(CHANNEL,'),'utf8'):original.stdout;
  assert.deepEqual(fs.readFileSync(path.join(root,file)),expected,file);
 }
 const changed=spawnSync('git',['diff','--name-only',base,'--','mobile-staff'],{cwd:root,encoding:'utf8',windowsHide:true});
 assert.equal(changed.stdout.trim(),'','Staff remains untouched');
});
test('visible public entry, separate process and separately named DEMO widgets preserve work providers',()=>{
 const manifest=read(`${native}/AndroidManifest.xml`),entry=fs.readFileSync(path.join(java,'EntryActivity.java'),'utf8');
 assert.equal((manifest.match(/android.intent.category.LAUNCHER/g)||[]).length,1);
 assert.match(manifest,/<activity android:name=".EntryActivity"[^>]*>[\s\S]*?LAUNCHER/);
 assert.match(manifest,/<activity android:name=".DemoActivity" android:exported="false" android:process=":demo"/);
 for(const name of ['AdminWidgetProvider','QuickRequestWidgetProvider','DemoAdminWidgetProvider','DemoQuickRequestWidgetProvider'])assert.ok(manifest.includes(`android:name=".${name}"`));
 assert.ok(entry.includes('Bekijk fictieve demonstratie'));assert.ok(entry.includes('Open beveiligde app'));
 for(const layout of ['demo_admin_widget.xml','demo_quick_request_widget.xml'])assert.match(read(`${native}/res/layout/${layout}`),/DEMO/);
});
test('demo code cannot reach operational networking, auth preferences or work scheduler',()=>{
 for(const name of fs.readdirSync(java).filter(name=>name.startsWith('Demo')&&name.endsWith('.java'))){
  const source=fs.readFileSync(path.join(java,name),'utf8');
  assert.doesNotMatch(source,/\b(?:HttpURLConnection|URLConnection|WorkManager|JavascriptInterface|addJavascriptInterface|evaluateJavascript)\s*[(.]/,name);
  assert.doesNotMatch(source,/\b(?:AdminWidgetProvider|RequestNotificationWorker|MainActivity)\.(?:PREFS|TOKEN|schedule|checkNow)|admin_token|lattenspecialist_widget|stuiterbaas-reserveren/,name);
 }
 const widgets=fs.readFileSync(path.join(java,'DemoAdminWidgetProvider.java'),'utf8');
 assert.ok(widgets.includes('lattenspecialist_demo_widgets_v1'));assert.ok(widgets.includes('Fictief voorbeeld · geen live telling'));
 const intents=fs.readFileSync(path.join(java,'DemoIntents.java'),'utf8');
 assert.ok(intents.includes('new Intent(context, DemoActivity.class)'));assert.ok(intents.includes('FLAG_IMMUTABLE'));
 assert.ok(intents.includes('DemoIntentPolicy.destination('));assert.doesNotMatch(intents,/setData|ACTION_VIEW/);
});
test('notification permission is button-driven and denial keeps demo usable',()=>{
 const activity=fs.readFileSync(path.join(java,'DemoActivity.java'),'utf8');
 const initial=activity.slice(activity.indexOf('onCreate('),activity.indexOf('@TargetApi(28)'));
 assert.ok(initial.includes('notification.setOnClickListener(view -> requestDemoNotification())'));
 assert.doesNotMatch(initial,/requestPermissions\(/);
 assert.match(activity,/requestCode != DemoNotificationPolicy.PERMISSION_REQUEST_ID \|\| !demoNotificationPending/);
 assert.match(activity,/else message.setText\(DemoNotificationPolicy.DENIED\)/);
 const notification=fs.readFileSync(path.join(java,'DemoRequestNotification.java'),'utf8');
 assert.ok(notification.includes('DEMO · Fictieve onderhoudsaanvraag'));assert.ok(notification.includes('DemoIntents.open(context, null, null'));
});
test('demo file/camera/download and transport restrictions remain fail-closed',()=>{
 const activity=fs.readFileSync(path.join(java,'DemoActivity.java'),'utf8');
 for(const expected of ['setDataDirectorySuffix("synthetic-review-demo")','setAllowFileAccess(false)','setAllowContentAccess(false)','MIXED_CONTENT_NEVER_ALLOW','handler.cancel()','request.deny()','callback.onReceiveValue(null)','Downloads zijn uitgeschakeld','intent.getClipData() != null','entryUrl = intentDestination(getIntent())','web.loadUrl(entryUrl)'])assert.ok(activity.includes(expected),expected);
 assert.doesNotMatch(activity,/handler.proceed\(|Intent.ACTION_VIEW|addJavascriptInterface/);
});
