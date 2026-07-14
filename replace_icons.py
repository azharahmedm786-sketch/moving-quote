import os

for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', 'twa', 'functions']):
        continue
    for file in files:
        if file.endswith(('.html', '.js')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            new_content = content.replace('<i data-lucide="package"></i>', '<img src="assets/icons/pz-package.svg" alt="Package" style="width: 1em; height: 1em; vertical-align: middle;">')
            new_content = new_content.replace('<i data-lucide=package></i>', '<img src="assets/icons/pz-package.svg" alt="Package" style="width: 1em; height: 1em; vertical-align: middle;">')
            new_content = new_content.replace('<i data-lucide="truck"></i>', '<img src="assets/icons/pz-truck.svg" alt="Truck" style="width: 1em; height: 1em; vertical-align: middle;">')
            new_content = new_content.replace('<i data-lucide=truck></i>', '<img src="assets/icons/pz-truck.svg" alt="Truck" style="width: 1em; height: 1em; vertical-align: middle;">')

            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
