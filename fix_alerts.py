import re
import os

# We need to strip <i data-lucide=...> or <i data-lucide="..."> from:
# 1. console.log / console.error
# 2. alert / confirm
# 3. wa.me / whatsapp URLs
# 4. textContent assignments

def strip_lucide(match):
    # Just remove the tag completely
    # return match.group(1) if we wanted to keep something, but emoji is gone, so let's just return ''
    return ''

# wait, we can just remove `<i data-lucide[^>]*></i>` from inside `console.log(...)`
# Let's write a python script that searches for these and removes them.

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find console.log, console.error, alert, confirm
    # For simplicity, let's just do a regex replace on the entire file for specific patterns:

    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if ('console.log' in line or 'console.error' in line or
            'alert(' in line or 'confirm(' in line or
            'wa.me' in line or 'WhatsApp' in line or
            '.textContent' in line):

            # If line is NOT one of the safe textContent assignments:
            if '.textContent' in line and 't.innerHTML = msg;' not in line:
                # Wait, we already replaced t.textContent to t.innerHTML in script/partner.js
                # Let's just strip lucide from these specific lines
                line = re.sub(r"<i data-lucide[^>]*></i>", "", line)
            elif 'console.log' in line or 'console.error' in line or 'alert(' in line or 'confirm(' in line or 'wa.me' in line or 'api.whatsapp' in line:
                line = re.sub(r"<i data-lucide[^>]*></i>", "", line)

        new_lines.append(line)

    new_content = '\n'.join(new_lines)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed alerts in {filepath}")

for root, _, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', 'images', 'assets', 'twa']): continue
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            process_file(os.path.join(root, file))
