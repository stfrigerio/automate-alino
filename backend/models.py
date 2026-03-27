from pydantic import BaseModel


class FileResult(BaseModel):
    id: str
    filename: str
    category: str


class ConfirmRequest(BaseModel):
    results: list[FileResult]
