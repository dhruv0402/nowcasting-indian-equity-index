import os
import requests
from src.utils.logging_config import setup_logging

logger = setup_logging()

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

def format_shock_alert_message(asset_name: str, ticker: str, headline: str, magnitude: float, direction: str, p_lag: str) -> str:
    dir_emoji = "🟢" if "UP" in direction else ("🔴" if "DOWN" in direction else "⚪")
    msg = (
        f"🚨 *PULSE NOWCAST: SEISMIC SHOCK DETECTED*\n\n"
        f"📊 *Asset:* {asset_name} (`{ticker}`)\n"
        f"⚡ *Richter Magnitude:* `{magnitude} / 5.0`\n"
        f"{dir_emoji} *Nowcast Direction:* *{direction}*\n"
        f"⏱️ *Primary Shockwave (P-Lag):* `{p_lag}`\n\n"
        f"📰 *Breaking Event:* \n_{headline}_\n\n"
        f"🔗 [Open Interactive Terminal](https://pulsenowcast.com)"
    )
    return msg

def dispatch_telegram_alert(asset_name: str, ticker: str, headline: str, magnitude: float, direction: str, p_lag: str) -> bool:
    """
    Dispatches formatted instant Richter shock alert to subscriber Telegram channels.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.info(f"[SIMULATED TELEGRAM ALERT DISPATCH] Mag {magnitude} on {ticker}: {headline[:60]}...")
        return True
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": format_shock_alert_message(asset_name, ticker, headline, magnitude, direction, p_lag),
        "parse_mode": "Markdown",
        "disable_web_page_preview": False
    }
    try:
        r = requests.post(url, json=payload, timeout=5)
        return r.status_code == 200
    except Exception as e:
        logger.error(f"Failed to send Telegram alert: {e}")
        return False

if __name__ == "__main__":
    test_msg = format_shock_alert_message("Reliance Industries", "RELIANCE.NS", "Reliance announces mega green hydrogen facility.", 4.2, "BULLISH (+1.4%)", "4.2m")
    print("Formatted Alert Preview:\n\n" + test_msg)
