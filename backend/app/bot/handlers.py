from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.filters import CommandObject
from aiogram.types import (Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, PreCheckoutQuery,
                           CallbackQuery, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove)

from app.config import settings
from app.services import notification_service
from app.services.bot_retry import with_retry

bot: Bot | None = None
dp: Dispatcher | None = None


def cache_busted_url(url: str, version: str) -> str:
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}v={version}"


def create_bot() -> tuple[Bot, Dispatcher]:
    global bot, dp
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()
    notification_service.set_bot(bot)

    @dp.message(CommandStart(deep_link=True, magic=F.args.startswith("login_")))
    async def cmd_app_login(message: Message, command: CommandObject):
        """Chortoq Ijrochi ilovasiga kirish: ilova ochgan `t.me/<bot>?start=login_<kod>` havolasi."""
        from app.services.app_login_bot import describe_login
        text, kb = await describe_login(command.args[len("login_"):])
        await with_retry(lambda: message.answer(text, reply_markup=kb, parse_mode="HTML"), label="app_login")

    @dp.callback_query(F.data.startswith("al:"))
    async def on_app_login(query: CallbackQuery):
        from app.services.app_login_bot import answer_login, needs_phone
        text = await answer_login(query.data, query.from_user)
        await query.answer()
        ok = text.startswith("✅")
        back = None
        if ok and settings.passenger_app_url.startswith("https://"):
            # Telegram inline tugmasi faqat https qabul qiladi — sahifa ilovani o'zi ochadi (KAMCHILIKLAR-ANDROID #20)
            back = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
                text="📱 Ilovaga qaytish",
                url=settings.passenger_app_url.rstrip("/") + "/api/app/open" + ("?app=client" if "<b>Chortoq</b>" in text else ""))]])
        if query.message:
            await with_retry(lambda: query.message.edit_text(text, parse_mode="HTML", reply_markup=back),
                             label="app_login_answer")
        if ok:
            # Birinchi kirish: login/parol — keyin Telegram'siz ham kirish mumkin
            from app.database import pool
            from app.services.credentials import ensure_credentials, send_credentials
            async with pool.acquire() as conn:
                creds = await ensure_credentials(conn, query.from_user.id)
            if creds:
                await send_credentials(query.from_user.id, *creds, first=True)
        if ok and await needs_phone(query.from_user.id):
            # Yo'lovchi haydovchiga qo'ng'iroq qila olishi uchun tasdiqlangan raqam shart (KAMCHILIKLAR-ANDROID #6)
            kb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="📱 Raqamni ulashish", request_contact=True)]],
                                     resize_keyboard=True, one_time_keyboard=True)
            await with_retry(lambda: bot.send_message(
                query.from_user.id,
                "Ijrochi sifatida ishlash uchun telefon raqamingizni tasdiqlang — pastdagi tugmani bosing.",
                reply_markup=kb), label="app_login_phone")

    @dp.message(Command("parol"))
    async def cmd_password(message: Message):
        """Ilova uchun yangi parol (eskisi bekor bo'ladi). Ochiq ilova sessiyalari yopilmaydi."""
        from app.database import pool
        from app.services.credentials import set_credentials, send_credentials
        async with pool.acquire() as conn:
            uid = await conn.fetchval("SELECT id FROM users WHERE telegram_id=$1 AND NOT is_blocked",
                                      message.from_user.id)
            creds = await set_credentials(conn, uid) if uid else None
        if not creds:
            await with_retry(lambda: message.answer("Avval Mini App yoki ilova orqali ro'yxatdan o'ting."),
                             label="cmd_password")
            return
        await send_credentials(message.from_user.id, *creds)

    @dp.message(Command("app"))
    async def cmd_app(message: Message):
        """Chortoq Ijrochi (Android) APK havolasi."""
        from app.routers.mobile import download_url
        url = download_url()
        text = ("📱 <b>Chortoq Ijrochi</b> — ijrochilar uchun Android ilova\n\n"
                "Yuklab oling → faylni oching → «Noma'lum manbalardan o'rnatish»ga ruxsat bering → O'rnatish.\n"
                "Kirish: ilovada «Telegram orqali kirish».")
        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="⬇️ Yuklab olish", url=url)]]) if url else None
        if not url:
            text += "\n\n⏳ Havola hali sozlanmagan. Administratorga murojaat qiling."
        await with_retry(lambda: message.answer(text, parse_mode="HTML", reply_markup=kb), label="cmd_app")

    @dp.message(CommandStart())
    async def cmd_start(message: Message):
        app_url = settings.passenger_app_url.rstrip("/")

        def page(path: str) -> WebAppInfo:
            return WebAppInfo(url=f"{app_url}{path}")

        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📱 Chortoq Services", web_app=page("/"))],
            [InlineKeyboardButton(text="🚕 Taksi", web_app=page("/book")),
             InlineKeyboardButton(text="🚐 Po'puti", web_app=page("/carpool"))],
            [InlineKeyboardButton(text="🚚 Yuk tashish", web_app=page("/requests/new/cargo")),
             InlineKeyboardButton(text="🚜 Spets texnika", web_app=page("/requests/new/equipment"))],
            [InlineKeyboardButton(text="🧰 Ijrochi paneli", web_app=page("/provider"))],
            [InlineKeyboardButton(text="🚖 Taksi haydovchisi", web_app=page("/taxi-driver"))],
        ])
        await with_retry(
            lambda: message.answer(
                "Chortoq Services ga xush kelibsiz!\n\n"
                "Chortoq tumani uchun yagona transport va texnika xizmatlari platformasi:\n"
                "🚕 Taksi · 🚐 Po'puti · 🚚 Yuk tashish · 🚜 Spets texnika\n\n"
                "Bitta akkaunt — bir nechta rol: ham buyurtma bering, ham xizmat ko'rsating.",
                reply_markup=kb,
            ),
            label="cmd_start",
        )

    @dp.message(Command("help"))
    async def cmd_help(message: Message):
        await with_retry(
            lambda: message.answer(
                "Chortoq Services yordami:\n\n"
                "/start - Botni boshlash\n"
                "/app - Ijrochilar uchun Android ilova\n"
                "/parol - Ilova uchun login va yangi parol\n"
                "/rides - Oxirgi buyurtmalar\n"
                "/support - Yordam\n\n"
                "Savollar: @taxigo_support"
            ),
            label="cmd_help",
        )

    @dp.message(Command("support"))
    async def cmd_support(message: Message):
        await with_retry(
            lambda: message.answer("Qo'llab-quvvatlash: @taxigo_support"),
            label="cmd_support",
        )

    @dp.message(F.contact)
    async def on_contact(message: Message):
        """Mini App'dagi "Raqamni ulashish" kontaktni botga yuboradi — faqat o'z raqamini qabul qilamiz."""
        contact = message.contact
        if not message.from_user or contact.user_id != message.from_user.id:
            await with_retry(lambda: message.answer("Faqat o'zingizning raqamingizni ulashing."), label="contact_foreign")
            return
        from app.database import pool
        from app.routers.users import save_verified_phone

        async with pool.acquire() as conn:
            row = await save_verified_phone(conn, message.from_user.id, contact.phone_number)
        text = "Raqamingiz tasdiqlandi ✅" if row else "Avval Mini App'ni oching, so'ng raqamni ulashing."
        await with_retry(lambda: message.answer(text, reply_markup=ReplyKeyboardRemove()), label="contact_saved")

    @dp.message(F.text & ~F.text.startswith("/"))
    async def admin_inbox(message: Message):
        """Admin botga yozgan oddiy matn — ishlab chiquvchi (Claude Code) uchun "quti": Redis `admin_inbox` ro'yxati."""
        if not message.from_user or message.from_user.id not in settings.admin_ids:
            return
        from datetime import datetime
        import json
        from app.redis_client import get_redis
        r = get_redis()
        if r is None:
            return
        await r.rpush("admin_inbox", json.dumps({"at": datetime.now().isoformat(timespec="seconds"),
                                                  "text": message.text}, ensure_ascii=False))
        await r.ltrim("admin_inbox", -200, -1)
        await with_retry(lambda: message.answer("📥 Qabul qilindi."), label="admin_inbox")

    @dp.pre_checkout_query()
    async def pre_checkout(query: PreCheckoutQuery):
        await query.answer(ok=True)

    @dp.message(F.successful_payment)
    async def successful_payment(message: Message):
        payment = message.successful_payment
        order_id = int(payment.invoice_payload)
        from app.database import pool

        async with pool.acquire() as conn:
            await conn.execute("UPDATE orders SET payment_status='paid' WHERE id=$1", order_id)
            await conn.execute(
                """INSERT INTO payments(order_id,amount,currency,method,status,external_id,completed_at)
                   VALUES($1,$2,$3,'telegram','completed',$4,NOW())""",
                order_id,
                payment.total_amount / 100,
                payment.currency,
                payment.telegram_payment_charge_id,
            )
        await with_retry(
            lambda: message.answer("To'lov muvaffaqiyatli amalga oshirildi!"),
            label="successful_payment",
        )

    return bot, dp
