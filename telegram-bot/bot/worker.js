export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Khnayik bot is running");
    }

    const update = await request.json();
    const message = update.message;
    if (!message?.chat?.id) {
      return new Response("ok");
    }

    const text = message.text || "";
    const appUrl = env.APP_URL;
    const token = env.BOT_TOKEN;

    const isStart = text.startsWith("/start");
    const reply = isStart
      ? "Բարի գալուստ «Խնայիկ»։ Այստեղ կարող եք կառավարել բյուջեն, ծախսերը, գործերը և հիշեցումները։"
      : "Բացեք «Խնայիկ» Mini App-ը՝ բյուջեն և գործերը կառավարելու համար։";

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chat.id,
        text: reply,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Բացել Խնայիկը",
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      }),
    });

    return new Response("ok");
  },
};
