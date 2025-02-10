from fastapi import FastAPI, Request
import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path to import main app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from main import app
    logger.info("Successfully imported main app")
except Exception as e:
    logger.error(f"Failed to import main app: {str(e)}")
    raise

# Export for Vercel
import mangum
handler = mangum.Mangum(app)
logger.info("Successfully initialized Mangum handler")

# Add error logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        response = await call_next(request)
        logger.info(f"Path: {request.url.path} | Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise 