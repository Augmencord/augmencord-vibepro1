import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
# Format: { 'timestamp': float, 'data': list }
cache = {
    'timestamp': 0,
    'data': None
}
CACHE_DURATION = 1800  # 30 minutes in seconds

class MLStripper(HTMLParser):
    """Simple HTML parser to strip tags for plain-text extraction."""
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []

    def handle_data(self, d):
        self.text.append(d)

    def get_data(self):
        return ''.join(self.text)

def strip_tags(html):
    """Strip HTML tags and return plain text."""
    try:
        s = MLStripper()
        s.feed(html)
        return s.get_data()
    except Exception:
        # Fallback regex if HTMLParser fails
        return re.sub(r'<[^>]*>', '', html)

def fetch_and_parse_feed():
    """Fetch the BigQuery release notes feed and parse it into structured JSON."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    req = urllib.request.Request(FEED_URL, headers=headers)
    
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    parsed_updates = []
    
    for entry in root.findall('atom:entry', ns):
        entry_title = entry.find('atom:title', ns).text  # e.g., "June 15, 2026"
        entry_updated = entry.find('atom:updated', ns).text
        entry_link_el = entry.find('atom:link', ns)
        entry_link = entry_link_el.attrib.get('href', '') if entry_link_el is not None else ''
        entry_id = entry.find('atom:id', ns).text
        content_el = entry.find('atom:content', ns)
        
        if content_el is None or not content_el.text:
            continue
            
        content = content_el.text
        # Split entry content into individual updates by searching for <h3> headings
        sections = re.split(r'(?=<h3[^>]*>)', content)
        
        update_idx = 0
        for section in sections:
            section = section.strip()
            if not section:
                continue
                
            # Parse the type of update from the h3 tag
            type_match = re.search(r'<h3[^>]*>(.*?)</h3>', section, re.DOTALL | re.IGNORECASE)
            if type_match:
                update_type = type_match.group(1).strip()
                # Extract the rest of the text/html after the heading
                update_html = re.sub(r'<h3[^>]*>.*?</h3>', '', section, count=1, flags=re.DOTALL | re.IGNORECASE).strip()
            else:
                update_type = "Update"
                update_html = section
            
            # Create a plain-text version for tweeting
            plain_text = strip_tags(update_html)
            # Clean up white spaces
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            
            # Format and append
            parsed_updates.append({
                'id': f"{entry_id}_{update_idx}",
                'date': entry_title,
                'updated': entry_updated,
                'link': entry_link,
                'type': update_type,
                'html': update_html,
                'text': plain_text
            })
            update_idx += 1
            
    return parsed_updates

@app.route('/')
def index():
    """Render the main UI page."""
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    """API endpoint to get release notes. Supports force-refresh."""
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is valid
    if not force_refresh and cache['data'] is not None and (current_time - cache['timestamp'] < CACHE_DURATION):
        return jsonify({
            'success': True,
            'source': 'cache',
            'last_fetched': cache['timestamp'],
            'data': cache['data']
        })
        
    try:
        data = fetch_and_parse_feed()
        cache['data'] = data
        cache['timestamp'] = current_time
        return jsonify({
            'success': True,
            'source': 'network',
            'last_fetched': current_time,
            'data': data
        })
    except Exception as e:
        # If network call fails but we have cached data, return cached data as a fallback
        if cache['data'] is not None:
            return jsonify({
                'success': True,
                'source': 'cache_fallback',
                'error': str(e),
                'last_fetched': cache['timestamp'],
                'data': cache['data']
            })
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
