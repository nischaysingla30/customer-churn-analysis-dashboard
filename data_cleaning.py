import pandas as pd
import numpy as np

def clean_churn_data(input_path="customer_churn_raw.csv", output_path="customer_churn_clean.csv"):
    print("--- Starting Data Cleaning Pipeline ---")
    
    # 1. Load raw dataset
    try:
        df = pd.read_csv(input_path)
        print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
    except FileNotFoundError:
        print(f"Error: {input_path} not found. Please run generate_data.py first.")
        return
        
    # 2. Standardize Categorical Casing (Gender)
    print("Standardizing gender casing...")
    df['gender'] = df['gender'].str.capitalize()
    print(f"Gender values after cleaning: {df['gender'].unique()}")
    
    # 3. Handle TotalCharges column (replace empty spaces/inconsistencies and convert to float)
    print("Cleaning TotalCharges column...")
    
    # Check initial nulls (Pandas doesn't see spaces as nulls)
    raw_nulls = df['TotalCharges'].isnull().sum()
    print(f"Initial TotalCharges nulls (represented as NaN): {raw_nulls}")
    
    # Convert spaces/empty strings to NaN
    df['TotalCharges'] = df['TotalCharges'].replace(r'^\s*$', np.nan, regex=True)
    
    # Check for empty strings represented as space strings
    total_nulls = df['TotalCharges'].isnull().sum()
    print(f"TotalCharges nulls after accounting for empty spaces: {total_nulls}")
    
    # Convert to numeric
    df['TotalCharges'] = pd.to_numeric(df['TotalCharges'], errors='coerce')
    
    # 4. Impute missing TotalCharges values
    # Case A: tenure is 0, so TotalCharges should be 0.0
    # Case B: tenure > 0, but TotalCharges is missing; impute using tenure * MonthlyCharges
    print("Imputing missing TotalCharges...")
    
    new_customers_mask = (df['TotalCharges'].isnull()) & (df['tenure'] == 0)
    df.loc[new_customers_mask, 'TotalCharges'] = 0.0
    
    missing_charges_mask = (df['TotalCharges'].isnull()) & (df['tenure'] > 0)
    imputed_count = missing_charges_mask.sum()
    
    # Impute tenure * MonthlyCharges
    df.loc[missing_charges_mask, 'TotalCharges'] = round(df.loc[missing_charges_mask, 'tenure'] * df.loc[missing_charges_mask, 'MonthlyCharges'], 2)
    
    print(f"Imputed TotalCharges as 0.0 for {new_customers_mask.sum()} new customers (tenure = 0)")
    print(f"Imputed TotalCharges using (tenure * MonthlyCharges) for {imputed_count} existing customers")
    
    # Verify no more nulls in TotalCharges
    remaining_nulls = df['TotalCharges'].isnull().sum()
    print(f"Remaining nulls in TotalCharges: {remaining_nulls}")
    
    # 5. Handle duplicate records
    duplicates_count = df.duplicated(subset=['customerID']).sum()
    if duplicates_count > 0:
        print(f"Found {duplicates_count} duplicate customer IDs. Removing duplicates...")
        df.drop_duplicates(subset=['customerID'], keep='first', inplace=True)
    else:
        print("No duplicate customer IDs found.")
        
    # 6. Verify and handle standard datatypes
    df['SeniorCitizen'] = df['SeniorCitizen'].astype(int)
    df['tenure'] = df['tenure'].astype(int)
    df['MonthlyCharges'] = df['MonthlyCharges'].astype(float)
    df['TotalCharges'] = df['TotalCharges'].astype(float)
    
    # 7. Final Sanity Checks
    print(f"Cleaned dataset shape: {df.shape[0]} rows, {df.shape[1]} columns")
    print("Total Charges Summary:")
    print(df['TotalCharges'].describe())
    
    # Save cleaned data to CSV
    df.to_csv(output_path, index=False)
    print(f"Cleaned dataset successfully saved to: {output_path}")
    print("--- Data Cleaning Pipeline Complete ---")

if __name__ == "__main__":
    clean_churn_data()
