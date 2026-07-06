with open('advisor.html', 'r') as f:
    content = f.read()

# Fix the double closing tags
content = content.replace("</body>\n</html>\n</body>\n</html>", "</body>\n</html>")
content = content.replace("</body>\n</html></body>\n</html>", "</body>\n</html>")

with open('advisor.html', 'w') as f:
    f.write(content)
