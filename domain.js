(function(root){
  function scaleAmount(amount, originalServings, targetServings){
    if(!Number.isFinite(Number(amount))) throw new TypeError('amount must be numeric');
    if(!(Number(originalServings)>0) || !(Number(targetServings)>0)) throw new RangeError('servings must be positive');
    const result=Number(amount)*Number(targetServings)/Number(originalServings);
    return Number.isInteger(result)?result:Number(result.toFixed(1));
  }
  function estimateNutrition(ingredients,targetServings,catalog=root.MyChefNutritionData){
    if(!Array.isArray(ingredients)) throw new TypeError('ingredients must be an array');
    if(!Number.isFinite(Number(targetServings))||Number(targetServings)<=0) throw new RangeError('servings must be positive');
    const foods=Array.isArray(catalog?.foods)?catalog.foods:[];
    const normalize=value=>String(value||'').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[.,:;()]/g,' ').replace(/\s+/g,' ').trim();
    const gramsUnits=new Set(['g','gram','grams','גרם','גר']);
    const totals={kcal:0,protein:0,carbs:0,fat:0,fiber:0};
    const included=[],missing=[];
    for(const ingredient of ingredients){
      const name=String(ingredient?.name||'').trim();
      const food=foods.find(item=>[item.name,...(item.aliases||[])].some(alias=>normalize(alias)===normalize(name)));
      if(!food){missing.push({name,reason:'אין התאמה חד-משמעית במאגר המקומי.'});continue;}
      const unit=normalize(ingredient?.unit);
      const amount=Number(ingredient?.amount);
      if(!gramsUnits.has(unit)){missing.push({name,reason:'הכמות לא נמדדה בגרמים; לא בוצעה המרה.'});continue;}
      if(!Number.isFinite(amount)||amount<=0){missing.push({name,reason:'חסרה כמות מדויקת בגרמים.'});continue;}
      const values=['kcal','protein','carbs','fat','fiber'];
      if(values.some(key=>!Number.isFinite(food[key])||food[key]<0)){missing.push({name,reason:'חסרים ערכים תזונתיים תקינים במאגר.'});continue;}
      const scale=amount/100;
      values.forEach(key=>totals[key]+=food[key]*scale);
      included.push({name,food:food.name,sourceId:food.id,sourceLabel:food.sourceLabel||food.id,amount,unit:'גרם'});
    }
    const round=value=>Number(value.toFixed(1));
    const rounded=Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,round(value)]));
    const perServing=Object.fromEntries(Object.entries(rounded).map(([key,value])=>[key,round(value/Number(targetServings))]));
    return {totals:rounded,perServing,included,missing,ingredientCount:ingredients.length,coveredCount:included.length,coverage:ingredients.length?included.length/ingredients.length:0,source:catalog?.version||'מאגר מקומי'};
  }
  function normalizeFoodName(value){return String(value||'').toLowerCase().replace(/[\u0591-\u05C7]/g,'').replace(/[.,:;()]/g,' ').replace(/\s+/g,' ').trim()}
  function validateCustomNutritionFood(input){
    if(!input||typeof input.name!=='string') return {ok:false,reason:'צריך לכתוב את שם המזון כפי שמופיע ברכיב.'};
    const name=input.name.trim();
    if(!name||name.length>120) return {ok:false,reason:'שם המזון צריך להכיל עד 120 תווים.'};
    const fields=['kcal','protein','carbs','fat','fiber'];
    const food={name};
    for(const key of fields){
      const raw=input[key];
      if(raw===undefined||raw===null||String(raw).trim()==='') return {ok:false,reason:'צריך למלא את כל הערכים התזונתיים ל-100 גרם.'};
      const value=typeof raw==='number'?raw:Number(String(raw).replace(',','.'));
      const max=key==='kcal'?1000:100;
      if(!Number.isFinite(value)||value<0||value>max) return {ok:false,reason:'הערכים צריכים להיות מספרים תקינים ולא שליליים. ערכי חלבון, פחמימות, שומן וסיבים מוגבלים ל-100 גרם ל-100 גרם מזון.'};
      food[key]=value;
    }
    food.id=typeof input.id==='string'&&input.id.length<=180?input.id:`label:${normalizeFoodName(name)}`;
    food.aliases=[name];
    food.sourceLabel='תווית שהוזנה במכשיר';
    food.basis='100 גרם, לפי תווית שהוזנה';
    return {ok:true,food};
  }
  function normalizeCustomNutritionFoods(list){
    if(!Array.isArray(list)) return [];
    const normalized=[],seen=new Set();
    for(const item of list){
      const result=validateCustomNutritionFood(item);
      if(!result.ok) continue;
      const key=normalizeFoodName(result.food.name);
      if(seen.has(key)) continue;
      seen.add(key);normalized.push(result.food);
    }
    return normalized;
  }
  function upsertCustomNutritionFood(list,input,idFactory){
    const current=normalizeCustomNutritionFoods(list);
    const result=validateCustomNutritionFood(input);
    if(!result.ok) return result;
    const key=normalizeFoodName(result.food.name);
    const index=current.findIndex(food=>normalizeFoodName(food.name)===key);
    if(index<0&&current.length>=500) return {ok:false,reason:'נשמרו כבר 500 מזונות מותאמים. אפשר לייצא גיבוי לפני שמפנים מקום.'};
    result.food.id=index>=0?current[index].id:(typeof idFactory==='function'?idFactory():result.food.id);
    const foods=[...current];
    if(index>=0) foods[index]=result.food; else foods.push(result.food);
    return {ok:true,foods,updated:index>=0};
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
  function validateLocalVideoFile(file,maxBytes=100*1024*1024){
    if(!file||typeof file.type!=='string'||!file.type.startsWith('video/')) return {ok:false,reason:'אפשר לבחור קובץ וידאו בלבד.'};
    if(!Number.isFinite(file.size)||file.size<=0) return {ok:false,reason:'קובץ הווידאו ריק או לא תקין.'};
    if(file.size>maxBytes) return {ok:false,reason:'הסרטון גדול מ-100MB. אפשר לבחור סרטון קצר יותר.'};
    return {ok:true};
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
    if(/^(סילאן|סירופ תמרים|date syrup|date molasses|maple syrup|סירופ מייפל|מייפל)$/.test(name)) return {
      ingredient:String(ingredient), options:['סירופ על בסיס אלולוז (לבדיקת תווית המוצר)','ממתיק ללא סוכר יחד עם התאמת הנוזלים במתכון'], recommended:'אין המלצה אחת בטוחה בלי לבדוק את כל המתכון',
      reason:'סילאן ומייפל מוסיפים גם מתיקות וגם נוזלים. החלפה תשפיע על הטעם, הלחות והמרקם, ולכן לא נחליף אותם אוטומטית.',
      limitation:'אלה כיוונים לבדיקה בלבד, לא יחסי החלפה. צריך להתאים לפי הרכיבים ושלבי ההכנה, ואז לאשר את הגרסה. ההעדפה האישית שלך נשמרת בלי לטעון טענה רפואית.'
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
  const AVOIDABLE_INGREDIENTS=[
    {key:'סוכר לבן',pattern:/^(סוכר|סוכר לבן|סוכר רגיל|white sugar|granulated sugar)$/i},
    {key:'קמח לבן',pattern:/^(קמח לבן|קמח רגיל|קמח חיטה לבן|white flour|all-purpose flour)$/i},
    {key:'סילאן',pattern:/^(סילאן|סירופ תמרים|date syrup|date molasses)$/i},
    {key:'מייפל',pattern:/^(מייפל|סירופ מייפל|maple syrup)$/i}
  ];
  function matchAvoidedIngredient(ingredient,preferences=[]){
    const name=String(ingredient||'').trim();
    const selected=new Set(Array.isArray(preferences)?preferences:[]);
    return AVOIDABLE_INGREDIENTS.find(item=>selected.has(item.key)&&item.pattern.test(name))?.key||null;
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
    if(payload.data.profile.customNutritionFoods!==undefined){
      const foods=payload.data.profile.customNutritionFoods;
      if(!Array.isArray(foods)||foods.length>500||foods.some(food=>!validateCustomNutritionFood(food).ok)) return {ok:false,reason:'קובץ הגיבוי מכיל ערכי תזונה מותאמים שאינם תקינים.'};
      const names=foods.map(food=>normalizeFoodName(food.name));
      if(new Set(names).size!==names.length) return {ok:false,reason:'קובץ הגיבוי מכיל שמות מזון כפולים.'};
    }
    return {ok:true,data:payload.data};
  }
  const api={scaleAmount,estimateNutrition,normalizeCustomNutritionFoods,validateCustomNutritionFood,upsertCustomNutritionFood,parseIngredientLines,validateLocalVideoFile,parseTimerVoiceCommand,recommendIngredientAlternatives,matchAvoidedIngredient,appendVersion,formatClock,escapeHTML,createBackup,validateBackup};
  root.MyChefDomain=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(globalThis);
