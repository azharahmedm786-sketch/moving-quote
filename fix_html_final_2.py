with open('advisor.html', 'r') as f:
    content = f.read()

size_func = """function nbSelectSize(size) {
  nbState.size = size;
  document.querySelectorAll(".nb-size-btn").forEach(el => el.classList.remove("selected"));
  document.querySelectorAll(".nb-size-btn").forEach(el => {
    if(el.textContent.includes(size)) el.classList.add("selected");
  });
  nbCalc();
  nbSaveDraft();
}
"""

vehicle_func = """function nbSelectVehicle(vehicle) {
  nbState.vehicle = vehicle;
  document.querySelectorAll(".nb-vehicle-btn").forEach(el => el.classList.remove("selected"));
  document.querySelectorAll(".nb-vehicle-btn").forEach(el => {
    if(el.textContent.includes(vehicle)) el.classList.add("selected");
  });
  nbCalc();
  nbSaveDraft();
}
"""

content = content.replace("function nbSelectSize(size) {", size_func + "\nfunction dummy1() {")
content = content.replace("function nbSelectVehicle(vehicle) {", vehicle_func + "\nfunction dummy2() {")

with open('advisor.html', 'w') as f:
    f.write(content)
