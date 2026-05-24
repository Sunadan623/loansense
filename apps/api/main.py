from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
import os
from dotenv import load_dotenv
load_dotenv()
from datetime import datetime
import httpx

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from pymongo import MongoClient
from apps.api.auth import hash_password, verify_password, create_access_token, get_current_user
import razorpay
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model = joblib.load(os.path.join(BASE_DIR, "models/xgboost_v1.joblib"))
explainer = joblib.load(os.path.join(BASE_DIR, "models/shap_explainer.joblib"))

with open(os.path.join(BASE_DIR, "models/feature_names.txt")) as f:
    feature_names = [line.strip() for line in f.readlines()]

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


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="borrower")
    created_at = Column(DateTime, default=datetime.utcnow)


class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    loan_amnt = Column(Float)
    term = Column(Integer)
    int_rate = Column(Float)
    installment = Column(Float)
    grade = Column(Integer)
    annual_inc = Column(Float)
    dti = Column(Float)
    fico_avg = Column(Integer)
    emp_length = Column(Integer)
    purpose = Column(String, default="personal")  # personal, home, car, education, business, medical
    risk_score = Column(Float, default=0)
    risk_level = Column(String, default="UNKNOWN")
    status = Column(String, default="pending")  # pending, approved, rejected, disbursed, active, paid, defaulted
    rejection_reason = Column(String, nullable=True)
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


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
class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    status = Column(String, default="created")  # created, paid, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

class DeferralRequest(Base):
    __tablename__ = "deferral_requests"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    reason = Column(String)
    requested_months = Column(Integer, default=1)
    status = Column(String, default="pending")  # pending, approved, rejected
    analyst_note = Column(String, nullable=True)
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
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


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

@app.post("/recommend")
async def recommend(data: dict):
    borrower_name = data.get("name", "Borrower")
    risk_score = data.get("risk_score", 0)
    risk_level = data.get("risk_level", "UNKNOWN")
    int_rate = data.get("int_rate", 0)
    dti = data.get("dti", 0)
    loan_amnt = data.get("loan_amnt", 0)
    days_to_default = data.get("days_to_default", None)

    if not OPENROUTER_API_KEY:
        return {"error": "OpenRouter API key not configured"}

    prompt = f"""You are a loan recovery specialist for an Indian NBFC. Analyze this borrower and suggest 3 specific recovery actions.

Borrower: {borrower_name}
Risk Score: {risk_score:.0%} ({risk_level} risk)
Loan Amount: ₹{loan_amnt:,.0f}
Interest Rate: {int_rate}%
DTI (Debt-to-Income): {dti}
{"Predicted to default in: ~" + str(days_to_default // 30) + " months" if days_to_default else ""}

Return ONLY a JSON array with exactly 3 actions. Format:
[
  {{"action": "Short action title", "priority": "HIGH/MEDIUM/LOW", "details": "1-line specific recommendation", "icon": "phone/mail/refresh/alert"}},
  ...
]
No other text, just the JSON array."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openrouter/free",
                    "messages": [{"role": "user", "content": prompt}]
                }
            )
            result = response.json()
            if "choices" not in result:
                return {"error": "OpenRouter API error", "details": result}
            content = result["choices"][0]["message"]["content"]

            import json
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                actions = json.loads(json_match.group())
                return {"borrower": borrower_name, "actions": actions}
            return {"error": "Could not parse AI response", "raw": content}
    except Exception as e:
        return {"error": str(e)}


# ============== AUTH ENDPOINTS ==============

@app.post("/signup")
def signup(data: dict):
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    name = data.get("name", "").strip()

    if not email or not password or not name:
        return {"error": "Email, password, and name are required"}

    if len(password) < 6:
        return {"error": "Password must be at least 6 characters"}

    session = Session()
    try:
        existing = session.query(User).filter(User.email == email).first()
        if existing:
            session.close()
            return {"error": "Email already registered"}

        user = User(
            email=email,
            name=name,
            hashed_password=hash_password(password),
            role="borrower"
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = create_access_token({"user_id": user.id, "email": user.email, "role": user.role})
        result = {
            "token": token,
            "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
        }
        session.close()
        return result
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.post("/login")
def login(data: dict):
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    session = Session()
    try:
        user = session.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            session.close()
            return {"error": "Invalid email or password"}

        token = create_access_token({"user_id": user.id, "email": user.email, "role": user.role})
        result = {
            "token": token,
            "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
        }
        session.close()
        return result
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    session = Session()
    user = session.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        session.close()
        return {"error": "User not found"}
    result = {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
    session.close()
    return result


@app.get("/my-loans")
def get_my_loans(current_user: dict = Depends(get_current_user)):
    session = Session()
    loans = session.query(Loan).filter(Loan.user_id == current_user["user_id"]).order_by(Loan.created_at.desc()).all()
    result = [
        {
            "id": l.id,
            "purpose": l.purpose,
            "loan_amnt": l.loan_amnt,
            "term": l.term,
            "int_rate": l.int_rate,
            "installment": l.installment,
            "risk_score": l.risk_score,
            "risk_level": l.risk_level,
            "status": l.status,
            "rejection_reason": l.rejection_reason,
            "reviewed_at": str(l.reviewed_at) if l.reviewed_at else None,
            "created_at": str(l.created_at)
        }
        for l in loans
    ]
    session.close()
    return result


# Loan type configurations
LOAN_TYPES = {
    "personal": {"min": 10000, "max": 500000, "rate_range": (10, 18), "max_tenure": 60, "risk_multiplier": 1.0},
    "home": {"min": 500000, "max": 10000000, "rate_range": (7, 11), "max_tenure": 240, "risk_multiplier": 0.7},
    "car": {"min": 100000, "max": 2000000, "rate_range": (8, 14), "max_tenure": 84, "risk_multiplier": 0.85},
    "education": {"min": 50000, "max": 2000000, "rate_range": (8, 13), "max_tenure": 120, "risk_multiplier": 0.9},
    "business": {"min": 100000, "max": 5000000, "rate_range": (11, 20), "max_tenure": 84, "risk_multiplier": 1.2},
    "medical": {"min": 25000, "max": 1500000, "rate_range": (10, 16), "max_tenure": 60, "risk_multiplier": 0.95},
}


@app.get("/loan-types")
def get_loan_types():
    return LOAN_TYPES


@app.post("/apply-loan")
def apply_loan(data: dict, current_user: dict = Depends(get_current_user)):
    """Borrower submits loan application — goes to PENDING status awaiting bank approval"""
    try:
        purpose = data.get("purpose", "personal")
        if purpose not in LOAN_TYPES:
            return {"error": "Invalid loan purpose"}

        loan_amnt = float(data.get("loan_amnt", 0))
        term = int(data.get("term", 36))
        int_rate = float(data.get("int_rate", 12.0))

        # Validate against loan type limits
        cfg = LOAN_TYPES[purpose]
        if loan_amnt < cfg["min"] or loan_amnt > cfg["max"]:
            return {"error": f"Loan amount for {purpose} loans must be between ₹{cfg['min']:,} and ₹{cfg['max']:,}"}
        if term > cfg["max_tenure"]:
            return {"error": f"Maximum tenure for {purpose} loans is {cfg['max_tenure']} months"}

        # Calculate EMI properly: P*r*(1+r)^n / ((1+r)^n - 1)
        r = int_rate / 100 / 12
        n = term
        emi = (loan_amnt * r * (1 + r) ** n) / ((1 + r) ** n - 1) if r > 0 else loan_amnt / n

        loan_features = {
            "loan_amnt": loan_amnt,
            "term": term,
            "int_rate": int_rate,
            "installment": emi,
            "grade": int(data.get("grade", 3)),
            "emp_length": int(data.get("emp_length", 1)),
            "annual_inc": float(data.get("annual_inc", 50000)),
            "dti": float(data.get("dti", 15)),
            "fico_range_low": int(data.get("fico_avg", 700)) - 2,
            "fico_range_high": int(data.get("fico_avg", 700)) + 2,
            "fico_avg": int(data.get("fico_avg", 700)),
        }

        # Get base risk from XGBoost
        df = pd.DataFrame([loan_features])
        for col in feature_names:
            if col not in df.columns:
                df[col] = 0
        df = df[feature_names]
        base_risk = float(model.predict_proba(df)[:, 1][0])

        # Adjust risk by loan type
        adjusted_risk = min(base_risk * cfg["risk_multiplier"], 1.0)
        risk_level = "HIGH" if adjusted_risk >= 0.6 else "MEDIUM" if adjusted_risk >= 0.3 else "LOW"

        # Save with status = pending (awaiting bank approval)
        session = Session()
        loan = Loan(
            user_id=current_user["user_id"],
            loan_amnt=loan_amnt,
            term=term,
            int_rate=int_rate,
            installment=round(emi, 2),
            grade=loan_features["grade"],
            annual_inc=loan_features["annual_inc"],
            dti=loan_features["dti"],
            fico_avg=loan_features["fico_avg"],
            emp_length=loan_features["emp_length"],
            purpose=purpose,
            risk_score=adjusted_risk,
            risk_level=risk_level,
            status="pending"
        )
        session.add(loan)
        session.commit()
        session.refresh(loan)
        loan_id = loan.id
        session.close()

        return {
            "success": True,
            "loan_id": loan_id,
            "purpose": purpose,
            "risk_score": round(adjusted_risk, 4),
            "risk_level": risk_level,
            "installment": round(emi, 2),
            "status": "pending",
            "message": "Application submitted! Awaiting bank approval."
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/pending-applications")
def get_pending_applications(current_user: dict = Depends(get_current_user)):
    """For analysts — list all pending loan applications"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can view pending applications"}

    session = Session()
    loans = session.query(Loan).filter(Loan.status == "pending").all()
    result = []
    for l in loans:
        user = session.query(User).filter(User.id == l.user_id).first()
        result.append({
            "id": l.id,
            "borrower_name": user.name if user else "Unknown",
            "borrower_email": user.email if user else "",
            "purpose": l.purpose,
            "loan_amnt": l.loan_amnt,
            "term": l.term,
            "int_rate": l.int_rate,
            "installment": l.installment,
            "risk_score": round(l.risk_score, 4),
            "risk_level": l.risk_level,
            "annual_inc": l.annual_inc,
            "dti": l.dti,
            "fico_avg": l.fico_avg,
            "created_at": str(l.created_at)
        })
    session.close()
    return result

@app.get("/approved-applications")
def get_approved_applications(current_user: dict = Depends(get_current_user)):
    """For analysts — list approved loans awaiting disbursement"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can view this"}

    session = Session()
    loans = session.query(Loan).filter(Loan.status == "approved").all()
    result = []
    for l in loans:
        user = session.query(User).filter(User.id == l.user_id).first()
        result.append({
            "id": l.id,
            "borrower_name": user.name if user else "Unknown",
            "borrower_email": user.email if user else "",
            "purpose": l.purpose,
            "loan_amnt": l.loan_amnt,
            "term": l.term,
            "int_rate": l.int_rate,
            "installment": l.installment,
            "risk_score": round(l.risk_score, 4),
            "risk_level": l.risk_level,
            "reviewed_at": str(l.reviewed_at) if l.reviewed_at else None
        })
    session.close()
    return result

@app.get("/active-loans")
def get_active_loans(current_user: dict = Depends(get_current_user)):
    """For analysts — list all active (disbursed) loans for risk monitoring"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can view this"}

    session = Session()
    loans = session.query(Loan).filter(Loan.status == "active").order_by(Loan.created_at.desc()).all()
    result = []
    for l in loans:
        user = session.query(User).filter(User.id == l.user_id).first()
        result.append({
            "id": l.id,
            "borrower_name": user.name if user else "Unknown",
            "borrower_email": user.email if user else "",
            "purpose": l.purpose,
            "loan_amnt": l.loan_amnt,
            "term": l.term,
            "int_rate": l.int_rate,
            "installment": l.installment,
            "dti": l.dti,
            "fico_avg": l.fico_avg,
            "annual_inc": l.annual_inc,
            "emp_length": l.emp_length,
            "grade": l.grade,
            "risk_score": round(l.risk_score, 4),
            "risk_level": l.risk_level
        })
    session.close()
    return result
@app.post("/approve-loan/{loan_id}")
def approve_loan(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Analyst approves a pending loan"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can approve loans"}

    session = Session()
    loan = session.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        session.close()
        return {"error": "Loan not found"}
    if loan.status != "pending":
        session.close()
        return {"error": f"Loan is already {loan.status}"}

    loan.status = "approved"
    loan.reviewed_by = current_user["user_id"]
    loan.reviewed_at = datetime.utcnow()
    session.commit()
    session.close()
    return {"success": True, "message": "Loan approved", "loan_id": loan_id}


@app.post("/reject-loan/{loan_id}")
def reject_loan(loan_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Analyst rejects a pending loan with a reason"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can reject loans"}

    reason = data.get("reason", "Application did not meet criteria")
    session = Session()
    loan = session.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        session.close()
        return {"error": "Loan not found"}

    loan.status = "rejected"
    loan.rejection_reason = reason
    loan.reviewed_by = current_user["user_id"]
    loan.reviewed_at = datetime.utcnow()
    session.commit()
    session.close()
    return {"success": True, "message": "Loan rejected", "loan_id": loan_id}


@app.post("/disburse-loan/{loan_id}")
def disburse_loan(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Analyst marks an approved loan as disbursed (money sent to borrower)"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can disburse loans"}

    session = Session()
    loan = session.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        session.close()
        return {"error": "Loan not found"}
    if loan.status != "approved":
        session.close()
        return {"error": "Loan must be approved before disbursement"}

    loan.status = "active"
    session.commit()
    session.close()
    return {"success": True, "message": "Loan disbursed", "loan_id": loan_id}
# ============== PAYMENT ENDPOINTS ==============

@app.post("/create-payment-order/{loan_id}")
def create_payment_order(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Create a Razorpay order for EMI payment"""
    if not razorpay_client:
        return {"error": "Razorpay not configured"}

    session = Session()
    try:
        loan = session.query(Loan).filter(
            Loan.id == loan_id,
            Loan.user_id == current_user["user_id"]
        ).first()

        if not loan:
            session.close()
            return {"error": "Loan not found"}
        if loan.status != "active":
            session.close()
            return {"error": "Loan is not active"}

        # Cache loan details BEFORE closing session
        installment = float(loan.installment)
        purpose = loan.purpose
        amount_paise = int(installment * 100)

        # Create Razorpay order
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"loan_{loan_id}_emi_{int(datetime.utcnow().timestamp())}",
            "notes": {
                "loan_id": str(loan_id),
                "user_id": str(current_user["user_id"]),
                "purpose": purpose
            }
        }
        order = razorpay_client.order.create(data=order_data)

        # Save payment record
        payment = Payment(
            loan_id=loan_id,
            user_id=current_user["user_id"],
            amount=installment,
            razorpay_order_id=order["id"],
            status="created"
        )
        session.add(payment)
        session.commit()
        payment_id = payment.id
        session.close()

        return {
            "success": True,
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "payment_id": payment_id,
            "loan_purpose": purpose,
            "emi_amount": installment
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.post("/verify-payment")
def verify_payment(data: dict, current_user: dict = Depends(get_current_user)):
    """Verify Razorpay payment after checkout success"""
    if not razorpay_client:
        return {"error": "Razorpay not configured"}

    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return {"error": "Missing payment details"}

    session = Session()
    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        })

        # Mark payment as paid
        payment = session.query(Payment).filter(
            Payment.razorpay_order_id == razorpay_order_id
        ).first()
        if not payment:
            session.close()
            return {"error": "Payment record not found"}

        payment.razorpay_payment_id = razorpay_payment_id
        payment.razorpay_signature = razorpay_signature
        payment.status = "paid"
        payment.paid_at = datetime.utcnow()
        session.commit()
        session.close()

        return {"success": True, "message": "Payment verified successfully"}
    except razorpay.errors.SignatureVerificationError:
        session.close()
        return {"error": "Invalid signature — payment verification failed"}
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.get("/payment-history/{loan_id}")
def get_payment_history(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Get all payments for a loan"""
    session = Session()
    payments = session.query(Payment).filter(
        Payment.loan_id == loan_id,
        Payment.user_id == current_user["user_id"]
    ).order_by(Payment.created_at.desc()).all()

    result = [
        {
            "id": p.id,
            "amount": p.amount,
            "status": p.status,
            "razorpay_payment_id": p.razorpay_payment_id,
            "created_at": str(p.created_at),
            "paid_at": str(p.paid_at) if p.paid_at else None
        }
        for p in payments
    ]
    session.close()
    return result
# ============== DEFERRAL ENDPOINTS ==============

@app.post("/request-deferral/{loan_id}")
def request_deferral(loan_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Borrower requests EMI deferral"""
    session = Session()
    try:
        loan = session.query(Loan).filter(
            Loan.id == loan_id,
            Loan.user_id == current_user["user_id"]
        ).first()

        if not loan:
            session.close()
            return {"error": "Loan not found"}
        if loan.status != "active":
            session.close()
            return {"error": "Can only defer active loans"}

        # Check if there's already a pending request
        existing = session.query(DeferralRequest).filter(
            DeferralRequest.loan_id == loan_id,
            DeferralRequest.status == "pending"
        ).first()
        if existing:
            session.close()
            return {"error": "You already have a pending deferral request"}

        reason = data.get("reason", "").strip()
        months = int(data.get("months", 1))

        if not reason or len(reason) < 10:
            session.close()
            return {"error": "Please provide a detailed reason (at least 10 characters)"}
        if months < 1 or months > 6:
            session.close()
            return {"error": "Deferral period must be between 1 and 6 months"}

        deferral = DeferralRequest(
            loan_id=loan_id,
            user_id=current_user["user_id"],
            reason=reason,
            requested_months=months,
            status="pending"
        )
        session.add(deferral)
        session.commit()
        session.refresh(deferral)
        deferral_id = deferral.id
        session.close()

        return {
            "success": True,
            "deferral_id": deferral_id,
            "message": "Deferral request submitted. Bank will review it shortly."
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.get("/my-deferrals/{loan_id}")
def get_my_deferrals(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Get deferral requests for a specific loan"""
    session = Session()
    deferrals = session.query(DeferralRequest).filter(
        DeferralRequest.loan_id == loan_id,
        DeferralRequest.user_id == current_user["user_id"]
    ).order_by(DeferralRequest.created_at.desc()).all()

    result = [
        {
            "id": d.id,
            "reason": d.reason,
            "requested_months": d.requested_months,
            "status": d.status,
            "analyst_note": d.analyst_note,
            "created_at": str(d.created_at),
            "reviewed_at": str(d.reviewed_at) if d.reviewed_at else None
        }
        for d in deferrals
    ]
    session.close()
    return result


@app.get("/pending-deferrals")
def get_pending_deferrals(current_user: dict = Depends(get_current_user)):
    """For analysts — list all pending deferral requests"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can view this"}

    session = Session()
    deferrals = session.query(DeferralRequest).filter(
        DeferralRequest.status == "pending"
    ).order_by(DeferralRequest.created_at.desc()).all()

    result = []
    for d in deferrals:
        user = session.query(User).filter(User.id == d.user_id).first()
        loan = session.query(Loan).filter(Loan.id == d.loan_id).first()
        result.append({
            "id": d.id,
            "loan_id": d.loan_id,
            "borrower_name": user.name if user else "Unknown",
            "borrower_email": user.email if user else "",
            "purpose": loan.purpose if loan else "",
            "loan_amnt": loan.loan_amnt if loan else 0,
            "installment": loan.installment if loan else 0,
            "reason": d.reason,
            "requested_months": d.requested_months,
            "created_at": str(d.created_at)
        })
    session.close()
    return result


@app.post("/review-deferral/{deferral_id}")
def review_deferral(deferral_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Analyst approves or rejects a deferral request"""
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can review deferrals"}

    decision = data.get("decision")  # "approve" or "reject"
    note = data.get("note", "")

    if decision not in ["approve", "reject"]:
        return {"error": "Decision must be 'approve' or 'reject'"}

    session = Session()
    try:
        deferral = session.query(DeferralRequest).filter(
            DeferralRequest.id == deferral_id
        ).first()
        if not deferral:
            session.close()
            return {"error": "Deferral request not found"}
        if deferral.status != "pending":
            session.close()
            return {"error": f"Deferral already {deferral.status}"}

        deferral.status = "approved" if decision == "approve" else "rejected"
        deferral.analyst_note = note
        deferral.reviewed_by = current_user["user_id"]
        deferral.reviewed_at = datetime.utcnow()
        session.commit()
        session.close()

        return {"success": True, "message": f"Deferral {deferral.status}"}
    except Exception as e:
        session.close()
        return {"error": str(e)}