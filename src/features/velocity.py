import datetime
import pandas as pd
import numpy as np

def compute_news_velocity(current_time: datetime.datetime, events_df: pd.DataFrame) -> dict:
    """
    Computes count of headlines published in the prior 15, 30, and 60 minutes strictly relative to current_time.
    """
    if events_df.empty:
        return {"velocity_15m": 0, "velocity_30m": 0, "velocity_60m": 0}
        
    t_15 = current_time - datetime.timedelta(minutes=15)
    t_30 = current_time - datetime.timedelta(minutes=30)
    t_60 = current_time - datetime.timedelta(minutes=60)
    
    # Fast path if sorted array is available
    if "_sorted_timestamps" in events_df.attrs:
        ts_arr = events_df.attrs["_sorted_timestamps"]
        curr_ts = current_time.timestamp()
        idx_curr = np.searchsorted(ts_arr, curr_ts, side="right")
        idx_15 = np.searchsorted(ts_arr, t_15.timestamp(), side="left")
        idx_30 = np.searchsorted(ts_arr, t_30.timestamp(), side="left")
        idx_60 = np.searchsorted(ts_arr, t_60.timestamp(), side="left")
        return {
            "velocity_15m": max(0, idx_curr - idx_15),
            "velocity_30m": max(0, idx_curr - idx_30),
            "velocity_60m": max(0, idx_curr - idx_60)
        }
    
    # Filter strictly prior to current_time (Look-Ahead Guard compliance)
    prior_events = events_df[events_df["published_at"] <= current_time]
    v15 = len(prior_events[prior_events["published_at"] >= t_15])
    v30 = len(prior_events[prior_events["published_at"] >= t_30])
    v60 = len(prior_events[prior_events["published_at"] >= t_60])
    
    return {
        "velocity_15m": v15,
        "velocity_30m": v30,
        "velocity_60m": v60
    }

def get_time_of_day_bucket(dt: datetime.datetime) -> str:
    """
    Categorizes trading session time of day for liquidity/velocity context:
    - market_open: 09:15 to 11:00 IST (approx 03:45 to 05:30 UTC)
    - mid_session: 11:00 to 14:00 IST (approx 05:30 to 08:30 UTC)
    - pre_close:   14:00 to 15:30 IST (approx 08:30 to 10:00 UTC)
    - off_hours:   outside market session
    """
    minute_of_day = dt.hour * 60 + dt.minute
    # Converting UTC minute of day (IST = UTC + 330 mins)
    ist_minute = (minute_of_day + 330) % 1440
    
    if 555 <= ist_minute < 660:       # 09:15 - 11:00 IST
        return "market_open"
    elif 660 <= ist_minute < 840:      # 11:00 - 14:00 IST
        return "mid_session"
    elif 840 <= ist_minute <= 930:     # 14:00 - 15:30 IST
        return "pre_close"
    else:
        return "off_hours"
