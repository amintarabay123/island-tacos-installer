import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders } from "@/lib/auth";
import { ChevronLeft, Printer } from "lucide-react";
import { Link } from "wouter";

// ── Tariff Database (BVI CMDA 2010) ──────────────────────────────────────────
// [hs, description, rateStr, rateType, unit]
type TE = [string, string, string, string, string];
const TARIFF_DB: TE[] = [
  ['0105.11','Live poultry – fowls Gallus domesticus','Free','free','kg'],
  ['0207.10','Whole chicken / poultry – fresh or chilled','Free','free','kg'],
  ['0207.21','Whole frozen chicken (Gallus domesticus)','Free','free','kg'],
  ['0207.22','Whole frozen turkey','Free','free','kg'],
  ['0207.23','Whole frozen ducks / geese / guinea fowls','Free','free','kg'],
  ['0207.411','Frozen chicken backs and necks','Free','free','kg'],
  ['0207.412','Frozen chicken wings','Free','free','kg'],
  ['0207.419','Frozen chicken cuts – breasts, thighs, legs, drumsticks','Free','free','kg'],
  ['0207.421','Frozen turkey backs, necks, wings','Free','free','kg'],
  ['0207.429','Frozen turkey – other cuts','Free','free','kg'],
  ['0207.43','Frozen duck / goose / guinea fowl cuts','Free','free','kg'],
  ['0207.31','Fatty livers of geese or ducks','5%','pct','kg'],
  ['0207.39','Poultry cuts fresh/chilled – other (livers)','5%','pct','kg'],
  ['0207.50','Frozen poultry livers','5%','pct','kg'],
  ['0201','Beef – fresh or chilled (all cuts, ground, minced)','5%','pct','kg'],
  ['0202','Beef – frozen (all cuts, ground, minced)','5%','pct','kg'],
  ['0203','Pork – fresh, chilled or frozen','5%','pct','kg'],
  ['0204','Lamb / mutton – fresh, chilled or frozen','5%','pct','kg'],
  ['0206','Edible offal – bovine, swine, sheep','5%','pct','kg'],
  ['0208','Other meat – rabbit, game, etc.','5%','pct','kg'],
  ['0210.101','Ham – salted or smoked','5%','pct','kg'],
  ['0210.102','Bacon – salted or smoked','5%','pct','kg'],
  ['0210.20','Salted / dried / smoked beef','5%','pct','kg'],
  ['0302','Fish – fresh or chilled (snapper, grouper, mahi, etc.)','15%','pct','kg'],
  ['0303','Fish – frozen (salmon, tuna, tilapia, cod, etc.)','15%','pct','kg'],
  ['0304','Fish fillets – fresh, chilled or frozen','15%','pct','kg'],
  ['0305.30','Fish fillets – dried, salted or in brine','Free','free','kg'],
  ['0305.40','Smoked fish – herrings, cod, mackerel, salmon','Free','free','kg'],
  ['0305.50','Dried fish – cod, mackerel, herrings','Free','free','kg'],
  ['0305.60','Fish salted but not dried or smoked','Free','free','kg'],
  ['0306.002','Shrimps and prawns – frozen','15%','pct','kg'],
  ['0306.003','Lobsters – frozen','15%','pct','kg'],
  ['0306.004','Other crustaceans – frozen','15%','pct','kg'],
  ['0307','Molluscs – squid, octopus, clams, oysters','15%','pct','kg'],
  ['0401','Milk and cream (not concentrated)','5%','pct','kg'],
  ['0402','Milk and cream – concentrated or sweetened (evaporated)','5%','pct','kg'],
  ['0402.991','Condensed milk','5%','pct','kg'],
  ['0403.10','Yogurt','5%','pct','kg'],
  ['0405.002','Butter – fresh','15%','pct','kg'],
  ['0405.003','Butter – salted','15%','pct','kg'],
  ['0405.004','Ghee','15%','pct','kg'],
  ['0406','Cheese and curd (all types)','5%','pct','kg'],
  ['0407','Eggs – in shell','5%','pct','kg'],
  ['0408','Egg yolks / eggs not in shell / frozen egg','5%','pct','kg'],
  ['0409','Natural honey','5%','pct','kg'],
  ['0701','Potatoes – fresh or chilled','5%','pct','kg'],
  ['0702','Tomatoes – fresh or chilled','Free','free','kg'],
  ['0703.101','Onions','5%','pct','kg'],
  ['0703.102','Shallots (eschallots)','5%','pct','kg'],
  ['0703.20','Garlic','5%','pct','kg'],
  ['0703.90','Leeks and other alliaceous vegetables','Free','free','kg'],
  ['0704','Cabbages, cauliflowers, broccoli, kale','Free','free','kg'],
  ['0705','Lettuce / chicory','Free','free','kg'],
  ['0706.001','Carrots – fresh or chilled','Free','free','kg'],
  ['0707','Cucumbers and gherkins','Free','free','kg'],
  ['0708.001','Pigeon peas – fresh','5%','pct','kg'],
  ['0708.002','Blackeye peas – fresh','5%','pct','kg'],
  ['0708.003','String beans / green beans','5%','pct','kg'],
  ['0709.001','Aubergines / eggplant','Free','free','kg'],
  ['0709.003','Ochroes / okra','Free','free','kg'],
  ['0709.004','Pumpkins','Free','free','kg'],
  ['0709.005','Sweet corn (corn on the cob)','5%','pct','kg'],
  ['0709.006','Sweet peppers / bell peppers','Free','free','kg'],
  ['0709.007','Mushrooms and truffles – fresh','Free','free','kg'],
  ['0710','Vegetables – frozen (peas, beans, corn, mixed veg)','5%','pct','kg'],
  ['0712','Dried vegetables – whole, cut, sliced or powdered','5%','pct','kg'],
  ['0713.001','Red kidney beans – dried','5%','pct','kg'],
  ['0713.002','Other beans dried – black, pinto, navy, etc.','5%','pct','kg'],
  ['0713.006','Chickpeas (garbanzos) – dried','5%','pct','kg'],
  ['0713.004','Split peas – dried','5%','pct','kg'],
  ['0713.005','Blackeye peas – dried','5%','pct','kg'],
  ['0714.10','Manioc / cassava','Free','free','kg'],
  ['0714.20','Sweet potatoes','Free','free','kg'],
  ['0714.904','Yams','Free','free','kg'],
  ['0714.902','Dasheens / taro','Free','free','kg'],
  ['0801.10','Coconuts','5%','pct','kg'],
  ['0801.30','Cashew nuts','10%','pct','kg'],
  ['0802.10','Almonds','10%','pct','kg'],
  ['0802.30','Walnuts','10%','pct','kg'],
  ['0802.90','Other nuts (pecans, peanuts, etc.)','10%','pct','kg'],
  ['0803','Bananas / plantains – fresh or dried','5%','pct','kg'],
  ['0804.40','Avocados','5%','pct','kg'],
  ['0804.502','Mangoes','5%','pct','kg'],
  ['0805.10','Oranges','5%','pct','kg'],
  ['0805.302','Limes','5%','pct','kg'],
  ['0805.40','Grapefruit','5%','pct','kg'],
  ['0807.10','Melons / watermelons','5%','pct','kg'],
  ['0807.20','Papaws / papayas','5%','pct','kg'],
  ['0808.10','Apples','5%','pct','kg'],
  ['0809','Apricots, cherries, peaches, plums','5%','pct','kg'],
  ['0810','Berries, breadfruit, soursop, passion fruit','5%','pct','kg'],
  ['0901.10','Coffee beans – not roasted','10%','pct','kg'],
  ['0901.20','Coffee – roasted (whole bean or ground)','10%','pct','kg'],
  ['0902','Tea','10%','pct','kg'],
  ['0904.10','Pepper (black, white)','10%','pct','kg'],
  ['0904.201','Paprika','10%','pct','kg'],
  ['0905','Vanilla','10%','pct','kg'],
  ['0906','Cinnamon','10%','pct','kg'],
  ['0907','Cloves','10%','pct','kg'],
  ['0908.10','Nutmeg','10%','pct','kg'],
  ['0908.20','Mace','10%','pct','kg'],
  ['0909','Anise, coriander, cumin, caraway, fennel seeds','10%','pct','kg'],
  ['0910.10','Ginger','10%','pct','kg'],
  ['0910.50','Curry powder','10%','pct','kg'],
  ['0910.99','Mixed spices – other','10%','pct','kg'],
  ['1001','Wheat / meslin','Free','free','kg'],
  ['1003','Barley','Free','free','kg'],
  ['1004','Oats','Free','free','kg'],
  ['1005','Maize (corn) – grain','Free','free','kg'],
  ['1006','Rice – all types (white, brown, parboiled, broken)','Free','free','kg'],
  ['1101','Wheat flour / all-purpose flour / bread flour','Free','free','kg'],
  ['1102.20','Maize (corn) flour / cornmeal','Free','free','kg'],
  ['1102.30','Rice flour','Free','free','kg'],
  ['1103','Cereal groats and meals (oat groats, grits, etc.)','Free','free','kg'],
  ['1104','Rolled / flaked grains – oatmeal, rolled oats','Free','free','kg'],
  ['1105','Potato flour, meal and flakes','Free','free','kg'],
  ['1106.201','Manioc / cassava flour','Free','free','kg'],
  ['1106.301','Banana flour','Free','free','kg'],
  ['1507','Soya-bean oil','10%','pct','litre'],
  ['1508','Ground-nut (peanut) oil','10%','pct','litre'],
  ['1509','Olive oil (all grades, extra virgin)','10%','pct','litre'],
  ['1511','Palm oil','10%','pct','litre'],
  ['1512.11','Sunflower oil / safflower oil','10%','pct','litre'],
  ['1513.11','Coconut (copra) oil','10%','pct','litre'],
  ['1514','Rapeseed / canola / mustard oil','10%','pct','litre'],
  ['1515.20','Corn (maize) oil','10%','pct','litre'],
  ['1515.50','Sesame oil','10%','pct','litre'],
  ['1517.10','Margarine (solid)','5%','pct','kg'],
  ['1517.901','Shortening / imitation lard','5%','pct','kg'],
  ['1601.001','Chicken sausages – canned','5%','pct','kg'],
  ['1601.009','Other sausages (pork, beef, etc.)','5%','pct','kg'],
  ['1602.39','Canned / prepared poultry (chicken)','5%','pct','kg'],
  ['1602.401','Ham – canned or prepared','5%','pct','kg'],
  ['1602.402','Bacon – canned or prepared','5%','pct','kg'],
  ['1602.403','Luncheon meat (Spam, etc.)','5%','pct','kg'],
  ['1602.501','Corned beef – canned','5%','pct','kg'],
  ['1701.11','Raw cane sugar','Free','free','kg'],
  ['1701.999','White sugar (granulated, table sugar)','Free','free','kg'],
  ['1701.991','Icing sugar / powdered sugar','Free','free','kg'],
  ['1702.001','Glucose / dextrose / lactose / maltose','15%','pct','kg'],
  ['1702.003','Cane sugar syrup','15%','pct','litre'],
  ['1702.009','Other sugars including invert sugar / brown sugar','15%','pct','kg'],
  ['1704.10','Chewing gum','15%','pct','kg'],
  ['1805','Cocoa powder – unsweetened','5%','pct','kg'],
  ['1806','Chocolate, chocolate bars, cocoa preparations','15%','pct','kg'],
  ['1901.90','Malt extract / flour mixes / food preparations NES','10%','pct','kg'],
  ['1902.001','Uncooked pasta – spaghetti, penne, fettuccine, etc.','5%','pct','kg'],
  ['1902.009','Other pasta – noodles, lasagne, macaroni, etc.','5%','pct','kg'],
  ['1904.10','Breakfast cereals – corn flakes, granola, etc.','10%','pct','kg'],
  ['1905','Bread, pastry, biscuits, wafers, crackers, tortillas','10%','pct','kg'],
  ['2002.101','Canned tomatoes – whole or crushed (diced)','5%','pct','kg'],
  ['2002.901','Tomato paste – bulk pack (commercial)','5%','pct','kg'],
  ['2002.902','Tomato paste – retail can / tube','5%','pct','kg'],
  ['2004.109','Frozen potato products – retail (french fries, etc.)','5%','pct','kg'],
  ['2005.201','Canned / preserved potatoes – commercial bulk','15%','pct','kg'],
  ['2005.501','Canned beans – commercial bulk','5%','pct','kg'],
  ['2005.509','Canned beans (black, red, mixed) – retail','5%','pct','kg'],
  ['2005.809','Canned sweet corn – retail','5%','pct','kg'],
  ['2005.909','Other canned / preserved vegetables','5%','pct','kg'],
  ['2008.003','Peanut butter','15%','pct','kg'],
  ['2009.102','Orange juice – not concentrated (retail)','10%','pct','litre'],
  ['2009.509','Tomato juice','10%','pct','litre'],
  ['2009.909','Mixed fruit juice / fruit drink','10%','pct','litre'],
  ['2101.10','Instant coffee / coffee extracts and concentrates','10%','pct','kg'],
  ['2101.20','Tea extracts / concentrates / iced tea mix','10%','pct','kg'],
  ['2102.30','Baking powder','10%','pct','kg'],
  ['2103.10','Soya sauce (soy sauce)','5%','pct','kg'],
  ['2103.201','Tomato ketchup / catsup','10%','pct','kg'],
  ['2103.202','Other tomato sauces (pizza sauce, marinara)','5%','pct','kg'],
  ['2103.302','Prepared mustard','10%','pct','kg'],
  ['2103.901','Pepper sauce / hot sauce (Crystal, Tabasco, etc.)','10%','pct','kg'],
  ['2103.902','Mayonnaise','10%','pct','kg'],
  ['2103.909','Other sauces and condiments (BBQ, Worcestershire, etc.)','10%','pct','kg'],
  ['2104.101','Soups and broths – liquid form','5%','pct','kg'],
  ['2104.102','Soups and broths – powder / cube / solid form','5%','pct','kg'],
  ['2105','Ice cream and edible ices','15%','pct','kg'],
  ['2106.009','Food preparations not elsewhere specified','5%','pct','kg'],
  ['2201.101','Mineral water (still)','Free','free','litre'],
  ['2201.102','Aerated / sparkling water (plain)','15%','pct','litre'],
  ['2202.101','Aerated beverages – sodas, soft drinks (Coke, Sprite)','15%','pct','litre'],
  ['2202.902','Malt beverages – non-alcoholic','15%','pct','litre'],
  ['2203.001','Beer (lager, ale, etc.)','$1.10 per gal','gal','per gallon'],
  ['2203.002','Stout (Guinness, etc.)','$1.10 per gal','gal','per gallon'],
  ['2204.10','Sparkling wine / champagne / prosecco','$1.20 per gal','gal','per gallon'],
  ['2204.209','Still wine – red, white or rosé','$1.20 per gal','gal','per gallon'],
  ['2205','Vermouth and flavoured wines','$1.20 per gal','gal','per gallon'],
  ['2206','Cider, perry, mead, other fermented beverages','$0.90 per gal','gal','per gallon'],
  ['2208.201','Brandy (≤46% vol, bottled)','$3.00 per gal','gal','per gallon'],
  ['2208.301','Whisky / whiskey (≤46% vol, bottled)','$3.00 per gal','gal','per gallon'],
  ['2208.401','Rum (≤46% vol, bottled)','$2.30 per gal','gal','per gallon'],
  ['2208.409','Rum – other / bulk','$2.30 per gal','gal','per gallon'],
  ['2208.501','Gin (≤46% vol, bottled)','$2.30 per gal','gal','per gallon'],
  ['2208.901','Vodka','$2.30 per gal','gal','per gallon'],
  ['2208.902','Cordials and liqueurs (Triple Sec, Kahlua, etc.)','$2.30 per gal','gal','per gallon'],
  ['2208.909','Other spirits (tequila, mezcal, absinthe, etc.)','$3.00 per gal','gal','per gallon'],
  ['2402.20','Cigarettes containing tobacco','$0.55 per lb','lb','per lb'],
  ['2402.10','Cigars, cheroots and cigarillos','$0.55 per lb','lb','per lb'],
  ['2401','Unmanufactured tobacco / tobacco refuse','$0.50 per lb','lb','per lb'],
  ['8418.211','Household refrigerator – electrical (frost free)','15%','pct','No'],
  ['8418.30','Chest freezer – commercial or household','15%','pct','No'],
  ['8418.40','Upright freezer – commercial or household','15%','pct','No'],
  ['8418.50','Commercial refrigerating / freezing equipment','15%','pct','No'],
  ['8516','Electric stoves, ovens, hotplates, microwaves, toasters','20%','pct','No'],
  ['8422','Dishwashers','20%','pct','No'],
  ['8541.40','Solar panels / photovoltaic cells','Free','free','No'],
  ['8504','Solar inverters / charge controllers','Free','free','No'],
];

// ── Aliases for auto-suggest ──────────────────────────────────────────────────
const ALIASES: Record<string, string> = {
  'chicken breast':'0207.419','chicken thigh':'0207.419','chicken leg':'0207.419','drumstick':'0207.419',
  'chicken wing':'0207.412','wings':'0207.412','frozen chicken':'0207.21','whole chicken':'0207.21',
  'whole bird':'0207.21','chicken parts':'0207.419','chicken quarters':'0207.419',
  'ground beef':'0202','minced beef':'0202','burger':'0202','beef':'0202','steak':'0202',
  'pork':'0203','fish fillet':'0304','fish':'0303','salmon':'0303','tilapia':'0304','cod':'0303',
  'shrimp':'0306.002','prawn':'0306.002','lobster':'0306.003','seafood':'0306.004',
  'cooking oil':'1512.11','vegetable oil':'1512.11','canola':'1514','olive oil':'1509',
  'coconut oil':'1513.11','corn oil':'1515.20','sesame oil':'1515.50',
  'white rice':'1006','rice':'1006','parboiled':'1006','brown rice':'1006',
  'flour':'1101','wheat flour':'1101','all purpose flour':'1101','bread flour':'1101',
  'cornmeal':'1102.20','masa':'1102.20','corn flour':'1102.20',
  'sugar':'1701.999','raw sugar':'1701.11','icing sugar':'1701.991','powdered sugar':'1701.991',
  'brown sugar':'1702.009',
  'tomato paste':'2002.901','tomato sauce':'2103.202','diced tomatoes':'2002.101',
  'canned tomatoes':'2002.101','ketchup':'2103.201','hot sauce':'2103.901',
  'pepper sauce':'2103.901','soy sauce':'2103.10','soya sauce':'2103.10',
  'mayonnaise':'2103.902','mayo':'2103.902','mustard':'2103.302',
  'bbq sauce':'2103.909','worcestershire':'2103.909','condiment':'2103.909',
  'beer':'2203.001','stout':'2203.002','wine':'2204.209','red wine':'2204.209',
  'white wine':'2204.209','champagne':'2204.10','prosecco':'2204.10',
  'rum':'2208.401','vodka':'2208.901','whisky':'2208.301','whiskey':'2208.301',
  'gin':'2208.501','brandy':'2208.201','tequila':'2208.909','mezcal':'2208.909',
  'liqueur':'2208.902','cordial':'2208.902','spirits':'2208.909','alcohol':'2208.909',
  'soda':'2202.101','soft drink':'2202.101','cola':'2202.101',
  'juice':'2009.909','orange juice':'2009.102','mineral water':'2201.101',
  'sparkling water':'2201.102','water':'2201.101',
  'cigarette':'2402.20','tobacco':'2401','cigar':'2402.10',
  'pasta':'1902.001','spaghetti':'1902.001','penne':'1902.001','noodle':'1902.009',
  'macaroni':'1902.009','lasagne':'1902.009',
  'breakfast cereal':'1904.10','corn flakes':'1904.10','granola':'1904.10',
  'oatmeal':'1104','rolled oats':'1104','oats':'1004',
  'margarine':'1517.10','butter':'0405.002','ghee':'0405.004','shortening':'1517.901',
  'egg':'0407','eggs':'0407','cheese':'0406','milk':'0401','yogurt':'0403.10',
  'evaporated milk':'0402','condensed milk':'0402.991','honey':'0409',
  'coffee':'0901.20','ground coffee':'0901.20','coffee beans':'0901.10',
  'instant coffee':'2101.10','tea':'0902',
  'pepper':'0904.10','black pepper':'0904.10','cinnamon':'0906','nutmeg':'0908.10',
  'ginger':'0910.10','vanilla':'0905','curry':'0910.50','cloves':'0907',
  'spice':'0910.99','seasoning':'0910.99','mixed spice':'0910.99',
  'onion':'0703.101','garlic':'0703.20','tomato':'0702','lettuce':'0705',
  'carrot':'0706.001','cabbage':'0704','broccoli':'0704','potato':'0701',
  'french fries':'2004.109','frozen fries':'2004.109','frozen potato':'2004.109',
  'sweet potato':'0714.20','yam':'0714.904','plantain':'0803','banana':'0803',
  'avocado':'0804.40','mango':'0804.502','apple':'0808.10',
  'orange':'0805.10','lime':'0805.302','lemon':'0805.302',
  'bread':'1905','biscuit':'1905','cracker':'1905','tortilla':'1905','pita':'1905',
  'chocolate':'1806','cocoa':'1805','ice cream':'2105',
  'canned beans':'2005.509','kidney beans':'0713.001','chickpeas':'0713.006',
  'split peas':'0713.004','blackeye peas':'0713.005',
  'peanut butter':'2008.003','nuts':'0802.90','cashew':'0801.30',
  'baking powder':'2102.30',
  'soup':'2104.101','broth':'2104.101','bouillon':'2104.102','stock':'2104.102',
  'luncheon meat':'1602.403','spam':'1602.403','corned beef':'1602.501',
  'bacon':'1602.402','ham':'1602.401','sausage':'1601.009',
  'freezer':'8418.40','refrigerator':'8418.211','fridge':'8418.211',
  'chest freezer':'8418.30','upright freezer':'8418.40','commercial fridge':'8418.50',
  'microwave':'8516','oven':'8516','stove':'8516','hotplate':'8516','grill':'8516',
  'dishwasher':'8422','solar panel':'8541.40','solar':'8541.40','inverter':'8504',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScanRow { id: number; desc: string; hs: string; qty: string; wt: string; fob: string; origin: string; }
interface FormRecord {
  id: number; cpc: string; hs: string; origin: string; pkgs: string; desc: string;
  wt: string; qty: string; fob: string; cif: string; taxCif: string; rate: string;
  wharfFob: string; additionalInfo: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = new Date().toISOString().split('T')[0];

function searchTariff(q: string): TE[] {
  if (!q || q.trim().length < 2) return [];
  const ql = q.toLowerCase().trim();
  for (const [kw, hs] of Object.entries(ALIASES)) {
    if (ql === kw || ql.includes(kw) || kw.includes(ql)) {
      const match = TARIFF_DB.find(r => r[0] === hs);
      if (match) return [match, ...TARIFF_DB.filter(r => r[0] !== hs && (r[0].toLowerCase().includes(ql) || r[1].toLowerCase().includes(ql))).slice(0, 8)];
    }
  }
  return TARIFF_DB.filter(r => r[0].toLowerCase().includes(ql) || r[1].toLowerCase().includes(ql)).slice(0, 20);
}

function getBestTariff(desc: string): TE | null {
  if (!desc) return null;
  const d = desc.toLowerCase();
  for (const [kw, hs] of Object.entries(ALIASES)) {
    if (d.includes(kw)) { const m = TARIFF_DB.find(r => r[0] === hs); if (m) return m; }
  }
  const words = d.split(/[\s,/\-]+/).filter(w => w.length > 3);
  for (const w of words) { const h = TARIFF_DB.find(r => r[1].toLowerCase().includes(w)); if (h) return h; }
  return null;
}

function rateClass(r: string): 'free' | 'low' | 'mid' | 'high' | 'def' {
  if (!r || r === 'Free') return 'free';
  if (r.includes('$')) return 'mid';
  const n = parseFloat(r);
  if (n <= 5) return 'low';
  if (n <= 10) return 'mid';
  return 'high';
}

const RC: Record<string, { bg: string; color: string; border: string }> = {
  free: { bg: 'rgba(16,185,129,.15)', color: '#10b981', border: 'rgba(16,185,129,.3)' },
  low:  { bg: 'rgba(59,130,246,.12)', color: '#3b82f6', border: 'rgba(59,130,246,.3)' },
  mid:  { bg: 'rgba(245,158,11,.12)', color: '#f59e0b', border: 'rgba(245,158,11,.3)' },
  high: { bg: 'rgba(239,68,68,.12)',  color: '#ef4444', border: 'rgba(239,68,68,.3)' },
  def:  { bg: '#1e243a', color: '#64748b', border: '#2a3050' },
};

function computeDuty(rate: string, cif: number): number {
  if (!rate || rate === 'Free' || rate === '—') return 0;
  if (rate.endsWith('%')) return (cif * parseFloat(rate)) / 100;
  return 0;
}

function mkRec(id: number, d: Partial<FormRecord> = {}): FormRecord {
  return { id, cpc: 'C400', hs: '', origin: 'US', pkgs: '', desc: '', wt: '', qty: '', fob: '', cif: '', taxCif: '', rate: '', wharfFob: '', additionalInfo: '', ...d };
}

// ── Shared input style ────────────────────────────────────────────────────────
const IS: React.CSSProperties = { background:'#1e243a', border:'1px solid #2a3050', color:'#e2e8f0', padding:'8px 10px', borderRadius:6, fontSize:13, fontFamily:'inherit', width:'100%', outline:'none' };
const LS: React.CSSProperties = { fontSize:11, fontFamily:'monospace', color:'#64748b', letterSpacing:'.5px', textTransform:'uppercase', marginBottom:5, display:'block' };
const CS: React.CSSProperties = { background:'#161b27', border:'1px solid #2a3050', borderRadius:10, padding:20, marginBottom:16 };
const CT: React.CSSProperties = { fontSize:11, fontFamily:'monospace', color:'#3b82f6', letterSpacing:1, textTransform:'uppercase', marginBottom:14, paddingBottom:10, borderBottom:'1px solid #2a3050' };

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminCustoms() {
  const [tab, setTab] = useState<'scan' | 'form' | 'lookup'>('scan');

  // ── Scan state ────────────────────────────────────────────────────────────
  const [scanPreview, setScanPreview] = useState<{ type: 'image'; src: string } | { type: 'pdf'; text: string } | null>(null);
  const [scanRows, setScanRows] = useState<ScanRow[]>([]);
  const [scanFreight, setScanFreight] = useState('0');
  const [scanInsurance, setScanInsurance] = useState('0');
  const [scanPkgCount, setScanPkgCount] = useState('1');
  const [scanVisible, setScanVisible] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [nextScanId, setNextScanId] = useState(1);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [fType, setFType] = useState('IMPORT');
  const [fRef, setFRef] = useState('');
  const [fPage, setFPage] = useState('1/1');
  const [fRelTD, setFRelTD] = useState('');
  const [fSuppName, setFSuppName] = useState('Sysco Puerto Rico');
  const [fSuppStreet, setFSuppStreet] = useState('');
  const [fSuppCity, setFSuppCity] = useState('San Juan, PR');
  const [fSuppZip, setFSuppZip] = useState('');
  const [fSuppCountry, setFSuppCountry] = useState('United States of America');
  const [fImpName, setFImpName] = useState('Island Tacos');
  const [fImpId, setFImpId] = useState('113917');
  const [fImpStreet, setFImpStreet] = useState('PO Box 643');
  const [fImpTown, setFImpTown] = useState('Road Town, Tortola');
  const [fCarrierId, setFCarrierId] = useState('ADP/273');
  const [fPort, setFPort] = useState('PP');
  const [fArrival, setFArrival] = useState(todayStr);
  const [fManifest, setFManifest] = useState('273');
  const [fBol, setFBol] = useState('ISA31C');
  const [fContainer, setFContainer] = useState('');
  const [fPkgCount, setFPkgCount] = useState('1');
  const [fShipCity, setFShipCity] = useState('');
  const [fShipCountry, setFShipCountry] = useState('United States of America');
  const [fOrigCountry, setFOrigCountry] = useState('United States of America');
  const [fFreight, setFFreight] = useState('0');
  const [fInsurance, setFInsurance] = useState('0');
  const [fAlcohol, setFAlcohol] = useState('0');
  const [fFossil, setFFossil] = useState('0');
  const [fDeclName, setFDeclName] = useState('Island Tacos');
  const [fDeclId, setFDeclId] = useState('100494');
  const [fDeclDate, setFDeclDate] = useState(todayStr);
  const [formRecords, setFormRecords] = useState<FormRecord[]>([]);
  const [nextRecId, setNextRecId] = useState(1);
  const [formOutput, setFormOutput] = useState('');

  // ── Lookup state ──────────────────────────────────────────────────────────
  const [lookupQ, setLookupQ] = useState('');

  // ── Load PDF.js from CDN ──────────────────────────────────────────────────
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = (window as any)['pdfjs-dist/build/pdf'];
      if (lib) lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  // ── Scan computed ─────────────────────────────────────────────────────────
  const sfN = parseFloat(scanFreight) || 0;
  const siN = parseFloat(scanInsurance) || 0;
  const perRow = scanRows.length > 0 ? (sfN + siN) / scanRows.length : 0;
  const scanTotals = useMemo(() => {
    let fobT = 0, dutyT = 0;
    for (const row of scanRows) {
      const fob = parseFloat(row.fob) || 0;
      const tariff = TARIFF_DB.find(r => r[0] === row.hs);
      dutyT += computeDuty(tariff ? tariff[2] : '', fob + (scanRows.length > 0 ? (sfN + siN) / scanRows.length : 0));
      fobT += fob;
    }
    const cifT = fobT + sfN + siN;
    return { fobT, cifT, dutyT, wharf: fobT * 0.01, total: dutyT + fobT * 0.01 };
  }, [scanRows, sfN, siN]);

  // ── Form computed ─────────────────────────────────────────────────────────
  const formTotals = useMemo(() => {
    let d = 0, w = 0;
    for (const r of formRecords) {
      d += computeDuty(r.rate, parseFloat(r.taxCif) || parseFloat(r.cif) || 0);
      w += (parseFloat(r.wharfFob) || parseFloat(r.fob) || 0) * 0.01;
    }
    return { d, w, total: d + w };
  }, [formRecords]);

  // ── Lookup computed ───────────────────────────────────────────────────────
  const lookupResults = useMemo(() => searchTariff(lookupQ), [lookupQ]);

  // ── Scan handlers ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) { alert('Please upload a JPG, PNG, or PDF file.'); return; }

    // Show preview immediately
    setScanVisible(true);
    setExtracting(true);
    setExtractError(null);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => setScanPreview({ type: 'image', src: e.target?.result as string });
      reader.readAsDataURL(file);
    } else {
      setScanPreview({ type: 'pdf', text: 'Extracting PDF text…' });
    }

    try {
      let body: { type: 'image' | 'text'; data: string; mime?: string };

      if (isImage) {
        // Convert to base64
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        body = { type: 'image', data: dataUrl.split(',')[1], mime: file.type };
      } else {
        // PDF: extract text with PDF.js
        const lib = (window as any)['pdfjs-dist/build/pdf'];
        if (!lib) throw new Error('PDF.js not loaded yet — please wait a moment and try again');
        const url = URL.createObjectURL(file);
        const pdf = await lib.getDocument(url).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
        URL.revokeObjectURL(url);
        setScanPreview({ type: 'pdf', text: text.slice(0, 4000) + (text.length > 4000 ? '\n\n[…truncated]' : '') });
        body = { type: 'text', data: text };
      }

      const resp = await fetch('/api/customs/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || `Server error ${resp.status}`);
      }

      const result = await resp.json();
      applyExtractResult(result);

    } catch (err) {
      console.error('Invoice extraction failed:', err);
      setExtractError(`Could not auto-extract: ${String(err)}. Please add items manually.`);
      setScanRows(prev => prev.length === 0 ? [{ id: 1, desc: '', hs: '', qty: '', wt: '', fob: '', origin: 'US' }] : prev);
      setNextScanId(2);
    } finally {
      setExtracting(false);
    }
  }, []);

  function applyExtractResult(result: any) {
    // Auto-fill supplier details into Form tab
    const s = result.supplier || {};
    if (s.name)    setFSuppName(s.name);
    if (s.street)  setFSuppStreet(s.street);
    if (s.city)    setFSuppCity(s.city);
    if (s.zip)     setFSuppZip(s.zip);
    if (s.country) setFSuppCountry(s.country);
    if (result.invoiceRef) setFRef(result.invoiceRef);
    if (result.freight && parseFloat(result.freight) > 0)   setScanFreight(result.freight);
    if (result.insurance && parseFloat(result.insurance) > 0) setScanInsurance(result.insurance);

    // Build scan rows from extracted items
    const items: any[] = result.items || [];
    if (items.length > 0) {
      let idC = 1;
      const rows: ScanRow[] = items.map(item => {
        const tariff = getBestTariff(item.desc || '');
        return {
          id: idC++,
          desc: item.desc || '',
          hs: tariff ? tariff[0] : '',
          qty: item.qty || '',
          wt: item.wt || '',
          fob: item.fob || '',
          origin: 'US',
        };
      });
      setScanRows(rows);
      setNextScanId(items.length + 1);
    } else {
      setScanRows([{ id: 1, desc: '', hs: '', qty: '', wt: '', fob: '', origin: 'US' }]);
      setNextScanId(2);
      setExtractError('No line items found. Please add them manually.');
    }
  }

  function addScanRow() { setScanRows(prev => [...prev, { id: nextScanId, desc: '', hs: '', qty: '', wt: '', fob: '', origin: 'US' }]); setNextScanId(n => n + 1); }

  function updateScanRow(id: number, field: keyof ScanRow, value: string) {
    setScanRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const upd = { ...r, [field]: value };
      if (field === 'desc' && !r.hs) { const t = getBestTariff(value); if (t) upd.hs = t[0]; }
      return upd;
    }));
  }

  function sendToForm() {
    const fN = parseFloat(scanFreight) || 0, iN = parseFloat(scanInsurance) || 0;
    const pr = scanRows.length > 0 ? (fN + iN) / scanRows.length : 0;
    let id = nextRecId;
    const recs: FormRecord[] = scanRows.map(row => {
      const fob = parseFloat(row.fob) || 0, cif = fob + pr;
      const tariff = TARIFF_DB.find(r => r[0] === row.hs);
      const rate = tariff ? tariff[2] : '';
      return mkRec(id++, { hs: row.hs, origin: row.origin, pkgs: row.qty, desc: row.desc, wt: row.wt, qty: row.qty, fob: fob.toFixed(2), cif: cif.toFixed(2), taxCif: cif.toFixed(2), rate, wharfFob: fob.toFixed(2) });
    });
    setFormRecords(recs); setNextRecId(id); setFFreight(scanFreight); setFInsurance(scanInsurance); setFPkgCount(scanPkgCount);
    setTab('form');
  }

  function clearScan() { setScanPreview(null); setScanRows([]); setScanVisible(false); setScanFreight('0'); setScanInsurance('0'); setExtracting(false); setExtractError(null); if (fileRef.current) fileRef.current.value = ''; }

  // ── Form handlers ─────────────────────────────────────────────────────────
  function addFormRecord(d: Partial<FormRecord> = {}) { setFormRecords(prev => [...prev, mkRec(nextRecId, d)]); setNextRecId(n => n + 1); }
  function removeFormRecord(id: number) { setFormRecords(prev => prev.filter(r => r.id !== id)); }
  function updateRec(id: number, updates: Partial<FormRecord>) {
    setFormRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const upd = { ...r, ...updates };
      if ('hs' in updates) { const t = TARIFF_DB.find(e => e[0] === (updates.hs ?? '').trim()); if (t) upd.rate = t[2]; }
      return upd;
    }));
  }

  function generateOutput() {
    const today = new Date().toLocaleDateString('en-GB');
    let out = 'H.M. CUSTOMS TRADE DECLARATION (HMC-12)\n' + '═'.repeat(62) + '\n';
    out += `TYPE: ${fType}   REF: ${fRef}   PAGE: ${fPage}\n\n`;
    out += `1. SUPPLIER\n   ${fSuppName}, ${fSuppStreet}, ${fSuppCity} ${fSuppZip}, ${fSuppCountry}\n\n`;
    out += `2. IMPORTER   ID: ${fImpId}\n   ${fImpName}, ${fImpStreet}, ${fImpTown}\n\n`;
    out += `3. TRANSPORT\n   Carrier: ${fCarrierId}   Port: ${fPort}   Arrival: ${fArrival}\n   Manifest: ${fManifest}   BOL/AWB: ${fBol}   Packages: ${fPkgCount}\n\n`;
    out += `5. SHIPMENT   From: ${fShipCity}, ${fShipCountry}\n\n`;
    out += `7. TOTAL RECORDS: ${formRecords.length}\n8. FREIGHT: $${fFreight}\n9. INSURANCE: $${fInsurance}\n\n`;
    formRecords.forEach((r, i) => {
      const taxCif = parseFloat(r.taxCif) || parseFloat(r.cif) || 0;
      const wf = parseFloat(r.wharfFob) || parseFloat(r.fob) || 0;
      const duty = computeDuty(r.rate, taxCif), wharf = wf * 0.01;
      out += `${'─'.repeat(62)}\nRECORD ${String(i + 1).padStart(3, '0')}\n`;
      out += `  12 CPC: ${r.cpc}   13 Tariff: ${r.hs}   14 Origin: ${r.origin}\n`;
      out += `  15 Packages: ${r.pkgs}\n  16 Description: ${r.desc}\n  17 Net Wt: ${r.wt} lb\n`;
      out += `  18 FOB: $${r.fob}   20 CIF: $${r.cif}\n`;
      out += `  21  01/42 CIF $${String(taxCif.toFixed(2)).padEnd(12)} ${String(r.rate).padEnd(8)} $${duty.toFixed(2)}\n`;
      out += `       03/25 FOB $${String(wf.toFixed(2)).padEnd(12)} 1%       $${wharf.toFixed(2)}\n`;
      out += `  Record Total: $${(duty + wharf).toFixed(2)}\n`;
    });
    out += `${'═'.repeat(62)}\n10. TOTAL DUTY: $${formTotals.d.toFixed(2)}\n    WHARFAGE:  $${formTotals.w.toFixed(2)}\n    TOTAL DUE: $${formTotals.total.toFixed(2)}\n\n`;
    out += `DECLARANT: ${fDeclName}   ID: ${fDeclId}   DATE: ${fDeclDate || today}\n`;
    out += `I/We declare that the above particulars are true and correct.\n`;
    out += `SIGNATURE: ___________________________   DATE: ___________\n`;
    setFormOutput(out);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:'#0d1117', color:'#e2e8f0', minHeight:'100vh', fontFamily:"'IBM Plex Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        @media print { .no-print{display:none!important;} body{background:#fff;color:#000;} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .hmc-inp:focus { border-color:#3b82f6 !important; }
        .hmc-row:hover { background:rgba(255,255,255,.025); }
        .hmc-lkrow:hover { background:#1e243a !important; }
        .hmc-tab-btn:hover { color:#e2e8f0; }
        .hmc-dz:hover { border-color:#3b82f6 !important; background:rgba(59,130,246,.04) !important; }
        .hmc-addrow:hover { border-color:#3b82f6 !important; color:#3b82f6 !important; }
        .hmc-del:hover { background:rgba(239,68,68,.15); }
      `}</style>

      {/* ── Header ── */}
      <header className="no-print" style={{ background:'#161b27', borderBottom:'1px solid #2a3050', padding:'14px 24px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <Link href={adminRoutes.dashboard}>
          <button style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontFamily:'inherit' }}>
            <ChevronLeft style={{ width:16, height:16 }} /> Back
          </button>
        </Link>
        <span style={{ fontFamily:'monospace', fontSize:10, color:'#3b82f6', letterSpacing:3, textTransform:'uppercase', background:'rgba(59,130,246,.1)', padding:'4px 10px', borderRadius:4, border:'1px solid rgba(59,130,246,.3)' }}>BVI · CUSTOMS</span>
        <h1 style={{ fontSize:15, fontWeight:600, flex:1, margin:0 }}>HMC-12 Trade Declaration Generator</h1>
        <span style={{ background:'#10b981', color:'#fff', fontSize:10, padding:'2px 8px', borderRadius:20, fontFamily:'monospace' }}>ISLAND TACOS</span>
        <button onClick={() => window.print()} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid #2a3050', background:'none', color:'#94a3b8', fontFamily:'inherit' }}>
          <Printer style={{ width:14, height:14 }} /> Print / PDF
        </button>
      </header>

      {/* ── Tabs ── */}
      <div className="no-print" style={{ display:'flex', background:'#161b27', borderBottom:'1px solid #2a3050', padding:'0 24px', gap:4, overflowX:'auto' }}>
        {(['scan','📄 Invoice Scanner'],['form','📋 Declaration Form'],['lookup','🔍 Tariff Lookup']).length && (
          [['scan','📄 Invoice Scanner'],['form','📋 Declaration Form'],['lookup','🔍 Tariff Lookup']] as [string,string][]
        ).map(([id,label]) => (
          <button key={id} className="hmc-tab-btn" onClick={() => setTab(id as 'scan'|'form'|'lookup')}
            style={{ padding:'13px 18px', fontSize:13, fontWeight:600, cursor:'pointer', color: tab===id ? '#3b82f6' : '#64748b', background:'none', border:'none', borderBottom: tab===id ? '2px solid #3b82f6' : '2px solid transparent', whiteSpace:'nowrap', fontFamily:'inherit', transition:'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ════════ SCAN TAB ════════ */}
      {tab === 'scan' && (
        <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
          <div style={{ background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.3)', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#3b82f6', marginBottom:14 }}>
            Upload your supplier invoice (JPG, PNG, or PDF). For images the tool shows a preview and lets you enter items manually. For text PDFs, it auto-extracts line items and looks up tariff numbers.
          </div>

          {/* Drop zone */}
          <div className="hmc-dz" onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ border:`2px dashed ${dragOver?'#3b82f6':'#2a3050'}`, borderRadius:10, padding:40, textAlign:'center', cursor:'pointer', background: dragOver?'rgba(59,130,246,.04)':'#161b27', marginBottom:16, transition:'all .2s' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
            <h3 style={{ fontSize:14, marginBottom:6 }}>Drop invoice here or click to upload</h3>
            <p style={{ fontSize:12, color:'#64748b' }}>JPG · PNG · PDF &nbsp;|&nbsp; max 20 MB</p>
          </div>
          <input type="file" ref={fileRef} accept=".jpg,.jpeg,.png,.pdf,.webp" style={{ display:'none' }} onChange={e => handleFile(e.target.files?.[0] ?? null)} />

          {/* Preview */}
          {scanPreview && (
            <div style={CS}>
              <div style={CT}>Invoice Preview</div>
              {scanPreview.type === 'image' && <img src={scanPreview.src} style={{ maxWidth:'100%', maxHeight:320, borderRadius:8, border:'1px solid #2a3050' }} alt="invoice" />}
              {scanPreview.type === 'pdf'   && <div style={{ background:'#1e243a', border:'1px solid #2a3050', borderRadius:8, padding:12, fontSize:12, fontFamily:'monospace', color:'#94a3b8', maxHeight:240, overflowY:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{scanPreview.text}</div>}
            </div>
          )}

          {/* Extracting spinner */}
          {extracting && (
            <div style={{ background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.3)', borderRadius:10, padding:32, textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:28, marginBottom:10, animation:'spin 1.2s linear infinite', display:'inline-block' }}>⏳</div>
              <p style={{ fontSize:14, color:'#3b82f6', fontWeight:600, marginBottom:4 }}>Reading invoice with AI…</p>
              <p style={{ fontSize:12, color:'#64748b' }}>GPT-4o is extracting supplier info, line items, weights and prices</p>
            </div>
          )}

          {/* Extraction error */}
          {extractError && !extracting && (
            <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#ef4444', marginBottom:14 }}>
              ⚠️ {extractError}
            </div>
          )}

          {/* Line items */}
          {scanVisible && !extracting && <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <h2 style={{ fontSize:13, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#94a3b8', margin:0 }}>Line Items</h2>
              <div style={{ flex:1, height:1, background:'#2a3050' }} />
            </div>
            <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#f59e0b', marginBottom:14 }}>
              Review each line. Tariff numbers are auto-suggested from the CMDA 2010 schedule — verify them. Edit anything before sending to the Declaration form.
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
              <div><label style={LS}>Freight Cost $</label><input className="hmc-inp" style={IS} type="number" value={scanFreight} onChange={e => setScanFreight(e.target.value)} min="0" step="0.01" /></div>
              <div><label style={LS}>Insurance Cost $</label><input className="hmc-inp" style={IS} type="number" value={scanInsurance} onChange={e => setScanInsurance(e.target.value)} min="0" step="0.01" /></div>
              <div><label style={LS}>No. of Packages</label><input className="hmc-inp" style={IS} type="number" value={scanPkgCount} onChange={e => setScanPkgCount(e.target.value)} min="1" /></div>
            </div>

            <div style={{ ...CS, padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr>{['#','Description','HS Tariff No.','Rate','Qty / Units','Net Wt (lb)','FOB Value $','CIF Value $','Duty $','Origin',''].map(h => (
                      <th key={h} style={{ background:'#252d47', padding:'10px 8px', textAlign:'left', fontFamily:'monospace', fontSize:10, color:'#64748b', letterSpacing:'.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {scanRows.map((row, idx) => {
                      const tariff = TARIFF_DB.find(r => r[0] === row.hs);
                      const rate = tariff ? tariff[2] : (row.hs ? '—' : '');
                      const rc = rate ? rateClass(rate) : 'def';
                      const fob = parseFloat(row.fob) || 0;
                      const cif = (fob + perRow).toFixed(2);
                      const duty = rate ? computeDuty(rate, fob + perRow).toFixed(2) : '0.00';
                      const tis: React.CSSProperties = { background:'#1e243a', border:'1px solid #2a3050', color:'#e2e8f0', padding:'5px 7px', borderRadius:4, fontSize:12, fontFamily:'inherit', outline:'none', width:'100%' };
                      return (
                        <tr key={row.id} className="hmc-row" style={{ borderBottom:'1px solid #2a3050' }}>
                          <td style={{ padding:8, color:'#64748b', fontFamily:'monospace', textAlign:'center', width:32 }}>{idx+1}</td>
                          <td style={{ padding:8, minWidth:220 }}><input className="hmc-inp" style={tis} type="text" placeholder="Description" value={row.desc} onChange={e => updateScanRow(row.id,'desc',e.target.value)} /></td>
                          <td style={{ padding:8, minWidth:110 }}><input className="hmc-inp" style={{ ...tis, fontFamily:'monospace' }} type="text" placeholder="0207.419" value={row.hs} onChange={e => updateScanRow(row.id,'hs',e.target.value)} /></td>
                          <td style={{ padding:8 }}>
                            {rate ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:RC[rc].bg, color:RC[rc].color, border:`1px solid ${RC[rc].border}`, borderRadius:4, padding:'2px 7px', fontSize:10, fontFamily:'monospace', whiteSpace:'nowrap' }}>{rate}</span>
                                   : <span style={{ color:'#64748b', fontSize:11 }}>—</span>}
                          </td>
                          <td style={{ padding:8, minWidth:90 }}><input className="hmc-inp" style={tis} type="text" placeholder="10 cs" value={row.qty} onChange={e => updateScanRow(row.id,'qty',e.target.value)} /></td>
                          <td style={{ padding:8, minWidth:90 }}><input className="hmc-inp" style={tis} type="number" placeholder="0" min="0" step="0.1" value={row.wt} onChange={e => updateScanRow(row.id,'wt',e.target.value)} /></td>
                          <td style={{ padding:8, minWidth:100 }}><input className="hmc-inp" style={tis} type="number" placeholder="0.00" min="0" step="0.01" value={row.fob} onChange={e => updateScanRow(row.id,'fob',e.target.value)} /></td>
                          <td style={{ padding:8, minWidth:100 }}><input style={{ ...tis, color:'#94a3b8' }} type="number" value={cif} readOnly /></td>
                          <td style={{ padding:8, minWidth:90 }}><input style={{ ...tis, color:'#f59e0b' }} type="number" value={duty} readOnly /></td>
                          <td style={{ padding:8, minWidth:50 }}><input className="hmc-inp" style={tis} type="text" value={row.origin} onChange={e => updateScanRow(row.id,'origin',e.target.value)} /></td>
                          <td style={{ padding:8 }}><button className="hmc-del" onClick={() => setScanRows(p => p.filter(r => r.id !== row.id))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16, padding:'2px 6px', borderRadius:4 }}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <button className="hmc-addrow" onClick={addScanRow} style={{ background:'none', border:'1px dashed #2a3050', color:'#64748b', padding:8, width:'100%', borderRadius:6, cursor:'pointer', fontSize:12, marginTop:4, fontFamily:'inherit', transition:'all .15s' }}>+ Add line item</button>

            {/* Totals strip */}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', background:'#252d47', border:'1px solid #2a3050', borderRadius:8, padding:'14px 18px', marginTop:14, marginBottom:16 }}>
              {([['FOB Total',`$${scanTotals.fobT.toFixed(2)}`,''],['Freight',`$${sfN.toFixed(2)}`,''],['Insurance',`$${siN.toFixed(2)}`,''],['CIF Total',`$${scanTotals.cifT.toFixed(2)}`,''],['Customs Duty',`$${scanTotals.dutyT.toFixed(2)}`,'#f59e0b'],['Wharfage (1%)',`$${scanTotals.wharf.toFixed(2)}`,''],['Total Due',`$${scanTotals.total.toFixed(2)}`,'#10b981']] as [string,string,string][]).map(([lbl,val,col]) => (
                <div key={lbl} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  <label style={{ fontSize:10, fontFamily:'monospace', color:'#64748b', textTransform:'uppercase' }}>{lbl}</label>
                  <span style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color: col||'#e2e8f0' }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button onClick={sendToForm} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', fontFamily:'inherit', background:'#10b981', color:'#fff' }}>✅ Send to Declaration Form</button>
              <button onClick={clearScan} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background:'none', border:'1px solid #2a3050', color:'#94a3b8' }}>🗑 Clear</button>
            </div>
          </>}
        </div>
      )}

      {/* ════════ FORM TAB ════════ */}
      {tab === 'form' && (
        <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>

          {/* Header */}
          <div style={CS}><div style={CT}>Header</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div><label style={LS}>Type</label><select className="hmc-inp" style={IS} value={fType} onChange={e => setFType(e.target.value)}>{['IMPORT','EXPORT','DEPOSIT','ADJUSTMENT'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label style={LS}>Trader Reference</label><input className="hmc-inp" style={IS} type="text" placeholder="e.g. IT-2026-001" value={fRef} onChange={e=>setFRef(e.target.value)} /></div>
              <div><label style={LS}>Page / Total</label><input className="hmc-inp" style={IS} type="text" value={fPage} onChange={e=>setFPage(e.target.value)} /></div>
              <div><label style={LS}>Related TD No.</label><input className="hmc-inp" style={IS} type="text" value={fRelTD} onChange={e=>setFRelTD(e.target.value)} /></div>
            </div>
          </div>

          {/* Supplier */}
          <div style={CS}><div style={CT}>1 · Supplier Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:10 }}>
              <div><label style={LS}>Supplier Name</label><input className="hmc-inp" style={IS} type="text" value={fSuppName} onChange={e=>setFSuppName(e.target.value)} /></div>
              <div><label style={LS}>Street</label><input className="hmc-inp" style={IS} type="text" value={fSuppStreet} onChange={e=>setFSuppStreet(e.target.value)} /></div>
              <div><label style={LS}>City / State</label><input className="hmc-inp" style={IS} type="text" value={fSuppCity} onChange={e=>setFSuppCity(e.target.value)} /></div>
              <div><label style={LS}>ZIP</label><input className="hmc-inp" style={IS} type="text" value={fSuppZip} onChange={e=>setFSuppZip(e.target.value)} /></div>
            </div>
            <div><label style={LS}>Country</label><input className="hmc-inp" style={IS} type="text" value={fSuppCountry} onChange={e=>setFSuppCountry(e.target.value)} /></div>
          </div>

          {/* Importer */}
          <div style={CS}><div style={CT}>2 · Importer Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={LS}>Importer Name</label><input className="hmc-inp" style={IS} type="text" value={fImpName} onChange={e=>setFImpName(e.target.value)} /></div>
              <div><label style={LS}>Importer ID</label><input className="hmc-inp" style={IS} type="text" value={fImpId} onChange={e=>setFImpId(e.target.value)} /></div>
              <div><label style={LS}>PO Box / Street</label><input className="hmc-inp" style={IS} type="text" value={fImpStreet} onChange={e=>setFImpStreet(e.target.value)} /></div>
              <div><label style={LS}>Town / Island</label><input className="hmc-inp" style={IS} type="text" value={fImpTown} onChange={e=>setFImpTown(e.target.value)} /></div>
            </div>
          </div>

          {/* Transport */}
          <div style={CS}><div style={CT}>3 & 4 · Transport & Manifest</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:10 }}>
              <div><label style={LS}>Carrier ID / No.</label><input className="hmc-inp" style={IS} type="text" value={fCarrierId} onChange={e=>setFCarrierId(e.target.value)} /></div>
              <div><label style={LS}>Port of Arrival</label><input className="hmc-inp" style={IS} type="text" value={fPort} onChange={e=>setFPort(e.target.value)} /></div>
              <div><label style={LS}>Arrival Date</label><input className="hmc-inp" style={IS} type="date" value={fArrival} onChange={e=>setFArrival(e.target.value)} /></div>
              <div><label style={LS}>Manifest No.</label><input className="hmc-inp" style={IS} type="text" value={fManifest} onChange={e=>setFManifest(e.target.value)} /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={LS}>Bill of Lading / AWB</label><input className="hmc-inp" style={IS} type="text" value={fBol} onChange={e=>setFBol(e.target.value)} /></div>
              <div><label style={LS}>Container ID & Length</label><input className="hmc-inp" style={IS} type="text" value={fContainer} onChange={e=>setFContainer(e.target.value)} /></div>
              <div><label style={LS}>No. of Packages</label><input className="hmc-inp" style={IS} type="number" value={fPkgCount} onChange={e=>setFPkgCount(e.target.value)} /></div>
            </div>
          </div>

          {/* Shipment */}
          <div style={CS}><div style={CT}>5 · Shipment Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={LS}>City of Direct Shipment</label><input className="hmc-inp" style={IS} type="text" value={fShipCity} onChange={e=>setFShipCity(e.target.value)} /></div>
              <div><label style={LS}>Country of Direct Shipment</label><input className="hmc-inp" style={IS} type="text" value={fShipCountry} onChange={e=>setFShipCountry(e.target.value)} /></div>
              <div><label style={LS}>Country of Origin</label><input className="hmc-inp" style={IS} type="text" value={fOrigCountry} onChange={e=>setFOrigCountry(e.target.value)} /></div>
            </div>
          </div>

          {/* Financials */}
          <div style={CS}><div style={CT}>8–10 · Freight, Insurance & Duty Summary</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:10 }}>
              <div><label style={LS}>Total Freight $</label><input className="hmc-inp" style={IS} type="number" step="0.01" value={fFreight} onChange={e=>setFFreight(e.target.value)} /></div>
              <div><label style={LS}>Total Insurance $</label><input className="hmc-inp" style={IS} type="number" step="0.01" value={fInsurance} onChange={e=>setFInsurance(e.target.value)} /></div>
              <div><label style={LS}>Total Customs Duty $</label><input style={{ ...IS, color:'#f59e0b' }} type="number" value={formTotals.d.toFixed(2)} readOnly /></div>
              <div><label style={LS}>Total Wharfage $</label><input style={IS} type="number" value={formTotals.w.toFixed(2)} readOnly /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={LS}>Total Alcohol $</label><input className="hmc-inp" style={IS} type="number" value={fAlcohol} onChange={e=>setFAlcohol(e.target.value)} /></div>
              <div><label style={LS}>Total Fossil Fuel $</label><input className="hmc-inp" style={IS} type="number" value={fFossil} onChange={e=>setFFossil(e.target.value)} /></div>
              <div><label style={LS}>TOTAL DUE $</label><input style={{ ...IS, color:'#10b981', fontWeight:700, fontSize:15 }} type="number" value={formTotals.total.toFixed(2)} readOnly /></div>
            </div>
          </div>

          {/* Declarant */}
          <div style={CS}><div style={CT}>Declarant</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={LS}>Declarant Name</label><input className="hmc-inp" style={IS} type="text" value={fDeclName} onChange={e=>setFDeclName(e.target.value)} /></div>
              <div><label style={LS}>Declarant ID</label><input className="hmc-inp" style={IS} type="text" value={fDeclId} onChange={e=>setFDeclId(e.target.value)} /></div>
              <div><label style={LS}>Date</label><input className="hmc-inp" style={IS} type="date" value={fDeclDate} onChange={e=>setFDeclDate(e.target.value)} /></div>
            </div>
          </div>

          {/* Records */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <h2 style={{ fontSize:13, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#94a3b8', margin:0 }}>Records (Line Items)</h2>
            <div style={{ flex:1, height:1, background:'#2a3050' }} />
          </div>

          {formRecords.map((r, idx) => {
            const taxCif = parseFloat(r.taxCif) || parseFloat(r.cif) || 0;
            const wf = parseFloat(r.wharfFob) || parseFloat(r.fob) || 0;
            const dutyAmt = computeDuty(r.rate, taxCif);
            const wharfAmt = wf * 0.01;
            const tis: React.CSSProperties = { background:'#1e243a', border:'1px solid #2a3050', color:'#e2e8f0', padding:'6px', borderRadius:4, fontFamily:'inherit', fontSize:12, outline:'none', width:'100%' };
            return (
              <div key={r.id} style={{ ...CS, borderLeft:'3px solid #3b82f6' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...CT }}>
                  <span>Record No. {String(idx+1).padStart(3,'0')}</span>
                  <button onClick={() => removeFormRecord(r.id)} style={{ background:'none', border:'1px solid #ef4444', color:'#ef4444', cursor:'pointer', padding:'4px 10px', borderRadius:4, fontSize:12, fontFamily:'inherit' }}>Remove</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:10 }}>
                  <div><label style={LS}>12 · CPC</label><input className="hmc-inp" style={IS} type="text" value={r.cpc} onChange={e=>updateRec(r.id,{cpc:e.target.value})} /></div>
                  <div><label style={LS}>13 · Tariff No.</label><input className="hmc-inp" style={{ ...IS, fontFamily:'monospace' }} type="text" placeholder="e.g. 0207.419" value={r.hs} onChange={e=>updateRec(r.id,{hs:e.target.value})} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:10 }}>
                  <div><label style={LS}>14 · Country of Origin</label><input className="hmc-inp" style={IS} type="text" value={r.origin} onChange={e=>updateRec(r.id,{origin:e.target.value})} /></div>
                  <div><label style={LS}>15 · No. and Type of Packages</label><input className="hmc-inp" style={IS} type="text" placeholder="e.g. 5 Cartons" value={r.pkgs} onChange={e=>updateRec(r.id,{pkgs:e.target.value})} /></div>
                </div>
                <div style={{ marginBottom:10 }}><label style={LS}>16 · Description of Goods</label><textarea className="hmc-inp" style={{ ...IS, resize:'vertical', minHeight:60 }} value={r.desc} onChange={e=>updateRec(r.id,{desc:e.target.value})} /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:10 }}>
                  <div><label style={LS}>17a · Net Wt (lb)</label><input className="hmc-inp" style={IS} type="number" min="0" step="0.1" value={r.wt} onChange={e=>updateRec(r.id,{wt:e.target.value})} /></div>
                  <div><label style={LS}>17b · Qty / Units</label><input className="hmc-inp" style={IS} type="text" value={r.qty} onChange={e=>updateRec(r.id,{qty:e.target.value})} /></div>
                  <div><label style={LS}>18 · FOB Value $</label><input className="hmc-inp" style={IS} type="number" min="0" step="0.01" value={r.fob} onChange={e=>updateRec(r.id,{fob:e.target.value,wharfFob:e.target.value})} /></div>
                  <div><label style={LS}>20 · CIF Value $</label><input className="hmc-inp" style={IS} type="number" min="0" step="0.01" value={r.cif} onChange={e=>updateRec(r.id,{cif:e.target.value,taxCif:e.target.value})} /></div>
                </div>
                {/* Tax calculation */}
                <div style={{ background:'#252d47', padding:12, borderRadius:6 }}>
                  <div style={{ fontSize:10, fontFamily:'monospace', color:'#3b82f6', letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>21 · Tax Calculation</div>
                  <div style={{ display:'grid', gridTemplateColumns:'90px 90px 1fr 100px 100px', gap:8, fontSize:10, fontFamily:'monospace', color:'#64748b', marginBottom:4, padding:'0 2px' }}>
                    <span>TAX</span><span>IND.</span><span>VALUE</span><span>RATE</span><span>AMOUNT</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'90px 90px 1fr 100px 100px', gap:8, alignItems:'center', marginBottom:6 }}>
                    <input style={{ ...tis, fontFamily:'monospace', fontSize:11 }} defaultValue="01 Imp." readOnly />
                    <input style={{ ...tis, fontFamily:'monospace', fontSize:11 }} defaultValue="42 CIF" readOnly />
                    <input className="hmc-inp" style={tis} type="number" step="0.01" value={r.taxCif} onChange={e=>updateRec(r.id,{taxCif:e.target.value})} />
                    <input className="hmc-inp" style={{ ...tis, fontFamily:'monospace', fontSize:11 }} type="text" value={r.rate} onChange={e=>updateRec(r.id,{rate:e.target.value})} />
                    <input style={{ ...tis, color:'#f59e0b', fontWeight:600 }} type="number" value={dutyAmt.toFixed(2)} readOnly />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'90px 90px 1fr 100px 100px', gap:8, alignItems:'center' }}>
                    <input style={{ ...tis, fontFamily:'monospace', fontSize:11 }} defaultValue="03 Whf" readOnly />
                    <input style={{ ...tis, fontFamily:'monospace', fontSize:11 }} defaultValue="25 FOB" readOnly />
                    <input className="hmc-inp" style={tis} type="number" step="0.01" value={r.wharfFob || r.fob} onChange={e=>updateRec(r.id,{wharfFob:e.target.value})} />
                    <input style={{ ...tis, fontFamily:'monospace', fontSize:11 }} defaultValue="1%" readOnly />
                    <input style={tis} type="number" value={wharfAmt.toFixed(2)} readOnly />
                  </div>
                </div>
                <div style={{ marginTop:10 }}><label style={LS}>22 · Additional Information</label><input className="hmc-inp" style={IS} type="text" placeholder="e.g. see attached commercial invoice" value={r.additionalInfo} onChange={e=>updateRec(r.id,{additionalInfo:e.target.value})} /></div>
              </div>
            );
          })}

          <button className="hmc-addrow" onClick={() => addFormRecord()} style={{ background:'none', border:'1px dashed #2a3050', color:'#64748b', padding:8, width:'100%', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', marginBottom:16, transition:'all .15s' }}>+ Add Record</button>

          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            <button onClick={generateOutput} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', fontFamily:'inherit', background:'#3b82f6', color:'#fff' }}>📄 Generate Declaration Text</button>
            <button onClick={() => window.print()} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background:'none', border:'1px solid #2a3050', color:'#94a3b8' }}><Printer style={{ width:14, height:14 }} /> Print</button>
            <button onClick={() => { setFormRecords([]); setFormOutput(''); }} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background:'none', border:'1px solid #2a3050', color:'#94a3b8' }}>🗑 Clear Records</button>
          </div>

          {formOutput && (
            <div style={{ background:'#161b27', border:'1px solid #2a3050', borderRadius:8, padding:16, fontFamily:'monospace', fontSize:11, color:'#94a3b8', whiteSpace:'pre-wrap', maxHeight:500, overflowY:'auto', marginTop:16 }}>
              {formOutput}
            </div>
          )}
        </div>
      )}

      {/* ════════ LOOKUP TAB ════════ */}
      {tab === 'lookup' && (
        <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
          <div style={{ background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.3)', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#3b82f6', marginBottom:14 }}>
            Search the full BVI CMDA 2010 tariff schedule. Click any result to copy the HS code to clipboard.
          </div>
          <div style={{ marginBottom:16 }}>
            <input className="hmc-inp" type="text" placeholder="e.g. chicken, rice, cooking oil, beer, rum, cigarettes, refrigerator…" value={lookupQ} onChange={e => setLookupQ(e.target.value)}
              style={{ width:'100%', background:'#1e243a', border:'1px solid #2a3050', color:'#e2e8f0', padding:'10px 14px', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none' }} />
          </div>
          <div style={{ background:'#161b27', border:'1px solid #2a3050', borderRadius:8, overflow:'hidden' }}>
            {lookupQ.trim().length < 2 ? (
              <div style={{ padding:20, textAlign:'center', color:'#64748b', fontSize:13 }}>Type at least 2 characters to search…</div>
            ) : lookupResults.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:'#64748b', fontSize:13 }}>No results. Try different keywords.</div>
            ) : lookupResults.map((r, i) => {
              const rc = rateClass(r[2]);
              return (
                <div key={i} className="hmc-lkrow" onClick={() => navigator.clipboard.writeText(r[0]).catch(() => {})} title="Click to copy HS code"
                  style={{ padding:'12px 16px', borderBottom: i < lookupResults.length-1 ? '1px solid #2a3050' : 'none', display:'flex', alignItems:'center', gap:12, cursor:'pointer', transition:'background .12s' }}>
                  <span style={{ fontFamily:'monospace', fontSize:12, color:'#3b82f6', minWidth:90 }}>{r[0]}</span>
                  <span style={{ flex:1, fontSize:13 }}>{r[1]}</span>
                  <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, minWidth:100, textAlign:'right', color:RC[rc].color }}>{r[2]}</span>
                  <span style={{ fontSize:10, color:'#64748b', fontFamily:'monospace' }}>{r[4]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
