"""
churn_model.py - Baseline churn prediction (ML extension of the dashboard project)

What this script does:
  1. Loads the cleaned data (customer_churn_clean.csv)
  2. Compares two models: Logistic Regression and Random Forest
  3. Shows which features drive churn (Logistic Regression coefficients)
  4. Scores every ACTIVE customer with a churn probability
  5. Estimates revenue at risk = monthly charges x churn probability

Run:  python churn_model.py
Needs: pip install pandas scikit-learn
"""

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import (
    StratifiedKFold, cross_val_predict, cross_val_score, train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

RANDOM_STATE = 42  # same idea as the seed in generate_data.py: reproducible results

# ---------------------------------------------------------------- 1. Load data
df = pd.read_csv("customer_churn_clean.csv")

# Target: 1 = churned, 0 = still active
y = (df["Churn"] == "Yes").astype(int)

# Features: everything except the target and the ID (an ID is just a label,
# it has no predictive meaning and would only add noise)
X = df.drop(columns=["Churn", "customerID"])
numeric_cols = X.select_dtypes("number").columns.tolist()
categorical_cols = [c for c in X.columns if c not in numeric_cols]


def build_pipeline(model):
    """Preprocessing + model in ONE pipeline.
    - Numeric columns are standardised (mean 0, std 1) so tenure (0-72) and
      MonthlyCharges ($20-$120) are on a similar scale.
    - Categorical columns are one-hot encoded (Contract -> 'Contract_One year',
      'Contract_Two year'; drop='first' removes the redundant base category).
    Putting everything in a Pipeline means the encoder/scaler are learned ONLY
    from training data in every split, which prevents data leakage."""
    pre = ColumnTransformer([
        ("num", StandardScaler(), numeric_cols),
        ("cat", OneHotEncoder(drop="first", handle_unknown="ignore"), categorical_cols),
    ])
    return Pipeline([("prep", pre), ("model", model)])


# ------------------------------------------------- 2. Compare two models
# stratify=y keeps the churn share (~26%) the same in train and test sets
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

models = {
    # class_weight="balanced" penalises mistakes on the minority class (churners)
    # more, so the model does not simply predict "No churn" for everyone.
    "Logistic Regression": LogisticRegression(class_weight="balanced", max_iter=1000),
    "Random Forest": RandomForestClassifier(
        n_estimators=300, min_samples_leaf=5, class_weight="balanced",
        random_state=RANDOM_STATE,
    ),
}

for name, model in models.items():
    pipe = build_pipeline(model).fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    # 5-fold cross validation: a more reliable estimate than one 200-row test set
    cv_auc = cross_val_score(build_pipeline(model), X, y, cv=cv, scoring="roc_auc")

    print(f"\n=== {name} ===")
    print(f"Test ROC-AUC : {roc_auc_score(y_test, proba):.3f}")
    print(f"5-fold CV AUC: {cv_auc.mean():.3f} (+/- {cv_auc.std():.3f})")
    print(classification_report(y_test, pred, target_names=["Stayed", "Churned"]))
    print("Confusion matrix [[TN FP] [FN TP]]:")
    print(confusion_matrix(y_test, pred))

# ------------------------------------- 3. What drives churn? (interpretability)
lr_pipe = build_pipeline(models["Logistic Regression"]).fit(X, y)
names = lr_pipe.named_steps["prep"].get_feature_names_out()
coefs = pd.Series(lr_pipe.named_steps["model"].coef_[0], index=names)
top = coefs.reindex(coefs.abs().sort_values(ascending=False).index).head(8)
print("\n=== Top 8 drivers (Logistic Regression coefficients) ===")
print("Negative = lowers churn risk, positive = raises churn risk")
print(top.round(2).to_string())

# -------------------------------------- 4. Score active customers + revenue at risk
# For dollar estimates we need honest probabilities. class_weight="balanced"
# inflates probabilities, so for scoring we use a plain Logistic Regression.
# cross_val_predict gives each customer a probability from a model that did NOT
# see that customer during training (out-of-fold), so scores are not over-optimistic.
score_model = build_pipeline(LogisticRegression(max_iter=1000))
df["churn_probability"] = cross_val_predict(
    score_model, X, y, cv=cv, method="predict_proba"
)[:, 1]

active = df[df["Churn"] == "No"].copy()
active["expected_loss"] = active["MonthlyCharges"] * active["churn_probability"]
active["risk_tier"] = pd.cut(
    active["churn_probability"], bins=[0, 0.25, 0.5, 1.0],
    labels=["Low", "Medium", "High"], include_lowest=True,
)

high = active[active["risk_tier"] == "High"]
print("\n=== Revenue at risk (active customers only) ===")
print(f"Active customers scored        : {len(active)}")
print(f"High-risk customers (p >= 0.5) : {len(high)}")
print(f"Monthly revenue of high-risk   : ${high['MonthlyCharges'].sum():,.0f}")
print(f"Expected monthly loss (sum of charge x probability): "
      f"${active['expected_loss'].sum():,.0f}")

out_cols = ["customerID", "Contract", "InternetService", "tenure",
            "MonthlyCharges", "churn_probability", "risk_tier"]
active.sort_values("churn_probability", ascending=False)[out_cols].round(3).to_csv(
    "churn_risk_scores.csv", index=False
)
print("\nSaved: churn_risk_scores.csv (active customers, highest risk first)")
