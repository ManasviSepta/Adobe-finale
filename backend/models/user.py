from .database import db
from datetime import datetime
from passlib.hash import bcrypt

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False)
    name = db.Column(db.String, nullable=False)
    password_hash = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @staticmethod
    def create(email, name, password):
        return User(
            email=email,
            name=name,
            password_hash=bcrypt.hash(password)
        )
    def verify_password(self, password):
        return bcrypt.verify(password, self.password_hash)
