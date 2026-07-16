-- Customer Churn Analysis Queries
-- Target Database: PostgreSQL / MySQL / SQLite (Standard SQL)

-- 1. Overall Churn Rate & Customer Count
-- Returns total customers, total churned customers, and churn rate percentage.
SELECT 
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct
FROM customers;


-- 2. Churn Rate by Contract Type
-- Month-to-month contracts usually show significantly higher churn.
SELECT 
    Contract,
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct
FROM customers
GROUP BY Contract
ORDER BY churn_rate_pct DESC;


-- 3. Churn Analysis by Internet Service Type
-- Evaluates which technology has higher customer attrition (often Fiber Optic due to pricing/competition).
SELECT 
    InternetService,
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct,
    ROUND(AVG(MonthlyCharges), 2) as avg_monthly_charges
FROM customers
GROUP BY InternetService
ORDER BY churn_rate_pct DESC;


-- 4. Churn Rate by Tenure Cohort
-- Groups customers by tenure ranges to see if newer customers are more likely to churn.
WITH tenure_buckets AS (
    SELECT 
        customerID,
        Churn,
        CASE 
            WHEN tenure = 0 THEN '0 Months (New)'
            WHEN tenure <= 6 THEN '1 - 6 Months'
            WHEN tenure <= 12 THEN '7 - 12 Months'
            WHEN tenure <= 24 THEN '13 - 24 Months'
            WHEN tenure <= 48 THEN '25 - 48 Months'
            ELSE 'Over 4 Years (49+ Months)'
        END as tenure_cohort
    FROM customers
)
SELECT 
    tenure_cohort,
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct
FROM tenure_buckets
GROUP BY tenure_cohort
ORDER BY 
    CASE tenure_cohort
        WHEN '0 Months (New)' THEN 1
        WHEN '1 - 6 Months' THEN 2
        WHEN '7 - 12 Months' THEN 3
        WHEN '13 - 24 Months' THEN 4
        WHEN '25 - 48 Months' THEN 5
        ELSE 6
    END;


-- 5. Revenue At Risk (Total Loss due to Churn)
-- Shows total monthly and accumulated contract revenue lost due to churned customers.
SELECT 
    Churn,
    COUNT(customerID) as customer_count,
    ROUND(SUM(MonthlyCharges), 2) as monthly_revenue,
    ROUND(SUM(TotalCharges), 2) as total_revenue_collected,
    ROUND(AVG(MonthlyCharges), 2) as avg_monthly_bill
FROM customers
GROUP BY Churn;


-- 6. Top 10 High-Risk Customers Currently Active
-- Filters active customers with multiple risk factors (Month-to-month, High monthly charges, No tech support, short tenure).
-- Useful for proactive customer outreach campaigns.
SELECT 
    customerID,
    gender,
    tenure,
    Contract,
    InternetService,
    TechSupport,
    MonthlyCharges,
    TotalCharges
FROM customers
WHERE 
    Churn = 'No' 
    AND Contract = 'Month-to-month'
    AND TechSupport = 'No'
    AND tenure <= 12
    AND MonthlyCharges >= (SELECT PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY MonthlyCharges) FROM customers) -- Postgres syntax
ORDER BY MonthlyCharges DESC, tenure ASC
LIMIT 10;
