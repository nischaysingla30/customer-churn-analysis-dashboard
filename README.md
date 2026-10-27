# Customer Churn Analysis Dashboard

An interactive dashboard and data engineering project showcasing customer churn analysis using SQL, Python, and web technologies.

## Project Structure
- `generate_data.py`: Python script to generate raw synthetic customer data.
- `data_cleaning.py`: Python data cleaning pipeline using Pandas & NumPy.
- `queries.sql`: SQL queries analyzing customer cohorts, churn rates, and lifetime value.
- `index.html`: Main interactive dashboard interface.
- `styles.css`: Slate/glassmorphism theme styles.
- `app.js`: Client-side logic for interactive filtering, KPIs, SQL playground, and pipeline simulation.

## Getting Started

### Prerequisites
- Python 3.x
- Pandas (`pip install pandas`)
- NumPy (`pip install numpy`)

### Running the Python Scripts
To generate raw customer data:
```bash
python generate_data.py
```
This generates `customer_churn_raw.csv` in the directory.

To clean and transform the raw data:
```bash
python data_cleaning.py
```
This processes `customer_churn_raw.csv` and outputs `customer_churn_clean.csv`.

### Viewing the Dashboard
Simply open `index.html` in your web browser. You can filter customers by demographics, payment method, contract types, and tenure to visualize churn trends, inspect SQL analysis, run mock Python cleaning, and review data-driven retention insights.

## ML Extension: Churn Prediction

`churn_model.py` trains a Logistic Regression and a Random Forest on the cleaned data
(stratified split, class weights, 5-fold CV AUC ~0.80) and scores active customers
with a churn probability. Output: `churn_risk_scores.csv`.

Main drivers: contract type and tenure. Note: the data is synthetic, so the model
mainly recovers the patterns embedded by the generator.
