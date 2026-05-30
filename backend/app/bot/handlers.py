from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, PreCheckoutQuery
from app.config import settings
from app.services import notification_service

bot: Bot | None = None
dp: Dispatcher | None = None


def create_bot() -> tuple[Bot, Dispatcher]:
    global bot, dp
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()
    notification_service.set_bot(bot)

    @dp.message(CommandStart())
    async def cmd_start(message: Message):
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🚕 Taksi buyurtma qilish", web_app=WebAppInfo(url=settings.passenger_app_url))],
            [InlineKeyboardButton(text="🚗 Haydovchi paneli", web_app=WebAppInfo(url=settings.driver_app_url))],
        ])
        await message.answer("TaxiGo ga xush kelibsiz!\n\nSiz qanday foydalanmoqchisiz?", reply_markup=kb)

    @dp.message(Command("help"))
    async def cmd_help(message: Message):
        await message.answer(
            "TaxiGo yordami:\n\n"
            "/start — Botni boshlash\n"
            "/rides — Oxirgi buyurtmalar\n"
            "/support — Yordam\n\n"
            "Savollar: @taxigo_support"
        )

    @dp.message(Command("support"))
    async def cmd_support(message: Message):
        await message.answer("Qo'llab-quvvatlash: @taxigo_support")

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
        await message.answer("To'lov muvaffaqiyatli amalga oshirildi!")

    return bot, dp
