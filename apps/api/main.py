from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
import os
from dotenv import load_dotenv
load_dotenv()
from datetime import datetime
import httpx
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey, Boolean, func, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from pymongo import MongoClient
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # so 'auth' & 'email_service' import works whether we run from monorepo root or apps/api/
from auth import hash_password, verify_password, create_access_token, get_current_user
from email_service import (
    send_email,
    loan_approved_email,
    loan_rejected_email,
    loan_disbursed_email,
    payment_success_email,
    deferral_decision_email
)
import razorpay
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.units import mm
from fastapi.responses import StreamingResponse
import io
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
    gender = Column(String, nullable=True)  # male, female, other
    date_of_birth = Column(String, nullable=True)  # YYYY-MM-DD
    pan_number = Column(String, nullable=True)
    employment_type = Column(String, nullable=True)  # salaried, self_employed, business_owner, retired
    created_at = Column(DateTime, default=datetime.utcnow)


class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    loan_amnt = Column(Float)
    term = Column(Integer)
    int_rate = Column(Float)  # proposed rate
    final_int_rate = Column(Float, nullable=True)  # analyst-adjusted (for business loans)
    installment = Column(Float)
    grade = Column(Integer)
    annual_inc = Column(Float)
    dti = Column(Float)
    cibil_score = Column(Integer)  # 300-900 (Indian credit bureau)
    fico_avg = Column(Integer)  # kept for ML model compat (we'll convert internally)
    emp_length = Column(Integer)
    purpose = Column(String, default="personal")
    collateral_type = Column(String, nullable=True)  # property, gold, fd, vehicle, none
    collateral_value = Column(Float, nullable=True)
    collateral_description = Column(String, nullable=True)
    emi_adjustment = Column(Float, default=0)
    carryover_balance = Column(Float, default=0)
    grace_days = Column(Integer, default=5)
    emi_due_day = Column(Integer, nullable=True)
    risk_score = Column(Float, default=0)
    risk_level = Column(String, default="UNKNOWN")
    status = Column(String, default="pending")
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
    payment_type = Column(String, default="full")  # full, partial, penalty
    expected_emi = Column(Float, nullable=True)  # what was expected
    late_fee = Column(Float, default=0)  # penalty included if late
    days_late = Column(Integer, default=0)
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    status = Column(String, default="created")
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

class EMISchedule(Base):
    __tablename__ = "emi_schedule"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    due_date = Column(DateTime)
    emi_number = Column(Integer)  # 1st EMI, 2nd EMI, etc.
    expected_amount = Column(Float)
    paid_amount = Column(Float, default=0)
    status = Column(String, default="pending")  # pending, paid, partial, overdue
    late_fee = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(String)
    type = Column(String, default="info")  # info, success, warning, payment, approval
    is_read = Column(Boolean, default=False)
    link = Column(String, nullable=True)  # optional link to a loan, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

class DeferralRequest(Base):
    __tablename__ = "deferral_requests"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    reason = Column(String)
    requested_months = Column(Integer, default=1)
    status = Column(String, default="pending")
    analyst_note = Column(String, nullable=True)
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
class TicketMessage(Base):
    __tablename__ = "ticket_messages"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    sender_role = Column(String, default="borrower")  # borrower or analyst
    message = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class EMIDateChangeRequest(Base):
    __tablename__ = "emi_date_change_requests"
    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    current_due_day = Column(Integer)
    requested_due_day = Column(Integer)
    reason = Column(String)
    status = Column(String, default="pending")  # pending, approved, rejected
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    decision_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LedgerEntry(Base):
    """Immutable double-entry ledger for all money movements. Phase 8."""
    __tablename__ = "ledger_entries"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)
    entry_type = Column(String(20), nullable=False)  # "emi_payment", "late_fee", "restructure", "deferral_credit", "reversal"
    amount = Column(Float, nullable=False)
    principal_component = Column(Float, default=0)
    interest_component = Column(Float, default=0)
    fee_component = Column(Float, default=0)
    carryover_component = Column(Float, default=0)
    balance_before = Column(Float, nullable=True)
    balance_after = Column(Float, nullable=True)
    reference = Column(String(100), nullable=True)  # razorpay payment_id or other external ref
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class Event(Base):
    """Behavioral event log — every meaningful user action. Powers analytics + ML monitoring."""
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    event_type = Column(String(50), nullable=False, index=True)
    event_category = Column(String(30), index=True)
    loan_id = Column(Integer, nullable=True)
    event_metadata = Column("metadata", JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject = Column(String, nullable=False)
    message = Column(String, nullable=False)
    category = Column(String, default="general")  # general, payment, technical, account, complaint
    priority = Column(String, default="normal")  # low, normal, high, urgent
    status = Column(String, default="open")  # open, in_progress, resolved, closed
    response = Column(String, nullable=True)  # analyst's reply
    responded_by = Column(Integer, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
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

@app.post("/chat-support")
def chat_support(data: dict, current_user: dict = Depends(get_current_user)):
    """AI chatbot for borrower questions about LoanSense"""
    if not OPENROUTER_API_KEY:
        return {"error": "AI not configured"}

    user_message = (data.get("message") or "").strip()
    if not user_message:
        return {"error": "Empty message"}
    if len(user_message) > 500:
        return {"error": "Message too long (500 chars max)"}

    history = data.get("history", [])  # [{role, content}, ...]

    # Pull a bit of user context so answers can reference their loans
    session = Session()
    try:
        user = session.query(User).filter(User.id == current_user["user_id"]).first()
        my_loans = session.query(Loan).filter(Loan.user_id == current_user["user_id"]).all()
        loan_summary = []
        for l in my_loans:
            loan_summary.append(
                f"- Loan #{l.id}: {l.purpose}, INR {l.loan_amnt:,.0f}, "
                f"{l.term} months at {l.int_rate}%, status: {l.status}, EMI INR {l.installment:,.0f}"
            )
        loans_text = "\n".join(loan_summary) if loan_summary else "No loans yet."
        user_name = user.name if user else "the user"
    finally:
        session.close()

    system_prompt = f"""You are the LoanSense Support Assistant — a helpful, concise AI for an Indian lending platform.

You're talking to {user_name}. Their current loans:
{loans_text}

Your job:
- Answer questions about LoanSense features: loan applications, CIBIL-based rates, partial EMI, carry-over re-amortization, late fees (₹500 + 2%/week capped at 10% EMI), deferrals (1-6 months), FOAIR-based affordability, gender/senior concessions, gold/home/car/business/medical/personal/education loans.
- If asked about their specific loan, use the loan summary above.
- Keep answers under 100 words. Be friendly but direct. Use Indian rupees (INR) and Indian banking terminology.
- If the question is outside LoanSense (general finance, other banks, weather, etc.), politely redirect: "I can only help with LoanSense — for that you'd need to check elsewhere."
- If the user seems distressed about repayments, gently suggest the deferral option or the smart partial payment flow.
- Never recommend competitors. Never give legal or tax advice. If asked, suggest they consult a CA or lawyer.
- Always be honest — if you don't know, say so."""

    messages = [{"role": "system", "content": system_prompt}]
    # Keep last 6 history turns to stay within context limits
    for h in history[-6:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"][:500]})
    messages.append({"role": "user", "content": user_message})

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openrouter/free",
                    "messages": messages,
                    "max_tokens": 400,
                    "temperature": 0.4
                }
            )
            if resp.status_code != 200:
                return {"error": "AI service unavailable"}
            result = resp.json()
            reply = result["choices"][0]["message"]["content"].strip()
            return {"reply": reply}
    except Exception as e:
        return {"error": "Could not reach AI service"}
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
        uid_ev, role_ev = user.id, user.role
        session.close()
        log_event(user_id=uid_ev, event_type="login", event_category="auth", metadata={"role": role_ev})
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
            "created_at": str(l.created_at),
            "emi_due_day": l.emi_due_day,
            "grace_days": l.grace_days or 5,
            "carryover_balance": l.carryover_balance or 0,
            "emi_adjustment": l.emi_adjustment or 0
        }
        for l in loans
    ]
    session.close()
    return result


# Indian bank interest rates (based on HDFC/SBI/ICICI 2025-26 rates)
# base_rate = what an average borrower with 700+ CIBIL gets
# CIBIL-based slabs adjust this
LOAN_TYPES = {
    "personal": {
        "min": 10000, "max": 5000000, "max_tenure": 84, "risk_multiplier": 1.0,
        "base_rate": 13.5, "rate_type": "fixed",
        "description": "Quick funds for any personal need",
        "collateral_required": False
    },
    "home": {
        "min": 500000, "max": 150000000, "max_tenure": 360, "risk_multiplier": 0.7,
        "base_rate": 9.0, "rate_type": "fixed",
        "description": "Buy, build, or renovate your home",
        "collateral_required": True,
        "collateral_type": "property"
    },
    "car": {
        "min": 100000, "max": 20000000, "max_tenure": 96, "risk_multiplier": 0.85,
        "base_rate": 10.5, "rate_type": "fixed",
        "description": "New or used vehicle",
        "collateral_required": True,
        "collateral_type": "vehicle"
    },
    "education": {
        "min": 50000, "max": 20000000, "max_tenure": 180, "risk_multiplier": 0.9,
        "base_rate": 10.0, "rate_type": "negotiable",
        "description": "Indian or foreign education",
        "collateral_required": False
    },
    "business": {
        "min": 100000, "max": 100000000, "max_tenure": 120, "risk_multiplier": 1.2,
        "base_rate": 15.0, "rate_type": "negotiable",
        "description": "Working capital or expansion",
        "collateral_required": True,
        "collateral_type": "property_or_gold"
    },
    "medical": {
        "min": 25000, "max": 10000000, "max_tenure": 72, "risk_multiplier": 0.95,
        "base_rate": 12.5, "rate_type": "fixed",
        "description": "Healthcare emergencies",
        "collateral_required": False
    },
    "gold": {
        "min": 10000, "max": 5000000, "max_tenure": 36, "risk_multiplier": 0.6,
        "base_rate": 9.5, "rate_type": "fixed",
        "description": "Loan against your gold jewelry/coins",
        "collateral_required": True,
        "collateral_type": "gold"
    },
}


def calculate_interest_rate(purpose: str, cibil_score: int, gender: str = None,
                             age: int = None, has_collateral: bool = False) -> dict:
    """
    Calculate interest rate based on Indian banking norms:
    - CIBIL score slabs
    - Women concession (0.05%)
    - Senior citizen concession (0.25% for 60+)
    - Collateral discount (0.50% for secured loans with property/gold)
    """
    cfg = LOAN_TYPES.get(purpose, LOAN_TYPES["personal"])
    base = cfg["base_rate"]
    breakdown = {"base_rate": base, "adjustments": []}

    # CIBIL slab adjustment
    if cibil_score >= 800:
        cibil_adj = -0.50
        breakdown["adjustments"].append({"factor": "Excellent CIBIL (800+)", "value": -0.50})
    elif cibil_score >= 750:
        cibil_adj = -0.25
        breakdown["adjustments"].append({"factor": "Very Good CIBIL (750-799)", "value": -0.25})
    elif cibil_score >= 700:
        cibil_adj = 0
        breakdown["adjustments"].append({"factor": "Good CIBIL (700-749)", "value": 0})
    elif cibil_score >= 650:
        cibil_adj = 1.0
        breakdown["adjustments"].append({"factor": "Fair CIBIL (650-699)", "value": +1.0})
    elif cibil_score >= 600:
        cibil_adj = 2.5
        breakdown["adjustments"].append({"factor": "Below Average CIBIL (600-649)", "value": +2.5})
    else:
        cibil_adj = 4.0
        breakdown["adjustments"].append({"factor": "Poor CIBIL (<600)", "value": +4.0})

    final_rate = base + cibil_adj

    # Women concession (HDFC, SBI, ICICI all offer this on home/car loans)
    if gender and gender.lower() == "female" and purpose in ["home", "car"]:
        final_rate -= 0.05
        breakdown["adjustments"].append({"factor": "Women borrower concession", "value": -0.05})

    # Senior citizen concession (60+)
    if age and age >= 60:
        final_rate -= 0.25
        breakdown["adjustments"].append({"factor": "Senior citizen concession (60+)", "value": -0.25})

    # Collateral discount for secured loans
    if has_collateral and purpose == "business":
        final_rate -= 0.50
        breakdown["adjustments"].append({"factor": "Collateral provided", "value": -0.50})

    # Floor: rates can't go below regulatory minimums
    final_rate = max(final_rate, 7.0)

    breakdown["final_rate"] = round(final_rate, 2)
    breakdown["rate_type"] = cfg["rate_type"]

    return breakdown


@app.post("/calculate-rate")
def calculate_rate_preview(data: dict, current_user: dict = Depends(get_current_user)):
    """Preview the interest rate before submitting application"""
    purpose = data.get("purpose", "personal")
    cibil_score = int(data.get("cibil_score", 700))
    has_collateral = bool(data.get("has_collateral", False))

    # Get user's gender and age from profile
    session = Session()
    user = session.query(User).filter(User.id == current_user["user_id"]).first()
    gender = user.gender if user else None
    age = None
    if user and user.date_of_birth:
        try:
            dob = datetime.strptime(user.date_of_birth, "%Y-%m-%d")
            age = (datetime.now() - dob).days // 365
        except Exception:
            pass
    session.close()

    breakdown = calculate_interest_rate(purpose, cibil_score, gender, age, has_collateral)
    return breakdown

# ============== AI AFFORDABILITY COACH ==============

@app.post("/affordability-check")
def affordability_check(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Calculate how much EMI the borrower can safely afford based on FOAIR norms.
    Optionally checks if a planned loan is within safe limits.
    """
    annual_income = float(data.get("annual_income", 0))
    monthly_essentials = float(data.get("monthly_essentials", 0))  # rent, food, utilities
    existing_emis = float(data.get("existing_emis", 0))
    dependents = int(data.get("dependents", 0))

    # Optional — for checking a specific loan
    planned_loan_amount = float(data.get("planned_loan_amount", 0))
    planned_tenure = int(data.get("planned_tenure", 0))
    planned_rate = float(data.get("planned_rate", 0))

    if annual_income <= 0:
        return {"error": "Annual income is required"}

    monthly_income = annual_income / 12

    # Total essential outgoings
    total_essentials = monthly_essentials + existing_emis
    # Add ₹3000/dependent as estimated additional essential
    total_essentials += dependents * 3000

    free_income = max(0, monthly_income - total_essentials)

    # FOAIR norms (RBI / Indian bank guidelines):
    # - Total EMI obligations <= 40% of monthly income (safe)
    # - 40-50% = caution zone
    # - >50% = high risk / banks usually decline
    max_total_emi = monthly_income * 0.50  # absolute ceiling
    safe_total_emi = monthly_income * 0.40  # safe zone
    caution_total_emi = monthly_income * 0.45  # caution zone

    # What's available for NEW EMI (subtracting existing EMIs)
    safe_new_emi = max(0, safe_total_emi - existing_emis)
    caution_new_emi = max(0, caution_total_emi - existing_emis)
    max_new_emi = max(0, max_total_emi - existing_emis)

    # Build advice
    advice = {
        "monthly_income": round(monthly_income, 2),
        "free_income": round(free_income, 2),
        "total_essentials": round(total_essentials, 2),
        "existing_emis": round(existing_emis, 2),
        "current_foair_pct": round((existing_emis / monthly_income) * 100, 1) if monthly_income > 0 else 0,
        "safe_new_emi": round(safe_new_emi, 2),
        "caution_new_emi": round(caution_new_emi, 2),
        "max_new_emi": round(max_new_emi, 2),
        "safe_zone_label": "✅ Safe",
        "caution_zone_label": "⚠ Caution",
        "danger_zone_label": "🚫 Risky",
    }

    # If a specific loan is being checked, evaluate it
    if planned_loan_amount > 0 and planned_tenure > 0 and planned_rate > 0:
        r = planned_rate / 100 / 12
        n = planned_tenure
        planned_emi = (planned_loan_amount * r * (1 + r) ** n) / ((1 + r) ** n - 1) if r > 0 else planned_loan_amount / n
        planned_emi = round(planned_emi, 2)
        new_total_emi = existing_emis + planned_emi
        new_foair_pct = (new_total_emi / monthly_income) * 100 if monthly_income > 0 else 100

        if planned_emi <= safe_new_emi:
            verdict = "safe"
            verdict_title = "✅ This loan is safe for you"
            verdict_msg = f"At ₹{planned_emi:,.0f}/month, you'll comfortably manage this loan along with your other commitments."
        elif planned_emi <= caution_new_emi:
            verdict = "caution"
            verdict_title = "⚠ Manageable but tight"
            verdict_msg = f"At ₹{planned_emi:,.0f}/month, you'll be at {new_foair_pct:.0f}% of your income. Most banks consider this borderline — proceed only if your income is stable."
        elif planned_emi <= max_new_emi:
            verdict = "risky"
            verdict_title = "🚨 High risk — reconsider"
            verdict_msg = f"At ₹{planned_emi:,.0f}/month, you'd use {new_foair_pct:.0f}% of your income for EMIs. This leaves very little for emergencies. Consider a smaller loan."
        else:
            verdict = "unaffordable"
            verdict_title = "🛑 Beyond safe limits"
            verdict_msg = f"This loan's EMI (₹{planned_emi:,.0f}) exceeds {new_foair_pct:.0f}% of your monthly income. Banks rarely approve this, and even if approved, defaults become very likely."

        # Suggest a safer alternative
        safer_loan_amount = 0
        if safe_new_emi > 0 and r > 0:
            safer_loan_amount = (safe_new_emi * ((1 + r) ** n - 1)) / (r * (1 + r) ** n)
            safer_loan_amount = round(safer_loan_amount, -3)  # round to nearest ₹1000

        advice["planned_check"] = {
            "planned_emi": planned_emi,
            "new_total_emi": round(new_total_emi, 2),
            "new_foair_pct": round(new_foair_pct, 1),
            "verdict": verdict,
            "verdict_title": verdict_title,
            "verdict_msg": verdict_msg,
            "safer_loan_amount": safer_loan_amount,
            "safer_emi": round(safe_new_emi, 2)
        }

    log_event(
        user_id=current_user["user_id"],
        event_type="affordability_check",
        event_category="research",
        metadata={
            "annual_income": annual_income,
            "monthly_essentials": monthly_essentials,
            "existing_emis": existing_emis,
            "dependents": dependents,
            "checked_specific_loan": bool(planned_loan_amount > 0 and planned_tenure > 0 and planned_rate > 0),
            "planned_loan_amount": planned_loan_amount,
            "verdict": advice.get("planned_check", {}).get("verdict"),
        },
    )
    return advice

@app.get("/loan-types")
def get_loan_types():
    return LOAN_TYPES


@app.post("/apply-loan")
def apply_loan(data: dict, current_user: dict = Depends(get_current_user)):
    """Borrower submits loan application — interest rate is auto-calculated"""
    try:
        purpose = data.get("purpose", "personal")
        if purpose not in LOAN_TYPES:
            return {"error": "Invalid loan purpose"}

        loan_amnt = float(data.get("loan_amnt", 0))
        term = int(data.get("term", 36))
        cibil_score = int(data.get("cibil_score", 700))

        cfg = LOAN_TYPES[purpose]
        if loan_amnt < cfg["min"] or loan_amnt > cfg["max"]:
            return {"error": f"Loan amount for {purpose} loans must be between ₹{cfg['min']:,} and ₹{cfg['max']:,}"}
        if term > cfg["max_tenure"]:
            return {"error": f"Maximum tenure for {purpose} loans is {cfg['max_tenure']} months"}

        # Collateral info
        collateral_type = data.get("collateral_type", None)
        collateral_value = float(data.get("collateral_value", 0)) if data.get("collateral_value") else None
        collateral_description = data.get("collateral_description", None)
        has_collateral = collateral_type and collateral_type != "none"

        if cfg["collateral_required"] and not has_collateral:
            return {"error": f"{purpose.title()} loans require collateral. Please provide details."}

        # Get user profile for rate calculation
        session = Session()
        user = session.query(User).filter(User.id == current_user["user_id"]).first()
        gender = user.gender if user else None
        age = None
        if user and user.date_of_birth:
            try:
                dob = datetime.strptime(user.date_of_birth, "%Y-%m-%d")
                age = (datetime.now() - dob).days // 365
            except Exception:
                pass

        # AUTO-CALCULATE interest rate (no manual input!)
        rate_breakdown = calculate_interest_rate(purpose, cibil_score, gender, age, has_collateral)
        int_rate = rate_breakdown["final_rate"]

        # Calculate EMI
        r = int_rate / 100 / 12
        n = term
        emi = (loan_amnt * r * (1 + r) ** n) / ((1 + r) ** n - 1) if r > 0 else loan_amnt / n

        # Run ML risk prediction
        loan_features = {
            "loan_amnt": loan_amnt,
            "term": term,
            "int_rate": int_rate,
            "installment": emi,
            "grade": int(data.get("grade", 3)),
            "emp_length": int(data.get("emp_length", 1)),
            "annual_inc": float(data.get("annual_inc", 50000)),
            "dti": float(data.get("dti", 15)),
            "fico_range_low": cibil_score - 2,
            "fico_range_high": cibil_score + 2,
            "fico_avg": cibil_score,
        }

        df = pd.DataFrame([loan_features])
        for col in feature_names:
            if col not in df.columns:
                df[col] = 0
        df = df[feature_names]
        base_risk = float(model.predict_proba(df)[:, 1][0])

        adjusted_risk = min(base_risk * cfg["risk_multiplier"], 1.0)
        # Collateral reduces effective risk
        if has_collateral:
            adjusted_risk *= 0.8
        risk_level = "HIGH" if adjusted_risk >= 0.6 else "MEDIUM" if adjusted_risk >= 0.3 else "LOW"

        loan = Loan(
            user_id=current_user["user_id"],
            loan_amnt=loan_amnt,
            term=term,
            int_rate=int_rate,
            installment=round(emi, 2),
            grade=loan_features["grade"],
            annual_inc=loan_features["annual_inc"],
            dti=loan_features["dti"],
            cibil_score=cibil_score,
            fico_avg=cibil_score,  # for ML compat
            emp_length=loan_features["emp_length"],
            purpose=purpose,
            collateral_type=collateral_type if has_collateral else None,
            collateral_value=collateral_value if has_collateral else None,
            collateral_description=collateral_description if has_collateral else None,
            risk_score=adjusted_risk,
            risk_level=risk_level,
            status="pending"
        )
        session.add(loan)
        session.commit()
        session.refresh(loan)
        loan_id = loan.id

        log_event(
            user_id=current_user["user_id"],
            event_type="loan_application_submitted",
            event_category="loan",
            loan_id=loan_id,
            metadata={
                "purpose": purpose,
                "loan_amnt": loan_amnt,
                "term": term,
                "cibil_score": cibil_score,
                "int_rate": int_rate,
                "risk_score": round(adjusted_risk, 4),
                "risk_level": risk_level,
                "has_collateral": bool(has_collateral),
            },
        )

        # Notify all analysts about the new application
        borrower_name = user.name if user else "A borrower"
        notify_all_analysts(
            session,
            "📋 New loan application",
            f"{borrower_name} applied for a ₹{loan_amnt:,.0f} {purpose} loan (CIBIL {cibil_score})",
            "info",
            "/dashboard"
        )
        session.close()

        return {
            "success": True,
            "loan_id": loan_id,
            "purpose": purpose,
            "int_rate": int_rate,
            "rate_breakdown": rate_breakdown,
            "risk_score": round(adjusted_risk, 4),
            "risk_level": risk_level,
            "installment": round(emi, 2),
            "status": "pending",
            "message": "Application submitted! Awaiting bank approval." if cfg["rate_type"] == "fixed"
                       else "Application submitted! Final rate will be confirmed after bank review."
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/pending-applications")
def get_pending_applications(current_user: dict = Depends(get_current_user)):
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

# ============== ANALYST DASHBOARD CHARTS ==============

@app.get("/analyst/dashboard-stats")
def analyst_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Aggregated stats for analyst charts"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    session = Session()
    try:
        from sqlalchemy import func
        from collections import defaultdict

        # 1. Loans by purpose (active only) — for donut
        active_loans = session.query(Loan).filter(Loan.status == "active").all()
        by_purpose = defaultdict(lambda: {"count": 0, "total_amount": 0})
        for l in active_loans:
            by_purpose[l.purpose]["count"] += 1
            by_purpose[l.purpose]["total_amount"] += l.loan_amnt

        # 2. Risk distribution (active only) — for bar
        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        for l in active_loans:
            level = l.risk_level if l.risk_level in risk_counts else "MEDIUM"
            risk_counts[level] += 1

        # 3. Disbursement over time (last 6 months) — for line
        from datetime import timedelta
        today = datetime.utcnow()
        monthly = defaultdict(lambda: {"count": 0, "amount": 0})
        # Initialize last 6 months with zero so the chart shows continuity
        for i in range(5, -1, -1):
            month_dt = today - timedelta(days=30 * i)
            key = month_dt.strftime("%b %Y")
            monthly[key]  # touch to create
        # Now fill from disbursed loans
        disbursed = session.query(Loan).filter(
            Loan.reviewed_at.isnot(None),
            Loan.status.in_(["active", "paid"])
        ).all()
        cutoff = today - timedelta(days=180)
        for l in disbursed:
            if l.reviewed_at and l.reviewed_at >= cutoff:
                key = l.reviewed_at.strftime("%b %Y")
                monthly[key]["count"] += 1
                monthly[key]["amount"] += l.loan_amnt

        # 4. Quick totals
        total_disbursed = sum(l.loan_amnt for l in active_loans)
        pending_count = session.query(Loan).filter(Loan.status == "pending").count()
        deferral_count = session.query(DeferralRequest).filter(
            DeferralRequest.status == "pending"
        ).count()

        # Total interest income (sum of paid payments minus principal portion — simplified)
        total_collected = session.query(func.sum(Payment.amount)).filter(
            Payment.status == "paid"
        ).scalar() or 0

        session.close()

        return {
            "by_purpose": [
                {"purpose": k, "count": v["count"], "total_amount": v["total_amount"]}
                for k, v in by_purpose.items()
            ],
            "risk_distribution": risk_counts,
            "monthly_disbursement": [
                {"month": k, "count": v["count"], "amount": v["amount"]}
                for k, v in monthly.items()
            ],
            "totals": {
                "active_loans": len(active_loans),
                "total_disbursed": round(total_disbursed, 2),
                "pending_applications": pending_count,
                "pending_deferrals": deferral_count,
                "total_collected": round(total_collected, 2)
            }
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}

@app.get("/analyst/customers")
def analyst_list_customers(current_user: dict = Depends(get_current_user)):
    """List all borrowers with summary stats. Analyst-only."""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}
    session = Session()
    try:
        from collections import defaultdict
        borrowers = session.query(User).filter(User.role == "borrower").all()
        all_loans = session.query(Loan).all()

        loans_by_user = defaultdict(list)
        for l in all_loans:
            loans_by_user[l.user_id].append(l)

        RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        result = []
        for u in borrowers:
            uloans = loans_by_user.get(u.id, [])
            active = [l for l in uloans if l.status == "active"]
            total_exposure = sum(l.loan_amnt for l in active)
            # Highest risk among active loans
            top_risk = "LOW"
            for l in active:
                lvl = l.risk_level if l.risk_level in RISK_ORDER else "MEDIUM"
                if RISK_ORDER[lvl] > RISK_ORDER[top_risk]:
                    top_risk = lvl
            avg_risk = round(sum(l.risk_score or 0 for l in active) / len(active), 3) if active else 0
            result.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "employment_type": u.employment_type,
                "member_since": str(u.created_at) if u.created_at else None,
                "total_loans": len(uloans),
                "active_loans": len(active),
                "total_exposure": round(total_exposure, 2),
                "top_risk": top_risk if active else "—",
                "avg_risk_score": avg_risk,
            })

        # Sort: highest exposure first
        result.sort(key=lambda x: -x["total_exposure"])
        session.close()
        return {"customers": result, "count": len(result)}
    except Exception as e:
        session.close()
        return {"error": str(e)}
    
@app.get("/analyst/customer/{customer_id}")
def analyst_customer_detail(customer_id: int, current_user: dict = Depends(get_current_user)):
    """Full profile of one customer: info, loans, payments, tickets. Analyst-only."""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}
    session = Session()
    try:
        u = session.query(User).filter(User.id == customer_id, User.role == "borrower").first()
        if not u:
            session.close()
            return {"error": "Customer not found"}

        # Age from DOB
        age = None
        if u.date_of_birth:
            try:
                dob = datetime.strptime(u.date_of_birth, "%Y-%m-%d")
                age = (datetime.now() - dob).days // 365
            except Exception:
                pass

        loans = session.query(Loan).filter(Loan.user_id == customer_id).all()
        loans_out = [{
            "id": l.id,
            "purpose": l.purpose,
            "loan_amnt": l.loan_amnt,
            "term": l.term,
            "int_rate": l.int_rate,
            "installment": l.installment,
            "status": l.status,
            "risk_level": l.risk_level,
            "risk_score": round(l.risk_score, 3) if l.risk_score else 0,
            "cibil_score": l.cibil_score,
            "carryover_balance": l.carryover_balance or 0,
            "created_at": str(l.created_at) if l.created_at else None,
        } for l in loans]

        # Payment behavior from payments table
        payments = session.query(Payment).filter(Payment.user_id == customer_id).all()
        paid = [p for p in payments if p.status == "paid"]
        partial_count = sum(1 for p in paid if p.payment_type == "partial")
        total_paid = sum(p.amount for p in paid)

        # Support tickets
        tickets = session.query(SupportTicket).filter(SupportTicket.user_id == customer_id).order_by(SupportTicket.created_at.desc()).all()
        tickets_out = []
        for t in tickets:
            msgs = session.query(TicketMessage).filter(
                TicketMessage.ticket_id == t.id
            ).order_by(TicketMessage.created_at.asc()).all()
            thread = [{
                "id": m.id,
                "sender_role": m.sender_role,
                "message": m.message,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            } for m in msgs]
            tickets_out.append({
                "id": t.id,
                "subject": t.subject,
                "status": t.status,
                "thread": thread,
                "created_at": str(t.created_at) if t.created_at else None,
            })

        active = [l for l in loans if l.status == "active"]
        total_exposure = sum(l.loan_amnt for l in active)

        session.close()
        return {
            "customer": {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "gender": u.gender,
                "age": age,
                "pan_number": u.pan_number,
                "employment_type": u.employment_type,
                "member_since": str(u.created_at) if u.created_at else None,
            },
            "summary": {
                "total_loans": len(loans),
                "active_loans": len(active),
                "total_exposure": round(total_exposure, 2),
                "total_paid": round(total_paid, 2),
                "partial_payments": partial_count,
                "total_payments": len(paid),
            },
            "loans": loans_out,
            "tickets": tickets_out,
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}

@app.get("/analyst/customer/{customer_id}/ai-analysis")
async def analyst_customer_ai_analysis(customer_id: int, current_user: dict = Depends(get_current_user)):
    """AI-generated risk assessment for one customer, using their real data."""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}
    if not OPENROUTER_API_KEY:
        return {"error": "OpenRouter API key not configured"}

    session = Session()
    try:
        u = session.query(User).filter(User.id == customer_id, User.role == "borrower").first()
        if not u:
            session.close()
            return {"error": "Customer not found"}

        loans = session.query(Loan).filter(Loan.user_id == customer_id).all()
        payments = session.query(Payment).filter(Payment.user_id == customer_id).all()
        paid = [p for p in payments if p.status == "paid"]
        partial_count = sum(1 for p in paid if p.payment_type == "partial")

        active = [l for l in loans if l.status == "active"]
        total_exposure = sum(l.loan_amnt for l in active)
        total_carryover = sum((l.carryover_balance or 0) for l in active)
        avg_risk = (sum(l.risk_score or 0 for l in active) / len(active)) if active else 0

        # Build a compact loan summary for the prompt
        loan_lines = []
        for l in loans:
            co = f", carryover ₹{l.carryover_balance:,.0f}" if (l.carryover_balance or 0) > 0 else ""
            loan_lines.append(f"- {l.purpose} loan #{l.id}: ₹{l.loan_amnt:,.0f}, {l.risk_level} risk, EMI ₹{l.installment:,.0f}{co}")
        loans_text = "\n".join(loan_lines)

        name = u.name
        session.close()

        prompt = f"""You are a senior credit risk analyst at an Indian NBFC. Write a concise risk assessment of this customer in 3 short paragraphs.

Customer: {name}
Active loans: {len(active)} (of {len(loans)} total)
Total exposure: ₹{total_exposure:,.0f}
Average risk score: {avg_risk:.0%}
Total carryover (unpaid backlog): ₹{total_carryover:,.0f}
Payment behaviour: {partial_count} partial payments out of {len(paid)} total payments

Loan portfolio:
{loans_text}

Write:
1. An overall risk verdict (1-2 sentences).
2. Key observations about their payment behaviour and exposure concentration.
3. Two specific recommended actions for the analyst.

Keep it under 180 words, professional, plain prose. No markdown headers, no bullet symbols."""

        async with httpx.AsyncClient(timeout=40.0) as client:
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
            content = result["choices"][0]["message"]["content"].strip()
            return {"customer_id": customer_id, "analysis": content}
    except Exception as e:
        try:
            session.close()
        except Exception:
            pass
        return {"error": str(e)}

@app.get("/analyst/model-monitoring")
def analyst_model_monitoring(current_user: dict = Depends(get_current_user)):
    """ML model health metrics: validation performance, prediction distribution, score-vs-behavior. Analyst-only."""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}
    session = Session()
    try:
        import numpy as np
        import json as _json
        from collections import defaultdict

        result = {}

        # --- 1. Model info from ensemble config ---
        try:
            with open(os.path.join(BASE_DIR, "models/ensemble_config.json")) as fcfg:
                cfg = _json.load(fcfg)
        except Exception:
            cfg = {}
        result["model_info"] = {
            "type": "Ensemble (XGBoost + LSTM + DeepSurv)",
            "xgb_auc": cfg.get("xgb_auc"),
            "lstm_auc": cfg.get("lstm_auc"),
            "ensemble_auc": cfg.get("ensemble_auc"),
            "xgb_weight": cfg.get("xgb_weight"),
            "lstm_weight": cfg.get("lstm_weight"),
            "feature_count": len(feature_names),
        }

        # --- 2. Validation metrics from saved test predictions + ground truth ---
        try:
            xgb_preds = np.load(os.path.join(BASE_DIR, "models/xgb_preds.npy"))
            y_test = np.load(os.path.join(BASE_DIR, "models/y_test.npy"))
            # Align lengths defensively
            n = min(len(xgb_preds), len(y_test))
            xgb_preds = xgb_preds[:n].astype(float).ravel()
            y_test = y_test[:n].astype(int).ravel()

            preds_binary = (xgb_preds >= 0.5).astype(int)
            tp = int(np.sum((preds_binary == 1) & (y_test == 1)))
            tn = int(np.sum((preds_binary == 0) & (y_test == 0)))
            fp = int(np.sum((preds_binary == 1) & (y_test == 0)))
            fn = int(np.sum((preds_binary == 0) & (y_test == 1)))
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
            accuracy = (tp + tn) / n if n > 0 else 0

            # AUC via sklearn if available
            try:
                from sklearn.metrics import roc_auc_score
                auc = float(roc_auc_score(y_test, xgb_preds))
            except Exception:
                auc = cfg.get("xgb_auc", 0)

            result["validation"] = {
                "test_size": n,
                "auc": round(auc, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "accuracy": round(accuracy, 4),
                "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
                "default_rate_test": round(float(np.mean(y_test)), 4),
            }
        except Exception as e:
            result["validation"] = {"error": f"Could not load test predictions: {e}"}

        # --- 3. Prediction distribution across LIVE loans ---
        loans = session.query(Loan).all()
        scores = [l.risk_score for l in loans if l.risk_score is not None]
        buckets = {"0-20%": 0, "20-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0}
        for s in scores:
            pct = s * 100
            if pct < 20: buckets["0-20%"] += 1
            elif pct < 40: buckets["20-40%"] += 1
            elif pct < 60: buckets["40-60%"] += 1
            elif pct < 80: buckets["60-80%"] += 1
            else: buckets["80-100%"] += 1
        result["prediction_distribution"] = [{"range": k, "count": v} for k, v in buckets.items()]
        result["live_stats"] = {
            "total_predictions": len(scores),
            "mean_risk": round(sum(scores) / len(scores), 4) if scores else 0,
        }

        # --- 4. Score vs. actual behavior (validation on real repayment) ---
        # For each risk band, what fraction of payments were partial? Higher risk should = more partials.
        payments = session.query(Payment).filter(Payment.status == "paid").all()
        loan_by_id = {l.id: l for l in loans}
        band_stats = defaultdict(lambda: {"partial": 0, "total": 0})
        for p in payments:
            loan = loan_by_id.get(p.loan_id)
            if not loan or loan.risk_score is None:
                continue
            band = "HIGH" if loan.risk_score >= 0.6 else "MEDIUM" if loan.risk_score >= 0.3 else "LOW"
            band_stats[band]["total"] += 1
            if p.payment_type == "partial":
                band_stats[band]["partial"] += 1
        result["score_vs_behavior"] = [
            {
                "band": b,
                "partial_rate": round(band_stats[b]["partial"] / band_stats[b]["total"], 3) if band_stats[b]["total"] > 0 else 0,
                "payments": band_stats[b]["total"],
            }
            for b in ["LOW", "MEDIUM", "HIGH"]
        ]

        session.close()
        return result
    except Exception as e:
        session.close()
        return {"error": str(e)}

@app.get("/analyst/portfolio-intelligence")
def analyst_portfolio_intelligence(current_user: dict = Depends(get_current_user)):
    """Real portfolio analytics from loans/payments/ledger. Analyst-only."""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}
    session = Session()
    try:
        from collections import defaultdict
        loans = session.query(Loan).all()
        active = [l for l in loans if l.status == "active"]
        payments = session.query(Payment).all()
        paid = [p for p in payments if p.status == "paid"]

        # 1. Payment health: full vs partial
        full_count = sum(1 for p in paid if (p.payment_type or "full") == "full")
        partial_count = sum(1 for p in paid if p.payment_type == "partial")

        # 2. Collection efficiency
        total_collected = sum(p.amount for p in paid)
        total_expected = sum((p.expected_emi or 0) for p in paid)
        collection_rate = round((total_collected / total_expected * 100), 1) if total_expected > 0 else 0

        # 3. Portfolio backlog (carryover arrears)
        total_backlog = sum((l.carryover_balance or 0) for l in active)
        loans_with_backlog = sum(1 for l in active if (l.carryover_balance or 0) > 0)

        # 4. Exposure concentration — top 5 borrowers
        exposure_by_user = defaultdict(float)
        for l in active:
            exposure_by_user[l.user_id] += l.loan_amnt
        top_user_ids = sorted(exposure_by_user, key=lambda u: -exposure_by_user[u])[:5]
        users = session.query(User).filter(User.id.in_(top_user_ids)).all() if top_user_ids else []
        name_by_id = {u.id: u.name for u in users}
        top_borrowers = [{
            "user_id": uid,
            "name": name_by_id.get(uid, f"User {uid}"),
            "exposure": round(exposure_by_user[uid], 2),
        } for uid in top_user_ids]

        # 5. Risk-weighted exposure (₹ in each risk band)
        risk_exposure = {"LOW": 0.0, "MEDIUM": 0.0, "HIGH": 0.0}
        for l in active:
            lvl = l.risk_level if l.risk_level in risk_exposure else "MEDIUM"
            risk_exposure[lvl] += l.loan_amnt
        risk_exposure = {k: round(v, 2) for k, v in risk_exposure.items()}

        total_exposure = sum(l.loan_amnt for l in active)

        session.close()
        return {
            "payment_health": {"full": full_count, "partial": partial_count, "total": len(paid)},
            "collection": {
                "collected": round(total_collected, 2),
                "expected": round(total_expected, 2),
                "rate": collection_rate,
            },
            "backlog": {
                "total": round(total_backlog, 2),
                "loans_affected": loans_with_backlog,
            },
            "top_borrowers": top_borrowers,
            "risk_exposure": risk_exposure,
            "total_exposure": round(total_exposure, 2),
            "active_loans": len(active),
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}

@app.get("/analyst/event-analytics")
def analyst_event_analytics(current_user: dict = Depends(get_current_user)):
    """Behavioral analytics computed from the events table. Analyst-only."""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}
    session = Session()
    try:
        from collections import defaultdict
        from datetime import timedelta

        all_events = session.query(Event).all()

        # 1. Event volume by type
        by_type = defaultdict(int)
        for e in all_events:
            by_type[e.event_type] += 1

        # 2. Activity over last 14 days (events per day)
        today = datetime.utcnow().date()
        daily = {}
        for i in range(13, -1, -1):
            d = today - timedelta(days=i)
            daily[d.strftime("%d %b")] = 0
        for e in all_events:
            if e.created_at:
                key = e.created_at.date().strftime("%d %b")
                if key in daily:
                    daily[key] += 1

        # 3. Conversion funnel
        funnel = {
            "affordability_checks": by_type.get("affordability_check", 0),
            "applications": by_type.get("loan_application_submitted", 0),
            "payments": by_type.get("payment_succeeded", 0),
        }

        # 4. Distress: deferral requests over last 14 days
        deferral_daily = {}
        for i in range(13, -1, -1):
            d = today - timedelta(days=i)
            deferral_daily[d.strftime("%d %b")] = 0
        for e in all_events:
            if e.event_type == "deferral_requested" and e.created_at:
                key = e.created_at.date().strftime("%d %b")
                if key in deferral_daily:
                    deferral_daily[key] += 1

        # 5. Recent activity stream (latest 20)
        recent = session.query(Event).order_by(Event.created_at.desc()).limit(20).all()
        # Resolve user names
        uids = list({r.user_id for r in recent})
        users = session.query(User).filter(User.id.in_(uids)).all() if uids else []
        name_by_id = {u.id: u.name for u in users}
        recent_stream = [{
            "id": r.id,
            "user_id": r.user_id,
            "user_name": name_by_id.get(r.user_id, f"User {r.user_id}"),
            "event_type": r.event_type,
            "event_category": r.event_category,
            "loan_id": r.loan_id,
            "metadata": r.event_metadata,
            "created_at": str(r.created_at),
        } for r in recent]

        session.close()
        return {
            "event_volume": [{"type": k, "count": v} for k, v in sorted(by_type.items(), key=lambda x: -x[1])],
            "daily_activity": [{"day": k, "count": v} for k, v in daily.items()],
            "funnel": funnel,
            "deferral_trend": [{"day": k, "count": v} for k, v in deferral_daily.items()],
            "recent_activity": recent_stream,
            "total_events": len(all_events),
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}

@app.get("/approved-applications")
def get_approved_applications(current_user: dict = Depends(get_current_user)):
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

    user = session.query(User).filter(User.id == loan.user_id).first()
    if user:
        email = loan_approved_email(user.name, loan.purpose, loan.loan_amnt, loan.installment)
        send_email(user.email, email["subject"], email["html"])
        create_notification(session, user.id, "Loan Approved! 🎉",
            f"Your {loan.purpose} loan of ₹{loan.loan_amnt:,.0f} has been approved.",
            "approval", f"/loan/{loan.id}")

    session.close()
    return {"success": True, "message": "Loan approved", "loan_id": loan_id}


@app.post("/reject-loan/{loan_id}")
def reject_loan(loan_id: int, data: dict, current_user: dict = Depends(get_current_user)):
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

    user = session.query(User).filter(User.id == loan.user_id).first()
    if user:
        email = loan_rejected_email(user.name, loan.purpose, loan.loan_amnt, reason)
        send_email(user.email, email["subject"], email["html"])
        create_notification(session, user.id, "Loan Application Update",
            f"Your {loan.purpose} loan application was not approved this time.",
            "warning", f"/loan/{loan.id}")

    session.close()
    return {"success": True, "message": "Loan rejected", "loan_id": loan_id}


@app.post("/disburse-loan/{loan_id}")
def disburse_loan(loan_id: int, current_user: dict = Depends(get_current_user)):
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

    user = session.query(User).filter(User.id == loan.user_id).first()
    if user:
        email = loan_disbursed_email(user.name, loan.purpose, loan.loan_amnt, loan.installment)
        send_email(user.email, email["subject"], email["html"])
        create_notification(session, user.id, "Funds Disbursed 💰",
            f"₹{loan.loan_amnt:,.0f} for your {loan.purpose} loan has been disbursed.",
            "success", f"/loan/{loan.id}")

    session.close()
    return {"success": True, "message": "Loan disbursed", "loan_id": loan_id}


# ============== PAYMENT ENDPOINTS ==============




@app.post("/verify-payment")
def verify_payment(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Hardened payment verification with:
    - Idempotency (same razorpay_payment_id can't double-process)
    - Row-level lock on the loan (prevents concurrent EMI conflicts)
    - Double-entry ledger record for audit
    - Atomic DB transaction (all or nothing)
    """
    if not razorpay_client:
        return {"error": "Razorpay not configured"}

    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return {"error": "Missing payment details"}

    # Idempotency key from razorpay's unique payment id
    idem_key = f"rzp:{razorpay_payment_id}"

    session = Session()
    try:
        # === STEP 1: Signature verification (always cheap, do first) ===
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        })

        # === STEP 2: Idempotency check ===
        # If this razorpay_payment_id was already processed, return the same result.
        existing_ledger = session.query(LedgerEntry).filter(
            LedgerEntry.idempotency_key == idem_key
        ).first()
        if existing_ledger:
            session.close()
            return {
                "success": True,
                "message": "Payment already processed (idempotent replay)",
                "carryover_note": "",
                "ledger_id": existing_ledger.id
            }

        # === STEP 3: Look up the payment ===
        payment = session.query(Payment).filter(
            Payment.razorpay_order_id == razorpay_order_id
        ).first()
        if not payment:
            session.close()
            return {"error": "Payment record not found"}

        # === STEP 4: Lock the loan row (FOR UPDATE) so two payments can't race ===
        loan = session.query(Loan).filter(
            Loan.id == payment.loan_id
        ).with_for_update().first()
        if not loan:
            session.close()
            return {"error": "Loan not found"}

        # === STEP 5: Update payment record ===
        payment.razorpay_payment_id = razorpay_payment_id
        payment.razorpay_signature = razorpay_signature
        payment.status = "paid"
        payment.paid_at = datetime.utcnow()

        # === STEP 6: Calculate carry-over re-amortization (existing logic) ===
        user = session.query(User).filter(User.id == payment.user_id).first()
        carryover_msg = ""
        balance_before = loan.carryover_balance or 0

        expected = payment.expected_emi or loan.installment
        emi_portion = payment.amount - (payment.late_fee or 0)
        shortfall = expected - emi_portion
        carryover_delta = 0  # how much carryover changed

        if payment.payment_type == "partial" and shortfall > 0:
            paid_count = session.query(Payment).filter(
                Payment.loan_id == loan.id,
                Payment.status == "paid"
            ).count()
            remaining_months = max(loan.term - paid_count, 1)

            loan.carryover_balance = (loan.carryover_balance or 0) + shortfall
            loan.emi_adjustment = round(loan.carryover_balance / remaining_months, 2)
            carryover_delta = shortfall

            new_emi = round(loan.installment + loan.emi_adjustment, 2)
            carryover_msg = (f"You paid ₹{emi_portion:,.0f} of ₹{expected:,.0f}. "
                             f"The shortfall of ₹{shortfall:,.0f} has been spread across your "
                             f"remaining {remaining_months} EMIs. Your new EMI is ₹{new_emi:,.0f}.")
        elif payment.payment_type == "full" and loan.carryover_balance and loan.carryover_balance > 0:
            if emi_portion >= (loan.installment + loan.emi_adjustment - 1):
                reduction = min(loan.carryover_balance, loan.emi_adjustment or 0)
                loan.carryover_balance = max(0, round(loan.carryover_balance - loan.emi_adjustment, 2))
                carryover_delta = -reduction
                if loan.carryover_balance == 0:
                    loan.emi_adjustment = 0

        balance_after = loan.carryover_balance or 0

        # === STEP 7: Write the immutable ledger entry ===
        # Split amount into components for audit
        late_fee_part = payment.late_fee or 0
        # Rough heuristic: interest ~ 30% of EMI portion in early months, principal the rest.
        # In a real bank we'd compute from amortization schedule. For now, simplified:
        principal_part = round(emi_portion * 0.7, 2) if emi_portion > 0 else 0
        interest_part = round(emi_portion - principal_part, 2) if emi_portion > 0 else 0

        ledger = LedgerEntry(
            idempotency_key=idem_key,
            loan_id=loan.id,
            user_id=payment.user_id,
            payment_id=payment.id,
            entry_type="emi_payment",
            amount=payment.amount,
            principal_component=principal_part,
            interest_component=interest_part,
            fee_component=late_fee_part,
            carryover_component=carryover_delta,
            balance_before=balance_before,
            balance_after=balance_after,
            reference=razorpay_payment_id,
            description=f"{payment.payment_type or 'full'} EMI payment for {loan.purpose} loan #{loan.id}"
        )
        session.add(ledger)
        session.flush()
        ledger_id_value = ledger.id

        # === STEP 8: Atomic commit (everything succeeds or nothing does) ===
        session.commit()
        ledger_id_value = ledger.id

        log_event(
            user_id=payment.user_id,
            event_type="payment_succeeded",
            event_category="payment",
            loan_id=loan.id,
            metadata={
                "amount": payment.amount,
                "payment_type": payment.payment_type or "full",
                "principal": principal_part,
                "interest": interest_part,
                "fee": late_fee_part,
                "razorpay_payment_id": razorpay_payment_id,
            },
        )

        # === STEP 9: Side-effects (email, notifications) — these are outside the DB transaction ===
        if user and loan:
            try:
                email = payment_success_email(user.name, payment.amount, loan.purpose)
                send_email(user.email, email["subject"], email["html"])
            except Exception as e:
                print(f"Email failed: {e}")

            try:
                create_notification(session, user.id, "Payment Received ✓",
                    f"Your payment of ₹{payment.amount:,.0f} for {loan.purpose} loan was successful.",
                    "payment", f"/loan/{loan.id}")
                notify_all_analysts(
                    session,
                    "💰 EMI Payment Received",
                    f"{user.name} paid ₹{payment.amount:,.0f} for their {loan.purpose} loan",
                    "payment",
                    "/dashboard"
                )
            except Exception as e:
                print(f"Notification failed: {e}")

        session.close()
        return {
            "success": True,
            "message": "Payment verified successfully",
            "carryover_note": carryover_msg,
            "ledger_id": ledger_id_value
        }

    except razorpay.errors.SignatureVerificationError:
        session.rollback()
        session.close()
        return {"error": "Invalid signature — payment verification failed"}
    except Exception as e:
        session.rollback()
        session.close()
        return {"error": str(e)}

@app.get("/payment-history/{loan_id}")
def get_payment_history(loan_id: int, current_user: dict = Depends(get_current_user)):
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


@app.get("/my-transactions")
def get_my_transactions(current_user: dict = Depends(get_current_user)):
    """Unified ledger across all the borrower's loans. Powers the Transactions page."""
    session = Session()
    try:
        entries = session.query(LedgerEntry).filter(
            LedgerEntry.user_id == current_user["user_id"]
        ).order_by(LedgerEntry.created_at.desc()).all()

        loan_ids = list({e.loan_id for e in entries})
        loans = session.query(Loan).filter(Loan.id.in_(loan_ids)).all() if loan_ids else []
        purpose_by_id = {l.id: l.purpose for l in loans}

        result = []
        for e in entries:
            result.append({
                "id": e.id,
                "loan_id": e.loan_id,
                "loan_purpose": purpose_by_id.get(e.loan_id, "loan"),
                "entry_type": e.entry_type,
                "amount": e.amount,
                "principal": e.principal_component or 0,
                "interest": e.interest_component or 0,
                "fee": e.fee_component or 0,
                "carryover": e.carryover_component or 0,
                "balance_after": e.balance_after,
                "reference": e.reference,
                "description": e.description,
                "created_at": str(e.created_at),
            })

        total_paid = sum(e.amount for e in entries)
        total_principal = sum((e.principal_component or 0) for e in entries)
        total_interest = sum((e.interest_component or 0) for e in entries)
        total_fees = sum((e.fee_component or 0) for e in entries)

        session.close()
        return {
            "transactions": result,
            "summary": {
                "count": len(result),
                "total_paid": round(total_paid, 2),
                "total_principal": round(total_principal, 2),
                "total_interest": round(total_interest, 2),
                "total_fees": round(total_fees, 2),
            }
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}


# ============== DEFERRAL ENDPOINTS ==============

@app.post("/request-deferral/{loan_id}")
def request_deferral(loan_id: int, data: dict, current_user: dict = Depends(get_current_user)):
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

        log_event(
            user_id=current_user["user_id"],
            event_type="deferral_requested",
            event_category="distress",
            loan_id=loan_id,
            metadata={
                "months": months,
                "loan_purpose": loan.purpose,
                "reason_length": len(reason),
            },
        )

        # Notify all analysts about the deferral request
        borrower = session.query(User).filter(User.id == current_user["user_id"]).first()
        borrower_name = borrower.name if borrower else "A borrower"
        notify_all_analysts(
            session,
            "⏸ Deferral Request",
            f"{borrower_name} requested a {months}-month deferral on their {loan.purpose} loan. Reason: {reason[:60]}{'...' if len(reason) > 60 else ''}",
            "warning",
            "/dashboard"
        )
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
    if current_user.get("role") != "analyst":
        return {"error": "Only analysts can review deferrals"}

    decision = data.get("decision")
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

        user = session.query(User).filter(User.id == deferral.user_id).first()
        if user:
            email = deferral_decision_email(user.name, deferral.status, deferral.requested_months, note)
            send_email(user.email, email["subject"], email["html"])
            create_notification(session, deferral.user_id, "Deferral Request Update",
            f"Your deferral request has been {decision}.",
            "info", f"/loan/{deferral.loan_id}")

        session.close()
        return {"success": True, "message": f"Deferral {deferral.status}"}
    except Exception as e:
        session.close()
        return {"error": str(e)}
@app.post("/update-profile")
def update_profile(data: dict, current_user: dict = Depends(get_current_user)):
    """Update borrower profile — gender, DOB, employment type, PAN"""
    session = Session()
    try:
        user = session.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            session.close()
            return {"error": "User not found"}

        if "gender" in data:
            user.gender = data["gender"]
        if "date_of_birth" in data:
            user.date_of_birth = data["date_of_birth"]
        if "pan_number" in data:
            user.pan_number = data["pan_number"]
        if "employment_type" in data:
            user.employment_type = data["employment_type"]

        session.commit()
        session.close()
        return {"success": True, "message": "Profile updated"}
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.get("/my-profile")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    session = Session()
    user = session.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        session.close()
        return {"error": "User not found"}
    result = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth,
        "pan_number": user.pan_number,
        "employment_type": user.employment_type
    }
    session.close()
    return result
# ============== SMART EMI / PARTIAL PAYMENT ENDPOINTS ==============

@app.get("/emi-status/{loan_id}")
def get_emi_status(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Get current EMI status — what's due, how late, suggestions"""
    session = Session()
    loan = session.query(Loan).filter(
        Loan.id == loan_id,
        Loan.user_id == current_user["user_id"]
    ).first()
    if not loan:
        session.close()
        return {"error": "Loan not found"}

    # Count paid EMIs
    paid_payments = session.query(Payment).filter(
        Payment.loan_id == loan_id,
        Payment.status == "paid"
    ).all()
    total_paid = sum(p.amount for p in paid_payments)
    paid_count = len(paid_payments)

    # Calculate next EMI due date (1 month from disbursement, then monthly)
    if not loan.reviewed_at:
        next_due = datetime.utcnow()
    else:
        # First EMI due 1 month after disbursement; each subsequent EMI 1 month later
        from datetime import timedelta
        months_since = paid_count + 1
        next_due = loan.reviewed_at + timedelta(days=30 * months_since)

    today = datetime.utcnow()
    days_late = max(0, (today - next_due).days) if next_due < today else 0
    days_until_due = max(0, (next_due - today).days) if next_due > today else 0
    # Effective EMI includes any carry-over adjustment from prior partial payments
    effective_emi = round(loan.installment + (loan.emi_adjustment or 0), 2)

    # Grace period: RBI norm — typically 5 days after due date, no late fee
    grace_days = loan.grace_days or 5
    in_grace_period = 0 < days_late <= grace_days
    grace_days_left = max(0, grace_days - days_late) if days_late > 0 else 0
    days_past_grace = max(0, days_late - grace_days)

    # Calculate late fee (₹500 + 2% of EMI per week late, capped at 10% of EMI)
    # Only after grace period expires
    late_fee = 0
    if days_past_grace > 0:
        weeks_late = (days_past_grace // 7) + 1
        late_fee = min(500 + (weeks_late * 0.02 * effective_emi), effective_emi * 0.10)
        late_fee = round(late_fee, 2)

    # Smart suggestion based on situation
    suggestion = {
        "primary": "full_payment",
        "title": "Pay full EMI",
        "description": f"Pay your monthly EMI of ₹{effective_emi:,.0f} to stay on track.",
        "options": []
    }

    if days_late > 30:
        suggestion = {
            "primary": "urgent",
            "title": "⚠ Payment overdue",
            "description": f"You're {days_late} days late. A penalty of ₹{late_fee:,.0f} applies. Pay now to avoid CIBIL impact.",
            "options": ["pay_full_with_penalty", "request_deferral"]
        }
    elif days_past_grace > 0:
        suggestion = {
            "primary": "late",
            "title": "Payment is late (grace period ended)",
            "description": f"You're {days_late} days late ({days_past_grace} days past grace). Penalty: ₹{late_fee:,.0f}",
            "options": ["pay_full_with_penalty", "pay_partial", "request_deferral"]
        }
    elif in_grace_period:
        suggestion = {
            "primary": "grace",
            "title": f"🛡 Grace period active · {grace_days_left} day{'s' if grace_days_left != 1 else ''} left",
            "description": f"You're {days_late} day{'s' if days_late != 1 else ''} past due, but within the {grace_days}-day grace window. No late fee yet — pay before grace ends to avoid penalty.",
            "options": ["pay_full", "pay_partial"]
        }
    elif days_until_due > 0 and days_until_due <= 5:
        suggestion = {
            "primary": "due_soon",
            "title": f"EMI due in {days_until_due} days",
            "description": f"₹{effective_emi:,.0f} is due on {next_due.strftime('%d %b %Y')}",
            "options": ["pay_full"]
        }

    remaining_principal = loan.loan_amnt - total_paid
    progress_pct = (total_paid / loan.loan_amnt * 100) if loan.loan_amnt > 0 else 0

    session.close()
    return {
        "loan_id": loan_id,
        "purpose": loan.purpose,
        "loan_amnt": loan.loan_amnt,
        "expected_emi": effective_emi,
        "base_emi": round(loan.installment, 2),
        "emi_adjustment": round(loan.emi_adjustment or 0, 2),
        "carryover_balance": round(loan.carryover_balance or 0, 2),
        "paid_count": paid_count,
        "total_term": loan.term,
        "total_paid": round(total_paid, 2),
        "remaining_principal": round(remaining_principal, 2),
        "progress_pct": round(progress_pct, 1),
        "next_due_date": next_due.strftime("%Y-%m-%d"),
        "days_late": days_late,
        "days_until_due": days_until_due,
        "late_fee": late_fee,
        "grace_days": grace_days,
        "in_grace_period": in_grace_period,
        "grace_days_left": grace_days_left,
        "days_past_grace": days_past_grace,
        "total_due_today": round(effective_emi + late_fee, 2),
        "suggestion": suggestion,
        "min_partial_amount": round(effective_emi * 0.30, 2)  # minimum 30% of EMI for partial
    }


@app.post("/create-payment-order/{loan_id}")
def create_payment_order_v2(loan_id: int, data: dict = None, current_user: dict = Depends(get_current_user)):
    """Create Razorpay order — supports full, partial, or with-penalty payments"""
    if not razorpay_client:
        return {"error": "Razorpay not configured"}

    if data is None:
        data = {}
    payment_type = data.get("payment_type", "full")  # full, partial
    custom_amount = data.get("amount", None)  # for partial payments

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

        installment = float(loan.installment) + float(loan.emi_adjustment or 0)
        purpose = loan.purpose

        # Calculate days late + penalty
        from datetime import timedelta
        paid_count = session.query(Payment).filter(
            Payment.loan_id == loan_id,
            Payment.status == "paid"
        ).count()

        late_fee = 0
        days_late = 0
        if loan.reviewed_at:
            next_due = loan.reviewed_at + timedelta(days=30 * (paid_count + 1))
            days_late = max(0, (datetime.utcnow() - next_due).days)
            if days_late > 0:
                weeks_late = (days_late // 7) + 1
                late_fee = min(500 + (weeks_late * 0.02 * installment), installment * 0.10)
                late_fee = round(late_fee, 2)

        # Determine final amount
        if payment_type == "partial":
            payment_amount = float(custom_amount or 0)
            if payment_amount < installment * 0.30:
                session.close()
                return {"error": f"Minimum partial payment is ₹{installment * 0.30:,.0f} (30% of EMI)"}
            if payment_amount > installment:
                session.close()
                return {"error": "Partial payment cannot exceed full EMI. Use 'full' payment type instead."}
        else:
            payment_amount = installment + late_fee

        amount_paise = int(payment_amount * 100)

        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"loan_{loan_id}_{payment_type}_{int(datetime.utcnow().timestamp())}",
            "notes": {
                "loan_id": str(loan_id),
                "user_id": str(current_user["user_id"]),
                "purpose": purpose,
                "payment_type": payment_type,
                "late_fee": str(late_fee)
            }
        }
        order = razorpay_client.order.create(data=order_data)

        payment = Payment(
            loan_id=loan_id,
            user_id=current_user["user_id"],
            amount=payment_amount,
            payment_type=payment_type,
            expected_emi=installment,
            late_fee=late_fee,
            days_late=days_late,
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
            "emi_amount": payment_amount,
            "payment_type": payment_type,
            "late_fee": late_fee,
            "days_late": days_late
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}

def create_notification(session, user_id, title, message, ntype="info", link=None):
    """Helper to create a notification"""
    try:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=ntype,
            link=link
        )
        session.add(notif)
        session.commit()
    except Exception as e:
        print(f"Notification failed: {e}")

def log_event(user_id, event_type, event_category=None, loan_id=None, metadata=None, ip_address=None):
    """Fire-and-forget behavioral event logger. Uses its own session; never breaks the caller."""
    s = Session()
    try:
        ev = Event(
            user_id=user_id,
            event_type=event_type,
            event_category=event_category,
            loan_id=loan_id,
            event_metadata=metadata,
            ip_address=ip_address,
        )
        s.add(ev)
        s.commit()
    except Exception as e:
        print(f"Event log failed ({event_type}): {e}")
        try:
            s.rollback()
        except Exception:
            pass
    finally:
        s.close()

def notify_all_analysts(session, title, message, ntype="info", link=None):
    """Send a notification to every analyst user."""
    try:
        analysts = session.query(User).filter(User.role == "analyst").all()
        for a in analysts:
            notif = Notification(
                user_id=a.id,
                title=title,
                message=message,
                type=ntype,
                link=link
            )
            session.add(notif)
        session.commit()
    except Exception as e:
        print(f"Analyst notif failed: {e}")   
    # ============== NOTIFICATIONS ==============

@app.get("/notifications")
def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get all notifications for the current user, newest first"""
    session = Session()
    notifs = session.query(Notification).filter(
        Notification.user_id == current_user["user_id"]
    ).order_by(Notification.created_at.desc()).limit(30).all()

    result = [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "is_read": n.is_read,
        "link": n.link,
        "created_at": n.created_at.isoformat() if n.created_at else None
    } for n in notifs]

    unread_count = session.query(Notification).filter(
        Notification.user_id == current_user["user_id"],
        Notification.is_read == False
    ).count()

    session.close()
    return {"notifications": result, "unread_count": unread_count}


@app.post("/notifications/mark-read")
def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    session = Session()
    session.query(Notification).filter(
        Notification.user_id == current_user["user_id"],
        Notification.is_read == False
    ).update({"is_read": True})
    session.commit()
    session.close()
    return {"success": True}
# ============== AMORTIZATION PDF ==============

@app.get("/loan/{loan_id}/amortization-pdf")
def amortization_pdf(loan_id: int, current_user: dict = Depends(get_current_user)):
    """Generate a downloadable amortization schedule PDF"""
    session = Session()
    loan = session.query(Loan).filter(
        Loan.id == loan_id,
        Loan.user_id == current_user["user_id"]
    ).first()
    if not loan:
        session.close()
        return {"error": "Loan not found"}

    user = session.query(User).filter(User.id == loan.user_id).first()
    payments = session.query(Payment).filter(
        Payment.loan_id == loan_id,
        Payment.status == "paid"
    ).order_by(Payment.paid_at).all()

    # Capture before session.close()
    loan_data = {
        "id": loan.id,
        "purpose": loan.purpose,
        "loan_amnt": loan.loan_amnt,
        "term": loan.term,
        "int_rate": loan.int_rate,
        "installment": loan.installment,
        "cibil_score": loan.cibil_score or 0,
        "created_at": loan.created_at.strftime("%d %b %Y") if loan.created_at else "",
        "reviewed_at": loan.reviewed_at.strftime("%d %b %Y") if loan.reviewed_at else "Pending",
        "status": loan.status,
    }
    user_data = {"name": user.name, "email": user.email}
    paid_emi_numbers = set()
    for i, _ in enumerate(payments, start=1):
        paid_emi_numbers.add(i)
    session.close()

    # Build amortization schedule
    P = loan_data["loan_amnt"]
    r = loan_data["int_rate"] / 100 / 12
    n = loan_data["term"]
    emi = loan_data["installment"]
    start_date = datetime.strptime(loan_data["reviewed_at"], "%d %b %Y") if loan_data["status"] == "active" else datetime.utcnow()

    schedule = []
    balance = P
    total_interest = 0
    total_principal = 0
    from datetime import timedelta
    for i in range(1, n + 1):
        interest = balance * r
        principal = emi - interest
        balance = max(0, balance - principal)
        total_interest += interest
        total_principal += principal
        due_date = start_date + timedelta(days=30 * i)
        status = "✓ Paid" if i in paid_emi_numbers else ("Overdue" if due_date < datetime.utcnow() else "Pending")
        schedule.append({
            "no": i,
            "date": due_date.strftime("%d %b %Y"),
            "emi": emi,
            "principal": principal,
            "interest": interest,
            "balance": balance,
            "status": status,
        })

    # Build PDF
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                  fontSize=22, textColor=colors.HexColor("#1a1a2e"),
                                  spaceAfter=4)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"],
                                     fontSize=10, textColor=colors.HexColor("#8892a4"),
                                     spaceAfter=18)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"],
                               fontSize=13, textColor=colors.HexColor("#1a1a2e"),
                               spaceAfter=10, spaceBefore=14)
    normal = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14)

    elements = []
    elements.append(Paragraph("LoanSense", title_style))
    elements.append(Paragraph(f"Amortization Schedule · Generated on {datetime.utcnow().strftime('%d %b %Y')}", subtitle_style))

    # Borrower & loan summary
    elements.append(Paragraph("Loan Summary", h2_style))
    summary_data = [
        ["Borrower", user_data["name"], "Loan ID", f"#{loan_data['id']}"],
        ["Email", user_data["email"], "Status", loan_data["status"].title()],
        ["Loan Type", loan_data["purpose"].title(), "CIBIL Score", str(loan_data["cibil_score"])],
        ["Principal", f"INR {loan_data['loan_amnt']:,.0f}", "Interest Rate", f"{loan_data['int_rate']}% p.a."],
        ["Tenure", f"{loan_data['term']} months", "Monthly EMI", f"INR {loan_data['installment']:,.0f}"],
        ["Applied On", loan_data["created_at"], "Disbursed On", loan_data["reviewed_at"]],
    ]
    summary_table = Table(summary_data, colWidths=[28*mm, 55*mm, 28*mm, 55*mm])
    summary_table.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#8892a4")),
        ("TEXTCOLOR", (2,0), (2,-1), colors.HexColor("#8892a4")),
        ("TEXTCOLOR", (1,0), (1,-1), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (3,0), (3,-1), colors.HexColor("#1a1a2e")),
        ("FONTNAME", (1,0), (1,-1), "Helvetica-Bold"),
        ("FONTNAME", (3,0), (3,-1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, colors.HexColor("#f0f2f7")),
    ]))
    elements.append(summary_table)

    # Totals
    elements.append(Paragraph("Total Repayment Breakdown", h2_style))
    total_payable = total_principal + total_interest
    totals_data = [
        ["Total Principal", f"INR {total_principal:,.2f}"],
        ["Total Interest", f"INR {total_interest:,.2f}"],
        ["Total Amount Payable", f"INR {total_payable:,.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[80*mm, 86*mm])
    totals_table.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("BACKGROUND", (0,2), (-1,2), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0,2), (-1,2), colors.white),
        ("FONTNAME", (0,2), (-1,2), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("LINEBELOW", (0,0), (-1,1), 0.3, colors.HexColor("#f0f2f7")),
    ]))
    elements.append(totals_table)

    # Amortization schedule table
    elements.append(Paragraph("Monthly Payment Schedule", h2_style))
    sched_header = ["#", "Due Date", "EMI", "Principal", "Interest", "Balance", "Status"]
    sched_rows = [sched_header]
    for row in schedule:
        sched_rows.append([
            str(row["no"]),
            row["date"],
            f"{row['emi']:,.0f}",
            f"{row['principal']:,.0f}",
            f"{row['interest']:,.0f}",
            f"{row['balance']:,.0f}",
            row["status"],
        ])
    sched_table = Table(sched_rows,
                        colWidths=[10*mm, 25*mm, 25*mm, 28*mm, 25*mm, 30*mm, 23*mm],
                        repeatRows=1)
    sched_style = TableStyle([
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("ALIGN", (0,0), (-1,-1), "RIGHT"),
        ("ALIGN", (0,0), (1,-1), "LEFT"),
        ("ALIGN", (6,1), (6,-1), "CENTER"),
        ("ALIGN", (0,0), (-1,0), "CENTER"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#eaedf3")),
    ])
    # Alternate row coloring + status coloring
    for i, row in enumerate(schedule, start=1):
        if i % 2 == 0:
            sched_style.add("BACKGROUND", (0,i), (-1,i), colors.HexColor("#fafbfc"))
        if "Paid" in row["status"]:
            sched_style.add("TEXTCOLOR", (6,i), (6,i), colors.HexColor("#1a7a3c"))
            sched_style.add("FONTNAME", (6,i), (6,i), "Helvetica-Bold")
        elif row["status"] == "Overdue":
            sched_style.add("TEXTCOLOR", (6,i), (6,i), colors.HexColor("#c0392b"))
            sched_style.add("FONTNAME", (6,i), (6,i), "Helvetica-Bold")
        else:
            sched_style.add("TEXTCOLOR", (6,i), (6,i), colors.HexColor("#8892a4"))
    sched_table.setStyle(sched_style)
    elements.append(sched_table)

    # Footer
    footer_style = ParagraphStyle("Footer", parent=normal, fontSize=8,
                                   textColor=colors.HexColor("#8892a4"), spaceBefore=18)
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "This is a system-generated amortization schedule. All amounts are in Indian Rupees (INR). "
        "Actual EMI may vary slightly due to rounding, late fees, or partial payments. "
        "For queries, contact LoanSense support.", footer_style))

    doc.build(elements)
    buf.seek(0)
    filename = f"loansense_loan_{loan_id}_schedule.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})

# ============== SUPPORT TICKETS ==============

@app.post("/support/create-ticket")
def create_ticket(data: dict, current_user: dict = Depends(get_current_user)):
    """Borrower raises a new support ticket"""
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()
    category = data.get("category", "general")
    priority = data.get("priority", "normal")

    if not subject or len(subject) < 5:
        return {"error": "Subject must be at least 5 characters"}
    if not message or len(message) < 20:
        return {"error": "Please describe your issue (at least 20 characters)"}
    if category not in ["general", "payment", "technical", "account", "complaint"]:
        category = "general"
    if priority not in ["low", "normal", "high", "urgent"]:
        priority = "normal"

    session = Session()
    try:
        user = session.query(User).filter(User.id == current_user["user_id"]).first()
        ticket = SupportTicket(
            user_id=current_user["user_id"],
            subject=subject,
            message=message,
            category=category,
            priority=priority,
            status="open"
        )
        session.add(ticket)
        session.commit()
        session.refresh(ticket)
        ticket_id = ticket.id

        # Add the initial message to the thread
        first_msg = TicketMessage(
            ticket_id=ticket_id,
            sender_id=current_user["user_id"],
            sender_role="borrower",
            message=message
        )
        session.add(first_msg)
        session.commit()

        # Notify analysts about the new ticket
        notify_all_analysts(
            session,
            "🎫 New support ticket",
            f"{user.name if user else 'A borrower'} raised a {priority} priority ticket: {subject[:60]}",
            "warning" if priority in ["high", "urgent"] else "info",
            "/dashboard"
        )

        # Notify borrower their ticket is created
        create_notification(
            session, current_user["user_id"],
            "🎫 Support ticket created",
            f"Your ticket '{subject[:50]}' has been received. We'll respond within 24 hours.",
            "info",
            "/support"
        )

        session.close()
        return {"success": True, "ticket_id": ticket_id,
                "message": "Ticket created. We'll respond within 24 hours."}
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.get("/support/my-tickets")
def my_tickets(current_user: dict = Depends(get_current_user)):
    """Borrower fetches their own tickets — with full message threads"""
    session = Session()
    tickets = session.query(SupportTicket).filter(
        SupportTicket.user_id == current_user["user_id"]
    ).order_by(SupportTicket.created_at.desc()).all()

    result = []
    for t in tickets:
        msgs = session.query(TicketMessage).filter(
            TicketMessage.ticket_id == t.id
        ).order_by(TicketMessage.created_at.asc()).all()
        thread = [{
            "id": m.id,
            "sender_role": m.sender_role,
            "message": m.message,
            "created_at": m.created_at.isoformat() if m.created_at else None
        } for m in msgs]

        result.append({
            "id": t.id,
            "subject": t.subject,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "thread": thread,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    session.close()
    return result


@app.get("/support/all-tickets")
def all_tickets(current_user: dict = Depends(get_current_user)):
    """Analyst view: all tickets across all borrowers, with threads"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    session = Session()
    tickets = session.query(SupportTicket).order_by(
        SupportTicket.status.asc(),
        SupportTicket.priority.desc(),
        SupportTicket.created_at.desc()
    ).all()

    result = []
    for t in tickets:
        u = session.query(User).filter(User.id == t.user_id).first()
        msgs = session.query(TicketMessage).filter(
            TicketMessage.ticket_id == t.id
        ).order_by(TicketMessage.created_at.asc()).all()
        thread = [{
            "id": m.id,
            "sender_role": m.sender_role,
            "message": m.message,
            "created_at": m.created_at.isoformat() if m.created_at else None
        } for m in msgs]

        result.append({
            "id": t.id,
            "subject": t.subject,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "thread": thread,
            "borrower_name": u.name if u else "Unknown",
            "borrower_email": u.email if u else "",
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    session.close()
    return result


@app.post("/support/respond/{ticket_id}")
def respond_ticket(ticket_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Analyst responds to / resolves a ticket"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    response_text = (data.get("response") or "").strip()
    new_status = data.get("status", "resolved")

    if not response_text or len(response_text) < 10:
        return {"error": "Response must be at least 10 characters"}
    if new_status not in ["in_progress", "resolved", "closed"]:
        new_status = "resolved"

    session = Session()
    try:
        ticket = session.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
        if not ticket:
            session.close()
            return {"error": "Ticket not found"}

        ticket.response = response_text  # keep for backward compat
        ticket.status = new_status
        ticket.responded_by = current_user["user_id"]
        ticket.responded_at = datetime.utcnow()

        # Add this response as a thread message
        msg = TicketMessage(
            ticket_id=ticket.id,
            sender_id=current_user["user_id"],
            sender_role="analyst",
            message=response_text
        )
        session.add(msg)
        session.commit()

        # Notify the borrower
        create_notification(
            session, ticket.user_id,
            f"✓ Support ticket {new_status}",
            f"Your ticket '{ticket.subject[:50]}' has been {new_status}. View response in /support",
            "success" if new_status == "resolved" else "info",
            "/support"
        )

        session.close()
        return {"success": True, "message": f"Ticket {new_status}"}
    except Exception as e:
        session.close()
        return {"error": str(e)}
@app.post("/support/reply/{ticket_id}")
def reply_to_ticket(ticket_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Borrower follows up on an existing ticket — reopens it"""
    message_text = (data.get("message") or "").strip()
    if not message_text or len(message_text) < 10:
        return {"error": "Reply must be at least 10 characters"}

    session = Session()
    try:
        ticket = session.query(SupportTicket).filter(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == current_user["user_id"]  # only own tickets
        ).first()
        if not ticket:
            session.close()
            return {"error": "Ticket not found"}
        if ticket.status == "closed":
            session.close()
            return {"error": "This ticket is closed. Please raise a new one."}

        # Add the borrower's reply
        msg = TicketMessage(
            ticket_id=ticket_id,
            sender_id=current_user["user_id"],
            sender_role="borrower",
            message=message_text
        )
        session.add(msg)

        # Reopen the ticket if it was resolved
        if ticket.status in ["resolved", "in_progress"]:
            ticket.status = "reopened"
        session.commit()

        # Notify analysts
        user = session.query(User).filter(User.id == current_user["user_id"]).first()
        notify_all_analysts(
            session,
            "🔄 Ticket reopened",
            f"{user.name if user else 'A borrower'} replied on ticket: {ticket.subject[:50]}",
            "warning",
            "/dashboard"
        )

        session.close()
        return {"success": True, "message": "Reply sent. Bank will respond shortly."}
    except Exception as e:
        session.close()
        return {"error": str(e)}


# ============== DEFAULT RADAR ==============

@app.get("/analyst/default-radar")
def default_radar(current_user: dict = Depends(get_current_user)):
    """
    Dynamic risk scoring based on payment behavior.
    Returns active loans sorted by current risk, highlighting those whose risk has risen.
    """
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    session = Session()
    try:
        from datetime import timedelta
        active = session.query(Loan).filter(Loan.status == "active").all()
        radar = []

        for loan in active:
            user = session.query(User).filter(User.id == loan.user_id).first()

            # Original ML risk
            original_risk = loan.risk_score or 0.5

            # Payment behavior signals
            payments = session.query(Payment).filter(
                Payment.loan_id == loan.id,
                Payment.status == "paid"
            ).all()
            total_payments = len(payments)
            late_payments = sum(1 for p in payments if (p.days_late or 0) > 0)
            partial_payments = sum(1 for p in payments if p.payment_type == "partial")

            # Days since last payment
            last_payment = session.query(Payment).filter(
                Payment.loan_id == loan.id,
                Payment.status == "paid"
            ).order_by(Payment.paid_at.desc()).first()
            days_since_last = None
            if last_payment and last_payment.paid_at:
                days_since_last = (datetime.utcnow() - last_payment.paid_at).days

            # Pending deferrals
            pending_deferrals = session.query(DeferralRequest).filter(
                DeferralRequest.loan_id == loan.id,
                DeferralRequest.status == "pending"
            ).count()

            # Approved deferrals (history)
            approved_deferrals = session.query(DeferralRequest).filter(
                DeferralRequest.loan_id == loan.id,
                DeferralRequest.status == "approved"
            ).count()

            # Carry-over balance (re-amortization signal)
            carryover = loan.carryover_balance or 0

            # Dynamic risk score = original + behavior modifiers
            current_risk = original_risk
            warnings = []

            if total_payments > 0:
                late_ratio = late_payments / total_payments
                if late_ratio >= 0.5:
                    current_risk += 0.20
                    warnings.append(f"{late_payments}/{total_payments} payments were late")
                elif late_ratio >= 0.25:
                    current_risk += 0.10
                    warnings.append(f"{late_payments}/{total_payments} late payments")

                partial_ratio = partial_payments / total_payments
                if partial_ratio >= 0.5:
                    current_risk += 0.15
                    warnings.append(f"{partial_payments} partial payments (cash flow stress)")
                elif partial_ratio > 0:
                    current_risk += 0.05

            if days_since_last is not None and days_since_last > 45:
                current_risk += 0.15
                warnings.append(f"No payment for {days_since_last} days")
            elif days_since_last is not None and days_since_last > 35:
                current_risk += 0.07
                warnings.append(f"Last payment {days_since_last} days ago")

            if approved_deferrals > 0:
                current_risk += 0.05 * approved_deferrals
                warnings.append(f"{approved_deferrals} deferral(s) already used")

            if pending_deferrals > 0:
                current_risk += 0.10
                warnings.append("Pending deferral request — actively struggling")

            if carryover > 0:
                # Carry-over ratio vs original EMI
                ratio = carryover / (loan.installment or 1)
                if ratio > 1.5:
                    current_risk += 0.10
                    warnings.append(f"Carry-over of ₹{carryover:,.0f} (over 1.5× EMI)")
                elif ratio > 0:
                    current_risk += 0.05

            current_risk = min(1.0, current_risk)
            risk_delta = current_risk - original_risk

            # Determine new risk band
            if current_risk >= 0.65:
                new_band = "HIGH"
            elif current_risk >= 0.35:
                new_band = "MEDIUM"
            else:
                new_band = "LOW"

            # Did risk get worse?
            original_band = loan.risk_level or "MEDIUM"
            band_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
            band_moved = band_order.get(new_band, 1) - band_order.get(original_band, 1)

            radar.append({
                "loan_id": loan.id,
                "borrower_name": user.name if user else "Unknown",
                "borrower_email": user.email if user else "",
                "purpose": loan.purpose,
                "loan_amnt": loan.loan_amnt,
                "installment": loan.installment,
                "term": loan.term,
                "int_rate": loan.int_rate,
                "original_risk": round(original_risk, 3),
                "current_risk": round(current_risk, 3),
                "risk_delta": round(risk_delta, 3),
                "original_band": original_band,
                "current_band": new_band,
                "band_moved": band_moved,  # +1 = risk band went up (worse)
                "warnings": warnings,
                "total_payments": total_payments,
                "late_payments": late_payments,
                "partial_payments": partial_payments,
                "days_since_last_payment": days_since_last,
                "pending_deferrals": pending_deferrals,
                "carryover_balance": round(carryover, 2)
            })

        # Sort: bands moved up first, then by current risk descending
        radar.sort(key=lambda x: (-x["band_moved"], -x["current_risk"]))
        session.close()
        return {"loans": radar}
    except Exception as e:
        session.close()
        return {"error": str(e)}


# ============== RESTRUCTURING SIMULATOR ==============

@app.post("/analyst/simulate-restructure")
def simulate_restructure(data: dict, current_user: dict = Depends(get_current_user)):
    """Preview what a restructured loan would look like — no DB changes"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    loan_id = int(data.get("loan_id", 0))
    extend_months = int(data.get("extend_months", 0))
    rate_reduction = float(data.get("rate_reduction", 0))  # in percentage points

    session = Session()
    loan = session.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        session.close()
        return {"error": "Loan not found"}

    # Count paid EMIs
    paid_count = session.query(Payment).filter(
        Payment.loan_id == loan_id,
        Payment.status == "paid"
    ).count()
    total_paid = session.query(func.sum(Payment.amount)).filter(
        Payment.loan_id == loan_id,
        Payment.status == "paid"
    ).scalar() or 0
    session.close()

    # Remaining principal (rough estimate — original principal minus paid amount)
    # In real banking we'd use amortization to compute true remaining principal
    # For now, simplified: remaining = loan_amnt - (total_paid - interest_paid_so_far)
    # Even simpler heuristic: estimate from EMI count
    remaining_principal = loan.loan_amnt - total_paid
    if remaining_principal < 0:
        remaining_principal = loan.loan_amnt * 0.5

    remaining_months_current = max(loan.term - paid_count, 1)
    new_tenure = remaining_months_current + extend_months
    new_rate = max(loan.int_rate - rate_reduction, 5.0)  # floor at 5%

    # Calculate new EMI
    r = new_rate / 100 / 12
    n = new_tenure
    if r > 0:
        new_emi = (remaining_principal * r * (1 + r) ** n) / ((1 + r) ** n - 1)
    else:
        new_emi = remaining_principal / n

    current_emi = loan.installment + (loan.emi_adjustment or 0)
    emi_drop = current_emi - new_emi
    emi_drop_pct = (emi_drop / current_emi * 100) if current_emi > 0 else 0

    # Total interest cost comparison
    current_total = current_emi * remaining_months_current
    new_total = new_emi * new_tenure

    return {
        "current_emi": round(current_emi, 2),
        "current_remaining_months": remaining_months_current,
        "current_rate": round(loan.int_rate, 2),
        "remaining_principal": round(remaining_principal, 2),
        "new_emi": round(new_emi, 2),
        "new_tenure": new_tenure,
        "new_rate": round(new_rate, 2),
        "emi_drop": round(emi_drop, 2),
        "emi_drop_pct": round(emi_drop_pct, 1),
        "extra_months": extend_months,
        "rate_reduction": rate_reduction,
        "current_total_payable": round(current_total, 2),
        "new_total_payable": round(new_total, 2),
        "extra_interest_cost": round(new_total - current_total, 2)  # if positive, borrower pays more total but smaller EMI
    }


@app.post("/analyst/apply-restructure/{loan_id}")
def apply_restructure(loan_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Actually apply the restructuring to a loan"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    extend_months = int(data.get("extend_months", 0))
    rate_reduction = float(data.get("rate_reduction", 0))
    reason = (data.get("reason") or "").strip()

    if extend_months < 0 or extend_months > 60:
        return {"error": "Tenure extension must be 0-60 months"}
    if rate_reduction < 0 or rate_reduction > 5:
        return {"error": "Rate reduction must be 0-5%"}
    if not reason or len(reason) < 10:
        return {"error": "Please provide a reason (at least 10 characters)"}

    session = Session()
    try:
        loan = session.query(Loan).filter(Loan.id == loan_id).first()
        if not loan:
            session.close()
            return {"error": "Loan not found"}
        if loan.status != "active":
            session.close()
            return {"error": "Can only restructure active loans"}

        paid_count = session.query(Payment).filter(
            Payment.loan_id == loan_id,
            Payment.status == "paid"
        ).count()
        total_paid = session.query(func.sum(Payment.amount)).filter(
            Payment.loan_id == loan_id,
            Payment.status == "paid"
        ).scalar() or 0

        remaining_principal = max(loan.loan_amnt - total_paid, loan.loan_amnt * 0.5)
        new_tenure_total = loan.term + extend_months
        new_rate = max(loan.int_rate - rate_reduction, 5.0)

        # Recalculate EMI for remaining
        remaining_months = max(loan.term - paid_count, 1) + extend_months
        r = new_rate / 100 / 12
        n = remaining_months
        if r > 0:
            new_emi = (remaining_principal * r * (1 + r) ** n) / ((1 + r) ** n - 1)
        else:
            new_emi = remaining_principal / n
        new_emi = round(new_emi, 2)

        # Apply changes
        loan.term = new_tenure_total
        loan.int_rate = new_rate
        loan.installment = new_emi
        # Reset carry-over since EMI is recalculated
        loan.emi_adjustment = 0
        loan.carryover_balance = 0
        session.commit()

        # Notify borrower
        user = session.query(User).filter(User.id == loan.user_id).first()
        create_notification(
            session, loan.user_id,
            "🔄 Your loan has been restructured",
            f"Good news — your {loan.purpose} loan has been restructured. New EMI: ₹{new_emi:,.0f}, tenure: {new_tenure_total} months. Reason: {reason[:60]}",
            "success",
            f"/loan/{loan.id}"
        )

        # Email the borrower
        if user:
            try:
                email_html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1a7a3c; color: white; padding: 24px;">
                        <h1 style="margin: 0;">🔄 Loan Restructured</h1>
                    </div>
                    <div style="padding: 24px; background: #f7f8fc;">
                        <p>Hi {user.name},</p>
                        <p>Good news — your {loan.purpose} loan has been restructured to give you more breathing room:</p>
                        <table style="width: 100%; background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
                            <tr><td style="padding: 8px; color: #8892a4;">New EMI</td><td style="padding: 8px; font-weight: 600;">₹{new_emi:,.0f}</td></tr>
                            <tr><td style="padding: 8px; color: #8892a4;">New Tenure</td><td style="padding: 8px; font-weight: 600;">{new_tenure_total} months</td></tr>
                            <tr><td style="padding: 8px; color: #8892a4;">New Interest Rate</td><td style="padding: 8px; font-weight: 600;">{new_rate}%</td></tr>
                        </table>
                        <p><b>Reason:</b> {reason}</p>
                        <p>Your next EMI will reflect the new amount. If you have questions, reply to this email or raise a ticket on LoanSense.</p>
                    </div>
                </div>
                """
                send_email(user.email, "🔄 Your loan has been restructured", email_html)
            except Exception as e:
                print(f"Email failed: {e}")

        session.close()
        return {
            "success": True,
            "new_emi": new_emi,
            "new_tenure": new_tenure_total,
            "new_rate": new_rate,
            "message": "Loan restructured successfully"
        }
    except Exception as e:
        session.close()
        return {"error": str(e)}

# ============== EMI DATE CHANGE (Phase 9) ==============

@app.post("/request-emi-date-change/{loan_id}")
def request_emi_date_change(loan_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Borrower requests a permanent change to their EMI due day"""
    requested_day = int(data.get("requested_due_day", 0))
    reason = (data.get("reason") or "").strip()

    if requested_day < 1 or requested_day > 28:
        return {"error": "EMI due day must be between 1 and 28"}
    if not reason or len(reason) < 10:
        return {"error": "Please provide a reason (at least 10 characters)"}

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
            return {"error": "Can only change date for active loans"}

        current_day = loan.emi_due_day or 1
        if requested_day == current_day:
            session.close()
            return {"error": f"Loan is already due on day {current_day}"}

        # Check for existing pending request
        existing = session.query(EMIDateChangeRequest).filter(
            EMIDateChangeRequest.loan_id == loan_id,
            EMIDateChangeRequest.status == "pending"
        ).first()
        if existing:
            session.close()
            return {"error": "You already have a pending date change request for this loan"}

        req = EMIDateChangeRequest(
            loan_id=loan_id,
            user_id=current_user["user_id"],
            current_due_day=current_day,
            requested_due_day=requested_day,
            reason=reason,
            status="pending"
        )
        session.add(req)
        session.commit()

        user = session.query(User).filter(User.id == current_user["user_id"]).first()
        notify_all_analysts(
            session,
            "📅 EMI date change request",
            f"{user.name if user else 'A borrower'} requested EMI date change from day {current_day} to day {requested_day} on {loan.purpose} loan",
            "info",
            "/dashboard"
        )

        session.close()
        return {"success": True, "message": f"Request submitted. Bank will review your request to shift EMI from day {current_day} to day {requested_day}."}
    except Exception as e:
        session.close()
        return {"error": str(e)}


@app.get("/my-date-change-requests")
def my_date_change_requests(current_user: dict = Depends(get_current_user)):
    """Borrower fetches their own date change requests"""
    session = Session()
    reqs = session.query(EMIDateChangeRequest).filter(
        EMIDateChangeRequest.user_id == current_user["user_id"]
    ).order_by(EMIDateChangeRequest.created_at.desc()).all()

    result = []
    for r in reqs:
        loan = session.query(Loan).filter(Loan.id == r.loan_id).first()
        result.append({
            "id": r.id,
            "loan_id": r.loan_id,
            "loan_purpose": loan.purpose if loan else "unknown",
            "current_due_day": r.current_due_day,
            "requested_due_day": r.requested_due_day,
            "reason": r.reason,
            "status": r.status,
            "decision_reason": r.decision_reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "decided_at": r.decided_at.isoformat() if r.decided_at else None
        })
    session.close()
    return result


@app.get("/analyst/pending-date-changes")
def pending_date_changes(current_user: dict = Depends(get_current_user)):
    """Analyst view: all pending EMI date change requests"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    session = Session()
    reqs = session.query(EMIDateChangeRequest).filter(
        EMIDateChangeRequest.status == "pending"
    ).order_by(EMIDateChangeRequest.created_at.desc()).all()

    result = []
    for r in reqs:
        loan = session.query(Loan).filter(Loan.id == r.loan_id).first()
        user = session.query(User).filter(User.id == r.user_id).first()
        result.append({
            "id": r.id,
            "loan_id": r.loan_id,
            "loan_purpose": loan.purpose if loan else "unknown",
            "loan_amnt": loan.loan_amnt if loan else 0,
            "installment": loan.installment if loan else 0,
            "borrower_name": user.name if user else "Unknown",
            "borrower_email": user.email if user else "",
            "current_due_day": r.current_due_day,
            "requested_due_day": r.requested_due_day,
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    session.close()
    return result


@app.post("/analyst/decide-date-change/{request_id}")
def decide_date_change(request_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Analyst approves or rejects an EMI date change request"""
    if current_user.get("role") != "analyst":
        return {"error": "Not authorized"}

    decision = data.get("decision")  # "approve" or "reject"
    decision_reason = (data.get("decision_reason") or "").strip()
    if decision not in ["approve", "reject"]:
        return {"error": "Decision must be 'approve' or 'reject'"}
    if decision == "reject" and len(decision_reason) < 10:
        return {"error": "Please provide a reason for rejection (at least 10 characters)"}

    session = Session()
    try:
        req = session.query(EMIDateChangeRequest).filter(
            EMIDateChangeRequest.id == request_id,
            EMIDateChangeRequest.status == "pending"
        ).first()
        if not req:
            session.close()
            return {"error": "Request not found or already decided"}

        loan = session.query(Loan).filter(Loan.id == req.loan_id).first()
        user = session.query(User).filter(User.id == req.user_id).first()

        new_status = "approved" if decision == "approve" else "rejected"
        req.status = new_status
        req.decided_by = current_user["user_id"]
        req.decided_at = datetime.utcnow()
        req.decision_reason = decision_reason if decision_reason else ("Approved by analyst" if decision == "approve" else "Rejected by analyst")

        if decision == "approve" and loan:
            # Apply the date change
            loan.emi_due_day = req.requested_due_day
            # Adjust reviewed_at so the next EMI calculation aligns with the new day
            # Strategy: shift reviewed_at's day-of-month to match new emi_due_day
            from datetime import timedelta
            if loan.reviewed_at:
                old_day = loan.reviewed_at.day
                day_diff = req.requested_due_day - old_day
                # If new day is earlier in month, shift forward to next month
                if day_diff < 0:
                    day_diff += 30  # rough shift to next month equivalent
                loan.reviewed_at = loan.reviewed_at + timedelta(days=day_diff)

        session.commit()

        # Notify borrower
        if decision == "approve":
            create_notification(
                session, req.user_id,
                "✓ EMI date change approved",
                f"Your {loan.purpose if loan else ''} loan EMI will now be due on day {req.requested_due_day} of each month going forward.",
                "success",
                f"/loan/{req.loan_id}"
            )
            email_subject = "✓ Your EMI date change has been approved"
            email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a7a3c; color: white; padding: 24px;">
                    <h1 style="margin: 0;">✓ EMI Date Changed</h1>
                </div>
                <div style="padding: 24px; background: #f7f8fc;">
                    <p>Hi {user.name if user else ''},</p>
                    <p>Good news — your request to change your EMI due date has been <b>approved</b>.</p>
                    <table style="width: 100%; background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
                        <tr><td style="padding: 8px; color: #8892a4;">Loan</td><td style="padding: 8px; font-weight: 600;">{loan.purpose if loan else ''} (#{req.loan_id})</td></tr>
                        <tr><td style="padding: 8px; color: #8892a4;">Old due day</td><td style="padding: 8px;">{req.current_due_day} of each month</td></tr>
                        <tr><td style="padding: 8px; color: #8892a4;">New due day</td><td style="padding: 8px; font-weight: 600; color: #1a7a3c;">{req.requested_due_day} of each month</td></tr>
                    </table>
                    <p>This change takes effect from your next EMI cycle.</p>
                </div>
            </div>
            """
        else:
            create_notification(
                session, req.user_id,
                "✗ EMI date change rejected",
                f"Your request to shift EMI to day {req.requested_due_day} was rejected. Reason: {decision_reason[:80]}",
                "error",
                f"/loan/{req.loan_id}"
            )
            email_subject = "EMI date change request — update"
            email_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #c0392b; color: white; padding: 24px;">
                    <h1 style="margin: 0;">EMI Date Change — Not Approved</h1>
                </div>
                <div style="padding: 24px; background: #f7f8fc;">
                    <p>Hi {user.name if user else ''},</p>
                    <p>Your request to change your EMI due date to day {req.requested_due_day} was not approved.</p>
                    <p><b>Reason:</b> {decision_reason}</p>
                    <p>You can raise a support ticket to discuss alternative options.</p>
                </div>
            </div>
            """

        if user:
            try:
                send_email(user.email, email_subject, email_html)
            except Exception as e:
                print(f"Email failed: {e}")

        session.close()
        return {"success": True, "decision": decision, "message": f"Request {decision}d"}
    except Exception as e:
        session.close()
        return {"error": str(e)}
