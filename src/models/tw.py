from datetime import datetime

from pydantic import BaseModel, Field


class FinancesResponse(BaseModel):
    balance: float
    currency: str
    monthly_cost: float
    total_paid: float
    hours_left: int

    class Config:
        from_attributes = True


class NewInvoiceRequest(BaseModel):
    amount: int = Field(default=50, ge=50, le=1000)
    return_url: str
    fail_url: str


class InvoiceResponse(BaseModel):
    invoice_id: int
    user_id: int
    payment_uuid: str
    confirmation_url: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    date: datetime
    description: str
    invoice: int
    payment_type: str
    sum: float
    type: str
    vds_id: int

    class Config:
        from_attributes = True
