from enum import StrEnum

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SLOT_IN_PAST = "SLOT_IN_PAST"
    SLOT_ALREADY_BOOKED = "SLOT_ALREADY_BOOKED"
    APPOINTMENT_NOT_CANCELLABLE = "APPOINTMENT_NOT_CANCELLABLE"
    APPOINTMENT_NOT_RESCHEDULABLE = "APPOINTMENT_NOT_RESCHEDULABLE"
    NOT_FOUND = "NOT_FOUND"
    IDENTITY_NOT_VERIFIED = "IDENTITY_NOT_VERIFIED"
    PRESCRIPTION_NOT_REFILLABLE = "PRESCRIPTION_NOT_REFILLABLE"
    NO_REFILLS_REMAINING = "NO_REFILLS_REMAINING"


DEFAULT_STATUS: dict[ErrorCode, int] = {
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.SLOT_IN_PAST: 422,
    ErrorCode.SLOT_ALREADY_BOOKED: 409,
    ErrorCode.APPOINTMENT_NOT_CANCELLABLE: 409,
    ErrorCode.APPOINTMENT_NOT_RESCHEDULABLE: 409,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.IDENTITY_NOT_VERIFIED: 401,
    ErrorCode.PRESCRIPTION_NOT_REFILLABLE: 409,
    ErrorCode.NO_REFILLS_REMAINING: 409,
}


class ErrorDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: ErrorCode
    message: str
    field: str | None = None


class ErrorEnvelope(BaseModel):
    """The single response shape for every non-2xx response."""

    model_config = ConfigDict(populate_by_name=True)

    error: ErrorDetail


class ApiError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        field: str | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field
        self.status_code = status_code if status_code is not None else DEFAULT_STATUS[code]

    def to_response(self) -> JSONResponse:
        return error_response(self.status_code, self.code, self.message, self.field)


def error_response(
    status_code: int,
    code: ErrorCode,
    message: str,
    field: str | None = None,
) -> JSONResponse:
    envelope = ErrorEnvelope(error=ErrorDetail(code=code, message=message, field=field))
    return JSONResponse(status_code=status_code, content=envelope.model_dump(mode="json"))


def validation_error(message: str, field: str | None = None) -> ApiError:
    return ApiError(ErrorCode.VALIDATION_ERROR, message, field)


def not_found(message: str, field: str | None = None) -> ApiError:
    return ApiError(ErrorCode.NOT_FOUND, message, field)


def _field_from_loc(loc: tuple[object, ...]) -> str | None:
    """Pick the client-meaningful name out of a pydantic error location tuple.

    Locations look like ("body", "reason") or ("query", "status", 0); the first
    element names the request part, so the last string segment is the field.
    """
    for part in reversed(loc):
        if isinstance(part, str) and part not in {"body", "query", "path", "header", "cookie"}:
            return part
    return None


def _message_from_request_validation(exc: RequestValidationError) -> tuple[str, str | None]:
    errors = exc.errors()
    if not errors:
        return "The request could not be understood.", None

    first = errors[0]
    field = _field_from_loc(tuple(first.get("loc", ())))
    error_type = str(first.get("type", ""))

    if error_type == "missing":
        label = field or "A required value"
        return f"{label} is required.", field
    if error_type in {"json_invalid", "model_attributes_type"}:
        return "The request body must be a JSON object.", field

    reason = str(first.get("msg", "is not valid"))
    if field:
        return f"{field} is not valid: {reason}", field
    return f"The request is not valid: {reason}", None


_HTTP_STATUS_MESSAGES: dict[int, str] = {
    404: "We could not find what you were looking for.",
    405: "That action is not supported for this resource.",
    422: "The request could not be processed.",
}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return exc.to_response()

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        message, field = _message_from_request_validation(exc)
        return error_response(422, ErrorCode.VALIDATION_ERROR, message, field)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = ErrorCode.NOT_FOUND if exc.status_code == 404 else ErrorCode.VALIDATION_ERROR
        detail = exc.detail if isinstance(exc.detail, str) and exc.detail else None
        message = detail or _HTTP_STATUS_MESSAGES.get(
            exc.status_code, "The request could not be processed."
        )
        return error_response(exc.status_code, code, message)
