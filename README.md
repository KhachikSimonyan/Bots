# Խնայիկ

Գեղեցիկ և պարզ Telegram Mini App՝ անձնական բյուջեն, ծախսերը, գործերը և հիշեցումները կառավարելու համար։

## Ինչ կա պատրաստ

- Օրվա, շաբաթվա և ամսվա ծախսերի հաշվարկ
- Ամսական աշխատավարձի դաշտ
- Մշտական ֆիքսված ծախսեր
- Ազատ մնացած գումարի և օրվա թույլատրելի գումարի հաշվարկ
- Ծախսերի ավելացում, ջնջում և CSV export
- Գործերի կառավարում նույն Mini App-ի մեջ
- Ֆիքսված օրերով և ժամերով կրկնվող գործեր
- Մեկանգամյա գործեր՝ ամսաթիվ և ժամ ընտրելով
- Յուրաքանչյուր գործի համար հիշեցումը միացնելու/անջատելու կոճակ
- Telegram Mini App-ի աջակցություն
- Cloudflare Worker bot անվճար webhook-ի համար
- Cloudflare D1 cloud storage՝ սարքերի միջև տվյալները պահելու համար
- Server-side հիշեցումներ՝ Telegram message-ով, նույնիսկ երբ Mini App-ը փակ է
- Երեք կետով բացվող կարգավորումներ՝ ֆոնային նկարների և Excel export-ի համար
- Webhook secret և Telegram Mini App init data verification

Telegram Mini App-ի ներսում տվյալների հիմնական պահոցը Cloudflare D1 database-ն է։ Local storage-ը օգտագործվում է միայն սովորական browser preview-ի համար, երբ Telegram auth և Worker API չկա։

Երբ app-ը բաց է երկու սարքի վրա, frontend-ը պարբերաբար ստուգում է database-ի վերջին վիճակը և թարմացնում է էկրանը։ Եթե երկու սարք միաժամանակ են փոփոխություն անում, Worker-ը վերադարձնում է conflict, իսկ app-ը փորձում է միացնել երկու կողմի նոր գրառումները՝ ըստ item id-ների։

Հիշեցումները ստուգվում են նաև Cloudflare Cron Trigger-ով և ուղարկվում են Telegram message-ով։

## Տեղական preview

```bash
npm install
npm start
```

Preview հղումը կլինի.

```text
http://127.0.0.1:4174
```

## Տեղադրել անվճար GitHub Pages-ում

1. Ստեղծեք GitHub repository։
2. Այս ֆայլերը տեղադրեք repository-ի մեջ։
3. GitHub-ում բացեք `Settings > Pages`։
4. Ընտրեք branch-ը և root folder-ը։
5. Ստացված հղումը կօգտագործվի որպես Mini App URL։

## Ստեղծել Telegram Bot

1. Telegram-ում բացեք `@BotFather`։
2. Գրեք `/newbot` և ստեղծեք բոտ։
3. Պահեք bot token-ը։
4. Գրեք `/setmenubutton`, ընտրեք բոտը և որպես URL դրեք GitHub Pages-ի հղումը։

Ավելի մանրամասն քայլերը կան [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) ֆայլում։

## Անվճար աշխատեցնել բոտը Cloudflare Workers-ում

1. Ստեղծեք Cloudflare account։
2. Տեղադրեք Wrangler.

```bash
npm install -g wrangler
```

3. Մուտք գործեք.

```bash
wrangler login
```

4. Ստեղծեք D1 database և schema-ն կիրառեք.

```bash
npm run db:create
npm run db:migrate
```

`db:create` հրամանը կտա `database_id`։ Այն տեղադրեք `wrangler.toml` ֆայլում։

5. `wrangler.toml` ֆայլում փոխեք `APP_URL`, `CORS_ORIGIN`, `database_id` արժեքները։
6. Ավելացրեք Telegram token-ը և webhook secret-ը որպես secrets.

```bash
wrangler secret put BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
```

7. Deploy արեք worker-ը.

```bash
wrangler deploy
```

8. Worker URL-ը միացրեք Telegram webhook-ին՝ secret token-ով.

```bash
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WORKER_URL&secret_token=YOUR_WEBHOOK_SECRET
```

Դրանից հետո բոտը մշտապես կաշխատի Cloudflare-ի անվճար պլանի սահմաններում։
