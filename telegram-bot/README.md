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

Տվյալները հիմա պահվում են օգտատիրոջ սարքի browser storage-ում։ Սա ամենահեշտ և անվճար տարբերակն է։ Եթե պետք է, հետո կարելի է ավելացնել cloud database, որ տվյալները պահվեն բոլոր սարքերում։

Հիշեցումները այս ստատիկ տարբերակում աշխատում են, երբ Mini App-ը բաց է։ Եթե պետք է հիշեցումները գան Telegram message-ով նույնիսկ փակ app-ի դեպքում, պետք է ավելացնել server-side storage և scheduled worker։

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

4. `wrangler.toml` ֆայլում փոխեք `APP_URL` արժեքը ձեր GitHub Pages URL-ով։
5. Ավելացրեք Telegram token-ը որպես secret.

```bash
wrangler secret put BOT_TOKEN
```

6. Deploy արեք worker-ը.

```bash
wrangler deploy
```

7. Worker URL-ը միացրեք Telegram webhook-ին.

```bash
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WORKER_URL
```

Դրանից հետո բոտը մշտապես կաշխատի Cloudflare-ի անվճար պլանի սահմաններում։
