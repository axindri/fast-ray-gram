from pydantic import BaseModel, Field

from src.core.enums import Role
from src.models.tw import InvoiceResponse


class CreateUserRequest(BaseModel):
    username: str
    role: Role = Field(default=Role.USER)
    mark: str = Field(default="")
    flow: str = Field(default="")
    limit_ips: int = Field(default=0)
    total_gb: float = Field(default=0)
    enable: bool = Field(default=True)
    expiry_time_days: int = Field(default=0)


class UserProfileResponse(BaseModel):
    id: int
    username: str
    role: Role = Field(default=Role.USER)
    sub_url: str = Field(default="")
    invoices: list[InvoiceResponse]


class AdminUserResponse(BaseModel):
    id: int
    username: str
    role: Role = Field(default=Role.USER)
    mark: str = Field(default="")
    sub_url: str = Field(default="")

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    username: str
    role: Role = Field(default=Role.USER)
    sub_url: str = Field(default="")

    class Config:
        from_attributes = True
