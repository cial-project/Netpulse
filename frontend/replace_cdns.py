import os

replacements = {
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css': 'node_modules/@fortawesome/fontawesome-free/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js': 'node_modules/chart.js/dist/chart.umd.js',
    'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns': 'node_modules/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js',
}

css_replacements = {
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap": "../node_modules/@fontsource/inter/index.css"
}

html_dir = '.'
for root, _, files in os.walk(html_dir):
    if 'node_modules' in root: continue
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            for old, new in replacements.items():
                content = content.replace(old, new)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
        elif file.endswith('.css'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            for old, new in css_replacements.items():
                content = content.replace(old, new)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
print("Replaced all CDNs!")
