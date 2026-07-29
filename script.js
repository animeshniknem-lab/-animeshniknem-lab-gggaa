/* ══ 1. УТИЛИТЫ ══ */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ftime=t=>new Date(t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
function toast(msg,cls=''){const t=document.createElement('div');t.className='toast '+cls;t.innerHTML=msg;$('#toasts').appendChild(t);setTimeout(()=>{t.style.transition='.4s';t.style.opacity=0;t.style.transform='translateX(40px)';setTimeout(()=>t.remove(),400)},3600);}
let AC=null;function tick(f=520,d=.12){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.07,AC.currentTime);g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d);o.connect(g).connect(AC.destination);o.start();o.stop(AC.currentTime+d+.02);}catch(e){}}
const ROLENAME={dm:'Мастер',pl:'Игрок'};
const S={session:JSON.parse(localStorage.getItem('d20session')||'null'),tokens:[],rolls:[],mapUrl:null,mapData:null,mapName:null,terms:[{n:1,s:20}],snap:true,grid:true,charId:JSON.parse(localStorage.getItem('d20charId')||'null'),tracks:[],trackData:{},music:{trackId:null,playing:false,time:0,ts:0}};
function isDM(){return S.session&&S.session.role==='dm';}
function blobToDataUrl(b){return new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b);});}

/* ══ 2. INDEXEDDB ══ */
const DB={d:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('grimoire-d20',3);
    r.onupgradeneeded=e=>{const d=e.target.result;['users','kv','notes','quests','rolls','chars','items','tokens','tracks','maps'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'});});};
    r.onsuccess=e=>{DB.d=e.target.result;res();};r.onerror=()=>rej(r.error);});},
  p(q){return new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});},
  put(s,v){return DB.p(DB.d.transaction(s,'readwrite').objectStore(s).put(v));},
  get(s,id){return DB.p(DB.d.transaction(s).objectStore(s).get(id));},
  all(s){return DB.p(DB.d.transaction(s).objectStore(s).getAll());},
  del(s,id){return DB.p(DB.d.transaction(s,'readwrite').objectStore(s).delete(id));}};

/* ══ 3. АУТЕНТИФИКАЦИЯ + РОЛИ ══ */
async function hash(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return 'x'+h;}}
function afterLogin(){closeModal('authModal');renderAuth();renderRtcUI();mapGates();homeStats();renderChars();renderToks();renderUsers();renderMusicGates();autoHostIfDM();}
function renderAuth(){const a=$('#authArea');
  if(S.session){const n=esc(S.session.name);const rc=S.session.role==='pl'?'pl':'dm';
    a.innerHTML=`<div class="uchip"><span class="useal">${S.session.role==='dm'?'⚜':esc(n[0].toUpperCase())}</span><div><b>${n}</b><i class="role ${rc}">${ROLENAME[S.session.role]||'Игрок'}</i></div><button class="btn ghost sm" id="btnOut">Выйти</button></div>`;
    $('#btnOut').onclick=()=>{S.session=null;localStorage.removeItem('d20session');renderAuth();renderRtcUI();mapGates();homeStats();renderChars();renderToks();renderUsers();renderMusicGates();toast('Ты покинул таверну. До встречи!');};
  }else{a.innerHTML=`<button class="btn ghost" id="btnReg">Зарегистрироваться</button><button class="btn gold" id="btnLogin">Войти</button>`;
    $('#btnReg').onclick=()=>openAuth('reg');$('#btnLogin').onclick=()=>openAuth('login');}}
function openAuth(tab){$('#authModal').classList.add('open');switchTab(tab);}
function switchTab(t){$$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));$('#loginForm').style.display=t==='login'?'block':'none';$('#regForm').style.display=t==='reg'?'block':'none';$('#liErr').textContent='';$('#rgErr').textContent='';}
$$('.tabs button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#regForm').onsubmit=async e=>{e.preventDefault();$('#rgErr').textContent='';
  const name=$('#rgName').value.trim(),pw=$('#rgPass').value,email=$('#rgEmail').value.trim();
  if(!name){$('#rgErr').textContent='Введи имя героя.';return;}
  if(pw.length<3){$('#rgErr').textContent='Пароль не короче 3 символов.';return;}
  if(await DB.get('users',name.toLowerCase())){$('#rgErr').textContent='Такое имя уже занято.';return;}
  const isFirst=(await DB.all('users')).length===0;
  const role=isFirst?'dm':'pl';
  await DB.put('users',{id:name.toLowerCase(),name,email,role,pass:await hash(pw)});
  S.session={name,role,email};localStorage.setItem('d20session',JSON.stringify(S.session));
  afterLogin();toast(isFirst?`⚜ Добро пожаловать, <b>${esc(name)}</b>! Ты первый за этим столом — и потому Мастер.`:`⚔ Добро пожаловать, <b>${esc(name)}</b>!`,'crit');};
$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#liErr').textContent='';
  const id=$('#liName').value.trim().toLowerCase(),pw=$('#liPass').value;
  const u=await DB.get('users',id);
  if(!u||u.pass!==await hash(pw)){$('#liErr').textContent='Неверное имя или пароль.';return;}
  S.session={name:u.name,role:u.role,email:u.email};localStorage.setItem('d20session',JSON.stringify(S.session));
  afterLogin();toast(`С возвращением, <b>${esc(u.name)}</b>!`,'crit');};
async function renderUsers(){const p=$('#rolePanel');if(!p)return;p.style.display=isDM()?'block':'none';if(!isDM())return;
  const us=await DB.all('users');
  $('#userList').innerHTML=us.length?us.map(u=>{const mine=S.session&&u.id===S.session.name.toLowerCase();
    return `<div class="urow${u.role==='dm'?' super':''}"><span class="useal">${u.role==='dm'?'⚜':esc(u.name[0].toUpperCase())}</span><div><b>${esc(u.name)}${mine?' (ты)':''}</b><div class="hand" style="font-size:12px;color:#6b5836">${esc(u.email||'без почты')}</div></div><span class="rbadge ${u.role==='dm'?'dm':'pl'}">${u.role==='dm'?'Мастер':'Игрок'}</span><span class="uact">${mine?'':(u.role==='dm'?`<button class="qbtn" data-role="${u.id}|pl" title="Понизить до игрока">↓</button>`:`<button class="qbtn" data-role="${u.id}|dm" title="Повысить до со-мастера">↑</button>`)}</span></div>`;}).join(''):'<p class="hand" style="color:#6b5836">Пока никто не зарегистрировался.</p>';
  $$('[data-role]').forEach(b=>b.onclick=async()=>{const[id,r]=b.dataset.role.split('|');const u=await DB.get('users',id);u.role=r;await DB.put('users',u);renderUsers();toast(`${esc(u.name)} теперь ${r==='dm'?'Мастер':'Игрок'}`,'crit');});}

/* ══ 4. РОУТЕР ══ */
const PAGES={home:'Главная',classes:'Классы',races:'Расы',monsters:'Бестиарий',rules:'Правила',lore:'История мира',map:'Карта мира',party:'Комната партии',chars:'Персонажи',items:'Предметы',quests:'Задания'};
function go(p){$$('.page').forEach(s=>s.classList.toggle('active',s.id==='page-'+p));$$('#nav [data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===p));$('#crumb').textContent=PAGES[p]||p;window.scrollTo({top:0,behavior:'smooth'});revealScan();}
$$('#nav [data-nav],.brand').forEach(b=>b.addEventListener('click',()=>go(b.dataset.nav)));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}}),{threshold:.12});
function revealScan(){$$('.rv:not(.on)').forEach(el=>io.observe(el));}

/* ══ 5. СПРАВОЧНИКИ ══ */
const CLASSES=[
 {n:'Варвар',en:'Barbarian',src:'PHB',hd:'d12',ab:'Сила',sv:'Сил, Тел',armor:'Лёгкие, средние, щиты',weap:'Простое, воинское',cast:'Нет',feat:['<b>Ярость</b> (1 ур.): бонус-экшеном — преимущество на Силу, +2 к урону рукопашных атак, сопротивление физ. урону.','<b>Защита без доспехов</b> (1 ур.): КД = 10 + мод. Ловк. + мод. Тел.','<b>Безрассудная атака</b> (2 ур.): преимущество на атаки в ближнем бою.','<b>Чутьё на опасность</b> (2 ур.): спасброски Ловкости с преимуществом.','<b>Доп. атака</b> (5 ур.) и <b>+10 фт</b> к скорости.','<b>Непреклонная ярость</b> (11 ур.): раз в ярость остаёшься с 1 хитом.'],subs:['Путь берсерка','Путь тотемного воина','Путь предка-хранителя','Путь бури'],c:'#a3322b',cl:'#e0705f'},
 {n:'Бард',en:'Bard',src:'PHB',hd:'d8',ab:'Харизма',sv:'Лов, Хар',armor:'Лёгкие',weap:'Простое + рапира, длинный меч, лук',cast:'Да (Харизма)',feat:['<b>Заговоры и ячейки</b> (1 ур.): магия от Харизмы.','<b>Вдохновение барда</b> (1 ур.): кость вдохновения союзнику.','<b>Мастер на все руки</b> (2 ур.): половина бонуса мастерства к невладеемым проверкам.','<b>Песнь отдыха</b> (2 ур.): бонус к хитам при коротком отдыхе.','<b>Источник вдохновения</b> (5 ур.): ячейки на коротком отдыхе.'],subs:['Коллегия знаний','Коллегия доблести','Коллегия мечей','Коллегия шёпотов'],c:'#7a4a8a',cl:'#b98ad0'},
 {n:'Жрец',en:'Cleric',src:'PHB',hd:'d8',ab:'Мудрость',sv:'Муд, Хар',armor:'Лёгкие, средние, щиты',weap:'Простое',cast:'Да (Мудрость)',feat:['<b>Божественный домен</b> (1 ур.): тема и бонусные заклинания.','<b>Направление божества</b> (2 ур.): сила домена.','<b>Божественное вмешательство</b> (10 ур.): призыв помощи божества.','Готовит заклинания из <b>всего списка жреца</b> каждый день.'],subs:['Домен жизни','Домен света','Домен войны','Домен природы','Домен бури'],c:'#b08a2e',cl:'#f2c14e'},
 {n:'Друид',en:'Druid',src:'PHB',hd:'d8',ab:'Мудрость',sv:'Инт, Муд',armor:'Лёгкие, средние, щиты (не металл)',weap:'Простое + природное',cast:'Да (Мудрость)',feat:['<b>Дикий облик</b> (2 ур.): превращение в зверя.','<b>Круг друидов</b> (2 ур.): специализация.','<b>Друидический язык</b> (1 ур.).','Не носит доспехи и щиты из металла.'],subs:['Круг Луны','Круг Земли','Круг Пастыря','Круг Снов'],c:'#2f7a5a',cl:'#6fc09a'},
 {n:'Воин',en:'Fighter',src:'PHB',hd:'d10',ab:'Сила / Ловкость',sv:'Сил, Тел',armor:'Все доспехи, щиты',weap:'Простое, воинское',cast:'Опционально (Мист. рыцарь)',feat:['<b>Боевой стиль</b> (1 ур.).','<b>Второе дыхание</b> (1 ур.): 1к10+уровень хитов бонус-экшеном.','<b>Всплеск действий</b> (2 ур.): ещё одно действие.','<b>Доп. атаки</b>: 2 (5), 3 (11), 4 (20).','<b>Несокрушимость</b> (9 ур.): переброс спасброска.'],subs:['Чемпион','Мастер боевых искусств','Мистический рыцарь','Рыцарь-наездник'],c:'#c96a2b',cl:'#f0a05e'},
 {n:'Монах',en:'Monk',src:'PHB',hd:'d8',ab:'Ловкость + Мудрость',sv:'Сил, Лов',armor:'Нет',weap:'Простое, короткий меч',cast:'Опционально (4 стихии)',feat:['<b>Защита без доспехов</b> (1 ур.): КД = 10 + Ловк. + Муд.','<b>Боевые искусства</b> (1 ур.): кость урона растёт.','<b>Ци</b> (2 ур.): Шквал ударов, Терпеливая оборона, Шаг ветра.','<b>Отражение снарядов</b> (3 ур.) и <b>Медленное падение</b> (4 ур.).','<b>Спокойный разум</b> (7 ур.): иммунитет к очарованию и испугу.'],subs:['Путь открытой ладони','Путь тени','Путь четырёх стихий','Путь пьяного мастера'],c:'#4a5a3a',cl:'#8fae5a'},
 {n:'Паладин',en:'Paladin',src:'PHB',hd:'d10',ab:'Сила + Харизма',sv:'Муд, Хар',armor:'Все доспехи, щиты',weap:'Простое, воинское',cast:'Да (Харизма, со 2 ур.)',feat:['<b>Божественное чувство</b> (1 ур.).','<b>Наложение рук</b> (1 ур.): пул лечения 5×уровень.','<b>Божественная кара</b> (2 ур.): доп. урон излучением.','<b>Боевой стиль</b> (2 ур.) и заклинания.','<b>Аура защиты</b> (6 ур.): +Хар к спасброскам союзников.'],subs:['Клятва Преданности','Клятва Древних','Клятва Мести','Клятвопреступник'],c:'#3f5fa8',cl:'#7fb0e8'},
 {n:'Следопыт',en:'Ranger',src:'PHB',hd:'d10',ab:'Ловкость + Мудрость',sv:'Сил, Лов',armor:'Лёгкие, средние, щиты',weap:'Простое, воинское',cast:'Да (Мудрость, со 2 ур.)',feat:['<b>Избранный враг</b> (1 ур.).','<b>Исследователь природы</b> (1 ур.).','<b>Боевой стиль</b> (2 ур.) и заклинания.','<b>Доп. атака</b> (5 ур.) и <b>Ускользающая походка</b> (8 ур.).','<b>Исчезновение</b> (14 ур.).'],subs:['Охотник','Повелитель зверей','Сумрачный странник','Убийца чудовищ'],c:'#2f7a5a',cl:'#6fc09a'},
 {n:'Плут',en:'Rogue',src:'PHB',hd:'d8',ab:'Ловкость',sv:'Лов, Инт',armor:'Лёгкие',weap:'Простое + рапира, короткий меч, лук',cast:'Опционально (Мист. ловкач)',feat:['<b>Компетентность</b> (1 ур.): двойное мастерство к двум навыкам.','<b>Скрытая атака</b> (1 ур.): доп. урон 1к6 (растёт).','<b>Хитрое действие</b> (2 ур.): Рывок/Отход/Засада бонус-экшеном.','<b>Уклонение</b> (7 ур.).','<b>Надёжный талант</b> (11 ур.).'],subs:['Вор','Убийца','Мистический ловкач','Головорез'],c:'#4a5a3a',cl:'#8fae5a'},
 {n:'Чародей',en:'Sorcerer',src:'PHB',hd:'d6',ab:'Харизма',sv:'Тел, Хар',armor:'Нет',weap:'Простое',cast:'Да (Харизма)',feat:['<b>Происхождение</b> (1 ур.): источник магии.','<b>Метамагия</b> (3 ур.): усиление заклинаний.','<b>Очки чародейства</b> (2 ур.).','Знает мало заклинаний, но колдует гибко.'],subs:['Драконья кровь','Дикая магия','Божественная душа','Теневая магия'],c:'#c23b6b',cl:'#e88ab0'},
 {n:'Колдун',en:'Warlock',src:'PHB',hd:'d8',ab:'Харизма',sv:'Муд, Хар',armor:'Лёгкие',weap:'Простое',cast:'Да (Харизма)',feat:['<b>Потусторонний покровитель</b> (1 ур.).','<b>Магия договора</b> (1 ур.): ячейки высшего уровня, возврат на коротком отдыхе.','<b>Мистические воззвания</b> (2 ур.).','<b>Дар договора</b> (3 ур.): клинок, цепь или книга.'],subs:['Исчадие','Архифея','Великий Древний','Небожитель','Клинок ведьмы'],c:'#5a3a7a',cl:'#9a6ad0'},
 {n:'Волшебник',en:'Wizard',src:'PHB',hd:'d6',ab:'Интеллект',sv:'Инт, Муд',armor:'Нет',weap:'Простое (узкий список)',cast:'Да (Интеллект)',feat:['<b>Книга заклинаний</b> (1 ур.).','<b>Магическое восстановление</b> (1 ур.): ячейки на коротком отдыхе.','<b>Школа магии</b> (2 ур.).','Широчайший список заклинаний в игре.'],subs:['Школа воплощения','Школа ограждения','Школа прорицания','Школа некромантии'],c:'#3f5fa8',cl:'#7fb0e8'},
 {n:'Изобретатель',en:'Artificer',src:'Tasha',hd:'d8',ab:'Интеллект',sv:'Тел, Инт',armor:'Лёгкие, средние, щиты',weap:'Простое + огнестрельное',cast:'Да (Интеллект, через предметы)',feat:['<b>Магические инфузии</b> (2 ур.): зачарование предметов.','<b>Инструменты</b> (1 ур.): колдует с инструментом в руках.','<b>Подкласс</b> (3 ур.): алхимик, оружейник, броневик.','<b>Вспышка гения</b> (7 ур.).'],subs:['Алхимик','Оружейник','Броневик','Артиллерист'],c:'#8a6423',cl:'#d9a441'}];
const RACES=[
 {n:'Дварф',en:'Dwarf',size:'Средний',speed:'25 фт',ab:'Телосложение +2',traits:['<b>Тёмное зрение</b> 60 фт','<b>Дварфийская устойчивость</b>: преимущество от яда, сопротивление яду','<b>Боевая тренировка</b>: топор и молот','<b>Знание камня</b>'],subs:['Холмовой','Горный','Дуэргар'],d:'Крепче гор, в которых вырублены их чертоги.',c:'#8a6423',cl:'#d9a441'},
 {n:'Эльф',en:'Elf',size:'Средний',speed:'30 фт',ab:'Ловкость +2',traits:['<b>Тёмное зрение</b> 60 фт','<b>Обострённые чувства</b>: владение Восприятием','<b>Наследие фей</b>: преимущество от очарования, иммунитет к магическому сну','<b>Транс</b>: 4 часа медитации вместо сна'],subs:['Высший','Лесной','Тёмный (дроу)'],d:'Дети звёзд, живущие более 700 лет.',c:'#2f7a5a',cl:'#6fc09a'},
 {n:'Полурослик',en:'Halfling',size:'Маленький',speed:'25 фт',ab:'Ловкость +2',traits:['<b>Удача</b>: переброс «1» на атаке/проверке/спасброске','<b>Храбрость</b>: преимущество от испуга','<b>Проворство</b>: проходят сквозь пространство крупных'],subs:['Легконогий','Коренастый'],d:'Маленький рост — большое сердце. И феноменальная удача.',c:'#4a5a3a',cl:'#8fae5a'},
 {n:'Человек',en:'Human',size:'Средний',speed:'30 фт',ab:'+1 ко всем характеристикам',traits:['<b>Универсальность</b>: бонус ко всем шести характеристикам','Дополнительный язык','Вариант: черта +1 к двум характеристикам'],subs:['Обычный','Вариантный'],d:'Амбициозные и гибкие. Империи людей раскинулись по всему миру.',c:'#c96a2b',cl:'#f0a05e'},
 {n:'Драконорождённый',en:'Dragonborn',size:'Средний',speed:'30 фт',ab:'Сила +2, Харизма +1',traits:['<b>Наследие дракона</b>: тип урона и форма дыхания','<b>Дыхательное оружие</b>: линия/конус урона','<b>Сопротивление</b> урону своего типа'],subs:['По цвету дракона (10 родов)'],d:'Гордый клан, несущий стихию древних драконов.',c:'#a3322b',cl:'#e0705f'},
 {n:'Гном',en:'Gnome',size:'Маленький',speed:'25 фт',ab:'Интеллект +2',traits:['<b>Тёмное зрение</b> 60 фт','<b>Гномья хитрость</b>: преимущество на спасброски Инт/Муд/Хар против магии'],subs:['Лесной','Скальный'],d:'Любопытные изобретатели и иллюзионисты.',c:'#3f5fa8',cl:'#7fb0e8'},
 {n:'Полуэльф',en:'Half-Elf',size:'Средний',speed:'30 фт',ab:'Харизма +2, ещё две по +1',traits:['<b>Тёмное зрение</b> 60 фт','<b>Наследие фей</b>','<b>Универсальность навыков</b>: владение двумя навыками'],subs:[],d:'Между двух миров: людские амбиции и эльфийская грация.',c:'#7a4a8a',cl:'#b98ad0'},
 {n:'Полуорк',en:'Half-Orc',size:'Средний',speed:'30 фт',ab:'Сила +2, Телосложение +1',traits:['<b>Тёмное зрение</b> 60 фт','<b>Угроза</b>: владение Запугиванием','<b>Стойкость</b>: раз в день 1 хит вместо 0','<b>Дикие атаки</b>: доп. кость урона при крите'],subs:[],d:'Сила орков и упорство людей.',c:'#a3322b',cl:'#e0705f'},
 {n:'Тифлинг',en:'Tiefling',size:'Средний',speed:'30 фт',ab:'Харизма +2, Интеллект +1',traits:['<b>Тёмное зрение</b> 60 фт','<b>Адское сопротивление</b>: сопротивление огню','<b>Инфернальное наследие</b>: заговоры и заклинания'],subs:['Кровь Асмодея','Разные дома'],d:'Кровь преисподней даёт силу — и косые взгляды.',c:'#c23b33',cl:'#e0705f'},
 {n:'Аасимар',en:'Aasimar',size:'Средний',speed:'30 фт',ab:'Харизма +2',traits:['<b>Тёмное зрение</b> 60 фт','<b>Небесное сопротивление</b>: излучение и некротический урон','<b>Исцеляющие руки</b> и световой заговор','Сияющий облик (с 3 ур.)'],subs:['Протектор','Падший','Мститель'],d:'Потомки небожителей, несущие свет — или карающее пламя.',c:'#b08a2e',cl:'#f2c14e'},
 {n:'Голиаф',en:'Goliath',size:'Средний',speed:'30 фт',ab:'Сила +2, Телосложение +1',traits:['<b>Атлет от природы</b>: владение Атлетикой','<b>Каменная выносливость</b>: снижение урона','<b>Могучее телосложение</b>: груз как у Большого'],subs:[],d:'Дети горных вершин, для которых выживание — соревнование.',c:'#4a5a3a',cl:'#8fae5a'},
 {n:'Табакси',en:'Tabaxi',size:'Средний',speed:'30 фт',ab:'Ловкость +2, Харизма +1',traits:['<b>Тёмное зрение</b> 60 фт','<b>Когти кошки</b>: лазание 20 фт, удар 1к4','<b>Кошачья ловкость</b>: удвоить скорость на ход'],subs:[],d:'Любопытные кошколюды-странники, одержимые историями.',c:'#c96a2b',cl:'#f0a05e'},
 {n:'Кенку',en:'Kenku',size:'Средний',speed:'30 фт',ab:'Ловкость +2, Мудрость +1',traits:['<b>Эксперт-подражатель</b>: два навыка','<b>Мимикрия</b>: копирование звуков и голосов','<b>Обучение кенку</b>: владение инструментами'],subs:[],d:'Бескрылые птичьи гуманоиды, лишённые голоса — но не хитрости.',c:'#3f5fa8',cl:'#7fb0e8'},
 {n:'Фирболг',en:'Firbolg',size:'Средний',speed:'30 фт',ab:'Мудрость +2, Сила +1',traits:['<b>Магия фирболгов</b>: Обнаружение магии и Маскировка','<b>Шаг фирболга</b>: телепорт на 30 фт','<b>Могучее телосложение</b>','<b>Речь зверей</b>'],subs:[],d:'Тихие лесные великаны-хранители.',c:'#2f7a5a',cl:'#6fc09a'},
 {n:'Дженази',en:'Genasi',size:'Средний',speed:'30 фт',ab:'Телосложение +2',traits:['Наследие стихии: огонь, вода, воздух или земля','Стихийное сопротивление или способность','Тёмное зрение (у огненных)'],subs:['Огненный','Водный','Воздушный','Земной'],d:'Потомки джиннов, несущие силу первородных стихий.',c:'#c23b6b',cl:'#e88ab0'}];
const MONSTERS=[
 {n:'Кобольд',t:'гуманоид',sz:'Маленький',al:'законно-злой',cr:'1/8',crC:'lo',xp:25,ac:12,hp:5,hd:'2d6−2',sp:'30 фт',ab:['Чувствительность к солнцу: помеха при ярком свете','Тактика стаи: преимущество рядом с союзником']},
 {n:'Бандит',t:'гуманоид',sz:'Средний',al:'любой не-добрый',cr:'1/8',crC:'lo',xp:25,ac:12,hp:11,hd:'2d8+2',sp:'30 фт',ab:['Короткий меч и лёгкий арбалет','Ходят шайками под началом капитана (CR 2)']},
 {n:'Гоблин',t:'гуманоид',sz:'Маленький',al:'нейтрально-злой',cr:'1/4',crC:'lo',xp:50,ac:15,hp:7,hd:'2d6',sp:'30 фт',ab:['Тёмное зрение 60 фт','Проворство: Отход, Рывок или Засада бонус-экшеном']},
 {n:'Скелет',t:'нежить',sz:'Средний',al:'законно-злой',cr:'1/4',crC:'lo',xp:50,ac:13,hp:13,hd:'2d8+4',sp:'30 фт',ab:['Уязвимость к дробящему урону','Иммунитет к яду и истощению']},
 {n:'Волк',t:'зверь',sz:'Средний',al:'без мировоззрения',cr:'1/4',crC:'lo',xp:50,ac:13,hp:11,hd:'2d8+2',sp:'40 фт',ab:['Тактика стаи','Сбивание с ног при попадании']},
 {n:'Зомби',t:'нежить',sz:'Средний',al:'нейтрально-злой',cr:'1/4',crC:'lo',xp:50,ac:8,hp:22,hd:'3d8+9',sp:'20 фт',ab:['Живучесть нежити: спасбросок Тел при 0 хитов','Иммунитет к яду']},
 {n:'Рой крыс',t:'зверь (рой)',sz:'Средний',al:'без мировоззрения',cr:'1/4',crC:'lo',xp:50,ac:10,hp:24,hd:'7d8−7',sp:'30 фт',ab:['Рой: проходит в чужое пространство','Иммунитет к состояниям']},
 {n:'Крокодил',t:'зверь',sz:'Большой',al:'без мировоззрения',cr:'1/2',crC:'mid',xp:100,ac:12,hp:19,hd:'3d10+3',sp:'20 фт, плавание 30 фт',ab:['Захват при попадании','Засада в воде']},
 {n:'Орк',t:'гуманоид',sz:'Средний',al:'хаотично-злой',cr:'1/2',crC:'mid',xp:100,ac:13,hp:15,hd:'2d8+6',sp:'30 фт',ab:['Агрессия: рывок к врагу бонус-экшеном','Секира 1к12+3']},
 {n:'Хобгоблин',t:'гуманоид',sz:'Средний',al:'законно-злой',cr:'1/2',crC:'mid',xp:100,ac:18,hp:11,hd:'2d8+2',sp:'30 фт',ab:['Военное преимущество: +2к10 урона рядом с союзником','Дисциплинированные легионы']},
 {n:'Гнолл',t:'гуманоид',sz:'Средний',al:'хаотично-злой',cr:'1/2',crC:'mid',xp:100,ac:15,hp:22,hd:'5d8',sp:'30 фт',ab:['Жажда крови: Рывок после убийства','Демоническое происхождение']},
 {n:'Ворг',t:'зверь',sz:'Большой',al:'нейтрально-злой',cr:'1/2',crC:'mid',xp:100,ac:13,hp:26,hd:'4d10+4',sp:'50 фт',ab:['Кеен слух и нюх','Сбивание с ног']},
 {n:'Гигантский паук',t:'зверь',sz:'Большой',al:'без мировоззрения',cr:'1',crC:'mid',xp:200,ac:14,hp:26,hd:'4d10+4',sp:'30 фт, лазание 30 фт',ab:['Паутина: ловушки и ограничение','Ядовитый укус: 2к8 яда']},
 {n:'Бугбир',t:'гуманоид',sz:'Средний',al:'хаотично-злой',cr:'1',crC:'mid',xp:200,ac:16,hp:27,hd:'5d8+5',sp:'30 фт',ab:['Длиннорукий: досягаемость +5 фт','Подлый: +2к6 по застигнутой цели']},
 {n:'Лютоволк',t:'зверь',sz:'Большой',al:'нейтрально-злой',cr:'1',crC:'mid',xp:200,ac:14,hp:37,hd:'5d10+10',sp:'50 фт',ab:['Кеен слух и нюх','Тактика стаи и сбивание с ног']},
 {n:'Гарпия',t:'монстр',sz:'Средний',al:'хаотично-злой',cr:'1',crC:'mid',xp:200,ac:11,hp:38,hd:'7d8+7',sp:'20 фт, полёт 40 фт',ab:['Гибельная песня: очарование','Когти и дубина']},
 {n:'Упырь',t:'нежить',sz:'Средний',al:'хаотично-злой',cr:'1',crC:'mid',xp:200,ac:12,hp:22,hd:'5d8',sp:'30 фт',ab:['Паралич (не на эльфов и нежить)','Зловонный запах']},
 {n:'Огр',t:'великан',sz:'Большой',al:'хаотично-злой',cr:'2',crC:'hi',xp:450,ac:11,hp:59,hd:'7d10+21',sp:'40 фт',ab:['Дубина: 2к8+3 дробящего','Метание камней']},
 {n:'Желатиновый куб',t:'слизь',sz:'Большой',al:'без мировоззрения',cr:'2',crC:'hi',xp:450,ac:6,hp:84,hd:'8d10+40',sp:'15 фт',ab:['Прозрачный: незаметен','Поглощение и кислота']},
 {n:'Адская гончая',t:'исчадие',sz:'Средний',al:'законно-злой',cr:'3',crC:'hi',xp:700,ac:15,hp:45,hd:'7d8+14',sp:'50 фт',ab:['Огненное дыхание (7к6)','Иммунитет к огню']},
 {n:'Василиск',t:'монстр',sz:'Средний',al:'без мировоззрения',cr:'3',crC:'hi',xp:700,ac:15,hp:52,hd:'8d8+16',sp:'20 фт',ab:['Окаменяющий взгляд','Окаменяющий укус']},
 {n:'Мантикора',t:'монстр',sz:'Большой',al:'законно-злой',cr:'3',crC:'hi',xp:700,ac:14,hp:68,hd:'8d10+24',sp:'30 фт, полёт 50 фт',ab:['Хвостовые шипы: дальнобойная атака','Тёмное зрение']},
 {n:'Минотавр',t:'монстр',sz:'Большой',al:'хаотично-злой',cr:'3',crC:'hi',xp:700,ac:14,hp:76,hd:'9d10+27',sp:'40 фт',ab:['Разъярённый натиск: Рывок и бодание','Лабиринтный разум']},
 {n:'Совомедведь',t:'монстр',sz:'Большой',al:'без мировоззрения',cr:'3',crC:'hi',xp:700,ac:13,hp:59,hd:'7d10+21',sp:'40 фт',ab:['Кеен зрение и нюх','Две атаки когтями и клювом']},
 {n:'Тролль',t:'великан',sz:'Большой',al:'хаотично-злой',cr:'5',crC:'ep',xp:1800,ac:15,hp:84,hd:'8d10+40',sp:'30 фт',ab:['Регенерация +10 хитов (кроме огня/кислоты)','Три атаки: укус и два когтя']},
 {n:'Виверна',t:'дракон',sz:'Большой',al:'без мировоззрения',cr:'6',crC:'ep',xp:2300,ac:13,hp:110,hd:'13d10+39',sp:'20 фт, полёт 80 фт',ab:['Ядовитое жало: 7к6 яда','Пикирующая атака']},
 {n:'Иллитид',t:'аберрация',sz:'Средний',al:'законно-злой',cr:'7',crC:'ep',xp:2900,ac:15,hp:71,hd:'13d8+13',sp:'30 фт',ab:['Взрыв разума: урон и оглушение','Извлечение мозга и псионика']},
 {n:'Молодой зелёный дракон',t:'дракон',sz:'Большой',al:'законно-злой',cr:'8',crC:'ep',xp:3900,ac:18,hp:136,hd:'16d10+48',sp:'40 фт, полёт 80 фт, плавание 40 фт',ab:['Ядовитое дыхание (12к6 яда)','Амфибия']},
 {n:'Молодой красный дракон',t:'дракон',sz:'Большой',al:'хаотично-злой',cr:'10',crC:'ep',xp:5900,ac:18,hp:178,hd:'17d10+85',sp:'40 фт, полёт 80 фт, лазание 40 фт',ab:['Огненное дыхание (16к6)','Иммунитет к огню']},
 {n:'Бехолдер',t:'аберрация',sz:'Большой',al:'законно-злой',cr:'13',crC:'ep',xp:10000,ac:18,hp:180,hd:'19d10+76',sp:'0 фт, полёт 20 фт',ab:['Анти-магический конус','10 глазных лучей']},
 {n:'Вампир',t:'нежить',sz:'Средний',al:'законно-злой',cr:'13',crC:'ep',xp:10000,ac:16,hp:144,hd:'17d8+68',sp:'30 фт',ab:['Укус: некротический урон + лечение','Туман, регенерация, слабости']},
 {n:'Лич',t:'нежить',sz:'Средний',al:'любой злой',cr:'21',crC:'ep',xp:33000,ac:17,hp:135,hd:'18d8+54',sp:'30 фт',ab:['Заклинатель 18-го уровня','Легендарное сопротивление, филактерия']}];
function renderBooks(){
  $('#classesGrid').innerHTML=CLASSES.map((c,i)=>`<div class="card cls rv" style="--acc:${c.c};--acc-l:${c.cl};transition-delay:${Math.min(i,8)*40}ms"><div class="seal">${c.n[0]}</div><h4>${c.n}</h4><div class="src">${c.en} · ${c.src}</div><span class="tag">кость ${c.hd}</span><span class="tag">${c.ab}</span><span class="tag">${c.cast}</span><dl class="kv"><dt>Спасброски</dt><dd>${c.sv}</dd><dt>Доспехи</dt><dd>${c.armor}</dd><dt>Оружие</dt><dd>${c.weap}</dd></dl><details><summary>Ключевые умения</summary><ul class="fl">${c.feat.map(f=>`<li>${f}</li>`).join('')}</ul></details><div class="subs">${c.subs.map(s=>`<i>${s}</i>`).join('')}</div></div>`).join('');
  $('#racesGrid').innerHTML=RACES.map((r,i)=>`<div class="card rv" style="--acc:${r.c};--acc-l:${r.cl};transition-delay:${Math.min(i,8)*40}ms"><div class="seal">${r.n[0]}</div><h4>${r.n}</h4><div class="src">${r.en} · ${r.size} · скорость ${r.speed}</div><span class="tag">${r.ab}</span><ul class="fl">${r.traits.map(t=>`<li>${t}</li>`).join('')}</ul>${r.subs.length?`<div class="subs">${r.subs.map(s=>`<i>${s}</i>`).join('')}</div>`:''}<p style="margin-top:10px">${r.d}</p></div>`).join('');
  initMonFilters();renderMonsters();}
function initMonFilters(){const ord={'1/8':.125,'1/4':.25,'1/2':.5};
  const crs=[...new Set(MONSTERS.map(m=>m.cr))].sort((a,b)=>(ord[a]||+a)-(ord[b]||+b));
  $('#monCr').innerHTML='<option value="">Любая опасность (CR)</option>'+crs.map(c=>`<option value="${c}">CR ${c}</option>`).join('');
  const tys=[...new Set(MONSTERS.map(m=>m.t))].sort();
  $('#monType').innerHTML='<option value="">Любой тип</option>'+tys.map(t=>`<option value="${t}">${t}</option>`).join('');
  $('#monSearch').addEventListener('input',renderMonsters);['monCr','monType'].forEach(id=>$('#'+id).addEventListener('change',renderMonsters));}
function renderMonsters(){const q=($('#monSearch').value||'').toLowerCase(),cr=$('#monCr').value,ty=$('#monType').value;
  const list=MONSTERS.filter(m=>m.n.toLowerCase().includes(q)&&(!cr||m.cr===cr)&&(!ty||m.t===ty));
  $('#monGrid').innerHTML=list.map((m,i)=>`<div class="card mon rv" style="--acc:#a3322b;--acc-l:#e0705f;transition-delay:${Math.min(i,8)*35}ms"><div class="mhead"><div><h4>${m.n}</h4><div class="xp">${m.sz} ${m.t} · ${m.al} · ${m.xp} XP</div></div><span class="cr ${m.crC}">CR ${m.cr}</span></div><div class="mstats"><span class="ms"><b>${m.ac}</b>КД</span><span class="ms"><b>${m.hp}</b>хиты</span><span class="ms"><b>${m.hd}</b>кости</span><span class="ms"><b>${m.sp}</b>скорость</span></div><p>${m.ab.map(a=>'• '+a).join('<br>')}</p></div>`).join('')||'<p class="hand" style="color:#6b5836">Никого не нашли… Может, оно и к лучшему.</p>';
  revealScan();}
const RULES=[
 {t:'Что такое D&D',icon:'🏰',html:`<p>D&D — это <b>совместное рассказывание истории</b>, где исход действий решает бросок костей. Один игрок становится <b>Мастером</b>: описывает мир, играет за неигровых персонажей и судит правила. Остальные — <b>игроки</b>, каждый ведёт своего героя.</p><h5>Игровой цикл</h5><p>1. Мастер описывает обстановку. → 2. Игроки говорят, что делают герои. → 3. Мастер описывает последствия (иногда через бросок).</p><div class="callout tip">Мастер играет <b>вместе</b> с вами, а не против. Цель у всех одна — интересная история.</div><div class="callout">Правила не учитывают всё. Когда ситуация не описана — решение принимает Мастер.</div>`},
 {t:'Кости и обозначения',icon:'🎲',html:`<p>Кости: <b>к4, к6, к8, к10, к12, к20</b>. Запись <b>«3к8 + 5»</b>: брось три к8, сложи и прибавь 5.</p><p><b>к100</b> — два к10: десятки и единицы. Два нуля = 100.</p><div class="callout">Король игры — <b>к20 (d20)</b>. Им решается почти всё важное.</div>`},
 {t:'Ядро: бросок к20',icon:'⚖️',html:`<p><b>1.</b> Брось к20 + модификатор (иногда + мастерство). <b>2.</b> Примени бонусы/штрафы. <b>3.</b> Сравни с целевым числом: равно или больше — успех.</p><h5>Три вида бросков</h5><div class="pill-row"><span class="pill"><b>Проверка характеристики</b></span><span class="pill"><b>Спасбросок</b></span><span class="pill"><b>Бросок атаки</b></span></div><p>Цель для проверок и спасбросков — <b>Сложность (Сл)</b>, для атак — <b>Класс Доспеха (КД)</b>.</p><div class="callout warn"><b>«20» на атаке</b> — автопопадание и <b>крит</b> (кости урона ×2). <b>«1»</b> — автопромах.</div>`},
 {t:'Шесть характеристик',icon:'💪',html:`<p>Модификатор: <b>(значение − 10) / 2</b>, округлить вниз.</p><table class="rtbl"><tr><th>Характеристика</th><th>Что отражает</th></tr><tr><td><b>Сила</b></td><td>Мощь, атлетика</td></tr><tr><td><b>Ловкость</b></td><td>Проворство, реакция</td></tr><tr><td><b>Телосложение</b></td><td>Выносливость</td></tr><tr><td><b>Интеллект</b></td><td>Память, логика</td></tr><tr><td><b>Мудрость</b></td><td>Внимательность, интуиция</td></tr><tr><td><b>Харизма</b></td><td>Сила личности</td></tr></table><h5>Значение → модификатор</h5><table class="rtbl"><tr><th>Значение</th><th>1</th><th>2–3</th><th>4–5</th><th>6–7</th><th>8–9</th><th>10–11</th><th>12–13</th><th>14–15</th><th>16–17</th><th>18–19</th><th>20</th></tr><tr><td><b>Мод.</b></td><td>−5</td><td>−4</td><td>−3</td><td>−2</td><td>−1</td><td>+0</td><td>+1</td><td>+2</td><td>+3</td><td>+4</td><td>+5</td></tr></table>`},
 {t:'Преимущество и помеха',icon:'⚡',html:`<p>Бросаешь <b>второй к20</b>:</p><div class="pill-row"><span class="pill"><b>Преимущество</b> — берёшь больший</span><span class="pill"><b>Помеха</b> — берёшь меньший</span></div><p>Дополнительный кубик только один. Преимущество и помеха вместе <b>отменяются</b>.</p>`},
 {t:'Бонус мастерства',icon:'🎖️',html:`<p>Растёт с уровнем. Добавляется к атакам своим оружием, «своим» навыкам и спасброскам.</p><table class="rtbl"><tr><th>Уровень</th><th>1–4</th><th>5–8</th><th>9–12</th><th>13–16</th><th>17–20</th></tr><tr><td><b>Бонус</b></td><td>+2</td><td>+3</td><td>+4</td><td>+5</td><td>+6</td></tr></table><div class="callout">Добавляется <b>максимум один раз</b>. «Компетентность» удваивает его для выбранных навыков.</div>`},
 {t:'Навыки',icon:'📜',html:`<p>Владение навыком = + бонус мастерства к таким проверкам.</p><table class="rtbl"><tr><th>Характеристика</th><th>Навыки</th></tr><tr><td><b>Сила</b></td><td>Атлетика</td></tr><tr><td><b>Ловкость</b></td><td>Акробатика, Ловкость рук, Скрытность</td></tr><tr><td><b>Интеллект</b></td><td>История, Магия, Природа, Расследование, Религия</td></tr><tr><td><b>Мудрость</b></td><td>Восприятие, Выживание, Медицина, Проницательность, Уход за животными</td></tr><tr><td><b>Харизма</b></td><td>Выступление, Запугивание, Обман, Убеждение</td></tr></table><p><b>Пассивная проверка</b>: <b>10 + модификаторы</b> (без броска).</p>`},
 {t:'Сложность и проверки',icon:'🎯',html:`<table class="rtbl"><tr><th>Трудность</th><th>Очень лёгкая</th><th>Лёгкая</th><th>Средняя</th><th>Сложная</th><th>Очень сложная</th><th>Почти невозможная</th></tr><tr><td><b>Сл</b></td><td>5</td><td>10</td><td>15</td><td>20</td><td>25</td><td>30</td></tr></table><p><b>Состязание</b>: оба бросают проверку — побеждает больший результат.</p><p><b>Групповая проверка</b>: успех у половины = успех группы.</p>`},
 {t:'Бой',icon:'⚔️',html:`<p>Все бросают <b>инициативу</b> (проверка Ловкости) — порядок ходов. Бой идёт <b>раундами</b>.</p><h5>На своём ходу</h5><p><b>Перемещение</b> (на скорость), одно <b>действие</b>, одно <b>бонусное действие</b>, одна <b>реакция</b>.</p><div class="pill-row"><span class="pill"><b>Атака</b></span><span class="pill"><b>Рывок</b></span><span class="pill"><b>Отход</b></span><span class="pill"><b>Засада</b></span><span class="pill"><b>Уклонение</b></span><span class="pill"><b>Помощь</b></span><span class="pill"><b>Поиск</b></span><span class="pill"><b>Готовность</b></span></div><h5>Укрытия</h5><table class="rtbl"><tr><th>Укрытие</th><th>Бонус к КД и спасброскам Ловкости</th></tr><tr><td><b>Наполовину</b></td><td>+2</td></tr><tr><td><b>На три четверти</b></td><td>+5</td></tr><tr><td><b>Полное</b></td><td>нельзя атаковать напрямую</td></tr></table>`},
 {t:'Хиты, урон и смерть',icon:'❤️',html:`<p><b>Хиты (HP)</b> — запас прочности. На <b>0 хитов</b> герой без сознания.</p><p><b>Сопротивление</b> — урон пополам. <b>Уязвимость</b> — вдвое. Округление вниз.</p><h5>Спасброски от смерти</h5><p>Каждый ход с 0 хитов: к20, <b>10+</b> — успех. <b>3 успеха</b> — стабилизация, <b>3 провала</b> — смерть. «1» = два провала, «20» = 1 хит.</p><div class="callout warn"><b>Мгновенная смерть</b>: если остаток урона ≥ максимума хитов — гибель сразу.</div>`},
 {t:'Магия',icon:'✨',html:`<p><b>Заговоры</b> — без ограничений. Остальные заклинания тратят <b>ячейки</b> (восстанавливаются отдыхом).</p><div class="fgrid"><div class="fcard"><div class="fn">Сл спасброска</div><code>8 + мод. характеристики + мастерство</code></div><div class="fcard"><div class="fn">Атака заклинанием</div><code>мод. характеристики + мастерство</code></div></div><p><b>Компоненты</b>: В (слова), С (жесты), М (материалы). <b>Концентрация</b>: получил урон — бросай Телосложение, иначе заклинание спадёт.</p>`},
 {t:'Отдых, формулы, правила',icon:'🛌',html:`<p><b>Короткий отдых</b> (≈1 ч): трата Костей Хитов на лечение. <b>Длинный отдых</b> (≈8 ч): полные хиты и половина Костей Хитов.</p><h5>Шпаргалка формул</h5><div class="fgrid"><div class="fcard"><div class="fn">Модификатор</div><code>(значение − 10) / 2 ↓</code></div><div class="fcard"><div class="fn">КД без доспеха</div><code>10 + мод. Ловкости</code></div><div class="fcard"><div class="fn">Инициатива</div><code>1к20 + мод. Ловкости</code></div><div class="fcard"><div class="fn">Пассивное Восприятие</div><code>10 + мод. Мудрости (+мастерство)</code></div><div class="fcard"><div class="fn">Атака оружием</div><code>1к20 + мод. Силы/Ловк. + мастерство</code></div><div class="fcard"><div class="fn">Урон оружием</div><code>кость + мод. Силы/Ловк. (мастерство НЕТ)</code></div><div class="fcard"><div class="fn">Безоружный удар</div><code>1 + мод. Силы</code></div><div class="fcard"><div class="fn">Спасбросок</div><code>1к20 + мод. хар-ки (+мастерство)</code></div><div class="fcard"><div class="fn">Грузоподъёмность</div><code>Сила × 15 фунтов</code></div><div class="fcard"><div class="fn">Крит</div><code>удвой кости урона (модификатор — нет)</code></div></div><h5>Два золотых правила</h5><div class="callout"><b>Частное превосходит общее.</b> Умение/заклинание/раса важнее общего правила.</div><div class="callout"><b>Округление вниз.</b> Любое деление округляется в меньшую сторону.</div>`}];
function renderRules(){$('#rulesNav').innerHTML=RULES.map((r,i)=>`<button data-r="${i}">${r.icon}&nbsp; ${r.t}</button>`).join('');
  $('#rulesBody').innerHTML=RULES.map((r,i)=>`<div class="rsec" id="rsec${i}"><details${i===0?' open':''}><summary><span class="ric">${r.icon}</span>${r.t}<span class="arr">▶</span></summary><div class="rbody">${r.html}</div></details></div>`).join('');
  $$('#rulesNav [data-r]').forEach(b=>b.onclick=()=>{$('#rsec'+b.dataset.r+' details').open=true;$$('#rulesNav button').forEach(x=>x.classList.toggle('on',x===b));$('#rsec'+b.dataset.r).scrollIntoView({behavior:'smooth',block:'start'});});}

/* ══ 6. ЗАМЕТКИ / КВЕСТЫ / ПРЕДМЕТЫ / ПЕРСОНАЖИ ══ */
let editNote=null;
async function renderNotes(){const ns=(await DB.all('notes')).sort((a,b)=>b.time-a.time);
  $('#notesGrid').innerHTML=ns.map(n=>`<div class="note" style="--tilt:${(n.id.charCodeAt(4)%9-4)/4}deg"><button class="nx" data-del="${n.id}">✕</button><h4 data-edit="${n.id}">${esc(n.title)}</h4>${esc(n.body).replace(/\n/g,'<br>')}<div class="when">${new Date(n.time).toLocaleDateString('ru-RU')}</div></div>`).join('')||'<p class="hand" style="color:#6b5836">Летопись пуста.</p>';
  $$('.note [data-del]').forEach(b=>b.onclick=async()=>{await DB.del('notes',b.dataset.del);renderNotes();toast('Страница вырвана');});
  $$('.note [data-edit]').forEach(h=>h.onclick=async()=>{const n=ns.find(x=>x.id===h.dataset.edit);if(!n)return;editNote=n.id;$('#noteTitle').value=n.title;$('#noteBody').value=n.body;$('#noteSave').textContent='Обновить';$('#noteTitle').scrollIntoView({behavior:'smooth',block:'center'});});}
$('#noteSave').onclick=async()=>{const t=$('#noteTitle').value.trim(),b=$('#noteBody').value.trim();if(!t&&!b)return;await DB.put('notes',{id:editNote||uid(),title:t||'Без названия',body:b,time:Date.now()});editNote=null;$('#noteTitle').value='';$('#noteBody').value='';$('#noteSave').textContent='Записать';renderNotes();toast('✒ Записано в летопись');};
const QCOLS={act:'#qAct',done:'#qDone',fail:'#qFail'};
async function renderQuests(){const qs=await DB.all('quests');const dm=isDM();
  for(const k in QCOLS){const l=qs.filter(q=>q.st===k);
    $(QCOLS[k]).innerHTML=l.map(q=>`<div class="quest"><b>${esc(q.title)}</b><p>${esc(q.desc)}</p>${q.rew?`<span class="rw">Награда: ${esc(q.rew)}</span>`:''}<div class="qa"><button class="qbtn" data-mv="${q.id}|prev" ${dm?'':'disabled'}>‹</button><button class="qbtn" data-mv="${q.id}|next" ${dm?'':'disabled'}>›</button><button class="qbtn" data-qd="${q.id}" style="margin-left:auto" ${dm?'':'disabled'}>✕</button></div></div>`).join('')||'<p class="hand" style="color:#6b5836;font-size:13px">пусто</p>';
    $('#qc'+k[0].toUpperCase()).textContent=l.length;}
  const ord=['act','done','fail'];
  $$('[data-mv]').forEach(b=>b.onclick=async()=>{if(!isDM())return;const[id,d]=b.dataset.mv.split('|');const q=await DB.get('quests',id);let i=ord.indexOf(q.st)+(d==='next'?1:-1);q.st=ord[Math.max(0,Math.min(2,i))];await DB.put('quests',q);renderQuests();RTC.send({type:'quest',q});});
  $$('[data-qd]').forEach(b=>b.onclick=async()=>{if(!isDM())return;await DB.del('quests',b.dataset.qd);renderQuests();RTC.send({type:'questdel',id:b.dataset.qd});});}
$('#qAdd').onclick=async()=>{const t=$('#qTitle').value.trim();if(!t)return;const q={id:uid(),title:t,desc:$('#qDesc').value.trim(),rew:$('#qRew').value.trim(),st:'act'};await DB.put('quests',q);$('#qTitle').value=$('#qDesc').value=$('#qRew').value='';renderQuests();toast('📜 Квест взят!');RTC.send({type:'quest',q});};
const ITYPES={'Оружие':['#c96a2b','#f0a05e'],'Броня':['#4f7fd1','#7fb0e8'],'Зелье':['#2f7a5a','#6fc09a'],'Свиток':['#b08a2e','#f2c14e'],'Разное':['#7a4a8a','#b98ad0']};
async function renderItems(){const its=await DB.all('items');
  $('#itemsList').innerHTML=its.map(i=>{const[c,cl]=ITYPES[i.type]||ITYPES['Разное'];return `<div class="item"><span class="iseal" style="background:radial-gradient(circle at 35% 30%,${cl},${c})">${i.type[0]}</span><div><b style="color:var(--parch)">${esc(i.name)}</b><div class="hand" style="font-size:13px;color:#6b5836">${i.type}</div></div><span class="qty">×${i.qty}</span><button class="qbtn" data-idel="${i.id}">✕</button></div>`;}).join('')||'<p class="hand" style="color:#6b5836">Сумка пуста.</p>';
  $$('[data-idel]').forEach(b=>b.onclick=async()=>{await DB.del('items',b.dataset.idel);renderItems();});}
$('#itAdd').onclick=async()=>{const n=$('#itName').value.trim();if(!n)return;await DB.put('items',{id:uid(),name:n,type:$('#itType').value,qty:+$('#itQty').value||1});$('#itName').value='';$('#itQty').value=1;renderItems();toast('🎒 Предмет в сумке');};
function ownsChar(c){return isDM()||(S.session&&S.charId===c.id);}
async function renderChars(){const cs=await DB.all('chars');
  $('#charsGrid').innerHTML=cs.map(c=>{const pct=Math.max(0,Math.min(100,c.hp/c.hpMax*100));const mine=S.charId===c.id;const canEdit=ownsChar(c);
    return `<div class="char${mine?' mine':''}"><div class="top"><span class="useal" style="width:46px;height:46px;font-size:20px">${esc(c.name[0])}</span><div><h4>${esc(c.name)}${mine?'<span class="mine-tag">твой герой</span>':''}</h4><div class="rc">${esc(c.race)} · ${esc(c.cls)} · ${c.lvl} ур.</div></div><button class="qbtn" data-cdel="${c.id}" style="margin-left:auto" ${isDM()?'':'disabled'}>✕</button></div><div class="hpline"><span>HP <b style="color:var(--parch)">${c.hp}</b>/${c.hpMax}</span><span class="hpctl"><button data-hp="${c.id}|-1" ${canEdit?'':'disabled'}>−</button><button data-hp="${c.id}|1" ${canEdit?'':'disabled'}>+</button></span></div><div class="hpbar"><i style="width:${pct}%"></i></div><div class="achips"><span class="achip"><b>${c.ac}</b>AC</span><span class="achip"><b>${c.lvl}</b>уровень</span></div>${(!mine&&!isDM()&&S.session&&S.session.role==='pl')?`<button class="btn ghost sm" data-claim="${c.id}" style="margin-top:10px;width:100%">Это мой герой</button>`:''}</div>`;}).join('')||'<p class="hand" style="color:#6b5836">Героев пока нет.</p>';
  $$('[data-hp]').forEach(b=>b.onclick=async()=>{const[id,d]=b.dataset.hp.split('|');const c=await DB.get('chars',id);if(!ownsChar(c))return;c.hp=Math.max(0,Math.min(c.hpMax,c.hp+ +d));await DB.put('chars',c);renderChars();RTC.send({type:'char',c});});
  $$('[data-cdel]').forEach(b=>b.onclick=async()=>{if(!isDM())return;await DB.del('chars',b.dataset.cdel);renderChars();RTC.send({type:'chardel',id:b.dataset.cdel});});
  $$('[data-claim]').forEach(b=>b.onclick=()=>{S.charId=b.dataset.claim;localStorage.setItem('d20charId',JSON.stringify(S.charId));renderChars();toast('Герой закреплён за тобой');});}
$('#btnCharForm').onclick=()=>{const f=$('#charForm');f.style.display=f.style.display==='none'?'block':'none';};
$('#chSave').onclick=async()=>{const n=$('#chName').value.trim();if(!n)return;const c={id:uid(),name:n,race:$('#chRace').value||'?',cls:$('#chClass').value||'?',lvl:+$('#chLvl').value||1,hp:+$('#chHp').value||10,hpMax:+$('#chHp').value||10,ac:+$('#chAc').value||13};await DB.put('chars',c);$('#chName').value='';$('#charForm').style.display='none';renderChars();toast('⚔ Герой в партии!');RTC.send({type:'char',c});};

/* ══ 7. КАРТА, ФИШКИ, ЛИСТЫ, БИБЛИОТЕКА ══ */
const board=$('#board');let tokColor='#c0392b',drag=null,curMapObjUrl=null;
const PALETTE=['#c0392b','#2e6fd8','#2f9e63','#d8a02e','#8e44ad','#e67e22','#4aa3a3','#7f8c8d'];
$('#swatches').innerHTML=PALETTE.map(c=>`<span class="sw${c===tokColor?' on':''}" data-c="${c}" style="background:${c}"></span>`).join('');
$$('.sw').forEach(s=>s.onclick=()=>{tokColor=s.dataset.c;$$('.sw').forEach(x=>x.classList.toggle('on',x===s));});
function mapGates(){const dm=isDM();$('#btnUpload').style.display=dm?'grid':'none';$('#btnDelMap').style.display=dm?'grid':'none';$('#btnClearTok').style.display=dm?'grid':'none';$('#saveMap').style.display=dm?'inline-block':'none';$('#mapHint').textContent=dm?'ты Мастер: карта, фишки и их листы':(S.session?'ты Игрок: двигай свои фишки, листы открывает Мастер':'гость: войди, чтобы действовать');}
$('#btnUpload').onclick=()=>$('#mapFile').click();
$('#mapFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=async()=>{S.mapData=rd.result;S.mapName=f.name;await DB.put('kv',{id:'map',blob:f,name:f.name});setBoard(URL.createObjectURL(f));toast('🗺 Карта разложена','crit');RTC.conns.forEach(c=>{if(c.open)RTC.sendFileTo(c,'map',{id:'map'},rd.result);});};rd.readAsDataURL(f);};
function setBoard(url){if(curMapObjUrl)URL.revokeObjectURL(curMapObjUrl);curMapObjUrl=url;S.mapUrl=url;board.style.backgroundImage=`url('${url}')`;$('#boardMsg').style.display='none';}
$('#btnGrid').onclick=()=>{S.grid=!S.grid;board.classList.toggle('grid',S.grid);$('#btnGrid').classList.toggle('off',!S.grid);};
$('#btnSnap').onclick=()=>{S.snap=!S.snap;$('#btnSnap').classList.toggle('off',!S.snap);};
$('#btnAddFocus').onclick=()=>{$('#tokName').focus();$('#tokName').scrollIntoView({behavior:'smooth',block:'center'});};
$('#btnFull').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else if(board.requestFullscreen)board.requestFullscreen();};
$('#btnDelMap').onclick=()=>{if(!isDM())return;S.mapData=null;S.mapName=null;if(curMapObjUrl)URL.revokeObjectURL(curMapObjUrl);curMapObjUrl=null;S.mapUrl=null;board.style.backgroundImage='';$('#boardMsg').style.display='grid';toast('Карта убрана со стола');};
$('#btnClearTok').onclick=async()=>{if(!isDM())return;for(const t of S.tokens)await DB.del('tokens',t.id);S.tokens=[];renderToks();RTC.send({type:'tokclear'});toast('Стол очищен');};
function canMove(owner){return isDM()||!owner||(S.session&&owner===S.session.name);}
async function renderToks(pulseId){board.querySelectorAll('.tok').forEach(t=>t.remove());
  S.tokens.forEach(t=>{const el=document.createElement('div');el.className='tok';el.dataset.id=t.id;el.dataset.owner=t.owner||'';el.style.left=t.x+'%';el.style.top=t.y+'%';el.style.background=`radial-gradient(circle at 35% 30%, ${t.color}ee, ${t.color} 55%, #00000066)`;
    const hasSheet=t.sheet&&(isDM()||t.sheet.revealed);
    el.innerHTML=`<span>${esc((t.name||'?')[0].toUpperCase())}</span><span class="tn">${esc(t.name)}</span>${hasSheet?'<span class="tbadge">📋</span>':''}<button class="tx" data-del="${t.id}">✕</button>`;
    if(t.id===pulseId)el.classList.add('pulse');board.appendChild(el);});
  $$('[data-del]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(isDM()||canMove(S.tokens.find(t=>t.id===b.dataset.del)?.owner))removeTok(b.dataset.del);});}
function removeTok(id){S.tokens=S.tokens.filter(t=>t.id!==id);DB.del('tokens',id);renderToks();RTC.send({type:'tokdel',id});}
$('#btnAddTok').onclick=async()=>{const n=$('#tokName').value.trim()||'Безымянный';const t={id:uid(),name:n,color:tokColor,x:40+Math.random()*20,y:40+Math.random()*20,owner:S.session?.name||'',sheet:{hp:10,hpMax:10,ac:10,notes:'',revealed:false}};S.tokens.push(t);await DB.put('tokens',t);renderToks(t.id);RTC.send({type:'tok',t});$('#tokName').value='';};
board.addEventListener('pointerdown',e=>{const el=e.target.closest('.tok');if(!el)return;if(e.target.closest('.tx'))return;const t=S.tokens.find(x=>x.id===el.dataset.id);if(!t)return;drag={t,el,sx:e.clientX,sy:e.clientY,moved:false,pid:e.pointerId};});
board.addEventListener('pointermove',e=>{if(!drag)return;
  if(!drag.moved){if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<6)return;drag.moved=true;if(!canMove(drag.t.owner)){toast('Чужая фишка — двигает владелец или Мастер','fail');drag=null;return;}drag.el.classList.add('drag');try{drag.el.setPointerCapture(drag.pid);}catch(_){}}
  const r=board.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;x=Math.max(2,Math.min(98,x));y=Math.max(3,Math.min(96,y));if(S.snap){const cw=48/r.width*100,ch=48/r.height*100;x=Math.round(x/cw)*cw;y=Math.round(y/ch)*ch;}drag.t.x=x;drag.t.y=y;drag.el.style.left=x+'%';drag.el.style.top=y+'%';if(!drag.th){drag.th=true;requestAnimationFrame(()=>{drag.th=false;if(drag)RTC.send({type:'tok',t:drag.t});});}});
board.addEventListener('pointerup',async()=>{if(!drag)return;if(!drag.moved){openSheet(drag.t);drag=null;return;}drag.el.classList.remove('drag');await DB.put('tokens',drag.t);RTC.send({type:'tok',t:drag.t});drag=null;});
function openSheet(t){const dm=isDM();if(!t.sheet)t.sheet={hp:10,hpMax:10,ac:10,notes:'',revealed:false};const sh=t.sheet;
  $('#sheetTitle').textContent='📋 '+t.name;
  if(dm){$('#sheetSub').textContent='лист фишки · игроки увидят, только если открыть';
    $('#sheetBody').innerHTML=`<div class="shgrid"><label class="f">Хиты (HP)<input id="shHp" type="number" value="${sh.hp}"></label><label class="f">Макс. HP<input id="shHpMax" type="number" value="${sh.hpMax}"></label><label class="f">КД (AC)<input id="shAc" type="number" value="${sh.ac}"></label><label class="f">Владелец<input value="${esc(t.owner||'—')}" disabled></label><label class="f" style="grid-column:1/-1">Заметки<textarea id="shNotes" style="min-height:80px">${esc(sh.notes)}</textarea></label></div>
    <label class="shrev"><input type="checkbox" id="shRev" ${sh.revealed?'checked':''}> <span>Показывать лист игрокам</span></label>
    <button class="btn gold" id="shSave" style="width:100%">Сохранить лист</button>`;
    $('#shSave').onclick=async()=>{t.sheet={hp:+$('#shHp').value||0,hpMax:+$('#shHpMax').value||0,ac:+$('#shAc').value||0,notes:$('#shNotes').value,revealed:$('#shRev').checked};await DB.put('tokens',t);RTC.send({type:'tok',t});renderToks();closeModal('sheetModal');toast('📋 Лист сохранён');};
  }else{
    if(sh.revealed){$('#sheetSub').textContent='лист открыт Мастером';
      $('#sheetBody').innerHTML=`<div class="shstats"><span class="ms"><b>${sh.hp}/${sh.hpMax}</b>HP</span><span class="ms"><b>${sh.ac}</b>КД</span></div>${sh.notes?`<div class="shnotes">${esc(sh.notes).replace(/\n/g,'<br>')}</div>`:'<p class="hand" style="color:#6b5836">Заметок нет.</p>'}`;}
    else{$('#sheetSub').textContent='';$('#sheetBody').innerHTML=`<div class="shhidden">🙈 Мастер пока скрыл этот лист</div>`;}
  }
  $('#sheetModal').classList.add('open');}
$('#btnLib').onclick=()=>{renderMapLib();$('#libModal').classList.add('open');};
let libObjUrls=[];
async function renderMapLib(){const ms=(await DB.all('maps')).sort((a,b)=>b.time-a.time);const dm=isDM();
  libObjUrls.forEach(u=>URL.revokeObjectURL(u));libObjUrls=[];
  $('#mapLib').innerHTML=ms.length?ms.map(m=>{const u=URL.createObjectURL(m.blob);libObjUrls.push(u);
    return `<div class="librow"><img src="${u}"><div><b>${esc(m.name)}</b><div class="hand" style="font-size:12px;color:#6b5836">${new Date(m.time).toLocaleDateString('ru-RU')} · фишек: ${(m.tokens||[]).length}</div></div>${dm?`<button class="qbtn" data-mload="${m.id}" title="Загрузить">⬆</button><button class="qbtn" data-mdel="${m.id}" title="Удалить">✕</button>`:''}</div>`;}).join(''):'<p class="hand" style="color:#6b5836">Библиотека пуста.</p>'+(dm?'':'<p class="hand" style="color:#6b5836;font-size:13px">Загружает карту Мастер.</p>');
  $$('[data-mload]').forEach(b=>b.onclick=()=>loadMap(b.dataset.mload));
  $$('[data-mdel]').forEach(b=>b.onclick=async()=>{await DB.del('maps',b.dataset.mdel);renderMapLib();toast('Карта удалена из библиотеки');});}
$('#saveMap').onclick=async()=>{if(!isDM())return;if(!S.mapData){toast('Сначала загрузи карту на стол','fail');return;}
  const blob=await (await fetch(S.mapData)).blob();
  await DB.put('maps',{id:uid(),name:S.mapName||('Локация '+new Date().toLocaleDateString('ru-RU')),blob,time:Date.now(),tokens:JSON.parse(JSON.stringify(S.tokens))});
  renderMapLib();toast('💾 Карта сохранена в библиотеку','crit');};
async function loadMap(id){if(!isDM())return;const m=await DB.get('maps',id);if(!m)return;
  S.mapData=await blobToDataUrl(m.blob);S.mapName=m.name;setBoard(URL.createObjectURL(m.blob));
  if(m.tokens){for(const t of S.tokens)await DB.del('tokens',t.id);S.tokens=JSON.parse(JSON.stringify(m.tokens));for(const t of S.tokens)await DB.put('tokens',t);renderToks();RTC.send({type:'tokclear'});S.tokens.forEach(t=>RTC.send({type:'tok',t}));}
  RTC.conns.forEach(c=>{if(c.open)RTC.sendFileTo(c,'map',{id:'map'},S.mapData);});
  closeModal('libModal');toast('🗺 Загружено: '+esc(m.name),'crit');}

/* ══ 8. КУБИКИ ══ */
const DICE=[{s:4,g:'gBlue',d:'M32 5 60 57 4 57Z',f:'M32 5V38M60 57 32 38M4 57 32 38',ty:50,fs:12},{s:6,g:'gBlue',d:'M14 7h36q7 0 7 7v36q0 7-7 7H14q-7 0-7-7V14q0-7 7-7z',f:'M12 20q0-8 8-8',ty:38,fs:15},{s:8,g:'gBlue',d:'M32 4 60 32 32 60 4 32Z',f:'M4 32h56M32 4v12M32 48v12',ty:38,fs:14},{s:10,g:'gBlue',d:'M32 4 58 30 46 60 18 60 6 30Z',f:'M6 30h52',ty:47,fs:13},{s:12,g:'gRed',d:'M21 6h22l17 26-28 28L4 32Z',f:'M24 13h16l12 18-20 20-20-20z',ty:38,fs:14},{s:20,g:'gBlue',d:'M32 3 57 17v30L32 61 7 47V17Z',f:'M32 15 48 42H16ZM32 3v12M57 17 32 15M57 17 48 42M57 47 48 42M32 61 48 42M32 61 16 42M7 47 16 42M7 17 16 42M7 17 32 15',ty:38,fs:13},{s:100,g:'gBlack',d:'M32 4 58 30 46 60 18 60 6 30Z',f:'M6 30h52',ty:47,fs:12,txt:'%'}];
function dieSVG(d){return `<svg viewBox="0 0 64 64" width="58"><path d="${d.d}" fill="url(#${d.g})" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/><path d="${d.f}" stroke="rgba(255,255,255,.3)" stroke-width="1.1" fill="none"/><text x="32" y="${d.ty}" text-anchor="middle" font-family="Alegreya" font-weight="700" font-size="${d.fs}" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width=".6" paint-order="stroke">${d.txt||d.s}</text></svg>`;}
$('#tray').innerHTML=DICE.map(d=>`<button class="die" data-s="${d.s}">${dieSVG(d)}<span>d${d.s}</span></button>`).join('');
$$('#tray .die').forEach(b=>b.onclick=()=>{const s=+b.dataset.s;const ex=S.terms.find(t=>t.s===s);if(ex)ex.n=Math.min(12,ex.n+1);else S.terms.push({n:1,s});b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');tick(440+s*2,.07);renderFormula();});
function renderFormula(){$('#chipsRow').innerHTML=S.terms.map((t,i)=>`<span class="chip">${t.n}d${t.s}<button data-rm="${i}">✕</button></span>`).join('');$$('[data-rm]').forEach(b=>b.onclick=()=>{S.terms.splice(+b.dataset.rm,1);renderFormula();});const p=+$('#prof').value||0,m=+$('#mod').value||0;const parts=S.terms.map(t=>`${t.n}d${t.s}`);if(!parts.length)parts.push('—');$('#formulaBox').textContent=`(${parts.join(' + ')} + ${p} + ${m})`;}
$('#prof').oninput=$('#mod').oninput=renderFormula;
function formulaStr(){const p=+$('#prof').value||0,m=+$('#mod').value||0;return `(${S.terms.map(t=>`${t.n}d${t.s}`).join('+')}+${p}+${m})`;}
function doRoll(){if(!S.terms.length){toast('Добавь кубик!','fail');return;}const p=+$('#prof').value||0,m=+$('#mod').value||0,detail=[];let sum=0;S.terms.forEach(t=>{for(let i=0;i<t.n;i++){const r=1+Math.floor(Math.random()*t.s);detail.push({s:t.s,r});sum+=r;}});const single=detail.length===1&&detail[0].s===20;const raw=single?detail[0].r:null;const entry={id:uid(),time:Date.now(),who:S.session?.name||'Гость',formula:formulaStr(),detail,total:sum+p+m,raw,remote:false};saveRoll(entry);showResult(entry);tick(300,.1);setTimeout(()=>{raw===20?(tick(660,.15),setTimeout(()=>tick(880,.2),110)):raw===1?tick(160,.3):tick(560,.12);},180);RTC.send({type:'roll',entry});feedAdd(raw===20?`🌟 <b>${esc(entry.who)}</b>: КРИТ! ${esc(entry.formula)} → <b>${entry.total}</b>`:raw===1?`💀 <b>${esc(entry.who)}</b>: провал… → <b>${entry.total}</b>`:`🎲 <b>${esc(entry.who)}</b>: ${esc(entry.formula)} → <b>${entry.total}</b>`,'roll'+(raw===20?' crit':''));}
async function saveRoll(e){S.rolls.unshift(e);if(S.rolls.length>60)S.rolls.pop();await DB.put('rolls',e);renderHistory();renderHomeRolls();}
function showResult(e){const r=$('#resultBox');r.className='result'+(e.raw===20?' crit':e.raw===1?' fail':'');r.innerHTML=`<div class="rtotal">${e.total}</div><div class="rlabel${e.raw===20?' crit':e.raw===1?' fail':''}">${e.raw===20?'★ КРИТИЧЕСКИЙ УСПЕХ! ★':e.raw===1?'✝ ПРОВАЛ! ✝':esc(e.formula)}</div><div class="rdetail">${e.detail.map((d,i)=>`<i class="rd s${d.s}" style="animation-delay:${i*60}ms">${d.r}</i>`).join('')}</div>`;}
function renderHistory(){$('#histList').innerHTML=S.rolls.slice(0,30).map(e=>`<div class="hitem${e.raw===20?' crit':e.raw===1?' fail':''}"><b>${e.total}</b><span class="hw">${esc(e.who)}${e.remote?' ⚡':''}</span> <span class="hf">${esc(e.formula)}</span><span class="ht">${ftime(e.time)}${e.raw===20?' · крит!':e.raw===1?' · провал':''}</span></div>`).join('')||'<p class="hand" style="color:#6b5836;font-size:13px">История пуста.</p>';}
function renderHomeRolls(){$('#homeRolls').innerHTML=S.rolls.slice(0,5).map(e=>`<div class="miniroll${e.raw===20?' crit':e.raw===1?' fail':''}"><span class="t">${ftime(e.time)}</span><span>${esc(e.who)} · <span style="font-family:monospace;font-size:12px">${esc(e.formula)}</span></span><b>${e.total}</b></div>`).join('')||'<div class="empty-hint">Пока тихо…</div>';}
$('#rollBtn').onclick=doRoll;
$('#histClear').onclick=async()=>{for(const e of S.rolls)await DB.del('rolls',e.id);S.rolls=[];renderHistory();renderHomeRolls();toast('История сожжена');};
function openDice(){$('#diceModal').classList.add('open');renderFormula();}
function closeModal(id){$('#'+id).classList.remove('open');}
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.modal.open').forEach(m=>m.classList.remove('open'));});
$('#megaRoll').onclick=function(){this.classList.remove('rolling');void this.offsetWidth;this.classList.add('rolling');const n=$('#megaNum');let i=0;const iv=setInterval(()=>{n.textContent=1+Math.floor(Math.random()*20);tick(300+i*30,.05);if(++i>7){clearInterval(iv);const r=1+Math.floor(Math.random()*20);n.textContent=r;const entry={id:uid(),time:Date.now(),who:S.session?.name||'Гость',formula:'(1d20)',detail:[{s:20,r}],total:r,raw:r,remote:false};saveRoll(entry);RTC.send({type:'roll',entry});feedAdd(r===20?`🌟 КРИТ на главной! <b>${r}</b>`:r===1?`💀 Единица… <b>${r}</b>`:`🎲 d20 → <b>${r}</b>`,'roll'+(r===20?' crit':''));toast(r===20?`★ d20 → <b>${r}</b> · КРИТ!`:r===1?`✝ d20 → <b>${r}</b> · провал`:`d20 → <b>${r}</b>`,r===20?'crit':r===1?'fail':'');r===20?setTimeout(()=>tick(880,.2),100):r===1?tick(160,.3):tick(600,.12);}},70);};

/* ══ 9. МУЗЫКА ══ */
const audio=new Audio();audio.volume=.7;
function curTrack(){return S.tracks.find(t=>t.id===S.music.trackId);}
function applyMusic(m){if(m.id!==undefined&&m.id!==null)S.music.trackId=m.id;const t=curTrack();
  if(m.cmd==='stop'){audio.pause();audio.currentTime=0;S.music.playing=false;S.music.trackId=null;updMusicUI();return;}
  if(!t)return;if(audio.getAttribute('src')!==t.url)audio.src=t.url;
  if(m.cmd==='play'){let time=m.time||0;if(m.ts)time+=(Date.now()-m.ts)/1000;try{audio.currentTime=time;}catch(e){}audio.play().catch(()=>{});S.music.playing=true;S.music.time=time;S.music.ts=m.ts||Date.now();}
  if(m.cmd==='pause'){audio.pause();if(m.time!==undefined)audio.currentTime=m.time;S.music.playing=false;S.music.time=m.time!==undefined?m.time:audio.currentTime;}
  updMusicUI();}
function dmPlay(id){const m={cmd:'play',id,time:0,ts:Date.now()};S.music.trackId=id;applyMusic(m);RTC.send({type:'music',m});}
function dmResume(){const m={cmd:'play',id:S.music.trackId,time:audio.currentTime,ts:Date.now()};applyMusic(m);RTC.send({type:'music',m});}
function dmPause(){const m={cmd:'pause',time:audio.currentTime};applyMusic(m);RTC.send({type:'music',m});}
function dmStop(){const m={cmd:'stop'};applyMusic(m);RTC.send({type:'music',m});}
function renderPlaylist(){const el=$('#playlist');if(!el)return;const dm=isDM();
  el.innerHTML=S.tracks.length?S.tracks.map(t=>`<div class="plrow${S.music.trackId===t.id?' playing':''}"><span class="plico">${S.music.trackId===t.id&&S.music.playing?'♪':'🎵'}</span><span class="plname">${esc(t.name)}</span>${dm?`<button class="qbtn" data-play="${t.id}" title="Играть">▶</button><button class="qbtn" data-trm="${t.id}" title="Удалить">✕</button>`:''}</div>`).join(''):`<p class="hand" style="color:#6b5836;font-size:13px">Плейлист пуст. ${dm?'Добавьте треки ⬆':'Мастер добавит музыку.'}</p>`;
  $$('[data-play]').forEach(b=>b.onclick=()=>dmPlay(b.dataset.play));
  $$('[data-trm]').forEach(b=>b.onclick=async()=>{const id=b.dataset.trm;await DB.del('tracks',id);S.tracks=S.tracks.filter(t=>t.id!==id);delete S.trackData[id];if(S.music.trackId===id)dmStop();renderPlaylist();});}
function updMusicUI(){const t=curTrack();const np=$('#nowPlaying'),dot=$('#musicDot');
  if(t&&S.music.playing){np.textContent='Играет: '+t.name;dot.className='on';}
  else if(t){np.textContent='Пауза: '+t.name;dot.className='mid';}
  else{np.textContent='Ничего не играет';dot.className='';}
  const chip=$('#musicChip');if(chip){chip.style.display=(t&&S.music.playing)?'flex':'none';if(t)chip.querySelector('span:last-child').textContent=t.name;}
  renderPlaylist();}
function renderMusicGates(){const e=$('#musicDm');if(e)e.style.display=isDM()?'block':'none';}
$('#btnAddTrack').onclick=()=>$('#trackFile').click();
$('#trackFile').onchange=e=>{[...e.target.files].forEach(f=>{const id=uid();const rd=new FileReader();rd.onload=async()=>{S.trackData[id]=rd.result;await DB.put('tracks',{id,name:f.name,blob:f});S.tracks.push({id,name:f.name,url:URL.createObjectURL(f)});renderPlaylist();RTC.conns.forEach(c=>{if(c.open)RTC.sendFileTo(c,'track',{id,name:f.name},rd.result);});toast('🎵 Трек добавлен: '+esc(f.name));};rd.readAsDataURL(f);});e.target.value='';};
$('#mPlay').onclick=()=>{if(S.music.playing)return;if(S.music.trackId)dmResume();else if(S.tracks[0])dmPlay(S.tracks[0].id);};
$('#mPause').onclick=()=>{if(S.music.playing)dmPause();};
$('#mStop').onclick=()=>dmStop();
$('#vol').oninput=e=>{audio.volume=e.target.value/100;};
audio.addEventListener('ended',()=>{if(isDM())dmStop();});

/* ══ 10. СВЯЗЬ (PeerJS) ══ */
function roomCode(){const w=['WOLF','RAVEN','EMBER','STONE','MOON','IRON','ASH','FANG'][Math.floor(Math.random()*8)];return `${w}-${1000+Math.floor(Math.random()*9000)}`;}
const RTC={peer:null,conns:[],hostConn:null,roomId:null,fbuf:{},
  isOpen(){return isDM()?this.conns.some(c=>c.open):(this.hostConn&&this.hostConn.open);},
  teardown(){this.conns.forEach(c=>{try{c.close()}catch(e){}});this.conns=[];if(this.hostConn){try{this.hostConn.close()}catch(e){}this.hostConn=null;}if(this.peer){try{this.peer.destroy()}catch(e){}this.peer=null;}},
  async hostRoom(){this.teardown();return new Promise((resolve,reject)=>{const code=roomCode();this.peer=new Peer('grimoire-'+code.toLowerCase(),{debug:0});
    this.peer.on('open',()=>{this.roomId=code;resolve(code);});
    this.peer.on('error',err=>{if(err.type==='unavailable-id'){this.hostRoom().then(resolve).catch(reject);}else{toast('Ошибка соединения: '+err.type,'fail');reject(err);}});
    this.peer.on('connection',conn=>{this.conns.push(conn);this.wireConn(conn,true);});});},
  async joinRoom(code){this.teardown();return new Promise((resolve,reject)=>{this.peer=new Peer({debug:0});
    this.peer.on('open',()=>{const conn=this.peer.connect('grimoire-'+code.trim().toLowerCase(),{reliable:true});this.hostConn=conn;this.wireConn(conn,false);conn.on('open',()=>resolve());setTimeout(()=>{if(!conn.open)reject(new Error('timeout'));},9000);});
    this.peer.on('error',err=>{toast('Не удалось найти комнату — проверь код','fail');reject(err);});});},
  wireConn(conn,isHost){
    conn.on('open',async()=>{setConn(true);feedAdd('🔗 Соединение установлено!','chat');conn.send({type:'hello',who:S.session?.name||'Гость',role:S.session?.role||'guest'});
      if(isHost){renderPlayerList();for(const id in S.trackData)RTC.sendFileTo(conn,'track',{id,name:(S.tracks.find(t=>t.id===id)||{}).name||id},S.trackData[id]);if(S.music.trackId)conn.send({type:'music',m:{cmd:S.music.playing?'play':'pause',id:S.music.trackId,time:S.music.playing?audio.currentTime:S.music.time,ts:Date.now()}});}});
    conn.on('close',()=>{if(isHost){this.conns=this.conns.filter(c=>c!==conn);renderPlayerList();feedAdd('Игрок покинул стол');}else{setConn(false);feedAdd('Связь с мастером прервана');}});
    conn.on('data',m=>this.handle(m,conn,isHost));},
  redactTok(t){if(isDM()&&t.sheet&&!t.sheet.revealed)return{...t,sheet:{...t.sheet,notes:''}};return t;},
  send(o){if(o&&o.type==='tok')o={type:'tok',t:this.redactTok(o.t)};
    if(isDM())this.conns.forEach(c=>{if(c.open)c.send(o);});else if(this.hostConn&&this.hostConn.open)this.hostConn.send(o);},
  sendFileTo(conn,kind,meta,dataUrl){const CH=15000,n=Math.ceil(dataUrl.length/CH);for(let i=0;i<n;i++)conn.send({type:'fc',kind,id:meta.id,name:meta.name||'',i,n,d:dataUrl.slice(i*CH,i*CH+CH)});conn.send({type:'fd',kind,id:meta.id,name:meta.name||''});},
  relay(m,from){this.conns.forEach(c=>{if(c!==from&&c.open)c.send(m);});},
  async handle(m,conn,isHost){switch(m.type){
    case 'hello':if(isHost){conn._who=m.who;conn._role=m.role;renderPlayerList();feedAdd(`👋 За столом: <b>${esc(m.who)}</b> (${ROLENAME[m.role]||'Игрок'})`,'chat');toast(`За столом: <b>${esc(m.who)}</b>`);for(const c of await DB.all('chars'))conn.send({type:'char',c});for(const q of await DB.all('quests'))conn.send({type:'quest',q});for(const t of S.tokens)conn.send({type:'tok',t:RTC.redactTok(t)});}else{feedAdd(`👋 Подключено к мастеру`,'chat');toast('Соединение с мастером установлено','crit');}break;
    case 'tok':{const i=S.tokens.findIndex(t=>t.id===m.t.id);if(i>=0)S.tokens[i]=m.t;else S.tokens.push(m.t);renderToks(m.t.id);if(isHost)RTC.relay(m,conn);break;}
    case 'tokdel':S.tokens=S.tokens.filter(t=>t.id!==m.id);renderToks();if(isHost)RTC.relay(m,conn);break;
    case 'tokclear':S.tokens=[];renderToks();if(isHost)RTC.relay(m,conn);break;
    case 'char':await DB.put('chars',m.c);renderChars();if(isHost)RTC.relay(m,conn);break;
    case 'chardel':await DB.del('chars',m.id);renderChars();if(isHost)RTC.relay(m,conn);break;
    case 'quest':await DB.put('quests',m.q);renderQuests();if(isHost)RTC.relay(m,conn);break;
    case 'questdel':await DB.del('quests',m.id);renderQuests();if(isHost)RTC.relay(m,conn);break;
    case 'music':applyMusic(m.m);if(isHost)RTC.relay(m,conn);break;
    case 'roll':{m.entry.remote=true;await saveRoll(m.entry);const c=m.entry.raw===20?'crit':m.entry.raw===1?'fail':'';feedAdd(`🎲 <b>${esc(m.entry.who)}</b>: ${esc(m.entry.formula)} → <b>${m.entry.total}</b>`,'roll'+(c?' '+c:''));toast(`${m.entry.raw===20?'🌟 КРИТ':m.entry.raw===1?'💀 Провал':'🎲 Бросок'}: <b>${esc(m.entry.who)}</b> = <b>${m.entry.total}</b>`,c);if(isHost)RTC.relay(m,conn);break;}
    case 'chat':feedAdd(`💬 <b>${esc(m.who)}</b>: ${esc(m.text)}`,'chat');if(isHost)RTC.relay(m,conn);break;
    case 'fc':{const k=m.kind+':'+m.id;(this.fbuf[k]=this.fbuf[k]||[])[m.i]=m.d;if(m.i%25===0)feedAdd(`📦 Передача (${m.kind==='map'?'карта':'трек'})… ${Math.round((m.i+1)/m.n*100)}%`);break;}
    case 'fd':{const k=m.kind+':'+m.id;const url=(this.fbuf[k]||[]).join('');delete this.fbuf[k];
      if(m.kind==='map'){S.mapData=url;const blob=await(await fetch(url)).blob();await DB.put('kv',{id:'map',blob,name:'synced'});setBoard(URL.createObjectURL(blob));feedAdd('🗺 Карта получена!','chat');toast('🗺 Мастер разложил карту!','crit');}
      else if(m.kind==='track'){const blob=await(await fetch(url)).blob();await DB.put('tracks',{id:m.id,name:m.name,blob});if(!S.tracks.find(t=>t.id===m.id))S.tracks.push({id:m.id,name:m.name,url:URL.createObjectURL(blob)});renderPlaylist();feedAdd('🎵 Трек получен: '+esc(m.name));}break;}}}};
function renderPlayerList(){const el=$('#playerList');if(!el)return;const live=RTC.conns.filter(c=>c.open&&c._who);el.innerHTML=live.length?live.map(c=>`<span class="plchip"><i></i>${esc(c._who)}</span>`).join(''):'<span class="hand" style="color:#6b5836;font-size:13px">пока никого</span>';}
function setConn(on){['connDot','connDot2'].forEach(id=>$('#'+id).classList.toggle('on',on));$('#connTxt').textContent=on?'связь есть':'не в сети';$('#connTxt2').textContent=on?'Соединение установлено':'Нет соединения';$('#btnDisc').style.display=on?'inline-block':'none';homeStats();}
function renderRtcUI(){const dm=isDM();$('#rtcDm').style.display=dm?'block':'none';$('#rtcPl').style.display=dm?'none':'block';}
$('#mkAns').onclick=async()=>{const code=$('#offerIn').value.trim();if(!code){toast('Введи код комнаты','fail');return;}const btn=$('#mkAns');btn.disabled=true;btn.textContent='Подключаюсь…';try{await RTC.joinRoom(code);setConn(true);toast('Вход выполнен!','crit');}catch(e){setConn(false);}finally{btn.disabled=false;btn.textContent='Войти в комнату';}};
$('#cpOffer').onclick=()=>{const code=$('#roomCodeOut').textContent.trim();if(!code||code==='— — — —')return;navigator.clipboard.writeText(code);toast('Код скопирован');};
$('#btnDisc').onclick=()=>{RTC.teardown();setConn(false);$('#roomCodeOut').textContent='— — — —';renderPlayerList();};
function feedAdd(html,cls=''){const f=$('#feed');const hint=f.querySelector('.empty-hint');if(hint)hint.remove();const d=document.createElement('div');d.className='fitem '+cls;d.innerHTML=`<span class="t">${ftime(Date.now())}</span>${html}`;f.prepend(d);while(f.children.length>40)f.lastChild.remove();}
function sendChat(){const v=$('#chatIn').value.trim();if(!v)return;const who=S.session?.name||'Гость';feedAdd(`💬 <b>${esc(who)}</b>: ${esc(v)}`,'chat');RTC.send({type:'chat',who,text:v});$('#chatIn').value='';}
$('#chatSend').onclick=sendChat;$('#chatIn').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
async function autoHostIfDM(){if(isDM()&&!RTC.peer){try{const code=await RTC.hostRoom();$('#roomCodeOut').textContent=code;feedAdd(`Комната открыта: код <b>${code}</b>`,'chat');}catch(e){}}}

/* ══ 11. ИНИЦИАЛИЗАЦИЯ ══ */
function homeStats(){const r=S.session?S.session.role:'—';$('#homeStats').innerHTML=`<span class="hstat"><b>${ROLENAME[r]||'Гость'}</b>роль</span><span class="hstat"><b>${S.rolls.length}</b>бросков</span><span class="hstat"><b style="color:${RTC.isOpen()?'#57c26a':'#c96a60'}">●</b>связь</span>`;}
function embers(){const fx=$('#fx');for(let i=0;i<22;i++){const s=document.createElement('i');const sz=3+Math.random()*5;s.style.cssText=`left:${Math.random()*100}%;width:${sz}px;height:${sz}px;--sw:${(Math.random()*120-60)}px;animation-duration:${9+Math.random()*14}s;animation-delay:-${Math.random()*20}s`;fx.appendChild(s);}}
async function seed(){if(await DB.get('kv','seeded'))return;await DB.put('kv',{id:'seeded',v:1});
  await DB.put('quests',{id:uid(),title:'Крысы в погребе',desc:'Трактирщик Бьорн жалуется на крыс размером с кошку.',rew:'50 зм',st:'act'});
  await DB.put('quests',{id:uid(),title:'Пропавший караван',desc:'Караван с солью не вышел из Эвермура три дня назад.',rew:'120 зм',st:'act'});
  await DB.put('notes',{id:uid(),title:'Хроники Эвермура',body:'Город стоит на костях древнего эльфийского некрополя. По ночам сторожа слышат шёпот из-под мостовой. Гильдия магов делает вид, что всё в порядке. Гильдия магов врёт.',time:Date.now()});
  await DB.put('chars',{id:uid(),name:'Торин Дубощит',race:'Дворф',cls:'Воин',lvl:3,hp:28,hpMax:28,ac:18});
  await DB.put('items',{id:uid(),name:'Короткий меч',type:'Оружие',qty:1});
  await DB.put('items',{id:uid(),name:'Зелье лечения',type:'Зелье',qty:2});}
(async function boot(){
  try{await DB.open();}catch(e){toast('⚠ IndexedDB недоступен','fail');}
  await seed();
  S.rolls=(await DB.all('rolls')).sort((a,b)=>b.time-a.time).slice(0,60);
  S.tokens=await DB.all('tokens');
  const map=await DB.get('kv','map');if(map?.blob){S.mapName=map.name;setBoard(URL.createObjectURL(map.blob));}
  for(const t of await DB.all('tracks')){S.tracks.push({id:t.id,name:t.name,url:URL.createObjectURL(t.blob)});const fr=new FileReader();fr.onload=()=>{S.trackData[t.id]=fr.result;};fr.readAsDataURL(t.blob);}
  renderAuth();renderRtcUI();mapGates();renderBooks();renderRules();renderNotes();renderQuests();renderItems();renderChars();renderToks();renderFormula();renderHistory();renderHomeRolls();homeStats();renderPlaylist();renderUsers();renderMusicGates();updMusicUI();embers();revealScan();
  autoHostIfDM();
})();