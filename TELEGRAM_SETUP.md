# «Խնայիկ»-ը Telegram-ին միացնելու քայլերը

## Առաջարկվող անուն

Իմ առաջարկը՝ **Խնայիկ**։

Այլ լավ տարբերակներ՝

- **Պլանիկ**
- **Բյուջիկ**
- **Կարգին**
- **Իմ Օրակարգ**
- **Դրամիկ**
- **Ժամուբյուջե**

BotFather-ում username-ը պետք է ավարտվի `bot` բառով, օրինակ՝ `KhnayikBot` կամ `KhnayikFinanceBot`։

## 1. Mini App-ը դնել GitHub Pages-ում

1. Ստեղծեք GitHub repository, օրինակ՝ `khnayik`.
2. Այս project-ի բոլոր ֆայլերը upload արեք repository-ի մեջ։
3. GitHub-ում բացեք `Settings > Pages`։
4. `Build and deployment` մասում ընտրեք branch-ը, օրինակ՝ `main`, և folder-ը՝ `/root`։
5. GitHub-ը կտա այսպիսի հղում.

```text
https://YOUR_USERNAME.github.io/khnayik/
```

Սա կլինի ձեր Mini App-ի URL-ը։

## 2. Ստեղծել Telegram bot

Telegram-ում բացեք `@BotFather` և կատարեք.

```text
/newbot
```

Անունի համար կարող եք գրել.

```text
Խնայիկ
```

Username-ի համար օրինակ.

```text
KhnayikBot
```

BotFather-ը կտա token։ Այն պետք է պահել։

## 3. Միացնել Mini App կոճակը

BotFather-ում գրեք.

```text
/setmenubutton
```

Ընտրեք ձեր բոտը, հետո URL-ի տեղում դրեք GitHub Pages-ի Mini App URL-ը։

Օրինակ.

```text
https://YOUR_USERNAME.github.io/khnayik/
```

## 4. Բոտը անվճար աշխատեցնել Cloudflare Workers-ում

`wrangler.toml` ֆայլում փոխեք `APP_URL`-ը ձեր Mini App URL-ով։

Նաև փոխեք `CORS_ORIGIN`-ը ձեր GitHub Pages domain-ով և `database_id`-ը ձեր D1 database-ի id-ով։

D1 բազան ստեղծելու համար գործարկեք առաջին երկու հրամանները։ Ստուգեք, որ `wrangler.toml`-ում նշված է նոր բազայի ID-ն, ապա գործարկեք միգրացիան։

```bash
npm install
npm run db:create
npm run db:migrate
```

Հետո Cloudflare Worker-ում պետք է դնել երկու secret.

```text
BOT_TOKEN = ձեր Telegram token-ը
WEBHOOK_SECRET = ձեր ընտրած երկար գաղտնի տեքստը
```

Deploy-ից հետո Cloudflare-ը կտա Worker URL, օրինակ.

```text
https://khnayik-bot.YOUR_NAME.workers.dev
```

Webhook-ը միացրեք տեղային տերմինալում։ Միջավայրի փոփոխականներից փոխանցեք `BOT_TOKEN`, `WEBHOOK_SECRET` և `WEBHOOK_URL`։ Վերջինս Worker-ի HTTPS հասցեն է։ Հրամանը գաղտնիքների արժեքները չի տպում։

```bash
node --input-type=module -e "const {BOT_TOKEN, WEBHOOK_SECRET, WEBHOOK_URL}=process.env; if (!BOT_TOKEN || !WEBHOOK_SECRET || !WEBHOOK_URL) process.exit(2); const r=await fetch('https://api.telegram.org/bot'+BOT_TOKEN+'/setWebhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:WEBHOOK_URL,secret_token:WEBHOOK_SECRET})}); if (!r.ok || !(await r.json()).ok) process.exit(1); console.log('Webhook connected')"
```

Cloudflare Access-ի դեպքում Telegram հավելվածի հարցումները պետք է հասնեն Worker-ի `/api/*` ուղիներին, իսկ Telegram-ի webhook-ը՝ իր կարգավորված ուղուն։ Worker-ը տվյալների հարցումների համար ստուգում է Telegram-ի ստորագրությունը, իսկ webhook-ի համար՝ գաղտնի վերնագիրը։ Ստուգման համար նույն հավելվածի Origin-ով `OPTIONS /api/state` հարցումը պետք է ստանա `204`, իսկ առանց Telegram հաստատման `GET /api/state` հարցումը՝ `401`։

## 5. Mini App-ը կապել Worker API-ին

Եթե frontend-ը GitHub Pages-ում է, իսկ Worker-ը առանձին URL ունի, `index.html`-ում `<script src="./src/app.js"></script>` տողից առաջ կարող եք ավելացնել.

```html
<script>
  window.KHNAYIK_API_BASE = "https://khnayik-bot.YOUR_NAME.workers.dev";
</script>
```

Telegram-ի ներսում app-ը կուղարկի signed init data, իսկ Worker-ը կստուգի, որ request-ը իրական Telegram user-ից է։

Այս կարգավորումից հետո Telegram Mini App-ում տվյալները այլևս չեն վերցվում որպես հիմնական պահոց սարքի local storage-ից։ Դրանք բեռնվում և պահվում են Cloudflare D1 database-ում, իսկ local storage-ը մնում է միայն ոչ Telegram preview-ի համար։

## Կարևոր

Telegram Mini App-ը պետք է բացվի HTTPS հղումով։ Local `file:///...` հղումը Telegram-ում չի աշխատի, դրա համար GitHub Pages-ը պետք է։
