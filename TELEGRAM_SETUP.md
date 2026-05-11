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

Հետո Cloudflare Worker-ում պետք է դնել երկու արժեք.

```text
BOT_TOKEN = ձեր Telegram token-ը
APP_URL = ձեր GitHub Pages URL-ը
```

Deploy-ից հետո Cloudflare-ը կտա Worker URL, օրինակ.

```text
https://khnayik-bot.YOUR_NAME.workers.dev
```

Webhook-ը միացնելու համար browser-ում բացեք.

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WORKER_URL
```

Եթե վերադարձնում է `"ok": true`, բոտը միացված է։

## Կարևոր

Telegram Mini App-ը պետք է բացվի HTTPS հղումով։ Local `file:///...` հղումը Telegram-ում չի աշխատի, դրա համար GitHub Pages-ը պետք է։
