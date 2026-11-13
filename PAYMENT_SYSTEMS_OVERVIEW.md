# Progeni Atlas Payment Systems Overview

## 📊 Core Billing Philosophy

Progeni Atlas operates on a **credit-based billing model** where:

- **1 credit = 1 INR** (Indian Rupee)
- **1 Rupee = 2 minutes** of interview time
- **0.5 credits deducted per minute** of interview consumption

This means:
- A 30-minute interview costs **15 credits (₹15)**
- A 60-minute interview costs **30 credits (₹30)**
- Users purchase credits upfront, and credits are debited as interviews are conducted

## 💳 Payment Methods Supported

The system integrates payment gateways to allow users to purchase credit packages. The specific gateway implementations are handled server-side and are abstracted from the core billing logic. Payment methods enable:

- Credit package purchases (users buy credits to their wallet)
- Interview session billing (credits deducted per minute of usage)
- Transaction ledger recording (immutable history of all credits added/spent)

## 🔧 Billing Rate Enforcement

The **0.5 credits/minute** rate is authoritative and enforced at multiple levels:

| Layer | Location | Purpose |
|-------|----------|---------|
| **Database** | `backend/core/wallet.py:84` | Comment documenting the rate |
| **Wallet Init** | `backend/routes/billing_routes.py:112-115` | Ensures `ratePerMinuteCredits` = 0.5 on wallet creation |
| **Balance Lookup** | `backend/core/wallet.py:29` | Returns `max(0.0, bal)` - never negative |
| **Interview Settlement** | `backend/core/wallet.py:91` | `cost = 0.0 if is_demo else round(duration_minutes * 0.5, 2)` |
| **Transaction Ledger** | `backend/routes/billing_routes.py:259` | `running_balance = max(0.0, running_balance + amt)` - balance guaranteed >= 0 |

## 📈 Profit & Loss Analysis Per User

The platform's profitability per user depends on the relationship between **credits purchased** vs. **credits consumed** through interviews.

### Cost Formula:
```
Cost in credits = duration_minutes × 0.5
Cost in INR = duration_minutes × 0.5  (since 1 credit = 1 INR)
```

### Profit/Loss Calculation:
```
Profit/Loss = Credits Purchased - Credits Consumed
            = (Amount Paid in INR) - (Total Interview Minutes × 0.5)
```

### Example Scenarios:

| Scenario | Credits Purchased | Interview Minutes Used | Credits Consumed | Profit/Loss |
|----------|-------------------|------------------------|------------------|-------------|
| **User A** | 100 INR (100 credits) | 150 minutes | 75 credits | **+25 credits (₹25 profit)** |
| **User B** | 100 INR (100 credits) | 200 minutes | 100 credits | **0 (break-even)** |
| **User C** | 100 INR (100 credits) | 250 minutes | 125 credits | **-25 credits (₹25 loss)** |
| **User D** | 500 INR (500 credits) | 800 minutes | 400 credits | **+100 credits (₹100 profit)** |
| **User E** | 500 INR (500 credits) | 1200 minutes | 600 credits | **-100 credits (₹100 loss)** |

### Key Observations:

1. **Platform breaks even** when total consumed credits = total purchased credits
2. **Platform profits** when users purchase more credits than they consume (common - some users buy but don't use all minutes)
3. **Platform loses** when users consume more credits than they purchased (rare, as negative balance is prevented)
4. **Demo sessions** cost 0 credits (flagged as `is_demo = true`), which can increase user acquisition but decrease per-user realization

### Aggregated View (across all users):

To calculate total platform profit:
```
Total Profit = Σ(Credits Purchased by all users) - Σ(Credits Consumed by all users)
```

The ledger in `backend/routes/billing_routes.py:get_billing_wallet_transactions()` provides the data needed for this aggregation:
- `totalCredited`: Sum of all credit additions (from payments)
- `totalDebited`: Sum of all credit deductions (from interview settlements)
- `count`: Number of transactions

**Platform is profitable when `totalCredited > totalDebited`** across the user base.

## 🛠️ Files Maintaining the Billing Rate

| File | Lines | What It Does |
|------|-------|--------------|
| `backend/core/wallet.py` | 84, 29-32 | Documents and enforces `ratePerMinuteCredits = 0.5`; guarantees balance >= 0 |
| `backend/routes/billing_routes.py` | 85, 112-118, 135 | Sets `ratePerMinuteCredits = 0.5` on wallet creation/updates |
| `backend/core/shadow_metering.py` | 93, 97 | References INR rates (assumption-based, not live FX) |
| `backend/routes/super_admin_routes.py` | 1610 | Includes `ratePerMinuteCredits: 0.5` in super-admin responses |

## 💡 Recommendations for Profit Optimization

1. **Minimum recharge amount** enforced at `backend/routes/billing_routes.py:429` (`amount_inr < 1.0` returns 400 error)
2. **Low balance threshold** at 5 credits (₹5) - users are prompted to recharge when balance is low
3. **Demo quota system** (`backend/routes/billing_routes.py:get_billing_wallet_transactions()`) gives 2 free demos, acquiring users at 0 cost
4. **Automatic balance sync** from org billing accounts ensures recruiter wallets never go negative