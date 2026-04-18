from sqlalchemy import Column, String
from models.base import Base

class Album(Base):
    __tablename__ = "albums"

    id = Column(String, primary_key=True)
    name = Column(String)
    release_date = Column(String)
    image_url = Column(String)
    type = Column(String)
