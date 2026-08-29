import urllib.request
import csv
import json
import os
import requests

NSE_500_URL = "https://archives.nseindia.com/content/indices/ind_nifty500list.csv"
NSE_MICRO_URL = "https://archives.nseindia.com/content/indices/ind_niftymicrocap250_list.csv"
SP_500_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"

def fetch_complete_indian_universe() -> list:
    """
    Downloads full NIFTY 500 (Large + Mid + Small) and NIFTY Microcap 250 lists directly from NSE Archives.
    """
    companies = []
    headers = {"User-Agent": "Mozilla/5.0"}
    
    # 1. NIFTY 500
    try:
        req = urllib.request.Request(NSE_500_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            lines = resp.read().decode("utf-8").splitlines()
            reader = csv.DictReader(lines)
            for row in reader:
                sym = row.get("Symbol", "").strip()
                company = row.get("Company Name", "").strip()
                industry = row.get("Industry", "").strip()
                if sym:
                    companies.append({
                        "ticker": f"{sym}.NS",
                        "symbol": sym,
                        "name": company,
                        "industry": industry,
                        "market": "INDIA",
                        "tier": "NIFTY 500 (Large/Mid/Small)",
                        "icon": "🇮🇳",
                        "isStock": True
                    })
    except Exception as e:
        print(f"Error fetching NIFTY 500: {e}")

    # 2. NIFTY Microcap 250
    try:
        req = urllib.request.Request(NSE_MICRO_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            lines = resp.read().decode("utf-8").splitlines()
            reader = csv.DictReader(lines)
            for row in reader:
                sym = row.get("Symbol", "").strip()
                company = row.get("Company Name", "").strip()
                industry = row.get("Industry", "").strip()
                if sym and not any(c["symbol"] == sym for c in companies):
                    companies.append({
                        "ticker": f"{sym}.NS",
                        "symbol": sym,
                        "name": company,
                        "industry": industry,
                        "market": "INDIA",
                        "tier": "NIFTY Microcap 250",
                        "icon": "🇮🇳",
                        "isStock": True
                    })
    except Exception as e:
        print(f"Error fetching NIFTY Microcap 250: {e}")
        
    return companies

def fetch_complete_us_universe() -> list:
    """
    Downloads complete S&P 500 and Top US Tech/Russell Equities.
    """
    companies = []
    try:
        resp = requests.get(SP_500_URL, timeout=10)
        if resp.status_code == 200:
            lines = resp.text.splitlines()
            reader = csv.DictReader(lines)
            for row in reader:
                sym = row.get("Symbol", "").strip().replace(".", "-")
                name = row.get("Security", "").strip()
                sector = row.get("GICS Sector", "").strip()
                if sym:
                    companies.append({
                        "ticker": sym,
                        "symbol": sym,
                        "name": name,
                        "industry": sector,
                        "market": "US",
                        "tier": "S&P 500 / US Equities",
                        "icon": "🇺🇸",
                        "isStock": True
                    })
    except Exception as e:
        print(f"Error fetching US universe: {e}")
        
    return companies

def build_and_save_master_universe():
    indian = fetch_complete_indian_universe()
    us = fetch_complete_us_universe()
    
    # Benchmarks & MCX Commodities
    indices_and_commodities = [
        # Benchmarks
        {"ticker": "^NSEI", "symbol": "NIFTY 50", "name": "NIFTY 50 Index", "industry": "Benchmark", "market": "INDIA", "tier": "Benchmark Index", "icon": "🇮🇳", "isStock": False},
        {"ticker": "^BSESN", "symbol": "SENSEX", "name": "S&P BSE SENSEX 30", "industry": "Benchmark", "market": "INDIA", "tier": "Benchmark Index", "icon": "🇮🇳", "isStock": False},
        {"ticker": "INDA", "symbol": "GIFT NIFTY", "name": "GIFT Nifty / MSCI India", "industry": "GIFT City Benchmark", "market": "GLOBAL", "tier": "International India Proxy", "icon": "🌐", "isStock": False},
        {"ticker": "^NSEBANK", "symbol": "BANKNIFTY", "name": "NIFTY Bank Index", "industry": "Banking Sector", "market": "INDIA", "tier": "Sectoral Index", "icon": "🏦", "isStock": False},
        {"ticker": "^NSEMDCP50", "symbol": "NIFTY MIDCAP", "name": "NIFTY Midcap 50", "industry": "Mid-Cap Benchmark", "market": "INDIA", "tier": "Benchmark Index", "icon": "📈", "isStock": False},
        {"ticker": "^GSPC", "symbol": "S&P 500", "name": "S&P 500 Index", "industry": "US Benchmark", "market": "US", "tier": "US Benchmark", "icon": "🇺🇸", "isStock": False},
        {"ticker": "^IXIC", "symbol": "NASDAQ", "name": "NASDAQ Composite", "industry": "US Tech Benchmark", "market": "US", "tier": "US Benchmark", "icon": "💻", "isStock": False},
        # MCX Commodities
        {"ticker": "MCX.NS", "symbol": "MCX", "name": "MCX India Exchange", "industry": "Commodities Exchange", "market": "INDIA", "tier": "Exchange Stock", "icon": "🏛️", "isStock": True},
        {"ticker": "GC=F", "symbol": "GOLD", "name": "MCX / COMEX Gold", "industry": "Precious Metals", "market": "GLOBAL", "tier": "MCX Commodity", "icon": "🟡", "isStock": False},
        {"ticker": "SI=F", "symbol": "SILVER", "name": "MCX / COMEX Silver", "industry": "Precious Metals", "market": "GLOBAL", "tier": "MCX Commodity", "icon": "⚪", "isStock": False},
        {"ticker": "CL=F", "symbol": "CRUDE OIL", "name": "MCX / NYMEX Crude Oil", "industry": "Energy", "market": "GLOBAL", "tier": "MCX Commodity", "icon": "🛢️", "isStock": False},
        {"ticker": "NG=F", "symbol": "NATURAL GAS", "name": "MCX Natural Gas", "industry": "Energy", "market": "GLOBAL", "tier": "MCX Commodity", "icon": "🔥", "isStock": False},
        {"ticker": "HG=F", "symbol": "COPPER", "name": "MCX Copper", "industry": "Base Metals", "market": "GLOBAL", "tier": "MCX Commodity", "icon": "🥉", "isStock": False},
        # Crypto
        {"ticker": "BTC-USD", "symbol": "BTC", "name": "Bitcoin", "industry": "Digital Asset", "market": "CRYPTO", "tier": "24/7 Crypto", "icon": "₿", "isStock": False},
        {"ticker": "ETH-USD", "symbol": "ETH", "name": "Ethereum", "industry": "Smart Contracts", "market": "CRYPTO", "tier": "24/7 Crypto", "icon": "Ξ", "isStock": False}
    ]
    
    master = indices_and_commodities + indian + us
    
    # Save to JSON
    out_path = "data/universe_master.json"
    os.makedirs("data", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(master, f, indent=2)
        
    print(f"Successfully generated master universe with {len(master)} assets! ({len(indian)} Indian Stocks, {len(us)} US Stocks)")
    return master

if __name__ == "__main__":
    build_and_save_master_universe()
