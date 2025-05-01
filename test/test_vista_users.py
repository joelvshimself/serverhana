from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

driver = webdriver.Chrome()

try:
    driver.get("http://localhost:5173")
    print("App abierta")

    boton_invitado = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Ingresar como invitado']"))
    )
    boton_invitado.click()
    print("Ingresado como invitado")

    WebDriverWait(driver, 10).until(EC.url_contains("/home"))
    driver.get("http://localhost:5173/usuarios")
    print("Ruta /usuarios cargada")

    time.sleep(2)
    ui5_inputs = driver.find_elements(By.TAG_NAME, "ui5-input")
    print("UI5 Inputs detectados:", len(ui5_inputs))
    buscador = ui5_inputs[0]

    # Darle focus antes de escribir
    driver.execute_script("arguments[0].shadowRoot.querySelector('input').focus();", buscador)

    # Escribir y lanzar el evento input
    driver.execute_script("arguments[0].shadowRoot.querySelector('input').value = 'Ana';", buscador)
    driver.execute_script("arguments[0].shadowRoot.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));", buscador)
    time.sleep(2)

    cuerpo_tabla = driver.find_element(By.TAG_NAME, "tbody").text
    print("Contenido tabla:", cuerpo_tabla)
    assert "Ana Torres" in cuerpo_tabla
    assert "Juan Pérez" not in cuerpo_tabla
    print("Búsqueda exitosa: solo Ana Torres aparece")

except Exception as e:
    print("Error en la prueba:", e)

finally:
    time.sleep(3)
    driver.quit()
