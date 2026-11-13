class DomainError(Exception):
    def __init__(self, status: int, message: str, code: str = "REQUEST_REJECTED"):
        self.status, self.message, self.code = status, message, code


def require(condition, message="Resource not found", status=404, code="REQUEST_REJECTED"):
    if not condition:
        raise DomainError(status, message, code)
