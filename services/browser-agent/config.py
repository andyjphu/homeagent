import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
MAX_CONCURRENT_TASKS = int(os.getenv("MAX_CONCURRENT_TASKS", "3"))

# Research pipeline settings
DEFAULT_SEARCH_DELAY_SECONDS = int(os.getenv("DEFAULT_SEARCH_DELAY_SECONDS", "2"))
MAX_DETAIL_PAGES = int(os.getenv("MAX_DETAIL_PAGES", "15"))
MAX_SEARCH_PAGES = int(os.getenv("MAX_SEARCH_PAGES", "3"))
