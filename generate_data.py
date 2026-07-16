import pandas as pd
import numpy as np
import os

def generate_customer_churn_dataset(num_customers=1000, output_path="customer_churn_raw.csv"):
    np.random.seed(42)
    
    # 1. Generate core demographics
    customer_ids = [f"{np.random.randint(1000, 9999)}-{chr(np.random.randint(65, 90))}{chr(np.random.randint(65, 90))}{chr(np.random.randint(65, 90))}{chr(np.random.randint(65, 90))}" for _ in range(num_customers)]
    genders = np.random.choice(["Male", "Female"], size=num_customers, p=[0.50, 0.50])
    senior_citizens = np.random.choice([0, 1], size=num_customers, p=[0.84, 0.16])
    partners = np.random.choice(["Yes", "No"], size=num_customers, p=[0.48, 0.52])
    dependents = np.random.choice(["Yes", "No"], size=num_customers, p=[0.30, 0.70])
    
    # 2. Tenure & Services
    tenures = np.random.choice(
        [0] + list(range(1, 73)), 
        size=num_customers, 
        p=[0.01] + [0.99/72]*72
    )  # 1% are new customers (tenure = 0)
    
    phone_services = np.random.choice(["Yes", "No"], size=num_customers, p=[0.90, 0.10])
    
    multiple_lines = []
    for p_serv in phone_services:
        if p_serv == "No":
            multiple_lines.append("No phone service")
        else:
            multiple_lines.append(np.random.choice(["Yes", "No"], p=[0.45, 0.55]))
            
    internet_services = np.random.choice(["DSL", "Fiber optic", "No"], size=num_customers, p=[0.35, 0.45, 0.20])
    
    # Internet-related add-ons
    online_securities = []
    online_backups = []
    device_protections = []
    tech_supports = []
    streaming_tvs = []
    streaming_movies = []
    
    for i_serv in internet_services:
        if i_serv == "No":
            online_securities.append("No internet service")
            online_backups.append("No internet service")
            device_protections.append("No internet service")
            tech_supports.append("No internet service")
            streaming_tvs.append("No internet service")
            streaming_movies.append("No internet service")
        else:
            online_securities.append(np.random.choice(["Yes", "No"], p=[0.35, 0.65]))
            online_backups.append(np.random.choice(["Yes", "No"], p=[0.40, 0.60]))
            device_protections.append(np.random.choice(["Yes", "No"], p=[0.40, 0.60]))
            tech_supports.append(np.random.choice(["Yes", "No"], p=[0.35, 0.65]))
            streaming_tvs.append(np.random.choice(["Yes", "No"], p=[0.45, 0.55]))
            streaming_movies.append(np.random.choice(["Yes", "No"], p=[0.45, 0.55]))
            
    # 3. Contract & Billing
    contracts = np.random.choice(["Month-to-month", "One year", "Two year"], size=num_customers, p=[0.55, 0.21, 0.24])
    paperless_billings = np.random.choice(["Yes", "No"], size=num_customers, p=[0.60, 0.40])
    payment_methods = np.random.choice(
        ["Electronic check", "Mailed check", "Bank transfer (automatic)", "Credit card (automatic)"],
        size=num_customers,
        p=[0.34, 0.23, 0.21, 0.22]
    )
    
    # 4. Financials (correlated with internet service type)
    monthly_charges = []
    for i, i_serv in enumerate(internet_services):
        # Base fee + service fee + add-on fees
        base = 20.0
        if i_serv == "DSL":
            base = 50.0 + np.random.normal(5.0, 3.0)
        elif i_serv == "Fiber optic":
            base = 80.0 + np.random.normal(8.0, 4.0)
        else: # No internet
            base = 20.0 + np.random.normal(2.0, 1.0)
            
        # Add a bit for phone
        if phone_services[i] == "Yes":
            base += 10.0
            if multiple_lines[i] == "Yes":
                base += 5.0
                
        # Add for other add-ons
        addons = [online_securities[i], online_backups[i], device_protections[i], tech_supports[i], streaming_tvs[i], streaming_movies[i]]
        addon_count = sum(1 for a in addons if a == "Yes")
        base += addon_count * 5.0
        
        monthly_charges.append(round(max(18.25, base), 2))
        
    # Calculate Total Charges
    total_charges = []
    for i in range(num_customers):
        if tenures[i] == 0:
            # New customer, total charges should be blank or nan
            total_charges.append(np.nan)
        else:
            # Let's add some slight noise or missing values (e.g., 1.5% random missing data)
            if np.random.rand() < 0.015:
                total_charges.append(" ")  # Represented as spaces, a common real-world SQL/Pandas parsing issue
            else:
                charge = tenures[i] * monthly_charges[i] + np.random.normal(0, monthly_charges[i] * 0.02)
                total_charges.append(round(max(monthly_charges[i], charge), 2))
                
    # 5. Churn - probability based on key risk factors:
    # - Contract: Month-to-month (High risk)
    # - Tenure: Short tenure (High risk)
    # - InternetService: Fiber optic (High risk due to competition/price)
    # - TechSupport: No (High risk)
    # - PaymentMethod: Electronic check (Higher risk than automatic)
    churn = []
    for i in range(num_customers):
        # Calculate base probability of churn
        prob = 0.05 # Low base rate
        
        if contracts[i] == "Month-to-month":
            prob += 0.35
            if tenures[i] < 6:
                prob += 0.15
            elif tenures[i] < 12:
                prob += 0.08
        elif contracts[i] == "One year":
            prob += 0.05
        else: # Two year
            prob += 0.01
            
        if internet_services[i] == "Fiber optic":
            prob += 0.10
            
        if internet_services[i] != "No" and tech_supports[i] == "No":
            prob += 0.10
            
        if payment_methods[i] == "Electronic check":
            prob += 0.08
            
        if senior_citizens[i] == 1:
            prob += 0.05
            
        # Scale back depending on tenure (loyalty effect)
        if tenures[i] > 36:
            prob *= 0.4
        if tenures[i] > 60:
            prob *= 0.2
            
        # Clamp probability between 1% and 95%
        prob = min(0.95, max(0.01, prob))
        
        churn.append(np.random.choice(["Yes", "No"], p=[prob, 1 - prob]))
        
    # Create DataFrame
    df = pd.DataFrame({
        "customerID": customer_ids,
        "gender": genders,
        "SeniorCitizen": senior_citizens,
        "Partner": partners,
        "Dependents": dependents,
        "tenure": tenures,
        "PhoneService": phone_services,
        "MultipleLines": multiple_lines,
        "InternetService": internet_services,
        "OnlineSecurity": online_securities,
        "OnlineBackup": online_backups,
        "DeviceProtection": device_protections,
        "TechSupport": tech_supports,
        "StreamingTV": streaming_tvs,
        "StreamingMovies": streaming_movies,
        "Contract": contracts,
        "PaperlessBilling": paperless_billings,
        "PaymentMethod": payment_methods,
        "MonthlyCharges": monthly_charges,
        "TotalCharges": total_charges,
        "Churn": churn
    })
    
    # Introduce some casing inconsistency/errors to correct during data cleaning
    df.loc[df["gender"] == "Female", "gender"] = np.random.choice(["Female", "female", "FEMALE"], size=sum(df["gender"] == "Female"), p=[0.90, 0.08, 0.02])
    df.loc[df["gender"] == "Male", "gender"] = np.random.choice(["Male", "male", "MALE"], size=sum(df["gender"] == "Male"), p=[0.90, 0.08, 0.02])
    
    df.to_csv(output_path, index=False)
    print(f"Generated raw dataset: {output_path} ({num_customers} records)")

if __name__ == "__main__":
    generate_customer_churn_dataset()
