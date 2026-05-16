from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
import os
from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from pymongo import MongoClient

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model = joblib.load(os.path.join(BASE_DIR, "models/xgboost_v1.joblib"))
explainer = joblib.load(os.path.join(BASE_DIR, "models/shap_explainer.joblib"))

with open(os.path.join(BASE_DIR, "models/feature_names.txt")) as f:
    feature_names = [line.strip() for line in f.readlines()]

# Load DeepSurv
try:
    cph = joblib.load(os.path.join(BASE_DIR, "models/deepsurv_v1.joblib"))
    SURVIVAL_FEATURES = ['int_rate', 'dti', 'fico_avg', 'loan_to_income',
                         'grade', 'annual_inc', 'revol_util', 'emp_length',
                         'open_acc', 'installment_to_income']
    DEEPSURV_LOADED = True
    print("DeepSurv loaded!")
except Exception as e:
    DEEPSURV_LOADED = False
    print("DeepSurv not loaded:", e)

POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://loansense:loansense123@localhost:5433/loansense_db")
engine = create_engine(POSTGRES_URL)
Base = declarative_base()
Session = sessionmaker(bind=engine)

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    borrower_name = Column(String)
    risk_score = Column(Float)
    risk_level = Column(String)
    loan_amnt = Column(Float)
    int_rate = Column(Float)
    dti = Column(Float)
    fico_avg = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://loansense:loansense123@localhost:27017/loansense_db?authSource=admin")
try:
    mongo_client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    mongo_db = mongo_client["loansense_db"]
    shap_collection = mongo_db["shap_explanations"]
    mongo_client.server_info()
    MONGO_CONNECTED = True
except Exception:
    MONGO_CONNECTED = False

app = FastAPI(title="LoanSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "LoanSense API is running",
        "postgres": "connected",
        "mongodb": "connected" if MONGO_CONNECTED else "disconnected",
        "deepsurv": "loaded" if DEEPSURV_LOADED else "not loaded"
    }

@app.post("/predict")
def predict(data: dict):
    borrower_name = data.pop("name", "Unknown")
    data.pop("id", None)
    data.pop("initials", None)
    data.pop("city", None)

    df = pd.DataFrame([data])
    for col in feature_names:
        if col not in df.columns:
            df[col] = 0
    df = df[feature_names]

    risk_score = float(model.predict_proba(df)[:, 1][0])
    level = "HIGH" if risk_score >= 0.6 else "MEDIUM" if risk_score >= 0.3 else "LOW"

    shap_values = explainer.shap_values(df)
    shap_series = pd.Series(shap_values[0], index=feature_names)
    top_reasons = shap_series.abs().sort_values(ascending=False).head(5)

    reasons = []
    for feat in top_reasons.index:
        reasons.append({
            "feature": feat,
            "value": float(df[feat].iloc[0]),
            "impact": "increases risk" if shap_series[feat] > 0 else "decreases risk",
            "shap_value": round(float(shap_series[feat]), 4)
        })

    # DeepSurv survival prediction
    risk_at_36mo = None
    days_to_default = None
    if DEEPSURV_LOADED:
        try:
            surv_input = pd.DataFrame([data])
            for col in SURVIVAL_FEATURES:
                if col not in surv_input.columns:
                    surv_input[col] = 0
            surv_input = surv_input[SURVIVAL_FEATURES]
            risk_at_36mo = float(1 - cph.predict_survival_function(
                surv_input, times=[36]).values[0][0])
            median_surv = float(cph.predict_median(surv_input))
            days_to_default = int(median_surv * 30) if median_surv != float('inf') else None
        except Exception:
            pass

    try:
        session = Session()
        pred = Prediction(
            borrower_name=borrower_name,
            risk_score=risk_score,
            risk_level=level,
            loan_amnt=float(data.get("loan_amnt", 0)),
            int_rate=float(data.get("int_rate", 0)),
            dti=float(data.get("dti", 0)),
            fico_avg=float(data.get("fico_avg", 0)),
        )
        session.add(pred)
        session.commit()
        pred_id = pred.id
        session.close()
    except Exception:
        pred_id = None

    if MONGO_CONNECTED:
        try:
            shap_collection.insert_one({
                "borrower_name": borrower_name,
                "risk_score": risk_score,
                "risk_level": level,
                "reasons": reasons,
                "created_at": datetime.utcnow()
            })
        except Exception:
            pass

    return {
        "risk_score": round(risk_score, 4),
        "risk_level": level,
        "reasons": reasons,
        "survival": {
            "risk_at_36mo": round(risk_at_36mo, 4) if risk_at_36mo else None,
            "days_to_default": days_to_default
        },
        "saved_to_postgres": pred_id is not None,
        "saved_to_mongo": MONGO_CONNECTED
    }

@app.get("/predictions")
def get_predictions():
    try:
        session = Session()
        preds = session.query(Prediction).order_by(Prediction.created_at.desc()).limit(50).all()
        session.close()
        return [
            {
                "id": p.id,
                "borrower_name": p.borrower_name,
                "risk_score": round(p.risk_score, 4),
                "risk_level": p.risk_level,
                "loan_amnt": p.loan_amnt,
                "int_rate": p.int_rate,
                "created_at": str(p.created_at)
            }
            for p in preds
        ]
    except Exception as e:
        return {"error": str(e)}

@app.get("/stats")
def get_stats():
    try:
        session = Session()
        total = session.query(Prediction).count()
        high = session.query(Prediction).filter(Prediction.risk_level == "HIGH").count()
        medium = session.query(Prediction).filter(Prediction.risk_level == "MEDIUM").count()
        low = session.query(Prediction).filter(Prediction.risk_level == "LOW").count()
        session.close()
        return {"total": total, "high": high, "medium": medium, "low": low}
    except Exception as e:
        return {"error": str(e)}