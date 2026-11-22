// Requires Playwright and marked. Optional CHROME_PATH for an installed Chromium.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'output/design');
const screens=['entry','track','schedule','review','success','home','task','profile'];
(async()=>{
 const options={headless:true};
 if(process.env.CHROME_PATH)options.executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch(options);
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 fs.mkdirSync(path.join(out,'screens'),{recursive:true});
 for(const theme of ['light','dark'])for(const screen of screens){
  await page.goto(pathToFileURL(path.join(root,'prototype/index.html')).href+`?capture=1&theme=${theme}&screen=${screen}`);
  await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.locator('.phone').screenshot({path:path.join(out,`screens/${theme}-${screen}.png`),omitBackground:true});
  const geometry=await page.evaluate(()=>({screen:document.querySelector('main').scrollHeight,visible:document.querySelector('main').clientHeight,overflow:document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth}));
  console.log(theme,screen,geometry);
  if(geometry.overflow)throw Error('Horizontal content overflow');
 }
 await page.setViewportSize({width:2400,height:1600});
 for(const [file,width] of [['cjm',2400],['mockups-light',1840],['mockups-dark',1840],['design-system',1600]]){
  await page.setViewportSize({width,height:1000});
  await page.goto(pathToFileURL(path.join(out,file+'.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(out,file+'.png'),fullPage:true,scale:'css'});
  console.log('Rendered',file,await page.evaluate(()=>document.body.scrollHeight));
 }
 // A human-sized overview for inline review; individual screens stay at 2x.
 const sharp=require('sharp');
 await sharp(path.join(out,'mockups-light.png')).resize({width:1200}).toFile(path.join(out,'mockups-light-preview.png'));
 await sharp(path.join(out,'mockups-dark.png')).resize({width:1200}).toFile(path.join(out,'mockups-dark-preview.png'));
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
