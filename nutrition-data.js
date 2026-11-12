(function(root){
  // Curated generic foods from USDA FoodData Central (CC0/public domain).
  // Values are per 100 g edible portion; identifiers and source labels are kept for attribution.
  const foods=[
    {id:'fdc-168893',name:'קמח חיטה מלא',aliases:['קמח חיטה מלא','whole wheat flour','wheat flour whole-grain'],basis:'100 גרם, קמח חיטה מלא',kcal:340,protein:13.21,carbs:71.97,fat:2.5,fiber:10.7},
    {id:'fdc-2346396',name:'שיבולת שועל מגולגלת',aliases:['שיבולת שועל','שיבולת שועל מגולגלת','קוואקר','rolled oats','oats whole grain rolled old fashioned'],basis:'100 גרם, שיבולת שועל מגולגלת',kcal:379,protein:13.5,carbs:68.7,fat:5.9,fiber:10.4},
    {id:'fdc-174288',name:'קמח חומוס',aliases:['קמח חומוס','קמח גרגירי חומוס','chickpea flour','gram flour','besan'],basis:'100 גרם, קמח חומוס (besan)',kcal:387,protein:22.39,carbs:57.82,fat:6.69,fiber:10.8},
    {id:'fdc-169593',name:'אבקת קקאו לא ממותקת',aliases:['אבקת קקאו לא ממותקת','cocoa powder unsweetened'],basis:'100 גרם, אבקת קקאו לא ממותקת',kcal:228,protein:19.6,carbs:57.9,fat:13.7,fiber:37},
    {id:'fdc-171287',name:'ביצה שלמה',aliases:['ביצה שלמה','ביצים שלמות','egg whole raw fresh'],basis:'100 גרם, ביצה שלמה טרייה',kcal:143,protein:12.56,carbs:0.72,fat:9.51,fiber:0},
    {id:'ndb-09040',name:'בננה טרייה',aliases:['בננה','בננות','בננה טרייה','banana raw'],basis:'100 גרם חלק אכיל, בננה טרייה',kcal:89,protein:1.09,carbs:22.84,fat:0.33,fiber:2.6},
    {id:'fdc-170567',name:'שקדים טבעיים',aliases:['שקדים טבעיים','שקדים לא קלויים','almonds raw'],basis:'100 גרם, שקדים טבעיים',kcal:579,protein:21.15,carbs:21.55,fat:49.93,fiber:12.5},
    {id:'fdc-169655',name:'סוכר לבן',aliases:['סוכר לבן','סוכר רגיל','white sugar','granulated sugar'],basis:'100 גרם, סוכר לבן מגורען',kcal:387,protein:0,carbs:100,fat:0,fiber:0},
    {id:'ndb-04053',name:'שמן זית',aliases:['שמן זית','olive oil'],basis:'100 גרם, שמן זית',kcal:884,protein:0,carbs:0,fat:100,fiber:0},
    {id:'fdc-173430',name:'חמאה ללא מלח',aliases:['חמאה ללא מלח','unsalted butter'],basis:'100 גרם, חמאה ללא מלח',kcal:717,protein:0.85,carbs:0.06,fat:81.11,fiber:0}
  ];
  root.MyChefNutritionData={version:'USDA FoodData Central SR Legacy/Foundation subset, 2026-11',license:'USDA FoodData Central data are public domain (CC0 1.0)',sourceUrl:'https://fdc.nal.usda.gov/',foods};
})(globalThis);
