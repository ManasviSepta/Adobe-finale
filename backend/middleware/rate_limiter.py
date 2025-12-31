from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

def create_rate_limiter():
    # Temporarily increase rate limit for testing
    return Limiter(key_func=get_remote_address, default_limits=["1000 per 15 minutes"])
