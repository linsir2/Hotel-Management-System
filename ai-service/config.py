from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "hotel_db"
    db_user: str = "ai_reader"
    db_password: str = "ai_reader_pass"

    splade_model: str = "naver/splade-cocondenser-ensembledistil"
    ai_service_port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
