from enum import StrEnum, auto


class Role(StrEnum):
    SUPERUSER = auto()
    ADMIN = auto()
    USER = auto()


class ServiceStatus(StrEnum):
    OK = auto()
    WARNING = auto()
    ERROR = auto()


class InvoiceStatus(StrEnum):
    PENDING = auto()
    PAID = auto()
    CANCELLED = auto()
