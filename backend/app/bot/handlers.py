from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, PreCheckoutQuery

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

    @dp.message(CommandStart())
    async def cmd_start(message: Message):
        driver_url = cache_busted_url(settings.driver_app_url, "driver-login-20260611")
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
            [InlineKeyboardButton(text="🚖 Taksi haydovchi paneli", web_app=WebAppInfo(url=driver_url))],
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
