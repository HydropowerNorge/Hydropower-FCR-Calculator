import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from io import BytesIO

from data_loader import load_price_data, load_frequency_data, get_available_years
from calculator import (
    BatteryConfig,
    simulate_soc_hourly,
    calculate_revenue,
    calculate_simple_revenue
)
from frequency_simulator import simulate_frequency, get_frequency_summary, WINTER_STATS, SUMMER_STATS

st.set_page_config(page_title="FCR-N Battery Calculator", layout="wide")

st.title("FCR-N Battery Income Calculator")
st.markdown("Estimate revenue from FCR-N market participation in NO1 (Oslo)")

# Sidebar inputs
st.sidebar.header("Battery Configuration")

power_mw = st.sidebar.number_input(
    "Power Capacity (MW)",
    min_value=0.1,
    max_value=100.0,
    value=1.0,
    step=0.1
)

capacity_mwh = st.sidebar.number_input(
    "Energy Capacity (MWh)",
    min_value=0.1,
    max_value=500.0,
    value=2.0,
    step=0.1
)

efficiency = st.sidebar.slider(
    "Round-trip Efficiency (%)",
    min_value=70,
    max_value=99,
    value=90
) / 100

soc_min = st.sidebar.slider(
    "Minimum SOC (%)",
    min_value=0,
    max_value=50,
    value=20
) / 100

soc_max = st.sidebar.slider(
    "Maximum SOC (%)",
    min_value=50,
    max_value=100,
    value=80
) / 100

st.sidebar.header("Data Selection")

available_years = get_available_years()
year = st.sidebar.selectbox("Year", available_years, index=len(available_years) - 1)

# Frequency simulation mode
st.sidebar.header("Frequency Simulation")

freq_mode = st.sidebar.radio(
    "Frequency data source",
    ["Simple (no simulation)", "Simulated (Nordic stats)", "Upload CSV"],
    index=1
)

freq_df = None
use_soc_simulation = False

if freq_mode == "Simple (no simulation)":
    simple_availability = st.sidebar.slider(
        "Assumed Availability (%)",
        min_value=50,
        max_value=100,
        value=95
    )

elif freq_mode == "Simulated (Nordic stats)":
    use_soc_simulation = True
    st.sidebar.markdown("---")
    st.sidebar.markdown("**Simulation based on Fingrid 2024 data:**")

    season = st.sidebar.radio("Season pattern", ["Winter", "Summer"], index=0)

    stats = WINTER_STATS if season == "Winter" else SUMMER_STATS
    st.sidebar.caption(f"• {stats.pct_outside:.2f}% outside 49.9-50.1 Hz")
    st.sidebar.caption(f"• {stats.events_count} deviation events/month")

    sim_hours = st.sidebar.select_slider(
        "Simulation duration",
        options=[24, 168, 720, 2160, 8760],
        value=720,
        format_func=lambda x: {24: "1 day", 168: "1 week", 720: "1 month", 2160: "3 months", 8760: "1 year"}[x]
    )

    seed = st.sidebar.number_input("Random seed (for reproducibility)", value=42, min_value=0)

else:  # Upload CSV
    use_soc_simulation = True
    freq_file = st.sidebar.file_uploader(
        "Upload frequency CSV",
        type=["csv"],
        help="CSV with columns: timestamp, grid_frequency"
    )
    if freq_file:
        freq_df = load_frequency_data(freq_file)

# Load price data
try:
    price_df = load_price_data(year, "NO1")
    st.success(f"Loaded {len(price_df)} hours of price data for {year}")
except FileNotFoundError:
    st.error(f"Price data file not found for {year}")
    st.stop()

# Create config
config = BatteryConfig(
    power_mw=power_mw,
    capacity_mwh=capacity_mwh,
    efficiency=efficiency,
    soc_min=soc_min,
    soc_max=soc_max
)

# Generate/load frequency data and calculate results
if freq_mode == "Simple (no simulation)":
    result = calculate_simple_revenue(price_df, power_mw, simple_availability)

elif freq_mode == "Simulated (Nordic stats)":
    with st.spinner(f"Simulating {sim_hours} hours of frequency data..."):
        # Use start of selected year with appropriate month for season
        start_month = 1 if season == "Winter" else 6
        start_time = pd.Timestamp(f"{year}-{start_month:02d}-01", tz="UTC")

        freq_df = simulate_frequency(start_time, sim_hours, seed=seed)

    summary = get_frequency_summary(freq_df)
    st.info(f"Generated {len(freq_df):,} frequency samples | "
            f"{summary['pct_outside_band']:.2f}% outside normal band | "
            f"Range: {summary['min_hz']:.3f} - {summary['max_hz']:.3f} Hz")

    soc_df = simulate_soc_hourly(freq_df, config)
    result = calculate_revenue(price_df, soc_df, config)

else:  # Upload CSV
    if freq_df is None:
        st.warning("Please upload a frequency CSV file")
        st.stop()

    st.info(f"Loaded {len(freq_df):,} frequency samples from file")
    soc_df = simulate_soc_hourly(freq_df, config)
    result = calculate_revenue(price_df, soc_df, config)

# Display results
st.header("Results")

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("Total Revenue", f"€{result.total_revenue_eur:,.0f}")

with col2:
    st.metric("Available Hours", f"{result.available_hours:,} / {result.total_hours:,}")

with col3:
    st.metric("Availability", f"{result.availability_pct:.1f}%")

with col4:
    st.metric("Avg Price", f"€{result.avg_price_eur:.0f}/MW")

# Annualized revenue estimate
if result.total_hours < 8760:
    annualized = result.total_revenue_eur * (8760 / result.total_hours)
    st.caption(f"📊 Annualized estimate: **€{annualized:,.0f}** (extrapolated from {result.total_hours} hours)")

# Monthly breakdown
st.header("Monthly Revenue")

hourly = result.hourly_df.copy()
hourly["month"] = pd.to_datetime(hourly["timestamp"]).dt.to_period("M").astype(str)

monthly = hourly.groupby("month").agg(
    revenue=("revenue_eur", "sum"),
    hours=("revenue_eur", "count"),
    avg_price=("FCR-N Price EUR/MW", "mean")
).reset_index()

fig_monthly = px.bar(
    monthly,
    x="month",
    y="revenue",
    title="Monthly Revenue (EUR)",
    labels={"month": "Month", "revenue": "Revenue (EUR)"}
)
st.plotly_chart(fig_monthly, use_container_width=True)

# Price distribution
st.header("Price Distribution")

fig_price = px.histogram(
    hourly,
    x="FCR-N Price EUR/MW",
    nbins=50,
    title="FCR-N Price Distribution",
    labels={"FCR-N Price EUR/MW": "Price (EUR/MW)"}
)
st.plotly_chart(fig_price, use_container_width=True)

# SOC evolution (if frequency simulation used)
if use_soc_simulation and "soc_start" in hourly.columns:
    st.header("SOC Evolution")

    fig_soc = go.Figure()
    fig_soc.add_trace(go.Scatter(
        x=hourly["timestamp"],
        y=hourly["soc_start"] * 100,
        mode="lines",
        name="SOC"
    ))
    fig_soc.add_hline(y=soc_min * 100, line_dash="dash", line_color="red", annotation_text="Min SOC")
    fig_soc.add_hline(y=soc_max * 100, line_dash="dash", line_color="red", annotation_text="Max SOC")
    fig_soc.update_layout(
        title="Battery State of Charge",
        xaxis_title="Time",
        yaxis_title="SOC (%)"
    )
    st.plotly_chart(fig_soc, use_container_width=True)

    # Show unavailable hours
    unavailable = hourly[~hourly["available"]]
    if len(unavailable) > 0:
        st.warning(f"⚠️ {len(unavailable)} hours unavailable due to SOC limits")

# Frequency distribution (if simulated)
if freq_df is not None and freq_mode == "Simulated (Nordic stats)":
    st.header("Simulated Frequency Distribution")

    fig_freq = px.histogram(
        freq_df,
        x="grid_frequency",
        nbins=100,
        title="Frequency Distribution",
        labels={"grid_frequency": "Frequency (Hz)"}
    )
    fig_freq.add_vline(x=49.9, line_dash="dash", line_color="red")
    fig_freq.add_vline(x=50.1, line_dash="dash", line_color="red")
    st.plotly_chart(fig_freq, use_container_width=True)

# Export
st.header("Export Data")

col_exp1, col_exp2 = st.columns(2)

with col_exp1:
    csv = hourly.to_csv(index=False)
    st.download_button(
        "Download CSV (Raw Data)",
        csv,
        f"fcr_revenue_{year}.csv",
        "text/csv"
    )

with col_exp2:
    def create_xlsx_export():
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            # Hourly data with readable headers
            hourly_export = hourly.copy()

            header_map = {
                "timestamp": "Timestamp",
                "FCR-N Price EUR/MW": "FCR-N Price (EUR/MW)",
                "available": "Available",
                "revenue_eur": "Revenue (EUR)",
                "soc_start": "SOC Start (%)",
                "soc_end": "SOC End (%)",
                "month": "Month"
            }
            hourly_export.columns = [header_map.get(c, c) for c in hourly_export.columns]
            hourly_export.to_excel(writer, sheet_name="Hourly Data", index=False, startrow=1)

            ws = writer.sheets["Hourly Data"]
            ws["A1"] = f"FCR-N Revenue Analysis - {year} - {power_mw} MW Battery"

            # Monthly summary with formulas
            monthly_export = monthly.copy()
            monthly_export.columns = ["Month", "Revenue (EUR)", "Hours", "Avg Price (EUR/MW)"]
            monthly_export.to_excel(writer, sheet_name="Monthly Summary", index=False, startrow=1)

            ws_monthly = writer.sheets["Monthly Summary"]
            ws_monthly["A1"] = "Monthly Summary"

            # Add totals row with formulas
            total_row = len(monthly_export) + 3
            ws_monthly[f"A{total_row}"] = "TOTAL"
            ws_monthly[f"B{total_row}"] = f"=SUM(B3:B{total_row-1})"
            ws_monthly[f"C{total_row}"] = f"=SUM(C3:C{total_row-1})"
            ws_monthly[f"D{total_row}"] = f"=AVERAGE(D3:D{total_row-1})"

            # Config sheet
            config_data = pd.DataFrame([
                ["Power Capacity (MW)", power_mw],
                ["Energy Capacity (MWh)", capacity_mwh],
                ["Round-trip Efficiency (%)", efficiency * 100],
                ["Min SOC (%)", soc_min * 100],
                ["Max SOC (%)", soc_max * 100],
                ["Year", year],
                ["Total Revenue (EUR)", f"='Monthly Summary'!B{total_row}"],
                ["Total Hours", result.total_hours],
                ["Available Hours", result.available_hours],
                ["Availability (%)", f"=I9/I8*100"]
            ], columns=["Parameter", "Value"])
            config_data.to_excel(writer, sheet_name="Configuration", index=False, header=False, startcol=8)

            ws_config = writer.sheets["Configuration"]
            ws_config["H1"] = "Battery Configuration"

        return output.getvalue()

    xlsx_data = create_xlsx_export()
    st.download_button(
        "Download Excel (With Formulas)",
        xlsx_data,
        f"fcr_revenue_{year}.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# Summary table
st.header("Summary")
st.dataframe(monthly, use_container_width=True)
