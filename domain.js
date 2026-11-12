(function(root){
  function scaleAmount(amount, originalServings, targetServings){
    if(!Number.isFinite(Number(amount))) throw new TypeError('amount must be numeric');
    if(!(Number(originalServings)>0) || !(Number(targetServings)>0)) throw new RangeError('servings must be positive');
    const result=Number(amount)*Number(targetServings)/Number(originalServings);
    return Number.isInteger(result)?result:Number(result.toFixed(1));
  }
  function parseIngredientLines(text){
    return String(text||'').split('\n').map((x,index)=>({line:x.trim(),number:index+1})).filter(x=>x.line).map(({line,number})=>{
      const parts=line.split('|').map(x=>x.trim());
      if(parts.length<2||!parts[0]) throw new TypeError(`שורה ${number}: חסרים שם רכיב וכמות.`);
      const unit=(parts[2]||'').trim();
      const flexible=/^(לפי הצורך|לפי הטעם)$/i.test(parts[1])||(parts[1]==='0'&&unit==='לפי הצורך');
      const amount=flexible?0:Number(parts[1].replace(',','.'));
      if(!flexible&&(!Number.isFinite(amount)||amount<=0)) throw new TypeError(`שורה ${number}: הכמות צריכה להיות מספר חיובי או "לפי הצורך".`);
      if(!unit) throw new TypeError(`שורה ${number}: יש לציין יחידה, למשל גרם, מ״ל או יחידות.`);
      if(parts[0].length>300||unit.length>40||amount>1000000) throw new TypeError(`שורה ${number}: אחד מפרטי הרכיב חורג מהמגבלה.`);
      const alternatives=(parts[3]||'').split(';').map(x=>x.trim()).filter(Boolean);
      if(parts.length>4||alternatives.length>2||alternatives.some(x=>x.length>200)) throw new TypeError(`שורה ${number}: אפשר לציין עד שתי חלופות, עד 200 תווים לכל אחת.`);
      const ingredient={name:parts[0],amount,unit:flexible?'לפי הצורך':unit};
      if(alternatives.length) ingredient.alternatives=alternatives;
      return ingredient;
    });
  }
  function parseTimerVoiceCommand(text){
    const normalized=String(text||'').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[?!.,־-]/g,' ').replace(/\s+/g,' ').trim();
    if(/(כמה זמן נשאר|מה נשאר בטיימר|מה מצב הטיימר|כמה נשאר)/.test(normalized)) return {action:'status'};
    if(/(הקרא|תגיד|מה) (לי )?(את )?(השלב|ההוראות)/.test(normalized)) return {action:'read-step'};
    const numbers={'אחת':1,'אחד':1,'שתיים':2,'שתים':2,'שניים':2,'שנים':2,'שלוש':3,'שלושה':3,'ארבע':4,'ארבעה':4,'חמש':5,'חמישה':5,'שש':6,'שישה':6,'שבע':7,'שבעה':7,'שמונה':8,'תשע':9,'תשעה':9,'עשר':10,'עשרה':10,'אחת עשרה':11,'אחד עשר':11,'שתים עשרה':12,'שנים עשר':12,'שלוש עשרה':13,'ארבע עשרה':14,'חמש עשרה':15,'עשרים':20};
    const match=normalized.match(/(?:הפעל|תפעיל|התחל|שים|קבע|הוסף|תזכיר לי)?\s*(?:טיימר)?\s*(?:למשך|לעוד|ל)?\s*(\d+|[א-ת]+(?:\s+[א-ת]+)?)\s*(שניות?|דקות?|דק|שעות?)/);
    if(!match) return null;
    const count=/^\d+$/.test(match[1])?Number(match[1]):numbers[match[1]];
    if(!Number.isInteger(count)||count<1||count>1440) return null;
    const unit=match[2];
    const factor=unit.startsWith('שנ')?1:unit.startsWith('שע')?3600:60;
    const seconds=count*factor;
    if(seconds>86400) return null;
    return {action:'start-timer',seconds};
  }
  function recommendIngredientAlternatives(ingredient,category=''){
    const name=String(ingredient||'').trim().toLowerCase();
    if(/^(סוכר|סוכר לבן|סוכר רגיל)$/.test(name)||/^(white sugar|granulated sugar)$/.test(name)) return {
      ingredient:String(ingredient), options:['אלולוז','תערובת אריתריטול וסטיביה'], recommended:'אלולוז',
      reason:'זו נקודת פתיחה למתכונים אפויים: אלולוז מתוק פחות מסוכר ועלול להשחים יותר, לכן פועלים לפי הוראות המוצר ומתאימים את המתכון בזהירות.',
      limitation:'מחקרים מצביעים על תגובת גלוקוז נמוכה יותר בתנאים מסוימים, אך זה אינו מבטיח תגובה אישית או התאמה לכל מתכון. אין יחס החלפה קבוע; בדקו גם את תווית המוצר.'
    };
    const isFlour=/^קמח(?: לבן| רגיל| חיטה| תופח| .+ לבן)?$/.test(name)||/^(white|all-purpose) flour$/.test(name);
    if(isFlour){
      const savory=['בשרים','דגים','ארוחות','מאפים'].includes(category);
      return {
        ingredient:String(ingredient), options:savory?['קמח חומוס','קמח שקדים']:['קמח שקדים','קמח חומוס'],
        recommended:savory?'קמח חומוס':'קמח שקדים',
        reason:savory?'למנות מלוחות זו אפשרות ראשונה לבדיקה; טעמו מורגש והוא משנה את המבנה.':'למאפים מתוקים זו אפשרות ראשונה לבדיקה בזכות טעמו העדין יחסית; קמח שקדים משנה את הלחות והמבנה.',
        limitation:'אין יחס החלפה קבוע לקמח לבן. התגובה הגליקמית תלויה בסוג המוצר, בטחינה, במתכון ובאדם; מחקר על קמח חומוס מתאים אינו מוכיח שכל קמח חומוס יוריד תגובה גליקמית.'
      };
    }
    return null;
  }
  function appendVersion(versions, date, note, snapshot){
    const previous=Array.isArray(versions)?versions:[];
    const entry={number:previous.length+1,date:(date||new Date()).toISOString(),note:String(note||'עדכון מתכון')};
    if(snapshot && typeof snapshot==='object') entry.snapshot=JSON.parse(JSON.stringify(snapshot));
    return [...previous,entry];
  }
  function formatClock(seconds){
    const safe=Math.max(0,Math.ceil(Number(seconds)||0));
    return `${String(Math.floor(safe/60)).padStart(2,'0')}:${String(safe%60).padStart(2,'0')}`;
  }
  function escapeHTML(value=''){
    return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function createBackup(state, exportedAt=new Date()){
    if(!state || !Array.isArray(state.recipes)) throw new TypeError('Invalid app state');
    return {format:'mychef-backup',schemaVersion:1,exportedAt:exportedAt.toISOString(),data:state};
  }
  function validateBackup(payload){
    if(!payload || payload.format!=='mychef-backup' || payload.schemaVersion!==1 || !payload.data || !Array.isArray(payload.data.recipes) || !payload.data.profile || typeof payload.data.profile!=='object') return {ok:false,reason:'קובץ הגיבוי אינו מזוהה או אינו נתמך.'};
    const recipes=payload.data.recipes;
    if(recipes.length>10000) return {ok:false,reason:'קובץ הגיבוי גדול מדי.'};
    for(const r of recipes){
      if(!r || typeof r.id!=='string' || !r.id || typeof r.name!=='string' || !r.name.trim() || typeof r.category!=='string' || !Number.isFinite(r.servings) || r.servings<1 || r.servings>5000 || !Array.isArray(r.ingredients) || !Array.isArray(r.steps) || !Array.isArray(r.versions)) return {ok:false,reason:'קובץ הגיבוי מכיל מתכון במבנה לא תקין.'};
      if(r.id.length>160 || r.name.length>300 || r.category.length>100 || r.ingredients.length>500 || r.steps.length>500 || r.versions.length>500) return {ok:false,reason:'קובץ הגיבוי מכיל נתונים שחורגים מהמגבלות.'};
      if(r.ingredients.some(i=>!i || typeof i.name!=='string' || i.name.length>300 || !Number.isFinite(i.amount) || i.amount<0 || i.amount>1000000 || typeof i.unit!=='string' || i.unit.length>40 || (i.alternatives!==undefined&&(!Array.isArray(i.alternatives)||i.alternatives.length>2||i.alternatives.some(x=>typeof x!=='string'||!x.trim()||x.length>200))))) return {ok:false,reason:'קובץ הגיבוי מכיל רכיב או חלופות במבנה לא תקין.'};
      if(r.steps.some(step=>typeof step!=='string' || step.length>5000)) return {ok:false,reason:'קובץ הגיבוי מכיל שלב הכנה במבנה לא תקין.'};
      if(r.versions.some(v=>{if(!v || !Number.isInteger(v.number) || v.number<1 || typeof v.date!=='string' || typeof v.note!=='string' || v.note.length>500)return true;if(v.snapshot){const x=v.snapshot;if(typeof x!=='object'||typeof x.name!=='string'||typeof x.category!=='string'||!Number.isFinite(x.servings)||x.servings<1||!Array.isArray(x.ingredients)||!Array.isArray(x.steps)||x.ingredients.some(i=>!i||typeof i.name!=='string'||!Number.isFinite(i.amount)||i.amount<0||typeof i.unit!=='string'||(i.alternatives!==undefined&&(!Array.isArray(i.alternatives)||i.alternatives.length>2||i.alternatives.some(a=>typeof a!=='string'||!a.trim()||a.length>200))))||x.steps.some(step=>typeof step!=='string'))return true;}return false;})) return {ok:false,reason:'קובץ הגיבוי מכיל היסטוריית גרסאות לא תקינה.'};
    }
    if(typeof payload.data.profile.name!=='string' || typeof payload.data.profile.preferences!=='string' || payload.data.profile.name.length>200 || payload.data.profile.preferences.length>10000) return {ok:false,reason:'העדפות המשתמש בקובץ הגיבוי אינן תקינות.'};
    return {ok:true,data:payload.data};
  }
  const api={scaleAmount,parseIngredientLines,parseTimerVoiceCommand,recommendIngredientAlternatives,appendVersion,formatClock,escapeHTML,createBackup,validateBackup};
  root.MyChefDomain=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(globalThis);
