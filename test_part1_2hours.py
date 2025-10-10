# Quick test with 2-hour window
import os
os.environ['NEWSAPI_KEY'] = '7fb51168f0cf4b1699ffa85757806421'
os.environ['CLAUDE_API_KEY'] = 'sk-ant-api03-nJ7MtEjFU_JKW7VXNBI3kpI-hR82p9DYiRZ6L2rrnlwwx4a0Cpe0n8c0xYI1FwPaWU_OzXIbdoxRzD-MRvGz0g-FYd5OQAA'
os.environ['GOOGLE_API_KEY'] = 'AIzaSyA7uBIfcQ3RQNtlW-DXCxhfQckwUDKBmkw'

from news-part1-breaking import *

# Override time window for testing
import json
from datetime import datetime, timedelta
test_time = datetime.now() - timedelta(hours=2)
with open('part1_last_run.json', 'w') as f:
    json.dump({'last_run': test_time.isoformat()}, f)

# Run the generator
generate_part1_breaking_news()
