from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

driver = webdriver.Chrome()

try:
    driver.get("http://localhost:5173")
    print("Página abierta")

    # Esperar a que el botón esté visible por su texto, sin importar la etiqueta
    boton_invitado = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Ingresar como invitado']"))
    )
    print("Botón 'Ingresar como invitado' encontrado")

    boton_invitado.click()
    print("Click realizado")

    # Esperar a que cambie la URL como confirmación de navegación
    WebDriverWait(driver, 10).until(
        EC.url_contains("/home")
    )
    print("Redireccionado a /home")

    # Verificar valor en localStorage
    auth_value = driver.execute_script("return localStorage.getItem('auth');")
    print("Valor de 'auth' en localStorage:", auth_value)
    assert auth_value == "guest"

except Exception as e:
    print("Error durante la prueba:", e)

finally:
    time.sleep(3)
    driver.quit()
