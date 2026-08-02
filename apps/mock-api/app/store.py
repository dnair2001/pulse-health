import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from pydantic import ValidationError

from app.config import settings
from app.domain.models import StoreData
from app.seed import build_seed


class Store:
    """File-backed JSON store.

    Reads hand out deep copies and writes go through `transaction`, so callers
    can never leave the in-memory state half-updated or out of sync with disk.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._data = self._load_or_seed()

    @property
    def path(self) -> Path:
        return self._path

    def _load_or_seed(self) -> StoreData:
        if self._path.exists():
            try:
                return StoreData.model_validate_json(self._path.read_text(encoding="utf-8"))
            except ValidationError:
                # A store written by an older shape is worthless for a mock API;
                # rebuilding beats failing every request at startup.
                pass
        data = build_seed()
        self._write(data)
        return data

    def _write(self, data: StoreData) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_name(f"{self._path.name}.{os.getpid()}.tmp")
        temp_path.write_text(data.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
        os.replace(temp_path, self._path)

    def read(self) -> StoreData:
        with self._lock:
            return self._data.model_copy(deep=True)

    @contextmanager
    def transaction(self) -> Iterator[StoreData]:
        with self._lock:
            working = self._data.model_copy(deep=True)
            yield working
            self._data = working
            self._write(working)

    def reset(self) -> StoreData:
        with self._lock:
            self._data = build_seed()
            self._write(self._data)
            return self._data.model_copy(deep=True)


_store: Store | None = None
_store_lock = threading.Lock()


def get_store() -> Store:
    global _store
    with _store_lock:
        if _store is None:
            _store = Store(Path(settings.store_path))
        return _store


def set_store(store: Store | None) -> None:
    global _store
    with _store_lock:
        _store = store
