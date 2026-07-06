with open('advisor.html', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "event.target.classList.add" in line and ("nbSelectVehicle" in line or "nbSelectSize" in line):
        continue
    new_lines.append(line)

content = "".join(new_lines)
with open('advisor.html', 'w') as f:
    f.write(content)
