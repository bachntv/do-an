from sqlalchemy import Column, String, Integer
from models.base import Base

class Artist(Base):
    __tablename__ = "artists"

    id = Column(String, primary_key=True)
    name = Column(String)
    followers = Column(Integer)
    image_url = Column(String)