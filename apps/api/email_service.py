import resend
import os
from dotenv import load_dotenv
load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = "LoanSense <onboarding@resend.dev>"  # Resend's test sender — works without domain verification

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success."""
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not configured")
        return False
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html
        })
        return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


def email_template(title: str, name: str, body: str, cta_text: str = None, cta_url: str = None) -> str:
    """Generate a clean HTML email template"""
    cta_html = ""
    if cta_text and cta_url:
        cta_html = f"""
        <a href="{cta_url}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;
           border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:12px;">
          {cta_text}
        </a>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f8fc;margin:0;padding:40px 20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;border:1px solid #eaedf3;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <div style="width:36px;height:36px;background:#1a1a2e;border-radius:9px;display:inline-block;text-align:center;line-height:36px;color:#fff;font-weight:700;">L</div>
          <span style="font-size:18px;font-weight:600;color:#1a1a2e;">LoanSense</span>
        </div>
        <h2 style="font-size:22px;font-weight:600;color:#1a1a2e;margin:0 0 14px;">{title}</h2>
        <p style="font-size:14px;color:#5a6378;line-height:1.6;margin:0 0 16px;">Hi {name},</p>
        <div style="font-size:14px;color:#5a6378;line-height:1.6;">{body}</div>
        {cta_html}
        <hr style="border:none;border-top:1px solid #eaedf3;margin:32px 0 16px;" />
        <p style="font-size:12px;color:#8892a4;margin:0;">
          This is an automated message from LoanSense, your AI-powered loan platform.
        </p>
      </div>
    </body>
    </html>
    """


def loan_approved_email(name: str, purpose: str, amount: float, emi: float) -> dict:
    return {
        "subject": f"✓ Your {purpose.title()} Loan has been approved!",
        "html": email_template(
            title=f"Your loan is approved 🎉",
            name=name,
            body=f"""
            <p>Great news! Your <b>{purpose.title()} Loan</b> application for <b>₹{amount:,.0f}</b> has been approved by our team.</p>
            <p>Your monthly EMI will be <b>₹{emi:,.0f}</b>. The amount will be disbursed to your account shortly.</p>
            """,
            cta_text="View loan details",
            cta_url="http://localhost:3000/portal"
        )
    }


def loan_rejected_email(name: str, purpose: str, amount: float, reason: str) -> dict:
    return {
        "subject": f"Update on your {purpose.title()} Loan application",
        "html": email_template(
            title="Application update",
            name=name,
            body=f"""
            <p>Thank you for applying for a <b>{purpose.title()} Loan</b> of <b>₹{amount:,.0f}</b>.</p>
            <p>After careful review, we're unable to approve this application at this time.</p>
            <p><b>Reason:</b> {reason}</p>
            <p>You're welcome to reapply in the future. If you have questions, our support team is here to help.</p>
            """
        )
    }


def loan_disbursed_email(name: str, purpose: str, amount: float, emi: float) -> dict:
    return {
        "subject": f"💰 ₹{amount:,.0f} disbursed for your {purpose.title()} Loan",
        "html": email_template(
            title="Loan amount disbursed",
            name=name,
            body=f"""
            <p>Your <b>{purpose.title()} Loan</b> amount of <b>₹{amount:,.0f}</b> has been disbursed successfully.</p>
            <p>Your first EMI of <b>₹{emi:,.0f}</b> will be due next month. You can pay anytime from your portal.</p>
            """,
            cta_text="Pay EMI",
            cta_url="http://localhost:3000/portal"
        )
    }


def payment_success_email(name: str, amount: float, purpose: str) -> dict:
    return {
        "subject": f"✓ EMI payment of ₹{amount:,.0f} received",
        "html": email_template(
            title="Payment received",
            name=name,
            body=f"""
            <p>We've received your EMI payment of <b>₹{amount:,.0f}</b> for your <b>{purpose.title()} Loan</b>.</p>
            <p>Thank you for staying on track with your payments. This helps maintain a healthy credit profile.</p>
            """,
            cta_text="View payment history",
            cta_url="http://localhost:3000/portal"
        )
    }


def deferral_decision_email(name: str, decision: str, months: int, note: str) -> dict:
    if decision == "approved":
        return {
            "subject": f"✓ Your deferral request has been approved",
            "html": email_template(
                title="Deferral approved",
                name=name,
                body=f"""
                <p>Your request to defer EMI payments for <b>{months} month(s)</b> has been approved.</p>
                {f'<p><b>Bank note:</b> {note}</p>' if note else ''}
                <p>You won't need to make EMI payments during the deferral period. Normal payments resume after.</p>
                """,
                cta_text="View loan",
                cta_url="http://localhost:3000/portal"
            )
        }
    else:
        return {
            "subject": "Update on your deferral request",
            "html": email_template(
                title="Deferral request update",
                name=name,
                body=f"""
                <p>We've reviewed your request to defer EMI payments for <b>{months} month(s)</b>.</p>
                <p>Unfortunately, we're unable to approve this request at this time.</p>
                {f'<p><b>Bank note:</b> {note}</p>' if note else ''}
                <p>If your situation changes or you have questions, please reach out to our support team.</p>
                """
            )
        }