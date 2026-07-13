import re
import os

emoji_to_lucide = {
    "📦": "package", "📍": "map-pin", "📞": "phone", "💬": "message-circle",
    "🚚": "truck", "🏠": "house", "🏢": "building-2", "🛡️": "shield-check",
    "✅": "badge-check", "💳": "credit-card", "📄": "file-text", "👤": "user-round",
    "📅": "calendar-days", "⏰": "clock-3", "Navigation": "navigation",
    "⭐": "star", "🚛": "truck", "❌": "x", "✔️": "check", "🎉": "party-popper",
    "🚪": "log-out", "📋": "clipboard-list", "🔐": "lock", "✉️": "mail",
    "💰": "indian-rupee", "🔧": "wrench", "🔔": "bell", "💡": "lightbulb",
    "⚠️": "triangle-alert", "Bike": "bike", "Car": "car", "Warehouse": "warehouse",
    "🛋️": "sofa", "📺": "tv", "🏍️": "bike", "🏡": "home", "🏘️": "home",
    "🏰": "castle", "🏯": "castle", "🌇": "building", "💼": "briefcase",
    "🏬": "store", "🏭": "factory", "★": "star", "☆": "star", "✓": "check", "✕": "x",
    "📧": "mail", "🏁": "flag", "🔑": "key", "🌙": "moon", "☀️": "sun", "🚀": "rocket",
    "✨": "sparkles", "🛠️": "wrench", "📸": "camera", "🚧": "cone", "❤️": "heart"
}
def get_lucide(emoji): return emoji_to_lucide.get(emoji, "circle")
emoji_pattern = re.compile(r'(?:[\U0001F300-\U0001F5FF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\u2600-\u26FF\u2700-\u27BF])\uFE0F?')

def repl_html(m):
    return f"<i data-lucide=\"{get_lucide(m.group(0))}\"></i>"

def repl_js(m):
    # To avoid quote conflict in JS strings, we omit quotes around the attribute value.
    # HTML attributes don't strictly need quotes if they contain no spaces.
    return f"<i data-lucide={get_lucide(m.group(0))}></i>"

# Process HTML files
for root, _, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', 'images', 'assets', 'twa', 'functions']): continue
    for file in files:
        if file.endswith('.html'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f: content = f.read()
            new_content = emoji_pattern.sub(repl_html, content)
            for char in ['★', '☆', '✓', '✕']: new_content = new_content.replace(char, f"<i data-lucide=\"{get_lucide(char)}\"></i>")
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f: f.write(new_content)

# Process JS files
js_files_to_process = []
for root, _, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', 'images', 'assets', 'twa', 'functions']): continue
    for file in files:
        if file.endswith('.js'):
            js_files_to_process.append(os.path.join(root, file))

for f in ['functions/index.js', 'functions/booking-notifications.js', 'functions/email-templates.js']:
    if os.path.exists(f): js_files_to_process.append(f)

for path in js_files_to_process:
    with open(path, 'r', encoding='utf-8') as f: content = f.read()
    new_content = emoji_pattern.sub(repl_js, content)
    for char in ['★', '☆', '✓', '✕']: new_content = new_content.replace(char, f"<i data-lucide={get_lucide(char)}></i>")
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f: f.write(new_content)
